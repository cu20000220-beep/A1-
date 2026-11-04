'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { suggest } = require('../assets/shop-search.js');
const analysis = { ok: true, metrics: { shoulderHipRatio: 1.4, legTorsoRatio: 1.8 } };

test('successful analysis produces at most two fixed merchant search links per query', () => {
  const result = suggest(analysis, { gender: '남성', style: '미니멀', budget: 100000 });
  assert.equal(result.length, 2);
  assert.deepEqual(result.map(r => r.query), ['남성 미니멀 와이드 슬랙스', '남성 미니멀 스트레이트 데님']);
  for (const item of result) {
    assert.equal(typeof item.reason, 'string');
    assert.ok(item.reason.length > 0);
    assert.deepEqual(item.links.map(link => link.store), ['Coupang', 'Temu', 'NaverShopping']);
    for (const [index, link] of item.links.entries()) {
      const url = new URL(link.url);
      assert.equal(url.protocol, 'https:');
      const host = ['www.coupang.com', 'www.temu.com', 'search.shopping.naver.com'][index];
      const param = ['q', 'search_key', 'query'][index];
      assert.equal(url.hostname, host);
      assert.deepEqual([...url.searchParams.keys()], [param]);
      assert.equal(url.searchParams.get(param), item.query);
      assert.equal(url.hash, '');
      assert.equal(url.username, '');
      assert.equal(url.password, '');
    }
  }
});

test('style and selected gender map deterministically through whitelisted values', () => {
  for (const gender of ['전체', '여성', '남성', '유니섹스']) {
    for (const style of ['전체', '미니멀', '캐주얼', '클래식', '스트리트']) {
      const result = suggest(analysis, { gender, style });
      assert.equal(result.length, 2);
      assert.deepEqual(suggest(analysis, { gender, style }), result);
      assert.ok(result.every(item => gender === '전체' || item.query.startsWith(gender + ' ')));
      assert.ok(result.every(item => style === '전체' || item.query.includes(style + ' ')));
      assert.ok(result.every(item => !item.query.includes('전체')));
    }
  }
  for (const prefs of [null, '여성', { gender: 'body-photo.jpg' }, { style: '<script>' }, { gender: '남성&affiliate=secret' }, { style: {} }]) {
    assert.deepEqual(suggest(analysis, prefs), []);
  }
});

test('failed, missing, non-finite or out-of-range model data produces no suggestions', () => {
  for (const invalid of [undefined, null, {}, { ok: false }, { ok: true }, { ok: true, metrics: {} }]) {
    assert.deepEqual(suggest(invalid), []);
  }
  for (const [key, values] of [
    ['shoulderHipRatio', [NaN, Infinity, '1.4', 0, 5]],
    ['legTorsoRatio', [NaN, Infinity, '1.8', 0, 10]]
  ]) {
    for (const value of values) {
      assert.deepEqual(suggest({ ok: true, metrics: { ...analysis.metrics, [key]: value } }), []);
    }
  }
});

test('neutral suggestions vary with point geometry without judging the body', () => {
  const upper = suggest({ ok: true, metrics: { shoulderHipRatio: 0.8, legTorsoRatio: 1.8 } }, { gender: '여성', style: '클래식' });
  assert.deepEqual(upper.map(r => r.query), ['여성 클래식 옥스포드 셔츠', '여성 클래식 테일러드 재킷']);
  const short = suggest({ ok: true, metrics: { shoulderHipRatio: 1.4, legTorsoRatio: 1.2 } }, { style: '캐주얼' });
  assert.equal(short[1].query, '캐주얼 하이웨이스트 데님');
  assert.ok(short[1].reason.includes('판정하지 않습니다'));
  assert.ok(short.every(item => !/단점|뚱|마른|이상적인|보완/.test(item.reason)));
});

test('URLs contain no private photo or body fields, budget, tracking or affiliate parameters', () => {
  const privatePrefs = { gender: '유니섹스', style: '스트리트', budget: 84537,
    filename: 'PRIVATE-PHOTO-839.jpg', height: 179, weight: 72, shape: 'PRIVATE-SHAPE', affiliate: 'PRIVATE-TOKEN' };
  const privateAnalysis = { ...analysis, filename: 'PRIVATE-PHOTO-839.jpg',
    metrics: { ...analysis.metrics, shoulderHipRatio: 1.482613, legTorsoRatio: 1.897163, height: 179, weight: 72 } };
  const output = suggest(privateAnalysis, privatePrefs);
  const publicUrls = output.flatMap(item => item.links.map(link => decodeURIComponent(link.url))).join('\n');
  for (const value of ['PRIVATE', '84537', '179', '1.482613', '1.897163', 'filename', 'height', 'weight', 'shape', 'affiliate', 'utm_', 'tag=', 'ref=']) {
    assert.ok(!publicUrls.includes(value), value);
  }
  assert.deepEqual(suggest(privateAnalysis, { ...privatePrefs, budget: 1000 }), output);
});

test('does not modify input analysis or preferences', () => {
  const prefs = { gender: '여성', style: '미니멀', budget: 50000 };
  const beforeAnalysis = JSON.stringify(analysis), beforePrefs = JSON.stringify(prefs);
  suggest(analysis, prefs);
  assert.equal(JSON.stringify(analysis), beforeAnalysis);
  assert.equal(JSON.stringify(prefs), beforePrefs);
});
