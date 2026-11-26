/* Public official-page observations, never an image/feed permission grant. */
'use strict';
((root,factory)=>{
 const common=typeof module==='object'&&module.exports;
 const api=factory(common?require('./shopping-query.js'):root.A1ShoppingQuery,
  ()=>common?require('./proportion-recommendations.js'):root.A1ProportionRecommendations);
 if(common)module.exports=api;else root.A1ProductDiscovery=api;
})(globalThis,(Q,getProportionRecommendations)=>{
 const rowFields=['id','name','brand','retailerName','type','category','color','gender','fit','price','currency','priceKind','priceNote','sizes','productUrl','sourceUrl','checkedAt','stock','imageUrl','imageRights','fittingRights','sourceNote','observedFeatures','material','seasons','sizeChart'];
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
 const explicitSeasons={
  spring:['봄','봄용','봄 시즌','spring','spring season'],
  summer:['여름','여름용','여름 시즌','summer','summer season'],
  autumn:['가을','가을용','가을 시즌','autumn','autumn season','fall','fall season'],
  winter:['겨울','겨울용','겨울 시즌','winter','winter season']
 };
 const allSeasonLabels=['사계절','사계절용','all season','all seasons','year round'];
 const thermalLabels=['보온 안감','방한','보온 기능','thermal lining','insulated lining'];
 const fleeceLabels=['플리스','기모','플리스 안감','기모 안감','fleece','fleece lined','brushed lining'];
 const cardiganFeatures=['카디건','가디건','여성 카디건','여성 가디건','남성 카디건','남성 가디건','cardigan'];
 const shortSleeveFeatures=['반소매','반팔','짧은 소매','short sleeve','short sleeves'];
 const fiberLabel=/^(면|코튼|폴리에스터|나일론|울|양모|린넨|리넨|레이온|스판덱스|cotton|polyester|nylon|wool|linen|rayon|spandex|elastane)\s*(\d{1,3}(?:\.\d{1,2})?)\s*%$/i;
 const measures=['chest','waist','hips','inseam','shoulders','length'];
 const fail=code=>{throw TypeError(code);};
 const record=(value,fields)=>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!fields.includes(key)))fail('discovery_fields_invalid');};
 const text=(value,max)=>{if(typeof value!=='string'||!value.trim()||value.length>max||/[\u0000-\u001f<>]/u.test(value))fail('discovery_text_invalid');return value.trim().normalize('NFC');};
 const time=(value,now)=>{if(!Number.isSafeInteger(value)||value<=0||value>now)fail('discovery_time_invalid');return value;};
 const knownChoice=value=>value!==null&&value!=='any';
 const foldLabel=value=>value.normalize('NFKC').trim().toLowerCase().replace(/[\s_-]+/g,' ');
 function material(value,features){
  if(value!=null)return text(value,120);
  for(const raw of features){
   const label=raw.normalize('NFKC').match(fiberLabel);
   if(label&&Number(label[2])>0&&Number(label[2])<=100)return `${label[1]} ${label[2]}%`;
  }
  return null;
 }
 function seasons(value,features){
  if(value!=null){
   if(!Array.isArray(value)||!value.length||value.some(season=>!Q.SEASONS.includes(season))||new Set(value).size!==value.length)fail('discovery_season_invalid');
   return Object.freeze(Q.SEASONS.filter(season=>value.includes(season)));
  }
  const labels=new Set(features.map(foldLabel));
  const present=Q.SEASONS.filter(season=>allSeasonLabels.some(label=>labels.has(label))||explicitSeasons[season].some(label=>labels.has(label)));
  return present.length?Object.freeze(present):null;
 }
 function sizeChart(value,sizes){
  if(value==null)return null;
  record(value,['unit','kind','rows']);
  if(value.unit!=='cm'||!['garment','body','unknown'].includes(value.kind)||!Array.isArray(value.rows)||value.rows.length>30||value.kind==='unknown'&&value.rows.length)fail('discovery_size_chart_invalid');
  const used=new Set();
  const rows=value.rows.map(row=>{
   record(row,['size',...measures]);
   const size=text(row.size,30);
   if(!sizes.includes(size)||used.has(size))fail('discovery_size_chart_invalid');
   used.add(size);
   const dimensions=Object.entries(row).filter(([name])=>name!=='size');
   if(!dimensions.length||dimensions.some(([,n])=>!Number.isFinite(n)||n<=0||n>300))fail('discovery_size_chart_invalid');
   return Object.freeze({size,...Object.fromEntries(dimensions)});
  });
  return rows.length?Object.freeze({unit:'cm',kind:value.kind,rows:Object.freeze(rows)}):null;
 }
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
    ||typeCategory[value.type]&&typeCategory[value.type]!==value.category||value.color!==null&&!colors.includes(value.color)||!['men','women','unisex','unknown'].includes(value.gender)
    ||value.fit!==null&&!fits.includes(value.fit)||value.currency!=='KRW'||!['unknown','out_of_stock','in_stock'].includes(value.stock))fail('discovery_product_invalid');
   if(!safeProductUrl(value.productUrl)||value.sourceUrl!==value.productUrl||urls.has(value.productUrl))fail('discovery_product_url_invalid');
   if(value.imageUrl!==null||value.imageRights!=='unverified'||value.fittingRights!=='unverified')fail('discovery_permission_escalation');
   if(value.price===null?value.priceKind!=='unconfirmed':!Number.isSafeInteger(value.price)||value.price<=0||value.price>1e9||value.priceKind!=='page-observation')fail('discovery_price_invalid');
   if(!Array.isArray(value.sizes)||value.sizes.length>30||!Array.isArray(value.observedFeatures)||value.observedFeatures.length>30)fail('discovery_list_invalid');
   const checkedAt=time(value.checkedAt,now);if(checkedAt>observedAt)fail('discovery_time_invalid');
   const sizes=Object.freeze([...new Set(value.sizes.map(v=>text(v,30)))]),observedFeatures=Object.freeze([...new Set(value.observedFeatures.map(v=>text(v,100)))]);
   const product={...value,name:text(value.name,160),brand:text(value.brand,80),retailerName:text(value.retailerName,100),priceNote:text(value.priceNote,500),sourceNote:text(value.sourceNote,800),sizes,observedFeatures,checkedAt,material:material(value.material,observedFeatures),seasons:seasons(value.seasons,observedFeatures),sizeChart:sizeChart(value.sizeChart,sizes)};
   ids.add(product.id);urls.add(product.productUrl);return Object.freeze(product);
  }));
 }
 function conditions(value){
  if(typeof value==='string')value=Q.parse(value);
  record(value,['type','category','color','gender','fit','budget','currency','style','purpose','season','occasion','size']);
  const out={type:value.type??'clothing',category:value.category??'all',color:value.color??'any',gender:value.gender??'all',fit:value.fit??'any',budget:value.budget??null,currency:value.currency??'KRW',style:value.style??'all',purpose:value.purpose??'any',season:value.season??'any',occasion:value.occasion??'all',size:value.size??''};
  if(!types.includes(out.type)||!['all',...categories].includes(out.category)||!colors.includes(out.color)||!['all','men','women'].includes(out.gender)||!fits.includes(out.fit)
   ||out.currency!=='KRW'||out.budget!==null&&(!Number.isSafeInteger(out.budget)||out.budget<0||out.budget>1e9)||!['all','minimal','casual','classic','streetwear'].includes(out.style)
   ||!['any','work','event','sport','daily'].includes(out.purpose)||!['any',...Q.SEASONS].includes(out.season)||!['all','work','event','casual'].includes(out.occasion)||typeof out.size!=='string'||out.size.length>30)fail('discovery_conditions_invalid');
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
 function seasonMatch(product,season){
  if(season==='any')return null;
  if(product.seasons)return product.seasons.includes(season)?Object.freeze({season,basis:'source-label'}):null;
  const labels=new Set(product.observedFeatures.map(foldLabel));
  const has=list=>list.some(value=>labels.has(value));
  let feature;
  if(season==='summer'&&['tops','outerwear','dresses'].includes(product.category)&&has(shortSleeveFeatures))feature='short_sleeves';
  else if((season==='spring'||season==='autumn')&&product.category==='tops'&&(product.type==='cardigan'||product.type==='knit'&&has(cardiganFeatures)))feature='cardigan_layer';
  else if(season==='winter'&&has(thermalLabels))feature='thermal_lining';
  else if(season==='winter'&&has(fleeceLabels))feature='fleece';
  return feature?Object.freeze({season,basis:'observed-feature',feature}):null;
 }
 function search(snapshot,input,{now=Date.now(),profile}={}){
  const products=validateSnapshot(snapshot,{now}),p=conditions(input),candidates=[],budgetUnconfirmed=[],excluded=[];
  const purpose=p.purpose!=='any'?p.purpose:p.occasion==='casual'?'daily':p.occasion==='all'?'any':p.occasion;
  const proportions=profile?getProportionRecommendations():null;
  const rank=(a,b)=>b.confirmed-a.confirmed||b.purpose-a.purpose||b.style-a.style
   ||b.proportionCount-a.proportionCount
   ||b.seasonConfidence-a.seasonConfidence
   ||Number(b.row.product.stock==='in_stock')-Number(a.row.product.stock==='in_stock')
   ||b.priceFreshness-a.priceFreshness
   ||Number(b.row.product.price!==null)-Number(a.row.product.price!==null)||b.row.product.checkedAt-a.row.product.checkedAt;
  for(const product of products){
   let reason=null;
   const observedText=[product.name,...product.observedFeatures].join(' · ');
   const suitability=purposeMatch(product,purpose,observedText);
   const seasonEvidence=seasonMatch(product,p.season);
   const stale=now-product.checkedAt>24*3600000;
   if(product.stock==='out_of_stock')reason='out_of_stock';
   else if(p.category!=='all'&&product.category!==p.category)reason='category_mismatch';
   else if(!typeMatches(product,p.type))reason='type_mismatch';
   else if(p.color!=='any'&&knownChoice(product.color)&&product.color!==p.color)reason='color_mismatch';
   else if(p.gender!=='all'&&!['unisex','unknown',p.gender].includes(product.gender))reason='collection_mismatch';
   else if(p.fit!=='any'&&knownChoice(product.fit)&&product.fit!==p.fit)reason='fit_mismatch';
   else if(p.size&&product.sizes.length&&!product.sizes.some(s=>s.toLowerCase()===p.size.toLowerCase()))reason='size_mismatch';
   else if(p.budget!==null&&product.price!==null&&product.price>p.budget)reason='over_observed_budget';
   else if(suitability<0)reason='purpose_not_supported';
   else if(p.season!=='any'&&!seasonEvidence)reason=product.seasons?'season_mismatch':'season_unconfirmed';
   if(reason){excluded.push(Object.freeze({product,reason}));continue;}
   const reasons=['official_page_observation'],warnings=['image_rights_unverified','fitting_unavailable','stock_must_be_rechecked'];
   let confirmed=0;
   if(p.type!=='clothing')reasons.push('type_matches');
   else if(p.category!=='all')reasons.push('category_matches');
   for(const [requested,known,match,unconfirmed] of [
    [p.color!=='any',knownChoice(product.color),'color_matches','color_unconfirmed'],
    [p.gender!=='all',product.gender!=='unknown','collection_matches','collection_unconfirmed'],
    [p.fit!=='any',knownChoice(product.fit),'fit_matches','fit_unconfirmed'],
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
   if(stale)warnings.push('observation_stale');
   if(seasonEvidence)reasons.push(seasonEvidence.basis==='source-label'?'season_label_matches':'season_feature_hint');
   const matches=proportions?.evidence(product,profile)||[];
   const row=Object.freeze({product,reasons:Object.freeze(reasons),warnings:Object.freeze(warnings),canFit:false,
    ...(matches.length?{proportionReasons:Object.freeze(matches)}:{}),...(seasonEvidence?{seasonEvidence}:{})});
   const proportionCount=proportions?.weight(matches,{ignoreFit:p.fit!=='any'})||0;
   const seasonConfidence=seasonEvidence?.basis==='source-label'?2:seasonEvidence?1:0;
   const priceFreshness=!stale&&product.price!==null?1:0;
   (p.budget!==null&&product.price===null?budgetUnconfirmed:candidates).push({row,confirmed,purpose:suitability,style,proportionCount,seasonConfidence,priceFreshness});
  }
  return Object.freeze({candidates:Object.freeze(candidates.sort(rank).map(item=>item.row)),budgetUnconfirmed:Object.freeze(budgetUnconfirmed.sort(rank).map(item=>item.row)),excluded:Object.freeze(excluded),snapshotCount:products.length});
 }
 function currentlyAvailable(product,{now=Date.now()}={}){
  return Number.isSafeInteger(now)&&product?.stock==='in_stock'&&Number.isSafeInteger(product.checkedAt)
   &&product.checkedAt>0&&product.checkedAt<=now&&now-product.checkedAt<24*3600000;
 }
 return Object.freeze({validateSnapshot,search,safeProductUrl,currentlyAvailable});
});
