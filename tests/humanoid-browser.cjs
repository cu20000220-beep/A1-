'use strict';
// Pixel evidence for the original SF surface on the preserved licensed body.
// Linux Chromium touch emulation is not native iPad Safari certification.
const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const origin = 'https://humanoid.a1fashion.pages.dev';
const out = process.env.A1_HUMANOID_OUT || path.join(root, 'docs/validation/humanoid');
fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.svg': 'image/svg+xml' };
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const snapshot = page => page.evaluate(() => window.A1GltfProof.snapshot());
const canvas = page => page.locator('#gltf-canvas');
const pixels = page => canvas(page).screenshot({ animations: 'disabled' });

function analyze(bytes) {
  const png = PNG.sync.read(bytes);
  let red = 0, teal = 0, gold = 0;
  for (let y = 0; y < png.height; y += 2) for (let x = 0; x < png.width; x += 2) {
    const i = (y * png.width + x) * 4, [r, g, b] = png.data.subarray(i, i + 3);
    if (r > 45 && r > g * 1.2 && r > b * 1.15) red++;
    if (g > 40 && b > 35 && g > r * 1.1 && b > r * 1.12) teal++;
    if (r > 70 && g > 55 && r > b * 1.3 && g > b * 1.18 && r >= g * 0.95) gold++;
  }
  return { width: png.width, height: png.height, red, teal, gold };
}

async function capture(page, name) {
  const bytes = await pixels(page);
  fs.writeFileSync(path.join(out, name + '.png'), bytes);
  return { name, sha256: sha(bytes), ...analyze(bytes) };
}

async function headCapture(page, name) {
  await canvas(page).scrollIntoViewIfNeeded();
  const box = await canvas(page).boundingBox();
  // A literal browser screenshot crop, without compositing or image generation.
  await page.screenshot({ path: path.join(out, name + '.png'), clip: {
    x: box.x + box.width * 0.35, y: box.y + box.height * 0.07,
    width: box.width * 0.3, height: box.height * 0.27
  } });
}

async function prepare(browser, profile) {
  const context = await browser.newContext({ viewport: { width: profile.width, height: profile.height },
    hasTouch: profile.touch, isMobile: profile.touch, deviceScaleFactor: 1, locale: profile.lang === 'ko' ? 'ko-KR' : 'en-US' });
  const requests = [], errors = [], consoleErrors = [], violations = [];
  const policy = fs.readFileSync(path.join(root, '_headers'), 'utf8')
    .match(/^\/gltf-proof\*\n\s+Content-Security-Policy:\s*([^\r\n]+)/m)?.[1];
  assert.ok(policy);
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    assert.equal(url.origin, origin, 'SF appearance must not contact any external service');
    assert.equal(req.method(), 'GET');
    assert.ok(!url.pathname.startsWith('/api/'), 'no backend, member or paid AI connections');
    for (const [key, value] of url.searchParams) { assert.equal(key, 'v'); assert.match(value, /^[a-z0-9-]+$/i); }
    const relative = url.pathname === '/gltf-proof' ? 'gltf-proof.html' : url.pathname.slice(1);
    assert.ok(relative === 'gltf-proof.html' || relative === 'favicon.ico' || relative.startsWith('assets/'));
    const full = path.resolve(root, relative);
    assert.ok(full.startsWith(root + path.sep));
    requests.push(url.pathname);
    if (relative === 'favicon.ico' && !fs.existsSync(full)) { await route.fulfill({ status: 204, body: '' }); return; }
    await route.fulfill({ body: fs.readFileSync(full), contentType: mime[path.extname(relative)] || 'application/octet-stream',
      headers: relative === 'gltf-proof.html' ? { 'Content-Security-Policy': policy } : {} });
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', entry => { if (entry.type() === 'error') consoleErrors.push(entry.text()); });
  await page.exposeFunction('captureHumanoidCsp', value => violations.push(value));
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', event => window.captureHumanoidCsp(event.effectiveDirective)));
  await page.goto(origin + '/gltf-proof', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.A1GltfProof?.snapshot().state === 'ready', null, { timeout: 25000 });
  await page.locator('[data-language-select]').selectOption(profile.lang);
  assert.equal(await page.locator('html').getAttribute('lang'), profile.lang);
  return { context, page, requests, errors, consoleErrors, violations };
}

