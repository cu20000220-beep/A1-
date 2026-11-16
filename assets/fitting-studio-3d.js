'use strict';
(() => {
  const modes = document.querySelector('#studio-modes');
  const images = document.querySelector('#studio-root');
  const panel = document.querySelector('#studio-3d-panel');
  const mount = document.querySelector('#studio-3d-mount');
  const template = document.querySelector('#studio-3d-template');
  const status = document.querySelector('#studio-3d-status');
  const retry = document.querySelector('#studio-3d-retry');
  const I = window.A1I18n;
  if (!modes || !images || !panel || !mount || !template || !status || !retry || !I) return;

  I.register({
    '미리보기 방식': 'Preview mode',
    '실사 스타일 이미지 · 2D': 'Photoreal style images · 2D',
    '3D 보기를 선택하면 모델을 불러옵니다.': 'Choose the 3D view to load its model.',
    '스타일 이미지 · 2D': 'Style images · 2D',
    '실제 3D 인체 샘플': 'Actual 3D human sample',
    '실제 3D 인체 샘플을 준비하고 있습니다.': 'Preparing the actual 3D human sample.',
    '이 3D는 위 실사 이미지 속 인물과 다른 별도 샘플입니다. 원본 의상 한 벌이며 사진·체형 수치를 적용하지 않습니다.': 'This 3D model is a separate stock sample, different from the people in the style images above. It has one original outfit and does not use your photo or body measurements.',
    '3D 샘플은 격리된 Preview에서 제공됩니다.': 'The 3D sample is available in an isolated Preview.',
    '3D 뷰어 파일을 읽지 못했습니다. 페이지를 새로고침하거나 기존 3D 화면에서 열어주세요.': 'The 3D viewer files could not load. Reload this page or open the existing 3D viewer.',
    '실제 3D 인체를 회전하고 확대해보세요.': 'Rotate and zoom the actual 3D human.',
    '3D 인체를 읽지 못했습니다. 아래 다시 불러오기를 사용하거나 기존 3D 화면에서 열어주세요.': 'The 3D human could not load. Use Reload below or open the existing 3D viewer.',
    '페이지 새로고침': 'Reload page',
    '3D 다시 불러오기': 'Reload 3D',
    '기존 3D 화면에서 열기': 'Open the existing 3D viewer'
  });

  const preview = /^[a-z0-9-]+\.a1fashion\.pages\.dev$/.test(location.hostname.toLowerCase());
  const buttons = [...modes.querySelectorAll('[data-studio-mode]')];
  let mode = 'images', loaded = false, loading = null, importFailed = false, observer = null;
  let revealAfterLoad = false;
  const viewer = () => mount.querySelector('#gltf-proof-root');
  const viewerState = () => viewer()?.dataset.loadState || 'uninitialized';
  const publishMode = () => {
    modes.dataset.mode = mode;
    images.hidden = mode !== 'images';
    panel.hidden = mode !== 'three';
    for (const button of buttons) {
      const active = button.dataset.studioMode === mode;
      button.setAttribute('aria-selected', String(active));
      button.setAttribute('aria-pressed', String(active));
      button.tabIndex = active ? 0 : -1;
    }
  };
  function message(source) { I.setText(status, source); }
  function event(name) { window.dispatchEvent(new CustomEvent(name)); }
  function revealCanvas() {
    const canvas = mount.querySelector('#gltf-canvas');
    if (!canvas || mode !== 'three') return;
    const box = canvas.getBoundingClientRect();
    if (box.top >= 20 && box.bottom <= innerHeight - 20) return;
    canvas.scrollIntoView({ block: 'center', behavior: 'auto' });
  }
  function sync() {
    if (mode !== 'three') return;
    const state = viewerState();
    panel.dataset.state = state;
    retry.hidden = state !== 'error';
    I.setText(retry, '3D 다시 불러오기');
    if (state === 'ready') {
      message('실제 3D 인체를 회전하고 확대해보세요.');
      if (revealAfterLoad) { revealAfterLoad = false; requestAnimationFrame(revealCanvas); }
    } else if (state === 'error') {
      message('3D 인체를 읽지 못했습니다. 아래 다시 불러오기를 사용하거나 기존 3D 화면에서 열어주세요.');
    } else if (state === 'loading') message('실제 3D 인체 샘플을 준비하고 있습니다.');
  }

  async function ensureViewer() {
    if (loaded) return;
    if (loading) return loading;
    if (!viewer()) mount.append(template.content.cloneNode(true));
    loading = (async () => {
      await import('./gltf-proof.js');
      if (!window.A1GltfProof) throw Error('viewer_not_started');
      loaded = true;
      observer = new MutationObserver(sync);
      observer.observe(viewer(), { attributes: true, attributeFilter: ['data-load-state'] });
    })();
    try { await loading; } finally { loading = null; }
  }

  async function choose(next) {
    if (!['images', 'three'].includes(next)) return;
    if (next === 'three' && !preview) return;
    mode = next; publishMode();
    if (mode === 'images') {
      revealAfterLoad = false;
      if (loaded) event('a1:gltf-suspend');
      return;
    }
    retry.hidden = true;
    revealAfterLoad = true;
    message('실제 3D 인체 샘플을 준비하고 있습니다.');
    try {
      await ensureViewer();
      // A user may return to images while the module graph is loading.
      if (mode !== 'three') { event('a1:gltf-suspend'); return; }
      importFailed = false;
      if (viewerState() === 'disposed') event('a1:gltf-resume');
      sync();
    } catch {
      importFailed = true;
      if (mode !== 'three') return;
      panel.dataset.state = 'error';
      message('3D 뷰어 파일을 읽지 못했습니다. 페이지를 새로고침하거나 기존 3D 화면에서 열어주세요.');
      I.setText(retry, '페이지 새로고침'); retry.hidden = false;
    }
  }

  if (!preview) {
    const button = buttons.find(item => item.dataset.studioMode === 'three');
    if (button) { button.disabled = true; button.title = I.t('3D 샘플은 격리된 Preview에서 제공됩니다.'); }
  }
  if (!panel.querySelector('[data-studio-3d-fallback]')) {
    const fallback = document.createElement('a'); fallback.href = 'gltf-proof.html';
    fallback.dataset.studio3dFallback = ''; fallback.className = 'studio-3d-fallback';
    I.setText(fallback, '기존 3D 화면에서 열기');
    retry.after(fallback);
  }
  modes.addEventListener('click', e => {
    const button = e.target.closest('[data-studio-mode]');
    if (button && modes.contains(button) && !button.disabled) choose(button.dataset.studioMode);
  });
  modes.addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const enabled = buttons.filter(button => !button.disabled);
    const current = enabled.indexOf(document.activeElement);
    if (current < 0) return;
    e.preventDefault();
    const index = e.key === 'Home' ? 0 : e.key === 'End' ? enabled.length - 1
      : (current + (e.key === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length;
    enabled[index].focus(); choose(enabled[index].dataset.studioMode);
  });
  retry.addEventListener('click', () => {
    // A failed module dependency remains failed in the document's ESM cache.
    // An explicit page reload is honest recovery; no automatic import loop.
    if (importFailed) { location.reload(); return; }
    const inner = mount.querySelector('#gltf-retry');
    if (inner) inner.click();
  });
  panel.addEventListener('click', e => {
    if (e.target.closest('#gltf-front,#gltf-side,#gltf-back,#gltf-left,#gltf-right,#gltf-zoom-in,#gltf-zoom-out')) requestAnimationFrame(revealCanvas);
  });
  panel.addEventListener('change', e => {
    if (e.target.matches('#gltf-look')) revealAfterLoad = true;
    else if (e.target.matches('#gltf-garment,#gltf-material,#gltf-skin-proof')) requestAnimationFrame(revealCanvas);
  });
  window.addEventListener('pageshow', e => {
    if (e.persisted && mode === 'three' && loaded && viewerState() === 'disposed') event('a1:gltf-resume');
  });
  Object.defineProperty(window, 'A1FittingStudio3D', { value: Object.freeze({ snapshot() {
    return { mode, loaded, loading: Boolean(loading) || viewerState() === 'loading', state: viewerState(), actual3D: mode === 'three' && loaded && viewerState() === 'ready' };
  } }), writable: false, configurable: false });
  publishMode();
})();
