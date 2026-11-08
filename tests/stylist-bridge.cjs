'use strict';
// Actual browser postMessage handshake with local-only ratio fixtures. Real ML
// inference is exercised separately by ai-studio.cjs; no photo leaves a page.
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const { resolve, extname } = require('node:path');
const { chromium } = require('playwright');
const root = resolve(__dirname, '..');
const fixture = '<!doctype html><html><body><script>window.received=[];addEventListener("message",event=>received.push({origin:event.origin,data:event.data}));</script></body></html>';
const pause = page => page.evaluate(() => new Promise(resolve => setTimeout(resolve, 60)));
const send = (child, origin, nonce) => child.evaluate(({ origin, nonce }) => {
  window.opener.postMessage({ type: 'a1:request-analysis', nonce }, origin);
}, { origin, nonce });
async function ready(page, ratios = { shoulderHipRatio: 1.12, legTorsoRatio: 1.55 }) {
  await page.evaluate(metrics => {
    document.querySelector('#ai-result').hidden = false;
    document.dispatchEvent(new CustomEvent('a1:analysis-ready', { detail: {
      metrics, photo: 'data:image/jpeg;base64,PRIVATE-PHOTO', filename: 'PRIVATE-PHOTO.jpg', landmarks: [999]
    } }));
  }, ratios);
}

