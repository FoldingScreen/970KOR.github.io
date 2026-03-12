const firebaseConfig = {
  apiKey: "AIzaSyBu2RrQn8cAwwWaLtw5O8Omwn4-NzHWuc0",
  authDomain: "kor-app-fa47e.firebaseapp.com",
  projectId: "kor-app-fa47e",
  storageBucket: "kor-app-fa47e.firebasestorage.app",
  messagingSenderId: "397749083935",
  appId: "1:397749083935:web:b2bd8498b943aec5099a2a"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let currentUser = "";
let currentEvent = "";
let admins = [];
let allUsers = [];
let currentParties = [];
let selectedLogId = null;

let unsubscribeUsers = null;
let unsubscribeAdmins = null;
let unsubscribeParties = null;
let unsubscribeLogs = null;

const UPDATE_TEXT = "최종 업데이트: 2026-03-12 23:59:00";
const RELIC_TOTAL_CAPACITY = 15;
const RELIC_TOTAL_POWER = 920000;

window.addEventListener("load", async () => {
  const versionEl = document.querySelector(".version");
  if (versionEl) versionEl.textContent = UPDATE_TEXT;

  startGlobalListeners();

  const saved = localStorage.getItem("nickname");
  if (saved) {
    currentUser = saved;
    document.getElementById("nicknameInput").value = saved;
    showEventPage();
  }
});

function startGlobalListeners() {
  if (!unsubscribeUsers) {
    unsubscribeUsers = db.collection("users").onSnapshot(snapshot => {
      allUsers = [];
      snapshot.forEach(doc => {
        if (!doc.id.startsWith("테스트")) allUsers.push(doc.id);
      });
      allUsers.sort();
      if (currentEvent) updateDashboard();
    });
  }

  if (!unsubscribeAdmins) {
    unsubscribeAdmins = db.collection("admins").onSnapshot(snapshot => {
      admins = [];
      snapshot.forEach(doc => admins.push(doc.id));
      admins.sort();
      syncAdminUI();
    });
  }
}

function enterLogin(e) {
  if (e.key === "Enter") login();
}

async function login() {
  const name = document.getElementById("nicknameInput").value.trim();
  if (!name) {
    alert("닉네임 입력");
    return;
  }

  currentUser = name;
  localStorage.setItem("nickname", name);

  await db.collection("users").doc(name).set({
    name,
    updatedAt: Date.now()
  }, { merge: true });

  showEventPage();
}

function showEventPage() {
  document.getElementById("loginPage").classList.add("hidden");
  document.getElementById("mainPage").classList.add("hidden");
  document.getElementById("eventPage").classList.remove("hidden");
  document.getElementById("userLabel").innerText = currentUser ? `👤 ${currentUser}` : "";
  syncAdminUI();
}

function backToEvents() {
  if (unsubscribeParties) {
    unsubscribeParties();
    unsubscribeParties = null;
  }
  currentEvent = "";
  currentParties = [];
  document.getElementById("mainPage").classList.add("hidden");
  document.getElementById("eventPage").classList.remove("hidden");
}

function logout() {
  localStorage.removeItem("nickname");
  location.reload();
}

function syncAdminUI() {
  const adminDropdown = document.getElementById("adminDropdown");
  const createBtn = document.getElementById("createPartyBtn");

  const isAdmin = admins.includes(currentUser);

  if (adminDropdown) {
    if (isAdmin) adminDropdown.classList.remove("hidden");
    else adminDropdown.classList.add("hidden");
  }

  if (createBtn) {
    if (currentEvent === "relic" && isAdmin) createBtn.classList.remove("hidden");
    else createBtn.classList.add("hidden");
  }
}

function toggleAdminMenu() {
  document.getElementById("adminMenu").classList.toggle("hidden");
}

function openEvent(eventName) {
  currentEvent = eventName;

  document.getElementById("eventPage").classList.add("hidden");
  document.getElementById("mainPage").classList.remove("hidden");

  document.getElementById("eventTitle").innerText =
    eventName === "relic" ? "유적 쟁탈" : "바이킹의 역습";

  document.getElementById("partyList").className = "grid4";
  document.getElementById("partyList").innerHTML = "";

  document.getElementById("vikingCreateBox").classList.toggle("hidden", eventName !== "viking");
  syncAdminUI();

  listenParties();
}

function partyCollectionRef() {
  return db.collection("events").doc(currentEvent).collection("parties");
}

function listenParties() {
  if (unsubscribeParties) unsubscribeParties();

  unsubscribeParties = partyCollectionRef().onSnapshot(snapshot => {
    const docs = [];
    snapshot.forEach(doc => {
      docs.push({ id: doc.id, ...doc.data() });
    });

    docs.sort((a, b) => {
      const av = typeof a.timeUTC === "number" ? a.timeUTC : (typeof a.created === "number" ? a.created : 0);
      const bv = typeof b.timeUTC === "number" ? b.timeUTC : (typeof b.created === "number" ? b.created : 0);
      return av - bv;
    });

    currentParties = docs;
    renderParties();
    updateDashboard();
  }, err => {
    console.error(err);
    alert("파티 데이터를 불러오지 못했습니다. Firestore Rules와 콘솔 에러를 확인하세요.");
  });
}

function renderParties() {
  const list = document.getElementById("partyList");
  list.innerHTML = "";

  currentParties.forEach(party => {
    const card = document.createElement("div");
    card.className = `partyCard${currentEvent === "relic" ? " relicCard" : ""}`;
    card.innerHTML = currentEvent === "relic"
      ? renderRelicCard(party)
      : renderVikingCard(party);
    list.appendChild(card);
  });
}

function renderVikingCard(party) {
  const members = Array.isArray(party.members) ? [...party.members] : [];
  const leader = party.leader || "";
  const limit = party.limit || 6;

  const sorted = [...members].sort((a, b) => {
    if (a === leader) return -1;
    if (b === leader) return 1;
    return 0;
  });

  let memberHtml = "";
  sorted.forEach(m => {
    const name = m === currentUser ? `<span class="me">${escapeHtml(m)}</span>` : escapeHtml(m);

    let line = "";
    if (m === leader) line += "👑 ";
    line += name;

    if ((leader === currentUser || admins.includes(currentUser)) && m !== leader) {
      line += ` <span class="controls kickBtn" onclick="kickViking('${party.id}','${escapeJs(m)}')">✖</span>`;
    }

    memberHtml += `<div class="memberRow"><div class="member">${line}</div></div>`;
  });

  let buttons = `<div class="buttons">`;

  if (!members.includes(currentUser) && members.length < limit) {
    buttons += `<button type="button" onclick="joinVikingParty('${party.id}')">지원</button>`;
  }

  if (members.includes(currentUser) && leader !== currentUser) {
    buttons += `<button type="button" onclick="leaveVikingParty('${party.id}')">취소</button>`;
  }

  if (leader === currentUser || admins.includes(currentUser)) {
    buttons += `<button type="button" onclick="deleteVikingParty('${party.id}')">삭제</button>`;
  }

  buttons += `</div>`;

  return `
    <div class="cardTitle">${escapeHtml(party.name || "이름 없는 파티")} (${members.length}/${limit})</div>
    ${memberHtml}
    ${buttons}
  `;
}

function renderRelicCard(party) {
  const members = Array.isArray(party.members) ? [...party.members] : [];
  const rally = party.rally || "";

  let sorted = [...members];
  if (rally) {
    sorted = sorted.filter(m => m !== rally);
    sorted.unshift(rally);
  }

  let memberHtml = "";
  sorted.forEach(m => {
    const decorated = m === currentUser
      ? `<span class="me">${m === rally ? "👑 " + escapeHtml(m) : escapeHtml(m)}</span>`
      : (m === rally ? "👑 " + escapeHtml(m) : escapeHtml(m));

    let controls = "";
    if (admins.includes(currentUser)) {
      controls += `<span class="controls rallyBtn" onclick="setRally('${party.id}','${escapeJs(m)}')">👍</span>`;
      if (m !== rally) {
        controls += `<span class="controls kickBtn" onclick="kickRelic('${party.id}','${escapeJs(m)}')">✖</span>`;
      }
    }

    memberHtml += `<div class="memberRow"><div class="member">${decorated} ${controls}</div></div>`;
  });

  let buttons = `<div class="buttons">`;

  if (!members.includes(currentUser) && members.length < RELIC_TOTAL_CAPACITY) {
    buttons += `<button type="button" onclick="joinRelicParty('${party.id}')">지원</button>`;
  }

  if (members.includes(currentUser)) {
    buttons += `<button type="button" onclick="leaveRelicParty('${party.id}')">취소</button>`;
  }

  if (admins.includes(currentUser)) {
    buttons += `<button type="button" onclick="deleteRelicParty('${party.id}')">삭제</button>`;
  }

  buttons += `</div>`;

  return `
    <div class="cardTitle">유적명: ${escapeHtml(party.name || "-")}</div>
    <div>시간: ${escapeHtml(party.kst || "-")}</div>
    <div>UTC ${escapeHtml(party.utc || "-")}</div>
    <div>병력수: ${calcPower(members.length)}명</div>
    ${memberHtml}
    ${buttons}
  `;
}

function updateDashboard() {
  const joinedSet = new Set();

  currentParties.forEach(p => {
    const members = Array.isArray(p.members) ? p.members : [];
    members.forEach(m => joinedSet.add(m));
  });

  const joinedCount = [...joinedSet].filter(u => !u.startsWith("테스트")).length;
  const totalCount = allUsers.length;
  const partyCount = currentParties.length;

  let closedCount = 0;
  currentParties.forEach(p => {
    const members = Array.isArray(p.members) ? p.members.length : 0;
    const limit = currentEvent === "relic" ? RELIC_TOTAL_CAPACITY : (p.limit || 6);
    if (members >= limit) closedCount++;
  });

  document.getElementById("dashboard").innerText =
    `총 ${totalCount} | 참여 ${joinedCount} | 미참여 ${Math.max(0, totalCount - joinedCount)} | 파티 ${partyCount} | 모집완료 ${closedCount}`;
}

function showUsers() {
  const joined = [];
  const notJoined = [];
  const joinedSet = new Set();

  currentParties.forEach(p => {
    const members = Array.isArray(p.members) ? p.members : [];
    members.forEach(m => {
      if (!m.startsWith("테스트")) joinedSet.add(m);
    });
  });

  allUsers.forEach(u => {
    if (joinedSet.has(u)) joined.push(u);
    else notJoined.push(u);
  });

  const rows = Math.max(Math.ceil(joined.length / 2), Math.ceil(notJoined.length / 2));
  let html = `<div class="userGrid">`;

  for (let i = 0; i < rows; i++) {
    const j1 = joined[i * 2] || "";
    const j2 = joined[i * 2 + 1] || "";
    const n1 = notJoined[i * 2] || "";
    const n2 = notJoined[i * 2 + 1] || "";

    html += `
      <div class="userCell joined">${escapeHtml(j1)}</div>
      <div class="userCell joined">${escapeHtml(j2)}</div>
      <div class="userCell notJoined">${escapeHtml(n1)}</div>
      <div class="userCell notJoined">${escapeHtml(n2)}</div>
    `;
  }

  html += `</div>`;

  const list = document.getElementById("userList");
  list.className = "userGrid";
  list.innerHTML = html;

  document.getElementById("userModal").classList.remove("hidden");
}

function closeUsers() {
  document.getElementById("userModal").classList.add("hidden");
}

function calcPower(memberCount) {
  const soldiers = memberCount - 1;
  if (soldiers <= 0) return "-";
  let power = RELIC_TOTAL_POWER / soldiers;
  power = Math.floor(power / 1000) * 1000;
  return power.toLocaleString();
}

/* =========================
   유적 파티 생성
========================= */

function openCreateRelicModal() {
  if (currentEvent !== "relic" || !admins.includes(currentUser)) {
    alert("운영진만 생성 가능");
    return;
  }

  document.getElementById("relicCreateModal").classList.remove("hidden");
  renderRelicCreateForms();
}

function closeCreateRelicModal() {
  document.getElementById("relicCreateModal").classList.add("hidden");
}

function renderRelicCreateForms() {
  const count = Number(document.getElementById("relicPartyCount").value || 1);
  const container = document.getElementById("relicCreateForms");

  let html = `<div class="relicFormsGrid">`;

  for (let i = 0; i < count; i++) {
    html += `
      <div class="relicFormBox">
        <h4>파티 ${i + 1}</h4>

        <div class="formRow">
          <label>유적명</label>
          <input id="relic_name_${i}" placeholder="예: 4번 성채">
        </div>

        <div class="formRow">
          <label>UTC 시간</label>
          <div class="formInline">
            <select id="relic_month_${i}">
              ${buildNumberOptions(1, 12)}
            </select>
            <select id="relic_day_${i}">
              ${buildNumberOptions(1, 31)}
            </select>
            <select id="relic_hour_${i}">
              ${buildHourOptions()}
            </select>
          </div>
        </div>
      </div>
    `;
  }

  html += `</div>`;
  container.innerHTML = html;
}

function buildNumberOptions(from, to) {
  let html = "";
  for (let i = from; i <= to; i++) {
    html += `<option value="${i}">${i}</option>`;
  }
  return html;
}

function buildHourOptions() {
  let html = "";
  for (let i = 0; i <= 23; i++) {
    html += `<option value="${i}">${String(i).padStart(2, "0")}:00</option>`;
  }
  return html;
}

async function submitRelicParties() {
  const count = Number(document.getElementById("relicPartyCount").value || 1);

  for (let i = 0; i < count; i++) {
    const name = document.getElementById(`relic_name_${i}`).value.trim();
    const month = Number(document.getElementById(`relic_month_${i}`).value);
    const day = Number(document.getElementById(`relic_day_${i}`).value);
    const hour = Number(document.getElementById(`relic_hour_${i}`).value);

    if (!name) {
      alert(`파티 ${i + 1}의 유적명을 입력하세요.`);
      return;
    }

    const { utcText, kstText, timeUTC } = buildTimeTexts(month, day, hour);

    const ref = await db.collection("events")
      .doc("relic")
      .collection("parties")
      .add({
        name,
        members: [],
        rally: "",
        utc: utcText,
        kst: kstText,
        timeUTC,
        created: Date.now()
      });

    await logAdminAction("createRelicParty", {
      event: "relic",
      partyId: ref.id,
      partyDoc: {
        name,
        members: [],
        rally: "",
        utc: utcText,
        kst: kstText,
        timeUTC,
        created: Date.now()
      }
    });
  }

  closeCreateRelicModal();
  alert("유적 파티 생성 완료");
}

function buildTimeTexts(month, day, hour) {
  const year = new Date().getFullYear();
  const utcDate = new Date(Date.UTC(year, month - 1, day, hour));
  const kstDate = new Date(utcDate.getTime() + 9 * 3600000);

  const utcText = `${month}/${day} ${String(hour).padStart(2, "0")}:00`;
  const kstText = `${kstDate.getMonth() + 1}/${kstDate.getDate()} ${String(kstDate.getHours()).padStart(2, "0")}:00`;

  return {
    utcText,
    kstText,
    timeUTC: utcDate.getTime()
  };
}

/* =========================
   바이킹
========================= */

async function createVikingParty() {
  if (currentEvent !== "viking") return;

  const name = document.getElementById("partyName").value.trim();
  const limit = Number(document.getElementById("partyLimit").value);

  if (!name) {
    alert("파티 이름 입력");
    return;
  }

  const duplicate = currentParties.some(p => (p.name || "") === name);
  if (duplicate) {
    alert("이미 존재하는 파티 이름입니다.");
    return;
  }

  const alreadyInParty = currentParties.some(p => Array.isArray(p.members) && p.members.includes(currentUser));
  if (alreadyInParty) {
    alert("이미 파티에 참여 중입니다.");
    return;
  }

  await partyCollectionRef().add({
    name,
    leader: currentUser,
    members: [currentUser],
    limit,
    created: Date.now(),
    timeUTC: Date.now()
  });

  document.getElementById("partyName").value = "";
}

async function joinVikingParty(partyId) {
  const ref = partyCollectionRef().doc(partyId);

  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error("파티가 없습니다.");

    const data = snap.data();
    const members = Array.isArray(data.members) ? [...data.members] : [];
    const limit = data.limit || 6;

    const alreadyInAnotherParty = currentParties.some(p => Array.isArray(p.members) && p.members.includes(currentUser));
    if (alreadyInAnotherParty) throw new Error("이미 다른 파티에 있습니다.");

    if (members.includes(currentUser)) return;
    if (members.length >= limit) throw new Error("모집완료");

    members.push(currentUser);
    tx.update(ref, { members });
  }).catch(err => alert(err.message));
}

