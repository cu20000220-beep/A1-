/* Same-document navigation: no photo or ratio serialization. */
'use strict';
(()=>{
 function initialize(){
 const preview=Boolean(window.A1Preview),experience=window.A1Preview||(window.A1PublicBeta?.mode==='server-free-beta-local'?window.A1PublicBeta:null);
 const result=document.querySelector('#ai-result'),I=window.A1I18n,T=window.A1LabTemplates,M=window.A1ProductMatching;
 if(!experience||!result?.querySelector('.ai-result-copy')||!I||!T||!M||window.A1LabNavigation)return;
 document.removeEventListener('a1:public-beta-ready',initialize);
 I.register({
 '연구실 실행 코드를 받지 못했습니다. 새로고침해주세요. [A1-LAB-SCRIPT]':'The lab code did not load. Reload this page. [A1-LAB-SCRIPT]',
 '내 체형에 맞는 의류 추천 보기':'View clothing recommendation examples',
 '공식 상품 후보 보기':'View official product candidates',
 '추천 의류 비교하기':'Compare recommended garments',
 '내 사진으로 가상 피팅하기 · 2D 시험':'Try my photo · local 2D experiment',
 '내 사진 2D 미리보기':'Preview my photo in 2D',
 '3D 아바타 · 무료 시각적 미리보기':'3D avatar · free visual preview',
 '무료 연구실 · 실제 상품 준비 중. 가상 시험 의류·로컬 2D·단순 3D 미리보기이며 실제 AI 착용 합성은 없습니다.':'Free lab · real products pending. Fictional garments, local 2D and simplified 3D previews; no real AI try-on.',
 '무료 베타 · 공식 상품 후보와 기기 내 사진 2D 미리보기입니다. 실제 AI 착용 합성·3D 상품 피팅은 제공하지 않습니다.':'Free beta · official product candidates and on-device photo overlays. Natural AI try-on and 3D retail-garment fitting are not provided.',
 '가격 비교 · 검증 자료 준비 중':'Price comparison · verified data being prepared',
 '3D 피팅 · 준비 중':'3D fitting · being prepared',
 '연구실을 열지 못했습니다. 인터넷 연결을 확인하고 다시 눌러주세요.':'The lab could not be opened. Check your connection and try again.',
 '연구실 열기: 기존 사진과 조건은 이 화면 메모리에만 유지합니다. 비율 사용과 2D 이미지 사용은 각각 별도 동의가 필요합니다.':'Opening the lab: the existing photo and preferences stay in this page memory. Ratio use and 2D image use each require separate consent.'
 });
 const nav=document.createElement('section');nav.id='lab-entry';nav.className='lab-entry';nav.hidden=true;
 const note=document.createElement('p');I.setText(note,preview?'무료 연구실 · 실제 상품 준비 중. 가상 시험 의류·로컬 2D·단순 3D 미리보기이며 실제 AI 착용 합성은 없습니다.':'무료 베타 · 공식 상품 후보와 기기 내 사진 2D 미리보기입니다. 실제 AI 착용 합성·3D 상품 피팅은 제공하지 않습니다.');nav.append(note);
 const status=document.createElement('p');status.id='lab-entry-status';status.setAttribute('role','status');
 let metrics=null,pending=null,revision=0;
 async function open(target){
  if(!['#lab-preferences','#lab-comparison','#lab-fitting','#lab-local-photo-fitting'].includes(target)||!preview&&!['#lab-preferences','#lab-local-photo-fitting'].includes(target))return;
  const needsAnalysis=target!=='#lab-local-photo-fitting';
  const token=revision;
  if(!T){I.setText(status,'연구실 실행 코드를 받지 못했습니다. 새로고침해주세요. [A1-LAB-SCRIPT]');return;}
  T.hideFailure(status);I.setText(status,'연구실 열기: 기존 사진과 조건은 이 화면 메모리에만 유지합니다. 비율 사용과 2D 이미지 사용은 각각 별도 동의가 필요합니다.');
  try{
   if(!document.querySelector('#lab-root')){
    if(!pending)pending=T.load('product').finally(()=>{pending=null;});
    const template=await pending;if(token!==revision||needsAnalysis&&(!metrics||result.hidden))return;
    if(!document.querySelector('#lab-root')){template.querySelector('#ai-studio')?.remove();document.querySelector('#ai-studio').after(document.importNode(template,true));}
   }
   T.initialize('product',document.querySelector('#lab-root'));
   if(token!==revision||needsAnalysis&&(!metrics||result.hidden))return;
   if(metrics&&!result.hidden)document.dispatchEvent(new CustomEvent('a1:lab-enter',{detail:{metrics:{...metrics}}}));
   document.dispatchEvent(new CustomEvent('a1:lab-navigate',{detail:{target}}));T.hideFailure(status);
  }catch(error){if(token===revision)T.failure('product',status,error,()=>open(target));}
 }
 window.A1LabNavigation=Object.freeze({open});
 for(const [id,label,target]of [['recommend','내 체형에 맞는 의류 추천 보기','#lab-preferences'],['compare','추천 의류 비교하기','#lab-comparison'],['fitting','내 사진으로 가상 피팅하기 · 2D 시험','#lab-local-photo-fitting']]){
  const b=document.createElement('button');b.id='lab-open-'+id;b.type='button';b.className='dark-button';I.setText(b,preview?label:{recommend:'공식 상품 후보 보기',compare:'가격 비교 · 검증 자료 준비 중',fitting:'내 사진 2D 미리보기'}[id]);if(!preview&&id==='compare')b.disabled=true;b.addEventListener('click',()=>open(target));nav.append(b);
 }
 const avatar=document.createElement('button');avatar.type='button';avatar.id='lab-open-avatar';I.setText(avatar,preview?'3D 아바타 · 무료 시각적 미리보기':'3D 피팅 · 준비 중');if(!preview)avatar.disabled=true;nav.append(avatar,status);result.querySelector('.ai-result-copy').append(nav);
 document.addEventListener('a1:analysis-ready',e=>{revision++;if(!M.validMetrics(e.detail?.metrics))return;metrics={...e.detail.metrics};nav.hidden=false;});
 document.addEventListener('a1:analysis-cleared',()=>{revision++;metrics=null;nav.hidden=true;if(T)T.hideFailure(status);});
 window.addEventListener('pagehide',()=>{revision++;metrics=null;nav.hidden=true;});
 }
 if(document.readyState!=='complete')document.addEventListener('DOMContentLoaded',initialize,{once:true});
 document.addEventListener('a1:public-beta-ready',initialize);initialize();
})();
