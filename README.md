# A1 FASHION

공개 사이트: **https://a1fashion.pages.dev**

사진을 통한 체형 참고 분석은 무료입니다. 그 결과에 따른 의류 추천·외부 쇼핑몰 연결은 유료 구독자 전용으로 분리했습니다. **기간형 무료 체험은 제공하지 않습니다.** 월 구독료는 미정이며 결제·정기 청구는 아직 연결하지 않았습니다. 이메일 회원가입·로그인은 Firebase를 이용하며 소유자가 실제 가입·로그인 성공을 확인했습니다. 구독 설정이 없으면 추천 기능은 계속 잠깁니다.

## 한국어·영어

유료 번역 API 없이 준비한 한국어·영어 번역을 사이트 파일에 포함합니다. 한국어 브라우저는 한국어, 그 밖의 브라우저는 영어로 시작하며 상단 언어 선택에서 변경할 수 있습니다. 직접 선택한 언어는 브라우저의 `a1-fashion:language`에 보관합니다. 메인·회원·개인정보·출처 화면과 사진 분석 결과/오류를 번역하고, 전환 중 입력값·사진 결과를 유지합니다.

사진·비밀번호·사용자 입력을 번역 서비스로 보내지 않습니다. Firebase 인증 메일은 허용한 `ko`/`en` 언어를 요청하며, 실제 언어별 메일 수신은 운영 확인과 구분합니다. 구독자가 이미 요청한 추천의 언어를 바꾸면 같은 보호 API에서 권한을 다시 확인해 해당 언어의 자료를 받아옵니다. 비공개 상품 번역은 공개 정적 파일에 포함하지 않습니다.

화면 번역은 외부 쇼핑몰 자체의 번역·해외 배송·지역별 판매 가능 여부를 의미하지 않습니다. 기존 추천 카탈로그의 예시 가격은 KRW입니다. 글로벌 DEMO 가격 비교는 KRW/USD/EUR/GBP/JPY 표시와 출처·시각을 명시한 가상 환율을 시험하며 실제 환율 자동 연동은 제공하지 않습니다.

## 글로벌 확장 — 통합 검토용 변경

기존 사이트에 `global.html`을 추가하고 한국·미국·일본·영국·유럽 판매처 검색, 배송 목적지·통화·성별·브랜드·스타일·가격·사이즈 필터를 제공합니다. 검색 링크는 개별 상품 피드·해외 배송 확인이 아닙니다. 가격 필터의 실제 적용은 판매처 검색을 확인해야 합니다. 기존 AI 분석과 회원 계정을 새 프로젝트로 옮기거나 삭제하지 않습니다.

- **FREE:** 무료 분석, 회원 기능과 서비스 안내.
- **GENERAL:** 서버에서 검증된 유효 구독이 있을 때 스타일 추천, 국내·해외 쇼핑몰 검색과 관심 상품 저장.
- **PREMIUM:** GENERAL에 더해 동일 상품 가격 비교와 목표 가격·알림 설정. DEMO와 승인된 저장 상품 비교를 구분하며, 기본 상태는 DEMO이고 실제 자동 감시는 켜지지 않습니다.

기존 유효 유료 기록은 GENERAL로 대응하는 이전안을 제안하며 PREMIUM으로 자동 올리지 않습니다. 운영 D1 마이그레이션은 별도 승인이 필요합니다. `server/migrations/0001_membership_tiers.sql`, `0002_global_catalog_and_alerts.sql`, `0003_global_consent_context.sql`은 검토·로컬 테스트용이며 운영 DB에 자동 적용하지 않습니다. AI 사용량용 `0004_ai_stylist_usage.sql`은 글로벌 `0003` 다음 순서이며 별도 승인 전 적용하지 않습니다. 두 구독 등급의 월 가격은 미정입니다.

