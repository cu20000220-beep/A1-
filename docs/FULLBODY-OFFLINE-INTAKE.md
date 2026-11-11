# 전신 모델 오프라인 반입 검사

2026-11-11. 기존 인체·얼굴·의류·WebGL 화면은 보존한다. 이번 변경은 실제 후보 파일을 받았을 때 실행할 **개발용 읽기 전용 검사 도구**다. 새 디지털 휴먼을 확보·표시·통합했다는 뜻이 아니다.

## 실제 실행

모델, 관련 텍스처, 공식 라이선스 증빙을 공개 폴더 밖의 격리 디렉터리에 보관한다. 가입·결제·외부 사진 처리나 자동 다운로드를 하지 않는다.

```bash
node scripts/inspect-fullbody-package.cjs --package /tmp/a1-model-review
node scripts/inspect-fullbody-package.cjs --package /tmp/a1-model-review --approval approval.json
```

기본 manifest는 해당 디렉터리의 `manifest.json`이다. 다른 파일은 `--manifest name.json`으로 지정한다. 모든 결과는 JSON stdout이며 파일 생성·앱 반입·환경 설정 변경은 없다. JSON 보고서를 저장할 경우 공개 저장소·배포 폴더에 원본 파일과 비공개 증빙을 넣지 않는다.

- 종료 1, `INVALID`: 손상된 파일, 잘못된 경로/형식/해시/참조 등. 고정 오류 코드만 출력하고 비공개 절대 경로·스택·원문을 출력하지 않는다.
- 종료 2, `BLOCKED`: 검토 기록 누락, 허용 범위 부족, 만료, 현재 렌더러 미지원 기능 또는 예산 초과. 검사 가능한 파일의 실제 통계와 차단 사유를 함께 반환한다.
- 종료 0, `REVIEW_REQUIRED`: 기록과 현재 검사 항목만 통과. 외형·라이선스 해석·실제 브라우저 품질·체형/의류 호환성은 여전히 직접 검증해야 한다.

모든 결과의 `integrationApproved`, `qualityVerified`는 **false**다. 이 도구는 법적 권리나 공개 배포 승인을 자동 부여하지 않는다. 이미 승인된 무료 후보의 취득·기술 검사를 위해 새 사업 승인을 요구하는 절차도 아니다. 개발자가 확인한 실제 권리 근거와 파일의 일관성을 기록한다.

## 파일 목록과 권리 근거

`manifest.json` 구조는 다음과 같다. 아래 `<...>`와 0은 **미완성 양식**이며 실제 파일 크기·SHA256·원문 근거로 바꾸기 전에는 검사를 통과하지 않는다. 예시 모델/라이선스를 실제 자료로 생성하지 않는다.

```json
{
  "version": 1,
  "assetId": "<candidate-id>",
  "name": "<official-model-name>",
  "source": {
    "vendor": "<original-publisher>",
    "url": "https://<official-host>/<model-page>",
    "version": "<download-date-and-source-version>"
  },
  "licence": {
    "id": "<verified-licence-id>",
    "url": "https://<official-host>/<licence-page>",
    "attribution": "<required-credit>",
    "evidencePath": "evidence/licence.txt",
    "evidenceSha256": "<sha256-of-exact-evidence>"
  },
  "entry": "models/body.glb",
  "files": [
    {
      "path": "models/body.glb",
      "role": "body",
      "bytes": 0,
      "sha256": "<sha256-of-exact-file>"
    }
  ]
}
```

`role`은 `body`, `garment`, `hair`, `eyes`, `texture`, `buffer`. GLB/GLTF의 참조 텍스처·버퍼는 모두 파일 목록에 포함한다. URI는 모델 파일 기준의 선언된 로컬 상대 경로만 허용한다. 외부 URL·data URI·상위 경로·심볼릭 링크·미선언 리소스를 거부한다. 실제 SHA256은 `sha256sum`, byte 수는 `wc -c`로 확인할 수 있다. 원본 파일 자체뿐 아니라 출처·라이선스·적용 범위가 바뀌면 기존 검토 기록을 재사용할 수 없다.

검토 기록의 필드:

```text
version: 1
assetId: manifest와 동일
decision: approved | rejected
reviewedBy: 실제 검토자
reviewedAt / validUntil: UTC ISO 시각
evidenceReference: 확인한 실제 권리 증빙 위치
packageSha256 / licenceEvidenceSha256 / scopeSha256: 첫 검사 결과의 해시
rights:
  commercialUse: boolean
  publicBrowserClientDelivery: boolean
  avatarCustomization: boolean
  modificationAndConversion: boolean
  componentRedistribution: boolean
```

