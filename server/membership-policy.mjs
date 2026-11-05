/** Server-only policy. Accept trusted DB records, never browser/JWT paid claims. */
if (typeof window !== 'undefined' || typeof document !== 'undefined') throw new Error('membership-policy is server-only.');

export const MEMBERSHIP_PLANS = Object.freeze({
  FREE: Object.freeze({ rank: 0, analysis: true, recommendations: false, comparison: false, notifications: false }),
  GENERAL: Object.freeze({ rank: 1, analysis: true, recommendations: true, comparison: false, notifications: false }),
  PREMIUM: Object.freeze({ rank: 2, analysis: true, recommendations: true, comparison: true, notifications: true })
});
const MAX_TIMESTAMP_MS = 8_640_000_000_000_000;
const isTimestamp = value => Number.isSafeInteger(value) && value >= 0 && value <= MAX_TIMESTAMP_MS;
const isIdentity = value => typeof value === 'string' && value.length > 0 && value.length <= 2048
  && value === value.trim() && !/[\u0000-\u001f\u007f]/u.test(value);

/** No trial exists. Legacy paid rows without a plan retain GENERAL only. */
export function evaluateAccess(member, serverNow, requiredTier = 'GENERAL') {
  if (typeof requiredTier !== 'string' || !Object.hasOwn(MEMBERSHIP_PLANS, requiredTier)) return decision(false, 'invalid-required-tier');
  if (!isTimestamp(serverNow)) return decision(false, 'invalid-server-time');
  if (!member || typeof member !== 'object' || Array.isArray(member)
    || !Object.hasOwn(member, 'issuer') || !Object.hasOwn(member, 'subject')
    || !isIdentity(member.issuer) || !isIdentity(member.subject)) return decision(false, 'invalid-member');
  if (requiredTier === 'FREE') return decision(true, 'free-access', null, 'FREE');
  if (member.subscriptionStatus !== 'active') return decision(false, 'subscription-required');
  if (!isTimestamp(member.paidThrough) || member.paidThrough <= serverNow) return decision(false, 'subscription-required');
  if (!isTimestamp(member.paymentVerifiedAt) || member.paymentVerifiedAt === 0
    || member.paymentVerifiedAt > serverNow || member.paymentVerifiedAt >= member.paidThrough) return decision(false, 'payment-not-verified');
  const plan = Object.hasOwn(member, 'planCode') ? member.planCode : 'GENERAL';
  if (typeof plan !== 'string' || !Object.hasOwn(MEMBERSHIP_PLANS, plan) || plan === 'FREE') return decision(false, 'invalid-plan');
  if (MEMBERSHIP_PLANS[plan].rank < MEMBERSHIP_PLANS[requiredTier].rank) return decision(false, 'higher-plan-required');
  return decision(true, 'subscription-active', member.paidThrough, plan);
}
function decision(allowed, reason, accessUntil = null, plan = 'FREE') {
  return Object.freeze({ allowed, reason, source: allowed ? plan === 'FREE' ? 'free' : 'subscription' : null, accessUntil, plan });
}
