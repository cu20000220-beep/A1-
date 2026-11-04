import { AccessError, authorizePremium, errorResponse, jsonResponse } from '../../server/premium-access.mjs';

export async function onRequest({ request, env }) {
  if (request.method !== 'GET') {
    return errorResponse(new AccessError(405, 'method_not_allowed'), env, { Allow: 'GET' });
  }
  try {
    const access = await authorizePremium(request, env);
    return jsonResponse(access);
  } catch (error) { return errorResponse(error, env); }
}
