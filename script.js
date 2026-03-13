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

const state = {
  nickname: "",
  allUsers: [],
  admins: new Set(),
  eventsList: [],
  eventsMap: {},
  currentEventId: null,
  currentEventMeta: null,
  unsubscribeParties: null,
  currentParties: [],
  createBusy: false,
  selectedRuinMemberByParty: {}
};

window.onload = async () => {
  bindStaticEvents();

  const savedNickname = localStorage.getItem("nickname");
  if (savedNickname) {
    state.nickname = savedNickname.trim();
    document.getElementById("nicknameInput").value = state.nickname;

    try {
      await registerUser();
      await startApp();
    } catch (error) {
      console.error(error);
      alert("자동 로그인 중 오류가 발생했습니다.");
    }
  }
};

function bindStaticEvents() {
  const nicknameInput = document.getElementById("nicknameInput");
  nicknameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") login();
  });

  window.addEventListener("click", (e) => {
    if (e.target.id === "userModal") closeUsers();
    if (e.target.id === "adminModal") closeAdminModal();
    if (e.target.id === "ruinsCreateModal") closeRuinsCreateModal();
  });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return map[char];
  });
}

function isAdmin() {
  return state.admins.has(state.nickname);
}

function isCurrentRuins() {
  return state.currentEventMeta && state.currentEventMeta.template === "ruins";
}

function isCurrentVikings() {
  return state.currentEventMeta && state.currentEventMeta.template === "vikings";
}

async function login() {
  const nickname = document.getElementById("nicknameInput").value.trim();

  if (!nickname) {
    alert("닉네임을 입력해 주세요.");
    return;
  }

  state.nickname = nickname;
  localStorage.setItem("nickname", nickname);

  try {
    await registerUser();
    await startApp();
  } catch (error) {
    console.error(error);
    alert("로그인 중 오류가 발생했습니다.");
  }
}

async function registerUser() {
  const ref = db.collection("users").doc(state.nickname);
  const snap = await ref.get();

  if (!snap.exists) {
    await ref.set({
      created: Date.now()
    });
  }
}

async function startApp() {
  document.getElementById("loginPage").style.display = "none";
  document.getElementById("appShell").style.display = "block";
  document.getElementById("myNickname").innerText = state.nickname;

  await refreshBaseData();
  goHome();
}

async function refreshBaseData() {
  try {
    await Promise.all([
      loadUsers(),
      loadAdmins(),
      loadEvents()
    ]);

    if (state.currentEventId && state.eventsMap[state.currentEventId]) {
      state.currentEventMeta = state.eventsMap[state.currentEventId];
    }

    renderHomeSummary();
    updateAdminModalInfo();
    updateAdminButtonVisibility();
    updateCreateBox();
  } catch (error) {
    console.error(error);
    alert("기본 데이터를 불러오는 중 오류가 발생했습니다.");
  }
}

async function loadUsers() {
  const snap = await db.collection("users").get();
  const users = [];

  snap.forEach((doc) => {
    users.push(doc.id);
  });

  users.sort((a, b) => a.localeCompare(b, "ko"));
  state.allUsers = users;
}

async function loadAdmins() {
  const snap = await db.collection("admins").get();
  const admins = new Set();

  snap.forEach((doc) => {
    admins.add(doc.id);
  });

  state.admins = admins;
}

async function loadEvents() {
  const snap = await db.collection("events").get();
  const events = [];

  snap.forEach((doc) => {
    const data = doc.data() || {};

    events.push({
      id: doc.id,
      name: data.name || doc.id,
      template: data.template || (doc.id === "ruins" ? "ruins" : "vikings"),
      createRole: data.createRole || "user",
      defaultLimit: Number(data.defaultLimit) || 6,
      order: Number(data.order) || 999
    });
  });

  events.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.name.localeCompare(b.name, "ko");
  });

  state.eventsList = events;
  state.eventsMap = {};
  events.forEach((event) => {
    state.eventsMap[event.id] = event;
  });

  renderTopTabs();
  renderHomeEventCards();
}

