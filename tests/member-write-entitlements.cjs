'use strict';
// Actual RSA and SQLite with a controlled DB clock. No operational services.
const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { generateKeyPairSync, sign } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const api = import('../functions/api/global/_shared.js');
const data = import('../server/member-data.mjs');
const NOW = Date.now(), ORIGIN = 'https://a1fashion.pages.dev';
const ISSUER = 'https://write-entitlements.example.test/', AUDIENCE = 'write-entitlements';
const OWNER = 'member-a', OTHER = 'member-b';
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'write-key', alg: 'RS256', use: 'sig' };
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
function token(subject) {
  const value = `${encode({ alg: 'RS256', kid: jwk.kid })}.${encode({ iss: ISSUER, aud: AUDIENCE, sub: subject, exp: Math.floor(NOW / 1000) + 7200 })}`;
  return `${value}.${sign('RSA-SHA256', Buffer.from(value), privateKey).toString('base64url')}`;
}
function fixture({ legacyPlan = false } = {}) {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(resolve(__dirname, '../server/schema.sql'), 'utf8'));
  if (legacyPlan) sql.exec('ALTER TABLE memberships DROP COLUMN plan_code');
  let hook, clock = NOW;
  // Supply a virtual database execution clock, without replacing any SQL
  // membership predicate or transaction. A queued write observes the new time.
  sql.function('unixepoch', precision => { assert.equal(precision, 'subsec'); return clock / 1000; });
  const database = { prepare(query) { return { bind(...values) {
    const execute = async method => { if (hook) await hook(query); return sql.prepare(query)[method](...values); };
    return { first: async () => await execute('get') || null,
      all: async () => ({ results: await execute('all') }),
      run: async () => ({ meta: { changes: Number((await execute('run')).changes) } }) };
  } }; }, async batch(statements) {
    sql.exec('BEGIN');
    try { const rows = []; for (const statement of statements) rows.push(await statement.run()); sql.exec('COMMIT'); return rows; }
    catch (error) { sql.exec('ROLLBACK'); throw error; }
  } };
  const env = { AUTH_ISSUER: ISSUER, AUTH_AUDIENCE: AUDIENCE, AUTH_JWKS_URL: ISSUER + 'keys', MEMBERSHIP_DB: database };
  function member(subject = OWNER, plan = 'PREMIUM', status = 'active', expiry = NOW + 3600000) {
    const columns = legacyPlan ? '' : ',plan_code', values = legacyPlan ? [] : [plan];
    sql.prepare(`INSERT OR REPLACE INTO memberships(issuer,subject,subscription_status,paid_through,payment_verified_at${columns}) VALUES(?,?,?,?,?${legacyPlan ? '' : ',?'})`)
      .run(ISSUER, subject, status, expiry, NOW - 10000, ...values);
  }
  member(); member(OTHER);
  async function call(resource, body, method = 'POST', subject = OWNER) {
    const request = new Request(`${ORIGIN}/api/global/${resource}`, { method,
      headers: { Authorization: `Bearer ${token(subject)}`, 'Accept-Language': 'en', ...(method === 'GET' ? {} : { Origin: ORIGIN, 'Content-Type': 'application/json' }) },
      ...(method === 'GET' ? {} : { body: JSON.stringify(body ?? {}) }) });
    const response = await (await api).handleGlobalRequest(resource, { request, env }, { clock: () => clock, fetchImpl: async url => {
      assert.equal(url, ISSUER + 'keys'); return Response.json({ keys: [jwk] });
    } });
    return { status: response.status, value: await response.json() };
  }
  function seedWatch(subject = OWNER, target = 50) {
    sql.prepare('INSERT INTO product_watchlists(id,issuer,subject,product_id,target_price,currency,brand,category,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
      .run('watch-' + subject, ISSUER, subject, 'demo-tee', target, 'USD', '', '', NOW);
  }
  return { sql, database, member, call, seedWatch, setHook(value) { hook = value; }, setClock(value) { clock = value; }, close() { sql.close(); } };
}
const watch = { productId: 'demo-tee', currency: 'USD', targetPrice: 25 };
const prefs = { country: 'US', timeZone: 'America/New_York', language: 'en', frequency: 'daily', emailEnabled: false, smsEnabled: false, brands: [], categories: [] };
const changes = {
  downgrade: f => f.member(OWNER, 'GENERAL'), canceled: f => f.member(OWNER, 'PREMIUM', 'canceled'),
  past_due: f => f.member(OWNER, 'PREMIUM', 'past_due'), unpaid: f => f.member(OWNER, 'PREMIUM', 'unpaid'),
  refund: f => { f.member(OWNER, 'PREMIUM', 'inactive'); f.sql.prepare('UPDATE memberships SET payment_verified_at=NULL WHERE subject=?').run(OWNER); },
  expiry: f => f.setClock(NOW + 3600001)
};

