/* =========================================================
   가쓸신제 제주도 캠프 — 앱 동작
   내용(일정·준비물·연락처 등)은 data.js에서 고치세요.
   ========================================================= */
"use strict";

/* ---------- 공통 도우미 ---------- */
const $ = (id) => document.getElementById(id);
function esc(s){
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
const store = {
  get(key, fallback){
    try { const v = localStorage.getItem("jeju_" + key); return v == null ? fallback : JSON.parse(v); }
    catch(e){ return fallback; }
  },
  set(key, value){ try { localStorage.setItem("jeju_" + key, JSON.stringify(value)); } catch(e){} },
  del(key){ try { localStorage.removeItem("jeju_" + key); } catch(e){} }
};
const pad2 = n => String(n).padStart(2, "0");
const hm = d => pad2(d.getHours()) + ":" + pad2(d.getMinutes());
const won = n => Math.round(Number(n) || 0).toLocaleString("ko-KR") + "원";
const toMin = t => { const [h, m] = String(t).split(":").map(Number); return h * 60 + m; };
const dayKeys = Object.keys(SCHEDULE);

// 받침에 따라 '로/으로'를 골라 붙입니다. (예: 기상 악화로, 풍랑 결항으로)
function withRo(word){
  const ch = String(word).trim().slice(-1);
  const code = ch.charCodeAt(0) - 0xAC00;
  if(code < 0 || code > 11171) return word + "(으)로";
  const jong = code % 28;
  return word + (jong === 0 || jong === 8 ? "로" : "으로");
}

const ICON = {
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 12 9 17 20 6"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>',
  camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  chevronRight: '<svg class="chevron" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
  chevronDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>'
};

/* ---------- 날짜 ---------- */
function dayDate(dayKey){
  const d = new Date(CAMP.departDate + "T00:00:00");
  d.setDate(d.getDate() + (Number(dayKey) - 1));
  return d;
}
function sameDate(a, b){
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
// 오늘이 캠프 몇 일차인지 (캠프 기간이 아니면 null)
function campDay(now){
  const n = now || new Date();
  return dayKeys.find(k => sameDate(dayDate(k), n)) || null;
}
function dayShort(dayKey){
  const d = dayDate(dayKey);
  return (d.getMonth() + 1) + "." + d.getDate() + ".(" + "일월화수목금토"[d.getDay()] + ")";
}

/* ---------- 구글시트 읽기 · Apps Script 쓰기 ---------- */
const sheetReady = () => typeof CONFIG.SHEET_ID === "string" && CONFIG.SHEET_ID.length > 10 && CONFIG.SHEET_ID.indexOf("여기에") !== 0;
const scriptReady = () => typeof CONFIG.SCRIPT_URL === "string" && CONFIG.SCRIPT_URL.indexOf("https://") === 0;

// 시트 탭을 CSV로 읽어 [행 배열]로 돌려줍니다. 연결 전이면 null.
function sheetRows(tab, firstHeader){
  if(!sheetReady()) return Promise.resolve(null);
  const url = "https://docs.google.com/spreadsheets/d/" + CONFIG.SHEET_ID +
    "/gviz/tq?tqx=out:csv&headers=1&sheet=" + encodeURIComponent(tab);
  return fetch(url)
    .then(res => { if(!res.ok) throw new Error("sheet-" + res.status); return res.text(); })
    .then(text => parseCSV(text).filter(r => r.some(c => c !== "") && r[0] !== firstHeader));
}

// 따옴표 안의 쉼표·줄바꿈도 처리하는 간단한 CSV 해석기
function parseCSV(text){
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for(let i = 0; i < text.length; i++){
    const c = text[i];
    if(inQuotes){
      if(c === '"'){
        if(text[i + 1] === '"'){ field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if(c === '"'){
      inQuotes = true;
    } else if(c === ","){
      row.push(field); field = "";
    } else if(c === "\n" || c === "\r"){
      if(field !== "" || row.length){ row.push(field); rows.push(row); }
      row = []; field = "";
      if(c === "\r" && text[i + 1] === "\n") i++;
    } else field += c;
  }
  if(field !== "" || row.length){ row.push(field); rows.push(row); }
  return rows;
}

// Apps Script로 보내고 결과(JSON)를 받습니다. 실패하면 오류를 던져요.
async function api(action, data){
  if(!scriptReady()) throw new Error("no-script-url");
  const payload = Object.assign({ action, by: me ? me.name : "", pin: store.get("pin", "") }, data || {});
  const res = await fetch(CONFIG.SCRIPT_URL, { method: "POST", body: JSON.stringify(payload) });
  let json;
  try { json = await res.json(); } catch(e){ throw new Error("bad-response"); }
  if(!json || !json.ok) throw new Error((json && json.error) || "failed");
  return json;
}

// 구글시트 읽기 결과는 몇십 초 늦게 바뀔 수 있어요. 방금 쓰거나 지운 내용은
// 시트에 반영될 때까지(최대 2분) 화면에서 그대로 유지합니다.
const PENDING_MS = 120000;
const pending = { record: [], expense: [], notice: [], deleted: {}, state: {}, assembly: null };
function markDeleted(id){ pending.deleted[id] = Date.now(); }
function mergePending(serverList, kind){
  const now = Date.now();
  Object.keys(pending.deleted).forEach(id => { if(now - pending.deleted[id] > PENDING_MS) delete pending.deleted[id]; });
  const list = serverList.filter(x => !pending.deleted[x.id]);
  pending[kind] = pending[kind].filter(p => now - p._ts < PENDING_MS && !list.some(x => x.id === p.id));
  return list.concat(pending[kind]);
}

function errText(err){
  const msg = (err && err.message) || String(err);
  if(msg === "no-script-url") return "아직 구글시트와 연결되지 않았어요 (data.js의 SCRIPT_URL)";
  if(msg === "forbidden") return "이 기능은 담당자만 쓸 수 있어요";
  if(msg === "bad-pin") return "선생님 비밀번호가 맞지 않아요";
  if(msg === "decode-failed" || msg === "read-failed") return "사진 파일을 읽지 못했어요. 다른 사진으로 해보세요";
  if(msg === "bad-response") return "서버 응답이 이상해요. Apps Script를 새 버전으로 배포했는지 확인해주세요";
  if(/Failed to fetch|NetworkError|Load failed/i.test(msg)) return "인터넷 연결 또는 Apps Script 배포 권한(모든 사용자)을 확인해주세요";
  return msg;
}

function setMsg(el, text, kind){
  el.textContent = text || "";
  el.className = "form-msg" + (kind ? " " + kind : "");
}

// 사진을 줄여서(용량 절약) base64로 돌려줍니다.
function compressImageFile(file, maxDim, quality){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read-failed"));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("decode-failed"));
      img.onload = () => {
        let { width, height } = img;
        if(width > maxDim || height > maxDim){
          if(width > height){ height = Math.round(height * maxDim / width); width = maxDim; }
          else { width = Math.round(width * maxDim / height); height = maxDim; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality).split(",")[1]);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
async function uploadPhoto(action, file, extra){
  const base64 = await compressImageFile(file, 1600, 0.72);
  return api(action, Object.assign({ mimeType: "image/jpeg", data: base64 }, extra || {}));
}

// 클립보드 복사 (막힌 기기에서는 직접 복사할 수 있게 창을 띄움)
function copyText(text, doneMsg){
  const fallback = () => {
    $("copyArea").value = text;
    $("copyOverlay").style.display = "flex";
    setTimeout(() => $("copyArea").select(), 50);
  };
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(() => alert(doneMsg || "복사했어요!")).catch(fallback);
  } else fallback();
}
$("closeCopyBtn").addEventListener("click", () => { $("copyOverlay").style.display = "none"; });

/* ---------- 누가 쓰고 있나 (이름 고르기) ---------- */
let me = null;
const findPerson = name => PEOPLE.find(p => p.name === name) || null;
const isTeacher = () => !!(me && me.teacher);
const canOps = () => !!(me && (me.teacher || me.ops));
const canBudget = () => !!(me && (me.teacher || me.budget));
const isReporter = () => !!(me && (me.teacher || me.reporter));
let pendingTeacher = null;

$("personGrid").innerHTML = PEOPLE.map(p => `
  <button type="button" class="person-btn${p.teacher ? " teacher" : ""}" data-name="${esc(p.name)}">
    <span class="pb-name">${esc(p.name)}${p.teacher ? " 선생님" : ""}</span>
    <span class="pb-role">${esc(p.role)}</span>
  </button>`).join("");

$("personGrid").addEventListener("click", (e) => {
  const btn = e.target.closest(".person-btn");
  if(!btn) return;
  const p = findPerson(btn.dataset.name);
  if(!p) return;
  if(p.teacher){
    pendingTeacher = p;
    $("personGrid").hidden = true;
    $("pinBox").hidden = false;
    $("pinInput").value = "";
    $("pinMsg").textContent = "";
    $("pinInput").focus();
    return;
  }
  login(p);
});
$("pinCancelBtn").addEventListener("click", () => {
  $("pinBox").hidden = true;
  $("personGrid").hidden = false;
});
$("pinInput").addEventListener("keydown", (e) => { if(e.key === "Enter") $("pinOkBtn").click(); });
$("pinOkBtn").addEventListener("click", async () => {
  const pin = $("pinInput").value.trim();
  if(!pin){ $("pinMsg").textContent = "비밀번호를 입력해주세요."; return; }
  if(scriptReady()){
    $("pinMsg").textContent = "확인하는 중...";
    try { await api("verifyPin", { pin }); }
    catch(err){ $("pinMsg").textContent = errText(err); return; }
  }
  store.set("pin", pin);
  login(pendingTeacher);
});

function login(person){
  me = person;
  store.set("me", person.name);
  $("nameGate").style.display = "none";
  renderAll();
}

$("switchUserBtn").addEventListener("click", () => {
  if(!confirm("다른 사람으로 바꿀까요? 이 기기에 체크해 둔 준비물·미션 기록도 함께 지워져요.")) return;
  ["me", "pin", "checklist_checked", "custom_items", "mission_checked", "mission_photos"].forEach(k => store.del(k));
  location.reload();
});

/* ---------- 헤더 ---------- */
function renderHeader(){
  $("meTag").innerHTML = me ? `${esc(me.name)}<span class="me-role">${esc(me.role)}</span>` : "";
  const now = new Date();
  const start = dayDate(dayKeys[0]);
  const end = dayDate(dayKeys[dayKeys.length - 1]);
  const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((start - today0) / 86400000);
  let extra = "";
  if(diff > 0) extra = " · D-" + diff;
  else if(campDay(now)) extra = " · Day " + campDay(now);
  else if(today0 > end) extra = " · 수고했어요!";
  $("tripDates").textContent = (start.getMonth() + 1) + "." + start.getDate() + " ~ " + (end.getMonth() + 1) + "." + end.getDate() + extra;
}

/* ---------- 제주 날씨 · 바다 (Open-Meteo, 키 필요 없음) ---------- */
const WEATHER_ICONS = {
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>',
  cloud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19a4.5 4.5 0 0 0 0-9 5.5 5.5 0 0 0-10.9 1A4 4 0 0 0 6 19z"/></svg>',
  rain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 13v8M8 13v8M12 15v8"/><path d="M17.5 12A4.5 4.5 0 0 0 17 3.05 5.5 5.5 0 0 0 6.1 4 4 4 0 0 0 6.5 12z"/></svg>',
  snow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 12A4.5 4.5 0 0 0 17 3.05 5.5 5.5 0 0 0 6.1 4 4 4 0 0 0 6.5 12z"/><line x1="8" y1="16" x2="8" y2="16.01"/><line x1="8" y1="20" x2="8" y2="20.01"/><line x1="12" y1="18" x2="12" y2="18.01"/><line x1="12" y1="22" x2="12" y2="22.01"/><line x1="16" y1="16" x2="16" y2="16.01"/><line x1="16" y1="20" x2="16" y2="20.01"/></svg>'
};
function getWeatherInfo(code){
  if(code === 0) return { icon: WEATHER_ICONS.sun, desc: "맑음" };
  if(code === 1 || code === 2) return { icon: WEATHER_ICONS.sun, desc: "대체로 맑음" };
  if(code === 3) return { icon: WEATHER_ICONS.cloud, desc: "흐림" };
  if(code === 45 || code === 48) return { icon: WEATHER_ICONS.cloud, desc: "안개" };
  if((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99)) return { icon: WEATHER_ICONS.rain, desc: "비" };
  if(code >= 71 && code <= 77) return { icon: WEATHER_ICONS.snow, desc: "눈" };
  return { icon: WEATHER_ICONS.cloud, desc: "-" };
}
// 풍속·파고가 이 값 이상이면 '바다 주의'로 표시합니다. (참고용 — 운항 여부는 업체·선생님 안내를 따라요)
const SEA_CAUTION = { wind: 9, gust: 14, wave: 1.5 };
function renderWeather(w, m){
  ["Today", "Tomorrow"].forEach((sfx, i) => {
    const info = getWeatherInfo(w.daily.weather_code[i]);
    $("weatherIcon" + sfx).innerHTML = info.icon;
    $("weatherTemp" + sfx).textContent = Math.round(w.daily.temperature_2m_min[i]) + "° / " + Math.round(w.daily.temperature_2m_max[i]) + "°";
    $("weatherDesc" + sfx).textContent = info.desc;
    const wind = w.daily.wind_speed_10m_max[i];
    const gust = w.daily.wind_gusts_10m_max[i];
    const wave = m && m.daily && m.daily.wave_height_max ? m.daily.wave_height_max[i] : null;
    const caution = wind >= SEA_CAUTION.wind || gust >= SEA_CAUTION.gust || (wave != null && wave >= SEA_CAUTION.wave);
    const el = $("weatherSea" + sfx);
    el.textContent = "💨 " + Math.round(wind) + "m/s" + (wave != null ? " · 🌊 " + wave.toFixed(1) + "m" : "") + (caution ? " · 바다 주의" : "");
    el.classList.toggle("caution", caution);
    el.title = "하루 최대 풍속·파고 (참고용)";
  });
}
function loadWeather(){
  const land = fetch("https://api.open-meteo.com/v1/forecast?latitude=33.45&longitude=126.31&daily=weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_gusts_10m_max&wind_speed_unit=ms&timezone=Asia%2FSeoul&forecast_days=2")
    .then(res => res.json());
  const sea = fetch("https://marine-api.open-meteo.com/v1/marine?latitude=33.28&longitude=126.10&daily=wave_height_max&timezone=Asia%2FSeoul&forecast_days=2")
    .then(res => res.json()).catch(() => null);
  Promise.all([land, sea]).then(([w, m]) => {
    if(!w || !w.daily) throw new Error("no-weather");
    renderWeather(w, m);
    store.set("weather", { date: new Date().toDateString(), w, m });
  }).catch(() => {
    // 같은 날 받아 둔 날씨가 있으면 그걸 보여줘요 (요청이 잠깐 막혔을 때 대비)
    const cached = store.get("weather", null);
    if(cached && cached.date === new Date().toDateString()){ renderWeather(cached.w, cached.m); return; }
    ["Today", "Tomorrow"].forEach(sfx => {
      $("weatherTemp" + sfx).textContent = "-";
      $("weatherDesc" + sfx).textContent = "-";
      $("weatherSea" + sfx).textContent = "-";
    });
  });
}

/* ---------- 공유 상태 (대체 일정·숙소 정보·안전 체크·촬영 체크) ---------- */
let STATE = store.get("state", {});
function stateOf(key){ return STATE[key] && STATE[key].value ? STATE[key] : null; }
function stateVal(key){ return STATE[key] ? STATE[key].value : ""; }
function loadState(){
  return sheetRows("상태", "키").then(rows => {
    if(rows === null) return;
    const next = {};
    rows.forEach(r => { if(r[0]) next[r[0]] = { value: r[1] || "", by: r[2] || "", at: r[3] || "" }; });
    const now = Date.now();
    Object.keys(pending.state).forEach(k => {
      const p = pending.state[k];
      const serverHas = next[k] && next[k].value === p.value;
      if(now - p.ts > PENDING_MS || serverHas){ delete pending.state[k]; return; }
      if(p.value) next[k] = { value: p.value, by: p.by, at: p.at };
      else delete next[k];
    });
    const changed = JSON.stringify(next) !== JSON.stringify(STATE);
    STATE = next;
    store.set("state", STATE);
    if(changed) onStateChanged();
  }).catch(() => {});
}
// 화면을 먼저 바꾸고 서버에 저장합니다. 실패하면 되돌려요.
async function setState(key, value){
  const prev = STATE[key];
  if(value) STATE[key] = { value, by: me ? me.name : "", at: hm(new Date()) };
  else delete STATE[key];
  store.set("state", STATE);
  onStateChanged();
  try {
    await api("setState", { key, value });
    pending.state[key] = { value, by: me ? me.name : "", at: hm(new Date()), ts: Date.now() };
    return true;
  } catch(err){
    if(prev) STATE[key] = prev; else delete STATE[key];
    store.set("state", STATE);
    onStateChanged();
    alert("저장하지 못했어요. " + errText(err));
    return false;
  }
}
function onStateChanged(){
  if(!me) return;
  renderSchedule();
  renderHome();
  renderRecordForm();
  if($("panel-lodging").classList.contains("active")) renderLodging();
  if($("panel-shots").classList.contains("active")) renderShots();
}

/* ---------- 일정 (대체 일정·숙소 이름을 반영한 실제 일정) ---------- */
const planBOn = key => stateVal("planB:" + key) === "1";
function lodgeInfo(day){
  const base = LODGINGS.find(l => String(l.day) === String(day));
  if(!base) return null;
  let ov = {};
  try { ov = JSON.parse(stateVal("lodge:" + day) || "{}") || {}; } catch(e){ ov = {}; }
  const info = Object.assign({}, base);
  ["name", "addr", "tel"].forEach(k => { if(ov[k]) info[k] = ov[k]; });
  return info;
}
function originalItem(key){
  const [d, t] = key.split("-");
  return SCHEDULE[d].items.find(it => it[0] === t);
}
function effectiveItems(dayKey){
  return SCHEDULE[dayKey].items.map(([time, name, place, lat, lng]) => {
    const key = dayKey + "-" + time;
    const it = { key, time, name, place, lat, lng, origName: null, alt: null, isLodge: false, addr: "" };
    const pb = PLAN_B[key];
    if(pb && planBOn(key)){
      Object.assign(it, { alt: pb, origName: name, name: pb.name, place: pb.place, lat: pb.lat, lng: pb.lng });
    }
    const moveOf = Object.keys(PLAN_B).find(k => PLAN_B[k].move === key && planBOn(k));
    if(moveOf){
      const p = PLAN_B[moveOf];
      Object.assign(it, { origName: name, name: p.moveName, place: p.place, lat: p.lat, lng: p.lng, altMove: moveOf });
    }
    const lodge = LODGINGS.find(l => l.name === it.place);
    if(lodge){
      const info = lodgeInfo(lodge.day);
      it.isLodge = true;
      it.place = info.name;
      it.addr = info.addr;
      if(info.lat != null){ it.lat = info.lat; it.lng = info.lng; }
    }
    return it;
  });
}

/* ---------- 카카오맵 길찾기 (구글지도는 국내 자동차 길찾기가 안 돼요) ---------- */
const cleanName = s => String(s || "").replace(/[,\/]/g, " ").replace(/\s+/g, " ").trim();
function kakaoTo(name, lat, lng){
  if(lat != null && lng != null && lat !== "" && lng !== ""){
    return "https://map.kakao.com/link/to/" + encodeURIComponent(cleanName(name)) + "," + lat + "," + lng;
  }
  return "https://map.kakao.com/link/search/" + encodeURIComponent(cleanName(name));
}
// 길찾기 버튼을 달 수 있는 일정인지 (막연한 '저녁 식당' 같은 곳은 버튼을 숨김)
function routeLink(it){
  if(it.lat != null && it.lng != null) return kakaoTo(it.place, it.lat, it.lng);
  if(it.isLodge) return it.addr ? kakaoTo(it.addr) : null;
  if(/식당|인근|숙소/.test(it.place)) return null;
  return kakaoTo(it.place);
}

const CATEGORY_EMOJI = { airport: "✈️", hotel: "🏨", train: "🚆", transit: "🚐", meal: "🍴" };
function stopCategory(it){
  if(it.isLodge) return "hotel";
  if(it.place.includes("공항")) return "airport";
  if(/역$/.test(it.place)) return "train";
  if(it.name.includes("이동")) return "transit";
  if(/^(조식|중식|석식)/.test(it.name)) return "meal";
  return null;
}
// 지도·목록에서 각 일정 옆에 붙는 번호나 이모티콘
function getStopMarkerLabels(items){
  const coordToNumber = new Map();
  let seq = 0;
  items.forEach(it => {
    if(it.lat == null || it.lng == null || stopCategory(it)) return;
    const k = it.lat + "," + it.lng;
    if(coordToNumber.has(k)) return;
    seq++;
    coordToNumber.set(k, String(seq));
  });
  return items.map(it => {
    const emoji = CATEGORY_EMOJI[stopCategory(it)];
    if(emoji) return emoji;
    if(it.lat == null || it.lng == null) return null;
    return coordToNumber.get(it.lat + "," + it.lng) || null;
  });
}
// 오늘이면 지금 시각 다음 일정, 다른 날이면 그날의 첫(앞으로) 또는 마지막(지난 날) 일정
function findNextStop(items, dayKey){
  const now = new Date();
  const dd = dayDate(dayKey || currentDayKey);
  if(!sameDate(now, dd)) return now < dd ? items[0] : items[items.length - 1];
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return items.find(it => toMin(it.time) >= nowMin) || items[items.length - 1];
}
function nextStopLabel(dayKey){
  const now = new Date(), dd = dayDate(dayKey);
  if(sameDate(now, dd)) return "지금 갈 곳";
  return now < dd ? "이날 첫 일정" : "이날 마지막 일정";
}

let currentDayKey = campDay() || dayKeys[0];
const dayPills = $("dayPills");
dayPills.innerHTML = dayKeys.map(k =>
  `<button class="pill${k === currentDayKey ? " active" : ""}" data-day="${k}">Day ${k}</button>`
).join("");
dayPills.addEventListener("click", (e) => {
  const btn = e.target.closest(".pill");
  if(!btn) return;
  dayPills.querySelectorAll(".pill").forEach(p => p.classList.toggle("active", p === btn));
  currentDayKey = btn.dataset.day;
  renderSchedule();
  document.querySelector("#panel-schedule .scroll-area").scrollTop = 0;
});

function planBBlock(key){
  const pb = PLAN_B[key];
  const on = planBOn(key);
  const orig = originalItem(key);
  const st = stateOf("planB:" + key);
  let html = '<div class="tl-planb">';
  if(on){
    html += `<b>☔ ${esc(withRo(pb.reason))} 대체 일정 진행</b><br>원래 일정: ${esc(orig[1])}` +
      (st && st.by ? ` · ${esc(st.by)} ${esc(st.at)} 변경` : "");
  } else {
    html += `<b>☔ ${esc(pb.reason)} 때 대체 일정</b><br>${esc(pb.name)} — ${esc(pb.note)}`;
  }
  if(canOps()){
    html += `<br><button type="button" class="chip-btn${on ? " undo" : ""}" data-planb="${key}">${on ? "원래 일정으로 되돌리기" : "대체 일정으로 바꾸기"}</button>`;
  }
  return html + "</div>";
}

function renderDay(dayKey){
  $("dayLabel").textContent = SCHEDULE[dayKey].label;
  const items = effectiveItems(dayKey);
  const openKeys = new Set([...$("timeline").querySelectorAll("li.open")].map(li => li.dataset.key));
  $("timeline").innerHTML = '<div class="tl-progress" id="tlProgress"></div>' + items.map(it => {
    const note = it.alt ? it.alt.note : (SCHEDULE_NOTES[it.key] || "");
    const hasPlanB = !!PLAN_B[it.key];
    const changed = !!(it.alt || it.altMove);
    return `
    <li class="${changed ? "planb-on" : ""}${openKeys.has(it.key) ? " open" : ""}" data-key="${it.key}">
      <span class="time">${it.time}<span class="tl-tag" hidden></span></span>
      <span class="dot"></span>
      <span class="event">
        <p class="name"><span class="title-text">${esc(it.name)}</span>${hasPlanB ? `<span class="planb-chip${it.alt ? " on" : ""}">${it.alt ? "☔ 대체 일정" : "☔ 대안 있음"}</span>` : ""}<span class="tl-more">자세히 <span class="tl-more-arrow">▾</span></span></p>
        <p class="place">${esc(it.place)}${it.origName ? ` · 원래: ${esc(it.origName)}` : ""}</p>
        ${note ? `<p class="tl-note">${esc(note)}</p>` : ""}
        ${hasPlanB ? planBBlock(it.key) : ""}
      </span>
    </li>`;
  }).join("");
  updateTimelineProgress();
}

// 오늘 일정의 현재 지점에 태그를 붙이고 세로선을 거기까지 채웁니다.
function updateTimelineProgress(){
  const tl = $("timeline");
  const prog = $("tlProgress");
  if(!tl || !prog) return;
  const lis = [...tl.querySelectorAll("li")];
  if(!lis.length) return;
  const items = SCHEDULE[currentDayKey].items;
  const dotY = i => {
    const dot = lis[i].querySelector(".dot");
    return lis[i].offsetTop + dot.offsetTop + dot.offsetHeight / 2;
  };
  const now = new Date();
  const dd = dayDate(currentDayKey);
  let curIdx, label;
  if(now < dd){ curIdx = 0; label = "시작 전"; }
  else if(!sameDate(now, dd) && now > dd){ curIdx = lis.length - 1; label = "종료"; }
  else {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    curIdx = 0;
    items.forEach((it, i) => { if(nowMin >= toMin(it[0])) curIdx = i; });
    label = "지금";
  }
  lis.forEach(li => {
    li.classList.remove("tl-current");
    const t = li.querySelector(".tl-tag");
    if(t){ t.hidden = true; t.textContent = ""; }
  });
  const cur = lis[curIdx];
  cur.classList.add("tl-current");
  const tag = cur.querySelector(".tl-tag");
  if(tag){ tag.textContent = label; tag.hidden = false; }
  prog.style.height = Math.max(0, dotY(curIdx) - 6) + "px";
}
setInterval(updateTimelineProgress, 60 * 1000);
window.addEventListener("resize", updateTimelineProgress);

$("timeline").addEventListener("click", (e) => {
  const pbBtn = e.target.closest("[data-planb]");
  if(pbBtn){
    e.stopPropagation();
    togglePlanB(pbBtn.dataset.planb);
    return;
  }
  const li = e.target.closest(".timeline li");
  if(li) li.classList.toggle("open");
});

async function togglePlanB(key){
  if(!canOps()) return;
  const pb = PLAN_B[key];
  const on = planBOn(key);
  const orig = originalItem(key);
  const [d, t] = key.split("-");
  const ask = on
    ? `${d}일차 ${t} 일정을 원래대로 되돌릴까요?\n${pb.name} → ${orig[1]}`
    : `${d}일차 ${t} 일정을 바꿀까요?\n${orig[1]} → ${pb.name}\n\n모두의 일정표가 바뀌고 긴급 공지가 올라가요.`;
  if(!confirm(ask)) return;
  const ok = await setState("planB:" + key, on ? "" : "1");
  if(!ok) return;
  const notice = on
    ? { title: `일정 원래대로: ${d}일차 ${orig[1]}`, body: `${d}일차 ${t} 일정은 원래 계획대로 진행해요.` }
    : { title: `일정 변경: ${d}일차 ${orig[1]} → ${pb.name}`, body: `${withRo(pb.reason)} ${d}일차 ${t} ${orig[1]} 대신 ${pb.name}에 가요.\n${pb.note}` };
  try { await api("notice", Object.assign({ important: true }, notice)); loadNotices(); } catch(e){}
}

function renderFindway(dayKey){
  const items = effectiveItems(dayKey);
  const labels = getStopMarkerLabels(items);
  const next = findNextStop(items, dayKey);
  $("nextStopLabel").textContent = nextStopLabel(dayKey);
  $("nextStopName").textContent = next.name;
  const nextLink = routeLink(next);
  $("nextStopGoBtn").style.display = nextLink ? "" : "none";
  if(nextLink) $("nextStopGoBtn").href = nextLink;
  $("findwayList").innerHTML = items.map((it, i) => {
    const note = it.alt ? it.alt.note : (SCHEDULE_NOTES[it.key] || "");
    const link = routeLink(it);
    return `
    <div class="findway-item${note ? " has-note" : ""}" data-lat="${it.lat != null ? it.lat : ""}" data-lng="${it.lng != null ? it.lng : ""}">
      <span class="fw-left">
        ${labels[i] ? `<span class="fw-marker">${labels[i]}</span>` : ""}
        <span class="fw-info">
          <span class="fw-time">${it.time}${(it.alt || it.altMove) ? '<span class="planb-chip on">☔ 대체</span>' : ""}</span>
          <span class="fw-name">${esc(it.name)}</span>
        </span>
      </span>
      ${link ? `<a class="fw-btn" href="${link}" target="_blank" rel="noopener">${ICON.pin}길찾기</a>` : ""}
      ${note ? `<p class="fw-note">${esc(note)}</p>` : ""}
    </div>`;
  }).join("");
}
$("findwayList").addEventListener("click", (e) => {
  if(e.target.closest(".fw-btn")) return;
  const item = e.target.closest(".findway-item");
  if(!item) return;
  if(item.classList.contains("has-note")) item.classList.toggle("note-open");
  const lat = item.dataset.lat, lng = item.dataset.lng;
  if(!lat || !lng) return;
  $("findwayList").querySelectorAll(".findway-item").forEach(el => el.classList.remove("active"));
  item.classList.add("active");
  focusMapOn(parseFloat(lat), parseFloat(lng));
});

function renderSchedule(){
  renderDay(currentDayKey);
  renderFindway(currentDayKey);
  if(leafletMap) renderMapForDay(currentDayKey);
}

const viewToggle = $("viewToggle");
viewToggle.addEventListener("click", (e) => {
  const btn = e.target.closest(".pill");
  if(!btn) return;
  viewToggle.querySelectorAll(".pill").forEach(p => p.classList.toggle("active", p === btn));
  const isFindway = btn.dataset.view === "findway";
  $("timeline").style.display = isFindway ? "none" : "";
  $("dayLabel").style.display = isFindway ? "none" : "";
  $("findwayView").style.display = isFindway ? "block" : "none";
  document.querySelector("#panel-schedule .scroll-area").scrollTop = 0;
  if(isFindway){
    if(!leafletMap) initMap();
    else { leafletMap.invalidateSize(); renderMapForDay(currentDayKey); }
  }
});

/* ---------- 오늘의 동선 지도 (Leaflet + OpenStreetMap) ---------- */
let leafletMap = null;
let myLatLng = null;
let myLocationMarker = null;
let stopMarkers = [];
let routeLine = null;
let highlightLine = null;

function stopIcon(content, isEmoji){
  return L.divIcon({
    className: "",
    html: '<div style="background:#1B2A4A;color:#fff;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:' + (isEmoji ? "13px" : "12px") + ';font-weight:700;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);">' + content + "</div>",
    iconSize: [26, 26],
    iconAnchor: [13, 13]
  });
}
function initMap(){
  leafletMap = L.map("mapContainer");
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(leafletMap);
  leafletMap.setView([33.38, 126.55], 9);
  renderMapForDay(currentDayKey);
  requestMyLocation();
}
function clearMapOverlays(){
  stopMarkers.forEach(m => leafletMap.removeLayer(m));
  stopMarkers = [];
  if(routeLine){ leafletMap.removeLayer(routeLine); routeLine = null; }
  if(highlightLine){ leafletMap.removeLayer(highlightLine); highlightLine = null; }
}
function renderMapForDay(dayKey){
  if(!leafletMap) return;
  clearMapOverlays();
  const items = effectiveItems(dayKey);
  // 제주 안의 장소만 지도에 표시 (청주·영동은 너무 멀어서 지도가 작아짐)
  // 같은 좌표에 '이동'과 '활동'이 겹치면 활동(이모티콘이 없는 일정)을 대표 마커로 씁니다.
  const byCoord = new Map();
  items.forEach(it => {
    if(it.lat == null || it.lng == null || it.lat > 34) return;
    const k = it.lat + "," + it.lng;
    const cur = byCoord.get(k);
    if(!cur || (stopCategory(cur) === "transit" && stopCategory(it) !== "transit")) byCoord.set(k, it);
  });
  const stops = [...byCoord.values()];
  const note = $("mapNote");
  if(!stops.length){ note.textContent = "이 날 일정에는 지도에 표시할 제주 장소가 없어요."; return; }
  note.textContent = "";
  const path = stops.map(it => [it.lat, it.lng]);
  let seq = 0;
  stops.forEach((it, i) => {
    const emoji = CATEGORY_EMOJI[stopCategory(it)];
    const label = items.filter(x => x.lat === it.lat && x.lng === it.lng).map(x => esc(x.name)).join(" · ");
    let marker;
    if(emoji){
      marker = L.marker(path[i], { icon: stopIcon(emoji, true) }).addTo(leafletMap).bindPopup(label);
    } else {
      seq++;
      marker = L.marker(path[i], { icon: stopIcon(seq, false) }).addTo(leafletMap).bindPopup(seq + ". " + label);
    }
    stopMarkers.push(marker);
  });
  routeLine = L.polyline(path, { color: "#c7cedb", weight: 4, dashArray: "6 6" }).addTo(leafletMap);
  leafletMap.fitBounds(routeLine.getBounds(), { padding: [24, 24], animate: false });
  updateNextStopRoute(items);
}
function updateNextStopRoute(items){
  if(!leafletMap) return;
  const next = findNextStop(items || effectiveItems(currentDayKey), currentDayKey);
  if(highlightLine){ leafletMap.removeLayer(highlightLine); highlightLine = null; }
  if(next && next.lat != null && next.lng != null && myLatLng){
    highlightLine = L.polyline([myLatLng, [next.lat, next.lng]], { color: "#FF5A36", weight: 4 }).addTo(leafletMap);
  }
}
function focusMapOn(lat, lng){
  if(!leafletMap) return;
  leafletMap.setView([lat, lng], 15);
  let closest = null, minDist = Infinity;
  stopMarkers.forEach(m => {
    const pos = m.getLatLng();
    const d = Math.abs(pos.lat - lat) + Math.abs(pos.lng - lng);
    if(d < minDist){ minDist = d; closest = m; }
  });
  if(closest) closest.openPopup();
  $("mapContainer").scrollIntoView({ behavior: "smooth", block: "center" });
}
function requestMyLocation(){
  const note = $("mapNote");
  if(!navigator.geolocation){ note.textContent = "이 브라우저는 위치 확인을 지원하지 않아요."; return; }
  note.textContent = "내 위치를 확인하는 중이에요...";
  navigator.geolocation.getCurrentPosition((pos) => {
    myLatLng = [pos.coords.latitude, pos.coords.longitude];
    if(myLocationMarker) leafletMap.removeLayer(myLocationMarker);
    myLocationMarker = L.marker(myLatLng, { icon: L.divIcon({
      className: "",
      html: '<div style="background:#FF5A36;width:18px;height:18px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4);"></div>',
      iconSize: [18, 18], iconAnchor: [9, 9]
    }) }).addTo(leafletMap).bindPopup("내 위치");
    note.textContent = "";
    updateNextStopRoute();
  }, () => {
    note.textContent = "위치 권한이 꺼져 있어요. 브라우저 설정에서 위치 접근을 허용한 뒤 새로고침 버튼을 눌러주세요.";
  }, { enableHighAccuracy: true, timeout: 8000 });
}
$("refreshLocationBtn").addEventListener("click", requestMyLocation);

/* ---------- 공지 ---------- */
const WELCOME_NOTICE = {
  time: "안내", important: false, title: "가쓸신제 제주 캠프 앱이에요",
  body: "일정·준비물·비상 연락망을 확인하고, 장소마다 활동 기록과 사진 미션을 남겨주세요. 새 공지가 올라오면 이 자리에 표시돼요.",
  by: "", id: ""
};
const URGENT_TOAST_SEEN_KEY = "urgent_toast_seen";
let urgentToastTimer = null;
function showUrgentToast(title){
  $("urgentToastText").textContent = "긴급 공지: " + title;
  $("urgentToast").classList.add("show");
  clearTimeout(urgentToastTimer);
  urgentToastTimer = setTimeout(() => $("urgentToast").classList.remove("show"), 4500);
}
$("urgentToast").addEventListener("click", () => {
  clearTimeout(urgentToastTimer);
  $("urgentToast").classList.remove("show");
});

function isImageUrl(url){
  return /\.(jpe?g|png|gif|webp)(\?|$)/i.test(url) || /drive\.google\.com\/(uc|thumbnail)\?/.test(url) || /googleusercontent\.com/.test(url);
}
// (이미 이스케이프된) 글 안의 주소를 링크로, 사진 주소는 사진으로 바꿉니다.
function linkify(escaped){
  if(!escaped) return escaped;
  return escaped.replace(/(https?:\/\/[^\s<]+|www\.[^\s<]+)/g, (match) => {
    const trailing = match.match(/[),.!?，。]+$/);
    const clean = trailing ? match.slice(0, -trailing[0].length) : match;
    const suffix = trailing ? trailing[0] : "";
    if(!clean) return match;
    const href = clean.startsWith("http") ? clean : "https://" + clean;
    if(isImageUrl(href)) return `<img src="${href}" class="notice-photo" loading="lazy" alt="공지 첨부 사진 (눌러서 크게 보기)">${suffix}`;
    return `<a href="${href}" target="_blank" rel="noopener" class="notice-link">${clean}</a>${suffix}`;
  });
}

let NOTICES = [];
function renderNotices(){
  const list = NOTICES.length ? NOTICES : [WELCOME_NOTICE];
  $("noticeList").innerHTML = list.map(n => {
    const canDelete = n.id && (isTeacher() || (canOps() && n.by === me.name));
    return `
    <div class="notice-card${n.important ? " important" : ""}">
      <div class="notice-top">
        <span class="notice-time">${esc(n.time)}</span>
        ${n.important ? '<span class="notice-chip">긴급</span>' : ""}
        ${n.by ? `<span class="notice-author">· ${esc(n.by)}</span>` : ""}
        ${canDelete ? `<button class="notice-delete-btn" type="button" data-id="${esc(n.id)}" title="삭제" aria-label="공지 삭제">${ICON.trash}</button>` : ""}
      </div>
      <p class="notice-title">${linkify(esc(n.title))}</p>
      <p class="notice-body">${linkify(esc(n.body))}</p>
    </div>`;
  }).join("");
  $("noticePing").style.display = NOTICES.some(n => n.important) ? "block" : "none";
  const urgent = NOTICES.find(n => n.important);
  if(urgent){
    const key = urgent.id || (urgent.time + "|" + urgent.title);
    if(store.get(URGENT_TOAST_SEEN_KEY, "") !== key){
      store.set(URGENT_TOAST_SEEN_KEY, key);
      showUrgentToast(urgent.title);
    }
  }
}
function loadNotices(){
  return sheetRows("공지", "시간").then(rows => {
    if(rows === null){ NOTICES = []; renderNotices(); return; }
    const list = rows.filter(r => r[2]).map(r => ({
      time: r[0] || "",
      important: /^(TRUE|1|긴급|Y)$/i.test((r[1] || "").trim()),
      title: r[2] || "",
      body: r[3] || "",
      by: r[4] || "",
      id: r[5] || ""
    })).reverse();
    NOTICES = mergePending(list, "notice").sort((a, b) => (b._ts || 0) - (a._ts || 0));
    renderNotices();
  }).catch(() => renderNotices());
}
$("noticeList").addEventListener("click", async (e) => {
  const btn = e.target.closest(".notice-delete-btn");
  if(!btn) return;
  if(!confirm("이 공지를 삭제할까요?")) return;
  btn.disabled = true;
  try {
    await api("deleteNotice", { id: btn.dataset.id });
    markDeleted(btn.dataset.id);
    NOTICES = NOTICES.filter(n => n.id !== btn.dataset.id);
    renderNotices();
    setTimeout(loadNotices, 1500);
  } catch(err){
    alert("삭제하지 못했어요. " + errText(err));
    btn.disabled = false;
  }
});

// 사진을 누르면 크게 보기
document.addEventListener("click", (e) => {
  const img = e.target.closest(".notice-photo, .mission-photo-preview");
  if(img){
    $("photoLightboxImg").src = img.src;
    $("photoLightbox").classList.add("show");
    return;
  }
  if(e.target.closest("#photoLightbox")){
    $("photoLightbox").classList.remove("show");
    $("photoLightboxImg").src = "";
  }
});

/* ---- 새 공지 작성 ---- */
let noticeImportant = false;
let noticePhotoUrl = null;
function openNoticeForm(){ $("noticeFormOverlay").style.display = "flex"; }
function resetNoticePhoto(){
  noticePhotoUrl = null;
  $("noticePhotoInput").value = "";
  $("noticePhotoStatus").textContent = "";
  $("noticePhotoStatus").className = "notice-photo-attach-status";
  $("noticePhotoPreviewWrap").style.display = "none";
  $("noticePhotoPreview").src = "";
}
$("newNoticeFab").addEventListener("click", openNoticeForm);
$("cancelNoticeBtn").addEventListener("click", () => {
  $("noticeFormOverlay").style.display = "none";
  resetNoticePhoto();
});
$("urgencyToggle").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if(!btn) return;
  $("urgencyToggle").querySelectorAll("button").forEach(b => b.classList.toggle("active", b === btn));
  noticeImportant = btn.dataset.val === "true";
});
$("noticePhotoInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if(!file) return;
  const status = $("noticePhotoStatus");
  status.textContent = "업로드 중...";
  status.className = "notice-photo-attach-status";
  try {
    const res = await uploadPhoto("noticePhoto", file);
    noticePhotoUrl = res.url;
    status.textContent = "업로드 완료 ✓";
    status.className = "notice-photo-attach-status done";
    $("noticePhotoPreview").src = URL.createObjectURL(file);
    $("noticePhotoPreviewWrap").style.display = "block";
  } catch(err){
    status.textContent = "업로드 실패 (" + errText(err) + ")";
    status.className = "notice-photo-attach-status failed";
  }
});
$("noticePhotoRemoveBtn").addEventListener("click", resetNoticePhoto);
$("submitNoticeBtn").addEventListener("click", async () => {
  const msg = $("noticeStatusMsg");
  const title = $("noticeTitleInput").value.trim();
  let body = $("noticeBodyInput").value.trim();
  if(!title){ setMsg(msg, "제목을 입력해주세요.", "err"); return; }
  if(noticePhotoUrl) body = body ? body + "\n" + noticePhotoUrl : noticePhotoUrl;
  $("submitNoticeBtn").disabled = true;
  setMsg(msg, "등록하는 중...");
  try {
    const res = await api("notice", { title, body, important: noticeImportant });
    pending.notice.push({ time: "방금", important: noticeImportant, title, body, by: me.name, id: res.id || ("tmp" + Date.now()), _ts: Date.now() });
    NOTICES = mergePending(NOTICES.filter(n => !n._ts), "notice").sort((a, b) => (b._ts || 0) - (a._ts || 0));
    renderNotices();
    setMsg(msg, "등록됐어요!", "ok");
    $("noticeTitleInput").value = "";
    $("noticeBodyInput").value = "";
    resetNoticePhoto();
    $("urgencyToggle").querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.val === "false"));
    noticeImportant = false;
    setTimeout(() => { $("noticeFormOverlay").style.display = "none"; setMsg(msg, ""); }, 900);
    setTimeout(loadNotices, 1500);
  } catch(err){
    setMsg(msg, "등록하지 못했어요. " + errText(err), "err");
  } finally {
    $("submitNoticeBtn").disabled = false;
  }
});

