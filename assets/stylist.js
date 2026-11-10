'use strict';
(() => {
  const preview = window.A1Preview;
  let previewCatalogError=false,previewCatalogTimer;
  let previewAnswer = null, previewCatalog={version:1,generatedAt:null,products:[]};
  const Catalog=window.A1ProductCatalog,Query=window.A1ShoppingQuery,OfferComparison=window.A1OfferComparison;
  const $ = selector => document.querySelector(selector);
  const I = window.A1I18n;
  const t = (source, values) => I.t(source, values);
  const tx = (element, source, values) => I.setText(typeof element === 'string' ? $(element) : element, source, values);
  const form = $('#stylist-form'), chat = $('#stylist-chat');
  const merchants = new Set(['www.coupang.com','search.shopping.naver.com','www.ebay.com','www.ebay.co.uk','www.ebay.de','www.amazon.com','www.amazon.co.jp','www.amazon.co.uk','www.amazon.de','search.rakuten.co.jp','www.zalando.de']);
  const currencies = new Set(['KRW','USD','EUR','GBP','JPY']);
  const conversations = [], pending = new Set();
  let generation = 0, busy = false, configuration = { mode: 'DEMO', liveEnabled: false }, accessUntil = 0, expiryTimer;
  const node = (tag, text, className) => { const element = document.createElement(tag); if (text !== undefined) element.textContent = text; if (className) element.className = className; return element; };
  const finitePrice = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  const money = (value, currency) => finitePrice(value) && currencies.has(currency) ? new Intl.NumberFormat(I.locale, {style:'currency',currency,currencyDisplay:'code',maximumFractionDigits:['KRW','JPY'].includes(currency)?0:2}).format(value) : t('미확인');
  const time = value => Number.isSafeInteger(value) && value > 0 ? new Intl.DateTimeFormat(I.locale,{dateStyle:'medium',timeStyle:'short'}).format(value) : t('미확인');
  function safeLink(value, label) {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password || url.port || !(merchants.has(url.hostname) || merchants.has('www.' + url.hostname))) return null;
      const link = node('a', label); link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; return link;
    } catch { return null; }
  }
  function status(source, error = false, values) { tx('#stylist-status', source, values); $('#stylist-status').classList.toggle('is-error', error); }
  function setBusy(value) { busy = value; $('#stylist-send').disabled = value; form.setAttribute('aria-busy', String(value)); }
  function ratioInputs() { for (const name of ['shoulderHipRatio','legTorsoRatio']) form.elements[name].disabled = !$('#stylist-analysis-consent').checked; }
  function readiness() {
    tx('#stylist-config', preview ? preview.source('notice') : configuration.liveEnabled === true && configuration.mode === 'LIVE'
      ? 'GPT 상담이 활성화되어 있습니다. 외부 AI 전송에 동의한 경우에만 호출합니다.'
      : configuration.mode === 'UNAVAILABLE' ? '상담 연결을 준비 중입니다. 기존 무료 사진 분석과 회원 기능은 계속 이용할 수 있습니다.'
      : 'DEMO 모의 상담 · 실제 GPT를 호출하지 않습니다. 실제 상품이 확인되지 않으면 상품·가격을 생성하지 않습니다.');
  }
  function welcome() {
    const block = node('div', undefined, 'stylist-welcome'); block.id = 'stylist-welcome';
    block.append(node('span', 'A1 / STYLE STARTS WITH YOU'));
    const title = node('h3'); tx(title, '오늘은 어떤 옷을 입고 싶으세요?');
    const copy = node('p'); tx(copy, '상황·스타일·예산을 알려주세요. 확인된 상품이 없는 경우 상품이나 가격을 만들어 추천하지 않습니다.');
    block.append(title, copy); chat.replaceChildren(block);
  }
  function clearConversation({resetProfile = false, clearMetrics = true} = {}) {
    previewAnswer = null;clearTimeout(previewCatalogTimer);previewCatalogTimer=undefined;
    generation++;
    clearTimeout(expiryTimer); expiryTimer = undefined; accessUntil = 0;
    for (const controller of pending) controller.abort();
    pending.clear(); conversations.length = 0; setBusy(false);
    if (resetProfile) form.reset();
    $('#stylist-message').value = '';
    $('#stylist-external-consent').checked = false;
    $('#stylist-analysis-consent').checked = false;
    ratioInputs();
    if (clearMetrics) { form.elements.shoulderHipRatio.value = ''; form.elements.legTorsoRatio.value = ''; $('#stylist-analysis-imported').hidden = true; }
    welcome();
  }
  function expireConversation() {
    clearConversation();
    status('구독 확인 기간이 끝나 이전 상담을 지웠습니다. 상담을 다시 요청해 권한을 확인해주세요.', true);
  }
  function protectResponse(result) {
    if (preview && result.previewLocal === true) return;
    if (result.freeBetaMode === true && result.mode === 'DEMO') {
      clearTimeout(expiryTimer); expiryTimer = undefined; accessUntil = 0;
      return;
    }
    if (!Number.isSafeInteger(result.accessUntil) || result.accessUntil <= Date.now()) {
      const error = new Error('expired-response'); error.status = 403; throw error;
    }
    accessUntil = Math.min(accessUntil || result.accessUntil, result.accessUntil);
    if (accessUntil <= Date.now()) { const error = new Error('expired-response'); error.status = 403; throw error; }
    clearTimeout(expiryTimer);
    const check = () => {
      if (accessUntil <= Date.now()) expireConversation();
      else expiryTimer = setTimeout(check, Math.min(accessUntil - Date.now(), 2147483647));
    };
    expiryTimer = setTimeout(check, Math.min(accessUntil - Date.now(), 2147483647));
  }
  function refreshPrivateContext() {
    if (preview) return;
    if (accessUntil && accessUntil <= Date.now()) { expireConversation(); return; }
    // No internal identity is exposed to the browser. Returning to a paid
    // conversation starts fresh so a different/revoked session cannot inherit it.
    if (conversations.length || busy) {
      clearConversation();
      status('상담을 다시 요청해 현재 계정과 구독 권한을 확인해주세요. 이전 대화는 지웠습니다.');
    }
  }
  function catalogAnswer(request){
    const base=preview.consult(request);if(previewCatalogError)base.notices.push(t('등록 상품 자료를 확인하지 못했습니다. 공식 검색 대안을 이용해주세요.'));if(!Catalog||!Query)return base;let parsed;try{parsed=Query.parse(request.message.slice(0,300));}catch{parsed=Query.parse('의류');}
    const prefs=request.preferences||{},conditions={...parsed,gender:prefs.gender&&prefs.gender!=='all'?prefs.gender:parsed.gender,style:prefs.style&&prefs.style!=='all'?prefs.style:parsed.style,category:prefs.category&&prefs.category!=='all'?prefs.category:parsed.category,currency:prefs.currency||'KRW',budget:parsed.budget!==null&&prefs.currency==='KRW'?Math.min(parsed.budget,prefs.budget):prefs.budget??null};
    const ranked=Catalog.search(previewCatalog,conditions,{query:request.message,bodyConsent:request.consents?.analysis===true,metrics:request.metrics});
    base.products=ranked.matches.slice(0,12).map(row=>({...row.product,matchScore:row.score,matchReasons:row.reasons}));base.catalogRows=ranked.matches.slice(0,4);base.catalogComparisonOptions={destination:prefs.destination||'KR',currency:conditions.currency};base.catalogSearchRows=Query.links({...conditions,gender:conditions.gender==='unisex'?'all':conditions.gender});
    if(base.products.length){base.dataStatus='registered';base.notices=[t('판매자 등록 자료 기준이며 실시간 가격·배송·세금·착용감은 보장하지 않습니다.')];}return base;
  }
  function catalogProductLink(product,label){const allowed=Catalog?.validateSnapshot(previewCatalog).find(p=>p.id===product.id&&p.productUrl===product.productUrl&&!p.commercial?.sponsored&&p.stock==='in_stock');if(!allowed)return null;const a=node('a',label);a.href=allowed.productUrl;a.rel=(allowed.commercial?.affiliate?'sponsored ':'')+'noopener noreferrer';a.referrerPolicy='no-referrer';a.dataset.stylistCatalogBuy=allowed.id;return a;}
  function affiliateDisclosure(product){
    if(product.commercial?.affiliate!==true)return null;
    const disclosure=node('p',t('제휴 링크')+' · '+product.commercial.label+' · '+t('외부 판매처에서 구매하면 A1이 수수료를 받을 수 있습니다. 추천 순위와는 별개입니다.'),'stylist-source');disclosure.dataset.stylistAffiliate=product.id;return disclosure;
  }
  function catalogComparison(rows,options={destination:'KR',currency:'KRW'}){
    const section=node('section',undefined,'stylist-comparison');section.dataset.stylistCandidateComparison='';section.append(node('h4',t('등록 후보 상품 비교 · 동일 상품 최저가 비교가 아닙니다.')));
    const wrap=node('div',undefined,'stylist-offer-table-wrap'),table=node('table'),head=node('tr');for(const label of ['상품','판매자','상품 가격','사이즈','조건 일치 점수'])head.append(node('th',t(label)));table.append(head);
    for(const {product:p,score}of rows){const row=node('tr');for(const value of [p.name,p.retailerName,money(p.price,p.currency),p.sizes.join(', ')||t('사이즈표 미제공'),String(score)])row.append(node('td',value));table.append(row);}wrap.append(table);section.append(wrap,node('p',t('서로 다른 후보의 특성·상품금액 비교이며 동일 의류의 판매처별 최저가를 뜻하지 않습니다.')));
    section.append(node('p',t('판매자 등록 자료 기준이며 실시간 가격·배송·세금·착용감은 보장하지 않습니다.')));
    section.append(catalogOfferComparisons(rows,options));return section;
  }
  function catalogOfferComparisons(rows,options){
    const section=node('section');section.dataset.stylistOfferComparisons='';
    if(!OfferComparison?.compare){section.append(node('p',t('동일 상품 비교 코드를 불러오지 못했습니다. 페이지를 새로고침해주세요.')));return section;}
    // Validate the entire built snapshot, then keep stale offers visible only as
    // excluded rows. Sponsored offers never enter organic recommendation or cost rankings.
    Catalog.validateSnapshot(previewCatalog);const products=previewCatalog.products.filter(p=>!p.commercial?.sponsored),seen=new Set();let groups=0;
    for(const {product:selected}of rows){
      const comparison=OfferComparison.compare(products,selected,{destination:options.destination,currency:options.currency,now:Date.now()});
      if(comparison.status!=='exact_variant'||!Array.isArray(comparison.rows))continue;
      const sellers=new Set(comparison.rows.map(p=>p.retailerName.normalize('NFC').trim().toLowerCase()));
      if(sellers.size<2)continue;
      const key=comparison.rows.map(p=>p.id).sort().join('|');if(seen.has(key))continue;seen.add(key);groups++;
      const group=node('section',undefined,'stylist-comparison');group.dataset.stylistExactComparison=selected.id;
      group.append(node('h4',t('동일 상품·색상·사이즈·상태의 판매처별 비용 비교')+' · '+selected.name));
      group.append(node('p',t('동일성 기준')+': '+[selected.brand,selected.gtin?'GTIN '+selected.gtin:'MPN '+selected.mpn,selected.color,selected.offerSize,selected.sizeSystem,selected.condition].join(' / ')),node('p',t('배송 목적지 {destination} · 비교 통화 {currency}',options)));
      const totalAvailable=comparison.lowestOfferId&&finitePrice(comparison.minimumAmount);
      group.append(node('p',totalAvailable?t('확인된 비교 대상 중 최저 예상 비용: {price}',{price:money(comparison.minimumAmount,options.currency)}):t('미확인 비용·배송·재고 또는 오래된 자료로 최저가를 정할 수 없습니다.')));
      const wrap=node('div',undefined,'stylist-offer-table-wrap'),table=node('table'),head=node('tr');
      for(const label of ['판매자','상품 가격','배송비','세금','관세','총액','재고','사이즈','마지막 확인','구매 조건'])head.append(node('th',t(label)));table.append(head);
      for(const offer of comparison.rows){const row=node('tr');row.dataset.stylistOffer=offer.id;
        const stock=offer.stock==='in_stock'?t('재고 있음'):offer.stock==='out_of_stock'?t('품절'):t('미확인');
        const size=[offer.offerSize,offer.sizeSystem].filter(Boolean).join(' / ')||t('미확인');
        for(const value of [offer.retailerName,money(offer.price,offer.currency),money(offer.shipping,offer.currency),money(offer.tax,offer.currency),money(offer.duties,offer.currency),money(offer.total,options.currency),stock,size,time(offer.checkedAt),offer.purchaseConditions||t(offer.purchaseConditionsVerified===true?'추가 구매 조건 없음 · 자료 확인':'구매 조건 미확인')])row.append(node('td',value));
        if(offer.id===comparison.lowestOfferId&&totalAvailable)row.dataset.stylistLowest='';
        table.append(row);
      }
      wrap.append(table);group.append(wrap);
      for(const offer of comparison.rows){
        const detail=node('p',offer.retailerName+' · ');const link=catalogProductLink(offer,t('판매처에서 상품 확인'));if(link){const disclosure=affiliateDisclosure(offer);if(disclosure)group.append(disclosure);detail.append(link);}else detail.append(document.createTextNode(t('현재 이용 가능한 상품 링크가 없습니다.')));
        if(offer.eligible!==true)detail.append(document.createTextNode(' · '+t('미확인 비용·배송·재고 또는 오래된 자료로 최저가 선정에서 제외됩니다.')));group.append(detail);
      }
      group.append(node('p',t('미확인 금액을 0으로 계산하거나 임의 환율을 적용하지 않습니다. 전 세계 최저가·최종 결제금액 보장이 아닙니다.')));section.append(group);
    }
    if(!groups)section.append(node('p',t('동일 상품으로 확인된 다른 판매처 자료가 없습니다. 후보 비교만 제공합니다.')));
    return section;
  }
  if(preview)I.register({'등록 상품 자료를 확인하지 못했습니다. 공식 검색 대안을 이용해주세요.':'Registered product data could not be verified. Use official search alternatives.','예산 범위':'Within budget','스타일 일치':'Style matches','색상 일치':'Color matches','용도 일치':'Occasion matches','사이즈 표기 일치':'Listed size matches','컬렉션 일치':'Collection matches','사진상 비율 참고 규칙':'Photo-ratio reference rule','등록 후보 상품 비교 · 동일 상품 최저가 비교가 아닙니다.':'Registered candidate comparison · not a lowest-price comparison of identical items.','판매자 등록 자료 기준이며 실시간 가격·배송·세금·착용감은 보장하지 않습니다.':'Based on registered seller data; live prices, shipping, taxes and fit are not guaranteed.','조건 일치 점수':'Condition-match score','사이즈표 미제공':'Size chart not supplied'});
  if(preview)I.register({
    '동일성 기준':'Identity basis','배송 목적지 {destination} · 비교 통화 {currency}':'Delivery destination {destination} · comparison currency {currency}',
    '상품':'Product','판매자':'Seller','상품 가격':'Item price','사이즈':'Size','마지막 확인':'Last checked',
    '배송비':'Shipping','세금':'Tax','관세':'Duties','총액':'Total','재고':'Stock','재고 있음':'In stock','품절':'Out of stock','구매 조건':'Purchase conditions','추가 구매 조건 없음 · 자료 확인':'No additional purchase conditions · reviewed in source','구매 조건 미확인':'Purchase conditions unknown',
    '판매처에서 상품 확인':'Check product at seller','제휴 링크':'Affiliate link',
    '외부 판매처에서 구매하면 A1이 수수료를 받을 수 있습니다. 추천 순위와는 별개입니다.':'A1 may receive a commission if you buy from the external seller. This is separate from recommendation ranking.',
    '서로 다른 후보의 특성·상품금액 비교이며 동일 의류의 판매처별 최저가를 뜻하지 않습니다.':'This compares different candidates and their item prices, not the lowest seller price for the same garment.',
    '동일 상품 비교 코드를 불러오지 못했습니다. 페이지를 새로고침해주세요.':'The same-item comparison code did not load. Reload this page.',
    '동일 상품·색상·사이즈·상태의 판매처별 비용 비교':'Seller costs for the same product, color, size and condition',
    '미확인 비용·배송·재고 또는 오래된 자료로 최저가를 정할 수 없습니다.':'Unknown costs, delivery, stock or stale data prevent a lowest-price result.',
    '현재 이용 가능한 상품 링크가 없습니다.':'No currently available product link.',
    '미확인 금액을 0으로 계산하거나 임의 환율을 적용하지 않습니다. 전 세계 최저가·최종 결제금액 보장이 아닙니다.':'Unknown amounts are not treated as zero and exchange rates are not invented. This is not a worldwide lowest-price or final checkout guarantee.',
    '동일 상품으로 확인된 다른 판매처 자료가 없습니다. 후보 비교만 제공합니다.':'No other seller is confirmed for the same product. Only candidate comparison is available.'
  });
  function rerenderPreviewAnswer(){
    if(!preview||!previewAnswer)return;const {request,question}=previewAnswer;
    const result=catalogAnswer({...request,language:I.language});chat.replaceChildren();
    const bubble=node('article',undefined,'stylist-message is-user');bubble.dataset.i18nIgnore='';bubble.append(node('h3',t('나의 질문')),node('p',question));chat.append(bubble);renderAnswer(result,request.intent);
  }
  function schedulePreviewCatalogRefresh(){
    clearTimeout(previewCatalogTimer);previewCatalogTimer=undefined;if(!preview||!previewAnswer)return;
    const now=Date.now(),deadlines=previewCatalog.products.filter(p=>!p.commercial?.sponsored).flatMap(p=>[p.expiresAt,p.checkedAt+86400000+1]).filter(n=>Number.isSafeInteger(n)&&n>now);if(!deadlines.length)return;
    previewCatalogTimer=setTimeout(()=>{if(!previewAnswer)return;try{rerenderPreviewAnswer();}catch{clearConversation();status('등록 상품 자료를 확인하지 못했습니다. 공식 검색 대안을 이용해주세요.',true);}},Math.min(Math.min(...deadlines)-now,2147483647));
  }
  async function api(method, value) {
    if (preview) {
      if (method==='GET') return {mode:'DEMO',liveEnabled:false,previewLocal:true,available:true};
      const token=generation,controller=new AbortController();pending.add(controller);const timer=setTimeout(()=>controller.abort(),10000);
      try{if(Catalog){try{const response=await fetch('/assets/approved-products.json',{credentials:'omit',cache:'no-store',redirect:'error',signal:controller.signal});if(!response.ok||!/application\/json/i.test(response.headers.get('content-type')||''))throw Error('catalog');const text=await response.text();if(text.length>1000000)throw Error('catalog');const snapshot=JSON.parse(text);Catalog.validateSnapshot(snapshot);previewCatalog=snapshot;previewCatalogError=false;}catch{previewCatalogError=true;previewCatalog={version:1,generatedAt:null,products:[]};}}if(token!==generation)throw Error('session-changed');return catalogAnswer(value);}finally{clearTimeout(timer);pending.delete(controller);}
    }
    const token = generation, controller = new AbortController();
    pending.add(controller);
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch('api/stylist', {method,credentials:'same-origin',cache:'no-store',signal:controller.signal,
        headers:{Accept:'application/json','Accept-Language':I.language,...(value === undefined ? {} : {'Content-Type':'application/json'})},
        ...(value === undefined ? {} : {body:JSON.stringify(value)})});
      let result; try { result = await response.json(); } catch { result = {}; }
      if (token !== generation) throw new Error('session-changed');
      if (!response.ok) { const error = new Error('request-failed'); error.status = response.status; error.code = result.error; throw error; }
      return result;
    } finally { clearTimeout(timer); pending.delete(controller); }
  }
  function errorMessage(error) {
    if (preview) return preview.source('invalid');
    if (error.status === 401) return '회원가입·로그인 후 유효한 구독을 확인해주세요.';
    if (error.status === 403) return form.elements.intent.value === 'style' ? '스타일 상담에는 유효한 일반 또는 프리미엄 구독이 필요합니다.' : '가격 비교와 할인 추천에는 유효한 프리미엄 구독이 필요합니다.';
    if (error.code === 'external_ai_consent_required') return '실제 GPT 상담을 이용하려면 외부 AI 전송에 별도로 동의해주세요.';
    if (error.code === 'analysis_consent_required') return '체형 참고 수치를 사용하려면 별도 동의와 두 비율을 확인해주세요.';
    if (error.status === 429) return '상담 이용량 또는 비용 한도에 도달했습니다. 잠시 후 다시 시도해주세요.';
    if (error.status === 400 || error.status === 413) return '입력값·비율·동의 여부를 확인해주세요. 사진·파일·링크·비밀키는 전송할 수 없습니다.';
    if (error.status === 502 || error.status === 504) return 'AI 서비스가 응답하지 않거나 결과를 검증하지 못했습니다. 자동으로 재시도하거나 추가 호출하지 않습니다.';
    return '상담을 불러오지 못했습니다. 기존 무료 사진 분석은 계속 이용할 수 있습니다.';
  }
  function productCard(product) {
    if (!product || typeof product.name !== 'string' || !finitePrice(product.price) || !currencies.has(product.currency)) return null;
    const link = preview?catalogProductLink(product,t('확인된 상품 보기 →')):safeLink(product.productUrl, t('확인된 상품 보기 →')); if (!link) return null;
    const card = node('article', undefined, 'stylist-product'); card.dataset.i18nIgnore = '';
    card.append(node('h4', product.name), node('p', [product.brand,product.color,product.size,product.condition].filter(Boolean).join(' / ')), node('p', money(product.price, product.currency), 'stylist-price'));
    card.append(node('p', t('판매처: {name}',{name:product.retailerName||t('미확인')})), node('p', t('가격 확인: {time}',{time:time(product.checkedAt)}),'stylist-source'));
    if (product.source) card.append(node('p',t('가격 출처: {source}',{source:product.source}),'stylist-source'));
    if (product.sku || product.gtin) card.append(node('p', ['SKU '+(product.sku||'—'),'GTIN '+(product.gtin||'—')].join(' · '),'stylist-source'));
    if(preview&&Catalog){const img=node('img');img.src=product.imageUrl;img.alt=product.name;img.referrerPolicy='no-referrer';img.height=180;card.prepend(img);const reasons=node('ul');for(const reason of product.matchReasons||[]){const label={within_budget:'예산 범위',style_match:'스타일 일치',color_match:'색상 일치',occasion_match:'용도 일치',listed_size_match:'사이즈 표기 일치',collection_match:'컬렉션 일치',photo_ratio_reference:'사진상 비율 참고 규칙'}[reason];if(label)reasons.append(node('li',t(label)));}card.append(reasons);card.append(node('p',t('조건 일치 점수')+': '+product.matchScore+'/100'),node('p',t('판매자 등록 자료 기준이며 실시간 가격·배송·세금·착용감은 보장하지 않습니다.')));}
    if(preview){const disclosure=affiliateDisclosure(product);if(disclosure)card.append(disclosure);}card.append(link); return card;
  }
  function renderComparison(value) {
    const block = node('section', undefined, 'stylist-comparison');
    block.append(node('h4',t('같은 상품의 확인된 비용 비교')));
    if (!value || !Array.isArray(value.results)) { block.append(node('p',t('비교할 수 있는 검증 상품이 없습니다. 최저가 확인 불가'))); return block; }
    block.append(node('p',value.lowestOfferId ? t('확인된 비교 대상 중 최저 예상 비용: {price}',{price:money(value.minimumAmount,value.currency)}) : t('최저가 확인 불가')));
    for (const row of value.results.slice(0,12)) {
      const card = node('article',undefined,'stylist-product');
      card.append(node('h4',row.retailerName||t('미확인')),node('p',money(row.estimatedTotal,row.currency),'stylist-price'));
      card.append(node('p',t('배송비: {shipping} · 세금: {tax} · 관세: {duties}',{shipping:money(row.shipping,row.originalCurrency),tax:money(row.tax,row.originalCurrency),duties:money(row.duties,row.originalCurrency)})));
      card.append(node('p',t('가격 확인: {time}',{time:time(row.checkedAt)}),'stylist-source'));
      if (row.eligible !== true) card.append(node('p',t('미확인 비용·배송·재고 또는 오래된 자료로 최저가 선정에서 제외됩니다.')));
      const link = safeLink(row.productUrl,t('확인된 상품 보기 →')); if (link) card.append(link);
      block.append(card);
    }
    if (Array.isArray(value.similarOffers) && value.similarOffers.length) block.append(node('p',t('색상·사이즈·상태가 다른 유사 상품은 동일 상품 비교에서 제외했습니다.')));
    if (value.fx) block.append(node('p',t('환율 출처: {source} · 적용 시각: {time}',{source:value.fx.source||t('미확인'),time:time(value.fx.asOf)}),'stylist-source'));
    return block;
  }
  function renderAnswer(result, intent) {
    const bubble = node('article',undefined,'stylist-message'); bubble.dataset.i18nIgnore = '';
    bubble.append(node('h3','A1 AI STYLIST'), node('p',result.mode === 'LIVE' ? t('GPT · 검증된 데이터 기반') : t('DEMO · 실제 GPT 호출 없음'),'stylist-answer-mode'));
    if (typeof result.reply === 'string') bubble.append(node('p',result.reply));
    if (Array.isArray(result.advice)) { const list=node('ul'); for (const item of result.advice.slice(0,8)) if (typeof item?.text === 'string') list.append(node('li',item.text)); bubble.append(list); }
    const products = (Array.isArray(result.products)?result.products:[]).slice(0,12);
    if (products.length) for (const product of products) { const card = productCard(product); if (card) bubble.append(card); }
    else bubble.append(node('p',t('현재 조건에 맞는 검증 상품이 없습니다. 상품·가격·할인율을 생성하지 않습니다.')));
    if (Array.isArray(result.searchLinks) && result.searchLinks.length) {
      const links = node('div',undefined,'stylist-search-links'); links.append(node('p',t('판매처 검색 연결 · 개별 상품 연동이 아닙니다.')));
      if (preview) { for(const row of (result.catalogSearchRows||preview.retailers(Object.fromEntries(new FormData(form)),I.language).retailers)) links.append(preview.retailerActions(row)); }
      else for (const item of result.searchLinks.slice(0,12)) { const link=safeLink(item.url,item.label||item.store||t('판매처 검색 열기 →')); if(link) links.append(link); }
      bubble.append(links);
    }
    if(preview&&result.catalogRows?.length)bubble.append(catalogComparison(result.catalogRows,result.catalogComparisonOptions));else if (intent === 'compare' || result.comparison) bubble.append(renderComparison(result.comparison));
    if (Array.isArray(result.discounts) && result.discounts.length) {
      bubble.append(node('h4',t('확인된 기간 내 할인 정보')));
      for (const discount of result.discounts.slice(0,12)) {
        const row=node('p',t('확인된 할인 가격: {price} · 적용 기간: {start} ~ {end}',{price:money(discount.promotionPrice,discount.currency),start:time(discount.startsAt),end:time(discount.endsAt)}));bubble.append(row);
      }
    } else if (intent === 'discount') bubble.append(node('p',t('현재 확인된 할인 정보가 없습니다. 할인율을 만들어 표시하지 않습니다.')));
    if (Array.isArray(result.notices)) for (const notice of result.notices.slice(0,6)) if (typeof notice === 'string') bubble.append(node('p',notice,'stylist-source'));
    if (Number.isSafeInteger(result.usage?.remainingUserRequests) && result.usage.remainingUserRequests >= 0) bubble.append(node('p',t('오늘 남은 상담: {count}',{count:result.usage.remainingUserRequests}),'stylist-source'));
    chat.append(bubble); while (chat.children.length > 16) chat.firstElementChild.remove();if(preview)schedulePreviewCatalogRefresh();
    bubble.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  }
  form.addEventListener('submit',async event => {
    event.preventDefault(); if (busy) return;
    const message = $('#stylist-message').value.trim(); if (!message) return;
    const token = generation, externalAI = $('#stylist-external-consent').checked, analysis = $('#stylist-analysis-consent').checked;
    const values = Object.fromEntries(new FormData(form));
    const preferences = Object.fromEntries(['gender','style','category','currency','destination'].map(name=>[name,values[name]])); preferences.budget=Number(values.budget);
    const request = {message,language:I.language,preferences,intent:values.intent,history:conversations.slice(-4).map(item=>({...item,content:item.content.slice(0,1200)})),consents:{externalAI,analysis}};
    if (analysis) {
      const shoulderHipRatio=Number(values.shoulderHipRatio),legTorsoRatio=Number(values.legTorsoRatio);
      if (!values.shoulderHipRatio || !values.legTorsoRatio || !Number.isFinite(shoulderHipRatio) || !Number.isFinite(legTorsoRatio) || shoulderHipRatio<0.45 || shoulderHipRatio>2.5 || legTorsoRatio<0.6 || legTorsoRatio>3.5) { status('체형 참고 수치를 사용하려면 별도 동의와 두 비율을 확인해주세요.',true);return; }
      request.metrics={shoulderHipRatio,legTorsoRatio};
    }
    setBusy(true); status(configuration.freeBetaMode ? '무료 베타 이용 중' : '서버에서 구독·이용량과 검증 데이터를 확인하고 있습니다.');
    try {
      const result = await api('POST',request); if(token!==generation)return;
      protectResponse(result);
      $('#stylist-welcome')?.remove();
      const question=node('article',undefined,'stylist-message is-user');question.dataset.i18nIgnore='';question.append(node('h3',t('나의 질문')),node('p',message));chat.append(question);
      if (preview) previewAnswer={request,question:message};
      renderAnswer(result,request.intent); conversations.push({role:'user',content:message},{role:'assistant',content:typeof result.reply==='string'?result.reply.slice(0,1200):''});while(conversations.length>8)conversations.shift();
      $('#stylist-message').value='';status(result.mode==='LIVE'?'검증된 정보로 GPT 상담을 완료했습니다.':'모의 상담을 완료했습니다. 실제 GPT를 호출하지 않았습니다.');
    } catch(error) {
      if(token===generation){const source=errorMessage(error);if(error.status===401||error.status===403)clearConversation({resetProfile:false,clearMetrics:true});status(source,true);}
    } finally {if(token===generation)setBusy(false);}
  });
  $('#stylist-clear').addEventListener('click',()=>{clearConversation();status('대화를 지웠습니다. 진행 중인 요청과 체형 참고 수치도 제거했습니다.');});
  $('#stylist-analysis-consent').addEventListener('change',()=>{if(!$('#stylist-analysis-consent').checked){clearConversation();status('체형 수치 사용 동의를 철회했습니다. 대화와 진행 중인 요청을 지웠습니다.');}else ratioInputs();});
  $('#stylist-external-consent').addEventListener('change',()=>{if(!$('#stylist-external-consent').checked){clearConversation();status('외부 AI 전송 동의를 철회하고 대화를 지웠습니다. 이미 전송된 정보의 회수나 처리 취소는 보장할 수 없습니다.');}});
  window.addEventListener('storage',event=>{if(event.key==='a1-fashion:auth-event'){clearConversation({resetProfile:true});status('로그인 상태가 바뀌었습니다. 이전 대화를 지웠으며 구독을 다시 확인합니다.');}});
  document.addEventListener('a1:auth-changed',()=>{clearConversation({resetProfile:true});status('로그인 상태가 바뀌었습니다. 이전 대화를 지웠으며 구독을 다시 확인합니다.');});
  window.addEventListener('pagehide',()=>clearConversation({resetProfile:true}));
  window.addEventListener('focus', refreshPrivateContext);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshPrivateContext();});
  document.addEventListener('a1:language-changed',()=>{
    readiness();
    if (preview && previewAnswer) rerenderPreviewAnswer();
  });
  if(preview)chat.addEventListener('click',e=>{const a=e.target.closest('[data-stylist-catalog-buy]');if(a&&!Catalog.validateSnapshot(previewCatalog).some(p=>p.id===a.dataset.stylistCatalogBuy&&p.productUrl===a.href&&!p.commercial?.sponsored&&p.stock==='in_stock'&&e.isTrusted))e.preventDefault();});
  if (preview) preview.hydrateStylist();
  // A user-opened analysis page may transfer just two numbers over an exact-
  // origin, exact-opener, one-use nonce handshake. Consent remains unchecked.
  const nonce = new URLSearchParams(location.hash.slice(1)).get('analysis');
  if (nonce && /^[a-zA-Z0-9-]{16,80}$/.test(nonce) && window.opener) {
    history.replaceState(null,'',location.pathname+location.search);
    const opener=window.opener;let received=false;
    window.addEventListener('message',event=>{
      const value=event.data;
      if(event.origin!==location.origin||event.source!==opener||!value||value.nonce!==nonce)return;
      if(value.type==='a1:analysis-cleared'){received=true;clearConversation();status('원래 분석이 지워지거나 계정이 바뀌어 상담 수치와 대화를 제거했습니다.');return;}
      const metrics=value.metrics;
      if(received||value.type!=='a1:analysis-transfer'||!metrics||Object.keys(metrics).sort().join(',')!=='legTorsoRatio,shoulderHipRatio'||!Number.isFinite(metrics.shoulderHipRatio)||!Number.isFinite(metrics.legTorsoRatio)||metrics.shoulderHipRatio<0.45||metrics.shoulderHipRatio>2.5||metrics.legTorsoRatio<0.6||metrics.legTorsoRatio>3.5)return;
      received=true;form.elements.shoulderHipRatio.value=String(metrics.shoulderHipRatio);form.elements.legTorsoRatio.value=String(metrics.legTorsoRatio);$('#stylist-analysis-consent').checked=false;ratioInputs();$('#stylist-analysis-imported').hidden=false;tx('#stylist-analysis-imported','무료 분석에서 두 비율을 가져왔습니다. 상담에 사용하려면 아래에서 별도로 동의해주세요.');
    });
    opener.postMessage({type:'a1:request-analysis',nonce},location.origin);
  }
  api('GET').then(result=>{configuration=result;readiness();}).catch(()=>{configuration={mode:'UNAVAILABLE',liveEnabled:false};readiness();});
})();
