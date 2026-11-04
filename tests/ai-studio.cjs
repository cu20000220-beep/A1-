/* Real, local MediaPipe inference; no model or landmarks are mocked. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    headless: true,
    // Software WebGL lets the real model run in a headless Linux test machine.
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  });
  try {
    const page = await browser.newPage({ viewport: { width: 820, height: 1180 } });
    const base = process.env.A1_TEST_URL || 'http://127.0.0.1:8001/A1-/';
    const origin = new URL(base).origin;
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => requests.push({ url: request.url(), method: request.method() }));
    const photo = file => path.join(__dirname, '../assets/photos/', file);
    const idle = () => page.waitForFunction(() => document.querySelector('#ai-output').getAttribute('aria-busy') === 'false', {}, { timeout: 150000 });
    await page.goto(base);
    assert.ok(await page.locator('#ai-analyze').isDisabled());
    assert.equal(requests.filter(r => r.url.includes('/vendor/')).length, 0, 'model must load only on request');

    // Broken images fail before downloading the model.
    await page.locator('#ai-photo').setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('invalid image') });
    await page.waitForFunction(() => document.querySelector('#ai-status').classList.contains('is-error'));
    assert.ok(await page.locator('#ai-analyze').isDisabled());
    assert.equal(requests.filter(r => r.url.includes('/vendor/')).length, 0);

    // Test a real download failure, then retry the same photo successfully.
    await page.route('**/vendor/mediapipe/pose.js', route => route.abort());
    await page.locator('#ai-photo').setInputFiles(photo('man.jpg'));
    await page.locator('#ai-analyze').click();
    await idle();
    assert.match(await page.locator('#ai-status').innerText(), /불러오지 못했습니다/);
    assert.ok(await page.locator('#ai-result').isHidden());
    await page.unroute('**/vendor/mediapipe/pose.js');
    await page.locator('#ai-analyze').click();
    await idle();
    assert.match(await page.locator('#ai-status').innerText(), /완료했습니다/);
    assert.ok(await page.locator('#ai-result').isVisible());
    assert.equal(await page.locator('#ai-cards .card').count(), 4);
    assert.ok(await page.locator('#ai-shopping').isVisible());
    assert.equal(await page.locator('#ai-shopping a').count(), 6);
    const storeLinks = await page.locator('#ai-shopping a').evaluateAll(links => links.map(a => ({href:a.href,target:a.target,rel:a.rel})));
    assert.deepEqual([...new Set(storeLinks.map(a => new URL(a.href).hostname))].sort(), ['search.shopping.naver.com','www.coupang.com','www.temu.com']);
    assert.ok(storeLinks.every(a => a.target === '_blank' && a.rel.includes('noopener') && a.rel.includes('noreferrer')));
    assert.ok(storeLinks.every(a => !decodeURIComponent(a.href).includes('man.jpg')));
    assert.ok(requests.some(r => r.url.endsWith('/pose_landmark_lite.tflite')));
    assert.ok(requests.some(r => r.url.endsWith('.wasm')));
    const resultSize = await page.locator('#ai-canvas').evaluate(c => ({ width: c.width, height: c.height }));
    assert.ok(resultSize.width > 100 && resultSize.height > 100 && resultSize.height < 1275, 'result must be a cropped photo');

    // Recommendation changes reuse the analysis and respect the exact constraints.
    const before = requests.filter(r => r.url.includes('/vendor/')).length;
    await page.locator('#ai-gender').selectOption('여성');
    await page.locator('#ai-style').selectOption('클래식');
    await page.locator('#ai-budget').selectOption('50000');
    await page.locator('#ai-analyze').click();
    assert.equal(await page.locator('#ai-cards .card').count(), 0);
    assert.ok(await page.locator('#ai-no-matches').isVisible());
    assert.ok(await page.locator('#ai-shopping').isVisible(), 'shop search remains available when sample catalog has no matches');
    assert.match(await page.locator('#ai-shopping-budget').innerText(), /50,000원/);
    assert.match(await page.locator('#ai-shopping-budget').innerText(), /자동 적용되지/);
    await page.locator('#ai-style').selectOption('캐주얼');
    await page.locator('#ai-analyze').click();
    assert.equal(await page.locator('#ai-cards .card').count(), 1);
    assert.match(await page.locator('#ai-cards').innerText(), /에센셜 데님 팬츠/);
    assert.equal(requests.filter(r => r.url.includes('/vendor/')).length, before);
    const wish = page.locator('#ai-cards [data-wish]').first();
    await wish.click();
    assert.equal(await wish.getAttribute('aria-pressed'), 'true');
    await page.locator('#ai-cards [data-detail]').first().click();
    assert.equal(await page.locator('#detail-title').innerText(), '에센셜 데님 팬츠');
    await page.locator('#close-detail').click();

    for (const [width, height] of [[820, 1180], [390, 844], [320, 740]]) {
      await page.setViewportSize({ width, height });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: `/tmp/a1-ai-${width}.png`, fullPage: true });
    }
    // Clearing removes pixels, measurements and rendered recommendations.
    await page.locator('#ai-clear').click();
    assert.ok(await page.locator('#ai-result').isHidden());
    assert.equal(await page.locator('#ai-cards .card').count(), 0);
    assert.equal(await page.locator('#ai-canvas').evaluate(c => c.width * c.height), 1);
    assert.equal(await page.locator('#ai-metrics').innerText(), '');
    assert.ok(await page.locator('#ai-shopping').isHidden());
    assert.equal(await page.locator('#ai-shopping a').count(), 0);

    // A bag is not a person: do not manufacture body analysis or recommendations.
    await page.locator('#ai-photo').setInputFiles(photo('bag.jpg'));
    await page.locator('#ai-analyze').click();
    await idle();
    assert.ok(await page.locator('#ai-status').evaluate(el => el.classList.contains('is-error')));
    assert.ok(await page.locator('#ai-result').isHidden());
    assert.equal(await page.locator('#ai-cards .card').count(), 0);
    assert.ok(await page.locator('#ai-shopping').isHidden());

    // File names stay text, not HTML; private data never goes to localStorage.
    await page.locator('#ai-photo').setInputFiles({ name: '<b>private</b>.jpg', mimeType: 'image/jpeg', buffer: fs.readFileSync(photo('man.jpg')) });
    await page.waitForFunction(() => document.querySelector('#ai-file-info').textContent.includes('준비 완료'));
    assert.equal(await page.locator('#ai-file-info b').count(), 0);
    const storage = await page.evaluate(() => Object.entries(localStorage));
    assert.ok(storage.every(([key,value]) => key === 'a1-fashion:wishlist:v1' && value.length < 200));
    assert.ok(requests.every(r => new URL(r.url).origin === origin && r.method === 'GET'), 'no photo upload or external API/CDN requests');
    assert.deepEqual(errors, []);

    // The unsupported-browser path is honest and does not start a model download.
    const unsupported = await browser.newPage();
    await unsupported.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        return type.startsWith('webgl') ? null : original.call(this, type, ...args);
      };
    });
    await unsupported.goto(base);
    await unsupported.locator('#ai-photo').setInputFiles(photo('man.jpg'));
    await unsupported.locator('#ai-analyze').click();
    await unsupported.waitForFunction(() => document.querySelector('#ai-output').getAttribute('aria-busy') === 'false');
    assert.match(await unsupported.locator('#ai-status').innerText(), /WebGL/);
    assert.ok(await unsupported.locator('#ai-result').isHidden());
    // A delayed download must not lock the UI after clear, or resurrect results.
    const cancelled = await browser.newPage();
    let releaseDownload;
    const heldDownload = new Promise(resolve => { releaseDownload = resolve; });
    await cancelled.route('**/vendor/mediapipe/pose.js', async route => { await heldDownload; await route.continue(); });
    await cancelled.goto(base);
    await cancelled.locator('#ai-photo').setInputFiles(photo('man.jpg'));
    await cancelled.locator('#ai-analyze').click();
    await cancelled.locator('#ai-clear').click();
    assert.ok(await cancelled.locator('#ai-photo').isEnabled());
    assert.ok(await cancelled.locator('#ai-gender').isEnabled());
    assert.equal(await cancelled.locator('#ai-output').getAttribute('aria-busy'), 'false');
    releaseDownload();
    await cancelled.waitForFunction(() => !!window.Pose);
    assert.ok(await cancelled.locator('#ai-result').isHidden());
    assert.match(await cancelled.locator('#ai-status').innerText(), /지웠습니다/);
    await cancelled.close();
    console.log('PASS: real ML inference, lazy local model loading, download retry, non-person rejection, style/budget/gender matching, wishlist/details, privacy/deletion, mobile/tablet layouts, WebGL failure.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
