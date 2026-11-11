'use strict';
(() => {
  const $ = selector => document.querySelector(selector);
  const advisor = window.A1BodyAnalysis;
  const vendor = new URL('vendor/mediapipe/', new URL('.', document.currentScript.src));
  let freeBeta = false;
  let photograph = null;
  let pendingPhoto = null;
  let analysis = null;
  let busy = false;
  let revision = 0;
  let libraryPromise = null;
  let activeRun = null;
  let statusSource = '사진을 선택해주세요. 분석 결과까지 무료로 확인할 수 있습니다.';
  let statusError = false;
  let fileSource = '사진은 외부 서버로 전송하거나 저장하지 않습니다.';
  let fileParams = {};

  function t(source, params = {}) {
    return window.A1I18n?.t(source, params) ?? source.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => Object.hasOwn(params, key) ? String(params[key]) : match);
  }

  function text(element, source, params = {}) {
    if (window.A1I18n) window.A1I18n.setText(element, source, params);
    else element.textContent = t(source, params);
  }

  function fileInfo(source, params = {}) {
    fileSource = source;
    fileParams = params;
    text($('#ai-file-info'), source, params);
  }

  function renderAnalysisCopy() {
    if (!analysis) return;
    text($('#ai-summary'), analysis.summary);
    $('#ai-metrics').replaceChildren();
    for (const [label, ratio] of [
      ['사진 속 어깨 / 골반 기준점 간격', analysis.metrics.shoulderHipRatio],
      ['사진 속 다리 / 몸통 기준점 길이', analysis.metrics.legTorsoRatio]
    ]) {
      const dt = document.createElement('dt'), dd = document.createElement('dd');
      text(dt, label);
      text(dd, '{ratio}배', { ratio: ratio.toFixed(2) });
      $('#ai-metrics').append(dt, dd);
    }
    // Retain the original analysis data; only its visible copy changes language.
    $('#ai-notes').textContent = analysis.notes.map(note => t(note)).join(' ');
  }

  function status(message, error = false) {
    statusSource = message;
    statusError = error;
    text($('#ai-status'), freeBeta && message === '무료 분석을 완료했습니다. 결과는 구독 없이 볼 수 있으며, 스타일 추천은 구독 확인 후 이용합니다.' ? '무료 분석을 완료했습니다. 무료 베타 스타일 예시도 이용할 수 있습니다.' : message);
    $('#ai-status').classList.toggle('is-error', error);
  }

  function controls() {
    $('#ai-analyze').disabled = busy || !photograph;
    text($('#ai-analyze'), busy ? 'AI 분석 중…' : analysis ? '무료 분석 완료' : '무료로 사진 분석하기');
    $('#ai-photo').disabled = busy;
    $('#ai-clear').disabled = !photograph && !analysis && !busy && !pendingPhoto;
    $('#ai-output').setAttribute('aria-busy', String(busy));
  }

  function eraseCanvas(canvas) {
    if (canvas) { canvas.width = 1; canvas.height = 1; }
  }

  function clear(reason = 'user') {
    revision++;
    pendingPhoto?.cancel();
    pendingPhoto = null;
    activeRun?.cancel();
    activeRun = null;
    busy = false;
    eraseCanvas(photograph);
    photograph = null;
    analysis = null;
    eraseCanvas($('#ai-canvas'));
    eraseCanvas($('#ai-clean-canvas'));
    eraseCanvas($('#ai-preview-canvas'));
    $('#ai-photo-preview').hidden = true;
    $('#ai-photo').value = '';
    fileInfo('사진은 외부 서버로 전송하거나 저장하지 않습니다.');
    $('#ai-result').hidden = true;
    document.dispatchEvent(new CustomEvent('a1:analysis-cleared', {detail: {reason: typeof reason === 'string' ? reason : 'user'}}));
    $('#ai-placeholder').hidden = false;
    text($('#ai-summary'), '');
    $('#ai-metrics').replaceChildren();
    $('#ai-notes').textContent = '';
    status('사진과 분석 결과를 지웠습니다.');
    controls();
  }

  async function readPhoto(file) {
    if (!file || file.size > 20 * 1024 * 1024) throw new Error('20MB 이하의 사진을 선택해주세요.');
    if (!file.type.startsWith('image/')) throw new Error('사진 파일을 선택해주세요. JPG나 PNG를 권장합니다.');
    const url = URL.createObjectURL(file);
    const image = new Image();
    let rejectLoad;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      image.onload = image.onerror = null;
      image.removeAttribute('src');
      URL.revokeObjectURL(url);
    };
    const load = { cancel() { release(); rejectLoad(new Error('분석을 취소했습니다.')); } };
    pendingPhoto = load;
    controls();
    try {
      // Load events work in iPad Safari too; the URL is used only on-device.
      await new Promise((resolve, reject) => {
        rejectLoad = reject;
        image.onload = resolve;
        image.onerror = () => reject(new Error('이 사진 형식을 열 수 없습니다. JPG·PNG 또는 사진의 스크린샷을 선택해주세요.'));
        image.src = url;
      });
      if (!image.naturalWidth || image.naturalWidth * image.naturalHeight > 30000000) {
        throw new Error('사진이 너무 큽니다. 사진을 줄이거나 스크린샷을 선택해주세요.');
      }
      const scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.naturalWidth * scale);
      canvas.height = Math.round(image.naturalHeight * scale);
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas;
    } catch (error) {
      if (error.name === 'EncodingError') throw new Error('이 사진 형식을 열 수 없습니다. JPG·PNG 또는 사진의 스크린샷을 선택해주세요.');
      throw error;
    } finally {
      release();
      if (pendingPhoto === load) pendingPhoto = null;
    }
  }

  // The official, integrity-checked model and runtime are hosted with this site.
  // No CDN, API, analytics or photo upload request is made here.
  function loadLibrary() {
    if (window.Pose) return Promise.resolve();
    if (libraryPromise) return libraryPromise;
    libraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('pose.js', vendor).href;
      script.onload = () => window.Pose ? resolve() : reject(new Error('AI 모델 실행 파일을 열지 못했습니다.'));
      script.onerror = () => { script.remove(); reject(new Error('AI 모델을 불러오지 못했습니다. 인터넷 연결을 확인하고 다시 시도해주세요.')); };
      document.head.append(script);
    }).catch(error => { libraryPromise = null; throw error; });
    return libraryPromise;
  }

  function checkWebGL() {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) throw new Error('이 브라우저에서 AI 실행에 필요한 WebGL을 사용할 수 없습니다. 최신 Safari 또는 Chrome에서 다시 열어주세요.');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }

  function timeout(promise, milliseconds) {
    let timer;
    return Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('AI 분석 시간이 길어졌습니다. 다른 앱을 닫고 페이지를 새로고침한 뒤 다시 시도해주세요.')), milliseconds);
    })]).finally(() => clearTimeout(timer));
  }

  function drawResult(source, points) {
    const output = $('#ai-canvas');
    // Discard the face area rather than drawing facial landmarks or a face avatar.
    const crop = Math.max(0, Math.floor(Math.min(points[11].y, points[12].y) * source.height));
    output.width = source.width;
    output.height = Math.max(1, source.height - crop);
    const ctx = output.getContext('2d');
    ctx.drawImage(source, 0, crop, source.width, source.height - crop, 0, 0, output.width, output.height);
    // Keep only the same face-cropped analysis image, without annotation lines,
    // for a later explicitly consented local fitting preview. Never keep a
    // second full-face original, URL, encoded image, or persistent record.
    let clean = $('#ai-clean-canvas');
    if (!clean) {
      clean = document.createElement('canvas');
      clean.id = 'ai-clean-canvas';
      clean.hidden = true;
      clean.setAttribute('aria-hidden', 'true');
      output.after(clean);
    }
    clean.width = output.width;
    clean.height = output.height;
    clean.getContext('2d').drawImage(output, 0, 0);
    ctx.strokeStyle = '#c9ff85';
    ctx.fillStyle = '#c9ff85';
    ctx.lineWidth = Math.max(3, output.width / 180);
    const connections = [[11,12],[11,23],[12,24],[23,24],[23,25],[24,26],[25,27],[26,28]];
    for (const [a,b] of connections) {
      ctx.beginPath();
      ctx.moveTo(points[a].x * source.width, points[a].y * source.height - crop);
      ctx.lineTo(points[b].x * source.width, points[b].y * source.height - crop);
      ctx.stroke();
    }
    for (const id of [11,12,23,24,25,26,27,28]) {
      ctx.beginPath();
      ctx.arc(points[id].x * source.width, points[id].y * source.height - crop, ctx.lineWidth * 1.6, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  $('#ai-photo').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;
    clear('photo-replacement');
    const token = revision;
    status('사진을 기기 안에서 준비하고 있습니다.');
    try {
      const decoded = await readPhoto(file);
      if (token !== revision) { eraseCanvas(decoded); return; }
      photograph = decoded;
      const preview = $('#ai-preview-canvas');
      preview.width = decoded.width;
      preview.height = decoded.height;
      preview.getContext('2d').drawImage(decoded, 0, 0);
      $('#ai-photo-preview').hidden = false;
      $('#ai-placeholder').hidden = true;
      fileInfo('{name} · 사진 준비 완료', { name: file.name });
      status('사진이 준비됐습니다. 무료 분석 버튼을 눌러주세요.');
    } catch (error) { if (token === revision) status(error.message, true); }
    controls();
  });

  $('#ai-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    if (!photograph) return;
    const source = photograph;
    const token = revision;
    const run = { cancelled: false, work: null };
    run.cancellation = new Promise((_, reject) => {
      run.cancel = () => { run.cancelled = true; reject(new Error('분석을 취소했습니다.')); };
    });
    // Static asset downloads may finish, but cancellation releases the UI now.
    const wait = (promise, milliseconds) => Promise.race([timeout(promise, milliseconds), run.cancellation]);
    activeRun = run;
    let pose;
    busy = true;
    controls();
    try {
      checkWebGL();
      status('무료 AI 모델을 불러오는 중입니다. 첫 실행에는 시간이 걸릴 수 있어요.');
      await wait(loadLibrary(), 45000);
      if (token !== revision) return;
      pose = new window.Pose({locateFile: file => new URL(file, vendor).href});
      pose.setOptions({modelComplexity: 0, smoothLandmarks: false, enableSegmentation: false, minDetectionConfidence: .6, minTrackingConfidence: .6});
      let points;
      pose.onResults(result => { points = result.poseLandmarks?.map(p => ({x:p.x,y:p.y,z:p.z,visibility:p.visibility})); });
      run.work = pose.initialize();
      await wait(run.work, 90000);
      if (token !== revision) return;
      status('AI가 사진 속 어깨·골반·다리 기준점을 찾고 있습니다.');
      run.work = pose.reset();
      await wait(run.work, 10000);
      run.work = pose.send({image: source});
      await wait(run.work, 45000);
      if (token !== revision) return;
      const result = advisor.analyzePose(points, source.width, source.height);
      if (!result.ok) throw new Error(result.error);
      analysis = result;
      drawResult(source, points);
      renderAnalysisCopy();
      $('#ai-photo-preview').hidden = true;
      eraseCanvas($('#ai-preview-canvas'));
      $('#ai-result').hidden = false;
      $('#ai-placeholder').hidden = true;
      document.dispatchEvent(new CustomEvent('a1:analysis-ready',{detail:Object.freeze({metrics:Object.freeze({shoulderHipRatio:result.metrics.shoulderHipRatio,legTorsoRatio:result.metrics.legTorsoRatio})})}));
      status('무료 분석을 완료했습니다. 결과는 구독 없이 볼 수 있으며, 스타일 추천은 구독 확인 후 이용합니다.');
      eraseCanvas(source);
      photograph = null;
    } catch (error) {
      if (token === revision) eraseCanvas($('#ai-clean-canvas'));
      if (token === revision) status(error.message?.includes('WebGL') || error.message?.includes('사진') || error.message?.includes('AI') ? error.message : '사진을 분석하지 못했습니다. 정면 전신 사진으로 다시 시도하거나 페이지를 새로고침해주세요.', true);
    } finally {
      if (pose) {
        // Do not destroy WASM memory while an outstanding operation is using it.
        const dispose = () => pose.close().catch(() => {});
        if (run.work) run.work.then(dispose, dispose);
        else { try { await pose.close(); } catch { /* Dispose best-effort after failure. */ } }
      }
      if (activeRun === run) {
        activeRun = null;
        busy = false;
        controls();
      }
    }
  });

  document.addEventListener('a1:policy-ready', event => { freeBeta = event.detail.freeBetaMode === true; });
  document.addEventListener('a1:language-changed', () => {
    // Language selection never re-runs inference, clears a photo, or sends data.
    status(statusSource, statusError);
    fileInfo(fileSource, fileParams);
    controls();
    renderAnalysisCopy();
  });
  $('#ai-clear').addEventListener('click', clear);
  window.addEventListener('pagehide', () => clear('pagehide'));
})();
