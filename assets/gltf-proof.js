import * as THREE from './vendor/three-0.187.0/build/three.module.js';
import { GLTFLoader } from './vendor/three-0.187.0/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from './vendor/three-0.187.0/examples/jsm/controls/OrbitControls.js';
import { createHumanoidMaterial } from './humanoid-surface.js';

// Independent renderer proof. No photo bridge, storage, APIs or arbitrary files.
const root = document.querySelector('#gltf-proof-root');
const I = window.A1I18n;
const pairs = {
  '이 기술 검증은 격리된 Preview에서만 제공됩니다.': 'This technical proof is available only in an isolated Preview.',
  '무료 베타 · 독립 렌더링 검사': 'Free beta · Independent rendering proof',
  '무료 베타 · SF 아바타 스타일': 'Free beta · Sci-fi avatar style',
  'SF 휴머노이드 피팅룸': 'Sci-fi humanoid fitting room',
  '붉은 합성 피부와 청록·금색 금속 패널을 가진 자체 디자인 아바타입니다. 전신을 회전하고 예시 티셔츠를 갈아입혀 보세요. 기존 인체 모델과도 비교할 수 있습니다.': 'An original avatar with red synthetic skin and teal-and-gold metallic panels. Rotate the body, try example T-shirts, and compare it with the original body.',
  '아바타 모습': 'Avatar appearance', 'SF 휴머노이드': 'Sci-fi humanoid', '기존 인체와 비교': 'Compare original body', '기본 아바타 · 티셔츠 없음': 'Base avatar · No T-shirt',
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
  document.querySelector('#gltf-unavailable').hidden = true;
  startProof();
}

