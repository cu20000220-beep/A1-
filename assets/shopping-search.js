'use strict';
(()=>{
 const root=document.querySelector('#shopping-search');if(!root||!window.A1Preview)return;
 const I=window.A1I18n,Q=window.A1ShoppingQuery,P=window.A1Preview,C=window.A1ProductCatalog,O=window.A1OfferComparison,$=s=>document.querySelector(s);
 I.register({
 '체형 분석을 참고해 옷 찾기':'Find clothes using my photo references',
 '체형 참고 검색 제안 · 실제 상품 목록 아님':'Body-reference search ideas · not product listings',
 '사진의 어깨·골반 기준점 비율을 참고해 단정한 상의와 여유 있는 하의 조합을 비교해보세요.':'Using the photo landmark proportions as a reference, compare neat tops and more relaxed bottoms.',
 '사진상 비율을 참고해 가벼운 상의 레이어와 일자 하의 조합을 비교해보세요.':'Using the photo proportions as a reference, compare light top layers and straight bottoms.',
 '사진상 비율을 참고해 상의 끝선과 바지 길이가 다른 조합을 비교해보세요.':'Using the photo proportions as a reference, compare different top and trouser lengths.',
 '사진 한 장으로 치수나 맞는 사이즈를 판정하지 않습니다. 실제 상품 실측·소재·반품 조건을 확인하세요.':'One photo cannot establish measurements or the right size. Check actual garment measurements, fabric and returns.',
 '선택하면 표시된 의류 검색어를 적용합니다. 판매처 이동은 공식 검색 버튼을 직접 누를 때만 실행하며 사진·신체 수치는 보내지 않습니다.':'Selecting applies the displayed clothing phrase. Only your click on an official search opens the retailer; photos and body numbers are not sent.',
 '이 조건으로 옷 찾기':'Find clothes with these conditions',
 '해석한 검색 조건':'Interpreted search conditions','의류 종류':'Clothing type','색상':'Color','핏':'Fit','용도':'Purpose','컬렉션':'Collection',
 '예산은 ‘5만원 이하’처럼 상한 금액 하나로 입력해주세요.':'Enter one upper budget, such as “50,000원 이하”.',
 '제외 조건은 아직 해석하지 않습니다. 원하는 색상·핏만 입력해주세요.':'Exclusion conditions are not supported yet. Enter the color and fit you want.',
 '비교표를 가로로 밀면 사이즈·확인 시각·구매 조건·출처를 볼 수 있습니다.':'Swipe the comparison table sideways to see sizes, verification times, purchase conditions and sources.',
 'A1 FASHION은 의류 검색·비교·추천 플랫폼입니다. 주문·결제·배송·반품은 해당 판매처에서 진행합니다.':'A1 FASHION helps you search, compare and choose clothing. Orders, payment, delivery and returns are handled by the external seller.',
 '배송지':'Delivery destination','광고 상품':'Sponsored products','배송 국가':'Delivery country','대한민국':'South Korea','미국':'United States','일본':'Japan','영국':'United Kingdom','독일':'Germany','프랑스':'France',
 '일반 검색 결과':'Organic search results','광고 · 일반 검색 결과와 별도':'Ads · separate from organic results','품절·재고 미확인 자료 · 구매 추천 제외':'Out-of-stock or unconfirmed stock · excluded from purchase recommendations',
 '등록 판매 정보 {total}개 · 일반 조건 일치 {count}개 · 광고 {sponsored}개 · 품절·재고 미확인 {unavailable}개':'{total} registered offers · {count} organic matches · {sponsored} ads · {unavailable} out-of-stock or unconfirmed',
 '광고':'Ad','제휴 링크':'Affiliate link','광고·제휴 정보 미확인':'Advertising/affiliate information unknown','광고·제휴 표시 없음 · 등록 자료 기준':'No ad/affiliate label in registered data',
 '제휴 링크를 통한 클릭·구매로 수수료가 발생할 수 있습니다.':'Clicks or purchases through affiliate links may generate commission.',
 '광고는 별도 영역에 표시하며 일반 추천 순위에 섞지 않습니다.':'Ads are shown separately and do not enter organic recommendation rankings.',
 '확인된 가격 옵션':'Price applies to this variant','상태':'Condition','새 상품':'New','중고':'Used','미확인':'Unknown','재고 있음':'In stock','품절':'Out of stock','재고 미확인':'Stock unknown',
 '판매처별 같은 상품 비교':'Compare the same item across sellers','동일 상품 식별 정보 미확인':'Same-item identity is unconfirmed',
 'GTIN 또는 제조사 품번과 브랜드·색상·사이즈·규격·상태가 확인된 동일 옵션만 묶습니다.':'Only matching variants with GTIN or manufacturer part number, brand, color, size, size system and condition are grouped.',
 '선택 후보 비교 · 같은 상품 가격 비교와 다릅니다.':'Selected candidate comparison · different from same-item offer comparison.',
 '같은 상품·같은 옵션의 판매처별 비교':'Seller comparison for the same item and variant','선택한 배송 국가':'Selected delivery country','비교 통화':'Comparison currency',
 '배송비':'Shipping','세금':'Tax','관세':'Duties','예상 합계':'Estimated total','구매 조건':'Purchase conditions','광고·제휴':'Advertising/affiliate','구매 링크':'Purchase link',
 '확인된 비교 대상 내 예상 합계 {amount} · 전체 시장 최저가가 아닙니다.':'Estimated total {amount} among verified comparison offers · not the lowest price across the market.',
 '확인된 비교 대상 내 예상 합계':'Estimated total among verified comparison offers',
 '합계 비교 조건을 충족하는 서로 다른 판매처 2곳 이상이 없어 최저 합계를 표시하지 않습니다.':'No minimum total is shown without at least two distinct sellers meeting all total-cost comparison conditions.',
 '미확인 비용을 0으로 계산하지 않으며 통화 환산을 하지 않습니다. 최종 결제 금액과 반품·배송 조건은 판매처에서 확인하세요.':'Unknown fees are not treated as zero and currencies are not converted. Confirm final checkout totals, returns and delivery conditions at the seller.',
 '추가 구매 조건 없음 · 자료 확인':'No additional purchase conditions · reviewed in source',
 '가격 옵션 정보 미확인':'Price variant information unknown','확인된 추가 조건 없음':'No additional conditions confirmed','구매 조건 미확인':'Purchase conditions unknown','구매 불가 · 재고 또는 확인 시각 점검 필요':'Purchase unavailable · check stock or freshness',
 '비교 대상 없음':'No comparable offers','비교 정보를 확인하지 못했습니다. 조건을 수정하거나 다시 검색해주세요.':'Comparison data could not be verified. Change the conditions or search again.',
 '가격 미확인':'Price unknown','확인 시각 만료':'Verification is stale','다른 통화 · 환산 안 함':'Different currency · no conversion','배송 가능 여부 미확인':'Delivery availability unconfirmed','해당 배송지 비용 미확인':'Costs for this destination unknown','배송비 미확인':'Shipping unknown','세금 미확인':'Tax unknown','관세 미확인':'Duties unknown','조건부 구매 · 조건 확인 필요':'Conditional purchase · check requirements','동시 갱신 정보 충돌':'Conflicting simultaneous updates',
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
 '사이즈 정보 미확인':'Size data unknown','용도 정보 미확인':'Occasion data unknown','사진 비율은 실제 신체 치수가 아닙니다.':'Photo ratios are not body measurements.',
 '사이즈와 직접 입력 치수를 확인해주세요.':'Check the size and entered measurements.',
 '검색·개인정보 안내':'Search & privacy details',
 '앱 안에서 쇼핑몰이 열리지 않나요?':'Retailer blocked in the in-app browser?',
 '어떤 옷을 찾으세요?':'What would you like to wear?',
 '무료 베타 · 의류 검색부터 시작하세요':'Free beta · start with clothing search',
 '예: 남성 검정 와이드 슬랙스 출근용 5만원 이하':'e.g. men black slacks',
 '원하는 옷 조건':'Clothing search conditions','옷 찾기':'Find clothes',
 '현재 검증된 실제 상품 0개 · 아래는 상품 목록이 아닌 공식 쇼핑몰 검색 대안입니다.':'0 verified real products currently · the options below are official retailer searches, not product listings.',
 '의류 종류·색상·핏·용도·컬렉션의 정해진 단어만 검색어로 전달합니다. 예산은 아래에 따로 표시하며 판매처에서 직접 설정하세요. 원문·사진·체형 수치는 전송하지 않습니다.':'Only bounded clothing type, color, fit, purpose and collection terms enter the search phrase. Set the budget at the retailer. Raw text, photos and body ratios are not transmitted.',
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
 root.hidden=false;let conditions=null,metrics=null,bodyOriginalQuery=null,catalog={version:1,generatedAt:null,products:[]},catalogState='loading',matches=[],sponsored=[],unavailable=[],comparison=new Set(),offerSelection=null,expiryTimer,disposed=false,controller;
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
 const destination=()=>$('#shopping-destination')?.value||'KR';
 const fresh=(p,now=Date.now())=>p?.sourceVerified===true&&p.checkedAt<=now&&p.expiresAt>now;
 const stockLabel=p=>I.t(p.stock==='in_stock'?'재고 있음':p.stock==='out_of_stock'?'품절':'재고 미확인');
 const amount=(value,currency)=>Number.isFinite(value)?value.toLocaleString(I.locale)+' '+currency:I.t('미확인');
 const commercial=p=>{const c=p.commercial;if(!c)return I.t('광고·제휴 정보 미확인');return [c.sponsored?I.t('광고'):null,c.affiliate?I.t('제휴 링크'):null,c.label||null].filter(Boolean).join(' · ')||I.t('광고·제휴 표시 없음 · 등록 자료 기준');};
 const purchaseConditions=p=>{const value=p.purchaseConditions;return typeof value==='string'&&value.trim()?value:Array.isArray(value)&&value.length?value.filter(v=>typeof v==='string').join(' · ')||I.t('구매 조건 미확인'):I.t(p.purchaseConditionsVerified===true?'추가 구매 조건 없음 · 자료 확인':'구매 조건 미확인');};
 const offerReasons={purchase_conditions_unknown:'구매 조건 미확인',price_unknown:'가격 미확인',stale:'확인 시각 만료',different_currency:'다른 통화 · 환산 안 함',delivery_unconfirmed:'배송 가능 여부 미확인',cost_destination_unknown:'해당 배송지 비용 미확인',shipping_unknown:'배송비 미확인',tax_unknown:'세금 미확인',duties_unknown:'관세 미확인',out_of_stock:'품절',stock_unknown:'재고 미확인',conditional_purchase:'조건부 구매 · 조건 확인 필요',conflicting_updates:'동시 갱신 정보 충돌'};
 function clearProductUI(){$('#shopping-catalog-status').textContent='';matches=[];sponsored=[];unavailable=[];comparison.clear();offerSelection=null;for(const id of ['shopping-products','shopping-sponsored','shopping-unavailable','shopping-comparison','shopping-offer-comparison'])$('#'+id)?.replaceChildren();if($('#shopping-sponsored'))$('#shopping-sponsored').hidden=true;}
 function renderComparison(){const target=$('#shopping-comparison');target.replaceChildren();const rows=matches.filter(r=>comparison.has(r.product.id));if(!rows.length)return;
  target.append(node('h3',I.t('선택 후보 비교 · 같은 상품 가격 비교와 다릅니다.')));
  const table=node('table'),head=node('tr');for(const label of ['상품','판매자','상품 가격','사이즈','마지막 확인','조건 일치 점수'])head.append(node('th',I.t(label)));table.append(head);
  for(const row of rows){const p=row.product,tr=node('tr');for(const v of [p.name+' / '+p.brand,p.retailerName,money(p),(p.offerSize?[p.offerSize,p.sizeSystem].filter(Boolean).join(' / '):p.sizes.join(', '))||I.t('사이즈표 미제공'),new Date(p.checkedAt).toLocaleString(I.locale),String(row.score)])tr.append(node('td',v));table.append(tr);}target.append(table);for(const row of rows){const item=node('div');item.append(node('h4',row.product.name));chart(item,row.product);target.append(item);}target.append(node('p',I.t('상품 금액만 비교하며 배송·세금은 별도 확인이 필요합니다. 착용감·사이즈를 보장하지 않습니다.')));
 }
 function renderOfferComparison(){const target=$('#shopping-offer-comparison');if(!target)return;target.replaceChildren();if(!offerSelection||invalidQuery)return;
  const selected=catalog.products.find(p=>p.id===offerSelection);if(!selected)return;
  let report;try{report=O.compare(catalog.products,selected,{destination:destination(),currency:$('#shopping-currency').value,now:Date.now()});}catch{target.append(node('p',I.t('비교 정보를 확인하지 못했습니다. 조건을 수정하거나 다시 검색해주세요.')));return;}
  target.append(node('h3',I.t('같은 상품·같은 옵션의 판매처별 비교')),node('p',selected.name+' · '+selected.brand),node('p',I.t('선택한 배송 국가')+': '+destination()+' · '+I.t('비교 통화')+': '+$('#shopping-currency').value),node('p',I.t('GTIN 또는 제조사 품번과 브랜드·색상·사이즈·규격·상태가 확인된 동일 옵션만 묶습니다.')));
  if(report.status!=='exact_variant'){target.append(node('p',I.t('동일 상품 식별 정보 미확인')));return;}
  if(report.lowestOfferId&&Number.isFinite(report.minimumAmount))target.append(node('p',I.t('확인된 비교 대상 내 예상 합계 {amount} · 전체 시장 최저가가 아닙니다.',{amount:amount(report.minimumAmount,$('#shopping-currency').value)})));
  else target.append(node('p',I.t('합계 비교 조건을 충족하는 서로 다른 판매처 2곳 이상이 없어 최저 합계를 표시하지 않습니다.')));
  target.append(node('p',I.t('비교표를 가로로 밀면 사이즈·확인 시각·구매 조건·출처를 볼 수 있습니다.')));
  const table=node('table'),head=node('tr');for(const label of ['판매자','상품 가격','배송비','세금','관세','예상 합계','통화','상태','사이즈','마지막 확인','구매 조건','광고·제휴','주의·확인 사항','구매 링크','자료 출처'])head.append(node('th',I.t(label)));table.append(head);
  for(const p of report.rows){const tr=node('tr');tr.dataset.offerId=p.id;tr.dataset.offerEligible=String(p.eligible);if(report.lowestOfferId===p.id)tr.dataset.offerLowest='true';
   const cell=(field,text)=>{const td=node('td',text);td.dataset.offerField=field;tr.append(td);return td;};
   cell('seller',p.retailerName);cell('price',amount(p.price,p.currency));for(const field of ['shipping','tax','duties'])cell(field,amount(p[field],p.currency));
   const total=cell('total',amount(p.total,p.currency));if(report.lowestOfferId===p.id)total.append(node('strong',I.t('확인된 비교 대상 내 예상 합계')));
   cell('currency',p.currency);cell('stock',stockLabel(p));cell('size',[p.offerSize,p.sizeSystem,p.condition==='new'?I.t('새 상품'):p.condition==='used'?I.t('중고'):I.t('미확인')].filter(Boolean).join(' / '));cell('checkedAt',new Date(p.checkedAt).toLocaleString(I.locale));cell('conditions',purchaseConditions(p));cell('commercial',commercial(p));
   cell('reasons',p.reasons.map(reason=>I.t(offerReasons[reason]||'미확인')).join(' · '));const buy=cell('buy','');
   if(p.stock==='in_stock'&&fresh(p)&&!p.reasons.includes('stale')&&C.safeUrl(p.productUrl)){const a=node('a',I.t('상품 페이지 열기'));a.href=p.productUrl;a.dataset.offerBuy=p.id;a.rel=(p.commercial?.sponsored||p.commercial?.affiliate?'sponsored ':'')+'noopener noreferrer';a.referrerPolicy='no-referrer';buy.append(a);if(p.commercial?.sponsored||p.commercial?.affiliate)buy.append(node('small',commercial(p)));}else buy.append(node('span',I.t('구매 불가 · 재고 또는 확인 시각 점검 필요')));
   const source=cell('source','');if(fresh(p)&&C.safeUrl(p.sourceUrl)){const a=node('a',I.t('자료 출처'));a.href=p.sourceUrl;a.dataset.catalogSource=p.id;a.rel='noopener noreferrer';a.referrerPolicy='no-referrer';source.append(a);}else source.append(node('span',I.t('확인 시각 만료')));table.append(tr);
  }
  if(!report.rows.length)target.append(node('p',I.t('비교 대상 없음')));else target.append(table);
  target.append(node('p',I.t('미확인 비용을 0으로 계산하지 않으며 통화 환산을 하지 않습니다. 최종 결제 금액과 반품·배송 조건은 판매처에서 확인하세요.')));
 }
 function card(row,kind='organic'){
  const p=row.product||row,article=node('article');article.dataset.catalogId=p.id;article.className='catalog-card';article.dataset.catalogKind=kind;
  if(kind==='sponsored')article.append(node('p',I.t('광고')+' · '+commercial(p)));
  const image=node('img');image.src=p.imageUrl;image.alt=p.name;image.referrerPolicy='no-referrer';image.loading='lazy';image.addEventListener('error',()=>{if(!article.querySelector('[data-image-error]')){const text=node('p',I.t('상품 이미지가 열리지 않습니다. 판매처 상품 페이지에서 확인해주세요.'));text.dataset.imageError='';article.append(text);}});
  article.append(image,node('h3',p.name),node('p',p.brand+' · '+p.retailerName),node('p',money(p)),node('p',p.category+' · '+p.color+' · '+I.t('사이즈')+': '+(p.sizes.join(', ')||I.t('사이즈 정보 미확인'))),node('p',stockLabel(p)));
  article.append(node('p',I.t(p.offerSize&&p.sizeSystem&&p.condition?'확인된 가격 옵션':'가격 옵션 정보 미확인')+': '+([p.offerSize,p.sizeSystem,p.condition==='new'?I.t('새 상품'):p.condition==='used'?I.t('중고'):I.t('미확인')].filter(Boolean).join(' / ')||I.t('미확인'))));
  if(kind!=='unavailable'){
   article.append(node('p',I.t('조건 일치 점수')+': '+row.score+'/100'));const reasons=node('ul');for(const code of row.reasons||[]){if(code==='within_budget'&&conditions?.budget==null)continue;reasons.append(node('li',I.t(labels[code]||'미확인')));}article.append(node('h4',I.t('추천 이유')),reasons,node('p',I.t('상품 금액만 비교하며 배송·세금은 별도 확인이 필요합니다. 착용감·사이즈를 보장하지 않습니다.')));
   for(const code of row.warnings||[]){const warning={size_unknown:'사이즈 정보 미확인',occasion_unknown:'용도 정보 미확인',photo_ratios_not_measurements:'사진 비율은 실제 신체 치수가 아닙니다.'}[code];if(warning)article.append(node('p',I.t(warning)));}chart(article,p);
  }
  article.append(node('p',I.t('마지막 확인')+': '+new Date(p.checkedAt).toLocaleString(I.locale)),node('p',I.t('이용 허락')+': '+I.t('공개 표시 허가 확인')));
  if(p.commercial?.affiliate)article.append(node('p',I.t('제휴 링크')+' · '+I.t('제휴 링크를 통한 클릭·구매로 수수료가 발생할 수 있습니다.')+' '+(p.commercial.label||'')));
  for(const [key,url,label]of [['buy',p.productUrl,I.t('상품 페이지 열기')],['source',p.sourceUrl,I.t('자료 출처')]]){if(key==='buy'&&(p.stock!=='in_stock'||!fresh(p)))continue;const a=node('a',label);a.href=url;a.rel='noopener noreferrer';a.referrerPolicy='no-referrer';if(key==='buy'){a.dataset.catalogBuy=p.id;if(p.commercial?.sponsored||p.commercial?.affiliate)a.rel='sponsored noopener noreferrer';}else a.dataset.catalogSource=p.id;article.append(a);}
  if(kind==='organic'){const compare=node('button',I.t(comparison.has(p.id)?'비교에서 제외':'비교에 추가'));compare.type='button';compare.dataset.catalogCompare=p.id;compare.setAttribute('aria-pressed',String(comparison.has(p.id)));compare.addEventListener('click',()=>{if(comparison.has(p.id))comparison.delete(p.id);else if(comparison.size<4)comparison.add(p.id);renderCatalog();});article.append(compare);}
  if(O.identity(p)){const compare=node('button',I.t('판매처별 같은 상품 비교'));compare.type='button';compare.dataset.offerCompare=p.id;compare.addEventListener('click',()=>{offerSelection=p.id;renderOfferComparison();const target=$('#shopping-offer-comparison');if(target){const html=document.documentElement,old=html.style.scrollBehavior;html.style.scrollBehavior='auto';const offset=(document.querySelector('body>header')?.getBoundingClientRect().height||0)+16;window.scrollTo(0,Math.max(0,scrollY+target.getBoundingClientRect().top-offset));target.setAttribute('tabindex','-1');target.focus({preventScroll:true});html.style.scrollBehavior=old;}});article.append(compare);}else article.append(node('p',I.t('동일 상품 식별 정보 미확인')));
  return article;
 }
 function renderCatalog(){
  for(const id of ['shopping-products','shopping-sponsored','shopping-unavailable'])$('#'+id)?.replaceChildren();$('#shopping-catalog-retry').hidden=catalogState!=='error';
  if(catalogState!=='ready'){clearProductUI();tx('#shopping-catalog-status',catalogState==='error'?'상품 자료를 확인하지 못했습니다. 다시 확인하거나 공식 검색을 이용해주세요.':'등록 상품 자료를 확인하고 있습니다.');return;}
  const now=Date.now();let registered;try{registered=C.validateSnapshot(catalog,now);}catch{clearProductUI();tx('#shopping-catalog-status','상품 자료를 확인하지 못했습니다. 다시 확인하거나 공식 검색을 이용해주세요.');return;}
  if(!registered.length){clearProductUI();tx('#shopping-catalog-status','현재 검증된 실제 상품 0개 · 아래는 상품 목록이 아닌 공식 쇼핑몰 검색 대안입니다.');return;}
  if(invalidQuery){clearProductUI();I.setText($('#shopping-catalog-status'),'등록 판매 정보 {total}개 · 일반 조건 일치 {count}개 · 광고 {sponsored}개 · 품절·재고 미확인 {unavailable}개',{total:registered.length,count:0,sponsored:0,unavailable:0});return;}
  try{const c=conditions||{...Q.parse('의류'),currency:$('#shopping-currency').value};const result=C.search(catalog,c,{size:$('#shopping-size').value,query:conditions?$('#shopping-query').value:'',bodyConsent:$('#shopping-analysis-consent').checked,metrics,now});matches=result.organic?.matches||result.matches||[];sponsored=result.sponsored?.matches||result.sponsored||[];unavailable=result.unavailable||[];
   for(const v of Object.values(measurements()))if(v!==''&&(!Number.isFinite(Number(v))||Number(v)<=0||Number(v)>300))throw Error('measurements');
  }catch{clearProductUI();tx('#shopping-query-status','사이즈와 직접 입력 치수를 확인해주세요.');return;}
  I.setText($('#shopping-catalog-status'),'등록 판매 정보 {total}개 · 일반 조건 일치 {count}개 · 광고 {sponsored}개 · 품절·재고 미확인 {unavailable}개',{total:registered.length,count:matches.length,sponsored:sponsored.length,unavailable:unavailable.length});
  comparison=new Set([...comparison].filter(id=>matches.some(r=>r.product.id===id)));
  if(offerSelection&&!registered.some(p=>p.id===offerSelection))offerSelection=null;
  const target=$('#shopping-products');if(!matches.length)target.append(node('p',I.t('조건에 맞는 상품이 없습니다. 통화·예산·카테고리·색상·사이즈를 확인하거나 공식 검색을 이용하세요.')));for(const row of matches)target.append(card(row));
  const paid=$('#shopping-sponsored');if(paid)paid.hidden=!sponsored.length;if(paid&&sponsored.length){paid.append(node('h3',I.t('광고 · 일반 검색 결과와 별도')),node('p',I.t('광고는 별도 영역에 표시하며 일반 추천 순위에 섞지 않습니다.')));for(const row of sponsored)paid.append(card(row,'sponsored'));}
  const unavailableTarget=$('#shopping-unavailable');if(unavailableTarget&&unavailable.length){unavailableTarget.append(node('h3',I.t('품절·재고 미확인 자료 · 구매 추천 제외')));for(const row of unavailable)unavailableTarget.append(card(row,'unavailable'));}
  renderComparison();renderOfferComparison();
 }
 function scheduleExpiry(){clearTimeout(expiryTimer);const now=Date.now(),next=Math.min(...catalog.products.flatMap(p=>[p.expiresAt,p.checkedAt+86400000]).filter(t=>t>now));if(Number.isFinite(next))expiryTimer=setTimeout(()=>{if(!disposed){$('#shopping-style-advice').replaceChildren();renderCatalog();scheduleExpiry();}},Math.max(1,Math.min(2147483647,next-now+1)));}
 async function loadCatalog(){catalogState='loading';renderCatalog();controller?.abort();controller=new AbortController();const active=controller,timer=setTimeout(()=>active.abort(),10000);
  try{const r=await fetch('/assets/approved-products.json',{credentials:'omit',cache:'no-store',redirect:'error',signal:active.signal});if(!r.ok||!/application\/json/i.test(r.headers.get('content-type')||''))throw Error('catalog_response');const text=await r.text();if(text.length>1000000)throw Error('catalog_size');const data=JSON.parse(text);C.validateSnapshot(data);if(disposed||controller!==active)return;catalog=data;catalogState='ready';
   scheduleExpiry();
  }catch{if(disposed||controller!==active)return;catalog={version:1,generatedAt:null,products:[]};catalogState='error';clearProductUI();}finally{clearTimeout(timer);if(!disposed&&controller===active)renderCatalog();}
 }
 $('#shopping-catalog-retry').addEventListener('click',loadCatalog);
 $('#shopping-product-filters').addEventListener('input',()=>{$('#shopping-style-advice').replaceChildren();if(conditions){try{const parsed=Q.parse($('#shopping-query').value);if(parsed.budget!==null&&$('#shopping-currency').value!=='KRW')throw Error('currency');conditions={...parsed,currency:$('#shopping-currency').value};invalidQuery=false;}catch{tx('#shopping-query-status','원화 예산은 KRW에서 검색해주세요. 통화를 바꿀 때 임의 환산하지 않습니다.');conditions=null;invalidQuery=true;clearProductUI();render();$('#shopping-style-advice').replaceChildren();return;}}render();renderCatalog();});

 const render=()=>{const target=$('#shopping-search-results'),interpreted=$('#shopping-interpreted');target.replaceChildren();interpreted.replaceChildren();interpreted.hidden=!conditions;if(!conditions)return;
  interpreted.append(node('h2',I.t('해석한 검색 조건')));const description=Q.describe(conditions,I.language),list=node('dl');for(const [key,label]of [['kind','의류 종류'],['color','색상'],['fit','핏'],['purpose','용도'],['collection','컬렉션']]){const group=node('div');group.append(node('dt',I.t(label)),node('dd',description[key]));list.append(group);}const budgetGroup=node('div');budgetGroup.append(node('dt',I.t('예산')),node('dd',conditions.budget===null?I.t('예산 미지정'):conditions.budget.toLocaleString(I.locale)+' KRW'));list.append(budgetGroup);interpreted.append(list);
  const phrase=node('p',I.t('선택한 검색어')+': '+Q.term(conditions,I.language));target.append(phrase);
  const budget=node('p',I.t('예산')+': '+(conditions.budget===null?I.t('예산 미지정'):conditions.budget.toLocaleString(I.locale)+' KRW'));target.append(budget);
  const warning=node('p');I.setText(warning,'선택한 예산이 판매처 검색에 자동 적용되지는 않습니다.');target.append(warning);
  for(const row of Q.links(conditions)){const actions=P.retailerActions(row);actions.querySelectorAll('.preview-safari-help').forEach(n=>n.remove());target.append(actions);}
 };
 function search(){$('#shopping-style-advice').replaceChildren();try{conditions=Q.parse($('#shopping-query').value);if(conditions.budget!==null&&$('#shopping-currency').value!=='KRW')throw Error('currency');conditions={...conditions,currency:$('#shopping-currency').value};invalidQuery=false;render();renderCatalog();tx('#shopping-query-status','검색어를 준비했습니다. 아래 공식 검색 버튼을 직접 눌러주세요.');return true;}catch(error){conditions=null;invalidQuery=true;render();renderCatalog();tx('#shopping-query-status',error.message==='unsupported_exclusion'?'제외 조건은 아직 해석하지 않습니다. 원하는 색상·핏만 입력해주세요.':error.message==='currency'?'원화 예산은 KRW에서 검색해주세요. 통화를 바꿀 때 임의 환산하지 않습니다.':/budget/.test(error.message)?'예산은 ‘5만원 이하’처럼 상한 금액 하나로 입력해주세요.':'짧은 의류 조건만 입력해주세요. 연락처·이메일·사진·링크는 입력하지 마세요.');return false;}}
 function advice(){if(!search())return;const consent=$('#shopping-analysis-consent').checked;if(consent&&!metrics){tx('#shopping-query-status','체형을 참고하려면 먼저 사진을 분석해주세요.');return;}
  const message=Q.term(conditions,'ko')+(conditions.budget!==null?' '+conditions.budget+'원 이하':'');
  const answer=P.consult({message,language:I.language,intent:'style',preferences:{destination:destination(),category:conditions.category},consents:{analysis:consent},...(consent?{metrics}:{})});
  const target=$('#shopping-style-advice');target.replaceChildren();const title=node('p');I.setText(title,'규칙 기반 무료 스타일 상담 · 생성형 AI/GPT 호출 없음');target.append(title);for(const a of answer.advice)target.append(node('p',a.text));
  if(consent){const ideas=Q.bodySuggestions(conditions,{metrics,consent:true}),section=node('section');section.id='shopping-body-suggestions';section.append(node('h3',I.t('체형 참고 검색 제안 · 실제 상품 목록 아님')),node('p',I.t('선택하면 표시된 의류 검색어를 적용합니다. 판매처 이동은 공식 검색 버튼을 직접 누를 때만 실행하며 사진·신체 수치는 보내지 않습니다.')));
   const reasons={shoulder_balance:'사진의 어깨·골반 기준점 비율을 참고해 단정한 상의와 여유 있는 하의 조합을 비교해보세요.',light_layers:'사진상 비율을 참고해 가벼운 상의 레이어와 일자 하의 조합을 비교해보세요.',balanced_lengths:'사진상 비율을 참고해 상의 끝선과 바지 길이가 다른 조합을 비교해보세요.'};
   for(const idea of ideas){const item=node('article'),button=node('button',I.t('이 조건으로 옷 찾기'));button.type='button';button.dataset.bodySearch='';item.append(node('h4',Q.term(idea.conditions,I.language)),node('p',I.t(reasons[idea.reason])),node('p',I.t('사진 한 장으로 치수나 맞는 사이즈를 판정하지 않습니다. 실제 상품 실측·소재·반품 조건을 확인하세요.')));button.addEventListener('click',()=>{if(!$('#shopping-analysis-consent').checked||!metrics)return;if(bodyOriginalQuery===null)bodyOriginalQuery=$('#shopping-query').value;$('#shopping-query').value=Q.term(idea.conditions,'ko')+(idea.conditions.budget!==null?' '+idea.conditions.budget+'원 이하':'');search();$('#shopping-interpreted').scrollIntoView({block:'start'});});item.append(button);section.append(item);}target.append(section);
  }
  const note=node('p');I.setText(note,matches.length?'규칙 상담이 아래 등록 상품의 검색·추천·비교 결과에 연결됐습니다. 생성형 AI는 호출하지 않습니다.':'상품 추천이 아닌 검색 준비와 스타일 조언입니다. 실제 상품 자료가 확보되면 개별 추천 이유·비교를 연결합니다.');if(matches.length){const links=node('ul');for(const row of matches.slice(0,3)){const item=node('li'),a=node('a',row.product.name);a.href='#shopping-products';a.dataset.catalogAdvice=row.product.id;item.append(a);links.append(item);}target.append(links);}target.append(note);
 }
 root.addEventListener('click',e=>{const productLink=e.target.closest('[data-catalog-buy],[data-catalog-source],[data-offer-buy]');if(productLink){const isBuy=Boolean(productLink.dataset.catalogBuy||productLink.dataset.offerBuy),id=productLink.dataset.catalogBuy||productLink.dataset.catalogSource||productLink.dataset.offerBuy,p=catalog.products.find(p=>p.id===id),expected=isBuy?p?.productUrl:p?.sourceUrl;if(!e.isTrusted||!p||!fresh(p)||isBuy&&p.stock!=='in_stock'||!C.safeUrl(expected)||productLink.href!==new URL(expected).href){e.preventDefault();renderCatalog();}return;}const a=e.target.closest('#shopping-search-results a');if(a&&(!e.isTrusted||!P.safeLink(a.href))){e.preventDefault();tx('#shopping-query-status','짧은 의류 조건만 입력해주세요. 연락처·이메일·사진·링크는 입력하지 마세요.');}});
 $('#shopping-search-form').addEventListener('submit',e=>{e.preventDefault();search();});$('#shopping-style-button').addEventListener('click',advice);
 const restoreBodyQuery=()=>{if(bodyOriginalQuery!==null){const original=bodyOriginalQuery;bodyOriginalQuery=null;if(!disposed){$('#shopping-query').value=original;search();}}};
 $('#shopping-query').addEventListener('input',()=>{bodyOriginalQuery=null;});
 document.addEventListener('a1:analysis-ready',e=>{if(P.validMetrics(e.detail?.metrics)){metrics={...e.detail.metrics};$('#shopping-analysis-consent').disabled=false;$('#shopping-analysis-consent').checked=false;restoreBodyQuery();$('#shopping-style-advice').replaceChildren();renderCatalog();const result=document.querySelector('#ai-result .ai-result-copy');if(!$('#shopping-return')){const link=node('a');link.id='shopping-return';link.href='#shopping-analysis-consent';I.setText(link,'체형 분석을 참고해 옷 찾기');result.append(link);}}});
 const clear=()=>{metrics=null;$('#shopping-analysis-consent').checked=false;$('#shopping-analysis-consent').disabled=true;$('#shopping-style-advice').replaceChildren();comparison.clear();offerSelection=null;$('#shopping-size').value='';for(const k of ['chest','waist','hips','inseam'])$('#shopping-measure-'+k).value='';restoreBodyQuery();if(!disposed)renderCatalog();};
 document.addEventListener('a1:analysis-cleared',clear);$('#shopping-analysis-consent').addEventListener('change',()=>{$('#shopping-style-advice').replaceChildren();if(!$('#shopping-analysis-consent').checked)restoreBodyQuery();renderCatalog();});
 document.addEventListener('a1:language-changed',()=>{render();renderCatalog();if($('#shopping-style-advice').children.length)advice();});
 loadCatalog();
 window.addEventListener('pagehide',()=>{disposed=true;controller?.abort();clearTimeout(expiryTimer);clear();conditions=null;$('#shopping-query').value='';$('#shopping-search-results').replaceChildren();$('#shopping-interpreted').replaceChildren();$('#shopping-interpreted').hidden=true;});
})();
