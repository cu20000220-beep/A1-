'use strict';
// Actual SQLite statements and RSA signatures; no operational DB, accounts,
// supplier requests, email or SMS are used by this test.
const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { generateKeyPairSync, sign } = require('node:crypto');
const { readFileSync } = require('node:fs');
const api = import('../functions/api/global/_shared.js');
const data = import('../server/member-data.mjs');
const NOW = Date.now();
const ISSUER = 'https://global-members.example.test/';
const AUDIENCE = 'a1-global-test';
const ORIGIN = 'https://a1fashion.pages.dev';
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'global-api-test', alg: 'RS256', use: 'sig' };
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
function jwt(subject) {
  const text = `${encode({ alg: 'RS256', kid: jwk.kid })}.${encode({ iss: ISSUER, aud: AUDIENCE, sub: subject, exp: Math.floor(NOW / 1000) + 3600 })}`;
  return `${text}.${sign('RSA-SHA256', Buffer.from(text), privateKey).toString('base64url')}`;
}
function fixture() {
  const sql = new DatabaseSync(':memory:'); sql.exec(readFileSync(new URL('../server/schema.sql', `file://${__filename}`), 'utf8'));
  const database = {
    prepare(query) {
      const statement = sql.prepare(query);
      return { bind(...values) { return {
        first: async () => statement.get(...values) || null,
        all: async () => ({ results: statement.all(...values) }),
        run: async () => ({ meta: { changes: Number(statement.run(...values).changes) } })
      }; } };
    },
    async batch(statements) {
      sql.exec('BEGIN');
      try { const results = []; for (const statement of statements) results.push(await statement.run()); sql.exec('COMMIT'); return results; }
      catch (error) { sql.exec('ROLLBACK'); throw error; }
    }
  };
  const environment = { AUTH_ISSUER: ISSUER, AUTH_AUDIENCE: AUDIENCE, AUTH_JWKS_URL: `${ISSUER}keys`, MEMBERSHIP_DB: database };
  function member(subject, plan = 'GENERAL', status = 'active', expiry = NOW + 3600000) {
    sql.prepare('INSERT OR REPLACE INTO memberships (issuer,subject,subscription_status,plan_code,paid_through,payment_verified_at) VALUES (?,?,?,?,?,?)')
      .run(ISSUER, subject, status, plan, expiry, NOW - 10000);
  }
  let remoteCalls = 0;
  async function fetchImpl(url, options) {
    remoteCalls++; assert.equal(url, `${ISSUER}keys`); assert.equal(options.redirect, 'manual');
    return Response.json({ keys: [jwk] });
  }
  async function call(resource, { subject = 'a', method = 'GET', body, origin = ORIGIN, authenticated = true, language = 'en' } = {}) {
    const request = new Request(`${ORIGIN}/api/global/${resource}`, { method,
      headers: { ...(authenticated ? { Authorization: `Bearer ${jwt(subject)}` } : {}), 'Accept-Language': language,
        ...(method !== 'GET' ? { Origin: origin, 'Content-Type': 'application/json' } : {}) },
      ...(method !== 'GET' ? { body: JSON.stringify(body ?? {}) } : {}) });
    const response = await (await api).handleGlobalRequest(resource, { request, env: environment }, { now: NOW, fetchImpl });
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    return { status: response.status, value: await response.json() };
  }
  return { sql, database, environment, member, call, fetchImpl, get remoteCalls() { return remoteCalls; } };
}
const prefs = { country: 'US', timeZone: 'America/New_York', language: 'en', frequency: 'daily',
  emailEnabled: true, smsEnabled: false, brands: ['DEMO'], categories: ['tops'] };

test('FREE cannot fetch paid global APIs, GENERAL gets search only, PREMIUM gets DEMO comparison', async () => {
  const f = fixture();
  try {
    assert.equal((await f.call('account')).value.plan, 'FREE');
    for (const endpoint of ['retailers', 'comparison']) assert.equal((await f.call(endpoint, { method: 'POST', body: {} })).status, 403);
    f.member('a', 'GENERAL');
    assert.equal((await f.call('retailers', { method: 'POST', body: { country: 'US', destination: 'US', currency: 'USD' } })).status, 200);
    assert.equal((await f.call('comparison', { method: 'POST', body: { destination: 'US', currency: 'USD' } })).status, 403);
    f.member('a', 'PREMIUM');
    const result = await f.call('comparison', { method: 'POST', body: { destination: 'US', currency: 'USD' } });
    assert.equal(result.status, 200); assert.match(JSON.stringify(result.value), /DEMO/);
    for (const status of ['canceled', 'past_due', 'unpaid']) {
      f.member('a', 'PREMIUM', status);
      assert.equal((await f.call('comparison', { method: 'POST', body: { destination: 'US', currency: 'USD' } })).status, 403);
    }
    f.member('a', 'PREMIUM', 'active', NOW - 1);
    assert.equal((await f.call('comparison', { method: 'POST', body: { destination: 'US', currency: 'USD' } })).status, 403);
  } finally { f.sql.close(); }
});

