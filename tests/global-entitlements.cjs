'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {generateKeyPairSync,sign}=require('node:crypto');
const mod=import('../server/premium-access.mjs');
const policy=import('../server/membership-policy.mjs');
const now=Date.now(),issuer='https://tier-members.example.test/',audience='a1-global-tiers';
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}),kid:'tier-test',alg:'RS256',use:'sig'};
const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
const payload=`${encode({alg:'RS256',kid:jwk.kid})}.${encode({iss:issuer,aud:audience,sub:'tier-member',exp:Math.floor(now/1000)+3600})}`;
const jwt=`${payload}.${sign('RSA-SHA256',Buffer.from(payload),privateKey).toString('base64url')}`;
const request=()=>new Request('https://a1fashion.pages.dev/api/membership',{headers:{Authorization:`Bearer ${jwt}`}});
const row={issuer,subject:'tier-member',subscription_status:'active',paid_through:now+60000,payment_verified_at:now-1000};
function setup({record=row,columnMissing=false,failure}={}){
 const queries=[];
 return {queries,env:{AUTH_ISSUER:issuer,AUTH_AUDIENCE:audience,AUTH_JWKS_URL:issuer+'jwks',MEMBERSHIP_DB:{prepare(sql){
  queries.push(sql);assert.match(sql,/^SELECT/);assert.doesNotMatch(sql,/UPDATE|DELETE|INSERT/i);
  return {bind(boundIssuer,subject){assert.equal(boundIssuer,issuer);assert.equal(subject,'tier-member');return {async first(){
   if(failure)throw failure;
   if(columnMissing&&sql.includes('plan_code'))throw new Error('D1_ERROR: no such column: plan_code at offset 90');
   return record;
  }}}};
 }}}};
}
const fetchImpl=async(url,options)=>{assert.equal(url,issuer+'jwks');assert.equal(options.redirect,'manual');return Response.json({keys:[jwk]})};
const opts={now,fetchImpl};

test('verified GENERAL and legacy rows allow styles while PREMIUM is required for comparison/alerts',async()=>{
 const {authorizeMember,authorizePremium}=await mod;
 for(const record of [row,{...row,plan_code:'GENERAL'}]){
  const fixture=setup({record});
  const general=await authorizePremium(request(),fixture.env,opts);
  assert.deepEqual(general,{allowed:true,accessUntil:row.paid_through,plan:'GENERAL'});
  await assert.rejects(authorizeMember(request(),fixture.env,{...opts,requiredTier:'PREMIUM'}),e=>e.status===403&&e.code==='premium_required');
 }
 const fixture=setup({record:{...row,plan_code:'PREMIUM'}});
 const access=await authorizeMember(request(),fixture.env,{...opts,requiredTier:'PREMIUM'});
 assert.equal(access.plan,'PREMIUM');assert.deepEqual(access.identity,{issuer,subject:'tier-member'});
 assert.equal((await authorizePremium(request(),fixture.env,opts)).plan,'PREMIUM');
});

test('only the exact legacy missing-plan column error activates the old SELECT',async()=>{
 const {authorizePremium}=await mod;
 const legacy=setup({columnMissing:true});
 assert.equal((await authorizePremium(request(),legacy.env,opts)).plan,'GENERAL');
 assert.equal(legacy.queries.length,2);assert.ok(legacy.queries[0].includes('plan_code'));assert.ok(!legacy.queries[1].includes('plan_code'));
 for(const failure of [new Error('database unavailable'),new Error('no such column: paid_through'),new Error('no such table: memberships')]){
  const unavailable=setup({failure});
  await assert.rejects(authorizePremium(request(),unavailable.env,opts),e=>e.status===503&&e.code==='setup_required');
  assert.equal(unavailable.queries.length,1);
 }
});

test('FREE authentication needs no paid database and cannot manufacture subscription access',async()=>{
 const {authenticateMember,authorizeMember,authorizePremium}=await mod;
 const {env}=setup();delete env.MEMBERSHIP_DB;
 assert.deepEqual(await authenticateMember(request(),env,opts),{issuer,subject:'tier-member'});
 const free=await authorizeMember(request(),env,{...opts,requiredTier:'FREE'});
 assert.equal(free.plan,'FREE');assert.equal(free.accessUntil,null);
 await assert.rejects(authorizePremium(request(),env,opts),e=>e.status===503);
 const flags=new Request('https://a1fashion.pages.dev/api/membership',{headers:{Cookie:'paid=true; plan_code=PREMIUM','X-Plan':'PREMIUM'}});
 await assert.rejects(authenticateMember(flags,env,opts),e=>e.status===401);
});

test('expired, refunded, unpaid or unverified PREMIUM never passes the premium gate',async()=>{
 const {authorizeMember}=await mod;
 for(const bad of [null,{...row,plan_code:'PREMIUM',subscription_status:'refunded'},
  {...row,plan_code:'PREMIUM',subscription_status:'past_due'}, {...row,plan_code:'PREMIUM',paid_through:now},
  {...row,plan_code:'PREMIUM',payment_verified_at:null}, {...row,plan_code:null}, {...row,plan_code:'ADMIN'}]){
  await assert.rejects(authorizeMember(request(),setup({record:bad}).env,{...opts,requiredTier:'PREMIUM'}),e=>e.status===403);
 }
 const fixture=setup({record:{...row,plan_code:'PREMIUM'}});
 await assert.rejects(authorizeMember(request(),fixture.env,{...opts,requiredTier:'ADMIN'}),e=>e.status===400);
 assert.equal(fixture.queries.length,0);
 const {evaluateAccess}=await policy;
 assert.equal(evaluateAccess({...row,subscriptionStatus:'active',paidThrough:row.paid_through,paymentVerifiedAt:row.payment_verified_at,planCode:'GENERAL'},now,'PREMIUM').allowed,false);
});
