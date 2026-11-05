'use strict';
// Real RSA verification and fixed-URL provider fixtures only. No Firebase users,
// emails, payments, or external requests are created by these tests.
const test = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync, sign } = require('node:crypto');
const auth = import('../server/firebase-auth.mjs');
const premium = import('../server/premium-access.mjs');
const NOW = Date.now(), SECONDS = Math.floor(NOW / 1000);
const ORIGIN = 'https://a1fashion.pages.dev';
const PROJECT = 'a1-signup-test';
const KEY = 'fixture-public-api-key-123456789';
const JWKS = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const ISSUER = `https://securetoken.google.com/${PROJECT}`;
const EMAIL = 'member@example.test';
const PASSWORD = 'correct fixture password';
const env = { FIREBASE_PROJECT_ID: PROJECT, FIREBASE_WEB_API_KEY: KEY };
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'fixture-signing-key', use: 'sig', alg: 'RS256' };
const encode = data => Buffer.from(JSON.stringify(data)).toString('base64url');
function token(extra = {}, header = {}) {
  const input = `${encode({ alg: 'RS256', kid: jwk.kid, ...header })}.${encode({
    iss: ISSUER, aud: PROJECT, sub: 'fixture-user', email: EMAIL, email_verified: true,
    auth_time: SECONDS - 10, iat: SECONDS - 10, exp: SECONDS + 3600, ...extra
  })}`;
  return `${input}.${sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url')}`;
}
function fixture(options = {}) {
  const state = {
    verified: true, disabled: false, deleted: false, validSince: String(SECONDS - 20),
    signInClaims: {}, fail: {}, calls: [], ...options
  };
  const fetchImpl = async (input, request) => {
    const url = new URL(input);
    assert.equal(request.redirect, 'error');
    if (String(url) === JWKS) {
      state.calls.push({ action: 'jwks' });
      if (state.jwksUnavailable) throw new Error('fixture-offline');
      return Response.json({ keys: [jwk] });
    }
    assert.equal(url.origin, 'https://identitytoolkit.googleapis.com', 'Only official fixed provider URLs are permitted');
    assert.equal(url.searchParams.get('key'), KEY);
    if (url.pathname === '/v1/projects') {
      assert.equal(request.method, 'GET');
      assert.equal(request.body, undefined);
      state.calls.push({ action: 'projectConfig' });
      if (state.fail.projectConfig) return Response.json({ error: typeof state.fail.projectConfig === 'string' ? { message: state.fail.projectConfig } : state.fail.projectConfig }, { status: 400 });
      return Response.json({ authorizedDomains: state.authorizedDomains || ['a1fashion.pages.dev', `${PROJECT}.firebaseapp.com`] });
    }
    assert.equal(request.method, 'POST');
    const action = url.pathname.replace('/v1/accounts:', '');
    const body = JSON.parse(request.body);
    state.calls.push({ action, body });
    if (state.fail[action]) return Response.json({ error: typeof state.fail[action] === 'string' ? { message: state.fail[action] } : state.fail[action] }, { status: 400 });
    switch (action) {
      case 'signUp':
        return Response.json({ localId: 'fixture-user', email: body.email, idToken: token({ email_verified: false }) });
      case 'signInWithPassword':
        return Response.json({ localId: 'fixture-user', email: EMAIL,
          idToken: state.signInToken || token({ email_verified: state.verified, ...state.signInClaims }) });
      case 'sendOobCode': return Response.json({ email: EMAIL });
      case 'lookup':
        if (state.deleted) return Response.json({ error: { message: 'USER_NOT_FOUND' } }, { status: 400 });
        return Response.json({ users: [{ localId: 'fixture-user', email: EMAIL,
          emailVerified: state.verified, disabled: state.disabled, validSince: state.validSince, ...state.user }] });
      case 'delete': state.deleted = true; return Response.json({});
      default: throw new Error('Unexpected provider endpoint');
    }
  };
  return { state, fetchImpl };
}
function request(action, body, { method, cookie, origin = ORIGIN, headers = {} } = {}) {
  const isGet = ['config', 'session'].includes(action);
  const actualMethod = method || (isGet ? 'GET' : 'POST');
  return new Request(`${ORIGIN}/api/auth/${action}`, {
    method: actualMethod,
    headers: { ...(!isGet ? { Origin: origin, 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}), ...headers },
    ...(!['GET', 'HEAD'].includes(actualMethod) ? { body: JSON.stringify(body ?? {}) } : {})
  });
}
async function call(action, body, options = {}) {
  const fx = options.fixture || fixture();
  return (await auth).handleAuthRequest(action, { request: request(action, body, options), env: options.env || env },
    { now: NOW, fetchImpl: fx.fetchImpl });
}
async function expectError(response, status, code) {
  assert.equal(response.status, status);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  const body = await response.json();
  assert.equal(body.ok, false); assert.equal(body.error, code);
  assert.doesNotMatch(JSON.stringify(body), new RegExp(`${KEY}|${PASSWORD}|eyJhbGci`));
  return body;
}

