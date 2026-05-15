(() => {
  const db = firebase.firestore();
  const rooms = () => db.collection("events").doc("dalmuti").collection("rooms");

  let roomId = "";
  let room = null;
  let parts = [];
  let unsubRoom = null;
  let unsubParts = null;

  function installCss() {
    if (document.getElementById("dalmutiResultSpectatorCss")) return;
    const style = document.createElement("style");
    style.id = "dalmutiResultSpectatorCss";
    style.textContent = `
      #roundResultPanel,#finalResultPanel,#spectatorPanel{margin-top:14px;}
      .dalmuti-result-box{border:1px solid rgba(243,210,129,.28);background:rgba(13,19,32,.72);border-radius:16px;padding:12px;}
      .dalmuti-result-title{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;font-weight:900;color:#f3d281;}
      .dalmuti-result-table{display:grid;gap:6px;}
      .dalmuti-result-row{display:grid;grid-template-columns:46px minmax(0,1fr) 56px 74px;gap:8px;align-items:center;padding:8px 9px;border-radius:12px;background:rgba(255,255,255,.045);font-size:13px;}
      .dalmuti-result-row.header{background:transparent;color:#aeb5c3;font-size:12px;font-weight:900;padding-top:2px;padding-bottom:2px;}
      .dalmuti-result-rank{font-weight:900;color:#f3d281;}
      .dalmuti-result-name{font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .dalmuti-result-role{color:#aeb5c3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .dalmuti-result-score{font-weight:900;text-align:right;}
      .dalmuti-final-winner{border:1px solid rgba(243,210,129,.55);background:rgba(243,210,129,.1);}
      .spectator-list{display:flex;gap:6px;flex-wrap:wrap;min-height:30px;}
      .spectator-chip{font-size:12px;color:#d8deea;border:1px solid rgba(174,181,195,.28);background:rgba(255,255,255,.045);border-radius:999px;padding:5px 8px;}
      .spectator-empty{color:#aeb5c3;font-size:13px;}
    `;
    document.head.appendChild(style);
  }

  function esc(v) {
    return String(v ?? "").replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
  }

  function players() {
    return parts.filter((p) => p.type === "player");
  }

  function spectators() {
    return parts.filter((p) => p.type === "spectator").sort((a, b) => String(a.nickname || "").localeCompare(String(b.nickname || ""), "ko"));
  }

  function scoreSorted() {
    return players().slice().sort((a, b) => {
      const s = Number(b.score || 0) - Number(a.score || 0);
      if (s !== 0) return s;
      return (a.lastRoundRank ?? a.seatOrder ?? 999) - (b.lastRoundRank ?? b.seatOrder ?? 999);
    });
  }

  function roundSorted() {
    return players().slice().sort((a, b) => {
      return (a.lastRoundRank ?? a.finishedRank ?? 999) - (b.lastRoundRank ?? b.finishedRank ?? 999);
    });
  }

  function cumulativeRankRows(list) {
    let prevScore = null;
    let currentRank = 0;
    return list.map((p, idx) => {
      const score = Number(p.score || 0);
      if (prevScore === null || score !== prevScore) currentRank = idx + 1;
      prevScore = score;
      return { ...p, cumulativeRank: currentRank };
    });
  }

  function ensurePanel(id, titleText, afterEl) {
    let panel = document.getElementById(id);
    if (panel) return panel;
    panel = document.createElement("section");
    panel.id = id;
    panel.className = "dalmuti-result-box";
    panel.innerHTML = `<div class="dalmuti-result-title"><span>${titleText}</span></div><div class="dalmuti-result-body"></div>`;
    if (afterEl && afterEl.parentNode) afterEl.parentNode.insertBefore(panel, afterEl.nextSibling);
    else {
      const side = document.querySelector(".side-panel");
      if (side) side.appendChild(panel);
      else document.body.appendChild(panel);
    }
    return panel;
  }

  function renderSpectators() {
    const scoreList = document.getElementById("scoreList");
    const panel = ensurePanel("spectatorPanel", "관전자", scoreList?.parentElement || scoreList);
    const body = panel.querySelector(".dalmuti-result-body");
    const list = spectators();
    body.innerHTML = list.length
      ? `<div class="spectator-list">${list.map((p) => `<span class="spectator-chip">${esc(p.nickname || "-")}</span>`).join("")}</div>`
      : `<div class="spectator-empty">관전자가 없습니다.</div>`;
  }

  function renderRoundResult() {
    const scoreList = document.getElementById("scoreList");
    const panel = ensurePanel("roundResultPanel", "라운드 결과", scoreList?.parentElement || scoreList);
    const body = panel.querySelector(".dalmuti-result-body");

    if (!room || !["betweenRounds", "finished"].includes(room.status) || !room.lastRoundResult) {
      panel.style.display = "none";
      return;
    }

    panel.style.display = "block";
    const rows = roundSorted();
    body.innerHTML = `
      <div class="dalmuti-result-table">
        <div class="dalmuti-result-row header"><span>순위</span><span>닉네임</span><span>획득</span><span>다음 계급</span></div>
        ${rows.map((p) => `
          <div class="dalmuti-result-row">
            <span class="dalmuti-result-rank">${p.lastRoundRank || p.finishedRank || "-"}등</span>
            <span class="dalmuti-result-name">${esc(p.nickname || "-")}</span>
            <span class="dalmuti-result-score">+${Number(p.lastRoundScore || 0)}</span>
            <span class="dalmuti-result-role">${esc(p.role || "-")}</span>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderFinalResult() {
    const scoreList = document.getElementById("scoreList");
    const panel = ensurePanel("finalResultPanel", "최종 결과", document.getElementById("roundResultPanel") || scoreList?.parentElement || scoreList);
    const body = panel.querySelector(".dalmuti-result-body");

    if (!room || room.status !== "finished") {
      panel.style.display = "none";
      return;
    }

    panel.style.display = "block";
    const rows = cumulativeRankRows(scoreSorted());
    body.innerHTML = `
      <div class="dalmuti-result-table">
        <div class="dalmuti-result-row header"><span>순위</span><span>닉네임</span><span>총점</span><span>계급</span></div>
        ${rows.map((p) => `
          <div class="dalmuti-result-row ${p.cumulativeRank === 1 ? "dalmuti-final-winner" : ""}">
            <span class="dalmuti-result-rank">${p.cumulativeRank}등</span>
            <span class="dalmuti-result-name">${esc(p.nickname || "-")}</span>
            <span class="dalmuti-result-score">${Number(p.score || 0)}</span>
            <span class="dalmuti-result-role">${esc(p.role || "-")}</span>
          </div>
        `).join("")}
      </div>
    `;
  }

  function render() {
    installCss();
    renderSpectators();
    renderRoundResult();
    renderFinalResult();
  }

  function bind(id) {
    if (id === roomId) return;
    if (unsubRoom) unsubRoom();
    if (unsubParts) unsubParts();
    roomId = id;
    room = null;
    parts = [];
    render();
    if (!roomId) return;
    const ref = rooms().doc(roomId);
    unsubRoom = ref.onSnapshot((snap) => {
      room = snap.exists ? { id: snap.id, ...snap.data() } : null;
      render();
    }, console.error);
    unsubParts = ref.collection("participants").onSnapshot((snap) => {
      parts = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      render();
    }, console.error);
  }

  window.addEventListener("DOMContentLoaded", () => {
    installCss();
    bind(localStorage.getItem("dalmutiCurrentRoomId") || "");
    setInterval(() => bind(localStorage.getItem("dalmutiCurrentRoomId") || ""), 800);
    setInterval(render, 1000);
  });
})();
