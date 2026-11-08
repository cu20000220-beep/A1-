/** Server-only conservative OpenAI reservations. No content or provider calls. */
if (typeof window !== 'undefined' || typeof document !== 'undefined') throw new Error('AI usage is server-only.');

const MILLION = 1_000_000n;
const MAX_CONFIG = 1_000_000_000_000;
const validTime = value => Number.isSafeInteger(value) && value >= 0 && value <= 253_402_300_799_999;
const names = Object.freeze({
  userDaily: 'A1_AI_DAILY_USER_LIMIT',
  dailyMicroUsd: 'A1_AI_DAILY_BUDGET_MICRO_USD',
  monthlyMicroUsd: 'A1_AI_MONTHLY_BUDGET_MICRO_USD',
  inputMicroUsdPerMillion: 'A1_AI_INPUT_MICRO_USD_PER_MILLION_TOKENS',
  outputMicroUsdPerMillion: 'A1_AI_OUTPUT_MICRO_USD_PER_MILLION_TOKENS'
});

export class AiUsageError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}

function integer(value, maximum = MAX_CONFIG) {
  if (typeof value === 'string') {
    if (!/^(?:0|[1-9]\d{0,12})$/.test(value)) return null;
    value = Number(value);
  }
  return Number.isSafeInteger(value) && value >= 0 && value <= maximum ? value : null;
}

/** Missing/zero limits keep live usage disabled. Invalid values fail closed. */
export function readAiUsageLimits(env = {}) {
  const result = {};
  for (const [key, name] of Object.entries(names)) {
    const value = env[name] === undefined ? 0 : integer(env[name], key === 'userDaily' ? 1000 : MAX_CONFIG);
    if (value === null) throw new AiUsageError(503, 'ai_budget_configuration_invalid');
    result[key] = value;
  }
  return Object.freeze({ ...result, configured: Object.values(result).every(value => value > 0) });
}

function trustedLimits(limits) {
  if (!limits || limits.configured !== true || Object.keys(names).some(key => integer(limits[key], key === 'userDaily' ? 1000 : MAX_CONFIG) !== limits[key] || limits[key] <= 0)) {
    throw new AiUsageError(503, 'ai_budget_not_configured');
  }
  return limits;
}

/**
 * Count every byte of the complete serialized provider request as a possible
 * input token, plus 1,024 framing tokens. This intentionally over-reserves; no
 * optimistic language-specific characters/token estimate is used. Supply the
 * complete request including instructions, history, catalog and JSON schema.
 * maxOutputTokens must also bound reasoning tokens in the provider request.
 */
export function estimateAiReservation({ serializedInput, maxOutputTokens, limits } = {}) {
  trustedLimits(limits);
  if (typeof serializedInput !== 'string' || serializedInput.length === 0
    || !Number.isSafeInteger(maxOutputTokens) || maxOutputTokens < 1 || maxOutputTokens > 8192) throw new AiUsageError(400, 'ai_usage_input_invalid');
  const bytes = new TextEncoder().encode(serializedInput).byteLength;
  if (bytes > 256 * 1024) throw new AiUsageError(413, 'ai_usage_input_too_large');
  const inputTokenCap = bytes + 1024;
  const numerator = BigInt(inputTokenCap) * BigInt(limits.inputMicroUsdPerMillion)
    + BigInt(maxOutputTokens) * BigInt(limits.outputMicroUsdPerMillion);
  const cost = (numerator + MILLION - 1n) / MILLION;
  if (cost < 1n || cost > BigInt(MAX_CONFIG)) throw new AiUsageError(503, 'ai_budget_configuration_invalid');
  return Object.freeze({ inputTokenCap, outputTokenCap: maxOutputTokens, reservedMicroUsd: Number(cost) });
}

/** Never store email, token, raw UID, message, photo or body-analysis values. */
export async function hashAiIdentity(identity) {
  if (!identity || ['issuer','subject'].some(key => typeof identity[key] !== 'string'
    || !identity[key] || identity[key].length > 2048 || /[\u0000-\u001f\u007f]/u.test(identity[key]))) throw new AiUsageError(401, 'authentication_required');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(['a1-ai-usage-v1', identity.issuer, identity.subject])));
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}

/**
 * One conditional INSERT plus the schema trigger is one SQLite transaction.
 * A second request cannot pass the checks using a pre-increment snapshot.
 * Storage failure, absent migration, duplicate ID or exhausted cap all block
 * the provider call. Callers must not automatically retry a reservation.
 */