test('watchlist SQL isolates identities and only Premium can set target prices', async () => {
  const f = fixture(); f.member('a', 'GENERAL'); f.member('b', 'GENERAL');
  try {
    const saved = await f.call('watchlist', { method: 'POST', body: { productId: 'demo-tee', currency: 'USD' } });
    assert.equal(saved.status, 201); const watchId = saved.value.items[0].id;
    assert.equal((await f.call('watchlist', { subject: 'b' })).value.items.length, 0);
    await f.call('watchlist', { subject: 'b', method: 'DELETE', body: { id: watchId } });
    assert.equal((await f.call('watchlist')).value.items.length, 1);
    assert.equal((await f.call('watchlist', { method: 'POST', body: { productId: 'demo-tee', currency: 'USD', targetPrice: 20 } })).status, 403);
    assert.equal((await f.call('watchlist', { method: 'POST', body: { productId: 'demo-tee', currency: 'USD', issuer: 'other' } })).status, 400);
    f.member('a', 'PREMIUM');
    const target = await f.call('watchlist', { method: 'POST', body: { productId: 'demo-tee', currency: 'USD', targetPrice: 20.25 } });
    assert.equal(target.status, 201); assert.equal(target.value.items[0].targetPrice, 20.25);
    const precision = await f.call('watchlist', { method: 'POST', body: { productId: 'demo-tee', currency: 'JPY', targetPrice: 20.25 } });
    assert.equal(precision.status, 400);
  } finally { f.sql.close(); }
});

test('separate channel consent gates previews, dedupes history and masks unverified phone data', async () => {
  const f = fixture(); f.member('a', 'PREMIUM'); f.member('b', 'PREMIUM');
  try {
    assert.equal((await f.call('preview', { method: 'POST', body: { channel: 'email' } })).status, 403);
    const saved = await f.call('preferences', { method: 'PUT', body: prefs });
    assert.equal(saved.status, 200); assert.equal(saved.value.preferences.emailEnabled, false, 'Preference alone is not marketing consent');
    assert.equal((await f.call('preferences', { method: 'PUT', body: { ...prefs, phone: '+12025550123' } })).status, 400);
    await f.call('consents', { method: 'POST', body: { channel: 'email', granted: true } });
    assert.equal((await f.call('preferences')).value.consents.sms, false);
    await f.call('preferences', { method: 'PUT', body: prefs });
    for (let i = 0; i < 2; i++) {
      const preview = await f.call('preview', { method: 'POST', body: { channel: 'email' } });
      assert.equal(preview.status, 200); assert.equal(preview.value.sent, false); assert.equal(preview.value.mode, 'DRY_RUN');
    }
    assert.equal((await f.call('history')).value.deliveries.length, 1);
    assert.equal((await f.call('history', { subject: 'b' })).value.deliveries.length, 0);
    await f.call('consents', { method: 'POST', body: { channel: 'sms', granted: true } });
    const phone = await f.call('preferences', { method: 'PUT', body: { ...prefs, country: 'DE', phone: '+4915123456789', smsEnabled: true } });
    assert.equal(phone.status, 200); assert.equal(phone.value.preferences.phoneVerified, false);
    assert.ok(!JSON.stringify(phone.value).includes('+4915123456789'));
    assert.equal((await f.call('preview', { method: 'POST', body: { channel: 'sms' } })).status, 200, 'SMS is a template preview, never a transmission');
  } finally { f.sql.close(); }
});

test('withdrawal and deletion remain available after expiry and even when API quota is exhausted', async () => {
  const f = fixture(); f.member('a', 'PREMIUM');
  try {
    await f.call('consents', { method: 'POST', body: { channel: 'email', granted: true } });
    await f.call('preview', { method: 'POST', body: { channel: 'email' } });
    const window = Math.floor(NOW / 3600000) * 3600000;
    f.sql.prepare('UPDATE api_rate_limits SET request_count = 60 WHERE issuer = ? AND subject = ? AND window_start = ?').run(ISSUER, 'a', window);
    assert.equal((await f.call('retailers', { method: 'POST', body: {} })).status, 429);
    assert.equal((await f.call('preferences')).status, 429, 'Private reads are rate-limited too; withdrawals do not require a preliminary read');
    f.member('a', 'PREMIUM', 'canceled');
    const withdrawn = await f.call('consents', { method: 'POST', body: { channel: 'email', granted: false } });
    assert.equal(withdrawn.status, 200); assert.equal(withdrawn.value.consents.email, false);
    assert.equal(f.sql.prepare('SELECT status FROM notification_deliveries').get().status, 'canceled');
    assert.equal((await f.call('history', { method: 'DELETE', body: {} })).status, 200);
    assert.equal(f.sql.prepare('SELECT payload_json FROM notification_deliveries').get().payload_json, '{}');
    assert.equal((await f.call('preferences', { method: 'DELETE', body: {} })).status, 200);
    const records = f.sql.prepare('SELECT channel,granted FROM notification_consents').all();
    assert.equal(records.length, 2); assert.ok(records.every(row => row.granted === 0));
  } finally { f.sql.close(); }
});