프리미엄 알림은 채널별 별도 마케팅 동의와 회원 소유 범위를 검사합니다. 이메일·SMS 템플릿 미리보기와 모의 기록만 생성합니다. **실제 발송, 정기결제, 유료 API, 운영 Cron은 비활성화**되어 있으며 키나 브라우저 값을 입력해 켤 수 없습니다. 회원 탈퇴는 재인증 후 자신의 글로벌 데이터를 먼저 삭제하며, 실패하면 Firebase 계정 삭제를 진행하지 않습니다.

후속 마무리는 기존 코드를 재사용해 진행했습니다. `products` API는 `ENABLE_LIVE_CATALOG=true`와 `GLOBAL_CATALOG_APPROVED=true`가 모두 승인된 경우에만 기존 D1의 검증된 공식 상품을 읽습니다. 이 값은 실제 피드 수집을 시작하거나 API/제휴 승인을 대신하지 않습니다. 기본값에서는 상품 DB 조회도 하지 않으며 상품을 만들어 표시하지 않습니다. 같은 통화로 확인된 가격만 합산하고 환율이 없으면 다른 통화의 총액을 추정하지 않습니다.

`simulate` API는 본인 관심 목록·목표 가격·브랜드·설정·채널별 동의에 따라 다섯 가지 DEMO 알림 조건을 평가하고 모의 이력을 중복 없이 저장합니다. 연락처를 읽거나 메일·문자를 보내지 않습니다. 새 동의는 당시 수신 국가·문안 언어·문안 버전을 보관하며, 과거 증빙이 없는 기록을 임의로 보완하지 않습니다. 통합 브랜치는 아래의 GPT 스타일리스트도 포함하며, 실제 GPT 호출은 기본 비활성입니다.

구현 범위·비용·공급자 승인·개인정보 및 실제 배포의 승인 순서는 [글로벌 운영 보고서](docs/GLOBAL-OPERATIONS.md), 공급자와 무료 한도 근거는 [공식 자료 조사](docs/GLOBAL-RESEARCH.md)에 정리합니다. 이번 작업은 기능 브랜치/PR 검토 대상이며 운영 배포나 운영 데이터 변경을 수행하지 않습니다.

중복 개발 없이 이어서 마무리한 범위와 최신 테스트·남은 승인은 [후속 완료 보고서](docs/GLOBAL-COMPLETION.md)에 정리했습니다.

글로벌 단독 단계의 최종 오류 수정·검증, Cloudflare 준비 사항·회원 영향과 당시 AI 후속 계획은 [배포 준비 검토서](docs/GLOBAL-RELEASE-REVIEW.md)를 참고하세요. main 병합·운영 배포·DB 적용은 각각 승인 전 실행하지 않습니다.

## A1 AI 스타일리스트 — 모의 운영 우선

`stylist.html`에 한국어·영어 스타일 상담 화면을 추가합니다. GENERAL은 스타일 상담과 상품 검색, PREMIUM은 검증된 동일 상품의 가격 비교와 유효 할인 추천 범위로 서버에서 다시 확인합니다. FREE, 만료·미납·환불 등 유효 구독이 없는 계정은 유료 상담 API를 이용할 수 없습니다. 기존 Firebase 회원·Cloudflare 프로젝트·기기 내 무료 분석은 그대로 유지합니다.

**기본은 실제 GPT 호출 없는 DEMO이며 API 키만 입력해도 실제 호출을 시작하지 않습니다.** 실제 운영에는 운영자의 별도 승인, 서버의 활성화 설정, 승인된 모델·확인한 토큰 요금, 사용자별 요청 한도, 전체 일/월 비용 상한과 D1 예약 기록이 필요합니다. 실패·시간 초과에 재시도를 붙이지 않으며 비용을 알 수 없는 실패는 예약 예산을 돌려주지 않습니다. 설정·키·DB가 없어도 기존 정적 무료 화면과 체형 분석은 계속 작동합니다.

