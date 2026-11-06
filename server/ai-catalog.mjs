/** AI grounding adapter over the shared approved global product repository.
 * No independent feed mapping, importing, scraping or cost assumptions live here.
 */
import { loadVerifiedCatalog as loadGlobalCatalog } from './catalog-repository.mjs';
export { CatalogReadError, minorToMajor } from './catalog-repository.mjs';

const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/.test(value);

/** Keep the stylist budget interface while using the same validated records and
 * destination-cost proof as global browsing and premium comparison. Approval is
 * passed only by server orchestration, never inferred from request data.
 */
export async function loadVerifiedCatalog(db, { budget = 1e9, ...options } = {}) {
  if (typeof budget !== 'number' || !Number.isFinite(budget) || budget < 0 || budget > 1e9) {
    throw new TypeError('invalid_catalog_filters');
  }
  return loadGlobalCatalog(db, { ...options, maxPrice: budget, includeAllCurrencies: false });
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
