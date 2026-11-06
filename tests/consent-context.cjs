'use strict';
// Real local SQLite only. No member, mailing provider or operational DB is used.
const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { readFileSync } = require('node:fs');
const modulePromise = import('../server/member-data.mjs');
const NOW = Date.now();
const owner = { issuer: 'https://consent-members.example.test/', subject: 'member-a' };
const other = { ...owner, subject: 'member-b' };
const preferences = { country: 'KR', timeZone: 'Asia/Seoul', language: 'ko', frequency: 'daily',
  emailEnabled: false, smsEnabled: false, brands: [], categories: [] };
const file = name => readFileSync(new URL('../server/' + name, `file://${__filename}`), 'utf8');

async function fixture({ legacyContext = false, planColumn = true } = {}) {
  const api = await modulePromise, sql = new DatabaseSync(':memory:');
  sql.exec('CREATE TABLE memberships(issuer TEXT NOT NULL,subject TEXT NOT NULL,subscription_status TEXT NOT NULL DEFAULT \'inactive\',paid_through INTEGER,payment_verified_at INTEGER,PRIMARY KEY(issuer,subject)) STRICT;');
  if (planColumn) sql.exec(file('migrations/0001_membership_tiers.sql'));
  sql.exec(file('migrations/0002_global_catalog_and_alerts.sql'));
  if (!legacyContext) sql.exec(file('migrations/0003_global_consent_context.sql'));
  let hook;
  const database = {
    prepare(query) { return { bind(...values) {
      const sync = method => sql.prepare(query)[method](...values);
      const execute = async method => { if (hook) await hook(query, method); return sync(method); };
      return { first: async () => await execute('get') || null,
        all: async () => ({ results: await execute('all') }),
        run: async () => ({ meta: { changes: Number((await execute('run')).changes) } }),
        executeBatch: () => ({ meta: { changes: Number(sync('run').changes) } }) };
    } }; },
    async batch(statements) {
      // D1 executes a batch as a single transaction. Do not interleave its writes.
      sql.exec('BEGIN');
      try { const result = statements.map(statement => statement.executeBatch()); sql.exec('COMMIT'); return result; }
      catch (error) { sql.exec('ROLLBACK'); throw error; }
    }
  };
  function member(identity = owner, { plan = 'PREMIUM', status = 'active' } = {}) {
    if (planColumn) sql.prepare('INSERT OR REPLACE INTO memberships(issuer,subject,subscription_status,paid_through,payment_verified_at,plan_code) VALUES(?,?,?,?,?,?)')
      .run(identity.issuer, identity.subject, status, NOW + 3600000, NOW - 1000, plan);
    else sql.prepare('INSERT OR REPLACE INTO memberships(issuer,subject,subscription_status,paid_through,payment_verified_at) VALUES(?,?,?,?,?)')
      .run(identity.issuer, identity.subject, status, NOW + 3600000, NOW - 1000);
  }
  member(); member(other);
  return { api, sql, database, member, store: new api.MemberStore(database, owner, NOW),
    otherStore: new api.MemberStore(database, other, NOW), setHook(value) { hook = value; }, close() { sql.close(); } };
}
const acknowledged = api => ({ noticeVersion: api.CONSENT_POLICY_VERSION });

test('review-only context migration preserves historical consent and every existing member field', async () => {
  const f = await fixture({ legacyContext: true });
  try {
    f.sql.prepare('INSERT INTO notification_consents(id,issuer,subject,channel,granted,policy_version,occurred_at) VALUES(?,?,?,?,?,?,?)')
      .run('old-proof', owner.issuer, owner.subject, 'email', 1, 'historical-policy', NOW - 100);
    const members = f.sql.prepare('SELECT * FROM memberships ORDER BY subject').all();
    const old = f.sql.prepare('SELECT * FROM notification_consents').get();
    f.sql.exec(file('migrations/0003_global_consent_context.sql'));
    assert.deepEqual(f.sql.prepare('SELECT * FROM memberships ORDER BY subject').all(), members);
    const row = f.sql.prepare('SELECT * FROM notification_consents').get();
    for (const [key, value] of Object.entries(old)) assert.equal(row[key], value);
    assert.equal(row.country, null); assert.equal(row.language, null); assert.equal(row.notice_text, null);
    const history = await f.store.consentHistory();
    assert.equal(history.auditContextAvailable, true); assert.equal(history.records[0].contextCaptured, false);
    assert.equal(history.records[0].policyVersion, 'historical-policy');
    const fresh = new DatabaseSync(':memory:');
    try {
      fresh.exec(file('schema.sql'));
      assert.ok(['country', 'language', 'notice_text'].every(name => fresh.prepare('PRAGMA table_info(notification_consents)').all().some(row => row.name === name)));
      assert.equal(fresh.prepare('SELECT COUNT(*) AS count FROM memberships').get().count, 0);
    } finally { fresh.close(); }
  } finally { f.close(); }
});

