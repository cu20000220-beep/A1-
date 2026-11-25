'use strict';
// Actual pixels and lifecycle evidence for a licensed, textured stock avatar.
// This does not certify cinematic realism, personalized reconstruction or iPad GPU performance.
const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const origin = 'https://natural-avatar.a1fashion.pages.dev';
const out = process.env.A1_NATURAL_OUT || path.join(root, 'docs/validation/natural-avatar');
fs.mkdirSync(out, { recursive: true });
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const snapshot = page => page.evaluate(() => window.A1GltfProof.snapshot());
const canvas = page => page.locator('#gltf-canvas');
const pixels = page => canvas(page).screenshot({ animations: 'disabled' });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.svg': 'image/svg+xml' };

function detail(bytes) {
  const image = PNG.sync.read(bytes), colours = new Set();
  let chromatic = 0;
  for (let y = 0; y < image.height; y += 3) for (let x = 0; x < image.width; x += 3) {
    const i = (y * image.width + x) * 4, [r, g, b] = image.data.subarray(i, i + 3);
    colours.add(image.data.subarray(i, i + 3).toString('hex'));
    if (Math.max(r, g, b) - Math.min(r, g, b) > 24) chromatic++;
  }
  return { width: image.width, height: image.height, colours: colours.size, chromatic };
}

async function capture(page, name) {
  const bytes = await pixels(page);
  fs.writeFileSync(path.join(out, name + '.png'), bytes);
  return { name, sha256: sha(bytes), ...detail(bytes) };
}

async function headCapture(page, name) {
  await canvas(page).scrollIntoViewIfNeeded();
  const box = await canvas(page).boundingBox();
  await page.screenshot({ path: path.join(out, name + '.png'), clip: {
    x: box.x + box.width * 0.32, y: box.y + box.height * 0.035,
    width: box.width * 0.36, height: box.height * 0.30
  } });
}

async function ready(page, look) {
  await page.waitForFunction(value => {
    const state = window.A1GltfProof?.snapshot();
    return state?.state === 'ready' && state.look === value;
  }, look, { timeout: 45000 });
}

async function prepare(browser, profile, { production = false, localFashionEnabled = false, blocked = false } = {}) {
  const base = production ? 'https://a1fashion.pages.dev' : origin;
  const context = await browser.newContext({ viewport: { width: profile.width, height: profile.height },
    hasTouch: profile.touch, isMobile: profile.touch, deviceScaleFactor: 1, locale: profile.lang === 'ko' ? 'ko-KR' : 'en-US' });
  const requests = [], errors = [], consoleErrors = [], violations = [];
  const policy = fs.readFileSync(path.join(root, '_headers'), 'utf8')
    .match(/^\/gltf-proof\*\n\s+Content-Security-Policy:\s*([^\r\n]+)/m)?.[1];
  assert.ok(policy);
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    assert.equal(url.origin, base, 'no photo, body value or credential can leave the isolated static origin');
    assert.equal(req.method(), 'GET');
    if (production && url.pathname === '/api/policy') {
      assert.equal(url.search, '');
      assert.equal(req.postData(), null);
      assert.equal(await req.headerValue('cookie'), null);
      requests.push(url.pathname);
      await route.fulfill({ json: { freeBetaMode: false, billingEnabled: false, accountRequiredForSaving: true, localFashionEnabled } });
      return;
    }
    assert.ok(!url.pathname.startsWith('/api/'), 'no backend, paid AI, member or database request');
    if (url.protocol === 'blob:') { await route.continue(); return; }
    for (const [key, value] of url.searchParams) { assert.equal(key, 'v'); assert.match(value, /^[a-z0-9-]+$/i); }
    const relative = url.pathname === '/gltf-proof' ? 'gltf-proof.html' : url.pathname.slice(1);
    assert.ok(relative === 'gltf-proof.html' || relative === 'favicon.ico' || relative.startsWith('assets/'));
    const full = path.resolve(root, relative);
    assert.ok(full.startsWith(root + path.sep));
    requests.push(url.pathname);
    if (relative === 'favicon.ico' && !fs.existsSync(full)) { await route.fulfill({ status: 204, body: '' }); return; }
    if (blocked && relative === 'assets/natural-avatar/sample.glb') { await route.abort('failed'); return; }
    assert.ok(fs.existsSync(full), 'requested static asset exists: ' + relative);
    await route.fulfill({ body: fs.readFileSync(full), contentType: mime[path.extname(relative)] || 'application/octet-stream',
      headers: relative === 'gltf-proof.html' ? { 'Content-Security-Policy': policy } : {} });
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', entry => { if (entry.type() === 'error') consoleErrors.push(entry.text()); });
  await page.exposeFunction('recordNaturalCsp', value => violations.push(value));
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', event => window.recordNaturalCsp(event.effectiveDirective)));
  await page.goto(base + '/gltf-proof', { waitUntil: 'networkidle' });
  if (!production) {
    await ready(page, 'nova');
    await page.locator('[data-language-select]').selectOption(profile.lang);
    assert.equal(await page.locator('html').getAttribute('lang'), profile.lang);
  }
  return { context, page, requests, errors, consoleErrors, violations };
}

