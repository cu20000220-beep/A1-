'use strict';
// Real local SQLite; no supplier calls, accounts, migration or live feeds.
const test = require('node:test'), assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { readFileSync } = require('node:fs');
const modules = Promise.all([import('../server/catalog-repository.mjs'), import('../server/global-comparison.mjs')]);
const NOW = Date.UTC(2026,10,6,12), HOUR = 3600000;
function fixture() {
  const sql = new DatabaseSync(':memory:'); sql.exec(readFileSync(new URL('../server/schema.sql', `file://${__filename}`),'utf8'));
  let reads = 0;
  const db = { prepare(query) {
    assert.match(query,/^SELECT\b/,'The catalog is a read-only repository'); reads++;
    const statement = sql.prepare(query); return { bind(...values) { return {
      first: async()=>statement.get(...values)||null, all: async()=>({results:statement.all(...values)})
    }; } };
  } };
  function insert(table, values) {
    const names=Object.keys(values); sql.prepare(`INSERT OR REPLACE INTO ${table}(${names.join(',')}) VALUES(${names.map(()=>'?').join(',')})`).run(...names.map(name=>values[name]));
  }
  function retailer(id='ebay-us', changes={}) {
    const country=id.endsWith('-gb')?'GB':id.endsWith('-de')?'EU':'US';
    insert('retailers',{id,name:'Fixture official seller',country,integration_status:'configured',provider_kind:'official_api',
      source_url:'https://api.ebay.com/buy/browse/v1/item',terms_url:'https://developer.ebay.com/licence',image_rights_note:'Fixture reviewed rights; no image reused',
      retention_seconds:86400,minimum_refresh_seconds:3600,updated_at:NOW-HOUR,...changes});
  }
  function offer(changes={}) {
    insert('product_offers',{id:'offer-us',retailer_id:'ebay-us',product_id:'shirt-001',brand:'Fixture Brand',product_name:'Verified White Shirt',
      sku:'MAKER-SHIRT-001',gtin:null,color:'White',size:'M',item_condition:'new',seller_country:'US',product_url:'https://www.ebay.com/itm/local-fixture',
      price_minor:5000,currency:'USD',shipping_minor:500,tax_minor:200,duty_minor:0,shipping_countries_json:JSON.stringify(['US','KR','GB','DE','FR','JP']),
      stock_status:'in_stock',promotion_price_minor:null,promotion_starts_at:null,promotion_ends_at:null,checked_at:NOW-60000,expires_at:null,
      source_mode:'official',source_url:'https://api.ebay.com/buy/browse/v1/item?token=must-not-leak',
      payload_json:JSON.stringify({gender:'unisex',category:'tops',style:'classic',costsApplyToAllDestinations:true,image:'must-not-be-returned',privatePhoto:'never-share'}),...changes});
  }
  const load=async(extra={})=>(await modules)[0].loadVerifiedCatalog(db,{destination:'US',currency:'USD',now:NOW,allowLiveCatalog:true,...extra});
  const compare=async(extra={})=>(await modules)[1].compareStoredProduct(db,{productId:'offer-us',destination:'US',currency:'USD',now:NOW,allowLiveCatalog:true,...extra});
  return {sql,db,retailer,offer,load,compare,get reads(){return reads;},close(){sql.close();}};
}

test('stored catalog and comparison default off without querying a database or manufacturing DEMO products', async()=>{
  const [catalog,comparison]=await modules;
  const db={prepare(){throw new Error('must not read');}};
  const rows=await catalog.loadVerifiedCatalog(db);
  assert.equal(rows.status,'disabled'); assert.deepEqual(rows.products,[]); assert.equal(rows.mode,'verified-offers');
  const result=await comparison.compareStoredProduct(db,{productId:'offer-us',now:NOW});
  assert.equal(result.status,'disabled');assert.equal(result.demo,false);assert.equal(result.lowestStatus,'lowest-price-unavailable');assert.deepEqual(result.results,[]);assert.equal(result.product,null);
  assert.equal((await catalog.loadVerifiedCatalog(null,{allowLiveCatalog:true,now:NOW})).status,'unavailable');
});

