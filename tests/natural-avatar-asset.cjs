'use strict';
// Actual licensed sample package checks. No downloads, photo processing or DB.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { inspectAsset } = require('../scripts/lib/gltf-package-inspector.cjs');
const { canonicalSha256 } = require('../scripts/lib/fullbody-asset-policy.cjs');

const root = path.resolve(__dirname, '..');
const assetRoot = process.env.A1_NATURAL_ASSET_DIR || path.join(root, 'assets/natural-avatar');
const bytes = fs.readFileSync(path.join(assetRoot, 'sample.glb'));
const manifest = JSON.parse(fs.readFileSync(path.join(assetRoot, 'asset-manifest.json'), 'utf8'));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
function parse(glb) {
  assert.equal(glb.readUInt32LE(0), 0x46546c67);
  assert.equal(glb.readUInt32LE(4), 2);
  assert.equal(glb.readUInt32LE(8), glb.length);
  const jsonLength = glb.readUInt32LE(12);
  assert.equal(glb.readUInt32LE(16), 0x4e4f534a);
  const document = JSON.parse(glb.subarray(20, 20 + jsonLength).toString('utf8'));
  const binAt = 20 + jsonLength;
  assert.equal(glb.readUInt32LE(binAt + 4), 0x004e4942);
  const binary = glb.subarray(binAt + 8, binAt + 8 + glb.readUInt32LE(binAt));
  return { document, binary };
}
const { document: d, binary } = parse(bytes);
const viewBytes = index => {
  const view = d.bufferViews[index];
  return binary.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
};
function protectedHash(document) {
  const value = JSON.parse(JSON.stringify(document));
  delete value.buffers;
  value.bufferViews = value.bufferViews.map(view => {
    delete view.byteOffset; delete view.byteLength; return view;
  });
  return canonicalSha256(value);
}

test('natural reference is bound to the exact official BSD sample and copied redistribution notice', () => {
  assert.equal(manifest.version, 1);
  assert.equal(manifest.assetId, 'natural-reference-A');
  assert.equal(manifest.model.path, 'sample.glb');
  assert.equal(manifest.model.bytes, bytes.length);
  assert.equal(manifest.model.sha256, sha(bytes));
  assert.ok(bytes.length < 12 * 1024 * 1024);
  assert.equal(manifest.source.repository, 'https://github.com/avatarsdk/metaperson-loader-threejs');
  assert.equal(manifest.source.commit, 'ba6eb2505ea3e4d05874bdf7c31a4e45003653d4');
  assert.equal(manifest.source.sha256, '62fb69d6a9ebe720d9028af1c48aa222c7ccfabeccbd642b7f9d7758b64f4d82');
  assert.equal(manifest.source.bytes, 10662760);
  assert.match(manifest.source.url, /^https:\/\/raw\.githubusercontent\.com\/avatarsdk\/metaperson-loader-threejs\/ba6eb2505ea3e4d05874bdf7c31a4e45003653d4\/public\/models\/sample_avatar\.glb$/);
  assert.equal(manifest.license.id, 'BSD-3-Clause');
  assert.equal(manifest.license.commercialUse, true);
  assert.equal(manifest.license.publicWebDelivery, true);
  assert.equal(manifest.license.notice, 'LICENSE.txt');
  const notice = fs.readFileSync(path.join(assetRoot, manifest.license.notice));
  assert.equal(sha(notice), manifest.source.licenseSha256);
  assert.match(notice.toString('utf8'), /Copyright 2024 Itseez3D, Inc\./);
  assert.match(notice.toString('utf8'), /Redistribution and use in source and binary forms/);
  assert.match(notice.toString('utf8'), /Neither the name of the copyright holder/);
});

