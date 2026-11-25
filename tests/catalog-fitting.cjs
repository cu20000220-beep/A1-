'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const discovery = require('../assets/product-discovery.js');
const images = require('../assets/product-images.js');
const catalog = require('../assets/product-catalog.js');
const assets = path.join(__dirname, '../assets');
const read = name => fs.readFileSync(path.join(assets, name), 'utf8');

test('studio revalidates observed items by ID and clears stale selections on failure', async () => {
 const observations = JSON.parse(read('observed-products.json'));
 const manifest = JSON.parse(read('product-images.json'));
 const now = manifest.authorization.validUntil - 1000;
 const image = manifest.products.find(item => item.id === 'musinsa-1168906');
 const snapshots = {
  '/assets/observed-products.json': observations,
  '/assets/product-images.json': manifest,
  '/assets/approved-products.json': { version: 1, products: [] }
 };
 const document = new EventTarget(), window = new EventTarget();
 const status = {}, sections = { '#studio-photo-status': { after() {} } };
 Object.assign(document, {
  readyState: 'complete',
  createElement: () => Object.assign(status, { setAttribute() {} }),
  querySelector: selector => selector === '#catalog-fitting-status' && status.id ? status : sections[selector]
 });
 let opened = false;
 Object.assign(window, {
  A1Preview: {}, A1ProductCatalog: catalog, A1LabTemplates: { initialize() {} },
  A1I18n: { register() {}, setText: (target, message) => { target.textContent = message; } },
  A1StudioPhotoFitting: {
   snapshot: () => ({ state: opened ? 'ready' : 'idle' }),
   async open() {
    Object.assign(sections, { '#ai-form': {}, '#ai-result': { hidden: true }, '#lab-root': {} });
    opened = true;
    return true;
   }
  },
  A1ProductDiscovery: { validateSnapshot: snapshot => discovery.validateSnapshot(snapshot, { now }) },
  A1ProductImages: {
   validateManifest: (snapshot, facts) => images.validateManifest(snapshot, facts, { now }),
   fittingProduct: (snapshot, facts, id) => images.fittingProduct(snapshot, facts, id, { now })
  }
 });
 const origin = 'https://example.test';
 vm.runInNewContext(read('catalog-fitting.js'), {
  window, document, location: { origin, hash: '', assign() { assert.fail('studio must stay on the same page'); } },
  URL, URLSearchParams, AbortController, CustomEvent, Date: { now: () => now },
  setTimeout, clearTimeout, fetch: async (url, options) => {
   assert.ok(Object.hasOwn(snapshots, url));
   assert.equal(options.credentials, 'omit');
   return new Response(JSON.stringify(snapshots[url]), { headers: { 'content-type': 'application/json' } });
  }
 });
 const fitting = window.A1CatalogFitting;
 try {
  await fitting.openObserved(image.id);
  assert.equal(opened, true);
  assert.equal(fitting.current().id, image.id);
  assert.equal(fitting.current().productUrl, image.productUrl);
  assert.equal(fitting.current().fittingImageUrl, image.imageUrl);
  document.dispatchEvent(new CustomEvent('a1:analysis-cleared', { detail: { reason: 'photo-replacement' } }));
  assert.equal(fitting.current().id, image.id);

  await fitting.open('missing-item');
  assert.equal(fitting.current(), null);
  assert.match(status.textContent, /상품 자료/);

  snapshots['/assets/product-images.json'] = { version: 1, authorization: null, products: [] };
  await fitting.openObserved(image.id);
  assert.equal(fitting.current(), null);
  assert.match(status.textContent, /권한/);
 } finally {
  fitting.clear();
 }
});
