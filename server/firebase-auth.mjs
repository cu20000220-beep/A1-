/** Firebase Authentication REST adapter. No passwords, tokens, or account rows are persisted here. */
import { JwtVerificationError, verifyJwtToken } from './jwt-verifier.mjs';

const COOKIE = '__Host-a1-session';
const API = 'https://identitytoolkit.googleapis.com/v1/';
const JWKS = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const MAX_BODY = 4096;
const MAX_REMOTE = 64 * 1024;
const MESSAGES = Object.freeze({
  setup_required: '회원 서비스 연결을 준비 중입니다. 지금은 무료 사진 분석을 이용할 수 있습니다.',
  authentication_required: '로그인이 필요합니다. 다시 로그인해주세요.',
  email_verification_required: '이메일 인증을 완료한 뒤 다시 로그인해주세요. 인증 메일을 다시 요청할 수 있습니다.',
  invalid_credentials: '이메일 또는 비밀번호를 확인해주세요.',
  account_exists: '가입을 진행하지 못했습니다. 기존 계정이 있다면 로그인하거나 비밀번호를 재설정해주세요.',
  invalid_request: '입력 내용을 확인해주세요.',
  password_too_short: '비밀번호는 12자 이상 128자 이하로 입력해주세요.',
  request_too_large: '요청 크기가 너무 큽니다.',
  forbidden_origin: 'A1 FASHION 사이트에서 다시 시도해주세요.',
  method_not_allowed: '지원하지 않는 요청 방식입니다.',
  try_later: '요청이 많습니다. 잠시 후 다시 시도해주세요.'
});

export class FirebaseAuthError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}
class ProviderError extends Error {
  constructor(code) { super('firebase-request-failed'); this.code = code; }
}

export function isFirebaseAuthSelected(env) {
  return env?.FIREBASE_PROJECT_ID !== undefined || env?.FIREBASE_WEB_API_KEY !== undefined;
}

function configuration(env) {
  const project = env?.FIREBASE_PROJECT_ID;
  const key = env?.FIREBASE_WEB_API_KEY;
  if (typeof project !== 'string' || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(project)
    || typeof key !== 'string' || !/^[A-Za-z0-9_-]{20,200}$/.test(key)) {
    throw new FirebaseAuthError(503, 'setup_required');
  }
  return { project, key, issuer: `https://securetoken.google.com/${project}`, audience: project, jwksUrl: JWKS };
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store',
    'Vary': 'Cookie', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', ...headers
  } });
}

function errorResponse(error, action) {
  const known = error instanceof FirebaseAuthError;
  const status = known ? error.status : 503;
  const code = known ? error.code : 'setup_required';
  return json({ ok: false, ...(action === 'session' ? { authenticated: false } : {}),
    error: code, message: MESSAGES[code] || MESSAGES.setup_required }, status,
  { ...(status === 401 && action === 'session' ? { 'Set-Cookie': expiredCookie() } : {}),
    ...(status === 405 ? { Allow: ['config', 'session'].includes(action) ? 'GET' : 'POST' } : {}) });
}

async function boundedBytes(stream, limit) {
  if (!stream) return new Uint8Array();
  const reader = stream.getReader(), chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new FirebaseAuthError(413, 'request_too_large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin || origin !== new URL(request.url).origin
    || request.headers.get('Sec-Fetch-Site') === 'cross-site') {
    throw new FirebaseAuthError(403, 'forbidden_origin');
  }
}

