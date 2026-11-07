'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {readFileSync,mkdtempSync,writeFileSync,rmSync}=require('node:fs');
const {join,resolve}=require('node:path');
const {tmpdir}=require('node:os');
const {execFileSync}=require('node:child_process');
const root=resolve(__dirname,'..'),modulePromise=import('../server/a1-intents.mjs');
const read=name=>readFileSync(join(root,name),'utf8');
const rows=name=>read('training/a1-intents/'+name+'.jsonl').trim().split('\n').map(line=>JSON.parse(line));
const artifact=()=>JSON.parse(read('server/models/a1-intent-v1.json'));

test('owned intent artifact is actually reproducible from explicit rights-reviewed local development data',()=>{
  const result=JSON.parse(execFileSync(process.execPath,['scripts/train-a1-intents.mjs','--check'],{cwd:root,encoding:'utf8'}));
  assert.equal(result.mode,'reproducibility-check');
  assert.equal(result.trainingExamples,144);assert.equal(result.evaluationExamples,36);
  assert.equal(result.datasetOrigin,'synthetic-development');assert.ok(result.modelBytes<200000);
  const report=JSON.parse(read('training/a1-intents/evaluation.json'));
  assert.equal(report.correct,27);assert.equal(report.abstained,4);
  assert.equal(report.accuracy,0.75,'Reported score must be actual held-out seed evaluation, not a marketing claim');
  assert.match(report.evaluationScope,/not real-user or expert validation/);
  assert.equal(Object.values(report.confusion).flatMap(row=>Object.values(row)).reduce((a,b)=>a+b,0),36);
  assert.match(artifact().training.trainSha256,/^[a-f0-9]{64}$/);
});

test('training and held-out evaluation are normalized-disjoint and never contain customer provenance',async()=>{
  const {validateIntentRows,normalizeIntentText}=await modulePromise;
  const train=rows('train'),evaluation=rows('eval'),seen=validateIntentRows(train);
  assert.equal(train.length,144);assert.equal(evaluation.length,36);
  assert.ok(evaluation.every(row=>!seen.has(normalizeIntentText(row.text))));
  assert.ok([...train,...evaluation].every(row=>row.source==='synthetic-development'));
  assert.deepEqual(new Set([...train,...evaluation].map(row=>row.language)),new Set(['ko','en']));
});

test('learned weights and routing change with training labels rather than a fixed keyword response',async()=>{
  const {fitIntentModel,predictIntent}=await modulePromise;
  const train=rows('train'),first=fitIntentModel(train),again=fitIntentModel(train);
  assert.deepEqual(first,again,'Training must be deterministic');
  const swapped=fitIntentModel(train.map(row=>({...row,label:row.label==='outfit'?'fit':row.label==='fit'?'outfit':row.label})));
  assert.notDeepEqual(first.logLikelihoods,swapped.logLikelihoods);
  assert.equal(predictIntent(first,'Suggest a casual weekend outfit').topic,'outfit');
  assert.equal(predictIntent(swapped,'Suggest a casual weekend outfit').topic,'fit');
});

test('bilingual topic classification uses bounded shared features and abstains on weak or invalid evidence',async()=>{
  const {predictIntent,intentFeatures}=await modulePromise,model=artifact();
  for(const text of ['니트의 세탁 라벨을 어떻게 읽나요','Explain the symbols on a garment care label']){
    const value=predictIntent(model,text);assert.equal(value.topic,'care');assert.equal(value.method,'trained-seed');
    assert.ok(Number.isFinite(value.margin));assert.ok(value.evidence>=3);
    assert.equal(Object.hasOwn(value,'confidence'),false);assert.equal(Object.hasOwn(value,'accuracy'),false);
  }
  for(const text of ['', '!!!', 'xyzqv', 'x'.repeat(1201), '\u0000private'])assert.equal(predictIntent(model,text).topic,null);
  assert.ok(intentFeatures('a'.repeat(1200)).size<=600);
  assert.ok([...intentFeatures('casual casual casual casual').values()].every(value=>value<=3));
});

test('dataset checks reject privacy mistakes and non-text inputs without echoing the rejected data',async()=>{
  const {validateIntentRows}=await modulePromise;
  const good={label:'budget',language:'en',text:'My clothing budget is 100 USD'};
  assert.equal(validateIntentRows([good]).size,1);
  const privateInputs=['Contact me at private@example.test','Call +82 10 1234 5678','Read https://example.test/photo','data:image/png;base64,private','image_url private','sk-proj-this-is-a-private-fixture-key-123456'];
  for(const text of privateInputs)assert.throws(()=>validateIntentRows([{...good,text}]),error=>{
    assert.equal(error.message,'sensitive_or_nontext_training_example');assert.ok(!error.message.includes(text));return true;
  });
  assert.throws(()=>validateIntentRows([good,{...good,text:'  MY CLOTHING BUDGET IS 100 USD  '}]),/duplicate/);
  assert.throws(()=>validateIntentRows([{...good,label:'__proto__'}]),/invalid/);
});

test('malformed models cannot yield nonfinite scores and a compiled model snapshot cannot be mutated by a caller',async()=>{
  const {predictIntent}=await modulePromise;
  for(const change of [model=>{model.logPriors[0]=NaN;},model=>{model.logLikelihoods[0][0]=-1e308;},model=>{model.labels[0]='__proto__';}]){
    const model=artifact();change(model);assert.throws(()=>predictIntent(model,'casual weekend outfit'),/invalid_intent_model/);
  }
  const model=artifact(),before=predictIntent(model,'casual weekend outfit');
  model.logLikelihoods[0][0]=NaN;model.labels[0]='untrusted';
  assert.deepEqual(predictIntent(model,'casual weekend outfit'),before,'The validated private snapshot stays fixed for this model object');
});

test('custom training refuses missing rights or feedback consent and rejects evaluation leakage',()=>{
  const scratch=mkdtempSync(join(tmpdir(),'a1-intent-training-'));
  try{
    const manifest=JSON.parse(read('training/a1-intents/manifest.json'));
    const custom=join(scratch,'manifest.json');writeFileSync(custom,JSON.stringify({...manifest,approvedForTraining:false}));
    assert.throws(()=>execFileSync(process.execPath,['scripts/train-a1-intents.mjs','--manifest',custom,'--check'],{cwd:root,stdio:'pipe'}),error=>/rights and privacy manifest/.test(String(error.stderr)));
    assert.throws(()=>execFileSync(process.execPath,['scripts/train-a1-intents.mjs','--eval',join(root,'training/a1-intents/train.jsonl'),'--check'],{cwd:root,stdio:'pipe'}),error=>/must be disjoint/.test(String(error.stderr)));
    const train=rows('train').map(row=>({...row,source:'consented-feedback'}));writeFileSync(join(scratch,'train.jsonl'),train.map(row=>JSON.stringify(row)).join('\n'));
    const evalRows=rows('eval').map(row=>({...row,source:'consented-feedback'}));writeFileSync(join(scratch,'eval.jsonl'),evalRows.map(row=>JSON.stringify(row)).join('\n'));
    writeFileSync(custom,JSON.stringify({...manifest,datasetOrigin:'operator-approved-data'}));
    assert.throws(()=>execFileSync(process.execPath,['scripts/train-a1-intents.mjs','--train',join(scratch,'train.jsonl'),'--eval',join(scratch,'eval.jsonl'),'--manifest',custom,'--check'],{cwd:root,stdio:'pipe'}),error=>/separate verified training consent/.test(String(error.stderr)));
  }finally{rmSync(scratch,{recursive:true,force:true});}
});
