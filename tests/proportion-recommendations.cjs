'use strict';

// These private fixtures label garment features explicitly to isolate the
// ranking rules. The public snapshot below is read without modification.
const test = require('node:test');
const assert = require('node:assert/strict');
const Profile = require('../assets/proportion-profile.js');
const Discovery = require('../assets/product-discovery.js');
const Matching = require('../assets/product-matching.js');
const Query = require('../assets/shopping-query.js');
const published = require('../assets/observed-products.json');

const now = published.observedAt + 1000;
const neutral = { shoulderHipRatio: 1.05, legTorsoRatio: 1.65 };

function garment(id, changes = {}) {
  const productUrl = 'https://www.musinsa.com/products/' + id;
  return {
    id: 'PRIVATE-' + id, name: 'Private garment fixture', brand: 'Private test brand', retailerName: '무신사',
    type: 'shirt', category: 'tops', color: 'black', gender: 'men', fit: 'regular',
    price: 40000, currency: 'KRW', priceKind: 'page-observation',
    priceNote: 'Synthetic price for private ranking verification only.', sizes: ['M', 'L'],
    checkedAt: now - 1000, stock: 'unknown', productUrl, sourceUrl: productUrl,
    imageUrl: null, imageRights: 'unverified', fittingRights: 'unverified',
    sourceNote: 'Synthetic feature labels used for local tests only.',
    observedFeatures: [],
    ...changes,
  };
}

const snapshot = products => ({ version: 1, observedAt: now, products });
const search = (products, query, profile) => Discovery.search(snapshot(products), query, { now, profile });
const ids = results => results.candidates.map(row => row.product.id);
const reason = (ratio, basis, attribute, feature) => ({ ratio, basis, attribute, feature });

function assertReason(row, expected) {
  const item = row.proportionReasons.find(entry => entry.ratio === expected.ratio && entry.feature === expected.feature);
  assert.deepEqual(item, expected);
}

test('complete manual pairs replace photo ratios and keep only documented dimensions', () => {
  const manual = {
    heightCm: 173, shoulderWidthCm: 46, hipWidthCm: 37,
    torsoCm: 51, legCm: 86, armCm: 63, waistCircumferenceCm: 78, hipCircumferenceCm: 96,
  };
  const output = Profile.build({ ...neutral, armLegRatio: .51 }, manual);
  const expected = {
    shoulderHip: 46 / 37, legTorso: 86 / 51, armLeg: 63 / 86,
    waistHip: 78 / 96, torsoHeight: 51 / 173, legHeight: 86 / 173, armHeight: 63 / 173,
  };
  assert.deepEqual(output, Object.fromEntries(Object.entries(expected).map(([key, value]) => [key, { value, basis: 'manual' }])));
  assert.ok(Object.isFrozen(output));
  assert.ok(Object.values(output).every(Object.isFrozen));
  assert.doesNotMatch(JSON.stringify(output), /Cm|shoulderWidth|Circumference|170cm/);
  assert.deepEqual(Profile.build(neutral, {
    hipWidthCm: 37, waistCircumferenceCm: 78, heightCm: 173,
  }), {
    shoulderHip: { value: neutral.shoulderHipRatio, basis: 'photo' },
    legTorso: { value: neutral.legTorsoRatio, basis: 'photo' },
  }, 'isolated input fields cannot imply a complete measurement or mix different axes');
  assert.throws(() => Profile.build({ ...neutral, photo: 'private.jpg' }), /proportion_fields_invalid/);
  assert.throws(() => Profile.build(neutral, { waistCircumferenceCm: '78' }), /proportion_value_invalid/);
  assert.throws(() => Profile.validate({ waistHip: { value: .82, basis: 'photo' } }), /proportion_basis_invalid/);
});

