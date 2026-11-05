/* SERVER ONLY. Excluded from the static site bundle. Call only after the API
   verifies paid membership. Merchant search links are not a live product feed.
   Only enum preferences and fixed clothing terms are included in the URLs. */
import { normalizeLanguage, englishStyle } from './locale.mjs';
if (typeof window !== 'undefined' || typeof document !== 'undefined') {
  throw new Error('Server shop search must not be imported in a browser.');
}

const GENDERS = new Set(['전체', '여성', '남성', '유니섹스']);
const STYLES = new Set(['전체', '미니멀', '캐주얼', '클래식', '스트리트']);
const TERMS = {
  '전체': {
    lower: ['와이드 팬츠', '스트레이트 데님'],
    upper: ['셔츠', '재킷'],
    mixed: ['셔츠', '스트레이트 팬츠'],
    highWaist: '하이웨이스트 팬츠'
  },
  '미니멀': {
    lower: ['와이드 슬랙스', '스트레이트 데님'],
    upper: ['셔츠', '테일러드 재킷'],
    mixed: ['셔츠', '스트레이트 슬랙스'],
    highWaist: '하이웨이스트 슬랙스'
  },
  '캐주얼': {
    lower: ['와이드 데님', '코튼 팬츠'],
    upper: ['코튼 셔츠', '데님 재킷'],
    mixed: ['코튼 셔츠', '스트레이트 데님'],
    highWaist: '하이웨이스트 데님'
  },
  '클래식': {
    lower: ['와이드 슬랙스', '스트레이트 팬츠'],
    upper: ['옥스포드 셔츠', '테일러드 재킷'],
    mixed: ['옥스포드 셔츠', '테일러드 재킷'],
    highWaist: '하이웨이스트 슬랙스'
  },
  '스트리트': {
    lower: ['와이드 카고 팬츠', '와이드 데님'],
    upper: ['오버핏 셔츠', '트랙 재킷'],
    mixed: ['오버핏 티셔츠', '카고 팬츠'],
    highWaist: '하이웨이스트 카고 팬츠'
  }
};

const ENGLISH_TERMS = Object.freeze({
  '와이드 팬츠': 'wide-leg trousers', '스트레이트 데님': 'straight-leg jeans',
  '셔츠': 'shirt', '재킷': 'jacket', '스트레이트 팬츠': 'straight-leg trousers',
  '하이웨이스트 팬츠': 'high-waisted trousers', '와이드 슬랙스': 'wide-leg tailored trousers',
  '테일러드 재킷': 'tailored jacket', '스트레이트 슬랙스': 'straight-leg tailored trousers',
  '하이웨이스트 슬랙스': 'high-waisted tailored trousers', '와이드 데님': 'wide-leg jeans',
  '코튼 팬츠': 'cotton trousers', '코튼 셔츠': 'cotton shirt', '데님 재킷': 'denim jacket',
  '하이웨이스트 데님': 'high-waisted jeans', '옥스포드 셔츠': 'Oxford shirt',
  '와이드 카고 팬츠': 'wide-leg cargo trousers', '오버핏 셔츠': 'oversized shirt',
  '트랙 재킷': 'track jacket', '오버핏 티셔츠': 'oversized T-shirt', '카고 팬츠': 'cargo trousers',
  '하이웨이스트 카고 팬츠': 'high-waisted cargo trousers'
});

function linksFor(query, english) {
  const encoded = encodeURIComponent(query);
  return [
    { store: 'Coupang', label: english ? 'Search on Coupang' : '쿠팡에서 검색', url: `https://www.coupang.com/np/search?q=${encoded}` },
    { store: 'Temu', label: english ? 'Search on Temu' : 'Temu에서 검색', url: `https://www.temu.com/search_result.html?search_key=${encoded}` },
    { store: 'NaverShopping', label: english ? 'Search on Naver Shopping' : '네이버쇼핑에서 검색', url: `https://search.shopping.naver.com/search/all?query=${encoded}` }
  ];
}

export function shopSearchesFor(metrics, preferences = {}, { language = 'ko' } = {}) {
  if (!metrics || typeof metrics !== 'object' || Array.isArray(metrics) ||
      !Number.isFinite(metrics.shoulderHipRatio) || !Number.isFinite(metrics.legTorsoRatio)) return [];
  const { shoulderHipRatio, legTorsoRatio } = metrics;
  if (shoulderHipRatio < 0.45 || shoulderHipRatio > 2.5 ||
      legTorsoRatio < 0.6 || legTorsoRatio > 3.5) return [];
  if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) return [];
  const { gender = '전체', style = '전체' } = preferences;
  if (!GENDERS.has(gender) || !STYLES.has(style)) return [];
  const english = normalizeLanguage(language) === 'en';

  const group = shoulderHipRatio >= 1.25 ? 'lower' : shoulderHipRatio <= 0.9 ? 'upper' : 'mixed';
  const terms = TERMS[style][group].slice();
  const reasons = english ? [
    group === 'lower'
      ? 'Explore lower-body silhouettes using the spacing between landmarks in the photo as a reference.'
      : group === 'upper'
        ? 'Explore the lines and layering of tops using the spacing between photo landmarks as a reference.'
        : 'Compare combinations of tops and bottoms in your chosen style.',
    'Explore another item in the same style.'
  ] : [
    group === 'lower'
      ? '사진 속 기준점 간격을 참고해 하의의 실루엣을 비교하는 검색어를 제안합니다.'
      : group === 'upper'
        ? '사진 속 기준점 간격을 참고해 상의의 선과 레이어링을 비교하는 검색어를 제안합니다.'
        : '선택한 취향으로 상의와 하의의 조합을 비교하는 검색어를 제안합니다.',
    '같은 취향에서 다른 아이템을 함께 살펴볼 수 있는 검색어입니다.'
  ];
  if (legTorsoRatio < 1.35) {
    terms[1] = TERMS[style].highWaist;
    reasons[1] = english
      ? 'Compare outfits with different waistline positions, using photo landmarks as a reference. This does not determine actual body proportions or clothing size.'
      : '사진 속 기준점을 참고해 허리선 위치를 달리한 코디를 비교하는 검색어입니다. 실제 신체 비율이나 사이즈를 판정하지 않습니다.';
  }

  // Budget, image data, file names, identifiers and numeric model output never
  // become query terms. Budget filtering belongs to the merchant search page.
  const prefix = [gender === '전체' ? '' : gender, style === '전체' ? '' : style].filter(Boolean);
  return terms.map((term, index) => {
    const query = [...prefix, term].join(' ');
    const displayQuery = [
      ({ '여성': "Women's", '남성': "Men's", '유니섹스': 'Unisex' })[gender],
      style === '전체' ? '' : englishStyle(style).toLowerCase(), ENGLISH_TERMS[term]
    ].filter(Boolean).join(' ');
    return { query, ...(english ? { displayQuery } : {}), reason: reasons[index], links: linksFor(query, english) };
  });
}
