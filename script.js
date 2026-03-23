// ==============================
// Firebase 설정
// ==============================
const firebaseConfig = {
  apiKey: "AIzaSyBu2RrQn8cAwwWaLtw5O8Omwn4-NzHWuc0",
  authDomain: "kor-app-fa47e.firebaseapp.com",
  projectId: "kor-app-fa47e",
  storageBucket: "kor-app-fa47e.firebasestorage.app",
  messagingSenderId: "397749083935",
  appId: "1:397749083935:web:51c7c"
};

if (!window.firebase) {
  alert("Firebase가 먼저 로드되지 않았습니다. index.html의 script 순서를 확인하세요.");
  throw new Error("Firebase not loaded");
}

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();

// ==============================
// 전역 상태
// ==============================
let currentUser = "";
let currentEvent = "";
let isAdmin = false;
let unsubscribeParties = null;

// 테스트 계정 숨김용
const HIDDEN_TEST_USERS = [
  "test",
  "tester",
  "테스트",
  "운영테스트"
];

// ==============================
// DOM
// ==============================
const loginScreen = document.getElementById("login-screen");
const eventScreen = document.getElementById("event-screen");
const mainScreen = document.getElementById("main-screen");
const partyListEl = document.getElementById("partyList");
const myNameEl = document.getElementById("myName");
const nicknameInput = document.getElementById("nickname");

// ==============================
// 공통 유틸
// ==============================
function showScreen(screenName) {
  if (loginScreen) loginScreen.classList.add("hidden");
  if (eventScreen) eventScreen.classList.add("hidden");
  if (mainScreen) mainScreen.classList.add("hidden");

  if (screenName === "login" && loginScreen) loginScreen.classList.remove("hidden");
  if (screenName === "event" && eventScreen) eventScreen.classList.remove("hidden");
  if (screenName === "main" && mainScreen) mainScreen.classList.remove("hidden");
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeMembers(members) {
  if (!Array.isArray(members)) return [];
  return members.filter(v => typeof v === "string" && v.trim() !== "");
}

function getEventPartiesRef(eventId) {
  return db.collection("events").doc(eventId).collection("parties");
}

function isHiddenTestUser(name) {
  return HIDDEN_TEST_USERS.includes(String(name || "").trim());
}

function formatNumberKR(num) {
  return Number(num || 0).toLocaleString("ko-KR");
}

function floorToThousand(num) {
  if (!Number.isFinite(num)) return 0;
  return Math.floor(num / 1000) * 1000;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function getCurrentEventLabel() {
  if (currentEvent === "viking") return "바이킹의 역습";
  if (currentEvent === "ruins") return "유적 쟁탈";
  return "";
}

function getSafePartyData(doc) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    name: data.name || "",
    event: data.event || currentEvent || "",
    createdBy: data.createdBy || "",
    createdAt: data.createdAt || null,
    members: normalizeMembers(data.members),
    rallyLeader: data.rallyLeader || "",
    ruinName: data.ruinName || "",
    timeUTC: data.timeUTC || null,
    timeUTCString: data.timeUTCString || "",
    maxMembers: Number(data.maxMembers || 0),
    type: data.type || ""
  };
}

function logout() {
  if (unsubscribeParties) {
    unsubscribeParties();
    unsubscribeParties = null;
  }

  currentUser = "";
  currentEvent = "";
  isAdmin = false;

  localStorage.removeItem("partyAppUser");
  localStorage.removeItem("partyAppEvent");

  if (myNameEl) myNameEl.textContent = "";
  if (partyListEl) partyListEl.innerHTML = "";

  showScreen("login");
}

window.logout = logout;

