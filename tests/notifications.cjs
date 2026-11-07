'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const modules = Promise.all([import('../server/notifications.mjs'), import('../server/notification-adapters.mjs'), import('../workers/price-monitor/worker.mjs')]);
const NOW = Date.UTC(2026, 10, 5, 9);
const owner = { issuer: 'https://members.example.test/', subject: 'member-1' };
const member = { ...owner, planCode: 'PREMIUM', subscriptionStatus: 'active', paidThrough: NOW + 86400000, paymentVerifiedAt: NOW - 1000 };
const prefs = { emailEnabled: true, smsEnabled: false, country: 'KR', timeZone: 'Asia/Seoul', language: 'ko', frequency: 'daily', brands: ['A1 DEMO'], categories: [] };
const consent = channel => ({ ...owner, channel, granted: true, grantedAt: NOW - 1000, version: 'demo-1' });
const watchlist = [{ ...owner, id: 'watch-1', productId: 'coat-1', targetPrice: { amount: 80, currency: 'USD' } }];
function event(overrides = {}) { return { id: 'event-1', type: 'price_drop', title: 'DEMO coat', brand: 'A1 DEMO', productId: 'coat-1',
  currentPrice: { amount: 70, currency: 'USD' }, previousPrice: { amount: 90, currency: 'USD' },
  checkedAt: NOW - 1000, demo: true, source: { mode: 'DEMO' }, ...overrides }; }
function context(overrides = {}) { return { member, preferences: prefs, consents: [consent('email'), consent('sms')], watchlist,
  email: 'verified@example.test', emailVerified: true, phone: '+821012345678', phoneVerified: true,
  messagesThisMonth: 0, costThisMonth: 0, estimatedUnitCost: 0.1, limits: { monthlyMessages: 10, monthlyCost: 1 }, ...overrides }; }
async function candidates(overrides = {}) { const [api] = await modules; return api.buildNotificationCandidates({ member, preferences: prefs,
  consents: [consent('email'), consent('sms')], watchlist, events: [event()], now: NOW, ...overrides }); }
function repository(current = context()) {
  const claimed = new Set(), logs = [];
  return { logs, claimed, async loadContext() { return typeof current === 'function' ? current() : current; },
    async claimDelivery(row) { if (claimed.has(row.idempotencyKey)) return false; claimed.add(row.idempotencyKey); return true; },
    async recordDelivery(row) { logs.push(row); } };
}

test('preferences default to no marketing consent and reject extra data or invalid choices', async () => {
  const [api] = await modules;
  const defaults = api.normalizeNotificationPreferences();
  assert.equal(defaults.emailEnabled, false); assert.equal(defaults.smsEnabled, false);
  for (const value of [{ photo: 'private' }, { paid: true }, { timeZone: 'not/a/zone' }, { language: 'xx' },
    { country: 'XX' }, { frequency: 'every-second' }, { brands: Array(21).fill('brand') }, { emailEnabled: 'true' }]) {
    assert.throws(() => api.normalizeNotificationPreferences(value), api.NotificationValidationError);
  }
  const original = { brands: ['Demo', 'Demo'], categories: ['coat'] };
  assert.deepEqual(api.normalizeNotificationPreferences(original).brands, ['Demo']);
  assert.deepEqual(original.brands, ['Demo', 'Demo']);
});

test('E.164 formatting never claims phone ownership verification', async () => {
  const [api] = await modules;
  assert.deepEqual(api.validateE164('+821012345678', 'KR'), { valid: true, normalized: '+821012345678', ownershipVerified: false });
  for (const phone of ['01012345678', '+82 10 1234', '+012345678', '+82123456789012345']) assert.equal(api.validateE164(phone, 'KR').valid, false);
  assert.equal(api.validateE164('+12125551234', 'KR').valid, false);
  for (const [country, prefix] of [['DE', '49'], ['FR', '33'], ['IT', '39'], ['ES', '34'], ['NL', '31']]) {
    assert.equal(api.normalizeNotificationPreferences({ country }).country, country);
    assert.equal(api.validateE164(`+${prefix}1234567890`, country).valid, true);
    assert.equal(api.validateE164('+821012345678', country).valid, false);
  }
});

