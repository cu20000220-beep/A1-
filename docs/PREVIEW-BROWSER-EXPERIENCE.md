# Preview 브라우저 내 추천·상담·쇼핑 이동 검증

기준: 통합 `bf40968`, 작업 브랜치 `fix/preview-browser-experience`. 기존 개발·PR #2 병합을 다시 수행하지 않았습니다.

## 원인과 수정

기존 공개 Preview는 `/api/*`를 503 `preview_isolated`로 차단하지만 추천/검색/상담 버튼은 서버 API를 요청했습니다. 이 차단은 의도된 개인정보 보호이며 그대로 유지합니다.
새 공개 브라우저 모듈은 **정확히 한 단계의 `*.a1fashion.pages.dev` 호스트**에서만 설치됩니다. Production·localhost·유사 도메인에서는 설치되지 않습니다. 실패한 API 응답을 보고 권한을 우회하는 fallback이 아닙니다.

- 사진 분석 완료 후 일반 코디 예시 3개와 의류 검색어/판매처 링크를 브라우저 안에서 표시합니다. 상품·가격·할인·재고를 만들어내지 않습니다.
- 두 비율에 따른 제안은 기본 해제된 별도 동의 이후에만 사용합니다. 동의를 철회하거나 분석을 삭제하면 파생 결과와 비율·동의를 지웁니다.
- 스타일리스트는 팝업 없이 현재 탭에서 열립니다. 수치 없이도 일반 DEMO로 이동할 수 있습니다.
- 수치 전달에 따로 동의했을 때만 두 비율·출처·생성/만료 시각을 탭의 동일 출처 sessionStorage에 임시 저장합니다. URL에는 난수 nonce만 넣습니다. 사진·이름·계정·토큰·대화는 저장하지 않습니다.
- 대상은 원래 출처와 정확한 필드·유효 범위를 검증하고 1분 이내 1회 읽은 즉시 삭제합니다. 상담에서 실제 비율을 사용하려면 수신 화면의 사용 동의도 확인해야 합니다. 만료·위조·잘못된 출처는 거부하며, 저장소가 차단되면 수치 없는 이동 안내를 제공합니다.
- 전달한 소수 비율은 숫자 입력의 `step=any`로 받아 Safari의 기본 HTML 유효성 검사가 상담 제출을 막지 않도록 했습니다.
- 상담은 간단한 규칙과 공개 문구만 사용합니다. API·회원·DB·GPT·상품 피드·결제·발송은 연결하지 않습니다.
- Production의 서버 권한 검사·계정 소유권 코드·운영 변수와 Preview 미들웨어는 변경하지 않았습니다.

## 판매처 이동과 Safari 대안

직접 클릭한 HTTPS 공식 검색·공식 홈으로만 현재 탭에서 이동합니다. 허용 도메인·검색 경로·쿼리 키를 검증하고 사용자 정보·사진·체형 비율은 포함하지 않습니다. 임의 리디렉션/수집 URL은 사용하지 않습니다. `noreferrer`와 `no-referrer`로 원래 페이지 주소를 전달하지 않습니다.

네이버는 `https://search.shopping.naver.com/search/all?query=셔츠`, 쿠팡은 `https://www.coupang.com/np/search?q=셔츠` 형태입니다. URLSearchParams가 UTF-8로 한 번만 인코딩하며, 테스트에서 복호화 값이 원래 검색어와 같고 `%25` 이중 인코딩이 없음을 확인했습니다.

Preview 검색 링크에는 의류 카테고리의 고정 검색어만 사용합니다. 자유 입력 글·브랜드·사이즈·예산·사진·비율은 판매처로 전달하지 않습니다. 해당 자유 입력 필드는 Preview에서 비활성 안내합니다.
검색어 복사·검색 주소 복사·공식 홈 버튼을 함께 제공합니다. 네이버 공식 홈은 검색 하위 도메인의 루트가 아닌 `https://shopping.naver.com/`, 쿠팡은 `https://www.coupang.com/`를 사용합니다. 앱 내부 브라우저가 제한되면 공유 메뉴에 Safari 열기가 있는지 확인하거나, 주소를 복사해 Safari 주소창에 직접 붙여넣을 수 있습니다. 자동 복사가 거부되면 선택 가능한 텍스트와 수동 복사 안내를 표시합니다. 비공개 URL scheme·앱 강제 열기·CAPTCHA/봇 방어 우회는 없습니다.

**사용자 제공 관찰:** ChatGPT 내부 브라우저에서 네이버쇼핑의 일시 제한·쿠팡의 접근 거부가 발생했습니다. 실제 iPad Safari 앱의 두 공식 홈페이지는 정상입니다. Safari의 **검색 결과 페이지** 성공은 아직 확인되지 않았습니다. 홈페이지 성공을 검색 성공으로 기록하지 않습니다.

