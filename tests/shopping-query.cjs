'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),Q=require('../assets/shopping-query.js');
test('Korean clothing intent parses budget and only canonical clothing words reach official URLs',()=>{
 const p=Q.parse('남성 검정 슬랙스 5만원 이하');assert.equal(p.budget,50000);assert.equal(p.gender,'men');assert.equal(p.type,'slacks');assert.equal(p.color,'black');
 for(const row of Q.links(p)){const u=new URL(row.searchUrl);assert.equal(u.protocol,'https:');assert.equal(row.searchTerm,'남성 검정 슬랙스');if(!row.manualSearch)assert.equal([...u.searchParams.values()][0],'남성 검정 슬랙스');assert.ok(!row.searchUrl.includes('50000'));}
 assert.equal(Q.parse('여성 네이비 니트 35,000원 이하 출근').budget,35000);assert.equal(Q.parse('men black slacks').gender,'men');assert.equal(Q.term(Q.parse('women white shirt'),'en'),'women white shirt');
});
test('raw private/free text and body ratios never become merchant search strings',()=>{
 for(const q of ['남성 secretword 검정 슬랙스 1.428571 cm 키170 몸무게60','남성 슬랙스 생일19900101 주문번호12345']){const links=Q.links(Q.parse(q));for(const r of links)assert.doesNotMatch(decodeURIComponent(r.searchUrl),/secretword|1\.428|170|60|19900101|12345|몸무게/);}
 for(const q of ['a@example.com 셔츠','https://evil.test 셔츠','010-1234-5678 슬랙스','<script>셔츠',''])assert.throws(()=>Q.parse(q));
 assert.throws(()=>Q.term({type:'https://evil.test',gender:'men',color:'black'}));assert.throws(()=>Q.parse('셔츠 999999만원 이하'));
});

