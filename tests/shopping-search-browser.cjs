'use strict';

const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const origin = 'https://photo-avatar.a1fashion.pages.dev';
const out = process.env.A1_SHOPPING_EVIDENCE || '/workspace/work/shopping-first';
const realPose = process.env.A1_SHOPPING_REAL_POSE === '1';
const observations = require('../assets/observed-products.json');
const approvedImageUrls = new Set(require('../assets/product-images.json').products.map(product => product.imageUrl));
const mime = {
  '.json': 'application/json', '.html': 'text/html', '.js': 'text/javascript',
  '.css': 'text/css', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.wasm': 'application/wasm',
};
fs.mkdirSync(out, { recursive: true });

async function pagesRedirect(route, url) {
  if (!['/avatar-lab.html', '/product-lab.html'].includes(url.pathname)) return false;
  await route.fulfill({ status: 308, headers: { Location: url.pathname.slice(0, -5) + url.search }, body: '' });
  return true;
}

function pagesPath(url) {
  if (['/avatar-lab', '/product-lab'].includes(url.pathname)) return url.pathname.slice(1) + '.html';
  return url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
}

function mockPose() {
  window.Pose = class {
    setOptions() {}
    onResults(callback) { this.result = callback; }
    async initialize() {}
    async reset() {}
    async close() {}
    async send() {
      const points = Array.from({ length: 33 }, () => ({ x: .5, y: .5, visibility: 0 }));
      const body = { 11: [.25,.2], 12: [.75,.2], 23: [.38,.5], 24: [.62,.5],
        25: [.38,.7], 26: [.62,.7], 27: [.38,.9], 28: [.62,.9] };
      for (const [id, [x,y]] of Object.entries(body)) points[id] = { x, y, visibility: .99 };
      this.result({ poseLandmarks: points });
    }
  };
}

async function search(page, query) {
  await page.locator('#shopping-query').fill(query);
  await page.locator('#shopping-search-form button[type=submit]').click();
  await waitForRecommendations(page);
}

async function waitForRecommendations(page) {
  await page.waitForFunction(() => document.querySelector('#shopping-discovery')?.dataset.state === 'ready');
}

async function enterProportions(page, measurements) {
  const details = page.locator('#shopping-proportion-input details');
  if (!await details.evaluate(node => node.open)) await details.locator('summary').click();
  for (const [field, value] of Object.entries(measurements)) {
    await details.locator(`[data-proportion-field="${field}"]`).fill(String(value));
  }
  await page.locator('#shopping-proportion-apply').click();
  await waitForRecommendations(page);
}

function proportionReasons(page, id) {
  return page.locator(`#shopping-discovery [data-discovery-id="${id}"] [data-proportion-reasons]`);
}

async function assertMeasurementsErased(page) {
  const values = await page.locator('#shopping-proportion-input [data-proportion-field]').evaluateAll(inputs => inputs.map(input => input.value));
  assert.equal(values.length, 8);
  assert.ok(values.every(value => value === ''), 'clearing proportions erases entered measurements');
}

