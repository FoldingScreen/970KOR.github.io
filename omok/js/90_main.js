// 90_main.js
// 분리본: 기존 omok.js를 기능별로 나눈 파일입니다.

canvas.addEventListener("pointermove", e => {
  if (isMobileInput()) return;

  hoverCell = cellFromEvent(e);
  drawBoard();
});

canvas.addEventListener("pointerleave", () => {
  hoverCell = null;
  drawBoard();
});

canvas.addEventListener("pointerdown", async e => {
  e.preventDefault();

  const cell = cellFromEvent(e);
  if (!cell) return;

  if (isMobileInput()) {
    selectedCell = cell;
    renderSelectedInfo();
    renderButtons();
    drawBoard();

    const result = canPlaceAt(cell.row, cell.col);

    if (!result.ok) {
      playSound("forbidden");
      showToast(result.reason);
    }

    return;
  }

  await tryPlace(cell.row, cell.col);
});

buttons.createRoom.addEventListener("click", createRoom);
buttons.refreshRooms.addEventListener("click", startRoomListListener);
buttons.homeBrand.addEventListener("click", () => location.href = "../");
buttons.sound.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  localStorage.setItem("omokSoundEnabled", String(soundEnabled));
  setSoundButton();
});
buttons.place.addEventListener("click", placeSelected);
buttons.rematch.addEventListener("click", requestRematch);
buttons.pass.addEventListener("click", passTurn);
buttons.undo.addEventListener("click", () => requestAction("undo"));
buttons.draw.addEventListener("click", () => requestAction("draw"));
buttons.resign.addEventListener("click", resignGame);
buttons.ready.addEventListener("click", setReady);
buttons.leaveSeat.addEventListener("click", leaveSeat);
buttons.topLeaveRoom.addEventListener("click", leaveRoom);
buttons.wantPlay.addEventListener("click", toggleWantPlay);
buttons.sendChat.addEventListener("click", sendChat);
buttons.roomSettings.addEventListener("click", () => {
  renderRoomSettings();
  els.settingsOverlay?.classList.add("show");
});

buttons.settingsClose.addEventListener("click", () => {
  els.settingsOverlay?.classList.remove("show");
});

buttons.requestAccept.addEventListener("click", () => {
  if (activeRequestType) resolveRequest(activeRequestType, true);
});

buttons.requestReject.addEventListener("click", () => {
  if (activeRequestType) resolveRequest(activeRequestType, false);
});
$("userInfoCloseBtn").addEventListener("click", closeUserInfo);

$("userInfoOverlay").addEventListener("click", e => {
  if (e.target.id === "userInfoOverlay") closeUserInfo();
});
$("settingsOverlay").addEventListener("click", e => {
  if (e.target.id === "settingsOverlay") {
    els.settingsOverlay?.classList.remove("show");
  }
});

$("requestOverlay").addEventListener("click", e => {
  // 요청 모달은 실수로 닫히면 애매하니까 바깥 클릭으로는 닫지 않음
});
els.chatInput.addEventListener("keydown", e => { if (e.key === "Enter") sendChat(); });
window.addEventListener("beforeunload", () => {
  if (!currentRoomId || !linkedUser) return;
  try {
    roomRef().set({
      [`players.${linkedUser}.connected`]: false,
      [`players.${linkedUser}.disconnectedAt`]: FV.serverTimestamp(),
      updatedAt: FV.serverTimestamp()
    }, { merge: true });
  } catch (_) {}
});

async function init() {
  linkedUser = String(localStorage.getItem("partyAppUser") || "").trim();

  if (!linkedUser) {
    alert("970KOR 로그인 후 이용할 수 있습니다.");
    location.href = "../";
    return;
  }

  setSoundButton();
  await refreshMyStats();
  startRoomListListener();

  const savedRoomId = localStorage.getItem("omokCurrentRoomId");

  if (savedRoomId) {
    try {
      const snap = await roomRef(savedRoomId).get();

      if (snap.exists) {
        const savedRoom = snap.data();
        const players = savedRoom.players || {};
        const isInRoom =
          savedRoom.black === linkedUser ||
          savedRoom.white === linkedUser ||
          !!players[linkedUser] ||
          !!savedRoom.playerRequests?.[linkedUser];

        const canSpectate =
          savedRoom.settings?.allowSpectators !== false &&
          savedRoom.status !== "finished";

        if (isInRoom || canSpectate) {
          enterRoom(savedRoomId);
          showToast("대국방으로 복귀했습니다.");
          return;
        }
      }

      localStorage.removeItem("omokCurrentRoomId");
    } catch (err) {
      console.error(err);
      localStorage.removeItem("omokCurrentRoomId");
    }
  }

  setView("lobby");
  drawBoard();
}
init();
