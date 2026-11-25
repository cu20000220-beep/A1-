/* Public, on-device demo only. Never an authorization or API fallback. */
'use strict';
(() => {
  const host = location.hostname.toLowerCase().replace(/\.$/, '');
  if (!/^[a-z0-9-]+\.a1fashion\.pages\.dev$/.test(host)) return;
  const I = window.A1I18n;
  const core=window.A1LocalFashionCore?.create({I,scope:'preview'});
  if(!core)return;
  const {retailers,retailerActions,consult,safeLink,validMetrics,t,tx,node,links,stores}=core;
  function mountRecommendations() {
    const mount=document.querySelector('#premium');if(!mount)return;
    for(const id of ['premium-lock','premium-controls','premium-results'])document.getElementById(id).hidden=true;
    tx(document.querySelector('#premium-title'),'title');tx(document.querySelector('#premium-badge'),'title');mount.querySelector('.eyebrow').textContent='PREVIEW / ON-DEVICE DEMO';
    const box=node('section');box.className='preview-experience';box.id='preview-style-experience';
    const label=node('label'),check=node('input');check.type='checkbox';check.id='preview-style-consent';check.disabled=true;
    const caption=node('span');tx(caption,'consent');label.append(check,caption);
    const button=node('button');button.type='button';button.className='dark-button';button.id='preview-style-show';tx(button,'make');
    const status=node('p');status.id='preview-style-status';status.setAttribute('role','status');
    const result=node('div');result.id='preview-style-results';result.setAttribute('aria-live','polite');box.append(label,button,status,result);mount.append(box);
    let metrics=null,shown=false;
    const render=()=>{result.replaceChildren();const answer=consult({message:'style',language:I.language,intent:'style',preferences:{country:'KR'},consents:{analysis:check.checked},...(check.checked?{metrics}:{})});
      const outfits=node('ul');outfits.id='preview-outfit-list';for(const pair of [['셔츠 + 스트레이트 팬츠','Shirt + straight trousers'],['니트 + 가벼운 재킷','Knit + light jacket'],['티셔츠 + 데님','T-shirt + denim']])outfits.append(node('li',pair[I.language==='en'?1:0]));result.append(outfits);
      for(const row of answer.advice)result.append(node('p',row.text));const note=node('p');tx(note,check.checked?'used':'noRatios');result.append(note);
      const heading=node('h3',I.language==='en'?'Clothing searches · no live product list':'의류 검색어 예시 · 실제 상품 목록 아님');result.append(heading,node('p','clothing / shirts / trousers'));
      links(result,retailers({country:'KR'}).retailers);const privacy=node('p');tx(privacy,'privacy');result.append(privacy);shown=true;};
    button.addEventListener('click',()=>{try{render();status.textContent='';}catch{tx(status,'consentNeeded');}});
    check.addEventListener('change',()=>{if(shown)render();});
    document.addEventListener('a1:analysis-ready',e=>{if(!validMetrics(e.detail?.metrics))return;metrics={...e.detail.metrics};check.checked=false;check.disabled=false;render();});
    const clear=()=>{metrics=null;check.checked=false;check.disabled=true;shown=false;result.replaceChildren();status.textContent='';};
    document.addEventListener('a1:analysis-cleared',clear);window.addEventListener('pagehide',clear);
    document.addEventListener('a1:language-changed',()=>{if(shown)render();});
  }
  const prefix='a1:preview-analysis:';
  function purgeTransfers() { try{for(let i=sessionStorage.length-1;i>=0;i--){const key=sessionStorage.key(i);if(key.startsWith(prefix))sessionStorage.removeItem(key);}}catch{/* No storage fallback to network. */} }
  function mountBridge() {
    const button=document.querySelector('#stylist-analysis-open');if(!button)return;
    const label=node('label');label.className='preview-transfer-consent';const consent=node('input');consent.type='checkbox';consent.id='preview-transfer-consent';const caption=node('span');tx(caption,'transfer');label.append(consent,caption);button.before(label);tx(button,'open');
    const fallback=node('a');fallback.href='stylist.html';fallback.className='preview-link';tx(fallback,'generic');button.after(fallback);
    let metrics=null,navigating=false;
    const status=document.querySelector('#stylist-analysis-status');
    document.addEventListener('a1:analysis-ready',e=>{if(validMetrics(e.detail?.metrics)){metrics={...e.detail.metrics};button.disabled=false;consent.checked=false;}});
    button.addEventListener('click',()=>{
      const url=new URL('stylist.html',location.href);
      if(!consent.checked){location.assign(url.href);return;}
      if(!validMetrics(metrics)){tx(status,'consentNeeded');return;}
      try{
        purgeTransfers();const nonce=Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
        const now=Date.now();sessionStorage.setItem(prefix+nonce,JSON.stringify({origin:location.origin,createdAt:now,expiresAt:now+60000,metrics:{...metrics}}));
        setTimeout(()=>{try{sessionStorage.removeItem(prefix+nonce);}catch{}},60000);
        url.hash='preview-analysis='+nonce;navigating=true;location.assign(url.href);
      }catch{navigating=false;purgeTransfers();tx(status,'storageError');}
    });
    const clear=e=>{metrics=null;consent.checked=false;button.disabled=true;if(!(navigating&&e?.detail?.reason==='pagehide')){navigating=false;purgeTransfers();}};
    document.addEventListener('a1:analysis-cleared',clear);
    document.addEventListener('a1:auth-changed',()=>{navigating=false;clear();});
    window.addEventListener('storage',e=>{if(e.key==='a1-fashion:auth-event'){navigating=false;clear();}});
  }
  function hydrateStylist() {
    const nonce=new URLSearchParams(location.hash.slice(1)).get('preview-analysis');
    if(!nonce)return;
    history.replaceState(null,'',location.pathname+location.search);
    try{
      const raw=sessionStorage.getItem(prefix+nonce);sessionStorage.removeItem(prefix+nonce);purgeTransfers();
      if(!/^[a-f0-9]{32}$/.test(nonce))return;
      const value=JSON.parse(raw),now=Date.now();
      if(!value||Object.keys(value).sort().join(',')!=='createdAt,expiresAt,metrics,origin'||value.origin!==location.origin
        ||!Number.isSafeInteger(value.createdAt)||!Number.isSafeInteger(value.expiresAt)||value.createdAt>now||value.expiresAt!==value.createdAt+60000||value.expiresAt<=now||!validMetrics(value.metrics))throw new Error();
      const form=document.querySelector('#stylist-form');for(const key of ['shoulderHipRatio','legTorsoRatio']){form.elements[key].step='any';form.elements[key].value=String(value.metrics[key]);}
      document.querySelector('#stylist-analysis-consent').checked=false;document.querySelector('.stylist-analysis').open=true;
      const note=document.querySelector('#stylist-analysis-imported');note.hidden=false;tx(note,'imported');
    }catch{const status=document.querySelector('#stylist-status');if(status)tx(status,'storageError');}
  }
  document.addEventListener('click',e=>{
    const a=e.target?.closest?.('a');if(!a)return;
    // Reviewed product links have stricter per-snapshot consumers. Let their
    // handlers verify the exact item URL/expiry/user click instead of treating
    // an individual product page as an unapproved generic search endpoint.
    if(a.matches('[data-catalog-buy],[data-catalog-source],[data-offer-buy]')&&a.closest('#shopping-search')
      ||a.hasAttribute('data-stylist-catalog-buy')&&a.closest('#stylist-chat')
      ||a.hasAttribute('data-selected-catalog-buy')&&a.closest('#lab-selected-catalog')
      ||a.hasAttribute('data-result-catalog-buy')&&a.closest('#lab-local-photo-result')
      ||a.matches('[data-lab-catalog-buy],[data-lab-catalog-source]')&&a.closest('#lab-root .lab-approved-card')
      ||a.matches('[data-discovery-buy],[data-discovery-source]')&&a.closest('#shopping-discovery,[data-stylist-discovery],#lab-observed-products,#avatar-recommendation-results')&&window.A1ProductDiscovery?.safeProductUrl(a.href))return;
    const controlled=a.hasAttribute('data-public-retailer')||a.closest('#retailer-results,#preview-style-results,.stylist-search-links');
    let merchant=false;try{merchant=stores.some(row=>new URL(row[2]).hostname===new URL(a.href).hostname);}catch{}
    if(!controlled&&!merchant)return;
    if(!safeLink(a.href)||!e.isTrusted){e.preventDefault();const status=document.querySelector('#global-status,#stylist-status,#preview-style-status');if(status)tx(status,'linkError');return;}
    a.target='_self';a.rel='noopener noreferrer';a.referrerPolicy='no-referrer';
  },true);
  const ready=()=>{
    for(const el of document.querySelectorAll('[data-preview-notice]'))tx(el,'notice');
    for(const el of document.querySelectorAll('[data-beta-notice] p:nth-child(2),.global-results-heading+.global-note,#global-search+.global-note'))tx(el,'privacy');
    for(const el of document.querySelectorAll('[data-beta-notice] p:nth-child(3),#stylist-form>p.stylist-note:not([id])'))tx(el,'account');
    const shop=document.querySelector('#global-search');if(shop)for(const name of ['brand','size','query','minPrice','maxPrice'])shop.elements[name].disabled=true;
    const external=document.querySelector('#stylist-external-consent');if(external){external.checked=false;external.disabled=true;}
    for(const a of document.querySelectorAll('a[href^="https://"]'))if(safeLink(a.href)){a.target='_self';a.rel='noopener noreferrer';a.referrerPolicy='no-referrer';}
  };
  Object.defineProperty(window,'A1Preview',{value:Object.freeze({...core,mountRecommendations,mountBridge,hydrateStylist}),writable:false,configurable:false});
  document.addEventListener('DOMContentLoaded',ready,{once:true});
})();
