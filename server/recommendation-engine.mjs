/* SERVER ONLY. Excluded from the static site bundle. The API must authenticate
   the member and verify an active paid subscription before calling this module.
   Matching uses deterministic styling rules, not another AI or a size verdict. */
import { CATALOG_MODE, catalogExamples } from './catalog-data.mjs';
import { shopSearchesFor } from './shop-search.mjs';

if (typeof window !== 'undefined' || typeof document !== 'undefined') {
  throw new Error('Server recommendations must not be imported in a browser.');
}

const GENDERS = new Set(['전체', '여성', '남성', '유니섹스']);
const STYLES = new Set(['전체', '미니멀', '캐주얼', '클래식', '스트리트']);
const PHOTO_PATH = /^assets\/photos\/[a-z0-9-]+\.jpg$/;
const PUBLIC_FIELDS = ['id', 'name', 'gender', 'category', 'style', 'price', 'photo',
  'color', 'material', 'sizes', 'description', 'look', 'source'];
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function validMetrics(metrics) {
  return isObject(metrics) && Number.isFinite(metrics.shoulderHipRatio) &&
    metrics.shoulderHipRatio >= 0.45 && metrics.shoulderHipRatio <= 2.5 &&
    Number.isFinite(metrics.legTorsoRatio) && metrics.legTorsoRatio >= 0.6 && metrics.legTorsoRatio <= 3.5;
}

function validPreferences(preferences) {
  if (!isObject(preferences)) return false;
  const { gender = '전체', style = '전체' } = preferences;
  return GENDERS.has(gender) && STYLES.has(style) &&
    (!Object.prototype.hasOwnProperty.call(preferences, 'budget') ||
      (Number.isSafeInteger(preferences.budget) && preferences.budget >= 0));
}

function publicProduct(product) {
  const result = {};
  for (const key of PUBLIC_FIELDS) {
    const value = product[key];
    if (typeof value === 'string' || typeof value === 'number') result[key] = value;
  }
  return result;
}

// A catalog adapter may replace the examples later. Source never boosts rank,
// sold-out offers are excluded, and returned fields are explicitly allowlisted.
export function recommendProducts(products, metrics, preferences = {}) {
  if (!Array.isArray(products) || !validMetrics(metrics) || !validPreferences(preferences)) return [];
  const { gender = '전체', style = '전체', budget = Infinity } = preferences;
  const ratio = metrics.shoulderHipRatio;
  const categoryPreference = ratio >= 1.25 ? ['하의', '상의', '아우터', '원피스', '액세서리']
    : ratio <= 0.9 ? ['상의', '아우터', '하의', '원피스', '액세서리']
      : ['아우터', '상의', '하의', '원피스', '액세서리'];

  return products
    .map((product, index) => ({ product, index }))
    .filter(({ product: p }) => isObject(p) && p.availability !== 'soldOut' &&
      Number.isSafeInteger(p.price) && p.price >= 0 && p.price <= budget &&
      typeof p.photo === 'string' && PHOTO_PATH.test(p.photo) &&
      (style === '전체' || p.style === style) &&
      (gender === '전체' || p.gender === gender || (gender !== '유니섹스' && p.gender === '유니섹스')))
    .map(({ product, index }) => {
      const priority = categoryPreference.indexOf(product.category);
      const reasons = [
        ...(product.source === 'example' ? ['실제 판매 상품이 아닌 코디 예시입니다. 사진·가격·소재·사이즈는 참고용입니다.'] : []),
        style === '전체' ? `${product.style} 스타일을 비교할 수 있는 후보입니다.` : `선택한 ${style} 스타일과 일치합니다.`,
        gender === '전체' ? '성별 컬렉션 제한 없이 고른 후보입니다.'
          : product.gender === '유니섹스' ? '선택한 컬렉션과 함께 볼 수 있는 유니섹스 상품입니다.'
            : `선택한 ${gender} 컬렉션의 상품입니다.`,
        priority === 0
          ? `사진 속 기준점 간격을 참고해 ${product.category} 아이템부터 비교하도록 제안합니다.`
          : `${product.category} 아이템을 함께 코디해보는 참고 제안입니다.`
      ];
      if (budget !== Infinity) reasons.push(product.source === 'external'
        ? '입력한 예산 이내의 외부 등록 가격입니다. 현재 가격·재고는 판매처에서 확인해주세요.'
        : '입력한 예산 이내의 예시 가격입니다.');
      return { product: publicProduct(product), reasons, priority: priority < 0 ? 99 : priority, index };
    })
    .sort((a, b) => a.priority - b.priority || a.index - b.index)
    .slice(0, 4)
    .map(({ product, reasons }) => ({ product, reasons }));
}

export function recommendForMember(input) {
  const empty = () => ({ catalogMode: CATALOG_MODE, recommendations: [], shopSearches: [] });
  if (!isObject(input) || !validMetrics(input.metrics)) return empty();
  const preferences = input.preferences === undefined ? {} : input.preferences;
  if (!validPreferences(preferences)) return empty();
  return {
    catalogMode: CATALOG_MODE,
    recommendations: recommendProducts(catalogExamples, input.metrics, preferences),
    shopSearches: shopSearchesFor(input.metrics, preferences)
  };
}
