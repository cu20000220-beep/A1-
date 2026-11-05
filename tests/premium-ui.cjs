'use strict';

// Local integration fixture only: real API handlers, real RSA verification, and
// an in-memory D1-shaped test database. No production users or payments exist.
// The analysis-ready event supplies fixed ratios; actual photo inference is
// exercised separately by tests/ai-studio.cjs.
const assert = require('node:assert/strict');
const { generateKeyPairSync, sign } = require('node:crypto');
const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const { resolve, extname } = require('node:path');
const { chromium } = require('playwright');

const root = resolve(__dirname, '..');
const issuer = 'https://ui-members.example.test/';
const audience = 'a1fashion-local-ui-test';
const jwksUrl = `${issuer}.well-known/jwks.json`;
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'local-ui-fixture', use: 'sig', alg: 'RS256' };
const encoded = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const now = Date.now();
const signingInput = `${encoded({ alg: 'RS256', kid: jwk.kid, typ: 'JWT' })}.${encoded({
  iss: issuer, aud: audience, sub: 'fixture-member', exp: Math.floor(now / 1000) + 3600
})}`;
const jwt = `${signingInput}.${sign('RSA-SHA256', Buffer.from(signingInput), privateKey).toString('base64url')}`;
const paidRow = {
  issuer, subject: 'fixture-member', subscription_status: 'active',
  paid_through: now + 3600000, payment_verified_at: now - 1000
};
const calls = [];
let row = null;
let configured = false;
let databaseReads = 0;
const environment = {
  AUTH_ISSUER: issuer, AUTH_AUDIENCE: audience, AUTH_JWKS_URL: jwksUrl,
  MEMBERSHIP_DB: {
    prepare(sql) {
      assert.match(sql, /WHERE issuer = \? AND subject = \?/);
      assert.doesNotMatch(sql, /INSERT|UPDATE|DELETE/i);
      return { bind(boundIssuer, boundSubject) {
        assert.equal(boundIssuer, issuer);
        assert.equal(boundSubject, paidRow.subject);
        return { async first() { databaseReads++; return row; } };
      } };
    }
  }
};

async function ratiosReady(page) {
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('a1:analysis-ready', {
    detail: { metrics: { shoulderHipRatio: 1.1, legTorsoRatio: 1.6 } }
  })));
}

async function checkMembership(page, expectedStatus) {
  const response = page.waitForResponse(response => response.url().endsWith('/api/membership'));
  await page.locator('#premium-check').click();
  assert.equal((await response).status(), expectedStatus);
  await page.waitForFunction(() => !document.querySelector('#premium-check').disabled);
}

async function assertLocked(page) {
  assert.equal(await page.locator('#premium-lock').isVisible(), true);
  assert.equal(await page.locator('#premium-controls').isVisible(), false);
  assert.equal(await page.locator('#premium-results').isVisible(), false);
  assert.equal(await page.locator('#ai-cards article').count(), 0);
  assert.equal(await page.locator('#ai-shopping-queries a').count(), 0);
}

