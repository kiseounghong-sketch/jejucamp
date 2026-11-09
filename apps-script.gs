/**
 * 가쓸신제 제주도 캠프 앱 — Google Apps Script 백엔드
 *
 * ■ 설치 방법 (한 번만)
 *  1) 구글 드라이브에서 새 구글 시트를 만듭니다. (예: "2026 가쓸신제 제주 캠프 앱 데이터")
 *  2) 시트 메뉴 [확장 프로그램] → [Apps Script]를 열고, 이 파일 내용을 통째로 붙여넣습니다.
 *  3) 바로 아래 TEACHER_PIN 을 선생님만 아는 비밀번호(숫자 4~6자리 추천)로 바꾸고 저장합니다.
 *  4) 편집기 위쪽 함수 목록에서 setup 을 골라 ▶ 실행합니다. (처음 한 번 권한 허용)
 *     → 공지 / 집합안내 / 상태 / 지출 / 활동기록 탭이 만들어지고,
 *       밤 건강 체크를 담을 비공개 시트("… 밤 건강 체크 (비공개)")가 드라이브에 따로 만들어집니다.
 *  5) [배포] → [새 배포] → 유형 "웹 앱"
 *       - 실행 계정: 나
 *       - 액세스 권한: 모든 사용자
 *     배포 후 나오는 웹 앱 URL(끝이 /exec)을 복사합니다.
 *  6) 이 시트(건강 체크 시트 말고)를 [공유] → "링크가 있는 모든 사용자 - 뷰어"로 바꿉니다.
 *     (앱이 공지·일정 변경·기록을 읽을 수 있게)
 *  7) public/data.js 맨 위 CONFIG 의 두 값을 채웁니다.
 *       SHEET_ID   : 이 시트 주소 /d/ 와 /edit 사이의 값
 *       SCRIPT_URL : 5)에서 복사한 /exec 주소
 *
 * ■ 코드를 고친 뒤에는 [배포] → [배포 관리] → 연필(수정) → 버전 "새 버전" → [배포] 해야 반영돼요.
 * ■ 참가자 이름을 바꾸면 아래 PEOPLE·OPS·BUDGET_WRITERS 와 data.js 의 PEOPLE 을 함께 바꿔주세요.
 */

const TEACHER_PIN = "여기에_선생님_비밀번호";
const PEOPLE = ["홍기성", "신소율", "박민웅", "김하영", "최해나", "이승준", "김민호"];
const OPS = ["홍기성", "신소율", "박민웅"];        // 공지·집합 시간 등록, 대체 일정 전환 (선생님·총괄·일정)
const BUDGET_WRITERS = ["홍기성", "김하영"];       // 지출 기록 (선생님·예산)
// 사진이 모이는 폴더: 2026 가쓸신제 제주 캠프 공유폴더 > 3. 사진·영상
const PHOTO_FOLDER_ID = "1Xph7EeUMYw70kLaGXCQfO1Vx8wjpUlql";
// 영수증 사진이 모이는 폴더: 2026 가쓸신제 제주 캠프 공유폴더 (안에 "영수증" 폴더가 생겨요)
const RECEIPT_FOLDER_ID = "1zjthybrsa-rYc-nt_5wxP6XKzmlCPq99";
const TZ = "Asia/Seoul";

const SHEETS = {
  notice:   { name: "공지",     header: ["시간", "긴급", "제목", "내용", "작성자", "ID"] },
  assembly: { name: "집합안내", header: ["목표시각", "장소", "등록시각", "위도", "경도", "등록자"] },
  state:    { name: "상태",     header: ["키", "값", "갱신자", "갱신시각"] },
  expense:  { name: "지출",     header: ["ID", "기록시각", "일차", "계획항목", "품명", "사용처", "금액", "영수증", "기록자", "메모"] },
  record:   { name: "활동기록", header: ["ID", "기록시각", "일차", "일정키", "장소", "갈래", "내용", "작성자"] }
};
const HEALTH_HEADER = ["기록시각", "일차", "이름", "컨디션", "증상", "메모"];

/* ---------- 설치 ---------- */
function setup() {
  Object.keys(SHEETS).forEach(function (key) { sheet_(key); });
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ["시트1", "Sheet1"].forEach(function (n) {
    const blank = ss.getSheetByName(n);
    if (blank && ss.getSheets().length > 1 && blank.getLastRow() === 0) ss.deleteSheet(blank);
  });
  const health = healthSheet_();
  Logger.log("준비 완료! 건강 체크 비공개 시트: " + health.getParent().getUrl());
}

function sheet_(key) {
  const def = SHEETS[key];
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(def.name);
  if (!sh) sh = ss.insertSheet(def.name);
  if (sh.getLastRow() === 0) {
    // 날짜·숫자 자동 변환을 막아 앱이 쓴 글자 그대로 읽히게 합니다.
    sh.getRange(1, 1, sh.getMaxRows(), def.header.length).setNumberFormat("@");
    sh.appendRow(def.header);
    sh.setFrozenRows(1);
  }
  return sh;
}

