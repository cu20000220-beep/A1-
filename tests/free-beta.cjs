'use strict';
// Basic public links are intentionally separate from paid personalization.
const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {resolve} = require('node:path');
const html = readFileSync(resolve(__dirname,'../global.html'),'utf8');
const section = html.match(/<section id="public-shopping"[^>]*>([\s\S]*?)<\/section>/)?.[0];
const decode = s => s.replaceAll('&amp;','&').replaceAll('&quot;','"');

test('anonymous beta directory exposes exactly the existing neutral retailer searches, without personal or product data', async () => {
  const {RETAILERS,retailerSearchUrl} = await import('../server/global-retailers.mjs');
  assert.ok(section,'Basic searches must be present in the public HTML, without an API response');
  const links=[...section.matchAll(/<a data-public-retailer="([^"]+)" href="([^"]+)" target="_blank" rel="([^"]+)">/g)];
  assert.equal(links.length,11);
  assert.equal(new Set(links.map(row=>row[1])).size,11);
  const terms={KR:'의류',JP:'ファッション',US:'clothing',GB:'clothing',EU:'clothing'};
  for(const [,id,href,rel] of links){
    const retailer=RETAILERS.find(row=>row.id===id);assert.ok(retailer);
    const url=new URL(decode(href));assert.equal(url.protocol,'https:');
    assert.equal(url.href,retailerSearchUrl(id,terms[retailer.country]));
    assert.ok(rel.includes('noopener')&&rel.includes('noreferrer'));
    assert.ok(!url.username&&!url.password);
    assert.ok([...url.searchParams.keys()].every(key=>key===retailer.queryKey));
  }
  assert.deepEqual(new Set(RETAILERS.filter(row=>links.some(link=>link[1]===row.id)).map(row=>row.country)),new Set(['KR','US','JP','GB','EU']));
  assert.doesNotMatch(section,/api\/|data-product-id|targetPrice|shoulderHipRatio|email|paid.?through|price_minor|shipping_minor/i);
});

test('the public directory remains visible by default and clearly separates basic links from protected services', () => {
  assert.ok(section);
  assert.doesNotMatch(section,/<section[^>]*\bhidden\b|<form|<script|\bonclick=/i);
  assert.match(section,/로그인 없이/);
  assert.match(section,/개인화 추천·실제 상품 연동·가격 비교 결과가 아니며/);
  assert.match(section,/배송·재고·가격은 판매처에서 확인/);
  assert.ok(html.indexOf('id="public-shopping"')<html.indexOf('id="global-search"'));
  assert.match(html,/맞춤 검색 · GENERAL 연결 준비 중/);
});