async function leaveVikingParty(partyId) {
  const ref = partyCollectionRef().doc(partyId);
  const snap = await ref.get();
  if (!snap.exists) return;

  const data = snap.data();
  const members = Array.isArray(data.members) ? data.members : [];
  const leader = data.leader || "";

  if (leader === currentUser) {
    alert("파티장은 삭제 버튼을 사용하세요.");
    return;
  }

  await ref.update({
    members: firebase.firestore.FieldValue.arrayRemove(currentUser)
  });
}

async function kickViking(partyId, user) {
  if (!confirm(`${user} 추방할까요?`)) return;

  const ref = partyCollectionRef().doc(partyId);
  const snap = await ref.get();
  if (!snap.exists) return;

  const data = snap.data();
  const leader = data.leader || "";
  if (leader !== currentUser && !admins.includes(currentUser)) {
    alert("권한 없음");
    return;
  }

  const previousMembers = Array.isArray(data.members) ? [...data.members] : [];

  await ref.update({
    members: firebase.firestore.FieldValue.arrayRemove(user)
  });

  await logAdminAction("kickViking", {
    event: "viking",
    partyId,
    user,
    previousMembers
  });
}

async function deleteVikingParty(partyId) {
  if (!confirm("파티를 삭제할까요?")) return;

  const ref = partyCollectionRef().doc(partyId);
  const snap = await ref.get();
  if (!snap.exists) return;

  const data = snap.data();
  if (data.leader !== currentUser && !admins.includes(currentUser)) {
    alert("권한 없음");
    return;
  }

  await ref.delete();

  if (admins.includes(currentUser)) {
    await logAdminAction("deleteVikingParty", {
      event: "viking",
      partyId,
      partyDoc: data
    });
  }
}

