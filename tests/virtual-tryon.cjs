'use strict';
// Dependency-injected synthetic provider envelopes. No key, remote call, payment
// or claim of a generated fitting image is used in these transport tests.
const test=require('node:test'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const adapter=import('../server/virtual-tryon.mjs');
const KEY='fixture-not-a-real-fashn-secret-1234';
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZksAAAAASUVORK5CYII=';
const env=()=>({A1_VIRTUAL_TRYON_MODE:'live',A1_VIRTUAL_TRYON_PROVIDER:'fashn',A1_VIRTUAL_TRYON_APPROVED:'true',FASHN_API_KEY:KEY});
const input=(changes={})=>({personImage:PNG,garmentImage:PNG,externalPhotoConsent:true,garmentUsePermission:true,category:'tops',...changes});
const json=(value,headers={})=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json',...headers}});
const complete=(changes={})=>({id:'fixture-prediction-id',status:'completed',error:null,output:[PNG],...changes});
const options=(fetchImpl,changes={})=>({maxCostUSD:.075,timeoutMs:1000,pollIntervalMs:0,maxPolls:4,sleepImpl:async()=>{},fetchImpl,...changes});
async function expect(fn,code,status){await assert.rejects(fn,error=>{assert.equal(error.code,code);if(status!==undefined)assert.equal(error.status,status);assert.equal(error.message,code);assert.ok(!JSON.stringify(error).includes(KEY));assert.ok(!JSON.stringify(error).includes(PNG));return true;});}

test('disabled config, missing secret/provider/approval and absent or insufficient finite cap never call a provider',async()=>{
 const {createVirtualTryOnClient,getVirtualTryOnConfiguration}=await adapter;
 let calls=0;const fetch=async()=>{calls++;throw Error('must not run');};
 for(const state of [{},{...env(),A1_VIRTUAL_TRYON_MODE:'demo'},{...env(),A1_VIRTUAL_TRYON_PROVIDER:'other'},{...env(),A1_VIRTUAL_TRYON_APPROVED:'false'},{...env(),FASHN_API_KEY:'bad secret'}])await expect(()=>createVirtualTryOnClient(state,options(fetch)).run(input()),'tryon_not_configured',503);
 for(const cap of[undefined,0,.074999,NaN,Infinity,'0.075',-1])await expect(()=>createVirtualTryOnClient(env(),options(fetch,{maxCostUSD:cap})).run(input()),'tryon_not_configured',503);
 assert.equal(calls,0);assert.equal(getVirtualTryOnConfiguration().ready,false);assert.ok(!JSON.stringify(getVirtualTryOnConfiguration(env(),{maxCostUSD:.075})).includes(KEY));
});

test('per-person external processing consent and garment permission are independent, with no budget spent on blocked input',async()=>{
 const {createVirtualTryOnClient}=await adapter;let calls=0;const client=createVirtualTryOnClient(env(),options(async()=>{calls++;}));
 await expect(()=>client.run(input({externalPhotoConsent:false})),'external_photo_consent_required',403);
 await expect(()=>client.run(input({garmentUsePermission:false})),'garment_permission_required',403);
 await expect(()=>client.run(input({bodyMetrics:{shoulderHipRatio:1.3}})),'tryon_input_invalid',400);
 assert.equal(calls,0);assert.equal(client.usage().reservedMicroUsd,0);
});

test('fixed exact single-sample v1.6 schema and base64 outputs use only the reviewed API host',async()=>{
 const {createVirtualTryOnClient}=await adapter,calls=[];let poll=0;
 const client=createVirtualTryOnClient(env(),options(async(url,init)=>{
  calls.push({url,init});assert.equal(init.redirect,'manual');assert.equal(init.headers.Authorization,'Bearer '+KEY);
  if(init.method==='POST'){const body=JSON.parse(init.body);assert.deepEqual(Object.keys(body).sort(),['inputs','model_name']);assert.equal(body.model_name,'tryon-v1.6');assert.deepEqual(body.inputs,{model_image:PNG,garment_image:PNG,category:'tops',garment_photo_type:'auto',mode:'balanced',num_samples:1,moderation_level:'conservative',output_format:'png',return_base64:true});return json({id:'fixture-prediction-id',error:null});}
  return json(++poll===1?{id:'fixture-prediction-id',status:'processing',error:null}:complete(),{'x-fashn-credits-used':'1'});
 }));
 const result=await client.run(input());assert.equal(result.kind,'ai-tryon-simulation');assert.equal(result.image,PNG);assert.equal(result.actual3D,false);assert.equal(result.sizeGuaranteed,false);assert.equal(result.estimatedCostUSD,.075);
 assert.equal(calls.filter(x=>x.init.method==='POST').length,1);assert.ok(calls.every(x=>x.url==='https://api.fashn.ai/v1/run'||x.url==='https://api.fashn.ai/v1/status/fixture-prediction-id'));
 assert.equal(client.usage().reservedMicroUsd,75000);assert.match(result.privacy,/not deleted automatically/);
});

test('URLs, malformed image signatures and excessive image sizes are rejected before transmission',async()=>{
 const {createVirtualTryOnClient}=await adapter;let calls=0;const client=createVirtualTryOnClient(env(),options(async()=>{calls++;}));
 for(const image of ['https://127.0.0.1/private.jpg','https://merchant.example/photo.jpg','data:image/svg+xml;base64,PHN2Zy8+','data:image/png;base64,AAAA','data:image/png;base64,'+'A'.repeat(12*1024*1024)]){
  await assert.rejects(()=>client.run(input({personImage:image})),error=>['image_input_invalid'].includes(error.code));
 }
 await expect(()=>client.run(input({category:'../../private'})),'tryon_input_invalid');
 assert.equal(calls,0);assert.equal(client.usage().runAttempts,0);
});

test('single-instance reservation is atomic across concurrent jobs and uncertain errors do not refund or retry',async()=>{
 const {createVirtualTryOnClient}=await adapter;let release,posts=0;
 const gate=new Promise(resolve=>{release=resolve;});
 const client=createVirtualTryOnClient(env(),options(async(url,init)=>{
  if(init.method==='POST'){posts++;await gate;return json({id:'fixture-prediction-id',error:null});}return json(complete());
 }));
 const first=client.run(input());await expect(()=>client.run(input()),'tryon_budget_exhausted',429);assert.equal(posts,1);release();await first;
 await expect(()=>client.run(input()),'tryon_budget_exhausted',429);assert.equal(posts,1);
 let failures=0;const failed=createVirtualTryOnClient(env(),options(async()=>{failures++;throw Error('untrusted '+KEY+' '+PNG);}));
 await expect(()=>failed.run(input()),'provider_unavailable',503);await expect(()=>failed.run(input()),'tryon_budget_exhausted');assert.equal(failures,1);assert.equal(failed.usage().reservedMicroUsd,75000);
});

test('HTTP redirects, provider errors and rate limits do not follow, retry or disclose provider bodies',async()=>{
 const {createVirtualTryOnClient}=await adapter;
 for(const status of[302,400,401,429,500]){let calls=0,cancelled=false;
  const client=createVirtualTryOnClient(env(),options(async()=>{calls++;return new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(KEY+PNG));},cancel(){cancelled=true;}}),{status,headers:{Location:'https://untrusted.example/steal'}});}));
  await expect(()=>client.run(input()),status===429?'provider_rate_limited':'provider_unavailable');assert.equal(calls,1);assert.equal(cancelled,true);
 }
});

