'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const modulePromise=import('../server/price-comparison.mjs');
const demoPromise=import('../server/demo-offers.mjs');
const NOW=1793880000000;
const product={productId:'test-shirt',brand:'Test Brand',name:'Test Shirt',sku:'MAKER-SHIRT-1',gtin:null,color:'White',size:'M',condition:'new'};
const offer={...product,id:'offer-1',retailerId:'ebay-us',retailerName:'Fixture seller',sellerCountry:'US',price:40,currency:'USD',shipping:5,tax:3,duties:0,
 shippingCountries:['US','KR'],shippingStatus:'confirmed',stock:'in_stock',checkedAt:NOW-60000,source:'Fixture approved feed',sourceVerified:true,
 productUrl:'https://www.ebay.com/itm/fixture-only'};
const compare=async(offers,extra={})=>(await modulePromise).compareOffers({product,destination:'US',currency:'USD',offers,now:NOW,...extra});

test('only exact manufacturer identity and same color/size/condition enter comparison',async()=>{
 const result=await compare([offer,{...offer,id:'large',size:'L',price:1},{...offer,id:'used',condition:'used',price:1},{...offer,id:'brand',brand:'Other',price:1},{...offer,id:'sku',sku:'OTHER',price:1}]);
 assert.equal(result.results.length,1);assert.equal(result.similarOffers.length,4);
 assert.equal(result.minimumAmount,48);assert.equal(result.lowestOfferId,'offer-1');
 assert.equal(result.lowestStatus,'lowest-estimate-among-verified-comparable-sellers');
 const gtin=await compare([{...offer,gtin:'999'}],{product:{...product,gtin:'111'}});assert.equal(gtin.results.length,0);
});

test('unknown shipping/taxes/duties are null and never produce a false zero-cost winner',async()=>{
 for(const field of ['shipping','tax','duties']){
  const result=await compare([{...offer,[field]:null}]);
  assert.equal(result.results[0][field],null);assert.equal(result.results[0].estimatedTotal,null);
  assert.equal(result.lowestOfferId,null);assert.equal(result.minimumAmount,null);assert.equal(result.lowestStatus,'lowest-price-unavailable');
 }
 const result=await compare([offer,{...offer,id:'unknown-cheap',price:1,shipping:null}]);
 assert.equal(result.lowestOfferId,offer.id);assert.equal(result.hasUncertainOffers,true);assert.ok(result.warnings.includes('some-sellers-cannot-be-ranked'));
});

test('destination-specific unknown charges never fall back to generic zero fees',async()=>{
 for(const field of ['shipping','tax','duties']){
  const unknown=await compare([{...offer,[field]:0,[`${field}ByDestination`]:{US:null}}]);
  assert.equal(unknown.results[0][field],null,`${field}: explicit destination null must stay unknown`);
  assert.equal(unknown.results[0].estimatedTotal,null);assert.equal(unknown.lowestOfferId,null);
  const missing=await compare([{...offer,[field]:0,[`${field}ByDestination`]:{KR:null}}]);
  assert.equal(missing.results[0][field],0,'A missing destination override may use the known generic fee');
  assert.equal(missing.lowestOfferId,offer.id);
  const exactZero=await compare([{...offer,[field]:null,[`${field}ByDestination`]:{US:0}}]);
  assert.equal(exactZero.results[0][field],0,'An explicitly confirmed zero fee remains zero');
  assert.equal(exactZero.lowestOfferId,offer.id);
 }
});

test('stale prices, unknown stock, unsupported shipping and unverified sources never win',async()=>{
 for(const overrides of [{checkedAt:NOW-25*3600000},{checkedAt:NOW+1000},{expiresAt:NOW-1},{expiresAt:'invalid'}, {stock:'sold_out'},{stock:'out_of_stock'},{stock:'unknown'},
  {shippingCountries:['JP']},{shippingStatus:'unknown',shippingCountries:[]},{sourceVerified:false},{productUrl:'https://evil.example.test/product'}]){
  const result=await compare([{...offer,...overrides}]);assert.equal(result.lowestOfferId,null);assert.equal(result.results[0].eligible,false);
 }
});

