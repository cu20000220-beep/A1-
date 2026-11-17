/* One-document natural GLB + existing photo fitting. Never serialize personal data. */
'use strict';
(() => {
 if (!window.A1Preview) return;
 const button = document.querySelector('#lab-open-avatar'), result = document.querySelector('#ai-result');
 if (!button || !result || button.dataset.naturalBridge) return;
 button.dataset.naturalBridge = 'true';
 const I = window.A1I18n, T = window.A1LabTemplates;
 I.register({
  '분석 후 개선된 3D 아바타 보기': 'View the improved 3D avatar after analysis',
  '두 분석 비율을 이 화면의 참고값으로 표시하는 데 동의합니다. 현재 GLB 형상에는 적용하지 않습니다.': 'I agree to display the two analysis ratios as references on this screen. They are not applied to the current GLB shape.',
  '비율 참고 표시에는 별도 동의가 필요합니다. 사진 없이 기본 3D 샘플도 열 수 있습니다.': 'Displaying ratio references needs separate consent. You can also open the default 3D sample without a photo.',
  '사진 없이 개선된 3D 샘플 보기': 'View the improved 3D sample without a photo',
  '동의한 사진 분석 참고값 · 3D 형상에는 미적용': 'Consented photo references · not applied to the 3D shape',
  '어깨 / 골반 참고 비율': 'Shoulder / hip reference ratio',
  '다리 / 몸통 참고 비율': 'Leg / torso reference ratio',
  '현재 모델에는 이 비율의 검증된 체형 변형이 없습니다. 실제 신체 치수나 같은 사람의 3D 복원이 아닙니다.': 'This model has no validated body deformation for these ratios. They are not body measurements or a 3D reconstruction of the same person.',
  '내 사진으로 피팅하기 · 로컬 2D': 'Fit on my photo · local 2D',
  '사진 선택·분석으로 돌아가기': 'Return to photo selection and analysis',
  '이 스타일을 국내 쇼핑몰에서 검색': 'Search this style at Korean retailers',
  '기존 사진과 권한 있는 의류 이미지를 이 페이지 안에서 사용합니다. 사진 사용 동의는 2D 화면에서 별도로 선택하세요.': 'Use the existing photo and an authorized garment image on this page. Separately consent to photo use in the 2D view.',
  '3D는 원본 샘플 의상 한 벌입니다. 선택한 의류 사진은 2D로만 배치하며 AI 자연 합성이나 실제 상품 3D 착용이 아닙니다.': 'The 3D sample has one original outfit. Selected garment photos are overlaid only in 2D; this is not AI synthesis or retail 3D try-on.',
  '기존 2D 피팅을 열지 못했습니다. 다시 누르거나 사진 분석 화면의 2D 피팅 버튼을 이용하세요.': 'The existing 2D fitting view could not open. Retry or use the 2D fitting button beside the analysis.',
  '기본 샘플을 표시합니다. 분석 비율 참고값은 표시하지 않습니다.': 'Displaying the default sample without analysis ratio references.',
  '분석 비율을 참고값으로만 표시합니다. 3D 형상은 기본 샘플과 같습니다.': 'Analysis ratios are shown only as references. The 3D shape remains the default sample.',
  '개선된 3D 샘플을 준비하고 있습니다.': 'Preparing the improved 3D sample.',
  '3D 모델을 표시하지 못했습니다. 3D 화면의 안내로 재시도하거나 로컬 2D 피팅을 이용하세요.': 'The 3D model could not be displayed. Follow its recovery instructions or use local 2D fitting.',
  '연구실 실행 코드를 받지 못했습니다. 새로고침해주세요. [A1-LAB-SCRIPT]': 'The lab code did not load. Reload this page. [A1-LAB-SCRIPT]'
 });
 I.setText(button, '분석 후 개선된 3D 아바타 보기');
 const label = document.createElement('label'); label.className = 'avatar-reference-consent';
 const consent = document.createElement('input'); consent.type = 'checkbox'; consent.id = 'avatar-reference-consent';
 const copy = document.createElement('span'); I.setText(copy, '두 분석 비율을 이 화면의 참고값으로 표시하는 데 동의합니다. 현재 GLB 형상에는 적용하지 않습니다.');
 label.append(consent, copy); button.before(label);
 const status = document.createElement('p'); status.id = 'avatar-bridge-status'; status.setAttribute('role', 'status'); button.after(status);
 const fallback = document.createElement('button'); fallback.id = 'avatar-open-default'; fallback.type = 'button'; fallback.className = 'dark-button';
 I.setText(fallback, '사진 없이 개선된 3D 샘플 보기'); document.querySelector('#ai-form').append(fallback);
 const defaultStatus = document.createElement('p'); defaultStatus.id = 'avatar-default-status'; defaultStatus.setAttribute('role', 'status'); fallback.after(defaultStatus);
 let metrics = null, pending = null, revision = 0, navigation = 0, activeRequest = null, viewerObserver = null;
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
  clearReference(); if (!reference || !use || !consent.checked || !valid(metrics)) return;
  const title = document.createElement('strong'); I.setText(title, '동의한 사진 분석 참고값 · 3D 형상에는 미적용');
  const list = document.createElement('dl');
  for (const [name,key] of [['어깨 / 골반 참고 비율','shoulderHipRatio'],['다리 / 몸통 참고 비율','legTorsoRatio']]) {
   const dt = document.createElement('dt'), dd = document.createElement('dd'); I.setText(dt, name); dd.textContent = metrics[key].toFixed(2); list.append(dt,dd);
  }
  const note = document.createElement('p'); I.setText(note, '현재 모델에는 이 비율의 검증된 체형 변형이 없습니다. 실제 신체 치수나 같은 사람의 3D 복원이 아닙니다.');
  reference.append(title,list,note); reference.hidden = false;
 }
 async function fitting() {
  try {
   viewerObserver?.disconnect();
   // Close the tall 3D panel before revealing the following photo controls so
   // a layout shift cannot scroll the selected 2D view out of the viewport.
   if (window.A1FittingStudio3D) await window.A1FittingStudio3D.close();
   else { const panel = document.querySelector('#studio-3d-panel'); if (panel) panel.hidden = true; signal('a1:gltf-suspend'); }
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
  const limits = document.createElement('p'); I.setText(limits, '3D는 원본 샘플 의상 한 벌입니다. 선택한 의류 사진은 2D로만 배치하며 AI 자연 합성이나 실제 상품 3D 착용이 아닙니다.');
  flow.append(next,back,search,note,limits); root.querySelector('.workspace').after(flow);
 }
 async function ensureViewer() {
  if (window.A1FittingStudio3D) { await window.A1FittingStudio3D.open(); return document.querySelector('#gltf-proof-root'); }
  let root = document.querySelector('#gltf-proof-root');
  if (!root) {
   const template = await T.load('natural');
   if (!activeRequest) throw Object.assign(Error('cancelled'),{code:'CANCELLED'});
   root = document.querySelector('#gltf-proof-root');
   if (!root) {
    const panel = document.createElement('section'); panel.id = 'studio-3d-panel'; panel.className = 'section'; panel.hidden = true;
    root = document.importNode(template,true); panel.append(root); document.querySelector('#ai-studio').after(panel);
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
   I.setText(status, '비율 참고 표시에는 별도 동의가 필요합니다. 사진 없이 기본 3D 샘플도 열 수 있습니다.'); reveal(label); return;
  }
  I.setText(target, '개선된 3D 샘플을 준비하고 있습니다.');
  activeRequest = {useReference};
  try {
   if (!pending) pending = ensureViewer().finally(() => { pending = null; });
   const root = await pending;
   if (token !== navigation || current !== revision || useReference && (!consent.checked || result.hidden)) {
    if (!activeRequest || token === navigation) signal('a1:gltf-suspend'); return;
   }
   actions(root);
   const look = root.querySelector('#gltf-look');
   const needsNatural = look.value !== 'natural' || window.A1GltfProof?.snapshot().look !== 'natural';
   // The legacy renderer/assets are preserved in their standalone page. Never
   // silently fall back to them on the primary post-analysis route.
   for (const option of [...look.options]) if (option.value !== 'natural') option.remove();
   look.value = 'natural'; if (needsNatural) look.dispatchEvent(new Event('change'));
   root.hidden = false; document.querySelector('#studio-3d-panel').hidden = false;
   signal('a1:gltf-resume'); reference(useReference);
   const syncStatus = () => {
    if (root.dataset.loadState === 'ready') I.setText(target, useReference && consent.checked ? '분석 비율을 참고값으로만 표시합니다. 3D 형상은 기본 샘플과 같습니다.' : '기본 샘플을 표시합니다. 분석 비율 참고값은 표시하지 않습니다.');
    else if (root.dataset.loadState === 'error') I.setText(target, '3D 모델을 표시하지 못했습니다. 3D 화면의 안내로 재시도하거나 로컬 2D 피팅을 이용하세요.');
    else if (root.dataset.loadState === 'loading') I.setText(target, '개선된 3D 샘플을 준비하고 있습니다.');
   };
   viewerObserver?.disconnect(); viewerObserver = new MutationObserver(syncStatus);
   viewerObserver.observe(root, {attributes:true,attributeFilter:['data-load-state']}); syncStatus();
   reveal(root.querySelector('.workspace'));
  } catch (error) { if (token === navigation && current === revision) T.failure('natural',target,error,() => open(useReference)); }
 }
 button.addEventListener('click', () => open(true)); fallback.addEventListener('click', () => open(false));
 // A fictional garment has no mesh for this GLB. Keep its 2D path available,
 // but do not reinterpret it as a compatible 3D garment.
 document.addEventListener('click', event => { const link = event.target.closest('[data-avatar-garment]'); if (!link) return; event.preventDefault(); open(Boolean(consent.checked && metrics)); });
 consent.addEventListener('change', () => { if (!consent.checked) { revision++; clearReference(); if (pending && activeRequest?.useReference) activeRequest = null; } });
 function clear() {
  revision++; navigation++; activeRequest = null; metrics = null; consent.checked = false; clearReference();
  viewerObserver?.disconnect();
  if (T) { T.hideFailure(status); T.hideFailure(defaultStatus); }
  if (window.A1FittingStudio3D) window.A1FittingStudio3D.close();
  else { const panel = document.querySelector('#studio-3d-panel'); if (panel) panel.hidden = true; }
  signal('a1:gltf-suspend');
 }
 document.addEventListener('a1:analysis-ready', event => { clear(); if (valid(event.detail?.metrics)) metrics = {...event.detail.metrics}; });
 document.addEventListener('a1:analysis-cleared', clear); window.addEventListener('pagehide', clear);
})();
