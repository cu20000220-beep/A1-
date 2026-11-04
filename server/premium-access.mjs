/** Cloudflare Pages Functions only. No browser-supplied paid flags are trusted. */
import { evaluateAccess } from './membership-policy.mjs';

export const MAX_REQUEST_BYTES = 8 * 1024;
const MAX_TOKEN_BYTES = 16 * 1024;
const MAX_JWKS_BYTES = 64 * 1024;
const AUTH_VARY = 'Authorization, Cookie, Cf-Access-Jwt-Assertion';
const MESSAGES = Object.freeze({
  setup_required: '회원 인증과 결제 확인 연결을 준비 중입니다. 사진 분석은 무료로 이용할 수 있습니다.',
  authentication_required: '구독 회원 인증이 필요합니다.',
  subscription_required: '결제가 확인된 이용 기간에만 의류 추천과 쇼핑몰 연결을 이용할 수 있습니다.',
  invalid_request: '요청 형식을 확인해주세요. 사진은 서버로 전송하지 않습니다.',
  request_too_large: '요청이 허용된 크기를 초과했습니다.',
  method_not_allowed: '지원하지 않는 요청 방식입니다.',
  forbidden_origin: '이 사이트에서 보낸 요청만 사용할 수 있습니다.'
});

export class AccessError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

export function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'Vary': AUTH_VARY,
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders
    }
  });
}

export function errorResponse(error, env, extraHeaders = {}) {
  const known = error instanceof AccessError;
  const status = known ? error.status : 503;
  const code = known ? error.code : 'setup_required';
  const body = { allowed: false, error: code, message: MESSAGES[code] || MESSAGES.setup_required };
  if (status === 401) {
    const loginUrl = safeLoginUrl(env?.MEMBER_LOGIN_URL);
    if (loginUrl) body.loginUrl = loginUrl;
  }
  // Do not serialize exceptions, request content, claims, or database rows.
  return jsonResponse(body, status, extraHeaders);
}

function secureUrl(value) {
  if (typeof value !== 'string' || value.length > 2048 || value !== value.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.hash ? url : null;
  } catch { return null; }
}

function safeLoginUrl(value) { return secureUrl(value)?.href || null; }

function configuration(env) {
  const issuer = secureUrl(env?.AUTH_ISSUER);
  const jwks = secureUrl(env?.AUTH_JWKS_URL);
  if (!issuer || issuer.search || !jwks || jwks.origin !== issuer.origin
    || typeof env?.AUTH_AUDIENCE !== 'string' || !env.AUTH_AUDIENCE.trim()
    || env.AUTH_AUDIENCE.length > 512 || env.AUTH_AUDIENCE !== env.AUTH_AUDIENCE.trim()
    || typeof env?.MEMBERSHIP_DB?.prepare !== 'function') {
    throw new AccessError(503, 'setup_required');
  }
  return { issuer: env.AUTH_ISSUER, audience: env.AUTH_AUDIENCE, jwksUrl: jwks.href };
}

function readCredential(request) {
  const authorization = request.headers.get('Authorization');
  const assertion = request.headers.get('Cf-Access-Jwt-Assertion');
  const cookies = request.headers.get('Cookie') || '';
  if (cookies.length > 32 * 1024) throw new AccessError(401, 'authentication_required');
  const cookieValues = cookies.split(';').map(part => part.trim())
    .filter(part => part.startsWith('CF_Authorization='))
    .map(part => part.slice('CF_Authorization='.length));
  const values = [];
  if (authorization !== null) {
    if (authorization.length > MAX_TOKEN_BYTES + 7) throw new AccessError(401, 'authentication_required');
    const match = /^Bearer ([A-Za-z0-9_.-]+)$/i.exec(authorization);
    if (!match) throw new AccessError(401, 'authentication_required');
    values.push(match[1]);
  }
  if (assertion !== null) values.push(assertion);
  values.push(...cookieValues);
  if (!values.length || values.some(value => !value || value.length > MAX_TOKEN_BYTES)
    || new Set(values).size !== 1) throw new AccessError(401, 'authentication_required');
  return values[0];
}

