'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const { createProof, writeProof } = require('../scripts/prepare-gltf-proof.cjs');
const { inspectAsset } = require('../scripts/lib/gltf-package-inspector.cjs');
const root = path.resolve(__dirname, '..');
const glb = fs.readFileSync(path.join(root, 'assets/gltf-proof/avatar.glb'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/gltf-proof/asset-manifest.json')));
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const jsonLength = glb.readUInt32LE(12);
const d = JSON.parse(glb.subarray(20, 20 + jsonLength).toString());
const bin = glb.subarray(20 + jsonLength + 8);
function values(id) {
  const a = d.accessors[id], v = d.bufferViews[a.bufferView];
  const components = { SCALAR: 1, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type];
  const size = a.componentType === 5123 ? 2 : 4;
  return Array.from({ length: a.count * components }, (_, i) => a.componentType === 5123
    ? bin.readUInt16LE((v.byteOffset || 0) + i * size)
    : bin.readFloatLE((v.byteOffset || 0) + i * size));
}

test('checked-in proof is an actual self-contained skinned GLB bound to preserved CC0 source and manifest', () => {
  assert.equal(glb.length, manifest.model.bytes);
  assert.equal(sha256(glb), manifest.model.sha256);
  assert.ok(glb.length < 4 * 1024 * 1024);
  for (const source of manifest.sources) {
    assert.equal(sha256(fs.readFileSync(path.join(root, source.path))), source.sha256);
  }
  const report = inspectAsset(glb, { filename: 'avatar.glb' });
  assert.equal(report.stats.meshes, 4);
  assert.equal(report.stats.joints, 2);
  assert.equal(report.features.skinning, true);
  assert.equal(report.features.externalResources, false);
  assert.ok(report.stats.vertices > 13380);
  assert.ok(report.stats.triangles > 26756);
  assert.ok(report.blockers.includes('runtime_unsupported:skinning'), 'old static runtime is not silently declared compatible');
  assert.equal(report.integrationApproved, false);
  assert.equal(report.qualityVerified, false);
});

test('all three preserved example tops contain different real connected geometry and valid body normals/indices', () => {
  assert.deepEqual(d.meshes.map(m => m.name), ['Body', 'ExampleTshirtA', 'ExampleTshirtB', 'ExampleTshirtC']);
  const positions = [];
  for (const mesh of d.meshes) {
    const p = mesh.primitives[0], xyz = values(p.attributes.POSITION), normals = values(p.attributes.NORMAL), indices = values(p.indices);
    assert.equal(xyz.length, normals.length);
    assert.ok(xyz.length > 3000);
    assert.ok(indices.length > 3000 && indices.length % 3 === 0);
    for (const index of indices) assert.ok(Number.isInteger(index) && index >= 0 && index < xyz.length / 3);
    for (let i = 0; i < xyz.length; i += 3) {
      assert.ok(Number.isFinite(xyz[i]) && xyz[i + 1] >= 0 && xyz[i + 1] <= 1.701);
      assert.ok(Math.abs(Math.hypot(normals[i], normals[i + 1], normals[i + 2]) - 1) < 0.0001);
    }
    positions.push(xyz);
  }
  assert.equal(positions[0].length / 3, 13380);
  assert.notDeepEqual(positions[1], positions[2]);
  assert.notDeepEqual(positions[2], positions[3]);
  const source = require('../assets/human-base.js'), G = require('../assets/avatar-geometry.js');
  G.installBase(source);
  assert.deepEqual(positions[0], Array.from(G.scene(G.defaults, 'none', null, { head: false }).bodyMesh.positions));
});

test('body and clothes carry normalized two-joint influences and an actual invertible spine bind', () => {
  assert.deepEqual(d.skins[0].joints, [5, 6]);
  assert.equal(d.nodes[5].name, 'Root');
  assert.equal(d.nodes[6].name, 'Spine');
  assert.deepEqual(d.nodes[6].translation, [0, 0.9, 0]);
  const binds = values(d.skins[0].inverseBindMatrices);
  assert.ok(Math.abs(binds[29] + 0.9) < 1e-6);
  for (const mesh of d.meshes) {
    const p = mesh.primitives[0], xyz = values(p.attributes.POSITION), joints = values(p.attributes.JOINTS_0), weights = values(p.attributes.WEIGHTS_0);
    assert.equal(joints.length, xyz.length / 3 * 4);
    let affected = 0;
    for (let i = 0; i < weights.length; i += 4) {
      assert.deepEqual(joints.slice(i, i + 4), [0, 1, 0, 0]);
      assert.ok(weights[i] >= 0 && weights[i] <= 1 && weights[i + 1] >= 0 && weights[i + 1] <= 1);
      assert.ok(Math.abs(weights[i] + weights[i + 1] - 1) < 1e-6);
      const at = i / 4 * 3, x = xyz[at], y = xyz[at + 1] - 0.9, angle = 0.1;
      const transformedX = x * Math.cos(angle) - y * Math.sin(angle);
      if (Math.abs((transformedX - x) * weights[i + 1]) > 0.001) affected++;
    }
    assert.ok(affected > 100, mesh.name + ' has real nonzero skin deformation rather than metadata alone');
  }
});

test('indexed vertex colours match the preserved body at the same positions, never neighbouring floor or eye triangles', () => {
  const source = require('../assets/human-base.js'), G = require('../assets/avatar-geometry.js');
  G.installBase(source);
  const scene = G.scene(G.defaults, 'none', null, { head: false });
  const reference = new Map();
  for (let at = 0; at < scene.vertices.length; at += 9) {
    const key = Array.from(scene.vertices.slice(at, at + 3)).join(',');
    reference.set(key, Array.from(scene.vertices.slice(at + 6, at + 9)));
  }
  const primitive = d.meshes[0].primitives[0];
  const positions = values(primitive.attributes.POSITION), colors = values(primitive.attributes.COLOR_0);
  assert.equal(colors.length, positions.length);
  for (let i = 0; i < positions.length; i += 3) {
    const key = positions.slice(i, i + 3).join(',');
    assert.deepEqual(colors.slice(i, i + 3), reference.get(key), 'material colour must remain on its original body vertex ' + i / 3);
  }
});

test('licence and provenance explicitly permit web delivery without claiming a new realistic human or real product', () => {
  assert.equal(manifest.license.id, 'CC0-1.0');
  assert.equal(manifest.license.commercialUse, true);
  assert.equal(manifest.license.publicWebDelivery, true);
  assert.equal(manifest.license.url, 'https://creativecommons.org/publicdomain/zero/1.0/');
  for (const key of ['newModelAcquired', 'actualRetailProduct', 'clothPhysics', 'userPhotoOrMeasurements', 'qualityVerified', 'integrationApproved']) assert.equal(manifest[key], false);
  const notice = fs.readFileSync(path.join(root, 'assets/gltf-proof/LICENSE.txt'), 'utf8');
  assert.match(notice, /MakeHuman hm08 core body asset, CC0-1.0/);
  assert.match(notice, /No user photos or measurements/);
  assert.match(notice, /not a newly acquired photorealistic human/);
  assert.equal(d.images, undefined);
  assert.ok(!JSON.stringify(d).includes('"uri"'));
});

test('offline exporter reproduces identical published bytes from the existing source without modifying it', t => {
  const before = manifest.sources.map(record => sha256(fs.readFileSync(path.join(root, record.path))));
  const recreated = createProof();
  assert.equal(sha256(recreated.glb), manifest.model.sha256);
  assert.deepEqual(recreated.manifest, manifest);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'a1-gltf-export-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  // A write helper can target a private directory; it only emits these files.
  const result = writeProof(dir);
  assert.equal(result.model.sha256, manifest.model.sha256);
  assert.deepEqual(fs.readdirSync(dir).sort(), ['LICENSE.txt', 'asset-manifest.json', 'avatar.glb']);
  assert.deepEqual(manifest.sources.map(record => sha256(fs.readFileSync(path.join(root, record.path)))), before);
});
