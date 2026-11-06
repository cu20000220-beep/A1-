'use strict';
// Actual Cloudflare runtime + ephemeral D1. Every outbound request is a local
// RSA/JWKS fixture; no retailer, payment, GPT, email or SMS endpoint is called.
const assert=require('node:assert/strict');
const {generateKeyPairSync,sign}=require('node:crypto');
const {readFileSync}=require('node:fs');
const {join,resolve}=require('node:path');
const dependency=name=>require(process.env.A1_WORKER_TOOLS_ROOT?join(process.env.A1_WORKER_TOOLS_ROOT,name):name);
const {Miniflare,convertV4MiniflareOptions}=dependency('miniflare');
const {build}=dependency('esbuild');
const root=resolve(__dirname,'..'),origin='https://a1fashion.pages.dev';
const issuer='https://completion-workerd.example.test/',audience='completion-workerd-fixture',jwksUrl=issuer+'keys';
const now=Date.now(),{privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}),kid:'completion-runtime-key',alg:'RS256',use:'sig'};
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
function token(subject,extra={}){const text=`${encode({alg:'RS256',kid:jwk.kid})}.${encode({iss:issuer,aud:audience,sub:subject,exp:Math.floor(now/1000)+3600,...extra})}`;return`${text}.${sign('RSA-SHA256',Buffer.from(text),privateKey).toString('base64url')}`;}
const outbound=[];
async function provider(request){outbound.push(request.url);assert.equal(request.url,jwksUrl,'No operational services may be contacted');assert.equal(request.method,'GET');return Response.json({keys:[jwk]});}

