'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { existsSync } = require('node:fs');
const { resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const engine = import('../server/recommendation-engine.mjs');
const catalog = import('../server/catalog-data.mjs');
const searches = import('../server/shop-search.mjs');
const metrics = Object.freeze({ shoulderHipRatio: 1.4, legTorsoRatio: 1.8 });

test('member result labels all catalog cards as illustrative and uses available local photos', async () => {
  const { recommendForMember } = await engine;
  const { catalogExamples } = await catalog;
  assert.equal(catalogExamples.length, 12);
  assert.ok(Object.isFrozen(catalogExamples));
  assert.ok(catalogExamples.every(Object.isFrozen));
  const result = recommendForMember({ metrics });
  assert.equal(result.catalogMode, 'examples-only');
  assert.equal(result.recommendations.length, 4);
  assert.equal(result.shopSearches.length, 2);
  assert.deepEqual(result.recommendations.map(item => item.product.id), ['a1-005', 'a1-009', 'a1-012', 'a1-003']);
  for (const { product, reasons } of result.recommendations) {
    assert.equal(product.source, 'example');
    assert.ok(reasons.some(reason => reason.includes('실제 판매 상품이 아닌 코디 예시')));
    assert.match(product.photo, /^assets\/photos\/[a-z0-9-]+\.jpg$/);
    assert.ok(existsSync(resolve(__dirname, '..', product.photo)));
    assert.deepEqual(Object.keys(product).sort(), ['id','name','gender','category','style','price','photo','color','material','sizes','description','look','source'].sort());
  }
});

test('style, gender and budget constraints are strict with no fallback to unrelated examples', async () => {
  const { recommendForMember } = await engine;
  const examples = recommendForMember({ metrics, preferences: { gender:'남성', style:'캐주얼', budget:60000 } });
  assert.deepEqual(examples.recommendations.map(item => item.product.id), ['a1-003']);
  assert.ok(examples.recommendations.every(item => item.product.price <= 60000));
  assert.ok(examples.recommendations[0].reasons.some(reason => reason.includes('예시 가격')));
  const unisex = recommendForMember({ metrics, preferences: { gender:'유니섹스', style:'전체', budget:79000 } });
  assert.ok(unisex.recommendations.every(item => item.product.gender === '유니섹스'));
  assert.deepEqual(unisex.recommendations.map(item => item.product.id), ['a1-005', 'a1-003', 'a1-007']);
  assert.deepEqual(recommendForMember({ metrics, preferences: { gender:'여성', style:'클래식', budget:1000 } }).recommendations, []);
  assert.deepEqual(recommendForMember({ metrics, preferences: { budget:0 } }).recommendations, []);
});

test('malformed geometry and preferences produce no recommendation or shopping links', async () => {
  const { recommendForMember } = await engine;
  const empty = { catalogMode:'examples-only', recommendations:[], shopSearches:[] };
  for (const input of [undefined, null, [], {}, { metrics:null }, { metrics:[] }]) {
    assert.deepEqual(recommendForMember(input), empty);
  }
  for (const [key, values] of [
    ['shoulderHipRatio', [NaN, Infinity, '1.4', 0.44, 2.51]],
    ['legTorsoRatio', [NaN, Infinity, '1.8', 0.59, 3.51]]
  ]) {
    for (const value of values) assert.deepEqual(recommendForMember({ metrics:{...metrics,[key]:value} }), empty);
  }
  for (const preferences of [null, [], '미니멀', {gender:'PRIVATE-PHOTO.jpg'}, {style:'<script>'},
    {gender:'남성&affiliate=secret'}, {budget:Infinity}, {budget:NaN}, {budget:-1}, {budget:1.5}, {budget:'50000'}, {budget:undefined}]) {
    assert.deepEqual(recommendForMember({metrics,preferences}), empty);
  }
});

test('ranking is deterministic, source neutral and excludes sold-out or unsafe offers', async () => {
  const { recommendProducts } = await engine;
  const { catalogExamples } = await catalog;
  const base = {...catalogExamples.find(item => item.category === '하의')};
  const products = [
    {...base,id:'external-first',source:'external',internalSupplierToken:'SECRET',checkoutUrl:'https://bad.invalid'},
    {...base,id:'example-second',source:'example'},
    {...base,id:'own-third',source:'own'},
    {...base,id:'sold-out',availability:'soldOut'},
    {...base,id:'bad-image',photo:'https://bad.invalid/track.jpg'},
    {...base,id:'bad-price',price:Infinity}
  ];
  const before = JSON.stringify(products);
  const result = recommendProducts(products, metrics, {budget:100000});
  assert.deepEqual(result.map(item => item.product.id), ['external-first','example-second','own-third']);
  assert.equal(JSON.stringify(products), before);
  assert.equal(JSON.stringify(result).includes('SECRET'), false);
  assert.equal(JSON.stringify(result).includes('checkoutUrl'), false);
  assert.ok(result[0].reasons.some(reason => reason.includes('현재 가격·재고는 판매처')));
  assert.deepEqual(recommendProducts(products, metrics, {budget:100000}), result);
});

test('pose-derived category order responds to geometry without a body or size judgment', async () => {
  const { recommendForMember } = await engine;
  const upper = recommendForMember({ metrics:{shoulderHipRatio:0.8,legTorsoRatio:1.8} });
  assert.deepEqual(upper.recommendations.map(item => item.product.id), ['a1-003','a1-008','a1-011','a1-001']);
  assert.deepEqual(upper.shopSearches.map(item => item.query), ['셔츠','재킷']);
  const middle = recommendForMember({ metrics:{shoulderHipRatio:1.1,legTorsoRatio:1.8} });
  assert.deepEqual(middle.recommendations.map(item => item.product.id), ['a1-001','a1-002','a1-004','a1-010']);
  const highWaist = recommendForMember({ metrics:{shoulderHipRatio:1.4,legTorsoRatio:1.2}, preferences:{style:'캐주얼'} });
  assert.equal(highWaist.shopSearches[1].query, '캐주얼 하이웨이스트 데님');
  assert.ok(highWaist.shopSearches[1].reason.includes('판정하지 않습니다'));
  assert.ok(!/단점|뚱|마른|이상적인|보완/.test(JSON.stringify(highWaist)));
});

test('shopping URLs contain only fixed garments and allowed preference terms', async () => {
  const { recommendForMember } = await engine;
  const input = {
    metrics:{shoulderHipRatio:1.482613,legTorsoRatio:1.897163,filename:'PRIVATE-PHOTO-839.jpg',height:179,weight:72},
    preferences:{gender:'유니섹스',style:'스트리트',budget:84537,filename:'PRIVATE-PHOTO-839.jpg',affiliate:'PRIVATE-TOKEN'}
  };
  const output = recommendForMember(input);
  assert.deepEqual(output.shopSearches.map(item => item.query), ['유니섹스 스트리트 와이드 카고 팬츠','유니섹스 스트리트 와이드 데님']);
  for (const item of output.shopSearches) {
    assert.equal(item.links.length, 3);
    for (const [index, link] of item.links.entries()) {
      const url = new URL(link.url);
      assert.equal(url.protocol, 'https:');
      assert.equal(url.hostname, ['www.coupang.com','www.temu.com','search.shopping.naver.com'][index]);
      const parameter = ['q','search_key','query'][index];
      assert.deepEqual([...url.searchParams.keys()], [parameter]);
      assert.equal(url.searchParams.get(parameter), item.query);
      assert.equal(url.username, '');
      assert.equal(url.password, '');
      assert.equal(url.hash, '');
    }
  }
  const urls = output.shopSearches.flatMap(item => item.links.map(link => decodeURIComponent(link.url))).join('\n');
  for (const value of ['PRIVATE','84537','179','1.482613','1.897163','filename','height','weight','affiliate','utm_','tag=','ref=']) {
    assert.equal(urls.includes(value), false, value);
  }
  assert.deepEqual(recommendForMember({...input,preferences:{...input.preferences,budget:1000}}).shopSearches, output.shopSearches);
});

test('all whitelisted gender/style combinations yield two bounded merchant searches', async () => {
  const { shopSearchesFor } = await searches;
  for (const gender of ['전체','여성','남성','유니섹스']) {
    for (const style of ['전체','미니멀','캐주얼','클래식','스트리트']) {
      const result = shopSearchesFor(metrics, {gender,style});
      assert.equal(result.length, 2);
      assert.deepEqual(shopSearchesFor(metrics, {gender,style}), result);
      assert.ok(result.every(item => gender === '전체' || item.query.startsWith(gender+' ')));
      assert.ok(result.every(item => style === '전체' || item.query.includes(style+' ')));
      assert.ok(result.every(item => !item.query.includes('전체')));
    }
  }
  for (const prefs of [null, [], {gender:'PRIVATE'}, {style:'PRIVATE'}]) assert.deepEqual(shopSearchesFor(metrics,prefs), []);
});

test('inputs and catalog stay unchanged and output mutation cannot change the next request', async () => {
  const { recommendForMember } = await engine;
  const preferences = Object.freeze({gender:'여성',style:'미니멀',budget:150000});
  const request = Object.freeze({metrics,preferences});
  const before = JSON.stringify(request);
  const first = recommendForMember(request);
  const snapshot = structuredClone(first);
  first.recommendations[0].product.name = 'MUTATED';
  first.recommendations[0].reasons.push('MUTATED');
  first.shopSearches[0].links[0].url = 'MUTATED';
  assert.equal(JSON.stringify(request), before);
  assert.deepEqual(recommendForMember(request), snapshot);
});

test('server modules fail when accidentally imported by a browser runtime', () => {
  for (const name of ['catalog-data','shop-search','recommendation-engine']) {
    const file = resolve(__dirname, '..', 'server', name+'.mjs');
    const result = spawnSync(process.execPath, ['--input-type=module','-e',
      'globalThis.window = {}; await import('+JSON.stringify(file)+');'], {encoding:'utf8'});
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /must not be imported in a browser/);
  }
});
