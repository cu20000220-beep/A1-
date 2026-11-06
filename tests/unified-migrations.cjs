'use strict';
// Local SQLite only. No operational database, account or provider is contacted.
const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { readFileSync, readdirSync } = require('node:fs');
const { resolve } = require('node:path');
const root = resolve(__dirname, '..');
const migration = name => readFileSync(resolve(root, 'server/migrations', name), 'utf8');

test('unified 0001→0002→0003→0004 migrations preserve members, watches and historical consents without creating paid access or usage', () => {
  const files = readdirSync(resolve(root, 'server/migrations')).filter(name => /^\d{4}_.+\.sql$/.test(name)).sort();
  assert.deepEqual(files, ['0001_membership_tiers.sql', '0002_global_catalog_and_alerts.sql',
    '0003_global_consent_context.sql', '0004_ai_stylist_usage.sql']);
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`CREATE TABLE memberships(issuer TEXT NOT NULL, subject TEXT NOT NULL,
      subscription_status TEXT NOT NULL DEFAULT 'inactive', paid_through INTEGER,
      payment_verified_at INTEGER, PRIMARY KEY(issuer,subject)) STRICT;`);
    const members = [['https://legacy.fixture/', 'one', 'active', 2000, 1000],
      ['https://legacy.fixture/', 'two', 'canceled', 1900, 1000]];
    for (const row of members) db.prepare('INSERT INTO memberships VALUES(?,?,?,?,?)').run(...row);
    db.exec(migration(files[0])); db.exec(migration(files[1]));
    db.exec(`INSERT INTO product_watchlists(id,issuer,subject,product_id,target_price,currency,created_at)
      VALUES('watch-one','https://legacy.fixture/','one','product-one',99.99,'USD',1);
      INSERT INTO notification_preferences(issuer,subject,updated_at)
      VALUES('https://legacy.fixture/','one',1);
      INSERT INTO notification_consents(id,issuer,subject,channel,granted,policy_version,occurred_at)
      VALUES('old-consent','https://legacy.fixture/','one','email',1,'old-version',1);`);
    const watches = db.prepare('SELECT * FROM product_watchlists').all();
    const prefs = db.prepare('SELECT * FROM notification_preferences').all();
    db.exec(migration(files[2])); db.exec(migration(files[3]));
    assert.deepEqual(db.prepare('SELECT issuer,subject,subscription_status,paid_through,payment_verified_at FROM memberships ORDER BY subject').all().map(Object.values), members);
    assert.deepEqual(db.prepare('SELECT plan_code FROM memberships').all().map(row => row.plan_code), ['GENERAL', 'GENERAL']);
    assert.equal(db.prepare("SELECT count(*) AS n FROM memberships WHERE plan_code='PREMIUM'").get().n, 0);
    assert.deepEqual(db.prepare('SELECT * FROM product_watchlists').all(), watches);
    assert.deepEqual(db.prepare('SELECT * FROM notification_preferences').all(), prefs);
    const old = db.prepare('SELECT * FROM notification_consents WHERE id=?').get('old-consent');
    assert.equal(old.granted, 1); assert.equal(old.policy_version, 'old-version');
    assert.equal(old.country, null); assert.equal(old.language, null); assert.equal(old.notice_text, null);
    for (const table of ['ai_usage_buckets', 'ai_usage_reservations']) assert.equal(db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n, 0);
    const trigger = db.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' AND name='ai_usage_reservation_counters'").get();
    assert.match(trigger.sql, /global_day/); assert.match(trigger.sql, /global_month/); assert.match(trigger.sql, /user_day/);
    assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    // AI's CREATE-only migration can safely be re-read; ALTER migrations still
    // require the operator's application ledger and must never be replayed.
    db.exec(migration(files[3]));
    assert.equal(db.prepare('SELECT count(*) AS n FROM memberships').get().n, 2);
  } finally { db.close(); }
});
