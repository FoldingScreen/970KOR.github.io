// 30_ui_render.js
// 분리본: 기존 omok.js를 기능별로 나눈 파일입니다.

function renderRoom() {
  if (!room) return;
  const role = myRole();
  const board = room.board || emptyBoard();

  els.roomStateText.textContent = `ROUND ${room.round || 1} · ${statusText(room.status)}`;
  els.roomTitle.textContent = `${room.host || "오목"}님의 방`;
const seats = getSeatPlayers();

els.blackName.innerHTML = seats.black ? renderNicknameButton(seats.black) : "대기 중";
els.whiteName.innerHTML = seats.white ? renderNicknameButton(seats.white) : "대기 중";

els.blackRating.textContent =
  room.status === "betweenRounds"
    ? "-"
    : room.blackRatingBefore
      ? `${room.blackRatingBefore}점`
      : "-";

els.whiteRating.textContent =
  room.status === "betweenRounds"
    ? "-"
    : room.whiteRatingBefore
      ? `${room.whiteRatingBefore}점`
      : "-";
  els.turnPill.textContent = room.status === "playing" ? `${colorName(room.turn)} 차례` : statusText(room.status);

  renderSideMatchBox();
  renderRoomSettings();
  renderSpectatorList();
  renderConnectionPanel();
  renderRequests();
  renderButtons();
  renderSelectedInfo();

  if (room.status === "waiting") {
    setMessage(room.black === linkedUser ? "상대를 기다리는 중입니다." : "참가 또는 관전할 수 있습니다.");
  } else if (room.status === "playing") {
    if (role === room.turn) setMessage("내 차례입니다.");
    else if (role === "spectator") setMessage("관전 중입니다.");
    else setMessage("상대 차례입니다.");
  } else if (room.status === "betweenRounds") {
    const winnerText = room.finishReason === "draw" || room.finishReason === "doublePass" ? "무승부" : `${room.winner || "-"} 승리`;
    els.roundResultText.textContent = `${winnerText} · 다음 판 대기 중`;
    setMessage("판이 종료되었습니다. 다음 판 준비 또는 자리 교체가 가능합니다.");
  }

  if (room.status !== "playing" || !selectedCell || board[idx(selectedCell.row, selectedCell.col)]) {
    selectedCell = null;
  }
}
function setMessage(text, warn = false) {
  if (els.messageBar) {
    els.messageBar.textContent = text;
    els.messageBar.classList.toggle("warn", !!warn);
  }

  if (els.sideMessageBar) {
    els.sideMessageBar.textContent = text;
    els.sideMessageBar.classList.toggle("warn", !!warn);
  }
}

function renderSideMatchBox() {
  if (!els.sideMatchBox || !room) return;

  const seats = getSeatPlayers();

  const blackTurn = room.status === "playing" && room.turn === "black";
  const whiteTurn = room.status === "playing" && room.turn === "white";

  const blackText = seats.black ? renderNicknameButton(seats.black) : "대기 중";
  const whiteText = seats.white ? renderNicknameButton(seats.white) : "대기 중";

  const blackRating =
    room.status === "betweenRounds"
      ? "-"
      : room.blackRatingBefore
        ? `${room.blackRatingBefore}점`
        : "-";

  const whiteRating =
    room.status === "betweenRounds"
      ? "-"
      : room.whiteRatingBefore
        ? `${room.whiteRatingBefore}점`
        : "-";

  els.sideMatchBox.innerHTML = `
    <div class="match-row-players">
      <div class="match-player-card black ${blackTurn ? "active-turn" : ""}">
        <span class="stone-dot black"></span>
        <div>
          <small>흑</small>
          <strong>${blackText}</strong>
          <em>${blackRating}</em>
        </div>
      </div>

      <div class="match-player-card white ${whiteTurn ? "active-turn" : ""}">
        <span class="stone-dot white"></span>
        <div>
          <small>백</small>
          <strong>${whiteText}</strong>
          <em>${whiteRating}</em>
        </div>
      </div>
    </div>

    <div id="playerChatBubbles" class="player-chat-bubbles"></div>
  `;
}

