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
const imageManifestPath='assets/product-images.json';
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.glb':'model/gltf-binary','.wasm':'application/wasm'};
const tracked=['assets/approved-products.json','catalog/source-approvals.json','assets/observed-products.json','assets/product-images.json'];
const sources=['assets/local-fashion-core.js','assets/public-beta-bootstrap.js','assets/preview-experience.js','assets/shopping-search.js','assets/product-discovery-view.js','assets/catalog-fitting.js','assets/lab-entry.js','assets/lab-loader.js','assets/product-lab.js','assets/stylist.js','assets/ai-studio.js','index.html','stylist.html','product-lab.html','functions/api/policy.js','functions/api/stylist.js','server/free-beta.mjs','server/ai-stylist.mjs','scripts/build-site.cjs','scripts/lib/catalog-public-headers.cjs','assets/photos/coat.jpg',...tracked];
sources.push('fitting-studio.html','gltf-proof.html','assets/fitting-studio-view.html','assets/main-fitting-studio.css','assets/avatar-photo-bridge.js','assets/fitting-studio-3d.js','assets/gltf-proof.js','assets/natural-avatar-fit.js','assets/nova-avatar/avatar.glb','assets/proportion-controls.js','assets/proportion-recommendations.js','assets/shopping-conversation.js','assets/site-navigation.js');
function instrumentPage({realPose}){
 const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);window.__betaUrls=new Set();window.__betaSelections=0;window.__betaReady=0;window.__localReady=0;window.__betaFetches=[];window.__betaPolicyResponses=[];
 URL.createObjectURL=blob=>{const url=create(blob);__betaUrls.add(url);return url;};URL.revokeObjectURL=url=>{__betaUrls.delete(url);revoke(url);};
 document.addEventListener('change',event=>{if(event.target.id==='ai-photo')__betaSelections++;});
 document.addEventListener('a1:public-beta-ready',()=>{if(window.A1PublicBeta)__betaReady++;});
 document.addEventListener('a1:public-local-ready',()=>{if(window.A1PublicLocal)__localReady++;});
 const nativeFetch=window.fetch;window.fetch=(input,options={})=>{const record={path:new URL(typeof input==='string'?input:input.url,location.href).pathname,method:options.method||'GET',credentials:options.credentials,cache:options.cache,redirect:options.redirect,mode:options.mode};__betaFetches.push(record);return nativeFetch(input,options).then(response=>{if(record.path==='/api/policy')__betaPolicyResponses.push({credentials:options.credentials,status:response.status,type:response.headers.get('Content-Type')});return response;});};
 if(!realPose)window.Pose=class{setOptions(){}onResults(fn){this.result=fn;}async initialize(){}async reset(){}async close(){}async send(){const p=Array.from({length:33},()=>({x:.5,y:.5,visibility:.99}));for(const[index,[x,y]]of Object.entries({11:[.3,.2],12:[.7,.2],23:[.36,.45],24:[.64,.45],25:[.36,.65],26:[.64,.65],27:[.36,.9],28:[.64,.9]}))p[index]={x,y,visibility:.99};this.result({poseLandmarks:p});}};
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
function privateGarmentFixture(){
 const raster=fs.readFileSync(path.join(dist,'assets/photos/coat.jpg'));
 const {bytes,width,height,sha256}=require('../scripts/lib/product-image-file.cjs').inspectProductImage(raster);
 const product=JSON.parse(fs.readFileSync(path.join(dist,'assets/observed-products.json'),'utf8')).products.find(row=>row.id===id);
 const imageUrl='/assets/catalog-images/'+id+'.jpg',now=Date.now();
 return {raster,imageUrl,manifest:{
  version:1,authorization:{basis:'operator-attestation',reference:'private-browser-fixture',recordedAt:now,validUntil:now+3600000,display:true,local2DFitting:true,externalProcessing:false},
  products:[{id,productUrl:product.productUrl,sourceImageUrl:'https://image.msscdn.net/thumbnails/images/goods_img/20000101/1/private-fixture.jpg?w=100',
   imageUrl,delivery:'local-copy',sha256,bytes,width,height,imageKind:'unverified',checkedAt:now}]
 }};
}
async function prepare(browser,handlers,{width=820,height=1180,touch=true,lang='ko',entry='/',host=origin,policyMode='true',serverFlag=policyMode==='false'?'false':'true',tamper=false,late=false,realPose=false,imageFixture=null}={}){
 const context=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch,locale:lang==='ko'?'ko-KR':'en-US',serviceWorkers:'block'});
 const calls=[],errors=[],routeErrors=[],violations=[],apiResponses=[],stats={databaseCalls:0,forbiddenBindingReads:0};
 const env=environment(serverFlag,stats),privateEnv=environment('false',stats);privateEnv.A1_FREE_BETA_MODE=serverFlag;
 let release,notice;const gate=new Promise(r=>release=r),seen=new Promise(r=>notice=r);
 if(tamper)await context.addCookies([{name:'A1_FREE_BETA_MODE',value:'true',url:host},{name:'paid',value:'true',url:host},{name:'plan',value:'PREMIUM',url:host}]);
 const imageManifest=imageFixture?.manifest||JSON.parse(fs.readFileSync(path.join(dist,imageManifestPath),'utf8'));
 const allowedImages=new Set(imageManifest.products.map(row=>row.imageUrl));
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
   if(imageFixture&&url.pathname==='/'+imageManifestPath){assert.equal(url.search,'');await route.fulfill({json:imageFixture.manifest});return;}
   if(imageFixture&&url.pathname===imageFixture.imageUrl){assert.equal(url.search,'');await route.fulfill({contentType:'image/jpeg',body:imageFixture.raster});return;}
   if(url.pathname.endsWith('.html')){await route.fulfill({status:308,headers:{Location:url.pathname.slice(0,-5)},body:''});return;}
   const htmlRoute=/^\/(?:stylist|product-lab|fitting-studio|gltf-proof|global|account|assets\/fitting-studio-view)$/.test(url.pathname);
   const relative=url.pathname==='/'?'index.html':url.pathname.slice(1)+(htmlRoute?'.html':''),file=path.resolve(dist,relative);
   assert.ok(file.startsWith(dist+path.sep));if(relative==='favicon.ico'&&!fs.existsSync(file)){await route.fulfill({status:204,body:''});return;}
   assert.ok(fs.existsSync(file),'built static resource exists: '+relative);await route.fulfill({contentType:mime[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file),headers:staticHeaders(url.pathname)});
  }catch(error){routeErrors.push(error.message);await route.abort('blockedbyclient').catch(()=>{});}
 });
 await context.addInitScript(instrumentPage,{realPose});
 if(tamper)await context.addInitScript(()=>{window.A1_FREE_BETA_MODE=true;window.freeBetaMode=true;localStorage.setItem('A1_FREE_BETA_MODE','true');localStorage.setItem('plan','PREMIUM');});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.exposeFunction('recordBetaCsp',v=>violations.push(v));await page.addInitScript(()=>document.addEventListener('securitypolicyviolation',e=>window.recordBetaCsp(e.effectiveDirective)));
 const trial={page,context,calls,errors,routeErrors,violations,apiResponses,stats,seen,release,host};trials.push(trial);
 await page.goto(host+entry,{waitUntil:'domcontentloaded'});
 if(host===origin&&!late&&policyMode!=='timeout')await page.waitForFunction(()=>__betaPolicyResponses.some(row=>row.credentials==='omit'));
 await page.evaluate(value=>A1I18n.setLanguage(value),lang);
 return trial;
}
async function assertNoPreview(page){assert.equal(await page.evaluate(()=>typeof A1Preview),'undefined');}
async function ready(page,{free=true}={}){
 await page.waitForFunction(()=>window.A1PublicLocal?.mode==='server-public-local');await assertNoPreview(page);
 assert.equal(await page.evaluate(()=>__localReady),1);assert.equal(await page.evaluate(()=>Object.isFrozen(A1PublicLocal)),true);
 if(free){assert.equal(await page.evaluate(()=>A1PublicBeta?.mode),'server-free-beta-local');assert.equal(await page.evaluate(()=>__betaReady),1);assert.equal(await page.evaluate(()=>Object.isFrozen(A1PublicBeta)),true);}
 else{assert.equal(await page.evaluate(()=>typeof A1PublicBeta),'undefined');assert.equal(await page.evaluate(()=>__betaReady),0);}
}
async function search(page){await page.locator('#shopping-query').fill(query);await page.locator('#shopping-search-form button').click();await page.waitForFunction(()=>document.querySelector('#shopping-discovery')?.dataset.state==='ready');assert.equal(await page.locator('#shopping-discovery [data-discovery-id]').count(),2);}
async function analyze(page){await page.locator('#ai-photo').setInputFiles(path.join(dist,'assets/photos/man.jpg'));await page.locator('#ai-analyze').click();await page.waitForFunction(()=>!document.querySelector('#ai-result').hidden);}
function card(page){return page.locator('#shopping-discovery [data-discovery-id="'+id+'"]');}
async function select(page){const button=card(page).locator('[data-discovery-fit="'+id+'"]');await button.scrollIntoViewIfNeeded();await page.waitForFunction(id=>{const e=document.querySelector('#shopping-discovery [data-discovery-fit="'+id+'"]');return e&&!e.disabled;},id);await button.click();await page.waitForSelector('#lab-garment-photo-figure:not([hidden])');
 const preview=page.locator('#lab-garment-photo-preview'),bounds=await preview.boundingBox();
 for(const [x,y] of [[.15,.15],[.85,.15],[.8,.85],[.2,.85]])await preview.click({position:{x:x*bounds.width,y:y*bounds.height}});
 await page.locator('#lab-garment-outline-apply').click();
}
async function assertLocalGuards(page){
 assert.equal(await page.locator('#lab-open-compare').isDisabled(),true);assert.equal(await page.locator('#lab-open-avatar').isDisabled(),false);
 assert.equal(await page.locator('#avatar-reference-consent').isChecked(),false);
 for(const selector of['#lab-fixtures','#lab-show-all','#lab-reload-image','#lab-fit-flow','#lab-fit-result'])assert.equal(await page.locator(selector).isVisible(),false,selector+' is unavailable in Production');
 await page.evaluate(()=>{document.querySelector('#lab-fixtures').click();document.querySelector('#lab-show-all').click();document.querySelector('#lab-fit').click();});
 assert.equal(await page.locator('[data-lab-product],[data-lab-select],[data-avatar-garment],[data-lab-catalog-compare],[data-lab-offer-compare]').count(),0);assert.equal(await page.locator('#lab-fit-result').isVisible(),false);assert.equal(await page.locator('#lab-comparison').isVisible(),false);
 for(const surface of ['A1PublicLocal','A1PublicBeta'])assert.equal(await page.evaluate(name=>Object.keys(window[name]).some(key=>/member|entitle|authorize|plan|subscription/i.test(key)),surface),false);
 assert.equal(await page.locator('#avatar-root,#gltf-proof-root').count(),0);
 assert.equal(await page.locator('#main-fitting-studio #main-fitting-lab #lab-local-photo-fitting').count(),1);
}
function networkClean(trial){
 assert.deepEqual(trial.routeErrors,[]);assert.deepEqual(trial.errors,[]);assert.deepEqual(trial.violations,[]);assert.equal(trial.stats.databaseCalls,0);assert.equal(trial.stats.forbiddenBindingReads,0);
 for(const req of trial.calls){assert.doesNotMatch(req.url,/shoulderHipRatio|legTorsoRatio|bodyPhoto|metrics|base64|memberEmail|man\.jpg/);if(req.method!=='GET'){assert.equal(new URL(req.url).pathname,'/api/stylist');const data=JSON.parse(req.postData);assert.equal(data.consents.analysis,false);assert.equal(data.consents.externalAI,false);assert.equal(data.metrics,undefined);assert.doesNotMatch(req.postData,/base64|bodyPhoto|data:image/);}}
}
async function sendStylist(page){await page.locator('#stylist-message').fill(query);await page.locator('#stylist-send').click();await page.waitForFunction(()=>!document.querySelector('#stylist-send').disabled);}
async function anonymousPrivateRequest(page,resource='watchlist'){return page.evaluate(async resource=>{const r=await fetch('/api/global/'+resource,{credentials:'same-origin',headers:{'X-A1-Free-Beta-Mode':'true','X-Plan':'PREMIUM'}});return{status:r.status,data:await r.json()};},resource);}
async function assertFailClosed(trial){await assertNoPreview(trial.page);assert.equal(await trial.page.evaluate(()=>typeof A1PublicBeta),'undefined');assert.equal(await trial.page.evaluate(()=>typeof A1PublicLocal),'undefined');assert.equal(await trial.page.locator('#shopping-search').isVisible(),false);assert.equal(await trial.page.locator('#lab-entry').count(),0);assert.deepEqual(await trial.page.evaluate(()=>[__localReady,__betaReady]),[0,0]);}

