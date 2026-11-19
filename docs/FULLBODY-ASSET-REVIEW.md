# 전신 디지털 휴먼·의류 확보 검토

확인일: 2026-11-11. PR #4 `feature/product-fitting-lab`, 보존 기준 `85761ab2ff5a325f32d771321e2937a88deefc9c`.

**판정: 새 전신 모델 도입 NO-GO.** 조사한 후보 중 고품질 일관된 전신, 상업적 공개 웹 전달권, 체형 변형, 분리된 교체 의류, 실제 모바일 브라우저 실행을 함께 확인한 패키지는 **0개**입니다. 무료 모델이 세상에 없다는 뜻이 아니라, 이번 후보에서 A1에 바로 적용할 수 있는 패키지를 확보하지 못했다는 뜻입니다. 기존 얼굴/MakeHuman 외형 수정과 저품질 대체는 중단하고 코드를 보존합니다.

## 현재 품질이 목표에 미달하는 이유

현재는 별도 얼굴 스캔과 범용 인체를 결합한 정적 모델입니다. 얼굴·몸·피부·모발·눈이 하나의 제작 체계가 아니고 전신 피부 재질도 없습니다. 체형은 실제 치수로 검증된 morph가 아닌 기존 메시 전용 시각 변형입니다. 상의는 연결 구조를 개선한 인체 기반 셸이며 실제 재단 패턴·원단·그레이딩을 확보한 의류가 아닙니다. 색이나 목 경계를 더 손보는 것으로 실사형 전신·자연스러운 갈아입기 문제가 해결되지 않습니다.

기존 소스·에셋·사진 분석·검색·무료 상담·로컬 2D와 동의/삭제 기능은 이번 검토에서 변경하지 않았습니다.

## 후보별 공식 근거와 판정

아래 사양은 공식 설명 확인이며, 새 파일을 내려받아 토폴로지·리그·외형을 실측한 결과가 아닙니다. 특정 공급처의 모든 모델에 같은 권리를 자동 적용하지 않습니다.

