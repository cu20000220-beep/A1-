/* Local fitting. Public product IDs, never photos/ratios in navigation or storage. */
'use strict';
(()=>{
 function initialize(){
 const experience=window.A1Preview||(window.A1PublicLocal?.mode==='server-public-local'?window.A1PublicLocal:null)||(window.A1PublicBeta?.mode==='server-free-beta-local'?window.A1PublicBeta:null);
 const C=window.A1ProductCatalog,I=window.A1I18n;
 if(!experience||!C||!I||window.A1CatalogFitting)return;
 document.removeEventListener('a1:public-local-ready',initialize);document.removeEventListener('a1:public-beta-ready',initialize);
 let selected=null,selectedObservation=null,selectedImages=null,revision=0,controller,timer;
 I.register({
  '선택한 상품으로 사진 미리보기':'Preview this product on my photo',
  '선택한 상품의 이미지 미리보기 이용 권한이 확인되지 않았습니다.':'Image-preview permission for this product has not been verified.',
  '선택한 상품을 준비하지 못했습니다. 다시 선택해주세요.':'The selected product could not be prepared. Select it again.',
  '선택한 상품은 유지했습니다. 먼저 사진을 선택하고 분석한 뒤 이미지 사용에 동의해주세요.':'Your product is selected. Choose and analyze a photo, then consent to image use.',
  '판매처에서 이 상품 구매하기':'Buy this product at the seller',
  '상품 이미지 이용 권한 확인 · 사진 사용 동의는 별도입니다.':'Product-image permission reviewed · using your photo requires separate consent.'
 });
 function status(message){let target=document.querySelector('#catalog-fitting-status');if(!target){target=document.createElement('p');target.id='catalog-fitting-status';target.setAttribute('role','status');(document.querySelector('#shopping-query-status')||document.querySelector('#stylist-status')||document.querySelector('#ai-status')||document.querySelector('main')).after(target);}I.setText(target,message);}
 function current(){
  if(!selected||selected.expiresAt<=Date.now())return null;
  if(selected.sourceKind==='operator-authorized-observation'){
   try{return window.A1ProductImages?.fittingProduct(selectedImages,selectedObservation,selected.id)||null;}catch{return null;}
  }
  return selected.stock==='in_stock'?selected:null;
 }
 async function publicJson(path,active){
  const response=await fetch(path,{credentials:'omit',cache:'no-store',redirect:'error',signal:active.signal});
  if(!response.ok||!/^application\/json(?:;|$)/i.test(response.headers.get('content-type')||''))throw Error('catalog');
  const url=new URL(response.url||path,location.origin);if(url.origin!==location.origin||url.pathname!==path||url.search)throw Error('catalog');
  const text=await response.text();if(text.length>1000000)throw Error('catalog');return JSON.parse(text);
 }
 async function showProduct(product,id,token,kind='approved'){
  if(token!==revision)return;
  // A public item ID is the only cross-page handoff. No private pixels/ratios.
  if(!document.querySelector('#ai-form')){location.assign('/#'+(kind==='observed'?'fit-observed-product':'fit-product')+'='+encodeURIComponent(id));return;}
  if(!document.querySelector('#lab-root')){
   if(!window.A1LabTemplates)throw Error('catalog');
   const template=await window.A1LabTemplates.load('product');if(token!==revision)return;
   if(!document.querySelector('#lab-root')){
    const lab=document.importNode(template,true);
    lab.querySelector('#ai-studio')?.remove();
    const mount=document.querySelector('#main-fitting-lab');
    if(mount)mount.append(lab);
    else document.querySelector('#ai-studio').after(lab);
   }
  }
  if(token!==revision)return;window.A1LabTemplates.initialize('product',document.querySelector('#lab-root'));
  selected=Object.freeze({...product});clearTimeout(timer);timer=setTimeout(clear,Math.max(1,Math.min(2147483647,product.expiresAt-Date.now()+1)));
  document.dispatchEvent(new CustomEvent('a1:catalog-fitting-selected',{detail:{id}}));
  const ready=Boolean(document.querySelector('#ai-result')&&!document.querySelector('#ai-result').hidden),target=document.querySelector(ready?'#lab-local-photo-fitting':'#ai-form');target?.scrollIntoView({block:'start'});
  if(ready&&window.A1LabNavigation)await window.A1LabNavigation.open('#lab-local-photo-fitting');
  if(!ready)status('선택한 상품은 유지했습니다. 먼저 사진을 선택하고 분석한 뒤 이미지 사용에 동의해주세요.');
 }
 function clear(){revision++;controller?.abort();clearTimeout(timer);selected=null;selectedObservation=selectedImages=null;document.dispatchEvent(new CustomEvent('a1:catalog-fitting-clear'));}
 async function open(id){
  if(typeof id!=='string'||! /^[A-Za-z0-9_.:-]{1,160}$/.test(id))return;
  const token=++revision;controller?.abort();controller=new AbortController();const active=controller,deadline=setTimeout(()=>active.abort(),10000);
  try{
   const response=await fetch('/assets/approved-products.json',{credentials:'omit',cache:'no-store',redirect:'error',signal:active.signal});if(!response.ok||!/application\/json/i.test(response.headers.get('content-type')||''))throw Error('catalog');
   const text=await response.text();if(text.length>1000000)throw Error('catalog');const snapshot=JSON.parse(text),product=C.fittingProduct(snapshot,id);if(!product)throw Error('rights');if(token!==revision)return;
   selectedObservation=selectedImages=null;await showProduct(product,id,token);
  }catch(error){if(token===revision)status(error.message==='rights'?'선택한 상품의 이미지 미리보기 이용 권한이 확인되지 않았습니다.':'선택한 상품을 준비하지 못했습니다. 다시 선택해주세요.');}
  finally{clearTimeout(deadline);}
 }
 async function openObserved(id){
  if(typeof id!=='string'||!/^[A-Za-z0-9_.:-]{1,160}$/.test(id))return;
  clear();const token=revision;controller=new AbortController();const active=controller,deadline=setTimeout(()=>active.abort(),10000);
  try{
   if(!window.A1ProductImages)throw Error('catalog');
   const [observations,images]=await Promise.all([publicJson('/assets/observed-products.json',active),publicJson('/assets/product-images.json',active)]);
   const product=window.A1ProductImages.fittingProduct(images,observations,id);if(!product)throw Error('rights');
   if(token!==revision||active.signal.aborted)return;selectedObservation=observations;selectedImages=images;
   await showProduct(product,id,token,'observed');
  }catch(error){if(token===revision)status(error.message==='rights'?'선택한 상품의 이미지 미리보기 이용 권한이 확인되지 않았습니다.':'선택한 상품을 준비하지 못했습니다. 다시 선택해주세요.');}
  finally{clearTimeout(deadline);}
 }
 // A file replacement fires the existing analysis-clear event before its new
 // analysis. Keep only the public item selection; all fitting pixels are erased.
 document.addEventListener('a1:analysis-cleared',event=>{if(event.detail?.reason!=='photo-replacement')clear();});
 window.addEventListener('pagehide',clear);
 window.A1CatalogFitting=Object.freeze({open,openObserved,current,clear});
 const fragment=new URLSearchParams(location.hash.slice(1)),id=fragment.get('fit-product'),observedId=fragment.get('fit-observed-product');
 if(id||observedId){history.replaceState(null,'',location.pathname+location.search);const resume=()=>observedId?openObserved(observedId):open(id);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',resume,{once:true});else resume();}
 }
 if(document.readyState!=='complete')document.addEventListener('DOMContentLoaded',initialize,{once:true});
 document.addEventListener('a1:public-local-ready',initialize);document.addEventListener('a1:public-beta-ready',initialize);initialize();
})();
