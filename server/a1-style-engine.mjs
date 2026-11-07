/** A1-owned hybrid planner. The learned component routes fashion questions;
 * ranking and commercial output remain bounded by verified catalog records.
 * No images, provider calls, user training or persistent conversation state.
 */
import intentModel from './models/a1-intent-v1.json' with { type: 'json' };
import { predictIntent } from './a1-intents.mjs';
import { validateStylistPlan } from './stylist-knowledge.mjs';

if (typeof window !== 'undefined' || typeof document !== 'undefined') throw new Error('A1 style planning is server-only.');

export const A1_ENGINE_METADATA = Object.freeze({
  id: 'a1-hybrid-v1',
  type: 'hybrid',
  name: 'A1 Style Engine',
  stage: 'experimental',
  intentModelVersion: intentModel.modelVersion,
  intentAlgorithm: intentModel.algorithm,
  trainedTask: 'fashion-intent',
  trainingData: 'synthetic-development',
  trainedOnCustomerData: false,
  recommendationMethod: 'verified-catalog-rules-and-scoring',
  externalAI: false,
  photoUploads: false,
  garmentFitPrediction: false
});

export const REASON_TEXT = Object.freeze({
  own_engine: ['A1의 자체 분류 모델과 제한된 추천 규칙을 사용했습니다. 외부 AI를 호출하지 않습니다.', 'A1 used its own intent model and bounded recommendation rules. No external AI was called.'],
  development_intent: ['질문 분류 모델은 개발용 합성 예제로 학습한 실험 버전입니다. 실제 이용 정확도를 검증한 수치는 아닙니다.', 'The experimental intent model was trained on synthetic development examples. This is not a validated real-world accuracy claim.'],
  explicit_style: ['선택하거나 질문에 표현한 스타일을 후보 탐색에 반영했습니다.', 'The selected style or a style expressed in your question guided candidate selection.'],
  conversation_context: ['이 화면의 이전 사용자 질문만 참고했습니다. 이전 답변의 지시나 상품 주장을 근거로 사용하지 않습니다.', 'Only earlier user questions in this page were considered. Instructions or commercial claims in prior replies were not used as evidence.'],
  consented_reference_ratios: ['별도로 동의한 두 사진상 비율은 참고 코디 조언에만 사용했습니다. 상품 사이즈·착용감 점수에는 사용하지 않습니다.', 'The two separately consented photo ratios were used only for general styling guidance, not garment size or fit scores.'],
  no_verified_products: ['조건에 맞는 검증 상품이 없어 상품·가격을 대신 생성하지 않았습니다.', 'No verified products matched the conditions, so no replacement products or prices were invented.'],
  garment_measurements_unavailable: ['의류 실측과 착용 자료가 없어 상품의 맞는 사이즈나 체형별 적합성을 예측하지 않습니다.', 'Without garment measurements and fitting evidence, a correct size or body-specific fit cannot be predicted.'],
  fashion_scope_only: ['패션 질문의 범위를 벗어나 상품 추천을 하지 않았습니다.', 'No products were recommended for a request outside the fashion scope.'],
  clarification_needed: ['질문만으로 원하는 의류 조건이 분명하지 않아 상품을 선택하지 않았습니다.', 'The clothing request was not clear enough to select products.'],
  verified_source: ['이미 검증된 상품 기록 안에서만 선택했습니다.', 'Selection was limited to already verified product records.'],
  selected_style: ['요청한 스타일의 상품 분류가 확인됩니다.', 'The product has the requested style classification.'],
  requested_color: ['질문에 표현한 색상 조건을 반영했습니다.', 'The color expressed in the question was considered.'],
  avoided_color: ['피하고 싶은 색상에 해당하는 후보를 제외했습니다.', 'Candidates in the colors you wanted to avoid were excluded.'],
  selected_category: ['요청한 의류 카테고리에 해당합니다.', 'The item belongs to the requested clothing category.'],
  selected_collection: ['선택한 컬렉션 조건에 해당하는 후보입니다. 성별이나 신체를 추정한 결과가 아닙니다.', 'The candidate matches the selected collection filter. This does not infer anyone’s gender or body.'],
  item_budget: ['상품 금액이 선택한 통화의 상품당 예산 안에 있습니다. 미확인 배송비·세금·관세를 포함한 총액은 아닙니다.', 'The item price is within the per-item budget in the selected currency. This is not a total that includes unknown shipping, tax or duties.'],
  shipping_destination: ['선택한 목적지가 검증 상품의 배송 가능 국가 목록에 있습니다. 판매처에서 최종 조건을 확인하세요.', 'The selected destination is in the verified offer’s shipping-country list. Confirm the final conditions with the retailer.']
});

