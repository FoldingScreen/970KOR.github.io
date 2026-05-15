const firebaseConfig = {
  apiKey: "AIzaSyBu2RrQn8cAwwWaLtw5O8Omwn4-NzHWuc0",
  authDomain: "kor-app-fa47e.firebaseapp.com",
  projectId: "kor-app-fa47e",
  storageBucket: "kor-app-fa47e.firebasestorage.app",
  messagingSenderId: "397749083935",
  appId: "1:397749083935:web:51c7c"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const FV = firebase.firestore.FieldValue;

const SIZE = 15;
const TOTAL = SIZE * SIZE;
const DEFAULT_RATING = 1000;
const MIN_RATING = 100;
const K_FACTOR = 32;
const ROOM_LIMIT = 30;
const RECONNECT_GRACE_MS = 10000;

let linkedUser = "";
let myStats = null;
let currentRoomId = null;
let room = null;
let spectators = [];
let roomsUnsub = null;
let roomUnsub = null;
let chatUnsub = null;
let spectatorUnsub = null;
let heartbeatTimer = null;
let staleTimer = null;
let hoverCell = null;
let selectedCell = null;
let soundEnabled = localStorage.getItem("omokSoundEnabled") !== "false";
let lastTurnKey = "";
let lastChatId = "";
const PLAYER_BUBBLE_VISIBLE_MS = 5000;
let playerBubbleTimer = null;

const $ = (id) => document.getElementById(id);
const lobbyView = $("lobbyView");
const roomView = $("roomView");
const canvas = $("omokCanvas");
const ctx = canvas.getContext("2d");

const els = {
  myNickname: $("myNickname"),
  myRating: $("myRating"),
  myStats: $("myStats"),
  roomList: $("roomList"),
  allowSpectatorsInput: $("allowSpectatorsInput"),
  allowAdviceInput: $("allowAdviceInput"),
  turnLimitInput: $("turnLimitInput"),
  roomStateText: $("roomStateText"),
  roomTitle: $("roomTitle"),
  turnPill: $("turnPill"),
  blackName: $("blackName"),
  whiteName: $("whiteName"),
  blackRating: $("blackRating"),
  whiteRating: $("whiteRating"),
  messageBar: $("messageBar"),
  selectedInfo: $("selectedInfo"),
  betweenRoundBox: $("betweenRoundBox"),
  roundResultText: $("roundResultText"),
  sideMatchBox: $("sideMatchBox"),
  sideMessageBar: $("sideMessageBar"),
  connectionPanel: $("connectionPanel"),
  roomSettingsBox: $("roomSettingsBox"),
  spectatorList: $("spectatorList"),
  requestOverlay: $("requestOverlay"),
  requestModalTitle: $("requestModalTitle"),
  requestModalBody: $("requestModalBody"),
  settingsOverlay: $("settingsOverlay"),
  chatList: $("chatList"),
  chatInput: $("chatInput"),
  chatNotice: $("chatNotice"),
  toast: $("toast"),
  soundBtn: $("soundBtn")
};

const buttons = {
  homeBrand: $("homeBrandBtn"),
  roomSettings: $("roomSettingsBtn"),
  topLeaveRoom: $("topLeaveRoomBtn"),
  sound: $("soundBtn"),
  createRoom: $("createRoomBtn"),
  refreshRooms: $("refreshRoomsBtn"),
  place: $("placeBtn"),
  rematch: $("rematchBtn"),
  pass: $("passBtn"),
  undo: $("undoBtn"),
  draw: $("drawBtn"),
  resign: $("resignBtn"),
  ready: $("readyBtn"),
  leaveSeat: $("leaveSeatBtn"),
  wantPlay: $("wantPlayBtn"),
  sendChat: $("sendChatBtn"),
  requestAccept: $("requestAcceptBtn"),
  requestReject: $("requestRejectBtn"),
  settingsClose: $("settingsCloseBtn")
};

const sounds = {
  stone: new Audio("./assets/sounds/stone.mp3"),
  forbidden: new Audio("./assets/sounds/forbidden.mp3"),
  win: new Audio("./assets/sounds/win.mp3"),
  request: new Audio("./assets/sounds/request.mp3"),
  chat: new Audio("./assets/sounds/chat.mp3"),
  turn: new Audio("./assets/sounds/turn.mp3")
};
Object.values(sounds).forEach(a => { a.volume = 0.65; a.preload = "auto"; });

function emptyBoard() {
  return Array(TOTAL).fill(null);
}
function idx(row, col) {
  return row * SIZE + col;
}
function rowOf(index) {
  return Math.floor(index / SIZE);
}
function colOf(index) {
  return index % SIZE;
}
function inside(row, col) {
  return row >= 0 && row < SIZE && col >= 0 && col < SIZE;
}
function colorName(color) {
  return color === "black" ? "흑" : "백";
}
function opponentColor(color) {
  return color === "black" ? "white" : "black";
}
function getSeatPlayers(source = room) {
  if (!source) {
    return { black: null, white: null };
  }

  if (
    source.status === "betweenRounds" &&
    source.nextSeats &&
    (source.nextSeats.black || source.nextSeats.white)
  ) {
    return {
      black: source.nextSeats.black || null,
      white: source.nextSeats.white || null
    };
  }

  return {
    black: source.black || null,
    white: source.white || null
  };
}

function getRoleOf(nickname, source = room) {
  const seats = getSeatPlayers(source);

  if (seats.black === nickname) return "black";
  if (seats.white === nickname) return "white";

  return "spectator";
}

function myRole() {
  return getRoleOf(linkedUser, room);
}

function isPlayer() {
  const role = myRole();
  return role === "black" || role === "white";
}

function isMyTurn() {
  return room && room.status === "playing" && myRole() === room.turn;
}

function getOpponentNickname() {
  const role = myRole();
  const seats = getSeatPlayers();

  if (role === "black") return seats.white;
  if (role === "white") return seats.black;

  return null;
}

function nowMsFromTs(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (ts.seconds) return ts.seconds * 1000;
  return 0;
}
function showToast(text) {
  els.toast.textContent = text;
  els.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove("show"), 1600);
}
function playSound(name) {
  if (!soundEnabled) return;
  const audio = sounds[name];
  if (!audio) return;
  try {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch (_) {}
}
function setSoundButton() {
  els.soundBtn.textContent = soundEnabled ? "소리 ON" : "소리 OFF";
}
function sanitizeText(text) {
  return String(text || "").replace(/[<>]/g, "").trim().slice(0, 120);
}
function roomRef(id = currentRoomId) {
  return db.collection("events").doc("omok").collection("rooms").doc(id);
}
function userRef(nickname = linkedUser) {
  return db.collection("events").doc("omok").collection("users").doc(nickname);
}
function chatRef(id = currentRoomId) {
  return roomRef(id).collection("chats");
}
function defaultUserStats(nickname) {
  return {
    nickname,
    rating: DEFAULT_RATING,
    peakRating: DEFAULT_RATING,
    games: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    blackGames: 0,
    whiteGames: 0,
    blackWins: 0,
    whiteWins: 0,
    resignWins: 0,
    resignLosses: 0,
    timeoutWins: 0,
    timeoutLosses: 0,
    currentStreak: 0,
    bestStreak: 0,
    totalMoves: 0,
    totalPlaySeconds: 0,
    lastPlayedAt: null,
    updatedAt: null
  };
}
function normalizeStats(data, nickname) {
  return { ...defaultUserStats(nickname), ...(data || {}) };
}
async function ensureUserStats(nickname = linkedUser) {
  const ref = userRef(nickname);
  const snap = await ref.get();
  if (!snap.exists) {
    const fresh = defaultUserStats(nickname);
    await ref.set({
      ...fresh,
      createdAt: FV.serverTimestamp(),
      updatedAt: FV.serverTimestamp()
    }, { merge: true });
    return fresh;
  }
  return normalizeStats(snap.data(), nickname);
}
async function refreshMyStats() {
  myStats = await ensureUserStats(linkedUser);
  renderMyProfile();
}
function renderMyProfile() {
  els.myNickname.textContent = linkedUser;
  els.myRating.textContent = `${Math.round(myStats?.rating || DEFAULT_RATING)}점`;
  const games = Number(myStats?.games || 0);
  const wins = Number(myStats?.wins || 0);
  const losses = Number(myStats?.losses || 0);
  const draws = Number(myStats?.draws || 0);
  const winRate = games ? ((wins / games) * 100).toFixed(1) : "0.0";
  els.myStats.innerHTML = `
    <div class="stat-item"><small>승점</small><strong>${Math.round(myStats?.rating || DEFAULT_RATING)}</strong></div>
    <div class="stat-item"><small>최고점</small><strong>${Math.round(myStats?.peakRating || DEFAULT_RATING)}</strong></div>
    <div class="stat-item"><small>전적</small><strong>${wins}승 ${losses}패 ${draws}무</strong></div>
    <div class="stat-item"><small>승률</small><strong>${winRate}%</strong></div>
    <div class="stat-item"><small>연승</small><strong>${myStats?.currentStreak || 0}</strong></div>
    <div class="stat-item"><small>최고 연승</small><strong>${myStats?.bestStreak || 0}</strong></div>
  `;
}
function getExpectedScore(myRating, opponentRating) {
  return 1 / (1 + Math.pow(10, (opponentRating - myRating) / 400));
}
function calcRatingChange(myRating, opponentRating, result) {
  const expected = getExpectedScore(myRating, opponentRating);
  return Math.round(K_FACTOR * (result - expected));
}

function applyRating(rating, change) {
  return Math.max(MIN_RATING, Math.round((rating || DEFAULT_RATING) + change));
}
async function getUserRating(nickname) {
  if (!nickname) return DEFAULT_RATING;

  try {
    const snap = await userRef(nickname).get();
    const stats = normalizeStats(snap.exists ? snap.data() : null, nickname);
    return Math.round(stats.rating || DEFAULT_RATING);
  } catch (err) {
    console.warn("레이팅 조회 실패:", nickname, err);
    return DEFAULT_RATING;
  }
}

async function arrangeSeatsByRating(nicknameA, nicknameB) {
  const ratingA = await getUserRating(nicknameA);
  const ratingB = await getUserRating(nicknameB);

  // 낮은 레이팅에게 흑 선공 부여
  if (ratingA <= ratingB) {
    return {
      black: nicknameA,
      white: nicknameB,
      blackRating: ratingA,
      whiteRating: ratingB
    };
  }

  return {
    black: nicknameB,
    white: nicknameA,
    blackRating: ratingB,
    whiteRating: ratingA
  };
}

function requestTimeMs(req) {
  if (!req) return 0;
  return nowMsFromTs(req.requestedAt) || 0;
}

function getFirstWaitingPlayer(excludeNames = []) {
  const exclude = new Set(excludeNames.filter(Boolean));
  const entries = Object.entries(room?.playerRequests || {})
    .filter(([name]) => !exclude.has(name))
    .sort((a, b) => {
      const aTime = requestTimeMs(a[1]);
      const bTime = requestTimeMs(b[1]);

      if (aTime !== bTime) return aTime - bTime;
      return a[0].localeCompare(b[0], "ko");
    });

  return entries.length ? entries[0][0] : null;
}

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
    const stats = await ensureUserStats(linkedUser);
    await db.runTransaction(async tx => {
      const ref = roomRef(id);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error("방이 없습니다.");
      const r = snap.data();
      if (r.status !== "waiting" || r.white) throw new Error("참가할 수 없는 방입니다.");
      if (r.black === linkedUser) throw new Error("이미 방에 있습니다.");
      tx.update(ref, {
        white: linkedUser,
        whiteRatingBefore: Math.round(stats.rating || DEFAULT_RATING),
status: "playing",
startedAt: FV.serverTimestamp(),
turnStartedAt: FV.serverTimestamp(),
updatedAt: FV.serverTimestamp(),
        [`players.${linkedUser}`]: {
          role: "white",
          connected: true,
          lastSeenAt: FV.serverTimestamp(),
          disconnectedAt: null
        }
      });
    });
    await addSystemChat(id, `${linkedUser}님이 백돌로 참가했습니다.`);
    enterRoom(id);
  } catch (err) {
    console.error(err);
    showToast(err.message || "참가 실패");
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
}
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
    // 방 생성 후 상대 대기 상태
    if (room.status === "waiting" && room.black && !room.white) {
      if (room.black !== linkedUser && room.host !== linkedUser) {
        showToast("방장만 대기자를 올릴 수 있습니다.");
        return;
      }

      const arranged = await arrangeSeatsByRating(room.black, nickname);

      await roomRef().update({
        black: arranged.black,
        white: arranged.white,
        blackRatingBefore: arranged.blackRating,
        whiteRatingBefore: arranged.whiteRating,
        status: "playing",
        turn: "black",
        startedAt: FV.serverTimestamp(),
        turnStartedAt: FV.serverTimestamp(),

        [`players.${arranged.black}.role`]: "black",
        [`players.${arranged.black}.connected`]: true,
        [`players.${arranged.black}.lastSeenAt`]: FV.serverTimestamp(),

        [`players.${arranged.white}.role`]: "white",
        [`players.${arranged.white}.connected`]: true,
        [`players.${arranged.white}.lastSeenAt`]: FV.serverTimestamp(),

        [`playerRequests.${nickname}`]: FV.delete(),
        ready: {},
        updatedAt: FV.serverTimestamp()
      });

      await roomRef()
        .collection("spectators")
        .doc(nickname)
        .delete()
        .catch(() => {});

      await addSystemChat(
        currentRoomId,
        `${nickname}님이 대국자로 참가했습니다. 레이팅 기준으로 ${arranged.black}님이 흑, ${arranged.white}님이 백입니다.`
      );

      showToast(`${nickname}님이 대국자로 참가했습니다.`);
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
    room?.rematchRequest?.status === "pending"
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
  const undo = room?.undoRequest;
  const draw = room?.drawRequest;
  const rematch = room?.rematchRequest;

  const pending =
    undo?.status === "pending"
      ? undo
      : draw?.status === "pending"
        ? draw
        : rematch?.status === "pending"
          ? rematch
          : null;

  const type =
    undo?.status === "pending"
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

  // 무르기/무승부/재대국 요청은 대국자에게만 표시
  if (!isPlayer()) {
    activeRequestType = null;
    closeRequestModal();
    return;
  }

  // 재대국은 승자에게만 응답 모달 표시
  if (type === "rematch" && pending.requestedTo !== linkedUser) {
    activeRequestType = null;
    closeRequestModal();
    return;
  }

  activeRequestType = type;

  const label =
    type === "undo"
      ? "무르기"
      : type === "draw"
        ? "무승부"
        : "재대국";

  els.requestModalTitle.textContent = `${label} 요청`;
  els.requestModalBody.innerHTML = `
    <p><strong>${escapeHtml(pending.requestedBy)}</strong>님이 ${label}를 요청했습니다.</p>
    <p class="small">수락하시겠습니까?</p>
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

function drawBoard() {
  const board = room?.board || emptyBoard();
  const w = canvas.width;
  const h = canvas.height;
  const pad = 44;
  const cell = (w - pad * 2) / (SIZE - 1);

  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, "#d8a35d");
  grad.addColorStop(0.5, "#b77935");
  grad.addColorStop(1, "#8b5a2b");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(45,26,10,.78)";
  ctx.lineWidth = 1.4;
  for (let i = 0; i < SIZE; i++) {
    const p = pad + i * cell;
    ctx.beginPath();
    ctx.moveTo(pad, p);
    ctx.lineTo(w - pad, p);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p, pad);
    ctx.lineTo(p, h - pad);
    ctx.stroke();
  }

  const stars = [3, 7, 11];
  ctx.fillStyle = "rgba(45,26,10,.85)";
  for (const r of stars) for (const c of stars) {
    const x = pad + c * cell;
    const y = pad + r * cell;
    ctx.beginPath();
    ctx.arc(x, y, 4.3, 0, Math.PI * 2);
    ctx.fill();
  }

  const forbidden = getForbiddenPreviewCells();
  for (const key of forbidden) {
    const [r, c] = key.split("-").map(Number);
    drawForbiddenMark(pad + c * cell, pad + r * cell, cell);
  }

  for (let i = 0; i < board.length; i++) {
    if (!board[i]) continue;
    drawStone(pad + colOf(i) * cell, pad + rowOf(i) * cell, cell * 0.42, board[i]);
  }

  if (room?.lastMove) drawLastMove(pad + room.lastMove.col * cell, pad + room.lastMove.row * cell, cell);
  if (room?.winLine?.length) {
    for (const p of room.winLine) drawWinRing(pad + p.col * cell, pad + p.row * cell, cell);
  }

  const preview = selectedCell || hoverCell;
  if (preview && room?.status === "playing" && isMyTurn()) {
    const result = canPlaceAt(preview.row, preview.col);
    const x = pad + preview.col * cell;
    const y = pad + preview.row * cell;
    if (result.ok) drawPreviewStone(x, y, cell * 0.42, room.turn);
    else drawForbiddenMark(x, y, cell);
  }
}
function drawStone(x, y, r, color) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.45)";
  ctx.shadowBlur = 9;
  ctx.shadowOffsetY = 4;
  const g = ctx.createRadialGradient(x - r * .35, y - r * .45, r * .15, x, y, r);
  if (color === "black") {
    g.addColorStop(0, "#64748b");
    g.addColorStop(.28, "#1e293b");
    g.addColorStop(1, "#020617");
  } else {
    g.addColorStop(0, "#fff");
    g.addColorStop(.55, "#e5e7eb");
    g.addColorStop(1, "#94a3b8");
  }
  ctx.beginPath();
  ctx.fillStyle = g;
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
function drawPreviewStone(x, y, r, color) {
  ctx.save();
  ctx.globalAlpha = .45;
  drawStone(x, y, r, color);
  ctx.restore();
  ctx.beginPath();
  ctx.strokeStyle = "#fde68a";
  ctx.lineWidth = 3;
  ctx.arc(x, y, r + 6, 0, Math.PI * 2);
  ctx.stroke();
}
function drawLastMove(x, y, cell) {
  ctx.beginPath();
  ctx.strokeStyle = "#facc15";
  ctx.lineWidth = 3;
  ctx.arc(x, y, cell * .22, 0, Math.PI * 2);
  ctx.stroke();
}
function drawWinRing(x, y, cell) {
  ctx.beginPath();
  ctx.strokeStyle = "#fde047";
  ctx.lineWidth = 5;
  ctx.arc(x, y, cell * .48, 0, Math.PI * 2);
  ctx.stroke();
}
function drawForbiddenMark(x, y, cell) {
  const r = cell * .28;
  ctx.save();
  ctx.strokeStyle = "rgba(239,68,68,.9)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x - r, y - r);
  ctx.lineTo(x + r, y + r);
  ctx.moveTo(x + r, y - r);
  ctx.lineTo(x - r, y + r);
  ctx.stroke();
  ctx.restore();
}
function cellFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);
  const pad = 44;
  const cell = (canvas.width - pad * 2) / (SIZE - 1);
  const col = Math.round((x - pad) / cell);
  const row = Math.round((y - pad) / cell);
  if (!inside(row, col)) return null;
  const px = pad + col * cell;
  const py = pad + row * cell;
  if (Math.hypot(x - px, y - py) > cell * .56) return null;
  return { row, col };
}
function isMobileInput() {
  return window.matchMedia("(hover: none), (pointer: coarse)").matches;
}

function getForbiddenPreviewCells() {
  const out = new Set();
  if (!room || room.status !== "playing" || !isMyTurn()) return out;
  const board = room.board || emptyBoard();
  for (let i = 0; i < board.length; i++) {
    if (board[i]) continue;
    const r = rowOf(i), c = colOf(i);
    if (isDoubleThree(board, r, c, room.turn)) out.add(`${r}-${c}`);
  }
  return out;
}
function canPlaceAt(row, col) {
  if (!room || room.status !== "playing") return { ok: false, reason: "대국 중이 아닙니다" };
  if (!isMyTurn()) return { ok: false, reason: "내 차례가 아닙니다" };
  if (!inside(row, col)) return { ok: false, reason: "판 밖입니다" };
  const board = room.board || emptyBoard();
  if (board[idx(row, col)]) return { ok: false, reason: "이미 돌이 있습니다" };
  if (isDoubleThree(board, row, col, room.turn)) return { ok: false, reason: "33 금지" };
  return { ok: true, reason: "" };
}
function countDir(board, row, col, color, dr, dc) {
  const line = [{ row, col }];
  let r = row + dr, c = col + dc;
  while (inside(r, c) && board[idx(r, c)] === color) {
    line.push({ row: r, col: c });
    r += dr; c += dc;
  }
  r = row - dr; c = col - dc;
  while (inside(r, c) && board[idx(r, c)] === color) {
    line.unshift({ row: r, col: c });
    r -= dr; c -= dc;
  }
  return line;
}
function checkWin(board, row, col, color) {
  const dirs = [[1,0],[0,1],[1,1],[1,-1]];
  for (const [dr, dc] of dirs) {
    const line = countDir(board, row, col, color, dr, dc);
    if (line.length >= 5) {
      const centerIndex = line.findIndex(p => p.row === row && p.col === col);
      const start = Math.max(0, Math.min(centerIndex - 2, line.length - 5));
      return { win: true, line: line.slice(start, start + 5) };
    }
  }
  return { win: false, line: [] };
}
function isDoubleThree(board, row, col, color) {
  if (board[idx(row, col)]) return false;
  const test = [...board];
  test[idx(row, col)] = color;
  if (checkWin(test, row, col, color).win) return false;
  const dirs = [[1,0],[0,1],[1,1],[1,-1]];
  let openThrees = 0;
  for (const [dr, dc] of dirs) {
    if (hasOpenThree(test, row, col, color, dr, dc)) openThrees++;
  }
  return openThrees >= 2;
}
function hasOpenThree(board, row, col, color, dr, dc) {
  const cells = [];
  const center = 4;

  for (let k = -4; k <= 4; k++) {
    const r = row + dr * k;
    const c = col + dc * k;

    if (!inside(r, c)) {
      cells.push("O");
    } else {
      const v = board[idx(r, c)];
      cells.push(v === color ? "X" : v ? "O" : ".");
    }
  }

  // 중요:
  // 같은 방향에 이미 4목 계열이 만들어진 경우에는
  // 그 줄은 3으로 세면 안 됨.
  // 즉, 43은 허용하고 33만 금지해야 함.
  if (hasFourThreatInLine(cells, center)) {
    return false;
  }

  const patterns = [".XXX.", ".XX.X.", ".X.XX."];

  for (const p of patterns) {
    for (let start = 0; start <= cells.length - p.length; start++) {
      if (center < start || center >= start + p.length) continue;

      const seg = cells.slice(start, start + p.length).join("");

      if (seg === p) {
        return true;
      }
    }
  }

  return false;
}

function hasFourThreatInLine(cells, center) {
  // 5칸 안에 내 돌 4개 + 빈칸 1개면 4목 계열로 본다.
  // 예:
  // XXXX.
  // .XXXX
  // XXX.X
  // XX.XX
  // X.XXX
  //
  // 이런 줄은 3이 아니라 4로 봐야 하므로
  // 33 판정의 open three 카운트에서 제외한다.
  for (let start = 0; start <= cells.length - 5; start++) {
    if (center < start || center >= start + 5) continue;

    const seg = cells.slice(start, start + 5);
    const xCount = seg.filter(v => v === "X").length;
    const dotCount = seg.filter(v => v === ".").length;
    const blocked = seg.some(v => v === "O");

    if (!blocked && xCount === 4 && dotCount === 1) {
      return true;
    }
  }

  return false;
}

async function placeSelected() {
  if (!selectedCell) return;
  await tryPlace(selectedCell.row, selectedCell.col);
}
async function tryPlace(row, col) {
  if (!room || !currentRoomId) return;
  const check = canPlaceAt(row, col);
  if (!check.ok) {
    playSound("forbidden");
    showToast(check.reason);
    return;
  }
  try {
    await db.runTransaction(async tx => {
      const ref = roomRef();
      const snap = await tx.get(ref);
      const r = snap.data();
      if (!r || r.status !== "playing") throw new Error("대국 중이 아닙니다.");
const role = getRoleOf(linkedUser, r);

if (role !== r.turn) {
  throw new Error("내 차례가 아닙니다.");
}
      const board = [...(r.board || emptyBoard())];
      if (board[idx(row, col)]) throw new Error("이미 돌이 있습니다.");
      if (isDoubleThree(board, row, col, r.turn)) throw new Error("33 금지 위치입니다.");

      board[idx(row, col)] = r.turn;
      const win = checkWin(board, row, col, r.turn);
      const move = { row, col, color: r.turn, by: linkedUser, atMs: Date.now() };
      const history = [...(r.moveHistory || []), move].slice(-80);
      const updates = {
        board,
        moveHistory: history,
        lastMove: move,
        moveCount: (r.moveCount || 0) + 1,
        consecutivePasses: 0,
undoRequest: null,
drawRequest: null,
rematchRequest: null,
updatedAt: FV.serverTimestamp()
      };
      if (win.win) {
        Object.assign(updates, buildFinishUpdates(r, r.turn, "five", win.line));
      } else {
updates.turn = opponentColor(r.turn);
updates.turnSeq = (r.turnSeq || 1) + 1;
updates.turnStartedAt = FV.serverTimestamp();
      }
      tx.update(ref, updates);
    });
    selectedCell = null;
    if (room?.status === "betweenRounds") await applyCurrentRoomRating();
  } catch (err) {
    console.error(err);
    showToast(err.message || "착수 실패");
  }
}
function buildFinishUpdates(r, winnerColor, reason, winLine = []) {
  const winner = winnerColor ? (winnerColor === "black" ? r.black : r.white) : null;
  const loserColor = winnerColor ? opponentColor(winnerColor) : null;
  const loser = loserColor ? (loserColor === "black" ? r.black : r.white) : null;
  let nextSeats;
  if (winner && loser) nextSeats = { black: loser, white: winner };
  else nextSeats = { black: r.black, white: r.white };
  return {
    status: "betweenRounds",
    winner,
    loser,
    lastWinner: winner,
    lastLoser: loser,
    finishReason: reason,
    winLine,
    nextSeats,
    ready: {},
    finishedAt: FV.serverTimestamp(),
    ratingApplied: false
  };
}
async function finishRound({ winnerColor, reason }) {
  if (!room || room.status !== "playing") return;
  await db.runTransaction(async tx => {
    const ref = roomRef();
    const snap = await tx.get(ref);
    const r = snap.data();
    if (!r || r.status !== "playing") return;
    tx.update(ref, buildFinishUpdates(r, winnerColor, reason, []));
  });
  await applyCurrentRoomRating();
}
async function applyCurrentRoomRating() {
  await db.runTransaction(async tx => {
    const ref = roomRef();
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const r = snap.data();
    if (r.ratingApplied || r.status !== "betweenRounds") return;
    const black = r.black;
    const white = r.white;
    if (!black || !white) return;
    const blackRef = userRef(black);
    const whiteRef = userRef(white);
    const blackSnap = await tx.get(blackRef);
    const whiteSnap = await tx.get(whiteRef);
    const bs = normalizeStats(blackSnap.data(), black);
    const ws = normalizeStats(whiteSnap.data(), white);
    const br = Number(r.blackRatingBefore || bs.rating || DEFAULT_RATING);
    const wr = Number(r.whiteRatingBefore || ws.rating || DEFAULT_RATING);
    let bResult = 0.5;
    let wResult = 0.5;
    if (r.winner === black) { bResult = 1; wResult = 0; }
    if (r.winner === white) { bResult = 0; wResult = 1; }
    const bChange = calcRatingChange(br, wr, bResult);
    const wChange = calcRatingChange(wr, br, wResult);
    const bAfter = applyRating(br, bChange);
    const wAfter = applyRating(wr, wChange);
    tx.set(blackRef, buildUserStatUpdate(bs, "black", bResult, bAfter, r, black), { merge: true });
    tx.set(whiteRef, buildUserStatUpdate(ws, "white", wResult, wAfter, r, white), { merge: true });
    tx.update(ref, {
      blackRatingAfter: bAfter,
      whiteRatingAfter: wAfter,
      blackRatingChange: bChange,
      whiteRatingChange: wChange,
      ratingApplied: true,
      updatedAt: FV.serverTimestamp()
    });
  });
}
function buildUserStatUpdate(s, color, result, newRating, r, nickname) {
  const isWin = result === 1;
  const isLoss = result === 0;
  const isDraw = result === 0.5;
  const streak = isWin ? (s.currentStreak || 0) + 1 : 0;
  const moves = Math.ceil((r.moveCount || 0) / 2);
  return {
    nickname,
    rating: newRating,
    peakRating: Math.max(Number(s.peakRating || DEFAULT_RATING), newRating),
    games: (s.games || 0) + 1,
    wins: (s.wins || 0) + (isWin ? 1 : 0),
    losses: (s.losses || 0) + (isLoss ? 1 : 0),
    draws: (s.draws || 0) + (isDraw ? 1 : 0),
    blackGames: (s.blackGames || 0) + (color === "black" ? 1 : 0),
    whiteGames: (s.whiteGames || 0) + (color === "white" ? 1 : 0),
    blackWins: (s.blackWins || 0) + (color === "black" && isWin ? 1 : 0),
    whiteWins: (s.whiteWins || 0) + (color === "white" && isWin ? 1 : 0),
    resignWins: (s.resignWins || 0) + (r.finishReason === "resign" && isWin ? 1 : 0),
    resignLosses: (s.resignLosses || 0) + (r.finishReason === "resign" && isLoss ? 1 : 0),
    timeoutWins: (s.timeoutWins || 0) + (r.finishReason === "timeout" && isWin ? 1 : 0),
    timeoutLosses: (s.timeoutLosses || 0) + (r.finishReason === "timeout" && isLoss ? 1 : 0),
    currentStreak: streak,
    bestStreak: Math.max(s.bestStreak || 0, streak),
    totalMoves: (s.totalMoves || 0) + moves,
    lastPlayedAt: FV.serverTimestamp(),
    updatedAt: FV.serverTimestamp()
  };
}
async function passTurn() {
  if (!isMyTurn()) return;

  try {
    await db.runTransaction(async tx => {
      const ref = roomRef();
      const snap = await tx.get(ref);
      const r = snap.data();

const role = getRoleOf(linkedUser, r);

      if (r.status !== "playing" || role !== r.turn) {
        throw new Error("한 수 쉼 불가");
      }

      const nextPass = (r.consecutivePasses || 0) + 1;

      if (nextPass >= 2) {
        tx.update(ref, {
          ...buildFinishUpdates(r, null, "doublePass", []),
          consecutivePasses: nextPass,
          updatedAt: FV.serverTimestamp()
        });
      } else {
        tx.update(ref, {
          turn: opponentColor(r.turn),
          turnSeq: (r.turnSeq || 1) + 1,
          turnStartedAt: FV.serverTimestamp(),
          consecutivePasses: nextPass,
          lastAction: {
            type: "pass",
            by: linkedUser,
            atMs: Date.now()
          },
undoRequest: null,
drawRequest: null,
rematchRequest: null,
updatedAt: FV.serverTimestamp()
        });
      }
    });

    await addSystemChat(currentRoomId, `${linkedUser}님이 한 수 쉬었습니다.`);
  } catch (err) {
    showToast(err.message || "한 수 쉼 실패");
  }
}
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
  type === "undo"
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
  type === "undo"
    ? "무르기"
    : type === "draw"
      ? "무승부"
      : "재대국";
  await roomRef().update({ [`${type}Request`]: null, updatedAt: FV.serverTimestamp() });
  await addSystemChat(currentRoomId, `${linkedUser}님이 ${label} 요청을 취소했습니다.`);
};
window.resolveRequest = async function resolveRequest(type, accepted) {
  if (!room) return;
  const request =
  type === "undo"
    ? room.undoRequest
    : type === "draw"
      ? room.drawRequest
      : room.rematchRequest;
  if (!request || request.status !== "pending" || request.requestedBy === linkedUser) return;
  const label = type === "undo" ? "무르기" : "무승부";
  if (!accepted) {
    await roomRef().update({ [`${type}Request`]: null, updatedAt: FV.serverTimestamp() });
    await addSystemChat(currentRoomId, `${linkedUser}님이 ${label} 요청을 거절했습니다.`);
    return;
  }
  
  if (type === "rematch") {
  if (!accepted) {
    await roomRef().update({
      rematchRequest: null,
      updatedAt: FV.serverTimestamp()
    });

    await addSystemChat(currentRoomId, `${linkedUser}님이 재대국 요청을 거절했습니다.`);
    return;
  }

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
  const box = document.getElementById("playerChatBubbles");
  if (!box || !room) return;

  if (playerBubbleTimer) {
    clearTimeout(playerBubbleTimer);
    playerBubbleTimer = null;
  }

  const now = Date.now();
  const playerNames = [room.black, room.white].filter(Boolean);
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
      const color = name === room.black ? "black" : "white";
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

  box.innerHTML = bubbles.join("");

  if (bubbles.length) {
    playerBubbleTimer = setTimeout(() => {
      const latestBox = document.getElementById("playerChatBubbles");
      if (latestBox) latestBox.innerHTML = "";
    }, PLAYER_BUBBLE_VISIBLE_MS);
  }
}

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
