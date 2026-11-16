'use strict';
(() => {
  const root = document.querySelector('#studio-root'), I = window.A1I18n;
  if (!root || !I) return;
  const translations = {
    'A1 FASHION · 스타일 스튜디오': 'A1 FASHION · Style Studio',
    '남녀 가상 모델의 실사 스타일 이미지를 방향과 의상별로 비교하는 무료 A1 FASHION 스튜디오': 'A free A1 FASHION studio for comparing virtual male and female style images across views and outfits',
    'A1 FASHION 홈': 'A1 FASHION home', '주요 메뉴': 'Main navigation', '스타일 스튜디오': 'Style studio', '무료 스타일 상담': 'Free style advice',
    '내가 좋아할': 'Your next', '다음 스타일.': 'favorite look.', '자연스러운 인물과 의류의 질감.': 'Natural faces and the texture of clothing.', '다양한 방향과 스타일을 한눈에 비교하세요.': 'Compare different views and styles at a glance.',
    '스타일 살펴보기': 'Explore styles', '내 사진 체형 분석': 'Analyze my photo', '모든 이용자 무료 베타': 'Free beta for everyone',
    '크림색 니트를 입은 남녀 가상 패션 모델': 'Virtual male and female fashion models wearing cream knitwear',
    '스타일 이미지 미리보기 · 2D': 'Style image preview · 2D', 'AI로 제작한 가상 인물·예시 의상 이미지입니다. 실제 판매 상품이나 사용자 사진의 합성 결과가 아닙니다.': 'AI-created virtual people and example outfits. These are not retail products or composites of your photo.',
    '마음에 드는 스타일을': 'Find a look', '골라보세요.': 'you love.', '모델을 선택하고,': 'Choose a model,', '방향과 의상을 바꿔보세요.': 'then change the view and outfit.',
    '선택한 스타일 이미지': 'Selected style image', '스타일 선택': 'Style selection', '나의 취향 찾기': 'Discover your style', '보이는 이미지를 직접 비교해보세요.': 'Compare the images for yourself.',
    '가상 모델': 'Virtual model', '남성 모델': 'Male model', '여성 모델': 'Female model', '보는 방향': 'View', '정면': 'Front', '사선': 'Three-quarter', '측면': 'Side', '후면': 'Back',
    '방향별로 준비한 이미지를 표시합니다. 연속 회전하는 3D 모델은 아닙니다.': 'Displays prepared images for each direction. This is not a continuously rotating 3D model.',
    '의상별 이미지는 정면만 준비되어 있습니다. 다른 방향은 기본 의상에서 확인하세요.': 'Outfit images are available from the front only. Use the base outfit for other views.',
    '기본 의상': 'Base outfit', '실루엣을 비교하기 위한 기본 스타일입니다.': 'A base style for comparing the silhouette.', '기본 의상과 방향 보기': 'View base outfit and angles',
    '스타일 이미지를 준비하고 있습니다.': 'Preparing the style images.', '이미지 다시 불러오기': 'Reload images', '처음 선택으로': 'Reset selection',
    '어떤 옷이 좋을지 고민된다면': 'Need help choosing a look?', '무료 규칙 기반 스타일 상담': 'Free rule-based style advice',
    '다른 스타일도 만나보세요.': 'Explore more looks.', '예시 의상 · 실제 상품 아님': 'Example outfits · Not retail products', '예시 의상 선택': 'Choose an example outfit',
    '스타일에서,': 'From a style,', '나에게 맞는 선택으로.': 'to your next choice.', '기존 기기 내 사진 분석으로 이동합니다.': 'Continue to the existing on-device photo analysis.',
    '내 사진 로컬 2D 미리보기': 'Local 2D photo preview', '별도 동의 후 기기 안에서 이미지 배치를 체험하세요.': 'With separate consent, try placing images locally on your device.',
    '실제 3D 연구실': 'Actual 3D lab', '회전 가능한 3D 인체 샘플은 별도 화면에서 확인하세요.': 'View the rotatable 3D human sample on a separate screen.',
    '국내 의류 검색': 'Korean clothing search', '원하는 조건으로 공식 판매처 검색을 시작하세요.': 'Start an official retailer search with your clothing preferences.',
    '나를 이해하는 스타일, A1 FASHION.': 'Style that understands you. A1 FASHION.', '이 화면은 2D 스타일 비교입니다. 사진 기반 개인화·실제 상품 피팅·정확한 사이즈 보장을 제공하지 않습니다.': 'This screen compares 2D styles. It does not provide photo-based personalization, retail product fitting or exact size guarantees.',
    '개인정보 처리 안내': 'Privacy information',
    '레더 재킷': 'Leather jacket', '후디 셋업': 'Hoodie set', '테일러드 수트': 'Tailored suit', '트렌치 코트': 'Trench coat', '데님 셋업': 'Denim set',
    '블랙 블레이저': 'Black blazer', '화이트 셔츠': 'White shirt', '데일리 니트': 'Everyday knit', '블랙 드레스': 'Black dress', '블루 원피스': 'Blue dress',
    '질감과 전체 실루엣을 확인하는 스타일 이미지입니다.': 'A style image for exploring texture and the overall silhouette.',
    '선택한 스타일의 정면 이미지를 표시했습니다. 다른 방향은 기본 의상에서 확인하세요.': 'The selected style is shown from the front. Use the base outfit for other views.',
    '선택한 방향의 기본 의상 이미지를 표시했습니다.': 'The base outfit is shown from the selected direction.',
    '이미지를 읽지 못했습니다. 연결을 확인하고 다시 불러오기를 눌러주세요.': 'The image could not load. Check the connection and select Reload images.',
    '남성 가상 모델의 기본 의상 정면 이미지': 'Front image of a virtual male model in the base outfit',
    '남성 가상 모델의 스타일 이미지': 'Style image of a virtual male model', '여성 가상 모델의 스타일 이미지': 'Style image of a virtual female model'
  };
  I.register(translations);
  const $ = selector => document.querySelector(selector);
  const images = Object.freeze({ male: 'assets/studio/male-sheet.png', female: 'assets/studio/female-sheet.png' });
  const directions = Object.freeze({ front: ['정면', 0], quarter: ['사선', 1], side: ['측면', 2], back: ['후면', 3] });
  const looks = Object.freeze({ male: ['레더 재킷', '후디 셋업', '테일러드 수트', '트렌치 코트', '데님 셋업'], female: ['블랙 블레이저', '화이트 셔츠', '데일리 니트', '블랙 드레스', '블루 원피스'] });
  const loaded = new Set();
  const failedImages = new Set();
  const versions = { male: 0, female: 0 };
  function sheetUrl(model) {
    const url = new URL(images[model], location.href);
    if (versions[model]) url.searchParams.set('v', 'retry-' + versions[model]);
    return url.href;
  }
  let avatar = 'male', direction = 'front', style = null, state = 'loading', generation = 0, pendingImage = null, timer = null;
  function setState(next) {
    state = next; root.dataset.state = next;
    $('#studio-loading').hidden = next === 'ready';
    $('#studio-retry').hidden = next !== 'error';
    for (const button of root.querySelectorAll('[data-avatar-choice],[data-direction],[data-style],#studio-base')) button.disabled = next !== 'ready';
    if (next === 'ready') for (const button of $('#studio-directions').querySelectorAll('button')) button.disabled = style !== null;
  }
  function setStatus(source) {
    I.setText($('#studio-status'), source);
    I.setText($('#studio-loading p'), source);
  }
  function selectedCell() { return style === null ? directions[direction][1] : 4 + style; }
  function showSelectedImage() {
    // Complete the reveal with the selection itself. Native smooth scrolling
    // can be cancelled by focus changes and leave the new image off-screen.
    $('#studio-model').scrollIntoView({ block: 'center', behavior: 'auto' });
  }
  function styleCards() {
    const grid = $('#studio-style-grid'); grid.replaceChildren();
    looks[avatar].forEach((label, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'look-card'; button.dataset.style = String(index); button.setAttribute('aria-pressed', String(index === style));
      const preview = document.createElement('span'); preview.className = 'studio-sprite'; preview.dataset.avatar = avatar; preview.dataset.cell = String(index + 4); preview.setAttribute('aria-hidden', 'true');
      const name = document.createElement('span'); name.className = 'look-card-label';
      const title = document.createElement('span'); I.setText(title, label);
      const arrow = document.createElement('span'); arrow.textContent = '↗'; arrow.setAttribute('aria-hidden', 'true'); name.append(title, arrow); button.append(preview, name); grid.append(button);
    });
  }
  function render() {
    const cell = selectedCell(), view = $('#studio-model'); view.dataset.avatar = avatar; view.dataset.cell = String(cell);
    const source = avatar === 'male' ? '남성 가상 모델의 스타일 이미지' : '여성 가상 모델의 스타일 이미지'; view.setAttribute('aria-label', source);
    $('#studio-model-name').textContent = avatar === 'male' ? 'MODEL A' : 'MODEL B';
    I.setText($('#studio-selected-style'), style === null ? '기본 의상' : looks[avatar][style]);
    I.setText($('#studio-selected-detail'), style === null ? '실루엣을 비교하기 위한 기본 스타일입니다.' : '질감과 전체 실루엣을 확인하는 스타일 이미지입니다.');
    const current = $('#studio-current-view'); current.replaceChildren();
    for (const text of [style === null ? '기본 의상' : looks[avatar][style], ' · ', directions[direction][0]]) {
      const span = document.createElement('span'); I.setText(span, text); current.append(span);
    }
    for (const button of $('#studio-avatar').querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.avatarChoice === avatar));
    for (const button of $('#studio-directions').querySelectorAll('button')) button.setAttribute('aria-pressed', String(style === null && button.dataset.direction === direction));
    for (const button of $('#studio-style-grid').querySelectorAll('button')) button.setAttribute('aria-pressed', String(Number(button.dataset.style) === style));
    setState(state);
    I.refresh();
  }
  function cancelLoad() {
    clearTimeout(timer); timer = null;
    if (pendingImage) { pendingImage.onload = pendingImage.onerror = null; pendingImage.removeAttribute('src'); pendingImage = null; }
  }
  function loadAvatar(next, reveal = false) {
    if (!Object.hasOwn(images, next)) return;
    if (failedImages.delete(next)) versions[next]++;
    const url = sheetUrl(next);
    root.style.setProperty('--studio-' + next + '-sheet', 'url("' + url + '")');
    const token = ++generation; cancelLoad(); avatar = next; direction = 'front'; style = null; styleCards();
    if (loaded.has(next)) { setState('ready'); render(); setStatus('선택한 방향의 기본 의상 이미지를 표시했습니다.'); if (reveal) showSelectedImage(); return; }
    setState('loading'); render(); setStatus('스타일 이미지를 준비하고 있습니다.');
    const image = new Image(); pendingImage = image; image.referrerPolicy = 'no-referrer';
    const fail = () => { if (token !== generation) return; failedImages.add(next); cancelLoad(); setState('error'); setStatus('이미지를 읽지 못했습니다. 연결을 확인하고 다시 불러오기를 눌러주세요.'); };
    image.onload = () => {
      if (token !== generation) return;
      if (!image.naturalWidth || !image.naturalHeight) { fail(); return; }
      loaded.add(next); cancelLoad(); setState('ready'); render(); setStatus('선택한 방향의 기본 의상 이미지를 표시했습니다.');
      if (reveal) showSelectedImage();
    };
    image.onerror = fail; timer = setTimeout(fail, 30000); image.src = url;
  }
  $('#studio-avatar').addEventListener('click', event => { const button = event.target.closest('[data-avatar-choice]'); if (button && !button.disabled) loadAvatar(button.dataset.avatarChoice, true); });
  $('#studio-directions').addEventListener('click', event => {
    const button = event.target.closest('[data-direction]'); if (!button || button.disabled || !Object.hasOwn(directions, button.dataset.direction)) return;
    direction = button.dataset.direction; style = null; render(); setStatus('선택한 방향의 기본 의상 이미지를 표시했습니다.');
    showSelectedImage();
  });
  $('#studio-style-grid').addEventListener('click', event => {
    const button = event.target.closest('[data-style]'); if (!button || button.disabled) return;
    const index = Number(button.dataset.style); if (!Number.isInteger(index) || index < 0 || index >= 5) return;
    style = index; direction = 'front'; render(); setStatus('선택한 스타일의 정면 이미지를 표시했습니다. 다른 방향은 기본 의상에서 확인하세요.');
    showSelectedImage();
  });
  $('#studio-base').addEventListener('click', () => { style = null; direction = 'front'; render(); setStatus('선택한 방향의 기본 의상 이미지를 표시했습니다.'); showSelectedImage(); });
  $('#studio-reset').addEventListener('click', () => loadAvatar('male', true));
  $('#studio-retry').addEventListener('click', () => { loaded.delete(avatar); loadAvatar(avatar, true); });
  const hero = $('#studio-hero'); hero.addEventListener('error', () => { hero.hidden = true; });
  window.addEventListener('pagehide', () => { if (state === 'loading') failedImages.add(avatar); generation++; cancelLoad(); loaded.clear(); });
  window.addEventListener('pageshow', event => { if (event.persisted && state === 'loading') loadAvatar(avatar); });
  Object.defineProperty(window, 'A1FittingStudio', { value: Object.freeze({ snapshot() { return { avatar, direction, style, cell: selectedCell(), state, imageMode: '2d-static', actual3D: false }; } }), writable: false, configurable: false });
  loadAvatar('male');
})();
