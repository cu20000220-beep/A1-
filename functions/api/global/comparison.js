import { handleGlobalRequest } from './_shared.js';
export async function onRequest(context) { return handleGlobalRequest('comparison', context); }
