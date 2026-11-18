'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const M=require('../assets/product-images.js'),D=require('../assets/product-discovery.js');
const raw=()=>JSON.parse(fs.readFileSync(require.resolve('../assets/product-images.json'),'utf8'));
const observations=()=>JSON.parse(fs.readFileSync(require.resolve('../assets/observed-products.json'),'utf8'));
test('official image references bind operator authorization to nine actual product pages without inventing copied bytes',()=>{
 const data=raw(),facts=observations(),entries=M.validateManifest(data,facts);assert.equal(entries.length,9);assert.equal(D.validateSnapshot(facts).length,10);
 assert.equal(data.authorization.basis,'operator-attestation');assert.equal(data.authorization.externalProcessing,false);
 for(const entry of entries){assert.equal(entry.delivery,'remote-reference');assert.equal(entry.imageUrl,entry.sourceImageUrl);for(const key of ['sha256','bytes','width','height'])assert.equal(entry[key],null);assert.equal(entry.imageKind,'unverified');assert.ok(Object.isFrozen(entry));}
 assert.equal(entries.some(e=>e.id.startsWith('uniqlo-')),false,'an ambiguous color must never receive another variant image');
});
test('fitting selection keeps unknown stock and prices and never turns a photo reference into an approved supplier feed',()=>{
 const data=raw(),facts=observations(),p=M.fittingProduct(data,facts,'musinsa-1168906');assert.ok(p);assert.equal(p.stock,'unknown');assert.equal(p.authorizationBasis,'operator-attestation');assert.equal(p.sourceKind,'operator-authorized-observation');assert.equal(p.price,49900);assert.equal(p.fittingImageUrl,p.imageUrl);assert.equal(Object.hasOwn(p,'sourceVerified'),false);
 const unknown=M.fittingProduct(data,facts,'29cm-3423465');assert.equal(unknown.price,null);assert.equal(unknown.stock,'unknown');assert.equal(JSON.parse(fs.readFileSync(require.resolve('../assets/approved-products.json'))).products.length,0);
});
test('missing, changed and duplicate product identities cannot acquire a fitting image',()=>{
 for(const mutate of [d=>d.products[0].id='missing',d=>d.products[0].productUrl='https://www.musinsa.com/products/9999999',d=>d.products.push({...d.products[0]})]){const d=raw();mutate(d);assert.throws(()=>M.validateManifest(d,observations()));assert.equal(M.fittingProduct(d,observations(),'musinsa-1168906'),null);}
 assert.equal(M.fittingProduct(raw(),observations(),'missing'),null);
});
test('remote image paths allow only the exact two CDN schemas and bounded non-private transforms',()=>{
 for(const e of raw().products)assert.equal(M.safeRemoteImageUrl(e.sourceImageUrl),true);
 for(const value of ['http://image.msscdn.net/x.jpg','https://image.msscdn.net.evil.test/a.jpg','https://user:pass@image.msscdn.net/a.jpg','https://img.29cm.co.kr/item/202508/file.png?token=private','data:image/png;base64,private','https://127.0.0.1/a.jpg','https://img.29cm.co.kr/item/202508/abcdef0123456789.png?format=webp&width=700&photo=private','https://image.msscdn.net/thumbnails/images/goods_img/20190927/1168906/1.jpg?w=1200&w=700'])assert.equal(M.safeRemoteImageUrl(value),false,value);
});
test('operator attestation cannot silently authorize external photo processing or private fields',()=>{
 for(const mutate of [d=>d.authorization.externalProcessing=true,d=>d.authorization.display=false,d=>d.authorization.local2DFitting=false,d=>d.authorization.basis='merchant-contract-verified',d=>d.authorization.apiKey='PRIVATE',d=>d.products[0].photo='PRIVATE']){const d=raw();mutate(d);assert.throws(()=>M.validateManifest(d,observations()));}
});
test('unverified remote references cannot claim a byte hash, dimensions or a copied local image',()=>{
 for(const patch of [{sha256:'a'.repeat(64)},{bytes:1000},{width:700},{height:900},{imageUrl:'/assets/catalog-images/musinsa-996498.jpg'}]){const d=raw();Object.assign(d.products[0],patch);assert.throws(()=>M.validateManifest(d,observations()));}
});
test('local copies require a product-bound safe path and complete bounded byte evidence',()=>{
 const d=raw(),e=d.products[0];Object.assign(e,{delivery:'local-copy',imageUrl:'/assets/catalog-images/'+e.id+'.jpg',sha256:'a'.repeat(64),bytes:1000,width:500,height:1000});assert.equal(M.validateManifest(d,observations())[0].delivery,'local-copy');
 for(const patch of [{imageUrl:'/assets/catalog-images/other-product.jpg'},{imageUrl:'/assets/catalog-images/../private.jpg'},{bytes:6000001},{width:30000001},{sha256:null}]){const changed=structuredClone(d);Object.assign(changed.products[0],patch);assert.throws(()=>M.validateManifest(changed,observations()));}
});
test('expired or future authorizations do not expose fitting and never override sold-out status',()=>{
 const d=raw(),facts=observations();assert.equal(M.fittingProduct(d,facts,d.products[0].id,{now:d.authorization.validUntil}),null);
 const future=structuredClone(d);future.authorization.recordedAt=Date.now()+60000;assert.throws(()=>M.validateManifest(future,facts));
 facts.products.find(p=>p.id===d.products[0].id).stock='out_of_stock';assert.equal(M.fittingProduct(d,facts,d.products[0].id),null);
});