test('shoulder-to-hip changes favor products with the corresponding verified shoulder construction', () => {
  const setIn = garment(11, { observedFeatures: ['셋인 숄더'] });
  const dropped = garment(12, { observedFeatures: ['드롭 숄더'] });
  const upperWide = Profile.build({ ...neutral, shoulderHipRatio: 1.45 });
  const lowerWide = Profile.build({ ...neutral, shoulderHipRatio: .82 });
  const rankedUpperWide = search([dropped, setIn], '검정 셔츠', upperWide);
  const rankedLowerWide = search([setIn, dropped], '검정 셔츠', lowerWide);
  assert.deepEqual(ids(rankedUpperWide), [setIn.id, dropped.id]);
  assert.deepEqual(ids(rankedLowerWide), [dropped.id, setIn.id]);
  assertReason(rankedUpperWide.candidates[0], reason('shoulderHip', 'photo', 'shoulderLine', 'set_in_shoulder'));
  assertReason(rankedLowerWide.candidates[0], reason('shoulderHip', 'photo', 'shoulderLine', 'drop_shoulder'));
});

test('equal shoulder-to-hip proportions can rank different lengths when the leg-to-torso ratio changes', () => {
  const cropped = garment(13, { observedFeatures: ['크롭'] });
  const longline = garment(14, { observedFeatures: ['롱라인'] });
  const shorter = Profile.build({ shoulderHipRatio: 1.05, legTorsoRatio: 1.16 });
  const longer = Profile.build({ shoulderHipRatio: 1.05, legTorsoRatio: 2.12 });
  const rankedShorter = search([longline, cropped], '검정 셔츠', shorter);
  const rankedLonger = search([longline, cropped], '검정 셔츠', longer);
  assert.deepEqual(ids(rankedShorter), [cropped.id, longline.id]);
  assert.deepEqual(ids(rankedLonger), [longline.id, cropped.id]);
  assertReason(rankedShorter.candidates[0], reason('legTorso', 'photo', 'length', 'cropped_top'));
  assertReason(rankedLonger.candidates[0], reason('legTorso', 'photo', 'length', 'longline_top'));
  assert.equal(Object.hasOwn(rankedShorter.candidates[1], 'proportionReasons'), false);
  assert.equal(Object.hasOwn(rankedLonger.candidates[1], 'proportionReasons'), false);
});

test('arm proportions match actually published short and long sleeve labels without changing other body ratios', () => {
  // The two verified sleeve labels already exist on these official-page rows.
  const shortId = 'musinsa-996498';
  const longId = '29cm-3423465';
  const facts = published.products.filter(row => [shortId, longId].includes(row.id));
  assert.equal(facts.length, 2);
  const data = { ...published, products: [...facts].reverse() };
  const shorter = Discovery.search(data, '상의', {
    now, profile: Profile.build({ ...neutral, armLegRatio: .55 }),
  });
  const longer = Discovery.search(data, '상의', {
    now, profile: Profile.build({ ...neutral, armLegRatio: .85 }),
  });
  assert.deepEqual(ids(shorter), [shortId, longId]);
  assert.deepEqual(ids(longer), [longId, shortId]);
  assertReason(shorter.candidates[0], reason('armLeg', 'photo', 'sleeves', 'short_sleeves'));
  assertReason(longer.candidates[0], reason('armLeg', 'photo', 'sleeves', 'long_sleeves'));
  assert.equal(shorter.candidates[0].product.stock, 'unknown');
  assert.equal(shorter.candidates[0].canFit, false);
});

test('the same manually entered leg length can favor different observed hems at different heights', () => {
  const ankle = garment(21, { type: 'slacks', category: 'bottoms', observedFeatures: ['앵클 길이'] });
  const full = garment(22, { type: 'slacks', category: 'bottoms', observedFeatures: ['풀렝스'] });
  const shorterHeight = Profile.build(neutral, { heightCm: 160, legCm: 82 });
  const tallerHeight = Profile.build(neutral, { heightCm: 205, legCm: 82 });
  const rankedShorter = search([ankle, full], '검정 슬랙스 5만원 이하', shorterHeight);
  const rankedTaller = search([full, ankle], '검정 슬랙스 5만원 이하', tallerHeight);
  assert.deepEqual(ids(rankedShorter), [full.id, ankle.id]);
  assert.deepEqual(ids(rankedTaller), [ankle.id, full.id]);
  assertReason(rankedShorter.candidates[0], reason('legHeight', 'manual', 'length', 'full_length'));
  assertReason(rankedTaller.candidates[0], reason('legHeight', 'manual', 'length', 'ankle_length'));
});

