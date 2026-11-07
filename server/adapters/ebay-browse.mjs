/** Official eBay Browse interface. Disabled until separate operator/API/terms approvals. */
const MARKETPLACES = { US: 'EBAY_US', GB: 'EBAY_GB', EU: 'EBAY_DE', JP: 'EBAY_US', KR: 'EBAY_US' };
export function createEbayBrowseAdapter(env = {}, { fetchImpl = globalThis.fetch } = {}) {
  const approved = env.ENABLE_LIVE_CATALOG === 'true' && env.EBAY_LIVE_APPROVED === 'true'
    && env.EBAY_TERMS_REVIEWED === 'true';
  const ready = approved && typeof env.EBAY_ACCESS_TOKEN === 'string' && env.EBAY_ACCESS_TOKEN.length > 20
    && env.EBAY_ACCESS_TOKEN.length <= 8192 && !/[\u0000-\u0020\u007f]/u.test(env.EBAY_ACCESS_TOKEN);
  return Object.freeze({
    id: 'ebay-browse', status: () => ({ enabled: ready, approvalRequired: !approved, credentialsRequired: approved && !ready,
      officialDocumentation: 'https://developer.ebay.com/api-docs/buy/browse/overview.html',
      storagePolicy: 'Use approved eBay retention and refresh terms; no generic indefinite product cache.' }),
    async search({ query, country = 'US', destination = 'US', limit = 10 } = {}) {
      if (!ready) throw new Error('ebay_adapter_not_approved_or_configured');
      if (typeof query !== 'string' || !query.trim() || query.length > 120 || /[\u0000-\u001f\u007f]/u.test(query)
        || !Object.hasOwn(MARKETPLACES, country) || !/^[A-Z]{2}$/.test(destination)
        || !Number.isInteger(limit) || limit < 1 || limit > 20) throw new TypeError('invalid_provider_query');
      const url = new URL('https://api.ebay.com/buy/browse/v1/item_summary/search');
      url.searchParams.set('q', query.trim()); url.searchParams.set('limit', String(limit));
      url.searchParams.set('filter', `deliveryCountry:${destination}`);
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetchImpl(url.href, { method: 'GET', redirect: 'manual', signal: controller.signal,
          headers: { Authorization: `Bearer ${env.EBAY_ACCESS_TOKEN}`, Accept: 'application/json',
            'X-EBAY-C-MARKETPLACE-ID': MARKETPLACES[country] } });
        if (!response.ok) { await response.body?.cancel(); throw new Error('ebay_provider_unavailable'); }
        const max = 512 * 1024;
        const declared = response.headers.get('Content-Length');
        if (declared && (!/^\d+$/.test(declared) || Number(declared) > max)) throw new Error('ebay_response_too_large');
        const reader = response.body?.getReader(); if (!reader) throw new Error('ebay_invalid_response');
        const chunks = []; let length = 0;
        try { for (;;) { const { done, value } = await reader.read(); if (done) break; length += value.byteLength;
          if (length > max) { await reader.cancel(); throw new Error('ebay_response_too_large'); } chunks.push(value); }
        } finally { reader.releaseLock(); }
        const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
        const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
        if (!Array.isArray(data.itemSummaries)) return { offers: [], incomplete: true, source: 'eBay Browse API', checkedAt: Date.now() };
        // Search summaries are discovery candidates, not verified exact variants.
        // An approved detail/identity adapter must confirm SKU/GTIN/size/tax before comparison.
        return { candidates: data.itemSummaries.slice(0, limit).map(item => ({
          externalId: typeof item.itemId === 'string' ? item.itemId : null,
          title: typeof item.title === 'string' ? item.title.slice(0, 250) : null,
          source: 'eBay Browse API', sourceUrl: url.origin + url.pathname,
          checkedAt: Date.now(), comparisonReady: false, requiresApprovedDetailLookup: true
        })), offers: [], incomplete: true, source: 'eBay Browse API', checkedAt: Date.now() };
      } finally { clearTimeout(timer); }
    }
  });
}
