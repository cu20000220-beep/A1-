# SF 휴머노이드 아바타 스타일

2026-11-16 · PR #4. 사용자가 요청한 비전의 붉은 합성 피부·금색/청록색 금속 분위기를 참고해, 현재 Preview 아바타의 기본 모습을 자체 SF 휴머노이드 스타일로 변경했다. 기존 CC0 인체 형상·GLB·스키닝·의류는 보존한다. 새로운 고품질 인체 메시를 확보하거나 실사형 복원을 완료한 변경은 아니다.

`assets/humanoid-surface.js`가 한 몸의 실제 표면에 붉은 얼굴·팔, 청록/흑연 패널, 금색 채널·이마 인레이, 은은한 눈 표현을 생성한다. 별도 박스·구체·부착형 머리, 외부 모델·텍스처·API를 추가하지 않는다. 패턴은 원본 로컬 좌표에서 계산하므로 골격 변형에 따라 움직인다. PBR와 기본 재질 비교 모두 같은 스타일을 유지한다.

`gltf-proof.html`의 **아바타 모습 → SF 휴머노이드 / 기존 인체와 비교**로 전환한다. 처음에는 SF 전신과 티셔츠 없음 상태를 보여주며, 기존 예시 티셔츠 3종·360도 회전·확대·터치·골격 검사를 계속 이용할 수 있다. 스타일별 GPU 재질도 삭제·재시도·화면 이탈 시 함께 정리한다.

실제 브라우저 화면:

- [전신 정면](validation/humanoid/ko-820-humanoid-front.png), [측면](validation/humanoid/ko-820-humanoid-side.png), [후면](validation/humanoid/ko-820-humanoid-back.png), [얼굴](validation/humanoid/ko-820-humanoid-head.png)
- [티셔츠 착용](validation/humanoid/ko-820-LAB-A.png), [기존 인체 비교](validation/humanoid/ko-820-reference-front.png)
- [영어 가로 화면](validation/humanoid/en-1180-overview.png), [브라우저 결과·소스 해시](validation/humanoid/browser-result.json)

데스크톱 1280×900, 터치 태블릿 세로 820×1180·가로 1180×820 Chromium에서 실제 얼굴/전신 색상, 전·측·후면, 기존 모습 비교, 의류 3종, 스타일 유지 상태의 골격 변형, 360도·터치/핀치, 삭제 후 GPU 메모리 정리·재시작을 검증했다. JS/CSP 오류와 외부/API 요청은 없었다. `node tests/humanoid-browser.cjs`로 재현하며 스크린샷 30장을 보존한다. 실제 iPad Safari 실행·성능 검증은 아니다.

기존 사진 분석·체형 조절·국내 검색·무료 규칙 상담 코드는 변경하지 않았다. 이 독립 화면은 사진이나 분석값을 읽거나 전송하지 않는다. 모든 사용자 무료 정책, Preview API 격리, 기존 서버 권한 검사를 유지한다. main 병합·Production 배포·운영 데이터 변경·유료 서비스 사용은 없다.
