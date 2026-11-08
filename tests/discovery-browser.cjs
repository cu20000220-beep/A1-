/* No client flag, legacy catalog or free result may grant premium access. */
'use strict';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ locale: 'ko-KR', viewport: { width: 390, height: 844 } }), errors = [], requests = [];
    const base = process.env.A1_TEST_URL || 'http://127.0.0.1:8000/';
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => requests.push(request));
    await page.addInitScript(() => {
      localStorage.setItem('a1-subscription', 'active');
      localStorage.setItem('a1-paid', 'true');
      localStorage.setItem('a1-trial-start', String(Date.now()));
      window.A1OwnProducts = [{ id:'old-own', name:'과거 계획', source:'own', price:10000 }];
      window.A1Catalog = { products:[{ id:'injected', name:'주입 상품', source:'example', price:10000 }] };
    });
    await page.goto(base);
    assert.equal(await page.locator('#membership .membership-plan').count(), 3);
    assert.equal(await page.locator('[data-site-navigation] a[data-site-link="shopping"][href="global.html#shopping"]').count(), 1);
    assert.equal(await page.locator('#membership button:disabled').count(), 2);
    assert.match(await page.locator('.plan-price').innerText(), /무료/);
    assert.match(await page.locator('.plan-pending').first().innerText(), /월 구독료 준비 중/);
    assert.equal(await page.locator('.membership-pending:disabled').count(), 2);
    assert.match(await page.locator('.membership-badge').innerText(), /분석 무료 · 추천 구독/);
    assert.equal(await page.locator('input[type=email],input[type=tel],input[autocomplete=cc-number]').count(), 0);
    assert.equal(await page.getByRole('button', { name: /결제하기|구독하기|주문 확정/ }).count(), 0);
    assert.match(await page.locator('.membership-scope').innerText(), /외부 상품 목록·가격·재고를 자동으로 가져오는 연동은 아직 제공하지/);
    assert.equal(await page.locator('.card, #ai-shopping a, #a1-original').count(), 0);
    assert.ok(await page.locator('#premium-controls').isHidden());
    // Synthetic geometry tests the UI boundary only; actual model inference is tested separately.
    await page.evaluate(() => document.dispatchEvent(new CustomEvent('a1:analysis-ready', { detail:{ metrics:{ shoulderHipRatio:1.4, legTorsoRatio:1.8 } } })));
    assert.ok(await page.locator('#premium-lock').isVisible());
    assert.equal(requests.filter(r => (r.url().includes('/api/') && !r.url().endsWith('/api/policy'))).length, 0, 'free result never automatically requests a recommendation');
    for (const [code, error, expected] of [
      [401,'authentication_required',/로그인/], [403,'subscription_required',/유효한 구독/], [503,'setup_required',/준비 중/]
    ]) {
      await page.route('**/api/membership', route => route.fulfill({ status:code, contentType:'application/json', body:JSON.stringify({ allowed:false,error }) }));
      await page.locator('#premium-check').click();
      await page.waitForFunction(() => !document.querySelector('#premium-check').disabled);
      assert.match(await page.locator('#premium-status').innerText(), expected);
      assert.ok(await page.locator('#premium-controls').isHidden());
      assert.ok(await page.locator('#premium-results').isHidden());
      assert.equal(await page.locator('.card, #ai-shopping a').count(), 0);
      await page.unroute('**/api/membership');
    }
    await page.reload();
    assert.ok(await page.locator('#premium-lock').isVisible());
    assert.ok(await page.locator('#premium-recommend').isDisabled());
    assert.equal(requests.filter(r => r.url().includes('/api/recommendations')).length, 0);
    assert.equal(requests.filter(r => /\/(products|style-advisor|shop-search|own-products|catalog-rules)\.js/.test(r.url())).length, 0);
    assert.deepEqual(errors, []);
    console.log('PASS: free-analysis/paid-style policy, no billing activation, legacy client flags/catalog cannot grant access, 401/403/503 stay locked, no automatic paid request.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
