/* Own catalog records are published product information, not orders.
   No payment, stock reservation or customer-data storage is enabled here. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.A1CatalogRules = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const GENDERS = new Set(['여성', '남성', '유니섹스']);
  const CATEGORIES = new Set(['상의', '하의', '아우터', '원피스', '액세서리']);
  const STYLES = new Set(['미니멀', '캐주얼', '클래식', '스트리트']);
  const AVAILABILITY = new Set(['preparing', 'available', 'soldOut']);
  const FULFILLMENT = new Set(['own-stock', 'purchase-after-confirmation']);
  const ID = /^own-[a-z0-9]+(?:-[a-z0-9]+)*$/;
  // Local, reviewed image assets only; no URLs, query strings or encoded paths.
  const PHOTO = /^assets\/photos\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:jpe?g|png|webp)$/i;
  const UNSAFE_TEXT = /[<>"'`&\\\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/;

  function plainRecord(entry) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
    const prototype = Object.getPrototypeOf(entry);
    return prototype === Object.prototype || prototype === null;
  }

  function text(value, max, required = false) {
    if (value === undefined && !required) return '';
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    if ((required && !normalized) || normalized.length > max || UNSAFE_TEXT.test(normalized)) return null;
    return normalized;
  }

  function prepareOwnProducts(entries) {
    const products = [], errors = [];
    if (!Array.isArray(entries)) {
      return { products, errors: ['자사 상품 목록은 배열이어야 합니다.'] };
    }
    // Reject every ambiguous duplicate rather than choosing one price or record.
    const counts = new Map();
    for (const entry of entries) {
      if (plainRecord(entry) && typeof entry.id === 'string') {
        counts.set(entry.id, (counts.get(entry.id) || 0) + 1);
      }
    }

    entries.forEach((entry, index) => {
      const fail = message => errors.push(`상품 ${index + 1}: ${message}`);
      if (!plainRecord(entry)) { fail('상품 정보는 객체여야 합니다.'); return; }
      if (entry.source !== 'own') {
        fail('자사 상품은 source를 own으로 명시해야 합니다. 예시 상품은 자사 상품으로 변환하지 않습니다.');
        return;
      }
      if (typeof entry.id !== 'string' || entry.id.length > 64 || !ID.test(entry.id)) {
        fail('상품 ID는 own-으로 시작하는 영문 소문자·숫자·하이픈 형식이어야 합니다.');
        return;
      }
      if (counts.get(entry.id) > 1) { fail('중복된 상품 ID가 있어 등록하지 않았습니다.'); return; }
      const name = text(entry.name, 100, true);
      const color = text(entry.color, 80);
      const sizes = text(entry.sizes, 160);
      const material = text(entry.material, 200);
      const description = text(entry.description, 1200);
      if ([name, color, sizes, material, description].some(value => value === null)) {
        fail('상품 설명은 길이 제한 안의 일반 텍스트여야 하며 HTML·제어 문자는 사용할 수 없습니다.');
        return;
      }
      if (!Number.isSafeInteger(entry.price) || entry.price <= 0) {
        fail('판매 가격은 0보다 큰 원화 정수여야 합니다.');
        return;
      }
      if (entry.currency !== undefined && entry.currency !== 'KRW') {
        fail('현재 지원하는 가격 통화는 KRW입니다.');
        return;
      }
      if (!GENDERS.has(entry.gender) || !CATEGORIES.has(entry.category) || !STYLES.has(entry.style)) {
        fail('성별·카테고리·스타일은 지정된 분류 중에서 선택해야 합니다.');
        return;
      }
      if (typeof entry.photo !== 'string' || entry.photo.length > 240 || !PHOTO.test(entry.photo)) {
        fail('사진은 assets/photos/ 아래의 JPG·PNG·WebP 파일 경로여야 합니다.');
        return;
      }
      const availability = entry.availability === undefined ? 'preparing' : entry.availability;
      const fulfillment = entry.fulfillment === undefined ? 'own-stock' : entry.fulfillment;
      if (!AVAILABILITY.has(availability) || !FULFILLMENT.has(fulfillment)) {
        fail('판매 준비 상태나 공급 방식이 올바르지 않습니다.');
        return;
      }
      // Explicitly build reviewed fields; ignore arbitrary URLs/checkout flags.
      products.push({
        id: entry.id, source: 'own', name, gender: entry.gender,
        category: entry.category, style: entry.style, price: entry.price,
        currency: 'KRW', photo: entry.photo, color, sizes, material,
        description, availability, fulfillment
      });
    });
    return { products, errors };
  }

  function sourceLabel(product) {
    if (product?.source === 'own') return 'A1 자사 상품';
    if (product?.source === 'example' || product?.source === undefined) return '참고용 예시';
    return '등록 정보 확인 중';
  }

  function detailNotice(product) {
    if (product?.source === 'own') {
      const status = product.availability === 'soldOut'
        ? '품절로 표시된 A1 자사 상품입니다.'
        : product.availability === 'available'
          ? 'A1 자사 상품 정보입니다.'
          : '판매 준비 중인 A1 자사 상품입니다.';
      const supply = product.fulfillment === 'purchase-after-confirmation'
        ? ' 주문 후 매입을 계획한 상품이며, 판매 개시 전 공급처 재고·가격·발송 가능 여부를 확인해야 합니다.'
        : '';
      return `${status}${supply} 현재 사이트의 주문·결제 기능은 준비 중이며 주문이 접수되지 않습니다.`;
    }
    if (product?.source === 'example' || product?.source === undefined) {
      return '스타일 탐색용 예시 상품입니다. 상품명·가격·소재·사이즈는 예시이며 사진 속 실제 제품과 다를 수 있습니다. 주문·결제는 제공하지 않습니다.';
    }
    return '상품 출처와 판매 정보를 확인 중입니다. 현재 주문·결제를 접수하지 않습니다.';
  }

  function canSell() {
    // A catalog's "available" flag never establishes working order/payment APIs.
    return false;
  }

  return Object.freeze({ prepareOwnProducts, sourceLabel, detailNotice, canSell });
});