`true`를 임의로 넣는 것은 이용권 확보가 아니다. 제작자별 무료 모델 고지, 파일 내 third-party 고지, 본체·머리·눈·의류·텍스처의 적용 범위를 함께 확인한다. 이미 받은 사용자의 무료 파일 취득 허가는 유지한다.

## 검사 범위와 한계

실제 GLB 청크·버퍼·접근자 경계, 정점/인덱스·유한 숫자, 장면/노드 참조와 순환, joint/weight·morph 구조, 주요 텍스처 참조, 이미지 헤더 크기, 필수 확장·런타임 기능·예산을 검사한다. 선언된 모든 모델 파일을 검사하며, 해시 검증 후 실제 검사 바이트를 다시 결합한다. 정점/삼각형/재질/joint/morph 수, 전송 이미지 크기와 디코딩 텍스처 메모리를 구분한다.

**완전한 glTF Validator나 이미지 디코더는 아니다.** `image_headers_only`는 헤더만 읽었다는 뜻이며 전체 이미지 디코딩·픽셀 품질·손상 여부는 별도 검사한다. 애니메이션과 알려지지 않은 필수 확장은 차단하며 미지원 기능을 제거해 통과로 위장하지 않는다. Khronos 공식 Validator 및 실제 브라우저 검증을 대체하지 않는다.

현재 렌더러는 정적 WebGL 1 전용이다. 골격 스키닝, glTF morph, 다중 재질, 일반 PBR 텍스처, alpha MASK/BLEND, 애니메이션 등은 해당 검사 결과에 명시적 차단 사유로 남긴다. 파일 형식 검사 통과가 현재 화면에서 그대로 재생된다는 뜻은 아니다. 얼굴 표정 morph는 체형 morph가 아니며, 기본 옷이 합쳐진 모델은 갈아입히기 가능한 의류로 인정하지 않는다.

단위 검사에는 임시 폴더의 합성 삼각형·숫자 자료만 사용한다. 이를 사람 모델·실제 상품·승인 라이선스로 공개하지 않는다. 검사 코드·증빙은 `scripts`/`docs`/`tests`에만 있으며 public build에 포함하지 않는다.

## 새 무료 후보와 현재 접근 제한

[VTubeMe 공식 무료 전신 목록](https://vtubeme.com/free-vrm-avatars)은 Nova/Kai/Sky/Ember의 GLB, 모델별 CC BY 4.0, 상업 이용·수정·재배포와 출처 표시를 안내한다. [Nova 공식 페이지](https://vtubeme.com/free-vrm-avatars/nova)와 [공식 GLB](https://vtubeme.com/media/free/nova/model.glb)를 확인했다. 공급자 표기는 약 5.2MB, 16,867 삼각형, 10개 MToon 재질, Humanoid rig와 표정용 shape key다. 이는 **공급자 기재 사양**이며 취득 파일에서 측정한 값이 아니다. 분리 의류·체형 morph는 확인되지 않았다. [일반 약관](https://vtubeme.com/terms)과 파일 내 추가 권리 고지를 함께 확인해야 한다. 유료 셀피 생성 서비스는 이용하지 않는다.

현재 관리형 네트워크의 호스트 허용 목록에 `vtubeme.com`이 없어 CONNECT 403으로 파일을 받지 못했다. 사용자는 다운로드를 허용했고 네트워크 실행 권한도 받았으나, 실행 권한과 환경 호스트 목록은 별개다. 현재 제공된 환경 도구는 상태/진단 조회만 가능하고 이 목록을 변경하는 기능은 없다. 이를 프록시 우회나 반복 호출로 해결하지 않는다. 환경 설정에 실제 호스트 허용이 반영되거나 공식 파일이 제공되면 위 도구로 검사한다.

다른 후보인 [제작자 HSRD-100](https://huggingface.co/datasets/digitalrealitylab/HSRD-100)은 CC BY 4.0 전신 스캔이지만 OBJ+텍스처 형식이며 rig·분리 의류·체형 morph가 확인되지 않았다. 전체 대용량 자료는 다운로드하지 않는다. 두 후보 모두 아직 교체 가능한 피팅 에셋으로 검증되지 않았고, **이번에 취득·브라우저 검증한 새 전신 모델은 0개**다.

## 이번 변경 검증

- 관련 신규 검사 22/22 통과: 권리 기록 5개, GLB/GLTF 검사 12개, CLI 흐름 5개.
- GitHub workflow와 같은 전체 오프라인 검사 307/307 통과. 운영 DB가 아닌 테스트 전용 임시 데이터만 사용했다.
- 정적 빌드와 공개 산출물 노출 검사 통과. 기존 workflow의 다른 검사를 삭제하거나 우회하지 않았다.
- 앱 코드·사진·모델·재질을 변경하지 않았으므로 새 아바타 스크린샷/품질 증거는 없다. 기존 화면을 새 모델 결과로 제시하지 않는다.
