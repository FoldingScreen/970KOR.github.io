(() => {
  const db = firebase.firestore();
  const FV = firebase.firestore.FieldValue;
  const CARD_BASE = "./cards/";
  const rooms = () => db.collection("events").doc("dalmuti").collection("rooms");

  const RANKS = [
    { rank: 1, name: "사바나", image: "card-01-sabana.png", count: 1 },
    { rank: 2, name: "세자", image: "card-02-prince.png", count: 2 },
    { rank: 3, name: "영의정", image: "card-03-yeonguijeong.png", count: 3 },
    { rank: 4, name: "관찰사", image: "card-04-governor.png", count: 4 },
    { rank: 5, name: "암행어사", image: "card-05-amhaeng.png", count: 5 },
    { rank: 6, name: "사또", image: "card-06-satto.png", count: 6 },
    { rank: 7, name: "이방", image: "card-07-ibang.png", count: 7 },
    { rank: 8, name: "포졸", image: "card-08-pojol.png", count: 8 },
    { rank: 9, name: "선비", image: "card-09-seonbi.png", count: 9 },
    { rank: 10, name: "상인", image: "card-10-merchant.png", count: 10 },
    { rank: 11, name: "농민", image: "card-11-farmer.png", count: 11 },
    { rank: 12, name: "노비", image: "card-12-nobi.png", count: 12 },
    { rank: 13, name: "홍길동", image: "card-j-hong.png", count: 2, joker: true }
  ];

  let roomId = "";
  let room = null;
  let parts = [];
  let unsubRoom = null;
  let unsubParts = null;
  let nextRoundBusy = false;
  let timerEl = null;

  const myUid = () => String(localStorage.getItem("partyAppUser") || "").trim();
  const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
  const rankInfo = (rank) => RANKS.find((r) => r.rank === Number(rank)) || RANKS[RANKS.length - 1];
  const cardImg = (rank) => CARD_BASE + rankInfo(rank).image;
  const toMs = (ts) => ts && typeof ts.toMillis === "function" ? ts.toMillis() : 0;
  const tsFromMs = (ms) => firebase.firestore.Timestamp.fromMillis(ms);
  const sortHand = (cards = []) => cards.slice().sort((a, b) => a.rank - b.rank || String(a.id).localeCompare(String(b.id)));
  const maxRankForCount = (count) => count <= 3 ? 8 : count <= 5 ? 10 : 12;
  const players = () => parts.filter((p) => p.type === "player").sort((a, b) => (a.seatOrder ?? 999) - (b.seatOrder ?? 999));
  const orderedByRank = () => parts.filter((p) => p.type === "player").sort((a, b) => (a.lastRoundRank ?? a.finishedRank ?? a.seatOrder ?? 999) - (b.lastRoundRank ?? b.finishedRank ?? b.seatOrder ?? 999));

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

  function makeDeck(count) {
    const max = maxRankForCount(count);
    const deck = [];
    RANKS.filter((r) => r.rank <= max).forEach((r) => {
      for (let i = 1; i <= r.count; i += 1) deck.push({ id: `r${r.rank}-${i}-${Math.random().toString(36).slice(2, 8)}`, rank: r.rank, name: r.name });
    });
    for (let i = 1; i <= 2; i += 1) deck.push({ id: `j-${i}-${Math.random().toString(36).slice(2, 8)}`, rank: 13, name: "홍길동", joker: true });
    return shuffle(deck);
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
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

  function installCss() {
    if (document.getElementById("dalmutiPcFixCss")) return;
    const style = document.createElement("style");
    style.id = "dalmutiPcFixCss";
    style.textContent = `
      #dalmutiTimerFloat{display:none!important;}
      .player-box{width:126px;min-height:82px;}
      .seat-top-0{left:50%!important;top:8px!important;transform:translateX(-50%)!important;}
      .seat-top-1{left:30%!important;top:8px!important;transform:translateX(-50%)!important;}
      .seat-top-2{left:70%!important;top:8px!important;transform:translateX(-50%)!important;}
      .player-box.submitted{border-color:#7ee2a8!important;box-shadow:0 0 0 2px rgba(126,226,168,.55),0 12px 24px rgba(0,0,0,.28)!important;}
      .player-box.passed{opacity:.8!important;border-color:#8792a7!important;background:rgba(35,39,51,.92)!important;}
      .player-box.forfeited{opacity:.45!important;filter:grayscale(.9);}
      .dalmuti-status-badge{display:inline-block;margin-top:5px;padding:3px 8px;border-radius:999px;font-size:12px;font-weight:900;}
      .dalmuti-status-badge.submit{background:rgba(126,226,168,.16);border:1px solid rgba(126,226,168,.75);color:#9ff0bd;}
      .dalmuti-status-badge.pass{background:rgba(135,146,167,.16);border:1px solid rgba(135,146,167,.75);color:#d2d8e4;}
      .dalmuti-status-badge.turn{background:rgba(243,210,129,.16);border:1px solid rgba(243,210,129,.75);color:#f3d281;}
      .center-pile.pc-fixed{width:min(520px,60%)!important;min-height:240px!important;text-align:left!important;padding:14px 16px!important;}
      .pc-pile-prev{position:absolute;left:12px;top:12px;width:155px;min-height:84px;border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:8px;background:rgba(0,0,0,.22);}
      .pc-pile-prev-title,.pc-pile-cur-title{font-size:12px;color:#aeb5c3;font-weight:900;margin-bottom:6px;}
      .pc-pile-cur{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:205px;padding-left:170px;text-align:center;}
      .pc-pile-current-name{font-size:18px;font-weight:900;color:#f3d281;margin-bottom:10px;}
      .pc-pile-prev .mini-card{width:34px!important;border-radius:6px;}
      .pc-pile-cur .mini-card{width:78px!important;border-radius:10px;}
      .pc-pile-empty{height:205px;display:flex;align-items:center;justify-content:center;color:#aeb5c3;font-weight:900;}
      #dalmutiPcTimer{position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:90;display:none;min-width:84px;padding:9px 16px;border-radius:999px;border:1px solid rgba(243,210,129,.65);background:rgba(13,19,32,.96);box-shadow:0 10px 28px rgba(0,0,0,.36);color:#f3d281;font-weight:900;text-align:center;font-size:20px;}
    `;
    document.head.appendChild(style);
  }

  function ensureTimer() {
    if (timerEl) return timerEl;
    timerEl = document.createElement("div");
    timerEl.id = "dalmutiPcTimer";
    document.body.appendChild(timerEl);
    return timerEl;
  }

  async function ensureDeadline() {
    if (!roomId || !room) return;
    const ref = rooms().doc(roomId);
    if (room.status === "playing" && room.currentTurnUid) {
      if (room.turnDeadlineAt && room.deadlineTurnUid === room.currentTurnUid) return;
      const limit = Number(room.turnLimit || 15);
      await ref.set({
        turnStartedAt: FV.serverTimestamp(),
        turnDeadlineAt: tsFromMs(Date.now() + limit * 1000),
        deadlineTurnUid: room.currentTurnUid,
        updatedAt: FV.serverTimestamp()
      }, { merge: true });
    }
    if (room.status === "tributeReturn" && room.tribute && !room.tribute.returnDeadlineAt) {
      await ref.set({
        tribute: { ...room.tribute, returnDeadlineAt: tsFromMs(Date.now() + 15000) },
        updatedAt: FV.serverTimestamp()
      }, { merge: true });
    }
  }

  function renderTimer() {
    const el = ensureTimer();
    if (!room) { el.style.display = "none"; return; }
    const deadline = room.status === "tributeReturn" ? toMs(room.tribute?.returnDeadlineAt) : toMs(room.turnDeadlineAt);
    if (!deadline) { el.style.display = "none"; return; }
    const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    if (left > 5) { el.style.display = "none"; return; }
    el.style.display = "block";
    el.textContent = room.status === "tributeReturn" ? `상납 ${left}` : String(left);
    el.style.color = left <= 2 ? "#ff8a8a" : "#f3d281";
    el.style.borderColor = left <= 2 ? "rgba(255,138,138,.75)" : "rgba(243,210,129,.65)";
  }

  function comboName(set) {
    if (!set) return "";
    return `${rankInfo(set.effectiveRank).name} ${set.count}장`;
  }

  function pileCards(cards, big) {
    return (cards || []).map((c) => `<img class="mini-card" src="${cardImg(c.rank)}" alt="${esc(c.name)}">`).join("") || `<span class="muted">없음</span>`;
  }

  function renderCenterPile() {
    const el = document.getElementById("centerPile");
    if (!el || !room) return;
    if (room.status === "tributeReturn") return;
    el.classList.add("pc-fixed");
    const prev = room.previousSet;
    const cur = room.currentSet;
    if (!prev && !cur) {
      el.innerHTML = `<div class="pc-pile-empty">새 판</div>`;
      return;
    }
    el.innerHTML = `
      <div class="pc-pile-prev">
        <div class="pc-pile-prev-title">직전 카드</div>
        <div class="pile-cards">${prev ? pileCards(prev.cards, false) : `<span class="muted">없음</span>`}</div>
      </div>
      <div class="pc-pile-cur">
        <div class="pc-pile-cur-title">현재 카드</div>
        <div class="pc-pile-current-name">${cur ? esc(comboName(cur)) : "새 판"}</div>
        <div class="pile-cards">${cur ? pileCards(cur.cards, true) : `<span class="muted">제출 대기</span>`}</div>
      </div>
    `;
  }

  function decoratePlayerBoxes() {
    if (!room) return;
    const boxes = Array.from(document.querySelectorAll(".player-box"));
    boxes.forEach((box) => {
      const nameEl = box.querySelector(".player-name");
      const nickname = nameEl ? nameEl.textContent.trim() : "";
      const p = parts.find((x) => x.nickname === nickname);
      if (!p) return;
      box.classList.toggle("submitted", !!room.currentSet && room.currentSet.uid === p.uid);
      box.classList.toggle("forfeited", !!p.forfeited);
      let badge = box.querySelector(".dalmuti-status-badge");
      if (!badge) {
        badge = document.createElement("div");
        badge.className = "dalmuti-status-badge";
        box.appendChild(badge);
      }
      let text = "";
      let cls = "dalmuti-status-badge";
      if (room.currentSet && room.currentSet.uid === p.uid) { text = "제출"; cls += " submit"; }
      else if (p.passed) { text = "패스"; cls += " pass"; }
      else if (room.currentTurnUid === p.uid) { text = "차례"; cls += " turn"; }
      badge.className = cls;
      badge.textContent = text;
      badge.style.display = text ? "inline-block" : "none";
    });
  }

  async function fixedNextRound() {
    if (!roomId || !room || room.status !== "betweenRounds") return;
    if (room.hostUid !== myUid()) return;
    if (nextRoundBusy) return;
    nextRoundBusy = true;
    try {
      const ref = rooms().doc(roomId);
      const snap = await ref.collection("participants").get();
      const ps = snap.docs.map((doc) => ({ id: doc.id, ref: doc.ref, ...doc.data() }))
        .filter((p) => p.type === "player")
        .sort((a, b) => (a.lastRoundRank ?? a.finishedRank ?? 999) - (b.lastRoundRank ?? b.finishedRank ?? 999));

      const round = Number(room.round || 0) + 1;
      const deck = makeDeck(ps.length);
      const hands = Object.fromEntries(ps.map((p) => [p.uid, []]));
      deck.forEach((c, i) => hands[ps[i % ps.length].uid].push(c));
      Object.keys(hands).forEach((uid) => { hands[uid] = sortHand(hands[uid]); });
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
        tribute: hasTribute ? { phase: "return", pairs, returnStartedAt: firebase.firestore.Timestamp.now() } : null,
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
      await ref.collection("messages").add({ type: "system", text: hasTribute ? `${round}라운드 상납 반환을 시작합니다.` : `${round}라운드가 시작되었습니다.`, createdAt: FV.serverTimestamp() });
    } catch (err) {
      console.error("fixedNextRound failed", err);
      alert("다음 라운드 시작 중 오류가 발생했습니다.");
    } finally {
      nextRoundBusy = false;
    }
  }

  function bindNextRoundButton() {
    const btn = document.getElementById("nextRoundBtn");
    if (!btn || btn.dataset.pcFixBound) return;
    btn.dataset.pcFixBound = "true";
    btn.addEventListener("click", (e) => {
      if (room && room.status === "betweenRounds" && room.hostUid === myUid()) {
        e.preventDefault();
        e.stopImmediatePropagation();
        fixedNextRound();
      }
    }, true);
  }

  function bindRoom(id) {
    if (id === roomId) return;
    if (unsubRoom) unsubRoom();
    if (unsubParts) unsubParts();
    roomId = id;
    room = null;
    parts = [];
    if (!roomId) return;
    const ref = rooms().doc(roomId);
    unsubRoom = ref.onSnapshot((snap) => { room = snap.exists ? { id: snap.id, ...snap.data() } : null; }, console.error);
    unsubParts = ref.collection("participants").onSnapshot((snap) => { parts = snap.docs.map((d) => ({ id: d.id, ...d.data() })); }, console.error);
  }

  function tick() {
    bindNextRoundButton();
    renderTimer();
    renderCenterPile();
    decoratePlayerBoxes();
    ensureDeadline().catch(console.error);
  }

  window.addEventListener("DOMContentLoaded", () => {
    installCss();
    ensureTimer();
    bindRoom(localStorage.getItem("dalmutiCurrentRoomId") || "");
    setInterval(() => bindRoom(localStorage.getItem("dalmutiCurrentRoomId") || ""), 600);
    setInterval(tick, 250);
  });
})();
