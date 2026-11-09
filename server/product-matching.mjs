/** Internal composition only: no HTTP endpoint, provider call, or DB mutation. */
import matching from '../assets/product-matching.js';
import { loadVerifiedCatalog } from './catalog-repository.mjs';
export async function rankApprovedCatalog(db,input,{allowLiveCatalog=false,now=Date.now(),destination='KR'}={}){
 const preferences=matching.preferences(input);
 // Approval comes from trusted server orchestration, never request fields.
 const catalog=await loadVerifiedCatalog(db,{allowLiveCatalog:allowLiveCatalog===true,now,destination,currency:preferences.currency,limit:24});
 const ranked=matching.rank(catalog.products,preferences,{now,mode:'approved'});
 return {status:catalog.status,...ranked};
}
