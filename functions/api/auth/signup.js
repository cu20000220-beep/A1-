import { handleAuthRequest } from '../../../server/firebase-auth.mjs';
export async function onRequest(context) { return handleAuthRequest('signup', context); }
