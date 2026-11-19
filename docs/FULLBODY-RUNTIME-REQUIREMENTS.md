# 전신 디지털 휴먼·의류 도입 조건

검토 기준: PR #4 `feature/product-fitting-lab`, `85761ab`, 2026-11-11. 이 문서는 도입 검토이며 런타임·모델·기존 화면을 바꾸지 않습니다. 기존 MakeHuman/얼굴 에셋의 추가 외형 수정을 중단하고 보존합니다.

## 현재 품질의 구조적 한계

현재 결과는 하나의 제작 파이프라인에서 만든 전신 디지털 휴먼이 아닙니다. CC0 인체와 별도 CC BY 얼굴 스캔을 접합하고, 일반 피부색과 일부 얼굴 맵을 사용합니다. 모발·안구·입·얼굴/몸 경계가 일관된 하나의 재질/리깅 시스템이 아니며 얼굴은 눈을 감은 정적 에셋입니다. 조명이나 색을 더 조정해도 이 차이를 해결할 수 없습니다.

`assets/avatar-geometry.js`의 상의는 인체 표면을 절단·평활화한 연결 셸입니다. 분리된 소매/몸통 문제를 줄인 예시지만, 실제 재단 패턴·봉제·원단·크기별 그레이딩을 제공받은 의류가 아닙니다. 기존 신체의 정점 위치를 이용하는 맞춤 방식이므로 다른 전신 모델에 그대로 적용할 수 없습니다. 사진의 두 비율은 시각적 변형 참고값이며 신체 치수·개인 3D 복원·상품 사이즈를 측정하지 않습니다.

또한 현재 `skin material`은 **피부 재질**을 뜻합니다. glTF `skins`의 **골격 스키닝**을 구현했다는 뜻이 아닙니다.

## 현재 코드에서 실제로 재사용할 부분

| 부분 | 현재 구현·위치 | 그대로 가능한 범위 |
|---|---|---|
| 입력·동의 | `assets/avatar-photo-bridge.js`, `assets/ai-studio.js` | 별도 동의 후 두 참고 비율만 같은 문서에서 전달, 이미지 표시 동의 분리, 삭제·수명 관리 |
| 사용자 조건 | `assets/avatar-geometry.js`의 `validate()`·`photoReference()` | 입력 범위 검증과 측정값/추정값 구분. 새 모델의 morph에 대한 실제 매핑은 별도 필요 |
| 카메라·조작 | `assets/avatar-lab.js` | 정/측/후면, 360도 회전·확대, Pointer Events·핀치·키보드, 상태/실패 안내 |
| 표시 수명 | `assets/avatar-lab.js`·`assets/lab-loader.js` | 같은 문서 진입, 초기화, 페이지 이탈 시 GPU/콜백/이미지 정리, 기존 모델 복구 |
| 회귀 근거 | `tests/human-material-browser.cjs`·기존 사진/검색/상담 검사 | 실제 픽셀·버튼·동의·삭제·API/외부 요청 부재. 실사 품질·실제 iPad GPU 성능 증명은 아님 |
| 기존 서비스 | 자연어 검색·무료 규칙 상담·로컬 2D 미리보기 | 3D 도입과 독립적으로 유지. 실제 승인 상품이 없는 상태는 그대로 명시 |

## GLB/GLTF 파일 교체만으로 로딩할 수 없는 이유

현재 `assets/avatar-lab.js`는 `getContext('webgl')`로 만든 WebGL 1 렌더러입니다. 정적 위치/법선/색의 9-float 버퍼와 별도 재질 태그/UV를 `drawArrays`로 그리며, 일반 glTF 런타임은 없습니다. `scripts/prepare-human-head.cjs`는 고정 해시의 단일 GLB만 읽는 오프라인 변환기이고 범용 로더가 아닙니다.