test('five-currency amounts preserve their source units, verified promotion and nullable destination charges',async()=>{
  const [catalog]=await modules;
  for(const [currency,minor,major] of [['USD',1234,12.34],['EUR',1234,12.34],['GBP',1234,12.34],['KRW',1234,1234],['JPY',6500,6500]]){
    const f=fixture();try{f.retailer();f.offer({currency,price_minor:minor,shipping_minor:null,tax_minor:null,duty_minor:null});
      const result=await f.load({currency});assert.equal(result.status,'ready');const row=result.products[0];
      assert.equal(row.price,major);assert.equal(row.currency,currency);assert.equal(row.basePrice,major);assert.equal(row.shipping,null);assert.equal(row.tax,null);assert.equal(row.duties,null);
      assert.equal(row.shippingAvailable,true);assert.equal(row.sourceVerified,true);assert.equal(row.demo,false);
      assert.doesNotMatch(JSON.stringify(row),/must-not-leak|must-not-be-returned|never-share|payload_json/);
      assert.equal(row.sourceUrl,'https://api.ebay.com/buy/browse/v1/item');
    }finally{f.close();}
  }
  assert.throws(()=>catalog.minorToMajor(1.5,'USD'));assert.throws(()=>catalog.minorToMajor(100,'UNKNOWN'));
});

test('country, collection, brand, category, style, price, size and query filters constrain actual stored products',async()=>{
  const f=fixture();try{
    f.retailer();f.retailer('ebay-gb');f.offer();f.offer({id:'large',size:'L',price_minor:1000});
    f.offer({id:'gb',retailer_id:'ebay-gb',seller_country:'GB',product_url:'https://www.ebay.co.uk/itm/local-fixture',payload_json:JSON.stringify({gender:'women',category:'dresses',style:'casual'})});
    const exact=await f.load({country:'US',gender:'men',brand:'fixture',category:'tops',style:'classic',size:'m',query:'WHITE SHIRT',minPrice:'45',maxPrice:'55'});
    assert.deepEqual(exact.products.map(row=>row.id),['offer-us']);
    assert.equal((await f.load({country:'GB',category:'dresses',gender:'women'})).products[0].id,'gb');
    for(const filters of [{country:'JP'},{gender:'unisex',category:'dresses'},{brand:'missing'},{category:'outerwear'},{style:'streetwear'},{size:'XS'},{query:'unrelated hoodie'},{minPrice:51},{maxPrice:0}])assert.equal((await f.load(filters)).products.length,0);
    await assert.rejects(f.load({minPrice:'not money'}),/invalid_catalog_filters/);
    await assert.rejects(f.load({minPrice:100,maxPrice:20}),/invalid_catalog_filters/);
    await assert.rejects(f.load({includeAllCurrencies:true,maxPrice:20}),/invalid_catalog_filters/);
    await assert.rejects(f.load({offerId:'../not-an-id'}),/invalid_catalog_filters/);
  }finally{f.close();}
});

test('configured official provenance, reviewed terms, known merchant URLs and valid retention are required',async()=>{
  for(const change of [{integration_status:'search_only'},{provider_kind:'search'},{terms_url:null},{image_rights_note:null},{retention_seconds:null},{retention_seconds:0},{minimum_refresh_seconds:90000},{updated_at:NOW+1},{country:'GB'}]){
    const f=fixture();try{f.retailer('ebay-us',change);f.offer();assert.equal((await f.load()).products.length,0);}finally{f.close();}
  }
  for(const change of [{source_mode:'DEMO'},{source_url:'https://different-provider.org/items'},{product_url:'https://evil.org/items'},{product_url:'https://www.ebay.com/itm/local?api_key=secret'},{payload_json:'{}'},{gtin:'not-gtin',sku:null}]){
    const f=fixture();try{f.retailer();f.offer(change);assert.equal((await f.load()).products.length,0);}finally{f.close();}
  }
});

test('stale, expired, future, sold-out and unconfirmed-destination rows cannot enter browsing or comparison',async()=>{
  for(const change of [{checked_at:NOW-25*HOUR},{checked_at:NOW+1},{expires_at:NOW},{stock_status:'unknown'},{stock_status:'out_of_stock'},
    {shipping_countries_json:'["JP"]'}]){
    const f=fixture();try{f.retailer();f.offer(change);assert.equal((await f.load()).products.length,0);assert.equal((await f.compare()).lowestOfferId,null);}finally{f.close();}
  }
  const f=fixture();try{f.retailer('ebay-us',{retention_seconds:30,minimum_refresh_seconds:0});f.offer();assert.equal((await f.load()).products.length,0);}finally{f.close();}
});

