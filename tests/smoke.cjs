/* Public free-analysis entry point; premium workflow has separate server-backed tests. */
'use strict';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ locale: 'ko-KR' }), errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => requests.push(request));
    const base = process.env.A1_TEST_URL || 'http://127.0.0.1:8000/';
    await page.goto(base);
    assert.equal(await page.title(), 'A1 FASHION — Everyday, elevated.');
    assert.ok(await page.locator('#ai-analyze').isDisabled());
    assert.ok(await page.locator('#ai-photo').isEnabled());
    assert.ok(await page.locator('#premium-lock').isVisible());
    assert.ok(await page.locator('#premium-controls').isHidden());
    assert.ok(await page.locator('#premium-results').isHidden());
    assert.equal(await page.locator('.card, #ai-shopping a').count(), 0);
    assert.ok(await page.evaluate(() => typeof window.A1BodyAnalysis.analyzePose === 'function'));
    assert.ok(await page.evaluate(() => !window.A1Catalog && !window.A1StyleAdvisor && !window.A1ShopSearch));
    await page.locator('.hero-copy .dark-link').click();
    await page.waitForFunction(() => location.hash === '#ai-studio');
    for (const [width, height] of [[1440,1000], [820,1180], [390,844], [320,740]]) {
      await page.setViewportSize({ width, height });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `horizontal overflow ${width}`);
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: `/tmp/a1-free-${width}.png`, fullPage: true });
    }
    assert.equal(requests.filter(r => r.url().includes('/vendor/') || (r.url().includes('/api/') && !r.url().endsWith('/api/policy'))).length, 0, 'no model or protected API requests before user action');
    await page.route('**/assets/photos/hero.jpg', route => route.abort());
    await page.reload();
    await page.waitForFunction(() => { const image = document.querySelector('#hero-image'); return image?.classList.contains('image-fallback') && image.complete && image.naturalWidth > 0; });
    assert.deepEqual(errors, []);
    assert.ok(requests.every(r => r.method() === 'GET' && new URL(r.url()).origin === new URL(base).origin));
    console.log('PASS: free entry, default premium lock, no public catalog/store links, lazy model/API, desktop/tablet/mobile layouts, local image fallback, no JS errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
