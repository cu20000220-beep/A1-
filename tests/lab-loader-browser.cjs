'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),origin='https://canonical.a1fashion.pages.dev';const mime={'.json':'application/json','.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.svg':'image/svg+xml'};
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{
for(const [kind,mode,code]of [['avatar','network','REQUEST'],['avatar','http','HTTP'],['avatar','mime','MIME'],['avatar','template','TEMPLATE'],['avatar','script','SCRIPT'],['avatar','init','INIT'],['avatar','webgl','WEBGL'],['product','http','HTTP'],['product','init','INIT']]){
 let allow=false,htmlRedirects=0;const context=await browser.newContext({viewport:{width:820,height:1180},hasTouch:true,locale:'ko-KR'});
 await context.route('**/*',async route=>{const r=route.request(),u=new URL(r.url());assert.equal(u.origin,origin);assert.equal(r.method(),'GET');assert.ok(!u.pathname.startsWith('/api/'));
  if(['/avatar-lab.html','/product-lab.html'].includes(u.pathname)){htmlRedirects++;await route.fulfill({status:308,headers:{location:u.pathname.replace('.html','')},body:''});return;}
  if(u.pathname==='/'+kind.replace('product','product')+'-lab'&&!allow){
   if(mode==='network'){await route.abort('failed');return;}
   if(mode==='http'){await route.fulfill({status:503,contentType:'text/html',body:'unavailable'});return;}
   if(mode==='mime'){await route.fulfill({contentType:'application/json',body:'{}'});return;}
   if(mode==='template'){await route.fulfill({contentType:'text/html',body:'<!doctype html><p>Different page</p>'});return;}
  }
  const p=['/avatar-lab','/product-lab'].includes(u.pathname)?u.pathname+'.html':u.pathname==='/'?'/index.html':u.pathname;const file=path.join(root,p);await route.fulfill({body:fs.readFileSync(file),contentType:mime[path.extname(file)]||'application/octet-stream'});
 });
 const page=await context.newPage();await page.addInitScript(()=>{window.Pose=class{setOptions(){}onResults(fn){this.result=fn;}async initialize(){}async reset(){}async close(){}async send(){const p=Array.from({length:33},()=>({x:.5,y:.5,visibility:.99}));for(const[i,[x,y]]of Object.entries({11:[.25,.2],12:[.75,.2],23:[.38,.5],24:[.62,.5],25:[.38,.7],26:[.62,.7],27:[.38,.9],28:[.62,.9]}))p[i]={x,y,visibility:.99};this.result({poseLandmarks:p});}};});
 if(mode==='webgl')await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...rest){return t==='webgl'?null:get.call(this,t,...rest);};});
 await page.goto(origin+'/#ai-studio',{waitUntil:'networkidle'});
 // Reproduce the exact old browser rejection, with the 308 left intact.
 const rejected=await page.evaluate(async()=>{try{await fetch('/avatar-lab.html',{redirect:'error'});return false;}catch{return true;}});assert.equal(rejected,true);assert.equal(htmlRedirects,1);
 await page.locator('#ai-photo').setInputFiles(path.join(root,'assets/photos/man.jpg'));await page.locator('#ai-analyze').click();await page.waitForFunction(()=>!document.querySelector('#ai-result').hidden);
 if(mode==='script')await page.evaluate(()=>window.initializeAvatarLab=null);
 if(mode==='init')await page.evaluate(k=>{window[k==='avatar'?'initializeAvatarLab':'initializeProductLab']=()=>{throw Error('deliberate initialization failure');};},kind);
 if(kind==='avatar'){await page.locator('#avatar-reference-consent').check();await page.locator('#lab-open-avatar').click();}else await page.locator('#lab-open-recommend').click();
 const status=kind==='avatar'?'#avatar-bridge-status':'#lab-entry-status';await page.waitForFunction(({s,c})=>document.querySelector(s).dataset.errorCode===c,{s:status,c:'A1-LAB-'+code});assert.equal(await page.locator(status).isVisible(),true);
 assert.equal(await page.locator(status+'-actions a').getAttribute('href'),'/'+kind+'-lab');assert.equal(await page.locator(status+'-actions button').isVisible(),true);assert.equal(htmlRedirects,1,'new loader must never request .html');
 if(['network','http','mime','template'].includes(mode)){allow=true;await page.locator(status+'-actions button').click();await page.waitForFunction(k=>document.querySelector(k==='avatar'?'#avatar-root':'#lab-root')?.dataset.loadState==='ready',kind);assert.equal(await page.locator(status).getAttribute('data-error-code'),null);assert.equal(await page.locator(status+'-actions').count(),0);}
 assert.deepEqual(await page.evaluate(()=>Object.keys(sessionStorage)),[]);console.log(`${kind}/${mode}: old 308 rejected, canonical loader uses distinct ${code} diagnosis, safe recovery passed.`);await context.close();
}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
