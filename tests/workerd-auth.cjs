'use strict';

// Run the actual server modules in Cloudflare's workerd engine. Every outbound
// request is handled by an in-process fixture: no real users, mail, or network.
// Dev dependencies: miniflare and esbuild (also supplied by Wrangler). Set
// A1_WORKER_TOOLS_ROOT to their node_modules directory when not installed here.
const assert = require('node:assert/strict');
const { generateKeyPairSync, sign } = require('node:crypto');
const { resolve, join } = require('node:path');

function dependency(name) {
  if (process.env.A1_WORKER_TOOLS_ROOT) return require(join(process.env.A1_WORKER_TOOLS_ROOT, name));
  return require(name);
}
const { Miniflare, convertV4MiniflareOptions } = dependency('miniflare');
const { build } = dependency('esbuild');
const root = resolve(__dirname, '..');
const origin = 'https://a1fashion.pages.dev';
const project = 'a1-workerd-fixture';
const apiKey = 'fixture-workerd-public-key-123456789';
const email = 'workerd-member@example.test';
const password = 'workerd-fixture-password-2026';
const subject = 'workerd-fixture-member';
const issuer = `https://securetoken.google.com/${project}`;
const jwksUrl = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicJwk = { ...publicKey.export({ format: 'jwk' }), kid: 'workerd-fixture', use: 'sig', alg: 'RS256' };
const now = Date.now();
const seconds = Math.floor(now / 1000);
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
function signedToken(emailVerified) {
  const unsigned = `${encode({ alg: 'RS256', kid: publicJwk.kid })}.${encode({
    iss: issuer, aud: project, sub: subject, email, email_verified: emailVerified,
    auth_time: seconds - 1, iat: seconds - 1, exp: seconds + 3600
  })}`;
  return `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url')}`;
}
const token = signedToken(true);
const unverifiedToken = signedToken(false);
const calls = [];
const unexpectedDestinations = [];
let redirectAction;
let currentEmailVerified = true;

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
}

async function provider(request) {
  const url = new URL(request.url);
  let action;
  if (url.href === jwksUrl) action = 'jwks';
  else if (url.origin === 'https://identitytoolkit.googleapis.com' && url.searchParams.get('key') === apiKey) {
    action = url.pathname === '/v1/projects' ? 'projectConfig' : url.pathname.replace('/v1/accounts:', '');
  } else {
    unexpectedDestinations.push(url.origin);
    return json({ error: { message: 'UNEXPECTED_FIXTURE_DESTINATION' } }, 500);
  }
  calls.push(action);
  if (action === redirectAction) return new Response(null, { status: 302,
    headers: { Location: 'https://never-follow.example.test/collect' } });
  if (action === 'jwks') return json({ keys: [publicJwk] });
  if (action === 'projectConfig') {
    assert.equal(request.method, 'GET');
    return json({ authorizedDomains: ['a1fashion.pages.dev', `${project}.firebaseapp.com`] });
  }
  assert.equal(request.method, 'POST');
  const body = await request.json();
  if (action === 'signUp' || action === 'signInWithPassword') {
    assert.equal(body.email, email);
    assert.equal(body.password, password);
    assert.equal(body.returnSecureToken, true);
    return json({ localId: subject, email, idToken: action === 'signUp' || !currentEmailVerified ? unverifiedToken : token });
  }
  if (action === 'sendOobCode') {
    assert.equal(body.requestType, 'VERIFY_EMAIL');
    assert.equal(body.idToken, unverifiedToken);
    return json({ email });
  }
  if (action === 'lookup') {
    assert.ok([token, unverifiedToken].includes(body.idToken));
    return json({ users: [{ localId: subject, email, emailVerified: currentEmailVerified,
      disabled: false, validSince: String(seconds - 10) }] });
  }
  throw new Error('Unexpected fixture action');
}

