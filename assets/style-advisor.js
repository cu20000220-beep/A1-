/* AI provides 2D pose landmarks. These calculations and catalog matching are
   deterministic rules, not a second AI model or a size/health assessment. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.A1StyleAdvisor = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const POINTS = [11, 12, 23, 24, 25, 26, 27, 28];
  const fail = error => ({ ok: false, error });
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  function analyzePose(landmarks, imageWidth, imageHeight) {
    if (!Array.isArray(landmarks) || landmarks.length < 29 ||
        !Number.isFinite(imageWidth) || !Number.isFinite(imageHeight) ||
        imageWidth <= 0 || imageHeight <= 0) {
      return fail('전신 기준점을 찾지 못했습니다. 어깨부터 발목까지 보이는 사진을 선택해주세요.');
    }

    const points = POINTS.map(i => landmarks[i]);
    if (points.some(p => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y) ||
        !Number.isFinite(p.visibility) || p.visibility < 0.6)) {
      return fail('어깨·골반·무릎·발목 기준점이 충분히 확인되지 않았습니다. 한 사람이 정면으로 서 있는 밝은 전신 사진을 사용해주세요.');
    }
    if (points.some(p => p.x <= 0.005 || p.x >= 0.995 || p.y <= 0.005 || p.y >= 0.995)) {
      return fail('몸의 일부가 사진 가장자리에 닿거나 잘려 있습니다. 어깨부터 발목까지 여유 있게 보이는 사진을 선택해주세요.');
    }

    // Convert normalized coordinates to image pixels before comparing lengths.
    const [ls, rs, lh, rh, lk, rk, la, ra] = points.map(p => ({
      x: p.x * imageWidth, y: p.y * imageHeight
    }));
    const shoulders = midpoint(ls, rs), hips = midpoint(lh, rh);
    const shoulderPixels = distance(ls, rs), hipPixels = distance(lh, rh);
    const torsoPixels = distance(shoulders, hips);
    const legPixels = (distance(lh, lk) + distance(lk, la) +
      distance(rh, rk) + distance(rk, ra)) / 2;
    const span = ((la.y + ra.y) / 2) - shoulders.y;

    if (shoulderPixels < imageWidth * 0.035 || hipPixels < imageWidth * 0.025 ||
        torsoPixels < imageHeight * 0.06 || legPixels < imageHeight * 0.12 ||
        span < imageHeight * 0.2) {
      return fail('전신 비율을 비교하기 어려운 구도입니다. 옆모습이나 너무 먼 사진 대신 정면 전신 사진을 선택해주세요.');
    }
    const tilted = (a, b) => Math.abs(a.y - b.y) > Math.abs(a.x - b.x) * 0.5;
    if (tilted(ls, rs) || tilted(lh, rh) ||
        Math.abs(shoulders.x - hips.x) > torsoPixels * 0.4 ||
        hips.y <= shoulders.y || lk.y <= lh.y || rk.y <= rh.y ||
        la.y <= lk.y || ra.y <= rk.y) {
      return fail('몸이 기울거나 앉아 있어 비교가 어렵습니다. 카메라를 수평으로 두고 정면으로 서 있는 사진을 사용해주세요.');
    }

    const shoulderHipRatio = shoulderPixels / hipPixels;
    const legTorsoRatio = legPixels / torsoPixels;
    // Avoid displaying nonsensical ratios even if a model is very confident.
    if (shoulderHipRatio < 0.45 || shoulderHipRatio > 2.5 ||
        legTorsoRatio < 0.6 || legTorsoRatio > 3.5) {
      return fail('추정한 기준점의 비율이 불안정합니다. 옷이나 물건이 몸을 가리지 않는 다른 사진으로 다시 시도해주세요.');
    }
    const summary = shoulderHipRatio >= 1.25
      ? '사진 속 어깨 기준점 간격이 골반 기준점 간격보다 넓게 추정되었습니다.'
      : shoulderHipRatio <= 0.9
        ? '사진 속 골반 기준점 간격이 어깨 기준점 간격보다 넓게 추정되었습니다.'
        : '사진 속 어깨와 골반 기준점 간격이 비교적 가까운 범위로 추정되었습니다.';

    return {
      ok: true,
      metrics: {
        shoulderHipRatio, legTorsoRatio,
        shoulderPixels, hipPixels, torsoPixels, legPixels,
        confidence: Math.min(...points.map(p => p.visibility))
      },
      summary,
      notes: [
        '사진 한 장에서 AI가 추정한 2D 기준점의 간격입니다. 정확한 신체 치수나 체형 판정이 아닙니다.',
        '자세·카메라 각도·원근·입은 옷에 따라 결과가 달라집니다. 실제 사이즈나 건강 상태를 판단할 수 없습니다.',
        '아래 스타일 제안은 이 기준점과 선택한 취향을 사용하는 규칙 기반 상품 매칭입니다.'
      ]
    };
  }

  function recommend(products, analysis, preferences = {}) {
    if (!Array.isArray(products) || !analysis || analysis.ok !== true ||
        !analysis.metrics || !Number.isFinite(analysis.metrics.shoulderHipRatio)) return [];
    if (!preferences || typeof preferences !== 'object') return [];
    const { gender = '전체', style = '전체', budget = Infinity } = preferences;
    if (!['전체', '여성', '남성', '유니섹스'].includes(gender) ||
        typeof style !== 'string' ||
        (budget !== Infinity && (!Number.isSafeInteger(budget) || budget < 0))) return [];
    // Only an omitted budget means no limit; explicitly invalid values never do.
    if (Object.prototype.hasOwnProperty.call(preferences, 'budget') && budget === Infinity) return [];

    const ratio = analysis.metrics.shoulderHipRatio;
    const categoryPreference = ratio >= 1.25 ? ['하의', '상의', '아우터', '원피스', '액세서리']
      : ratio <= 0.9 ? ['상의', '아우터', '하의', '원피스', '액세서리']
        : ['아우터', '상의', '하의', '원피스', '액세서리'];

    return products
      .map((product, index) => ({ product, index }))
      .filter(({ product: p }) => p && p.availability !== 'soldOut' && Number.isFinite(p.price) && p.price >= 0 &&
        p.price <= budget && (style === '전체' || p.style === style) &&
        (gender === '전체' || p.gender === gender ||
          (gender !== '유니섹스' && p.gender === '유니섹스')))
      .map(({ product, index }) => {
        const priority = categoryPreference.indexOf(product.category);
        const reasons = [
          style === '전체' ? `${product.style} 스타일을 비교할 수 있는 후보입니다.` : `선택한 ${style} 스타일과 일치합니다.`,
          gender === '전체' ? '성별 컬렉션 제한 없이 고른 후보입니다.'
            : product.gender === '유니섹스' ? '선택한 컬렉션과 함께 볼 수 있는 유니섹스 상품입니다.'
              : `선택한 ${gender} 컬렉션의 상품입니다.`,
          priority === 0
            ? `사진 속 기준점 간격을 참고해 ${product.category} 아이템부터 비교하도록 제안합니다.`
            : `${product.category} 아이템을 함께 코디해보는 참고 제안입니다.`
        ];
        if (budget !== Infinity) reasons.push(product.source === 'external'
          ? '입력한 예산 이내의 외부 등록 가격입니다. 현재 가격·재고는 판매처에서 확인해주세요.'
          : '입력한 예산 이내의 예시 가격입니다.');
        return { product, reasons, priority: priority < 0 ? 99 : priority, index };
      })
      .sort((a, b) => a.priority - b.priority || a.index - b.index)
      .slice(0, 4)
      .map(({ product, reasons }) => ({ product, reasons }));
  }

  return Object.freeze({ analyzePose, recommend });
});
