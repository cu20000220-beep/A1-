'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const policy = import('../server/membership-policy.mjs');
const NOW = Date.UTC(2026, 10, 4, 12, 0, 0);

test('requires an authenticated member identity and never starts a trial implicitly', async () => {
  const { startTrial, evaluateAccess } = await policy;
  for (const member of [undefined, null, {}, [], { userId: '' }, { userId: ' ' },
    { userId: 123 }, { userId: ' member' }, { userId: 'bad\nidentity' },
    Object.create({ userId: 'inherited' })]) {
    assert.equal(startTrial(member, NOW).ok, false);
    assert.equal(evaluateAccess(member, NOW).allowed, false);
  }
  assert.deepEqual(evaluateAccess({ userId: 'member-1' }, NOW), {
    allowed: false, reason: 'trial-not-started', source: null, accessUntil: null, trialEndsAt: null
  });
  // Client-style paid flags are deliberately ignored.
  assert.equal(evaluateAccess({ userId: 'member-1', paid: true, subscribed: true }, NOW).allowed, false);
});

test('starts exactly seven days of trial for a new trusted member', async () => {
  const { startTrial, evaluateAccess, TRIAL_DAYS, TRIAL_DURATION_MS } = await policy;
  assert.equal(TRIAL_DAYS, 7);
  assert.equal(TRIAL_DURATION_MS, 604800000);
  for (const trialStartedAt of [undefined, null]) {
    const result = startTrial({ userId: 'member-1', trialStartedAt }, NOW);
    assert.equal(result.ok, true);
    assert.equal(result.reason, 'trial-started');
    assert.equal(result.member.trialStartedAt, NOW);
    assert.deepEqual(evaluateAccess(result.member, NOW), {
      allowed: true, reason: 'trial-active', source: 'trial',
      accessUntil: NOW + TRIAL_DURATION_MS, trialEndsAt: NOW + TRIAL_DURATION_MS
    });
  }
});

test('allows the last trial millisecond and locks at the exact expiry boundary', async () => {
  const { evaluateAccess, TRIAL_DURATION_MS } = await policy;
  const member = { userId: 'member-1', trialStartedAt: NOW };
  const end = NOW + TRIAL_DURATION_MS;
  assert.equal(evaluateAccess(member, end - 1).allowed, true);
  assert.equal(evaluateAccess(member, end).allowed, false);
  assert.equal(evaluateAccess(member, end).reason, 'subscription-required');
  assert.equal(evaluateAccess(member, end + 1).allowed, false);
  // Trial end is derived from the start, not a supplied expiry override.
  assert.equal(evaluateAccess({ ...member, trialEndsAt: end * 2 }, end).allowed, false);
});

test('repeated starts retain the original timestamp even after expiry', async () => {
  const { startTrial, TRIAL_DURATION_MS } = await policy;
  const member = { userId: 'member-1', trialStartedAt: NOW, subscriptionStatus: 'canceled' };
  for (const serverNow of [NOW, NOW + 1, NOW + TRIAL_DURATION_MS + 1]) {
    const result = startTrial(member, serverNow);
    assert.equal(result.ok, true);
    assert.equal(result.reason, 'already-started');
    assert.equal(result.member.trialStartedAt, NOW);
    assert.notEqual(result.member, member);
  }
});

test('invalid or absent server clocks and malformed stored times fail closed', async () => {
  const { startTrial, evaluateAccess } = await policy;
  const member = { userId: 'member-1', trialStartedAt: NOW };
  for (const badNow of [undefined, null, NaN, Infinity, -1, NOW + 0.5, String(NOW),
    new Date(NOW), Number.MAX_SAFE_INTEGER]) {
    assert.equal(startTrial(member, badNow).ok, false);
    assert.equal(evaluateAccess(member, badNow).allowed, false);
  }
  for (const badTime of [NaN, Infinity, -1, NOW + 0.5, String(NOW), {}, Number.MAX_SAFE_INTEGER]) {
    for (const field of ['trialStartedAt', 'paidThrough']) {
      const badMember = { ...member, [field]: badTime, subscriptionStatus: 'active' };
      assert.equal(startTrial(badMember, NOW).ok, false);
      assert.equal(evaluateAccess(badMember, NOW).allowed, false);
    }
  }
  assert.equal(startTrial({ userId: 'member-1' }, 8_640_000_000_000_000).ok, false);
});