function assertEmbeddedTransport(trial,initialUrl){
 assert.equal(trial.page.url(),initialUrl,'photo fitting stays on the homepage at the same URL');
 assert.deepEqual(trial.calls.filter(call=>call.navigation).map(call=>call.url),[trial.host+'/']);
 assert.equal(trial.context.pages().length,1);
 assert.ok(!trial.calls.some(call=>/^\/(?:fitting-studio|gltf-proof)(?:\.html)?(?:\/|$)/.test(new URL(call.url).pathname)),
  'the embedded studio does not fetch a standalone page or a proof HTML template');
}

async function startEmbeddedPhoto(trial,{throughNavigation=false}={}){
 const {page}=trial;
 await ready(page,{free:false});
 if(throughNavigation){
  await page.locator('[data-site-link=fitting]').click();
  await page.waitForURL(trial.host+'/#main-fitting-studio');
 }
 const studio=page.locator('#main-fitting-studio'),photo=studio.locator('#ai-studio');
 const panel=studio.locator('#studio-3d-panel'),avatar=panel.locator('#gltf-proof-root');
 const analysisConsent=photo.locator('#avatar-reference-consent'),initialUrl=page.url();
 assert.equal(await studio.isVisible(),true);
 assert.equal(await photo.count(),1);
 assert.equal(await panel.count(),1,'the live viewer panel belongs to the homepage studio before analysis');
 assert.equal(await page.locator('#ai-photo').count(),1);
 assert.equal(await photo.locator('#ai-photo').isVisible(),true);
 assert.equal(await analysisConsent.isChecked(),false);
 assert.equal(await avatar.isVisible(),false);
 assert.ok(!trial.calls.some(call=>new URL(call.url).pathname==='/assets/fitting-studio-view'));
 assert.ok(!trial.calls.some(call=>new URL(call.url).pathname.endsWith('.glb')),'no model download before the visitor starts fitting');
 await photo.locator('#ai-photo').setInputFiles(path.join(dist,'assets/photos/man.jpg'));
 await photo.locator('#ai-analyze-fit').click();
 await page.waitForFunction(()=>{
  const frame=window.A1GltfProof?.snapshot();
  return frame?.state==='ready'&&frame.look==='nova'&&frame.bodyFitted&&frame.bodyFitAxes.length>0&&frame.renderCount>0;
 },null,{timeout:90000});
 await page.waitForFunction(()=>{
  const rect=document.querySelector('#main-fitting-studio #gltf-canvas')?.getBoundingClientRect();
  if(!rect||rect.width<=0||rect.height<=0)return false;
  const visibleHeight=Math.min(rect.bottom,innerHeight)-Math.max(rect.top,0);
  return rect.left>=0&&rect.right<=innerWidth+1&&visibleHeight>=Math.min(220,rect.height/2);
 },null,{timeout:8000}).catch(async error=>{
  const layout=await page.evaluate(()=>({viewport:[innerWidth,innerHeight],scrollY,
   canvas:document.querySelector('#main-fitting-studio #gltf-canvas')?.getBoundingClientRect().toJSON()}));
  console.error('Embedded avatar viewport:',layout);
  await page.screenshot({path:path.join(out,'PRIVATE-embedded-visibility-failure-'+layout.viewport[0]+'.png')});
  throw error;
 });
 assert.equal(await analysisConsent.isChecked(),true);
 assert.equal(await avatar.isVisible(),true);
 assert.equal(await page.evaluate(()=>__betaSelections),1);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.equal(trial.calls.filter(call=>new URL(call.url).pathname==='/assets/fitting-studio-view').length,1);
 assertEmbeddedTransport(trial,initialUrl);
 return {studio,photo,panel,avatar,analysisConsent,initialUrl};
}

