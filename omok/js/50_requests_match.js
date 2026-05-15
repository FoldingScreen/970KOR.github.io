// 50_requests_match.js
// 분리본: 기존 omok.js를 기능별로 나눈 파일입니다.

async function resignGame() {
  if (!room || !isPlayer() || room.status !== "playing") return;
  if (!confirm("정말 기권할까요? 승점이 정산됩니다.")) return;
  const winnerColor = opponentColor(myRole());
  await finishRound({ winnerColor, reason: "resign" });
  await addSystemChat(currentRoomId, `${linkedUser}님이 기권했습니다.`);
}
async function requestAction(type) {
  if (!canRequest(type)) return;
const label =
  type === "match"
    ? "대국"
    : type === "undo"
      ? "무르기"
      : type === "draw"
        ? "무승부"
        : "재대국";
  try {
    await roomRef().update({
      [`${type}Request`]: {
        requestedBy: linkedUser,
        requestedAt: FV.serverTimestamp(),
        status: "pending",
        turnSeq: room.turnSeq
      },
      [`requestLocks.${type}.${linkedUser}`]: room.turnSeq,
      updatedAt: FV.serverTimestamp()
    });
    await addSystemChat(currentRoomId, `${linkedUser}님이 ${label}를 요청했습니다.`);
  } catch (err) {
    showToast(`${label} 요청 실패`);
  }
}
window.cancelRequest = async function cancelRequest(type) {
  const label =
    type === "match"
      ? "대국"
      : type === "undo"
        ? "무르기"
        : type === "draw"
          ? "무승부"
          : "재대국";

  const requestField =
    type === "match"
      ? "matchRequest"
      : type === "undo"
        ? "undoRequest"
        : type === "draw"
          ? "drawRequest"
          : "rematchRequest";

  await roomRef().update({
    [requestField]: null,
    updatedAt: FV.serverTimestamp()
  });

  await addSystemChat(currentRoomId, `${linkedUser}님이 ${label} 요청을 취소했습니다.`);
};

window.resolveRequest = async function resolveRequest(type, accepted) {
  if (!room) return;

  const request =
    type === "match"
      ? room.matchRequest
      : type === "undo"
        ? room.undoRequest
        : type === "draw"
          ? room.drawRequest
          : room.rematchRequest;

  if (!request || request.status !== "pending") return;
  if (request.requestedBy === linkedUser) return;
  if (request.requestedTo && request.requestedTo !== linkedUser) return;

  const label =
    type === "match"
      ? "대국"
      : type === "undo"
        ? "무르기"
        : type === "draw"
          ? "무승부"
          : "재대국";

  const requestField =
    type === "match"
      ? "matchRequest"
      : type === "undo"
        ? "undoRequest"
        : type === "draw"
          ? "drawRequest"
          : "rematchRequest";

  if (!accepted) {
    await roomRef().update({
      [requestField]: null,
      updatedAt: FV.serverTimestamp()
    });

    await addSystemChat(currentRoomId, `${linkedUser}님이 ${label} 요청을 거절했습니다.`);
    return;
  }

  if (type === "match") {
    await acceptInitialMatch();
    await addSystemChat(currentRoomId, `${linkedUser}님이 대국 요청을 수락했습니다.`);
    return;
  }

  if (type === "rematch") {
    await acceptRematch();
    await addSystemChat(currentRoomId, `${linkedUser}님이 재대국 요청을 수락했습니다.`);
    return;
  }

  if (type === "draw") {
    await finishRound({ winnerColor: null, reason: "draw" });
    await addSystemChat(currentRoomId, `${linkedUser}님이 무승부 요청을 수락했습니다.`);
    return;
  }

  await acceptUndo();
  await addSystemChat(currentRoomId, `${linkedUser}님이 무르기 요청을 수락했습니다.`);
};

async function acceptInitialMatch() {
  await db.runTransaction(async tx => {
    const ref = roomRef();
    const snap = await tx.get(ref);

    if (!snap.exists) return;

    const r = snap.data();
    const req = r.matchRequest;

    if (!req || req.status !== "pending") return;
    if (req.requestedTo !== linkedUser) return;
    if (r.status !== "waiting") return;

    const black = req.black;
    const white = req.white;

    if (!black || !white) return;

    tx.update(ref, {
      status: "playing",
      black,
      white,
      blackRatingBefore: Math.round(req.blackRating || DEFAULT_RATING),
      whiteRatingBefore: Math.round(req.whiteRating || DEFAULT_RATING),

      turn: "black",
      turnSeq: (r.turnSeq || 1) + 1,
      turnStartedAt: FV.serverTimestamp(),
      startedAt: FV.serverTimestamp(),

      board: emptyBoard(),
      moveCount: 0,
      moveHistory: [],
      lastMove: null,
      winLine: [],
      winner: null,
      loser: null,
      finishReason: null,
      consecutivePasses: 0,

      nextSeats: { black: null, white: null },
      ready: {},

      blackRatingAfter: null,
      whiteRatingAfter: null,
      blackRatingChange: null,
      whiteRatingChange: null,
      ratingApplied: false,

      undoRequest: null,
      drawRequest: null,
      matchRequest: null,
      rematchRequest: null,
      requestLocks: { undo: {}, draw: {} },

      [`players.${black}.role`]: "black",
      [`players.${black}.connected`]: true,
      [`players.${black}.lastSeenAt`]: FV.serverTimestamp(),

      [`players.${white}.role`]: "white",
      [`players.${white}.connected`]: true,
      [`players.${white}.lastSeenAt`]: FV.serverTimestamp(),

      [`playerRequests.${black}`]: FV.delete(),
      [`playerRequests.${white}`]: FV.delete(),

      finishedAt: null,
      updatedAt: FV.serverTimestamp()
    });
  });

  await roomRef()
    .collection("spectators")
    .doc(room?.matchRequest?.black)
    .delete()
    .catch(() => {});

  await roomRef()
    .collection("spectators")
    .doc(room?.matchRequest?.white)
    .delete()
    .catch(() => {});

  showToast("대국을 시작합니다.");
}

