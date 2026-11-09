'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('canonical loader preserves redirect protection and distinguishes real DOM AbortError timeout',async()=>{
 const source=fs.readFileSync(path.resolve(__dirname,'../assets/lab-loader.js'),'utf8'),calls=[];
 const window={A1Preview:{},A1I18n:{register(){}}};
 vm.runInNewContext(source,{window,AbortController,URL,location:{origin:'https://test.a1fashion.pages.dev'},setTimeout(fn){fn();return 1;},clearTimeout(){},fetch:async(url,options)=>{calls.push({url,options});assert.equal(options.signal.aborted,true);throw new DOMException('aborted','AbortError');}});
 await assert.rejects(window.A1LabTemplates.load('avatar'),e=>e.code==='TIMEOUT');assert.equal(calls[0].url,'/avatar-lab');assert.equal(calls[0].options.redirect,'error');assert.equal(calls[0].options.credentials,'omit');
});