test('public configuration exposes only readiness; missing or malformed configuration cannot create accounts', async () => {
  const fx = fixture();
  for (const invalid of [{}, { FIREBASE_PROJECT_ID: PROJECT }, { ...env, FIREBASE_PROJECT_ID: '../attacker' }, { ...env, FIREBASE_WEB_API_KEY: 'tiny' }]) {
    assert.deepEqual(await (await call('config', undefined, { env: invalid, fixture: fx })).json(), { configured: false });
    await expectError(await call('signup', { email: EMAIL, password: PASSWORD }, { env: invalid, fixture: fx }), 503, 'setup_required');
    await expectError(await call('session', undefined, { env: invalid, fixture: fx }), 503, 'setup_required');
  }
  assert.deepEqual(await (await call('config')).json(), { configured: true });
  assert.deepEqual(fx.state.calls, []);
});

test('signup creates a provider account, requests verification, and never grants a session or paid entitlement', async () => {
  const fx = fixture();
  const response = await call('signup', { email: EMAIL, password: PASSWORD }, { fixture: fx });
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('Set-Cookie'), null);
  const result = await response.json();
  assert.equal(result.ok, true); assert.equal(result.emailVerificationRequired, true); assert.equal(result.verificationEmailSent, true);
  assert.deepEqual(fx.state.calls.map(c => c.action), ['signUp', 'sendOobCode']);
  assert.deepEqual(fx.state.calls[0].body, { email: EMAIL, password: PASSWORD, returnSecureToken: true });
  assert.equal(fx.state.calls[1].body.requestType, 'VERIFY_EMAIL');
  assert.equal(result.allowed, undefined); assert.equal(result.idToken, undefined);
});

test('copy-and-paste whitespace is normalized without accepting malformed connection values', async () => {
  const padded = { FIREBASE_PROJECT_ID: ` ${PROJECT}\n`, FIREBASE_WEB_API_KEY: `\n${KEY} ` };
  const fx = fixture();
  assert.deepEqual(await (await call('config', undefined, { env: padded, fixture: fx })).json(), { configured: true });
  assert.equal((await call('signup', { email: EMAIL, password: PASSWORD }, { env: padded, fixture: fx })).status, 201);
  assert.deepEqual(await (await call('config', undefined, { env: { ...env, FIREBASE_WEB_API_KEY: `"${KEY}"` } })).json(), { configured: false });
});

test('read-only connection check rejects invalid keys and unapproved hosts before accepting a password', async () => {
  const invalid = fixture({ fail: { projectConfig: 'INVALID_API_KEY' } });
  await expectError(await call('config', undefined, { fixture: invalid }), 503, 'provider_key_invalid');
  assert.deepEqual(invalid.state.calls.map(call => call.action), ['projectConfig']);
  const wrongDomain = fixture({ authorizedDomains: ['other.example.test'] });
  const result = await expectError(await call('config', undefined, { fixture: wrongDomain }), 503, 'provider_domain_disallowed');
  assert.match(result.message, /AUTH-DOMAIN/);
  assert.ok(!JSON.stringify(result).includes('other.example.test'));
  assert.deepEqual(wrongDomain.state.calls.map(call => call.action), ['projectConfig']);
});

