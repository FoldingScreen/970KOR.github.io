async function ensureEventDocs() {
  for (const e of state.events) {
    const ref = eventRef(e.id);
    const snap = await ref.get();
    const payload = { name: e.name, desc: e.desc };

    if (!snap.exists && e.id === "rearrange") {
      payload.rankingPublic = false;
      payload.rearrangeInputEnabled = false;
    }

    await ref.set(payload, { merge: true });
  }
}

async function ensureUserDoc(name) {
  await db.collection("users").doc(name).set(
    {
      nickname: name,
      lastLoginAt: firebase.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );
}

async function refreshAdmin() {
  if (!state.currentUser) {
    state.isAdmin = false;
    updateUserBadge();
    updateEventActionButtons();
    return;
  }

  state.isAdmin = (await db.collection("admins").doc(state.currentUser).get()).exists;
  updateUserBadge();
  updateEventActionButtons();
}

async function writeAdminLog(action, payload) {
  if (!state.isAdmin) return;

  await db.collection("adminLogs").add({
    action,
    payload: payload || {},
    event: state.currentEventId || "",
    admin: state.currentUser,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    undone: false
  });
}

function initRuinsSelects() {
  if (!el.utcMonth || !el.utcDay || !el.utcHour) return;
  if (el.utcMonth.options.length || el.utcDay.options.length || el.utcHour.options.length) return;

  for (let i = 1; i <= 12; i++) {
    el.utcMonth.insertAdjacentHTML("beforeend", `<option value="${i}">${i}월</option>`);
  }

  for (let i = 1; i <= 31; i++) {
    el.utcDay.insertAdjacentHTML("beforeend", `<option value="${i}">${i}일</option>`);
  }

  for (let i = 0; i <= 23; i++) {
    el.utcHour.insertAdjacentHTML(
      "beforeend",
      `<option value="${i}">${String(i).padStart(2, "0")}:00</option>`
    );
  }
}

function ensureHolySwordFields() {
  const wrap = document.getElementById("holySwordSideWrap");
  if (wrap && !document.getElementById("holySwordSideSelect")) {
    wrap.innerHTML = `
      <label>소속</label>
      <select id="holySwordSideSelect">
        <option value="KOR">본연맹(KOR)</option>
        <option value="KR1">아카데미(KR1)</option>
      </select>
    `;
  }
}

function ensureRankingExtraFields() {
  if (!document.getElementById("rankEditExistingWrap")) {
    const noteInput = el.rankEditNoteInput;

    if (noteInput && noteInput.parentElement) {
      const wrap = document.createElement("div");
      wrap.className = "form-group";
      wrap.id = "rankEditExistingWrap";
      wrap.innerHTML = `
        <label for="rankEditExistingInput">기존</label>
        <input id="rankEditExistingInput" class="text-input" type="number" min="1" step="1" placeholder="예: 3">
      `;
      noteInput.parentElement.insertAdjacentElement("afterend", wrap);
    }
  }

  if (!document.getElementById("rankEditExcludeBtnWrap")) {
    const existingWrap = document.getElementById("rankEditExistingWrap");

    if (existingWrap) {
      const wrap = document.createElement("div");
      wrap.className = "form-group";
      wrap.id = "rankEditExcludeBtnWrap";
      wrap.innerHTML = `<button type="button" id="rankEditExcludeBtn" class="text-input">목록에서 제외</button>`;
      existingWrap.insertAdjacentElement("afterend", wrap);
    }
  }
}

function getNicknameValue() {
  const direct = el.nicknameInput && typeof el.nicknameInput.value === "string"
    ? el.nicknameInput.value
    : "";

  const byId1 = document.getElementById("nicknameInput")?.value || "";
  const byId2 = document.getElementById("nickname")?.value || "";
  const active = document.activeElement && typeof document.activeElement.value === "string"
    ? document.activeElement.value
    : "";

  return String(direct || byId1 || byId2 || active || "").trim();
}

async function login() {
  try {
    const name = getNicknameValue();

    if (!name) {
      alert("닉네임을 입력하세요.");
      el.nicknameInput?.focus();
      return;
    }

    state.currentUser = name;
    if (el.nicknameInput) el.nicknameInput.value = name;

    localStorage.setItem("partyAppUser", name);

    await ensureUserDoc(name);
    await refreshAdmin();
    await ensureEventDocs();
    goHome();
  } catch (e) {
    console.error(e);
    alert("로그인 중 오류가 발생했습니다.");
    showOnly("login");
  }
}

if (el.nicknameInput) {
  el.nicknameInput.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      login();
    }
  });
}

