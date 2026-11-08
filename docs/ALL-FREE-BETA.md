# A1 FASHION 전 기능 무료 베타 — 구현·검증 기록

검토일: 2026-11-08 (한국 시간). 기반: PR #1의 `feature/a1-unified-release` / `a9f27888b2ef12974801da6a89e804068ba78c7c`.
작업 브랜치: `feature/all-free-beta-preview`. 이 문서는 기존의 구독 잠금형 무료 베타 계획을 대체하는 **서버 설정 기반 정책**입니다.

## 적용 범위와 실제 상태

`A1_FREE_BETA_MODE`의 서버 값이 문자열 `true`일 때만 무료 베타 정책을 적용합니다.
기본값·미설정·`false`·오타는 기존 구독 정책을 유지합니다. 브라우저 저장소·쿠키·헤더·요청 JSON은 이 설정을 바꾸지 못합니다.
이번 작업은 코드와 로컬 시험만 진행했습니다. Cloudflare 환경 변수를 설정하거나 Production 정책을 바꾸지 않았습니다.
main 병합·Production 배포·운영 SQL·실제 결제·구독 부여·외부 GPT/상품 API·메일/SMS·Cron은 실행하지 않았습니다.

| 기능 | 베타에서의 이용 범위 |
| --- | --- |
| 사진 선택·미리보기·분석·삭제 | 비로그인 가능. 이미지와 원본 픽셀은 기기 내부에서만 처리 |
| 체형 비율 기반 스타일 추천 | 비로그인 가능. 기존 코디 예시를 재사용하며 모든 예시 가격·사진·상품은 실제 판매 정보와 구분 |
| AI 스타일·비교·할인 상담 | 비로그인 가능한 규칙 기반 DEMO. 실제 OpenAI 호출 없음 |
| 맞춤 쇼핑 검색 | 비로그인 가능. 외부 판매처 검색 링크이며 상품 목록·재고·배송 확인 결과가 아님 |
| 실제 상품·가격 비교·할인 정보 | 구독 잠금 없이 화면과 상담 이용 가능. 검증 자료가 없어 **준비 중**, 빈 결과와 최저가 확인 불가 표시. 가상 가격을 실제 정보처럼 생성하지 않음 |
| 찜·목표 가격·개인 설정 저장 | 검증된 무료 로그인 필요. 현재 계정의 `(issuer, subject)`로만 읽기·쓰기·삭제. 기존 D1 스키마가 없으면 준비 필요 오류로 잠기며 자동 생성/마이그레이션하지 않음 |
| 알림 | 실제 발송 비활성. 베타 설정 저장에서 이메일/SMS 활성화를 강제로 false로 유지. 채널 동의는 별도이며 미리보기는 명시적 DRY RUN. 모의 감시는 준비 중 응답, 실제 이벤트·큐·발송 생성 없음 |
| 결제·자동 청구·유료 가입 | 비활성. 구매/가격 안내는 서버가 베타임을 확인한 후 ‘무료 베타 이용 중’으로 표시 |

기존 GENERAL/PREMIUM 기록을 FREE로 변환하거나 신규 권한을 발급하지 않습니다. 베타 응답의 `plan: FREE`는 결제 권한을 새로 부여하지 않는 체험 정책 표시이며 기존 DB 등급을 수정한 결과가 아닙니다.
Firebase 인증과 기존 회원 식별자는 그대로 사용합니다. 인증 이메일은 기존 가입 절차이며 마케팅 이메일/SMS와 별개입니다. 이번 시험에서는 실제 가입·메일 발송을 하지 않았습니다.

## 서버 권한과 유료 정책 복귀