for (const [label, revoke] of Object.entries(changes)) {
  test(`queued Premium target insert/update cannot survive ${label} or mutate another owner`, async () => {
    for (const existing of [false, true]) {
      const f = fixture(); try {
        if (existing) f.seedWatch(); f.seedWatch(OTHER, 80);
        let fired = false;
        f.setHook(query => { if (!fired && /INSERT INTO product_watchlists/.test(query)) { fired = true; revoke(f); } });
        const result = await f.call('watchlist', watch);
        assert.equal(result.status, 403); assert.equal(fired, true);
        const row = f.sql.prepare('SELECT target_price FROM product_watchlists WHERE subject=?').get(OWNER);
        assert.equal(row?.target_price, existing ? 50 : undefined, 'Denied write cannot persist a Premium target');
        assert.equal(f.sql.prepare('SELECT target_price FROM product_watchlists WHERE subject=?').get(OTHER).target_price, 80);
      } finally { f.close(); }
    }
  });
}

test('a canceled/expired General watch write cannot mutate data while a valid General can save', async () => {
  for (const revoke of [f => f.member(OWNER, 'GENERAL', 'canceled'), f => f.setClock(NOW + 3600001)]) {
    const f = fixture(); try {
      f.member(OWNER, 'GENERAL'); let fired = false;
      f.setHook(query => { if (!fired && /INSERT INTO product_watchlists/.test(query)) { fired = true; revoke(f); } });
      assert.equal((await f.call('watchlist', { ...watch, targetPrice: null })).status, 403);
      assert.equal(f.sql.prepare('SELECT COUNT(*) AS count FROM product_watchlists').get().count, 0);
    } finally { f.close(); }
  }
  const f = fixture(); try {
    f.member(OWNER, 'GENERAL'); assert.equal((await f.call('watchlist', { ...watch, targetPrice: null })).status, 201);
    f.member(); assert.equal((await f.call('watchlist', watch)).status, 201);
    assert.equal(f.sql.prepare('SELECT target_price FROM product_watchlists').get().target_price, 25);
    f.member(OWNER, 'GENERAL'); assert.equal((await f.call('watchlist', { ...watch, targetPrice: null })).status, 201);
    assert.equal(f.sql.prepare('SELECT target_price FROM product_watchlists').get().target_price, null);
  } finally { f.close(); }
});

test('full owner limits and legacy paid General compatibility remain while legacy targets fail closed', async () => {
  const f = fixture(); try {
    const insert = f.sql.prepare('INSERT INTO product_watchlists(id,issuer,subject,product_id,currency,created_at) VALUES(?,?,?,?,?,?)');
    for (let i = 0; i < 100; i++) insert.run('watch-' + i, ISSUER, OWNER, 'item-' + i, 'USD', NOW);
    assert.equal((await f.call('watchlist', watch)).status, 409);
    assert.equal((await f.call('watchlist', { ...watch, productId: 'item-0' })).status, 201);
  } finally { f.close(); }
  const legacy = fixture({ legacyPlan: true }); try {
    assert.equal((await legacy.call('watchlist', { ...watch, targetPrice: null })).status, 201);
    assert.equal((await legacy.call('watchlist', watch)).status, 403);
    await assert.rejects(new (await data).MemberStore(legacy.database, { issuer: ISSUER, subject: OWNER }, NOW).saveWatch(watch), error => error.status === 403);
  } finally { legacy.close(); }
});

for (const resource of ['preferences', 'consents']) {
  test(`queued Premium ${resource} cannot persist after downgrade, cancellation or expiry`, async () => {
    for (const revoke of [changes.downgrade, changes.canceled, changes.expiry]) {
      const f = fixture(); try {
        let fired = false;
        f.setHook(query => { if (!fired && new RegExp('INSERT INTO notification_' + (resource === 'preferences' ? 'preferences' : 'consents')).test(query)) { fired = true; revoke(f); } });
        const result = await f.call(resource, resource === 'preferences' ? prefs : { channel: 'email', granted: true }, resource === 'preferences' ? 'PUT' : 'POST');
        assert.equal(result.status, 403); assert.equal(fired, true);
        const table = resource === 'preferences' ? 'notification_preferences' : 'notification_consents';
        assert.equal(f.sql.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count, 0, 'Denied paid write must have no stored side effect');
      } finally { f.close(); }
    }
  });
}

test('withdrawal, erasure and own watch deletion remain possible after expired paid access', async () => {
  const f = fixture(); try {
    f.seedWatch(); f.seedWatch(OTHER, 80);
    assert.equal((await f.call('consents', { channel: 'sms', granted: true })).status, 200);
    f.member(OWNER, 'PREMIUM', 'active', NOW - 1);
    assert.equal((await f.call('consents', { channel: 'sms', granted: false })).status, 200);
    assert.equal((await f.call('watchlist', { id: 'watch-' + OWNER }, 'DELETE')).status, 200);
    assert.equal((await f.call('preferences', {}, 'DELETE')).status, 200);
    assert.equal(f.sql.prepare('SELECT COUNT(*) AS count FROM product_watchlists WHERE subject=?').get(OWNER).count, 0);
    assert.equal(f.sql.prepare('SELECT target_price FROM product_watchlists WHERE subject=?').get(OTHER).target_price, 80);
  } finally { f.close(); }
});
