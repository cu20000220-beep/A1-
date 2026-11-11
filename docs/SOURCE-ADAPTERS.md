# 공식/제휴/브랜드 상품 자료의 오프라인 어댑터

## 상태와 범위

현재 등록 상품 수와 별개로, 승인받은 파일 형식을 기존 상품 검증 파이프라인에 연결하기 위한 **오프라인 후보 정규화 계약**입니다. API·제휴 서비스의 실시간 연결이나 공급원 접근 승인이 완료된 것이 아닙니다. 네트워크 요청, 키 조회/발급, 가입, DB 읽기/쓰기, Production 배포, 상품 공개를 하지 않습니다.

`createSourceAdapter(kind, config)`는 다음 종류를 구분합니다.

| kind | 입력 | 역할 |
| --- | --- | --- |
| seller-file | canonical `products[]` JSON 또는 기존 CSV 양식 | 판매자가 제공한 승인 대상 파일 |
| brand-file | 동일 | 브랜드/권리자 제공 자료 |
| official-api | 운영자가 적법하게 확보한 JSON `items[]`와 명시적 필드 매핑 | 실제 API 전송 코드가 아닌 응답 자료 정규화 |
| affiliate-feed | 운영자가 적법하게 확보한 JSON `items[]` 또는 canonical CSV와 명시적 매핑 | 피드 계약/다운로드가 아닌 확보한 자료 정규화 |

공식/제휴 공급원의 JSON 구조를 자동 추측하지 않습니다. CSV는 기존 canonical CSV 파서를 재사용하므로, 다른 공급자 전용 열 이름의 CSV를 직접 해석하는 일반 크롤러가 아닙니다. 공급자 전용 자료는 검토된 전처리나 JSON `items[]` 변환이 필요합니다.

## 코드 계약

```js
const {createSourceAdapter} = require('./scripts/lib/source-adapters.cjs');
const adapter = createSourceAdapter(kind, {
  approvalId,      // 운영자가 검토하는 승인 ID
  sourceUrl,       // 비밀키 없는 고정 HTTPS 자료 출처
  mapping,         // canonical 대상 필드 -> 공급자 dotted path
  defaults        // 자료에서 확인하거나 운영자가 검토한 고정 값만
});
const result = adapter.prepare(payload); // normalize(payload)도 같은 계약
```

반환 형식:

```text
{
  sourceKind,
  candidates: { version: 1, products: [canonical 후보...] },
  candidateCount,
  registeredProducts: 0,
  approvalRequired: true,
  liveEnabled: false
}
```

`sourceKind`, `approvalId`, `sourceUrl`은 검토된 설정에서 고정합니다. 상품 파일의 같은 필드가 충돌하면 거부합니다. `permissionChecked`는 입력 상품의 true를 신뢰하지 않고 기본 false입니다. 운영자가 설정의 `defaults.permissionChecked=true`를 명시한 경우에도 이것은 후보의 검토 표시일 뿐이며, 후속 승인 manifest·원본 파일 SHA256·정규화 상품 digest 검사를 대체하지 않습니다. `sourceVerified`나 공개 등록 수는 생성하지 않습니다.

### 필드 매핑

공식/제휴 설정은 `name`, `price`, `imageUrl`, `purchaseUrl`의 경로를 반드시 명시해야 합니다. 예를 들어 `name: "item.title"`, `price: "item.price.amount"`처럼 공급자의 실제 자료와 일치하는 경로를 설정합니다. 이는 특정 API 응답이 이런 모양이라는 보장이 아니라 경로 표기법 설명입니다.

- `__proto__`, `constructor`, `prototype` 및 자격증명 경로는 거부합니다. 임의 코드·정규식·함수·템플릿 평가를 지원하지 않습니다.
- 대상 필드는 기존 상품 importer의 허용 필드로 제한합니다. 승인 ID·자료 출처·종류·허가 플래그는 mapping으로 덮어쓸 수 없습니다.
- 공급자가 제공한 숫자 문자열 가격만 제한적으로 숫자로 정규화합니다. 환율·통화·할인·배송비·세금·상품 동일성은 추측하지 않습니다.
- 상품명·브랜드·분류·색·가격·통화·판매처·구매/이미지 URL·확인 시각·재고·성별·명시적 사이즈 정보가 부족하면 후보를 출력하지 않습니다. `sizes: []`와 `kind: unknown` 사이즈표는 미제공으로 명시할 수 있으나 존재하지 않는 사이즈를 생성하지 않습니다.
- 재고는 `in_stock`·`out_of_stock`·`unknown`을 보존합니다. 공식/제휴 자료에서 확인하지 않은 재고를 설정 기본값으로 판매 중이라고 만들 수 없으며, 재고 미확인은 `unknown`으로 지정합니다.
- 마지막 확인 시각을 현재 시각으로 자동 채우지 않습니다. 공급자가 실제 제공한 값 또는 운영자가 확인한 값을 매핑/설정해야 합니다.
- 최종 통화 단위·실측 종류·승인된 도메인·출처·권리 유효기간·파일 해시는 기존 `import-product-catalog.cjs`에서 다시 검사합니다. 후보 준비가 최종 검증 완료를 뜻하지 않습니다.

