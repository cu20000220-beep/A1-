'use strict';
// Offline raster-container inspection only. JPEG/WebP entropy is not fully
// decoded here; a browser must still decode the selected garment before use.
// Dimensions are encoded header dimensions. EXIF orientation is reported,
// preserved in the bytes, and handled by the browser when it decodes the image.
const crypto=require('node:crypto'),zlib=require('node:zlib');
const MAX_BYTES=6000000,MAX_PIXELS=30000000,MAX_INFLATED=128*1024*1024;
const fail=code=>{throw new TypeError(code);};
const crcTable=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes){let value=0xffffffff;for(const byte of bytes)value=crcTable[(value^byte)&255]^(value>>>8);return(value^0xffffffff)>>>0;}
function dimensions(width,height){if(!Number.isInteger(width)||!Number.isInteger(height)||width<=0||height<=0||width*height>MAX_PIXELS)fail('product_image_dimensions');return{width,height};}
function inflate(bytes,limit){try{const result=zlib.inflateSync(bytes,{info:true,maxOutputLength:limit});if(result.engine.bytesWritten!==bytes.length)fail('product_image_compressed_trailing');return result.buffer;}catch(error){if(error instanceof TypeError&&String(error.message).startsWith('product_image_'))throw error;fail('product_image_compressed_data');}}
function privateText(bytes){if(/(?:GPSLatitude|GPSLongitude|GPSPosition|exif:GPS|\bLatitude\b|\bLongitude\b)/i.test(bytes.toString('utf8')))fail('product_image_private_metadata');}
function exif(bytes){
 if(bytes.subarray(0,6).equals(Buffer.from('Exif\0\0','binary')))bytes=bytes.subarray(6);
 if(bytes.length<8)fail('product_image_exif');const little=bytes.toString('ascii',0,2)==='II';if(!little&&bytes.toString('ascii',0,2)!=='MM')fail('product_image_exif');
 const u16=p=>{if(p<0||p+2>bytes.length)fail('product_image_exif');return little?bytes.readUInt16LE(p):bytes.readUInt16BE(p);};
 const u32=p=>{if(p<0||p+4>bytes.length)fail('product_image_exif');return little?bytes.readUInt32LE(p):bytes.readUInt32BE(p);};
 if(u16(2)!==42)fail('product_image_exif');const queue=[u32(4)],seen=new Set();let orientation=1,hasOrientation=false;
 while(queue.length){const offset=queue.shift();if(!offset)continue;if(offset<8||seen.has(offset)||seen.size>=16)fail('product_image_exif');seen.add(offset);const count=u16(offset);if(count>4096||offset+2+12*count+4>bytes.length)fail('product_image_exif');
  for(let i=0;i<count;i++){const p=offset+2+12*i,tag=u16(p),type=u16(p+2),length=u32(p+4);if(tag===0x8825)fail('product_image_private_metadata');
   if(tag===0x0112){if(type!==3||length!==1)fail('product_image_exif');const value=u16(p+8);if(value<1||value>8)fail('product_image_exif');if(!hasOrientation){orientation=value;hasOrientation=true;}}
   if(tag===0x8769&&type===4&&length===1)queue.push(u32(p+8));
  }queue.push(u32(offset+2+12*count));
 }return orientation;
}
function pngText(type,bytes){
 if(type==='tEXt'){privateText(bytes);return;}
 const keyword=bytes.indexOf(0);if(keyword<1||keyword>79)fail('product_image_png_text');
 if(type==='zTXt'){if(bytes[keyword+1]!==0)fail('product_image_png_text');privateText(inflate(bytes.subarray(keyword+2),1024*1024));return;}
 const flag=bytes[keyword+1],method=bytes[keyword+2];if((flag!==0&&flag!==1)||method!==0)fail('product_image_png_text');
 const languageEnd=bytes.indexOf(0,keyword+3),translatedEnd=languageEnd<0?-1:bytes.indexOf(0,languageEnd+1);if(translatedEnd<0)fail('product_image_png_text');const text=bytes.subarray(translatedEnd+1);privateText(flag?inflate(text,1024*1024):text);
}
function inspectPng(bytes){
 let offset=8,width,height,color,depth,interlace,palette=0,orientation=1,idatSeen=false,idatEnded=false,ended=false,transparency=false,chunks=0;const data=[];
 while(offset<bytes.length){if(++chunks>10000||offset+12>bytes.length)fail('product_image_png_chunk');const length=bytes.readUInt32BE(offset),end=offset+12+length;if(end>bytes.length)fail('product_image_png_chunk');
  const type=bytes.toString('ascii',offset+4,offset+8);if(!/^[A-Za-z]{4}$/.test(type)||(type.charCodeAt(2)&32))fail('product_image_png_chunk');const body=bytes.subarray(offset+8,offset+8+length);
  if(crc32(bytes.subarray(offset+4,offset+8+length))!==bytes.readUInt32BE(offset+8+length))fail('product_image_png_crc');
  if(chunks===1&&type!=='IHDR'||chunks>1&&type==='IHDR')fail('product_image_png_order');
  if(['acTL','fcTL','fdAT'].includes(type))fail('product_image_animation');
  if(type==='IHDR'){
   if(length!==13)fail('product_image_png_header');width=body.readUInt32BE(0);height=body.readUInt32BE(4);dimensions(width,height);depth=body[8];color=body[9];interlace=body[12];
   const depths={0:[1,2,4,8,16],2:[8,16],3:[1,2,4,8],4:[8,16],6:[8,16]};if(!depths[color]?.includes(depth)||body[10]!==0||body[11]!==0||interlace>1)fail('product_image_png_header');
  }else if(type==='PLTE'){
   if(palette||idatSeen||color===0||color===4||!length||length%3||length>768||color===3&&length/3>2**depth)fail('product_image_png_palette');palette=length/3;
  }else if(type==='IDAT'){
   if(idatEnded||color===3&&!palette)fail('product_image_png_order');idatSeen=true;data.push(body);
  }else{
   if(idatSeen)idatEnded=true;
   if(type==='IEND'){if(length||!idatSeen||end!==bytes.length)fail('product_image_png_end');ended=true;offset=end;break;}
   if(type==='tRNS'){if(transparency||idatSeen||color===0&&length!==2||color===2&&length!==6||color===3&&(!palette||!length||length>palette)||[4,6].includes(color))fail('product_image_png_transparency');transparency=true;}
   else if(type==='eXIf')orientation=exif(body);
   else if(['tEXt','iTXt','zTXt'].includes(type))pngText(type,body);
   else if(!(type.charCodeAt(0)&32))fail('product_image_png_critical');
  }offset=end;
 }
 if(!ended||offset!==bytes.length)fail('product_image_png_end');
 const channels={0:1,2:3,3:1,4:2,6:4}[color],passes=[];
 if(!interlace)passes.push({rows:height,rowBytes:Math.ceil(width*channels*depth/8)});
 else{const xs=[0,4,0,2,0,1,0],ys=[0,0,4,0,2,0,1],dx=[8,8,4,4,2,2,1],dy=[8,8,8,4,4,2,2];for(let i=0;i<7;i++){const w=Math.max(0,Math.ceil((width-xs[i])/dx[i])),h=Math.max(0,Math.ceil((height-ys[i])/dy[i]));if(w&&h)passes.push({rows:h,rowBytes:Math.ceil(w*channels*depth/8)});}}
 const expected=passes.reduce((n,p)=>n+p.rows*(p.rowBytes+1),0);if(!expected||expected>MAX_INFLATED)fail('product_image_decode_limit');const pixels=inflate(Buffer.concat(data),expected+1);if(pixels.length!==expected)fail('product_image_png_scanlines');
 let at=0;for(const pass of passes)for(let row=0;row<pass.rows;row++){if(pixels[at]>4)fail('product_image_png_filter');at+=pass.rowBytes+1;}
 return{...dimensions(width,height),orientation};
}
function inspectJpeg(bytes){
 let offset=2,width,height,orientation=1,frameType,components,scans=0,entropyBytes=0,quantizers=0,huffman=0,ended=false,markers=0;
 while(offset<bytes.length){if(++markers>100000||bytes[offset++]!==255)fail('product_image_jpeg_marker');while(offset<bytes.length&&bytes[offset]===255)offset++;if(offset>=bytes.length)fail('product_image_jpeg_marker');const marker=bytes[offset++];
  if(marker===0xd9){if(!scans||!entropyBytes||offset!==bytes.length)fail('product_image_jpeg_end');ended=true;break;}
  if(marker===0||marker===0xd8||marker===0x01||marker>=0xd0&&marker<=0xd7)fail('product_image_jpeg_marker');if(offset+2>bytes.length)fail('product_image_jpeg_segment');const length=bytes.readUInt16BE(offset),end=offset+length;if(length<2||end>bytes.length)fail('product_image_jpeg_segment');const body=bytes.subarray(offset+2,end);
  if([0xc0,0xc1,0xc2].includes(marker)){
   if(width||body.length<6)fail('product_image_jpeg_frame');const count=body[5];if(body[0]!==8||![1,3,4].includes(count)||length!==8+3*count)fail('product_image_jpeg_frame');height=body.readUInt16BE(1);width=body.readUInt16BE(3);dimensions(width,height);frameType=marker;components=[];
   for(let i=0;i<count;i++){const p=6+i*3,id=body[p],sample=body[p+1],table=body[p+2];if(components.includes(id)||!(sample>>4)||!(sample&15)||(sample>>4)>4||(sample&15)>4||table>3)fail('product_image_jpeg_frame');components.push(id);}
  }else if(marker>=0xc0&&marker<=0xcf&&![0xc4,0xc8,0xcc].includes(marker))fail('product_image_jpeg_unsupported');
  else if(marker===0xdb){let p=0;while(p<body.length){const info=body[p++],precision=info>>4;if(precision>1||(info&15)>3||p+64*(precision+1)>body.length)fail('product_image_jpeg_quantization');p+=64*(precision+1);quantizers++;}if(!body.length)fail('product_image_jpeg_quantization');}
  else if(marker===0xc4){let p=0;while(p<body.length){const info=body[p++];if((info>>4)>1||(info&15)>3||p+16>body.length)fail('product_image_jpeg_huffman');let count=0;for(let i=0;i<16;i++)count+=body[p++];if(!count||count>256||p+count>body.length)fail('product_image_jpeg_huffman');p+=count;huffman++;}if(!body.length)fail('product_image_jpeg_huffman');}
  else if(marker===0xe1){if(body.subarray(0,6).equals(Buffer.from('Exif\0\0','binary')))orientation=exif(body);else privateText(body);}
  else if(marker===0xdd&&length!==4)fail('product_image_jpeg_restart');
  else if(marker===0xda){
   if(!width||!quantizers||!huffman||body.length<4)fail('product_image_jpeg_scan');const count=body[0];if(!count||count>components.length||length!==6+2*count)fail('product_image_jpeg_scan');const selected=new Set();
   for(let i=0;i<count;i++){const id=body[1+i*2],tables=body[2+i*2];if(!components.includes(id)||selected.has(id)||(tables>>4)>3||(tables&15)>3)fail('product_image_jpeg_scan');selected.add(id);}
   const ss=body[1+2*count],se=body[2+2*count],approx=body[3+2*count];if(ss>se||se>63||(approx>>4)>13||(approx&15)>13||frameType!==0xc2&&(ss!==0||se!==63||approx!==0))fail('product_image_jpeg_scan');
   scans++;offset=end;let start=offset;
   while(offset<bytes.length){if(bytes[offset]!==255){offset++;continue;}let next=offset+1;while(next<bytes.length&&bytes[next]===255)next++;if(next>=bytes.length)fail('product_image_jpeg_end');const code=bytes[next];if(code===0||code>=0xd0&&code<=0xd7){offset=next+1;continue;}break;}
   entropyBytes+=offset-start;continue;
  }offset=end;
 }
 if(!ended||!width||!height)fail('product_image_jpeg_end');return{...dimensions(width,height),orientation};
}
function inspectWebp(bytes){
 if(bytes.length<20||bytes.readUInt32LE(4)+8!==bytes.length)fail('product_image_webp_size');let offset=12,width,height,extended=null,imageSeen=false,alpha=false,orientation=1,hasExif=false,hasXmp=false,hasIcc=false,chunks=0;
 while(offset<bytes.length){if(++chunks>10000||offset+8>bytes.length)fail('product_image_webp_chunk');const type=bytes.toString('ascii',offset,offset+4),length=bytes.readUInt32LE(offset+4),end=offset+8+length,padded=end+(length&1);if(end>bytes.length||padded>bytes.length||length&1&&bytes[end]!==0)fail('product_image_webp_chunk');const body=bytes.subarray(offset+8,end);
  if(['ANIM','ANMF'].includes(type))fail('product_image_animation');
  if(type==='VP8X'){
   if(chunks!==1||extended||length!==10||body[0]&0xc1||body[1]||body[2]||body[3])fail('product_image_webp_header');if(body[0]&2)fail('product_image_animation');extended={flags:body[0],...dimensions(body.readUIntLE(4,3)+1,body.readUIntLE(7,3)+1)};
  }else if(type==='VP8 '){
   if(imageSeen||length<11||body.readUIntLE(0,3)&1||body[3]!==0x9d||body[4]!==0x01||body[5]!==0x2a)fail('product_image_webp_frame');const tag=body.readUIntLE(0,3);if(((tag>>1)&7)>3||!(tag&16)||(tag>>>5)>length-10)fail('product_image_webp_frame');width=body.readUInt16LE(6)&0x3fff;height=body.readUInt16LE(8)&0x3fff;dimensions(width,height);imageSeen=true;
  }else if(type==='VP8L'){
   if(imageSeen||alpha||length<6||body[0]!==0x2f)fail('product_image_webp_frame');const info=body.readUInt32LE(1);if(info>>>29)fail('product_image_webp_frame');width=(info&0x3fff)+1;height=((info>>>14)&0x3fff)+1;dimensions(width,height);imageSeen=true;
  }else if(type==='ALPH'){
   if(!extended||!(extended.flags&16)||imageSeen||alpha||length<1||body[0]&0xc0||(body[0]&3)>1||((body[0]>>4)&3)>1)fail('product_image_webp_alpha');alpha=true;
  }else if(type==='EXIF'){if(!extended||hasExif)fail('product_image_webp_metadata');hasExif=true;orientation=exif(body);}
  else if(type==='XMP '){if(!extended||hasXmp)fail('product_image_webp_metadata');hasXmp=true;privateText(body);}
  else if(type==='ICCP'){if(!extended||hasIcc||imageSeen||!length)fail('product_image_webp_metadata');hasIcc=true;}
  else fail('product_image_webp_chunk');offset=padded;
 }
 if(!imageSeen||offset!==bytes.length)fail('product_image_webp_frame');if(extended&&(extended.width!==width||extended.height!==height||Boolean(extended.flags&8)!==hasExif||Boolean(extended.flags&4)!==hasXmp||Boolean(extended.flags&32)!==hasIcc))fail('product_image_webp_header');
 return{...dimensions(width,height),orientation};
}
function inspectProductImage(bytes){
 if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>MAX_BYTES)fail('product_image_file_size');let mime,extension,info;
 if(bytes.length>=8&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){mime='image/png';extension='png';info=inspectPng(bytes);}
 else if(bytes.length>=4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255){mime='image/jpeg';extension='jpg';info=inspectJpeg(bytes);}
 else if(bytes.length>=12&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'){mime='image/webp';extension='webp';info=inspectWebp(bytes);}
 else fail('product_image_format');
 return Object.freeze({mime,extension,...info,dimensionsAreEncoded:true,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
}
module.exports={inspectProductImage};
