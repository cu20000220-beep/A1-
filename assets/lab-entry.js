/* Preview-only, same-document navigation: no photo or ratio serialization. */
'use strict';
(()=>{
 if(!window.A1Preview)return;
 const result=document.querySelector('#ai-result');if(!result)return;
 const I=window.A1I18n,T=window.A1LabTemplates;
 I.register({
 '연구실 실행 코드를 받지 못했습니다. 새로고침해주세요. [A1-LAB-SCRIPT]':'The lab code did not load. Reload this page. [A1-LAB-SCRIPT]',
 '내 체형에 맞는 의류 추천 보기':'View clothing recommendation examples',
 '추천 의류 비교하기':'Compare recommended garments',
 '내 사진으로 가상 피팅하기 · 2D 시험':'Try my photo · local 2D experiment',
 '3D 아바타 · 무료 시각적 미리보기':'3D avatar · free visual preview',
 '무료 연구실 · 실제 상품 준비 중. 가상 시험 의류·로컬 2D·단순 3D 미리보기이며 실제 AI 착용 합성은 없습니다.':'Free lab · real products pending. Fictional garments, local 2D and simplified 3D previews; no real AI try-on.',
 '연구실을 열지 못했습니다. 인터넷 연결을 확인하고 다시 눌러주세요.':'The lab could not be opened. Check your connection and try again.',
 '연구실 열기: 기존 사진과 조건은 이 화면 메모리에만 유지합니다. 비율 사용과 2D 이미지 사용은 각각 별도 동의가 필요합니다.':'Opening the lab: the existing photo and preferences stay in this page memory. Ratio use and 2D image use each require separate consent.'
 });
 const nav=document.createElement('section');nav.id='lab-entry';nav.className='lab-entry';nav.hidden=true;
 const note=document.createElement('p');I.setText(note,'무료 연구실 · 실제 상품 준비 중. 가상 시험 의류·로컬 2D·단순 3D 미리보기이며 실제 AI 착용 합성은 없습니다.');nav.append(note);
 const status=document.createElement('p');status.id='lab-entry-status';status.setAttribute('role','status');
 let metrics=null,pending=null,revision=0;
 async function open(target){
  const token=revision;
  if(!T){I.setText(status,'연구실 실행 코드를 받지 못했습니다. 새로고침해주세요. [A1-LAB-SCRIPT]');return;}
  T.hideFailure(status);I.setText(status,'연구실 열기: 기존 사진과 조건은 이 화면 메모리에만 유지합니다. 비율 사용과 2D 이미지 사용은 각각 별도 동의가 필요합니다.');
  try{
   if(!document.querySelector('#lab-root')){
    if(!pending)pending=T.load('product').finally(()=>{pending=null;});
    const template=await pending;if(token!==revision||!metrics||result.hidden)return;
    if(!document.querySelector('#lab-root')){template.querySelector('#ai-studio')?.remove();document.querySelector('#ai-studio').after(document.importNode(template,true));}
   }
   T.initialize('product',document.querySelector('#lab-root'));
   if(!metrics||result.hidden)return;
   document.dispatchEvent(new CustomEvent('a1:lab-enter',{detail:{metrics:{...metrics}}}));
   document.dispatchEvent(new CustomEvent('a1:lab-navigate',{detail:{target}}));T.hideFailure(status);
  }catch(error){if(token===revision)T.failure('product',status,error,()=>open(target));}
 }
 for(const [id,label,target]of [['recommend','내 체형에 맞는 의류 추천 보기','#lab-preferences'],['compare','추천 의류 비교하기','#lab-comparison'],['fitting','내 사진으로 가상 피팅하기 · 2D 시험','#lab-fitting']]){
  const b=document.createElement('button');b.id='lab-open-'+id;b.type='button';b.className='dark-button';I.setText(b,label);b.addEventListener('click',()=>open(target));nav.append(b);
 }
 const avatar=document.createElement('button');avatar.type='button';avatar.id='lab-open-avatar';I.setText(avatar,'3D 아바타 · 무료 시각적 미리보기');nav.append(avatar,status);result.querySelector('.ai-result-copy').append(nav);
 document.addEventListener('a1:analysis-ready',e=>{revision++;if(!window.A1ProductMatching.validMetrics(e.detail?.metrics))return;metrics={...e.detail.metrics};nav.hidden=false;});
 document.addEventListener('a1:analysis-cleared',()=>{revision++;metrics=null;nav.hidden=true;if(T)T.hideFailure(status);});
 window.addEventListener('pagehide',()=>{revision++;metrics=null;nav.hidden=true;});
})();
