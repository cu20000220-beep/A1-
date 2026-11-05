/* SERVER ONLY. Excluded from the static site bundle. Serve recommendations only
   after the API has verified the member and an active paid subscription.
   These are illustrative styling examples, not stock, offers or a live feed. */
if (typeof window !== 'undefined' || typeof document !== 'undefined') {
  throw new Error('Server catalog must not be imported in a browser.');
}

export const CATALOG_MODE = 'examples-only';

export const catalogExamples = Object.freeze([
  {id:'a1-001',name:'블루 테일러드 코트',gender:'여성',category:'아우터',style:'미니멀',price:129000,photo:'woman',color:'파우더 블루',material:'폴리에스터 혼방',sizes:'S / M / L',description:'힘을 뺀 실루엣에 차분한 색감을 더한 시티 룩. 가벼운 이너와 함께 여유롭게 연출해보세요.',look:0},
  {id:'a1-002',name:'모던 시티 셋업',gender:'남성',category:'아우터',style:'클래식',price:159000,photo:'man',color:'네이비',material:'울 혼방',sizes:'M / L / XL',description:'정돈된 선과 자연스러운 여유. 출근길부터 주말의 약속까지 어울리는 클래식한 분위기입니다.',look:2},
  {id:'a1-003',name:'패턴 코튼 셔츠',gender:'유니섹스',category:'상의',style:'캐주얼',price:59000,photo:'casual',color:'플로럴 믹스',material:'코튼',sizes:'S / M / L / XL',description:'옷장의 기본이 되는 담백한 셔츠 스타일. 단독으로 또는 아우터 안에 겹쳐 입어보세요.',look:1},
  {id:'a1-004',name:'버건디 롱 코트',gender:'여성',category:'아우터',style:'클래식',price:189000,photo:'street',color:'버건디',material:'울 혼방',sizes:'S / M / L',description:'긴 실루엣이 만드는 편안한 균형. 뉴트럴 컬러와 매치하면 더욱 자연스럽습니다.',look:0},
  {id:'a1-005',name:'와이드 스트레이트 데님',gender:'유니섹스',category:'하의',style:'캐주얼',price:79000,photo:'denim',color:'인디고 블루',material:'코튼 데님',sizes:'26 / 28 / 30 / 32 / 34',description:'다양한 상의와 쉽게 어울리는 데님 스타일. 취향에 따라 가벼운 셔츠나 니트와 조합해보세요.',look:1},
  {id:'a1-006',name:'그래픽 스웨트 드레스',gender:'여성',category:'원피스',style:'스트리트',price:98000,photo:'coat',color:'레드',material:'폴리에스터 혼방',sizes:'S / M / L',description:'일상에 작은 변화를 주는 레이어드 스타일. 액세서리의 색을 덜어 실루엣을 강조해보세요.',look:0},
  {id:'a1-007',name:'데일리 유틸리티 백',gender:'유니섹스',category:'액세서리',style:'미니멀',price:49000,photo:'bag',color:'딥 네이비',material:'폴리에스터',sizes:'ONE SIZE',description:'가볍고 간결한 데일리 백 스타일. 손이 자주 가는 기본 컬러를 제안합니다.',look:1},
  {id:'a1-008',name:'릴랙스드 패턴 셔츠',gender:'남성',category:'상의',style:'미니멀',price:45000,photo:'casual',color:'플로럴 믹스',material:'코튼',sizes:'M / L / XL',description:'가볍게 입어도 단정한 인상을 주는 데일리 스타일. 데님과 함께 편안하게 연출해보세요.',look:1},
  {id:'a1-009',name:'클래식 스트레이트 팬츠',gender:'남성',category:'하의',style:'클래식',price:89000,photo:'man',color:'네이비',material:'폴리에스터 혼방',sizes:'28 / 30 / 32 / 34',description:'차분한 컬러와 곧게 떨어지는 선의 조합. 셔츠와 재킷을 함께 매치해 완성해보세요.',look:2},
  {id:'a1-010',name:'라이트 데님 재킷',gender:'유니섹스',category:'아우터',style:'스트리트',price:119000,photo:'casual',color:'라이트 블루',material:'코튼 혼방',sizes:'S / M / L / XL',description:'경쾌한 레이어링을 위한 가벼운 아우터 스타일. 여유로운 하의와 자유롭게 조합해보세요.',look:1},
  {id:'a1-011',name:'그래픽 데일리 스웨트',gender:'여성',category:'상의',style:'미니멀',price:69000,photo:'coat',color:'레드',material:'코튼 혼방',sizes:'S / M / L',description:'부드러운 색감으로 만드는 미니멀 스타일. 비슷한 톤의 하의와 함께 입어보세요.',look:0},
  {id:'a1-012',name:'에센셜 데님 팬츠',gender:'여성',category:'하의',style:'캐주얼',price:39000,photo:'denim',color:'빈티지 블루',material:'코튼 데님',sizes:'24 / 26 / 28 / 30',description:'매일의 옷차림에 편안함을 더하는 데님 스타일. 베이직한 티셔츠로 간결하게 마무리해보세요.',look:1}
].map(product => Object.freeze({
  ...product,
  photo: `assets/photos/${product.photo}.jpg`,
  source: 'example',
  availability: 'preview'
})));