/* =========================
   유적 참가/취소/추방/집결장/삭제
========================= */

async function joinRelicParty(partyId) {
  const ref = db.collection("events").doc("relic").collection("parties").doc(partyId);

  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error("파티가 없습니다.");

    const data = snap.data();
    const members = Array.isArray(data.members) ? [...data.members] : [];

    if (members.includes(currentUser)) return;
    if (members.length >= RELIC_TOTAL_CAPACITY) throw new Error("파티 인원 초과");

    members.push(currentUser);
    tx.update(ref, { members });
  }).catch(err => alert(err.message));
}

async function leaveRelicParty(partyId) {
  const ref = db.collection("events").doc("relic").collection("parties").doc(partyId);
  const snap = await ref.get();
  if (!snap.exists) return;

  const data = snap.data();
  const update = {
    members: firebase.firestore.FieldValue.arrayRemove(currentUser)
  };

  if ((data.rally || "") === currentUser) {
    update.rally = "";
  }

  await ref.update(update);
}

async function kickRelic(partyId, user) {
  if (!confirm(`${user} 추방할까요?`)) return;
  if (!admins.includes(currentUser)) {
    alert("권한 없음");
    return;
  }

  const ref = db.collection("events").doc("relic").collection("parties").doc(partyId);
  const snap = await ref.get();
  if (!snap.exists) return;

  const data = snap.data();
  const previousMembers = Array.isArray(data.members) ? [...data.members] : [];
  const previousRally = data.rally || "";

  const update = {
    members: firebase.firestore.FieldValue.arrayRemove(user)
  };

  if (previousRally === user) {
    update.rally = "";
  }

  await ref.update(update);

  await logAdminAction("kickRelic", {
    event: "relic",
    partyId,
    user,
    previousMembers,
    previousRally
  });
}