test('FREE, GENERAL, legacy and expired/refunded/unverified paid records cannot produce premium alerts', async () => {
  for (const changed of [{ planCode: 'FREE' }, { planCode: 'GENERAL' }, { planCode: undefined }, { subscriptionStatus: 'canceled' },
    { subscriptionStatus: 'past_due' }, { subscriptionStatus: 'unpaid' }, { paidThrough: NOW }, { paymentVerifiedAt: null }]) {
    assert.deepEqual(await candidates({ member: { ...member, ...changed } }), []);
  }
  assert.equal((await candidates()).length, 1);
  assert.deepEqual(await candidates({ mode: 'LIVE' }), []);
});

test('email and SMS consent are separate, default off, and scoped to the same member', async () => {
  assert.deepEqual(await candidates({ consents: [] }), []);
  assert.deepEqual(await candidates({ consents: [{ ...consent('email'), subject: 'other-member' }] }), []);
  const onlyEmail = await candidates({ preferences: { ...prefs, smsEnabled: true }, consents: [consent('email')] });
  assert.deepEqual(onlyEmail.map(item => item.channel), ['email']);
  const withdrawn = { ...consent('email'), granted: false, revokedAt: NOW - 1 };
  assert.deepEqual(await candidates({ consents: [consent('email'), withdrawn] }), []);
  const nonOwnedWatchlist = [{ ...watchlist[0], subject: 'other-member' }];
  assert.deepEqual(await candidates({ watchlist: nonOwnedWatchlist, preferences: { ...prefs, brands: [] } }), []);
  assert.deepEqual(await candidates({ consents: [{ ...consent('email'), revokedAt: 'invalid' }] }), []);
  for (const records of [[consent('email'), { ...consent('email'), granted: false }],
    [{ ...consent('email'), granted: false }, consent('email')]]) {
    assert.deepEqual(await candidates({ consents: records }), []);
  }
});

test('only timely approved official data can be monitored; DEMO data stays dry-run', async () => {
  const official = { demo: false, verified: true, source: { kind: 'official_api', approved: true, maxAgeMs: 60000 } };
  assert.equal((await candidates({ events: [event(official)] })).length, 1);
  for (const change of [{ checkedAt: NOW - 60001 }, { verified: false }, { source: { kind: 'search_link', approved: true, maxAgeMs: 60000 } },
    { source: { kind: 'official_feed', approved: false, maxAgeMs: 60000 } }, { source: { kind: 'official_feed', approved: true } },
    { source: { kind: 'official_feed', approved: true, maxAgeMs: 60000, expiresAt: 'invalid' } },
    { source: { kind: 'official_feed', approved: true, maxAgeMs: 60000, expiresAt: NOW } }]) {
    assert.deepEqual(await candidates({ events: [event({ ...official, ...change })] }), []);
  }
});

test('candidate payloads discard photos, body analysis, recipient contacts and unrelated source fields', async () => {
  const rows = await candidates({ events: [event({ photo: 'sensitive-body-photo', analysis: { ratio: 'private-analysis' },
    recipient: 'private-recipient', currentPrice: { amount: 70, currency: 'USD', photo: 'private-price-photo' },
    source: { mode: 'DEMO', rawPhoto: 'private-source-photo', id: { photo: 'private-nested-photo' } } })] });
  assert.equal(rows.length, 1);
  const serialized = JSON.stringify(rows);
  for (const forbidden of ['sensitive-body-photo', 'private-analysis', 'private-recipient', 'private-price-photo', 'private-source-photo', 'private-nested-photo']) {
    assert.equal(serialized.includes(forbidden), false);
  }
  assert.deepEqual(rows[0].event.currentPrice, { amount: 70, currency: 'USD' });
});

test('price decrease, exact-currency target and active promotion conditions are evaluated', async () => {
  assert.deepEqual(await candidates({ events: [event({ currentPrice: { amount: 100, currency: 'USD' } })] }), []);
  assert.deepEqual(await candidates({ events: [event({ currentPrice: { amount: 70, currency: 'EUR' } })] }), []);
  assert.equal((await candidates({ events: [event({ type: 'target_reached' })] })).length, 1);
  assert.deepEqual(await candidates({ events: [event({ type: 'target_reached', currentPrice: { amount: 81, currency: 'USD' } })] }), []);
  for (const type of ['brand_promotion', 'promotion_start', 'promotion_ending']) {
    assert.equal((await candidates({ events: [event({ type, startsAt: NOW - 10000, endsAt: NOW + 30000 })] })).length, 1);
    assert.deepEqual(await candidates({ events: [event({ type, startsAt: NOW + 1000, endsAt: NOW + 30000 })] }), []);
    assert.deepEqual(await candidates({ events: [event({ type, startsAt: NOW - 10000, endsAt: NOW - 1 })] }), []);
  }
});

