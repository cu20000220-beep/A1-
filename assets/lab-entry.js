/* Preview-only, same-document navigation: no photo or ratio serialization. */
'use strict';
(()=>{
 if(!window.A1Preview)return;
 const result=document.querySelector('#ai-result');if(!result)return;
 const I=window.A1I18n;
 I.register({
 '내 체형에 맞는 의류 추천 보기':'View clothing recommendation examples',
 '추천 의류 비교하기':'Compare recommended garments',
 '내 사진으로 가상 피팅하기 · 2D 시험':'Try my photo · local 2D experiment',
 '3D 아바타 피팅 · 개발 중':'3D avatar fitting · in development',
 '무료 연구실 · 실제 상품 준비 중. 가상 시험 의류와 로컬 2D 배치만 제공하며 AI 착용 합성·3D 기능은 없습니다.':'Free lab · real products pending. Fictional garments and local 2D placement only; no AI try-on or 3D feature.',
 '연구실을 열지 못했습니다. 인터넷 연결을 확인하고 다시 눌러주세요.':'The lab could not be opened. Check your connection and try again.',
 '연구실 열기: 기존 사진과 조건은 이 화면 메모리에만 유지합니다. 비율 사용과 2D 이미지 사용은 각각 별도 동의가 필요합니다.':'Opening the lab: the existing photo and preferences stay in this page memory. Ratio use and 2D image use each require separate consent.'
 });
 const nav=document.createElement('section');nav.id='lab-entry';nav.className='lab-entry';nav.hidden=true;
 const note=document.createElement('p');I.setText(note,'무료 연구실 · 실제 상품 준비 중. 가상 시험 의류와 로컬 2D 배치만 제공하며 AI 착용 합성·3D 기능은 없습니다.');nav.append(note);
 const status=document.createElement('p');status.id='lab-entry-status';status.setAttribute('role','status');
 let metrics=null,pending=null;
 async function open(target){
  I.setText(status,'연구실 열기: 기존 사진과 조건은 이 화면 메모리에만 유지합니다. 비율 사용과 2D 이미지 사용은 각각 별도 동의가 필요합니다.');
  try{
   if(!document.querySelector('#lab-root')){
    if(!pending)pending=fetch('/product-lab.html',{credentials:'omit',cache:'no-store',redirect:'error'}).then(async r=>{
     if(!r.ok)throw Error('lab_unavailable');
     const doc=new DOMParser().parseFromString(await r.text(),'text/html'),root=doc.querySelector('#lab-root');if(!root)throw Error('lab_missing');
     root.querySelector('#ai-studio')?.remove();
     // Only the versioned, same-origin static template is used; scripts in it
     // are not imported. The existing photo/canvas never leaves this document.
     document.querySelector('#ai-studio').after(document.importNode(root,true));
     document.dispatchEvent(new CustomEvent('a1:lab-mounted'));
    }).finally(()=>{pending=null;});
    await pending;
   }
   if(!metrics||result.hidden)return;
   document.dispatchEvent(new CustomEvent('a1:lab-enter',{detail:{metrics:{...metrics}}}));
   const section=document.querySelector(target);section.setAttribute('tabindex','-1');section.scrollIntoView({block:'start'});section.focus({preventScroll:true});
  }catch{I.setText(status,'연구실을 열지 못했습니다. 인터넷 연결을 확인하고 다시 눌러주세요.');}
 }
 for(const [id,label,target]of [['recommend','내 체형에 맞는 의류 추천 보기','#lab-preferences'],['compare','추천 의류 비교하기','#lab-comparison'],['fitting','내 사진으로 가상 피팅하기 · 2D 시험','#lab-fitting']]){
  const b=document.createElement('button');b.id='lab-open-'+id;b.type='button';b.className='dark-button';I.setText(b,label);b.addEventListener('click',()=>open(target));nav.append(b);
 }
 const avatar=document.createElement('button');avatar.type='button';avatar.disabled=true;avatar.id='lab-open-avatar';I.setText(avatar,'3D 아바타 피팅 · 개발 중');nav.append(avatar,status);result.querySelector('.ai-result-copy').append(nav);
 document.addEventListener('a1:analysis-ready',e=>{if(!window.A1ProductMatching.validMetrics(e.detail?.metrics))return;metrics={...e.detail.metrics};nav.hidden=false;});
 document.addEventListener('a1:analysis-cleared',()=>{metrics=null;nav.hidden=true;status.textContent='';});
 window.addEventListener('pagehide',()=>{metrics=null;nav.hidden=true;});
})();
