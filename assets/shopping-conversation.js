/* Local clothing conversation. Only parsed conditions are handed to the catalog. */
'use strict';
((root, factory) => {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./shopping-query.js'), root);
  } else {
    root.A1ShoppingConversation = factory(root.A1ShoppingQuery, root);
  }
})(globalThis, (query, root) => {
  const defaults = query.parse('의류');
  const recommendation = /^(?:(?:제|내|나의)\s*)?(?:체형(?:에\s*(?:맞는|어울리는)|별(?:로)?)?\s*)?(?:(?:옷|의류|코디|스타일|상품)(?:을|를)?\s*)?(?:추천(?:해)?|골라|보여)\s*(?:주세요|줘(?:요)?)?[.!?\s]*$|^(?:(?:find|show|recommend|suggest)(?: me)? (?:clothes|clothing|an outfit)(?: for (?:me|my body))?|what (?:fits|suits) (?:me|my body))[.!?\s]*$/i;
  const explanation = /^(?:왜\s*(?:추천(?:했어|했어요|하나요)?|잘\s*맞(?:아|아요|나요)?)?|추천\s*이유(?:를)?\s*(?:알려\s*(?:줘(?:요)?|주세요))?|why(?: (?:this|these|do you recommend (?:this|these|it)))?)[.!?\s]*$/i;
  const comparison = /^(?:(?:추천\s*(?:상품|후보)(?:을|를)?|이\s*상품들(?:을)?|(?:상위\s*)?(?:두|2)\s*(?:상품|개)(?:를)?)\s*)?비교(?:해)?\s*(?:주세요|줘(?:요)?)?[.!?\s]*$|^compare(?: (?:these(?: products)?|both(?: products)?|the (?:top two|two) (?:products|options|picks)))?[.!?\s]*$/i;
  const reset = /^(?:처음부터(?:\s*다시)?|조건\s*초기화|start over|reset filters)[.!?\s]*$/i;
  const unsupportedColor = /빨간|빨강|분홍|핑크|초록|녹색|노랑|보라|주황|갈색|파랑|하늘색|\b(?:red|pink|green|yellow|purple|orange|brown|blue)\b/i;
  const substitutions = [
    ['color', /^(?:색(?:상|깔)?(?:은|는)?\s*(?:상관없(?:어|어요)?|아무거나)|any color|no color preference)[.!?\s]*$/i],
    ['fit', /^(?:핏(?:은)?\s*(?:상관없(?:어|어요)?|아무거나)|any fit|no fit preference)[.!?\s]*$/i],
    ['season', /^(?:계절(?:은)?\s*(?:상관없(?:어|어요)?|아무거나)|any season|no season preference)[.!?\s]*$/i],
    ['budget', /^(?:예산(?:은)?\s*(?:상관없(?:어|어요)?|제한\s*없(?:어|어요)?)|any budget|no budget limit)[.!?\s]*$/i]
  ];

  function parseClothing(text) {
    const normalized = text.replace(/₩\s*([\d,]+)|([\d,]+)\s*(?:KRW|won)\b/gi, (_, prefix, suffix) => (prefix || suffix) + '원');
    if (/\b(?:over|at least|more than)\s+[\d,]+원|[\d,]+원\s+(?:or more|and up)\b|[$€£]|\b(?:USD|EUR|GBP)\b/i.test(normalized)) {
      throw new TypeError('unsupported_budget');
    }
    return query.parse(normalized.replace(/\b(?:under|less than)\s+([\d,]+)원/gi, '$1원 미만'));
  }

  function refine(message, previous) {
    if (typeof message !== 'string' || message.length > 300) throw new TypeError('invalid_query');
    const text = message.trim().normalize('NFKC');
    const replace = text.split(/\s*(?:말고|대신)\s*|\s+(?:instead of|rather than)\s+/i);
    let parsed;
    try {
      parsed = parseClothing(text);
    } catch (error) {
      if (!['unsupported_exclusion', 'unsupported_season'].includes(error.message) || replace.length !== 2 || !replace.every(Boolean)) throw error;
    }
    if (reset.test(text)) return { ...defaults, size: '' };
    const next = { ...defaults, ...previous };
    for (const [key, pattern] of substitutions) {
      if (pattern.test(text)) return { ...next, [key]: defaults[key] };
    }
    let request = text;
    if (replace.length === 2 && replace.every(Boolean)) {
      // Korean places the requested alternative last. English places it
      // before “instead of” or “rather than.”
      request = /말고|대신/.test(text) ? replace[1] : replace[0];
      parsed = parseClothing(request);
    }
    if (unsupportedColor.test(request) && parsed.color === 'any') throw new TypeError('unsupported_color');
    const changed = Object.keys(defaults).filter(key => parsed[key] !== defaults[key]);
    if (/공용|유니섹스|\bunisex\b/i.test(request) && !changed.includes('gender')) changed.push('gender');
    if (!changed.length && !recommendation.test(text) && !explanation.test(text) && !comparison.test(text)) throw new TypeError('unknown_clothing_request');
    for (const key of changed) next[key] = parsed[key];
    if (changed.includes('budget') && next.currency !== 'KRW') throw new TypeError('budget_currency');
    if (changed.includes('category') && !changed.includes('type')) next.type = 'clothing';
    return next;
  }

  function create(target, { prefix = 'shopping', getConditions, getProfile, search, resultId = 'shopping-discovery' } = {}) {
    const i18n = root.A1I18n;
    if (!target || !i18n || typeof search !== 'function') return null;
    const { document } = root;
    const translations = {
      'A1 스타일 상담': 'A1 style chat',
      '옷을 찾거나 “추천 상품 비교해줘”라고 요청해 보세요. 이 기기에서 규칙으로 답변합니다.': 'Find clothes or ask to “compare these.” Replies use rules on this device.',
      '스타일 질문': 'Style question',
      '예: 출근용 셔츠 8만원 이하, 흰색으로': 'e.g. office shirts up to ₩80,000, then “make it white”',
      '답변 받기': 'Get a reply',
      '대화 지우기': 'Clear conversation',
      '적용한 조건 {terms}': 'Using {terms}',
      '{amount}원 이하': 'up to ₩{amount}',
      '판매처에서 확인한 상품을 비교하고 있습니다.': 'Checking clothes against verified retailer listings.',
      '조건에 맞는 추천 후보 {count}개를 찾았습니다.': 'Found {count} clothing options for these conditions.',
      '판매 여부 미확인 · 공식 상품 페이지 {count}개를 참고할 수 있습니다.': 'Availability unconfirmed · {count} official product pages are available for reference.',
      '가격 확인이 필요한 후보가 {count}개 있습니다.': '{count} options still need a price check.',
      '현재 확인된 상품 중 이 조건과 맞는 후보가 없습니다. 색상이나 핏을 바꾸거나 다른 종류를 요청해 보세요.': 'The verified listings have no matches for these conditions. Try a different color, fit, or clothing type.',
      '상품 자료를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.': 'The retailer listings are unavailable. Please try again.',
      '상품 자료는 원화 기준입니다. 원화로 다시 검색해 주세요.': 'The listings use Korean won. Please search in Korean won.',
      '상품 카드에서 체형 비율을 참고한 이유를 확인할 수 있습니다.': 'Check the product cards for any recommendation reasons based on your proportions.',
      '체형에 맞춰 정렬하려면 사진 분석 또는 직접 입력 후 체형 비율 사용을 선택해 주세요.': 'To rank by body proportions, analyze a photo or enter your measurements and allow their use.',
      '추천 후보 보기': 'See the matches',
      '판매 확인 상품의 판매처 정보 비교': 'Compare verified retailer listings',
      '판매 미확인 상품의 확인 당시 정보 비교': 'Compare historical listings with unconfirmed availability',
      '비교할 후보가 두 개 미만입니다. 조건을 바꿔 다시 찾아보세요.': 'Fewer than two options are available to compare. Try different filters.',
      '통화가 달라 가격 순위를 매기지 않습니다.': 'The listings use different currencies, so prices are not ranked.',
      '판매처': 'Retailer',
      '표시 가격': 'Listed price',
      '확인한 날짜': 'Date checked',
      '판매처 표시 핏': 'Listed fit',
      '소재': 'Material',
      '옷 종류, 색상, 핏, 계절, 용도 또는 예산을 말해 주세요. 예를 들어 “검정 슬랙스” 또는 “여름용으로”라고 물을 수 있습니다.': 'Ask about a clothing type, color, fit, season, occasion, or budget. For example, “black slacks” or “make it summer clothes.”',
      '연락처, 이메일, 사진, 링크 대신 의류 조건만 입력해 주세요.': 'Enter clothing preferences and omit contacts, email addresses, photos, and links.',
      '예산은 “5만원 이하”처럼 상한 금액 하나로 입력해 주세요.': 'Enter one upper budget, such as “50,000원 이하.”',
      '원화 예산을 적용하려면 통화를 KRW로 선택해 주세요.': 'Select KRW to apply a budget in Korean won.',
      '찾는 계절을 한 가지 말해 주세요.': 'Choose one season for your search.',
      '현재 색상 조건은 검정, 네이비, 흰색, 베이지, 회색을 지원합니다. 이 중 하나를 골라 주세요.': 'Available color filters are black, navy, white, beige, and gray. Choose one of these colors.',
      '원하는 조건을 직접 알려 주세요. 예를 들어 “검정 말고 네이비”는 네이비로 바꿉니다.': 'State the desired option directly. For example, “navy instead of black” changes the color to navy.'
    };
    i18n.register(translations);
    const element = (tag, source, values) => {
      const node = document.createElement(tag);
      if (source) i18n.setText(node, source, values);
      return node;
    };
    const id = suffix => `${prefix}-conversation-${suffix}`;
    const heading = element('h3', 'A1 스타일 상담');
    heading.id = id('title');
    target.classList.add('shopping-conversation');
    target.setAttribute('aria-labelledby', heading.id);
    const description = element('p', '옷을 찾거나 “추천 상품 비교해줘”라고 요청해 보세요. 이 기기에서 규칙으로 답변합니다.');
    const replies = element('div');
    replies.id = id('replies');
    replies.setAttribute('role', 'log');
    replies.setAttribute('aria-live', 'polite');
    const form = element('form');
    form.className = 'shopping-conversation-form';
    const label = element('label', '스타일 질문');
    const input = element('input');
    input.id = id('input');
    input.type = 'text';
    input.required = true;
    input.maxLength = 300;
    input.autocomplete = 'off';
    input.placeholder = '예: 출근용 셔츠 8만원 이하, 흰색으로';
    label.htmlFor = input.id;
    const send = element('button', '답변 받기');
    send.id = id('send');
    send.type = 'submit';
    const erase = element('button', '대화 지우기');
    erase.id = id('clear');
    erase.type = 'button';
    erase.hidden = true;
    form.append(label, input, send, erase);
    target.append(heading, description, replies, form);

    let revision = 0;
    function reply() {
      const panel = element('article');
      panel.className = 'shopping-conversation-reply';
      replies.append(panel);
      while (replies.children.length > 6) replies.firstElementChild.remove();
      erase.hidden = false;
      return panel;
    }
    function clear() {
      revision++;
      input.value = '';
      replies.replaceChildren();
      erase.hidden = true;
    }
    function appendComparison(panel, products, available) {
      const choices = products.filter(product => product.available === available).slice(0, 2);
      if (choices.length < 2) {
        panel.append(element('p', '비교할 후보가 두 개 미만입니다. 조건을 바꿔 다시 찾아보세요.'));
        return;
      }
      const comparisonList = element('section');
      comparisonList.dataset.conversationComparison = available ? 'current' : 'historical';
      const heading = element('h4', available ? '판매 확인 상품의 판매처 정보 비교' : '판매 미확인 상품의 확인 당시 정보 비교');
      const grid = element('div');
      grid.className = 'product-discovery-grid';
      for (const product of choices) {
        const entry = element('article');
        entry.className = 'product-discovery-card';
        const name = element('h5'), facts = element('dl');
        name.textContent = product.name;
        const addFact = (label, value) => {
          const description = element('dd');
          description.textContent = value;
          facts.append(element('dt', label), description);
        };
        addFact('판매처', product.retailerName);
        addFact('표시 가격', Number.isFinite(product.price) ? product.price.toLocaleString(i18n.locale) + ' ' + product.currency : i18n.t('가격 미확인'));
        if (product.checkedAt) addFact('확인한 날짜', new Date(product.checkedAt).toLocaleDateString(i18n.locale));
        if (product.fit) addFact('판매처 표시 핏', i18n.t(product.fit));
        if (product.material) addFact('소재', product.material);
        entry.append(name, facts);
        for (const reason of product.proportionReasons || []) {
          const text = root.A1ProductDiscoveryView?.proportionText(reason, { evidence: true });
          if (!text) continue;
          const detail = element('p');
          detail.textContent = text;
          entry.append(detail);
        }
        grid.append(entry);
      }
      comparisonList.append(heading, grid);
      const currencies = new Set(choices.filter(product => Number.isFinite(product.price)).map(product => product.currency));
      if (currencies.size > 1) comparisonList.append(element('p', '통화가 달라 가격 순위를 매기지 않습니다.'));
      panel.append(comparisonList);
    }
    async function ask(message) {
      const token = ++revision;
      const panel = reply();
      let conditions;
      try {
        conditions = refine(message, getConditions?.());
      } catch (error) {
        const errors = {
          private_query: '연락처, 이메일, 사진, 링크 대신 의류 조건만 입력해 주세요.',
          unsupported_budget: '예산은 “5만원 이하”처럼 상한 금액 하나로 입력해 주세요.',
          invalid_budget: '예산은 “5만원 이하”처럼 상한 금액 하나로 입력해 주세요.',
          budget_currency: '원화 예산을 적용하려면 통화를 KRW로 선택해 주세요.',
          unsupported_season: '찾는 계절을 한 가지 말해 주세요.',
          unsupported_color: '현재 색상 조건은 검정, 네이비, 흰색, 베이지, 회색을 지원합니다. 이 중 하나를 골라 주세요.',
          unsupported_exclusion: '원하는 조건을 직접 알려 주세요. 예를 들어 “검정 말고 네이비”는 네이비로 바꿉니다.'
        };
        panel.append(element('p', errors[error.message] || '옷 종류, 색상, 핏, 계절, 용도 또는 예산을 말해 주세요. 예를 들어 “검정 슬랙스” 또는 “여름용으로”라고 물을 수 있습니다.'));
        return false;
      }
      const phrase = query.term(conditions, i18n.language);
      const budget = conditions.budget === null ? '' : i18n.t('{amount}원 이하', { amount: conditions.budget.toLocaleString(i18n.locale) });
      const pending = element('p', '판매처에서 확인한 상품을 비교하고 있습니다.');
      panel.append(element('p', '적용한 조건 {terms}', { terms: [phrase, budget].filter(Boolean).join(' · ') }), pending);
      const hasProfile = Boolean(Object.keys(getProfile?.() || {}).length);
      const wantsBody = /체형|proportions?|my body|my figure/i.test(message);
      let result;
      try {
        result = await search(conditions);
      } catch {
        result = null;
      }
      if (revision !== token) { pending.remove(); return false; }
      if (result?.state === 'unsupported') {
        i18n.setText(pending, '상품 자료는 원화 기준입니다. 원화로 다시 검색해 주세요.');
        return false;
      }
      if (result?.state !== 'ready') {
        i18n.setText(pending, '상품 자료를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.');
        return false;
      }
      const count = result.count || 0, unconfirmed = result.unconfirmed || 0, references = result.referenceCount || 0;
      if (count) i18n.setText(pending, '조건에 맞는 추천 후보 {count}개를 찾았습니다.', { count });
      else if (references) i18n.setText(pending, '판매 여부 미확인 · 공식 상품 페이지 {count}개를 참고할 수 있습니다.', { count: references });
      else if (unconfirmed) pending.remove();
      else i18n.setText(pending, '현재 확인된 상품 중 이 조건과 맞는 후보가 없습니다. 색상이나 핏을 바꾸거나 다른 종류를 요청해 보세요.');
      if (unconfirmed) panel.append(element('p', '가격 확인이 필요한 후보가 {count}개 있습니다.', { count: unconfirmed }));
      if (hasProfile && (count || unconfirmed || references)) panel.append(element('p', '상품 카드에서 체형 비율을 참고한 이유를 확인할 수 있습니다.'));
      else if (!hasProfile && wantsBody) panel.append(element('p', '체형에 맞춰 정렬하려면 사진 분석 또는 직접 입력 후 체형 비율 사용을 선택해 주세요.'));
      const products = Array.isArray(result.products) ? result.products : [];
      const topChoice = products[0];
      if ((count || references) && comparison.test(message.trim().normalize('NFKC'))) appendComparison(panel, products, count > 0);
      else if ((count || references) && typeof topChoice?.name === 'string') {
        const name = element('strong');
        name.textContent = topChoice.name;
        const reasons = Array.isArray(topChoice.proportionReasons) ? topChoice.proportionReasons : [];
        const evidence = reasons.map(reason => root.A1ProductDiscoveryView?.proportionText(reason, { evidence: true })).filter(Boolean);
        panel.append(name);
        for (const explanation of evidence) {
          const detail = element('p');
          detail.textContent = explanation;
          panel.append(detail);
        }
      }
      if (count || unconfirmed || references) {
        const targetId = typeof resultId === 'function' ? resultId(result) : resultId;
        const link = element('a', '추천 후보 보기');
        link.href = '#' + targetId;
        panel.append(link);
      }
      return true;
    }
    form.addEventListener('submit', event => {
      event.preventDefault();
      const message = input.value;
      input.value = '';
      void ask(message);
    });
    erase.addEventListener('click', clear);
    document.addEventListener('a1:analysis-cleared', clear);
    document.addEventListener('a1:analysis-revoked', clear);
    document.addEventListener('a1:auth-changed', clear);
    root.addEventListener('pagehide', clear);
    root.addEventListener('storage', event => { if (event.key === 'a1-fashion:auth-event') clear(); });
    return Object.freeze({ ask, clear });
  }

  return Object.freeze({ create, refine });
});
