'use strict';
(() => {
  const button = document.querySelector('#stylist-analysis-open');
  const status = document.querySelector('#stylist-analysis-status');
  if (!button || !status) return;
  const text = source => window.A1I18n.setText(status, source);
  let metrics = null, client = null;

  function valid(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
      && Number.isFinite(value.shoulderHipRatio) && value.shoulderHipRatio >= 0.45 && value.shoulderHipRatio <= 2.5
      && Number.isFinite(value.legTorsoRatio) && value.legTorsoRatio >= 0.6 && value.legTorsoRatio <= 3.5;
  }
  function clear() {
    if (client) {
      try { client.window.postMessage({ type: 'a1:analysis-cleared', nonce: client.nonce }, location.origin); }
      catch { /* A closed or navigated consultation window receives no data. */ }
    }
    client = null;
    metrics = null;
    button.disabled = true;
    text('무료 분석 후 비율 두 개를 A1 상담 화면으로 가져올 수 있습니다. 사진은 전달하지 않습니다.');
  }
  function nonce() {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
    const hex = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  }
  document.addEventListener('a1:analysis-ready', event => {
    clear();
    const value = event.detail?.metrics;
    if (!valid(value)) return;
    // Only these two validated numbers cross into another A1 page. Never read
    // the canvas, photo/file name, image bytes or full landmark result here.
    metrics = Object.freeze({ shoulderHipRatio: value.shoulderHipRatio, legTorsoRatio: value.legTorsoRatio });
    button.disabled = false;
    text('분석 비율을 상담 화면으로 가져올 수 있습니다. 외부 AI 전송은 상담 화면에서 별도로 동의해야 합니다.');
  });
  button.addEventListener('click', () => {
    if (!valid(metrics)) return;
    const value = metrics;
    clear();
    metrics = value; button.disabled = false;
    const key = nonce(), url = new URL('stylist.html', location.href);
    url.hash = 'analysis=' + key;
    let child;
    try { child = window.open(url.href, 'a1-stylist-' + key); } catch { child = null; }
    if (!child) {
      text('상담 창을 열지 못했습니다. 새 창을 허용하거나 A1 AI 스타일리스트 링크를 이용해주세요.');
      return;
    }
    client = { window: child, nonce: key, delivered: false };
    text('비율 두 개만 A1 상담 화면에 전달합니다. 사진은 기기 안에 남습니다.');
  });
  window.addEventListener('message', event => {
    const message = event.data;
    if (!client || client.delivered || !valid(metrics) || event.origin !== location.origin || event.source !== client.window
      || !message || typeof message !== 'object' || Array.isArray(message)
      || Object.keys(message).length !== 2 || message.type !== 'a1:request-analysis' || message.nonce !== client.nonce) return;
    client.delivered = true;
    client.window.postMessage({ type: 'a1:analysis-transfer', nonce: client.nonce,
      metrics: { shoulderHipRatio: metrics.shoulderHipRatio, legTorsoRatio: metrics.legTorsoRatio } }, location.origin);
  });
  document.addEventListener('a1:analysis-cleared', clear);
  document.addEventListener('a1:auth-changed', clear);
  window.addEventListener('storage', event => { if (event.key === 'a1-fashion:auth-event') clear(); });
  window.addEventListener('pagehide', clear);
  clear();
})();
