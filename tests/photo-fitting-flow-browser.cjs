'use strict';
// Integration evidence: inference is deterministic/mocked here, while the GLB,
// WebGL pixels, raster fitting, consent, cancellation and storage are real.
// Native iPad Safari and actual MediaPipe inference need separate evidence.
const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const origin = 'https://photo-flow.a1fashion.pages.dev';
const out = process.env.A1_PHOTO_FLOW_OUT || '/workspace/work/photo-flow-test';
fs.mkdirSync(out, { recursive: true });
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.woff2': 'font/woff2' };

function instrumentMockAnalysis() {
  const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
  window.__flowImageUrls = new Set(); window.__flowBodySelections = 0; window.__flowAnalyses = 0;
  document.addEventListener('a1:analysis-ready', () => { __flowAnalyses++; });
  URL.createObjectURL = value => { const url = create(value); __flowImageUrls.add(url); return url; };
  URL.revokeObjectURL = url => { __flowImageUrls.delete(url); revoke(url); };
  sessionStorage.setItem('a1:unrelated-test-state', 'SYNTHETIC-STATE-KEEP');
  document.addEventListener('change', e => { if (e.target.id === 'ai-photo') __flowBodySelections++; });
  window.Pose = class {
    setOptions() {} onResults(fn) { this.result = fn; }
    async initialize() {} async reset() {} async close() {}
    async send() {
      const points = Array.from({ length: 33 }, (_, index) => ({ x: .5, y: .5, visibility: index < 11 ? 0 : .99 }));
      const body = window.__flowDifferentRatios
        ? { 11: [.26, .2], 12: [.74, .2], 23: [.35, .37], 24: [.65, .37],
          25: [.35, .63], 26: [.65, .63], 27: [.35, .93], 28: [.65, .93] }
        : { 11: [.3, .2], 12: [.7, .2], 23: [.36, .45], 24: [.64, .45],
          25: [.36, .65], 26: [.64, .65], 27: [.36, .9], 28: [.64, .9] };
      for (const [index, [x, y]] of Object.entries(body)) points[index] = { x, y, visibility: .99 };
      this.result({ poseLandmarks: points });
    }
  };
}

function policyFor(relative) {
  const route = relative === 'fitting-studio.html' ? '/fitting-studio*' : relative === 'product-lab.html' ? '/product-lab*'
    : relative === 'gltf-proof.html' ? '/gltf-proof*' : null;
  if (!route) return null;
  const lines = fs.readFileSync(path.join(root, '_headers'), 'utf8').split('\n');
  const at = lines.indexOf(route); assert.ok(at >= 0, 'actual deployment policy exists for ' + route);
  const line = lines[at + 1]; assert.match(line, /Content-Security-Policy:/);
  return line.slice(line.indexOf(':') + 1).trim();
}

