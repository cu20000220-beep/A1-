/** Owned, explicit DEMO simulation. This module never reads contacts or sends messages. */
import { evaluateAccess } from './membership-policy.mjs';
import { MemberDataError } from './member-data.mjs';
import { buildNotificationCandidates, normalizeNotificationPreferences, notificationDeliveryKey, renderNotificationTemplate } from './notifications.mjs';

if (typeof window !== 'undefined' || typeof document !== 'undefined') throw new Error('Promotion simulation is server-only.');

const DAY = 86400000;
const validTime = value => Number.isSafeInteger(value) && value > 0 && value <= 8_640_000_000_000_000;
const validIdentity = identity => identity && ['issuer', 'subject'].every(key => typeof identity[key] === 'string'
  && identity[key].length > 0 && identity[key].length <= 2048 && identity[key] === identity[key].trim()
  && !/[\u0000-\u001f\u007f]/u.test(identity[key]));

/** Five fictional cases, not imported goods or real promotion events. */
export function demoPromotionEvents(now = Date.now()) {
  if (!validTime(now)) throw new MemberDataError(400, 'invalid_request');
  const day = new Date(now).toISOString().slice(0, 10), start = Math.floor(now / DAY) * DAY;
  return ['price_drop', 'target_reached', 'brand_promotion', 'promotion_start', 'promotion_ending'].map(type => ({
    id: `demo-${day}-${type}`, type, title: 'DEMO Cotton T-Shirt', productId: 'demo-tee', brand: 'A1 DEMO', category: 'tops',
    currentPrice: { amount: 39, currency: 'USD' }, previousPrice: { amount: 49, currency: 'USD' },
    startsAt: start, endsAt: start + DAY, checkedAt: now, demo: true, source: { mode: 'DEMO' }
  }));
}

function parseArray(value) {
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed)) throw new Error('Invalid private preferences');
  return parsed;
}
async function context(db, identity, now) {
  const owner = [identity.issuer, identity.subject];
  const row = await db.prepare('SELECT issuer, subject, plan_code, subscription_status, paid_through, payment_verified_at FROM memberships WHERE issuer = ? AND subject = ? LIMIT 1').bind(...owner).first();
  const member = row && { issuer: row.issuer, subject: row.subject, planCode: row.plan_code, subscriptionStatus: row.subscription_status,
    paidThrough: row.paid_through, paymentVerifiedAt: row.payment_verified_at };
  if (!evaluateAccess(member, now, 'PREMIUM').allowed) throw new MemberDataError(403, 'premium_required');
  // Deliberately exclude phone, verified-phone flags, email and account tokens.
  const stored = await db.prepare('SELECT country, time_zone, language, frequency, email_enabled, sms_enabled, brands_json, categories_json FROM notification_preferences WHERE issuer = ? AND subject = ?').bind(...owner).first();
  const preferences = normalizeNotificationPreferences(stored ? { country: stored.country, timeZone: stored.time_zone, language: stored.language,
    frequency: stored.frequency, emailEnabled: stored.email_enabled === 1, smsEnabled: stored.sms_enabled === 1,
    brands: parseArray(stored.brands_json), categories: parseArray(stored.categories_json) } : {});
  const consentRows = await Promise.all(['email', 'sms'].map(channel => db.prepare('SELECT id, channel, granted, occurred_at, policy_version FROM notification_consents WHERE issuer = ? AND subject = ? AND channel = ? ORDER BY occurred_at DESC, id DESC LIMIT 1').bind(...owner, channel).first()));
  const consents = consentRows.filter(Boolean).map(value => ({ ...identity, channel: value.channel, granted: value.granted === 1,
    grantedAt: value.occurred_at, version: value.policy_version }));
  const watches = await db.prepare('SELECT product_id, target_price, currency FROM product_watchlists WHERE issuer = ? AND subject = ? ORDER BY created_at DESC LIMIT 100').bind(...owner).all();
  const watchlist = (watches.results || []).map(watch => ({ ...identity, productId: watch.product_id,
    targetPrice: Number.isFinite(watch.target_price) && watch.target_price >= 0 ? { amount: watch.target_price, currency: watch.currency } : null }));
  return { member, stored, preferences, consents, consentRows, watchlist };
}

