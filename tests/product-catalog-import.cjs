'use strict';
// Synthetic local fixtures exercise validation; none are registered/published.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const C=require('../scripts/lib/product-catalog.cjs'),BrowserCatalog=require('../assets/product-catalog.js'),now=Date.parse('2026-11-09T12:00:00Z');
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

test('optional fitting image needs separate operator permission and a permitted image host',()=>{
 const fittingImageUrl='https://images.example.test/authorized-flat-garment.png',x=approved([{...product,fittingImageUrl}],{fittingUseApproved:true}),snapshot=compile(x),row=snapshot.products[0];
 assert.equal(row.fittingImageUrl,fittingImageUrl);assert.equal(row.fittingRightsVerified,true);assert.equal(C.validateSnapshot(snapshot,x.manifest,now),snapshot);assert.equal(BrowserCatalog.fittingProduct(snapshot,row.id,now),row);
 assert.throws(()=>approved([{...product,fittingImageUrl}]),/fitting_permission_required/);assert.throws(()=>approved([{...product,fittingImageUrl}],{fittingUseApproved:false}),/fitting_permission_required/);
 for(const value of ['true',1,null])assert.throws(()=>approved([{...product,fittingImageUrl}],{fittingUseApproved:value}),/invalid_fitting_approval/);
 for(const value of ['http://images.example.test/item.png','https://unapproved.example.test/item.png','https://user:pass@images.example.test/item.png','https://images.example.test/item.png?token=private','data:image/png;base64,TEST','',false])assert.throws(()=>approved([{...product,fittingImageUrl:value}],{fittingUseApproved:true}));
 assert.throws(()=>approved([{...product,fittingImageUrl,fittingRightsVerified:true}],{fittingUseApproved:true}),/unrecognized_fields/);
 const explicitNull=compile(approved([{...product,fittingImageUrl:null}]));assert.equal(explicitNull.products[0].fittingImageUrl,null);assert.equal(explicitNull.products[0].fittingRightsVerified,false);assert.equal(BrowserCatalog.fittingProduct(explicitNull,product.id,now),null);
});

test('fitting permission is reconstructed and hash-bound on every snapshot build',()=>{
 const x=approved([{...product,fittingImageUrl:'https://images.example.test/authorized.png'}],{fittingUseApproved:true}),snapshot=compile(x);
 const revoked=structuredClone(x.manifest);revoked.sources[0].fittingUseApproved=false;assert.throws(()=>C.validateSnapshot(snapshot,revoked,now),/fitting_permission_required/);
 for(const patch of [{fittingRightsVerified:false},{fittingRightsVerified:'true'},{fittingImageUrl:'https://images.example.test/unreviewed.png'},{fittingImageUrl:null,fittingRightsVerified:false}]){const changed=structuredClone(snapshot);Object.assign(changed.products[0],patch);assert.throws(()=>C.validateSnapshot(changed,x.manifest,now));}
 const legacy=approved(),forged=compile(legacy);forged.products[0].fittingRightsVerified=true;assert.throws(()=>C.validateSnapshot(forged,legacy.manifest,now),/snapshot_record_mismatch/);
 const missing=structuredClone(snapshot);delete missing.products[0].fittingImageUrl;assert.throws(()=>C.validateSnapshot(missing,x.manifest,now),/snapshot_record_mismatch/);
 const inputChanged=structuredClone(x);inputChanged.input.products[0].fittingImageUrl='https://images.example.test/unreviewed.png';assert.throws(()=>compile(inputChanged),/reviewed_file_hash_mismatch/);
});

test('legacy absent fitting fields and blank optional CSV retain the approved group hash',()=>{
 const x=approved(),snapshot=compile(x);assert.equal(x.manifest.sources[0].productsSha256,'84d6903e8b697f55e408067273e30d55ef6b9c346fa93705a02d751e09d77b97');assert.equal(Object.hasOwn(snapshot.products[0],'fittingImageUrl'),false);assert.equal(Object.hasOwn(snapshot.products[0],'fittingRightsVerified'),false);
 assert.deepEqual(compile(approved([product],{fittingUseApproved:true})),snapshot);
 const fields=C.INPUT_FIELDS,values=fields.map(k=>{let value=product[k];if(['styles','occasions','sizes','tags'].includes(k))value=value.join('|');else if(k==='sizeChart')value=JSON.stringify(value);return '"'+String(value??'').replaceAll('"','""')+'"';});
 for(const blank of ['', '   ']){values[fields.indexOf('fittingImageUrl')]='"'+blank+'"';const parsed=C.parseCsv(fields.join(',')+'\n'+values.join(',')+'\n');assert.deepEqual(parsed.products,[product]);assert.equal(approved(parsed.products).manifest.sources[0].productsSha256,x.manifest.sources[0].productsSha256);}
 values[fields.indexOf('fittingImageUrl')]='"https://images.example.test/authorized.png"';const parsed=C.parseCsv(fields.join(',')+'\n'+values.join(',')+'\n');assert.equal(compile(approved(parsed.products,{fittingUseApproved:true})).products[0].fittingRightsVerified,true);
 assert.equal(JSON.parse(fs.readFileSync(path.resolve(__dirname,'../assets/approved-products.json'),'utf8')).products.length,0);assert.equal(JSON.parse(fs.readFileSync(path.resolve(__dirname,'../catalog/source-approvals.json'),'utf8')).sources.length,0);
});

