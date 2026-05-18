(() => {
  "use strict";

  if (!window.firebase || !firebase.apps.length) return;

  const db = firebase.firestore();
  const FV = firebase.firestore.FieldValue;
  const EVENT_ID = "dalmuti";
  const MAX_PLAYERS = 8;
  const CHAT_LIMIT = 12;
  const PREVIEW_DELAY_MS = 2800;
  const REBELLION_DELAY_MS = 5400;

  const RANKS = [
    [1, "01", "임금", "card-01-imguem.png", 1],
    [2, "02", "세자", "card-02-prince.png", 2],
    [3, "03", "영의정", "card-03-yeonguijeong.png", 3],
    [4, "04", "관찰사", "card-04-governor.png", 4],
    [5, "05", "암행어사", "card-05-amhaeng.png", 5],
    [6, "06", "사또", "card-06-satto.png", 6],
    [7, "07", "이방", "card-07-ibang.png", 7],
    [8, "08", "포졸", "card-08-pojol.png", 8],
    [9, "09", "선비", "card-09-seonbi.png", 9],
    [10, "10", "상인", "card-10-merchant.png", 10],
    [11, "11", "농민", "card-11-farmer.png", 11],
    [12, "12", "노비", "card-12-nobi.png", 12],
    [13, "J", "홍길동", "card-j-hong.png", 2]
  ].map(([rank, code, name, image, count]) => ({ rank, code, name, image, count, joker: rank === 13 }));

  const roomCol = () => db.collection("events").doc(EVENT_ID).collection("rooms");
  const roomRef = id => roomCol().doc(id);
  const handRef = (roomId, uid) => roomRef(roomId).collection("hands").doc(uid);
  const now = () => firebase.firestore.Timestamp.now();
  const serverNow = () => FV.serverTimestamp();
  const currentRoomId = () => String(localStorage.getItem("dalmutiCurrentRoomId") || "").trim();
  const currentUser = () => String(localStorage.getItem("partyAppUser") || "").trim();
  const cleanMap = obj => Object.fromEntries(Object.entries(obj || {}).filter(([, v]) => v && typeof v === "object"));
  const playersMap = room => cleanMap(room?.players);
  const countMap = obj => Object.values(cleanMap(obj)).length;
  const sortHand = hand => (hand || []).slice().sort((a, b) => Number(a.rank) - Number(b.rank) || String(a.id).localeCompare(String(b.id)));
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function allPlayers(room) {
    return Object.values(playersMap(room))
      .filter(p => p && p.uid && !p.removedFromRoom)
      .sort((a, b) => (a.seatOrder ?? 999) - (b.seatOrder ?? 999));
  }

  function roundOrderPlayers(round, players) {
    const list = (players || []).filter(p => p && p.uid);
    if (round <= 1) {
      return list.slice().sort((a, b) =>
        (a.seatOrder ?? 999) - (b.seatOrder ?? 999) ||
        String(a.nickname || "").localeCompare(String(b.nickname || ""), "ko")
      );
    }
    return list.slice().sort((a, b) =>
      (a.lastRoundRank ?? 999) - (b.lastRoundRank ?? 999) ||
      (a.seatOrder ?? 999) - (b.seatOrder ?? 999) ||
      String(a.nickname || "").localeCompare(String(b.nickname || ""), "ko")
    );
  }

  function maxRankByPlayers(count) {
    if (count <= 3) return 8;
    if (count <= 5) return 10;
    return 12;
  }

  function makeDeck(playerCount) {
    const deck = [];
    RANKS.filter(r => r.rank <= maxRankByPlayers(playerCount)).forEach(r => {
      for (let i = 1; i <= r.count; i++) {
        deck.push({ id: `r${r.rank}-${i}-${Math.random().toString(36).slice(2, 8)}`, rank: r.rank, name: r.name, joker: false });
      }
    });
    for (let i = 1; i <= 2; i++) deck.push({ id: `j-${i}-${Math.random().toString(36).slice(2, 8)}`, rank: 13, name: "홍길동", joker: true });
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  function roleByIndex(index, count) {
    const map = {
      2: ["임금", "노비"],
      3: ["임금", "농민", "노비"],
      4: ["임금", "세자", "농민", "노비"],
      5: ["임금", "세자", "사또", "농민", "노비"],
      6: ["임금", "세자", "암행어사", "사또", "농민", "노비"],
      7: ["임금", "세자", "관찰사", "암행어사", "사또", "농민", "노비"],
      8: ["임금", "세자", "영의정", "관찰사", "암행어사", "사또", "농민", "노비"]
    };
    return (map[count] || [])[index] || `${index + 1}등`;
  }

  function hasTwoHong(hand = []) {
    return hand.filter(c => c.joker || Number(c.rank) === 13).length >= 2;
  }

  function bestTributeCards(hand, count) {
    return sortHand(hand).filter(c => !(c.joker || Number(c.rank) === 13)).slice(0, count);
  }

  function makeTributePairs(players, hands) {
    if (players.length < 3) return [];
    const specs = players.length === 3
      ? [{ from: players[2], to: players[0], count: 1 }]
      : [
          { from: players[players.length - 1], to: players[0], count: 2 },
          { from: players[players.length - 2], to: players[1], count: 1 }
        ];

    return specs.map((spec, i) => {
      const cards = bestTributeCards(hands[spec.from.uid] || [], spec.count);
      const ids = new Set(cards.map(c => c.id));
      hands[spec.from.uid] = sortHand((hands[spec.from.uid] || []).filter(c => !ids.has(c.id)));
      hands[spec.to.uid] = sortHand((hands[spec.to.uid] || []).concat(cards));
      return {
        id: `tribute-${i}`,
        fromUid: spec.from.uid,
        fromNickname: spec.from.nickname,
        toUid: spec.to.uid,
        toNickname: spec.to.nickname,
        count: cards.length,
        cards,
        returned: cards.length === 0,
        returnedCards: []
      };
    }).filter(pair => pair.count > 0);
  }

  async function appendSystem(roomId, text) {
    const ref = roomRef(roomId);
    const snap = await ref.get().catch(() => null);
    if (!snap?.exists) return;
    const room = snap.data() || {};
    const chat = Array.isArray(room.chatPreview) ? room.chatPreview.slice(-CHAT_LIMIT + 1) : [];
    chat.push({ type: "system", uid: "system", nickname: "", text, createdAt: Date.now() });
    await ref.set({ chatPreview: chat, updatedAt: serverNow() }, { merge: true });
  }

  function makePlayerMap(ps, hands, resetScores) {
    const playerMap = {};
    ps.forEach((p, i) => {
      playerMap[p.uid] = {
        ...p,
        type: "player",
        seatOrder: i,
        role: roleByIndex(i, ps.length),
        score: resetScores ? 0 : (p.score || 0),
        lastRoundScore: 0,
        lastRoundRank: resetScores ? null : p.lastRoundRank,
        cardCount: (hands[p.uid] || []).length,
        isReady: !!p.isAI,
        passed: false,
        finished: false,
        finishedRank: null,
        forfeited: false,
        removedFromRoom: false
      };
    });
    return playerMap;
  }

  async function startRoundWithPreview(round, resetScores, forceRebellion) {
    const roomId = currentRoomId();
    const user = currentUser();
    if (!roomId || !user) return;

    const latestSnap = await roomRef(roomId).get();
    if (!latestSnap.exists) return;
    const room = latestSnap.data();
    if (room.hostUid !== user || room.status !== "betweenRounds") return;

    let ps = roundOrderPlayers(round, allPlayers(room));
    const deck = makeDeck(ps.length);
    const hands = Object.fromEntries(ps.map(p => [p.uid, []]));
    deck.forEach((card, i) => hands[ps[i % ps.length].uid].push(card));
    Object.keys(hands).forEach(uid => { hands[uid] = sortHand(hands[uid]); });

    const lowUids = ps.length === 3
      ? [ps[1]?.uid, ps[2]?.uid]
      : [ps[ps.length - 2]?.uid, ps[ps.length - 1]?.uid];

    const rebellionUid = round > 1
      ? (forceRebellion ? ps[ps.length - 1]?.uid : lowUids.find(uid => uid && hasTwoHong(hands[uid])))
      : null;

    const rebellionPlayer = ps.find(p => p.uid === rebellionUid);
    if (rebellionUid) ps = ps.slice().reverse();

    const previewHands = Object.fromEntries(Object.entries(hands).map(([uid, hand]) => [uid, sortHand(hand)]));
    const previewPlayers = makePlayerMap(ps, previewHands, resetScores);
    const roundKey = `${round}-${Date.now()}`;
    const first = ps[0]?.uid || null;

    if (round <= 1 || ps.length < 3) {
      const batch = db.batch();
      batch.set(roomRef(roomId), {
        players: previewPlayers,
        playerCount: countMap(previewPlayers),
        status: "playing",
        round,
        roundKey,
        currentTurnUid: first,
        currentSet: null,
        previousSet: null,
        finishOrder: [],
        turnOrder: ps.map(p => p.uid),
        tribute: null,
        rebellionNotice: rebellionUid ? { uid: rebellionUid, nickname: rebellionPlayer?.nickname || "누군가", round, createdAt: now() } : null,
        updatedAt: serverNow()
      }, { merge: true });
      Object.keys(previewHands).forEach(uid => batch.set(handRef(roomId, uid), { hand: previewHands[uid] }));
      await batch.commit();
      await appendSystem(roomId, `${round}라운드가 시작되었습니다.`);
      return;
    }

    const previewBatch = db.batch();
    previewBatch.set(roomRef(roomId), {
      players: previewPlayers,
      playerCount: countMap(previewPlayers),
      status: "tributeReturn",
      round,
      roundKey,
      currentTurnUid: null,
      currentSet: null,
      previousSet: null,
      finishOrder: [],
      turnOrder: ps.map(p => p.uid),
      tribute: { phase: "preview", pairs: [], reversed: !!rebellionUid, previewStartedAt: now() },
      rebellionNotice: rebellionUid ? { uid: rebellionUid, nickname: rebellionPlayer?.nickname || "누군가", round, createdAt: now() } : null,
      updatedAt: serverNow()
    }, { merge: true });
    Object.keys(previewHands).forEach(uid => previewBatch.set(handRef(roomId, uid), { hand: previewHands[uid] }));
    await previewBatch.commit();

    await appendSystem(roomId, rebellionUid
      ? `${rebellionPlayer?.nickname || "누군가"}님의 홍길동이 민란을 일으켰습니다.`
      : `${round}라운드 카드 분배가 완료되었습니다. 잠시 후 상납이 시작됩니다.`);

    await sleep(rebellionUid ? REBELLION_DELAY_MS : PREVIEW_DELAY_MS);

    const checkSnap = await roomRef(roomId).get().catch(() => null);
    const check = checkSnap?.exists ? checkSnap.data() : null;
    if (!check || check.roundKey !== roundKey || check.status !== "tributeReturn" || check.tribute?.phase !== "preview") return;

    const tributeHands = Object.fromEntries(Object.entries(previewHands).map(([uid, hand]) => [uid, sortHand(hand)]));
    const pairs = makeTributePairs(ps, tributeHands);
    const hasTribute = pairs.some(p => !p.returned);
    const tributePlayers = makePlayerMap(ps, tributeHands, resetScores);

    const batch = db.batch();
    batch.set(roomRef(roomId), {
      players: tributePlayers,
      status: hasTribute ? "tributeReturn" : "playing",
      currentTurnUid: hasTribute ? (pairs.find(p => !p.returned)?.toUid || null) : first,
      tribute: hasTribute ? { phase: "return", pairs, reversed: !!rebellionUid, returnStartedAt: now() } : null,
      updatedAt: serverNow()
    }, { merge: true });
    Object.keys(tributeHands).forEach(uid => batch.set(handRef(roomId, uid), { hand: tributeHands[uid] }));
    await batch.commit();

    await appendSystem(roomId, hasTribute ? `${round}라운드 상납 반환을 시작합니다.` : `${round}라운드가 시작되었습니다.`);
  }

  function patchMessageForPreview() {
    const bar = document.getElementById("messageBar");
    if (!bar) return;
    const text = bar.textContent || "";
    if (text.includes("상납받은 사람이 같은 장수만큼")) {
      bar.textContent = "카드 분배 완료. 잠시 후 상납이 시작됩니다.";
    }
  }

  function patchHelp() {
    if (!window.Dalmuti || window.Dalmuti.__helpTributePatched) return false;

    const originalHelp = window.Dalmuti.showHelp;
    window.Dalmuti.showHelp = function patchedShowHelp() {
      if (typeof originalHelp === "function") originalHelp.apply(this, arguments);
      setTimeout(() => {
        const card = document.getElementById("gameModalCard");
        if (!card || card.querySelector("#cardGuideSection")) return;
        const guide = document.createElement("div");
        guide.id = "cardGuideSection";
        guide.className = "help-section";
        guide.innerHTML = `<strong>카드 보기</strong><br><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));gap:6px;margin-top:8px">${RANKS.map(r => `<div style="display:flex;align-items:center;gap:6px"><img src="./cards/${r.image}" style="width:32px;border-radius:5px" alt="${r.name}"><span>${r.code}. ${r.name} ${r.count}장</span></div>`).join("")}</div>`;
        const firstHelp = card.querySelector(".help-section");
        if (firstHelp) firstHelp.parentNode.insertBefore(guide, firstHelp.nextSibling);
        else card.appendChild(guide);
      }, 0);
    };

    const originalNext = window.Dalmuti.nextRound;
    window.Dalmuti.nextRound = function patchedNextRound() {
      return startRoundWithPreview(Number(getCurrentRound()) + 1, false, false).catch(console.error) || originalNext?.apply(this, arguments);
    };
    window.Dalmuti.forceRebellion = function patchedForceRebellion() {
      return startRoundWithPreview(Number(getCurrentRound()) + 1, false, true).catch(console.error);
    };

    window.Dalmuti.__helpTributePatched = true;
    return true;
  }

  async function getCurrentRound() {
    const roomId = currentRoomId();
    if (!roomId) return 0;
    const snap = await roomRef(roomId).get().catch(() => null);
    return snap?.exists ? Number(snap.data().round || 0) : 0;
  }

  function interceptNextButtons() {
    if (document.__dalmutiTributeDelayBound) return;
    document.__dalmutiTributeDelayBound = true;
    document.addEventListener("click", event => {
      const next = event.target.closest?.("#nextRoundBtn");
      if (next) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        getCurrentRound().then(round => startRoundWithPreview(round + 1, false, false)).catch(console.error);
      }
    }, true);
  }

  function tick() {
    patchHelp();
    interceptNextButtons();
    patchMessageForPreview();
  }

  if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", tick);
  else tick();
  setInterval(tick, 250);
})();