test('templates are explicitly DEMO, localized, plain text, and include preferences/opt-out links', async () => {
  const [api] = await modules;
  for (const channel of ['email', 'sms']) for (const language of ['ko', 'en']) {
    const preview = api.renderNotificationTemplate({ event: event(), channel, language });
    assert.equal(preview.mode, 'DRY_RUN'); assert.equal(preview.demo, true); assert.equal(preview.liveDeliveryEnabled, false);
    assert.match(preview.subject, /DEMO/); assert.match(preview.text, language === 'en' ? /unsubscribe/ : /수신 거부/);
    assert.ok(preview.text.includes(preview.unsubscribeUrl)); assert.equal(preview.html, undefined);
  }
  assert.throws(() => api.renderNotificationTemplate({ unsubscribeUrl: 'http://unsafe.test/' }));
});

test('idempotency keys are stable, private and separated by member/event/channel/window', async () => {
  const [api] = await modules; const candidate = (await candidates())[0];
  const key = await api.notificationDeliveryKey(candidate);
  assert.match(key, /^[a-f0-9]{64}$/); assert.equal(await api.notificationDeliveryKey(structuredClone(candidate)), key);
  for (const changed of [{ channel: 'sms' }, { window: 'next-day' }, { owner: { ...owner, subject: 'other' } }, { event: event({ id: 'event-2' }) }]) {
    assert.notEqual(await api.notificationDeliveryKey({ ...candidate, ...changed }), key);
  }
});

test('dry-run logging and claims prevent duplicate email and SMS deliveries', async () => {
  const [api] = await modules;
  const list = await candidates({ preferences: { ...prefs, smsEnabled: true } });
  const repo = repository(context({ preferences: { ...prefs, smsEnabled: true } }));
  const first = await api.processNotificationCandidates(list, { ...repo, now: NOW });
  assert.deepEqual(first.map(item => item.status), ['dry_run', 'dry_run']);
  const second = await api.processNotificationCandidates(list, { ...repo, now: NOW });
  assert.deepEqual(second.map(item => item.status), ['duplicate', 'duplicate']);
  assert.equal(repo.logs.length, 2); assert.ok(repo.logs.every(row => row.sent === false));
  assert.ok(first.every(row => !JSON.stringify(row).includes('verified@example.test')));
});

test('a consent withdrawal after queueing or during atomic claim immediately blocks delivery', async () => {
  const [api] = await modules; const list = await candidates();
  const before = repository(context({ consents: [] }));
  assert.equal((await api.processNotificationCandidates(list, { ...before, now: NOW }))[0].reason, 'consent-withdrawn');
  let reads = 0;
  const during = repository(() => ++reads === 1 ? context() : context({ consents: [] }));
  assert.equal((await api.processNotificationCandidates(list, { ...during, now: NOW }))[0].reason, 'consent-withdrawn');
  assert.equal(during.logs[0].status, 'blocked');
});

test('revoked premium, changed ownership, suppression, removed watches and unverified contacts are blocked', async () => {
  const [api] = await modules; const list = await candidates();
  for (const [changed, expected] of [
    [{ member: { ...member, subscriptionStatus: 'canceled' } }, 'premium-required'],
    [{ member: { ...member, subject: 'other' } }, 'owner-mismatch'],
    [{ suppressed: true }, 'recipient-suppressed'], [{ bounced: true }, 'recipient-suppressed'],
    [{ emailVerified: false }, 'verified-email-required'],
    [{ watchlist: [], preferences: { ...prefs, brands: [] } }, 'event-no-longer-eligible']
  ]) {
    const repo = repository(context(changed));
    assert.equal((await api.processNotificationCandidates(list, { ...repo, now: NOW }))[0].reason, expected);
    assert.equal(repo.logs.length, 0);
  }
});

test('unknown SMS costs, unverified phone, message caps and monthly budget cannot be assumed free', async () => {
  const [api] = await modules; const preferences = { ...prefs, emailEnabled: false, smsEnabled: true };
  const list = await candidates({ preferences });
  for (const [changed, expected] of [[{ phoneVerified: false }, 'verified-phone-required'],
    [{ estimatedUnitCost: undefined }, 'cost-unknown-or-limit'], [{ estimatedUnitCost: 2 }, 'cost-unknown-or-limit'],
    [{ messagesThisMonth: 10 }, 'volume-limit']]) {
    const repo = repository(context({ preferences, ...changed }));
    assert.equal((await api.processNotificationCandidates(list, { ...repo, now: NOW }))[0].reason, expected);
  }
});

