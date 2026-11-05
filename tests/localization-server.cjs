'use strict';
// Local fixtures only: no real Firebase account, message, retailer or payment call.
const test = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync, sign } = require('node:crypto');
const localeModule = import('../server/locale.mjs');
const engineModule = import('../server/recommendation-engine.mjs');
const catalogModule = import('../server/catalog-data.mjs');
const authModule = import('../server/firebase-auth.mjs');
const endpointModule = import('../functions/api/recommendations.js');
const origin = 'https://a1fashion.pages.dev';
const input = { metrics: { shoulderHipRatio: 1.1, legTorsoRatio: 1.6 },
  preferences: { gender: '전체', style: '전체', budget: 100000 } };
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'localization-fixture', use: 'sig', alg: 'RS256' };
const now = Date.now();
const seconds = Math.floor(now / 1000);
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
function token(issuer, audience, subject = 'locale-member') {
  const text = `${encode({ alg: 'RS256', kid: jwk.kid })}.${encode({ iss: issuer, aud: audience,
    sub: subject, exp: seconds + 3600 })}`;
  return `${text}.${sign('RSA-SHA256', Buffer.from(text), privateKey).toString('base64url')}`;
}

test('request language is a bounded ko/en allowlist with a stable Korean legacy default', async () => {
  const { requestLanguage, normalizeLanguage } = await localeModule;
  const language = header => requestLanguage(new Request(origin, { headers: header === undefined ? {} : { 'Accept-Language': header } }));
  for (const [header, expected] of [[undefined, 'ko'], ['', 'ko'], ['ko-KR,ko;q=0.9,en;q=0.6', 'ko'],
    ['en-US,en;q=0.9', 'en'], ['en;q=0.2,ko;q=0.9', 'ko'], ['ja-JP', 'en'],
    ['en;q=0,ko;q=1', 'ko'], ['en;q=8,ko;q=0.5', 'ko'],
    ['<script>secret()</script>', 'en'], ['x'.repeat(1100), 'en']]) assert.equal(language(header), expected);
  assert.equal(normalizeLanguage('en-US'), 'ko');
  assert.equal(normalizeLanguage({ paid: true }), 'ko');
});

test('English recommendations localize private display data without changing filters, prices or ranking', async () => {
  const { recommendForMember } = await engineModule;
  const { catalogExamples, localizeCatalogProduct } = await catalogModule;
  const before = JSON.stringify(catalogExamples);
  const ko = recommendForMember(input);
  const en = recommendForMember(input, { language: 'en' });
  assert.equal(en.catalogMode, 'examples-only');
  assert.equal(en.recommendations.length, 4);
  assert.deepEqual(en.recommendations.map(row => [row.product.id, row.product.price, row.product.gender, row.product.category, row.product.style]),
    ko.recommendations.map(row => [row.product.id, row.product.price, row.product.gender, row.product.category, row.product.style]));
  for (const product of catalogExamples) {
    const english = localizeCatalogProduct(product, 'en');
    for (const field of ['name', 'description', 'color', 'material', 'sizes']) {
      assert.equal(typeof english[field], 'string');
      assert.doesNotMatch(english[field], /[가-힣]/);
    }
    assert.equal(english.availability, undefined);
  }
  for (const row of en.recommendations) {
    assert.match(row.reasons[0], /example, not an item for sale/);
    assert.ok(row.reasons.every(reason => !/[가-힣]/.test(reason)));
    assert.match(row.reasons.at(-1), /KRW budget/);
  }
  for (let i = 0; i < en.shopSearches.length; i++) {
    const search = en.shopSearches[i];
    assert.doesNotMatch(search.displayQuery + search.reason, /[가-힣]/);
    assert.equal(search.query, ko.shopSearches[i].query, 'Retailer query terms remain relevant to the selected Korean marketplaces');
    assert.deepEqual(search.links.map(link => link.url), ko.shopSearches[i].links.map(link => link.url));
    assert.ok(search.links.every(link => link.label.startsWith('Search on ')));
    for (const link of search.links) assert.doesNotMatch(link.url, /shoulder|torso|1\.1|1\.6|member/i);
  }
  en.recommendations[0].product.name = 'changed output';
  assert.equal(JSON.stringify(catalogExamples), before);
  assert.deepEqual(recommendForMember(input), ko);
});

