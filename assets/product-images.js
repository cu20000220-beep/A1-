/* Operator-authorized product images; no consumer photos or external AI calls. */
'use strict';
((root,factory)=>{
 if(typeof module==='object'&&module.exports)module.exports=factory(require('./product-discovery.js'),true);
 else root.A1ProductImages=factory(root.A1ProductDiscovery);
})(globalThis,(D,server=false)=>{
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
 function inspectManifest(manifest,observations,{now=Date.now()}={}){
  time(now,now);fields(manifest,['version','authorization','products']);
  if(manifest.version!==1||!Array.isArray(manifest.products)||manifest.products.length>100)fail('product_images_invalid');
  const products=D.validateSnapshot(observations,{now}),a=manifest.authorization,ids=new Set();
  // An empty published manifest carries no image permission or assets.
  if(a===null&&manifest.products.length===0)return {entries:Object.freeze([]),validUntil:null};
  fields(a,['basis','reference','recordedAt','validUntil','display','local2DFitting','externalProcessing']);
  if(a.basis!=='operator-attestation'||typeof a.reference!=='string'||!/^[a-z0-9-]{1,100}$/.test(a.reference)||a.display!==true||a.local2DFitting!==true||a.externalProcessing!==false)fail('product_image_authorization');
  time(a.recordedAt,now);if(!Number.isSafeInteger(a.validUntil)||a.validUntil<=a.recordedAt||a.validUntil-a.recordedAt>7*86400000)fail('product_image_authorization_expired');
  const entries=Object.freeze(manifest.products.map(entry=>{
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
  return {entries,validUntil:a.validUntil};
 }
 function validateManifest(manifest,observations,{now=Date.now()}={}){
  const {entries,validUntil}=inspectManifest(manifest,observations,{now});
  if(validUntil!==null&&validUntil<=now)fail('product_image_authorization_expired');
  return entries;
 }
 function fittingProduct(manifest,observations,id,{now=Date.now()}={}){
  try{const images=validateManifest(manifest,observations,{now}),image=images.find(e=>e.id===id),product=D.validateSnapshot(observations,{now}).find(p=>p.id===id);if(!image||!product||product.stock==='out_of_stock')return null;
   return Object.freeze({...product,imageUrl:image.imageUrl,fittingImageUrl:image.imageUrl,imageKind:image.imageKind,delivery:image.delivery,expiresAt:manifest.authorization.validUntil,sourceKind:'operator-authorized-observation',authorizationBasis:'operator-attestation'});
  }catch{return null;}
 }
 // Structural inspection is available to the Node packager. The browser
 // receives only image validators that also enforce current authorization.
 return Object.freeze({validateManifest,fittingProduct,safeRemoteImageUrl,...(server?{inspectManifest}:{})});
});
