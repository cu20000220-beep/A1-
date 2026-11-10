/* Bounded clothing vocabulary only. Raw text and body data never enter a URL. */
'use strict';
((root,factory)=>{const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.A1ShoppingQuery=api;})(globalThis,()=>{
 const types=[['slacks',/슬랙스|slacks/i,'슬랙스','slacks','bottoms'],['jeans',/청바지|데님|jeans|denim/i,'청바지','jeans','bottoms'],['trousers',/바지|팬츠|trousers|pants/i,'바지','trousers','bottoms'],['shirt',/셔츠|shirt/i,'셔츠','shirt','tops'],['knit',/니트|스웨터|knit|sweater/i,'니트','knitwear','tops'],['jacket',/자켓|재킷|jacket|blazer/i,'재킷','jacket','outerwear'],['coat',/코트|\bcoat\b/i,'코트','coat','outerwear'],['dress',/원피스|\bdress\b/i,'원피스','dress','dresses']];
 const colors=[['black',/검정|검은|블랙|\bblack\b/i,'검정','black'],['navy',/네이비|남색|\bnavy\b/i,'네이비','navy'],['white',/흰색|화이트|\bwhite\b/i,'흰색','white'],['beige',/베이지|\bbeige\b/i,'베이지','beige'],['grey',/회색|그레이|차콜|\bgr[ae]y\b|charcoal/i,'회색','grey']];
 function parse(text){if(typeof text!=='string'||!text.trim()||text.length>300)throw TypeError('invalid_query');
  const normalized=text.normalize('NFKC');if(/https?:|data:|blob:|@|<|base64|\bsk-[\w-]{12,}|\d{2,3}[- ]\d{3,4}[- ]\d{4}/i.test(normalized))throw TypeError('private_query');
  const type=types.find(x=>x[1].test(normalized)),color=colors.find(x=>x[1].test(normalized));
  const gender=/여성|여자|women|female/i.test(normalized)?'women':/남성|남자|\bmen\b|male/i.test(normalized)?'men':'all';
  const budgetMatch=normalized.match(/(\d+(?:\.\d+)?)\s*만\s*원(?:\s*(?:이하|미만|까지))?/)||normalized.match(/(\d[\d,]*)\s*원\s*(?:이하|미만|까지)/);
  const budget=budgetMatch?Math.round(Number(budgetMatch[1].replaceAll(',',''))*(budgetMatch[0].includes('만')?10000:1)):null;
  if(budget!==null&&(!Number.isSafeInteger(budget)||budget<=0||budget>100000000))throw TypeError('invalid_budget');
  return {type:type?.[0]||'clothing',category:type?.[4]||'all',color:color?.[0]||'any',gender,budget,currency:'KRW',style:/미니멀|minimal/i.test(normalized)?'minimal':/클래식|classic/i.test(normalized)?'classic':/캐주얼|casual/i.test(normalized)?'casual':'all',occasion:/출근|회사|office|work/i.test(normalized)?'work':'all'};
 }
 function term(p,language='ko'){const type=types.find(x=>x[0]===p.type),color=colors.find(x=>x[0]===p.color);if(!['ko','en'].includes(language)||!['all','men','women'].includes(p.gender)||!['any',...colors.map(c=>c[0])].includes(p.color)||p.type!=='clothing'&&!type)throw TypeError('invalid_conditions');
  const at=language==='ko'?2:3;return [(language==='ko'?{men:'남성',women:'여성'}:{men:'men',women:'women'})[p.gender],color?.[at],type?.[at]||(language==='ko'?'의류':'clothing')].filter(Boolean).join(' ');
 }
 function links(p){const query=term(p,'ko');return [
  {name:'무신사',searchTerm:query,searchUrl:'https://www.musinsa.com/search/goods?'+new URLSearchParams({keyword:query}),homeUrl:'https://www.musinsa.com/'},
  {name:'29CM',searchTerm:query,searchUrl:'https://shop.29cm.co.kr/search?'+new URLSearchParams({keyword:query}),homeUrl:'https://shop.29cm.co.kr/'},
  {name:'네이버쇼핑',searchTerm:query,searchUrl:'https://search.shopping.naver.com/search/all?'+new URLSearchParams({query}),homeUrl:'https://shopping.naver.com/'},
  {name:'쿠팡',searchTerm:query,searchUrl:'https://www.coupang.com/np/search?'+new URLSearchParams({q:query}),homeUrl:'https://www.coupang.com/'}
 ];}
 return Object.freeze({parse,term,links});
});