function eligibility(identity, state, group, now) {
  const owner = [identity.issuer, identity.subject], channel = group[0].channel;
  const consent = state.consentRows.find(row => row?.channel === channel);
  if (!state.stored || !consent) return { sql: '0', values: [] };
  const flag = channel === 'email' ? 'email_enabled' : 'sms_enabled';
  const parts = ["EXISTS (SELECT 1 FROM memberships WHERE issuer = ? AND subject = ? AND plan_code = 'PREMIUM' AND subscription_status = 'active' AND paid_through > ? AND payment_verified_at > 0 AND payment_verified_at <= ? AND payment_verified_at < paid_through)",
    `EXISTS (SELECT 1 FROM notification_preferences WHERE issuer = ? AND subject = ? AND ${flag} = 1 AND country = ? AND time_zone = ? AND language = ? AND frequency = ? AND brands_json = ? AND categories_json = ?)`,
    '(SELECT id FROM notification_consents WHERE issuer = ? AND subject = ? AND channel = ? ORDER BY occurred_at DESC, id DESC LIMIT 1) = ?',
    '(SELECT granted FROM notification_consents WHERE issuer = ? AND subject = ? AND channel = ? ORDER BY occurred_at DESC, id DESC LIMIT 1) = 1',
    '(SELECT occurred_at FROM notification_consents WHERE issuer = ? AND subject = ? AND channel = ? ORDER BY occurred_at DESC, id DESC LIMIT 1) <= ?'];
  const values = [...owner, now, now, ...owner, state.stored.country, state.stored.time_zone, state.stored.language, state.stored.frequency,
    state.stored.brands_json, state.stored.categories_json, ...owner, channel, consent.id, ...owner, channel, ...owner, channel, now];
  for (const candidate of group) {
    const event = candidate.event;
    if (event.type === 'target_reached') {
      parts.push('EXISTS (SELECT 1 FROM product_watchlists WHERE issuer = ? AND subject = ? AND product_id = ? AND currency = ? AND target_price >= ?)');
      values.push(...owner, event.productId, event.currentPrice.currency, event.currentPrice.amount);
    } else if (event.type === 'price_drop' || !state.preferences.brands.includes(event.brand) && !state.preferences.categories.includes(event.category)) {
      parts.push('EXISTS (SELECT 1 FROM product_watchlists WHERE issuer = ? AND subject = ? AND product_id = ?)');
      values.push(...owner, event.productId);
    }
  }
  return { sql: parts.map(part => `(${part})`).join(' AND '), values };
}

function templateFor(group, language, unsubscribeUrl) {
  const templates = group.map(candidate => renderNotificationTemplate({ event: candidate.event, channel: candidate.channel, language, demo: true, unsubscribeUrl }));
  if (templates.length === 1) return templates[0];
  const title = language === 'en' ? group[0].frequency === 'weekly' ? 'Weekly preview summary' : 'Daily preview summary'
    : group[0].frequency === 'weekly' ? '주간 모의 요약' : '일간 모의 요약';
  return { ...templates[0], subject: `[A1 FASHION · DEMO] ${title}`, text: templates.map(item => item.text).join('\n\n'), eventCount: templates.length };
}

