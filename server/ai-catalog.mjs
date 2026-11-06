/** Read-only, operator-approved product grounding for the A1 stylist.
 * No fetching, importing, scraping, FX assumptions or writes occur here.
 */
import { RETAILERS, SUPPORTED_CURRENCIES, SUPPORTED_DESTINATIONS } from './global-retailers.mjs';

if (typeof window !== 'undefined' || typeof document !== 'undefined') throw new Error('ai-catalog is server-only.');

const DAY = 86400000;
const GENDERS = ['all', 'men', 'women', 'unisex'];
const STYLES = ['all', 'minimal', 'casual', 'classic', 'streetwear'];
const CATEGORIES = ['all', 'tops', 'bottoms', 'outerwear', 'dresses', 'accessories'];
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/.test(value);
const timestamp = value => Number.isSafeInteger(value) && value > 0 && value <= 8640000000000000;
const integerAmount = value => Number.isSafeInteger(value) && value >= 0 && value <= 1e12;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const scalar = (value, max = 160) => {
  if (typeof value !== 'string' || value.length > max) return null;
  const result = value.normalize('NFC').replace(/[\p{Cc}\p{Cf}]/gu, '').trim();
  return result || null;
};

export class CatalogReadError extends Error {
  constructor(cause) { super('catalog_unavailable', { cause }); this.code = 'catalog_unavailable'; this.status = 503; }
}

function provenance(value) {
  if (typeof value !== 'string' || value.length > 2048 || /[\p{Cc}\p{Cf}]/u.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port
      || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname)
      || /(?:^|\.)(?:localhost|local|internal|invalid|test|example)(?:\.|$)/i.test(url.hostname)
      || /(?:^|\.)example\.(?:com|org|net)$/i.test(url.hostname)) return null;
    return url.origin + url.pathname;
  } catch { return null; }
}

function productUrl(value, retailerId) {
  const retailer = RETAILERS.find(row => row.id === retailerId);
  if (!retailer || typeof value !== 'string' || value.length > 2048 || /[\p{Cc}\p{Cf}]/u.test(value)) return null;
  try {
    const url = new URL(value), host = new URL(retailer.baseUrl).hostname.replace(/^www\./, '');
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hostname.replace(/^www\./, '') !== host) return null;
    for (const name of url.searchParams.keys()) if (/(?:api.?key|token|secret|password|credential|authorization|signature)/i.test(name)) return null;
    url.hash = '';
    return url.href;
  } catch { return null; }
}

export function minorToMajor(value, currency) {
  if (!SUPPORTED_CURRENCIES.includes(currency) || !integerAmount(value)) throw new TypeError('invalid_catalog_amount');
  return value / (currency === 'KRW' || currency === 'JPY' ? 1 : 100);
}
function nullableMoney(value, currency) { return value == null ? null : integerAmount(value) ? minorToMajor(value, currency) : null; }

function mapOffer(row, filters) {
  const { now, destination, currency, gender, style, category, budget } = filters;
  if (!object(row) || row.source_mode !== 'official' || row.integration_status !== 'configured'
    || !['official_api', 'official_feed'].includes(row.provider_kind) || row.stock_status !== 'in_stock'
    || row.currency !== currency || !id(row.id) || !id(row.product_id)) return null;
  const name = scalar(row.product_name), brand = scalar(row.brand, 80), color = scalar(row.color, 80), size = scalar(row.size, 40);
  const sku = scalar(row.sku, 100), gtin = typeof row.gtin === 'string' && /^(?:\d{8}|\d{12,14})$/.test(row.gtin) ? row.gtin : null;
  if (!name || !brand || !color || !size || !sku && !gtin
    || !['new', 'used', 'refurbished', 'new_with_tags', 'new_without_tags'].includes(row.item_condition)
    || !/^[A-Z]{2}$/.test(row.seller_country || '') || !integerAmount(row.price_minor)) return null;
  if (!timestamp(row.checked_at) || row.checked_at > now || !timestamp(row.updated_at) || row.updated_at > now
    || !Number.isSafeInteger(row.retention_seconds) || row.retention_seconds <= 0
    || row.retention_seconds > 31536000 || !Number.isSafeInteger(row.minimum_refresh_seconds)
    || row.minimum_refresh_seconds < 0 || row.minimum_refresh_seconds > row.retention_seconds) return null;
  const expiresAt = Math.min(row.checked_at + Math.min(DAY, row.retention_seconds * 1000),
    row.expires_at == null ? Number.MAX_SAFE_INTEGER : timestamp(row.expires_at) ? row.expires_at : 0);
  if (expiresAt <= now || !provenance(row.terms_url) || !scalar(row.image_rights_note, 1000)) return null;
  const sourceUrl = provenance(row.source_url), retailerSource = provenance(row.retailer_source_url);
  const url = productUrl(row.product_url, row.retailer_id), retailerName = scalar(row.retailer_name, 100);
  if (!sourceUrl || !retailerSource || new URL(sourceUrl).origin !== new URL(retailerSource).origin || !url || !retailerName) return null;
  let metadata, shippingCountries;
  try { metadata = JSON.parse(row.payload_json); shippingCountries = JSON.parse(row.shipping_countries_json); } catch { return null; }
  if (!object(metadata) || !GENDERS.slice(1).includes(metadata.gender) || !CATEGORIES.slice(1).includes(metadata.category)
    || !Array.isArray(shippingCountries) || !shippingCountries.includes(destination)) return null;
  const styles = [...new Set((Array.isArray(metadata.styles) ? metadata.styles : [metadata.style]).filter(value => STYLES.slice(1).includes(value)))].slice(0, 4);
  if (gender !== 'all' && metadata.gender !== gender && metadata.gender !== 'unisex'
    || category !== 'all' && metadata.category !== category || style !== 'all' && !styles.includes(style)) return null;
  const promotionActive = integerAmount(row.promotion_price_minor) && row.promotion_price_minor < row.price_minor
    && timestamp(row.promotion_starts_at) && timestamp(row.promotion_ends_at)
    && row.promotion_starts_at <= now && row.promotion_ends_at > now;
  const basePrice = minorToMajor(row.price_minor, currency);
  const price = promotionActive ? minorToMajor(row.promotion_price_minor, currency) : basePrice;
  if (price > budget) return null;
  const promotion = promotionActive ? Object.freeze({ price, startsAt: row.promotion_starts_at, endsAt: row.promotion_ends_at }) : null;
  return Object.freeze({ id: row.id, productId: row.product_id, name, brand, sku, gtin, color, size,
    condition: row.item_condition, gender: metadata.gender, category: metadata.category, styles: Object.freeze(styles),
    retailerId: row.retailer_id, retailerName, sellerCountry: row.seller_country,
    price, basePrice, currency, originalCurrency: currency, promotion,
    shipping: nullableMoney(row.shipping_minor, currency), tax: nullableMoney(row.tax_minor, currency), duties: nullableMoney(row.duty_minor, currency),
    shippingCountries: Object.freeze([...new Set(shippingCountries.filter(value => SUPPORTED_DESTINATIONS.includes(value)))]),
    shippingStatus: 'confirmed', stock: 'in_stock', checkedAt: row.checked_at, expiresAt,
    productUrl: url, source: retailerName + ' official feed', sourceUrl, sourceVerified: true, demo: false });
}

