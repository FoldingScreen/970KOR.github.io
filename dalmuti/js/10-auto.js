(() => {
  const db = firebase.firestore();
  const FV = firebase.firestore.FieldValue;
  const rooms = () => db.collection("events").doc("dalmuti").collection("rooms");

  let roomId = "";
  let unsubRoom = null;
  let unsubParts = null;
  let room = null;
  let parts = [];
  let processing = false;

  const nowMs = () => Date.now();
  const tsFromMs = (ms) => firebase.firestore.Timestamp.fromMillis(ms);
  const toMs = (ts) => ts?.toMillis ? ts.toMillis() : 0;
  const sortHand = (cards = []) => cards.slice().sort((a, b) => a.rank - b.rank || String(a.id).localeCompare(String(b.id)));
  const players = () => parts.filter((p) => p.type === "player").sort((a, b) => (a.seatOrder ?? 999) - (b.seatOrder ?? 999));
  const activePlayers = () => players().filter((p) => !p.finished && !p.forfeited);
  const roleByIndex = (i, count) => ({
    2: ["사바나", "노비"],
    3: ["사바나", "농민", "노비"],
    4: ["사바나", "세자", "농민", "노비"],
    5: ["사바나", "세자", "사또", "농민", "노비"],
    6: ["사바나", "세자", "암행어사", "사또", "농민", "노비"],
    7: ["사바나", "세자", "관찰사", "암행어사", "사또", "농민", "노비"],
    8: ["사바나", "세자", "영의정", "관찰사", "암행어사", "사또", "농민", "노비"]
  }[count] || [])[i] || `${i + 1}등`;

  function nextActiveAfter(uid) {
    const active = activePlayers();
    if (!active.length) return "";
    const idx = Math.max(0, active.findIndex((p) => p.uid === uid));
    for (let step = 1; step <= active.length; step += 1) {
      const t = active[(idx + step) % active.length];
      if (t && !t.finished && !t.forfeited) return t.uid;
    }
    return active[0]?.uid || "";
  }

  function weakestCards(hand, count) {
    const normal = (hand || []).filter((c) => !c.joker && c.rank !== 13).sort((a, b) => b.rank - a.rank || String(a.id).localeCompare(String(b.id)));
    const joker = (hand || []).filter((c) => c.joker || c.rank === 13).sort((a, b) => String(a.id).localeCompare(String(b.id)));
    return normal.concat(joker).slice(0, count);
  }

  function removeCards(hand, cards) {
    const ids = new Set((cards || []).map((c) => c.id));
    return (hand || []).filter((c) => !ids.has(c.id));
  }

  function addCards(hand, cards) {
    return sortHand([...(hand || []), ...(cards || [])]);
  }

  function comboText(card) {
    if (!card) return "";
    return card.name || (card.joker ? "홍길동" : String(card.rank));
  }

  async function addSystem(text) {
    if (!roomId) return;
    await rooms().doc(roomId).collection("messages").add({ type: "system", text, createdAt: FV.serverTimestamp() });
  }

  async function ensurePlayingDeadline() {
    if (!room || room.status !== "playing" || !room.currentTurnUid) return;
    if (room.turnDeadlineAt && room.deadlineTurnUid === room.currentTurnUid) return;
    const limit = Number(room.turnLimit || 15);
    await rooms().doc(roomId).set({
      turnStartedAt: FV.serverTimestamp(),
      turnDeadlineAt: tsFromMs(nowMs() + limit * 1000),
      deadlineTurnUid: room.currentTurnUid,
      updatedAt: FV.serverTimestamp()
    }, { merge: true });
  }

  async function ensureTributeDeadline() {
    if (!room || room.status !== "tributeReturn" || !room.tribute) return;
    if (room.tribute.returnDeadlineAt) return;
    await rooms().doc(roomId).set({
      tribute: { ...room.tribute, returnDeadlineAt: tsFromMs(nowMs() + 15000) },
      updatedAt: FV.serverTimestamp()
    }, { merge: true });
  }

  async function autoReturnTribute() {
    if (!room || room.status !== "tributeReturn" || !room.tribute) return;
    const deadline = toMs(room.tribute.returnDeadlineAt);
    if (!deadline || nowMs() < deadline) return;
    if (processing) return;
    processing = true;
    try {
      const roomRef = rooms().doc(roomId);
      const pairList = room.tribute.pairs || [];
      const openPairs = pairList.filter((p) => !p.returned);
      if (!openPairs.length) return;

      const batch = db.batch();
      const mutable = new Map(parts.map((p) => [p.uid, { ...p, hand: sortHand(p.hand || []) }]));
      const nextPairs = pairList.map((pair) => {
        if (pair.returned) return pair;
        const to = mutable.get(pair.toUid);
        const from = mutable.get(pair.fromUid);
        const cards = weakestCards(to?.hand || [], pair.count);
        if (to) to.hand = removeCards(to.hand, cards);
        if (from) from.hand = addCards(from.hand, cards);
        return { ...pair, returned: true, returnedCards: cards, autoReturned: true };
      });

      mutable.forEach((p) => {
        if (p.type === "player") batch.set(roomRef.collection("participants").doc(p.uid), { hand: sortHand(p.hand || []), cardCount: (p.hand || []).length, updatedAt: FV.serverTimestamp() }, { merge: true });
      });

      const first = players()[0]?.uid || null;
      batch.set(roomRef, {
        status: "playing",
        currentTurnUid: first,
        tribute: { ...room.tribute, pairs: nextPairs, autoCompleted: true },
        turnStartedAt: FV.serverTimestamp(),
        turnDeadlineAt: tsFromMs(nowMs() + Number(room.turnLimit || 15) * 1000),
        deadlineTurnUid: first,
        updatedAt: FV.serverTimestamp(),
        autoActionSeq: FV.increment(1)
      }, { merge: true });
      await batch.commit();
      await addSystem("상납 반환 시간이 초과되어 자동 반환되었습니다.");
    } catch (err) {
      console.error("Dalmuti auto tribute return failed", err);
    } finally {
      processing = false;
    }
  }

  async function finishRound(finalOrder) {
    const total = players().length;
    const roomRef = rooms().doc(roomId);
    const batch = db.batch();
    finalOrder.forEach((r, i) => {
      const score = total - i;
      batch.set(roomRef.collection("participants").doc(r.uid), {
        score: FV.increment(score),
        lastRoundScore: score,
        lastRoundRank: i + 1,
        role: roleByIndex(i, total),
        seatOrder: i,
        finished: true,
        finishedRank: i + 1,
        updatedAt: FV.serverTimestamp()
      }, { merge: true });
    });
    const finished = room.totalRounds && room.round >= room.totalRounds;
    batch.set(roomRef, {
      status: finished ? "finished" : "betweenRounds",
      currentTurnUid: null,
      currentSet: null,
      previousSet: null,
      tribute: null,
      finishOrder: finalOrder,
      lastRoundResult: { round: room.round, results: finalOrder, endedAt: firebase.firestore.Timestamp.now() },
      updatedAt: FV.serverTimestamp(),
      autoActionSeq: FV.increment(1)
    }, { merge: true });
    await batch.commit();
    await addSystem(finished ? "게임이 종료되었습니다." : `${room.round}라운드가 종료되었습니다.`);
  }

  async function autoPlayWeakest(current) {
    const hand = sortHand(current.hand || []);
    const cards = weakestCards(hand, 1);
    if (!cards.length) return;
    const card = cards[0];
    const newHand = removeCards(hand, cards);
    const finishOrder = (room.finishOrder || []).slice();
    let finishedRank = current.finishedRank || null;
    const finished = newHand.length === 0;
    if (finished && !current.finished) {
      finishedRank = finishOrder.length + 1;
      finishOrder.push({ uid: current.uid, nickname: current.nickname, rank: finishedRank, finishedAt: firebase.firestore.Timestamp.now(), auto: true });
    }
    const remaining = players().filter((p) => p.uid !== current.uid && !p.finished && !p.forfeited).length + (finished ? 0 : 1);
    const roomRef = rooms().doc(roomId);
    const setData = { uid: current.uid, nickname: current.nickname, effectiveRank: card.rank, effectiveName: comboText(card), count: 1, cards, createdAt: firebase.firestore.Timestamp.now(), autoPlayed: true };
    const batch = db.batch();
    batch.set(roomRef.collection("participants").doc(current.uid), {
      hand: newHand,
      cardCount: newHand.length,
      finished,
      finishedRank,
      timeoutCount: Number(current.timeoutCount || 0) + 1,
      updatedAt: FV.serverTimestamp()
    }, { merge: true });
    players().forEach((p) => { if (p.uid !== current.uid) batch.set(roomRef.collection("participants").doc(p.uid), { passed: false }, { merge: true }); });
    if (remaining <= 1) {
      const last = players().find((p) => p.uid !== current.uid && !p.finished && !p.forfeited);
      const finalOrder = finishOrder.slice();
      if (last) finalOrder.push({ uid: last.uid, nickname: last.nickname, rank: finalOrder.length + 1, finishedAt: firebase.firestore.Timestamp.now(), auto: true });
      batch.set(roomRef, { currentTurnUid: null, previousSet: room.currentSet || null, currentSet: setData, finishOrder: finalOrder, updatedAt: FV.serverTimestamp() }, { merge: true });
      await batch.commit();
      await finishRound(finalOrder);
    } else {
      batch.set(roomRef, {
        previousSet: room.currentSet || null,
        currentSet: setData,
        currentTurnUid: nextActiveAfter(current.uid),
        finishOrder,
        turnStartedAt: FV.serverTimestamp(),
        turnDeadlineAt: tsFromMs(nowMs() + Number(room.turnLimit || 15) * 1000),
        deadlineTurnUid: nextActiveAfter(current.uid),
        updatedAt: FV.serverTimestamp(),
        autoActionSeq: FV.increment(1)
      }, { merge: true });
      await batch.commit();
    }
    await addSystem(`${current.nickname}님이 시간초과로 ${comboText(card)} 1장을 자동 제출했습니다.`);
  }

  async function autoPass(current) {
    const active = activePlayers().map((p) => p.uid);
    const others = active.filter((uid) => uid !== room.currentSet.uid);
    const passed = new Set(players().filter((p) => p.passed).map((p) => p.uid));
    passed.add(current.uid);
    const trickOver = others.every((uid) => passed.has(uid));
    const roomRef = rooms().doc(roomId);
    const batch = db.batch();
    batch.set(roomRef.collection("participants").doc(current.uid), {
      passed: true,
      timeoutCount: Number(current.timeoutCount || 0) + 1,
      updatedAt: FV.serverTimestamp()
    }, { merge: true });
    const nextUid = trickOver
      ? (players().find((p) => p.uid === room.currentSet.uid && !p.finished && !p.forfeited)?.uid || nextActiveAfter(room.currentSet.uid))
      : nextActiveAfter(current.uid);
    if (trickOver) {
      players().forEach((p) => batch.set(roomRef.collection("participants").doc(p.uid), { passed: false }, { merge: true }));
      batch.set(roomRef, { currentTurnUid: nextUid, previousSet: room.currentSet, currentSet: null }, { merge: true });
    } else {
      batch.set(roomRef, { currentTurnUid: nextUid }, { merge: true });
    }
    batch.set(roomRef, {
      turnStartedAt: FV.serverTimestamp(),
      turnDeadlineAt: tsFromMs(nowMs() + Number(room.turnLimit || 15) * 1000),
      deadlineTurnUid: nextUid,
      updatedAt: FV.serverTimestamp(),
      autoActionSeq: FV.increment(1)
    }, { merge: true });
    await batch.commit();
    await addSystem(`${current.nickname}님이 시간초과로 자동 패스했습니다.`);
  }

  async function autoTurnAction() {
    if (!room || room.status !== "playing" || !room.currentTurnUid) return;
    const deadline = toMs(room.turnDeadlineAt);
    if (!deadline || room.deadlineTurnUid !== room.currentTurnUid || nowMs() < deadline) return;
    if (processing) return;
    processing = true;
    try {
      const current = players().find((p) => p.uid === room.currentTurnUid);
      if (!current || current.finished || current.forfeited) {
        await rooms().doc(roomId).set({ currentTurnUid: nextActiveAfter(room.currentTurnUid), updatedAt: FV.serverTimestamp() }, { merge: true });
        return;
      }
      if (!room.currentSet) await autoPlayWeakest(current);
      else await autoPass(current);
    } catch (err) {
      console.error("Dalmuti auto turn failed", err);
    } finally {
      processing = false;
    }
  }

  async function tick() {
    if (!roomId || !room) return;
    await ensurePlayingDeadline();
    await ensureTributeDeadline();
    await autoReturnTribute();
    await autoTurnAction();
  }

  function bindRoom(id) {
    if (id === roomId) return;
    if (unsubRoom) unsubRoom();
    if (unsubParts) unsubParts();
    roomId = id;
    room = null;
    parts = [];
    if (!roomId) return;
    const roomRef = rooms().doc(roomId);
    unsubRoom = roomRef.onSnapshot((snap) => { room = snap.exists ? { id: snap.id, ...snap.data() } : null; }, console.error);
    unsubParts = roomRef.collection("participants").onSnapshot((snap) => { parts = snap.docs.map((d) => ({ id: d.id, ...d.data() })); }, console.error);
  }

  window.addEventListener("DOMContentLoaded", () => {
    bindRoom(localStorage.getItem("dalmutiCurrentRoomId") || "");
    setInterval(() => bindRoom(localStorage.getItem("dalmutiCurrentRoomId") || ""), 1000);
    setInterval(() => tick().catch(console.error), 500);
  });
})();