async function prepare(browser, profile, { delayedPath } = {}) {
  const context = await browser.newContext({ viewport: { width: profile.width, height: profile.height },
    hasTouch: profile.touch, isMobile: profile.touch, deviceScaleFactor: 1,
    locale: profile.lang === 'ko' ? 'ko-KR' : 'en-US' });
  const calls = [], errors = [], violations = [], merchantNavigations = [];
  let allowMerchant = null, releaseDelay, noticeDelay;
  const deferred = new Promise(resolve => { releaseDelay = resolve; });
  const seenDelay = new Promise(resolve => { noticeDelay = resolve; });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    assert.equal(request.method(), 'GET', 'no personal photo, dimensions or message may be uploaded');
    if (url.pathname === '/assets/product-images.json') { await route.fulfill({contentType:'application/json',body:JSON.stringify({version:1,authorization:JSON.parse(fs.readFileSync(path.join(root,'assets/product-images.json'),'utf8')).authorization,products:[]})});return; }
    if (url.origin !== origin) {
      assert.equal(request.isNavigationRequest(), true, 'only an explicit merchant navigation may leave this origin');
      assert.equal(request.url(), allowMerchant, 'only the tested user-selected official search URL is permitted');
      merchantNavigations.push(request.url()); await route.abort('blockedbyclient'); return;
    }
    assert.ok(!url.pathname.startsWith('/api/'), 'the flow must keep Preview API isolation intact');
    for (const [key, value] of url.searchParams) { assert.equal(key, 'v'); assert.match(value, /^[a-z0-9-]+$/i); }
    calls.push(url.pathname);
    if (url.pathname.endsWith('.html')) {
      await route.fulfill({ status: 308, headers: { Location: url.pathname.slice(0, -5) }, body: '' }); return;
    }
    if (url.pathname === delayedPath) { noticeDelay(); await deferred; }
    const relative = url.pathname === '/' || url.pathname === '/index' ? 'index.html'
      : ['/product-lab', '/gltf-proof', '/fitting-studio'].includes(url.pathname) ? url.pathname.slice(1) + '.html' : url.pathname.slice(1);
    const file = path.resolve(root, relative); assert.ok(file.startsWith(root + path.sep));
    if (relative === 'favicon.ico' && !fs.existsSync(file)) { await route.fulfill({ status: 204, body: '' }); return; }
    assert.ok(fs.existsSync(file), 'every actual requested deployment asset exists: ' + relative);
    const policy = policyFor(relative);
    await route.fulfill({ body: fs.readFileSync(file), contentType: mime[path.extname(file)] || 'application/octet-stream',
      headers: policy ? { 'Content-Security-Policy': policy } : {} });
  });
  await context.addInitScript(instrumentMockAnalysis);
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  await page.exposeFunction('flowCspViolation', value => violations.push(value));
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', e => window.flowCspViolation(e.effectiveDirective)));
  await page.goto(origin + (profile.studio ? '/fitting-studio' : '/'), { waitUntil: 'networkidle' });
  await page.evaluate(lang => A1I18n.setLanguage(lang), profile.lang);
  if (profile.studio) {
    await page.locator('#studio-open-photo-fitting').click();
    await page.waitForSelector('#lab-local-photo-fitting', { timeout: 25000 });
    assert.equal(await page.locator('#ai-studio').count(), 1, 'style studio mounts a single existing analysis form');
  }
  return { page, context, calls, errors, violations, merchantNavigations, seenDelay, releaseDelay,
    allowMerchant(url) { allowMerchant = url; } };
}

async function analyze(page, { autoFit = false } = {}) {
  const consent = page.locator('#ai-form #avatar-reference-consent');
  const alreadyConsented = await consent.isChecked();
  const completed = await page.evaluate(() => __flowAnalyses);
  await page.locator('#ai-photo').setInputFiles(path.join(root, 'assets/photos/man.jpg'));
  if (!alreadyConsented) {
    await page.waitForFunction(() => !document.querySelector('#ai-analyze').disabled);
    if (autoFit) await consent.check();
    await page.locator('#ai-analyze').click();
  }
  await page.waitForFunction(previous => __flowAnalyses === previous + 1 && !document.querySelector('#ai-result').hidden, completed);
  assert.equal(await page.locator('#ai-preview-canvas').evaluate(c => c.width * c.height), 1, 'full-photo preview is erased at analysis success');
  assert.equal(await page.locator('#ai-clean-canvas').evaluate(c => c.hidden && c.width > 100 && c.height > 100), true);
}

async function canvasHash(page, selector) {
  return page.locator(selector).evaluate(async canvas => {
    const bytes = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
  });
}

async function capture3D(page, name) {
  const bytes = await page.locator('#gltf-canvas').screenshot({ animations: 'disabled' });
  fs.writeFileSync(path.join(out, name + '.png'), bytes);
  const image = PNG.sync.read(bytes), colors = new Set(); let chromatic = 0;
  for (let i = 0; i < image.data.length; i += 48) {
    const [r, g, b] = image.data.subarray(i, i + 3); colors.add(r + ',' + g + ',' + b);
    if (Math.max(r, g, b) - Math.min(r, g, b) > 24) chromatic++;
  }
  assert.ok(colors.size > 800 && chromatic > 100, 'a textured human must actually draw, rather than a blank or simple colour block');
  return { name, sha256: sha(bytes), colors: colors.size, chromatic };
}

