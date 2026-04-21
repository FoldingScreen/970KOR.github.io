const firebaseConfig = {
  apiKey: "AIzaSyBu2RrQn8cAwwWaLtw5O8Omwn4-NzHWuc0",
  authDomain: "kor-app-fa47e.firebaseapp.com",
  projectId: "kor-app-fa47e",
  storageBucket: "kor-app-fa47e.firebasestorage.app",
  messagingSenderId: "397749083935",
  appId: "1:397749083935:web:51c7c"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const HOLY_SWORD_AREAS = [
  "마구간",
  "시계탑",
  "수도원 1",
  "수도원 2",
  "수도원 3",
  "수도원 4",
  "성소 1",
  "성소 2"
];

const TEST_HIDDEN_PREFIXES = ["test", "tester", "테스트", "운영테스트"];

const state = {
  currentUser: "",
  currentEventId: "",
  isAdmin: false,

  unsubscribeParties: null,
  unsubscribeMeta: null,
  unsubscribeRanking: null,

  unsubscribeLabyrinths: null,
  unsubscribeLabyrinthStages: null,
  unsubscribeLabyrinthPlayer: null,
  unsubscribeLabyrinthPlayers: null,

  labyrinths: [],
  labyrinthPlayerSummaryMap: {},
  currentLabyrinthId: "",
  currentLabyrinthData: null,
  currentLabyrinthStages: [],
  currentLabyrinthPlayer: null,
  currentLabyrinthPlayers: [],
  editingLabyrinthId: "",
  editingStageId: "",

  parties: [],
  rearrangeProgressEntries: [],
  rearrangeRankingMap: {},
  rearrangeEntries: [],
  rearrangePublic: false,
  rearrangeInputEnabled: false,

  holySwordSelectedSide: localStorage.getItem("holySwordSelectedSide") || "KOR",
  tripleAllianceSelectedSide: localStorage.getItem("tripleAllianceSelectedSide") || "KOR",

  editingRuinsPartyId: "",
  editingRearrangeRankUser: "",
  editingHolySwordPartyId: "",

  events: [
    { id: "viking", name: "바이킹의 역습", desc: "'전하 퇴청하시옵소서'를 영어로? 바이킹~ 엌ㅋㅋ" },
    { id: "ruins", name: "유적 쟁탈", desc: "가장 강력한 유적은? 무적 엌ㅋㅋㅋ" },
    { id: "holy_sword", name: "성검 쟁탈", desc: "검이 정색하면? 검정색 엌ㅋㅋㅋ" },
    { id: "triple_alliance", name: "삼대 연맹전", desc: "아빠는 5대, 아들은 2대 맞는 이유는? 세대차이 엌ㅋㅋ" },
    { id: "rearrange", name: "자리 재배치", desc: "자동차에서 가장 시원한 자리는? 차가운데 엌ㅋㅋ" },
    { id: "escape_labyrinth", name: "사바나의 첨탑", desc: "바나나가 사악하면? 사바나. ㅇㅇ." }
  ]
};

const el = {
  loginScreen: document.getElementById("loginScreen"),
  homeScreen: document.getElementById("homeScreen"),
  eventScreen: document.getElementById("eventScreen"),
  nicknameInput: document.getElementById("nicknameInput"),
  myNameBtn: document.getElementById("myNameBtn"),
  adminMenuBtn: document.getElementById("adminMenuBtn"),
  adminMenu: document.getElementById("adminMenu"),
  homeSummary: document.getElementById("homeSummary"),
  homeEventCards: document.getElementById("homeEventCards"),
  partyList: document.getElementById("partyList"),
  eventTitle: document.getElementById("eventTitle"),
  eventDesc: document.getElementById("eventDesc"),
  createPartyBtn: document.getElementById("createPartyBtn"),
  rearrangeEditBtn: document.getElementById("rearrangeEditBtn"),
  rearrangeManageBtn: document.getElementById("rearrangeManageBtn"),
  rearrangePublicBtn: document.getElementById("rearrangePublicBtn"),
  createLabyrinthBtn: document.getElementById("createLabyrinthBtn"),
  backToLabyrinthListBtn: document.getElementById("backToLabyrinthListBtn"),

  escapeLabyrinthScreen: document.getElementById("escapeLabyrinthScreen"),
  labyrinthHomeView: document.getElementById("labyrinthHomeView"),
  labyrinthDetailView: document.getElementById("labyrinthDetailView"),
  publicLabyrinthList: document.getElementById("publicLabyrinthList"),
  myLabyrinthList: document.getElementById("myLabyrinthList"),
  labyrinthDetailTitle: document.getElementById("labyrinthDetailTitle"),
  labyrinthDetailMeta: document.getElementById("labyrinthDetailMeta"),
  labyrinthDetailDescription: document.getElementById("labyrinthDetailDescription"),
  labyrinthProgressSummary: document.getElementById("labyrinthProgressSummary"),
  labyrinthStageList: document.getElementById("labyrinthStageList"),

  createLabyrinthModal: document.getElementById("createLabyrinthModal"),
  labyrinthTitleInput: document.getElementById("labyrinthTitleInput"),
  labyrinthDescriptionInput: document.getElementById("labyrinthDescriptionInput"),
  labyrinthThumbnailTextInput: document.getElementById("labyrinthThumbnailTextInput"),
  labyrinthPublicCheckbox: document.getElementById("labyrinthPublicCheckbox"),
  labyrinthOpenCheckbox: document.getElementById("labyrinthOpenCheckbox"),

  editLabyrinthModal: document.getElementById("editLabyrinthModal"),
  editLabyrinthTitleInput: document.getElementById("editLabyrinthTitleInput"),
  editLabyrinthDescriptionInput: document.getElementById("editLabyrinthDescriptionInput"),
  editLabyrinthThumbnailTextInput: document.getElementById("editLabyrinthThumbnailTextInput"),
  editLabyrinthPublicCheckbox: document.getElementById("editLabyrinthPublicCheckbox"),
  editLabyrinthOpenCheckbox: document.getElementById("editLabyrinthOpenCheckbox"),

  editStageModal: document.getElementById("editStageModal"),
  editStageModalTitle: document.getElementById("editStageModalTitle"),
  stageOrderInput: document.getElementById("stageOrderInput"),
  stageTitleInput: document.getElementById("stageTitleInput"),
  stageTypeSelect: document.getElementById("stageTypeSelect"),
  stageStoryInput: document.getElementById("stageStoryInput"),
  stageQuestionInput: document.getElementById("stageQuestionInput"),
  stageAnswerInput: document.getElementById("stageAnswerInput"),
  stagePlaceholderInput: document.getElementById("stagePlaceholderInput"),
  stageSuccessMessageInput: document.getElementById("stageSuccessMessageInput"),
  stageActiveCheckbox: document.getElementById("stageActiveCheckbox"),
  deleteStageBtn: document.getElementById("deleteStageBtn"),

  modalOverlay: document.getElementById("modalOverlay"),
  userModal: document.getElementById("userModal"),
  joinedUsers: document.getElementById("joinedUsers"),
  notJoinedUsers: document.getElementById("notJoinedUsers"),
  logModal: document.getElementById("logModal"),
  logList: document.getElementById("logList"),
  ruinsCreateModal: document.getElementById("ruinsCreateModal"),
  ruinsModalTitle: document.getElementById("ruinsModalTitle"),
  ruinsSubmitBtn: document.getElementById("ruinsSubmitBtn"),
  ruinNameInput: document.getElementById("ruinNameInput"),
  utcMonth: document.getElementById("utcMonth"),
  utcDay: document.getElementById("utcDay"),
  utcHour: document.getElementById("utcHour"),
  rearrangeModal: document.getElementById("rearrangeModal"),
  rearrangeModalTitle: document.getElementById("rearrangeModalTitle"),
  rearrangeStageInput: document.getElementById("rearrangeStageInput"),
  rearrangeSubmitBtn: document.getElementById("rearrangeSubmitBtn"),
  exampleImageModal: document.getElementById("exampleImageModal"),
  exampleImageModalTitle: document.getElementById("exampleImageModalTitle"),
  exampleImageModalImg: document.getElementById("exampleImageModalImg"),
  rearrangeRankEditModal: document.getElementById("rearrangeRankEditModal"),
  rearrangeRankEditTitle: document.getElementById("rearrangeRankEditTitle"),
  rankEditNicknameInput: document.getElementById("rankEditNicknameInput"),
  rankEditStageInput: document.getElementById("rankEditStageInput"),
  rankEditPowerInput: document.getElementById("rankEditPowerInput"),
  rankEditNoteInput: document.getElementById("rankEditNoteInput"),
  rankEditDeleteBtn: document.getElementById("rankEditDeleteBtn"),
  rankEditSubmitBtn: document.getElementById("rankEditSubmitBtn"),
  holySwordAreaModal: document.getElementById("holySwordAreaModal"),
  holySwordAreaModalTitle: document.getElementById("holySwordAreaModalTitle"),
  holySwordAreaUserSelect: document.getElementById("holySwordAreaUserSelect"),
  holySwordAreaSelect: document.getElementById("holySwordAreaSelect"),
  holySwordAreaAssignmentList: document.getElementById("holySwordAreaAssignmentList"),
  firstGroupCheckbox: document.getElementById("firstGroupCheckbox")
};

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeJs(s) {
  return String(s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}

function normalizeMembers(m) {
  return Array.isArray(m)
    ? m.filter(v => typeof v === "string" && v.trim() !== "")
    : [];
}

function normalizeAssignments(v) {
  return Array.isArray(v)
    ? v.filter(x => x && typeof x.user === "string" && typeof x.area === "string")
    : [];
}

function isHiddenTestNickname(name) {
  const lowered = String(name || "").trim().toLowerCase();
  return TEST_HIDDEN_PREFIXES.some(prefix =>
    lowered.startsWith(String(prefix).toLowerCase())
  );
}

function normalizeLabyrinthText(s) {
  return String(s || "").replace(/\r\n/g, "\n").trim();
}

function normalizeAnswerValue(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isLabyrinthOwner(labyrinth) {
  return !!labyrinth && labyrinth.creator === state.currentUser;
}

function showOnly(name) {
  if (el.loginScreen) el.loginScreen.classList.add("hidden");
  if (el.homeScreen) el.homeScreen.classList.add("hidden");
  if (el.eventScreen) el.eventScreen.classList.add("hidden");

  if (name === "login" && el.loginScreen) el.loginScreen.classList.remove("hidden");
  if (name === "home" && el.homeScreen) el.homeScreen.classList.remove("hidden");
  if (name === "event" && el.eventScreen) el.eventScreen.classList.remove("hidden");
}

function eventRef(id) {
  return db.collection("events").doc(id);
}

function partiesRef(id) {
  return eventRef(id).collection("parties");
}

function rearrangeProgressRef() {
  return eventRef("rearrange").collection("progress");
}

function rearrangeRankingRef() {
  return eventRef("rearrange").collection("ranking");
}

function labyrinthsRef() {
  return eventRef("escape_labyrinth").collection("labyrinths");
}

function labyrinthRef(id) {
  return labyrinthsRef().doc(id);
}

function labyrinthStagesRef(id) {
  return labyrinthRef(id).collection("stages");
}

function labyrinthPlayersRef(id) {
  return labyrinthRef(id).collection("players");
}

function labyrinthPlayerRef(id, name) {
  return labyrinthPlayersRef(id).doc(name);
}

function setTopTabs(active) {
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));

  if (active === "home") document.querySelectorAll(".tab-btn")[0]?.classList.add("active");
  if (active === "viking") document.querySelectorAll(".tab-btn")[1]?.classList.add("active");
  if (active === "ruins") document.querySelectorAll(".tab-btn")[2]?.classList.add("active");
  if (active === "holy_sword") document.querySelectorAll(".tab-btn")[3]?.classList.add("active");
  if (active === "triple_alliance") document.querySelectorAll(".tab-btn")[4]?.classList.add("active");
  if (active === "rearrange") document.querySelectorAll(".tab-btn")[5]?.classList.add("active");
  if (active === "escape_labyrinth") document.querySelectorAll(".tab-btn")[6]?.classList.add("active");
}

function updateUserBadge() {
  if (!el.myNameBtn) return;

  el.myNameBtn.textContent = state.currentUser
    ? `${state.currentUser}${state.isAdmin ? " (운영진)" : ""}`
    : "로그인 안 됨";

  if (state.isAdmin) {
    el.adminMenuBtn?.classList.remove("hidden");
  } else {
    el.adminMenuBtn?.classList.add("hidden");
    closeAdminMenu();
  }
}

function toggleAdminMenu() {
  el.adminMenu?.classList.toggle("hidden");
}

function closeAdminMenu() {
  el.adminMenu?.classList.add("hidden");
}

window.toggleAdminMenu = toggleAdminMenu;
window.closeAdminMenu = closeAdminMenu;

function syncOverlay() {
  const hasOpenModal =
    (el.userModal && !el.userModal.classList.contains("hidden")) ||
    (el.logModal && !el.logModal.classList.contains("hidden")) ||
    (el.ruinsCreateModal && !el.ruinsCreateModal.classList.contains("hidden")) ||
    (el.rearrangeModal && !el.rearrangeModal.classList.contains("hidden")) ||
    (el.exampleImageModal && !el.exampleImageModal.classList.contains("hidden")) ||
    (el.rearrangeRankEditModal && !el.rearrangeRankEditModal.classList.contains("hidden")) ||
    (el.holySwordAreaModal && !el.holySwordAreaModal.classList.contains("hidden")) ||
    (el.createLabyrinthModal && !el.createLabyrinthModal.classList.contains("hidden")) ||
    (el.editLabyrinthModal && !el.editLabyrinthModal.classList.contains("hidden")) ||
    (el.editStageModal && !el.editStageModal.classList.contains("hidden"));

  if (!el.modalOverlay) return;

  if (hasOpenModal) {
    el.modalOverlay.classList.remove("hidden");
  } else {
    el.modalOverlay.classList.add("hidden");
  }
}

if (el.modalOverlay) {
  el.modalOverlay.addEventListener("click", () => {
    closeExampleImageModal();
    closeUserModal();
    closeLogModal();
    closeRuinsCreateModal();
    closeRearrangeModal();
    closeRearrangeRankEditModal();
    closeHolySwordAreaModal();
    closeCreateLabyrinthModal();
    closeEditLabyrinthModal();
    closeEditStageModal();
    syncOverlay();
  });
}

function clearSubscriptions() {
  if (state.unsubscribeParties) {
    state.unsubscribeParties();
    state.unsubscribeParties = null;
  }
  if (state.unsubscribeMeta) {
    state.unsubscribeMeta();
    state.unsubscribeMeta = null;
  }
  if (state.unsubscribeRanking) {
    state.unsubscribeRanking();
    state.unsubscribeRanking = null;
  }
  if (state.unsubscribeLabyrinths) {
    state.unsubscribeLabyrinths();
    state.unsubscribeLabyrinths = null;
  }
  if (state.unsubscribeLabyrinthStages) {
    state.unsubscribeLabyrinthStages();
    state.unsubscribeLabyrinthStages = null;
  }
  if (state.unsubscribeLabyrinthPlayer) {
    state.unsubscribeLabyrinthPlayer();
    state.unsubscribeLabyrinthPlayer = null;
  }
  if (state.unsubscribeLabyrinthPlayers) {
    state.unsubscribeLabyrinthPlayers();
    state.unsubscribeLabyrinthPlayers = null;
  }
}

function getTimeValue(t) {
  if (!t) return 0;
  if (typeof t.toDate === "function") return t.toDate().getTime();
  if (t.seconds) return t.seconds * 1000;

  const n = new Date(t).getTime();
  return Number.isFinite(n) ? n : 0;
}

function toDate(t) {
  if (!t) return null;
  if (typeof t.toDate === "function") return t.toDate();
  if (t.seconds) return new Date(t.seconds * 1000);

  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatKST(t) {
  const d = toDate(t);
  if (!d) return "-";

  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:00`;
}

function formatUTC(t) {
  const d = toDate(t);
  if (!d) return "-";

  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, "0")}:00`;
}

function formatDateTime(t) {
  const d = toDate(t);
  if (!d) return "-";

  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function calcPower(memberCount) {
  const base = Math.max(memberCount - 1, 1);
  return Math.floor((920000 / base) / 1000) * 1000;
}

function myParty() {
  if (state.currentEventId !== "viking") return null;
  return state.parties.find(p => p.members.includes(state.currentUser)) || null;
}

function myRearrangeEntry() {
  return state.rearrangeEntries.find(v => v.user === state.currentUser) || null;
}

function getRearrangeColumn(rank) {
  if (rank <= 18) return 3;
  if (rank <= 28) return 1;
  if (rank <= 42) return 2;
  if (rank <= 60) return 4;
  return 5;
}

function getLayoutLabel(rank) {
  return `${getRearrangeColumn(rank)}열`;
}

function getRearrangeRankMap() {
  const activeEntries = state.rearrangeEntries.filter(
    v => !isHiddenTestNickname(v.user) && !v.excluded
  );
  const displayedEntries = getDisplayedRearrangeEntries(activeEntries);

  const map = {};
  let n = 1;

  displayedEntries.forEach(entry => {
    if (!entry) return;
    map[entry.user] = n;
    n++;
  });

  return map;
}

function getHolySwordSortedMembers(members) {
  const rankMap = getRearrangeRankMap();

  return [...members].sort((a, b) => {
    const ra = rankMap[a] || 999999;
    const rb = rankMap[b] || 999999;

    if (ra !== rb) return ra - rb;
    return String(a).localeCompare(String(b), "ko");
  });
}

function getHolySwordDisplayIndex(idx) {
  if (idx < 30) return `${idx + 1}.`;
  return `예비${idx - 29}.`;
}

function getHolySwordSideLabel(side) {
  if (side === "KOR") return "본연맹(KOR)";
  if (side === "KR1") return "아카데미(KR1)";
  return side || "-";
}

function getTripleAllianceSideLabel(side) {
  if (side === "KOR") return "본연맹(KOR)";
  if (side === "KR1") return "아카데미(KR1)";
  return side || "-";
}

function parseNoteRule(note) {
  const text = String(note || "").trim();
  const explicitMatch = text.match(/([1-5])\s*열/);
  const explicitColumn = explicitMatch ? Number(explicitMatch[1]) : 0;
  const hasR45 = /R4|R5/i.test(text);

  return { explicitColumn, hasR45 };
}

function getDisplayedRearrangeEntries(entries) {
  const capacities = { 1: 10, 2: 14, 3: 18, 4: 18, 5: Number.MAX_SAFE_INTEGER };
  const primaryColumnOrder = [3, 1, 2, 4];

  const sorted = [...entries];
  const explicitByColumn = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  const reservedTo2 = [];
  const normal = [];

  sorted.forEach((entry, idx) => {
    const rule = parseNoteRule(entry.note);
    const baseColumn = getRearrangeColumn(idx + 1);
    const enriched = { ...entry, __baseColumn: baseColumn };

    if (rule.explicitColumn >= 1 && rule.explicitColumn <= 5) {
      explicitByColumn[rule.explicitColumn].push(enriched);
      return;
    }

    if (rule.hasR45 && baseColumn >= 4) {
      reservedTo2.push(enriched);
      return;
    }

    normal.push(enriched);
  });

  const usedUsers = new Set();

  function takeFrom(list) {
    while (list.length) {
      const entry = list.shift();
      if (entry && !usedUsers.has(entry.user)) {
        usedUsers.add(entry.user);
        return entry;
      }
    }
    return null;
  }

  const columnPools = {
    1: [...explicitByColumn[1]],
    2: [...explicitByColumn[2], ...reservedTo2],
    3: [...explicitByColumn[3]],
    4: [...explicitByColumn[4]]
  };

  const slots = [];

  for (const col of primaryColumnOrder) {
    const limit = capacities[col];
    for (let i = 0; i < limit; i++) {
      const forced = takeFrom(columnPools[col]);
      if (forced) slots.push(forced);
      else slots.push("__EMPTY__");
    }
  }

  for (const entry of normal) {
    let placed = false;

    for (let i = 0; i < slots.length; i++) {
      if (slots[i] !== "__EMPTY__") continue;

      const targetColumn = getRearrangeColumn(i + 1);
      const rule = parseNoteRule(entry.note);

      if (rule.explicitColumn && rule.explicitColumn !== targetColumn) continue;
      if (rule.hasR45 && entry.__baseColumn >= 4 && targetColumn < 2) continue;

      slots[i] = entry;
      usedUsers.add(entry.user);
      placed = true;
      break;
    }

    if (!placed) {
      slots.push(entry);
      usedUsers.add(entry.user);
    }
  }

  const remain5 = [];
  while (explicitByColumn[5].length) {
    const e = takeFrom(explicitByColumn[5]);
    if (e) remain5.push(e);
  }
  slots.push(...remain5);

  return slots.map(v => {
    if (v === "__EMPTY__") return null;
    if (v && typeof v === "object" && "__baseColumn" in v) {
      const { __baseColumn, ...rest } = v;
      return rest;
    }
    return v;
  });
}

function getMoveDisplay(existingColumn, currentColumn) {
  if (!existingColumn || !currentColumn) {
    return { text: "-", className: "move-neutral" };
  }
  if (existingColumn === currentColumn) {
    return { text: "완료", className: "move-done" };
  }
  if (existingColumn < currentColumn) {
    return { text: `${existingColumn}→${currentColumn}`, className: "move-up" };
  }
  return { text: `${existingColumn}→${currentColumn}`, className: "move-down" };
}

function getHolySwordBadgeSrc(area) {
  if (area === "마구간") return "../말.png";
  if (area === "시계탑") return "../모래시계.png";
  if (area === "수도원 1") return "../마름모 1.png";
  if (area === "수도원 2") return "../마름모 2.png";
  if (area === "수도원 3") return "../마름모 3.png";
  if (area === "수도원 4") return "../마름모 4.png";
  if (area === "성소 1") return "../원 1.png";
  if (area === "성소 2") return "../원 2.png";
  return "";
}

function renderHolySwordBadge(area, size = "small") {
  const src = getHolySwordBadgeSrc(area);
  if (!src) return "";

  const cls = size === "large"
    ? "holy-area-badge-img large"
    : "holy-area-badge-img";

  return `<img src="${src}" alt="${escapeHtml(area)}" class="${cls}">`;
}

function renderHolySwordBadges(areas) {
  if (!areas || !areas.length) return "";
  return `<span class="area-badges">${areas.map(area => renderHolySwordBadge(area, "small")).join("")}</span>`;
}

function getHolySwordAreaAssignmentsByUser(assignments) {
  const map = {};
  normalizeAssignments(assignments).forEach(item => {
    if (!map[item.user]) map[item.user] = [];
    map[item.user].push(item.area);
  });
  return map;
}

function renderHolySwordAreaBoard(assignments) {
  const byArea = {};
  HOLY_SWORD_AREAS.forEach(area => { byArea[area] = []; });

  normalizeAssignments(assignments).forEach(item => {
    if (!byArea[item.area]) byArea[item.area] = [];
    byArea[item.area].push(item.user);
  });

  const slotMap = {
    "1-2": "시계탑",
    "1-3": "수도원 1",
    "2-1": "성소 2",
    "2-4": "수도원 2",
    "3-1": "수도원 4",
    "3-4": "성소 1",
    "4-2": "수도원 3",
    "4-3": "마구간"
  };

  let html = `<div class="holy-area-board">`;

  for (let row = 1; row <= 4; row++) {
    for (let col = 1; col <= 4; col++) {
      const key = `${row}-${col}`;
      const area = slotMap[key];

      if (!area) {
        html += `<div class="holy-area-empty"></div>`;
        continue;
      }

      const users = byArea[area] || [];
      html += `
        <div class="holy-area-slot">
          <div class="holy-area-slot-badge">${renderHolySwordBadge(area, "large")}</div>
          <div class="holy-area-slot-users">${users.length ? users.map(escapeHtml).join("<br>") : "-"}</div>
        </div>
      `;
    }
  }

  html += `</div>`;
  return html;
}