사진·이미지·파일명·전체 기준점을 외부 AI로 보내는 기능은 제공하지 않습니다. 무료 분석 후 사용자가 버튼을 눌렀을 때만 비율 두 숫자를 A1 상담 창으로 메모리 메시지로 가져올 수 있습니다. 숫자는 URL·브라우저 저장소에 넣지 않습니다. 외부 AI로 대화를 보내는 동의와 수치 공유 동의는 상담 화면에서 각각 별도로 선택하며 자동 체크하지 않습니다. 원래 분석을 지우거나 원본 페이지를 떠나면 가져온 수치가 해제됩니다.

상담은 현재 화면 메모리에만 유지하며 A1 DB에 대화·분석값을 저장하지 않습니다. 로그아웃·페이지 이동·대화 지우기는 대화와 진행 중 요청을 정리합니다. 이용량·비용을 위한 내용 없는 집계는 별도입니다. OpenAI 요청의 `store:false`는 제공자의 모든 보안·부정 이용 방지 기록이 없어지는 약속이 아니므로 실제 운영 전에 보관·국외 처리·데이터 보호 조건을 확인해야 합니다.

상품명·가격·할인·판매 URL은 모델이 생성한 내용을 그대로 표시하지 않습니다. 승인된 실제 상품 기록을 검증한 뒤 서버가 표시 자료를 조립합니다. 공식 상품 피드가 연결되지 않았거나 자료가 오래되면 실제 상품 추천·할인으로 제시하지 않고 검색 링크와 데이터 준비 상태를 구분합니다. 원래의 12개 예시 카탈로그를 실제 GPT 상품 근거로 취급하지 않습니다. 현재 요금 확인 범위, 비용 계산과 운영 승인 순서는 [AI 운영 보고서](docs/AI-STYLIST-OPERATIONS.md)에 정리합니다.

현재 통합 브랜치의 결과·환경 분리·배포 및 복구 계획은 [통합 릴리스 보고서](docs/UNIFIED-RELEASE.md)에 정리합니다.

## 무료 분석

- Google MediaPipe의 실제 AI 모델이 사진에서 인체 기준점을 추정합니다. 어깨·골반·다리의 2D 간격으로 참고 지표를 계산하고 결과를 무료로 보여줍니다.
- 사진은 브라우저 안에서만 처리하며 서버로 전송하지 않습니다. 결과는 얼굴 영역을 제외한 캔버스에 표시합니다. 사진·기준점·분석 결과는 메모리에서 처리하고 지우기나 페이지 이동 시 정리합니다.
- 한 명이 정면으로 서서 어깨부터 발목까지 보이는 사진을 사용합니다. 낮은 신뢰도·잘린 신체·불안정한 구도에서는 결과를 만들지 않습니다. 카메라 각도·옷·자세의 한계가 남으며, 정확한 신체 치수·건강·체중·옷 사이즈를 판정하지 않습니다.
- 모델은 단일 인물용이며 여러 사람을 세거나 검증하지 않습니다. WebGL이 필요합니다. AI 의류 합성·가상 착용 기능은 아닙니다.

## 무료 회원가입과 로그인

Firebase Authentication을 이용한 이메일 가입·이메일 인증·로그인·로그아웃·비밀번호 재설정·회원탈퇴를 연결합니다. 운영에 필요한 값은 Cloudflare Pages의 `FIREBASE_PROJECT_ID`, `FIREBASE_WEB_API_KEY`입니다. 소유자가 Firebase 프로젝트와 인증 설정을 만들고 Cloudflare Production 변수 두 값을 저장했다고 확인했습니다. 배포 후 소유자가 실제 가입·로그인 성공을 확인했습니다. 테스트 공급자를 사용한 검증과 운영 사용자 확인을 구분합니다. iPad에서 할 수 있는 순서는 [Firebase 설정 안내](docs/FIREBASE-SETUP.md)에 정리했습니다. Spark 무료 플랜을 유지하며 유료 업그레이드·결제 계정·카드 등록을 하지 않습니다. 무료 한도는 실제 프로젝트에서 확인해야 하며 무제한 무료 사용을 보장하지 않습니다.

