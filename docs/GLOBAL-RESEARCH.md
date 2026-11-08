# 글로벌 연동 조사와 승인 조건

조사 기준: 2026-11-05. 공식 문서의 접근 가능한 GitHub 소스와 공식 SDK를 읽었습니다. 현재 작업 환경은 일부 개발 문서·API 호스트의 직접 접속을 허용하지 않으므로, 아래의 **확인한 사실**과 **운영자가 추가 확인할 사항**을 구분합니다. 계정 생성, 제휴 신청, 실제 상품 호출, 이메일·문자 발송, 유료 플랜 등록은 하지 않았습니다.

## 상품 공급원

| 공급원 | 이번에 확인한 범위 | 실제 연동 전 승인·확인 |
| --- | --- | --- |
| eBay Browse API | eBay 공식 OAuth Node 클라이언트는 Client ID/Secret과 application token/client-credentials 흐름, Production/Sandbox 구분을 설명합니다. | 개발자 계정·키, Browse 사용 자격과 운영 접근, 대상 marketplace, 호출 제한, 제휴 사용 조건을 확인해야 합니다. Sandbox 성공은 운영 접근 승인과 다릅니다. |
| Awin 상품 피드 | 공식 개발자 포털을 연동 후보로 지정했습니다. 이 실행 환경에서 현재 피드 계약·개별 광고주 허용 범위까지 검증하지 못했습니다. | 퍼블리셔 승인, 광고주별 제휴 및 피드 접근 권한, 토큰, 데이터 이용·표시 조건, 제휴 고지를 확인해야 합니다. 특정 광고주나 상품이 승인되었다고 표시하지 않습니다. |
| 기타 국가별 판매처 | 고정된 공식 쇼핑몰 검색 링크를 안내할 수 있습니다. | 검색 링크 제공은 상품 API 승인, 재고 연동, 배송 보장 또는 제휴 계약을 의미하지 않습니다. 별도 공식 API·피드가 확인되기 전 자동 수집 대상에 넣지 않습니다. |

공식 자료:

