'use strict';
// Real deployed bytes, headers and MediaPipe inference. Only public repository
// photograph fixtures are used; never operational member photos or records.
const {chromium,request}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const origin=process.env.A1_PREVIEW_ORIGIN;
if(!/^https:\/\/[a-z0-9-]+\.a1fashion\.pages\.dev$/.test(origin||''))throw Error('Set A1_PREVIEW_ORIGIN to an isolated Preview, never Production.');
const root=path.resolve(__dirname,'..'),out=process.env.A1_PREVIEW_EVIDENCE||'/workspace/work/photo-fitting-live';
const imagePolicy=process.env.A1_PREVIEW_PRODUCT_IMAGES||'available';
if(!['available','blocked'].includes(imagePolicy))throw Error('Invalid product-image network policy.');
const productImages=JSON.parse(fs.readFileSync(path.join(root,'assets/product-images.json'),'utf8'));
const imageUrls=new Set(require('../assets/product-images.js').validateManifest(productImages,JSON.parse(fs.readFileSync(path.join(root,'assets/observed-products.json'),'utf8'))).filter(e=>e.delivery==='remote-reference').map(e=>e.imageUrl));
const entry=process.env.A1_FLOW_ENTRY==='studio'?'/fitting-studio':'/';
fs.mkdirSync(out,{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 const api=await request.newContext({...(process.env.HTTPS_PROXY?{proxy:{server:process.env.HTTPS_PROXY}}:{}),ignoreHTTPSErrors:false});
 let browser;
 const report={origin,entry,checkedAt:new Date().toISOString(),actualMediaPipe:true,nativeIpadSafari:false,passed:false,
  transport:'Actual deployed responses and headers through the configured proxy, no local asset replacement.',requests:[],errors:[],consoleErrors:[],csp:[],productImages:{policy:imagePolicy,merchantImageBytesVerified:false,requests:[],expectedLoadErrors:[]}};
 try{
  const isolation=await api.get(origin+'/api/health',{timeout:30000});
  report.apiIsolation={status:isolation.status(),error:(await isolation.json()).error};
  assert.equal(report.apiIsolation.status,503);assert.equal(report.apiIsolation.error,'preview_isolated');
  browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:820,height:1180},hasTouch:true,isMobile:true,locale:'ko-KR'}),cache=new Map();
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   assert.equal(req.method(),'GET');
   if(url.origin!==origin){
    assert.ok(imageUrls.has(url.href),'only exact public product-image URLs may leave Preview');assert.equal(req.resourceType(),'image');assert.equal(req.postData(),null);assert.ok(!req.headers().referer);
    report.productImages.requests.push({url:url.href,method:'GET',personalData:false});
    if(imagePolicy==='blocked'){await route.abort('blockedbyclient');return;}
    const response=await api.get(url.href,{timeout:30000}),body=await response.body(),headers=response.headers();delete headers['content-encoding'];delete headers['content-length'];
    assert.equal(response.status(),200);assert.match(headers['content-type'],/^image\/(?:png|jpeg|webp)/);assert.ok(body.length<=6000000);report.productImages.merchantImageBytesVerified=true;
    await route.fulfill({status:response.status(),body,headers});return;
   }
   assert.ok(!url.pathname.startsWith('/api/'));
   if(!cache.has(url.href))cache.set(url.href,(async()=>{
    const response=await api.get(url.href,{timeout:45000}),body=await response.body(),headers=response.headers();
    delete headers['content-encoding'];delete headers['content-length'];
    const relative=url.pathname==='/'?'index.html':['/fitting-studio','/product-lab','/gltf-proof'].includes(url.pathname)?url.pathname.slice(1)+'.html':url.pathname.slice(1);
    const file=path.resolve(root,relative);assert.ok(file.startsWith(root+path.sep));
    if(response.status()===200&&fs.existsSync(file))assert.equal(sha(body),sha(fs.readFileSync(file)),relative+' matches current source');
    report.requests.push({path:url.pathname,status:response.status(),mime:headers['content-type'],sha256:sha(body)});
    return{status:response.status(),body,headers};
   })());
   await route.fulfill(await cache.get(url.href));
  });
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'){if(imagePolicy==='blocked'&&/net::ERR_BLOCKED_BY_CLIENT/.test(m.text()))report.productImages.expectedLoadErrors.push(m.text());else report.consoleErrors.push(m.text());}});
  await page.exposeFunction('recordFittingCsp',v=>report.csp.push(v));
  await page.addInitScript(()=>document.addEventListener('securitypolicyviolation',e=>window.recordFittingCsp(e.effectiveDirective)));
  await page.goto(origin+entry,{waitUntil:'networkidle'});
  if(entry==='/fitting-studio'){await page.locator('#studio-open-analysis').click();await page.waitForSelector('#ai-photo');}
  await page.evaluate(()=>window.A1I18n.setLanguage('ko'));
  assert.equal(await page.evaluate(()=>typeof window.Pose),'undefined','inference is not mocked or preinstalled');
  await page.locator('#ai-photo').setInputFiles(path.join(root,'assets/photos/man.jpg'));
  await page.locator('#ai-analyze').click();
  await page.waitForFunction(()=>!document.querySelector('#ai-result').hidden||document.querySelector('#ai-status').classList.contains('is-error'),null,{timeout:180000});
  report.analysisSucceeded=await page.locator('#ai-result').isVisible();
  report.analysisStatus=await page.locator('#ai-status').innerText();assert.equal(report.analysisSucceeded,true,report.analysisStatus);
  assert.match(report.analysisStatus,/무료 베타/,'the isolated flow never requires a subscription');
  assert.ok(report.requests.some(r=>/pose_solution_packed_assets|pose_landmark_lite\.tflite/.test(r.path)),'real model bytes loaded');
  await page.locator('#ai-result').screenshot({path:path.join(out,'analysis.png')});
  await page.locator('#avatar-reference-consent').check();await page.locator('#lab-open-avatar').click();
  await page.waitForFunction(()=>window.A1GltfProof?.snapshot().state==='ready',null,{timeout:60000});
  report.three=await page.evaluate(()=>window.A1GltfProof.snapshot());
  assert.equal(report.three.look,'natural');assert.equal(report.three.bones,73);assert.equal(await page.locator('#avatar-root:visible').count(),0);
  assert.equal(await page.locator('#natural-photo-reference').isVisible(),true);
  const frames=[];
  for(const view of ['front','side','back']){await page.locator('#gltf-'+view).click();const bytes=await page.locator('#gltf-canvas').screenshot({path:path.join(out,'natural-'+view+'.png')});frames.push(sha(bytes));}
  assert.equal(new Set(frames).size,3);report.distinct3DViews=true;
  await page.locator('#avatar-reference-consent').uncheck();assert.equal(await page.locator('#natural-photo-reference').isVisible(),false);
  report.ratiosAppliedToGeometry=false;
  const bodySize=await page.locator('#ai-clean-canvas').evaluate(c=>({width:c.width,height:c.height}));
  await page.locator('#natural-open-photo-fitting').click();await page.waitForSelector('#lab-garment-photo');
  assert.deepEqual(await page.locator('#ai-clean-canvas').evaluate(c=>({width:c.width,height:c.height})),bodySize);
  assert.equal(await page.locator('#lab-local-photo-consent').isChecked(),false);
  await page.locator('#lab-garment-photo-rights').check();await page.locator('#lab-garment-photo').setInputFiles(path.join(root,'assets/photos/coat.jpg'));
  await page.waitForFunction(()=>!document.querySelector('#lab-garment-photo-figure').hidden);
  await page.locator('#lab-local-photo-consent').check();await page.locator('#lab-local-photo-fit').click();
  await page.waitForSelector('#lab-local-photo-result:visible');
  const pixel=()=>page.locator('#lab-local-photo-canvas').evaluate(c=>c.toDataURL());
  for(const[id,value]of[['lab-local-photo-x','61'],['lab-local-photo-y','42'],['lab-local-photo-scale','45'],['lab-local-photo-rotation','12'],['lab-local-photo-opacity','78']]){
   const before=await pixel();await page.locator('#'+id).evaluate((el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));},value);assert.notEqual(await pixel(),before);
  }
  await page.locator('#lab-local-photo-canvas').screenshot({path:path.join(out,'local-2d-garment.png')});
  const fitted=await pixel();await page.locator('#lab-local-photo-before').check();assert.notEqual(await pixel(),fitted);
  await page.locator('#lab-local-photo-canvas').screenshot({path:path.join(out,'local-2d-before.png')});await page.locator('#lab-local-photo-before').uncheck();
  report.local2DFitting={photoReselection:false,transforms:5,beforeAfter:true,aiSynthesis:false};
  await page.locator('#lab-photo-search-query').fill('남성 검정 슬랙스 5만원 이하');await page.locator('#lab-photo-search button[type=submit]').click();
  const links=await page.locator('#lab-photo-search-results a[href]').evaluateAll(nodes=>nodes.map(n=>n.href));
  for(const host of ['www.musinsa.com','www.29cm.co.kr','search.shopping.naver.com','www.coupang.com'])assert.ok(links.some(link=>new URL(link).hostname===host));
  report.shopping={officialLinks:true,merchantServerAccessVerified:false};
  await page.locator('#ai-clear').click();
  for(const id of['ai-clean-canvas','lab-local-photo-canvas','lab-garment-photo-preview'])assert.equal(await page.locator('#'+id).evaluate(c=>c.width*c.height),1);
  assert.equal((await page.evaluate(()=>window.A1GltfProof.snapshot())).memoryTextures,0);report.jointDeletion=true;
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.consoleErrors,[]);assert.deepEqual(report.csp,[]);
  report.passed=true;await context.close();
 }catch(error){report.failure=error.stack;process.exitCode=1;}
 finally{await browser?.close();await api.dispose();fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({origin,entry,passed:report.passed,actualMediaPipe:true,analysisSucceeded:report.analysisSucceeded,requests:report.requests.length,failure:report.failure}));}
})();
