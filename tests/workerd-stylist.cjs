'use strict';

// Actual workerd + actual ephemeral D1 integration. JWT keys, memberships and
// Responses API output are local fixtures. outboundService intercepts EVERY
// request; no OpenAI, Firebase, supplier, message or operational DB is contacted.
const assert = require('node:assert/strict');
const { generateKeyPairSync, sign } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { resolve, join } = require('node:path');

function dependency(name) {
  return require(process.env.A1_WORKER_TOOLS_ROOT ? join(process.env.A1_WORKER_TOOLS_ROOT, name) : name);
}
const { Miniflare, convertV4MiniflareOptions } = dependency('miniflare');
const { build } = dependency('esbuild');
const root = resolve(__dirname, '..');
const origin = 'https://a1fashion.pages.dev';
const issuer = 'https://stylist-workerd-auth.example.test/';
const audience = 'a1-stylist-workerd-fixture';
const jwksUrl = issuer + 'keys';
const endpoint = 'https://api.openai.com/v1/responses';
const now = Date.now();
const fixtureKey = 'sk-fixture-workerd-stylist-never-real-123456789';
const liveSettings = {
  A1_AI_MODE: 'live', A1_AI_LIVE_APPROVED: 'true', A1_AI_MODEL: 'gpt-4.1-mini-2025-04-14', OPENAI_API_KEY: fixtureKey,
  A1_AI_DAILY_USER_LIMIT: '10', A1_AI_DAILY_BUDGET_MICRO_USD: '10000000', A1_AI_MONTHLY_BUDGET_MICRO_USD: '100000000',
  A1_AI_INPUT_MICRO_USD_PER_MILLION_TOKENS: '1000000', A1_AI_OUTPUT_MICRO_USD_PER_MILLION_TOKENS: '2000000'
};
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'local-stylist-workerd', alg: 'RS256', use: 'sig' };
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
function token(subject, claims = {}) {
  const value = `${encode({ alg: 'RS256', kid: jwk.kid })}.${encode({ iss: issuer, aud: audience,
    sub: subject, iat: Math.floor(now / 1000) - 1, exp: Math.floor(now / 1000) + 3600, ...claims })}`;
  return `${value}.${sign('RSA-SHA256', Buffer.from(value), privateKey).toString('base64url')}`;
}
function input(overrides = {}) {
  return { message: 'Suggest a casual outfit.', language: 'en', intent: 'style',
    preferences: { gender: 'unisex', style: 'casual', budget: 70, currency: 'USD', destination: 'US', category: 'tops' },
    history: [], consents: { externalAI: false, analysis: false }, ...overrides };
}
const outbound = [], providerBodies = [];
async function provider(request) {
  outbound.push(request.url);
  if (request.url === jwksUrl) {
    assert.equal(request.method, 'GET'); return Response.json({ keys: [jwk] });
  }
  assert.equal(request.url, endpoint, 'Unexpected requests must fail locally, never reach an external service');
  assert.equal(request.method, 'POST'); assert.equal(request.headers.get('Authorization'), `Bearer ${fixtureKey}`);
  const body = await request.json(); providerBodies.push(body);
  assert.equal(body.store, false); assert.equal(body.model, liveSettings.A1_AI_MODEL); assert.equal(body.max_output_tokens, 600);
  assert.equal(body.tools, undefined); assert.equal(body.previous_response_id, undefined); assert.equal(body.truncation, 'disabled');
  assert.equal(body.input.length, 1); assert.equal(body.input[0].role, 'user'); assert.equal(body.input[0].content.length, 1);
  assert.equal(body.input[0].content[0].type, 'input_text'); assert.equal(body.text.format.strict, true);
  const data = JSON.parse(body.input[0].content[0].text);
  assert.deepEqual(data.verifiedProducts, [], 'No approved real feed is enabled in this fixture');
  assert.equal(data.consentedPhotoRatios, undefined);
  assert.doesNotMatch(JSON.stringify(body), /input_image|image_url|data:image|base64|workerd-live-private-member|workerd-error-private-member|@example\.test|eyJhbGci/);
  assert.ok(!JSON.stringify(body).includes(issuer), 'Authenticated member identity is never added to the provider payload');
  if (data.untrustedUserMessage === 'provider-failure-fixture') return Response.json({ error: { message: 'private fixture failure' } }, { status: 500 });
  const plan = { scope: 'fashion', topic: 'outfit', adviceIds: ['outfit_casual', 'fit_comfort'], productIds: [], followUp: 'occasion' };
  if (data.untrustedUserMessage === 'ungrounded-response-fixture') plan.productIds = ['invented-product-do-not-publish'];
  return Response.json({ status: 'completed', output: [{ type: 'message', role: 'assistant', status: 'completed',
    content: [{ type: 'output_text', text: JSON.stringify(plan) }] }], usage: { input_tokens: 120, output_tokens: 40 } });
}

