'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {catalogPublicHeaders}=require('../scripts/lib/catalog-public-headers.cjs'),template=fs.readFileSync(path.resolve(__dirname,'../_headers'),'utf8');
test('empty catalog leaves policies unchanged; reviewed display images reach all catalog entry points',()=>{
 assert.equal(catalogPublicHeaders(template,[]),template);
 const product={sourceVerified:true,imageUrl:'https://images.example.test/approved.jpg'},actual=catalogPublicHeaders(template,[product,product,{...product,imageUrl:'https://brand.example.test/photo.jpg'}]);
 const policy=actual.split('/stylist*\n')[1].split('\n\n')[0];assert.match(policy,/img-src 'self' https:\/\/brand\.example\.test https:\/\/images\.example\.test;/);assert.match(policy,/connect-src 'self';/);assert.match(policy,/script-src 'self';/);
 for(const route of ['/product-lab*','/fitting-studio*']){const section=actual.split(route+'\n')[1].split('\n\n')[0];assert.match(section,/img-src 'self' blob: https:\/\/brand\.example\.test https:\/\/images\.example\.test;/);assert.match(section,/connect-src 'self';/);}
 const restored=actual.replaceAll("img-src 'self' https://brand.example.test https://images.example.test;","img-src 'self';").replaceAll("img-src 'self' blob: https://brand.example.test https://images.example.test;","img-src 'self' blob:;");
 assert.equal(restored,template,'no unrelated policy, API or frame rule is relaxed');
});
test('unreviewed, fixture, non-HTTPS and unsafe image origins cannot expand the policy',()=>{
 for(const patch of [{sourceVerified:false},{fixture:true},{demo:true},{imageUrl:'http://images.example.test/item.jpg'},{imageUrl:'https://user@images.example.test/item.jpg'},{imageUrl:'https://images.example.test:8443/item.jpg'},{imageUrl:'https://127.0.0.1/item.jpg'},{imageUrl:'https://images.example.test/item.jpg#fragment'}])assert.throws(()=>catalogPublicHeaders(template,[{sourceVerified:true,imageUrl:'https://images.example.test/item.jpg',...patch}]));
 assert.throws(()=>catalogPublicHeaders(template.replace('/stylist*','/other*'),[{sourceVerified:true,imageUrl:'https://images.example.test/item.jpg'}]));
});
test('only separately reviewed fitting images extend the fitting image policy; API and script policies stay unchanged',()=>{
 const p={sourceVerified:true,imageUrl:'https://images.example.test/item.jpg',fittingImageUrl:'https://fitting.example.test/cutout.png',fittingRightsVerified:true};const actual=catalogPublicHeaders(template,[p]);
 for(const route of ['/product-lab*','/fitting-studio*']){const fitting=actual.split(route+'\n')[1].split('\n\n')[0];assert.match(fitting,/img-src 'self' blob: https:\/\/fitting\.example\.test https:\/\/images\.example\.test;/);assert.match(fitting,/connect-src 'self';/);assert.match(fitting,/script-src 'self' 'wasm-unsafe-eval';/);}
 const stylist=actual.split('/stylist*\n')[1].split('\n\n')[0];assert.ok(!stylist.includes('https://fitting.example.test'),'display permission does not allow stylist fitting image loads');
 assert.throws(()=>catalogPublicHeaders(template,[{...p,fittingRightsVerified:false}]));assert.throws(()=>catalogPublicHeaders(template,[{...p,fittingImageUrl:'http://fitting.example.test/item.png'}]));
});
test('operator-authorized product photos extend only img-src to exact reviewed CDN origins',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../assets/product-images.json'),'utf8')),observations=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../assets/observed-products.json'),'utf8'));
 const actual=catalogPublicHeaders(template,[],{manifest,observations});
 for(const route of ['/stylist*','/product-lab*','/fitting-studio*']){
  const section=actual.split(route+'\n')[1].split('\n\n')[0];assert.match(section,/img-src[^;]*https:\/\/image\.msscdn\.net https:\/\/img\.29cm\.co\.kr;/);assert.match(section,/connect-src 'self';/);
 }
 const restored=actual.replaceAll(' https://image.msscdn.net https://img.29cm.co.kr;',';');assert.equal(restored,template,'no API, script, payment, account or image-upload policy is relaxed');
 const changed=structuredClone(manifest);changed.products[0].imageUrl='https://unreviewed.test/picture.jpg';assert.throws(()=>catalogPublicHeaders(template,[],{manifest:changed,observations}));
});
