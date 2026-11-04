/* Own-product fixtures are injected only in this test and never published. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    const base = process.env.A1_TEST_URL || 'http://127.0.0.1:8002/A1-/';
    const page = await browser.newPage({viewport:{width:820,height:1180}});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base);
    assert.equal(await page.evaluate(() => window.A1Catalog.ownProducts.length), 0);
    assert.equal(await page.locator('#cards .card').count(), 12);
    assert.match(await page.locator('#own-launch-status').innerText(), /실제 상품은 아직 없으며/);
    await page.locator('#source').selectOption('own');
    assert.equal(await page.locator('#cards .card').count(), 0);
    assert.match(await page.locator('#empty-title').innerText(), /자사 컬렉션을 준비/);
    await page.locator('#reset').click();
    assert.equal(await page.locator('#cards .card').count(), 12);
    await page.locator('#own-collection-link').click();
    assert.equal(await page.locator('#source').inputValue(), 'example');
    for (const [width,height] of [[820,1180],[390,844],[320,740]]) {
      await page.setViewportSize({width,height});
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow ${width}`);
    }

    const fixture = {source:'own',id:'own-test-shirt',name:'테스트 전용 자사 셔츠',gender:'유니섹스',category:'상의',style:'미니멀',price:65000,photo:'assets/photos/casual.jpg',availability:'preparing'};
    await page.route('**/assets/own-products.js', route => route.fulfill({contentType:'application/javascript',body:`window.A1OwnProducts=${JSON.stringify([fixture,{...fixture,id:'own-test-sold',availability:'soldOut'},{...fixture,id:'own-invalid',price:-1}])};`}));
    await page.reload();
    assert.equal(await page.evaluate(() => window.A1Catalog.ownProducts.length), 2);
    assert.equal(await page.evaluate(() => window.A1Catalog.registrationErrors.length), 1);
    await page.locator('#source').selectOption('own');
    assert.equal(await page.locator('#cards .card').count(), 2);
    assert.match(await page.locator('#cards .card-tag').first().innerText(), /A1 자사 상품/);
    await page.locator('[data-detail="own-test-shirt"]').first().click();
    assert.equal(await page.locator('#detail-title').innerText(), fixture.name);
    assert.match(await page.locator('#detail-content').innerText(), /등록 예정/);
    assert.match(await page.locator('.detail-note').innerText(), /주문이 접수되지 않습니다/);
    assert.equal(await page.locator('#detail [data-look]').count(), 0, 'own products cannot inherit a fabricated sample fitting photo');
    assert.equal(await page.getByRole('button',{name:/구매|주문 확정|결제/}).count(), 0);
    await page.locator('[data-own-analysis]').click();
    assert.ok(await page.locator('#detail').isHidden());

    await page.locator('#ai-photo').setInputFiles(path.join(__dirname,'../assets/photos/man.jpg'));
    await page.locator('#ai-gender').selectOption('남성');
    await page.locator('#ai-style').selectOption('미니멀');
    await page.locator('#ai-budget').selectOption('100000');
    await page.locator('#ai-analyze').click();
    await page.waitForFunction(() => document.querySelector('#ai-output').getAttribute('aria-busy') === 'false', {}, {timeout:150000});
    assert.match(await page.locator('#ai-status').innerText(), /완료했습니다/);
    assert.equal(await page.locator('#ai-cards [data-detail]').first().getAttribute('data-detail'), fixture.id);
    assert.equal(await page.locator('#ai-cards [data-detail="own-test-sold"]').count(), 0);
    assert.match(await page.locator('#ai-own-status').innerText(), /자사 상품 1개/);
    await page.locator('#ai-style').selectOption('클래식');
    await page.locator('#ai-analyze').click();
    assert.match(await page.locator('#ai-own-status').innerText(), /조건에 맞는 자사 상품이 없습니다/);
    assert.deepEqual(errors, []);
    console.log('PASS: honest empty own collection, source filter, validated test-only registration, own details without invented specs, no checkout, real-ML own-first matching, sold-out exclusion and preference constraints.');
  } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
