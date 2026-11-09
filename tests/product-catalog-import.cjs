'use strict';
// Synthetic local fixtures exercise validation; none are registered/published.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const C=require('../scripts/lib/product-catalog.cjs'),now=Date.parse('2026-11-09T12:00:00Z');
const product={id:'offline-fixture-1',approvalId:'fixture-source',name:'Synthetic validation fixture (not a real listing)',brand:'LOCAL TEST',category:'bottoms',type:'slacks',color:'black',styles:['classic'],occasions:['work'],gender:'men',price:45000,currency:'KRW',sizes:['M'],sizeChart:{unit:'cm',kind:'garment',rows:[{size:'M',waist:80,hips:102,inseam:76}]},imageUrl:'https://images.example.test/item.jpg',retailer:'Fixture seller',purchaseUrl:'https://seller.example.test/items/fixture',sourceUrl:'https://seller.example.test/authorized-feed',permissionChecked:true,lastChecked:'2026-11-09T11:00:00Z',stock:'in_stock',tags:['straight'],designTagsComplete:true};
const approval={id:'fixture-source',seller:'Fixture seller',domains:['seller.example.test'],imageDomains:['images.example.test'],rightsConfirmed:true,displayApproved:true,validUntil:'2026-11-10T12:00:00Z',evidenceRef:'PRIVATE local test permission evidence (not public)',sourceUrl:'https://seller.example.test/authorized-feed',retentionHours:24};
function approved(rows=[product]){const input={version:1,products:rows},bytes=JSON.stringify(input),manifest={version:1,sources:[{...approval}]};const preview=C.compileCatalog(input,manifest,{now,inputSha256:C.sha(bytes),inspect:true});manifest.sources[0].inputSha256=preview.inputSha256;manifest.sources[0].productsSha256=preview.digests[approval.id];return {input,manifest,bytes,inputSha256:preview.inputSha256};}
function compile(x){return C.compileCatalog(x.input,x.manifest,{now,inputSha256:x.inputSha256}).snapshot;}
test('reviewed exact seller file yields public real-data structure without private approval evidence',()=>{
 const x=approved(),snapshot=compile(x);assert.equal(snapshot.products.length,1);const p=snapshot.products[0];assert.equal(p.sourceVerified,true);assert.equal(p.productUrl,product.purchaseUrl);assert.equal(p.sizeChart.kind,'garment');assert.equal(p.checkedAt,now-3600000);assert.equal(p.expiresAt,Date.parse(approval.validUntil)-3600000);assert.doesNotMatch(JSON.stringify(snapshot),/PRIVATE|evidenceRef|inputSha256|productsSha256/);assert.equal(C.validateSnapshot(snapshot,x.manifest,now),snapshot);assert.throws(()=>C.validateSnapshot(snapshot,x.manifest,NaN));
});
test('permission booleans alone, revoked source and changed source file/snapshot cannot publish',()=>{
 assert.throws(()=>C.compileCatalog({version:1,products:[product]},{version:1,sources:[]},{now,inputSha256:'a'.repeat(64)}));
 const x=approved();x.manifest.sources[0].rightsConfirmed=false;assert.throws(()=>compile(x));
 const y=approved();assert.throws(()=>C.compileCatalog(y.input,y.manifest,{now,inputSha256:'b'.repeat(64)}));
 const s=compile(y);s.products[0].price=100;assert.throws(()=>C.validateSnapshot(s,y.manifest,now));
 const z=approved();z.input.products=[{...product,name:'Unreviewed replacement'}];assert.throws(()=>compile(z));
});
test('fake flags, malformed fields, unsafe URLs, stale prices and ambiguous charts fail closed',()=>{
 for(const patch of [{fixture:true},{demo:true},{sourceVerified:true},{memberEmail:'private@example.test'},{price:0},{price:1.5},{purchaseUrl:'http://seller.example.test/item'},{purchaseUrl:'https://seller.example.test.evil.test/item'},{purchaseUrl:'https://seller.example.test/item?redirect=https://evil.test'},{imageUrl:'https://unapproved.example.test/image.jpg'},{lastChecked:'2026-11-10T11:00:00Z'},{lastChecked:'2026-11-01T11:00:00Z'},{stock:'unknown'},{sizeChart:{unit:'cm',kind:'garment',rows:[{size:'X',waist:80}]}},{sizeChart:{unit:'cm',kind:'unknown',rows:[{size:'M',waist:80}]}}])assert.throws(()=>approved([{...product,...patch}]));
 const unknown=compile(approved([{...product,sizes:[],sizeChart:null}]));assert.deepEqual(unknown.products[0].sizeChart,{unit:'cm',kind:'unknown',rows:[]});
 const dollars=compile(approved([{...product,price:19.99,currency:'USD'}]));assert.equal(dollars.products[0].price,19.99);
 assert.throws(()=>approved([{...product,price:19.999,currency:'USD'}]));
});
test('CSV quoted chart parsing, unique identifiers and empty actual catalog are handled explicitly',()=>{
 const fields=C.INPUT_FIELDS;const values=fields.map(k=>{let value=product[k];if(['styles','occasions','sizes','tags'].includes(k))value=value.join('|');else if(k==='sizeChart')value=JSON.stringify(value);return '"'+String(value??'').replaceAll('"','""')+'"';});const csv=fields.join(',')+'\r\n'+values.join(',')+'\r\n';assert.deepEqual(C.parseCsv(csv),{version:1,products:[product]});
 assert.throws(()=>C.parseCsv('id,id\n1,2'));assert.throws(()=>C.parseCsv('id\n"unterminated'));assert.throws(()=>approved([product,product]));assert.equal(C.validateSnapshot({version:1,generatedAt:null,products:[]},{version:1,sources:[]},now).products.length,0);
});
test('CLI performs no network/DB operation and rejected imports preserve prior output',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'a1-catalog-')),x=approved(),input=path.join(dir,'seller.json'),manifest=path.join(dir,'approvals.json'),output=path.join(dir,'public.json'),script=path.resolve(__dirname,'../scripts/import-product-catalog.cjs');
 try{fs.writeFileSync(input,x.bytes);fs.writeFileSync(manifest,JSON.stringify(x.manifest));fs.writeFileSync(output,'PRIOR OUTPUT');
  const args=['--input',input,'--approvals',manifest,'--output',output,'--now',new Date(now).toISOString()];const ok=spawnSync(process.execPath,[script,...args],{encoding:'utf8'});assert.equal(ok.status,0,ok.stderr);const previous=fs.readFileSync(output,'utf8');assert.equal(JSON.parse(previous).products.length,1);
  fs.writeFileSync(input,JSON.stringify({...x.input,products:[{...product,price:1}]}));const bad=spawnSync(process.execPath,[script,...args],{encoding:'utf8'});assert.equal(bad.status,1);assert.equal(fs.readFileSync(output,'utf8'),previous);
  const inspect=spawnSync(process.execPath,[script,'--input',input,'--approvals',manifest,'--inspect','--now',new Date(now).toISOString()],{encoding:'utf8'});assert.equal(inspect.status,0);assert.equal(JSON.parse(inspect.stdout).registeredProducts,0);assert.equal(fs.readFileSync(output,'utf8'),previous);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
