/* Same-document adapter for the existing analysis and local garment-photo lab.
 * No new image engine, private handoff, storage, API or arbitrary resource URL.
 */
'use strict';
(() => {
  const host = document.querySelector('#studio-photo-flow');
  const mount = document.querySelector('#studio-photo-mount');
  const status = document.querySelector('#studio-photo-status');
  const retry = document.querySelector('#studio-photo-retry');
  const I = window.A1I18n;
  if (!host || !mount || !status || !retry || !I) return;
  I.register({
    '내 사진으로 이어서 피팅하기': 'Continue fitting with my photo',
    '사진 선택·체형 분석': 'Choose a photo & analyze proportions',
    '내 사진 2D 피팅 열기': 'Open local 2D photo fitting',
    '사진 분석부터 의류 사진 배치까지 이 페이지에서 이어갑니다. 개인 사진과 분석값은 기기 메모리에만 유지합니다.': 'Continue from photo analysis to garment-photo placement on this page. Personal photos and analysis values stay in device memory.',
    '사진상 비율과 직접 입력한 치수로 3D 아바타를 조절할 수 있습니다. 이용 허락을 확인한 의류 사진은 로컬 2D 피팅에서 볼 수 있습니다.': 'Use estimated photo proportions and entered measurements to adjust the 3D avatar. Open authorized garment photos in local 2D fitting.',
    '스타일 이미지 비교·3D 인체 샘플·기기 내 사진 분석과 의류 사진 2D 피팅을 연결하는 무료 A1 FASHION 스튜디오': 'A free A1 FASHION studio connecting style-image comparison, a 3D human sample, on-device photo analysis and 2D garment-photo fitting',
    '3D 아바타는 선택한 비율을 반영한 가상 모델입니다. 착용감과 사이즈는 판매처에서 확인하세요.': 'The 3D avatar is a virtual model that uses your selected proportions. Check fit and size with the retailer.',
    '사진 피팅 사용 가능 여부를 확인하고 있습니다.': 'Checking availability of on-device photo fitting.',
    '기존 사진 분석·2D 피팅 화면을 준비하고 있습니다.': 'Preparing the existing photo-analysis and 2D-fitting tools.',
    '먼저 이 페이지에서 사진을 선택하고 분석하세요. 의류 사진은 별도 이용 권한과 내 사진 사용 동의 후 배치할 수 있습니다.': 'First choose and analyze a photo on this page. A garment photo can be placed after separate garment permission and personal-photo consent.',
    '분석 사진을 다시 선택할 필요가 없습니다. 이용 권한이 있는 의류 사진을 선택하고 내 사진 사용에 별도로 동의하세요.': 'You do not need to select your analyzed photo again. Choose a garment photo you may use and separately consent to use your photo.',
    '사진 피팅 화면을 열지 못했습니다. 아래 다시 시도를 누르세요. 사진은 다른 페이지로 보내지 않습니다.': 'The photo-fitting tools could not open. Choose Retry below. Photos are not transferred to another page.',
    '사진 분석 화면으로 이동': 'Go to photo analysis',
    '이 페이지에서 계속하기': 'Continue on this page',
    '사진 피팅 다시 시도': 'Retry photo fitting',
    '실행 파일 연결이 지연되어 준비를 중단했습니다. 페이지를 새로고침한 뒤 다시 여세요. 선택한 사진은 다시 선택해야 합니다.': 'The viewer files took too long to load. Reload this page and reopen the tools. Any selected photo must be selected again.',
    '실행 파일 초기화에 실패했습니다. 페이지를 새로고침한 뒤 다시 여세요. 선택한 사진은 다시 선택해야 합니다.': 'The viewer files could not initialize. Reload this page and reopen the tools. Any selected photo must be selected again.',
    '페이지 새로고침': 'Reload page'
  });
  const allowed = () => Boolean(window.A1Preview || window.A1PublicLocal?.mode === 'server-public-local');
  let pending = null, mounted = false, revision = 0, lastTarget = 'fitting', needsReload = false, reloadReason = 'init';
  const scripts = new Map();
  const message = source => I.setText(status, source);
  const currentAnalysis = () => Boolean(document.querySelector('#ai-result') && !document.querySelector('#ai-result').hidden);
  const requireRuntime = condition => { if (!condition) throw Error('INIT'); };
  function markReload(reason) { needsReload = true; reloadReason = reason; }
  function showReloadRequired() {
    host.dataset.state = 'error';
    message(reloadReason === 'timeout'
      ? '실행 파일 연결이 지연되어 준비를 중단했습니다. 페이지를 새로고침한 뒤 다시 여세요. 선택한 사진은 다시 선택해야 합니다.'
      : '실행 파일 초기화에 실패했습니다. 페이지를 새로고침한 뒤 다시 여세요. 선택한 사진은 다시 선택해야 합니다.');
    I.setText(retry, '페이지 새로고침'); retry.hidden = false;
  }
  function reveal(element) {
    if (!element) return;
    element.setAttribute('tabindex', '-1');
    element.scrollIntoView({ block: 'start', behavior: 'auto' });
    element.focus({ preventScroll: true });
  }
  function loadScript(path) {
    if (scripts.has(path)) return scripts.get(path);
    const existing = [...document.scripts].find(script => new URL(script.src || location.href).pathname === '/' + path);
    if (existing) return Promise.resolve();
    const request = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      let settled = false;
      const finish = error => {
        if (settled) return;
        settled = true; clearTimeout(timer);
        window.removeEventListener('error', runtimeFailure);
        window.removeEventListener('unhandledrejection', runtimeFailure);
        script.onload = script.onerror = null;
        if (error) reject(error); else resolve();
      };
      // A classic script's load event still fires after an uncaught runtime
      // error. Treat uncertain partial initialization as reload-only; never
      // replay a script which may already have attached private-image handlers.
      const runtimeFailure = event => {
        if (event.type === 'error' && !(event instanceof ErrorEvent)) return;
        markReload('init'); finish(Error('INIT'));
      };
      window.addEventListener('error', runtimeFailure);
      window.addEventListener('unhandledrejection', runtimeFailure);
      const timer = setTimeout(() => {
        // A removed classic script can still arrive late in some browsers.
        // Do not execute another copy in this document after that uncertainty.
        markReload('timeout'); script.remove(); finish(Error('TIMEOUT'));
      }, 15000);
      script.async = false;
      script.src = '/' + path;
      script.onload = () => finish();
      script.onerror = () => {
        script.remove(); scripts.delete(path);
        finish(Object.assign(Error('SCRIPT'), { retrySafe: true }));
      };
      document.head.append(script);
    });
    scripts.set(path, request);
    return request;
  }
  async function prepare(token) {
    // Fixed local dependencies, in order. ai-studio is loaded after its DOM and
    // the lab listeners so its existing currentScript/MediaPipe path is intact.
    for (const path of ['assets/i18n-main.js', 'assets/i18n-analysis.js', 'assets/body-analysis.js',
      'assets/proportion-profile.js', 'assets/proportion-recommendations.js', 'assets/proportion-controls.js', 'assets/product-matching.js', 'assets/offer-comparison.js', 'assets/product-catalog.js', 'assets/shopping-query.js', 'assets/shopping-conversation.js', 'assets/lab-loader.js', 'assets/product-discovery.js', 'assets/product-images.js', 'assets/catalog-fitting.js', 'assets/product-discovery-view.js']) {
      await loadScript(path);
      if (token !== revision) throw Error('CANCELLED');
    }
    requireRuntime(typeof window.A1BodyAnalysis?.analyzePose === 'function'
      && typeof window.A1ProductMatching?.validMetrics === 'function'
      && typeof window.A1ProductCatalog?.validateSnapshot === 'function'
      && typeof window.A1CatalogFitting?.open === 'function'
      && typeof window.A1ProductDiscovery?.search === 'function'
      && typeof window.A1ProductDiscoveryView?.create === 'function'
      && typeof window.A1ShoppingQuery?.parse === 'function'
      && typeof window.A1ShoppingQuery?.links === 'function'
      && typeof window.A1LabTemplates?.load === 'function'
      && typeof window.A1LabTemplates?.initialize === 'function');
    if (!document.querySelector('#lab-root')) {
      const template = await window.A1LabTemplates.load('product');
      if (token !== revision) throw Error('CANCELLED');
      // This page initially has no analysis form. Keep the template's original
      // form and canvases; never create a second source or serialize pixels.
      if (!template.querySelector('#ai-studio') || document.querySelector('#ai-studio')) throw Error('TEMPLATE');
      mount.append(document.importNode(template, true));
      const intro = mount.querySelector('.lab-intro');
      if (intro) intro.hidden = true;
    }
    for (const path of ['assets/garment-pose.js', 'assets/product-lab.js', 'assets/lab-entry.js', 'assets/avatar-photo-bridge.js', 'assets/ai-studio.js']) {
      await loadScript(path);
      if (token !== revision) throw Error('CANCELLED');
    }
    requireRuntime(document.querySelectorAll('#ai-studio').length === 1 && document.querySelectorAll('#lab-root').length === 1
      && document.querySelector('#lab-root')?.dataset.loadState === 'ready'
      && typeof window.initializeProductLab === 'function'
      && typeof window.A1LabNavigation?.open === 'function'
      && document.querySelector('#lab-open-avatar')?.dataset.naturalBridge === 'true'
      && document.querySelector('#avatar-reference-consent')
      && document.querySelector('#ai-form') && document.querySelector('#ai-photo')
      && document.querySelector('#lab-local-photo-fit') && document.querySelector('#lab-local-photo-consent'));
    // The lab's original initialization precedes ai-studio in the lazy path.
    // Repeat only its non-personal free-beta policy event, never an analysis.
    if (window.A1Preview || window.A1PublicBeta) document.dispatchEvent(new CustomEvent('a1:policy-ready', { detail: { freeBetaMode: true } }));
    I.refresh();
    mounted = true;
  }
  async function open(target = 'fitting') {
    if (!['analysis', 'fitting'].includes(target)) target = 'fitting';
    lastTarget = target;
    if (!allowed()) { message('사진 피팅 사용 가능 여부를 확인하고 있습니다.'); return false; }
    if (needsReload) { showReloadRequired(); reveal(status); return false; }
    const token = revision;
    retry.hidden = true;
    host.dataset.state = mounted ? 'ready' : 'loading';
    message('기존 사진 분석·2D 피팅 화면을 준비하고 있습니다.');
    try {
      if (!mounted) {
        if (!pending) pending = prepare(token).finally(() => { pending = null; });
        await pending;
      }
      if (token !== revision) return false;
      host.dataset.state = 'ready';
      mount.hidden = false;
      delete status.dataset.errorCode;
      message(currentAnalysis()
        ? '분석 사진을 다시 선택할 필요가 없습니다. 이용 권한이 있는 의류 사진을 선택하고 내 사진 사용에 별도로 동의하세요.'
        : '먼저 이 페이지에서 사진을 선택하고 분석하세요. 의류 사진은 별도 이용 권한과 내 사진 사용 동의 후 배치할 수 있습니다.');
      reveal(document.querySelector(target === 'analysis' ? '#ai-studio' : '#lab-local-photo-fitting'));
      return true;
    } catch (error) {
      if (token !== revision) return false;
      host.dataset.state = 'error';
      const code = error.code || error.message;
      status.dataset.errorCode = 'A1-STUDIO-PHOTO-' + (/^[A-Z]+$/.test(code) ? code : 'INIT');
      if (!error.retrySafe && !['REQUEST', 'HTTP', 'MIME', 'TEMPLATE', 'TIMEOUT'].includes(code)) markReload('init');
      if (needsReload) showReloadRequired();
      else {
        message('사진 피팅 화면을 열지 못했습니다. 아래 다시 시도를 누르세요. 사진은 다른 페이지로 보내지 않습니다.');
        I.setText(retry, '사진 피팅 다시 시도');
      }
      retry.hidden = false;
      reveal(status);
      return false;
    }
  }
  document.querySelector('#studio-open-photo-fitting')?.addEventListener('click', () => open());
  document.querySelector('#studio-open-analysis')?.addEventListener('click', () => open('analysis'));
  retry.addEventListener('click', () => { if (needsReload) location.reload(); else open(lastTarget); });
  // Keep familiar links as useful fallbacks while executing the real flow on
  // this document when Preview supports it. No photo crosses a navigation.
  for (const link of document.querySelectorAll('.hero-actions a[href="index.html#ai-studio"],.next-links a[href="index.html#ai-studio"],.next-links a[href="product-lab.html"]')) {
    link.addEventListener('click', event => {
      if (!allowed()) return;
      event.preventDefault(); open(link.getAttribute('href') === 'product-lab.html' ? 'fitting' : 'analysis');
    });
  }
  document.addEventListener('a1:studio-photo-open', event => open(event.detail?.target));
  document.addEventListener('a1:analysis-cleared', () => {
    if (mounted) message('먼저 이 페이지에서 사진을 선택하고 분석하세요. 의류 사진은 별도 이용 권한과 내 사진 사용 동의 후 배치할 수 있습니다.');
  });
  window.addEventListener('pagehide', () => { revision++; });
  const updateAvailability = () => {
    const enabled = allowed();
    for (const button of host.querySelectorAll(':scope > .studio-photo-actions > button')) button.disabled = !enabled;
    if (!enabled) message('사진 피팅 사용 가능 여부를 확인하고 있습니다.');
    else if (!mounted && !pending) message('');
  };
  document.addEventListener('a1:public-local-ready', updateAvailability);
  updateAvailability();
  Object.defineProperty(window, 'A1StudioPhotoFitting', { value: Object.freeze({ open, snapshot() {
    return { mounted, loading: Boolean(pending), state: host.dataset.state || 'idle' };
  } }), writable: false, configurable: false });
})();
