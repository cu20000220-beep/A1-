/** Offline CPU training only. Reads explicit local data; never contacts a service. */
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {INTENT_LABELS,fitIntentModel,predictIntent,validateIntentRows} from '../server/a1-intents.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const defaults={train:resolve(root,'training/a1-intents/train.jsonl'),eval:resolve(root,'training/a1-intents/eval.jsonl'),
  manifest:resolve(root,'training/a1-intents/manifest.json'),out:resolve(root,'server/models/a1-intent-v1.json'),report:resolve(root,'training/a1-intents/evaluation.json')};
const options={...defaults};let check=false;
for(let at=2;at<process.argv.length;at++){
  const flag=process.argv[at];
  if(flag==='--check'){check=true;continue;}
  if(!flag.startsWith('--')||!Object.hasOwn(defaults,flag.slice(2))||!process.argv[at+1]||process.argv[at+1].startsWith('--'))throw new Error('Use --train/--eval/--manifest/--out/--report with a local path, or --check.');
  options[flag.slice(2)]=resolve(process.argv[++at]);
}
const hash=value=>createHash('sha256').update(value).digest('hex');
const encode=value=>JSON.stringify(value,null,2)+'\n';
function safeJson(text){try{return JSON.parse(text);}catch{throw new Error('Invalid JSON training input; raw content is not logged.');}}
async function boundedRead(file){
  const info=await stat(file);
  if(!info.isFile()||info.size>10*1024*1024)throw new Error('Training inputs must be local text files no larger than 10 MiB each.');
  return readFile(file,'utf8');
}
function rows(text){
  const result=text.split(/\r?\n/).filter(line=>line.trim()).map(line=>safeJson(line));
  validateIntentRows(result);return result;
}
const [trainText,evalText,manifestText]=await Promise.all([boundedRead(options.train),boundedRead(options.eval),boundedRead(options.manifest)]);
const manifest=safeJson(manifestText);
if(manifest.schemaVersion!==1||manifest.purpose!=='fashion-intent-classification'
  ||!['synthetic-development','operator-approved-data'].includes(manifest.datasetOrigin)
  ||manifest.approvedForTraining!==true||manifest.rightsConfirmed!==true||manifest.personalDataReviewed!==true
  ||typeof manifest.provenance!=='string'||!manifest.provenance.trim())throw new Error('An explicit reviewed training-purpose, provenance, rights and privacy manifest is required.');
const train=rows(trainText),evaluation=rows(evalText),seen=validateIntentRows(train);
const evalSeen=validateIntentRows(evaluation);
if([...evalSeen].some(text=>seen.has(text)))throw new Error('Training and evaluation texts must be disjoint after normalization.');
if(new Set(evaluation.map(row=>row.label)).size!==INTENT_LABELS.length)throw new Error('Evaluation must include every supported topic.');
for(const row of [...train,...evaluation]){
  if(typeof row.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(row.id))throw new Error('Training example IDs must be short non-personal IDs.');
  if(manifest.datasetOrigin==='synthetic-development'&&row.source!=='synthetic-development')throw new Error('Synthetic manifests cannot silently include other data.');
  if(manifest.datasetOrigin==='operator-approved-data'&&!['owner-curated','consented-feedback'].includes(row.source))throw new Error('Reviewed real data must explicitly declare its source.');
  if(row.source==='consented-feedback'&&manifest.consentVerified!==true)throw new Error('Feedback data requires separate verified training consent.');
}
if(new Set([...train,...evaluation].map(row=>row.id)).size!==train.length+evaluation.length)throw new Error('Training and evaluation IDs must be unique.');
const model=fitIntentModel(train,{datasetOrigin:manifest.datasetOrigin});
model.training={...model.training,evaluationExamples:evaluation.length,trainSha256:hash(trainText),evaluationSha256:hash(evalText),manifestSha256:hash(manifestText),
  provenance:manifest.provenance,productionValidated:false,scope:'Fashion question topic routing only; not a generative language model, body model or product-fit model.'};
const columns=[...INTENT_LABELS,'abstain'];
const confusion=Object.fromEntries(INTENT_LABELS.map(label=>[label,Object.fromEntries(columns.map(column=>[column,0]))]));
let correct=0,predicted=0;
for(const row of evaluation){const result=predictIntent(model,row.text);confusion[row.label][result.topic||'abstain']++;if(result.topic)predicted++;if(result.topic===row.label)correct++;}
const rounded=value=>Number(value.toFixed(6));
const perTopic=Object.fromEntries(INTENT_LABELS.map(label=>{
  const support=Object.values(confusion[label]).reduce((a,b)=>a+b,0),tp=confusion[label][label];
  const selected=INTENT_LABELS.reduce((sum,actual)=>sum+confusion[actual][label],0),precision=selected?tp/selected:0,recall=tp/support;
  return [label,{support,predicted:selected,precision:rounded(precision),recall:rounded(recall),f1:rounded(precision+recall?2*precision*recall/(precision+recall):0)}];
}));
const modelText=encode(model);
if(Buffer.byteLength(modelText)>200*1024)throw new Error('The experimental model must remain below 200 KiB.');
const report={modelVersion:model.modelVersion,algorithm:model.algorithm,datasetOrigin:manifest.datasetOrigin,
  evaluationScope:manifest.datasetOrigin==='synthetic-development'?'Held-out synthetic development examples only. These are software prototype results, not real-user or expert validation.':'Operator-supplied reviewed evaluation data; production relevance requires a separate assessment.',
  trainingExamples:train.length,evaluationExamples:evaluation.length,correct,predicted,abstained:evaluation.length-predicted,
  accuracy:rounded(correct/evaluation.length),coverage:rounded(predicted/evaluation.length),selectiveAccuracy:predicted?rounded(correct/predicted):null,
  macroF1:rounded(Object.values(perTopic).reduce((sum,row)=>sum+row.f1,0)/INTENT_LABELS.length),perTopic,confusion,
  trainSha256:hash(trainText),evaluationSha256:hash(evalText),manifestSha256:hash(manifestText),modelSha256:hash(modelText),modelBytes:Buffer.byteLength(modelText),
  limitations:['No real customer data or real-world recommendation validation is supplied by the seed corpus.','Classification scores are not calibrated confidence or accuracy.','No photo analysis, garment fit, size, health or product facts are learned by this model.','This script does not collect feedback, approve deployment, change a database or enable a paid provider.']};
const reportText=encode(report);
if(check){
  const [existingModel,existingReport]=await Promise.all([readFile(options.out,'utf8'),readFile(options.report,'utf8')]);
  if(existingModel!==modelText||existingReport!==reportText)throw new Error('Checked-in model or report differs from deterministic training output.');
}else{
  await mkdir(dirname(options.out),{recursive:true});await mkdir(dirname(options.report),{recursive:true});
  await writeFile(options.out,modelText);await writeFile(options.report,reportText);
}
console.log(JSON.stringify({mode:check?'reproducibility-check':'offline-training',modelVersion:model.modelVersion,datasetOrigin:model.datasetOrigin,trainingExamples:train.length,evaluationExamples:evaluation.length,correct,abstained:report.abstained,accuracy:report.accuracy,macroF1:report.macroF1,modelBytes:report.modelBytes,scope:report.evaluationScope}));
