'use strict';
(() => {
  const $ = selector => document.querySelector(selector);
  let mode = 'login', configured = false, busy = false, authenticated = false;
  let revision = 0, expiryTimer;
  const editorial = $('.account-editorial img');
  function fallbackPhoto() {
    editorial.removeEventListener('error', fallbackPhoto);
    editorial.src = 'assets/placeholder.svg';
    editorial.alt = 'A1 FASHION 스타일 이미지';
  }
  editorial.addEventListener('error', fallbackPhoto, { once: true });
  if (editorial.complete && !editorial.naturalWidth) fallbackPhoto();

  function status(message = '', error = false) {
    $('#auth-status').textContent = message;
    $('#auth-status').classList.toggle('is-error', error);
  }
  function clearPasswords() {
    for (const id of ['#auth-password', '#auth-confirm', '#auth-delete-password']) $(id).value = '';
    $('#auth-confirm').setCustomValidity('');
  }
  function controls() {
    $('#auth-fields').disabled = !configured || busy || authenticated;
    for (const id of ['#auth-tab-login', '#auth-tab-signup', '#auth-reset', '#auth-resend', '#auth-back-login', '#auth-retry', '#auth-logout', '#auth-delete-submit']) $(id).disabled = busy;
    $('#auth-resend').disabled = busy || !configured;
    $('#auth-delete-password').disabled = busy;
    $('#auth-delete-confirm').disabled = busy;
    $('#auth-form').setAttribute('aria-busy', String(busy));
  }
  function setMode(next, keepStatus = false) {
    mode = next;
    clearPasswords();
    const signup = mode === 'signup', reset = mode === 'reset';
    $('#account-title').textContent = signup ? '나의 A1을 시작하세요.' : reset ? '비밀번호를 다시 설정해요.' : '다시 만나 반가워요.';
    $('#auth-intro').textContent = signup ? '이메일 확인 후 무료 회원가입을 완료할 수 있어요.' : reset ? '가입한 이메일로 비밀번호 재설정 방법을 안내합니다.' : '이메일로 로그인하고 나의 계정을 확인하세요.';
    $('#auth-tab-login').setAttribute('aria-pressed', String(!signup));
    $('#auth-tab-signup').setAttribute('aria-pressed', String(signup));
    $('#auth-password-label').hidden = reset;
    $('#auth-password').disabled = reset;
    $('#auth-password').required = !reset;
    $('#auth-password').minLength = signup ? 12 : 1;
    $('#auth-password').autocomplete = signup ? 'new-password' : 'current-password';
    $('#auth-password-guide').hidden = !signup;
    $('#auth-confirm-label').hidden = !signup;
    $('#auth-confirm').disabled = !signup;
    $('#auth-confirm').required = signup;
    $('#auth-consent-label').hidden = !signup;
    $('#auth-consent').disabled = !signup;
    $('#auth-consent').required = signup;
    $('#auth-consent').checked = false;
    $('#auth-reset').hidden = mode !== 'login';
    $('#auth-resend').hidden = mode !== 'login';
    $('#auth-back-login').hidden = !reset;
    $('#auth-submit').textContent = signup ? '무료 회원가입' : reset ? '재설정 메일 요청' : '로그인';
    if (!keepStatus) status();
    controls();
  }
  function notice(action) {
    // A cross-tab notice can only clear paid UI; it never grants access.
    try { localStorage.setItem('a1-fashion:auth-event', JSON.stringify({ action, at: Date.now(), nonce: Math.random() })); } catch { /* Cookie authentication still works when storage is unavailable. */ }
    document.dispatchEvent(new Event('a1:auth-changed'));
  }
  function showGuest() {
    authenticated = false;
    clearTimeout(expiryTimer);
    $('#auth-member').hidden = true;
    $('#auth-guest').hidden = false;
    $('#auth-user-email').textContent = '';
    $('#auth-session-note').textContent = '';
    $('#auth-delete-confirm').checked = false;
    $('.account-delete').open = false;
    setMode('login', true);
  }
  function showMember(data) {
    if (!data?.user || typeof data.user.email !== 'string' || data.user.email.length > 254 || data.user.emailVerified !== true || !Number.isSafeInteger(data.expiresAt) || data.expiresAt <= Date.now()) throw new Error('invalid-session');
    authenticated = true;
    clearPasswords();
    clearTimeout(expiryTimer);
    $('#auth-guest').hidden = true;
    $('#auth-member').hidden = false;
    $('#account-title').textContent = '나의 A1 계정';
    $('#auth-intro').textContent = '이메일 확인을 마친 회원 계정입니다.';
    $('#auth-user-email').textContent = data.user.email;
    $('#auth-session-note').textContent = '보안을 위해 로그인은 최대 1시간 동안 유지되며, 만료되면 다시 로그인해주세요.';
    expiryTimer = setTimeout(() => {
      revision++;
      busy = false;
      showGuest();
      notice('expired');
      status('로그인 유지 시간이 끝났습니다. 다시 로그인해주세요.');
    }, Math.min(data.expiresAt - Date.now(), 3600000));
    controls();
  }
  async function api(action, payload) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(`api/auth/${action}`, {
        method: payload === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { Accept: 'application/json', ...(payload === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(payload === undefined ? {} : { body: JSON.stringify(payload) }), signal: controller.signal
      });
      let data;
      try { data = await response.json(); } catch { data = {}; }
      return { response, data };
    } finally { clearTimeout(timer); }
  }
  function errorMessage(data) {
    const messages = {
      setup_required: '회원 서비스를 연결하는 중입니다. 지금은 계정을 만들거나 로그인할 수 없습니다.',
      email_verification_required: '가입 이메일의 확인 링크를 먼저 열어주세요. 인증 메일을 다시 받으려면 비밀번호를 다시 입력한 뒤 ‘인증 메일 다시 보내기’를 누르세요.',
      authentication_required: '로그인 정보를 확인할 수 없습니다. 이메일과 비밀번호를 확인하고 다시 로그인해주세요.',
      invalid_credentials: '이메일 또는 비밀번호를 확인해주세요.',
      too_many_requests: '요청이 많아 잠시 기다려야 합니다. 잠시 후 다시 시도해주세요.'
    };
    return messages[data?.error] || (typeof data?.message === 'string' && data.message.length < 600 ? data.message : '요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.');
  }
  async function action(path, payload, onSuccess) {
    if (!configured || busy) return;
    const token = ++revision;
    busy = true;
    controls();
    status('안전하게 처리하고 있습니다.');
    try {
      const { response, data } = await api(path, payload);
      if (token !== revision) return;
      if (!response.ok || data.ok !== true) {
        status(errorMessage(data), true);
        return;
      }
      onSuccess(data);
    } catch {
      if (token === revision) status('처리 결과를 확인하지 못했습니다. 가입을 시도했다면 이메일을 확인하거나 로그인으로 계정 상태를 확인해주세요.', true);
    } finally {
      if (token === revision) { busy = false; clearPasswords(); controls(); }
    }
  }
  async function load() {
    const token = ++revision;
    busy = true;
    configured = false;
    controls();
    $('#auth-config-status').textContent = '회원 서비스 연결을 확인하고 있습니다.';
    $('#auth-retry').hidden = true;
    try {
      const config = await api('config');
      if (token !== revision) return;
      if (!config.response.ok || config.data.configured !== true) {
        showGuest();
        $('#auth-config-status').textContent = '회원가입 연결 준비 중입니다. 아직 이메일·비밀번호를 입력하거나 계정을 만들 수 없습니다. 무료 사진 분석은 계속 이용할 수 있습니다.';
        $('#auth-retry').hidden = false;
        return;
      }
      configured = true;
      const session = await api('session');
      if (token !== revision) return;
      if (session.response.ok && session.data.authenticated === true) showMember(session.data);
      else if (session.response.status === 401) showGuest();
      else throw new Error('session-unavailable');
      $('#auth-config-status').textContent = '회원가입은 무료이며 이메일 확인 후 로그인할 수 있습니다.';
    } catch {
      if (token === revision) {
        configured = false;
        showGuest();
        $('#auth-config-status').textContent = '회원 서비스 연결을 확인하지 못했습니다. 잠시 후 다시 확인해주세요.';
        $('#auth-retry').hidden = false;
      }
    } finally { if (token === revision) { busy = false; controls(); } }
  }
  $('#auth-tab-login').addEventListener('click', () => { if (!busy) setMode('login'); });
  $('#auth-tab-signup').addEventListener('click', () => { if (!busy) setMode('signup'); });
  $('#auth-reset').addEventListener('click', () => { if (!busy) setMode('reset'); });
  $('#auth-back-login').addEventListener('click', () => { if (!busy) setMode('login'); });
  $('#auth-confirm').addEventListener('input', () => $('#auth-confirm').setCustomValidity(''));
  $('#auth-password').addEventListener('input', () => $('#auth-confirm').setCustomValidity(''));
  $('#auth-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!configured || busy) return;
    if (mode === 'signup' && $('#auth-password').value !== $('#auth-confirm').value) {
      $('#auth-confirm').setCustomValidity('비밀번호가 일치하지 않습니다.');
    }
    if (!$('#auth-form').reportValidity()) return;
    const email = $('#auth-email').value.trim();
    if (mode === 'reset') {
      action('reset-password', { email }, () => status('해당 이메일로 가입된 계정이 있으면 비밀번호 재설정 안내가 전송됩니다. 메일함과 스팸함을 확인해주세요.'));
    } else if (mode === 'signup') {
      action('signup', { email, password: $('#auth-password').value }, data => {
        setMode('login', true);
        status(data.verificationEmailSent === false ? '계정은 생성됐지만 인증 메일을 보내지 못했습니다. 비밀번호를 다시 입력하고 ‘인증 메일 다시 보내기’를 눌러주세요.' : '계정이 생성됐습니다. 이메일의 확인 링크를 열고 이 화면으로 돌아와 로그인해주세요. 아직 로그인되거나 구독이 시작된 상태는 아닙니다.');
      });
    } else {
      action('login', { email, password: $('#auth-password').value }, data => { showMember(data); notice('login'); status('로그인했습니다. 회원가입과 유료 구독은 별개입니다.'); });
    }
  });
  $('#auth-resend').addEventListener('click', () => {
    if (!configured || busy || mode !== 'login' || !$('#auth-form').reportValidity()) return;
    action('verify-email', { email: $('#auth-email').value.trim(), password: $('#auth-password').value }, data => status(data.emailVerificationRequired === false ? '이미 이메일 확인을 완료했습니다. 다시 로그인해주세요.' : '인증 메일을 요청했습니다. 메일함과 스팸함을 확인한 뒤 로그인해주세요.'));
  });
  $('#auth-logout').addEventListener('click', () => action('logout', {}, () => { showGuest(); notice('logout'); status('로그아웃했습니다. 무료 사진 분석은 계속 이용할 수 있습니다.'); }));
  $('#auth-delete-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!authenticated || !$('#auth-delete-form').reportValidity()) return;
    action('delete-account', { password: $('#auth-delete-password').value }, () => { showGuest(); $('#auth-email').value = ''; notice('deleted'); status('회원 계정을 삭제하고 로그아웃했습니다.'); });
  });
  $('#auth-retry').addEventListener('click', () => { if (!busy) load(); });
  window.addEventListener('storage', event => { if (event.key === 'a1-fashion:auth-event' && !busy) load(); });
  window.addEventListener('pagehide', () => { revision++; busy = false; showGuest(); clearPasswords(); status(); });
  window.addEventListener('pageshow', event => { if (event.persisted) load(); });
  const returnTo = new URLSearchParams(location.search).get('returnTo');
  if (returnTo === 'premium') $('#auth-continue').href = 'index.html#premium';
  setMode('login');
  load();
})();
