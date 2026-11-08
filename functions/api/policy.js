import { jsonResponse } from '../../server/premium-access.mjs';
import { publicBetaPolicy } from '../../server/free-beta.mjs';
export async function onRequest({ request, env }) {
  if (request.method !== 'GET') return jsonResponse({ error: 'method_not_allowed' }, 405, { Allow: 'GET' });
  return jsonResponse(publicBetaPolicy(env));
}
