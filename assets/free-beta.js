/* Presentation follows the server policy. This script never grants API access. */
'use strict';
(() => {
  const I = window.A1I18n;
  I.register({ '찜을 저장하려면 무료 회원으로 로그인해주세요.': 'Sign in for free to save favorites.', '무료 베타 이용 중': 'Free beta active', '검증된 상품·가격·할인 정보는 준비 중입니다.': 'Verified products, prices and discounts are being prepared.' });
  const copies = {
    style: ['무료 베타 스타일 예시', 'FREE BETA / STYLE EXAMPLES'],
    search: ['무료 베타 맞춤 검색', 'Free beta personalized searches'],
    analysis: ['사진 속 비율을 기기 안에서 무료로 분석하고, 원하는 경우 무료 베타 스타일 예시와 검색으로 이어가세요.', 'Analyze photo proportions on your device for free, then explore free beta style examples and searches.'],
    beta: ['무료 베타 이용 중', 'Free beta active'],
    scope: ['무료 베타 동안 분석·스타일 추천·DEMO 상담·쇼핑 검색을 구독료 없이 이용합니다. 찜과 계정 저장은 무료 로그인이 필요합니다.', 'During the free beta, analysis, style examples, DEMO advice and retailer searches have no subscription fee. Sign in for free to save favorites and account settings.'],
    billing: ['현재 결제·자동 청구는 없습니다. 실제 GPT·상품 수집·이메일/SMS 발송은 비활성입니다. 검증된 상품·가격·할인 정보는 준비 중입니다.', 'No payments or automatic charges. Live GPT, product feeds and email/SMS delivery are disabled. Verified products, prices and discounts are being prepared.'],
    available: ['구독료 없이 기능을 체험하세요.', 'Explore the features without a subscription fee.'],
    saving: ['계정에 저장하려면 무료 회원으로 로그인해주세요. 기존 구독 기록은 변경하지 않습니다.', 'Sign in for free to save to your account. Existing subscription records are unchanged.'],
    compare: ['가격 비교 · 검증 자료 준비 중', 'Price comparison · verified data being prepared'],
    comparisonNote: ['검증된 실제 상품·가격·할인 정보는 준비 중입니다. 실제 최저가나 할인율을 만들어 표시하지 않습니다.', 'Verified products, prices and discounts are being prepared. No real lowest prices or discounts are invented.']
  };
  for (const pair of Object.values(copies)) I.register({ [pair[0]]: pair[1] });
  function set(selector, key) {
    document.querySelectorAll(selector).forEach(el => I.setText(el, copies[key][0]));
  }
  function apply() {
    set('#premium>.section-heading .eyebrow', 'style');
    set('#ai-shopping .small-note,.global-results-heading', 'search');
    set('.ai-intro', 'analysis');
    set('.global-results-heading+.global-note', 'scope');
    set('[data-panel=watchlist]>.global-note', 'saving');
    set('[data-panel=comparison] .eyebrow,[data-panel=alerts]>.eyebrow', 'beta');
    set('#stylist-status', 'beta');
    const external = document.querySelector('#stylist-external-consent');
    if (external) { external.checked = false; external.disabled = true; }
    document.querySelectorAll('#preferences-form [name=emailEnabled],#preferences-form [name=smsEnabled],#preferences-form [name=phone]').forEach(el => { el.disabled = true; });
    set('[data-beta-notice] .beta-notice-title,.membership-pending,.global-plans button,.plan-pending,.plan-price,.global-plans article>p,#premium-badge', 'beta');
    set('[data-beta-notice] p:nth-child(2),.membership-intro', 'scope');
    set('[data-beta-notice] p:nth-child(3),.membership-scope,#stylist-form>p.stylist-note:not([id])', 'billing');
    set('#membership-title,.intro p,.premium-lock h3', 'available');
    set('.membership-plan .plan-note,.global-plans+.global-note,.account-member-info p', 'saving');
    set('.account-member-info strong', 'beta');
    set('.membership-plan .plan-price,.membership-plan .plan-pending', 'beta');
    set('#premium-results .catalog-note:last-child', 'comparisonNote');
    set('[data-panel="comparison"] .global-pill,[data-panel="comparison"] .global-note', 'comparisonNote');
    set('#comparison-form [name="productId"] option[value="demo-tee"]', 'compare');
    const intents = document.querySelectorAll('#stylist-form [name="intent"] option');
    const labels = [['스타일 DEMO 상담', 'Style DEMO advice'], ['가격 비교 · 자료 준비 중', 'Price comparison · data being prepared'], ['할인 정보 · 자료 준비 중', 'Discounts · data being prepared']];
    intents.forEach((el, i) => { I.register({ [labels[i][0]]: labels[i][1] }); I.setText(el, labels[i][0]); });
    // Option values stay canonical; only their visible labels change.
    I.refresh();
  }
  fetch('api/policy', { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } })
    .then(async response => { if (!response.ok) return; const policy = await response.json();
      if (policy.freeBetaMode === true) apply();
      document.dispatchEvent(new CustomEvent('a1:policy-ready', { detail: { freeBetaMode: policy.freeBetaMode === true } }));
    }).catch(() => { /* Fail closed: retain the normal subscription presentation. */ });
})();