(async () => {
  const entry = `
    import { handleAuthRequest } from './server/firebase-auth.mjs';
    import { verifyJwtToken } from './server/jwt-verifier.mjs';
    export default { async fetch(request, env) {
      if (new URL(request.url).pathname === '/redirect-support') {
        let unsupportedErrorRejected = false;
        try { new Request('https://never-requested.example.test/', { redirect: 'error' }); }
        catch (error) { unsupportedErrorRejected = error.name === 'TypeError'; }
        const manual = new Request('https://never-requested.example.test/', { redirect: 'manual' });
        return Response.json({ unsupportedErrorRejected, manualSupported: manual.redirect === 'manual' });
      }
      if (new URL(request.url).pathname === '/verify') {
        try {
          const claims = await verifyJwtToken(${JSON.stringify(token)}, ${JSON.stringify({
            issuer, audience: project, jwksUrl
          })}, { now: ${now} });
          return Response.json({ verified: true, subject: claims.sub });
        } catch (error) {
          return Response.json({ verified: false }, { status: error.status || 500 });
        }
      }
      const action = new URL(request.url).pathname.split('/').at(-1);
      return handleAuthRequest(action, { request, env }, { now: ${now} });
    }};
  `;
  const bundled = await build({ stdin: { contents: entry, resolveDir: root, sourcefile: 'workerd-auth-test-entry.mjs' },
    bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022' });
  const options = { modules: true, script: bundled.outputFiles[0].text,
    compatibilityDate: '2026-11-05', bindings: { FIREBASE_PROJECT_ID: project, FIREBASE_WEB_API_KEY: apiKey },
    outboundService: provider };
  const mf = new Miniflare(convertV4MiniflareOptions ? convertV4MiniflareOptions(options) : options);
  const request = (action, body, cookie) => mf.dispatchFetch(`${origin}/api/auth/${action}`, {
    method: body === undefined ? 'GET' : 'POST', headers: {
      ...(body === undefined ? {} : { Origin: origin, 'Content-Type': 'application/json' }),
      ...(cookie ? { Cookie: cookie } : {})
    }, ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  try {
    const redirectSupport = await mf.dispatchFetch(`${origin}/redirect-support`);
    assert.deepEqual(await redirectSupport.json(), { unsupportedErrorRejected: true, manualSupported: true },
      'Use the Cloudflare runtime, where redirect:error is rejected before a request');
    const config = await request('config');
    assert.equal(config.status, 200, 'Native workerd must reach the provider using supported fetch options');
    assert.deepEqual(await config.json(), { configured: true });
    const signup = await request('signup', { email, password });
    assert.equal(signup.status, 201);
    assert.equal((await signup.json()).verificationEmailSent, true);
    assert.equal(signup.headers.get('Set-Cookie'), null);

    currentEmailVerified = false;
    const unverifiedLogin = await request('login', { email, password });
    assert.equal(unverifiedLogin.status, 403);
    assert.equal((await unverifiedLogin.json()).error, 'email_verification_required');
    assert.equal(unverifiedLogin.headers.get('Set-Cookie'), null);
    currentEmailVerified = true;
    const login = await request('login', { email, password });
    assert.equal(login.status, 200, 'Native workerd must fetch JWKS and verify the real RSA fixture');
    const cookie = login.headers.get('Set-Cookie');
    assert.match(cookie, /^__Host-a1-session=/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /Secure/);
    assert.equal((await login.json()).user.emailVerified, true);
    const session = await request('session', undefined, cookie.split(';')[0]);
    assert.equal(session.status, 200);
    assert.equal((await session.json()).authenticated, true);

    const verified = await mf.dispatchFetch(`${origin}/verify`);
    assert.equal(verified.status, 200);
    assert.deepEqual(await verified.json(), { verified: true, subject });

    for (const action of ['projectConfig', 'signUp', 'jwks']) {
      redirectAction = action;
      const start = calls.length;
      const response = action === 'projectConfig' ? await request('config')
        : action === 'signUp' ? await request('signup', { email, password })
          : await mf.dispatchFetch(`${origin}/verify`);
      assert.equal(response.status, 503, `${action} redirects must fail closed`);
      assert.equal(response.headers.get('Set-Cookie'), null);
      assert.deepEqual(calls.slice(start), [action], 'Redirect targets must never be followed');
      const text = await response.text();
      assert.ok(!text.includes(apiKey) && !text.includes(password) && !text.includes(token));
      redirectAction = undefined;
    }
    assert.deepEqual(unexpectedDestinations, []);
    console.log('Workerd auth passed: native provider GET/POST, signup/mail fixture, RSA JWKS login/session, and blocked redirects without forwarding credentials. No external requests.');
  } finally { await mf.dispose(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
