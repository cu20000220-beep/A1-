'use strict';
// Check the files actually served by Pages. Never print a matched credential.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../dist');
const required = ['index.html', 'account.html', 'global.html', 'stylist.html', 'privacy.html', 'credits.html'];
for (const name of required) if (!fs.statSync(path.join(root, name)).isFile()) throw new Error('Missing public page: ' + name);
const rules = [
  ['private key', /-----BEGIN (?:[A-Z ]*PRIVATE KEY|OPENSSH PRIVATE KEY)-----/],
  ['OpenAI credential', /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{24,}\b/],
  ['server secret variable', /\b(?:OPENAI_API_KEY|FIREBASE_WEB_API_KEY|AUTH_JWKS_URL)\b/],
  ['direct provider endpoint', /https:\/\/api\.openai\.com(?:\/|\b)/],
  ['service account credential', /"private_key"\s*:\s*"[^"\s]/]
];
let count = 0, textCount = 0;
function inspect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name), relative = path.relative(root, full).split(path.sep).join('/');
    if (entry.isSymbolicLink()) throw new Error('Public symlink: ' + relative);
    if (/(?:^|\/)(?:server|functions|workers|tests|docs|\.git|\.env(?:\..*)?)\/?/.test(relative)
      || /\.(?:sql|sqlite|sqlite3|db|pem|key)$/i.test(relative)) throw new Error('Private artifact: ' + relative);
    if (entry.isDirectory()) { inspect(full); continue; }
    count++;
    if (!/\.(?:html|js|css|json|md)$/i.test(relative) && relative !== '_headers') continue;
    textCount++;
    const content = fs.readFileSync(full, 'utf8');
    for (const [label, expression] of rules) if (expression.test(content)) throw new Error(label + ' in ' + relative);
    if (/^(?:index|account|global|stylist|privacy)\.html$/.test(relative)
      && !content.includes('assets/site-navigation.js')) throw new Error('Missing unified navigation: ' + relative);
  }
}
inspect(root);
console.log(`Public artifact checks passed: ${count} files, ${textCount} text files; no matched server secrets, private artifacts or direct OpenAI endpoint.`);
