(() => {
  "use strict";

  if (!window.firebase || !firebase.apps.length) return;

  const db = firebase.firestore();
  const EVENT_ID = "dalmuti";
  const MASTER = "병풍";
  const FV = firebase.firestore.FieldValue;

  const currentUser = () => String(localStorage.getItem("partyAppUser") || "").trim();
  const currentRoomId = () => String(localStorage.getItem("dalmutiCurrentRoomId") || "").trim();
  const roomRef = id => db.collection("events").doc(EVENT_ID).collection("rooms").doc(id);
  const cleanMap = obj => Object.fromEntries(Object.entries(obj || {}).filter(([, v]) => v && typeof v === "object"));

  let unsub = null;
  let watchingRoomId = "";
  const fixedKeys = new Set();

  function orderedUids(room, players) {
    const order = Array.isArray(room.turnOrder) ? room.turnOrder.filter(uid => players[uid]) : [];
    const rest = Object.values(players)
      .filter(p => p && p.uid && !order.includes(p.uid))
      .sort((a, b) => (a.seatOrder ?? 999) - (b.seatOrder ?? 999))
      .map(p => p.uid);
    return order.concat(rest);
  }

  function isActive(p) {
    return p && !p.finished && !p.forfeited && !p.removedFromRoom;
  }

  function nextAfterIncludingFinished(room, uid) {
    const players = cleanMap(room.players);
    const order = orderedUids(room, players);
    if (!order.length || !uid) return null;

    const idx = order.indexOf(uid);
    if (idx < 0) return order.map(id => players[id]).find(isActive)?.uid || null;

    for (let i = 1; i <= order.length; i += 1) {
      const nextUid = order[(idx + i) % order.length];
      if (isActive(players[nextUid])) return nextUid;
    }
    return null;
  }

  async function fixIfNeeded(roomId, room) {
    if (!room || room.status !== "playing") return;
    if (!room.currentSet?.uid) return;

    const me = currentUser();
    if (!(room.hostUid === me || me === MASTER)) return;

    const players = cleanMap(room.players);
    const finisher = players[room.currentSet.uid];
    if (!finisher?.finished) return;

    const expected = nextAfterIncludingFinished(room, room.currentSet.uid);
    if (!expected || room.currentTurnUid === expected) return;

    const key = `${roomId}:${room.round}:${room.currentSet.uid}:${room.currentSet.createdAt?.seconds || room.currentSet.createdAt || "set"}:${expected}`;
    if (fixedKeys.has(key)) return;
    fixedKeys.add(key);

    await roomRef(roomId).set({
      currentTurnUid: expected,
      updatedAt: FV.serverTimestamp()
    }, { merge: true }).catch(err => {
      fixedKeys.delete(key);
      console.error("[dalmuti] finish turn fix failed", err);
    });
  }

  function watchRoom(roomId) {
    if (!roomId || roomId === watchingRoomId) return;
    if (unsub) unsub();
    watchingRoomId = roomId;
    unsub = roomRef(roomId).onSnapshot(snap => {
      if (!snap.exists) return;
      fixIfNeeded(roomId, snap.data()).catch(console.error);
    }, console.error);
  }

  function tick() {
    const roomId = currentRoomId();
    if (roomId) watchRoom(roomId);
  }

  if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", tick);
  else tick();

  document.addEventListener("click", event => {
    if (event.target.closest?.(".room-item button") || event.target.closest?.("#createRoomBtn")) {
      setTimeout(tick, 500);
    }
  }, true);
})();
