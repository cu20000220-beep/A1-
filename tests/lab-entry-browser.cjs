'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),origin='https://research.a1fashion.pages.dev',out=process.env.A1_LAB_SCREENSHOTS||'/workspace/work/product-lab';fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.svg':'image/svg+xml'};
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{for(const [width,height] of [[820,1180],[1180,820],[390,844]])for(const lang of ['ko','en']){
 const context=await browser.newContext({viewport:{width,height},hasTouch:true,locale:lang==='ko'?'ko-KR':'en-US'}),requests=[],errors=[];
 await context.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());requests.push({url:req.url(),method:req.method()});assert.equal(url.origin,origin);assert.equal(req.method(),'GET');assert.ok(!url.pathname.startsWith('/api/'));
  const file=path.resolve(root,url.pathname==='/'?'index.html':url.pathname.slice(1));assert.ok(file.startsWith(root+'/'));await route.fulfill({body:fs.readFileSync(file),contentType:mime[path.extname(file)]||'application/octet-stream'});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.Pose=class{setOptions(){}onResults(fn){this.result=fn;}async initialize(){}async reset(){}async close(){}async send(){const points=Array.from({length:33},()=>({x:.5,y:.5,visibility:.99}));for(const[i,[x,y]]of Object.entries({11:[.3,.2],12:[.7,.2],23:[.36,.45],24:[.64,.45],25:[.36,.65],26:[.64,.65],27:[.36,.9],28:[.64,.9]}))points[i]={x,y,visibility:.99};this.result({poseLandmarks:points});}};});
 await page.goto(origin+'/#ai-studio',{waitUntil:'networkidle'});await page.evaluate(l=>A1I18n.setLanguage(l),lang);
 assert.equal(await page.locator('#lab-entry').isVisible(),false);assert.equal(await page.locator('#lab-root').count(),0);
 await page.locator('#ai-photo').setInputFiles(path.join(root,'assets/photos/man.jpg'));await page.waitForFunction(()=>!document.querySelector('#ai-photo-preview').hidden);await page.locator('#ai-analyze').click();await page.waitForFunction(()=>!document.querySelector('#ai-result').hidden);
 for(const id of ['recommend','compare','fitting']){const button=page.locator('#lab-open-'+id);await button.scrollIntoViewIfNeeded();assert.equal(await button.isVisible(),true);assert.equal(await button.isEnabled(),true);}
 assert.equal(await page.locator('#lab-open-avatar').isDisabled(),true);
 await page.locator('#lab-entry').screenshot({path:path.join(out,`entry-${lang}-${width}.png`),style:'header{visibility:hidden!important}'});
 const imageBefore=await page.locator('#ai-canvas').evaluate(c=>c.toDataURL());
 await page.locator('#lab-open-recommend').click();await page.waitForSelector('#lab-root:not([hidden])');
 assert.equal(await page.locator('#ai-form').count(),1);assert.equal(await page.locator('#ai-canvas').evaluate(c=>c.toDataURL()),imageBefore);assert.equal(await page.locator('.lab-card').count(),0);
 assert.match(await page.locator('#lab-catalog-state').innerText(),lang==='ko'?/실제 상품 자료가 없습니다/:/No approved real product/);
 assert.equal(await page.locator('#lab-body-consent').isChecked(),false);assert.equal(await page.locator('#lab-body-consent').isEnabled(),true);
 await page.locator('#lab-fixtures').click();assert.equal(await page.locator('.lab-card').count(),3);
 await page.waitForFunction(()=>[...document.querySelectorAll('.lab-card img')].every(i=>i.complete&&i.naturalWidth>0));
 const firstDiagram=await page.locator('.lab-card img').first().boundingBox();assert.ok(firstDiagram.y>=0&&firstDiagram.y+firstDiagram.height<=height,'diagram must be on screen after activation without test scrolling');
 await page.screenshot({path:path.join(out,`visible-cards-${lang}-${width}.png`)});

 await page.locator('#lab-preferences [name=size]').fill('M');await page.locator('#lab-preferences button[type=submit]').click();
 await page.locator('[data-lab-compare=LAB-A]').click();await page.locator('[data-lab-compare=LAB-B]').click();
 await page.locator('#lab-open-compare').click();assert.equal(await page.locator('#lab-comparison tr').count(),3);assert.equal(await page.locator('#lab-preferences [name=size]').inputValue(),'M');
 assert.equal(await page.locator('#lab-body-consent').isChecked(),false);
 await page.locator('#lab-body-consent').check();await page.locator('[data-lab-select=LAB-A]').click();
 await page.locator('#lab-open-fitting').click();assert.equal(await page.locator('#lab-body-consent').isChecked(),true);assert.equal(await page.locator('#lab-fit-consent').isChecked(),false);
 await page.locator('#lab-fit').click();assert.equal(await page.locator('#lab-fit-canvas').isVisible(),false);
 await page.locator('#lab-fit-consent').check();await page.locator('#lab-fit').click();await page.waitForFunction(()=>!document.querySelector('#lab-fit-canvas').hidden);
 const shown=await page.locator('#lab-fit-canvas').boundingBox();assert.ok(shown.width>=280&&shown.height>=400,'large result required');assert.ok(shown.y>=0&&shown.y+shown.height/2<height,'result must be in viewport without test scrolling');
 const changed=await page.evaluate(()=>{const a=document.querySelector('#ai-canvas'),b=document.querySelector('#lab-fit-canvas'),x=a.getContext('2d').getImageData(0,0,a.width,a.height-40).data,y=b.getContext('2d').getImageData(0,0,b.width,b.height-40).data;let n=0;for(let i=0;i<x.length;i+=4)if(Math.abs(x[i]-y[i])+Math.abs(x[i+1]-y[i+1])+Math.abs(x[i+2]-y[i+2])>20)n++;return n;});assert.ok(changed>100,'garment must change actual photo pixels, excluding footer');
 await page.screenshot({path:path.join(out,`visible-fit-${lang}-${width}.png`)});

 const before=await page.locator('#lab-fit-canvas').evaluate(c=>c.toDataURL());
 await page.locator('#lab-fit-y').evaluate(e=>{e.value='25';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.waitForFunction(b=>document.querySelector('#lab-fit-canvas').toDataURL()!==b,before);
 const moved=await page.locator('#lab-fit-canvas').evaluate(c=>c.toDataURL());await page.locator('#lab-fit-scale').evaluate(e=>{e.value='45';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.waitForFunction(b=>document.querySelector('#lab-fit-canvas').toDataURL()!==b,moved);
 await page.locator('#lab-fit-canvas').screenshot({path:path.join(out,`entry-fit-${lang}-${width}.png`)});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(await page.evaluate(()=>Object.keys(sessionStorage)),[]);
 assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),['a1-fashion:language']);assert.equal(page.url(),origin+'/#ai-studio');
 await page.locator('#lab-fit-consent').uncheck();assert.equal(await page.locator('#lab-fit-canvas').evaluate(c=>c.width*c.height),1);
 await page.locator('#lab-clear').click();assert.equal(await page.locator('#ai-result').isVisible(),false);assert.equal(await page.locator('#lab-entry').isVisible(),false);assert.equal(await page.locator('.lab-card').count(),0);assert.equal(await page.locator('#lab-body-consent').isChecked(),false);
 assert.deepEqual(errors,[]);console.log(`Home entry ${lang} ${width}x${height}: analysis → visible buttons → same-document lab → 3 fixtures → reasons/comparison → consent → 2D position/scale → revoke/clear passed; GET self only.`);await context.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
