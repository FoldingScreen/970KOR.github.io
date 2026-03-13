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
  myPartyId: null,
  createBusy: false
};

window.onload = async () => {
  bindStaticEvents();

  const savedNickname = localStorage.getItem("nickname");
  if (savedNickname) {
    state.nickname = savedNickname.trim();
    document.getElementById("nicknameInput").value = state.nickname;
    await startApp();
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

  if (!state.allUsers.includes(state.nickname)) {
    state.allUsers.push(state.nickname);
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

function renderHomeEventCards() {
  const wrap = document.getElementById("homeEventCards");
  wrap.innerHTML = "";

  state.eventsList.forEach((event) => {
    const card = document.createElement("div");
    card.className = "homeEventCard";
    card.innerHTML = `
      <div class="homeEventName">${escapeHtml(event.name)}</div>
      <div class="homeEventMeta">
        카드 유형: ${escapeHtml(event.template)} · 생성 권한: ${escapeHtml(event.createRole)}
      </div>
      <button class="secondaryBtn homeEventBtn">바로가기</button>
    `;

    card.querySelector(".homeEventBtn").onclick = () => selectEvent(event.id);
    wrap.appendChild(card);
  });
}

function goHome() {
  if (state.unsubscribeParties) {
    state.unsubscribeParties();
    state.unsubscribeParties = null;
  }

  state.currentEventId = null;
  state.currentEventMeta = null;
  state.currentParties = [];
  state.myPartyId = null;

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

  document.getElementById("homeView").style.display = "none";
  document.getElementById("eventView").style.display = "block";

  document.getElementById("eventTitle").innerText = meta.name;

  setActiveTab(eventId);
  updateCreateBox();
  updateAdminModalInfo();
  subscribeCurrentEvent();
}

function updateCreateBox() {
  const titleLabel = document.getElementById("titleLabel");
  const titleInput = document.getElementById("partyTitleInput");
  const timeWrap = document.getElementById("timeFieldWrap");
  const limitInput = document.getElementById("partyLimitInput");
  const createBtn = document.getElementById("createPartyBtn");
  const createHint = document.getElementById("createHint");

  if (!state.currentEventMeta) {
    titleLabel.innerText = "파티명";
    titleInput.placeholder = "파티명을 입력하세요";
    timeWrap.style.display = "none";
    createHint.innerText = "";
    return;
  }

  const isAdmin = state.admins.has(state.nickname);
  const canCreate = state.currentEventMeta.createRole !== "admin" || isAdmin;
  const isRuins = state.currentEventMeta.template === "ruins";

  titleLabel.innerText = isRuins ? "유적명" : "파티명";
  titleInput.placeholder = isRuins ? "유적명을 입력하세요" : "파티명을 입력하세요";
  timeWrap.style.display = isRuins ? "grid" : "none";
  limitInput.value = state.currentEventMeta.defaultLimit || 6;

  createBtn.disabled = !canCreate;
  titleInput.disabled = !canCreate;
  limitInput.disabled = !canCreate;
  document.getElementById("timeKSTInput").disabled = !canCreate;
  document.getElementById("timeUTCInput").disabled = !canCreate;

  if (!canCreate) {
    createHint.innerText = "이 이벤트는 운영진만 파티를 만들 수 있습니다.";
  } else if (isRuins) {
    createHint.innerText = "유적명과 KST / UTC 시간을 입력해 파티를 생성하세요.";
  } else {
    createHint.innerText = "원하는 이름으로 파티를 바로 개설할 수 있습니다.";
  }
}

function updateAdminButtonVisibility() {
  const btn = document.getElementById("adminMenuBtn");
  btn.style.display = state.admins.has(state.nickname) ? "inline-flex" : "none";
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
  if (!state.admins.has(state.nickname)) return;
  updateAdminModalInfo();
  document.getElementById("adminModal").style.display = "flex";
}

function closeAdminModal() {
  document.getElementById("adminModal").style.display = "none";
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
    timeKST: data.timeKST || "",
    timeUTC: data.timeUTC || "",
    createdBy: data.createdBy || "",
    members,
    limit: Number(data.limit) || 6,
    created: Number(data.created) || 0
  };
}

function renderCurrentEvent(snapshot) {
  const parties = [];

  snapshot.forEach((doc) => {
    parties.push(normalizeParty(doc.id, doc.data() || {}));
  });

  if (state.currentEventMeta && state.currentEventMeta.template === "ruins") {
    parties.sort((a, b) => {
      const timeCompare = String(a.timeKST).localeCompare(String(b.timeKST), "ko");
      if (timeCompare !== 0) return timeCompare;
      return a.created - b.created;
    });
  } else {
    parties.sort((a, b) => a.created - b.created);
  }

  state.currentParties = parties;

  const myParty = parties.find((party) => party.members.includes(state.nickname));
  state.myPartyId = myParty ? myParty.id : null;

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
      myWrap.appendChild(card);
      myCount += 1;
    } else if (party.members.length >= party.limit) {
      closedWrap.appendChild(card);
      closedCount += 1;
    } else {
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
  const templateClass = party.template === "ruins" ? "partyCard partyCardRuins" : "partyCard partyCardVikings";
  card.className = templateClass;
  card.innerHTML = party.template === "ruins"
    ? renderRuinsCardHtml(party)
    : renderVikingsCardHtml(party);

  return card;
}

function renderVikingsCardHtml(party) {
  return `
    <div class="cardHead">
      <div class="cardTitle">${escapeHtml(party.title || "이름 없는 파티")}</div>
      <div class="quotaBadge">${party.members.length}/${party.limit}</div>
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
  return `
    <div class="cardHead cardHeadRuins">
      <div class="cardTitle">${escapeHtml(party.title || "이름 없는 유적")}</div>
      <div class="timeBadges">
        <span class="timeBadge">KST ${escapeHtml(party.timeKST || "-")}</span>
        <span class="timeBadge timeBadgeUtc">UTC ${escapeHtml(party.timeUTC || "-")}</span>
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

function renderMembersHtml(party) {
  if (!party.members.length) {
    return `<div class="emptyMembers">아직 참여한 인원이 없습니다.</div>`;
  }

  return party.members.map((member) => {
    const isMine = member === state.nickname;
    const isCreator = member === party.createdBy;

    return `
      <div class="memberItem ${isMine ? "memberItemMine" : ""}">
        <span class="memberName">${escapeHtml(member)}</span>
        ${isCreator ? `<span class="memberRole">생성자</span>` : ""}
      </div>
    `;
  }).join("");
}

function renderCardButtons(party) {
  const isMember = party.members.includes(state.nickname);
  const isCreator = party.createdBy === state.nickname;
  const isAdmin = state.admins.has(state.nickname);
  const isFull = party.members.length >= party.limit;
  const hasOtherParty = state.myPartyId && state.myPartyId !== party.id;

  let html = "";

  if (!isMember) {
    if (isFull) {
      html += `<button class="disabledBtn" disabled>모집완료</button>`;
    } else if (hasOtherParty) {
      html += `<button class="disabledBtn" disabled>다른 파티 참여중</button>`;
    } else {
      html += `<button class="joinBtn" onclick="joinParty('${party.id}')">지원</button>`;
    }
  }

  if (isMember && !isCreator) {
    html += `<button class="leaveBtn" onclick="leaveParty('${party.id}')">취소</button>`;
  }

  if (isCreator || isAdmin) {
    html += `<button class="deleteBtn" onclick="deleteParty('${party.id}')">삭제</button>`;
  }

  return html;
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

async function createParty() {
  if (!state.currentEventMeta || state.createBusy) return;

  const isAdmin = state.admins.has(state.nickname);
  const canCreate = state.currentEventMeta.createRole !== "admin" || isAdmin;

  if (!canCreate) {
    alert("이 이벤트는 운영진만 파티를 만들 수 있습니다.");
    return;
  }

  const title = document.getElementById("partyTitleInput").value.trim();
  const limit = Number(document.getElementById("partyLimitInput").value);
  const timeKST = document.getElementById("timeKSTInput").value.trim();
  const timeUTC = document.getElementById("timeUTCInput").value.trim();

  if (!title) {
    alert(state.currentEventMeta.template === "ruins" ? "유적명을 입력해 주세요." : "파티명을 입력해 주세요.");
    return;
  }

  if (!limit || limit < 1) {
    alert("총원은 1 이상이어야 합니다.");
    return;
  }

  if (state.currentEventMeta.template === "ruins") {
    if (!timeKST || !timeUTC) {
      alert("유적 이벤트는 KST와 UTC 시간을 모두 입력해 주세요.");
      return;
    }
  }

  // 바이킹은 생성과 동시에 본인이 참여하므로, 이미 다른 파티에 있으면 생성 불가
  if (state.currentEventMeta.template === "vikings" && state.myPartyId) {
    alert("이 이벤트에는 이미 참여 중인 파티가 있습니다.");
    return;
  }

  state.createBusy = true;
  const createBtn = document.getElementById("createPartyBtn");
  createBtn.disabled = true;

  try {
    const payload = {
      event: state.currentEventId,
      template: state.currentEventMeta.template,
      title,
      createdBy: state.nickname,
      members: state.currentEventMeta.template === "vikings" ? [state.nickname] : [],
      limit,
      created: Date.now()
    };

    if (state.currentEventMeta.template === "ruins") {
      payload.timeKST = timeKST;
      payload.timeUTC = timeUTC;
    }

    await db.collection("parties").add(payload);

    document.getElementById("partyTitleInput").value = "";
    document.getElementById("timeKSTInput").value = "";
    document.getElementById("timeUTCInput").value = "";
    document.getElementById("partyLimitInput").value = state.currentEventMeta.defaultLimit || 6;
  } catch (error) {
    console.error(error);
    alert("파티 생성 중 오류가 발생했습니다.");
  } finally {
    state.createBusy = false;
    updateCreateBox();
  }
}

async function joinParty(partyId) {
  if (!state.currentEventId) return;

  try {
    const existingSnap = await db.collection("parties")
      .where("event", "==", state.currentEventId)
      .where("members", "array-contains", state.nickname)
      .get();

    const otherParty = existingSnap.docs.find((doc) => doc.id !== partyId);
    if (otherParty) {
      alert("이 이벤트에는 이미 참여 중인 파티가 있습니다.");
      return;
    }

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

    await ref.update({
      members: firebase.firestore.FieldValue.arrayRemove(state.nickname)
    });
  } catch (error) {
    console.error(error);
    alert("취소 처리 중 오류가 발생했습니다.");
  }
}

async function deleteParty(partyId) {
  const party = state.currentParties.find((item) => item.id === partyId);
  if (!party) return;

  const isCreator = party.createdBy === state.nickname;
  const isAdmin = state.admins.has(state.nickname);

  if (!isCreator && !isAdmin) {
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
          ${joined.length ? joined.map((user) => `<div class="userChip userChipJoined">${escapeHtml(user)}</div>`).join("") : `<div class="emptyUsers">참여자가 없습니다.</div>`}
        </div>
      </div>

      <div class="userSection">
        <div class="userSectionTitle">미참여 (${notJoined.length})</div>
        <div class="userGrid">
          ${notJoined.length ? notJoined.map((user) => `<div class="userChip userChipIdle">${escapeHtml(user)}</div>`).join("") : `<div class="emptyUsers">모든 유저가 참여 중입니다.</div>`}
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
