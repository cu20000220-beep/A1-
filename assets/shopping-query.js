/* Bounded clothing vocabulary only. Raw text and body data never enter a URL. */
'use strict';
((root,factory)=>{const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.A1ShoppingQuery=api;})(globalThis,()=>{
 const types=[
  ['tshirt',/티\s*셔츠|(?:반팔|긴팔)\s*티|\bt[- ]?shirts?\b|\btees?\b/i,'티셔츠','T-shirt','tops'],
  ['slacks',/슬랙스|\bslacks\b/i,'슬랙스','slacks','bottoms'],
  ['jeans',/청바지|데님|\bjeans\b|\bdenim\b/i,'청바지','jeans','bottoms'],
  ['trousers',/바지|팬츠|\btrousers\b|\bpants\b/i,'바지','trousers','bottoms'],
  ['shirt',/셔츠|\bshirts?\b/i,'셔츠','shirt','tops'],
  ['cardigan',/가디건|카디건|\bcardigans?\b/i,'가디건','cardigan','tops'],
  ['knit',/니트|스웨터|\bknit(?:wear)?\b|\bsweaters?\b/i,'니트','knitwear','tops'],
  ['jacket',/자켓|재킷|블레이저|\bjackets?\b|\bblazers?\b/i,'재킷','jacket','outerwear'],
  ['coat',/코트|\b(?:over)?coats?\b/i,'코트','coat','outerwear'],
  ['dress',/원피스|드레스|\bdress(?:es)?\b/i,'원피스','dress','dresses']
 ];
 const categories=[
  ['tops',/(?:^|[^가-힣])상의|\btops\b/i,'상의','tops'],
  ['bottoms',/(?:^|[^가-힣])하의|\bbottoms\b/i,'하의','bottoms'],
  ['outerwear',/아우터|겉옷|\bouterwear\b/i,'아우터','outerwear'],
  ['dresses',/원피스|드레스|\bdresses\b/i,'원피스','dresses'],
  ['accessories',/액세서리|악세서리|잡화|\baccessor(?:y|ies)\b/i,'액세서리','accessories']
 ];
 const fits=[['semiwide',/세미\s*와이드|\bsemi[- ]?wide\b/i,'세미와이드','semi-wide'],['oversized',/오버\s*핏|오버사이즈|\boversized?\b/i,'오버핏','oversized'],['relaxed',/루즈|루스\s*핏|릴랙스|여유\s*(?:있는|로운|핏)|넉넉한|\brelaxed\b|\bloose\b|\broomy\b/i,'루즈핏','relaxed'],['wide',/와이드|\bwide\b/i,'와이드','wide'],['straight',/스트레이트|일자(?:핏)?|\bstraight\b/i,'스트레이트','straight'],['slim',/슬림|\bslim\b/i,'슬림','slim'],['regular',/레귤러|기본\s*핏|\bregular\b/i,'레귤러','regular']];
 const purposes=[['work',/출근|회사|오피스|\boffice\b|\bwork\b/i,'출근용','office','work'],['event',/하객|결혼식|격식|행사|\bwedding\b|\bevent\b/i,'하객용','occasion','event'],['sport',/운동|러닝|헬스|\bsport\b|\bworkout\b|\brunning\b/i,'운동용','workout','all'],['daily',/일상|데일리|평상복|\beveryday\b|\bdaily\b/i,'일상용','everyday','casual']];
 const colors=[['black',/검정|검은|블랙|\bblack\b/i,'검정','black'],['navy',/네이비|남색|\bnavy\b/i,'네이비','navy'],['white',/흰(?:색)?|하얀|화이트|\bwhite\b/i,'흰색','white'],['beige',/베이지|\bbeige\b/i,'베이지','beige'],['grey',/회색|그레이|차콜|\bgr[ae]y\b|charcoal/i,'회색','grey']];
 function parse(text){if(typeof text!=='string'||!text.trim()||text.length>300)throw TypeError('invalid_query');
  const normalized=text.normalize('NFKC');if(/https?:|data:|blob:|@|<|base64|\bsk-[\w-]{12,}|\d{2,3}[- ]\d{3,4}[- ]\d{4}/i.test(normalized))throw TypeError('private_query');
  if(/말고|아닌|제외|빼고|\bwithout\b|\bexcept\b|\bnot\b/i.test(normalized))throw TypeError('unsupported_exclusion');
  const type=types.find(x=>x[1].test(normalized)) || (/반팔/.test(normalized) ? types[0] : null);
  const category=type?.[4] || categories.find(x=>x[1].test(normalized))?.[0] || 'all';
  const color=colors.find(x=>x[1].test(normalized));
  const gender=/공용|유니섹스|\bunisex\b/i.test(normalized)?'all':/여성|여자|\bwomen\b|\bfemale\b/i.test(normalized)?'women':/남성|남자|\bmen\b|\bmale\b/i.test(normalized)?'men':'all';
  if(/원\s*(?:이상|초과|부터|대|정도|내외|안팎)|\d[\d,.]*\s*(?:만|천)?\s*원?\s*(?:~|〜|～|–|-|부터)\s*\d|(?:^|\s)-\s*\d[\d,.]*\s*(?:만|천)?\s*원/.test(normalized))throw TypeError('unsupported_budget');
  const amounts=[...normalized.matchAll(/\d[\d,]*(?:\.\d+)?\s*만\s*(?:\d+\s*천\s*)?원|\d[\d,]*\s*천\s*원|\d[\d,]*\s*원/g)];if(amounts.length>1)throw TypeError('unsupported_budget');
  if(amounts[0]?.[0].includes(',')&&!/^\d{1,3}(?:,\d{3})+\s*원$/.test(amounts[0][0]))throw TypeError('unsupported_budget');
  const amount=amounts[0]?.[0].replace(/[\s,]/g,''),ten=amount?.match(/^(\d+(?:\.\d+)?)만(?:(\d+)천)?원$/),thousand=amount?.match(/^(\d+)천원$/);
  let budget=amount?ten?Number(ten[1])*10000+Number(ten[2]||0)*1000:thousand?Number(thousand[1])*1000:Number(amount.slice(0,-1)):null;
  if(budget!==null&&/^\s*미만/.test(normalized.slice(amounts[0].index+amounts[0][0].length)))budget-=1;
  if(budget!==null&&(!Number.isSafeInteger(budget)||budget<=0||budget>100000000))throw TypeError('invalid_budget');
  const fit=fits.find(x=>x[1].test(normalized)),purpose=purposes.find(x=>x[1].test(normalized));
  return {fit:fit?.[0]||'any',purpose:purpose?.[0]||'any',type:type?.[0]||'clothing',category,color:color?.[0]||'any',gender,budget,currency:'KRW',style:/미니멀|minimal/i.test(normalized)?'minimal':/클래식|classic/i.test(normalized)?'classic':/캐주얼|casual/i.test(normalized)?'casual':'all',occasion:purpose?.[4]||'all'};
 }
 function garmentLabel(p,at){return (types.find(x=>x[0]===p.type)||categories.find(x=>x[0]===p.category))?.[at]||(at===2?'의류':'clothing');}
 function term(p,language='ko'){const type=types.find(x=>x[0]===p.type),color=colors.find(x=>x[0]===p.color);if(!['ko','en'].includes(language)||!['all','men','women'].includes(p.gender)||!['any',...colors.map(c=>c[0])].includes(p.color)||p.type!=='clothing'&&!type)throw TypeError('invalid_conditions');
  if(p.category!=null&&p.category!=='all'&&!categories.some(x=>x[0]===p.category))throw TypeError('invalid_conditions');
  const fit=fits.find(x=>x[0]===(p.fit||'any'));if(p.fit&&p.fit!=='any'&&!fit)throw TypeError('invalid_conditions');
  const purpose=purposes.find(x=>x[0]===(p.purpose||'any'));if(p.purpose&&p.purpose!=='any'&&!purpose)throw TypeError('invalid_conditions');
  const at=language==='ko'?2:3;return [(language==='ko'?{men:'남성',women:'여성'}:{men:'men',women:'women'})[p.gender],color?.[at],fit?.[at],garmentLabel(p,at),purpose?.[at]].filter(Boolean).join(' ');
 }
 function describe(p,language='ko'){
  term(p,language);
  const at=language==='ko'?2:3,unspecified=language==='ko'?'미지정':'Not specified',kind=garmentLabel(p,at);
  return {kind:kind==='clothing'?'Clothing':kind,color:colors.find(x=>x[0]===p.color)?.[at]||unspecified,fit:fits.find(x=>x[0]===p.fit)?.[at]||unspecified,purpose:purposes.find(x=>x[0]===p.purpose)?.[at]||unspecified,collection:(language==='ko'?{men:'남성',women:'여성',all:'전체'}:{men:'Men',women:'Women',all:'All'})[p.gender]};
 }
 function bodySuggestions(p,{metrics,consent=false}={}){
  if(consent!==true)return [];term(p);
  if(!metrics||Object.keys(metrics).sort().join(',')!=='legTorsoRatio,shoulderHipRatio'||!Number.isFinite(metrics.shoulderHipRatio)||metrics.shoulderHipRatio<.45||metrics.shoulderHipRatio>2.5||!Number.isFinite(metrics.legTorsoRatio)||metrics.legTorsoRatio<.6||metrics.legTorsoRatio>3.5)throw TypeError('invalid_body_reference');
  const reference=metrics.shoulderHipRatio>1.15?'shoulder_balance':metrics.shoulderHipRatio<.9?'light_layers':'balanced_lengths';
  const category=p.category||'all',specified=types.find(x=>x[0]===p.type);
  const defaults={all:['shirt','trousers'],tops:['shirt'],bottoms:['trousers']};
  const kinds=specified&&(category==='all'||specified[4]===category)?[p.type]:(defaults[category]||['clothing']);
  return kinds.map(type=>{
   const suggestedCategory=types.find(x=>x[0]===type)?.[4]||category;
   let fit=p.fit||'any';
   if(fit==='any'&&suggestedCategory!=='accessories'){
    fit=suggestedCategory==='bottoms'?(reference==='shoulder_balance'?'relaxed':'straight'):(reference==='light_layers'?'relaxed':'regular');
   }
   return {conditions:{...p,type,category:suggestedCategory,fit},reason:reference,lengthReference:metrics.legTorsoRatio<1.5};
  });
 }
 function links(p){const query=term(p,'ko');return [
  {name:'무신사',searchTerm:query,searchUrl:'https://www.musinsa.com/search/goods?'+new URLSearchParams({keyword:query}),homeUrl:'https://www.musinsa.com/'},
  {name:'29CM',searchTerm:query,searchUrl:'https://www.29cm.co.kr/store/search?'+new URLSearchParams({keyword:query}),homeUrl:'https://www.29cm.co.kr/'},
  {name:'네이버쇼핑',searchTerm:query,searchUrl:'https://search.shopping.naver.com/search/all?'+new URLSearchParams({query}),homeUrl:'https://shopping.naver.com/'},
  {name:'쿠팡',searchTerm:query,searchUrl:'https://www.coupang.com/np/search?'+new URLSearchParams({q:query}),homeUrl:'https://www.coupang.com/'},
  {name:'유니클로',searchTerm:query,searchUrl:'https://www.uniqlo.com/kr/ko/search',homeUrl:'https://www.uniqlo.com/kr/ko/',manualSearch:true}
 ];}
 return Object.freeze({parse,term,links,describe,bodySuggestions});
});
