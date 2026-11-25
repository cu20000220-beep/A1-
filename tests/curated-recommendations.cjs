'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const Discovery = require('../assets/product-discovery.js');
const Query = require('../assets/shopping-query.js');
const Profile = require('../assets/proportion-profile.js');
const ApprovedCatalog = require('../assets/product-catalog.js');
const Catalog = require('../scripts/lib/product-catalog.cjs');
const { validateSourceReview } = require('../scripts/lib/recommendation-source-review.cjs');
const observations = require('../assets/observed-products.json');
const sourceReview = require('../catalog/source-review.json');

const hour = 60 * 60 * 1000;
const now = Date.UTC(2026, 10, 25, 12);

// The URLs are validator inputs only. These test records never enter a
// checked-in catalog, approval file, browser route, or network request.
function product(number, changes = {}) {
  const productUrl = 'https://www.musinsa.com/products/' + (99999000 + number);
  return {
    id: 'PRIVATE-' + number,
    name: 'Private test garment ' + number,
    brand: 'LOCAL TEST',
    retailerName: 'Private test seller',
    category: 'tops',
    type: 'shirt',
    color: 'black',
    gender: 'unisex',
    fit: 'any',
    price: 40000,
    currency: 'KRW',
    priceKind: 'page-observation',
    priceNote: 'Synthetic price for the local test only.',
    sizes: ['M'],
    productUrl,
    sourceUrl: productUrl,
    checkedAt: now - hour,
    stock: 'unknown',
    imageUrl: null,
    imageRights: 'unverified',
    fittingRights: 'unverified',
    sourceNote: 'Synthetic garment facts for the local test only.',
    observedFeatures: [],
    ...changes,
  };
}

const snapshot = (products, observedAt = now) => ({ version: 1, observedAt, products });

function search(products, conditions = '의류', profile) {
  return Discovery.search(snapshot(products), conditions, { now, profile });
}

test('five distinct body profiles rank five catalog features without rewriting the query or returning measurements', () => {
  const garments = [
    product(1, { observedFeatures: ['반소매'] }),
    product(2, { observedFeatures: ['긴소매'] }),
    product(3, { category: 'bottoms', type: 'slacks', fit: 'wide' }),
    product(4, { category: 'bottoms', type: 'slacks', observedFeatures: ['히든 밴딩'] }),
    product(5, { observedFeatures: ['크롭'] }),
  ];
  const cases = [
    [Profile.build({}, { heightCm: 174, armCm: 53 }), 'PRIVATE-1', 'armHeight', 'short_sleeves'],
    [Profile.build({}, { heightCm: 174, armCm: 70 }), 'PRIVATE-2', 'armHeight', 'long_sleeves'],
    [Profile.build({ shoulderHipRatio: 1.48 }), 'PRIVATE-3', 'shoulderHip', 'wide_fit'],
    [Profile.build({}, { waistCircumferenceCm: 78, hipCircumferenceCm: 96 }), 'PRIVATE-4', 'waistHip', 'elastic_waist'],
    [Profile.build({ legTorsoRatio: 1.24 }), 'PRIVATE-5', 'legTorso', 'cropped_top'],
  ];
  const input = Object.freeze(Query.parse('의류'));
  assert.equal(search(garments, input).candidates[0].proportionReasons, undefined);
  for (const [profile, first, ratio, feature] of cases) {
    const result = search(garments, input, profile);
    const [top] = result.candidates;
    assert.equal(top.product.id, first);
    assert.equal(result.candidates.length, garments.length, 'body hints alone do not exclude a candidate');
    assert.ok(top.proportionReasons.some(reason => reason.ratio === ratio && reason.feature === feature));
    assert.ok(top.proportionReasons.every(reason => !Object.hasOwn(reason, 'value')));
    assert.equal(Object.hasOwn(result, 'profile'), false);
    assert.equal(input.category, 'all');
  }
});

test('verified body cues do not override explicitly selected fit, color, season, size, or budget', () => {
  const correct = product(11, { fit: 'regular', seasons: ['winter'] });
  const wrongFit = product(12, { fit: 'oversized', seasons: ['winter'], observedFeatures: ['긴소매'] });
  const wrongColor = product(13, { fit: 'regular', color: 'navy', seasons: ['winter'], observedFeatures: ['긴소매'] });
  const wrongSeason = product(14, { fit: 'regular', seasons: ['summer'], observedFeatures: ['긴소매'] });
  const wrongSize = product(15, { fit: 'regular', sizes: ['XS'], seasons: ['winter'], observedFeatures: ['긴소매'] });
  const wrongPrice = product(16, { fit: 'regular', price: 60000, seasons: ['winter'], observedFeatures: ['긴소매'] });

  const profile = Profile.build({}, { heightCm: 174, armCm: 70 });
  const conditions = { ...Query.parse('검정 레귤러 셔츠 5만원 이하'), season: 'winter', size: 'M' };
  const result = search([wrongFit, wrongColor, wrongSeason, wrongSize, wrongPrice, correct], conditions, profile);
  assert.deepEqual(result.candidates.map(row => row.product.id), [correct.id]);
  assert.deepEqual(new Set(result.excluded.map(row => row.reason)), new Set([
    'fit_mismatch', 'color_mismatch', 'season_mismatch', 'size_mismatch', 'over_observed_budget',
  ]));
  assert.equal(result.candidates[0].proportionReasons, undefined);
});

