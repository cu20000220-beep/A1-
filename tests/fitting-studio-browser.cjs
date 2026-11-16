'use strict';
// Real image interactions plus the existing 3D viewer embedded in the studio.
// This does not establish personalized fit, retail stock or native Safari quality.
const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const origin = 'https://fitting-studio.a1fashion.pages.dev';
const out = process.env.A1_STUDIO_EVIDENCE_DIR || path.join(root, 'docs/validation/fitting-studio');
fs.mkdirSync(out, { recursive: true });
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary' };
const model = page => page.locator('#studio-model');
const state = page => page.evaluate(() => window.A1FittingStudio.snapshot());
const pixelBytes = page => model(page).screenshot({ animations: 'disabled' });
function imageDetails(bytes) {
  const image = PNG.sync.read(bytes), colors = new Set();
  let chromatic = 0;
  for (let y = 0; y < image.height; y += 3) for (let x = 0; x < image.width; x += 3) {
    const i = (y * image.width + x) * 4;
    const rgb = [...image.data.subarray(i, i + 3)];
    colors.add(rgb.join(','));
    if (Math.max(...rgb) - Math.min(...rgb) > 20) chromatic++;
  }
  return { width: image.width, height: image.height, colors: colors.size, chromatic };
}
async function capture(page, name, save = true) {
  const bytes = await pixelBytes(page);
  if (save) fs.writeFileSync(path.join(out, name + '.png'), bytes);
  return { name, sha256: sha(bytes), ...imageDetails(bytes) };
}
async function ready(page) {
  await page.waitForFunction(() => window.A1FittingStudio?.snapshot().state === 'ready', null, { timeout: 25000 });
}
async function visibleResult(page) {
  // Check the actual user's viewport before locator.screenshot() could hide a
  // missing result-reveal behavior by scrolling the image for the test itself.
  await page.waitForFunction(() => {
    const box = document.querySelector('#studio-model')?.getBoundingClientRect();
    if (!box) return false;
    const visibleHeight = Math.max(0, Math.min(box.bottom, innerHeight) - Math.max(box.top, 0));
    return visibleHeight >= Math.min(box.height * 0.45, innerHeight * 0.5);
  }, null, { timeout: 3500 }).catch(async error => {
    console.error('Result viewport', await model(page).evaluate(el => ({
      rect: { top: el.getBoundingClientRect().top, bottom: el.getBoundingClientRect().bottom, height: el.getBoundingClientRect().height },
      scrollY, innerHeight, visualHeight: visualViewport?.height, state: A1FittingStudio.snapshot()
    })));
    await page.screenshot({ path: path.join(out, 'result-reveal-failure.png') });
    throw error;
  });
}
function deployedPolicy() {
  const text = fs.readFileSync(path.join(root, '_headers'), 'utf8');
  const matched = text.match(/^\/fitting-studio\*\n\s+Content-Security-Policy:\s*([^\r\n]+)/m);
  assert.ok(matched, 'the new public page must have its own deployed CSP');
  return matched[1];
}
async function prepare(browser, profile, { blocked = false } = {}) {
  let blockSheet = blocked;
  const context = await browser.newContext({ viewport: { width: profile.width, height: profile.height },
    hasTouch: profile.touch, isMobile: profile.touch, deviceScaleFactor: 1,
    locale: profile.lang === 'ko' ? 'ko-KR' : 'en-US' });
  const requests = [], errors = [], consoleErrors = [], violations = [];
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    assert.equal(url.origin, origin, 'studio assets and interactions must never contact another origin');
    assert.equal(request.method(), 'GET', 'no photos, messages or body values can be uploaded');
    assert.ok(!url.pathname.startsWith('/api/'), 'Preview API isolation remains intact');
    if (url.protocol === 'blob:') { await route.continue(); return; }
    for (const [key, value] of url.searchParams) { assert.equal(key, 'v'); assert.match(value, /^[a-z0-9-]+$/i); }
    if (url.pathname === '/fitting-studio.html') { await route.fulfill({ status: 308, headers: { Location: '/fitting-studio' }, body: '' }); return; }
    const relative = url.pathname === '/fitting-studio' ? 'fitting-studio.html' : url.pathname.slice(1);
    assert.ok(relative === 'fitting-studio.html' || relative === 'favicon.ico' || relative.startsWith('assets/'));
    const full = path.resolve(root, relative); assert.ok(full.startsWith(root + path.sep));
    requests.push(url.pathname);
    if (relative === 'favicon.ico' && !fs.existsSync(full)) { await route.fulfill({ status: 204, body: '' }); return; }
    if (blockSheet && relative === 'assets/studio/male-sheet.png') { await route.abort('failed'); return; }
    assert.ok(fs.existsSync(full), 'requested public asset exists: ' + relative);
    await route.fulfill({ body: fs.readFileSync(full), contentType: mime[path.extname(relative)] || 'application/octet-stream',
      headers: relative === 'fitting-studio.html' ? { 'Content-Security-Policy': deployedPolicy() } : {} });
  });
  await context.addInitScript(() => {
    // Synthetic unrelated state catches accidental analysis/account reads or
    // destructive blanket cleanup. It is never actual member or body data.
    sessionStorage.setItem('a1:test-private-state', 'SYNTHETIC-PRIVATE-NOT-FOR-STUDIO');
    const get = Storage.prototype.getItem;
    window.__studioStorageReads = [];
    Storage.prototype.getItem = function (key) { window.__studioStorageReads.push(String(key)); return get.call(this, key); };
    window.__studioPrivateState = () => get.call(sessionStorage, 'a1:test-private-state');
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', entry => { if (entry.type() === 'error') consoleErrors.push(entry.text()); });
  await page.exposeFunction('recordStudioCsp', value => violations.push(value));
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', event => window.recordStudioCsp(event.effectiveDirective)));
  await page.goto(origin + '/fitting-studio', { waitUntil: 'networkidle' });
  if (!blocked) {
    await ready(page);
    await page.locator('[data-language-select]').selectOption(profile.lang);
    assert.equal(await page.locator('html').getAttribute('lang'), profile.lang);
  }
  return { context, page, requests, errors, consoleErrors, violations, unblockSheet() { blockSheet = false; } };
}
async function truthAndLinks(page, lang) {
  const text = await page.locator('#studio-root').innerText();
  assert.match(text, /2D|2차원|two-dimensional/i, 'the studio identifies static 2D imagery');
  assert.equal(await page.locator('#studio-mode-note').isVisible(), true);
  assert.match(await page.locator('#studio-mode-note').innerText(), /2D|2차원|two-dimensional/i);
  assert.match(text, lang === 'ko' ? /예시|미리보기|실제 판매/ : /example|preview|retail/i);
  assert.equal((await state(page)).imageMode, '2d-static');
  assert.equal((await state(page)).actual3D, false);
  assert.equal(await page.locator('input[type=file]').count(), 0, 'existing photo tools remain separate; no new personal upload path');
  assert.equal(await page.locator('canvas').count(), 0, 'image views are not disguised as a rendered 3D model');
  const links = await page.locator('a[href]').evaluateAll(nodes => nodes.map(node => ({ href: node.getAttribute('href'), text: node.textContent.trim() })));
  for (const required of ['gltf-proof.html', 'product-lab.html', 'stylist.html', 'index.html#ai-studio']) {
    assert.ok(links.some(link => link.href === required), 'existing functional route remains reachable: ' + required);
  }
  const real3d = links.find(link => link.href === 'gltf-proof.html');
  assert.match(real3d.text, /3D/i, 'the separate actual 3D renderer is named explicitly');
  assert.ok(!links.some(link => /^(?:javascript|data):/i.test(link.href)));
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const reports = [];
  try {
    const profiles = [{ width: 1440, height: 1000, touch: false, lang: 'ko' },
      { width: 820, height: 1180, touch: true, lang: 'ko' },
      { width: 1180, height: 820, touch: true, lang: 'en' },
      { width: 390, height: 844, touch: true, lang: 'ko' },
      { width: 390, height: 844, touch: true, lang: 'en' }];
    for (const profile of profiles) {
      const trial = await prepare(browser, profile), { context, page } = trial;
      const prefix = profile.lang + '-' + profile.width, avatars = [];
      await truthAndLinks(page, profile.lang);
      const box = await model(page).boundingBox();
      assert.ok(box.width >= 200 && box.height >= 300, 'the photographic model is large enough to inspect on a phone/tablet');
      for (const avatar of ['male', 'female']) {
        await page.locator('#studio-avatar [data-avatar-choice=' + avatar + ']').click(); await ready(page);
        await visibleResult(page);
        await page.locator('#studio-base').click(); await ready(page);
        await visibleResult(page);
        assert.equal((await state(page)).avatar, avatar);
        const directions = [];
        for (const [cell, direction] of ['front', 'quarter', 'side', 'back'].entries()) {
          await page.locator('#studio-directions [data-direction=' + direction + ']').click(); await ready(page);
          await visibleResult(page);
          const snapshot = await state(page);
          assert.equal(snapshot.direction, direction); assert.equal(snapshot.cell, cell); assert.equal(snapshot.style, null);
          const shot = await capture(page, prefix + '-' + avatar + '-' + direction, profile.width === 1440 || (profile.width === 820 && direction === 'front'));
          assert.ok(shot.colors > 150 && shot.chromatic > 150, 'decoded human/clothing image contains real varied image pixels');
          directions.push(shot);
        }
        assert.equal(new Set(directions.map(value => value.sha256)).size, 4, 'four views must change the actual model image, not only a heading');
        const styles = [];
        for (let style = 0; style < 5; style++) {
          await page.locator('#studio-style-grid [data-style="' + style + '"]').click(); await ready(page);
          await visibleResult(page);
          const snapshot = await state(page);
          assert.equal(snapshot.style, style); assert.equal(snapshot.cell, 4 + style);
          assert.ok(await page.locator('#studio-directions [data-direction]').evaluateAll(buttons => buttons.every(button => button.disabled)),
            'front-only style imagery must not imply unprovided 3D/direction data');
          styles.push(await capture(page, prefix + '-' + avatar + '-style-' + style, profile.width === 1440));
        }
        assert.equal(new Set(styles.map(value => value.sha256)).size, 5, 'each style renders a distinct actual clothing image');
        await page.locator('#studio-base').click(); await ready(page);
        assert.ok(await page.locator('#studio-directions [data-direction]').evaluateAll(buttons => buttons.every(button => !button.disabled)));
        avatars.push({ avatar, directions, styles });
      }
      assert.notEqual(avatars[0].directions[0].sha256, avatars[1].directions[0].sha256, 'male/female picks use genuinely different imagery');
      await page.locator('#studio-reset').click(); await ready(page);
      await visibleResult(page);
      assert.equal((await state(page)).avatar, 'male'); assert.equal((await state(page)).style, null);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'mobile UI does not overflow horizontally');
      assert.equal(await page.evaluate(() => window.__studioPrivateState()), 'SYNTHETIC-PRIVATE-NOT-FOR-STUDIO');
      assert.ok((await page.evaluate(() => window.__studioStorageReads)).every(key => key === 'a1-fashion:language'), 'studio never reads body/account storage');
      assert.deepEqual(await page.evaluate(() => Object.keys(sessionStorage)), ['a1:test-private-state']);
      assert.deepEqual(await page.evaluate(() => Object.keys(localStorage)), ['a1-fashion:language']);
      await page.screenshot({ path: path.join(out, prefix + '-overview.png'), fullPage: true });
      assert.deepEqual(trial.errors, []); assert.deepEqual(trial.consoleErrors, []); assert.deepEqual(trial.violations, []);
      reports.push({ profile, avatars, requests: trial.requests, errors: trial.errors, consoleErrors: trial.consoleErrors, violations: trial.violations });
      console.log(`Style studio ${prefix}: actual photographic image cells, two avatars, four directions, five styles, 2D truth labels, links and privacy passed.`);
      await context.close();
    }
    const three = await prepare(browser, { width: 820, height: 1180, touch: true, lang: 'ko' });
    await three.page.locator('[data-studio-mode="three"]').click();
    await three.page.waitForFunction(() => window.A1GltfProof?.snapshot().state === 'ready', null, { timeout: 30000 });
    const actual = await three.page.evaluate(() => A1GltfProof.snapshot());
    assert.equal(actual.bones, 73); assert.ok(actual.memoryTextures > 10); assert.ok(actual.triangles > 40000);
    assert.equal(await three.page.locator('#studio-root').isVisible(), false);
    assert.equal(await three.page.locator('#gltf-garment').isDisabled(), true, 'stock outfit is not presented as product fitting');
    const viewFrames = [];
    for (const view of ['front', 'side', 'back']) {
      await three.page.locator('#gltf-' + view).click();
      const bytes = await three.page.locator('#gltf-canvas').screenshot();
      assert.ok(imageDetails(bytes).colors > 150, 'real textured 3D geometry must render');
      fs.writeFileSync(path.join(out, 'ko-820-3d-' + view + '.png'), bytes);
      viewFrames.push(sha(bytes));
    }
    assert.equal(new Set(viewFrames).size, 3);
    await three.page.locator('[data-studio-mode="images"]').click();
    await three.page.waitForFunction(() => A1GltfProof.snapshot().disposed === true);
    const stopped = await three.page.evaluate(() => A1GltfProof.snapshot());
    assert.equal(stopped.memoryGeometries, 0); assert.equal(stopped.memoryTextures, 0);
    assert.equal(await three.page.locator('#studio-root').isVisible(), true);
    await three.page.locator('[data-studio-mode="three"]').click();
    await three.page.waitForFunction(() => A1GltfProof.snapshot().state === 'ready', null, { timeout: 30000 });
    assert.equal(await three.page.evaluate(() => A1FittingStudio3D.snapshot().actual3D), true);
    assert.deepEqual(three.errors, []); assert.deepEqual(three.consoleErrors, []); assert.deepEqual(three.violations, []);
    reports.push({ actualInline3D: true, bones: actual.bones, triangles: actual.triangles, viewFrames, cleanup: stopped, requests: three.requests });
    await three.context.close();
    for (const recoveryAction of ['retry', 'reset']) {
    const failure = await prepare(browser, { width: 820, height: 1180, touch: true, lang: 'ko' }, { blocked: true });
    await failure.page.waitForFunction(() => document.querySelector('#studio-root')?.dataset.state === 'error', null, { timeout: 15000 });
    assert.ok((await failure.page.locator('#studio-status').innerText()).trim().length > 8);
    assert.ok(await failure.page.locator('#studio-retry').isVisible());
    assert.ok(await failure.page.locator('#studio-retry').isEnabled());
    const failedReads = () => failure.requests.filter(file => file === '/assets/studio/male-sheet.png').length;
    // CSS background decoding and the explicit Image preloader may each issue
    // one failed request when the browser cannot coalesce them. Neither path
    // may keep retrying without a user action.
    const settledFailures = failedReads();
    assert.ok(settledFailures >= 1 && settledFailures <= 2, 'only the background and preloader can attempt the failed sheet');
    await failure.page.waitForTimeout(250);
    assert.equal(failedReads(), settledFailures, 'failed image loads do not loop automatically');
    assert.deepEqual(failure.errors, []); assert.deepEqual(failure.violations, []);
    const failureStatus = await failure.page.locator('#studio-status').innerText();
    failure.unblockSheet(); await failure.page.locator('#studio-' + recoveryAction).click(); await ready(failure.page);
    await visibleResult(failure.page);
    assert.ok((await capture(failure.page, 'ko-820-' + recoveryAction + '-recovered', true)).colors > 150, 'manual recovery displays the recovered model image');
    assert.equal(await failure.page.locator('#studio-retry').isVisible(), false);
    assert.deepEqual(failure.errors, []); assert.deepEqual(failure.violations, []);
    reports.push({ failureMode: 'modelSheetBlocked', recoveryAction, status: failureStatus, manualRecovery: true, requests: failure.requests });
    await failure.context.close();
    }
    const sources = ['fitting-studio.html', 'assets/fitting-studio.js', 'assets/fitting-studio.css', 'assets/fitting-studio-3d.js', 'assets/fitting-studio-3d.css', 'assets/gltf-proof.js', 'assets/studio/hero.png', 'assets/studio/male-sheet.png', 'assets/studio/female-sheet.png'];
    fs.writeFileSync(path.join(out, 'browser-result.json'), JSON.stringify({ sourceHashes: Object.fromEntries(sources.map(file => [file, sha(fs.readFileSync(path.join(root, file)))])),
      reports, environment: { browser: 'Linux Chromium', nativeIpadSafari: false },
      scope: 'Generated 2D style images and a separate, actual stock 3D model rendered in the same page. No personalized photo fitting, exact sizing, image-to-3D reconstruction, retail stock or native iPad Safari certification.' }, null, 2) + '\n');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
