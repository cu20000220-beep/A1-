'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const retailers=import('../server/global-retailers.mjs');

test('country directories expose search links only and never promise destination shipping',async()=>{
 const {listGlobalRetailers,RETAILERS}=await retailers;
 for(const country of ['KR','US','JP','GB','EU']){
  const result=listGlobalRetailers({country,destination:'JP',currency:'JPY',gender:'women',style:'minimal',brand:'A1 test',size:'M'},{language:'en'});
  assert.ok(result.retailers.length);assert.ok(result.retailers.every(row=>row.country===country&&row.integrationStatus==='search-only'&&row.shippingStatus==='unknown'&&row.liveProductFeed===false));
  assert.match(result.warnings[0],/do not confirm shipping/);
  for(const row of result.retailers){const url=new URL(row.searchUrl),known=RETAILERS.find(item=>item.id===row.id);assert.equal(url.origin,new URL(known.baseUrl).origin);assert.ok(!row.searchUrl.includes('member-id'));}
 }
});

test('filter values are bounded and cannot replace merchant origins or inject a URL',async()=>{
 const {listGlobalRetailers,retailerSearchUrl}=await retailers;
 for(const input of [{country:'ZZ'},{destination:'EU'},{currency:'BTC'},{gender:'anything'},{style:'paid=true'},{brand:'\nsecret'},{brand:'x'.repeat(121)},{minPrice:50,maxPrice:1}])assert.throws(()=>listGlobalRetailers(input),/invalid_filters/);
 assert.equal(retailerSearchUrl('unknown','test'),null);
 const malicious=retailerSearchUrl('ebay-us','https://evil.example/../?paid=true');assert.equal(new URL(malicious).hostname,'www.ebay.com');
});

test('external API adapters stay disabled without explicit server approval and credentials',async()=>{
 const {createEbayBrowseAdapter}=await import('../server/adapters/ebay-browse.mjs');
 const {createAwinFeedAdapter}=await import('../server/adapters/awin-feed.mjs');
 let calls=0;
 for(const env of [{},{ENABLE_LIVE_CATALOG:'true'},{ENABLE_LIVE_CATALOG:'true',EBAY_LIVE_APPROVED:'true',EBAY_ACCESS_TOKEN:'fixture-token-1234567890123456'}]){
  const adapter=createEbayBrowseAdapter(env,{fetchImpl:async()=>{calls++;throw new Error('must not fetch');}});
  assert.equal(adapter.status().enabled,false);await assert.rejects(adapter.search({query:'shirt'}),/not_approved_or_configured/);
 }
 assert.equal(calls,0);assert.equal(createAwinFeedAdapter().status().enabled,false);await assert.rejects(createAwinFeedAdapter().importFeed(),/approval_and_mapping/);
});

test('approved eBay discovery uses a fixed official endpoint and rejects redirects before forwarding its token',async()=>{
 const {createEbayBrowseAdapter}=await import('../server/adapters/ebay-browse.mjs');
 const env={ENABLE_LIVE_CATALOG:'true',EBAY_LIVE_APPROVED:'true',EBAY_TERMS_REVIEWED:'true',EBAY_ACCESS_TOKEN:'fixture-token-1234567890123456'};
 let calls=0;
 const adapter=createEbayBrowseAdapter(env,{fetchImpl:async(url,options)=>{
  calls++;assert.equal(new URL(url).origin,'https://api.ebay.com');assert.equal(options.redirect,'manual');
  assert.equal(options.headers['X-EBAY-C-MARKETPLACE-ID'],'EBAY_GB');return new Response(null,{status:302,headers:{Location:'https://other.example.test/'}});
 }});
 await assert.rejects(adapter.search({query:'shirt',country:'GB',destination:'GB'}),/provider_unavailable/);assert.equal(calls,1);
 const success=createEbayBrowseAdapter(env,{fetchImpl:async()=>Response.json({itemSummaries:[{itemId:'fixture',title:'Fixture shirt'}]})});
 const result=await success.search({query:'shirt'});assert.equal(result.offers.length,0);assert.equal(result.candidates[0].comparisonReady,false);assert.equal(result.incomplete,true);
});

test('clothing search query is included and combined overlong terms are rejected instead of returning null URLs',async()=>{
 const {listGlobalRetailers}=await retailers;
 const result=listGlobalRetailers({country:'US',query:'linen shirt',brand:'Fixture',size:'M'});
 assert.equal(result.filters.query,'linen shirt');
 for(const row of result.retailers)assert.match(decodeURIComponent(row.searchUrl.replace(/\+/g,' ')),/linen shirt/);
 assert.throws(()=>listGlobalRetailers({query:'q'.repeat(121)}),/invalid_filters/);
 assert.throws(()=>listGlobalRetailers({query:'q'.repeat(100),brand:'b'.repeat(30)}),/invalid_filters/);
});