test('season terms are bounded and round-trip across Korean and English search phrases', () => {
  for (const [korean, english, season] of [
    ['봄', 'spring', 'spring'],
    ['여름', 'summer', 'summer'],
    ['가을', 'fall', 'autumn'],
    ['겨울', 'winter', 'winter'],
  ]) {
    for (const input of [korean + ' 검정 셔츠 5만원 이하', english + ' black shirt 50000원']) {
      const conditions = Query.parse(input);
      assert.equal(conditions.season, season);
      assert.equal(conditions.type, 'shirt');
      assert.equal(conditions.budget, 50000);
      assert.equal(Query.parse(Query.term(conditions, 'ko')).season, season);
      assert.equal(Query.parse(Query.term(conditions, 'en')).season, season);
      assert.ok(Query.links(conditions).every(link => !decodeURIComponent(link.searchUrl).includes('50000')));
    }
  }
  assert.equal(Query.parse('검정 셔츠').season, 'any');
});

test('published season labels and observed fit hints are distinct, with no guess for missing facts', () => {
  const explicit = product(21, { seasons: ['summer'] });
  const feature = product(22, { observedFeatures: ['반소매'] });
  const conflict = product(23, { seasons: ['winter'], observedFeatures: ['반소매'] });
  const unknown = product(24, { observedFeatures: ['긴소매'] });
  const result = search([feature, conflict, unknown, explicit], { ...Query.parse('상의'), season: 'summer' });
  const matched = new Map(result.candidates.map(row => [row.product.id, row]));
  assert.deepEqual([...matched.keys()], [explicit.id, feature.id], 'a seller season label outranks an equally relevant feature hint');
  assert.deepEqual(matched.get(explicit.id).seasonEvidence, { season: 'summer', basis: 'source-label' });
  assert.ok(matched.get(explicit.id).reasons.includes('season_label_matches'));
  assert.deepEqual(matched.get(feature.id).seasonEvidence, {
    season: 'summer', basis: 'observed-feature', feature: 'short_sleeves',
  });
  assert.ok(matched.get(feature.id).reasons.includes('season_feature_hint'));
  assert.deepEqual(result.excluded.map(row => [row.product.id, row.reason]), [
    [conflict.id, 'season_mismatch'], [unknown.id, 'season_unconfirmed'],
  ]);
  assert.equal(search([unknown], { ...Query.parse('상의'), season: 'winter' }).candidates.length, 0,
    'long sleeves alone do not prove a winter garment');
});

test('existing official observations link a summer hint to an actual sleeve label and leave absent fields null', () => {
  const observedAt = observations.observedAt + 1000;
  const result = Discovery.search(observations, '여름 상의', { now: observedAt });
  const sleeve = result.candidates.find(row => row.product.id === 'musinsa-996498');
  assert.ok(sleeve, 'the published short-sleeve product is still a candidate');
  assert.ok(sleeve.product.observedFeatures.includes('반소매'));
  assert.equal(sleeve.product.productUrl, 'https://www.musinsa.com/products/996498');
  assert.equal(sleeve.product.sourceUrl, sleeve.product.productUrl);
  assert.deepEqual(sleeve.seasonEvidence, {
    season: 'summer', basis: 'observed-feature', feature: 'short_sleeves',
  });
  for (const key of ['price', 'material', 'seasons', 'sizeChart', 'imageUrl']) assert.equal(sleeve.product[key], null, key);
  assert.equal(sleeve.product.priceKind, 'unconfirmed');
  assert.equal(sleeve.product.stock, 'unknown');
  assert.equal(sleeve.canFit, false);
});

