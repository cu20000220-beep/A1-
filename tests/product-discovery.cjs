'use strict';
// Synthetic observation records are private test inputs, never public products.
const test=require('node:test'),assert=require('node:assert/strict');
const D=require('../assets/product-discovery.js'),Q=require('../assets/shopping-query.js');
const now=Date.parse('2026-11-17T12:00:00Z');
const row=(patch={})=>({id:'PRIVATE-TEST-1',name:'Private observation validation fixture',brand:'PRIVATE TEST',retailerName:'무신사',type:'slacks',category:'bottoms',color:'black',gender:'men',fit:'wide',price:40000,currency:'KRW',priceKind:'page-observation',priceNote:'Synthetic validation price; never a real product quote.',sizes:['M','L'],productUrl:'https://www.musinsa.com/products/123456',sourceUrl:'https://www.musinsa.com/products/123456',checkedAt:now-60000,stock:'unknown',imageUrl:null,imageRights:'unverified',fittingRights:'unverified',sourceNote:'Private fixture representing a retrieved page, possibly cached.',observedFeatures:['와이드'],...patch});
const snapshot=(rows=[row()])=>({version:1,observedAt:now,products:rows});

test('observed facts stay separate from feed approval, image permission, live pricing and fit capabilities',()=>{
 const source=snapshot(),before=structuredClone(source),validated=D.validateSnapshot(source,{now});
 assert.equal(validated.length,1);assert.equal(validated[0].stock,'unknown');assert.equal(validated[0].imageUrl,null);assert.equal(validated[0].fittingRights,'unverified');
 const result=D.search(source,'남성 검정 와이드 슬랙스 5만원 이하',{now});assert.equal(result.candidates.length,1);assert.equal(result.budgetUnconfirmed.length,0);
 const candidate=result.candidates[0];assert.equal(candidate.canFit,false);assert.ok(candidate.reasons.includes('observed_price_within_budget'));assert.ok(candidate.reasons.includes('fit_matches'));
 for(const code of ['price_not_live','stock_unconfirmed','image_rights_unverified','fitting_unavailable'])assert.ok(candidate.warnings.includes(code));
 assert.equal(Object.hasOwn(candidate,'score'),false);assert.equal(Object.hasOwn(candidate.product,'sourceVerified'),false);
 assert.deepEqual(source,before);assert.notEqual(validated[0],source.products[0]);assert.ok(Object.isFrozen(validated));assert.ok(Object.isFrozen(validated[0].sizes));assert.throws(()=>{validated[0].sizes.push('XL');});
});

test('only exact official item paths and bounded public variant options can leave the site',()=>{
 for(const value of ['https://www.musinsa.com/products/123456','https://www.29cm.co.kr/products/4567','https://www.uniqlo.com/kr/ko/products/E465185-000/01?colorDisplayCode=42','https://www.uniqlo.com/kr/ko/products/E465185-000/01?colorDisplayCode=42&sizeDisplayCode=004'])assert.equal(D.safeProductUrl(value),true,value);
 for(const value of ['http://www.musinsa.com/products/1','https://www.musinsa.com.evil.test/products/1','https://user:password@www.musinsa.com/products/1','https://www.musinsa.com:8443/products/1','https://www.musinsa.com/products/1#private','https://www.musinsa.com/products/1?email=private@example.test','https://www.musinsa.com/products/1?redirect=https://evil.test','https://www.musinsa.com/search/goods?keyword=slacks','https://www.musinsa.com/products/%31','https://www.29cm.co.kr/','https://www.uniqlo.com/kr/ko/search','https://www.uniqlo.com/kr/ko/products/E1-000/01?token=private','https://www.uniqlo.com/kr/ko/products/E1-000/01?colorDisplayCode=42&colorDisplayCode=2','https://www.uniqlo.com/kr/ko/products/E1-000/01?sizeDisplayCode=private','data:image/png;base64,PRIVATE'])assert.equal(D.safeProductUrl(value),false,value);
 assert.throws(()=>D.validateSnapshot(snapshot([row({sourceUrl:'https://www.musinsa.com/products/654321'})]),{now}),/url_invalid/);
});

test('image grants, photo URLs, provider secrets and extra private fields cannot be smuggled into observations',()=>{
 for(const patch of [{imageUrl:'https://images.example.test/photo.jpg'},{imageRights:'approved'},{fittingRights:'verified'},{fittingImageUrl:'https://images.example.test/cutout.png'},{sourceVerified:true},{permissionChecked:true},{bodyMetrics:{shoulderHipRatio:1.4}},{memberEmail:'private@example.test'},{apiKey:'PRIVATE-NOT-A-REAL-KEY'}])assert.throws(()=>D.validateSnapshot(snapshot([row(patch)]),{now}));
 assert.throws(()=>D.validateSnapshot({...snapshot(),sourceApproval:true},{now}));
});

