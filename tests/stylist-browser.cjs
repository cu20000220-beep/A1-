'use strict';
// Browser UI fixtures only. Server authorization, OpenAI grounding and D1 costs
// have separate tests. No provider, account, payment or real AI is contacted.
const assert = require('node:assert/strict');
const {createServer} = require('node:http');
const {readFile} = require('node:fs/promises');
const {resolve,extname} = require('node:path');
const {chromium} = require('playwright');
const root = resolve(__dirname,'..');
const requests = [], posts = [], errors = [];
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};
let plan='FREE', live=false, nextError=null, includeProducts=false, holdNext=false, held, resume, expiresIn=3600000;
let compareOffers;
function result(res,value,status=200){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'private, no-store'});res.end(JSON.stringify(value));}
const fixed = {productId:'fixture-shirt',brand:'Fixture Brand',name:'Verified fixture shirt',sku:'FIXTURE-SHIRT-01',color:'White',size:'M',condition:'new',price:40,currency:'USD',shipping:5,tax:3,duties:0,shippingCountries:['US','KR'],shippingStatus:'confirmed',stock:'in_stock',sourceVerified:true,source:'Approved official fixture; local UI test only',productUrl:'https://ebay.com/itm/local-test-only',retailerName:'Fixture retailer',retailerId:'ebay-us',sellerCountry:'US'};
const server = createServer(async(req,res)=>{
  try {
    const url = new URL(req.url,`http://${req.headers.host}`);
    if(url.pathname==='/api/stylist'){
      if(req.method==='GET')return result(res,{mode:live?'LIVE':'DEMO',available:true,liveEnabled:live,photoUploads:false,plans:{style:'GENERAL',compare:'PREMIUM',discount:'PREMIUM'}});
      assert.equal(req.method,'POST');assert.equal(req.headers.origin,url.origin);assert.equal(req.headers['content-type'],'application/json');
      let bytes='';for await(const chunk of req)bytes+=chunk;const value=JSON.parse(bytes);posts.push(value);
      if(plan==='FREE')return result(res,{error:'subscription_required'},403);
      if(value.intent!=='style'&&plan!=='PREMIUM')return result(res,{error:'premium_required'},403);
      if(nextError){const e=nextError;nextError=null;return result(res,{error:e.code},e.status);}
      if(live&&!value.consents.externalAI)return result(res,{error:'external_ai_consent_required'},409);
      const now=Date.now(),product={...fixed,id:'fixture-1',checkedAt:now-60000,expiresAt:now+3600000};
      const response={accessUntil:Date.now()+expiresIn,mode:live?'LIVE':'DEMO',reply:value.language==='en'?'Choose comfortable layers for your occasion.':'상황에 맞는 편안한 레이어를 골라보세요.',advice:[{id:'fit',text:value.language==='en'?'Try a balanced silhouette without treating photo proportions as measurements.':'사진상 비율을 실제 치수로 판단하지 않고 균형 잡힌 실루엣을 살펴보세요.'}],dataStatus:includeProducts?'ready':'empty',products:includeProducts?[product,{...product,id:'unsafe',name:'<img src=x onerror=alert(1)>',productUrl:'https://evil.example.test/steal'}]:[],searchLinks:[{store:'eBay',label:'eBay search',url:'https://www.ebay.com/sch/i.html?_nkw=shirt'},{store:'unsafe',url:'javascript:alert(1)',label:'must not appear'}],comparison:null,discounts:[],notices:[],usage:live?{reservedMicroUsd:1200,remainingUserRequests:9}:null};
      if(value.intent==='compare')response.comparison=compareOffers({product:fixed,destination:'US',currency:'USD',now,offers:[{...product,id:'valid'},{...product,id:'unknown-shipping',shipping:null},{...product,id:'stale',checkedAt:now-48*3600000},{...product,id:'different-size',size:'L'}]});
      if(value.intent==='discount')response.discounts=[{id:product.id,promotionPrice:30,currency:'USD',startsAt:now-3600000,endsAt:now+3600000}];
      if(holdNext){holdNext=false;held();await new Promise(resolve=>{resume=resolve;});}
      return result(res,response);
    }
    if(url.pathname==='/api/global/account')return result(res,{plan,subscription:{active:plan!=='FREE',accessUntil:Date.now()+3600000}});
    if(url.pathname==='/api/auth/config')return result(res,{enabled:false,ready:false});
    const file=url.pathname==='/'?'stylist.html':decodeURIComponent(url.pathname.slice(1)),full=resolve(root,file);
    if(!full.startsWith(root+'/')||!/^(?:(?:stylist|index|global|account|privacy)\.html|assets\/.+)$/.test(file)){res.writeHead(404);res.end();return;}
    const headers={'Content-Type':mime[extname(file)]||'application/octet-stream'};
    if(file==='stylist.html')headers['Content-Security-Policy']="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'";
    res.writeHead(200,headers);res.end(await readFile(full));
  }catch(error){res.writeHead(error.code==='ENOENT'?404:500);res.end();errors.push(error.message);}
});
async function send(page,message){await page.locator('#stylist-message').fill(message);await page.locator('#stylist-send').click();await page.waitForFunction(()=>!document.querySelector('#stylist-send').disabled);}
async function englishCheck(page){
  const missing=await page.evaluate(()=>{
    const texts=[],walk=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    while(walk.nextNode()){const el=walk.currentNode.parentElement;if(!el||el.closest('script,style,[data-i18n-ignore]')||!el.getClientRects().length)continue;const text=walk.currentNode.nodeValue.trim();if(/[가-힣]/.test(text))texts.push(text);}
    return texts;
  });assert.deepEqual(missing,[],'English public text has no untranslated Korean');
}
(async()=>{
  ({compareOffers}=await import('../server/price-comparison.mjs'));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  try {
    const context=await browser.newContext({locale:'ko-KR',viewport:{width:390,height:844}}),page=await context.newPage();
    page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push({url:r.url(),method:r.method()}));
    await page.goto(origin+'/stylist.html',{waitUntil:'networkidle'});
    assert.match(await page.locator('#stylist-config').innerText(),/DEMO/);
    const expectedNavigation={home:'index.html',studio:'index.html#ai-studio',shopping:'global.html#shopping',stylist:'stylist.html',comparison:'global.html#comparison',membership:'global.html#membership',account:'account.html'};
    assert.deepEqual(await page.locator('[data-site-navigation] a').evaluateAll(nodes=>Object.fromEntries(nodes.map(n=>[n.dataset.siteLink,n.getAttribute('href')]))),expectedNavigation,'Every main menu points to the integrated feature');
    assert.equal(await page.locator('input[type=file]').count(),0);
    assert.equal(await page.locator('#stylist-external-consent').isChecked(),false);assert.equal(await page.locator('#stylist-analysis-consent').isChecked(),false);
    assert.equal(await page.locator('[name=shoulderHipRatio]').isDisabled(),true);
    await send(page,'추천해주세요');assert.match(await page.locator('#stylist-status').innerText(),/구독/);assert.equal(await page.locator('.stylist-message').count(),0);
    plan='GENERAL';await send(page,'출근할 때 입을 옷을 추천해주세요');
    assert.match(await page.locator('#stylist-chat').innerText(),/DEMO/);assert.match(await page.locator('#stylist-chat').innerText(),/검증 상품이 없습니다/);assert.equal(posts.at(-1).consents.externalAI,false);assert.equal(posts.at(-1).consents.analysis,false);assert.equal(posts.at(-1).metrics,undefined);
    assert.equal(await page.locator('#stylist-chat a').count(),1);assert.equal(await page.locator('#stylist-chat a').getAttribute('href'),'https://www.ebay.com/sch/i.html?_nkw=shirt');
    await page.locator('[name=intent]').selectOption('compare');await send(page,'가격을 비교해주세요');assert.match(await page.locator('#stylist-status').innerText(),/프리미엄/);assert.equal(await page.locator('.stylist-message').count(),0,'Higher-tier rejection clears prior private replies');
    plan='PREMIUM';includeProducts=true;await send(page,'같은 상품 가격 비교');
    const comparison=await page.locator('.stylist-comparison').innerText();assert.match(comparison,/48/);assert.match(comparison,/미확인/);assert.match(comparison,/최저가 선정에서 제외/);assert.match(comparison,/사이즈/);
    assert.ok(await page.locator('#stylist-chat a[href^="https://ebay.com/itm/"]').count()>0,'Approved retailer bare domains remain usable');assert.equal(await page.locator('#stylist-chat img').count(),0,'Untrusted text is not injected as HTML');assert.equal(await page.locator('#stylist-chat a[href*="evil"]').count(),0);
    await page.locator('[name=intent]').selectOption('discount');await send(page,'확인된 할인만 알려주세요');assert.match(await page.locator('#stylist-chat').innerText(),/USD/);assert.match(await page.locator('#stylist-chat').innerText(),/적용 기간/);
    assert.equal(posts.at(-1).history.length,2);assert.ok(posts.at(-1).history.every(row=>['user','assistant'].includes(row.role)&&row.content.length<=1200));
    await page.locator('details').evaluate(e=>e.open=true);await page.locator('#stylist-analysis-consent').check();await page.locator('[name=shoulderHipRatio]').fill('1.1');await page.locator('[name=legTorsoRatio]').fill('1.6');await page.locator('[name=intent]').selectOption('style');await send(page,'두 비율도 참고해주세요');assert.deepEqual(posts.at(-1).metrics,{shoulderHipRatio:1.1,legTorsoRatio:1.6});
    await page.locator('#stylist-analysis-consent').uncheck();await send(page,'수치는 사용하지 말아주세요');assert.equal(posts.at(-1).metrics,undefined);assert.equal(posts.at(-1).consents.analysis,false);
    await page.locator('#stylist-clear').click();assert.equal(await page.locator('.stylist-message').count(),0);assert.equal(await page.locator('[name=shoulderHipRatio]').inputValue(),'');assert.equal(await page.locator('#stylist-external-consent').isChecked(),false);
    live=true;await page.reload({waitUntil:'networkidle'});await send(page,'실제 GPT 상담');assert.match(await page.locator('#stylist-status').innerText(),/별도로 동의/);assert.equal(await page.locator('.stylist-message').count(),0);
    await page.locator('#stylist-external-consent').check();await send(page,'실제 상담에 동의합니다');assert.equal(posts.at(-1).consents.externalAI,true);assert.match(await page.locator('#stylist-chat').innerText(),/GPT ·/);assert.match(await page.locator('#stylist-chat').innerText(),/남은 상담: 9/);assert.doesNotMatch(await page.locator('#stylist-chat').innerText(),/0.001200/);
    for(const failure of [{status:400,code:'invalid_request'},{status:429,code:'budget_exhausted'},{status:502,code:'invalid_model_response'},{status:503,code:'setup_required'}]){const count=posts.length;nextError=failure;await send(page,'오류 처리 확인');assert.equal(posts.length,count+1,'No automatic extra OpenAI-style request');assert.ok(await page.locator('#stylist-status').evaluate(e=>e.classList.contains('is-error')));if(failure.status===400)assert.match(await page.locator('#stylist-status').innerText(),/링크/);}
    for(const lang of ['ko','en']){
      await page.locator('[data-language-select]').selectOption(lang);await page.locator('details').evaluate(e=>e.open=true);
      if(lang==='en')await englishCheck(page);
      for(const width of [320,390,820,1440]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${lang} ${width}px must not overflow`);}
    }
    // Follow the actual menus across pages. The saved language must survive
    // navigation; same-page global menu links must activate the existing panels.
    const navigation=await context.newPage();
    for(const [name,href] of Object.entries(expectedNavigation)){
      await navigation.goto(origin+'/stylist.html',{waitUntil:'networkidle'});
      await navigation.locator(`[data-site-link="${name}"]`).click();
      await navigation.waitForURL(origin+'/'+href);
      await navigation.waitForFunction(()=>document.documentElement.lang==='en'&&document.querySelectorAll('[data-site-navigation] a').length===7);
      assert.match(await navigation.locator('[data-site-navigation]').innerText(),/AI STYLIST/);
      assert.equal(await navigation.locator('[data-site-navigation] a[aria-current=page]').getAttribute('data-site-link'),name);
    }
    await navigation.goto(origin+'/global.html#shopping',{waitUntil:'networkidle'});
    for(const target of ['comparison','membership','shopping']){
      await navigation.locator(`[data-site-link="${target}"]`).click();
      assert.equal(await navigation.locator(`[data-panel="${target}"]`).isVisible(),true,'Same-page service link must activate its panel');
    }
    await navigation.close();
    // Paid results cannot survive their server-confirmed period or appear from
    // a reply whose entitlement expired while the network response was held.
    live=false;expiresIn=700;await page.locator('[name=intent]').selectOption('style');
    await send(page,'Expiry timer check');assert.ok(await page.locator('.stylist-message').count()>0);
    await page.waitForFunction(()=>document.querySelectorAll('.stylist-message').length===0);
    assert.match(await page.locator('#stylist-status').innerText(),/subscription period ended/);
    expiresIn=100;holdNext=true;const expiringReply=new Promise(resolve=>{held=resolve;});
    await page.locator('#stylist-message').fill('Expired network reply');await page.locator('#stylist-send').click();await expiringReply;await page.waitForTimeout(150);resume();
    await page.waitForFunction(()=>!document.querySelector('#stylist-send').disabled);assert.equal(await page.locator('.stylist-message').count(),0,'An expired reply cannot expose paid text, products, searches or comparisons');
    expiresIn=3600000;await send(page,'Focus entitlement refresh');assert.ok(await page.locator('.stylist-message').count()>0);
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));assert.equal(await page.locator('.stylist-message').count(),0,'Returning to a session requires fresh server entitlement');
    // The real child page accepts only its exact opener + origin + one-use
    // nonce. It imports two numbers without making that import consent.
    const parent=await context.newPage();await parent.goto(origin,{waitUntil:'networkidle'});
    await parent.evaluate(()=>{window.__nonce='123e4567-e89b-42d3-a456-426614174000';window.addEventListener('message',event=>{if(event.origin===location.origin&&event.data?.type==='a1:request-analysis'&&event.data.nonce===window.__nonce)event.source.postMessage({type:'a1:analysis-transfer',nonce:window.__nonce,metrics:{shoulderHipRatio:1.1,legTorsoRatio:1.6}},location.origin);});});
    const opened=parent.waitForEvent('popup');await parent.evaluate(()=>{window.__child=window.open('stylist.html#analysis='+window.__nonce);});const child=await opened;await child.waitForLoadState('networkidle');
    assert.equal(await child.locator('[name=shoulderHipRatio]').inputValue(),'1.1');assert.equal(await child.locator('[name=legTorsoRatio]').inputValue(),'1.6');assert.equal(await child.locator('#stylist-analysis-consent').isChecked(),false);assert.equal(await child.locator('[name=shoulderHipRatio]').isDisabled(),true);assert.equal(new URL(child.url()).hash,'','Nonce does not remain in URL history');
    await parent.evaluate(()=>window.__child.postMessage({type:'a1:analysis-transfer',nonce:window.__nonce,metrics:{shoulderHipRatio:2,legTorsoRatio:2}},location.origin));await child.waitForTimeout(50);assert.equal(await child.locator('[name=shoulderHipRatio]').inputValue(),'1.1','A repeated transfer cannot replace imported proportions');
    await child.evaluate(()=>window.postMessage({type:'a1:analysis-cleared',nonce:'123e4567-e89b-42d3-a456-426614174000'},location.origin));await child.waitForTimeout(50);assert.equal(await child.locator('[name=shoulderHipRatio]').inputValue(),'1.1','A message from the child itself is not the opener');
    await parent.evaluate(()=>window.__child.postMessage({type:'a1:analysis-cleared',nonce:window.__nonce},location.origin));await child.waitForFunction(()=>document.querySelector('[name=shoulderHipRatio]').value==='');await child.close();await parent.close();
    // Withdrawing external consent during a pending request clears local
    // context and prevents the late result from returning to the conversation.
    await page.locator('[name=intent]').selectOption('style');await page.locator('#stylist-external-consent').check();holdNext=true;const consentHeld=new Promise(resolve=>{held=resolve;});await page.locator('#stylist-message').fill('Consent withdrawal during request');await page.locator('#stylist-send').click();await consentHeld;await page.locator('#stylist-external-consent').uncheck();await page.waitForFunction(()=>!document.querySelector('#stylist-send').disabled);resume();await page.waitForTimeout(100);assert.equal(await page.locator('.stylist-message').count(),0);assert.match(await page.locator('#stylist-status').innerText(),/withdrawn/);
    // A real same-origin sibling tab storage event must clear private content
    // and invalidate a held authorized response, including the busy state.
    live=false;holdNext=true;const started=new Promise(resolve=>{held=resolve;});await page.locator('#stylist-message').fill('Private pending conversation');await page.locator('#stylist-send').click();await started;
    const sibling=await context.newPage();await sibling.goto(origin,{waitUntil:'networkidle'});await sibling.evaluate(()=>localStorage.setItem('a1-fashion:auth-event',JSON.stringify({action:'logout',at:Date.now()})));
    await page.waitForFunction(()=>!document.querySelector('#stylist-send').disabled&&document.querySelectorAll('.stylist-message').length===0);resume();await page.waitForTimeout(150);assert.equal(await page.locator('.stylist-message').count(),0);assert.equal(await page.locator('#stylist-message').inputValue(),'');assert.equal(await page.locator('#stylist-analysis-consent').isChecked(),false);
    const storage=await page.evaluate(()=>Object.keys(localStorage).filter(key=>!['a1-fashion:language','a1-fashion:auth-event'].includes(key)));assert.deepEqual(storage,[],'Chat/profile data must not be stored in localStorage');
    await page.reload({waitUntil:'networkidle'});assert.match(await page.locator('#stylist-config').innerText(),/DEMO/);await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/a1-stylist-mobile.png',fullPage:true});
    assert.ok(requests.every(request=>new URL(request.url).origin===origin),'Browser makes no external AI, image or translation requests');assert.ok(posts.every(body=>!Object.keys(body).some(key=>/photo|image|key|email/i.test(key))));assert.deepEqual(errors,[]);
    console.log('Stylist UI passed: server-tier UI fixtures, DEMO/no actual GPT, verified fixture products, safe links/text, Premium comparisons, separate external/analysis consent, memory-only history, errors without retries, cross-tab logout cancels late replies, KO/EN at 320/390/820/1440px, shared seven-menu navigation/language persistence, expiry timer/late reply/focus guards. No provider requests.');
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
