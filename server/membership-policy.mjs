/**
 * Future server-side membership policy. This file is excluded from the static
 * site build; it does not enforce access on the current GitHub/Cloudflare Pages
 * site and does not authenticate users, persist records, or charge money.
 *
 * Call only after server-side authentication, using a member row loaded from a
 * trusted database and a server clock in UTC epoch milliseconds. Never pass a
 * request body, browser storage, client clock, or client-provided paid flags.
 *
 * Persist the first trial with a database uniqueness constraint on userId and a
 * conditional write where trialStartedAt IS NULL. Concurrent callers must read
 * the winning record. These pure helpers alone cannot prevent trial-reset races.
 * Keep the original trial timestamp after expiry, cancellation, or reactivation.
 */
if (typeof window !== 'undefined' || typeof document !== 'undefined') {
  throw new Error('membership-policy is server-only; do not import it in the browser.');
}

export const TRIAL_DAYS = 7;
export const TRIAL_DURATION_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;
const MAX_TIMESTAMP_MS = 8_640_000_000_000_000;

const isTimestamp = value => Number.isSafeInteger(value) && value >= 0 && value <= MAX_TIMESTAMP_MS;
const isMissing = value => value === undefined || value === null;

function validate(member, serverNow) {
  if (!isTimestamp(serverNow)) return 'invalid-server-time';
  if (!member || typeof member !== 'object' || Array.isArray(member)
    || !Object.hasOwn(member, 'userId') || typeof member.userId !== 'string'
    || !member.userId.trim() || member.userId !== member.userId.trim()
    || /[\u0000-\u001f\u007f]/u.test(member.userId)) return 'invalid-member';
  if (!isMissing(member.subscriptionStatus) && typeof member.subscriptionStatus !== 'string') {
    return 'invalid-member';
  }
  if (!isMissing(member.trialStartedAt)) {
    if (!isTimestamp(member.trialStartedAt)
      || member.trialStartedAt > MAX_TIMESTAMP_MS - TRIAL_DURATION_MS) return 'invalid-trial-time';
    // A future trial start can indicate a bad clock or corrupted database row.
    if (member.trialStartedAt > serverNow) return 'future-trial-time';
  }
  if (!isMissing(member.paidThrough) && !isTimestamp(member.paidThrough)) return 'invalid-paid-time';
  return null;
}

/**
 * Return { ok, reason, member }. A successful member is a frozen shallow copy
 * suitable for a conditional database write; the input is never changed.
 * Calling again retains the original timestamp, including expired trials.
 * A failed result contains member: null and must not be persisted as a grant.
 */
export function startTrial(member, serverNow) {
  const invalid = validate(member, serverNow);
  if (invalid) return Object.freeze({ ok: false, reason: invalid, member: null });
  if (!isMissing(member.trialStartedAt)) {
    return Object.freeze({
      ok: true,
      reason: 'already-started',
      member: Object.freeze({ ...member })
    });
  }
  if (serverNow > MAX_TIMESTAMP_MS - TRIAL_DURATION_MS) {
    return Object.freeze({ ok: false, reason: 'invalid-server-time', member: null });
  }
  return Object.freeze({
    ok: true,
    reason: 'trial-started',
    member: Object.freeze({ ...member, trialStartedAt: serverNow })
  });
}

/**
 * Return a frozen access decision. The trial lasts exactly 7 * 24 hours:
 * [trialStartedAt, trialStartedAt + TRIAL_DURATION_MS). The end instant is locked.
 *
 * Paid access requires BOTH trusted subscriptionStatus === 'active' and a valid
 * paidThrough strictly after serverNow. A canceled, past_due, unknown, or unpaid
 * status grants no paid access even with a future paidThrough. Cancellation
 * scheduled for the end of a paid period must remain 'active' in the server's
 * normalized record until then; the verified billing adapter owns that mapping.
 * A still-valid original trial remains independent of subscription status.
 * Expiry only denies access: no billing, automatic charge, or subscription change.
 */
export function evaluateAccess(member, serverNow) {
  const invalid = validate(member, serverNow);
  if (invalid) return decision(false, invalid);
  const trialEndsAt = isMissing(member.trialStartedAt)
    ? null : member.trialStartedAt + TRIAL_DURATION_MS;
  if (member.subscriptionStatus === 'active'
    && isTimestamp(member.paidThrough) && member.paidThrough > serverNow) {
    return decision(true, 'subscription-active', 'subscription', member.paidThrough, trialEndsAt);
  }
  if (trialEndsAt !== null && serverNow < trialEndsAt) {
    return decision(true, 'trial-active', 'trial', trialEndsAt, trialEndsAt);
  }
  return decision(false, trialEndsAt === null ? 'trial-not-started' : 'subscription-required',
    null, null, trialEndsAt);
}

function decision(allowed, reason, source = null, accessUntil = null, trialEndsAt = null) {
  return Object.freeze({ allowed, reason, source, accessUntil, trialEndsAt });
}