test('fit intent adds bounded fit words to Korean retailer searches without leaking free text',()=>{
 const p=Q.parse('남성 검정 세미와이드 슬랙스 5만원 이하 출근용');
 assert.equal(p.fit,'semiwide');
 assert.equal(Q.term(p),'남성 검정 세미와이드 슬랙스 출근용');
 for(const row of Q.links(p)){assert.equal(row.searchTerm,'남성 검정 세미와이드 슬랙스 출근용');if(!row.manualSearch)assert.equal([...new URL(row.searchUrl).searchParams.values()][0],row.searchTerm);}
 assert.equal(Q.term(Q.parse('여성 화이트 슬림 셔츠')),'여성 흰색 슬림 셔츠');
 assert.throws(()=>Q.term({...p,fit:'https://example.com'}));
});
test('domestic search interprets purpose and T-shirts without passing unsupported enums into existing recommendations',()=>{
 const p=Q.parse('여성 네이비 슬림 원피스 하객용 3만5천원 이하');assert.equal(p.budget,35000);assert.equal(p.purpose,'event');assert.equal(p.occasion,'event');assert.equal(Q.describe(p).purpose,'하객용');
 const sport=Q.parse('운동용 흰 오버핏 티셔츠 30,000원 이하');assert.equal(sport.type,'tshirt');assert.equal(sport.color,'white');assert.equal(sport.fit,'oversized');assert.equal(sport.purpose,'sport');assert.equal(sport.occasion,'all');assert.match(Q.term(sport),/티셔츠 운동용/);
 const daily=Q.parse('공용 회색 루즈핏 니트 일상용');assert.equal(daily.gender,'all');assert.equal(daily.occasion,'casual');assert.equal(Q.describe(daily,'en').fit,'relaxed');
 for(const patch of [{fit:'SECRET 170cm'},{purpose:'https://evil.test'},{type:'photo'}])assert.throws(()=>Q.term({...p,...patch}));
});
test('KRW upper bounds preserve strict less-than, decimals and thousands and reject misleading lower/range/negative budgets',()=>{
 for(const [input,expected] of [['5만원 이하',50000],['5만원 미만',49999],['3.5만원까지',35000],['3만5천원 이하',35000],['5천원 이하',5000],['35,000원 이하',35000]])assert.equal(Q.parse('셔츠 '+input).budget,expected);
 for(const input of ['5만원 이상','5만원 초과','3~5만원','3만원부터 5만원','-5만원','3,5만원','5만원대','3만원 5만원'])assert.throws(()=>Q.parse('셔츠 '+input),/budget/);
 assert.throws(()=>Q.parse('검정 말고 흰 셔츠'),/unsupported_exclusion/);
});
test('official domestic URLs and the UNIQLO search window encode the same explicit outfit conditions once and retain safe official home alternatives',()=>{
 const p=Q.parse('남성 검정 와이드 슬랙스 출근용 5만원 이하 SECRET 키170 몸무게60 비율1.428571'),rows=Q.links(p);assert.deepEqual(rows.map(r=>r.name),['무신사','29CM','네이버쇼핑','쿠팡','유니클로']);
 for(const row of rows){const u=new URL(row.searchUrl);assert.equal(row.searchTerm,'남성 검정 와이드 슬랙스 출근용');if(!row.manualSearch)assert.equal([...u.searchParams.values()][0],row.searchTerm);assert.doesNotMatch(u.href,/%25(?:EC|EB|EA)/i);assert.doesNotMatch(decodeURIComponent(u.href),/SECRET|170|60|1\.428|50000/);assert.equal(new URL(row.homeUrl).protocol,'https:');}
 assert.equal(new URL(rows[1].searchUrl).pathname,'/store/search');
});
test('body-reference ideas require explicit consent, change clothing fits, preserve explicit choices and never claim measurements',()=>{
 const base=Q.parse('남성 검정 출근용 5만원 이하'),wide={shoulderHipRatio:1.5,legTorsoRatio:1.8},narrow={shoulderHipRatio:.8,legTorsoRatio:1.2};
 assert.deepEqual(Q.bodySuggestions(base,{metrics:wide}),[]);assert.throws(()=>Q.bodySuggestions(base,{metrics:{...wide,waist:80},consent:true}));
 const a=Q.bodySuggestions(base,{metrics:wide,consent:true}),b=Q.bodySuggestions(base,{metrics:narrow,consent:true});assert.equal(a.length,2);assert.notDeepEqual(a.map(v=>v.conditions.fit),b.map(v=>v.conditions.fit));
 for(const idea of [...a,...b]){assert.equal(idea.conditions.budget,50000);assert.equal(idea.conditions.gender,'men');assert.equal(idea.conditions.color,'black');for(const row of Q.links(idea.conditions))assert.doesNotMatch(row.searchUrl,/1\.5|\.8|1\.2|metrics|shoulder|hips|waist|size/);assert.equal(Object.hasOwn(idea.conditions,'metrics'),false);}
 const chosen=Q.parse('여성 네이비 슬림 원피스 하객용');assert.equal(Q.bodySuggestions(chosen,{metrics:wide,consent:true})[0].conditions.fit,'slim');assert.equal(Q.bodySuggestions(chosen,{metrics:wide,consent:true})[0].conditions.type,'dress');
 const manual=Q.links(base).at(-1);assert.equal(manual.manualSearch,true);assert.equal(new URL(manual.searchUrl).search,'');
});

test('cardigans and relaxed-fit aliases are normalized without losing the garment subtype', () => {
 const cardigan = Q.parse('여성 네이비 가디건');
 assert.equal(cardigan.type, 'cardigan');
 assert.equal(cardigan.category, 'tops');
 assert.equal(Q.term(cardigan), '여성 네이비 가디건');
 assert.equal(Q.term(cardigan, 'en'), 'women navy cardigan');
 assert.equal(Q.parse('women navy cardigans').type, 'cardigan');
 assert.equal(Q.parse('남성 검정 루즈 슬랙스').fit, 'relaxed');
 assert.equal(Q.parse('여성 넉넉한 긴팔 티셔츠').fit, 'relaxed');
 assert.equal(Q.parse('반팔 셔츠').type, 'shirt');
});