async function dragAndPinch(page) {
  await canvas(page).scrollIntoViewIfNeeded();
  const box = await canvas(page).boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2;
  const session = await page.context().newCDPSession(page);
  const before = sha(await pixels(page));
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  for (let n = 1; n <= 6; n++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + n * 12, y, id: 1 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.notEqual(sha(await pixels(page)), before, 'touch drag rotates actual humanoid pixels');
  const rotated = sha(await pixels(page));
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x - 30, y, id: 1 }, { x: x + 30, y, id: 2 }] });
  for (let n = 1; n <= 5; n++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 30 - n * 10, y, id: 1 }, { x: x + 30 + n * 10, y, id: 2 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.notEqual(sha(await pixels(page)), rotated, 'pinch changes actual humanoid framing');
  await session.detach();
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const reports = [];
  try {
    for (const profile of [{ width: 1280, height: 900, touch: false, lang: 'ko' },
      { width: 820, height: 1180, touch: true, lang: 'ko' }, { width: 1180, height: 820, touch: true, lang: 'en' }]) {
      const trial = await prepare(browser, profile), { page, context } = trial;
      const prefix = profile.lang + '-' + profile.width;
      await page.locator('#gltf-look').selectOption('humanoid');
      await page.waitForFunction(() => A1GltfProof.snapshot().state === 'ready' && A1GltfProof.snapshot().look === 'humanoid');
      assert.equal((await snapshot(page)).look, 'humanoid', 'the preserved SF surface can be selected');
      assert.equal(await page.locator('#gltf-look').inputValue(), 'humanoid');
      await page.locator('#gltf-garment').selectOption('none');
      await page.locator('#gltf-front').click();
      const sf = await capture(page, prefix + '-humanoid-front');
      await headCapture(page, prefix + '-humanoid-head');
      await page.screenshot({ path: path.join(out, prefix + '-overview.png'), fullPage: true });
      await page.locator('#gltf-look').selectOption('reference');
      await page.waitForFunction(() => A1GltfProof.snapshot().state === 'ready' && A1GltfProof.snapshot().look === 'reference');
      const reference = await capture(page, prefix + '-reference-front');
      assert.notEqual(sf.sha256, reference.sha256, 'appearance control changes body pixels without a garment change');
      assert.ok(sf.red > reference.red * 1.4 + 25, 'burgundy synthetic face/body must actually render');
      assert.ok(sf.teal > reference.teal + 60, 'teal panel surface must actually render');
      await page.locator('#gltf-look').selectOption('humanoid');
      await page.waitForFunction(() => A1GltfProof.snapshot().state === 'ready' && A1GltfProof.snapshot().look === 'humanoid');
      const views = [];
      for (const view of ['side', 'back']) { await page.locator('#gltf-' + view).click(); views.push(await capture(page, prefix + '-humanoid-' + view)); }
      assert.equal(new Set([sf.sha256, ...views.map(v => v.sha256)]).size, 3);
      await page.locator('#gltf-front').click();
      const variants = [];
      for (const value of ['LAB-A', 'LAB-B', 'LAB-C']) {
        await page.locator('#gltf-garment').selectOption(value);
        variants.push({ garment: value, ...await capture(page, prefix + '-' + value) });
        assert.equal((await snapshot(page)).look, 'humanoid', 'garment changes retain the selected body surface');
      }
      assert.equal(new Set(variants.map(v => v.sha256)).size, 3, 'three real clothing meshes remain selectable');
      await page.locator('#gltf-garment').selectOption('none');
      const neutral = sha(await pixels(page));
      await page.locator('#gltf-skin-proof').check();
      const pose = await capture(page, prefix + '-humanoid-pose');
      assert.notEqual(pose.sha256, neutral, 'surface follows a genuinely skinned body deformation');
      assert.ok(pose.red > 25 && pose.teal > 60, 'SF body surface remains visible under skin deformation');
      await page.locator('#gltf-skin-proof').uncheck();
      if (!profile.touch) {
        let previous = (await snapshot(page)).viewYaw, total = 0;
        for (let n = 0; n < 36; n++) { await page.locator('#gltf-right').click(); const yaw = (await snapshot(page)).viewYaw; total += Math.abs(Math.atan2(Math.sin(yaw - previous), Math.cos(yaw - previous))); previous = yaw; }
        assert.ok(total >= Math.PI * 2 - 0.02, 'avatar can traverse the complete 360 degrees');
      } else if (profile.width === 820) await dragAndPinch(page);
      assert.equal(await canvas(page).evaluate(c => c.getContext('webgl2').getError()), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.deepEqual(await page.evaluate(() => Object.keys(sessionStorage)), []);
      assert.deepEqual(await page.evaluate(() => Object.keys(localStorage)), ['a1-fashion:language']);
      await page.locator('#gltf-delete').click();
      const disposed = await snapshot(page);
      assert.equal(disposed.disposed, true); assert.equal(disposed.memoryGeometries, 0); assert.equal(disposed.memoryTextures, 0);
      await page.locator('#gltf-retry').click();
      await page.waitForFunction(() => window.A1GltfProof.snapshot().state === 'ready');
      assert.equal((await snapshot(page)).look, 'humanoid');
      assert.deepEqual(trial.errors, []); assert.deepEqual(trial.consoleErrors, []); assert.deepEqual(trial.violations, []);
      reports.push({ profile, surface: sf, reference, views, variants, pose, requests: trial.requests,
        errors: trial.errors, consoleErrors: trial.consoleErrors, violations: trial.violations });
      console.log(`SF humanoid ${prefix}: body/head pixels, reference comparison, three garments, skin, rotation, cleanup and privacy passed.`);
      await context.close();
    }
    const sources = ['gltf-proof.html', 'assets/gltf-proof.js', 'assets/gltf-proof.css', 'assets/humanoid-surface.js', 'assets/gltf-proof/avatar.glb'];
    fs.writeFileSync(path.join(out, 'browser-result.json'), JSON.stringify({ sourceHashes: Object.fromEntries(sources.map(file => [file, sha(fs.readFileSync(path.join(root, file)))])), reports,
      environment: { browser: 'Linux Chromium with SwiftShader', nativeIpadSafari: false },
      scope: 'Original procedural SF material on the preserved CC0 mesh. No licensed movie character asset, personal photo, body reconstruction, paid API or exact product fit. Touch emulation is not native iPad testing.' }, null, 2) + '\n');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
