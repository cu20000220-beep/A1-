'use strict';
// Real signatures and SQLite, local supplier fixtures only. No operational
// identities, supplier requests, billing, email, SMS or GPT calls are made.
const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { generateKeyPairSync, sign } = require('node:crypto');
const { readFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');
const api = import('../functions/api/global/_shared.js');
const NOW = Date.now(), ORIGIN = 'https://a1fashion.pages.dev';
const ISSUER = 'https://completion-members.example.test/', AUDIENCE = 'completion-fixture';
const OWNER = 'completion-owner-A', OTHER = 'completion-owner-B';
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid:'completion-key', alg:'RS256', use:'sig' };
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
function token(subject, extra = {}) {
  const text = `${encode({alg:'RS256',kid:jwk.kid})}.${encode({iss:ISSUER,aud:AUDIENCE,sub:subject,exp:Math.floor(NOW/1000)+3600,...extra})}`;
  return `${text}.${sign('RSA-SHA256',Buffer.from(text),privateKey).toString('base64url')}`;
}
function fixture() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(resolve(__dirname,'../server/schema.sql'),'utf8'));
  let queryHook = null, remoteCalls = 0, requestSequence = 0;
  const database = { prepare(query) {
    if(queryHook) queryHook(query);
    const statement = sql.prepare(query);
    return { bind(...values) { return {
      first:async()=>statement.get(...values)||null,
      all:async()=>({results:statement.all(...values)}),
      run:async()=>({meta:{changes:Number(statement.run(...values).changes)}})
    }; } };
  }, async batch(statements) {
    sql.exec('BEGIN');
    try { const results=[];for(const statement of statements)results.push(await statement.run());sql.exec('COMMIT');return results; }
    catch(error){sql.exec('ROLLBACK');throw error;}
  }};
  const env={AUTH_ISSUER:ISSUER,AUTH_AUDIENCE:AUDIENCE,AUTH_JWKS_URL:ISSUER+'keys',MEMBERSHIP_DB:database};
  const member=(subject=OWNER,plan='PREMIUM',status='active',expiry=NOW+3600000)=>sql.prepare('INSERT OR REPLACE INTO memberships(issuer,subject,subscription_status,plan_code,paid_through,payment_verified_at) VALUES(?,?,?,?,?,?)').run(ISSUER,subject,status,plan,expiry,NOW-10000);
  async function fetchImpl(url,options){remoteCalls++;assert.equal(url,ISSUER+'keys','No external supplier or message provider is allowed');assert.equal(options.redirect,'manual');return Response.json({keys:[jwk]});}
  async function call(resource,{subject=OWNER,method='GET',body,authenticated=true,origin=ORIGIN,claims={},query='',clock}={}){
    const request=new Request(`${ORIGIN}/api/global/${resource}${query}`,{method,headers:{'Accept-Language':'en',...(authenticated?{Authorization:`Bearer ${token(subject,claims)}`} : {}),...(method==='GET'?{}:{Origin:origin,'Content-Type':'application/json'})},...(method==='GET'?{}:{body:JSON.stringify(body??{})})});
    // Let audited consent timestamps advance between requests, as they do in
    // the service. A synthetic frozen millisecond would make the next channel's
    // monotonic consent record appear to come from the future.
    const response=await(await api).handleGlobalRequest(resource,{request,env},{now:NOW+(++requestSequence*10),fetchImpl,...(clock?{clock}:{})});
    assert.equal(response.headers.get('Cache-Control'),'private, no-store');
    assert.equal(response.headers.get('Access-Control-Allow-Origin'),null);
    const value=await response.json();
    assert.ok(!JSON.stringify(value).includes(ISSUER));
    assert.ok(!JSON.stringify(value).includes(OWNER));
    return {status:response.status,value};
  }
  function retailer(id='ebay-us',country='US') {
    sql.prepare(`INSERT INTO retailers(id,name,country,integration_status,provider_kind,source_url,terms_url,image_rights_note,retention_seconds,minimum_refresh_seconds,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id,'Fixture approved seller '+country,country,'configured','official_api','https://api.ebay.com/buy/browse/v1/item','https://developer.ebay.com/api-docs','Fixture reviewed rights, no image',86400,3600,NOW-100000);
  }
  function offer({id='offer-us',retailerId='ebay-us',price=4000,currency='USD',size='M',shipping=500,checkedAt=NOW-60000,productId='fixture-shirt',url='https://www.ebay.com/itm/fixture-only'}={}) {
    sql.prepare(`INSERT INTO product_offers(id,retailer_id,product_id,brand,product_name,sku,color,size,item_condition,seller_country,product_url,price_minor,currency,shipping_minor,tax_minor,duty_minor,shipping_countries_json,stock_status,checked_at,source_mode,source_url,payload_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id,retailerId,productId,'Fixture Brand','Fixture White Shirt','MAKER-SHIRT-1','White',size,'new',retailerId==='ebay-gb'?'GB':'US',url,price,currency,shipping,0,0,JSON.stringify(['US','KR','GB','DE']),'in_stock',checkedAt,'official','https://api.ebay.com/buy/browse/v1/item',JSON.stringify({gender:'unisex',category:'tops',styles:['classic','casual'],costsApplyToAllDestinations:true}));
  }
  function approve(){env.ENABLE_LIVE_CATALOG='true';env.GLOBAL_CATALOG_APPROVED='true';}
  return {sql,env,database,member,call,retailer,offer,approve,setQueryHook(fn){queryHook=fn;},get remoteCalls(){return remoteCalls;},close(){sql.close();}};
}
const filters={country:'US',destination:'US',currency:'USD',gender:'unisex',style:'classic',category:'tops',brand:'Fixture',size:'M',query:'shirt',minPrice:'',maxPrice:'100'};
const preferences={country:'US',timeZone:'America/New_York',language:'en',frequency:'daily',emailEnabled:true,smsEnabled:true,brands:['A1 DEMO'],categories:['tops']};

