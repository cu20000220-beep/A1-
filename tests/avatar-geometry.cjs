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
test('skin material masks follow existing human triangles without painting the garment or changing its body mesh',()=>{
 G.installBase(require('../assets/human-base.js'));
 const plain=G.scene(G.defaults,'none'),dressed=G.scene(G.defaults,'LAB-A');assert.deepEqual(plain.bodyMesh.positions,dressed.bodyMesh.positions,'material metadata must not move the human');
 for(const scene of [plain,dressed]){const values=scene.surfaceMaterials;assert.ok(values instanceof Float32Array);assert.equal(values.length,scene.vertices.length/3);let skin=0,head=0,hands=0,feet=0;
  for(let i=0;i<values.length;i+=3){assert.equal(values[i],0);assert.equal(values[i+1],0);assert.ok(values[i+2]===0||values[i+2]===1,'bounded generic material classification');if(values[i+2]){skin++;const v=i*3,x=scene.vertices[v],y=scene.vertices[v+1];if(y>1.43)head++;if(Math.abs(x)>.20&&y<1.2)hands++;if(y<.1)feet++;}}
  assert.ok(skin>1000&&head>100&&hands>100&&feet>100,'face, exposed arms/hands and feet receive a skin material');
 }
 const garmentFloats=dressed.garmentMesh.indices.length*9,start=dressed.vertices.length-garmentFloats;for(let v=start;v<dressed.vertices.length;v+=9)assert.equal(dressed.surfaceMaterials[v/3+2],0,'skin shading never labels the top as exposed skin');
});