async function resetEmbeddedPhoto(page,{photo,avatar,analysisConsent}){
 await photo.locator('#ai-clear').click();
 assert.equal(await avatar.isVisible(),false);
 assert.equal(await page.locator('#avatar-recommendation-results').isVisible(),false);
 assert.equal(await analysisConsent.isChecked(),false);
 assert.equal(await photo.locator('#ai-clean-canvas').evaluate(canvas=>canvas.width*canvas.height),1);
 assert.equal(await page.evaluate(()=>window.A1GltfProof.snapshot().bodyFitted),false);
 assert.equal(await page.evaluate(()=>__betaUrls.size),0);
}

async function verifyPhotoToAvatar(trial){
 const {page}=trial;
 await page.waitForSelector('#shopping-search:visible');
 const embedded=await startEmbeddedPhoto(trial,{throughNavigation:true});
 const {avatar,initialUrl}=embedded;
 const results=page.locator('#avatar-recommendation-results'),cards=results.locator('[data-discovery-id]'),canvas=avatar.locator('#gltf-canvas');
 await page.waitForSelector('#avatar-recommendation-results[data-state="ready"]:visible');
 assert.equal(await cards.first().getAttribute('data-discovery-id'),'musinsa-4644434','reported shoulder ratio drives the first result');
 assert.match(await cards.first().locator('[data-proportion-reasons]').innerText(),/어깨와 골반|여유핏/);
 assert.equal(await cards.first().locator('[data-discovery-buy]').getAttribute('href'),'https://www.musinsa.com/products/4644434');
 const fittedFrame=sha(await canvas.screenshot());
 await cards.first().locator('[data-avatar-sample="musinsa-4644434"]').click();
 await page.waitForFunction(()=>{const frame=window.A1GltfProof?.snapshot();return frame?.bodyFitted&&frame.garment==='relaxed-trousers';});
 const trouserFrame=sha(await canvas.screenshot());
 assert.notEqual(trouserFrame,fittedFrame,'the recommended trouser silhouette renders on the fitted body');

 const measurements=avatar.locator('#avatar-proportion-input');
 await measurements.locator('summary').click();
 await measurements.locator('[data-proportion-field=shoulderWidthCm]').fill('34');
 await measurements.locator('[data-proportion-field=hipWidthCm]').fill('41');
 await measurements.locator('#avatar-proportion-apply').click();
 const cardigan='29cm-4145774';
 await page.waitForFunction(id=>document.querySelector('#avatar-recommendation-results [data-discovery-id]')?.dataset.discoveryId===id,cardigan);
 assert.match(await cards.first().locator('[data-proportion-reasons]').innerText(),/어깨와 골반|카디건/);
 const measuredFrame=sha(await canvas.screenshot());
 assert.notEqual(measuredFrame,trouserFrame,'correcting the profile updates the actual body render');

 await cards.first().locator('[data-avatar-sample="'+cardigan+'"]').click();
 await page.waitForFunction(()=>{const frame=window.A1GltfProof?.snapshot();return frame?.bodyFitted&&frame.garment==='navy';});
 assert.match(await page.locator('#avatar-selected-recommendation').innerText(),/가디건/);
 assert.match(await page.locator('#avatar-selected-recommendation').innerText(),/3D 예시 의상/);
 assert.notEqual(sha(await canvas.screenshot()),measuredFrame,'selecting an admissible sample changes its visible garment');
 await canvas.screenshot({path:path.join(out,'PRIVATE-production-personalized-3d.png')});

 await measurements.locator('#avatar-proportion-reset').click();
 await page.waitForFunction(()=>document.querySelector('#avatar-recommendation-results [data-discovery-id]')?.dataset.discoveryId==='musinsa-4644434');
 const input=avatar.locator('#avatar-conversation-input'),send=avatar.locator('#avatar-conversation-send'),replies=avatar.locator('#avatar-conversation-replies');
 const apiBefore=trial.calls.filter(call=>new URL(call.url).pathname.startsWith('/api/')).length;
 await input.fill('검정 슬랙스');await send.click();
 await page.waitForFunction(()=>{const ids=[...document.querySelectorAll('#avatar-recommendation-results [data-discovery-id]')].map(card=>card.dataset.discoveryId);return ids.length===2&&ids.includes('musinsa-1168906')&&ids.includes('musinsa-4644434');});
 await replies.getByText(/검정.*슬랙스/).first().waitFor();
 await input.fill('와이드핏으로');await send.click();
 await page.waitForFunction(id=>{const cards=document.querySelectorAll('#avatar-recommendation-results [data-discovery-id]');return cards.length===1&&cards[0].dataset.discoveryId===id;},id);
 await replies.getByText(/와이드/).first().waitFor();
 await avatar.locator('#avatar-conversation').screenshot({path:path.join(out,'PRIVATE-production-local-style-chat.png')});
 await input.fill('흰색으로');await send.click();
 await replies.getByText(/현재 확인된 상품 중 이 조건과 맞는 후보가 없습니다/).waitFor();
 assert.equal(await cards.count(),0,'the dialogue returns an empty result rather than unrelated garments');
 assert.equal(trial.calls.filter(call=>new URL(call.url).pathname.startsWith('/api/')).length,apiBefore,'the immediate dialogue performs no API requests');
 assert.equal(await page.evaluate(()=>window.A1GltfProof.snapshot().bodyFitted),true);
 assert.deepEqual(await page.evaluate(()=>Object.keys(sessionStorage)),[]);
 assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),['a1-fashion:language']);

 await resetEmbeddedPhoto(page,embedded);
 assertEmbeddedTransport(trial,initialUrl);
 networkClean(trial);
}

