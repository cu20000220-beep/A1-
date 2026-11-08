/** Exact-variant comparison only. Unknown charges are never substituted with zero. */
import { SUPPORTED_CURRENCIES, SUPPORTED_DESTINATIONS, RETAILERS } from './global-retailers.mjs';
const MAX_PRICE_AGE = 24 * 60 * 60 * 1000;
const MAX_FX_AGE = 24 * 60 * 60 * 1000;
const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1e12;
const text = value => typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null;
const timestamp = value => Number.isSafeInteger(value) && value > 0;
function destinationCharge(offer, field, destination) {
  const overrides = offer[`${field}ByDestination`];
  // An explicit null means the destination's fee is unknown. It must not
  // inherit a generic zero charge through nullish fallback.
  return overrides && typeof overrides === 'object' && !Array.isArray(overrides)
    && Object.hasOwn(overrides, destination) ? overrides[destination] : offer[field];
}
function sourceUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    // Keep provenance without exposing feed authentication query parameters.
    return url.origin + url.pathname;
  } catch { return null; }
}
function variantMatch(product, offer) {
  const gtin = text(product.gtin), sku = text(product.sku), offerGtin = text(offer.gtin), offerSku = text(offer.sku);
  const identity = gtin && offerGtin ? gtin === offerGtin : sku && offerSku && sku === offerSku;
  return Boolean(identity && ['brand','color','size','condition'].every(field => text(product[field]) && text(product[field]) === text(offer[field])));
}
function converted(amount, from, to, fx, now, demo) {
  if (from === to) return { amount, rate: 1, fx: null };
  if (!fx || !timestamp(fx.asOf) || fx.asOf > now || now - fx.asOf > MAX_FX_AGE
    || typeof fx.source !== 'string' || !fx.source.trim() || !fx.rates || !SUPPORTED_CURRENCIES.includes(fx.base)
    || (fx.demo === true && !demo) || (fx.demo !== true && fx.verified !== true)) return null;
  const fromRate = from === fx.base ? 1 : fx.rates[from];
  const toRate = to === fx.base ? 1 : fx.rates[to];
  if (!number(fromRate) || !number(toRate) || fromRate === 0 || toRate === 0) return null;
  const value = amount / fromRate * toRate;
  if (!Number.isFinite(value) || value > 1e15 || !Number.isFinite(toRate / fromRate)) return null;
  return { amount: value, rate: toRate / fromRate,
    fx: { source: fx.source, asOf: fx.asOf, base: fx.base, demo: fx.demo === true } };
}
function safeProductUrl(value, demo, retailerId) {
  try { const url = new URL(value); const retailer = RETAILERS.find(row => row.id === retailerId);
    const host = retailer ? new URL(retailer.baseUrl).hostname.replace(/^www\./, '') : null;
    return !demo && host && url.hostname.replace(/^www\./, '') === host && url.protocol === 'https:' && !url.username && !url.password
    && !url.port && !/(?:^|\.)example\.(?:test|com|invalid)$/.test(url.hostname)
    && !['localhost','127.0.0.1','::1'].includes(url.hostname) ? url.href : null; } catch { return null; }
}