// ==============================
// 사용자 / 운영진
// ==============================
async function ensureUserDocument(nickname) {
  const userRef = db.collection("users").doc(nickname);
  const snap = await userRef.get();

  if (!snap.exists) {
    await userRef.set({
      nickname,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }
}

async function checkAdmin(nickname) {
  const adminSnap = await db.collection("admins").doc(nickname).get();
  return adminSnap.exists;
}

async function writeAdminLog(action, payload = {}) {
  if (!isAdmin || !currentUser) return;

  await db.collection("adminLogs").add({
    action,
    payload,
    event: currentEvent,
    admin: currentUser,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

// ==============================
// 로그인
// ==============================
async function login() {
  try {
    const nickname = (nicknameInput?.value || "").trim();

    if (!nickname) {
      alert("닉네임을 입력하세요.");
      return;
    }

    currentUser = nickname;
    await ensureUserDocument(currentUser);
    isAdmin = await checkAdmin(currentUser);

    localStorage.setItem("partyAppUser", currentUser);

    if (myNameEl) {
      myNameEl.textContent = `${currentUser}${isAdmin ? " (운영진)" : ""}`;
    }

    showScreen("event");
  } catch (error) {
    console.error("login error:", error);
    alert("로그인 중 오류가 발생했습니다.");
  }
}

window.login = login;

// ==============================
// 자동 로그인
// ==============================
async function tryAutoLogin() {
  try {
    const savedUser = localStorage.getItem("partyAppUser");
    const savedEvent = localStorage.getItem("partyAppEvent");

    if (!savedUser) {
      showScreen("login");
      return;
    }

    currentUser = savedUser;
    await ensureUserDocument(currentUser);
    isAdmin = await checkAdmin(currentUser);

    if (myNameEl) {
      myNameEl.textContent = `${currentUser}${isAdmin ? " (운영진)" : ""}`;
    }

    if (savedEvent) {
      currentEvent = savedEvent;
      showScreen("main");
      subscribeCurrentEvent();
    } else {
      showScreen("event");
    }
  } catch (error) {
    console.error("auto login error:", error);
    showScreen("login");
  }
}

// ==============================
// 이벤트 진입
// ==============================
function enterEvent(eventId) {
  currentEvent = eventId;
  localStorage.setItem("partyAppEvent", currentEvent);
  showScreen("main");
  subscribeCurrentEvent();
}

window.enterEvent = enterEvent;

// ==============================
// 구독 / 렌더
// ==============================
function subscribeCurrentEvent() {
  try {
    if (!currentEvent) return;

    if (unsubscribeParties) {
      unsubscribeParties();
      unsubscribeParties = null;
    }

    const ref = getEventPartiesRef(currentEvent);

    unsubscribeParties = ref.onSnapshot(
      (snapshot) => {
        const parties = [];

        snapshot.forEach((doc) => {
          parties.push(getSafePartyData(doc));
        });

        parties.sort(sortPartiesForCurrentEvent);
        renderParties(parties);
      },
      (error) => {
        console.error("party subscription error:", error);
        alert("파티 데이터를 불러오는 중 오류가 발생했습니다.");
      }
    );
  } catch (error) {
    console.error("subscribeCurrentEvent error:", error);
    alert("이벤트 데이터를 불러오는 중 오류가 발생했습니다.");
  }
}

function sortPartiesForCurrentEvent(a, b) {
  if (currentEvent === "ruins") {
    const aTime = getTimeValue(a.timeUTC);
    const bTime = getTimeValue(b.timeUTC);

    if (aTime !== bTime) return aTime - bTime;
    return String(a.ruinName || a.name).localeCompare(String(b.ruinName || b.name), "ko");
  }

  return String(a.name || "").localeCompare(String(b.name || ""), "ko");
}

function getTimeValue(timeUTC) {
  if (!timeUTC) return Number.MAX_SAFE_INTEGER;

  if (typeof timeUTC.toDate === "function") {
    return timeUTC.toDate().getTime();
  }

  if (timeUTC.seconds) {
    return timeUTC.seconds * 1000;
  }

  const parsed = new Date(timeUTC).getTime();
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function renderParties(parties) {
  if (!partyListEl) return;

  const headerHtml = `
    <div class="event-header-card">
      <h2>${escapeHtml(getCurrentEventLabel())}</h2>
      <div class="event-header-actions">
        <button onclick="createParty()">파티 생성</button>
        <button onclick="showAllUsers()">전체 사용자</button>
        <button onclick="goEventSelect()">이벤트 선택</button>
      </div>
    </div>
  `;

  if (!Array.isArray(parties) || parties.length === 0) {
    partyListEl.innerHTML = `
      ${headerHtml}
      <div class="empty-card">
        아직 생성된 파티가 없습니다.
      </div>
    `;
    return;
  }

  const cardsHtml = parties.map((party) => {
    if (currentEvent === "ruins") {
      return renderRuinsPartyCard(party);
    }
    return renderVikingPartyCard(party);
  }).join("");

  partyListEl.innerHTML = headerHtml + cardsHtml;
}

function renderVikingPartyCard(party) {
  const members = normalizeMembers(party.members);
  const isJoined = members.includes(currentUser);
  const isLeader = party.createdBy === currentUser;
  const canDelete = isLeader || isAdmin;

  const membersHtml = members.map((name) => {
    const isMe = name === currentUser;
    const isCrown = name === party.createdBy;
    return `
      <div class="member-line">
        <span class="${isMe ? "my-name" : ""}">
          ${isCrown ? "👑 " : ""}${escapeHtml(name)}
        </span>
        ${
          (isLeader || isAdmin) && name !== party.createdBy
            ? `<button class="inline-btn" onclick="kickMember('${escapeJs(party.id)}','${escapeJs(name)}')">✖</button>`
            : ""
        }
      </div>
    `;
  }).join("");

  return `
    <div class="party-card">
      <div class="party-title">${escapeHtml(party.name)}</div>
      <div class="party-sub">파티장: ${escapeHtml(party.createdBy || "-")}</div>
      <div class="party-sub">인원: ${members.length}명</div>

      <div class="member-list">
        ${membersHtml || `<div class="member-line empty-text">참가자가 없습니다.</div>`}
      </div>

      <div class="card-actions">
        ${!isJoined ? `<button onclick="joinParty('${escapeJs(party.id)}')">참가</button>` : ""}
        ${isJoined ? `<button onclick="leaveParty('${escapeJs(party.id)}')">취소</button>` : ""}
        ${canDelete ? `<button onclick="deleteParty('${escapeJs(party.id)}')">삭제</button>` : ""}
      </div>
    </div>
  `;
}

function renderRuinsPartyCard(party) {
  const members = normalizeMembers(party.members);
  const sortedMembers = sortRuinsMembers(members, party.rallyLeader);
  const isJoined = members.includes(currentUser);
  const canDelete = isAdmin;
  const maxMembers = 15;
  const memberCount = members.length;

  const kstText = formatKSTFromUTC(party.timeUTC);
  const utcText = formatUTCFromUTC(party.timeUTC);
  const powerText = formatNumberKR(calculateRuinsPower(memberCount));

  const membersHtml = sortedMembers.map((name) => {
    const isMe = name === currentUser;
    const isRallyLeader = name === party.rallyLeader;

    return `
      <div class="member-line">
        <span class="${isMe ? "my-name" : ""}">
          ${isRallyLeader ? "👑 " : ""}${escapeHtml(name)}
        </span>
        ${
          isAdmin && name !== party.rallyLeader
            ? `<button class="inline-btn" onclick="setRallyLeader('${escapeJs(party.id)}','${escapeJs(name)}')">👍</button>`
            : ""
        }
        ${
          isAdmin
            ? `<button class="inline-btn" onclick="kickMember('${escapeJs(party.id)}','${escapeJs(name)}')">✖</button>`
            : ""
        }
      </div>
    `;
  }).join("");

  return `
    <div class="party-card">
      <div class="party-title">유적명: ${escapeHtml(party.ruinName || party.name)}</div>
      <div class="party-sub">시간: ${escapeHtml(kstText)}</div>
      <div class="party-sub">UTC ${escapeHtml(utcText)}</div>
      <div class="party-sub">병력수: ${powerText}명</div>
      <div class="party-sub">인원: ${memberCount}/${maxMembers}</div>

      <div class="member-list compact">
        ${membersHtml || `<div class="member-line empty-text">참가자가 없습니다.</div>`}
      </div>

      <div class="card-actions">
        ${!isJoined && memberCount < maxMembers ? `<button onclick="joinParty('${escapeJs(party.id)}')">참가</button>` : ""}
        ${isJoined ? `<button onclick="leaveParty('${escapeJs(party.id)}')">취소</button>` : ""}
        ${canDelete ? `<button onclick="deleteParty('${escapeJs(party.id)}')">삭제</button>` : ""}
      </div>
    </div>
  `;
}

function sortRuinsMembers(members, rallyLeader) {
  const copied = [...members];
  copied.sort((a, b) => {
    if (a === rallyLeader) return -1;
    if (b === rallyLeader) return 1;
    return a.localeCompare(b, "ko");
  });
  return copied;
}

function calculateRuinsPower(memberCount) {
  const generalMembers = Math.max(memberCount - 1, 1);
  return floorToThousand(920000 / generalMembers);
}

function formatKSTFromUTC(timeUTC) {
  const d = convertFirestoreTimeToDate(timeUTC);
  if (!d) return "-";
  return `${d.getMonth() + 1}/${d.getDate()} ${pad2(d.getHours())}:00`;
}

function formatUTCFromUTC(timeUTC) {
  const d = convertFirestoreTimeToDate(timeUTC);
  if (!d) return "-";
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${pad2(d.getUTCHours())}:00`;
}

function convertFirestoreTimeToDate(timeUTC) {
  if (!timeUTC) return null;
  if (typeof timeUTC.toDate === "function") return timeUTC.toDate();
  if (timeUTC.seconds) return new Date(timeUTC.seconds * 1000);
  const d = new Date(timeUTC);
  return Number.isNaN(d.getTime()) ? null : d;
}

function escapeJs(str) {
  return String(str ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

// ==============================
// 파티 생성
// ==============================
async function createParty() {
  try {
    if (!currentEvent) {
      alert("이벤트를 먼저 선택하세요.");
      return;
    }

    if (currentEvent === "viking") {
      await createVikingParty();
      return;
    }

    if (currentEvent === "ruins") {
      await createRuinsParty();
      return;
    }
  } catch (error) {
    console.error("createParty error:", error);
    alert("파티 생성 중 오류가 발생했습니다.");
  }
}

window.createParty = createParty;

async function createVikingParty() {
  const partyName = (prompt("파티 이름을 입력하세요.") || "").trim();

  if (!partyName) return;

  const ref = getEventPartiesRef("viking");
  const snap = await ref.where("name", "==", partyName).get();

  if (!snap.empty) {
    alert("같은 이름의 파티가 이미 있습니다.");
    return;
  }

  const alreadyJoined = await findMyPartyInCurrentEvent();
  if (alreadyJoined) {
    alert("이미 다른 파티에 참여 중입니다.");
    return;
  }

  await ref.add({
    type: "viking",
    event: "viking",
    name: partyName,
    createdBy: currentUser,
    members: [currentUser],
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function createRuinsParty() {
  if (!isAdmin) {
    alert("유적 파티는 운영진만 생성할 수 있습니다.");
    return;
  }

  const ruinName = (prompt("유적명을 입력하세요. 예: 4번 성채") || "").trim();
  if (!ruinName) return;

  const month = Number(prompt("UTC 월을 입력하세요. 예: 3") || "");
  const day = Number(prompt("UTC 일을 입력하세요. 예: 31") || "");
  const hour = Number(prompt("UTC 시간을 입력하세요. 예: 0, 1, 2 ... 23") || "");

  if (
    !Number.isInteger(month) || month < 1 || month > 12 ||
    !Number.isInteger(day) || day < 1 || day > 31 ||
    !Number.isInteger(hour) || hour < 0 || hour > 23
  ) {
    alert("UTC 월/일/시간 입력값이 올바르지 않습니다.");
    return;
  }

  const year = new Date().getUTCFullYear();
  const utcDate = new Date(Date.UTC(year, month - 1, day, hour, 0, 0, 0));

  await getEventPartiesRef("ruins").add({
    type: "ruins",
    event: "ruins",
    name: ruinName,
    ruinName: ruinName,
    createdBy: currentUser,
    members: [],
    rallyLeader: "",
    maxMembers: 15,
    timeUTC: utcDate,
    timeUTCString: utcDate.toISOString(),
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  await writeAdminLog("create_ruins_party", {
    ruinName,
    month,
    day,
    hour
  });
}

// ==============================
// 참가 / 취소 / 삭제 / 추방 / 집결장
// ==============================
async function findMyPartyInCurrentEvent() {
  const snap = await getEventPartiesRef(currentEvent).get();

  for (const doc of snap.docs) {
    const data = getSafePartyData(doc);
    if (data.members.includes(currentUser)) {
      return data;
    }
  }
  return null;
}

async function joinParty(partyId) {
  try {
    if (!currentUser || !currentEvent) return;

    const alreadyJoined = await findMyPartyInCurrentEvent();
    if (alreadyJoined) {
      alert("이미 다른 파티에 참여 중입니다.");
      return;
    }

    const ref = getEventPartiesRef(currentEvent).doc(partyId);
    const snap = await ref.get();

    if (!snap.exists) {
      alert("파티를 찾을 수 없습니다.");
      return;
    }

    const party = getSafePartyData(snap);
    const members = normalizeMembers(party.members);

    if (currentEvent === "ruins" && members.length >= 15) {
      alert("유적 파티는 최대 15명입니다.");
      return;
    }

    if (members.includes(currentUser)) {
      alert("이미 참가 중입니다.");
      return;
    }

    members.push(currentUser);

    await ref.update({ members });
  } catch (error) {
    console.error("joinParty error:", error);
    alert("파티 참가 중 오류가 발생했습니다.");
  }
}

window.joinParty = joinParty;

async function leaveParty(partyId) {
  try {
    if (!currentUser || !currentEvent) return;

    const ref = getEventPartiesRef(currentEvent).doc(partyId);
    const snap = await ref.get();

    if (!snap.exists) {
      alert("파티를 찾을 수 없습니다.");
      return;
    }

    const party = getSafePartyData(snap);
    let members = normalizeMembers(party.members);

    if (!members.includes(currentUser)) {
      alert("현재 이 파티에 참여 중이 아닙니다.");
      return;
    }

    members = members.filter(name => name !== currentUser);

    const updates = { members };

    if (currentEvent === "ruins" && party.rallyLeader === currentUser) {
      updates.rallyLeader = members[0] || "";
    }

    await ref.update(updates);
  } catch (error) {
    console.error("leaveParty error:", error);
    alert("파티 취소 중 오류가 발생했습니다.");
  }
}

window.leaveParty = leaveParty;

async function deleteParty(partyId) {
  try {
    if (!currentUser || !currentEvent) return;

    const ref = getEventPartiesRef(currentEvent).doc(partyId);
    const snap = await ref.get();

    if (!snap.exists) {
      alert("파티를 찾을 수 없습니다.");
      return;
    }

    const party = getSafePartyData(snap);
    const canDelete = party.createdBy === currentUser || isAdmin;

    if (!canDelete) {
      alert("삭제 권한이 없습니다.");
      return;
    }

    const message = currentEvent === "ruins"
      ? "정말 이 유적 파티를 삭제하시겠습니까?"
      : "정말 이 파티를 삭제하시겠습니까?";

    if (!confirm(message)) return;

    await ref.delete();

    if (isAdmin) {
      await writeAdminLog("delete_party", {
        partyId,
        name: party.name,
        ruinName: party.ruinName
      });
    }
  } catch (error) {
    console.error("deleteParty error:", error);
    alert("파티 삭제 중 오류가 발생했습니다.");
  }
}

window.deleteParty = deleteParty;

async function kickMember(partyId, memberName) {
  try {
    if (!currentUser || !currentEvent) return;

    const ref = getEventPartiesRef(currentEvent).doc(partyId);
    const snap = await ref.get();

    if (!snap.exists) {
      alert("파티를 찾을 수 없습니다.");
      return;
    }

    const party = getSafePartyData(snap);
    const canKick = isAdmin || party.createdBy === currentUser;

    if (!canKick) {
      alert("추방 권한이 없습니다.");
      return;
    }

    if (!confirm(`${memberName} 님을 추방하시겠습니까?`)) return;

    let members = normalizeMembers(party.members);
    members = members.filter(name => name !== memberName);

    const updates = { members };

    if (currentEvent === "ruins" && party.rallyLeader === memberName) {
      updates.rallyLeader = members[0] || "";
    }

    await ref.update(updates);

    if (isAdmin) {
      await writeAdminLog("kick_member", {
        partyId,
        memberName
      });
    }
  } catch (error) {
    console.error("kickMember error:", error);
    alert("추방 중 오류가 발생했습니다.");
  }
}

window.kickMember = kickMember;

async function setRallyLeader(partyId, memberName) {
  try {
    if (!isAdmin || currentEvent !== "ruins") {
      alert("집결장 지정 권한이 없습니다.");
      return;
    }

    if (!confirm(`${memberName} 님을 집결장으로 지정하시겠습니까?`)) return;

    const ref = getEventPartiesRef("ruins").doc(partyId);
    const snap = await ref.get();

    if (!snap.exists) {
      alert("파티를 찾을 수 없습니다.");
      return;
    }

    const party = getSafePartyData(snap);
    const members = normalizeMembers(party.members);

    if (!members.includes(memberName)) {
      alert("해당 사용자는 현재 파티원이 아닙니다.");
      return;
    }

    await ref.update({
      rallyLeader: memberName
    });

    await writeAdminLog("set_rally_leader", {
      partyId,
      memberName
    });
  } catch (error) {
    console.error("setRallyLeader error:", error);
    alert("집결장 지정 중 오류가 발생했습니다.");
  }
}

window.setRallyLeader = setRallyLeader;

// ==============================
// 사용자 목록
// ==============================
async function showAllUsers() {
  try {
    const userSnap = await db.collection("users").get();
    const partySnap = await getEventPartiesRef(currentEvent).get();

    const joinedSet = new Set();

    partySnap.forEach((doc) => {
      const party = getSafePartyData(doc);
      normalizeMembers(party.members).forEach(name => joinedSet.add(name));
    });

    const allUsers = [];
    userSnap.forEach((doc) => {
      const name = doc.id;
      if (!isHiddenTestUser(name)) {
        allUsers.push(name);
      }
    });

    allUsers.sort((a, b) => a.localeCompare(b, "ko"));

    const joined = allUsers.filter(name => joinedSet.has(name));
    const notJoined = allUsers.filter(name => !joinedSet.has(name));

    alert(
      `[참여]\n${joined.join("\n") || "(없음)"}\n\n[미참여]\n${notJoined.join("\n") || "(없음)"}`
    );
  } catch (error) {
    console.error("showAllUsers error:", error);
    alert("전체 사용자 목록을 불러오는 중 오류가 발생했습니다.");
  }
}

window.showAllUsers = showAllUsers;

// ==============================
// 이벤트 선택 화면으로 이동
// ==============================
function goEventSelect() {
  if (unsubscribeParties) {
    unsubscribeParties();
    unsubscribeParties = null;
  }

  currentEvent = "";
  localStorage.removeItem("partyAppEvent");
  if (partyListEl) partyListEl.innerHTML = "";
  showScreen("event");
}

window.goEventSelect = goEventSelect;

// ==============================
// 초기 실행
// ==============================
document.addEventListener("DOMContentLoaded", () => {
  tryAutoLogin();
});
