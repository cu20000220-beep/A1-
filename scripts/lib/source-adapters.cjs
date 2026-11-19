'use strict';
// Local adaptation only: no transport, credentials, provider calls, publication or DB.
const {INPUT_FIELDS,parseCsv}=require('./product-catalog.cjs');
const KINDS=Object.freeze(['seller-file','brand-file','official-api','affiliate-feed']);
const FIXED=new Set(['approvalId','sourceUrl','sourceKind','permissionChecked']);
const BLOCKED=new Set(['__proto__','prototype','constructor','password','secret','authorization','api_key','apikey','access_token','private_key']);
const plain=v=>v&&typeof v==='object'&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const fail=code=>{throw new TypeError(code);};
function safePath(value){if(typeof value!=='string'||!value||value.length>180)fail('invalid_mapping_path');const parts=value.split('.');if(parts.length>8||parts.some(p=>!/^([A-Za-z_][A-Za-z0-9_]*|0|[1-9]\d*)$/.test(p)||BLOCKED.has(p.toLowerCase())))fail('unsafe_mapping_path');return parts;}
function valueAt(record,parts){let value=record;for(const p of parts){if(value===null||typeof value!=='object'||!Object.hasOwn(value,p))fail('mapped_field_missing');value=value[p];}return value;}
function clone(value,depth=0){if(depth>8)fail('candidate_too_deep');if(value===null||typeof value==='boolean')return value;if(typeof value==='string'){if(value.length>8192)fail('candidate_value_too_long');return value;}if(typeof value==='number'){if(!Number.isFinite(value))fail('invalid_candidate_number');return value;}if(Array.isArray(value)){if(value.length>100)fail('candidate_list_too_long');return value.map(v=>clone(v,depth+1));}if(!plain(value))fail('invalid_candidate_value');const out={};for(const key of Object.keys(value)){if(BLOCKED.has(key.toLowerCase()))fail('unsafe_candidate_key');out[key]=clone(value[key],depth+1);}return out;}
function fixedSourceUrl(value){if(typeof value!=='string'||value.length>2048||/[\u0000-\u0020\u007f]/u.test(value))fail('invalid_source_url');let u;try{u=new URL(value);}catch{fail('invalid_source_url');}if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||[...u.searchParams.keys()].some(k=>/redirect|return|url|callback|token|secret|key|email|session|auth|signature/i.test(k)))fail('invalid_source_url');return u.href;}
function candidatePrice(value){if(typeof value==='string'){if(!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value))fail('invalid_candidate_price');value=Number(value);}if(typeof value!=='number'||!Number.isFinite(value)||value<=0||value>1e9)fail('invalid_candidate_price');return value;}
function validateCandidate(p){
 for(const key of ['id','name','brand','category','color','currency','retailer','purchaseUrl','imageUrl','lastChecked'])if(typeof p[key]!=='string'||!p[key].trim())fail('incomplete_product_'+key);
 p.price=candidatePrice(p.price);
 for(const key of ['purchaseUrl','imageUrl']){let u;try{u=new URL(p[key]);}catch{fail('invalid_candidate_url');}if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash)fail('invalid_candidate_url');}
 // Explicit unknown size information is allowed, but never invented labels.
 if(!Array.isArray(p.sizes)||p.sizes.some(v=>typeof v!=='string'||!v.trim()))fail('incomplete_product_sizes');
 if(!['men','women','unisex'].includes(p.gender)||!['in_stock','out_of_stock','unknown'].includes(p.stock))fail('incomplete_product_availability');
 // Strict dates, currencies, chart semantics, provenance, domains, price units
 // and permission hashes are checked again by the existing catalog importer.
 return p;
}
function createSourceAdapter(kind,{approvalId,sourceUrl,mapping={},defaults={}}={}){
 if(!KINDS.includes(kind)||typeof approvalId!=='string'||!/^[A-Za-z0-9_.:-]{1,120}$/.test(approvalId)||!plain(mapping)||!plain(defaults))fail('invalid_adapter_config');
 const source=fixedSourceUrl(sourceUrl),fields=new Set([...INPUT_FIELDS,'sourceKind']);
 const map=Object.entries(mapping).map(([target,p])=>{if(!fields.has(target)||FIXED.has(target))fail('unapproved_mapping_target');return [target,safePath(p)];});
 for(const key of Object.keys(defaults))if(!fields.has(key)||['approvalId','sourceUrl','sourceKind'].includes(key))fail('unapproved_default_field');
 if(Object.hasOwn(defaults,'permissionChecked')&&typeof defaults.permissionChecked!=='boolean')fail('invalid_permission_default');
 for(const [target]of map)if(Object.hasOwn(defaults,target))fail('ambiguous_mapping_default');
 const reviewedDefaults=clone(defaults),canonical=kind==='seller-file'||kind==='brand-file';
 if(!canonical&&Object.hasOwn(reviewedDefaults,'stock')&&reviewedDefaults.stock!=='unknown')fail('availability_mapping_required');
 if(!canonical)for(const required of ['name','price','imageUrl','purchaseUrl'])if(!map.some(([key])=>key===required))fail('required_provider_mapping_missing');
 function prepare(payload){
  if(typeof payload==='string'){if(Buffer.byteLength(payload)>4*1024*1024)fail('payload_too_large');payload=parseCsv(payload);}
  if(!plain(payload))fail('invalid_source_payload');
  let rows;if(canonical){if(!Array.isArray(payload.products))fail('canonical_products_required');rows=payload.products;}else if(Array.isArray(payload.items)){rows=payload.items;}else if(Array.isArray(payload.products)){rows=payload.products;}else fail('provider_items_required');
  if(rows.length>100)fail('too_many_source_records');
  const seen=new Set(),products=rows.map(record=>{
   if(!plain(record))fail('invalid_source_record');const out=clone(reviewedDefaults);
   if(canonical&&!map.length){for(const key of Object.keys(record)){if(!fields.has(key))fail('unrecognized_seller_field');if(FIXED.has(key))continue;out[key]=clone(record[key]);}}
   for(const [key,parts]of map)out[key]=clone(valueAt(record,parts));
   // Approval identity comes only from the reviewed adapter config. A provider
   // payload cannot turn candidate preparation into permission/publication.
   if(canonical&&record.approvalId!==undefined&&record.approvalId!==approvalId)fail('source_approval_conflict');
   if(canonical&&record.sourceUrl!==undefined&&record.sourceUrl!==source)fail('source_url_conflict');
   if(canonical&&record.sourceKind!==undefined&&record.sourceKind!==kind)fail('source_kind_conflict');
   out.approvalId=approvalId;out.sourceUrl=source;out.sourceKind=kind;out.permissionChecked=reviewedDefaults.permissionChecked===true;
   validateCandidate(out);if(seen.has(out.id))fail('duplicate_source_product');seen.add(out.id);return out;
  });
  return {sourceKind:kind,candidates:{version:1,products},candidateCount:products.length,registeredProducts:0,approvalRequired:true,liveEnabled:false};
 }
 return Object.freeze({kind,status:()=>({sourceKind:kind,liveEnabled:false,approvalRequired:true,transport:'offline-only'}),prepare,normalize:prepare});
}
module.exports={createSourceAdapter,KINDS};