test('fitting selection requires an intact current in-stock catalog row and safe rights-verified image',()=>{
 const snapshot=compile(approved([{...product,fittingImageUrl:'https://images.example.test/authorized.png'}],{fittingUseApproved:true})),row=snapshot.products[0];
 assert.equal(BrowserCatalog.fittingProduct(snapshot,product.id,now),row);assert.equal(BrowserCatalog.fittingProduct(snapshot,'missing',now),null);assert.equal(BrowserCatalog.fittingProduct(snapshot,product.id,row.expiresAt),null);assert.equal(BrowserCatalog.fittingProduct(snapshot,product.id,NaN),null);
 for(const stock of ['unknown','out_of_stock'])assert.equal(BrowserCatalog.fittingProduct(compile(approved([{...product,stock,fittingImageUrl:row.fittingImageUrl}],{fittingUseApproved:true})),product.id,now),null);
 for(const patch of [{sourceVerified:false},{fittingRightsVerified:false},{fittingRightsVerified:'true'},{fittingImageUrl:null},{fittingImageUrl:'http://images.example.test/item.png'},{fittingImageUrl:'https://images.example.test/item.png?session=secret'},{productUrl:'https://seller.example.test/'},{checkedAt:now+1}]){const changed=structuredClone(snapshot);Object.assign(changed.products[0],patch);assert.equal(BrowserCatalog.fittingProduct(changed,product.id,now),null);}
 const absent=compile(approved());assert.equal(BrowserCatalog.fittingProduct(absent,product.id,now),null);assert.equal(BrowserCatalog.fittingProduct({version:1,generatedAt:null,products:[]},product.id,now),null);assert.equal(BrowserCatalog.fittingProduct(null,product.id,now),null);
});

test('merchant purchase URLs identify an item while source homepages and affiliate deep links stay valid',()=>{
 const rejected=['https://seller.example.test/','https://seller.example.test','https://seller.example.test/search/coat','https://seller.example.test/search','https://seller.example.test/sch/i.html','https://seller.example.test/SEARCH/item','https://seller.example.test/%73earch/item','https://seller.example.test/items/fixture?q=coat','https://seller.example.test/items/fixture?Query=coat','https://seller.example.test/items/fixture?keyword=coat','https://seller.example.test/items/fixture?_nkw=coat'];
 const snapshot=compile(approved());for(const purchaseUrl of rejected){assert.throws(()=>approved([{...product,purchaseUrl}]));assert.equal(BrowserCatalog.safeBuyerUrl(purchaseUrl),false);const changed=structuredClone(snapshot);changed.products[0].productUrl=purchaseUrl;assert.throws(()=>BrowserCatalog.validateSnapshot(changed,now));}
 const homepage='https://seller.example.test/',homeSource=compile(approved([{...product,sourceUrl:homepage}],{sourceUrl:homepage}));assert.equal(homeSource.products[0].sourceUrl,homepage);assert.equal(BrowserCatalog.safeUrl(homepage),true);assert.equal(BrowserCatalog.validateSnapshot(homeSource,now).length,1);
 const purchaseUrl='https://seller.example.test/pclick?deep_link=https%3A%2F%2Fseller.example.test%2Fitems%2Ffixture',affiliate={...product,purchaseUrl,commercial:{sponsored:false,affiliate:true,label:'Synthetic affiliate permission fixture'}},x=approved([affiliate],{commercialApproved:true}),deep=compile(x);assert.equal(deep.products[0].productUrl,purchaseUrl);assert.equal(C.validateSnapshot(deep,x.manifest,now),deep);assert.equal(BrowserCatalog.validateSnapshot(deep,now).length,1);assert.equal(BrowserCatalog.safeBuyerUrl(purchaseUrl),true);
});

test('credential-bearing URL path segments are excluded from public source and image fields',()=>{
 for(const segment of ['apikey','api_key','access_token','token','secret','%61pikey','APIKEY']){
  const sourceUrl='https://seller.example.test/download/'+segment+'/SYNTHETIC_TEST_VALUE';assert.throws(()=>approved([{...product,sourceUrl}],{sourceUrl}),/unapproved_url/);assert.equal(BrowserCatalog.safeUrl(sourceUrl),false);
  const fittingImageUrl='https://images.example.test/'+segment+'/SYNTHETIC_TEST_VALUE/item.png';assert.throws(()=>approved([{...product,fittingImageUrl}],{fittingUseApproved:true}),/unapproved_url/);assert.equal(BrowserCatalog.safeUrl(fittingImageUrl),false);
 }
});
