'use strict';
(() => {
  const $ = s => document.querySelector(s);
  const records = new Map();
  const t = (source, values) => window.A1I18n.t(source, values);
  const tx = (selector, source, values) => window.A1I18n.setText($(selector), source, values);
  const storageKey = 'a1-fashion:wishlist:v1';
  let lastTrigger, toastTimer;
  function loadWishes() {
    try { const v=JSON.parse(localStorage.getItem(storageKey)||'[]');return new Set(Array.isArray(v)?v.filter(id=>typeof id==='string'&&/^[a-z0-9-]{1,64}$/i.test(id)):[]); }
    catch { return new Set(); }
  }
  let wishes=loadWishes();
  function node(tag,text,className) {
    const el=document.createElement(tag);if(text!==undefined)el.textContent=t(text);if(className)el.className=className;return el;
  }
  function guardImage(img) {
    const fallback=()=>{img.removeEventListener('error',fallback);img.src='assets/placeholder.svg';img.classList.add('image-fallback');img.alt=t('사진을 불러오지 못했습니다. 스타일 설명을 참고해주세요.')};
    img.addEventListener('error',fallback,{once:true});
    if(img.complete&&!img.naturalWidth)fallback();
  }
  function toast(text) {tx('#toast',text);$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),2300)}
  function imagePath(value) { return typeof value==='string'&&/^assets\/photos\/[a-z0-9_/-]+\.(jpg|jpeg|png|webp)$/i.test(value)&&!value.includes('..') ? value : 'assets/placeholder.svg'; }
  function productValid(p) {return p&&typeof p.id==='string'&&/^[a-z0-9-]{1,64}$/i.test(p.id)&&typeof p.name==='string'&&p.name.length<=160&&Number.isSafeInteger(p.price)&&p.price>=0&&p.source==='example';}
  function wishButton(p) {
    const b=node('button',wishes.has(p.id)?'♥':'♡','wish-button');b.type='button';b.dataset.wish=p.id;b.setAttribute('aria-label',t(wishes.has(p.id)?'찜 해제':'찜하기'));b.setAttribute('aria-pressed',String(wishes.has(p.id)));return b;
  }
  function syncWishes() {
    document.querySelectorAll('[data-wish]').forEach(b=>{const saved=wishes.has(b.dataset.wish);b.textContent=saved?'♥':'♡';b.setAttribute('aria-pressed',String(saved));b.setAttribute('aria-label',t(saved?'찜 해제':'찜하기'))});
  }
  function showDetail(id,trigger) {
    const p=records.get(id);if(!p)return;lastTrigger=trigger;
    const grid=node('div',undefined,'detail-grid'),photo=node('div',undefined,'detail-photo'),img=node('img');img.src=imagePath(p.photo);img.alt=t('{name} 스타일 참고 사진',{name:p.name});guardImage(img);photo.append(img);
    const copy=node('div',undefined,'detail-copy');copy.append(node('p','A1 EDIT · 참고용 예시','brand'));
    const title=node('h2',p.name);title.id='detail-title';copy.append(title,node('p',t('{price}원 · 예시 가격',{price:p.price.toLocaleString(window.A1I18n.locale)}),'price'),node('p',p.description||'스타일 참고용 예시입니다.'));
    const dl=node('dl');for(const [label,value] of [['컬러',p.color],['소재 예시',p.material],['사이즈 예시',p.sizes]])dl.append(node('dt',label),node('dd',value||'안내 없음'));copy.append(dl);
    copy.append(node('p','사진 속 실제 제품과 상품 정보는 다를 수 있습니다. 의류 주문이나 결제를 받지 않으며 실제 사이즈를 보장하지 않습니다.','detail-note'));
    grid.append(photo,copy);$('#detail-content').replaceChildren(grid);$('#detail').showModal();document.body.style.overflow='hidden';$('#close-detail').focus();
  }
  function clearPremium() {
    records.clear();$('#ai-cards').replaceChildren();$('#ai-shopping-queries').replaceChildren();$('#ai-shopping').hidden=true;$('#premium-results').hidden=true;
    if($('#detail').open)$('#detail').close();$('#detail-content').replaceChildren();
  }
  function renderPremium(payload) {
    clearPremium();
    if(!payload||payload.catalogMode!=='examples-only'||!Array.isArray(payload.recommendations)||payload.recommendations.length>4||!Array.isArray(payload.shopSearches)||payload.shopSearches.length>2)throw new Error('추천 응답 형식이 올바르지 않습니다.');
    for(const row of payload.recommendations){
      const p=row.product;if(!productValid(p)||!Array.isArray(row.reasons))continue;records.set(p.id,p);
      const card=node('article',undefined,'card'),photo=node('div',undefined,'card-photo'),open=node('button',undefined,'image-button');open.type='button';open.dataset.detail=p.id;open.setAttribute('aria-label',t('{name} 상세보기',{name:p.name}));
      const img=node('img');img.src=imagePath(p.photo);img.alt=t('{name} 스타일 참고 사진',{name:p.name});img.loading='lazy';guardImage(img);open.append(img);photo.append(open,wishButton(p),node('span',t('참고용 예시 / {gender}',{gender:t(p.gender)}),'card-tag'));
      const info=node('div',undefined,'card-info');info.append(node('p','A1 EDIT · '+t(p.style),'brand'));const h=node('h3',undefined,'product-title'),b=node('button',p.name);b.type='button';b.dataset.detail=p.id;h.append(b);info.append(h,node('span',t('{price}원 · 예시',{price:p.price.toLocaleString(window.A1I18n.locale)}),'price'));
      const reasons=node('ul',undefined,'ai-reasons');for(const reason of row.reasons.slice(0,6))if(typeof reason==='string')reasons.append(node('li',reason));info.append(reasons);card.append(photo,info);$('#ai-cards').append(card);
    }
    const allowedHosts=new Set(['www.coupang.com','www.temu.com','search.shopping.naver.com']);
    for(const suggestion of payload.shopSearches){
      if(typeof suggestion.query!=='string'||!Array.isArray(suggestion.links))continue;
      const row=node('article',undefined,'shop-search-row'),text=node('div'),links=node('div',undefined,'shop-search-links');text.append(node('h4',suggestion.displayQuery||suggestion.query),node('p',suggestion.reason||''));
      for(const link of suggestion.links){let u;try{u=new URL(link.url)}catch{continue}if(u.protocol!=='https:'||u.username||u.password||u.port||!allowedHosts.has(u.hostname))continue;const a=node('a',(link.label||link.store)+' '+t('↗'));a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';links.append(a)}
      row.append(text,links);$('#ai-shopping-queries').append(row);
    }
    tx('#ai-recommendation-count','{count}개 예시 스타일',{count:records.size});tx('#ai-catalog-status','현재 자료는 실제 판매 상품이 아닌 참고용 예시입니다. 실시간 상품 목록 연동은 준비 중입니다.');
    $('#ai-no-matches').hidden=records.size>0;$('#ai-shopping').hidden=!$('#ai-shopping-queries').children.length;tx('#ai-shopping-budget','외부몰에는 의류 검색어만 전달하며 A1에서 고른 예산 제한은 판매처에서 직접 설정해야 합니다.');$('#premium-results').hidden=false;
  }
  document.addEventListener('click',event=>{
    const d=event.target.closest('[data-detail]');if(d)showDetail(d.dataset.detail,d);
    const w=event.target.closest('[data-wish]');if(w&&records.has(w.dataset.wish)){if(wishes.has(w.dataset.wish))wishes.delete(w.dataset.wish);else wishes.add(w.dataset.wish);let saved=true;try{localStorage.setItem(storageKey,JSON.stringify([...wishes]))}catch{saved=false}syncWishes();toast(saved?'찜 목록을 갱신했습니다.':'이번 방문에서만 찜을 보관합니다.')}
  });
  $('#close-detail').addEventListener('click',()=>$('#detail').close());$('#detail').addEventListener('close',()=>{document.body.style.overflow='';if(lastTrigger?.isConnected)lastTrigger.focus()});
  $('#detail').addEventListener('click',event=>{if(event.target!==$('#detail'))return;const r=$('#detail').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)$('#detail').close()});
  window.addEventListener('storage',event=>{if(event.key===storageKey){wishes=loadWishes();syncWishes()}});
  document.addEventListener('a1:language-changed',syncWishes);
  guardImage($('#hero-image'));
  window.A1UI=Object.freeze({clearPremium,renderPremium});
})();
