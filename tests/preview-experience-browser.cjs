'use strict';
// Browser requests are fulfilled from this checkout, at a standard Preview
// origin. No real accounts, DBs, providers, merchants or paid services exist.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=process.env.A1_PREVIEW_SCREENSHOTS||'/workspace/work/preview-experience';fs.mkdirSync(out,{recursive:true});
const origin='https://browser-test.a1fashion.pages.dev';
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.svg':'image/svg+xml'};
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  for(const width of [390,820])for(const language of ['ko','en']){
   const context=await browser.newContext({viewport:{width,height:1180},hasTouch:true,locale:language==='ko'?'ko-KR':'en-US'});
   const calls=[],external=[],errors=[];
   await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin!==origin){external.push({url:req.url(),headers:req.headers(),method:req.method()});await route.fulfill({body:'<!doctype html><title>Official retailer navigation fixture</title>'});return;}
    if(url.pathname.startsWith('/api/')){calls.push(url.pathname);await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'preview_isolated'})});return;}
    const file=path.resolve(root,url.pathname==='/'?'index.html':url.pathname.slice(1));assert.ok(file.startsWith(root+'/'));
    await route.fulfill({body:fs.readFileSync(file),contentType:mime[path.extname(file)]||'application/octet-stream'});
   });
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>{
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.fixtureClipboard=value;}}});
    window.Pose=class{setOptions(){}onResults(fn){this.result=fn;}async initialize(){}async reset(){}async close(){}async send(){
     const points=Array.from({length:33},()=>({x:.5,y:.5,visibility:.99}));
     for(const [i,[x,y]]of Object.entries({11:[.3,.2],12:[.7,.2],23:[.36,.45],24:[.64,.45],25:[.36,.65],26:[.64,.65],27:[.36,.9],28:[.64,.9]}))points[i]={x,y,visibility:.99};this.result({poseLandmarks:points});}};
   });
   await page.goto(origin+'/#ai-studio',{waitUntil:'networkidle'});
   await page.evaluate(l=>A1I18n.setLanguage(l),language);
   await page.locator('#ai-photo').setInputFiles(path.join(root,'assets/photos/man.jpg'));
   await page.waitForFunction(()=>!document.querySelector('#ai-photo-preview').hidden);
   await page.locator('#ai-analyze').click();await page.waitForFunction(()=>!document.querySelector('#ai-result').hidden);
   assert.equal(await page.locator('#preview-outfit-list li').count(),3);
   assert.equal(await page.locator('#preview-style-consent').isChecked(),false);
   const generic=await page.locator('#preview-style-results').innerText();
   await page.locator('#preview-style-consent').check();
   assert.notEqual(await page.locator('#preview-style-results').innerText(),generic);
   assert.equal(await page.locator('#preview-transfer-consent').isChecked(),false);
   await page.locator('#preview-style-experience').screenshot({path:path.join(out,`styles-${language}-${width}.png`),style:'header{visibility:hidden!important}'});
   // Clearing removes both consent and all derived local suggestions.
   await page.locator('#ai-clear').click();assert.equal(await page.locator('#preview-outfit-list').count(),0);
   assert.equal(await page.locator('#preview-style-consent').isChecked(),false);
   assert.equal(await page.locator('#ai-preview-canvas').evaluate(c=>c.width*c.height),1);
   await page.locator('#ai-photo').setInputFiles(path.join(root,'assets/photos/man.jpg'));
   await page.waitForFunction(()=>!document.querySelector('#ai-photo-preview').hidden);
   await page.locator('#ai-analyze').click();await page.waitForFunction(()=>!document.querySelector('#ai-result').hidden);
   await page.locator('#preview-transfer-consent').check();
   await Promise.all([page.waitForURL('**/stylist.html*'),page.locator('#stylist-analysis-open').click()]);
   assert.equal(await context.pages().length,1,'Current-tab navigation never needs a popup');
   assert.equal(await page.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.startsWith('a1:preview-analysis:')).length),0,'One-use transfer is consumed');
   assert.equal(await page.locator('#stylist-analysis-consent').isChecked(),false);
   assert.ok(Number(await page.locator('[name=shoulderHipRatio]').inputValue())>1);
   assert.doesNotMatch(page.url(),/1\.428|1\.8|photo|metrics/);
   await page.locator('#stylist-analysis-consent').check();
   await page.locator('#stylist-message').fill(language==='ko'?'출근 코디를 추천해주세요':'Suggest an office outfit');
   assert.equal(await page.locator('#stylist-form').evaluate(f=>f.checkValidity()),true,'Imported ratios must pass native Safari-compatible number constraints');
   await page.locator('#stylist-send').click();await page.waitForFunction(()=>document.querySelectorAll('.stylist-message:not(.is-user)').length>0);
   assert.match(await page.locator('#stylist-chat').innerText(),/DEMO/);assert.equal(await page.locator('.stylist-product').count(),0);
   await page.evaluate(l=>A1I18n.setLanguage(l),language==='ko'?'en':'ko');
   assert.match(await page.locator('#stylist-chat').innerText(),language==='ko'?/on your device|consented/i:/기기|동의/);
   await page.locator('#stylist-clear').click();assert.equal(await page.locator('[name=shoulderHipRatio]').inputValue(),'');
   await page.locator('#stylist-message').fill('data:image/png;base64,PRIVATE');await page.locator('#stylist-send').click();
   assert.equal(await page.locator('#stylist-status.is-error').count(),1,'Invalid messages fail locally');
   await page.goto(origin+'/global.html',{waitUntil:'networkidle'});await page.evaluate(l=>A1I18n.setLanguage(l),language);
   await page.locator('#global-search [name=country]').selectOption('KR');await page.locator('#global-search [name=category]').selectOption('tops');
   await page.locator('#global-search button[type=submit]').click();await page.waitForFunction(()=>document.querySelectorAll('#retailer-results a').length===4);
   const kr=await page.locator('#retailer-results a').evaluateAll(a=>a.map(n=>n.href));
   for(const href of [kr[0],kr[2]]){const url=new URL(href);assert.equal(url.searchParams.get(url.hostname.includes('coupang')?'q':'query'),'셔츠');assert.doesNotMatch(href,/%25/);}
   await page.locator('#retailer-results [data-preview-copy=copyTerm]').first().click();
   assert.equal(await page.evaluate(()=>window.fixtureClipboard),'셔츠');
   await page.locator('#retailer-results [data-preview-copy=copyUrl]').first().click();assert.equal(await page.evaluate(()=>window.fixtureClipboard),kr[0]);
   await page.evaluate(()=>{navigator.clipboard.writeText=async()=>{throw new Error('in-app clipboard denied');};document.execCommand=()=>false;});
   await page.locator('#retailer-results [data-preview-copy=copyTerm]').first().click();
   assert.equal(await page.locator('#retailer-results textarea').first().isVisible(),true);
   assert.equal(await page.locator('#retailer-results textarea').first().inputValue(),'셔츠');
   assert.match(await page.locator('#retailer-results .preview-copy-status').first().innerText(),language==='ko'?/길게/:/Press and hold/);
   await page.locator('main').screenshot({path:path.join(out,`korean-retailers-${language}-${width}.png`),style:'header{visibility:hidden!important}'});
   await page.locator('#global-search [name=country]').selectOption('US');await page.locator('#global-search [name=category]').selectOption('tops');
   await page.locator('#global-search button[type=submit]').click();await page.waitForFunction(()=>document.querySelectorAll('#retailer-results a').length>0);
   assert.equal(await page.locator('#retailer-results a').count(),4,'Two official searches plus official home alternatives');
   const hrefs=await page.locator('#retailer-results a').evaluateAll(a=>a.map(n=>n.href));assert.ok(hrefs.every(h=>!/(PRIVATE|metrics|1\.428|photo)/.test(h)));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.locator('main').screenshot({path:path.join(out,`shopping-${language}-${width}.png`),style:'header{visibility:hidden!important}'});
   const expectedHref=await page.locator('#retailer-results a').first().getAttribute('href');
   await page.locator('#retailer-results a').first().evaluate(a=>a.href='https://evil.example.test/collect');
   await page.locator('#retailer-results a').first().click();assert.equal(external.length,0);assert.equal(new URL(page.url()).origin,origin);
   await page.locator('#retailer-results a').first().evaluate((a,url)=>a.href=url,expectedHref);
   assert.deepEqual(calls,[],'All Preview buttons stay entirely off API routes');
   await Promise.all([page.waitForURL('https://www.ebay.com/**'),page.locator('#retailer-results a').first().click()]);
   assert.equal(external.length,1);assert.equal(external[0].method,'GET');assert.equal(external[0].headers.referer,undefined);
   assert.equal(await context.pages().length,1);assert.deepEqual(errors,[]);
   console.log(`Preview ${language} ${width}: analysis → consented current-tab stylist → local advice → official merchant click passed; API calls 0.`);
   await context.close();
  }
  // Same files at Production must not install the local experience or intercept
  // authenticated server calls, regardless of client-side paid/beta flags.
  const context=await browser.newContext();const productionCalls=[];
  await context.route('**/*',async route=>{const url=new URL(route.request().url());if(url.pathname.startsWith('/api/')){productionCalls.push(url.pathname);return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({allowed:false,error:'subscription_required'})});}const file=path.resolve(root,url.pathname==='/'?'index.html':url.pathname.slice(1));return route.fulfill({body:fs.readFileSync(file),contentType:mime[path.extname(file)]||'application/octet-stream'});});
  const page=await context.newPage();await page.goto('https://a1fashion.pages.dev/',{waitUntil:'networkidle'});
  assert.equal(await page.evaluate(()=>window.A1Preview),undefined);await page.locator('#premium-check').click();await page.waitForFunction(()=>!document.querySelector('#premium-check').disabled);
  assert.ok(productionCalls.includes('/api/membership'));assert.equal(await page.locator('#premium-controls').isVisible(),false);
  await context.close();console.log('Production retains real server checks; no Preview authorization fallback.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
