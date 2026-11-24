'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const P = require('../assets/proportion-profile.js');

let model;
let fit;
let Vector3;

async function loadNovaGeometry() {
  const bytes = readFileSync(path.join(__dirname, '../assets/nova-avatar/avatar.glb'));
  const originalJSONLength = bytes.readUInt32LE(12);
  const originalJSONEnd = 20 + originalJSONLength;
  const json = JSON.parse(bytes.subarray(20, originalJSONEnd));
  // This offline test retains the exact BIN chunk, rig and geometry. Ignore
  // textures for Node's GLTFLoader because it has no browser image decoder.
  delete json.images;
  delete json.textures;
  delete json.samplers;
  for (const material of json.materials) {
    delete material.normalTexture;
    delete material.occlusionTexture;
    delete material.emissiveTexture;
    delete material.pbrMetallicRoughness?.baseColorTexture;
    delete material.pbrMetallicRoughness?.metallicRoughnessTexture;
  }
  const jsonBytes = Buffer.from(JSON.stringify(json));
  const padding = Buffer.alloc((4 - jsonBytes.length % 4) % 4, 32);
  const binary = bytes.subarray(originalJSONEnd);
  const header = Buffer.from(bytes.subarray(0, 20));
  header.writeUInt32LE(jsonBytes.length + padding.length, 12);
  header.writeUInt32LE(header.length + jsonBytes.length + padding.length + binary.length, 8);
  const testGLB = Buffer.concat([header, jsonBytes, padding, binary]);

  const loader = await import('../assets/vendor/three-0.187.0/examples/jsm/loaders/GLTFLoader.js');
  const { applyNaturalProfile } = await import('../assets/natural-avatar-profile.js');
  const asset = await new loader.GLTFLoader().parseAsync(
    testGLB.buffer.slice(testGLB.byteOffset, testGLB.byteOffset + testGLB.byteLength),
    ''
  );
  applyNaturalProfile(asset.scene, {nova: true});
  return asset.scene;
}

test.before(async () => {
  ({ Vector3 } = await import('../assets/vendor/three-0.187.0/build/three.module.js'));
  ({ createNaturalFit: fit } = await import('../assets/natural-avatar-fit.js'));
  model = await loadNovaGeometry();
});

function part(fitted, name) {
  const pair = fitted.parts.find(value => value.source.name === name);
  assert.ok(pair, name);
  return pair.mesh.geometry.getAttribute('position');
}

function bandWidth(positions, y, span) {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < positions.count; i++) {
    if (Math.abs(positions.getY(i) - y) > span) continue;
    const x = positions.getX(i);
    min = Math.min(min, x);
    max = Math.max(max, x);
  }
  assert.ok(max > min);
  return max - min;
}

function jointY(name) {
  return model.getObjectByName(name).getWorldPosition(new Vector3()).y;
}

function maxDisplacement(a, b, axis, include = () => true) {
  let max = 0;
  for (let i = 0; i < a.count; i++) {
    if (include(a.getY(i))) {
      max = Math.max(max, Math.abs(a.getComponent(i, axis) - b.getComponent(i, axis)));
    }
  }
  return max;
}

test('empty proportions retain stock Nova geometry and profile-free legacy fits', () => {
  const neutral = fit(model, null);
  const empty = fit(model, null, {profile: P.build()});
  const metrics = {shoulderHipRatio: 1.55, legTorsoRatio: 2.1};
  const prior = fit(model, metrics);
  const current = fit(model, metrics, {profile: P.build()});
  try {
    for (const name of ['AvatarBody', 'outfit_top', 'outfit_bottom', 'outfit_shoes']) {
      assert.deepEqual(part(neutral, name).array, part(empty, name).array);
      assert.deepEqual(part(prior, name).array, part(current, name).array);
    }
    assert.equal(empty.profile.appliedAxes, undefined);
  } finally {
    for (const view of [neutral, empty, prior, current]) view.dispose();
  }
});

