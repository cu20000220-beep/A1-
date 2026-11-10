'use strict';
// Synthetic local fixtures exercise validation; none are registered/published.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const C=require('../scripts/lib/product-catalog.cjs'),now=Date.parse('2026-11-09T12:00:00Z');
const product={id:'offline-fixture-1',approvalId:'fixture-source',name:'Synthetic validation fixture (not a real listing)',brand:'LOCAL TEST',category:'bottoms',type:'slacks',color:'black',styles:['classic'],occasions:['work'],gender:'men',price:45000,currency:'KRW',sizes:['M'],sizeChart:{unit:'cm',kind:'garment',rows:[{size:'M',waist:80,hips:102,inseam:76}]},imageUrl:'https://images.example.test/item.jpg',retailer:'Fixture seller',purchaseUrl:'https://seller.example.test/items/fixture',sourceUrl:'https://seller.example.test/authorized-feed',permissionChecked:true,lastChecked:'2026-11-09T11:00:00Z',stock:'in_stock',tags:['straight'],designTagsComplete:true};
const approval={id:'fixture-source',seller:'Fixture seller',domains:['seller.example.test'],imageDomains:['images.example.test'],rightsConfirmed:true,displayApproved:true,validUntil:'2026-11-10T12:00:00Z',evidenceRef:'PRIVATE local test permission evidence (not public)',sourceUrl:'https://seller.example.test/authorized-feed',retentionHours:24};
function approved(rows=[product],sourcePatch={}){const input={version:1,products:rows},bytes=JSON.stringify(input),manifest={version:1,sources:[{...approval,...sourcePatch}]};const preview=C.compileCatalog(input,manifest,{now,inputSha256:C.sha(bytes),inspect:true});manifest.sources[0].inputSha256=preview.inputSha256;manifest.sources[0].productsSha256=preview.digests[approval.id];return {input,manifest,bytes,inputSha256:preview.inputSha256};}
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
 for(const patch of [{fixture:true},{demo:true},{sourceVerified:true},{memberEmail:'private@example.test'},{price:0},{price:1.5},{purchaseUrl:'http://seller.example.test/item'},{purchaseUrl:'https://seller.example.test.evil.test/item'},{purchaseUrl:'https://seller.example.test/item?redirect=https://evil.test'},{imageUrl:'https://unapproved.example.test/image.jpg'},{lastChecked:'2026-11-10T11:00:00Z'},{lastChecked:'2026-11-01T11:00:00Z'},{sizeChart:{unit:'cm',kind:'garment',rows:[{size:'X',waist:80}]}},{sizeChart:{unit:'cm',kind:'unknown',rows:[{size:'M',waist:80}]}}])assert.throws(()=>approved([{...product,...patch}]));
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

