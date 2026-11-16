# 독립 전신 glTF 렌더링 검증

2026-11-16 · PR #4 `feature/product-fitting-lab`. 기존 인체·사진 분석·검색·상담·WebGL 1 체험은 교체하지 않았다. 새 `gltf-proof.html`은 Preview 호스트에서만 실행되는 기술 검증이다.

## 실제 구현과 화면

- Three.js 0.187.0의 GLTFLoader·OrbitControls를 **로컬 배포**한다. 공식 npm tarball의 SHA512를 확인하고 MIT 원문·파일별 원본/수정 해시를 보존했다. CDN·import map·유료 API를 사용하지 않는다.
- vendor 변경은 addon의 상대 import 경로와 upstream의 혼합 공백 들여쓰기 한 줄뿐이며, 원본 복원 해시 검사로 그 범위를 검증한다.
- 기존 CC0 전신과 연결형 예시 티셔츠 3개의 실제 삼각형을 self-contained GLB로 변환했다. 파일은 약 1.26MiB, 19,352정점·37,920삼각형(모든 옷 포함)이다. 화면에는 전신과 선택한 옷 1개만 그린다.
- 실제 GLTF `SkinnedMesh` 4개와 Root/Spine 두 joint를 로드한다. 두 joint는 렌더러 동작 검사이며 새 인체 리깅·사용자 체형 복원이 아니다. body/garment가 동일한 기준의 skin weight를 사용한다.
- 정면·측면·후면과 360도 드래그, 두 손가락 확대·축소, 키보드 조작, 티셔츠 3종/착용 전 비교, PBR/기본 재질 비교, 실제 골격 변형을 제공한다.
- 읽기 실패·WebGL 2 미지원·실제 context loss를 구분해 화면에 안내하고 수동 재시도·기존 WebGL 1 체험 링크를 제공한다. 초기 로딩과 실패는 캔버스 위에도 표시한다.

실제 브라우저에서 찍은 화면:

| 화면 | 증거 |
|---|---|
| 태블릿 세로 전체 화면 | [한국어 820px](validation/gltf-proof/ko-820-overview.png) |
| 정면·측면·후면 | [정면](validation/gltf-proof/ko-820-front.png) · [측면](validation/gltf-proof/ko-820-side.png) · [후면](validation/gltf-proof/ko-820-back.png) |
| 실제 skin 변형 | [골격 변형](validation/gltf-proof/ko-820-skin-proof.png) |
| 티셔츠 교체·착용 전 | [기본](validation/gltf-proof/ko-820-LAB-A.png) · [여유형](validation/gltf-proof/ko-820-LAB-B.png) · [짧은형](validation/gltf-proof/ko-820-LAB-C.png) · [착용 전](validation/gltf-proof/ko-820-none.png) |
| 태블릿 가로 영어 화면 | [영어 1180px](validation/gltf-proof/en-1180-overview.png) |

## 화면 검토로 발견·수정한 오류

GLB 최초 변환에서 기존 draw stream의 마지막 부분을 인체로 가정한 색상 추출 오프셋이 틀렸다. 실제 원본에는 인체 앞에 바닥, 뒤에 눈 도식이 있어 다른 삼각형의 색상이 인체에 연결됐고 얼굴·한쪽 다리에 어두운 조각이 보였다. 원본 정점·법선·삼각형은 변경하지 않고, indexed body 좌표와 전체 source stream을 일치시켜 색상만 정확히 추출하도록 수정했다. 모든 코너의 좌표·법선 확인과 각 정점의 원본 색상 대조 회귀 검사를 추가했다.

기본 재질 비교에도 원본 `vertexColors`를 유지하며, 화면의 의류 색상 이름을 실제 재질과 맞췄다. 최종 스크린샷과 `browser-result.json`은 수정 후 GLB·manifest·페이지·JS·CSS의 해시를 기록한다. 초기 깨진 화면을 최종 증거로 사용하지 않는다.

## 권리·격리·비용

