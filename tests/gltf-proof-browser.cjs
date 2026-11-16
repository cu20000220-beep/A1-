'use strict';
// Real glTF skin/material/pixel evidence from Linux software Chromium. Touch and
// viewport emulation are not native iPad Safari or hardware performance proof.
const {chromium,webkit}=require('playwright');
const {PNG}=require('pngjs');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const origin='https://gltf-proof.a1fashion.pages.dev';
const out=process.env.A1_GLTF_PROOF_OUT||path.join(root,'docs/validation/gltf-proof');
fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'};
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const readSnapshot=page=>page.evaluate(()=>window.A1GltfProof.snapshot());
const canvas=page=>page.locator('#gltf-canvas');
const image=async page=>canvas(page).screenshot({animations:'disabled'});
const imageHash=async page=>sha(await image(page));
const policy=()=>{
 const header=fs.readFileSync(path.join(root,'_headers'),'utf8').match(/^\/gltf-proof\*\n\s+Content-Security-Policy:\s*([^\r\n]+)/m);
 assert.ok(header,'isolated glTF page must have a deployed CSP');return header[1];
};
function diversity(bytes){
 const png=PNG.sync.read(bytes),colors=new Set();
 for(let y=0;y<png.height;y+=4)for(let x=0;x<png.width;x+=4){const i=(y*png.width+x)*4;colors.add(png.data.subarray(i,i+3).toString('hex'));}
 return {width:png.width,height:png.height,colors:colors.size};
}
async function prepare(browser,profile,{modelBlocked=false,noWebgl=false,production=false}={}){
 const context=await browser.newContext({viewport:{width:profile.width,height:profile.height},hasTouch:profile.touch,isMobile:profile.touch,deviceScaleFactor:1,locale:profile.lang==='en'?'en-US':'ko-KR'});
 const requests=[],errors=[],consoleErrors=[],violations=[];
 if(noWebgl)await context.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:original.call(this,type,...args);};});
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  const allowedOrigin=production?'https://a1fashion.pages.dev':origin;
  assert.equal(url.origin,allowedOrigin,'no photos, body values or API calls may leave the static isolated page');
  assert.equal(request.method(),'GET');assert.ok(!url.pathname.startsWith('/api/'),'Preview API isolation remains in force');
  for(const[key,value]of url.searchParams){assert.equal(key,'v');assert.match(value,/^[a-z0-9-]+$/i);}
  requests.push(url.pathname);
  if(url.pathname==='/gltf-proof.html'){await route.fulfill({status:308,headers:{Location:'/gltf-proof'+url.search},body:''});return;}
  const relative=url.pathname==='/gltf-proof'?'gltf-proof.html':url.pathname.slice(1);
  assert.ok(relative==='gltf-proof.html'||relative==='favicon.ico'||relative.startsWith('assets/'),'only static application resources are requested');
  const full=path.resolve(root,relative);assert.ok(full.startsWith(root+path.sep),'no escaped static path');
  if(modelBlocked&&relative==='assets/gltf-proof/avatar.glb'){await route.abort('failed');return;}
  if(relative==='favicon.ico'&&!fs.existsSync(full)){await route.fulfill({status:204,body:''});return;}
  assert.ok(fs.existsSync(full),'requested static file exists: '+relative);
  await route.fulfill({body:fs.readFileSync(full),contentType:mime[path.extname(relative)]||'application/octet-stream',headers:relative==='gltf-proof.html'?{'Content-Security-Policy':policy()}: {}});
 });
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));page.on('console',entry=>{if(entry.type()==='error')consoleErrors.push(entry.text());});
 await page.exposeFunction('recordGltfCsp',directive=>violations.push(directive));
 await page.addInitScript(()=>document.addEventListener('securitypolicyviolation',event=>window.recordGltfCsp(event.effectiveDirective)));
 await page.goto((production?'https://a1fashion.pages.dev':origin)+'/gltf-proof',{waitUntil:'networkidle'});
 if(!production&&!modelBlocked&&!noWebgl){await page.waitForFunction(()=>document.querySelector('#gltf-proof-root')?.dataset.loadState==='ready',null,{timeout:20000});await page.locator('[data-language-select]').selectOption(profile.lang);assert.equal(await page.locator('html').getAttribute('lang'),profile.lang);}
 return {context,page,requests,errors,consoleErrors,violations};
}
async function capture(page,name){const bytes=await image(page);fs.writeFileSync(path.join(out,name+'.png'),bytes);return {name,sha256:sha(bytes),...diversity(bytes)};}
async function touchOrMouse(page,touch){
 const target=canvas(page);await target.scrollIntoViewIfNeeded();const box=await target.boundingBox(),x=box.x+box.width*.5,y=box.y+box.height*.5,before=await imageHash(page);
 if(touch){
  const session=await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
  for(let n=1;n<=6;n++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+n*12,y:y+n,id:1}]});
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 }else{
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+box.width*.25,y+box.height*.03,{steps:8});await page.mouse.up();
 }
 assert.notEqual(await imageHash(page),before,'actual drag must rotate rendered mesh pixels');
 if(touch){
  const beforePinch=await imageHash(page),session=await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-30,y,id:1},{x:x+30,y,id:2}]});
  for(let n=1;n<=5;n++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-30-n*10,y,id:1},{x:x+30+n*10,y,id:2}]});
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.notEqual(await imageHash(page),beforePinch,'two-finger pinch must change actual framing');
 }
}
function percentile(rows,p){if(!rows.length)return null;const sorted=[...rows].sort((a,b)=>a-b);return sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))];}
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const reports=[];
 try{
  for(const profile of [{width:1280,height:900,touch:false,lang:'ko'},{width:820,height:1180,touch:true,lang:'ko'},{width:1180,height:820,touch:true,lang:'en'}]){
   const trial=await prepare(browser,profile),{page,context,requests,errors,consoleErrors,violations}=trial;
   const initial=await readSnapshot(page);assert.equal(initial.state,'ready');assert.ok(initial.skinnedMeshes>=2,'glTF must load real skinned body and separate clothing');assert.ok(initial.bones>=2);assert.ok(initial.triangles>1000,'actual human/garment geometry must draw');assert.ok(initial.drawCalls>=2);
   const box=await canvas(page).boundingBox();assert.ok(box.width>=320&&box.height>=400,'body display must remain large on touch/tablet screens');
   const frames=[];
   for(const view of ['front','side','back']){await page.locator('#gltf-'+view).click();const shot=await capture(page,profile.lang+'-'+profile.width+'-'+view);assert.ok(shot.colors>40,'shaded body and garments must produce non-blank pixels');frames.push(shot);}
   assert.equal(new Set(frames.map(frame=>frame.sha256)).size,3,'front/side/back must show genuinely different views');
   await page.locator('#gltf-front').click();await page.screenshot({path:path.join(out,profile.lang+'-'+profile.width+'-overview.png'),fullPage:true});
   const variants=[];for(const garment of ['LAB-A','LAB-B','LAB-C','none']){await page.locator('#gltf-garment').selectOption(garment);const shot=await capture(page,profile.lang+'-'+profile.width+'-'+garment);variants.push({garment,...shot,triangles:(await readSnapshot(page)).triangles});}
   assert.equal(new Set(variants.map(variant=>variant.sha256)).size,4,'three example garments and unclothed comparison must change actual pixels');assert.ok(variants.slice(0,3).every(variant=>variant.triangles>variants[3].triangles),'separate garment geometry is actually drawn');
   await page.locator('#gltf-garment').selectOption('LAB-A');
   const neutral=await imageHash(page);await page.locator('#gltf-skin-proof').check();const skinned=await imageHash(page);assert.notEqual(skinned,neutral,'glTF bone rotation must change body and clothing shape');frames.push(await capture(page,profile.lang+'-'+profile.width+'-skin-proof'));await page.locator('#gltf-skin-proof').uncheck();
   const standard=await imageHash(page);await page.locator('#gltf-material').selectOption('basic');assert.notEqual(await imageHash(page),standard,'PBR lighting/material must change actual pixels');await page.locator('#gltf-material').selectOption('standard');
   let previous=(await readSnapshot(page)).viewYaw,total=0;for(let n=0;n<36;n++){await page.locator('#gltf-right').click();const yaw=(await readSnapshot(page)).viewYaw;total+=Math.abs(Math.atan2(Math.sin(yaw-previous),Math.cos(yaw-previous)));previous=yaw;}assert.ok(total>=Math.PI*2-.02,'actual camera controls must traverse at least a full 360 degrees');
   await page.locator('#gltf-front').click();const preZoom=await imageHash(page);await page.locator('#gltf-zoom-in').click();assert.notEqual(await imageHash(page),preZoom);await page.locator('#gltf-zoom-out').click();
   await touchOrMouse(page,profile.touch);
   await page.locator('#gltf-front').focus();await page.keyboard.press('Enter');const keyFront=await imageHash(page);await page.locator('#gltf-right').focus();await page.keyboard.press('Enter');assert.notEqual(await imageHash(page),keyFront,'keyboard activates actual camera controls');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'tablet layout must not overflow horizontally');
   assert.deepEqual(await page.evaluate(()=>Object.keys(sessionStorage)),[]);assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),['a1-fashion:language']);
   const active=await readSnapshot(page),samples=(active.frameSamples||[]).filter(Number.isFinite);assert.ok(samples.length>0,'actual render submission timing samples recorded');
   const glError=await canvas(page).evaluate(c=>c.getContext('webgl2').getError());assert.equal(glError,0,'real GL draws must not leave a GPU error');
   await page.locator('#gltf-delete').click();await page.waitForFunction(()=>document.querySelector('#gltf-proof-root').dataset.loadState==='disposed');const disposed=await readSnapshot(page);assert.equal(disposed.disposed,true);
   if(disposed.memoryGeometries!==undefined)assert.equal(disposed.memoryGeometries,0,'all model geometries freed');
   if(disposed.memoryTextures!==undefined)assert.equal(disposed.memoryTextures,0,'all model textures freed');
   await page.locator('#gltf-retry').click();await page.waitForFunction(()=>document.querySelector('#gltf-proof-root').dataset.loadState==='ready');assert.ok((await readSnapshot(page)).triangles>1000,'manual retry reloads real model');
   assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(violations,[]);
   reports.push({profile,initial,variants,frames,fullRotationRadians:total,cpuRenderSubmissionP50Ms:percentile(samples,.5),cpuRenderSubmissionP95Ms:percentile(samples,.95),requests,errors,consoleErrors,violations});
   console.log(`glTF ${profile.lang} ${profile.width}x${profile.height}: real body/clothes/skin/material pixels, full360, ${profile.touch?'touch+pinch':'mouse'}, delete/retry and privacy passed.`);await context.close();
  }
  for(const mode of ['modelBlocked','noWebgl']){
   const trial=await prepare(browser,{width:820,height:1180,touch:true,lang:'ko'},{[mode]:true});
   await trial.page.waitForFunction(()=>document.querySelector('#gltf-proof-root').dataset.loadState==='error');
   const status=await trial.page.locator('#gltf-status').innerText();assert.match(status,mode==='noWebgl'?/WebGL\s*2|WebGL2/i:/GLB|모델|model|load/i);assert.equal(await trial.page.locator('#gltf-retry').isEnabled(),true);assert.ok(trial.requests.filter(request=>request==='/assets/gltf-proof/avatar.glb').length<=1,'no automatic retry loop');assert.deepEqual(trial.errors,[]);assert.deepEqual(trial.violations,[]);
   reports.push({failureMode:mode,status,requests:trial.requests,errors:trial.errors,consoleErrors:trial.consoleErrors});await trial.context.close();
  }
  const lost=await prepare(browser,{width:820,height:1180,touch:true,lang:'ko'});
  const lossSupported=await canvas(lost.page).evaluate(c=>{const gl=c.getContext('webgl2'),extension=gl?.getExtension('WEBGL_lose_context');if(!extension)return false;window.__gltfLossExtension=extension;extension.loseContext();return true;});
  assert.equal(lossSupported,true,'test must actually lose a real WebGL context');await lost.page.waitForFunction(()=>document.querySelector('#gltf-proof-root').dataset.loadState==='error');assert.match(await lost.page.locator('#gltf-status').innerText(),/WebGL|컨텍스트|context|그래픽|GPU/i);assert.deepEqual(lost.errors,[]);reports.push({failureMode:'actualWebglContextLoss',status:await lost.page.locator('#gltf-status').innerText(),requests:lost.requests});await lost.context.close();
  const production=await prepare(browser,{width:820,height:1180,touch:true,lang:'ko'},{production:true});assert.ok(!production.requests.includes('/assets/gltf-proof/avatar.glb'),'Production cannot activate isolated proof model');const state=await production.page.locator('#gltf-proof-root').getAttribute('data-load-state');assert.notEqual(state,'ready');reports.push({productionBlocked:true,requests:production.requests,state});await production.context.close();
  const sources=['gltf-proof.html','assets/gltf-proof.js','assets/gltf-proof.css','assets/gltf-proof/avatar.glb','assets/gltf-proof/asset-manifest.json'];
  fs.writeFileSync(path.join(out,'browser-result.json'),JSON.stringify({sourceHashes:Object.fromEntries(sources.map(file=>[file,sha(fs.readFileSync(path.join(root,file)))])),reports,environment:{browser:'Linux Chromium with SwiftShader',nativeIpadSafari:false,webkitInstalled:fs.existsSync(webkit.executablePath())},limits:'Existing CC0 body and original example garment conversion. New photorealistic human not obtained. CPU render-submission timings are not GPU frame time, display FPS, or iPad hardware performance. No user photo or body analysis data used.'},null,2));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
