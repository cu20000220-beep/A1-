/* Dependency-free static packaging for Cloudflare Pages and other static hosts. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const marker = '.a1-static-output';
const signature = 'A1 FASHION generated static output\n';
// Recheck private operator approval/content hashes; never publish raw seller files.
if(fs.statSync(path.join(root,'assets/approved-products.json')).size>1000000)throw Error('Public snapshot exceeds 1 MB');
const catalog=require('./lib/product-catalog.cjs').validateSnapshot(
  JSON.parse(fs.readFileSync(path.join(root,'assets/approved-products.json'),'utf8')),
  JSON.parse(fs.readFileSync(path.join(root,'catalog/source-approvals.json'),'utf8'))
);
// Independent factual product links carry no retailer image/fitting permission.
const discoveryFile = path.join(root, 'assets/observed-products.json');
if (fs.statSync(discoveryFile).size > 1000000) throw Error('Product observations exceed 1 MB');
const observations = JSON.parse(fs.readFileSync(discoveryFile, 'utf8'));
require('../assets/product-discovery.js').validateSnapshot(observations);
require('./lib/recommendation-source-review.cjs').validateSourceReview(
  JSON.parse(fs.readFileSync(path.join(root, 'catalog/source-review.json'), 'utf8')),
  observations,
  file => fs.existsSync(path.join(root, file))
);
const {readBoundedFile,validateLocalCopies} = require('./lib/product-image-store.cjs');
const imageManifestBytes = readBoundedFile(path.join(root,'assets/product-images.json'), 1000000);
const imageManifest = JSON.parse(imageManifestBytes);
const {entries:imageEntries,validUntil:imageExpiry} = require('../assets/product-images.js').inspectManifest(imageManifest,observations);
const localImageCopies = validateLocalCopies(root,imageEntries);
const files = [];

function collect(relative) {
  const full = path.join(root, relative);
  const info = fs.lstatSync(full);
  if (info.isSymbolicLink()) throw new Error(`Refusing a symlink in deployment assets: ${relative}`);
  if (info.isDirectory()) {
    for (const name of fs.readdirSync(full)) {
      if (name.startsWith('.')) throw new Error(`Hidden files are not deployment assets: ${relative}/${name}`);
      collect(path.join(relative, name));
    }
  } else if (info.isFile()) {
    if (info.size > 25 * 1024 * 1024) throw new Error(`Static file exceeds 25 MiB: ${relative}`);
    files.push(relative);
  } else throw new Error(`Unsupported deployment file: ${relative}`);
}

// Only these assets are public. Adding a file to assets/ must not accidentally
// expose a subscriber catalog, recommendation rules, or shopping URL templates.
const publicEntries = [
  '_headers',
  'index.html',
  'assets/shopping-query.js',
  'assets/shopping-conversation.js',
  'assets/product-catalog.js',
  'assets/catalog-fitting.js',
  'assets/offer-comparison.js',
  'assets/approved-products.json',
  'assets/product-discovery.js',
  'assets/proportion-profile.js',
  'assets/proportion-recommendations.js',
  'assets/proportion-controls.js',
  'assets/local-fashion-core.js',
  'assets/public-beta-bootstrap.js',
  'assets/product-images.js',
  'assets/product-images.json',
  'assets/product-discovery-view.js',
  'assets/product-discovery-view.css',
  'assets/observed-products.json',
  'templates/seller-products.csv',
  'templates/seller-products.json',
  'assets/shopping-search.js',
  'assets/shopping-search.css',
  'credits.html',
  'account.html',
  'privacy.html',
  'global.html',
  'stylist.html',
  'product-lab.html',
  'avatar-lab.html',
  'gltf-proof.html',
  'fitting-studio.html',
  'assets/fitting-studio-view.html',
  'assets/main-fitting-studio.css',
  'assets/fitting-studio.css',
  'assets/fitting-studio.js',
  'assets/fitting-studio-3d.js',
  'assets/fitting-studio-3d.css',
  'assets/fitting-studio-photo.js',
  'assets/fitting-studio-photo.css',
  'assets/studio',
  'assets/gltf-proof.js',
  'assets/gltf-proof.css',
  'assets/humanoid-surface.js',
  'assets/natural-avatar-profile.js',
  'assets/natural-avatar-fit.js',
  'assets/nova-garment-fit.js',
  'assets/natural-avatar-outfit.js',
  'assets/natural-avatar',
  'assets/nova-avatar-studio.js',
  'assets/nova-avatar',
  'assets/gltf-proof',
  'assets/avatar-geometry.js',
  'assets/human-base.js',
  'assets/human-head.js',
  'assets/human-head-color.jpg',
  'assets/human-head-normal.jpg',
  'assets/HUMAN-HEAD-LICENSE.txt',
  'assets/avatar-lab.js',
  'assets/avatar-photo-bridge.js',
  'assets/avatar-lab.css',
  'assets/garment-pose.js',
  'assets/product-lab.js',
  'assets/lab-entry.js',
  'assets/lab-loader.js',
  'assets/product-lab.css',
  'assets/product-matching.js',
  'assets/lab-garment.svg',
  'assets/stylist.css',
  'assets/stylist.js',
  'assets/i18n-stylist.js',
  'assets/stylist-analysis-bridge.js',
  'assets/site-navigation.js',
  'assets/free-beta.js',
  'assets/preview-experience.js',
  'assets/site-navigation.css',
  'assets/global.css',
  'assets/global.js',
  'assets/i18n-global.js',
  'assets/i18n.js',
  'assets/i18n-main.js',
  'assets/i18n-account.js',
  'assets/i18n-info.js',
  'assets/i18n-analysis.js',
  'assets/i18n-app.js',
  'assets/account.js',
  'assets/account.css',
  'assets/app.js',
  'assets/body-analysis.js',
  'assets/premium-client.js',
  'assets/ai-studio.js',
  'assets/style.css',
  'assets/placeholder.svg',
  'assets/PHOTO-CREDITS.md',
  'assets/photos',
  'assets/vendor'
];
for (const entry of publicEntries) collect(entry);
// Expired authorizations leave factual recommendations available. Neither
// local image copies nor merchant CDN references are published under them.
const now = Date.now();
const imagesExpired = imageExpiry !== null && imageExpiry <= now;
const productImages = imagesExpired ? {version:1,authorization:null,products:[]} : imageManifest;
const productImageBytes = imagesExpired ? Buffer.from(JSON.stringify(productImages) + '\n') : imageManifestBytes;
const reviewedImageCopies = new Map((imagesExpired ? [] : localImageCopies).map(({relative,bytes})=>[relative,bytes]));
// Never publish an entire intake directory: unrelated/private files in it are
// not deployment assets. Copy only the exact validated manifest-bound bytes.
for(const relative of reviewedImageCopies.keys())files.push(relative);
if (files.length + 1 > 1000) throw new Error('Deployment exceeds the dashboard upload file limit.');

// Keep connection, script and API policies intact. Image allowances follow
// the same authorization snapshot as the published image manifest.
const headers = require('./lib/catalog-public-headers.cjs').catalogPublicHeaders(
  fs.readFileSync(path.join(root,'_headers'),'utf8').replace(/\r\n/g,'\n'), catalog.products, {manifest:productImages,observations,now}
);

// Never replace an existing directory unless a previous invocation created it.
if (fs.existsSync(output)) {
  const token = path.join(output, marker);
  if (fs.lstatSync(output).isSymbolicLink() || !fs.existsSync(token) ||
      fs.lstatSync(token).isSymbolicLink() || fs.readFileSync(token, 'utf8') !== signature) {
    throw new Error('dist exists without this build marker; preserving it. Choose an empty build directory.');
  }
  fs.rmSync(output, {recursive:true});
}
fs.mkdirSync(output);
fs.writeFileSync(path.join(output, marker), signature);
for (const relative of files) {
  const target = path.join(output, relative);
  fs.mkdirSync(path.dirname(target), {recursive:true});
  if(reviewedImageCopies.has(relative))fs.writeFileSync(target,reviewedImageCopies.get(relative));
  else if(relative==='assets/product-images.json')fs.writeFileSync(target,productImageBytes);
  else fs.copyFileSync(path.join(root, relative), target);
}
fs.writeFileSync(path.join(output,'_headers'),headers);
console.log(`Built ${files.length} static files in dist/ (no package installation or external requests).`);