test('timeout bounds headers and stalled bodies even when injected fetch ignores abort',async()=>{
 const {createVirtualTryOnClient}=await adapter;
 for(const stall of ['headers','body']){let calls=0,signal,cancelled=false;
  const client=createVirtualTryOnClient(env(),options(async(url,init)=>{calls++;signal=init.signal;if(stall==='headers')return new Promise(()=>{});return new Response(new ReadableStream({start(){},cancel(){cancelled=true;}}),{headers:{'Content-Type':'application/json'}});},{timeoutMs:10}));
  await assert.rejects(()=>client.run(input()),error=>error.code==='provider_timeout'&&error.billingMayHaveOccurred===true);assert.equal(signal.aborted,true);assert.equal(calls,1);if(stall==='body')assert.equal(cancelled,true);
 }
});

test('caller abort before submission is free; abort after submission is uncertain and never retries',async()=>{
 const {createVirtualTryOnClient}=await adapter;let calls=0;const stopped=new AbortController();stopped.abort();
 const client=createVirtualTryOnClient(env(),options(async()=>{calls++;return new Promise(()=>{});}));
 await expect(()=>client.run(input(),{signal:stopped.signal}),'request_aborted',499);assert.equal(client.usage().reservedMicroUsd,0);
 const active=new AbortController(),run=client.run(input(),{signal:active.signal});active.abort();
 await assert.rejects(()=>run,error=>error.code==='request_aborted'&&error.billingMayHaveOccurred===true);assert.equal(calls,1);assert.equal(client.usage().reservedMicroUsd,75000);
});