- 기존 `authorizeMember`/`authorizePremium`, 서명·구독 검증과 결제 기간·취소·등급 검사는 삭제하지 않았습니다.
- 공개 베타 추천/상담/검색/비교 경로는 인증·회원 DB·상품 피드·비밀키를 읽지 않습니다. 잘못 남은 LIVE 승인 플래그가 있어도 베타 상담은 DEMO를 강제합니다.
- 저장 기능은 무료 베타에서도 먼저 실제 인증을 수행합니다. SQL의 회원별 소유권 조건·항목 수 제한·개인별 요청 한도·별도 동의 조건을 유지합니다. 구독 테이블을 쓰지 않습니다.
- 베타 종료는 **검증된 결제·웹훅 연동과 운영자의 명시적 유료 전환 승인 이후**, 별도로 승인한 배포/설정 변경에서만 진행합니다. 이 코드에는 결제 시스템이 없고 베타 플래그가 결제를 시작하지 않습니다.
- 서버의 `A1_FREE_BETA_MODE`를 끄거나 제거하면 다음 요청부터 원래 유료 검사와 원자적 SQL 결제 조건이 복귀합니다. 헤더/쿠키가 베타를 다시 켤 수 없습니다. 기존 FREE 회원에게 유료 기록을 만들지 않습니다.
- 기존 회원의 자기 찜 읽기·삭제와 동의 철회 권한은 기존 개인정보 정책에 따라 유지됩니다. 서버 플래그를 끄는 것과 DB 데이터 삭제는 별개입니다.
- 표준 Pages Preview의 `/api/*` 격리 미들웨어는 유지합니다. 따라서 기존 공개 Preview에서 상담·회원 API 503은 정상 보호 동작이며, 베타 시험은 로컬 격리 서버에서 수행했습니다.

## iPad Safari 사진 미리보기

기존 화면은 선택 사진을 내부 분석용 캔버스로 준비했지만 분석 전에는 표시하지 않았습니다.
이미지 load 이벤트 후 최대 1280px의 기기 내 캔버스를 표시하도록 수정했습니다. 미리보기는 화면 너비에 맞추고 비율을 유지합니다.
분석 완료 후에는 원본 미리보기를 지우고 기존 얼굴 제외 결과 캔버스를 표시합니다.
사진 교체·삭제·페이지 이탈은 미리보기/결과/원본 캔버스 픽셀과 파일 입력·비율을 지웁니다.
임시 Blob URL은 로딩 종료 시 즉시 해제하고, 로딩 중 삭제해도 취소·해제합니다. 원본 사진 업로드와 지속 저장은 추가하지 않았습니다.

## 검증

검증은 로컬 RSA 서명·테스트 회원·메모리 SQLite와 저장소의 예시 사진/상품만 사용합니다.
실제 Firebase·운영 DB·실제 구독·결제·공급자와 연결하지 않습니다. 브라우저의 외부 요청도 차단하고 0건인지 검사합니다.
브라우저 등급 비교는 같은 모의 자세 기준점과 실제 비율 계산·실제 UI·실제 API 핸들러를 사용하며, MediaPipe 정확도 재검사를 뜻하지 않습니다.

실행 명령:

```sh
# 새 정책·원래 유료 권한·개인정보 회귀: 기존 CI의 오프라인 Node 목록
# 새 테스트: tests/free-beta-policy.cjs
A1_TEST_FREE_BETA=true A1_SCREENSHOT_DIR=/workspace/work/a1-beta-final node tests/photo-preview-tiers.cjs
node scripts/build-site.cjs
node scripts/check-public-artifacts.cjs
```

최종 실행 결과:

| 검사 | 결과 |
| --- | --- |
| CI 오프라인 Node 전체 목록 | **224개 통과, 실패 0개**. 기존 유료 권한·Firebase·취소/만료·동의·소유권·SQL·예산 검사 및 베타 정책 4개 포함 |
| 마지막 변경 후 베타 집중 검사 | **4개 통과**. 동의가 있어도 발송 설정 false, DRY RUN, 다른 회원의 기록 비노출, 구독 테이블 불변 포함 |
| 베타 브라우저 | **16개 조합 통과**: 비로그인/FREE/GENERAL/PREMIUM × 한국어/영어 × 390/820px. 사진 로딩 중 취소·URL 해제, 미리보기/분석/삭제, 추천·찜·비교·상담, 가로 넘침과 JS 오류 검사 |
| 동일 비율 | 모든 조합에서 어깨/골반 **1.4285714286**, 다리/몸통 **1.8**. 실제 비율 계산을 사용하고 자세 추정 입력만 동일한 모의 기준점으로 고정 |
| 브라우저 외부 요청 / JS 오류 | **0건 / 0건**. API는 실제 핸들러와 로컬 RSA/SQLite 사용 |
| 원래 구독 정책 브라우저 회귀 | 실제 로컬 MediaPipe 분석·discovery·smoke·상담 비율 전달 브리지 **4종 통과**. 정책 메타데이터 GET만 허용하고 사진·비율의 자동 전송 금지는 유지 |
| 정적 빌드·공개 산출물 검사 | 공개 파일 **53개 빌드**, 마커 포함 **54개 검사 통과**. 서버 소스·DB·일치하는 비밀값·직접 OpenAI 주소 노출 없음 |

