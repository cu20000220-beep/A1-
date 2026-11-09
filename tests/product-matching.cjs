'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const M=require('../assets/product-matching.js'),now=Date.now();
const prefs={style:'classic',gender:'all',budget:100000,currency:'KRW',color:'navy',occasion:'work',size:'M',avoid:[],bodyConsent:false};
const product={id:'fixture-A',name:'Fixture only',brand:'TEST',fixture:true,currency:'KRW',price:59000,styles:['classic'],color:'navy',occasions:['work'],sizes:['M'],tags:['straight'],gender:'unisex',stock:'in_stock',checkedAt:now-1000,expiresAt:now+60000};
const rank=(rows,input=prefs)=>M.rank(rows,input,{now,mode:'fixture'});
test('scores expose deterministic reasons and warnings, not size or fit guarantees',()=>{
 const snapshot=JSON.stringify(product),r=rank([product]);assert.equal(r.matches[0].score,100);
 assert.ok(r.matches[0].reasons.includes('listed_size_match'));assert.ok(r.matches[0].warnings.includes('check_size_chart'));assert.ok(r.matches[0].warnings.includes('not_fit_probability'));
 assert.equal(r.matches[0].bodyReference,false);assert.equal(JSON.stringify(product),snapshot);
 const lower=rank([{...product,id:'lower',styles:['casual']},product]);assert.equal(lower.matches[0].product.id,product.id);
});
test('unknown size and design data remain warnings; photo ratios never infer a clothing size',()=>{
 const p={...product,sizes:[],tags:[]};const a=rank([p],{...prefs,avoid:['logos']});assert.ok(a.matches[0].warnings.includes('size_unknown'));assert.ok(a.matches[0].warnings.includes('design_unknown'));
 const body=rank([p],{...prefs,bodyConsent:true,metrics:{shoulderHipRatio:1.4,legTorsoRatio:1.8}});assert.ok(body.matches[0].warnings.includes('photo_ratios_not_measurements'));assert.deepEqual(body.matches[0].product.sizes,[]);
 assert.throws(()=>rank([p],{...prefs,bodyConsent:true}));
 const ignored=rank([p],{...prefs,metrics:{shoulderHipRatio:2,legTorsoRatio:2}});assert.equal(ignored.preferences.metrics,undefined);
});
test('budget, currency, known size, avoided design, stock, source and retention fail closed',()=>{
 for(const [change,reason]of [[{price:100001},'over_budget'],[{currency:'USD'},'currency_mismatch'],[{sizes:['S']},'size_unavailable'],[{tags:['logos']},'avoided_design'],[{stock:'unknown'},'stock_unconfirmed'],[{expiresAt:now},'expired_source'],[{checkedAt:now+1},'expired_source'],[{fixture:false},'unverified_source']]){
  const r=rank([{...product,...change}],{...prefs,avoid:['logos']});assert.equal(r.matches.length,0);assert.equal(r.excluded[0].reason,reason);
 }
 assert.equal(rank([null]).excluded[0].reason,'invalid_record');
 assert.equal(rank([{...product,checkedAt:0}]).excluded[0].reason,'expired_source');
 assert.equal(M.rank([product],prefs,{now,mode:'approved'}).matches.length,0);
 assert.throws(()=>rank([product],{...prefs,photo:'data:image/png;base64,PRIVATE'}));
});
test('server composition defaults off and never treats a client-style truthy string as approval',async()=>{
 const {rankApprovedCatalog}=await import('../server/product-matching.mjs');
 const db={prepare(){throw new Error('no DB read without approval');}};
 for(const allowLiveCatalog of [undefined,false,'true']){const r=await rankApprovedCatalog(db,prefs,{now,allowLiveCatalog});assert.equal(r.status,'disabled');assert.equal(r.matches.length,0);}
});
test('server composition reuses approved source validation and is read-only',async()=>{
 const {rankApprovedCatalog}=await import('../server/product-matching.mjs');
 const sql=new DatabaseSync(':memory:');sql.exec(fs.readFileSync(path.resolve(__dirname,'../server/schema.sql'),'utf8'));
 const insert=(table,row)=>{const keys=Object.keys(row);sql.prepare(`INSERT INTO ${table}(${keys}) VALUES(${keys.map(()=>'?')})`).run(...Object.values(row));};
 try{
  insert('retailers',{id:'ebay-us',name:'Authorized fixture seller',country:'US',integration_status:'configured',provider_kind:'official_api',source_url:'https://api.ebay.com/buy/browse/v1/item',terms_url:'https://developer.ebay.com/licence',image_rights_note:'Local fixture only; no real image',retention_seconds:86400,minimum_refresh_seconds:3600,updated_at:now-1000});
  const row={id:'offer-A',retailer_id:'ebay-us',product_id:'shirt-A',brand:'Fixture',product_name:'Fixture approved source record',sku:'FIXTURE-M',color:'Navy',size:'M',item_condition:'new',seller_country:'US',product_url:'https://www.ebay.com/itm/local-fixture',price_minor:5000,currency:'USD',shipping_countries_json:'["US","KR"]',stock_status:'in_stock',checked_at:now-1000,source_mode:'official',source_url:'https://api.ebay.com/buy/browse/v1/item',payload_json:JSON.stringify({gender:'unisex',category:'tops',style:'classic'})};
  insert('product_offers',row);insert('product_offers',{...row,id:'spoofed',source_mode:'DEMO'});
  const db={prepare(query){assert.match(query,/^SELECT/);const stmt=sql.prepare(query);return{bind(...args){return{all:async()=>({results:stmt.all(...args)})};}};}};
  const before=sql.prepare('SELECT COUNT(*) AS n FROM product_offers').get().n;
  const result=await rankApprovedCatalog(db,{...prefs,currency:'USD',budget:100},{now,destination:'US',allowLiveCatalog:true});
  assert.equal(result.matches.length,1);assert.equal(result.matches[0].product.id,'offer-A');assert.equal(result.matches[0].product.sourceVerified,true);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM product_offers').get().n,before);
 }finally{sql.close();}
});