test('actual geometry, full skin and face morphs remain structurally valid without external resources', () => {
  const report = inspectAsset(bytes, { filename: 'sample.glb', limits: { maxMorphTargets: 512 } });
  assert.equal(report.stats.vertices, 47293);
  assert.equal(report.stats.triangles, 49833);
  assert.equal(report.stats.meshes, 11);
  assert.equal(report.stats.materials, 11);
  assert.equal(report.stats.joints, 73);
  assert.equal(report.stats.morphTargets, 118);
  assert.equal(report.stats.images, 23);
  assert.equal(report.features.skinning, true);
  assert.equal(report.features.morphTargets, true);
  assert.equal(report.features.alphaBlend, true);
  assert.equal(report.features.externalResources, false);
  assert.ok(report.blockers.includes('runtime_unsupported:skinning'));
  assert.ok(report.blockers.includes('runtime_unsupported:pbr_textures'));
  assert.ok(!report.blockers.some(code => code.startsWith('budget_exceeded:')));
  assert.deepEqual(report.stats, manifest.inspection.stats);
  assert.deepEqual(report.features, manifest.inspection.features);
  assert.deepEqual(report.blockers, manifest.inspection.blockersForOldRenderer);
});

test('all non-image binary views and protected model declarations retain their verified source content', () => {
  assert.equal(manifest.derivative.geometryPreserved, true);
  assert.equal(manifest.derivative.materialsPreserved, true);
  assert.equal(manifest.derivative.dimensionsPreserved, true);
  assert.equal(protectedHash(d), manifest.derivative.protectedJsonSha256);
  const imageViews = new Set(d.images.map(image => image.bufferView));
  const expected = d.bufferViews.map((view, index) => index).filter(index => !imageViews.has(index));
  assert.deepEqual(manifest.derivative.nonImageBufferViews.map(view => view.index), expected);
  for (const record of manifest.derivative.nonImageBufferViews) {
    assert.equal(viewBytes(record.index).length, record.bytes);
    assert.equal(sha(viewBytes(record.index)), record.sha256);
    assert.equal((d.bufferViews[record.index].byteOffset || 0) % 4, 0);
  }
  const sourcePath = process.env.A1_NATURAL_SOURCE || '/workspace/work/metaperson-candidate/sample_avatar.glb';
  if (fs.existsSync(sourcePath)) {
    const source = fs.readFileSync(sourcePath);
    assert.equal(sha(source), manifest.source.sha256);
    const original = parse(source);
    assert.equal(protectedHash(original.document), protectedHash(d));
    for (const index of expected) {
      const view = original.document.bufferViews[index];
      assert.deepEqual(viewBytes(index), original.binary.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength));
    }
  }
});

test('mobile texture budget preserves exact head and hair detail and all material image bindings', () => {
  const report = inspectAsset(bytes, { filename: 'sample.glb', limits: { maxMorphTargets: 512 } });
  assert.ok(report.stats.decodedTextureBytes <= 64 * 1024 * 1024);
  assert.equal(report.stats.decodedTextureBytes, manifest.derivative.decodedTextureBytes);
  assert.equal(manifest.derivative.images.length, d.images.length);
  const detail = new Set([10, 11, 19, 20]);
  let changed = 0;
  for (const record of manifest.derivative.images) {
    const image = d.images[record.index], info = report.images[record.index];
    assert.equal(record.mimeType, image.mimeType);
    assert.equal(record.width, info.width); assert.equal(record.height, info.height);
    assert.equal(record.sha256, sha(viewBytes(image.bufferView)));
    if (detail.has(record.index)) {
      assert.equal(record.width, 1024); assert.equal(record.height, 1024);
      assert.equal(record.changed, false);
      assert.equal(record.sha256, record.originalSha256);
    } else {
      assert.ok(record.width <= 512 && record.height <= 512);
      if (record.changed) changed++;
    }
  }
  assert.ok(changed > 0, 'texture optimization must reduce actual embedded images');
  for (const index of [1, 4, 8, 11, 17, 20]) assert.equal(manifest.derivative.images[index].normalMap, true);
  assert.equal(d.materials.find(material => material.name === 'AvatarEyelashes').alphaMode, 'BLEND');
  assert.equal(d.materials.find(material => material.name === 'haircut').alphaMode, 'BLEND');
});