async function requestRematch() {
  if (!room || room.status !== "betweenRounds") return;

  if (room.loser !== linkedUser || !room.winner) {
    showToast("패자만 재대국을 요청할 수 있습니다.");
    return;
  }

  if (hasPendingRequest()) {
    showToast("이미 대기 중인 요청이 있습니다.");
    return;
  }

  try {
    await roomRef().update({
      rematchRequest: {
        requestedBy: linkedUser,
        requestedTo: room.winner,
        requestedAt: FV.serverTimestamp(),
        status: "pending"
      },
      updatedAt: FV.serverTimestamp()
    });

    await addSystemChat(
      currentRoomId,
      `${linkedUser}님이 ${room.winner}님에게 재대국을 요청했습니다.`
    );

    showToast("재대국 요청을 보냈습니다.");
  } catch (err) {
    console.error(err);
    showToast("재대국 요청 실패");
  }
}

async function acceptRematch() {
  await db.runTransaction(async tx => {
    const ref = roomRef();
    const snap = await tx.get(ref);

    if (!snap.exists) return;

    const r = snap.data();
    const req = r.rematchRequest;

    if (!req || req.status !== "pending") return;
    if (req.requestedTo !== linkedUser) return;
    if (r.status !== "betweenRounds") return;

    const loser = req.requestedBy;
    const winner = req.requestedTo;

    if (!loser || !winner) return;

    const loserSnap = await tx.get(userRef(loser));
    const winnerSnap = await tx.get(userRef(winner));

    const loserStats = normalizeStats(loserSnap.exists ? loserSnap.data() : null, loser);
    const winnerStats = normalizeStats(winnerSnap.exists ? winnerSnap.data() : null, winner);

    tx.update(ref, {
      status: "playing",

      // 재대국은 패자 흑, 승자 백
      black: loser,
      white: winner,
      blackRatingBefore: Math.round(loserStats.rating || DEFAULT_RATING),
      whiteRatingBefore: Math.round(winnerStats.rating || DEFAULT_RATING),

      turn: "black",
      turnSeq: (r.turnSeq || 1) + 1,
      turnStartedAt: FV.serverTimestamp(),
      round: (r.round || 1) + 1,

      board: emptyBoard(),
      moveCount: 0,
      moveHistory: [],
      lastMove: null,
      winLine: [],
      winner: null,
      loser: null,
      finishReason: null,
      consecutivePasses: 0,

      nextSeats: { black: null, white: null },
      ready: {},

      blackRatingAfter: null,
      whiteRatingAfter: null,
      blackRatingChange: null,
      whiteRatingChange: null,
      ratingApplied: false,

      undoRequest: null,
      drawRequest: null,
      rematchRequest: null,
      matchRequest: null,
      requestLocks: { undo: {}, draw: {} },

      [`players.${loser}.role`]: "black",
      [`players.${loser}.connected`]: true,
      [`players.${loser}.lastSeenAt`]: FV.serverTimestamp(),

      [`players.${winner}.role`]: "white",
      [`players.${winner}.connected`]: true,
      [`players.${winner}.lastSeenAt`]: FV.serverTimestamp(),

      startedAt: FV.serverTimestamp(),
      finishedAt: null,
      updatedAt: FV.serverTimestamp()
    });
  });

  await roomRef()
    .collection("spectators")
    .doc(room?.loser)
    .delete()
    .catch(() => {});

  await roomRef()
    .collection("spectators")
    .doc(room?.winner)
    .delete()
    .catch(() => {});

  showToast("재대국을 시작합니다.");
}

