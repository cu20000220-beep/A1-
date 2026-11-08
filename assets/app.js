'use strict';
(() => {
  const $ = s => document.querySelector(s);
  const records = new Map();
  const t = (source, values) => window.A1I18n.t(source, values);
  const tx = (selector, source, values) => window.A1I18n.setText($(selector), source, values);
  // Saved examples belong to the authenticated server account. Legacy local
  // favorites are deliberately not read, imported or treated as member data.
  let freeBeta = false;
  let lastTrigger, toastTimer, wishRevision=0, wishBusy=false, wishesLoaded=false;
  const wishes=new Map(), wishRequests=new Set();
  async function wishRequest(method='GET', body) {
    const revision=wishRevision, controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),15000);wishRequests.add(controller);
    try {
      const response=await fetch('api/global/watchlist',{method,credentials:'same-origin',cache:'no-store',signal:controller.signal,
        headers:{Accept:'application/json','Accept-Language':window.A1I18n.language,...(body===undefined?{}:{'Content-Type':'application/json'})},
        ...(body===undefined?{}:{body:JSON.stringify(body)})});
      let result;try{result=await response.json();}catch{result={};}
      if(revision!==wishRevision)throw new Error('stale-watch-request');
      if(!response.ok){const error=new Error('watch-request-failed');error.status=response.status;throw error;}
      return result;
    }finally{clearTimeout(timeout);wishRequests.delete(controller);}
  }
  function acceptWishes(items) {
    if(!Array.isArray(items))throw new Error('invalid-watch-response');
    wishes.clear();
    for(const item of Array.isArray(items)?items:[])if(item&&typeof item.id==='string'&&typeof item.productId==='string'&&item.currency==='KRW')wishes.set(item.productId,item.id);
    wishesLoaded=true;syncWishes();
  }
  async function loadWishes(){const revision=wishRevision;const result=await wishRequest();if(revision===wishRevision)acceptWishes(result.items);}
  function wishFailed(error) {
    if(!freeBeta&&(error.status===401||error.status===403))document.dispatchEvent(new CustomEvent('a1:auth-changed'));
    toast(error.status===401||error.status===403?(freeBeta?'찜을 저장하려면 무료 회원으로 로그인해주세요.':'로그인·구독 권한을 다시 확인해주세요. 찜을 변경하지 못했습니다.'):'찜 목록을 확인하거나 저장하지 못했습니다. 잠시 후 다시 시도해주세요.');
  }
  async function toggleWish(id) {
    const p=records.get(id);if(!p||wishBusy)return;
    const revision=wishRevision;wishBusy=true;syncWishes();
    try {
      if(!wishesLoaded)await loadWishes();
      if(revision!==wishRevision)return;
      const savedId=wishes.get(id);
      if(savedId){await wishRequest('DELETE',{id:savedId});if(revision!==wishRevision)return;wishes.delete(id);}
      else {const result=await wishRequest('POST',{productId:id,targetPrice:null,currency:'KRW',brand:'A1 EDIT',category:p.category||''});if(revision!==wishRevision)return;acceptWishes(result.items);if(!wishes.has(id))throw new Error('watch-save-unconfirmed');}
      if(revision===wishRevision){syncWishes();toast('내 계정의 예시 스타일 찜 목록을 갱신했습니다.');}
    }catch(error){if(revision===wishRevision)wishFailed(error);}
    finally{if(revision===wishRevision){wishBusy=false;syncWishes();}}
  }
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
    const b=node('button',wishes.has(p.id)?'♥':'♡','wish-button');b.type='button';b.dataset.wish=p.id;b.setAttribute('aria-label',t(wishes.has(p.id)?'찜 해제':'찜하기'));b.setAttribute('aria-pressed',String(wishes.has(p.id)));b.disabled=wishBusy;return b;
  }
  function syncWishes() {
    document.querySelectorAll('[data-wish]').forEach(b=>{const saved=wishes.has(b.dataset.wish);b.textContent=saved?'♥':'♡';b.setAttribute('aria-pressed',String(saved));b.setAttribute('aria-label',t(saved?'찜 해제':'찜하기'));b.disabled=wishBusy});
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
    wishRevision++;for(const controller of wishRequests)controller.abort();wishRequests.clear();wishes.clear();wishesLoaded=false;wishBusy=false;clearTimeout(toastTimer);$('#toast').classList.remove('show');
    records.clear();$('#ai-cards').replaceChildren();$('#ai-shopping-queries').replaceChildren();$('#ai-shopping').hidden=true;$('#premium-results').hidden=true;
    if($('#detail').open)$('#detail').close();$('#detail-content').replaceChildren();
  }
  function renderPremium(payload) {
    clearPremium();
    freeBeta = payload?.freeBetaMode === true;
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
    if(records.size){const revision=wishRevision;wishBusy=true;syncWishes();loadWishes().catch(error=>{if(revision===wishRevision && !(freeBeta && error.status===401))wishFailed(error);}).finally(()=>{if(revision===wishRevision){wishBusy=false;syncWishes();}});}
  }
  document.addEventListener('click',event=>{
    const d=event.target.closest('[data-detail]');if(d)showDetail(d.dataset.detail,d);
    const w=event.target.closest('[data-wish]');if(w&&records.has(w.dataset.wish))toggleWish(w.dataset.wish);
  });
  $('#close-detail').addEventListener('click',()=>$('#detail').close());$('#detail').addEventListener('close',()=>{document.body.style.overflow='';if(lastTrigger?.isConnected)lastTrigger.focus()});
  $('#detail').addEventListener('click',event=>{if(event.target!==$('#detail'))return;const r=$('#detail').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)$('#detail').close()});
  // Auth changes are handled by premium-client, which calls clearPremium and
  // aborts outstanding account requests before another member can see results.
  document.addEventListener('a1:language-changed',syncWishes);
  guardImage($('#hero-image'));
  window.A1UI=Object.freeze({clearPremium,renderPremium});
})();
