# 무료 분석 / 유료 추천의 서버 연결

무료 사진 분석 결과에는 회원이나 결제 권한을 요구하지 않습니다. 의류 추천과 외부 쇼핑몰 연결에는 **서버가 확인한 현재 유료 구독**이 필요합니다. 기간형 무료 체험 권한은 없으며 과거 체험 기록도 추천 권한을 부여하지 않습니다.

이메일 회원가입·로그인은 Firebase Authentication을 선택했고 서버 연결 코드와 화면을 준비했습니다. 아직 소유자의 실제 Firebase 프로젝트·운영 구독 데이터베이스·결제 연동은 설정하지 않았습니다. 회원 설정이 없으면 가입 기능이, 구독 설정이 없으면 추천 기능이 잠깁니다. 결제 화면·정기 청구·결제 웹훅·관리자 권한 변경 API는 포함하지 않으며, 회원가입으로 유료 이용권이 생성되지 않습니다.

## 회원가입과 로그인

운영 연결은 [iPad용 Firebase 설정 안내](../docs/FIREBASE-SETUP.md)를 따릅니다. Firebase의 Spark 무료 플랜과 이메일/비밀번호 인증을 사용하며 Blaze·카드·결제 계정은 연결하지 않습니다. 현재 무료 한도와 이메일 발송 제한은 실제 프로젝트에서 확인합니다.

Cloudflare Pages의 Production 환경에는 `FIREBASE_PROJECT_ID`와 `FIREBASE_WEB_API_KEY`를 설정합니다. 이 회원가입 흐름에는 서비스 계정 비밀키·관리자 JSON·D1 데이터베이스가 필요하지 않습니다. `apiKey`는 Firebase 웹 앱의 클라이언트용 식별 값이며 관리자 비밀키가 아닙니다. 채팅이나 공개 파일에 값을 복사하지 않고 운영 설정에 직접 입력합니다. 환경 변수를 저장한 뒤 운영 배포를 다시 실행해야 합니다.

`functions/api/auth/`의 경로는 다음과 같습니다.

| 경로 | 용도 |
| --- | --- |
| `GET /api/auth/config` | 회원 연결 설정 여부만 반환. 키와 프로젝트 설정값을 공개하지 않음 |
| `POST /api/auth/signup` | Firebase 이메일 회원가입과 인증 메일 요청 |
| `POST /api/auth/login` | 이메일·비밀번호 확인과 인증된 이메일의 로그인 세션 발급 |
| `GET /api/auth/session` | 현재 로그인 상태 확인. 유료 구독 여부와 별개 |
| `POST /api/auth/logout` | 이 브라우저의 로그인 쿠키 삭제 |
| `POST /api/auth/verify-email` | 이메일 인증 안내 재요청 |
| `POST /api/auth/reset-password` | 비밀번호 재설정 메일 요청 |
| `POST /api/auth/delete-account` | 비밀번호 재확인 후 Firebase 회원탈퇴 |

이메일·비밀번호는 HTTPS로 A1의 서버 함수에 전달된 뒤 Firebase REST API에 중계합니다. A1은 비밀번호를 자체 데이터베이스나 로그에 저장하지 않습니다. 인증 정보는 Firebase에서 관리합니다. 사진·파일명·AI 기준점은 회원 요청에 포함하지 않습니다.

로그인은 Firebase의 RS256 서명, 정확한 프로젝트 issuer·audience·유효기간과 `email_verified`를 서버에서 검증합니다. 검증된 토큰은 `__Host-a1-session` 쿠키로 최대 한 시간 유지하고 `Secure`, `HttpOnly`를 적용합니다. 브라우저 `localStorage`에 비밀번호나 로그인 토큰을 저장하지 않습니다. 서버는 이 쿠키를 검증해 사용자를 식별하며 로그인 성공·이메일 인증만으로 구독 권한을 부여하지 않습니다. 회원 탈퇴나 비밀번호 재설정의 실제 공급자 동작은 운영 프로젝트 연결 후 확인해야 합니다.

현재 운영 프로젝트가 없어 실제 사용자 생성·메일 수신·운영 세션 발급은 검증 전입니다. 로컬 테스트 공급자나 시험용 JWT를 이용한 검증을 실제 회원가입 활성화로 설명하지 않습니다. 개인정보 안내는 운영 사이트의 `privacy.html`에서 제공합니다.

## 권한 경계

- `GET /api/membership`: 로그인 서명과 DB 구독을 확인합니다. 허용 응답은 `{allowed: true, accessUntil}`입니다.
- `POST /api/recommendations`: 같은 검증을 **매 요청마다** 실행한 후 추천을 반환합니다. 앞선 회원 확인 성공은 다음 요청의 권한을 보장하지 않습니다.
- 로그인은 Firebase 또는 명시적으로 설정한 신뢰 발급자의 RS256 JWT 서명·issuer·audience·유효기간을 검증합니다. Firebase 회원은 이메일 인증도 확인합니다. JWT의 구독 주장이나 브라우저의 `paid` 플래그는 결제 근거로 사용하지 않습니다.
- D1의 `(issuer, subject)`로 회원을 조회하고 `active` 상태, 미래의 `paid_through`, 유효한 `payment_verified_at`이 모두 있어야 허용합니다. 시간은 서버의 UTC 밀리초입니다.
- 모든 응답은 `Cache-Control: private, no-store`를 사용합니다. 추천 요청은 같은 출처인지 확인하고 최대 8KB의 제한된 JSON만 받습니다.

