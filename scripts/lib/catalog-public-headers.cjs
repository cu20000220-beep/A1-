'use strict';
// Call only after the private manifest/hash validation. This permits image
// display for reviewed public products, never external scripts/API connections.
function catalogPublicHeaders(template,products){
 if(typeof template!=='string'||!Array.isArray(products)||products.length>100)throw TypeError('invalid_catalog_headers');
 const origins=new Set();for(const p of products){let u;try{u=new URL(p.imageUrl);}catch{throw TypeError('invalid_catalog_image');}
  if(p.sourceVerified!==true||p.fixture||p.demo||u.protocol!=='https:'||u.username||u.password||u.port||u.hash||!/^([a-z0-9-]+\.)+[a-z]{2,63}$/.test(u.hostname))throw TypeError('unreviewed_catalog_image');
  origins.add(u.origin);
 }
 if(!origins.size)return template;
 const lines=template.split('\n'),start=lines.indexOf('/stylist*');if(start<0||lines.lastIndexOf('/stylist*')!==start)throw TypeError('stylist_policy_missing');
 let found=false;for(let i=start+1;i<lines.length&&(!lines[i]||/^\s/.test(lines[i]));i++)if(/^\s+Content-Security-Policy:/.test(lines[i])){
  if(found||!/(?:;\s*)img-src 'self';/.test(lines[i]))throw TypeError('unexpected_stylist_policy');
  lines[i]=lines[i].replace(/(;\s*)img-src 'self';/,(_,prefix)=>prefix+"img-src 'self' "+[...origins].sort().join(' ')+';');found=true;
 }
 if(!found)throw TypeError('stylist_policy_missing');return lines.join('\n');
}
module.exports={catalogPublicHeaders};
