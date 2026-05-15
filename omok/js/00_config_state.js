// 00_config_state.js
// 분리본: 기존 omok.js를 기능별로 나눈 파일입니다.

const firebaseConfig = {
  apiKey: "AIzaSyBu2RrQn8cAwwWaLtw5O8Omwn4-NzHWuc0",
  authDomain: "kor-app-fa47e.firebaseapp.com",
  projectId: "kor-app-fa47e",
  storageBucket: "kor-app-fa47e.firebasestorage.app",
  messagingSenderId: "397749083935",
  appId: "1:397749083935:web:51c7c"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

firebase.firestore().settings({
  experimentalForceLongPolling: true,
  useFetchStreams: false
});

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

async function buildInitialMatchRequest(playerA, playerB) {
  const arranged = await arrangeSeatsByRating(playerA, playerB);

  return {
    requestedBy: arranged.black,
    requestedTo: arranged.white,
    black: arranged.black,
    white: arranged.white,
    blackRating: arranged.blackRating,
    whiteRating: arranged.whiteRating,
    requestedAt: FV.serverTimestamp(),
    status: "pending"
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

