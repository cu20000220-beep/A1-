/* Offline exact-variant policy for reviewed public snapshots; no FX or fee guesses. */
'use strict';
((root,factory)=>{const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.A1OfferComparison=api;})(globalThis,()=>{
 const fold=v=>typeof v==='string'?v.normalize('NFC').trim().toLowerCase():'';
 const declared=v=>typeof v==='string'&&v.trim()&&!['unknown','미확인','all'].includes(fold(v));
 function validGtin(v){if(typeof v!=='string'||! /^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(v)||/^0+$/.test(v))return false;let sum=0,weight=3;for(let i=v.length-2;i>=0;i--){sum+=Number(v[i])*weight;weight=weight===3?1:3;}return (10-sum%10)%10===Number(v.at(-1));}
 function identity(p){if(!p||!['brand','color','offerSize','sizeSystem'].every(k=>declared(p[k]))||!['new','used'].includes(p.condition))return null;
  const key=p.gtin?validGtin(p.gtin)?'gtin:'+p.gtin.padStart(14,'0'):null:declared(p.mpn)?'mpn:'+p.mpn.trim():null;
  return key?JSON.stringify([fold(p.brand),key,fold(p.color),p.offerSize.trim(),p.sizeSystem.trim(),p.condition]):null;
 }
 function deduplicate(products){const map=new Map(),conflicts=[];
  for(const p of products){const key=JSON.stringify([fold(p.retailerName),p.productUrl,fold(p.brand),fold(p.color),p.offerSize||[...(p.sizes||[])].sort().join('|'),p.sizeSystem||'',p.condition||'',p.currency,p.costDestination||'',p.purchaseConditions||'']);const old=map.get(key);if(!old){map.set(key,p);continue;}
   if(p.checkedAt>old.checkedAt)map.set(key,p);else if(p.checkedAt===old.checkedAt){const same=['price','shipping','tax','duties','stock','gtin','mpn','purchaseConditionsVerified'].every(k=>p[k]===old[k]);if(!same){conflicts.push(key);map.set(key,{...old,comparisonConflict:true});}}
  }return {products:[...map.values()],conflicts};
 }
 function compare(products,selection,{destination='KR',currency=selection?.currency||'KRW',now=Date.now()}={}){
  if(!Array.isArray(products)||products.length>100||!Number.isSafeInteger(now)||! /^[A-Z]{2}$/.test(destination))throw TypeError('invalid_offer_comparison');
  const selected=products.find(p=>p.id===selection?.id),key=identity(selected);if(!key)return {status:'identity_unconfirmed',rows:[],lowestOfferId:null,minimumAmount:null,duplicates:0};
  const d=deduplicate(products),matches=d.products.filter(p=>identity(p)===key),scale=['KRW','JPY'].includes(currency)?1:100;
  const rows=matches.map(p=>{const reasons=[];const fresh=p.sourceVerified===true&&Number.isSafeInteger(p.checkedAt)&&p.checkedAt<=now&&now-p.checkedAt<=86400000&&p.expiresAt>now;if(!fresh)reasons.push('stale');if(p.stock!=='in_stock')reasons.push(p.stock==='out_of_stock'?'out_of_stock':'stock_unknown');if(p.currency!==currency)reasons.push('different_currency');
   if(!Array.isArray(p.shippingCountries)||!p.shippingCountries.includes(destination))reasons.push('delivery_unconfirmed');if(p.costDestination!==destination)reasons.push('cost_destination_unknown');
   const fees=['shipping','tax','duties'];for(const field of fees)if(!Number.isFinite(p[field])||p[field]<0)reasons.push(field+'_unknown');if(!Number.isFinite(p.price)||p.price<=0)reasons.push('price_unknown');if(p.purchaseConditionsVerified!==true)reasons.push('purchase_conditions_unknown');if(p.purchaseConditions)reasons.push('conditional_purchase');if(p.comparisonConflict)reasons.push('conflicting_updates');
   const complete=reasons.length===0;const amount=complete?[p.price,p.shipping,p.tax,p.duties].reduce((sum,v)=>sum+Math.round(v*scale),0)/scale:null;
   return {...p,total:amount,eligible:complete,reasons};
  });const eligible=rows.filter(r=>r.eligible).sort((a,b)=>a.total-b.total||a.id.localeCompare(b.id));
  const sellerCount=new Set(eligible.map(p=>fold(p.retailerName))).size,ranked=sellerCount>=2;
  return {status:'exact_variant',rows,lowestOfferId:ranked?eligible[0].id:null,minimumAmount:ranked?eligible[0].total:null,duplicates:products.length-d.products.length,destination,currency,verifiedSellerCount:sellerCount};
 }
 return Object.freeze({validGtin,identity,deduplicate,compare});
});