test('country, displayed notice language and exact text are immutable; cached callers do not invent notice proof', async () => {
  const f = await fixture();
  try {
    await f.store.savePreferences({ ...preferences, country: 'US', timeZone: 'America/New_York', language: 'ko' });
    await f.store.saveConsent('email', true, { ...acknowledged(f.api), language: 'en' });
    const original = (await f.store.consentHistory()).records[0];
    assert.equal(original.country, 'US'); assert.equal(original.language, 'en'); assert.equal(original.contextCaptured, true);
    assert.equal(original.noticeText, f.api.consentNotice('email', 'en'));
    assert.equal(original.policyVersion, f.api.CONSENT_POLICY_VERSION);
    await f.store.savePreferences({ ...preferences, country: 'JP', timeZone: 'Asia/Tokyo', language: 'ko' });
    assert.deepEqual((await f.store.consentHistory()).records[0], original, 'Changing preferences cannot rewrite earlier consent evidence');
    await f.store.saveConsent('sms', true, acknowledged(f.api));
    let latest = (await f.store.consentHistory()).records[0];
    assert.equal(latest.country, 'JP'); assert.equal(latest.language, 'ko'); assert.equal(latest.noticeText, f.api.consentNotice('sms', 'ko'));
    await f.store.saveConsent('email', false);
    latest = (await f.store.consentHistory()).records[0];
    assert.equal(latest.noticeText, null); assert.equal(latest.contextCaptured, false, 'Old UI calls remain valid opt-out, without claiming a displayed new notice');
    assert.deepEqual(await f.store.consents(), { email: false, sms: true });
    const defaultFixture = await fixture();
    try {
      await defaultFixture.store.saveConsent('email', true, acknowledged(f.api));
      const record = (await defaultFixture.store.consentHistory()).records[0];
      assert.equal(record.country, 'KR'); assert.equal(record.language, 'ko');
    } finally { defaultFixture.close(); }
    for (const options of [{ language: 'xx' }, { noticeVersion: 'made-up-proof' }, { noticeText: 'attacker wording' }]) {
      await assert.rejects(f.store.saveConsent('email', true, options), error => error.status === 400);
    }
  } finally { f.close(); }
});

test('audit records are owner-scoped and erasure retains only minimal withdrawal tombstones', async () => {
  const f = await fixture();
  try {
    await f.store.saveConsent('email', true, acknowledged(f.api));
    await f.store.saveConsent('sms', true, acknowledged(f.api));
    await f.otherStore.saveConsent('email', true, { ...acknowledged(f.api), language: 'en' });
    await f.store.savePreferences({ ...preferences, phone: '+821012345678', brands: ['private-style-reference'] });
    const records = (await f.store.consentHistory()).records;
    assert.equal(records.length, 2); assert.equal((await f.otherStore.consentHistory()).records.length, 1);
    assert.doesNotMatch(JSON.stringify(records), /member-a|member-b|consent-members|821012345678|private-style-reference/);
    await f.store.eraseNotificationData();
    const erased = await f.store.consentHistory();
    assert.equal(erased.records.length, 2); assert.ok(erased.records.every(row => !row.granted && !row.contextCaptured));
    assert.ok(erased.records.every(row => row.country === null && row.language === null && row.noticeText === null));
    assert.equal(f.sql.prepare('SELECT COUNT(*) AS count FROM notification_preferences WHERE issuer=? AND subject=?').get(owner.issuer, owner.subject).count, 0);
    assert.equal((await f.otherStore.consentHistory()).records.length, 1);
    assert.equal(f.sql.prepare('SELECT COUNT(*) AS count FROM memberships').get().count, 2);
  } finally { f.close(); }
});