window.login = login;

async function logout() {
  clearSubscriptions();

  state.currentUser = "";
  state.currentEventId = "";
  state.isAdmin = false;
  state.parties = [];
  state.rearrangeEntries = [];
  state.rearrangeProgressEntries = [];
  state.rearrangeRankingMap = {};
  state.rearrangePublic = false;
  state.editingRuinsPartyId = "";
  state.editingRearrangeRankUser = "";
  state.editingHolySwordPartyId = "";
  state.labyrinths = [];
  state.labyrinthPlayerSummaryMap = {};
  state.currentLabyrinthId = "";
  state.currentLabyrinthData = null;
  state.currentLabyrinthStages = [];
  state.currentLabyrinthPlayer = null;
  state.currentLabyrinthPlayers = [];
  state.editingLabyrinthId = "";
  state.editingStageId = "";

  localStorage.removeItem("partyAppUser");
  localStorage.removeItem("partyAppEvent");

  updateUserBadge();
  updateEventActionButtons();
  showOnly("login");
  setTopTabs("");
}

window.logout = logout;

async function tryAutoLogin() {
  try {
    initRuinsSelects();
    ensureRankingExtraFields();
    ensureHolySwordFields();
    updateUserBadge();
    updateEventActionButtons();
    showOnly("login");

    const savedUser = localStorage.getItem("partyAppUser");
    if (!savedUser) return;

    state.currentUser = savedUser;
    await ensureUserDoc(savedUser);
    await refreshAdmin();
    await ensureEventDocs();

    const savedEvent = localStorage.getItem("partyAppEvent");
    if (savedEvent) openEvent(savedEvent);
    else goHome();
  } catch (e) {
    console.error(e);
    updateUserBadge();
    updateEventActionButtons();
    showOnly("login");
  }
}

async function renderHomeSummary() {
  const usersSnap = await db.collection("users").get();
  const adminsSnap = await db.collection("admins").get();

  el.homeSummary.innerHTML =
    `<div class="summary-card"><div class="muted">전체 유저</div><div class="big-number">${usersSnap.size}</div></div>` +
    `<div class="summary-card"><div class="muted">이벤트 수</div><div class="big-number">${state.events.length}</div></div>` +
    `<div class="summary-card"><div class="muted">운영진 수</div><div class="big-number">${adminsSnap.size}</div></div>`;
}

function renderHomeEventCards() {
  el.homeEventCards.innerHTML = state.events.map(e => `
    <div class="event-card">
      <h3>${escapeHtml(e.name)}</h3>
      <p>${escapeHtml(e.desc)}</p>
      <div class="actions">
        <button onclick="openEvent('${escapeJs(e.id)}')">들어가기</button>
      </div>
    </div>
  `).join("");
}

async function goHome() {
  clearSubscriptions();

  state.currentEventId = "";
  state.currentLabyrinthId = "";
  state.currentLabyrinthData = null;
  state.currentLabyrinthStages = [];
  state.currentLabyrinthPlayer = null;
  state.currentLabyrinthPlayers = [];

  localStorage.removeItem("partyAppEvent");

  setTopTabs("home");
  updateEventActionButtons();
  renderHomeEventCards();
  await renderHomeSummary();
  showOnly("home");
}

window.goHome = goHome;

