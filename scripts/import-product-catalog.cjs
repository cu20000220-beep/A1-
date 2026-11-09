#!/usr/bin/env node
'use strict';
// Read/write local files only. Never touches services, credentials or DBs.
const fs=require('node:fs'),path=require('node:path');
const {compileCatalog,parseCsv,sha}=require('./lib/product-catalog.cjs');
const args=process.argv.slice(2),options={};
for(let i=0;i<args.length;i++){const key=args[i];if(key==='--inspect')options.inspect=true;else if(['--input','--approvals','--output','--now'].includes(key)&&args[i+1]&&!args[i+1].startsWith('--')){if(options[key])throw Error('Duplicate option');options[key]=args[++i];}else throw Error('Unknown or missing option');}
try{
 if(!options['--input']||!options['--approvals']||!options.inspect&&!options['--output'])throw Error('Usage: node scripts/import-product-catalog.cjs --input seller.json|csv --approvals catalog/source-approvals.json [--inspect | --output assets/approved-products.json] [--now ISO]');
 const inputPath=path.resolve(options['--input']),approvalPath=path.resolve(options['--approvals']),outputPath=options['--output']&&path.resolve(options['--output']);
 if(outputPath&&(outputPath===inputPath||outputPath===approvalPath))throw Error('Output must not overwrite input or approvals');
 if(fs.statSync(inputPath).size>4*1024*1024)throw Error('Seller file exceeds 4 MiB');
 const raw=fs.readFileSync(inputPath),source=raw.toString('utf8');if(raw.length>4*1024*1024)throw Error('Seller file exceeds 4 MiB');
 const input=path.extname(inputPath).toLowerCase()==='.csv'?parseCsv(source):JSON.parse(source),approvals=JSON.parse(fs.readFileSync(approvalPath,'utf8'));
 const now=options['--now']?Date.parse(options['--now']):Date.now();const result=compileCatalog(input,approvals,{now,inputSha256:sha(raw),inspect:options.inspect===true});
 if(options.inspect){process.stdout.write(JSON.stringify({mode:'inspection-only',registeredProducts:0,candidateCount:result.snapshot.products.length,inputSha256:result.inputSha256,productsSha256ByApproval:result.digests},null,2)+'\n');}
 else {const publicText=JSON.stringify(result.snapshot,null,2)+'\n';if(Buffer.byteLength(publicText)>1000000)throw Error('Public snapshot exceeds 1 MB');const temporary=outputPath+'.tmp';fs.writeFileSync(temporary,publicText,{flag:'wx'});fs.renameSync(temporary,outputPath);process.stdout.write(JSON.stringify({mode:'validated-local-snapshot',registeredProducts:result.snapshot.products.length})+'\n');}
}catch(error){process.stderr.write('Catalog import rejected: '+error.message+'\n');process.exitCode=1;}
