'use strict';
// Cloudflare Pages canonicalizes .html documents with a real HTTP redirect.
async function pagesRedirect(route,url){
 if(!['/avatar-lab.html','/product-lab.html'].includes(url.pathname))return false;
 await route.fulfill({status:308,headers:{Location:url.pathname.slice(0,-5)+url.search},body:''});return true;
}
function pagesPath(url){return ['/product-lab','/product-lab'].includes(url.pathname)?url.pathname.slice(1)+'.html':url.pathname==='/'?'index.html':url.pathname.slice(1);}
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),origin='https://photo-avatar.a1fashion.pages.dev',out='/workspace/work/avatar-photo';fs.mkdirSync(out,{recursive:true});
const mime={'.json':'application/json','.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.jpg':'image/jpeg'};
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{for(const [width,height]of [[820,1180]])for(const lang of ['delete']){
 let release,signal;const gate=new Promise(r=>release=r),started=new Promise(r=>signal=r);
 const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true,locale:lang==='ko'?'ko-KR':'en-US'}),requests=[],errors=[];
 await context.route('**/*',async route=>{const r=route.request(),u=new URL(r.url());assert.equal(u.origin,origin);assert.equal(r.method(),'GET');for(const [key,value]of u.searchParams){assert.equal(key,'v');assert.match(value,/^[a-z0-9-]+$/);}assert.ok(!u.pathname.startsWith('/api/'));requests.push(u.pathname);if(u.pathname==='/product-lab'){signal();await gate;}if(await pagesRedirect(route,u))return;const file=path.resolve(root,pagesPath(u));assert.ok(file.startsWith(root+'/'));await route.fulfill({body:fs.readFileSync(file),contentType:mime[path.extname(file)]||'application/octet-stream'});});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{window.fixtureShape='wide';window.Pose=class{setOptions(){}onResults(fn){this.result=fn;}async initialize(){}async reset(){}async close(){}async send(){const p=Array.from({length:33},()=>({x:.5,y:.5,visibility:.99})),wide=window.fixtureShape==='wide';for(const[i,[x,y]]of Object.entries(wide?{11:[.25,.2],12:[.75,.2],23:[.38,.5],24:[.62,.5],25:[.38,.7],26:[.62,.7],27:[.38,.9],28:[.62,.9]}:{11:[.35,.2],12:[.65,.2],23:[.32,.42],24:[.68,.42],25:[.32,.68],26:[.68,.68],27:[.32,.95],28:[.68,.95]}))p[i]={x,y,visibility:.99};this.result({poseLandmarks:p});}};});
 await page.goto(origin+'/#ai-studio',{waitUntil:'networkidle'});await page.locator('#ai-photo').setInputFiles(path.join(root,'assets/photos/man.jpg'));await page.locator('#ai-analyze').click();await page.waitForFunction(()=>!document.querySelector('#ai-result').hidden);
 await page.locator('#lab-open-recommend').click();await started;await page.locator('#ai-clear').click();const response=page.waitForResponse('**/product-lab');release();await response;await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.equal(await page.locator('#lab-root').count(),0);
 await page.locator('#ai-photo').setInputFiles(path.join(root,'assets/photos/man.jpg'));await page.locator('#ai-analyze').click();await page.waitForFunction(()=>!document.querySelector('#ai-result').hidden);await page.locator('#lab-open-recommend').click();await page.waitForSelector('#lab-root[data-load-state=ready]');await page.locator('#lab-fixtures').click();assert.equal(await page.locator('.lab-card').count(),3);assert.deepEqual(errors,[]);console.log('Product template delayed past delete: no stale mount, fresh analysis/retry renders 3 cards.');await context.close();
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
