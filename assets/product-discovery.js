/* Public official-page observations, never an image/feed permission grant. */
'use strict';
((root,factory)=>{
 const common=typeof module==='object'&&module.exports;
 const api=factory(common?require('./shopping-query.js'):root.A1ShoppingQuery,
  ()=>common?require('./proportion-recommendations.js'):root.A1ProportionRecommendations);
 if(common)module.exports=api;else root.A1ProductDiscovery=api;
})(globalThis,(Q,getProportionRecommendations)=>{
 const rowFields=['id','name','brand','retailerName','type','category','color','gender','fit','price','currency','priceKind','priceNote','sizes','productUrl','sourceUrl','checkedAt','stock','imageUrl','imageRights','fittingRights','sourceNote','observedFeatures'];
 const categories=['tops','bottoms','outerwear','dresses','accessories'];
 const types=['clothing','tshirt','slacks','jeans','trousers','shirt','knit','cardigan','jacket','coat','dress'];
 const fits=['any','semiwide','oversized','relaxed','wide','straight','slim','regular'];
 const colors=['any','black','white','navy','beige','grey'];
 const typeCategory={tshirt:'tops',shirt:'tops',knit:'tops',cardigan:'tops',slacks:'bottoms',jeans:'bottoms',trousers:'bottoms',jacket:'outerwear',coat:'outerwear',dress:'dresses'};
 const cardiganLabel=/가디건|카디건|\bcardigans?\b/i;
 const sleepwearLabel=/파자마|잠옷|\b(?:pajamas?|pyjamas?|sleepwear)\b/i;
 const tuxedoLabel=/턱시도|\btuxedos?\b/i;
 const purposeLabels={
  work:/출근용|오피스(?:룩)?|비즈니스 캐주얼|\b(?:office|workwear|business casual)\b/i,
  event:/하객|격식|포멀|턱시도|\b(?:wedding|formal|tuxedo)\b/i,
  sport:/러닝|조깅|요가|피트니스|트레이닝|스포츠웨어|운동용|\b(?:running|training|yoga|athletic|sportswear|workout)\b/i,
  daily:/데일리|일상용|평상복|\b(?:everyday|daily)\b/i
 };
 const coordinationTypes={
  work:['shirt','slacks','knit','cardigan','jacket','coat'],
  event:['shirt','slacks','jacket','dress'],
  daily:['tshirt','shirt','knit','cardigan','jeans','slacks','trousers','jacket','coat','dress']
 };
 const styleLabels={
  minimal:/미니멀|\bminimal(?:ist)?\b/i,
  casual:/캐주얼|\bcasual\b/i,
  classic:/클래식|\bclassic\b/i,
  streetwear:/스트리트(?:웨어)?|\bstreetwear\b/i
 };
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
  out.size=out.size.trim();
  return out;
 }
 function typeMatches(product,type){
  return type==='clothing'||product.type===type
   ||type==='trousers'&&product.category==='bottoms'
   ||type==='knit'&&product.type==='cardigan'
   ||type==='cardigan'&&product.type==='knit'&&cardiganLabel.test(product.name);
 }
 function purposeMatch(product,purpose,observedText){
  if(purpose==='any')return 0;
  if(sleepwearLabel.test(observedText)||purpose==='work'&&tuxedoLabel.test(observedText))return -1;
  if(purposeLabels[purpose].test(observedText))return 2;
  // Require an observed activity cue for sports. For other occasions, a
  // compatible category can support a styling suggestion, not a seller claim.
  if(coordinationTypes[purpose]?.includes(product.type))return 1;
  return purpose==='sport'||purpose==='event'?-1:0;
 }
 function search(snapshot,input,{now=Date.now(),profile}={}){
  const products=validateSnapshot(snapshot,{now}),p=conditions(input),candidates=[],budgetUnconfirmed=[],excluded=[];
  const purpose=p.purpose!=='any'?p.purpose:p.occasion==='casual'?'daily':p.occasion==='all'?'any':p.occasion;
  const proportions=profile?getProportionRecommendations():null;
  const rank=(a,b)=>b.confirmed-a.confirmed||b.purpose-a.purpose||b.style-a.style
   ||b.proportionCount-a.proportionCount
   ||Number(b.row.product.stock==='in_stock')-Number(a.row.product.stock==='in_stock')
   ||Number(b.row.product.price!==null)-Number(a.row.product.price!==null)||b.row.product.checkedAt-a.row.product.checkedAt;
  for(const product of products){
   let reason=null;
   const observedText=[product.name,...product.observedFeatures].join(' · ');
   const suitability=purposeMatch(product,purpose,observedText);
   if(product.stock==='out_of_stock')reason='out_of_stock';
   else if(p.category!=='all'&&product.category!==p.category)reason='category_mismatch';
   else if(!typeMatches(product,p.type))reason='type_mismatch';
   else if(p.color!=='any'&&product.color!=='any'&&product.color!==p.color)reason='color_mismatch';
   else if(p.gender!=='all'&&!['unisex','unknown',p.gender].includes(product.gender))reason='collection_mismatch';
   else if(p.fit!=='any'&&product.fit!=='any'&&product.fit!==p.fit)reason='fit_mismatch';
   else if(p.size&&product.sizes.length&&!product.sizes.some(s=>s.toLowerCase()===p.size.toLowerCase()))reason='size_mismatch';
   else if(p.budget!==null&&product.price!==null&&product.price>p.budget)reason='over_observed_budget';
   else if(suitability<0)reason='purpose_not_supported';
   if(reason){excluded.push(Object.freeze({product,reason}));continue;}
   const reasons=['official_page_observation'],warnings=['image_rights_unverified','fitting_unavailable','stock_must_be_rechecked'];
   let confirmed=0;
   if(p.type!=='clothing')reasons.push('type_matches');
   else if(p.category!=='all')reasons.push('category_matches');
   for(const [requested,known,match,unconfirmed] of [
    [p.color!=='any',product.color!=='any','color_matches','color_unconfirmed'],
    [p.gender!=='all',product.gender!=='unknown','collection_matches','collection_unconfirmed'],
    [p.fit!=='any',product.fit!=='any','fit_matches','fit_unconfirmed'],
    [Boolean(p.size),product.sizes.length>0,'size_matches','size_unconfirmed']
   ]){
    if(!requested)continue;
    if(known){reasons.push(match);confirmed++;}
    else warnings.push(unconfirmed);
   }
   const style=Number(p.style!=='all'&&styleLabels[p.style].test(observedText));
   if(style)reasons.push('style_label_matches');
   else if(p.style!=='all')warnings.push('style_unconfirmed');
   if(suitability===2)reasons.push('purpose_label_matches');
   else if(purpose!=='any'){
    if(suitability===1)reasons.push('purpose_coordination_hint');
    warnings.push('occasion_unconfirmed');
   }
   if(product.stock==='unknown')warnings.push('stock_unconfirmed');
   if(product.price===null)warnings.push('price_unconfirmed');else{warnings.push('price_not_live');if(p.budget!==null)reasons.push('observed_price_within_budget');}
   if(now-product.checkedAt>24*3600000)warnings.push('observation_stale');
   const matches=proportions?.evidence(product,profile).filter(reason=>p.fit==='any'||reason.attribute!=='fit')||[];
   const row=Object.freeze({product,reasons:Object.freeze(reasons),warnings:Object.freeze(warnings),canFit:false,
    ...(matches.length?{proportionReasons:Object.freeze(matches)}:{})});
   (p.budget!==null&&product.price===null?budgetUnconfirmed:candidates).push({row,confirmed,purpose:suitability,style,proportionCount:matches.length});
  }
  return Object.freeze({candidates:Object.freeze(candidates.sort(rank).map(item=>item.row)),budgetUnconfirmed:Object.freeze(budgetUnconfirmed.sort(rank).map(item=>item.row)),excluded:Object.freeze(excluded),snapshotCount:products.length});
 }
 return Object.freeze({validateSnapshot,search,safeProductUrl});
});
