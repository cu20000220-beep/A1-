'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync, sign } = require('node:crypto');
const { readFileSync } = require('node:fs');
const membershipModule = import('../functions/api/membership.js');
const recommendationModule = import('../functions/api/recommendations.js');
const accessModule = import('../server/premium-access.mjs');
const NOW = Date.now();
const ISSUER = 'https://members.example.test/';
const AUDIENCE = 'a1fashion-members';
const JWKS_URL = `${ISSUER}.well-known/jwks.json`;
const ORIGIN = 'https://a1fashion.pages.dev';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicJwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', use: 'sig', alg: 'RS256' };
const baseClaims = { iss: ISSUER, sub: 'member-1', aud: AUDIENCE, exp: Math.floor(NOW / 1000) + 3600 };
const paidRow = {
  issuer: ISSUER, subject: 'member-1', subscription_status: 'active',
  paid_through: NOW + 3600000, payment_verified_at: NOW - 1000
};
const input = {
  metrics: { shoulderHipRatio: 1.1, legTorsoRatio: 1.6 },
  preferences: { gender: '전체', style: '전체', budget: 100000 }
};
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');

function token(claims = {}, header = {}) {
  const signingInput = `${encode({ alg: 'RS256', kid: 'test-key', typ: 'JWT', ...header })}.${encode({ ...baseClaims, ...claims })}`;
  return `${signingInput}.${sign('RSA-SHA256', Buffer.from(signingInput), privateKey).toString('base64url')}`;
}

function database(getRow = () => paidRow) {
  const reads = [];
  return {
    reads,
    prepare(sql) {
      assert.match(sql, /WHERE issuer = \? AND subject = \?/);
      assert.doesNotMatch(sql, /UPDATE|INSERT|DELETE/i);
      return { bind(issuer, subject) {
        reads.push([issuer, subject]);
        return { async first() { return getRow(issuer, subject); } };
      } };
    }
  };
}

function environment(row = paidRow) {
  return {
    AUTH_ISSUER: ISSUER, AUTH_AUDIENCE: AUDIENCE, AUTH_JWKS_URL: JWKS_URL,
    MEMBERSHIP_DB: database(typeof row === 'function' ? row : () => row)
  };
}

function mockJwks(t, body = { keys: [publicJwk] }, status = 200) {
  return t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, JWKS_URL);
    assert.equal(options.redirect, 'manual');
    assert.equal(options.headers.Accept, 'application/json');
    assert.equal(options.headers.Authorization, undefined);
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
  });
}

function request(path = '/api/membership', { jwt = token(), method = 'GET', headers = {}, body } = {}) {
  return new Request(`${ORIGIN}${path}`, {
    method, headers: { ...(jwt === null ? {} : { Authorization: `Bearer ${jwt}` }), ...headers },
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) })
  });
}

async function get(requestValue = request(), env = environment()) {
  return (await membershipModule).onRequest({ request: requestValue, env });
}

async function post(body = input, { env = environment(), jwt = token(), headers = {}, method = 'POST' } = {}) {
  return (await recommendationModule).onRequest({
    request: request('/api/recommendations', {
      method, jwt, headers: { Origin: ORIGIN, 'Content-Type': 'application/json', ...headers },
      ...(method === 'GET' ? {} : { body })
    }), env
  });
}

async function expectError(response, status, code) {
  assert.equal(response.status, status);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  for (const vary of ['Authorization', 'Cookie', 'Cf-Access-Jwt-Assertion']) {
    assert.ok(response.headers.get('Vary').includes(vary));
  }
  const data = await response.json();
  assert.equal(data.allowed, false);
  assert.equal(data.error, code);
  assert.equal(data.recommendations, undefined);
  assert.equal(data.shopSearches, undefined);
  return data;
}

test('missing or invalid auth/database configuration defaults to setup_required', async () => {
  for (const env of [{}, { AUTH_ISSUER: ISSUER },
    { ...environment(), MEMBERSHIP_DB: null },
    { ...environment(), AUTH_JWKS_URL: 'https://attacker.example.test/jwks' },
    { ...environment(), AUTH_JWKS_URL: 'http://members.example.test/jwks' },
    { ...environment(), AUTH_ISSUER: 'https://user:pass@members.example.test/' },
    { ...environment(), AUTH_AUDIENCE: '' }]) {
    await expectError(await get(request(), env), 503, 'setup_required');
    await expectError(await post(input, { env }), 503, 'setup_required');
  }
});

test('unauthenticated local flags, trial cookies, and untrusted login URLs cannot grant access', async () => {
  const env = environment();
  for (const headers of [{}, { Cookie: 'paid=true; trialStartedAt=9999999999999', 'X-Paid': 'true' }]) {
    await expectError(await get(request('/api/membership', { jwt: null, headers }), env), 401, 'authentication_required');
  }
  env.MEMBER_LOGIN_URL = 'https://members.example.test/login';
  const data = await expectError(await get(request('/api/membership', { jwt: null }), env), 401, 'authentication_required');
  assert.equal(data.loginUrl, env.MEMBER_LOGIN_URL);
  for (const url of ['javascript:alert(1)', 'http://example.test/login', 'https://user:secret@example.test/']) {
    env.MEMBER_LOGIN_URL = url;
    assert.equal((await expectError(await get(request('/api/membership', { jwt: null }), env), 401, 'authentication_required')).loginUrl, undefined);
  }
  assert.equal(env.MEMBERSHIP_DB.reads.length, 0);
});

