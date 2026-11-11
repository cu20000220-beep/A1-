/* Shared public navigation. Only the existing language preference is persisted. */
'use strict';
(() => {
  const I = window.A1I18n;
  if (!I) return;
  I.register({
    '주요 서비스': 'Main services',
    '홈': 'HOME',
    '옷 찾기': 'FIND CLOTHES',
    '무료 스타일 상담':'FREE STYLE ADVICE',
    '무료 베타: 사진 분석·규칙 기반 상담·공식 쇼핑몰 검색을 기기 안에서 이용합니다.':'Free beta: on-device photo analysis, rule-based advice and official retailer searches.',
    '실제 상품·가격·사이즈 자료는 공급원 승인 전까지 제공하지 않습니다. 결제·유료 GPT·발송은 비활성입니다.':'Real product, price and size data require source approval. Payments, paid GPT and delivery services are disabled.',
    '미리보기: 회원·DB·서버 API는 격리돼 있으며 검색·규칙 상담은 브라우저 안에서 작동합니다.':'Preview: accounts, databases and server APIs are isolated; searches and rule-based advice run in your browser.',
    'AI 스타일 스튜디오': 'AI STYLE STUDIO',
    '글로벌 쇼핑': 'GLOBAL SHOPPING',
    'AI 스타일리스트': 'AI STYLIST',
    '가격 비교': 'PRICE COMPARISON',
    '멤버십': 'MEMBERSHIP',
    '내 계정': 'MY ACCOUNT',
    'A1 AI 스타일 상담 · 현재 모의 운영': 'A1 AI style consultation · currently simulated',
    'AI 가격 비교 상담 · 현재 모의 운영': 'AI price comparison consultation · currently simulated',
    '미리보기: 회원가입·로그인·구독·AI 상담은 연결하지 않았습니다. 화면과 무료 사진 분석을 확인하세요.': 'Preview: registration, sign-in, subscriptions and AI consultation are disconnected. You can explore the pages and free photo analysis.',
    'A1 FASHION · 무료 베타': 'A1 FASHION · FREE BETA',
    '무료 베타에서는 사진 분석·회원가입·로그인과 기본 쇼핑몰 링크를 제공합니다.': 'The free beta includes photo analysis, registration, sign-in and basic retailer links.',
    '개인화 추천과 GENERAL/PREMIUM 가입은 준비 중입니다. 실제 결제·유료 GPT 호출·자동 가격 수집·이메일/SMS 프로모션 알림은 비활성입니다.': 'Personalized recommendations and GENERAL/PREMIUM enrollment are coming soon. Payments, paid GPT calls, automatic price collection and promotional email/SMS alerts are disabled.'
  });
  const links = [
    ['home', '홈', 'index.html'],
    ['clothes', '옷 찾기', 'index.html#shopping-search'],
    ['studio', 'AI 스타일 스튜디오', 'index.html#ai-studio'],
    ['shopping', '글로벌 쇼핑', 'global.html#shopping'],
    ['stylist', 'AI 스타일리스트', 'stylist.html'],
    ['comparison', '가격 비교', 'global.html#comparison'],
    ['membership', '멤버십', 'global.html#membership'],
    ['account', '내 계정', 'account.html']
  ];
  const update = () => {
    for (const link of document.querySelectorAll('[data-site-navigation] a')) {
      const target = new URL(link.href), here = new URL(location.href);
      const samePage = target.pathname === here.pathname || (target.pathname.endsWith('/index.html') && here.pathname.endsWith('/'));
      const current = samePage && (target.hash ? target.hash === here.hash : !here.hash);
      if (current) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
  };
  for (const mount of document.querySelectorAll('[data-site-navigation]')) {
    if (mount.childElementCount) continue;
    for (const [name, label, href] of links) {
      const link = document.createElement('a'); link.href = href; link.dataset.siteLink = name;
      I.setText(link,window.A1Preview&&name==='stylist'?'무료 스타일 상담':label); mount.append(link);
      link.addEventListener('click', event => {
        const target = new URL(link.href);
        if (target.pathname !== location.pathname || !target.pathname.endsWith('/global.html') || !target.hash) return;
        const button = document.querySelector(`[data-tab="${target.hash.slice(1)}"]`);
        if (button) { event.preventDefault(); button.click(); update(); }
      });
    }
  }
  const navigation = document.querySelector('[data-site-navigation]');
  if (navigation && !document.querySelector('[data-beta-notice]')) {
    const notice = document.createElement('section');
    notice.className = 'beta-notice'; notice.dataset.betaNotice = '';
    const title = document.createElement('p'); title.className = 'beta-notice-title';
    I.setText(title, 'A1 FASHION · 무료 베타');
    const available = document.createElement('p');
    I.setText(available,window.A1Preview?'무료 베타: 사진 분석·규칙 기반 상담·공식 쇼핑몰 검색을 기기 안에서 이용합니다.':'무료 베타에서는 사진 분석·회원가입·로그인과 기본 쇼핑몰 링크를 제공합니다.');
    const planned = document.createElement('p');
    I.setText(planned,window.A1Preview?'실제 상품·가격·사이즈 자료는 공급원 승인 전까지 제공하지 않습니다. 결제·유료 GPT·발송은 비활성입니다.':'개인화 추천과 GENERAL/PREMIUM 가입은 준비 중입니다. 실제 결제·유료 GPT 호출·자동 가격 수집·이메일/SMS 프로모션 알림은 비활성입니다.');
    notice.append(title, available, planned);
    navigation.insertAdjacentElement('afterend', notice);
  }
  if (location.hostname.toLowerCase().replace(/\.$/, '').endsWith('.a1fashion.pages.dev')) {
    const mount = document.querySelector('[data-site-navigation]');
    if (mount && !document.querySelector('[data-preview-notice]')) {
      const notice = document.createElement('p');
      notice.className = 'preview-notice'; notice.dataset.previewNotice = '';
      I.setText(notice,'미리보기: 회원·DB·서버 API는 격리돼 있으며 검색·규칙 상담은 브라우저 안에서 작동합니다.');
      mount.insertAdjacentElement('afterend', notice);
    }
  }
  window.addEventListener('hashchange', update);
  update(); I.refresh();
})();
