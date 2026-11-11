'use strict';
// Actual WebGL/material evidence. Generic licensed assets only, never a retail
// garment, personal-photo reconstruction or native iPad Safari certification.
const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),origin='https://human-material.a1fashion.pages.dev',stage=process.env.A1_HUMAN_MATERIAL_STAGE==='before'?'before':'after',out=path.join('/workspace/work/human-materials',stage);fs.mkdirSync(out,{recursive:true});
const quick=process.env.A1_HUMAN_MATERIAL_QUICK==='1';
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'};
const policy=fs.readFileSync(path.join(root,'_headers'),'utf8').match(/^\/avatar-lab\*\n\s+Content-Security-Policy:\s*([^\r\n]+)/m)[1];
const assetNames=new Set(['avatar-lab.html','assets/style.css','assets/avatar-lab.css','assets/i18n.js','assets/preview-experience.js','assets/human-base.js','assets/avatar-geometry.js','assets/avatar-lab.js','assets/placeholder.svg']);
for(const match of fs.readFileSync(path.join(root,'avatar-lab.html'),'utf8').matchAll(/(?:src|href)="(assets\/[^"?]+)(?:\?[^" ]*)?"/g))assetNames.add(match[1]);
for(const name of fs.readdirSync(path.join(root,'assets')))if(/^human[-\w]*\.(?:png|jpg|webp|js)$/i.test(name))assetNames.add('assets/'+name);
const assets=new Map([...assetNames].map(file=>[file,fs.readFileSync(path.join(root,file))]));
const baselineFile='/workspace/work/human-materials/before/result.json',baseline=stage==='after'&&fs.existsSync(baselineFile)?JSON.parse(fs.readFileSync(baselineFile,'utf8')):null;
const texturePath=pathname=>/\.(?:png|jpg|webp)$/i.test(pathname)&&/^\/assets\/human[-\w]*\./i.test(pathname);
const hasTextureAsset=[...assets.keys()].some(file=>texturePath('/'+file));
const hasHeadAsset=assets.has('assets/human-head.js');
const pixels=page=>page.locator('#avatar-after').evaluate(c=>c.toDataURL());
function instrument(){
 window.__humanRenderSamples=[];window.__humanGlErrors=[];const original=WebGLRenderingContext.prototype.drawArrays;
 WebGLRenderingContext.prototype.drawArrays=function(...args){const start=performance.now();const result=original.apply(this,args);this.finish();window.__humanRenderSamples.push(performance.now()-start);const error=this.getError();if(error!==this.NO_ERROR)window.__humanGlErrors.push(error);return result;};
}
async function capture(page,name){
 await page.locator('.avatar-views').screenshot({path:path.join(out,name+'.png')});
 const canvas=page.locator('#avatar-after');await canvas.scrollIntoViewIfNeeded();const box=await canvas.boundingBox();
 await page.screenshot({path:path.join(out,name+'-head.png'),clip:{x:box.x+box.width*.31,y:box.y+box.height*.035,width:box.width*.38,height:box.height*.27}});
}
async function prepare(browser,profile,{blocked=false,hold=false,shaderFailure=false}={}){
 const context=await browser.newContext({viewport:{width:profile.width,height:profile.height},hasTouch:profile.touch,isMobile:profile.touch,locale:profile.lang==='ko'?'ko-KR':'en-US'}),calls=[],errors=[],consoleErrors=[],violations=[];let release;
 const gate=hold?new Promise(resolve=>{release=resolve;}):Promise.resolve();
 await context.addInitScript(instrument);
 if(shaderFailure)await context.addInitScript(()=>{window.__studioShaderFailures=0;const original=WebGLRenderingContext.prototype.shaderSource;WebGLRenderingContext.prototype.shaderSource=function(shader,source){if(source.includes('A1_SKIN_STUDIO')){window.__studioShaderFailures++;source+='\nA1 deliberate invalid shader token';}return original.call(this,shader,source);};});
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());assert.equal(req.method(),'GET');assert.equal(url.origin,origin,'no photographs/models/API sent off-origin');assert.ok(!url.pathname.startsWith('/api/'),'no Preview API call');for(const[key,value]of url.searchParams){assert.equal(key,'v');assert.match(value,/^[a-z0-9-]+$/);}calls.push(url.pathname);
  const file=url.pathname==='/avatar-lab'?'avatar-lab.html':url.pathname.slice(1);assert.ok(assets.has(file),'only reviewed local asset set may load: '+file);
  if(texturePath(url.pathname)){if(blocked){await route.abort('failed');return;}await gate;}
  await route.fulfill({contentType:mime[path.extname(file)]||'application/octet-stream',body:assets.get(file),headers:file==='avatar-lab.html'?{'Content-Security-Policy':policy}:{}});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});await page.exposeFunction('captureHumanCsp',directive=>violations.push(directive));await page.addInitScript(()=>document.addEventListener('securitypolicyviolation',e=>window.captureHumanCsp(e.effectiveDirective)));
 await page.goto(origin+'/avatar-lab',{waitUntil:hold?'domcontentloaded':'networkidle'});await page.evaluate(lang=>A1I18n.setLanguage(lang),profile.lang);await page.waitForFunction(()=>document.querySelector('#avatar-root')?.dataset.loadState==='ready');return {context,page,calls,errors,consoleErrors,violations,release};
}
async function spin(page,touch){
 await page.locator('#avatar-front').click();const unique=new Set(),times=[];await page.evaluate(()=>{window.__humanRenderSamples=[];});
 for(let n=0;n<24;n++){const start=performance.now();await page.locator('#avatar-right').click();times.push(performance.now()-start);unique.add(await pixels(page));}
 assert.equal(unique.size,24,'24 genuine button clicks rotate 7.2 radians, beyond a full 360 degrees');
 const canvas=page.locator('#avatar-after');await canvas.scrollIntoViewIfNeeded();const box=await canvas.boundingBox(),before=await pixels(page);
 if(touch){const session=await page.context().newCDPSession(page),x=box.x+box.width*.5,y=box.y+box.height*.5;await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+55,y:y+10,id:1}]});await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
 else{await page.mouse.move(box.x+box.width*.4,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.7,box.y+box.height*.52,{steps:8});await page.mouse.up();}
 await page.waitForFunction(previous=>document.querySelector('#avatar-after').toDataURL()!==previous,before);const gpu=await page.evaluate(()=>window.__humanRenderSamples.slice());const percentile=(rows,p)=>rows.slice().sort((a,b)=>a-b)[Math.min(rows.length-1,Math.floor(rows.length*p))];return {rotations:24,uniqueFrames:unique.size,automationClickP95Ms:percentile(times,.95),instrumentedDrawFinishP50Ms:percentile(gpu,.5),instrumentedDrawFinishP95Ms:percentile(gpu,.95),draws:gpu.length};
}
async function pairedRenderTiming(page){return page.evaluate(async()=>{
 const checkbox=document.querySelector('#avatar-material-basic'),right=document.querySelector('#avatar-right'),runs={};
 for(const [mode,basic]of [['basic',true],['studio',false]]){checkbox.checked=basic;checkbox.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(requestAnimationFrame);const samples=[];for(let n=0;n<12;n++){const start=performance.now();right.click();samples.push(performance.now()-start);await new Promise(requestAnimationFrame);}samples.sort((a,b)=>a-b);runs[mode]={samples:12,handlerWithFinishP50Ms:samples[6],handlerWithFinishP95Ms:samples[11]};}
 checkbox.checked=false;checkbox.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#avatar-front').click();return runs;
});}
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),reports=[];
 try{
  for(const profile of [{lang:'ko',width:1440,height:1080,touch:false},{lang:'ko',width:820,height:1180,touch:true},{lang:'en',width:390,height:844,touch:true}]){
   const trial=await prepare(browser,profile,{hold:stage==='after'&&hasTextureAsset}),{context,page,calls,errors,consoleErrors,violations}=trial;
   assert.equal(await page.locator('#avatar-root').getAttribute('data-human-model'),'hm08-cc0');
   let texturePixelChange=false,studioPixelChange=false,scanHeadPixelChange=false;
   if(stage==='after'){
    await page.waitForFunction(()=>document.querySelector('#avatar-root').dataset.humanMaterial==='ready');assert.equal(await page.locator('#avatar-root').getAttribute('data-human-material-source'),'procedural');
    if(hasHeadAsset){await page.waitForFunction(()=>document.querySelector('#avatar-root').dataset.humanHead==='loading');const plain=await pixels(page);trial.release();await page.waitForFunction(()=>document.querySelector('#avatar-root').dataset.humanHead==='ready');await page.waitForFunction(before=>document.querySelector('#avatar-after').toDataURL()!==before,plain);texturePixelChange=true;assert.equal(await page.locator('#avatar-root').getAttribute('data-human-head-source'),'lee-perry-smith-cc-by-3');assert.deepEqual([...new Set(calls.filter(texturePath))].sort(),['/assets/human-head-color.jpg','/assets/human-head-normal.jpg']);assert.match(await page.locator('#avatar-head-note').innerText(),profile.lang==='ko'?/눈을 감은.*사용자 얼굴 복원.*아닙니다/:/closed eyes.*not a reconstruction of your face/i);assert.match(await page.locator('#avatar-head-credit').innerText(),/Lee Perry-Smith.*CC BY 3\.0/);
     const scan=await pixels(page);await page.locator('#avatar-head-basic').check();assert.notEqual(await pixels(page),scan,'licensed scan head must change real pixels compared with the generic head');await capture(page,profile.lang+'-'+profile.width+'-generic-head');await page.locator('#avatar-head-basic').uncheck();assert.equal(await pixels(page),scan,'scan/generic comparison must retain body/camera and restore exact pixels');scanHeadPixelChange=true;
    }else if(hasTextureAsset){throw Error('A new texture asset needs an explicit rendering/failure contract in this test.');}
    const studio=await pixels(page);await page.locator('#avatar-material-basic').check();assert.notEqual(await pixels(page),studio,'studio material must change real rendered pixels');await capture(page,profile.lang+'-'+profile.width+'-basic-comparison');await page.locator('#avatar-material-basic').uncheck();assert.equal(await pixels(page),studio,'studio/basic comparison must be reversible without changing body or camera');studioPixelChange=true;
   }
   for(const view of ['front','side','back']){await page.locator('#avatar-'+view).click();await capture(page,profile.lang+'-'+profile.width+'-'+view);}
   if(quick){reports.push({profile,quick:true,calls,texturePixelChange,studioPixelChange,scanHeadPixelChange,errors,consoleErrors,violations});await context.close();break;}
   await page.locator('#avatar-front').click();const variants=new Set();for(const garment of ['LAB-A','LAB-B','LAB-C']){await page.locator('#avatar-garment').selectOption(garment);variants.add(await pixels(page));}assert.equal(variants.size,3);await page.locator('#avatar-garment').selectOption('LAB-A');
   const before=await pixels(page);await page.locator('[name=waist]').fill('100');await page.locator('#avatar-form button[type=submit]').click();assert.notEqual(await pixels(page),before);await page.locator('#avatar-reset').click();
   const perf=await spin(page,profile.touch);assert.ok(perf.instrumentedDrawFinishP95Ms<2000,'rendering must not stall seconds per draw in software Chromium');const pairedTiming=stage==='after'?await pairedRenderTiming(page):null;
   await page.locator('#avatar-delete-all').click();assert.equal(await page.locator('#avatar-root').isVisible(),false);assert.equal(await page.locator('#avatar-photo-canvas').evaluate(c=>c.width*c.height),1);assert.equal(await page.locator('[name=waist]').inputValue(),'76');
   assert.deepEqual(await page.evaluate(()=>Object.keys(sessionStorage)),[]);assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),['a1-fashion:language']);assert.deepEqual(await page.evaluate(()=>window.__humanGlErrors),[],'material uploads/draws must not leave WebGL errors');assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(violations,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   const previous=baseline?.reports.find(report=>report.profile.width===profile.width&&report.profile.lang===profile.lang)?.perf,previousClick=previous?.automationClickP95Ms??previous?.inputToReadbackP95Ms,comparison=previous?{baselineDrawP95Ms:previous.instrumentedDrawFinishP95Ms,drawP95DeltaMs:perf.instrumentedDrawFinishP95Ms-previous.instrumentedDrawFinishP95Ms,baselineAutomationClickP95Ms:previousClick,automationClickP95DeltaMs:perf.automationClickP95Ms-previousClick}:null;
   reports.push({profile,calls,texturePixelChange,studioPixelChange,scanHeadPixelChange,perf,pairedTiming,comparison,errors,consoleErrors,violations});console.log(`Human material ${stage} ${profile.width}: rendered front/side/back/head, 3 garments/body edits, full360 and ${profile.touch?'touch':'mouse'} rotation, delete/privacy; draw finish p95=${perf.instrumentedDrawFinishP95Ms.toFixed(1)}ms.`);await context.close();
  }
  if(!quick&&stage==='after'&&hasTextureAsset){
   for(const lang of ['ko','en']){const trial=await prepare(browser,{lang,width:820,height:1180,touch:true},{blocked:true});await trial.page.waitForFunction(()=>document.querySelector('#avatar-root').dataset.humanHead==='fallback');assert.equal(await trial.page.locator('#avatar-root').getAttribute('data-human-material'),'ready','missing head maps must not break studio/body rendering');assert.ok(await trial.page.locator('#avatar-after').evaluate(c=>c.width>1&&c.height>1));assert.match(await trial.page.locator('#avatar-head-note').innerText(),lang==='ko'?/준비하지 못해 기존 범용 모델/:/could not load.*existing generic model/i);assert.deepEqual(await trial.page.evaluate(()=>window.__humanGlErrors),[]);assert.deepEqual(trial.errors,[]);assert.deepEqual(trial.violations,[]);assert.ok(trial.consoleErrors.every(message=>/Failed to load resource|ERR_FAILED/.test(message)),'blocked local texture may produce a resource error, never a shader/JS error');assert.ok(trial.calls.filter(texturePath).length<=2,'no automatic texture retry loop');const initial=await pixels(trial.page);await trial.page.locator('#avatar-right').click();assert.notEqual(await pixels(trial.page),initial,'fallback still rotates and shows garment');await capture(trial.page,'head-fallback-'+lang+'-820');reports.push({blockedTexture:true,language:lang,calls:trial.calls,errors:trial.errors,consoleErrors:trial.consoleErrors});await trial.context.close();}
  }
  if(!quick&&stage==='after'){
   const trial=await prepare(browser,{lang:'ko',width:820,height:1180,touch:true},{shaderFailure:true});assert.ok(await trial.page.evaluate(()=>window.__studioShaderFailures>0),'advanced shader compilation was actually forced to fail');await trial.page.waitForFunction(()=>document.querySelector('#avatar-root').dataset.humanMaterial==='fallback');assert.deepEqual(trial.errors,[],'failed studio shader must not break the page');assert.deepEqual(trial.violations,[]);assert.deepEqual(await trial.page.evaluate(()=>window.__humanGlErrors),[]);const before=await pixels(trial.page);await trial.page.locator('#avatar-right').click();assert.notEqual(await pixels(trial.page),before,'basic fallback must still render and rotate');await capture(trial.page,'shader-fallback-820');reports.push({shaderFallback:true,forcedFailures:await trial.page.evaluate(()=>window.__studioShaderFailures),calls:trial.calls,errors:trial.errors,consoleErrors:trial.consoleErrors});await trial.context.close();
  }
  fs.writeFileSync(path.join(out,quick?'quick-result.json':'result.json'),JSON.stringify({stage,quick,sourceHashes:Object.fromEntries([...assets].map(([file,bytes])=>[file,crypto.createHash('sha256').update(bytes).digest('hex')])),reports,webkit:{installed:fs.existsSync(webkit.executablePath()),nativeSafari:false},limits:'Linux software Chromium with gl.finish instrumentation; timing is comparative evidence, not hardware iPad FPS. Paired timing is same-page JS handler+finish, excluding Playwright/protocol/image-readback overhead. Older baseline field inputToReadbackP95Ms actually denotes automation-click roundtrip and excludes PNG readback; current name is automationClickP95Ms. Fixed generic model only; not personal reconstruction or retail fitting.'},null,2));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
