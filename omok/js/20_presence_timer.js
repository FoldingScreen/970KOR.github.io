// 20_presence_timer.js
// 분리본: 기존 omok.js를 기능별로 나눈 파일입니다.

function startChatListener(id) {
  if (chatUnsub) chatUnsub();
  chatUnsub = chatRef(id).orderBy("createdAt", "asc").limit(80).onSnapshot(snap => {
    const messages = [];
    snap.forEach(doc => messages.push({ id: doc.id, ...doc.data() }));
    renderChat(messages);
  });
}
function startSpectatorListener(id) {
  if (spectatorUnsub) spectatorUnsub();

  spectatorUnsub = roomRef(id)
    .collection("spectators")
    .onSnapshot(snap => {
      spectators = [];

      snap.forEach(doc => {
        const data = doc.data() || {};
        spectators.push({
          id: doc.id,
          nickname: data.nickname || doc.id,
          lastSeenAt: data.lastSeenAt || null,
          wantsToPlay: !!data.wantsToPlay
        });
      });

      spectators.sort((a, b) => a.nickname.localeCompare(b.nickname, "ko"));

      renderSpectatorList();
    }, err => {
      console.error("관전자 목록 로딩 실패", err);
      spectators = [];
      renderSpectatorList();
    });
}
async function syncSpectatorPresence() {
  if (!currentRoomId || !room || !linkedUser) return;

  const role = myRole();
  const ref = roomRef().collection("spectators").doc(linkedUser);

  try {
    if (
      role === "spectator" &&
      room.status !== "finished" &&
      room.settings?.allowSpectators !== false
    ) {
      await ref.set({
        nickname: linkedUser,
        lastSeenAt: FV.serverTimestamp(),
        wantsToPlay: !!room.playerRequests?.[linkedUser],
        updatedAt: FV.serverTimestamp()
      }, { merge: true });
    } else {
      await ref.delete().catch(() => {});
    }
  } catch (err) {
    console.warn("관전자 presence 갱신 실패", err);
  }
}
function startHeartbeat() {
  stopHeartbeat();
  heartbeatTimer = setInterval(updatePresence, 3000);
  staleTimer = setInterval(checkStaleOpponent, 1000);
  updatePresence();
}
function stopHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  if (staleTimer) clearInterval(staleTimer);
  heartbeatTimer = null;
  staleTimer = null;
}
async function updatePresence() {
  if (!currentRoomId || !room) return;
  const role = myRole();
  const update = {
    [`players.${linkedUser}.role`]: role,
    [`players.${linkedUser}.connected`]: true,
    [`players.${linkedUser}.lastSeenAt`]: FV.serverTimestamp(),
    [`players.${linkedUser}.disconnectedAt`]: null,
    updatedAt: FV.serverTimestamp()
  };
  try {
    await roomRef().set(update, { merge: true });
    await syncSpectatorPresence();
  } catch (_) {}
}
function checkStaleOpponent() {
  if (!room || room.status !== "playing" || !isPlayer()) return;

  renderConnectionPanel();

  const timer = getTurnTimerInfo();

  if (!timer) return;

  if (timer.expired) {
    if (myRole() !== room.turn) {
      setMessage(`${colorName(room.turn)} 제한시간 초과`, true);
    }
    return;
  }

  if (isMyTurn()) {
    setMessage(`내 차례입니다. 남은 시간 ${timer.remainSec}초`);
  } else {
    setMessage(`상대 차례입니다. 남은 시간 ${timer.remainSec}초`);
  }
}

function getTurnTimerInfo() {
  if (!room || room.status !== "playing") return null;

  const limitSec = Number(room.settings?.turnLimitSec || 60);
  const startedAt = nowMsFromTs(room.turnStartedAt);

  if (!startedAt) {
    return {
      limitSec,
      elapsedMs: 0,
      remainSec: limitSec,
      expired: false
    };
  }

  const elapsedMs = Math.max(0, Date.now() - startedAt);
  const remainMs = Math.max(0, limitSec * 1000 - elapsedMs);

  return {
    limitSec,
    elapsedMs,
    remainSec: Math.ceil(remainMs / 1000),
    expired: elapsedMs >= limitSec * 1000
  };
}

function renderConnectionPanel() {
  if (!els.connectionPanel) return;

  if (!room || room.status !== "playing") {
    els.connectionPanel.innerHTML = `<div class="small">대국 중에만 제한시간을 표시합니다.</div>`;
    return;
  }

  const timer = getTurnTimerInfo();

  if (!timer) {
    els.connectionPanel.innerHTML = `<div class="small">제한시간 정보를 확인 중입니다.</div>`;
    return;
  }

  const currentPlayer =
    room.turn === "black"
      ? room.black
      : room.white;

  const canClaimTimeWin =
    isPlayer() &&
    myRole() !== room.turn &&
    timer.expired;

  els.connectionPanel.innerHTML = `
    <div class="connection-box ${timer.expired ? "danger" : timer.remainSec <= 10 ? "warn" : ""}">
      <div>
        <strong>${escapeHtml(currentPlayer || colorName(room.turn))}</strong>
        <span>
          ${timer.expired ? "시간 초과" : `남은 시간 ${timer.remainSec}초 / ${timer.limitSec}초`}
        </span>
      </div>
      <button
        class="danger mini"
        type="button"
        onclick="claimTimeWin()"
        ${canClaimTimeWin ? "" : "disabled"}
      >시간패 처리</button>
    </div>
  `;
}

window.claimTimeWin = async function claimTimeWin() {
  if (!room || room.status !== "playing" || !isPlayer()) return;

  const timer = getTurnTimerInfo();

  if (!timer || !timer.expired) {
    showToast("아직 제한시간이 남아 있습니다.");
    return;
  }

  if (myRole() === room.turn) {
    showToast("본인 시간패는 직접 처리할 수 없습니다.");
    return;
  }

  const timedOutColor = room.turn;
  const timedOutName = timedOutColor === "black" ? room.black : room.white;
  const winnerColor = myRole();

  if (!confirm(`${timedOutName}님을 시간패 처리할까요?`)) return;

  try {
    await finishRound({
      winnerColor,
      reason: "timeout"
    });

    await addSystemChat(
      currentRoomId,
      `${timedOutName}님이 착수 제한시간을 초과하여 시간패 처리되었습니다.`
    );

    showToast("시간패 처리 완료");
  } catch (err) {
    console.error(err);
    showToast("시간패 처리 실패");
  }
};

