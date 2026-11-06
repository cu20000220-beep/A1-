/* Shared public navigation. Only the existing language preference is persisted. */
'use strict';
(() => {
  const I = window.A1I18n;
  if (!I) return;
  I.register({
    '주요 서비스': 'Main services',
    '홈': 'HOME',
    'AI 스타일 스튜디오': 'AI STYLE STUDIO',
    '글로벌 쇼핑': 'GLOBAL SHOPPING',
    'AI 스타일리스트': 'AI STYLIST',
    '가격 비교': 'PRICE COMPARISON',
    '멤버십': 'MEMBERSHIP',
    '내 계정': 'MY ACCOUNT',
    'A1 AI 스타일 상담 · 현재 모의 운영': 'A1 AI style consultation · currently simulated',
    'AI 가격 비교 상담 · 현재 모의 운영': 'AI price comparison consultation · currently simulated'
  });
  const links = [
    ['home', '홈', 'index.html'],
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
      I.setText(link, label); mount.append(link);
      link.addEventListener('click', event => {
        const target = new URL(link.href);
        if (target.pathname !== location.pathname || !target.pathname.endsWith('/global.html') || !target.hash) return;
        const button = document.querySelector(`[data-tab="${target.hash.slice(1)}"]`);
        if (button) { event.preventDefault(); button.click(); update(); }
      });
    }
  }
  window.addEventListener('hashchange', update);
  update(); I.refresh();
})();
