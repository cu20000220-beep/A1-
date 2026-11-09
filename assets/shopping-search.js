'use strict';
(()=>{
 const root=document.querySelector('#shopping-search');if(!root||!window.A1Preview)return;
 const I=window.A1I18n,Q=window.A1ShoppingQuery,P=window.A1Preview,C=window.A1ProductCatalog,$=s=>document.querySelector(s);
 I.register({
 '판매자 상품 파일 양식':'Seller product file templates','빈 양식입니다. 판매자 허가와 운영자 검토 후 공개하며 브라우저 업로드로 권한을 부여하지 않습니다.':'Empty templates. Publication requires seller permission and operator review; browser upload does not grant permission.','CSV 양식 받기':'Download CSV template','JSON 양식 받기':'Download JSON template',
 '등록 상품 필터·사이즈표 비교':'Product filters & size-chart comparison',
 '등록 상품 필터 · 직접 입력 치수는 기기 안에서만 사용합니다.':'Product filters · entered measurements stay on this device.',
 '통화':'Currency','원하는 사이즈':'Preferred size','내 가슴둘레 cm · 선택':'My chest cm · optional','내 허리둘레 cm · 선택':'My waist cm · optional','내 골반둘레 cm · 선택':'My hips cm · optional','내 안쪽 다리 길이 cm · 선택':'My inseam cm · optional',
 '등록 상품 자료를 확인하고 있습니다.':'Checking registered product data.',
 '상품 자료 다시 확인':'Retry product data',
 '상품 자료를 확인하지 못했습니다. 다시 확인하거나 공식 검색을 이용해주세요.':'Product data could not be verified. Retry or use official searches.',
 '등록 상품 {total}개 · 조건에 맞는 상품 {count}개':'{total} registered products · {count} match these conditions',
 '조건에 맞는 상품이 없습니다. 통화·예산·카테고리·색상·사이즈를 확인하거나 공식 검색을 이용하세요.':'No matching products. Check currency, budget, category, color and size, or use official searches.',
 '추천 이유':'Recommendation reasons','주의·확인 사항':'Warnings & checks','사이즈표 미제공':'Size chart not supplied',
 '상품 금액만 비교하며 배송·세금은 별도 확인이 필요합니다. 착용감·사이즈를 보장하지 않습니다.':'Item prices only; check shipping and taxes separately. Fit and size are not guaranteed.',
 '판매자 사이즈표 · 의류 실측':'Seller size chart · garment measurements','판매자 사이즈표 · 신체 기준':'Seller size chart · body reference',
 '직접 입력 {user} cm / 판매자 표 {seller} cm / 차이 {difference} cm':'Your input {user} cm / seller chart {seller} cm / difference {difference} cm',
 '치수 차이는 참고값이며 여유분·소재·측정 방식이 달라 실제 사이즈를 판정하지 않습니다.':'Differences are references; ease, fabric and measurement methods prevent an exact size determination.',
 '상품 페이지 열기':'Open product page','비교에 추가':'Add to comparison','비교에서 제외':'Remove from comparison',
 '상품':'Product','상품 가격':'Item price','사이즈':'Size',
 '판매자':'Seller','브랜드':'Brand','마지막 확인':'Last checked','자료 출처':'Source','이용 허락':'Permission','공개 표시 허가 확인':'Display permission reviewed',
 '조건 일치 점수':'Condition-match score','사진상 비율 참고 규칙':'Photo-ratio reference rule','스타일 일치':'Style matches','색상 일치':'Color matches','용도 일치':'Occasion matches','사이즈 표기 일치':'Listed size matches','컬렉션 일치':'Collection matches','예산 범위':'Within budget',
 '등록 상품 2개 이상에서 비교에 추가를 눌러주세요.':'Choose Add to comparison on at least two registered products.',
 '규칙 상담이 아래 등록 상품의 검색·추천·비교 결과에 연결됐습니다. 생성형 AI는 호출하지 않습니다.':'Rule-based advice is linked to the registered product search, ranking and comparison below. No generative AI is called.',
 '상품 이미지가 열리지 않습니다. 판매처 상품 페이지에서 확인해주세요.':'The product image did not load. Check the seller product page.',
 '원화 예산은 KRW에서 검색해주세요. 통화를 바꿀 때 임의 환산하지 않습니다.':'Search KRW budgets in KRW. No currency conversion is invented.',
 '사이즈와 직접 입력 치수를 확인해주세요.':'Check the size and entered measurements.',
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
 root.hidden=false;let conditions=null,metrics=null,catalog={version:1,generatedAt:null,products:[]},catalogState='loading',matches=[],comparison=new Set(),expiryTimer,disposed=false,controller;
 let invalidQuery=false;
 const node=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;},tx=(s,t)=>I.setText($(s),t);

 const labels={within_budget:'예산 범위',style_match:'스타일 일치',color_match:'색상 일치',occasion_match:'용도 일치',listed_size_match:'사이즈 표기 일치',collection_match:'컬렉션 일치',photo_ratio_reference:'사진상 비율 참고 규칙'};
 const measurements=()=>Object.fromEntries(['chest','waist','hips','inseam'].map(k=>[k,$('#shopping-measure-'+k).value]));
 const money=p=>p.price.toLocaleString(I.locale)+' '+p.currency;
 function chart(target,p){
  const size=$('#shopping-size').value,values=measurements(),report=C.chartComparison(p,values,size);
  if(report.status==='unknown'){target.append(node('p',I.t('사이즈표 미제공')));return;}
  const details=node('details'),summary=node('summary',I.t(report.status==='garment'?'판매자 사이즈표 · 의류 실측':'판매자 사이즈표 · 신체 기준'));details.append(summary);details.open=Object.values(values).some(v=>v!=='');
  for(const row of p.sizeChart.rows){const line=node('p',row.size+' · '+Object.entries(row).filter(([k])=>k!=='size').map(([k,v])=>k+': '+v+' cm').join(' / '));details.append(line);}
  for(const row of report.rows)for(const diff of row.comparisons){const line=node('p',row.size+' · '+diff.field+' · '+I.t('직접 입력 {user} cm / 판매자 표 {seller} cm / 차이 {difference} cm',diff));line.dataset.catalogMeasure='';details.append(line);}
  details.append(node('p',I.t('치수 차이는 참고값이며 여유분·소재·측정 방식이 달라 실제 사이즈를 판정하지 않습니다.')));target.append(details);
 }
 function renderComparison(){const target=$('#shopping-comparison');target.replaceChildren();const rows=matches.filter(r=>comparison.has(r.product.id));if(!rows.length)return;
  const table=node('table'),head=node('tr');for(const label of ['상품','판매자','상품 가격','사이즈','마지막 확인','조건 일치 점수'])head.append(node('th',I.t(label)));table.append(head);
  for(const row of rows){const p=row.product,tr=node('tr');for(const v of [p.name+' / '+p.brand,p.retailerName,money(p),p.sizes.join(', ')||I.t('사이즈표 미제공'),new Date(p.checkedAt).toLocaleString(I.locale),String(row.score)])tr.append(node('td',v));table.append(tr);}target.append(table);for(const row of rows){const item=node('div');item.append(node('h4',row.product.name));chart(item,row.product);target.append(item);}target.append(node('p',I.t('상품 금액만 비교하며 배송·세금은 별도 확인이 필요합니다. 착용감·사이즈를 보장하지 않습니다.')));
 }
 function renderCatalog(){
  const target=$('#shopping-products');target.replaceChildren();$('#shopping-catalog-retry').hidden=catalogState!=='error';
  if(catalogState!=='ready'){tx('#shopping-catalog-status',catalogState==='error'?'상품 자료를 확인하지 못했습니다. 다시 확인하거나 공식 검색을 이용해주세요.':'등록 상품 자료를 확인하고 있습니다.');return;}
  const now=Date.now(),registered=C.validateSnapshot(catalog,now);if(!registered.length){matches=[];comparison.clear();tx('#shopping-catalog-status','현재 검증된 실제 상품 0개 · 아래는 상품 목록이 아닌 공식 쇼핑몰 검색 대안입니다.');renderComparison();return;}
  try{const c=conditions||{...Q.parse('의류'),currency:$('#shopping-currency').value};matches=invalidQuery?[]:C.search(catalog,c,{size:$('#shopping-size').value,query:conditions?$('#shopping-query').value:'',bodyConsent:$('#shopping-analysis-consent').checked,metrics,now}).matches;
   for(const v of Object.values(measurements()))if(v!==''&&(!Number.isFinite(Number(v))||Number(v)<=0||Number(v)>300))throw Error('measurements');
  }catch{matches=[];tx('#shopping-query-status','사이즈와 직접 입력 치수를 확인해주세요.');}
  I.setText($('#shopping-catalog-status'),'등록 상품 {total}개 · 조건에 맞는 상품 {count}개',{total:registered.length,count:matches.length});
  comparison=new Set([...comparison].filter(id=>matches.some(r=>r.product.id===id)));
  if(!matches.length)target.append(node('p',I.t('조건에 맞는 상품이 없습니다. 통화·예산·카테고리·색상·사이즈를 확인하거나 공식 검색을 이용하세요.')));
  for(const row of matches){const p=row.product,card=node('article');card.dataset.catalogId=p.id;card.className='catalog-card';
   const image=node('img');image.src=p.imageUrl;image.alt=p.name;image.referrerPolicy='no-referrer';image.loading='lazy';image.addEventListener('error',()=>{if(!card.querySelector('[data-image-error]')){const text=node('p',I.t('상품 이미지가 열리지 않습니다. 판매처 상품 페이지에서 확인해주세요.'));text.dataset.imageError='';card.append(text);}});
   card.append(image,node('h3',p.name),node('p',p.brand+' · '+p.retailerName),node('p',money(p)),node('p',I.t('조건 일치 점수')+': '+row.score+'/100'));
   const reasons=node('ul');for(const code of row.reasons){if(code==='within_budget'&&conditions?.budget==null)continue;reasons.append(node('li',I.t(labels[code])));}card.append(node('h4',I.t('추천 이유')),reasons,node('p',I.t('상품 금액만 비교하며 배송·세금은 별도 확인이 필요합니다. 착용감·사이즈를 보장하지 않습니다.')));
   chart(card,p);card.append(node('p',I.t('마지막 확인')+': '+new Date(p.checkedAt).toLocaleString(I.locale)),node('p',I.t('이용 허락')+': '+I.t('공개 표시 허가 확인')));
   for(const [key,url,label]of [['buy',p.productUrl,I.t('상품 페이지 열기')],['source',p.sourceUrl,I.t('자료 출처')]]){const a=node('a',label);a.href=url;a.rel='noopener noreferrer';a.referrerPolicy='no-referrer';if(key==='buy')a.dataset.catalogBuy=p.id;else a.dataset.catalogSource=p.id;card.append(a);}
   const compare=node('button',I.t(comparison.has(p.id)?'비교에서 제외':'비교에 추가'));compare.type='button';compare.dataset.catalogCompare=p.id;compare.setAttribute('aria-pressed',String(comparison.has(p.id)));compare.addEventListener('click',()=>{if(comparison.has(p.id))comparison.delete(p.id);else if(comparison.size<4)comparison.add(p.id);renderCatalog();});card.append(compare);target.append(card);
  }renderComparison();
 }
 function scheduleExpiry(){clearTimeout(expiryTimer);const now=Date.now(),next=Math.min(...catalog.products.filter(p=>p.expiresAt>now).map(p=>p.expiresAt));if(Number.isFinite(next))expiryTimer=setTimeout(()=>{if(!disposed){$('#shopping-style-advice').replaceChildren();renderCatalog();scheduleExpiry();}},Math.max(1,Math.min(2147483647,next-now+1)));}
 async function loadCatalog(){catalogState='loading';renderCatalog();controller?.abort();controller=new AbortController();const active=controller,timer=setTimeout(()=>active.abort(),10000);
  try{const r=await fetch('/assets/approved-products.json',{credentials:'omit',cache:'no-store',redirect:'error',signal:active.signal});if(!r.ok||!/application\/json/i.test(r.headers.get('content-type')||''))throw Error('catalog_response');const text=await r.text();if(text.length>1000000)throw Error('catalog_size');const data=JSON.parse(text);C.validateSnapshot(data);if(disposed||controller!==active)return;catalog=data;catalogState='ready';
   scheduleExpiry();
  }catch{if(disposed||controller!==active)return;catalog={version:1,generatedAt:null,products:[]};catalogState='error';matches=[];comparison.clear();}finally{clearTimeout(timer);if(!disposed&&controller===active)renderCatalog();}
 }
 $('#shopping-catalog-retry').addEventListener('click',loadCatalog);
 $('#shopping-product-filters').addEventListener('input',()=>{if(conditions){try{const parsed=Q.parse($('#shopping-query').value);if(parsed.budget!==null&&$('#shopping-currency').value!=='KRW')throw Error('currency');conditions={...parsed,currency:$('#shopping-currency').value};}catch{tx('#shopping-query-status','원화 예산은 KRW에서 검색해주세요. 통화를 바꿀 때 임의 환산하지 않습니다.');matches=[];comparison.clear();$('#shopping-products').replaceChildren();renderComparison();return;}}renderCatalog();});

 const render=()=>{const target=$('#shopping-search-results');target.replaceChildren();if(!conditions)return;
  const phrase=node('p',I.t('선택한 검색어')+': '+Q.term(conditions,I.language));target.append(phrase);
  const budget=node('p',I.t('예산')+': '+(conditions.budget===null?I.t('예산 미지정'):conditions.budget.toLocaleString(I.locale)+' KRW'));target.append(budget);
  const warning=node('p');I.setText(warning,'선택한 예산이 판매처 검색에 자동 적용되지는 않습니다.');target.append(warning);
  for(const row of Q.links(conditions)){const actions=P.retailerActions(row);actions.querySelectorAll('.preview-safari-help').forEach(n=>n.remove());target.append(actions);}
 };
 function search(){$('#shopping-style-advice').replaceChildren();try{conditions=Q.parse($('#shopping-query').value);if(conditions.budget!==null&&$('#shopping-currency').value!=='KRW')throw Error('currency');conditions={...conditions,currency:$('#shopping-currency').value};invalidQuery=false;render();renderCatalog();tx('#shopping-query-status','검색어를 준비했습니다. 아래 공식 검색 버튼을 직접 눌러주세요.');return true;}catch{conditions=null;invalidQuery=true;render();renderCatalog();tx('#shopping-query-status','짧은 의류 조건만 입력해주세요. 연락처·이메일·사진·링크는 입력하지 마세요.');return false;}}
 function advice(){if(!search())return;const consent=$('#shopping-analysis-consent').checked;if(consent&&!metrics){tx('#shopping-query-status','체형을 참고하려면 먼저 사진을 분석해주세요.');return;}
  const message=conditions.occasion==='work'?'office outfit':conditions.color!=='any'?'color outfit':'comfortable outfit';
  const answer=P.consult({message,language:I.language,intent:'style',preferences:{destination:'KR',category:conditions.category},consents:{analysis:consent},...(consent?{metrics}:{})});
  const target=$('#shopping-style-advice');target.replaceChildren();const title=node('p');I.setText(title,'규칙 기반 무료 스타일 상담 · 생성형 AI/GPT 호출 없음');target.append(title);for(const a of answer.advice)target.append(node('p',a.text));
  const note=node('p');I.setText(note,matches.length?'규칙 상담이 아래 등록 상품의 검색·추천·비교 결과에 연결됐습니다. 생성형 AI는 호출하지 않습니다.':'상품 추천이 아닌 검색 준비와 스타일 조언입니다. 실제 상품 자료가 확보되면 개별 추천 이유·비교를 연결합니다.');if(matches.length){const links=node('ul');for(const row of matches.slice(0,3)){const item=node('li'),a=node('a',row.product.name);a.href='#shopping-products';a.dataset.catalogAdvice=row.product.id;item.append(a);links.append(item);}target.append(links);}target.append(note);
 }
 root.addEventListener('click',e=>{const productLink=e.target.closest('[data-catalog-buy],[data-catalog-source]');if(productLink){const id=productLink.dataset.catalogBuy||productLink.dataset.catalogSource,p=catalog.products.find(p=>p.id===id),expected=productLink.dataset.catalogBuy?p?.productUrl:p?.sourceUrl;if(!e.isTrusted||!p||p.expiresAt<=Date.now()||productLink.href!==expected||!C.safeUrl(expected)){e.preventDefault();renderCatalog();}return;}const a=e.target.closest('#shopping-search-results a');if(a&&(!e.isTrusted||!P.safeLink(a.href))){e.preventDefault();tx('#shopping-query-status','짧은 의류 조건만 입력해주세요. 연락처·이메일·사진·링크는 입력하지 마세요.');}});
 $('#shopping-search-form').addEventListener('submit',e=>{e.preventDefault();search();});$('#shopping-style-button').addEventListener('click',advice);
 document.addEventListener('a1:analysis-ready',e=>{if(P.validMetrics(e.detail?.metrics)){metrics={...e.detail.metrics};$('#shopping-analysis-consent').disabled=false;$('#shopping-analysis-consent').checked=false;const result=document.querySelector('#ai-result .ai-result-copy');if(!$('#shopping-return')){const link=node('a');link.id='shopping-return';link.href='#shopping-search';I.setText(link,'분석 결과에서 검색 조건으로 돌아가기');result.append(link);}}});
 const clear=()=>{metrics=null;$('#shopping-analysis-consent').checked=false;$('#shopping-analysis-consent').disabled=true;$('#shopping-style-advice').replaceChildren();comparison.clear();$('#shopping-size').value='';for(const k of ['chest','waist','hips','inseam'])$('#shopping-measure-'+k).value='';if(!disposed)renderCatalog();};
 document.addEventListener('a1:analysis-cleared',clear);$('#shopping-analysis-consent').addEventListener('change',()=>{$('#shopping-style-advice').replaceChildren();renderCatalog();});
 document.addEventListener('a1:language-changed',()=>{render();renderCatalog();if($('#shopping-style-advice').children.length)advice();});
 loadCatalog();
 window.addEventListener('pagehide',()=>{disposed=true;controller?.abort();clearTimeout(expiryTimer);clear();conditions=null;$('#shopping-query').value='';$('#shopping-search-results').replaceChildren();});
})();
