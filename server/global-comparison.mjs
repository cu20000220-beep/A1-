/** Compare only persisted, approved offers. No network, exchange-rate guess or DEMO fallback. */
import { loadVerifiedCatalog, CatalogReadError } from './catalog-repository.mjs';
import { compareOffers } from './price-comparison.mjs';
import { SUPPORTED_CURRENCIES, SUPPORTED_DESTINATIONS } from './global-retailers.mjs';

if (typeof window !== 'undefined' || typeof document !== 'undefined') throw new Error('global-comparison is server-only.');
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/.test(value);
const fold = value => typeof value === 'string' ? value.normalize('NFC').trim().toLocaleLowerCase('en-US') : '';
const missingTable = error => /no such table:\s*(?:\w+\.)?(?:product_offers|retailers)\b/i.test(error?.message || '')
  || /no such table:\s*(?:\w+\.)?(?:product_offers|retailers)\b/i.test(error?.cause?.message || '');

function empty({ productId, destination, currency, now, status, reason }) {
  return { ...compareOffers({ product: { productId }, destination, currency, offers: [], now }), product: null, status, reason,
    noCurrencyConversion: true, catalogStatus: status };
}
function variantKey(offer) {
  return JSON.stringify([fold(offer.brand), offer.gtin ? 'gtin:' + offer.gtin : 'sku:' + offer.sku,
    fold(offer.color), fold(offer.size), fold(offer.condition)]);
}

export async function compareStoredProduct(db, { productId, destination = 'KR', currency = 'KRW', now = Date.now(), clock, allowLiveCatalog = false } = {}) {
  if (!id(productId) || !SUPPORTED_DESTINATIONS.includes(destination) || !SUPPORTED_CURRENCIES.includes(currency)
    || !Number.isSafeInteger(now) || now <= 0 || now > 8640000000000000
    || clock !== undefined && typeof clock !== 'function') throw new TypeError('invalid_comparison');
  const state = { productId, destination, currency, now };
  if (allowLiveCatalog !== true) return empty({ ...state, status: 'disabled', reason: 'catalog_operator_approval_required' });
  if (typeof db?.prepare !== 'function') return empty({ ...state, status: 'unavailable', reason: 'catalog_database_required' });
  let stored;
  try { stored = await db.prepare('SELECT id FROM product_offers WHERE id = ? LIMIT 1').bind(productId).first(); }
  catch (error) { if (missingTable(error)) return empty({ ...state, status: 'unavailable', reason: 'catalog_tables_missing' }); throw new CatalogReadError(error); }
  // An expired/unapproved offer ID cannot silently resolve as another product's
  // physical ID. This also makes exact offer selections deterministic.
  const selection = await loadVerifiedCatalog(db, { ...(stored ? { offerId: productId } : { productId }),
    destination, currency, includeAllCurrencies: true, now, clock, allowLiveCatalog, limit: 24 });
  if (!selection.products.length) return empty({ ...state, status: selection.status, reason: selection.reason });
  if (!stored && new Set(selection.offers.map(variantKey)).size !== 1) {
    return empty({ ...state, status: 'empty', reason: 'select_exact_variant' });
  }
  const selected = selection.products.find(offer => offer.currency === currency) || selection.products[0];
  const catalog = await loadVerifiedCatalog(db, { productId: selected.productId, destination, currency,
    includeAllCurrencies: true, now, clock, allowLiveCatalog, limit: 24 });
  const finishedAt = clock ? clock() : now;
  if (!Number.isSafeInteger(finishedAt) || finishedAt < now || finishedAt > 8640000000000000) throw new TypeError('invalid_catalog_clock');
  const freshSelected = catalog.offers.find(offer => offer.id === selected.id);
  if (!freshSelected || freshSelected.expiresAt <= finishedAt) return empty({ ...state, now: finishedAt, status: 'empty', reason: 'selected_offer_unavailable' });
  const product = freshSelected.promotion && freshSelected.promotion.endsAt <= finishedAt
    ? { ...freshSelected, price: freshSelected.basePrice, promotion: null } : freshSelected;
  // SKU case is not assumed interchangeable. A shared verified GTIN can still
  // establish identity across sellers with different local SKU conventions.
  const strictMismatch = catalog.offers.filter(offer => !(product.gtin && offer.gtin) && offer.sku !== product.sku
    && fold(offer.sku) === fold(product.sku));
  const compare = compareOffers({ product, destination, currency, now: finishedAt,
    offers: catalog.offers.filter(offer => !strictMismatch.includes(offer)).map(offer => ({ ...offer, price: offer.basePrice })) });
  return { ...compare, status: 'ready', reason: null, catalogStatus: catalog.status, noCurrencyConversion: true,
    results: compare.results.map(row => ({ ...row, expiresAt: catalog.offers.find(offer => offer.id === row.id)?.expiresAt || null })),
    similarOffers: [...compare.similarOffers, ...strictMismatch.map(offer => ({ id: offer.id, retailerName: offer.retailerName,
      name: offer.name, color: offer.color, size: offer.size, condition: offer.condition, reason: 'different-or-unverified-product-variant' }))] };
}
