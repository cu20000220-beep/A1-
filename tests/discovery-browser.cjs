/* Prelaunch preview must not imply an active trial, selling clothes or active subscriptions. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const base=process.env.A1_TEST_URL||'http://127.0.0.1:8000/';
  const page=await browser.newPage({viewport:{width:820,height:1180}}), errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r));
  // A legacy own catalog must not silently re-enable direct selling.
  await page.addInitScript(()=>{window.A1OwnProducts=[{source:'own',id:'own-legacy',name:'과거 계획',price:10000,photo:'assets/photos/man.jpg'}]});
  await page.goto(base);
  assert.equal(await page.locator('#a1-original').count(),0);
  assert.equal(await page.locator('#source').count(),0);
  assert.equal(await page.locator('#membership .membership-plan').count(),2);
  assert.match(await page.locator('#beta-title').innerText(),/7일 무료 체험/);
  assert.match(await page.locator('.plan-price').innerText(),/7일/);
  assert.match(await page.locator('.preview-status').innerText(),/아직 회원별 7일 체험이나 유료 이용권이 적용된 상태가 아닙니다/);
  assert.match(await page.locator('.plan-pending').innerText(),/월 구독료·혜택 준비 중/);
  assert.ok(await page.locator('.membership-pending').evaluateAll(buttons=>buttons.length===2&&buttons.every(b=>b.disabled)));
  assert.equal(await page.locator('input[type=email],input[type=tel],input[autocomplete=cc-number]').count(),0);
  assert.equal(await page.getByRole('button',{name:/구매|결제하기|구독하기|주문 확정/}).count(),0);
  assert.equal(await page.evaluate(()=>window.A1Catalog.products.length),12);
  assert.ok(await page.evaluate(()=>window.A1Catalog.products.every(p=>p.source==='example')));
  assert.equal(requests.filter(r=>r.url().includes('/own-products.js')).length,0);
  assert.match(await page.locator('.membership-scope').innerText(),/개별 상품을 자동 매칭하는 연동은 아직 제공하지/);
  assert.match(await page.locator('.membership-scope').innerText(),/구독의 취소·환불은 A1/);
  // Client-local flags cannot turn this planned service into an active paid plan.
  await page.evaluate(()=>localStorage.setItem('a1-subscription','active'));
  await page.reload();assert.ok(await page.locator('.membership-pending').evaluateAll(buttons=>buttons.length===2&&buttons.every(b=>b.disabled)));
  await page.locator('.preview-link').click();
  await page.waitForFunction(()=>location.hash==='#ai-studio');
  assert.ok(await page.locator('#ai-photo').isEnabled());
  for(const [width,height]of [[1440,1000],[820,1180],[390,844],[320,740]]){
   await page.setViewportSize({width,height});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow ${width}`);
   await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`/tmp/a1-discovery-${width}.png`,fullPage:true});
  }
  assert.deepEqual(errors,[]);
  assert.ok(requests.every(r=>r.method()==='GET'&&new URL(r.url()).origin===new URL(base).origin));
  console.log('PASS: honest prelaunch preview, 7-day policy without fake active trial/billing/PII/paid flags, no direct sale, working preview entry, no external requests, desktop/tablet/mobile layouts.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
