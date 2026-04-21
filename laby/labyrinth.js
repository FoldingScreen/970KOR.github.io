/* =========================
   LABYRINTH MODULE
========================= */

function hideEscapeLabyrinthViews() {
  el.escapeLabyrinthScreen?.classList.add("hidden");
  el.labyrinthHomeView?.classList.add("hidden");
  el.labyrinthDetailView?.classList.add("hidden");
}

function showEscapeLabyrinthRoot() {
  el.partyList?.classList.add("hidden");
  el.escapeLabyrinthScreen?.classList.remove("hidden");
}

function subscribeEscapeLabyrinthHome() {
  clearSubscriptions();

  state.currentLabyrinthId = "";
  state.currentLabyrinthData = null;
  state.currentLabyrinthStages = [];
  state.currentLabyrinthPlayer = null;
  state.currentLabyrinthPlayers = [];

  showEscapeLabyrinthRoot();
  openEscapeLabyrinthHome(true);

  state.unsubscribeLabyrinths = labyrinthsRef().onSnapshot(snap => {
    state.labyrinths = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    renderLabyrinthHome();
  });
}

function openEscapeLabyrinthHome(skip = false) {
  state.currentLabyrinthId = "";
  state.currentLabyrinthData = null;

  showEscapeLabyrinthRoot();

  el.labyrinthHomeView?.classList.remove("hidden");
  el.labyrinthDetailView?.classList.add("hidden");

  if (!skip) renderLabyrinthHome();
}

window.openEscapeLabyrinthHome = openEscapeLabyrinthHome;

function renderLabyrinthHome() {
  if (!el.publicLabyrinthList) return;

  const list = state.labyrinths || [];

  el.publicLabyrinthList.innerHTML = list.length
    ? list.map(l => `
        <div class="labyrinth-card">
          <h3>${escapeHtml(l.title || "무제")}</h3>
          <p>${escapeHtml(l.description || "")}</p>
          <button onclick="openLabyrinthDetail('${l.id}')">입장</button>
        </div>
      `).join("")
    : `<div class="labyrinth-empty">없음</div>`;
}

function openLabyrinthDetail(id) {
  const item = state.labyrinths.find(v => v.id === id);
  if (!item) return;

  state.currentLabyrinthId = id;
  state.currentLabyrinthData = item;

  showEscapeLabyrinthRoot();

  el.labyrinthHomeView?.classList.add("hidden");
  el.labyrinthDetailView?.classList.remove("hidden");

  renderLabyrinthDetail();
}

window.openLabyrinthDetail = openLabyrinthDetail;

function renderLabyrinthDetail() {
  const item = state.currentLabyrinthData;
  if (!item) return;

  el.labyrinthDetailTitle.textContent = item.title || "미궁";
  el.labyrinthDetailDescription.textContent = item.description || "";
}
