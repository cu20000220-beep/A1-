'use strict';
// Real handler + RSA + SQLite tests. All accounts and records live in memory.
const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { generateKeyPairSync, sign } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const issuer = 'https://beta-fixture.example.test/', audience = 'beta-test', origin = 'https://local.example.test';
const now = Date.now();
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'beta-test', alg: 'RS256', use: 'sig' };
const encode = v => Buffer.from(JSON.stringify(v)).toString('base64url');
function token(subject) {
  const input = `${encode({ alg: 'RS256', kid: jwk.kid })}.${encode({ iss: issuer, aud: audience, sub: subject, exp: Math.floor(now / 1000) + 3600 })}`;
  return `${input}.${sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url')}`;
}
const ratios = { shoulderHipRatio: 1.1, legTorsoRatio: 1.6 };
const recommendation = { metrics: ratios, preferences: { gender: '전체', style: '전체', budget: 100000 } };
const comparison = { productId: 'demo-tee', destination: 'KR', currency: 'KRW' };
const stylistInput = intent => ({ message: '출근 코디', language: 'ko', intent, history: [],
  metrics: ratios, consents: { analysis: true, externalAI: false },
  preferences: { gender: 'all', style: 'minimal', budget: 100000, currency: 'KRW', destination: 'KR', category: 'all' } });
async function fixture() {
  const sql = new DatabaseSync(':memory:'); sql.exec(readFileSync(resolve(__dirname, '../server/schema.sql'), 'utf8'));
  const db = { prepare(query) { const statement = sql.prepare(query); return { bind(...values) { return {
    first: async () => statement.get(...values) || null, all: async () => ({ results: statement.all(...values) }),
    run: async () => ({ meta: { changes: Number(statement.run(...values).changes) } })
  }; } }; } };
  db.batch = async statements => {
    sql.exec('BEGIN');
    try { const results = []; for (const statement of statements) results.push(await statement.run()); sql.exec('COMMIT'); return results; }
    catch (error) { sql.exec('ROLLBACK'); throw error; }
  };
  for (const plan of ['GENERAL', 'PREMIUM']) sql.prepare('INSERT INTO memberships (issuer,subject,subscription_status,plan_code,paid_through,payment_verified_at) VALUES (?,?,?,?,?,?)')
    .run(issuer, plan, 'active', plan, now + 3600000, now - 1000);
  const env = { A1_FREE_BETA_MODE: 'true', AUTH_ISSUER: issuer, AUTH_AUDIENCE: audience, AUTH_JWKS_URL: issuer + 'keys', MEMBERSHIP_DB: db };
  let providerCalls = 0;
  const fetchImpl = async url => { providerCalls++; assert.equal(String(url), issuer + 'keys'); return Response.json({ keys: [jwk] }); };
  const global = await import('../functions/api/global/_shared.js');
  const stylist = await import('../server/ai-stylist.mjs');
  const recs = await import('../functions/api/recommendations.js');
  const membership = await import('../functions/api/membership.js');
  async function call(endpoint, { subject, value, method = value === undefined ? 'GET' : 'POST', headers = {}, environment = env } = {}) {
    const request = new Request(origin + '/api/' + endpoint, { method, headers: { Origin: origin,
      ...(subject ? { Authorization: 'Bearer ' + token(subject) } : {}), 'Content-Type': 'application/json', ...headers },
      ...(value === undefined ? {} : { body: JSON.stringify(value) }) });
    const context = { request, env: environment };
    const response = endpoint.startsWith('global/') ? await global.handleGlobalRequest(endpoint.slice(7), context, { now, fetchImpl })
      : endpoint === 'stylist' ? await stylist.handleStylistRequest(context, { now, fetchImpl })
      : endpoint === 'membership' ? await membership.onRequest(context) : await recs.onRequest(context);
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    return { status: response.status, data: await response.json() };
  }
  return { env, sql, call, get providerCalls() { return providerCalls; } };
}

