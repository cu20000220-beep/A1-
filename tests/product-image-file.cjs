'use strict';
// Tiny synthetic pixels only. These are file-inspection fixtures, not products
// or evidence of garment fitting. The existing JPEG is read without modification.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const {inspectProductImage}=require('../scripts/lib/product-image-file.cjs');
const jpeg=()=>fs.readFileSync(path.resolve(__dirname,'../assets/photos/coat.jpg'));
const signature=Buffer.from([137,80,78,71,13,10,26,10]);
function crc32(bytes){let n=0xffffffff;for(const b of bytes){n^=b;for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;}return(n^0xffffffff)>>>0;}
function chunk(type,body=Buffer.alloc(0)){const name=Buffer.from(type),head=Buffer.alloc(4),tail=Buffer.alloc(4);head.writeUInt32BE(body.length);tail.writeUInt32BE(crc32(Buffer.concat([name,body])));return Buffer.concat([head,name,body,tail]);}
function png({width=2,height=3,interlace=0,before=[],after=[],compressed,filter=0}={}){
 const header=Buffer.alloc(13);header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;header[12]=interlace;
 let rows=[];
 if(width*height<=100){if(!interlace){for(let y=0;y<height;y++)rows.push(Buffer.concat([Buffer.from([filter]),Buffer.alloc(width*4,20)]));}
  else{const passes=[[0,0,8,8],[4,0,8,8],[0,4,4,8],[2,0,4,4],[0,2,2,4],[1,0,2,2],[0,1,1,2]];for(const[x,y,dx,dy]of passes){const w=Math.max(0,Math.ceil((width-x)/dx)),h=Math.max(0,Math.ceil((height-y)/dy));if(w&&h)for(let row=0;row<h;row++)rows.push(Buffer.concat([Buffer.from([filter]),Buffer.alloc(w*4,20)]));}}
 }
 return Buffer.concat([signature,chunk('IHDR',header),...before,chunk('IDAT',compressed||zlib.deflateSync(Buffer.concat(rows))),...after,chunk('IEND')]);
}
function app1(data){const header=Buffer.alloc(4);header[0]=255;header[1]=0xe1;header.writeUInt16BE(data.length+2,2);const original=jpeg();return Buffer.concat([original.subarray(0,2),header,data,original.subarray(2)]);}
function tiff({orientation=1,gps=false}={}){const b=Buffer.alloc(26);b.write('II',0);b.writeUInt16LE(42,2);b.writeUInt32LE(8,4);b.writeUInt16LE(1,8);b.writeUInt16LE(gps?0x8825:0x0112,10);b.writeUInt16LE(gps?4:3,12);b.writeUInt32LE(1,14);if(gps)b.writeUInt32LE(26,18);else b.writeUInt16LE(orientation,18);return b;}
const WEBPS=[
 'UklGRjAAAABXRUJQVlA4ICQAAABQAQCdASoCAAMAAUAmJQBOgCgAAP76id+R2EN2HLri5shvAAA=',
 'UklGRlIAAABXRUJQVlA4WAoAAAAQAAAAAQAAAgAAQUxQSAcAAAAAgICAgICAAFZQOCAkAAAAUAEAnQEqAgADAAFAJiUAToAoAAD++onfkdhDdhy64ubIbwAA',
 'UklGRh4AAABXRUJQVlA4TBEAAAAvAYAAEAdQlFKUp4CBiOh/AAA='
].map(s=>Buffer.from(s,'base64'));
function webpChunk(type,body){const head=Buffer.alloc(8);head.write(type,0,'ascii');head.writeUInt32LE(body.length,4);return Buffer.concat([head,body,...(body.length&1?[Buffer.alloc(1)]:[])]);}
function riff(chunks){const body=Buffer.concat([Buffer.from('WEBP'),...chunks]),head=Buffer.alloc(8);head.write('RIFF');head.writeUInt32LE(body.length,4);return Buffer.concat([head,body]);}
test('existing raster bytes report stable encoded dimensions/hash without modifying the source',()=>{
 const bytes=jpeg(),before=Buffer.from(bytes),r=inspectProductImage(bytes);assert.equal(r.mime,'image/jpeg');assert.equal(r.extension,'jpg');assert.equal(r.width,850);assert.equal(r.height,567);assert.equal(r.orientation,1);assert.equal(r.dimensionsAreEncoded,true);assert.equal(r.bytes,bytes.length);assert.equal(r.sha256,crypto.createHash('sha256').update(bytes).digest('hex'));assert.deepEqual(bytes,before);assert.ok(Object.isFrozen(r));
});
test('PNG truecolor alpha and Adam7 scanline layouts are bounded and inspected',()=>{
 for(const interlace of[0,1]){const bytes=png({interlace}),r=inspectProductImage(bytes);assert.equal(r.mime,'image/png');assert.equal(r.extension,'png');assert.equal(r.width,2);assert.equal(r.height,3);assert.equal(r.orientation,1);assert.equal(r.bytes,bytes.length);}
});
test('PNG rejects corrupt CRCs, bad filter/data, animation and trailing polyglot payloads',()=>{
 const damaged=png();damaged[30]^=1;assert.throws(()=>inspectProductImage(damaged),/product_image_png_crc/);
 for(const bytes of[png({filter:5}),png({compressed:zlib.deflateSync(Buffer.alloc(1))}),png({before:[chunk('acTL',Buffer.alloc(8))]}),png({after:[chunk('ABCD')]}),Buffer.concat([png(),Buffer.from('<svg onload="PRIVATE">')])])assert.throws(()=>inspectProductImage(bytes),/product_image_/);
 const compressed=Buffer.concat([zlib.deflateSync(Buffer.alloc(27)),Buffer.from('HTML TAIL')]);assert.throws(()=>inspectProductImage(png({compressed})),/product_image_compressed_trailing/);
});
test('zero/excessive dimensions, byte limits and non-raster formats are rejected before publication',()=>{
 for(const bytes of[Buffer.alloc(0),Buffer.alloc(6000001),Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),Buffer.from('<!doctype html>PRIVATE'),Buffer.from('GIF89a'),png({width:0}),png({width:6000,height:5001})])assert.throws(()=>inspectProductImage(bytes),/product_image_/);
 assert.throws(()=>inspectProductImage(new Uint8Array([1,2,3])),/product_image_file_size/);
});
test('PNG compressed metadata is bounded and GPS coordinates do not enter public files',()=>{
 const text=chunk('tEXt',Buffer.from('comment\0exif:GPSLatitude=PRIVATE'));
 const zipped=chunk('zTXt',Buffer.concat([Buffer.from('comment\0\0'),zlib.deflateSync(Buffer.from('GPSLongitude=PRIVATE'))]));
 const bomb=chunk('zTXt',Buffer.concat([Buffer.from('comment\0\0'),zlib.deflateSync(Buffer.alloc(1024*1024+1,65))]));
 for(const record of[text,zipped])assert.throws(()=>inspectProductImage(png({before:[record]})),/product_image_private_metadata/);
 assert.throws(()=>inspectProductImage(png({before:[bomb]})),/product_image_compressed_data/);
});
test('EXIF orientation is reported as encoded dimensions and GPS IFDs are refused',()=>{
 const oriented=app1(Buffer.concat([Buffer.from('Exif\0\0','binary'),tiff({orientation:6})])),r=inspectProductImage(oriented);assert.equal(r.orientation,6);assert.equal(r.width,850);assert.equal(r.height,567);assert.equal(r.dimensionsAreEncoded,true);
 assert.equal(inspectProductImage(png({before:[chunk('eXIf',tiff({orientation:8}))]})).orientation,8);
 for(const bytes of[app1(Buffer.concat([Buffer.from('Exif\0\0','binary'),tiff({gps:true})])),png({before:[chunk('eXIf',tiff({gps:true}))]})])assert.throws(()=>inspectProductImage(bytes),/product_image_private_metadata/);
 assert.throws(()=>inspectProductImage(app1(Buffer.concat([Buffer.from('Exif\0\0','binary'),tiff({orientation:9})]))),/product_image_exif/);
});
test('JPEG refuses missing entropy termination, segment truncation and appended second files',()=>{
 const bytes=jpeg();for(const changed of[bytes.subarray(0,bytes.length-2),bytes.subarray(0,30),Buffer.concat([bytes,Buffer.from('PK\x03\x04')]),Buffer.concat([bytes,bytes])])assert.throws(()=>inspectProductImage(changed),/product_image_/);
 const bad=Buffer.from(bytes);bad[4]=255;bad[5]=255;assert.throws(()=>inspectProductImage(bad),/product_image_/);
 assert.throws(()=>inspectProductImage(app1(Buffer.from('http://ns.adobe.com/xap/1.0/\0exif:GPSLatitude="PRIVATE"'))),/product_image_private_metadata/);
});
test('WebP lossy, alpha and lossless containers expose the actual encoded canvas',()=>{
 for(const bytes of WEBPS){const r=inspectProductImage(bytes);assert.equal(r.mime,'image/webp');assert.equal(r.extension,'webp');assert.equal(r.width,2);assert.equal(r.height,3);assert.equal(r.orientation,1);}
});
test('WebP rejects contradictory RIFF sizes, frame dimensions, animations and trailing files',()=>{
 const extra=Buffer.concat([WEBPS[0],Buffer.from('<html>')]);assert.throws(()=>inspectProductImage(extra),/product_image_webp_size/);
 const short=Buffer.from(WEBPS[0]);short.writeUInt32LE(short.length+100,4);assert.throws(()=>inspectProductImage(short),/product_image_webp_size/);
 const animated=Buffer.from(WEBPS[1]);animated[20]|=2;assert.throws(()=>inspectProductImage(animated),/product_image_animation/);
 const wrongCanvas=Buffer.from(WEBPS[1]);wrongCanvas[24]=9;assert.throws(()=>inspectProductImage(wrongCanvas),/product_image_webp_header/);
 assert.throws(()=>inspectProductImage(riff([webpChunk('ANIM',Buffer.alloc(6))])),/product_image_animation/);
});
test('WebP metadata orientation remains explicit and GPS metadata is rejected',()=>{
 const frame=WEBPS[0].subarray(12),canvas=Buffer.alloc(10);canvas[0]=8;canvas.writeUIntLE(1,4,3);canvas.writeUIntLE(2,7,3);
 const oriented=riff([webpChunk('VP8X',canvas),frame,webpChunk('EXIF',tiff({orientation:6}))]);assert.equal(inspectProductImage(oriented).orientation,6);
 assert.throws(()=>inspectProductImage(riff([webpChunk('VP8X',canvas),frame,webpChunk('EXIF',tiff({gps:true}))])),/product_image_private_metadata/);
 const missing=Buffer.from(oriented);missing[20]&=~8;assert.throws(()=>inspectProductImage(missing),/product_image_webp_header/);
});