test('future trial timestamps cannot grant access or be reset by starting again', async () => {
  const { startTrial, evaluateAccess } = await policy;
  const member = {
    userId: 'member-1', trialStartedAt: NOW + 1,
    subscriptionStatus: 'active', paidThrough: NOW + 10000
  };
  assert.equal(startTrial(member, NOW).reason, 'future-trial-time');
  assert.equal(evaluateAccess(member, NOW).reason, 'future-trial-time');
  assert.equal(evaluateAccess(member, NOW).allowed, false);
});

test('paid access requires active status and an unexpired trusted paidThrough', async () => {
  const { evaluateAccess, TRIAL_DURATION_MS } = await policy;
  const expiredTrial = { userId: 'member-1', trialStartedAt: NOW - TRIAL_DURATION_MS };
  const paidThrough = NOW + 1000;
  assert.deepEqual(evaluateAccess({ ...expiredTrial, subscriptionStatus: 'active', paidThrough }, NOW), {
    allowed: true, reason: 'subscription-active', source: 'subscription',
    accessUntil: paidThrough, trialEndsAt: NOW
  });
  for (const status of [undefined, null, 'inactive', 'canceled', 'past_due', 'unpaid', 'trialing', 'unknown']) {
    assert.equal(evaluateAccess({ ...expiredTrial, subscriptionStatus: status, paidThrough }, NOW).allowed, false);
  }
  for (const paidEnd of [undefined, null, NOW - 1, NOW]) {
    assert.equal(evaluateAccess({ ...expiredTrial, subscriptionStatus: 'active', paidThrough: paidEnd }, NOW).allowed, false);
  }
  assert.equal(evaluateAccess({ userId: 'paid-member', subscriptionStatus: 'active', paidThrough }, NOW).allowed, true);
  assert.equal(evaluateAccess({ userId: 'member-1', subscriptionStatus: true, paidThrough }, NOW).allowed, false);
});

test('the original unexpired trial remains usable with an inactive paid status', async () => {
  const { evaluateAccess } = await policy;
  const result = evaluateAccess({ userId: 'member-1', trialStartedAt: NOW, subscriptionStatus: 'canceled' }, NOW);
  assert.equal(result.allowed, true);
  assert.equal(result.source, 'trial');
});

test('expiry never charges, changes status, or mutates its input; outputs are frozen copies', async () => {
  const { startTrial, evaluateAccess, TRIAL_DURATION_MS } = await policy;
  const input = Object.freeze({ userId: 'member-1', subscriptionStatus: 'inactive', paidThrough: null });
  const result = startTrial(input, NOW);
  assert.equal(input.trialStartedAt, undefined);
  assert.notEqual(result.member, input);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.member));
  assert.throws(() => { result.member.trialStartedAt = NOW + 1; }, TypeError);
  const snapshot = JSON.stringify(result.member);
  const access = evaluateAccess(result.member, NOW + TRIAL_DURATION_MS);
  assert.equal(access.allowed, false);
  assert.equal(access.reason, 'subscription-required');
  assert.equal(JSON.stringify(result.member), snapshot);
  assert.equal(result.member.subscriptionStatus, 'inactive');
  assert.ok(Object.isFrozen(access));
  assert.deepEqual(Object.keys(access).sort(), ['accessUntil', 'allowed', 'reason', 'source', 'trialEndsAt']);
  const failed = startTrial(null, NOW);
  assert.equal(failed.member, null);
  assert.ok(Object.isFrozen(failed));
});
