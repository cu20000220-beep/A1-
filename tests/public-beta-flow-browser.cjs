'use strict';
// PRIVATE release-preparation transport tests. Every browser request is routed
// locally, including the exact Production hostname. This never contacts Pages,
// a retailer, a CDN, a provider, an auth service or a database. The sole garment
// raster is repository coat.jpg, NOT the advertised retailer's photograph.
// Chromium touch viewports do not certify native iPad Safari or real CDN CORS.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist'),origin='https://a1fashion.pages.dev';
const previewOrigin='https://public-beta-private.a1fashion.pages.dev';
const out=process.env.A1_PUBLIC_BETA_EVIDENCE||'/workspace/work/public-beta-flow';fs.mkdirSync(out,{recursive:true});
const trials=[];
const id='musinsa-1168906',query='남성 검정 슬랙스 5만원 이하';
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.glb':'model/gltf-binary','.wasm':'application/wasm'};
const tracked=['assets/approved-products.json','catalog/source-approvals.json','assets/observed-products.json','assets/product-images.json'];
const sources=['assets/local-fashion-core.js','assets/public-beta-bootstrap.js','assets/preview-experience.js','assets/shopping-search.js','assets/product-discovery-view.js','assets/catalog-fitting.js','assets/lab-entry.js','assets/lab-loader.js','assets/product-lab.js','assets/stylist.js','assets/ai-studio.js','index.html','stylist.html','product-lab.html','functions/api/policy.js','functions/api/stylist.js','server/free-beta.mjs','server/ai-stylist.mjs','scripts/build-site.cjs','scripts/lib/catalog-public-headers.cjs','assets/photos/coat.jpg',...tracked];
function mockPose(){
 const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);window.__betaUrls=new Set();window.__betaSelections=0;window.__betaReady=0;window.__betaFetches=[];window.__betaPolicyResponses=[];
 URL.createObjectURL=blob=>{const url=create(blob);__betaUrls.add(url);return url;};URL.revokeObjectURL=url=>{__betaUrls.delete(url);revoke(url);};
 document.addEventListener('change',event=>{if(event.target.id==='ai-photo')__betaSelections++;});document.addEventListener('a1:public-beta-ready',()=>__betaReady++);
 const nativeFetch=window.fetch;window.fetch=(input,options={})=>{const record={path:new URL(typeof input==='string'?input:input.url,location.href).pathname,method:options.method||'GET',credentials:options.credentials,cache:options.cache,redirect:options.redirect,mode:options.mode};__betaFetches.push(record);return nativeFetch(input,options).then(response=>{if(record.path==='/api/policy')__betaPolicyResponses.push({credentials:options.credentials,status:response.status,type:response.headers.get('Content-Type')});return response;});};
 window.Pose=class{setOptions(){}onResults(fn){this.result=fn;}async initialize(){}async reset(){}async close(){}async send(){const p=Array.from({length:33},()=>({x:.5,y:.5,visibility:.99}));for(const[index,[x,y]]of Object.entries({11:[.3,.2],12:[.7,.2],23:[.36,.45],24:[.64,.45],25:[.36,.65],26:[.64,.65],27:[.36,.9],28:[.64,.9]}))p[index]={x,y,visibility:.99};this.result({poseLandmarks:p});}};
}
function staticHeaders(pathname){
 const headers={};let active=false;
 for(const line of fs.readFileSync(path.join(dist,'_headers'),'utf8').split('\n')){
  if(line.startsWith('/')){const pattern=line.trim();active=pattern.endsWith('*')?pathname.startsWith(pattern.slice(0,-1)):pathname===pattern;continue;}
  const match=active&&line.match(/^\s+([^:]+):\s*(.*)$/);if(match)headers[match[1]]=match[2];
 }
 return headers;
}
function environment(flag,stats){
 const env={A1_FREE_BETA_MODE:flag,AUTH_ISSUER:'https://private-auth.invalid/',AUTH_AUDIENCE:'private-browser-test',AUTH_JWKS_URL:'https://private-auth.invalid/keys'};
 if(flag==='true'){
  for(const key of['MEMBERSHIP_DB','OPENAI_API_KEY','FIREBASE_WEB_API_KEY'])Object.defineProperty(env,key,{get(){stats.forbiddenBindingReads++;throw Error('PRIVATE beta binding trap: '+key);}});
 }else env.MEMBERSHIP_DB={prepare(){stats.databaseCalls++;throw Error('PRIVATE database trap');}};
 return env;
}
async function prepare(browser,handlers,{width=820,lang='ko',entry='/',host=origin,policyMode='true',serverFlag=policyMode==='false'?'false':'true',tamper=false,late=false}={}){
 const context=await browser.newContext({viewport:{width,height:1180},hasTouch:true,isMobile:true,locale:lang==='ko'?'ko-KR':'en-US',serviceWorkers:'block'});
 const calls=[],errors=[],routeErrors=[],violations=[],apiResponses=[],stats={databaseCalls:0,forbiddenBindingReads:0};
 const env=environment(serverFlag,stats),privateEnv=environment('false',stats);privateEnv.A1_FREE_BETA_MODE=serverFlag;
 let release,notice;const gate=new Promise(r=>release=r),seen=new Promise(r=>notice=r);
 if(tamper)await context.addCookies([{name:'A1_FREE_BETA_MODE',value:'true',url:host},{name:'paid',value:'true',url:host},{name:'plan',value:'PREMIUM',url:host}]);
 const allowedImages=new Set(JSON.parse(fs.readFileSync(path.join(dist,'assets/product-images.json'),'utf8')).products.map(row=>row.imageUrl));
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());calls.push({url:url.href,method:request.method(),postData:request.postData(),navigation:request.isNavigationRequest()});
  try{
   if(url.origin!==host){
    assert.equal(request.method(),'GET');assert.equal(request.isNavigationRequest(),false);assert.ok(allowedImages.has(url.href),'only exact manifest garment references can be privately intercepted');
    assert.equal(request.postData(),null);assert.ok(!request.headers().referer,'private garment raster has no referrer');
    await route.fulfill({contentType:'image/jpeg',body:fs.readFileSync(path.join(dist,'assets/photos/coat.jpg')),headers:{'Access-Control-Allow-Origin':host,'Cache-Control':'no-store'}});return;
   }
   if(url.pathname.startsWith('/api/')){
    assert.equal(host,origin,'Preview must make zero API requests');assert.equal(url.search,'');
    const headers=await request.allHeaders(),body=request.postData();
    const req=new Request(url.href,{method:request.method(),headers,...(body===null?{}:{body})});
    if(url.pathname==='/api/policy'){
     assert.equal(request.method(),'GET');notice();if(late||policyMode==='timeout')await gate;
     if(policyMode==='failed'){await route.fulfill({status:503,contentType:'application/json',body:'{}'});return;}
     const response=await handlers.policy.onRequest({request:req,env});
     const reply={status:response.status,headers:{...Object.fromEntries(response.headers),...(policyMode==='mime'?{'content-type':'text/plain'}:{})},body:await response.text()};
     if(policyMode==='timeout')await route.fulfill(reply).catch(()=>{});else await route.fulfill(reply);return;
    }
    let response;
    if(url.pathname==='/api/stylist')response=await handlers.stylist.onRequest({request:req,env});
    else if(url.pathname==='/api/membership')response=await handlers.membership.onRequest({request:req,env});
    else if(url.pathname.startsWith('/api/global/'))response=await handlers.global.handleGlobalRequest(url.pathname.slice('/api/global/'.length),{request:req,env:privateEnv});
    else throw Error('Unexpected API path: '+url.pathname);
    const text=await response.text(),data=JSON.parse(text);apiResponses.push({path:url.pathname,method:request.method(),status:response.status,data});
    await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:text});return;
   }
   assert.equal(request.method(),'GET');for(const[key,value]of url.searchParams){assert.equal(key,'v');assert.match(value,/^[a-z0-9-]+$/i);}
   if(url.pathname.endsWith('.html')){await route.fulfill({status:308,headers:{Location:url.pathname.slice(0,-5)},body:''});return;}
   const relative=url.pathname==='/'?'index.html':/^\/(?:stylist|product-lab|fitting-studio|global|account)$/.test(url.pathname)?url.pathname.slice(1)+'.html':url.pathname.slice(1),file=path.resolve(dist,relative);
   assert.ok(file.startsWith(dist+path.sep));if(relative==='favicon.ico'&&!fs.existsSync(file)){await route.fulfill({status:204,body:''});return;}
   assert.ok(fs.existsSync(file),'built static resource exists: '+relative);await route.fulfill({contentType:mime[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file),headers:staticHeaders(url.pathname)});
  }catch(error){routeErrors.push(error.message);await route.abort('blockedbyclient').catch(()=>{});}
 });
 await context.addInitScript(mockPose);
 if(tamper)await context.addInitScript(()=>{window.A1_FREE_BETA_MODE=true;window.freeBetaMode=true;localStorage.setItem('A1_FREE_BETA_MODE','true');localStorage.setItem('plan','PREMIUM');});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.exposeFunction('recordBetaCsp',v=>violations.push(v));await page.addInitScript(()=>document.addEventListener('securitypolicyviolation',e=>window.recordBetaCsp(e.effectiveDirective)));
 const trial={page,context,calls,errors,routeErrors,violations,apiResponses,stats,seen,release,host};trials.push(trial);
 await page.goto(host+entry,{waitUntil:'domcontentloaded'});
 if(host===origin&&!late&&policyMode!=='timeout')await page.waitForFunction(()=>__betaPolicyResponses.some(row=>row.credentials==='omit'));
 await page.evaluate(value=>A1I18n.setLanguage(value),lang);
 return trial;
}
async function assertNoPreview(page){assert.equal(await page.evaluate(()=>typeof A1Preview),'undefined');}
async function ready(page){await page.waitForFunction(()=>window.A1PublicBeta?.mode==='server-free-beta-local');await assertNoPreview(page);assert.equal(await page.evaluate(()=>__betaReady),1);assert.equal(await page.evaluate(()=>Object.isFrozen(A1PublicBeta)),true);}
async function search(page){await page.locator('#shopping-query').fill(query);await page.locator('#shopping-search-form button').click();await page.waitForFunction(()=>document.querySelector('#shopping-discovery')?.dataset.state==='ready');assert.equal(await page.locator('#shopping-discovery [data-discovery-id]').count(),2);}
async function analyze(page){await page.locator('#ai-photo').setInputFiles(path.join(dist,'assets/photos/man.jpg'));await page.locator('#ai-analyze').click();await page.waitForFunction(()=>!document.querySelector('#ai-result').hidden);}
function card(page){return page.locator('#shopping-discovery [data-discovery-id="'+id+'"]');}
async function select(page){const button=card(page).locator('[data-discovery-fit="'+id+'"]');await button.scrollIntoViewIfNeeded();await page.waitForFunction(id=>{const e=document.querySelector('#shopping-discovery [data-discovery-fit="'+id+'"]');return e&&!e.disabled;},id);await button.click();await page.waitForSelector('#lab-garment-photo-figure:not([hidden])');
 const preview=page.locator('#lab-garment-photo-preview'),bounds=await preview.boundingBox();
 for(const [x,y] of [[.15,.15],[.85,.15],[.8,.85],[.2,.85]])await preview.click({position:{x:x*bounds.width,y:y*bounds.height}});
 await page.locator('#lab-garment-outline-apply').click();
}
async function assertLocalGuards(page){
 assert.equal(await page.locator('#lab-open-compare').isDisabled(),true);assert.equal(await page.locator('#lab-open-avatar').isDisabled(),true);
 for(const selector of['#lab-fixtures','#lab-show-all','#lab-reload-image','#lab-fit-flow','#lab-fit-result'])assert.equal(await page.locator(selector).isVisible(),false,selector+' is unavailable in Production');
 await page.evaluate(()=>{document.querySelector('#lab-fixtures').click();document.querySelector('#lab-show-all').click();document.querySelector('#lab-fit').click();});
 assert.equal(await page.locator('[data-lab-product],[data-lab-select],[data-avatar-garment],[data-lab-catalog-compare],[data-lab-offer-compare]').count(),0);assert.equal(await page.locator('#lab-fit-result').isVisible(),false);assert.equal(await page.locator('#lab-comparison').isVisible(),false);
 assert.equal(await page.evaluate(()=>Object.keys(A1PublicBeta).some(key=>/member|entitle|authorize|plan|subscription/i.test(key))),false);
 assert.equal(await page.locator('#avatar-root,#gltf-proof-root').count(),0);
}
function networkClean(trial){
 assert.deepEqual(trial.routeErrors,[]);assert.deepEqual(trial.errors,[]);assert.deepEqual(trial.violations,[]);assert.equal(trial.stats.databaseCalls,0);assert.equal(trial.stats.forbiddenBindingReads,0);
 for(const req of trial.calls){assert.doesNotMatch(req.url,/shoulderHipRatio|legTorsoRatio|bodyPhoto|metrics|base64|memberEmail|man\.jpg/);if(req.method!=='GET'){assert.equal(new URL(req.url).pathname,'/api/stylist');const data=JSON.parse(req.postData);assert.equal(data.consents.analysis,false);assert.equal(data.consents.externalAI,false);assert.equal(data.metrics,undefined);assert.doesNotMatch(req.postData,/base64|bodyPhoto|data:image/);}}
}
async function sendStylist(page){await page.locator('#stylist-message').fill(query);await page.locator('#stylist-send').click();await page.waitForFunction(()=>!document.querySelector('#stylist-send').disabled);}
async function anonymousPrivateRequest(page,resource='watchlist'){return page.evaluate(async resource=>{const r=await fetch('/api/global/'+resource,{credentials:'same-origin',headers:{'X-A1-Free-Beta-Mode':'true','X-Plan':'PREMIUM'}});return{status:r.status,data:await r.json()};},resource);}
async function assertFailClosed(trial){await assertNoPreview(trial.page);assert.equal(await trial.page.evaluate(()=>typeof A1PublicBeta),'undefined');assert.equal(await trial.page.locator('#shopping-search').isVisible(),false);assert.equal(await trial.page.locator('#lab-entry').count(),0);assert.equal(await trial.page.evaluate(()=>__betaReady),0);}
(async()=>{
 for(const file of sources)assert.ok(fs.existsSync(path.join(root,file)),'final source exists: '+file);
 for(const file of sources.filter(file=>!file.startsWith('functions/')&&!file.startsWith('server/')&&!file.startsWith('scripts/')&&!file.startsWith('catalog/')))assert.equal(sha(fs.readFileSync(path.join(dist,file))),sha(fs.readFileSync(path.join(root,file))),'run build-site before testing: '+file);
 const before=Object.fromEntries(tracked.map(file=>[file,sha(fs.readFileSync(path.join(root,file)))]));
 const sourceHashes=Object.fromEntries(sources.map(file=>[file,sha(fs.readFileSync(path.join(root,file)))]));
 const distHashes=Object.fromEntries(['index.html','stylist.html','product-lab.html','assets/local-fashion-core.js','assets/public-beta-bootstrap.js','_headers'].map(file=>[file,sha(fs.readFileSync(path.join(dist,file)))]));
 const handlers={policy:await import(pathToFileURL(path.join(root,'functions/api/policy.js'))),stylist:await import(pathToFileURL(path.join(root,'functions/api/stylist.js'))),membership:await import(pathToFileURL(path.join(root,'functions/api/membership.js'))),global:await import(pathToFileURL(path.join(root,'functions/api/global/_shared.js')))};
 let providerCalls=0;const originalFetch=globalThis.fetch;globalThis.fetch=async()=>{providerCalls++;throw Error('PRIVATE provider/auth/network trap');};
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const report={actualProductionContact:false,allBrowserRequestsIntercepted:true,realRetailerPixels:false,realRetailerDownloadVerified:false,realCdnCorsVerified:false,merchantAcceptanceVerified:false,nativeIpadSafari:false,analysisMocked:true,privateRasterFixture:'dist/assets/photos/coat.jpg served at exact manifest CDN references; not a retailer photograph',actualPolicyHandler:true,actualStylistHandler:true,cases:[]};
 try{
  for(const profile of[{width:820,lang:'ko'},{width:390,lang:'en'}]){
   const trial=await prepare(browser,handlers,profile),{page}=trial;await ready(page);await search(page);
   assert.match(await card(page).innerText(),/49,900/);assert.match(await card(page).innerText(),profile.lang==='ko'?/재고 미확인/:/Stock (?:unknown|unconfirmed)/i);assert.equal(await card(page).locator('[data-discovery-buy]').getAttribute('href'),'https://www.musinsa.com/products/1168906');
   await analyze(page);const body=await page.locator('#ai-clean-canvas').evaluate(c=>c.toDataURL());await select(page);await assertLocalGuards(page);
   const selected=await page.evaluate(()=>A1CatalogFitting.current());assert.equal(selected.id,id);assert.equal(selected.stock,'unknown');assert.equal(selected.sourceKind,'operator-authorized-observation');assert.equal(selected.authorizationBasis,'operator-attestation');assert.equal(await page.evaluate(()=>__betaSelections),1);assert.equal(await page.locator('#ai-clean-canvas').evaluate(c=>c.toDataURL()),body);assert.equal(await page.locator('#lab-local-photo-consent').isChecked(),false);
   await page.locator('#lab-local-photo-fit').click();assert.equal(await page.locator('#lab-local-photo-result').isVisible(),false);await page.locator('#lab-local-photo-consent').check();await page.locator('#lab-local-photo-fit').click();await page.waitForSelector('#lab-local-photo-result:visible');
   const changedPixels=await page.evaluate(()=>{const a=document.querySelector('#ai-clean-canvas'),b=document.querySelector('#lab-local-photo-canvas'),x=a.getContext('2d').getImageData(0,0,a.width,a.height-50).data,y=b.getContext('2d').getImageData(0,0,b.width,b.height-50).data;let count=0;for(let i=0;i<x.length;i+=4)if(Math.abs(x[i]-y[i])+Math.abs(x[i+1]-y[i+1])+Math.abs(x[i+2]-y[i+2])>40)count++;return count;});assert.ok(changedPixels>1000);
   const fitted=await page.locator('#lab-local-photo-canvas').evaluate(c=>c.toDataURL());await page.locator('#lab-local-photo-before').check();assert.notEqual(await page.locator('#lab-local-photo-canvas').evaluate(c=>c.toDataURL()),fitted);await page.locator('#lab-local-photo-before').uncheck();
   await page.locator('#lab-local-photo-result').screenshot({path:path.join(out,'PRIVATE-production-local-2d-'+profile.lang+'-'+profile.width+'.png')});
   await page.locator('#lab-local-photo-consent').uncheck();assert.equal(await page.locator('#lab-local-photo-result').isVisible(),false);await page.locator('#ai-clear').click();assert.equal(await page.evaluate(()=>A1CatalogFitting.current()),null);for(const selector of['#ai-clean-canvas','#lab-local-photo-canvas','#lab-garment-photo-preview'])assert.equal(await page.locator(selector).evaluate(c=>c.width*c.height),1);assert.equal(await page.evaluate(()=>__betaUrls.size),0);
   for(const resource of['watchlist','account']){const denied=await anonymousPrivateRequest(page,resource);assert.equal(denied.status,401);assert.equal(denied.data.allowed,false);assert.equal(denied.data.watchlist,undefined);assert.equal(denied.data.identity,undefined);assert.equal(denied.data.plan,undefined);}
   const membership=trial.apiResponses.find(row=>row.path==='/api/membership'&&row.status===200);assert.equal(membership.data.plan,'FREE');assert.equal(membership.data.freeBetaMode,true);assert.equal(membership.data.accessUntil,null);
   assert.deepEqual(await page.evaluate(()=>Object.keys(sessionStorage)),[]);assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),['a1-fashion:language']);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   const policyFetch=await page.evaluate(()=>__betaFetches.find(row=>row.path==='/api/policy'&&row.credentials==='omit'));assert.deepEqual(policyFetch,{path:'/api/policy',method:'GET',credentials:'omit',cache:'no-store',redirect:'error',mode:'same-origin'});
   networkClean(trial);report.cases.push({name:'production-policy-search-photo-metadata-select-consent-same-photo-2d-compare-delete',profile,actualFactCandidates:2,changedPixels,separateConsent:true,bodySelections:1,globalMemberGrant:false,privateRasterOnly:true,passed:true});await trial.context.close();
  }
  {const trial=await prepare(browser,handlers,{entry:'/stylist'}),{page}=trial;await ready(page);await sendStylist(page);await page.waitForFunction(()=>document.querySelector('[data-stylist-public-beta] [data-stylist-discovery]')?.dataset.state==='ready');assert.equal(await page.locator('[data-stylist-discovery] [data-discovery-id]').count(),2);const post=trial.apiResponses.find(row=>row.path==='/api/stylist'&&row.method==='POST');assert.equal(post.status,200);assert.equal(post.data.mode,'DEMO');assert.equal(post.data.freeBetaMode,true);assert.deepEqual(post.data.products,[]);assert.equal(post.data.usage,null);assert.equal(post.data.comparison,null);assert.deepEqual(post.data.discounts,[]);assert.equal(await page.locator('.stylist-product').count(),0);await page.locator('#stylist-clear').click();assert.equal(await page.locator('[data-stylist-discovery]').count(),0);networkClean(trial);report.cases.push({name:'production-anonymous-actual-server-DEMO-then-separate-public-facts',frontendDemoFallback:false,passed:true});await trial.context.close();}
  for(const policyMode of['false','failed','mime','timeout']){
   const trial=await prepare(browser,handlers,{policyMode,tamper:true}),{page}=trial;await trial.seen;
   await page.evaluate(()=>document.dispatchEvent(new CustomEvent('a1:policy-ready',{detail:{freeBetaMode:true,plan:'PREMIUM',allowed:true}})));
   if(policyMode==='timeout'){await page.waitForTimeout(5250);trial.release();await page.waitForLoadState('networkidle');}
   await assertFailClosed(trial);await analyze(page);assert.equal(await page.locator('#ai-result').isVisible(),true);assert.equal(await page.locator('#lab-entry').count(),0);
   networkClean(trial);report.cases.push({name:'production-'+policyMode+'-policy-fails-closed-despite-cookie-storage-flag-event-tampering',photoAnalysisSurvives:true,passed:true});await trial.context.close();
  }
  {const trial=await prepare(browser,handlers,{entry:'/stylist',policyMode:'false',serverFlag:'false',tamper:true}),{page}=trial;await sendStylist(page);const post=trial.apiResponses.find(row=>row.path==='/api/stylist'&&row.method==='POST');assert.equal(post.status,401);assert.equal(post.data.error,'authentication_required');assert.equal(await page.locator('.stylist-message').count(),0);assert.equal(await page.locator('[data-stylist-discovery]').count(),0);await assertNoPreview(page);assert.equal(await page.evaluate(()=>typeof A1PublicBeta),'undefined');networkClean(trial);report.cases.push({name:'false-server-flag-keeps-production-stylist-membership-protected',clientFlagsCannotGrant:true,passed:true});await trial.context.close();}
  {const trial=await prepare(browser,handlers,{entry:'/stylist',policyMode:'mime',serverFlag:'true'}),{page}=trial;await sendStylist(page);const post=trial.apiResponses.find(row=>row.path==='/api/stylist'&&row.method==='POST');assert.equal(post.status,200);assert.equal(post.data.mode,'DEMO');assert.equal(await page.locator('.stylist-answer-mode').count(),1);assert.equal(await page.locator('[data-stylist-discovery]').count(),0);assert.equal(await page.evaluate(()=>typeof A1PublicBeta),'undefined');networkClean(trial);report.cases.push({name:'unverified-browser-policy-keeps-existing-production-server-DEMO-without-local-supplement',passed:true});await trial.context.close();}
  {const trial=await prepare(browser,handlers,{late:true}),{page}=trial;await trial.seen;await analyze(page);assert.equal(await page.locator('#lab-entry').count(),0);trial.release();await ready(page);await page.waitForSelector('#lab-entry:not([hidden])');assert.equal(await page.locator('#shopping-analysis-consent').isDisabled(),false);assert.equal(await page.evaluate(()=>__betaSelections),1);await search(page);await select(page);assert.equal(await page.locator('#lab-local-photo-consent').isChecked(),false);await page.locator('#ai-clear').click();networkClean(trial);report.cases.push({name:'late-server-policy-replays-current-analysis-without-photo-reselection-or-consent',passed:true});await trial.context.close();}
  {const trial=await prepare(browser,handlers,{entry:'/stylist',late:true}),{page}=trial;await trial.seen;await sendStylist(page);assert.equal(trial.apiResponses.find(row=>row.method==='POST')?.status,200);assert.equal(await page.locator('[data-stylist-discovery]').count(),0);trial.release();await ready(page);await page.waitForFunction(()=>document.querySelector('[data-stylist-discovery]')?.dataset.state==='ready');assert.equal(await page.locator('[data-stylist-discovery] [data-discovery-id]').count(),2);assert.equal(trial.calls.filter(row=>row.method==='POST').length,1);networkClean(trial);report.cases.push({name:'late-server-policy-attaches-facts-to-completed-real-server-DEMO-once',passed:true});await trial.context.close();}
  {const trial=await prepare(browser,handlers,{entry:'/stylist',late:true}),{page}=trial;await trial.seen;await sendStylist(page);await page.locator('#stylist-clear').click();trial.release();await ready(page);await page.waitForLoadState('networkidle');assert.equal(await page.locator('.stylist-message,[data-stylist-discovery]').count(),0);assert.equal(trial.calls.filter(row=>new URL(row.url).pathname==='/assets/observed-products.json').length,0);networkClean(trial);report.cases.push({name:'late-policy-never-resurrects-cleared-server-DEMO-or-public-facts',passed:true});await trial.context.close();}
  {const trial=await prepare(browser,handlers,{late:true}),{page}=trial;await trial.seen;await analyze(page);await page.locator('#ai-clear').click();trial.release();await ready(page);await page.waitForLoadState('networkidle');assert.equal(await page.locator('#lab-entry').isVisible(),false);assert.equal(await page.locator('#shopping-analysis-consent').isDisabled(),true);assert.equal(await page.locator('#ai-result').isVisible(),false);assert.equal(await page.evaluate(()=>__betaUrls.size),0);networkClean(trial);report.cases.push({name:'late-policy-never-replays-cleared-analysis-or-consent',passed:true});await trial.context.close();}
  {const trial=await prepare(browser,handlers,{host:previewOrigin}),{page}=trial;await page.waitForFunction(()=>!!window.A1Preview);assert.equal(await page.evaluate(()=>typeof A1PublicBeta),'undefined');await search(page);assert.equal(trial.calls.filter(row=>new URL(row.url).pathname.startsWith('/api/')).length,0);networkClean(trial);report.cases.push({name:'preview-local-search-remains-isolated-with-zero-api-requests',passed:true});await trial.context.close();}
  assert.equal(providerCalls,0);for(const[file,hash]of Object.entries(before))assert.equal(sha(fs.readFileSync(path.join(root,file))),hash,'source data unchanged: '+file);
  for(const[file,hash]of Object.entries(sourceHashes))assert.equal(sha(fs.readFileSync(path.join(root,file))),hash,'tested source unchanged: '+file);
  for(const[file,hash]of Object.entries(distHashes))assert.equal(sha(fs.readFileSync(path.join(dist,file))),hash,'tested dist unchanged: '+file);report.passed=true;
 }catch(error){report.failure=error.stack;throw error;}finally{
  report.providerAuthNetworkCalls=providerCalls;report.transportTrials=trials.map(trial=>({requestCount:trial.calls.length,apiRequests:trial.calls.filter(row=>new URL(row.url).pathname.startsWith('/api/')).map(row=>({path:new URL(row.url).pathname,method:row.method})),...trial.stats,routeErrors:trial.routeErrors,pageErrors:trial.errors,cspViolations:trial.violations}));report.sourceHashes=sourceHashes;report.distHashes=distHashes;fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2)+'\n');globalThis.fetch=originalFetch;await browser.close();
 }
 console.log(JSON.stringify({passed:report.passed,cases:report.cases.length,actualProductionContact:false,realRetailerPixels:false,nativeIpadSafari:false}));
})().catch(error=>{console.error(error);process.exitCode=1;});
