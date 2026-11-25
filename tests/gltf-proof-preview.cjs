'use strict';
// Read-only live Preview check: real deployed bytes via the inherited proxy,
// rendered with their actual response headers. No local asset substitution.
const {chromium,request}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'..'),out=path.join(repo,'docs/validation/gltf-proof');
const origin=process.argv[2];
if(!/^https:\/\/[a-f0-9]{8}\.a1fashion\.pages\.dev$/.test(origin||''))throw Error('exact_preview_origin_required');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
(async()=>{
 const api=await request.newContext({proxy:{server:process.env.HTTPS_PROXY},ignoreHTTPSErrors:false});
 let browser;const result={origin,checkedAt:new Date().toISOString(),transport:'Deployed assets fetched through the configured proxy and rendered with original headers; no local substitutions.',nativeIpadSafari:false,requests:[],consoleErrors:[],pageErrors:[],passed:false};
 try{
  const first=await api.get(origin+'/gltf-proof',{timeout:30000});
  result.document={status:first.status(),mime:first.headers()['content-type'],csp:first.headers()['content-security-policy']};
  if(first.status()!==200)throw Error('preview_document_http_'+first.status());
  assert.equal(hash(await first.body()),hash(fs.readFileSync(path.join(repo,'gltf-proof.html'))),'deployed page matches local source');
  const health=await api.get(origin+'/api/health',{timeout:30000});result.apiIsolation={status:health.status(),error:(await health.json()).error};assert.equal(health.status(),503);assert.equal(result.apiIsolation.error,'preview_isolated');
  browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:820,height:1180},hasTouch:true,isMobile:true,locale:'ko-KR'});
  const cache=new Map();
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());assert.equal(u.origin,origin);assert.equal(req.method(),'GET');assert.ok(!u.pathname.startsWith('/api/'));
   if(!cache.has(u.href)){
    const response=await api.get(u.href,{timeout:30000});const bytes=await response.body(),headers=response.headers();
    delete headers['content-encoding'];delete headers['content-length'];
    if(response.status()===200){const relative=u.pathname==='/gltf-proof'?'gltf-proof.html':u.pathname.slice(1);if(fs.existsSync(path.join(repo,relative)))assert.equal(hash(bytes),hash(fs.readFileSync(path.join(repo,relative))),relative+' actual deployed bytes');}
    result.requests.push({path:u.pathname,status:response.status(),mime:headers['content-type']});cache.set(u.href,{status:response.status(),headers,body:bytes});
   }
   await route.fulfill(cache.get(u.href));
  });
  const page=await context.newPage();page.on('pageerror',e=>result.pageErrors.push(e.message));page.on('console',m=>{if(m.type()==='error')result.consoleErrors.push(m.text());});
  await page.goto(origin+'/gltf-proof',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.A1GltfProof?.snapshot().state==='ready',null,{timeout:25000});
  result.initial=await page.evaluate(()=>A1GltfProof.snapshot());result.frames=[];
  assert.equal(result.initial.look,'nova');assert.equal(result.initial.bones,73);
  assert.deepEqual(result.requests.filter(item=>item.path.endsWith('.glb')).map(item=>item.path),['/assets/nova-avatar/avatar.glb']);
  assert.equal(await page.locator('#gltf-garment').isDisabled(),true);
  for(const view of ['front','side','back']){await page.locator('#gltf-'+view).click();const bytes=await page.locator('#gltf-canvas').screenshot();fs.writeFileSync(path.join(out,'live-'+view+'.png'),bytes);result.frames.push({view,sha256:hash(bytes)});}
  assert.equal(new Set(result.frames.map(v=>v.sha256)).size,3);
  const pbr=hash(await page.locator('#gltf-canvas').screenshot());await page.locator('#gltf-material').selectOption('basic');
  assert.notEqual(hash(await page.locator('#gltf-canvas').screenshot()),pbr);await page.locator('#gltf-material').selectOption('standard');
  await page.locator('#gltf-look').selectOption('natural');await page.waitForFunction(()=>A1GltfProof.snapshot().state==='ready'&&A1GltfProof.snapshot().look==='natural');
  assert.equal(await page.locator('#gltf-garment').isDisabled(),true);result.naturalOutfitIsFixed=true;
  await page.locator('#gltf-look').selectOption('reference');await page.waitForFunction(()=>A1GltfProof.snapshot().state==='ready'&&A1GltfProof.snapshot().look==='reference');
  const variants=[];for(const id of ['LAB-A','LAB-B','LAB-C']){await page.locator('#gltf-garment').selectOption(id);const bytes=await page.locator('#gltf-canvas').screenshot();variants.push(hash(bytes));}assert.equal(new Set(variants).size,3);result.legacyGarmentChanges=true;
  await page.locator('#gltf-look').selectOption('nova');await page.waitForFunction(()=>A1GltfProof.snapshot().state==='ready'&&A1GltfProof.snapshot().look==='nova');
  await page.locator('#gltf-front').click();await page.screenshot({path:path.join(out,'live-overview.png'),fullPage:true});
  assert.deepEqual(result.pageErrors,[]);assert.deepEqual(result.consoleErrors,[]);result.passed=true;await context.close();
 }catch(error){result.error=error.message;process.exitCode=1;}
 finally{await browser?.close();await api.dispose();fs.writeFileSync(path.join(out,'preview-result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({origin,passed:result.passed,error:result.error,document:result.document,requests:result.requests.length}));}
})();