test('provider setup failures have distinct safe messages instead of a generic preparing state', async () => {
  const cases = [
    ['INVALID_API_KEY', 'provider_key_invalid', 'AUTH-KEY'],
    ['API key not valid. Please pass a valid API key.', 'provider_key_invalid', 'AUTH-KEY'],
    ['OPERATION_NOT_ALLOWED', 'provider_method_disabled', 'AUTH-METHOD'],
    ['PASSWORD_LOGIN_DISABLED', 'provider_method_disabled', 'AUTH-METHOD'],
    ['ADMIN_ONLY_OPERATION', 'provider_signup_disabled', 'AUTH-SIGNUP'],
    ['CONFIGURATION_NOT_FOUND', 'provider_project_invalid', 'AUTH-PROJECT'],
    ['MISSING_RECAPTCHA_TOKEN', 'provider_security_required', 'AUTH-CHECK'],
    ['BILLING_NOT_ENABLED', 'provider_plan_required', 'AUTH-PLAN'],
    [`Unrecognized response containing ${KEY} ${PASSWORD}`, 'provider_unavailable', 'AUTH-CONNECT']
  ];
  for (const [message, code, display] of cases) {
    const fx = fixture({ fail: { signUp: message } });
    const result = await expectError(await call('signup', { email: EMAIL, password: PASSWORD }, { fixture: fx }), 503, code);
    assert.ok(result.message.includes(display));
    assert.deepEqual(fx.state.calls.map(c => c.action), ['signUp']);
  }
  for (const [reason, code, display] of [
    ['API_KEY_INVALID', 'provider_key_invalid', 'AUTH-KEY'],
    ['API_KEY_HTTP_REFERRER_BLOCKED', 'provider_access_denied', 'AUTH-ACCESS'],
    ['API_KEY_SERVICE_BLOCKED', 'provider_access_denied', 'AUTH-ACCESS'],
    ['SERVICE_DISABLED', 'provider_service_disabled', 'AUTH-API'],
    ['CONSUMER_INVALID', 'provider_project_invalid', 'AUTH-PROJECT']
  ]) {
    const fx = fixture({ fail: { signUp: { message: `Private response ${KEY} ${PASSWORD}`, status: 'PERMISSION_DENIED', details: [
      { '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason, metadata: { key: KEY, input: PASSWORD, account: EMAIL } }
    ] } } });
    const result = await expectError(await call('signup', { email: EMAIL, password: PASSWORD }, { fixture: fx }), 503, code);
    assert.ok(result.message.includes(display));
    assert.ok(!JSON.stringify(result).includes(EMAIL));
  }
});

test('provider network failures remain distinct from missing settings without exposing exceptions', async () => {
  const fx = { fetchImpl: async () => { throw new Error(`Private network details ${KEY} ${PASSWORD}`); } };
  const result = await expectError(await call('signup', { email: EMAIL, password: PASSWORD }, { fixture: fx }), 503, 'provider_unavailable');
  assert.match(result.message, /AUTH-CONNECT/);
});

test('mail failure after account creation accurately reports a created account and permits a later resend', async () => {
  const fx = fixture({ fail: { sendOobCode: 'TOO_MANY_ATTEMPTS_TRY_LATER' } });
  const response = await call('signup', { email: EMAIL, password: PASSWORD }, { fixture: fx });
  assert.equal(response.status, 201);
  const result = await response.json();
  assert.equal(result.ok, true); assert.equal(result.verificationEmailSent, false);
  assert.match(result.message, /계정은 만들어졌지만/);
  assert.equal(fx.state.calls.filter(c => c.action === 'signUp').length, 1);
  assert.equal(response.headers.get('Set-Cookie'), null);
});

test('same-origin JSON and bounded exact fields are required on every mutating auth route', async () => {
  const fx = fixture();
  for (const action of ['signup', 'login', 'verify-email', 'reset-password', 'logout', 'delete-account']) {
    const valid = action === 'logout' ? {} : action === 'delete-account' ? { password: PASSWORD }
      : action === 'reset-password' ? { email: EMAIL } : { email: EMAIL, password: PASSWORD };
    await expectError(await call(action, valid, { fixture: fx, origin: 'https://other.example.test' }), 403, 'forbidden_origin');
    await expectError(await call(action, valid, { fixture: fx, headers: { Origin: '', 'Content-Type': 'application/json' } }), 403, 'forbidden_origin');
    await expectError(await call(action, { ...valid, paid: true }, { fixture: fx }), 400, 'invalid_request');
    await expectError(await call(action, valid, { fixture: fx, headers: { 'Content-Type': 'text/plain' } }), 400, 'invalid_request');
    await expectError(await call(action, valid, { fixture: fx, headers: { 'Content-Length': '5000' } }), 413, 'request_too_large');
    await expectError(await call(action, { ...valid, extra: 'x'.repeat(5000) }, { fixture: fx }), 413, 'request_too_large');
    await expectError(await call(action, undefined, { fixture: fx, method: 'GET' }), 405, 'method_not_allowed');
  }
  assert.deepEqual(fx.state.calls, []);
  await expectError(await call('signup', { email: EMAIL, password: 'short' }), 400, 'password_too_short');
});

test('verified login checks real RSA signature and current user before issuing a bounded secure HttpOnly session', async () => {
  const fx = fixture();
  const response = await call('login', { email: EMAIL, password: PASSWORD }, { fixture: fx });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.deepEqual(result.user, { email: EMAIL, emailVerified: true });
  assert.equal(result.expiresAt, (SECONDS + 3600) * 1000);
  assert.equal(result.idToken, undefined); assert.equal(result.refreshToken, undefined);
  const cookie = response.headers.get('Set-Cookie');
  assert.match(cookie, /^__Host-a1-session=[A-Za-z0-9_.-]+; Path=\/; HttpOnly; Secure; SameSite=Lax; Max-Age=\d+$/);
  assert.ok(Number(cookie.match(/Max-Age=(\d+)/)[1]) <= 3600);
  assert.deepEqual(fx.state.calls.map(c => c.action), ['signInWithPassword', 'jwks', 'lookup']);
});

test('unverified users cannot log in; credentials can request another provider verification message', async () => {
  const fx = fixture({ verified: false });
  const response = await call('login', { email: EMAIL, password: PASSWORD }, { fixture: fx });
  await expectError(response, 403, 'email_verification_required');
  assert.equal(response.headers.get('Set-Cookie'), null);
  const resend = await call('verify-email', { email: EMAIL, password: PASSWORD }, { fixture: fx });
  assert.equal(resend.status, 200); assert.equal(resend.headers.get('Set-Cookie'), null);
  assert.equal((await resend.json()).emailVerificationRequired, true);
  assert.equal(fx.state.calls.at(-1).body.requestType, 'VERIFY_EMAIL');
});

test('session is independent of the paid database and does not expose identity tokens', async () => {
  const fx = fixture();
  const response = await call('session', undefined, { fixture: fx, cookie: `__Host-a1-session=${token()}` });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { authenticated: true, user: { email: EMAIL, emailVerified: true }, expiresAt: (SECONDS + 3600) * 1000 });
  assert.deepEqual(fx.state.calls.map(c => c.action), ['jwks', 'lookup']);
});

