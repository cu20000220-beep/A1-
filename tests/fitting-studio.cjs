'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
test('style sheets bind the actual image bytes and grid to an explicitly synthetic 2D source', () => {
  const base = path.join(root, 'assets/studio');
  const manifest = JSON.parse(fs.readFileSync(path.join(base, 'manifest.json')));
  assert.equal(manifest.kind, 'synthetic-editorial-style-images');
  assert.equal(manifest.actual3D, false);
  assert.equal(manifest.actualRetailProducts, false);
  assert.equal(manifest.userBodyReconstruction, false);
  assert.equal(manifest.sheets.columns * manifest.sheets.rows, 9);
  assert.equal(manifest.sheets.cells.length, 9);
  assert.deepEqual(manifest.files.map(file => file.path).sort(), ['female-sheet.png', 'hero.png', 'male-sheet.png']);
  for (const file of manifest.files) {
    assert.match(file.path, /^[a-z-]+\.png$/);
    const bytes = fs.readFileSync(path.join(base, file.path));
    assert.equal(bytes.length, file.bytes);
    assert.ok(bytes.length < 3 * 1024 * 1024);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), file.sha256);
    assert.equal(bytes.readUInt32BE(16), file.width);
    assert.equal(bytes.readUInt32BE(20), file.height);
    if (file.path !== 'hero.png') assert.equal(file.width / file.height, 2 / 3);
  }
});
test('studio confines its optional real 3D asset reads to this origin and packages explicit local resources', () => {
  const html = fs.readFileSync(path.join(root, 'fitting-studio.html'), 'utf8');
  const view = fs.readFileSync(path.join(root, 'assets/fitting-studio-view.html'), 'utf8');
  const headers = fs.readFileSync(path.join(root, '_headers'), 'utf8');
  const policy = headers.match(/^\/fitting-studio\*\r?\n\s+Content-Security-Policy:\s*([^\r\n]+)/m)?.[1];
  assert.ok(policy);
  assert.match(policy, /(?:^|;)\s*connect-src 'self'(?:;|$)/);
  const scriptTokens = policy.match(/(?:^|;)\s*script-src ([^;]+)/)?.[1].trim().split(/\s+/);
  assert.ok(scriptTokens?.includes("'self'"));
  assert.ok(scriptTokens.every(token => ["'self'", "'wasm-unsafe-eval'"].includes(token)), 'only the existing local analysis WASM permission may accompany self');
  assert.match(policy, /(?:^|;)\s*img-src 'self' blob:(?:;|$)/);
  assert.match(policy, /(?:^|;)\s*frame-ancestors 'none'(?:;|$)/);
  assert.doesNotMatch(html, /<iframe\b|id="gltf-proof-root"/i);
  assert.doesNotMatch(html, /\son\w+\s*=|<script(?![^>]*\bsrc=)[^>]*>/i);
  assert.match(view, /id="studio-3d-view"/);
  assert.match(view, /id="gltf-proof-root"/);
  assert.match(view, /<option value="nova" selected>/);
  assert.doesNotMatch(view, /<(?:iframe|script)\b|\son\w+\s*=/i);
  for (const tag of html.matchAll(/<(?:script|link|img)\b[^>]*\b(?:src|href)="([^"]+)"/g)) {
    assert.match(tag[1], /^assets\/[a-z0-9/_.-]+$/i);
    assert.equal(fs.statSync(path.join(root, tag[1])).isFile(), true);
  }
  const build = fs.readFileSync(path.join(root, 'scripts/build-site.cjs'), 'utf8');
  for (const entry of ['fitting-studio.html','assets/fitting-studio.css','assets/fitting-studio.js','assets/fitting-studio-3d.css','assets/fitting-studio-3d.js','assets/fitting-studio-view.html','assets/fitting-studio-photo.js','assets/fitting-studio-photo.css','assets/studio']) assert.ok(build.includes("'" + entry + "'"));
});
