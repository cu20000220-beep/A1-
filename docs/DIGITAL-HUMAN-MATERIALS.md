# 디지털 휴먼: 검증된 얼굴 스캔과 재질 개선

2026-11-11, PR #4 `feature/product-fitting-lab`. 실사형 전신 피팅룸의 완성이 아니라 **기존 마네킹의 얼굴·피부 표현을 개선한 단계**입니다.

## 재사용과 이번 구현

PR #1 `bf40968`, PR #3 `ae4497b`, PR #4 시작점 `513669c` 및 CI를 확인했습니다. 실제 코드는 Three.js가 아닌 자체 WebGL 렌더러입니다. 새 프레임워크나 체형/의류 엔진을 재개발하지 않고 기존 CC0 인체, 연결된 예시 의류, 치수 조절·동의 기반 사진 비율·2D 사진 배치·360도 조작을 유지합니다.

효과가 큰 얼굴·피부 표현부터 개선했습니다. 출처와 이용 조건을 확인한 얼굴 스캔을 기존 인체에 선택적으로 연결하고, 일반 피부/원단 재질을 구분하는 자체 GGX 조명·거칠기·완만한 피부 확산과 톤 매핑을 적용했습니다. 원래 범용 머리와 기본 재질도 비교·복구할 수 있습니다.

- 스캔의 목은 잘라 기존 목에 맞추되 어깨·몸통·의류를 자르지 않습니다. 기존 눈 도형은 스캔 사용 시에만 제외합니다. 키 변경은 얼굴을 이동하며 얼굴 비율은 유지하고 목 접합 부분만 체형 폭에 맞춥니다.
- 몸의 일반 피부색은 이 **공개 에셋의 목 재질**과 조화시키며 사용자 사진에서 얼굴·피부색을 추정하지 않습니다. 사용자의 분석 사진과 별개인 범용 모델입니다.
- 2개의 고정된 같은 출처 JPG만 브라우저 이미지로 읽습니다. `connect-src 'none'`를 유지합니다. 외부 모델 URL·외부 처리·사진 업로드·유료 API가 없습니다. 자산 검증 실패·이미지 오류/10초 초과 시 기존 인체를 유지하며 자동 재시도하지 않습니다. 새 셰이더가 실패하면 기본 재질을 사용합니다.
- 페이지 이탈 시 이미지 콜백과 타이머를 해제하고 GPU 버퍼/텍스처를 지웁니다. 기존 사진·분석값 삭제 흐름은 재사용합니다.

## 검증된 모델·이미지와 라이선스

전신은 기존 MakeHuman hm08 **CC0**입니다. [기존 출처 문서](HUMAN-MESH-LICENSE.md)를 보존합니다.

범용 머리는 **Infinite, 3D Head Scan by Lee Perry-Smith**, **CC BY 3.0 Unported**입니다. 공식 Three.js 샘플의 파일별 원문 라이선스를 확인했고 프로그램 코드/렌더러는 복사하지 않았습니다. 원본 고정 커밋은 `b5a9e5730f6122498e187da8f7cdedd4358f5aa0`입니다.

