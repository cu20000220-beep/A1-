# Cloudflare Pages 배포와 구독 기능 연결

공개 주소는 **https://a1fashion.pages.dev**입니다. 사용자 배포 완료 화면과 연결된 GitHub의 Cloudflare Pages 성공 체크에서 `a1fashion` 프로젝트를 확인했습니다. 이 작업 환경은 `pages.dev` 직접 접속을 정책으로 차단하므로 원격 화면 테스트와 로컬 배포 파일 검증은 구분합니다.

## 현재 Git 자동 업데이트

| 항목 | 값 |
| --- | --- |
| 서비스 | Cloudflare **Pages** |
| 소스 | 현재 A1 GitHub 저장소 |
| 프로젝트 | `a1fashion` |
| 운영 브랜치 | `main` |
| Framework preset | `None` |
| Build command | `node scripts/build-site.cjs` |
| Build output directory | `dist` |
| Root directory | 기본값 유지(저장소 루트) |

기존 Git 통합을 유지하면 됩니다. 새 프로젝트나 유료 도메인을 만들 필요가 없습니다. 초기 연결이 필요한 경우 Pages 생성 전용 화면은 https://dash.cloudflare.com/?to=/:account/workers-and-pages/create/pages 입니다. 일반 Create app 화면에서는 Workers 설정으로 들어갈 수 있습니다. 비밀번호·인증키를 채팅으로 보내지 않습니다.

## 무료 분석과 보호된 API

정적 화면과 실제 기기 내 사진 분석은 인증·결제 없이 동작합니다. 추천과 외부몰 검색 연결은 유료 구독 전용이며 기간형 무료 체험은 없습니다. 회원가입·로그인은 Firebase를 사용하며 소유자가 프로젝트·인증 설정과 운영 변수 저장을 진행했습니다. 소유자가 실제 가입·로그인 성공을 확인했습니다. 가격·구독 결제는 준비 중이므로 유료 가입·자동 청구는 실행하지 않습니다. Firebase 회원가입 설정 후에도 결제 기록이 없으면 추천은 잠깁니다.

정적 빌드에는 `index.html`, `credits.html`, `privacy.html`과 명시적으로 허용한 공개 JS/CSS·사진·AI 모델·라이선스만 넣습니다. 카탈로그·추천 규칙·API 구현·테스트·개발 문서·계정 파일은 `dist/`에 복사하지 않습니다. 기존 출력은 이 빌드가 만든 표시를 확인한 뒤에만 교체합니다.

루트의 `functions/api/`는 Cloudflare Pages Functions로 빌드됩니다. 서버 모듈은 함수 의존성으로 묶이며 정적 자산이 아닙니다. 브라우저는 같은 출처의 `/api/auth/*`, `/api/membership`, `/api/recommendations`를 호출합니다. Firebase 설정이 없으면 회원가입·로그인이 잠깁니다. 회원가입은 Firebase 설정만으로 연결할 수 있지만, 유료 추천에는 별도의 D1·검증된 결제 기록이 필요하며 설정이 없으면 추천은 계속 잠깁니다. 회원가입이 유료 가입이나 결제를 뜻하지 않습니다.

| 필요한 런타임 설정 | 역할 |
| --- | --- |
| `FIREBASE_PROJECT_ID` | Firebase의 정확한 프로젝트 ID. 무료 회원가입·로그인에 필요 |
| `FIREBASE_WEB_API_KEY` | 같은 Firebase 프로젝트의 웹 앱 API 키. 무료 회원가입·로그인에 필요 |
| D1 바인딩 `MEMBERSHIP_DB` | 유료 추천에서 조회할 결제 확인 구독 기록. 무료 가입에는 불필요 |

회원가입은 [iPad용 Firebase 설정 안내](FIREBASE-SETUP.md)에 따라 Spark 무료 프로젝트에서 이메일/비밀번호 인증을 켜고 웹 앱의 두 값을 확인합니다. Cloudflare Pages의 **Production** 환경 변수에 직접 입력하고 운영 배포를 다시 실행합니다. 값이나 서비스 계정 비밀키를 채팅·공개 GitHub 파일에 넣지 않습니다. 회원가입에 관리자 비밀키나 D1은 필요하지 않습니다.

소유자가 Firebase 프로젝트를 생성하고 Cloudflare 운영 변수를 입력했지만, 소유자가 실제 운영 가입·로그인 성공을 확인했습니다. 언어별 이메일 수신과 재설정·탈퇴 동작은 별도로 확인합니다. 임의 설정이나 시험용 유료 회원을 운영 DB에 넣지 않습니다. 기존 외부 JWT 방식의 `AUTH_ISSUER`, `AUTH_AUDIENCE`, `AUTH_JWKS_URL`, 선택적인 `MEMBER_LOGIN_URL` 설정과 유료 구독 데이터베이스·검증된 결제 갱신 절차는 [서버 안내](../server/README.md)를 참고합니다. 이 작업 환경에서 Cloudflare 운영 변수·바인딩이나 유료 회원을 생성하지 않았습니다.

현재 선택한 Firebase 가입 흐름에는 Cloudflare Access를 추가할 필요가 없습니다. Access를 별도로 사용하는 경우 공개 홈페이지·사진 분석·회원가입·로그인 경로를 일괄 잠그지 않습니다. 기본 Pages Access 설정은 미리보기 보호이므로 운영 도메인과 세부 경로 정책은 공식 절차와 실제 적용 범위를 확인해야 합니다.

## 호스팅 비용과 제한

현재 코드의 빌드와 AI 분석에는 유료 API를 호출하지 않습니다. 이 변경으로 유료 플랜·결제 서비스·청구를 활성화하지 않습니다. Pages의 정적 자산과 Functions/D1에는 서로 다른 한도·과금 조건이 있으므로 실제 서버 연결 전에 계정의 무료 플랜과 현재 공식 제한을 확인합니다. 무제한 무료 운영이나 결제 수수료 0원을 보장하지 않습니다.

GitHub Pages는 회원가입·로그인·보호된 추천 API를 실행하지 않습니다. 해당 환경에서도 무료 분석만 동작하고 회원 기능과 추천은 잠깁니다. `_config.yml`은 서버 소스·테스트 등을 정적 사이트에서 제외합니다. 공개 Git 소스 자체를 비밀로 취급해서는 안 됩니다.

## 다른 배포 방식

대시보드 Direct Upload는 ZIP 정적 업로드가 가능하지만 이를 현재 Git 통합과 혼동하지 않습니다. 정적 ZIP만으로 회원가입·로그인·서버 함수·DB·구독 인증이 구성되지 않습니다. 자동 업데이트와 보호 API를 유지하려면 현재 Git 통합의 Pages 빌드를 사용합니다.

공식 자료:

- https://developers.cloudflare.com/pages/get-started/git-integration/
- https://developers.cloudflare.com/pages/functions/get-started/
- https://developers.cloudflare.com/pages/functions/bindings/
- https://developers.cloudflare.com/pages/platform/limits/
- https://developers.cloudflare.com/pages/functions/pricing/