function updateEventActionButtons() {
  if (
    !el.createPartyBtn ||
    !el.rearrangeEditBtn ||
    !el.rearrangePublicBtn ||
    !el.rearrangeManageBtn ||
    !el.createLabyrinthBtn ||
    !el.backToLabyrinthListBtn
  ) {
    return;
  }

  el.createPartyBtn.classList.add("hidden");
  el.rearrangeEditBtn.classList.add("hidden");
  el.rearrangePublicBtn.classList.add("hidden");
  el.rearrangeManageBtn.classList.add("hidden");
  el.createLabyrinthBtn.classList.add("hidden");
  el.backToLabyrinthListBtn.classList.add("hidden");

  const canToggleRearrangePublic = state.currentUser === "병풍";

  if (state.currentEventId === "viking") {
    el.createPartyBtn.classList.remove("hidden");
    el.createPartyBtn.textContent = "파티 생성";
    el.createPartyBtn.onclick = createParty;
  }

  if (state.currentEventId === "ruins") {
    el.createPartyBtn.classList.remove("hidden");
    el.createPartyBtn.textContent = "유적 파티 생성";
    el.createPartyBtn.onclick = createParty;
  }

  if (state.currentEventId === "holy_sword") {
    el.createPartyBtn.classList.remove("hidden");
    el.createPartyBtn.textContent = "성검 파티 생성";
    el.createPartyBtn.onclick = createParty;
  }

  if (state.currentEventId === "triple_alliance") {
    el.createPartyBtn.classList.remove("hidden");
    el.createPartyBtn.textContent = "삼대 연맹전 생성";
    el.createPartyBtn.onclick = createParty;
  }

  if (state.currentEventId === "rearrange") {
    el.rearrangeEditBtn.classList.remove("hidden");

    if (state.rearrangeInputEnabled) {
      el.rearrangeEditBtn.textContent = "내 진척도 입력";
      el.rearrangeEditBtn.onclick = openMyRearrangeModal;
    } else {
      el.rearrangeEditBtn.textContent = "입력 일시중지";
      el.rearrangeEditBtn.onclick = () => alert("현재 혼란 방지를 위해 개인 진척도 입력이 일시적으로 중지되어 있습니다.");
    }

    if (state.isAdmin && canToggleRearrangePublic) {
      el.rearrangePublicBtn.classList.remove("hidden");
      el.rearrangePublicBtn.textContent = state.rearrangePublic ? "순위 비공개" : "순위 공개";
      el.rearrangePublicBtn.onclick = toggleRearrangePublic;

      el.rearrangeManageBtn.classList.remove("hidden");
      el.rearrangeManageBtn.textContent = state.rearrangeInputEnabled ? "입력 비활성화" : "입력 활성화";
      el.rearrangeManageBtn.onclick = toggleRearrangeInputEnabled;
    }
  }

  if (state.currentEventId === "escape_labyrinth") {
    if (state.currentLabyrinthId) {
      el.backToLabyrinthListBtn.classList.remove("hidden");
      el.backToLabyrinthListBtn.textContent = "목록으로";
      el.backToLabyrinthListBtn.onclick = openEscapeLabyrinthHome;
    } else {
      el.createLabyrinthBtn.classList.remove("hidden");
      el.createLabyrinthBtn.textContent = "미궁 제작하기";
      el.createLabyrinthBtn.onclick = openCreateLabyrinthModal;
    }
  }
}

async function openEvent(id) {
  state.currentEventId = id;
  localStorage.setItem("partyAppEvent", id);

  setTopTabs(id);

  const meta = state.events.find(v => v.id === id);
  el.eventTitle.textContent = meta ? meta.name : id;
  el.eventDesc.textContent = meta ? meta.desc : "";

  updateEventActionButtons();
  showOnly("event");

  if (id === "escape_labyrinth") {
    subscribeEscapeLabyrinthHome();
    return;
  }

  if (el.partyList) el.partyList.classList.remove("hidden");
  if (el.escapeLabyrinthScreen) el.escapeLabyrinthScreen.classList.add("hidden");

  if (id === "rearrange") subscribeRearrange();
  else subscribeParties();
}

window.openEvent = openEvent;

document.addEventListener("DOMContentLoaded", tryAutoLogin);
