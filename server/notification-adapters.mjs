/** Server-only delivery adapters. This release has no live sending capability. */
if (typeof window !== 'undefined' || typeof document !== 'undefined') throw new Error('Notification adapters are server-only.');

export const LIVE_DELIVERY_IMPLEMENTED = false;

export function deliveryAdapterStatus(env = {}) {
  return Object.freeze({ mode: 'DRY_RUN', liveEnabled: false,
    email: Object.freeze({ providerConfigured: Boolean(env.EMAIL_PROVIDER && env.EMAIL_API_KEY), sendingEnabled: false }),
    sms: Object.freeze({ providerConfigured: Boolean(env.SMS_PROVIDER && env.SMS_API_KEY), sendingEnabled: false }),
    reason: 'operator-approval-and-reviewed-live-adapter-required' });
}

/** Even setting flags or adding keys cannot activate real delivery in this version. */
export async function deliverNotification(message, { mode = 'DRY_RUN', env = {} } = {}) {
  if (!['email', 'sms'].includes(message?.channel)) return Object.freeze({ status: 'blocked', reason: 'invalid-channel', sent: false });
  if (mode !== 'DRY_RUN') return Object.freeze({ status: 'blocked', reason: 'live-delivery-disabled', sent: false });
  // Intentionally no fetch/SMTP/SMS SDK, recipient address, or credentials are used.
  return Object.freeze({ status: 'dry_run', sent: false, mode: 'DRY_RUN',
    channel: message.channel, liveDeliveryEnabled: deliveryAdapterStatus(env).liveEnabled });
}