const STYLES = ['minimal', 'casual', 'classic', 'streetwear'];
const CATEGORIES = ['tops', 'bottoms', 'outerwear', 'dresses', 'accessories'];
const TOPICS = ['outfit', 'fit', 'color', 'occasion', 'budget', 'care', 'compare', 'discount'];
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/.test(value);
const text = value => typeof value === 'string' ? value.normalize('NFKC').toLowerCase().replace(/[\p{Cc}\p{Cf}]/gu, ' ').replace(/\s+/g, ' ').trim() : '';
const unique = values => [...new Set(values)];
const fashion = /(?:\b(?:clothes?|clothing|outfits?|garments?|wear|wardrobe|fashion|shirts?|t-?shirts?|trousers?|pants|jeans|coats?|jackets?|dresses?|skirts?|knitwear|sweaters?|shoes?|sneakers?|suits?|blouses?|hoodies?)\b|옷|의류|코디|패션|셔츠|바지|팬츠|데님|재킷|자켓|코트|원피스|스커트|니트|신발|운동화|정장|후드)/u;
const unrelated = /(?:\b(?:bitcoin|crypto|stock\s+(?:market|prices?|portfolio|investment|forecast)|shares|equities|invest(?:ing|ment)?|(?:buy(?:ing)?|sell(?:ing)?|trade|trading)\s+(?:(?:clothing[- ]company|fashion[- ]company|company|some|the)\s+)?stocks?|mortgage|interest\s*rates?|savings?\s*accounts?|bank\s*accounts?|cars?|motorcycles?|car\s*engines?|elections?|politicians?|diagnose|diagnosis|bmi|password|api\s*key|system\s*prompt)\b|비트코인|암호화폐|주식|대출|금리|은행\s*계좌|자동차|오토바이|선거|정치인|질병\s*진단|건강\s*진단|체중\s*판정|비밀번호|시스템\s*프롬프트)/u;
const focusRules = [
  ['care', /(?:\b(?:wash|washing|laundry|care\s*label|dry\s*clean)\b|세탁|드라이클리닝|케어\s*라벨)/u],
  ['fit', /(?:\b(?:fits?|fitting|sizing|sizes?(?:\s*chart)?|measurements?)\b|사이즈|실측|기장|착용감|어깨|골반|체형|밑단|핏)/u],
  ['color', /(?:\bcolou?rs?\b|색상|색깔|컬러|톤온톤)/u],
  ['occasion', /(?:\b(?:office|interview|wedding|dress\s*code|occasion|workwear)\b|출근|면접|결혼식|하객|행사|드레스코드)/u],
  ['budget', /(?:\b(?:budget|affordable|afford|rewear)\b|예산|저렴|돌려\s*입)/u]
];
const styleRules = [
  ['minimal', /(?:\bminimal(?:ist)?\b|미니멀)/u],
  ['casual', /(?:\bcasual\b|캐주얼)/u],
  ['classic', /(?:\bclassic\b|클래식|단정한)/u],
  ['streetwear', /(?:\bstreet(?:wear)?\b|스트리트)/u]
];
const categoryRules = [
  ['tops', /(?:\b(?:shirts?|t-?shirts?|blouses?|sweaters?|hoodies?)\b|셔츠|블라우스|맨투맨|후드|니트)/u],
  ['bottoms', /(?:\b(?:pants|trousers?|jeans|skirts?)\b|바지|팬츠|데님|스커트)/u],
  ['outerwear', /(?:\b(?:coats?|jackets?|outerwear)\b|코트|재킷|자켓|아우터)/u],
  ['dresses', /(?:\bdresses?\b|원피스)/u],
  ['accessories', /(?:\b(?:shoes?|sneakers?|bags?|belts?|accessor(?:y|ies))\b|신발|운동화|가방|벨트|액세서리)/u]
];
const colorRules = [
  ['black', '(?:\\bblack\\b|검정(?:색)?|검은(?:색)?)'],
  ['white', '(?:\\bwhite\\b|흰색|하얀색|화이트)'],
  ['navy', '(?:\\bnavy\\b|네이비|남색)'],
  ['blue', '(?:\\bblue\\b|파랑(?:색)?|파란(?:색)?|블루)'],
  ['gray', '(?:\\bgr[ae]y\\b|회색|그레이)'],
  ['brown', '(?:\\bbrown\\b|갈색|브라운)'],
  ['beige', '(?:\\bbeige\\b|베이지)'],
  ['green', '(?:\\bgreen\\b|초록(?:색)?|녹색|그린)'],
  ['red', '(?:\\bred\\b|빨강(?:색)?|빨간(?:색)?|빨간|레드)'],
  ['pink', '(?:\\bpink\\b|분홍(?:색)?|핑크)'],
  ['yellow', '(?:\\byellow\\b|노랑(?:색)?|노란(?:색)?|옐로)']
];

