/** Entirely fictional data for UI/testing. Never enqueue this data for real price monitoring. */
import { compareOffers } from './price-comparison.mjs';
import { retailerSearchUrl } from './global-retailers.mjs';
export const DEMO_PRODUCT = Object.freeze({ id: 'demo-tee', productId: 'demo-tee',
  brand: 'A1 DEMO', name: 'DEMO Cotton T-Shirt', sku: 'DEMO-TEE-001', gtin: null,
  color: 'White', size: 'M', condition: 'new', gender: 'unisex', category: 'tops', style: 'classic' });

export function makeDemoOffers(now = Date.now()) {
  const common = { ...DEMO_PRODUCT, source: 'A1 fictional DEMO fixture', sourceVerified: true, demo: true,
    checkedAt: now - 3600000, stock: 'in_stock', shippingStatus: 'confirmed',
    shippingCountries: ['KR','US','JP','GB','DE','FR','IT','ES','NL'], tax: 0, duties: 0 };
  return [
    { ...common, id: 'demo-us-1', retailerId: 'ebay-us', retailerName: 'DEMO US seller', sellerCountry: 'US',
      price: 49, currency: 'USD', shipping: 8, productUrl: 'https://seller.example.test/products/demo-tee' },
    { ...common, id: 'demo-gb-1', retailerId: 'ebay-gb', retailerName: 'DEMO UK seller', sellerCountry: 'GB',
      price: 44, currency: 'GBP', shipping: 6, productUrl: 'https://uk.example.test/products/demo-tee',
      promotion: { price: 39, startsAt: now - 7200000, endsAt: now + 3600000 } },
    { ...common, id: 'demo-jp-unknown', retailerId: 'amazon-jp', retailerName: 'DEMO Japan seller', sellerCountry: 'JP',
      price: 6500, currency: 'JPY', shipping: null, tax: null, duties: null,
      productUrl: 'https://jp.example.test/products/demo-tee' },
    { ...common, id: 'demo-eu-old', retailerId: 'amazon-de', retailerName: 'DEMO EU seller (old price)', sellerCountry: 'DE',
      price: 32, currency: 'EUR', shipping: 5, checkedAt: now - 48 * 3600000,
      productUrl: 'https://eu.example.test/products/demo-tee' },
    { ...common, id: 'demo-us-size-l', retailerId: 'amazon-us', retailerName: 'DEMO different-size seller', sellerCountry: 'US',
      price: 20, currency: 'USD', shipping: 0, size: 'L',
      productUrl: 'https://different.example.test/products/demo-tee-l' }
  ];
}
export function demoComparison({ destination = 'KR', currency = 'KRW', productId = DEMO_PRODUCT.id, now = Date.now() } = {}) {
  if (productId !== DEMO_PRODUCT.id) throw new TypeError('unknown_demo_product');
  const fx = { base: 'USD', rates: { USD: 1, KRW: 1350, EUR: 0.92, GBP: 0.79, JPY: 150 },
    source: 'DEMO illustrative rates — not a market exchange rate', asOf: now - 3600000, demo: true, verified: false };
  const result = compareOffers({ product: DEMO_PRODUCT, destination, currency, offers: makeDemoOffers(now), fx, now, demo: true });
  return { ...result, results: result.results.map(row => ({ ...row,
    retailerSearchUrl: retailerSearchUrl(row.retailerId, 'cotton T-shirt white M'),
    navigationLabel: 'Search link only; fictional DEMO product cannot be purchased' })),
    demoNotice: 'All products, offers, charges, promotions and exchange rates in this comparison are fictional DEMO data. No real lowest price is confirmed.' };
}