// 밤 건강 체크는 공개 시트가 아닌, 선생님 드라이브의 비공개 시트에 따로 저장합니다.
function healthSheet_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty("HEALTH_SHEET_ID");
  let ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create("가쓸신제 제주 캠프 — 밤 건강 체크 (비공개)");
    props.setProperty("HEALTH_SHEET_ID", ss.getId());
    const first = ss.getSheets()[0];
    first.setName("건강체크");
    first.getRange(1, 1, first.getMaxRows(), HEALTH_HEADER.length).setNumberFormat("@");
    first.appendRow(HEALTH_HEADER);
    first.setFrozenRows(1);
  }
  return ss.getSheetByName("건강체크") || ss.getSheets()[0];
}

/* ---------- 도우미 ---------- */
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function stamp_(fmt) { return Utilities.formatDate(new Date(), TZ, fmt || "M/d HH:mm"); }
function newId_() { return new Date().getTime().toString(36) + Math.random().toString(36).slice(2, 6); }
function clip_(s, n) { return String(s == null ? "" : s).slice(0, n); }
function pinOk_(pin) { return TEACHER_PIN.indexOf("여기에") !== 0 && String(pin || "") === TEACHER_PIN; }
function fail_(code) { throw new Error(code); }
function person_(d) {
  const by = String(d.by || "");
  if (PEOPLE.indexOf(by) === -1) fail_("forbidden");
  return by;
}
function need_(list, by) { if (list.indexOf(by) === -1) fail_("forbidden"); }
function clearBody_(sh) { if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1); }
// col 열(1부터)에서 값이 id 인 행 번호를 찾습니다. 없으면 -1
function findRow_(sh, col, id) {
  const last = sh.getLastRow();
  if (last < 2 || !id) return -1;
  const vals = sh.getRange(2, col, last - 1, 1).getValues();
  for (let i = 0; i < vals.length; i++) if (String(vals[i][0]) === String(id)) return i + 2;
  return -1;
}

/* ---------- 요청 처리 ---------- */
function doGet() {
  return json_({ ok: true, app: "jejucamp" });
}

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: "bad-json" }); }
  try {
    const a = d.action;
    if (a === "verifyPin") return json_(pinOk_(d.pin) ? { ok: true } : { ok: false, error: "bad-pin" });
    // 사진 업로드·건강 체크 조회는 행 순서와 무관해서 잠금 없이 처리
    if (a === "missionPhoto") return json_(saveMissionPhoto_(d));
    if (a === "noticePhoto") return json_(saveNoticePhoto_(d));
    if (a === "receiptPhoto") return json_(saveReceiptPhoto_(d));
    if (a === "healthList") return json_(healthList_(d));
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try { return json_(handle_(a, d)); }
    finally { lock.releaseLock(); }
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  }
}