test('comparison reuses only exact variants and base/promotion prices, with no guessed exchange rate',async()=>{
  const f=fixture();try{
    f.retailer();f.retailer('ebay-gb');f.offer({promotion_price_minor:4000,promotion_starts_at:NOW-HOUR,promotion_ends_at:NOW+HOUR});
    f.offer({id:'same-cheaper',price_minor:4200,shipping_minor:0,tax_minor:0});
    f.offer({id:'large-cheap',size:'L',price_minor:100});
    f.offer({id:'used-cheap',item_condition:'used',price_minor:100});
    f.offer({id:'case-sku',sku:'maker-shirt-001',price_minor:100});
    f.offer({id:'foreign-cheap',retailer_id:'ebay-gb',currency:'GBP',seller_country:'GB',price_minor:100,shipping_minor:0,tax_minor:0,product_url:'https://www.ebay.co.uk/itm/local-fixture'});
    const result=await f.compare();assert.equal(result.mode,'verified-offers');assert.equal(result.demo,false);assert.equal(result.status,'ready');
    const promoted=result.results.find(row=>row.id==='offer-us');assert.equal(promoted.basePrice,50);assert.equal(promoted.price,40);assert.equal(promoted.estimatedTotal,47);assert.equal(promoted.promotionActive,true);
    assert.equal(result.lowestOfferId,'same-cheaper');assert.equal(result.minimumAmount,42);assert.equal(result.fx,null);assert.equal(result.noCurrencyConversion,true);
    const foreign=result.results.find(row=>row.id==='foreign-cheap');assert.equal(foreign.price,1);assert.equal(foreign.estimatedTotal,null);assert.ok(foreign.warnings.includes('fx-unavailable-or-stale'));
    for(const name of ['large-cheap','used-cheap','case-sku'])assert.ok(result.similarOffers.some(row=>row.id===name));
    const gb=await f.compare({productId:'foreign-cheap',currency:'GBP'});assert.equal(gb.lowestOfferId,'foreign-cheap');assert.equal(gb.minimumAmount,1);
  }finally{f.close();}
});

test('unknown charges never become zero-cost winners and expired promotions use the original verified price',async()=>{
  for(const column of ['shipping_minor','tax_minor','duty_minor']){
    const f=fixture();try{f.retailer();f.offer({[column]:null});const result=await f.compare();assert.equal(result.lowestOfferId,null);assert.equal(result.results[0].estimatedTotal,null);}finally{f.close();}
  }
  const f=fixture();try{f.retailer();f.offer({promotion_price_minor:1,promotion_starts_at:NOW-HOUR,promotion_ends_at:NOW-1});
    const result=await f.compare();assert.equal(result.results[0].price,50);assert.equal(result.results[0].basePrice,50);assert.equal(result.results[0].promotion,null);
  }finally{f.close();}
});

test('ambiguous physical products require an exact offer and expired offer IDs never resolve to a different product',async()=>{
  const f=fixture();try{f.retailer();f.offer();f.offer({id:'large',size:'L'});
    const ambiguous=await f.compare({productId:'shirt-001'});assert.equal(ambiguous.status,'empty');assert.equal(ambiguous.reason,'select_exact_variant');assert.equal(ambiguous.lowestOfferId,null);
    assert.equal((await f.compare({productId:'does-not-exist'})).status,'empty');
    f.offer({id:'expired-id',expires_at:NOW-1});f.offer({id:'different-item',product_id:'expired-id',sku:'OTHER'});
    assert.equal((await f.compare({productId:'expired-id'})).products,undefined);assert.deepEqual((await f.compare({productId:'expired-id'})).results,[]);
    f.sql.prepare('DELETE FROM product_offers WHERE id=?').run('large');
    assert.equal((await f.compare({productId:'shirt-001'})).status,'ready');
  }finally{f.close();}
});

test('missing reviewed tables are unavailable while other storage errors fail closed',async()=>{
  const [catalog,comparison]=await modules;const sql=new DatabaseSync(':memory:');
  const db={prepare(query){return{bind(){return{all:async()=>({results:sql.prepare(query).all()}),first:async()=>sql.prepare(query).get()}}}}};
  try{assert.equal((await catalog.loadVerifiedCatalog(db,{allowLiveCatalog:true,now:NOW})).status,'unavailable');
    assert.equal((await comparison.compareStoredProduct(db,{productId:'unknown',allowLiveCatalog:true,now:NOW})).status,'unavailable');
    for(const action of [()=>catalog.loadVerifiedCatalog({prepare(){throw new Error('private database failure');}},{allowLiveCatalog:true,now:NOW}),
      ()=>comparison.compareStoredProduct({prepare(){throw new Error('private database failure');}},{productId:'unknown',allowLiveCatalog:true,now:NOW})])await assert.rejects(action(),catalog.CatalogReadError);
  }finally{sql.close();}
});