function startProof() {
  const $ = selector => document.querySelector(selector);
  const controlsElements = [...root.querySelectorAll('button:not(#gltf-retry),select,input')];
  let renderer, scene, camera, controls, model, observer, controller;
  let state = 'loading', generation = 0, renderCount = 0, disposed = false;
  let materials = new Map(), frameSamples = [], lastMemory = { geometries: 0, textures: 0 };
  let drawCalls = 0, triangles = 0, skinPose = false, garment = 'none', materialMode = 'standard', look = 'humanoid';
  const shirts = { 'LAB-A': 'ExampleTshirtA', 'LAB-B': 'ExampleTshirtB', 'LAB-C': 'ExampleTshirtC' };
  function status(message) { I.setText($('#gltf-status'), message); I.setText($('#gltf-canvas-state'), message); }
  function setState(value) { state = value; root.dataset.loadState = value; $('#gltf-canvas-state').hidden = value === 'ready'; controlsElements.forEach(el => { el.disabled = value !== 'ready'; }); }
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
    controller?.abort(); observer?.disconnect(); controls?.dispose();
    const geometries = new Set(), ownedMaterials = new Set(), textures = new Set(), skeletons = new Set();
    scene?.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.skeleton) skeletons.add(object.skeleton);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) if (material) ownedMaterials.add(material);
    });
    for (const pair of materials.values()) { for (const material of Object.values(pair)) ownedMaterials.add(material); }
    for (const material of ownedMaterials) for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    skeletons.forEach(skeleton => skeleton.dispose()); textures.forEach(texture => { texture.dispose(); texture.source?.data?.close?.(); });
    geometries.forEach(geometry => geometry.dispose()); ownedMaterials.forEach(material => material.dispose());
    if (renderer) { try { renderer.clear(); renderer.dispose(); lastMemory = { ...renderer.info.memory }; renderer.forceContextLoss(); } catch { /* A lost context is already unavailable. */ } }
    renderer = scene = camera = controls = model = observer = null; materials.clear();
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
    let manifest, bytes;
    try {
      const record = await fetch('assets/gltf-proof/asset-manifest.json', { credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', signal });
      if (!record.ok) throw Error(); manifest = await record.json();
      const response = await fetch('assets/gltf-proof/avatar.glb', { credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', signal });
      if (!response.ok) throw Error(); bytes = await response.arrayBuffer();
    } catch (error) { if (signal.aborted) throw error; throw Error('asset_network'); }
    // This is a fixed reviewed, self-contained local package; arbitrary URLs,
    // uploaded files and personal data are deliberately not accepted here.
    try {
      if (manifest.license?.id !== 'CC0-1.0' || !manifest.license.publicWebDelivery || manifest.model?.path !== 'avatar.glb' ||
          bytes.byteLength !== manifest.model.bytes || bytes.byteLength > 4 * 1024 * 1024 || !crypto.subtle) throw Error();
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
  function updateGarment() {
    garment = $('#gltf-garment').value;
    for (const [id, name] of Object.entries(shirts)) model.getObjectByName(name).visible = garment === id;
    render();
  }
  function updateMaterial() {
    materialMode = $('#gltf-material').value;
    look = $('#gltf-look').value;
    for (const [mesh, pair] of materials) mesh.material = mesh.name === 'Body' && look === 'humanoid'
      ? pair[materialMode === 'basic' ? 'humanoidBasic' : 'humanoid'] : pair[materialMode];
    render();
  }
  function view(yaw) {
    const distance = camera.position.distanceTo(controls.target);
    camera.position.set(Math.sin(yaw) * distance, controls.target.y, Math.cos(yaw) * distance);
    controls.update(); render();
  }
  function zoom(factor) { camera.position.sub(controls.target).multiplyScalar(factor).clampLength(controls.minDistance, controls.maxDistance).add(controls.target); controls.update(); render(); }
  async function initialize() {
    const token = ++generation; clean(); disposed = false; setState('loading');
    frameSamples = []; renderCount = 0; skinPose = false; garment = 'none'; materialMode = 'standard'; look = 'humanoid';
    $('#gltf-garment').value = garment; $('#gltf-material').value = materialMode; $('#gltf-skin-proof').checked = false;
    $('#gltf-look').value = look;
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
      camera = new THREE.PerspectiveCamera(34, 1, 0.05, 25); camera.position.set(0, 0.9, 3.7);
      controls = new OrbitControls(camera, canvas); controls.target.set(0, 0.85, 0);
      controls.enablePan = false; controls.enableDamping = false; controls.minDistance = 1.5; controls.maxDistance = 5;
      controls.minPolarAngle = 0.3; controls.maxPolarAngle = Math.PI * 0.65;
      controls.touches.ONE = THREE.TOUCH.ROTATE; controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
      controls.addEventListener('change', render); controls.listenToKeyEvents(canvas);
      scene.add(new THREE.HemisphereLight('#fff9ef', '#536455', 2.3));
      for (const [color, intensity, position] of [['#fff3dd', 3.2, [2.4, 3.4, 3]], ['#dfecff', 1.6, [-2, 1.8, 1]], ['#ffffff', 2.3, [0, 2.6, -3]]]) {
        const light = new THREE.DirectionalLight(color, intensity); light.position.set(...position); scene.add(light);
      }
      const floor = new THREE.Mesh(new THREE.CircleGeometry(1.3, 64), new THREE.MeshStandardMaterial({ color: '#d7dbcf', roughness: 1 }));
      floor.rotation.x = -Math.PI / 2; floor.position.y = -0.005; scene.add(floor);
      canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); if (!disposed && token === generation) failed('context_lost'); });
      const bytes = await approvedAsset(signal);
      if (token !== generation || signal.aborted) return;
      const manager = new THREE.LoadingManager(); manager.setURLModifier(() => { throw Error('asset_invalid'); });
      const loader = new GLTFLoader(manager);
      const gltf = await loader.parseAsync(bytes, '');
      if (token !== generation || signal.aborted) { gltf.scene.traverse(mesh => { mesh.geometry?.dispose(); mesh.material?.dispose?.(); mesh.skeleton?.dispose(); }); return; }
      model = gltf.scene;
      if (!model.getObjectByName('Body')?.isSkinnedMesh || !model.getObjectByName('Spine') || Object.values(shirts).some(name => !model.getObjectByName(name)?.isSkinnedMesh)) throw Error('asset_invalid');
      model.traverse(mesh => {
        if (!mesh.isMesh) return;
        const standard = mesh.material;
        const basic = new THREE.MeshBasicMaterial({ color: standard.color, side: standard.side, vertexColors: standard.vertexColors });
        const pair = { standard, basic };
        if (mesh.name === 'Body') { pair.humanoid = createHumanoidMaterial(standard); pair.humanoidBasic = createHumanoidMaterial(standard, { unlit: true }); }
        materials.set(mesh, pair);
      });
      scene.add(model);
      const resize = () => { if (!renderer) return; const rect = canvas.getBoundingClientRect(); renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false); camera.aspect = Math.max(1, rect.width) / Math.max(1, rect.height); camera.updateProjectionMatrix(); render(); };
      observer = new ResizeObserver(resize); observer.observe(canvas); controls.update(); updateMaterial(); updateGarment(); resize();
      setState('ready'); status('전신·예시 티셔츠를 표시했습니다. 회전과 의류 변경을 확인할 수 있습니다.');
    } catch (error) { if (token === generation && !signal.aborted) failed(error.message); }
    finally { clearTimeout(timer); }
  }
  $('#gltf-garment').addEventListener('change', updateGarment);
  $('#gltf-material').addEventListener('change', updateMaterial);
  $('#gltf-look').addEventListener('change', updateMaterial);
  $('#gltf-skin-proof').addEventListener('change', () => { skinPose = $('#gltf-skin-proof').checked; model.getObjectByName('Spine').rotation.z = skinPose ? 0.12 : 0; render(); });
  for (const [name, yaw] of [['front', 0], ['side', Math.PI / 2], ['back', Math.PI]]) $('#gltf-' + name).addEventListener('click', () => view(yaw));
  $('#gltf-left').addEventListener('click', () => view(Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z) - Math.PI / 18));
  $('#gltf-right').addEventListener('click', () => view(Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z) + Math.PI / 18));
  $('#gltf-zoom-in').addEventListener('click', () => zoom(0.9)); $('#gltf-zoom-out').addEventListener('click', () => zoom(1.1));
  $('#gltf-delete').addEventListener('click', () => { generation++; clean(); setState('disposed'); status('임시 3D 화면을 지웠습니다. 다시 불러오기로 재시작할 수 있습니다.'); });
  $('#gltf-retry').addEventListener('click', initialize);
  window.addEventListener('pagehide', () => { generation++; clean(); setState('disposed'); });
  Object.defineProperty(window, 'A1GltfProof', { value: Object.freeze({ snapshot() {
    let meshes = 0, skinnedMeshes = 0, bones = new Set();
    model?.traverse(object => { if (object.isMesh) meshes++; if (object.isSkinnedMesh) { skinnedMeshes++; for (const bone of object.skeleton.bones) bones.add(bone); } });
    return { state, disposed, meshes, skinnedMeshes, bones: bones.size, drawCalls, triangles, renderCount, garment, materialMode, skinPose, look,
      viewYaw: camera ? Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z) : 0,
      frameSamples: [...frameSamples], timingScope: 'CPU render submission milliseconds; not GPU frame time or FPS',
      memoryGeometries: lastMemory.geometries, memoryTextures: lastMemory.textures };
  } }), writable: false, configurable: false });
  initialize();
}