export function compareOffers({ product, destination = 'KR', currency = 'KRW', offers = [], fx = null, now = Date.now(), demo = false } = {}) {
  if (!product || typeof product !== 'object' || Array.isArray(product) || !SUPPORTED_DESTINATIONS.includes(destination)
    || !SUPPORTED_CURRENCIES.includes(currency) || !timestamp(now) || !Array.isArray(offers) || offers.length > 100) throw new TypeError('invalid_comparison');
  const results = [], similarOffers = [];
  for (const offer of offers) {
    if (!offer || typeof offer !== 'object' || typeof offer.id !== 'string') continue;
    if (!variantMatch(product, offer)) {
      similarOffers.push({ id: offer.id, retailerName: offer.retailerName || '', name: offer.name || '',
        color: offer.color || '', size: offer.size || '', condition: offer.condition || '', reason: 'different-or-unverified-product-variant' });
      continue;
    }
    const warnings = [];
    const sourceVerified = offer.sourceVerified === true && typeof offer.source === 'string' && Boolean(offer.source)
      && timestamp(offer.checkedAt) && (offer.demo !== true || demo);
    if (!sourceVerified) warnings.push('unverified-source');
    const fresh = timestamp(offer.checkedAt) && offer.checkedAt <= now && now - offer.checkedAt <= MAX_PRICE_AGE
      && (offer.expiresAt == null || timestamp(offer.expiresAt) && offer.expiresAt > now);
    if (!fresh) warnings.push('stale-or-unknown-price');
    const shippingCountries = Array.isArray(offer.shippingCountries)
      ? [...new Set(offer.shippingCountries.filter(country => typeof country === 'string' && /^[A-Z]{2}$/.test(country)))] : [];
    const shippingAvailable = shippingCountries.includes(destination) ? true : offer.shippingStatus === 'confirmed' ? false : null;
    if (shippingAvailable !== true) warnings.push(shippingAvailable === false ? 'destination-not-supported' : 'shipping-availability-unknown');
    const stock = offer.stock === 'in_stock' ? 'in_stock' : ['sold_out', 'out_of_stock'].includes(offer.stock) ? 'sold_out' : 'unknown';
    if (stock !== 'in_stock') warnings.push(stock === 'sold_out' ? 'sold-out' : 'stock-unknown');
    const promotionActive = offer.promotion && number(offer.promotion.price) && timestamp(offer.promotion.startsAt)
      && timestamp(offer.promotion.endsAt) && offer.promotion.startsAt <= now && now < offer.promotion.endsAt;
    if (offer.promotion && !promotionActive) warnings.push('promotion-not-current');
    const price = promotionActive ? offer.promotion.price : offer.price;
    const shipping = destinationCharge(offer, 'shipping', destination);
    const tax = destinationCharge(offer, 'tax', destination);
    const duties = destinationCharge(offer, 'duties', destination);
    if (!number(price) || !SUPPORTED_CURRENCIES.includes(offer.currency)) warnings.push('invalid-price');
    if (!number(shipping)) warnings.push('shipping-cost-unknown');
    if (!number(tax)) warnings.push('tax-unknown');
    if (!number(duties)) warnings.push('duties-unknown');
    const completeCosts = [price, shipping, tax, duties].every(number);
    const totalOriginal = completeCosts ? price + shipping + tax + duties : null;
    const conversion = completeCosts ? converted(totalOriginal, offer.currency, currency, fx, now, demo) : null;
    if (completeCosts && !conversion) warnings.push('fx-unavailable-or-stale');
    const productUrl = safeProductUrl(offer.productUrl, demo || offer.demo === true, offer.retailerId);
    if (!demo && !productUrl) warnings.push('invalid-product-url');
    const eligible = sourceVerified && fresh && shippingAvailable === true && stock === 'in_stock'
      && Boolean(conversion) && (demo || Boolean(productUrl));
    results.push({ id: offer.id, productId: offer.productId, brand: offer.brand, name: offer.name,
      retailerId: offer.retailerId, retailerName: offer.retailerName, sellerCountry: offer.sellerCountry,
      sku: offer.sku || null, gtin: offer.gtin || null, color: offer.color, size: offer.size, condition: offer.condition,
      price: number(price) ? price : null, basePrice: number(offer.price) ? offer.price : null,
      originalCurrency: offer.currency, shipping: number(shipping) ? shipping : null,
      tax: number(tax) ? tax : null, duties: number(duties) ? duties : null, shippingAvailable, shippingCountries, stock,
      totalOriginal, estimatedTotal: conversion ? Math.round(conversion.amount * (currency === 'KRW' || currency === 'JPY' ? 1 : 100)) / (currency === 'KRW' || currency === 'JPY' ? 1 : 100) : null,
      currency, checkedAt: offer.checkedAt || null, promotionActive: Boolean(promotionActive),
      promotion: offer.promotion ? { price: number(offer.promotion.price) ? offer.promotion.price : null,
        startsAt: timestamp(offer.promotion.startsAt) ? offer.promotion.startsAt : null,
        endsAt: timestamp(offer.promotion.endsAt) ? offer.promotion.endsAt : null } : null,
      source: offer.source || null, sourceUrl: sourceUrl(offer.sourceUrl ?? offer.source_url),
      sourceVerified, demo: demo || offer.demo === true, eligible, warnings, productUrl, fx: conversion?.fx || null });
  }
  const eligible = results.filter(row => row.eligible).sort((a,b) => a.estimatedTotal - b.estimatedTotal || a.id.localeCompare(b.id));
  const lowest = eligible[0] || null;
  return { mode: demo ? 'DEMO' : 'verified-offers', demo, product: { ...product }, destination, currency,
    results, similarOffers, lowestOfferId: lowest?.id || null,
    lowestStatus: lowest ? demo ? 'demo-lowest-estimate' : 'lowest-estimate-among-verified-comparable-sellers' : 'lowest-price-unavailable',
    minimumAmount: lowest?.estimatedTotal ?? null,
    hasUncertainOffers: results.some(row => !row.eligible),
    warnings: ['not-a-worldwide-lowest-price-guarantee', ...(demo ? ['fictional-demo-data-not-live-prices'] : []),
      ...(results.some(row => !row.eligible) ? ['some-sellers-cannot-be-ranked'] : []),
      ...(lowest ? [] : ['lowest-price-unavailable'])],
    fx: fx ? { source: fx.source || null, asOf: fx.asOf || null, demo: fx.demo === true } : null,
    comparedAt: now };
}