function renderRoomSettings() {
  const isHost = room?.host === linkedUser;
  const allowSpectators = room?.settings?.allowSpectators !== false;
  const allowAdvice = !!room?.settings?.allowAdvice;
  const turnLimitSec = Number(room?.settings?.turnLimitSec || 60);

  els.roomSettingsBox.innerHTML = `
    <label class="check-row room-setting-row">
      <input id="roomAllowSpectators" type="checkbox" ${allowSpectators ? "checked" : ""} ${isHost ? "" : "disabled"} />
      <span>관전 허용</span>
    </label>

    <label class="check-row room-setting-row">
      <input id="roomAllowAdvice" type="checkbox" ${allowAdvice ? "checked" : ""} ${isHost ? "" : "disabled"} />
      <span>훈수 허용 관전자 채팅 가능</span>
    </label>

    <div class="room-setting-row setting-select-row">
      <label for="roomTurnLimitSec">착수 제한시간</label>
      <select id="roomTurnLimitSec" ${isHost ? "" : "disabled"}>
        <option value="30" ${turnLimitSec === 30 ? "selected" : ""}>30초</option>
        <option value="60" ${turnLimitSec === 60 ? "selected" : ""}>60초</option>
        <option value="120" ${turnLimitSec === 120 ? "selected" : ""}>120초</option>
        <option value="180" ${turnLimitSec === 180 ? "selected" : ""}>180초</option>
      </select>
    </div>

    ${
      isHost
        ? `<button id="saveRoomSettingsBtn" class="secondary full" type="button">방 설정 저장</button>`
        : `<div class="small">방 설정은 방장만 변경할 수 있습니다.</div>`
    }
  `;

  const saveBtn = document.getElementById("saveRoomSettingsBtn");
  if (saveBtn) {
    saveBtn.onclick = updateRoomSettings;
  }
}

function renderSpectatorList() {
  if (!els.spectatorList) return;

  const seats = getSeatPlayers();
  const activeNames = new Set([seats.black, seats.white].filter(Boolean));

  const visibleSpectators = (spectators || [])
    .filter(s => s.nickname && !activeNames.has(s.nickname));

  if (!visibleSpectators.length) {
    els.spectatorList.innerHTML = `<div class="small">대기자 없음</div>`;
    return;
  }

  els.spectatorList.innerHTML = visibleSpectators.map(s => {
    const lastSeen = nowMsFromTs(s.lastSeenAt);
    const connected = lastSeen && Date.now() - lastSeen <= 10000;
    const wants = !!room?.playerRequests?.[s.nickname] || !!s.wantsToPlay;

    return `
      <div class="spectator-item">
        <div class="spectator-main">
          ${renderNicknameButton(s.nickname)}
          ${
            wants
              ? `<button class="wait-hand" type="button" onclick="promoteWaitingPlayer('${escapeHtml(s.nickname)}')" title="내려가고 대국자로 올리기">🖐️</button>`
              : ""
          }
        </div>
        <span class="${connected ? "online-dot" : "offline-dot"}">${connected ? "접속" : "이탈"}</span>
      </div>
    `;
  }).join("");
}