test('FX requires verified source and timestamp; stale or demo rates cannot justify a live minimum',async()=>{
 const valid={base:'USD',rates:{EUR:0.9,KRW:1350,GBP:0.8,JPY:150},source:'Fixture approved FX feed',asOf:NOW-60000,verified:true};
 for(const [currency,expected]of [['USD',48],['EUR',43.2],['KRW',64800],['GBP',38.4],['JPY',7200]]){
  const result=await compare([offer],{currency,fx:valid});assert.equal(result.minimumAmount,expected);assert.equal(result.results[0].currency,currency);
 }
 for(const fx of [null,{...valid,asOf:NOW-25*3600000},{...valid,asOf:NOW+1},{...valid,source:''},{...valid,verified:false},{...valid,demo:true}]){
  assert.equal((await compare([offer],{currency:'EUR',fx})).lowestOfferId,null);
 }
});

test('promotions apply only in their valid period; expired promotion never supplies the price',async()=>{
 let result=await compare([{...offer,promotion:{price:20,startsAt:NOW-1000,endsAt:NOW+1000}}]);assert.equal(result.minimumAmount,28);assert.equal(result.results[0].promotionActive,true);
 assert.equal(result.results[0].basePrice,40);assert.deepEqual(result.results[0].promotion,{price:20,startsAt:NOW-1000,endsAt:NOW+1000});
 result=await compare([{...offer,promotion:{price:1,startsAt:NOW-2000,endsAt:NOW-1}}]);assert.equal(result.minimumAmount,48);assert.equal(result.results[0].promotionActive,false);assert.ok(result.results[0].warnings.includes('promotion-not-current'));
});

test('comparison exposes shipping destinations and credential-free source provenance',async()=>{
 const result=await compare([{...offer,source_url:'https://api.ebay.com/buy/browse/v1/item?credential=never-expose#part',shippingCountries:['US','KR','US',null,42,'invalid']}]);
 assert.deepEqual(result.results[0].shippingCountries,['US','KR']);
 assert.equal(result.results[0].sourceUrl,'https://api.ebay.com/buy/browse/v1/item');
 assert.equal((await compare([{...offer,sourceUrl:'javascript:alert(1)'}])).results[0].sourceUrl,null);
 const soldOut=await compare([{...offer,stock:'out_of_stock'}]);
 assert.equal(soldOut.results[0].stock,'sold_out');assert.ok(soldOut.results[0].warnings.includes('sold-out'));
});

test('DEMO comparison stays visibly fictional, suppresses purchase URLs, and is deterministic without mutating inputs',async()=>{
 const {demoComparison}=await demoPromise;
 for(const currency of ['KRW','USD','EUR','GBP','JPY']){
  const result=demoComparison({productId:'demo-tee',destination:'KR',currency,now:NOW});
  assert.equal(result.mode,'DEMO');assert.match(result.demoNotice,/fictional DEMO/);
  assert.equal(result.fx.demo,true);assert.ok(result.results.every(row=>row.demo&&row.productUrl===null));
  assert.ok(result.results.every(row=>row.retailerSearchUrl?.startsWith('https://')));
  assert.ok(result.similarOffers.some(row=>row.size==='L'));assert.ok(result.results.some(row=>row.warnings.includes('shipping-cost-unknown')));
  assert.ok(result.results.some(row=>row.warnings.includes('stale-or-unknown-price')));
 }
 const before=JSON.stringify(offer);await compare([offer]);assert.equal(JSON.stringify(offer),before);
 assert.throws(()=>demoComparison({productId:'invented'}),/unknown_demo_product/);
 await assert.rejects(compare([offer],{currency:'FAKE'}),/invalid_comparison/);
});

test('extreme FX arithmetic cannot publish an infinite or unrepresentable winning total',async()=>{
 const result=await compare([offer],{currency:'EUR',fx:{base:'KRW',rates:{USD:1e-300,EUR:1e12},source:'Fixture verified feed',asOf:NOW-1,verified:true}});
 assert.equal(result.lowestOfferId,null);assert.equal(result.results[0].estimatedTotal,null);
});