// Prepared translations remain server-side with the example catalog. They do
// not turn these illustrations into live products, offers, or size advice.
const ENGLISH_EXAMPLES = Object.freeze(Object.fromEntries(Object.entries({
  'a1-001': {
    name: 'Blue Tailored Coat', color: 'Powder blue', material: 'Polyester blend',
    description: 'A city-inspired look with a relaxed silhouette and a soft color palette. Try it over a lightweight base layer.'
  },
  'a1-002': {
    name: 'Modern City Suit', color: 'Navy', material: 'Wool blend',
    description: 'Clean lines with an easy, relaxed feel. A classic styling idea for workdays and weekend plans.'
  },
  'a1-003': {
    name: 'Patterned Cotton Shirt', color: 'Mixed floral print', material: 'Cotton',
    description: 'A simple shirt styling idea for an everyday wardrobe. Wear it on its own or layer it under outerwear.'
  },
  'a1-004': {
    name: 'Burgundy Long Coat', color: 'Burgundy', material: 'Wool blend',
    description: 'A long silhouette creates an easy sense of balance. Pair it with neutral colors for an understated look.'
  },
  'a1-005': {
    name: 'Wide Straight-Leg Jeans', color: 'Indigo blue', material: 'Cotton denim',
    description: 'A denim styling idea that works with many different tops. Try a lightweight shirt or knitwear to suit your taste.'
  },
  'a1-006': {
    name: 'Graphic Sweatshirt Dress', color: 'Red', material: 'Polyester blend',
    description: 'A layered styling idea for a small change in your everyday outfits. Keep accessories in fewer colors to highlight the silhouette.'
  },
  'a1-007': {
    name: 'Everyday Utility Bag', color: 'Deep navy', material: 'Polyester',
    description: 'A lightweight, simple everyday bag styling idea in a versatile core color.'
  },
  'a1-008': {
    name: 'Relaxed Patterned Shirt', color: 'Mixed floral print', material: 'Cotton',
    description: 'An easy everyday styling idea with a neat finish. Pair it with denim for a relaxed outfit.'
  },
  'a1-009': {
    name: 'Classic Straight-Leg Trousers', color: 'Navy', material: 'Polyester blend',
    description: 'An understated color paired with straight lines. Complete the styling idea with a shirt and jacket.'
  },
  'a1-010': {
    name: 'Light Denim Jacket', color: 'Light blue', material: 'Cotton blend',
    description: 'A lightweight outerwear styling idea for easy layering. Try it with relaxed trousers or other casual bottoms.'
  },
  'a1-011': {
    name: 'Everyday Graphic Sweatshirt', color: 'Red', material: 'Cotton blend',
    description: 'A minimal styling idea with a soft color palette. Pair it with bottoms in a similar tone.'
  },
  'a1-012': {
    name: 'Essential Denim Jeans', color: 'Vintage blue', material: 'Cotton denim',
    description: 'A denim styling idea for comfortable everyday outfits. Finish the look simply with a basic T-shirt.'
  }
}).map(([id, translation]) => [id, Object.freeze(translation)])));

const LOCALIZED_PUBLIC_FIELDS = ['id', 'name', 'gender', 'category', 'style', 'price', 'photo',
  'color', 'material', 'sizes', 'description', 'look', 'source'];

/** Return a fresh public product without changing canonical filters or prices. */
export function localizeCatalogProduct(product, language = 'ko') {
  const result = {};
  if (!product || typeof product !== 'object' || Array.isArray(product)) return result;
  for (const field of LOCALIZED_PUBLIC_FIELDS) {
    if (typeof product[field] === 'string' || typeof product[field] === 'number') result[field] = product[field];
  }
  if (language === 'en' && result.source === 'example' && Object.hasOwn(ENGLISH_EXAMPLES, result.id)) {
    Object.assign(result, ENGLISH_EXAMPLES[result.id]);
  }
  return result;
}
