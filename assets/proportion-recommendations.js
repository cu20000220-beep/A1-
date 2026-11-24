/* Local styling comparisons based on bounded proportions and observed garment features. */
'use strict';
((root,factory)=>{
 const common=typeof module==='object'&&module.exports;
 const api=factory(()=>common?require('./proportion-profile.js'):root.A1ProportionProfile);
 if(common)module.exports=api;else root.A1ProportionRecommendations=api;
})(globalThis,getProfile=>{
 const garmentFeatures=Object.freeze({
  cropped_top:{categories:['tops','outerwear'],labels:['크롭','크롭탑','크롭 상의','크롭 기장','크롭기장','cropped','cropped top']},
  longline_top:{categories:['tops','outerwear'],labels:['롱라인','롱기장','롱 기장','힙을 덮는 기장','longline','longline top']},
  ankle_length:{categories:['bottoms'],labels:['발목 기장','발목 길이','앵클 기장','앵클 길이','앵클팬츠','앵클 팬츠','ankle length']},
  full_length:{categories:['bottoms'],labels:['풀 렝스','풀렝스','풀 길이','풀 기장','full length']},
  wide_fit:{categories:['bottoms'],fit:'wide',labels:['와이드','와이드 핏','와이드핏','wide','wide leg']},
  relaxed_fit:{categories:['bottoms'],fit:'relaxed',labels:['릴랙스','릴랙스 핏','루즈핏','루즈 핏','루즈 테이퍼드','relaxed','relaxed fit']},
  elastic_waist:{categories:['bottoms'],labels:['히든 밴딩','허리 밴딩','허리밴딩','밴딩 허리','elastic waist','elastic waistband']},
  high_rise:{categories:['bottoms'],labels:['하이웨이스트','하이 웨이스트','하이 라이즈','하이라이즈','high rise','high waist','high waisted']},
  short_sleeves:{categories:['tops','outerwear','dresses'],labels:['반팔','반소매','짧은 소매','short sleeve','short sleeves']},
  long_sleeves:{categories:['tops','outerwear','dresses'],labels:['긴팔','긴소매','긴 소매','long sleeve','long sleeves']},
  set_in_shoulder:{categories:['tops','outerwear','dresses'],labels:['셋인 숄더','셋인숄더','셋 인 숄더','set in shoulder','set in sleeve']},
  drop_shoulder:{categories:['tops','outerwear','dresses'],labels:['드롭 숄더','드롭숄더','drop shoulder','dropped shoulder']},
  cardigan_layer:{categories:['tops'],type:'cardigan',labels:['카디건','가디건','여성 카디건','여성 가디건','cardigan']},
  straight_line:{categories:['bottoms'],fit:'straight',labels:['스트레이트','일자핏','일자 핏','straight','straight leg']}
 });
 const empty=Object.freeze([]);
 const fold=value=>typeof value==='string'?value.normalize('NFKC').trim().toLowerCase().replace(/[\s_\-]+/gu,' '):'';
 function guidance(profile){
  let ratios;
  try{ratios=getProfile()?.validate(profile);}catch{return empty;}
  if(!ratios)return empty;
  const byFeature=new Map();
  function suggest(ratio,attribute,feature){
   const basis=ratios[ratio].basis;
   if(!byFeature.has(feature)||basis==='manual'&&byFeature.get(feature).basis!=='manual')byFeature.set(feature,Object.freeze({ratio,basis,attribute,feature}));
  }
  const shoulder=ratios.shoulderHip?.value,legs=ratios.legTorso?.value;
  const torsoHeight=ratios.torsoHeight?.value,legHeight=ratios.legHeight?.value;
  const armHeight=ratios.armHeight?.value,armLeg=ratios.armLeg?.value;
  if(shoulder>=1.25){
   suggest('shoulderHip','fit','wide_fit');
   suggest('shoulderHip','fit','relaxed_fit');
   suggest('shoulderHip','shoulderLine','set_in_shoulder');
  }else if(shoulder<=.90){
   suggest('shoulderHip','shoulderLine','drop_shoulder');
   suggest('shoulderHip','silhouette','cardigan_layer');
  }
  if(legs<1.50){
   suggest('legTorso','length','cropped_top');
   suggest('legTorso','waistline','high_rise');
  }else if(legs>=1.90){
   suggest('legTorso','length','longline_top');
   suggest('legTorso','silhouette','straight_line');
  }else if(Number.isFinite(legs)){
   suggest('legTorso','silhouette','straight_line');
  }
  // A recorded waist/hip ratio is a cue to compare different waistband
  // constructions, irrespective of size. It is not evidence of garment rise.
  if(ratios.waistHip)suggest('waistHip','waistline','elastic_waist');
  if(torsoHeight>=.32)suggest('torsoHeight','length','cropped_top');
  else if(torsoHeight<=.26)suggest('torsoHeight','length','longline_top');
  if(legHeight<=.43){
   suggest('legHeight','length','ankle_length');
   suggest('legHeight','waistline','high_rise');
  }else if(legHeight>=.50){
   suggest('legHeight','length','full_length');
   suggest('legHeight','silhouette','straight_line');
  }
  // Use a measured arm-height reference when it suggests a sleeve comparison.
  if(armHeight<=.34)suggest('armHeight','sleeves','short_sleeves');
  else if(armHeight>=.39)suggest('armHeight','sleeves','long_sleeves');
  else if(armLeg<=.64)suggest('armLeg','sleeves','short_sleeves');
  else if(armLeg>=.76)suggest('armLeg','sleeves','long_sleeves');
  return Object.freeze([...byFeature.values()]);
 }
 function evidence(product,profile){
  if(!product||typeof product!=='object')return empty;
  const hints=guidance(profile);
  if(!hints.length)return empty;
  const approvedTags=product.sourceVerified===true&&product.fixture!==true&&product.demo!==true&&Array.isArray(product.tags)?product.tags:[];
  const observed=Array.isArray(product.observedFeatures)?product.observedFeatures:[];
  const labels=new Set([...observed,...approvedTags].map(fold));
  return Object.freeze(hints.filter(({feature})=>{
   const rule=garmentFeatures[feature];
   if(!rule.categories.includes(product.category))return false;
   return Boolean(rule.fit&&rule.fit===product.fit||rule.type&&rule.type===product.type||rule.labels.some(label=>labels.has(label)));
  }));
 }
 return Object.freeze({guidance,evidence});
});
