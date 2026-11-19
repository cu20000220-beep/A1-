#!/usr/bin/env node
'use strict';
// Only local private candidate preparation. Never calls providers or publishes assets.
const fs=require('node:fs'),path=require('node:path');
const {createSourceAdapter}=require('./lib/source-adapters.cjs');
function contained(file,directory){const relative=path.relative(directory,file);return relative===''||!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative);}
function optionsFrom(args){const out={};for(let i=0;i<args.length;i++){const k=args[i];if(!['--input','--config','--output'].includes(k)||out[k]||!args[i+1]||args[i+1].startsWith('--'))throw Error('invalid_options');out[k]=args[++i];}if(Object.keys(out).length!==3)throw Error('missing_options');return out;}
function run(args){const options=optionsFrom(args),root=path.resolve(__dirname,'..'),input=fs.realpathSync(path.resolve(options['--input'])),configPath=fs.realpathSync(path.resolve(options['--config'])),output=path.resolve(options['--output']);
 const parent=fs.realpathSync(path.dirname(output)),resolvedOutput=path.join(parent,path.basename(output));
 for(const publicDir of [path.join(root,'assets'),path.join(root,'dist')]){if(contained(output,publicDir)||contained(resolvedOutput,publicDir))throw Error('public_output_forbidden');}
 if(output===input||output===configPath||resolvedOutput===input||resolvedOutput===configPath||fs.existsSync(output))throw Error('candidate_output_must_be_new');
 const inputInfo=fs.statSync(input),configInfo=fs.statSync(configPath);if(!inputInfo.isFile()||!configInfo.isFile())throw Error('regular_input_files_required');
 if(inputInfo.size>4*1024*1024||configInfo.size>128*1024)throw Error('input_too_large');
 const config=JSON.parse(fs.readFileSync(configPath,'utf8'));if(!config||Object.keys(config).some(k=>!['kind','approvalId','sourceUrl','mapping','defaults'].includes(k)))throw Error('unrecognized_config_fields');
 const raw=fs.readFileSync(input,'utf8'),payload=path.extname(input).toLowerCase()==='.csv'?raw:JSON.parse(raw);
 const adapter=createSourceAdapter(config.kind,config),result=adapter.prepare(payload),text=JSON.stringify(result.candidates,null,2)+'\n';if(Buffer.byteLength(text)>4*1024*1024)throw Error('candidate_too_large');
 fs.writeFileSync(resolvedOutput,text,{flag:'wx',mode:0o600});process.stdout.write(JSON.stringify({mode:'offline-candidate-only',sourceKind:result.sourceKind,candidateCount:result.candidateCount,registeredProducts:0,approvalRequired:true,liveEnabled:false})+'\n');
}
if(require.main===module){try{run(process.argv.slice(2));}catch{process.stderr.write('Source preparation rejected. Check private input/config, required mappings and candidate output path.\n');process.exitCode=1;}}
module.exports={run,optionsFrom};
