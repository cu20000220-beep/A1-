/** Cloudflare Pages Functions only. No browser-supplied paid flags are trusted. */
import { evaluateAccess } from './membership-policy.mjs';
import { JwtVerificationError, verifyJwtToken } from './jwt-verifier.mjs';
import { authenticateFirebaseSession, FirebaseAuthError, isFirebaseAuthSelected } from './firebase-auth.mjs';

export const MAX_REQUEST_BYTES = 8 * 1024;
const MAX_TOKEN_BYTES = 16 * 1024;
const AUTH_VARY = 'Authorization, Cookie, Cf-Access-Jwt-Assertion';
const MESSAGES = Object.freeze({
  setup_required: '회원 인증과 결제 확인 연결을 준비 중입니다. 사진 분석은 무료로 이용할 수 있습니다.',
  authentication_required: '구독 회원 인증이 필요합니다.',
  subscription_required: '결제가 확인된 이용 기간에만 의류 추천과 쇼핑몰 연결을 이용할 수 있습니다.',
  premium_required: '프리미엄 구독에서만 가격 비교와 알림 기능을 이용할 수 있습니다.',
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
    || env.AUTH_AUDIENCE.length > 512 || env.AUTH_AUDIENCE !== env.AUTH_AUDIENCE.trim()) {
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


async function authenticate(request, config, now, fetchImpl) {
  try {
    const claims = await verifyJwtToken(readCredential(request), config, { now, fetchImpl });
    return { issuer: claims.iss, subject: claims.sub };
  } catch (error) {
    if (error instanceof JwtVerificationError) throw new AccessError(error.status, error.code);
    throw error;
  }
}

/** Authentication alone does not need a paid membership row or a D1 binding. */
export async function authenticateMember(request, env, { now = Date.now(), fetchImpl = globalThis.fetch } = {}) {
  if (!Number.isSafeInteger(now) || now < 0 || typeof fetchImpl !== 'function') throw new AccessError(503, 'setup_required');
  if (isFirebaseAuthSelected(env)) {
    try { return await authenticateFirebaseSession(request, env, { now, fetchImpl }); }
    catch (error) {
      if (error instanceof FirebaseAuthError) throw new AccessError(error.status, error.code === 'email_verification_required' ? 'authentication_required' : error.code);
      throw error;
    }
  }
  return authenticate(request, configuration(env), now, fetchImpl);
}

function missingPlanColumn(error) {
  // D1 wraps SQLite errors in cause. Only this known old-schema condition may
  // use the legacy query; transport/query/permission failures always fail closed.
  for (let current = error, depth = 0; current && depth < 4; current = current.cause, depth++) {
    if (typeof current.message === 'string' && /no such column:\s*(?:memberships\.)?plan_code\b/i.test(current.message)) return true;
  }
  return false;
}

export async function authorizeMember(request, env, { requiredTier = 'GENERAL', now = Date.now(), fetchImpl = globalThis.fetch } = {}) {
  if (!['FREE', 'GENERAL', 'PREMIUM'].includes(requiredTier)) throw new AccessError(400, 'invalid_request');
  if (requiredTier !== 'FREE' && typeof env?.MEMBERSHIP_DB?.prepare !== 'function') throw new AccessError(503, 'setup_required');
  const identity = await authenticateMember(request, env, { now, fetchImpl });
  if (requiredTier === 'FREE') return { allowed: true, accessUntil: null, plan: 'FREE', identity };
  let row;
  try {
    try {
      row = await env.MEMBERSHIP_DB.prepare(
        'SELECT issuer, subject, subscription_status, paid_through, payment_verified_at, plan_code FROM memberships WHERE issuer = ? AND subject = ? LIMIT 1'
      ).bind(identity.issuer, identity.subject).first();
    } catch (error) {
      if (!missingPlanColumn(error)) throw error;
      row = await env.MEMBERSHIP_DB.prepare(
        'SELECT issuer, subject, subscription_status, paid_through, payment_verified_at FROM memberships WHERE issuer = ? AND subject = ? LIMIT 1'
      ).bind(identity.issuer, identity.subject).first();
    }
  } catch { throw new AccessError(503, 'setup_required'); }
  if (!row || row.issuer !== identity.issuer || row.subject !== identity.subject) throw new AccessError(403, 'subscription_required');
  const stored = {
    issuer: row.issuer, subject: row.subject, subscriptionStatus: row.subscription_status,
    paidThrough: row.paid_through, paymentVerifiedAt: row.payment_verified_at,
    ...(Object.hasOwn(row, 'plan_code') ? { planCode: row.plan_code } : {})
  };
  const decision = evaluateAccess(stored, now, requiredTier);
  if (!decision.allowed) throw new AccessError(403, decision.reason === 'higher-plan-required' ? 'premium_required' : 'subscription_required');
  return { allowed: true, accessUntil: decision.accessUntil, plan: decision.plan, identity };
}

/** Recheck trusted identity + paid DB state for every protected request. */
export async function authorizePremium(request, env, options = {}) {
  const { identity, ...access } = await authorizeMember(request, env, options);
  return access;
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
