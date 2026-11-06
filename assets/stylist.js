'use strict';
(() => {
  const $ = selector => document.querySelector(selector);
  const I = window.A1I18n;
  const t = (source, values) => I.t(source, values);
  const tx = (element, source, values) => I.setText(typeof element === 'string' ? $(element) : element, source, values);
  const form = $('#stylist-form'), chat = $('#stylist-chat');
  const merchants = new Set(['www.coupang.com','search.shopping.naver.com','www.ebay.com','www.ebay.co.uk','www.ebay.de','www.amazon.com','www.amazon.co.jp','www.amazon.co.uk','www.amazon.de','search.rakuten.co.jp','www.zalando.de']);
  const currencies = new Set(['KRW','USD','EUR','GBP','JPY']);
  const conversations = [], pending = new Set();
  let generation = 0, busy = false, configuration = { mode: 'DEMO', liveEnabled: false };
  const node = (tag, text, className) => { const element = document.createElement(tag); if (text !== undefined) element.textContent = text; if (className) element.className = className; return element; };
  const finitePrice = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  const money = (value, currency) => finitePrice(value) && currencies.has(currency) ? new Intl.NumberFormat(I.locale, {style:'currency',currency,currencyDisplay:'code',maximumFractionDigits:['KRW','JPY'].includes(currency)?0:2}).format(value) : t('미확인');
  const time = value => Number.isSafeInteger(value) && value > 0 ? new Intl.DateTimeFormat(I.locale,{dateStyle:'medium',timeStyle:'short'}).format(value) : t('미확인');
  function safeLink(value, label) {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password || url.port || !merchants.has(url.hostname)) return null;
      const link = node('a', label); link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; return link;
    } catch { return null; }
  }
  function status(source, error = false, values) { tx('#stylist-status', source, values); $('#stylist-status').classList.toggle('is-error', error); }
  function setBusy(value) { busy = value; $('#stylist-send').disabled = value; form.setAttribute('aria-busy', String(value)); }
  function ratioInputs() { for (const name of ['shoulderHipRatio','legTorsoRatio']) form.elements[name].disabled = !$('#stylist-analysis-consent').checked; }
  function readiness() {
    tx('#stylist-config', configuration.liveEnabled === true && configuration.mode === 'LIVE'
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
    generation++;
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
  async function api(method, value) {
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
    const link = safeLink(product.productUrl, t('확인된 상품 보기 →')); if (!link) return null;
    const card = node('article', undefined, 'stylist-product'); card.dataset.i18nIgnore = '';
    card.append(node('h4', product.name), node('p', [product.brand,product.color,product.size,product.condition].filter(Boolean).join(' / ')), node('p', money(product.price, product.currency), 'stylist-price'));
    card.append(node('p', t('판매처: {name}',{name:product.retailerName||t('미확인')})), node('p', t('가격 확인: {time}',{time:time(product.checkedAt)}),'stylist-source'));
    if (product.source) card.append(node('p',t('가격 출처: {source}',{source:product.source}),'stylist-source'));
    if (product.sku || product.gtin) card.append(node('p', ['SKU '+(product.sku||'—'),'GTIN '+(product.gtin||'—')].join(' · '),'stylist-source'));
    card.append(link); return card;
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
      for (const item of result.searchLinks.slice(0,12)) { const link=safeLink(item.url,item.label||item.store||t('판매처 검색 열기 →')); if(link) links.append(link); }
      bubble.append(links);
    }
    if (intent === 'compare' || result.comparison) bubble.append(renderComparison(result.comparison));
    if (Array.isArray(result.discounts) && result.discounts.length) {
      bubble.append(node('h4',t('확인된 기간 내 할인 정보')));
      for (const discount of result.discounts.slice(0,12)) {
        const row=node('p',t('확인된 할인 가격: {price} · 적용 기간: {start} ~ {end}',{price:money(discount.promotionPrice,discount.currency),start:time(discount.startsAt),end:time(discount.endsAt)}));bubble.append(row);
      }
    } else if (intent === 'discount') bubble.append(node('p',t('현재 확인된 할인 정보가 없습니다. 할인율을 만들어 표시하지 않습니다.')));
    if (Array.isArray(result.notices)) for (const notice of result.notices.slice(0,6)) if (typeof notice === 'string') bubble.append(node('p',notice,'stylist-source'));
    if (Number.isSafeInteger(result.usage?.remainingUserRequests) && result.usage.remainingUserRequests >= 0) bubble.append(node('p',t('오늘 남은 상담: {count}',{count:result.usage.remainingUserRequests}),'stylist-source'));
    chat.append(bubble); while (chat.children.length > 16) chat.firstElementChild.remove();
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
    setBusy(true); status('서버에서 구독·이용량과 검증 데이터를 확인하고 있습니다.');
    try {
      const result = await api('POST',request); if(token!==generation)return;
      $('#stylist-welcome')?.remove();
      const question=node('article',undefined,'stylist-message is-user');question.dataset.i18nIgnore='';question.append(node('h3',t('나의 질문')),node('p',message));chat.append(question);
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
  document.addEventListener('a1:language-changed',readiness);
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