test('new global paths preserve FREE/GENERAL/PREMIUM boundaries and default catalog disablement',async()=>{
  const f=fixture();try{
    assert.equal((await f.call('products',{method:'POST',body:filters,authenticated:false})).status,401);
    assert.equal((await f.call('products',{method:'POST',body:filters,claims:{paid:true,plan:'PREMIUM'}})).status,403);
    f.member(OWNER,'GENERAL');
    const empty=await f.call('products',{method:'POST',body:filters});
    assert.equal(empty.status,200);assert.equal(empty.value.status,'disabled');assert.deepEqual(empty.value.products,[]);
    assert.equal((await f.call('simulate',{method:'POST',body:{}})).status,403);
    assert.equal((await f.call('comparison',{method:'POST',body:{productId:'offer-us',destination:'US',currency:'USD'}})).status,403);
    f.member();
    assert.equal((await f.call('comparison',{method:'POST',body:{productId:'demo-tee',destination:'US',currency:'USD'}})).value.mode,'DEMO');
    for(const status of ['canceled','past_due','unpaid']){
      f.member(OWNER,'PREMIUM',status);assert.equal((await f.call('simulate',{method:'POST',body:{}})).status,403);
    }
    f.member(OWNER,'PREMIUM','active',NOW-1);assert.equal((await f.call('products',{method:'POST',body:filters})).status,403);
  }finally{f.close();}
});

