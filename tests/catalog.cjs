const { test } = require('node:test');
const assert = require('node:assert/strict');
const { prepareOwnProducts, sourceLabel, detailNotice, canSell } = require('../assets/catalog-rules.js');

function product(overrides = {}) {
  return {
    id: 'own-cotton-shirt', source: 'own', name: 'A1 코튼 셔츠',
    gender: '유니섹스', category: '상의', style: '미니멀', price: 59000,
    photo: 'assets/photos/own-cotton-shirt.jpg', color: '오프화이트',
    sizes: 'S / M / L', material: '코튼', description: '직접 촬영한 자사 셔츠입니다.',
    ...overrides
  };
}

test('valid explicit own records normalize without invented details or mutation', () => {
  const input = product({ name: ' A1 코튼 셔츠 ', material: undefined, description: undefined,
    buyUrl: 'https://example.com', checkoutReady: true });
  const before = structuredClone(input);
  const { products, errors } = prepareOwnProducts([input]);
  assert.deepEqual(errors, []);
  assert.equal(products.length, 1);
  assert.equal(products[0].name, 'A1 코튼 셔츠');
  assert.equal(products[0].source, 'own');
  assert.equal(products[0].currency, 'KRW');
  assert.equal(products[0].availability, 'preparing');
  assert.equal(products[0].fulfillment, 'own-stock');
  assert.equal(products[0].material, '');
  assert.equal(products[0].description, '');
  assert.ok(!Object.hasOwn(products[0], 'look'));
  assert.ok(!Object.hasOwn(products[0], 'checkoutReady'));
  assert.ok(!Object.hasOwn(products[0], 'buyUrl'));
  assert.deepEqual(input, before);
});

test('empty input is valid but invalid catalog shapes are rejected', () => {
  assert.deepEqual(prepareOwnProducts([]), { products: [], errors: [] });
  for (const value of [undefined, null, {}, 'products', 5]) {
    const result = prepareOwnProducts(value);
    assert.equal(result.products.length, 0);
    assert.equal(result.errors.length, 1);
  }
  assert.equal(prepareOwnProducts([null, [], new Date()]).errors.length, 3);
});

test('examples and implicit or unsupported sources never become own goods', () => {
  for (const source of [undefined, 'example', 'external', 'Own', null]) {
    assert.equal(prepareOwnProducts([product({ source })]).products.length, 0);
  }
  assert.equal(prepareOwnProducts([product({ id: 'a1-001' })]).products.length, 0);
  assert.equal(sourceLabel({ source: 'example' }), '참고용 예시');
  assert.equal(sourceLabel({}), '참고용 예시');
  assert.equal(sourceLabel({ source: 'external' }), '등록 정보 확인 중');
});

test('duplicate IDs fail closed and invalid prices/currency do not enter the catalog', () => {
  const duplicate = prepareOwnProducts([product(), product({ price: 100000 })]);
  assert.equal(duplicate.products.length, 0);
  assert.equal(duplicate.errors.length, 2);
  for (const price of [0, -1, 1.5, '59000', NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(prepareOwnProducts([product({ price })]).products.length, 0);
  }
  assert.equal(prepareOwnProducts([product({ currency: 'USD' })]).products.length, 0);
});

test('only local image assets without traversal, URL or attribute injection are accepted', () => {
  for (const photo of [
    'https://example.com/p.jpg', '//example.com/p.jpg', '/assets/photos/p.jpg',
    'assets/photos/../p.jpg', 'assets/photos/%2e%2e/p.jpg',
    'assets/photos/own-shirt.jpg?onerror=x', 'assets/photos/own-shirt.svg',
    'assets/photos/p"onerror="x.jpg', 'assets\\photos\\p.jpg', 'data:image/png;base64,test'
  ]) assert.equal(prepareOwnProducts([product({ photo })]).products.length, 0, photo);
  assert.equal(prepareOwnProducts([product({ photo: 'assets/photos/own/shirt.PNG' })]).products.length, 1);
});

test('unsupported categories, statuses and unsafe plain text fail validation', () => {
  for (const patch of [
    { gender: '전체' }, { category: '신발' }, { style: '알 수 없음' },
    { availability: 'paid' }, { fulfillment: 'auto-checkout' },
    { name: '' }, { name: 'x'.repeat(101) }, { color: null },
    { name: '<img src=x>' }, { description: '" onclick="attack()' },
    { sizes: 'S & L' }, { material: 'cotton\n<script>' },
    { name: 'shirt\u202eabc' }
  ]) assert.equal(prepareOwnProducts([product(patch)]).products.length, 0, JSON.stringify(patch));
});

test('preparing/available/sold-out and planned sourcing never enable real sales', () => {
  for (const availability of ['preparing', 'available', 'soldOut']) {
    const { products, errors } = prepareOwnProducts([product({ availability,
      fulfillment: 'purchase-after-confirmation' })]);
    assert.deepEqual(errors, []);
    assert.equal(products[0].availability, availability);
    assert.equal(canSell(products[0]), false);
    assert.equal(sourceLabel(products[0]), 'A1 자사 상품');
    assert.match(detailNotice(products[0]), /주문 후 매입을 계획/);
    assert.match(detailNotice(products[0]), /주문이 접수되지 않습니다/);
    if (availability === 'soldOut') assert.match(detailNotice(products[0]), /품절/);
  }
  assert.equal(canSell({ source: 'own', availability: 'available', checkoutReady: true }), false);
  assert.match(detailNotice(product({ source: 'example' })), /예시/);
  assert.match(detailNotice({ source: 'external' }), /출처와 판매 정보를 확인 중/);
});