// Derive topology from indexed triangles rather than trusting renderer metadata.
function garmentTopology(mesh){
 const count=mesh.positions.length/3,edges=new Map(),neighbors=Array.from({length:count},()=>new Set());
 for(let i=0;i<mesh.indices.length;i+=3){
  const triangle=Array.from(mesh.indices.slice(i,i+3));assert.equal(new Set(triangle).size,3,'triangle indices must be distinct');
  for(const id of triangle)assert.ok(Number.isInteger(id)&&id>=0&&id<count,'every index addresses an existing garment vertex');
  const [a,b,c]=triangle.map(id=>Array.from(mesh.positions.slice(id*3,id*3+3))),u=b.map((v,k)=>v-a[k]),v=c.map((n,k)=>n-a[k]);
  assert.ok(Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])>1e-14,'sewn shell must not have zero-area triangles');
  for(let j=0;j<3;j++){const a=triangle[j],b=triangle[(j+1)%3],key=a<b?a+':'+b:b+':'+a;edges.set(key,(edges.get(key)||0)+1);neighbors[a].add(b);neighbors[b].add(a);}
 }
 assert.ok([...edges.values()].every(n=>n===1||n===2),'no non-manifold edges');
 const components=adjacency=>{const visited=new Set(),parts=[];for(let id=0;id<adjacency.length;id++){if(!adjacency[id]?.size||visited.has(id))continue;const ids=[],stack=[id];visited.add(id);while(stack.length){const current=stack.pop();ids.push(current);for(const next of adjacency[current])if(!visited.has(next)){visited.add(next);stack.push(next);}}parts.push(ids);}return parts;};
 assert.equal(components(neighbors).length,1,'neck, shoulders, torso and sleeves form one connected garment');assert.ok(neighbors.every(n=>n.size>0),'no unused isolated garment vertices');
 const boundary=Array.from({length:count},()=>new Set());for(const [key,n]of edges)if(n===1){const[a,b]=key.split(':').map(Number);boundary[a].add(b);boundary[b].add(a);}
 assert.ok(boundary.every(n=>n.size===0||n.size===2),'each opening is a closed simple boundary without branching');return components(boundary);
}
function bodyTriangles(mesh){
 const triangles=[];for(let i=0;i<mesh.indices.length;i+=3){const ids=Array.from(mesh.indices.slice(i,i+3)),p=ids.map(id=>Array.from(mesh.positions.slice(id*3,id*3+3))),normals=ids.map(id=>Array.from(mesh.normals.slice(id*3,id*3+3)));triangles.push({p,normals,min:[0,1,2].map(k=>Math.min(...p.map(v=>v[k]))),max:[0,1,2].map(k=>Math.max(...p.map(v=>v[k])))});}return triangles;
}
// Closest point on a triangle (Voronoi regions), with interpolated body normal.
// Uses the full body independently of the garment's matching anchor/tangent.
function closestTrianglePoint(point,triangle){
 const[a,b,c]=triangle.p,ab=b.map((v,k)=>v-a[k]),ac=c.map((v,k)=>v-a[k]),ap=point.map((v,k)=>v-a[k]),dot=(x,y)=>x[0]*y[0]+x[1]*y[1]+x[2]*y[2];
 const d1=dot(ab,ap),d2=dot(ac,ap);let weights;
 if(d1<=0&&d2<=0)weights=[1,0,0];else{
  const bp=point.map((v,k)=>v-b[k]),d3=dot(ab,bp),d4=dot(ac,bp);
  if(d3>=0&&d4<=d3)weights=[0,1,0];else{
   const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);weights=[1-v,v,0];}else{
    const cp=point.map((v,k)=>v-c[k]),d5=dot(ab,cp),d6=dot(ac,cp);
    if(d6>=0&&d5<=d6)weights=[0,0,1];else{
     const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6);weights=[1-w,0,w];}else{
      const va=d3*d6-d5*d4;if(va<=0&&(d4-d3)>=0&&(d5-d6)>=0){const w=(d4-d3)/((d4-d3)+(d5-d6));weights=[0,1-w,w];}else{const inverse=1/(va+vb+vc),v=vb*inverse,w=vc*inverse;weights=[1-v-w,v,w];}
     }
    }
   }
  }
 }
 const closest=[0,1,2].map(k=>weights.reduce((sum,w,j)=>sum+w*triangle.p[j][k],0)),normal=[0,1,2].map(k=>weights.reduce((sum,w,j)=>sum+w*triangle.normals[j][k],0));return {closest,normal};
}
function signedBodyDistance(point,triangles){
 let best=Infinity,result;for(const triangle of triangles){let bound=0;for(let k=0;k<3;k++){const d=point[k]<triangle.min[k]?triangle.min[k]-point[k]:point[k]>triangle.max[k]?point[k]-triangle.max[k]:0;bound+=d*d;}if(bound>best)continue;
  const {closest,normal}=closestTrianglePoint(point,triangle),delta=point.map((v,k)=>v-closest[k]),squared=delta.reduce((sum,v)=>sum+v*v,0);if(squared>=best)continue;best=squared;result={distance:Math.sqrt(squared),signed:delta.reduce((sum,v,k)=>sum+v*normal[k],0)/Math.hypot(...normal),point,closest};
 }return result;
}
test('example tops have one sewn manifold shell and four genuine neckline, cuff and hem openings',()=>{
 G.installBase(require('../assets/human-base.js'));
 const unchangedBody=G.scene(G.defaults,'none').bodyMesh.positions;
 for(const style of ['LAB-A','LAB-B','LAB-C']){
  const scene=G.scene(G.defaults,style);assert.deepEqual(scene.bodyMesh.positions,unchangedBody,'changing garments must not move or shrink the human body to hide intersections');const mesh=scene.garmentMesh;assert.ok(mesh,'the licensed body must produce a structured example garment');assert.equal(mesh.positions.length,mesh.normals.length);const loops=garmentTopology(mesh);assert.equal(loops.length,4,'exactly one neck, two cuffs and one hem; no detached sleeve or crotch holes');
  const mean=(ids,k)=>ids.reduce((sum,id)=>sum+mesh.sourcePositions[id*3+k],0)/ids.length,sorted=loops.slice().sort((a,b)=>mean(a,1)-mean(b,1)),hem=sorted[0],neck=sorted.at(-1),cuffs=sorted.slice(1,-1);
  assert.ok(mean(hem,1)<mean(cuffs[0],1)&&mean(neck,1)>mean(cuffs[1],1));assert.ok(mean(cuffs[0],0)*mean(cuffs[1],0)<0,'cuffs belong to opposite arms');assert.ok(Math.abs(mean(neck,0))<.01&&Math.abs(mean(hem,0))<.01,'neck and hem surround the torso');
  const declared=mesh.boundaries.map(loop=>new Set(loop.indices));assert.equal(declared.length,4);for(const loop of loops)assert.ok(declared.some(ids=>ids.size===loop.length&&loop.every(id=>ids.has(id))),'declared openings match actual unpaired mesh edges');assert.deepEqual(mesh.boundaries.map(b=>b.kind).sort(),['cuff','cuff','hem','neck']);
  const neckY=neck.map(id=>mesh.sourcePositions[id*3+1]);assert.ok(Math.max(...neckY)-Math.min(...neckY)>.025,'neckline has an actual lower front opening, not a flat collar tube');assert.ok(neck.every(id=>Math.abs(mesh.sourcePositions[id*3])<.11),'neck opening must not consume the shoulder seam');const front=neck.filter(id=>mesh.sourcePositions[id*3+2]>0),back=neck.filter(id=>mesh.sourcePositions[id*3+2]<-.05);assert.ok(front.length&&back.length);assert.ok(mean(front,1)+.015<mean(back,1),'front neckline is lower than the back neckline');
  for(let i=0;i<mesh.normals.length;i+=3)assert.ok(Math.abs(Math.hypot(mesh.normals[i],mesh.normals[i+1],mesh.normals[i+2])-1)<1e-4,'continuous shell normals are finite unit vectors');
 }
});
test('body and photo edits deform the connected garment while retaining clearance at vertices and sampled triangle interiors',()=>{
 G.installBase(require('../assets/human-base.js'));
 const knownTriangle={p:[[0,0,0],[1,0,0],[0,1,0]],normals:[[0,0,1],[0,0,1],[0,0,1]],min:[0,0,0],max:[1,1,0]};assert.ok(signedBodyDistance([.2,.2,.01],[knownTriangle]).signed>.009);assert.ok(signedBodyDistance([.2,.2,-.01],[knownTriangle]).signed<-.009);
 const profiles=[{name:'default',input:{...G.defaults},reference:null},{name:'broad waist and shoulders',input:{...G.defaults,chest:110,waist:100,shoulders:50},reference:{shoulderHipRatio:1.55,legTorsoRatio:1.8}},{name:'narrow',input:{...G.defaults,height:160,chest:78,waist:62,hips:84,shoulders:34,inseam:72},reference:{shoulderHipRatio:1.05,legTorsoRatio:1.4}}];
 const base=G.scene(G.defaults,'LAB-A').garmentMesh.positions;
 for(const {name,input,reference}of profiles)for(const style of ['LAB-A','LAB-B','LAB-C']){
  const scene=G.scene(input,style,reference),mesh=scene.garmentMesh;assert.equal(garmentTopology(mesh).length,4,name+' '+style+' retains garment topology');if(name!=='default')assert.notDeepEqual(mesh.positions,base,'entered body/reference values change the real shell');
  assert.ok(scene.bodyMesh?.positions&&scene.bodyMesh.indices,'full body geometry is available for an independent clearance check');
  for(let i=0;i<mesh.positions.length;i+=3){let gap=0;for(let k=0;k<3;k++)gap+=(mesh.positions[i+k]-mesh.bodyPositions[i+k])*mesh.bodyNormals[i+k];assert.ok(gap>=mesh.minimumClearance-1e-6,name+' '+style+' has positive local garment/body clearance at vertex '+i/3);}
  const triangles=bodyTriangles(scene.bodyMesh),samples=[];for(let id=0;id<mesh.positions.length/3;id+=Math.max(1,Math.floor(mesh.positions.length/3/72)))samples.push(Array.from(mesh.positions.slice(id*3,id*3+3)));for(const boundary of mesh.boundaries)for(let j=0;j<boundary.indices.length;j+=Math.max(1,Math.floor(boundary.indices.length/4))){const id=boundary.indices[j];samples.push(Array.from(mesh.positions.slice(id*3,id*3+3)));}
  for(let triangle=0;triangle<mesh.indices.length/3;triangle+=Math.max(1,Math.floor(mesh.indices.length/3/72))){const ids=Array.from(mesh.indices.slice(triangle*3,triangle*3+3));samples.push([0,1,2].map(k=>ids.reduce((sum,id)=>sum+mesh.positions[id*3+k],0)/3));}
  for(const sample of samples){const nearest=signedBodyDistance(sample,triangles);assert.ok(nearest.signed>=-2e-4,name+' '+style+' sampled garment point penetrates full body: '+JSON.stringify(nearest));}
 }
});