전신 원본은 고정된 MakeHuman hm08 **CC0**이며 원본/변환 해시·공식 권리 근거는 기존 [인체 라이선스 기록](HUMAN-MESH-LICENSE.md)에 보존했다. 이번 GLB에는 별도 CC BY 얼굴 스캔을 포함하지 않았다. 기존 연결형 예시 의류도 CC0 파생 자료로 고지한다. MakeHuman의 별도 AGPL 프로그램 코드를 반입하지 않았다. Three.js는 **MIT**이며 원문을 함께 배포한다.

- 새 페이지에서 고정된 동일 출처 manifest/GLB만 GET으로 읽고, 바이트·SHA256·권리 고지·외부 URI 부재를 확인한다. 추가 URL 로딩은 LoadingManager가 거부한다.
- 개인 사진·분석 비율·입력 치수를 읽거나 저장·전송하지 않는다. 공용 언어 선택기의 언어 설정 외에 저장소를 사용하지 않는다.
- 새 페이지에만 정적 glTF 읽기를 위한 `connect-src 'self'`를 적용했다. 기존 avatar의 `connect-src 'none'`과 Preview `/api/*` 503 보호는 유지한다. Production 호스트에서는 모델을 읽거나 렌더링하지 않는다.
- 모델·재질·geometry·skeleton·GPU 컨텍스트를 삭제/이탈/재시도 시 정리한다. 늦게 도착한 비동기 결과도 이전 화면에 적용하지 않는다.
- 실행 중 결제·유료 AI·외부 이미지 처리·상품 수집·발송·Cron·회원/운영 DB 연결은 없다. 렌더링은 방문자 기기 GPU에서 수행한다.

## 검증

```bash
node --test tests/gltf-proof.cjs tests/gltf-proof-export.cjs
node tests/gltf-proof-browser.cjs
node scripts/build-site.cjs
node scripts/check-public-artifacts.cjs
```

새 단위/권리/구조 검사 **9/9**, 기존 workflow와 같은 전체 오프라인 검사 **316/316**, 정적 빌드·공개 파일 노출 검사를 통과했다. 기존 국내 검색·조건 기반 무료 스타일리스트 브라우저 검사의 성공 근거도 확인했으며 해당 런타임 파일은 변경하지 않았다.

최종 브라우저 검사는 Linux Chromium/SwiftShader의 데스크톱 1280×900, 터치 태블릿 세로 820×1180, 가로 1180×820에서 실행했다. 실제 픽셀 변화로 전·측·후면, 360도, 세 의류/착용 전, skeleton/PBR 변화, 드래그·핀치·키보드, 삭제 시 GPU 메모리 정리·재시도를 확인했다. 모델 읽기 실패, WebGL 2 부재, 실제 context loss, Production 실행 차단, 외부/API 요청 부재도 검사했다. [기계 판독 결과와 소스 해시](validation/gltf-proof/browser-result.json)를 함께 보존한다.

시간 기록은 CPU의 render 명령 제출 시간이다. GPU 표시 프레임·FPS나 실제 iPad 성능으로 환산하지 않는다. **실제 iPad Safari 접근·성능·앱 내부 브라우저 검증은 미실시**다.

## 남은 한계와 판단

이 실행 환경의 허용 목록에는 여전히 `vtubeme.com`이 없다. 이미 확인한 CONNECT 403을 반복 호출하거나 우회하지 않았다. Nova의 공식 CC BY 4.0 안내와 별개로 실제 바이너리·내부 권리·체형 morph·독립 의류는 미검증이며 **이번에 확보한 새 고품질 전신 모델은 0개**다.

따라서 **독립 glTF 로딩·스키닝·재질·예시 의류 교체 기술 검증은 완료**, **실사형 디지털 휴먼·실제 상품 피팅 출시는 NO-GO**다. 현재 예시 인체의 얼굴·모발·의류 형상을 새 실사형 품질로 주장하지 않는다. 권리 검증한 일관된 고품질 전신과 분리 의류/rig·체형 보정 자료, 실제 iPad 성능 검증이 후속 조건이다. PR #4는 Draft/미병합으로 유지한다.