async function readyAvatar(page, { look = 'nova', bodyFitted = false } = {}) {
  await page.waitForFunction(expected => {
    const state = window.A1GltfProof?.snapshot();
    return state?.state === 'ready' && state.look === expected.look && state.bodyFitted === expected.bodyFitted;
  }, { look, bodyFitted }, { timeout: 45000 });
  const value = await page.evaluate(() => A1GltfProof.snapshot());
  assert.equal(value.look, look); assert.equal(value.bones, 73); assert.ok(value.skinnedMeshes >= 10);
  assert.ok(value.triangles > (look === 'nova' ? 15000 : 40000) && value.memoryTextures > 10);
  assert.equal(await page.locator('#avatar-root:visible').count(), 0, 'the old mannequin must not be the analysis default');
  assert.equal(await page.locator('#gltf-proof-root').count(), 1, 'the existing singleton renderer is mounted once');
  return value;
}

async function verifyNovaCredit(page) {
  const credit = page.locator('#gltf-nova-credit');
  assert.equal(await credit.isVisible(), true, 'the active Nova asset displays attribution');
  assert.equal(await credit.locator('a[href="https://vtubeme.com/"]').isVisible(), true);
  assert.equal(await credit.locator('a[href="https://creativecommons.org/licenses/by/4.0/"]').isVisible(), true);
}

async function renderedFrame(page) {
  // Read the WebGL canvas synchronously with an actual render. A locator
  // screenshot can otherwise include the site's sticky header after the
  // consent checkbox scrolls it, producing a false geometry-change result.
  const value = await page.evaluate(() => {
    document.querySelector('#gltf-front').click();
    return document.querySelector('#gltf-canvas').toDataURL('image/png');
  });
  assert.ok(value.length > 10000, 'the actual WebGL frame contains rendered detail');
  return Buffer.from(value.split(',', 2)[1], 'base64');
}

async function stable3DHash(page) { return sha(await renderedFrame(page)); }

async function verifyPortrait(page, prefix, fullFrame) {
  const portrait = page.locator('#gltf-portrait');
  assert.equal(await portrait.isVisible(), true);
  assert.equal(await page.evaluate(() => A1GltfProof.snapshot().portrait), false);
  await portrait.click();
  assert.equal(await page.evaluate(() => A1GltfProof.snapshot().portrait), true);
  assert.notEqual(await stable3DHash(page), fullFrame, 'the portrait shows a different WebGL view of the same actor');
  assert.equal(await page.evaluate(() => A1GltfProof.snapshot().portrait), true, 'front rotation preserves portrait framing');
  const capture = await capture3D(page, prefix + '-3d-portrait');
  await portrait.click();
  assert.equal(await page.evaluate(() => A1GltfProof.snapshot().portrait), false);
  await page.locator('#gltf-front').click();
  assert.equal(await stable3DHash(page), fullFrame, 'closing the portrait restores the full-body frame');
  return capture;
}

async function touch(page) {
  const canvas = page.locator('#gltf-canvas'); await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2;
  const session = await page.context().newCDPSession(page);
  const before = sha(await canvas.screenshot());
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  for (let n = 1; n <= 6; n++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + n * 12, y, id: 1 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const rotated = sha(await canvas.screenshot()); assert.notEqual(rotated, before, 'touch rotation changes actual rendered pixels');
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x - 30, y, id: 1 }, { x: x + 30, y, id: 2 }] });
  for (let n = 1; n <= 5; n++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 30 - n * 10, y, id: 1 }, { x: x + 30 + n * 10, y, id: 2 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.notEqual(sha(await canvas.screenshot()), rotated, 'pinch changes actual framing'); await session.detach();
}

