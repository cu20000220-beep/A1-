import * as THREE from './vendor/three-0.187.0/build/three.module.js';
import { GLTFLoader } from './vendor/three-0.187.0/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from './vendor/three-0.187.0/examples/jsm/controls/OrbitControls.js';
import { createHumanoidMaterial } from './humanoid-surface.js';
import { applyNaturalProfile, useEmbeddedImageElements } from './natural-avatar-profile.js';
import { createNaturalFit } from './natural-avatar-fit.js';
import { identifyNaturalTop, setNaturalTopColor } from './natural-avatar-outfit.js';
import { createNovaTopPalette, lightNovaStage } from './nova-avatar-studio.js';

// Renders reviewed meshes. Consented proportions are temporary and stay on-device.
const root = document.querySelector('#gltf-proof-root');
const I = window.A1I18n;
const pairs = {
  '이 기술 검증은 격리된 Preview에서만 제공됩니다.': 'This technical proof is available only in an isolated Preview.',
  '무료 베타 · 독립 렌더링 검사': 'Free beta · Independent rendering proof',
  '무료 베타 · SF 아바타 스타일': 'Free beta · Sci-fi avatar style',
  '무료 베타 · 내추럴 3D 인체': 'Free beta · Natural 3D human',
  '내추럴 3D 피팅룸': 'Natural 3D fitting room',
  '전신을 돌려 의상의 실루엣을 보고, 확대해 옷감의 질감을 확인하세요.': 'Rotate the avatar to see the outfit silhouette, and zoom in to inspect the fabric.',
  '기본 체형의 3D 피팅 예시입니다. 정확한 의류 사이즈와 착용감은 판매처에서 확인하세요.': 'This sample shows 3D fitting on a default body. Check actual sizing and fit with the retailer.',
  '내추럴 인체 샘플': 'Natural human sample', '샘플 의상': 'Sample outfit', '원본 샘플 의상': 'Original sample outfit',
  '현재 인체 샘플에는 원본 의상 한 벌을 표시합니다. 교체 가능한 실제 의류 모델은 준비 중입니다. 기존 비교 모델에서는 예시 티셔츠 3종을 이용할 수 있습니다.': 'This human sample displays its original outfit. Interchangeable retail garment models are being prepared. The original comparison body still supports three example T-shirts.',
  '3D 피팅 예시를 열었습니다. 회전하고 확대해 의상의 실루엣과 소재를 확인하세요.': 'The 3D fitting sample is ready. Rotate and zoom to inspect the silhouette and fabric.',
  '기본 인체: MetaPerson 공식 샘플 · BSD-3-Clause. 기존 비교 인체: MakeHuman hm08 · CC0. Three.js · MIT.': 'Default human: official MetaPerson sample · BSD-3-Clause. Original comparison body: MakeHuman hm08 · CC0. Three.js · MIT.',
  '내추럴 비교 인체는 MetaPerson 공식 샘플(BSD-3-Clause)입니다. 기존 비교 인체는 MakeHuman hm08(CC0)이며, 렌더러는 Three.js(MIT)입니다.': 'The natural comparison body is the official MetaPerson sample (BSD-3-Clause). The original comparison body is MakeHuman hm08 (CC0), rendered with Three.js (MIT).',
  '내추럴 인체 출처와 이용 조건': 'Natural human source and license',
  '3D 예시 상의': 'Sample 3D tops',
  '실사형 스튜디오 아바타': 'Studio 3D avatar',
  '상의 핏 자세히 보기': 'Inspect top fit',
  '전신 보기로 돌아가기': 'Return to full body',
  '상의 · 네이비': 'Top · Navy',
  '상의 · 테라코타': 'Top · Terracotta',
  '여유핏 상의': 'Relaxed top',
  '법선을 보정하고 자세·조명과 체형·예시 상의를 조정했습니다.': 'Normals repaired; posing, lighting, body proportions and sample clothing adjusted.',
  '기본 티셔츠 · 네이비': 'Regular tee · Navy',
  '기본 티셔츠 · 테라코타': 'Regular tee · Terracotta',
  '여유 있는 티셔츠 · 화이트': 'Relaxed tee · White',
  '예시 상의의 색상과 여유분을 바꿔 입혀볼 수 있습니다.': 'Try sample tops with different colors and silhouettes.',
  '사진의 비율을 반영한 3D 아바타입니다. 회전해서 예시 의상의 핏을 비교하세요.': 'The 3D avatar reflects your photo proportions. Rotate it to compare the sample fits.',
  '선택한 신체 비율을 반영한 가상 모델입니다. 회전해서 예시 의상의 핏을 비교하세요.': 'The virtual model uses the selected body proportions. Rotate it to compare sample garments.',
  '3D에 비율을 적용하지 못해 기본 아바타를 표시합니다.': 'The proportions could not be applied. The default avatar is displayed.',
  'SF 휴머노이드 피팅룸': 'Sci-fi humanoid fitting room',
  '붉은 합성 피부와 청록·금색 금속 패널을 가진 자체 디자인 아바타입니다. 전신을 회전하고 예시 티셔츠를 갈아입혀 보세요. 기존 인체 모델과도 비교할 수 있습니다.': 'An original avatar with red synthetic skin and teal-and-gold metallic panels. Rotate the body, try example T-shirts, and compare it with the original body.',
  '아바타 모습': 'Avatar appearance', 'SF 휴머노이드': 'Sci-fi humanoid', '기존 인체와 비교': 'Compare original body', '기본 아바타 · 티셔츠 없음': 'Base avatar · No T-shirt',
  '실사 스타일 이미지 스튜디오': 'Photoreal style image studio',
  '전신·의류 렌더링 검증': 'Full-body and garment rendering proof',
  '기존 CC0 전신과 예시 티셔츠를 새 glTF 렌더러로 표시합니다. 새 실사형 디지털 휴먼이나 실제 상품 피팅이 완성된 화면은 아닙니다.': 'The new glTF renderer displays the existing CC0 body and example T-shirts. This is not a completed photoreal digital human or retail product fitting.',
  '사진·체형 분석값을 읽거나 전송하지 않습니다. 티셔츠는 실제 판매 상품이 아닌 예시 3D 착용 이미지입니다. 정확한 사이즈·착용감·의복 물리 시뮬레이션을 보장하지 않습니다.': 'No photos or body analysis values are read or transmitted. These are example 3D garments, not retail products. Exact sizing, comfort and cloth physics are not guaranteed.',
  '3D 전신 화면': '3D full-body view', '회전 가능한 예시 3D 전신과 티셔츠': 'Rotatable example 3D body and T-shirt',
  '렌더링 조작': 'Rendering controls', '한 손가락으로 회전 · 두 손가락으로 확대·축소': 'Rotate with one finger · Pinch with two fingers to zoom',
  '예시 티셔츠': 'Example T-shirt', '기본 · 블루': 'Regular · Blue', '여유형 · 테라코타': 'Relaxed · Terracotta', '짧은형 · 그린': 'Cropped · Green',
  '착용 전과 비교': 'Compare before dressing', '정면': 'Front', '측면': 'Side', '후면': 'Back', '왼쪽 회전': 'Rotate left', '오른쪽 회전': 'Rotate right', '확대': 'Zoom in', '축소': 'Zoom out',
  '재질 비교': 'Compare materials', '조명·거칠기 적용': 'Lighting and roughness', '기본 색상과 비교': 'Compare basic colors', '골격 변형 비교': 'Compare skeletal deformation',
  '골격 변형은 glTF 스키닝 동작 검사입니다. 사용자 체형 복원이나 의류 핏 예측이 아닙니다.': 'Skeletal deformation checks glTF skinning. It is not user body reconstruction or a clothing fit prediction.',
  '로컬 전신 파일을 준비하고 있습니다.': 'Preparing the local full-body asset.',
  '전신·예시 티셔츠를 표시했습니다. 회전과 의류 변경을 확인할 수 있습니다.': 'The full body and example T-shirt are displayed. Try rotating and changing garments.',
  'WebGL 2를 사용할 수 없습니다. Safari를 업데이트하거나 기존 3D 체험으로 돌아가세요.': 'WebGL 2 is unavailable. Update Safari or return to the existing 3D experience.',
  '전신 모델 파일을 읽지 못했습니다. 연결을 확인한 뒤 다시 불러오기를 누르세요.': 'The full-body model could not load. Check the connection and choose Reload.',
  '모델 파일 검증에 실패했습니다. 기존 3D 체험을 이용하고 운영자에게 알려주세요.': 'Model validation failed. Use the existing 3D experience and report this issue.',
  '그래픽 컨텍스트가 중단되었습니다. 다른 탭을 닫고 다시 불러오기를 누르세요.': 'The graphics context was lost. Close other tabs and choose Reload.',
  '3D 렌더러를 시작하지 못했습니다. 기존 3D 체험을 이용하거나 다시 불러오세요.': 'The 3D renderer could not start. Use the existing 3D experience or reload.',
  '임시 3D 화면을 지웠습니다. 다시 불러오기로 재시작할 수 있습니다.': 'The temporary 3D view was cleared. Choose Reload to restart.',
  '임시 3D 화면 지우기': 'Clear temporary 3D view', '다시 불러오기': 'Reload',
  'WebGL 2가 필요합니다. 표시되지 않으면 기존 WebGL 1 체험을 이용할 수 있습니다.': 'WebGL 2 is required. If unavailable, use the existing WebGL 1 experience.',
  '기존 3D 체험으로 돌아가기': 'Return to the existing 3D experience',
  '전신 자료: MakeHuman hm08 · CC0. 의류: 기존 A1 연결형 예시 메시. Three.js · MIT.': 'Body: MakeHuman hm08 · CC0. Garments: existing A1 connected example meshes. Three.js · MIT.',
  '모델 출처와 이용 조건': 'Model sources and license', '렌더러 라이선스': 'Renderer license', '국내 의류 검색': 'Korean clothing search', '무료 규칙 기반 스타일리스트': 'Free rule-based stylist'
};
I.register(pairs);

