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

function hangingArms(wristY = .48) {
  const points = pose();
  for (const [id, [x,y]] of Object.entries({
    13: [.28,.35], 14: [.72,.35], 15: [.27,wristY], 16: [.73,wristY],
  })) {
    points[id] = { x, y, visibility: .99 };
  }
  return points;
}

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
  assert.deepEqual(result.photoProportions, {
    shoulderHipRatio: result.metrics.shoulderHipRatio,
    legTorsoRatio: result.metrics.legTorsoRatio,
  });
  assert.equal(JSON.stringify(points), snapshot);
});

test('optional hanging-arm proportions vary independently of the original body metrics', () => {
  const regular = analyze(hangingArms());
  const longer = analyze(hangingArms(.55));
  assert.equal(regular.ok, true);
  assert.equal(longer.ok, true);
  assert.deepEqual(regular.metrics, longer.metrics);
  const armLength = Math.hypot(.02 * 600, .15 * 1000) + Math.hypot(.01 * 600, .13 * 1000);
  assert.ok(Math.abs(regular.photoProportions.armLegRatio - armLength / regular.metrics.legPixels) < 1e-10);
  assert.ok(longer.photoProportions.armLegRatio > regular.photoProportions.armLegRatio);
  assert.equal(regular.photoProportions.shoulderHipRatio, regular.metrics.shoulderHipRatio);
  assert.equal(regular.photoProportions.legTorsoRatio, regular.metrics.legTorsoRatio);
  assert.equal(Object.hasOwn(regular.metrics, 'armLegRatio'), false, 'legacy consumers keep their original metric shape');
  assert.ok(Object.isFrozen(regular.photoProportions));
});

test('unreliable arm landmarks do not remove usable shoulder and leg proportions', () => {
  const cases = [
    points => { points[15].visibility = .74; },
    points => { points[15].y = .30; },
    points => { points[15].x = .72; },
    points => { points[15].x = .002; },
    points => { delete points[15]; },
  ];
  for (const change of cases) {
    const points = hangingArms();
    change(points);
    const result = analyze(points);
    assert.equal(result.ok, true);
    assert.deepEqual(result.photoProportions, {
      shoulderHipRatio: result.metrics.shoulderHipRatio,
      legTorsoRatio: result.metrics.legTorsoRatio,
    });
  }
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