test('broad shoulder profile adapts shoulder and hip regions in opposite directions', () => {
  const neutral = fit(model, null);
  const broad = fit(model, null, {profile: P.build({shoulderHipRatio: 1.85})});
  try {
    assert.deepEqual(broad.profile.appliedAxes, ['shoulderHip']);
    const shoulder = jointY('LeftArm') - .025;
    const hip = jointY('LeftUpLeg');
    assert.ok(bandWidth(part(broad, 'outfit_top'), shoulder, .025) >
      bandWidth(part(neutral, 'outfit_top'), shoulder, .025) + .012);
    assert.ok(bandWidth(part(broad, 'outfit_bottom'), hip, .03) <
      bandWidth(part(neutral, 'outfit_bottom'), hip, .03) - .01);
    assert.deepEqual(part(broad, 'outfit_shoes').array, part(neutral, 'outfit_shoes').array);
  } finally {
    neutral.dispose();
    broad.dispose();
  }
});

test('a manually entered smaller shoulder ratio and waist ratio affect their local silhouettes', () => {
  const neutral = fit(model, null);
  const narrow = fit(model, null, {profile: P.build({}, {shoulderWidthCm: 35, hipWidthCm: 40, waistCircumferenceCm: 61, hipCircumferenceCm: 96})});
  try {
    assert.deepEqual(narrow.profile.appliedAxes, ['shoulderHip', 'waistHip']);
    const shoulder = jointY('LeftArm') - .025;
    const hip = jointY('LeftUpLeg');
    const waist = hip + .31 * (jointY('LeftArm') - hip);
    assert.ok(bandWidth(part(narrow, 'outfit_top'), shoulder, .025) <
      bandWidth(part(neutral, 'outfit_top'), shoulder, .025) - .012);
    assert.ok(bandWidth(part(narrow, 'outfit_top'), waist, .025) <
      bandWidth(part(neutral, 'outfit_top'), waist, .025) - .012);
    assert.ok(bandWidth(part(narrow, 'outfit_bottom'), hip, .03) >
      bandWidth(part(neutral, 'outfit_bottom'), hip, .03) + .011);
  } finally {
    neutral.dispose();
    narrow.dispose();
  }
});

test('long-leg and short-torso cues move the shared hip transition while feet and neckline stay anchored', () => {
  const neutral = fit(model, null);
  const long = fit(model, null, {profile: P.build({}, {heightCm: 170, legCm: 92, torsoCm: 38})});
  try {
    assert.deepEqual(long.profile.appliedAxes, ['legTorso', 'legHeight', 'torsoHeight']);
    assert.ok(long.profile.legScale > 1.04);
    assert.ok(long.profile.torsoScale < .96);
    const hip = jointY('LeftUpLeg');
    const above = jointY('LeftArm') + .02;
    assert.ok(maxDisplacement(part(neutral, 'outfit_bottom'), part(long, 'outfit_bottom'), 1, y => Math.abs(y - hip) < .06) > .025);
    assert.equal(maxDisplacement(part(neutral, 'outfit_top'), part(long, 'outfit_top'), 1, y => y > above), 0);
    assert.equal(part(neutral, 'outfit_shoes').array.reduce((floor, n, i) => i % 3 === 1 ? Math.min(floor, n) : floor, Infinity),
      part(long, 'outfit_shoes').array.reduce((floor, n, i) => i % 3 === 1 ? Math.min(floor, n) : floor, Infinity));
  } finally {
    neutral.dispose();
    long.dispose();
  }
});

test('arm ratio changes hands and stock sleeve geometry together without moving lower outfit', () => {
  const neutral = fit(model, null);
  const short = fit(model, null, {profile: P.build({armLegRatio: .49})});
  const long = fit(model, null, {profile: P.build({armLegRatio: .49}, {armCm: 72, heightCm: 170})});
  try {
    assert.deepEqual(short.profile.appliedAxes, ['armLeg']);
    assert.deepEqual(long.profile.appliedAxes, ['armHeight']);
    assert.ok(short.profile.armScale < 1 && long.profile.armScale > 1);
    for (const name of ['AvatarBody', 'outfit_top']) {
      assert.ok(maxDisplacement(part(short, name), part(long, name), 1) > .014);
    }
    for (const name of ['outfit_bottom', 'outfit_shoes']) {
      assert.deepEqual(part(short, name).array, part(neutral, name).array);
      assert.deepEqual(part(long, name).array, part(neutral, name).array);
    }
  } finally {
    neutral.dispose();
    short.dispose();
    long.dispose();
  }
});
