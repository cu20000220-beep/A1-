'use strict';
// Synthetic local policy fixtures only. These records are never public products.
const test=require('node:test'),assert=require('node:assert/strict');
const O=require('../assets/offer-comparison.js'),C=require('../assets/product-catalog.js');
const now=Date.parse('2026-11-10T12:00:00Z');
const row=(id,patch={})=>({id,approvalId:'TEST-ONLY',name:'Synthetic policy fixture',brand:'TEST MAKER',category:'bottoms',type:'slacks',color:'black',styles:[],occasions:[],gender:'men',price:39000,currency:'KRW',sizes:['M','L'],sizeChart:null,imageUrl:'https://images.example.test/fixture.jpg',retailerName:'Seller '+id,productUrl:'https://seller.example.test/item/'+id,sourceUrl:'https://seller.example.test/feed',sourceVerified:true,checkedAt:now-1000,expiresAt:now+3600000,stock:'in_stock',tags:['straight'],gtin:'4006381333931',mpn:null,offerSize:'M',sizeSystem:'KR',condition:'new',shipping:3000,tax:0,duties:0,costDestination:'KR',shippingCountries:['KR'],commercial:null,purchaseConditions:null,purchaseConditionsVerified:true,...patch});
const compare=(rows,opts={})=>O.compare(rows,rows[0],{now,...opts});
test('exact identity uses declared manufacturer identifiers and complete variants, never names or seller IDs',()=>{
 assert.equal(O.validGtin('4006381333931'),true);assert.equal(O.validGtin('0000000000000'),false);assert.equal(O.validGtin('4006381333932'),false);
 const a=row('A');assert.equal(O.identity(a),O.identity(row('B',{gtin:'04006381333931'})));
 for(const patch of [{gtin:null,mpn:null},{brand:'unknown'},{color:'unknown'},{offerSize:null},{sizeSystem:null},{condition:null}])assert.equal(O.identity(row('B',patch)),null);
 for(const patch of [{color:'white'},{offerSize:'L'},{sizeSystem:'US'},{condition:'used'},{brand:'OTHER MAKER'}])assert.notEqual(O.identity(a),O.identity(row('B',patch)));
 assert.equal(O.identity(row('M1',{gtin:null,mpn:'Style-01'})),O.identity(row('M2',{gtin:null,mpn:'Style-01'})));assert.notEqual(O.identity(row('M1',{gtin:null,mpn:'Style-01'})),O.identity(row('M2',{gtin:null,mpn:'style-01'})));
});
test('complete same-destination totals use all fees and at least two distinct sellers before a scoped minimum',()=>{
 const a=row('A'),b=row('B',{price:40000,shipping:0});const result=compare([a,b]);assert.equal(result.rows.length,2);assert.equal(result.rows[0].total,42000);assert.equal(result.minimumAmount,40000);assert.equal(result.lowestOfferId,'B');assert.equal(result.verifiedSellerCount,2);
 assert.equal(compare([a]).minimumAmount,null);assert.equal(compare([a,row('B',{retailerName:a.retailerName})]).minimumAmount,null);
 const usd=compare([row('A',{currency:'USD',price:19.99,shipping:2.01,tax:1.1}),row('B',{currency:'USD',price:20,shipping:3,tax:1.1})],{currency:'USD'});assert.equal(usd.rows[0].total,23.1);
});
test('unknown fees, foreign currency, destination, stock, stale price or conditional purchases never become a minimum',()=>{
 const patches=[{shipping:null},{tax:null},{duties:null},{currency:'USD'},{shippingCountries:[]},{costDestination:'US'},{stock:'out_of_stock'},{stock:'unknown'},{checkedAt:now-86400001,expiresAt:now+10000},{expiresAt:now},{sourceVerified:false},{purchaseConditions:'Members only'},{purchaseConditionsVerified:false},{comparisonConflict:true}];
 for(const patch of patches){const result=compare([row('A'),row('B',patch)]);assert.equal(result.rows[1].total,null,JSON.stringify(patch));assert.equal(result.rows[1].eligible,false);assert.equal(result.minimumAmount,null);assert.ok(result.rows[1].reasons.length>0);}
 const foreign=compare([row('A'),row('B')],{destination:'US'});assert.equal(foreign.minimumAmount,null);assert.equal(foreign.rows[0].shipping,3000,'never convert a KR shipping quotation into US shipping');
});
test('different sizes, colors, conditions and unresolved identity cannot be called the same item',()=>{
 const a=row('A'),rows=[a,row('B',{offerSize:'L'}),row('C',{color:'white'}),row('D',{condition:'used'}),row('E',{gtin:null,mpn:null})];assert.deepEqual(compare(rows).rows.map(p=>p.id),['A']);assert.equal(O.compare(rows,rows[4],{now}).status,'identity_unconfirmed');
});
test('deduplication keeps latest exact seller/URL/variant, never the cheapest historical price or a competing seller',()=>{
 const a=row('old',{retailerName:'Same seller',productUrl:'https://seller.example.test/same',price:1000,checkedAt:now-2000,sourceKind:'seller-file'}),b=row('new',{retailerName:'Same seller',productUrl:a.productUrl,price:49000,sourceKind:'official-api',approvalId:'DIFFERENT-APPROVAL'}),c=row('other',{retailerName:'Other seller',productUrl:a.productUrl,externalId:'same-provider-product'});
 assert.deepEqual(O.deduplicate([a,b,c]).products.map(p=>p.id),['new','other']);assert.equal(compare([a,b,c]).lowestOfferId,'other');assert.equal(O.deduplicate([b,row('L',{...b,id:'L',offerSize:'L'})]).products.length,2);
 const conflicts=O.deduplicate([b,{...b,id:'conflict',price:1}]);assert.equal(conflicts.products.length,1);assert.equal(conflicts.products[0].comparisonConflict,true);
 const expired={...b,id:'expired-newer',checkedAt:now-500,expiresAt:now-1};assert.equal(C.validateSnapshot({version:1,generatedAt:now,products:[a,expired]},now).length,0,'newer expired evidence cannot revive the old cheap record');
});
test('organic ranking excludes sponsored placements, preserves affiliate disclosure and exact offer-size filters',()=>{
 const organic=row('organic',{price:49000}),affiliate=row('affiliate',{commercial:{sponsored:false,affiliate:true,label:'TEST approved affiliate'}}),ad=row('ad',{price:1000,commercial:{sponsored:true,affiliate:false,label:'TEST approved advertisement'}}),large=row('L',{offerSize:'L'}),sold=row('sold',{stock:'out_of_stock'}),unknown=row('unknown',{stock:'unknown'});
 const result=C.search({version:1,generatedAt:now,products:[organic,affiliate,ad,large,sold,unknown]},{category:'bottoms',type:'slacks',color:'black',gender:'men',style:'all',occasion:'all',budget:50000,currency:'KRW'},{now,size:'M'});assert.deepEqual(result.matches.map(r=>r.product.id),['affiliate','organic']);assert.deepEqual(result.sponsored.map(r=>r.product.id),['ad']);assert.deepEqual(result.unavailable.map(p=>p.id),['sold','unknown']);assert.equal(result.matches[0].product.commercial.affiliate,true);
});
