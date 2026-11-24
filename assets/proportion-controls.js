/* Optional, ephemeral inputs for the on-device recommendation screen. */
'use strict';
(() => {
  function create(target, consent, onChange, { prefix = 'shopping', showGuidance = true } = {}) {
    const I = window.A1I18n;
    const model = window.A1ProportionProfile;
    if (!target || !consent || !I || !model) return null;

    const labels = {
      heightCm: ['키', 'Height'],
      shoulderWidthCm: ['어깨 너비', 'Shoulder width'],
      hipWidthCm: ['골반 너비', 'Hip width'],
      torsoCm: ['상체 길이 · 어깨 높이에서 골반 관절 높이까지', 'Upper-body length · shoulder to hip-joint level'],
      legCm: ['다리 길이 · 골반 관절에서 발목까지', 'Leg length · hip joint to ankle'],
      armCm: ['팔 길이 · 어깨에서 팔꿈치를 지나 손목까지', 'Arm length · shoulder through elbow to wrist'],
      waistCircumferenceCm: ['허리둘레', 'Waist circumference'],
      hipCircumferenceCm: ['골반둘레', 'Hip circumference']
    };
    const ratioLabels = {
      shoulderHip: ['어깨 / 골반 너비', 'Shoulder / hip width'],
      legTorso: ['하체 / 상체 길이', 'Leg / upper-body length'],
      waistHip: ['허리 / 골반 둘레', 'Waist / hip circumference'],
      armLeg: ['팔 / 다리 길이', 'Arm / leg length'],
      torsoHeight: ['키 대비 상체 길이', 'Upper-body length relative to height'],
      legHeight: ['키 대비 다리 길이', 'Leg length relative to height'],
      armHeight: ['키 대비 팔 길이', 'Arm length relative to height']
    };
    I.register({
      ...Object.fromEntries([...Object.values(labels), ...Object.values(ratioLabels)]),
      '치수 직접 입력 · 선택': 'Enter measurements · optional',
      'cm 단위로 알고 있는 항목만 입력하세요. 너비는 좌우 직선 거리이고, 둘레는 몸을 한 바퀴 잰 값입니다.': 'Enter the measurements you know in cm. Width is the straight distance across the body. Circumference is measured around it.',
      '직접 입력 치수는 기기 안에서만 사용합니다. 두 치수가 모두 있는 비율을 계산하고, 같은 항목의 사진 추정치보다 우선합니다.': 'Measurements stay on this device. Complete pairs produce ratios and take priority over photo estimates for the same ratio.',
      '입력 치수 적용': 'Apply measurements',
      '입력 치수 지우기': 'Clear measurements',
      '입력 치수를 확인해주세요. 키 대비 길이나 치수 간 비율이 입력 범위를 벗어났습니다.': 'Check the entered values. A measurement or calculated ratio is outside the supported range.',
      '한 쌍의 치수를 모두 입력하면 해당 비율을 계산할 수 있습니다.': 'Enter both measurements in a pair to calculate a ratio.',
      '직접 입력 치수로 비율을 계산했습니다.': 'Ratios calculated from your measurements.',
      '사진상 추정 비율': 'Estimated from the photo',
      '직접 입력 치수로 계산한 비율': 'Calculated from entered measurements',
      '비율별로 비교해 볼 의류 특성': 'Garment features to compare by proportion',
      '상품 카드에는 판매처 자료에서 확인된 특성만 추천 근거로 표시합니다.': 'Cards cite garment features confirmed in retailer information.',
      '사진으로는 키와 허리·골반 둘레를 알 수 없습니다. 팔이 가려지거나 굽혀져 있으면 팔 비율도 직접 입력으로 보완하세요.': 'Enter height and waist and hip circumferences directly. You can also enter arm length when arms are hidden or bent.',
      '{name} (cm)': '{name} (cm)'
    });

    const node = (tag) => document.createElement(tag);
    const labeled = (tag, source) => {
      const item = node(tag);
      I.setText(item, source);
      return item;
    };

    const summary = node('div');
    summary.className = 'shopping-proportion-summary';
    const guidance = node('div');
    guidance.className = 'shopping-proportion-guidance';
    const details = node('details');
    details.className = 'shopping-proportion-measurements';
    details.append(labeled('summary', '치수 직접 입력 · 선택'),
      labeled('p', 'cm 단위로 알고 있는 항목만 입력하세요. 너비는 좌우 직선 거리이고, 둘레는 몸을 한 바퀴 잰 값입니다.'),
      labeled('p', '사진으로는 키와 허리·골반 둘레를 알 수 없습니다. 팔이 가려지거나 굽혀져 있으면 팔 비율도 직접 입력으로 보완하세요.'));
    const fieldset = node('fieldset');
    fieldset.className = 'shopping-proportion-fields';
    const inputs = new Map();
    for (const [key, { min, max }] of Object.entries(model.fields)) {
      const label = node('label');
      const name = node('span');
      const input = node('input');
      input.type = 'number';
      input.inputMode = 'decimal';
      input.min = String(min);
      input.max = String(max);
      input.step = '0.1';
      input.autocomplete = 'off';
      input.id = prefix + '-proportion-' + key.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase());
      input.dataset.proportionField = key;
      inputs.set(key, { input, name });
      label.append(name, input);
      fieldset.append(label);
    }
    const actions = node('div');
    actions.className = 'shopping-proportion-actions';
    const apply = labeled('button', '입력 치수 적용');
    const reset = labeled('button', '입력 치수 지우기');
    apply.type = reset.type = 'button';
    apply.id = prefix + '-proportion-apply';
    reset.id = prefix + '-proportion-reset';
    actions.append(apply, reset);
    const status = node('p');
    status.id = prefix + '-proportion-status';
    status.setAttribute('role', 'status');
    details.append(fieldset, actions, status,
      labeled('p', '직접 입력 치수는 기기 안에서만 사용합니다. 두 치수가 모두 있는 비율을 계산하고, 같은 항목의 사진 추정치보다 우선합니다.'));
    target.append(details, summary, guidance);

    let photo = {};
    let base = model.build();
    let profile = model.build();
    function ratioValue(key, value) {
      const formatter = new Intl.NumberFormat(I.locale,
        key.endsWith('Height') ? { style: 'percent', maximumFractionDigits: 1 } : { maximumFractionDigits: 2 });
      return formatter.format(value);
    }
    function render() {
      for (const [key, { name }] of inputs) I.setText(name, '{name} (cm)', { name: I.t(labels[key][0]) });
      summary.replaceChildren();
      for (const [basis, title] of [['photo', '사진상 추정 비율'], ['manual', '직접 입력 치수로 계산한 비율']]) {
        const entries = Object.entries(profile).filter(([, entry]) => entry.basis === basis);
        if (!entries.length) continue;
        const group = node('section');
        const list = node('dl');
        for (const [key, entry] of entries) list.append(labeled('dt', ratioLabels[key][0]),
          Object.assign(node('dd'), { textContent: ratioValue(key, entry.value) }));
        group.append(labeled('h3', title), list);
        summary.append(group);
      }
      summary.hidden = !summary.children.length;

      guidance.replaceChildren();
      const explain = window.A1ProductDiscoveryView?.proportionText;
      const suggestions = showGuidance && consent.checked && explain
        ? (window.A1ProportionRecommendations?.guidance(profile) || []).map(explain).filter(Boolean) : [];
      if (suggestions.length) {
        const list = node('ul');
        for (const text of new Set(suggestions)) list.append(Object.assign(node('li'), { textContent: text }));
        guidance.append(labeled('h3', '비율별로 비교해 볼 의류 특성'), list,
          labeled('p', '상품 카드에는 판매처 자료에서 확인된 특성만 추천 근거로 표시합니다.'));
      }
      guidance.hidden = !guidance.children.length;
    }

    function setProfile(value) {
      profile = value;
      const available = Object.keys(profile).length > 0;
      consent.disabled = !available;
      if (!available) consent.checked = false;
      render();
    }
    function clearManual() {
      for (const { input } of inputs.values()) input.value = '';
      I.setText(status, '');
      setProfile(base);
    }
    function setPhoto(value) {
      try {
        const next = value || {};
        base = model.build(next);
        photo = next;
        clearManual();
      } catch {
        photo = {};
        base = model.build();
        clearManual();
      }
    }

    apply.addEventListener('click', () => {
      const values = {};
      try {
        for (const [key, { input }] of inputs) {
          if (!input.validity.valid) throw new TypeError('proportion_value_invalid');
          if (input.value !== '') values[key] = input.valueAsNumber;
        }
        const next = model.validate({...base, ...model.build(photo, values)});
        setProfile(next);
        I.setText(status, Object.values(next).some(entry => entry.basis === 'manual')
          ? '직접 입력 치수로 비율을 계산했습니다.' : '한 쌍의 치수를 모두 입력하면 해당 비율을 계산할 수 있습니다.');
      } catch {
        setProfile(base);
        I.setText(status, '입력 치수를 확인해주세요. 키 대비 길이나 치수 간 비율이 입력 범위를 벗어났습니다.');
      }
      onChange();
    });
    reset.addEventListener('click', () => { clearManual(); onChange(); });
    document.addEventListener('a1:language-changed', render);
    setProfile(profile);

    return Object.freeze({
      current: () => consent.checked ? profile : null,
      setPhoto,
      setBase(value) { photo = {}; base = value ? model.validate(value) : model.build(); clearManual(); },
      clearManual,
      render,
      clear() { consent.checked = false; setPhoto(null); }
    });
  }
  window.A1ProportionControls = Object.freeze({ create });
})();
