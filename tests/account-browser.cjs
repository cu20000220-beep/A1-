'use strict';

// Local integration test only. The real Pages handlers verify real RSA tokens,
// while Firebase's HTTPS responses and a read-only D1 binding are test fixtures.
// No remote account is created, no mail is sent, and no payment is performed.
const assert = require('node:assert/strict');
const { generateKeyPairSync, sign } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { createServer } = require('node:https');
const { mkdtemp, readFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { resolve, join, extname } = require('node:path');
const { chromium } = require('playwright');

const root = resolve(__dirname, '..');
const project = 'a1-signup-ui-test';
const testKey = 'AIza-local-ui-fixture-not-a-real-key';
const email = 'customer@example.test';
const password = 'Local-test-password-2026!';
const uid = 'local-ui-customer';
const validSince = Math.floor(Date.now() / 1000) - 10;
const jwksUrl = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'local-account-fixture', use: 'sig', alg: 'RS256' };
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
let configured = false;
let created = false;
let verified = false;
let deleted = false;
let verificationEmails = 0;
let resetEmails = 0;
let databaseReads = 0;
let paidEntitlement = false;
let lastToken;
let providerFailure;
const apiCalls = [];
const providerCalls = [];

function token() {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: `https://securetoken.google.com/${project}`, aud: project, sub: uid,
    email, email_verified: verified, auth_time: now, iat: now, exp: now + 3600,
    firebase: { identities: { email: [email] }, sign_in_provider: 'password' }
  };
  const input = `${encode({ alg: 'RS256', kid: jwk.kid, typ: 'JWT' })}.${encode(claims)}`;
  lastToken = `${input}.${sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url')}`;
  return lastToken;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

async function firebaseFixture(input, options = {}) {
  const url = new URL(String(input));
  assert.equal(options.redirect, 'manual');
  if (url.href === jwksUrl) return json({ keys: [jwk] });
  assert.equal(url.origin, 'https://identitytoolkit.googleapis.com', 'Fixtures must not contact a remote service');
  assert.equal(url.searchParams.get('key'), testKey);
  if (url.pathname === '/v1/projects') {
    assert.equal(options.method, 'GET');
    assert.equal(options.body, undefined);
    providerCalls.push('projectConfig');
    if (providerFailure) return json({ error: providerFailure }, 400);
    return json({ authorizedDomains: ['127.0.0.1', 'localhost', 'a1fashion.pages.dev', `${project}.firebaseapp.com`] });
  }
  assert.equal(options.method, 'POST');
  const body = JSON.parse(options.body);
  const action = url.pathname.split(':').at(-1);
  providerCalls.push(action);
  if (action === 'signUp') {
    assert.deepEqual({ email: body.email, password: body.password }, { email, password });
    if (providerFailure) return json({ error: providerFailure }, 400);
    if (created && !deleted) return json({ error: { message: 'EMAIL_EXISTS' } }, 400);
    created = true; deleted = false; verified = false;
    return json({ idToken: token(), refreshToken: 'local-refresh-fixture', email, localId: uid, expiresIn: '3600' });
  }
  if (action === 'signInWithPassword') {
    if (!created || deleted || body.email !== email || body.password !== password) {
      return json({ error: { message: 'INVALID_LOGIN_CREDENTIALS' } }, 400);
    }
    return json({ idToken: token(), refreshToken: 'local-refresh-fixture', email, localId: uid, registered: true, expiresIn: '3600' });
  }
  if (action === 'sendOobCode') {
    if (body.requestType === 'VERIFY_EMAIL') {
      assert.equal(typeof body.idToken, 'string');
      verificationEmails++;
      return json({ email });
    }
    assert.equal(body.requestType, 'PASSWORD_RESET');
    resetEmails++;
    return body.email === email ? json({ email }) : json({ error: { message: 'EMAIL_NOT_FOUND' } }, 400);
  }
  if (action === 'lookup') {
    assert.equal(typeof body.idToken, 'string');
    if (deleted || !created) return json({ error: { message: 'USER_NOT_FOUND' } }, 400);
    return json({ users: [{ localId: uid, email, emailVerified: verified, disabled: false,
      validSince: String(validSince), passwordUpdatedAt: validSince * 1000 }] });
  }
  if (action === 'delete') {
    assert.equal(typeof body.idToken, 'string');
    deleted = true;
    return json({});
  }
  throw new Error(`Unexpected Firebase action: ${action}`);
}

