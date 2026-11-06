'use strict';
// UI integration fixtures only. Access control is tested separately against real
// API handlers. No actual member, payment, email or SMS provider is contacted.
const assert=require('node:assert/strict');
const {createServer}=require('node:http');
const {readFile}=require('node:fs/promises');
const {resolve,extname}=require('node:path');
const {chromium}=require('playwright');
const root=resolve(__dirname,'..');
let plan='FREE',signedIn=false;
let watches=[],consents={email:false,sms:false},deliveries=[],consentHistory=[];
let catalogReady=false,simulationClaimed=false;
const officialProduct={id:'official-offer-1',productId:'official-shirt',name:'Verified Fixture Shirt',brand:'Fixture Brand',color:'White',size:'M',condition:'new',category:'tops',price:40,currency:'USD',productUrl:'https://ebay.com/itm/local-ui-fixture-only',retailerId:'ebay-us',retailerName:'Verified Fixture Seller',source:'Approved fixture feed',checkedAt:Date.now()-1000,expiresAt:Date.now()+3600000,sku:'FIXTURE-SHIRT-M',shipping:5,tax:0,duties:0};
let preferences={country:'KR',timeZone:'Asia/Seoul',language:'ko',frequency:'daily',emailEnabled:false,smsEnabled:false,phoneMasked:'',phoneVerified:false,brands:[],categories:[]};
const calls=[];
let holdNextRetailers=false,onRetailersHeld,resumeRetailers;
let holdNextProtectedAction=null,onProtectedHeld,resumeProtected;
let listGlobalRetailers,demoComparison,renderNotificationTemplate,compareOffers;
const headerRules=[];
const result=(res,data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'private, no-store'});res.end(JSON.stringify(data));};
const denied=(res,code,status=403)=>result(res,{ok:false,allowed:false,error:code,message:code},status);
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.svg':'image/svg+xml'};
const responseHeaders=path=>Object.assign({},...headerRules.filter(rule=>rule.path.endsWith('*')?path.startsWith(rule.path.slice(0,-1)):path===rule.path).map(rule=>rule.values));
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,`http://${req.headers.host}`);
  if(url.pathname.startsWith('/api/global/')){
   let body='';for await(const chunk of req)body+=chunk;
   const value=body?JSON.parse(body):null;
   const action=url.pathname.split('/').at(-1);calls.push({action,method:req.method,value,language:req.headers['accept-language']});
   if(!signedIn)return denied(res,'authentication_required',401);
   if(action==='account')return result(res,{plan,subscription:{active:plan!=='FREE',accessUntil:plan==='FREE'?null:Date.now()+3600000},mode:'DRY_RUN',databaseConfigured:true});
   if(plan==='FREE')return denied(res,'subscription_required');
   if(['comparison','preferences','consents','history','preview','simulate'].includes(action)&&plan!=='PREMIUM')return denied(res,'premium_required');
   if(action===holdNextProtectedAction){holdNextProtectedAction=null;await new Promise(resolve=>{resumeProtected=resolve;onProtectedHeld();});}
   if(action==='retailers'){
    // Capture a genuinely authorized response, then return it after a different
    // browser tab logs out. Stale success must not restore private UI data.
    if(holdNextRetailers){holdNextRetailers=false;await new Promise(resolve=>{resumeRetailers=resolve;onRetailersHeld();});}
    return result(res,listGlobalRetailers(value,{language:req.headers['accept-language']==='en'?'en':'ko'}));
   }
   if(action==='products')return result(res,{mode:'verified-offers',status:catalogReady?'ready':'disabled',products:catalogReady?[officialProduct,{...officialProduct,id:'unsafe',productUrl:'https://attacker.example.test/collect'}]:[],offers:[]});
   if(action==='comparison'){
    if(value.productId==='demo-tee')return result(res,demoComparison({...value,now:Date.now()}));
    const base={...officialProduct,sourceVerified:true,checkedAt:Date.now()-1000,shippingCountries:['KR','US'],shippingStatus:'confirmed',stock:'in_stock',sellerCountry:'US',price:40};
    return result(res,{...compareOffers({product:base,destination:value.destination,currency:value.currency,now:Date.now(),offers:[base,{...base,id:'unknown-cost',shipping:null,price:1},{...base,id:'large',size:'L',price:1}]}),status:'ready'});
   }
   if(action==='watchlist'){
    if(req.method==='POST'){
     if(value.targetPrice!==null&&value.targetPrice!==undefined&&plan!=='PREMIUM')return denied(res,'premium_required');
     watches=[{...value,id:'watch-fixture',createdAt:Date.now()}];
    }else if(req.method==='DELETE')watches=watches.filter(row=>row.id!==value.id);
    return result(res,req.method==='GET'?{items:watches}:{ok:true,items:watches},req.method==='POST'?201:200);
   }
   if(action==='consents'){
    if(req.method==='GET')return result(res,{consents:{...consents},history:consentHistory,mode:'DRY_RUN',noticeVersion:'a1-marketing-v2'});
    consents[value.channel]=value.granted;
    consentHistory.unshift({channel:value.channel,granted:value.granted,policyVersion:value.noticeVersion||'legacy',occurredAt:Date.now(),country:preferences.country,language:preferences.language,noticeText:null,contextCaptured:false});
    if(!value.granted){preferences[value.channel+'Enabled']=false;deliveries=deliveries.map(row=>row.channel===value.channel?{...row,status:'canceled'}:row);}
    return result(res,{ok:true,consents:{...consents},mode:'DRY_RUN'});
   }
   if(action==='preferences'){
    if(req.method==='PUT')preferences={...preferences,...value,emailEnabled:Boolean(value.emailEnabled&&consents.email),smsEnabled:Boolean(value.smsEnabled&&consents.sms),phoneMasked:value.phone?'+82••••••78':'',phoneVerified:false};
    if(req.method==='DELETE'){consents={email:false,sms:false};deliveries=[];preferences={...preferences,emailEnabled:false,smsEnabled:false,phoneMasked:''};}
    return result(res,{ok:true,preferences,consents:{...consents},mode:'DRY_RUN',liveDeliveryEnabled:false});
   }
   if(action==='preview'){
    if(!consents[value.channel])return denied(res,'consent_required');
    const template=renderNotificationTemplate({channel:value.channel,language:preferences.language,event:{id:'fixture-event',type:'price_drop',title:'DEMO price alert',brand:'A1 DEMO',productId:'demo-tee',currentPrice:{amount:39,currency:'USD'},previousPrice:{amount:49,currency:'USD'},demo:true},demo:true,unsubscribeUrl:'https://a1fashion.pages.dev/global.html#alerts'});
    if(!deliveries.some(row=>row.channel===value.channel))deliveries.push({id:'delivery-'+value.channel,channel:value.channel,eventId:'fixture-event',status:'dry-run',createdAt:Date.now(),preview:template});
    return result(res,{template,mode:'DRY_RUN',sent:false});
   }
   if(action==='simulate'){
    assert.deepEqual(value,{});
    if(!consents.email||!preferences.emailEnabled||!watches.length)return result(res,{mode:'DEMO',sent:false,created:0,duplicates:0,suppressed:1,eventCount:0,previews:[]});
    if(simulationClaimed)return result(res,{mode:'DEMO',sent:false,created:0,duplicates:1,suppressed:0,eventCount:1,previews:[]});
    simulationClaimed=true;
    const template=renderNotificationTemplate({channel:'email',language:preferences.language,event:{id:'DEMO-matched',type:'target_reached',title:'DEMO matched interest',currentPrice:{amount:39,currency:'USD'},demo:true},unsubscribeUrl:'https://a1fashion.pages.dev/global.html#alerts'});
    deliveries.push({id:'simulation-email',channel:'email',eventId:'DEMO-matched',status:'simulated',createdAt:Date.now(),preview:template});
    return result(res,{mode:'DEMO',sent:false,created:1,duplicates:0,suppressed:0,eventCount:1,previews:[{channel:'email',template}]});
   }
   if(action==='history'){if(req.method==='DELETE')deliveries=[];return result(res,{ok:true,deliveries,mode:'DRY_RUN',liveDeliveryEnabled:false});}
   return denied(res,'not_found',404);
  }
  const file=url.pathname==='/'?'global.html':decodeURIComponent(url.pathname.slice(1));
  const full=resolve(root,file);if(!full.startsWith(root+'/')||!(/^(?:global|index|account|privacy|credits)\.html$/.test(file)||file.startsWith('assets/'))){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream',...responseHeaders(url.pathname)});res.end(await readFile(full));
 }catch(error){res.writeHead(error.code==='ENOENT'?404:500);res.end();}
});
async function submit(page,id,action,status=200){
 const [response]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/api/global/'+action),page.locator(id).click()]);assert.equal(response.status(),status,action+': '+await response.text());
 await page.waitForTimeout(30);return response;
}
async function tab(page,name){await page.locator(`[data-tab="${name}"]`).click();}
async function assertEnglish(page,label){
 await page.waitForFunction(()=>document.documentElement.lang==='en');
 await page.waitForTimeout(30);
 const leftovers=await page.evaluate(()=>{
  const copy=document.body.cloneNode(true);
  copy.querySelectorAll('[data-language-switcher],[hidden],script,style,[data-i18n-ignore]').forEach(node=>node.remove());
  return (copy.textContent||'').match(/[^\n.!?]{0,45}[\uac00-\ud7af][^\n.!?]{0,80}/gu)||[];
 });
 assert.deepEqual(leftovers,[],`Untranslated global text: ${label}: ${leftovers.join(' | ')}`);
 const attrs=await page.locator('[aria-label],[alt],[placeholder],[title],meta[name=description]').evaluateAll(nodes=>nodes.flatMap(node=>['aria-label','alt','placeholder','title',...(node.matches('meta')?['content']:[])].map(attr=>node.getAttribute(attr)).filter(Boolean)));
 assert.ok(attrs.every(value=>!/[\uac00-\ud7af]/u.test(value)),`Untranslated global accessibility text: ${label}: ${attrs.filter(value=>/[\uac00-\ud7af]/u.test(value)).join(' | ')}`);
}
(async()=>{
 ({listGlobalRetailers}=await import('../server/global-retailers.mjs'));
 ({demoComparison}=await import('../server/demo-offers.mjs'));
 ({compareOffers}=await import('../server/price-comparison.mjs'));
 ({renderNotificationTemplate}=await import('../server/notifications.mjs'));
 let headerRule;
 for(const line of (await readFile(resolve(root,'_headers'),'utf8')).split(/\r?\n/)){
  if(!line.trim())continue;
  if(line.startsWith('/')){headerRule={path:line.trim(),values:{}};headerRules.push(headerRule);}
  else{const at=line.indexOf(':');headerRule.values[line.slice(0,at).trim()]=line.slice(at+1).trim();}
 }
 let browser;
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  const context=await browser.newContext({locale:'ko-KR',viewport:{width:390,height:844}}),page=await context.newPage();
  const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r));
  await page.goto(origin+'/global.html',{waitUntil:'networkidle'});
  await page.addInitScript(()=>{localStorage.setItem('paid','true');localStorage.setItem('plan','PREMIUM');});
  await submit(page,'#global-search button[type=submit]','retailers',401);
  assert.equal(await page.locator('#retailer-results a').count(),0);
  await submit(page,'#products-load','products',401);assert.equal(await page.locator('#product-results a').count(),0);
  await tab(page,'comparison');await submit(page,'#comparison-form button[type=submit]','comparison',401);
  assert.equal(await page.locator('#comparison-results a').count(),0);
  signedIn=true;plan='FREE';await page.reload({waitUntil:'networkidle'});await tab(page,'shopping');
  await submit(page,'#global-search button[type=submit]','retailers',403);
  assert.equal(await page.locator('#retailer-results a').count(),0);

  plan='GENERAL';await page.reload({waitUntil:'networkidle'});await tab(page,'shopping');
  await page.locator('#global-search [name=country]').selectOption('US');
  await page.locator('#global-search [name=currency]').selectOption('USD');
  await page.locator('#global-search [name=query]').fill('linen shirt');
  await submit(page,'#global-search button[type=submit]','retailers');
  await page.waitForFunction(()=>document.querySelectorAll('#retailer-results a').length>0);
  const links=await page.locator('#retailer-results a').evaluateAll(nodes=>nodes.map(node=>({href:node.href,rel:node.rel})));
  assert.ok(links.every(link=>/^https:\/\/(?:www\.ebay\.com|www\.amazon\.com)\//.test(link.href)&&link.rel.includes('noopener')));
  assert.match(await page.locator('#retailer-results').innerText(),/검색|Search/);
  const query=calls.filter(call=>call.action==='retailers').at(-1).value;assert.equal(query.query,'linen shirt');
  await submit(page,'#products-load','products');
  assert.match(await page.locator('#product-results').innerText(),/승인|approval/i);assert.equal(await page.locator('#product-results .retailer-card').count(),0,'An unapproved feed must not invent products');
  catalogReady=true;await submit(page,'#products-load','products');
  assert.equal(await page.locator('#product-results .retailer-card').count(),1,'Unsafe product URLs cannot produce public cards');
  assert.match(await page.locator('#product-results').innerText(),/Verified Fixture Shirt|USD 40/);
  assert.match(await page.locator('#product-results').innerText(),/Approved fixture feed/);assert.equal(new URL(await page.locator('#product-results a').first().getAttribute('href')).hostname,'ebay.com','Approved bare retailer domains remain usable');
  await submit(page,'#product-results [data-product-action=save]','watchlist',201);
  assert.equal(watches[0].productId,officialProduct.id);assert.equal(watches[0].currency,'USD');assert.equal(watches[0].targetPrice,null);
  await page.locator('#product-results [data-product-action=compare]').click();
  assert.equal(await page.locator('#comparison-form [name=productId]').inputValue(),officialProduct.id);
  await submit(page,'#comparison-form button[type=submit]','comparison',403);
  assert.equal(await page.locator('#product-results').innerText(),'','Paid denial clears previously displayed products');
  await tab(page,'shopping');
  await page.screenshot({path:'/tmp/a1-global-shopping-mobile.png',fullPage:true});
  await tab(page,'comparison');await submit(page,'#comparison-form button[type=submit]','comparison',403);
  assert.equal(await page.locator('#comparison-results a').count(),0);
  await tab(page,'watchlist');
  await submit(page,'#watchlist-form button[type=submit]','watchlist',201);
  assert.equal(watches.length,1);assert.equal(watches[0].productId,'demo-tee');

  plan='PREMIUM';await page.reload({waitUntil:'networkidle'});await tab(page,'comparison');
  await page.locator('#comparison-form [name=currency]').selectOption('USD');
  await submit(page,'#comparison-form button[type=submit]','comparison');
  assert.match(await page.locator('#comparison-results').innerText(),/DEMO/);
  assert.match(await page.locator('#comparison-results').innerText(),/미확인|unknown|확인 불가|unavailable/i);
  const compareLinks=await page.locator('#comparison-results a').evaluateAll(nodes=>nodes.map(node=>node.href));
  assert.ok(compareLinks.every(href=>!href.includes('example.test')),'Fictional offers cannot become actual product purchase links');
  await page.screenshot({path:'/tmp/a1-global-comparison-mobile.png',fullPage:true});
  await tab(page,'shopping');await page.locator('#global-search [name=country]').selectOption('US');await page.locator('#global-search [name=currency]').selectOption('USD');await submit(page,'#products-load','products');
  await page.locator('#product-results [data-product-action=compare]').click();
  await submit(page,'#comparison-form button[type=submit]','comparison');
  const actualComparison=await page.locator('#comparison-results').innerText();
  assert.match(actualComparison,/Verified Fixture Seller/);assert.match(actualComparison,/USD\s*45/);assert.doesNotMatch(actualComparison,/DEMO/,'Official comparison must not be mislabeled DEMO');
  assert.match(actualComparison,/미확인|unknown/i);assert.match(actualComparison,/유사 상품|Similar/);

  await tab(page,'alerts');
  await submit(page,'[data-preview=email]','preview',403);assert.equal(deliveries.length,0);
  await submit(page,'[data-consent=email][data-granted=true]','consents');assert.equal(consents.email,true);assert.equal(consents.sms,false);
  await page.locator('#preferences-form [name=emailEnabled]').check();
  await submit(page,'#preferences-form button[type=submit]','preferences');
  assert.equal(preferences.emailEnabled,true);assert.equal(preferences.smsEnabled,false);
  await submit(page,'#simulation-run','simulate');
  assert.match(await page.locator('#simulation-results').innerText(),/DEMO/);assert.equal(deliveries.length,1);
  await submit(page,'#simulation-run','simulate');assert.equal(deliveries.length,1,'Repeated simulations do not create duplicates');
  assert.match(await page.locator('#simulation-results').innerText(),/중복 1|Duplicates: 1/);
  await submit(page,'#consent-history-load','consents');assert.match(await page.locator('#consent-history').innerText(),/a1-marketing-v2/);
  assert.equal(calls.filter(call=>call.action==='consents'&&call.method==='POST'&&call.value.granted).at(-1).value.noticeVersion,'a1-marketing-v2');
  deliveries=[];
  await submit(page,'[data-preview=email]','preview');
  await submit(page,'[data-preview=email]','preview');assert.equal(deliveries.length,1,'Preview fixture records are deduplicated');
  assert.match(await page.locator('#notification-preview').innerText(),/DRY.RUN|DEMO/);
  await submit(page,'#history-load','history');assert.match(await page.locator('#notification-history').innerText(),/dry.run|모의/i);
  await submit(page,'[data-consent=email][data-granted=false]','consents');assert.equal(consents.email,false);assert.equal(preferences.emailEnabled,false);
  await submit(page,'[data-preview=email]','preview',403);
  await submit(page,'#simulation-run','simulate');assert.equal(deliveries.length,1,'Withdrawn consent cannot generate new simulations');
  await submit(page,'#history-delete','history');assert.equal(deliveries.length,0);
  await page.screenshot({path:'/tmp/a1-global-alerts-mobile.png',fullPage:true});
  for(const lang of ['en','ko']){
   await page.locator('[data-language-select]').selectOption(lang);
   assert.equal(await page.locator('html').getAttribute('lang'),lang);
   for(const name of ['shopping','membership','comparison','watchlist','alerts','account']){
    await tab(page,name);
    assert.equal(await page.locator(`[data-panel="${name}"]`).isVisible(),true);
    if(lang==='en')await assertEnglish(page,name);
   }
   for(const [width,height]of [[320,740],[390,844],[820,1180],[1440,1000]]){
    await page.setViewportSize({width,height});
    for(const name of ['shopping','membership','comparison','watchlist','alerts','account']){
     await tab(page,name);
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${lang} ${name} overflow ${width}`);
    }
   }
  }
  await tab(page,'alerts');
  await submit(page,'#preferences-delete','preferences');
  assert.deepEqual(consents,{email:false,sms:false});
  assert.equal(preferences.phoneMasked,'');

  const latePeer=await context.newPage();await latePeer.goto(origin+'/global.html',{waitUntil:'networkidle'});
  for(const [action,panel,button]of [['products','shopping','#products-load'],['simulate','alerts','#simulation-run']]){
   signedIn=true;plan='PREMIUM';consents.email=true;preferences.emailEnabled=true;simulationClaimed=false;
   await page.reload({waitUntil:'networkidle'});await tab(page,panel);
   holdNextProtectedAction=action;const held=new Promise(resolve=>{onProtectedHeld=resolve;});
   await page.locator(button).click();await held;signedIn=false;
   await latePeer.evaluate(action=>localStorage.setItem('a1-fashion:auth-event',action+Date.now()),action);
   await page.waitForFunction(()=>/로그인 상태가 바뀌었습니다/.test(document.querySelector('#global-status').textContent));
   resumeProtected();resumeProtected=null;await page.waitForTimeout(100);
   for(const id of ['product-results','simulation-results','notification-preview','notification-history','consent-history'])assert.equal(await page.locator('#'+id).innerText(),'',`${action}: stale authorized response must not restore ${id}`);
   assert.equal(await page.locator(button).isDisabled(),false,`${action}: logout must release busy state`);
  }
  await latePeer.close();signedIn=true;
  await tab(page,'shopping');
  await page.locator('#global-search [name=query]').fill('private pending search');
  holdNextRetailers=true;
  const held=new Promise(resolve=>{onRetailersHeld=resolve;});
  await page.locator('#global-search button[type=submit]').click();
  await held;
  signedIn=false;
  const peer=await context.newPage();await peer.goto(origin+'/global.html',{waitUntil:'networkidle'});
  await peer.evaluate(()=>localStorage.setItem('a1-fashion:auth-event',String(Date.now())));
  await page.waitForFunction(()=>/로그인 상태가 바뀌었습니다/.test(document.querySelector('#global-status').textContent));
  resumeRetailers();resumeRetailers=null;
  await page.waitForTimeout(100);
  assert.equal(await page.locator('#product-results').innerText(),'');assert.equal(await page.locator('#simulation-results').innerText(),'');assert.equal(await page.locator('#consent-history').innerText(),'');
  assert.equal(await page.locator('#retailer-results a').count(),0,'Late authorized response cannot restore private data after cross-tab logout');
  assert.equal(await page.locator('#comparison-results').innerText(),'');
  assert.equal(await page.locator('#watchlist-results').innerText(),'');
  assert.equal(await page.locator('#global-search button[type=submit]').isDisabled(),false,'Logout abort releases the UI');
  await peer.close();
  const storage=await page.evaluate(()=>JSON.stringify([...Object.entries(localStorage),...Object.entries(sessionStorage)]));
  assert.doesNotMatch(storage,/linen shirt|demo-tee|official-offer|Verified Fixture|phone|@|issuer|subject/);
  assert.deepEqual(errors,[]);assert.ok(requests.every(r=>new URL(r.url()).origin===origin),'UI must not contact message or product providers directly');
  console.log('Global UI passed: FREE/GENERAL/PREMIUM UI fixtures, real search/comparison producers, approved products and safe empty states, selected-product saves and verified comparisons, separate consent audit/settings/withdrawal/contact deletion, interest-matched simulated previews and dedupe, all six panels in KO/EN at 320/390/820/1440 widths, no private browser storage, cross-tab logout cancels late authorized responses. API authorization is covered separately.');
  await context.close();
 }finally{if(resumeProtected)resumeProtected();if(resumeRetailers)resumeRetailers();if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
