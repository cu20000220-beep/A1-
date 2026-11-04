'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('../assets/body-analysis.js');
const { analyzePose } = api;

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
test('accepts visible upright pose and reports 2D limitations without modifying inputs', () => {
  const points = pose(), snapshot = JSON.stringify(points);
  const result = analyze(points);
  assert.equal(result.ok, true);
  assert.ok(Math.abs(result.metrics.shoulderHipRatio - (0.4 / 0.28)) < 1e-10);
  assert.equal(result.metrics.confidence, 0.99);
  assert.match(result.summary, /사진 속/);
  assert.ok(result.notes.some(note => note.includes('정확한 신체 치수')));
  assert.ok(result.notes.some(note => note.includes('구독 이용권 확인')));
  assert.deepEqual(Object.keys(api), ['analyzePose']);
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
