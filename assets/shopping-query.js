/* Bounded clothing vocabulary only. Raw text and body data never enter a URL. */
'use strict';
((root,factory)=>{const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.A1ShoppingQuery=api;})(globalThis,()=>{
 const types=[['tshirt',/티셔츠|반팔(?:티)?|\bt[- ]?shirt\b/i,'티셔츠','T-shirt','tops'],['slacks',/슬랙스|\bslacks\b/i,'슬랙스','slacks','bottoms'],['jeans',/청바지|데님|\bjeans\b|\bdenim\b/i,'청바지','jeans','bottoms'],['trousers',/바지|팬츠|\btrousers\b|\bpants\b/i,'바지','trousers','bottoms'],['shirt',/셔츠|\bshirt\b/i,'셔츠','shirt','tops'],['knit',/니트|스웨터|\bknit\b|\bsweater\b/i,'니트','knitwear','tops'],['jacket',/자켓|재킷|\bjacket\b|\bblazer\b/i,'재킷','jacket','outerwear'],['coat',/코트|\bcoat\b/i,'코트','coat','outerwear'],['dress',/원피스|\bdress\b/i,'원피스','dress','dresses']];
 const fits=[['semiwide',/세미\s*와이드|\bsemi[- ]?wide\b/i,'세미와이드','semi-wide'],['oversized',/오버\s*핏|오버사이즈|\boversized?\b/i,'오버핏','oversized'],['relaxed',/루즈\s*핏|릴랙스|여유\s*있는|\brelaxed\b|\bloose\b/i,'루즈핏','relaxed'],['wide',/와이드|\bwide\b/i,'와이드','wide'],['straight',/스트레이트|일자핏|\bstraight\b/i,'스트레이트','straight'],['slim',/슬림|\bslim\b/i,'슬림','slim'],['regular',/레귤러|\bregular\b/i,'레귤러','regular']];
 const purposes=[['work',/출근|회사|오피스|\boffice\b|\bwork\b/i,'출근용','office','work'],['event',/하객|결혼식|격식|행사|\bwedding\b|\bevent\b/i,'하객용','occasion','event'],['sport',/운동|러닝|헬스|\bsport\b|\bworkout\b|\brunning\b/i,'운동용','workout','all'],['daily',/일상|데일리|평상복|\beveryday\b|\bdaily\b/i,'일상용','everyday','casual']];
 const colors=[['black',/검정|검은|블랙|\bblack\b/i,'검정','black'],['navy',/네이비|남색|\bnavy\b/i,'네이비','navy'],['white',/흰색|화이트|\bwhite\b/i,'흰색','white'],['beige',/베이지|\bbeige\b/i,'베이지','beige'],['grey',/회색|그레이|차콜|\bgr[ae]y\b|charcoal/i,'회색','grey']];
 function parse(text){if(typeof text!=='string'||!text.trim()||text.length>300)throw TypeError('invalid_query');
  const normalized=text.normalize('NFKC');if(/https?:|data:|blob:|@|<|base64|\bsk-[\w-]{12,}|\d{2,3}[- ]\d{3,4}[- ]\d{4}/i.test(normalized))throw TypeError('private_query');
  if(/말고|아닌|제외|빼고|\bwithout\b|\bexcept\b|\bnot\b/i.test(normalized))throw TypeError('unsupported_exclusion');
  const type=types.find(x=>x[1].test(normalized)),color=colors.find(x=>x[1].test(normalized));
  const gender=/공용|유니섹스|\bunisex\b/i.test(normalized)?'all':/여성|여자|\bwomen\b|\bfemale\b/i.test(normalized)?'women':/남성|남자|\bmen\b|\bmale\b/i.test(normalized)?'men':'all';
  if(/원\s*(?:이상|초과|부터|대|정도|내외|안팎)|\d[\d,.]*\s*(?:만|천)?\s*원?\s*(?:~|〜|～|–|-|부터)\s*\d|(?:^|\s)-\s*\d[\d,.]*\s*(?:만|천)?\s*원/.test(normalized))throw TypeError('unsupported_budget');
  const amounts=[...normalized.matchAll(/\d[\d,]*(?:\.\d+)?\s*만\s*(?:\d+\s*천\s*)?원|\d[\d,]*\s*천\s*원|\d[\d,]*\s*원/g)];if(amounts.length>1)throw TypeError('unsupported_budget');
  if(amounts[0]?.[0].includes(',')&&!/^\d{1,3}(?:,\d{3})+\s*원$/.test(amounts[0][0]))throw TypeError('unsupported_budget');
  const amount=amounts[0]?.[0].replace(/[\s,]/g,''),ten=amount?.match(/^(\d+(?:\.\d+)?)만(?:(\d+)천)?원$/),thousand=amount?.match(/^(\d+)천원$/);
  let budget=amount?ten?Number(ten[1])*10000+Number(ten[2]||0)*1000:thousand?Number(thousand[1])*1000:Number(amount.slice(0,-1)):null;
  if(budget!==null&&/^\s*미만/.test(normalized.slice(amounts[0].index+amounts[0][0].length)))budget-=1;
  if(budget!==null&&(!Number.isSafeInteger(budget)||budget<=0||budget>100000000))throw TypeError('invalid_budget');
  const fit=fits.find(x=>x[1].test(normalized)),purpose=purposes.find(x=>x[1].test(normalized));
  return {fit:fit?.[0]||'any',purpose:purpose?.[0]||'any',type:type?.[0]||'clothing',category:type?.[4]||'all',color:color?.[0]||'any',gender,budget,currency:'KRW',style:/미니멀|minimal/i.test(normalized)?'minimal':/클래식|classic/i.test(normalized)?'classic':/캐주얼|casual/i.test(normalized)?'casual':'all',occasion:purpose?.[4]||'all'};
 }
 function term(p,language='ko'){const type=types.find(x=>x[0]===p.type),color=colors.find(x=>x[0]===p.color);if(!['ko','en'].includes(language)||!['all','men','women'].includes(p.gender)||!['any',...colors.map(c=>c[0])].includes(p.color)||p.type!=='clothing'&&!type)throw TypeError('invalid_conditions');
  const fit=fits.find(x=>x[0]===(p.fit||'any'));if(p.fit&&p.fit!=='any'&&!fit)throw TypeError('invalid_conditions');
  const purpose=purposes.find(x=>x[0]===(p.purpose||'any'));if(p.purpose&&p.purpose!=='any'&&!purpose)throw TypeError('invalid_conditions');
  const at=language==='ko'?2:3;return [(language==='ko'?{men:'남성',women:'여성'}:{men:'men',women:'women'})[p.gender],color?.[at],fit?.[at],type?.[at]||(language==='ko'?'의류':'clothing'),purpose?.[at]].filter(Boolean).join(' ');
 }
 function describe(p,language='ko'){term(p,language);const at=language==='ko'?2:3,unspecified=language==='ko'?'미지정':'Not specified';return {kind:types.find(x=>x[0]===p.type)?.[at]||(language==='ko'?'의류':'Clothing'),color:colors.find(x=>x[0]===p.color)?.[at]||unspecified,fit:fits.find(x=>x[0]===p.fit)?.[at]||unspecified,purpose:purposes.find(x=>x[0]===p.purpose)?.[at]||unspecified,collection:(language==='ko'?{men:'남성',women:'여성',all:'전체'}:{men:'Men',women:'Women',all:'All'})[p.gender]};}
 function links(p){const query=term(p,'ko');return [
  {name:'무신사',searchTerm:query,searchUrl:'https://www.musinsa.com/search/goods?'+new URLSearchParams({keyword:query}),homeUrl:'https://www.musinsa.com/'},
  {name:'29CM',searchTerm:query,searchUrl:'https://www.29cm.co.kr/store/search?'+new URLSearchParams({keyword:query}),homeUrl:'https://www.29cm.co.kr/'},
  {name:'네이버쇼핑',searchTerm:query,searchUrl:'https://search.shopping.naver.com/search/all?'+new URLSearchParams({query}),homeUrl:'https://shopping.naver.com/'},
  {name:'쿠팡',searchTerm:query,searchUrl:'https://www.coupang.com/np/search?'+new URLSearchParams({q:query}),homeUrl:'https://www.coupang.com/'}
 ];}
 return Object.freeze({parse,term,links,describe});
});
