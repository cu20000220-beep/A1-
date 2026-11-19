'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {createSourceAdapter}=require('../scripts/lib/source-adapters.cjs');
const SOURCE='https://licensed-seller.example/catalog',raw=()=>({id:'LOCAL-ONLY-1',name:'LOCAL SYNTHETIC ONLY',brand:'Synthetic brand',category:'bottoms',type:'slacks',color:'black',price:39000,currency:'KRW',sizes:['M'],sizeChart:{unit:'cm',kind:'garment',rows:[{size:'M',waist:80}]},imageUrl:'https://licensed-seller.example/images/test.jpg',retailer:'Synthetic seller',purchaseUrl:'https://licensed-seller.example/products/test',lastChecked:'2026-11-10T00:00:00.000Z',stock:'in_stock',gender:'men',styles:['classic'],occasions:['work'],tags:['straight'],permissionChecked:true,designTagsComplete:true});
const config=()=>({approvalId:'local-test-approval',sourceUrl:SOURCE});
const providerConfig=()=>({...config(),mapping:{id:'offer.id',name:'offer.title',price:'offer.price.amount',imageUrl:'offer.image.url',purchaseUrl:'offer.purchase'},defaults:{brand:'Synthetic brand',category:'bottoms',type:'slacks',color:'black',currency:'KRW',sizes:[],sizeChart:{unit:'cm',kind:'unknown',rows:[]},retailer:'Synthetic seller',gender:'men',stock:'unknown',lastChecked:'2026-11-10T00:00:00.000Z',styles:[],occasions:[],tags:[]}});
const providerPayload=()=>({items:[{offer:{id:'LOCAL-ONLY-2',title:'SYNTHETIC PROVIDER ONLY',price:{amount:'39000'},image:{url:'https://licensed-seller.example/images/provider.jpg'},purchase:'https://licensed-seller.example/products/provider'},permissionChecked:true,sourceVerified:true}]});
test('seller/brand normalization keeps candidates private and never trusts seller permission flags',()=>{
 for(const kind of ['seller-file','brand-file']){const input={version:1,products:[raw()]},before=JSON.stringify(input),adapter=createSourceAdapter(kind,config()),out=adapter.prepare(input);assert.equal(out.candidateCount,1);assert.equal(out.registeredProducts,0);assert.equal(out.liveEnabled,false);assert.equal(out.approvalRequired,true);assert.equal(out.candidates.products[0].sourceKind,kind);assert.equal(out.candidates.products[0].permissionChecked,false);assert.equal(out.candidates.products[0].approvalId,'local-test-approval');assert.equal(out.candidates.products[0].sourceUrl,SOURCE);assert.equal(JSON.stringify(input),before);assert.equal(out.candidates.products[0].sourceVerified,undefined);assert.equal(adapter.status().transport,'offline-only');}
 const reviewed=createSourceAdapter('seller-file',{...config(),defaults:{permissionChecked:true}}).prepare({version:1,products:[raw()]});assert.equal(reviewed.candidates.products[0].permissionChecked,true);assert.equal(reviewed.registeredProducts,0);
});
test('official/feed adapters use explicit reviewed paths without fabricating price/image/size data',()=>{
 for(const kind of ['official-api','affiliate-feed']){const result=createSourceAdapter(kind,providerConfig()).normalize(providerPayload());const p=result.candidates.products[0];assert.equal(p.price,39000);assert.deepEqual(p.sizes,[]);assert.equal(p.sizeChart.kind,'unknown');assert.equal(p.permissionChecked,false);assert.equal(p.sourceKind,kind);assert.equal(p.stock,'unknown');assert.equal(p.name,'SYNTHETIC PROVIDER ONLY');assert.equal(result.registeredProducts,0);}
 assert.throws(()=>createSourceAdapter('official-api',config()),/required_provider_mapping_missing/);
 const discovery=providerPayload();delete discovery.items[0].offer.image;assert.throws(()=>createSourceAdapter('official-api',providerConfig()).prepare(discovery),/mapped_field_missing/);
 const noPrice=providerPayload();noPrice.items[0].offer.price.amount='unknown';assert.throws(()=>createSourceAdapter('affiliate-feed',providerConfig()).prepare(noPrice),/invalid_candidate_price/);
});
test('unsafe mapping, source substitution, duplicates and incomplete records fail before output',()=>{
 for(const field of ['__proto__.x','offer.constructor.name','offer.prototype.value','offer.access_token','offer[0].price'])assert.throws(()=>createSourceAdapter('official-api',{...providerConfig(),mapping:{...providerConfig().mapping,name:field}}),/unsafe_mapping_path/);
 for(const target of ['approvalId','sourceKind','sourceUrl','permissionChecked','sourceVerified'])assert.throws(()=>createSourceAdapter('official-api',{...providerConfig(),mapping:{...providerConfig().mapping,[target]:'offer.id'}}),/unapproved_mapping_target/);
 assert.throws(()=>createSourceAdapter('seller-file',config()).prepare({products:[{...raw(),approvalId:'different'}]}),/source_approval_conflict/);
 assert.throws(()=>createSourceAdapter('seller-file',config()).prepare({products:[{...raw(),sourceUrl:'https://evil.example/feed'}]}),/source_url_conflict/);
 assert.throws(()=>createSourceAdapter('seller-file',config()).prepare({products:[{...raw(),sourceKind:'official-api'}]}),/source_kind_conflict/);
 assert.throws(()=>createSourceAdapter('seller-file',config()).prepare({products:[raw(),raw()]}),/duplicate_source_product/);
 for(const stock of ['out_of_stock','unknown'])assert.equal(createSourceAdapter('seller-file',config()).prepare({products:[{...raw(),stock}]}).candidates.products[0].stock,stock);
 assert.throws(()=>createSourceAdapter('official-api',{...providerConfig(),defaults:{...providerConfig().defaults,stock:'in_stock'}}),/availability_mapping_required/);
 const missing=raw();delete missing.lastChecked;assert.throws(()=>createSourceAdapter('seller-file',config()).prepare({products:[missing]}),/incomplete_product_lastChecked/);
 const bad=providerPayload();bad.items[0].offer.purchase='javascript:alert(1)';assert.throws(()=>createSourceAdapter('official-api',providerConfig()).prepare(bad),/invalid_candidate_url/);
});
test('canonical CSV preparation is offline and missing fields are not filled with fake data',()=>{
 const p=raw(),header=Object.keys(p),cell=v=>'"'+(Array.isArray(v)?v.join('|'):typeof v==='object'?JSON.stringify(v):String(v)).replaceAll('"','""')+'"';const csv=header.join(',')+'\n'+header.map(k=>cell(p[k])).join(',')+'\n';
 const out=createSourceAdapter('brand-file',config()).prepare(csv);assert.equal(out.candidateCount,1);assert.equal(out.candidates.products[0].permissionChecked,false);assert.equal(out.candidates.products[0].price,39000);
 assert.throws(()=>createSourceAdapter('brand-file',config()).prepare('name,price\nOnly a name,\n'),/incomplete_product|invalid_candidate_number/);
});
test('CLI writes only new private candidates and stdout counts, never public assets or provider records',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'a1-source-adapter-'));try{const input=path.join(dir,'payload.json'),configPath=path.join(dir,'config.json'),output=path.join(dir,'candidate.json');fs.writeFileSync(input,JSON.stringify(providerPayload()));fs.writeFileSync(configPath,JSON.stringify({kind:'official-api',...providerConfig()}));
 const script=path.resolve(__dirname,'../scripts/prepare-source-products.cjs'),call=extra=>spawnSync(process.execPath,[script,'--input',input,'--config',configPath,'--output',extra],{encoding:'utf8'});
 const result=call(output);assert.equal(result.status,0,result.stderr);const info=JSON.parse(result.stdout);assert.equal(info.registeredProducts,0);assert.equal(info.candidateCount,1);assert.doesNotMatch(result.stdout,/SYNTHETIC|licensed-seller|39000/);const stored=JSON.parse(fs.readFileSync(output,'utf8'));assert.equal(stored.version,1);assert.equal(stored.products[0].permissionChecked,false);assert.equal(call(output).status,1);
 const publicOutput=path.resolve(__dirname,'../assets/DO-NOT-WRITE-candidate.json');assert.equal(call(publicOutput).status,1);assert.equal(fs.existsSync(publicOutput),false);
 const linked=path.join(dir,'linked-public');fs.symlinkSync(path.resolve(__dirname,'../assets'),linked,'dir');assert.equal(call(path.join(linked,'DO-NOT-WRITE-candidate.json')).status,1);assert.equal(fs.existsSync(publicOutput),false);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
