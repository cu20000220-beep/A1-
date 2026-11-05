'use strict';
(() => {
  const $=s=>document.querySelector(s), I=window.A1I18n, t=(s,p)=>I.t(s,p), tx=(el,s,p)=>I.setText(typeof el==='string'?$(el):el,s,p);
  let busy=false, generation=0, currentTab='shopping';
  const data={account:null,retailers:null,comparison:null,watchlist:[],history:[],preview:null};
  const activeRequests=new Set();
  const hosts=new Set(['www.coupang.com','search.shopping.naver.com','www.ebay.com','www.ebay.co.uk','www.ebay.de','www.amazon.com','www.amazon.co.jp','www.amazon.co.uk','www.amazon.de','search.rakuten.co.jp','www.zalando.de']);
  const warn={ 'unverified-source':'출처 미확인', 'stale-or-unknown-price':'가격이 오래되었거나 확인되지 않았습니다.', 'destination-not-supported':'선택한 국가로 배송되지 않습니다.', 'shipping-availability-unknown':'배송 가능 여부 미확인', 'sold-out':'품절', 'stock-unknown':'재고 미확인', 'promotion-not-current':'현재 적용되지 않는 프로모션', 'invalid-price':'가격 미확인', 'shipping-cost-unknown':'배송비 미확인', 'tax-unknown':'세금 미확인', 'duties-unknown':'관세 미확인', 'fx-unavailable-or-stale':'환율이 없거나 오래되었습니다.', 'invalid-product-url':'상품 URL 미확인', 'not-a-worldwide-lowest-price-guarantee':'전 세계 절대 최저가를 보장하지 않습니다.', 'fictional-demo-data-not-live-prices':'모든 가격·배송비·세금·환율은 가상의 DEMO입니다.', 'some-sellers-cannot-be-ranked':'미확인 비용이 있는 판매처는 순위에서 제외됩니다.', 'lowest-price-unavailable':'최저가 확인 불가' };
  const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
  const money=(value,currency)=>typeof value==='number'&&Number.isFinite(value)?new Intl.NumberFormat(I.locale,{style:'currency',currency,currencyDisplay:'code',maximumFractionDigits:['KRW','JPY'].includes(currency)?0:2}).format(value):t('미확인');
  const date=value=>Number.isFinite(value)?new Intl.DateTimeFormat(I.locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):t('미확인');
  function status(source,error=false,params){tx('#global-status',source,params);$('#global-status').classList.toggle('is-error',error);}
  function safeLink(url,label){try{const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password||u.port||!hosts.has(u.hostname))return null;const a=node('a',label);a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';return a;}catch{return null;}}
  function setBusy(value){busy=value;document.querySelectorAll('.global-shell button:not([data-tab])').forEach(e=>{if(!e.hasAttribute('data-permanent-disabled'))e.disabled=value;});}
  function err(response,body){
    if(body.error==='consent_required')return '해당 채널의 별도 수신 동의가 필요합니다.';
    if(response.status===401)return '회원가입·로그인 후 이용해주세요.';
    if(response.status===403)return '이 기능에 필요한 유효한 구독 권한을 확인하지 못했습니다.';
    if(response.status===429)return '요청이 많습니다. 잠시 후 다시 시도해주세요.';
    if(response.status===400)return '입력값과 별도 동의 여부를 확인해주세요.';
    return '서비스 연결 또는 DB 설정을 준비 중입니다. 실제 상품 연동·발송은 활성화되지 않았습니다.';
  }
  async function api(path,method='GET',body){
    const token=generation,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);activeRequests.add(controller);
    try{const response=await fetch('api/global/'+path,{method,credentials:'same-origin',cache:'no-store',signal:controller.signal,headers:{Accept:'application/json','Accept-Language':I.language,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
      let result;try{result=await response.json();}catch{result={};}
      if(token!==generation)throw new Error('session_changed');
      if(!response.ok){const e=new Error('request_failed');e.publicMessage=err(response,result);e.status=response.status;throw e;}return result;
    }finally{clearTimeout(timer);activeRequests.delete(controller);}
  }
  function clearPrivate(){generation++;for(const controller of activeRequests)controller.abort();activeRequests.clear();setBusy(false);Object.assign(data,{account:null,retailers:null,comparison:null,watchlist:[],history:[],preview:null});for(const id of ['retailer-results','comparison-results','watchlist-results','notification-history','notification-preview','global-account'])$('#'+id).replaceChildren();$('#preferences-form').reset();$('#watchlist-form').reset();$('#preferences-form').elements.phone.value='';$('#preferences-form').elements.phone.placeholder='+821012345678';for(const channel of ['email','sms'])tx('#'+channel+'-consent-status','미동의');}
  async function run(action,success='요청을 완료했습니다.'){
    if(busy)return;const token=generation;setBusy(true);status('서버에서 권한과 요청을 확인하고 있습니다.');
    try{await action();if(token===generation)status(success);}catch(e){if(token===generation){if(e.status===401||e.status===403)clearPrivate();status(e.publicMessage||'요청 결과를 확인하지 못했습니다. 다시 시도해주세요.',true);}}
    finally{if(token===generation)setBusy(false);}
  }
  function warnings(container,list){const ul=node('ul',undefined,'offer-warnings');for(const code of list||[])ul.append(node('li',t(warn[code]||'확인되지 않은 정보가 있습니다.')));container.append(ul);}
  function renderRetailers(){const target=$('#retailer-results');target.replaceChildren();if(!data.retailers)return;for(const r of data.retailers.retailers||[]){const card=node('article',undefined,'retailer-card');card.append(node('p',r.country+' / '+r.currency),node('h3',r.name),node('p',t('검색 연결만 제공 · 실제 상품 피드 미연결')),node('p',t('선택한 목적지로 배송 가능한지는 판매처에서 확인해야 합니다.')));const a=safeLink(r.searchUrl,t('판매처 검색 열기 →'));if(a)card.append(a);target.append(card);}if(!target.children.length)target.append(node('p',t('조건에 맞는 판매처가 없습니다.')));}
  function renderComparison(){const target=$('#comparison-results');target.replaceChildren();const c=data.comparison;if(!c)return;target.append(node('p',t('DEMO · 실제 판매 상품이나 최저가가 아닙니다.'),'global-disclosure'),node('h3',c.product.name+' / '+c.product.color+' / '+c.product.size));
    const summary=c.lowestOfferId?t('DEMO 비교 가능 판매처 중 최저 예상 비용: {price}',{price:money(c.minimumAmount,c.currency)}):t('최저가 확인 불가');target.append(node('p',summary,'offer-price'));warnings(target,c.warnings);
    if(c.fx)target.append(node('p',t('환율 출처: {source} · 적용 시각: {time}',{source:c.fx.source||t('미확인'),time:date(c.fx.asOf)}),'global-note'));
    const list=node('div',undefined,'offer-list');for(const row of c.results||[]){const card=node('article',undefined,'offer-card'+(row.id===c.lowestOfferId?' is-lowest':''));card.append(node('h3',row.retailerName),node('p',row.sellerCountry+' · SKU '+(row.sku||'—')),node('p',money(row.estimatedTotal,row.currency),'offer-price'));
      const dl=node('dl',undefined,'offer-meta');for(const [label,value] of [['상품 가격',money(row.price,row.originalCurrency)],['배송비',money(row.shipping,row.originalCurrency)],['세금',money(row.tax,row.originalCurrency)],['관세',money(row.duties,row.originalCurrency)],['배송 가능 여부',row.shippingAvailable===true?t('확인됨'):row.shippingAvailable===false?t('불가'):t('미확인')],['가격 확인 시각',date(row.checkedAt)],['재고',row.stock==='in_stock'?t('재고 있음'):row.stock==='sold_out'?t('품절'):t('미확인')]])dl.append(node('dt',t(label)),node('dd',value));card.append(dl);if(row.source)card.append(node('p',t('가격 출처: {source}',{source:row.source})));if(row.promotion)card.append(node('p',t('프로모션 기간: {start} ~ {end}',{start:date(row.promotion.startsAt),end:date(row.promotion.endsAt)})));warnings(card,row.warnings);
      const link=safeLink(row.demo?row.retailerSearchUrl:row.productUrl,t(row.demo?'판매처 검색 열기 →':'확인된 상품 보기 →'));if(link)card.append(link);if(row.id===c.lowestOfferId)card.append(node('p',t('DEMO 비교 대상 중 최저 예상 비용')));list.append(card);}
    target.append(list);if(c.similarOffers?.length){target.append(node('h3',t('유사 상품 · 동일 상품 비교에서 제외')));for(const row of c.similarOffers)target.append(node('p',row.retailerName+' / '+row.color+' / '+row.size+' / '+row.condition,'global-note'));}}
  function renderWatchlist(){const target=$('#watchlist-results');target.replaceChildren();if(!data.watchlist.length){target.append(node('p',t('저장된 관심 상품이 없습니다.')));return;}for(const item of data.watchlist){const row=node('article',undefined,'list-row');row.append(node('strong',item.productId),node('p',item.brand+' · '+(item.targetPrice===null?t('목표 가격 없음'):money(item.targetPrice,item.currency))));const b=node('button',t('삭제'));b.dataset.deleteWatch=item.id;row.append(b);target.append(row);}}
  function renderHistory(){const target=$('#notification-history');target.replaceChildren();for(const delivery of data.history){const row=node('article',undefined,'list-row');row.append(node('strong',delivery.channel+' / '+delivery.status),node('p',date(delivery.createdAt)),node('p',t('모의 기록 · 실제 발송 없음')));target.append(row);}if(!data.history.length)target.append(node('p',t('알림 기록이 없습니다.')));}
  function renderPreview(){const target=$('#notification-preview');target.replaceChildren();if(!data.preview)return;target.append(node('p',t('미리보기 · 실제 발송 없음'),'global-pill'));const template=data.preview.template||data.preview;const content=node('div',undefined,'notification-template');content.dataset.i18nIgnore='';content.textContent=[template.subject,template.body,template.text,template.unsubscribeText].filter(Boolean).join('\n\n');target.append(content);}
  function renderAccount(){const target=$('#global-account');target.replaceChildren();if(!data.account){target.append(node('p',t('로그인 후 내 계정의 권한을 확인할 수 있습니다.')));return;}target.append(node('p',t('서버 확인 등급: {plan}',{plan:data.account.plan})),node('p',t('현재 알림 모드: DRY RUN · 실제 발송 없음')));if(data.account.subscription?.accessUntil)target.append(node('p',t('이용 기간 종료: {time}',{time:date(data.account.subscription.accessUntil)})));}
  async function loadWatch(){data.watchlist=(await api('watchlist')).items||[];renderWatchlist();}
  async function loadPrefs(){const result=await api('preferences');const p=result.preferences||{},f=$('#preferences-form');for(const name of ['country','timeZone','language','frequency'])if(p[name])f.elements[name].value=p[name];f.elements.brands.value=(p.brands||[]).join(', ');f.elements.categories.value=(p.categories||[]).join(', ');f.elements.emailEnabled.checked=p.emailEnabled===true;f.elements.smsEnabled.checked=p.smsEnabled===true;f.elements.phone.value='';f.elements.phone.placeholder=p.phoneMasked||'+821012345678';for(const channel of ['email','sms'])tx('#'+channel+'-consent-status',result.consents?.[channel]?'동의함':'미동의');}
  document.querySelectorAll('.global-plans button[disabled]').forEach(b=>b.dataset.permanentDisabled='');
  document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{currentTab=b.dataset.tab;document.querySelectorAll('[data-tab]').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));document.querySelectorAll('[data-panel]').forEach(n=>n.hidden=n.dataset.panel!==currentTab);location.hash=currentTab;}));
  $('#global-search').addEventListener('submit',e=>{e.preventDefault();run(async()=>{const v=Object.fromEntries(new FormData(e.target));data.retailers=await api('retailers','POST',v);renderRetailers();},'판매처 검색 결과를 확인했습니다. 배송·가격은 판매처에서 확인해주세요.');});
  $('#comparison-form').addEventListener('submit',e=>{e.preventDefault();run(async()=>{data.comparison=await api('comparison','POST',Object.fromEntries(new FormData(e.target)));renderComparison();},'DEMO 가격 비교를 완료했습니다. 실제 최저가가 아닙니다.');});
  $('#watchlist-form').addEventListener('submit',e=>{e.preventDefault();run(async()=>{const v=Object.fromEntries(new FormData(e.target));v.targetPrice=v.targetPrice===''?null:Number(v.targetPrice);await api('watchlist','POST',v);await loadWatch();},'내 관심 상품을 저장했습니다.');});
  $('#watchlist-load').addEventListener('click',()=>run(loadWatch));
  $('#watchlist-results').addEventListener('click',e=>{const b=e.target.closest('[data-delete-watch]');if(b)run(async()=>{await api('watchlist','DELETE',{id:b.dataset.deleteWatch});await loadWatch();},'관심 기록을 삭제했습니다.');});
  $('#preferences-form').addEventListener('submit',e=>{e.preventDefault();run(async()=>{const f=e.target;const v=Object.fromEntries(new FormData(f));v.emailEnabled=f.elements.emailEnabled.checked;v.smsEnabled=f.elements.smsEnabled.checked;v.brands=v.brands.split(',').map(s=>s.trim()).filter(Boolean);v.categories=v.categories.split(',').map(s=>s.trim()).filter(Boolean);if(!v.phone)delete v.phone;await api('preferences','PUT',v);await loadPrefs();},'알림 설정을 저장했습니다. 실제 발송은 비활성입니다.');});
  $('#preferences-load').addEventListener('click',()=>run(loadPrefs));
  $('#preferences-delete').addEventListener('click',()=>run(async()=>{await api('preferences','DELETE',{});await loadPrefs();data.history=[];data.preview=null;renderHistory();renderPreview();},'내 알림 설정과 연락처를 삭제하고 수신 동의를 철회했습니다.'));
  document.querySelectorAll('[data-consent]').forEach(b=>b.addEventListener('click',()=>run(async()=>{const channel=b.dataset.consent,granted=b.dataset.granted==='true';const result=await api('consents','POST',{channel,granted});const consents=result.consents||result;for(const ch of ['email','sms'])if(typeof consents[ch]==='boolean')tx('#'+ch+'-consent-status',consents[ch]?'동의함':'미동의');if(!granted)$('#preferences-form').elements[channel==='email'?'emailEnabled':'smsEnabled'].checked=false;},b.dataset.granted==='true'?'해당 채널에 별도로 동의했습니다. 실제 발송은 비활성입니다.':'동의를 철회했습니다. 이후 모의 알림도 중단합니다.')));
  document.querySelectorAll('[data-preview]').forEach(b=>b.addEventListener('click',()=>run(async()=>{data.preview=await api('preview','POST',{channel:b.dataset.preview});renderPreview();},'모의 미리보기와 기록만 생성했습니다. 실제 발송은 없습니다.')));
  $('#history-load').addEventListener('click',()=>run(async()=>{data.history=(await api('history')).deliveries||[];renderHistory();}));
  $('#history-delete').addEventListener('click',()=>run(async()=>{await api('history','DELETE',{});data.history=[];data.preview=null;renderHistory();renderPreview();},'내 알림 기록을 삭제했습니다.'));
  $('#account-refresh').addEventListener('click',()=>run(async()=>{data.account=await api('account');renderAccount();}));
  I.setText($('#global-status'),'회원 권한과 연결 상태를 확인해주세요.');
  $('#preferences-form').elements.language.value=I.language;
  document.addEventListener('a1:language-changed',()=>{renderRetailers();renderComparison();renderWatchlist();renderHistory();renderPreview();renderAccount();});
  window.addEventListener('storage',e=>{if(e.key==='a1-fashion:auth-event'){clearPrivate();status('로그인 상태가 바뀌었습니다. 권한을 다시 확인해주세요.');}});
  window.addEventListener('pagehide',clearPrivate);
  const tab=location.hash.slice(1);if(['shopping','membership','comparison','watchlist','alerts','account'].includes(tab))document.querySelector('[data-tab="'+tab+'"]').click();
})();
