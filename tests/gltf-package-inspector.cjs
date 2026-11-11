'use strict';
// Only synthetic in-memory geometry is used here. These fixtures are never
// published as humans, garments, catalogue products or permission evidence.
const test=require('node:test'),assert=require('node:assert/strict');
const {inspectAsset}=require('../scripts/lib/gltf-package-inspector.cjs');
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');

function fixture({rich=false,triangles=1}={}){
 const document={asset:{version:'2.0',generator:'A1 synthetic inspector test only'},buffers:[{byteLength:0}],bufferViews:[],accessors:[],meshes:[],nodes:[],scenes:[{nodes:[0]}],scene:0};
 const parts=[];let size=0;
 function view(bytes){const padding=(4-size%4)%4;if(padding){parts.push(Buffer.alloc(padding));size+=padding;}const id=document.bufferViews.length;document.bufferViews.push({buffer:0,byteOffset:size,byteLength:bytes.length});parts.push(Buffer.from(bytes));size+=bytes.length;return id;}
 function accessor(values,componentType,type,count){const typeArray={5121:Uint8Array,5123:Uint16Array,5126:Float32Array}[componentType],typed=new typeArray(values),bufferView=view(Buffer.from(typed.buffer));const id=document.accessors.length;document.accessors.push({bufferView,componentType,type,count});return id;}
 const position=accessor([0,0,0,1,0,0,0,1,0],5126,'VEC3',3),normal=accessor([0,0,1,0,0,1,0,0,1],5126,'VEC3',3),uv=accessor([0,0,1,0,0,1],5126,'VEC2',3),index=accessor(Array.from({length:triangles},()=>[0,1,2]).flat(),5123,'SCALAR',triangles*3);
 document.accessors[position].min=[0,0,0];document.accessors[position].max=[1,1,0];
 const primitive={attributes:{POSITION:position,NORMAL:normal,TEXCOORD_0:uv},indices:index,mode:4};document.meshes.push({name:'SYNTHETIC TRIANGLE ONLY',primitives:[primitive]});document.nodes.push({mesh:0});
 if(rich){
  primitive.attributes.JOINTS_0=accessor(Array(12).fill(0),5121,'VEC4',3);
  primitive.attributes.WEIGHTS_0=accessor([1,0,0,0,1,0,0,0,1,0,0,0],5126,'VEC4',3);
  const inverse=accessor([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],5126,'MAT4',1),morph=accessor([.1,0,0,.1,0,0,.1,0,0],5126,'VEC3',3);
  document.accessors[morph].min=[.1,0,0];document.accessors[morph].max=[.1,0,0];
  document.nodes[0].skin=0;document.nodes[0].children=[1];document.nodes.push({name:'SYNTHETIC JOINT'});document.skins=[{joints:[1],skeleton:1,inverseBindMatrices:inverse}];
  primitive.targets=[{POSITION:morph}];document.meshes[0].weights=[0];document.meshes[0].extras={targetNames:['syntheticChest']};
  const imageView=view(PNG);document.images=[{bufferView:imageView,mimeType:'image/png'}];document.textures=[{source:0}];document.materials=[{name:'SYNTHETIC ALPHA MATERIAL',alphaMode:'BLEND',doubleSided:true,pbrMetallicRoughness:{baseColorTexture:{index:0},metallicFactor:0,roughnessFactor:.8}}];primitive.material=0;
 }
 document.buffers[0].byteLength=size;return {document,binary:Buffer.concat(parts)};
}
function glb(document,binary){
 const json=Buffer.from(JSON.stringify(document)),jsonPad=Buffer.alloc((4-json.length%4)%4,0x20),binPad=Buffer.alloc((4-binary.length%4)%4),jsonLength=json.length+jsonPad.length,binLength=binary.length+binPad.length,bytes=Buffer.alloc(12+8+jsonLength+8+binLength);
 bytes.writeUInt32LE(0x46546c67,0);bytes.writeUInt32LE(2,4);bytes.writeUInt32LE(bytes.length,8);bytes.writeUInt32LE(jsonLength,12);bytes.writeUInt32LE(0x4e4f534a,16);json.copy(bytes,20);jsonPad.copy(bytes,20+json.length);
 const offset=20+jsonLength;bytes.writeUInt32LE(binLength,offset);bytes.writeUInt32LE(0x004e4942,offset+4);binary.copy(bytes,offset+8);binPad.copy(bytes,offset+8+binary.length);return bytes;
}
const inspect=(f,options={})=>inspectAsset(glb(f.document,f.binary),{filename:'synthetic.glb',...options});
function throwsCode(fn,code){assert.throws(fn,error=>error instanceof TypeError&&error.message===code,'must fail with '+code);}