test('reloading a dated catalog observation does not refresh the price or confirm an unknown quote', () => {
  const dated = observations.products.find(row => row.id === 'musinsa-1168906');
  const refreshAt = dated.checkedAt + 25 * hour;
  const input = '검정 슬랙스 5만원 이하';
  const fresh = Discovery.search(observations, input, { now: observations.observedAt + 1000 })
    .candidates.find(row => row.product.id === dated.id);
  const reloaded = Discovery.search({ ...observations, observedAt: refreshAt }, input, { now: refreshAt })
    .candidates.find(row => row.product.id === dated.id);

  assert.equal(fresh.product.checkedAt, dated.checkedAt);
  assert.equal(fresh.product.price, 49900);
  assert.equal(fresh.product.priceKind, 'page-observation');
  assert.ok(fresh.warnings.includes('price_not_live'));
  assert.equal(reloaded.product.checkedAt, dated.checkedAt, 'snapshot retrieval time is not the price evidence timestamp');
  assert.equal(reloaded.product.price, dated.price);
  assert.ok(reloaded.warnings.includes('price_not_live') && reloaded.warnings.includes('observation_stale'));

  const noQuote = Discovery.search(observations, '검정 티셔츠 5만원 이하', { now: refreshAt });
  assert.ok(noQuote.budgetUnconfirmed.some(row => row.product.id === 'musinsa-996498'));
  assert.ok(noQuote.budgetUnconfirmed.every(row => row.product.price === null && row.warnings.includes('price_unconfirmed')));
  assert.ok(noQuote.candidates.every(row => row.product.price !== null));
});

test('dated public observations resolve to evidence-backed seller pages and cannot enter from a pending source', () => {
  const evidenceExists = file => fs.existsSync(path.resolve(__dirname, '..', file));
  assert.doesNotThrow(() => validateSourceReview(sourceReview, observations, evidenceExists));
  for (const row of observations.products) {
    assert.ok(Discovery.safeProductUrl(row.productUrl));
    assert.equal(row.sourceUrl, row.productUrl, 'the source identifies the exact item, not a retailer search');
  }

  const reviewWithheld = structuredClone(sourceReview);
  const source = reviewWithheld.sources.find(entry => entry.id === 'musinsa');
  Object.assign(source, { decision: 'pending', factHosts: [], evidence: [] });
  assert.throws(() => validateSourceReview(reviewWithheld, observations, evidenceExists), /Unreviewed observation source/);
  assert.throws(() => validateSourceReview(sourceReview, observations, () => false), /Missing factual observation evidence/);
});

const sourceUrl = 'https://provider.example.test/catalog/authorized-products';
const rawFeedRow = {
  id: 'private-feed-item',
  approvalId: 'private-reviewed-source',
  name: 'Synthetic source trace fixture',
  brand: 'LOCAL TEST',
  category: 'outerwear',
  type: 'coat',
  color: 'black',
  gender: 'unisex',
  price: 65000,
  currency: 'KRW',
  sizes: [],
  sizeChart: null,
  material: null,
  fit: null,
  seasons: null,
  imageUrl: 'https://images.example.test/fixture.jpg',
  retailer: 'Private fixture retailer',
  purchaseUrl: 'https://seller.example.test/products/private-item',
  sourceUrl,
  permissionChecked: true,
  lastChecked: new Date(now - hour).toISOString(),
  stock: 'unknown',
  sourceKind: 'official-api',
  externalId: 'private-provider-row',
};
const sourceApproval = {
  id: rawFeedRow.approvalId,
  seller: 'Private fixture provider',
  kind: 'official-api',
  retailers: [rawFeedRow.retailer],
  domains: ['provider.example.test', 'seller.example.test'],
  imageDomains: ['images.example.test'],
  rightsConfirmed: true,
  displayApproved: true,
  storageApproved: true,
  storageEvidenceRef: 'PRIVATE storage review receipt',
  trainingApproved: false,
  retentionHours: 8,
  validUntil: new Date(now + 7 * 24 * hour).toISOString(),
  sourceUrl,
  evidenceRef: 'PRIVATE approval receipt',
};

function review(products, approval = sourceApproval, checkedNow = now) {
  const input = { version: 1, products };
  const inputSha256 = Catalog.sha(JSON.stringify(input));
  const manifest = { version: 1, sources: [{ ...approval }] };
  const { digests } = Catalog.compileCatalog(input, manifest, { now: checkedNow, inputSha256, inspect: true });
  manifest.sources[0].inputSha256 = inputSha256;
  manifest.sources[0].productsSha256 = digests[approval.id];
  return { input, manifest, inputSha256 };
}

function compile(reviewed, checkedNow = now) {
  return Catalog.compileCatalog(reviewed.input, reviewed.manifest, {
    now: checkedNow, inputSha256: reviewed.inputSha256,
  }).snapshot;
}