window.promoteWaitingPlayer = async function promoteWaitingPlayer(nickname) {
  if (!room || !nickname) return;

  if (!room.playerRequests?.[nickname]) {
    showToast("참여 희망자가 아닙니다.");
    return;
  }

  if (nickname === linkedUser) {
    showToast("본인은 직접 올릴 수 없습니다.");
    return;
  }

  try {
// 방 생성 후 상대 대기 상태:
// 바로 시작하지 않고, 낮은 레이팅이 높은 레이팅에게 대국 요청
if (room.status === "waiting" && room.black && !room.white) {
  if (room.black !== linkedUser && room.host !== linkedUser) {
    showToast("방장만 대기자를 올릴 수 있습니다.");
    return;
  }

  if (room.matchRequest?.status === "pending") {
    showToast("이미 대국 요청이 진행 중입니다.");
    return;
  }

  const requestInfo = await buildInitialMatchRequest(room.black, nickname);

  await roomRef().update({
    matchRequest: requestInfo,
    [`players.${nickname}.role`]: "spectator",
    [`players.${nickname}.connected`]: true,
    [`players.${nickname}.lastSeenAt`]: FV.serverTimestamp(),
    [`playerRequests.${nickname}`]: FV.delete(),
    updatedAt: FV.serverTimestamp()
  });

  await addSystemChat(
    currentRoomId,
    `${requestInfo.requestedBy}님이 ${requestInfo.requestedTo}님에게 대국을 요청했습니다.`
  );

  showToast("대국 요청을 보냈습니다.");
  return;
}

    if (room.status !== "betweenRounds") {
      showToast("판 종료 후에만 대기자를 올릴 수 있습니다.");
      return;
    }

    const seatsNow = getSeatPlayers(room);

    const myColor =
      seatsNow.black === linkedUser
        ? "black"
        : seatsNow.white === linkedUser
          ? "white"
          : null;

    if (!myColor) {
      showToast("다음 판 대국자만 대기자를 올릴 수 있습니다.");
      return;
    }

    const otherColor = opponentColor(myColor);
    const leavingPlayer = linkedUser;
    const remainingPlayer = seatsNow[otherColor];

    if (!remainingPlayer) {
      showToast("남은 대국자를 확인할 수 없습니다.");
      return;
    }

    const arranged = await arrangeSeatsByRating(remainingPlayer, nickname);

    await roomRef().update({
      "nextSeats.black": arranged.black,
      "nextSeats.white": arranged.white,

      [`players.${arranged.black}.role`]: "black",
      [`players.${arranged.black}.connected`]: true,
      [`players.${arranged.black}.lastSeenAt`]: FV.serverTimestamp(),

      [`players.${arranged.white}.role`]: "white",
      [`players.${arranged.white}.connected`]: true,
      [`players.${arranged.white}.lastSeenAt`]: FV.serverTimestamp(),

      [`players.${leavingPlayer}.role`]: "spectator",
      [`players.${leavingPlayer}.connected`]: true,
      [`players.${leavingPlayer}.lastSeenAt`]: FV.serverTimestamp(),

      [`playerRequests.${nickname}`]: FV.delete(),

      ready: {},
      updatedAt: FV.serverTimestamp()
    });

    await roomRef()
      .collection("spectators")
      .doc(nickname)
      .delete()
      .catch(() => {});

    await roomRef()
      .collection("spectators")
      .doc(leavingPlayer)
      .set({
        nickname: leavingPlayer,
        wantsToPlay: false,
        lastSeenAt: FV.serverTimestamp(),
        updatedAt: FV.serverTimestamp()
      }, { merge: true });

    await addSystemChat(
      currentRoomId,
      `${leavingPlayer}님이 내려가고 ${nickname}님이 다음 판 대국자로 올라왔습니다. 레이팅 기준으로 ${arranged.black}님이 흑, ${arranged.white}님이 백입니다.`
    );

    showToast(`${nickname}님을 다음 판 대국자로 올렸습니다.`);
  } catch (err) {
    console.error(err);
    showToast("대국자 올리기 실패");
  }
};

async function updateRoomSettings() {
  if (!room || room.host !== linkedUser) {
    showToast("방장만 설정을 변경할 수 있습니다.");
    return;
  }

const allowSpectators = !!document.getElementById("roomAllowSpectators")?.checked;
const allowAdvice = !!document.getElementById("roomAllowAdvice")?.checked;
const turnLimitSec = Number(document.getElementById("roomTurnLimitSec")?.value || 60);

  try {
await roomRef().update({
  "settings.allowSpectators": allowSpectators,
  "settings.allowAdvice": allowAdvice,
  "settings.turnLimitSec": turnLimitSec,
  turnStartedAt: FV.serverTimestamp(),
  updatedAt: FV.serverTimestamp()
});
    await addSystemChat(
      currentRoomId,
     `방 설정이 변경되었습니다. 관전: ${allowSpectators ? "허용" : "불가"} / 훈수: ${allowAdvice ? "허용" : "금지"} / 제한시간: ${turnLimitSec}초`
    );

    showToast("방 설정을 저장했습니다.");
  } catch (err) {
    console.error(err);
    showToast("방 설정 저장 실패");
  }
}

function hasPendingRequest() {
  return (
    room?.undoRequest?.status === "pending" ||
    room?.drawRequest?.status === "pending" ||
    room?.rematchRequest?.status === "pending" ||
    room?.matchRequest?.status === "pending"
  );
}

