/** Premium notifications. All inputs containing identities must come from trusted server reads. */
import { evaluateAccess } from './membership-policy.mjs';
import { deliverNotification } from './notification-adapters.mjs';

if (typeof window !== 'undefined' || typeof document !== 'undefined') throw new Error('Notifications are server-only.');

const COUNTRIES = new Set(['KR', 'US', 'JP', 'GB', 'EU', 'DE', 'FR', 'IT', 'ES', 'NL']);
const CURRENCIES = new Set(['KRW', 'USD', 'EUR', 'GBP', 'JPY']);
const FREQUENCIES = new Set(['immediate', 'daily', 'weekly']);
const EVENT_TYPES = new Set(['price_drop', 'target_reached', 'brand_promotion', 'promotion_start', 'promotion_ending']);
const DAY = 86400000;
const validTime = value => Number.isSafeInteger(value) && value >= 0 && value <= 8_640_000_000_000_000;
const safeId = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,160}$/.test(value);
const safeText = (value, max = 160) => typeof value === 'string' && value.length <= max && !/[\u0000-\u001f\u007f]/u.test(value);
const object = value => value && typeof value === 'object' && !Array.isArray(value);

export class NotificationValidationError extends Error {
  constructor(code = 'invalid-preferences') { super(code); this.code = code; }
}

export function normalizeNotificationPreferences(input = {}) {
  const allowed = ['emailEnabled', 'smsEnabled', 'country', 'timeZone', 'language', 'frequency', 'brands', 'categories'];
  if (!object(input) || Object.keys(input).some(key => !allowed.includes(key))) throw new NotificationValidationError();
  const preferences = { emailEnabled: false, smsEnabled: false, country: 'KR', timeZone: 'Asia/Seoul',
    language: 'ko', frequency: 'daily', brands: [], categories: [], ...input };
  if (typeof preferences.emailEnabled !== 'boolean' || typeof preferences.smsEnabled !== 'boolean'
    || !COUNTRIES.has(preferences.country) || !['ko', 'en'].includes(preferences.language)
    || !FREQUENCIES.has(preferences.frequency) || !safeText(preferences.timeZone, 80)) throw new NotificationValidationError();
  try { new Intl.DateTimeFormat('en', { timeZone: preferences.timeZone }).format(0); }
  catch { throw new NotificationValidationError('invalid-time-zone'); }
  for (const field of ['brands', 'categories']) {
    if (!Array.isArray(preferences[field]) || preferences[field].length > 20
      || preferences[field].some(value => !safeText(value, 80) || !value.trim())) throw new NotificationValidationError();
    preferences[field] = [...new Set(preferences[field].map(value => value.trim()))];
  }
  return Object.freeze({ ...preferences, brands: Object.freeze(preferences.brands), categories: Object.freeze(preferences.categories) });
}

export function validateE164(phone, country) {
  const prefixes = { KR: '82', US: '1', JP: '81', GB: '44', DE: '49', FR: '33', IT: '39', ES: '34', NL: '31' };
  const valid = typeof phone === 'string' && /^\+[1-9]\d{7,14}$/.test(phone)
    && (!country || country === 'EU' || phone.startsWith(`+${prefixes[country] || 'unsupported'}`));
  return Object.freeze({ valid, normalized: valid ? phone : null, ownershipVerified: false });
}

function unsubscribeLink(value) {
  try { const url = new URL(value); if (url.protocol === 'https:' && !url.username && !url.password && !url.port) return url.href; }
  catch { /* Invalid links cannot appear in a preview. */ }
  throw new NotificationValidationError('invalid-unsubscribe-url');
}

function priceText(value, language) {
  if (!object(value) || !CURRENCIES.has(value.currency) || !Number.isFinite(value.amount) || value.amount < 0) return language === 'en' ? 'Price not confirmed' : '가격 확인 전';
  return `${value.currency} ${new Intl.NumberFormat(language === 'en' ? 'en-US' : 'ko-KR', { maximumFractionDigits: 2 }).format(value.amount)}`;
}

