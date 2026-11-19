'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const read=name=>fs.readFileSync(path.resolve(__dirname,'../assets/'+name),'utf8');
const coreSource=read('local-fashion-core.js'),bootstrapSource=read('public-beta-bootstrap.js');
const validPolicy={freeBetaMode:true,billingEnabled:false,accountRequiredForSaving:true};
const metrics={shoulderHipRatio:1.2,legTorsoRatio:1.8};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
class Events{
 constructor(){this.listeners=new Map();this.events=[];}
 addEventListener(type,handler,options){const list=this.listeners.get(type)||[];list.push({handler,once:options?.once});this.listeners.set(type,list);}
 removeEventListener(type,handler){this.listeners.set(type,(this.listeners.get(type)||[]).filter(row=>row.handler!==handler));}
 dispatchEvent(event){this.events.push(event);for(const row of [...(this.listeners.get(event.type)||[])]){if(!(this.listeners.get(event.type)||[]).includes(row))continue;if(row.once)this.removeEventListener(event.type,row.handler);row.handler(event);}return true;}
}
function response(policy=validPolicy,overrides={}){
 return {status:200,ok:true,redirected:false,url:'https://a1fashion.pages.dev/api/policy',headers:{get:()=> 'application/json; charset=utf-8'},json:async()=>policy,...overrides};
}
function load({host='a1fashion.pages.dev',origin='https://'+host,fetchImpl=async()=>response(),globals={},withCore=true,readyState='complete'}={}){
 const window=Object.assign(new Events(),globals),document=new Events(),calls=[],timers=new Map(),warnings=[];
 let timerId=0,reloads=0;
 const result={hidden:false,isConnected:true,parentHidden:false,rects:1,closest(){return this.parentHidden?{}:null;},getClientRects(){return Array(this.rects).fill({});}};
 document.result=result;document.readyState=readyState;document.querySelector=selector=>selector==='#ai-result'?document.result:null;
 document.createElement=tag=>({tagName:tag});
 window.A1I18n={language:'ko',register(){},t:value=>value,setText(element,value){element.textContent=value;}};
 const noStorage=new Proxy({},{get(){throw Error('No browser storage may be read');},set(){throw Error('No browser storage may be written');}});
 Object.defineProperty(document,'cookie',{get(){throw Error('No cookies may be read');},set(){throw Error('No cookies may be written');}});
 const context={window,document,URL,URLSearchParams,AbortController,location:{hostname:host,origin,reload(){reloads++;}},
  console:{warn:value=>warnings.push(value)},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},
  localStorage:noStorage,sessionStorage:noStorage,
  setTimeout(callback,delay){const id=++timerId;timers.set(id,{callback,delay});return id;},clearTimeout(id){timers.delete(id);},
  fetch(url,options){calls.push({url,options});return fetchImpl(url,options);}};
 if(withCore)vm.runInNewContext(coreSource,context);
 vm.runInNewContext(bootstrapSource,context);
 return {window,document,calls,timers,warnings,result,get reloads(){return reloads;},runAgain:()=>vm.runInNewContext(bootstrapSource,context),
  emit:(type,detail)=>document.dispatchEvent({type,detail}),page:(type,fields={})=>window.dispatchEvent({type,...fields})};
}
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
test('shared core creates the same frozen local helpers without granting rights or making requests',async()=>{
 const f=load({fetchImpl:async()=>response({...validPolicy,freeBetaMode:false})});await flush();
 const factory=f.window.A1LocalFashionCore;
 assert.equal(Object.isFrozen(factory),true);assert.equal(Object.getOwnPropertyDescriptor(f.window,'A1LocalFashionCore').configurable,false);
 for(const scope of ['preview','public-beta']){
  const core=factory.create({I:f.window.A1I18n,scope});
  assert.equal(Object.isFrozen(core),true);assert.equal(Object.isFrozen(core.pairs),true);assert.equal(Object.isFrozen(core.pairs.privacy),true);assert.equal(Object.isFrozen(core.stores),true);assert.equal(Object.isFrozen(core.stores[0]),true);
  assert.deepEqual(Object.keys(core).sort(),['retailers','retailerActions','consult','safeLink','validMetrics','t','tx','source','node','links','stores','pairs'].sort());
  const answer=core.consult({message:'office outfit',language:'en',intent:'style',preferences:{country:'US'},consents:{analysis:false}});
  assert.equal(answer.mode,'DEMO');assert.equal(answer.products.length,0);assert.equal(answer.discounts.length,0);assert.equal(answer.usage,null);
  assert.equal(core.retailers({country:'KR'}).retailers.length,5);
  assert.match(core.source('notice'),scope==='preview'?/미리보기 체험/:/서버 정책/);
  assert.match(core.source('account'),scope==='preview'?/회원·찜 저장·알림에 연결하지 않습니다/:/서버에서 확인/);
  assert.throws(()=>{core.stores[0][2]='https://attacker.test';},TypeError);
 }
 assert.throws(()=>factory.create({I:f.window.A1I18n,scope:'member'}));
 assert.equal(f.calls.length,1);assert.equal(f.window.A1PublicBeta,undefined);
});
test('only the strict server policy publishes immutable local beta once, using a fixed credential-free GET',async()=>{
 const pending=deferred(),f=load({fetchImpl:()=>pending.promise,globals:{A1_FREE_BETA_MODE:true,freeBetaMode:true}});
 assert.equal(f.window.A1PublicBeta,undefined);
 f.emit('a1:policy-ready',{freeBetaMode:true});f.emit('a1:public-beta-ready',{freeBetaMode:true});
 assert.equal(f.window.A1PublicBeta,undefined);assert.throws(()=>{f.window.A1PublicBeta={mode:'server-free-beta-local'};},TypeError);
 const call=f.calls[0];assert.equal(call.url,'/api/policy');
 for(const [key,value]of Object.entries({method:'GET',credentials:'omit',cache:'no-store',redirect:'error',mode:'same-origin'}))assert.equal(call.options[key],value);
 assert.equal(call.options.headers.Accept,'application/json');assert.equal(call.options.signal.aborted,false);
 const before=f.document.events.length;pending.resolve(response());await flush();
 const api=f.window.A1PublicBeta;assert.equal(api.mode,'server-free-beta-local');assert.equal(Object.isFrozen(api),true);assert.equal(f.window.A1Preview,undefined);
 assert.equal(f.document.events.slice(before).filter(event=>event.type==='a1:public-beta-ready').length,1);
 const descriptor=Object.getOwnPropertyDescriptor(f.window,'A1PublicBeta');assert.equal(descriptor.configurable,false);assert.equal(descriptor.set,undefined);
 assert.throws(()=>{api.mode='member';},TypeError);assert.throws(()=>{delete f.window.A1PublicBeta;},TypeError);
 f.runAgain();await flush();assert.equal(f.calls.length,1);assert.equal(f.timers.size,0);
});
test('false, malformed, extended and client-only policies fail closed',async()=>{
 for(const policy of [null,[],{},false,{...validPolicy,freeBetaMode:false},{...validPolicy,freeBetaMode:'true'},
  {...validPolicy,billingEnabled:true},{...validPolicy,accountRequiredForSaving:false},{...validPolicy,plan:'PREMIUM'},
  {freeBetaMode:true,billingEnabled:false}]){
  const f=load({fetchImpl:async()=>response(policy),globals:{A1_FREE_BETA_MODE:'true'}});
  f.emit('a1:policy-ready',{freeBetaMode:true});f.emit('a1:analysis-ready',{metrics});await flush();
  assert.equal(f.window.A1PublicBeta,undefined);assert.equal(f.document.events.filter(event=>event.type==='a1:public-beta-ready').length,0);assert.equal(f.timers.size,0);
 }
});
test('network, JSON, MIME, status, redirect and response URL failures cannot publish local beta',async()=>{
 const failures=[async()=>{throw Error('offline');},
  async()=>response(validPolicy,{json:async()=>{throw Error('invalid JSON');}}),
  async()=>response(validPolicy,{headers:{get:()=> 'text/html'}}),
  async()=>response(validPolicy,{headers:{get:()=> 'application/jsonp'}}),
  async()=>response(validPolicy,{status:201}),async()=>response(validPolicy,{ok:false}),async()=>response(validPolicy,{redirected:true}),
  ...['','https://attacker.test/api/policy','https://a1fashion.pages.dev/api/policy?enabled=true','https://a1fashion.pages.dev/api/policy/','https://preview.a1fashion.pages.dev/api/policy'].map(url=>async()=>response(validPolicy,{url}))];
 for(const fetchImpl of failures){const f=load({fetchImpl});await flush();assert.equal(f.window.A1PublicBeta,undefined);assert.equal(f.document.events.filter(event=>event.type==='a1:public-beta-ready').length,0);}
});
test('Preview, unknown hosts and missing dependencies issue no bootstrap GET',async()=>{
 for(const host of ['preview.a1fashion.pages.dev','34004414.a1fashion.pages.dev','localhost','a1fashion.pages.dev.attacker.test','a.b.a1fashion.pages.dev','a1fashion.pages.dev.']){
  const f=load({host});await flush();assert.equal(f.calls.length,0);assert.equal(f.window.A1PublicBeta,undefined);
 }
 for(const options of [{origin:'http://a1fashion.pages.dev'},{withCore:false}]){const f=load(options);await flush();assert.equal(f.calls.length,0);assert.equal(f.window.A1PublicBeta,undefined);}
 const f=load({globals:{A1PublicBeta:Object.freeze({mode:'client-fake'})}});await flush();assert.equal(f.calls.length,0);assert.equal(f.warnings.length,1);assert.equal(f.document.events.length,0);
});
test('policy timeout aborts and ignores late success',async()=>{
 const pending=deferred(),f=load({fetchImpl:()=>pending.promise});f.emit('a1:analysis-ready',{metrics});
 const deadline=[...f.timers.values()][0];assert.equal(deadline.delay,5000);deadline.callback();
 assert.equal(f.calls[0].options.signal.aborted,true);pending.resolve(response());await flush();
 assert.equal(f.window.A1PublicBeta,undefined);assert.equal(f.document.events.filter(event=>event.type==='a1:public-beta-ready').length,0);assert.equal(f.timers.size,0);
});
test('current early metrics replay after ready listeners initialize, with no other event data',async()=>{
 const pending=deferred(),f=load({fetchImpl:()=>pending.promise}),received=[],order=[];
 f.document.addEventListener('a1:public-beta-ready',()=>{order.push('ready');f.document.addEventListener('a1:analysis-ready',event=>{order.push('analysis');received.push(event.detail);});});
 f.emit('a1:analysis-ready',{metrics,photo:'PRIVATE-PHOTO',rawText:'PRIVATE-TEXT'});pending.resolve(response());await flush();
 assert.deepEqual(order,['ready','analysis']);assert.equal(received.length,1);assert.deepEqual(Object.keys(received[0]),['metrics']);assert.deepEqual(Object.keys(received[0].metrics).sort(),Object.keys(metrics).sort());
 assert.equal(JSON.stringify(received[0].metrics),JSON.stringify(metrics));assert.equal(Object.isFrozen(received[0]),true);assert.equal(Object.isFrozen(received[0].metrics),true);
 assert.doesNotMatch(JSON.stringify(received),/PRIVATE|photo|rawText/);
});
test('policy publication waits for deferred consumers at DOMContentLoaded and aborts that wait on pagehide',async()=>{
 for(const readyState of ['loading','interactive'])for(const hide of [false,true]){
  const f=load({readyState}),received=[];f.emit('a1:analysis-ready',{metrics});await flush();
  assert.equal(f.window.A1PublicBeta,undefined);
  f.document.addEventListener('a1:public-beta-ready',()=>f.document.addEventListener('a1:analysis-ready',event=>received.push(event.detail.metrics)));
  if(hide)f.page('pagehide');
  f.document.readyState='interactive';f.emit('DOMContentLoaded');await flush();
  assert.equal(Boolean(f.window.A1PublicBeta),!hide);assert.equal(received.length,hide?0:1);assert.equal(f.timers.size,0);
 }
});
test('a DOMContentLoaded event while policy is pending is remembered even while readyState remains interactive',async()=>{
 const pending=deferred(),f=load({readyState:'interactive',fetchImpl:()=>pending.promise});
 f.emit('DOMContentLoaded');pending.resolve(response());await flush();assert.equal(f.window.A1PublicBeta.mode,'server-free-beta-local');assert.equal(f.timers.size,0);
});
test('clear, revoke, auth changes, invalid metrics and hidden or replaced results discard pending replay',async()=>{
 const changes=[f=>f.emit('a1:analysis-cleared',{reason:'user'}),f=>f.emit('a1:analysis-revoked'),f=>f.emit('a1:auth-changed'),f=>f.page('storage',{key:'a1-fashion:auth-event'}),
  f=>f.emit('a1:analysis-ready',{metrics:{...metrics,photo:'PRIVATE'}}),f=>{f.result.hidden=true;},f=>{f.result.isConnected=false;},f=>{f.result.parentHidden=true;},f=>{f.result.rects=0;},f=>{f.document.result={...f.result};}];
 for(const change of changes){
  const pending=deferred(),f=load({fetchImpl:()=>pending.promise}),received=[];
  f.document.addEventListener('a1:public-beta-ready',()=>f.document.addEventListener('a1:analysis-ready',event=>received.push(event)));
  f.emit('a1:analysis-ready',{metrics});change(f);pending.resolve(response());await flush();
  assert.equal(f.window.A1PublicBeta.mode,'server-free-beta-local');assert.equal(received.length,0);
 }
});
test('a newer analysis or clear during ready listeners prevents stale replay',async()=>{
 for(const type of ['a1:analysis-ready','a1:analysis-cleared']){
  const pending=deferred(),f=load({fetchImpl:()=>pending.promise}),received=[];
  f.document.addEventListener('a1:public-beta-ready',()=>{
   f.document.addEventListener('a1:analysis-ready',event=>received.push(event.detail.metrics));
   f.emit(type,{metrics:{shoulderHipRatio:1.5,legTorsoRatio:2}});
  });
  f.emit('a1:analysis-ready',{metrics});pending.resolve(response());await flush();
  assert.equal(received.length,type==='a1:analysis-ready'?1:0);
  if(received.length)assert.equal(received[0].shoulderHipRatio,1.5);
 }
});
test('pagehide aborts pending policy, revokes exposure and BFCache restoration reloads for fresh policy',async()=>{
 for(const earlySuccess of [false,true]){
  const pending=deferred(),f=load({fetchImpl:()=>pending.promise});f.emit('a1:analysis-ready',{metrics});
  if(earlySuccess){pending.resolve(response());await flush();assert.ok(f.window.A1PublicBeta);}
  f.page('pagehide');assert.equal(f.window.A1PublicBeta,undefined);assert.equal(f.calls[0].options.signal.aborted,true);assert.equal(f.timers.size,0);
  if(!earlySuccess){pending.resolve(response());await flush();assert.equal(f.document.events.filter(event=>event.type==='a1:public-beta-ready').length,0);}
  f.page('pageshow',{persisted:true});assert.equal(f.reloads,1);assert.equal(f.window.A1PublicBeta,undefined);assert.equal(f.calls.length,1);
 }
});
