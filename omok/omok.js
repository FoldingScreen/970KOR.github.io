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

let linkedUser = "";
let myStats = null;
let currentRoomId = null;
let room = null;
let roomsUnsub = null;
let roomUnsub = null;
let chatUnsub = null;
let heartbeatTimer = null;
let staleTimer = null;
let hoverCell = null;
let selectedCell = null;
let soundEnabled = localStorage.getItem("omokSoundEnabled") !== "false";
let lastTurnKey = "";
let lastChatId = "";

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
  roomInfo: $("roomInfo"),
  roomSettingsBox: $("roomSettingsBox"),
spectatorList: $("spectatorList"),
  requestPanel: $("requestPanel"),
  playerRequests: $("playerRequests"),
  chatList: $("chatList"),
  chatInput: $("chatInput"),
  chatNotice: $("chatNotice"),
  toast: $("toast"),
  soundBtn: $("soundBtn")
};

const buttons = {
  backHome: $("backHomeBtn"),
  sound: $("soundBtn"),
  createRoom: $("createRoomBtn"),
  refreshRooms: $("refreshRoomsBtn"),
  place: $("placeBtn"),
  cancelSelect: $("cancelSelectBtn"),
  pass: $("passBtn"),
  undo: $("undoBtn"),
  draw: $("drawBtn"),
  resign: $("resignBtn"),
  ready: $("readyBtn"),
  leaveSeat: $("leaveSeatBtn"),
  leaveRoom: $("leaveRoomBtn"),
  wantPlay: $("wantPlayBtn"),
  sendChat: $("sendChatBtn")
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
function myRole() {
  if (!room) return "spectator";
  if (room.black === linkedUser) return "black";
  if (room.white === linkedUser) return "white";
  return "spectator";
}
function isPlayer() {
  const role = myRole();
  return role === "black" || role === "white";
}
function isMyTurn() {
  return room && room.status === "playing" && myRole() === room.turn;
}
function getOpponentNickname() {
  if (!room) return null;
  if (myRole() === "black") return room.white;
  if (myRole() === "white") return room.black;
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
function setView(name) {
  lobbyView.classList.toggle("show", name === "lobby");
  roomView.classList.toggle("show", name === "room");
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
        allowAdvice: !!els.allowAdviceInput.checked
      },
      requestLocks: { undo: {}, draw: {} },
      undoRequest: null,
      drawRequest: null,
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
  setView("room");
  selectedCell = null;
  hoverCell = null;
  startRoomListener(id);
  startChatListener(id);
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
  } catch (_) {}
}
function checkStaleOpponent() {
  if (!room || room.status !== "playing" || !isPlayer()) return;
  const opponent = getOpponentNickname();
  if (!opponent || !room.players?.[opponent]?.lastSeenAt) return;
  const last = nowMsFromTs(room.players[opponent].lastSeenAt);
  if (!last) return;
  const diff = Date.now() - last;
  if (diff > 10000) {
    setMessage(`${opponent}님 재접속 대기 중... ${Math.floor(diff / 1000)}초`, true);
  }
  if (diff > 13000 && room.status === "playing") {
    if (linkedUser.localeCompare(opponent, "ko") < 0 || myRole() === room.turn) {
      finishRound({ winnerColor: myRole(), reason: "timeout" }).catch(() => {});
    }
  }
}