async function verifyManualRecommendations(page, lang) {
  const consent = page.locator('#shopping-analysis-consent');
  const reasons = page.locator('#shopping-discovery [data-proportion-reasons]');
  const guidance = page.locator('.shopping-proportion-guidance');
  const shortId = 'musinsa-996498';
  const longId = '29cm-3423465';
  const noSleeveEvidence = '29cm-3487996';
  const manual = lang === 'ko' ? /직접 입력 치수로 계산/ : /Calculated from measurements you entered/;
  const shortSleeve = lang === 'ko' ? /상품 표기 반소매/ : /Listed Short sleeves/;
  const longSleeve = lang === 'ko' ? /상품 표기 긴소매/ : /Listed Long sleeves/;
  assert.ok(observations.products.find(product => product.id === shortId).observedFeatures.includes('반소매'));
  assert.ok(observations.products.find(product => product.id === longId).observedFeatures.includes('긴소매'));

  await search(page, '상의');
  assert.equal(await consent.isDisabled(), true);
  await enterProportions(page, { heightCm: 171.3 });
  assert.equal(await consent.isDisabled(), true, 'one measurement cannot create a ratio');
  await enterProportions(page, { armCm: 55.2 });
  assert.equal(await consent.isEnabled(), true, 'a complete pair enables consent without a photo');
  assert.equal(await consent.isChecked(), false);
  assert.equal(await reasons.count(), 0, 'an entered ratio is not used before recommendation consent');
  assert.equal(await guidance.isVisible(), false);

  await consent.check();
  await waitForRecommendations(page);
  const short = await proportionReasons(page, shortId).innerText();
  assert.match(short, manual);
  assert.match(short, shortSleeve);
  assert.equal(await proportionReasons(page, longId).count(), 0);
  assert.equal(await guidance.isVisible(), true);

  await enterProportions(page, { armCm: 69.2 });
  const long = await proportionReasons(page, longId).innerText();
  assert.match(long, manual);
  assert.match(long, longSleeve);
  assert.equal(await proportionReasons(page, shortId).count(), 0);
  assert.equal(await proportionReasons(page, noSleeveEvidence).count(), 0, 'a listed shirt without a verified sleeve feature gets no personalized label');
  assert.doesNotMatch(short + long, /171[.,]3|55[.,]2|69[.,]2/);
  assert.equal(await page.locator('#shopping-query').inputValue(), '상의', 'personalization does not replace the requested clothing category');
  const official = await page.locator('#shopping-search-results a').evaluateAll(links => links.map(link => decodeURIComponent(link.href)));
  assert.ok(official.length >= 4 && official.every(url => !/171[.,]3|55[.,]2|69[.,]2/.test(url)), 'external search addresses omit entered measurements');
  if (lang === 'ko' && page.viewportSize().width === 390) {
    await page.locator(`#shopping-discovery [data-discovery-id="${longId}"]`).screenshot({
      path: path.join(out, 'manual-proportion-seller-evidence-ko-390.png'), style: 'header{visibility:hidden!important}' });
  }

  await consent.uncheck();
  await waitForRecommendations(page);
  await assertMeasurementsErased(page);
  assert.equal(await consent.isDisabled(), true);
  assert.equal(await reasons.count(), 0);
  assert.equal(await guidance.isVisible(), false);
}

async function verifyPhotoMeasurementPriority(page, lang) {
  const consent = page.locator('#shopping-analysis-consent');
  const summary = page.locator('.shopping-proportion-summary');
  const photo = summary.locator('section', { has: page.getByRole('heading', {
    name: lang === 'ko' ? '사진상 추정 비율' : 'Estimated from the photo', exact: true }) });
  const manual = summary.locator('section', { has: page.getByRole('heading', {
    name: lang === 'ko' ? '직접 입력 치수로 계산한 비율' : 'Calculated from entered measurements', exact: true }) });
  const shoulder = lang === 'ko' ? '어깨 / 골반 너비' : 'Shoulder / hip width';
  const leg = lang === 'ko' ? '하체 / 상체 길이' : 'Leg / upper-body length';
  const waistband = lang === 'ko' ? /상품 표기 허리 밴딩/ : /Listed Elastic waist/;
  const manualBasis = lang === 'ko' ? /직접 입력 치수로 계산/ : /Calculated from measurements you entered/;
  assert.equal(await photo.getByText(shoulder, { exact: true }).count(), 1);
  assert.equal(await consent.isChecked(), true);

  const measured = { shoulderWidthCm: 34, hipWidthCm: 45, waistCircumferenceCm: 78.1, hipCircumferenceCm: 96.4 };
  await enterProportions(page, measured);
  assert.equal(await photo.getByText(shoulder, { exact: true }).count(), 0);
  assert.equal(await manual.getByText(shoulder, { exact: true }).count(), 1);
  assert.equal(await photo.getByText(leg, { exact: true }).count(), 1, 'an unmatched photo ratio remains available');
  for (const id of ['musinsa-1168906', 'musinsa-4644434']) {
    assert.ok(observations.products.find(product => product.id === id).observedFeatures.includes('히든 밴딩'));
    const exactReason = await proportionReasons(page, id).locator('li').filter({ hasText: waistband }).innerText();
    assert.match(exactReason, manualBasis);
    assert.doesNotMatch(exactReason, /78[.,]1|96[.,]4|높은 허리선|High rise/);
  }

  await page.locator('#shopping-proportion-reset').click();
  await waitForRecommendations(page);
  await assertMeasurementsErased(page);
  assert.equal(await manual.count(), 0);
  assert.equal(await photo.getByText(shoulder, { exact: true }).count(), 1);
  assert.equal(await consent.isChecked(), true, 'clearing manual entries preserves authorized photo proportions');
  assert.equal(await page.locator('#shopping-discovery [data-proportion-reasons] li').filter({ hasText: waistband }).count(), 0);
  await enterProportions(page, measured);
}