function colors(message) {
  const matches = [];
  for (const [color, pattern] of colorRules) {
    for (const match of message.matchAll(new RegExp(pattern, 'gu'))) {
      const before = message.slice(Math.max(0, match.index - 28), match.index);
      const after = message.slice(match.index + match[0].length, match.index + match[0].length + 18);
      const excluded = /(?:\b(?:not|no|avoid|without)\b[^,.!?]{0,20})$/u.test(before)
        || /^(?:색)?(?:은|는|을|를|이|가)?\s*(?:말고|제외|빼고|싫)/u.test(after);
      matches.push({ color, excluded, position: match.index });
    }
  }
  matches.sort((a, b) => a.position - b.position || a.color.localeCompare(b.color));
  const selected = new Map();
  for (const match of matches) selected.set(match.color, match.excluded);
  return { wanted: [...selected].filter(([, excluded]) => !excluded).map(([name]) => name),
    avoided: [...selected].filter(([, excluded]) => excluded).map(([name]) => name) };
}

function validateInput(input, products, now) {
  const preferences = input?.preferences;
  if (!input || typeof input.message !== 'string' || !input.message.trim() || input.message.length > 1200
    || !preferences || typeof preferences !== 'object' || Array.isArray(preferences)
    || !['style', 'compare', 'discount'].includes(input.intent)
    || !['all', ...STYLES].includes(preferences.style)
    || !['all', ...CATEGORIES].includes(preferences.category)
    || !['all', 'women', 'men', 'unisex'].includes(preferences.gender)
    || !['KRW', 'USD', 'EUR', 'GBP', 'JPY'].includes(preferences.currency)
    || typeof preferences.destination !== 'string' || !/^[A-Z]{2}$/.test(preferences.destination)
    || !Number.isFinite(preferences.budget) || preferences.budget < 0 || preferences.budget > 1e8
    || !Array.isArray(input.history) || input.history.length > 6
    || input.history.some(row => !row || !['user', 'assistant'].includes(row.role) || typeof row.content !== 'string' || row.content.length > 1200)
    || !Array.isArray(products) || products.length > 100
    || !Number.isSafeInteger(now) || now <= 0) throw new TypeError('invalid_a1_style_input');
}

function eligible(row, preferences, style, category, colorChoice, now) {
  if (!row || typeof row !== 'object' || !id(row.id) || row.sourceVerified !== true || row.demo !== false
    || row.stock !== 'in_stock' || row.shippingStatus !== 'confirmed' || !Array.isArray(row.shippingCountries)
    || !row.shippingCountries.includes(preferences.destination) || row.currency !== preferences.currency
    || !Number.isFinite(row.price) || row.price < 0 || row.price > preferences.budget
    || !Number.isSafeInteger(row.checkedAt) || row.checkedAt <= 0 || row.checkedAt > now
    || !Number.isSafeInteger(row.expiresAt) || row.expiresAt <= now
    || row.promotion && (!Number.isSafeInteger(row.promotion.endsAt) || row.promotion.endsAt <= now)
    || !['women', 'men', 'unisex'].includes(row.gender) || !CATEGORIES.includes(row.category)
    || preferences.gender !== 'all' && row.gender !== preferences.gender && row.gender !== 'unisex'
    || category !== 'all' && row.category !== category
    || style !== 'all' && (!Array.isArray(row.styles) || !row.styles.includes(style))) return false;
  const rowColors = colors(text(row.color)).wanted;
  return !rowColors.some(color => colorChoice.avoided.includes(color))
    && (!colorChoice.wanted.length || rowColors.some(color => colorChoice.wanted.includes(color)));
}

