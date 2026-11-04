'use strict';
(() => {
  const catalog = window.A1Catalog;
  const rules = window.A1CatalogRules;
  const $ = selector => document.querySelector(selector);
  const storageKey = 'a1-fashion:wishlist:v1';
  const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = price => price.toLocaleString('ko-KR') + '원';
  const wishlist = {
    load() {
      try {
        const data = JSON.parse(localStorage.getItem(storageKey) || '[]');
        return new Set(Array.isArray(data) ? data.filter(id => catalog.products.some(p => p.id === id)) : []);
      } catch { return new Set(); }
    },
    save(ids) {
      try { localStorage.setItem(storageKey, JSON.stringify([...ids])); return true; }
      catch { return false; }
    }
  };
  const state = { gender:'전체', query:'', category:'전체', price:'all', style:'전체', sort:'curated', onlyWishes:false, wishes:wishlist.load() };
  let toastTimer, lastTrigger;

  function toast(message) {
    $('#toast').textContent = message;
    $('#toast').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 2600);
  }
  function guardImage(img) {
    img.addEventListener('error', () => {
      if (img.dataset.fallback) return;
      img.dataset.fallback = 'true';
      img.src = 'assets/placeholder.svg';
      img.classList.add('image-fallback');
      img.alt = '사진을 불러오지 못했습니다. 상품 설명을 참고해주세요.';
    }, {once:true});
  }
  function setImage(img, key) {
    img.classList.remove('image-fallback');
    delete img.dataset.fallback;
    guardImage(img);
    img.src = catalog.image(key);
  }
  function heart(id) {
    const saved = state.wishes.has(id);
    return `<button class="wish-button" data-wish="${id}" aria-label="${saved ? '찜 해제' : '찜하기'}" aria-pressed="${saved}">${saved ? '♥' : '♡'}</button>`;
  }
  function list() {
    const rows = catalog.products.filter(p =>
      (state.gender === '전체' || p.gender === state.gender) &&
      (state.category === '전체' || p.category === state.category) &&
      (state.style === '전체' || p.style === state.style) &&
      (!state.onlyWishes || state.wishes.has(p.id)) &&
      (`${p.name} ${p.gender} ${p.category} ${p.style} ${p.color} ${p.material}`.toLocaleLowerCase().includes(state.query.toLocaleLowerCase())) &&
      (state.price === 'all' || state.price === 'under50' && p.price < 50000 || state.price === '50to100' && p.price >= 50000 && p.price < 100000 || state.price === 'over100' && p.price >= 100000)
    );
    if (state.sort !== 'curated') rows.sort((a,b) => state.sort === 'low' ? a.price-b.price : b.price-a.price);
    return rows;
  }
  function render() {
    const rows = list();
    $('#cards').innerHTML = rows.map(p => `<article class="card"><div class="card-photo"><button class="image-button" data-detail="${p.id}" aria-label="${escapeHTML(p.name)} 상세보기"><img src="${escapeHTML(catalog.image(p.photo))}" alt="${escapeHTML(p.name)} 스타일 참고 사진" loading="lazy" decoding="async" width="600" height="800"></button>${heart(p.id)}<span class="card-tag">${rules.sourceLabel(p)} / ${p.gender}</span></div><div class="card-info"><p class="brand">A1 EDIT · ${escapeHTML(p.style)}</p><h3 class="product-title"><button data-detail="${p.id}">${escapeHTML(p.name)}</button></h3><span class="price">${money(p.price)}</span><div class="product-meta"><span>${escapeHTML(p.gender)}</span><span>${escapeHTML(p.category)}</span><span>${escapeHTML(p.color || '컬러 등록 예정')}</span></div></div></article>`).join('');
    $('#cards').querySelectorAll('img').forEach(guardImage);
    $('#empty').hidden = rows.length > 0;
    $('#empty-title').textContent = '아직 발견하지 못한 스타일';
    $('#empty-description').textContent = '검색어나 필터를 바꿔보세요. 찜한 상품이 없다면 마음에 드는 스타일의 하트를 눌러주세요.';
    $('#result-count').textContent = `${state.onlyWishes ? '찜한 스타일 · ' : ''}${rows.length}개의 스타일`;
    $('#wish-count').textContent = state.wishes.size;
    $('#wish-nav').setAttribute('aria-pressed', String(state.onlyWishes));
    $('#wish-nav').style.color = state.onlyWishes ? '#874737' : '';
    document.querySelectorAll('.gender-tabs button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.gender === state.gender)));
    document.dispatchEvent(new CustomEvent('a1:catalog-rendered', {detail:{wishes:[...state.wishes]}}));
  }
  function reset() {
    Object.assign(state, {gender:'전체', query:'', category:'전체', price:'all', style:'전체', sort:'curated', onlyWishes:false});
    HTMLFormElement.prototype.reset.call($('#filters'));
    $('#sort').value = 'curated';
    render();
  }
  function toggleWish(id) {
    if (state.wishes.has(id)) state.wishes.delete(id); else state.wishes.add(id);
    const saved = wishlist.save(state.wishes);
    toast(saved ? state.wishes.has(id) ? '나의 컬렉션에 담았습니다.' : '찜한 스타일에서 삭제했습니다.' : '브라우저 저장이 제한되어 이번 방문에서만 보관합니다.');
    render();
    if ($('#detail').open) updateDetailWish(id);
  }
  function updateDetailWish(id) {
    const button = $('#detail-content [data-detail-wish]');
    if (button && button.dataset.detailWish === id) {
      button.textContent = state.wishes.has(id) ? '♥ 찜한 스타일' : '♡ 찜하기';
      button.setAttribute('aria-pressed', String(state.wishes.has(id)));
    }
  }
  function showDetail(id, trigger) {
    const p = catalog.products.find(product => product.id === id);
    if (!p) return;
    lastTrigger = trigger;
    const referenceLink = `<a href="#studio" data-look="${p.look}">착장 참고 ↗</a>`;
    $('#detail-content').innerHTML = `<div class="detail-grid"><div class="detail-photo"><img src="${escapeHTML(catalog.image(p.photo))}" alt="${escapeHTML(p.name)} 스타일 참고 사진"></div><div class="detail-copy"><p class="brand">${rules.sourceLabel(p)} / ${escapeHTML(p.gender)} / ${escapeHTML(p.style)}</p><h2 id="detail-title">${escapeHTML(p.name)}</h2><p class="price">${money(p.price)} <small style="font-size:10px">예시 가격</small></p><p>${escapeHTML(p.description || '상세 설명 등록 예정입니다.')}</p><dl><dt>컬러</dt><dd>${escapeHTML(p.color || '등록 예정')}</dd><dt>소재 예시</dt><dd>${escapeHTML(p.material || '등록 예정')}</dd><dt>사이즈 예시</dt><dd>${escapeHTML(p.sizes || '등록 예정')}</dd></dl><div class="detail-actions"><button data-detail-wish="${p.id}" aria-pressed="${state.wishes.has(p.id)}">${state.wishes.has(p.id) ? '♥ 찜한 스타일' : '♡ 찜하기'}</button>${referenceLink}</div><p class="detail-note">${escapeHTML(rules.detailNotice(p))}</p></div></div>`;
    guardImage($('#detail-content img'));
    $('#detail').showModal();
    document.body.style.overflow = 'hidden';
    $('#close-detail').focus();
  }
  function closeDetail() { if ($('#detail').open) $('#detail').close(); }
  function chooseLook(index) {
    const look = catalog.looks[index];
    $('#look-image').style.setProperty('--crop', [.32,.44,.27][index]);
    setImage($('#look-image'), look.photo);
    $('#look-select').value = String(index);
    $('#look-note').textContent = look.text;
  }
  document.addEventListener('click', event => {
    const gender = event.target.closest('[data-gender]');
    if (gender) { state.gender = gender.dataset.gender; state.onlyWishes = false; render(); }
    const wish = event.target.closest('[data-wish]');
    if (wish) toggleWish(wish.dataset.wish);
    const detail = event.target.closest('[data-detail]');
    if (detail) showDetail(detail.dataset.detail, detail);
    const dw = event.target.closest('[data-detail-wish]');
    if (dw) toggleWish(dw.dataset.detailWish);
    const look = event.target.closest('[data-look]');
    if (look) { chooseLook(Number(look.dataset.look)); closeDetail(); }
  });
  $('#filters').addEventListener('submit', event => event.preventDefault());
  $('#search').addEventListener('input', event => { state.query = event.target.value.trim(); render(); });
  for (const key of ['category','price','style','sort']) $('#' + key).addEventListener('change', event => { state[key] = event.target.value; render(); });
  $('#reset').addEventListener('click', reset);
  $('#empty-reset').addEventListener('click', reset);
  $('#wish-nav').addEventListener('click', () => { state.onlyWishes = !state.onlyWishes; render(); $('#shop').scrollIntoView({behavior:'smooth'}); });
  $('#close-detail').addEventListener('click', closeDetail);
  $('#detail').addEventListener('click', event => {
    if (event.target === $('#detail')) {
      const rect = $('#detail').getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDetail();
    }
  });
  $('#detail').addEventListener('close', () => {
    document.body.style.overflow = '';
    if (lastTrigger?.isConnected) lastTrigger.focus();
    else if (lastTrigger?.dataset.detail) document.querySelector('[data-detail="' + lastTrigger.dataset.detail + '"]')?.focus();
  });
  $('#look-select').addEventListener('change', event => chooseLook(Number(event.target.value)));
  window.addEventListener('storage', event => {
    if (event.key === storageKey) {
      state.wishes = wishlist.load(); render();
      const button = $('[data-detail-wish]');
      if (button) updateDetailWish(button.dataset.detailWish);
    }
  });
  setImage($('#hero-image'), 'hero');
  chooseLook(0);
  render();
})();
