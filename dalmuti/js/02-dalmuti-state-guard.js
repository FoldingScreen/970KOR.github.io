(() => {
  const db = firebase.firestore();
  const FV = firebase.firestore.FieldValue;
  const roomCol = () => db.collection("events").doc("dalmuti").collection("rooms");
  const currentRoomId = () => String(localStorage.getItem("dalmutiCurrentRoomId") || "").trim();
  const currentUser = () => String(localStorage.getItem("partyAppUser") || "").trim();
  const roomRef = (id = currentRoomId()) => id ? roomCol().doc(id) : null;
  const handRef = (roomId, uid) => roomCol().doc(roomId).collection("hands").doc(uid);
  const cleanMap = obj => Object.fromEntries(Object.entries(obj || {}).filter(([, v]) => v && typeof v === "object"));

  function activePlayers(players) {
    return Object.values(players || {})
      .filter(p => p && !p.finished && !p.forfeited && !p.removedFromRoom)
      .sort((a, b) => (a.seatOrder ?? 999) - (b.seatOrder ?? 999));
  }

  function nextAfter(players, uid) {
    const list = activePlayers(players);
    if (!list.length) return "";
    const idx = list.findIndex(p => p.uid === uid);
    if (idx < 0) return list[0]?.uid || "";
    return list[(idx + 1) % list.length]?.uid || list[0]?.uid || "";
  }

  async function appendSystem(roomId, room, text) {
    const ref = roomRef(roomId);
    const chat = (room.chatPreview || []).slice(-11);
    chat.push({ type: "system", uid: "system", nickname: "", text, createdAt: Date.now() });
    await ref.set({ chatPreview: chat, updatedAt: FV.serverTimestamp() }, { merge: true });
  }

  async function forceKick(uid) {
    const roomId = currentRoomId();
    const me = currentUser();
    const ref = roomRef(roomId);
    if (!roomId || !uid || !ref) return;
    const snap = await ref.get();
    if (!snap.exists) return;
    const room = snap.data();
    if (room.hostUid !== me && me !== "병풍") return alert("방장만 강퇴할 수 있습니다.");
    if (uid === me) return;

    const players = cleanMap(room.players);
    const spectators = cleanMap(room.spectators);
    const target = players[uid] || spectators[uid];
    if (!target) return;
    if (!confirm(`${target.nickname}님을 방에서 내보낼까요?`)) return;

    delete players[uid];
    delete spectators[uid];
    await handRef(roomId, uid).delete().catch(() => null);

    let currentTurnUid = room.currentTurnUid || null;
    if (currentTurnUid === uid) currentTurnUid = nextAfter(players, uid);

    await ref.set({
      players,
      spectators,
      playerCount: Object.keys(players).length,
      spectatorCount: Object.keys(spectators).length,
      currentTurnUid,
      finishOrder: (room.finishOrder || []).filter(x => x.uid !== uid),
      kickNotice: { uid, nickname: target.nickname, at: firebase.firestore.Timestamp.now() },
      updatedAt: FV.serverTimestamp()
    }, { merge: true });

    await appendSystem(roomId, room, `${target.nickname}님이 방장에 의해 강퇴되었습니다.`);
  }

  async function purgeKickedPlayer() {
    const roomId = currentRoomId();
    const ref = roomRef(roomId);
    if (!roomId || !ref) return;
    const snap = await ref.get().catch(() => null);
    if (!snap || !snap.exists) return;
    const room = snap.data();
    const k = room.kickNotice;
    if (!k || !k.uid) return;

    const players = cleanMap(room.players);
    const spectators = cleanMap(room.spectators);
    if (!players[k.uid] && !spectators[k.uid]) return;

    delete players[k.uid];
    delete spectators[k.uid];
    await handRef(roomId, k.uid).delete().catch(() => null);

    let currentTurnUid = room.currentTurnUid || null;
    if (currentTurnUid === k.uid) currentTurnUid = nextAfter(players, k.uid);

    await ref.set({
      players,
      spectators,
      playerCount: Object.keys(players).length,
      spectatorCount: Object.keys(spectators).length,
      currentTurnUid,
      finishOrder: (room.finishOrder || []).filter(x => x.uid !== k.uid),
      updatedAt: FV.serverTimestamp()
    }, { merge: true });
  }

  async function joinAsPlayer() {
    const roomId = currentRoomId();
    const me = currentUser();
    const ref = roomRef(roomId);
    if (!roomId || !me || !ref) return;
    const snap = await ref.get();
    if (!snap.exists) return;
    const room = snap.data();
    if (room.status !== "waiting") return alert("대기 중에만 참가할 수 있습니다.");

    const players = cleanMap(room.players);
    const spectators = cleanMap(room.spectators);
    if (players[me]) return;
    if (Object.keys(players).length >= 8) return alert("최대 8명까지 참가할 수 있습니다.");

    delete spectators[me];
    players[me] = {
      uid: me,
      nickname: me,
      type: "player",
      isReady: false,
      isAI: false,
      seatOrder: Object.keys(players).length,
      role: null,
      score: 0,
      lastRoundScore: 0,
      lastRoundRank: null,
      cardCount: 0,
      passed: false,
      finished: false,
      finishedRank: null,
      forfeited: false,
      removedFromRoom: false
    };

    await ref.set({
      players,
      spectators,
      playerCount: Object.keys(players).length,
      spectatorCount: Object.keys(spectators).length,
      updatedAt: FV.serverTimestamp()
    }, { merge: true });
    await handRef(roomId, me).set({ hand: [] }, { merge: true });
  }

  function fixJoinButtonVisibility() {
    const roomId = currentRoomId();
    const me = currentUser();
    const join = document.getElementById("joinAsPlayerBtn");
    if (!roomId || !me || !join) return;
    const ref = roomRef(roomId);
    ref.get().then(snap => {
      if (!snap.exists) return;
      const room = snap.data();
      const players = cleanMap(room.players);
      const spectators = cleanMap(room.spectators);
      if (room.status === "waiting" && spectators[me] && !players[me]) {
        join.classList.remove("hidden");
        join.onclick = joinAsPlayer;
      }
    }).catch(() => null);
  }

  document.addEventListener("click", e => {
    const btn = e.target.closest && e.target.closest(".kick-btn");
    if (!btn) return;
    const raw = btn.getAttribute("onclick") || "";
    const m = raw.match(/Dalmuti\.kick\('([^']+)'\)/);
    if (!m) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    forceKick(m[1]);
  }, true);

  function bind() {
    if (window.Dalmuti) {
      window.Dalmuti.kick = forceKick;
      window.Dalmuti.becomePlayer = joinAsPlayer;
    }
    const join = document.getElementById("joinAsPlayerBtn");
    if (join) join.onclick = joinAsPlayer;
  }

  window.addEventListener("DOMContentLoaded", bind);
  setInterval(() => {
    bind();
    purgeKickedPlayer();
    fixJoinButtonVisibility();
  }, 700);
})();
