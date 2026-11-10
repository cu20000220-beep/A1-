'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {catalogPublicHeaders}=require('../scripts/lib/catalog-public-headers.cjs'),template=fs.readFileSync(path.resolve(__dirname,'../_headers'),'utf8');
test('empty catalog leaves all deployed policies unchanged; reviewed images extend only stylist img-src',()=>{
 assert.equal(catalogPublicHeaders(template,[]),template);
 const product={sourceVerified:true,imageUrl:'https://images.example.test/approved.jpg'},actual=catalogPublicHeaders(template,[product,product,{...product,imageUrl:'https://brand.example.test/photo.jpg'}]);
 const policy=actual.split('/stylist*\n')[1].split('\n\n')[0];assert.match(policy,/img-src 'self' https:\/\/brand\.example\.test https:\/\/images\.example\.test;/);assert.match(policy,/connect-src 'self';/);assert.match(policy,/script-src 'self';/);
 assert.equal(actual.replace("img-src 'self' https://brand.example.test https://images.example.test;","img-src 'self';"),template,'no unrelated policy, API or frame rule is relaxed');
});
test('unreviewed, fixture, non-HTTPS and unsafe image origins cannot expand the policy',()=>{
 for(const patch of [{sourceVerified:false},{fixture:true},{demo:true},{imageUrl:'http://images.example.test/item.jpg'},{imageUrl:'https://user@images.example.test/item.jpg'},{imageUrl:'https://images.example.test:8443/item.jpg'},{imageUrl:'https://127.0.0.1/item.jpg'},{imageUrl:'https://images.example.test/item.jpg#fragment'}])assert.throws(()=>catalogPublicHeaders(template,[{sourceVerified:true,imageUrl:'https://images.example.test/item.jpg',...patch}]));
 assert.throws(()=>catalogPublicHeaders(template.replace('/stylist*','/other*'),[{sourceVerified:true,imageUrl:'https://images.example.test/item.jpg'}]));
});
