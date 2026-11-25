/* One-document natural GLB + existing photo fitting. Never serialize personal data. */
'use strict';
(() => {
 function initialize() {
 if (!window.A1Preview && window.A1PublicLocal?.mode !== 'server-public-local') return;
 const button = document.querySelector('#lab-open-avatar'), result = document.querySelector('#ai-result');
 if (!button || !result || button.dataset.naturalBridge) return;
 document.removeEventListener('a1:public-local-ready',initialize);
 button.dataset.naturalBridge = 'true';
 const I = window.A1I18n, T = window.A1LabTemplates;
 const workbench=document.querySelector('#main-fitting-studio');
 const mainMount=workbench?.querySelector('#studio-3d-mount');
 I.register({
  '내 체형으로 3D 피팅하기': 'Try clothes on my 3D avatar',
  '사진상 체형 비율을 이 기기에서 3D 아바타와 의류 추천에 사용합니다. 분석 후 두 화면을 자동으로 엽니다.': 'Use estimated body proportions on this device to shape the 3D avatar and recommend clothes. Open both after analysis.',
  '내 3D 아바타 만들고 옷 추천 받기': 'Create my 3D avatar and recommend clothes',
  '전신 사진을 선택하고 내 3D 아바타 만들고 옷 추천 받기를 누르세요. 이 기기에서 체형을 분석한 뒤 가상 피팅과 맞춤 추천을 엽니다.': 'Choose a full-body photo, then select Create my 3D avatar and recommend clothes. Your device analyzes your proportions and opens fitting and tailored recommendations.',
  '내 체형으로 3D 피팅을 하려면 분석 양식에서 동의해주세요.': 'Consent in the analysis form to use your body proportions for 3D fitting.',
  '기본 체형으로 3D 피팅 보기': 'View 3D fitting on a default body',
  '3D 피팅에 적용한 체형 비율': 'Body proportions used for 3D fitting',
  '사진상 추정 비율과 직접 입력한 치수를 바탕으로 조절한 가상 모델입니다. 얼굴은 기본 가상 인물이며, 의류 사이즈는 판매처 실측표에서 확인하세요.': 'This virtual model is adjusted using photo estimates and entered measurements. It uses a default face. Check the retailer’s measurement chart for sizing.',
  '이 기기에서 입력 치수와 사진상 비율을 아바타에 적용합니다.': 'Use entered measurements and photo proportions on this device to shape the avatar.',
  '체형 맞춤 의류 추천 보기': 'See clothing recommendations for my proportions',
  '내 사진으로 피팅하기 · 로컬 2D': 'Fit on my photo · local 2D',
  '사진 선택·분석으로 돌아가기': 'Return to photo selection and analysis',
  '이 스타일을 국내 쇼핑몰에서 검색': 'Search this style at Korean retailers',
  '기존 사진과 권한 있는 의류 이미지를 이 페이지 안에서 사용합니다. 사진 사용 동의는 2D 화면에서 별도로 선택하세요.': 'Use the existing photo and an authorized garment image on this page. Separately consent to photo use in the 2D view.',
  '3D 아바타 착장은 예시 의상입니다. 판매처 상품은 해당 상품 카드에서 원본 사진으로 2D 피팅할 수 있습니다.': 'The 3D avatar wears sample garments. For retailer items, use the original-photo 2D fitting option on the product card when available.',
  '기존 2D 피팅을 열지 못했습니다. 다시 누르거나 사진 분석 화면의 2D 피팅 버튼을 이용하세요.': 'The existing 2D fitting view could not open. Retry or use the 2D fitting button beside the analysis.',
  '기본 3D 아바타를 표시합니다.': 'Displaying the default 3D avatar.',
  '선택한 신체 비율을 반영했습니다. 상의를 바꿔 핏을 비교해보세요.': 'The selected body proportions are applied. Change the top to compare how it fits.',
  '3D 아바타를 준비하고 있습니다.': 'Preparing the 3D avatar.',
  '내 사진으로 3D 피팅': '3D fitting with my photo',
  '사진을 분석한 뒤 이 화면에서 아바타에 의상을 입혀보세요.': 'Analyze a photo, then try clothes on your avatar on this page.',
  '비율을 적용하지 못해 기본 3D 아바타를 표시합니다.': 'The proportions could not be applied. The default 3D avatar is displayed.',
  '3D 모델을 표시하지 못했습니다. 3D 화면의 안내로 재시도하거나 로컬 2D 피팅을 이용하세요.': 'The 3D model could not be displayed. Follow its recovery instructions or use local 2D fitting.',
  '연구실 실행 코드를 받지 못했습니다. 새로고침해주세요. [A1-LAB-SCRIPT]': 'The lab code did not load. Reload this page. [A1-LAB-SCRIPT]'
 });
 if(workbench){
  I.setText(workbench.querySelector('#main-fitting-title'),'내 사진으로 3D 피팅');
  I.setText(workbench.querySelector('#main-fitting-intro'),'사진을 분석한 뒤 이 화면에서 아바타에 의상을 입혀보세요.');
 }
 I.setText(button, '내 체형으로 3D 피팅하기');
 const label = document.createElement('label'); label.className = 'avatar-reference-consent';
 const consent = document.createElement('input'); consent.type = 'checkbox'; consent.id = 'avatar-reference-consent';
 const copy = document.createElement('span'); copy.id='avatar-consent-description';
 I.setText(copy, '사진상 체형 비율을 이 기기에서 3D 아바타와 의류 추천에 사용합니다. 분석 후 두 화면을 자동으로 엽니다.');
 const analyze = document.querySelector('#ai-analyze');
 I.setText(analyze.closest('#ai-studio').querySelector('.ai-intro'),'전신 사진을 선택하고 내 3D 아바타 만들고 옷 추천 받기를 누르세요. 이 기기에서 체형을 분석한 뒤 가상 피팅과 맞춤 추천을 엽니다.');
 const combined = document.createElement('button'); combined.id='ai-analyze-fit'; combined.className='dark-button';
 combined.type='button'; combined.disabled=analyze.disabled; combined.setAttribute('aria-describedby',copy.id);
 I.setText(combined,'내 3D 아바타 만들고 옷 추천 받기');
 combined.addEventListener('click',()=>{consent.checked=true; analyze.form.requestSubmit(analyze);});
 label.append(consent, copy); analyze.before(label,combined);
 button.setAttribute('aria-describedby',copy.id);
 const status = document.createElement('p'); status.id = 'avatar-bridge-status'; status.setAttribute('role', 'status'); button.after(status);
 const fallback = document.createElement('button'); fallback.id = 'avatar-open-default'; fallback.type = 'button'; fallback.className = 'dark-button';
 I.setText(fallback, '기본 체형으로 3D 피팅 보기'); document.querySelector('#ai-form').append(fallback);
 const defaultStatus = document.createElement('p'); defaultStatus.id = 'avatar-default-status'; defaultStatus.setAttribute('role', 'status'); fallback.after(defaultStatus);
 let metrics = null, photoProfile = null, pending = null, revision = 0, navigation = 0, activeRequest = null, viewerObserver = null;
 let studioMeasurements, studioConsent, recommendations, recommendedButton, conversation, chatTarget;
 const clothingConditions = window.A1ShoppingQuery?.parse('의류');
 let avatarConditions = clothingConditions;
 const valid = value => value && Object.keys(value).sort().join(',') === 'legTorsoRatio,shoulderHipRatio'
  && Number.isFinite(value.shoulderHipRatio) && value.shoulderHipRatio >= .45 && value.shoulderHipRatio <= 2.5
  && Number.isFinite(value.legTorsoRatio) && value.legTorsoRatio >= .6 && value.legTorsoRatio <= 3.5;
 const reveal = element => {
  if (!element) return;
  const html = document.documentElement, previous = html.style.scrollBehavior;
  html.style.scrollBehavior = 'auto'; element.scrollIntoView({block:'center', behavior:'auto'});
  element.setAttribute('tabindex', '-1'); element.focus({preventScroll:true}); html.style.scrollBehavior = previous;
 };
 const signal = name => window.dispatchEvent(new CustomEvent(name));
 function clearReference() {
  const reference = document.querySelector('#natural-photo-reference');
  if (reference) { reference.replaceChildren(); reference.hidden = true; }
 }
 function reference(use) {
  const reference = document.querySelector('#natural-photo-reference');
  if (!reference) return;
  clearReference(); if (!use) return;
  const title = document.createElement('strong'); I.setText(title, '3D 피팅에 적용한 체형 비율');
  const note = document.createElement('p'); I.setText(note, '사진상 추정 비율과 직접 입력한 치수를 바탕으로 조절한 가상 모델입니다. 얼굴은 기본 가상 인물이며, 의류 사이즈는 판매처 실측표에서 확인하세요.');
  reference.append(title,note); reference.hidden = false;
 }
 async function recommend(filters = avatarConditions) {
  const profile=studioMeasurements?.current();
  if(!recommendations||!profile)return {state:'empty',count:0,unconfirmed:0};
  avatarConditions=filters;
  await recommendations.search(filters,{profile});
  return recommendations.summary();
 }
 function applyStudioFit(sample) {
  const profile = studioMeasurements?.current() || null;
  const legacy = activeRequest?.useReference && consent.checked && (!studioConsent || studioConsent.checked) ? metrics : null;
  window.A1GltfProof?.setBodyFit(legacy, {profile, sample});
  const usable = Boolean(profile || legacy);
  if (recommendedButton) recommendedButton.hidden = !usable;
  if (chatTarget) chatTarget.hidden=!profile||!conversation;
  if (profile) void recommend();
  else recommendations?.clear();
 }
 function clearStudioInputs() {
  studioMeasurements?.clear();
  recommendations?.clear();
  conversation?.clear();
  if(chatTarget)chatTarget.hidden=true;
  avatarConditions=clothingConditions;
  if (recommendedButton) recommendedButton.hidden = true;
  clearReference();
 }
 async function fitting() {
  try {
   // Close the tall 3D panel before revealing the following photo controls so
   // a layout shift cannot scroll the selected 2D view out of the viewport.
   if (!workbench) {
    viewerObserver?.disconnect();
    if (window.A1FittingStudio3D) await window.A1FittingStudio3D.close();
    else { const panel = document.querySelector('#studio-3d-panel'); if (panel) panel.hidden = true; signal('a1:gltf-suspend'); }
   }
   // Reuse the same document's cropped analysis canvas. No image is copied to
   // an event, URL, storage, new window, iframe or server.
   if (window.A1StudioPhotoFitting) { if (await window.A1StudioPhotoFitting.open() === false) throw Error('missing_fitting'); }
   else if (window.A1LabNavigation) await window.A1LabNavigation.open('#lab-local-photo-fitting');
   else throw Error('missing_fitting');
   if (!document.querySelector('#lab-local-photo-fitting')) throw Error('missing_fitting');
  } catch { I.setText(status, '기존 2D 피팅을 열지 못했습니다. 다시 누르거나 사진 분석 화면의 2D 피팅 버튼을 이용하세요.'); reveal(status); }
 }
 function actions(root) {
  if (!document.querySelector('#natural-photo-reference')) {
   const note = document.createElement('aside'); note.id = 'natural-photo-reference'; note.className = 'notice'; note.hidden = true;
   root.querySelector('.workspace').before(note);
  }
  if (document.querySelector('#natural-open-photo-fitting')) return;
  const flow = document.createElement('section'); flow.className = 'natural-photo-actions';
  const next = document.createElement('button'); next.type = 'button'; next.id = 'natural-open-photo-fitting'; I.setText(next, '내 사진으로 피팅하기 · 로컬 2D'); next.addEventListener('click', fitting);
  const back = document.createElement('button'); back.type = 'button'; I.setText(back, '사진 선택·분석으로 돌아가기'); back.addEventListener('click', () => reveal(document.querySelector('#ai-studio')));
  const search = document.createElement('button'); search.type = 'button'; search.id = 'natural-open-shopping'; I.setText(search, '이 스타일을 국내 쇼핑몰에서 검색'); search.addEventListener('click', async () => {
   await fitting(); reveal(document.querySelector('#lab-photo-search') || document.querySelector('#shopping-search') || document.querySelector('#lab-searches'));
  });
  const note = document.createElement('p'); I.setText(note, '기존 사진과 권한 있는 의류 이미지를 이 페이지 안에서 사용합니다. 사진 사용 동의는 2D 화면에서 별도로 선택하세요.');
  const limits = document.createElement('p'); I.setText(limits, '3D 아바타 착장은 예시 의상입니다. 판매처 상품은 해당 상품 카드에서 원본 사진으로 2D 피팅할 수 있습니다.');
  flow.append(next,back,search,note,limits); root.querySelector('.workspace').after(flow);
  root.querySelector('#gltf-delete').addEventListener('click', () => {
   activeRequest = null; clearStudioInputs();
  });
  const manual = document.createElement('section'); manual.id = 'avatar-proportion-input';
  const manualLabel = document.createElement('label'); manualLabel.className = 'check';
  studioConsent = document.createElement('input'); studioConsent.type = 'checkbox'; studioConsent.id = 'avatar-proportion-consent';
  const manualCopy = document.createElement('span'); I.setText(manualCopy, '이 기기에서 입력 치수와 사진상 비율을 아바타에 적용합니다.');
  manualLabel.append(studioConsent,manualCopy);
  studioMeasurements = window.A1ProportionControls?.create(manual, studioConsent, applyStudioFit, {prefix:'avatar', showGuidance:false});
  if (studioMeasurements) {
   manual.append(manualLabel); root.querySelector('.panel').prepend(manual);
   studioConsent.addEventListener('change', () => {
    if (!studioConsent.checked) {
     clearStudioInputs();
     activeRequest = null;
     consent.checked = false;
    }
    studioMeasurements.render(); applyStudioFit();
   });
  }
  const target = document.createElement('section'); target.id = 'avatar-recommendation-results';
  recommendations = window.A1ProductDiscoveryView?.create(target, {requireProportionEvidence:true});
  if (recommendations) {
   chatTarget=document.createElement('section');chatTarget.id='avatar-conversation';chatTarget.hidden=true;
   conversation=window.A1ShoppingConversation?.create(chatTarget,{
    prefix:'avatar',getConditions:()=>avatarConditions,getProfile:()=>studioMeasurements?.current(),
    search:recommend,resultId:target.id
   });
   recommendedButton = document.createElement('button'); recommendedButton.type = 'button'; recommendedButton.id = 'avatar-recommended-clothes'; recommendedButton.hidden = true;
   I.setText(recommendedButton, '체형 맞춤 의류 추천 보기'); flow.append(recommendedButton); flow.after(chatTarget,target);
   recommendedButton.addEventListener('click', () => {
    if (studioMeasurements?.current()) reveal(chatTarget.hidden?target:chatTarget);
   });
  }
 }
 async function ensureViewer() {
  if (window.A1FittingStudio3D) { await window.A1FittingStudio3D.open({look:'nova'}); return document.querySelector('#gltf-proof-root'); }
  let root = document.querySelector('#gltf-proof-root');
  if (!root) {
   const template = await T.load(mainMount?'studio':'natural');
   if (!activeRequest) throw Object.assign(Error('cancelled'),{code:'CANCELLED'});
   root = document.querySelector('#gltf-proof-root');
   if (!root) {
    const view = document.importNode(template,true);
    if(mainMount){
     root=view.querySelector('#gltf-proof-root');
     if(!root)throw Object.assign(Error('viewer_template'),{code:'TEMPLATE'});
     mainMount.append(view);
    }else{
     const panel = document.createElement('section'); panel.id = 'studio-3d-panel'; panel.className = 'section'; panel.hidden = true;
     root=view; panel.append(root); document.querySelector('#ai-studio').after(panel);
    }
   }
  }
  await import('./gltf-proof.js');
  if (!activeRequest) signal('a1:gltf-suspend');
  if (!window.A1GltfProof) throw Object.assign(Error('script_missing'),{code:'SCRIPT'});
  return root;
 }
 async function open(useReference) {
  const token = ++navigation, current = revision, target = useReference ? status : defaultStatus;
  if (!T) { I.setText(target, '연구실 실행 코드를 받지 못했습니다. 새로고침해주세요. [A1-LAB-SCRIPT]'); return; }
  T.hideFailure(target);
  if (useReference && (!consent.checked || !valid(metrics) || result.hidden)) {
   I.setText(status, '내 체형으로 3D 피팅을 하려면 분석 양식에서 동의해주세요.'); reveal(label); return;
  }
  I.setText(target, '3D 아바타를 준비하고 있습니다.');
  activeRequest = {useReference};
  try {
   if (!pending) pending = ensureViewer().finally(() => { pending = null; });
   const root = await pending;
   if (token !== navigation || current !== revision || useReference && (!consent.checked || result.hidden)) {
    if (!activeRequest || token === navigation) signal('a1:gltf-suspend'); return;
   }
   actions(root);
   const look = root.querySelector('#gltf-look');
   const needsNatural = look.value !== 'nova' || window.A1GltfProof?.snapshot().look !== 'nova';
   // The legacy renderer/assets are preserved in their standalone page. Never
   // silently fall back to them on the primary post-analysis route.
   for (const option of [...look.options]) if (option.value !== 'nova') option.remove();
   look.value = 'nova'; if (needsNatural) look.dispatchEvent(new Event('change'));
   root.hidden = false; document.querySelector('#studio-3d-panel').hidden = false;
   if (studioMeasurements) {
    const base = useReference ? photoProfile : null;
    studioConsent.checked = Boolean(base);
    studioMeasurements.setBase(base);
   }
   applyStudioFit('source');
   signal('a1:gltf-resume');
   const syncStatus = () => {
    if (root.dataset.loadState === 'ready') {
     const requested = Boolean(studioMeasurements?.current() || activeRequest?.useReference && consent.checked);
     const applied = requested && root.dataset.bodyFit === 'applied';
     reference(applied);
     I.setText(target, applied ? '선택한 신체 비율을 반영했습니다. 상의를 바꿔 핏을 비교해보세요.'
      : requested ? '비율을 적용하지 못해 기본 3D 아바타를 표시합니다.' : '기본 3D 아바타를 표시합니다.');
    }
    else if (root.dataset.loadState === 'error') I.setText(target, '3D 모델을 표시하지 못했습니다. 3D 화면의 안내로 재시도하거나 로컬 2D 피팅을 이용하세요.');
    else if (root.dataset.loadState === 'loading') I.setText(target, '3D 아바타를 준비하고 있습니다.');
   };
   viewerObserver?.disconnect(); viewerObserver = new MutationObserver(syncStatus);
   viewerObserver.observe(root, {attributes:true,attributeFilter:['data-load-state','data-body-fit']}); syncStatus();
   reveal(root.querySelector(workbench?'.stage':'.workspace'));
  } catch (error) { if (token === navigation && current === revision) T.failure(mainMount?'studio':'natural',target,error,() => open(useReference)); }
 }
 button.addEventListener('click', () => {
  if (metrics && !result.hidden) consent.checked=true;
  open(true);
 });
 fallback.addEventListener('click', () => open(false));
 // A fictional garment has no mesh for this GLB. Keep its 2D path available,
 // but do not reinterpret it as a compatible 3D garment.
 document.addEventListener('click', event => { const link = event.target.closest('[data-avatar-garment]'); if (!link) return; event.preventDefault(); open(Boolean(consent.checked && metrics)); });
 window.A1AvatarRecommendation = Object.freeze({
  async showRecommendations() {
   if(!valid(metrics)||result.hidden)return;
   if(studioMeasurements?.current()&&chatTarget&&!chatTarget.hidden){reveal(chatTarget);return;}
   consent.checked=true;
   await open(true);
   if(activeRequest?.useReference&&chatTarget&&!chatTarget.hidden)reveal(chatTarget);
  }
 });
 consent.addEventListener('change', () => {
  if (consent.checked) return;
  revision++; clearStudioInputs(); window.A1GltfProof?.setBodyFit(null);
  if (pending && activeRequest?.useReference) activeRequest = null;
 });
 function clear(event) {
  revision++; navigation++; activeRequest = null; metrics = photoProfile = null;
  if (event?.detail?.reason !== 'photo-replacement') consent.checked = false;
  clearStudioInputs();
  viewerObserver?.disconnect();
  if (T) { T.hideFailure(status); T.hideFailure(defaultStatus); }
  if (window.A1FittingStudio3D) window.A1FittingStudio3D.close();
  else { const panel = document.querySelector('#studio-3d-panel'); if (panel) panel.hidden = true; }
  signal('a1:gltf-suspend');
 }
 document.addEventListener('a1:analysis-ready', event => {
  const autoFit = consent.checked;
  clear();
  if (!valid(event.detail?.metrics)) return;
  metrics = {...event.detail.metrics};
  photoProfile = window.A1ProportionProfile?.build(window.A1PhotoProportions?.proportions() || metrics);
  if (autoFit) { consent.checked = true; void open(true); }
 });
 document.addEventListener('a1:analysis-cleared', clear); window.addEventListener('pagehide', clear);
 window.addEventListener('a1:gltf-suspend', () => { navigation++; activeRequest = null; clearStudioInputs(); });
 }
 document.addEventListener('a1:public-local-ready',initialize);
 initialize();
})();