// sqlite3.complete_statement recognizes the entire CREATE TRIGGER ... BEGIN
// ... END; body. Splitting blindly on semicolons would corrupt this migration.
function schemaStatements() {
  return JSON.parse(execFileSync('python3', ['-c', String.raw`
import json,pathlib,sqlite3,sys
statements=[]
for name in sys.argv[1:]:
 pending=''
 for line in pathlib.Path(name).read_text().splitlines(True):
  pending+=line
  if sqlite3.complete_statement(pending):
   statements.append(pending);pending=''
 if pending.strip() and any(not line.lstrip().startswith('--') for line in pending.splitlines()):
  raise ValueError('Incomplete SQL migration')
print(json.dumps(statements))
`, join(root, 'server/schema.sql'), join(root, 'server/migrations/0003_ai_stylist_usage.sql')], { encoding: 'utf8' }));
}

(async () => {
  const bundled = await build({ stdin: { contents: `
    import { handleStylistRequest } from './server/ai-stylist.mjs';
    const live = ${JSON.stringify(liveSettings)};
    // Scenario configuration exists ONLY in this test wrapper. The production
    // handler never accepts browser-selected live flags, budgets or models.
    const scenarios = {
      demo: {}, keyonly: { OPENAI_API_KEY: live.OPENAI_API_KEY },
      unavailable: { ...live, OPENAI_API_KEY: undefined }, live,
      one: { ...live, A1_AI_DAILY_USER_LIMIT: '1' },
      underfunded: { ...live, A1_AI_DAILY_BUDGET_MICRO_USD: '1' }
    };
    export default { fetch(request, env) {
      const scenario = new URL(request.url).pathname.split('/')[1];
      if (!Object.hasOwn(scenarios, scenario)) return new Response(null, { status: 404 });
      return handleStylistRequest({ request, env: { ...env, ...scenarios[scenario] } }, { now: ${now} });
    }};
  `, resolveDir: root, sourcefile: 'workerd-stylist-fixture-entry.mjs' }, bundle: true, write: false,
    format: 'esm', platform: 'browser', target: 'es2022' });
  const options = { modules: true, script: bundled.outputFiles[0].text, compatibilityDate: '2026-11-05',
    bindings: { AUTH_ISSUER: issuer, AUTH_AUDIENCE: audience, AUTH_JWKS_URL: jwksUrl },
    d1Databases: { MEMBERSHIP_DB: 'local-stylist-usage-only' }, outboundService: provider };
  const mf = new Miniflare(convertV4MiniflareOptions ? convertV4MiniflareOptions(options) : options);
  try {
    const db = await mf.getD1Database('MEMBERSHIP_DB');
    for (const sql of schemaStatements()) await db.prepare(sql).run();
    const trigger = await db.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' AND name='ai_usage_reservation_counters'").first();
    assert.match(trigger.sql, /global_month/); assert.match(trigger.sql, /user_day/);
    async function member(subject, plan = 'GENERAL', status = 'active', expiry = now + 3600000) {
      await db.prepare('INSERT OR REPLACE INTO memberships (issuer,subject,subscription_status,plan_code,paid_through,payment_verified_at) VALUES (?,?,?,?,?,?)')
        .bind(issuer, subject, status, plan, expiry, now - 10000).run();
    }
    async function call(scenario, { subject = 'general', method = 'POST', body = input(), requestOrigin = origin,
      authenticated = true, credential } = {}) {
      const response = await mf.dispatchFetch(`${origin}/${scenario}/api/stylist`, { method,
        headers: { 'Accept-Language': 'en', ...(authenticated ? { Authorization: `Bearer ${credential || token(subject)}` } : {}),
          ...(method === 'POST' ? { Origin: requestOrigin, 'Content-Type': 'application/json' } : {}) },
        ...(method === 'POST' ? { body: JSON.stringify(body) } : {}) });
      assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
      const value = await response.json(), serialized = JSON.stringify(value);
      assert.ok(!serialized.includes(issuer) && !serialized.includes(fixtureKey), 'API responses never expose identities or keys');
      return { status: response.status, value };
    }
    const reservations = () => db.prepare('SELECT * FROM ai_usage_reservations ORDER BY created_at,request_id').all();
    await member('general'); await member('premium', 'PREMIUM');
    const publicConfig = await call('demo', { method: 'GET', authenticated: false });
    assert.equal(publicConfig.status, 200); assert.equal(publicConfig.value.mode, 'DEMO'); assert.equal(publicConfig.value.photoUploads, false);
    assert.equal((await call('demo', { authenticated: false })).status, 401);
    assert.equal((await call('demo', { subject: 'free', credential: token('free', { plan: 'PREMIUM', paid: true }) })).status, 403);
    const demo = await call('demo'); assert.equal(demo.status, 200); assert.equal(demo.value.mode, 'DEMO');
    assert.deepEqual(demo.value.products, []); assert.equal(demo.value.usage, null); assert.ok(demo.value.searchLinks.length > 0);
    assert.equal((await call('demo', { body: input({ intent: 'compare' }) })).status, 403);
    assert.equal((await call('demo', { body: input({ intent: 'discount' }) })).status, 403);
    assert.equal((await call('demo', { subject: 'premium', body: input({ intent: 'compare' }) })).status, 200);
    assert.equal((await call('keyonly')).value.mode, 'DEMO', 'An API key alone cannot activate paid provider calls');
    assert.equal((await call('unavailable', { body: input({ consents: { externalAI: true, analysis: false } }) })).status, 503);
    assert.equal((await call('live')).status, 409, 'Explicit external text consent is required before any provider request');
    assert.equal(providerBodies.length, 0); assert.equal((await reservations()).results.length, 0);

    const tampered = token('free').split('.'); tampered[1] = encode({ iss: issuer, aud: audience, sub: 'premium', exp: Math.floor(now / 1000) + 3600 });
    assert.equal((await call('demo', { credential: tampered.join('.') })).status, 401);
    for (const status of ['canceled', 'past_due', 'unpaid']) {
      await member(status, 'PREMIUM', status); assert.equal((await call('live', { subject: status })).status, 403);
    }
    await member('expired', 'PREMIUM', 'active', now - 1); assert.equal((await call('live', { subject: 'expired' })).status, 403);
    assert.equal((await call('live', { requestOrigin: 'https://attacker.example.test' })).status, 403);
    assert.equal((await call('live', { body: { ...input(), photo: 'data:image/jpeg;base64,private' } })).status, 400);
    assert.equal(providerBodies.length, 0);

    await member('workerd-live-private-member');
    const consented = input({ consents: { externalAI: true, analysis: false } });
    const live = await call('live', { subject: 'workerd-live-private-member', body: consented });
    assert.equal(live.status, 200); assert.equal(live.value.mode, 'LIVE'); assert.ok(live.value.usage.reservedMicroUsd > 0);
    assert.deepEqual(live.value.products, []); assert.deepEqual(live.value.discounts, []); assert.equal(live.value.comparison, null);
    assert.equal(providerBodies.length, 1); assert.ok(live.value.advice.length > 0);
    let rows = (await reservations()).results;
    assert.equal(rows.length, 1); assert.equal(rows[0].state, 'succeeded');
    assert.equal(rows[0].actual_input_tokens, 120); assert.equal(rows[0].actual_output_tokens, 40);
    assert.equal(rows[0].reserved_micro_usd, live.value.usage.reservedMicroUsd);
    assert.doesNotMatch(JSON.stringify(rows), /workerd-live-private-member|Suggest a casual outfit|shoulderHipRatio|sk-fixture|@example\.test/);
    const bucketRows = (await db.prepare('SELECT * FROM ai_usage_buckets').all()).results;
    assert.equal(bucketRows.length, 3); assert.ok(bucketRows.every(row => row.request_count === 1 && row.reserved_micro_usd === rows[0].reserved_micro_usd));

    await member('workerd-error-private-member');
    const beforeFailure = providerBodies.length;
    const failed = await call('one', { subject: 'workerd-error-private-member', body: input({ message: 'provider-failure-fixture', consents: { externalAI: true, analysis: false } }) });
    assert.equal(failed.status, 503); assert.equal(providerBodies.length, beforeFailure + 1, 'An error does not automatically retry the billed provider');
    rows = (await reservations()).results; assert.equal(rows.length, 2); assert.ok(rows.some(row => row.state === 'uncertain'));
    const reservedAfterFailure = (await db.prepare("SELECT reserved_micro_usd FROM ai_usage_buckets WHERE scope='global_day'").first()).reserved_micro_usd;
    const retry = await call('one', { subject: 'workerd-error-private-member', body: consented });
    assert.equal(retry.status, 429); assert.equal(providerBodies.length, beforeFailure + 1, 'Potentially billed failures retain their user quota');
    assert.equal((await db.prepare("SELECT reserved_micro_usd FROM ai_usage_buckets WHERE scope='global_day'").first()).reserved_micro_usd, reservedAfterFailure);

    await member('hallucination');
    const invalid = await call('live', { subject: 'hallucination', body: input({ message: 'ungrounded-response-fixture', consents: { externalAI: true, analysis: false } }) });
    assert.equal(invalid.status, 502); assert.ok(!JSON.stringify(invalid.value).includes('invented-product-do-not-publish'));

    await member('underfunded'); const beforeCap = providerBodies.length, beforeRows = (await reservations()).results.length;
    assert.equal((await call('underfunded', { subject: 'underfunded', body: consented })).status, 429);
    assert.equal(providerBodies.length, beforeCap); assert.equal((await reservations()).results.length, beforeRows, 'Global cost failure cannot reserve or call');
    await member('concurrent');
    const concurrent = await Promise.all(Array.from({ length: 4 }, () => call('one', { subject: 'concurrent', body: consented })));
    assert.deepEqual(concurrent.map(row => row.status).sort(), [200, 429, 429, 429]);
    assert.equal(providerBodies.length, beforeCap + 1, 'The actual D1 transaction admits one concurrent provider call');
    const totals = (await db.prepare('SELECT SUM(reserved_micro_usd) AS total,COUNT(*) AS n FROM ai_usage_reservations').first());
    const day = await db.prepare("SELECT reserved_micro_usd,request_count FROM ai_usage_buckets WHERE scope='global_day'").first();
    assert.equal(day.reserved_micro_usd, totals.total); assert.equal(day.request_count, totals.n);
    assert.ok(outbound.every(url => url === jwksUrl || url === endpoint));
    console.log('Workerd stylist passed: actual RSA + local D1/whole SQL trigger, default DEMO/no-key/consent/tier denial, text-only store:false Responses fixtures, grounded output rejection, conservative billed-failure reservations, global cost cap and concurrent quota. No remote API or operational data.');
  } finally { await mf.dispose(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