test('height-relative torso and arm ratios match separate verified top attributes', () => {
  const croppedLong = garment(23, { observedFeatures: ['크롭', '긴소매'] });
  const longlineShort = garment(24, { observedFeatures: ['롱라인', '반소매'] });
  const shortFrame = Profile.build(neutral, { heightCm: 160, torsoCm: 54, armCm: 65 });
  const tallFrame = Profile.build(neutral, { heightCm: 210, torsoCm: 54, armCm: 65 });
  const rankedShortFrame = search([longlineShort, croppedLong], '상의', shortFrame);
  const rankedTallFrame = search([croppedLong, longlineShort], '상의', tallFrame);
  assert.deepEqual(ids(rankedShortFrame), [croppedLong.id, longlineShort.id]);
  assert.deepEqual(ids(rankedTallFrame), [longlineShort.id, croppedLong.id]);
  assertReason(rankedShortFrame.candidates[0], reason('torsoHeight', 'manual', 'length', 'cropped_top'));
  assertReason(rankedShortFrame.candidates[0], reason('armHeight', 'manual', 'sleeves', 'long_sleeves'));
  assertReason(rankedTallFrame.candidates[0], reason('torsoHeight', 'manual', 'length', 'longline_top'));
  assertReason(rankedTallFrame.candidates[0], reason('armHeight', 'manual', 'sleeves', 'short_sleeves'));
});

test('actual elastic-waist evidence can support a manual waist reference without promising a size', () => {
  const product = published.products.find(item => item.id === 'musinsa-1168906');
  assert.ok(product.observedFeatures.includes('히든 밴딩'));
  const profile = Profile.build(neutral, { waistCircumferenceCm: 78, hipCircumferenceCm: 96 });
  const result = Discovery.search(published, '검정 와이드 슬랙스 5만원 이하', { now, profile });
  const candidate = result.candidates.find(item => item.product.id === product.id);
  assertReason(candidate, reason('waistHip', 'manual', 'waistline', 'elastic_waist'));
  assert.deepEqual(candidate.product.sizes, []);
  assert.equal(candidate.canFit, false);
  assert.doesNotMatch(JSON.stringify(candidate.proportionReasons), /78|96|\d+\s*cm|circumference/i);
});

test('proportion evidence cannot relax type, fit, size, color, or budget filters', () => {
  const base = { type: 'slacks', category: 'bottoms', fit: 'wide' };
  const comparison = garment(31, base);
  const wrongType = garment(32, { ...base, type: 'jeans' });
  const wrongFit = garment(33, { ...base, fit: 'slim' });
  const wrongSize = garment(34, { ...base, sizes: ['XS'] });
  const wrongColor = garment(35, { ...base, color: 'navy' });
  const aboveBudget = garment(36, { ...base, price: 60000 });
  const unknown = garment(37, { ...base, price: null, priceKind: 'unconfirmed' });
  const input = { ...Query.parse('남성 검정 와이드 슬랙스 5만원 이하'), size: 'M' };
  const profile = Profile.build({ shoulderHipRatio: 1.45, legTorsoRatio: 1.16 });
  const result = search([wrongType, wrongFit, wrongSize, wrongColor, aboveBudget, unknown, comparison], input, profile);
  assert.deepEqual(ids(result), [comparison.id]);
  assert.deepEqual(result.budgetUnconfirmed.map(item => item.product.id), [unknown.id]);
  assert.deepEqual(result.excluded.map(item => item.reason),
    ['type_mismatch', 'fit_mismatch', 'size_mismatch', 'color_mismatch', 'over_observed_budget']);
});