/* ---------- 집합 카운트다운 ---------- */
let assemblyTarget = null;
let assemblyTimer = null;
function updateAssemblyCountdown(){
  const card = $("assemblyCard");
  const el = $("assemblyCountdown");
  const diffMs = assemblyTarget - new Date();
  if(diffMs <= 0){
    el.textContent = "집합 시간이 지났어요!";
    card.classList.add("overdue");
    card.classList.remove("urgent");
    return;
  }
  // 남은 분은 올림해서 '적어도 이만큼은 남았다'는 뜻이 되게 합니다.
  const totalMin = Math.ceil(diffMs / 60000);
  const h = Math.floor(totalMin / 60), m = totalMin % 60;
  el.textContent = (h > 0 ? h + "시간 " : "") + m + "분";
  card.classList.remove("overdue");
  card.classList.toggle("urgent", diffMs <= 5 * 60 * 1000);
}
function showAssembly(place, lat, lng){
  $("assemblyCard").style.display = "block";
  const placeEl = $("assemblyPlace");
  if(place){
    const href = kakaoTo(place, lat || null, lng || null);
    placeEl.innerHTML = `<a class="place-map-link" href="${href}" target="_blank" rel="noopener">${esc(place)}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></a>`;
  } else placeEl.textContent = "-";
  $("assemblyTimeLabel").textContent = hm(assemblyTarget);
  updateAssemblyCountdown();
  clearInterval(assemblyTimer);
  assemblyTimer = setInterval(updateAssemblyCountdown, 1000);
}
function hideAssembly(){
  $("assemblyCard").style.display = "none";
  clearInterval(assemblyTimer);
  assemblyTimer = null;
}
function loadAssembly(){
  return sheetRows("집합안내", "목표시각").then(rows => {
    const p = pending.assembly;
    if(p && Date.now() - p.ts < PENDING_MS){
      const serverSame = rows && rows.length && rows[0][0] === p.targetTime;
      if(p.deleted ? (rows && rows.length) : !serverSame) return;   // 시트 반영 전이면 방금 바꾼 화면 유지
    }
    pending.assembly = null;
    if(!rows || !rows.length){ hideAssembly(); return; }
    const target = new Date(rows[0][0]);
    if(isNaN(target.getTime())){ hideAssembly(); return; }
    // 하루 넘게 지난 집합 시간은 숨김
    if(new Date() - target > 12 * 60 * 60 * 1000){ hideAssembly(); return; }
    assemblyTarget = target;
    showAssembly(rows[0][1] || "", rows[0][3], rows[0][4]);
  }).catch(() => {});
}
$("deleteAssemblyBtn").addEventListener("click", async () => {
  if(!confirm("등록된 집합 시간을 지울까요?")) return;
  try { await api("assemblyDelete"); pending.assembly = { deleted: true, ts: Date.now() }; hideAssembly(); }
  catch(err){ alert("지우지 못했어요. " + errText(err)); }
});

