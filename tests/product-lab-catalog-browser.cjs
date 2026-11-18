'use strict';
// Reviewed records are synthetic and live only in intercepted test responses.
// The public catalog and real supplier approvals remain unchanged and empty.
const {chromium}=require('playwright');
const {PNG}=require('pngjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {compileCatalog}=require('../scripts/lib/product-catalog.cjs');
const {catalogPublicHeaders}=require('../scripts/lib/catalog-public-headers.cjs');
const root=path.resolve(__dirname,'..'),origin='https://lab-catalog.a1fashion.pages.dev',out=process.env.A1_LAB_CATALOG_EVIDENCE||'/workspace/work/product-lab-catalog';
fs.mkdirSync(out,{recursive:true});
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.glb':'model/gltf-binary','.wasm':'application/wasm'};
function fixture(now=Date.now()){
 const approval={id:'SYNTHETIC-ONLY-SOURCE',seller:'Synthetic reviewed source',domains:['www.musinsa.com'],imageDomains:['images.retailer.example'],rightsConfirmed:true,displayApproved:true,fittingUseApproved:true,commercialApproved:true,validUntil:new Date(now+3600000).toISOString(),evidenceRef:'PRIVATE AUTOMATED TEST ONLY — NO REAL MERCHANT APPROVAL',sourceUrl:'https://www.musinsa.com/synthetic-permission',retentionHours:1};
 const base={approvalId:approval.id,brand:'SYNTHETIC TEST ONLY',category:'tops',type:'tshirt',color:'black',styles:['minimal'],occasions:['casual'],gender:'unisex',currency:'KRW',sizes:['M'],sizeChart:{unit:'cm',kind:'garment',rows:[{size:'M',chest:100,length:67}]},imageUrl:'https://images.retailer.example/catalog.png',retailer:approval.seller,sourceUrl:approval.sourceUrl,permissionChecked:true,lastChecked:new Date(now-1000).toISOString(),stock:'in_stock',tags:['straight'],designTagsComplete:true};
 const products=[
  {...base,id:'SYNTHETIC-FIT',name:'SYNTHETIC FIT GARMENT — NOT REAL',price:39000,purchaseUrl:'https://www.musinsa.com/products/SYNTHETIC-FIT',fittingImageUrl:'https://images.retailer.example/fitting.png'},
  {...base,id:'SYNTHETIC-DISPLAY',name:'SYNTHETIC DISPLAY ONLY — NOT REAL',price:42000,purchaseUrl:'https://www.musinsa.com/products/SYNTHETIC-DISPLAY',tags:['logos']},
  {...base,id:'SYNTHETIC-AD',name:'SYNTHETIC AD — NOT REAL',price:41000,purchaseUrl:'https://www.musinsa.com/products/SYNTHETIC-AD',commercial:{sponsored:true,affiliate:false,label:'SYNTHETIC TEST ADVERTISEMENT'}},
  {...base,id:'SYNTHETIC-SOLD',name:'SYNTHETIC SOLD OUT — NOT REAL',price:38000,purchaseUrl:'https://www.musinsa.com/products/SYNTHETIC-SOLD',stock:'out_of_stock'}
 ];
 return compileCatalog({version:1,products},{version:1,sources:[approval]},{now,inspect:true}).snapshot;
}
function mockPose(){
 const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);window.__labCatalogUrls=new Set();window.__bodySelections=0;
 URL.createObjectURL=blob=>{const url=create(blob);__labCatalogUrls.add(url);return url;};URL.revokeObjectURL=url=>{__labCatalogUrls.delete(url);revoke(url);};
 document.addEventListener('change',event=>{if(event.target.id==='ai-photo')__bodySelections++;});
 window.Pose=class{setOptions(){}onResults(fn){this.result=fn;}async initialize(){}async reset(){}async close(){}async send(){const points=Array.from({length:33},()=>({x:.5,y:.5,visibility:.99}));for(const[index,[x,y]]of Object.entries({11:[.3,.2],12:[.7,.2],23:[.36,.45],24:[.64,.45],25:[.36,.65],26:[.64,.65],27:[.36,.9],28:[.64,.9]}))points[index]={x,y,visibility:.99};this.result({poseLandmarks:points});}};
}
function garmentPixels(){const png=new PNG({width:64,height:80});for(let y=0;y<80;y++)for(let x=0;x<64;x++){if(y>10&&y<65&&x>18&&x<46||y>10&&y<28&&x>6&&x<58){const i=(y*64+x)*4;png.data[i]=180;png.data[i+1]=32;png.data[i+2]=38;png.data[i+3]=255;}}return PNG.sync.write(png);}
async function prepare(browser,{entry='/',width=820,lang='ko',mode='ready',delayProduct=false}={}){
 const snapshot=fixture(),context=await browser.newContext({viewport:{width,height:1180},hasTouch:true,isMobile:true,locale:lang==='ko'?'ko-KR':'en-US'}),calls=[],errors=[],violations=[];
 let sourceMode=mode,catalogReads=0,release,seen;const gate=new Promise(resolve=>{release=resolve;}),started=new Promise(resolve=>{seen=resolve;});
 const headers=catalogPublicHeaders(fs.readFileSync(path.join(root,'_headers'),'utf8'),snapshot.products);
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());assert.equal(req.method(),'GET');assert.ok(!url.pathname.startsWith('/api/'));calls.push(url.href);
  if(url.pathname==='/assets/product-images.json'){await route.fulfill({contentType:'application/json',body:JSON.stringify({version:1,authorization:JSON.parse(fs.readFileSync(path.join(root,'assets/product-images.json'),'utf8')).authorization,products:[]})});return;}
  if(url.origin!==origin){assert.equal(url.origin,'https://images.retailer.example');assert.equal(req.isNavigationRequest(),false);assert.equal(url.search,'');assert.ok(['/catalog.png','/fitting.png'].includes(url.pathname));await route.fulfill({body:garmentPixels(),contentType:'image/png',headers:{'Access-Control-Allow-Origin':origin}});return;}
  for(const[key,value]of url.searchParams){assert.equal(key,'v');assert.match(value,/^[a-z0-9-]+$/);}
  if(url.pathname==='/assets/approved-products.json'){
   catalogReads++;
   if(delayProduct&&catalogReads===2){seen();await gate;}
   if(sourceMode==='error'){await route.fulfill({status:503,contentType:'application/json',body:'{}'});return;}
   const body=sourceMode==='empty'?{version:1,generatedAt:null,products:[]}:snapshot;
   await route.fulfill({contentType:'application/json',body:JSON.stringify(body)}).catch(()=>{});return;
  }
  if(url.pathname.endsWith('.html')){await route.fulfill({status:308,headers:{Location:url.pathname.slice(0,-5)},body:''});return;}
  const relative=url.pathname==='/'?'index.html':['/product-lab','/fitting-studio','/gltf-proof'].includes(url.pathname)?url.pathname.slice(1)+'.html':url.pathname.slice(1),file=path.resolve(root,relative);assert.ok(file.startsWith(root+path.sep));
  const section=['/product-lab','/fitting-studio','/gltf-proof'].includes(url.pathname)?url.pathname+'*':null;
  const csp=section?headers.split(section+'\n')[1].split('\n\n')[0].match(/Content-Security-Policy: (.*)/)?.[1]:null;
  await route.fulfill({body:fs.readFileSync(file),contentType:mime[path.extname(file)]||'application/octet-stream',...(csp?{headers:{'Content-Security-Policy':csp}}:{})});
 });
 await context.addInitScript(mockPose);const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 await page.exposeFunction('labCatalogCsp',value=>violations.push(value));await page.addInitScript(()=>document.addEventListener('securitypolicyviolation',event=>window.labCatalogCsp(event.effectiveDirective)));
 await page.goto(origin+entry,{waitUntil:'networkidle'});
 if(entry==='/fitting-studio'){await page.locator('#studio-open-analysis').click();await page.waitForSelector('#ai-photo');}
 await page.evaluate(language=>window.A1I18n.setLanguage(language),lang);
 return{context,page,calls,errors,violations,snapshot,release,started,setMode(value){sourceMode=value;},reads(){return catalogReads;}};
}
async function analyze(page){await page.locator('#ai-photo').setInputFiles(path.join(root,'assets/photos/man.jpg'));await page.locator('#ai-analyze').click();await page.waitForFunction(()=>!document.querySelector('#ai-result').hidden);await page.locator('#lab-open-recommend').click();await page.waitForSelector('#lab-catalog');}
const card=(page,id)=>page.locator('[data-lab-catalog-product="'+id+'"]');
(async()=>{
 const publicBefore=fs.readFileSync(path.join(root,'assets/approved-products.json')),approvalBefore=fs.readFileSync(path.join(root,'catalog/source-approvals.json'));
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),report={scope:'Synthetic approved-feed responses plus the separately labelled published official-page observations. Pose is mocked. Not native iPad Safari.',cases:[]};
 try{
  for(const profile of[{entry:'/',width:820,lang:'ko'},{entry:'/product-lab',width:1180,lang:'ko'},{entry:'/fitting-studio',width:390,lang:'en'}]){
   const trial=await prepare(browser,profile),{page}=trial;await analyze(page);await card(page,'SYNTHETIC-FIT').waitFor();
   assert.equal(await page.locator('#lab-products .lab-approved-card').count(),2);assert.equal(await page.locator('#lab-sponsored .lab-approved-card').count(),1);assert.equal(await page.locator('#lab-unavailable-products .lab-approved-card').count(),1);assert.equal(await page.locator('.lab-card').count(),0);
   assert.match(await card(page,'SYNTHETIC-FIT').innerText(),/39,000 KRW/);assert.match(await card(page,'SYNTHETIC-FIT').innerText(),/SYNTHETIC TEST ONLY/);assert.match(await card(page,'SYNTHETIC-FIT').innerText(),/사이즈|sizes/i);
   assert.equal(await card(page,'SYNTHETIC-DISPLAY').locator('[data-lab-catalog-fit]').count(),0);assert.equal(await card(page,'SYNTHETIC-SOLD').locator('[data-lab-catalog-buy],[data-lab-catalog-fit]').count(),0);
   await page.locator('[data-lab-catalog-compare="SYNTHETIC-FIT"]').click();await page.locator('[data-lab-catalog-compare="SYNTHETIC-DISPLAY"]').click();assert.equal(await page.locator('#lab-comparison tr').count(),3);
   await page.locator('#lab-preferences [name=avoid][value=logos]').check();await page.locator('#lab-preferences button[type=submit]').click();assert.equal(await page.locator('#lab-products [data-lab-catalog-product="SYNTHETIC-DISPLAY"]').count(),0,'existing excluded-design rule survives catalog search');
   assert.equal(await page.locator('#lab-body-consent').isChecked(),false);await page.locator('#lab-body-consent').check();assert.match(await card(page,'SYNTHETIC-FIT').innerText(),/동의한 사진|Consented photo/i);await page.locator('#lab-body-consent').uncheck();assert.doesNotMatch(await card(page,'SYNTHETIC-FIT').innerText(),/동의한 사진상 비율의 참고 규칙 일치|Consented photo-ratio reference rule matches/i);
   const clean=await page.locator('#ai-clean-canvas').evaluate(canvas=>canvas.toDataURL());
   await page.locator('[data-lab-catalog-fit="SYNTHETIC-FIT"]').click();await page.waitForSelector('#lab-selected-catalog:not([hidden])');await page.waitForFunction(()=>!document.querySelector('#lab-garment-photo-figure').hidden);
   assert.equal(await page.evaluate(()=>__bodySelections),1);assert.equal(await page.locator('#ai-clean-canvas').evaluate(canvas=>canvas.toDataURL()),clean);assert.equal(await page.locator('#lab-garment-photo').inputValue(),'');assert.equal(await page.locator('#lab-local-photo-consent').isChecked(),false);
   await page.locator('#lab-local-photo-fit').click();assert.equal(await page.locator('#lab-local-photo-result').isVisible(),false);await page.locator('#lab-local-photo-consent').check();await page.locator('#lab-local-photo-fit').click();await page.waitForSelector('#lab-local-photo-result:visible');
   const changed=await page.evaluate(()=>{const a=document.querySelector('#ai-clean-canvas'),b=document.querySelector('#lab-local-photo-canvas'),x=a.getContext('2d').getImageData(0,0,a.width,a.height-50).data,y=b.getContext('2d').getImageData(0,0,b.width,b.height-50).data;let count=0;for(let i=0;i<x.length;i+=4)if(Math.abs(x[i]-y[i])+Math.abs(x[i+1]-y[i+1])+Math.abs(x[i+2]-y[i+2])>40)count++;return count;});assert.ok(changed>1000,'selected approved-image pixels actually overlay the existing body photo');
   await page.locator('#lab-local-photo-canvas').screenshot({path:path.join(out,(profile.entry==='/'?'index':profile.entry.slice(1))+'-'+profile.lang+'-selected-image.png')});
   await page.locator('#lab-local-photo-before').check();const before=await page.locator('#lab-local-photo-canvas').evaluate(canvas=>canvas.toDataURL());await page.locator('#lab-local-photo-before').uncheck();assert.notEqual(await page.locator('#lab-local-photo-canvas').evaluate(canvas=>canvas.toDataURL()),before);
   const callsBeforeForbidden=trial.calls.filter(url=>url.includes('/fitting.png')).length;await page.evaluate(()=>window.A1CatalogFitting.open('SYNTHETIC-DISPLAY'));await page.waitForFunction(()=>document.querySelector('#catalog-fitting-status')?.textContent.includes('권한')||document.querySelector('#catalog-fitting-status')?.textContent.includes('permission'));assert.equal(trial.calls.filter(url=>url.includes('/fitting.png')).length,callsBeforeForbidden);
   await page.locator('#ai-clear').click();assert.equal(await page.locator('#ai-clean-canvas').evaluate(canvas=>canvas.width*canvas.height),1);assert.equal(await page.locator('#lab-local-photo-canvas').evaluate(canvas=>canvas.width*canvas.height),1);assert.equal(await page.locator('#lab-local-photo-consent').isChecked(),false);assert.equal(await page.locator('#lab-products .lab-approved-card').count(),0);assert.equal(await page.evaluate(()=>__labCatalogUrls.size),0);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(trial.errors,[]);assert.deepEqual(trial.violations,[]);for(const url of trial.calls)assert.doesNotMatch(url,/shoulderHipRatio|legTorsoRatio|metrics|bodyPhoto|memberEmail/);
   report.cases.push({profile,passed:true,organic:2,sponsored:1,unavailable:1,syntheticOnly:true,selectedImagePixelChanges:changed,bodyPhotoReselected:false});await trial.context.close();console.log(profile.entry+' '+profile.lang+' '+profile.width+': approved catalog → actual cards/reasons/compare → same-photo selected-image 2D → rights/delete passed (synthetic responses only).');
  }
  for(const mode of['empty','error']){
   const trial=await prepare(browser,{mode}),{page}=trial;await analyze(page);await page.waitForFunction(()=>!document.querySelector('#lab-catalog-state').textContent.includes('확인하고'));
   assert.equal(await page.locator('#lab-products .lab-approved-card').count(),0);assert.match(await page.locator('#lab-catalog-state').innerText(),mode==='empty'?/승인된 상품 피드 0개/:/확인하지 못/);
   if(mode==='error'){const reads=trial.reads();await page.waitForTimeout(200);assert.equal(trial.reads(),reads,'failed catalog does not auto-retry');trial.setMode('ready');await page.locator('#lab-catalog-retry').click();await card(page,'SYNTHETIC-FIT').waitFor();}
   assert.deepEqual(trial.errors,[]);assert.deepEqual(trial.violations,[]);report.cases.push({mode,passed:true});await trial.context.close();
  }
  {
   const trial=await prepare(browser),{page}=trial;await analyze(page);await card(page,'SYNTHETIC-FIT').waitFor();
   await page.locator('#lab-preferences [name=budget]').fill('1');await page.locator('#lab-preferences button[type=submit]').click();assert.equal(await page.locator('#lab-products .lab-approved-card').count(),0);assert.match(await page.locator('#lab-products').innerText(),/조건에 맞는/);
   await page.locator('#lab-preferences [name=budget]').fill('100000');await page.locator('#lab-preferences button[type=submit]').click();await card(page,'SYNTHETIC-FIT').waitFor();
   const count=trial.calls.filter(url=>url.includes('/fitting.png')).length;await page.evaluate(()=>{const now=Date.now;Date.now=()=>now()+7200000;});await page.locator('[data-lab-catalog-fit="SYNTHETIC-FIT"]').click();assert.equal(trial.calls.filter(url=>url.includes('/fitting.png')).length,count);assert.equal(await page.locator('#lab-products .lab-approved-card').count(),0);assert.match(await page.locator('#lab-catalog-state').innerText(),/만료/);
   report.cases.push({name:'filtered-and-expired-selection',passed:true});await trial.context.close();
  }
  {
   const trial=await prepare(browser,{delayProduct:true}),{page}=trial;await analyze(page);await trial.started;await page.locator('#ai-clear').click();trial.release();await page.waitForTimeout(300);
   assert.equal(await page.locator('#lab-products .lab-approved-card').count(),0);assert.match(await page.locator('#lab-catalog-state').innerText(),/삭제된 추천/);assert.deepEqual(trial.errors,[]);report.cases.push({name:'delete-during-catalog-read',passed:true});await trial.context.close();
  }
  {
   const trial=await prepare(browser,{entry:'/fitting-studio',width:820,mode:'empty'}),{page}=trial;await analyze(page);
   await page.waitForFunction(()=>document.querySelector('#lab-observed-products')?.dataset.state==='ready');
   assert.equal(await page.locator('#lab-observed-products').getAttribute('data-snapshot-count'),'10');
   assert.equal(await page.locator('#lab-observed-products img').count(),0,'public facts never imply product-photo rights');
   assert.equal(await page.locator('#lab-body-reference-ideas').isVisible(),false);
   await page.locator('#lab-body-consent').check();await page.locator('[data-lab-body-idea="trousers"]').click();
   await page.waitForFunction(()=>document.querySelector('#lab-observed-products')?.dataset.state==='ready');
   assert.equal(await page.locator('#lab-observed-products [data-discovery-id="musinsa-4644434"]').count(),1,'the consented existing relaxed-trouser rule reaches an actual observed matching item');
   await page.locator('#lab-observed-products').screenshot({path:path.join(out,'published-lab-reference.png')});
   await page.locator('#lab-body-consent').uncheck();assert.equal(await page.locator('#lab-body-reference-ideas').isVisible(),false);
   await page.locator('#ai-clear').click();assert.equal(await page.locator('#lab-observed-products').isVisible(),false);assert.deepEqual(trial.errors,[]);assert.deepEqual(trial.violations,[]);
   report.cases.push({name:'published-facts-and-explicit-body-reference-filter',source:'actual-public-observations',products:10,images:0,inferenceMocked:true,passed:true});await trial.context.close();
  }
  assert.deepEqual(fs.readFileSync(path.join(root,'assets/approved-products.json')),publicBefore);assert.deepEqual(fs.readFileSync(path.join(root,'catalog/source-approvals.json')),approvalBefore);assert.equal(JSON.parse(publicBefore).products.length,0);report.passed=true;
 }finally{
  report.sourceHashes=Object.fromEntries(['assets/product-lab.js','assets/product-lab.css','assets/product-catalog.js','assets/catalog-fitting.js','assets/fitting-studio-photo.js','scripts/lib/catalog-public-headers.cjs'].map(file=>[file,sha(fs.readFileSync(path.join(root,file)))]));
  fs.writeFileSync(path.join(out,'browser-result.json'),JSON.stringify(report,null,2));await browser.close();
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