test('approved stored product results use source records and exact variant comparison without fake FX or zero fees',async()=>{
  const f=fixture();try{
    f.member();f.approve();f.retailer();f.retailer('ebay-gb','GB');f.offer();
    f.offer({id:'offer-unknown',price:1000,shipping:null});
    f.offer({id:'offer-large',price:1000,size:'L'});
    f.offer({id:'offer-gb',retailerId:'ebay-gb',price:2000,currency:'GBP',url:'https://www.ebay.co.uk/itm/fixture-only'});
    f.offer({id:'offer-old',price:100,checkedAt:NOW-25*3600000});
    const products=await f.call('products',{method:'POST',body:filters});
    assert.equal(products.status,200);assert.equal(products.value.mode,'verified-offers');assert.equal(products.value.status,'ready');
    assert.ok(products.value.products.some(p=>p.id==='offer-us'&&p.price===40&&p.currency==='USD'));
    assert.ok(products.value.products.every(p=>p.size==='M'&&p.currency==='USD'&&p.id!=='offer-old'));
    assert.ok(products.value.products.every(p=>p.source&&p.checkedAt));
    const comparison=await f.call('comparison',{method:'POST',body:{productId:'offer-us',destination:'US',currency:'USD'}});
    assert.equal(comparison.status,200);assert.equal(comparison.value.mode,'verified-offers');assert.equal(comparison.value.demo,false);
    assert.equal(comparison.value.lowestOfferId,'offer-us');assert.equal(comparison.value.minimumAmount,45);
    assert.equal(comparison.value.results.find(p=>p.id==='offer-unknown').estimatedTotal,null);
    assert.ok(comparison.value.results.find(p=>p.id==='offer-gb').warnings.includes('fx-unavailable-or-stale'));
    assert.ok(comparison.value.similarOffers.some(p=>p.id==='offer-large'));
    assert.ok(!comparison.value.results.some(p=>p.id==='offer-old'));
    const missing=await f.call('comparison',{method:'POST',body:{productId:'not-a-product',destination:'US',currency:'USD'}});
    assert.equal(missing.status,200);assert.equal(missing.value.lowestOfferId,null);assert.notEqual(missing.value.mode,'DEMO');
    const longId='offer-'+ 'x'.repeat(134);f.offer({id:longId});
    const listed=await f.call('products',{method:'POST',body:filters});assert.ok(listed.value.products.some(p=>p.id===longId));
    const saved=await f.call('watchlist',{method:'POST',body:{productId:longId,currency:'USD'}});
    assert.equal(saved.status,201);assert.ok(saved.value.items.some(item=>item.productId===longId),'A returned official offer must remain saveable');
  }finally{f.close();}
});

test('new product and simulation requests cannot accept user IDs, supplier URLs, arbitrary events or paid flags',async()=>{
  const f=fixture();try{
    f.member();
    for(const body of [{...filters,subject:OTHER},{...filters,url:'https://attacker.test/feed'},{...filters,paid:true}])assert.equal((await f.call('products',{method:'POST',body})).status,400);
    for(const body of [{subject:OTHER},{events:[{price:0}]},{mode:'LIVE'},{email:'attacker@test.invalid'}])assert.equal((await f.call('simulate',{method:'POST',body})).status,400);
    assert.equal((await f.call('simulate',{method:'POST',body:{},origin:'https://attacker.test'})).status,403);
    assert.equal((await f.call('consents',{query:'?subject='+OTHER})).status,400);
  }finally{f.close();}
});

test('generic stored charges without destination proof cannot become a false zero-cost minimum',async()=>{
  const f=fixture();try{
    f.member();f.approve();f.retailer();f.offer({shipping:0});
    f.sql.prepare('UPDATE product_offers SET payload_json=? WHERE id=?').run(JSON.stringify({gender:'unisex',category:'tops',styles:['classic']}),'offer-us');
    const products=await f.call('products',{method:'POST',body:filters});
    assert.equal(products.status,200);assert.equal(products.value.products.length,1);
    for(const field of ['shipping','tax','duties'])assert.equal(products.value.products[0][field],null);
    const comparison=await f.call('comparison',{method:'POST',body:{productId:'offer-us',destination:'US',currency:'USD'}});
    assert.equal(comparison.status,200);assert.equal(comparison.value.lowestOfferId,null);assert.equal(comparison.value.minimumAmount,null);
    assert.ok(comparison.value.results[0].warnings.includes('shipping-cost-unknown'));
    assert.equal(comparison.value.results[0].estimatedTotal,null);
  }finally{f.close();}
});

