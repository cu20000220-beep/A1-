#!/usr/bin/env node
'use strict';
// Offline asset conversion only. No MakeHuman program code is copied or run.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const COMMIT='a8bc2d54ff0ac92e78ff71431b1023eda42bf482';
const SOURCE='https://raw.githubusercontent.com/makehumancommunity/makehuman/'+COMMIT+'/makehuman/data/3dobjs/base.obj';
const EXPECTED='8e761e6624b8f54536409135d1636da63b32486a90d4897f84e121d144f6fb4c';
function prepare(source){
 const bytes=Buffer.isBuffer(source)?source:Buffer.from(source);if(bytes.length>2*1024*1024||crypto.createHash('sha256').update(bytes).digest('hex')!==EXPECTED)throw Error('unreviewed_human_asset');
 const text=bytes.toString('utf8');if(!text.includes('explicitly released as CC0 in september 2020'))throw Error('asset_license_missing');
 const positions=[],faces=[];let group='';
 for(const line of text.split(/\r?\n/)){const p=line.trim().split(/\s+/);if(p[0]==='v')positions.push(p.slice(1,4).map(Number));else if(p[0]==='g')group=p.slice(1).join(' ');else if(p[0]==='f'&&group==='body')faces.push(p.slice(1).map(v=>Number(v.split('/')[0])-1));}
 const used=[...new Set(faces.flat())].sort((a,b)=>a-b),mapping=new Map(used.map((v,i)=>[v,i]));
 const minY=Math.min(...used.map(i=>positions[i][1])),maxY=Math.max(...used.map(i=>positions[i][1])),scale=1.7/(maxY-minY),smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);},round=v=>Number(v.toFixed(6));
 const vertices=[],arms=[];
 for(const index of used){let [x,y,z]=positions[index];const sign=x<0?-1:1,weight=smooth(1.4,2.7,Math.abs(x))*smooth(.8,1.3,y),angle=-sign*.5*weight,dx=x-sign*1.65,dy=y-5.3;
  // A gentle A-pose→relaxed pose rotation of the data, not a learned body fit.
  x=sign*1.65+Math.cos(angle)*dx-Math.sin(angle)*dy;y=5.3+Math.sin(angle)*dx+Math.cos(angle)*dy;
  vertices.push(round(x*scale),round((y-minY)*scale),round((z-.5)*scale));arms.push(round(weight));
 }
 const indices=[];for(const face of faces)for(let i=1;i<face.length-1;i++)indices.push(mapping.get(face[0]),mapping.get(face[i]),mapping.get(face[i+1]));
 return {version:1,name:'MakeHuman hm08 body / relaxed visual reference',license:'CC0-1.0',source:SOURCE,commit:COMMIT,sha256:EXPECTED,height:1.7,positions:vertices,arms,indices};
}
if(require.main===module){const [input,output]=process.argv.slice(2);if(!input||!output)throw Error('usage: node scripts/prepare-human-base.cjs <reviewed-base.obj> <human-base.js>');const data=prepare(fs.readFileSync(input));const content='/* MakeHuman hm08 core body asset, CC0-1.0. See docs/HUMAN-MESH-LICENSE.md. */\n\'use strict\';\n((root)=>{const data='+JSON.stringify(data)+';if(typeof module===\'object\'&&module.exports)module.exports=data;else root.A1HumanBase=Object.freeze(data);})(globalThis);\n';if(Buffer.byteLength(content)>2*1024*1024)throw Error('human_asset_too_large');fs.writeFileSync(path.resolve(output),content);console.log(JSON.stringify({vertices:data.positions.length/3,triangles:data.indices.length/3,bytes:Buffer.byteLength(content),license:data.license}));}
module.exports={prepare};
