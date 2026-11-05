import { AccessError, authenticateMember, authorizeMember, jsonResponse } from '../../../server/premium-access.mjs';
import { MemberDataError, MemberStore, exactFields, normalizePreferences, normalizeWatchlist, currency } from '../../../server/member-data.mjs';
import { listGlobalRetailers } from '../../../server/global-retailers.mjs';
import { demoComparison } from '../../../server/demo-offers.mjs';
import { renderNotificationTemplate, validateE164 } from '../../../server/notifications.mjs';
import { requestLanguage } from '../../../server/locale.mjs';

const methods = { account: ['GET'], retailers: ['POST'], comparison: ['POST'], watchlist: ['GET', 'POST', 'DELETE'],
  preferences: ['GET', 'PUT', 'DELETE'], consents: ['POST'], history: ['GET', 'DELETE'], preview: ['POST'] };
const messages = {
  invalid_request: ['입력 내용을 확인해주세요.', 'Please check your input.'],
  authentication_required: ['로그인이 필요합니다.', 'Please sign in.'],
  subscription_required: ['유효한 일반 또는 프리미엄 구독이 필요합니다.', 'An active General or Premium subscription is required.'],
  premium_required: ['프리미엄 구독이 필요합니다.', 'An active Premium subscription is required.'],
  setup_required: ['이 기능의 서버 연결과 데이터베이스 준비가 필요합니다.', 'Server and database setup is required for this feature.'],
  forbidden_origin: ['사이트에서 다시 시도해주세요.', 'Please make this request from the site.'],
  request_too_large: ['요청 크기가 너무 큽니다.', 'The request is too large.'],
  method_not_allowed: ['지원하지 않는 요청 방식입니다.', 'This request method is not supported.'],
  consent_required: ['해당 채널의 별도 수신 동의가 필요합니다.', 'Separate consent for this channel is required.'],
  rate_limited: ['요청 한도에 도달했습니다. 잠시 후 다시 시도해주세요.', 'Request limit reached. Please try again later.'],
  watchlist_limit: ['관심 목록은 최대 100개까지 저장할 수 있습니다.', 'You can save up to 100 watchlist items.'],
  not_found: ['항목을 찾지 못했습니다.', 'The item was not found.']
};
async function body(request) {
  if (request.headers.get('Origin') !== new URL(request.url).origin || request.headers.get('Sec-Fetch-Site') === 'cross-site') throw new MemberDataError(403, 'forbidden_origin');
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('Content-Type') || '') || request.headers.has('Content-Encoding') && request.headers.get('Content-Encoding') !== 'identity') throw new MemberDataError(400, 'invalid_request');
  const length = request.headers.get('Content-Length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > 8192)) throw new MemberDataError(Number(length) > 8192 ? 413 : 400, Number(length) > 8192 ? 'request_too_large' : 'invalid_request');
  const reader = request.body?.getReader();
  let size = 0; const chunks = [];
  if (reader) try {
    for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength;
      if (size > 8192) { await reader.cancel(); throw new MemberDataError(413, 'request_too_large'); } chunks.push(value); }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new MemberDataError(400, 'invalid_request'); }
}
function safeFilters(value) {
  exactFields(value, ['country', 'destination', 'currency', 'gender', 'brand', 'category', 'style', 'minPrice', 'maxPrice', 'size', 'query'], []);
  if (value.query !== undefined && (typeof value.query !== 'string' || value.query.length > 120 || /[\u0000-\u001f\u007f]/u.test(value.query))) throw new MemberDataError(400, 'invalid_request');
  return value;
}
function empty(value) { exactFields(value, []); }
function preferencesResult(store) { return Promise.all([store.preferences(), store.consents()]).then(([preferences, consents]) => ({ preferences, consents, mode: 'DRY_RUN', liveDeliveryEnabled: false })); }
function errorResponse(error, language, allow) {
  const known = error instanceof AccessError || error instanceof MemberDataError;
  const status = known ? error.status : error instanceof TypeError ? 400 : 503;
  let code = known ? error.code : error instanceof TypeError ? 'invalid_request' : 'setup_required';
  if (!Object.hasOwn(messages, code)) code = status === 401 ? 'authentication_required' : status === 403 ? 'subscription_required' : 'setup_required';
  return jsonResponse({ ok: false, allowed: false, error: code, message: messages[code][language === 'en' ? 1 : 0] }, status,
    { 'Content-Language': language, ...(allow ? { Allow: allow.join(', ') } : {}), ...(status === 429 ? { 'Retry-After': '3600' } : {}) });
}