/** Called only after route authentication; eligibility is independently checked again in SQL. */
export async function runMemberPromotionSimulation(db, { identity, now = Date.now(), clock = () => now, origin = 'https://a1fashion.pages.dev' } = {}) {
  if (typeof db?.prepare !== 'function') throw new MemberDataError(503, 'setup_required');
  if (!validIdentity(identity) || !validTime(now)) throw new MemberDataError(400, 'invalid_request');
  identity = { issuer: identity.issuer, subject: identity.subject };
  if (typeof clock !== 'function') throw new MemberDataError(400, 'invalid_request');
  const currentTime = () => { const value = clock(); if (!validTime(value) || value < now) throw new MemberDataError(503, 'setup_required'); return value; };
  let unsubscribeUrl;
  try { const url = new URL(origin); if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash || url.pathname !== '/') throw new Error(); unsubscribeUrl = `${url.origin}/global.html#alerts`; }
  catch { throw new MemberDataError(400, 'invalid_request'); }
  try {
    const state = await context(db, identity, now);
    const stillEligible = (group, time) => {
      const current = buildNotificationCandidates({ ...state, events: group.map(item => item.event), now: time, mode: 'DRY_RUN' });
      return group.every(item => current.some(row => row.channel === item.channel && row.event.id === item.event.id && row.window === item.window));
    };
    const candidates = buildNotificationCandidates({ ...state, events: demoPromotionEvents(now), now, mode: 'DRY_RUN' });
    const groups = new Map();
    for (const candidate of candidates) {
      const key = `${candidate.channel}:${candidate.window}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(candidate);
    }
    const result = { mode: 'DEMO', sent: false, created: 0, duplicates: 0, suppressed: 0,
      eventCount: new Set(candidates.map(item => item.event.id)).size, previews: [], reason: null };
    for (const group of groups.values()) {
      const first = group[0], owner = [identity.issuer, identity.subject];
      const claimTime = currentTime();
      if (!stillEligible(group, claimTime)) { result.suppressed++; continue; }
      const key = await notificationDeliveryKey(first.frequency === 'immediate' ? first : { ...first, event: { ...first.event, id: 'digest' } });
      // A DEMO claim must never consume the idempotency key of a future real alert.
      const dedupe = `demo-simulation:${key}`, id = crypto.randomUUID(), guard = eligibility(identity, state, group, claimTime);
      const inserted = await db.prepare(`INSERT INTO notification_deliveries (issuer, subject, id, channel, event_id, dedupe_key, status, created_at, payload_json)
        SELECT ?, ?, ?, ?, ?, ?, 'pending', ?, '{}' WHERE ${guard.sql}
        ON CONFLICT(issuer, subject, channel, dedupe_key) DO NOTHING RETURNING id`)
        .bind(...owner, id, first.channel, first.event.id, dedupe, claimTime, ...guard.values).first();
      if (!inserted) {
        const prior = await db.prepare('SELECT id FROM notification_deliveries WHERE issuer = ? AND subject = ? AND channel = ? AND dedupe_key = ?').bind(...owner, first.channel, dedupe).first();
        if (prior) result.duplicates++; else result.suppressed++;
        continue;
      }
      const template = templateFor(group, state.preferences.language, unsubscribeUrl);
      const payload = JSON.stringify({ mode: 'DEMO', sent: false, template, eventTypes: group.map(item => item.event.type), eventCount: group.length });
      const finishTime = currentTime(), finishGuard = eligibility(identity, state, group, finishTime);
      const updated = stillEligible(group, finishTime) && await db.prepare(`UPDATE notification_deliveries SET status = 'simulated', payload_json = ?
        WHERE issuer = ? AND subject = ? AND id = ? AND status = 'pending' AND ${finishGuard.sql} RETURNING id`)
        .bind(payload, ...owner, id, ...finishGuard.values).first();
      const publishTime = currentTime(), publishGuard = eligibility(identity, state, group, publishTime);
      const current = updated && stillEligible(group, publishTime) && await db.prepare(`SELECT id FROM notification_deliveries WHERE issuer = ? AND subject = ? AND id = ? AND status = 'simulated' AND ${publishGuard.sql}`)
        .bind(...owner, id, ...publishGuard.values).first();
      if (!current) {
        await db.prepare("UPDATE notification_deliveries SET status = 'canceled', payload_json = '{}' WHERE issuer = ? AND subject = ? AND id = ? AND status IN ('pending','simulated')").bind(...owner, id).run();
        result.suppressed++; continue;
      }
      result.created++;
      result.previews.push({ channel: first.channel, template, eventTypes: group.map(item => item.event.type) });
    }
    if (!candidates.length) result.reason = !state.preferences.emailEnabled && !state.preferences.smsEnabled ? 'preferences_disabled'
      : !state.consents.some(item => item.granted && item.grantedAt <= now) ? 'consent_required' : 'no_matching_interests';
    else if (result.suppressed) result.reason = 'preferences_changed';
    else if (!result.created && result.duplicates) result.reason = 'already_simulated';
    return result;
  } catch (error) {
    if (error instanceof MemberDataError) throw error;
    throw new MemberDataError(503, 'setup_required');
  }
}
