/* Preview only. Public product IDs, never photos/ratios in navigation or storage. */
'use strict';
(()=>{
 if(!window.A1Preview)return;
 const C=window.A1ProductCatalog,I=window.A1I18n;let selected=null,revision=0,controller,timer;
 I.register({
  '선택한 상품으로 사진 미리보기':'Preview this product on my photo',
  '선택한 상품의 이미지 미리보기 이용 권한이 확인되지 않았습니다.':'Image-preview permission for this product has not been verified.',
  '선택한 상품을 준비하지 못했습니다. 다시 선택해주세요.':'The selected product could not be prepared. Select it again.',
  '선택한 상품은 유지했습니다. 먼저 사진을 선택하고 분석한 뒤 이미지 사용에 동의해주세요.':'Your product is selected. Choose and analyze a photo, then consent to image use.',
  '판매처에서 이 상품 구매하기':'Buy this product at the seller',
  '상품 이미지 이용 권한 확인 · 사진 사용 동의는 별도입니다.':'Product-image permission reviewed · using your photo requires separate consent.'
 });
 function status(message){let target=document.querySelector('#catalog-fitting-status');if(!target){target=document.createElement('p');target.id='catalog-fitting-status';target.setAttribute('role','status');(document.querySelector('#shopping-query-status')||document.querySelector('#stylist-status')||document.querySelector('main')).after(target);}I.setText(target,message);}
 function current(){return selected&&selected.expiresAt>Date.now()&&selected.stock==='in_stock'?selected:null;}
 function clear(){revision++;controller?.abort();clearTimeout(timer);selected=null;document.dispatchEvent(new CustomEvent('a1:catalog-fitting-clear'));}
 async function open(id){
  if(typeof id!=='string'||! /^[A-Za-z0-9_.:-]{1,160}$/.test(id))return;
  const token=++revision;controller?.abort();controller=new AbortController();const active=controller,deadline=setTimeout(()=>active.abort(),10000);
  try{
   const response=await fetch('/assets/approved-products.json',{credentials:'omit',cache:'no-store',redirect:'error',signal:active.signal});if(!response.ok||!/application\/json/i.test(response.headers.get('content-type')||''))throw Error('catalog');
   const text=await response.text();if(text.length>1000000)throw Error('catalog');const snapshot=JSON.parse(text),product=C.fittingProduct(snapshot,id);if(!product)throw Error('rights');if(token!==revision)return;
   // The stylist has no body photograph. Transfer only the public product ID
   // in a fragment; the destination removes it immediately and revalidates.
   if(!document.querySelector('#ai-form')){location.assign('/#fit-product='+encodeURIComponent(id));return;}
   if(!document.querySelector('#lab-root')){const template=await window.A1LabTemplates.load('product');if(token!==revision)return;template.querySelector('#ai-studio')?.remove();document.querySelector('#ai-studio').after(document.importNode(template,true));}
   if(token!==revision)return;window.A1LabTemplates.initialize('product',document.querySelector('#lab-root'));
   selected=Object.freeze({...product});clearTimeout(timer);timer=setTimeout(clear,Math.max(1,product.expiresAt-Date.now()+1));
   document.dispatchEvent(new CustomEvent('a1:catalog-fitting-selected',{detail:{id}}));
   const ready=!document.querySelector('#ai-result').hidden,target=document.querySelector(ready?'#lab-local-photo-fitting':'#ai-form');target?.scrollIntoView({block:'start'});
   if(!ready)status('선택한 상품은 유지했습니다. 먼저 사진을 선택하고 분석한 뒤 이미지 사용에 동의해주세요.');
  }catch(error){if(token===revision)status(error.message==='rights'?'선택한 상품의 이미지 미리보기 이용 권한이 확인되지 않았습니다.':'선택한 상품을 준비하지 못했습니다. 다시 선택해주세요.');}
  finally{clearTimeout(deadline);}
 }
 // A file replacement fires the existing analysis-clear event before its new
 // analysis. Keep only the public item selection; all fitting pixels are erased.
 document.addEventListener('a1:analysis-cleared',event=>{if(event.detail?.reason!=='photo-replacement')clear();});
 window.addEventListener('pagehide',clear);
 window.A1CatalogFitting=Object.freeze({open,current,clear});
 const id=new URLSearchParams(location.hash.slice(1)).get('fit-product');if(id){history.replaceState(null,'',location.pathname+location.search);open(id);}
})();