function decodePart(part) {
  if (!/^[A-Za-z0-9_-]+$/.test(part) || part.length % 4 === 1) throw new Error('invalid-base64');
  const raw = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}

function decodeJson(part) {
  const decoded = new TextDecoder('utf-8', { fatal: true }).decode(decodePart(part));
  const value = JSON.parse(decoded);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid-object');
  return value;
}

function validSubject(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 255
    && value === value.trim() && !/[\u0000-\u001f\u007f]/u.test(value);
}

async function readBounded(stream, maxBytes) {
  if (!stream) return new Uint8Array();
  const reader = stream.getReader();
  const chunks = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) {
        await reader.cancel();
        throw new AccessError(413, 'request_too_large');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

async function getSigningKey(config, kid, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetchImpl(config.jwksUrl, {
      headers: { Accept: 'application/json' }, redirect: 'error', signal: controller.signal
    });
    if (!response.ok) throw new Error('jwks-unavailable');
    const declared = response.headers.get('Content-Length');
    if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_JWKS_BYTES)) {
      throw new Error('jwks-too-large');
    }
    const bytes = await readBounded(response.body, MAX_JWKS_BYTES);
    const jwks = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!Array.isArray(jwks?.keys) || !jwks.keys.length || jwks.keys.length > 20) {
      throw new Error('invalid-jwks');
    }
    const candidates = jwks.keys.filter(key => key && key.kid === kid && key.kty === 'RSA'
      && (key.use === undefined || key.use === 'sig') && (key.alg === undefined || key.alg === 'RS256')
      && (key.key_ops === undefined || (Array.isArray(key.key_ops) && key.key_ops.includes('verify')))
      && !Object.hasOwn(key, 'd'));
    if (candidates.length !== 1) throw new AccessError(401, 'authentication_required');
    const key = candidates[0];
    if (typeof key.n !== 'string' || typeof key.e !== 'string') throw new Error('invalid-key');
    const modulusBytes = decodePart(key.n).byteLength;
    if (modulusBytes < 256 || modulusBytes > 1024 || key.e.length > 8) throw new Error('invalid-key-size');
    const imported = await crypto.subtle.importKey('jwk', key,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    if (imported.algorithm.modulusLength < 2048 || imported.algorithm.modulusLength > 8192) {
      throw new Error('invalid-key-strength');
    }
    return imported;
  } catch (error) {
    if (error instanceof AccessError && error.status === 401) throw error;
    throw new AccessError(503, 'setup_required');
  } finally { clearTimeout(timeout); }
}

async function authenticate(request, config, now, fetchImpl) {
  const token = readCredential(request);
  let parts, header, claims;
  try {
    parts = token.split('.');
    if (parts.length !== 3) throw new Error('invalid-token');
    header = decodeJson(parts[0]);
    claims = decodeJson(parts[1]);
    const seconds = Math.floor(now / 1000);
    if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid
      || header.kid.length > 256 || header.crit !== undefined || header.b64 !== undefined
      || header.jku !== undefined || header.jwk !== undefined || header.x5u !== undefined
      || claims.iss !== config.issuer || !validSubject(claims.sub)
      || !Number.isSafeInteger(claims.exp) || claims.exp <= seconds
      || (claims.nbf !== undefined && (!Number.isSafeInteger(claims.nbf) || claims.nbf > seconds))
      || (claims.iat !== undefined && (!Number.isSafeInteger(claims.iat) || claims.iat > seconds + 30))) {
      throw new Error('invalid-claims');
    }
    const audience = typeof claims.aud === 'string' ? [claims.aud] : claims.aud;
    if (!Array.isArray(audience) || audience.length > 16 || !audience.length
      || audience.some(item => typeof item !== 'string' || item.length > 512)
      || !audience.includes(config.audience)) throw new Error('invalid-audience');
    // Validate the signature encoding before fetching any remote key material.
    if (decodePart(parts[2]).byteLength > 1024) throw new Error('invalid-signature');
  } catch { throw new AccessError(401, 'authentication_required'); }
  const key = await getSigningKey(config, header.kid, fetchImpl);
  let verified = false;
  try {
    verified = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decodePart(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  } catch { /* Invalid signatures fail closed, without returning cryptographic details. */ }
  if (!verified) throw new AccessError(401, 'authentication_required');
  return { issuer: claims.iss, subject: claims.sub };
}

