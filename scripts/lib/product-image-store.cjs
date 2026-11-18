'use strict';
// Offline operator files only; no consumer-photo endpoint or analysis hook.
const fs=require('node:fs'),path=require('node:path');
const {inspectProductImage}=require('./product-image-file.cjs');
const fail=code=>{throw TypeError(code);};
function noSymlinks(file){
 const absolute=path.resolve(file);let current=path.parse(absolute).root;
 for(const part of absolute.slice(current.length).split(path.sep).filter(Boolean)){current=path.join(current,part);if(fs.lstatSync(current).isSymbolicLink())fail('product_image_symlink');}
 return absolute;
}
function readBoundedFile(file,max=6000000){
 if(!Number.isInteger(max)||max<1||max>6000000)fail('product_image_limit');
 const full=noSymlinks(file),fd=fs.openSync(full,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));
 try{
  const before=fs.fstatSync(fd);if(!before.isFile()||before.size>max)fail('product_image_file_size');
  const buffer=Buffer.alloc(Math.min(max+1,before.size+1));let length=0;
  while(length<buffer.length){const n=fs.readSync(fd,buffer,length,buffer.length-length,null);if(!n)break;length+=n;}
  const after=fs.fstatSync(fd);
  if(length>max||length!==before.size||after.size!==before.size||after.mtimeMs!==before.mtimeMs||after.ctimeMs!==before.ctimeMs)fail('product_image_file_changed');
  return buffer.subarray(0,length);
 }finally{fs.closeSync(fd);}
}
function validateLocalCopies(root,entries){
 if(!Array.isArray(entries)||entries.length>100)fail('product_images_invalid');
 const base=noSymlinks(root),seen=new Set(),copies=[];
 for(const entry of entries){
  if(entry.delivery!=='local-copy')continue;
  if(typeof entry.imageUrl!=='string'||!/^\/assets\/catalog-images\/[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|webp)$/.test(entry.imageUrl)||!entry.imageUrl.split('/').at(-1).startsWith(entry.id+'.')||seen.has(entry.imageUrl))fail('product_image_copy_path');
  seen.add(entry.imageUrl);const relative=entry.imageUrl.slice(1),bytes=readBoundedFile(path.join(base,relative)),inspection=inspectProductImage(bytes),extension=path.extname(relative).slice(1).replace('jpeg','jpg');
  if(inspection.extension!==extension||inspection.bytes!==entry.bytes||inspection.sha256!==entry.sha256||inspection.width!==entry.width||inspection.height!==entry.height)fail('product_image_copy_mismatch');
  copies.push({relative,bytes,inspection});
 }
 return copies;
}
module.exports={readBoundedFile,noSymlinks,validateLocalCopies};