function ids(locator) {
  return locator.locator('[data-discovery-id]').evaluateAll(cards => cards.map(card => card.dataset.discoveryId));
}

async function showOfficialSearch(page) {
  await page.locator('#shopping-search-results').evaluate(el => {
    const details = el.closest('details');
    if (details) details.open = true;
  });
}

async function showFilters(page) {
  await page.locator('#shopping-product-filters').evaluate(el => {
    const details = el.closest('details');
    if (details) details.open = true;
  });
}

async function verify(browser, width, height, lang) {
  const context = await browser.newContext({ viewport: { width, height },
    hasTouch: true, isMobile: true, locale: lang === 'ko' ? 'ko-KR' : 'en-US' });
  const requests = [], pageErrors = [], routeErrors = [];
  const chosenId = 'musinsa-1168906';
  const chosenUrl = observations.products.find(p => p.id === chosenId).productUrl;
  try {
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      try {
        assert.equal(request.method(), 'GET');
        assert.equal(request.postData(), null);
        if (url.origin !== origin) {
          // Metadata ranking and links can work even if a seller image is unavailable.
          // Never contact these hosts in the automated browser test.
          if (!request.isNavigationRequest() && approvedImageUrls.has(url.href)) {
            assert.equal(request.headers().referer, undefined);
            await route.abort('blockedbyclient');
            return;
          }
          assert.equal(request.isNavigationRequest(), true);
          assert.equal(url.href, chosenUrl);
          requests.push(url.href);
          await route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Intercepted official product link</title>' });
          return;
        }
        assert.ok(!url.pathname.startsWith('/api/'));
        for (const [key,value] of url.searchParams) {
          assert.equal(key,'v');
          assert.match(value,/^[a-z0-9-]+$/);
        }
        requests.push(url.pathname);
        if (await pagesRedirect(route, url)) return;
        const file = path.resolve(root, pagesPath(url));
        assert.ok(file.startsWith(root + path.sep));
        if (url.pathname === '/favicon.ico' && !fs.existsSync(file)) {
          await route.fulfill({ status: 204, body: '' });
          return;
        }
        await route.fulfill({ body: fs.readFileSync(file),
          contentType: mime[path.extname(file)] || 'application/octet-stream' });
      } catch (error) {
        routeErrors.push(error.message);
        await route.abort('blockedbyclient').catch(() => {});
      }
    });
    const page = await context.newPage();
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.addInitScript(() => {
      Object.defineProperty(navigator,'clipboard',{configurable:true,value:{
        writeText: async text => { window.copiedSearch = text; }
      }});
    });
    if (!realPose) await page.addInitScript(mockPose);

    await page.goto(origin + '/', { waitUntil: 'networkidle' });
    await page.evaluate(language => A1I18n.setLanguage(language), lang);
    assert.equal(await page.locator('#main-fitting-studio #ai-photo').count(),1);
    assert.equal(await page.locator('#shopping-search').isVisible(), true);
    assert.equal(await page.locator('#avatar-root').count(), 0);
    if(lang==='ko'){
      await search(page,'여름 티셔츠');
      const summer=page.locator('#shopping-discovery [data-discovery-id]');
      assert.deepEqual(await summer.evaluateAll(cards=>cards.map(card=>card.dataset.discoveryId).sort()),['musinsa-3765431','musinsa-996498']);
      assert.match(await summer.first().innerText(),/여름.*반소매/);
      await summer.first().locator('details summary').click();
      assert.match(await summer.first().innerText(),/소재 미확인|소재 면/);
      assert.ok((await summer.first().locator('[data-discovery-source]').getAttribute('href')).startsWith('https://www.musinsa.com/products/'));
      await showFilters(page);
      await page.locator('#shopping-season').selectOption('winter');
      await waitForRecommendations(page);
      assert.equal(await summer.count(),0);
      await page.locator('#shopping-destination').selectOption('GB');
      assert.equal(await page.locator('#shopping-discovery').isVisible(),false);
      const hosts=await page.locator('#shopping-search-results a').evaluateAll(links=>links.map(a=>new URL(a.href).hostname));
      assert.ok(hosts.includes('www.amazon.co.uk'));
      assert.ok(hosts.every(host=>['www.amazon.co.uk','www.ebay.co.uk'].includes(host)));
      await page.locator('#shopping-destination').selectOption('KR');
      await page.locator('#shopping-season').selectOption('');
      await search(page,'');
    }

    const discovery = page.locator('#shopping-discovery');
    await page.locator('[data-shopping-preset="남성 검정 슬랙스 5만원 이하"]').click();
    assert.equal(await page.locator('#shopping-query').inputValue(), '남성 검정 슬랙스 5만원 이하');
    await page.waitForFunction(() => document.querySelector('#shopping-discovery')?.dataset.state === 'ready');
    assert.deepEqual((await ids(discovery)).sort(), [chosenId, 'musinsa-4644434']);
    await search(page, '남성 검정 슬랙스 5만원 이하 secretword');
    assert.deepEqual((await ids(discovery)).sort(), [chosenId, 'musinsa-4644434']);
    assert.match(await discovery.innerText(), /49,900/);
    assert.match(await discovery.innerText(), lang === 'ko' ? /재고 미확인/ : /stock (?:unknown|unconfirmed)/i);
    assert.equal(await discovery.locator('[data-discovery-buy="'+chosenId+'"]').getAttribute('href'), chosenUrl);
    assert.equal(await discovery.evaluate(section => Boolean(
      section.compareDocumentPosition(document.querySelector('#shopping-search-results')) & Node.DOCUMENT_POSITION_FOLLOWING
    )), true, 'actual product candidates precede generic store searches');
    await showOfficialSearch(page);
    const links = page.locator('#shopping-search-results a');
    const hrefs = await links.evaluateAll(items => items.map(item => item.href));
    assert.ok(hrefs.length >= 4);
    for (const href of hrefs) assert.doesNotMatch(decodeURIComponent(href), /secretword|50000|50,000|metrics|photo/);
    assert.equal(new URL(hrefs[0]).searchParams.get('keyword'),'남성 검정 슬랙스');
    await page.locator('#shopping-search-results [data-preview-copy=copyTerm]').first().click();
    assert.equal(await page.evaluate(() => window.copiedSearch), '남성 검정 슬랙스');

    await search(page, '여성 흰색 셔츠 4만원 이하');
    assert.deepEqual(await ids(discovery), ['29cm-3487996']);
    assert.match(await discovery.innerText(), /39,900/);
    await showFilters(page);
    const size = page.locator('#shopping-size');
    await size.fill('XS');
    await page.waitForFunction(() => document.querySelector('#shopping-discovery')?.dataset.state === 'ready');
    assert.deepEqual(await ids(discovery), [], 'confirmed S/M/L labels do not match XS');
    await size.fill('M');
    await page.waitForFunction(() => document.querySelector('#shopping-discovery')?.dataset.state === 'ready');
    assert.deepEqual(await ids(discovery), ['29cm-3487996']);
    await size.fill('');

    const budget = page.locator('#shopping-budget');
    await budget.fill('35000');
    await page.waitForFunction(() => document.querySelector('#shopping-discovery')?.dataset.state === 'ready');
    assert.deepEqual(await ids(discovery), [], 'the form budget narrows the query ceiling');
    await budget.fill('45000');
    await search(page, '여성 흰색 셔츠 3만원 이하');
    assert.deepEqual(await ids(discovery), [], 'the form budget cannot relax a stricter query ceiling');
    await budget.fill('');

    await search(page, '여성 흰색 셔츠 출근용 4만원 이하');
    assert.deepEqual(await ids(discovery), [], 'an explicitly described pajama top is not workwear');

    await search(page, '여성 네이비 가디건 10만원 이하');
    const priceUnconfirmed = discovery.locator('.product-discovery-unknown');
    assert.deepEqual(await ids(priceUnconfirmed), ['29cm-4145774']);
    assert.equal(await discovery.getAttribute('data-count'), '0', 'an unknown price cannot be counted as within budget');

    await search(page, '남성 검정 코트 5만원 이하');
    assert.deepEqual(await ids(discovery), []);
    await showOfficialSearch(page);
    assert.equal(await links.first().isVisible(), true, 'official search addresses remain available when the catalog has no match');

    await search(page, '남성 검정 슬랙스 5만원 이하');
    await page.locator('#shopping-style-button').click();
    const generic = await page.locator('#shopping-style-advice').innerText();
    assert.match(generic, lang === 'ko' ? /규칙 기반/ : /rule-based/);
    await verifyManualRecommendations(page, lang);
    await search(page, '남성 검정 슬랙스 5만원 이하');

    await page.locator('#ai-photo').setInputFiles(path.join(root,'assets/photos/man.jpg'));
    await page.locator('#ai-analyze').click();
    await page.waitForFunction(() => !document.querySelector('#ai-result').hidden);
    if (realPose) assert.ok(requests.some(value => /pose_solution_packed_assets\.data$|pose_landmark_lite\.tflite$/.test(value)));
    assert.equal(await page.locator('#shopping-analysis-consent').isChecked(), false);
    await page.locator('#shopping-analysis-consent').check();
    await page.locator('#shopping-style-button').click();
    assert.notEqual(await page.locator('#shopping-style-advice').innerText(), generic);
    await verifyPhotoMeasurementPriority(page, lang);
    await page.locator('#shopping-analysis-consent').uncheck();
    await waitForRecommendations(page);
    assert.equal(await page.locator('#shopping-style-advice').innerText(), '');
    await assertMeasurementsErased(page);
    assert.equal(await discovery.locator('[data-proportion-reasons]').count(), 0);

    await search(page, '남성 검정 슬랙스 5만원 이하');
    await discovery.screenshot({ path: path.join(out, `recommendations-${lang}-${width}.png`),
      style: 'header{visibility:hidden!important}' });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(await page.evaluate(() => Object.keys(sessionStorage)), []);
    assert.deepEqual(await page.evaluate(() => Object.keys(localStorage)), ['a1-fashion:language']);
    await page.locator('#ai-clear').click();
    assert.equal(await page.locator('#shopping-analysis-consent').isDisabled(), true);
    assert.equal(await page.locator('.shopping-proportion-summary').isVisible(), false);

    await discovery.locator('[data-discovery-buy="'+chosenId+'"]').click();
    assert.equal(page.url(), chosenUrl);
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(routeErrors, []);
    console.log(`Shopping ${lang} ${width}x${height}: published product recommendations, known and unknown prices, empty results, merchant links, ${realPose ? 'real MediaPipe' : 'mocked pose'} and photo privacy passed.`);
  } finally {
    await context.close();
  }
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  try {
    const one = process.env.A1_SHOPPING_ONE || realPose;
    for (const [width,height] of (one ? [[390,844]] : [[820,1180],[1180,820],[390,844]])) {
      for (const lang of (one ? ['ko'] : ['ko','en'])) await verify(browser, width, height, lang);
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