async function acceptUndo() {
  await db.runTransaction(async tx => {
    const ref = roomRef();
    const snap = await tx.get(ref);
    const r = snap.data();
    if (!r.undoRequest || r.undoRequest.status !== "pending") return;
    const history = [...(r.moveHistory || [])];
    const last = history.pop();
    if (!last) return;
    const board = [...(r.board || emptyBoard())];
    board[idx(last.row, last.col)] = null;
    tx.update(ref, {
      board,
      moveHistory: history,
      lastMove: history.length ? history[history.length - 1] : null,
      moveCount: Math.max(0, (r.moveCount || 0) - 1),
turn: last.color,
turnSeq: (r.turnSeq || 1) + 1,
turnStartedAt: FV.serverTimestamp(),
winLine: [],
undoRequest: null,
drawRequest: null,
rematchRequest: null,
      matchRequest: null,
updatedAt: FV.serverTimestamp()
    });
  });
}
async function setReady() {
  if (!room || room.status !== "betweenRounds" || !room.nextSeats) return;
  if (!Object.values(room.nextSeats).includes(linkedUser)) return;
  try {
    await roomRef().update({ [`ready.${linkedUser}`]: true, updatedAt: FV.serverTimestamp() });
    const next = { ...(room.ready || {}), [linkedUser]: true };
    const b = room.nextSeats.black;
    const w = room.nextSeats.white;
    if (b && w && next[b] && next[w]) await startNextRound();
  } catch (err) {
    showToast("준비 실패");
  }
}
async function startNextRound() {
  await db.runTransaction(async tx => {
    const ref = roomRef();
    const snap = await tx.get(ref);
    const r = snap.data();
    if (r.status !== "betweenRounds") return;
    const black = r.nextSeats?.black;
    const white = r.nextSeats?.white;
    if (!black || !white) return;
    if (!r.ready?.[black] || !r.ready?.[white]) return;
    const blackStats = normalizeStats((await tx.get(userRef(black))).data(), black);
    const whiteStats = normalizeStats((await tx.get(userRef(white))).data(), white);
    tx.update(ref, {
      status: "playing",
      black,
      white,
turn: "black",
turnSeq: (r.turnSeq || 1) + 1,
turnStartedAt: FV.serverTimestamp(),
round: (r.round || 1) + 1,
      board: emptyBoard(),
      moveCount: 0,
      moveHistory: [],
      lastMove: null,
      winLine: [],
      winner: null,
      loser: null,
      finishReason: null,
      consecutivePasses: 0,
      nextSeats: { black: null, white: null },
      ready: {},
      blackRatingBefore: Math.round(blackStats.rating || DEFAULT_RATING),
      whiteRatingBefore: Math.round(whiteStats.rating || DEFAULT_RATING),
      blackRatingAfter: null,
      whiteRatingAfter: null,
      blackRatingChange: null,
      whiteRatingChange: null,
      ratingApplied: false,
undoRequest: null,
drawRequest: null,
rematchRequest: null,
      matchRequest: null,
requestLocks: { undo: {}, draw: {} },
      [`players.${black}.role`]: "black",
      [`players.${white}.role`]: "white",
      startedAt: FV.serverTimestamp(),
      finishedAt: null,
      updatedAt: FV.serverTimestamp()
    });
  });
  await addSystemChat(currentRoomId, `다음 판이 시작되었습니다.`);
}
async function leaveSeat() {
  if (!room || room.status !== "betweenRounds" || !isPlayer()) return;
  if (!confirm("다음 판 자리에서 내려가고 관전자로 남을까요?")) return;
  const role = myRole();
  await roomRef().update({
    [`nextSeats.${role}`]: null,
    [`players.${linkedUser}.role`]: "spectator",
    updatedAt: FV.serverTimestamp()
  });
  await addSystemChat(currentRoomId, `${linkedUser}님이 관전자로 내려갔습니다.`);
}
async function toggleWantPlay() {
  if (!room || isPlayer()) return;

  const wants = !!room.playerRequests?.[linkedUser];
  const spectatorRef = roomRef().collection("spectators").doc(linkedUser);

  if (wants) {
    await roomRef().update({
      [`playerRequests.${linkedUser}`]: FV.delete(),
      updatedAt: FV.serverTimestamp()
    });

    await spectatorRef.set({
      nickname: linkedUser,
      wantsToPlay: false,
      lastSeenAt: FV.serverTimestamp(),
      updatedAt: FV.serverTimestamp()
    }, { merge: true });

    await addSystemChat(currentRoomId, `${linkedUser}님이 참여 희망을 취소했습니다.`);
    return;
  }

  await roomRef().set({
    playerRequests: {
      [linkedUser]: {
        nickname: linkedUser,
        requestedAt: FV.serverTimestamp()
      }
    },
    [`players.${linkedUser}.role`]: "spectator",
    [`players.${linkedUser}.lastSeenAt`]: FV.serverTimestamp(),
    updatedAt: FV.serverTimestamp()
  }, { merge: true });

  await spectatorRef.set({
    nickname: linkedUser,
    wantsToPlay: true,
    lastSeenAt: FV.serverTimestamp(),
    updatedAt: FV.serverTimestamp()
  }, { merge: true });

  await addSystemChat(currentRoomId, `${linkedUser}님이 대국 참여를 희망합니다.`);
}

