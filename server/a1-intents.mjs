/** A small locally trained topic classifier. No network, storage or user-data collection. */
export const INTENT_LABELS = Object.freeze(['outfit','fit','color','occasion','budget','care','compare','discount','out_of_scope']);
const MAX_TEXT = 1200;
const MAX_FEATURES = 600;
const cache = new WeakMap();
const ambiguous = () => ({ topic: null, method: 'ambiguous', evidence: 0, margin: 0 });

export function normalizeIntentText(text) {
  if (typeof text !== 'string' || text.length > MAX_TEXT || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text)) throw new TypeError('invalid_intent_text');
  return text.normalize('NFKC').toLocaleLowerCase('en-US').replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/gu,' ').trim();
}

/** Shared by training and inference, so tokenization cannot drift. */
export function intentFeatures(text) {
  const normalized = normalizeIntentText(text), counts = new Map();
  const add = token => { if (counts.has(token) || counts.size < MAX_FEATURES) counts.set(token, Math.min(3,(counts.get(token)||0)+1)); };
  for (const word of normalized.split(' ').filter(Boolean)) {
    if (word.length <= 40) add('w:'+word);
    const characters = Array.from(word);
    for (const size of [2,3]) for (let at=0;at+size<=characters.length;at++) add('c:'+characters.slice(at,at+size).join(''));
  }
  return counts;
}

export function validateIntentRows(rows) {
  if (!Array.isArray(rows) || !rows.length || rows.length > 100000) throw new TypeError('invalid_intent_dataset');
  const seen = new Set();
  for (const row of rows) {
    if (!row || typeof row !== 'object' || !INTENT_LABELS.includes(row.label) || !['ko','en'].includes(row.language)) throw new TypeError('invalid_intent_row');
    const normalized = normalizeIntentText(row.text);
    if (!normalized || normalized.length < 4 || seen.has(normalized)) throw new TypeError('duplicate_or_empty_intent_example');
    // Heuristics reduce obvious mistakes, not a substitute for a rights and
    // privacy review of any future real dataset. Never echo rejected text.
    if (/(?:https?:\/\/|www\.|data\s*:|base64|input_image|image_url|-----BEGIN|\bsk-[a-z0-9_-]{16,}|[\w.+-]+@[\w.-]+\.[a-z]{2,}|\+?\d[\d ()-]{6,}\d)/iu.test(row.text)) throw new TypeError('sensitive_or_nontext_training_example');
    seen.add(normalized);
  }
  return seen;
}

/** Multinomial naive Bayes; actual class counts determine all learned weights. */
export function fitIntentModel(rows,{maxVocabulary=1000,minEvidence=3,minMargin=0.03,datasetOrigin='synthetic-development'}={}) {
  validateIntentRows(rows);
  if (!Number.isInteger(maxVocabulary)||maxVocabulary<50||maxVocabulary>1500||!Number.isInteger(minEvidence)||minEvidence<2||minEvidence>100
    ||typeof minMargin!=='number'||!Number.isFinite(minMargin)||minMargin<0||minMargin>1
    ||!['synthetic-development','operator-approved-data'].includes(datasetOrigin)) throw new TypeError('invalid_intent_training_options');
  const documents = INTENT_LABELS.map(()=>0), featureCounts=INTENT_LABELS.map(()=>new Map()), frequency=new Map();
  for (const row of rows) {
    const index=INTENT_LABELS.indexOf(row.label); documents[index]++;
    for (const [feature,count] of intentFeatures(row.text)) {
      featureCounts[index].set(feature,(featureCounts[index].get(feature)||0)+count);
      frequency.set(feature,(frequency.get(feature)||0)+count);
    }
  }
  if (documents.some(count=>count<2)) throw new TypeError('every_intent_requires_training_examples');
  const vocabulary=[...frequency].sort((a,b)=>b[1]-a[1]||(a[0]<b[0]?-1:a[0]>b[0]?1:0)).slice(0,maxVocabulary).map(([feature])=>feature);
  if (vocabulary.length<50) throw new TypeError('insufficient_intent_vocabulary');
  const rounded=value=>Number(value.toFixed(8));
  const logLikelihoods=featureCounts.map(counts=>{
    const total=vocabulary.reduce((sum,feature)=>sum+(counts.get(feature)||0),0)+vocabulary.length;
    return vocabulary.map(feature=>rounded(Math.log(((counts.get(feature)||0)+1)/total)));
  });
  return {modelVersion:'a1-intent-v1',algorithm:'multinomial-naive-bayes',datasetOrigin,
    labels:[...INTENT_LABELS],vocabulary,logPriors:documents.map(count=>rounded(Math.log((count+1)/(rows.length+INTENT_LABELS.length)))),
    logLikelihoods,thresholds:{minEvidence,minMargin},training:{examples:rows.length,classCounts:Object.fromEntries(INTENT_LABELS.map((label,index)=>[label,documents[index]]))}};
}