function renderTopTabs() {
  const eventTabs = document.getElementById("eventTabs");
  eventTabs.innerHTML = "";

  state.eventsList.forEach((event) => {
    const btn = document.createElement("button");
    btn.className = "topTab";
    btn.id = `eventTab_${event.id}`;
    btn.innerText = event.name;
    btn.onclick = () => selectEvent(event.id);
    eventTabs.appendChild(btn);
  });

  setActiveTab(state.currentEventId || "home");
}

function renderHomeSummary() {
  const homeStats = document.getElementById("homeStats");
  const eventCount = state.eventsList.length;
  const adminCount = state.admins.size;

  homeStats.innerHTML = `
    <div class="statCard">
      <div class="statLabel">전체 유저</div>
      <div class="statValue">${state.allUsers.length}</div>
    </div>
    <div class="statCard">
      <div class="statLabel">이벤트 수</div>
      <div class="statValue">${eventCount}</div>
    </div>
    <div class="statCard">
      <div class="statLabel">운영진 수</div>
      <div class="statValue">${adminCount}</div>
    </div>
  `;
}

function renderHomeSummary() {
  const homeStats = document.getElementById("homeStats");
  if (!homeStats) return;

  const eventCount = state.eventsList.length;
  const adminCount = state.admins.size;

  homeStats.innerHTML = `
    <div class="statCard">
      <div class="statLabel">전체 유저</div>
      <div class="statValue">${state.allUsers.length}</div>
    </div>
    <div class="statCard">
      <div class="statLabel">이벤트 수</div>
      <div class="statValue">${eventCount}</div>
    </div>
    <div class="statCard">
      <div class="statLabel">운영진 수</div>
      <div class="statValue">${adminCount}</div>
    </div>
  `;
}

function goHome() {
  if (state.unsubscribeParties) {
    state.unsubscribeParties();
    state.unsubscribeParties = null;
  }

  state.currentEventId = null;
  state.currentEventMeta = null;
  state.currentParties = [];
  state.selectedRuinMemberByParty = {};

  document.getElementById("homeView").style.display = "block";
  document.getElementById("eventView").style.display = "none";

  setActiveTab("home");
  renderHomeSummary();
  updateAdminModalInfo();
}

function setActiveTab(tabKey) {
  document.querySelectorAll(".topTab").forEach((btn) => {
    btn.classList.remove("active");
  });

  if (tabKey === "home") {
    document.getElementById("homeTabBtn").classList.add("active");
    return;
  }

  const currentBtn = document.getElementById(`eventTab_${tabKey}`);
  if (currentBtn) currentBtn.classList.add("active");
}

function selectEvent(eventId) {
  const meta = state.eventsMap[eventId];
  if (!meta) return;

  state.currentEventId = eventId;
  state.currentEventMeta = meta;
  state.selectedRuinMemberByParty = {};

  document.getElementById("homeView").style.display = "none";
  document.getElementById("eventView").style.display = "block";
  document.getElementById("eventTitle").innerText = meta.name;

  setActiveTab(eventId);
  updateCreateBox();
  updateAdminModalInfo();
  subscribeCurrentEvent();
}

