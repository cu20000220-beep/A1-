import {
  AccessError, assertSameOrigin, authorizePremium, errorResponse,
  jsonResponse, readRecommendationRequest
} from '../../server/premium-access.mjs';
import { recommendForMember } from '../../server/recommendation-engine.mjs';
import { requestLanguage } from '../../server/locale.mjs';

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') {
    return errorResponse(new AccessError(405, 'method_not_allowed'), env, { Allow: 'POST' });
  }
  try {
    assertSameOrigin(request);
    // A previous membership check is not an authorization grant for this call.
    await authorizePremium(request, env);
    const input = await readRecommendationRequest(request);
    const language = requestLanguage(request);
    return jsonResponse(recommendForMember(input, { language }), 200, {
      'Content-Language': language,
      'Vary': 'Authorization, Cookie, Cf-Access-Jwt-Assertion, Accept-Language'
    });
  } catch (error) { return errorResponse(error, env); }
}