test('private read quotas are isolated per authenticated member and never block withdrawal or erasure', async () => {
  const f = fixture(); f.member('a', 'PREMIUM');
  try {
    const window = Math.floor(NOW / 3600000) * 3600000;
    f.sql.prepare('INSERT INTO api_rate_limits (issuer,subject,window_start,request_count) VALUES (?,?,?,?)')
      .run(ISSUER, 'a', window, 60);
    for (const resource of ['account', 'watchlist', 'preferences', 'history']) {
      assert.equal((await f.call(resource)).status, 429, `${resource} must reject exhausted reads`);
      assert.equal((await f.call(resource, { subject: 'b' })).status, 200, `${resource} must not use another member's quota`);
    }
    assert.equal(f.sql.prepare('SELECT request_count FROM api_rate_limits WHERE issuer = ? AND subject = ? AND window_start = ?')
      .get(ISSUER, 'b', window).request_count, 4);
    assert.equal((await f.call('consents', { method: 'POST', body: { channel: 'email', granted: false } })).status, 200);
    assert.equal((await f.call('history', { method: 'DELETE', body: {} })).status, 200);
    assert.equal((await f.call('preferences', { method: 'DELETE', body: {} })).status, 200);
    assert.equal((await f.call('watchlist', { method: 'DELETE', body: { id: 'not-an-existing-item' } })).status, 200);
  } finally { f.sql.close(); }
});

test('authenticated FREE account remains available without a D1 binding and cannot manufacture a paid tier', async () => {
  const f = fixture(); delete f.environment.MEMBERSHIP_DB;
  try {
    const result = await f.call('account');
    assert.equal(result.status, 200); assert.equal(result.value.plan, 'FREE');
    assert.equal(result.value.subscription.active, false); assert.equal(result.value.databaseConfigured, false);
    assert.equal((await f.call('account', { authenticated: false })).status, 401);
    assert.equal((await f.call('comparison', { method: 'POST', body: { destination: 'US', currency: 'USD' } })).status, 503);
    assert.equal(f.sql.prepare('SELECT COUNT(*) AS count FROM api_rate_limits').get().count, 0);
  } finally { f.sql.close(); }
});

test('authenticated owner deletion tolerates absent new tables and never deletes another member', async () => {
  const f = fixture(); f.member('a', 'GENERAL'); f.member('b', 'GENERAL');
  try {
    for (const subject of ['a', 'b']) await f.call('watchlist', { subject, method: 'POST', body: { productId: 'demo-tee', currency: 'USD' } });
    await (await data).eraseAllMemberData(f.database, { issuer: ISSUER, subject: 'a' });
    assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM product_watchlists WHERE subject = ?').get('a').n, 0);
    assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM product_watchlists WHERE subject = ?').get('b').n, 1);
    assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM memberships').get().n, 2);
    f.sql.exec('DROP TABLE notification_deliveries');
    await (await data).eraseAllMemberData(f.database, { issuer: ISSUER, subject: 'b' });
    await assert.rejects((await data).eraseAllMemberData({ prepare() { throw new Error('database offline'); } }, { issuer: ISSUER, subject: 'b' }), /database offline/);
  } finally { f.sql.close(); }
});

test('strict input, origin and authentication checks reject browser-created entitlement or recipient data', async () => {
  const f = fixture(); f.member('a', 'PREMIUM');
  try {
    assert.equal((await f.call('comparison', { authenticated: false, method: 'POST', body: {} })).status, 401);
    assert.equal((await f.call('preferences', { method: 'PUT', body: { ...prefs, email: 'someone@example.test' } })).status, 400);
    assert.equal((await f.call('consents', { method: 'POST', origin: 'https://attacker.example.test', body: { channel: 'email', granted: true } })).status, 403);
    assert.equal((await f.call('consents', { method: 'POST', body: { channel: 'email', granted: true, paid: true } })).status, 400);
    assert.equal((await f.call('retailers', { method: 'POST', body: { query: 'x'.repeat(9000) } })).status, 413);
    assert.equal((await f.call('retailers', { method: 'POST', body: { destination: 'https://attacker.example.test' } })).status, 400);
    assert.equal((await f.call('preview', { method: 'POST', body: { channel: 'sms', phone: '+12025550123' } })).status, 400);
  } finally { f.sql.close(); }
});
