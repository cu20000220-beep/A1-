'use strict';
// Private local copies only. A repository test photograph is NOT evidence that
// a merchant image was downloaded, licensed by that merchant or visually fit.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const {intake}=require('../scripts/cache-product-image.cjs'),{validateLocalCopies}=require('../scripts/lib/product-image-store.cjs');
const script=path.resolve(__dirname,'../scripts/cache-product-image.cjs'),repo=path.resolve(__dirname,'..'),id='musinsa-1168906';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'a1-PRIVATE-image-intake-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const assets=path.join(root,'assets');fs.mkdirSync(assets);const manifest=JSON.parse(fs.readFileSync(path.join(repo,'assets/product-images.json')));manifest.products=manifest.products.filter(e=>e.id===id);
 fs.writeFileSync(path.join(assets,'product-images.json'),JSON.stringify(manifest));fs.copyFileSync(path.join(repo,'assets/observed-products.json'),path.join(assets,'observed-products.json'));
 const input=path.join(root,'PRIVATE-fixture-not-a-retailer-product.jpg');fs.copyFileSync(path.join(repo,'assets/photos/coat.jpg'),input);
 const facts=JSON.parse(fs.readFileSync(path.join(assets,'observed-products.json')));
 const now=Math.max(facts.observedAt,manifest.authorization.recordedAt,...manifest.products.map(image=>image.checkedAt));
 assert.ok(now<manifest.authorization.validUntil,'the test operates within the reviewed image authorization');
 const clock=path.join(root,'test-clock.cjs');fs.writeFileSync(clock,'Date.now = () => '+now+';\n');
 const manifestPath=path.join(assets,'product-images.json'),dest=path.join(assets,'catalog-images',id+'.jpg');return {root,assets,input,manifestPath,dest,manifest,now,clock};
}
function run(f,...args){return spawnSync(process.execPath,['--require',f.clock,script,'--root',f.root,...args],{encoding:'utf8',timeout:10000});}
test('inspection reads actual local bytes without writes, paths, downloads or implicit merchant approval',t=>{
 const f=fixture(t),before=fs.readFileSync(f.manifestPath),result=intake({root:f.root,now:f.now,id,file:f.input});assert.equal(result.status,'INSPECTED');assert.equal(result.written,false);assert.equal(result.networkRequests,0);assert.equal(result.merchantDownloadVerified,false);assert.equal(result.visualProductMatchVerified,false);assert.equal(result.image.sha256,sha(fs.readFileSync(f.input)));assert.equal(result.image.mime,'image/jpeg');assert.ok(result.image.width>1&&result.image.height>1);assert.deepEqual(fs.readFileSync(f.manifestPath),before);assert.equal(fs.existsSync(path.dirname(f.dest)),false);
 const cli=run(f,'--id',id,'--file',f.input);assert.equal(cli.status,0);assert.equal(cli.stderr,'');assert.ok(!cli.stdout.includes(f.root));assert.ok(!cli.stdout.includes(path.basename(f.input)));
});
test('writing binds exact bytes and only one existing product; repeating it is idempotent',t=>{
 const f=fixture(t),source=fs.readFileSync(f.input),beforeFacts=fs.readFileSync(path.join(f.assets,'observed-products.json')),first=intake({root:f.root,now:f.now,id,file:f.input,write:true});assert.equal(first.written,true);assert.equal(first.changed,true);assert.deepEqual(fs.readFileSync(f.dest),source);assert.deepEqual(fs.readFileSync(f.input),source);
 const manifest=JSON.parse(fs.readFileSync(f.manifestPath)),entry=manifest.products[0];assert.equal(entry.id,id);assert.equal(entry.delivery,'local-copy');assert.equal(entry.sourceImageUrl,f.manifest.products[0].sourceImageUrl);assert.equal(entry.sha256,sha(source));assert.equal(entry.imageUrl,'/assets/catalog-images/'+id+'.jpg');assert.equal(validateLocalCopies(f.root,manifest.products)[0].bytes.equals(source),true);assert.deepEqual(fs.readFileSync(path.join(f.assets,'observed-products.json')),beforeFacts);
 const written=fs.readFileSync(f.manifestPath),again=intake({root:f.root,now:f.now,id,file:f.input,write:true});assert.equal(again.changed,false);assert.deepEqual(fs.readFileSync(f.manifestPath),written);assert.equal(fs.existsSync(path.join(f.assets,'.product-image-intake.lock')),false);
});
test('missing product, expired authority and non-image input leave all public records untouched',t=>{
 const f=fixture(t),before=fs.readFileSync(f.manifestPath);assert.throws(()=>intake({root:f.root,now:f.now,id:'not-published',file:f.input,write:true}),/product_image_id_missing/);
 const bad=path.join(f.root,'PRIVATE-secret.png');fs.writeFileSync(bad,'<svg><text>PRIVATE CONTENT DO NOT LOG</text></svg>');const cli=run(f,'--id',id,'--file',bad,'--write');assert.equal(cli.status,1);assert.ok(!(cli.stdout+cli.stderr).includes(f.root));assert.ok(!(cli.stdout+cli.stderr).includes('PRIVATE CONTENT'));assert.deepEqual(fs.readFileSync(f.manifestPath),before);assert.equal(fs.existsSync(f.dest),false);
 assert.throws(()=>intake({root:f.root,id,file:f.input,write:true,now:f.manifest.authorization.validUntil}));assert.deepEqual(fs.readFileSync(f.manifestPath),before);
});
test('symlink inputs and output directories cannot copy or overwrite outside the worktree',t=>{
 const f=fixture(t),linked=path.join(f.root,'linked.jpg');fs.symlinkSync(f.input,linked);assert.throws(()=>intake({root:f.root,now:f.now,id,file:linked,write:true}),/product_image_symlink/);
 const outside=fs.mkdtempSync(path.join(os.tmpdir(),'a1-PRIVATE-outside-'));t.after(()=>fs.rmSync(outside,{recursive:true,force:true}));fs.symlinkSync(outside,path.dirname(f.dest));assert.throws(()=>intake({root:f.root,now:f.now,id,file:f.input,write:true}),/product_image_symlink/);assert.deepEqual(fs.readdirSync(outside),[]);assert.equal(fs.existsSync(path.join(f.assets,'.product-image-intake.lock')),false);
});
test('a locked intake or unregistered destination is preserved rather than silently overwritten',t=>{
 const f=fixture(t),lock=path.join(f.assets,'.product-image-intake.lock');fs.writeFileSync(lock,'PRIVATE other writer');assert.throws(()=>intake({root:f.root,now:f.now,id,file:f.input,write:true}),/product_image_intake_busy/);assert.equal(fs.readFileSync(lock,'utf8'),'PRIVATE other writer');fs.unlinkSync(lock);
 fs.mkdirSync(path.dirname(f.dest));const privateBytes=Buffer.from('PRIVATE unrelated image data');fs.writeFileSync(f.dest,privateBytes);assert.throws(()=>intake({root:f.root,now:f.now,id,file:f.input,write:true}),/product_image_existing_file_unreviewed/);assert.deepEqual(fs.readFileSync(f.dest),privateBytes);
});
test('manifest commit failure restores the previously reviewed image and removes temporary files',t=>{
 const f=fixture(t);intake({root:f.root,now:f.now,id,file:f.input,write:true});const oldManifest=fs.readFileSync(f.manifestPath),oldImage=fs.readFileSync(f.dest),replacement=path.join(f.root,'PRIVATE-replacement.jpg');fs.copyFileSync(path.join(repo,'assets/photos/man.jpg'),replacement);
 const rename=fs.renameSync;fs.renameSync=function(from,to){if(to===f.manifestPath)throw Error('PRIVATE INTERNAL FAILURE');return rename(from,to);};
 try{assert.throws(()=>intake({root:f.root,now:f.now,id,file:replacement,write:true}));}finally{fs.renameSync=rename;}
 assert.deepEqual(fs.readFileSync(f.manifestPath),oldManifest);assert.deepEqual(fs.readFileSync(f.dest),oldImage);assert.deepEqual(fs.readdirSync(path.dirname(f.dest)),[id+'.jpg']);assert.ok(!fs.readdirSync(f.assets).some(name=>name.startsWith('.')));
});
test('local copy inspection rejects incorrect metadata, substitutions and symlinked files',t=>{
 const f=fixture(t);intake({root:f.root,now:f.now,id,file:f.input,write:true});const entries=JSON.parse(fs.readFileSync(f.manifestPath)).products;
 for(const patch of [{width:entries[0].width+1},{sha256:'0'.repeat(64)},{imageUrl:'/assets/catalog-images/../private.jpg'}])assert.throws(()=>validateLocalCopies(f.root,[{...entries[0],...patch}]));
 fs.unlinkSync(f.dest);fs.symlinkSync(f.input,f.dest);assert.throws(()=>validateLocalCopies(f.root,entries),/product_image_symlink/);
});