const query = `SELECT o.*, r.name AS retailer_name, r.integration_status, r.provider_kind,
  r.source_url AS retailer_source_url, r.terms_url, r.image_rights_note,
  r.retention_seconds, r.minimum_refresh_seconds, r.updated_at
  FROM product_offers o JOIN retailers r ON r.id = o.retailer_id
  WHERE o.source_mode = 'official' AND r.integration_status = 'configured'
    AND o.currency = ? AND o.stock_status = 'in_stock' AND o.checked_at > ? AND o.checked_at <= ?
  ORDER BY o.checked_at DESC, o.id ASC LIMIT 250`;

function result(status, reason, products = [], offers = products) {
  return Object.freeze({ status, reason, mode: 'verified-offers', products: Object.freeze(products), offers: Object.freeze(offers),
    noCurrencyConversion: true, guarantee: 'Only the bounded approved catalog is searched; this is not all worldwide products.' });
}
function missingTables(error) {
  for (let current = error, depth = 0; current && depth < 4; current = current.cause, depth++) {
    if (/no such table:\s*(?:\w+\.)?(?:product_offers|retailers)\b/i.test(current.message || '')) return true;
  }
  return false;
}

/** Operator approval is a server option, never a browser request field. */
export async function loadVerifiedCatalog(db, { destination = 'KR', currency = 'KRW', gender = 'all', style = 'all',
  budget = 1e9, category = 'all', now = Date.now(), limit = 12, allowLiveCatalog = false } = {}) {
  if (!SUPPORTED_DESTINATIONS.includes(destination) || !SUPPORTED_CURRENCIES.includes(currency)
    || !GENDERS.includes(gender) || !STYLES.includes(style) || !CATEGORIES.includes(category)
    || !Number.isFinite(budget) || budget < 0 || budget > 1e9 || !timestamp(now)
    || !Number.isInteger(limit) || limit < 1 || limit > 24) throw new TypeError('invalid_catalog_filters');
  if (allowLiveCatalog !== true) return result('disabled', 'catalog_operator_approval_required');
  if (typeof db?.prepare !== 'function') return result('unavailable', 'catalog_database_required');
  let rows;
  try { rows = await db.prepare(query).bind(currency, now - DAY, now).all(); }
  catch (error) { if (missingTables(error)) return result('unavailable', 'catalog_tables_missing'); throw new CatalogReadError(error); }
  if (!Array.isArray(rows?.results)) throw new CatalogReadError();
  const offers = rows.results.slice(0, 250).map(row => mapOffer(row, { destination, currency, gender, style, category, budget, now })).filter(Boolean).slice(0, 100);
  return offers.length ? result('ready', null, offers.slice(0, limit), offers) : result('empty', 'no_verified_products_for_preferences');
}

/** Model IDs select server records; model-generated names, URLs and prices are never accepted. */
export function selectVerifiedProducts(catalog, ids) {
  if (!Array.isArray(ids) || ids.length > 12 || ids.some(value => !id(value)) || new Set(ids).size !== ids.length
    || !Array.isArray(catalog?.products)) throw new TypeError('invalid_grounded_selection');
  const products = new Map(catalog.products.map(product => [product.id, product]));
  if (ids.some(value => !products.has(value))) throw new TypeError('ungrounded_product_selection');
  return ids.map(value => products.get(value));
}

export function verifiedDiscounts(catalog) {
  if (!Array.isArray(catalog?.products)) return [];
  return catalog.products.filter(product => product.promotion && product.basePrice > product.promotion.price).map(product => Object.freeze({
    id: product.id, productId: product.productId, currency: product.currency, basePrice: product.basePrice,
    promotionPrice: product.promotion.price, discountAmount: Math.round((product.basePrice - product.promotion.price) * 100) / 100,
    discountPercent: Math.floor((product.basePrice - product.promotion.price) / product.basePrice * 10000) / 100,
    startsAt: product.promotion.startsAt, endsAt: product.promotion.endsAt, checkedAt: product.checkedAt,
    sourceUrl: product.sourceUrl, productUrl: product.productUrl, source: 'verified-offer-price-difference' }));
}
