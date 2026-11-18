/* Operator-authorized product images; no consumer photos or external AI calls. */
'use strict';
((root,factory)=>{const api=factory(typeof module==='object'&&module.exports?require('./product-discovery.js'):root.A1ProductDiscovery);if(typeof module==='object'&&module.exports)module.exports=api;else root.A1ProductImages=api;})(globalThis,D=>{
 const fail=code=>{throw TypeError(code);};
 const fields=(v,allowed)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!allowed.includes(k)))fail('product_image_fields');};
 const time=(v,now)=>{if(!Number.isSafeInteger(v)||v<=0||v>now)fail('product_image_time');return v;};
 function safeRemoteImageUrl(value){try{
  if(typeof value!=='string'||value.length>2048||/[\u0000-\u0020\u007f]/u.test(value))return false;
  const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||u.href!==value)return false;
  if(u.hostname==='image.msscdn.net'){
   if(!/^\/thumbnails\/images\/(?:goods_img|prd_img)\/\d{8}\/\d+\/[A-Za-z0-9_.-]+\.(?:jpg|jpeg|png|webp)$/.test(u.pathname))return false;
   return [...u.searchParams].length===1&&u.searchParams.has('w')&&/^(?:[1-9]\d{1,2}|1\d{3}|2000)$/.test(u.searchParams.get('w'));
  }
  if(u.hostname!=='img.29cm.co.kr'||!/^\/(?:item\/\d{6}\/|next-product\/\d{4}\/\d{2}\/\d{2}\/)[a-f0-9_]+\.(?:jpg|jpeg|png|webp)$/.test(u.pathname))return false;
  const pairs=[...u.searchParams];return pairs.length===2&&u.searchParams.get('format')==='webp'&&/^(?:[1-9]\d{1,2}|1\d{3}|2000)$/.test(u.searchParams.get('width'))&&new Set(pairs.map(([k])=>k)).size===2;
 }catch{return false;}}
 function validateManifest(manifest,observations,{now=Date.now()}={}){
  time(now,now);fields(manifest,['version','authorization','products']);
  if(manifest.version!==1||!Array.isArray(manifest.products)||manifest.products.length>100)fail('product_images_invalid');
  const a=manifest.authorization;fields(a,['basis','reference','recordedAt','validUntil','display','local2DFitting','externalProcessing']);
  if(a.basis!=='operator-attestation'||typeof a.reference!=='string'||!/^[a-z0-9-]{1,100}$/.test(a.reference)||a.display!==true||a.local2DFitting!==true||a.externalProcessing!==false)fail('product_image_authorization');
  time(a.recordedAt,now);if(!Number.isSafeInteger(a.validUntil)||a.validUntil<=now||a.validUntil<=a.recordedAt||a.validUntil-a.recordedAt>7*86400000)fail('product_image_authorization_expired');
  const products=D.validateSnapshot(observations,{now}),ids=new Set();
  return Object.freeze(manifest.products.map(entry=>{
   fields(entry,['id','productUrl','sourceImageUrl','imageUrl','delivery','sha256','bytes','width','height','imageKind','checkedAt']);
   const p=products.find(p=>p.id===entry.id);if(!p||ids.has(entry.id)||p.productUrl!==entry.productUrl||!safeRemoteImageUrl(entry.sourceImageUrl))fail('product_image_identity');
   if(!['unverified','isolated-garment','model-worn'].includes(entry.imageKind))fail('product_image_composition');time(entry.checkedAt,now);
   if(entry.delivery==='remote-reference'){
    if(entry.imageUrl!==entry.sourceImageUrl||[entry.sha256,entry.bytes,entry.width,entry.height].some(v=>v!==null))fail('product_image_unverified_bytes');
   }else if(entry.delivery==='local-copy'){
    if(typeof entry.imageUrl!=='string'||!/^\/assets\/catalog-images\/[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|webp)$/.test(entry.imageUrl)||!entry.imageUrl.split('/').at(-1).startsWith(entry.id+'.')||typeof entry.sha256!=='string'||!/^[a-f0-9]{64}$/.test(entry.sha256)||!Number.isInteger(entry.bytes)||entry.bytes<=0||entry.bytes>6000000||!Number.isInteger(entry.width)||!Number.isInteger(entry.height)||entry.width<=0||entry.height<=0||entry.width*entry.height>30000000)fail('product_image_copy_invalid');
   }else fail('product_image_delivery');
   ids.add(entry.id);return Object.freeze({...entry});
  }));
 }
 function fittingProduct(manifest,observations,id,{now=Date.now()}={}){
  try{const images=validateManifest(manifest,observations,{now}),image=images.find(e=>e.id===id),product=D.validateSnapshot(observations,{now}).find(p=>p.id===id);if(!image||!product||product.stock==='out_of_stock')return null;
   return Object.freeze({...product,imageUrl:image.imageUrl,fittingImageUrl:image.imageUrl,imageKind:image.imageKind,delivery:image.delivery,expiresAt:manifest.authorization.validUntil,sourceKind:'operator-authorized-observation',authorizationBasis:'operator-attestation'});
  }catch{return null;}
 }
 return Object.freeze({validateManifest,fittingProduct,safeRemoteImageUrl});
});
