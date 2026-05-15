// 60_chat_userinfo.js
// 분리본: 기존 omok.js를 기능별로 나눈 파일입니다.

async function leaveRoomLocal() {
if (roomUnsub) roomUnsub();
if (chatUnsub) chatUnsub();
if (spectatorUnsub) spectatorUnsub();
  spectatorUnsub = null;
spectators = [];
  stopHeartbeat();
  roomUnsub = null;
  chatUnsub = null;
  localStorage.removeItem("omokCurrentRoomId");
  currentRoomId = null;
  room = null;
  selectedCell = null;
  hoverCell = null;
  setView("lobby");
  await refreshMyStats();
  startRoomListListener();
}
async function leaveRoom() {
  if (currentRoomId && room) {
    try {
      const seatsNow = getSeatPlayers(room);

      const wasSeatBlack = seatsNow.black === linkedUser;
      const wasSeatWhite = seatsNow.white === linkedUser;
      const wasSeatPlayer = wasSeatBlack || wasSeatWhite;

      const otherColor = wasSeatBlack ? "white" : wasSeatWhite ? "black" : null;
      const remainingPlayer = otherColor ? seatsNow[otherColor] : null;

      const firstWaiting = getFirstWaitingPlayer([
        linkedUser,
        remainingPlayer
      ]);

      const updates = {
        [`players.${linkedUser}`]: FV.delete(),
        [`playerRequests.${linkedUser}`]: FV.delete(),
        [`ready.${linkedUser}`]: FV.delete(),
        updatedAt: FV.serverTimestamp()
      };

      // 실제 현재 대국자 자리에서도 제거
      if (room.black === linkedUser) {
        updates.black = null;
        updates.blackRatingBefore = null;
      }

      if (room.white === linkedUser) {
        updates.white = null;
        updates.whiteRatingBefore = null;
      }

      // 다음 판 예정 좌석에서도 제거
      if (room.nextSeats?.black === linkedUser) {
        updates["nextSeats.black"] = null;
      }

      if (room.nextSeats?.white === linkedUser) {
        updates["nextSeats.white"] = null;
      }

      // 대국자가 나갔고, 남은 대국자 + 첫 번째 대기자가 있으면 자동 매칭
      if (wasSeatPlayer && remainingPlayer && firstWaiting) {
        const arranged = await arrangeSeatsByRating(remainingPlayer, firstWaiting);

        if (room.status === "playing") {
          Object.assign(updates, {
            status: "playing",
            black: arranged.black,
            white: arranged.white,
            blackRatingBefore: arranged.blackRating,
            whiteRatingBefore: arranged.whiteRating,
            turn: "black",
            turnSeq: (room.turnSeq || 1) + 1,
            turnStartedAt: FV.serverTimestamp(),
            round: (room.round || 1) + 1,

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
            ratingApplied: false,
            undoRequest: null,
            drawRequest: null,
            requestLocks: { undo: {}, draw: {} },

            [`players.${arranged.black}.role`]: "black",
            [`players.${arranged.black}.connected`]: true,
            [`players.${arranged.black}.lastSeenAt`]: FV.serverTimestamp(),

            [`players.${arranged.white}.role`]: "white",
            [`players.${arranged.white}.connected`]: true,
            [`players.${arranged.white}.lastSeenAt`]: FV.serverTimestamp(),

            [`playerRequests.${firstWaiting}`]: FV.delete()
          });
        } else if (room.status === "betweenRounds") {
          Object.assign(updates, {
            "nextSeats.black": arranged.black,
            "nextSeats.white": arranged.white,

            [`players.${arranged.black}.role`]: "black",
            [`players.${arranged.black}.connected`]: true,
            [`players.${arranged.black}.lastSeenAt`]: FV.serverTimestamp(),

            [`players.${arranged.white}.role`]: "white",
            [`players.${arranged.white}.connected`]: true,
            [`players.${arranged.white}.lastSeenAt`]: FV.serverTimestamp(),

            [`playerRequests.${firstWaiting}`]: FV.delete(),
            ready: {}
          });
        }
      }

      // 대국자가 나갔고, 남은 대국자는 있는데 대기자가 없으면 남은 사람만 대기
      else if (wasSeatPlayer && remainingPlayer && !firstWaiting) {
        const remainingRating = await getUserRating(remainingPlayer);

        Object.assign(updates, {
          status: "waiting",
          black: remainingPlayer,
          white: null,
          blackRatingBefore: remainingRating,
          whiteRatingBefore: null,
          turn: "black",
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
          ratingApplied: false,
          undoRequest: null,
          drawRequest: null,
          matchRequest: null,
          rematchRequest: null,
          requestLocks: { undo: {}, draw: {} },

          [`players.${remainingPlayer}.role`]: "black",
          [`players.${remainingPlayer}.connected`]: true,
          [`players.${remainingPlayer}.lastSeenAt`]: FV.serverTimestamp()
        });
      }

      // 대국자가 나갔고, 남은 대국자는 없지만 대기자가 있으면 첫 대기자가 방장처럼 대기
      else if (wasSeatPlayer && !remainingPlayer && firstWaiting) {
        const waitingRating = await getUserRating(firstWaiting);

        Object.assign(updates, {
          status: "waiting",
          host: firstWaiting,
          black: firstWaiting,
          white: null,
          blackRatingBefore: waitingRating,
          whiteRatingBefore: null,
          turn: "black",
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
          ratingApplied: false,
          undoRequest: null,
          drawRequest: null,
          matchRequest: null,
          rematchRequest: null,
          requestLocks: { undo: {}, draw: {} },

          [`players.${firstWaiting}.role`]: "black",
          [`players.${firstWaiting}.connected`]: true,
          [`players.${firstWaiting}.lastSeenAt`]: FV.serverTimestamp(),

          [`playerRequests.${firstWaiting}`]: FV.delete()
        });
      }

      // 아무도 안 남으면 방 종료
      else if (wasSeatPlayer && !remainingPlayer && !firstWaiting) {
        Object.assign(updates, {
          status: "finished",
          finishedAt: FV.serverTimestamp()
        });
      }

      await roomRef().update(updates);

      await roomRef()
        .collection("spectators")
        .doc(linkedUser)
        .delete()
        .catch(() => {});

      if (firstWaiting && wasSeatPlayer) {
        await roomRef()
          .collection("spectators")
          .doc(firstWaiting)
          .delete()
          .catch(() => {});
      }

      await addSystemChat(currentRoomId, `${linkedUser}님이 방을 나갔습니다.`);

      if (wasSeatPlayer && firstWaiting) {
        await addSystemChat(
          currentRoomId,
          `${firstWaiting}님이 첫 번째 대기자로 자동 승격되었습니다.`
        );
      }
    } catch (err) {
      console.error("방 나가기 처리 실패", err);
    }
  }

  leaveRoomLocal();
}
async function sendChat() {
  const text = sanitizeText(els.chatInput.value);
  if (!text || !room) return;
  const canChat = isPlayer() || !!room.settings?.allowAdvice;
  if (!canChat) {
    showToast("훈수 금지 상태입니다.");
    return;
  }
  els.chatInput.value = "";
  await chatRef().add({
    sender: linkedUser,
    role: myRole(),
    message: text,
    type: "chat",
    createdAt: FV.serverTimestamp()
  });
}
async function addSystemChat(id, text) {
  try {
    await chatRef(id).add({
      sender: "system",
      role: "system",
      message: text,
      type: "system",
      createdAt: FV.serverTimestamp()
    });
  } catch (_) {}
}