function updateCreateBox() {
  const createHint = document.getElementById("createHint");
  const vikingWrap = document.getElementById("vikingCreateWrap");
  const ruinsWrap = document.getElementById("ruinsCreateWrap");
  const createBtn = document.getElementById("createPartyBtn");
  const partyTitleInput = document.getElementById("partyTitleInput");
  const partyLimitInput = document.getElementById("partyLimitInput");
  const ruinsOpenBtn = document.getElementById("ruinsCreateOpenBtn");
  const ruinsLimitInput = document.getElementById("ruinsLimitInput");

  if (!state.currentEventMeta) {
    vikingWrap.style.display = "none";
    ruinsWrap.style.display = "none";
    createHint.innerText = "";
    return;
  }

  const canCreate = state.currentEventMeta.createRole !== "admin" || isAdmin();

  if (isCurrentVikings()) {
    vikingWrap.style.display = "grid";
    ruinsWrap.style.display = "none";

    partyTitleInput.disabled = !canCreate;
    partyLimitInput.disabled = !canCreate;
    createBtn.disabled = !canCreate;
    partyLimitInput.value = state.currentEventMeta.defaultLimit || 6;

    createHint.innerText = canCreate
      ? "원하는 이름으로 파티를 바로 개설할 수 있습니다."
      : "이 이벤트는 운영진만 파티를 만들 수 있습니다.";
  } else if (isCurrentRuins()) {
    vikingWrap.style.display = "none";
    ruinsWrap.style.display = "flex";

    ruinsOpenBtn.disabled = !canCreate;
    ruinsLimitInput.value = state.currentEventMeta.defaultLimit || 6;

    createHint.innerText = canCreate
      ? "유적 생성 버튼을 눌러 월 / 일 / 한국시간을 입력하세요."
      : "이 이벤트는 운영진만 파티를 만들 수 있습니다.";
  }
}

function updateAdminButtonVisibility() {
  const btn = document.getElementById("adminMenuBtn");
  btn.style.display = isAdmin() ? "inline-flex" : "none";
}

function updateAdminModalInfo() {
  document.getElementById("adminInfoNickname").innerText = state.nickname || "-";
  document.getElementById("adminInfoEvent").innerText =
    state.currentEventMeta ? state.currentEventMeta.name : "홈";
  document.getElementById("adminInfoCreateRole").innerText =
    state.currentEventMeta ? state.currentEventMeta.createRole : "-";
  document.getElementById("adminInfoTemplate").innerText =
    state.currentEventMeta ? state.currentEventMeta.template : "-";
}

function openAdminModal() {
  if (!isAdmin()) return;
  updateAdminModalInfo();
  document.getElementById("adminModal").style.display = "flex";
}

function closeAdminModal() {
  document.getElementById("adminModal").style.display = "none";
}

function openRuinsCreateModal() {
  if (!state.currentEventMeta || !isCurrentRuins()) return;

  const canCreate = state.currentEventMeta.createRole !== "admin" || isAdmin();
  if (!canCreate) {
    alert("이 이벤트는 운영진만 파티를 만들 수 있습니다.");
    return;
  }

  document.getElementById("ruinsTitleInput").value = "";
  document.getElementById("ruinsMonthInput").value = "";
  document.getElementById("ruinsDayInput").value = "";
  document.getElementById("ruinsKSTInput").value = "";
  document.getElementById("ruinsLimitInput").value = state.currentEventMeta.defaultLimit || 6;

  document.getElementById("ruinsCreateModal").style.display = "flex";
}

function closeRuinsCreateModal() {
  document.getElementById("ruinsCreateModal").style.display = "none";
}

function subscribeCurrentEvent() {
  if (!state.currentEventId) return;

  if (state.unsubscribeParties) {
    state.unsubscribeParties();
    state.unsubscribeParties = null;
  }

  state.unsubscribeParties = db
    .collection("parties")
    .where("event", "==", state.currentEventId)
    .onSnapshot(
      (snapshot) => {
        renderCurrentEvent(snapshot);
      },
      (error) => {
        console.error(error);
        alert("이벤트 데이터를 불러오는 중 오류가 발생했습니다.");
      }
    );
}

function normalizeParty(id, data) {
  const members = Array.isArray(data.members) ? [...new Set(data.members)] : [];

  return {
    id,
    event: data.event || "",
    template: data.template || (state.currentEventMeta ? state.currentEventMeta.template : "vikings"),
    title: data.title || "",
    month: data.month || "",
    day: data.day || "",
    timeKST: data.timeKST || "",
    timeUTC: data.timeUTC || "",
    createdBy: data.createdBy || "",
    rallyLeader: data.rallyLeader || "",
    members,
    limit: Number(data.limit) || 6,
    created: Number(data.created) || 0
  };
}

