'use strict';
function initializeProductLab(){
 const root=document.querySelector('#lab-root');
 if(!root||!window.A1Preview||root.dataset.initialized)return;
 root.dataset.initialized='true';root.dataset.loadState='initializing';
 document.dispatchEvent(new CustomEvent('a1:policy-ready',{detail:{freeBetaMode:true}}));
 root.hidden=false;const unavailable=document.querySelector('#lab-unavailable');if(unavailable)unavailable.hidden=true;
 const I=window.A1I18n,M=window.A1ProductMatching,$=s=>document.querySelector(s);
 const dictionary={
  '옷만 나온 투명 배경 PNG를 권장합니다. 사람이나 배경이 함께 찍힌 사진은 그대로 겹쳐 보입니다.':'A transparent PNG showing only the garment works best. Any person or background in the source image is also overlaid.',
  '내 의류 사진으로 미리보기':'Preview my garment photo',
  '직접 촬영했거나 이용 권한이 있는 의류 사진을 선택하세요. 상품 정보·가격·구매 가능 여부를 검증한 자료가 아닙니다.':'Choose a garment photo you took or have permission to use. This does not verify product information, prices or availability.',
  '이 의류 사진을 기기 내 미리보기에 사용할 권한이 있습니다.':'I have permission to use this garment photo for an on-device preview.',
  '의류 사진 선택 · JPG/PNG/WebP, 12MB 이하':'Choose garment photo · JPG/PNG/WebP, up to 12MB',
  '얼굴을 제외한 분석 결과 사진과 선택한 의류 사진을 이 기기 안에서 겹쳐 보는 데 동의합니다. 외부로 전송하지 않습니다.':'I agree to overlay the cropped analysis photo and selected garment photo on this device. They are not sent outside this device.',
  '실제 의류 사진 로컬 2D 미리보기 · AI 착용 합성 아님':'Local 2D preview of a garment photo · not AI try-on',
  '의류 사진의 질감과 색을 그대로 겹쳐 보는 참고 화면입니다. 자동 착용 합성·가림 처리·옷 주름·사이즈 예측은 제공하지 않습니다.':'This overlays the garment photo texture and colors as a reference. It does not generate a dressed image, handle body occlusion, simulate folds or predict size.',
  '의류 사진을 겹쳐 보기':'Overlay garment photo','가로 위치':'Horizontal position','세로 위치':'Vertical position','의류 회전':'Garment rotation','의류 투명도':'Garment opacity',
  '의류 숨기기 · 내 사진과 비교':'Hide garment · compare with my photo',
  '밝은 단색 배경 간단 제거 · 흰색 의류에는 사용하지 마세요.':'Simple light-background removal · do not use for white garments.',
  '의류 사진·미리보기 지우기':'Clear garment photo & preview',
  '기기에서 선택한 의류 사진':'Garment photo selected on this device',
  '의류 사진을 선택하기 전에 이용 권한을 확인해주세요.':'Confirm permission before selecting a garment photo.',
  'JPG·PNG·WebP 의류 사진을 12MB 이하로 선택해주세요.':'Choose a JPG, PNG or WebP garment photo up to 12MB.',
  '의류 사진을 열지 못했습니다. JPG·PNG 또는 사진의 스크린샷으로 다시 선택해주세요.':'The garment photo could not be opened. Try JPG, PNG or a screenshot.',
  '의류 사진이 너무 큽니다. 사진을 줄이거나 스크린샷을 사용해주세요.':'The garment photo is too large. Resize it or use a screenshot.',
  '의류 사진을 기기 안에서 준비하고 있습니다.':'Preparing the garment photo on this device.',
  '의류 사진을 준비했습니다. 내 사진 사용에 별도로 동의한 뒤 겹쳐보기를 누르세요.':'Garment photo ready. Separately consent to use your photo, then choose Overlay.',
  '먼저 이용 권한이 있는 의류 사진을 선택해주세요.':'First select a garment photo you have permission to use.',
  '내 사진 사용 동의를 직접 선택해주세요.':'Select the consent to use your photo yourself.',
  '의류 사진과 미리보기를 기기 메모리에서 지웠습니다.':'The garment photo and preview were cleared from device memory.',
  '의류 사진의 배경 제거에 실패했습니다. 배경 제거를 끄고 다시 시도해주세요.':'Background removal failed. Turn it off and retry.',
  '원본 사진은 기기 안에서 분석합니다. 분석 후 아래 무료 연구실에서 조건을 입력하세요.':'The original photo is analyzed on your device. Enter your preferences in the free lab below after analysis.',
  '사진상 2D 참고 비율이며 실제 치수·건강·의류 사이즈를 판단하지 않습니다. 원본 사진은 외부로 전송하지 않으며 연구실 기능은 무료입니다.':'These are 2D photo references, not measurements, health assessments or clothing sizes. The original photo stays on your device; lab features are free.',
  '기존 무료 베타로 돌아가기':'Back to the existing free beta','상품 추천과 피팅 연구실':'Product recommendation & fitting lab',
  '무료·비로그인 연구 프로토타입입니다. 실제 상품 데이터와 생성형 가상 피팅은 아직 연결하지 않았습니다.':'Free, anonymous research prototype. Real product feeds and generative virtual try-on are not connected.',
  '사진 → 기존 기기 내 분석 → 조건 입력 → 출처·점수 비교 → 로컬 2D 배치 → 판매처 검색':'Photo → existing on-device analysis → preferences → source & score comparison → local 2D placement → retailer search',
  '2. 원하는 옷 조건':'2. Clothing preferences','컬렉션 · 선택사항':'Collection · optional','선택하지 않음':'No selection','상품당 예산':'Per-item budget','통화':'Currency','색상':'Color','선호 없음':'No preference','네이비':'Navy','블랙':'Black','화이트':'White','베이지':'Beige','용도':'Occasion','출근':'Work','일상':'Casual','행사':'Event','내가 확인한 의류 사이즈 · 선택사항':'Clothing size you have checked · optional','예: M':'e.g. M','피하고 싶은 디자인':'Designs to avoid','타이트':'Tight','크롭':'Cropped','로라이즈':'Low-rise','큰 로고':'Large logos',
  '분석된 두 비율을 이번 기기 내 추천 점수에 사용하는 데 동의합니다.':'I agree to use the two analysis ratios for this on-device matching score.',
  '사진 비율로 실제 치수나 정확한 사이즈를 추정하지 않습니다. 조건 일치 점수는 착용 성공 확률이 아닙니다.':'Photo ratios do not establish measurements or an exact clothing size. A condition-match score is not a fit probability.',
  '조건으로 추천 정렬':'Rank by my preferences','3. 상품별 추천과 비교':'3. Product matching & comparison',
  '승인된 실제 상품 자료가 없습니다. 공식 검색을 대안으로 이용하세요.':'No approved real product data is available. Use official searches as a fallback.',
  '격리된 가상 상품 3개로 흐름 시험':'Test the flow with 3 isolated fictional garments','실제 상품 준비 상태로 돌아가기':'Return to real product availability',
  '4. 로컬 2D 배치 실험':'4. Local 2D placement experiment',
  '실제 AI 가상 착용이 아닙니다. 선택한 시험 의류 도식을 분석 결과 이미지에 배치하는 화면 설계입니다. 착용감·사이즈를 보장하지 않습니다.':'This is not AI virtual try-on. It places a test garment diagram over the analysis result image as a UI prototype. Fit and size are not guaranteed.',
  '분석 결과 이미지를 기기 안에서만 2D 배치에 사용하는 데 동의합니다. 외부 전송에는 동의하지 않습니다.':'I agree to use the analysis result image only for on-device 2D placement. I do not consent to external transmission.',
  '로컬 2D 배치 보기':'Show local 2D placement','의류 위치':'Garment position','의류 크기':'Garment scale','가상 상품 도식의 로컬 배치 참고 이미지':'Local reference placement of a fictional garment diagram',
  '5. 판매처 확인':'5. Check the retailer','실제 상품을 확보하면 출처가 확인된 개별 구매 URL을 표시합니다. 현재는 개인정보 없는 공식 검색만 제공합니다.':'Verified individual purchase URLs can be shown once real products are available. For now, only official searches without personal data are provided.',
  '사진·분석·조건·배치 모두 지우기':'Clear photo, analysis, preferences & placement','사진·분석 비율·조건·결과를 서버나 브라우저 저장소에 보관하지 않습니다. 언어 설정만 기존 방식으로 유지합니다.':'Photos, ratios, preferences and results are not saved to a server or browser storage. Only the existing language preference is persisted.',
  '가상 시험 자료 · 실제 판매 상품 아님':'Fictional test data · not a real sale listing','시험 금액':'Fictional test amount','조건 일치 점수':'Condition-match score','목록 사이즈':'Listed sizes','정보 없음':'Unknown','시험 자료 시각':'Fixture timestamp','비교에 추가':'Add to comparison','2D 배치 대상으로 선택':'Select for 2D placement','조건에 맞는 시험 자료가 없습니다.':'No fixture matches these preferences.',
  '실제 상품 자료 준비 중 · 가상 시험 모드가 켜져 있습니다.':'Real product data is being prepared · fictional fixture mode is on.',
  '분석·시험 상품 선택·기기 내 이미지 사용 동의를 먼저 확인해주세요.':'First complete analysis, select a fixture and agree to on-device image use.',
  '분석 비율 사용에 동의하려면 먼저 사진을 분석해주세요.':'Analyze a photo before consenting to use its ratios.',
  '입력 조건을 확인해주세요.':'Check your preferences.','시험 결과를 갱신했습니다. 실제 상품·가격 정보가 아닙니다.':'Fixture results updated. These are not real product or price records.',
  '자료 출처':'Source','로컬 원본 도식 · 시험용':'Original local diagram · fixture only','상품명':'Name','점수':'Score','금액':'Amount','사이즈':'Size',
  '선택된 시험 의류':'Selected fictional garment','2D 참고 배치 · 생성형 피팅 아님':'2D reference placement · not generative try-on','배치 이미지를 준비하지 못했습니다.':'The placement image could not be prepared.',
  '상품 카드에서 비교에 추가를 눌러주세요.':'Choose Add to comparison on a garment card.',
  '시험 의류 3개를 표시했습니다. 실제 판매 상품이 아닙니다.':'Three fictional garments are shown. They are not real sale listings.',
  '현재 조건으로 일부 시험 의류가 제외됐습니다. 3개 모두 보려면 시험 조건으로 보기를 누르세요.':'Some fixtures were excluded by your preferences. Choose Show all 3 with test preferences to see them all.',
  '시험 조건으로 3개 모두 보기':'Show all 3 with test preferences',
  '시험 의류는 KRW 자료입니다. 통화·예산·사이즈·피할 디자인 조건 때문에 표시할 자료가 없습니다. 시험 조건으로 보거나 조건을 수정해주세요.':'Fixtures use KRW. Currency, budget, size or excluded designs leave no matches. Use test preferences or edit your conditions.',
  '조건 입력 오류: 예산은 0 이상의 정수로 입력하고 통화·사이즈를 확인해주세요.':'Invalid preferences: enter a whole-number budget of zero or more and check currency and size.',
  '추천 표시 오류가 발생했습니다. 시험 조건으로 다시 시도하거나 페이지를 새로 열어주세요.':'The recommendations could not be displayed. Retry with test preferences or reopen the page.',
  '의류 도식을 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 의류 이미지 다시 불러오기를 눌러주세요.':'The garment diagram could not load. Check your connection and choose Reload garment image.',
  '의류 이미지 다시 불러오기':'Reload garment image',
  '먼저 시험 의류를 선택해주세요. 위 의류 목록에서 2D 배치 대상으로 선택을 누르세요.':'First choose a fictional garment using Select for 2D placement in the list.',
  '먼저 사진 분석을 완료해주세요. 사진은 이 기기 안에서만 사용합니다.':'First complete photo analysis. Your photo stays on this device.',
  '사진 사용 동의가 필요합니다. 아래 동의 항목을 직접 선택해주세요.':'Photo-use consent is required. Select the consent checkbox yourself.',
  '시험 의류를 선택했습니다. 사진 사용에 동의하면 아래에 큰 2D 결과가 표시됩니다.':'Garment selected. Agree to photo use to display a large 2D result below.',
  '2D 이미지 처리에 실패했습니다. 사진 분석과 의류 선택을 확인하고 다시 눌러주세요.':'2D image processing failed. Check photo analysis and garment selection, then retry.',
  '시험 의류 선택하기':'Choose a fictional garment',
  '먼저 의류 선택 → 사진 사용 동의 → 큰 2D 결과 확인':'Choose a garment → consent to photo use → view the large 2D result',
  '결과 이미지 · 기기 내 2D 도식 배치, AI 착용 합성 아님':'Result image · on-device 2D diagram, not AI try-on',
  '2D 결과만 지우기':'Clear only the 2D result',
  '3D 아바타에서 시험 의류 보기':'View this fixture on a 3D avatar',
  '디자인 세부 정보 미확인':'Design details unknown',
  '범위 내 예산':'Within budget','선택한 스타일 일치':'Selected style matches','선택한 색상 일치':'Selected color matches','선택한 용도 일치':'Selected occasion matches','상품 목록의 사이즈 표기 일치':'Listed size label matches','선택한 컬렉션 일치':'Selected collection matches','동의한 사진상 비율의 참고 규칙 일치':'Consented photo-ratio reference rule matches',
  '판매처 사이즈표·의류 실측 확인 필요':'Check the retailer size chart and garment measurements','점수는 실제 착용 확률이 아님':'The score is not a fit probability','상품 금액만 비교 · 배송·세금 별도':'Item amount only · shipping and taxes excluded','용도 정보 미확인':'Occasion data unknown','사이즈 정보 미확인':'Size data unknown','사진 비율은 신체 치수가 아님':'Photo ratios are not body measurements'
 };
 I.register(dictionary);
 const t=s=>I.t(s),tx=(el,s)=>I.setText(typeof el==='string'?$(el):el,s);
 const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
 const reasonLabels={within_budget:'범위 내 예산',style_match:'선택한 스타일 일치',color_match:'선택한 색상 일치',occasion_match:'선택한 용도 일치',listed_size_match:'상품 목록의 사이즈 표기 일치',collection_match:'선택한 컬렉션 일치',photo_ratio_reference:'동의한 사진상 비율의 참고 규칙 일치'};
 const warningLabels={design_unknown:'디자인 세부 정보 미확인',check_size_chart:'판매처 사이즈표·의류 실측 확인 필요',not_fit_probability:'점수는 실제 착용 확률이 아님',shipping_tax_extra:'상품 금액만 비교 · 배송·세금 별도',occasion_unknown:'용도 정보 미확인',size_unknown:'사이즈 정보 미확인',photo_ratios_not_measurements:'사진 비율은 신체 치수가 아님'};
 let metrics=null,fixtures=false,rows=[],ranked=[],selected=null,compare=new Set(),generation=0;
 const fitCanvas=$('#lab-fit-canvas'),form=$('#lab-preferences');
 const reveal=target=>{const el=typeof target==='string'?$(target):target;if(!el)return;
  el.setAttribute('tabindex','-1');const html=document.documentElement,previous=html.style.scrollBehavior;html.style.scrollBehavior='auto';
  const header=document.querySelector('body>header'),offset=(header?.getBoundingClientRect().height||0)+16;
  window.scrollTo(0,Math.max(0,scrollY+el.getBoundingClientRect().top-offset));el.focus({preventScroll:true});html.style.scrollBehavior=previous;
 };
 const notify=message=>{tx('#lab-status',message);};
 function showAll(){const bodyConsent=$('#lab-body-consent').checked;form.reset();$('#lab-body-consent').checked=bodyConsent;fixtures=true;rows=makeFixtures();update();reveal('#lab-products');}
 $('#lab-show-all').addEventListener('click',showAll);
 $('#lab-pick-garment').addEventListener('click',()=>{if(!fixtures){fixtures=true;rows=makeFixtures();update();}reveal(ranked.length?'#lab-products':'#lab-catalog');});
 document.addEventListener('a1:lab-navigate',e=>{const target=e.detail?.target;if(!['#lab-preferences','#lab-comparison','#lab-fitting'].includes(target))return;
  if(target==='#lab-fitting'&&!selected){reveal('#lab-local-photo-fitting');}else reveal(target);
 });
 function eraseFit(){generation++;fitCanvas.width=fitCanvas.height=1;fitCanvas.hidden=true;$('#lab-fit-result').hidden=true;$('#lab-fit-status').textContent='';}
 function makeFixtures(){const now=Date.now();return [
  {id:'LAB-A',name:'LAB SHIRT A',brand:'A1 FICTIONAL',price:59000,styles:['classic','minimal'],occasions:['work'],sizes:['M'],tags:['straight']},
  {id:'LAB-B',name:'LAB SHIRT B',brand:'A1 FICTIONAL',price:89000,styles:['casual'],occasions:['casual'],sizes:[],tags:['relaxed']},
  {id:'LAB-C',name:'LAB SHIRT C',brand:'A1 FICTIONAL',price:29000,styles:['streetwear'],occasions:['casual'],sizes:['M','L'],tags:['cropped','logos']}
 ].map(p=>({...p,fixture:true,designTagsComplete:true,currency:'KRW',color:'navy',gender:'unisex',stock:'in_stock',checkedAt:now,expiresAt:now+1800000,productUrl:null,imageUrl:'assets/lab-garment.svg',source:'original-local-fixture'}));}
 function input(){const v=Object.fromEntries(new FormData(form));return {style:v.style,gender:v.gender,budget:Number(v.budget),currency:v.currency,color:v.color,occasion:v.occasion,size:v.size,avoid:new FormData(form).getAll('avoid'),bodyConsent:$('#lab-body-consent').checked,...($('#lab-body-consent').checked?{metrics}:{})};}
 function renderComparison(){const target=$('#lab-comparison');target.replaceChildren();const items=ranked.filter(r=>compare.has(r.product.id));if(!items.length){target.append(node('p',t('상품 카드에서 비교에 추가를 눌러주세요.')));return;}
  const table=node('table'),head=node('tr');for(const label of ['상품명','점수','금액','사이즈','자료 출처'])head.append(node('th',t(label)));table.append(head);
  for(const {product:p,score}of items){const tr=node('tr');for(const value of [p.name,score+' / 100',t('시험 금액')+' '+p.price.toLocaleString(I.locale)+' '+p.currency,p.sizes.join(', ')||t('정보 없음'),t('로컬 원본 도식 · 시험용')])tr.append(node('td',value));table.append(tr);}target.append(table);
 }
 function render(){
  const target=$('#lab-products');target.replaceChildren();
  tx('#lab-catalog-state',fixtures?'실제 상품 자료 준비 중 · 가상 시험 모드가 켜져 있습니다.':'승인된 실제 상품 자료가 없습니다. 공식 검색을 대안으로 이용하세요.');
  tx('#lab-fixtures',fixtures?'실제 상품 준비 상태로 돌아가기':'격리된 가상 상품 3개로 흐름 시험');
  $('#lab-show-all').hidden=!fixtures||ranked.length===3;
  if(fixtures&&!ranked.length)target.append(node('p',t('시험 의류는 KRW 자료입니다. 통화·예산·사이즈·피할 디자인 조건 때문에 표시할 자료가 없습니다. 시험 조건으로 보거나 조건을 수정해주세요.')));
  for(const row of ranked){const p=row.product,card=node('article');card.className='lab-card';card.dataset.labProduct=p.id;
   const badge=node('p',t('가상 시험 자료 · 실제 판매 상품 아님'));badge.className='lab-fixture';card.append(badge,node('h3',p.name));
   const image=node('img');image.src=p.imageUrl;image.alt=t('로컬 원본 도식 · 시험용');image.width=400;image.height=500;
   image.addEventListener('error',()=>{image.hidden=true;const message=node('p',t('의류 도식을 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 의류 이미지 다시 불러오기를 눌러주세요.'));message.setAttribute('role','alert');card.append(message);notify('의류 도식을 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 의류 이미지 다시 불러오기를 눌러주세요.');$('#lab-reload-image').hidden=false;});card.append(image);
   const score=node('p',t('조건 일치 점수')+': '+row.score+' / 100');score.className='lab-score';card.append(score,node('p',t('시험 금액')+': '+p.price.toLocaleString(I.locale)+' '+p.currency),node('p',t('목록 사이즈')+': '+(p.sizes.join(', ')||t('정보 없음'))));
   const reasons=node('ul');for(const code of row.reasons)reasons.append(node('li',t(reasonLabels[code])));card.append(reasons);
   const warnings=node('ul');warnings.className='lab-warnings';for(const code of row.warnings)warnings.append(node('li',t(warningLabels[code])));card.append(warnings,node('p',t('시험 자료 시각')+': '+new Date(p.checkedAt).toLocaleString(I.locale)));
   const comparison=node('button',t('비교에 추가'));comparison.type='button';comparison.dataset.labCompare=p.id;comparison.setAttribute('aria-pressed',String(compare.has(p.id)));
   comparison.addEventListener('click',()=>{if(compare.has(p.id))compare.delete(p.id);else if(compare.size<3)compare.add(p.id);render();});
   const fit=node('button',t('2D 배치 대상으로 선택'));fit.type='button';fit.dataset.labSelect=p.id;fit.addEventListener('click',()=>{selected=p;$('#lab-fit-consent').checked=false;eraseFit();tx('#lab-selected','선택된 시험 의류');$('#lab-selected').append(document.createTextNode(': '+p.name));tx('#lab-fit-status','시험 의류를 선택했습니다. 사진 사용에 동의하면 아래에 큰 2D 결과가 표시됩니다.');reveal('#lab-fit-flow');});const avatar=node('a',t('3D 아바타에서 시험 의류 보기'));avatar.href='/avatar-lab.html#'+p.id;avatar.dataset.avatarGarment=p.id;card.append(comparison,fit,avatar);target.append(card);
  }
  renderComparison();
 }
 function update(){try{const p=M.preferences(input());ranked=fixtures?M.rank(rows,p,{mode:'fixture'}).matches:[];
   if(selected&&!ranked.some(r=>r.product.id===selected.id)){selected=null;eraseFit();$('#lab-selected').textContent='';}
   compare=new Set([...compare].filter(id=>ranked.some(r=>r.product.id===id)));render();$('#lab-searches').replaceChildren();
   for(const row of window.A1Preview.retailers({country:'KR',category:'tops'}).retailers)$('#lab-searches').append(window.A1Preview.retailerActions(row));
   notify(fixtures?(ranked.length===3?'시험 의류 3개를 표시했습니다. 실제 판매 상품이 아닙니다.':'현재 조건으로 일부 시험 의류가 제외됐습니다. 3개 모두 보려면 시험 조건으로 보기를 누르세요.'):'시험 결과를 갱신했습니다. 실제 상품·가격 정보가 아닙니다.');return true;
  }catch(error){ranked=[];render();notify(error instanceof TypeError?'조건 입력 오류: 예산은 0 이상의 정수로 입력하고 통화·사이즈를 확인해주세요.':'추천 표시 오류가 발생했습니다. 시험 조건으로 다시 시도하거나 페이지를 새로 열어주세요.');return false;}}
 let garment=null,garmentReady=null;
 function loadGarment(){
  const next=new Image();garment=next;
  garmentReady=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('image_timeout')),10000);next.onload=()=>{clearTimeout(timer);if(next.naturalWidth&&next.naturalHeight)resolve(next);else reject(Error('empty_image'));};next.onerror=()=>{clearTimeout(timer);reject(Error('image_load'));};next.src='assets/lab-garment.svg';});
  garmentReady.catch(()=>{if(garment!==next)return;notify('의류 도식을 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 의류 이미지 다시 불러오기를 눌러주세요.');$('#lab-reload-image').hidden=false;});
 }
 loadGarment();
 $('#lab-reload-image').addEventListener('click',()=>{loadGarment();$('#lab-reload-image').hidden=true;render();if(selected&&$('#lab-fit-consent').checked)draw(true);});
 async function draw(showResult=false){
  if(!metrics||$('#ai-result').hidden){tx('#lab-fit-status','먼저 사진 분석을 완료해주세요. 사진은 이 기기 안에서만 사용합니다.');reveal('#ai-form');return;}
  if(!selected){tx('#lab-fit-status','먼저 시험 의류를 선택해주세요. 위 의류 목록에서 2D 배치 대상으로 선택을 누르세요.');reveal('#lab-catalog');return;}
  if(!$('#lab-fit-consent').checked){tx('#lab-fit-status','사진 사용 동의가 필요합니다. 아래 동의 항목을 직접 선택해주세요.');reveal('#lab-fit-flow');return;}
  const token=++generation;try{const diagram=await garmentReady;if(token!==generation||!$('#lab-fit-consent').checked||!selected||!metrics)return;
   const source=$('#ai-canvas');fitCanvas.width=source.width;fitCanvas.height=source.height;const ctx=fitCanvas.getContext('2d');ctx.drawImage(source,0,0);
   const w=source.width*Number($('#lab-fit-scale').value)/100,h=w*1.25,y=source.height*Number($('#lab-fit-y').value)/100;ctx.drawImage(diagram,(source.width-w)/2,y,w,h);
   ctx.fillStyle='#fff';ctx.fillRect(0,source.height-34,source.width,34);ctx.fillStyle='#253b25';ctx.font=Math.max(12,source.width/40)+'px sans-serif';ctx.fillText('2D FIXTURE ONLY / NOT AI TRY-ON',10,source.height-12);
   fitCanvas.hidden=false;$('#lab-fit-result').hidden=false;tx('#lab-fit-status','2D 참고 배치 · 생성형 피팅 아님');if(showResult)reveal('#lab-fit-result');
  }catch{if(token!==generation)return;eraseFit();tx('#lab-fit-status','2D 이미지 처리에 실패했습니다. 사진 분석과 의류 선택을 확인하고 다시 눌러주세요.');$('#lab-reload-image').hidden=false;reveal('#lab-fit-flow');}
 }
 // User-supplied raster images stay in bounded canvases in this document.
 // Separately reviewed catalog images may be read with anonymous CORS.
 // No photograph upload, model call, proxy bypass or browser storage exists.
 const localPhotoCanvas=$('#lab-local-photo-canvas'),garmentPreview=$('#lab-garment-photo-preview');
 let localGarment=null,preparedGarment=null,localRevision=0,pendingGarment=null,localDisposed=false,localCatalogProduct=null;
 const catalogPanel=node('section');catalogPanel.id='lab-selected-catalog';catalogPanel.hidden=true;$('#lab-garment-photo-rights').closest('label').before(catalogPanel);
 I.register({'선택한 상품':'Selected product','상품 이미지 이용 권한 확인 · 사진 사용 동의는 별도입니다.':'Product-image permission reviewed · using your photo requires separate consent.','판매처에서 이 상품 구매하기':'Buy this product at the seller','판매처 이미지의 브라우저 처리를 허용하지 않거나 이미지를 열지 못했습니다. 이용 가능한 의류 사진을 기기에서 선택해주세요.':'The seller image cannot be processed in this browser or did not load. Choose a garment photo you may use from your device.'});
 const localMessage=source=>tx('#lab-local-photo-status',source);
 function eraseLocalResult(){localPhotoCanvas.width=localPhotoCanvas.height=1;$('#lab-local-photo-result').hidden=true;}
 function clearLocalPhoto({keepRights=false,silent=false}={}){
  localRevision++;pendingGarment?.cancel();pendingGarment=null;
  for(const canvas of [localGarment,preparedGarment,garmentPreview])if(canvas)canvas.width=canvas.height=1;
  localGarment=preparedGarment=null;$('#lab-garment-photo-figure').hidden=true;eraseLocalResult();
  localCatalogProduct=null;catalogPanel.hidden=true;catalogPanel.replaceChildren();$('#lab-garment-photo-rights').closest('label').hidden=false;$('#lab-garment-photo').closest('label').hidden=false;
  $('#lab-garment-photo').value='';$('#lab-local-photo-consent').checked=false;if(!keepRights)$('#lab-garment-photo-rights').checked=false;
  for(const [id,value]of [['lab-local-photo-x','50'],['lab-local-photo-y','38'],['lab-local-photo-scale','55'],['lab-local-photo-rotation','0'],['lab-local-photo-opacity','100']])$('#'+id).value=value;
  $('#lab-local-photo-before').checked=false;$('#lab-local-photo-remove-bg').checked=false;
  if(!silent)localMessage('의류 사진과 미리보기를 기기 메모리에서 지웠습니다.');
 }
 async function readLocalGarment(file,token){
  const url=URL.createObjectURL(file),image=new Image();let rejectLoad,released=false,timer;
  const release=()=>{if(released)return;released=true;clearTimeout(timer);image.onload=image.onerror=null;image.removeAttribute('src');URL.revokeObjectURL(url);};
  const load={cancel(){release();rejectLoad?.(Error('cancelled'));}};pendingGarment=load;
  try{
   await new Promise((resolve,reject)=>{rejectLoad=reject;image.onload=resolve;image.onerror=()=>reject(Error('decode'));timer=setTimeout(()=>reject(Error('decode')),10000);image.src=url;});
   if(token!==localRevision||localDisposed)throw Error('cancelled');
   if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth*image.naturalHeight>30000000)throw Error('dimensions');
   const scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);return canvas;
  }finally{release();if(pendingGarment===load)pendingGarment=null;}
 }
 async function importCatalogProduct(){
  const product=window.A1CatalogFitting?.current();if(!product||$('#ai-result').hidden)return;
  clearLocalPhoto({silent:true});localCatalogProduct=product;const token=localRevision;
  $('#lab-garment-photo-rights').checked=true;$('#lab-garment-photo-rights').closest('label').hidden=true;$('#lab-garment-photo').closest('label').hidden=true;
  catalogPanel.hidden=false;catalogPanel.append(node('h4',t('선택한 상품')+': '+product.name),node('p',product.brand+' · '+product.retailerName),node('p',t('상품 이미지 이용 권한 확인 · 사진 사용 동의는 별도입니다.')));
  const buy=node('a',t('판매처에서 이 상품 구매하기'));buy.href=product.productUrl;buy.dataset.selectedCatalogBuy=product.id;buy.rel=(product.commercial?.affiliate?'sponsored ':'')+'noopener noreferrer';buy.referrerPolicy='no-referrer';buy.addEventListener('click',e=>{if(!e.isTrusted||window.A1CatalogFitting?.current()?.id!==product.id||buy.href!==product.productUrl)e.preventDefault();});catalogPanel.append(buy);
  const image=new Image();image.crossOrigin='anonymous';image.referrerPolicy='no-referrer';let rejectLoad,timer;
  const release=()=>{clearTimeout(timer);image.onload=image.onerror=null;image.removeAttribute('src');};const load={cancel(){release();rejectLoad?.(Error('cancelled'));}};pendingGarment=load;
  try{await new Promise((resolve,reject)=>{rejectLoad=reject;image.onload=resolve;image.onerror=()=>reject(Error('cors'));timer=setTimeout(()=>reject(Error('timeout')),10000);image.src=product.fittingImageUrl;});
   if(token!==localRevision||localDisposed||window.A1CatalogFitting?.current()?.id!==product.id)return;
   if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth*image.naturalHeight>30000000)throw Error('image');
   const scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,canvas.width,canvas.height);ctx.getImageData(0,0,1,1);localGarment=canvas;prepareGarmentPhoto();localMessage('의류 사진을 준비했습니다. 내 사진 사용에 별도로 동의한 뒤 겹쳐보기를 누르세요.');
  }catch{if(token===localRevision&&!localDisposed){clearLocalPhoto({silent:true});localMessage('판매처 이미지의 브라우저 처리를 허용하지 않거나 이미지를 열지 못했습니다. 이용 가능한 의류 사진을 기기에서 선택해주세요.');}}
  finally{release();if(pendingGarment===load)pendingGarment=null;}
 }
 document.addEventListener('a1:catalog-fitting-selected',importCatalogProduct);document.addEventListener('a1:catalog-fitting-clear',()=>clearLocalPhoto({silent:true}));
 function prepareGarmentPhoto(){
  if(!localGarment)return;const canvas=document.createElement('canvas');canvas.width=localGarment.width;canvas.height=localGarment.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(localGarment,0,0);
  if($('#lab-local-photo-remove-bg').checked){
   // Only edge-connected near-white pixels. This is not AI segmentation and
   // must not be used to infer folds or erase a white garment's background.
   const image=ctx.getImageData(0,0,canvas.width,canvas.height),data=image.data,w=canvas.width,h=canvas.height,seen=new Uint8Array(w*h),queue=new Uint32Array(w*h);let start=0,end=0;
   const enqueue=index=>{if(seen[index])return;seen[index]=1;const n=index*4,r=data[n],g=data[n+1],b=data[n+2];if(data[n+3]===0||Math.min(r,g,b)>=235&&Math.max(r,g,b)-Math.min(r,g,b)<=20)queue[end++]=index;};
   for(let x=0;x<w;x++){enqueue(x);enqueue((h-1)*w+x);}for(let y=0;y<h;y++){enqueue(y*w);enqueue(y*w+w-1);}
   while(start<end){const index=queue[start++],x=index%w,y=Math.floor(index/w);data[index*4+3]=0;if(x)enqueue(index-1);if(x+1<w)enqueue(index+1);if(y)enqueue(index-w);if(y+1<h)enqueue(index+w);}ctx.putImageData(image,0,0);
  }
  if(preparedGarment)preparedGarment.width=preparedGarment.height=1;preparedGarment=canvas;
  const scale=Math.min(1,360/Math.max(canvas.width,canvas.height));garmentPreview.width=Math.max(1,Math.round(canvas.width*scale));garmentPreview.height=Math.max(1,Math.round(canvas.height*scale));garmentPreview.getContext('2d').drawImage(canvas,0,0,garmentPreview.width,garmentPreview.height);$('#lab-garment-photo-figure').hidden=false;
 }
 function drawLocalPhoto(showResult=false){
  if($('#ai-result').hidden){localMessage('먼저 사진 분석을 완료해주세요. 사진은 이 기기 안에서만 사용합니다.');if(showResult)reveal('#ai-form');return;}
  if(localCatalogProduct&&window.A1CatalogFitting?.current()?.id!==localCatalogProduct.id){clearLocalPhoto();return;}
  if(!$('#lab-garment-photo-rights').checked||!localGarment){localMessage('먼저 이용 권한이 있는 의류 사진을 선택해주세요.');if(showResult)reveal('#lab-local-photo-fitting');return;}
  if(!$('#lab-local-photo-consent').checked){eraseLocalResult();localMessage('내 사진 사용 동의를 직접 선택해주세요.');return;}
  const source=$('#ai-clean-canvas')||$('#ai-canvas');if(!source||source.width<=1||source.height<=1){eraseLocalResult();localMessage('먼저 사진 분석을 완료해주세요. 사진은 이 기기 안에서만 사용합니다.');return;}
  try{
   if(!preparedGarment)prepareGarmentPhoto();const scale=Math.min(1,1600/Math.max(source.width,source.height));localPhotoCanvas.width=Math.max(1,Math.round(source.width*scale));localPhotoCanvas.height=Math.max(1,Math.round(source.height*scale));
   const ctx=localPhotoCanvas.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(source,0,0,localPhotoCanvas.width,localPhotoCanvas.height);
   if(!$('#lab-local-photo-before').checked){
    const width=localPhotoCanvas.width*Number($('#lab-local-photo-scale').value)/100,height=width*preparedGarment.height/preparedGarment.width,x=localPhotoCanvas.width*Number($('#lab-local-photo-x').value)/100,y=localPhotoCanvas.height*Number($('#lab-local-photo-y').value)/100;
    ctx.save();ctx.translate(x,y);ctx.rotate(Number($('#lab-local-photo-rotation').value)*Math.PI/180);ctx.globalAlpha=Number($('#lab-local-photo-opacity').value)/100;ctx.shadowColor='rgba(0,0,0,.18)';ctx.shadowBlur=3*localPhotoCanvas.width/600;ctx.shadowOffsetY=2*localPhotoCanvas.width/600;ctx.drawImage(preparedGarment,-width/2,-height/2,width,height);ctx.restore();
   }
   const footer=Math.max(28,localPhotoCanvas.width/25);ctx.fillStyle='rgba(255,255,255,.9)';ctx.fillRect(0,localPhotoCanvas.height-footer,localPhotoCanvas.width,footer);ctx.fillStyle='#253b25';ctx.font=Math.max(11,localPhotoCanvas.width/45)+'px sans-serif';ctx.fillText('LOCAL PHOTO OVERLAY / NOT AI TRY-ON',8,localPhotoCanvas.height-footer*.3);
   $('#lab-local-photo-result').hidden=false;localMessage('실제 의류 사진 로컬 2D 미리보기 · AI 착용 합성 아님');if(showResult)reveal('#lab-local-photo-result');
  }catch{eraseLocalResult();localMessage('의류 사진의 배경 제거에 실패했습니다. 배경 제거를 끄고 다시 시도해주세요.');}
 }
 $('#lab-garment-photo').addEventListener('change',async()=>{
  const file=$('#lab-garment-photo').files?.[0];if(!file)return;
  if(!$('#lab-garment-photo-rights').checked){$('#lab-garment-photo').value='';localMessage('의류 사진을 선택하기 전에 이용 권한을 확인해주세요.');return;}
  clearLocalPhoto({keepRights:true,silent:true});
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size<=0||file.size>12*1024*1024){localMessage('JPG·PNG·WebP 의류 사진을 12MB 이하로 선택해주세요.');return;}
  const token=localRevision;localMessage('의류 사진을 기기 안에서 준비하고 있습니다.');
  try{
   const header=new Uint8Array(await file.slice(0,16).arrayBuffer()),starts=bytes=>bytes.every((v,i)=>header[i]===v);
   const valid=file.type==='image/png'?starts([137,80,78,71,13,10,26,10]):file.type==='image/jpeg'?starts([255,216,255]):starts([82,73,70,70])&&[87,69,66,80].every((v,i)=>header[i+8]===v);
   if(!valid)throw Error('format');if(token!==localRevision||localDisposed||!$('#lab-garment-photo-rights').checked)return;
   const canvas=await readLocalGarment(file,token);if(token!==localRevision||localDisposed||!$('#lab-garment-photo-rights').checked){canvas.width=canvas.height=1;return;}localGarment=canvas;prepareGarmentPhoto();localMessage('의류 사진을 준비했습니다. 내 사진 사용에 별도로 동의한 뒤 겹쳐보기를 누르세요.');
  }
  catch(error){if(token===localRevision&&!localDisposed)localMessage(error.message==='dimensions'?'의류 사진이 너무 큽니다. 사진을 줄이거나 스크린샷을 사용해주세요.':'의류 사진을 열지 못했습니다. JPG·PNG 또는 사진의 스크린샷으로 다시 선택해주세요.');}
 });
 $('#lab-garment-photo-rights').addEventListener('change',()=>{if(!$('#lab-garment-photo-rights').checked)clearLocalPhoto();});
 $('#lab-local-photo-consent').addEventListener('change',()=>{if(!$('#lab-local-photo-consent').checked)eraseLocalResult();});
 $('#lab-local-photo-fit').addEventListener('click',()=>drawLocalPhoto(true));$('#lab-local-photo-clear').addEventListener('click',()=>{clearLocalPhoto();window.A1CatalogFitting?.clear();});
 for(const id of ['lab-local-photo-x','lab-local-photo-y','lab-local-photo-scale','lab-local-photo-rotation','lab-local-photo-opacity','lab-local-photo-before'])$('#'+id).addEventListener('input',()=>{if(!$('#lab-local-photo-result').hidden)drawLocalPhoto();});
 $('#lab-local-photo-remove-bg').addEventListener('change',()=>{try{prepareGarmentPhoto();if(!$('#lab-local-photo-result').hidden)drawLocalPhoto();}catch{eraseLocalResult();localMessage('의류 사진의 배경 제거에 실패했습니다. 배경 제거를 끄고 다시 시도해주세요.');}});
 form.addEventListener('submit',e=>{e.preventDefault();if(update())reveal(fixtures?'#lab-products':'#lab-catalog');});
 $('#lab-body-consent').addEventListener('change',update);
 $('#lab-fixtures').addEventListener('click',()=>{fixtures=!fixtures;rows=fixtures?makeFixtures():[];selected=null;compare.clear();eraseFit();update();reveal(fixtures&&ranked.length?'#lab-products':'#lab-catalog');});
 $('#lab-fit').addEventListener('click',()=>draw(true));for(const id of ['lab-fit-y','lab-fit-scale'])$('#'+id).addEventListener('input',()=>{if(!fitCanvas.hidden)draw();});
 $('#lab-fit-consent').addEventListener('change',()=>{if(!$('#lab-fit-consent').checked)eraseFit();else if(selected&&metrics)draw(true);});
 $('#lab-fit-clear').addEventListener('click',()=>{$('#lab-fit-consent').checked=false;eraseFit();reveal('#lab-fit-flow');});
 function clear(){generation++;metrics=null;fixtures=false;rows=[];ranked=[];selected=null;compare.clear();form.reset();$('#lab-reload-image').hidden=true;$('#lab-body-consent').checked=false;$('#lab-body-consent').disabled=true;$('#lab-fit-consent').checked=false;eraseFit();clearLocalPhoto({silent:true});$('#lab-selected').textContent='';$('#lab-status').textContent='';$('#lab-searches').replaceChildren();render();}
 document.addEventListener('a1:analysis-cleared',clear);window.addEventListener('pagehide',clear);
 document.addEventListener('a1:lab-enter',e=>{if(!metrics&&M.validMetrics(e.detail?.metrics)){metrics={...e.detail.metrics};$('#lab-body-consent').disabled=false;}});
 document.addEventListener('a1:analysis-ready',e=>{eraseLocalResult();$('#lab-local-photo-consent').checked=false;if(M.validMetrics(e.detail?.metrics)){metrics={...e.detail.metrics};$('#lab-body-consent').checked=false;$('#lab-body-consent').disabled=false;tx('#ai-notes','사진상 2D 참고 비율이며 실제 치수·건강·의류 사이즈를 판단하지 않습니다. 원본 사진은 외부로 전송하지 않으며 연구실 기능은 무료입니다.');}if(window.A1CatalogFitting?.current())importCatalogProduct();});
 $('#lab-clear').addEventListener('click',()=>{$('#ai-clear').click();clear();});
 document.addEventListener('a1:language-changed',()=>{render();if(metrics)tx('#ai-notes','사진상 2D 참고 비율이며 실제 치수·건강·의류 사이즈를 판단하지 않습니다. 원본 사진은 외부로 전송하지 않으며 연구실 기능은 무료입니다.');if(!fitCanvas.hidden)tx('#lab-fit-status','2D 참고 배치 · 생성형 피팅 아님');});
 window.addEventListener('pagehide',()=>{localDisposed=true;clearLocalPhoto({silent:true});});
 window.addEventListener('pageshow',()=>{localDisposed=false;});
 tx($('.ai-intro'),'원본 사진은 기기 안에서 분석합니다. 분석 후 아래 무료 연구실에서 조건을 입력하세요.');render();I.refresh();root.dataset.loadState='ready';
}
initializeProductLab();
document.addEventListener('a1:lab-mounted',initializeProductLab);