export async function handleGlobalRequest(resource, { request, env }, options = {}) {
  const now = options.now ?? Date.now(), language = requestLanguage(request);
  const respond = (value, status = 200) => jsonResponse(value, status, { 'Content-Language': language,
    Vary: 'Authorization, Cookie, Cf-Access-Jwt-Assertion, Accept-Language' });
  try {
    if (!methods[resource]) throw new MemberDataError(404, 'not_found');
    if (!methods[resource].includes(request.method)) return errorResponse(new MemberDataError(405, 'method_not_allowed'), language, methods[resource]);
    if (new URL(request.url).search) throw new MemberDataError(400, 'invalid_request');
    if (!Number.isSafeInteger(now) || now < 0) throw new MemberDataError(503, 'setup_required');
    const authOptions = { now, ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}) };
    if (resource === 'account') {
      if (typeof env?.MEMBERSHIP_DB?.prepare !== 'function') {
        await authenticateMember(request, env, authOptions);
        return respond({ plan: 'FREE', subscription: { active: false, accessUntil: null }, mode: 'DRY_RUN', databaseConfigured: false });
      }
      let access;
      try { access = await authorizeMember(request, env, { ...authOptions, requiredTier: 'GENERAL' }); }
      catch (error) {
        if (!(error instanceof AccessError && error.status === 403)) throw error;
        access = await authorizeMember(request, env, { ...authOptions, requiredTier: 'FREE' });
      }
      await new MemberStore(env.MEMBERSHIP_DB, access.identity, now).rateLimit();
      return respond({ plan: access.plan, subscription: { active: access.plan !== 'FREE', accessUntil: access.accessUntil }, mode: 'DRY_RUN', databaseConfigured: true });
    }
    const value = request.method === 'GET' ? null : await body(request);
    const withdrawal = resource === 'consents' && value?.granted === false;
    const deletion = request.method === 'DELETE';
    const ownRecordRead = request.method === 'GET' && ['watchlist', 'preferences', 'history'].includes(resource);
    const tier = ['comparison', 'preferences', 'consents', 'history', 'preview'].includes(resource) ? 'PREMIUM' : 'GENERAL';
    const access = withdrawal || deletion || ownRecordRead
      ? { identity: await authenticateMember(request, env, authOptions), plan: 'FREE' }
      : await authorizeMember(request, env, { ...authOptions, requiredTier: tier });
    const store = new MemberStore(env.MEMBERSHIP_DB, access.identity, now);
    // Reads consume the same owner-scoped quota as writes. Privacy withdrawal
    // and erasure remain available even when the hourly quota is exhausted.
    if (!withdrawal && !deletion) await store.rateLimit();
    if (resource === 'retailers') return respond(listGlobalRetailers(safeFilters(value), { language }));
    if (resource === 'comparison') {
      exactFields(value, ['destination', 'currency', 'productId'], ['destination', 'currency']);
      currency(value.currency);
      return respond(demoComparison({ ...value, now }));
    }
    if (resource === 'watchlist') {
      if (request.method === 'GET') return respond({ items: await store.watches() });
      if (request.method === 'DELETE') { exactFields(value, ['id']); await store.deleteWatch(value.id); return respond({ ok: true }); }
      const watch = normalizeWatchlist(value);
      if (watch.targetPrice !== null && access.plan !== 'PREMIUM') throw new MemberDataError(403, 'premium_required');
      return respond({ ok: true, items: await store.saveWatch(watch) }, 201);
    }
    if (resource === 'preferences') {
      if (request.method === 'GET') return respond(await preferencesResult(store));
      if (request.method === 'DELETE') { empty(value); await store.eraseNotificationData(); return respond({ ok: true, ...(await preferencesResult(store)) }); }
      const normalized = normalizePreferences(value);
      if (normalized.phone && !validateE164(normalized.phone, normalized.country).valid) throw new MemberDataError(400, 'invalid_request');
      await store.savePreferences(normalized);
      return respond({ ok: true, ...(await preferencesResult(store)) });
    }
    if (resource === 'consents') {
      exactFields(value, ['channel', 'granted']);
      if (!['email', 'sms'].includes(value.channel) || typeof value.granted !== 'boolean') throw new MemberDataError(400, 'invalid_request');
      return respond({ ok: true, consents: await store.saveConsent(value.channel, value.granted), mode: 'DRY_RUN' });
    }
    if (resource === 'history') {
      if (request.method === 'DELETE') { empty(value); await store.deleteHistory(); return respond({ ok: true }); }
      return respond({ deliveries: await store.history(), mode: 'DRY_RUN', liveDeliveryEnabled: false });
    }
    if (resource === 'preview') {
      exactFields(value, ['channel']);
      if (!['email', 'sms'].includes(value.channel)) throw new MemberDataError(400, 'invalid_request');
      const prefs = await store.preferences();
      const template = renderNotificationTemplate({ channel: value.channel, language: prefs.language,
        event: { id: 'demo-alert-preview', type: 'price_drop', title: 'DEMO price alert', brand: 'A1 DEMO', productId: 'demo-tee',
          currentPrice: { amount: 39, currency: 'USD' }, previousPrice: { amount: 49, currency: 'USD' }, demo: true },
        demo: true, unsubscribeUrl: `${new URL(request.url).origin}/global.html#alerts` });
      return respond(await store.savePreview(value.channel, template));
    }
    throw new MemberDataError(404, 'not_found');
  } catch (error) { return errorResponse(error, language); }
}
