'use strict';
// Cloudflare Pages canonicalizes .html documents with a real HTTP redirect.
async function pagesRedirect(route,url){
 if(!['/avatar-lab.html','/product-lab.html'].includes(url.pathname))return false;
 await route.fulfill({status:308,headers:{Location:url.pathname.slice(0,-5)+url.search},body:''});return true;
}
function pagesPath(url){return ['/avatar-lab','/product-lab'].includes(url.pathname)?url.pathname.slice(1)+'.html':url.pathname==='/'?'index.html':url.pathname.slice(1);}
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),origin='https://research.a1fashion.pages.dev',out=process.env.A1_LAB_SCREENSHOTS||'/workspace/work/product-lab';fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.svg':'image/svg+xml'};
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{for(const width of [390,820])for(const lang of ['ko','en']){
 const context=await browser.newContext({viewport:{width,height:1180},hasTouch:true,locale:lang==='ko'?'ko-KR':'en-US'}),requests=[],errors=[];
 await context.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());requests.push({url:req.url(),method:req.method()});assert.equal(url.origin,origin);assert.equal(req.method(),'GET');assert.ok(!url.pathname.startsWith('/api/'));
  if(await pagesRedirect(route,url))return;const file=path.resolve(root,pagesPath(url));assert.ok(file.startsWith(root+'/'));await route.fulfill({body:fs.readFileSync(file),contentType:mime[path.extname(file)]||'application/octet-stream'});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.Pose=class{setOptions(){}onResults(fn){this.result=fn;}async initialize(){}async reset(){}async close(){}async send(){const points=Array.from({length:33},()=>({x:.5,y:.5,visibility:.99}));for(const[i,[x,y]]of Object.entries({11:[.3,.2],12:[.7,.2],23:[.36,.45],24:[.64,.45],25:[.36,.65],26:[.64,.65],27:[.36,.9],28:[.64,.9]}))points[i]={x,y,visibility:.99};this.result({poseLandmarks:points});}};});
 await page.goto(origin+'/product-lab.html',{waitUntil:'networkidle'});await page.evaluate(l=>A1I18n.setLanguage(l),lang);
 assert.equal(await page.locator('#lab-root').isVisible(),true);assert.equal(await page.locator('.lab-card').count(),0);
 await page.locator('#lab-fixtures').click();assert.equal(await page.locator('.lab-card').count(),3);await page.locator('[data-lab-select=LAB-A]').click();await page.locator('#lab-fit').click();assert.equal(await page.locator('#lab-fit-canvas').isVisible(),false);
 await page.locator('#ai-photo').setInputFiles(path.join(root,'assets/photos/man.jpg'));await page.waitForFunction(()=>!document.querySelector('#ai-photo-preview').hidden);await page.locator('#ai-analyze').click();await page.waitForFunction(()=>!document.querySelector('#ai-result').hidden);
 assert.equal(await page.locator('#lab-body-consent').isChecked(),false);assert.equal(await page.locator('#lab-body-consent').isEnabled(),true);
 await page.locator('#lab-preferences [name=style]').selectOption('classic');await page.locator('#lab-preferences [name=color]').selectOption('navy');await page.locator('#lab-preferences [name=size]').fill('M');await page.locator('#lab-preferences [name=occasion]').selectOption('work');await page.locator('[name=avoid][value=logos]').check();await page.locator('#lab-body-consent').check();
 await page.locator('#lab-fixtures').click();assert.equal(await page.locator('.lab-card').count(),2);assert.equal(await page.locator('.lab-card').first().getAttribute('data-lab-product'),'LAB-A');
 assert.match(await page.locator('.lab-card').first().innerText(),lang==='ko'?/확률|실측/:/probability|measurements/);
 await page.locator('[data-lab-compare=LAB-A]').click();await page.locator('[data-lab-compare=LAB-B]').click();assert.equal(await page.locator('#lab-comparison tr').count(),3);
 await page.locator('[data-lab-select=LAB-A]').click();await page.locator('#lab-fit').click();assert.equal(await page.locator('#lab-fit-canvas').isVisible(),false);
 await page.locator('#lab-fit-consent').check();await page.locator('#lab-fit').click();await page.waitForFunction(()=>!document.querySelector('#lab-fit-canvas').hidden);assert.equal(await page.locator('#lab-fit-canvas').evaluate(c=>c.width>100&&c.height>100),true);
 const pixels=await page.locator('#lab-fit-canvas').evaluate(c=>c.toDataURL());await page.evaluate(l=>A1I18n.setLanguage(l),lang==='ko'?'en':'ko');assert.equal(await page.locator('#lab-fit-canvas').evaluate(c=>c.toDataURL()),pixels);await page.evaluate(l=>A1I18n.setLanguage(l),lang);
 await page.locator('#lab-fit-canvas').screenshot({path:path.join(out,`placement-${lang}-${width}.png`)});await page.locator('#lab-products').screenshot({path:path.join(out,`matching-${lang}-${width}.png`),style:'header{visibility:hidden!important}'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(await page.evaluate(()=>Object.keys(sessionStorage)),[]);assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),['a1-fashion:language']);
 await page.locator('#lab-fit-consent').uncheck();assert.equal(await page.locator('#lab-fit-canvas').evaluate(c=>c.width*c.height),1);
 await page.locator('#lab-clear').click();assert.equal(await page.locator('#ai-result').isVisible(),false);assert.equal(await page.locator('.lab-card').count(),0);assert.equal(await page.locator('#lab-body-consent').isChecked(),false);assert.equal(await page.locator('#lab-fit-consent').isChecked(),false);assert.equal(await page.locator('#ai-canvas').evaluate(c=>c.width*c.height),1);
 assert.deepEqual(errors,[]);console.log(`Lab ${lang} ${width}: photo/analysis/preferences/fixture scoring/comparison/consent/2D placement/revoke/clear passed; requests GET self only (${requests.length}).`);await context.close();
 }
 const context=await browser.newContext();await context.route('**/*',async route=>{const u=new URL(route.request().url());if(await pagesRedirect(route,u))return;const file=path.resolve(root,pagesPath(u));await route.fulfill({body:fs.readFileSync(file),contentType:mime[path.extname(file)]||'application/octet-stream'});});const page=await context.newPage();await page.goto('https://a1fashion.pages.dev/product-lab.html',{waitUntil:'networkidle'});assert.equal(await page.locator('#lab-root').isVisible(),false);assert.equal(await page.locator('#lab-unavailable').isVisible(),true);await context.close();
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
