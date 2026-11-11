#!/usr/bin/env node
'use strict';
// Offline conversion of one reviewed CC BY 3.0 scan, not arbitrary GLTF loading.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const COMMIT='b5a9e5730f6122498e187da8f7cdedd4358f5aa0';
const SOURCE='https://raw.githubusercontent.com/mrdoob/three.js/'+COMMIT+'/examples/models/gltf/LeePerrySmith/LeePerrySmith.glb';
const EXPECTED='402b8a8ac9f03232e6d64b5962929703a069daf99d3c49ac8eb0e48bedc9c576';
function prepare(input){
 const bytes=Buffer.isBuffer(input)?input:Buffer.from(input);if(bytes.length!==404976||crypto.createHash('sha256').update(bytes).digest('hex')!==EXPECTED)throw Error('unreviewed_human_head');
 if(bytes.readUInt32LE(0)!==0x46546c67||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length)throw Error('invalid_head_glb');
 let json,bin;for(let offset=12;offset<bytes.length;){const length=bytes.readUInt32LE(offset),type=bytes.readUInt32LE(offset+4),start=offset+8;if(start+length>bytes.length)throw Error('invalid_head_chunk');if(type===0x4e4f534a)json=JSON.parse(bytes.subarray(start,start+length).toString('utf8'));if(type===0x004e4942)bin=bytes.subarray(start,start+length);offset=start+length;}
 if(!json||!bin||json.buffers.length!==1||json.buffers[0].uri||json.meshes.length!==1||json.meshes[0].primitives.length!==1)throw Error('invalid_head_structure');
 function read(id,expectedType){const accessor=json.accessors[id],view=json.bufferViews[accessor.bufferView],size={SCALAR:1,VEC2:2,VEC3:3}[accessor.type],width=accessor.componentType===5123?2:accessor.componentType===5126?4:0,offset=(view.byteOffset||0)+(accessor.byteOffset||0);if(accessor.type!==expectedType||!width||view.byteStride||accessor.sparse||view.buffer!==0||offset+accessor.count*size*width>bin.length)throw Error('invalid_head_accessor');const out=[];for(let i=0;i<accessor.count*size;i++)out.push(width===2?bin.readUInt16LE(offset+i*2):bin.readFloatLE(offset+i*4));return out;}
 const primitive=json.meshes[0].primitives[0],sourcePositions=read(primitive.attributes.POSITION,'VEC3'),sourceUvs=read(primitive.attributes.TEXCOORD_0,'VEC2'),sourceIndices=read(primitive.indices,'SCALAR');
 const cut=-1.45,top=3.9725468158721924,height=top-cut,referenceHeight=.245,points=[],uvs=[],indices=[],original=new Map(),edges=new Map(),round=v=>Number(v.toFixed(6)),clamp=v=>Math.max(0,Math.min(1,v));
 function add(a,b=a,t=0){const raw=[0,1,2].map(k=>sourcePositions[a*3+k]+(sourcePositions[b*3+k]-sourcePositions[a*3+k])*t),y=(raw[1]-cut)/height,f=clamp(y*referenceHeight/.052),w=f*f*(3-2*f),id=points.length/3;
  // Only the short neck join is tapered; the licensed face/ears keep their
  // scanned proportions. Coordinates are relative to a neutral neck origin.
  points.push(round(raw[0]*.055/2/referenceHeight*(1-w)+raw[0]*.94/height*w),round(y),round((raw[2]+.55)*.075/1.31/referenceHeight*(1-w)+(raw[2]-.08)*.94/height*w));
  for(let k=0;k<2;k++)uvs.push(round(sourceUvs[a*2+k]+(sourceUvs[b*2+k]-sourceUvs[a*2+k])*t));return id;
 }
 const vertex=id=>{if(!original.has(id))original.set(id,add(id));return original.get(id);};
 function edge(a,b){const key=a<b?a+':'+b:b+':'+a;if(!edges.has(key)){const t=(cut-sourcePositions[a*3+1])/(sourcePositions[b*3+1]-sourcePositions[a*3+1]);edges.set(key,t<1e-8?vertex(a):t>1-1e-8?vertex(b):add(a,b,t));}return edges.get(key);}
 for(let i=0;i<sourceIndices.length;i+=3){const polygon=[];for(let j=0;j<3;j++){const a=sourceIndices[i+j],b=sourceIndices[i+(j+1)%3],inside=sourcePositions[a*3+1]>=cut,next=sourcePositions[b*3+1]>=cut;if(inside)polygon.push(vertex(a));if(inside!==next)polygon.push(edge(a,b));}for(let j=1;j<polygon.length-1;j++)if(new Set([polygon[0],polygon[j],polygon[j+1]]).size===3)indices.push(polygon[0],polygon[j],polygon[j+1]);}
 // Recalculate the altered neck normals; weld matching UV-seam positions only
 // for normal accumulation, retaining the original separate UV corners.
 const keys=[],sums=new Map();for(let i=0;i<points.length;i+=3){const key=points.slice(i,i+3).join(',');keys.push(key);if(!sums.has(key))sums.set(key,[0,0,0]);}
 for(let i=0;i<indices.length;i+=3){const [a,b,c]=indices.slice(i,i+3).map(id=>id*3),u=[0,1,2].map(k=>points[b+k]-points[a+k]),v=[0,1,2].map(k=>points[c+k]-points[a+k]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];for(const id of [a/3,b/3,c/3]){const sum=sums.get(keys[id]);for(let k=0;k<3;k++)sum[k]+=n[k];}}
 const normals=[];for(const key of keys){const n=sums.get(key),length=Math.hypot(...n);if(length<1e-12)throw Error('degenerate_head_normal');normals.push(...n.map(v=>round(v/length)));}
 return {version:1,name:'Generic Lee Perry-Smith licensed scan head',license:'CC-BY-3.0',licenseUrl:'https://creativecommons.org/licenses/by/3.0/',attribution:'Infinite, 3D Head Scan by Lee Perry-Smith. Three.js official sample asset. Neck crop and taper by A1 FASHION.',source:SOURCE,commit:COMMIT,sha256:EXPECTED,referenceHeight,sourceNeckCut:cut,positions:points,normals,uvs,indices};
}
if(require.main===module){const [input,output]=process.argv.slice(2);if(!input||!output)throw Error('usage: node scripts/prepare-human-head.cjs <reviewed-LeePerrySmith.glb> <human-head.js>');const data=prepare(fs.readFileSync(input)),text='/* CC BY 3.0: Infinite, 3D Head Scan by Lee Perry-Smith. Attribution and changes in data. */\n\'use strict\';\n((root)=>{const data='+JSON.stringify(data)+';if(typeof module===\'object\'&&module.exports)module.exports=data;else root.A1HumanHead=Object.freeze(data);})(globalThis);\n';if(Buffer.byteLength(text)>2*1024*1024)throw Error('head_asset_too_large');fs.writeFileSync(path.resolve(output),text);console.log(JSON.stringify({vertices:data.positions.length/3,triangles:data.indices.length/3,bytes:Buffer.byteLength(text),license:data.license}));}
module.exports={prepare};
