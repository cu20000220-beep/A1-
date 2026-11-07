/** Awin feed adapter contract only. No download or real feed import is enabled. */
export function createAwinFeedAdapter(env = {}) {
  return Object.freeze({
    id: 'awin-product-feed',
    status: () => ({ enabled: false, approvalRequired: true,
      officialDocumentation: 'https://developer.awin.com/docs',
      requirements: ['Approved publisher account', 'Advertiser/feed access approval', 'Feed credentials',
        'Advertiser image licence and permitted fields', 'Retention, refresh and deletion rules',
        'Reviewed feed format and exact-variant field mapping'],
      credentialsPresent: Boolean(env.AWIN_FEED_KEY),
      reason: 'An approved feed contract and importer must be configured before activation.' }),
    async importFeed() { throw new Error('awin_feed_approval_and_mapping_required'); }
  });
}