function getRuinsSortValue(party) {
  const month = Number(party.month) || 0;
  const day = Number(party.day) || 0;

  let hour = 0;
  let minute = 0;

  const match = /^(\d{1,2}):(\d{2})$/.exec(String(party.timeKST || "").trim());
  if (match) {
    hour = Number(match[1]) || 0;
    minute = Number(match[2]) || 0;
  }

  return month * 1000000 + day * 10000 + hour * 100 + minute;
}

function renderCurrentEvent(snapshot) {
  const parties = [];

  snapshot.forEach((doc) => {
    parties.push(normalizeParty(doc.id, doc.data() || {}));
  });

  if (isCurrentRuins()) {
    parties.sort((a, b) => {
      const aValue = getRuinsSortValue(a);
      const bValue = getRuinsSortValue(b);

      if (aValue !== bValue) return aValue - bValue;
      return a.created - b.created;
    });
  } else {
    parties.sort((a, b) => a.created - b.created);
  }

  state.currentParties = parties;

  const validPartyIds = new Set(parties.map((p) => p.id));
  Object.keys(state.selectedRuinMemberByParty).forEach((partyId) => {
    if (!validPartyIds.has(partyId)) {
      delete state.selectedRuinMemberByParty[partyId];
      return;
    }

    const party = parties.find((p) => p.id === partyId);
    const member = state.selectedRuinMemberByParty[partyId];
    if (!party || !party.members.includes(member)) {
      delete state.selectedRuinMemberByParty[partyId];
    }
  });

  renderBoardSections(parties);
  updateDashboard(parties);
  updateAdminModalInfo();
}

function renderBoardSections(parties) {
  const myWrap = document.getElementById("myParty");
  const openWrap = document.getElementById("openParty");
  const closedWrap = document.getElementById("closedParty");

  myWrap.innerHTML = "";
  openWrap.innerHTML = "";
  closedWrap.innerHTML = "";

  let myCount = 0;
  let openCount = 0;
  let closedCount = 0;

  parties.forEach((party) => {
    const card = buildPartyCard(party);

    if (party.members.includes(state.nickname)) {
      card.classList.add("zoneMy");
      myWrap.appendChild(card);
      myCount += 1;
    } else if (party.members.length >= party.limit) {
      card.classList.add("zoneClosed");
      closedWrap.appendChild(card);
      closedCount += 1;
    } else {
      card.classList.add("zoneOpen");
      openWrap.appendChild(card);
      openCount += 1;
    }
  });

  if (myCount === 0) {
    myWrap.innerHTML = `<div class="emptyCard">현재 이벤트에서 참여 중인 파티가 없습니다.</div>`;
  }

  if (openCount === 0) {
    openWrap.innerHTML = `<div class="emptyCard">현재 모집중인 파티가 없습니다.</div>`;
  }

  if (closedCount === 0) {
    closedWrap.innerHTML = `<div class="emptyCard">현재 모집완료된 파티가 없습니다.</div>`;
  }
}

function buildPartyCard(party) {
  const card = document.createElement("div");
  card.className = party.template === "ruins"
    ? "partyCard partyCardRuins"
    : "partyCard partyCardVikings";

  card.innerHTML = party.template === "ruins"
    ? renderRuinsCardHtml(party)
    : renderVikingsCardHtml(party);

  return card;
}

function renderVikingsCardHtml(party) {
  return `
    <div class="cardHead">
      <div class="cardTitleLine">
        <div class="cardTitle">${escapeHtml(party.title || "이름 없는 파티")}</div>
        <div class="inlineQuota">(${party.members.length}/${party.limit})</div>
      </div>
    </div>

    <div class="cardSection">
      <div class="sectionLabel">파티원</div>
      <div class="memberList">
        ${renderMembersHtml(party)}
      </div>
    </div>

    <div class="cardButtons">
      ${renderCardButtons(party)}
    </div>
  `;
}

