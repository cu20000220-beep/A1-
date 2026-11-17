/** Isolated, disabled-by-default FASHN transport. No route, DB, SDK or retries.
 * Official schema: https://docs.fashn.ai/api-reference/tryon-v1-6
 * Privacy: https://docs.fashn.ai/api-overview/data-retention-privacy
 * Reviewed 2026-11-17: one output = one credit; on-demand $0.075/credit.
 * Base64 minimizes URL/CDN retention; it does NOT mean zero provider retention.
 */
if (typeof window !== 'undefined' || typeof document !== 'undefined') throw new Error('Virtual try-on is server-only.');

const ENDPOINT = 'https://api.fashn.ai/v1';
const MODEL = 'tryon-v1.6';
const COST_MICRO_USD = 75_000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 24 * 1024 * 1024;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = (value,min,max) => Number.isSafeInteger(value) && value >= min && value <= max;
// The vendor does not publish a stable prefix/length format. Accept bounded
// RFC6750 bearer characters, never whitespace, controls or a pasted URL.
const keyValid = value => typeof value === 'string' && /^[A-Za-z0-9._~+/-]{16,500}={0,2}$/.test(value);

export class VirtualTryOnError extends Error {
  constructor(status,code,billingMayHaveOccurred=false) {
    super(code); this.name='VirtualTryOnError'; this.status=status; this.code=code;
    this.billingMayHaveOccurred=billingMayHaveOccurred;
  }
}
const fail = (status,code) => { throw new VirtualTryOnError(status,code); };

export function getVirtualTryOnConfiguration(env={}, {maxCostUSD}={}) {
  const budgetValid = typeof maxCostUSD === 'number' && Number.isFinite(maxCostUSD)
    && maxCostUSD >= COST_MICRO_USD/1e6 && maxCostUSD <= 1_000_000;
  const enabled = env.A1_VIRTUAL_TRYON_MODE === 'live' && env.A1_VIRTUAL_TRYON_PROVIDER === 'fashn'
    && env.A1_VIRTUAL_TRYON_APPROVED === 'true';
  return Object.freeze({enabled, ready:enabled && keyValid(env.FASHN_API_KEY) && budgetValid,
    provider:'fashn',model:MODEL,estimatedCostUSD:COST_MICRO_USD/1e6,
    maxCostUSD:budgetValid?maxCostUSD:null,actual3D:false});
}

function image(value,{output=false}={}) {
  if(typeof value!=='string' || value.length>Math.ceil(MAX_IMAGE_BYTES/3)*4+64) fail(413,'image_input_invalid');
  const matched=value.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
  if(!matched || matched[2].length%4!==0 || output&&matched[1]!=='png') fail(400,'image_input_invalid');
  let bytes;
  try { bytes=atob(matched[2]); } catch { fail(400,'image_input_invalid'); }
  if(bytes.length<24 || bytes.length>MAX_IMAGE_BYTES || btoa(bytes)!==matched[2]) fail(413,'image_input_invalid');
  const prefix=Array.from(bytes.slice(0,12),c=>c.charCodeAt(0));
  const starts=signature=>signature.every((byte,index)=>prefix[index]===byte);
  const valid=matched[1]==='png'?starts([137,80,78,71,13,10,26,10]):matched[1]==='jpeg'?starts([255,216,255]):starts([82,73,70,70])&&[87,69,66,80].every((b,i)=>prefix[i+8]===b);
  if(!valid) fail(400,'image_input_invalid');
  if(matched[1]==='png') {
    const n=offset=>[0,1,2,3].reduce((sum,i)=>sum*256+bytes.charCodeAt(offset+i),0);
    const width=n(16),height=n(20);
    if(bytes.slice(12,16)!=='IHDR' || !integer(width,1,10000) || !integer(height,1,10000) || width*height>30_000_000) fail(413,'image_input_invalid');
  }
  return value;
}
function requestBody(input) {
  const allowed=['personImage','garmentImage','externalPhotoConsent','garmentUsePermission','category','garmentPhotoType'];
  if(!object(input) || Object.keys(input).some(key=>!allowed.includes(key))) fail(400,'tryon_input_invalid');
  if(input.externalPhotoConsent!==true) fail(403,'external_photo_consent_required');
  if(input.garmentUsePermission!==true) fail(403,'garment_permission_required');
  const category=input.category??'auto',photoType=input.garmentPhotoType??'auto';
  if(!['auto','tops','bottoms','one-pieces'].includes(category) || !['auto','flat-lay','model'].includes(photoType)) fail(400,'tryon_input_invalid');
  return JSON.stringify({model_name:MODEL,inputs:{model_image:image(input.personImage),garment_image:image(input.garmentImage),
    category,garment_photo_type:photoType,mode:'balanced',num_samples:1,moderation_level:'conservative',
    output_format:'png',return_base64:true}});
}
async function readJson(response,signal) {
  const declared=response.headers.get('content-length');
  if(!/^application\/json(?:\s*;.*)?$/i.test(response.headers.get('content-type')||'')
    || declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>MAX_RESPONSE_BYTES)) {
    await response.body?.cancel(); fail(502,'provider_invalid_response');
  }
  const reader=response.body?.getReader();if(!reader) fail(502,'provider_invalid_response');
  const cancel=()=>{reader.cancel().catch(()=>{});};
  signal.addEventListener('abort',cancel,{once:true});
  const chunks=[];let length=0;
  try { for(;;) {const {done,value}=await reader.read();if(done)break;length+=value.byteLength;
    if(length>MAX_RESPONSE_BYTES){await reader.cancel();fail(502,'provider_invalid_response');}chunks.push(value);}
  } finally { signal.removeEventListener('abort',cancel);reader.releaseLock(); }
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  try {return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{fail(502,'provider_invalid_response');}
}
function delay(ms,signal) {
  return new Promise((resolve,reject)=>{
    if(signal.aborted){reject(new VirtualTryOnError(499,'request_aborted'));return;}
    const abort=()=>{clearTimeout(timer);reject(new VirtualTryOnError(499,'request_aborted'));};
    const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);
    signal.addEventListener('abort',abort,{once:true});
  });
}

