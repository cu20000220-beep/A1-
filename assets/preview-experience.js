/* Public, on-device demo only. Never an authorization or API fallback. */
'use strict';
(() => {
  const host = location.hostname.toLowerCase().replace(/\.$/, '');
  if (!/^[a-z0-9-]+\.a1fashion\.pages\.dev$/.test(host)) return;
  const I = window.A1I18n;
  const pairs = {
    notice: ['미리보기 체험: 검색·DEMO 상담은 브라우저 안에서만 동작합니다. 회원·DB·서버 API·실제 GPT는 연결하지 않습니다.', 'Preview experience: searches and DEMO advice run only in your browser. Member services, databases, server APIs and live GPT are disconnected.'],
    privacy: ['검색 링크에는 선택한 의류 카테고리만 사용합니다. 입력 글·브랜드·사이즈·예산·사진·분석 비율은 판매처로 보내지 않습니다.', 'Search links use only the selected clothing category. Typed text, brand, size, budget, photos and analysis ratios are not sent to retailers.'],
    pending: ['검증된 상품·가격·할인·재고 정보는 준비 중입니다. 실제 정보를 만들어 표시하지 않습니다.', 'Verified products, prices, discounts and stock are being prepared. No real commercial information is invented.'],
    account: ['이 미리보기에서는 회원·찜 저장·알림에 연결하지 않습니다. 검색과 DEMO 상담만 기기 안에서 체험할 수 있습니다.', 'This preview does not connect accounts, saved favorites or alerts. Explore searches and DEMO advice on your device.'],
    title: ['무료 베타 스타일 예시 · 브라우저 체험', 'Free beta style examples · Browser experience'],
    consent: ['분석된 두 비율을 이번 기기 내 스타일 제안에 사용하는 데 동의합니다.', 'I agree to use the two analysis ratios for this on-device style suggestion.'],
    transfer: ['두 비율을 스타일리스트에 전달하는 데 동의합니다. 이 탭의 동일 출처 임시 저장소에서 1분 이내 한 번만 전달 후 삭제하며, 사진은 전달하지 않습니다.', 'I agree to transfer the two ratios to the stylist. They are passed once within one minute through this tab’s same-origin temporary storage, then removed. The photo is not transferred.'],
    make: ['기기 내 스타일 예시 보기', 'Show on-device style examples'],
    open: ['이 탭에서 AI 스타일리스트 열기', 'Open AI Stylist in this tab'],
    generic: ['수치 없이 스타일리스트 열기', 'Open the stylist without ratios'],
    consentNeeded: ['체형 수치를 사용하려면 먼저 무료 분석을 완료하고 사용에 동의해주세요.', 'Complete the free analysis and agree before using the ratios.'],
    invalid: ['입력값을 확인해주세요. 짧은 의류 질문만 사용하고 사진·링크·비밀키는 입력하지 마세요.', 'Check your input. Use a short clothing question, without photos, links or secret keys.'],
    linkError: ['안전하게 열 수 없는 링크입니다. 판매처의 공식 홈에서 직접 검색해주세요.', 'This link cannot be opened safely. Search directly from the retailer’s official home.'],
    linkNote: ['판매처는 직접 클릭할 때만 현재 탭에서 열립니다. 보안 검사·CAPTCHA·지역 제한은 판매처에서 확인하며 우회하지 않습니다.', 'Retailers open in this tab only when you click. Security checks, CAPTCHA and regional restrictions are controlled by the retailer and are not bypassed.'],
    copyTerm: ['검색어 복사', 'Copy search term'],
    copyUrl: ['검색 주소 복사', 'Copy search URL'],
    copied: ['복사했습니다. Safari 앱에서 붙여넣어 검색해주세요.', 'Copied. Paste it in the Safari app to search.'],
    manualCopy: ['자동 복사가 지원되지 않습니다. 아래 선택된 글을 길게 눌러 복사하고 Safari에서 사용해주세요.', 'Automatic copying is unavailable. Press and hold the selected text below, copy it, and use it in Safari.'],
    safari: ['앱 내부 브라우저에서 접속이 제한되면 공유 메뉴에 Safari에서 열기가 있는지 확인하세요. 없으면 검색 주소를 복사해 Safari 주소창에 붙여넣으세요. 공식 홈 접속과 검색 결과 접속은 다를 수 있으며, 판매처 보안 제한은 우회하지 않습니다.', 'If an in-app browser is restricted, look for Open in Safari in its share menu. If unavailable, copy the search URL and paste it into Safari. Home access and search-result access can differ; retailer security restrictions are not bypassed.'],
    home: ['공식 홈', 'Official home'],
    search: ['공식 검색', 'Official search'],
    used: ['동의한 사진상 비율을 기기 안에서만 참고했습니다. 실제 치수·사이즈 판정이 아닙니다.', 'The consented photo ratios were used only on your device. This is not a measurement or size assessment.'],
    noRatios: ['체형 비율을 사용하지 않은 일반 스타일 예시입니다.', 'General style examples, without using body ratios.'],
    storageError: ['이 브라우저에서 임시 수치 전달을 준비하지 못했습니다. 수치 없이 스타일리스트를 열어주세요.', 'Temporary ratio transfer could not be prepared in this browser. Open the stylist without ratios.'],
    imported: ['동의한 두 비율을 같은 출처에서 한 번 전달받고 임시 저장소에서 삭제했습니다. 상담에 활용하려면 아래 사용 동의도 확인해주세요.', 'The two consented ratios were received once from the same origin and removed from temporary storage. Confirm the usage consent below to include them in advice.']
  };
  for (const [ko,en] of Object.values(pairs)) I.register({[ko]:en});
  const t = key => I.t(pairs[key][0]);
  const tx = (el,key) => I.setText(el,pairs[key][0]);
  const node = (tag,text) => { const el=document.createElement(tag); if(text)el.textContent=text; return el; };
  // These are the existing public directory's official search endpoints.
  const stores = [
    ['Coupang','KR','https://www.coupang.com/np/search','q'], ['Naver Shopping','KR','https://search.shopping.naver.com/search/all','query'],
    ['eBay US','US','https://www.ebay.com/sch/i.html','_nkw'], ['Amazon US','US','https://www.amazon.com/s','k'],
    ['Amazon Japan','JP','https://www.amazon.co.jp/s','k'], ['Rakuten Japan','JP','https://search.rakuten.co.jp/search/mall/',null],
    ['eBay UK','GB','https://www.ebay.co.uk/sch/i.html','_nkw'], ['Amazon UK','GB','https://www.amazon.co.uk/s','k'],
    ['Amazon Germany','EU','https://www.amazon.de/s','k'], ['eBay Germany','EU','https://www.ebay.de/sch/i.html','_nkw'], ['Zalando Germany','EU','https://www.zalando.de/catalog/','q']
  ];
  const categories = {all:'clothing',tops:'shirts',bottoms:'trousers',outerwear:'jackets',dresses:'dresses',accessories:'fashion accessories'};
  const validMetrics = m => m && Object.keys(m).sort().join(',')==='legTorsoRatio,shoulderHipRatio'
    && Number.isFinite(m.shoulderHipRatio)&&m.shoulderHipRatio>=.45&&m.shoulderHipRatio<=2.5
    && Number.isFinite(m.legTorsoRatio)&&m.legTorsoRatio>=.6&&m.legTorsoRatio<=3.5;
  function safeLink(value) {
    try {
      const url=new URL(value);
      if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash)return false;
      if(['shopping.naver.com','www.rakuten.co.jp'].includes(url.hostname)&&url.pathname==='/'&&!url.search)return true;
      return stores.some(([, ,base,key])=>{
        const endpoint=new URL(base);
        if(url.hostname!==endpoint.hostname)return false;
        if(url.pathname==='/'&&!url.search)return true;
        if(key)return url.pathname===endpoint.pathname&&[...url.searchParams.keys()].length===1&&url.searchParams.has(key);
        return !url.search&&/^\/search\/mall\/[^/]+\/$/.test(url.pathname);
      });
    }catch{return false;}
  }
  function retailers(filters={},language=I.language) {
    const country=filters.country||(['DE','FR','IT','ES','NL'].includes(filters.destination)?'EU':filters.destination)||'KR';
    const category=filters.category||'all';
    if(!['KR','US','JP','GB','EU'].includes(country)||!Object.hasOwn(categories,category))throw new Error('invalid');
    return {previewLocal:true,retailers:stores.filter(row=>row[1]===country).map(([name,country,base,key])=>{
      const term=country==='KR'?({all:'의류',tops:'셔츠',bottoms:'바지',outerwear:'재킷',dresses:'원피스',accessories:'패션 소품'})[category]:categories[category];
      const url=new URL(base);if(key)url.searchParams.set(key,term);else url.pathname+=encodeURIComponent(term)+'/';
      return {name,country,currency:({KR:'KRW',US:'USD',JP:'JPY',GB:'GBP',EU:'EUR'})[country],searchUrl:url.href,homeUrl:({'search.shopping.naver.com':'https://shopping.naver.com/','search.rakuten.co.jp':'https://www.rakuten.co.jp/'})[url.hostname]||url.origin+'/',searchTerm:term};
    })};
  }
  const advice = {
    length:['사진상 다리·몸통 비율은 참고만 하고, 상의와 바지의 길이를 바꾸어 편안한 조합을 비교해보세요.','Use photo leg/torso proportions only as a reference and compare comfortable top and trouser lengths.'],
    basic:['편안하게 움직일 수 있는 상의와 하의를 먼저 조합하고, 실제 사이즈표와 반품 조건을 확인하세요.','Start with a comfortable top and bottom, then check the actual size chart and return terms.'],
    work:['출근 코디 예시: 셔츠나 니트에 스트레이트 팬츠를 조합하고 필요하면 가벼운 재킷을 더해보세요.','Office outfit example: pair a shirt or knit with straight trousers and add a light jacket if needed.'],
    color:['아이보리·네이비·차콜처럼 조합하기 쉬운 색에 포인트 색 하나를 더해보세요.','Try easy-to-combine ivory, navy or charcoal with one accent color.'],
    wide:['사진상 어깨 기준점 간격을 참고해 단정한 상의와 여유 있는 하의의 균형을 비교해보세요.','Using the photo’s shoulder landmark spacing as a reference, compare a neat top with more relaxed bottoms.'],
    narrow:['사진상 비율을 참고해 가벼운 상의 레이어와 스트레이트 하의의 조합을 비교해보세요.','Using the photo ratios as a reference, compare a light layered top with straight bottoms.'],
    balanced:['사진상 비율을 참고해 상의 끝선과 바지 밑단 위치를 달리한 코디를 비교해보세요.','Using the photo ratios as a reference, compare outfits with different top lengths and trouser hems.']
  };
  function consult(input) {
    if(!input||!['ko','en'].includes(input.language)||!['style','compare','discount'].includes(input.intent)
      ||typeof input.message!=='string'||!input.message.trim()||input.message.length>1200
      ||/(?:https?:\/\/|data\s*:|blob\s*:|<|base64|\bsk-[\w-]{16,})/i.test(input.message))throw new Error('invalid');
    const use=input.consents?.analysis===true;
    if(use&&!validMetrics(input.metrics))throw new Error('consent');
    const ids=[/출근|회사|office|work/i.test(input.message)?'work':/색|color|colour/i.test(input.message)?'color':'basic'];
    if(use) { ids.push(input.metrics.shoulderHipRatio>1.15?'wide':input.metrics.shoulderHipRatio<.9?'narrow':'balanced'); if(input.metrics.legTorsoRatio<1.5)ids.push('length'); }
    const at=input.language==='en'?1:0;
    return {previewLocal:true,mode:'DEMO',products:[],discounts:[],comparison:null,usage:null,dataStatus:'preparing',
      reply:input.language==='en'?'On-device, rule-based outfit examples. No GPT or server request.':'기기 내 규칙 기반 코디 예시입니다. GPT나 서버를 호출하지 않습니다.',
      advice:ids.map(id=>({id,text:advice[id][at]})),
      notices:[pairs[use?'used':'noRatios'][at],pairs.pending[at],pairs.privacy[at]],
      searchLinks:retailers(input.preferences||{},input.language).retailers.map(row=>({label:row.name,url:row.searchUrl}))};
  }
  async function copyText(value,field,status) {
    try {
      if(navigator.clipboard?.writeText) { await navigator.clipboard.writeText(value); tx(status,'copied'); return; }
    } catch { /* Safari may deny clipboard access in an embedded browser. */ }
    field.hidden=false;field.value=value;field.focus();field.select();field.setSelectionRange(0,value.length);
    let copied=false;try{copied=document.execCommand('copy');}catch{}
    tx(status,copied?'copied':'manualCopy');
  }
  function retailerActions(row) {
    const block=node('div');block.className='preview-retailer-actions';
    if(!safeLink(row.searchUrl)||!safeLink(row.homeUrl))return block;
    for(const [label,url] of [[row.name+' · '+t('search'),row.searchUrl],[t('home'),row.homeUrl]]){
      const a=node('a',label);a.href=url;a.target='_self';a.rel='noopener noreferrer';a.referrerPolicy='no-referrer';block.append(a);
    }
    const term=node('p',row.searchTerm);term.className='preview-search-term';block.append(term);
    const field=node('textarea');field.readOnly=true;field.hidden=true;field.setAttribute('aria-label',t('copyUrl'));
    const status=node('p');status.setAttribute('role','status');status.className='preview-copy-status';
    for(const [key,value] of [['copyTerm',row.searchTerm],['copyUrl',row.searchUrl]]){
      const button=node('button');button.type='button';button.dataset.previewCopy=key;tx(button,key);
      button.addEventListener('click',()=>copyText(value,field,status));block.append(button);
    }
    const help=node('p');help.className='preview-safari-help';tx(help,'safari');block.append(help,field,status);return block;
  }
  function links(target,rows) { for(const row of rows)target.append(retailerActions(row)); }
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
  Object.defineProperty(window,'A1Preview',{value:Object.freeze({retailers,retailerActions,consult,safeLink,validMetrics,t,tx,source:key=>pairs[key][0],mountRecommendations,mountBridge,hydrateStylist}),writable:false,configurable:false});
  document.addEventListener('DOMContentLoaded',ready,{once:true});
})();