## CLI: 비공개 후보 파일 준비

```bash
node scripts/prepare-source-products.cjs \
  --input /workspace/private/licensed-provider-payload.json \
  --config /workspace/private/reviewed-source-config.json \
  --output /workspace/private/product-candidates.json
```

설정 JSON은 `kind`, `approvalId`, `sourceUrl`, `mapping`, `defaults`만 허용합니다. 비밀키·토큰·외부 요청 설정을 넣지 않습니다. `.csv` 입력은 canonical CSV로 읽습니다.

출력은 새로운 비공개 후보 파일 `{version,products}`이며 파일 권한은 0600입니다. 입력과 설정은 크기 제한을 통과한 일반 파일만 허용합니다. 기존 파일 덮어쓰기와 `assets/`, `dist/` 및 그 경로로 연결되는 symlink 출력은 거부합니다. 표준 출력에는 종류/후보 수/등록 0개/승인 필요 상태만 쓰며 상품 내용·키·개인정보를 쓰지 않습니다. 실패도 원문 응답이나 파일 경로를 출력하지 않습니다.

다음 절차는 별도입니다.

1. 실제 공급원 접근·자료/이미지 표시권과 필요시 제휴 고지/추적권 검토.
2. 검토된 설정으로 후보 준비. 불완전한 discovery 자료는 보완 전 거부.
3. 후보의 실제 상품·이미지·가격·사이즈·URL·확인 시각을 운영자가 검토.
4. 후보 파일 SHA256과 정규화 digest를 승인 manifest에 고정.
5. 기존 importer로 승인된 스냅샷 생성·공개 산출물 검사·Preview 검증.
6. main/Production 적용은 기존 승인 절차와 별개이며 이번 작업에서 실행하지 않음.

## 기존 전송 어댑터와 공식 공급원 제약

- `server/adapters/ebay-browse.mjs`의 실제 전송은 기존 승인·약관·토큰 조건 뒤에 있습니다. 검색 요약은 discovery 후보이며 상품 가격·이미지·사이즈·동일 variant가 완성된 레코드가 아닙니다. 이 모듈을 추가했다고 활성화되지 않습니다. [eBay Browse 공식 안내](https://developer.ebay.com/api-docs/buy/api-browse.html), [운영 접근 조건](https://edp.ebay.com/api-docs/buy/buy-requirements.html)을 검토해야 합니다.
- `server/adapters/awin-feed.mjs`는 계속 disabled 계약입니다. Publisher/광고주별 피드 접근·현재 계정 조건·이미지 표시/보관·제휴 고지가 필요합니다. [Awin 공식 피드 안내](https://help.awin.com/developers/docs/product-feed-publisher-guide-intro).
- [네이버 공식 종료 공지](https://developers.naver.com/notice/article/32564)에 따라 기존 쇼핑 검색 API는 2026-07-31 종료됐습니다. API HUB 대체가 있다고 가정하거나 무단 수집으로 전환하지 않습니다.
- 브랜드/판매자 파일도 다운로드 가능하다는 사실만으로 표시·변형·AI 피팅 사용권이 있다고 판단하지 않습니다. 이미지 표시권과 AI/3D 변형권은 별도입니다.

공급원 4종의 이름을 지원하는 것은 4개 공급원과 계약/실시간 연결을 완료했다는 뜻이 아닙니다. 실제 자료·허가가 없으면 등록 수는 계속 0개이며 공식 검색 대안을 유지합니다.

## 검증

`tests/source-adapters.cjs`는 합성 자료를 임시 디렉터리에서만 사용합니다. 종류별 정규화, 허가 플래그 비승격, 명시적 경로, 불완전 자료·가격·URL·프로토타입 경로·출처 충돌·중복 거부, canonical CSV, 새 비공개 파일만 출력, 공개 경로/symlink 차단을 검사합니다. 실제 공급원 데이터 확보 증거가 아닙니다.
