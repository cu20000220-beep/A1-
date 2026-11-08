import {
  AccessError, assertSameOrigin, authorizePremium, errorResponse,
  jsonResponse, readRecommendationRequest
} from '../../server/premium-access.mjs';
import { recommendForMember } from '../../server/recommendation-engine.mjs';
import { requestLanguage } from '../../server/locale.mjs';
import { isFreeBetaMode } from '../../server/free-beta.mjs';

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') {
    return errorResponse(new AccessError(405, 'method_not_allowed'), env, { Allow: 'POST' });
  }
  try {
    assertSameOrigin(request);
    if (isFreeBetaMode(env)) {
      const input = await readRecommendationRequest(request);
      return jsonResponse({ ...recommendForMember(input, { language: requestLanguage(request) }), freeBetaMode: true }, 200,
        { 'Content-Language': requestLanguage(request) });
    }
    // A previous membership check is not an authorization grant for this call.
    await authorizePremium(request, env);
    const input = await readRecommendationRequest(request);
    // Reading a streamed body may outlive the original paid grant. Query the
    // current subscription again, then check the actual completion time too.
    const access = await authorizePremium(request, env);
    if (!Number.isSafeInteger(access.accessUntil) || access.accessUntil <= Date.now()) {
      throw new AccessError(403, 'subscription_required');
    }
    const language = requestLanguage(request);
    return jsonResponse(recommendForMember(input, { language }), 200, {
      'Content-Language': language,
      'Vary': 'Authorization, Cookie, Cf-Access-Jwt-Assertion, Accept-Language'
    });
  } catch (error) { return errorResponse(error, env); }
}
