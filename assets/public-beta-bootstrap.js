/* Server-confirmed on-device fashion helpers. Never account or API authorization. */
'use strict';
(() => {
  if(location.hostname!=='a1fashion.pages.dev'||location.origin!=='https://a1fashion.pages.dev')return;
  const factory=window.A1LocalFashionCore,I=window.A1I18n;
  if(!factory||!I)return;
  if(Object.hasOwn(window,'A1PublicLocal')||Object.hasOwn(window,'A1PublicBeta')){console.warn('[A1-PUBLIC-BETA] Local fashion name is already reserved.');return;}
  let publishedLocal,publishedBeta,ended=false,pending=true,early=null,generation=0;
  // Reserve both names before awaiting policy. A client flag or event cannot
  // install the local experience while the server response is still pending.
  try{Object.defineProperties(window,{
    A1PublicLocal:{get:()=>publishedLocal,configurable:false},
    A1PublicBeta:{get:()=>publishedBeta,configurable:false}
  });}catch{console.warn('[A1-PUBLIC-BETA] Local fashion names could not be reserved.');return;}
  const controller=new AbortController(),policyUrl='https://a1fashion.pages.dev/api/policy';
  const core=factory.create({I,scope:'public-beta'});
  let domReady=document.readyState==='complete';
  const domLoaded=()=>{domReady=true;};
  if(!domReady)document.addEventListener('DOMContentLoaded',domLoaded,{once:true});
  const discard=()=>{early=null;generation++;};
  const remember=event=>{
    if(ended)return;
    discard();
    if(!pending)return;
    if(!core.validMetrics(event.detail?.metrics))return;
    const result=document.querySelector('#ai-result');
    if(!result||result.hidden||!result.isConnected)return;
    early={result,generation,metrics:Object.freeze({shoulderHipRatio:event.detail.metrics.shoulderHipRatio,legTorsoRatio:event.detail.metrics.legTorsoRatio})};
  };
  const stopRemembering=()=>{
    pending=false;
    document.removeEventListener('a1:analysis-ready',remember);
  };
  document.addEventListener('a1:analysis-ready',remember);
  for(const name of ['a1:analysis-cleared','a1:analysis-revoked','a1:auth-changed'])document.addEventListener(name,discard);
  window.addEventListener('storage',event=>{if(event.key==='a1-fashion:auth-event')discard();});
  window.addEventListener('pagehide',()=>{ended=true;publishedLocal=publishedBeta=undefined;discard();stopRemembering();controller.abort();clearTimeout(deadline);});
  // A restored document must receive fresh server policy. Photos and ratios
  // have already been cleared by the existing pagehide handlers.
  window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
  const deadline=setTimeout(()=>{ended=true;discard();stopRemembering();controller.abort();},5000);
  (async()=>{
    try{
      const response=await fetch('/api/policy',{method:'GET',credentials:'omit',cache:'no-store',redirect:'error',mode:'same-origin',headers:{Accept:'application/json'},signal:controller.signal});
      if(ended||controller.signal.aborted||response.status!==200||!response.ok||response.redirected||response.url!==policyUrl
        ||(response.headers.get('Content-Type')||'').split(';')[0].trim().toLowerCase()!=='application/json')return;
      const policy=await response.json();
      if(ended||controller.signal.aborted||!policy||Array.isArray(policy)
        ||Object.keys(policy).sort().join(',')!=='accountRequiredForSaving,billingEnabled,freeBetaMode,localFashionEnabled'
        ||policy.localFashionEnabled!==true||typeof policy.freeBetaMode!=='boolean'
        ||policy.billingEnabled!==false||policy.accountRequiredForSaving!==true)return;
      // Even a cached-fast policy response must wait for all deferred
      // consumers to finish registering their readiness listeners.
      if(!domReady)await new Promise(resolve=>{
        const done=()=>{document.removeEventListener('DOMContentLoaded',done);controller.signal.removeEventListener('abort',done);resolve();};
        document.addEventListener('DOMContentLoaded',done,{once:true});
        controller.signal.addEventListener('abort',done,{once:true});
        if(controller.signal.aborted)done();
      });
      if(ended||controller.signal.aborted)return;
      pending=false;
      publishedLocal=Object.freeze({...core,mode:'server-public-local'});
      if(policy.freeBetaMode)publishedBeta=Object.freeze({...core,mode:'server-free-beta-local'});
      document.dispatchEvent(new CustomEvent('a1:public-local-ready'));
      if(publishedBeta)document.dispatchEvent(new CustomEvent('a1:public-beta-ready'));
      stopRemembering();
      const value=early;
      early=null;
      if(ended||!value||value.generation!==generation||document.querySelector('#ai-result')!==value.result
        ||!value.result.isConnected||value.result.hidden||value.result.closest('[hidden]')||!value.result.getClientRects().length)return;
      // Readiness listeners have synchronously installed the consumers. Only
      // these two validated numbers are replayed; no photo or stored payload.
      document.dispatchEvent(new CustomEvent('a1:analysis-ready',{detail:Object.freeze({metrics:value.metrics})}));
    }catch{/* Missing, invalid or unavailable policy keeps the local experience closed. */}
    finally{clearTimeout(deadline);document.removeEventListener('DOMContentLoaded',domLoaded);stopRemembering();discard();}
  })();
})();
