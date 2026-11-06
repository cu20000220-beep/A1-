'use strict';
// Real RSA + deterministic async boundaries; no operational identity/provider.
const test = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync, sign } = require('node:crypto');
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const NOW = 1793966400000, ORIGIN = 'https://a1fashion.pages.dev';
const ISSUER = 'https://unified-access.example.test/', AUDIENCE = 'a1-unified-access';
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'unified-access', use: 'sig', alg: 'RS256' };
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const unsigned = encode({ alg:'RS256',kid:jwk.kid,typ:'JWT' }) + '.' + encode({iss:ISSUER,sub:'owner',aud:AUDIENCE,exp:Math.floor(NOW/1000)+3600});
const token = unsigned + '.' + sign('RSA-SHA256',Buffer.from(unsigned),privateKey).toString('base64url');
const input = { metrics:{shoulderHipRatio:1.1,legTorsoRatio:1.6}, preferences:{gender:'전체',style:'전체',budget:100000} };
const handlers = Promise.all([import('../functions/api/recommendations.js'), import('../functions/api/membership.js')]);
function fixture(t) {
  let now=NOW, reads=0, hook;
  let row={issuer:ISSUER,subject:'owner',subscription_status:'active',plan_code:'GENERAL',paid_through:NOW+1000,payment_verified_at:NOW-1000};
  t.mock.method(Date,'now',()=>now);
  t.mock.method(globalThis,'fetch',async(url,options)=>{assert.equal(url,ISSUER+'keys');assert.equal(options.redirect,'manual');return Response.json({keys:[jwk]});});
  const env={AUTH_ISSUER:ISSUER,AUTH_AUDIENCE:AUDIENCE,AUTH_JWKS_URL:ISSUER+'keys',MEMBERSHIP_DB:{prepare(query){assert.match(query,/^SELECT .*FROM memberships /);return {bind(issuer,subject){assert.equal(issuer,ISSUER);assert.equal(subject,'owner');return {async first(){reads++;const snapshot={...row};if(hook)await hook(reads);return snapshot;}};}};}}};
  function request(path,body=input){return new Request(ORIGIN+path,{method:path==='/api/membership'?'GET':'POST',headers:{Authorization:'Bearer '+token,...(path==='/api/membership'?{}:{Origin:ORIGIN,'Content-Type':'application/json'})},...(path==='/api/membership'?{}:{body:body instanceof ReadableStream?body:JSON.stringify(body),...(body instanceof ReadableStream?{duplex:'half'}:{})})});}
  return {env,request,setClock(value){now=value;},setStatus(value){row.subscription_status=value;},setHook(value){hook=value;}};
}
async function denied(response){assert.equal(response.status,403);assert.equal(response.headers.get('Cache-Control'),'private, no-store');const value=await response.json();assert.equal(value.error,'subscription_required');assert.equal(value.recommendations,undefined);}

test('legacy style recommendation rechecks cancellation, refund and nonpayment after an asynchronous request body',async t=>{
  for(const status of ['canceled','refunded','unpaid','past_due','inactive'])await t.test(status,async t=>{
    const f=fixture(t);let controller;
    const body=new ReadableStream({start(value){controller=value;}});
    f.setHook(async count=>{if(count===1)setTimeout(()=>{f.setStatus(status);controller.enqueue(new TextEncoder().encode(JSON.stringify(input)));controller.close();},0);});
    const [style]=await handlers;
    await denied(await style.onRequest({request:f.request('/api/recommendations',body),env:f.env}));
  });
});

test('legacy style response denies expiry during its final membership lookup',async t=>{
  const f=fixture(t);f.setHook(async count=>{if(count===2)f.setClock(NOW+1000);});
  const [style]=await handlers;
  await denied(await style.onRequest({request:f.request('/api/recommendations'),env:f.env}));
});

test('legacy membership status denies expiry while its query is awaiting completion',async t=>{
  const f=fixture(t);f.setHook(async()=>f.setClock(NOW+1000));
  const [,membership]=await handlers;
  await denied(await membership.onRequest({request:f.request('/api/membership'),env:f.env}));
});

test('legacy valid GENERAL requests still return recommendations and current entitlement',async t=>{
  const f=fixture(t),[style,membership]=await handlers;
  const response=await style.onRequest({request:f.request('/api/recommendations'),env:f.env});
  assert.equal(response.status,200);assert.ok((await response.json()).recommendations.length>0);
  const current=await membership.onRequest({request:f.request('/api/membership'),env:f.env});
  assert.equal(current.status,200);assert.equal((await current.json()).plan,'GENERAL');
});
