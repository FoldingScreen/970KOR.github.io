const firebaseConfig = {
  apiKey: "AIzaSyBu2RrQn8cAwwWaLtw5O8Omwn4-NzHWuc0",
  authDomain: "kor-app-fa47e.firebaseapp.com",
  projectId: "kor-app-fa47e",
  storageBucket: "kor-app-fa47e.firebasestorage.app",
  messagingSenderId: "397749083935",
  appId: "1:397749083935:web:51c7c"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
firebase.firestore().settings({ experimentalForceLongPolling: true, useFetchStreams: false });

const db = firebase.firestore();
const FV = firebase.firestore.FieldValue;

const RANKS = [
  { rank: 1, name: "사바나 임금", short: "사바나", count: 1 },
  { rank: 2, name: "세자", short: "세자", count: 2 },
  { rank: 3, name: "영의정", short: "영의정", count: 3 },
  { rank: 4, name: "관찰사", short: "관찰사", count: 4 },
  { rank: 5, name: "암행어사", short: "암행어사", count: 5 },
  { rank: 6, name: "사또", short: "사또", count: 6 },
  { rank: 7, name: "이방", short: "이방", count: 7 },
  { rank: 8, name: "포졸", short: "포졸", count: 8 },
  { rank: 9, name: "선비", short: "선비", count: 9 },
  { rank: 10, name: "상인", short: "상인", count: 10 },
  { rank: 11, name: "농민", short: "농민", count: 11 },
  { rank: 12, name: "노비", short: "노비", count: 12 }
];
const JOKER = { rank: 0, name: "홍길동", short: "홍길동", count: 2 };
const ROLE_NAMES = ["사바나 임금", "세자", "영의정", "관찰사", "암행어사", "사또", "이방", "포졸"];
const MAX_PLAYERS = 8;

let linkedUser = "";
let currentRoomId = localStorage.getItem("dalmutiCurrentRoomId") || "";
let roomsUnsub = null;
let roomUnsub = null;
let logUnsub = null;
let room = null;
let selectedCardIds = new Set();

const $ = (id) => document.getElementById(id);
const els = {
  lobbyView: $("lobbyView"), roomView: $("roomView"), myNickname: $("myNickname"), roomTitleInput: $("roomTitleInput"),
  roomList: $("roomList"), rankPreview: $("rankPreview"), roomStateText: $("roomStateText"), roomTitle: $("roomTitle"),
  turnBadge: $("turnBadge"), messageBar: $("messageBar"), playersArea: $("playersArea"), currentComboBox: $("currentComboBox"),
  handArea: $("handArea"), selectedSummary: $("selectedSummary"), handHelp: $("handHelp"), rankList: $("rankList"), logList: $("logList"), toast: $("toast")
};
const buttons = {
  home: $("homeBtn"), leaveRoom: $("leaveRoomBtn"), createRoom: $("createRoomBtn"), refreshRooms: $("refreshRoomsBtn"),
  play: $("playBtn"), pass: $("passBtn"), ready: $("readyBtn"), start: $("startBtn"), nextRound: $("nextRoundBtn")
};

function roomRef(id = currentRoomId) { return db.collection("dalmutiRooms").doc(id); }
function logsRef(id = currentRoomId) { return roomRef(id).collection("logs"); }
function showToast(text) {
  els.toast.textContent = text;
  els.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove("show"), 1700);
}
function setView(name) {
  els.lobbyView.classList.toggle("show", name === "lobby");
  els.roomView.classList.toggle("show", name === "room");
  buttons.leaveRoom.classList.toggle("hidden", name !== "room");
}
function rankInfo(rank) {
  if (rank === 0) return JOKER;
  return RANKS.find(r => r.rank === rank) || { rank, name: String(rank), short: String(rank) };
}
function cardLabel(card) { return rankInfo(card.rank).short; }
function makeDeck() {
  const deck = [];
  RANKS.forEach(r => {
    for (let i = 1; i <= r.count; i++) deck.push({ id: `r${r.rank}-${i}-${Math.random().toString(36).slice(2, 7)}`, rank: r.rank });
  });
  for (let i = 1; i <= 2; i++) deck.push({ id: `j-${i}-${Math.random().toString(36).slice(2, 7)}`, rank: 0 });
  return shuffle(deck);
}
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function sortCards(cards = []) { return cards.slice().sort((a, b) => (a.rank || 99) - (b.rank || 99)); }
function getPlayers(source = room) { return Object.values(source?.players || {}).sort((a, b) => (a.seat || 0) - (b.seat || 0)); }
function me(source = room) { return source?.players?.[linkedUser] || null; }
function isHost() { return room?.host === linkedUser; }
function isActivePlayer() { const p = me(); return !!p && !p.finished; }
function currentPlayer() { return getPlayers().find(p => p.nickname === room?.currentTurn) || null; }
function nextUnfinishedAfter(nickname, source = room) {
  const players = getPlayers(source).filter(p => !p.finished);
  if (!players.length) return "";
  const idx = Math.max(0, players.findIndex(p => p.nickname === nickname));
  for (let step = 1; step <= players.length; step++) {
    const cand = players[(idx + step) % players.length];
    if (!cand.finished) return cand.nickname;
  }
  return players[0].nickname;
}
function comboName(combo) {
  if (!combo || !combo.count) return "없음";
  return `${rankInfo(combo.rank).short} ${combo.count}장`;
}
function selectedCards() {
  return (me()?.hand || []).filter(c => selectedCardIds.has(c.id));
}
function normalizeCombo(cards) {
  if (!cards.length) return { ok: false, reason: "카드를 선택하세요." };
  const normals = cards.filter(c => c.rank !== 0);
  const jokers = cards.filter(c => c.rank === 0);
  const unique = [...new Set(normals.map(c => c.rank))];
  if (unique.length > 1) return { ok: false, reason: "같은 계급 카드만 함께 낼 수 있습니다." };
  if (normals.length === 0) {
    if (jokers.length === 2) return { ok: true, rank: 13, count: 2, hong: true };
    return { ok: false, reason: "홍길동 1장만 단독으로 낼 수 없습니다." };
  }
  return { ok: true, rank: unique[0], count: cards.length, hong: jokers.length === 2 && cards.length === 2 };
}
function canPlayCombo(cards, source = room) {
  const combo = normalizeCombo(cards);
  if (!combo.ok) return combo;
  if (!source?.currentCombo) return combo;
  if (combo.count !== source.currentCombo.count) return { ok: false, reason: `이번 판은 ${source.currentCombo.count}장씩 내야 합니다.` };
  if (combo.rank >= source.currentCombo.rank) return { ok: false, reason: "더 높은 계급만 낼 수 있습니다." };
  return combo;
}
function publicRoomData(data) {
  const copy = JSON.parse(JSON.stringify(data));
  Object.values(copy.players || {}).forEach(p => { delete p.hand; });
  return copy;
}
async function addLog(text) {
  if (!currentRoomId) return;
  await logsRef().add({ text, createdAt: FV.serverTimestamp() });
}

