'use strict';
(() => {
  const $=s=>document.querySelector(s);
  let metrics=null,allowed=false,busy=false,revision=0;
  function status(text){$('#premium-status').textContent=text;$('#premium-result-status').textContent=text;}
  function lock(text){allowed=false;$('#premium-controls').hidden=true;$('#premium-lock').hidden=false;$('#premium-badge').textContent='구독자 전용';window.A1UI.clearPremium();$('#premium-login').hidden=true;if(text)status(text);}
  function buttons(){ $('#premium-check').disabled=busy;$('#premium-recommend').disabled=busy||!allowed||!metrics; }
  function reset(){revision++;metrics=null;busy=false;lock('무료 분석 결과는 구독 없이 볼 수 있습니다. 의류 추천과 판매처 연결은 유효한 구독 확인 후 제공합니다.');buttons();}
  async function api(path,options={}){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    try{
      const response=await fetch(path,{...options,credentials:'same-origin',cache:'no-store',signal:controller.signal,headers:{Accept:'application/json',...options.headers}});
      let data;try{data=await response.json()}catch{data={error:'invalid_response'}}
      return {response,data};
    }finally{clearTimeout(timer)}
  }
  function rejected(response,data){
    const message=response.status===401?'추천을 이용하려면 먼저 로그인하고 유효한 구독을 확인해주세요.':response.status===403?'유효한 구독 이용권을 확인하지 못했습니다. 무료 사진 분석은 계속 이용할 수 있습니다.':'회원·구독 연결을 준비 중입니다. 지금은 무료 사진 분석 결과까지 이용할 수 있습니다.';
    lock(message);
    if(response.status===401&&typeof data.loginUrl==='string'){
      try{const u=new URL(data.loginUrl);if(u.protocol==='https:'&&!u.username&&!u.password){$('#premium-login').href=u.href;$('#premium-login').hidden=false}}catch{}
    }
  }
  $('#premium-check').addEventListener('click',async()=>{
    if(busy)return;const token=revision;busy=true;buttons();status('서버에서 로그인·구독 상태를 확인하고 있습니다.');
    try{
      const {response,data}=await api('api/membership');if(token!==revision)return;
      if(!response.ok||data.allowed!==true){rejected(response,data);return;}
      allowed=true;$('#premium-lock').hidden=true;$('#premium-controls').hidden=false;$('#premium-badge').textContent='구독 확인됨';$('#premium-member-status').textContent=metrics?'구독을 확인했습니다. 원하는 조건을 고르고 추천을 요청하세요.':'구독을 확인했습니다. 먼저 무료 사진 분석을 완료해주세요.';status('구독을 확인했습니다.');
    }catch{if(token===revision)lock('구독 상태를 확인하지 못했습니다. 다시 시도해주세요. 무료 사진 분석은 계속 이용할 수 있습니다.');}
    finally{if(token===revision){busy=false;buttons()}}
  });
  $('#premium-form').addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!allowed||!metrics)return;const token=revision;busy=true;buttons();window.A1UI.clearPremium();status('구독 이용권을 다시 확인하고 스타일을 제안하고 있습니다.');
    try{
      const body={metrics:{shoulderHipRatio:metrics.shoulderHipRatio,legTorsoRatio:metrics.legTorsoRatio},preferences:{gender:$('#ai-gender').value,style:$('#ai-style').value,budget:Number($('#ai-budget').value)}};
      const {response,data}=await api('api/recommendations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(token!==revision)return;
      if(!response.ok){rejected(response,data);return;}
      window.A1UI.renderPremium(data);status('서버에서 구독을 확인한 스타일 제안입니다. 현재 자료는 참고용 예시입니다.');
    }catch{if(token===revision){window.A1UI.clearPremium();status('추천을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');}}
    finally{if(token===revision){busy=false;buttons()}}
  });
  document.addEventListener('a1:analysis-cleared',reset);
  document.addEventListener('a1:analysis-ready',event=>{
    revision++;busy=false;metrics={shoulderHipRatio:event.detail.metrics.shoulderHipRatio,legTorsoRatio:event.detail.metrics.legTorsoRatio};
    lock('무료 분석을 완료했습니다. 분석 결과는 구독 없이 볼 수 있습니다. 의류 추천과 판매처 연결은 로그인·구독 확인 후 열립니다.');buttons();
  });
  window.addEventListener('pagehide',reset);
  lock();buttons();
})();