let assemblyLat = null, assemblyLng = null;
let assemblyMap = null, assemblyMarker = null;
function openAssemblyForm(){
  // 기본값: 30분 뒤 (10분 단위로 올림)
  const d = new Date(Date.now() + 30 * 60000);
  d.setMinutes(Math.ceil(d.getMinutes() / 10) * 10, 0, 0);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  if(!$("assemblyTimeInput").value) $("assemblyTimeInput").value = local;
  $("assemblyFormOverlay").style.display = "flex";
}
$("newAssemblyFab").addEventListener("click", openAssemblyForm);
$("cancelAssemblyBtn").addEventListener("click", () => { $("assemblyFormOverlay").style.display = "none"; });
$("captureAssemblyLocationBtn").addEventListener("click", () => {
  const st = $("assemblyLocationStatus");
  if(!navigator.geolocation){ st.textContent = "이 기기는 위치 확인을 지원하지 않아요."; return; }
  st.textContent = "위치 확인 중...";
  st.className = "location-capture-status";
  navigator.geolocation.getCurrentPosition((pos) => {
    assemblyLat = pos.coords.latitude;
    assemblyLng = pos.coords.longitude;
    st.textContent = "✓ 위치가 등록됐어요. 필요하면 아래 지도에서 위치를 조정하세요.";
    st.className = "location-capture-status ok";
    $("assemblyLocationMap").style.display = "block";
    $("assemblyLocationHint").style.display = "block";
    if(!assemblyMap){
      assemblyMap = L.map("assemblyLocationMap", { attributionControl: false }).setView([assemblyLat, assemblyLng], 17);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(assemblyMap);
      assemblyMarker = L.marker([assemblyLat, assemblyLng], { draggable: true }).addTo(assemblyMap);
      assemblyMarker.on("dragend", () => { const p = assemblyMarker.getLatLng(); assemblyLat = p.lat; assemblyLng = p.lng; });
      assemblyMap.on("click", (ev) => { assemblyMarker.setLatLng(ev.latlng); assemblyLat = ev.latlng.lat; assemblyLng = ev.latlng.lng; });
    } else {
      assemblyMap.setView([assemblyLat, assemblyLng], 17);
      assemblyMarker.setLatLng([assemblyLat, assemblyLng]);
    }
    setTimeout(() => assemblyMap.invalidateSize(), 100);
  }, () => {
    st.textContent = "위치를 가져오지 못했어요. 위치 권한을 확인해주세요.";
    st.className = "location-capture-status";
  }, { enableHighAccuracy: true, timeout: 8000 });
});
$("assemblySubmitBtn").addEventListener("click", async () => {
  const t = $("assemblyTimeInput").value;
  const place = $("assemblyPlaceInput").value.trim();
  const msg = $("assemblyStatusMsg");
  if(!t || !place){ setMsg(msg, "시각과 장소를 모두 입력해주세요.", "err"); return; }
  setMsg(msg, "등록하는 중...");
  $("assemblySubmitBtn").disabled = true;
  try {
    await api("assembly", { targetTime: t, place, lat: assemblyLat, lng: assemblyLng });
    pending.assembly = { targetTime: t, ts: Date.now() };
    setMsg(msg, "등록됐어요! 모두의 화면에 곧 보여요.", "ok");
    assemblyTarget = new Date(t);
    showAssembly(place, assemblyLat, assemblyLng);
    setTimeout(() => {
      $("assemblyFormOverlay").style.display = "none";
      setMsg(msg, "");
      $("assemblyPlaceInput").value = "";
      $("assemblyTimeInput").value = "";
      $("assemblyLocationStatus").textContent = "";
      $("assemblyLocationMap").style.display = "none";
      $("assemblyLocationHint").style.display = "none";
      assemblyLat = null; assemblyLng = null;
    }, 900);
  } catch(err){
    setMsg(msg, "등록하지 못했어요. " + errText(err), "err");
  } finally {
    $("assemblySubmitBtn").disabled = false;
  }
});