async function verifyPhotoFitting(page, prefix) {
  const sourceHash = await canvasHash(page, '#ai-clean-canvas');
  await page.locator('#natural-open-photo-fitting').click();
  await page.waitForSelector('#lab-local-photo-fitting');
  assert.equal(await canvasHash(page, '#ai-clean-canvas'), sourceHash, 'the original cropped body pixels survive opening the fitting UI');
  assert.equal(await page.evaluate(() => __flowBodySelections), 1, 'the body photo must not be selected a second time');
  assert.equal(await page.locator('.lab-card').count(), 0, 'actual photo fitting does not enable fictional product examples');
  const garment = page.locator('#lab-garment-photo'), rights = page.locator('#lab-garment-photo-rights');
  const consent = page.locator('#lab-local-photo-consent'), result = page.locator('#lab-local-photo-canvas');
  assert.equal(await rights.isChecked(), false); assert.equal(await consent.isChecked(), false);
  await garment.setInputFiles(path.join(root, 'assets/photos/coat.jpg')); assert.equal(await garment.inputValue(), '');
  await rights.check(); await garment.setInputFiles(path.join(root, 'assets/photos/coat.jpg'));
  await page.waitForFunction(() => !document.querySelector('#lab-garment-photo-figure').hidden);
  assert.equal(await consent.isChecked(), false, 'garment rights do not grant body-photo consent');
  await page.locator('#lab-local-photo-fit').click(); assert.equal(await page.locator('#lab-local-photo-result').isVisible(), false);
  await consent.check(); await page.locator('#lab-local-photo-fit').click();
  await page.waitForFunction(() => !document.querySelector('#lab-local-photo-result').hidden);
  const actualChanges = await page.evaluate(() => {
    const a = document.querySelector('#ai-clean-canvas'), b = document.querySelector('#lab-local-photo-canvas');
    const first = a.getContext('2d').getImageData(0, 0, a.width, a.height - 50).data;
    const second = b.getContext('2d').getImageData(0, 0, b.width, b.height - 50).data; let changed = 0;
    for (let i = 0; i < first.length; i += 4) if (Math.abs(first[i] - second[i]) + Math.abs(first[i + 1] - second[i + 1]) + Math.abs(first[i + 2] - second[i + 2]) > 30) changed++;
    return changed;
  });
  assert.ok(actualChanges > 1000, 'real garment-image pixels change the body photo outside the caption');
  const transforms = [];
  for (const [id, value] of [['lab-local-photo-x', '62'], ['lab-local-photo-y', '45'], ['lab-local-photo-scale', '40'],
    ['lab-local-photo-rotation', '15'], ['lab-local-photo-opacity', '75']]) {
    const before = await canvasHash(page, '#lab-local-photo-canvas');
    await page.locator('#' + id).evaluate((el, next) => { el.value = next; el.dispatchEvent(new Event('input', { bubbles: true })); }, value);
    const after = await canvasHash(page, '#lab-local-photo-canvas'); assert.notEqual(after, before, id + ' changes actual output'); transforms.push(id);
  }
  const overlay = await canvasHash(page, '#lab-local-photo-canvas'); await page.locator('#lab-local-photo-before').check();
  const before = await canvasHash(page, '#lab-local-photo-canvas'); assert.notEqual(before, overlay, 'before/after actually changes the image');
  await result.screenshot({ path: path.join(out, prefix + '-2d-before.png') });
  await page.locator('#lab-local-photo-before').uncheck(); assert.equal(await canvasHash(page, '#lab-local-photo-canvas'), overlay);
  await result.screenshot({ path: path.join(out, prefix + '-2d-garment.png') });
  assert.match(await page.locator('#lab-local-photo-result').innerText(), /AI 착용 합성 아님|not AI try-on/i);
  await consent.uncheck(); assert.equal(await result.evaluate(c => c.width * c.height), 1, 'withdrawing photo consent erases fitted pixels');
  await consent.check(); await page.locator('#lab-local-photo-fit').click();
  assert.equal(await page.evaluate(() => __flowImageUrls.size), 0, 'temporary decoded image URLs have already been revoked');
  return { actualChanges, transforms, beforeAfter: true, photoReselection: false };
}

async function verifyClear(page) {
  await page.locator('#ai-clear').click();
  for (const id of ['ai-canvas', 'ai-preview-canvas', 'ai-clean-canvas', 'lab-garment-photo-preview', 'lab-local-photo-canvas']) {
    assert.equal(await page.locator('#' + id).evaluate(c => c.width * c.height), 1, id + ' is erased together');
  }
  for (const id of ['avatar-reference-consent', 'lab-garment-photo-rights', 'lab-local-photo-consent']) assert.equal(await page.locator('#' + id).isChecked(), false);
  assert.equal(await page.locator('#lab-garment-photo').inputValue(), '');
  assert.equal(await page.locator('#lab-local-photo-result').isVisible(), false);
  await page.waitForFunction(() => {
    const state = window.A1GltfProof?.snapshot();
    return !state || state.disposed && !state.bodyFitted && state.memoryGeometries === 0 && state.memoryTextures === 0;
  });
  assert.equal(await page.locator('#gltf-proof-root:visible').count(), 0, 'deleting analysis also hides its temporary avatar');
  assert.equal(await page.evaluate(() => __flowImageUrls.size), 0);
  assert.equal(await page.evaluate(() => sessionStorage.getItem('a1:unrelated-test-state')), 'SYNTHETIC-STATE-KEEP', 'privacy cleanup does not delete unrelated user state');
  assert.deepEqual(await page.evaluate(() => Object.keys(sessionStorage)), ['a1:unrelated-test-state']);
  assert.deepEqual(await page.evaluate(() => Object.keys(localStorage).sort()), ['a1-fashion:language']);
}

