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