test('nullable prices remain unconfirmed, never zero or a fabricated within-budget recommendation',()=>{
 const unknown=row({id:'PRIVATE-UNKNOWN',productUrl:'https://www.29cm.co.kr/products/22',sourceUrl:'https://www.29cm.co.kr/products/22',price:null,priceKind:'unconfirmed'});
 const expensive=row({id:'PRIVATE-EXPENSIVE',productUrl:'https://www.musinsa.com/products/33',sourceUrl:'https://www.musinsa.com/products/33',price:75000});
 const result=D.search(snapshot([row(),unknown,expensive]),'남성 검정 슬랙스 5만원 이하',{now});
 assert.equal(result.snapshotCount,3);assert.equal(result.candidates.length,1);assert.equal(result.budgetUnconfirmed.length,1);assert.equal(result.budgetUnconfirmed[0].product.price,null);
 assert.ok(result.budgetUnconfirmed[0].warnings.includes('price_unconfirmed'));assert.ok(!result.budgetUnconfirmed[0].reasons.includes('observed_price_within_budget'));
 assert.equal(result.excluded[0].reason,'over_observed_budget');
 for(const patch of [{price:0},{price:-1},{price:Infinity},{price:NaN},{price:1.5},{price:null,priceKind:'page-observation'},{price:40000,priceKind:'unconfirmed'},{currency:'USD'}])assert.throws(()=>D.validateSnapshot(snapshot([row(patch)]),{now}),/price_invalid|product_invalid/);
});

test('dates and duplicate identities are validated; old quotes stay explicitly stale references',()=>{
 for(const patch of [{checkedAt:now+1},{checkedAt:0},{checkedAt:NaN},{checkedAt:'2026-11-17T11:00:00Z'}])assert.throws(()=>D.validateSnapshot(snapshot([row(patch)]),{now}));
 assert.throws(()=>D.validateSnapshot({...snapshot(),observedAt:now+1},{now}));
 assert.throws(()=>D.validateSnapshot({...snapshot(),observedAt:now-120000},{now}));
 assert.throws(()=>D.validateSnapshot(snapshot(),{now:NaN}));
 assert.throws(()=>D.validateSnapshot(snapshot([row(),row()]),{now}));
 assert.throws(()=>D.validateSnapshot(snapshot([row(),row({id:'PRIVATE-DUPLICATE-URL'})]),{now}));
 assert.throws(()=>D.validateSnapshot(snapshot(Array.from({length:101},()=>row())),{now}));
 assert.ok(D.search(snapshot([row({checkedAt:now-2*86400000})]),'슬랙스',{now}).candidates[0].warnings.includes('observation_stale'));
});

test('known category, collection, color and fit mismatches are not silently relaxed',()=>{
 const rows=[row(),row({id:'PRIVATE-WOMEN',productUrl:'https://www.29cm.co.kr/products/2',sourceUrl:'https://www.29cm.co.kr/products/2',gender:'women'}),row({id:'PRIVATE-NAVY',productUrl:'https://www.musinsa.com/products/3',sourceUrl:'https://www.musinsa.com/products/3',color:'navy'}),row({id:'PRIVATE-SLIM',productUrl:'https://www.musinsa.com/products/4',sourceUrl:'https://www.musinsa.com/products/4',fit:'slim'}),row({id:'PRIVATE-UNKNOWN',productUrl:'https://www.musinsa.com/products/5',sourceUrl:'https://www.musinsa.com/products/5',gender:'unknown',fit:'any'})];
 const result=D.search(snapshot(rows),'남성 검정 와이드 슬랙스 5만원 이하',{now});
 assert.equal(result.candidates.length,2);assert.equal(result.excluded.length,3);
 const conditional=result.candidates.find(r=>r.product.id==='PRIVATE-UNKNOWN');assert.ok(conditional.warnings.includes('collection_unconfirmed'));assert.ok(conditional.warnings.includes('fit_unconfirmed'));assert.ok(!conditional.reasons.includes('collection_matches'));assert.ok(!conditional.reasons.includes('fit_matches'));
 assert.equal(D.search(snapshot(rows),'남성 검정 코트',{now}).candidates.length,0);
 assert.equal(D.search(snapshot([row({stock:'out_of_stock'})]),'슬랙스',{now}).excluded[0].reason,'out_of_stock');
 for(const patch of [{stock:'available'},{category:'tops'},{gender:'female'},{color:'blue'},{fit:'custom'}, {id:123}])assert.throws(()=>D.validateSnapshot(snapshot([row(patch)]),{now}));
});

test('search never applies body measurements or sends private query text anywhere',()=>{
 const before=snapshot(),serialized=JSON.stringify(before);
 for(const query of ['person@example.test 슬랙스','https://evil.test 셔츠','010-1234-5678 슬랙스'])assert.throws(()=>D.search(before,query,{now}));
 for(const options of [{...Q.parse('슬랙스'),bodyMetrics:{legTorsoRatio:1.7}},{...Q.parse('슬랙스'),imageUrl:'data:PRIVATE'},{...Q.parse('슬랙스'),currency:'USD'}])assert.throws(()=>D.search(before,options,{now}));
 const result=D.search(before,'슬랙스 신체수치1.428571 PRIVATE_ORDER_987654321',{now});assert.equal(result.candidates.length,1);
 assert.doesNotMatch(JSON.stringify(result),/1\.428571|PRIVATE_ORDER_987654321|legTorsoRatio|shoulderHipRatio/);assert.equal(JSON.stringify(before),serialized);
});
