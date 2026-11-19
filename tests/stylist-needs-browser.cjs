'use strict';
// Synthetic, locally routed permission data only. Never added to the public catalog.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {compileCatalog}=require('../scripts/lib/product-catalog.cjs');
const {catalogPublicHeaders}=require('../scripts/lib/catalog-public-headers.cjs');
const root=path.resolve(__dirname,'..'),origin='https://stylist-needs.a1fashion.pages.dev',out='/workspace/work/stylist-needs';
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.jpg':'image/jpeg','.json':'application/json'};
function fixture(now=Date.now()){
 const approval={id:'STYLIST-LOCAL-ONLY',seller:'Synthetic stylist test seller',domains:['retailer.example'],imageDomains:['images.retailer.example'],rightsConfirmed:true,displayApproved:true,validUntil:new Date(now+3600000).toISOString(),evidenceRef:'LOCAL TEST ONLY — NOT REAL SELLER PERMISSION',sourceUrl:'https://retailer.example/catalog.csv',retentionHours:1};
 const base={approvalId:approval.id,brand:'Synthetic stylist brand',category:'bottoms',type:'trousers',color:'black',styles:['minimal'],occasions:['work'],gender:'men',price:150000,currency:'KRW',sizes:['M'],sizeChart:{unit:'cm',kind:'garment',rows:[{size:'M',waist:80,inseam:76}]},imageUrl:'https://images.retailer.example/stylist-test.jpg',retailer:approval.seller,sourceUrl:approval.sourceUrl,permissionChecked:true,lastChecked:new Date(now-1000).toISOString(),stock:'in_stock',tags:['relaxed'],designTagsComplete:true};
 const variants=[['TROUSERS',{}],['WHITE',{color:'white',price:30000}],['TOP',{category:'tops',type:'shirt',price:50000}],['SIZE-L',{sizes:['L'],sizeChart:{unit:'cm',kind:'garment',rows:[{size:'L',waist:84}]}}]];
 return compileCatalog({version:1,products:variants.map(([id,values])=>({...base,id:'SYNTHETIC-NEEDS-'+id,name:'Synthetic stylist garment '+id,purchaseUrl:'https://retailer.example/items/'+id,...values}))},{version:1,sources:[approval]},{now,inspect:true}).snapshot;
}
async function routeContext(context,snapshot,requests){
 const headers=catalogPublicHeaders(fs.readFileSync(path.join(root,'_headers'),'utf8'),snapshot.products),csp=headers.split('/stylist*\n')[1].split('\n\n')[0].match(/Content-Security-Policy: (.*)/)[1];
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());requests.push({url:url.href,method:request.method()});
  assert.equal(request.method(),'GET','Preview must never POST body data or call GPT');assert.ok(!url.pathname.startsWith('/api/'),'no Preview API call');
  if(url.origin!==origin){assert.equal(url.hostname,'images.retailer.example');assert.equal(url.pathname,'/stylist-test.jpg');assert.equal(url.search,'');await route.fulfill({contentType:'image/jpeg',body:fs.readFileSync(path.join(root,'assets/photos/man.jpg'))});return;}
  for(const [key,value]of url.searchParams){assert.equal(key,'v');assert.match(value,/^[a-z0-9-]+$/);}
  if(url.pathname==='/assets/approved-products.json'){await route.fulfill({contentType:'application/json',body:JSON.stringify(snapshot)});return;}
  const file=path.resolve(root,url.pathname==='/'?'index.html':url.pathname.slice(1));assert.ok(file.startsWith(root+'/'));await route.fulfill({body:fs.readFileSync(file),contentType:mime[path.extname(file)]||'application/octet-stream',...(url.pathname==='/stylist.html'?{headers:{'Content-Security-Policy':csp}}:{})});
 });
}
const lastAnswer=page=>page.locator('#stylist-chat > article.stylist-message:not(.is-user)').last();
async function send(page,message){
 const before=await page.locator('#stylist-chat > article.stylist-message:not(.is-user)').count();await page.locator('#stylist-message').fill(message);await page.locator('#stylist-send').click();
 await page.waitForFunction(count=>!document.querySelector('#stylist-send').disabled&&document.querySelectorAll('#stylist-chat > article.stylist-message:not(.is-user)').length>count,before);return lastAnswer(page);
}
async function assertNoPrivateRequests(page,requests){
 assert.ok(requests.every(r=>r.method==='GET'&&!/\/api\/|shoulderHipRatio|legTorsoRatio|1\.37|1\.42/.test(decodeURIComponent(r.url))));
 assert.deepEqual(await page.evaluate(()=>Object.keys(sessionStorage)),[]);assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),['a1-fashion:language']);
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  for(const [language,width]of [['ko',820],['en',390]]){
   const context=await browser.newContext({viewport:{width,height:1180},locale:language==='ko'?'ko-KR':'en-US'}),requests=[],errors=[];await routeContext(context,fixture(),requests);
   const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(origin+'/stylist.html',{waitUntil:'networkidle'});await page.evaluate(lang=>A1I18n.setLanguage(lang),language);
   assert.equal(await page.locator('[name=budget]').inputValue(),'100000');assert.equal(await page.locator('#stylist-analysis-consent').isChecked(),false);assert.equal(await page.locator('#stylist-external-consent').isChecked(),false);
   // A prefilled/untouched category must not override the explicit trouser query.
   await page.evaluate(()=>{document.querySelector('[name=category]').value='tops';});
   let answer=await send(page,language==='ko'?'남성 검정 출근 바지 20만원 이하 사이즈 M':'men black trousers for work 200000원 이하 size M');
   assert.match(await answer.locator('[data-stylist-conditions]').innerText(),/200,000/);assert.match(await answer.locator('[data-stylist-conditions]').innerText(),language==='ko'?/검정.*바지.*출근용/:/black.*trousers.*office/);assert.match(await answer.locator('[data-stylist-conditions]').innerText(),/M/);
   assert.equal(await answer.locator('.stylist-product').count(),1);assert.match(await answer.innerText(),/Synthetic stylist garment TROUSERS/);assert.equal(await answer.locator('[data-stylist-catalog-fitting]').count(),0,'display permission is not fitting permission');
   assert.match(await answer.locator('[data-stylist-catalog-buy]').first().innerText(),language==='ko'?/판매처에서 이 상품 구매하기/:/Buy this product at the seller/);
   answer=await send(page,language==='ko'?'좀 더 편한 핏으로':'a more comfortable fit');let conditions=await answer.locator('[data-stylist-conditions]').innerText();
   assert.match(conditions,language==='ko'?/남성 검정 루즈핏 바지 출근용/:/men black relaxed trousers office/);assert.match(conditions,/200,000/);assert.match(conditions,/M/);assert.equal(await answer.locator('.stylist-product').count(),1);
   assert.equal(await answer.locator('[data-stylist-body-suggestions]').count(),0,'no body suggestions without separate consent');
   // Language rerender uses the same saved needs, not the vague latest message.
   await page.evaluate(lang=>A1I18n.setLanguage(lang),language==='ko'?'en':'ko');assert.match(await lastAnswer(page).locator('[data-stylist-conditions]').innerText(),/200,000/);await page.evaluate(lang=>A1I18n.setLanguage(lang),language);
   await page.locator('[name=budget]').fill('160000');answer=await send(page,language==='ko'?'그 조건으로 찾아주세요':'use those conditions');assert.match(await answer.locator('[data-stylist-conditions]').innerText(),/160,000/);assert.equal(await answer.locator('.stylist-product').count(),1,'a real budget edit applies');
   await page.locator('[name=category]').selectOption('tops');answer=await send(page,language==='ko'?'그 조건으로 찾아주세요':'use those conditions');assert.match(await answer.innerText(),/Synthetic stylist garment TOP/);assert.doesNotMatch(await answer.innerText(),/Synthetic stylist garment TROUSERS/);
   for(const query of [language==='ko'?'검정 말고 네이비 바지':'black trousers without navy','바지 5만원~10만원']){
    answer=await send(page,query);assert.equal(await answer.locator('.stylist-product,a,[data-stylist-body-suggestions],[data-stylist-conditions]').count(),0,'unsupported conditions cannot fall back to broad recommendations or search');assert.match(await answer.innerText(),language==='ko'?/아직 해석|상한 금액/:/not supported|upper budget/);
   }
   await page.locator('#stylist-clear').click();assert.equal(await page.locator('[data-stylist-conditions]').count(),0);answer=await send(page,language==='ko'?'추천해주세요':'recommend clothes');conditions=await answer.locator('[data-stylist-conditions]').innerText();assert.doesNotMatch(conditions,language==='ko'?/검정|루즈핏|출근용/:/black|relaxed|office/);assert.doesNotMatch(conditions,/200,000/);
   // Imported/filled ratios alone are not permission to use body suggestions.
   await page.evaluate(()=>{document.querySelector('[name=shoulderHipRatio]').value='1.37';document.querySelector('[name=legTorsoRatio]').value='1.42';});answer=await send(page,language==='ko'?'남성 검정 출근 바지 20만원 이하 사이즈 M':'men black trousers for work 200000원 이하 size M');assert.equal(await answer.locator('[data-stylist-body-suggestions]').count(),0);
   await page.locator('details.stylist-analysis > summary').click();await page.locator('#stylist-analysis-consent').check();await page.locator('[name=shoulderHipRatio]').fill('1.37');await page.locator('[name=legTorsoRatio]').fill('1.42');answer=await send(page,language==='ko'?'좀 더 편한 핏으로':'a more comfortable fit');
   assert.equal(await answer.locator('[data-stylist-body-suggestions]').count(),1);assert.equal(await page.locator('#stylist-analysis-consent').isChecked(),true);assert.match(await answer.locator('[data-stylist-body-suggestions]').innerText(),language==='ko'?/어깨·골반|실제 상품 목록 아님/:/shoulder-to-hip|not an actual product list/);
   const beforeRequests=requests.length,beforeAnswers=await page.locator('#stylist-chat > article').count();await answer.locator('[data-stylist-body-condition]').first().evaluate(button=>button.click());assert.equal(await page.locator('#stylist-message').inputValue(),'','synthetic clicks cannot apply body conditions');await answer.locator('[data-stylist-body-condition]').first().click();
   assert.match(await page.locator('#stylist-message').inputValue(),/남성 검정 루즈핏 바지 출근용 200000원 이하/);assert.doesNotMatch(await page.locator('#stylist-message').inputValue(),/1\.37|1\.42|Ratio/);assert.equal(requests.length,beforeRequests,'selecting a body idea makes no request');assert.equal(await page.locator('#stylist-chat > article').count(),beforeAnswers,'body selection never autosends');
   await page.locator('#stylist-send').click();await page.waitForFunction(()=>!document.querySelector('#stylist-send').disabled&&document.querySelector('#stylist-message').value==='');assert.equal(await lastAnswer(page).locator('[data-stylist-body-suggestions]').count(),1);assert.match(await lastAnswer(page).locator('[data-stylist-conditions]').innerText(),/200,000/);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await lastAnswer(page).screenshot({path:path.join(out,`stylist-needs-${language}-${width}.png`)});await assertNoPrivateRequests(page,requests);
   await page.locator('#stylist-analysis-consent').uncheck();assert.equal(await page.locator('#stylist-chat > article').count(),0);assert.equal(await page.locator('[name=shoulderHipRatio]').inputValue(),'');assert.equal(await page.locator('[name=legTorsoRatio]').inputValue(),'');assert.equal(await page.locator('[data-stylist-body-suggestions]').count(),0);assert.equal(await page.locator('#stylist-message').inputValue(),'');
   answer=await send(page,language==='ko'?'추천해주세요':'recommend clothes');assert.doesNotMatch(await answer.locator('[data-stylist-conditions]').innerText(),language==='ko'?/검정|루즈핏|출근용/:/black|relaxed|office/);
   await page.evaluate(()=>document.dispatchEvent(new CustomEvent('a1:auth-changed')));assert.equal(await page.locator('#stylist-chat > article').count(),0);assert.equal(await page.locator('[name=budget]').inputValue(),'100000');assert.equal(await page.locator('[name=category]').inputValue(),'all');await assertNoPrivateRequests(page,requests);assert.deepEqual(errors,[]);await context.close();
   console.log(`Stylist needs ${language} ${width}: explicit category and 200000 budget, inherited fit/type/color/purpose/size, genuine edits, strict invalid conditions, language, body consent/manual send/clear/auth and zero API requests passed.`);
  }
  // The real public zero-product state must stay honest after the same fix.
  const context=await browser.newContext(),requests=[];await routeContext(context,{version:1,generatedAt:null,products:[]},requests);const page=await context.newPage();await page.goto(origin+'/stylist.html',{waitUntil:'networkidle'});await page.evaluate(()=>A1I18n.setLanguage('ko'));const answer=await send(page,'남성 검정 바지 20만원 이하');assert.equal(await answer.locator('.stylist-product,[data-stylist-catalog-fitting],[data-stylist-catalog-buy]').count(),0);assert.match(await answer.innerText(),/검증 상품이 없습니다/);assert.ok(await answer.locator('.stylist-search-links a').count()>0);await assertNoPrivateRequests(page,requests);await context.close();console.log('Public empty catalog: no invented products, prices or fitting button; explicit official searches only.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