/* ---------- 공지 탭 위쪽 카드 (바뀐 일정 · 밤 체크 · 내 역할) ---------- */
const TOOL_ACTIONS = {
  notice: [["공지 쓰기", "openNotice"], ["집합 시간 등록", "openAssembly"]],
  budget: [["지출 기록하기", "budget"]],
  shots: [["촬영 체크리스트", "shots"]],
  record: [["팀 기록 모아보기", "record"]],
  health: [["밤 건강 체크", "health"], ["공지 쓰기", "openNotice"]]
};
function renderHome(){
  if(!me) return;
  let html = "";
  const active = Object.keys(PLAN_B).filter(planBOn);
  if(active.length){
    html += `<div class="home-card planb"><p class="hc-title">☔ 바뀐 일정</p><ul>${active.map(k => {
      const [d, t] = k.split("-");
      return `<li>${d}일차 ${t} ${esc(originalItem(k)[1])} → <b>${esc(PLAN_B[k].name)}</b> (${esc(PLAN_B[k].reason)})</li>`;
    }).join("")}</ul></div>`;
  }
  const night = campDay();
  if(night && Number(night) <= LODGINGS.length && new Date().getHours() >= 19){
    if(isTeacher()){
      html += `<div class="home-card nudge"><p class="hc-title">🌙 밤 건강 체크</p><p>학생들이 보낸 오늘 컨디션을 확인하세요.</p><div class="hc-actions"><button type="button" class="chip-btn" data-go="health">확인하기</button></div></div>`;
    } else if(!store.get("health_" + night, null)){
      html += `<div class="home-card nudge"><p class="hc-title">🌙 자기 전 컨디션 체크</p><p>오늘 컨디션을 한 번만 눌러주세요. 선생님만 봐요.</p><div class="hc-actions"><button type="button" class="chip-btn" data-go="health">체크하기</button></div></div>`;
    }
  }
  const actions = (TOOL_ACTIONS[me.tool] || []).slice();
  if(me.tool !== "record") actions.push(["활동 기록 남기기", "record"]);
  html += `<div class="home-card"><p class="hc-title">${esc(me.name)} · ${esc(me.role)}<span class="hc-sub">${esc(roleStatus())}</span></p>
    <ul>${(me.tasks || []).map(t => `<li>${esc(t)}</li>`).join("")}</ul>
    <div class="hc-actions">${actions.map(([label, go], i) => `<button type="button" class="chip-btn${i === 0 ? " primary" : ""}" data-go="${go}">${esc(label)}</button>`).join("")}</div>
  </div>`;
  $("homeCards").innerHTML = html;
}
function roleStatus(){
  if(me.tool === "budget" && expensesLoaded){
    const spent = EXPENSES.reduce((s, x) => s + x.amount, 0);
    return "남은 돈 " + won(BUDGET_TOTAL - spent);
  }
  if(me.tool === "shots"){
    const d = campDay() || currentShotDay;
    const total = (SHOTS[d] || []).length;
    const done = (SHOTS[d] || []).filter((_, i) => stateOf(`shot:${d}:${i}`)).length;
    return `Day ${d} 촬영 ${done}/${total}`;
  }
  return "";
}
$("homeCards").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-go]");
  if(!btn) return;
  const go = btn.dataset.go;
  if(go === "openNotice") openNoticeForm();
  else if(go === "openAssembly") openAssemblyForm();
  else if(go === "record") goTab("record");
  else goSub(go);
});

