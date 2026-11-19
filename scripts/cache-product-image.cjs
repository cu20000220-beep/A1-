#!/usr/bin/env node
'use strict';
// An operator's local product file -> hash-bound static copy. No downloader,
// operational DB, consumer photo endpoint or external AI service is involved.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Images=require('../assets/product-images.js');
const {inspectProductImage}=require('./lib/product-image-file.cjs');
const {readBoundedFile,noSymlinks}=require('./lib/product-image-store.cjs');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const fail=code=>{throw TypeError(code);};
function intake({root=path.resolve(__dirname,'..'),id,file,write=false,now=Date.now()}={}){
 if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,160}$/.test(id)||typeof file!=='string'||typeof write!=='boolean')fail('product_image_arguments');
 root=noSymlinks(root);const assets=noSymlinks(path.join(root,'assets')),manifestPath=path.join(assets,'product-images.json');
 const original=readBoundedFile(manifestPath,1000000),manifest=JSON.parse(original),facts=JSON.parse(readBoundedFile(path.join(assets,'observed-products.json'),1000000));
 const entries=Images.validateManifest(manifest,facts,{now}),entry=entries.find(e=>e.id===id);if(!entry)fail('product_image_id_missing');
 const bytes=readBoundedFile(file),image=inspectProductImage(bytes),relative='/assets/catalog-images/'+id+'.'+image.extension;
 const updated={...entry,imageUrl:relative,delivery:'local-copy',sha256:image.sha256,bytes:image.bytes,width:image.width,height:image.height,checkedAt:now};
 const next=structuredClone(manifest);next.products[next.products.findIndex(p=>p.id===id)]=updated;Images.validateManifest(next,facts,{now});
 const report={version:1,id,status:write?'CACHED':'INSPECTED',written:false,changed:false,sourceImageUrl:entry.sourceImageUrl,localImageUrl:relative,authorizationBasis:manifest.authorization.basis,image,merchantDownloadVerified:false,visualProductMatchVerified:false,networkRequests:0};
 if(!write)return report;
 const lockPath=path.join(assets,'.product-image-intake.lock');let lock,tempImage,tempManifest,oldImage,changedImage=false;
 const destDir=path.join(assets,'catalog-images'),dest=path.join(root,relative.slice(1));
 try{
  try{lock=fs.openSync(lockPath,'wx',0o600);}catch{fail('product_image_intake_busy');}
  if(hash(readBoundedFile(manifestPath,1000000))!==hash(original))fail('product_image_manifest_changed');
  if(!fs.existsSync(destDir))fs.mkdirSync(destDir,{mode:0o755});noSymlinks(destDir);
  if(fs.lstatSync(dest,{throwIfNoEntry:false})){
   oldImage=readBoundedFile(dest);
   if(hash(oldImage)!==image.sha256&&(entry.delivery!=='local-copy'||entry.imageUrl!==relative||hash(oldImage)!==entry.sha256))fail('product_image_existing_file_unreviewed');
  }
  if(entry.delivery==='local-copy'&&entry.imageUrl===relative&&entry.sha256===image.sha256&&entry.bytes===image.bytes&&entry.width===image.width&&entry.height===image.height&&oldImage){report.written=true;return report;}
  const suffix=crypto.randomBytes(8).toString('hex');tempImage=path.join(destDir,'.intake-'+suffix);tempManifest=path.join(assets,'.product-images-'+suffix+'.json');
  fs.writeFileSync(tempImage,bytes,{flag:'wx',mode:0o644});fs.writeFileSync(tempManifest,JSON.stringify(next,null,2)+'\n',{flag:'wx',mode:0o644});
  if(hash(readBoundedFile(manifestPath,1000000))!==hash(original))fail('product_image_manifest_changed');
  fs.renameSync(tempImage,dest);tempImage=null;changedImage=true;
  if(hash(readBoundedFile(manifestPath,1000000))!==hash(original))fail('product_image_manifest_changed');
  fs.renameSync(tempManifest,manifestPath);tempManifest=null;changedImage=false;
  report.written=report.changed=true;return report;
 }catch(error){
  // Restore only our own replacement; never delete another writer's bytes.
  if(changedImage&&fs.existsSync(dest)&&hash(readBoundedFile(dest))===image.sha256){if(oldImage)fs.writeFileSync(dest,oldImage);else fs.unlinkSync(dest);}
  throw error;
 }finally{
  for(const temp of [tempImage,tempManifest])if(temp)fs.rmSync(temp,{force:true});
  if(lock!==undefined){fs.closeSync(lock);fs.unlinkSync(lockPath);}
 }
}
function main(args){
 if(args.length===1&&args[0]==='--help'){process.stdout.write('Offline product-image intake. No network or deployment.\nUsage: node scripts/cache-product-image.cjs --id PRODUCT_ID --file LOCAL_PRODUCT_IMAGE [--write] [--root WORKTREE]\nDefault: inspect only. --write caches exact bytes and updates only the matching image manifest entry.\nUse a corresponding operator-provided product image, never a consumer body photograph.\n');return;}
 try{
  const values=new Map();let write=false;
  for(let i=0;i<args.length;i++){
   const key=args[i];if(key==='--write'){if(write)fail('product_image_arguments');write=true;continue;}
   if(!['--id','--file','--root'].includes(key)||values.has(key)||!args[i+1]||args[i+1].startsWith('--'))fail('product_image_arguments');values.set(key,args[++i]);
  }
  const result=intake({id:values.get('--id'),file:values.get('--file'),...(values.has('--root')?{root:values.get('--root')}:{ }),write});process.stdout.write(JSON.stringify(result,null,2)+'\n');
 }catch(error){const code=error instanceof TypeError&&/^[a-z][a-z0-9_]{1,80}$/.test(error.message)?error.message:'product_image_intake_failed';process.stdout.write(JSON.stringify({version:1,status:'INVALID',error:code,written:false,networkRequests:0})+'\n');process.exitCode=1;}
}
if(require.main===module)main(process.argv.slice(2));
module.exports={intake};