function handle_(a, d) {
  const by = person_(d);
  switch (a) {
    case "notice": {
      need_(OPS, by);
      if (!d.title) fail_("no-title");
      const id = newId_();
      sheet_("notice").appendRow([stamp_(), d.important ? "TRUE" : "FALSE", clip_(d.title, 80), clip_(d.body, 1600), by, id]);
      return { ok: true, id: id };
    }
    case "deleteNotice": {
      const sh = sheet_("notice");
      const row = findRow_(sh, 6, d.id);
      if (row === -1) return { ok: true };
      const author = String(sh.getRange(row, 5).getValue());
      if (!pinOk_(d.pin) && !(OPS.indexOf(by) !== -1 && author === by)) fail_("forbidden");
      sh.deleteRow(row);
      return { ok: true };
    }
    case "assembly": {
      need_(OPS, by);
      const sh = sheet_("assembly");
      clearBody_(sh);
      sh.appendRow([clip_(d.targetTime, 20), clip_(d.place, 60), stamp_(),
        d.lat == null ? "" : String(d.lat), d.lng == null ? "" : String(d.lng), by]);
      return { ok: true };
    }
    case "assemblyDelete": {
      need_(OPS, by);
      clearBody_(sheet_("assembly"));
      return { ok: true };
    }
    case "setState": {
      const key = String(d.key || "");
      if (key.indexOf("planB:") === 0) need_(OPS, by);
      else if (key.indexOf("lodge:") === 0) { if (!pinOk_(d.pin)) fail_("bad-pin"); }
      else if (!/^(lodgeChk|shot|backup):/.test(key)) fail_("forbidden");
      const sh = sheet_("state");
      const row = findRow_(sh, 1, key);
      const values = [[key, clip_(d.value, 500), by, stamp_("HH:mm")]];
      if (row === -1) sh.appendRow(values[0]);
      else sh.getRange(row, 1, 1, 4).setValues(values);
      return { ok: true };
    }
    case "expense": {
      need_(BUDGET_WRITERS, by);
      const amount = Math.round(Number(d.amount));
      if (!(amount > 0)) fail_("bad-amount");
      const id = newId_(), at = stamp_();
      sheet_("expense").appendRow([id, at, clip_(d.day, 2), String(Number(d.planIdx)), clip_(d.item, 60),
        clip_(d.place, 40), String(amount), clip_(d.receipt, 300), by, clip_(d.memo, 80)]);
      return { ok: true, id: id, at: at };
    }
    case "deleteExpense": {
      need_(BUDGET_WRITERS, by);
      const sh = sheet_("expense");
      const row = findRow_(sh, 1, d.id);
      if (row !== -1) sh.deleteRow(row);
      return { ok: true };
    }
    case "record": {
      const text = clip_(d.text, 1000);
      if (text.length < 2) fail_("no-text");
      const id = newId_(), at = stamp_();
      sheet_("record").appendRow([id, at, clip_(d.day, 2), clip_(d.key, 10), clip_(d.place, 60), clip_(d.branch, 10), text, by]);
      return { ok: true, id: id, at: at };
    }
    case "deleteRecord": {
      const sh = sheet_("record");
      const row = findRow_(sh, 1, d.id);
      if (row === -1) return { ok: true };
      const author = String(sh.getRange(row, 8).getValue());
      if (author !== by && !pinOk_(d.pin)) fail_("forbidden");
      sh.deleteRow(row);
      return { ok: true };
    }
    case "health": {
      healthSheet_().appendRow([stamp_(), clip_(d.day, 2), by, clip_(d.condition, 10), clip_(d.symptoms, 80), clip_(d.memo, 100)]);
      return { ok: true };
    }
    case "reset": {
      if (!pinOk_(d.pin)) fail_("bad-pin");
      if (d.what === "notices") { clearBody_(sheet_("notice")); clearBody_(sheet_("assembly")); }
      else if (d.what === "state") clearBody_(sheet_("state"));
      else if (d.what === "records") clearBody_(sheet_("record"));
      else if (d.what === "expenses") clearBody_(sheet_("expense"));
      else fail_("unknown-reset");
      return { ok: true };
    }
    default:
      fail_("unknown-action");
  }
}

function healthList_(d) {
  if (!pinOk_(d.pin)) return { ok: false, error: "bad-pin" };
  const sh = healthSheet_();
  const last = sh.getLastRow();
  if (last < 2) return { ok: true, rows: [] };
  const rows = sh.getRange(2, 1, last - 1, HEALTH_HEADER.length).getValues().map(function (r) {
    return { at: String(r[0]), day: String(r[1]), name: String(r[2]), condition: String(r[3]), symptoms: String(r[4]), memo: String(r[5]) };
  });
  return { ok: true, rows: rows };
}

/* ---------- 사진 저장 (드라이브) ---------- */
function subFolder_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
function saveBlob_(folder, d, fileName) {
  if (!d.data) fail_("no-data");
  const blob = Utilities.newBlob(Utilities.base64Decode(d.data), d.mimeType || "image/jpeg", fileName);
  return folder.createFile(blob);
}
// 미션 사진: 미션 사진/2일차_미션이름/이름_시각.jpg (공유폴더 권한을 그대로 따름)
function saveMissionPhoto_(d) {
  try {
    const by = person_(d);
    const root = subFolder_(DriveApp.getFolderById(PHOTO_FOLDER_ID), "미션 사진");
    const folder = subFolder_(root, (d.day ? d.day + "일차_" : "") + clip_(d.mission || "기타", 60));
    const file = saveBlob_(folder, d, by + "_" + stamp_("MMdd_HHmmss") + ".jpg");
    return { ok: true, url: file.getUrl() };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
}
// 공지 사진: 앱 화면에 바로 보이도록 '링크가 있는 사용자 보기'로 공유
function saveNoticePhoto_(d) {
  try {
    need_(OPS, person_(d));
    const folder = subFolder_(DriveApp.getFolderById(PHOTO_FOLDER_ID), "공지 사진");
    const file = saveBlob_(folder, d, "공지_" + stamp_("MMdd_HHmmss") + ".jpg");
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return { ok: true, url: "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w1600" };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
}
// 영수증: 영수증/1일차/이름_시각.jpg (공유폴더 권한을 그대로 따름)
function saveReceiptPhoto_(d) {
  try {
    const by = person_(d);
    need_(BUDGET_WRITERS, by);
    const root = subFolder_(DriveApp.getFolderById(RECEIPT_FOLDER_ID), "영수증");
    const folder = subFolder_(root, (d.day || "기타") + "일차");
    const file = saveBlob_(folder, d, by + "_" + stamp_("MMdd_HHmmss") + ".jpg");
    return { ok: true, url: file.getUrl() };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
}
