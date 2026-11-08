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
    const page = await browser.newPage({ locale: 'ko-KR', viewport: { width: 820, height: 1180 } });
    const base = process.env.A1_TEST_URL || 'http://127.0.0.1:8000/';
    const origin = new URL(base).origin;
    // Public /api/policy is metadata only; photos/ratios still never leave free analysis.
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
    assert.equal(await page.locator('#ai-cards .card').count(), 0);
    assert.ok(await page.locator('#ai-shopping').isHidden());
    assert.equal(await page.locator('#ai-shopping a').count(), 0);
    assert.ok(await page.locator('#premium-lock').isVisible());
    assert.ok(await page.locator('#premium-controls').isHidden());
    assert.ok(await page.locator('#premium-results').isHidden());
    assert.match(await page.locator('#ai-metrics').innerText(), /어깨/);
    assert.match(await page.locator('#ai-summary').innerText(), /사진 속/);
    assert.equal(requests.filter(r => (r.url.includes('/api/') && !r.url.endsWith('/api/policy'))).length, 0, 'free analysis must not send ratios or photos to a protected API');
    assert.ok(requests.some(r => r.url.endsWith('/pose_landmark_lite.tflite')));
    assert.ok(requests.some(r => r.url.endsWith('.wasm')));
    const resultSize = await page.locator('#ai-canvas').evaluate(c => ({ width: c.width, height: c.height }));
    assert.ok(resultSize.width > 100 && resultSize.height > 100 && resultSize.height < 1275, 'result must be a cropped photo');

    assert.ok(await page.locator('#ai-analyze').isDisabled(), 'completed free analysis cannot silently request paid recommendations');
    const pixelsBeforeLanguageSwitch = await page.locator('#ai-canvas').evaluate(canvas => canvas.toDataURL());
    const modelRequestsBeforeLanguageSwitch = requests.filter(request => request.url.includes('/vendor/')).length;
    await page.evaluate(() => window.A1I18n.setLanguage('en'));
    await page.waitForFunction(() => document.documentElement.lang === 'en');
    assert.match(await page.locator('#ai-metrics').innerText(), /shoulder/i);
    assert.doesNotMatch(await page.locator('#ai-summary').innerText(), /[\uac00-\ud7af]/u);
    assert.doesNotMatch(await page.locator('#ai-notes').innerText(), /[\uac00-\ud7af]/u);
    assert.equal(await page.locator('#ai-canvas').evaluate(canvas => canvas.toDataURL()), pixelsBeforeLanguageSwitch);
    assert.equal(requests.filter(request => request.url.includes('/vendor/')).length, modelRequestsBeforeLanguageSwitch);
    assert.equal(requests.filter(request => (request.url.includes('/api/') && !request.url.endsWith('/api/policy'))).length, 0);
    await page.evaluate(() => window.A1I18n.setLanguage('ko'));
    await page.waitForFunction(() => document.documentElement.lang === 'ko');
    const notes = await page.locator('#ai-notes').innerText();
    assert.match(notes, /정확한 신체 치수/);
    assert.doesNotMatch(notes, /팬츠|재킷|셔츠|데님|슬랙스/);

    for (const [width, height] of [[820, 1180], [390, 844], [320, 740]]) {
      await page.setViewportSize({ width, height });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: `/tmp/a1-ai-${width}.png`, fullPage: true });
      if (width === 390) {
        await page.locator('#ai-result').screenshot({ path: '/tmp/a1-free-analysis-real-390.png', style: 'header { visibility: hidden !important; }' });
        await page.locator('#premium').screenshot({ path: '/tmp/a1-premium-locked-real-390.png', style: 'header { visibility: hidden !important; }' });
      }
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
    assert.ok(storage.every(([key,value]) => (key === 'a1-fashion:wishlist:v1' && value.length < 200) || (key === 'a1-fashion:language' && ['ko','en'].includes(value))));
    assert.ok(requests.every(r => new URL(r.url).origin === origin && r.method === 'GET'), 'no photo upload or external API/CDN requests');
    assert.deepEqual(errors, []);

    // The unsupported-browser path is honest and does not start a model download.
    const unsupported = await browser.newPage({ locale: 'ko-KR' });
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
    const cancelled = await browser.newPage({ locale: 'ko-KR' });
    let releaseDownload;
    const heldDownload = new Promise(resolve => { releaseDownload = resolve; });
    await cancelled.route('**/vendor/mediapipe/pose.js', async route => { await heldDownload; await route.continue(); });
    await cancelled.goto(base);
    await cancelled.locator('#ai-photo').setInputFiles(photo('man.jpg'));
    await cancelled.locator('#ai-analyze').click();
    await cancelled.locator('#ai-clear').click();
    assert.ok(await cancelled.locator('#ai-photo').isEnabled());
    assert.ok(await cancelled.locator('#premium-controls').isHidden());
    assert.equal(await cancelled.locator('#ai-output').getAttribute('aria-busy'), 'false');
    releaseDownload();
    await cancelled.waitForFunction(() => !!window.Pose);
    assert.ok(await cancelled.locator('#ai-result').isHidden());
    assert.match(await cancelled.locator('#ai-status').innerText(), /지웠습니다/);
    await cancelled.evaluate(() => window.A1I18n.setLanguage('en'));
    await cancelled.evaluate(() => window.A1I18n.setLanguage('ko'));
    assert.equal(await cancelled.locator('#ai-summary').innerText(), '');
    assert.ok(await cancelled.locator('#ai-result').isHidden(), 'Language switches cannot resurrect cleared private analysis');
    await cancelled.close();
    console.log('PASS: real ML inference, lazy local model loading, download retry, non-person rejection, free results with no protected recommendation or store links, privacy/deletion, mobile/tablet layouts, WebGL failure.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