/** Budget is atomic ONLY within this client instance/process. Not a distributed
 * account/day limit: never expose a public route without a durable shared cap,
 * server-verified garment rights and per-person external-processing consent.
 * Failed/uncertain calls keep their reservation; aborting does not cancel billing.
 */
export function createVirtualTryOnClient(env={}, {fetchImpl=globalThis.fetch,maxCostUSD,
  timeoutMs=120000,pollIntervalMs=1500,maxPolls=40,sleepImpl=delay}={}) {
  const config=getVirtualTryOnConfiguration(env,{maxCostUSD});
  const apiKey=env.FASHN_API_KEY;
  const validOptions=typeof fetchImpl==='function'&&typeof sleepImpl==='function'
    && integer(timeoutMs,1,180000)&&integer(pollIntervalMs,0,10000)&&integer(maxPolls,1,60);
  const cap=config.maxCostUSD===null?0:Math.floor(config.maxCostUSD*1e6);
  let reserved=0,runAttempts=0;
  function usage(){return Object.freeze({reservedMicroUsd:reserved,remainingMicroUsd:Math.max(0,cap-reserved),runAttempts,budgetScope:'this-client-process-only'});}
  async function run(input,{signal}={}) {
    if(!config.ready||!validOptions||!getVirtualTryOnConfiguration(env,{maxCostUSD}).ready||env.FASHN_API_KEY!==apiKey) fail(503,'tryon_not_configured');
    if(signal!==undefined&&(!signal||typeof signal.aborted!=='boolean'||typeof signal.addEventListener!=='function'||typeof signal.removeEventListener!=='function')) fail(400,'tryon_input_invalid');
    if(signal?.aborted) fail(499,'request_aborted');
    let serialized=requestBody(input);
    // No await between checking and reserving: concurrent runs share this cap.
    if(cap-reserved<COST_MICRO_USD) fail(429,'tryon_budget_exhausted');
    reserved+=COST_MICRO_USD;
    const controller=new AbortController();let timer,rejectAbort,attempted=false;
    const aborted=new Promise((_,reject)=>{rejectAbort=reject;});
    const externalAbort=()=>{controller.abort();rejectAbort(new VirtualTryOnError(499,'request_aborted'));};
    signal?.addEventListener('abort',externalAbort,{once:true});
    timer=setTimeout(()=>{controller.abort();rejectAbort(new VirtualTryOnError(504,'provider_timeout'));},timeoutMs);
    async function call(url,options) {
      if(!getVirtualTryOnConfiguration(env,{maxCostUSD}).ready||env.FASHN_API_KEY!==apiKey) fail(503,'tryon_not_configured');
      const response=await fetchImpl(url,{...options,redirect:'manual',signal:controller.signal,
        headers:{Authorization:'Bearer '+apiKey,Accept:'application/json',...(options.method==='POST'?{'Content-Type':'application/json'}:{})}});
      if(!response.ok || response.url&&response.url!==url){await response.body?.cancel();fail(response.status===429?429:503,response.status===429?'provider_rate_limited':'provider_unavailable');}
      const credits=response.headers.get('x-fashn-credits-used');
      if(credits!==null&&!/^(?:0|1)(?:\.0+)?$/.test(credits)){await response.body?.cancel();fail(502,'provider_billing_conflict');}
      return readJson(response,controller.signal);
    }
    const work=async()=>{
      attempted=true;runAttempts++;
      const started=await call(ENDPOINT+'/run',{method:'POST',body:serialized});
      if(!object(started)||started.error!=null||typeof started.id!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(started.id)) fail(502,'provider_invalid_response');
      for(let poll=0;poll<maxPolls;poll++) {
        if(controller.signal.aborted) fail(499,'request_aborted');
        if(poll>0) await sleepImpl(pollIntervalMs,controller.signal);
        const current=await call(ENDPOINT+'/status/'+started.id,{method:'GET'});
        if(!object(current)||current.id!==started.id||!['starting','in_queue','processing','completed','failed'].includes(current.status)) fail(502,'provider_invalid_response');
        if(current.status==='failed') fail(502,'provider_generation_failed');
        if(current.error!=null) fail(502,'provider_invalid_response');
        if(current.status==='completed') {
          if(!Array.isArray(current.output)||current.output.length!==1) fail(502,'provider_invalid_response');
          let output;try{output=image(current.output[0],{output:true});}catch{fail(502,'provider_invalid_response');}
          return Object.freeze({kind:'ai-tryon-simulation',provider:'fashn',model:MODEL,image:output,
            providerPredictionId:started.id,estimatedCostUSD:COST_MICRO_USD/1e6,actual3D:false,sizeGuaranteed:false,
            privacy:'External processing; base64 output availability up to 60 minutes. Provider request records are not deleted automatically.'});
        }
      }
      fail(504,'provider_poll_limit');
    };
    try {return await Promise.race([work(),aborted]);}
    catch(error){const known=error instanceof VirtualTryOnError?error:new VirtualTryOnError(503,'provider_unavailable');
      throw new VirtualTryOnError(known.status,known.code,attempted);
    } finally {clearTimeout(timer);controller.abort();signal?.removeEventListener('abort',externalAbort);serialized='';}
  }
  return Object.freeze({configuration:config,usage,run});
}