| 전신 에셋 기능 | 현재 지원 | 필요한 대응 |
|---|---|---|
| 정적 삼각형·법선 | 고정된 내부 데이터 형식 | 승인 에셋의 좌표계·단위·법선·재질별 primitive를 변환/검증 |
| 전체 UV·PBR | 얼굴 컬러/노멀 2개와 하드코딩한 재질 태그 | 전신/의류/눈/모발의 UV, normal/tangent, base-color·roughness/metallic·AO 등 재질 슬롯·색공간 처리 |
| 모발·속눈썹 투명도 | 일반 alphaMode·재질별 depth/sort 처리 없음 | 카드형 모발의 MASK/BLEND, double-sided·depth write·정렬을 에셋에 맞춰 구현하고 측면/후면 검증 |
| 여러 노드·재질·스킨 | 일반 node hierarchy·joint/weight·inverse bind 지원 없음 | 동일 rig와 rest pose, JOINTS/WEIGHTS·역바인드·노드 변환 처리. 정적 베이크와 체형 변경을 구분 |
| glTF morph targets | 없음. 기존 체형은 hm08 전용 정점 변형 | 허용된 body morph·의류 morph/보정 데이터를 함께 받아 CPU/GPU 결합. 이름 일치만으로 호환 인정하지 않음 |
| Draco/meshopt/KTX2 | 해당 디코더·트랜스코더 없음 | 지원된 오프라인 재출력 또는 검토한 디코더 도입. 모르는 `extensionsRequired`는 거부 |
| LOD·32비트 인덱스 | LOD 없음. 내부 인덱스는 Uint16로 복사 | 16비트 범위에 맞춘 primitive 분할 또는 검증된 uint 인덱스 경로. 큰 파일을 그대로 Uint16로 변환하면 안 됨 |
| 환경광·피부 확산 | 자체 조명 근사. 실제 전신 재질 패키지 아님 | 모델 제작자가 제공한 모바일용 재질·환경광 조건과 비교. 셰이더 추가만으로 실사 완성으로 표시하지 않음 |

glTF 2.0은 node/skin/morph/재질/alpha와 확장 구조를 별도로 정의합니다. 파일 확장자가 GLB라는 이유로 현재 구현이 그 기능을 지원하지는 않습니다. [Khronos glTF 2.0 사양](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)

적합한 에셋을 확보한 후 정적·불투명 단일 포즈만 먼저 검사할 수는 있습니다. 그러나 골격이나 morph를 버려 정적 정점을 얻었다면 **회전 가능한 정적 품질 샘플**이며 체형 맞춤 피팅으로 인정하지 않습니다. 필요한 기능이 많으면 핀 고정한 검증된 glTF 렌더 모듈을 격리하여 비교하는 편이 범용 로더를 임시로 직접 만드는 것보다 타당할 수 있습니다. 현재 작업에서 Three.js 전환이나 새 렌더러를 구현하지 않습니다.

`/avatar-lab*`의 CSP는 `connect-src 'none'`입니다. 일반 GLTFLoader의 같은 출처 `fetch`도 이 정책 아래에서 바로 동작하지 않습니다. 현행 고정 오프라인 데이터 포장은 이를 유지할 수 있지만 대형 전신 파일에는 비효율적입니다. 런타임 에셋 로딩이 필요해지면 자산 경로·헤더·정책을 별도로 검토해야 하며, **Preview의 `/api/*` 503 격리는 계속 유지**합니다. 지금 CSP나 API 보호를 완화하지 않습니다.

## 전신과 의류가 함께 충족해야 할 조건