function renderRuinsCardHtml(party) {
  const troopText = getTroopText(party);
  const dateText = `${escapeHtml(party.month || "-")}월 ${escapeHtml(party.day || "-")}일`;
  const visibleMembers = party.members.filter((member) => member !== party.rallyLeader);

  return `
    <div class="cardHead cardHeadRuins">
      <div class="cardTitleLine">
        <div class="cardTitle">${escapeHtml(party.title || "이름 없는 유적")}</div>
        <div class="inlineQuota">(${party.members.length}/${party.limit})</div>
      </div>

      <div class="ruinMetaRow">
        <span class="timeBadge">${dateText}</span>
        <span class="timeBadge">KST ${escapeHtml(party.timeKST || "-")}</span>
        <span class="timeBadge timeBadgeUtc">UTC ${escapeHtml(party.timeUTC || "-")}</span>
        <span class="timeBadge troopBadge">병력 수 ${troopText}</span>
      </div>
    </div>

    <div class="cardSection">
      <div class="sectionLabel">집결장</div>
      <div class="rallyLeaderBox">
        ${party.rallyLeader
          ? `<span class="rallyLeaderChip">${escapeHtml(party.rallyLeader)}</span>`
          : `<span class="rallyLeaderEmpty">아직 선택되지 않음</span>`}
      </div>
    </div>

    <div class="cardSection">
      <div class="sectionLabel">파티원</div>
      <div class="memberList">
        ${renderMembersHtml({ ...party, members: visibleMembers })}
      </div>
      ${renderRuinsMemberActionHtml(party)}
    </div>

    <div class="cardButtons">
      ${renderCardButtons(party)}
    </div>
  `;
}

function renderMembersHtml(party) {
  if (!party.members.length) {
    return `<div class="emptyMembers">아직 참여한 인원이 없습니다.</div>`;
  }

  const selectedMember = state.selectedRuinMemberByParty[party.id] || "";

  return party.members.map((member) => {
    const isMine = member === state.nickname;
    const isCreator = member === party.createdBy;
    const isRallyLeader = member === party.rallyLeader;

    if (party.template === "ruins" && isAdmin()) {
      const encodedMember = encodeURIComponent(member);
      const selectedClass = selectedMember === member ? "memberItemSelected" : "";

      return `
        <button
          type="button"
          class="memberItem memberButton ${isMine ? "memberItemMine" : ""} ${selectedClass}"
          onclick="selectRuinMember('${party.id}', '${encodedMember}')"
        >
          <span class="memberName">${escapeHtml(member)}</span>
          <span class="memberMetaWrap">
            ${isCreator ? `<span class="memberRole">생성자</span>` : ""}
            ${isRallyLeader ? `<span class="memberRole memberRolePurple">집결장</span>` : ""}
          </span>
        </button>
      `;
    }

    return `
      <div class="memberItem ${isMine ? "memberItemMine" : ""}">
        <span class="memberName">${escapeHtml(member)}</span>
        <span class="memberMetaWrap">
          ${isCreator ? `<span class="memberRole">생성자</span>` : ""}
          ${isRallyLeader ? `<span class="memberRole memberRolePurple">집결장</span>` : ""}
        </span>
      </div>
    `;
  }).join("");
}

function renderRuinsMemberActionHtml(party) {
  if (party.template !== "ruins" || !isAdmin()) return "";

  const selected = state.selectedRuinMemberByParty[party.id] || "";
  const selectedExists = selected && party.members.includes(selected);
  const encodedMember = selectedExists ? encodeURIComponent(selected) : "";

  return `
    <div class="memberActionBox">
      <div class="memberActionText">
        ${selectedExists
          ? `선택된 파티원: <b>${escapeHtml(selected)}</b>`
          : `운영진은 파티원 닉네임을 눌러 집결장을 지정하거나 추방할 수 있습니다.`}
      </div>
      <div class="memberActionBtns">
        ${selectedExists ? `
          <button class="secondaryBtn miniBtn" onclick="setRallyLeader('${party.id}', '${encodedMember}')">
            ${selected === party.rallyLeader ? "집결장 유지중" : "집결장 지정"}
          </button>
          <button class="deleteBtn miniBtn" onclick="kickMember('${party.id}', '${encodedMember}')">
            추방
          </button>
        ` : ``}
      </div>
    </div>
  `;
}

