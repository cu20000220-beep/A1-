'use strict';
// PRIVATE transport fixtures only. Real published product IDs/URLs are used,
// but the raster response is an existing repository photograph, NOT a retailer
// photograph. These checks do not establish CDN access, retail photo quality,
// native iPad Safari, natural AI synthesis or merchant-issued image permission.
const {chromium}=require('playwright');
const {PNG}=require('pngjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),os=require('node:os');
const root=path.resolve(__dirname,'..'),origin='https://product-images-flow.a1fashion.pages.dev';
const out=process.env.A1_PRODUCT_IMAGES_EVIDENCE||'/workspace/work/product-images-flow';fs.mkdirSync(out,{recursive:true});
const id='musinsa-1168906',merchant='https://www.musinsa.com/products/1168906';
const sourceImage='https://image.msscdn.net/thumbnails/images/goods_img/20190927/1168906/1168906_17224121763738_big.jpg?w=1200';
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const privateRoots=new Set();
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.glb':'model/gltf-binary','.wasm':'application/wasm'};
function manifest(mode,imageKind='unverified'){
 const checkedAt=Date.now()-1000,recordedAt=mode==='expired'?checkedAt-3600000:checkedAt;
 return {version:1,authorization:{basis:'operator-attestation',reference:'private-browser-fixture',recordedAt,validUntil:recordedAt+3600000,display:true,local2DFitting:true,externalProcessing:false},products:[{id,productUrl:merchant,sourceImageUrl:sourceImage,imageUrl:sourceImage,delivery:'remote-reference',sha256:null,bytes:null,width:null,height:null,imageKind,checkedAt}]};
}
function privateObservations(stockMode,isolatedImage){
 const facts=JSON.parse(fs.readFileSync(path.join(root,'assets/observed-products.json'),'utf8')),checkedAt=Date.now()-2000;
 const row=facts.products.find(product=>product.id===id);facts.observedAt=Math.max(facts.observedAt,checkedAt);
 Object.assign(row,{stock:stockMode==='unknown'?'unknown':'in_stock',checkedAt:stockMode==='stale'?checkedAt-86400000:checkedAt});
 if(isolatedImage)Object.assign(row,{name:'Private synthetic test top',type:'shirt',category:'tops',observedFeatures:[]});
 return facts;
}
function privateLocalCopy(){
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'a1-image-browser-PRIVATE-'));privateRoots.add(temporary);fs.mkdirSync(path.join(temporary,'assets'));
 fs.writeFileSync(path.join(temporary,'assets/product-images.json'),JSON.stringify(manifest()));
 const observations=privateObservations();fs.writeFileSync(path.join(temporary,'assets/observed-products.json'),JSON.stringify(observations));
 const receipt=require('../scripts/cache-product-image.cjs').intake({root:temporary,id,file:path.join(root,'assets/photos/coat.jpg'),write:true});
 assert.equal(receipt.written,true);assert.equal(receipt.networkRequests,0);assert.equal(receipt.merchantDownloadVerified,false);
 const data=JSON.parse(fs.readFileSync(path.join(temporary,'assets/product-images.json'),'utf8')),entry=data.products[0],file=path.join(temporary,entry.imageUrl.slice(1));
 assert.equal(entry.delivery,'local-copy');assert.equal(sha(fs.readFileSync(file)),receipt.image.sha256);
 return{root:temporary,manifest:data,observations,entry,file,receipt};
}
function mockPose(){
 const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);window.__imageFlowUrls=new Set();window.__imageFlowSelections=0;
 URL.createObjectURL=blob=>{const url=create(blob);__imageFlowUrls.add(url);return url;};URL.revokeObjectURL=url=>{__imageFlowUrls.delete(url);revoke(url);};
 document.addEventListener('change',event=>{if(event.target.id==='ai-photo')__imageFlowSelections++;});
 window.Pose=class{setOptions(){}onResults(fn){this.result=fn;}async initialize(){}async reset(){}async close(){}async send(){const p=Array.from({length:33},()=>({x:.5,y:.5,visibility:.99}));for(const[index,[x,y]]of Object.entries({11:[.3,.2],12:[.7,.2],23:[.36,.45],24:[.64,.45],25:[.36,.65],26:[.64,.65],27:[.36,.9],28:[.64,.9]}))p[index]={x,y,visibility:.99};this.result({poseLandmarks:p});}};
}
function policy(relative,headers){const route=relative==='fitting-studio.html'?'/fitting-studio*':relative==='product-lab.html'?'/product-lab*':relative==='stylist.html'?'/stylist*':null;if(!route)return null;const lines=headers.split('\n'),at=lines.indexOf(route);assert.ok(at>=0);const line=lines.slice(at+1).find(value=>/Content-Security-Policy:/.test(value));return line.slice(line.indexOf(':')+1).trim();}
async function prepare(browser,{entry='/',width=820,lang='ko',manifestMode='ready',imageMode='ready',stockMode='fresh',localCopy=null,isolatedImage=null}={}){
 const observations=localCopy?.observations??privateObservations(stockMode,isolatedImage),approvedImages=localCopy?.manifest??manifest(manifestMode,isolatedImage?'isolated-garment':'unverified');
 const baseHeaders=fs.readFileSync(path.join(root,'_headers'),'utf8');
 const headers=manifestMode==='ready'?require('../scripts/lib/catalog-public-headers.cjs').catalogPublicHeaders(baseHeaders,[],{manifest:approvedImages,observations,now:Date.now()}):baseHeaders;
 const context=await browser.newContext({viewport:{width,height:1180},hasTouch:true,isMobile:true,locale:lang==='ko'?'ko-KR':'en-US'}),calls=[],errors=[],violations=[],consoleErrors=[];
 let permitMerchant=false,delayNextManifest=false,release,notice;const delayed=new Promise(r=>release=r),seen=new Promise(r=>notice=r);
 await context.route('**/*',async route=>{const request=route.request(),url=new URL(request.url());calls.push({url:url.href,method:request.method(),navigation:request.isNavigationRequest()});assert.equal(request.method(),'GET','no private photo or body data upload');
  if(url.origin!==origin){
   if(request.isNavigationRequest()){assert.equal(permitMerchant,true);assert.equal(url.href,merchant);await route.fulfill({contentType:'text/html',body:'<!doctype html><title>PRIVATE navigation intercept</title>Merchant server acceptance was not tested.'});return;}
   assert.equal(url.href,sourceImage,'only the exact public garment URL may leave the origin');assert.equal(request.postData(),null);assert.ok(!request.headers()['referer'],'no garment request referrer');
   if(imageMode==='error'){await route.fulfill({status:404,contentType:'text/plain',body:'PRIVATE missing image fixture'});return;}
   await route.fulfill({body:isolatedImage??fs.readFileSync(path.join(root,'assets/photos/coat.jpg')),contentType:isolatedImage?'image/png':'image/jpeg',headers:imageMode==='cors-denied'?{'Access-Control-Allow-Origin':'https://different-origin.invalid','Cache-Control':'no-store'}:{'Access-Control-Allow-Origin':origin,'Cache-Control':'no-store'}});return;
  }
  assert.ok(!url.pathname.startsWith('/api/'),'Preview API isolation is never relaxed');
  for(const[key,value]of url.searchParams){assert.equal(key,'v');assert.match(value,/^[a-z0-9-]+$/i);}
  if(localCopy&&url.pathname===localCopy.entry.imageUrl){await route.fulfill({body:fs.readFileSync(localCopy.file),contentType:localCopy.receipt.image.mime,headers:{'Cache-Control':'no-store'}});return;}
  if(url.pathname==='/assets/observed-products.json'){await route.fulfill({contentType:'application/json',body:JSON.stringify(observations)}).catch(()=>{});return;}
  if(url.pathname==='/assets/product-images.json'){
   if(delayNextManifest){delayNextManifest=false;notice();await delayed;}
   if(manifestMode==='missing'){await route.fulfill({status:404,contentType:'application/json',body:'{}'}).catch(()=>{});return;}
   await route.fulfill({contentType:'application/json',body:JSON.stringify(approvedImages)}).catch(()=>{});return;
  }
  if(url.pathname.endsWith('.html')){await route.fulfill({status:308,headers:{Location:url.pathname.slice(0,-5)},body:''});return;}
  const rel=url.pathname==='/'?'index.html':['/fitting-studio','/product-lab','/stylist','/assets/fitting-studio-view'].includes(url.pathname)?url.pathname.slice(1)+'.html':url.pathname.slice(1),full=path.resolve(root,rel);assert.ok(full.startsWith(root+path.sep));
  if(rel==='favicon.ico'&&!fs.existsSync(full)){await route.fulfill({status:204,body:''});return;}
  assert.ok(fs.existsSync(full),'actual local module exists: '+rel);const csp=policy(rel,headers);
  await route.fulfill({body:fs.readFileSync(full),contentType:mime[path.extname(full)]||'application/octet-stream',headers:csp?{'Content-Security-Policy':csp}:{}});
 });
 await context.addInitScript(mockPose);const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
 await page.exposeFunction('recordImageFlowCsp',value=>violations.push(value));await page.addInitScript(()=>document.addEventListener('securitypolicyviolation',e=>window.recordImageFlowCsp(e.effectiveDirective)));
 await page.goto(origin+entry,{waitUntil:'networkidle'});
 if(entry==='/fitting-studio'){await page.locator('#studio-open-analysis').click();await page.waitForSelector('#ai-photo');}
 await page.evaluate(l=>A1I18n.setLanguage(l),lang);
 return{page,context,calls,errors,violations,consoleErrors,seen,release,armSelection(){delayNextManifest=true;},permitMerchant(){permitMerchant=true;}};
}
async function analyze(page){await page.locator('#ai-photo').setInputFiles(path.join(root,'assets/photos/man.jpg'));await page.locator('#ai-analyze').click();await page.waitForFunction(()=>!document.querySelector('#ai-result').hidden);await page.locator('#lab-open-fitting').click();await page.waitForFunction(()=>/승인된 상품 피드 0개|0 approved-feed products/.test(document.querySelector('#lab-catalog-state')?.textContent||'')&&document.querySelector('#lab-observed-products')?.dataset.state==='ready');}
function card(page){return page.locator('#lab-observed-products [data-discovery-id="'+id+'"]');}
async function readyImage(page){await page.waitForFunction(()=>document.querySelector('#lab-observed-products')?.dataset.imageState==='ready');await card(page).scrollIntoViewIfNeeded();await card(page).locator('[data-discovery-fit="'+id+'"]').waitFor();await page.waitForFunction(id=>{const e=document.querySelector('#lab-observed-products [data-discovery-fit="'+id+'"]');return e&&!e.disabled;},id);}
async function selectOutline(page){
 const apply=page.locator('#lab-garment-outline-apply'),preview=page.locator('#lab-garment-photo-preview');
 await apply.waitFor();
 assert.equal(await apply.isDisabled(),true);
 const bounds=await preview.boundingBox();
 for(const [x,y] of [[.15,.15],[.84,.15],[.76,.86],[.24,.86]]){
  await preview.click({position:{x:bounds.width*x,y:bounds.height*y}});
 }
 await apply.click();
 assert.equal(await preview.evaluate(c=>c.getContext('2d').getImageData(0,c.height-1,1,1).data[3]),0,'pixels outside the garment outline are clipped');
}
async function selectImage(page){await readyImage(page);await card(page).locator('[data-discovery-fit="'+id+'"]').click();await page.waitForSelector('#lab-selected-catalog:not([hidden])');await page.waitForFunction(()=>!document.querySelector('#lab-garment-photo-figure').hidden);await selectOutline(page);}
async function pixel(page){return page.locator('#lab-local-photo-canvas').evaluate(c=>c.toDataURL());}
function cleanNetwork(trial){for(const request of trial.calls){assert.doesNotMatch(request.url,/shoulderHipRatio|legTorsoRatio|bodyPhoto|metrics|base64|memberEmail/);assert.equal(request.method,'GET');}assert.deepEqual(trial.errors,[]);assert.deepEqual(trial.violations,[]);}
async function isolatedGarmentFitting(browser){
 const textile=new PNG({width:120,height:180});
 for(let p=0;p<textile.data.length;p+=4)textile.data.set([24,(p/4)%12<6?126:150,208,255],p);
 const trial=await prepare(browser,{width:744,isolatedImage:PNG.sync.write(textile)}),{page}=trial;
 try{
  await analyze(page);
  assert.equal(await page.evaluate(()=>{
   const source=document.querySelector('#ai-clean-canvas'),ctx=source.getContext('2d'),w=source.width,h=source.height;
   ctx.fillStyle='#202020';ctx.fillRect(0,0,w,h);
   ctx.fillStyle='rgb(246,120,54)';ctx.fillRect(.406*w,.318*h,.13*w,.055*h);
   const p=(x,y,z=0)=>({x:x*w,y:y*h,z,visibility:1});
   const target={11:p(.20,.16),12:p(.56,.16),23:p(.47,.58),24:p(.77,.58),25:p(.47,.72),26:p(.73,.72),27:p(.46,.86),28:p(.70,.86),
    13:p(.23,.26),14:p(.72,.30),15:p(.42,.345,-.25),16:p(.81,.48,.1),17:p(.49,.342),19:p(.496,.345),21:p(.504,.348)};
   source.fittingLandmarks=[11,12,23,24,25,26,27,28,13,14,15,16,17,18,19,20,21,22].map(id=>target[id]||null);
   window.__isolatedPoseCalls=0;
   window.A1GarmentPose={estimate:async()=>{window.__isolatedPoseCalls++;return null;}};
   return A1GarmentMesh.usablePose(target);
  }),true,'the body pose is complete enough to trigger source estimation for model-worn images');
  await readyImage(page);await card(page).locator('[data-discovery-fit]').click();
  await page.waitForSelector('#lab-garment-photo-figure:not([hidden])');
  const placement=await page.evaluate(()=>{
   const source=document.querySelector('#ai-clean-canvas'),value=id=>document.querySelector('#lab-local-photo-'+id).valueAsNumber;
   const angle=value('rotation')*Math.PI/180,halfHeight=value('scale')/100*source.width*1.5/2;
   const topX=value('x')/100*source.width+Math.sin(angle)*halfHeight;
   const topY=value('y')/100*source.height-Math.cos(angle)*halfHeight;
   return {xError:Math.abs(topX/source.width-.38),yError:Math.abs(topY/source.height-.16),angle,poseCalls:window.__isolatedPoseCalls};
  });
  assert.ok(placement.angle<-.25&&placement.xError<=.006&&placement.yError<=.006,'the rotated crop starts at the body’s shoulder anchor');
  assert.equal(placement.poseCalls,0,'no person-pose model is run on a known isolated garment');
  await page.locator('#ai-clean-canvas').evaluate(source=>{source.fittingLandmarks[11]=null;});
  assert.equal(await page.locator('#lab-local-photo-result').isVisible(),false);
  await page.locator('#lab-local-photo-consent').check();await page.locator('#lab-local-photo-fit').click();
  await page.waitForSelector('#lab-local-photo-result:visible');
  const {frontHand,fabric}=await page.locator('#lab-local-photo-canvas').evaluate(canvas=>{
   const ctx=canvas.getContext('2d'),sample=(x,y)=>Array.from(ctx.getImageData(Math.round(x*canvas.width),Math.round(y*canvas.height),1,1).data);
   return {frontHand:sample(.497,.345),fabric:sample(.565,.345)};
  });
  assert.deepEqual(frontHand,[246,120,54,255],'the near hand remains in front of the garment even without the opposite wrist');
  assert.equal(fabric[0],24);assert.equal(fabric[2],208);assert.equal(fabric[3],255);
  assert.ok(fabric[1]>=123&&fabric[1]<=153,`texture interpolation should preserve the neighboring stripe colors: ${fabric}`);
  assert.equal(await page.locator('#lab-local-photo-result [data-result-catalog-buy]').getAttribute('href'),merchant);
  await page.locator('#lab-local-photo-consent').uncheck();
  assert.equal(await page.locator('#lab-local-photo-canvas').evaluate(c=>c.width*c.height),1);
  cleanNetwork(trial);
  return {name:'isolated-garment-pose-anchor-and-foreground-hand-pixels',placement,frontHand,fabric,privateFixtureOnly:true,passed:true};
 }finally{await trial.context.close();}
}
(async()=>{
 const before=Object.fromEntries(['assets/approved-products.json','catalog/source-approvals.json','assets/observed-products.json','assets/product-images.json'].map(file=>[file,sha(fs.readFileSync(path.join(root,file)))]));
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const report={realRetailerPixels:false,realRetailerDownloadVerified:false,merchantAcceptanceVerified:false,nativeIpadSafari:false,analysisMocked:true,privateRasterFixture:'assets/photos/coat.jpg and a synthetic striped test raster; no retailer photos used',cases:[]};
 try{
  report.cases.push(await isolatedGarmentFitting(browser));
  for(const profile of[{entry:'/',width:820,lang:'ko'},{entry:'/fitting-studio',width:390,lang:'en'}]){
   const trial=await prepare(browser,profile),{page}=trial;await analyze(page);await readyImage(page);assert.equal(await card(page).locator('img.product-discovery-photo').evaluate(img=>img.complete&&img.naturalWidth>0),true);
   assert.equal(await card(page).getAttribute('data-sale-state'),'available');const body=await page.locator('#ai-clean-canvas').evaluate(c=>c.toDataURL());await selectImage(page);
   const selected=await page.evaluate(()=>A1CatalogFitting.current());assert.equal(selected.id,id);assert.equal(selected.stock,'in_stock');assert.equal(selected.authorizationBasis,'operator-attestation');assert.equal(selected.sourceKind,'operator-authorized-observation');assert.equal(await page.evaluate(()=>__imageFlowSelections),1);assert.equal(await page.locator('#ai-clean-canvas').evaluate(c=>c.toDataURL()),body);assert.equal(await page.locator('#lab-garment-photo').inputValue(),'');assert.equal(await page.locator('#lab-local-photo-consent').isChecked(),false);
   assert.equal(await page.locator('#lab-retailer-original-image').evaluate(image=>image.currentSrc),sourceImage);
   await page.locator('#lab-local-photo-fit').click();assert.equal(await page.locator('#lab-local-photo-result').isVisible(),false);await page.locator('#lab-local-photo-consent').check();await page.locator('#lab-local-photo-fit').click();await page.waitForSelector('#lab-local-photo-result:visible');
   assert.equal(await page.locator('#lab-local-photo-result [data-result-catalog-buy="'+id+'"]').getAttribute('href'),merchant);
   const changes=await page.evaluate(()=>{const a=document.querySelector('#ai-clean-canvas'),b=document.querySelector('#lab-local-photo-canvas'),x=a.getContext('2d').getImageData(0,0,a.width,a.height-50).data,y=b.getContext('2d').getImageData(0,0,b.width,b.height-50).data;let count=0;for(let i=0;i<x.length;i+=4)if(Math.abs(x[i]-y[i])+Math.abs(x[i+1]-y[i+1])+Math.abs(x[i+2]-y[i+2])>40)count++;return count;});assert.ok(changes>1000);
   for(const[key,value]of[['x','61'],['y','45'],['scale','45'],['rotation','12'],['opacity','78']]){const previous=await pixel(page);await page.locator('#lab-local-photo-'+key).evaluate((element,value)=>{element.value=value;element.dispatchEvent(new Event('input',{bubbles:true}));},value);assert.notEqual(await pixel(page),previous,key+' changes actual raster pixels');}
   await page.locator('#lab-local-photo-before').check();const original=await pixel(page);await page.locator('#lab-local-photo-before').uncheck();assert.notEqual(await pixel(page),original);
   await page.locator('#lab-local-photo-result').screenshot({path:path.join(out,'PRIVATE-raster-'+profile.lang+'-'+profile.width+'.png')});
   await page.locator('#lab-local-photo-consent').uncheck();assert.equal(await page.locator('#lab-local-photo-result').isVisible(),false);await page.locator('#ai-clear').click();assert.equal(await page.evaluate(()=>A1CatalogFitting.current()),null);for(const canvas of['#ai-clean-canvas','#lab-local-photo-canvas','#lab-garment-photo-preview'])assert.equal(await page.locator(canvas).evaluate(c=>c.width*c.height),1);assert.equal(await page.evaluate(()=>__imageFlowUrls.size),0);assert.equal(await page.locator('#lab-selected-catalog').isVisible(),false);
   assert.deepEqual(await page.evaluate(()=>Object.keys(sessionStorage)),[]);assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),['a1-fashion:language']);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);cleanNetwork(trial);report.cases.push({name:'real-id-private-image-to-same-photo-local-2d',profile,changedPixels:changes,transforms:5,separateConsent:true,noReselection:true,privateFreshStock:true,privateFixtureOnly:true,passed:true});await trial.context.close();
  }
  {const trial=await prepare(browser,{entry:'/#fit-observed-product='+id}),{page}=trial;
   await page.waitForFunction(id=>window.A1CatalogFitting?.current()?.id===id,id);assert.equal(page.url(),origin+'/');assert.equal(await page.locator('#ai-studio').count(),1);assert.equal(await page.locator('#lab-local-photo-consent').isChecked(),false);
   await page.locator('#ai-photo').setInputFiles(path.join(root,'assets/photos/man.jpg'));assert.equal(await page.evaluate(()=>A1CatalogFitting.current()?.id),id,'body-photo replacement retains only the public product selection');await page.locator('#ai-analyze').click();await page.waitForFunction(()=>!document.querySelector('#ai-result').hidden);await page.waitForSelector('#lab-garment-photo-figure:not([hidden])');await selectOutline(page);
   assert.equal(await page.evaluate(()=>__imageFlowSelections),1);assert.equal(await page.evaluate(()=>A1CatalogFitting.current()?.id),id);assert.equal(await page.locator('#lab-local-photo-consent').isChecked(),false);await page.locator('#lab-local-photo-consent').check();await page.locator('#lab-local-photo-fit').click();await page.waitForSelector('#lab-local-photo-result:visible');await page.locator('#ai-clear').click();assert.equal(await page.evaluate(()=>A1CatalogFitting.current()),null);assert.equal(await page.locator('#lab-local-photo-canvas').evaluate(c=>c.width*c.height),1);cleanNetwork(trial);
   report.cases.push({name:'public-product-fragment-before-photo-retains-selection-with-separate-consent',publicIdFragmentRemoved:true,privateFixtureOnly:true,passed:true});await trial.context.close();}
  {const trial=await prepare(browser,{imageMode:'cors-denied'}),{page}=trial;await analyze(page);await readyImage(page);await card(page).locator('[data-discovery-fit="'+id+'"]').click();await page.locator('#lab-selected-catalog[data-image-state="request-error"]').waitFor();
   assert.match(await page.locator('#lab-local-photo-status').innerText(),/브라우저|browser/i);assert.equal(await page.locator('#lab-local-photo-result,#lab-garment-photo-figure').filter({visible:true}).count(),0);assert.equal(await page.locator('#lab-retailer-original-image').count(),0);
   assert.equal(await page.locator('#lab-selected-catalog [data-selected-catalog-buy="'+id+'"]').getAttribute('href'),merchant);assert.equal(await page.locator('#lab-garment-photo').isVisible(),true);cleanNetwork(trial);report.cases.push({name:'cors-denial-explained-without-proxy-or-fake-fit',expectedBrowserCorsError:true,passed:true});await trial.context.close();}
  {const copy=privateLocalCopy(),trial=await prepare(browser,{entry:'/fitting-studio',width:820,lang:'ko',localCopy:copy}),{page}=trial;
   await analyze(page);await readyImage(page);assert.equal(await card(page).locator('img.product-discovery-photo').evaluate(img=>img.complete&&img.naturalWidth>0),true);
   const body=await page.locator('#ai-clean-canvas').evaluate(c=>c.toDataURL());await selectImage(page);const selected=await page.evaluate(()=>A1CatalogFitting.current());
   assert.equal(selected.delivery,'local-copy');assert.equal(selected.fittingImageUrl,copy.entry.imageUrl);assert.equal(selected.stock,'in_stock');assert.equal(await page.evaluate(()=>__imageFlowSelections),1);assert.equal(await page.locator('#ai-clean-canvas').evaluate(c=>c.toDataURL()),body);
   assert.equal(await page.locator('#lab-local-photo-consent').isChecked(),false);await page.locator('#lab-local-photo-fit').click();assert.equal(await page.locator('#lab-local-photo-result').isVisible(),false);
   await page.locator('#lab-local-photo-consent').check();await page.locator('#lab-local-photo-fit').click();await page.waitForSelector('#lab-local-photo-result:visible');
   const changes=await page.evaluate(()=>{const a=document.querySelector('#ai-clean-canvas'),b=document.querySelector('#lab-local-photo-canvas'),x=a.getContext('2d').getImageData(0,0,a.width,a.height-50).data,y=b.getContext('2d').getImageData(0,0,b.width,b.height-50).data;let count=0;for(let i=0;i<x.length;i+=4)if(Math.abs(x[i]-y[i])+Math.abs(x[i+1]-y[i+1])+Math.abs(x[i+2]-y[i+2])>40)count++;return count;});assert.ok(changes>1000,'intake bytes visibly alter body-photo pixels');
   const fitted=await pixel(page);await page.locator('#lab-local-photo-before').check();assert.notEqual(await pixel(page),fitted);await page.locator('#lab-local-photo-before').uncheck();
   await page.locator('#lab-local-photo-result').screenshot({path:path.join(out,'PRIVATE-local-intake-ko-820.png')});
   await page.locator('#lab-local-photo-consent').uncheck();assert.equal(await page.locator('#lab-local-photo-result').isVisible(),false);await page.locator('#ai-clear').click();assert.equal(await page.evaluate(()=>A1CatalogFitting.current()),null);
   for(const canvas of['#ai-clean-canvas','#lab-local-photo-canvas','#lab-garment-photo-preview'])assert.equal(await page.locator(canvas).evaluate(c=>c.width*c.height),1);assert.equal(await page.evaluate(()=>__imageFlowUrls.size),0);
   assert.equal(sha(fs.readFileSync(copy.file)),copy.receipt.image.sha256,'clearing consumer data does not mutate the public garment copy');assert.ok(trial.calls.some(request=>new URL(request.url).pathname===copy.entry.imageUrl));assert.equal(trial.calls.filter(request=>new URL(request.url).origin!==origin).length,0,'local-copy preview and fitting require no CDN/CORS request');cleanNetwork(trial);assert.deepEqual(trial.consoleErrors,[]);
   report.cases.push({name:'offline-intake-to-same-origin-local-2d',actualTemporaryIntake:true,localCopySha256:copy.receipt.image.sha256,changedPixels:changes,outsideOriginRequests:0,separateConsent:true,noReselection:true,privateFixtureOnly:true,passed:true});await trial.context.close();}
  {const trial=await prepare(browser,{imageMode:'error'}),{page}=trial;await analyze(page);await card(page).scrollIntoViewIfNeeded();await card(page).locator('[data-discovery-fit-state="image-unavailable"]').waitFor();assert.equal(await card(page).locator('[data-discovery-fit]').isDisabled(),true);assert.ok(await card(page).locator('[data-discovery-buy]').count());cleanNetwork(trial);report.cases.push({name:'failed-image-disabled-fact-candidate-retained',passed:true});await trial.context.close();}
  {const trial=await prepare(browser,{manifestMode:'missing'}),{page}=trial;await analyze(page);await page.waitForFunction(()=>['error','unavailable'].includes(document.querySelector('#lab-observed-products')?.dataset.imageState));assert.ok(await card(page).isVisible());assert.equal(await card(page).locator('img,[data-discovery-fit]').count(),0);assert.equal(trial.calls.filter(request=>new URL(request.url).origin!==origin).length,0);cleanNetwork(trial);report.cases.push({name:'missing-image-manifest-keeps-real-facts-without-images',passed:true});await trial.context.close();}
  {const trial=await prepare(browser,{manifestMode:'expired'}),{page}=trial;await analyze(page);await card(page).locator('[data-discovery-fit-state="rights-unconfirmed"]').waitFor();assert.equal(await card(page).locator('img,[data-discovery-fit]').count(),0);assert.equal(trial.calls.filter(request=>new URL(request.url).origin!==origin).length,0);cleanNetwork(trial);report.cases.push({name:'expired-image-approval-keeps-the-fresh-product-without-fitting',passed:true});await trial.context.close();}
  for(const stockMode of ['unknown','stale']){
   const trial=await prepare(browser,{stockMode}),{page}=trial;await analyze(page);await card(page).scrollIntoViewIfNeeded();await card(page).locator('[data-discovery-fit-state="stock-unconfirmed"]').waitFor();
   await card(page).locator('img.product-discovery-photo').waitFor();
   assert.equal(await card(page).locator('[data-discovery-fit]').count(),0);assert.equal(await card(page).locator('[data-discovery-buy]').getAttribute('href'),merchant);
   await page.evaluate(id=>A1CatalogFitting.openObserved(id),id);assert.equal(await page.evaluate(()=>A1CatalogFitting.current()),null);
   assert.match(await page.locator('#catalog-fitting-status').innerText(),/판매 여부/);cleanNetwork(trial);report.cases.push({name:'approved-photo-display-without-fresh-positive-stock',stockMode,passed:true});await trial.context.close();
  }
  {const trial=await prepare(browser),{page}=trial;await analyze(page);await readyImage(page);trial.armSelection();await card(page).locator('[data-discovery-fit="'+id+'"]').click();await trial.seen;await page.locator('#ai-clear').click();trial.release();await page.waitForLoadState('networkidle');assert.equal(await page.evaluate(()=>A1CatalogFitting.current()),null);assert.equal(await page.locator('#lab-local-photo-result').isVisible(),false);assert.equal(await page.locator('#lab-local-photo-canvas').evaluate(c=>c.width*c.height),1);assert.equal(await page.locator('#lab-selected-catalog').isVisible(),false);cleanNetwork(trial);report.cases.push({name:'clear-during-observed-image-selection-never-resurrects',passed:true});await trial.context.close();}
  {const trial=await prepare(browser),{page}=trial;await analyze(page);await selectImage(page);const link=page.locator('#lab-selected-catalog [data-selected-catalog-buy]');assert.equal(await link.getAttribute('href'),merchant);await link.evaluate(a=>a.href='https://www.musinsa.com/products/9999999');await link.click();assert.equal(new URL(page.url()).origin,origin);await link.evaluate((a,url)=>a.href=url,merchant);await link.evaluate(a=>a.click());assert.equal(new URL(page.url()).origin,origin);trial.permitMerchant();await link.click();assert.equal(page.url(),merchant);cleanNetwork(trial);report.cases.push({name:'selected-item-link-rejects-tamper-and-synthetic-click',actualMerchantResponse:false,passed:true});await trial.context.close();}
  for(const[file,hash]of Object.entries(before))assert.equal(sha(fs.readFileSync(path.join(root,file))),hash,'operational/approved/fact snapshots are not mutated by browser tests');report.passed=true;
 }finally{report.sourceHashes=Object.fromEntries(['assets/product-images.js','assets/product-images.json','assets/catalog-fitting.js','assets/product-discovery-view.js','assets/product-discovery-view.css','assets/product-lab.js','assets/preview-experience.js','assets/fitting-studio-photo.js','index.html','fitting-studio.html','scripts/lib/catalog-public-headers.cjs','scripts/cache-product-image.cjs','scripts/lib/product-image-store.cjs','scripts/lib/product-image-file.cjs','scripts/build-site.cjs','assets/photos/coat.jpg'].filter(file=>fs.existsSync(path.join(root,file))).map(file=>[file,sha(fs.readFileSync(path.join(root,file)))]));fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2)+'\n');await browser.close();for(const temporary of privateRoots)fs.rmSync(temporary,{recursive:true,force:true});}
 console.log(JSON.stringify({passed:report.passed,cases:report.cases.length,realRetailerPixels:false,nativeIpadSafari:false}));
})().catch(error=>{console.error(error);process.exitCode=1;});