| 자료 | 공식 원본 | SHA-256 |
|---|---|---|
| 머리 GLB | [LeePerrySmith.glb](https://raw.githubusercontent.com/mrdoob/three.js/b5a9e5730f6122498e187da8f7cdedd4358f5aa0/examples/models/gltf/LeePerrySmith/LeePerrySmith.glb) | `402b8a8ac9f03232e6d64b5962929703a069daf99d3c49ac8eb0e48bedc9c576` |
| 컬러 사진 | [Map-COL.jpg](https://raw.githubusercontent.com/mrdoob/three.js/b5a9e5730f6122498e187da8f7cdedd4358f5aa0/examples/models/gltf/LeePerrySmith/Map-COL.jpg) | `e976d73b31407f8d0967412bf468019ed26a5d5a32cf5811aabff7e816458a65` |
| 노멀 맵 | [Infinite-Level_02_Tangent_SmoothUV.jpg](https://raw.githubusercontent.com/mrdoob/three.js/b5a9e5730f6122498e187da8f7cdedd4358f5aa0/examples/models/gltf/LeePerrySmith/Infinite-Level_02_Tangent_SmoothUV.jpg) | `36925e51ad9b324b94e8faf4692da1b4132809f2762bb8d5bd549ffd215d4ca6` |
| 원문 라이선스 | [LeePerrySmith_License.txt](https://raw.githubusercontent.com/mrdoob/three.js/b5a9e5730f6122498e187da8f7cdedd4358f5aa0/examples/models/gltf/LeePerrySmith/LeePerrySmith_License.txt) | `7cf4da43a6ae6d32f7f7d063fe129a19468af6f4fe7c53b937f83959709fcb50` |

원문은 “Creative Commons Attribution 3.0 Unported License”와 “always mention where you got them from”을 명시합니다. 출처·저자·라이선스·A1의 목 절단/접합·통합 변경을 3D 화면, `credits.html`, `assets/HUMAN-HEAD-LICENSE.txt`와 이 문서에 표시합니다. 모델의 서비스 추천·보증을 뜻하지 않습니다.

원본 GLB는 404,976바이트입니다. 자체 오프라인 변환기 `scripts/prepare-human-head.cjs`는 이 정확한 해시만 받아 머리 영역을 남기고 목·법선을 보정합니다. 임의의 외부 GLTF를 로드하지 않습니다. 파생 정적 데이터 `assets/human-head.js`는 8,507정점·16,213삼각형, 약 844KB이며 1024×1024 컬러/노멀 JPG는 원본 그대로 총 약 295KB입니다. 기존 예시 상의 장면은 32,972→38,863삼각형으로 약 18% 증가합니다. 렌더링 데이터 버퍼는 화면당 약 4.75→5.60MB이며 이미지 텍스처/GPU 부가 메모리는 별도입니다.

## 검사와 실제 한계

`tests/avatar-geometry.cjs` 11개와 `tests/human-head.cjs` 4개는 기존 의류/체형 불변성, 정상 법선·UV·깊이, 허가되지 않은 교체 거부, 정확한 원본 이미지/라이선스 해시, 키를 바꿔도 얼굴 비율 보존을 검사합니다. 전체 GitHub CI와 Preview 결과는 PR #4에 기록합니다.

`tests/human-material-browser.cjs`는 데스크톱 1440px·터치 820/390px에서 실제 스캔/원본 머리·스튜디오/기본 재질 픽셀 변화, 24회 실제 회전으로 360도 이상, 전/측/후면·마우스/터치·의류 3종·체형·삭제·출처 표시를 검사합니다. 이미지 차단 시 한국어/영어 복구 안내, 새 셰이더 강제 실패 시 기본 렌더링도 확인합니다. 실제 Preview에서도 배포 자산과 렌더링을 확인하며 주소는 PR #4에 남깁니다.

성능은 Linux 소프트웨어 Chromium에서만 비교했습니다. 비침습 검사에서 회전 명령 제출 p95는 기본 약 0.4–0.8ms, 스튜디오 약 0.2–0.3ms였습니다. `gl.finish`를 넣는 검사는 강제 GPU 동기화 때문에 수백 ms 지연이 생겨 **FPS 근거로 사용하지 않습니다**. 이 수치는 화면 표시 FPS나 실제 iPad 성능을 보증하지 않습니다. 실제 iPad Safari/앱 내부 브라우저는 미검증입니다.

모델은 **눈을 감은 대머리의 정적 범용 스캔**입니다. 머리카락·눈 애니메이션·사용자 얼굴 복원·전신 실사 스캔·정확한 신체 치수/사이즈·실제 상품 3D 착용·원단 물리는 미완료입니다. 의류는 기존 연결된 반소매 예시이며 셔츠/바지/아우터의 실제 패턴 모델을 새로 만들었다고 표시하지 않습니다. 실제 승인 상품도 여전히 0개이며 가짜 상품/사진/가격을 만들지 않습니다.

공식 hm08용 고품질 피부 팩은 확인했지만 `files2.makehumancommunity.org`가 환경 네트워크 정책에 막혀 파일 확보·개별 검증은 미완료입니다. 원본 UV 복원은 격리된 개발 자료에서만 검토했고, 출처가 불명확한 대체 피부나 라이선스 표시가 혼재한 예전 matcap은 채택하지 않았습니다. 이번 구현은 접근 가능한 공식 GitHub 에셋으로 진행했으며 추가 피부 팩 접근 승인을 기다리느라 중단하지 않았습니다.

모든 이용자 무료와 Preview API 격리를 유지합니다. main 병합, Production 배포, Cloudflare 로그인/운영 설정, 운영 Firebase/DB/회원/구독 변경, 결제·유료 API·사용자 사진 외부 전송은 실행하지 않습니다. PR #4는 실제 iPad 최종 확인 전까지 미병합 상태로 유지합니다.
