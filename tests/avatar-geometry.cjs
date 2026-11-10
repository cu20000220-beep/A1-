'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),G=require('../assets/avatar-geometry.js');
test('procedural body and garments contain finite lit 3D triangles with depth',()=>{
 for(const garment of ['none','LAB-A','LAB-B','LAB-C']){const scene=G.scene(G.defaults,garment);assert.ok(scene.vertices.length>10000);assert.equal(scene.vertices.length%27,0);assert.ok([...scene.vertices].every(Number.isFinite));const depth=[];for(let i=2;i<scene.vertices.length;i+=9)depth.push(scene.vertices[i]);assert.ok(Math.max(...depth)-Math.min(...depth)>.3);}
 assert.notDeepEqual(G.scene(G.defaults,'LAB-A').vertices,G.scene(G.defaults,'LAB-B').vertices);
});
test('self-reported measurements change actual geometry without inferring sizes or mutating input',()=>{
 const input={...G.defaults},before=G.scene(input).vertices;
 for(const patch of [{height:190},{chest:110},{waist:100},{hips:120},{shoulders:50},{inseam:85},{shape:'curved'}])assert.notDeepEqual(G.scene({...input,...patch}).vertices,before);
 assert.deepEqual(input,G.defaults);assert.throws(()=>G.scene({...input,photo:'private'}));assert.throws(()=>G.scene({...input,height:NaN}));assert.throws(()=>G.scene({...input,height:120,inseam:100}));assert.throws(()=>G.scene(input,'real-item'));
});
test('consented photo ratios are bounded dimensionless references, never manufactured measurements',()=>{
 const low={shoulderHipRatio:.8,legTorsoRatio:1},high={shoulderHipRatio:1.8,legTorsoRatio:2.6};
 const a=G.photoReference(low),b=G.photoReference(high);
 assert.ok(a.shoulderScale<b.shoulderScale);assert.ok(a.legScale<b.legScale);
 assert.deepEqual(Object.keys(a).sort(),['legScale','legTorsoRatio','shoulderHipRatio','shoulderScale']);
 assert.equal(a.shoulderScale>=.78&&a.legScale>=.88,true);assert.equal(b.shoulderScale<=1.25&&b.legScale<=1.12,true);
 for(const bad of [null,{}, {...low,waist:75},{...low,shoulderHipRatio:NaN},{...low,legTorsoRatio:Infinity},{...low,shoulderHipRatio:.44},{...low,legTorsoRatio:3.6}])assert.throws(()=>G.photoReference(bad));
 const copy=JSON.stringify(low);G.photoReference(low);assert.equal(JSON.stringify(low),copy);
});
test('photo references deform real body and garment vertices; manual corrections remain effective',()=>{
 const narrow={shoulderHipRatio:.8,legTorsoRatio:1},wide={shoulderHipRatio:1.8,legTorsoRatio:2.6};
 const defaults={...G.defaults},snapshot=JSON.stringify(defaults);
 for(const garment of ['none','LAB-A','LAB-B','LAB-C']){
  const a=G.scene(defaults,garment,narrow),b=G.scene(defaults,garment,wide);
  assert.notDeepEqual(a.vertices,b.vertices);assert.deepEqual(a.reference,G.photoReference(narrow));
  assert.ok([...a.vertices,...b.vertices].every(Number.isFinite));
  assert.notDeepEqual(G.scene({...defaults,waist:96,shoulders:50},garment,narrow).vertices,a.vertices);
 }
 assert.equal(JSON.stringify(defaults),snapshot);assert.equal(G.scene(defaults).reference,null);
 assert.throws(()=>G.scene(defaults,'LAB-A',{...narrow,photo:'private'}));
});
test('boundary manual measurements and photo ratio limits yield finite connected geometry',()=>{
 for(const input of [{...G.defaults,height:120,inseam:72},{...G.defaults,height:220,inseam:110}])
  for(const reference of [{shoulderHipRatio:.45,legTorsoRatio:.6},{shoulderHipRatio:2.5,legTorsoRatio:3.5}])
   for(const garment of ['none','LAB-A','LAB-C'])assert.ok([...G.scene(input,garment,reference).vertices].every(Number.isFinite));
});
test('continuous surface normals remain normalized for per-pixel lighting across body, cuffs and narrow boundary rings',()=>{
 for(const input of [G.defaults,{...G.defaults,height:120,inseam:72,chest:60,waist:45,shoulders:28},{...G.defaults,height:220,inseam:110,chest:160,hips:180,shoulders:65}]){
  const vertices=G.scene(input,'LAB-A',{shoulderHipRatio:2.5,legTorsoRatio:3.5}).vertices;
  for(let i=0;i<vertices.length;i+=9){const length=Math.hypot(vertices[i+3],vertices[i+4],vertices[i+5]);assert.ok(Math.abs(length-1)<.0001,'a finite unit surface normal is needed for stable lighting');assert.ok(Math.abs(vertices[i])<2&&vertices[i+1]>-.1&&vertices[i+1]<2.3&&Math.abs(vertices[i+2])<1);}
 }
});
test('reviewed CC0 human mesh installs bounded copied data and changes actual body triangles',()=>{
 const data=require('../assets/human-base.js'),before=G.scene(G.defaults,'LAB-A').vertices;assert.equal(data.license,'CC0-1.0');assert.equal(data.positions.length/3,13380);assert.equal(data.indices.length/3,26756);assert.equal(G.installBase(data),true);assert.equal(G.hasHumanBase(),true);
 const scene=G.scene(G.defaults,'LAB-A');assert.equal(scene.humanBase,true);assert.notDeepEqual(scene.vertices,before);assert.ok(scene.vertices.length>200000);assert.ok([...scene.vertices].every(Number.isFinite));
 const normal=G.scene(G.defaults,'none').vertices;assert.notDeepEqual(G.scene({...G.defaults,chest:110,waist:90,shoulders:50},'none').vertices,normal);assert.notDeepEqual(G.scene(G.defaults,'none',{shoulderHipRatio:.8,legTorsoRatio:1.2}).vertices,G.scene(G.defaults,'none',{shoulderHipRatio:1.8,legTorsoRatio:2.4}).vertices);
 assert.notDeepEqual(G.scene(G.defaults,'LAB-A').vertices,G.scene(G.defaults,'LAB-B').vertices);assert.notDeepEqual(G.scene(G.defaults,'LAB-B').vertices,G.scene(G.defaults,'LAB-C').vertices);
 for(const patch of [{license:'UNKNOWN'},{positions:[1,2,NaN]},{indices:[-1,0,1]},{arms:[2]}])assert.throws(()=>G.installBase({...data,...patch}));assert.equal(G.hasHumanBase(),true,'invalid replacement does not discard the valid current body');
});
test('human mesh boundary visual morphs retain finite unit normals and bounded dimensions',()=>{
 for(const p of [{...G.defaults,height:120,inseam:72,chest:60,waist:45,shoulders:28},{...G.defaults,height:220,inseam:110,chest:160,hips:180,shoulders:65}]){
  const v=G.scene(p,'LAB-A',{shoulderHipRatio:2.5,legTorsoRatio:3.5}).vertices;for(let i=0;i<v.length;i+=9){assert.ok(Number.isFinite(v[i])&&Number.isFinite(v[i+1])&&Number.isFinite(v[i+2]));assert.ok(Math.abs(Math.hypot(v[i+3],v[i+4],v[i+5])-1)<.0001);assert.ok(Math.abs(v[i])<2&&v[i+1]>-.1&&v[i+1]<2.3&&Math.abs(v[i+2])<1);}
 }
});
