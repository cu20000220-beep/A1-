'use strict';
// SYNTHETIC SELLER PERMISSION / OFFER FIXTURES ONLY. Compiled in memory and
// intercepted in this browser context; never written to the public catalog.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {compileCatalog}=require('../scripts/lib/product-catalog.cjs');
const root=path.resolve(__dirname,'..'),origin='https://offer-browser.a1fashion.pages.dev',out='/workspace/work/offer-comparison';fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.jpg':'image/jpeg','.json':'application/json'};
function fixture(now=Date.now()){
 const approvals=['alpha','beta'].map(name=>({id:'LOCAL-TEST-'+name.toUpperCase(),seller:'Synthetic seller '+name,domains:[name+'.retailer.example'],imageDomains:['images.retailer.example'],rightsConfirmed:true,displayApproved:true,commercialApproved:true,validUntil:new Date(now+3600000).toISOString(),evidenceRef:'AUTOMATED SYNTHETIC TEST ONLY - NOT REAL SELLER PERMISSION',sourceUrl:'https://'+name+'.retailer.example/catalog.csv',retentionHours:1}));
 function offer(id,seller,change={}){const a=approvals[seller==='alpha'?0:1];return {id,approvalId:a.id,name:'SYNTHETIC test offer '+id,brand:'SYNTHETIC Test Brand',category:'bottoms',type:'slacks',color:'black',styles:['classic'],occasions:['work'],gender:'men',price:40000,currency:'KRW',sizes:['M'],sizeChart:{unit:'cm',kind:'garment',rows:[{size:'M',waist:80,inseam:76}]},imageUrl:'https://images.retailer.example/authorized-test.jpg',retailer:a.seller,purchaseUrl:'https://'+seller+'.retailer.example/items/'+id,sourceUrl:a.sourceUrl,permissionChecked:true,lastChecked:new Date(now-1000).toISOString(),stock:'in_stock',tags:['straight'],designTagsComplete:true,gtin:'4006381333931',mpn:null,offerSize:'M',sizeSystem:'INTL',condition:'new',shipping:3000,tax:0,duties:0,costDestination:'KR',shippingCountries:['KR'],sourceKind:'seller-file',externalId:id,commercial:{sponsored:false,affiliate:false,label:null},purchaseConditions:null,purchaseConditionsVerified:true,...change};}
 const products=[
  offer('TEST-A','alpha'),
  offer('TEST-B-OLD','beta',{price:1000,shipping:0,externalId:'B-LISTING',purchaseUrl:'https://beta.retailer.example/items/B',lastChecked:new Date(now-60000).toISOString()}),
  offer('TEST-B-LATEST','beta',{price:42000,shipping:0,externalId:'B-LISTING',purchaseUrl:'https://beta.retailer.example/items/B'}),
  offer('TEST-UNKNOWN-SHIPPING','beta',{price:5000,shipping:null}),
  offer('TEST-OUT-OF-STOCK','alpha',{price:2000,shipping:0,stock:'out_of_stock'}),
  offer('TEST-CONDITIONAL','beta',{price:100,shipping:0,purchaseConditions:'SYNTHETIC TEST: members only price'}),
  offer('TEST-UNKNOWN-CONDITIONS','alpha',{price:120,shipping:0,purchaseConditionsVerified:false}),
  offer('TEST-OTHER-GTIN','beta',{gtin:'5901234123457',price:3000}),
  offer('TEST-WRONG-COLOR','alpha',{color:'white',price:3000}),
  offer('TEST-WRONG-SIZE','beta',{offerSize:'L',sizes:['L'],sizeChart:{unit:'cm',kind:'garment',rows:[{size:'L',waist:84,inseam:78}]},price:3000}),
  offer('TEST-USED','alpha',{condition:'used',price:3000}),
  offer('TEST-SPONSORED','alpha',{price:48000,shipping:0,commercial:{sponsored:true,affiliate:false,label:'SYNTHETIC PAID SPONSOR - TEST ONLY'}}),
  offer('TEST-AFFILIATE','beta',{price:41000,shipping:5000,commercial:{sponsored:false,affiliate:true,label:'SYNTHETIC AFFILIATE COMMISSION - TEST ONLY'}})
 ];
 return compileCatalog({version:1,products},{version:1,sources:approvals},{now,inspect:true}).snapshot;
}
async function routeContext(context,snapshot,requests){await context.route('**/*',async route=>{
 const r=route.request(),u=new URL(r.url());assert.equal(r.method(),'GET');assert.ok(!u.pathname.startsWith('/api/'));requests.push(u.href);
 if(u.origin!==origin){assert.equal(u.hostname,'images.retailer.example','no seller API, analytics, payment or live external service');assert.equal(u.pathname,'/authorized-test.jpg');assert.equal(u.search,'');await route.fulfill({contentType:'image/jpeg',body:fs.readFileSync(path.join(root,'assets/photos/man.jpg'))});return;}
 for(const[k,v]of u.searchParams){assert.equal(k,'v');assert.match(v,/^[a-z0-9-]+$/);}
 if(u.pathname==='/assets/approved-products.json'){await route.fulfill({contentType:'application/json',body:JSON.stringify(snapshot)});return;}
 const file=path.resolve(root,u.pathname==='/'?'index.html':u.pathname.slice(1));assert.ok(file.startsWith(root+'/'));await route.fulfill({body:fs.readFileSync(file),contentType:mime[path.extname(file)]||'application/octet-stream'});
 });}