function renderCardButtons(party) {
  const isMember = party.members.includes(state.nickname);
  const isCreator = party.createdBy === state.nickname;
  const admin = isAdmin();
  const isFull = party.members.length >= party.limit;

  let hasOtherParty = false;
  if (party.template === "vikings") {
    hasOtherParty = state.currentParties.some(
      (item) => item.id !== party.id && item.members.includes(state.nickname)
    );
  }

  let html = "";

  if (!isMember) {
    if (isFull) {
      html += `<button class="disabledBtn miniBtn" disabled>모집완료</button>`;
    } else if (party.template === "vikings" && hasOtherParty) {
      html += `<button class="disabledBtn miniBtn" disabled>다른 파티 참여중</button>`;
    } else {
      html += `<button class="joinBtn miniBtn" onclick="joinParty('${party.id}')">지원</button>`;
    }
  }

  if (isMember && !isCreator) {
    html += `<button class="leaveBtn miniBtn" onclick="leaveParty('${party.id}')">취소</button>`;
  }

  if (isCreator || admin) {
    html += `<button class="deleteBtn miniBtn" onclick="deleteParty('${party.id}')">삭제</button>`;
  }

  return html;
}

function getTroopText(party) {
  const activeMemberCount = party.rallyLeader
    ? party.members.filter((member) => member !== party.rallyLeader).length
    : party.members.length;

  if (activeMemberCount <= 0) return "-";
  
  const value = Math.floor((920000 / activeMemberCount) / 1000) * 1000;
  return value.toLocaleString("ko-KR");
}

function toUtcTimeString(kstText) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(kstText.trim());
  if (!match) return "";

  let hour = Number(match[1]);
  const minute = Number(match[2]);

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return "";

  hour = (hour - 9 + 24) % 24;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function updateDashboard(parties) {
  const joinedUsers = new Set();
  let closedCount = 0;

  parties.forEach((party) => {
    party.members.forEach((member) => joinedUsers.add(member));
    if (party.members.length >= party.limit) closedCount += 1;
  });

  const joined = joinedUsers.size;
  const totalUsers = state.allUsers.length;
  const notJoined = Math.max(totalUsers - joined, 0);

  document.getElementById("dashboard").innerText =
    `총 ${totalUsers} | 참여 ${joined} | 미참여 ${notJoined} | 파티 ${parties.length} | 모집완료 ${closedCount}`;
}

function createParty() {
  if (!state.currentEventMeta) return;

  const canCreate = state.currentEventMeta.createRole !== "admin" || isAdmin();
  if (!canCreate) {
    alert("이 이벤트는 운영진만 파티를 만들 수 있습니다.");
    return;
  }

  if (isCurrentRuins()) {
    openRuinsCreateModal();
    return;
  }

  createVikingsParty();
}

async function createVikingsParty() {
  if (!state.currentEventMeta || state.createBusy || !isCurrentVikings()) return;

  const title = document.getElementById("partyTitleInput").value.trim();
  const limit = Number(document.getElementById("partyLimitInput").value);

  if (!title) {
    alert("파티명을 입력해 주세요.");
    return;
  }

  if (!limit || limit < 1) {
    alert("총원은 1 이상이어야 합니다.");
    return;
  }

  const alreadyJoined = state.currentParties.some((party) => party.members.includes(state.nickname));
  if (alreadyJoined) {
    alert("이 이벤트에는 이미 참여 중인 파티가 있습니다.");
    return;
  }

  state.createBusy = true;
  const createBtn = document.getElementById("createPartyBtn");
  createBtn.disabled = true;

  try {
    await db.collection("parties").add({
      event: state.currentEventId,
      template: "vikings",
      title,
      createdBy: state.nickname,
      members: [state.nickname],
      limit,
      created: Date.now()
    });

    document.getElementById("partyTitleInput").value = "";
    document.getElementById("partyLimitInput").value = state.currentEventMeta.defaultLimit || 6;
  } catch (error) {
    console.error(error);
    alert("파티 생성 중 오류가 발생했습니다.");
  } finally {
    state.createBusy = false;
    updateCreateBox();
  }
}