(async () => {
  const requests = [], errors = []; let actualStylist = false;
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg' };
  const server = createServer(async (incoming, outgoing) => {
    try {
      const url = new URL(incoming.url, `http://${incoming.headers.host}`);
      if (url.pathname === '/api/stylist') {
        outgoing.writeHead(200, { 'Content-Type': 'application/json' });
        outgoing.end(JSON.stringify({ mode: 'DEMO', liveEnabled: false, photoUploads: false, available: true,
          plans: { style: 'GENERAL', compare: 'PREMIUM', discount: 'PREMIUM' } })); return;
      }
      if (url.pathname === '/bridge-child.html' || url.pathname === '/stylist.html' && !actualStylist) {
        outgoing.writeHead(200, { 'Content-Type': 'text/html' }); outgoing.end(fixture); return;
      }
      const file = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
      const path = resolve(root, file);
      if (!path.startsWith(root + '/') || !/^(?:index\.html|stylist\.html|assets\/.+)$/.test(file)) { outgoing.writeHead(404); outgoing.end(); return; }
      if (file === 'stylist.html') outgoing.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'");
      outgoing.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' });
      outgoing.end(await readFile(path));
    } catch { outgoing.writeHead(404); outgoing.end(); }
  });
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port, origin = `http://127.0.0.1:${port}`;
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
    const context = await browser.newContext({ locale: 'ko-KR' });
    context.on('request', request => requests.push({ url: request.url(), method: request.method() }));
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      const open = window.open.bind(window); window.testBridgeChildren = [];
      window.open = (...args) => { const child = open(...args); window.testBridgeChildren.push(child); return child; };
    });
    await page.goto(origin);
    const before = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
    assert.equal(await page.locator('#stylist-analysis-open').isDisabled(), true);
    await ready(page, { shoulderHipRatio: NaN, legTorsoRatio: 1.2 });
    assert.equal(await page.locator('#stylist-analysis-open').isDisabled(), true);
    await ready(page);
    assert.equal(await page.locator('#stylist-analysis-open').isEnabled(), true);
    const [child] = await Promise.all([context.waitForEvent('page'), page.locator('#stylist-analysis-open').click()]);
    await child.waitForLoadState();
    const childUrl = new URL(child.url()), nonce = childUrl.hash.slice('#analysis='.length);
    assert.match(nonce, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    assert.equal(childUrl.search, ''); assert.doesNotMatch(child.url(), /1\.12|1\.55|photo|base64/i);
    await send(child, origin, 'wrong-nonce'); await pause(child);
    assert.deepEqual(await child.evaluate(() => received), []);

    // The same origin and nonce from a different WindowProxy cannot receive data.
    await page.evaluate(nonce => {
      const frame = document.createElement('iframe'); frame.src = '/bridge-child.html';
      frame.onload = () => frame.contentWindow.postMessage({ type: 'test-request', nonce }, location.origin);
      document.body.append(frame);
    }, nonce);
    await page.waitForFunction(() => document.querySelector('iframe')?.contentWindow?.location.pathname === '/bridge-child.html');
    const frameNow = page.frames().find(frame => frame.url().endsWith('/bridge-child.html'));
    await frameNow.evaluate(({ origin, nonce }) => parent.postMessage({ type: 'a1:request-analysis', nonce }, origin), { origin, nonce });
    await pause(child); assert.deepEqual(await child.evaluate(() => received), []);

    // Exercise the origin guard with the actual child WindowProxy. A genuine
    // cross-site navigation can additionally sever window.opener in Chromium.
    await page.evaluate(nonce => window.dispatchEvent(new MessageEvent('message', {
      origin: 'https://foreign.example.test', source: window.testBridgeChildren[0],
      data: { type: 'a1:request-analysis', nonce }
    })), nonce);
    await pause(child);
    assert.deepEqual(await child.evaluate(() => received), []);
    await send(child, origin, nonce);
    await child.waitForFunction(() => received.length === 1);
    const delivered = await child.evaluate(() => received[0]);
    assert.equal(delivered.origin, origin);
    assert.deepEqual(delivered.data, { type: 'a1:analysis-transfer', nonce,
      metrics: { shoulderHipRatio: 1.12, legTorsoRatio: 1.55 } });
    assert.doesNotMatch(JSON.stringify(delivered), /PRIVATE|base64|filename|landmarks|consent/);
    await send(child, origin, nonce); await pause(child);
    assert.equal(await child.evaluate(() => received.length), 1, 'Only one transfer per nonce');
    await page.evaluate(() => document.dispatchEvent(new Event('a1:analysis-cleared')));
    await child.waitForFunction(() => received.some(item => item.data.type === 'a1:analysis-cleared'));
    assert.equal(await page.locator('#stylist-analysis-open').isDisabled(), true);
    await send(child, origin, nonce); await pause(child);
    assert.equal(await child.evaluate(() => received.filter(item => item.data.type === 'a1:analysis-transfer').length), 1);

    for (const event of ['auth-change', 'storage', 'pagehide']) {
      await ready(page, { shoulderHipRatio: 0.45, legTorsoRatio: 3.5 });
      const [next] = await Promise.all([context.waitForEvent('page'), page.locator('#stylist-analysis-open').click()]);
      await next.waitForLoadState();
      const nextNonce = new URL(next.url()).hash.slice('#analysis='.length);
      await send(next, origin, nextNonce); await next.waitForFunction(() => received.length === 1);
      await page.evaluate(event => {
        if (event === 'auth-change') document.dispatchEvent(new Event('a1:auth-changed'));
        else if (event === 'storage') window.dispatchEvent(new StorageEvent('storage', { key: 'a1-fashion:auth-event', newValue: 'changed' }));
        else window.dispatchEvent(new PageTransitionEvent('pagehide'));
      }, event);
      await next.waitForFunction(() => received.some(item => item.data.type === 'a1:analysis-cleared'));
      assert.equal(await page.locator('#stylist-analysis-open').isDisabled(), true);
      await next.close();
    }
    assert.equal(requests.filter(request => (request.url.includes('/api/') && !request.url.endsWith('/api/policy'))).length, 0);
    // Confirm that the production child UI consumes the same broker contract
    // while leaving both independent sharing choices unchecked.
    actualStylist = true;
    await ready(page);
    const [consultation] = await Promise.all([context.waitForEvent('page'), page.locator('#stylist-analysis-open').click()]);
    consultation.on('pageerror', error => errors.push(error.message));
    await consultation.waitForLoadState();
    await consultation.waitForFunction(() => document.querySelector('[name=shoulderHipRatio]').value === '1.12');
    assert.equal(await consultation.locator('[name=legTorsoRatio]').inputValue(), '1.55');
    assert.equal(await consultation.locator('#stylist-analysis-consent').isChecked(), false);
    assert.equal(await consultation.locator('#stylist-external-consent').isChecked(), false);
    assert.equal(await consultation.locator('[name=shoulderHipRatio]').isDisabled(), true);
    assert.equal(new URL(consultation.url()).hash, '', 'The one-use nonce is removed after capture');
    await page.evaluate(() => document.dispatchEvent(new Event('a1:analysis-cleared')));
    await consultation.waitForFunction(() => document.querySelector('[name=shoulderHipRatio]').value === '');
    assert.equal(await consultation.locator('[name=legTorsoRatio]').inputValue(), '');
    assert.equal(await consultation.locator('#stylist-analysis-consent').isChecked(), false);
    assert.deepEqual(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } })), before);
    assert.deepEqual(errors, []);
    assert.ok(requests.filter(request => (request.url.includes('/api/') && !request.url.endsWith('/api/policy'))).every(request => new URL(request.url).pathname === '/api/stylist' && request.method === 'GET'), 'Only a local readiness request occurs; no consultation/provider request');
    assert.ok(requests.every(request => request.method === 'GET' && ['127.0.0.1', 'localhost'].includes(new URL(request.url).hostname)));
    console.log('Stylist analysis bridge passed: actual same-origin child handshake and production child UI/CSP, wrong nonce/source/origin denied, two numbers only, one transfer, independent consent unchecked, clear/auth/pagehide invalidation, no photos/URL ratios/storage or consultation/provider calls.');
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
