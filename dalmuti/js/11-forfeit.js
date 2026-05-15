(() => {
  const db = firebase.firestore();
  const FV = firebase.firestore.FieldValue;
  const rooms = () => db.collection("events").doc("dalmuti").collection("rooms");

  let roomId = "";
  let room = null;
  let parts = [];
  let unsubRoom = null;
  let unsubParts = null;
  let processing = false;

  function players() {
    return parts.filter((p) => p.type === "player").sort((a, b) => (a.seatOrder ?? 999) - (b.seatOrder ?? 999));
  }

  function activePlayers() {
    return players().filter((p) => !p.finished && !p.forfeited);
  }

  function nextActiveAfter(uid) {
    const active = activePlayers();
    if (!active.length) return "";
    const idx = Math.max(0, active.findIndex((p) => p.uid === uid));
    for (let step = 1; step <= active.length; step += 1) {
      const target = active[(idx + step) % active.length];
      if (target && !target.finished && !target.forfeited) return target.uid;
    }
    return active[0]?.uid || "";
  }

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

  async function addSystem(text) {
    if (!roomId) return;
    await rooms().doc(roomId).collection("messages").add({
      type: "system",
      text,
      createdAt: FV.serverTimestamp()
    });
  }

  async function finishRoundIfNeeded(batch, roomRef, extraOrder) {
    const currentOrder = Array.isArray(room.finishOrder) ? room.finishOrder.slice() : [];
    const existing = new Set(currentOrder.map((x) => x.uid));
    const finalOrder = currentOrder.concat((extraOrder || []).filter((x) => !existing.has(x.uid)));
    const remaining = activePlayers().filter((p) => !finalOrder.some((x) => x.uid === p.uid));

    if (remaining.length > 1) return false;

    if (remaining.length === 1) {
      finalOrder.push({
        uid: remaining[0].uid,
        nickname: remaining[0].nickname,
        rank: finalOrder.length + 1,
        finishedAt: firebase.firestore.Timestamp.now(),
        auto: true
      });
    }

    const total = players().length;
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

    batch.set(roomRef, {
      status: room.totalRounds && room.round >= room.totalRounds ? "finished" : "betweenRounds",
      currentTurnUid: null,
      currentSet: null,
      previousSet: null,
      tribute: null,
      finishOrder: finalOrder,
      lastRoundResult: {
        round: room.round,
        results: finalOrder,
        endedAt: firebase.firestore.Timestamp.now()
      },
      updatedAt: FV.serverTimestamp()
    }, { merge: true });
    return true;
  }

  async function markAutoTributeReturnTimeouts() {
    if (!room || !room.tribute || !room.tribute.autoCompleted || room.tribute.timeoutMarked) return;
    const pairs = room.tribute.pairs || [];
    const targets = pairs.filter((p) => p.autoReturned).map((p) => p.toUid);
    if (!targets.length) return;

    const roomRef = rooms().doc(roomId);
    const batch = db.batch();
    Array.from(new Set(targets)).forEach((uid) => {
      const p = parts.find((x) => x.uid === uid);
      if (!p) return;
      batch.set(roomRef.collection("participants").doc(uid), {
        timeoutCount: Number(p.timeoutCount || 0) + 1,
        updatedAt: FV.serverTimestamp()
      }, { merge: true });
    });
    batch.set(roomRef, {
      tribute: { ...room.tribute, timeoutMarked: true },
      updatedAt: FV.serverTimestamp()
    }, { merge: true });
    await batch.commit();
  }

  async function applyForfeits() {
    if (!room || processing) return;
    if (!["playing", "tributeReturn"].includes(room.status)) return;
    const targets = players().filter((p) => !p.forfeited && Number(p.timeoutCount || 0) >= 3);
    if (!targets.length) return;
    processing = true;

    try {
      const roomRef = rooms().doc(roomId);
      const batch = db.batch();
      const forfeitOrder = [];

      targets.forEach((p) => {
        forfeitOrder.push({
          uid: p.uid,
          nickname: p.nickname,
          rank: (room.finishOrder || []).length + forfeitOrder.length + 1,
          forfeited: true,
          finishedAt: firebase.firestore.Timestamp.now()
        });
        batch.set(roomRef.collection("participants").doc(p.uid), {
          forfeited: true,
          finished: true,
          hand: [],
          cardCount: 0,
          passed: false,
          finishedRank: (room.finishOrder || []).length + forfeitOrder.length,
          updatedAt: FV.serverTimestamp()
        }, { merge: true });
      });

      const roundFinished = await finishRoundIfNeeded(batch, roomRef, forfeitOrder);
      if (!roundFinished && targets.some((p) => p.uid === room.currentTurnUid)) {
        batch.set(roomRef, {
          currentTurnUid: nextActiveAfter(room.currentTurnUid),
          turnStartedAt: FV.serverTimestamp(),
          turnDeadlineAt: null,
          deadlineTurnUid: null,
          updatedAt: FV.serverTimestamp()
        }, { merge: true });
      }

      await batch.commit();
      for (const p of targets) {
        await addSystem(`${p.nickname}님이 시간초과 누적으로 기권 처리되었습니다.`);
      }
    } catch (err) {
      console.error("Dalmuti forfeit failed", err);
    } finally {
      processing = false;
    }
  }

  async function resetTimeoutOnManualClick() {
    const uid = localStorage.getItem("partyAppUser") || "";
    if (!roomId || !uid) return;
    const player = parts.find((p) => p.uid === uid);
    if (!player || Number(player.timeoutCount || 0) === 0) return;
    await rooms().doc(roomId).collection("participants").doc(uid).set({
      timeoutCount: 0,
      updatedAt: FV.serverTimestamp()
    }, { merge: true });
  }

  function bindManualResetButtons() {
    ["playBtn", "passBtn"].forEach((id) => {
      const btn = document.getElementById(id);
      if (!btn || btn.dataset.timeoutResetBound) return;
      btn.dataset.timeoutResetBound = "true";
      btn.addEventListener("click", () => resetTimeoutOnManualClick().catch(console.error), true);
    });
  }

  async function tick() {
    if (!roomId || !room) return;
    await markAutoTributeReturnTimeouts();
    await applyForfeits();
    bindManualResetButtons();
  }

  function bind(id) {
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

  window.addEventListener("DOMContentLoaded", () => {
    bind(localStorage.getItem("dalmutiCurrentRoomId") || "");
    bindManualResetButtons();
    setInterval(() => bind(localStorage.getItem("dalmutiCurrentRoomId") || ""), 1000);
    setInterval(() => tick().catch(console.error), 700);
  });
})();
