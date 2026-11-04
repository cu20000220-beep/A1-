'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { analyzePose, recommend } = require('../assets/style-advisor.js');

function pose() {
  const result = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.99 }));
  const coordinates = {
    11: [0.3, 0.2], 12: [0.7, 0.2], 23: [0.36, 0.45], 24: [0.64, 0.45],
    25: [0.36, 0.65], 26: [0.64, 0.65], 27: [0.36, 0.9], 28: [0.64, 0.9]
  };
  for (const [i, [x, y]] of Object.entries(coordinates)) result[i] = { x, y, visibility: 0.99 };
  return result;
}
const analyze = points => analyzePose(points, 600, 1000);
const products = [
  { id: 'w', gender: '여성', style: '미니멀', category: '상의', price: 50000 },
  { id: 'm', gender: '남성', style: '미니멀', category: '상의', price: 70000 },
  { id: 'u', gender: '유니섹스', style: '캐주얼', category: '하의', price: 40000 },
  { id: 'um', gender: '유니섹스', style: '미니멀', category: '액세서리', price: 30000 },
  { id: 'expensive', gender: '여성', style: '미니멀', category: '아우터', price: 190000 },
  { id: 'unknown', gender: '여성', style: '미니멀', category: '기타', price: 20000 }
];

test('accepts visible upright pose and reports 2D limitations without modifying inputs', () => {
  const points = pose(), snapshot = JSON.stringify(points);
  const result = analyze(points);
  assert.equal(result.ok, true);
  assert.ok(Math.abs(result.metrics.shoulderHipRatio - (0.4 / 0.28)) < 1e-10);
  assert.equal(result.metrics.confidence, 0.99);
  assert.match(result.summary, /사진 속/);
  assert.ok(result.notes.some(note => note.includes('정확한 신체 치수')));
  assert.ok(result.notes.some(note => note.includes('규칙 기반')));
  assert.equal(JSON.stringify(points), snapshot);
});

test('pixel aspect ratio is applied to geometric distances', () => {
  const points = pose();
  points[23].x += 0.06; points[24].x += 0.06;
  points[25].x += 0.06; points[26].x += 0.06;
  points[27].x += 0.06; points[28].x += 0.06;
  const narrow = analyzePose(points, 600, 1000);
  const wide = analyzePose(points, 1000, 1000);
  assert.equal(narrow.ok, true); assert.equal(wide.ok, true);
  assert.ok(wide.metrics.torsoPixels > narrow.metrics.torsoPixels);
  assert.ok(wide.metrics.legTorsoRatio < narrow.metrics.legTorsoRatio);
  assert.ok(Math.abs(wide.metrics.torsoPixels - Math.hypot(60, 250)) < 1e-10);
});

test('rejects missing, low-confidence, out-of-frame, and non-finite landmarks', () => {
  for (const invalid of [undefined, [], {}, Array(33).fill(null)]) assert.equal(analyze(invalid).ok, false);
  for (const [key, value] of [['visibility', 0.59], ['visibility', NaN], ['x', NaN], ['y', Infinity], ['x', -0.1], ['y', 1]]) {
    const points = pose(); points[27][key] = value;
    assert.equal(analyze(points).ok, false, `${key}=${value}`);
  }
  assert.equal(analyzePose(pose(), 0, 1000).ok, false);
  assert.equal(analyzePose(pose(), NaN, 1000).ok, false);
});

test('rejects degenerate, tilted, seated, and implausible pose geometry', () => {
  const duplicate = pose(); duplicate[12] = { ...duplicate[11] };
  assert.equal(analyze(duplicate).ok, false);
  const tilted = pose(); tilted[12].y = 0.4;
  assert.equal(analyze(tilted).ok, false);
  const seated = pose(); seated[25].y = 0.4;
  assert.equal(analyze(seated).ok, false);
  const turned = pose(); turned[23].x = 0.49; turned[24].x = 0.51;
  assert.equal(analyze(turned).ok, false);
});