function rankProducts(products, input, style, category, colorChoice, now) {
  const duplicates = new Map();
  for (const product of products) if (product && id(product.id)) duplicates.set(product.id, (duplicates.get(product.id) || 0) + 1);
  const ranked = [];
  for (const product of products) {
    if (!eligible(product, input.preferences, style, category, colorChoice, now) || duplicates.get(product.id) !== 1) continue;
    const reasons = ['verified_source', 'item_budget', 'shipping_destination'];
    let score = 0;
    if (style !== 'all') { score += 30; reasons.push('selected_style'); }
    if (category !== 'all') { score += 20; reasons.push('selected_category'); }
    if (input.preferences.gender !== 'all') reasons.push('selected_collection');
    const matchColor = colors(text(product.color)).wanted.some(color => colorChoice.wanted.includes(color));
    if (colorChoice.wanted.length && matchColor) { score += 40; reasons.push('requested_color'); }
    if (colorChoice.avoided.length) reasons.push('avoided_color');
    // Budget is explicitly per item. Shipping/tax/duties are not invented or
    // combined into this ranking, and no lowest-total-price claim is produced.
    score += input.preferences.budget > 0 ? 1 - product.price / input.preferences.budget : 0;
    ranked.push({ product, score, reasons });
  }
  ranked.sort((a, b) => b.score - a.score || a.product.id.localeCompare(b.product.id, 'en'));
  return ranked.slice(0, 4);
}

function adviceFor(topic, message, style) {
  if (topic === 'care') return ['care_label'];
  if (topic === 'fit') return ['fit_comfort', 'size_chart'];
  if (topic === 'color') return ['color_neutral', 'color_tonal'];
  if (topic === 'budget') return ['budget_rewear', style === 'all' ? 'outfit_minimal' : 'outfit_' + style];
  if (topic === 'occasion') {
    const work = /(?:\b(?:office|interview|workwear)\b|출근|면접|회사)/u.test(message);
    const event = /(?:\b(?:wedding|party|ceremony|gala|event)\b|결혼식|하객|행사|파티)/u.test(message);
    // The prototype label alone cannot establish that someone is attending
    // work, a wedding or any other event. Ask for the missing occasion.
    if (!work && !event) return ['fit_comfort', 'layer_weather'];
    return [work ? 'occasion_work' : 'occasion_event', style === 'all' ? work ? 'outfit_classic' : 'layer_weather' : 'outfit_' + style];
  }
  if (topic === 'compare' || topic === 'discount') return ['budget_rewear', 'size_chart'];
  return [style === 'all' ? 'collection_choice' : 'outfit_' + style, 'fit_balance', 'fit_comfort'];
}