test('real RSA verification rejects unsigned, malformed, tampered, expired, or wrong-identity tokens', async t => {
  mockJwks(t);
  const tampered = token().split('.');
  tampered[1] = encode({ ...baseClaims, sub: 'another-member' });
  const badTokens = [
    `${encode({ alg: 'none' })}.${encode(baseClaims)}.AA`, 'not-a-jwt', 'a.b.c',
    token({}, { alg: 'HS256' }), tampered.join('.'),
    token({ exp: Math.floor(NOW / 1000) - 1 }), token({ exp: '9999999999' }),
    token({ nbf: Math.floor(NOW / 1000) + 3600 }), token({ iat: Math.floor(NOW / 1000) + 3600 }),
    token({ aud: 'wrong-audience' }), token({ iss: 'https://attacker.example.test/' }),
    token({ sub: '' }), token({ sub: 'member\n1' }),
    token({}, { jku: 'https://attacker.example.test/jwks' }),
    token({}, { crit: ['unknown'] }), token({}, { kid: 'unknown-key' }), 'x'.repeat(16385)
  ];
  for (const jwt of badTokens) {
    const env = environment();
    await expectError(await get(request('/api/membership', { jwt }), env), 401, 'authentication_required');
    assert.equal(env.MEMBERSHIP_DB.reads.length, 0);
  }
});

test('valid bearer, signed Access assertion, and signed Access cookie identify the paid member', async t => {
  mockJwks(t);
  const jwt = token({ aud: ['other-application', AUDIENCE] });
  for (const headers of [
    { Authorization: `Bearer ${jwt}` }, { 'Cf-Access-Jwt-Assertion': jwt },
    { Cookie: `unrelated=value; CF_Authorization=${jwt}` }
  ]) {
    const env = environment();
    const response = await get(request('/api/membership', { jwt: null, headers }), env);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    assert.deepEqual(await response.json(), { allowed: true, accessUntil: paidRow.paid_through, plan: 'GENERAL' });
    assert.deepEqual(env.MEMBERSHIP_DB.reads, [[ISSUER, 'member-1']]);
  }
});

