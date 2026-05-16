(() => {
  const db = firebase.firestore();
  const FV = firebase.firestore.FieldValue;
  const MAX_PLAYERS = 8;
  const roomCol = () => db.collection("events").doc("dalmuti").collection("rooms");
  const currentRoomId = () => String(localStorage.getItem("dalmutiCurrentRoomId") || "").trim();
  const currentUser = () => String(localStorage.getItem("partyAppUser") || "").trim();
  const roomRef = (id = currentRoomId()) => id ? roomCol().doc(id) : null;
  const handRef = (roomId, uid) => roomCol().doc(roomId).collection("hands").doc(uid);
  const ts = () => firebase.firestore.Timestamp.now();
  const cleanMap = obj => Object.fromEntries(Object.entries(obj || {}).filter(([, v]) => v));
  const playersOf = room => Object.values(cleanMap(room.players)).filter(p => p && !p.removedFromRoom).sort((a, b) => (a.seatOrder ?? 999) - (b.seatOrder ?? 999));
  const activePlayersOf = room => playersOf(room).filter(p => !p.finished && !p.forfeited);
  const nextAfter = (room, uid) => {
    const list = activePlayersOf(room);
    if (!list.length) return "";
    const idx = Math.max(0, list.findIndex(p => p.uid === uid));
    return list[(idx + 1) % list.length]?.uid || list[0]?.uid || "";
  };
  const sortHand = hand => (hand || []).slice().sort((a, b) => a.rank - b.rank || String(a.id).localeCompare(String(b.id)));
  const groupHand = hand => {
    const m = new Map();
    sortHand(hand).forEach(c => {
      if (!m.has(c.rank)) m.set(c.rank, []);
      m.get(c.rank).push(c);
    });
    return [...m.entries()].map(([rank, items]) => ({ rank, items }));
  };
  const rankName = rank => ({1:"사바나",2:"세자",3:"영의정",4:"관찰사",5:"암행어사",6:"사또",7:"이방",8:"포졸",9:"선비",10:"상인",11:"농민",12:"노비",13:"홍길동"})[Number(rank)] || "카드";

  function chooseAiCards(room, hand) {
    hand = sortHand(hand || []);
    const cur = room.currentSet;
    if (!hand.length) return [];

    if (!cur) {
      const normalGroups = groupHand(hand.filter(c => !c.joker && c.rank !== 13)).sort((a, b) => b.rank - a.rank);
      if (normalGroups.length) return normalGroups[0].items.slice(0, 1);
      return hand.slice(0, 1);
    }

    const need = Number(cur.count || 1);
    const jokers = hand.filter(c => c.joker || c.rank === 13);
    const groups = groupHand(hand.filter(c => !c.joker && c.rank !== 13)).sort((a, b) => b.rank - a.rank);

    for (const g of groups) {
      if (g.rank < cur.effectiveRank && g.items.length + jokers.length >= need) {
        const normal = g.items.slice(0, Math.min(g.items.length, need));
        const extra = jokers.slice(0, Math.max(0, need - normal.length));
        return normal.concat(extra);
      }
    }
    return [];
  }

  async function appendSystem(roomId, room, text) {
    const ref = roomRef(roomId);
    if (!ref) return;
    const chat = (room.chatPreview || []).slice(-11);
    chat.push({ type: "system", uid: "system", nickname: "", text, createdAt: Date.now() });
    await ref.set({ chatPreview: chat, updatedAt: FV.serverTimestamp() }, { merge: true });
  }

  async function finishRound(roomId, room, finalOrder, currentSet) {
    const players = cleanMap(room.players);
    const total = playersOf(room).length;
    finalOrder.forEach((r, i) => {
      if (!players[r.uid]) return;
      const score = total - i;
      players[r.uid] = {
        ...players[r.uid],
        score: (players[r.uid].score || 0) + score,
        lastRoundScore: score,
        lastRoundRank: i + 1,
        seatOrder: i,
        finished: true,
        finishedRank: i + 1
      };
    });
    await roomRef(roomId).set({
      players,
      status: (room.totalRounds && room.round >= room.totalRounds) ? "finished" : "betweenRounds",
      currentTurnUid: null,
      previousSet: currentSet || room.currentSet || null,
      currentSet: null,
      tribute: null,
      finishOrder: finalOrder,
      lastRoundResult: { round: room.round, results: finalOrder, endedAt: ts() },
      updatedAt: FV.serverTimestamp()
    }, { merge: true });
    await appendSystem(roomId, { ...room, chatPreview: room.chatPreview || [] }, `${room.round}라운드가 종료되었습니다.`);
  }

  async function aiPlay(roomId, room, ai, hand, cards) {
    const players = cleanMap(room.players);
    if (!players[ai.uid]) return;

    const ids = new Set(cards.map(c => c.id));
    const newHand = (hand || []).filter(c => !ids.has(c.id));
    const order = (room.finishOrder || []).slice();
    let finishedRank = players[ai.uid].finishedRank || null;
    const isFinished = newHand.length === 0;

    if (isFinished && !players[ai.uid].finished) {
      finishedRank = order.length + 1;
      order.push({ uid: ai.uid, nickname: ai.nickname, rank: finishedRank, finishedAt: ts() });
    }

    Object.keys(players).forEach(uid => {
      if (uid !== ai.uid) players[uid] = { ...players[uid], passed: false };
    });

    const effectiveNormals = cards.filter(c => !c.joker && c.rank !== 13);
    const effectiveRank = effectiveNormals.length ? effectiveNormals[0].rank : 13;
    const set = {
      uid: ai.uid,
      nickname: ai.nickname,
      effectiveRank,
      effectiveName: rankName(effectiveRank),
      count: cards.length,
      cards,
      createdAt: ts()
    };

    players[ai.uid] = {
      ...players[ai.uid],
      cardCount: newHand.length,
      passed: false,
      finished: isFinished,
      finishedRank
    };

    const remaining = Object.values(players).filter(p => p && !p.finished && !p.forfeited).length;
    await handRef(roomId, ai.uid).set({ hand: newHand });

    if (remaining <= 1) {
      const last = Object.values(players).find(p => p && !p.finished && !p.forfeited);
      const finalOrder = order.slice();
      if (last) finalOrder.push({ uid: last.uid, nickname: last.nickname, rank: finalOrder.length + 1, finishedAt: ts() });
      await finishRound(roomId, { ...room, players }, finalOrder, set);
      return;
    }

    await roomRef(roomId).set({
      players,
      previousSet: room.currentSet || null,
      currentSet: set,
      currentTurnUid: nextAfter({ ...room, players }, ai.uid),
      finishOrder: order,
      updatedAt: FV.serverTimestamp()
    }, { merge: true });
  }

  async function aiPass(roomId, room, ai) {
    if (!room.currentSet) return;
    const players = cleanMap(room.players);
    if (!players[ai.uid]) return;
    players[ai.uid] = { ...players[ai.uid], passed: true };

    const active = Object.values(players).filter(p => p && !p.finished && !p.forfeited).map(p => p.uid);
    const others = active.filter(uid => uid !== room.currentSet.uid);
    const passed = new Set(Object.values(players).filter(p => p && p.passed).map(p => p.uid));
    const over = others.every(uid => passed.has(uid));

    let update = { players, updatedAt: FV.serverTimestamp() };
    if (over) {
      Object.keys(players).forEach(uid => players[uid] = { ...players[uid], passed: false });
      const starter = room.currentSet.uid;
      const starterAlive = players[starter] && !players[starter].finished && !players[starter].forfeited;
      update = {
        players,
        currentTurnUid: starterAlive ? starter : nextAfter({ ...room, players }, starter),
        previousSet: room.currentSet,
        currentSet: null,
        updatedAt: FV.serverTimestamp()
      };
    } else {
      update.currentTurnUid = nextAfter({ ...room, players }, ai.uid);
    }

    await roomRef(roomId).set(update, { merge: true });
  }

  let lastAiKey = "";
  let aiBusy = false;

  async function checkAiTurn() {
    if (aiBusy) return;
    const roomId = currentRoomId();
    const me = currentUser();
    if (!roomId || !me) return;
    const ref = roomRef(roomId);
    const snap = await ref.get().catch(() => null);
    if (!snap || !snap.exists) return;
    const room = snap.data();
    if (room.hostUid !== me || room.status !== "playing" || !room.currentTurnUid) return;
    const ai = cleanMap(room.players)[room.currentTurnUid];
    if (!ai || !ai.isAI || ai.finished || ai.forfeited) return;

    const turnStamp = room.updatedAt ? `${room.updatedAt.seconds || 0}_${room.updatedAt.nanoseconds || 0}` : Date.now();
    const key = `${roomId}_${room.round}_${ai.uid}_${room.currentSet ? room.currentSet.uid : "new"}_${turnStamp}`;
    if (key === lastAiKey) return;
    lastAiKey = key;

    aiBusy = true;
    setTimeout(async () => {
      try {
        const hs = await handRef(roomId, ai.uid).get();
        const hand = hs.exists ? (hs.data().hand || []) : [];
        const cards = chooseAiCards(room, hand);
        if (cards.length) await aiPlay(roomId, room, ai, hand, cards);
        else await aiPass(roomId, room, ai);
      } finally {
        aiBusy = false;
      }
    }, 700);
  }

  async function patchedKick(uid) {
    const roomId = currentRoomId();
    const me = currentUser();
    const ref = roomRef(roomId);
    if (!roomId || !ref) return;
    const snap = await ref.get();
    if (!snap.exists) return;
    const room = snap.data();
    if (room.hostUid !== me || uid === me) return;

    const players = cleanMap(room.players);
    const spectators = cleanMap(room.spectators);
    const target = players[uid] || spectators[uid];
    if (!target) return;
    if (!confirm(`${target.nickname}님을 방에서 내보낼까요?`)) return;

    if (players[uid]) {
      delete players[uid];
      await handRef(roomId, uid).delete().catch(() => null);
    }
    if (spectators[uid]) delete spectators[uid];

    await ref.set({
      players,
      spectators,
      playerCount: Object.values(players).length,
      spectatorCount: Object.values(spectators).length,
      kickNotice: { uid, nickname: target.nickname, at: ts() },
      updatedAt: FV.serverTimestamp()
    }, { merge: true });
    await appendSystem(roomId, room, `${target.nickname}님이 방장에 의해 강퇴되었습니다.`);
  }

  function bindHotfix() {
    if (window.Dalmuti) window.Dalmuti.kick = patchedKick;
  }

  window.addEventListener("DOMContentLoaded", bindHotfix);
  setInterval(() => { bindHotfix(); checkAiTurn(); }, 1000);
})();