async function verifyShopping(page, trial, { activate = false, click = false } = {}) {
  if (activate) await page.locator('#natural-open-shopping').click();
  await page.locator('#lab-photo-search-query').fill('남성 검정 슬랙스 5만원 이하');
  await page.locator('#lab-photo-search button[type=submit]').click();
  const links = await page.locator('#lab-photo-search-results a[href]').evaluateAll(nodes => nodes.map(el => ({
    url: el.href, referrer: el.referrerPolicy, rel: el.rel, target: el.target
  })));
  const targets = [['www.musinsa.com', '/search/goods', 'keyword'], ['www.29cm.co.kr', '/store/search', 'keyword'],
    ['search.shopping.naver.com', '/search/all', 'query'], ['www.coupang.com', '/np/search', 'q']];
  const searches = [];
  for (const [host, pathname, key] of targets) {
    const link = links.find(row => { const url = new URL(row.url); return url.hostname === host && url.pathname === pathname && url.searchParams.has(key); });
    assert.ok(link, 'the actual local fitting flow exposes an official clothing search at ' + host);
    const url = new URL(link.url); assert.equal(url.protocol, 'https:'); assert.equal(url.username + url.password + url.port, '');
    assert.match(url.searchParams.get(key), /슬랙스/); assert.match(url.searchParams.get(key), /검정|블랙/);
    assert.equal(link.referrer, 'no-referrer'); assert.match(link.rel, /noreferrer/); assert.equal(link.target, '_self');
    searches.push({ retailer: host, url: link.url });
  }
  assert.match(await page.locator('#lab-photo-search-status').innerText(), /검색|search/i);
  if (click) {
    // This verifies a real user-click navigation and encoding only. The route
    // is aborted rather than contacting retailers or claiming they accept it.
    const chosen = searches[0].url; trial.allowMerchant(chosen);
    await page.locator('#lab-photo-search-results a[href]').filter({ hasText: /검색|Search/i }).first().click({ noWaitAfter: true });
    await page.waitForTimeout(100);
    assert.deepEqual(trial.merchantNavigations, [chosen]);
  }
  return { searches, actualRetailerResponseTested: false, navigationIntercepted: click };
}