window.openUserInfo = async function openUserInfo(nickname) {
  nickname = String(nickname || "").trim();
  if (!nickname) return;

  const overlay = document.getElementById("userInfoOverlay");
  const nameEl = document.getElementById("userInfoName");
  const bodyEl = document.getElementById("userInfoBody");

  nameEl.textContent = nickname;
  bodyEl.innerHTML = `<div class="small">전적을 불러오는 중입니다...</div>`;
  overlay.classList.add("show");

  try {
    const snap = await userRef(nickname).get();
    const s = normalizeStats(snap.exists ? snap.data() : null, nickname);

    const games = Number(s.games || 0);
    const wins = Number(s.wins || 0);
    const losses = Number(s.losses || 0);
    const draws = Number(s.draws || 0);
    const winRate = games ? ((wins / games) * 100).toFixed(1) : "0.0";

    const blackGames = Number(s.blackGames || 0);
    const whiteGames = Number(s.whiteGames || 0);
    const blackWins = Number(s.blackWins || 0);
    const whiteWins = Number(s.whiteWins || 0);

    const blackRate = blackGames ? ((blackWins / blackGames) * 100).toFixed(1) : "0.0";
    const whiteRate = whiteGames ? ((whiteWins / whiteGames) * 100).toFixed(1) : "0.0";

    bodyEl.innerHTML = `
      <div class="user-info-rating">
        <div>
          <span>현재 승점</span>
          <strong>${Math.round(s.rating || DEFAULT_RATING)}</strong>
        </div>
        <div>
          <span>최고 승점</span>
          <strong>${Math.round(s.peakRating || DEFAULT_RATING)}</strong>
        </div>
      </div>

      <div class="user-info-grid">
        <div class="user-info-cell">
          <span>전체 전적</span>
          <strong>${wins}승 ${losses}패 ${draws}무</strong>
        </div>
        <div class="user-info-cell">
          <span>승률</span>
          <strong>${winRate}%</strong>
        </div>
        <div class="user-info-cell">
          <span>현재 연승</span>
          <strong>${s.currentStreak || 0}</strong>
        </div>
        <div class="user-info-cell">
          <span>최고 연승</span>
          <strong>${s.bestStreak || 0}</strong>
        </div>
        <div class="user-info-cell">
          <span>흑돌 전적</span>
          <strong>${blackWins}승 / ${blackGames}전</strong>
          <em>승률 ${blackRate}%</em>
        </div>
        <div class="user-info-cell">
          <span>백돌 전적</span>
          <strong>${whiteWins}승 / ${whiteGames}전</strong>
          <em>승률 ${whiteRate}%</em>
        </div>
        <div class="user-info-cell">
          <span>기권 승/패</span>
          <strong>${s.resignWins || 0}승 / ${s.resignLosses || 0}패</strong>
        </div>
        <div class="user-info-cell">
          <span>시간초과 승/패</span>
          <strong>${s.timeoutWins || 0}승 / ${s.timeoutLosses || 0}패</strong>
        </div>
        <div class="user-info-cell">
          <span>총 수순</span>
          <strong>${s.totalMoves || 0}</strong>
        </div>
        <div class="user-info-cell">
          <span>총 대국 수</span>
          <strong>${games}</strong>
        </div>
      </div>
    `;
  } catch (err) {
    console.error(err);
    bodyEl.innerHTML = `<div class="small">전적 정보를 불러오지 못했습니다.</div>`;
  }
};