test('recommendations respect gender, style and inclusive budget with no fallback', () => {
  const result = analyze(pose());
  const picks = recommend(products, result, { gender: '여성', style: '미니멀', budget: 50000 });
  assert.deepEqual(picks.map(p => p.product.id), ['w', 'um', 'unknown']);
  assert.ok(picks.every(p => p.product.price <= 50000 && p.product.style === '미니멀'));
  const men = recommend(products, result, { gender: '남성', style: '전체', budget: 100000 });
  assert.ok(men.every(p => ['남성', '유니섹스'].includes(p.product.gender)));
  const unisex = recommend(products, result, { gender: '유니섹스', budget: 100000 });
  assert.ok(unisex.every(p => p.product.gender === '유니섹스'));
  assert.deepEqual(recommend(products, result, { gender: '여성', style: '클래식', budget: 50000 }), []);
  assert.deepEqual(recommend(products, result, { budget: 0 }), []);
});

test('invalid budgets and unsuccessful analysis never create recommendations', () => {
  const result = analyze(pose());
  for (const budget of [NaN, Infinity, -1, 1.5, '50000', null]) {
    assert.deepEqual(recommend(products, result, { budget }), []);
  }
  assert.deepEqual(recommend(products, { ok: false }), []);
  assert.deepEqual(recommend(products, { ok: true, metrics: { shoulderHipRatio: NaN } }), []);
  assert.deepEqual(recommend(products, result, { gender: 'invalid' }), []);
  assert.deepEqual(recommend(null, result), []);
});

test('ranking uses pose-derived category order, stays deterministic, and does not mutate catalog', () => {
  const snapshot = JSON.stringify(products);
  const result = analyze(pose());
  const picks = recommend(products, result);
  assert.equal(picks.length, 4);
  assert.equal(picks[0].product.id, 'u');
  assert.ok(picks.every(p => p.reasons.length >= 3));
  assert.deepEqual(recommend(products, result), picks);
  const lower = { ...result, metrics: { ...result.metrics, shoulderHipRatio: 0.8 } };
  assert.equal(recommend(products, lower)[0].product.id, 'w');
  assert.equal(JSON.stringify(products), snapshot);
});

test('source never changes ranking and unavailable or mismatching products stay excluded', () => {
  const base = {availability:'available', gender:'여성', style:'미니멀', category:'상의', price:45000};
  const catalog = [
    {...base,id:'external-first',source:'external'},
    {...base,id:'example-second',source:'example'},
    {...base,id:'own-third',source:'own'},
    {...base,id:'sold-out',source:'own',availability:'soldOut'},
    {...base,id:'over-budget',source:'external',price:70000},
    {...base,id:'other-gender',source:'own',gender:'남성'},
    {...base,id:'other-style',source:'own',style:'클래식'}
  ];
  const preferences = {gender:'여성',style:'미니멀',budget:50000};
  const picks = recommend(catalog, analyze(pose()), preferences);
  assert.deepEqual(picks.map(p => p.product.id), ['external-first','example-second','own-third']);
  const swapped = catalog.map(p => ({...p,source:p.source==='own'?'external':'own'}));
  assert.deepEqual(recommend(swapped, analyze(pose()), preferences).map(p => p.product.id), picks.map(p => p.product.id));
  assert.ok(picks.every(p => !/자사|우선 제안|주문|결제 접수/.test(p.reasons.join(' '))));
});

test('budget copy distinguishes registered external prices from illustrative prices', () => {
  const base = {gender:'여성',style:'미니멀',category:'상의',price:45000};
  const catalog = [
    {...base,id:'external',source:'external'},
    {...base,id:'example',source:'example'},
    {...base,id:'unspecified'},
    {...base,id:'legacy-own',source:'own'}
  ];
  const picks = recommend(catalog, analyze(pose()), {gender:'여성',style:'미니멀',budget:50000});
  assert.match(picks[0].reasons.join(' '), /외부 등록 가격/);
  assert.match(picks[0].reasons.join(' '), /판매처에서 확인/);
  for (const pick of picks.slice(1)) {
    assert.match(pick.reasons.join(' '), /예시 가격/);
    assert.doesNotMatch(pick.reasons.join(' '), /외부 등록 가격|주문|결제/);
  }
});
