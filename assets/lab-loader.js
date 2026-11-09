/* Fixed same-origin Pages canonical templates; redirects remain forbidden. */
'use strict';
(()=>{
 if(!window.A1Preview)return;
 const I=window.A1I18n,config={avatar:{path:'/avatar-lab',root:'#avatar-root',init:'initializeAvatarLab'},product:{path:'/product-lab',root:'#lab-root',init:'initializeProductLab'}};
 const messages={
 REQUEST:'화면 요청이 차단되었거나 연결되지 않았습니다. 다시 시도하거나 독립 연구실을 Safari에서 여세요.',
 TIMEOUT:'화면 요청 시간이 초과됐습니다. 연결을 확인하고 다시 시도해주세요.',
 HTTP:'연구실 응답이 정상 상태가 아닙니다. 잠시 후 다시 시도해주세요.',
 MIME:'연구실 대신 다른 형식의 응답을 받았습니다. 새로고침하거나 독립 주소를 여세요.',
 TEMPLATE:'연구실 화면 구성이 맞지 않습니다. 페이지를 새로고침해주세요.',
 SCRIPT:'연구실 실행 코드가 준비되지 않았습니다. 새로고침 후 다시 시도해주세요.',
 INIT:'화면은 받았지만 연구실 초기화에 실패했습니다. 새로고침하거나 독립 연구실을 여세요.',
 WEBGL:'3D 그래픽을 시작하지 못했습니다. Safari에서 열고 다른 탭을 닫은 뒤 다시 시도해주세요.'
 };
 I.register({
 [messages.REQUEST]:'The page request was blocked or could not connect. Retry, or open the standalone lab in Safari.',
 [messages.TIMEOUT]:'The page request timed out. Check your connection and retry.',
 [messages.HTTP]:'The lab returned an unsuccessful response. Try again shortly.',
 [messages.MIME]:'A different response format was returned. Reload or use the standalone lab.',
 [messages.TEMPLATE]:'The lab template is incompatible. Reload this page.',
 [messages.SCRIPT]:'The lab code is not ready. Reload and retry.',
 [messages.INIT]:'The page loaded but lab initialization failed. Reload or open the standalone lab.',
 [messages.WEBGL]:'3D graphics could not start. Open in Safari, close other tabs and retry.',
 '새로고침 · 사진은 다시 선택':'Reload · reselect photo',
 '다시 시도':'Retry','독립 연구실 열기':'Open standalone lab',
 '독립 화면에는 사진·분석값을 전달하지 않습니다. 앱 안에서 제한되면 이 링크 주소를 복사해 Safari 주소창에 붙여넣으세요.':'Photos and analysis are not transferred to the standalone page. If the in-app browser restricts access, copy this link into Safari.'
 });
 const error=(code,status)=>Object.assign(new Error('A1-LAB-'+code),{code,status});
 async function load(kind){const item=config[kind];if(!item)throw error('TEMPLATE');const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);try{
  const r=await fetch(item.path,{credentials:'omit',cache:'no-store',redirect:'error',signal:controller.signal});
  if(!r.ok)throw error('HTTP',r.status);if(!/^text\/html(?:;|$)/i.test(r.headers.get('content-type')||''))throw error('MIME');
  const u=new URL(r.url||item.path,location.origin);if(u.origin!==location.origin||u.pathname!==item.path||u.search)throw error('REQUEST');
  const doc=new DOMParser().parseFromString(await r.text(),'text/html'),root=doc.querySelector(item.root);if(!root)throw error('TEMPLATE');return root;
 }catch(e){if(Object.hasOwn(messages,e.code))throw e;throw error(controller.signal.aborted?'TIMEOUT':'REQUEST');}finally{clearTimeout(timer);}}
 function initialize(kind,root){const item=config[kind];if(typeof window[item.init]!=='function')throw error('SCRIPT');
  try{if(root.dataset.loadState!=='ready')window[item.init]();}catch{root.dataset.loadState='init-error';throw error('INIT');}
  if(root.dataset.loadState==='webgl-error')throw error('WEBGL');if(root.dataset.loadState!=='ready')throw error('INIT');
 }
 function hideFailure(status){document.getElementById(status.id+'-actions')?.remove();I.setText(status,'');delete status.dataset.errorCode;}
 function failure(kind,status,e,retry){hideFailure(status);const code=Object.hasOwn(messages,e?.code)?e.code:'INIT';I.setText(status,messages[code]);status.dataset.errorCode='A1-LAB-'+code;
  const box=document.createElement('span');box.id=status.id+'-actions';box.className='lab-recovery';
  const diagnostic=document.createElement('small');diagnostic.textContent='A1-LAB-'+code+(Number.isInteger(e?.status)?' / HTTP '+e.status:'');
  const button=document.createElement('button');button.type='button';const reload=['INIT','SCRIPT','WEBGL'].includes(code);I.setText(button,reload?'새로고침 · 사진은 다시 선택':'다시 시도');button.addEventListener('click',reload?()=>location.reload():retry);
  const link=document.createElement('a');link.href=config[kind].path;link.referrerPolicy='no-referrer';I.setText(link,'독립 연구실 열기');
  const note=document.createElement('span');I.setText(note,'독립 화면에는 사진·분석값을 전달하지 않습니다. 앱 안에서 제한되면 이 링크 주소를 복사해 Safari 주소창에 붙여넣으세요.');box.append(diagnostic,button,link,note);status.after(box);
 }
 window.A1LabTemplates=Object.freeze({load,initialize,failure,hideFailure});
})();
