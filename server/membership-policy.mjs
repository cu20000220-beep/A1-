/**
 * Server-only entitlement policy. The photo analysis itself is free; clothing
 * recommendations and shopping links require a verified, current subscription.
 * Call only with a row read from the trusted membership database, never browser
 * storage, JWT payment claims, request bodies, or a client clock.
 */
if (typeof window !== 'undefined' || typeof document !== 'undefined') {
  throw new Error('membership-policy is server-only.');
}

const MAX_TIMESTAMP_MS = 8_640_000_000_000_000;
const isTimestamp = value => Number.isSafeInteger(value) && value >= 0 && value <= MAX_TIMESTAMP_MS;
const isIdentity = value => typeof value === 'string' && value.length > 0 && value.length <= 2048
  && value === value.trim() && !/[\u0000-\u001f\u007f]/u.test(value);

/** All timestamps are UTC epoch milliseconds. There is no trial entitlement. */
export function evaluateAccess(member, serverNow) {
  if (!isTimestamp(serverNow)) return decision(false, 'invalid-server-time');
  if (!member || typeof member !== 'object' || Array.isArray(member)
    || !Object.hasOwn(member, 'issuer') || !Object.hasOwn(member, 'subject')
    || !isIdentity(member.issuer) || !isIdentity(member.subject)) {
    return decision(false, 'invalid-member');
  }
  if (member.subscriptionStatus !== 'active') return decision(false, 'subscription-required');
  if (!isTimestamp(member.paidThrough) || member.paidThrough <= serverNow) {
    return decision(false, 'subscription-required');
  }
  // An active flag or future expiry alone is not evidence of a verified payment.
  if (!isTimestamp(member.paymentVerifiedAt) || member.paymentVerifiedAt === 0
    || member.paymentVerifiedAt > serverNow || member.paymentVerifiedAt >= member.paidThrough) {
    return decision(false, 'payment-not-verified');
  }
  return decision(true, 'subscription-active', member.paidThrough);
}

function decision(allowed, reason, accessUntil = null) {
  return Object.freeze({ allowed, reason, source: allowed ? 'subscription' : null, accessUntil });
}