const unknown=lang=>lang==='ko'?/미확인|불명|비교 불가/:/unknown|unconfirmed|unavailable|incomplete|not comparable/i;
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{
 for(const width of [390,820])for(const lang of ['ko','en']){
  const snapshot=fixture(),context=await browser.newContext({viewport:{width,height:1180},hasTouch:true,isMobile:true,locale:lang==='ko'?'ko-KR':'en-US'}),requests=[],errors=[];await routeContext(context,snapshot,requests);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/',{waitUntil:'networkidle'});await page.evaluate(l=>A1I18n.setLanguage(l),lang);
  await page.locator('details:has(#shopping-product-filters)>summary').click();await page.locator('#shopping-size').fill('M');await page.locator('#shopping-destination').selectOption('KR');
  await page.locator('#shopping-query').fill('남성 검정 슬랙스 5만원 이하');await page.locator('#shopping-search-form button[type=submit]').click();
  await page.waitForSelector('#shopping-products [data-catalog-id="TEST-A"]');
  const organic=await page.locator('#shopping-products [data-catalog-id]').evaluateAll(a=>a.map(e=>e.dataset.catalogId));
  assert.ok(organic.includes('TEST-B-LATEST'));assert.ok(organic.includes('TEST-AFFILIATE'));assert.ok(!organic.includes('TEST-SPONSORED'),'sponsored offers must not enter organic ranking');assert.ok(!organic.includes('TEST-B-OLD'),'old cheap duplicate must not survive newest-record policy');assert.ok(!organic.includes('TEST-OUT-OF-STOCK'));assert.ok(!organic.includes('TEST-WRONG-COLOR'));assert.ok(!organic.includes('TEST-WRONG-SIZE'));
  assert.equal(await page.locator('#shopping-sponsored [data-catalog-id="TEST-SPONSORED"]').count(),1);assert.equal(await page.locator('#shopping-sponsored').isVisible(),true,'sponsored cards must be visibly displayed, not just present in hidden DOM');assert.equal(await page.locator('#shopping-sponsored [data-catalog-compare]').count(),0,'sponsored cards do not enter organic candidate comparison');
  assert.match(await page.locator('#shopping-sponsored').innerText(),/SYNTHETIC PAID SPONSOR/);assert.match(await page.locator('#shopping-products [data-catalog-id="TEST-AFFILIATE"]').innerText(),/SYNTHETIC AFFILIATE COMMISSION/);
  assert.equal(await page.locator('#shopping-unavailable [data-catalog-id="TEST-OUT-OF-STOCK"]').count(),1);
  const images=page.locator('#shopping-products img,#shopping-sponsored img');assert.ok(await images.count()>=3);for(let i=0;i<await images.count();i++){await images.nth(i).scrollIntoViewIfNeeded();await page.waitForFunction(img=>img.complete&&img.naturalWidth>0,await images.nth(i).elementHandle(),{timeout:10000});assert.equal(await images.nth(i).evaluate(img=>img.naturalWidth>0&&img.naturalHeight>0),true);assert.equal(await images.nth(i).getAttribute('referrerpolicy'),'no-referrer');}
  await page.locator('[data-offer-compare="TEST-A"]').click();await page.waitForSelector('#shopping-offer-comparison [data-offer-id="TEST-B-LATEST"]');
  const rows=await page.locator('#shopping-offer-comparison [data-offer-id]').evaluateAll(a=>a.map(e=>e.dataset.offerId));
  for(const id of ['TEST-A','TEST-B-LATEST','TEST-UNKNOWN-SHIPPING','TEST-OUT-OF-STOCK','TEST-CONDITIONAL','TEST-UNKNOWN-CONDITIONS','TEST-SPONSORED','TEST-AFFILIATE'])assert.ok(rows.includes(id),id+' exact-variant row should appear');
  for(const id of ['TEST-B-OLD','TEST-OTHER-GTIN','TEST-WRONG-COLOR','TEST-WRONG-SIZE','TEST-USED'])assert.ok(!rows.includes(id),id+' must not appear as the same exact variant');
  const row=id=>page.locator('#shopping-offer-comparison [data-offer-id="'+id+'"]'),cell=(id,field)=>row(id).locator('[data-offer-field="'+field+'"]');
  assert.equal(await row('TEST-B-LATEST').getAttribute('data-offer-lowest'),'true');assert.match(await cell('TEST-B-LATEST','price').innerText(),/42,000/);assert.match(await cell('TEST-B-LATEST','total').innerText(),/42,000/);assert.match(await cell('TEST-A','total').innerText(),/43,000/);
  for(const id of ['TEST-UNKNOWN-SHIPPING','TEST-OUT-OF-STOCK','TEST-CONDITIONAL','TEST-UNKNOWN-CONDITIONS']){assert.equal(await row(id).getAttribute('data-offer-eligible'),'false');assert.notEqual(await row(id).getAttribute('data-offer-lowest'),'true');assert.match(await cell(id,'total').innerText(),unknown(lang));}
  assert.match(await cell('TEST-UNKNOWN-SHIPPING','shipping').innerText(),unknown(lang));assert.match(await cell('TEST-OUT-OF-STOCK','stock').innerText(),lang==='ko'?/품절|재고 없음/:/out.of.stock/i);assert.equal(await row('TEST-OUT-OF-STOCK').locator('[data-offer-buy]').count(),0);
  assert.match(await cell('TEST-A','size').innerText(),/M/);assert.ok((await cell('TEST-A','checkedAt').innerText()).trim().length>5);assert.match(await cell('TEST-A','conditions').innerText(),lang==='ko'?/(추가|구매|별도).*조건.*없/:/no.*(?:additional|extra|purchase).*conditions/i);assert.match(await cell('TEST-UNKNOWN-CONDITIONS','conditions').innerText(),unknown(lang));assert.match(await cell('TEST-CONDITIONAL','conditions').innerText(),/members only price/);
  assert.match(await cell('TEST-SPONSORED','commercial').innerText(),/SYNTHETIC PAID SPONSOR/);assert.match(await cell('TEST-AFFILIATE','commercial').innerText(),/SYNTHETIC AFFILIATE COMMISSION/);
  await page.locator('#shopping-offer-comparison').screenshot({path:path.join(out,`comparison-synthetic-${lang}-${width}.png`),style:'header{visibility:hidden!important}'});await page.locator('#shopping-sponsored').screenshot({path:path.join(out,`sponsored-synthetic-${lang}-${width}.png`),style:'header{visibility:hidden!important}'});
  // Do not make up fees or a lowest delivered price when the destination changes.
  await page.locator('#shopping-destination').selectOption('US');await page.locator('#shopping-search-form button[type=submit]').click();await page.locator('[data-offer-compare="TEST-A"]').click();
  assert.equal(await page.locator('#shopping-offer-comparison [data-offer-lowest="true"]').count(),0);assert.equal(await row('TEST-B-LATEST').getAttribute('data-offer-eligible'),'false');assert.match(await cell('TEST-B-LATEST','total').innerText(),unknown(lang));
  if(width===820&&lang==='ko'){
   await page.goto(origin+'/stylist.html',{waitUntil:'networkidle'});await page.locator('#stylist-message').fill('남성 검정 슬랙스 5만원 이하');await page.locator('#stylist-send').click();await page.waitForSelector('[data-stylist-exact-comparison]');
   const exact=page.locator('[data-stylist-exact-comparison]').first();assert.equal(await exact.locator('[data-stylist-offer="TEST-B-LATEST"][data-stylist-lowest]').count(),1);assert.match(await exact.innerText(),/42,000/);
   for(const id of ['TEST-B-OLD','TEST-SPONSORED','TEST-OTHER-GTIN','TEST-WRONG-COLOR','TEST-WRONG-SIZE','TEST-USED'])assert.equal(await exact.locator('[data-stylist-offer="'+id+'"]').count(),0,id+' excluded from stylist exact group');
   assert.match(await exact.locator('[data-stylist-offer="TEST-UNKNOWN-SHIPPING"]').innerText(),/미확인/);assert.equal(await page.locator('[data-stylist-affiliate="TEST-AFFILIATE"]').count()>0,true);assert.equal(await page.locator('.stylist-product:has([data-stylist-catalog-buy="TEST-SPONSORED"])').count(),0);
   await exact.screenshot({path:path.join(out,'stylist-exact-synthetic-ko-820.png'),style:'header{visibility:hidden!important}'});console.log('SYNTHETIC stylist: shared exact identity/fees, latest duplicate, sponsored exclusion, affiliate disclosure and verified total passed.');
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(await page.evaluate(()=>Object.keys(sessionStorage)),[]);assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),['a1-fashion:language']);assert.deepEqual(errors,[]);
  assert.ok(requests.every(u=>!u.includes('shoulderHipRatio')&&!u.includes('legTorsoRatio')&&!u.includes('TEST-AFFILIATE')&&!u.includes('50000')),'private search conditions and offer selection must not enter requests');
  console.log(`SYNTHETIC exact offers ${lang} ${width}: same variant/sellers, latest duplicate, delivered costs, unavailable/unknown, sponsored separation, affiliate labels, decoded images and destination fail-closed passed. Never published.`);await context.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