if (window.A1Preview && /^[a-z0-9-]+\.a1fashion\.pages\.dev$/.test(location.hostname.toLowerCase())) {
  root.hidden = false;
  const unavailable = document.querySelector('#gltf-unavailable');
  if (unavailable) unavailable.hidden = true;
  startProof();
}

function startProof() {
  const $ = selector => document.querySelector(selector);
  let renderer, scene, camera, controls, model, observer, controller, naturalRig;
  let requestedFit=null, requestedProfile=null, requestedSample='source';
  let fitted=null, topVertices=null, novaPalette=null, portrait=false, fullView=null;
  const naturalStyles={navy:'기본 티셔츠 · 네이비',terracotta:'기본 티셔츠 · 테라코타',relaxed:'여유 있는 티셔츠 · 화이트'};
  const garmentSelect=$('#gltf-garment'), naturalNote=$('#natural-avatar-note');
  const naturalNotice=root.querySelector('.notice');
  const defaultNotice='기본 체형의 3D 피팅 예시입니다. 정확한 의류 사이즈와 착용감은 판매처에서 확인하세요.';
  const defaultGarmentNote='현재 인체 샘플에는 원본 의상 한 벌을 표시합니다. 교체 가능한 실제 의류 모델은 준비 중입니다. 기존 비교 모델에서는 예시 티셔츠 3종을 이용할 수 있습니다.';
  for(const [id,label] of Object.entries(naturalStyles)){
    const option=document.createElement('option');option.value=id;I.setText(option,label);garmentSelect.append(option);
  }
  let state = 'loading', generation = 0, renderCount = 0, disposed = false;
  let materials = new Map(), frameSamples = [], lastMemory = { geometries: 0, textures: 0 };
  const portraitButton=document.createElement('button');
  portraitButton.type='button';portraitButton.id='gltf-portrait';portraitButton.hidden=true;
  portraitButton.setAttribute('aria-pressed','false');
  I.setText(portraitButton,'상의 핏 자세히 보기');$('#gltf-zoom-in').parentElement.after(portraitButton);
  const credit=document.createElement('p');credit.id='gltf-nova-credit';credit.hidden=true;
  const creator=document.createElement('a'), license=document.createElement('a');
  creator.href='https://vtubeme.com/';creator.textContent='Nova by VTubeMe';
  license.href='https://creativecommons.org/licenses/by/4.0/';license.textContent='CC BY 4.0';
  creator.referrerPolicy=license.referrerPolicy='no-referrer';
  const modifications=document.createElement('span');
  I.setText(modifications,'법선을 보정하고 자세·조명과 체형·예시 상의를 조정했습니다.');
  credit.append(creator,' · ',license,' · ',modifications);root.querySelector('footer')?.prepend(credit);
  const controlsElements = [...root.querySelectorAll('button:not(#gltf-retry),select,input')];
  const textured = () => look === 'natural' || look === 'nova';
  let drawCalls = 0, triangles = 0, skinPose = false, garment = 'source', materialMode = 'standard', look = 'natural';
  const shirts = { 'LAB-A': 'ExampleTshirtA', 'LAB-B': 'ExampleTshirtB', 'LAB-C': 'ExampleTshirtC' };
  function status(message) { I.setText($('#gltf-status'), message); I.setText($('#gltf-canvas-state'), message); }
  function setState(value) { state = value; root.dataset.loadState = value; $('#gltf-canvas-state').hidden = value === 'ready'; controlsElements.forEach(el => { el.disabled = value !== 'ready'; }); }
  function capabilities() {
    const natural = textured(), styles = Boolean(natural && fitted && topVertices);
    portraitButton.hidden=credit.hidden=look!=='nova';
    portraitButton.disabled=state!=='ready';
    const novaStyleLabels = {navy:'상의 · 네이비',terracotta:'상의 · 테라코타',relaxed:'여유핏 상의'};
    for (const option of garmentSelect.options) {
      if (Object.hasOwn(naturalStyles, option.value)) I.setText(option, look==='nova' ? novaStyleLabels[option.value] : naturalStyles[option.value]);
    }
    garmentSelect.disabled = state !== 'ready' || natural && !styles;
    $('#gltf-skin-proof').disabled = state !== 'ready' || Boolean(fitted);
    naturalNote.hidden = !natural;
    I.setText(naturalNote, styles ? '예시 상의의 색상과 여유분을 바꿔 입혀볼 수 있습니다.' : defaultGarmentNote);
    I.setText($('#gltf-garment-title'), styles ? '3D 예시 상의' : natural ? '샘플 의상' : '예시 티셔츠');
    naturalNotice.hidden = Boolean(fitted);
    if (!fitted) I.setText(naturalNotice, defaultNotice);
    for (const option of garmentSelect.options) {
      const style = Object.hasOwn(naturalStyles, option.value);
      option.hidden = style ? !styles : natural ? option.value !== 'source' : option.value === 'source';
    }
  }
  function render() {
    if (!renderer || !scene || !camera || disposed) return;
    const start = performance.now();
    renderer.render(scene, camera);
    frameSamples.push(performance.now() - start); if (frameSamples.length > 120) frameSamples.shift();
    renderCount++; drawCalls = renderer.info.render.calls; triangles = renderer.info.render.triangles;
    lastMemory = { ...renderer.info.memory };
  }
  function clean() {
    disposed = true;
    releaseFit(); topVertices=null; novaPalette=null; root.dataset.bodyFit='off';
    controller?.abort(); observer?.disconnect(); controls?.dispose();
    const geometries = new Set(), ownedMaterials = new Set(), textures = new Set(), skeletons = new Set();
    scene?.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.skeleton) skeletons.add(object.skeleton);
      object.shadow?.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) if (material) ownedMaterials.add(material);
    });
    for (const pair of materials.values()) { for (const material of Object.values(pair)) ownedMaterials.add(material); }
    for (const material of ownedMaterials) for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    skeletons.forEach(skeleton => skeleton.dispose()); textures.forEach(texture => { texture.dispose(); texture.source?.data?.close?.(); });
    geometries.forEach(geometry => geometry.dispose()); ownedMaterials.forEach(material => material.dispose());
    if (renderer) { try { renderer.clear(); renderer.dispose(); lastMemory = { ...renderer.info.memory }; renderer.forceContextLoss(); } catch { /* A lost context is already unavailable. */ } }
    renderer = scene = camera = controls = model = observer = naturalRig = null; materials.clear();
    drawCalls = triangles = 0;
  }
  function failed(code) {
    clean(); setState('error');
    const messages = {
      webgl2_unavailable: 'WebGL 2를 사용할 수 없습니다. Safari를 업데이트하거나 기존 3D 체험으로 돌아가세요.',
      asset_network: '전신 모델 파일을 읽지 못했습니다. 연결을 확인한 뒤 다시 불러오기를 누르세요.',
      asset_invalid: '모델 파일 검증에 실패했습니다. 기존 3D 체험을 이용하고 운영자에게 알려주세요.',
      context_lost: '그래픽 컨텍스트가 중단되었습니다. 다른 탭을 닫고 다시 불러오기를 누르세요.'
    };
    status(messages[code] || '3D 렌더러를 시작하지 못했습니다. 기존 3D 체험을 이용하거나 다시 불러오세요.');
  }
  async function approvedAsset(signal) {
    const asset = look === 'nova' ? {base:'nova-avatar',file:'avatar.glb',license:'CC-BY-4.0',limit:8} :
      look === 'natural' ? {base:'natural-avatar',file:'sample.glb',license:'BSD-3-Clause',limit:12} :
        {base:'gltf-proof',file:'avatar.glb',license:'CC0-1.0',limit:4};
    let manifest, bytes;
    try {
      const base = 'assets/' + asset.base + '/';
      const record = await fetch(base + 'asset-manifest.json', { credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', signal });
      if (!record.ok) throw Error(); manifest = await record.json();
      const response = await fetch(base + asset.file, { credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', signal });
      if (!response.ok) throw Error(); bytes = await response.arrayBuffer();
    } catch (error) { if (signal.aborted) throw error; throw Error('asset_network'); }
    // This is a fixed reviewed, self-contained local package; arbitrary URLs,
    // uploaded files and personal data are deliberately not accepted here.
    try {
      if (manifest.license?.id !== asset.license || !manifest.license.publicWebDelivery || manifest.model?.path !== asset.file ||
          bytes.byteLength !== manifest.model.bytes || bytes.byteLength > asset.limit * 1024 * 1024 || !crypto.subtle) throw Error();
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
      if (hash !== manifest.model.sha256) throw Error();
      const view = new DataView(bytes);
      if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== bytes.byteLength ||
          view.getUint32(16, true) !== 0x4e4f534a || view.getUint32(12, true) > 256 * 1024) throw Error();
      const data = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 20, view.getUint32(12, true))));
      const stack = [data]; let objects = 0;
      while (stack.length) { const value = stack.pop(); if (++objects > 20000) throw Error(); if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) { if (key.toLowerCase() === 'uri') throw Error(); if (child && typeof child === 'object') stack.push(child); } }
      if (data.asset?.version !== '2.0' || data.extensionsRequired?.length) throw Error();
    } catch { throw Error('asset_invalid'); }
    return bytes;
  }
  function releaseFit() {
    if (!fitted) return;
    for (const {source} of fitted.parts) source.visible=true;
    fitted.dispose();
    fitted=null;
  }
  function updateFit() {
    releaseFit();
    if (!model || !textured()) return;
    const nova=look==='nova', outfit=model.getObjectByName(nova ? 'outfit_top' : 'outfit');
    const pair=materials.get(outfit);
    const color = choice => {
      if (novaPalette) novaPalette(choice);
      else if (topVertices) setNaturalTopColor(outfit.geometry, pair, topVertices, choice);
    };
    root.dataset.bodyFit='off';
    const profile=nova ? requestedProfile : null;
    if (!requestedFit && !profile) {
      color('source');
      garment = garmentSelect.value = 'source';
      return;
    }
    try {
      if (!topVertices) topVertices = nova ? new Uint8Array(outfit.geometry.getAttribute('position').count).fill(1) : identifyNaturalTop(outfit.geometry);
      const choice = topVertices && Object.hasOwn(naturalStyles, garmentSelect.value) ? garmentSelect.value : 'source';
      color(choice === 'relaxed' ? 'source' : choice);
      if (skinPose) {
        skinPose=false; $('#gltf-skin-proof').checked=false;
        naturalRig.spine.quaternion.copy(naturalRig.spineNeutralQuaternion);
      }
      fitted = createNaturalFit(model, requestedFit, {topVertices, relaxed:choice === 'relaxed',profile});
      if (!fitted) throw Error('photo_fit_unavailable');
      for (const {source} of fitted.parts) source.visible=false;
      scene.add(fitted.group);
      garment=garmentSelect.value=choice;
      root.dataset.bodyFit='applied';
    } catch {
      releaseFit();
      color('source');
      garment=garmentSelect.value='source';
      root.dataset.bodyFit='unavailable';
    }
  }
  function naturalStatus() {
    if (fitted && requestedProfile && look==='nova') return '선택한 신체 비율을 반영한 가상 모델입니다. 회전해서 예시 의상의 핏을 비교하세요.';
    if (fitted) return '사진의 비율을 반영한 3D 아바타입니다. 회전해서 예시 의상의 핏을 비교하세요.';
    if (requestedFit || requestedProfile && look==='nova') return '3D에 비율을 적용하지 못해 기본 아바타를 표시합니다.';
    return '3D 피팅 예시를 열었습니다. 회전하고 확대해 의상의 실루엣과 소재를 확인하세요.';
  }
  function setBodyFit(metrics,{profile,sample}={}) {
    const valid=metrics && Number.isFinite(metrics.shoulderHipRatio) && metrics.shoulderHipRatio>=.45 && metrics.shoulderHipRatio<=2.5
      && Number.isFinite(metrics.legTorsoRatio) && metrics.legTorsoRatio>=.6 && metrics.legTorsoRatio<=3.5;
    const next=valid ? {shoulderHipRatio:metrics.shoulderHipRatio,legTorsoRatio:metrics.legTorsoRatio} : null;
    let nextProfile=null;
    try {
      const checked=profile&&window.A1ProportionProfile?.validate(profile);
      if(checked&&Object.keys(checked).length)nextProfile=checked;
    } catch { /* Invalid or incomplete input keeps the available photo reference. */ }
    const nextSample=next||nextProfile ? (Object.hasOwn(naturalStyles,sample)||sample==='source' ? sample : requestedSample) : 'source';
    if (next?.shoulderHipRatio===requestedFit?.shoulderHipRatio && next?.legTorsoRatio===requestedFit?.legTorsoRatio &&
        JSON.stringify(nextProfile)===JSON.stringify(requestedProfile) && nextSample===requestedSample) return;
    requestedFit=next;
    requestedProfile=nextProfile;
    requestedSample=nextSample;
    if (textured()) garmentSelect.value=nextSample;
    if (state==='ready' && textured()) updateGarment();
  }
  function updateGarment() {
    if (textured()) {
      updateFit();
      capabilities();
      if (state==='ready') status(naturalStatus());
      render();
      return;
    }
    garment = $('#gltf-garment').value;
    for (const [id, name] of Object.entries(shirts)) model.getObjectByName(name).visible = garment === id;
    render();
  }
  function updateMaterial() {
    materialMode = $('#gltf-material').value;
    for (const [mesh, pair] of materials) mesh.material = mesh.name === 'Body' && look === 'humanoid'
      ? pair[materialMode === 'basic' ? 'humanoidBasic' : 'humanoid'] : pair[materialMode];
    if (fitted) for (const {source,mesh} of fitted.parts) mesh.material=source.material;
    render();
  }
  function view(yaw) {
    const distance = camera.position.distanceTo(controls.target);
    camera.position.set(Math.sin(yaw) * distance, controls.target.y, Math.cos(yaw) * distance);
    controls.update(); render();
  }
  portraitButton.addEventListener('click', () => {
    if (state!=='ready' || look!=='nova') return;
    portrait=!portrait;
    portraitButton.setAttribute('aria-pressed',String(portrait));
    I.setText(portraitButton,portrait?'전신 보기로 돌아가기':'상의 핏 자세히 보기');
    if (portrait) {
      fullView={position:camera.position.clone(),target:controls.target.clone(),minDistance:controls.minDistance};
      const yaw=Math.atan2(camera.position.x-controls.target.x,camera.position.z-controls.target.z);
      controls.target.y=1.14;
      controls.minDistance=.80;
      const distance=1.18;
      camera.position.set(Math.sin(yaw)*distance,controls.target.y,Math.cos(yaw)*distance);
    } else {
      camera.position.copy(fullView.position);
      controls.target.copy(fullView.target);
      controls.minDistance=fullView.minDistance;
      fullView=null;
    }
    controls.update();render();
  });
  function zoom(factor) { camera.position.sub(controls.target).multiplyScalar(factor).clampLength(controls.minDistance, controls.maxDistance).add(controls.target); controls.update(); render(); }
  async function initialize() {
    const token = ++generation; clean(); disposed = false; setState('loading');
    look = ['nova','natural','reference','humanoid'].includes($('#gltf-look').value) ? $('#gltf-look').value : 'natural';
    frameSamples = []; renderCount = 0; skinPose = false; garment = textured() ? requestedSample : 'none'; materialMode = 'standard';
    portrait=false;fullView=null;portraitButton.setAttribute('aria-pressed','false');I.setText(portraitButton,'상의 핏 자세히 보기');
    $('#gltf-garment').value = garment; $('#gltf-material').value = materialMode; $('#gltf-skin-proof').checked = false;
    $('#gltf-look').value = look;
    capabilities();
    status('로컬 전신 파일을 준비하고 있습니다.');
    const old = $('#gltf-canvas'), canvas = old.cloneNode(false); old.replaceWith(canvas);
    controller = new AbortController(); const signal = controller.signal;
    let timer = setTimeout(() => { if (token === generation && state === 'loading') failed('asset_network'); }, 15000);
    try {
      const context = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'low-power' });
      if (!context) throw Error('webgl2_unavailable');
      renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true });
      renderer.debug.onShaderError = () => queueMicrotask(() => { if (!disposed && token === generation) failed('renderer_start'); });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.18;
      scene = new THREE.Scene(); scene.background = new THREE.Color('#e9e9e1');
      camera = new THREE.PerspectiveCamera(34, 1, 0.05, 25); camera.position.set(look==='nova'?.38:0, 0.9, look==='nova'?3.28:3.7);
      controls = new OrbitControls(camera, canvas); controls.target.set(0, 0.85, 0);
      controls.enablePan = false; controls.enableDamping = false; controls.minDistance = 1.5; controls.maxDistance = 5;
      controls.minPolarAngle = 0.3; controls.maxPolarAngle = Math.PI * 0.65;
      controls.touches.ONE = THREE.TOUCH.ROTATE; controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
      controls.addEventListener('change', render); controls.listenToKeyEvents(canvas);
      if (look==='nova') lightNovaStage(renderer,scene);
      else {
        scene.add(new THREE.HemisphereLight('#fff9ef', '#536455', 2.3));
        for (const [color, intensity, position] of [['#fff3dd', 3.2, [2.4, 3.4, 3]], ['#dfecff', 1.6, [-2, 1.8, 1]], ['#ffffff', 2.3, [0, 2.6, -3]]]) {
          const light = new THREE.DirectionalLight(color, intensity); light.position.set(...position); scene.add(light);
        }
        const floor = new THREE.Mesh(new THREE.CircleGeometry(1.3, 64), new THREE.MeshStandardMaterial({ color: '#d7dbcf', roughness: 1 }));
        floor.rotation.x = -Math.PI / 2; floor.position.y = -0.005; scene.add(floor);
      }
      canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); if (!disposed && token === generation) failed('context_lost'); });
      const bytes = await approvedAsset(signal);
      if (token !== generation || signal.aborted) return;
      const manager = new THREE.LoadingManager(); manager.setURLModifier(url => {
        // URI preflight forbids every external reference. These are only Blob
        // URLs made from the already verified embedded images by GLTFLoader.
        if (textured() && url.startsWith('blob:' + location.origin + '/')) return url;
        throw Error('asset_invalid');
      });
      const loader = new GLTFLoader(manager);
      // Image elements use the existing img-src blob: policy. Fetching Blob
      // images via ImageBitmapLoader would require relaxing connect-src.
      if (textured()) useEmbeddedImageElements(loader, manager);
      const gltf = await loader.parseAsync(bytes, '');
      if (token !== generation || signal.aborted) { gltf.scene.traverse(mesh => { mesh.geometry?.dispose(); mesh.material?.dispose?.(); mesh.skeleton?.dispose(); }); return; }
      model = gltf.scene;
      if (textured()) {
        const required=look==='nova'?['outfit_top','outfit_bottom','outfit_shoes']:['outfit'];
        if (!['AvatarHead','AvatarBody',...required].every(name=>model.getObjectByName(name)?.isSkinnedMesh)) throw Error('asset_invalid');
        naturalRig = applyNaturalProfile(model,{nova:look==='nova'});
      } else if (!model.getObjectByName('Body')?.isSkinnedMesh || !model.getObjectByName('Spine') || Object.values(shirts).some(name => !model.getObjectByName(name)?.isSkinnedMesh)) throw Error('asset_invalid');
      model.traverse(mesh => {
        if (!mesh.isMesh) return;
        const standard = mesh.material;
        const basic = new THREE.MeshBasicMaterial({ color: standard.color, side: standard.side, vertexColors: standard.vertexColors,
          map: standard.map, alphaMap: standard.alphaMap, transparent: standard.transparent, opacity: standard.opacity,
          alphaTest: standard.alphaTest, depthWrite: standard.depthWrite });
        const pair = { standard, basic };
        if (mesh.name === 'Body') { pair.humanoid = createHumanoidMaterial(standard); pair.humanoidBasic = createHumanoidMaterial(standard, { unlit: true }); }
        materials.set(mesh, pair);
        if (look==='nova') {
          mesh.castShadow=!standard.transparent;
          mesh.receiveShadow=true;
          if (mesh.name==='outfit_top') novaPalette=createNovaTopPalette(pair);
        }
      });
      scene.add(model);
      const resize = () => { if (!renderer) return; const rect = canvas.getBoundingClientRect(); renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false); camera.aspect = Math.max(1, rect.width) / Math.max(1, rect.height); camera.updateProjectionMatrix(); render(); };
      observer = new ResizeObserver(resize); observer.observe(canvas); controls.update(); updateMaterial(); updateGarment(); resize();
      setState('ready'); capabilities(); status(textured()
        ? naturalStatus()
        : '전신·예시 티셔츠를 표시했습니다. 회전과 의류 변경을 확인할 수 있습니다.');
    } catch (error) { if (token === generation && !signal.aborted) failed(error.message); }
    finally { clearTimeout(timer); }
  }
  $('#gltf-garment').addEventListener('change', () => {
    if (textured()) requestedSample=garmentSelect.value;
    updateGarment();
  });
  $('#gltf-material').addEventListener('change', updateMaterial);
  $('#gltf-look').addEventListener('change', initialize);
  $('#gltf-skin-proof').addEventListener('change', () => {
    if (fitted) return;
    skinPose = $('#gltf-skin-proof').checked;
    if (naturalRig) { naturalRig.spine.quaternion.copy(naturalRig.spineNeutralQuaternion); if (skinPose) naturalRig.spine.rotateZ(0.08); }
    else model.getObjectByName('Spine').rotation.z = skinPose ? 0.12 : 0;
    render();
  });
  for (const [name, yaw] of [['front', 0], ['side', Math.PI / 2], ['back', Math.PI]]) $('#gltf-' + name).addEventListener('click', () => view(yaw));
  $('#gltf-left').addEventListener('click', () => view(Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z) - Math.PI / 18));
  $('#gltf-right').addEventListener('click', () => view(Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z) + Math.PI / 18));
  $('#gltf-zoom-in').addEventListener('click', () => zoom(0.9)); $('#gltf-zoom-out').addEventListener('click', () => zoom(1.1));
  function suspend() {
    generation++; requestedFit=requestedProfile=null; requestedSample='source'; clean(); setState('disposed');
  }
  $('#gltf-delete').addEventListener('click', () => { suspend(); status('임시 3D 화면을 지웠습니다. 다시 불러오기로 재시작할 수 있습니다.'); });
  $('#gltf-retry').addEventListener('click', initialize);
  // The same renderer can be opened lazily inside the style studio. Hiding
  // its panel also cancels in-flight loads and releases GPU resources.
  window.addEventListener('a1:gltf-suspend', suspend);
  window.addEventListener('a1:gltf-resume', () => { if (state === 'disposed') initialize(); });
  window.addEventListener('pagehide', suspend);
  Object.defineProperty(window, 'A1GltfProof', { value: Object.freeze({ setBodyFit, snapshot() {
    let meshes = 0, skinnedMeshes = 0, bones = new Set();
    model?.traverse(object => { if (object.isMesh) meshes++; if (object.isSkinnedMesh) { skinnedMeshes++; for (const bone of object.skeleton.bones) bones.add(bone); } });
    return { state, disposed, bodyFitted:Boolean(fitted), bodyFitAxes:[...(fitted?.profile.appliedAxes||[])], meshes, skinnedMeshes, bones: bones.size, drawCalls, triangles, renderCount, garment, materialMode, skinPose, look, naturalProfile: textured(), portrait,
      viewYaw: camera ? Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z) : 0,
      frameSamples: [...frameSamples], timingScope: 'CPU render submission milliseconds; not GPU frame time or FPS',
      memoryGeometries: lastMemory.geometries, memoryTextures: lastMemory.textures };
  } }), writable: false, configurable: false });
  initialize();
}
