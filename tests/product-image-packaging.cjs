'use strict';
// All writes/builds are in a disposable worktree. No test image is registered
// or published in the actual application's product catalog.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const {intake}=require('../scripts/cache-product-image.cjs'),repo=path.resolve(__dirname,'..');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),id='musinsa-1168906';
test('public packaging includes only verified local product copies and fails closed on substitutions',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'a1-PRIVATE-packaging-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 for(const name of ['assets','templates','catalog','scripts'])fs.cpSync(path.join(repo,name),path.join(root,name),{recursive:true});
 for(const name of fs.readdirSync(repo).filter(name=>name.endsWith('.html')||name==='_headers'))fs.copyFileSync(path.join(repo,name),path.join(root,name));
 const dir=path.join(root,'assets/catalog-images');fs.mkdirSync(dir,{recursive:true});const marker='PRIVATE-UNREGISTERED-PERSONAL-FILE-DO-NOT-PUBLISH';fs.writeFileSync(path.join(dir,'unregistered-personal.jpg'),marker);
 const build=()=>spawnSync(process.execPath,[path.join(root,'scripts/build-site.cjs')],{cwd:root,encoding:'utf8',timeout:30000});
 const dest=path.join(root,'dist/assets/catalog-images',id+'.jpg'),manifestPath=path.join(root,'assets/product-images.json');
 await t.test('unregistered personal files are ignored without reading or copying their bytes',()=>{
  const result=build();assert.equal(result.status,0,result.stdout+result.stderr);assert.equal(fs.existsSync(path.join(root,'dist/assets/catalog-images')),false);assert.equal(fs.readFileSync(path.join(dir,'unregistered-personal.jpg'),'utf8'),marker);
 });
 await t.test('an operator-selected private test image is bound to the manifest and is the only copied file',()=>{
  intake({root,id,file:path.join(repo,'assets/photos/coat.jpg'),write:true});const result=build();assert.equal(result.status,0,result.stdout+result.stderr);
  assert.deepEqual(fs.readdirSync(path.dirname(dest)),[id+'.jpg']);assert.deepEqual(fs.readFileSync(dest),fs.readFileSync(path.join(repo,'assets/photos/coat.jpg')));
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'dist/assets/product-images.json'))),entry=manifest.products.find(p=>p.id===id);assert.equal(entry.delivery,'local-copy');assert.equal(entry.sha256,sha(fs.readFileSync(dest)));assert.equal(fs.existsSync(path.join(root,'dist/scripts/cache-product-image.cjs')),false);
 });
 await t.test('wrong dimensions, hash-consistent non-images and symlink substitutions preserve the previous valid build',()=>{
  const before=fs.readFileSync(dest),manifestBytes=fs.readFileSync(manifestPath),source=path.join(dir,id+'.jpg');
  let changed=JSON.parse(manifestBytes);changed.products.find(p=>p.id===id).width++;fs.writeFileSync(manifestPath,JSON.stringify(changed));assert.notEqual(build().status,0);assert.deepEqual(fs.readFileSync(dest),before);
  const invalid=Buffer.from('<html>PRIVATE CONTENT THAT IS NOT A PRODUCT IMAGE</html>');fs.writeFileSync(source,invalid);changed=JSON.parse(manifestBytes);Object.assign(changed.products.find(p=>p.id===id),{sha256:sha(invalid),bytes:invalid.length,width:1,height:1});fs.writeFileSync(manifestPath,JSON.stringify(changed));assert.notEqual(build().status,0);assert.deepEqual(fs.readFileSync(dest),before);
  fs.writeFileSync(manifestPath,manifestBytes);fs.unlinkSync(source);fs.symlinkSync(path.join(repo,'assets/photos/coat.jpg'),source);assert.notEqual(build().status,0);assert.deepEqual(fs.readFileSync(dest),before);assert.equal(fs.readFileSync(path.join(dir,'unregistered-personal.jpg'),'utf8'),marker);
 });
});
