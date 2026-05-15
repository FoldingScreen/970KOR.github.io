// 10_lobby_room.js
// 분리본: 기존 omok.js를 기능별로 나눈 파일입니다.

function setView(name) {
  lobbyView.classList.toggle("show", name === "lobby");
  roomView.classList.toggle("show", name === "room");

  if (buttons.roomSettings) {
    buttons.roomSettings.style.display = name === "room" ? "inline-flex" : "none";
  }

  if (buttons.topLeaveRoom) {
    buttons.topLeaveRoom.style.display = name === "room" ? "inline-flex" : "none";
  }
}
function startRoomListListener() {
  if (roomsUnsub) roomsUnsub();
  roomsUnsub = db.collection("events").doc("omok").collection("rooms")
    .orderBy("updatedAt", "desc")
    .limit(ROOM_LIMIT)
    .onSnapshot(snap => {
      const list = [];
      snap.forEach(doc => {
        const data = doc.data();
        if (data.status !== "finished") list.push({ id: doc.id, ...data });
      });
      renderRoomList(list);
    }, err => {
      console.error("방 목록 로딩 실패", err);
      els.roomList.innerHTML = `<div class="small">방 목록을 불러오지 못했습니다.</div>`;
    });
}
function renderRoomList(list) {
  if (!list.length) {
    els.roomList.innerHTML = `<div class="small">대기 중인 방이 없습니다. 새 방을 만들어보세요.</div>`;
    return;
  }
  els.roomList.innerHTML = list.map(r => {
    const canJoin = r.status === "waiting" && r.host !== linkedUser && !r.white;
    const canWatch = r.settings?.allowSpectators !== false && r.black !== linkedUser && r.white !== linkedUser;
    const mine = r.black === linkedUser || r.white === linkedUser || r.host === linkedUser;
    return `
      <div class="room-item">
        <h4>${escapeHtml(r.host || "오목방")}님의 방</h4>
        <div class="small">
          상태: ${statusText(r.status)}<br>
          흑: ${escapeHtml(r.black || "-")} / 백: ${escapeHtml(r.white || "대기 중")}<br>
          ${r.settings?.allowSpectators === false ? "관전 불가" : `관전 가능 · ${r.settings?.allowAdvice ? "훈수 허용" : "훈수 금지"}`}
        </div>
        <div class="room-actions">
          ${canJoin ? `<button class="mini" onclick="joinRoomAsWhite('${r.id}')">참가</button>` : ""}
          ${canWatch || mine ? `<button class="mini secondary" onclick="enterRoom('${r.id}')">입장</button>` : ""}
        </div>
      </div>
    `;
  }).join("");
}
function statusText(status) {
  return ({ waiting: "상대 대기", playing: "대국 중", betweenRounds: "판 종료 대기", finished: "종료" })[status] || status;
}
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderNicknameButton(nickname) {
  return `
    <button
      type="button"
      class="nickname-link"
      onclick="openUserInfo('${escapeHtml(nickname)}')"
    >${escapeHtml(nickname)}</button>
  `;
}