이메일·비밀번호는 HTTPS로 A1의 서버 함수에 보내 Firebase로 중계하며, A1은 비밀번호를 저장하거나 로그로 남기지 않습니다. 서명과 이메일 인증 여부를 검증한 로그인은 `Secure`·`HttpOnly` 쿠키로 최대 한 시간 유지합니다. 브라우저 저장소에 비밀번호나 로그인 토큰을 넣지 않습니다. 회원가입에 D1은 필요하지 않습니다. 무료 분석은 로그인 없이 이용할 수 있고, 가입이나 이메일 인증은 유료 추천 권한을 만들지 않습니다. 개인정보 처리 범위는 사이트의 `privacy.html`에 안내합니다.

## 구독자용 기능과 현재 연결 상태

추천 카드와 외부몰 검색 링크는 공개 HTML/JavaScript에 담지 않습니다. 브라우저가 서버의 회원 확인 API를 호출하고, 서버가 서명 검증된 로그인과 데이터베이스의 유효한 결제 기록을 확인해야 반환합니다. 추천 요청마다 권한을 다시 확인하며, 브라우저 저장소의 구독 표시나 임의의 결제 성공 값은 인정하지 않습니다.

구독자가 추천을 요청할 때만 어깨/골반 간격 비율·다리/몸통 간격 비율 두 값과 선택한 컬렉션·스타일·예산을 A1 서버로 보냅니다. 사진·사진 파일명·전체 기준점은 보내지 않으며 분석값을 데이터베이스에 저장하지 않습니다. 외부 쇼핑몰 URL에는 일반 의류 검색어만 넣습니다.

현재 서버 추천 카탈로그는 **12개의 참고용 예시**입니다. 실제 외부 상품·가격·재고 피드와 연결된 상태가 아닙니다. 쿠팡·Temu·네이버쇼핑 버튼도 검색 결과 연결이며 개별 판매 상품 자동 매칭·제휴·주문 연동이 아닙니다. 추천과 검색어 생성은 AI 기준점 결과·취향·예산을 이용한 규칙이며 별도의 생성형 AI 분석으로 표시하지 않습니다.

회원 인증은 Firebase를 선택했고 소유자가 프로젝트 설정과 Cloudflare 변수 입력을 진행했습니다. 소유자가 운영 회원가입·로그인을 확인했으며, D1 구독 데이터베이스와 결제 연동은 아직 구성하지 않았습니다. 회원가입 설정이 없으면 가입 기능이, 구독 설정이 없으면 추천 API가 잠깁니다. 이 코드만으로 운영 회원이나 결제·유료 이용권이 생성되지 않습니다. 현재 구독료를 받거나 자동 청구하지 않습니다. 실제 유료 운영 전 가격·제공 혜택·상품 공급원·해지/환불 조건과 결제 제공자의 요건을 확정해야 합니다. 설정 절차는 [서버 연결 안내](server/README.md), 상품 범위는 [서비스 운영 안내](docs/PRODUCT-CATALOG.md)를 참고하세요.

의류 주문·결제·배송·상품 반품은 고객이 선택한 외부 판매처에서 처리합니다. A1은 의류를 직접 판매하지 않습니다. 향후 A1 구독료는 스타일 큐레이션 이용료이며, A1 구독의 취소·환불·회원정보 처리는 별도로 준비해야 합니다.

## 로컬 실행과 배포

```sh
cd /workspace/A1-
node scripts/build-site.cjs
python3 -m http.server 8000 --bind 127.0.0.1 --directory dist
```

