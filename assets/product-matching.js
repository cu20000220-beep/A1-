/* Deterministic condition matching. No inference of body measurements or size. */
'use strict';
((root,factory)=>{const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.A1ProductMatching=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 const currencies=['KRW','USD','EUR','GBP','JPY'],styles=['all','minimal','casual','classic','streetwear'];
 const validMetrics=m=>m&&Object.keys(m).sort().join(',')==='legTorsoRatio,shoulderHipRatio'&&Number.isFinite(m.shoulderHipRatio)&&m.shoulderHipRatio>=.45&&m.shoulderHipRatio<=2.5&&Number.isFinite(m.legTorsoRatio)&&m.legTorsoRatio>=.6&&m.legTorsoRatio<=3.5;
 function preferences(value){
  if(!value||Object.keys(value).some(k=>!['style','gender','currency','budget','occasion','size','color','avoid','bodyConsent','metrics'].includes(k))||!styles.includes(value.style)||!['all','women','men','unisex'].includes(value.gender)||!currencies.includes(value.currency)
   ||!Number.isSafeInteger(value.budget)||value.budget<0||value.budget>1e9||!['all','work','casual','event'].includes(value.occasion)
   ||typeof value.size!=='string'||value.size.length>20||!['any','navy','black','white','beige'].includes(value.color)
   ||!Array.isArray(value.avoid)||value.avoid.some(v=>!['tight','cropped','low-rise','logos'].includes(v))||typeof value.bodyConsent!=='boolean'
   ||value.bodyConsent&&!validMetrics(value.metrics))throw new TypeError('invalid_preferences');
  return {style:value.style,gender:value.gender,currency:value.currency,budget:value.budget,occasion:value.occasion,size:value.size.trim(),color:value.color,avoid:[...new Set(value.avoid)],bodyConsent:value.bodyConsent,...(value.bodyConsent?{metrics:{...value.metrics}}:{})};
 }
 const fold=v=>typeof v==='string'?v.normalize('NFC').trim().toLowerCase():'';
 const colorTokens={navy:['navy','네이비'],black:['black','블랙','검정'],white:['white','화이트','흰색'],beige:['beige','베이지']};
 function rank(products,input,{now=Date.now(),mode='approved'}={}){
  const p=preferences(input);
  if(!Array.isArray(products)||products.length>100||!['approved','fixture'].includes(mode)||!Number.isSafeInteger(now)||now<=0)throw new TypeError('invalid_catalog');
  const matches=[],excluded=[];
  for(const product of products){
   let reason=null;
   if(!product||typeof product.id!=='string'||!/^[A-Za-z0-9_.:-]{1,160}$/.test(product.id)||typeof product.name!=='string'||!product.name.trim()||product.name.length>160||typeof product.brand!=='string'||!product.brand.trim()||product.brand.length>80||!Number.isFinite(product.price)||product.price<0||!currencies.includes(product.currency))reason='invalid_record';
   else if(mode==='fixture'?product.fixture!==true:product.sourceVerified!==true||product.fixture===true||product.demo===true)reason='unverified_source';
   else if(!Number.isSafeInteger(product.checkedAt)||product.checkedAt<=0||product.checkedAt>now||!Number.isSafeInteger(product.expiresAt)||product.expiresAt<=now)reason='expired_source';
   else if(product.stock!=='in_stock')reason='stock_unconfirmed';
   else if(product.currency!==p.currency)reason='currency_mismatch';
   else if(product.price>p.budget)reason='over_budget';
   else if(p.gender!=='all'&&product.gender!=='unisex'&&product.gender!==p.gender)reason='collection_mismatch';
   if(reason){excluded.push({id:product?.id||null,reason});continue;}
   const tags=Array.isArray(product.tags)?product.tags:[],sizes=Array.isArray(product.sizes)?product.sizes:product.size?[product.size]:[];
   if(!reason&&p.avoid.some(t=>tags.includes(t)))reason='avoided_design';
   if(!reason&&p.size&&sizes.length&&!sizes.some(v=>fold(v)===fold(p.size)))reason='size_unavailable';
   if(reason){excluded.push({id:product?.id||null,reason});continue;}
   let earned=20,total=20;const reasons=['within_budget'],warnings=['check_size_chart','not_fit_probability','shipping_tax_extra'];
   const add=(weight,match,code)=>{total+=weight;if(match){earned+=weight;reasons.push(code);}};
   if(p.avoid.length&&product.designTagsComplete!==true)warnings.push('design_unknown');
   if(p.style!=='all')add(25,product.styles?.includes(p.style),'style_match');
   if(p.color!=='any')add(10,colorTokens[p.color].includes(fold(product.color)),'color_match');
   if(p.occasion!=='all'){if(product.occasions?.length)add(15,product.occasions.includes(p.occasion),'occasion_match');else{total+=15;warnings.push('occasion_unknown');}}
   if(p.size){add(15,sizes.some(v=>fold(v)===fold(p.size)),'listed_size_match');if(!sizes.length)warnings.push('size_unknown');}
   if(p.gender!=='all')add(5,true,'collection_match');
   if(p.bodyConsent){
    const match=p.metrics.shoulderHipRatio>1.15?tags.some(t=>['straight','relaxed'].includes(t)):p.metrics.shoulderHipRatio<.9?tags.includes('layered'):tags.includes('balanced');
    add(10,match,'photo_ratio_reference');warnings.push('photo_ratios_not_measurements');
   }
   matches.push({product,score:Math.round(100*earned/total),reasons,warnings,...(p.bodyConsent?{bodyReference:true}:{bodyReference:false})});
  }
  matches.sort((a,b)=>b.score-a.score||a.product.price-b.product.price||a.product.id.localeCompare(b.product.id));
  return {mode,preferences:p,matches,excluded,scoreMeaning:'condition-match-not-fit-probability'};
 }
 return Object.freeze({preferences,rank,validMetrics});
});