(async()=>{
  const bundled=await build({stdin:{contents:`
    import {handleGlobalRequest} from './functions/api/global/_shared.js';
    let tick=${now};
    export default {fetch(request,env){tick+=10;return handleGlobalRequest(new URL(request.url).pathname.split('/').at(-1),{request,env},{now:tick});}};
  `,resolveDir:root,sourcefile:'workerd-global-completion-entry.mjs'},bundle:true,write:false,format:'esm',platform:'browser',target:'es2022'});
  const options={modules:true,script:bundled.outputFiles[0].text,compatibilityDate:'2026-11-05',
    bindings:{AUTH_ISSUER:issuer,AUTH_AUDIENCE:audience,AUTH_JWKS_URL:jwksUrl,
      ENABLE_LIVE_CATALOG:'true',GLOBAL_CATALOG_APPROVED:'true',EMAIL_API_KEY:'synthetic-not-a-provider-key',SMS_API_KEY:'synthetic-not-a-provider-key'},
    d1Databases:{MEMBERSHIP_DB:'local-global-completion-only'},outboundService:provider};
  const mf=new Miniflare(convertV4MiniflareOptions?convertV4MiniflareOptions(options):options);
  try{
    const db=await mf.getD1Database('MEMBERSHIP_DB');
    async function sqlFile(file){const source=readFileSync(join(root,file),'utf8').replace(/^\s*--.*$/gm,'');for(const statement of source.split(';').map(v=>v.trim()).filter(Boolean))await db.prepare(statement).run();}
    await sqlFile('server/schema.sql');
    // Exercise the real reviewed ALTER migration against preserved legacy
    // consent data rather than merely testing the already-expanded schema.
    await db.prepare('DROP TABLE notification_consents').run();
    await db.prepare(`CREATE TABLE notification_consents(id TEXT NOT NULL,issuer TEXT NOT NULL,subject TEXT NOT NULL,channel TEXT NOT NULL CHECK(channel IN ('email','sms')),granted INTEGER NOT NULL CHECK(granted IN (0,1)),policy_version TEXT NOT NULL,occurred_at INTEGER NOT NULL,PRIMARY KEY(issuer,subject,id)) STRICT`).run();
    await db.prepare('INSERT INTO notification_consents(id,issuer,subject,channel,granted,policy_version,occurred_at) VALUES(?,?,?,?,?,?,?)').bind('legacy-record',issuer,'legacy','email',1,'a1-marketing-v1',now-5000).run();
    await sqlFile('server/migrations/0003_global_consent_context.sql');
    const legacy=await db.prepare('SELECT * FROM notification_consents WHERE id=?').bind('legacy-record').first();
    assert.equal(legacy.granted,1);assert.equal(legacy.country,null);assert.equal(legacy.notice_text,null);
    async function member(subject,plan='PREMIUM',status='active',expiry=now+3600000){await db.prepare('INSERT OR REPLACE INTO memberships(issuer,subject,subscription_status,plan_code,paid_through,payment_verified_at) VALUES(?,?,?,?,?,?)').bind(issuer,subject,status,plan,expiry,now-10000).run();}
    async function call(resource,{subject='premium',method='GET',body,authenticated=true,claims,language='en',requestOrigin=origin}={}){
      const response=await mf.dispatchFetch(`${origin}/api/global/${resource}`,{method,headers:{'Accept-Language':language,...(authenticated?{Authorization:`Bearer ${token(subject,claims)}`} : {}),...(method==='GET'?{}:{Origin:requestOrigin,'Content-Type':'application/json'})},...(method==='GET'?{}:{body:JSON.stringify(body??{})})});
      assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert.equal(response.headers.get('Access-Control-Allow-Origin'),null);
      const value=await response.json();assert.ok(!JSON.stringify(value).includes(issuer));return{status:response.status,value};
    }
    await member('general','GENERAL');await member('premium');await member('other');
    const filters={country:'US',destination:'US',currency:'USD',gender:'unisex',style:'classic',category:'tops'};
    assert.equal((await call('products',{authenticated:false,method:'POST',body:filters})).status,401);
    assert.equal((await call('products',{subject:'free',claims:{paid:true,plan:'PREMIUM'},method:'POST',body:filters})).status,403);
    assert.equal((await call('simulate',{subject:'general',method:'POST',body:{}})).status,403);
    assert.equal((await call('comparison',{subject:'general',method:'POST',body:{productId:'demo-tee',destination:'US',currency:'USD'}})).status,403);
    await db.prepare(`INSERT INTO retailers(id,name,country,integration_status,provider_kind,source_url,terms_url,image_rights_note,retention_seconds,minimum_refresh_seconds,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind('ebay-us','Fixture approved seller','US','configured','official_api','https://api.ebay.com/buy/browse/v1/item','https://developer.ebay.com/api-docs','Fixture-reviewed rights',86400,3600,now-100000).run();
    async function offer(id,price,shipping,size='M',currency='USD'){
      await db.prepare(`INSERT INTO product_offers(id,retailer_id,product_id,brand,product_name,sku,color,size,item_condition,seller_country,product_url,price_minor,currency,shipping_minor,tax_minor,duty_minor,shipping_countries_json,stock_status,checked_at,source_mode,source_url,payload_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,'ebay-us','runtime-shirt','Fixture Brand','Fixture White Shirt','MAKER-SHIRT-1','White',size,'new','US','https://www.ebay.com/itm/fixture-only',price,currency,shipping,0,0,JSON.stringify(['US','KR','GB']),'in_stock',now-60000,'official','https://api.ebay.com/buy/browse/v1/item',JSON.stringify({gender:'unisex',category:'tops',styles:['classic'],costsApplyToAllDestinations:true})).run();
    }
    await offer('runtime-offer',4000,500);await offer('runtime-unknown',1000,null);await offer('runtime-large',1000,0,'L');await offer('runtime-eur',1000,100,'M','EUR');
    const products=await call('products',{subject:'general',method:'POST',body:filters});assert.equal(products.status,200);assert.equal(products.value.mode,'verified-offers');assert.equal(products.value.status,'ready');assert.ok(products.value.products.some(row=>row.id==='runtime-offer'&&row.price===40));
    const compared=await call('comparison',{method:'POST',body:{productId:'runtime-offer',destination:'US',currency:'USD'}});
    assert.equal(compared.status,200);assert.equal(compared.value.lowestOfferId,'runtime-offer');assert.equal(compared.value.minimumAmount,45);assert.equal(compared.value.demo,false);
    assert.equal(compared.value.results.find(row=>row.id==='runtime-unknown').estimatedTotal,null);assert.equal(compared.value.results.find(row=>row.id==='runtime-eur').estimatedTotal,null);assert.ok(compared.value.similarOffers.some(row=>row.id==='runtime-large'));
    const prefs={country:'US',timeZone:'America/New_York',language:'en',frequency:'daily',emailEnabled:true,smsEnabled:true,brands:['A1 DEMO'],categories:['tops']};
    assert.equal((await call('simulate',{method:'POST',body:{}})).value.created,0);
    await call('preferences',{method:'PUT',body:{...prefs,emailEnabled:false,smsEnabled:false}});
    const notice=await call('consents');assert.equal(notice.status,200);assert.equal(notice.value.auditContextAvailable,true);
    for(const channel of ['email','sms'])assert.equal((await call('consents',{method:'POST',body:{channel,granted:true,noticeVersion:notice.value.noticeVersion}})).status,200);
    await call('watchlist',{method:'POST',body:{productId:'demo-tee',currency:'USD',targetPrice:39,brand:'A1 DEMO',category:'tops'}});
    assert.equal((await call('preferences',{method:'PUT',body:prefs})).status,200);
    const audit=await call('consents');assert.ok(audit.value.history.every(row=>row.contextCaptured&&row.country==='US'&&row.language==='en'&&row.noticeText));
    assert.equal((await call('consents',{subject:'other'})).value.history.length,0);
    const simulated=await Promise.all(Array.from({length:4},()=>call('simulate',{method:'POST',body:{}})));
    for(const result of simulated){assert.equal(result.status,200);assert.equal(result.value.mode,'DEMO');assert.equal(result.value.sent,false);}
    assert.equal(simulated.reduce((sum,row)=>sum+row.value.created,0),2,'One daily digest per owned channel, even under concurrent requests');
    const logs=await db.prepare('SELECT * FROM notification_deliveries WHERE issuer=? AND subject=?').bind(issuer,'premium').all();
    assert.equal(logs.results.length,2);assert.ok(logs.results.every(row=>row.status==='simulated'&&!row.payload_json.includes('@')&&!row.payload_json.includes('phone')));
    assert.equal((await call('history',{subject:'other'})).value.deliveries.length,0);
    await call('history',{method:'DELETE',body:{}});assert.equal((await call('simulate',{method:'POST',body:{}})).value.created,0,'History erasure cannot resurrect the dedupe claim');
    await member('premium','PREMIUM','active',now-1);
    assert.equal((await call('simulate',{method:'POST',body:{}})).status,403);
    const hour=Math.floor(now/3600000)*3600000;
    await db.prepare('UPDATE api_rate_limits SET request_count=60 WHERE issuer=? AND subject=? AND window_start=?').bind(issuer,'premium',hour).run();
    assert.equal((await call('consents')).status,429);
    assert.equal((await call('consents',{method:'POST',body:{channel:'email',granted:false,noticeVersion:notice.value.noticeVersion}})).status,200);
    assert.equal((await call('preferences',{method:'DELETE',body:{}})).status,200);
    assert.ok(outbound.length>0&&outbound.every(url=>url===jwksUrl));
    console.log('Workerd global completion passed: actual D1 migration preserves legacy consent, signed tier gates, official stored products/exact comparison, unknown charges and FX, notice snapshots, concurrent deduped DEMO alerts, owner isolation and expired/quota-exhausted withdrawal. Only local JWKS; no operational API, payment, GPT or message calls.');
  }finally{await mf.dispose();}
})().catch(error=>{console.error(error);process.exitCode=1;});