async function submitRuinsParty() {
  if (!state.currentEventMeta || state.createBusy || !isCurrentRuins()) return;

  const canCreate = state.currentEventMeta.createRole !== "admin" || isAdmin();
  if (!canCreate) {
    alert("이 이벤트는 운영진만 파티를 만들 수 있습니다.");
    return;
  }

  const title = document.getElementById("ruinsTitleInput").value.trim();
  const month = document.getElementById("ruinsMonthInput").value.trim();
  const day = document.getElementById("ruinsDayInput").value.trim();
  const timeKST = document.getElementById("ruinsKSTInput").value.trim();
  const limit = Number(document.getElementById("ruinsLimitInput").value);
  const timeUTC = toUtcTimeString(timeKST);

  if (!title) {
    alert("유적명을 입력해 주세요.");
    return;
  }

  if (!month || !day || !timeKST) {
    alert("월, 일, 한국시간을 모두 입력해 주세요.");
    return;
  }

  if (!timeUTC) {
    alert("한국시간은 HH:MM 형식으로 입력해 주세요. 예: 21:00");
    return;
  }

  if (!limit || limit < 1) {
    alert("총원은 1 이상이어야 합니다.");
    return;
  }

  state.createBusy = true;

  try {
    await db.collection("parties").add({
      event: state.currentEventId,
      template: "ruins",
      title,
      month,
      day,
      timeKST,
      timeUTC,
      createdBy: state.nickname,
      rallyLeader: "",
      members: [],
      limit,
      created: Date.now()
    });

    closeRuinsCreateModal();
  } catch (error) {
    console.error(error);
    alert("유적 파티 생성 중 오류가 발생했습니다.");
  } finally {
    state.createBusy = false;
  }
}

async function joinParty(partyId) {
  if (!state.currentEventId) return;

  try {
    const ref = db.collection("parties").doc(partyId);
    const snap = await ref.get();

    if (!snap.exists) {
      alert("해당 파티를 찾을 수 없습니다.");
      return;
    }

    const party = normalizeParty(snap.id, snap.data() || {});

    if (party.members.includes(state.nickname)) return;

    if (party.members.length >= party.limit) {
      alert("이미 모집완료된 파티입니다.");
      return;
    }

    if (party.template === "vikings") {
      const existingSnap = await db.collection("parties")
        .where("event", "==", state.currentEventId)
        .where("members", "array-contains", state.nickname)
        .get();

      const otherParty = existingSnap.docs.find((doc) => doc.id !== partyId);
      if (otherParty) {
        alert("이 이벤트에는 이미 참여 중인 파티가 있습니다.");
        return;
      }
    }

    await ref.update({
      members: firebase.firestore.FieldValue.arrayUnion(state.nickname)
    });
  } catch (error) {
    console.error(error);
    alert("지원 처리 중 오류가 발생했습니다.");
  }
}

async function leaveParty(partyId) {
  try {
    const ref = db.collection("parties").doc(partyId);
    const snap = await ref.get();

    if (!snap.exists) return;

    const party = normalizeParty(snap.id, snap.data() || {});
    const updatePayload = {
      members: firebase.firestore.FieldValue.arrayRemove(state.nickname)
    };

    if (party.template === "ruins" && party.rallyLeader === state.nickname) {
      updatePayload.rallyLeader = "";
    }

    await ref.update(updatePayload);
  } catch (error) {
    console.error(error);
    alert("취소 처리 중 오류가 발생했습니다.");
  }
}

async function deleteParty(partyId) {
  const party = state.currentParties.find((item) => item.id === partyId);
  if (!party) return;

  const isCreator = party.createdBy === state.nickname;
  if (!isCreator && !isAdmin()) {
    alert("삭제 권한이 없습니다.");
    return;
  }

  if (!confirm("이 파티를 삭제하시겠습니까?")) return;

  try {
    await db.collection("parties").doc(partyId).delete();
  } catch (error) {
    console.error(error);
    alert("파티 삭제 중 오류가 발생했습니다.");
  }
}