async function verifyOfficialStudio(trial){
 const {page}=trial;
 await ready(page,{free:false});
 const open=page.locator('[data-studio-mode=three]');
 assert.equal(await open.isDisabled(),false);
 await open.click();
 await page.waitForFunction(()=>{const frame=window.A1GltfProof?.snapshot();return frame?.state==='ready'&&frame.look==='nova'&&frame.triangles>0;},null,{timeout:30000});
 assert.ok(trial.calls.some(call=>new URL(call.url).pathname==='/assets/nova-avatar/avatar.glb'));
 assert.equal(trial.calls.some(call=>new URL(call.url).pathname==='/assets/natural-avatar/sample.glb'),false);
 networkClean(trial);
}

async function verifyRealInference(trial){
 const {page}=trial;
 const vendor=()=>trial.calls.filter(call=>new URL(call.url).pathname.startsWith('/assets/vendor/mediapipe/'));
 assert.equal(vendor().length,0);
 const embedded=await startEmbeddedPhoto(trial);
 assert.ok(vendor().some(call=>new URL(call.url).pathname.endsWith('/pose_landmark_lite.tflite')));
 assert.ok(vendor().some(call=>new URL(call.url).pathname.endsWith('.wasm')));
 await embedded.avatar.locator('#avatar-recommendation-results[data-state="ready"]').waitFor();
 assert.ok(await embedded.avatar.locator('#avatar-recommendation-results [data-discovery-id]').count()>0);
 await embedded.avatar.locator('#gltf-canvas').screenshot({path:path.join(out,'PRIVATE-production-real-inference-3d.png')});
 await resetEmbeddedPhoto(page,embedded);
 assertEmbeddedTransport(trial,embedded.initialUrl);
 networkClean(trial);
}