(async () => {
  const membership = await import('../functions/api/membership.js');
  const recommendations = await import('../functions/api/recommendations.js');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), jwksUrl, 'The fixture must never contact an external service');
    assert.equal(options.redirect, 'manual');
    return new Response(JSON.stringify({ keys: [jwk] }), { headers: { 'Content-Type': 'application/json' } });
  };
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.wasm': 'application/wasm' };
  const server = createServer(async (incoming, outgoing) => {
    try {
      const url = new URL(incoming.url, `http://${incoming.headers.host}`);
      if (url.pathname === '/api/membership' || url.pathname === '/api/recommendations') {
        const chunks = [];
        for await (const chunk of incoming) chunks.push(chunk);
        const body = Buffer.concat(chunks);
        const request = new Request(url, {
          method: incoming.method, headers: incoming.headers,
          ...(incoming.method === 'GET' || incoming.method === 'HEAD' ? {} : { body })
        });
        const handler = url.pathname === '/api/membership' ? membership : recommendations;
        const response = await handler.onRequest({ request, env: configured ? environment : {} });
        calls.push({ path: url.pathname, status: response.status,
          body: body.length ? JSON.parse(body.toString()) : null,
          cacheControl: response.headers.get('Cache-Control') });
        outgoing.writeHead(response.status, Object.fromEntries(response.headers));
        outgoing.end(Buffer.from(await response.arrayBuffer()));
        return;
      }
      const file = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
      const fullPath = resolve(root, file);
      if (!fullPath.startsWith(root + '/') || !/^(?:index\.html|credits\.html|assets\/.+)$/.test(file)) {
        outgoing.writeHead(404); outgoing.end(); return;
      }
      const data = await readFile(fullPath);
      outgoing.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' });
      outgoing.end(data);
    } catch (error) {
      outgoing.writeHead(error.code === 'ENOENT' ? 404 : 500);
      outgoing.end();
    }
  });
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
    const context = await browser.newContext({ locale: 'ko-KR', viewport: { width: 390, height: 844 } });
    const errors = [];
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem('paid', 'true');
      localStorage.setItem('subscriptionStatus', 'active');
      localStorage.setItem('a1:membership', JSON.stringify({ allowed: true, paid: true }));
      localStorage.setItem('trialStartedAt', String(Date.now()));
    });
    await page.goto(origin, { waitUntil: 'networkidle' });
    await assertLocked(page);
    assert.equal(calls.length, 0, 'Opening the page never requests protected content');
    await ratiosReady(page);
    await assertLocked(page);
    assert.equal(calls.length, 0, 'A free analysis event never sends metrics or requests recommendations');

    await checkMembership(page, 503);
    await assertLocked(page);
    assert.match(await page.locator('#premium-status').textContent(), /준비 중/);
    configured = true;
    await checkMembership(page, 401);
    await assertLocked(page);
    assert.equal(databaseReads, 0, 'Browser paid flags do not create an authenticated identity');

    await context.addCookies([{ name: 'CF_Authorization', value: jwt, url: origin, httpOnly: true, sameSite: 'Strict' }]);
    await checkMembership(page, 403);
    await assertLocked(page);
    assert.equal(databaseReads, 1);
    row = { ...paidRow };
    await checkMembership(page, 200);
    assert.equal(await page.locator('#premium-lock').isVisible(), false);
    assert.equal(await page.locator('#premium-controls').isVisible(), true);
    assert.equal(await page.locator('#premium-recommend').isEnabled(), true);
    assert.equal(await page.locator('#ai-cards article').count(), 0, 'Membership confirmation alone does not fetch recommendations');
    await page.locator('#ai-budget').selectOption('100000');
    let recommendationResponse = page.waitForResponse(response => response.url().endsWith('/api/recommendations'));
    await page.locator('#premium-recommend').click();
    assert.equal((await recommendationResponse).status(), 200);
    await page.waitForFunction(() => !document.querySelector('#premium-results').hidden);
    assert.equal(await page.locator('#ai-cards article').count(), 4);
    assert.equal(await page.locator('#ai-shopping-queries a').count(), 6);
    const posted = calls.filter(call => call.path === '/api/recommendations').at(-1).body;
    assert.deepEqual(posted, {
      metrics: { shoulderHipRatio: 1.1, legTorsoRatio: 1.6 },
      preferences: { gender: '전체', style: '전체', budget: 100000 }
    });
    assert.doesNotMatch(JSON.stringify(posted), /photo|image|landmark|file|base64/i);
    for (const link of await page.locator('#ai-shopping-queries a').evaluateAll(nodes => nodes.map(node => ({ href: node.href, rel: node.rel, target: node.target })))) {
      assert.match(link.href, /^https:\/\/(?:www\.coupang\.com|www\.temu\.com|search\.shopping\.naver\.com)\//);
      assert.match(link.rel, /noopener/);
      assert.equal(link.target, '_blank');
    }
    await page.locator('[data-detail]').first().click();
    assert.equal(await page.locator('#detail').isVisible(), true);
    await page.locator('#close-detail').click();
    const wish = page.locator('[data-wish]').first();
    await wish.click();
    assert.equal(await wish.getAttribute('aria-pressed'), 'true');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: '/tmp/a1-premium-mobile.png', fullPage: true });

    // The same signed user remains logged in, but payment has been revoked.
    // The next POST must re-read server state and erase all earlier paid output.
    row = { ...paidRow, subscription_status: 'canceled' };
    recommendationResponse = page.waitForResponse(response => response.url().endsWith('/api/recommendations'));
    await page.locator('#premium-recommend').click();
    assert.equal((await recommendationResponse).status(), 403);
    await page.waitForFunction(() => !document.querySelector('#premium-lock').hidden);
    await assertLocked(page);

    row = { ...paidRow };
    await checkMembership(page, 200);
    await page.evaluate(() => document.dispatchEvent(new CustomEvent('a1:analysis-cleared')));
    await assertLocked(page);
    assert.equal(await page.locator('#premium-recommend').isDisabled(), true);
    assert.ok(calls.every(call => call.cacheControl === 'private, no-store'));
    assert.ok(databaseReads >= 5, 'Protected POST requests independently check the payment record');
    assert.deepEqual(errors, []);
    console.log('Premium UI passed: setup/anonymous/unpaid locked, signed paid access, explicit minimal request, four examples/six searches, detail/wishlist, revocation and clear, mobile layout. Test fixtures only; no live login or billing.');
    await context.close();
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
    globalThis.fetch = originalFetch;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
