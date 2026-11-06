import { handleStylistRequest } from '../../server/ai-stylist.mjs';
export async function onRequest(context){ return handleStylistRequest(context); }
