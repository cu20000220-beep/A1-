'use strict';
(()=>{
 const root=document.querySelector('#shopping-search');if(!root||!window.A1Preview)return;
 const I=window.A1I18n,Q=window.A1ShoppingQuery,P=window.A1Preview,$=s=>document.querySelector(s);
 I.register({
 '검색·개인정보 안내':'Search & privacy details',
 '앱 안에서 쇼핑몰이 열리지 않나요?':'Retailer blocked in the in-app browser?',
 '어떤 옷을 찾으세요?':'What would you like to wear?',
 '무료 베타 · 의류 검색부터 시작하세요':'Free beta · start with clothing search',
 '예: 남성 검정 슬랙스 5만원 이하':'e.g. men black slacks',
 '원하는 옷 조건':'Clothing search conditions','옷 찾기':'Find clothes',
 '현재 검증된 실제 상품 0개 · 아래는 상품 목록이 아닌 공식 쇼핑몰 검색 대안입니다.':'0 verified real products currently · the options below are official retailer searches, not product listings.',
 '의류 종류·색상·컬렉션만 검색어로 전달합니다. 예산은 아래에 따로 표시하며 판매처에서 직접 설정하세요. 원문·사진·체형 수치는 전송하지 않습니다.':'Only clothing type, color and collection enter the search phrase. Set the budget at the retailer. Raw text, photos and body ratios are not transmitted.',
 '선택한 검색어':'Selected search phrase','예산':'Budget','예산 미지정':'No budget specified',
 '상품 가격·사이즈·재고·배송비는 판매처에서 확인해야 합니다.':'Check prices, sizes, stock and shipping at the retailer.',
 '사진상 비율을 이번 기기 내 스타일 조언에 사용하는 데 동의합니다.':'I agree to use photo ratios for this on-device style advice.',
 '조건으로 스타일 조언 받기':'Get style advice for these conditions',
 '규칙 기반 무료 스타일 상담 · 생성형 AI/GPT 호출 없음':'Free rule-based style advice · no generative AI/GPT calls',
 '사진 없이 검색할 수 있습니다. 체형 참고 분석은 선택사항입니다.':'Search without a photo. Body-reference analysis is optional.',
 '상품 추천이 아닌 검색 준비와 스타일 조언입니다. 실제 상품 자료가 확보되면 개별 추천 이유·비교를 연결합니다.':'Search preparation and style advice, not product recommendations. Item-specific reasons and comparisons require verified product data.',
 '짧은 의류 조건만 입력해주세요. 연락처·이메일·사진·링크는 입력하지 마세요.':'Enter short clothing conditions only. Do not include contacts, email, photos or links.',
 '체형을 참고하려면 먼저 사진을 분석해주세요.':'Analyze a photo first to use body references.',
 '출근':'Work','편안한 일상':'Comfortable everyday style',
 '분석 결과에서 검색 조건으로 돌아가기':'Return to clothing search from analysis',
 '검색어를 준비했습니다. 아래 공식 검색 버튼을 직접 눌러주세요.':'Search phrase ready. Click an official search below.',
 '선택한 예산이 판매처 검색에 자동 적용되지는 않습니다.':'Your budget is not automatically applied at the retailer.'
 });
 root.hidden=false;let conditions=null,metrics=null;
 const node=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;},tx=(s,t)=>I.setText($(s),t);
 const render=()=>{const target=$('#shopping-search-results');target.replaceChildren();if(!conditions)return;
  const phrase=node('p',I.t('선택한 검색어')+': '+Q.term(conditions,I.language));target.append(phrase);
  const budget=node('p',I.t('예산')+': '+(conditions.budget===null?I.t('예산 미지정'):conditions.budget.toLocaleString(I.locale)+' KRW'));target.append(budget);
  const warning=node('p');I.setText(warning,'선택한 예산이 판매처 검색에 자동 적용되지는 않습니다.');target.append(warning);
  for(const row of Q.links(conditions)){const actions=P.retailerActions(row);actions.querySelectorAll('.preview-safari-help').forEach(n=>n.remove());target.append(actions);}
 };
 function search(){$('#shopping-style-advice').replaceChildren();try{conditions=Q.parse($('#shopping-query').value);render();tx('#shopping-query-status','검색어를 준비했습니다. 아래 공식 검색 버튼을 직접 눌러주세요.');return true;}catch{conditions=null;render();tx('#shopping-query-status','짧은 의류 조건만 입력해주세요. 연락처·이메일·사진·링크는 입력하지 마세요.');return false;}}
 function advice(){if(!search())return;const consent=$('#shopping-analysis-consent').checked;if(consent&&!metrics){tx('#shopping-query-status','체형을 참고하려면 먼저 사진을 분석해주세요.');return;}
  const message=conditions.occasion==='work'?'office outfit':conditions.color!=='any'?'color outfit':'comfortable outfit';
  const answer=P.consult({message,language:I.language,intent:'style',preferences:{destination:'KR',category:conditions.category},consents:{analysis:consent},...(consent?{metrics}:{})});
  const target=$('#shopping-style-advice');target.replaceChildren();const title=node('p');I.setText(title,'규칙 기반 무료 스타일 상담 · 생성형 AI/GPT 호출 없음');target.append(title);for(const a of answer.advice)target.append(node('p',a.text));
  const note=node('p');I.setText(note,'상품 추천이 아닌 검색 준비와 스타일 조언입니다. 실제 상품 자료가 확보되면 개별 추천 이유·비교를 연결합니다.');target.append(note);
 }
 root.addEventListener('click',e=>{const a=e.target.closest('#shopping-search-results a');if(a&&(!e.isTrusted||!P.safeLink(a.href))){e.preventDefault();tx('#shopping-query-status','짧은 의류 조건만 입력해주세요. 연락처·이메일·사진·링크는 입력하지 마세요.');}});
 $('#shopping-search-form').addEventListener('submit',e=>{e.preventDefault();search();});$('#shopping-style-button').addEventListener('click',advice);
 document.addEventListener('a1:analysis-ready',e=>{if(P.validMetrics(e.detail?.metrics)){metrics={...e.detail.metrics};$('#shopping-analysis-consent').disabled=false;$('#shopping-analysis-consent').checked=false;const result=document.querySelector('#ai-result .ai-result-copy');if(!$('#shopping-return')){const link=node('a');link.id='shopping-return';link.href='#shopping-search';I.setText(link,'분석 결과에서 검색 조건으로 돌아가기');result.append(link);}}});
 const clear=()=>{metrics=null;$('#shopping-analysis-consent').checked=false;$('#shopping-analysis-consent').disabled=true;$('#shopping-style-advice').replaceChildren();};
 document.addEventListener('a1:analysis-cleared',clear);$('#shopping-analysis-consent').addEventListener('change',()=>{$('#shopping-style-advice').replaceChildren();});
 document.addEventListener('a1:language-changed',()=>{render();if($('#shopping-style-advice').children.length)advice();});
 window.addEventListener('pagehide',()=>{clear();conditions=null;$('#shopping-query').value='';$('#shopping-search-results').replaceChildren();});
})();