test('a bounded self-contained GLB reports actual geometry rather than claiming a usable human',()=>{
 const report=inspect(fixture());assert.equal(report.format,'glb');assert.equal(report.stats.vertices,3);assert.equal(report.stats.triangles,1);assert.equal(report.stats.meshes,1);assert.equal(report.stats.nodes,1);assert.equal(report.stats.skins,0);assert.equal(report.stats.joints,0);assert.equal(report.stats.morphTargets,0);assert.equal(report.stats.materials,0);assert.equal(report.stats.images,0);assert.ok(report.stats.geometryBytes>=78);assert.equal(report.stats.imageBytes,0);
 assert.equal(report.features.skinning,false);assert.equal(report.features.morphTargets,false);assert.equal(report.features.externalResources,false);assert.deepEqual(report.blockers,[]);assert.ok(Array.isArray(report.warnings));
});

test('skin, joint, morph and alpha texture features are discovered but current-renderer limitations remain blockers',()=>{
 const report=inspect(fixture({rich:true}));assert.equal(report.stats.vertices,3);assert.equal(report.stats.triangles,1);assert.equal(report.stats.nodes,2);assert.equal(report.stats.skins,1);assert.equal(report.stats.joints,1);assert.equal(report.stats.morphTargets,1);assert.equal(report.stats.materials,1);assert.equal(report.stats.images,1);assert.equal(report.stats.imageBytes,PNG.length);
 assert.equal(report.features.skinning,true);assert.equal(report.features.morphTargets,true);assert.equal(report.features.alphaBlend,true);assert.equal(report.features.alphaMask,false);assert.equal(report.features.externalResources,false);
 for(const code of ['runtime_unsupported:skinning','runtime_unsupported:morph_targets','runtime_unsupported:alpha_blend'])assert.ok(report.blockers.includes(code),code+' cannot be silently dropped');
});

test('local GLTF resources are resolved explicitly and never fetched by the inspector',()=>{
 const f=fixture();f.document.buffers[0].uri='geometry/mesh.bin';const calls=[];
 const report=inspectAsset(Buffer.from(JSON.stringify(f.document)),{filename:'synthetic.gltf',resolveResource(uri){calls.push(uri);assert.equal(uri,'geometry/mesh.bin');return f.binary;}});
 assert.equal(report.format,'gltf');assert.equal(report.stats.triangles,1);assert.equal(report.features.externalResources,true);assert.deepEqual(calls,['geometry/mesh.bin']);
 throwsCode(()=>inspectAsset(Buffer.from(JSON.stringify(f.document)),{filename:'synthetic.gltf'}),'resource_missing');
});

test('malformed and truncated GLB containers fail before resource resolution',()=>{
 const f=fixture(),valid=glb(f.document,f.binary);let calls=0;const options={filename:'broken.glb',resolveResource(){calls++;throw Error('must not run');}};
 for(const bytes of [Buffer.from('not a model'),valid.subarray(0,10),valid.subarray(0,valid.length-1)])throwsCode(()=>inspectAsset(bytes,options),'invalid_glb');
 for(const mutate of [b=>b.writeUInt32LE(0,0),b=>b.writeUInt32LE(1,4),b=>b.writeUInt32LE(b.length+4,8),b=>b.writeUInt32LE(0x7fffffff,12)]){const bytes=Buffer.from(valid);mutate(bytes);throwsCode(()=>inspectAsset(bytes,options),'invalid_glb');}
 assert.equal(calls,0);
 throwsCode(()=>inspectAsset(Buffer.from('{'),{filename:'broken.gltf'}),'invalid_gltf');
});

test('unsafe model and image URIs are rejected before an operator resolver sees them',()=>{
 for(const uri of ['https://external.example/model.bin','//external.example/model.bin','file:///etc/passwd','../private.bin','geometry/../../private.bin','%2e%2e/private.bin','/absolute.bin','javascript:alert(1)','data:text/html,<script>bad</script>']){
  const f=fixture();f.document.buffers[0].uri=uri;let calls=0;throwsCode(()=>inspectAsset(Buffer.from(JSON.stringify(f.document)),{filename:'unsafe.gltf',resolveResource(){calls++;return f.binary;}}),'unsafe_uri');assert.equal(calls,0,uri+' never reaches file/network resolution');
 }
 const f=fixture({rich:true});f.document.images=[{uri:'https://external.example/private-photo.jpg'}];let calls=0;throwsCode(()=>inspect(f,{resolveResource(){calls++;return PNG;}}),'unsafe_uri');assert.equal(calls,0);
});

