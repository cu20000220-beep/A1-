/* Public official-page observations, never an image/feed permission grant. */
'use strict';
((root,factory)=>{const api=factory(typeof module==='object'&&module.exports?require('./shopping-query.js'):root.A1ShoppingQuery);if(typeof module==='object'&&module.exports)module.exports=api;else root.A1ProductDiscovery=api;})(globalThis,Q=>{
 const rowFields=['id','name','brand','retailerName','type','category','color','gender','fit','price','currency','priceKind','priceNote','sizes','productUrl','sourceUrl','checkedAt','stock','imageUrl','imageRights','fittingRights','sourceNote','observedFeatures'];
 const categories=['tops','bottoms','outerwear','dresses','accessories'];
 const types=['clothing','tshirt','slacks','jeans','trousers','shirt','knit','jacket','coat','dress'];
 const fits=['any','semiwide','oversized','relaxed','wide','straight','slim','regular'];
 const colors=['any','black','white','navy','beige','grey'];
 const typeCategory={tshirt:'tops',shirt:'tops',knit:'tops',slacks:'bottoms',jeans:'bottoms',trousers:'bottoms',jacket:'outerwear',coat:'outerwear',dress:'dresses'};
 const fail=code=>{throw TypeError(code);};
 const record=(value,fields)=>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!fields.includes(key)))fail('discovery_fields_invalid');};
 const text=(value,max)=>{if(typeof value!=='string'||!value.trim()||value.length>max||/[\u0000-\u001f<>]/u.test(value))fail('discovery_text_invalid');return value.trim().normalize('NFC');};
 const time=(value,now)=>{if(!Number.isSafeInteger(value)||value<=0||value>now)fail('discovery_time_invalid');return value;};
 function safeProductUrl(value){
  try{
   if(typeof value!=='string'||value.length>2048||/[\u0000-\u0020\u007f]/u.test(value))return false;
   const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash||url.href!==value)return false;
   if(['www.musinsa.com','musinsa.com','www.29cm.co.kr','29cm.co.kr'].includes(url.hostname))return /^\/products\/[1-9]\d*$/.test(url.pathname)&&!url.search;
   if(!['www.uniqlo.com','uniqlo.com'].includes(url.hostname)||!/^\/kr\/ko\/products\/E\d+-\d+\/\d+$/.test(url.pathname))return false;
   const seen=new Set();for(const[key,item]of url.searchParams){if(!['colorDisplayCode','sizeDisplayCode'].includes(key)||seen.has(key)||!/^\d{1,4}$/.test(item))return false;seen.add(key);}return true;
  }catch{return false;}
 }
 function validateSnapshot(snapshot,{now=Date.now()}={}){
  time(now,now);record(snapshot,['version','observedAt','products']);
  if(snapshot.version!==1||!Array.isArray(snapshot.products)||snapshot.products.length>100)fail('discovery_snapshot_invalid');
  const observedAt=time(snapshot.observedAt,now),ids=new Set(),urls=new Set();
  return Object.freeze(snapshot.products.map(value=>{
   record(value,rowFields);
   if(typeof value.id!=='string'||!/^[A-Za-z0-9_.:-]{1,160}$/.test(value.id)||ids.has(value.id)||!types.includes(value.type)||!categories.includes(value.category)
    ||typeCategory[value.type]&&typeCategory[value.type]!==value.category||!colors.includes(value.color)||!['men','women','unisex','unknown'].includes(value.gender)
    ||!fits.includes(value.fit)||value.currency!=='KRW'||!['unknown','out_of_stock','in_stock'].includes(value.stock))fail('discovery_product_invalid');
   if(!safeProductUrl(value.productUrl)||value.sourceUrl!==value.productUrl||urls.has(value.productUrl))fail('discovery_product_url_invalid');
   if(value.imageUrl!==null||value.imageRights!=='unverified'||value.fittingRights!=='unverified')fail('discovery_permission_escalation');
   if(value.price===null?value.priceKind!=='unconfirmed':!Number.isSafeInteger(value.price)||value.price<=0||value.price>1e9||value.priceKind!=='page-observation')fail('discovery_price_invalid');
   if(!Array.isArray(value.sizes)||value.sizes.length>30||!Array.isArray(value.observedFeatures)||value.observedFeatures.length>30)fail('discovery_list_invalid');
   const checkedAt=time(value.checkedAt,now);if(checkedAt>observedAt)fail('discovery_time_invalid');
   const sizes=Object.freeze([...new Set(value.sizes.map(v=>text(v,30)))]),observedFeatures=Object.freeze([...new Set(value.observedFeatures.map(v=>text(v,100)))]);
   const product={...value,name:text(value.name,160),brand:text(value.brand,80),retailerName:text(value.retailerName,100),priceNote:text(value.priceNote,500),sourceNote:text(value.sourceNote,800),sizes,observedFeatures,checkedAt};
   ids.add(product.id);urls.add(product.productUrl);return Object.freeze(product);
  }));
 }
 function conditions(value){
  if(typeof value==='string')value=Q.parse(value);
  record(value,['type','category','color','gender','fit','budget','currency','style','purpose','occasion','size']);
  const out={type:value.type??'clothing',category:value.category??'all',color:value.color??'any',gender:value.gender??'all',fit:value.fit??'any',budget:value.budget??null,currency:value.currency??'KRW',style:value.style??'all',purpose:value.purpose??'any',occasion:value.occasion??'all',size:value.size??''};
  if(!types.includes(out.type)||!['all',...categories].includes(out.category)||!colors.includes(out.color)||!['all','men','women'].includes(out.gender)||!fits.includes(out.fit)
   ||out.currency!=='KRW'||out.budget!==null&&(!Number.isSafeInteger(out.budget)||out.budget<0||out.budget>1e9)||!['all','minimal','casual','classic','streetwear'].includes(out.style)
   ||!['any','work','event','sport','daily'].includes(out.purpose)||!['all','work','event','casual'].includes(out.occasion)||typeof out.size!=='string'||out.size.length>30)fail('discovery_conditions_invalid');
  return out;
 }
 function search(snapshot,input,{now=Date.now()}={}){
  const products=validateSnapshot(snapshot,{now}),p=conditions(input),candidates=[],budgetUnconfirmed=[],excluded=[];
  for(const product of products){
   let reason=null;
   if(product.stock==='out_of_stock')reason='out_of_stock';
   else if(p.category!=='all'&&product.category!==p.category)reason='category_mismatch';
   else if(p.type!=='clothing'&&product.type!==p.type&&!(p.type==='trousers'&&product.category==='bottoms'))reason='type_mismatch';
   else if(p.color!=='any'&&product.color!=='any'&&product.color!==p.color)reason='color_mismatch';
   else if(p.gender!=='all'&&!['unisex','unknown',p.gender].includes(product.gender))reason='collection_mismatch';
   else if(p.fit!=='any'&&product.fit!=='any'&&product.fit!==p.fit)reason='fit_mismatch';
   else if(p.size&&product.sizes.length&&!product.sizes.some(s=>s.toLowerCase()===p.size.trim().toLowerCase()))reason='size_mismatch';
   else if(p.budget!==null&&product.price!==null&&product.price>p.budget)reason='over_observed_budget';
   if(reason){excluded.push(Object.freeze({product,reason}));continue;}
   const reasons=['official_page_observation'],warnings=['image_rights_unverified','fitting_unavailable','stock_must_be_rechecked'];
   if(p.type!=='clothing')reasons.push('type_matches');
   if(p.color!=='any'){if(product.color==='any')warnings.push('color_unconfirmed');else reasons.push('color_matches');}
   if(p.gender!=='all'){if(product.gender==='unknown')warnings.push('collection_unconfirmed');else reasons.push('collection_matches');}
   if(p.fit!=='any'){if(product.fit==='any')warnings.push('fit_unconfirmed');else reasons.push('fit_matches');}
   if(p.size&&!product.sizes.length)warnings.push('size_unconfirmed');
   if(p.style!=='all')warnings.push('style_unconfirmed');if(p.purpose!=='any'||p.occasion!=='all')warnings.push('occasion_unconfirmed');
   if(product.stock==='unknown')warnings.push('stock_unconfirmed');
   if(product.price===null)warnings.push('price_unconfirmed');else{warnings.push('price_not_live');if(p.budget!==null)reasons.push('observed_price_within_budget');}
   if(now-product.checkedAt>24*3600000)warnings.push('observation_stale');
   const row=Object.freeze({product,reasons:Object.freeze(reasons),warnings:Object.freeze(warnings),canFit:false});
   (p.budget!==null&&product.price===null?budgetUnconfirmed:candidates).push(row);
  }
  return Object.freeze({candidates:Object.freeze(candidates),budgetUnconfirmed:Object.freeze(budgetUnconfirmed),excluded:Object.freeze(excluded),snapshotCount:products.length});
 }
 return Object.freeze({validateSnapshot,search,safeProductUrl});
});
