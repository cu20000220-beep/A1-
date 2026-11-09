/* Dependency-free static packaging for Cloudflare Pages and other static hosts. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const marker = '.a1-static-output';
const signature = 'A1 FASHION generated static output\n';
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
  'credits.html',
  'account.html',
  'privacy.html',
  'global.html',
  'stylist.html',
  'product-lab.html',
  'assets/product-lab.js',
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
if (files.length + 1 > 1000) throw new Error('Deployment exceeds the dashboard upload file limit.');

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
  fs.copyFileSync(path.join(root, relative), target);
}
console.log(`Built ${files.length} static files in dist/ (no package installation or external requests).`);
