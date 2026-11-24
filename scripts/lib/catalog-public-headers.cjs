'use strict';
// Only the privately reviewed build snapshot can extend image origins. This
// never permits external scripts, API connections or personal-photo uploads.
function catalogPublicHeaders(template,products,imageContext){
 if(typeof template!=='string'||!Array.isArray(products)||products.length>100)throw TypeError('invalid_catalog_headers');
 const origins=new Set(),fittingOrigins=new Set();
 function reviewedOrigin(value,code){let u;try{u=new URL(value);}catch{throw TypeError(code);}
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||!/^([a-z0-9-]+\.)+[a-z]{2,63}$/.test(u.hostname))throw TypeError(code);return u.origin;
 }
 for(const p of products){
  if(p.sourceVerified!==true||p.fixture||p.demo)throw TypeError('unreviewed_catalog_image');
  origins.add(reviewedOrigin(p.imageUrl,'unreviewed_catalog_image'));
  if(p.fittingImageUrl!=null){if(p.fittingRightsVerified!==true)throw TypeError('unreviewed_fitting_image');fittingOrigins.add(reviewedOrigin(p.fittingImageUrl,'unreviewed_fitting_image'));}
 }
 // Explicit operator authorization is separate from a supplier-feed contract.
 // Validate the complete manifest rather than trusting a client-supplied host.
 if(imageContext){
  const images=require('../../assets/product-images.js').validateManifest(imageContext.manifest,imageContext.observations,{now:imageContext.now});
  for(const image of images)if(image.delivery==='remote-reference'){
   const origin=reviewedOrigin(image.imageUrl,'unreviewed_operator_image');origins.add(origin);fittingOrigins.add(origin);
  }
 }
 if(!origins.size)return template;
 const lines=template.split('\n');
 function extend(route,blob,allowed){
  const start=lines.indexOf(route);if(start<0||lines.lastIndexOf(route)!==start)throw TypeError('catalog_policy_missing');
  let found=false;const initial="img-src 'self'"+(blob?' blob:':'')+';';
  for(let i=start+1;i<lines.length&&(!lines[i]||/^\s/.test(lines[i]));i++)if(/^\s+Content-Security-Policy:/.test(lines[i])){
   if(found||!lines[i].includes(initial))throw TypeError('unexpected_catalog_policy');
   lines[i]=lines[i].replace(initial,initial.slice(0,-1)+' '+[...allowed].sort().join(' ')+';');found=true;
  }
  if(!found)throw TypeError('catalog_policy_missing');
 }
 extend('/stylist*',false,origins);
 const fittingDisplayOrigins=new Set([...origins,...fittingOrigins]);
 extend('/product-lab*',true,fittingDisplayOrigins);
 extend('/fitting-studio*',true,fittingDisplayOrigins);
 return lines.join('\n');
}
module.exports={catalogPublicHeaders};