test('approved API rows retain exact seller source, evidence dates and null facts while review receipts stay private', () => {
  const reviewed = review([rawFeedRow]);
  const data = compile(reviewed);
  const [row] = ApprovedCatalog.validateSnapshot(data, now);
  assert.equal(Catalog.validateSnapshot(data, reviewed.manifest, now), data);
  assert.deepEqual({
    approvalId: row.approvalId, sourceKind: row.sourceKind, sourceUrl: row.sourceUrl,
    productUrl: row.productUrl, checkedAt: row.checkedAt, expiresAt: row.expiresAt, sourceVerified: row.sourceVerified,
  }, {
    approvalId: rawFeedRow.approvalId, sourceKind: 'official-api', sourceUrl,
    productUrl: rawFeedRow.purchaseUrl, checkedAt: now - hour, expiresAt: now + 7 * hour, sourceVerified: true,
  });
  assert.equal(row.stock, 'unknown');
  for (const key of ['material', 'fit', 'seasons', 'sizeChart', 'shipping', 'tax', 'duties']) assert.equal(row[key], null, key);
  assert.doesNotMatch(JSON.stringify(data), /PRIVATE|storageEvidenceRef|evidenceRef|trainingApproved|inputSha256|productsSha256/);
  assert.throws(() => review([{ ...rawFeedRow, sourceUrl: 'https://provider.example.test/catalog/other' }]), /source_mismatch/);
  assert.throws(() => review([{ ...rawFeedRow, retailer: 'Unreviewed fixture retailer' }]), /seller_mismatch/);
  assert.throws(() => review([rawFeedRow], { ...sourceApproval, storageApproved: false }));
  assert.throws(() => review([rawFeedRow], { ...sourceApproval, trainingApproved: true }),
    'display and storage approvals do not authorize training without separate evidence');
});

test('approved search preserves missing fields and separates unconfirmed prices from budget matches', () => {
  const missing = {
    ...rawFeedRow,
    id: 'private-unpriced-item',
    externalId: 'private-provider-unpriced-row',
    purchaseUrl: 'https://seller.example.test/products/private-unpriced-item',
    price: null,
    color: null,
  };
  const quoted = { ...rawFeedRow, price: 59000, stock: 'in_stock', fit: 'regular', seasons: ['winter'] };
  const data = compile(review([missing, quoted]));
  const unconfirmed = data.products.find(row => row.id === missing.id);
  for (const key of ['price', 'color', 'material', 'fit', 'seasons', 'sizeChart']) assert.equal(unconfirmed[key], null, key);

  const broad = ApprovedCatalog.search(data, Query.parse('코트 6만원 이하'), { now });
  assert.deepEqual(broad.matches.map(row => row.product.id), [quoted.id]);
  assert.deepEqual(broad.priceUnconfirmed.map(row => row.id), [missing.id]);
  assert.equal(broad.priceUnconfirmed[0].price, null);
  assert.equal(broad.unavailable.length, 0, 'price ambiguity is separate from availability');

  const selected = ApprovedCatalog.search(data, Query.parse('겨울 검정 레귤러 코트 6만원 이하'), { now });
  assert.deepEqual(selected.matches.map(row => row.product.id), [quoted.id]);
  assert.ok(selected.matches[0].reasons.includes('fit_match'));
  assert.ok(selected.matches[0].reasons.includes('season_match'));
  assert.deepEqual(selected.priceUnconfirmed, [], 'missing color, fit and season do not satisfy explicit filters');
});

test('a fresh approved price requires a newly reviewed source record, never just a new import time', () => {
  const original = review([rawFeedRow]);
  const originalData = compile(original);
  const refreshAt = now + 8 * hour;
  assert.equal(ApprovedCatalog.validateSnapshot(originalData, refreshAt).length, 0, 'an expired record cannot supply a fresh price');
  assert.throws(() => compile(original, refreshAt), /stale_product/);

  const updatedRow = { ...rawFeedRow, price: 59000, lastChecked: new Date(refreshAt - hour / 4).toISOString() };
  assert.throws(() => compile({ ...original, input: { version: 1, products: [updatedRow] } }, refreshAt),
    /reviewed_file_hash_mismatch/);
  const refreshed = review([updatedRow], sourceApproval, refreshAt);
  const refreshedData = compile(refreshed, refreshAt);
  const [row] = ApprovedCatalog.validateSnapshot(refreshedData, refreshAt);
  assert.equal(row.price, 59000);
  assert.equal(row.checkedAt, refreshAt - hour / 4);
  assert.equal(row.expiresAt, row.checkedAt + sourceApproval.retentionHours * hour);
  assert.equal(row.sourceUrl, sourceUrl);
  assert.equal(Catalog.validateSnapshot(refreshedData, refreshed.manifest, refreshAt), refreshedData);

  const tampered = structuredClone(refreshedData);
  tampered.products[0].price = 100;
  assert.throws(() => Catalog.validateSnapshot(tampered, refreshed.manifest, refreshAt), /snapshot_hash_mismatch/);
});
