'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const M=require('../assets/product-images.js'),D=require('../assets/product-discovery.js');
const {validateLocalCopies}=require('../scripts/lib/product-image-store.cjs');
const published=()=>JSON.parse(fs.readFileSync(require.resolve('../assets/product-images.json'),'utf8'));
// Mutation fixtures explicitly model unverified remote references, regardless
// of whether the real catalog has subsequently cached authorized local files.
const raw=()=>{const data=published();data.products=data.products.map(entry=>({...entry,imageUrl:entry.sourceImageUrl,delivery:'remote-reference',sha256:null,bytes:null,width:null,height:null,imageKind:'unverified'}));return data;};
const observations=()=>JSON.parse(fs.readFileSync(require.resolve('../assets/observed-products.json'),'utf8'));
// Pin the shipped record tests within the audited period so that a later,
// correctly expired grant does not fail these structural assertions.
const auditedManifest=published();
const auditedAt=Math.max(observations().observedAt,auditedManifest.authorization.recordedAt,...auditedManifest.products.map(entry=>entry.checkedAt));
assert.ok(auditedAt<auditedManifest.authorization.validUntil);
const validateManifest=(data,facts,options={now:auditedAt})=>M.validateManifest(data,facts,options);
const displayProduct=(data,facts,id,options={now:auditedAt})=>M.displayProduct(data,facts,id,options);
const fittingProduct=(data,facts,id,options={now:auditedAt})=>M.fittingProduct(data,facts,id,options);
function stockFixture(id,stock='in_stock',checkedAt=auditedAt){
 const facts=observations();facts.observedAt=Math.max(facts.observedAt,checkedAt);
 Object.assign(facts.products.find(row=>row.id===id),{stock,checkedAt});
 return facts;
}
test('published images bind operator authorization to actual product pages and any local copy to its real bytes',()=>{
 const data=published(),facts=observations(),entries=validateManifest(data,facts);assert.ok(entries.length>=9);assert.ok(D.validateSnapshot(facts).length>=10);
 assert.equal(data.authorization.basis,'operator-attestation');assert.equal(data.authorization.externalProcessing,false);
 for(const entry of entries){if(entry.delivery==='remote-reference'){assert.equal(entry.imageUrl,entry.sourceImageUrl);for(const key of ['sha256','bytes','width','height'])assert.equal(entry[key],null);}assert.ok(Object.isFrozen(entry));}
 assert.equal(validateLocalCopies(path.resolve(__dirname,'..'),entries).length,entries.filter(entry=>entry.delivery==='local-copy').length);
 assert.equal(entries.some(e=>e.id.startsWith('uniqlo-')),false,'an ambiguous color must never receive another variant image');
});
test('authorized original display keeps unknown stock and prices but cannot grant fitting eligibility',()=>{
 const data=raw(),facts=observations(),id='musinsa-1168906',p=displayProduct(data,facts,id);
 assert.ok(p);assert.equal(p.stock,'unknown');assert.equal(p.authorizationBasis,'operator-attestation');assert.equal(p.sourceKind,'operator-authorized-observation');assert.equal(p.price,49900);assert.equal(Object.hasOwn(p,'fittingImageUrl'),false);assert.equal(Object.hasOwn(p,'sourceVerified'),false);
 const unknown=displayProduct(data,facts,'29cm-3423465');assert.equal(unknown.price,null);assert.equal(unknown.stock,'unknown');
 assert.equal(fittingProduct(data,facts,id),null);assert.equal(fittingProduct(data,facts,'29cm-3423465'),null);
 assert.equal(JSON.parse(fs.readFileSync(require.resolve('../assets/approved-products.json'))).products.length,0);
});
test('fitting resolves the original image of the exact fresh in-stock item only while both windows are valid',()=>{
 const data=raw(),id='musinsa-1168906',facts=stockFixture(id),photo=data.products.find(entry=>entry.id===id);
 const p=fittingProduct(data,facts,id);assert.ok(p);assert.equal(p.stock,'in_stock');assert.equal(p.id,id);
 assert.equal(p.productUrl,photo.productUrl);assert.equal(p.fittingImageUrl,photo.imageUrl);
 assert.equal(p.expiresAt,Math.min(auditedAt+24*3600000,data.authorization.validUntil));
 assert.equal(fittingProduct(data,facts,'29cm-3423465'),null);
 const now=auditedAt,expiredStock=stockFixture(id,'in_stock',now-24*3600000);
 assert.ok(displayProduct(data,expiredStock,id));assert.equal(fittingProduct(data,expiredStock,id),null);
 assert.ok(fittingProduct(data,stockFixture(id,'in_stock',now-24*3600000+1),id));
 const until=now+1000;
 const shortGrant={...data,authorization:{...data.authorization,validUntil:until}};
 assert.equal(fittingProduct(shortGrant,facts,id).expiresAt,until);
 assert.equal(displayProduct(shortGrant,facts,id,{now:until}),null);
 assert.equal(fittingProduct(shortGrant,facts,id,{now:until}),null);
});
test('missing, changed and duplicate product identities cannot acquire a fitting image',()=>{
 const id='musinsa-1168906',facts=stockFixture(id);
 for(const mutate of [d=>d.products[0].id='missing',d=>d.products[0].productUrl='https://www.musinsa.com/products/9999999',d=>d.products.push({...d.products[0]})]){
  const data=raw();mutate(data);assert.throws(()=>validateManifest(data,facts));assert.equal(displayProduct(data,facts,id),null);assert.equal(fittingProduct(data,facts,id),null);
 }
 assert.equal(fittingProduct(raw(),observations(),'missing'),null);
});
test('remote image paths allow only the exact two CDN schemas and bounded non-private transforms',()=>{
 for(const e of raw().products)assert.equal(M.safeRemoteImageUrl(e.sourceImageUrl),true);
 for(const value of ['http://image.msscdn.net/x.jpg','https://image.msscdn.net.evil.test/a.jpg','https://user:pass@image.msscdn.net/a.jpg','https://img.29cm.co.kr/item/202508/file.png?token=private','data:image/png;base64,private','https://127.0.0.1/a.jpg','https://img.29cm.co.kr/item/202508/abcdef0123456789.png?format=webp&width=700&photo=private','https://image.msscdn.net/thumbnails/images/goods_img/20190927/1168906/1.jpg?w=1200&w=700'])assert.equal(M.safeRemoteImageUrl(value),false,value);
});
test('operator attestation cannot silently authorize external photo processing or private fields',()=>{
 for(const mutate of [d=>d.authorization.externalProcessing=true,d=>d.authorization.display=false,d=>d.authorization.local2DFitting=false,d=>d.authorization.basis='merchant-contract-verified',d=>d.authorization.apiKey='PRIVATE',d=>d.products[0].photo='PRIVATE']){const d=raw();mutate(d);assert.throws(()=>validateManifest(d,observations()));}
});
test('unverified remote references cannot claim a byte hash, dimensions or a copied local image',()=>{
 for(const patch of [{sha256:'a'.repeat(64)},{bytes:1000},{width:700},{height:900},{imageUrl:'/assets/catalog-images/musinsa-996498.jpg'}]){const d=raw();Object.assign(d.products[0],patch);assert.throws(()=>validateManifest(d,observations()));}
});
test('local copies require a product-bound safe path and complete bounded byte evidence',()=>{
 const d=raw(),e=d.products[0];Object.assign(e,{delivery:'local-copy',imageUrl:'/assets/catalog-images/'+e.id+'.jpg',sha256:'a'.repeat(64),bytes:1000,width:500,height:1000});assert.equal(validateManifest(d,observations())[0].delivery,'local-copy');
 for(const patch of [{imageUrl:'/assets/catalog-images/other-product.jpg'},{imageUrl:'/assets/catalog-images/../private.jpg'},{bytes:6000001},{width:30000001},{sha256:null}]){const changed=structuredClone(d);Object.assign(changed.products[0],patch);assert.throws(()=>validateManifest(changed,observations()));}
});
test('expired or future authorizations do not expose fitting and never override sold-out status',()=>{
 const d=raw(),id=d.products[0].id,facts=stockFixture(id,'in_stock',d.authorization.validUntil-1000);
 assert.equal(fittingProduct(d,facts,id,{now:d.authorization.validUntil}),null);
 const future=structuredClone(d);future.authorization.recordedAt=auditedAt+60000;assert.throws(()=>validateManifest(future,facts));
 const soldOut=stockFixture(id,'out_of_stock');assert.ok(displayProduct(d,soldOut,id));assert.equal(fittingProduct(d,soldOut,id),null);
});
test('an explicitly empty published manifest needs no current authorization and cannot grant image access',()=>{
 const empty={version:1,authorization:null,products:[]},facts=observations(),now=auditedManifest.authorization.validUntil;
 assert.deepEqual(validateManifest(empty,facts,{now}),[]);
 assert.equal(fittingProduct(empty,facts,'musinsa-1168906',{now}),null);
 assert.throws(()=>validateManifest({...empty,products:raw().products},facts,{now}));
 assert.throws(()=>validateManifest(auditedManifest,facts,{now}),{message:'product_image_authorization_expired'});
});