test('only exact absent context-column errors permit legacy fallback; unrelated storage failures do not grant consent', async () => {
  const f = await fixture({ legacyContext: true });
  try {
    await f.store.saveConsent('email', true, acknowledged(f.api));
    assert.deepEqual(await f.store.consents(), { email: true, sms: false });
    const history = await f.store.consentHistory();
    assert.equal(history.auditContextAvailable, false); assert.equal(history.records[0].contextCaptured, false);
    assert.equal(history.records[0].noticeText, null);
    await f.store.saveConsent('email', false);
    assert.equal((await f.store.consents()).email, false);
    for (const message of ['database offline', 'no such column: unrelated', 'table another_table has no column named country']) {
      let writes = 0;
      const broken = { prepare() { throw new Error(message); }, async batch() { writes++; } };
      const store = new f.api.MemberStore(broken, owner, NOW);
      await assert.rejects(store.saveConsent('email', true, acknowledged(f.api)), new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      await assert.rejects(store.consentHistory()); assert.equal(writes, 0);
    }
  } finally { f.close(); }
});

test('simultaneous same-clock consent changes stay monotonic and the final withdrawal disables alerts and erases phone', async () => {
  const f = await fixture();
  try {
    await f.store.saveConsent('sms', true, acknowledged(f.api));
    await f.store.savePreferences({ ...preferences, smsEnabled: true, phone: '+821012345678' });
    await Promise.all([f.store.saveConsent('email', true, acknowledged(f.api)), f.store.saveConsent('email', false, acknowledged(f.api)),
      f.store.saveConsent('sms', true, acknowledged(f.api)), f.store.saveConsent('sms', false, acknowledged(f.api))]);
    assert.deepEqual(await f.store.consents(), { email: false, sms: false });
    const rows = f.sql.prepare('SELECT occurred_at FROM notification_consents WHERE issuer=? AND subject=? ORDER BY occurred_at').all(owner.issuer, owner.subject);
    assert.equal(new Set(rows.map(row => row.occurred_at)).size, rows.length);
    const stored = f.sql.prepare('SELECT sms_enabled,phone_e164,phone_verified FROM notification_preferences').get();
    assert.equal(stored.sms_enabled, 0); assert.equal(stored.phone_e164, null); assert.equal(stored.phone_verified, 0);
  } finally { f.close(); }
});

test('cached or outdated notice versions never prevent withdrawal but cannot create a new grant', async () => {
  const f = await fixture();
  try {
    await f.store.saveConsent('sms', true, acknowledged(f.api));
    await f.store.savePreferences({ ...preferences, smsEnabled: true, phone: '+821012345678' });
    f.sql.prepare('INSERT INTO notification_deliveries(id,issuer,subject,channel,event_id,dedupe_key,status,created_at) VALUES(?,?,?,?,?,?,?,?)')
      .run('pending-fixture', owner.issuer, owner.subject, 'sms', 'fixture-event', 'fixture-key', 'queued', NOW);
    await assert.rejects(f.store.saveConsent('sms', true, { language: 'en', noticeVersion: 'outdated-version' }), error => error.status === 400);
    assert.equal((await f.store.consents()).sms, true);
    const result = await f.store.saveConsent('sms', false, { language: 'en', noticeVersion: 'outdated-version' });
    assert.equal(result.sms, false);
    const row = f.sql.prepare('SELECT sms_enabled,phone_e164 FROM notification_preferences').get();
    assert.equal(row.sms_enabled, 0); assert.equal(row.phone_e164, null);
    assert.equal(f.sql.prepare('SELECT status FROM notification_deliveries').get().status, 'canceled');
    const latest = (await f.store.consentHistory()).records[0];
    assert.equal(latest.granted, false); assert.equal(latest.noticeText, null); assert.equal(latest.contextCaptured, false);
  } finally { f.close(); }
});

test('a full watchlist can update existing entries and concurrent additions never exceed its owner limit', async () => {
  const f = await fixture();
  try {
    const insert = f.sql.prepare('INSERT INTO product_watchlists(id,issuer,subject,product_id,currency,created_at) VALUES(?,?,?,?,?,?)');
    for (let index = 0; index < 99; index++) insert.run('watch-' + index, owner.issuer, owner.subject, 'product-' + index, 'USD', NOW);
    const value = productId => ({ productId, currency: 'USD', targetPrice: null, brand: '', category: '' });
    const results = await Promise.allSettled([f.store.saveWatch(value('last-a')), f.store.saveWatch(value('last-b'))]);
    assert.equal(results.filter(row => row.status === 'fulfilled').length, 1);
    assert.equal(results.find(row => row.status === 'rejected').reason.code, 'watchlist_limit');
    assert.equal(f.sql.prepare('SELECT COUNT(*) AS count FROM product_watchlists WHERE issuer=? AND subject=?').get(owner.issuer, owner.subject).count, 100);
    await f.store.saveWatch({ ...value('product-0'), targetPrice: 19.99 });
    assert.equal(f.sql.prepare('SELECT target_price FROM product_watchlists WHERE issuer=? AND subject=? AND product_id=?').get(owner.issuer, owner.subject, 'product-0').target_price, 19.99);
    await f.otherStore.saveWatch(value('other-member-product'));
    assert.equal((await f.otherStore.watches()).length, 1);
  } finally { f.close(); }
});

test('preference writes re-evaluate consent atomically and cannot resurrect a withdrawn flag or contact', async () => {
  const f = await fixture();
  try {
    await f.store.saveConsent('email', true, acknowledged(f.api));
    await f.store.saveConsent('sms', true, acknowledged(f.api));
    await f.store.savePreferences({ ...preferences, emailEnabled: true, smsEnabled: true, phone: '+821012345678' });
    let fired = false;
    f.setHook(async query => {
      if (fired || !query.includes('INSERT INTO notification_preferences')) return;
      fired = true; await f.store.saveConsent('sms', false, acknowledged(f.api));
    });
    await assert.rejects(f.store.savePreferences({ ...preferences, smsEnabled: true, phone: '+821099999999' }), error => error.code === 'consent_required');
    let row = f.sql.prepare('SELECT sms_enabled,phone_e164 FROM notification_preferences').get();
    assert.equal(row.sms_enabled, 0); assert.equal(row.phone_e164, null);
    fired = false;
    f.setHook(async query => {
      if (fired || !query.includes('INSERT INTO notification_preferences')) return;
      fired = true; await f.store.saveConsent('email', false, acknowledged(f.api));
    });
    await f.store.savePreferences({ ...preferences, emailEnabled: true, smsEnabled: true });
    row = f.sql.prepare('SELECT email_enabled,sms_enabled,phone_e164 FROM notification_preferences').get();
    assert.equal(row.email_enabled, 0); assert.equal(row.sms_enabled, 0); assert.equal(row.phone_e164, null);
  } finally { f.close(); }
});

test('preview creation atomically checks current Premium and consent, including revocation before publishing', async () => {
  const f = await fixture();
  try {
    await f.store.saveConsent('email', true, acknowledged(f.api));
    let fired = false;
    f.setHook(query => {
      if (fired || !query.startsWith('INSERT INTO notification_deliveries')) return;
      fired = true; f.member(owner, { status: 'canceled' });
    });
    await assert.rejects(f.store.savePreview('email', { mode: 'DEMO', text: 'fixture only' }), error => error.code === 'premium_required');
    assert.equal(f.sql.prepare('SELECT COUNT(*) AS count FROM notification_deliveries').get().count, 0);
    f.member(); fired = false;
    f.setHook(async query => {
      if (fired || !query.startsWith('SELECT (SELECT granted')) return;
      fired = true; await f.store.saveConsent('email', false, acknowledged(f.api));
    });
    await assert.rejects(f.store.savePreview('email', { mode: 'DEMO', text: 'fixture only' }), error => error.code === 'consent_required');
    assert.equal(f.sql.prepare('SELECT status FROM notification_deliveries').get().status, 'canceled');
  } finally { f.close(); }
  const legacy = await fixture({ legacyContext: true, planColumn: false });
  try {
    // Historical proof may exist before plan migration; it is not permission
    // to create a new Premium-only grant without a verified plan_code.
    legacy.sql.prepare('INSERT INTO notification_consents(id,issuer,subject,channel,granted,policy_version,occurred_at) VALUES(?,?,?,?,?,?,?)')
      .run('historical-email', owner.issuer, owner.subject, 'email', 1, 'legacy-proof', NOW - 100);
    await assert.rejects(legacy.store.saveConsent('email', true), error => error.code === 'premium_required');
    await assert.rejects(legacy.store.savePreview('email', { mode: 'DEMO' }), error => error.code === 'premium_required');
    assert.equal(legacy.sql.prepare('SELECT COUNT(*) AS count FROM notification_deliveries').get().count, 0);
  } finally { legacy.close(); }
});