async function input(request, fields) {
  sameOrigin(request);
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('Content-Type') || '')
    || (request.headers.has('Content-Encoding') && request.headers.get('Content-Encoding') !== 'identity')) {
    throw new FirebaseAuthError(400, 'invalid_request');
  }
  const length = request.headers.get('Content-Length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_BODY)) {
    throw new FirebaseAuthError(Number(length) > MAX_BODY ? 413 : 400,
      Number(length) > MAX_BODY ? 'request_too_large' : 'invalid_request');
  }
  let body;
  try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await boundedBytes(request.body, MAX_BODY))); }
  catch (error) { if (error instanceof FirebaseAuthError) throw error; throw new FirebaseAuthError(400, 'invalid_request'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).length !== fields.length || !fields.every(key => Object.hasOwn(body, key))) {
    throw new FirebaseAuthError(400, 'invalid_request');
  }
  if (fields.includes('email')) {
    if (typeof body.email !== 'string' || body.email.length > 254) throw new FirebaseAuthError(400, 'invalid_request');
    body.email = body.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) || /[\u0000-\u001f\u007f]/u.test(body.email)) {
      throw new FirebaseAuthError(400, 'invalid_request');
    }
  }
  if (fields.includes('password') && (typeof body.password !== 'string' || !body.password.length || body.password.length > 128)) {
    throw new FirebaseAuthError(400, 'invalid_request');
  }
  return body;
}

async function firebase(config, action, payload, fetchImpl) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetchImpl(`${API}accounts:${action}?key=${encodeURIComponent(config.key)}`, {
      method: 'POST', redirect: 'error', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Firebase-Locale': 'ko' },
      body: JSON.stringify(payload)
    });
    const declared = response.headers.get('Content-Length');
    if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_REMOTE)) throw new Error('invalid-response');
    const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await boundedBytes(response.body, MAX_REMOTE)));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('invalid-response');
    if (!response.ok) {
      const code = typeof data.error?.message === 'string' ? data.error.message.split(/[ :]/, 1)[0] : 'REMOTE_FAILURE';
      throw new ProviderError(code);
    }
    return data;
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    throw new FirebaseAuthError(503, 'setup_required');
  } finally { clearTimeout(timer); }
}

function providerError(error, action) {
  if (!(error instanceof ProviderError)) return error;
  if (['TOO_MANY_ATTEMPTS_TRY_LATER', 'QUOTA_EXCEEDED', 'TOO_MANY_REQUESTS'].includes(error.code)) return new FirebaseAuthError(429, 'try_later');
  if (action === 'signup' && error.code === 'EMAIL_EXISTS') return new FirebaseAuthError(409, 'account_exists');
  if (action === 'signup' && error.code === 'WEAK_PASSWORD') return new FirebaseAuthError(400, 'password_too_short');
  if (error.code === 'INVALID_EMAIL') return new FirebaseAuthError(400, 'invalid_request');
  if (['INVALID_LOGIN_CREDENTIALS', 'INVALID_PASSWORD', 'EMAIL_NOT_FOUND', 'USER_DISABLED'].includes(error.code)) return new FirebaseAuthError(401, 'invalid_credentials');
  if (['INVALID_ID_TOKEN', 'TOKEN_EXPIRED', 'USER_NOT_FOUND', 'CREDENTIAL_TOO_OLD_LOGIN_AGAIN'].includes(error.code)) return new FirebaseAuthError(401, 'authentication_required');
  return new FirebaseAuthError(503, 'setup_required');
}

function readSessionToken(request) {
  const raw = request.headers.get('Cookie') || '';
  if (raw.length > 32 * 1024) throw new FirebaseAuthError(401, 'authentication_required');
  const tokens = raw.split(';').map(part => part.trim()).filter(part => part.startsWith(`${COOKIE}=`)).map(part => part.slice(COOKIE.length + 1));
  // Dedicated Firebase mode does not interpret a Cloudflare Access cookie or a
  // browser-provided paid flag as this application's session.
  if (tokens.length !== 1 || !/^[A-Za-z0-9_.-]+$/.test(tokens[0]) || tokens[0].length > 16384) {
    throw new FirebaseAuthError(401, 'authentication_required');
  }
  return tokens[0];
}

