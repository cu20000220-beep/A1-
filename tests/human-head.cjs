'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),head=require('../assets/human-head.js'),{prepare}=require('../scripts/prepare-human-head.cjs');
test('reviewed scan head is licensed, bounded, static data with correct UV and genuine facial topology',()=>{
 assert.equal(head.license,'CC-BY-3.0');assert.match(head.attribution,/Lee Perry-Smith/);assert.equal(head.sha256,'402b8a8ac9f03232e6d64b5962929703a069daf99d3c49ac8eb0e48bedc9c576');assert.equal(head.referenceHeight,.245);assert.equal(head.positions.length/3,8507);assert.equal(head.indices.length/3,16213);assert.equal(head.normals.length,head.positions.length);assert.equal(head.uvs.length,head.positions.length/3*2);
 const count=head.positions.length/3;assert.ok(head.indices.every(i=>Number.isSafeInteger(i)&&i>=0&&i<count));assert.ok(head.uvs.every(v=>Number.isFinite(v)&&v>=0&&v<=1));assert.ok(head.positions.every(Number.isFinite));
 const ys=head.positions.filter((_,i)=>i%3===1);assert.equal(Math.min(...ys),0);assert.equal(Math.max(...ys),1);assert.ok(head.positions.every((v,i)=>i%3===1||Math.abs(v)<1));
 for(let i=0;i<head.normals.length;i+=3)assert.ok(Math.abs(Math.hypot(...head.normals.slice(i,i+3))-1)<.000003,'lighting normals must remain normalized after neck taper');
 // Face projects forwards (+Z); UV seams remain indexed rather than averaged.
 assert.ok(Math.max(...head.positions.filter((_,i)=>i%3===2))>.4);const seam=new Map();let split=false;for(let i=0;i<count;i++){const key=head.positions.slice(i*3,i*3+3).join(','),uv=head.uvs.slice(i*2,i*2+2).join(',');if(seam.has(key)&&seam.get(key)!==uv)split=true;else seam.set(key,uv);}assert.equal(split,true,'UV seams must preserve separate texture coordinates');
 assert.ok(fs.statSync(require.resolve('../assets/human-head.js')).size<1024*1024);
});
test('offline converter rejects unknown or modified source bytes without network or arbitrary GLTF references',()=>{
 assert.throws(()=>prepare(Buffer.alloc(404976)),/unreviewed_human_head/);assert.throws(()=>prepare(Buffer.from('not a licensed GLB')),/unreviewed_human_head/);
 const source=fs.readFileSync(require.resolve('../scripts/prepare-human-head.cjs'),'utf8');assert.doesNotMatch(source,/https?\.get\(|fetch\(|execSync|child_process/);assert.equal(crypto.createHash('sha256').update(Buffer.from('not a licensed GLB')).digest('hex')===head.sha256,false);
});
test('head photos and licence match the reviewed official files without generated or user-supplied substitutions',()=>{
 for(const [file,digest]of [['human-head-color.jpg','e976d73b31407f8d0967412bf468019ed26a5d5a32cf5811aabff7e816458a65'],['human-head-normal.jpg','36925e51ad9b324b94e8faf4692da1b4132809f2762bb8d5bd549ffd215d4ca6'],['HUMAN-HEAD-LICENSE.txt','7cf4da43a6ae6d32f7f7d063fe129a19468af6f4fe7c53b937f83959709fcb50']]){
  const bytes=fs.readFileSync(require.resolve('../assets/'+file));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),digest,file+' is the exact reviewed source');assert.ok(bytes.length<200000);
 }
 assert.match(fs.readFileSync(require.resolve('../assets/HUMAN-HEAD-LICENSE.txt'),'utf8'),/Creative Commons Attribution 3\.0/);
});
test('licensed head integration preserves body and garments, keeps baseline available and rejects unreviewed replacements',()=>{
 const G=require('../assets/avatar-geometry.js');G.installBase(require('../assets/human-base.js'));assert.equal(G.scene(G.defaults,'LAB-A',null,{head:true}).headModel,false,'missing verified head keeps the existing model');
 assert.equal(G.installHead(head),true);assert.equal(G.hasHumanHead(),true);const baseline=G.scene(G.defaults,'LAB-A'),scan=G.scene(G.defaults,'LAB-A',null,{head:true});assert.equal(baseline.headModel,false);assert.equal(scan.headModel,true);assert.ok(scan.headMesh);
 assert.deepEqual(scan.bodyMesh.positions,baseline.bodyMesh.positions,'a new head never changes body measurements');assert.deepEqual(scan.garmentMesh.positions,baseline.garmentMesh.positions,'a new head never cuts or resizes the clothing');assert.deepEqual(scan.garmentMesh.indices,baseline.garmentMesh.indices);assert.equal(scan.surfaceMaterials.length,scan.vertices.length/3);
 assert.equal(Array.from(scan.surfaceMaterials).filter((v,i)=>i%3===2&&v===2).length,head.indices.length,'every scan triangle corner has its reviewed UV material');assert.notDeepEqual(scan.vertices,baseline.vertices);assert.ok([...scan.vertices].every(Number.isFinite));
 const ys=Array.from(scan.headMesh.positions).filter((_,i)=>i%3===1);assert.ok(Math.abs(Math.min(...ys)-1.455)<1e-5);assert.ok(Math.abs(Math.max(...ys)-1.7)<1e-5);
 for(const patch of [{license:'UNKNOWN'},{sha256:'wrong'},{positions:[1,2,NaN]},{indices:[-1,0,1]},{normals:Array(head.normals.length).fill(0)},{uvs:[NaN]}])assert.throws(()=>G.installHead({...head,...patch}),/invalid_human_head/);assert.equal(G.hasHumanHead(),true);assert.deepEqual(G.scene(G.defaults,'LAB-A',null,{head:true}).headMesh.positions,scan.headMesh.positions,'invalid input preserves the last reviewed head');
 const edited=G.scene({...G.defaults,height:190,chest:110,waist:100,shoulders:50},'LAB-B',{shoulderHipRatio:1.6,legTorsoRatio:2},{head:true});assert.notDeepEqual(edited.headMesh.positions,scan.headMesh.positions);assert.ok([...edited.headMesh.positions].every(Number.isFinite));for(let i=0;i<edited.headMesh.normals.length;i+=3)assert.ok(Math.abs(Math.hypot(...edited.headMesh.normals.slice(i,i+3))-1)<1e-5);
 for(let i=0;i<head.positions.length;i+=3)if(head.positions[i+1]>=.2){assert.ok(Math.abs(edited.headMesh.positions[i]-scan.headMesh.positions[i])<1e-6&&Math.abs(edited.headMesh.positions[i+2]-scan.headMesh.positions[i+2])<1e-6,'changing height moves the face without stretching its likeness');assert.ok(Math.abs(edited.headMesh.positions[i+1]-scan.headMesh.positions[i+1]-.2)<1e-6);}
 // Rotation uses genuine depth; a full turn returns the original geometry.
 const points=scan.headMesh.positions;let depth=0;for(let i=0;i<points.length;i+=3){const quarter=[points[i+2],points[i+1],-points[i]],full=[Math.cos(2*Math.PI)*points[i]+Math.sin(2*Math.PI)*points[i+2],points[i+1],-Math.sin(2*Math.PI)*points[i]+Math.cos(2*Math.PI)*points[i+2]];depth=Math.max(depth,Math.abs(quarter[0]-points[i]));assert.ok(Math.abs(full[0]-points[i])<1e-6&&Math.abs(full[2]-points[i+2])<1e-6);}assert.ok(depth>.1);
});