async function createRoom() {
  try {
    const stats = await ensureUserStats(linkedUser);
    const ref = db.collection("events").doc("omok").collection("rooms").doc();
    const board = emptyBoard();
    await ref.set({
      status: "waiting",
      host: linkedUser,
      black: linkedUser,
      white: null,
      blackRatingBefore: Math.round(stats.rating || DEFAULT_RATING),
      whiteRatingBefore: null,
      blackRatingAfter: null,
      whiteRatingAfter: null,
      blackRatingChange: null,
      whiteRatingChange: null,
      ratingApplied: false,
      turn: "black",
      turnSeq: 1,
      round: 1,
      board,
      moveCount: 0,
      moveHistory: [],
      lastMove: null,
      winLine: [],
      winner: null,
      loser: null,
      lastWinner: null,
      lastLoser: null,
      finishReason: null,
      consecutivePasses: 0,
      nextSeats: { black: null, white: null },
      ready: {},
      playerRequests: {},
      players: {
        [linkedUser]: {
          role: "black",
          connected: true,
          lastSeenAt: FV.serverTimestamp(),
          disconnectedAt: null
        }
      },
settings: {
  allowSpectators: !!els.allowSpectatorsInput.checked,
  allowAdvice: !!els.allowAdviceInput.checked,
  turnLimitSec: Number(els.turnLimitInput?.value || 60)
},
      requestLocks: { undo: {}, draw: {} },
      undoRequest: null,
      drawRequest: null,
      rematchRequest: null,
      matchRequest: null,
      createdAt: FV.serverTimestamp(),
      updatedAt: FV.serverTimestamp(),
      startedAt: null,
      finishedAt: null
    });
    await addSystemChat(ref.id, `${linkedUser}님이 방을 만들었습니다.`);
    enterRoom(ref.id);
  } catch (err) {
    console.error(err);
    showToast("방 생성 실패");
  }
}
window.joinRoomAsWhite = async function joinRoomAsWhite(id) {
  try {
    let requestInfo = null;

    await db.runTransaction(async tx => {
      const ref = roomRef(id);
      const snap = await tx.get(ref);

      if (!snap.exists) throw new Error("방이 없습니다.");

      const r = snap.data();

      if (r.status !== "waiting" || r.white) {
        throw new Error("참가할 수 없는 방입니다.");
      }

      if (r.black === linkedUser) {
        throw new Error("이미 방에 있습니다.");
      }

      if (r.matchRequest?.status === "pending") {
        throw new Error("이미 대국 요청이 진행 중입니다.");
      }

      requestInfo = await buildInitialMatchRequest(r.black, linkedUser);

      tx.update(ref, {
        matchRequest: requestInfo,
        [`players.${linkedUser}`]: {
          role: "spectator",
          connected: true,
          lastSeenAt: FV.serverTimestamp(),
          disconnectedAt: null
        },
        updatedAt: FV.serverTimestamp()
      });
    });

    await addSystemChat(
      id,
      `${requestInfo.requestedBy}님이 ${requestInfo.requestedTo}님에게 대국을 요청했습니다.`
    );

    enterRoom(id);
  } catch (err) {
    console.error(err);
    showToast(err.message || "참가 요청 실패");
  }
};

window.enterRoom = function enterRoom(id) {
  currentRoomId = id;
  localStorage.setItem("omokCurrentRoomId", id);

  setView("room");
  selectedCell = null;
  hoverCell = null;
startRoomListener(id);
startChatListener(id);
startSpectatorListener(id);
startHeartbeat();
};
function startRoomListener(id) {
  if (roomUnsub) roomUnsub();
  roomUnsub = roomRef(id).onSnapshot(snap => {
    if (!snap.exists) {
      showToast("방이 삭제되었습니다.");
      leaveRoomLocal();
      return;
    }
    const prev = room;
    room = { id: snap.id, ...snap.data() };
    reactToRoomChange(prev, room);
    renderRoom();
    drawBoard();
  }, err => {
    console.error("방 로딩 실패", err);
    showToast("방 정보를 불러오지 못했습니다.");
  });
}
function reactToRoomChange(prev, next) {
  if (!prev) return;
  const prevLast = prev.lastMove ? `${prev.lastMove.row}-${prev.lastMove.col}-${prev.lastMove.by}-${prev.moveCount}` : "";
  const nextLast = next.lastMove ? `${next.lastMove.row}-${next.lastMove.col}-${next.lastMove.by}-${next.moveCount}` : "";
  if (prevLast !== nextLast && next.lastMove) playSound("stone");

  const turnKey = `${next.id}-${next.turn}-${next.turnSeq}`;
  if (turnKey !== lastTurnKey) {
    if (next.status === "playing" && myRole() === next.turn) playSound("turn");
    lastTurnKey = turnKey;
  }

  if (prev.status === "playing" && next.status === "betweenRounds") playSound("win");
if (!prev.undoRequest && next.undoRequest?.status === "pending") playSound("request");
if (!prev.drawRequest && next.drawRequest?.status === "pending") playSound("request");
if (!prev.rematchRequest && next.rematchRequest?.status === "pending") playSound("request");
if (!prev.matchRequest && next.matchRequest?.status === "pending") playSound("request");
}
