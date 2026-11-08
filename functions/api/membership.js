import { AccessError, authorizePremium, errorResponse, jsonResponse } from '../../server/premium-access.mjs';
import { isFreeBetaMode } from '../../server/free-beta.mjs';

export async function onRequest({ request, env }) {
  if (request.method !== 'GET') {
    return errorResponse(new AccessError(405, 'method_not_allowed'), env, { Allow: 'GET' });
  }
  try {
    if (isFreeBetaMode(env)) return jsonResponse({ allowed: true, freeBetaMode: true, plan: 'FREE', accessUntil: null });
    const access = await authorizePremium(request, env);
    // The final asynchronous DB lookup can complete after the paid period.
    if (!Number.isSafeInteger(access.accessUntil) || access.accessUntil <= Date.now()) {
      throw new AccessError(403, 'subscription_required');
    }
    // Publish entitlement fields only, never the authenticated internal identity.
    return jsonResponse({ allowed: true, accessUntil: access.accessUntil, plan: access.plan });
  } catch (error) { return errorResponse(error, env); }
}
