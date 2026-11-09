'use strict';
// Cloudflare Pages canonicalizes .html documents with a real HTTP redirect.
async function pagesRedirect(route,url){
 if(!['/avatar-lab.html','/product-lab.html'].includes(url.pathname))return false;
 await route.fulfill({status:308,headers:{Location:url.pathname.slice(0,-5)+url.search},body:''});return true;
}
function pagesPath(url){return ['/avatar-lab','/product-lab'].includes(url.pathname)?url.pathname.slice(1)+'.html':url.pathname==='/'?'index.html':url.pathname.slice(1);}
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),origin='https://photo-avatar.a1fashion.pages.dev',out='/workspace/work/shopping-first';fs.mkdirSync(out,{recursive:true});
const mime={'.json':'application/json','.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.jpg':'image/jpeg'};
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{for(const [width,height]of (process.env.A1_SHOPPING_ONE?[[390,844]]:[[820,1180],[1180,820],[390,844]]))for(const lang of (process.env.A1_SHOPPING_ONE?['ko']:['ko','en'])){
 const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true,locale:lang==='ko'?'ko-KR':'en-US'}),requests=[],errors=[];
 await context.route('**/*',async route=>{const r=route.request(),u=new URL(r.url());if(u.origin!==origin){assert.equal(r.method(),'GET');assert.ok(['search.shopping.naver.com','www.coupang.com'].includes(u.hostname));requests.push(u.href);await route.fulfill({contentType:'text/html',body:'<!doctype html><title>Official search navigation test</title>'});return;}assert.equal(r.method(),'GET');for(const [key,value]of u.searchParams){assert.equal(key,'v');assert.match(value,/^[a-z0-9-]+$/);}assert.ok(!u.pathname.startsWith('/api/'));requests.push(u.pathname);if(await pagesRedirect(route,u))return;const file=path.resolve(root,pagesPath(u));assert.ok(file.startsWith(root+'/'));await route.fulfill({body:fs.readFileSync(file),contentType:mime[path.extname(file)]||'application/octet-stream'});});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedSearch=text;}}});window.fixtureShape='wide';window.Pose=class{setOptions(){}onResults(fn){this.result=fn;}async initialize(){}async reset(){}async close(){}async send(){const p=Array.from({length:33},()=>({x:.5,y:.5,visibility:.99})),wide=window.fixtureShape==='wide';for(const[i,[x,y]]of Object.entries(wide?{11:[.25,.2],12:[.75,.2],23:[.38,.5],24:[.62,.5],25:[.38,.7],26:[.62,.7],27:[.38,.9],28:[.62,.9]}:{11:[.35,.2],12:[.65,.2],23:[.32,.42],24:[.68,.42],25:[.32,.68],26:[.68,.68],27:[.32,.95],28:[.68,.95]}))p[i]={x,y,visibility:.99};this.result({poseLandmarks:p});}};});
 await page.goto(origin+'/',{waitUntil:'networkidle'});await page.evaluate(l=>A1I18n.setLanguage(l),lang);
 assert.equal(await page.locator('main>section').first().getAttribute('id'),'shopping-search');assert.equal(await page.locator('#shopping-search').isVisible(),true);assert.equal(await page.locator('#avatar-root').count(),0);
 await page.locator('#shopping-query').fill('남성 검정 슬랙스 5만원 이하 secretword');await page.locator('#shopping-search-form button').click();
 assert.match(await page.locator('#shopping-search-results').innerText(),/50,000/);assert.match(await page.locator('#shopping-search').innerText(),lang==='ko'?/실제 상품 0개/:/0 verified real products/);
 const hrefs=await page.locator('#shopping-search-results a').evaluateAll(a=>a.map(n=>n.href));assert.equal(hrefs.length,4);for(const href of hrefs)assert.doesNotMatch(decodeURIComponent(href),/secretword|50000|50,000|metrics|photo/);
 assert.equal(new URL(hrefs[0]).searchParams.get('query'),'남성 검정 슬랙스');
 await page.locator('#shopping-search-results [data-preview-copy=copyTerm]').first().click();assert.equal(await page.evaluate(()=>window.copiedSearch),'남성 검정 슬랙스');
 await page.locator('#shopping-style-button').click();const generic=await page.locator('#shopping-style-advice').innerText();assert.match(generic,lang==='ko'?/규칙 기반/:/rule-based/);
 await page.locator('#ai-photo').setInputFiles(path.join(root,'assets/photos/man.jpg'));await page.locator('#ai-analyze').click();await page.waitForFunction(()=>!document.querySelector('#ai-result').hidden);assert.equal(await page.locator('#shopping-analysis-consent').isChecked(),false);
 await page.locator('#shopping-analysis-consent').check();await page.locator('#shopping-style-button').click();assert.notEqual(await page.locator('#shopping-style-advice').innerText(),generic);
 await page.locator('#shopping-analysis-consent').uncheck();assert.equal(await page.locator('#shopping-style-advice').innerText(),'');
 await page.locator('#shopping-query').fill('남성 검정 슬랙스 5만원 이하');await page.locator('#shopping-search-form button').click();await page.locator('#shopping-search').screenshot({path:path.join(out,`search-${lang}-${width}.png`),style:'header{visibility:hidden!important}'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(await page.evaluate(()=>Object.keys(sessionStorage)),[]);assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),['a1-fashion:language']);
 await page.locator('#ai-clear').click();assert.equal(await page.locator('#shopping-analysis-consent').isDisabled(),true);
 // Trusted click navigates to the actual official search endpoint, intercepted locally.
 await page.locator('#shopping-search-results a').first().click();assert.equal(new URL(page.url()).searchParams.get('query'),'남성 검정 슬랙스');assert.deepEqual(errors,[]);
 console.log(`Shopping ${lang} ${width}x${height}: first screen, natural query/budget, zero real products disclosed, safe official searches/copy, rule advice, consented photo guidance, delete, trusted navigation passed.`);await context.close();
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