async function verifyMobileConsent(trial){
 const {page}=trial,embedded=await startEmbeddedPhoto(trial),{photo,avatar,analysisConsent,initialUrl}=embedded;
 await page.screenshot({path:path.join(out,'PRIVATE-production-mobile-studio-viewport.png')});
 const results=avatar.locator('#avatar-recommendation-results');
 await avatar.locator('#avatar-recommendation-results[data-state="ready"]').waitFor();
 const originalPhoto=await photo.locator('#ai-clean-canvas').evaluate(canvas=>canvas.toDataURL());
 await avatar.locator('#avatar-proportion-consent').uncheck();
 await page.waitForFunction(()=>window.A1GltfProof?.snapshot().bodyFitted===false);
 assert.equal(await analysisConsent.isChecked(),false);
 assert.equal(await results.isVisible(),false);
 assert.equal(await avatar.locator('#avatar-conversation').isVisible(),false);
 assert.equal(await photo.locator('#ai-clean-canvas').evaluate(canvas=>canvas.toDataURL()),originalPhoto,'withdrawal preserves the existing local analysis for a later choice');
 await analysisConsent.check();
 await photo.locator('#lab-open-avatar').click();
 await page.waitForFunction(()=>window.A1GltfProof?.snapshot().bodyFitted===true);
 await avatar.locator('#avatar-recommendation-results[data-state="ready"]').waitFor();
 assert.equal(await page.evaluate(()=>__betaSelections),1);
 await avatar.locator('#gltf-canvas').screenshot({path:path.join(out,'PRIVATE-production-mobile-3d.png')});
 await resetEmbeddedPhoto(page,embedded);
 assertEmbeddedTransport(trial,initialUrl);
 networkClean(trial);
}
async function verifyExpiredImages(trial){
 const {page,host,calls}=trial;
 await ready(page);await search(page);
 await page.waitForSelector('#shopping-discovery[data-image-state="ready"][data-image-count="0"]');
 assert.match(await card(page).innerText(),/49,900/);
 assert.equal(await card(page).locator('[data-discovery-buy]').getAttribute('href'),'https://www.musinsa.com/products/1168906');
 assert.equal(await page.locator('#shopping-discovery .product-discovery-media,#shopping-discovery [data-discovery-fit]').count(),0);
 await page.evaluate(id=>A1CatalogFitting.openObserved(id),id);
 assert.equal(await page.evaluate(()=>A1CatalogFitting.current()),null);
 assert.match(await page.locator('#catalog-fitting-status').innerText(),/이용 권한이 확인되지/);
 assert.ok(calls.every(call=>new URL(call.url).origin===host));
 networkClean(trial);
}
(async()=>{
 for(const file of sources)assert.ok(fs.existsSync(path.join(root,file)),'final source exists: '+file);
 for(const file of sources.filter(file=>file!==imageManifestPath&&!file.startsWith('functions/')&&!file.startsWith('server/')&&!file.startsWith('scripts/')&&!file.startsWith('catalog/')))assert.equal(sha(fs.readFileSync(path.join(dist,file))),sha(fs.readFileSync(path.join(root,file))),'run build-site before testing: '+file);
 const sourceImages=fs.readFileSync(path.join(root,imageManifestPath)),builtImages=fs.readFileSync(path.join(dist,imageManifestPath));
 const authorization=JSON.parse(sourceImages).authorization,expired=authorization!==null&&authorization.validUntil<=Date.now();
 if(expired)assert.deepEqual(JSON.parse(builtImages),{version:1,authorization:null,products:[]},'run build-site with the current clock to remove expired merchant images');
 else assert.deepEqual(builtImages,sourceImages,'run build-site before testing: '+imageManifestPath);
 const imageFixture=expired?privateGarmentFixture():null;
 const before=Object.fromEntries(tracked.map(file=>[file,sha(fs.readFileSync(path.join(root,file)))]));
 const sourceHashes=Object.fromEntries(sources.map(file=>[file,sha(fs.readFileSync(path.join(root,file)))]));
 const distHashes=Object.fromEntries(['index.html','stylist.html','product-lab.html','assets/local-fashion-core.js','assets/public-beta-bootstrap.js',imageManifestPath,'_headers'].map(file=>[file,sha(fs.readFileSync(path.join(dist,file)))]));
 const handlers={policy:await import(pathToFileURL(path.join(root,'functions/api/policy.js'))),stylist:await import(pathToFileURL(path.join(root,'functions/api/stylist.js'))),membership:await import(pathToFileURL(path.join(root,'functions/api/membership.js'))),global:await import(pathToFileURL(path.join(root,'functions/api/global/_shared.js')))};
 let providerCalls=0;const originalFetch=globalThis.fetch;globalThis.fetch=async()=>{providerCalls++;throw Error('PRIVATE provider/auth/network trap');};
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const report={actualProductionContact:false,allBrowserRequestsIntercepted:true,realRetailerPixels:false,realRetailerDownloadVerified:false,realCdnCorsVerified:false,merchantAcceptanceVerified:false,nativeIpadSafari:false,analysisModes:['deterministic fixture','bundled local MediaPipe'],merchantImageAuthorizationExpired:expired,privateRasterFixture:imageFixture?'dist/assets/photos/coat.jpg served only to isolated 2D browser contexts from a synthetic same-origin image manifest':'dist/assets/photos/coat.jpg served to isolated browser contexts at exact manifest CDN references',actualPolicyHandler:true,actualStylistHandler:true,cases:[]};
 try{
  if(expired){
   const trial=await prepare(browser,handlers);
   await verifyExpiredImages(trial);
   report.cases.push({name:'expired-merchant-images-leave-facts-and-block-image-fitting',realBuiltManifest:true,merchantImageRequests:0,passed:true});await trial.context.close();
  }
  for(const profile of[{width:820,lang:'ko'},{width:390,lang:'en'}]){
   const trial=await prepare(browser,handlers,{...profile,imageFixture}),{page}=trial;await ready(page);await search(page);
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
  {const profile={width:1366,height:900,touch:false},trial=await prepare(browser,handlers,{...profile,policyMode:'false'});
   await verifyPhotoToAvatar(trial);
   report.cases.push({name:'production-homepage-embedded-desktop-studio-photo-automatic-nova-evidence-ranked-outfit-and-dialogue',profile,serverFreeBeta:false,samePage:true,standaloneHtmlRequests:0,realGeometry:true,privatePoseFixture:true,manualProportionsRerank:true,sampleOutfit:true,localFollowUps:true,passed:true});
   await trial.context.close();}
  {const profile={width:820,height:1180,touch:true},trial=await prepare(browser,handlers,{...profile,policyMode:'false',realPose:true});
   await verifyRealInference(trial);
   report.cases.push({name:'production-homepage-embedded-tablet-studio-real-mediapipe-automatically-renders-personalized-nova-and-clothes',profile,samePage:true,standaloneHtmlRequests:0,realInference:true,realGeometry:true,passed:true});
   await trial.context.close();}
  {const profile={width:390,height:844,touch:true},trial=await prepare(browser,handlers,{...profile,policyMode:'false'});
   await verifyMobileConsent(trial);
   report.cases.push({name:'production-homepage-embedded-phone-studio-withdraw-and-reapply-consent-with-the-same-photo-then-reset',profile,samePage:true,standaloneHtmlRequests:0,photoSelections:1,passed:true});
   await trial.context.close();}
  {const trial=await prepare(browser,handlers,{entry:'/fitting-studio',policyMode:'false'});
   await verifyOfficialStudio(trial);
   report.cases.push({name:'production-studio-loads-real-default-nova-after-trusted-local-capability',serverFreeBeta:false,passed:true});
   await trial.context.close();}
  for(const policyMode of['failed','mime','timeout']){
   const trial=await prepare(browser,handlers,{policyMode,tamper:true}),{page}=trial;await trial.seen;
   await page.evaluate(()=>{document.dispatchEvent(new CustomEvent('a1:policy-ready',{detail:{freeBetaMode:true,plan:'PREMIUM',allowed:true}}));document.dispatchEvent(new CustomEvent('a1:public-local-ready'));});
   if(policyMode==='timeout'){await page.waitForTimeout(5250);trial.release();await page.waitForLoadState('networkidle');}
   await assertFailClosed(trial);await analyze(page);assert.equal(await page.locator('#ai-result').isVisible(),true);assert.equal(await page.locator('#lab-entry').count(),0);
   networkClean(trial);report.cases.push({name:'production-'+policyMode+'-policy-fails-closed-despite-cookie-storage-flag-event-tampering',photoAnalysisSurvives:true,passed:true});await trial.context.close();
  }
  {const trial=await prepare(browser,handlers,{entry:'/stylist',policyMode:'false',serverFlag:'false',tamper:true}),{page}=trial;await ready(page,{free:false});await sendStylist(page);const post=trial.apiResponses.find(row=>row.path==='/api/stylist'&&row.method==='POST');assert.equal(post.status,401);assert.equal(post.data.error,'authentication_required');assert.equal(await page.locator('.stylist-message').count(),0);assert.equal(await page.locator('[data-stylist-discovery]').count(),0);await assertNoPreview(page);assert.equal(await page.evaluate(()=>typeof A1PublicBeta),'undefined');networkClean(trial);report.cases.push({name:'false-server-flag-keeps-production-stylist-membership-protected',localFashionEnabled:true,clientFlagsCannotGrant:true,passed:true});await trial.context.close();}
  {const trial=await prepare(browser,handlers,{entry:'/stylist',policyMode:'mime',serverFlag:'true'}),{page}=trial;await sendStylist(page);const post=trial.apiResponses.find(row=>row.path==='/api/stylist'&&row.method==='POST');assert.equal(post.status,200);assert.equal(post.data.mode,'DEMO');assert.equal(await page.locator('.stylist-answer-mode').count(),1);assert.equal(await page.locator('[data-stylist-discovery]').count(),0);assert.equal(await page.evaluate(()=>typeof A1PublicBeta),'undefined');networkClean(trial);report.cases.push({name:'unverified-browser-policy-keeps-existing-production-server-DEMO-without-local-supplement',passed:true});await trial.context.close();}
  {const trial=await prepare(browser,handlers,{late:true,imageFixture}),{page}=trial;await trial.seen;await analyze(page);assert.equal(await page.locator('#lab-entry').count(),0);trial.release();await ready(page);await page.waitForSelector('#lab-entry:not([hidden])');assert.equal(await page.locator('#shopping-analysis-consent').isDisabled(),false);assert.equal(await page.evaluate(()=>__betaSelections),1);await search(page);await select(page);assert.equal(await page.locator('#lab-local-photo-consent').isChecked(),false);await page.locator('#ai-clear').click();networkClean(trial);report.cases.push({name:'late-server-policy-replays-current-analysis-without-photo-reselection-or-consent',passed:true});await trial.context.close();}
  {const trial=await prepare(browser,handlers,{entry:'/stylist',late:true}),{page}=trial;await trial.seen;await sendStylist(page);assert.equal(trial.apiResponses.find(row=>row.method==='POST')?.status,200);assert.equal(await page.locator('[data-stylist-discovery]').count(),0);trial.release();await ready(page);await page.waitForFunction(()=>document.querySelector('[data-stylist-discovery]')?.dataset.state==='ready');assert.equal(await page.locator('[data-stylist-discovery] [data-discovery-id]').count(),2);assert.equal(trial.calls.filter(row=>row.method==='POST').length,1);networkClean(trial);report.cases.push({name:'late-server-policy-attaches-facts-to-completed-real-server-DEMO-once',passed:true});await trial.context.close();}
  {const trial=await prepare(browser,handlers,{entry:'/stylist',late:true}),{page}=trial;await trial.seen;await sendStylist(page);await page.locator('#stylist-clear').click();trial.release();await ready(page);await page.waitForLoadState('networkidle');assert.equal(await page.locator('.stylist-message,[data-stylist-discovery]').count(),0);assert.equal(trial.calls.filter(row=>new URL(row.url).pathname==='/assets/observed-products.json').length,0);networkClean(trial);report.cases.push({name:'late-policy-never-resurrects-cleared-server-DEMO-or-public-facts',passed:true});await trial.context.close();}
  {const trial=await prepare(browser,handlers,{late:true}),{page}=trial;await trial.seen;await analyze(page);await page.locator('#ai-clear').click();trial.release();await ready(page);await page.waitForLoadState('networkidle');assert.equal(await page.locator('#lab-entry').isVisible(),false);assert.equal(await page.locator('#shopping-analysis-consent').isDisabled(),true);assert.equal(await page.locator('#ai-result').isVisible(),false);assert.equal(await page.evaluate(()=>__betaUrls.size),0);networkClean(trial);report.cases.push({name:'late-policy-never-replays-cleared-analysis-or-consent',passed:true});await trial.context.close();}
  {const trial=await prepare(browser,handlers,{host:previewOrigin}),{page}=trial;await page.waitForFunction(()=>!!window.A1Preview);assert.equal(await page.evaluate(()=>typeof A1PublicBeta),'undefined');assert.equal(await page.evaluate(()=>typeof A1PublicLocal),'undefined');await search(page);assert.equal(trial.calls.filter(row=>new URL(row.url).pathname.startsWith('/api/')).length,0);networkClean(trial);report.cases.push({name:'preview-local-search-remains-isolated-with-zero-api-requests',passed:true});await trial.context.close();}
  assert.equal(providerCalls,0);for(const[file,hash]of Object.entries(before))assert.equal(sha(fs.readFileSync(path.join(root,file))),hash,'source data unchanged: '+file);
  for(const[file,hash]of Object.entries(sourceHashes))assert.equal(sha(fs.readFileSync(path.join(root,file))),hash,'tested source unchanged: '+file);
  for(const[file,hash]of Object.entries(distHashes))assert.equal(sha(fs.readFileSync(path.join(dist,file))),hash,'tested dist unchanged: '+file);report.passed=true;
 }catch(error){report.failure=error.stack;throw error;}finally{
  report.providerAuthNetworkCalls=providerCalls;report.transportTrials=trials.map(trial=>({requestCount:trial.calls.length,apiRequests:trial.calls.filter(row=>new URL(row.url).pathname.startsWith('/api/')).map(row=>({path:new URL(row.url).pathname,method:row.method})),...trial.stats,routeErrors:trial.routeErrors,pageErrors:trial.errors,cspViolations:trial.violations}));report.sourceHashes=sourceHashes;report.distHashes=distHashes;fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2)+'\n');globalThis.fetch=originalFetch;await browser.close();
 }
 console.log(JSON.stringify({passed:report.passed,cases:report.cases.length,actualProductionContact:false,realRetailerPixels:false,nativeIpadSafari:false}));
})().catch(error=>{console.error(error);process.exitCode=1;});
