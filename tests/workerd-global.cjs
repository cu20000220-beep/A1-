'use strict';

// Actual Cloudflare workerd + local D1 integration. Only a local, ephemeral
// schema and verified membership fixtures are created. The only outbound
// destination is intercepted JWKS; no production API, DB, payment or message.
const assert = require('node:assert/strict');
const { generateKeyPairSync, sign } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { resolve, join } = require('node:path');

function dependency(name) {
  return require(process.env.A1_WORKER_TOOLS_ROOT ? join(process.env.A1_WORKER_TOOLS_ROOT, name) : name);
}
const { Miniflare, convertV4MiniflareOptions } = dependency('miniflare');
const { build } = dependency('esbuild');
const root = resolve(__dirname, '..');
const origin = 'https://a1fashion.pages.dev';
const issuer = 'https://global-workerd-auth.example.test/';
const audience = 'a1-global-workerd-fixture';
const jwksUrl = issuer + 'keys';
const now = Date.now();
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'local-global-workerd', alg: 'RS256', use: 'sig' };
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
function token(subject, claims = {}) {
  const value = `${encode({ alg: 'RS256', kid: jwk.kid })}.${encode({ iss: issuer, aud: audience,
    sub: subject, iat: Math.floor(now / 1000) - 1, exp: Math.floor(now / 1000) + 3600, ...claims })}`;
  return `${value}.${sign('RSA-SHA256', Buffer.from(value), privateKey).toString('base64url')}`;
}
const outbound = [];
async function provider(request) {
  outbound.push(request.url);
  // Every unexpected destination fails here instead of contacting the network.
  assert.equal(request.url, jwksUrl, 'No product, payment, email or SMS service may be contacted');
  assert.equal(request.method, 'GET');
  return Response.json({ keys: [jwk] });
}

