/** Server-owned search directory. Entries are links, not approved live feeds or shipping promises. */
export const SUPPORTED_COUNTRIES = Object.freeze(['KR', 'US', 'JP', 'GB', 'EU']);
export const SUPPORTED_DESTINATIONS = Object.freeze(['KR', 'US', 'JP', 'GB', 'DE', 'FR', 'IT', 'ES', 'NL']);
export const SUPPORTED_CURRENCIES = Object.freeze(['KRW', 'USD', 'EUR', 'GBP', 'JPY']);
const DEFAULT_CURRENCY = { KR: 'KRW', US: 'USD', JP: 'JPY', GB: 'GBP', EU: 'EUR' };
const rows = [
  ['coupang', 'Coupang', 'KR', 'https://www.coupang.com/np/search', 'q'],
  ['naver', 'Naver Shopping', 'KR', 'https://search.shopping.naver.com/search/all', 'query'],
  ['ebay-us', 'eBay US', 'US', 'https://www.ebay.com/sch/i.html', '_nkw'],
  ['amazon-us', 'Amazon US', 'US', 'https://www.amazon.com/s', 'k'],
  ['amazon-jp', 'Amazon Japan', 'JP', 'https://www.amazon.co.jp/s', 'k'],
  ['rakuten-jp', 'Rakuten Japan', 'JP', 'https://search.rakuten.co.jp/search/mall/', null],
  ['ebay-gb', 'eBay UK', 'GB', 'https://www.ebay.co.uk/sch/i.html', '_nkw'],
  ['amazon-gb', 'Amazon UK', 'GB', 'https://www.amazon.co.uk/s', 'k'],
  ['amazon-de', 'Amazon Germany', 'EU', 'https://www.amazon.de/s', 'k'],
  ['ebay-de', 'eBay Germany', 'EU', 'https://www.ebay.de/sch/i.html', '_nkw'],
  ['zalando-de', 'Zalando Germany', 'EU', 'https://www.zalando.de/catalog/', 'q']
];
export const RETAILERS = Object.freeze(rows.map(([id, name, country, baseUrl, queryKey]) => Object.freeze({
  id, name, country, currency: DEFAULT_CURRENCY[country], baseUrl, queryKey,
  integrationStatus: 'search-only', shippingStatus: 'unknown', liveProductFeed: false,
  officialFeedAdapter: id.startsWith('ebay-') ? 'ebay-browse' : null,
  attribution: 'Merchant search page; no product, price or stock import.'
})));
const enumValue = (value, values, fallback) => value === undefined ? fallback : values.includes(value) ? value : null;
const safeTerm = value => typeof value === 'string' && value.length <= 120 && !/[\u0000-\u001f\u007f]/u.test(value) ? value.trim() : null;

export function retailerSearchUrl(retailerId, query = '') {
  const retailer = RETAILERS.find(entry => entry.id === retailerId);
  const term = safeTerm(query);
  if (!retailer || term === null) return null;
  const url = new URL(retailer.baseUrl);
  if (retailer.queryKey) url.searchParams.set(retailer.queryKey, term || 'clothing');
  else url.pathname += encodeURIComponent(term || 'clothing') + '/';
  return url.href;
}

/** Only clothing preferences enter merchant queries, never photographs, ratios or member IDs. */
export function listGlobalRetailers(filters = {}, { language = 'ko' } = {}) {
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) throw new TypeError('invalid_filters');
  const country = enumValue(filters.country, ['ALL', ...SUPPORTED_COUNTRIES], 'ALL');
  const destination = enumValue(filters.destination, SUPPORTED_DESTINATIONS, 'KR');
  const currency = enumValue(filters.currency, SUPPORTED_CURRENCIES, 'KRW');
  const gender = enumValue(filters.gender, ['all', 'women', 'men', 'unisex'], 'all');
  const category = enumValue(filters.category, ['all', 'tops', 'bottoms', 'outerwear', 'dresses', 'accessories'], 'all');
  const style = enumValue(filters.style, ['all', 'minimal', 'casual', 'classic', 'streetwear'], 'all');
  const brand = safeTerm(filters.brand ?? '');
  const queryTerm = safeTerm(filters.query ?? '');
  const size = safeTerm(filters.size ?? '');
  const minPrice = filters.minPrice === undefined || filters.minPrice === '' ? null : Number(filters.minPrice);
  const maxPrice = filters.maxPrice === undefined || filters.maxPrice === '' ? null : Number(filters.maxPrice);
  if ([country,destination,currency,gender,category,style,brand,queryTerm,size].some(value => value === null)
    || [minPrice,maxPrice].some(value => value !== null && (!Number.isFinite(value) || value < 0 || value > 1e9))
    || minPrice !== null && maxPrice !== null && minPrice > maxPrice) throw new TypeError('invalid_filters');
  const query = [brand, queryTerm, gender === 'all' ? '' : gender, style === 'all' ? '' : style,
    category === 'all' ? 'clothing' : category, size].filter(Boolean).join(' ');
  if (query.length > 120) throw new TypeError('invalid_filters');
  const en = language === 'en';
  return {
    mode: 'search-links-only', countries: [...SUPPORTED_COUNTRIES], destinations: [...SUPPORTED_DESTINATIONS],
    currencies: [...SUPPORTED_CURRENCIES], filters: { country, destination, currency, gender, category, style, brand, query: queryTerm, size, minPrice, maxPrice },
    retailers: RETAILERS.filter(retailer => country === 'ALL' || retailer.country === country).map(({ baseUrl, queryKey, ...retailer }) => ({
      ...retailer, searchUrl: retailerSearchUrl(retailer.id, query), destination,
      shippingLabel: en ? 'Shipping to your destination must be checked with the seller.' : '선택한 목적지로 배송 가능한지는 판매처에서 확인해야 합니다.',
      dataLabel: en ? 'Search link only — no live product feed' : '검색 연결만 제공 · 실제 상품 피드 미연결'
    })),
    warnings: en ? [
      'These links do not confirm shipping, stock, prices, partnership or seller approval.',
      'Currency and price filters describe your preferences; apply the retailer’s own filters and confirm its checkout currency.'
    ] : [
      '검색 링크는 배송·재고·가격·제휴 관계나 판매처 승인을 확인한 결과가 아닙니다.',
      '통화와 가격은 탐색 조건이며 판매처에서 실제 가격 필터와 결제 통화를 확인해야 합니다.'
    ]
  };
}