async function touchAndPinch(page) {
  await canvas(page).scrollIntoViewIfNeeded();
  const box = await canvas(page).boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2;
  const session = await page.context().newCDPSession(page);
  const before = sha(await pixels(page));
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  for (let n = 1; n <= 6; n++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + n * 12, y, id: 1 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.notEqual(sha(await pixels(page)), before, 'touch changes the actual camera projection');
  const rotated = sha(await pixels(page));
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x - 30, y, id: 1 }, { x: x + 30, y, id: 2 }] });
  for (let n = 1; n <= 5; n++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 30 - n * 10, y, id: 1 }, { x: x + 30 + n * 10, y, id: 2 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.notEqual(sha(await pixels(page)), rotated, 'pinch changes actual body framing');
  await session.detach();
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const reports = [];
  try {
    for (const profile of [{ width: 1280, height: 900, touch: false, lang: 'ko' },
      { width: 820, height: 1180, touch: true, lang: 'ko' }, { width: 1180, height: 820, touch: true, lang: 'en' }]) {
      const trial = await prepare(browser, profile), { page, context } = trial;
      const prefix = profile.lang + '-' + profile.width, defaultLook = await snapshot(page);
      assert.equal(defaultLook.look, 'nova', 'the standalone Preview opens with the same Nova avatar as the Studio');
      assert.equal(defaultLook.bones, 73);
      assert.ok(defaultLook.memoryTextures > 10);
      assert.deepEqual(trial.requests.filter(p => p.endsWith('.glb')), ['/assets/nova-avatar/avatar.glb']);
      await page.locator('#gltf-front').click();
      const nova = await capture(page, prefix + '-nova-front');
      assert.ok(nova.colours > 800 && nova.chromatic > 100);
      await page.locator('#gltf-look').selectOption('natural');
      await ready(page, 'natural');
      const initial = await snapshot(page);
      assert.ok(trial.requests.includes('/assets/natural-avatar/sample.glb'), 'the older comparison only loads after selection');
      assert.equal(initial.naturalProfile, true);
      assert.equal(initial.bones, 73, 'the real source skeleton is retained');
      assert.ok(initial.skinnedMeshes >= 10, 'body, head, eyes, hair and outfit really load');
      assert.ok(initial.triangles > 40000, 'actual detailed source geometry is drawn');
      assert.ok(initial.memoryTextures > 10, 'the source texture maps are actually allocated');
      assert.equal(await page.locator('#gltf-garment').inputValue(), 'source');
      assert.equal(await page.locator('#gltf-garment').isDisabled(), true, 'unsupported stock outfit swaps are not presented as working retail fitting');
      assert.equal(await page.locator('#natural-avatar-note').isVisible(), true);
      const frames = [];
      for (const view of ['front', 'side', 'back']) {
        await page.locator('#gltf-' + view).click();
        const frame = await capture(page, prefix + '-' + view);
        assert.ok(frame.colours > 800 && frame.chromatic > 100, 'textured shaded human is not a blank mannequin or colour block');
        frames.push(frame);
      }
      assert.equal(new Set(frames.map(frame => frame.sha256)).size, 3);
      await page.locator('#gltf-front').click();
      await headCapture(page, prefix + '-face');
      await page.screenshot({ path: path.join(out, prefix + '-overview.png'), fullPage: true });
      const standard = sha(await pixels(page));
      await page.locator('#gltf-material').selectOption('basic');
      const basic = await capture(page, prefix + '-basic-textures');
      assert.notEqual(basic.sha256, standard);
      assert.ok(basic.colours > 800, 'basic comparison must keep the image maps');
      await page.locator('#gltf-material').selectOption('standard');
      const neutral = sha(await pixels(page));
      await page.locator('#gltf-skin-proof').check();
      const pose = await capture(page, prefix + '-pose');
      assert.notEqual(pose.sha256, neutral, 'the real skeletal pose changes pixels');
      await page.locator('#gltf-skin-proof').uncheck();
      if (!profile.touch) {
        let previous = (await snapshot(page)).viewYaw, total = 0;
        for (let n = 0; n < 36; n++) { await page.locator('#gltf-right').click(); const yaw = (await snapshot(page)).viewYaw; total += Math.abs(Math.atan2(Math.sin(yaw - previous), Math.cos(yaw - previous))); previous = yaw; }
        assert.ok(total >= Math.PI * 2 - 0.02, 'full 360-degree rotation changes the actual perspective');
      } else if (profile.width === 820) await touchAndPinch(page);
      await page.locator('#gltf-look').selectOption('reference');
      await ready(page, 'reference');
      const referenceState = await snapshot(page);
      assert.equal(referenceState.bones, 2);
      assert.equal(referenceState.naturalProfile, false);
      await page.locator('#gltf-front').click();
      const reference = await capture(page, prefix + '-reference');
      assert.notEqual(reference.sha256, frames[0].sha256, 'new natural human is different geometry/textures from the old body');
      for (const value of ['LAB-A', 'LAB-B', 'LAB-C']) { await page.locator('#gltf-garment').selectOption(value); assert.equal((await snapshot(page)).look, 'reference'); }
      await page.locator('#gltf-look').selectOption('natural');
      await ready(page, 'natural');
      assert.equal((await snapshot(page)).bones, 73);
      assert.equal(await page.locator('#gltf-garment').isDisabled(), true);
      const active = await snapshot(page);
      assert.equal(await canvas(page).evaluate(c => c.getContext('webgl2').getError()), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.deepEqual(await page.evaluate(() => Object.keys(sessionStorage)), []);
      assert.deepEqual(await page.evaluate(() => Object.keys(localStorage)), ['a1-fashion:language']);
      await page.locator('#gltf-delete').click();
      const disposed = await snapshot(page);
      assert.equal(disposed.disposed, true); assert.equal(disposed.memoryGeometries, 0); assert.equal(disposed.memoryTextures, 0);
      await page.locator('#gltf-retry').click();
      await ready(page, 'natural');
      assert.equal((await snapshot(page)).bones, 73);
      assert.deepEqual(trial.errors, []); assert.deepEqual(trial.consoleErrors, []); assert.deepEqual(trial.violations, []);
      reports.push({ profile, defaultLook, nova, initial, active, frames, reference, basic, pose, requests: trial.requests,
        errors: trial.errors, consoleErrors: trial.consoleErrors, violations: trial.violations });
      console.log(`Natural avatar ${prefix}: real textured body/head, 73 bones, front/side/back, reference/garment boundaries, controls, cleanup and privacy passed.`);
      await context.close();
    }
    const publicProfile = { width: 820, height: 1180, touch: true, lang: 'ko' };
    const production = await prepare(browser, publicProfile, { production: true });
    assert.deepEqual(production.requests.filter(p => p.startsWith('/api/')), ['/api/policy']);
    assert.ok(!production.requests.some(p => p.endsWith('.glb')));
    assert.equal(await production.page.locator('#gltf-proof-root').getAttribute('data-load-state'), 'blocked');
    assert.deepEqual(production.errors, []); reports.push({ productionBlocked: true, requests: production.requests }); await production.context.close();
    const publicLocal = await prepare(browser, publicProfile, { production: true, localFashionEnabled: true });
    await ready(publicLocal.page, 'nova');
    assert.equal(await publicLocal.page.evaluate(() => window.A1PublicBeta), undefined, 'free beta remains independently disabled');
    assert.deepEqual(publicLocal.requests.filter(p => p.startsWith('/api/')), ['/api/policy']);
    assert.deepEqual(publicLocal.requests.filter(p => p.endsWith('.glb')), ['/assets/nova-avatar/avatar.glb']);
    await publicLocal.page.locator('#gltf-front').click();
    const trousers = [];
    for (const sample of ['source', 'wide-trousers', 'relaxed-trousers', 'straight-trousers']) {
      await publicLocal.page.evaluate(selected => window.A1GltfProof.setBodyFit(
        { shoulderHipRatio: 1.22, legTorsoRatio: 1.67 }, { sample: selected }), sample);
      const rendered = await snapshot(publicLocal.page);
      assert.equal(rendered.bodyFitted, true);
      assert.equal(rendered.garment, sample);
      assert.equal(await publicLocal.page.locator('#gltf-garment').inputValue(), sample);
      trousers.push(await capture(publicLocal.page, 'official-nova-' + sample));
    }
    assert.equal(new Set(trousers.map(frame => frame.sha256)).size, trousers.length, 'trouser choices alter the fitted avatar’s actual WebGL pixels');
    assert.deepEqual(publicLocal.errors, []); assert.deepEqual(publicLocal.violations, []);
    reports.push({ publicLocalNova: true, trousers, requests: publicLocal.requests }); await publicLocal.context.close();
    const blocked = await prepare(browser, { width: 820, height: 1180, touch: true, lang: 'ko' }, { blocked: true });
    await blocked.page.locator('#gltf-look').selectOption('natural');
    await blocked.page.waitForFunction(() => document.querySelector('#gltf-proof-root').dataset.loadState === 'error');
    assert.equal((await snapshot(blocked.page)).look, 'natural', 'the selected comparison fails explicitly');
    assert.match(await blocked.page.locator('#gltf-status').innerText(), /모델|model|load/i);
    assert.equal(await blocked.page.locator('#gltf-retry').isEnabled(), true);
    assert.deepEqual(blocked.requests.filter(p => p.endsWith('.glb')), ['/assets/nova-avatar/avatar.glb', '/assets/natural-avatar/sample.glb']);
    assert.deepEqual(blocked.errors, []); assert.deepEqual(blocked.violations, []);
    reports.push({ failureMode: 'naturalModelBlocked', requests: blocked.requests, status: await blocked.page.locator('#gltf-status').innerText() });
    await blocked.context.close();
    const sources = ['gltf-proof.html', 'assets/gltf-proof.js', 'assets/gltf-proof.css', 'assets/public-beta-bootstrap.js', 'assets/nova-avatar/avatar.glb', 'assets/natural-avatar/sample.glb', 'assets/natural-avatar/asset-manifest.json'];
    for (const file of ['assets/natural-avatar-profile.js', 'assets/natural-avatar.js']) if (fs.existsSync(path.join(root, file))) sources.push(file);
    fs.writeFileSync(path.join(out, 'browser-result.json'), JSON.stringify({ sourceHashes: Object.fromEntries(sources.map(file => [file, sha(fs.readFileSync(path.join(root, file)))])), reports,
      environment: { browser: 'Linux Chromium with SwiftShader', nativeIpadSafari: false },
      scope: 'Licensed textured stock reference, not the uploaded user or exact garment fitting. Pixel assertions establish rendering and interactions, not cinematic photorealism. Touch emulation is not native iPad performance.' }, null, 2) + '\n');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