function canRequest(type) {
  if (!room || room.status !== "playing") return false;
  if (!isMyTurn()) return false;
  if (hasPendingRequest()) return false;
  return room.requestLocks?.[type]?.[linkedUser] !== room.turnSeq;
}
let activeRequestType = null;

function renderRequests() {
  const match = room?.matchRequest;
  const undo = room?.undoRequest;
  const draw = room?.drawRequest;
  const rematch = room?.rematchRequest;

  const pending =
    match?.status === "pending"
      ? match
      : undo?.status === "pending"
        ? undo
        : draw?.status === "pending"
          ? draw
          : rematch?.status === "pending"
            ? rematch
            : null;

  const type =
    match?.status === "pending"
      ? "match"
      : undo?.status === "pending"
        ? "undo"
        : draw?.status === "pending"
          ? "draw"
          : rematch?.status === "pending"
            ? "rematch"
            : null;

  if (!pending) {
    activeRequestType = null;
    closeRequestModal();
    return;
  }

  if (pending.requestedBy === linkedUser) {
    activeRequestType = null;
    closeRequestModal();
    return;
  }

  if (pending.requestedTo && pending.requestedTo !== linkedUser) {
    activeRequestType = null;
    closeRequestModal();
    return;
  }

  if (type !== "match" && !isPlayer()) {
    activeRequestType = null;
    closeRequestModal();
    return;
  }

  activeRequestType = type;

  const label =
    type === "match"
      ? "대국"
      : type === "undo"
        ? "무르기"
        : type === "draw"
          ? "무승부"
          : "재대국";

  els.requestModalTitle.textContent = `${label} 요청`;
  els.requestModalBody.innerHTML = `
    <p><strong>${escapeHtml(pending.requestedBy)}</strong>님이 ${label}를 요청했습니다.</p>
    ${
      type === "match"
        ? `<p class="small">수락하면 ${escapeHtml(pending.black)}님이 흑, ${escapeHtml(pending.white)}님이 백으로 시작합니다.</p>`
        : `<p class="small">수락하시겠습니까?</p>`
    }
  `;

  els.requestOverlay.classList.add("show");
}

function closeRequestModal() {
  els.requestOverlay?.classList.remove("show");
}

function renderButtons() {
  const playing = room.status === "playing";
  const between = room.status === "betweenRounds";
  const myTurn = isMyTurn();
  const selectedOk = selectedCell && canPlaceAt(selectedCell.row, selectedCell.col).ok;

  buttons.place.disabled = !playing || !myTurn || !selectedOk;
  buttons.rematch.disabled = !(
  room.status === "betweenRounds" &&
  room.loser === linkedUser &&
  !!room.winner &&
  !hasPendingRequest()
);
  buttons.pass.disabled = !playing || !myTurn;
  buttons.undo.disabled = !canRequest("undo") || !(room.moveHistory || []).length;
  buttons.draw.disabled = !canRequest("draw");
  buttons.resign.disabled = !playing || !isPlayer();

  els.betweenRoundBox.classList.toggle("show", between);
  buttons.ready.disabled = !between || !room.nextSeats || !Object.values(room.nextSeats).includes(linkedUser);
  buttons.leaveSeat.disabled = !between || !isPlayer();

  const canChat = isPlayer() || !!room.settings?.allowAdvice;
  els.chatInput.disabled = !canChat;
  buttons.sendChat.disabled = !canChat;
  els.chatNotice.textContent = canChat ? "" : "훈수 금지 상태에서는 관전자가 채팅할 수 없습니다.";
    buttons.roomSettings.style.display = currentRoomId ? "inline-flex" : "none";
  buttons.topLeaveRoom.style.display = currentRoomId ? "inline-flex" : "none";
}
function renderSelectedInfo() {
  if (!selectedCell) {
    els.selectedInfo.textContent = "선택 위치 없음";
    return;
  }
  const label = `${String.fromCharCode(65 + selectedCell.col)}${selectedCell.row + 1}`;
  const result = canPlaceAt(selectedCell.row, selectedCell.col);
  els.selectedInfo.textContent = result.ok ? `선택 위치: ${label}` : `선택 위치: ${label} · ${result.reason}`;
}