/* ---------- 준비물 ---------- */
$("teamItems").innerHTML = TEAM_ITEMS.map(t => `<span class="amenity-tag">${esc(t)}</span>`).join("");
let customItems = store.get("custom_items", []);
function checklistGroups(){
  const groups = Object.entries(CHECKLIST);
  const roleItems = me && ROLE_CHECKLIST[me.role];
  if(roleItems && roleItems.length) groups.push(["내 역할 준비물 · " + me.role, roleItems]);
  return groups;
}
function renderChecklist(){
  const saved = store.get("checklist_checked", []);
  const groupsEl = $("checklistGroups");
  groupsEl.innerHTML = checklistGroups().map(([group, items]) => `
    <p class="group-title">${esc(group)}</p>
    ${items.map(item => `
      <div class="check-item${saved.includes(item.text) ? " checked" : ""}" data-text="${esc(item.text)}">
        <span class="box">${ICON.check}</span>
        <span class="text">${esc(item.text)}</span>
        ${item.guide ? `<button type="button" class="item-guide-btn" data-guide-key="${item.guide}">안내</button>` : ""}
        ${item.essential ? '<span class="essential-badge">필수</span>' : ""}
      </div>`).join("")}
  `).join("") + `
    <p class="group-title">내가 추가한 준비물</p>
    ${customItems.map(text => `
      <div class="check-item${saved.includes(text) ? " checked" : ""}" data-text="${esc(text)}">
        <span class="box">${ICON.check}</span>
        <span class="text">${esc(text)}</span>
        <button type="button" class="custom-item-remove" data-remove="${esc(text)}" aria-label="삭제">×</button>
      </div>`).join("")}
    <div class="custom-item-add">
      <input type="text" id="customItemInput" maxlength="40" placeholder="직접 추가할 준비물">
      <button type="button" id="addCustomItemBtn">추가</button>
    </div>`;
  $("addCustomItemBtn").addEventListener("click", addCustomItem);
  $("customItemInput").addEventListener("keydown", (e) => { if(e.key === "Enter") addCustomItem(); });
  updateChecklistProgress();
}
function addCustomItem(){
  const input = $("customItemInput");
  const text = input.value.trim();
  if(!text || customItems.includes(text)){ input.value = ""; return; }
  customItems.push(text);
  store.set("custom_items", customItems);
  renderChecklist();
}
function saveChecklistState(){
  store.set("checklist_checked", [...$("checklistGroups").querySelectorAll(".check-item.checked")].map(el => el.dataset.text));
}
function updateChecklistProgress(){
  const total = $("checklistGroups").querySelectorAll(".check-item").length;
  const checked = $("checklistGroups").querySelectorAll(".check-item.checked").length;
  $("checkedCount").textContent = checked;
  $("totalCount").textContent = total;
  $("progressFill").style.width = (total ? checked / total * 100 : 0) + "%";
}
$("checklistGroups").addEventListener("click", (e) => {
  const rm = e.target.closest(".custom-item-remove");
  if(rm){
    customItems = customItems.filter(t => t !== rm.dataset.remove);
    store.set("custom_items", customItems);
    store.set("checklist_checked", store.get("checklist_checked", []).filter(t => t !== rm.dataset.remove));
    renderChecklist();
    return;
  }
  const guideBtn = e.target.closest(".item-guide-btn");
  if(guideBtn){
    const guide = ITEM_GUIDES[guideBtn.dataset.guideKey];
    if(!guide) return;
    $("itemGuideTitle").textContent = guide.title;
    $("itemGuideSteps").innerHTML = guide.steps.map(s => `<li>${esc(s)}</li>`).join("");
    $("itemGuideOverlay").style.display = "flex";
    return;
  }
  const item = e.target.closest(".check-item");
  if(!item) return;
  item.classList.toggle("checked");
  saveChecklistState();
  updateChecklistProgress();
});
$("closeItemGuideBtn").addEventListener("click", () => { $("itemGuideOverlay").style.display = "none"; });

/* ---------- 기록 탭: 활동 기록 / 사진 미션 전환 ---------- */
let recordView = "notes";
$("recordToggle").addEventListener("click", (e) => {
  const btn = e.target.closest(".pill");
  if(!btn) return;
  $("recordToggle").querySelectorAll(".pill").forEach(p => p.classList.toggle("active", p === btn));
  recordView = btn.dataset.view;
  $("recordNotesView").hidden = recordView !== "notes";
  $("recordMissionsView").hidden = recordView !== "missions";
  if(recordView === "notes") loadRecords();
});

/* ---------- 활동 기록 ---------- */
let RECORDS = [];
let recordsState = "idle";   // idle | loading | ok | offline | error
let recDay = campDay() || dayKeys[0];
let recBranch = null;

$("recDayPills").innerHTML = dayKeys.map(k => `<button class="pill${k === recDay ? " active" : ""}" data-day="${k}">Day ${k}</button>`).join("");
$("recDayPills").addEventListener("click", (e) => {
  const btn = e.target.closest(".pill");
  if(!btn) return;
  $("recDayPills").querySelectorAll(".pill").forEach(p => p.classList.toggle("active", p === btn));
  recDay = btn.dataset.day;
  renderRecordForm();
  renderRecordList();
});
$("recBranch").innerHTML = RECORD_BRANCHES.map(b => `<button type="button" class="chip" data-branch="${esc(b.key)}">${b.emoji} ${esc(b.key)}</button>`).join("");
$("recBranch").addEventListener("click", (e) => {
  const btn = e.target.closest(".chip");
  if(!btn) return;
  setRecBranch(btn.dataset.branch);
});
function setRecBranch(key){
  recBranch = key;
  $("recBranch").querySelectorAll(".chip").forEach(c => c.classList.toggle("active", c.dataset.branch === key));
}
function recordSpots(dayKey){
  return effectiveItems(dayKey).filter(it => RECORD_SPOTS[it.key]);
}
function renderRecordForm(){
  const sel = $("recSpot");
  const prev = sel.value;
  const spots = recordSpots(recDay);
  sel.innerHTML = spots.map(it => `<option value="${it.key}">${it.time} ${esc(it.name)}</option>`).join("") +
    '<option value="__custom">직접 입력 (그 밖의 장소)</option>';
  // 오늘이면 지금 시각에 가장 가까운 장소를 기본으로
  let pick = spots.some(s => s.key === prev) || prev === "__custom" ? prev : "";
  if(!pick && recDay === campDay()){
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    const past = spots.filter(s => toMin(s.time) <= nowMin);
    if(past.length) pick = past[past.length - 1].key;
  }
  if(pick) sel.value = pick;
  // 장소가 그대로면 직접 고른 갈래를 유지
  if(sel.value !== prev || recBranch === null) onSpotChange();
  else $("recSpotCustom").hidden = sel.value !== "__custom";
}
function onSpotChange(){
  const key = $("recSpot").value;
  $("recSpotCustom").hidden = key !== "__custom";
  setRecBranch(RECORD_SPOTS[key] || "기타");
}
$("recSpot").addEventListener("change", onSpotChange);
$("recText").value = store.get("rec_draft", "");
$("recText").addEventListener("input", () => store.set("rec_draft", $("recText").value));

function loadRecords(){
  if(recordsState !== "ok") recordsState = "loading";
  renderRecordList();
  return sheetRows("활동기록", "ID").then(rows => {
    if(rows === null){ recordsState = "offline"; RECORDS = []; renderRecordList(); return; }
    RECORDS = mergePending(rows.filter(r => r[0] && r[6]).map(r => ({
      id: r[0], at: r[1] || "", day: r[2] || "", key: r[3] || "", place: r[4] || "", branch: r[5] || "기타", text: r[6] || "", by: r[7] || ""
    })), "record");
    recordsState = "ok";
    renderRecordList();
  }).catch(() => { recordsState = "error"; renderRecordList(); });
}
function branchEmoji(key){
  const b = RECORD_BRANCHES.find(x => x.key === key);
  return b ? b.emoji : "✏️";
}
// 일차 안에서 일정 순서대로 장소별로 묶기
function groupRecords(dayKey){
  const recs = RECORDS.filter(r => String(r.day) === String(dayKey));
  const order = SCHEDULE[dayKey].items.map(it => dayKey + "-" + it[0]);
  const groups = new Map();
  recs.forEach(r => {
    const gk = r.key || ("custom:" + r.place);
    if(!groups.has(gk)) groups.set(gk, { key: r.key, place: r.place, list: [] });
    groups.get(gk).list.push(r);
  });
  return [...groups.values()].sort((a, b) => {
    const ia = a.key ? order.indexOf(a.key) : 999, ib = b.key ? order.indexOf(b.key) : 999;
    return ia - ib;
  });
}
function renderRecordList(){
  const el = $("recList");
  $("recCopyBtn").hidden = !isReporter();
  if(recordsState === "offline"){ el.innerHTML = '<p class="empty-line">구글시트를 연결하면 팀원들의 기록이 여기에 모여요.</p>'; $("recListTitle").textContent = "팀 기록"; return; }
  if(recordsState === "error"){ el.innerHTML = '<p class="empty-line">기록을 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침을 눌러주세요.</p>'; return; }
  if(recordsState === "loading" && !RECORDS.length){ el.innerHTML = '<p class="empty-line">불러오는 중...</p>'; return; }
  const groups = groupRecords(recDay);
  const count = groups.reduce((s, g) => s + g.list.length, 0);
  $("recListTitle").textContent = `Day ${recDay} 팀 기록 ${count}개`;
  if(!count){ el.innerHTML = '<p class="empty-line">아직 기록이 없어요. 첫 기록을 남겨보세요!</p>'; return; }
  el.innerHTML = groups.map(g => {
    const it = g.key ? effectiveItems(recDay).find(x => x.key === g.key) : null;
    return `<div class="rec-group">
      <p class="rec-group-title">${it ? `<span class="rg-time">${it.time}</span>` : ""}${esc(g.place)}</p>
      ${g.list.map(r => {
        const mine = me && r.by === me.name;
        return `<div class="rec-card${mine ? " mine" : ""}">
          <div class="rec-meta">
            <span class="rec-branch">${branchEmoji(r.branch)} ${esc(r.branch)}</span>
            <span class="rec-author">${esc(r.by)}</span>
            <span class="rec-time">${esc(r.at)}</span>
            ${mine || isTeacher() ? `<button type="button" class="rec-del" data-id="${esc(r.id)}" aria-label="기록 삭제">×</button>` : ""}
          </div>
          <p class="rec-text">${esc(r.text)}</p>
        </div>`;
      }).join("")}
    </div>`;
  }).join("");
}
$("recSaveBtn").addEventListener("click", async () => {
  const msg = $("recMsg");
  const text = $("recText").value.trim();
  const key = $("recSpot").value;
  let place;
  if(key === "__custom"){
    place = $("recSpotCustom").value.trim();
    if(!place){ setMsg(msg, "장소 이름을 적어주세요.", "err"); return; }
  } else {
    const it = effectiveItems(recDay).find(x => x.key === key);
    place = it ? it.name : key;
  }
  if(text.length < 5){ setMsg(msg, "조금만 더 자세히 적어주세요. (5자 이상)", "err"); return; }
  $("recSaveBtn").disabled = true;
  setMsg(msg, "저장하는 중...");
  try {
    const res = await api("record", { day: recDay, key: key === "__custom" ? "" : key, place, branch: recBranch || "기타", text });
    const rec = { id: res.id || ("tmp" + Date.now()), at: res.at || hm(new Date()), day: recDay, key: key === "__custom" ? "" : key, place, branch: recBranch || "기타", text, by: me.name, _ts: Date.now() };
    pending.record.push(rec);
    RECORDS.push(rec);
    if(recordsState !== "ok") recordsState = "ok";
    $("recText").value = "";
    store.del("rec_draft");
    $("recSpotCustom").value = "";
    setMsg(msg, "기록했어요! 보고서에 그대로 쓰여요.", "ok");
    renderRecordList();
    setTimeout(loadRecords, 3000);
  } catch(err){
    setMsg(msg, "저장하지 못했어요. " + errText(err), "err");
  } finally {
    $("recSaveBtn").disabled = false;
  }
});
$("recList").addEventListener("click", async (e) => {
  const btn = e.target.closest(".rec-del");
  if(!btn) return;
  if(!confirm("이 기록을 지울까요?")) return;
  try {
    await api("deleteRecord", { id: btn.dataset.id });
    markDeleted(btn.dataset.id);
    pending.record = pending.record.filter(r => r.id !== btn.dataset.id);
    RECORDS = RECORDS.filter(r => r.id !== btn.dataset.id);
    renderRecordList();
  } catch(err){ alert("지우지 못했어요. " + errText(err)); }
});
$("recRefreshBtn").addEventListener("click", loadRecords);
$("recCopyBtn").addEventListener("click", () => {
  if(!RECORDS.length){ alert("아직 모인 기록이 없어요."); return; }
  let out = `「제주! 내가 계획하는 캠프」 활동 기록 모음\n관통 질문: ${CAMP.question} — ${CAMP.questionSub}\n`;
  dayKeys.forEach(d => {
    const groups = groupRecords(d);
    if(!groups.length) return;
    out += `\n[${d}일차 ${dayShort(d)}]\n`;
    groups.forEach(g => {
      out += `■ ${g.place}\n`;
      g.list.forEach(r => { out += `- ${r.by}(${r.branch}): ${r.text.replace(/\s*\n+\s*/g, " ")}\n`; });
    });
  });
  copyText(out, "복사했어요! 운영 결과 보고서 문서에 붙여넣으세요.");
});