1. 얼굴·목·몸·손·발·안구·머리카락이 하나의 제작/리깅 계열이고, 전면뿐 아니라 측면·후면에서도 피부색·법선·UV·모발 경계가 일관돼야 합니다.
2. 옷을 입은 사람을 통째로 스캔한 메시와, 옷을 갈아입힐 수 있는 인체+별도 의류 메시를 구분합니다. 단일 clothed scan은 얼굴/몸이 고품질이어도 갈아입기·체형 변경 완료 기준을 만족하지 않습니다.
3. 최소 첫 의류는 별도 메시의 실제 목둘레·어깨/진동·소매·앞/뒤판·옆선·밑단과 두께/재질을 가져야 합니다. 가능하면 원본 재단 패턴·그레이딩·기준 체형과 제작 단위도 확인합니다. 인체 표면의 복제 셸을 실제 상품 패턴으로 취급하지 않습니다.
4. 인체와 의류의 rest pose·skeleton·바인드·단위·morph 범위를 맞춰야 합니다. 옷의 같은 이름 morph에 실제 보정 형상이 있는지 확인하고, 원 제작 툴과 브라우저 출력을 비교합니다. body만 크게 늘리고 garment를 단순 스케일하는 방법으로 호환을 주장하지 않습니다.
5. 키/어깨/가슴/허리/골반/다리 입력과 승인된 morph의 매핑·범위를 문서화합니다. 범위를 벗어나면 제한/수동 보정 안내를 하며 사진에 없는 치수를 만들지 않습니다. 사진 비율은 별도 동의가 있어도 정확한 측정값이 되지 않습니다.
6. 정적인 고품질 의류에서 시작할 수 있지만, 체형 변경을 제공하려면 그 변화 범위에서 몸 관통·옷 자기 교차·목/소맷단 붕괴를 별도로 검증해야 합니다. 실제 판매 상품의 사이즈/착용감 보장은 원단·패턴·물리 검증이 없는 한 제공하지 않습니다.

## 도입 manifest: 권한과 기술 조건을 함께 고정

아래는 요구 항목이며 구현된 등록기나 승인된 자산 예시가 아닙니다. `true` 입력만으로 허가를 인정하지 않고, 모델/버전·계약/라이선스 원문·다운로드 파일의 해시와 연결한 운영자 검토 기록이 필요합니다.

```text
assetId / vendor / officialSource / version / reviewedAt
files: localPath, MIME, bytes, SHA-256, role(body/hair/eyes/garment/maps), dimensions
rightsEvidence: licenceId, licenceURL, savedTermsHash, attribution, approvalReference
rights: commercialUse, publicBrowserClientDelivery, modificationAndConversion,
        bodyMorphing, avatarCustomizationService, componentRedistribution
components: body/hair/eyes/clothes/maps 각각의 권리자와 적용 조건
geometry: units, axis, pose, topologyHash, triangles, primitive/material counts
rig: skeletonHash, inverseBindHash, jointMap, garmentRigCompatibility
morphs: names, ranges, measurementMapping, bodyAndGarmentTargetHashes
extensionsUsed / extensionsRequired / supportedRuntimeProfile
memoryAndLOD: downloadBytes, decodedGeometryBytes, decodedTextureBytes,
              workingSetEstimate, LOD variants, maxTextureDimensions
reviewStatus: candidate -> rights-verified -> technical-verified -> browser-verified
```

특히 **상업 이용 허용**과 **원본에 가까운 GLB/텍스처를 방문자 브라우저에 전달하는 권리**를 별도로 확인합니다. 결과 영상 렌더 허용, 편집 툴 내부 이용 허용, 게임에 포함 허용이라는 문구만으로 재다운로드 가능한 웹 아바타 커스터마이징 서비스의 권리를 추정하지 않습니다. 공유 저장소가 MIT여도 모델별 라이선스가 따로 있으면 후자를 확인합니다.

