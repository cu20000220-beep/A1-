'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),origin='https://research.a1fashion.pages.dev',out=process.env.A1_LAB_SCREENSHOTS||'/workspace/work/product-lab';fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.svg':'image/svg+xml'};
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{for(const [width,height] of [[820,1180]])for(const lang of ['ko','en']){
 let failImages=true;const context=await browser.newContext({viewport:{width,height},hasTouch:true,locale:lang==='ko'?'ko-KR':'en-US'}),requests=[],errors=[];
 await context.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());requests.push({url:req.url(),method:req.method()});assert.equal(url.origin,origin);assert.equal(req.method(),'GET');assert.ok(!url.pathname.startsWith('/api/'));
  if(url.pathname==='/assets/lab-garment.svg'&&failImages){await route.fulfill({status:404,body:'image fixture unavailable'});return;}
  const file=path.resolve(root,url.pathname==='/'?'index.html':url.pathname.slice(1));assert.ok(file.startsWith(root+'/'));await route.fulfill({body:fs.readFileSync(file),contentType:mime[path.extname(file)]||'application/octet-stream'});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.Pose=class{setOptions(){}onResults(fn){this.result=fn;}async initialize(){}async reset(){}async close(){}async send(){const points=Array.from({length:33},()=>({x:.5,y:.5,visibility:.99}));for(const[i,[x,y]]of Object.entries({11:[.3,.2],12:[.7,.2],23:[.36,.45],24:[.64,.45],25:[.36,.65],26:[.64,.65],27:[.36,.9],28:[.64,.9]}))points[i]={x,y,visibility:.99};this.result({poseLandmarks:points});}};});
 await page.goto(origin+'/#ai-studio',{waitUntil:'networkidle'});await page.evaluate(l=>A1I18n.setLanguage(l),lang);
 await page.locator('#ai-photo').setInputFiles(path.join(root,'assets/photos/man.jpg'));await page.locator('#ai-analyze').click();await page.waitForFunction(()=>!document.querySelector('#ai-result').hidden);
 await page.locator('#lab-open-recommend').click();await page.waitForSelector('#lab-root:not([hidden])');
 await page.locator('#lab-preferences [name=currency]').selectOption('USD');await page.locator('#lab-fixtures').tap();assert.equal(await page.locator('.lab-card').count(),0);
 assert.match(await page.locator('#lab-products').innerText(),/KRW/);assert.equal(await page.locator('#lab-show-all').isVisible(),true);
 await page.locator('#lab-show-all').click();assert.equal(await page.locator('.lab-card').count(),3);assert.equal(await page.locator('#lab-preferences [name=currency]').inputValue(),'KRW');
 await page.waitForFunction(()=>document.querySelectorAll('.lab-card [role=alert]').length===3);assert.equal(await page.locator('#lab-reload-image').isVisible(),true);
 await page.locator('[data-lab-select=LAB-A]').tap();await page.locator('#lab-fit-consent').check();await page.waitForFunction(()=>!document.querySelector('#lab-reload-image').hidden);assert.equal(await page.locator('#lab-fit-canvas').isVisible(),false);
 failImages=false;await page.locator('#lab-reload-image').tap();await page.waitForFunction(()=>!document.querySelector('#lab-fit-canvas').hidden);
 await page.waitForFunction(()=>[...document.querySelectorAll('.lab-card img')].every(i=>i.complete&&i.naturalWidth>0));
 for(const [id,fraction]of [['lab-fit-y',.8],['lab-fit-scale',.2]]){
  const before=await page.locator('#lab-fit-canvas').evaluate(c=>c.toDataURL());const range=page.locator('#'+id);await range.scrollIntoViewIfNeeded();const box=await range.boundingBox();await page.touchscreen.tap(box.x+box.width*fraction,box.y+box.height/2);await page.waitForFunction(b=>document.querySelector('#lab-fit-canvas').toDataURL()!==b,before);
 }
 await page.locator('#lab-fit-clear').tap();assert.equal(await page.locator('#lab-fit-result').isVisible(),false);assert.equal(await page.locator('#lab-fit-consent').isChecked(),false);assert.equal(await page.locator('#ai-result').isVisible(),true);
 assert.deepEqual(errors,[]);console.log(`Recovery ${lang}: currency exclusion → explicit test preferences → 3 cards; image 404 → visible errors → retry → visible 2D → local-result clear passed.`);await context.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
