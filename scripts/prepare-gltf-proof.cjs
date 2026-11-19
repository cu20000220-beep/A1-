#!/usr/bin/env node
'use strict';
// Repackage existing reviewed public geometry for an isolated renderer proof.
// No new model download, user measurement/photo, runtime replacement or network.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const G = require('../assets/avatar-geometry.js');
const source = require('../assets/human-base.js');
const { inspectAsset } = require('./lib/gltf-package-inspector.cjs');
const root = path.resolve(__dirname, '..');
const sourceHash = '13dff048664eb387e6ad95ed5b91070ca5658f2688d4d28248118f46ad93c88a';
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const licenseUrl = 'https://creativecommons.org/publicdomain/zero/1.0/';

function createProof() {
  const sourceBytes = fs.readFileSync(path.join(root, 'assets/human-base.js'));
  if (source.license !== 'CC0-1.0' || sha256(sourceBytes) !== sourceHash ||
      source.commit !== 'a8bc2d54ff0ac92e78ff71431b1023eda42bf482') {
    throw new TypeError('unreviewed_source_geometry');
  }
  G.installBase(source);
  const plain = G.scene(G.defaults, 'none', null, { head: false });
  const examples = ['LAB-A', 'LAB-B', 'LAB-C'].map(style => G.scene(G.defaults, style, null, { head: false }));
  const body = plain.bodyMesh;
  // Copy the preserved renderer's existing material colours, rather than
  // inventing a new body/head or applying an uploaded person's skin tone.
  const bodyColors = new Float32Array(body.positions.length);
  // The preserved scene contains a floor before the indexed body and generic
  // eyes after it. Find the actual body stream instead of assuming it is last:
  // an incorrect offset leaves valid geometry but paints unrelated triangles.
  let start = -1;
  for (let offset = 0; offset <= plain.vertices.length - body.indices.length * 9; offset += 9) {
    let matches = true;
    for (let corner = 0; corner < 3 && matches; corner++) {
      const index = body.indices[corner] * 3;
      for (let k = 0; k < 3; k++) if (plain.vertices[offset + corner * 9 + k] !== body.positions[index + k]) matches = false;
    }
    if (matches) { start = offset; break; }
  }
  if (start < 0) throw new TypeError('body_source_layout_changed');
  for (let corner = 0; corner < body.indices.length; corner++) {
    const i = body.indices[corner] * 3;
    for (let k = 0; k < 3; k++) {
      if (plain.vertices[start + corner * 9 + k] !== body.positions[i + k] ||
          plain.vertices[start + corner * 9 + 3 + k] !== body.normals[i + k]) {
        throw new TypeError('body_source_layout_changed');
      }
      bodyColors[i + k] = plain.vertices[start + corner * 9 + 6 + k];
    }
  }
  const d = {
    asset: { version: '2.0', generator: 'A1 preserved-CC0 isolated glTF proof',
      copyright: 'MakeHuman hm08 CC0; A1 connected example surfaces. See LICENSE.txt.' },
    scene: 0,
    scenes: [{ name: 'IsolatedTechnicalProof', nodes: [0] }],
    nodes: [
      { name: 'TechnicalProof', children: [1, 2, 3, 4, 5] },
      { name: 'Body', mesh: 0, skin: 0 },
      { name: 'ExampleTshirtA', mesh: 1, skin: 0 },
      { name: 'ExampleTshirtB', mesh: 2, skin: 0 },
      { name: 'ExampleTshirtC', mesh: 3, skin: 0 },
      { name: 'Root', children: [6] },
      { name: 'Spine', translation: [0, 0.9, 0] }
    ],
    meshes: [],
    skins: [{ name: 'TwoJointRendererProof', skeleton: 5, joints: [5, 6], inverseBindMatrices: 0 }],
    materials: [
      { name: 'PreservedBodyColors', pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.72 } },
      { name: 'ExampleCottonA', doubleSided: true, pbrMetallicRoughness: { baseColorFactor: [0.12, 0.26, 0.43, 1], metallicFactor: 0, roughnessFactor: 0.92 } },
      { name: 'ExampleCottonB', doubleSided: true, pbrMetallicRoughness: { baseColorFactor: [0.54, 0.21, 0.15, 1], metallicFactor: 0, roughnessFactor: 0.92 } },
      { name: 'ExampleCottonC', doubleSided: true, pbrMetallicRoughness: { baseColorFactor: [0.12, 0.33, 0.26, 1], metallicFactor: 0, roughnessFactor: 0.92 } }
    ],
    buffers: [{ byteLength: 0 }], bufferViews: [], accessors: [],
    extras: { purpose: 'renderer-technical-proof', units: 'metres',
      newDigitalHuman: false, bodyReconstruction: false, actualRetailGarment: false,
      clothPhysics: false, bodyMeasurementsFromPhoto: false,
      note: 'Existing generic CC0 body, unchanged example topology; not a photorealism or fitting completion claim.' }
  };
  const chunks = [];
  let length = 0;
  function accessor(values, type, componentType, components, { target, bounds = false } = {}) {
    const size = componentType === 5123 ? 2 : 4;
    const bytes = Buffer.alloc(values.length * size);
    for (let i = 0; i < values.length; i++) {
      if (!Number.isFinite(values[i])) throw new TypeError('invalid_export_value');
      if (size === 2) bytes.writeUInt16LE(values[i], i * size);
      else bytes.writeFloatLE(values[i], i * size);
    }
    const id = d.accessors.length;
    const view = { buffer: 0, byteOffset: length, byteLength: bytes.length };
    if (target) view.target = target;
    d.bufferViews.push(view);
    const a = { bufferView: d.bufferViews.length - 1, componentType, count: values.length / components, type };
    if (bounds) {
      a.min = Array.from({ length: components }, () => Infinity);
      a.max = Array.from({ length: components }, () => -Infinity);
      for (let i = 0; i < values.length; i++) {
        const k = i % components;
        a.min[k] = Math.min(a.min[k], values[i]); a.max[k] = Math.max(a.max[k], values[i]);
      }
    }
    d.accessors.push(a);
    chunks.push(bytes);
    const padding = (4 - bytes.length % 4) % 4;
    if (padding) chunks.push(Buffer.alloc(padding));
    length += bytes.length + padding;
    return id;
  }
  const binds = new Float32Array(32);
  for (const offset of [0, 16]) for (let k = 0; k < 4; k++) binds[offset + k * 5] = 1;
  binds[16 + 13] = -0.9;
  d.skins[0].inverseBindMatrices = accessor(binds, 'MAT4', 5126, 16);
  function mesh(name, geometry, material, color) {
    const count = geometry.positions.length / 3;
    const joints = new Uint16Array(count * 4), weights = new Float32Array(count * 4);
    const anchors = geometry.bodyPositions || geometry.positions;
    // A deliberately simple two-joint renderer test, not an anatomical rig.
    // One linear weight function for body and matching garment anchors keeps
    // interpolated cut vertices consistent and avoids a false cloth solver.
    for (let i = 0; i < count; i++) {
      const upper = Math.max(0, Math.min(1, anchors[i * 3 + 1] / 1.7));
      joints[i * 4 + 1] = 1;
      weights[i * 4] = 1 - upper; weights[i * 4 + 1] = upper;
    }
    const attributes = {
      POSITION: accessor(geometry.positions, 'VEC3', 5126, 3, { target: 34962, bounds: true }),
      NORMAL: accessor(geometry.normals, 'VEC3', 5126, 3, { target: 34962 }),
      JOINTS_0: accessor(joints, 'VEC4', 5123, 4, { target: 34962 }),
      WEIGHTS_0: accessor(weights, 'VEC4', 5126, 4, { target: 34962 })
    };
    if (color) attributes.COLOR_0 = accessor(color, 'VEC3', 5126, 3, { target: 34962 });
    const indices = accessor(geometry.indices, 'SCALAR', 5123, 1, { target: 34963 });
    d.meshes.push({ name, primitives: [{ attributes, indices, material }] });
  }
  mesh('Body', body, 0, bodyColors);
  examples.forEach((scene, i) => mesh('ExampleTshirt' + 'ABC'[i], scene.garmentMesh, i + 1));
  d.buffers[0].byteLength = length;
  const binary = Buffer.concat(chunks);
  const jsonRaw = Buffer.from(JSON.stringify(d));
  const json = Buffer.concat([jsonRaw, Buffer.alloc((4 - jsonRaw.length % 4) % 4, 32)]);
  const glb = Buffer.alloc(12 + 8 + json.length + 8 + binary.length);
  glb.writeUInt32LE(0x46546c67, 0); glb.writeUInt32LE(2, 4); glb.writeUInt32LE(glb.length, 8);
  glb.writeUInt32LE(json.length, 12); glb.writeUInt32LE(0x4e4f534a, 16); json.copy(glb, 20);
  const binStart = 20 + json.length;
  glb.writeUInt32LE(binary.length, binStart); glb.writeUInt32LE(0x004e4942, binStart + 4); binary.copy(glb, binStart + 8);
  if (glb.length > 4 * 1024 * 1024) throw new TypeError('proof_size_budget');
  const inspection = inspectAsset(glb, { filename: 'avatar.glb' });
  const manifest = {
    version: 1, purpose: 'isolated-gltf-renderer-technical-proof',
    model: { path: 'avatar.glb', bytes: glb.length, sha256: sha256(glb) },
    license: { id: 'CC0-1.0', url: licenseUrl, notice: 'LICENSE.txt', commercialUse: true, publicWebDelivery: true },
    sources: [
      { path: 'assets/human-base.js', sha256: sourceHash, upstream: source.source, upstreamCommit: source.commit, upstreamSha256: source.sha256 },
      { path: 'assets/avatar-geometry.js', sha256: sha256(fs.readFileSync(path.join(root, 'assets/avatar-geometry.js'))), role: 'Existing A1 connected example garment generator, preserved without modifications' }
    ],
    meshNames: d.meshes.map(m => m.name), boneNames: ['Root', 'Spine'],
    bodyHeightMetres: 1.7, sourceKind: 'existing-reviewed-generic-reference',
    newModelAcquired: false, actualRetailProduct: false, clothPhysics: false,
    userPhotoOrMeasurements: false, qualityVerified: false, integrationApproved: false,
    inspection: { stats: inspection.stats, features: inspection.features, blockersForOldRenderer: inspection.blockers,
      warnings: inspection.warnings, runtimeProfile: inspection.runtimeProfile }
  };
  const notice = 'A1 isolated glTF renderer technical proof\n\n' +
    'Body: MakeHuman hm08 core body asset, CC0-1.0.\n' +
    'Original copyright holders credited at CC0 release: Data Collection AB, Joel Palmius and Jonas Hauquier.\n' +
    'Source: ' + source.source + '\nSource SHA256: ' + source.sha256 + '\n' +
    'Asset licence statement: https://github.com/makehumancommunity/makehuman/blob/' + source.commit + '/LICENSE.ASSETS.md\n' +
    'Licence: ' + licenseUrl + '\n\n' +
    'Changes: existing A1 relaxed reference mesh and connected example tops repackaged as GLB, with normals, colours, PBR factors and a simple two-joint technical-test skin.\n' +
    'Existing A1 generated example-top geometry is derived from this CC0 surface and released as CC0 with this technical proof. No MakeHuman AGPL program code or third-party retail garment is included.\n' +
    'This is the preserved generic reference body, not a newly acquired photorealistic human, personal reconstruction, accurate retail fitting or cloth-physics simulation.\n' +
    'No user photos or measurements are included. The optional CC BY scan head is not included.\n';
  return { glb, manifest, notice, document: d };
}

function writeProof(output = path.join(root, 'assets/gltf-proof')) {
  const result = createProof();
  fs.mkdirSync(output, { recursive: true });
  if (fs.lstatSync(output).isSymbolicLink()) throw new TypeError('proof_output_symlink');
  for (const name of ['avatar.glb', 'asset-manifest.json', 'LICENSE.txt']) {
    const file = path.join(output, name);
    if (fs.existsSync(file) && fs.lstatSync(file).isSymbolicLink()) throw new TypeError('proof_output_symlink');
  }
  fs.writeFileSync(path.join(output, 'avatar.glb'), result.glb);
  fs.writeFileSync(path.join(output, 'asset-manifest.json'), JSON.stringify(result.manifest, null, 2) + '\n');
  fs.writeFileSync(path.join(output, 'LICENSE.txt'), result.notice);
  return result.manifest;
}
if (require.main === module) {
  const result = writeProof(process.argv[2] && path.resolve(process.argv[2]));
  process.stdout.write(JSON.stringify({ model: result.model, stats: result.inspection.stats, newModelAcquired: false }) + '\n');
}
module.exports = { createProof, writeProof };
