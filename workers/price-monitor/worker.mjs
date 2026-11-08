/** Manual-only scheduler skeleton. No Cron Trigger or live provider is enabled. */
import { processNotificationCandidates } from '../../server/notifications.mjs';

export const MONITOR_EXECUTION_MODE = 'MANUAL_DRY_RUN';

/** Invoked only by a separately authenticated operator process, never a public page. */
export async function runMonitor({ sources = [], repository, buildCandidates, now = Date.now(), operatorAuthorized = false } = {}) {
  if (!operatorAuthorized) return { mode: MONITOR_EXECUTION_MODE, status: 'blocked', reason: 'operator-authorization-required' };
  if (!Number.isSafeInteger(now) || now < 0 || now > 8_640_000_000_000_000 || !Array.isArray(sources) || sources.length > 20
    || ['loadSnapshot', 'loadContext', 'claimDelivery', 'recordDelivery'].some(key => typeof repository?.[key] !== 'function')
    || typeof buildCandidates !== 'function') throw new Error('monitor-repository-required');
  const approved = sources.filter(source => source?.approved === true && typeof source.id === 'string'
    && /^[a-zA-Z0-9_.:-]{1,160}$/.test(source.id)
    && ['official_api', 'official_feed'].includes(source.kind) && source.liveEnabled !== true);
  // Adapter fixtures are supplied by the caller; this worker never fetches a
  // retailer, provider, email service, or SMS service by itself.
  const snapshot = await repository.loadSnapshot({ sourceIds: approved.map(source => source.id), now });
  const candidates = await buildCandidates(snapshot, { mode: 'DRY_RUN', now });
  const results = await processNotificationCandidates(candidates, {
    loadContext: repository.loadContext.bind(repository),
    claimDelivery: repository.claimDelivery.bind(repository),
    recordDelivery: repository.recordDelivery.bind(repository), now, mode: 'DRY_RUN'
  });
  const retention = approved.filter(source => Number.isSafeInteger(source.retentionMs) && source.retentionMs > 0)
    .map(source => ({ sourceId: source.id, before: now - source.retentionMs }));
  // Cleanup is a plan only. It must use each provider's approved retention policy.
  return { mode: MONITOR_EXECUTION_MODE, status: 'completed', sourceCount: approved.length,
    simulatedDeliveries: results.length, results, cleanupPlan: retention };
}

export default {
  async fetch() {
    return Response.json({ mode: MONITOR_EXECUTION_MODE, enabled: false,
      message: 'No public monitor endpoint or scheduled execution is enabled.' },
    { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
};

// No scheduled() export and no cron configuration: deployment alone cannot
// start monitoring, delivery, database mutation, or retention deletion.
