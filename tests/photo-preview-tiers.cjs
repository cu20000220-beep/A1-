'use strict';
// Local-only integration: real API handlers, RSA signatures and in-memory SQLite.
// Fixed pose landmarks compare identical ratios across tiers; this is not a new
// MediaPipe accuracy test. No Firebase, remote DB, billing or supplier is used.
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { generateKeyPairSync, sign } = require('node:crypto');
const { createServer } = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, webkit } = require('playwright');
const root = path.resolve(__dirname, '..');
const output = process.env.A1_SCREENSHOT_DIR || '/workspace/work/a1-preview-tiers';
fs.mkdirSync(output, { recursive: true });
const issuer = 'https://local-fixture.example.test/', audience = 'a1-local-fixture';
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'fixture', alg: 'RS256', use: 'sig' };
const encode = v => Buffer.from(JSON.stringify(v)).toString('base64url');
function jwt(tier) {
  const payload = `${encode({ alg: 'RS256', kid: jwk.kid })}.${encode({ iss: issuer, aud: audience,
    sub: `fixture-${tier}`, exp: Math.floor(Date.now() / 1000) + 3600 })}`;
  return `${payload}.${sign('RSA-SHA256', Buffer.from(payload), privateKey).toString('base64url')}`;
}
const sql = new DatabaseSync(':memory:');
sql.exec(fs.readFileSync(path.join(root, 'server/schema.sql'), 'utf8'));
for (const tier of ['GENERAL', 'PREMIUM']) sql.prepare('INSERT INTO memberships (issuer,subject,subscription_status,plan_code,paid_through,payment_verified_at) VALUES (?,?,?,?,?,?)')
  .run(issuer, `fixture-${tier}`, 'active', tier, Date.now() + 3600000, Date.now() - 1000);
const db = {
  prepare(query) {
    const stmt = sql.prepare(query);
    return { bind(...values) { return {
      first: async () => stmt.get(...values) || null,
      all: async () => ({ results: stmt.all(...values) }),
      run: async () => ({ meta: { changes: Number(stmt.run(...values).changes) } })
    }; } };
  }
};
const beta = process.env.A1_TEST_FREE_BETA === 'true';
const env = { ...(beta ? { A1_FREE_BETA_MODE: 'true' } : {}), AUTH_ISSUER: issuer, AUTH_AUDIENCE: audience, AUTH_JWKS_URL: issuer + 'keys', MEMBERSHIP_DB: db };
const calls = [], errors = [], blocked = [], results = [];
const originalFetch = globalThis.fetch;
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