test('optional offer identity, scoped nullable costs and commercial disclosure are reviewed and hash-bound',()=>{
 const offered={...product,gtin:'4006381333931',mpn:'MAKER-STYLE-01',offerSize:'M',sizeSystem:'KR',condition:'new',shipping:3000,tax:0,duties:null,costDestination:'KR',shippingCountries:['KR'],sourceKind:'seller-file',externalId:'seller-record-123',commercial:{sponsored:true,affiliate:false,label:'Paid placement; no ranking boost'},purchaseConditions:'Members-only offer; verify merchant terms'};
 const x=approved([offered],{commercialApproved:true}),snapshot=compile(x),row=snapshot.products[0];assert.equal(row.gtin,offered.gtin);assert.equal(row.mpn,offered.mpn);assert.equal(row.offerSize,'M');assert.equal(row.sizeSystem,'KR');assert.equal(row.shipping,3000);assert.equal(row.tax,0);assert.equal(row.duties,null);assert.equal(row.costDestination,'KR');assert.deepEqual(row.shippingCountries,['KR']);assert.equal(row.commercial.sponsored,true);assert.equal(row.purchaseConditions,offered.purchaseConditions);assert.equal(C.validateSnapshot(snapshot,x.manifest,now),snapshot);
 const changed=structuredClone(snapshot);changed.products[0].shipping=0;assert.throws(()=>C.validateSnapshot(changed,x.manifest,now));
 const unknown=compile(approved([{...product,mpn:'MAKER-01',stock:'unknown'}])).products[0];assert.equal(unknown.stock,'unknown');assert.equal(unknown.shipping,null);assert.equal(unknown.costDestination,null);assert.deepEqual(unknown.shippingCountries,[]);assert.equal(unknown.condition,null);assert.equal(unknown.commercial,null);assert.equal(unknown.purchaseConditions,null);
 const out=compile(approved([{...product,stock:'out_of_stock'}]));assert.equal(out.products[0].stock,'out_of_stock');assert.equal(Object.hasOwn(out.products[0],'gtin'),false,'legacy row without new fields must preserve its old public schema');
 for(const patch of [{purchaseConditions:'x'.repeat(301)},{purchaseConditions:42},{gtin:'4006381333932'},{gtin:4006381333931},{gtin:'0000000000000'},{offerSize:'X'},{condition:'refurbished'},{shipping:-1},{shipping:'0'},{shipping:1.5},{costDestination:'US'},{shippingCountries:['kr']},{commercial:{sponsored:true,affiliate:false,label:null}},{commercial:{sponsored:'true',affiliate:false,label:'ad'}},{sourceKind:'official-api'}])assert.throws(()=>approved([{...offered,...patch}],{commercialApproved:true}));
 assert.throws(()=>approved([{...offered,costDestination:null}],{commercialApproved:true}));assert.throws(()=>approved([offered]));assert.throws(()=>approved([offered],{commercialApproved:false}));
});
test('official provider records require reviewed source kind and exact allowed seller list',()=>{
 const input={version:1,products:[{...product,sourceKind:'official-api',externalId:'provider-record-123',retailer:'Reviewed shop'}]},bytes=JSON.stringify(input),manifest={version:1,sources:[{...approval,kind:'official-api',retailers:['Reviewed shop']}]};
 const inspected=C.compileCatalog(input,manifest,{now,inputSha256:C.sha(bytes),inspect:true});manifest.sources[0].inputSha256=inspected.inputSha256;manifest.sources[0].productsSha256=inspected.digests[approval.id];const snapshot=C.compileCatalog(input,manifest,{now,inputSha256:inspected.inputSha256}).snapshot;assert.equal(snapshot.products[0].retailerName,'Reviewed shop');assert.equal(snapshot.products[0].sourceKind,'official-api');assert.equal(C.validateSnapshot(snapshot,manifest,now),snapshot);
 assert.throws(()=>C.compileCatalog({...input,products:[{...input.products[0],retailer:'Unreviewed shop'}]},manifest,{now,inputSha256:inspected.inputSha256,inspect:true}));
 assert.throws(()=>C.compileCatalog({...input,products:[{...product,retailer:'Reviewed shop'}]},manifest,{now,inputSha256:inspected.inputSha256,inspect:true}));
});
test('affiliate feeds and known tracking links cannot publish without reviewed disclosure',()=>{
 for(const key of ['affid','campid','tag','trackingId'])assert.throws(()=>approved([{...product,purchaseUrl:product.purchaseUrl+'?'+key+'=TESTONLY'}]),/affiliate_disclosure_required/);
 const affiliate={...product,purchaseUrl:product.purchaseUrl+'?affid=TESTONLY',commercial:{sponsored:false,affiliate:true,label:'Synthetic affiliate permission fixture'}};
 assert.throws(()=>approved([affiliate]),/commercial_permission_required/);assert.equal(compile(approved([affiliate],{commercialApproved:true})).products[0].commercial.affiliate,true);
 const manifest={version:1,sources:[{...approval,kind:'affiliate-feed',retailers:[product.retailer]}]},input={version:1,products:[{...product,sourceKind:'affiliate-feed'}]};assert.throws(()=>C.compileCatalog(input,manifest,{now,inspect:true}),/affiliate_disclosure_required/);
});
