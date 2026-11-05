'use strict';

// Localization integration only. Account API responses and Pose landmarks are
// explicit local fixtures; auth security and real inference have separate tests.
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const { resolve, extname } = require('node:path');
const { chromium } = require('playwright');

const root = resolve(__dirname, '..');
const apiCalls = [];
const typedEmail = 'language-customer@example.test';
const typedPassword = 'Language-fixture-password-2026!';
let premiumAllowed = false;
let recommendForMember;
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };

function apiResponse(path, input, language) {
  if (path === '/api/auth/config') return { status: 200, body: { configured: true } };
  if (path === '/api/auth/session') return { status: 401, body: { ok: false, authenticated: false, error: 'authentication_required', message: '로그인이 필요합니다. 다시 로그인해주세요.' } };
  if (path === '/api/auth/signup') return { status: 503, body: { ok: false, error: 'provider_method_disabled', message: '이메일 회원가입이 활성화되지 않았습니다. 관리자에게 알려주세요. [AUTH-METHOD]' } };
  if (path === '/api/membership') return premiumAllowed
    ? { status: 200, body: { allowed: true, accessUntil: Date.now() + 3600000 } }
    : { status: 401, body: { allowed: false, error: 'authentication_required' } };
  if (path === '/api/recommendations') return premiumAllowed
    ? { status: 200, body: recommendForMember(input, { language: /^en(?:\b|-)/.test(language || '') ? 'en' : 'ko' }) }
    : { status: 403, body: { allowed: false, error: 'subscription_required' } };
  return { status: 404, body: { ok: false, error: 'not_found' } };
}

async function assertEnglish(page, context) {
  await page.waitForFunction(() => document.documentElement.lang === 'en');
  await page.waitForTimeout(30); // Let the DOM translation observer flush.
  const leftover = await page.evaluate(() => {
    const copy = document.body.cloneNode(true);
    copy.querySelectorAll('[data-language-switcher],script,style').forEach(node => node.remove());
    // Hidden account controls and hidden result slots are not the current flow.
    copy.querySelectorAll('[hidden]').forEach(node => node.remove());
    const text = copy.textContent || '';
    return text.match(/[^\n.!?]{0,45}[\uac00-\ud7af][^\n.!?]{0,80}/gu) || [];
  });
  assert.deepEqual(leftover, [], `Untranslated English text on ${context}: ${leftover.join(' | ')}`);
  const attributes = await page.locator('[aria-label],[alt],[placeholder],[title],meta[name=description]').evaluateAll(nodes => nodes.flatMap(node =>
    ['aria-label', 'alt', 'placeholder', 'title', ...(node.matches('meta') ? ['content'] : [])].map(attribute => node.getAttribute(attribute)).filter(Boolean)
  ));
  assert.ok(attributes.every(value => !/[\uac00-\ud7af]/u.test(value)), `Untranslated English accessibility/metadata on ${context}: ${attributes.filter(value => /[\uac00-\ud7af]/u.test(value)).join(' | ')}`);
  assert.ok(!/[\uac00-\ud7af]/u.test(await page.title()), `English title on ${context}`);
}

async function choose(page, language) {
  const selector = page.locator('select[data-language-select]').first();
  await selector.selectOption(language);
  await page.waitForFunction(language => document.documentElement.lang === language, language);
  assert.equal(await selector.inputValue(), language);
}

async function noPrivateStorage(page) {
  const stored = await page.evaluate(() => JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]));
  assert.ok(!stored.includes(typedEmail));
  assert.ok(!stored.includes(typedPassword));
}