const environment = {
  FIREBASE_PROJECT_ID: project,
  FIREBASE_WEB_API_KEY: testKey
};
const membershipDatabase = {
  prepare(sql) {
    assert.match(sql, /SELECT.+FROM memberships/i);
    assert.doesNotMatch(sql, /INSERT|UPDATE|DELETE/i, 'Signup cannot grant a paid entitlement');
    return { bind(issuer, subject) {
      assert.equal(issuer, `https://securetoken.google.com/${project}`);
      assert.equal(subject, uid);
      return { async first() {
        databaseReads++;
        return paidEntitlement ? { issuer, subject, subscription_status: 'active',
          paid_through: Date.now() + 3600000, payment_verified_at: validSince * 1000 } : null;
      } };
    } };
  }
};

async function responseFor(page, path, action, status) {
  const response = page.waitForResponse(result => new URL(result.url()).pathname === path);
  await action();
  const result = await response;
  assert.equal(result.status(), status, `${path}: ${await result.text()}`);
  if (path.startsWith('/api/auth/')) {
    await page.waitForFunction(() => document.querySelector('#auth-form')?.getAttribute('aria-busy') === 'false');
  }
  return result;
}

async function fillLogin(page, value = password) {
  await page.locator('#auth-email').fill(email);
  await page.locator('#auth-password').fill(value);
}

async function noCredentialStorage(page) {
  const stored = await page.evaluate(() => [
    ...Object.entries(localStorage), ...Object.entries(sessionStorage)
  ]);
  const serialized = JSON.stringify(stored);
  assert.ok(!serialized.includes(password), 'Passwords must never enter browser storage');
  assert.ok(!serialized.includes(email), 'Auth event notices must not contain email addresses');
  assert.ok(!lastToken || !serialized.includes(lastToken), 'Session tokens must never enter browser storage');
  assert.doesNotMatch(serialized, /local-refresh-fixture/);
}