function renderRoom() {
  if (!room) return;
  const role = myRole();
  const board = room.board || emptyBoard();

  els.roomStateText.textContent = `ROUND ${room.round || 1} · ${statusText(room.status)}`;
  els.roomTitle.textContent = `${room.host || "오목"}님의 방`;
  els.blackName.textContent = room.black || "대기 중";
  els.whiteName.textContent = room.white || "대기 중";
  els.blackRating.textContent = room.blackRatingBefore ? `${room.blackRatingBefore}점` : "-";
  els.whiteRating.textContent = room.whiteRatingBefore ? `${room.whiteRatingBefore}점` : "-";
  els.turnPill.textContent = room.status === "playing" ? `${colorName(room.turn)} 차례` : statusText(room.status);

  renderRoomInfo();
renderRoomSettings();
renderSpectatorList();
renderRequests();
renderPlayerRequests();
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
  els.messageBar.textContent = text;
  els.messageBar.classList.toggle("warn", !!warn);
}
function renderRoomInfo() {
  const requestCount = Object.keys(room.playerRequests || {}).length;

  els.roomInfo.innerHTML = `
    <div class="info-row"><span>라운드</span><strong>${room.round || 1}</strong></div>
    <div class="info-row"><span>수순</span><strong>${room.moveCount || 0}</strong></div>
    <div class="info-row"><span>현재 차례</span><strong>${room.status === "playing" ? colorName(room.turn) : "-"}</strong></div>
    <div class="info-row"><span>33금지</span><strong>흑백 모두</strong></div>
    <div class="info-row"><span>참여 희망</span><strong>${requestCount}명</strong></div>
  `;
}
function renderRoomSettings() {
  const isHost = room?.host === linkedUser;
  const allowSpectators = room?.settings?.allowSpectators !== false;
  const allowAdvice = !!room?.settings?.allowAdvice;

  els.roomSettingsBox.innerHTML = `
    <label class="check-row room-setting-row">
      <input id="roomAllowSpectators" type="checkbox" ${allowSpectators ? "checked" : ""} ${isHost ? "" : "disabled"} />
      <span>관전 허용</span>
    </label>

    <label class="check-row room-setting-row">
      <input id="roomAllowAdvice" type="checkbox" ${allowAdvice ? "checked" : ""} ${isHost ? "" : "disabled"} />
      <span>훈수 허용 관전자 채팅 가능</span>
    </label>

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
  const players = room?.players || {};
  const names = Object.keys(players)
    .filter(name => name !== room.black && name !== room.white)
    .sort((a, b) => a.localeCompare(b, "ko"));

  if (!names.length) {
    els.spectatorList.innerHTML = `<div class="small">관전자 없음</div>`;
    return;
  }

  els.spectatorList.innerHTML = names.map(name => {
    const p = players[name] || {};
    const lastSeen = nowMsFromTs(p.lastSeenAt);
    const connected = lastSeen && Date.now() - lastSeen <= 10000;
    const wants = !!room.playerRequests?.[name];

    return `
      <div class="spectator-item">
        <div>
          <strong>${escapeHtml(name)}</strong>
          ${wants ? `<span class="spectator-want">🎮 참여 희망</span>` : ""}
        </div>
        <span class="${connected ? "online-dot" : "offline-dot"}">${connected ? "접속" : "이탈"}</span>
      </div>
    `;
  }).join("");
}

async function updateRoomSettings() {
  if (!room || room.host !== linkedUser) {
    showToast("방장만 설정을 변경할 수 있습니다.");
    return;
  }

  const allowSpectators = !!document.getElementById("roomAllowSpectators")?.checked;
  const allowAdvice = !!document.getElementById("roomAllowAdvice")?.checked;

  try {
    await roomRef().update({
      "settings.allowSpectators": allowSpectators,
      "settings.allowAdvice": allowAdvice,
      updatedAt: FV.serverTimestamp()
    });

    await addSystemChat(
      currentRoomId,
      `방 설정이 변경되었습니다. 관전: ${allowSpectators ? "허용" : "불가"} / 훈수: ${allowAdvice ? "허용" : "금지"}`
    );

    showToast("방 설정을 저장했습니다.");
  } catch (err) {
    console.error(err);
    showToast("방 설정 저장 실패");
  }
}
function hasPendingRequest() {
  return room?.undoRequest?.status === "pending" || room?.drawRequest?.status === "pending";
}
function canRequest(type) {
  if (!room || room.status !== "playing") return false;
  if (!isMyTurn()) return false;
  if (hasPendingRequest()) return false;
  return room.requestLocks?.[type]?.[linkedUser] !== room.turnSeq;
}
function renderRequests() {
  const undo = room.undoRequest;
  const draw = room.drawRequest;
  let html = `<h3>요청</h3>`;
  const pending = undo?.status === "pending" ? undo : draw?.status === "pending" ? draw : null;
  const type = undo?.status === "pending" ? "undo" : draw?.status === "pending" ? "draw" : null;
  if (!pending) {
    els.requestPanel.innerHTML = html + `<div class="small">대기 중인 요청 없음</div>`;
    return;
  }
  const label = type === "undo" ? "무르기" : "무승부";
  if (pending.requestedBy === linkedUser) {
    html += `
      <div class="request-box">
        <strong>${label} 요청 대기 중</strong><br>
        <span class="small">상대의 응답을 기다립니다.</span>
        <div class="request-actions"><button class="secondary mini" onclick="cancelRequest('${type}')">요청 취소</button></div>
      </div>`;
  } else {
    html += `
      <div class="request-box">
        <strong>${pending.requestedBy}님의 ${label} 요청</strong><br>
        <span class="small">수락하거나 거절할 수 있습니다.</span>
        <div class="request-actions">
          <button class="mini" onclick="resolveRequest('${type}', true)">수락</button>
          <button class="secondary mini" onclick="resolveRequest('${type}', false)">거절</button>
        </div>
      </div>`;
  }
  els.requestPanel.innerHTML = html;
}
function renderPlayerRequests() {
  const requests = room.playerRequests || {};
  const names = Object.keys(requests).sort((a, b) => (requests[a].requestedAt?.seconds || 0) - (requests[b].requestedAt?.seconds || 0));
  if (!names.length) {
    els.playerRequests.innerHTML = `<span class="small">참여 희망자 없음</span>`;
  } else {
    els.playerRequests.innerHTML = names.map(name => {
      const canTransfer = room.status === "betweenRounds" && isPlayer() && room.nextSeats?.[myRole()] === linkedUser && name !== linkedUser;
      return `<span class="chip">🎮 ${escapeHtml(name)}${canTransfer ? ` <button onclick="transferSeat('${name}')">내 자리 넘기기</button>` : ""}</span>`;
    }).join("");
  }
  const wants = !!requests[linkedUser];
  buttons.wantPlay.textContent = wants ? "참여 희망 취소" : "대국자로 참여하기";
  buttons.wantPlay.style.display = isPlayer() ? "none" : "block";
  buttons.wantPlay.disabled = room.status === "finished" || room.settings?.allowSpectators === false;
}
function renderButtons() {
  const playing = room.status === "playing";
  const between = room.status === "betweenRounds";
  const myTurn = isMyTurn();
  const selectedOk = selectedCell && canPlaceAt(selectedCell.row, selectedCell.col).ok;

  buttons.place.disabled = !playing || !myTurn || !selectedOk;
  buttons.cancelSelect.disabled = !selectedCell;
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
  let center = 4;
  for (let k = -4; k <= 4; k++) {
    const r = row + dr * k;
    const c = col + dc * k;
    if (!inside(r, c)) cells.push("O");
    else {
      const v = board[idx(r, c)];
      cells.push(v === color ? "X" : v ? "O" : ".");
    }
  }
  const patterns = [".XXX.", ".XX.X.", ".X.XX."];
  for (const p of patterns) {
    for (let start = 0; start <= cells.length - p.length; start++) {
      if (center < start || center >= start + p.length) continue;
      const seg = cells.slice(start, start + p.length).join("");
      if (seg === p) return true;
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
      const role = r.black === linkedUser ? "black" : r.white === linkedUser ? "white" : "spectator";
      if (role !== r.turn) throw new Error("내 차례가 아닙니다.");
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
        updatedAt: FV.serverTimestamp()
      };
      if (win.win) {
        Object.assign(updates, buildFinishUpdates(r, r.turn, "five", win.line));
      } else {
        updates.turn = opponentColor(r.turn);
        updates.turnSeq = (r.turnSeq || 1) + 1;
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
      const role = r.black === linkedUser ? "black" : r.white === linkedUser ? "white" : "spectator";
      if (r.status !== "playing" || role !== r.turn) throw new Error("한 수 쉼 불가");
      const nextPass = (r.consecutivePasses || 0) + 1;
      if (nextPass >= 2) {
        tx.update(ref, {
          ...buildFinishUpdates(r, null, "doublePass", []),
          consecutivePasses: nextPass,
          turnSeq: (r.turnSeq || 1) + 1,
          updatedAt: FV.serverTimestamp()
        });
      } else {
        tx.update(ref, {
          turn: opponentColor(r.turn),
          turnSeq: (r.turnSeq || 1) + 1,
          consecutivePasses: nextPass,
          lastAction: { type: "pass", by: linkedUser, atMs: Date.now() },
          undoRequest: null,
          drawRequest: null,
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
  const label = type === "undo" ? "무르기" : "무승부";
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
  const label = type === "undo" ? "무르기" : "무승부";
  await roomRef().update({ [`${type}Request`]: null, updatedAt: FV.serverTimestamp() });
  await addSystemChat(currentRoomId, `${linkedUser}님이 ${label} 요청을 취소했습니다.`);
};
window.resolveRequest = async function resolveRequest(type, accepted) {
  if (!room) return;
  const request = type === "undo" ? room.undoRequest : room.drawRequest;
  if (!request || request.status !== "pending" || request.requestedBy === linkedUser) return;
  const label = type === "undo" ? "무르기" : "무승부";
  if (!accepted) {
    await roomRef().update({ [`${type}Request`]: null, updatedAt: FV.serverTimestamp() });
    await addSystemChat(currentRoomId, `${linkedUser}님이 ${label} 요청을 거절했습니다.`);
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
      winLine: [],
      undoRequest: null,
      drawRequest: null,
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
  if (wants) {
    await roomRef().update({
      [`playerRequests.${linkedUser}`]: FV.delete(),
      updatedAt: FV.serverTimestamp()
    });
    await addSystemChat(currentRoomId, `${linkedUser}님이 참여 희망을 취소했습니다.`);
  } else {
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
    await addSystemChat(currentRoomId, `${linkedUser}님이 대국 참여를 희망합니다.`);
  }
}
window.transferSeat = async function transferSeat(name) {
  if (!room || room.status !== "betweenRounds" || !isPlayer()) return;
  const role = myRole();
  if (room.nextSeats?.[role] !== linkedUser) return;
  await roomRef().update({
    [`nextSeats.${role}`]: name,
    [`playerRequests.${name}`]: FV.delete(),
    [`players.${name}.role`]: role,
    [`players.${linkedUser}.role`]: "spectator",
    updatedAt: FV.serverTimestamp()
  });
  await addSystemChat(currentRoomId, `${linkedUser}님이 다음 판 자리를 ${name}님에게 넘겼습니다.`);
};
async function leaveRoomLocal() {
  if (roomUnsub) roomUnsub();
  if (chatUnsub) chatUnsub();
  stopHeartbeat();
  roomUnsub = null;
  chatUnsub = null;
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
      await roomRef().set({
        [`players.${linkedUser}.connected`]: false,
        [`players.${linkedUser}.disconnectedAt`]: FV.serverTimestamp(),
        [`playerRequests.${linkedUser}`]: FV.delete(),
        updatedAt: FV.serverTimestamp()
      }, { merge: true });
      await addSystemChat(currentRoomId, `${linkedUser}님이 방을 나갔습니다.`);
    } catch (_) {}
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
function renderChat(messages) {
  if (!messages.length) {
    els.chatList.innerHTML = `<div class="small">채팅 없음</div>`;
    return;
  }
  const latest = messages[messages.length - 1];
  if (latest.id !== lastChatId && latest.type === "chat" && latest.sender !== linkedUser) playSound("chat");
  lastChatId = latest.id;
  els.chatList.innerHTML = messages.map(m => {
    if (m.type === "system") return `<div class="chat-msg system">${escapeHtml(m.message)}</div>`;
    return `<div class="chat-msg"><span class="sender">${escapeHtml(m.sender)}</span> <span>${escapeHtml(m.message)}</span></div>`;
  }).join("");
  els.chatList.scrollTop = els.chatList.scrollHeight;
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
  } else {
    await tryPlace(cell.row, cell.col);
  }
});
buttons.createRoom.addEventListener("click", createRoom);
buttons.refreshRooms.addEventListener("click", startRoomListListener);
buttons.backHome.addEventListener("click", () => location.href = "../");
buttons.sound.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  localStorage.setItem("omokSoundEnabled", String(soundEnabled));
  setSoundButton();
});
buttons.place.addEventListener("click", placeSelected);
buttons.cancelSelect.addEventListener("click", () => { selectedCell = null; renderRoom(); drawBoard(); });
buttons.pass.addEventListener("click", passTurn);
buttons.undo.addEventListener("click", () => requestAction("undo"));
buttons.draw.addEventListener("click", () => requestAction("draw"));
buttons.resign.addEventListener("click", resignGame);
buttons.ready.addEventListener("click", setReady);
buttons.leaveSeat.addEventListener("click", leaveSeat);
buttons.leaveRoom.addEventListener("click", leaveRoom);
buttons.wantPlay.addEventListener("click", toggleWantPlay);
buttons.sendChat.addEventListener("click", sendChat);
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
  setView("lobby");
  drawBoard();
}
init();
