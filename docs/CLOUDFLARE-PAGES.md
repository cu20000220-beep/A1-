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

정적 화면과 실제 기기 내 사진 분석은 인증·결제 없이 동작합니다. 추천과 외부몰 검색 연결은 유료 구독 전용이며 기간형 무료 체험은 없습니다. 현재 가격·회원 로그인·결제 연동은 준비 중이므로 유료 가입·자동 청구는 실행하지 않습니다.

정적 빌드에는 `index.html`, `credits.html`과 명시적으로 허용한 공개 JS/CSS·사진·AI 모델·라이선스만 넣습니다. 카탈로그·추천 규칙·API 구현·테스트·개발 문서·계정 파일은 `dist/`에 복사하지 않습니다. 기존 출력은 이 빌드가 만든 표시를 확인한 뒤에만 교체합니다.

루트의 `functions/api/`는 Cloudflare Pages Functions로 빌드됩니다. 서버 모듈은 함수 의존성으로 묶이며 정적 자산이 아닙니다. 브라우저는 같은 출처의 `/api/membership`, `/api/recommendations`를 호출합니다. 아래 설정이 없는 상태에서는 서버가 `503`을 반환해 추천을 잠급니다. 이것은 유료 가입이 준비됐다는 의미가 아닙니다.

| 필요한 런타임 설정 | 역할 |
| --- | --- |
| `AUTH_ISSUER` | 신뢰할 회원 인증 발급자의 HTTPS issuer |
| `AUTH_AUDIENCE` | A1용 JWT audience |
| `AUTH_JWKS_URL` | issuer와 같은 출처의 HTTPS 공개키 URL |
| D1 바인딩 `MEMBERSHIP_DB` | 서버에서 조회할 유료 구독 기록 |
| `MEMBER_LOGIN_URL` (선택) | 실제 로그인 흐름으로 이동할 HTTPS 주소 |

실제 공급자를 정하기 전 임의 값을 채우거나 시험 유료 회원을 운영 DB에 넣지 않습니다. 별도로 준비할 회원 로그인, 검증된 결제/권한 갱신, D1 스키마와 확인 절차는 [서버 안내](../server/README.md)에 정리했습니다. 이 작업 환경에는 Cloudflare 계정·데이터베이스 설정 권한이 없으므로 운영 바인딩이나 유료 회원을 생성하지 않았습니다.

Cloudflare Access를 인증 수단으로 선택한다면 `/api/*` 등 회원용 경로만 보호합니다. 공개 홈페이지와 분석 자산을 포함한 사이트 전체를 잠그면 무료 분석도 이용할 수 없으므로 피합니다. 현재는 Access를 비롯해 특정 인증 공급자를 선택하거나 연결하지 않았습니다.

## 호스팅 비용과 제한

현재 코드의 빌드와 AI 분석에는 유료 API를 호출하지 않습니다. 이 변경으로 유료 플랜·결제 서비스·청구를 활성화하지 않습니다. Pages의 정적 자산과 Functions/D1에는 서로 다른 한도·과금 조건이 있으므로 실제 서버 연결 전에 계정의 무료 플랜과 현재 공식 제한을 확인합니다. 무제한 무료 운영이나 결제 수수료 0원을 보장하지 않습니다.

GitHub Pages는 보호 API를 실행하지 않으며 해당 환경에서도 무료 분석만 동작하고 추천은 잠깁니다. `_config.yml`은 서버 소스·테스트 등을 정적 사이트에서 제외합니다. 공개 Git 소스 자체를 비밀로 취급해서는 안 됩니다.

## 다른 배포 방식

대시보드 Direct Upload는 ZIP 정적 업로드가 가능하지만 이를 현재 Git 통합과 혼동하지 않습니다. 정적 ZIP만으로 서버 함수·DB·구독 인증이 구성되지 않습니다. 자동 업데이트와 보호 API를 유지하려면 현재 Git 통합의 Pages 빌드를 사용합니다.

공식 자료:

- https://developers.cloudflare.com/pages/get-started/git-integration/
- https://developers.cloudflare.com/pages/functions/get-started/
- https://developers.cloudflare.com/pages/functions/bindings/
- https://developers.cloudflare.com/pages/platform/limits/
- https://developers.cloudflare.com/pages/functions/pricing/
