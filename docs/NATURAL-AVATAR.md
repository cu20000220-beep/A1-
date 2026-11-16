# 실제 전신 모델로 교체한 내추럴 인체 Preview

사용자가 제시한 자연스러운 인물·의류 이미지를 품질 방향으로 삼는다. 이번 변경은 기존 마네킹에 색을 칠한 변경이 아니라, **얼굴·피부·눈·모발·의상이 함께 있는 별도의 실제 전신 GLB**를 기본 모델로 불러오는 첫 단계다. 참고 포스터와 같은 실사 품질 완성, 사용자 사진 복원, 남녀 맞춤 인체 생성, 실제 상품 갈아입히기 완료를 뜻하지 않는다.

## 실제 확보한 모델과 권리

- 제작자 공식 저장소: [avatarsdk/metaperson-loader-threejs](https://github.com/avatarsdk/metaperson-loader-threejs/tree/ba6eb2505ea3e4d05874bdf7c31a4e45003653d4)
- 정확한 파일: `public/models/sample_avatar.glb`, 원본10,662,760bytes, SHA256 `62fb69d6a9ebe720d9028af1c48aa222c7ccfabeccbd642b7f9d7758b64f4d82`
- [공식 BSD-3-Clause 고지](https://github.com/avatarsdk/metaperson-loader-threejs/blob/ba6eb2505ea3e4d05874bdf7c31a4e45003653d4/LICENSE.txt). 해당 라이선스와 GLB가 동일 최초 커밋 `9047f2b56c639a8653a1a3cc7e37a547f1cacf4d`에 함께 공개됐으며 모델별 예외 고지를 찾지 못했다. 출처·원본/출력 해시·라이선스 원문은 공개 패키지 manifest/`LICENSE.txt`에 보존한다. 상업적 source/binary 배포에 필요한 저작권·조건·면책 고지와 비보증 조건을 유지한다.
- 개별 소스의 proprietary 헤더가 있는 `AvatarController.js`와 `utils.js`는 반입하지 않는다. 자세·머리카락·이미지 로딩은 기존 Three.js 기능과 별도 작성한 A1 코드로 처리한다. 저장소 샘플 이용권을 유료 생성 서비스·개인 사진 처리·새로운 모델 생성 권한으로 확대 해석하지 않는다.

실제 데이터는 47,293정점, 49,833삼각형, 73관절, 얼굴 morph118개, 11개 메시/재질과 내장 이미지23개다. 원본은 고정된 stock 샘플로, 특정 이용자의 얼굴·체형이나 성별을 추정한 결과가 아니다.

## 실제 코드와 모바일 최적화

- `scripts/prepare-natural-avatar.py`: 고정 원본·라이선스 해시를 확인하는 오프라인 변환기. geometry·accessor·스키닝·morph·재질 선언과 비이미지 바이트를 보존하며 내장 이미지와 bufferView 오프셋만 재패키징한다. 얼굴·모발 주요1K맵은 바이트까지 원본 그대로 유지한다. 나머지 큰 맵을512로 줄이고 축소한 normal map을 정규화한다.
- `assets/natural-avatar/sample.glb`: 8,634,928bytes, SHA256 `f3626960d185720d76ed1e2a6d0dc3c1a42c59275a2863e96c0d34d11c47dad2`. 모든 이미지의 RGBA+mip 보수적 추정은98.67→**46.67MiB**다. GPU 전체 메모리나 실제 iPad 성능 수치가 아니다.
- `assets/natural-avatar-profile.js`: 실제73관절을 이용해 T자 자세의 팔을 아래로 낮추고 자연스러운 표시 자세를 만든다. 같은 skin을 쓰는 몸·의상이 함께 움직인다. 실제 입력 치수를 생성하지 않으며1.7m는 화면 표시를 정규화하는 기준값이다. 모발은 실제 hair-card mesh를 유지하고 alpha cutout으로 겹친 반투명 사각형을 줄인다. 얼굴·모발·의류 메시를 붙인 단순 도형으로 대체하지 않는다.
- 기존 `gltf-proof.html/js`의 기본 모델이 새 인체다. 동일 컨트롤로 정면/측면/후면·360도·핀치·확대·PBR/텍스처 유지 기본 재질·골격 비교·삭제/재시도를 제공한다. 기존 인체와 SF 외형은 비교 옵션에 보존한다.
- 새 인체는 원본 의상 한 벌만 표시한다. 실제 상품이나 다른 의상 mesh를 확보하지 않았으므로 의상 변경을 잠그고 준비 상태를 명시한다. 기존 비교 모델의 시험 티셔츠3종은 계속 동작한다. 의상 색만 바꾸어 상품 교체처럼 표시하지 않는다.
- 기존 사진 기반 연구실에는 **내추럴 인체 샘플·체형 수치 미적용** 링크를 추가한다. 새 모델이 사용자 분석값을 적용한 것처럼 연결하지 않는다.

## 개인정보와 Preview 보호

검증된 동일 출처 manifest/GLB만 credential 없이 GET한다. 고정 파일명·용량·SHA256·라이선스와 외부 URI 부재를 검사한다. GLTFLoader가 검증된 GLB에서 만든 동일 출처 Blob 이미지 URL만 허용한다. ImageElement 기반 로더로 기존 `img-src blob:` 권한을 사용해 이미지를 디코딩하므로 **기존 `connect-src 'self'`를 확대하지 않았다**. 기존 WebGL1 페이지의 `connect-src 'none'`과 Preview API503 격리도 유지한다.

개인 사진·체형 분석값·계정·Firebase·운영 DB·유료 AI/상품 API와 연결하지 않는다. 모델·재질·텍스처·skeleton·GPU 컨텍스트를 삭제·이탈·전환·실패 시 정리한다. 이미 요청한 원격 데이터가 늦게 도착해도 이전 화면에 적용하지 않는다. Production 호스트에서는 실행하지 않는다.

## 검증과 실제 화면

신규 패키지 검사4개를 포함한 전체 오프라인 검사 **320/320**, 빌드·공개 산출물 노출 검사를 통과했다. 원본과 geometry/morph/skin 동일성 및 주요 얼굴/모발 맵 원본 보존, 파생 해시와 권리 고지를 검사한다.

`node tests/natural-avatar-browser.cjs`는 Linux Chromium/SwiftShader의1280×900·터치820×1180·1180×820, 한국어/영어에서 실제 텍스처 인체·얼굴,73관절, 전·측·후면, 확대·터치, 실제 스키닝, 원본 의상 제한, 기존 인체 전환, 텍스처가 유지되는 기본/PBR 비교, 삭제GPU정리·재시작, 외부/API요청 부재·CSP를 검사한다. 기존 인체·티셔츠와 SF 모습의 회귀 브라우저 검사도 유지한다.

- [정면](validation/natural-avatar/ko-820-front.png), [측면](validation/natural-avatar/ko-820-side.png), [후면](validation/natural-avatar/ko-820-back.png), [얼굴](validation/natural-avatar/ko-820-face.png)
- [태블릿 전체 화면](validation/natural-avatar/ko-820-overview.png), [영어 가로](validation/natural-avatar/en-1180-overview.png)
- [실제 브라우저 결과·소스 해시](validation/natural-avatar/browser-result.json)

**실제 iPad Safari·앱 내부 브라우저의 GPU/메모리 성능은 미검증**이다. CPU 명령 제출 시간을 FPS로 표현하지 않는다. 참고 이미지와 같은 인물 품질, 사용자 사진/치수 기반 개인화, 남녀 모델, 상품 이미지 사용권과 실제 의류 갈아입히기·정확한 핏은 후속 개발이다. 이 단계는 첫 실제 텍스처 전신 교체이며 전체 실사형 피팅 완성으로 보고하지 않는다.