파일은 공식 배포처에서 받은 고정 파일만 사용하고 외부 URI·HTML/스크립트·알 수 없는 필수 확장·과도한 디코딩 크기를 차단합니다. [공식 glTF Validator](https://github.com/KhronosGroup/glTF-Validator)는 구조·접근자·참조 등 형식 검사에 사용할 수 있으나, 저작권·외형 품질·체형 호환·피팅 정확도를 승인해 주는 도구는 아닙니다.

## iPad Safari: 가능성과 미검증을 분리

Safari 15의 WebGL 2 도입은 공식 WebKit 자료로 확인됩니다. 이는 특정 고품질 모델·메모리·확장·프레임 성능을 보장하지 않습니다. 현재 렌더러는 WebGL 1을 요청하며, 기존 결과는 Linux 소프트웨어 Chromium의 터치 모사입니다. 실제 iPad Safari·앱 내부 브라우저의 새 모델 검증 자료는 없습니다. [WebKit Safari 15 기능](https://webkit.org/blog/11989/new-webkit-features-in-safari-15/)

JPEG 파일 크기는 GPU 메모리 크기가 아닙니다. 예를 들어 RGBA 1024² 1장은 기본 4MiB이고 mip 포함 약 5.33MiB입니다. 현재 얼굴 2맵을 별도 WebGL 컨텍스트 2개에 올리면 약 21.3MiB이며 메시·프레임버퍼·AA·브라우저 메모리는 별도입니다. 2048² RGBA 4맵이면 mip 포함 약 85.3MiB/컨텍스트, 두 화면은 약 170.7MiB로 커집니다. 실제 포맷/드라이버 할당은 달라질 수 있습니다. 범용 고정 VRAM 조회/보장에 의존하지 않고 메모리 추정과 품질 단계를 마련해야 합니다. [Mozilla WebGL 메모리·호환성 지침](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices)

첫 후보의 **프로젝트 검토 시작 예산**으로 전신+의류+눈+모발 10만 삼각형 이하, 재질 draw group 16개 이하, 전송 15MiB 이하, 단일 컨텍스트의 디코딩 텍스처 64MiB 이하를 제안합니다. 이는 Safari의 공식 제한이나 성능 보증값이 아니며 시각적 품질·실제 대상 iPad 측정 후 조정해야 합니다. 외형을 심하게 손상시키는 단순 감축은 통과로 보지 않습니다. 한 컨텍스트의 두 view/공유 리소스 사용은 향후 중복 메모리를 줄이는 선택지입니다.

실제 대상 기기/OS를 기록하고, 세로·가로에서 처음 로드/360도 드래그·핀치/의류 교체/체형 최소·최대/백그라운드 복귀/삭제를 검사해야 합니다. 실제 표시 프레임 시간·정지/메모리/context loss를 기록하며 강제 `gl.finish`, Playwright 클릭 왕복, 단순 명령 제출 시간을 FPS로 바꾸지 않습니다. 최초 잠정 수용 목표는 표시 프레임 p95 33.3ms 이내(30fps 수준)로 두되, 실제 기기 표시 측정이 없으면 미검증입니다.

## 도입 판단

**격리 시험 GO**는 모델별 상업/웹 클라이언트 배포·필요한 변형/아바타 서비스 권한을 확인한 후보가 있고, 필수 런타임 기능을 보존할 수 있는 검증 계획이 있는 경우입니다. 첫 단계는 승인된 전신 1개+의류 1개를 격리해 원 제작 렌더와 전·측·후면을 비교하는 것입니다. 기존 서비스·에셋은 교체하지 않습니다. 체형 변형 권한/데이터가 없는 정적 모델은 허용된 정적 품질 시험 범위에만 둡니다.

**기존 체험 통합 GO**는 일관된 전신과 별도 의류, 필요한 rig/morph·재질 기능, 실제 브라우저 품질과 대상 iPad 성능·기존 기능 회귀가 확인된 뒤에만 가능합니다.

라이선스·웹 전달권 미확인, 얼굴만 있는 모델, 정적 clothed scan을 체형 맞춤으로 주장하는 경우, 헤어/눈/재질 기능을 버려야만 로딩되는 경우, 의류 보정 데이터 부재, 실제 iPad 성능 미검증은 각각 명시적인 **NO-GO 사유**입니다. 현재 코드 검토만으로 고품질 전신 에셋이 확보됐거나 새 피팅룸이 완성됐다고 판단할 수 없습니다.

이번 검토에서는 런타임·HTML·기존 에셋·운영 데이터·Cloudflare 설정을 변경하지 않고 기존 성공 테스트도 다시 실행하지 않습니다.
