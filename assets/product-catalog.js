/* Trusted build snapshot consumer. Never imports seller permissions from a browser file. */
'use strict';
((root,factory)=>{const api=factory(typeof module==='object'&&module.exports?require('./product-matching.js'):root.A1ProductMatching,typeof module==='object'&&module.exports?require('./offer-comparison.js'):root.A1OfferComparison);if(typeof module==='object'&&module.exports)module.exports=api;else root.A1ProductCatalog=api;})(globalThis,(M,O)=>{
 const categories=['tops','bottoms','outerwear','dresses','accessories'],types=['clothing','slacks','jeans','trousers','shirt','tshirt','knit','jacket','coat','dress'];
 const text=(s,max)=>typeof s==='string'&&s.trim().length>0&&s.length<=max;
 const safeUrl=s=>{try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash&&!['localhost','127.0.0.1','[::1]'].includes(u.hostname);}catch{return false;}};
 function validateSnapshot(snapshot,now=Date.now()){
  if(!snapshot||snapshot.version!==1||!Array.isArray(snapshot.products)||snapshot.products.length>100||snapshot.products.length&&(!Number.isSafeInteger(snapshot.generatedAt)||snapshot.generatedAt<=0||snapshot.generatedAt>now))throw TypeError('catalog_invalid');
  const ids=new Set();for(const p of snapshot.products){
   if(!p||!text(p.id,160)||ids.has(p.id)||!text(p.name,160)||!text(p.brand,80)||!text(p.retailerName,100)||!text(p.approvalId,100)||!categories.includes(p.category)||!types.includes(p.type)||!text(p.color,40)
    ||!['KRW','USD','EUR','GBP','JPY'].includes(p.currency)||!Number.isFinite(p.price)||p.price<0||p.price>1e9||p.sourceVerified!==true||p.fixture||p.demo||!['in_stock','out_of_stock','unknown'].includes(p.stock)
    ||!safeUrl(p.productUrl)||!safeUrl(p.imageUrl)||!safeUrl(p.sourceUrl)||!Number.isSafeInteger(p.checkedAt)||p.checkedAt<=0||p.checkedAt>now||!Number.isSafeInteger(p.expiresAt)||p.expiresAt<=p.checkedAt
    ||!Array.isArray(p.sizes)||p.sizes.some(s=>!text(s,30))||!Array.isArray(p.tags)||!Array.isArray(p.styles)||!Array.isArray(p.occasions))throw TypeError('catalog_invalid');
   if(p.sizeChart!==null&&(!p.sizeChart||p.sizeChart.unit!=='cm'||!['garment','body','unknown'].includes(p.sizeChart.kind)||!Array.isArray(p.sizeChart.rows)||p.sizeChart.rows.some(r=>!text(r.size,30)||Object.entries(r).some(([k,v])=>k!=='size'&&(!['chest','waist','hips','inseam','shoulders','length'].includes(k)||!Number.isFinite(v)||v<=0||v>300)))))throw TypeError('catalog_invalid');
   if(p.gtin!=null&&!O.validGtin(p.gtin)||p.offerSize!=null&&(!text(p.offerSize,30)||!p.sizes.includes(p.offerSize))||p.mpn!=null&&!text(p.mpn,120)||p.sizeSystem!=null&&!text(p.sizeSystem,30)||p.condition!=null&&!['new','used'].includes(p.condition))throw TypeError('catalog_identity_invalid');
   for(const field of ['shipping','tax','duties'])if(p[field]!=null&&(!Number.isFinite(p[field])||p[field]<0||p[field]>1e9))throw TypeError('catalog_cost_invalid');
   if(p.shippingCountries!=null&&(!Array.isArray(p.shippingCountries)||p.shippingCountries.length>30||p.shippingCountries.some(v=>typeof v!=='string'||! /^[A-Z]{2}$/.test(v)))||p.costDestination!=null&&(typeof p.costDestination!=='string'||! /^[A-Z]{2}$/.test(p.costDestination)||!p.shippingCountries?.includes(p.costDestination)))throw TypeError('catalog_destination_invalid');
   if(p.purchaseConditionsVerified!==undefined&&typeof p.purchaseConditionsVerified!=='boolean')throw TypeError('catalog_conditions_invalid');
   if(p.purchaseConditions!=null&&!text(p.purchaseConditions,300))throw TypeError('catalog_conditions_invalid');
   if(p.commercial&&(!p.commercial||typeof p.commercial.sponsored!=='boolean'||typeof p.commercial.affiliate!=='boolean'||(p.commercial.sponsored||p.commercial.affiliate)&&!text(p.commercial.label,160)))throw TypeError('catalog_commercial_invalid');
   ids.add(p.id);
  }return O.deduplicate(snapshot.products).products.filter(p=>p.expiresAt>now);
 }
 const colorMap={black:['black','검정','검은','블랙'],white:['white','흰색','화이트'],navy:['navy','남색','네이비'],beige:['beige','베이지'],grey:['grey','gray','회색','그레이','차콜']};
 function search(snapshot,conditions,{now=Date.now(),size='',query='',bodyConsent=false,metrics}={}){
  const products=validateSnapshot(snapshot,now),fold=s=>s.normalize('NFC').trim().toLowerCase();
  if(!conditions||typeof size!=='string'||size.length>30||!['all',...categories].includes(conditions.category)||!['any',...Object.keys(colorMap)].includes(conditions.color))throw TypeError('conditions_invalid');
  const brands=[...new Set(products.map(p=>fold(p.brand)))].filter(brand=>brand.length>1&&fold(query).includes(brand));
  const broad=conditions.type==='clothing'&&conditions.category==='all'&&conditions.color==='any'&&conditions.gender==='all'&&conditions.style==='all'&&conditions.occasion==='all'&&conditions.budget===null;
  const textFilter=fold(query)&&broad&&!/^(의류|옷|clothing|clothes)$/i.test(query.trim());
  const filtered=products.filter(p=>(conditions.category==='all'||p.category===conditions.category)&&(conditions.type==='clothing'||p.type===conditions.type)&&(conditions.color==='any'||colorMap[conditions.color].includes(fold(p.color)))&&(!size||!p.sizes.length||p.sizes.some(v=>fold(v)===fold(size)))&&(!size||!p.offerSize||fold(p.offerSize)===fold(size))&&(!brands.length||brands.includes(fold(p.brand)))&&(!textFilter||fold(p.name+' '+p.brand).includes(fold(query))));
  const organic=filtered.filter(p=>!p.commercial?.sponsored),sponsored=filtered.filter(p=>p.commercial?.sponsored);
  const options={style:conditions.style,gender:conditions.gender,currency:conditions.currency,budget:conditions.budget===null?1e9:conditions.budget,size:size.length>20?'':size,color:conditions.color==='grey'?'any':conditions.color,occasion:conditions.occasion,avoid:[],bodyConsent,...(bodyConsent?{metrics}:{})};const result=M.rank(organic,options,{now,mode:'approved'});result.sponsored=M.rank(sponsored,options,{now,mode:'approved'}).matches;result.unavailable=filtered.filter(p=>p.stock!=='in_stock'&&p.currency===conditions.currency&&p.price<=options.budget&&(conditions.gender==='all'||p.gender==='unisex'||p.gender===conditions.gender));return result;
 }
 function chartComparison(product,measurements,size=''){
  if(!product.sizeChart||!product.sizeChart.rows.length||product.sizeChart.kind==='unknown')return {status:'unknown',rows:[]};
  const input={};for(const k of ['chest','waist','hips','inseam'])if(measurements?.[k]!==undefined&&measurements[k]!==null&&measurements[k]!==''){const n=Number(measurements[k]);if(!Number.isFinite(n)||n<=0||n>300)throw TypeError('measurements_invalid');input[k]=n;}
  return {status:product.sizeChart.kind,rows:product.sizeChart.rows.filter(r=>!size||r.size.toLowerCase()===size.trim().toLowerCase()).map(r=>({size:r.size,comparisons:Object.keys(input).filter(k=>Number.isFinite(r[k])).map(k=>({field:k,user:input[k],seller:r[k],difference:r[k]-input[k]}))}))};
 }
 return Object.freeze({validateSnapshot,search,chartComparison,safeUrl});
});