(async () => {
  const names = ['config', 'signup', 'login', 'session', 'logout', 'reset-password', 'verify-email', 'delete-account'];
  const handlers = new Map();
  for (const name of names) handlers.set(`/api/auth/${name}`, await import(`../functions/api/auth/${name}.js`));
  handlers.set('/api/membership', await import('../functions/api/membership.js'));
  handlers.set('/api/recommendations', await import('../functions/api/recommendations.js'));
  // Exercise the repository's actual header policy, not a second policy copied
  // into the test. This fixture handles the simple prefix routes used here;
  // Cloudflare's deployment/parser is independently verified during rollout.
  const headerRules = [];
  let currentRule;
  for (const line of (await readFile(join(root, '_headers'), 'utf8')).split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (line.startsWith('/')) {
      currentRule = { path: line.trim(), headers: {} };
      headerRules.push(currentRule);
    } else {
      assert.ok(currentRule, 'Header declarations need a route');
      const separator = line.indexOf(':');
      assert.ok(separator > 0, 'Expected a header name and value');
      currentRule.headers[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
    }
  }
  const staticHeaders = pathname => Object.assign({}, ...headerRules.filter(rule =>
    rule.path.endsWith('*') ? pathname.startsWith(rule.path.slice(0, -1)) : pathname === rule.path
  ).map(rule => rule.headers));
  assert.ok(staticHeaders('/account.html')['Content-Security-Policy']);
  assert.ok(staticHeaders('/privacy.html')['Content-Security-Policy']);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = firebaseFixture;
  const certDir = await mkdtemp(join(tmpdir(), 'a1-account-tls-'));
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
    '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1',
    '-keyout', join(certDir, 'key.pem'), '-out', join(certDir, 'cert.pem')], { stdio: 'ignore' });
  const server = createServer({ key: await readFile(join(certDir, 'key.pem')), cert: await readFile(join(certDir, 'cert.pem')) }, async (incoming, outgoing) => {
    try {
      const url = new URL(incoming.url, `https://${incoming.headers.host}`);
      if (handlers.has(url.pathname)) {
        const chunks = [];
        for await (const chunk of incoming) chunks.push(chunk);
        const bytes = Buffer.concat(chunks);
        const request = new Request(url, {
          method: incoming.method, headers: incoming.headers,
          ...(incoming.method === 'GET' || incoming.method === 'HEAD' ? {} : { body: bytes })
        });
        const env = configured ? { ...environment,
          ...(url.pathname.startsWith('/api/auth/') ? {} : { MEMBERSHIP_DB: membershipDatabase }) } : {};
        const response = await handlers.get(url.pathname).onRequest({ request, env });
        apiCalls.push({ path: url.pathname, status: response.status,
          body: bytes.length ? JSON.parse(bytes.toString()) : null,
          cacheControl: response.headers.get('Cache-Control') });
        outgoing.writeHead(response.status, Object.fromEntries(response.headers));
        outgoing.end(Buffer.from(await response.arrayBuffer()));
        return;
      }
      const file = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
      const full = resolve(root, file);
      if (!full.startsWith(root + '/') || !/^(?:index\.html|account\.html|privacy\.html|credits\.html|assets\/.+)$/.test(file)) {
        outgoing.writeHead(404); outgoing.end(); return;
      }
      const data = await readFile(full);
      const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg' };
      outgoing.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', ...staticHeaders(url.pathname) });
      outgoing.end(data);
    } catch (error) {
      outgoing.writeHead(error.code === 'ENOENT' ? 404 : 500);
      outgoing.end();
      if (error.code !== 'ENOENT') console.error(error);
    }
  });
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `https://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
    const context = await browser.newContext({ locale: 'ko-KR', ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await context.addInitScript(() => {
      window.__a1CspViolations = [];
      document.addEventListener('securitypolicyviolation', event => window.__a1CspViolations.push({
        directive: event.violatedDirective, blocked: event.blockedURI
      }));
    });
    const accountResponse = await page.goto(`${origin}/account.html`, { waitUntil: 'networkidle' });
    assert.equal(accountResponse.headers()['content-security-policy'], staticHeaders('/account.html')['Content-Security-Policy']);
    assert.equal(await page.locator('#auth-fields').evaluate(el => el.disabled), true, 'Unconfigured UI must never pretend registration is available');
    assert.equal(await page.locator('#auth-email').isDisabled(), true);
    assert.match(await page.locator('#auth-config-status').textContent(), /준비|연결/);
    assert.equal(providerCalls.length, 0);

    configured = true;
    providerFailure = { message: 'API key not valid. Please pass a valid API key.', details: [
      { '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'API_KEY_INVALID' }
    ] };
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('#auth-fields').evaluate(el => el.disabled), true);
    assert.match(await page.locator('#auth-config-status').textContent(), /AUTH-KEY/);
    assert.equal(created, false);
    providerFailure = undefined;
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('#auth-fields').evaluate(el => el.disabled), false);
    assert.equal(await page.locator('#auth-member').isVisible(), false);
    assert.equal(await page.locator('#auth-guest').isVisible(), true);
    await page.locator('#auth-tab-signup').click();
    await fillLogin(page);
    await page.locator('#auth-confirm').fill('different-local-password');
    await page.locator('#auth-consent').check();
    const beforeMismatch = apiCalls.filter(call => call.path === '/api/auth/signup').length;
    await page.locator('#auth-submit').click();
    assert.equal(apiCalls.filter(call => call.path === '/api/auth/signup').length, beforeMismatch, 'Mismatched passwords are not submitted');
    await page.locator('#auth-confirm').fill(password);
    providerFailure = { message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT', details: [
      { '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'API_KEY_INVALID', metadata: { key: testKey } }
    ] };
    await responseFor(page, '/api/auth/signup', () => page.locator('#auth-submit').click(), 503);
    assert.match(await page.locator('#auth-status').textContent(), /AUTH-KEY/);
    assert.equal(created, false, 'A provider connection failure never pretends to create an account');
    assert.equal(await page.locator('#auth-member').isVisible(), false);
    assert.equal(await page.locator('#auth-password').inputValue(), '');
    assert.ok(!(await page.locator('#auth-status').textContent()).includes(testKey));
    await noCredentialStorage(page);
    providerFailure = undefined;
    await fillLogin(page);
    await page.locator('#auth-confirm').fill(password);
    await responseFor(page, '/api/auth/signup', () => page.locator('#auth-submit').click(), 201);
    await page.waitForFunction(() => document.querySelector('#auth-password').value === '');
    assert.equal(created, true);
    assert.equal(verificationEmails, 1);
    assert.match(await page.locator('#auth-status').textContent(), /인증|확인/);
    assert.equal(await page.locator('#auth-member').isVisible(), false, 'Signup is not a verified login or paid subscription');
    assert.equal((await context.cookies()).filter(cookie => cookie.name === '__Host-a1-session').length, 0);
    assert.equal(databaseReads, 0, 'Free registration never depends on a billing database');
    await noCredentialStorage(page);

    await page.locator('#auth-tab-login').click();
    await fillLogin(page);
    await responseFor(page, '/api/auth/login', () => page.locator('#auth-submit').click(), 403);
    await page.waitForFunction(() => !document.querySelector('#auth-submit').disabled);
    assert.match(await page.locator('#auth-status').textContent(), /이메일|인증|확인/);
    assert.equal(await page.locator('#auth-member').isVisible(), false);
    await fillLogin(page);
    await responseFor(page, '/api/auth/verify-email', () => page.locator('#auth-resend').click(), 200);
    assert.equal(verificationEmails, 2);

    await page.locator('#auth-reset').click();
    await page.locator('#auth-email').fill(email);
    await responseFor(page, '/api/auth/reset-password', () => page.locator('#auth-submit').click(), 200);
    assert.equal(resetEmails, 1);
    const resetMessage = await page.locator('#auth-status').textContent();
    assert.match(resetMessage, /메일|이메일/);
    await page.locator('#auth-email').fill('unknown@example.test');
    await responseFor(page, '/api/auth/reset-password', () => page.locator('#auth-submit').click(), 200);
    assert.equal(await page.locator('#auth-status').textContent(), resetMessage, 'Reset UI must not reveal whether an account exists');
    assert.equal(resetEmails, 2);
    await noCredentialStorage(page);

    await page.locator('#auth-back-login').click();
    verified = true;
    await fillLogin(page, 'Wrong-local-password');
    await responseFor(page, '/api/auth/login', () => page.locator('#auth-submit').click(), 401);
    assert.equal(await page.locator('#auth-member').isVisible(), false, 'Rejected credentials must not create a successful login');
    await fillLogin(page);
    await responseFor(page, '/api/auth/login', () => page.locator('#auth-submit').click(), 200);
    await page.waitForFunction(() => !document.querySelector('#auth-member').hidden);
    assert.equal(await page.locator('#auth-user-email').textContent(), email);
    assert.equal(await page.locator('#auth-guest').isVisible(), false);
    assert.equal(await page.locator('#auth-password').inputValue(), '');
    const cookie = (await context.cookies()).find(cookie => cookie.name === '__Host-a1-session');
    assert.ok(cookie, 'Verified login creates a real secure session cookie');
    assert.equal(cookie.httpOnly, true);
    assert.equal(cookie.secure, true);
    assert.equal(cookie.sameSite, 'Lax');
    assert.equal(cookie.path, '/');
    assert.ok(cookie.expires * 1000 <= Date.now() + 3600000 + 2000);
    assert.equal(await page.evaluate(() => document.cookie.includes('__Host-a1-session')), false);
    await noCredentialStorage(page);
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('#auth-member').isVisible(), true, 'The HttpOnly session works after reload');
    for (const [width, height] of [[820,1180], [390,844], [320,740]]) {
      await page.setViewportSize({ width, height });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Account page overflow at ${width}px`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: '/tmp/a1-account-member-mobile.png', fullPage: true });

    // A verified ordinary account remains unable to fetch paid recommendations.
    const home = await context.newPage();
    await home.goto(origin, { waitUntil: 'networkidle' });
    await home.evaluate(() => {
      localStorage.setItem('paid', 'true');
      document.dispatchEvent(new CustomEvent('a1:analysis-ready', { detail: { metrics: { shoulderHipRatio: 1.1, legTorsoRatio: 1.6 } } }));
    });
    await responseFor(home, '/api/membership', () => home.locator('#premium-check').click(), 403);
    assert.equal(await home.locator('#premium-lock').isVisible(), true);
    assert.equal(await home.locator('#ai-cards article').count(), 0);
    assert.equal(await home.locator('#ai-shopping-queries a').count(), 0);
    assert.equal(databaseReads, 1);

    // A test-only verified payment row enables the existing premium API. Signing
    // out in the account tab must erase those results in this other tab too.
    paidEntitlement = true;
    await responseFor(home, '/api/membership', () => home.locator('#premium-check').click(), 200);
    await home.waitForFunction(() => !document.querySelector('#premium-controls').hidden);
    await responseFor(home, '/api/recommendations', () => home.locator('#premium-recommend').click(), 200);
    await home.waitForFunction(() => document.querySelectorAll('#ai-cards article').length > 0);
    assert.equal(await home.locator('#ai-shopping-queries a').count(), 6);
    // Recommendation authorization runs before and after reading the body.
    assert.equal(databaseReads, 4);

    await responseFor(page, '/api/auth/logout', () => page.locator('#auth-logout').click(), 200);
    await page.waitForFunction(() => document.querySelector('#auth-member').hidden);
    assert.equal((await context.cookies()).filter(cookie => cookie.name === '__Host-a1-session').length, 0);
    await home.waitForFunction(() => document.querySelector('#premium-results').hidden);
    assert.equal(await home.locator('#premium-lock').isVisible(), true);
    assert.equal(await home.locator('#ai-cards article').count(), 0);
    assert.equal(await home.locator('#ai-shopping-queries a').count(), 0);
    const loggedOutStatus = await home.evaluate(async () => {
      const response = await fetch('api/recommendations', { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ metrics: { shoulderHipRatio: 1.1, legTorsoRatio: 1.6 },
          preferences: { gender: '전체', style: '전체', budget: 1000000 } }) });
      return response.status;
    });
    assert.equal(loggedOutStatus, 401, 'Logout removes the actual server session as well as the display');
    paidEntitlement = false;
    await home.close();
    await noCredentialStorage(page);
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('#auth-member').isVisible(), false);

    await fillLogin(page);
    await responseFor(page, '/api/auth/login', () => page.locator('#auth-submit').click(), 200);
    await page.locator('#auth-delete-toggle').click();
    await page.locator('#auth-delete-password').fill(password);
    await page.locator('#auth-delete-confirm').check();
    await responseFor(page, '/api/auth/delete-account', () => page.locator('#auth-delete-submit').click(), 200);
    await page.waitForFunction(() => document.querySelector('#auth-member').hidden);
    assert.equal(deleted, true);
    assert.equal((await context.cookies()).filter(cookie => cookie.name === '__Host-a1-session').length, 0);
    assert.equal(await page.locator('#auth-delete-password').inputValue(), '');
    assert.equal(databaseReads, 4, 'Account lifecycle does not create or update paid access');
    await noCredentialStorage(page);
    await page.locator('#auth-tab-signup').click();
    await page.screenshot({ path: '/tmp/a1-account-signup-mobile.png', fullPage: true });
    assert.ok(apiCalls.every(call => call.cacheControl === 'private, no-store'));
    assert.deepEqual(await page.evaluate(() => window.__a1CspViolations), [], 'Account controls and styles work under the shipped CSP');
    const privacyPage = await context.newPage();
    const privacyResponse = await privacyPage.goto(`${origin}/privacy.html`, { waitUntil: 'networkidle' });
    assert.equal(privacyResponse.headers()['content-security-policy'], staticHeaders('/privacy.html')['Content-Security-Policy']);
    assert.deepEqual(await privacyPage.evaluate(() => window.__a1CspViolations), [], 'Privacy styles work under the shipped CSP');
    await privacyPage.close();
    assert.deepEqual(errors, []);
    await context.close();
    console.log('Account UI passed: shipped account/privacy CSP, missing setup locked, signup/verification/reset, signed HttpOnly login, ordinary member stays unpaid, cross-tab logout clears real premium results, deletion, no credential storage, mobile widths. Firebase/D1 fixtures only.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
    globalThis.fetch = originalFetch;
    await rm(certDir, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
