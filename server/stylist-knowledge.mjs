/** Curated bilingual fashion guidance. The model selects IDs; it cannot author commercial claims. */
export const STYLE_ADVICE = Object.freeze({
  fit_comfort: ['편안하게 움직일 수 있는 핏부터 비교하세요. 사진 속 비율만으로 실제 치수나 맞는 사이즈를 확정할 수는 없습니다.', 'Compare fits that let you move comfortably. Photo proportions cannot establish measurements or a correct clothing size.'],
  fit_balance: ['상의와 하의의 여유를 다르게 조합해보세요. 예를 들어 여유 있는 상의에는 깔끔한 하의를 함께 비교할 수 있습니다.', 'Try balancing volume between your top and bottom, such as a relaxed top with a more streamlined bottom.'],
  fit_length: ['상의의 끝선과 바지 밑단 위치를 바꾸어 전체 실루엣을 비교해보세요. 체형에는 정답이나 우열이 없습니다.', 'Compare silhouettes by adjusting top length and trouser hems. There is no right or superior body shape.'],
  color_neutral: ['아이보리·네이비·차콜처럼 서로 조합하기 쉬운 색을 중심으로 시작하고 포인트 색을 하나 더해보세요.', 'Start with easy-to-combine colors such as ivory, navy and charcoal, then try one accent color.'],
  color_tonal: ['비슷한 색상 안에서 밝기와 소재를 달리하면 차분한 톤온톤 코디를 구성할 수 있습니다.', 'Vary lightness and texture within a similar color family for a tonal outfit.'],
  outfit_minimal: ['간결한 상의와 스트레이트 실루엣의 하의를 조합하고 장식과 색의 수를 줄여보세요.', 'Try a simple top with straight-cut bottoms and a restrained number of colors and details.'],
  outfit_casual: ['편안한 티셔츠나 셔츠에 데님 또는 면 팬츠를 조합하고 활동할 때의 편안함을 확인하세요.', 'Combine a comfortable T-shirt or shirt with denim or cotton trousers, and check comfort while moving.'],
  outfit_classic: ['셔츠·니트·테일러드 아우터와 단정한 하의를 조합해보세요. 소재와 기장의 균형을 비교하면 좋습니다.', 'Explore a shirt, knit or tailored outer layer with neat bottoms, comparing fabric and length balance.'],
  outfit_streetwear: ['여유 있는 실루엣과 레이어드로 분위기를 만들고, 강조할 요소를 하나 정해보세요.', 'Explore relaxed silhouettes and layering, choosing one focal detail for a streetwear outfit.'],
  occasion_work: ['업무 환경의 복장 기준과 이동량을 먼저 확인하고, 레이어를 더하거나 뺄 수 있는 조합을 고르세요.', 'Consider your workplace dress code and mobility, then choose an outfit with adjustable layers.'],
  occasion_event: ['행사의 복장 안내·날씨·장소를 확인한 뒤 신발과 아우터까지 함께 구성하세요.', 'Check the event dress code, weather and venue, then plan shoes and outerwear together.'],
  layer_weather: ['기온 변화에 대응할 수 있도록 얇은 이너와 벗기 쉬운 겉옷을 겹쳐보세요.', 'Try a light inner layer with easy-to-remove outerwear for changing temperatures.'],
  budget_rewear: ['이미 가진 옷과 반복해서 조합할 수 있는지 먼저 생각하고, 구매 예산은 배송비와 반품 조건까지 함께 확인하세요.', 'Consider how often an item works with clothes you already own, and check shipping and return terms against your budget.'],
  care_label: ['세탁·관리 방법은 상품의 실제 케어 라벨을 기준으로 확인하세요. 소재명만으로 안전한 세탁 방법을 단정하지 않습니다.', 'Follow the actual garment care label. A fabric name alone does not establish a safe washing method.'],
  collection_choice: ['남성·여성·유니섹스는 탐색할 컬렉션 선택입니다. 본인의 취향에 맞게 자유롭게 조합할 수 있습니다.', 'Men, women and unisex are collection filters. You can combine styles according to your preferences.'],
  size_chart: ['실제 사이즈표의 의류 실측과 이미 편하게 입는 옷을 비교하고 판매처의 교환·반품 조건을 확인하세요.', 'Compare the actual size chart with a garment that fits comfortably, and check the retailer’s exchange and return conditions.']
});
export const ADVICE_IDS = Object.freeze(Object.keys(STYLE_ADVICE));
export const MODEL_TOPICS = Object.freeze(['outfit','fit','color','occasion','budget','care','compare','discount']);
const FOLLOW_UPS = Object.freeze({
  none: ['', ''], occasion: ['주로 어떤 상황에서 입을 옷을 찾고 계신가요?', 'What occasion are you dressing for?'],
  size: ['편하게 입는 옷의 실측이나 원하는 핏을 알려주시겠어요?', 'What fit do you prefer, or what are the measurements of a comfortable garment?'],
  style: ['원하는 스타일이나 좋아하는 색을 알려주세요.', 'Tell me your preferred style or colors.'],
  budget: ['선택한 통화로 상품당 예산을 알려주세요.', 'What is your per-item budget in the selected currency?'],
  country: ['상품을 배송받을 국가를 선택해주세요.', 'Choose the country where you want the item delivered.']
});
export function stylistPlanSchema(productIds = []) {
  return { type: 'object', additionalProperties: false,
    properties: { scope: { type:'string', enum:['fashion','out_of_scope'] }, topic:{type:'string',enum:[...MODEL_TOPICS]},
      adviceIds:{type:'array',items:{type:'string',enum:[...ADVICE_IDS]},maxItems:5},
      productIds:{type:'array',items:{type:'string',enum:['NONE',...productIds]},maxItems:4},
      followUp:{type:'string',enum:Object.keys(FOLLOW_UPS)} },
    required:['scope','topic','adviceIds','productIds','followUp'] };
}
export function validateStylistPlan(plan, productIds = []) {
  const fields=['scope','topic','adviceIds','productIds','followUp'];
  if(!plan||typeof plan!=='object'||Array.isArray(plan)||Object.keys(plan).length!==fields.length
    ||fields.some(key=>!Object.hasOwn(plan,key))||!['fashion','out_of_scope'].includes(plan.scope)
    ||!MODEL_TOPICS.includes(plan.topic)||!Object.hasOwn(FOLLOW_UPS,plan.followUp))throw new TypeError('invalid_stylist_plan');
  for(const [key,allowed,max] of [['adviceIds',ADVICE_IDS,5],['productIds',['NONE',...productIds],4]]){
    if(!Array.isArray(plan[key])||plan[key].length>max||new Set(plan[key]).size!==plan[key].length
      ||plan[key].some(id=>typeof id!=='string'||!allowed.includes(id)))throw new TypeError('ungrounded_stylist_plan');
  }
  if(plan.scope==='out_of_scope'&&(plan.productIds.some(id=>id!=='NONE')||plan.adviceIds.length))throw new TypeError('invalid_stylist_scope');
  return { ...plan, adviceIds:[...plan.adviceIds],productIds:plan.productIds.filter(id=>id!=='NONE') };
}
export function demoStylistPlan(input, products = []) {
  const message=input.message.toLowerCase(),style=input.preferences.style;
  let topic=input.intent==='style'?'outfit':input.intent;
  let advice=['fit_comfort','collection_choice'];
  if(/색|컬러|colou?r/u.test(message)){topic='color';advice=['color_neutral','color_tonal'];}
  else if(/사이즈|핏|size|fit/u.test(message)){topic='fit';advice=['fit_comfort','size_chart'];}
  else if(/회사|출근|면접|work|office|interview/u.test(message)){topic='occasion';advice=['occasion_work','outfit_classic'];}
  else if(/결혼|행사|wedding|event/u.test(message)){topic='occasion';advice=['occasion_event','layer_weather'];}
  else if(/세탁|관리|wash|care/u.test(message)){topic='care';advice=['care_label'];}
  else if(/예산|저렴|budget|afford/u.test(message)){topic='budget';advice=['budget_rewear','outfit_minimal'];}
  else if(['minimal','casual','classic','streetwear'].includes(style))advice=['outfit_'+style,'fit_balance'];
  if(input.metrics)advice.push('fit_length');
  return {scope:'fashion',topic,adviceIds:advice.slice(0,5),productIds:products.slice(0,4).map(row=>row.id),followUp:'occasion'};
}
export function renderStylistGuidance(plan, {language='ko',intent='style',planCode='GENERAL'} = {}) {
  const en=language==='en',at=en?1:0;
  if(plan.scope==='out_of_scope')return {reply:en?'I can help with fashion, outfit choices and verified clothing information.':'패션·코디와 검증된 의류 정보에 관해 상담할 수 있습니다.',advice:[]};
  const advice=plan.adviceIds.map(id=>({id,text:STYLE_ADVICE[id][at]}));
  const opening=en?'Let’s explore an outfit that suits your preferences. These suggestions do not guarantee fit or size.':'선택한 취향에 맞춰 코디를 살펴볼게요. 실제 착용감이나 사이즈를 보장하는 안내는 아닙니다.';
  const premiumHint=planCode!=='PREMIUM'&&['compare','discount'].includes(plan.topic)
    ?en?'Price comparison and verified discount recommendations require Premium.':'가격 비교와 검증된 할인 추천에는 프리미엄 구독이 필요합니다.':'';
  const intentHint=intent==='compare'?(en?'Only the same verified product variant is compared. Unknown costs do not count as zero.':'확인된 동일 상품·색상·사이즈·상태만 비교하며 미확인 비용을 0으로 계산하지 않습니다.')
    :intent==='discount'?(en?'Only current, verified promotion prices are considered.':'현재 적용 중이며 검증된 프로모션 가격만 살펴봅니다.'):'';
  return {reply:[opening,premiumHint,intentHint,FOLLOW_UPS[plan.followUp][at]].filter(Boolean).join(' '),advice};
}