test('accessors and views cannot escape declared buffers or disguise invalid strides',()=>{
 const cases=[
  ['invalid_buffer_view',f=>{f.document.bufferViews[0].byteLength=f.binary.length+1;}],
  ['invalid_buffer_view',f=>{f.document.bufferViews[0].byteOffset=-1;}],
  ['invalid_accessor',f=>{f.document.accessors[0].count=1000;}],
  ['invalid_accessor',f=>{f.document.accessors[0].byteOffset=2;}],
  ['invalid_accessor',f=>{f.document.bufferViews[0].byteStride=8;}],
  ['invalid_accessor',f=>{f.document.bufferViews[0].byteStride=13;}],
  ['invalid_accessor',f=>{f.document.accessors[0].componentType=9999;}]
 ];
 for(const [code,mutate]of cases){const f=fixture();mutate(f);throwsCode(()=>inspect(f),code);}
});

test('non-finite vertex data and indices beyond the vertex set are invalid geometry',()=>{
 for(const number of [NaN,Infinity,-Infinity]){const f=fixture();f.binary.writeFloatLE(number,f.document.bufferViews[0].byteOffset);throwsCode(()=>inspect(f),'invalid_number');}
 const f=fixture(),accessor=f.document.accessors[f.document.meshes[0].primitives[0].indices],view=f.document.bufferViews[accessor.bufferView];f.binary.writeUInt16LE(3,view.byteOffset);throwsCode(()=>inspect(f),'invalid_index');
});

test('unknown required extensions and target budgets block acceptance without pretending the data is malformed',()=>{
 const f=fixture();f.document.extensionsUsed=['A1_synthetic_required'];f.document.extensionsRequired=['A1_synthetic_required'];f.document.extensions={A1_synthetic_required:{testOnly:true}};
 assert.ok(inspect(f).blockers.includes('unsupported_required_extension:A1_synthetic_required'));
 const large=fixture({triangles:2});assert.ok(inspect(large,{limits:{maxTriangles:1}}).blockers.includes('budget_exceeded:maxTriangles'));
 assert.ok(inspect(fixture({rich:true}),{limits:{maxImageBytes:1}}).blockers.includes('budget_exceeded:maxImageBytes'));
 const bytes=glb(f.document,f.binary);throwsCode(()=>inspectAsset(bytes,{filename:'synthetic.glb',limits:{maxFileBytes:bytes.length-1}}),'asset_limit');
});

test('scene roots and texture references cannot point outside their declared resources',()=>{
 for(const mutate of [f=>{f.document.scene=2;},f=>{f.document.scenes[0].nodes=[999];},f=>{f.document.scenes[0].nodes='not an array';}]){const f=fixture();mutate(f);throwsCode(()=>inspect(f),'invalid_gltf');}
 for(const mutate of [f=>{f.document.materials[0].pbrMetallicRoughness.baseColorTexture.index=999;},f=>{f.document.materials[0].normalTexture={index:999};},f=>{f.document.textures=[null];},f=>{f.document.textures[0].sampler=99;}]){const f=fixture({rich:true});mutate(f);throwsCode(()=>inspect(f),'invalid_gltf');}
});

test('skin influence weights and joint/weight sets must be usable numeric pairs',()=>{
 for(const weight of [-.25,1.25]){const f=fixture({rich:true}),id=f.document.meshes[0].primitives[0].attributes.WEIGHTS_0,view=f.document.bufferViews[f.document.accessors[id].bufferView];f.binary.writeFloatLE(weight,view.byteOffset);throwsCode(()=>inspect(f),'invalid_accessor');}
 {const f=fixture({rich:true}),p=f.document.meshes[0].primitives[0];p.attributes.JOINTS_1=p.attributes.JOINTS_0;throwsCode(()=>inspect(f),'invalid_accessor');}
 {const f=fixture({rich:true}),p=f.document.meshes[0].primitives[0],a=f.document.accessors[p.attributes.WEIGHTS_0];a.componentType=5121;a.normalized=false;throwsCode(()=>inspect(f),'invalid_accessor');}
});

test('long node chains are inspected without overflowing the JavaScript call stack',()=>{
 const f=fixture(),count=12000;f.document.nodes=Array.from({length:count},(_,i)=>({...(!i?{mesh:0}:{}),...(i<count-1?{children:[i+1]}:{})}));
 const report=inspect(f);assert.equal(report.stats.nodes,count);assert.equal(report.stats.triangles,1);
 const cycle=fixture();cycle.document.nodes[0].children=[0];throwsCode(()=>inspect(cycle),'invalid_gltf');
});

test('image metadata inspection is labelled as header-only rather than full decoding or visual verification',()=>{
 const report=inspect(fixture({rich:true}));assert.ok(report.warnings.includes('image_headers_only'));assert.equal(report.qualityVerified,false);assert.equal(report.integrationApproved,false);
});
