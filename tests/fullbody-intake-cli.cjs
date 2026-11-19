'use strict';
// Temporary synthetic triangles only: not a real human, model licence or approval.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const {validatePackage,REQUIRED_RIGHTS}=require('../scripts/lib/fullbody-asset-policy.cjs');
const script=path.resolve(__dirname,'../scripts/inspect-fullbody-package.cjs');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'a1-intake-PRIVATE-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const dir=path.join(root,'package');fs.mkdirSync(path.join(dir,'models'),{recursive:true});
 const evidence=Buffer.from('SYNTHETIC TEST ONLY. No real model licence or rights grant.');
 fs.writeFileSync(path.join(dir,'licence.txt'),evidence);
 const geometry=Buffer.alloc(36);[0,0,0,1,0,0,0,1,0].forEach((v,i)=>geometry.writeFloatLE(v,i*4));
 const model={asset:{version:'2.0'},buffers:[{uri:'geometry.bin',byteLength:36}],bufferViews:[{buffer:0,byteOffset:0,byteLength:36}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3'}],meshes:[{primitives:[{attributes:{POSITION:0}}]}],nodes:[{mesh:0}],scenes:[{nodes:[0]}],scene:0};
 fs.writeFileSync(path.join(dir,'models/geometry.bin'),geometry);
 const manifest={version:1,assetId:'SYNTHETIC-TRIANGLE-ONLY',name:'Synthetic non-human intake test',source:{vendor:'Synthetic fixture',url:'https://vendor.example.test/model',version:'test-v1'},licence:{id:'SYNTHETIC-ONLY',url:'https://vendor.example.test/licence',attribution:'Synthetic isolated test; no actual commercial rights',evidencePath:'licence.txt',evidenceSha256:sha(evidence)},entry:'models/body.gltf',files:[]};
 const manifestPath=path.join(dir,'manifest.json'),approvalPath=path.join(dir,'approval.json');
 function save(){fs.writeFileSync(path.join(dir,'models/body.gltf'),JSON.stringify(model));manifest.files=['models/body.gltf','models/geometry.bin'].map(file=>{const bytes=fs.readFileSync(path.join(dir,file));return {path:file,role:file.endsWith('.gltf')?'body':'buffer',bytes:bytes.length,sha256:sha(bytes)};});fs.writeFileSync(manifestPath,JSON.stringify(manifest));}
 save();
 function approve(){const inspected=validatePackage({packageDir:dir,manifestPath});const now=Date.now();fs.writeFileSync(approvalPath,JSON.stringify({version:1,assetId:manifest.assetId,decision:'approved',reviewedBy:'SYNTHETIC TEST REVIEWER',reviewedAt:new Date(now-86400000).toISOString(),validUntil:new Date(now+86400000).toISOString(),evidenceReference:'SYNTHETIC TEST ONLY — no real approval',packageSha256:inspected.packageSha256,licenceEvidenceSha256:inspected.licenceEvidenceSha256,scopeSha256:inspected.scopeSha256,rights:Object.fromEntries(REQUIRED_RIGHTS.map(key=>[key,true]))}));}
 return {root,dir,geometry,model,manifest,manifestPath,approvalPath,save,approve};
}
function inspect(options){return require('../scripts/inspect-fullbody-package.cjs').inspectPackage(options);}
function snapshot(dir){return fs.readdirSync(dir,{recursive:true}).sort().map(file=>{const full=path.join(dir,file);return [file,fs.lstatSync(full).isFile()?sha(fs.readFileSync(full)):'DIRECTORY'];});}
function run(...args){return spawnSync(process.execPath,[script,...args],{encoding:'utf8',timeout:10000});}

test('offline intake inspects real bytes but missing approval remains blocked and package stays unchanged',t=>{
 const f=fixture(t),before=snapshot(f.dir),result=inspect({packageDir:f.dir});
 assert.equal(result.version,1);assert.equal(result.assetId,f.manifest.assetId);assert.equal(result.status,'BLOCKED');assert.equal(result.policy.status,'BLOCKED');assert.ok(result.policy.blockers.includes('operator_approval_missing'));
 assert.equal(result.models.length,1);assert.equal(result.models[0].path,'models/body.gltf');assert.equal(result.models[0].stats.vertices,3);assert.equal(result.models[0].stats.triangles,1);
 assert.equal(result.integrationApproved,false);assert.equal(result.qualityVerified,false);assert.deepEqual(snapshot(f.dir),before);
 const cli=run('--package',f.dir);assert.equal(cli.status,2);assert.equal(JSON.parse(cli.stdout).status,'BLOCKED');assert.equal(cli.stderr,'');assert.ok(!cli.stdout.includes(f.root));
});
test('consistent operator record still requires visual review and never approves integration or human quality',t=>{
 const f=fixture(t);f.approve();const before=snapshot(f.dir),result=inspect({packageDir:f.dir,manifestPath:f.manifestPath,approvalPath:f.approvalPath});
 assert.equal(result.policy.status,'APPROVED');assert.equal(result.status,'REVIEW_REQUIRED');assert.equal(result.integrationApproved,false);assert.equal(result.qualityVerified,false);assert.equal(result.models[0].integrationApproved,false);assert.equal(result.models[0].qualityVerified,false);assert.deepEqual(snapshot(f.dir),before);
 const cli=run('--package',f.dir,'--manifest','manifest.json','--approval','approval.json');assert.equal(cli.status,0);assert.equal(JSON.parse(cli.stdout).status,'REVIEW_REQUIRED');
});
test('correct manifest hashes cannot hide invalid geometry or imply renderer feature support',t=>{
 const f=fixture(t);f.geometry.writeFloatLE(NaN,0);fs.writeFileSync(path.join(f.dir,'models/geometry.bin'),f.geometry);f.save();f.approve();
 assert.throws(()=>inspect({packageDir:f.dir,approvalPath:f.approvalPath}),/invalid_number/);
 f.geometry.writeFloatLE(0,0);fs.writeFileSync(path.join(f.dir,'models/geometry.bin'),f.geometry);f.model.materials=[{alphaMode:'BLEND'}];f.model.meshes[0].primitives[0].material=0;f.save();f.approve();
 const result=inspect({packageDir:f.dir,approvalPath:f.approvalPath});assert.equal(result.status,'BLOCKED');assert.ok(result.models[0].blockers.includes('runtime_unsupported:alpha_blend'));assert.equal(result.integrationApproved,false);
});
test('remote references, replaced package files and symlinks are rejected before inspection',t=>{
 const f=fixture(t);f.model.images=[{uri:'https://private.example.test/not-requested.png'}];f.save();assert.throws(()=>inspect({packageDir:f.dir}),/unsafe_package_path/);
 delete f.model.images;f.save();f.approve();const bin=path.join(f.dir,'models/geometry.bin');fs.writeFileSync(bin,Buffer.alloc(36));assert.throws(()=>inspect({packageDir:f.dir,approvalPath:f.approvalPath}),/package_file_hash_mismatch/);
 fs.unlinkSync(bin);const external=path.join(f.root,'DO-NOT-READ.bin');fs.writeFileSync(external,'PRIVATE OUTSIDE CONTENT');fs.symlinkSync(external,bin);assert.throws(()=>inspect({packageDir:f.dir}),/package_symlink_forbidden/);assert.equal(fs.readFileSync(external,'utf8'),'PRIVATE OUTSIDE CONTENT');
});
test('CLI failures expose fixed codes without private paths, file contents or stack traces',t=>{
 const f=fixture(t);f.geometry.writeFloatLE(Infinity,0);fs.writeFileSync(path.join(f.dir,'models/geometry.bin'),f.geometry);f.save();
 const cli=run('--package',f.dir);assert.equal(cli.status,1);const output=cli.stdout+cli.stderr;assert.match(output,/invalid_number/);assert.ok(!output.includes(f.root));assert.ok(!output.includes('at inspect'));assert.ok(!output.includes('SYNTHETIC TEST ONLY'));
 const missing=run('--package',path.join(f.root,'MISSING-PRIVATE-PATH'));assert.equal(missing.status,1);assert.ok(!(missing.stdout+missing.stderr).includes(f.root));
 const unknown=run('--not-supported',f.root);assert.equal(unknown.status,1);assert.ok(!(unknown.stdout+unknown.stderr).includes(f.root));
});