function closeUserInfo() {
  document.getElementById("userInfoOverlay")?.classList.remove("show");
}

function renderChat(messages) {
  if (!messages.length) {
    els.chatList.innerHTML = `<div class="small">채팅 없음</div>`;
    renderPlayerChatBubbles([]);
    return;
  }

  const latest = messages[messages.length - 1];

  if (latest.id !== lastChatId && latest.type === "chat" && latest.sender !== linkedUser) {
    playSound("chat");
  }

  lastChatId = latest.id;

  els.chatList.innerHTML = messages.map(m => {
    if (m.type === "system") {
      return `<div class="chat-msg system">${escapeHtml(m.message)}</div>`;
    }

    return `
      <div class="chat-msg">
        <span class="sender">${escapeHtml(m.sender)}</span>
        <span>${escapeHtml(m.message)}</span>
      </div>
    `;
  }).join("");

  els.chatList.scrollTop = els.chatList.scrollHeight;

  renderPlayerChatBubbles(messages);
}

function renderPlayerChatBubbles(messages) {
  const boxes = Array.from(document.querySelectorAll(".player-chat-bubbles"));
  if (!boxes.length || !room) return;

  if (playerBubbleTimer) {
    clearTimeout(playerBubbleTimer);
    playerBubbleTimer = null;
  }

  const now = Date.now();
  const seats = getSeatPlayers();
  const playerNames = [seats.black, seats.white].filter(Boolean);
  const latestByPlayer = {};

  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];

    if (m.type !== "chat") continue;
    if (!playerNames.includes(m.sender)) continue;
    if (latestByPlayer[m.sender]) continue;

    const createdMs = nowMsFromTs(m.createdAt);

    if (!createdMs) continue;
    if (now - createdMs > PLAYER_BUBBLE_VISIBLE_MS) continue;

    latestByPlayer[m.sender] = m;
  }

  const bubbles = playerNames
    .filter(name => latestByPlayer[name])
    .map(name => {
      const color = name === seats.black ? "black" : "white";
      const m = latestByPlayer[name];

      return `
        <div class="player-chat-bubble ${color}">
          <div class="player-chat-name">
            ${color === "black" ? "흑" : "백"} · ${escapeHtml(name)}
          </div>
          <div class="player-chat-text">${escapeHtml(m.message)}</div>
        </div>
      `;
    });

  boxes.forEach(box => {
    box.innerHTML = bubbles.join("");
  });

  if (bubbles.length) {
    playerBubbleTimer = setTimeout(() => {
      document.querySelectorAll(".player-chat-bubbles").forEach(box => {
        box.innerHTML = "";
      });
    }, PLAYER_BUBBLE_VISIBLE_MS);
  }
}
