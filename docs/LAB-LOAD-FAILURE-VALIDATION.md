# 960790f4 연구실 열기 실패: 원인과 수정

## 확정 원인·재현

기존 Preview 960790f4의 홈·avatar-photo-bridge.js·lab-entry.js·avatar-lab.js·product-lab.js·avatar-geometry.js는 PR #4의 3aa3b7b 소스와 바이트 단위 일치했습니다. 소스/배포 불일치가 아니었습니다.

| 실제 요청 | 추적하지 않은 응답 | 결과 |
| --- | --- | --- |
| /avatar-lab.html | 308 Location: /avatar-lab | 기존 redirect:error fetch가 거부됨 |
| /product-lab.html | 308 Location: /product-lab | 동일 원인으로 추천/비교/2D도 실패 |
| /avatar-lab, /product-lab | 200 text/html | 정식 템플릿 경로 |
| 두 로더 및 관련 JS | 200 application/javascript | 소스 일치·defer 순서 정상 |

기존 페이지 응답에서 CSP가 fetch를 차단한 것이 아닙니다. 홈에는 제한 CSP가 없고 product-lab은 connect-src self입니다. 독립 avatar-lab의 connect-src none은 유지되며 자체 HTML이 이미 있어 템플릿 fetch를 하지 않습니다. JS는 nosniff에 맞는 MIME이고 정적 캐시는 max-age=0/must-revalidate, 템플릿은 no-store였습니다.

**기존 원격 검사의 결함:** 환경 TLS 프록시를 이용한 APIRequest.get이 308을 자동 추적한 뒤 200을 브라우저에 전달해 실제 redirect:error 실패를 가렸습니다. 이제 maxRedirects:0으로 상태/Location을 브라우저에 그대로 전달합니다. 수정 전 실제 Preview에서 사진 분석(이 재현만 고정 자세 fixture) 후 동의→3D 및 추천 버튼이 두 오류 문구를 그대로 출력하는 것을 확인했습니다. 앱 전용 오류라고 단정하지 않습니다.

## 수정

- 공통 `assets/lab-loader.js`: 허용된 동일 출처 canonical `/avatar-lab`, `/product-lab`만 요청. `redirect:error`, credentials omit, no-store 유지. 예상치 못한 이동/출처 우회 허용 없음.
- 12초 요청 제한, HTTP·MIME·템플릿·스크립트·초기화·WebGL 오류 구분. 원시 응답/사진/수치를 오류나 로그에 넣지 않음.
- 두 진입 모듈이 공통 로더를 사용하고 명시적인 ready 상태를 확인. dispatchEvent는 리스너 오류를 호출자에 전달하지 않으므로 명시적 초기화 함수를 호출해 실패를 포착.
- 네트워크/응답 오류는 같은 문서에서 재시도 가능. 실행 코드/초기화/그래픽 문제는 사진 재선택이 필요한 새로고침을 명시. 독립 canonical 연구실 링크와 Safari 열기 안내 제공하며 사진/분석은 전달하지 않음.
- 성공/삭제 후 기존 번역 바인딩에 남아 있던 오류가 다시 표시되지 않도록 상태를 바인딩 API로 정리. 로딩 중 삭제/철회에는 지연된 화면을 mount하지 않음.
- 자산 버전을 canonical-1로 변경. main/Production·Cloudflare 운영 변수·Firebase/DB·회원/구독·유료 API·결제 변경 없음. Preview API 격리 유지.

주요 수정: lab-loader.js(신규), avatar-photo-bridge.js, lab-entry.js, avatar-lab.js, product-lab.js, 홈/연구실 HTML, 스타일과 공개 빌드 목록·검사.

## 검증

- 기존 단위·권한/개인정보 검사 237개 및 새 실제 DOM AbortError 분류 검사 1개. CI에서 전체 실행.
- 실제 308을 반환하는 정적 브라우저 검사로 교체. 사진 기반 3D KO/EN·세로/가로/모바일 6개와 홈 추천→카드→비교→2D/삭제 6개 통과.
- 강제 오류 9개: 요청 차단, HTTP 503, JSON MIME, 잘못된 HTML, 실행 코드 없음, 초기화 예외, WebGL 미지원 및 product HTTP/초기화. 기존 .html fetch 실패를 재현하고 올바른 코드·안내·독립 링크·네트워크 재시도를 확인.
- 아바타 지연 응답의 삭제/철회/재동의 3개, 추천 템플릿 로딩 중 삭제 후 새 분석 재시도 1개 통과.
- 새 실제 Preview는 리디렉션 비추적 네트워크·콘솔·실제 MediaPipe·WebGL/2D 픽셀로 검증하며 최종 URL·화면은 PR #4 본문에 기록.

브라우저 엔진은 Linux 터치 Chromium입니다. WebKit 실행 시도는 `/home/agent/.cache/ms-playwright/webkit-2336/pw_run.sh` 부재로 불가했습니다. 실제 iPad Safari·ChatGPT 앱 WKWebView 기기는 연결돼 있지 않습니다. 표준 리디렉션 실패는 재현했으나 실기기 최종 합격으로 대체하지 않으며, 그 전 PR #4 병합을 보류합니다.

## 실제 배포 증거

- 코드 561d6ce / Preview 711715b4에서 `maxRedirects:0`을 유지한 실제 응답으로 검사. 실제 MediaPipe 분석→동의→3D 픽셀 변화·사진 비교·의류·수동 보정·추천 카드 3개·비교 표·2D·전체 삭제 통과. canonical 템플릿은 모두 200 text/html, 리디렉션 없음. UI API 요청 0건·JS 예외 0건·격리 503 유지.
- GitHub isolated-checks 전체 238개 및 Pages 성공. 별도 Worker a1 실패는 유지하며 삭제/우회하지 않음.
- [기존 실제 오류 재현](validation/lab-loader/old-errors.png) · [수정 후 실제 사진/3D](validation/lab-loader/new-photo-avatar.png) · [시험 의류 전후](validation/lab-loader/new-clothed.png) · [추천 카드](validation/lab-loader/new-cards.png) · [2D 결과](validation/lab-loader/new-2d.png). 모두 저장소 예시 사진이며 사용자 회원/사진이 아닙니다.
- 증거 기록 커밋은 문서/화면만 추가합니다. 최종 고정 Preview와 추가 실제 콘솔 검증 결과는 PR #4 본문에 기록합니다.