/** Never interpret this result as a subscription grant or a garment fit score. */
export function createA1StylePlan(input, products = [], { now = Date.now(), classify = message => predictIntent(intentModel, message) } = {}) {
  validateInput(input, products, now);
  if (typeof classify !== 'function') throw new TypeError('invalid_a1_classifier');
  const current = text(input.message);
  const lastUser = [...input.history].reverse().find(row => row.role === 'user');
  const prior = lastUser && fashion.test(text(lastUser.content)) && !unrelated.test(text(lastUser.content)) ? lastUser : null;
  const focused = focusRules.find(([, pattern]) => pattern.test(current))?.[0];
  const currentColors = colors(current);
  const styleMention = styleRules.find(([, pattern]) => pattern.test(current))?.[0];
  const followup = !fashion.test(current) && (Boolean(focused || styleMention) || currentColors.wanted.length + currentColors.avoided.length > 0
    || /(?:\b(?:cheaper|another|instead|more|less|that|those|it|available|availability|in\s+stock)\b|더\s*저렴|다른|그거|그것|대신|재고|품절)/u.test(current));
  const useContext = Boolean(prior && followup);
  const context = useContext ? text(prior.content) : '';
  // A selected dropdown, generic 'budget/color/compare' token or a learned
  // prototype prediction cannot establish fashion scope on its own.
  const hasFashion = fashion.test(current) || Boolean(context);
  const scoped = !unrelated.test(current) && hasFashion;
  const reasons = ['own_engine'];
  if (!scoped) {
    reasons.push(unrelated.test(current) ? 'fashion_scope_only' : 'clarification_needed');
    return { plan: validateStylistPlan({ scope: 'out_of_scope', topic: 'outfit', adviceIds: [], productIds: [], followUp: 'style' }, []),
      reasons, productReasons: [], engine: A1_ENGINE_METADATA, routing: { topic: null, method: 'scope-guard' } };
  }
  const classified = classify(((context ? context.slice(-300) + ' ' : '') + current).slice(-1200));
  const learnedTopic = classified?.method === 'trained-seed' && TOPICS.includes(classified.topic) ? classified.topic : null;
  let topic = input.intent !== 'style' ? input.intent : learnedTopic || focused || 'outfit';
  // Explicit care/fit questions must not accidentally become shopping requests
  // because a small synthetic prototype classifier is uncertain or mistaken.
  if (input.intent === 'style' && ['care', 'fit'].includes(focused)) topic = focused;
  const usedLearned = input.intent === 'style' && learnedTopic === topic;
  if (usedLearned) reasons.push('development_intent');
  if (useContext) reasons.push('conversation_context');
  const inferredStyle = styleMention || styleRules.find(([, pattern]) => pattern.test(context))?.[0];
  const style = input.preferences.style === 'all' ? inferredStyle || 'all' : input.preferences.style;
  if (style !== 'all') reasons.push('explicit_style');
  const mentionedCategories = categoryRules.filter(([, pattern]) => pattern.test(current + ' ' + context)).map(([name]) => name);
  const category = input.preferences.category === 'all' && mentionedCategories.length === 1 ? mentionedCategories[0] : input.preferences.category;
  const colorChoice = currentColors.wanted.length + currentColors.avoided.length ? currentColors : colors(context);
  let adviceIds = adviceFor(topic, current + ' ' + context, style);
  if (input.consents?.analysis === true && Number.isFinite(input.metrics?.shoulderHipRatio) && Number.isFinite(input.metrics?.legTorsoRatio)
    && input.metrics.shoulderHipRatio >= 0.45 && input.metrics.shoulderHipRatio <= 2.5 && input.metrics.legTorsoRatio >= 0.6 && input.metrics.legTorsoRatio <= 3.5) {
    reasons.push('consented_reference_ratios');
    // Experimental guidance priorities only. These photo-space thresholds do
    // not identify an ideal/normal body, physical measurements or garment fit.
    const referenceAdvice = [];
    if (input.metrics.shoulderHipRatio < 0.9 || input.metrics.shoulderHipRatio > 1.1) referenceAdvice.push('fit_balance');
    if (input.metrics.legTorsoRatio < 1.3 || input.metrics.legTorsoRatio > 2.1) referenceAdvice.push('fit_length');
    adviceIds = [...referenceAdvice, ...adviceIds];
  }
  let selected = hasFashion && !['care', 'fit'].includes(topic) ? rankProducts(products, input, style, category, colorChoice, now) : [];
  if (!selected.length && !['care', 'fit'].includes(topic)) reasons.push('no_verified_products');
  if (topic === 'fit') reasons.push('garment_measurements_unavailable');
  if (!hasFashion) reasons.push('clarification_needed');
  const plan = validateStylistPlan({ scope: 'fashion', topic, adviceIds: unique(adviceIds).slice(0, 5),
    productIds: selected.map(row => row.product.id), followUp: topic === 'fit' ? 'size' : topic === 'care' ? 'none' : topic === 'occasion' ? 'occasion' : style === 'all' ? 'style' : 'occasion' }, selected.map(row => row.product.id));
  return { plan, reasons: unique(reasons), productReasons: selected.map(row => ({ productId: row.product.id, reasons: row.reasons })),
    engine: A1_ENGINE_METADATA, routing: { topic, method: usedLearned ? 'trained-seed' : input.intent !== 'style' ? 'explicit-intent' : 'curated-fallback' } };
}

/** Only canonical reason text reaches the public response; raw scores, training
 * weights, messages and unknown reason codes are never reflected here.
 */
export function renderA1Reasons(result, language = 'ko') {
  const at = language === 'en' ? 1 : 0;
  const render = codes => unique(Array.isArray(codes) ? codes : []).filter(code => Object.hasOwn(REASON_TEXT, code))
    .slice(0, 8).map(code => ({ id: code, text: REASON_TEXT[code][at] }));
  return { reasonDetails: render(result?.reasons), productReasons: (Array.isArray(result?.productReasons) ? result.productReasons : [])
    .filter(row => id(row?.productId)).slice(0, 4).map(row => ({ productId: row.productId, reasons: render(row.reasons) })) };
}