/* ---------- 사진 미션 ---------- */
function renderMissions(){
  const saved = store.get("mission_checked", []);
  const photos = store.get("mission_photos", {});
  $("missionTotalCount").textContent = MISSIONS.length;
  $("missionList").innerHTML = MISSIONS.map(m => `
    <div class="check-item mission-item${saved.includes(m.title) ? " checked" : ""}" data-mission="${esc(m.title)}">
      <span class="box">${ICON.check}</span>
      <span class="mission-text">
        <span class="mission-day">Day ${m.day}</span>
        <span class="text">${esc(m.title)}</span>
        <p class="mission-desc">${esc(m.desc)}</p>
        <div class="mission-photo-row">
          <label class="mission-photo-btn">
            <input type="file" accept="image/*" class="mission-photo-input" hidden>
            ${ICON.camera}
            사진 올리기
          </label>
          <span class="mission-photo-status"></span>
        </div>
        ${photos[m.title] ? `<img class="mission-photo-preview" src="${photos[m.title]}" alt="올린 미션 사진 (눌러서 크게 보기)">` : ""}
      </span>
    </div>`).join("");
  updateMissionProgress();
}
function updateMissionProgress(){
  const checked = $("missionList").querySelectorAll(".check-item.checked").length;
  $("missionCheckedCount").textContent = checked;
  $("missionProgressFill").style.width = (MISSIONS.length ? checked / MISSIONS.length * 100 : 0) + "%";
}
$("missionList").addEventListener("change", async (e) => {
  const input = e.target.closest(".mission-photo-input");
  if(!input || !input.files[0]) return;
  const file = input.files[0];
  input.value = "";
  const item = input.closest(".mission-item");
  const title = item.dataset.mission;
  const mission = MISSIONS.find(m => m.title === title);
  const status = item.querySelector(".mission-photo-status");
  // 화면에는 바로 작은 미리보기를 보여주고(이 기기에 저장), 원본은 드라이브로 올려요.
  try {
    const small = "data:image/jpeg;base64," + await compressImageFile(file, 600, 0.6);
    const photos = store.get("mission_photos", {});
    photos[title] = small;
    store.set("mission_photos", photos);
    let img = item.querySelector(".mission-photo-preview");
    if(!img){
      img = document.createElement("img");
      img.className = "mission-photo-preview";
      img.alt = "올린 미션 사진 (눌러서 크게 보기)";
      item.querySelector(".mission-text").appendChild(img);
    }
    img.src = small;
  } catch(err){ /* 미리보기는 부가 기능 */ }
  status.textContent = "업로드 중...";
  status.className = "mission-photo-status uploading";
  try {
    await uploadPhoto("missionPhoto", file, { mission: title, day: mission ? mission.day : "" });
    status.textContent = "업로드 완료 ✓";
    status.className = "mission-photo-status done";
    item.classList.add("checked");
    const saved = store.get("mission_checked", []);
    if(!saved.includes(title)){ saved.push(title); store.set("mission_checked", saved); }
    updateMissionProgress();
  } catch(err){
    status.textContent = "업로드 실패 (" + errText(err) + ")";
    status.className = "mission-photo-status failed";
  }
});
$("missionList").addEventListener("click", (e) => {
  if(e.target.closest(".mission-photo-input")) e.stopPropagation();
});
$("photoFolderLink").href = CONFIG.PHOTO_FOLDER_URL;

/* ---------- 예산 · 지출 기록 ---------- */
const BUDGET_TOTAL = BUDGET.reduce((s, b) => s + b.amount, 0);
let EXPENSES = [];
let expensesLoaded = false;
let expensesOffline = false;
let budgetDay = "all";
let expDay = campDay() || dayKeys[0];
let expReceiptUrl = "";
let expPrefill = 0;

function loadExpenses(){
  return sheetRows("지출", "ID").then(rows => {
    expensesOffline = rows === null;
    EXPENSES = mergePending((rows || []).filter(r => r[0]).map(r => ({
      id: r[0], at: r[1] || "", day: r[2] || "", planIdx: r[3] === "" || r[3] == null ? -1 : Number(r[3]),
      item: r[4] || "", place: r[5] || "", amount: Number(String(r[6] || "0").replace(/[^\d.-]/g, "")) || 0,
      receipt: r[7] || "", by: r[8] || "", memo: r[9] || ""
    })), "expense");
    expensesLoaded = true;
    renderBudget();
    renderHome();
  }).catch(() => renderBudget());
}
function spentOn(idx){ return EXPENSES.filter(x => x.planIdx === idx).reduce((s, x) => s + x.amount, 0); }
function expenseLine(x){
  const canDel = canBudget();
  return `<li class="exp-line">
    <span>${esc(x.place || x.item)}${x.memo ? " · " + esc(x.memo) : ""} · ${esc(x.by)} ${esc(x.at)}</span>
    ${x.receipt ? `<a href="${esc(x.receipt)}" target="_blank" rel="noopener">영수증</a>` : ""}
    <span class="el-amount">${won(x.amount)}</span>
    ${canDel ? `<button type="button" class="rec-del" data-exp="${esc(x.id)}" aria-label="지출 삭제">×</button>` : ""}
  </li>`;
}
function renderBudget(){
  const spent = EXPENSES.reduce((s, x) => s + x.amount, 0);
  $("budgetTotal").textContent = won(BUDGET_TOTAL);
  $("budgetLeft").textContent = won(BUDGET_TOTAL - spent);
  $("budgetBar").style.width = Math.min(100, BUDGET_TOTAL ? spent / BUDGET_TOTAL * 100 : 0) + "%";
  $("budgetSpentNote").textContent = expensesOffline
    ? "구글시트를 연결하면 지출 기록이 모여 잔액이 계산돼요. 결제는 지도교사 체크카드로만!"
    : `지금까지 ${won(spent)} 사용 · 지출 기록 ${EXPENSES.length}건 · 영수증은 예산 담당(김하영)에게`;
  $("expenseForm").hidden = !canBudget();
  $("budgetCopyBtn").hidden = !canBudget();
  $("budgetDayPills").innerHTML = [["all", "전체"]].concat(dayKeys.map(k => [k, "Day " + k])).map(([k, label]) =>
    `<button class="pill${k === budgetDay ? " active" : ""}" data-day="${k}">${label}</button>`).join("");
  const days = budgetDay === "all" ? dayKeys : [budgetDay];
  $("budgetList").innerHTML = days.map(d => {
    let planSum = 0, spentSum = 0;
    const rows = BUDGET.map((b, idx) => ({ b, idx })).filter(x => String(x.b.day) === d).map(({ b, idx }) => {
      const s = spentOn(idx);
      planSum += b.amount; spentSum += s;
      const lines = EXPENSES.filter(x => x.planIdx === idx);
      const cls = s > b.amount ? "over" : (s > 0 ? "done" : "");
      return `<li class="${cls}">
        <div class="bl-row">
          <span><p class="bl-item">${esc(b.item)}</p><p class="bl-calc">${esc(b.calc)}</p></span>
          <span><p class="bl-amount">${won(b.amount)}</p><p class="bl-spent">${s ? "집행 " + won(s) + (s !== b.amount ? ` (${s > b.amount ? "+" : "−"}${won(Math.abs(s - b.amount))})` : " ✓") : "미집행"}</p></span>
        </div>
        ${lines.length ? `<ul class="exp-lines">${lines.map(expenseLine).join("")}</ul>` : ""}
      </li>`;
    });
    const extra = EXPENSES.filter(x => x.planIdx === -1 && String(x.day) === d);
    if(extra.length){
      const s = extra.reduce((t, x) => t + x.amount, 0);
      spentSum += s;
      rows.push(`<li class="over"><div class="bl-row"><span><p class="bl-item">계획에 없는 지출</p><p class="bl-calc">정산 때 사유를 꼭 적어주세요</p></span><span><p class="bl-amount">-</p><p class="bl-spent">집행 ${won(s)}</p></span></div><ul class="exp-lines">${extra.map(expenseLine).join("")}</ul></li>`);
    }
    rows.push(`<li class="bl-subtotal"><div class="bl-row"><span><p class="bl-item">Day ${d} 소계 · ${dayShort(d)}</p></span><span><p class="bl-amount">${won(planSum)}</p><p class="bl-spent">집행 ${won(spentSum)}</p></span></div></li>`);
    return rows.join("");
  }).join("");
  renderExpenseForm();
}
function renderExpenseForm(){
  if(!canBudget()) return;
  $("expDayPills").innerHTML = dayKeys.map(k => `<button class="pill${k === expDay ? " active" : ""}" data-day="${k}">Day ${k}</button>`).join("");
  const sel = $("expItem");
  const prev = sel.value;
  sel.innerHTML = BUDGET.map((b, idx) => ({ b, idx })).filter(x => String(x.b.day) === expDay)
    .map(({ b, idx }) => `<option value="${idx}">${esc(b.item)} (${won(b.amount)})${spentOn(idx) ? " · 기록 있음" : ""}</option>`).join("") +
    '<option value="-1">계획에 없는 지출 (기타)</option>';
  if([...sel.options].some(o => o.value === prev)) sel.value = prev;
  else {
    const firstOpen = [...sel.options].find(o => o.value !== "-1" && !spentOn(Number(o.value)));
    if(firstOpen) sel.value = firstOpen.value;
  }
  prefillExpenseAmount();
}
function prefillExpenseAmount(){
  const idx = Number($("expItem").value);
  const amt = $("expAmount");
  const plan = idx >= 0 ? BUDGET[idx].amount : 0;
  if(!amt.value || Number(amt.value) === expPrefill){ amt.value = plan || ""; expPrefill = plan; }
}
$("budgetDayPills").addEventListener("click", (e) => {
  const btn = e.target.closest(".pill");
  if(!btn) return;
  budgetDay = btn.dataset.day;
  renderBudget();
});
$("expDayPills").addEventListener("click", (e) => {
  const btn = e.target.closest(".pill");
  if(!btn) return;
  expDay = btn.dataset.day;
  $("expItem").value = "";
  renderExpenseForm();
});
$("expItem").addEventListener("change", prefillExpenseAmount);
$("expReceiptInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if(!file) return;
  const status = $("expReceiptStatus");
  status.textContent = "업로드 중...";
  status.className = "notice-photo-attach-status";
  try {
    const res = await uploadPhoto("receiptPhoto", file, { day: expDay });
    expReceiptUrl = res.url;
    status.textContent = "영수증 올림 ✓";
    status.className = "notice-photo-attach-status done";
  } catch(err){
    expReceiptUrl = "";
    status.textContent = "업로드 실패 (" + errText(err) + ")";
    status.className = "notice-photo-attach-status failed";
  }
  e.target.value = "";
});
$("expSaveBtn").addEventListener("click", async () => {
  const msg = $("expMsg");
  const idx = Number($("expItem").value);
  const amount = Math.round(Number($("expAmount").value));
  const place = $("expPlace").value.trim();
  if(!(amount > 0)){ setMsg(msg, "금액을 입력해주세요.", "err"); return; }
  if(idx === -1 && !$("expMemo").value.trim()){ setMsg(msg, "계획에 없는 지출은 메모에 사유를 적어주세요.", "err"); return; }
  const item = idx >= 0 ? BUDGET[idx].item : "기타";
  $("expSaveBtn").disabled = true;
  setMsg(msg, "저장하는 중...");
  try {
    const res = await api("expense", { day: expDay, planIdx: idx, item, place, amount, receipt: expReceiptUrl, memo: $("expMemo").value.trim() });
    const exp = { id: res.id || ("tmp" + Date.now()), at: res.at || hm(new Date()), day: expDay, planIdx: idx, item, place, amount, receipt: expReceiptUrl, by: me.name, memo: $("expMemo").value.trim(), _ts: Date.now() };
    pending.expense.push(exp);
    EXPENSES.push(exp);
    $("expPlace").value = ""; $("expAmount").value = ""; $("expMemo").value = "";
    expReceiptUrl = ""; expPrefill = 0;
    $("expReceiptStatus").textContent = "";
    setMsg(msg, "저장했어요! 영수증 원본도 잘 보관해주세요.", "ok");
    $("expItem").value = "";
    renderBudget();
    renderHome();
    setTimeout(loadExpenses, 3000);
  } catch(err){
    setMsg(msg, "저장하지 못했어요. " + errText(err), "err");
  } finally {
    $("expSaveBtn").disabled = false;
  }
});
$("budgetList").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-exp]");
  if(!btn) return;
  if(!confirm("이 지출 기록을 지울까요?")) return;
  try {
    await api("deleteExpense", { id: btn.dataset.exp });
    markDeleted(btn.dataset.exp);
    pending.expense = pending.expense.filter(x => x.id !== btn.dataset.exp);
    EXPENSES = EXPENSES.filter(x => x.id !== btn.dataset.exp);
    renderBudget();
  } catch(err){ alert("지우지 못했어요. " + errText(err)); }
});
$("budgetRefreshBtn").addEventListener("click", loadExpenses);
$("budgetCopyBtn").addEventListener("click", () => {
  const rows = [["순", "일자", "품명", "산출내역", "계획액", "집행액", "차액", "사용처", "영수증"]];
  let n = 0, planT = 0, spentT = 0;
  BUDGET.forEach((b, idx) => {
    const lines = EXPENSES.filter(x => x.planIdx === idx);
    const s = spentOn(idx);
    planT += b.amount; spentT += s;
    rows.push([++n, dayShort(b.day), b.item, b.calc, b.amount, s, b.amount - s,
      lines.map(x => x.place).filter(Boolean).join(", "), lines.filter(x => x.receipt).length ? "있음" : (s ? "없음" : "")]);
  });
  EXPENSES.filter(x => x.planIdx === -1).forEach(x => {
    spentT += x.amount;
    rows.push([++n, dayShort(x.day), "기타: " + (x.memo || ""), "", 0, x.amount, -x.amount, x.place, x.receipt ? "있음" : "없음"]);
  });
  rows.push(["", "", "합계", "", planT, spentT, planT - spentT, "", ""]);
  copyText(rows.map(r => r.join("\t")).join("\n"), "복사했어요! 엑셀·한글 표에 붙여넣으면 칸이 나뉘어 들어가요.");
});

