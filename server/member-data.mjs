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
  const productId = text(value.productId, 128);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(productId)) throw new MemberDataError(400, 'invalid_request');
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

export class MemberStore {
  constructor(db, identity, now = Date.now()) {
    if (typeof db?.prepare !== 'function' || !identity?.issuer || !identity?.subject) throw new MemberDataError(503, 'setup_required');
    this.db = db; this.owner = [identity.issuer, identity.subject]; this.now = now;
  }
  statement(sql, ...values) { return this.db.prepare(sql).bind(...this.owner, ...values); }
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
    const count = await this.statement('SELECT COUNT(*) AS count FROM product_watchlists WHERE issuer = ? AND subject = ?').first();
    if (count?.count >= 100) throw new MemberDataError(409, 'watchlist_limit');
    await this.statement('INSERT INTO product_watchlists (issuer, subject, id, product_id, target_price, currency, brand, category, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(issuer, subject, product_id, currency) DO UPDATE SET target_price = excluded.target_price, brand = excluded.brand, category = excluded.category',
      id(), value.productId, value.targetPrice, value.currency, value.brand, value.category, this.now).run();
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
    const old = await this.statement('SELECT phone_e164 FROM notification_preferences WHERE issuer = ? AND subject = ?').first();
    const phone = own(value, 'phone') ? value.phone : old?.phone_e164 ?? null;
    await this.statement('INSERT INTO notification_preferences (issuer, subject, country, time_zone, language, frequency, email_enabled, sms_enabled, phone_e164, phone_verified, brands_json, categories_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?) ON CONFLICT(issuer, subject) DO UPDATE SET country = excluded.country, time_zone = excluded.time_zone, language = excluded.language, frequency = excluded.frequency, email_enabled = excluded.email_enabled, sms_enabled = excluded.sms_enabled, phone_e164 = excluded.phone_e164, phone_verified = 0, brands_json = excluded.brands_json, categories_json = excluded.categories_json, updated_at = excluded.updated_at',
      value.country, value.timeZone, value.language, value.frequency, Number(value.emailEnabled && consent.email), Number(value.smsEnabled && consent.sms), phone,
      JSON.stringify(value.brands), JSON.stringify(value.categories), this.now).run();
    return this.preferences();
  }
  async saveConsent(channel, granted) {
    // Calculate the monotonic timestamp inside the write transaction, so
    // concurrent requests cannot reorder a withdrawal by random UUID ordering.
    const insert = this.db.prepare('INSERT INTO notification_consents (issuer, subject, id, channel, granted, policy_version, occurred_at) VALUES (?, ?, ?, ?, ?, ?, (SELECT MAX(?, COALESCE(MAX(occurred_at), 0) + 1) FROM notification_consents WHERE issuer = ? AND subject = ?))')
      .bind(...this.owner, id(), channel, Number(granted), 'a1-marketing-v1', this.now, ...this.owner);
    const statements = [insert];
    if (!granted) {
      const column = channel === 'email' ? 'email_enabled' : 'sms_enabled';
      statements.push(this.db.prepare(`UPDATE notification_preferences SET ${column} = 0, updated_at = ? WHERE issuer = ? AND subject = ?`).bind(this.now, ...this.owner));
      statements.push(this.db.prepare("UPDATE notification_deliveries SET status = 'canceled' WHERE issuer = ? AND subject = ? AND channel = ? AND status IN ('pending', 'queued', 'dry-run')").bind(...this.owner, channel));
    }
    if (typeof this.db.batch !== 'function') throw new MemberDataError(503, 'setup_required');
    await this.db.batch(statements);
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
    await this.db.prepare("INSERT INTO notification_deliveries (issuer, subject, id, channel, event_id, dedupe_key, status, created_at, payload_json) SELECT ?, ?, ?, ?, ?, ?, 'dry-run', ?, ? WHERE (SELECT granted FROM notification_consents WHERE issuer = ? AND subject = ? AND channel = ? ORDER BY occurred_at DESC, id DESC LIMIT 1) = 1 ON CONFLICT(issuer, subject, channel, dedupe_key) DO NOTHING")
      .bind(...this.owner, id(), channel, event, dedupe, this.now, JSON.stringify(template), ...this.owner, channel).run();
    if (!(await this.consents())[channel]) throw new MemberDataError(403, 'consent_required');
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
