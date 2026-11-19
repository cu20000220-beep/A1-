'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('canonical loader preserves redirect protection and distinguishes real DOM AbortError timeout',async()=>{
 const source=fs.readFileSync(path.resolve(__dirname,'../assets/lab-loader.js'),'utf8'),calls=[];
 const window={A1Preview:{},A1I18n:{register(){}}};
 vm.runInNewContext(source,{window,AbortController,URL,location:{origin:'https://test.a1fashion.pages.dev'},setTimeout(fn){fn();return 1;},clearTimeout(){},fetch:async(url,options)=>{calls.push({url,options});assert.equal(options.signal.aborted,true);throw new DOMException('aborted','AbortError');}});
 await assert.rejects(window.A1LabTemplates.load('avatar'),e=>e.code==='TIMEOUT');assert.equal(calls[0].url,'/avatar-lab');assert.equal(calls[0].options.redirect,'error');assert.equal(calls[0].options.credentials,'omit');
});

test('the post-analysis natural viewer loads its reviewed canonical template without sending body data',async()=>{
 const source=fs.readFileSync(path.resolve(__dirname,'../assets/lab-loader.js'),'utf8'),calls=[],selected=[];
 const expected={id:'gltf-proof-root'},window={A1Preview:{},A1I18n:{register(){}}};
 vm.runInNewContext(source,{window,AbortController,URL,location:{origin:'https://test.a1fashion.pages.dev'},setTimeout,clearTimeout,
  DOMParser:class{parseFromString(text,type){assert.equal(type,'text/html');return{querySelector(selector){selected.push(selector);return expected;}};}},
  fetch:async(url,options)=>{calls.push({url,options});return{ok:true,url:'https://test.a1fashion.pages.dev/gltf-proof',headers:{get(){return'text/html; charset=utf-8';}},async text(){return'<main id="gltf-proof-root"></main>';}};}
 });
 assert.equal(await window.A1LabTemplates.load('natural'),expected);
 assert.deepEqual(selected,['#gltf-proof-root']);assert.equal(calls.length,1);assert.equal(calls[0].url,'/gltf-proof');
 assert.equal(calls[0].options.redirect,'error');assert.equal(calls[0].options.credentials,'omit');
 assert.equal(calls[0].options.body,undefined);assert.equal(calls[0].options.method,undefined);
});

for(const [name,response,expectedCode]of[
 ['unsuccessful template',{ok:false,status:503},'HTTP'],
 ['JSON replacing HTML',{ok:true,mime:'application/json'},'MIME'],
 ['cross-origin response',{ok:true,url:'https://other.example/gltf-proof'},'REQUEST'],
 ['response with private query',{ok:true,url:'https://test.a1fashion.pages.dev/gltf-proof?photo=forbidden'},'REQUEST']
])test('natural viewer rejects '+name,async()=>{
 const source=fs.readFileSync(path.resolve(__dirname,'../assets/lab-loader.js'),'utf8'),window={A1Preview:{},A1I18n:{register(){}}};
 vm.runInNewContext(source,{window,AbortController,URL,location:{origin:'https://test.a1fashion.pages.dev'},setTimeout,clearTimeout,
  fetch:async()=>({url:'https://test.a1fashion.pages.dev/gltf-proof',headers:{get(){return response.mime||'text/html';}},...response})});
 await assert.rejects(window.A1LabTemplates.load('natural'),error=>error.code===expectedCode);
});