/* ---------- 숙소 안내 · 안전 체크 ---------- */
let editingLodgeDay = null;
function renderLodging(){
  const tonight = campDay();
  $("lodgeList").innerHTML = LODGINGS.map(l => {
    const info = lodgeInfo(l.day);
    const isTonight = String(l.day) === tonight;
    const route = info.lat != null ? kakaoTo(info.name, info.lat, info.lng) : (info.addr ? kakaoTo(info.addr) : null);
    const checks = LODGE_SAFETY.map((text, i) => {
      const st = stateOf(`lodgeChk:${l.day}:${i}`);
      return `<div class="check-item${st ? " checked" : ""}" data-lodgechk="${l.day}:${i}">
        <span class="box">${ICON.check}</span><span class="text">${esc(text)}</span>
        ${st ? `<span class="who">${esc(st.value)} ${esc(st.at)}</span>` : ""}
      </div>`;
    }).join("");
    return `<div class="lodge-card${isTonight ? " tonight" : ""}">
      <p class="lodge-night">${l.day}일차 밤 · ${dayShort(l.day)}${isTonight ? " · 오늘 밤" : ""}</p>
      <p class="lodge-name">${esc(info.name)}</p>
      <p class="lodge-addr">${info.addr ? esc(info.addr) : "주소는 선생님이 확정한 뒤 입력해요"}</p>
      ${info.note ? `<p class="lodge-note">${esc(info.note)}</p>` : ""}
      <div class="lodge-actions">
        ${route ? `<a class="chip-btn" href="${route}" target="_blank" rel="noopener">📍 길찾기</a>` : ""}
        ${info.tel ? `<a class="chip-btn" href="tel:${esc(info.tel.replace(/[^\d+]/g, ""))}">📞 ${esc(info.tel)}</a>` : ""}
        ${isTeacher() ? `<button type="button" class="chip-btn" data-lodgeedit="${l.day}">✏️ 정보 수정</button>` : ""}
      </div>
      <div class="lodge-safety">${checks}</div>
    </div>`;
  }).join("") + `<div class="lodge-card"><p class="lodge-name">숙소 생활 약속</p><ul class="lodge-rules">${LODGE_RULES.map(r => `<li>${esc(r)}</li>`).join("")}</ul></div>`;
}
$("lodgeList").addEventListener("click", (e) => {
  const edit = e.target.closest("[data-lodgeedit]");
  if(edit){
    editingLodgeDay = edit.dataset.lodgeedit;
    const info = lodgeInfo(editingLodgeDay);
    $("lodgeEditTitle").textContent = editingLodgeDay + "일차 숙소 정보";
    $("lodgeNameInput").value = info.name;
    $("lodgeAddrInput").value = info.addr || "";
    $("lodgeTelInput").value = info.tel || "";
    setMsg($("lodgeMsg"), "");
    $("lodgeEditOverlay").style.display = "flex";
    return;
  }
  const chk = e.target.closest("[data-lodgechk]");
  if(chk){
    const key = "lodgeChk:" + chk.dataset.lodgechk;
    setState(key, stateOf(key) ? "" : me.name);
  }
});
$("cancelLodgeBtn").addEventListener("click", () => { $("lodgeEditOverlay").style.display = "none"; });
$("saveLodgeBtn").addEventListener("click", async () => {
  const value = JSON.stringify({
    name: $("lodgeNameInput").value.trim(),
    addr: $("lodgeAddrInput").value.trim(),
    tel: $("lodgeTelInput").value.trim()
  });
  setMsg($("lodgeMsg"), "저장하는 중...");
  const ok = await setState("lodge:" + editingLodgeDay, value);
  if(ok){
    setMsg($("lodgeMsg"), "저장했어요!", "ok");
    setTimeout(() => { $("lodgeEditOverlay").style.display = "none"; }, 700);
    renderLodging();
  } else setMsg($("lodgeMsg"), "저장하지 못했어요.", "err");
});

/* ---------- 밤 건강 체크 ---------- */
const CONDITIONS = [
  { key: "좋음", emoji: "😀", label: "좋아요" },
  { key: "보통", emoji: "🙂", label: "보통이에요" },
  { key: "나쁨", emoji: "😣", label: "안 좋아요" }
];
const SYMPTOMS = ["멀미", "두통", "배탈", "열", "다침", "피곤", "기타"];
const nightKeys = LODGINGS.map(l => String(l.day));
let healthDay = nightKeys.includes(campDay()) ? campDay() : nightKeys[0];
let healthCond = null;
let healthSyms = new Set();
let HEALTH = [];

$("condBtns").innerHTML = CONDITIONS.map(c => `<button type="button" class="cond-btn" data-cond="${c.key}"><span class="ce">${c.emoji}</span>${c.label}</button>`).join("");
$("symptomChips").innerHTML = SYMPTOMS.map(s => `<button type="button" class="chip" data-sym="${s}">${s}</button>`).join("");
$("condBtns").addEventListener("click", (e) => {
  const btn = e.target.closest(".cond-btn");
  if(!btn) return;
  healthCond = btn.dataset.cond;
  $("condBtns").querySelectorAll(".cond-btn").forEach(b => b.classList.toggle("active", b === btn));
});
$("symptomChips").addEventListener("click", (e) => {
  const btn = e.target.closest(".chip");
  if(!btn) return;
  const s = btn.dataset.sym;
  if(healthSyms.has(s)) healthSyms.delete(s); else healthSyms.add(s);
  btn.classList.toggle("active", healthSyms.has(s));
});
$("healthDayPills").addEventListener("click", (e) => {
  const btn = e.target.closest(".pill");
  if(!btn) return;
  healthDay = btn.dataset.day;
  renderHealth();
  if(isTeacher()) loadHealth();
});
function renderHealth(){
  $("healthDayPills").innerHTML = nightKeys.map(k => `<button class="pill${k === healthDay ? " active" : ""}" data-day="${k}">${k}일차 밤</button>`).join("");
  $("healthStudentView").hidden = isTeacher();
  $("healthTeacherView").hidden = !isTeacher();
  $("healthDesc").textContent = isTeacher()
    ? "학생들이 보낸 컨디션이에요. 이 내용은 선생님만 볼 수 있는 시트에 따로 저장돼요."
    : "자기 전에 오늘 컨디션을 한 번 눌러주세요. 선생님만 볼 수 있어요.";
  if(!isTeacher()){
    const sent = store.get("health_" + healthDay, null);
    setMsg($("healthMsg"), sent ? `${healthDay}일차 밤 ${sent.at}에 '${sent.condition}'으로 보냈어요. 다시 보내면 새 내용으로 바뀌어요.` : "", sent ? "ok" : "");
  } else renderHealthList();
}
$("healthSaveBtn").addEventListener("click", async () => {
  const msg = $("healthMsg");
  if(!healthCond){ setMsg(msg, "컨디션을 하나 골라주세요.", "err"); return; }
  $("healthSaveBtn").disabled = true;
  setMsg(msg, "보내는 중...");
  try {
    await api("health", { day: healthDay, condition: healthCond, symptoms: [...healthSyms].join(", "), memo: $("healthMemo").value.trim() });
    store.set("health_" + healthDay, { condition: healthCond, at: hm(new Date()) });
    $("healthMemo").value = "";
    setMsg(msg, healthCond === "나쁨" ? "보냈어요. 선생님이 곧 확인할게요. 많이 힘들면 바로 전화하세요!" : "보냈어요! 오늘도 수고했어요. 푹 자요 🌙", "ok");
    renderHome();
  } catch(err){
    setMsg(msg, "보내지 못했어요. " + errText(err), "err");
  } finally {
    $("healthSaveBtn").disabled = false;
  }
});
function loadHealth(){
  $("healthList").innerHTML = '<p class="empty-line">불러오는 중...</p>';
  return api("healthList").then(res => {
    HEALTH = res.rows || [];
    renderHealthList();
  }).catch(err => {
    $("healthList").innerHTML = `<p class="empty-line">${esc(errText(err))}</p>`;
  });
}
function renderHealthList(){
  const students = PEOPLE.filter(p => !p.teacher);
  const latest = {};
  HEALTH.filter(h => String(h.day) === String(healthDay)).forEach(h => { latest[h.name] = h; });
  const done = students.filter(p => latest[p.name]).length;
  $("healthListTitle").textContent = `${healthDay}일차 밤 · ${done}/${students.length}명`;
  $("healthList").innerHTML = students.map(p => {
    const h = latest[p.name];
    if(!h) return `<div class="health-row missing"><span class="hr-emoji">⏳</span><span class="hr-info"><p class="hr-name">${esc(p.name)}</p><p class="hr-detail">아직 안 보냈어요</p></span></div>`;
    const c = CONDITIONS.find(x => x.key === h.condition) || { emoji: "❔" };
    const detail = [h.symptoms, h.memo].filter(Boolean).join(" · ") || "특이사항 없음";
    return `<div class="health-row${h.condition === "나쁨" ? " bad" : ""}"><span class="hr-emoji">${c.emoji}</span><span class="hr-info"><p class="hr-name">${esc(p.name)} · ${esc(h.condition)}</p><p class="hr-detail">${esc(detail)}</p></span><span class="hr-time">${esc(h.at)}</span></div>`;
  }).join("");
}
$("healthRefreshBtn").addEventListener("click", loadHealth);