test('conflicting credentials fail closed rather than switching identity', async t => {
  const fetchMock = mockJwks(t);
  await expectError(await get(request('/api/membership', {
    headers: { 'Cf-Access-Jwt-Assertion': token({ sub: 'other-member' }) }
  })), 401, 'authentication_required');
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('signed paid claims, legacy trials, inactive or unverified rows never replace DB payment verification', async t => {
  mockJwks(t);
  const jwt = token({ paid: true, subscriptionStatus: 'active', trialStartedAt: NOW });
  for (const row of [null,
    { ...paidRow, subject: 'another-member' },
    { ...paidRow, subscription_status: 'inactive' },
    { ...paidRow, subscription_status: 'canceled' },
    { ...paidRow, subscription_status: 'past_due' },
    { ...paidRow, subscription_status: 'trialing', trial_started_at: NOW },
    { ...paidRow, paid_through: NOW - 1 },
    { ...paidRow, payment_verified_at: null },
    { ...paidRow, payment_verified_at: NOW + 100000 },
    { issuer: ISSUER, subject: 'member-1', paid: true, trialStartedAt: NOW }
  ]) {
    await expectError(await get(request('/api/membership', { jwt }), environment(row)), 403, 'subscription_required');
  }
});

test('JWKS failure, excessive keys/body, or DB failure return setup_required without leaking details', async t => {
  const fetchMock = mockJwks(t);
  for (const response of [
    () => new Response(JSON.stringify({ keys: [publicJwk] }), { status: 302, headers: { Location: 'https://untrusted.example.test/keys' } }),
    () => new Response('service unavailable', { status: 503 }),
    () => new Response('malformed'),
    () => new Response(JSON.stringify({ keys: Array(21).fill(publicJwk) })),
    () => new Response(' '.repeat(65537)),
    () => new Response('{}', { headers: { 'Content-Length': '999999' } })
  ]) {
    fetchMock.mock.mockImplementation(async () => response());
    await expectError(await get(), 503, 'setup_required');
  }
  fetchMock.mock.mockImplementation(async () => new Response(JSON.stringify({ keys: [publicJwk] })));
  const env = environment();
  env.MEMBERSHIP_DB.prepare = () => { throw new Error('secret database details'); };
  const data = await expectError(await get(request(), env), 503, 'setup_required');
  assert.doesNotMatch(JSON.stringify(data), /secret database details/);
});

test('paid POST returns example recommendations and merchant searches only after authorization', async t => {
  mockJwks(t);
  const response = await post();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  const data = await response.json();
  assert.equal(data.catalogMode, 'examples-only');
  assert.ok(data.recommendations.length > 0);
  assert.ok(data.shopSearches.length > 0);
  assert.ok(data.recommendations.every(item => item.product.source === 'example'));
  assert.equal(data.issuer, undefined);
  assert.equal(data.subject, undefined);
});

test('membership success does not let a revoked subscription reuse an earlier entitlement', async t => {
  mockJwks(t);
  let row = { ...paidRow };
  const env = environment(() => row);
  assert.equal((await get(request(), env)).status, 200);
  row = { ...row, subscription_status: 'canceled' };
  await expectError(await post(input, { env }), 403, 'subscription_required');
  assert.equal(env.MEMBERSHIP_DB.reads.length, 2);
});

test('nonmembers cannot fetch recommendations directly, even with a valid input payload', async t => {
  mockJwks(t);
  await expectError(await post(input, { jwt: null }), 401, 'authentication_required');
  await expectError(await post(input, { env: environment(null) }), 403, 'subscription_required');
});

test('cross-origin requests and unsupported API methods are blocked with no-store headers', async () => {
  await expectError(await post(input, { headers: { Origin: 'https://attacker.example.test' } }), 403, 'forbidden_origin');
  await expectError(await post(input, { headers: { Origin: 'null' } }), 403, 'forbidden_origin');
  const getRecommendations = await post(undefined, { method: 'GET' });
  await expectError(getRecommendations, 405, 'method_not_allowed');
  assert.equal(getRecommendations.headers.get('Allow'), 'POST');
  const updateMembership = await get(request('/api/membership', { method: 'POST', body: { paid: true } }));
  await expectError(updateMembership, 405, 'method_not_allowed');
  assert.equal(updateMembership.headers.get('Allow'), 'GET');
});

test('paid endpoint rejects photos, unknown fields, implausible metrics, and unsafe preferences', async t => {
  mockJwks(t);
  const invalidInputs = [null, [], {}, '{invalid json',
    { ...input, photo: 'data:image/png;base64,aaaa' },
    { ...input, paid: true },
    { ...input, metrics: { ...input.metrics, confidence: 0.9 } },
    { ...input, metrics: { ...input.metrics, image: 'photo.jpg' } },
    { ...input, metrics: { ...input.metrics, shoulderHipRatio: '1.1' } },
    { ...input, metrics: { ...input.metrics, shoulderHipRatio: 0.44 } },
    { ...input, metrics: { ...input.metrics, legTorsoRatio: 3.51 } },
    { ...input, metrics: { ...input.metrics, legTorsoRatio: null } },
    { ...input, preferences: { ...input.preferences, gender: '<script>' } },
    { ...input, preferences: { ...input.preferences, style: 'unknown' } },
    { ...input, preferences: { ...input.preferences, budget: 1.5 } },
    { ...input, preferences: { ...input.preferences, budget: -1 } },
    { ...input, preferences: { ...input.preferences, budget: Number.MAX_SAFE_INTEGER } },
    { ...input, preferences: { ...input.preferences, merchantUrl: 'https://attacker.example.test' } }
  ];
  for (const invalid of invalidInputs) await expectError(await post(invalid), 400, 'invalid_request');
  await expectError(await post(input, { headers: { 'Content-Type': 'image/jpeg' } }), 400, 'invalid_request');
  await expectError(await post(input, { headers: { 'Content-Encoding': 'gzip' } }), 400, 'invalid_request');
});

test('request bodies are limited to 8 KB even when the Content-Length lies or is absent', async t => {
  mockJwks(t);
  await expectError(await post(' '.repeat(8193)), 413, 'request_too_large');
  await expectError(await post(' '.repeat(8193), { headers: { 'Content-Length': '1' } }), 413, 'request_too_large');
  await expectError(await post(input, { headers: { 'Content-Length': '8193' } }), 413, 'request_too_large');
  const { readRecommendationRequest } = await accessModule;
  let canceled = false;
  const stream = new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(8193)); },
    cancel() { canceled = true; }
  });
  const streamed = new Request(`${ORIGIN}/api/recommendations`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: stream, duplex: 'half'
  });
  await assert.rejects(readRecommendationRequest(streamed), error => error.status === 413);
  assert.equal(canceled, true);
});

test('schema grants no demo memberships and requires composite identity with payment evidence', () => {
  const sql = readFileSync(require.resolve('../server/schema.sql'), 'utf8');
  assert.match(sql, /PRIMARY KEY \(issuer, subject\)/);
  assert.match(sql, /payment_verified_at IS NOT NULL/);
  const insertTargets = [...sql.matchAll(/^\s*INSERT(?:\s+OR\s+IGNORE)?\s+INTO\s+([a-z_]+)/gim)].map(match => match[1].toLowerCase());
  assert.deepEqual(insertTargets, ['membership_plans'], 'Only fixed plan definitions may be seeded; no member or delivery grants');
  assert.doesNotMatch(sql, /INSERT(?:\s+OR\s+IGNORE)?\s+INTO\s+(?:memberships|notification_deliveries)\b/i);
});