(async () => {
  const membership = await import('../functions/api/membership.js');
  const recommendations = await import('../functions/api/recommendations.js');
  const policy = await import('../functions/api/policy.js');
  const stylist = await import('../functions/api/stylist.js');
  const { handleGlobalRequest } = await import('../functions/api/global/_shared.js');
  globalThis.fetch = async url => {
    assert.equal(String(url), issuer + 'keys', 'No external provider may be called');
    return Response.json({ keys: [jwk] });
  };
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (url.pathname.startsWith('/api/')) {
        const chunks = []; for await (const chunk of req) chunks.push(chunk);
        const body = Buffer.concat(chunks).toString();
        const request = new Request(url, { method: req.method, headers: req.headers,
          ...(['GET', 'HEAD'].includes(req.method) ? {} : { body }) });
        const response = url.pathname === '/api/policy' ? await policy.onRequest({ request, env })
          : url.pathname === '/api/stylist' ? await stylist.onRequest({ request, env })
          : url.pathname === '/api/membership' ? await membership.onRequest({ request, env })
          : url.pathname === '/api/recommendations' ? await recommendations.onRequest({ request, env })
          : await handleGlobalRequest(url.pathname.split('/').at(-1), { request, env });
        calls.push({ path: url.pathname, status: response.status, body: body ? JSON.parse(body) : null });
        assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(Buffer.from(await response.arrayBuffer())); return;
      }
      const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      if (!/^(index\.html|global\.html|stylist\.html|assets\/[\w./-]+)$/.test(file) || file.includes('..')) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
      res.end(fs.readFileSync(path.join(root, file)));
    } catch (error) { errors.push(error.stack); res.writeHead(500); res.end(); }
  });
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const engine = process.env.A1_BROWSER || 'chromium';
    browser = engine === 'webkit' ? await webkit.launch({ headless: true })
      : await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    let referenceMetrics;
    for (const width of [390, 820]) for (const language of ['ko', 'en']) for (const tier of (beta ? ['ANONYMOUS', 'FREE', 'GENERAL', 'PREMIUM'] : ['FREE', 'GENERAL', 'PREMIUM'])) {
      const context = await browser.newContext({ viewport: { width, height: 1180 }, locale: language === 'ko' ? 'ko-KR' : 'en-US', hasTouch: true });
      await context.route('**/*', route => {
        if (new URL(route.request().url()).origin === origin) return route.continue();
        blocked.push(route.request().url()); return route.abort();
      });
      if (tier !== 'ANONYMOUS') await context.addCookies([{ name: 'CF_Authorization', value: jwt(tier), url: origin, httpOnly: true, sameSite: 'Strict' }]);
      const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(lang => {
        localStorage.setItem('a1-fashion:language', lang);
        window.fixtureURLs = new Set();
        const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
        URL.createObjectURL = value => { const url = create(value); window.fixtureURLs.add(url); return url; };
        URL.revokeObjectURL = url => { window.fixtureURLs.delete(url); return revoke(url); };
        // Deterministic model fixture; real image loading, rendering, analysis math
        // and authorization are used. Same landmarks for every tier and language.
        window.Pose = class {
          setOptions() {} onResults(fn) { this.result = fn; }
          async initialize() {} async reset() {} async close() {}
          async send() {
            const points = Array.from({ length: 33 }, () => ({ x: .5, y: .5, visibility: .99 }));
            for (const [i, [x, y]] of Object.entries({ 11:[.3,.2],12:[.7,.2],23:[.36,.45],24:[.64,.45],25:[.36,.65],26:[.64,.65],27:[.36,.9],28:[.64,.9] })) points[i] = { x, y, visibility: .99 };
            this.result({ poseLandmarks: points });
          }
        };
        document.addEventListener('a1:analysis-ready', e => { window.fixtureMetrics = e.detail.metrics; });
      }, language);
      await page.goto(origin, { waitUntil: 'networkidle' });
      await page.evaluate(lang => window.A1I18n.setLanguage(lang), language);
      await page.waitForFunction(() => !document.querySelector('#premium-check').disabled);
      const before = calls.filter(c => c.path !== '/api/membership').length;
      if (width === 390 && language === 'ko' && tier === (beta ? 'ANONYMOUS' : 'FREE')) {
        await page.evaluate(() => {
          window.fixtureNativeImage = window.Image;
          const src = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
          window.Image = function () {
            const image = new window.fixtureNativeImage();
            Object.defineProperty(image, 'src', { get() { return src.get.call(image); }, set(value) { window.fixtureDelayedLoad = () => src.set.call(image, value); } });
            return image;
          };
        });
        await page.locator('#ai-photo').setInputFiles(path.join(root, 'assets/photos/man.jpg'));
        await page.waitForFunction(() => window.fixtureURLs.size === 1);
        await page.locator('#ai-clear').click();
        assert.equal(await page.evaluate(() => window.fixtureURLs.size), 0, 'Clear cancels a pending image URL immediately');
        await page.evaluate(() => { window.Image = window.fixtureNativeImage; });
        assert.equal(await page.locator('#ai-photo-preview').isVisible(), false);
      }
      await page.locator('#ai-photo').setInputFiles(path.join(root, 'assets/photos/man.jpg'));
      await page.waitForFunction(() => !document.querySelector('#ai-photo-preview').hidden);
      assert.equal(await page.locator('#ai-placeholder').isVisible(), false);
      assert.equal(await page.locator('#ai-preview-canvas').evaluate(c => c.width > 100 && c.height > 100), true);
      assert.equal(await page.evaluate(() => window.fixtureURLs.size), 0, 'Temporary decode URL is revoked immediately');
      assert.equal(calls.filter(c => c.path !== '/api/membership').length, before, 'Selecting a photo sends no API request');
      if (tier === 'FREE') await page.locator('#ai-studio').screenshot({ style: 'header,nav.site-navigation { visibility:hidden!important; }', path: path.join(output, `${engine}-preview-${language}-${width}.png`) });
      await page.locator('#ai-analyze').click();
      await page.waitForFunction(() => !document.querySelector('#ai-result').hidden);
      const metrics = await page.evaluate(() => window.fixtureMetrics);
      referenceMetrics ||= metrics; assert.deepEqual(metrics, referenceMetrics);
      assert.equal(await page.locator('#ai-photo-preview').isVisible(), false);
      assert.equal(calls.filter(c => c.path !== '/api/membership').length, before, 'Free analysis sends no image or ratios');
      await page.waitForFunction(() => !document.querySelector('#premium-check').disabled);
      const membershipResponse = page.waitForResponse(r => r.url().endsWith('/api/membership'));
      await page.locator('#premium-check').evaluate(el => el.click());
      assert.equal((await membershipResponse).status(), !beta && tier === 'FREE' ? 403 : 200);
      await page.waitForFunction(() => !document.querySelector('#premium-check').disabled);
      if (!beta && tier === 'FREE') {
        assert.equal(await page.locator('#premium-results').isVisible(), false);
        assert.equal(await page.locator('#ai-cards article').count(), 0);
      } else {
        const response = page.waitForResponse(r => r.url().endsWith('/api/recommendations'));
        await page.locator('#premium-recommend').click(); const recommendationResponse = await response; assert.equal(recommendationResponse.status(), 200);
        const recommendationData = await recommendationResponse.json();
        if (recommendationData.recommendations.length !== 4) console.log('recommendation diagnostic', JSON.stringify({ recommendationData, request: calls.filter(c=>c.path==='/api/recommendations').at(-1), metrics }));
        await page.waitForFunction(() => !document.querySelector('#premium-results').hidden);
        assert.equal(await page.locator('#ai-cards article').count(), 4);
        assert.equal(await page.locator('#ai-shopping-queries a').count(), 6);
      }
      if (beta && width === 390 && language === 'ko') {
        await page.waitForFunction(() => !document.querySelector('[data-wish]').disabled);
        const saved = page.waitForResponse(r => r.url().endsWith('/api/global/watchlist') && r.request().method() === (tier === 'ANONYMOUS' ? 'GET' : 'POST'));
        await page.locator('[data-wish]').first().click();
        assert.equal((await saved).status(), tier === 'ANONYMOUS' ? 401 : 201);
        await page.waitForFunction(() => !document.querySelector('[data-wish]').disabled);
        assert.equal(await page.locator('#premium-results').isVisible(), true, 'Sign-in is needed only for saving; public examples remain visible');
        if (tier !== 'ANONYMOUS') {
          assert.equal(await page.locator('[data-wish]').first().getAttribute('aria-pressed'), 'true');
          const removed = page.waitForResponse(r => r.url().endsWith('/api/global/watchlist') && r.request().method() === 'DELETE');
          await page.locator('[data-wish]').first().click(); assert.equal((await removed).status(), 200);
          await page.waitForFunction(() => !document.querySelector('[data-wish]').disabled);
          assert.equal(await page.locator('[data-wish]').first().getAttribute('aria-pressed'), 'false');
        }
      }
      // Bypass the UI deliberately: forged browser tier flags cannot grant access.
      const direct = await page.evaluate(async () => {
        const invoke = async (endpoint, body) => {
          const r = await fetch('/api/' + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Plan': 'PREMIUM' }, body: JSON.stringify(body) });
          return { status: r.status, value: await r.json() };
        };
        return {
          recommendation: await invoke('recommendations', { metrics: window.fixtureMetrics, preferences: { gender: '전체', style: '전체', budget: 100000 } }),
          comparison: await invoke('global/comparison', { productId: 'demo-tee', destination: 'KR', currency: 'KRW' })
        };
      });
      assert.equal(direct.recommendation.status, !beta && tier === 'FREE' ? 403 : 200);
      assert.equal(direct.comparison.status, beta || tier === 'PREMIUM' ? 200 : 403);
      if (beta) { assert.equal(direct.comparison.value.freeBetaMode, true); assert.equal(direct.comparison.value.results.length, 0); assert.equal(direct.comparison.value.minimumAmount, null); }
      else if (tier === 'PREMIUM') assert.equal(direct.comparison.value.demo, true);
      else assert.equal(direct.comparison.value.error, tier === 'GENERAL' ? 'premium_required' : 'subscription_required');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      const prefix = `${engine}-${beta ? 'beta-' : ''}${tier.toLowerCase()}-${language}-${width}`;
      if (width === 390) {
        await page.locator('#ai-result').screenshot({ style: 'header,nav.site-navigation { visibility:hidden!important; }', path: path.join(output, `${prefix}-analysis.png`) });
        await page.locator('#premium').screenshot({ style: 'header,nav.site-navigation { visibility:hidden!important; }', path: path.join(output, `${prefix}-styles.png`) });
      }
      await page.locator('#ai-clear').click();
      for (const id of ['ai-canvas', 'ai-preview-canvas']) assert.equal(await page.locator('#' + id).evaluate(c => c.width * c.height), 1);
      assert.equal(await page.evaluate(() => window.fixtureURLs.size), 0);
      assert.equal(await page.locator('#ai-result').isVisible(), false);
      assert.equal(await page.locator('#ai-photo-preview').isVisible(), false);
      assert.equal(await page.locator('#ai-cards article').count(), 0);
      assert.equal(await page.locator('#ai-photo').inputValue(), '');
      // Reject invalid images; replacement and pagehide must not revive old pixels.
      await page.locator('#ai-photo').setInputFiles({ name: 'bad.png', mimeType: 'image/png', buffer: Buffer.from('invalid') });
      await page.waitForFunction(() => document.querySelector('#ai-status').classList.contains('is-error'));
      assert.equal(await page.evaluate(() => window.fixtureURLs.size), 0);
      assert.equal(await page.locator('#ai-photo-preview').isVisible(), false);
      await page.locator('#ai-photo').setInputFiles(path.join(root, 'assets/photos/man.jpg'));
      await page.waitForFunction(() => !document.querySelector('#ai-photo-preview').hidden);
      await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
      assert.equal(await page.locator('#ai-preview-canvas').evaluate(c => c.width * c.height), 1);
      await page.goto(origin + '/global.html#comparison', { waitUntil: 'networkidle' });
      await page.evaluate(lang => window.A1I18n.setLanguage(lang), language);
      const comparisonResponse = page.waitForResponse(r => r.url().endsWith('/api/global/comparison'));
      await page.locator('#comparison-form button').click();
      assert.equal((await comparisonResponse).status(), beta || tier === 'PREMIUM' ? 200 : 403);
      await page.waitForFunction(() => !document.querySelector('#comparison-form button').disabled);
      if (beta || tier === 'PREMIUM') {
        await page.waitForFunction(() => document.querySelector('#comparison-results').children.length > 0);
        assert.match(await page.locator('#comparison-results').innerText(), beta ? /최저가|unavailable|준비|prepar/i : /DEMO/);
      } else assert.equal(await page.locator('#comparison-results').innerText(), '');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      if (width === 390) await page.locator('main').screenshot({ style: 'header,nav.site-navigation { visibility:hidden!important; }', path: path.join(output, `${prefix}-comparison.png`) });
      if (beta) {
        await page.goto(origin + '/stylist.html', { waitUntil: 'networkidle' });
        await page.evaluate(lang => window.A1I18n.setLanguage(lang), language);
        await page.locator('#stylist-message').fill(language === 'ko' ? '출근 코디를 추천해주세요' : 'Suggest an office outfit');
        const response = page.waitForResponse(r => r.url().endsWith('/api/stylist') && r.request().method() === 'POST');
        await page.locator('#stylist-send').click();
        assert.equal((await response).status(), 200);
        await page.waitForFunction(() => document.querySelectorAll('.stylist-message:not(.is-user)').length > 0);
        assert.match(await page.locator('#stylist-chat').innerText(), /DEMO/);
        assert.equal(await page.locator('.stylist-product').count(), 0);
        if (width === 390) await page.locator('main').screenshot({ style: 'header,nav.site-navigation { visibility:hidden!important; }', path: path.join(output, `${prefix}-stylist.png`) });
      }
      console.log(`${engine} ${beta ? 'beta' : 'paid'} ${tier} ${language} ${width}: passed`);
      results.push({ engine, tier, language, width, metrics, recommendation: direct.recommendation.status, comparison: direct.comparison.status });
      await context.close();
    }
    assert.deepEqual(errors, []); assert.deepEqual(blocked, []);
    for (const call of calls.filter(c => c.path === '/api/recommendations')) assert.doesNotMatch(JSON.stringify(call.body), /photo|image|base64|landmark/i);
    fs.writeFileSync(path.join(output, `${engine}-${beta ? 'beta-' : ''}results.json`), JSON.stringify({ results, errors, blocked, calls: calls.length }, null, 2));
    console.log(`${engine} ${beta ? 'free beta' : 'paid policy'}: ${results.length} tier/language/viewport cases passed; preview, cleanup, identical ratios, real server 403/200, no external requests.`);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
    sql.close(); globalThis.fetch = originalFetch;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
