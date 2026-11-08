import { isFreeBetaMode } from './free-beta.mjs';
/** Private member data. Every SQL operation scopes ownership to issuer + subject. */
export class MemberDataError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}
const countries = new Set(['KR', 'US', 'JP', 'GB', 'EU', 'DE', 'FR', 'IT', 'ES', 'NL']);
const currencies = new Set(['KRW', 'USD', 'EUR', 'GBP', 'JPY']);
const currenciesWithoutDecimals = new Set(['KRW', 'JPY']);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function exactFields(value, allowed, required = allowed) {
  if (!object(value) || Object.keys(value).some(key => !allowed.includes(key))
    || required.some(key => !own(value, key))) throw new MemberDataError(400, 'invalid_request');
  return value;
}
function text(value, max = 100) {
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u001f\u007f]/u.test(value)) throw new MemberDataError(400, 'invalid_request');
  return value.trim();
}
function list(value) {
  if (!Array.isArray(value) || value.length > 20) throw new MemberDataError(400, 'invalid_request');
  return [...new Set(value.map(item => text(item, 80)).filter(Boolean))];
}
export function currency(value) {
  if (!currencies.has(value)) throw new MemberDataError(400, 'invalid_request');
  return value;
}
export function amount(value, code) {
  if (value === null) return null;
  const precision = currenciesWithoutDecimals.has(code) ? 1 : 100;
  if (!Number.isFinite(value) || value < 0 || value > 100_000_000
    || Math.abs(value * precision - Math.round(value * precision)) > 0.000001) throw new MemberDataError(400, 'invalid_request');
  return value;
}
export function normalizeWatchlist(value) {
  exactFields(value, ['productId', 'currency', 'targetPrice', 'brand', 'category'], ['productId', 'currency']);
  const productId = text(value.productId, 160);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/.test(productId)) throw new MemberDataError(400, 'invalid_request');
  const code = currency(value.currency);
  return { productId, currency: code, targetPrice: amount(value.targetPrice ?? null, code),
    brand: text(value.brand ?? '', 80), category: text(value.category ?? '', 80) };
}
export function normalizePreferences(value) {
  exactFields(value, ['country', 'timeZone', 'language', 'frequency', 'emailEnabled', 'smsEnabled', 'phone', 'brands', 'categories'],
    ['country', 'timeZone', 'language', 'frequency', 'emailEnabled', 'smsEnabled', 'brands', 'categories']);
  if (!countries.has(value.country) || !['ko', 'en'].includes(value.language)
    || !['immediate', 'daily', 'weekly'].includes(value.frequency)
    || typeof value.emailEnabled !== 'boolean' || typeof value.smsEnabled !== 'boolean') throw new MemberDataError(400, 'invalid_request');
  const timeZone = text(value.timeZone, 64);
  try { new Intl.DateTimeFormat('en', { timeZone }).format(); } catch { throw new MemberDataError(400, 'invalid_request'); }
  const result = { country: value.country, timeZone, language: value.language, frequency: value.frequency,
    emailEnabled: value.emailEnabled, smsEnabled: value.smsEnabled, brands: list(value.brands), categories: list(value.categories) };
  if (own(value, 'phone')) {
    const phone = text(value.phone, 20);
    if (phone && !/^\+[1-9]\d{6,14}$/.test(phone)) throw new MemberDataError(400, 'invalid_request');
    result.phone = phone || null;
  }
  return result;
}
function id() { return crypto.randomUUID(); }
function safeParse(value, fallback) { try { return JSON.parse(value); } catch { return fallback; } }
function masked(value) { return typeof value === 'string' && value ? value.slice(0, 3) + '••••••' + value.slice(-2) : ''; }

