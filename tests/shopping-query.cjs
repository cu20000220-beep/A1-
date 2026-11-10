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
 assert.equal(Q.term(p),'남성 검정 세미와이드 슬랙스');
 for(const row of Q.links(p))assert.equal([...new URL(row.searchUrl).searchParams.values()][0],'남성 검정 세미와이드 슬랙스');
 assert.equal(Q.term(Q.parse('여성 화이트 슬림 셔츠')),'여성 흰색 슬림 셔츠');
 assert.throws(()=>Q.term({...p,fit:'https://example.com'}));
});