export function renderNotificationTemplate({ event = {}, channel = 'email', language = 'ko',
  unsubscribeUrl = 'https://a1fashion.pages.dev/global.html#alerts', demo = true } = {}) {
  if (!['email', 'sms'].includes(channel) || !['ko', 'en'].includes(language)) throw new NotificationValidationError('invalid-template');
  const link = unsubscribeLink(unsubscribeUrl);
  const title = safeText(event.title) && event.title ? event.title : language === 'en' ? 'Your watched style' : '관심 스타일';
  const labels = language === 'en'
    ? { price_drop: 'Price drop', target_reached: 'Target price reached', brand_promotion: 'Brand promotion', promotion_start: 'Promotion started', promotion_ending: 'Promotion ending soon' }
    : { price_drop: '가격 인하', target_reached: '목표 가격 도달', brand_promotion: '브랜드 프로모션', promotion_start: '할인 행사 시작', promotion_ending: '할인 종료 예정' };
  const label = labels[event.type] || (language === 'en' ? 'Promotion alert' : '프로모션 알림');
  const subject = `[A1 FASHION · DEMO] ${label}`;
  const intro = language === 'en' ? 'DEMO PREVIEW — No real message is sent.' : 'DEMO 예시 미리보기 — 실제 메시지는 발송하지 않습니다.';
  const footer = language === 'en' ? 'Manage preferences or unsubscribe:' : '수신 설정 변경 및 수신 거부:';
  const text = `${intro}\n${label}: ${title}\n${priceText(event.currentPrice, language)}\n${footer} ${link}`;
  return Object.freeze({ mode: 'DRY_RUN', demo: true, channel, subject, text, unsubscribeUrl: link,
    liveDeliveryEnabled: false, sourceMode: demo || event.demo ? 'DEMO' : 'VERIFIED_SOURCE_PREVIEW' });
}

function currentConsent(consents, channel, now, owner) {
  const relevant = Array.isArray(consents) ? consents.filter(item => item?.channel === channel
    && item.issuer === owner.issuer && item.subject === owner.subject
    && validTime(item.grantedAt) && item.grantedAt <= now) : [];
  const effectiveTime = item => Math.max(item.grantedAt,
    validTime(item.revokedAt) && item.revokedAt <= now ? item.revokedAt : 0);
  // A withdrawal wins an exact timestamp tie. Invalid revocation values must
  // never turn an untrusted/malformed consent record into permission.
  relevant.sort((a, b) => effectiveTime(b) - effectiveTime(a)
    || Number(a.granted === true) - Number(b.granted === true));
  const consent = relevant[0];
  return Boolean(consent?.granted === true && (consent.revokedAt == null
    || validTime(consent.revokedAt) && consent.revokedAt > now));
}

function premium(member, now) { return evaluateAccess(member, now, 'PREMIUM').allowed; }
function money(value) { return object(value) && CURRENCIES.has(value.currency) && Number.isFinite(value.amount) && value.amount >= 0 && value.amount <= 1e9; }
function sameMoney(a, b) { return money(a) && money(b) && a.currency === b.currency; }

function sourceEligible(event, now, mode) {
  if (!validTime(event.checkedAt) || event.checkedAt > now) return false;
  if (event.demo === true || event.source?.mode === 'DEMO') return mode === 'DRY_RUN' && now - event.checkedAt <= DAY;
  return event.source?.approved === true && ['official_api', 'official_feed'].includes(event.source.kind)
    && event.verified === true && Number.isSafeInteger(event.source.maxAgeMs) && event.source.maxAgeMs > 0
    && now - event.checkedAt <= Math.min(event.source.maxAgeMs, DAY)
    && (event.source.expiresAt == null || validTime(event.source.expiresAt) && event.source.expiresAt > now);
}

function minimalEvent(event) {
  // Never retain an entire source row: body photos, analysis fields, recipient
  // contacts and unrelated source metadata do not belong in a notification.
  const result = {};
  for (const key of ['id', 'type', 'title', 'brand', 'productId', 'category']) {
    if (safeText(event[key])) result[key] = event[key];
  }
  for (const key of ['checkedAt', 'startsAt', 'endsAt']) if (validTime(event[key])) result[key] = event[key];
  for (const key of ['demo', 'verified']) if (typeof event[key] === 'boolean') result[key] = event[key];
  for (const key of ['currentPrice', 'previousPrice']) if (money(event[key])) {
    result[key] = { amount: event[key].amount, currency: event[key].currency };
  }
  if (object(event.source)) {
    result.source = {};
    for (const key of ['id', 'mode', 'kind']) if (safeText(event.source[key])) result.source[key] = event.source[key];
    if (typeof event.source.approved === 'boolean') result.source.approved = event.source.approved;
    for (const key of ['maxAgeMs', 'expiresAt']) if (validTime(event.source[key])) result.source[key] = event.source[key];
  }
  return structuredClone(result);
}