test('consent audit GET remains owner scoped after expiration and snapshots country/language without contacts',async()=>{
  const f=fixture();try{
    f.member();f.member(OTHER);
    await f.call('preferences',{method:'PUT',body:{...preferences,emailEnabled:false,smsEnabled:false}});
    const notice=await f.call('consents');
    assert.equal(notice.status,200);assert.equal(notice.value.auditContextAvailable,true);assert.ok(notice.value.notices.email);
    await f.call('consents',{method:'POST',body:{channel:'email',granted:true,noticeVersion:notice.value.noticeVersion}});
    // Older clients can withdraw or preserve their old boolean choice, but
    // cannot claim acknowledgement of wording they never displayed.
    await f.call('consents',{method:'POST',body:{channel:'sms',granted:true}});
    await f.call('preferences',{method:'PUT',body:{...preferences,country:'KR',timeZone:'Asia/Seoul',language:'ko',emailEnabled:false,smsEnabled:false}});
    f.member(OWNER,'PREMIUM','active',NOW-1);
    const own=await f.call('consents');
    assert.equal(own.status,200);assert.equal(own.value.consents.email,true);assert.ok(Array.isArray(own.value.history));
    const grant=own.value.history.find(row=>row.channel==='email'&&row.granted===true);
    assert.equal(grant.country,'US');assert.equal(grant.language,'en');assert.equal(grant.contextCaptured,true);assert.ok(grant.noticeText);
    const legacy=own.value.history.find(row=>row.channel==='sms');
    assert.equal(legacy.contextCaptured,false);assert.equal(legacy.noticeText,null);assert.equal(legacy.policyVersion,'a1-marketing-v1');
    assert.equal((await f.call('consents',{subject:OTHER})).value.history.length,0);
    assert.equal((await f.call('consents',{authenticated:false})).status,401);
    const hour=Math.floor(NOW/3600000)*3600000;
    f.sql.prepare('INSERT OR REPLACE INTO api_rate_limits(issuer,subject,window_start,request_count) VALUES(?,?,?,60)').run(ISSUER,OWNER,hour);
    assert.equal((await f.call('consents')).status,429);
    assert.equal((await f.call('consents',{method:'POST',body:{channel:'email',granted:false}})).status,200);
  }finally{f.close();}
});

test('owned watch criteria and separate consent drive DEMO simulations, dedupe and post-expiry privacy operations',async()=>{
  const f=fixture();try{
    f.member();f.member(OTHER);
    assert.equal((await f.call('simulate',{method:'POST',body:{}})).value.created,0);
    await f.call('watchlist',{method:'POST',body:{productId:'demo-tee',currency:'USD',targetPrice:39,brand:'A1 DEMO',category:'tops'}});
    for(const channel of ['email','sms'])await f.call('consents',{method:'POST',body:{channel,granted:true}});
    await f.call('preferences',{method:'PUT',body:preferences});
    const first=await f.call('simulate',{method:'POST',body:{}});
    assert.equal(first.status,200);assert.equal(first.value.mode,'DEMO');assert.equal(first.value.sent,false);
    assert.ok(first.value.created>0);assert.ok(first.value.eventCount>0);
    assert.ok(first.value.previews.every(p=>p.template.mode==='DRY_RUN'&&/DEMO/.test(p.template.text)));
    assert.ok(first.value.previews.some(p=>p.channel==='email'));assert.ok(first.value.previews.some(p=>p.channel==='sms'));
    const rows=f.sql.prepare('SELECT * FROM notification_deliveries WHERE issuer=? AND subject=?').all(ISSUER,OWNER);
    assert.ok(rows.length>0);assert.ok(rows.every(row=>!['sent','queued'].includes(row.status)));
    assert.ok(rows.every(row=>!row.payload_json.includes(OWNER)&&!row.payload_json.includes('@')&&!row.payload_json.includes('phone')));
    const again=await f.call('simulate',{method:'POST',body:{}});assert.equal(again.value.created,0);assert.ok(again.value.duplicates>0);
    assert.equal((await f.call('history',{subject:OTHER})).value.deliveries.length,0);
    assert.equal((await f.call('simulate',{subject:OTHER,method:'POST',body:{}})).value.created,0);
    await f.call('history',{method:'DELETE',body:{}});
    assert.equal((await f.call('simulate',{method:'POST',body:{}})).value.created,0,'Deleting history must not re-send the same mock event');
    await f.call('consents',{method:'POST',body:{channel:'email',granted:false}});
    const withdrawn=await f.call('simulate',{method:'POST',body:{}});
    assert.ok(withdrawn.value.previews.every(p=>p.channel!=='email'));
    f.member(OWNER,'PREMIUM','active',NOW-1);
    assert.equal((await f.call('simulate',{method:'POST',body:{}})).status,403);
    assert.equal((await f.call('preferences',{method:'DELETE',body:{}})).status,200);
  }finally{f.close();}
});

