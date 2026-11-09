'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.resolve(__dirname,'../assets/preview-experience.js'),'utf8');
function load(host){
 const window={},listeners=[];
 const context={window,location:{hostname:host},URL,console,
  document:{addEventListener:(...a)=>listeners.push(a)},
  fetch(){throw new Error('No network');},localStorage:new Proxy({},{get(){throw new Error('No storage');}})};
 window.A1I18n={register(){},t:x=>x,setText(){}};vm.runInNewContext(source,context);
 return {api:window.A1Preview,listeners};
}
test('experience exists only on exact standard Preview hosts, never Production, localhost, lookalikes or client flags',()=>{
 for(const host of ['a1fashion.pages.dev','localhost','evil.a1fashion.pages.dev.attacker.test','a.b.a1fashion.pages.dev'])assert.equal(load(host).api,undefined);
 for(const host of ['34004414.a1fashion.pages.dev','feature-preview.a1fashion.pages.dev','UPPER.A1FASHION.PAGES.DEV.'])assert.ok(load(host).api);
});
test('official search links contain only canonical categories, never free text, photos, ratios, budget or member information',()=>{
 const {api}=load('test.a1fashion.pages.dev');
 for(const country of ['KR','US','JP','GB','EU']){
  const result=api.retailers({country,category:'tops',query:'PRIVATE-PHOTO 1.428571 member@example.test',brand:'SECRET',budget:123456,metrics:{shoulderHipRatio:1.428571}});
  assert.ok(result.retailers.length>=2);
  for(const row of result.retailers){assert.equal(api.safeLink(row.searchUrl),true);assert.equal(api.safeLink(row.homeUrl),true);assert.doesNotMatch(row.searchUrl,/PRIVATE|1\.428|member|SECRET|123456|budget|metrics|photo/);}
 }
 for(const url of ['http://www.amazon.com/s?k=clothing','https://www.amazon.com.attacker.test/s?k=clothing','https://www.amazon.com/redirect?k=clothing','https://user:pass@www.amazon.com/s?k=clothing','https://www.amazon.com/s?k=shirt&redirect=https://evil.test'])assert.equal(api.safeLink(url),false);
 const kr=api.retailers({country:'KR',category:'tops'}).retailers;
 for(const row of kr){const url=new URL(row.searchUrl);assert.equal(url.searchParams.get(url.hostname.includes('coupang')?'q':'query'),'셔츠');assert.doesNotMatch(url.href,/%25/);}
 assert.equal(api.retailers({country:'KR'}).retailers[1].homeUrl,'https://shopping.naver.com/');
 assert.equal(api.safeLink('https://shopping.naver.com/redirect'),false);
 assert.throws(()=>api.retailers({country:'attacker'}));
});
test('local consultation uses ratios only with explicit consent and never invents commercial data',()=>{
 const {api}=load('test.a1fashion.pages.dev');
 const base={message:'office outfit',language:'en',intent:'style',preferences:{destination:'US'},consents:{analysis:false}};
 const unconsented=api.consult({...base,metrics:{shoulderHipRatio:1.4,legTorsoRatio:1.8}});
 assert.equal(unconsented.advice.length,1);
 const consented=api.consult({...base,consents:{analysis:true},metrics:{shoulderHipRatio:1.4,legTorsoRatio:1.8}});
 assert.equal(consented.advice.length,2);
 assert.throws(()=>api.consult({...base,consents:{analysis:true}}));
 assert.throws(()=>api.consult({...base,message:'data:image/png;base64,SECRET'}));
 for(const intent of ['style','compare','discount']){const r=api.consult({...base,intent});assert.equal(r.mode,'DEMO');assert.equal(r.products.length,0);assert.equal(r.discounts.length,0);assert.equal(r.comparison,null);assert.equal(r.usage,null);}
});