function eventMatches(event, watch, preferences, now) {
  if (!safeId(event.id) || !EVENT_TYPES.has(event.type) || !safeText(event.title)) return false;
  const productMatch = watch.some(item => item.productId === event.productId);
  const brandMatch = safeText(event.brand, 80) && preferences.brands.includes(event.brand);
  const categoryMatch = safeText(event.category, 80) && preferences.categories.includes(event.category);
  if (!productMatch && !brandMatch && !categoryMatch) return false;
  if (event.type === 'price_drop') return productMatch && sameMoney(event.previousPrice, event.currentPrice) && event.currentPrice.amount < event.previousPrice.amount;
  if (event.type === 'target_reached') return watch.some(item => item.productId === event.productId
    && sameMoney(item.targetPrice, event.currentPrice) && event.currentPrice.amount <= item.targetPrice.amount);
  const active = validTime(event.startsAt) && validTime(event.endsAt) && event.startsAt <= now && event.endsAt > now;
  if (event.type === 'promotion_ending') return active && event.endsAt - now <= DAY;
  return active;
}

function windowFor(preferences, now, eventId) {
  if (preferences.frequency === 'immediate') return `event:${eventId}`;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: preferences.timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map(part => [part.type, part.value]));
  let day = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  if (preferences.frequency === 'weekly') day -= ((new Date(day).getUTCDay() + 6) % 7) * DAY;
  return `${preferences.frequency}:${preferences.timeZone}:${new Date(day).toISOString().slice(0, 10)}`;
}

/** Returns private candidates. Do not serialize owner identities or source rows to a public API. */
export function buildNotificationCandidates({ member, preferences = {}, consents = [], watchlist = [], events = [], now = Date.now(), mode = 'DRY_RUN' } = {}) {
  if (!validTime(now) || mode !== 'DRY_RUN' || !premium(member, now)) return [];
  const prefs = normalizeNotificationPreferences(preferences);
  const watch = Array.isArray(watchlist) ? watchlist.filter(item => item?.issuer === member.issuer && item?.subject === member.subject).slice(0, 100) : [];
  const channels = ['email', 'sms'].filter(channel => prefs[`${channel}Enabled`] && currentConsent(consents, channel, now, member));
  const seen = new Set(), result = [];
  for (const event of (Array.isArray(events) ? events : []).slice(0, 1000)) {
    if (!object(event) || !sourceEligible(event, now, mode) || !eventMatches(event, watch, prefs, now) || seen.has(event.id)) continue;
    seen.add(event.id);
    for (const channel of channels) result.push(Object.freeze({ owner: Object.freeze({ issuer: member.issuer, subject: member.subject }),
      channel, event: minimalEvent(event), window: windowFor(prefs, now, event.id), frequency: prefs.frequency,
      createdAt: now, demo: event.demo === true || event.source?.mode === 'DEMO' }));
  }
  return result;
}

async function hash(parts) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(parts)));
  return [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join('');
}
export async function notificationDeliveryKey(candidate) {
  return hash(['a1-alert-v1', candidate.owner.issuer, candidate.owner.subject, candidate.event.id, candidate.channel, candidate.window]);
}