/** Re-run for every protected request; no earlier browser decision grants access. */
export async function authorizePremium(request, env, { now = Date.now(), fetchImpl = globalThis.fetch } = {}) {
  const config = configuration(env);
  if (!Number.isSafeInteger(now) || now < 0 || typeof fetchImpl !== 'function') {
    throw new AccessError(503, 'setup_required');
  }
  const identity = await authenticate(request, config, now, fetchImpl);
  let row;
  try {
    row = await env.MEMBERSHIP_DB.prepare(
      'SELECT issuer, subject, subscription_status, paid_through, payment_verified_at FROM memberships WHERE issuer = ? AND subject = ? LIMIT 1'
    ).bind(identity.issuer, identity.subject).first();
  } catch { throw new AccessError(503, 'setup_required'); }
  if (!row || row.issuer !== identity.issuer || row.subject !== identity.subject) {
    throw new AccessError(403, 'subscription_required');
  }
  const decision = evaluateAccess({
    issuer: row.issuer, subject: row.subject, subscriptionStatus: row.subscription_status,
    paidThrough: row.paid_through, paymentVerifiedAt: row.payment_verified_at
  }, now);
  if (!decision.allowed) throw new AccessError(403, 'subscription_required');
  return { allowed: true, accessUntil: decision.accessUntil };
}

export function assertSameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (origin !== null && origin !== new URL(request.url).origin) {
    throw new AccessError(403, 'forbidden_origin');
  }
}

function exactKeys(value, expected) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === expected.length
    && expected.every(key => Object.hasOwn(value, key));
}

/** Only two pose ratios and explicit preferences leave the browser. No images. */
export async function readRecommendationRequest(request) {
  const type = request.headers.get('Content-Type') || '';
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(type)
    || (request.headers.has('Content-Encoding') && request.headers.get('Content-Encoding') !== 'identity')) {
    throw new AccessError(400, 'invalid_request');
  }
  const declared = request.headers.get('Content-Length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_REQUEST_BYTES)) {
    throw new AccessError(Number(declared) > MAX_REQUEST_BYTES ? 413 : 400,
      Number(declared) > MAX_REQUEST_BYTES ? 'request_too_large' : 'invalid_request');
  }
  let body;
  try {
    const bytes = await readBounded(request.body, MAX_REQUEST_BYTES);
    body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (error) {
    if (error instanceof AccessError) throw error;
    throw new AccessError(400, 'invalid_request');
  }
  if (!exactKeys(body, ['metrics', 'preferences'])
    || !exactKeys(body.metrics, ['shoulderHipRatio', 'legTorsoRatio'])
    || !exactKeys(body.preferences, ['gender', 'style', 'budget'])) {
    throw new AccessError(400, 'invalid_request');
  }
  const { shoulderHipRatio, legTorsoRatio } = body.metrics;
  const { gender, style, budget } = body.preferences;
  if (!Number.isFinite(shoulderHipRatio) || shoulderHipRatio < 0.45 || shoulderHipRatio > 2.5
    || !Number.isFinite(legTorsoRatio) || legTorsoRatio < 0.6 || legTorsoRatio > 3.5
    || !['전체', '여성', '남성', '유니섹스'].includes(gender)
    || !['전체', '미니멀', '캐주얼', '클래식', '스트리트'].includes(style)
    || !Number.isSafeInteger(budget) || budget < 0 || budget > 100_000_000) {
    throw new AccessError(400, 'invalid_request');
  }
  return { metrics: { shoulderHipRatio, legTorsoRatio }, preferences: { gender, style, budget } };
}