test('forged, expired, wrong-project, conflicting, and Cloudflare cookies cannot act as a Firebase session', async () => {
  const altered = token().split('.'); altered[1] = encode({ sub: 'attacker' });
  const badCookies = [undefined, 'paid=true', `CF_Authorization=${token()}`, '__Host-a1-session=a.b.c',
    `__Host-a1-session=${altered.join('.')}`, `__Host-a1-session=${token({ exp: SECONDS - 1 })}`,
    `__Host-a1-session=${token({ aud: 'another-project' })}`, `__Host-a1-session=${token({ iss: 'https://attacker.example.test/' })}`,
    `__Host-a1-session=${token({}, { alg: 'none' })}`, `__Host-a1-session=${token({}, { jku: 'https://attacker.example.test/jwks' })}`,
    `__Host-a1-session=${token()}; __Host-a1-session=${token()}`];
  for (const cookie of badCookies) {
    const fx = fixture();
    const response = await call('session', undefined, { fixture: fx, cookie });
    const result = await expectError(response, 401, 'authentication_required');
    assert.equal(result.authenticated, false);
    assert.match(response.headers.get('Set-Cookie'), /Max-Age=0/);
    assert.equal(fx.state.calls.filter(c => c.action === 'lookup').length, 0);
  }
});

test('deleted, disabled, revoked, or mismatched current Firebase users lose their signed session', async () => {
  for (const options of [{ deleted: true }, { disabled: true }, { validSince: String(SECONDS - 5) },
    { user: { localId: 'other-user' } }, { user: { email: 'other@example.test' } }, { validSince: 'not-a-time' }]) {
    const fx = fixture(options);
    await expectError(await call('session', undefined, { fixture: fx, cookie: `__Host-a1-session=${token()}` }), 401, 'authentication_required');
  }
  const offline = fixture({ jwksUnavailable: true });
  await expectError(await call('session', undefined, { fixture: offline, cookie: `__Host-a1-session=${token()}` }), 503, 'verification_unavailable');
});

