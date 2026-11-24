/* Official-page candidates and operator-authorized local garment images. No private payloads. */
'use strict';
(() => {
 function initialize(){
 const experience=window.A1Preview||(window.A1PublicLocal?.mode==='server-public-local'?window.A1PublicLocal:null)||(window.A1PublicBeta?.mode==='server-free-beta-local'?window.A1PublicBeta:null),D=window.A1ProductDiscovery,I=window.A1I18n;
 if(!experience||!D||!I||window.A1ProductDiscoveryView)return;
 document.removeEventListener('a1:public-local-ready',initialize);document.removeEventListener('a1:public-beta-ready',initialize);
 I.register({
  '의류 추천 후보':'Clothing recommendations',
  '공식 상품 페이지를 바탕으로 추천합니다. 현재 가격과 재고는 판매처에서 확인하세요.':'Recommendations are based on official product pages. Check current prices and stock at the retailer.',
  '실제 상품사진 · 운영자 이용 승인':'Actual product photo · operator-authorized use',
  '내 사진에 이 상품 2D 배치':'Place this product on my photo in 2D',
  '3D 예시로 비교':'Compare on my avatar',
  '실제 상품사진을 내 사진 위에 겹치는 기기 내 2D 미리보기입니다.':'This on-device 2D preview overlays the actual product image on your photo.',
  '상품사진을 불러오지 못했습니다. 판매처 링크는 계속 사용할 수 있습니다.':'The product photo could not load. The seller link remains available.',
  '상품 이미지 자료를 준비하지 못했습니다. 상품 정보와 판매처 링크는 계속 사용할 수 있습니다.':'Product-image information could not load. Product facts and seller links remain available.',
  '사진을 선택하고 분석한 뒤 내 사진 사용에 별도로 동의해주세요.':'Choose and analyze a photo, then separately consent to use your photo.',
  '모델 착용 사진은 모델과 배경도 함께 겹칠 수 있습니다.':'A model-worn photo can overlay the model and background as well.',

  '피팅 자료와 이용 조건 미확인':'Fitting assets and usage terms unconfirmed',
  '상품 정보를 불러오는 중입니다.':'Loading product information.',
  '추천 후보 {count}개':'Recommendations ({count})',
  '추천 후보 {count}개 · 가격 확인 필요 {unknown}개':'Recommendations ({count}) · prices to check ({unknown})',
  '현재 조건에 맞는 상품이 없습니다. 조건을 바꾸거나 판매처 검색을 이용하세요.':'No products match these conditions. Adjust your filters or use the retailer searches.',
  '추천 상품 정보가 없습니다. 판매처 검색에서 옷을 찾을 수 있습니다.':'Recommendation data is unavailable. Try the retailer searches.',
  '현재 조건에서 신체 비율과 연결할 수 있는 상품 특성이 확인되지 않았습니다. 찾는 옷이나 용도를 바꿔 물어보세요.':'No confirmed garment feature matches these proportions and filters. Try asking about a different garment or occasion.',
  '가격 미확인 · 예산 충족 여부 미확정':'Price unknown · budget match unconfirmed',
  '상품 정보를 불러오지 못했습니다. 다시 시도하거나 판매처 검색을 이용하세요.':'Product information could not load. Try again or use the retailer searches.',
  '상품 정보 다시 불러오기':'Reload product information',
  '추천 상품의 가격은 원화로 확인했습니다. KRW를 선택하거나 판매처 검색을 이용하세요.':'Recommendation prices were checked in Korean won. Choose KRW or use the retailer searches.',
  '판매처에서 상품 확인':'Check the product at the seller',
  '앱에서 접속이 제한되면 Safari에서 열기':'If the in-app browser is restricted, open in Safari',
  '상품 링크 복사':'Copy product link',
  '복사한 상품 주소를 Safari 주소창에 붙여넣으세요.':'Paste the copied product address into the Safari address bar.',
  '자동 복사가 제한됐습니다. 아래 상품 주소를 길게 눌러 복사한 뒤 Safari에서 여세요.':'Automatic copying was restricted. Press and hold the product address below to copy it, then open it in Safari.',
  '페이지 표시 가격':'Observed page price','가격 미확인':'Price unknown','사이즈 정보 미확인':'Size information unknown','표시 사이즈 {sizes}':'Listed sizes {sizes}',
  '페이지 확인 {date}':'Page checked {date}','재고 미확인':'Stock unconfirmed','품절 표시 확인':'Observed as out of stock','페이지에 재고 표시':'Stock indicated on the product page',
  '상품 정보 및 출처':'Product details and source','추천 이유':'Why it matches','상품 종류 일치':'Clothing type matches','카테고리 일치':'Category matches','색상 일치':'Color matches','컬렉션 일치':'Collection matches','핏 표기 일치':'Listed fit matches','사이즈 표기 일치':'Listed size matches','페이지 표시 가격 기준 예산 범위':'Observed price within budget',
  '선택한 용도에 참고할 상품 특징':'Listed details related to your occasion',
  '선택한 용도에 참고할 수 있는 코디':'Outfit idea for the selected occasion','선택한 스타일에 맞는 상품 표기':'Listed details match your style preference',
  '색상 미확인':'Color unconfirmed','컬렉션 미확인':'Collection unconfirmed','핏 정보 미확인':'Fit unconfirmed','사이즈 미확인':'Size unconfirmed','스타일 세부 정보 미확인':'Style details unconfirmed','용도 정보 미확인':'Occasion details unconfirmed','확인 후 24시간 경과 · 판매처 재확인 필요':'Over 24 hours since checking · recheck at the seller',
  '체형을 참고한 이유':'Why it matches your proportions',
  '사진상 비율':'Proportion estimated from the photo','직접 입력 치수로 계산':'Calculated from measurements you entered',
  '어깨와 골반 너비 비율':'Shoulder-to-hip width ratio','다리와 몸통 길이 비율':'Leg-to-torso length ratio',
  '허리와 엉덩이 둘레 비율':'Waist-to-hip circumference ratio','팔과 다리 길이 비율':'Arm-to-leg length ratio',
  '몸통 길이와 키의 비율':'Torso-to-height ratio','다리 길이와 키의 비율':'Leg-to-height ratio','팔 길이와 키의 비율':'Arm-to-height ratio',
  '기장':'Length','핏':'Fit','허리선':'Waistline','소매 길이':'Sleeve length','어깨선':'Shoulder line','실루엣':'Silhouette',
  '짧은 기장 상의':'Cropped top','긴 기장 상의':'Longline top','발목 기장':'Ankle length','긴 바지 기장':'Full-length trousers',
  '와이드핏':'Wide fit','여유핏':'Relaxed fit','허리 밴딩':'Elastic waist','높은 허리선':'High rise',
  '반소매':'Short sleeves','긴소매':'Long sleeves','셋인 숄더':'Set-in shoulder','드롭 숄더':'Drop shoulder',
  '카디건':'Cardigan','일자 실루엣':'Straight silhouette',
  '{ratio} ({basis}) · {attribute} 비교에 참고할 상품 표기 {feature}':'{ratio} ({basis}) · Listed {feature} for comparing {attribute}',
  '{ratio} ({basis}) · {attribute} 비교 제안 {feature}':'{ratio} ({basis}) · Consider {feature} when comparing {attribute}'
 });
 let loading=null,snapshot=null,requestController=null,loadGeneration=0,imageLoading=null,imageManifest=null,imageController=null;
 const reasonLabels={
  type_matches:'상품 종류 일치',category_matches:'카테고리 일치',color_matches:'색상 일치',
  collection_matches:'컬렉션 일치',fit_matches:'핏 표기 일치',size_matches:'사이즈 표기 일치',
  observed_price_within_budget:'페이지 표시 가격 기준 예산 범위',
  purpose_label_matches:'선택한 용도에 참고할 상품 특징',purpose_coordination_hint:'선택한 용도에 참고할 수 있는 코디',
  style_label_matches:'선택한 스타일에 맞는 상품 표기'
 };
 const warningLabels={color_unconfirmed:'색상 미확인',collection_unconfirmed:'컬렉션 미확인',fit_unconfirmed:'핏 정보 미확인',size_unconfirmed:'사이즈 미확인',style_unconfirmed:'스타일 세부 정보 미확인',occasion_unconfirmed:'용도 정보 미확인',observation_stale:'확인 후 24시간 경과 · 판매처 재확인 필요'};
 const visibleWarnings=new Set(['color_unconfirmed','collection_unconfirmed','fit_unconfirmed','size_unconfirmed']);
 const proportionLabels={
  ratio:{
   shoulderHip:'어깨와 골반 너비 비율',legTorso:'다리와 몸통 길이 비율',waistHip:'허리와 엉덩이 둘레 비율',
   armLeg:'팔과 다리 길이 비율',torsoHeight:'몸통 길이와 키의 비율',legHeight:'다리 길이와 키의 비율',armHeight:'팔 길이와 키의 비율'
  },
  basis:{photo:'사진상 비율',manual:'직접 입력 치수로 계산'},
  attribute:{length:'기장',fit:'핏',waistline:'허리선',sleeves:'소매 길이',shoulderLine:'어깨선',silhouette:'실루엣'},
  feature:{
   cropped_top:'짧은 기장 상의',longline_top:'긴 기장 상의',ankle_length:'발목 기장',full_length:'긴 바지 기장',
   wide_fit:'와이드핏',relaxed_fit:'여유핏',elastic_waist:'허리 밴딩',high_rise:'높은 허리선',
   short_sleeves:'반소매',long_sleeves:'긴소매',set_in_shoulder:'셋인 숄더',drop_shoulder:'드롭 숄더',
   cardigan_layer:'카디건',straight_line:'일자 실루엣'
  }
 };
 function proportionText(reason,{evidence=false}={}){
  if(!reason)return '';
  const labels={};
  for(const [field,vocabulary] of Object.entries(proportionLabels)){
   const code=reason[field];
   if(typeof code!=='string'||!Object.hasOwn(vocabulary,code))return '';
   labels[field]=I.t(vocabulary[code]);
  }
  return I.t(evidence?'{ratio} ({basis}) · {attribute} 비교에 참고할 상품 표기 {feature}':'{ratio} ({basis}) · {attribute} 비교 제안 {feature}',labels);
 }
 function validProfile(profile){
  if(!profile)return null;
  try{
   const validated=window.A1ProportionProfile?.validate(profile);
   return validated&&typeof validated==='object'?validated:null;
  }catch{return null;}
 }
 const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
 async function load(refresh=false){
  if(refresh&&!loading)snapshot=null;
  if(snapshot)return snapshot;
  if(loading)return loading;
  requestController=new AbortController();const active=requestController,generation=loadGeneration,timer=setTimeout(()=>active.abort(),12000);
  const pending=(async()=>{
   const response=await fetch('/assets/observed-products.json',{credentials:'omit',cache:'no-store',redirect:'error',signal:active.signal});
   if(!response.ok||!/^application\/json(?:;|$)/i.test(response.headers.get('content-type')||''))throw Error('discovery_response');
   const url=new URL(response.url||'/assets/observed-products.json',location.origin);
   if(url.origin!==location.origin||url.pathname!=='/assets/observed-products.json'||url.search)throw Error('discovery_response');
   const text=await response.text();if(text.length>1_000_000)throw Error('discovery_size');
   const value=JSON.parse(text);D.validateSnapshot(value);
   if(active.signal.aborted||generation!==loadGeneration||requestController!==active)throw new DOMException('Discovery read was cleared.','AbortError');
   snapshot=value;return value;
  })();
  loading=pending;
  try{return await pending;}finally{clearTimeout(timer);if(requestController===active)requestController=null;if(loading===pending)loading=null;}
 }
 async function loadImages(refresh=false){
  if(!window.A1ProductImages)return null;
  if(refresh&&!imageLoading)imageManifest=null;
  if(imageManifest)return imageManifest;if(imageLoading)return imageLoading;
  imageController=new AbortController();const active=imageController,generation=loadGeneration,timer=setTimeout(()=>active.abort(),10000);
  const pending=(async()=>{
   const response=await fetch('/assets/product-images.json',{credentials:'omit',cache:'no-store',redirect:'error',signal:active.signal});
   if(!response.ok||!/^application\/json(?:;|$)/i.test(response.headers.get('content-type')||''))throw Error('discovery_images');
   const url=new URL(response.url||'/assets/product-images.json',location.origin);if(url.origin!==location.origin||url.pathname!=='/assets/product-images.json'||url.search)throw Error('discovery_images');
   const text=await response.text();if(text.length>1000000)throw Error('discovery_images');const value=JSON.parse(text);
   if(active.signal.aborted||generation!==loadGeneration||imageController!==active)throw new DOMException('Image read was cleared.','AbortError');
   imageManifest=value;return value;
  })();imageLoading=pending;
  try{return await pending;}finally{clearTimeout(timer);if(imageController===active)imageController=null;if(imageLoading===pending)imageLoading=null;}
 }
 function create(target,{showImages=true,sampleScope,requireProportionEvidence=false}={}){
  if(!target||target.dataset.discoveryView)return null;
  target.dataset.discoveryView='true';target.classList.add('product-discovery-view');
  let revision=0,disposed=false,last=null,lastProfile=null,reported=null;
  const heading=node('h3'),notice=node('p'),status=node('p'),imageStatus=node('p'),grid=node('div'),unknown=node('section'),retry=node('button');
  I.setText(heading,'의류 추천 후보');
  I.setText(notice,'공식 상품 페이지를 바탕으로 추천합니다. 현재 가격과 재고는 판매처에서 확인하세요.');
  notice.className='product-discovery-intro';
  status.setAttribute('role','status');status.className='product-discovery-status';grid.className='product-discovery-grid';unknown.className='product-discovery-unknown';
  retry.type='button';retry.hidden=true;I.setText(retry,'상품 정보 다시 불러오기');
  imageStatus.setAttribute('role','status');imageStatus.className='product-discovery-image-status';
  target.replaceChildren(heading,notice,status,imageStatus,retry,grid,unknown);target.hidden=true;
  function card(row,token){
   const p=row.product,article=node('article');article.className='product-discovery-card';article.dataset.discoveryId=p.id;article.dataset.i18nIgnore='';
   const content=node('div');content.className='product-discovery-content';article.append(content);
   const brand=node('p',p.brand+' · '+p.retailerName);brand.className='product-discovery-brand';
   content.append(brand,node('h4',p.name));
   const price=node('p');price.className='product-discovery-price';
   if(p.price===null){price.dataset.unknown='true';price.textContent=I.t('가격 미확인');}
   else price.append(node('strong',p.price.toLocaleString(I.locale)+' '+p.currency),node('span',I.t('페이지 표시 가격')));
   const stock=node('p',I.t(p.stock==='unknown'?'재고 미확인':p.stock==='out_of_stock'?'품절 표시 확인':'페이지에 재고 표시'));
   stock.className='product-discovery-stock';
   const checked=new Date(p.checkedAt),date=node('time',I.t('페이지 확인 {date}',{date:checked.toLocaleDateString(I.locale)}));date.dateTime=checked.toISOString();
   const sizes=node('p',p.sizes.length?I.t('표시 사이즈 {sizes}',{sizes:p.sizes.join(', ')}):I.t('사이즈 정보 미확인'));sizes.className='product-discovery-sizes';
   content.append(price,stock,sizes,date);
   const reasons=node('ul');reasons.className='product-discovery-reasons';reasons.setAttribute('aria-label',I.t('추천 이유'));
   for(const code of row.reasons)if(reasonLabels[code])reasons.append(node('li',I.t(reasonLabels[code])));
   if(reasons.children.length)content.append(reasons);
   const proportionReasons=(row.proportionReasons||[]).map(reason=>proportionText(reason,{evidence:true})).filter(Boolean);
   if(proportionReasons.length){
    const group=node('div');group.className='product-discovery-proportion';group.dataset.proportionReasons='';
    const list=node('ul');
    for(const reason of proportionReasons)list.append(node('li',reason));
    group.append(node('strong',I.t('체형을 참고한 이유')),list);content.append(group);
   }
   const uncertainties=row.warnings.filter(code=>visibleWarnings.has(code));
   if(uncertainties.length){
    const caution=node('p',uncertainties.map(code=>I.t(warningLabels[code])).join(' · '));
    caution.className='product-discovery-stock';content.append(caution);
   }
   const actions=node('div');actions.className='product-discovery-actions';
   const link=node('a',I.t('판매처에서 상품 확인'));link.href=p.productUrl;link.rel='noopener noreferrer';link.referrerPolicy='no-referrer';link.dataset.discoveryBuy=p.id;
   link.addEventListener('click',event=>{if(!event.isTrusted||disposed||token!==revision||!D.safeProductUrl(p.productUrl)||link.href!==p.productUrl)event.preventDefault();});
   actions.append(link);content.append(actions);
   if(sampleScope&&lastProfile&&window.A1AvatarRecommendation?.sampleFor(p)){
    const sample=node('button',I.t('3D 예시로 비교'));sample.type='button';sample.dataset.avatarSample=p.id;
    sample.addEventListener('click',event=>{
     if(event.isTrusted&&!disposed&&token===revision&&lastProfile)window.A1AvatarRecommendation.openRecommendation(p,lastProfile,sampleScope);
    });
    actions.append(sample);
   }
   const details=node('details');details.className='product-discovery-details';
   details.append(node('summary',I.t('상품 정보 및 출처')));
   const warnings=node('ul');warnings.className='product-discovery-warnings';
   for(const code of row.warnings)if(warningLabels[code]&&!visibleWarnings.has(code))warnings.append(node('li',I.t(warningLabels[code])));
   if(warnings.children.length)details.append(warnings);
   details.append(node('p',p.priceNote),node('p',p.sourceNote));
   if(p.observedFeatures.length)details.append(node('p',p.observedFeatures.join(' · ')));
   const fittingNote=node('p',I.t('피팅 자료와 이용 조건 미확인'));fittingNote.dataset.discoveryFittingNote='';details.append(fittingNote);
   const copy=node('button',I.t('상품 링크 복사'));copy.type='button';copy.dataset.discoveryCopy=p.id;
   const address=node('input');address.type='url';address.readOnly=true;address.value=p.productUrl;address.setAttribute('aria-label',I.t('상품 링크 복사'));address.className='product-discovery-address';
   const copyStatus=node('p');copyStatus.setAttribute('role','status');
   copy.addEventListener('click',async event=>{
    if(!event.isTrusted||disposed||token!==revision||!D.safeProductUrl(p.productUrl))return;
    try{await navigator.clipboard.writeText(p.productUrl);if(disposed||token!==revision)return;copyStatus.textContent=I.t('복사한 상품 주소를 Safari 주소창에 붙여넣으세요.');}
    catch{if(disposed||token!==revision)return;address.focus();address.select();copyStatus.textContent=I.t('자동 복사가 제한됐습니다. 아래 상품 주소를 길게 눌러 복사한 뒤 Safari에서 여세요.');}
   });
   details.append(node('p',I.t('앱에서 접속이 제한되면 Safari에서 열기')),address,copy,copyStatus);
   content.append(details);return article;
  }
  async function decorateImages(data,token,refresh){
   target.dataset.imageState='loading';
   try{
    const manifest=await loadImages(refresh);if(disposed||token!==revision||!target.isConnected)return;
    const P=window.A1ProductImages;if(!manifest||!P){target.dataset.imageState='unavailable';imageStatus.textContent='';return;}
    P.validateManifest(manifest,data);let count=0;
    for(const article of target.querySelectorAll('[data-discovery-id]')){
     const id=article.dataset.discoveryId,product=P.fittingProduct(manifest,data,id);if(!product)continue;
     const media=node('div');media.className='product-discovery-media';
     const image=node('img');image.className='product-discovery-photo';image.alt=product.name;image.referrerPolicy='no-referrer';image.loading='lazy';image.decoding='async';
     const caption=node('p',I.t('실제 상품사진 · 운영자 이용 승인'));caption.className='product-discovery-image-caption';
     const action=node('button',I.t('내 사진에 이 상품 2D 배치'));action.type='button';action.dataset.discoveryFit=id;action.disabled=true;
     image.addEventListener('load',()=>{if(!disposed&&token===revision&&image.naturalWidth>0)action.disabled=false;});
     image.addEventListener('error',()=>{if(disposed||token!==revision)return;image.hidden=true;action.disabled=true;caption.textContent=I.t('상품사진을 불러오지 못했습니다. 판매처 링크는 계속 사용할 수 있습니다.');});
     action.addEventListener('click',async event=>{
      if(!event.isTrusted||disposed||token!==revision||!P.fittingProduct(manifest,data,id))return;
      if(!window.A1CatalogFitting?.openObserved){caption.textContent=I.t('상품 이미지 자료를 준비하지 못했습니다. 상품 정보와 판매처 링크는 계속 사용할 수 있습니다.');return;}
      action.disabled=true;try{await window.A1CatalogFitting.openObserved(id);if(!disposed&&token===revision&&document.querySelector('#ai-form')&&window.A1CatalogFitting.current()?.id!==id)caption.textContent=I.t('상품 이미지 자료를 준비하지 못했습니다. 상품 정보와 판매처 링크는 계속 사용할 수 있습니다.');}finally{if(!disposed&&token===revision&&image.naturalWidth>0)action.disabled=false;}
     });
     media.append(image,caption);image.src=product.imageUrl;article.prepend(media);
     const note=article.querySelector('[data-discovery-fitting-note]');if(note)note.textContent=I.t('실제 상품사진을 내 사진 위에 겹치는 기기 내 2D 미리보기입니다.');
     if(product.imageKind==='model-worn')article.querySelector('.product-discovery-details').append(node('p',I.t('모델 착용 사진은 모델과 배경도 함께 겹칠 수 있습니다.')));
     article.querySelector('.product-discovery-actions').append(action);count++;
    }
    target.dataset.imageState='ready';target.dataset.imageCount=String(count);
   }catch{if(disposed||token!==revision)return;target.dataset.imageState='error';I.setText(imageStatus,'상품 이미지 자료를 준비하지 못했습니다. 상품 정보와 판매처 링크는 계속 사용할 수 있습니다.');}
  }
  async function search(conditions,{profile=null,refresh=false}={}){
   if(disposed)return false;const token=++revision;last=conditions?{...conditions}:null;
   if(!last){clear();return false;}
   lastProfile=validProfile(profile);
   reported=null;
   target.hidden=false;target.dataset.state='loading';target.dataset.imageState='idle';
   delete target.dataset.count;delete target.dataset.snapshotCount;delete target.dataset.imageCount;
   imageStatus.textContent='';grid.replaceChildren();unknown.replaceChildren();unknown.hidden=true;retry.hidden=true;I.setText(status,'상품 정보를 불러오는 중입니다.');
   if(last.currency&&last.currency!=='KRW'){target.dataset.state='unsupported';I.setText(status,'추천 상품의 가격은 원화로 확인했습니다. KRW를 선택하거나 판매처 검색을 이용하세요.');return false;}
   try{
    const data=await load(refresh);if(disposed||token!==revision||!target.isConnected)return false;
    const result=D.search(data,last,{profile:lastProfile});
    const relevant=rows=>requireProportionEvidence&&lastProfile?rows.filter(row=>row.proportionReasons?.length):rows;
    const candidates=relevant(result.candidates),budgetUnconfirmed=relevant(result.budgetUnconfirmed);
    reported=Object.freeze({
     state:'ready',count:candidates.length,unconfirmed:budgetUnconfirmed.length,
     products:Object.freeze(candidates.slice(0,3).map(row=>Object.freeze({name:row.product.name,proportionReasons:row.proportionReasons||[]})))
    });
    target.dataset.state='ready';target.dataset.count=String(candidates.length);target.dataset.snapshotCount=String(result.snapshotCount);
    if(!result.snapshotCount)I.setText(status,'추천 상품 정보가 없습니다. 판매처 검색에서 옷을 찾을 수 있습니다.');
    else if(!candidates.length&&!budgetUnconfirmed.length)I.setText(status,requireProportionEvidence&&lastProfile?'현재 조건에서 신체 비율과 연결할 수 있는 상품 특성이 확인되지 않았습니다. 찾는 옷이나 용도를 바꿔 물어보세요.':'현재 조건에 맞는 상품이 없습니다. 조건을 바꾸거나 판매처 검색을 이용하세요.');
    else I.setText(status,budgetUnconfirmed.length?'추천 후보 {count}개 · 가격 확인 필요 {unknown}개':'추천 후보 {count}개',{count:candidates.length,unknown:budgetUnconfirmed.length});
    for(const row of candidates)grid.append(card(row,token));
    unknown.hidden=!budgetUnconfirmed.length;
    if(budgetUnconfirmed.length){unknown.append(node('h4',I.t('가격 미확인 · 예산 충족 여부 미확정')));const list=node('div');list.className='product-discovery-grid';for(const row of budgetUnconfirmed)list.append(card(row,token));unknown.append(list);}
    if(showImages&&(candidates.length||budgetUnconfirmed.length))decorateImages(data,token,refresh);
    return true;
   }catch{if(disposed||token!==revision)return false;target.dataset.state='error';grid.replaceChildren();unknown.replaceChildren();I.setText(status,'상품 정보를 불러오지 못했습니다. 다시 시도하거나 판매처 검색을 이용하세요.');retry.hidden=false;return false;}
  }
  function clear(){revision++;last=lastProfile=reported=null;target.hidden=true;target.dataset.state='cleared';delete target.dataset.count;delete target.dataset.snapshotCount;grid.replaceChildren();unknown.replaceChildren();status.textContent='';imageStatus.textContent='';delete target.dataset.imageState;delete target.dataset.imageCount;retry.hidden=true;}
  function dispose(){clear();disposed=true;document.removeEventListener('a1:language-changed',language);window.removeEventListener('pagehide',clear);}
  function language(){if(last&&!disposed)search(last,{profile:lastProfile});}
  retry.addEventListener('click',()=>{if(last)search(last,{refresh:true,profile:lastProfile});});document.addEventListener('a1:language-changed',language);
  window.addEventListener('pagehide',clear);
  return Object.freeze({target,search,clear,dispose,summary(){return reported||{state:target.dataset.state,count:0,unconfirmed:0};}});
 }
 window.addEventListener('pagehide',()=>{loadGeneration++;requestController?.abort();requestController=null;loading=null;snapshot=null;imageController?.abort();imageController=null;imageLoading=null;imageManifest=null;});
 window.A1ProductDiscoveryView=Object.freeze({create,proportionText});
 }
 if(document.readyState!=='complete')document.addEventListener('DOMContentLoaded',initialize,{once:true});
 document.addEventListener('a1:public-local-ready',initialize);document.addEventListener('a1:public-beta-ready',initialize);initialize();
})();
