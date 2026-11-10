'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.resolve(__dirname,'../assets/preview-experience.js'),'utf8');
function load(host,withQuery=false){
 const window={},listeners=[];
 const context={window,location:{hostname:host},URL,URLSearchParams,console,
  document:{addEventListener:(...a)=>listeners.push(a)},
  fetch(){throw new Error('No network');},localStorage:new Proxy({},{get(){throw new Error('No storage');}})};
 window.A1I18n={register(){},t:x=>x,setText(){}};
 if(withQuery){vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../assets/shopping-query.js'),'utf8'),context);window.A1ShoppingQuery=context.A1ShoppingQuery;}
 vm.runInNewContext(source,context);
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
 for(const row of kr){const url=new URL(row.searchUrl);const key=({'Musinsa':'keyword','29CM':'keyword','Coupang':'q','Naver Shopping':'query'})[row.name];assert.ok(key,'unexpected Korean retailer');assert.equal(url.searchParams.get(key),'셔츠');assert.doesNotMatch(url.href,/%25/);}
 assert.equal(kr.find(row=>row.name==='Naver Shopping').homeUrl,'https://shopping.naver.com/');
 assert.equal(new URL(kr.find(row=>row.name==='29CM').searchUrl).origin+new URL(kr.find(row=>row.name==='29CM').searchUrl).pathname,'https://www.29cm.co.kr/store/search');
 assert.equal(kr.find(row=>row.name==='29CM').homeUrl,'https://www.29cm.co.kr/');
 for(const url of ['https://www.29cm.co.kr/search?keyword=셔츠','https://www.29cm.co.kr/store/search?keyword=셔츠&redirect=https://evil.test','https://shop.29cm.co.kr/search?keyword=셔츠&url=https://evil.test','https://www.29cm.co.kr.attacker.test/store/search?keyword=셔츠'])assert.equal(api.safeLink(url),false);
 assert.equal(api.safeLink('https://shopping.naver.com/redirect'),false);
 assert.throws(()=>api.retailers({country:'attacker'}));
});
test('domestic free advice reuses canonical clothing conditions and all four official searches without body leakage',()=>{
 const {api}=load('test.a1fashion.pages.dev',true),base={message:'남성 검정 와이드 슬랙스 출근용 5만원 이하',language:'ko',intent:'style',preferences:{destination:'KR'},consents:{analysis:false}};
 const plain=api.consult({...base,metrics:{shoulderHipRatio:1.4,legTorsoRatio:1.8}});assert.equal(plain.clothingConditions.fit,'wide');assert.equal(plain.clothingConditions.purpose,'work');assert.equal(plain.clothingConditions.budget,50000);assert.equal(plain.searchLinks.length,4);assert.ok(plain.advice.some(row=>row.id==='fitRoomy'));assert.ok(!plain.advice.some(row=>row.id==='wide'));
 const consented=api.consult({...base,consents:{analysis:true},metrics:{shoulderHipRatio:1.4,legTorsoRatio:1.8}});assert.ok(consented.advice.some(row=>row.id==='wide'));assert.equal(JSON.stringify(consented.searchLinks),JSON.stringify(plain.searchLinks),'photo consent must not add body-derived terms to merchant URLs');
 for(const row of plain.searchLinks){assert.equal(api.safeLink(row.url),true);const u=new URL(row.url),term=[...u.searchParams.values()][0];assert.match(term,/남성/);assert.match(term,/검정/);assert.match(term,/와이드/);assert.match(term,/슬랙스/);assert.match(term,/출근/);assert.doesNotMatch(row.url,/50000|1\.4|1\.8|metrics|budget/);}
 assert.equal(plain.products.length,0);assert.equal(plain.discounts.length,0);assert.equal(plain.comparison,null);assert.equal(plain.mode,'DEMO');
 const guest=api.consult({...base,message:'여성 네이비 슬림 원피스 하객용',language:'en'});assert.ok(guest.advice.some(row=>row.id==='event'));assert.ok(guest.advice.some(row=>row.id==='fitSlim'));
 const sport=api.consult({...base,message:'운동용 검정 레귤러 바지'});assert.ok(sport.advice.some(row=>row.id==='sport'));assert.ok(sport.advice.some(row=>row.id==='fitClassic'));
});
test('unparseable private text falls back to category links and overseas directories retain their existing route',()=>{
 const {api}=load('test.a1fashion.pages.dev',true),base={message:'member@example.test SECRET 1.428571',language:'ko',intent:'style',preferences:{destination:'KR',category:'tops'},consents:{analysis:false}};
 const fallback=api.consult(base);assert.equal(fallback.clothingConditions,null);assert.equal(fallback.searchLinks.length,4);for(const row of fallback.searchLinks){assert.equal(api.safeLink(row.url),true);assert.doesNotMatch(row.url,/member|SECRET|1\.428|%40/);assert.equal([...new URL(row.url).searchParams.values()][0],'셔츠');}
 const overseas=api.consult({...base,message:'남성 검정 와이드 슬랙스 출근용',preferences:{destination:'US',category:'bottoms'}});assert.equal(overseas.clothingConditions,null);assert.equal(overseas.searchLinks.length,2);for(const row of overseas.searchLinks)assert.equal([...new URL(row.url).searchParams.values()][0],'trousers');
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