async function tokenIdentity(token, config, { now, fetchImpl, requireVerified = true }) {
  let claims;
  try { claims = await verifyJwtToken(token, config, { now, fetchImpl }); }
  catch (error) {
    if (error instanceof JwtVerificationError) throw new FirebaseAuthError(error.status, error.code);
    throw new FirebaseAuthError(503, 'setup_required');
  }
  const seconds = Math.floor(now / 1000);
  if (typeof claims.aud !== 'string' || claims.aud !== config.project || claims.sub.length > 128
    || typeof claims.email !== 'string' || !claims.email || claims.email.length > 254
    || !Number.isSafeInteger(claims.auth_time) || claims.auth_time <= 0 || claims.auth_time > seconds + 30
    || typeof claims.email_verified !== 'boolean') throw new FirebaseAuthError(401, 'authentication_required');
  let lookup;
  try { lookup = await firebase(config, 'lookup', { idToken: token }, fetchImpl); }
  catch (error) {
    const mapped = providerError(error, 'lookup');
    if (mapped instanceof FirebaseAuthError && mapped.status === 401) throw new FirebaseAuthError(401, 'authentication_required');
    throw mapped;
  }
  if (!Array.isArray(lookup.users) || lookup.users.length !== 1) throw new FirebaseAuthError(401, 'authentication_required');
  const current = lookup.users[0];
  if (!current || typeof current !== 'object') throw new FirebaseAuthError(401, 'authentication_required');
  const validSince = typeof current.validSince === 'string' && /^\d{1,16}$/.test(current.validSince)
    ? Number(current.validSince) : current.validSince;
  if (current.localId !== claims.sub || current.disabled === true
    || typeof current.email !== 'string' || current.email.toLowerCase() !== claims.email.toLowerCase()
    || !Number.isSafeInteger(validSince) || validSince < 0 || validSince > seconds + 30
    || claims.auth_time < validSince) throw new FirebaseAuthError(401, 'authentication_required');
  const emailVerified = claims.email_verified === true && current.emailVerified === true;
  if (requireVerified && !emailVerified) throw new FirebaseAuthError(403, 'email_verification_required');
  return { issuer: config.issuer, subject: claims.sub, email: current.email, emailVerified, expiresAt: claims.exp * 1000 };
}

async function internalSession(request, env, options = {}) {
  const config = configuration(env);
  const now = options.now ?? Date.now(), fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (!Number.isSafeInteger(now) || now < 0 || typeof fetchImpl !== 'function') throw new FirebaseAuthError(503, 'setup_required');
  const token = readSessionToken(request);
  const identity = await tokenIdentity(token, config, { now, fetchImpl });
  return { config, token, identity };
}

export async function authenticateFirebaseSession(request, env, options = {}) {
  return (await internalSession(request, env, options)).identity;
}

function user(identity) { return { email: identity.email, emailVerified: identity.emailVerified }; }
function expiredCookie() { return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`; }
function sessionCookie(token, expiresAt, now) {
  const lifetime = Math.max(0, Math.min(3600, Math.floor((expiresAt - now) / 1000)));
  if (!lifetime) throw new FirebaseAuthError(401, 'authentication_required');
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${lifetime}`;
}

async function signIn(config, credentials, options, requireVerified) {
  let response;
  try { response = await firebase(config, 'signInWithPassword', { ...credentials, returnSecureToken: true }, options.fetchImpl); }
  catch (error) { throw providerError(error, 'login'); }
  if (typeof response.idToken !== 'string' || response.idToken.length > 16384) throw new FirebaseAuthError(503, 'setup_required');
  const identity = await tokenIdentity(response.idToken, config, { ...options, requireVerified });
  if (identity.email.toLowerCase() !== credentials.email.toLowerCase()) throw new FirebaseAuthError(503, 'setup_required');
  return { identity, token: response.idToken };
}