function contextBlock(context, candidate, now) {
  if (!context || context.member?.issuer !== candidate.owner.issuer || context.member?.subject !== candidate.owner.subject) return 'owner-mismatch';
  if (!premium(context.member, now)) return 'premium-required';
  const prefs = normalizeNotificationPreferences(context.preferences);
  if (!prefs[`${candidate.channel}Enabled`] || !currentConsent(context.consents, candidate.channel, now, context.member)) return 'consent-withdrawn';
  if (candidate.frequency !== prefs.frequency || candidate.window !== windowFor(prefs, now, candidate.event.id)) return 'preferences-changed';
  const currentWatchlist = Array.isArray(context.watchlist) ? context.watchlist.filter(item => item?.issuer === context.member.issuer && item?.subject === context.member.subject) : [];
  if (!sourceEligible(candidate.event, now, 'DRY_RUN') || !eventMatches(candidate.event, currentWatchlist, prefs, now)) return 'event-no-longer-eligible';
  if (context.suppressed === true || context.bounced === true) return 'recipient-suppressed';
  if (candidate.channel === 'email' && (context.emailVerified !== true || !safeText(context.email, 254)
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(context.email))) return 'verified-email-required';
  if (candidate.channel === 'sms' && (context.phoneVerified !== true || !validateE164(context.phone, prefs.country).valid)) return 'verified-phone-required';
  const limits = context.limits;
  if (!object(limits) || !Number.isSafeInteger(limits.monthlyMessages) || limits.monthlyMessages < 1
    || !Number.isSafeInteger(context.messagesThisMonth) || context.messagesThisMonth < 0
    || context.messagesThisMonth >= limits.monthlyMessages) return 'volume-limit';
  if (candidate.channel === 'sms' && (!Number.isFinite(context.estimatedUnitCost) || context.estimatedUnitCost < 0
    || !Number.isFinite(limits.monthlyCost) || limits.monthlyCost < 0 || !Number.isFinite(context.costThisMonth)
    || context.costThisMonth < 0 || context.costThisMonth + context.estimatedUnitCost > limits.monthlyCost)) return 'cost-unknown-or-limit';
  return null;
}

/** claimDelivery must atomically enforce its idempotency key in persistent storage. */
export async function processNotificationCandidates(candidates, { loadContext, claimDelivery, recordDelivery,
  now = Date.now(), mode = 'DRY_RUN' } = {}) {
  if (mode !== 'DRY_RUN') return [{ status: 'blocked', reason: 'live-delivery-disabled', sent: false }];
  if (!validTime(now) || typeof loadContext !== 'function' || typeof claimDelivery !== 'function' || typeof recordDelivery !== 'function') throw new NotificationValidationError('missing-delivery-repository');
  const results = [], groups = new Map();
  for (const candidate of (Array.isArray(candidates) ? candidates : []).slice(0, 2000)) {
    if (!candidate?.owner || !safeId(candidate.event?.id) || !['email', 'sms'].includes(candidate.channel)
      || !safeText(candidate.window, 180)) continue;
    const group = JSON.stringify([candidate.owner.issuer, candidate.owner.subject, candidate.channel, candidate.window]);
    if (!groups.has(group)) groups.set(group, []);
    if (!groups.get(group).some(item => item.event.id === candidate.event.id)) groups.get(group).push(candidate);
  }
  for (const group of groups.values()) {
    const candidate = group[0];
    const context = await loadContext(candidate);
    const blocked = group.map(item => contextBlock(context, item, now)).find(Boolean);
    if (blocked) { results.push({ status: 'blocked', reason: blocked, sent: false, channel: candidate.channel }); continue; }
    const eventKeys = await Promise.all(group.map(notificationDeliveryKey));
    const idempotencyKey = candidate.frequency === 'immediate' ? eventKeys[0]
      : await hash(['a1-digest-v1', candidate.owner.issuer, candidate.owner.subject, candidate.channel, candidate.window]);
    const record = { idempotencyKey, eventKeys, ownerIssuer: candidate.owner.issuer, ownerSubject: candidate.owner.subject,
      channel: candidate.channel, eventIds: group.map(item => item.event.id), window: candidate.window, createdAt: now, mode: 'DRY_RUN' };
    if (!await claimDelivery(record)) { results.push({ idempotencyKey, status: 'duplicate', sent: false }); continue; }
    // Read trusted current records again after the asynchronous claim. A queued
    // job must not survive a subscription change or channel-consent withdrawal.
    const current = await loadContext(candidate);
    const changed = group.map(item => contextBlock(current, item, now)).find(Boolean);
    if (changed) {
      await recordDelivery({ ...record, status: 'blocked', reason: changed, sent: false });
      results.push({ idempotencyKey, status: 'blocked', reason: changed, sent: false }); continue;
    }
    const prefs = normalizeNotificationPreferences(current.preferences);
    const previews = group.map(item => renderNotificationTemplate({ event: item.event, channel: item.channel,
      language: prefs.language, unsubscribeUrl: current.unsubscribeUrl, demo: item.demo }));
    const delivery = await deliverNotification({ channel: candidate.channel, previews }, { mode });
    await recordDelivery({ ...record, status: delivery.status, sent: false });
    results.push({ idempotencyKey, status: delivery.status, sent: false, channel: candidate.channel,
      eventCount: group.length, mode: 'DRY_RUN', previews });
  }
  return results;
}