(async () => {
  const bundled = await build({ stdin: { contents: `
    import { handleGlobalRequest } from './functions/api/global/_shared.js';
    export default { fetch(request, env) {
      return handleGlobalRequest(new URL(request.url).pathname.split('/').at(-1),
        { request, env }, { now: ${now} });
    }};
  `, resolveDir: root, sourcefile: 'workerd-global-fixture-entry.mjs' }, bundle: true, write: false,
    format: 'esm', platform: 'browser', target: 'es2022' });
  const options = { modules: true, script: bundled.outputFiles[0].text, compatibilityDate: '2026-11-05',
    bindings: { AUTH_ISSUER: issuer, AUTH_AUDIENCE: audience, AUTH_JWKS_URL: jwksUrl },
    d1Databases: { MEMBERSHIP_DB: 'local-global-platform-only' }, outboundService: provider };
  const mf = new Miniflare(convertV4MiniflareOptions ? convertV4MiniflareOptions(options) : options);
  try {
    const db = await mf.getD1Database('MEMBERSHIP_DB');
    const schema = readFileSync(join(root, 'server/schema.sql'), 'utf8').replace(/^\s*--.*$/gm, '');
    // The checked-in schema has no semicolons inside SQL string literals.
    for (const sql of schema.split(';').map(value => value.trim()).filter(Boolean)) await db.prepare(sql).run();
    async function member(subject, plan = 'GENERAL', status = 'active', expiry = now + 3600000) {
      await db.prepare('INSERT OR REPLACE INTO memberships (issuer,subject,subscription_status,plan_code,paid_through,payment_verified_at) VALUES (?,?,?,?,?,?)')
        .bind(issuer, subject, status, plan, expiry, now - 10000).run();
    }
    async function call(resource, { subject = 'premium', method = 'GET', body, requestOrigin = origin,
      authenticated = true, credential, language = 'en' } = {}) {
      const response = await mf.dispatchFetch(`${origin}/api/global/${resource}`, { method,
        headers: { 'Accept-Language': language,
          ...(authenticated ? { Authorization: `Bearer ${credential || token(subject)}` } : {}),
          ...(method !== 'GET' ? { Origin: requestOrigin, 'Content-Type': 'application/json' } : {}) },
        ...(method !== 'GET' ? { body: JSON.stringify(body ?? {}) } : {}) });
      assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
      assert.equal(response.headers.get('Content-Language'), language);
      const value = await response.json();
      assert.ok(!JSON.stringify(value).includes(issuer), 'Issuer/subject internals must not be serialized');
      return { status: response.status, value, headers: response.headers };
    }
    const comparison = { productId: 'demo-tee', destination: 'US', currency: 'USD' };
    const search = { country: 'US', destination: 'KR', currency: 'USD', query: 'linen shirt' };
    assert.equal((await call('retailers', { authenticated: false, method: 'POST', body: search })).status, 401);
    assert.equal((await call('account', { subject: 'free' })).value.plan, 'FREE');
    assert.equal((await call('retailers', { subject: 'free', method: 'POST', body: search })).status, 403);
    assert.equal((await call('comparison', { subject: 'free', method: 'POST', body: comparison,
      credential: token('free', { plan: 'PREMIUM', paid: true }) })).status, 403, 'Signed identity claims cannot grant database entitlements');
    const unsigned = token('free').split('.');
    unsigned[1] = encode({ iss: issuer, aud: audience, sub: 'premium', exp: Math.floor(now / 1000) + 3600 });
    assert.equal((await call('account', { credential: unsigned.join('.') })).status, 401, 'A tampered subject must fail real RSA verification');

    await member('general'); await member('other'); await member('premium', 'PREMIUM');
    const stores = await call('retailers', { subject: 'general', method: 'POST', body: search });
    assert.equal(stores.status, 200); assert.equal(stores.value.mode, 'search-links-only');
    assert.ok(stores.value.retailers.length > 0);
    assert.ok(stores.value.retailers.every(store => store.integrationStatus === 'search-only'));
    assert.equal((await call('comparison', { subject: 'general', method: 'POST', body: comparison })).status, 403);
    for (const currency of ['KRW', 'USD', 'EUR', 'GBP', 'JPY']) {
      const result = await call('comparison', { method: 'POST', body: { ...comparison, currency } });
      assert.equal(result.status, 200); assert.equal(result.value.currency, currency);
      assert.match(result.value.demoNotice, /fictional DEMO/);
      assert.ok(result.value.results.every(offer => offer.productUrl === null), 'DEMO does not expose fictional purchase URLs');
      assert.ok(result.value.similarOffers.some(offer => offer.size === 'L'));
      assert.ok(!['demo-jp-unknown', 'demo-eu-old', 'demo-us-size-l'].includes(result.value.lowestOfferId));
    }
    for (const status of ['canceled', 'past_due', 'unpaid']) {
      await member(status, 'PREMIUM', status);
      assert.equal((await call('comparison', { subject: status, method: 'POST', body: comparison })).status, 403);
    }
    await member('expired', 'PREMIUM', 'active', now - 1);
    assert.equal((await call('comparison', { subject: 'expired', method: 'POST', body: comparison })).status, 403);

    const watch = await call('watchlist', { subject: 'general', method: 'POST', body: { productId: 'demo-tee', currency: 'USD' } });
    assert.equal(watch.status, 201); const watchId = watch.value.items[0].id;
    assert.equal((await call('watchlist', { subject: 'other' })).value.items.length, 0);
    assert.equal((await call('watchlist', { subject: 'other', method: 'DELETE', body: { id: watchId } })).status, 200);
    assert.equal((await call('watchlist', { subject: 'general' })).value.items.length, 1, 'Another owner cannot delete a known watch ID');
    assert.equal((await call('watchlist', { subject: 'general', method: 'POST', body: { productId: 'demo-tee', currency: 'USD', targetPrice: 30 } })).status, 403);
    assert.equal((await call('watchlist', { method: 'POST', body: { productId: 'demo-tee', currency: 'USD', targetPrice: 30 } })).status, 201);
    assert.equal((await call('watchlist', { method: 'POST', body: { productId: 'demo-tee', currency: 'USD', subject: 'other' } })).status, 400);
    assert.equal((await call('consents', { method: 'POST', requestOrigin: 'https://attacker.example.test', body: { channel: 'email', granted: true } })).status, 403);

    const prefs = { country: 'US', timeZone: 'America/New_York', language: 'en', frequency: 'daily',
      emailEnabled: true, smsEnabled: false, brands: ['A1 DEMO'], categories: ['tops'] };
    assert.equal((await call('preview', { method: 'POST', body: { channel: 'email' } })).status, 403);
    const noConsent = await call('preferences', { method: 'PUT', body: prefs });
    assert.equal(noConsent.status, 200); assert.equal(noConsent.value.preferences.emailEnabled, false);
    const granted = await call('consents', { method: 'POST', body: { channel: 'email', granted: true } });
    assert.equal(granted.status, 200); assert.equal(granted.value.consents.sms, false);
    assert.equal((await call('preferences', { method: 'PUT', body: prefs })).value.preferences.emailEnabled, true);
    const previews = await Promise.all(Array.from({ length: 3 }, () => call('preview', { method: 'POST', body: { channel: 'email' } })));
    for (const preview of previews) {
      assert.equal(preview.status, 200); assert.equal(preview.value.mode, 'DRY_RUN'); assert.equal(preview.value.sent, false);
      assert.match(preview.value.template.text, /unsubscribe/);
    }
    assert.equal((await call('history')).value.deliveries.length, 1, 'Concurrent D1 writes deduplicate email previews');
    assert.equal((await call('history', { subject: 'other' })).value.deliveries.length, 0);
    assert.equal((await call('preview', { method: 'POST', body: { channel: 'sms' } })).status, 403);
    await call('consents', { method: 'POST', body: { channel: 'sms', granted: true } });
    const phone = await call('preferences', { method: 'PUT', body: { ...prefs, smsEnabled: true, phone: '+12025550123' } });
    assert.equal(phone.status, 200); assert.equal(phone.value.preferences.phoneVerified, false);
    assert.ok(!JSON.stringify(phone.value).includes('+12025550123'));
    for (let i = 0; i < 2; i++) assert.equal((await call('preview', { method: 'POST', body: { channel: 'sms' } })).value.sent, false);
    const deliveryCount = await db.prepare('SELECT COUNT(*) AS n FROM notification_deliveries WHERE issuer = ? AND subject = ?').bind(issuer, 'premium').first();
    assert.equal(deliveryCount.n, 2, 'Email and SMS each retain one deduped mock record');

    const windowStart = Math.floor(now / 3600000) * 3600000;
    await db.prepare('UPDATE api_rate_limits SET request_count = 60 WHERE issuer = ? AND subject = ? AND window_start = ?')
      .bind(issuer, 'premium', windowStart).run();
    const limited = await call('preferences'); assert.equal(limited.status, 429); assert.equal(limited.headers.get('Retry-After'), '3600');
    assert.equal((await call('retailers', { method: 'POST', body: search })).status, 429);
    assert.equal((await call('preferences', { subject: 'other' })).status, 200, 'Another member has an independent SQL quota');
    await member('premium', 'PREMIUM', 'active', now - 1);
    assert.equal((await call('comparison', { method: 'POST', body: comparison })).status, 403);
    assert.equal((await call('consents', { method: 'POST', body: { channel: 'email', granted: true } })).status, 403);
    const withdrawn = await call('consents', { method: 'POST', body: { channel: 'email', granted: false } });
    assert.equal(withdrawn.status, 200); assert.equal(withdrawn.value.consents.email, false, 'Withdrawal works after expiry and quota exhaustion');
    assert.equal((await db.prepare('SELECT status FROM notification_deliveries WHERE issuer = ? AND subject = ? AND channel = ?')
      .bind(issuer, 'premium', 'email').first()).status, 'canceled');
    assert.equal((await call('history', { method: 'DELETE', body: {} })).status, 200);
    const erased = await db.prepare('SELECT status,payload_json FROM notification_deliveries WHERE issuer = ? AND subject = ?')
      .bind(issuer, 'premium').all();
    assert.ok(erased.results.every(row => row.status === 'deleted' && row.payload_json === '{}'));
    assert.equal((await call('preferences', { method: 'DELETE', body: {} })).status, 200);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM notification_preferences WHERE issuer = ? AND subject = ?').bind(issuer, 'premium').first()).n, 0);
    const tombstones = await db.prepare('SELECT granted FROM notification_consents WHERE issuer = ? AND subject = ?').bind(issuer, 'premium').all();
    assert.equal(tombstones.results.length, 2); assert.ok(tombstones.results.every(row => row.granted === 0));
    assert.equal((await call('watchlist', { method: 'DELETE', body: { id: (await db.prepare('SELECT id FROM product_watchlists WHERE issuer = ? AND subject = ?').bind(issuer, 'premium').first()).id } })).status, 200);
    assert.equal((await call('watchlist', { subject: 'general' })).value.items.length, 1);
    assert.ok(outbound.length > 0); assert.ok(outbound.every(url => url === jwksUrl));
    console.log('Workerd global passed: real RSA auth + actual local D1 SQL, tier/expiry denial, five-currency DEMO comparison, owner isolation, separate consent, concurrent preview dedupe, phone masking, quotas, expired-member withdrawal/erasure. Only local JWKS fixtures; no live products, payment, email or SMS.');
  } finally { await mf.dispose(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