export const CONSENT_POLICY_VERSION = 'a1-marketing-v2';
export function consentNotice(channel, language = 'ko', granted = true) {
  if (!['email', 'sms'].includes(channel) || !['ko', 'en'].includes(language) || typeof granted !== 'boolean') throw new MemberDataError(400, 'invalid_request');
  if (!granted) return language === 'en'
    ? `I withdraw consent to A1 FASHION ${channel === 'email' ? 'marketing emails' : 'marketing SMS messages'}. Future simulated alerts for this channel will stop.`
    : `A1 FASHION의 ${channel === 'email' ? '이메일' : 'SMS'} 마케팅 수신 동의를 철회합니다. 이 채널의 이후 모의 알림도 중단합니다.`;
  return language === 'en'
    ? `I separately agree to A1 FASHION watchlist price and promotion ${channel === 'email' ? 'emails' : 'SMS messages'}. This is optional and separate from registration and subscription. I can withdraw consent at any time without a fee. This service currently runs simulations without sending real messages.`
    : `A1 FASHION의 관심 상품 가격·프로모션 ${channel === 'email' ? '이메일' : 'SMS'} 수신에 별도로 동의합니다. 선택 사항이며 회원가입·구독과 별개입니다. 언제든 무료로 철회할 수 있습니다. 현재는 실제 발송 없는 모의 운영입니다.`;
}
function missingContextColumn(error) {
  for (let value = error, depth = 0; value && depth < 4; value = value.cause, depth++) {
    if (typeof value.message === 'string' && (/(?:no such column:\s*(?:notification_consents\.)?(?:country|language|notice_text)\b)/i.test(value.message)
      || /table notification_consents has no column named (?:country|language|notice_text)\b/i.test(value.message))) return true;
  }
  return false;
}
function missingPlanColumn(error) {
  for (let value = error, depth = 0; value && depth < 4; value = value.cause, depth++) {
    if (/no such column:\s*(?:memberships\.)?plan_code\b/i.test(value.message || '')) return true;
  }
  return false;
}

// Bind the request's logical time but also use SQLite's execution clock: a
// queued D1 write cannot reuse a grant that expired while it was awaiting I/O.
// The condition is part of the same statement as the protected INSERT/UPDATE.
function paidWritePermission(tier, includePlan = true) {
  const current = "MAX(?, CAST(unixepoch('subsec') * 1000 AS INTEGER))";
  return `EXISTS (SELECT 1 FROM memberships WHERE issuer = ? AND subject = ?
    AND subscription_status = 'active'
    AND typeof(paid_through) = 'integer' AND paid_through <= 8640000000000000
    AND typeof(payment_verified_at) = 'integer' AND payment_verified_at > 0
    AND paid_through > ${current} AND payment_verified_at <= ${current}
    AND payment_verified_at < paid_through
    ${includePlan ? tier === 'PREMIUM' ? "AND plan_code = 'PREMIUM'" : "AND plan_code IN ('GENERAL', 'PREMIUM')" : ''})`;
}