async function verifyBodyReplacement(browser) {
  const trial = await prepare(browser, { width: 1280, height: 900, touch: false, lang: 'ko' });
  const { page } = trial;
  const consent = page.locator('#avatar-reference-consent');
  try {
    await analyze(page, { autoFit: true });
    await readyAvatar(page, { bodyFitted: true });
    assert.equal(await page.evaluate(() => typeof window.A1AvatarPhoto), 'undefined');
    const firstMetrics = await page.locator('#ai-metrics').innerText();
    const first = PNG.sync.read(await renderedFrame(page));

    // Leave consent enabled and submit the same fixture with different
    // inferred body proportions. The second selection starts analysis.
    await page.evaluate(() => {
      window.__flowDifferentRatios = true;
      document.addEventListener('a1:analysis-cleared', () => {
        window.__flowFitClearedOnReplacement = A1GltfProof.snapshot().bodyFitted === false;
      }, { once: true });
    });
    await analyze(page);
    assert.equal(await consent.isChecked(), true);
    assert.equal(await page.evaluate(() => __flowFitClearedOnReplacement), true, 'replacement discards the old 3D shape before analysis');
    assert.deepEqual(await page.evaluate(() => [__flowBodySelections, __flowAnalyses]), [2, 2]);
    await readyAvatar(page, { bodyFitted: true });
    assert.notEqual(await page.locator('#ai-metrics').innerText(), firstMetrics, 'replacement displays the updated body proportions');
    const secondFrame = await renderedFrame(page);
    const second = PNG.sync.read(secondFrame);
    assert.deepEqual([first.width, first.height], [second.width, second.height], 'the compared frames have identical dimensions');
    assert.notEqual(sha(first.data), sha(second.data), 'updated proportions change the rendered avatar at the same framing');
    await capture3D(page, 'index-ko-1280-3d-different-proportions');

    await consent.uncheck();
    await readyAvatar(page);
    assert.equal(await page.locator('#natural-photo-reference').isVisible(), false);
    await consent.check();
    await page.locator('#lab-open-avatar').click();
    await readyAvatar(page, { bodyFitted: true });
    assert.equal(await stable3DHash(page), sha(secondFrame), 'reapplying consent recovers the newest render');
    await page.locator('#ai-clear').click();
    await page.waitForFunction(() => {
      const state = A1GltfProof.snapshot();
      return state.disposed && !state.bodyFitted && state.memoryTextures === 0 && state.memoryGeometries === 0;
    });
    assert.equal(await consent.isChecked(), false);
    assert.equal(await page.locator('#ai-clean-canvas').evaluate(canvas => canvas.width * canvas.height), 1);
    assert.equal(await page.locator('#gltf-proof-root:visible').count(), 0);
    assert.equal(await page.evaluate(() => __flowImageUrls.size), 0);
    assert.deepEqual(await page.evaluate(() => Object.keys(sessionStorage)), ['a1:unrelated-test-state']);
    assert.deepEqual(await page.evaluate(() => Object.keys(localStorage)), ['a1-fashion:language']);
    assert.deepEqual(trial.errors, []); assert.deepEqual(trial.violations, []); assert.deepEqual(trial.merchantNavigations, []);
    console.log('Nova body photo: changed proportions, automatic replacement, revoke and clear passed.');
    return { name: 'nova-body-replacement-privacy', bodyLandmarksMocked: true, automaticReplacement: true,
      changedAvatar: true, revoked: true, cleared: true, requests: trial.calls.length };
  } finally { await trial.context.close(); }
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const cancelOnly = process.env.A1_PHOTO_FLOW_CANCEL_ONLY === '1';
  const replacementOnly = !cancelOnly && process.env.A1_PHOTO_FLOW_REPLACEMENT_ONLY === '1';
  const report = { inference: 'mocked deterministic landmarks; not proof of actual MediaPipe inference', browser: 'Linux Chromium/SwiftShader; not physical iPad Safari',
    scope: cancelOnly ? 'cancellation-only' : replacementOnly ? 'replacement-only' : 'full-integration', cases: [] };
  try {
    if (!cancelOnly) report.cases.push(await verifyBodyReplacement(browser));
    for (const profile of cancelOnly || replacementOnly ? [] : [
      { width: 1280, height: 900, touch: false, lang: 'ko' },
      { width: 820, height: 1180, touch: true, lang: 'ko' },
      { width: 1180, height: 820, touch: true, lang: 'en' },
      { width: 390, height: 1180, touch: true, lang: 'en', studio: true }
    ]) {
      const trial = await prepare(browser, profile), { page } = trial;
      const prefix = (profile.studio ? 'studio-' : 'index-') + profile.lang + '-' + profile.width;
      let stockFrame;
      if (profile.studio) {
        // The pre-existing style viewer still has a legacy comparison choice.
        // Entering the photo flow must change the *rendered* actor, not merely
        // change the label of that choice.
        await page.locator('[data-studio-mode=three]').click(); await readyAvatar(page, { look: 'natural' });
        assert.equal(await page.locator('#gltf-nova-credit').isVisible(), false, 'the independent sample keeps its own attribution');
        await page.locator('#gltf-look').selectOption('reference');
        await page.waitForFunction(() => {
          const state = window.A1GltfProof?.snapshot(); return state?.state === 'ready' && state.look === 'reference';
        });
        await page.locator('#avatar-open-default').click(); await readyAvatar(page);
        assert.equal(await page.locator('#gltf-look').inputValue(), 'nova', 'photo-flow selection matches the rendered Nova actor');
        await verifyNovaCredit(page);
        assert.equal(await page.locator('#natural-photo-reference').isVisible(), false);
        assert.equal(await page.evaluate(() => __flowBodySelections), 0, 'restoring Nova must work without a photo');
        await capture3D(page, prefix + '-restored-nova-without-photo');
      }
      if (!profile.studio && !profile.touch) {
        await page.locator('#avatar-open-default').click(); await readyAvatar(page);
        await verifyNovaCredit(page);
        assert.equal(await page.locator('#natural-photo-reference').isVisible(), false);
        assert.equal(await page.evaluate(() => __flowBodySelections), 0, 'the Nova sample works without selecting a photo');
        stockFrame = await stable3DHash(page);
      }
      const autoFit = !profile.touch;
      await analyze(page, { autoFit });
      assert.equal(await page.locator('#avatar-reference-consent').isChecked(), autoFit);
      if (!autoFit) {
        await page.locator('#avatar-reference-consent').check();
        await page.locator('#lab-open-avatar').click();
      }
      const initial = await readyAvatar(page, { bodyFitted: true });
      await verifyNovaCredit(page);
      assert.equal(await page.locator('#natural-photo-reference').isVisible(), true);
      assert.match(await page.locator('#natural-photo-reference').innerText(), /비율|ratio|proportion/i);
      const fittedFrame = await stable3DHash(page);
      if (stockFrame) assert.notEqual(fittedFrame, stockFrame, 'automatic fitting changes the Nova sample pixels');
      const portrait = autoFit ? await verifyPortrait(page, prefix, fittedFrame) : null;
      const styles = page.locator('#gltf-garment'), styleHashes = new Set([fittedFrame]);
      for (const style of ['relaxed', 'navy']) {
        await styles.selectOption(style);
        await page.waitForFunction(expected => window.A1GltfProof?.snapshot().garment === expected, style);
        styleHashes.add(await stable3DHash(page));
        if (autoFit) await capture3D(page, prefix + '-3d-' + style);
      }
      assert.equal(styleHashes.size, 3, 'the original and both wearable choices render distinct pixels');
      await styles.selectOption('source');
      await page.waitForFunction(() => window.A1GltfProof?.snapshot().garment === 'source');
      assert.equal(await stable3DHash(page), fittedFrame, 'returning the original clothing restores its frame');
      const frames = [];
      for (const view of ['front', 'side', 'back']) { await page.locator('#gltf-' + view).click(); frames.push(await capture3D(page, prefix + '-3d-' + view)); }
      assert.equal(new Set(frames.map(f => f.sha256)).size, 3, 'front/side/back are distinct actual 3D projections');
      await page.locator('#gltf-front').click(); const unzoomed = sha(await page.locator('#gltf-canvas').screenshot());
      await page.locator('#gltf-zoom-in').click(); assert.notEqual(sha(await page.locator('#gltf-canvas').screenshot()), unzoomed);
      if (profile.touch) await touch(page);
      if (!profile.touch) {
        let previous = (await page.evaluate(() => A1GltfProof.snapshot())).viewYaw, rotation = 0;
        for (let i = 0; i < 37; i++) { await page.locator('#gltf-right').click(); const yaw = (await page.evaluate(() => A1GltfProof.snapshot())).viewYaw;
          let delta = yaw - previous; if (delta < -Math.PI) delta += Math.PI * 2; if (delta > Math.PI) delta -= Math.PI * 2; rotation += delta; previous = yaw; }
        assert.ok(rotation > Math.PI * 2, 'camera can rotate a complete 360 degrees');
      }
      await page.locator('#gltf-front').click();
      const priorWithdrawal = await stable3DHash(page);
      await page.locator('#avatar-reference-consent').uncheck();
      await readyAvatar(page);
      assert.equal(await page.locator('#natural-photo-reference').isVisible(), false, 'ratios disappear when permission is withdrawn');
      assert.notEqual(await stable3DHash(page), priorWithdrawal, 'withdrawing consent removes the personalized geometry from the rendered avatar');
      await page.locator('#avatar-reference-consent').check();
      await page.locator('#lab-open-avatar').click();
      await readyAvatar(page, { bodyFitted: true });
      assert.equal(await stable3DHash(page), priorWithdrawal, 'reapplying permission restores the fitted avatar using the existing analysis');
      const shopping = await verifyShopping(page, trial, { activate: true });
      // Reopen the existing singleton to verify the direct photo-fitting CTA
      // after the shopping CTA, without replacing any analyzed body pixels.
      await page.locator('#avatar-open-default').click(); await readyAvatar(page);
      const fit = await verifyPhotoFitting(page, prefix);
      await verifyClear(page);
      assert.deepEqual(trial.errors, []); assert.deepEqual(trial.violations, []);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'integrated controls fit the mobile viewport');
      if (!profile.touch) await verifyShopping(page, trial, { click: true });
      report.cases.push({ profile, inferenceMocked: true, actor: initial.look, bones: initial.bones, noLegacyMannequin: true,
        restoredNovaFromReferenceWithoutPhoto: Boolean(profile.studio), frames, portrait, bodyFitted: true, autoFit,
        distinctGarments: styleHashes.size, consentRevocable: true, fit, shopping, deletion: true,
        requests: trial.calls.length, errors: trial.errors, csp: trial.violations });
      console.log(prefix + ': personalized Nova 3D, wearable styles, actual 3D/2D pixels, transforms/compare, privacy/delete passed.');
      await trial.context.close();
    }
    for (const [name, delayedPath, revoke] of replacementOnly ? [] : [['delete-during-template-load', '/gltf-proof', false],
      ['revoke-during-template-load', '/gltf-proof', true], ['delete-during-glb-load', '/assets/nova-avatar/avatar.glb', false]]) {
      const delayed = await prepare(browser, { width: 820, height: 1180, touch: true, lang: 'ko' }, { delayedPath });
      await analyze(delayed.page); await delayed.page.locator('#avatar-reference-consent').check(); await delayed.page.locator('#lab-open-avatar').click();
      await delayed.seenDelay;
      if (revoke) await delayed.page.locator('#avatar-reference-consent').uncheck();
      else await delayed.page.locator('#ai-clear').click();
      delayed.releaseDelay(); await delayed.page.waitForLoadState('networkidle');
      assert.equal(await delayed.page.locator('#gltf-proof-root:visible').count(), 0, 'late work cannot reopen a cancelled photo/avatar flow');
      assert.equal(await delayed.page.locator('#avatar-reference-consent').isChecked(), false);
      const gpu = await delayed.page.evaluate(() => window.A1GltfProof?.snapshot());
      if (gpu) { assert.equal(gpu.disposed, true); assert.equal(gpu.bodyFitted, false); assert.equal(gpu.memoryGeometries, 0); assert.equal(gpu.memoryTextures, 0); }
      if (revoke) assert.equal(await delayed.page.locator('#ai-result').isVisible(), true, 'withdrawing fitting consent does not erase the independent photo analysis');
      else assert.equal(await delayed.page.locator('#ai-clean-canvas').evaluate(c => c.width * c.height), 1);
      assert.deepEqual(delayed.errors, []); assert.deepEqual(delayed.violations, []);
      report.cases.push({ name, passed: true }); console.log(name + ': cancelled work stays hidden and releases GPU resources.'); await delayed.context.close();
    }
    report.passed = true;
  } finally {
    report.sourceHashes = Object.fromEntries(['tests/photo-fitting-flow-browser.cjs', 'assets/avatar-photo-bridge.js', 'assets/lab-entry.js', 'assets/lab-loader.js',
      'assets/gltf-proof.js', 'assets/natural-avatar-profile.js', 'assets/natural-avatar-fit.js', 'assets/natural-avatar-outfit.js',
      'assets/nova-avatar-studio.js',
      'assets/natural-avatar/asset-manifest.json', 'assets/natural-avatar/sample.glb',
      'assets/nova-avatar/asset-manifest.json', 'assets/nova-avatar/avatar.glb',
      'assets/fitting-studio-3d.js', 'assets/fitting-studio-photo.js', 'assets/fitting-studio-photo.css', 'assets/product-lab.js', 'assets/ai-studio.js',
      'index.html', 'product-lab.html', 'fitting-studio.html', '_headers']
      .filter(file => fs.existsSync(path.join(root, file))).map(file => [file, sha(fs.readFileSync(path.join(root, file)))]));
    fs.writeFileSync(path.join(out, 'browser-result.json'), JSON.stringify(report, null, 2));
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
