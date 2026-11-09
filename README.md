# 가쓸신제 제주도 캠프 앱

2026 청산고등학교 「제주! 내가 계획하는 캠프」(2026. 11. 10.~11. 13.)에서 쓰는 앱입니다.
학생 6명과 지도교사가 같은 앱을 쓰고, 이름을 고르면 역할에 맞는 기능이 보여요. 선생님은 비밀번호로 들어가요.

## 파일
- `jejucamp.html` — 앱 전체를 한 파일로 묶은 것. 이 파일 하나만 올려도 동작해요.
- `public/` — 같은 앱을 나눠 둔 원본 (Firebase Hosting용). 내용은 `public/data.js`에서 고쳐요.
- `apps-script.gs` — 구글시트 연결용 Apps Script. 설치 순서는 파일 맨 위에 있어요.
- `firebase.json` — Firebase Hosting 설정 (`public/` 폴더를 올림)

## 구글시트 연결 (공지·기록·지출·건강 체크를 함께 쓰려면 필요)
1. 새 구글시트 → 확장 프로그램 → Apps Script에 `apps-script.gs` 붙여넣기
2. `TEACHER_PIN`을 선생님 비밀번호로 바꾸고 `setup` 실행
3. 배포 → 새 배포 → 웹 앱 (실행: 나, 액세스: 모든 사용자) → `/exec` 주소 복사
4. 시트 공유를 "링크가 있는 모든 사용자 - 뷰어"로
5. `CONFIG`의 `SHEET_ID`, `SCRIPT_URL` 채우기
   - 한 파일 버전: `jejucamp.html`을 메모장으로 열어 `여기에_`로 검색
   - 나눈 버전: `public/data.js` 맨 위

## 배포
- Firebase: `firebase deploy --only hosting` (처음 한 번 `firebase use --add`로 프로젝트 선택)
- 카카오톡 위치 보내기는 카카오 디벨로퍼스 앱 설정에 배포 주소(도메인)를 등록해야 동작해요.