(async () => {
  // Use the real private recommendation producer with an explicit UI-only
  // entitlement fixture. Signature/DB enforcement remains in premium-ui.cjs.
  ({ recommendForMember } = await import('../server/recommendation-engine.mjs'));
  const headerRules = [];
  let rule;
  for (const line of (await readFile(resolve(root, '_headers'), 'utf8')).split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (line.startsWith('/')) { rule = { path: line.trim(), values: {} }; headerRules.push(rule); }
    else { const at = line.indexOf(':'); rule.values[line.slice(0, at).trim()] = line.slice(at + 1).trim(); }
  }
  const headers = path => Object.assign({}, ...headerRules.filter(rule => rule.path.endsWith('*')
    ? path.startsWith(rule.path.slice(0, -1)) : path === rule.path).map(rule => rule.values));
  const server = createServer(async (incoming, outgoing) => {
    try {
      const url = new URL(incoming.url, `http://${incoming.headers.host}`);
      if (url.pathname.startsWith('/api/')) {
        const chunks = [];
        for await (const chunk of incoming) chunks.push(chunk);
        const bytes = Buffer.concat(chunks);
        apiCalls.push({ path: url.pathname, language: incoming.headers['accept-language'], method: incoming.method,
          body: bytes.length ? JSON.parse(bytes.toString()) : null });
        const response = apiResponse(url.pathname, bytes.length ? JSON.parse(bytes.toString()) : null, incoming.headers['accept-language']);
        outgoing.writeHead(response.status, { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' });
        outgoing.end(JSON.stringify(response.body)); return;
      }
      const pathname = url.pathname === '/' ? '/index.html' : ['account', 'privacy', 'credits'].includes(url.pathname.slice(1)) ? url.pathname + '.html' : url.pathname;
      const file = decodeURIComponent(pathname.slice(1));
      const full = resolve(root, file);
      if (!full.startsWith(root + '/') || !/^(?:index\.html|account\.html|privacy\.html|credits\.html|assets\/.+)$/.test(file)) {
        outgoing.writeHead(404); outgoing.end(); return;
      }
      const data = await readFile(full);
      outgoing.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', ...headers(pathname) });
      outgoing.end(data);
    } catch (error) { outgoing.writeHead(error.code === 'ENOENT' ? 404 : 500); outgoing.end(); }
  });
  let browser;
  const errors = [], requests = [];
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
      args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const context = await browser.newContext({ locale: 'en-US', viewport: { width: 390, height: 844 } });
    context.on('page', page => { page.on('pageerror', error => errors.push(error.message)); page.on('request', request => requests.push({ url: request.url(), method: request.method() })); });
    const page = await context.newPage();
    await page.goto(origin, { waitUntil: 'networkidle' });
    await assertEnglish(page, 'main');
    assert.equal(await page.locator('select[data-language-select]').first().inputValue(), 'en');
    assert.equal(await page.locator('#premium-lock').isVisible(), true);
    assert.equal(await page.locator('#ai-cards .card').count(), 0);
    assert.equal(apiCalls.length, 0, 'Choosing a UI language never fetches paid recommendations');
    assert.equal(await page.locator('#ai-gender option').evaluateAll(nodes => nodes.map(node => node.value).join('|')), '전체|여성|남성|유니섹스');
    assert.equal(await page.locator('#ai-style option').evaluateAll(nodes => nodes.map(node => node.value).join('|')), '전체|미니멀|캐주얼|클래식|스트리트');
    await page.screenshot({ path: '/tmp/a1-english-main-390.png', fullPage: true });
    for (const [width, height] of [[320,740], [390,844], [820,1180]]) {
      await page.setViewportSize({ width, height });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `English main overflow ${width}`);
    }

    // UI-only inference fixture: real model inference remains in ai-studio.cjs.
    await page.evaluate(() => {
      window.Pose = class {
        setOptions() {}
        onResults(callback) { this.callback = callback; }
        async initialize() {}
        async reset() {}
        async send() {
          const points = Array.from({ length: 33 }, () => ({ x: .5, y: .5, visibility: .99 }));
          for (const [index, point] of Object.entries({ 11:[.3,.2],12:[.7,.2],23:[.36,.45],24:[.64,.45],25:[.36,.65],26:[.64,.65],27:[.36,.9],28:[.64,.9] })) {
            points[index] = { x: point[0], y: point[1], visibility: .99 };
          }
          this.callback({ poseLandmarks: points });
        }
        async close() {}
      };
    });
    await page.locator('#ai-photo').setInputFiles(resolve(root, 'assets/photos/man.jpg'));
    await page.locator('#ai-analyze').click();
    await page.waitForFunction(() => !document.querySelector('#ai-result').hidden && document.querySelector('#ai-output').getAttribute('aria-busy') === 'false');
    const pixels = await page.locator('#ai-canvas').evaluate(canvas => canvas.toDataURL());
    await assertEnglish(page, 'free analysis result');
    assert.match(await page.locator('#ai-metrics').innerText(), /shoulder|pelvis|hip/i);
    await choose(page, 'ko');
    assert.equal(await page.locator('#ai-result').isVisible(), true);
    assert.match(await page.locator('#ai-metrics').innerText(), /어깨/);
    assert.equal(await page.locator('#ai-canvas').evaluate(canvas => canvas.toDataURL()), pixels, 'Language switch preserves existing photo result pixels');
    await choose(page, 'en');
    await assertEnglish(page, 'retained free analysis');
    assert.equal(await page.locator('#ai-canvas').evaluate(canvas => canvas.toDataURL()), pixels);
    assert.equal(apiCalls.length, 0, 'Language switch does not send the photo or metrics');
    assert.equal(await page.locator('#premium-lock').isVisible(), true);
    const membershipResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/membership');
    await page.locator('#premium-check').click();
    assert.equal((await membershipResponse).status(), 401);
    await page.waitForFunction(() => !document.querySelector('#premium-check').disabled);
    await assertEnglish(page, 'English subscription lock message');
    assert.equal(await page.locator('#premium-lock').isVisible(), true);
    assert.equal(await page.locator('#ai-cards .card').count(), 0);
    assert.match(apiCalls.filter(call => call.path === '/api/membership').at(-1).language, /^en(?:\b|-)/);
    premiumAllowed = true;
    const paidCheck = page.waitForResponse(response => new URL(response.url()).pathname === '/api/membership');
    await page.locator('#premium-check').click();
    assert.equal((await paidCheck).status(), 200);
    await page.waitForFunction(() => !document.querySelector('#premium-controls').hidden);
    const recommendations = page.waitForResponse(response => new URL(response.url()).pathname === '/api/recommendations');
    await page.locator('#premium-recommend').click();
    assert.equal((await recommendations).status(), 200);
    await page.waitForFunction(() => !document.querySelector('#premium-results').hidden);
    assert.equal(await page.locator('#ai-cards .card').count(), 4);
    assert.equal(await page.locator('#ai-shopping a').count(), 6);
    await assertEnglish(page, 'English protected recommendations');
    assert.match(await page.locator('#ai-cards .price').first().innerText(), /KRW|₩/);
    await page.locator('[data-detail]').first().click();
    assert.equal(await page.locator('#detail').isVisible(), true);
    await assertEnglish(page, 'English style details');
    await page.locator('#close-detail').click();
    assert.match(apiCalls.filter(call => call.path === '/api/recommendations').at(-1).language, /^en(?:\b|-)/);
    const koreanRecommendations = page.waitForResponse(response => new URL(response.url()).pathname === '/api/recommendations');
    await choose(page, 'ko');
    assert.equal((await koreanRecommendations).status(), 200);
    await page.waitForFunction(() => !document.querySelector('#premium-results').hidden);
    assert.match(await page.locator('#ai-cards .product-title').first().innerText(), /[\uac00-\ud7af]/u);
    assert.match(apiCalls.filter(call => call.path === '/api/recommendations').at(-1).language, /^ko(?:\b|-)/);
    const englishRecommendations = page.waitForResponse(response => new URL(response.url()).pathname === '/api/recommendations');
    await choose(page, 'en');
    assert.equal((await englishRecommendations).status(), 200);
    await page.waitForFunction(() => !document.querySelector('#premium-results').hidden);
    await assertEnglish(page, 'retranslated protected results');
    assert.equal(await page.locator('#ai-canvas').evaluate(canvas => canvas.toDataURL()), pixels);

    await page.goto(`${origin}/account`, { waitUntil: 'networkidle' });
    await assertEnglish(page, 'account');
    await page.locator('#auth-tab-signup').click();
    await page.locator('#auth-email').fill(typedEmail);
    await page.locator('#auth-password').fill(typedPassword);
    await page.locator('#auth-confirm').fill(typedPassword);
    await page.locator('#auth-consent').check();
    const beforeSwitch = apiCalls.filter(call => call.method === 'POST').length;
    await choose(page, 'ko');
    assert.equal(await page.locator('#auth-email').inputValue(), typedEmail);
    assert.equal(await page.locator('#auth-password').inputValue(), typedPassword);
    assert.equal(await page.locator('#auth-confirm').inputValue(), typedPassword);
    assert.equal(await page.locator('#auth-consent').isChecked(), true);
    await choose(page, 'en');
    assert.equal(await page.locator('#auth-email').inputValue(), typedEmail);
    assert.equal(await page.locator('#auth-password').inputValue(), typedPassword);
    assert.equal(await page.locator('#auth-confirm').inputValue(), typedPassword);
    assert.equal(await page.locator('#auth-consent').isChecked(), true);
    assert.equal(apiCalls.filter(call => call.method === 'POST').length, beforeSwitch);
    await assertEnglish(page, 'signup');
    await noPrivateStorage(page);
    for (const [width, height] of [[820,1180], [390,844], [320,740]]) {
      await page.setViewportSize({ width, height });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `English account overflow ${width}`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: '/tmp/a1-english-account-390.png', fullPage: true });
    const rejected = page.waitForResponse(response => new URL(response.url()).pathname === '/api/auth/signup');
    await page.locator('#auth-submit').click();
    assert.equal((await rejected).status(), 503);
    await page.waitForFunction(() => document.querySelector('#auth-form').getAttribute('aria-busy') === 'false');
    assert.match(await page.locator('#auth-status').textContent(), /AUTH-METHOD/);
    await assertEnglish(page, 'English auth failure');
    const posted = apiCalls.filter(call => call.path === '/api/auth/signup').at(-1);
    assert.match(posted.language, /^en(?:\b|-)/);
    assert.deepEqual(posted.body, { email: typedEmail, password: typedPassword });
    await noPrivateStorage(page);

    await choose(page, 'ko');
    for (const path of ['/privacy.html', '/credits.html', '/index.html']) {
      await page.goto(origin + path, { waitUntil: 'networkidle' });
      assert.equal(await page.locator('html').getAttribute('lang'), 'ko', `Remember Korean on ${path}`);
      assert.equal(await page.locator('select[data-language-select]').first().inputValue(), 'ko');
    }
    await choose(page, 'en');
    for (const path of ['/privacy.html', '/credits.html', '/account.html']) {
      await page.goto(origin + path, { waitUntil: 'networkidle' });
      await assertEnglish(page, path);
    }
    const foreign = await browser.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 } });
    const fallback = await foreign.newPage();
    await fallback.goto(origin, { waitUntil: 'networkidle' });
    await assertEnglish(fallback, 'unsupported-language English fallback');
    await foreign.close();
    const korean = await browser.newContext({ locale: 'ko-KR' });
    const koreanPage = await korean.newPage();
    await koreanPage.goto(origin, { waitUntil: 'networkidle' });
    assert.equal(await koreanPage.locator('html').getAttribute('lang'), 'ko');
    await korean.close();
    assert.ok(requests.every(request => !/^https?:/.test(request.url) || new URL(request.url).origin === origin), 'Translations, styles, images and requests stay on this origin');
    assert.equal(apiCalls.filter(call => call.path === '/api/recommendations').length, 3, 'Only the explicit recommendation click and two selected paid-result language changes request protected data');
    assert.deepEqual(errors, []);
    console.log('Bilingual UI passed: browser detection/fallback, persistence, complete public English text/accessibility, preserved form/photo state, English auth errors, unchanged filter values, protected English details and authorized language refetch, mobile layouts, no external translation service.');
    await context.close();
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