원시 브라우저 결과: [results.json](validation/free-beta/results.json).

### 결과 화면 스크린샷

모두 로컬 모의 계정/예시 사진/상품을 사용한 실제 Chromium 캡처입니다. 베타에서는 등급별 공개 기능 차이가 없고 **저장에만 로그인**이 필요합니다. 아래 각 계정 캡처는 API 인증·응답을 검증한 해당 브라우저 세션의 화면입니다.

| 시험 사용자 | 한국어 스타일 결과 | 영어 스타일 결과 |
| --- | --- | --- |
| 비로그인 | [KO](validation/free-beta/chromium-beta-anonymous-ko-390-styles.png) | [EN](validation/free-beta/chromium-beta-anonymous-en-390-styles.png) |
| 무료 로그인 | [KO](validation/free-beta/chromium-beta-free-ko-390-styles.png) | [EN](validation/free-beta/chromium-beta-free-en-390-styles.png) |
| 기존 GENERAL 모의 계정 | [KO](validation/free-beta/chromium-beta-general-ko-390-styles.png) | [EN](validation/free-beta/chromium-beta-general-en-390-styles.png) |
| 기존 PREMIUM 모의 계정 | [KO](validation/free-beta/chromium-beta-premium-ko-390-styles.png) | [EN](validation/free-beta/chromium-beta-premium-en-390-styles.png) |

- 사진 미리보기: [모바일 KO](validation/free-beta/chromium-preview-ko-390.png), [모바일 EN](validation/free-beta/chromium-preview-en-390.png), [태블릿 KO](validation/free-beta/chromium-preview-ko-820.png), [태블릿 EN](validation/free-beta/chromium-preview-en-820.png)
- 동일 비율 분석: [KO](validation/free-beta/chromium-beta-free-ko-390-analysis.png), [EN](validation/free-beta/chromium-beta-free-en-390-analysis.png)
- 가격 비교 준비 중: [KO](validation/free-beta/chromium-beta-free-ko-390-comparison.png), [EN](validation/free-beta/chromium-beta-free-en-390-comparison.png)
- 무료 DEMO 상담: [KO](validation/free-beta/chromium-beta-free-ko-390-stylist.png), [EN](validation/free-beta/chromium-beta-free-en-390-stylist.png)

스크린샷은 검토용 문서에만 보관하며 정적 배포 allowlist에 포함되지 않습니다.

**한계:** 실제 iPad Safari에서 사용자가 확인한 사진 선택·분석·결과·삭제 성공을 반영했습니다. 수정 후 자동 브라우저 시험은 Linux Chromium의 390px/820px 터치 화면입니다. WebKit 설치는 공식 다운로드 호스트의 네트워크 정책 403으로 차단돼 실행하지 못했습니다. 실제 iPad Safari의 수정 후 미리보기 확인은 남아 있습니다. Production 환경·정상 복구 배포도 이 작업에서 변경하거나 Cloudflare API로 조회하지 않았습니다.

## PR #1 관계

PR #1의 최신 통합 커밋에서 분기했습니다. 후속 PR의 base는 `feature/a1-unified-release`로 하며 main을 대상으로 하지 않습니다. 후속 PR이 통합 브랜치에 병합되기 전에는 PR #1에 이 변경이 포함되지 않습니다. 이번 작업에서는 어느 PR도 병합하지 않습니다.