/* ---------- 촬영 체크리스트 ---------- */
let currentShotDay = campDay() || dayKeys[0];
$("editGuide").innerHTML = `<p class="eg-title">🎬 편집 담당 안내</p><ul>${EDIT_GUIDE.map(t => `<li>${esc(t)}</li>`).join("")}</ul>`;
function renderShots(){
  $("shotDayPills").innerHTML = dayKeys.map(k => `<button class="pill${k === currentShotDay ? " active" : ""}" data-day="${k}">Day ${k}</button>`).join("");
  const list = SHOTS[currentShotDay] || [];
  let done = 0;
  const rows = list.map((text, i) => {
    const st = stateOf(`shot:${currentShotDay}:${i}`);
    if(st) done++;
    return `<div class="check-item${st ? " checked" : ""}" data-shot="shot:${currentShotDay}:${i}">
      <span class="box">${ICON.check}</span><span class="text">${esc(text)}</span>
      ${st ? `<span class="who">${esc(st.value)} ${esc(st.at)}</span>` : ""}
    </div>`;
  });
  const bk = stateOf("backup:" + currentShotDay);
  rows.push(`<div class="check-item backup${bk ? " checked" : ""}" data-shot="backup:${currentShotDay}">
    <span class="box">${ICON.check}</span><span class="text">💾 오늘 촬영본 백업 완료</span>
    ${bk ? `<span class="who">${esc(bk.value)} ${esc(bk.at)}</span>` : ""}
  </div>`);
  $("shotList").innerHTML = rows.join("");
  $("shotCheckedCount").textContent = done;
  $("shotTotalCount").textContent = list.length;
  $("shotProgressFill").style.width = (list.length ? done / list.length * 100 : 0) + "%";
}
$("shotDayPills").addEventListener("click", (e) => {
  const btn = e.target.closest(".pill");
  if(!btn) return;
  currentShotDay = btn.dataset.day;
  renderShots();
});
$("shotList").addEventListener("click", (e) => {
  const item = e.target.closest("[data-shot]");
  if(!item) return;
  const key = item.dataset.shot;
  setState(key, stateOf(key) ? "" : me.name);
});

/* ---------- 역할 분담 ---------- */
function renderRoles(){
  $("roleList").innerHTML = PEOPLE.map(p => `
    <div class="role-card${me && p.name === me.name ? " mine" : ""}">
      <div class="role-head"><p class="role-name">${esc(p.name)}${p.teacher ? " 선생님" : ""}</p><span class="role-tag">${esc(p.role)}</span></div>
      <p class="role-desc">${esc(p.desc)}</p>
      ${p.tasks && p.tasks.length ? `<ul>${p.tasks.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
    </div>`).join("");
}

/* ---------- 더보기 목록 ---------- */
const MORE_ITEMS = [
  ["roles", "역할 분담", '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 7h6"/><path d="M9 11h6"/><path d="M9 15h4"/>'],
  ["budget", "예산 · 지출 기록", '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 6v.01M18 6v.01M6 18v.01M18 18v.01"/>'],
  ["lodging", "숙소 안내 · 안전 체크", '<path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-6h6v6"/>'],
  ["health", "밤 건강 체크", '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>'],
  ["shots", "촬영 체크리스트", '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>'],
  ["faq", "자주 묻는 질문", '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>'],
  ["phrases", "서바이벌 제주어", '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>'],
  ["contacts", "비상 연락망", '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>']
];
$("moreList").innerHTML = MORE_ITEMS.map(([target, text, path]) => `
  <button class="more-item" type="button" data-target="${target}">
    <span class="more-icon"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg></span>
    <span class="more-text">${text}</span>
    ${ICON.chevronRight}
  </button>`).join("");
$("moreList").addEventListener("click", (e) => {
  const item = e.target.closest(".more-item");
  if(item) showPanel(item.dataset.target);
});
document.querySelectorAll("[data-reset]").forEach(btn => {
  btn.addEventListener("click", async () => {
    if(!confirm(btn.textContent + "? 되돌릴 수 없어요.")) return;
    try {
      await api("reset", { what: btn.dataset.reset });
      alert("지웠어요.");
      if(btn.dataset.reset === "state"){ STATE = {}; store.set("state", STATE); onStateChanged(); }
      refreshLive();
    } catch(err){ alert("지우지 못했어요. " + errText(err)); }
  });
});

/* ---------- 자주 묻는 질문 · 제주어 · 연락처 ---------- */
function renderFaqList(container, items){
  container.innerHTML = items.map(f => `
    <div class="faq-item">
      <div class="faq-q"><span>${f.q}</span><span class="plus">${ICON.plus}</span></div>
      <div class="faq-a">${f.a}</div>
    </div>`).join("");
  container.addEventListener("click", (e) => {
    const q = e.target.closest(".faq-q");
    if(q) q.closest(".faq-item").classList.toggle("open");
  });
}
renderFaqList($("faqList"), FAQS);
renderFaqList($("emergencyFaqList"), EMERGENCY_FAQS);
renderFaqList($("mannerFaqList"), MANNER_FAQS);
$("openEmergencyFaqBtn").addEventListener("click", () => showPanel("emergency-faq"));
$("openMannerFaqBtn").addEventListener("click", () => showPanel("etiquette-faq"));

let phraseChecked = store.get("phrase_checked", []);
$("phraseList").innerHTML = PHRASES.map(cat => `
  <div class="phrase-category">
    <div class="phrase-category-head">
      <p class="phrase-category-title">${esc(cat.category)}</p>
      ${ICON.chevronDown.replace("<svg ", '<svg class="phrase-category-chevron" ')}
    </div>
    <div class="phrase-category-body">
      ${cat.items.map(p => `
        <div class="phrase-card${phraseChecked.includes(p.jp) ? " checked" : ""}" data-jp="${esc(p.jp)}">
          <div class="phrase-head">
            <span class="phrase-checkbox">${ICON.check}</span>
            <p class="phrase-jp">${esc(p.jp)}</p>
            ${ICON.chevronDown.replace("<svg ", '<svg class="phrase-chevron" ')}
          </div>
          <div class="phrase-body">
            <p class="phrase-pronounce">${esc(p.pronounce)}</p>
            <p class="phrase-kr">${esc(p.kr)}</p>
          </div>
        </div>`).join("")}
    </div>
  </div>`).join("");
$("phraseList").addEventListener("click", (e) => {
  const head = e.target.closest(".phrase-category-head");
  if(head){ head.closest(".phrase-category").classList.toggle("open"); return; }
  const card = e.target.closest(".phrase-card");
  if(!card) return;
  if(e.target.closest(".phrase-checkbox")){
    card.classList.toggle("checked");
    const jp = card.dataset.jp;
    phraseChecked = card.classList.contains("checked") ? phraseChecked.concat(jp) : phraseChecked.filter(x => x !== jp);
    store.set("phrase_checked", phraseChecked);
    return;
  }
  card.classList.toggle("collapsed");
});

function contactCardHtml(role, name, tel){
  return `<li class="contact-card">
    <span class="contact-info"><p class="role">${esc(role)}</p><p class="name">${esc(name)}</p></span>
    <a class="call-btn" href="tel:${esc(tel)}">${ICON.phone}전화</a>
  </li>`;
}
$("contactList").innerHTML = CONTACTS.map(([r, n, t]) => contactCardHtml(r, n, t)).join("");
// SOS: 지도교사 + 제주분원 + 국내 긴급번호
$("sosContactList").innerHTML = [CONTACTS[0], CONTACTS[1], ...SOS_CONTACTS].filter(Boolean).map(([r, n, t]) => contactCardHtml(r, n, t)).join("");
const sosOverlay = $("sosOverlay");
$("openSosBtn").addEventListener("click", () => { sosOverlay.style.display = "flex"; });
$("closeSosBtn").addEventListener("click", () => { sosOverlay.style.display = "none"; });
sosOverlay.addEventListener("click", (e) => { if(e.target === sosOverlay) sosOverlay.style.display = "none"; });
$("sosAllContactsBtn").addEventListener("click", () => { sosOverlay.style.display = "none"; showPanel("contacts"); });

/* ---------- 카카오톡으로 내 위치 보내기 ---------- */
if(window.Kakao && !Kakao.isInitialized() && CONFIG.KAKAO_JS_KEY && CONFIG.KAKAO_JS_KEY.indexOf("여기에") !== 0){
  try { Kakao.init(CONFIG.KAKAO_JS_KEY); } catch(e){}
}
const kakaoSosBtn = $("kakaoSosBtn");
const KAKAO_SOS_HTML = kakaoSosBtn.innerHTML;
kakaoSosBtn.addEventListener("click", () => {
  if(!window.Kakao || !Kakao.isInitialized()){ alert("카카오톡 공유 기능이 아직 설정되지 않았어요. 선생님께 전화해주세요."); return; }
  if(!navigator.geolocation){ alert("이 브라우저는 위치 확인을 지원하지 않아요."); return; }
  attemptSendLocation();
});
function attemptSendLocation(){
  if(navigator.permissions && navigator.permissions.query){
    navigator.permissions.query({ name: "geolocation" }).then(st => {
      if(st.state === "denied") $("locationGuideOverlay").style.display = "flex";
      else requestLocationAndSend();
    }).catch(requestLocationAndSend);
  } else requestLocationAndSend();
}
function requestLocationAndSend(){
  kakaoSosBtn.textContent = "내 위치 확인 중...";
  navigator.geolocation.getCurrentPosition((pos) => {
    const lat = pos.coords.latitude.toFixed(6), lng = pos.coords.longitude.toFixed(6);
    const mapUrl = "https://map.kakao.com/link/map/" + encodeURIComponent((me ? me.name : "학생") + " 위치") + "," + lat + "," + lng;
    try {
      Kakao.Share.sendDefault({
        objectType: "text",
        text: `선생님, ${me ? me.name + "입니다." : ""} 일행과 떨어졌어요! 제 현재 위치예요.\n\n${mapUrl}`,
        link: { mobileWebUrl: mapUrl, webUrl: mapUrl },
        buttons: [{ title: "카카오맵으로 위치 보기", link: { mobileWebUrl: mapUrl, webUrl: mapUrl } }]
      });
    } catch(e){ alert("카카오톡을 열지 못했어요. 선생님께 바로 전화해주세요."); }
    kakaoSosBtn.innerHTML = KAKAO_SOS_HTML;
  }, () => {
    kakaoSosBtn.innerHTML = KAKAO_SOS_HTML;
    $("locationGuideOverlay").style.display = "flex";
  }, { enableHighAccuracy: false, timeout: 8000 });
}
$("closeLocationGuideBtn").addEventListener("click", () => { $("locationGuideOverlay").style.display = "none"; });
$("retryLocationBtn").addEventListener("click", () => { $("locationGuideOverlay").style.display = "none"; attemptSendLocation(); });

/* ---------- 탭 · 화면 전환 ---------- */
const SUB_OF = { "emergency-faq": "notice", "etiquette-faq": "notice" };
function setActiveTab(panel){
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.panel === panel));
}
function showPanel(id){
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  $("panel-" + id).classList.add("active");
  const tabIds = ["notice", "schedule", "record", "checklist", "more"];
  setActiveTab(tabIds.includes(id) ? id : (SUB_OF[id] || "more"));
  if(id === "record" && recordView === "notes") loadRecords();
  if(id === "budget"){ renderBudget(); loadExpenses(); }
  if(id === "lodging") renderLodging();
  if(id === "health"){ renderHealth(); if(isTeacher()) loadHealth(); }
  if(id === "shots") renderShots();
  if(id === "schedule"){
    updateTimelineProgress();
    if(leafletMap) setTimeout(() => leafletMap.invalidateSize(), 50);
  }
}
const goTab = id => showPanel(id);
const goSub = id => showPanel(id);
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => showPanel(tab.dataset.panel));
});
document.querySelectorAll("[data-back]").forEach(btn => {
  btn.addEventListener("click", () => showPanel(btn.dataset.back || "more"));
});

/* ---------- 시작 ---------- */
function applyRole(){
  $("opsFabs").hidden = !canOps();
  $("deleteAssemblyBtn").hidden = !canOps();
  $("teacherTools").hidden = !isTeacher();
  $("recCopyBtn").hidden = !isReporter();
  $("expenseForm").hidden = !canBudget();
  $("budgetCopyBtn").hidden = !canBudget();
}
function refreshLive(){
  loadNotices();
  loadAssembly();
  loadState();
  renderHeader();
  renderHome();
}
function renderAll(){
  applyRole();
  renderHeader();
  renderSchedule();
  renderChecklist();
  renderMissions();
  renderRecordForm();
  renderRoles();
  renderNotices();
  renderHome();
  refreshLive();
  if(me.tool === "budget") loadExpenses();
}

loadWeather();
setInterval(loadWeather, 30 * 60 * 1000);
setInterval(() => { if(me) refreshLive(); }, CONFIG.REFRESH_SECONDS * 1000);
document.addEventListener("visibilitychange", () => {
  if(document.visibilityState === "visible" && me) refreshLive();
});

const savedPerson = findPerson(store.get("me", ""));
if(savedPerson && (!savedPerson.teacher || store.get("pin", ""))){
  me = savedPerson;
  $("nameGate").style.display = "none";
  renderAll();
} else {
  $("nameGate").style.display = "flex";
}

// 홈 화면에서 앱처럼 열리고, 신호가 약해도 화면 골격은 뜨도록 등록
if("serviceWorker" in navigator){
  window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
}