async function setRally(partyId, user) {
  if (!confirm("집결장을 변경할까요?")) return;
  if (!admins.includes(currentUser)) {
    alert("권한 없음");
    return;
  }

  const ref = db.collection("events").doc("relic").collection("parties").doc(partyId);
  const snap = await ref.get();
  if (!snap.exists) return;

  const data = snap.data();
  const previousRally = data.rally || "";

  await ref.update({ rally: user });

  await logAdminAction("setRally", {
    event: "relic",
    partyId,
    previousRally,
    newRally: user
  });
}

async function deleteRelicParty(partyId) {
  if (!confirm("파티를 삭제할까요?")) return;
  if (!admins.includes(currentUser)) {
    alert("권한 없음");
    return;
  }

  const ref = db.collection("events").doc("relic").collection("parties").doc(partyId);
  const snap = await ref.get();
  if (!snap.exists) return;

  const data = snap.data();
  await ref.delete();

  await logAdminAction("deleteRelicParty", {
    event: "relic",
    partyId,
    partyDoc: data
  });
}

/* =========================
   운영진 기능 / 로그 / 실행취소
========================= */

async function adminAction(action) {
  if (!admins.includes(currentUser)) {
    alert("권한 없음");
    return;
  }

  if (action === "addAdmin") {
    if (currentUser !== "병풍") {
      alert("병풍만 운영진 지정 가능");
      return;
    }

    const target = prompt("운영진 닉네임");
    if (!target) return;

    await db.collection("admins").doc(target).set({
      created: Date.now()
    }, { merge: true });

    await logAdminAction("addAdmin", {
      target
    });

    alert("운영진 추가 완료");
    return;
  }

  if (action === "resetParties") {
    if (!confirm("현재 이벤트의 모든 파티를 삭제할까요?")) return;

    const snap = await partyCollectionRef().get();
    const previousParties = [];

    snap.forEach(doc => {
      previousParties.push({
        id: doc.id,
        data: doc.data()
      });
    });

    for (const doc of snap.docs) {
      await doc.ref.delete();
    }

    await logAdminAction("resetParties", {
      event: currentEvent,
      previousParties
    });

    alert("초기화 완료");
  }
}