| 후보 | 품질·형식/권리 확인 | A1 적용 판정과 부족한 자료 |
|---|---|---|
| **Renderpeople 무료 전신** | [공식 무료 목록](https://renderpeople.com/free-3d-people/)의 New Posed는 GLB·50k·4k PBR, Rigged는 스켈레톤을 안내합니다. [약관](https://renderpeople.com/general-terms-and-conditions/) §2.5는 무료에도 동일 조건, §4.2(c)는 제3자 이용 SaaS에 서면 동의, §4.3(b)는 쉽게 추출 가능한 파일 제공을 제한합니다. | **승인 전 NO-GO.** 상업 렌더 허용과 공개 GLB 전달은 다릅니다. SaaS/변형/클라이언트 전달을 명시한 별도 범위, 온전한 인체·분리 의류·body morph가 필요합니다. 옷 입은 정적 스캔이 갈아입기용 데이터라는 보장은 없습니다. |
| **3DPEOPLE 무료 샘플** | [Vivian](https://3dpeople.com/en/product/30017-vivian/), [Juliette](https://3dpeople.com/en/product/10781-juliette/) 개별 페이지는 평가 전용·상업 사용 금지입니다. [Camilo](https://3dpeople.com/en/product/17510-camilo/)는 €0이지만 정적 포즈이며 [약관 §4](https://3dpeople.com/en/terms-and-conditions/)의 재배포·수정 조건이 별도입니다. | **즉시 도입 불가.** 목록의 무료/royalty-free 표시만으로 개별 모델의 상업·웹 재배포·체형 수정 권리를 인정하지 않습니다. Camilo도 해당 웹 용도 서면 허가와 분리 의류/변형 자료 미확보입니다. |
| **MetaHuman 5.6+** | [공식 라이선스](https://www.metahuman.com/license?lang=en-US)는 다른 엔진 사용과 매출 조건에 따른 무료 경로를 명시합니다. [Unreal EULA §4(a)(i)](https://www.unrealengine.com/eula/unreal)는 자체 캐릭터 등 Non-Engine Product 배포 경로를 둡니다. 일관된 전신·피부·눈·모발 제작 체계가 있어 품질 방향상 유력합니다. | **조건부 우선 검토.** A1의 계정/약관·매출 예외 여부, 실제 사용 에셋별 권리, 웹 전달/변형 범위와 모바일 GLB를 확보하지 않았습니다. UE 전용 구버전 자료까지 자동 개방된 것으로 해석하지 않습니다. 도구/Creator를 통째로 웹 서비스에 넣는 것과 제작 캐릭터 사용도 다릅니다. |
| **Reallusion Character Creator/ActorCore** | [2026-11-01 Content EULA](https://www.reallusion.com/Content/EULA/EULA.htm) §1.16은 runtime body morph/골격 조절을 Character Generation System으로 정의합니다. Standard 제한(C)(2)와 §2.2는 이 용도에 Enterprise 계약을 요구합니다. §6.3도 추출 가능한 배포를 제한합니다. | **Standard만으로 NO-GO.** Enterprise 견적과 함께 A1의 웹 전달·체형 편집·파생 의류·캐시·콘텐츠 보호 조건을 서면 확인해야 합니다. Enterprise 명칭만으로 모든 공개 GLB 전달이 허용된다고 추정하지 않습니다. |
| **Human Generator** | [Asset License](https://humgen3d.com/docs/faq/human-generator-asset-license)는 상용 결과물에 조건을 두며 에셋 추출/재사용을 제한합니다. [출력 문서](https://humgen3d.com/docs/process/output)는 GLB와 hair cards·baked 재질을 설명합니다. | **현재 공개 전달 구조에 적용 불가.** Blender 내부 체형/의류 보정이 GLB runtime morph로 모두 남는지 미확인입니다. 공개 웹 전송·체형 조절을 허용하는 별도 조건과 실제 출력 파일이 필요합니다. |
| **Blender Human Base Meshes v1.4.1** | [공식 목록](https://www.blender.org/download/demo-files/#assets)의 49MB·CC0 표시를 확인했습니다. 원본 페이지 직접 열기는 이 환경에서 실패해 색인·[공식 개발 문서](https://developer.blender.org/docs/features/asset_system/asset_bundles/human_base_meshes/) 범위로 검토했고 배포본 내부 라이선스는 미검증입니다. | **제작용 기반 후보.** 완성된 전신 피부/모발/눈/의류/체형 morph 패키지가 아닙니다. 이를 바로 넣으면 중단한 기본 메시 수정으로 되돌아갈 수 있어 교체하지 않습니다. |

추가 구분: [SMPL-X Model](https://smpl-x.is.tue.mpg.de/modellicense.html)은 상용 계약이 필요한 반면, 특정 [BODY subset](https://smpl-x.is.tue.mpg.de/bodylicense.html)은 CC BY 4.0입니다. 후자는 shape blendshape와 생성 도구를 제외하므로 무료 개인화 전신 시스템으로 간주하지 않습니다. [MB-Lab의 공식 권리 문서](https://github.com/animate1978/MB-Lab/wiki/Asset-Licensing)는 데이터/기본 출력에 AGPL3을 명시하므로 CC0로 잘못 분류하지 않습니다. [Khronos CesiumMan](https://github.com/KhronosGroup/glTF-Sample-Assets/blob/main/Models/CesiumMan/LICENSE.md)은 기술 샘플이며 이번 실사 품질 대체물로 선정하지 않았습니다.

## 실제 재단 의류를 확보하는 경로

1. **우선 납품물:** 승인된 전신 1개와 같은 A/T-pose·rig·morph 체계를 쓰는 **별도 티셔츠 메시 1개**입니다. 얼굴/전신만 산 뒤 임의 상의를 붙이는 순서를 반복하지 않습니다. 원본 패턴·앞뒤판/어깨·진동/소매·봉제선·UV·두께·기준 실측·원단 조건을 함께 요청합니다.
2. **GarmentCode/GarmentCodeData는 연구 후보:** [공식 GarmentCode](https://github.com/maria-korosteleva/GarmentCode)는 MIT의 재단 패널/봉제 프로그램이며, [ETH 프로젝트](https://igl.ethz.ch/projects/GarmentCodeData/)는 패턴과 체형별 draped mesh를 함께 다룹니다. [공식 v2 기록](https://www.research-collection.ethz.ch/items/9d16a4da-0d30-4963-8842-af20fcf82899)은 CC BY 4.0을 표시합니다. 이 환경에서는 저장소 기록/데이터 설명 직접 열기가 403이라 파일별 권리·포함 인체·최종 메시·재질을 검증하지 않았습니다. 코드 MIT와 데이터/인체 권리는 구분하며, 기성 GLB·특정 브랜드 실제 상품으로 표시하지 않습니다. 브라우저 실시간 물리로 이식하거나 전체 데이터를 다운로드하지 않았습니다.
3. **CLO/Marvelous 계열 납품:** [공식 EveryWear 설명](https://support-connect.clo-set.com/hc/en-us/articles/45304312078873-What-is-EveryWear)은 패턴/인체에 맞춘 fitting, rigging, 재질 bake, LOD 과정을 설명합니다. 이 기능이 웹 GLB 한 파일에 자동 보존된다는 뜻은 아닙니다. 도구 구독권과 개별 의류의 웹 전달·수정권을 따로 확인해야 하며 구매/가입은 하지 않았습니다.

정적 고품질 의류로 품질 시험을 시작할 수 있습니다. 체형 편집을 제공할 때에는 body와 garment의 대응 morph/보정 형상 또는 같은 토폴로지의 체형별 사전 드레이프가 필요합니다. 이름이 같은 morph나 옷의 전역 스케일만으로 호환된다고 판정하지 않습니다. 실제 상품 사이즈·착용감은 패턴·치수·원단 검증 없이 보장하지 않습니다.

## 도입 방향과 필요한 결정

가장 작은 다음 단위는 **‘한 전신 + 한 티셔츠 + 웹 전달/체형 변형 허가 + 실제 파일’**의 확보입니다. 품질 후보로 MetaHuman 계열을 검토하거나, 이 납품 범위를 명시한 별도 제작/공급 계약을 비교할 수 있습니다. 현재 계약을 선정하거나 승인했다고 표시하지 않습니다. [공급자에게 검토시킬 구체적 요청서](FULLBODY-SUPPLIER-BRIEF.md)를 준비했지만 전송하지 않았습니다.

- MetaHuman의 무료 적용은 회사/그룹 매출 등 EULA 조건 확인이 필요합니다. [공식 가격 안내](https://www.unrealengine.com/license)의 일반 비엔진 seat 표시는 연 $1,850이며 조건·제작 방식에 따라 적용이 달라집니다.
- Human Generator의 [조회 시 가격](https://humgen3d.com/pricing)은 Commercial $128이지만 이 금액이 A1용 공개 GLB 전달권을 산다는 뜻은 아닙니다.
- Reallusion Enterprise·공급자 맞춤 허가·제작 비용은 **별도 견적**이며 금액/기간을 임의로 만들지 않습니다. 비용·계정/약관·외부 문의는 이번에 실행하지 않았습니다.

확보 후 [런타임/의류/기기 수용 조건](FULLBODY-RUNTIME-REQUIREMENTS.md)에 따라 격리된 전신 품질 시험부터 진행합니다. 현재 WebGL에 바로 GLB를 꽂거나 Three.js로 전면 교체하지 않습니다. 승인된 모델이 없는 동안 프로그램·HTML·기존 에셋을 보존합니다.

## 이번 작업의 실제 결과

검토 문서와 조달/도입 조건만 추가했습니다. 새 모델 적용 **0개**, 브라우저에서 확인한 새 실사 품질 개선 **없음**입니다. 기존 모델을 개선했다고 다시 표현하지 않습니다. 변경 없는 런타임의 기존 자동/브라우저 검사를 수동으로 반복하지 않습니다. 문서 검사와 feature 브랜치의 GitHub CI 결과만 확인하며, 자동 생성되는 Preview가 있더라도 앱 화면은 기존과 같습니다.

main 병합·Production 배포·Cloudflare 로그인/설정·운영 DB/Firebase/회원/구독 변경·결제·유료 API·무단 크롤링·사용자 사진 외부 전송은 실행하지 않습니다. 모든 이용자 무료·Preview API 격리·PR #4 미병합을 유지합니다.
