'use strict';
(() => {
  const $ = selector => document.querySelector(selector);
  const catalog = window.A1Catalog;
  const advisor = window.A1StyleAdvisor;
  const vendor = new URL('vendor/mediapipe/', new URL('.', document.currentScript.src));
  let photograph = null;
  let analysis = null;
  let busy = false;
  let revision = 0;
  let libraryPromise = null;
  let wishes = new Set();
  let activeRun = null;

  function status(message, error = false) {
    $('#ai-status').textContent = message;
    $('#ai-status').classList.toggle('is-error', error);
  }

  function controls() {
    $('#ai-analyze').disabled = busy || (!photograph && !analysis);
    $('#ai-analyze').textContent = busy ? 'AI 분석 중…' : analysis ? '선택한 조건으로 다시 추천' : '사진 분석하고 추천 받기';
    $('#ai-photo').disabled = busy;
    for (const id of ['ai-gender', 'ai-style', 'ai-budget']) $('#' + id).disabled = busy;
    $('#ai-clear').disabled = !photograph && !analysis && !busy;
    $('#ai-output').setAttribute('aria-busy', String(busy));
  }

  function eraseCanvas(canvas) {
    if (canvas) { canvas.width = 1; canvas.height = 1; }
  }

  function clear() {
    revision++;
    activeRun?.cancel();
    activeRun = null;
    busy = false;
    eraseCanvas(photograph);
    photograph = null;
    analysis = null;
    eraseCanvas($('#ai-canvas'));
    $('#ai-photo').value = '';
    $('#ai-file-info').textContent = '사진은 외부 서버로 전송하거나 저장하지 않습니다.';
    $('#ai-result').hidden = true;
    $('#ai-recommendations').hidden = true;
    $('#ai-shopping').hidden = true;
    $('#ai-shopping-queries').replaceChildren();
    $('#ai-shopping-budget').textContent = '';
    $('#ai-placeholder').hidden = false;
    $('#ai-cards').replaceChildren();
    $('#ai-summary').textContent = '';
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
    try {
      image.src = url;
      await image.decode();
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
      image.src = '';
      URL.revokeObjectURL(url);
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

  function syncWishes() {
    $('#ai-cards').querySelectorAll('[data-wish]').forEach(button => {
      const saved = wishes.has(button.dataset.wish);
      button.textContent = saved ? '♥' : '♡';
      button.setAttribute('aria-pressed', String(saved));
      button.setAttribute('aria-label', saved ? '찜 해제' : '찜하기');
    });
  }

  function recommend() {
    const preferences = {
      gender: $('#ai-gender').value,
      style: $('#ai-style').value,
      budget: Number($('#ai-budget').value)
    };
    const rows = advisor.recommend(catalog.products, analysis, preferences);
    const cards = $('#ai-cards');
    cards.replaceChildren();
    for (const {product: p, reasons} of rows) {
      // Only trusted catalog strings enter this template; filenames/user inputs do not.
      const article = document.createElement('article');
      article.className = 'card';
      article.innerHTML = `<div class="card-photo"><button class="image-button" data-detail="${p.id}" aria-label="${p.name} 상세보기"><img src="${catalog.image(p.photo)}" alt="${p.name} 스타일 참고 사진" loading="lazy" width="600" height="800"></button><button class="wish-button" data-wish="${p.id}" aria-label="찜하기" aria-pressed="false">♡</button><span class="card-tag">${p.gender} / STYLE SAMPLE</span></div><div class="card-info"><p class="brand">A1 EDIT · ${p.style}</p><h4 class="product-title"><button data-detail="${p.id}">${p.name}</button></h4><span class="price">${p.price.toLocaleString('ko-KR')}원 <small>예시</small></span><ul class="ai-reasons"></ul></div>`;
      for (const reason of reasons) {
        const li = document.createElement('li');
        li.textContent = reason;
        article.querySelector('.ai-reasons').append(li);
      }
      article.querySelector('img').addEventListener('error', event => {
        const img = event.target;
        img.src = 'assets/placeholder.svg';
        img.classList.add('image-fallback');
        img.alt = '사진을 불러오지 못했습니다. 상품 설명을 참고해주세요.';
      }, {once: true});
      cards.append(article);
    }
    syncWishes();
    $('#ai-recommendations').hidden = false;
    $('#ai-no-matches').hidden = rows.length > 0;
    $('#ai-recommendation-count').textContent = `${rows.length}개 제안 · AI 기준점 + 선택 조건 매칭`;
    renderShopSearch(preferences);
  }

  function renderShopSearch(preferences) {
    const container = $('#ai-shopping-queries');
    container.replaceChildren();
    const suggestions = window.A1ShopSearch.suggest(analysis, preferences);
    for (const suggestion of suggestions) {
      const row = document.createElement('article');
      row.className = 'shop-search-row';
      const text = document.createElement('div');
      const title = document.createElement('h4');
      title.textContent = suggestion.query;
      const reason = document.createElement('p');
      reason.textContent = suggestion.reason;
      text.append(title, reason);
      const links = document.createElement('div');
      links.className = 'shop-search-links';
      for (const link of suggestion.links) {
        const anchor = document.createElement('a');
        anchor.href = link.url;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.textContent = `${link.label} ↗`;
        anchor.setAttribute('aria-label', `${suggestion.query} · ${link.label}, 새 창`);
        links.append(anchor);
      }
      row.append(text, links);
      container.append(row);
    }
    $('#ai-shopping').hidden = suggestions.length === 0;
    $('#ai-shopping-budget').textContent = preferences.budget < 1000000
      ? `선택한 예산은 상품당 ${preferences.budget.toLocaleString('ko-KR')}원 이하입니다. 외부몰 검색에는 가격 제한이 자동 적용되지 않으므로 판매처의 가격 필터를 설정해주세요.`
      : '외부몰의 상품 가격과 재고는 실시간으로 바뀔 수 있습니다.';
  }

  $('#ai-photo').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;
    clear();
    const token = revision;
    status('사진을 기기 안에서 준비하고 있습니다.');
    try {
      const decoded = await readPhoto(file);
      if (token !== revision) { eraseCanvas(decoded); return; }
      photograph = decoded;
      $('#ai-file-info').textContent = `${file.name} · 사진 준비 완료`;
      status('사진이 준비됐습니다. 원하는 조건을 선택하고 분석 버튼을 눌러주세요.');
    } catch (error) { if (token === revision) status(error.message, true); }
    controls();
  });

  $('#ai-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    if (analysis) { recommend(); status('선택한 조건으로 추천을 갱신했습니다. 사진은 다시 분석하지 않았습니다.'); return; }
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
      $('#ai-summary').textContent = result.summary;
      $('#ai-metrics').replaceChildren();
      for (const [label, value] of [
        ['사진 속 어깨 / 골반 기준점 간격', `${result.metrics.shoulderHipRatio.toFixed(2)}배`],
        ['사진 속 다리 / 몸통 기준점 길이', `${result.metrics.legTorsoRatio.toFixed(2)}배`]
      ]) {
        const dt = document.createElement('dt'), dd = document.createElement('dd');
        dt.textContent = label; dd.textContent = value;
        $('#ai-metrics').append(dt, dd);
      }
      $('#ai-notes').textContent = result.notes.join(' ');
      $('#ai-result').hidden = false;
      $('#ai-placeholder').hidden = true;
      recommend();
      status('AI 기준점 분석을 완료했습니다. 아래에서 참고 비율과 추천 이유를 확인하세요.');
      eraseCanvas(source);
      photograph = null;
    } catch (error) {
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

  $('#ai-clear').addEventListener('click', clear);
  document.addEventListener('a1:catalog-rendered', event => {
    wishes = new Set(event.detail.wishes);
    syncWishes();
  });
  // Initial wishlist state contains only catalog IDs, never a photo or body data.
  $('#cards').querySelectorAll('[data-wish][aria-pressed="true"]').forEach(b => wishes.add(b.dataset.wish));
  window.addEventListener('pagehide', clear);
})();