## 판매처별 실제 네트워크 점검

이번 Codex 환경에서는 아래 모두 TLS 터널 이전의 환경 프록시 CONNECT 403으로 막혔습니다. 따라서 판매처 자체의 HTTP 차단·CAPTCHA·실제 리디렉션이나 Safari 검색 결과를 확인했다고 주장하지 않습니다. 별도 우회 접속은 시도하지 않았습니다.

| 판매처 | 변경 후 공식 검색 주소 | 실제 조회 결과 |
| --- | --- | --- |
| Coupang | [공식 검색](https://www.coupang.com/np/search?q=clothing) | 환경 프록시 CONNECT 403; 판매처 응답·리디렉션 미확인 |
| Naver Shopping | [공식 검색](https://search.shopping.naver.com/search/all?query=clothing) | 환경 프록시 CONNECT 403; 판매처 응답·리디렉션 미확인 |
| eBay US | [공식 검색](https://www.ebay.com/sch/i.html?_nkw=clothing) | 환경 프록시 CONNECT 403; 판매처 응답·리디렉션 미확인 |
| Amazon US | [공식 검색](https://www.amazon.com/s?k=clothing) | 환경 프록시 CONNECT 403; 판매처 응답·리디렉션 미확인 |
| Amazon Japan | [공식 검색](https://www.amazon.co.jp/s?k=clothing) | 환경 프록시 CONNECT 403; 판매처 응답·리디렉션 미확인 |
| Rakuten Japan | [공식 검색](https://search.rakuten.co.jp/search/mall/clothing/) | 환경 프록시 CONNECT 403; 판매처 응답·리디렉션 미확인 |
| eBay UK | [공식 검색](https://www.ebay.co.uk/sch/i.html?_nkw=clothing) | 환경 프록시 CONNECT 403; 판매처 응답·리디렉션 미확인 |
| Amazon UK | [공식 검색](https://www.amazon.co.uk/s?k=clothing) | 환경 프록시 CONNECT 403; 판매처 응답·리디렉션 미확인 |
| Amazon Germany | [공식 검색](https://www.amazon.de/s?k=clothing) | 환경 프록시 CONNECT 403; 판매처 응답·리디렉션 미확인 |
| eBay Germany | [공식 검색](https://www.ebay.de/sch/i.html?_nkw=clothing) | 환경 프록시 CONNECT 403; 판매처 응답·리디렉션 미확인 |
| Zalando | [공식 검색](https://www.zalando.de/catalog/?q=clothing) | 환경 프록시 CONNECT 403; 판매처 응답·리디렉션 미확인 |

[원시 조회 결과](validation/preview-browser/retailer-probes.json). 네이버·쿠팡의 새 Preview 버튼은 실제 iPad Safari에서 검색 결과 화면까지 추가 확인해야 합니다.

## 자동 검증

- Node 전체 회귀 **227개 통과**: 기존 유료 권한·회원 데이터 격리·베타 정책·Preview 보호와 신규 호스트/링크/동의 검사 포함.
- 브라우저 KO/EN × 390/820px: 사진 준비→분석→예시 목록→명시적 동의→현재 탭 수치 전달→DEMO 상담→판매처 클릭 전환을 검사합니다. 브라우저 테스트는 실제 UI와 로컬 이미지·고정 자세 입력을 사용하며 외부 판매처 응답은 fixture입니다. 실제 판매처 접속 성공과 구분합니다.
- 검색 URL UTF-8, 검색어·주소 복사, 클립보드 거부 시 수동 복사, 허용하지 않은 링크 차단, 외부 이동 시 referrer 없음과 새 창 없음, 체형 데이터 비전송을 검사합니다.
- 모든 Preview UI API 호출 **0건**을 확인하고, 동일 파일을 Production 호스트에서 열면 기존 서버 membership 호출과 잠금이 유지되는지 검사합니다.
- 실제 iPad Safari 엔진 검증은 이 환경에서 수행하지 못했습니다. 수정 후 실제 기기 재확인은 별도 필요합니다.

스크린샷: [코디 KO](validation/preview-browser/styles-ko-390.png), [코디 EN](validation/preview-browser/styles-en-390.png), [네이버·쿠팡 KO](validation/preview-browser/korean-retailers-ko-390.png), [네이버·쿠팡 EN](validation/preview-browser/korean-retailers-en-390.png).

## 운영 상태

main 병합·Production 배포·Cloudflare 운영 설정·Firebase·운영 DB·기존 회원/구독 기록은 변경하지 않습니다. 새 Preview는 개발 브랜치에서만 빌드하며 최종 실제 URL·커밋·원격 확인 결과는 후속 PR과 완료 보고에 기록합니다.