export async function reserveAiUsage(db, { identity, limits, serializedInput, maxOutputTokens,
  now = Date.now(), requestId = crypto.randomUUID() } = {}) {
  if (typeof db?.prepare !== 'function' || !validTime(now)) throw new AiUsageError(503, 'ai_usage_storage_unavailable');
  trustedLimits(limits);
  if (typeof requestId !== 'string' || !/^[A-Za-z0-9_-]{16,100}$/.test(requestId)) throw new AiUsageError(400, 'ai_usage_input_invalid');
  const estimate = estimateAiReservation({ serializedInput, maxOutputTokens, limits });
  const ownerHash = await hashAiIdentity(identity), day = new Date(now).toISOString().slice(0,10), month = day.slice(0,7);
  try {
    const row = await db.prepare(`INSERT INTO ai_usage_reservations
      (request_id,owner_hash,day_utc,month_utc,created_at,reserved_micro_usd,input_token_cap,output_token_cap)
      SELECT ?,?,?,?,?,?,?,?
      WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='trigger' AND name='ai_usage_reservation_counters')
        AND COALESCE((SELECT request_count FROM ai_usage_buckets WHERE scope='user_day' AND period=? AND owner_hash=?),0) < ?
        AND COALESCE((SELECT reserved_micro_usd FROM ai_usage_buckets WHERE scope='global_day' AND period=? AND owner_hash=''),0) <= ?
        AND COALESCE((SELECT reserved_micro_usd FROM ai_usage_buckets WHERE scope='global_month' AND period=? AND owner_hash=''),0) <= ?
      ON CONFLICT(request_id) DO NOTHING RETURNING request_id`)
      .bind(requestId,ownerHash,day,month,now,estimate.reservedMicroUsd,estimate.inputTokenCap,estimate.outputTokenCap,
        day,ownerHash,limits.userDaily,day,limits.dailyMicroUsd-estimate.reservedMicroUsd,
        month,limits.monthlyMicroUsd-estimate.reservedMicroUsd).first();
    if (!row) throw new AiUsageError(429, 'ai_usage_limit');
    // The route verifies these periods again immediately before dispatch. An
    // asynchronous authorization/storage wait must not charge the next UTC
    // day/month against a reservation from the previous budget period.
    return Object.freeze({ requestId, ownerHash, dayUtc: day, monthUtc: month, ...estimate });
  } catch (error) {
    if (error instanceof AiUsageError) throw error;
    throw new AiUsageError(503, 'ai_usage_storage_unavailable');
  }
}

/** A timeout/error may be billed. No outcome releases the reservation. */
export async function finishAiUsage(db, reservation, { state = 'uncertain', inputTokens = null,
  outputTokens = null, now = Date.now() } = {}) {
  if (typeof db?.prepare !== 'function' || !validTime(now) || !reservation
    || typeof reservation.requestId !== 'string' || !/^[A-Za-z0-9_-]{16,100}$/.test(reservation.requestId)
    || !/^[a-f0-9]{64}$/.test(reservation.ownerHash || '') || !['succeeded','failed','uncertain'].includes(state)
    || [inputTokens,outputTokens].some(value => value !== null && (integer(value,1_000_000_000) === null || typeof value !== 'number'))) throw new AiUsageError(400, 'ai_usage_input_invalid');
  if (inputTokens !== null && inputTokens > reservation.inputTokenCap || outputTokens !== null && outputTokens > reservation.outputTokenCap) state = 'uncertain';
  try {
    await db.prepare("UPDATE ai_usage_reservations SET state=?, actual_input_tokens=?, actual_output_tokens=?, finished_at=? WHERE request_id=? AND owner_hash=? AND state='reserved'")
      .bind(state,inputTokens,outputTokens,now,reservation.requestId,reservation.ownerHash).run();
  } catch { throw new AiUsageError(503, 'ai_usage_storage_unavailable'); }
  return { state, reservedMicroUsd: reservation.reservedMicroUsd };
}

/** Erase account-linked usage; anonymous budget totals must never be refunded. */
export async function eraseAiMemberUsage(db, identity) {
  if (typeof db?.prepare !== 'function') throw new AiUsageError(503, 'ai_usage_storage_unavailable');
  const ownerHash = await hashAiIdentity(identity), statements = [];
  for (const table of ['ai_usage_reservations','ai_usage_buckets']) {
    const exists = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").bind(table).first();
    if (exists) statements.push(db.prepare(`DELETE FROM ${table} WHERE owner_hash=?`).bind(ownerHash));
  }
  if (!statements.length) return;
  if (typeof db.batch !== 'function') throw new AiUsageError(503, 'ai_usage_storage_unavailable');
  await db.batch(statements);
}