async function logAdminAction(type, payload) {
  if (!admins.includes(currentUser)) return;

  await db.collection("adminLogs").add({
    type,
    admin: currentUser,
    payload,
    time: Date.now(),
    undone: false
  });
}

function openLogs() {
  if (!admins.includes(currentUser)) {
    alert("권한 없음");
    return;
  }

  document.getElementById("logModal").classList.remove("hidden");

  if (unsubscribeLogs) unsubscribeLogs();

  unsubscribeLogs = db.collection("adminLogs")
    .onSnapshot(snapshot => {
      const docs = [];
      snapshot.forEach(doc => docs.push({ id: doc.id, ...doc.data() }));
      docs.sort((a, b) => (b.time || 0) - (a.time || 0));

      const container = document.getElementById("logList");
      container.innerHTML = "";

      docs.forEach(log => {
        const div = document.createElement("div");
        div.className = `logItem${selectedLogId === log.id ? " selected" : ""}`;
        div.onclick = () => toggleLogActions(log.id, log);

        let text = `${formatDateTime(log.time)} | ${log.admin} | ${log.type}`;
        if (log.undone) text += " | 취소됨";

        div.innerHTML = `<div>${escapeHtml(text)}</div>`;

        if (selectedLogId === log.id && !log.undone && isUndoable(log.type)) {
          div.innerHTML += `
            <div class="logUndoRow">
              <button type="button" onclick="event.stopPropagation(); undoLog('${log.id}')">실행취소</button>
            </div>
          `;
        }

        container.appendChild(div);
      });
    });
}

