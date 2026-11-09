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