function snapshot(model) {
  if (!model || typeof model!=='object') throw new TypeError('invalid_intent_model');
  if (cache.has(model)) return cache.get(model);
  const {labels,vocabulary,logPriors,logLikelihoods,thresholds}=model;
  if (model.modelVersion!=='a1-intent-v1'||model.algorithm!=='multinomial-naive-bayes'
    ||!['synthetic-development','operator-approved-data'].includes(model.datasetOrigin)
    ||!Array.isArray(labels)||labels.length!==INTENT_LABELS.length||labels.some((label,index)=>label!==INTENT_LABELS[index])
    ||!Array.isArray(vocabulary)||vocabulary.length<50||vocabulary.length>1500||new Set(vocabulary).size!==vocabulary.length
    ||vocabulary.some(value=>typeof value!=='string'||value.length>50||!/[cw]:/u.test(value.slice(0,2)))
    ||!Array.isArray(logPriors)||logPriors.length!==labels.length||!Array.isArray(logLikelihoods)||logLikelihoods.length!==labels.length
    ||[...logPriors,...logLikelihoods.flat()].some(value=>!Number.isFinite(value)||value>0||value< -100)
    ||logLikelihoods.some(row=>!Array.isArray(row)||row.length!==vocabulary.length)
    ||!thresholds||!Number.isInteger(thresholds.minEvidence)||thresholds.minEvidence<2||thresholds.minEvidence>100
    ||!Number.isFinite(thresholds.minMargin)||thresholds.minMargin<0||thresholds.minMargin>1) throw new TypeError('invalid_intent_model');
  // A private copy avoids later caller mutation changing a cached classifier.
  const result={labels:[...labels],vocabulary:new Map(vocabulary.map((feature,index)=>[feature,index])),
    priors:[...logPriors],weights:logLikelihoods.map(row=>[...row]),thresholds:{...thresholds}};
  cache.set(model,result);return result;
}

/** margin is an internal routing score, never a calibrated probability or accuracy. */
export function predictIntent(model,text) {
  const compiled=snapshot(model);
  let features;try{features=intentFeatures(text);}catch{return ambiguous();}
  const known=[...features].filter(([feature])=>compiled.vocabulary.has(feature));
  if (known.length<compiled.thresholds.minEvidence) return {...ambiguous(),evidence:known.length};
  const total=known.reduce((sum,[,count])=>sum+count,0);
  const scores=compiled.labels.map((topic,index)=>({topic,score:(compiled.priors[index]+known.reduce((sum,[feature,count])=>sum+compiled.weights[index][compiled.vocabulary.get(feature)]*count,0))/total}));
  scores.sort((a,b)=>b.score-a.score||INTENT_LABELS.indexOf(a.topic)-INTENT_LABELS.indexOf(b.topic));
  const margin=Number(Math.max(0,scores[0].score-scores[1].score).toFixed(6));
  return {topic:margin>=compiled.thresholds.minMargin?scores[0].topic:null,
    method:margin>=compiled.thresholds.minMargin?'trained-seed':'ambiguous',evidence:known.length,margin};
}