test('bounded status polling never submits another chargeable POST',async()=>{
 const {createVirtualTryOnClient}=await adapter;let posts=0,gets=0;
 const client=createVirtualTryOnClient(env(),options(async(url,init)=>{if(init.method==='POST'){posts++;return json({id:'fixture-prediction-id',error:null});}gets++;return json({id:'fixture-prediction-id',status:'processing',error:null});},{maxPolls:2}));
 await expect(()=>client.run(input()),'provider_poll_limit',504);assert.equal(posts,1);assert.equal(gets,2);
});

test('invalid IDs/output URLs, multiple outputs, excessive credits and provider messages never escape the adapter',async()=>{
 const {createVirtualTryOnClient}=await adapter;
 const invalid=[complete({id:'another-id'}),complete({output:['https://cdn.fashn.ai/output.png']}),complete({output:[PNG,PNG]}),complete({error:{message:KEY+PNG}}),complete({status:'failed',error:{message:KEY+PNG}})];
 for(const value of invalid){let posts=0;const client=createVirtualTryOnClient(env(),options(async(url,init)=>{if(init.method==='POST'){posts++;return json({id:'fixture-prediction-id',error:null});}return json(value);}));
  await assert.rejects(()=>client.run(input()),error=>{assert.ok(['provider_invalid_response','provider_generation_failed'].includes(error.code));assert.ok(!error.message.includes(KEY));assert.ok(!JSON.stringify(error).includes(PNG));return true;});assert.equal(posts,1);
 }
 for(const id of ['../private','id?token=secret','https://other.example/']){let calls=0;const client=createVirtualTryOnClient(env(),options(async()=>{calls++;return json({id,error:null});}));await expect(()=>client.run(input()),'provider_invalid_response');assert.equal(calls,1);}
 const billed=createVirtualTryOnClient(env(),options(async()=>json({id:'fixture-prediction-id',error:null},{'x-fashn-credits-used':'2'})));await expect(()=>billed.run(input()),'provider_billing_conflict');
});

test('configuration revocation and key changes stop future requests without disclosing secrets',async()=>{
 const {createVirtualTryOnClient}=await adapter;let calls=0;const current=env();
 const client=createVirtualTryOnClient(current,options(async(url,init)=>{calls++;return json(init.method==='POST'?{id:'fixture-prediction-id',error:null}:complete());},{maxCostUSD:.15}));
 await client.run(input());const before=calls;current.A1_VIRTUAL_TRYON_APPROVED='false';await expect(()=>client.run(input()),'tryon_not_configured');assert.equal(calls,before);
 current.A1_VIRTUAL_TRYON_APPROVED='true';current.FASHN_API_KEY='fixture-another-valid-key-1234';await expect(()=>client.run(input()),'tryon_not_configured');assert.equal(calls,before);
});

test('server transport refuses browser import rather than exposing a key path',()=>{
 const result=spawnSync(process.execPath,['--input-type=module','-e',"globalThis.window={}; await import('./server/virtual-tryon.mjs');"],{cwd:require('node:path').resolve(__dirname,'..'),encoding:'utf8'});
 assert.notEqual(result.status,0);assert.match(result.stderr,/server-only/);
});
