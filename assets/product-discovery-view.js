/* Official-page factual candidates. No retailer images, API keys or private payloads. */
'use strict';
(() => {
 const D=window.A1ProductDiscovery,I=window.A1I18n;
 if(!window.A1Preview||!D||!I)return;
 I.register({
  '공식페이지 확인 상품 후보 · 상품사진 미사용':'Official-page product candidates · no product photos used',
  '공식 상품 페이지에서 확인한 공개 정보와 개별 링크입니다. 승인 상품 피드나 이미지 이용 허가를 뜻하지 않습니다.':'Public facts and individual links checked on official product pages. This is not an approved product feed or an image-use permission.',
  '표시 가격은 페이지 확인 당시 정보이며 실시간·최종 결제 가격이 아닙니다. 재고·배송·혜택 조건은 판매처에서 확인하세요.':'Displayed prices are observations from the page, not live or final checkout prices. Check stock, shipping and benefit conditions at the seller.',
  '피팅용 상품사진·3D 자료와 이용 조건이 아직 확인되지 않아 이 후보의 AI/3D 착용 결과는 제공하지 않습니다.':'Fitting photos, 3D garment data and their use conditions are not yet verified for these candidates, so AI/3D wearing results are not provided.',
  '공식페이지 후보를 확인하고 있습니다.':'Checking official-page candidates.',
  '공식페이지 후보 총 {total}개 · 현재 조건의 참고 후보 {count}개 · 예산 확인 필요 {unknown}개':'{total} official-page candidates · {count} reference candidates for these preferences · {unknown} need budget confirmation',
  '확인된 공식페이지 후보가 없습니다.':'No official-page candidates have been checked.',
  '현재 조건에 맞는 공식페이지 후보가 없습니다. 조건을 바꾸거나 공식 검색을 이용하세요.':'No official-page candidates match these conditions. Change the conditions or use official search.',
  '가격 미확인 · 예산 충족 여부 미확정':'Price unknown · budget match unconfirmed',
  '공식페이지 후보를 읽지 못했습니다. 다시 확인하거나 공식 검색을 이용하세요.':'Official-page candidates could not load. Retry or use official search.',
  '공식페이지 후보 다시 확인':'Retry official-page candidates',
  '이 후보 자료는 KRW 기준입니다. 통화를 바꿀 때 임의 환산하지 않습니다.':'These candidates use KRW. Changing currency does not apply an invented exchange rate.',
  '판매처에서 상품 확인':'Check the product at the seller',
  '앱에서 접속이 제한되면 Safari에서 열기':'If the in-app browser is restricted, open in Safari',
  '상품 링크 복사':'Copy product link',
  '복사한 상품 주소를 Safari 주소창에 붙여넣으세요.':'Paste the copied product address into the Safari address bar.',
  '자동 복사가 제한됐습니다. 아래 상품 주소를 길게 눌러 복사한 뒤 Safari에서 여세요.':'Automatic copying was restricted. Press and hold the product address below to copy it, then open it in Safari.',
  '페이지 표시 가격':'Observed page price','가격 미확인':'Price unknown','사이즈 정보 미확인':'Size information unknown',
  '마지막 페이지 확인':'Last page check','재고 미확인':'Stock unconfirmed','품절 표시 확인':'Observed as out of stock','페이지 재고 표시 확인 · 판매처 재확인 필요':'Page indicated stock · recheck at the seller',
  '확인한 정보와 제한':'Observed facts and limits','상품 종류 일치':'Clothing type matches','색상 일치':'Color matches','컬렉션 일치':'Collection matches','핏 표기 일치':'Listed fit matches','페이지 표시 가격 기준 예산 범위':'Observed page price is within the budget',
  '색상 미확인':'Color unconfirmed','컬렉션 미확인':'Collection unconfirmed','핏 정보 미확인':'Fit unconfirmed','사이즈 미확인':'Size unconfirmed','스타일 세부 정보 미확인':'Style details unconfirmed','용도 정보 미확인':'Occasion details unconfirmed','확인 후 24시간 경과 · 판매처 재확인 필요':'Over 24 hours since checking · recheck at the seller'
 });
 let loading=null,snapshot=null,requestController=null;
 const reasonLabels={type_matches:'상품 종류 일치',color_matches:'색상 일치',collection_matches:'컬렉션 일치',fit_matches:'핏 표기 일치',observed_price_within_budget:'페이지 표시 가격 기준 예산 범위'};
 const warningLabels={color_unconfirmed:'색상 미확인',collection_unconfirmed:'컬렉션 미확인',fit_unconfirmed:'핏 정보 미확인',size_unconfirmed:'사이즈 미확인',style_unconfirmed:'스타일 세부 정보 미확인',occasion_unconfirmed:'용도 정보 미확인',observation_stale:'확인 후 24시간 경과 · 판매처 재확인 필요'};
 const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
 async function load(refresh=false){
  if(refresh&&!loading)snapshot=null;
  if(snapshot)return snapshot;
  if(loading)return loading;
  requestController=new AbortController();const active=requestController,timer=setTimeout(()=>active.abort(),12000);
  loading=(async()=>{
   const response=await fetch('/assets/observed-products.json',{credentials:'omit',cache:'no-store',redirect:'error',signal:active.signal});
   if(!response.ok||!/^application\/json(?:;|$)/i.test(response.headers.get('content-type')||''))throw Error('discovery_response');
   const url=new URL(response.url||'/assets/observed-products.json',location.origin);
   if(url.origin!==location.origin||url.pathname!=='/assets/observed-products.json'||url.search)throw Error('discovery_response');
   const text=await response.text();if(text.length>1_000_000)throw Error('discovery_size');
   const value=JSON.parse(text);D.validateSnapshot(value);snapshot=value;return value;
  })();
  try{return await loading;}finally{clearTimeout(timer);if(requestController===active)requestController=null;loading=null;}
 }
 function create(target){
  if(!target||target.dataset.discoveryView)return null;
  target.dataset.discoveryView='true';target.classList.add('product-discovery-view');
  let revision=0,disposed=false,last=null;
  const heading=node('h3'),notice=node('p'),limitations=node('p'),status=node('p'),grid=node('div'),unknown=node('section'),retry=node('button');
  I.setText(heading,'공식페이지 확인 상품 후보 · 상품사진 미사용');I.setText(notice,'공식 상품 페이지에서 확인한 공개 정보와 개별 링크입니다. 승인 상품 피드나 이미지 이용 허가를 뜻하지 않습니다.');
  I.setText(limitations,'표시 가격은 페이지 확인 당시 정보이며 실시간·최종 결제 가격이 아닙니다. 재고·배송·혜택 조건은 판매처에서 확인하세요.');
  status.setAttribute('role','status');status.className='product-discovery-status';grid.className='product-discovery-grid';unknown.className='product-discovery-unknown';
  retry.type='button';retry.hidden=true;I.setText(retry,'공식페이지 후보 다시 확인');
  target.replaceChildren(heading,notice,limitations,status,retry,grid,unknown);target.hidden=true;
  function card(row,token){
   const p=row.product,article=node('article');article.className='product-discovery-card';article.dataset.discoveryId=p.id;article.dataset.i18nIgnore='';
   article.append(node('h4',p.name),node('p',p.brand+' · '+p.retailerName));
   const price=node('p',p.price===null?I.t('가격 미확인'):I.t('페이지 표시 가격')+': '+p.price.toLocaleString(I.locale)+' '+p.currency);price.className='product-discovery-price';article.append(price);
   article.append(node('p',(p.sizes.length?p.sizes.join(', '):I.t('사이즈 정보 미확인'))+' · '+I.t(p.stock==='unknown'?'재고 미확인':p.stock==='out_of_stock'?'품절 표시 확인':'페이지 재고 표시 확인 · 판매처 재확인 필요')),
    node('p',I.t('마지막 페이지 확인')+': '+new Date(p.checkedAt).toLocaleString(I.locale)));
   const reasons=node('ul');for(const code of row.reasons)if(reasonLabels[code])reasons.append(node('li',I.t(reasonLabels[code])));if(reasons.children.length)article.append(reasons);
   const warnings=node('ul');warnings.className='product-discovery-warnings';for(const code of row.warnings)if(warningLabels[code])warnings.append(node('li',I.t(warningLabels[code])));if(warnings.children.length)article.append(warnings);
   const details=node('details'),summary=node('summary',I.t('확인한 정보와 제한'));
   details.append(summary,node('p',p.priceNote),node('p',p.sourceNote));for(const feature of p.observedFeatures)details.append(node('p',feature));
   details.append(node('p',I.t('피팅용 상품사진·3D 자료와 이용 조건이 아직 확인되지 않아 이 후보의 AI/3D 착용 결과는 제공하지 않습니다.')));article.append(details);
   const link=node('a',I.t('판매처에서 상품 확인'));link.href=p.productUrl;link.rel='noopener noreferrer';link.referrerPolicy='no-referrer';link.dataset.discoveryBuy=p.id;
   link.addEventListener('click',event=>{if(!event.isTrusted||disposed||token!==revision||!D.safeProductUrl(p.productUrl)||link.href!==p.productUrl)event.preventDefault();});article.append(link);
   const help=node('details'),helpTitle=node('summary',I.t('앱에서 접속이 제한되면 Safari에서 열기'));
   const copy=node('button',I.t('상품 링크 복사'));copy.type='button';copy.dataset.discoveryCopy=p.id;
   const address=node('input');address.type='url';address.readOnly=true;address.value=p.productUrl;address.setAttribute('aria-label',I.t('상품 링크 복사'));address.className='product-discovery-address';
   const copyStatus=node('p');copyStatus.setAttribute('role','status');
   copy.addEventListener('click',async event=>{
    if(!event.isTrusted||disposed||token!==revision||!D.safeProductUrl(p.productUrl))return;
    try{await navigator.clipboard.writeText(p.productUrl);if(disposed||token!==revision)return;copyStatus.textContent=I.t('복사한 상품 주소를 Safari 주소창에 붙여넣으세요.');}
    catch{if(disposed||token!==revision)return;address.focus();address.select();copyStatus.textContent=I.t('자동 복사가 제한됐습니다. 아래 상품 주소를 길게 눌러 복사한 뒤 Safari에서 여세요.');}
   });
   help.append(helpTitle,copy,address,copyStatus);article.append(help);return article;
  }
  async function search(conditions,{refresh=false}={}){
   if(disposed)return false;const token=++revision;last=conditions?{...conditions}:null;
   if(!last){clear();return false;}
   target.hidden=false;target.dataset.state='loading';grid.replaceChildren();unknown.replaceChildren();retry.hidden=true;I.setText(status,'공식페이지 후보를 확인하고 있습니다.');
   if(last.currency&&last.currency!=='KRW'){target.dataset.state='unsupported';I.setText(status,'이 후보 자료는 KRW 기준입니다. 통화를 바꿀 때 임의 환산하지 않습니다.');return false;}
   try{
    const data=await load(refresh);if(disposed||token!==revision||!target.isConnected)return false;
    const result=D.search(data,last);target.dataset.state='ready';target.dataset.count=String(result.candidates.length);target.dataset.snapshotCount=String(result.snapshotCount);
    I.setText(status,result.snapshotCount?'공식페이지 후보 총 {total}개 · 현재 조건의 참고 후보 {count}개 · 예산 확인 필요 {unknown}개':'확인된 공식페이지 후보가 없습니다.',{total:result.snapshotCount,count:result.candidates.length,unknown:result.budgetUnconfirmed.length});
    if(result.snapshotCount&&!result.candidates.length&&!result.budgetUnconfirmed.length)grid.append(node('p',I.t('현재 조건에 맞는 공식페이지 후보가 없습니다. 조건을 바꾸거나 공식 검색을 이용하세요.')));
    for(const row of result.candidates)grid.append(card(row,token));
    unknown.hidden=!result.budgetUnconfirmed.length;
    if(result.budgetUnconfirmed.length){unknown.append(node('h4',I.t('가격 미확인 · 예산 충족 여부 미확정')));const list=node('div');list.className='product-discovery-grid';for(const row of result.budgetUnconfirmed)list.append(card(row,token));unknown.append(list);}
    return true;
   }catch{if(disposed||token!==revision)return false;target.dataset.state='error';grid.replaceChildren();unknown.replaceChildren();I.setText(status,'공식페이지 후보를 읽지 못했습니다. 다시 확인하거나 공식 검색을 이용하세요.');retry.hidden=false;return false;}
  }
  function clear(){revision++;last=null;target.hidden=true;target.dataset.state='cleared';delete target.dataset.count;delete target.dataset.snapshotCount;grid.replaceChildren();unknown.replaceChildren();status.textContent='';retry.hidden=true;}
  function dispose(){clear();disposed=true;document.removeEventListener('a1:language-changed',language);}
  function language(){if(last&&!disposed)search(last);}
  retry.addEventListener('click',()=>{if(last)search(last,{refresh:true});});document.addEventListener('a1:language-changed',language);
  return Object.freeze({target,search,clear,dispose});
 }
 window.addEventListener('pagehide',()=>{requestController?.abort();snapshot=null;});
 window.A1ProductDiscoveryView=Object.freeze({create});
})();