function renderRankChips() {
  const html = RANKS.map(r => `<span class="rank-chip">${r.rank}. ${r.short}</span>`).join("") + `<span class="rank-chip">조커. 홍길동</span>`;
  els.rankPreview.innerHTML = html;
  els.rankList.innerHTML = html;
}
function renderRoomsSnapshot(snap) {
  if (snap.empty) {
    els.roomList.innerHTML = `<div class="small">대기방이 없습니다.</div>`;
    return;
  }
  els.roomList.innerHTML = snap.docs.map(doc => {
    const r = doc.data();
    const count = Object.keys(r.players || {}).length;
    const status = r.status === "waiting" ? "대기 중" : r.status === "playing" ? "진행 중" : "라운드 종료";
    return `<div class="room-item"><div><strong>${escapeHtml(r.title || "사바나 달무티")}</strong><div class="small">${status} · ${count}/${MAX_PLAYERS}명 · ${r.round || 1}판</div></div><button type="button" onclick="joinRoom('${doc.id}')">입장</button></div>`;
  }).join("");
}
function startRoomListListener() {
  if (roomsUnsub) roomsUnsub();
  roomsUnsub = db.collection("dalmutiRooms").orderBy("updatedAt", "desc").limit(30).onSnapshot(renderRoomsSnapshot, err => {
    console.error(err); els.roomList.innerHTML = `<div class="small">방 목록을 불러오지 못했습니다.</div>`;
  });
}
function renderRoom() {
  if (!room) return;
  const players = getPlayers();
  const mine = me();
  const statusText = room.status === "waiting" ? "대기 중" : room.status === "playing" ? `${room.round || 1}판 진행 중` : "라운드 종료";
  els.roomStateText.textContent = statusText;
  els.roomTitle.textContent = room.title || "사바나 달무티";
  els.turnBadge.textContent = room.status === "playing" ? `차례: ${room.currentTurn || "-"}` : statusText;
  els.messageBar.textContent = messageText();

  els.playersArea.innerHTML = players.map(p => {
    const cls = ["player-card", p.nickname === linkedUser ? "me" : "", p.nickname === room.currentTurn ? "turn" : "", p.finished ? "finished" : ""].join(" ");
    const role = p.role || ROLE_NAMES[(p.finishRank || p.seat || 1) - 1] || "백성";
    return `<div class="${cls}"><div class="player-name">${escapeHtml(p.nickname)}</div><div class="player-meta">${escapeHtml(role)} · ${p.cardCount ?? p.hand?.length ?? 0}장${p.ready ? " · 준비" : ""}${p.finished ? ` · ${p.finishRank}등` : ""}</div></div>`;
  }).join("");

  renderCombo();
  renderHand();
  renderButtons();
}
function messageText() {
  if (!room) return "";
  if (room.status === "waiting") return "참가자는 준비를 누르고, 방장은 게임을 시작할 수 있습니다.";
  if (room.status === "roundEnd") return `라운드 종료. 순위: ${(room.finishOrder || []).join(" > ")}`;
  if (room.currentTurn === linkedUser) return "내 차례입니다. 낼 카드를 고르거나 패스하세요.";
  return `${room.currentTurn || "다음 사람"} 차례입니다.`;
}
function renderCombo() {
  const combo = room.currentCombo;
  if (!combo) {
    els.currentComboBox.innerHTML = `<strong>현재 판</strong><div class="small">새 판입니다. 원하는 계급과 장수를 낼 수 있습니다.</div>`;
    return;
  }
  const cards = (room.lastPlayedCards || []).map(c => cardHtml(c, false)).join("");
  els.currentComboBox.innerHTML = `<strong>현재 조합: ${comboName(combo)}</strong><div class="small">마지막 제출: ${escapeHtml(room.lastPlayedBy || "-")}</div><div class="played-cards">${cards}</div>`;
}
function renderHand() {
  const mine = me();
  if (!mine) { els.handArea.innerHTML = ""; return; }
  const hand = sortCards(mine.hand || []);
  els.handArea.innerHTML = hand.map(c => cardHtml(c, true)).join("");
  const cards = selectedCards();
  const combo = normalizeCombo(cards);
  els.selectedSummary.textContent = cards.length ? (combo.ok ? `${comboName(combo)}` : combo.reason) : "선택 없음";
}
function cardHtml(card, clickable) {
  const info = rankInfo(card.rank);
  const selected = selectedCardIds.has(card.id) ? " selected" : "";
  const joker = card.rank === 0 ? " joker" : "";
  const on = clickable ? ` onclick="toggleCard('${card.id}')"` : "";
  return `<div class="card-tile${selected}${joker}"${on}><div class="rank-no">${card.rank === 0 ? "JOKER" : card.rank}</div><div class="rank-name">${escapeHtml(info.short)}</div><div class="rank-no">${card.rank === 0 ? "민란" : info.count + "장"}</div></div>`;
}
function renderButtons() {
  const mine = me();
  const waiting = room.status === "waiting";
  const playing = room.status === "playing";
  const roundEnd = room.status === "roundEnd";
  buttons.ready.classList.toggle("hidden", !waiting || !mine);
  buttons.ready.textContent = mine?.ready ? "준비 취소" : "준비";
  buttons.start.classList.toggle("hidden", !waiting || !isHost());
  buttons.nextRound.classList.toggle("hidden", !roundEnd || !isHost());
  buttons.play.classList.toggle("hidden", !playing || room.currentTurn !== linkedUser || !isActivePlayer());
  buttons.pass.classList.toggle("hidden", !playing || room.currentTurn !== linkedUser || !isActivePlayer());
}
function renderLogs(snap) {
  if (snap.empty) { els.logList.innerHTML = `<div class="small">아직 로그가 없습니다.</div>`; return; }
  els.logList.innerHTML = snap.docs.map(d => `<div class="log-item">${escapeHtml(d.data().text || "")}</div>`).join("");
}
function escapeHtml(s) { return String(s ?? "").replace(/[&<>"]/g, m => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[m])); }

async function createRoom() {
  const title = els.roomTitleInput.value.trim() || `${linkedUser}의 사바나 달무티`;
  const players = {};
  players[linkedUser] = { nickname: linkedUser, seat: 1, ready: true, role: "방장", hand: [], cardCount: 0, finished: false };
  const doc = await db.collection("dalmutiRooms").add({
    title, host: linkedUser, status: "waiting", round: 1, players, order: [linkedUser], finishOrder: [],
    currentTurn: "", currentCombo: null, lastPlayedBy: "", lastPlayedCards: [], passes: [], revolution: false,
    createdAt: FV.serverTimestamp(), updatedAt: FV.serverTimestamp()
  });
  currentRoomId = doc.id;
  localStorage.setItem("dalmutiCurrentRoomId", currentRoomId);
  await doc.collection("logs").add({ text: `${linkedUser}님이 방을 만들었습니다.`, createdAt: FV.serverTimestamp() });
  enterRoom(currentRoomId);
}
async function joinRoom(id) {
  currentRoomId = id;
  localStorage.setItem("dalmutiCurrentRoomId", id);
  await roomRef(id).set({
    [`players.${linkedUser}`]: { nickname: linkedUser, seat: 99, ready: false, role: "참가자", hand: [], cardCount: 0, finished: false },
    updatedAt: FV.serverTimestamp()
  }, { merge: true });
  await normalizeSeats(id);
  await roomRef(id).collection("logs").add({ text: `${linkedUser}님이 입장했습니다.`, createdAt: FV.serverTimestamp() });
  enterRoom(id);
}
async function normalizeSeats(id = currentRoomId) {
  const snap = await roomRef(id).get();
  if (!snap.exists) return;
  const data = snap.data();
  const players = Object.values(data.players || {}).sort((a, b) => (a.seat || 99) - (b.seat || 99));
  const patch = { order: players.map(p => p.nickname), updatedAt: FV.serverTimestamp() };
  players.forEach((p, i) => patch[`players.${p.nickname}.seat`] = i + 1);
  await roomRef(id).set(patch, { merge: true });
}
function enterRoom(id) {
  currentRoomId = id;
  setView("room");
  selectedCardIds.clear();
  if (roomUnsub) roomUnsub();
  if (logUnsub) logUnsub();
  roomUnsub = roomRef(id).onSnapshot(snap => {
    if (!snap.exists) { leaveRoomLocal(); return; }
    room = snap.data();
    renderRoom();
  }, console.error);
  logUnsub = logsRef(id).orderBy("createdAt", "desc").limit(60).onSnapshot(renderLogs, console.error);
}
async function leaveRoom() {
  if (!currentRoomId || !room) return;
  const patch = { updatedAt: FV.serverTimestamp() };
  patch[`players.${linkedUser}`] = FV.delete();
  const nextHost = room.host === linkedUser ? getPlayers().find(p => p.nickname !== linkedUser)?.nickname || "" : room.host;
  if (nextHost) patch.host = nextHost;
  await roomRef().set(patch, { merge: true });
  await addLog(`${linkedUser}님이 방을 나갔습니다.`);
  leaveRoomLocal();
}
function leaveRoomLocal() {
  if (roomUnsub) roomUnsub();
  if (logUnsub) logUnsub();
  roomUnsub = null; logUnsub = null; room = null; currentRoomId = "";
  localStorage.removeItem("dalmutiCurrentRoomId");
  setView("lobby");
  startRoomListListener();
}
async function toggleReady() {
  const mine = me();
  if (!mine || room.status !== "waiting") return;
  await roomRef().set({ [`players.${linkedUser}.ready`]: !mine.ready, updatedAt: FV.serverTimestamp() }, { merge: true });
}
async function startGame() {
  if (!isHost() || room.status !== "waiting") return;
  const players = getPlayers();
  if (players.length < 2) return showToast("2명 이상 필요합니다.");
  if (!players.every(p => p.ready || p.nickname === room.host)) return showToast("아직 준비하지 않은 인원이 있습니다.");
  await dealAndStart(players, false);
}
async function dealAndStart(players, keepRoles) {
  const deck = makeDeck();
  const hands = {};
  players.forEach(p => hands[p.nickname] = []);
  deck.forEach((card, i) => hands[players[i % players.length].nickname].push(card));
  const patch = {
    status: "playing", currentTurn: players[0].nickname, currentCombo: null, lastPlayedBy: "", lastPlayedCards: [], passes: [], finishOrder: [],
    updatedAt: FV.serverTimestamp()
  };
  players.forEach((p, i) => {
    const hand = sortCards(hands[p.nickname]);
    patch[`players.${p.nickname}.hand`] = hand;
    patch[`players.${p.nickname}.cardCount`] = hand.length;
    patch[`players.${p.nickname}.finished`] = false;
    patch[`players.${p.nickname}.finishRank`] = null;
    patch[`players.${p.nickname}.ready`] = false;
    patch[`players.${p.nickname}.role`] = keepRoles ? (p.role || ROLE_NAMES[i] || `${i + 1}등`) : (ROLE_NAMES[i] || `${i + 1}등`);
  });
  await roomRef().set(patch, { merge: true });
  await addLog(`${room.round || 1}판이 시작되었습니다.`);
}
async function playSelected() {
  if (!room || room.status !== "playing" || room.currentTurn !== linkedUser) return;
  const mine = me();
  const cards = selectedCards();
  const combo = canPlayCombo(cards);
  if (!combo.ok) return showToast(combo.reason);
  const selectedIds = new Set(cards.map(c => c.id));
  const newHand = (mine.hand || []).filter(c => !selectedIds.has(c.id));
  let finishOrder = room.finishOrder || [];
  let finished = false;
  let finishRank = mine.finishRank || null;
  if (newHand.length === 0 && !mine.finished) {
    finishOrder = finishOrder.concat(linkedUser);
    finished = true;
    finishRank = finishOrder.length;
  }
  const remainingActive = getPlayers().filter(p => p.nickname !== linkedUser && !p.finished).length + (finished ? 0 : 1);
  const nextTurn = remainingActive <= 1 ? "" : nextUnfinishedAfter(linkedUser, { ...room, players: patchedPlayersForTurn(newHand, finished) });
  const roundEnds = remainingActive <= 1;
  const patch = {
    currentCombo: { rank: combo.rank, count: combo.count }, lastPlayedBy: linkedUser, lastPlayedCards: cards, passes: [], finishOrder,
    [`players.${linkedUser}.hand`]: newHand, [`players.${linkedUser}.cardCount`]: newHand.length,
    [`players.${linkedUser}.finished`]: finished, [`players.${linkedUser}.finishRank`]: finishRank,
    updatedAt: FV.serverTimestamp()
  };
  if (combo.hong) {
    patch.revolution = true;
  }
  if (roundEnds) {
    const last = getPlayers().find(p => p.nickname !== linkedUser && !p.finished)?.nickname;
    patch.status = "roundEnd";
    patch.currentTurn = "";
    patch.finishOrder = last ? finishOrder.concat(last) : finishOrder;
    if (last) {
      patch[`players.${last}.finished`] = true;
      patch[`players.${last}.finishRank`] = patch.finishOrder.length;
    }
  } else {
    patch.currentTurn = nextTurn || linkedUser;
  }
  selectedCardIds.clear();
  await roomRef().set(patch, { merge: true });
  await addLog(`${linkedUser}님이 ${comboName(combo)}을 냈습니다.${combo.hong ? " 홍길동 출현! 다음 판의 상납 질서가 뒤집힙니다." : ""}`);
}
function patchedPlayersForTurn(newHand, finished) {
  const players = JSON.parse(JSON.stringify(room.players || {}));
  if (players[linkedUser]) { players[linkedUser].hand = newHand; players[linkedUser].finished = finished; }
  return players;
}
async function passTurn() {
  if (!room || room.status !== "playing" || room.currentTurn !== linkedUser) return;
  if (!room.currentCombo) return showToast("새 판에서는 패스할 수 없습니다.");
  const active = getPlayers().filter(p => !p.finished).map(p => p.nickname);
  const passes = Array.from(new Set([...(room.passes || []), linkedUser]));
  const othersNeedPass = active.filter(n => n !== room.lastPlayedBy);
  const trickOver = othersNeedPass.every(n => passes.includes(n));
  const patch = { updatedAt: FV.serverTimestamp() };
  if (trickOver) {
    patch.currentTurn = room.lastPlayedBy;
    patch.currentCombo = null;
    patch.lastPlayedCards = [];
    patch.passes = [];
    await addLog(`모두 패스했습니다. ${room.lastPlayedBy}님이 새 판을 시작합니다.`);
  } else {
    patch.currentTurn = nextUnfinishedAfter(linkedUser);
    patch.passes = passes;
    await addLog(`${linkedUser}님이 패스했습니다.`);
  }
  await roomRef().set(patch, { merge: true });
}
async function nextRound() {
  if (!isHost() || room.status !== "roundEnd") return;
  const order = room.finishOrder || [];
  const players = order.map((name, i) => ({ ...(room.players[name] || { nickname: name }), nickname: name, seat: i + 1, role: ROLE_NAMES[i] || `${i + 1}등` }));
  const patch = { status: "waiting", round: (room.round || 1) + 1, order, revolution: false, updatedAt: FV.serverTimestamp() };
  players.forEach((p, i) => {
    patch[`players.${p.nickname}.seat`] = i + 1;
    patch[`players.${p.nickname}.role`] = ROLE_NAMES[i] || `${i + 1}등`;
    patch[`players.${p.nickname}.ready`] = p.nickname === room.host;
    patch[`players.${p.nickname}.hand`] = [];
    patch[`players.${p.nickname}.cardCount`] = 0;
    patch[`players.${p.nickname}.finished`] = false;
    patch[`players.${p.nickname}.finishRank`] = null;
  });
  await roomRef().set(patch, { merge: true });
  await addLog(`다음 판 대기 상태가 되었습니다. ${room.revolution ? "홍길동의 영향으로 민란 판이 예고되었습니다." : ""}`);
}
function toggleCard(id) {
  const card = (me()?.hand || []).find(c => c.id === id);
  if (!card) return;
  if (selectedCardIds.has(id)) selectedCardIds.delete(id);
  else selectedCardIds.add(id);
  const cards = selectedCards();
  const normalRanks = [...new Set(cards.filter(c => c.rank !== 0).map(c => c.rank))];
  if (normalRanks.length > 1) {
    selectedCardIds.delete(id);
    showToast("같은 계급 카드만 함께 선택할 수 있습니다.");
  }
  renderHand();
}

buttons.home.addEventListener("click", () => location.href = "../");
buttons.leaveRoom.addEventListener("click", leaveRoom);
buttons.createRoom.addEventListener("click", createRoom);
buttons.refreshRooms.addEventListener("click", startRoomListListener);
buttons.ready.addEventListener("click", toggleReady);
buttons.start.addEventListener("click", startGame);
buttons.play.addEventListener("click", playSelected);
buttons.pass.addEventListener("click", passTurn);
buttons.nextRound.addEventListener("click", nextRound);

async function init() {
  linkedUser = String(localStorage.getItem("partyAppUser") || "").trim();
  if (!linkedUser) {
    alert("970KOR 로그인 후 이용할 수 있습니다.");
    location.href = "../";
    return;
  }
  els.myNickname.textContent = linkedUser;
  renderRankChips();
  startRoomListListener();
  if (currentRoomId) {
    const snap = await roomRef(currentRoomId).get().catch(() => null);
    if (snap?.exists && snap.data()?.players?.[linkedUser]) enterRoom(currentRoomId);
    else localStorage.removeItem("dalmutiCurrentRoomId");
  }
}
init();

window.joinRoom = joinRoom;
window.toggleCard = toggleCard;