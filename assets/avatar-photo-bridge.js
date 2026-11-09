/* Same-document, explicit-consent reference bridge. No storage, URLs or images in events. */
'use strict';
(()=>{
 if(!window.A1Preview)return;
 const button=document.querySelector('#lab-open-avatar'),result=document.querySelector('#ai-result');if(!button||!result)return;
 const I=window.A1I18n,G=window.A1AvatarGeometry,T=window.A1LabTemplates;
 I.register({
 '연구실 실행 코드를 받지 못했습니다. 새로고침해주세요. [A1-LAB-SCRIPT]':'The lab code did not load. Reload this page. [A1-LAB-SCRIPT]',
 '내 체형으로 3D 아바타 만들기':'Create a 3D avatar from my photo ratios',
 '분석된 두 비율을 기기 내 3D 형상에 적용하는 데 동의합니다. 실제 치수 측정은 아닙니다.':'I agree to apply the two analysis ratios to on-device 3D geometry. These are not measurements.',
 '먼저 분석 비율 사용에 동의해주세요. 사진 비교 표시는 연구실에서 별도로 동의합니다.':'First agree to use the analysis ratios. Displaying the photo requires separate consent in the lab.',
 '기본 아바타 열기 · 수동 보정':'Open default avatar · manual correction',
 '3D 연구실을 열지 못했습니다. 연결을 확인하고 다시 눌러주세요.':'The 3D lab could not open. Check the connection and retry.',
 '분석값이 부족합니다. 기본 아바타에서 직접 보정해주세요.':'Analysis is insufficient. Use the default avatar and manual corrections.'
 });
 I.setText(button,'내 체형으로 3D 아바타 만들기');
 const label=document.createElement('label');label.className='avatar-reference-consent';const consent=document.createElement('input');consent.type='checkbox';consent.id='avatar-reference-consent';const text=document.createElement('span');I.setText(text,'분석된 두 비율을 기기 내 3D 형상에 적용하는 데 동의합니다. 실제 치수 측정은 아닙니다.');label.append(consent,text);button.before(label);
 const status=document.createElement('p');status.id='avatar-bridge-status';status.setAttribute('role','status');button.after(status);
 const fallback=document.createElement('button');fallback.id='avatar-open-default';fallback.type='button';fallback.className='dark-button';I.setText(fallback,'기본 아바타 열기 · 수동 보정');document.querySelector('#ai-form').append(fallback);
 const defaultStatus=document.createElement('p');defaultStatus.id='avatar-default-status';defaultStatus.setAttribute('role','status');fallback.after(defaultStatus);
 let metrics=null,pending=null,revision=0;
 const reveal=el=>{const html=document.documentElement,old=html.style.scrollBehavior;html.style.scrollBehavior='auto';const offset=(document.querySelector('body>header')?.getBoundingClientRect().height||0)+16;window.scrollTo(0,Math.max(0,scrollY+el.getBoundingClientRect().top-offset));el.setAttribute('tabindex','-1');el.focus({preventScroll:true});html.style.scrollBehavior=old;};
 async function open(usePhoto,garment){
  if(!T){I.setText(usePhoto?status:defaultStatus,'연구실 실행 코드를 받지 못했습니다. 새로고침해주세요. [A1-LAB-SCRIPT]');return;}
  const token=revision;T.hideFailure(usePhoto?status:defaultStatus);
  if(usePhoto&&!consent.checked){I.setText(status,'먼저 분석 비율 사용에 동의해주세요. 사진 비교 표시는 연구실에서 별도로 동의합니다.');reveal(label);return;}
  try{
   if(!G)throw Object.assign(new Error('script_missing'),{code:'SCRIPT'});
   if(usePhoto){try{G.photoReference(metrics);}catch{I.setText(status,'분석값이 부족합니다. 기본 아바타에서 직접 보정해주세요.');return;}}
   if(!document.querySelector('#avatar-root')){
    if(!pending)pending=T.load('avatar').finally(()=>{pending=null;});const template=await pending;
    if(token!==revision||usePhoto&&(!consent.checked||result.hidden))return;
    if(!document.querySelector('#avatar-root')){document.querySelector('#ai-studio').after(document.importNode(template,true));}
   }
   if(token!==revision||usePhoto&&(!consent.checked||result.hidden))return;
   const root=document.querySelector('#avatar-root');if(!root)return;T.initialize('avatar',root);
   if(!usePhoto)document.dispatchEvent(new CustomEvent('a1:avatar-reference-clear'));
   document.dispatchEvent(new CustomEvent('a1:avatar-open',{detail:{garment}}));
   if(usePhoto)document.dispatchEvent(new CustomEvent('a1:avatar-photo-apply',{detail:{metrics:{...metrics}}}));
   T.hideFailure(status);T.hideFailure(defaultStatus);reveal(root.querySelector('.avatar-views'));
  }catch(error){if(token===revision)T.failure('avatar',usePhoto?status:defaultStatus,error,()=>open(usePhoto,garment));}
 }
 button.addEventListener('click',()=>open(true));fallback.addEventListener('click',()=>open(false));
 document.addEventListener('click',e=>{const link=e.target.closest('[data-avatar-garment]');if(!link)return;e.preventDefault();open(Boolean(consent.checked&&metrics),link.dataset.avatarGarment);});
 consent.addEventListener('change',()=>{if(!consent.checked){revision++;document.dispatchEvent(new CustomEvent('a1:avatar-reference-clear'));}});
 document.addEventListener('a1:analysis-ready',e=>{revision++;metrics=null;consent.checked=false;try{G.photoReference(e.detail?.metrics);metrics={...e.detail.metrics};}catch{}document.dispatchEvent(new CustomEvent('a1:avatar-reference-clear'));});
 const clear=()=>{revision++;metrics=null;consent.checked=false;if(T){T.hideFailure(status);T.hideFailure(defaultStatus);}document.dispatchEvent(new CustomEvent('a1:avatar-reference-clear'));};
 document.addEventListener('a1:analysis-cleared',clear);window.addEventListener('pagehide',clear);
})();
