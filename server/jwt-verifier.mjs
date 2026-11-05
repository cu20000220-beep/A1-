/** Shared RS256 signature verifier; callers supply a trusted, validated issuer/JWKS configuration. */
const MAX_JWKS_BYTES = 64 * 1024;
export class JwtVerificationError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
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
        throw new JwtVerificationError(413, 'request_too_large');
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
      headers: { Accept: 'application/json' }, redirect: 'manual', signal: controller.signal
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error('jwks-unavailable');
    }
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
    if (candidates.length !== 1) throw new JwtVerificationError(401, 'authentication_required');
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
    if (error instanceof JwtVerificationError && error.status === 401) throw error;
    throw new JwtVerificationError(503, 'setup_required');
  } finally { clearTimeout(timeout); }
}

export async function verifyJwtToken(token, config, { now = Date.now(), fetchImpl = globalThis.fetch } = {}) {
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
  } catch { throw new JwtVerificationError(401, 'authentication_required'); }
  const key = await getSigningKey(config, header.kid, fetchImpl);
  let verified = false;
  try {
    verified = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decodePart(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  } catch { /* Invalid signatures fail closed, without returning cryptographic details. */ }
  if (!verified) throw new JwtVerificationError(401, 'authentication_required');
  return claims;
}
