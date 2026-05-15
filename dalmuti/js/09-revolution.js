(() => {
  const db = firebase.firestore();
  const FV = firebase.firestore.FieldValue;

  const roomCol = () => db.collection("events").doc("dalmuti").collection("rooms");
  let watchingRoomId = "";
  let unsub = null;
  let processing = false;

  function sortHand(cards = []) {
    return cards.slice().sort((a, b) => a.rank - b.rank || String(a.id).localeCompare(String(b.id)));
  }

  function removeCards(hand, cards) {
    const ids = new Set((cards || []).map((c) => c.id));
    return (hand || []).filter((c) => !ids.has(c.id));
  }

  function addCards(hand, cards) {
    return sortHand([...(hand || []), ...(cards || [])]);
  }

  function bestNonJoker(hand, count) {
    return sortHand(hand || []).filter((c) => !c.joker && c.rank !== 13).slice(0, count);
  }

  function hasDoubleHong(player) {
    return (player.hand || []).filter((c) => c.joker || c.rank === 13).length >= 2;
  }

  function makeReversedSpecs(players) {
    if (players.length < 3) return [];
    if (players.length === 3) {
      return [{ from: players[0], to: players[2], count: 1 }];
    }
    return [
      { from: players[0], to: players[players.length - 1], count: 2 },
      { from: players[1], to: players[players.length - 2], count: 1 }
    ];
  }

  async function addSystem(roomId, text) {
    await roomCol().doc(roomId).collection("messages").add({
      type: "system",
      text,
      createdAt: FV.serverTimestamp()
    });
  }

  async function checkRevolution(roomId, room) {
    if (processing) return;
    if (!room || room.status !== "tributeReturn") return;
    if (!room.tribute || room.tribute.rebellionChecked) return;
    processing = true;

    try {
      const roomRef = roomCol().doc(roomId);
      const partSnap = await roomRef.collection("participants").get();
      const participants = partSnap.docs.map((doc) => ({ id: doc.id, ref: doc.ref, ...doc.data() }));
      const players = participants
        .filter((p) => p.type === "player")
        .sort((a, b) => (a.seatOrder ?? 999) - (b.seatOrder ?? 999));

      const lowPlayers = players.filter((p) => p.role === "농민" || p.role === "노비");
      const rebellion = lowPlayers.some(hasDoubleHong);

      if (!rebellion) {
        await roomRef.set({
          tribute: { ...room.tribute, rebellionChecked: true, reversed: false },
          updatedAt: FV.serverTimestamp()
        }, { merge: true });
        return;
      }

      const handMap = new Map(players.map((p) => [p.uid, sortHand(p.hand || [])]));

      // Undo the normal tribute that was already applied by the base script.
      (room.tribute.pairs || []).forEach((pair) => {
        handMap.set(pair.toUid, removeCards(handMap.get(pair.toUid), pair.cards || []));
        handMap.set(pair.fromUid, addCards(handMap.get(pair.fromUid), pair.cards || []));
      });

      const newPairs = makeReversedSpecs(players).map((spec, idx) => {
        const cards = bestNonJoker(handMap.get(spec.from.uid), spec.count);
        handMap.set(spec.from.uid, removeCards(handMap.get(spec.from.uid), cards));
        handMap.set(spec.to.uid, addCards(handMap.get(spec.to.uid), cards));
        return {
          id: `rebellion-${idx}`,
          fromUid: spec.from.uid,
          fromNickname: spec.from.nickname,
          toUid: spec.to.uid,
          toNickname: spec.to.nickname,
          count: cards.length,
          cards,
          returned: cards.length === 0,
          returnedCards: []
        };
      }).filter((p) => p.count > 0);

      const batch = db.batch();
      players.forEach((p) => {
        const hand = sortHand(handMap.get(p.uid) || []);
        batch.set(p.ref, { hand, cardCount: hand.length, updatedAt: FV.serverTimestamp() }, { merge: true });
      });
      batch.set(roomRef, {
        status: newPairs.some((p) => !p.returned) ? "tributeReturn" : "playing",
        currentTurnUid: newPairs.some((p) => !p.returned) ? null : (players[0]?.uid || null),
        tribute: {
          phase: "return",
          reversed: true,
          rebellionChecked: true,
          pairs: newPairs,
          returnStartedAt: firebase.firestore.Timestamp.now()
        },
        updatedAt: FV.serverTimestamp()
      }, { merge: true });
      await batch.commit();
      await addSystem(roomId, "홍길동 출현! 민란이 발생했습니다.");
    } catch (err) {
      console.error("Dalmuti revolution check failed", err);
    } finally {
      processing = false;
    }
  }

  function watchCurrentRoom() {
    const roomId = localStorage.getItem("dalmutiCurrentRoomId") || "";
    if (roomId === watchingRoomId) return;
    if (unsub) unsub();
    watchingRoomId = roomId;
    if (!roomId) return;
    unsub = roomCol().doc(roomId).onSnapshot((snap) => {
      if (!snap.exists) return;
      checkRevolution(roomId, snap.data());
    }, console.error);
  }

  window.addEventListener("DOMContentLoaded", () => {
    watchCurrentRoom();
    setInterval(watchCurrentRoom, 1000);
  });
})();