function toggleLogActions(logId) {
  selectedLogId = selectedLogId === logId ? null : logId;
  openLogs();
}

function closeLogs() {
  document.getElementById("logModal").classList.add("hidden");
  selectedLogId = null;
  if (unsubscribeLogs) {
    unsubscribeLogs();
    unsubscribeLogs = null;
  }
}

function isUndoable(type) {
  return [
    "resetParties",
    "deleteRelicParty",
    "deleteVikingParty",
    "kickRelic",
    "kickViking"
  ].includes(type);
}

async function undoLog(logId) {
  const ref = db.collection("adminLogs").doc(logId);
  const snap = await ref.get();
  if (!snap.exists) return;

  const log = snap.data();
  if (log.undone) {
    alert("이미 실행취소된 로그입니다.");
    return;
  }

  const { type, payload } = log;

  if (type === "resetParties") {
    const previous = Array.isArray(payload.previousParties) ? payload.previousParties : [];
    for (const p of previous) {
      await db.collection("events").doc(payload.event).collection("parties").doc(p.id).set(p.data);
    }
  }

  if (type === "deleteRelicParty") {
    await db.collection("events").doc("relic").collection("parties").doc(payload.partyId).set(payload.partyDoc);
  }

  if (type === "deleteVikingParty") {
    await db.collection("events").doc("viking").collection("parties").doc(payload.partyId).set(payload.partyDoc);
  }

  if (type === "kickRelic") {
    const refParty = db.collection("events").doc("relic").collection("parties").doc(payload.partyId);
    await refParty.update({
      members: payload.previousMembers || [],
      rally: payload.previousRally || ""
    });
  }

  if (type === "kickViking") {
    const refParty = db.collection("events").doc("viking").collection("parties").doc(payload.partyId);
    await refParty.update({
      members: payload.previousMembers || []
    });
  }

  await ref.update({ undone: true });
  await logAdminAction("undoAdminAction", { targetLogId: logId, originalType: type });

  alert("실행취소 완료");
}

/* =========================
   유틸
========================= */

function formatDateTime(ts) {
  if (!ts) return "-";
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${day} ${h}:${min}:${s}`;
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeJs(str) {
  return String(str || "").replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}