test('category-only searches preserve that category in official search and body-reference ideas', () => {
 const top = Q.parse('여성 네이비 상의');
 assert.equal(top.type, 'clothing');
 assert.equal(top.category, 'tops');
 assert.equal(Q.term(top), '여성 네이비 상의');
 assert.equal(Q.describe(top).kind, '상의');
 assert.equal(Q.parse('검정 하의').category, 'bottoms');
 assert.equal(Q.parse('여성 하의를 5만원 이하로 찾아줘').category, 'bottoms');
 assert.equal(Q.parse('5만원 이하의 옷').category, 'all');
 assert.equal(Q.parse('가벼운 아우터').category, 'outerwear');
 const metrics = { shoulderHipRatio: 1.5, legTorsoRatio: 1.8 };
 for (const idea of Q.bodySuggestions(top, { metrics, consent: true })) assert.equal(idea.conditions.category, 'tops');
 assert.throws(() => Q.term({ ...top, category: 'secret-17-1234' }));
});

const Chat = require('../assets/shopping-conversation.js');

test('local style chat follows explicit changes while retaining earlier filters', () => {
 const first = { ...Chat.refine('여성 출근용 셔츠 8만원 이하'), size: 'M' };
 const second = Chat.refine('흰색으로', first);
 assert.deepEqual(second, { ...first, color: 'white' });
 assert.deepEqual(Chat.refine('검정 말고 네이비', second), { ...second, color: 'navy' });
 assert.deepEqual(Chat.refine('white instead of black', second), second);
 assert.equal(Chat.refine('일자핏으로', second).fit, 'straight');
 assert.equal(Chat.refine('하의로', second).type, 'clothing');
 assert.deepEqual(Chat.refine('제 체형에 맞는 옷 추천해주세요', second), second);
 assert.deepEqual(Chat.refine('추천 이유 알려줘', second), second);
 assert.equal(Chat.refine('office shirts up to ₩80,000').budget, 80000);
 assert.equal(Chat.refine('office shirts under ₩80,000').budget, 79999);
 assert.equal(Chat.refine('예산 제한 없어요', second).budget, null);
 assert.deepEqual(Chat.refine('처음부터', second), { ...Q.parse('의류'), size: '' });
});

test('local style chat asks for supported explicit conditions before recommending', () => {
 for (const [message, error] of [
  ['부동산 추천해주세요', /unknown_clothing_request/],
  ['핑크 셔츠', /unsupported_color/],
  ['셔츠 3만원부터 5만원', /unsupported_budget/],
  ['shirts over ₩80,000', /unsupported_budget/],
  ['shirts under $60', /unsupported_budget/],
  ['흰색 말고', /unsupported_exclusion/],
  ['검정 말고 흰색 mail@example.test', /private_query/],
  ['셔츠 a1://PRIVATE<script>', /private_query/]
 ]) assert.throws(() => Chat.refine(message), error);
 const fulfilled = Chat.refine('검정 슬랙스 PRIVATE_09 키170');
 assert.equal(Q.term(fulfilled), '검정 슬랙스');
 assert.doesNotMatch(JSON.stringify(fulfilled), /PRIVATE|170/);
});

test('a chat follow-up narrows real snapshot results and preserves retailer evidence', () => {
 const Discovery = require('../assets/product-discovery.js');
 const Profile = require('../assets/proportion-profile.js');
 const data = require('../assets/observed-products.json');
 const profile = Profile.build({shoulderHipRatio:1.4,legTorsoRatio:1.35});
 const options = { now: data.observedAt + 1000, profile };
 const first = Chat.refine('검정 슬랙스');
 const candidates = Discovery.search(data, first, options).candidates;
 assert.ok(candidates.length > 1);
 assert.ok(candidates.some(row => row.proportionReasons?.some(reason => reason.feature === 'wide_fit')));
 const wide = Chat.refine('와이드핏으로', first);
 const refined = Discovery.search(data, wide, options).candidates;
 assert.ok(refined.length > 0 && refined.length < candidates.length);
 assert.ok(refined.every(row => row.product.fit === 'wide'));
 assert.deepEqual(Discovery.search(data, Chat.refine('네이비로', wide), options).candidates, []);
});