test('only exact server true enables beta; client headers/cookies and malformed flags cannot unlock paid APIs', async () => {
  const { isFreeBetaMode } = await import('../server/free-beta.mjs');
  for (const flag of [undefined, false, true, 'false', 'TRUE', '1', ' true ']) assert.equal(isFreeBetaMode({ A1_FREE_BETA_MODE: flag }), false);
  assert.equal(isFreeBetaMode({ A1_FREE_BETA_MODE: 'true' }), true);
  const f = await fixture();
  try {
    f.env.A1_FREE_BETA_MODE = 'false';
    const headers = { 'X-A1-Free-Beta-Mode': 'true', 'X-Plan': 'PREMIUM', Cookie: 'A1_FREE_BETA_MODE=true; paid=true' };
    assert.equal((await f.call('global/comparison', { subject: 'FREE', value: comparison, headers })).status, 403);
    assert.equal((await f.call('global/comparison', { subject: 'GENERAL', value: comparison, headers })).status, 403);
    assert.equal((await f.call('global/comparison', { subject: 'PREMIUM', value: comparison })).status, 200);
  } finally { f.sql.close(); }
});

test('anonymous/FREE/GENERAL/PREMIUM get public beta features without auth, member reads, live providers or invented data', async () => {
  const f = await fixture();
  try {
    // Any use of these bindings fails the test, even with accidental LIVE flags.
    const environment = { A1_FREE_BETA_MODE: 'true', A1_AI_MODE: 'live', A1_AI_LIVE_APPROVED: 'true', ENABLE_LIVE_CATALOG: 'true', GLOBAL_CATALOG_APPROVED: 'true', A1_AI_CATALOG_APPROVED: 'true' };
    for (const key of ['MEMBERSHIP_DB', 'OPENAI_API_KEY', 'AUTH_ISSUER', 'FIREBASE_WEB_API_KEY']) Object.defineProperty(environment, key, { get() { throw new Error('public beta must not read ' + key); } });
    for (const subject of [undefined, 'FREE', 'GENERAL', 'PREMIUM']) {
      const options = { subject, environment };
      const membership = await f.call('membership', options); assert.equal(membership.data.freeBetaMode, true); assert.equal(membership.data.plan, 'FREE');
      const rec = await f.call('recommendations', { ...options, value: recommendation });
      assert.equal(rec.status, 200); assert.equal(rec.data.catalogMode, 'examples-only');
      const retailers = await f.call('global/retailers', { ...options, value: { country: 'US', destination: 'US', currency: 'USD' } });
      assert.equal(retailers.status, 200); assert.ok(retailers.data.retailers.length > 0);
      const products = await f.call('global/products', { ...options, value: {} }); assert.deepEqual(products.data.products, []);
      const compare = await f.call('global/comparison', { ...options, value: comparison });
      assert.equal(compare.status, 200); assert.deepEqual(compare.data.results, []); assert.equal(compare.data.minimumAmount, null);
      for (const intent of ['style', 'compare', 'discount']) {
        const answer = await f.call('stylist', { ...options, value: stylistInput(intent) });
        assert.equal(answer.status, 200); assert.equal(answer.data.mode, 'DEMO'); assert.equal(answer.data.freeBetaMode, true);
        assert.deepEqual(answer.data.products, []); assert.deepEqual(answer.data.discounts, []); assert.equal(answer.data.comparison, null);
        assert.ok(answer.data.advice.length > 0); assert.equal(answer.data.usage, null);
      }
    }
    assert.equal(f.providerCalls, 0);
    const { getOpenAIStylistConfiguration } = await import('../server/openai-stylist.mjs');
    assert.equal(getOpenAIStylistConfiguration({ A1_FREE_BETA_MODE: 'true', A1_AI_MODE: 'live', A1_AI_LIVE_APPROVED: 'true' }).ready, false);
  } finally { f.sql.close(); }
});

