(() => {
  const db = firebase.firestore();
  const FV = firebase.firestore.FieldValue;
  const CARD_BASE = "./cards/";
  const rooms = () => db.collection("events").doc("dalmuti").collection("rooms");

  const RANKS = [
    { rank: 1, name: "사바나", image: "card-01-sabana.png" },
    { rank: 2, name: "세자", image: "card-02-prince.png" },
    { rank: 3, name: "영의정", image: "card-03-yeonguijeong.png" },
    { rank: 4, name: "관찰사", image: "card-04-governor.png" },
    { rank: 5, name: "암행어사", image: "card-05-amhaeng.png" },
    { rank: 6, name: "사또", image: "card-06-satto.png" },
    { rank: 7, name: "이방", image: "card-07-ibang.png" },
    { rank: 8, name: "포졸", image: "card-08-pojol.png" },
    { rank: 9, name: "선비", image: "card-09-seonbi.png" },
    { rank: 10, name: "상인", image: "card-10-merchant.png" },
    { rank: 11, name: "농민", image: "card-11-farmer.png" },
    { rank: 12, name: "노비", image: "card-12-nobi.png" },
    { rank: 13, name: "홍길동", image: "card-j-hong.png" }
  ];

  let roomId = "";
  let room = null;
  let parts = [];
  let unsubRoom = null;
  let unsubParts = null;
  let lastRenderKey = "";
  let cleanKickBusy = false;

  const myUid = () => String(localStorage.getItem("partyAppUser") || "").trim();
  const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
  const rankInfo = (rank) => RANKS.find((r) => r.rank === Number(rank)) || RANKS[RANKS.length - 1];
  const cardImg = (rank) => CARD_BASE + rankInfo(rank).image;

  function installCss() {
    if (document.getElementById("dalmutiPcCleanupCss")) return;
    const style = document.createElement("style");
    style.id = "dalmutiPcCleanupCss";
    style.textContent = `
      @media (min-width: 881px){
        .center-pile.rework-center{width:720px!important;max-width:72%!important;height:360px!important;min-height:360px!important;}
        .rework-prev{width:160px!important;min-height:158px!important;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;}
        .rework-prev-label{font-size:12px!important;margin-bottom:8px!important;color:#aeb5c3!important;font-weight:900!important;}
        .rework-prev-name,.rework-prev .rework-count{display:none!important;}
        .rework-prev .rework-cards{width:100%;height:112px;display:flex;align-items:center;justify-content:center;}
        .rework-prev .rework-card{width:82px!important;margin-left:0!important;border-radius:10px!important;}
        .rework-prev .rework-card:not(:first-child){display:none!important;}
        .rework-current-name{font-size:14px!important;margin-bottom:12px!important;}
        .rework-current .rework-count{display:none!important;}
        .rework-current .rework-card{width:132px!important;margin-left:-38px!important;}
        .rework-current .rework-card:first-child{margin-left:0!important;}
        .kick-btn{font-size:10px!important;padding:3px 6px!important;}
      }
    `;
    document.head.appendChild(style);
  }

  function oneCardHtml(cards = []) {
    const first = (cards || [])[0];
    if (!first) return `<span class="muted">없음</span>`;
    return `<img class="rework-card" src="${cardImg(first.rank)}" alt="${esc(first.name || rankInfo(first.rank).name)}">`;
  }

  function currentCardsHtml(cards = []) {
    const list = cards || [];
    if (!list.length) return `<span class="muted">제출 대기</span>`;
    return list.map((c) => `<img class="rework-card" src="${cardImg(c.rank)}" alt="${esc(c.name || rankInfo(c.rank).name)}">`).join("");
  }

  function setName(set, prefix) {
    if (!set) return `${prefix} 없음`;
    return `${prefix} ${rankInfo(set.effectiveRank).name} ${set.count}장`;
  }

  function renderCleanPile(force = false) {
    const el = document.getElementById("centerPile");
    if (!el || !room || room.status === "tributeReturn") return;
    const prev = room.previousSet || null;
    const cur = room.currentSet || null;
    const key = JSON.stringify({
      status: room.status,
      prev: prev ? { uid: prev.uid, rank: prev.effectiveRank, count: prev.count, ids: (prev.cards || []).map((c) => c.id).join(",") } : null,
      cur: cur ? { uid: cur.uid, rank: cur.effectiveRank, count: cur.count, ids: (cur.cards || []).map((c) => c.id).join(",") } : null
    });
    if (!force && key === lastRenderKey && el.dataset.cleanPile === "true") return;
    lastRenderKey = key;
    el.dataset.cleanPile = "true";
    el.classList.add("pc-fixed", "rework-center");
    if (!prev && !cur) {
      el.innerHTML = `<div class="rework-pile"><div class="rework-empty">새 판</div></div>`;
      return;
    }
    el.innerHTML = `
      <div class="rework-pile">
        <div class="rework-prev">
          <div class="rework-prev-label">직전 카드</div>
          <div class="rework-cards">${prev ? oneCardHtml(prev.cards) : `<span class="muted">없음</span>`}</div>
        </div>
        <div class="rework-current">
          <div class="rework-current-name">${esc(setName(cur, "현재"))}</div>
          <div class="rework-cards">${cur ? currentCardsHtml(cur.cards) : `<span class="muted">제출 대기</span>`}</div>
        </div>
      </div>
    `;
  }

  function observePileConflicts() {
    const el = document.getElementById("centerPile");
    if (!el || el.dataset.cleanupObserverBound) return;
    el.dataset.cleanupObserverBound = "true";
    const observer = new MutationObserver(() => {
      if (!room || room.status === "tributeReturn") return;
      if (el.dataset.cleanPile !== "true") {
        requestAnimationFrame(() => renderCleanPile(true));
      }
    });
    observer.observe(el, { childList: true, subtree: false });
  }

  async function markKickAsRemoved(uid, nickname) {
    if (!roomId || !room || room.hostUid !== myUid() || !uid || cleanKickBusy) return;
    cleanKickBusy = true;
    try {
      const ref = rooms().doc(roomId);
      await ref.collection("participants").doc(uid).set({
        kicked: true,
        removedFromRoom: true,
        type: "spectator",
        hand: [],
        cardCount: 0,
        forfeited: true,
        finished: true,
        updatedAt: FV.serverTimestamp()
      }, { merge: true });
      await ref.collection("messages").add({
        type: "system",
        text: `${nickname || uid}님이 방에서 내보내졌습니다.`,
        createdAt: FV.serverTimestamp()
      }).catch(() => null);
    } finally {
      cleanKickBusy = false;
    }
  }

  function patchKickButtons() {
    if (!room || room.hostUid !== myUid()) return;
    Array.from(document.querySelectorAll(".player-box .kick-btn")).forEach((btn) => {
      if (btn.dataset.cleanupKickBound) return;
      btn.dataset.cleanupKickBound = "true";
      btn.addEventListener("click", (e) => {
        const box = btn.closest(".player-box");
        const nick = box?.querySelector(".player-name")?.textContent.trim();
        const p = parts.find((x) => x.nickname === nick);
        if (!p || p.uid === myUid()) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!confirm(`${p.nickname}님을 방에서 내보낼까요?`)) return;
        markKickAsRemoved(p.uid, p.nickname).catch(console.error);
      }, true);
    });
  }

  function handleKickedMe() {
    const uid = myUid();
    if (!uid || !roomId) return;
    const me = parts.find((p) => p.uid === uid);
    if (!me || !me.removedFromRoom) return;
    localStorage.removeItem("dalmutiCurrentRoomId");
    alert("방장에 의해 방에서 내보내졌습니다.");
    location.reload();
  }

  function hideRemovedPlayers() {
    Array.from(document.querySelectorAll(".player-box")).forEach((box) => {
      const nick = box.querySelector(".player-name")?.textContent.trim();
      const p = parts.find((x) => x.nickname === nick);
      if (p?.removedFromRoom) box.style.display = "none";
    });
  }

  function bind(id) {
    if (id === roomId) return;
    if (unsubRoom) unsubRoom();
    if (unsubParts) unsubParts();
    roomId = id;
    room = null;
    parts = [];
    lastRenderKey = "";
    if (!roomId) return;
    const ref = rooms().doc(roomId);
    unsubRoom = ref.onSnapshot((snap) => {
      room = snap.exists ? { id: snap.id, ...snap.data() } : null;
      renderCleanPile(true);
    }, console.error);
    unsubParts = ref.collection("participants").onSnapshot((snap) => {
      parts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      handleKickedMe();
    }, console.error);
  }

  function tick() {
    installCss();
    bind(localStorage.getItem("dalmutiCurrentRoomId") || "");
    observePileConflicts();
    renderCleanPile();
    patchKickButtons();
    hideRemovedPlayers();
  }

  window.addEventListener("DOMContentLoaded", () => {
    installCss();
    setInterval(tick, 160);
  });
})();
