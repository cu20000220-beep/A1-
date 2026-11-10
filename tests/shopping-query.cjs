'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),Q=require('../assets/shopping-query.js');
test('Korean clothing intent parses budget and only canonical clothing words reach official URLs',()=>{
 const p=Q.parse('남성 검정 슬랙스 5만원 이하');assert.equal(p.budget,50000);assert.equal(p.gender,'men');assert.equal(p.type,'slacks');assert.equal(p.color,'black');
 for(const row of Q.links(p)){const u=new URL(row.searchUrl);assert.equal(u.protocol,'https:');assert.equal([...u.searchParams.values()][0],'남성 검정 슬랙스');assert.ok(!row.searchUrl.includes('50000'));}
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
 for(const row of Q.links(p))assert.equal([...new URL(row.searchUrl).searchParams.values()][0],'남성 검정 세미와이드 슬랙스 출근용');
 assert.equal(Q.term(Q.parse('여성 화이트 슬림 셔츠')),'여성 흰색 슬림 셔츠');
 assert.throws(()=>Q.term({...p,fit:'https://example.com'}));
});
test('domestic search interprets purpose and T-shirts without passing unsupported enums into existing recommendations',()=>{
 const p=Q.parse('여성 네이비 슬림 원피스 하객용 3만5천원 이하');assert.equal(p.budget,35000);assert.equal(p.purpose,'event');assert.equal(p.occasion,'event');assert.equal(Q.describe(p).purpose,'하객용');
 const sport=Q.parse('운동용 흰색 오버핏 티셔츠 30,000원 이하');assert.equal(sport.type,'tshirt');assert.equal(sport.fit,'oversized');assert.equal(sport.purpose,'sport');assert.equal(sport.occasion,'all');assert.match(Q.term(sport),/티셔츠 운동용/);
 const daily=Q.parse('공용 회색 루즈핏 니트 일상용');assert.equal(daily.gender,'all');assert.equal(daily.occasion,'casual');assert.equal(Q.describe(daily,'en').fit,'relaxed');
 for(const patch of [{fit:'SECRET 170cm'},{purpose:'https://evil.test'},{type:'photo'}])assert.throws(()=>Q.term({...p,...patch}));
});
test('KRW upper bounds preserve strict less-than, decimals and thousands and reject misleading lower/range/negative budgets',()=>{
 for(const [input,expected] of [['5만원 이하',50000],['5만원 미만',49999],['3.5만원까지',35000],['3만5천원 이하',35000],['5천원 이하',5000],['35,000원 이하',35000]])assert.equal(Q.parse('셔츠 '+input).budget,expected);
 for(const input of ['5만원 이상','5만원 초과','3~5만원','3만원부터 5만원','-5만원','3,5만원','5만원대','3만원 5만원'])assert.throws(()=>Q.parse('셔츠 '+input),/budget/);
 assert.throws(()=>Q.parse('검정 말고 흰 셔츠'),/unsupported_exclusion/);
});
test('all four canonical domestic URLs encode the same explicit outfit conditions once and retain safe official home alternatives',()=>{
 const p=Q.parse('남성 검정 와이드 슬랙스 출근용 5만원 이하 SECRET 키170 몸무게60 비율1.428571'),rows=Q.links(p);assert.deepEqual(rows.map(r=>r.name),['무신사','29CM','네이버쇼핑','쿠팡']);
 for(const row of rows){const u=new URL(row.searchUrl);assert.equal([...u.searchParams.values()][0],'남성 검정 와이드 슬랙스 출근용');assert.doesNotMatch(u.href,/%25(?:EC|EB|EA)/i);assert.doesNotMatch(decodeURIComponent(u.href),/SECRET|170|60|1\.428|50000/);assert.equal(new URL(row.homeUrl).protocol,'https:');}
 assert.equal(new URL(rows[1].searchUrl).pathname,'/store/search');
});