무료 분석과 화면은 정적 HTML/CSS/JavaScript로 동작하며 패키지 설치·유료 API·카드 등록이 필요하지 않습니다. 이 정적 서버에는 회원가입·로그인·보호된 추천 API가 없으므로 해당 기능은 잠깁니다. 실제 회원 기능은 설정된 Cloudflare Pages Functions가 필요합니다. `assets/`의 허용된 공개 파일만 `dist/`로 복사합니다. 서버 추천 로직·카탈로그·API 구현·테스트·Git 이력은 정적 출력에서 제외합니다. 소스 저장소가 공개되어 있으므로 이것을 소스 코드 비공개나 복제 방지로 설명하지 않습니다.

Cloudflare Pages Git 통합의 빌드 명령은 `node scripts/build-site.cjs`, 출력 폴더는 `dist`, 프레임워크는 `None`입니다. 루트 `functions/`의 API는 Cloudflare Pages Functions로 별도 처리합니다. 보호 기능의 배포 설정은 [Cloudflare Pages 안내](docs/CLOUDFLARE-PAGES.md)를 참고하세요. GitHub Pages는 정적 무료 분석만 실행하며 회원가입·로그인·구독 API를 제공하지 않습니다.

## 코드 구조

- `assets/body-analysis.js`: 공개 무료 분석의 기준점 품질 검증·2D 간격 계산.
- `assets/ai-studio.js`: 사진 선택·실제 기기 내 추론·분석 결과와 삭제.
- `stylist.html`, `assets/stylist.js`, `assets/i18n-stylist.js`: GPT 연결 준비가 된 상담 화면과 한국어/영어, 별도 외부 AI·수치 공유 선택.
- `assets/stylist-analysis-bridge.js`: 사용자 클릭 뒤 같은 출처 상담 창으로 숫자 두 개만 일회 전달하는 메모리 연결. URL·저장소·사진 전달 없음.
- `assets/premium-client.js`: 구독 상태 확인과 보호된 추천 요청. 클라이언트 상태는 권한의 근거가 아닙니다.
- `assets/app.js`: 서버가 허용한 추천 응답의 카드·상세·검색 링크 표시와 로그인 계정의 서버 찜 목록 연결. 새 찜 기록을 브라우저 저장소에 보관하지 않으며 예전 브라우저 찜 목록을 읽거나 자동 이전하지 않습니다.
- `functions/api/auth/`: Firebase 회원가입·이메일 인증·로그인 세션·로그아웃·비밀번호 재설정·회원탈퇴 연결.
- `functions/api/`: 회원 확인·추천 API. 인증·DB 구독 검증 후에만 추천을 반환합니다.
- `global.html`, `assets/global.js`, `assets/i18n-global.js`: 글로벌 쇼핑·3등급 멤버십·DEMO 가격 비교·관심 상품·알림·계정 화면과 한국어/영어.
- `functions/api/global/`, `server/member-data.mjs`: 등급 검사, 회원별 저장·동의·철회·삭제·모의 알림 API.
- `server/catalog-repository.mjs`, `server/global-comparison.mjs`: 승인된 저장 상품 검증·필터와 정확한 변형 비교. 외부 수집이나 임의 환율 변환 없음.
- `server/promotion-simulation.mjs`: 본인 관심 조건의 DEMO 모의 알림·요약·원자적 중복 방지.
- `server/price-comparison.mjs`, `server/adapters/`: 정확한 변형 비교와 승인 전 비활성화된 공식 공급자 어댑터.
- `workers/price-monitor/`: 활성 Cron 없는 제한된 수동 모의 실행 구조.
- `server/`: 서버 전용 인증/권한 정책, D1 스키마, 예시 카탈로그, 추천과 외부몰 검색 규칙.
- `assets/vendor/mediapipe/`: 공식 `@mediapipe/pose@0.5.1675469404` Lite 모델/실행 파일, Apache-2.0 라이선스와 무결성 기록.
- `assets/photos/`: 사용 허가된 참고 사진. 출처는 `assets/PHOTO-CREDITS.md`와 `credits.html`에 보존합니다.

