'use strict';

function validateSourceReview(review, observations, existsEvidence) {
  if (review?.version !== 1 || !Array.isArray(review.sources)) throw Error('Invalid source review');
  const ids = new Set();
  const factHosts = new Set();
  for (const source of review.sources) {
    const homepage = new URL(source.homepage);
    if (!/^[a-z0-9-]+$/.test(source.id) || ids.has(source.id) ||
        !['KR', 'global'].includes(source.market) || homepage.protocol !== 'https:' ||
        homepage.username || homepage.password || homepage.port || homepage.search || homepage.hash ||
        !Array.isArray(source.factHosts) || !Array.isArray(source.evidence)) {
      throw Error('Invalid reviewed source');
    }
    ids.add(source.id);
    if (source.decision === 'pending' && !source.factHosts.length && !source.evidence.length) continue;
    if (source.decision !== 'observed-facts' || !source.factHosts.length || !source.evidence.length ||
        !source.evidence.every(file => /^docs\/validation\/[a-z0-9/_-]+\.json$/.test(file) && existsEvidence(file))) {
      throw Error('Missing factual observation evidence for ' + source.id);
    }
    for (const host of source.factHosts) {
      if (host !== homepage.hostname || factHosts.has(host)) throw Error('Invalid observation host for ' + source.id);
      factHosts.add(host);
    }
  }
  for (const product of observations.products) {
    if (!factHosts.has(new URL(product.sourceUrl).hostname)) throw Error('Unreviewed observation source for ' + product.id);
  }
}

module.exports = { validateSourceReview };