test('beta saved data requires verified login, isolates owners, preserves memberships, and restores paid gates when disabled', async () => {
  const f = await fixture();
  try {
    const before = f.sql.prepare('SELECT * FROM memberships ORDER BY subject').all();
    const watch = { productId: 'example-style', currency: 'KRW', targetPrice: 10000 };
    assert.equal((await f.call('global/watchlist', { value: watch })).status, 401);
    assert.equal((await f.call('global/watchlist', { value: watch, headers: { Authorization: 'Bearer invalid', 'X-Plan': 'PREMIUM' } })).status, 401);
    for (const subject of ['FREE', 'GENERAL', 'PREMIUM']) assert.equal((await f.call('global/watchlist', { subject, value: watch })).status, 201);
    const own = await f.call('global/watchlist', { subject: 'FREE' }); assert.equal(own.data.items.length, 1);
    assert.equal((await f.call('global/watchlist', { subject: 'second-free' })).data.items.length, 0);
    await f.call('global/watchlist', { subject: 'second-free', method: 'DELETE', value: { id: own.data.items[0].id } });
    assert.equal((await f.call('global/watchlist', { subject: 'FREE' })).data.items.length, 1);
    assert.equal((await f.call('global/watchlist', { subject: 'FREE', value: { ...watch, subject: 'PREMIUM' } })).status, 400);
    for (const channel of ['email', 'sms']) {
      const consent = await f.call('global/consents', { subject: 'FREE', value: { channel, granted: true, noticeVersion: 'a1-marketing-v2' } });
      assert.equal(consent.status, 200);
    }
    const preferences = { country: 'KR', timeZone: 'Asia/Seoul', language: 'ko', frequency: 'daily', emailEnabled: true, smsEnabled: true, brands: ['FREE-PRIVATE-FIXTURE'], categories: [] };
    const saved = await f.call('global/preferences', { subject: 'FREE', method: 'PUT', value: preferences });
    assert.equal(saved.status, 200); assert.deepEqual(saved.data.preferences.brands, ['FREE-PRIVATE-FIXTURE']); assert.equal(saved.data.preferences.emailEnabled, false); assert.equal(saved.data.preferences.smsEnabled, false);
    const simulation = await f.call('global/simulate', { subject: 'FREE', value: {} });
    assert.equal(simulation.status, 200); assert.equal(simulation.data.sent, false); assert.equal(simulation.data.created, 0);
    const preview = await f.call('global/preview', { subject: 'FREE', value: { channel: 'email' } });
    assert.equal(preview.status, 200); assert.equal(preview.data.mode, 'DRY_RUN'); assert.equal(preview.data.sent, false);
    assert.equal((await f.call('global/history', { subject: 'second-free' })).data.deliveries.length, 0);
    const secondPrefs = await f.call('global/preferences', { subject: 'second-free' });
    assert.deepEqual(secondPrefs.data.preferences.brands, []);
    f.env.A1_FREE_BETA_MODE = 'false';
    assert.equal((await f.call('global/watchlist', { subject: 'FREE', value: watch })).status, 403);
    assert.equal((await f.call('global/watchlist', { subject: 'GENERAL', value: watch })).status, 403);
    assert.equal((await f.call('global/watchlist', { subject: 'PREMIUM', value: watch })).status, 201);
    assert.deepEqual(f.sql.prepare('SELECT * FROM memberships ORDER BY subject').all(), before);
    assert.equal(f.sql.prepare("SELECT COUNT(*) AS n FROM memberships WHERE subject='FREE'").get().n, 0);
  } finally { f.sql.close(); }
});

test('beta still rejects cross-origin requests and photo/identity payloads', async () => {
  const f = await fixture();
  try {
    assert.equal((await f.call('recommendations', { value: recommendation, headers: { Origin: 'https://attacker.example.test' } })).status, 403);
    assert.equal((await f.call('recommendations', { value: { ...recommendation, photo: 'data:image/png;base64,abc' } })).status, 400);
    assert.equal((await f.call('stylist', { value: { ...stylistInput('style'), message: 'data:image/png;base64,abc' } })).status, 400);
    assert.equal((await f.call('global/retailers', { value: { query: 'shirt' }, headers: { Origin: 'https://attacker.example.test' } })).status, 403);
  } finally { f.sql.close(); }
});