test('default search has no personalized reasons and missing features stay unconfirmed', () => {
  const unknown = garment(41, { fit: 'any', observedFeatures: [] });
  const withData = garment(42, { observedFeatures: ['반소매'] });
  const withoutConsent = search([unknown, withData], '상의');
  assert.deepEqual(ids(withoutConsent), [unknown.id, withData.id]);
  assert.ok(withoutConsent.candidates.every(row => !row.proportionReasons?.length));
  const withConsent = search([unknown, withData], '상의', Profile.build({ ...neutral, armLegRatio: .55 }));
  assert.deepEqual(ids(withConsent), [withData.id, unknown.id]);
  assert.equal(Object.hasOwn(withConsent.candidates[1], 'proportionReasons'), false);
  assert.equal(Object.hasOwn(withConsent, 'profile'), false);
  assert.doesNotMatch(JSON.stringify(withConsent), /armLegRatio|shoulderHipRatio|legTorsoRatio|\.55\b/);
});

test('the approved catalog uses the same evidence after explicit preferences without altering the score', () => {
  const approved = { type: 'slacks', category: 'bottoms', sourceVerified: true, stock: 'in_stock', expiresAt: now + 60000 };
  const plain = garment(51, approved);
  const wide = garment(52, { ...approved, fit: 'wide', observedFeatures: ['와이드'] });
  const prefs = { style: 'all', gender: 'all', currency: 'KRW', budget: 50000,
    occasion: 'all', size: 'M', color: 'black', avoid: [], bodyConsent: false };
  const defaults = Matching.rank([plain, wide], prefs, { now, mode: 'approved' });
  const profile = Profile.build({ ...neutral, shoulderHipRatio: 1.45 });
  const result = Matching.rank([plain, wide], prefs, { now, mode: 'approved', profile });
  assert.deepEqual(defaults.matches.map(row => row.product.id), [plain.id, wide.id]);
  assert.deepEqual(result.matches.map(row => row.product.id), [wide.id, plain.id]);
  assert.deepEqual(result.matches.map(row => row.score), defaults.matches.map(row => row.score));
  assertReason(result.matches[0], reason('shoulderHip', 'photo', 'fit', 'wide_fit'));
  assert.equal(Object.hasOwn(result.preferences, 'profile'), false, 'proportions are kept separate from explicit preferences');

  const overBudget = { ...wide, price: 70000 };
  assert.deepEqual(Matching.rank([overBudget], prefs, { now, mode: 'approved', profile }).excluded,
    [{ id: wide.id, reason: 'over_budget' }]);
});

test('proportion ranking counts corroborating fit labels once and prefers manual evidence', () => {
  const profile = Profile.build({ ...neutral, shoulderHipRatio: 1.45 }, { waistCircumferenceCm: 78, hipCircumferenceCm: 96 });
  const duplicatedFit = garment(61, { category: 'bottoms', type: 'slacks', fit: 'wide', observedFeatures: ['루즈핏'] });
  const waistband = garment(62, { category: 'bottoms', type: 'slacks', fit: 'straight', observedFeatures: ['허리 밴딩'] });
  const ranked = search([duplicatedFit, waistband], '슬랙스', profile);
  assert.deepEqual(ids(ranked), [waistband.id, duplicatedFit.id]);
  assert.equal(ranked.candidates[1].proportionReasons.filter(reason => reason.attribute === 'fit').length, 2);
  const approved = [duplicatedFit, waistband].map(product => ({ ...product, sourceVerified: true, stock: 'in_stock', expiresAt: now + 60000 }));
  const prefs = { style: 'all', gender: 'all', currency: 'KRW', budget: 50000, occasion: 'all', size: '', color: 'any', avoid: [], bodyConsent: false };
  assert.deepEqual(Matching.rank(approved, prefs, { now, profile }).matches.map(row => row.product.id), [waistband.id, duplicatedFit.id]);
});
