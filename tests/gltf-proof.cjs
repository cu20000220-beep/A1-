'use strict';
// Contracts for the isolated renderer: provenance, local imports and policy.
// Real rendering/touch/skin changes are checked by the browser suite.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');

test('vendored glTF runtime has pinned official MIT provenance and only documented import/whitespace edits', () => {
  const prefix = 'assets/vendor/three-0.187.0/';
  const provenance = JSON.parse(read(prefix + 'provenance.json'));
  assert.equal(provenance.name, 'three');
  assert.equal(provenance.version, '0.187.0');
  assert.equal(provenance.license, 'MIT');
  assert.equal(provenance.source, 'https://registry.npmjs.org/three/-/three-0.187.0.tgz');
  assert.match(provenance.integrity, /^sha512-[A-Za-z0-9+/]{86}==$/);
  assert.ok(provenance.files.length >= 7);
  const names = new Set();
  for (const record of provenance.files) {
    assert.ok(!names.has(record.path), 'no duplicate provenance paths');
    names.add(record.path);
    assert.match(record.path, /^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+$/);
    assert.ok(!record.path.split('/').some(part => part.startsWith('.')));
    const bytes = fs.readFileSync(path.join(root, prefix, record.path));
    assert.equal(hash(bytes), record.sha256, record.path + ' actual bytes match recorded digest');
    if (record.upstreamSha256 !== record.sha256) {
      assert.ok(record.path.startsWith('examples/jsm/') || record.path === 'build/three.core.js');
      let restored = bytes.toString('utf8').replace(/from '(?:\.\.\/)+build\/three\.module\.js'/g, "from 'three'");
      if (record.path === 'build/three.core.js') restored = restored.replace(
        '\t\t\t\tmaterial = getMaterial( data.material );', '\t\t\t \tmaterial = getMaterial( data.material );');
      assert.equal(hash(restored), record.upstreamSha256,
        record.path + ' differs from upstream only in its documented import or whitespace change');
    }
  }
  for (const required of ['build/three.module.js', 'build/three.core.js',
    'examples/jsm/loaders/GLTFLoader.js', 'examples/jsm/controls/OrbitControls.js', 'LICENSE']) {
    assert.ok(names.has(required), 'required licensed runtime component: ' + required);
  }
  const licence = read(prefix + 'LICENSE');
  assert.match(licence, /The MIT License/);
  assert.match(licence, /copyright notice and this permission notice shall be included/i);
});

function imports(source) {
  // Upstream JSDoc includes bare-import usage examples which do not execute.
  source = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const values = [];
  for (const pattern of [
    /\bimport\s+(?:[\w$*{},\s]+?\s+from\s*)?['"]([^'"]+)['"]/g,
    /\bexport\s+\{[^}]*\}\s+from\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  ]) for (const match of source.matchAll(pattern)) values.push(match[1]);
  return values;
}

test('isolated page loads a closed local ESM graph with no CDN or bare module specifiers', () => {
  const html = read('gltf-proof.html');
  assert.doesNotMatch(html, /\bon[a-z]+\s*=|javascript\s*:/i, 'no inline event handlers or script URLs');
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
  assert.ok(scripts.length > 0);
  const queue = [];
  for (const [, attributes, body] of scripts) {
    assert.equal(body.trim(), '', 'no inline executable code or import map');
    const src = attributes.match(/\bsrc\s*=\s*['"]([^'"]+)['"]/i)?.[1];
    assert.ok(src && !/^(?:[a-z]+:|\/\/)/i.test(src), 'page scripts stay on this origin');
    const full = path.resolve(root, src.split('?')[0].replace(/^\//, ''));
    assert.ok(full.startsWith(root + path.sep));
    queue.push(full);
  }
  const seen = new Set();
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const source = fs.readFileSync(file, 'utf8');
    for (const specifier of imports(source)) {
      assert.match(specifier, /^\.\.?\//, 'only relative ESM imports: ' + specifier);
      assert.ok(!/[?#]/.test(specifier), 'module identity is not dynamically redirected');
      const target = path.resolve(path.dirname(file), specifier);
      assert.ok(target.startsWith(root + path.sep), 'module remains inside public project');
      assert.ok(fs.statSync(target).isFile(), 'local import exists');
      queue.push(target);
    }
  }
  assert.ok(seen.has(path.join(root, 'assets/gltf-proof.js')));
  assert.ok([...seen].some(file => file.endsWith('/loaders/GLTFLoader.js')));
  assert.ok([...seen].some(file => file.endsWith('/controls/OrbitControls.js')));
  assert.ok([...seen].some(file => file.endsWith('/build/three.core.js')));
  assert.doesNotMatch(read('assets/gltf-proof.js'), /\beval\s*\(|\bnew\s+Function\s*\(/);
});

function policyFor(headers, pattern) {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const block = headers.match(new RegExp('(?:^|\\n)' + escaped + '\\n([\\s\\S]*?)(?=\\n/|$)'))?.[1];
  assert.ok(block, 'dedicated header block exists for ' + pattern);
  const csp = block.match(/Content-Security-Policy:\s*([^\n]+)/)?.[1];
  assert.ok(csp);
  return { block, directives: new Map(csp.split(';').map(value => value.trim()).filter(Boolean).map(value => {
    const [name, ...tokens] = value.split(/\s+/);
    return [name, tokens];
  })) };
}

test('new same-origin glTF fetch policy is confined to the proof page and packaged explicitly', () => {
  const headers = read('_headers');
  const proof = policyFor(headers, '/gltf-proof*');
  assert.deepEqual(proof.directives.get('connect-src'), ["'self'"]);
  assert.deepEqual(proof.directives.get('script-src'), ["'self'"]);
  assert.deepEqual(proof.directives.get('object-src'), ["'none'"]);
  assert.deepEqual(proof.directives.get('frame-ancestors'), ["'none'"]);
  assert.deepEqual(proof.directives.get('base-uri'), ["'none'"]);
  assert.ok(![...proof.directives.values()].flat().some(token => /https?:|\*|unsafe-eval|unsafe-inline/.test(token)));
  assert.match(proof.block, /Cache-Control:\s*no-store/);
  const existing = policyFor(headers, '/avatar-lab*');
  assert.deepEqual(existing.directives.get('connect-src'), ["'none'"], 'existing avatar isolation is preserved');
  assert.deepEqual(existing.directives.get('script-src'), ["'self'"]);
  const build = read('scripts/build-site.cjs');
  const entries = build.match(/const publicEntries\s*=\s*\[([\s\S]*?)\];/)?.[1];
  assert.ok(entries);
  for (const item of ['gltf-proof.html', 'assets/gltf-proof.js', 'assets/gltf-proof.css', 'assets/gltf-proof']) {
    assert.ok(entries.includes("'" + item + "'"), 'new public resource explicitly packaged: ' + item);
    assert.ok(fs.existsSync(path.join(root, item)));
  }
  assert.ok(entries.includes("'assets/vendor'"), 'local runtime and licence are included');
});