export class MemberStore {
  constructor(db, identity, now = Date.now(), serverPolicy = {}) {
    if (typeof db?.prepare !== 'function' || !identity?.issuer || !identity?.subject) throw new MemberDataError(503, 'setup_required');
    this.freeBeta = isFreeBetaMode(serverPolicy);
    this.db = db; this.owner = [identity.issuer, identity.subject]; this.now = now;
  }
  writePermission(tier, includePlan = true) {
    // The handler has already verified identity. Keep bound owner/time slots
    // and every row ownership predicate; beta never creates a membership row.
    return this.freeBeta ? '(length(?) > 0 AND length(?) > 0 AND ? >= 0 AND ? >= 0)' : paidWritePermission(tier, includePlan);
  }
  statement(sql, ...values) { return this.db.prepare(sql).bind(...this.owner, ...values); }
  async paidWriteAllowed(tier, includePlan = true) {
    const row = await this.db.prepare(`SELECT ${this.writePermission(tier, includePlan)} AS allowed`)
      .bind(...this.owner, this.now, this.now).first();
    return row?.allowed === 1;
  }
  async rateLimit() {
    const window = Math.floor(this.now / 3600000) * 3600000;
    const result = await this.statement('INSERT INTO api_rate_limits (issuer, subject, window_start, request_count) VALUES (?, ?, ?, 1) ON CONFLICT(issuer, subject, window_start) DO UPDATE SET request_count = request_count + 1 RETURNING request_count', window).first();
    if (!result || result.request_count > 60) throw new MemberDataError(429, 'rate_limited');
  }
  async watches() {
    const result = await this.statement('SELECT id, product_id, target_price, currency, brand, category, created_at FROM product_watchlists WHERE issuer = ? AND subject = ? ORDER BY created_at DESC LIMIT 100').all();
    return (result.results || []).map(row => ({ id: row.id, productId: row.product_id, targetPrice: row.target_price,
      currency: row.currency, brand: row.brand, category: row.category, createdAt: row.created_at }));
  }
  async saveWatch(value) {
    // The limit and write share one SQLite statement. Updating an existing
    // item remains possible when the list already contains one hundred items.
    const tier = value.targetPrice === null ? 'GENERAL' : 'PREMIUM', watchId = id();
    const write = includePlan => this.statement(`INSERT INTO product_watchlists (issuer, subject, id, product_id, target_price, currency, brand, category, created_at)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE
      (EXISTS (SELECT 1 FROM product_watchlists WHERE issuer = ? AND subject = ? AND product_id = ? AND currency = ?)
        OR (SELECT COUNT(*) FROM product_watchlists WHERE issuer = ? AND subject = ?) < 100)
      AND ${this.writePermission(tier, includePlan)}
      ON CONFLICT(issuer, subject, product_id, currency) DO UPDATE SET target_price = excluded.target_price, brand = excluded.brand, category = excluded.category RETURNING id`,
      watchId, value.productId, value.targetPrice, value.currency, value.brand, value.category, this.now,
      ...this.owner, value.productId, value.currency, ...this.owner, ...this.owner, this.now, this.now).first();
    let written, includePlan = true;
    try { written = await write(true); }
    catch (error) {
      if (!missingPlanColumn(error)) throw error;
      if (tier === 'PREMIUM') throw new MemberDataError(403, 'premium_required');
      // Only valid legacy paid rows without plan_code retain General writes.
      includePlan = false; written = await write(false);
    }
    if (!written) {
      if (!await this.paidWriteAllowed(tier, includePlan)) throw new MemberDataError(403, tier === 'PREMIUM' ? 'premium_required' : 'subscription_required');
      throw new MemberDataError(409, 'watchlist_limit');
    }
    return this.watches();
  }
  async deleteWatch(watchId) {
    await this.statement('DELETE FROM product_watchlists WHERE issuer = ? AND subject = ? AND id = ?', text(watchId, 128)).run();
  }
  async consents() {
    const result = await this.statement('SELECT channel, granted, occurred_at, policy_version FROM notification_consents WHERE issuer = ? AND subject = ? ORDER BY occurred_at DESC, id DESC LIMIT 200').all();
    const channels = { email: false, sms: false };
    const seen = new Set();
    for (const row of result.results || []) if (Object.hasOwn(channels, row.channel) && !seen.has(row.channel)) {
      seen.add(row.channel); channels[row.channel] = row.granted === 1;
    }
    return channels;
  }
  async consentHistory() {
    let result, auditContextAvailable = true;
    try {
      result = await this.statement('SELECT id, channel, granted, policy_version, occurred_at, country, language, notice_text FROM notification_consents WHERE issuer = ? AND subject = ? ORDER BY occurred_at DESC, id DESC LIMIT 100').all();
    } catch (error) {
      if (!missingContextColumn(error)) throw error;
      auditContextAvailable = false;
      result = await this.statement('SELECT id, channel, granted, policy_version, occurred_at FROM notification_consents WHERE issuer = ? AND subject = ? ORDER BY occurred_at DESC, id DESC LIMIT 100').all();
    }
    const records = (result.results || []).map(row => ({ id: row.id, channel: row.channel, granted: row.granted === 1,
      policyVersion: row.policy_version, occurredAt: row.occurred_at, country: row.country ?? null,
      language: row.language ?? null, noticeText: row.notice_text ?? null,
      contextCaptured: countries.has(row.country) && ['ko', 'en'].includes(row.language) && typeof row.notice_text === 'string' && row.notice_text.length > 0 }));
    return { auditContextAvailable, records };
  }
  async preferences() {
    const row = await this.statement('SELECT country, time_zone, language, frequency, email_enabled, sms_enabled, phone_e164, phone_verified, brands_json, categories_json FROM notification_preferences WHERE issuer = ? AND subject = ?').first();
    return row ? { country: row.country, timeZone: row.time_zone, language: row.language, frequency: row.frequency,
      emailEnabled: row.email_enabled === 1, smsEnabled: row.sms_enabled === 1,
      phoneMasked: masked(row.phone_e164), phoneVerified: row.phone_verified === 1,
      brands: safeParse(row.brands_json, []), categories: safeParse(row.categories_json, []) }
      : { country: 'KR', timeZone: 'Asia/Seoul', language: 'ko', frequency: 'daily',
        emailEnabled: false, smsEnabled: false, phoneMasked: '', phoneVerified: false, brands: [], categories: [] };
  }
  async savePreferences(value) {
    const consent = await this.consents();
    if (value.phone && !consent.sms) throw new MemberDataError(400, 'consent_required');
    let written;
    try { written = await this.db.prepare(`WITH permission AS (
      SELECT COALESCE((SELECT granted FROM notification_consents WHERE issuer = ? AND subject = ? AND channel = 'email' ORDER BY occurred_at DESC, id DESC LIMIT 1), 0) AS email,
        COALESCE((SELECT granted FROM notification_consents WHERE issuer = ? AND subject = ? AND channel = 'sms' ORDER BY occurred_at DESC, id DESC LIMIT 1), 0) AS sms,
        (SELECT phone_e164 FROM notification_preferences WHERE issuer = ? AND subject = ?) AS saved_phone
      ) INSERT INTO notification_preferences (issuer, subject, country, time_zone, language, frequency, email_enabled, sms_enabled, phone_e164, phone_verified, brands_json, categories_json, updated_at)
      SELECT ?, ?, ?, ?, ?, ?, CASE WHEN ? = 1 AND permission.email = 1 THEN 1 ELSE 0 END,
        CASE WHEN ? = 1 AND permission.sms = 1 THEN 1 ELSE 0 END,
        CASE WHEN permission.sms = 1 THEN CASE WHEN ? = 1 THEN ? ELSE permission.saved_phone END ELSE NULL END,
        0, ?, ?, ? FROM permission WHERE (? = 0 OR permission.sms = 1) AND ${this.writePermission('PREMIUM')}
      ON CONFLICT(issuer, subject) DO UPDATE SET country = excluded.country, time_zone = excluded.time_zone, language = excluded.language, frequency = excluded.frequency, email_enabled = excluded.email_enabled, sms_enabled = excluded.sms_enabled, phone_e164 = excluded.phone_e164, phone_verified = 0, brands_json = excluded.brands_json, categories_json = excluded.categories_json, updated_at = excluded.updated_at RETURNING issuer`)
      .bind(...this.owner, ...this.owner, ...this.owner, ...this.owner, value.country, value.timeZone, value.language, value.frequency,
        Number(value.emailEnabled), Number(value.smsEnabled), Number(own(value, 'phone')), value.phone ?? null,
        JSON.stringify(value.brands), JSON.stringify(value.categories), this.now, Number(Boolean(value.phone)), ...this.owner, this.now, this.now).first(); }
    catch (error) { if (missingPlanColumn(error)) throw new MemberDataError(403, 'premium_required'); throw error; }
    if (!written) {
      if (!await this.paidWriteAllowed('PREMIUM')) throw new MemberDataError(403, 'premium_required');
      throw new MemberDataError(400, 'consent_required');
    }
    return this.preferences();
  }
  async saveConsent(channel, granted, options = {}) {
    if (!['email', 'sms'].includes(channel) || typeof granted !== 'boolean') throw new MemberDataError(400, 'invalid_request');
    exactFields(options, ['language', 'noticeVersion'], []);
    if (own(options, 'language') && !['ko', 'en'].includes(options.language)
      || granted && options.noticeVersion !== undefined && options.noticeVersion !== CONSENT_POLICY_VERSION) throw new MemberDataError(400, 'invalid_request');
    if (typeof this.db.batch !== 'function') throw new MemberDataError(503, 'setup_required');
    const consentId = id(), acknowledged = options.noticeVersion === CONSENT_POLICY_VERSION;
    // Calculate the monotonic timestamp inside the write transaction, so
    // concurrent requests cannot reorder a withdrawal by random UUID ordering.
    const statements = includeContext => {
      const columns = ['issuer', 'subject', 'id', 'channel', 'granted', 'policy_version', 'occurred_at'];
      const expressions = ['?', '?', '?', '?', '?', '?', '(SELECT MAX(?, COALESCE(MAX(occurred_at), 0) + 1) FROM notification_consents WHERE issuer = ? AND subject = ?)'];
      const values = [...this.owner, consentId, channel, Number(granted), acknowledged ? CONSENT_POLICY_VERSION : 'a1-marketing-v1', this.now, ...this.owner];
      if (includeContext) {
        columns.push('country', 'language', 'notice_text');
        expressions.push("COALESCE((SELECT country FROM notification_preferences WHERE issuer = ? AND subject = ?), 'KR')",
          "COALESCE(?, (SELECT language FROM notification_preferences WHERE issuer = ? AND subject = ?), 'ko')",
          "CASE WHEN ? = 1 THEN CASE COALESCE(?, (SELECT language FROM notification_preferences WHERE issuer = ? AND subject = ?), 'ko') WHEN 'en' THEN ? ELSE ? END ELSE NULL END");
        values.push(...this.owner, options.language ?? null, ...this.owner, Number(acknowledged), options.language ?? null, ...this.owner,
          consentNotice(channel, 'en', granted), consentNotice(channel, 'ko', granted));
      }
      const grantCondition = granted ? ` WHERE ${this.writePermission('PREMIUM')}` : '';
      const result = [this.db.prepare(`INSERT INTO notification_consents (${columns.join(', ')}) SELECT ${expressions.join(', ')}${grantCondition}`)
        .bind(...values, ...(granted ? [...this.owner, this.now, this.now] : []))];
      if (!granted) {
        const update = channel === 'email' ? 'email_enabled = 0' : 'sms_enabled = 0, phone_e164 = NULL, phone_verified = 0';
        result.push(this.db.prepare(`UPDATE notification_preferences SET ${update}, updated_at = ? WHERE issuer = ? AND subject = ?`).bind(this.now, ...this.owner));
        result.push(this.db.prepare("UPDATE notification_deliveries SET status = 'canceled' WHERE issuer = ? AND subject = ? AND channel = ? AND status IN ('pending', 'queued', 'dry-run')").bind(...this.owner, channel));
      }
      return result;
    };
    try {
      let results;
      try { results = await this.db.batch(statements(true)); }
      catch (error) {
        if (!missingContextColumn(error)) throw error;
        // Legacy deployments still support opt-out. Never invent snapshots for
        // old rows or fall back on unrelated storage/query failures.
        results = await this.db.batch(statements(false));
      }
      if (granted && results?.[0]?.meta?.changes !== 1) throw new MemberDataError(403, 'premium_required');
    } catch (error) { if (granted && missingPlanColumn(error)) throw new MemberDataError(403, 'premium_required'); throw error; }
    return this.consents();
  }
  async history() {
    const result = await this.statement("SELECT id, channel, event_id, status, created_at, payload_json FROM notification_deliveries WHERE issuer = ? AND subject = ? AND status <> 'deleted' ORDER BY created_at DESC LIMIT 100").all();
    return (result.results || []).map(row => ({ id: row.id, channel: row.channel, eventId: row.event_id, status: row.status,
      createdAt: row.created_at, preview: safeParse(row.payload_json, {}) }));
  }
  async deleteHistory() {
    // Remove the history payload while retaining a content-free suppression key
    // for deduplication; deleting a log must not cause the same alert to resend.
    await this.db.prepare("UPDATE notification_deliveries SET payload_json = '{}', status = 'deleted' WHERE issuer = ? AND subject = ?").bind(...this.owner).run();
  }
  async savePreview(channel, template) {
    const consent = await this.consents();
    if (!consent[channel]) throw new MemberDataError(403, 'consent_required');
    const event = 'DEMO-preview-' + new Date(this.now).toISOString().slice(0, 10);
    const dedupe = `preview:${channel}:${event}`;
    const premium = this.writePermission('PREMIUM');
    try {
      await this.db.prepare(`INSERT INTO notification_deliveries (issuer, subject, id, channel, event_id, dedupe_key, status, created_at, payload_json) SELECT ?, ?, ?, ?, ?, ?, 'dry-run', ?, ? WHERE (SELECT granted FROM notification_consents WHERE issuer = ? AND subject = ? AND channel = ? ORDER BY occurred_at DESC, id DESC LIMIT 1) = 1 AND ${premium} ON CONFLICT(issuer, subject, channel, dedupe_key) DO NOTHING`)
        .bind(...this.owner, id(), channel, event, dedupe, this.now, JSON.stringify(template), ...this.owner, channel, ...this.owner, this.now, this.now).run();
      const access = await this.db.prepare(`SELECT (SELECT granted FROM notification_consents WHERE issuer = ? AND subject = ? AND channel = ? ORDER BY occurred_at DESC, id DESC LIMIT 1) AS consent_allowed, ${premium} AS premium_allowed`)
        .bind(...this.owner, channel, ...this.owner, this.now, this.now).first();
      if (access?.consent_allowed !== 1 || access?.premium_allowed !== 1) {
        await this.db.prepare("UPDATE notification_deliveries SET status = 'canceled' WHERE issuer = ? AND subject = ? AND channel = ? AND dedupe_key = ? AND status = 'dry-run'").bind(...this.owner, channel, dedupe).run();
        throw new MemberDataError(403, access?.consent_allowed !== 1 ? 'consent_required' : 'premium_required');
      }
    } catch (error) { if (missingPlanColumn(error)) throw new MemberDataError(403, 'premium_required'); throw error; }
    return { template, mode: 'DRY_RUN', sent: false };
  }
  async eraseNotificationData() {
    // Retain minimal opt-out tombstones so an erased preference cannot be used
    // as renewed marketing permission. No phone, email or message body survives.
    const statements = [this.statement('DELETE FROM notification_preferences WHERE issuer = ? AND subject = ?'),
      this.statement('DELETE FROM notification_consents WHERE issuer = ? AND subject = ?'),
      this.statement("UPDATE notification_deliveries SET payload_json = '{}', status = 'deleted' WHERE issuer = ? AND subject = ?")];
    for (const channel of ['email', 'sms']) statements.push(this.statement('INSERT INTO notification_consents (issuer, subject, id, channel, granted, policy_version, occurred_at) VALUES (?, ?, ?, ?, 0, ?, ?)', id(), channel, 'a1-marketing-v1-withdrawal', this.now));
    if (typeof this.db.batch !== 'function') throw new MemberDataError(503, 'setup_required');
    await this.db.batch(statements);
  }
  async eraseAllMemberData() {
    const statements = [];
    for (const table of ['product_watchlists', 'notification_preferences', 'notification_consents', 'notification_deliveries', 'api_rate_limits']) {
      const exists = await this.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").bind(table).first();
      if (exists) statements.push(this.statement(`DELETE FROM ${table} WHERE issuer = ? AND subject = ?`));
    }
    if (!statements.length) return;
    if (typeof this.db.batch !== 'function') throw new MemberDataError(503, 'setup_required');
    await this.db.batch(statements);
  }
}

export async function eraseAllMemberData(db, identity) {
  await new MemberStore(db, identity).eraseAllMemberData();
}