test('daily and weekly summaries claim at most one dispatch per member/channel/local period', async () => {
  const [api] = await modules;
  for (const frequency of ['daily', 'weekly']) {
    const preferences = { ...prefs, frequency };
    const initial = await candidates({ preferences, events: [event(), event({ id: 'event-2' })] });
    const repo = repository(context({ preferences }));
    const first = await api.processNotificationCandidates(initial, { ...repo, now: NOW });
    assert.equal(first.length, 1); assert.equal(first[0].eventCount, 2);
    const later = await candidates({ preferences, events: [event({ id: 'event-3' })] });
    assert.equal((await api.processNotificationCandidates(later, { ...repo, now: NOW }))[0].status, 'duplicate');
  }
});

test('daily digest period uses the member timezone rather than the server UTC date', async () => {
  const now = Date.UTC(2026, 10, 5, 0, 30);
  const common = { member: { ...member, paidThrough: now + 86400000, paymentVerifiedAt: now - 1000 },
    now, events: [event({ checkedAt: now - 1000 })], consents: [{ ...consent('email'), grantedAt: now - 1000 }] };
  const seoul = await candidates({ ...common, preferences: { ...prefs, timeZone: 'Asia/Seoul' } });
  const losAngeles = await candidates({ ...common, preferences: { ...prefs, timeZone: 'America/Los_Angeles' } });
  assert.match(seoul[0].window, /2026-11-05$/);
  assert.match(losAngeles[0].window, /2026-11-04$/);
});

test('manual monitor only requests approved official fixtures and plans provider-specific retention without deleting', async () => {
  const [api, , worker] = await modules;
  const repo = repository(); let snapshotArguments;
  repo.loadSnapshot = async value => { snapshotArguments = value; return { marker: 'stored-fixture' }; };
  const result = await worker.runMonitor({ operatorAuthorized: true, now: NOW, repository: repo,
    sources: [{ id: 'approved-feed', kind: 'official_feed', approved: true, retentionMs: 86400000 },
      { id: 'search-only', kind: 'search_link', approved: true, retentionMs: 500 },
      { id: 'not-approved', kind: 'official_api', approved: false },
      { id: 'live-disabled-by-default', kind: 'official_api', approved: true, liveEnabled: true }],
    buildCandidates: async (snapshot, options) => {
      assert.deepEqual(snapshot, { marker: 'stored-fixture' });
      assert.deepEqual(options, { mode: 'DRY_RUN', now: NOW });
      return candidates();
    } });
  assert.deepEqual(snapshotArguments, { sourceIds: ['approved-feed'], now: NOW });
  assert.equal(result.mode, 'MANUAL_DRY_RUN'); assert.equal(result.status, 'completed');
  assert.deepEqual(result.cleanupPlan, [{ sourceId: 'approved-feed', before: NOW - 86400000 }]);
  assert.equal(result.results[0].status, 'dry_run'); assert.equal(result.results[0].sent, false);
  assert.equal(repo.logs.length, 1);
  await assert.rejects(worker.runMonitor({ operatorAuthorized: true, sources: Array(21).fill({}), repository: repo, buildCandidates: async () => [] }));
  assert.equal(typeof api.processNotificationCandidates, 'function');
});

test('live delivery stays impossible even with keys and flags; public monitor and Cron remain disabled', async () => {
  const [api, adapters, worker] = await modules;
  let fetches = 0; const savedFetch = globalThis.fetch; globalThis.fetch = async () => { fetches++; throw new Error('No network expected'); };
  try {
    const env = { EMAIL_PROVIDER: 'configured', EMAIL_API_KEY: 'test-key', SMS_PROVIDER: 'configured', SMS_API_KEY: 'test-key', LIVE_ENABLED: 'true' };
    assert.equal(adapters.deliveryAdapterStatus(env).liveEnabled, false);
    assert.equal((await adapters.deliverNotification({ channel: 'sms' }, { mode: 'LIVE', env })).reason, 'live-delivery-disabled');
    assert.equal((await api.processNotificationCandidates(await candidates(), { mode: 'LIVE' }))[0].reason, 'live-delivery-disabled');
    assert.equal((await worker.default.fetch()).status, 503); assert.equal(worker.default.scheduled, undefined);
    assert.equal((await worker.runMonitor()).reason, 'operator-authorization-required');
    assert.equal(fetches, 0);
  } finally { globalThis.fetch = savedFetch; }
});