function selectRuinMember(partyId, encodedMember) {
  if (!isCurrentRuins() || !isAdmin()) return;

  const member = decodeURIComponent(encodedMember);
  const current = state.selectedRuinMemberByParty[partyId] || "";

  if (current === member) {
    delete state.selectedRuinMemberByParty[partyId];
  } else {
    state.selectedRuinMemberByParty[partyId] = member;
  }

  renderBoardSections(state.currentParties);
}

async function setRallyLeader(partyId, encodedMember) {
  if (!isCurrentRuins() || !isAdmin()) return;

  const member = decodeURIComponent(encodedMember);
  const party = state.currentParties.find((item) => item.id === partyId);

  if (!party) {
    alert("파티 정보를 찾을 수 없습니다.");
    return;
  }

  if (!party.members.includes(member)) {
    alert("해당 사용자는 현재 파티원이 아닙니다.");
    return;
  }

  try {
    await db.collection("parties").doc(partyId).update({
      rallyLeader: member
    });

    state.selectedRuinMemberByParty[partyId] = member;
  } catch (error) {
    console.error(error);
    alert("집결장 지정 중 오류가 발생했습니다.");
  }
}

async function kickMember(partyId, encodedMember) {
  if (!isCurrentRuins() || !isAdmin()) return;

  const member = decodeURIComponent(encodedMember);
  const party = state.currentParties.find((item) => item.id === partyId);

  if (!party) {
    alert("파티 정보를 찾을 수 없습니다.");
    return;
  }

  if (!party.members.includes(member)) {
    alert("해당 사용자는 현재 파티원이 아닙니다.");
    return;
  }

  if (!confirm(`${member} 님을 추방하시겠습니까?`)) return;

  const payload = {
    members: firebase.firestore.FieldValue.arrayRemove(member)
  };

  if (party.rallyLeader === member) {
    payload.rallyLeader = "";
  }

  try {
    await db.collection("parties").doc(partyId).update(payload);
    delete state.selectedRuinMemberByParty[partyId];
  } catch (error) {
    console.error(error);
    alert("추방 처리 중 오류가 발생했습니다.");
  }
}

async function showUsers() {
  if (!state.currentEventMeta) return;

  try {
    await loadUsers();

    const joinedSet = new Set();
    state.currentParties.forEach((party) => {
      party.members.forEach((member) => joinedSet.add(member));
    });

    const joined = [];
    const notJoined = [];

    state.allUsers.forEach((user) => {
      if (joinedSet.has(user)) joined.push(user);
      else notJoined.push(user);
    });

    joined.sort((a, b) => a.localeCompare(b, "ko"));
    notJoined.sort((a, b) => a.localeCompare(b, "ko"));

    const list = document.getElementById("userList");
    list.innerHTML = `
      <div class="userSection">
        <div class="userSectionTitle">참여 (${joined.length})</div>
        <div class="userGrid">
          ${joined.length
            ? joined.map((user) => `<div class="userChip userChipJoined">${escapeHtml(user)}</div>`).join("")
            : `<div class="emptyUsers">참여자가 없습니다.</div>`}
        </div>
      </div>

      <div class="userSection">
        <div class="userSectionTitle">미참여 (${notJoined.length})</div>
        <div class="userGrid">
          ${notJoined.length
            ? notJoined.map((user) => `<div class="userChip userChipIdle">${escapeHtml(user)}</div>`).join("")
            : `<div class="emptyUsers">모든 유저가 참여 중입니다.</div>`}
        </div>
      </div>
    `;

    document.getElementById("userModal").style.display = "flex";
  } catch (error) {
    console.error(error);
    alert("참여자 목록을 불러오는 중 오류가 발생했습니다.");
  }
}

function closeUsers() {
  document.getElementById("userModal").style.display = "none";
}

function logout() {
  if (state.unsubscribeParties) {
    state.unsubscribeParties();
    state.unsubscribeParties = null;
  }

  localStorage.removeItem("nickname");
  location.reload();
}