test('paid stored-catalog responses recheck a subscription revoked during the asynchronous read',async()=>{
  const f=fixture();try{
    f.member();f.approve();f.retailer();f.offer();let revoked=false;
    f.setQueryHook(query=>{if(!revoked&&/FROM product_offers/i.test(query)){revoked=true;f.member(OWNER,'PREMIUM','canceled');}});
    const result=await f.call('products',{method:'POST',body:filters});
    assert.equal(revoked,true);assert.equal(result.status,403);assert.ok(!Object.hasOwn(result.value,'products'));
  }finally{f.close();}
});

test('subscriptions expiring during the final authorization await cannot publish paid results',async()=>{
  for(const resource of ['retailers','products','comparison']){
    const f=fixture();try{
      const plan=resource==='comparison'?'PREMIUM':'GENERAL';
      f.member(OWNER,plan,'active',NOW+50);f.approve();f.retailer();f.offer();
      let clock=NOW,membershipReads=0;
      f.setQueryHook(query=>{if(/FROM memberships\b/i.test(query)&&++membershipReads===2)clock=NOW+51;});
      const result=await f.call(resource,{method:'POST',clock:()=>clock,
        body:resource==='comparison'?{productId:'offer-us',destination:'US',currency:'USD'}:filters});
      assert.equal(membershipReads,2,'Exercise expiry inside the final authorization await');
      assert.equal(result.status,403,resource);
      assert.equal(result.value.error,'subscription_required');
      for(const key of ['retailers','products','results','lowestOfferId'])assert.equal(Object.hasOwn(result.value,key),false);
    }finally{f.close();}
  }
  const f=fixture();try{
    f.member(OWNER,'GENERAL','active',NOW+50);let clock=NOW;
    f.setQueryHook(query=>{if(/INSERT INTO api_rate_limits/i.test(query))clock=NOW+51;});
    const account=await f.call('account',{clock:()=>clock});
    assert.equal(account.status,200);assert.equal(account.value.plan,'FREE');
    assert.equal(account.value.subscription.active,false,'The account screen must not show an elapsed paid period as active');
  }finally{f.close();}
});

test('clock advancement across stored-price reads cannot publish expired products or minimum badges',async()=>{
  for(const resource of ['products','comparison']){
    const f=fixture();try{
      f.member();f.approve();f.retailer();f.offer();
      f.sql.prepare('UPDATE product_offers SET expires_at=? WHERE id=?').run(NOW+500,'offer-us');
      let clock=NOW;
      f.setQueryHook(query=>{if(/FROM product_offers/i.test(query))clock=NOW+1000;});
      const result=await f.call(resource,{method:'POST',body:resource==='products'?filters:{productId:'offer-us',destination:'US',currency:'USD'},clock:()=>clock});
      assert.equal(result.status,200);
      if(resource==='products')assert.deepEqual(result.value.products,[]);
      else{assert.equal(result.value.lowestOfferId,null);assert.equal(result.value.minimumAmount,null);assert.ok(result.value.results.every(row=>!row.eligible));}
    }finally{f.close();}
  }
});

test('a promotion ending during an async read cannot leave an out-of-budget sale recommendation',async()=>{
  const f=fixture();try{
    f.member();f.approve();f.retailer();f.offer();
    f.sql.prepare('UPDATE product_offers SET promotion_price_minor=?,promotion_starts_at=?,promotion_ends_at=? WHERE id=?').run(3000,NOW-1000,NOW+500,'offer-us');
    let clock=NOW;
    f.setQueryHook(query=>{if(/FROM product_offers/i.test(query))clock=NOW+1000;});
    const result=await f.call('products',{method:'POST',body:{...filters,maxPrice:'35'},clock:()=>clock});
    assert.equal(result.status,200);assert.deepEqual(result.value.products,[]);
  }finally{f.close();}
});

test('unified release includes AI behind the server boundary and public packaging cannot expose server/catalog data',()=>{
  for(const relative of ['stylist.html','functions/api/stylist.js','server/ai-stylist.mjs','assets/stylist.js'])assert.equal(existsSync(resolve(__dirname,'..',relative)),true,relative);
  const builder=readFileSync(resolve(__dirname,'../scripts/build-site.cjs'),'utf8');
  assert.doesNotMatch(builder,/['"](?:server|functions|workers)(?:\/|['"])/);
  for(const relative of ['global.html','stylist.html','assets/stylist.js'])assert.doesNotMatch(readFileSync(resolve(__dirname,'..',relative),'utf8'),/api\.openai\.com|OPENAI_API_KEY/);
});