test('trusted current-time checks reject expiry during SQL waits and do not publish an elapsed promotional price',async()=>{
  const f=fixture();try{
    f.retailer();f.offer({expires_at:NOW+1000});
    assert.equal((await f.load({clock:()=>NOW+1001})).products.length,0);
    assert.equal((await f.compare({clock:()=>NOW+1001})).lowestOfferId,null);
    f.offer({promotion_price_minor:1000,promotion_starts_at:NOW-HOUR,promotion_ends_at:NOW+1000});
    const result=await f.compare({clock:()=>NOW+1001});
    assert.equal(result.product.price,50);assert.equal(result.product.promotion,null);assert.equal(result.minimumAmount,57);
    assert.ok(Number.isSafeInteger(result.results[0].expiresAt));
    await assert.rejects(f.load({clock:()=>NOW-1}),/invalid_catalog_clock/);
  }finally{f.close();}
});

test('generic fees need explicit destination proof even when the seller is domestic or lists that shipping country',async()=>{
  const f=fixture();f.retailer();const garment={gender:'unisex',category:'tops',style:'classic'};
  try{
    for(const context of [{},{costDestination:'KR'},{costsApplyToAllDestinations:'true'}]){
      f.offer({shipping_minor:0,tax_minor:0,duty_minor:0,payload_json:JSON.stringify({...garment,...context})});
      const row=(await f.load()).products[0];
      assert.equal(row.sellerCountry,'US');assert.equal(row.shippingAvailable,true);
      assert.deepEqual([row.shipping,row.tax,row.duties],[null,null,null]);
      const compared=await f.compare();assert.equal(compared.lowestOfferId,null);assert.equal(compared.results[0].estimatedTotal,null);
    }
    for(const context of [{costDestination:'US'},{costsApplyToAllDestinations:true}]){
      f.offer({payload_json:JSON.stringify({...garment,...context})});
      assert.deepEqual(((await f.load()).products.map(row=>[row.shipping,row.tax,row.duties])),[[5,2,0]]);
      assert.equal((await f.compare()).minimumAmount,57);
    }
  }finally{f.close();}
});

test('destination minor-unit overrides preserve explicit unknowns and missing fields never imply free costs',async()=>{
  const f=fixture();f.retailer();const garment={gender:'unisex',category:'tops',style:'classic'};
  try{
    f.offer({shipping_minor:0,tax_minor:0,duty_minor:0,payload_json:JSON.stringify({...garment,costDestination:'US',costsByDestinationMinor:{US:{shipping:null,tax:350}}})});
    let row=(await f.load()).products[0];assert.deepEqual([row.shipping,row.tax,row.duties],[null,3.5,0]);assert.equal((await f.compare()).lowestOfferId,null);
    f.offer({shipping_minor:0,tax_minor:0,duty_minor:0,payload_json:JSON.stringify({...garment,costsByDestinationMinor:{US:{shipping:0}}})});
    row=(await f.load()).products[0];assert.deepEqual([row.shipping,row.tax,row.duties],[0,null,null]);assert.equal((await f.compare()).lowestOfferId,null);
    f.offer({payload_json:JSON.stringify({...garment,costsByDestinationMinor:{US:{shipping:1250,tax:350,duties:0},KR:{shipping:null,tax:null,duties:null}}})});
    row=(await f.load()).products[0];assert.deepEqual([row.shipping,row.tax,row.duties],[12.5,3.5,0]);assert.equal((await f.compare()).minimumAmount,66);
    row=(await f.load({destination:'KR'})).products[0];assert.deepEqual([row.shipping,row.tax,row.duties],[null,null,null]);
    assert.equal((await f.compare({destination:'KR'})).lowestOfferId,null);
    for(const invalid of [{US:null},{US:{shipping:'0'}},[]]){
      f.offer({payload_json:JSON.stringify({...garment,costsApplyToAllDestinations:true,costsByDestinationMinor:invalid})});
      assert.equal((await f.load()).products[0].shipping,null);assert.equal((await f.compare()).lowestOfferId,null);
    }
  }finally{f.close();}
});