test('password reset uses the same generic result for existing and unknown accounts', async () => {
  const known = fixture(), unknown = fixture({ fail: { sendOobCode: 'EMAIL_NOT_FOUND' } });
  const a = await call('reset-password', { email: EMAIL }, { fixture: known });
  const b = await call('reset-password', { email: 'unknown@example.test' }, { fixture: unknown });
  assert.equal(a.status, 200); assert.equal(b.status, 200);
  assert.deepEqual(await a.json(), await b.json());
  assert.deepEqual(known.state.calls[0].body, { requestType: 'PASSWORD_RESET', email: EMAIL });
  const limited = fixture({ fail: { sendOobCode: 'TOO_MANY_ATTEMPTS_TRY_LATER' } });
  await expectError(await call('reset-password', { email: EMAIL }, { fixture: limited }), 429, 'try_later');
});

test('logout clears the host-only session even when provider configuration is missing', async () => {
  const fx = fixture();
  const response = await call('logout', {}, { env: {}, fixture: fx });
  assert.equal(response.status, 200); assert.equal((await response.json()).authenticated, false);
  assert.match(response.headers.get('Set-Cookie'), /^__Host-a1-session=; Path=\/; HttpOnly; Secure; SameSite=Lax; Max-Age=0$/);
  assert.deepEqual(fx.state.calls, []);
});

test('self-service deletion requires a current session and fresh same-user password authentication', async () => {
  const fx = fixture();
  const response = await call('delete-account', { password: PASSWORD }, { fixture: fx, cookie: `__Host-a1-session=${token()}` });
  assert.equal(response.status, 200); assert.equal((await response.json()).authenticated, false);
  assert.match(response.headers.get('Set-Cookie'), /Max-Age=0/);
  assert.equal(fx.state.deleted, true);
  assert.equal(fx.state.calls.filter(c => c.action === 'delete').length, 1);
  assert.ok(fx.state.calls.findIndex(c => c.action === 'signInWithPassword') < fx.state.calls.findIndex(c => c.action === 'delete'));
  await expectError(await call('session', undefined, { fixture: fx, cookie: `__Host-a1-session=${token()}` }), 401, 'authentication_required');
  const wrong = fixture({ fail: { signInWithPassword: 'INVALID_LOGIN_CREDENTIALS' } });
  await expectError(await call('delete-account', { password: 'wrong password' }, { fixture: wrong, cookie: `__Host-a1-session=${token()}` }), 401, 'invalid_credentials');
  assert.equal(wrong.state.calls.filter(c => c.action === 'delete').length, 0);
  const noSession = fixture();
  await expectError(await call('delete-account', { password: PASSWORD }, { fixture: noSession }), 401, 'authentication_required');
  assert.deepEqual(noSession.state.calls, []);
});

test('Firebase signup/session never bypasses paid D1 entitlement, and revoked identities are rejected before DB reads', async () => {
  const cookie = `__Host-a1-session=${token()}`;
  const makeRequest = () => new Request(`${ORIGIN}/api/membership`, { headers: { Cookie: cookie, 'X-Paid': 'true' } });
  let reads = 0, row = null;
  const paidEnv = { ...env, MEMBERSHIP_DB: { prepare(sql) {
    assert.doesNotMatch(sql, /INSERT|UPDATE|DELETE/i);
    return { bind(issuer, subject) {
      assert.equal(issuer, ISSUER); assert.equal(subject, 'fixture-user');
      return { async first() { reads++; return row; } };
    } };
  } } };
  const fx = fixture();
  await assert.rejects((await premium).authorizePremium(makeRequest(), paidEnv, { now: NOW, fetchImpl: fx.fetchImpl }), error => error.status === 403 && error.code === 'subscription_required');
  row = { issuer: ISSUER, subject: 'fixture-user', subscription_status: 'active', paid_through: NOW + 100000, payment_verified_at: NOW - 1000 };
  assert.equal((await (await premium).authorizePremium(makeRequest(), paidEnv, { now: NOW, fetchImpl: fx.fetchImpl })).allowed, true);
  const oldReads = reads; fx.state.deleted = true;
  await assert.rejects((await premium).authorizePremium(makeRequest(), paidEnv, { now: NOW, fetchImpl: fx.fetchImpl }), error => error.status === 401);
  assert.equal(reads, oldReads);
});

test('deployed auth route wrappers expose config and reject unsupported methods without provider access', async () => {
  for (const action of ['config', 'signup', 'login', 'session', 'logout', 'reset-password', 'verify-email', 'delete-account']) {
    const handler = await import(`../functions/api/auth/${action}.js`);
    const response = await handler.onRequest({ request: request(action, undefined, { method: 'OPTIONS' }), env: {} });
    assert.equal(response.status, 405); assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  }
});