- [eBay 공식 OAuth 클라이언트](https://github.com/eBay/ebay-oauth-nodejs-client) — README를 직접 확인했습니다. OAuth 인증 방식의 근거이며 Browse의 모든 운영 승인 조건이나 현재 이용 가격을 보장하는 자료는 아닙니다.
- [eBay Browse 개요](https://developer.ebay.com/api-docs/buy/browse/overview.html)
- [eBay API License Agreement](https://developer.ebay.com/join/api-license-agreement)
- [eBay 호출 제한 안내](https://developer.ebay.com/develop/get-started/api-call-limits)
- [Awin 개발자 포털](https://developer.awin.com/)
- [Awin 이용 조건](https://www.awin.com/gb/terms-and-conditions)

eBay 개발자 문서 및 Awin 포털의 운영 계약·현재 제한은 계정 소유자가 실제 신청 시 다시 확인해야 합니다. 이 문서는 특정 상품 이미지의 재사용 권한이나 특정 저장 기간을 임의로 부여하지 않습니다.

### 피드별 도입 기록

각 연결에는 승인자·승인 일자, 계약/약관 버전과 URL, 허용 국가/통화, 요청 한도, 최소 갱신 간격, 데이터 삭제 기한, 이미지 표시·캐싱 허용, 제휴 추적/고지 조건을 기록해야 합니다. **허용 저장 기간이 확인되지 않으면 장기 저장이나 자동 갱신을 켜지 않습니다.** 공급자의 원본 가격·통화·판매 URL·마지막 확인 시각을 보관하고, 상품 데이터와 표시 이미지에 같은 권한이 적용된다고 가정하지 않습니다.

## Cloudflare 무료 운영 범위

접근 가능한 Cloudflare 공식 문서 소스에서 다음을 확인했습니다. 계정에 적용되는 실제 플랜·변경된 제한은 활성화 직전에 대시보드에서 다시 확인합니다.

| 항목 | 문서에서 확인한 무료 범위/제약 | 설계에 미치는 영향 |
| --- | --- | --- |
| Pages 정적 요청 | Functions를 호출하지 않는 정적 자산 요청은 무료·무제한으로 설명됩니다. | 정적 화면과 사진 모델 파일에 가능한 한 Functions를 거치지 않습니다. |
| Pages Functions / Workers | 무료 요청 한도는 하루 100,000회이며 Workers와 Functions가 합산됩니다. | 회원 확인·추천·알림 설정 API·예약 작업이 같은 예산을 소비할 수 있습니다. |
| Workers CPU | 무료 HTTP/Cron CPU 한도는 10ms입니다. | 피드 전체를 한 번에 정렬·파싱하지 않고 작은 배치와 수동 실행으로 시작합니다. 로컬 workerd 성공이 실제 무료 CPU 예산 통과를 보장하지 않습니다. |
| Cron Triggers | 계정당 무료 Cron Trigger 수는 5개로 표시됩니다. UTC 기준으로 실행됩니다. | 많은 회원별 Cron을 만들지 않고 제한된 작업이 대상자를 나눠 처리하도록 설계합니다. |
| D1 | 무료 일간 5백만 행 읽기·10만 행 쓰기, 총 5GB 저장, DB당 최대 500MB로 표시됩니다. | 인덱스와 소량 배치가 필요하며, 가격 이력·발송 이력에 보관/정리 정책이 필요합니다. 읽기/쓰기는 반환 행 수가 아닌 스캔·갱신 수에 영향받습니다. |

직접 확인한 공식 소스:

- [Workers 제한](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/workers/platform/limits.mdx)
- [Pages Functions 가격 설명](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/pages/functions/pricing.mdx)
- [D1 가격 표](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/partials/workers/d1-pricing.mdx)
- [D1 제한](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/d1/platform/limits.mdx)
- [Cron Triggers](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/workers/configuration/cron-triggers.mdx)

Pages Functions는 HTTP 요청을 처리합니다. 예약 실행은 별도 Worker의 `scheduled()`와 Cron 설정이 필요하며, 파일을 저장하는 것만으로 예약이 켜지지 않습니다. 이번 기본값은 수동·소량·모의 실행이고 운영 Cron을 등록하지 않습니다.

## 이메일·SMS 후보

| 용도 | 후보와 확인 범위 | 활성화 전 남은 조건 |
| --- | --- | --- |
| 마케팅 이메일 | [Resend 공식 Node SDK](https://github.com/resend/resend-node)의 API 키 기반 전송 인터페이스를 확인했습니다. | 소유 도메인, SPF/DKIM/DMARC, 발신자 승인, 주소 확인, 반송·신고·차단 웹훅, 실제 수신 거부 URL, 현재 무료 한도·마케팅 허용 조건을 확인해야 합니다. Firebase 가입 확인 메일을 마케팅 발송용으로 전용하지 않습니다. |
| SMS | [Twilio 공식 Node SDK](https://github.com/twilio/twilio-node)의 계정 인증과 메시징 인터페이스를 확인했습니다. | 발신 번호·발신자 등록, 국가별 승인, 수신자 번호 검증, 별도 마케팅 동의, 단가·분할 메시지 수·통신사 수수료·월 번호 비용을 확인해야 합니다. 무료 또는 0원 발송으로 가정하지 않습니다. |
| 대안 제공자 | 국가별 공식 사업자 또는 이메일 API를 추가할 수 있습니다. | 기능·지역·단가·보관 조건을 동일 기준으로 검토하고 운영자 승인을 받아야 합니다. |

무료 한도의 정확한 숫자나 SMS 단가는 현재 공식 요금·계약을 확인하지 못했으므로 확정하지 않았습니다. 시험 코드가 SDK를 사용하거나 인증키가 입력되어도 실제 전송을 자동 활성화하지 않습니다. 이번 어댑터는 모의 발송을 기본으로 하고 운영 발송을 차단합니다.

### 국가별 SMS 제공자 비교

아래는 연결 후보 비교입니다. 한국·미국·일본·영국·EU 전체로 발송할 수 있다는 승인 목록이 아닙니다. 수신 국가별 지원 여부, 현지 발신자 유형과 광고 발송 허용 조건을 계정 소유자가 확인한 뒤 허용 목록에 넣어야 합니다. SDK의 오픈소스 라이선스도 문자 발송이 무료라는 뜻은 아닙니다.

| 후보 | 직접 확인한 공식 자료 | 먼저 검토할 수신 지역 | 승인 전에 확인할 내용·비용 |
| --- | --- | --- | --- |
| Twilio Programmable Messaging | [공식 Node SDK](https://github.com/twilio/twilio-node)는 서버 전용 인증과 메시지 API, 환경 변수·웹훅 검증·제한된 재시도를 설명합니다. | 미국·영국·일본·EU 등 목적지별 글로벌 연결 후보. 각 국가 지원·발신 규칙은 별도 확인합니다. | [국가별 가이드](https://www.twilio.com/en-us/guidelines), 발신 번호/발신자·미국 캠페인 등 필요한 등록, 별도 마케팅 동의·수신 거부, 국가별 단가·통신사 수수료·분할 수·번호 월 비용·계정별 한도. 현재 지원 국가와 요금을 검증 완료한 상태는 아닙니다. |
| AWS End User Messaging SMS v2 / SNS SMS | [공식 SMS v2 SDK](https://github.com/aws/aws-sdk-js-v3/tree/main/clients/client-pinpoint-sms-voice-v2)의 번호·Sender ID·수신 거부 목록, 등록·지출 한도 관련 API를 확인했습니다. [공식 SNS SDK](https://github.com/aws/aws-sdk-js-v3/tree/main/clients/client-sns)는 SMS Sandbox와 수신 거부 관련 API를 제공합니다. | 목적지별 글로벌 연결 후보. AWS 서비스 리전의 존재와 해당 수신 국가로의 발송 허용은 구분합니다. | IAM 최소 권한, 서비스 리전, Sandbox/운영 접근, 목적지별 발신 ID·번호 등록·광고 허용, 수신 거부 목록, 메시지 단가·통신사 비용·번호/등록 비용·월 지출 한도. [공식 SMS 안내](https://docs.aws.amazon.com/sms-voice/latest/userguide/what-is-service.html)와 [공식 요금](https://aws.amazon.com/end-user-messaging/pricing/)을 활성화 전에 다시 확인합니다. |
| SOLAPI | [공식 Node SDK](https://github.com/solapi/solapi-nodejs)는 서버 전용이며 한국의 SMS/LMS/MMS 지원을 명시합니다. | 한국 우선 검토. 이 자료만으로 해외 수신 지원을 추정하지 않습니다. | 사업자/계정 및 발신 번호 승인 요건, 광고 표기·무료 수신 거부 수단·야간 발송 규칙, SMS/LMS 구분과 단가·부가세·충전/월 한도·차단 처리·개인정보 위탁 조건을 [공식 개발자 문서](https://developers.solapi.com/)와 계약에서 확인합니다. |

직접 읽은 것은 위 SDK README 및 API 작업 목록입니다. 국가별 최신 규칙·요금 페이지와 실제 운영 계정 승인 상태는 아직 확인하지 않았습니다. 공급자 SDK의 시험 발송 예제를 실행하지 않았고, 추가 SDK 설치·발신 번호 구입·계정 생성도 하지 않았습니다. 현재 소스에는 이 후보들의 실제 전송 연결이 없으며 공통 어댑터가 실제 발송을 차단합니다.

운영자에게는 국가·채널·메시지 유형별로 `확인한 단가 × 제공자 기준 분할 수 + 통신사/등록/번호 비용`을 제시하고, 월 발송 수와 비용 상한을 함께 승인받아야 합니다. 문안 인코딩과 길이에 따른 과금 단위가 미확인이면 1건 또는 0원으로 계산하지 않습니다. 코드의 비용 검사에는 승인된 계산 결과만 전달하며, 현재 모의 입력을 실제 요금 원장으로 간주하지 않습니다. 공급자 측 지출 한도와 A1의 원자적 사용량 집계·중단 장치를 함께 검증하기 전에는 발송을 켜지 않습니다.

## 환율과 가격 자료

환율은 공급원·기준 통화·적용 시각과 유효기간이 있는 자료만 사용합니다. DEMO 환율은 시연을 위한 수치로 실제 환율이 아니며 실제 최저가의 근거가 될 수 없습니다. 외부 공식 환율 연결의 이용 조건과 허용 저장 기간도 별도 승인이 필요합니다. 정확한 배송비·세금·관세를 알 수 없는 판매처는 미확인으로 표시하며 0으로 채우지 않습니다.

공식 자료 후보로 [유럽중앙은행의 유로 기준 환율](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html)을 검토할 수 있습니다. 이번에는 해당 페이지·실시간 값을 직접 읽거나 환율 API를 연결하지 않았습니다. 실제 연결 전 EUR 기준과 KRW/USD/GBP/JPY의 제공 항목, 공표 일자·휴일 갱신 방식, 재사용 조건을 확인해야 합니다. 참고 환율은 판매처·카드사가 적용하는 결제 환율이나 수수료를 보장하지 않으므로 확인된 자료의 적용 범위를 표시해야 합니다.

## 증거와 확인 범위

이 조사에서 읽은 공식 소스는 위의 OAuth, Resend/Twilio/SOLAPI/AWS SDK 및 Cloudflare 문서입니다. 국가별 법령의 최신 원문·광고주별 계약·운영 API 권한·현재 발송 요금과 ECB 실시간 자료는 이 환경에서 모두 검증한 상태가 아닙니다. 검토할 공식 기관과 운영 승인 체크는 [운영 안내](GLOBAL-OPERATIONS.md)에 정리했습니다. 코드 테스트 통과, 운영 계정 승인, 실제 상품/메일/SMS 검증은 서로 다른 단계입니다.