export async function handleAuthRequest(action, { request, env }, { now = Date.now(), fetchImpl = globalThis.fetch } = {}) {
  try {
    const expected = ['config', 'session'].includes(action) ? 'GET' : 'POST';
    if (request.method !== expected) throw new FirebaseAuthError(405, 'method_not_allowed');
    if (action === 'config') {
      let configured = false;
      try { configuration(env); configured = true; } catch { /* No provider identifiers or keys are exposed. */ }
      return json({ configured });
    }
    if (!Number.isSafeInteger(now) || now < 0 || typeof fetchImpl !== 'function') throw new FirebaseAuthError(503, 'setup_required');
    if (action === 'session') {
      const identity = await authenticateFirebaseSession(request, env, { now, fetchImpl });
      return json({ authenticated: true, user: user(identity), expiresAt: identity.expiresAt });
    }
    if (action === 'logout') { await input(request, []); return json({ ok: true, authenticated: false }, 200, { 'Set-Cookie': expiredCookie() }); }
    const fields = action === 'reset-password' ? ['email'] : action === 'delete-account' ? ['password'] : ['email', 'password'];
    const body = await input(request, fields);
    const config = configuration(env), options = { now, fetchImpl };
    if (action === 'signup') {
      if (body.password.length < 12) throw new FirebaseAuthError(400, 'password_too_short');
      let created;
      try { created = await firebase(config, 'signUp', { ...body, returnSecureToken: true }, fetchImpl); }
      catch (error) { throw providerError(error, 'signup'); }
      if (typeof created.localId !== 'string' || !created.localId) throw new FirebaseAuthError(503, 'setup_required');
      let sent = false;
      if (typeof created.idToken === 'string' && created.idToken.length <= 16384) {
        try { await firebase(config, 'sendOobCode', { requestType: 'VERIFY_EMAIL', idToken: created.idToken }, fetchImpl); sent = true; }
        catch { /* Account already exists: report mail failure without creating it again. */ }
      }
      return json({ ok: true, emailVerificationRequired: true, verificationEmailSent: sent,
        message: sent ? '계정을 만들었습니다. 인증 메일의 링크를 누른 뒤 로그인해주세요.' : '계정은 만들어졌지만 인증 메일을 요청하지 못했습니다. 잠시 후 이메일 인증 메일을 다시 요청해주세요.' }, 201);
    }
    if (action === 'login') {
      const { identity, token } = await signIn(config, body, options, true);
      return json({ ok: true, user: user(identity), expiresAt: identity.expiresAt }, 200,
        { 'Set-Cookie': sessionCookie(token, identity.expiresAt, now) });
    }
    if (action === 'verify-email') {
      const { identity, token } = await signIn(config, body, options, false);
      if (identity.emailVerified) return json({ ok: true, emailVerificationRequired: false, message: '이미 이메일 인증을 완료했습니다. 로그인해주세요.' });
      try { await firebase(config, 'sendOobCode', { requestType: 'VERIFY_EMAIL', idToken: token }, fetchImpl); }
      catch (error) { throw providerError(error, action); }
      return json({ ok: true, emailVerificationRequired: true, verificationEmailSent: true, message: '인증 메일을 요청했습니다. 메일의 링크를 누른 뒤 로그인해주세요.' });
    }
    if (action === 'reset-password') {
      try { await firebase(config, 'sendOobCode', { requestType: 'PASSWORD_RESET', email: body.email }, fetchImpl); }
      catch (error) {
        if (!(error instanceof ProviderError && ['EMAIL_NOT_FOUND', 'INVALID_LOGIN_CREDENTIALS'].includes(error.code))) throw providerError(error, action);
      }
      return json({ ok: true, message: '해당 이메일로 가입한 계정이 있다면 비밀번호 재설정 메일이 발송됩니다. 받은편지함과 스팸함을 확인해주세요.' });
    }
    if (action === 'delete-account') {
      const { identity } = await internalSession(request, env, options);
      const fresh = await signIn(config, { email: identity.email, password: body.password }, options, true);
      if (fresh.identity.issuer !== identity.issuer || fresh.identity.subject !== identity.subject) throw new FirebaseAuthError(401, 'authentication_required');
      try { await firebase(config, 'delete', { idToken: fresh.token }, fetchImpl); }
      catch (error) { throw providerError(error, action); }
      return json({ ok: true, authenticated: false, message: '회원 계정을 삭제했습니다.' }, 200, { 'Set-Cookie': expiredCookie() });
    }
    throw new FirebaseAuthError(400, 'invalid_request');
  } catch (error) { return errorResponse(error, action); }
}