## 검증

GitHub의 `.github/workflows/global-checks.yml`은 Pull Request 또는 운영자의 수동 실행에서 외부 발송 없는 서버·SQLite·권한 테스트와 정적 패키징을 실행합니다. 저장소 읽기 권한만 사용하며 배포·마이그레이션·공급자 호출을 실행하지 않습니다. 브라우저 및 workerd 검증은 아래의 별도 개발 환경에서 수행하며 이 CI에 포함되었다고 간주하지 않습니다.

Node.js의 서버 테스트:

```sh
node --test tests/body-analysis.cjs tests/membership-policy.cjs tests/premium-backend.cjs tests/recommendation-engine.cjs tests/firebase-auth.cjs tests/localization-server.cjs tests/global-entitlements.cjs tests/global-schema.cjs tests/global-api.cjs tests/global-retailers.cjs tests/price-comparison.cjs tests/notifications.cjs tests/catalog-repository.cjs tests/promotion-simulation.cjs tests/consent-context.cjs tests/global-completion-api.cjs tests/ai-catalog.cjs tests/ai-usage.cjs tests/openai-stylist.cjs tests/ai-stylist.cjs tests/unified-migrations.cjs tests/unified-access.cjs
```

브라우저 검증은 위의 정적 서버와 Playwright/Chromium이 설치된 환경에서 실행합니다.

```sh
node tests/smoke.cjs
node tests/i18n-browser.cjs
node tests/global-browser.cjs
node tests/discovery-browser.cjs
node tests/ai-studio.cjs
node tests/stylist-browser.cjs
node tests/stylist-bridge.cjs
```

실제 기기 내 추론, 무료 결과와 추천 잠금, 파일 삭제, 모바일 화면을 확인합니다. 회원가입 코드의 로컬/테스트 공급자 검증과 실제 Firebase 프로젝트·인증 이메일 수신·운영 쿠키 검증은 구분합니다. 설정 전에는 실제 가입 완료를 주장하지 않습니다. `CHROMIUM_PATH`, `A1_TEST_URL`로 검증 실행 파일과 주소를 지정할 수 있습니다. 실제 iPad Safari 기기 검증과 Chromium의 iPad 크기 화면 검증은 구분합니다. 서버 권한 테스트용 유료 회원은 테스트 안에서만 생성하며 운영 데이터베이스에 유료 회원을 만들지 않습니다.

Functions의 실행 환경 호환성은 Miniflare(workerd)와 esbuild가 설치된 개발 환경에서 `node tests/workerd-auth.cjs`로 검증합니다. 글로벌 API와 D1 SQLite 실행 환경의 결합은 `node tests/workerd-global.cjs`, 후속 상품/동의 마이그레이션/동시 모의 알림은 `node tests/workerd-global-completion.cjs`와 AI 상담·D1 비용 예약의 `node tests/workerd-stylist.cjs`로 별도 검증하며 실제 운영 D1이나 외부 공급자를 호출하지 않습니다. 도구가 다른 디렉터리에 설치되어 있으면 `A1_WORKER_TOOLS_ROOT`에 해당 `node_modules` 경로를 지정합니다. 실제 서버 코드를 workerd에서 실행해 요청 방식·가입·공개키 조회·RSA 로그인·세션·리다이렉트 차단을 확인하며, 외부 요청과 실제 회원 생성은 하지 않습니다. 이 검증은 Node.js만 사용한 테스트가 놓칠 수 있는 Workers 실행 환경 차이를 검사합니다.

공개 주소는 사용자 완료 화면과 연결된 Cloudflare Pages 배포 체크에서 확인했습니다. 현재 작업 환경의 네트워크 정책은 `pages.dev` 직접 접속을 차단하므로 원격 화면 테스트는 로컬 배포 파일 검증과 구분합니다.