추천 요청에는 아래 값만 허용합니다. 사진·파일명·전체 랜드마크·추가 필드는 받지 않습니다.

```json
{
  "metrics": {"shoulderHipRatio": 1.2, "legTorsoRatio": 1.1},
  "preferences": {"gender": "전체", "style": "전체", "budget": 150000}
}
```

분석값은 요청 처리 중에만 사용하며 데이터베이스에 저장하지 않습니다. 애플리케이션은 사진이나 분석값을 로그에 기록하지 않습니다. 인프라의 요청 메타데이터 처리 정책은 운영자가 별도로 확인해야 합니다.

## 운영 연결 순서

1. 가격·청구 주기·제공 혜택·해지/환불 조건과 판매/결제 제공자의 요건을 정합니다. 현재 월 구독료는 미정이며 실제 결제는 활성화하지 않습니다.
2. [Firebase 설정](../docs/FIREBASE-SETUP.md)을 완료하고 실제 가입·인증 이메일·로그인·재설정·탈퇴를 확인합니다. 이 단계는 D1 없이 할 수 있습니다.
3. 유료 추천을 연결할 때 Cloudflare Pages Functions의 운영 환경에 D1 바인딩을 준비합니다. 비밀키는 채팅이나 공개 저장소에 넣지 않습니다.
4. 운영자가 검토한 D1에 `server/schema.sql`을 적용합니다. 이 스키마는 테이블만 만들며 회원·구독·체험·결제를 생성하지 않습니다.
5. 결제 제공자의 **서명 검증된 결과**를 처리하는 신뢰된 서버 연동을 별도로 구현합니다. 성공한 실제 결제로만 구독 행을 갱신하고, 해지·미납·환불·권한 취소도 반영합니다. 이 결제 어댑터는 아직 구현하지 않았습니다.
6. 운영과 분리된 시험 환경에서 가입·결제 성공/실패·만료·해지·환불·접근 취소를 검증한 뒤 유료 가입을 엽니다.

| Cloudflare 설정 | 용도 |
| --- | --- |
| `FIREBASE_PROJECT_ID` | 선택한 Firebase의 정확한 프로젝트 ID |
| `FIREBASE_WEB_API_KEY` | 같은 프로젝트의 웹 앱 API 키 |
| `MEMBERSHIP_DB` | Cloudflare D1 데이터베이스 바인딩 이름 |

Firebase 회원가입에는 위의 Firebase 두 값만 필요합니다. `MEMBERSHIP_DB`와 검증된 결제 연동은 유료 추천에 별도로 필요합니다. Firebase의 issuer·audience와 공식 Google 서명 키 URL은 해당 프로젝트에 맞춰 서버에서 검증하며, 임의 외부 키 URL을 신뢰하지 않습니다.

기존 외부 JWT 연동을 사용하는 경우에는 `AUTH_ISSUER`, `AUTH_AUDIENCE`, `AUTH_JWKS_URL`을 명시적으로 설정합니다. 이 방식의 JWKS는 issuer와 같은 HTTPS 출처여야 합니다. 선택적인 `MEMBER_LOGIN_URL`도 실제 HTTPS 로그인 주소만 허용합니다. Bearer JWT, `CF-Access-Jwt-Assertion`, `CF_Authorization` 쿠키 지원은 유지하지만 이것만으로 별도 로그인 공급자나 Cloudflare Access가 자동 구성되지는 않습니다.

Cloudflare Access를 별도로 사용하는 경우 공개 가입·로그인 경로까지 일괄 차단하지 않습니다. 무료 홈페이지와 분석 자산은 공개 상태를 유지하고, 실제 보호할 회원용 경로·인증 방식·현재 플랜 한도를 별도로 확인해야 합니다. 현재 Firebase 회원가입 연결에는 Access를 활성화할 필요가 없습니다.

## 배포와 정적 파일

Cloudflare Pages Git 통합은 루트 `functions/api/`를 서버 함수로 처리하고 `dist/`는 공개 정적 파일로 제공합니다. `scripts/build-site.cjs`는 허용한 공개 자산만 복사하므로 서버 카탈로그와 추천 규칙은 정적 출력에 포함하지 않습니다. 기존 GitHub Pages에는 서버 폴더를 제외하도록 `_config.yml`을 두며 보호 API는 제공하지 않습니다.

소스 저장소가 공개되어 있는 한 서버 소스 자체를 비밀로 간주하면 안 됩니다. 접근 제어는 로직 파일을 숨기는 효과가 아니라 실제 요청에서 인증된 구독 상태를 검증하는 데 있습니다. 결제 비밀키·고객 기록은 저장소에 두지 않습니다.

## 검증

```sh
node --test tests/membership-policy.cjs tests/premium-backend.cjs tests/recommendation-engine.cjs
```

정책 경계·서명/만료/대상 불일치·임의 구독 주장·체험 기록·회원 없음·결제 검증 없음·추천 요청의 권한 재확인·입력 제한·캐시 금지를 확인합니다. 테스트는 임시 RSA 키와 DB 대역을 사용하며 운영 회원이나 결제를 생성하지 않습니다. 이 검증은 실제 인증/결제 공급자와의 운영 연결 완료를 뜻하지 않습니다.
