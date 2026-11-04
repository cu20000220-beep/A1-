# Cloudflare Pages 무료 브랜드 주소

목표는 `a1fashion.pages.dev`처럼 GitHub나 개인 계정 이름을 포함하지 않는 공개 주소입니다. 이름 사용 가능 여부는 프로젝트 생성 시 확인하며, 중복이면 다른 브랜드 이름을 선택합니다. 기존 GitHub 저장소 이름을 바꿀 필요는 없습니다.

## 자동 업데이트 방식

Cloudflare 계정 소유자가 Pages의 Git 통합을 처음 연결해야 합니다. 이 작업 환경에는 Cloudflare 계정·배포 권한이 연결되어 있지 않으므로, 계정 소유자의 로그인·GitHub 연결 승인 단계를 대신 완료했다고 주장하지 않습니다. 비밀번호나 인증키를 채팅으로 보내지 않습니다.

설정 값:

| 항목 | 값 |
| --- | --- |
| 서비스 | Cloudflare **Pages** |
| 소스 | 현재 A1 GitHub 저장소 |
| 프로젝트 이름 | `a1fashion` (중복 시 이름 변경) |
| 운영 브랜치 | `main` |
| Framework preset | `None` |
| Build command | `node scripts/build-site.cjs` |
| Build output directory | `dist` |
| Root directory | 기본값 유지(저장소 루트) |
| 환경 변수·비밀키 | 필요 없음 |

이 설정은 Pages Functions나 결제 서비스를 사용하지 않는 정적 사이트입니다. 준비한 출력에는 `index.html`, `credits.html`, `assets/`와 비밀 정보 없는 생성 표시 파일만 포함합니다. Git 이력·개발 테스트·설계 문서·계정 설정 파일은 복사하지 않습니다. 사진과 AI 모델 라이선스·출처는 보존합니다.

`node scripts/build-site.cjs`는 외부 의존성 설치 없이 `dist/`를 만듭니다. 기존 폴더가 이 스크립트의 출력인지 확인한 후에만 다시 생성하며, 표시가 없는 기존 `dist/`는 보존하고 실패합니다.

## 다른 방식과 혼동하지 않기

대시보드 Direct Upload는 ZIP 업로드가 가능하지만 같은 프로젝트를 나중에 Git 통합으로 전환할 수 없습니다. 자동 업데이트가 필요하면 처음부터 Git 통합을 선택합니다. Workers 배포나 유료 도메인 구입을 대신 선택하지 않습니다.

## 확인할 결과

Cloudflare가 반환한 실제 `pages.dev` 주소와 배포 성공을 확인한 뒤 새 주소로 안내합니다. 프로젝트 생성이나 이름 사용 가능 여부가 확인되기 전에는 주소가 변경됐다고 말하지 않습니다. 기존 주소의 자동 이동도 별도 설정 없이는 보장하지 않습니다.

공식 자료:
- https://developers.cloudflare.com/pages/get-started/git-integration/
- https://developers.cloudflare.com/pages/get-started/direct-upload/
- https://developers.cloudflare.com/pages/platform/limits/
- https://developers.cloudflare.com/pages/functions/pricing/#static-asset-requests