test('an English request still requires signed identity and current paid DB state before any recommendation', async t => {
  const handler = await endpointModule;
  const issuer = 'https://locale-members.example.test/';
  const audience = 'locale-members';
  const jwksUrl = `${issuer}.well-known/jwks.json`;
  const jwt = token(issuer, audience);
  let paid = false, reads = 0;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, jwksUrl);
    assert.equal(options.redirect, 'manual');
    return Response.json({ keys: [jwk] });
  });
  const env = { AUTH_ISSUER: issuer, AUTH_AUDIENCE: audience, AUTH_JWKS_URL: jwksUrl,
    MEMBERSHIP_DB: { prepare(sql) {
      assert.match(sql, /^SELECT/); assert.doesNotMatch(sql, /INSERT|UPDATE|DELETE/i);
      return { bind(boundIssuer, subject) {
        assert.equal(boundIssuer, issuer); assert.equal(subject, 'locale-member');
        return { async first() { reads++; return paid ? { issuer, subject, subscription_status: 'active',
          paid_through: now + 3600000, payment_verified_at: now - 1000 } : null; } };
      } };
    } }
  };
  const request = credential => new Request(`${origin}/api/recommendations`, { method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', 'Accept-Language': 'en-US',
      ...(credential ? { Authorization: `Bearer ${credential}` } : {}) }, body: JSON.stringify(input) });
  const anonymous = await handler.onRequest({ request: request(), env });
  assert.equal(anonymous.status, 401);
  assert.equal(reads, 0);
  const unpaid = await handler.onRequest({ request: request(jwt), env });
  assert.equal(unpaid.status, 403);
  assert.equal((await unpaid.json()).recommendations, undefined);
  paid = true;
  const response = await handler.onRequest({ request: request(jwt), env });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Language'), 'en');
  assert.match(response.headers.get('Vary'), /Accept-Language/);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  const body = await response.json();
  assert.doesNotMatch(body.recommendations[0].product.name, /[가-힣]/);
  assert.equal(body.recommendations.length, 4);
  assert.equal(reads, 2);
});

test('email verification and reset use a whitelisted locale without new credential fields or tokens in JSON', async () => {
  const auth = await authModule;
  const project = 'locale-auth-fixture';
  const key = 'fixture-public-localization-key-12345';
  const email = 'locale-member@example.test';
  const password = 'local fixture password';
  const env = { FIREBASE_PROJECT_ID: project, FIREBASE_WEB_API_KEY: key };
  const calls = [];
  const fetchImpl = async (url, options) => {
    assert.equal(new URL(url).origin, 'https://identitytoolkit.googleapis.com');
    assert.equal(new URL(url).searchParams.get('key'), key);
    assert.equal(options.redirect, 'manual');
    assert.equal(options.headers['X-Firebase-Locale'], 'en');
    const action = new URL(url).pathname.split(':').at(-1);
    const data = JSON.parse(options.body);
    calls.push({ action, data });
    if (action === 'signUp') {
      assert.deepEqual(data, { email, password, returnSecureToken: true });
      return Response.json({ localId: 'locale-user', idToken: 'opaque-fixture-token' });
    }
    if (data.requestType === 'VERIFY_EMAIL') assert.deepEqual(data, { requestType: 'VERIFY_EMAIL', idToken: 'opaque-fixture-token' });
    return Response.json({ email });
  };
  const request = (action, body) => new Request(`${origin}/api/auth/${action}`, { method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', 'Accept-Language': 'en-US,en;q=0.9' }, body: JSON.stringify(body) });
  const signup = await auth.handleAuthRequest('signup', { request: request('signup', { email, password }), env }, { now, fetchImpl });
  assert.equal(signup.status, 201);
  assert.equal(signup.headers.get('Content-Language'), 'en');
  assert.equal(signup.headers.get('Set-Cookie'), null);
  const result = await signup.json();
  assert.match(result.message, /account was created/);
  assert.doesNotMatch(JSON.stringify(result), /opaque-fixture-token|fixture-public|local fixture password|[가-힣]/);
  assert.equal(result.allowed, undefined);
  const reset = await auth.handleAuthRequest('reset-password', { request: request('reset-password', { email }), env }, { now, fetchImpl });
  assert.equal(reset.status, 200);
  assert.match((await reset.json()).message, /^If an account exists/);
  assert.deepEqual(calls.map(call => call.action), ['signUp', 'sendOobCode', 'sendOobCode']);
  const failed = await auth.handleAuthRequest('login', { request: request('login', { email, password }), env: {} }, { now, fetchImpl });
  assert.equal(failed.status, 503);
  assert.match((await failed.json()).message, /AUTH-CONFIG/);
});
