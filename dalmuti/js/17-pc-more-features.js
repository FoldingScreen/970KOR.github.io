(() => {
  const db = firebase.firestore();
  const FV = firebase.firestore.FieldValue;
  const rooms = () => db.collection("events").doc("dalmuti").collection("rooms");

  const RANKS = [
    { rank: 1, name: "사바나", count: 1 },
    { rank: 2, name: "세자", count: 2 },
    { rank: 3, name: "영의정", count: 3 },
    { rank: 4, name: "관찰사", count: 4 },
    { rank: 5, name: "암행어사", count: 5 },
    { rank: 6, name: "사또", count: 6 },
    { rank: 7, name: "이방", count: 7 },
    { rank: 8, name: "포졸", count: 8 },
    { rank: 9, name: "선비", count: 9 },
    { rank: 10, name: "상인", count: 10 },
    { rank: 11, name: "농민", count: 11 },
    { rank: 12, name: "노비", count: 12 }
  ];

  let roomId = "";
  let room = null;
  let parts = [];
  let unsubRoom = null;
  let unsubParts = null;
  let busy = false;

  const myUid = () => String(localStorage.getItem("partyAppUser") || "").trim();
  const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
  const sortHand = (cards = []) => cards.slice().sort((a, b) => a.rank - b.rank || String(a.id).localeCompare(String(b.id)));
  const tsFromMs = (ms) => firebase.firestore.Timestamp.fromMillis(ms);
  const maxRankForCount = (count) => count <= 3 ? 8 : count <= 5 ? 10 : 12;
  const playersSorted = () => parts.filter((p) => p.type === "player").sort((a, b) => (a.lastRoundRank ?? a.finishedRank ?? a.seatOrder ?? 999) - (b.lastRoundRank ?? b.finishedRank ?? b.seatOrder ?? 999));

  function roleByIndex(i, count) {
    const map = {
      2: ["사바나", "노비"],
      3: ["사바나", "농민", "노비"],
      4: ["사바나", "세자", "농민", "노비"],
      5: ["사바나", "세자", "사또", "농민", "노비"],
      6: ["사바나", "세자", "암행어사", "사또", "농민", "노비"],
      7: ["사바나", "세자", "관찰사", "암행어사", "사또", "농민", "노비"],
      8: ["사바나", "세자", "영의정", "관찰사", "암행어사", "사또", "농민", "노비"]
    };
    return (map[count] || [])[i] || `${i + 1}등`;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function makeDeck(count) {
    const max = maxRankForCount(count);
    const deck = [];
    RANKS.filter((r) => r.rank <= max).forEach((r) => {
      for (let i = 1; i <= r.count; i += 1) deck.push({ id: `r${r.rank}-${i}-${Math.random().toString(36).slice(2, 8)}`, rank: r.rank, name: r.name });
    });
    for (let i = 1; i <= 2; i += 1) deck.push({ id: `j-${i}-${Math.random().toString(36).slice(2, 8)}`, rank: 13, name: "홍길동", joker: true });
    return shuffle(deck);
  }

  function bestTribute(hand, count) {
    return sortHand(hand || []).filter((c) => !c.joker && c.rank !== 13).slice(0, count);
  }

  function makeTributePairs(ps, hands) {
    if (ps.length < 3) return [];
    const specs = ps.length === 3
      ? [{ from: ps[2], to: ps[0], count: 1 }]
      : [
        { from: ps[ps.length - 1], to: ps[0], count: 2 },
        { from: ps[ps.length - 2], to: ps[1], count: 1 }
      ];
    return specs.map((x, idx) => {
      const cards = bestTribute(hands[x.from.uid], x.count);
      const ids = new Set(cards.map((c) => c.id));
      hands[x.from.uid] = sortHand(hands[x.from.uid].filter((c) => !ids.has(c.id)));
      hands[x.to.uid] = sortHand(hands[x.to.uid].concat(cards));
      return {
        id: `tribute-${idx}`,
        fromUid: x.from.uid,
        fromNickname: x.from.nickname,
        toUid: x.to.uid,
        toNickname: x.to.nickname,
        count: cards.length,
        cards,
        returned: cards.length === 0,
        returnedCards: []
      };
    }).filter((p) => p.count > 0);
  }

  function forceDoubleHong(hands, targetUid) {
    if (!targetUid || !hands[targetUid]) return;
    let jokers = [];
    Object.keys(hands).forEach((uid) => {
      const keep = [];
      hands[uid].forEach((card) => {
        if ((card.joker || card.rank === 13) && jokers.length < 2) jokers.push(card);
        else keep.push(card);
      });
      hands[uid] = keep;
    });
    while (jokers.length < 2) {
      jokers.push({ id: `j-force-${jokers.length + 1}-${Math.random().toString(36).slice(2, 8)}`, rank: 13, name: "홍길동", joker: true });
    }
    const needed = 2;
    const lowestHand = hands[targetUid];
    const throwAway = lowestHand.filter((c) => !(c.joker || c.rank === 13)).sort((a, b) => b.rank - a.rank).slice(0, needed);
    const throwIds = new Set(throwAway.map((c) => c.id));
    hands[targetUid] = lowestHand.filter((c) => !throwIds.has(c.id)).concat(jokers.slice(0, 2));
    const donors = Object.keys(hands).filter((uid) => uid !== targetUid);
    throwAway.forEach((card, i) => {
      const donor = donors[i % Math.max(1, donors.length)] || targetUid;
      if (donor !== targetUid) hands[donor].push(card);
    });
    Object.keys(hands).forEach((uid) => { hands[uid] = sortHand(hands[uid]); });
  }

  function installCss() {
    if (document.getElementById("dalmutiMoreFeaturesCss")) return;
    const style = document.createElement("style");
    style.id = "dalmutiMoreFeaturesCss";
    style.textContent = `
      .dalmuti-extra-panel{margin-top:10px;border:1px solid rgba(255,255,255,.09);background:rgba(13,19,32,.62);border-radius:14px;padding:10px;}
      .dalmuti-extra-title{font-weight:900;color:#f3d281;margin-bottom:8px;}
      .dalmuti-setting-grid{display:grid;grid-template-columns:1fr 94px 88px;gap:8px;align-items:center;}
      .dalmuti-setting-grid .input{height:36px;}
      #forceRebellionBtn{margin-left:8px;}
      #dalmutiHelpModal{position:fixed;inset:0;z-index:160;display:none;background:rgba(0,0,0,.58);align-items:center;justify-content:center;padding:24px;}
      .dalmuti-help-card{width:min(760px,96vw);max-height:86vh;overflow:auto;background:#121827;border:1px solid rgba(243,210,129,.35);border-radius:22px;padding:20px;box-shadow:0 24px 70px rgba(0,0,0,.55);}
      .dalmuti-help-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px;}
      .dalmuti-help-head h2{margin:0;color:#f3d281;}
      .dalmuti-help-section{border-top:1px solid rgba(255,255,255,.09);padding-top:12px;margin-top:12px;line-height:1.55;color:#d8deea;font-size:14px;}
      .dalmuti-help-section strong{color:#f3d281;}
    `;
    document.head.appendChild(style);
  }

  function ensureHelp() {
    if (!document.getElementById("helpBtn")) {
      const btn = document.createElement("button");
      btn.id = "helpBtn";
      btn.className = "btn ghost";
      btn.type = "button";
      btn.textContent = "게임 방법";
      const top = document.querySelector(".top-actions");
      if (top) top.insertBefore(btn, top.firstChild);
      btn.addEventListener("click", () => showHelp());
    }
    if (document.getElementById("dalmutiHelpModal")) return;
    const modal = document.createElement("div");
    modal.id = "dalmutiHelpModal";
    modal.innerHTML = `
      <div class="dalmuti-help-card">
        <div class="dalmuti-help-head"><h2>사바나 달무티 게임 방법</h2><button id="helpCloseBtn" class="btn ghost small" type="button">닫기</button></div>
        <div class="dalmuti-help-section"><strong>목표</strong><br>손패를 먼저 털수록 높은 순위를 얻고, 라운드마다 순위에 따라 승점을 얻습니다.</div>
        <div class="dalmuti-help-section"><strong>카드 서열</strong><br>사바나가 가장 강하고, 노비가 가장 약합니다. 홍길동은 조커입니다.</div>
        <div class="dalmuti-help-section"><strong>제출 규칙</strong><br>같은 계급 카드 여러 장을 낼 수 있습니다. 이미 카드가 깔려 있으면 같은 장수이면서 더 높은 계급만 낼 수 있습니다.</div>
        <div class="dalmuti-help-section"><strong>홍길동</strong><br>일반 카드와 함께 내면 그 계급 카드로 취급합니다. 홍길동만 내면 최약 카드 취급입니다.</div>
        <div class="dalmuti-help-section"><strong>상납</strong><br>2라운드부터 하위 계급자가 상위 계급자에게 좋은 카드를 자동 상납합니다. 받은 사람은 같은 장수만큼 돌려줍니다.</div>
        <div class="dalmuti-help-section"><strong>민란</strong><br>농민 또는 노비가 홍길동 2장을 들면 상납 방향이 반대로 바뀝니다.</div>
        <div class="dalmuti-help-section"><strong>시간 제한</strong><br>새 판 시작자가 시간초과하면 가장 약한 카드 1장을 자동 제출하고, 일반 턴은 자동 패스합니다.</div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener("click", (e) => { if (e.target === modal) hideHelp(); });
    document.getElementById("helpCloseBtn").addEventListener("click", hideHelp);
  }

  function showHelp() {
    const modal = document.getElementById("dalmutiHelpModal");
    if (modal) modal.style.display = "flex";
  }

  function hideHelp() {
    const modal = document.getElementById("dalmutiHelpModal");
    if (modal) modal.style.display = "none";
  }

  function ensureSettingsPanel() {
    const lobby = document.getElementById("lobbyControls");
    if (!lobby) return;
    let panel = document.getElementById("roomSettingsPanel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "roomSettingsPanel";
      panel.className = "dalmuti-extra-panel hidden";
      panel.innerHTML = `
        <div class="dalmuti-extra-title">방 설정</div>
        <div class="dalmuti-setting-grid">
          <input id="roomSettingTitle" class="input" type="text" maxlength="24" placeholder="방 이름">
          <select id="roomSettingRounds" class="input"><option value="3">3판</option><option value="5">5판</option><option value="10">10판</option><option value="0">무제한</option></select>
          <select id="roomSettingTurn" class="input"><option value="15">15초</option><option value="30">30초</option></select>
        </div>
        <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
          <button id="saveRoomSettingsBtn" class="btn primary small" type="button">설정 저장</button>
          <button id="toggleSpectatorChatSettingBtn" class="btn ghost small" type="button">관전자 채팅</button>
        </div>
      `;
      lobby.parentElement.insertBefore(panel, lobby.nextSibling);
      document.getElementById("saveRoomSettingsBtn").addEventListener("click", saveRoomSettings);
      document.getElementById("toggleSpectatorChatSettingBtn").addEventListener("click", toggleSpectatorChat);
    }
  }

  function renderSettingsPanel() {
    ensureSettingsPanel();
    const panel = document.getElementById("roomSettingsPanel");
    if (!panel || !room) return;
    const isHost = room.hostUid === myUid();
    const show = isHost && room.status === "waiting";
    panel.classList.toggle("hidden", !show);
    if (!show) return;
    const title = document.getElementById("roomSettingTitle");
    const rounds = document.getElementById("roomSettingRounds");
    const turn = document.getElementById("roomSettingTurn");
    const chat = document.getElementById("toggleSpectatorChatSettingBtn");
    if (document.activeElement !== title) title.value = room.title || "";
    rounds.value = String(room.totalRounds || 0);
    turn.value = String(room.turnLimit || 15);
    chat.textContent = room.spectatorChatEnabled === false ? "관전자 채팅: 차단" : "관전자 채팅: 허용";
  }

  async function saveRoomSettings() {
    if (!roomId || !room || room.hostUid !== myUid() || room.status !== "waiting") return;
    const title = String(document.getElementById("roomSettingTitle")?.value || "").trim() || "사바나 달무티";
    const rawRounds = Number(document.getElementById("roomSettingRounds")?.value || 5);
    const turn = Number(document.getElementById("roomSettingTurn")?.value || 15);
    await rooms().doc(roomId).set({
      title,
      totalRounds: rawRounds === 0 ? null : rawRounds,
      turnLimit: turn,
      updatedAt: FV.serverTimestamp()
    }, { merge: true });
    await rooms().doc(roomId).collection("messages").add({ type: "system", text: "방 설정이 변경되었습니다.", createdAt: FV.serverTimestamp() });
  }

  async function toggleSpectatorChat() {
    if (!roomId || !room || room.hostUid !== myUid()) return;
    await rooms().doc(roomId).set({ spectatorChatEnabled: room.spectatorChatEnabled === false, updatedAt: FV.serverTimestamp() }, { merge: true });
  }

  function ensureForceButton() {
    const between = document.getElementById("betweenControls");
    if (!between || document.getElementById("forceRebellionBtn")) return;
    const btn = document.createElement("button");
    btn.id = "forceRebellionBtn";
    btn.className = "btn ghost hidden";
    btn.type = "button";
    btn.textContent = "민란 강제 시작";
    between.appendChild(btn);
    btn.addEventListener("click", forceRebellionNextRound);
  }

  function renderForceButton() {
    ensureForceButton();
    const btn = document.getElementById("forceRebellionBtn");
    if (!btn || !room) return;
    btn.classList.toggle("hidden", !(room.hostUid === myUid() && room.status === "betweenRounds"));
  }

  async function forceRebellionNextRound() {
    if (!roomId || !room || room.hostUid !== myUid() || room.status !== "betweenRounds") return;
    if (!confirm("다음 라운드를 민란 테스트용으로 강제 시작할까요?")) return;
    await startNextRound(true);
  }

  function patchNextRoundButton() {
    const old = document.getElementById("nextRoundBtn");
    if (!old || old.dataset.moreFeaturePatched) return;
    const clone = old.cloneNode(true);
    clone.id = "nextRoundBtn";
    clone.dataset.moreFeaturePatched = "true";
    old.parentNode.replaceChild(clone, old);
    clone.addEventListener("click", () => startNextRound(false));
  }

  async function startNextRound(forceRebellion) {
    if (!roomId || !room || room.hostUid !== myUid() || room.status !== "betweenRounds" || busy) return;
    busy = true;
    try {
      const ref = rooms().doc(roomId);
      const snap = await ref.collection("participants").get();
      const ps = snap.docs.map((doc) => ({ id: doc.id, ref: doc.ref, ...doc.data() }))
        .filter((p) => p.type === "player")
        .sort((a, b) => (a.lastRoundRank ?? a.finishedRank ?? 999) - (b.lastRoundRank ?? b.finishedRank ?? 999));
      const round = Number(room.round || 0) + 1;
      const deck = makeDeck(ps.length);
      const hands = Object.fromEntries(ps.map((p) => [p.uid, []]));
      deck.forEach((card, i) => hands[ps[i % ps.length].uid].push(card));
      Object.keys(hands).forEach((uid) => { hands[uid] = sortHand(hands[uid]); });
      if (forceRebellion && ps.length >= 3) forceDoubleHong(hands, ps[ps.length - 1].uid);
      const pairs = makeTributePairs(ps, hands);
      const hasTribute = pairs.some((p) => !p.returned);
      const batch = db.batch();
      batch.set(ref, {
        status: hasTribute ? "tributeReturn" : "playing",
        round,
        currentTurnUid: hasTribute ? null : ps[0]?.uid || null,
        currentSet: null,
        previousSet: null,
        finishOrder: [],
        turnOrder: ps.map((p) => p.uid),
        tribute: hasTribute ? { phase: "return", pairs, returnStartedAt: firebase.firestore.Timestamp.now(), forceRebellion } : null,
        turnStartedAt: hasTribute ? null : FV.serverTimestamp(),
        turnDeadlineAt: hasTribute ? null : tsFromMs(Date.now() + Number(room.turnLimit || 15) * 1000),
        deadlineTurnUid: hasTribute ? null : ps[0]?.uid || null,
        updatedAt: FV.serverTimestamp()
      }, { merge: true });
      ps.forEach((p, i) => {
        const hand = sortHand(hands[p.uid]);
        batch.set(p.ref, {
          seatOrder: i,
          role: roleByIndex(i, ps.length),
          hand,
          cardCount: hand.length,
          isReady: false,
          passed: false,
          finished: false,
          finishedRank: null,
          forfeited: false,
          timeoutCount: 0,
          updatedAt: FV.serverTimestamp()
        }, { merge: true });
      });
      await batch.commit();
      await ref.collection("messages").add({
        type: "system",
        text: forceRebellion ? "민란 테스트 라운드를 시작합니다." : (hasTribute ? `${round}라운드 상납 반환을 시작합니다.` : `${round}라운드가 시작되었습니다.`),
        createdAt: FV.serverTimestamp()
      });
    } catch (err) {
      console.error("startNextRound failed", err);
      alert("다음 라운드 시작 중 오류가 발생했습니다.");
    } finally {
      busy = false;
    }
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

  function render() {
    ensureHelp();
    ensureSettingsPanel();
    ensureForceButton();
    renderSettingsPanel();
    renderForceButton();
    patchNextRoundButton();
  }

  window.addEventListener("DOMContentLoaded", () => {
    installCss();
    render();
    bind(localStorage.getItem("dalmutiCurrentRoomId") || "");
    setInterval(() => bind(localStorage.getItem("dalmutiCurrentRoomId") || ""), 700);
    setInterval(render, 1000);
  });
})();
