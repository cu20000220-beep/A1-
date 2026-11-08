'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const policy = import('../server/membership-policy.mjs');
const NOW = Date.UTC(2026, 10, 4, 12, 0, 0);
const paid = Object.freeze({
  issuer: 'https://members.example.test/', subject: 'member-1',
  subscriptionStatus: 'active', paidThrough: NOW + 1000, paymentVerifiedAt: NOW - 1000
});

test('only a verified active paid period grants recommendation access', async () => {
  const { evaluateAccess } = await policy;
  assert.deepEqual(evaluateAccess(paid, NOW), {
    allowed: true, reason: 'subscription-active', source: 'subscription', accessUntil: NOW + 1000, plan: 'GENERAL'
  });
  for (const subscriptionStatus of [undefined, null, true, 'inactive', 'canceled', 'past_due', 'unpaid', 'trialing']) {
    assert.equal(evaluateAccess({ ...paid, subscriptionStatus }, NOW).allowed, false);
  }
  assert.equal(evaluateAccess({ ...paid, paidThrough: NOW }, NOW).allowed, false);
  assert.equal(evaluateAccess({ ...paid, paidThrough: NOW - 1 }, NOW).allowed, false);
  assert.equal(evaluateAccess(paid, NOW + 999).allowed, true);
  assert.equal(evaluateAccess(paid, NOW + 1000).allowed, false);
});

test('payment verification is mandatory and cannot be in the future', async () => {
  const { evaluateAccess } = await policy;
  for (const paymentVerifiedAt of [undefined, null, 0, -1, '123', NOW + 1, Infinity, NaN, NOW + 0.5]) {
    assert.equal(evaluateAccess({ ...paid, paymentVerifiedAt }, NOW).allowed, false);
  }
  assert.equal(evaluateAccess({ ...paid, paymentVerifiedAt: NOW }, NOW).allowed, true);
});

test('seven-day trial timestamps and browser-style paid flags grant no access', async () => {
  const module = await policy;
  assert.equal(module.startTrial, undefined);
  assert.equal(module.TRIAL_DAYS, undefined);
  const identity = { issuer: paid.issuer, subject: paid.subject };
  for (const flags of [
    { trialStartedAt: NOW, trialEndsAt: NOW + 604800000 },
    { paid: true, subscribed: true, allowed: true },
    { subscriptionStatus: 'trialing', paidThrough: NOW + 604800000 },
    { subscriptionStatus: 'active', paidThrough: NOW + 604800000, paymentVerified: true }
  ]) {
    assert.equal(module.evaluateAccess({ ...identity, ...flags }, NOW).allowed, false);
  }
});

test('malformed stored identities, expiries, or server clocks fail closed', async () => {
  const { evaluateAccess } = await policy;
  for (const member of [null, undefined, [], {}, { subject: 'member-1' },
    { ...paid, issuer: '' }, { ...paid, subject: ' member' },
    { ...paid, subject: 'bad\nidentity' }, Object.create(paid)]) {
    assert.equal(evaluateAccess(member, NOW).allowed, false);
  }
  for (const serverNow of [undefined, null, NaN, Infinity, -1, NOW + 0.5, String(NOW), Number.MAX_SAFE_INTEGER]) {
    assert.equal(evaluateAccess(paid, serverNow).allowed, false);
  }
  for (const paidThrough of [undefined, null, NaN, Infinity, -1, NOW + 0.5, String(NOW), Number.MAX_SAFE_INTEGER]) {
    assert.equal(evaluateAccess({ ...paid, paidThrough }, NOW).allowed, false);
  }
});

test('policy is immutable and expiration never performs billing or extends access', async () => {
  const { evaluateAccess } = await policy;
  const snapshot = JSON.stringify(paid);
  const decision = evaluateAccess(paid, NOW + 1000);
  assert.equal(decision.allowed, false);
  assert.equal(JSON.stringify(paid), snapshot);
  assert.ok(Object.isFrozen(decision));
  assert.throws(() => { decision.allowed = true; }, TypeError);
});


test('GENERAL and legacy members never gain PREMIUM while verified PREMIUM includes GENERAL', async () => {
  const { evaluateAccess } = await policy;
  for (const member of [paid, { ...paid, planCode: 'GENERAL' }]) {
    assert.equal(evaluateAccess(member, NOW, 'GENERAL').allowed, true);
    assert.equal(evaluateAccess(member, NOW, 'PREMIUM').allowed, false);
  }
  assert.equal(evaluateAccess({ ...paid, planCode: 'PREMIUM' }, NOW, 'PREMIUM').allowed, true);
  assert.equal(evaluateAccess({ ...paid, planCode: 'PREMIUM' }, NOW, 'GENERAL').plan, 'PREMIUM');
  for (const planCode of [null, '', 'premium', true, 'ADMIN', 'FREE']) assert.equal(evaluateAccess({ ...paid, planCode }, NOW).allowed, false);
  for (const subscriptionStatus of ['refunded','expired','past_due','unpaid','canceled']) assert.equal(evaluateAccess({ ...paid, planCode: 'PREMIUM', subscriptionStatus }, NOW, 'PREMIUM').allowed, false);
  assert.equal(evaluateAccess(paid, NOW, 'ADMIN').allowed, false);
});
