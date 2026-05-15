(() => {
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
  const CARD_BASE = "./cards/";
  const MAX_PLAYERS = 8;

  const RANKS = [
    { rank: 1, code: "01", name: "사바나", image: "card-01-sabana.png", count: 1 },
    { rank: 2, code: "02", name: "세자", image: "card-02-prince.png", count: 2 },
    { rank: 3, code: "03", name: "영의정", image: "card-03-yeonguijeong.png", count: 3 },
    { rank: 4, code: "04", name: "관찰사", image: "card-04-governor.png", count: 4 },
    { rank: 5, code: "05", name: "암행어사", image: "card-05-amhaeng.png", count: 5 },
    { rank: 6, code: "06", name: "사또", image: "card-06-satto.png", count: 6 },
    { rank: 7, code: "07", name: "이방", image: "card-07-ibang.png", count: 7 },
    { rank: 8, code: "08", name: "포졸", image: "card-08-pojol.png", count: 8 },
    { rank: 9, code: "09", name: "선비", image: "card-09-seonbi.png", count: 9 },
    { rank: 10, code: "10", name: "상인", image: "card-10-merchant.png", count: 10 },
    { rank: 11, code: "11", name: "농민", image: "card-11-farmer.png", count: 11 },
    { rank: 12, code: "12", name: "노비", image: "card-12-nobi.png", count: 12 },
    { rank: 13, code: "J", name: "홍길동", image: "card-j-hong.png", count: 2, joker: true }
  ];

  const S = {
    user: "",
    roomId: localStorage.getItem("dalmutiCurrentRoomId") || "",
    room: null,
    participants: [],
    selected: new Map(),
    unsub: {}
  };

  const $ = (id) => document.getElementById(id);
  const E = {};
  const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
  const roomCol = () => db.collection("events").doc("dalmuti").collection("rooms");
  const roomRef = (id = S.roomId) => roomCol().doc(id);
  const partRef = (id = S.roomId) => roomRef(id).collection("participants");
  const msgRef = (id = S.roomId) => roomRef(id).collection("messages");
  const rankInfo = (rank) => RANKS.find((r) => r.rank === Number(rank)) || RANKS[RANKS.length - 1];
  const cardImg = (rank) => CARD_BASE + rankInfo(rank).image;
  const players = () => S.participants.filter((p) => p.type === "player").sort((a, b) => (a.seatOrder ?? 999) - (b.seatOrder ?? 999));
  const me = () => S.participants.find((p) => p.uid === S.user) || null;
  const isHost = () => S.room?.hostUid === S.user;
  const nowTs = () => firebase.firestore.Timestamp.now();

  function toast(text) {
    E.toast.textContent = text;
    E.toast.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => E.toast.classList.remove("show"), 1800);
  }
  function setView(name) {
    E.lobbyView.classList.toggle("show", name === "lobby");
    E.roomView.classList.toggle("show", name === "room");
    E.leaveRoomBtn.classList.toggle("hidden", name !== "room");
  }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function maxRankForCount(count) { return count <= 3 ? 8 : count <= 5 ? 10 : 12; }
  function roleByIndex(i, count) {
    const map = {
      2: ["사바나", "노비"],
      3: ["사바나", "농민", "노비"],
      4: ["사바나", "세자", "농민", "노비"],
      5: ["사바나", "세자", "사또", "농민", "노비"],
      6: ["사바나", "세자", "암행어사", "사또", "농민", "노비"],
      7: ["사바나", "세자", "관찰사", "암행어사", "사또", "농민", "노비"],
      8: ["사바나", "세자", "영의정", "관찰사", "암행어사", "사또", "농민", "노비"]
    };
    return (map[count] || [])[i] || `${i + 1}등`;
  }
  function sortHand(cards = []) { return cards.slice().sort((a, b) => a.rank - b.rank || String(a.id).localeCompare(String(b.id))); }
  function makeDeck(count) {
    const max = maxRankForCount(count);
    const deck = [];
    RANKS.filter((r) => r.rank <= max).forEach((r) => {
      for (let i = 1; i <= r.count; i += 1) deck.push({ id: `r${r.rank}-${i}-${Math.random().toString(36).slice(2, 8)}`, rank: r.rank, name: r.name });
    });
    for (let i = 1; i <= 2; i += 1) deck.push({ id: `j-${i}-${Math.random().toString(36).slice(2, 8)}`, rank: 13, name: "홍길동", joker: true });
    return shuffle(deck);
  }
  function groupHand(cards = []) {
    const map = new Map();
    sortHand(cards).forEach((c) => {
      if (!map.has(c.rank)) map.set(c.rank, []);
      map.get(c.rank).push(c);
    });
    return Array.from(map.entries()).map(([rank, items]) => ({ rank, items }));
  }
  function comboText(c) { return c ? `${rankInfo(c.effectiveRank).name} ${c.count}장` : "새 판"; }
  function selectedCards() {
    const hand = me()?.hand || [];
    const ids = new Set();
    S.selected.forEach((items) => items.forEach((c) => ids.add(c.id)));
    return hand.filter((c) => ids.has(c.id));
  }
  function normalizeSelection(cards) {
    if (!cards.length) return { ok: false, reason: "카드를 선택하세요." };
    const normals = cards.filter((c) => !c.joker);
    const ranks = Array.from(new Set(normals.map((c) => c.rank)));
    if (ranks.length > 1) return { ok: false, reason: "같은 계급만 함께 낼 수 있습니다." };
    if (!normals.length) return { ok: true, effectiveRank: 13, effectiveName: "홍길동", count: cards.length, cards };
    return { ok: true, effectiveRank: ranks[0], effectiveName: rankInfo(ranks[0]).name, count: cards.length, cards };
  }
  function canPlay(cards) {
    const combo = normalizeSelection(cards);
    if (!combo.ok) return combo;
    const cur = S.room?.currentSet;
    if (!cur) return combo;
    if (combo.count !== cur.count) return { ok: false, reason: `이번 판은 ${cur.count}장씩 내야 합니다.` };
    if (combo.effectiveRank >= cur.effectiveRank) return { ok: false, reason: "더 높은 계급만 낼 수 있습니다." };
    return combo;
  }
  function nextActiveUidAfter(uid) {
    const active = players().filter((p) => !p.finished && !p.forfeited);
    if (!active.length) return "";
    const idx = Math.max(0, active.findIndex((p) => p.uid === uid));
    for (let step = 1; step <= active.length; step += 1) {
      const target = active[(idx + step) % active.length];
      if (target && !target.finished && !target.forfeited) return target.uid;
    }
    return active[0]?.uid || "";
  }
  function myTributePair() {
    const pairs = S.room?.tribute?.pairs || [];
    return pairs.find((p) => p.toUid === S.user && !p.returned) || null;
  }
  function selectBestTributeCards(hand, count) {
    return sortHand(hand).filter((c) => !c.joker).slice(0, count);
  }

  async function addSystem(text) {
    if (!S.roomId) return;
    await msgRef().add({ type: "system", text, createdAt: FV.serverTimestamp() });
  }
  async function recount(roomId = S.roomId) {
    if (!roomId) return;
    const snap = await partRef(roomId).get();
    const list = snap.docs.map((d) => d.data());
    await roomRef(roomId).set({
      playerCount: list.filter((p) => p.type === "player").length,
      spectatorCount: list.filter((p) => p.type === "spectator").length,
      updatedAt: FV.serverTimestamp()
    }, { merge: true });
  }

  function renderRanks() {
    E.rankPreview.innerHTML = RANKS.map((r) => `<span class="rank-chip">${r.code}. ${esc(r.name)}</span>`).join("");
  }
  function watchRooms() {
    if (S.unsub.rooms) S.unsub.rooms();
    S.unsub.rooms = roomCol().orderBy("updatedAt", "desc").limit(30).onSnapshot((snap) => {
      if (snap.empty) {
        E.roomList.innerHTML = `<div class="muted">생성된 방이 없습니다.</div>`;
        return;
      }
      E.roomList.innerHTML = snap.docs.map((doc) => {
        const r = doc.data();
        const status = ({ waiting: "대기 중", playing: "진행 중", betweenRounds: "라운드 종료", tributeReturn: "상납 반환", finished: "게임 종료" })[r.status] || r.status;
        const total = r.totalRounds ? `${r.totalRounds}판` : "무제한";
        return `<div class="room-item"><div><strong>${esc(r.title || "사바나 달무티")}</strong><div class="room-meta">${status} · 플레이어 ${r.playerCount || 0}/${MAX_PLAYERS} · 관전자 ${r.spectatorCount || 0} · ${total}</div></div><button class="btn primary" type="button" onclick="Dalmuti.joinRoom('${doc.id}')">입장</button></div>`;
      }).join("");
    }, console.error);
  }
  function renderMessages(snap) {
    const docs = snap.docs.slice().reverse();
    E.chatList.innerHTML = docs.length ? docs.map((doc) => {
      const m = doc.data();
      if (m.type === "system") return `<div class="chat-msg system">${esc(m.text)}</div>`;
      return `<div class="chat-msg"><span class="chat-name">${esc(m.nickname || "-")}</span> ${esc(m.text || "")}</div>`;
    }).join("") : `<div class="muted">채팅이 없습니다.</div>`;
    E.chatList.scrollTop = E.chatList.scrollHeight;
  }
  function positionedPlayers() {
    const ps = players();
    const meIdx = Math.max(0, ps.findIndex((p) => p.uid === S.user));
    const rotated = meIdx >= 0 ? ps.slice(meIdx).concat(ps.slice(0, meIdx)) : ps;
    const mine = rotated[0];
    const others = rotated.slice(1);
    const n = others.length;
    let left = [], top = [], right = [];
    if (n === 1) top = others;
    else if (n === 2) { left = [others[0]]; right = [others[1]]; }
    else if (n === 3) { left = [others[0]]; top = [others[1]]; right = [others[2]]; }
    else if (n === 4) { left = [others[0]]; top = [others[1], others[2]]; right = [others[3]]; }
    else if (n === 5) { left = [others[0], others[1]]; top = [others[2], others[3]]; right = [others[4]]; }
    else if (n === 6) { left = [others[0], others[1]]; top = [others[2], others[3]]; right = [others[4], others[5]]; }
    else { left = [others[0], others[1]]; top = [others[2], others[3], others[4]]; right = [others[5], others[6]]; }
    return [
      ...(mine ? [{ p: mine, cls: "seat-bottom" }] : []),
      ...left.map((p, i) => ({ p, cls: `seat-left-${left.length === 1 ? 0 : i + 1}` })),
      ...top.map((p, i) => ({ p, cls: `seat-top-${top.length === 1 ? 0 : i}` })),
      ...right.map((p, i) => ({ p, cls: `seat-right-${right.length === 1 ? 0 : i + 1}` }))
    ];
  }
  function renderPlayers() {
    E.playersArea.innerHTML = positionedPlayers().map(({ p, cls }) => {
      const classes = ["player-box", cls, p.uid === S.user ? "me" : "", p.uid === S.room?.currentTurnUid ? "turn" : "", p.passed ? "passed" : "", p.finished ? "finished" : ""].join(" ");
      const state = p.finished ? `${p.finishedRank}등` : p.passed ? "패스" : `${p.cardCount || 0}장`;
      return `<div class="${classes}"><div class="player-role">${esc(p.role || (p.type === "spectator" ? "관전자" : "참가자"))}</div><div class="player-name">${esc(p.nickname)}</div><div class="player-meta">${state}${p.isReady ? " · 준비" : ""}</div></div>`;
    }).join("");
  }
  function renderPile() {
    if (S.room?.status === "tributeReturn") {
      const pairs = S.room.tribute?.pairs || [];
      E.centerPile.innerHTML = `<div class="pile-title">상납 반환</div><div class="muted">상납 받은 사람이 돌려줄 카드를 선택합니다.</div><div class="muted">${pairs.map((p) => `${esc(p.fromNickname)} → ${esc(p.toNickname)} ${p.count}장 ${p.returned ? "완료" : "대기"}`).join("<br>")}</div>`;
      return;
    }
    const prev = S.room?.previousSet;
    const cur = S.room?.currentSet;
    if (!prev && !cur) {
      E.centerPile.innerHTML = `<div class="pile-title">새 판</div><div class="muted">제출된 카드가 없습니다.</div>`;
      return;
    }
    const draw = (set, label) => set ? `<div class="${label === "직전" ? "muted" : "pile-title"}">${label} ${comboText(set)}</div><div class="pile-cards">${(set.cards || []).map((c) => `<img class="mini-card" src="${cardImg(c.rank)}" alt="${esc(c.name)}">`).join("")}</div>` : "";
    E.centerPile.innerHTML = draw(prev, "직전") + draw(cur, "현재");
  }
  function isSelectableRank(group) {
    if (S.room?.status === "tributeReturn") return !!myTributePair();
    if (S.room?.status !== "playing" || S.room.currentTurnUid !== S.user) return true;
    if (!S.room.currentSet) return true;
    if (group.rank === 13) return false;
    const need = S.room.currentSet.count;
    const jokerCount = (me()?.hand || []).filter((c) => c.joker).length;
    return group.items.length + jokerCount >= need && group.rank < S.room.currentSet.effectiveRank;
  }
  function renderHand() {
    const mine = me();
    if (!mine || mine.type !== "player") {
      E.handArea.innerHTML = `<div class="muted">관전자는 손패가 없습니다.</div>`;
      E.selectedSummary.textContent = "선택 없음";
      return;
    }
    const groups = groupHand(mine.hand || []);
    E.handArea.classList.toggle("has-selection", S.selected.size > 0);
    E.handArea.innerHTML = groups.length ? groups.map((g) => {
      const sel = S.selected.get(g.rank)?.length || 0;
      return `<div class="hand-stack${sel ? " selected" : ""}${isSelectableRank(g) ? "" : " disabled"}" onclick="Dalmuti.toggleRank(${g.rank})">${sel ? `<span class="stack-selected">${sel}</span>` : ""}<img src="${cardImg(g.rank)}" alt="${esc(rankInfo(g.rank).name)}"><span class="stack-count">x${g.items.length}</span></div>`;
    }).join("") : `<div class="muted">손패가 없습니다.</div>`;
    const cards = selectedCards();
    if (S.room?.status === "tributeReturn") {
      const pair = myTributePair();
      E.selectedSummary.textContent = pair ? `${cards.length}/${pair.count}장 반환 선택` : "상납 반환 대기";
      return;
    }
    const combo = canPlay(cards);
    E.selectedSummary.textContent = cards.length ? (combo.ok ? comboText(combo) : combo.reason) : "선택 없음";
  }
  function renderScores() {
    const ps = players();
    E.scoreList.innerHTML = ps.length ? ps.map((p) => `<div class="score-row"><span>${esc(p.role || "-")} · ${esc(p.nickname)}</span><strong>${p.score || 0}</strong></div>`).join("") : `<div class="muted">참가자가 없습니다.</div>`;
  }
  function renderControls() {
    const mine = me();
    const waiting = S.room?.status === "waiting";
    const between = S.room?.status === "betweenRounds" || S.room?.status === "finished";
    const myTurn = S.room?.status === "playing" && S.room.currentTurnUid === S.user && mine?.type === "player" && !mine.finished && !mine.forfeited;
    const tributeTurn = S.room?.status === "tributeReturn" && !!myTributePair();
    E.lobbyControls.classList.toggle("hidden", !waiting);
    E.betweenControls.classList.toggle("hidden", !between);
    E.playControls.classList.toggle("hidden", !(myTurn || tributeTurn));
    E.passBtn.classList.toggle("hidden", !myTurn);
    E.playBtn.textContent = tributeTurn ? "반환 카드 주기" : "선택 카드 내기";
    E.readyBtn.classList.toggle("hidden", !(waiting && mine?.type === "player"));
    E.watchBtn.classList.toggle("hidden", !(waiting && mine?.type === "player"));
    E.joinAsPlayerBtn.classList.toggle("hidden", !(waiting && mine?.type === "spectator"));
    E.startBtn.classList.toggle("hidden", !(waiting && isHost()));
    E.nextRoundBtn.classList.toggle("hidden", !(S.room?.status === "betweenRounds" && isHost()));
    E.resetGameBtn.classList.toggle("hidden", !isHost());
    E.readyBtn.textContent = mine?.isReady ? "준비 취소" : "준비";
  }
  function messageText() {
    const mine = me();
    if (!S.room) return "";
    if (S.room.status === "waiting") return mine?.type === "spectator" ? "관전 중입니다. 참가하려면 참가하기를 누르세요." : "준비를 누르거나 관전하기를 선택하세요.";
    if (S.room.status === "tributeReturn") return myTributePair() ? "상납으로 받은 만큼 돌려줄 카드를 선택하세요." : "상납 반환을 기다리는 중입니다.";
    if (S.room.status === "betweenRounds") return "라운드가 끝났습니다. 다음 계급과 승점을 확인하세요.";
    if (S.room.status === "finished") return "게임이 종료되었습니다.";
    if (S.room.currentTurnUid === S.user) return "내 차례입니다.";
    return "다른 플레이어 차례입니다.";
  }
  function renderRoom() {
    if (!S.room) return;
    const statusName = ({ waiting: "대기 중", playing: `${S.room.round || 1}라운드 진행 중`, tributeReturn: "상납 반환", betweenRounds: "라운드 종료", finished: "게임 종료" })[S.room.status] || S.room.status;
    E.roomStateText.textContent = statusName;
    E.roomTitle.textContent = S.room.title || "사바나 달무티";
    E.turnBadge.textContent = S.room.status === "playing" ? `차례: ${S.participants.find((p) => p.uid === S.room.currentTurnUid)?.nickname || "-"}` : statusName;
    E.messageBar.textContent = messageText();
    renderPlayers(); renderPile(); renderScores(); renderHand(); renderControls();
  }

  async function createRoom() {
    const title = E.roomTitleInput.value.trim() || `${S.user}의 사바나 달무티`;
    const totalRaw = Number(E.totalRoundsSelect.value || 5);
    const doc = await roomCol().add({
      title,
      hostUid: S.user,
      hostNickname: S.user,
      status: "waiting",
      round: 0,
      totalRounds: totalRaw === 0 ? null : totalRaw,
      turnLimit: Number(E.turnLimitSelect.value || 15),
      playerLimit: MAX_PLAYERS,
      playerCount: 1,
      spectatorCount: 0,
      currentTurnUid: null,
      currentSet: null,
      previousSet: null,
      finishOrder: [],
      lastRoundResult: null,
      finalResult: null,
      tribute: null,
      spectatorChatEnabled: true,
      createdAt: FV.serverTimestamp(),
      updatedAt: FV.serverTimestamp()
    });
    S.roomId = doc.id;
    localStorage.setItem("dalmutiCurrentRoomId", S.roomId);
    await partRef().doc(S.user).set(baseParticipant("player", { isHost: true, seatOrder: 0 }));
    await addSystem(`${S.user}님이 방을 만들었습니다.`);
    enterRoom(S.roomId);
  }
  function baseParticipant(type, extra = {}) {
    return {
      uid: S.user,
      nickname: S.user,
      type,
      isReady: false,
      seatOrder: type === "player" ? 999 : null,
      role: null,
      score: 0,
      lastRoundScore: 0,
      lastRoundRank: null,
      hand: [],
      cardCount: 0,
      passed: false,
      finished: false,
      finishedRank: null,
      forfeited: false,
      timeoutCount: 0,
      connected: true,
      joinedAt: FV.serverTimestamp(),
      updatedAt: FV.serverTimestamp(),
      ...extra
    };
  }
  async function joinRoom(id) {
    S.roomId = id;
    localStorage.setItem("dalmutiCurrentRoomId", id);
    const rs = await roomRef(id).get();
    if (!rs.exists) return toast("방을 찾을 수 없습니다.");
    const room = rs.data();
    const pr = partRef(id).doc(S.user);
    const ps = await pr.get();
    if (ps.exists) await pr.set({ connected: true, updatedAt: FV.serverTimestamp() }, { merge: true });
    else {
      await pr.set(baseParticipant(room.status === "waiting" ? "player" : "spectator"));
      await msgRef(id).add({ type: "system", text: `${S.user}님이 입장했습니다.`, createdAt: FV.serverTimestamp() });
    }
    await recount(id);
    enterRoom(id);
  }
  function enterRoom(id) {
    S.roomId = id;
    setView("room");
    S.selected.clear();
    [S.unsub.room, S.unsub.participants, S.unsub.messages].forEach((fn) => typeof fn === "function" && fn());
    S.unsub.room = roomRef(id).onSnapshot((snap) => { if (!snap.exists) return leaveRoomLocal(); S.room = { id: snap.id, ...snap.data() }; renderRoom(); }, console.error);
    S.unsub.participants = partRef(id).onSnapshot((snap) => { S.participants = snap.docs.map((d) => ({ id: d.id, ...d.data() })); renderRoom(); recount(id).catch(console.error); }, console.error);
    S.unsub.messages = msgRef(id).orderBy("createdAt", "desc").limit(100).onSnapshot(renderMessages, console.error);
  }
  async function leaveRoom() {
    if (!S.roomId) return;
    const mine = me();
    if (mine) {
      await partRef().doc(S.user).delete();
      await addSystem(`${S.user}님이 방을 나갔습니다.`);
      if (S.room?.hostUid === S.user) await assignHost();
      await recount();
    }
    leaveRoomLocal();
  }
  function leaveRoomLocal() {
    [S.unsub.room, S.unsub.participants, S.unsub.messages].forEach((fn) => typeof fn === "function" && fn());
    S.roomId = ""; S.room = null; S.participants = []; S.selected.clear();
    localStorage.removeItem("dalmutiCurrentRoomId");
    setView("lobby"); watchRooms();
  }
  async function assignHost() {
    const next = S.participants.filter((p) => p.uid !== S.user).sort((a, b) => (a.type !== b.type ? (a.type === "player" ? -1 : 1) : (a.seatOrder ?? 999) - (b.seatOrder ?? 999)))[0];
    if (next) await roomRef().set({ hostUid: next.uid, hostNickname: next.nickname, updatedAt: FV.serverTimestamp() }, { merge: true });
  }
  async function toggleReady() {
    const mine = me();
    if (!mine || S.room?.status !== "waiting" || mine.type !== "player") return;
    await partRef().doc(S.user).set({ isReady: !mine.isReady, updatedAt: FV.serverTimestamp() }, { merge: true });
  }
  async function becomeSpectator() {
    if (S.room?.status !== "waiting") return;
    await partRef().doc(S.user).set({ type: "spectator", isReady: false, seatOrder: null, role: null, hand: [], cardCount: 0, updatedAt: FV.serverTimestamp() }, { merge: true });
    await recount();
  }
  async function becomePlayer() {
    if (S.room?.status !== "waiting") return;
    if (players().length >= MAX_PLAYERS) return toast("최대 8명까지 참가할 수 있습니다.");
    await partRef().doc(S.user).set({ type: "player", isReady: false, seatOrder: players().length, updatedAt: FV.serverTimestamp() }, { merge: true });
    await recount();
  }
  async function startGame() {
    if (!isHost() || S.room?.status !== "waiting") return;
    const ps = players();
    if (ps.length < 2) return toast("2명 이상 필요합니다.");
    if (!ps.every((p) => p.isReady)) return toast("아직 준비하지 않은 인원이 있습니다.");
    await startRound(1, true);
  }
  function makeTributePairs(ps, hands) {
    if (ps.length < 3) return [];
    const pairs = [];
    if (ps.length === 3) pairs.push({ from: ps[2], to: ps[0], count: 1 });
    else {
      pairs.push({ from: ps[ps.length - 1], to: ps[0], count: 2 });
      pairs.push({ from: ps[ps.length - 2], to: ps[1], count: 1 });
    }
    return pairs.map((x, idx) => {
      const cards = selectBestTributeCards(hands[x.from.uid], x.count);
      const ids = new Set(cards.map((c) => c.id));
      hands[x.from.uid] = hands[x.from.uid].filter((c) => !ids.has(c.id));
      hands[x.to.uid] = sortHand(hands[x.to.uid].concat(cards));
      return {
        id: `tribute-${idx}`,
        fromUid: x.from.uid,
        fromNickname: x.from.nickname,
        toUid: x.to.uid,
        toNickname: x.to.nickname,
        count: cards.length,
        cards,
        returned: cards.length === 0,
        returnedCards: []
      };
    }).filter((p) => p.count > 0);
  }
  async function startRound(round, resetScore) {
    const ps = players().map((p, i) => ({ ...p, seatOrder: i }));
    const deck = makeDeck(ps.length);
    const hands = Object.fromEntries(ps.map((p) => [p.uid, []]));
    deck.forEach((c, i) => hands[ps[i % ps.length].uid].push(c));
    Object.keys(hands).forEach((uid) => { hands[uid] = sortHand(hands[uid]); });
    const pairs = round > 1 ? makeTributePairs(ps, hands) : [];
    const hasTribute = pairs.some((p) => !p.returned);
    const batch = db.batch();
    batch.set(roomRef(), {
      status: hasTribute ? "tributeReturn" : "playing",
      round,
      currentTurnUid: hasTribute ? null : ps[0].uid,
      currentSet: null,
      previousSet: null,
      finishOrder: [],
      turnOrder: ps.map((p) => p.uid),
      tribute: hasTribute ? { phase: "return", pairs, returnStartedAt: nowTs() } : null,
      updatedAt: FV.serverTimestamp()
    }, { merge: true });
    ps.forEach((p, i) => {
      const hand = sortHand(hands[p.uid]);
      batch.set(partRef().doc(p.uid), {
        type: "player",
        seatOrder: i,
        role: roleByIndex(i, ps.length),
        score: resetScore ? 0 : (p.score || 0),
        hand,
        cardCount: hand.length,
        isReady: false,
        passed: false,
        finished: false,
        finishedRank: null,
        forfeited: false,
        timeoutCount: 0,
        updatedAt: FV.serverTimestamp()
      }, { merge: true });
    });
    await batch.commit();
    await addSystem(hasTribute ? `${round}라운드 상납 반환을 시작합니다.` : `${round}라운드가 시작되었습니다.`);
  }
  function toggleTributeRank(rank, group) {
    const pair = myTributePair();
    if (!pair) return toast("반환할 차례가 아닙니다.");
    const current = S.selected.get(rank) || [];
    if (current.length) S.selected.delete(rank);
    else {
      const used = selectedCards().length;
      const roomLeft = Math.max(0, pair.count - used);
      if (roomLeft <= 0) return toast(`${pair.count}장만 선택할 수 있습니다.`);
      S.selected.set(rank, group.items.slice(0, roomLeft));
    }
    renderHand();
  }
  function toggleRank(rank) {
    const mine = me();
    if (!mine || mine.type !== "player") return;
    const group = groupHand(mine.hand || []).find((g) => g.rank === rank);
    if (!group) return;
    if (S.room?.status === "tributeReturn") return toggleTributeRank(rank, group);
    if (S.room?.status === "playing" && S.room.currentTurnUid === S.user && S.room.currentSet) {
      if (!isSelectableRank(group)) return toast("낼 수 없는 계급입니다.");
      S.selected.clear();
      const need = S.room.currentSet.count;
      const normals = group.items.filter((c) => !c.joker).slice(0, need);
      const jokers = (mine.hand || []).filter((c) => c.joker).slice(0, Math.max(0, need - normals.length));
      S.selected.set(rank, normals.concat(jokers));
      renderHand();
      return;
    }
    if (S.selected.has(rank)) S.selected.delete(rank);
    else if (rank === 13) S.selected.set(rank, group.items.slice());
    else {
      const jokers = S.selected.get(13) || [];
      S.selected.clear();
      S.selected.set(rank, group.items.slice());
      if (jokers.length) S.selected.set(13, jokers);
    }
    renderHand();
  }
  async function playSelected() {
    if (S.room?.status === "tributeReturn") return returnTributeCards();
    const mine = me();
    if (!mine || S.room?.currentTurnUid !== S.user || mine.type !== "player") return;
    const cards = selectedCards();
    const combo = canPlay(cards);
    if (!combo.ok) return toast(combo.reason);
    const ids = new Set(cards.map((c) => c.id));
    const newHand = (mine.hand || []).filter((c) => !ids.has(c.id));
    const finishOrder = (S.room.finishOrder || []).slice();
    let finishedRank = mine.finishedRank || null;
    const finished = newHand.length === 0;
    if (finished && !mine.finished) {
      finishedRank = finishOrder.length + 1;
      finishOrder.push({ uid: S.user, nickname: mine.nickname, rank: finishedRank, finishedAt: nowTs() });
    }
    const remaining = players().filter((p) => p.uid !== S.user && !p.finished && !p.forfeited).length + (finished ? 0 : 1);
    const batch = db.batch();
    batch.set(partRef().doc(S.user), { hand: newHand, cardCount: newHand.length, passed: false, finished, finishedRank, timeoutCount: 0, updatedAt: FV.serverTimestamp() }, { merge: true });
    players().forEach((p) => { if (p.uid !== S.user) batch.set(partRef().doc(p.uid), { passed: false }, { merge: true }); });
    const setData = { uid: S.user, nickname: mine.nickname, effectiveRank: combo.effectiveRank, effectiveName: combo.effectiveName, count: combo.count, cards, createdAt: nowTs() };
    if (remaining <= 1) {
      const last = players().find((p) => p.uid !== S.user && !p.finished && !p.forfeited);
      const finalOrder = finishOrder.slice();
      if (last) finalOrder.push({ uid: last.uid, nickname: last.nickname, rank: finalOrder.length + 1, finishedAt: nowTs() });
      batch.set(roomRef(), { status: "betweenRounds", currentTurnUid: null, previousSet: S.room.currentSet || null, currentSet: setData, finishOrder: finalOrder, updatedAt: FV.serverTimestamp() }, { merge: true });
      await batch.commit();
      await finishRound(finalOrder);
      return;
    }
    batch.set(roomRef(), { previousSet: S.room.currentSet || null, currentSet: setData, currentTurnUid: nextActiveUidAfter(S.user), finishOrder, updatedAt: FV.serverTimestamp() }, { merge: true });
    S.selected.clear();
    await batch.commit();
  }
  async function returnTributeCards() {
    const pair = myTributePair();
    const mine = me();
    if (!pair || !mine) return;
    const cards = selectedCards();
    if (cards.length !== pair.count) return toast(`${pair.count}장을 선택해야 합니다.`);
    const ids = new Set(cards.map((c) => c.id));
    const newMyHand = (mine.hand || []).filter((c) => !ids.has(c.id));
    const fromPlayer = S.participants.find((p) => p.uid === pair.fromUid);
    const fromHand = sortHand([...(fromPlayer?.hand || []), ...cards]);
    const pairs = (S.room.tribute?.pairs || []).map((p) => p.id === pair.id ? { ...p, returned: true, returnedCards: cards } : p);
    const allDone = pairs.every((p) => p.returned);
    const batch = db.batch();
    batch.set(partRef().doc(S.user), { hand: newMyHand, cardCount: newMyHand.length, updatedAt: FV.serverTimestamp() }, { merge: true });
    batch.set(partRef().doc(pair.fromUid), { hand: fromHand, cardCount: fromHand.length, updatedAt: FV.serverTimestamp() }, { merge: true });
    batch.set(roomRef(), { tribute: { ...(S.room.tribute || {}), pairs }, status: allDone ? "playing" : "tributeReturn", currentTurnUid: allDone ? players()[0]?.uid || null : null, updatedAt: FV.serverTimestamp() }, { merge: true });
    S.selected.clear();
    await batch.commit();
    if (allDone) await addSystem(`${S.room.round}라운드가 시작되었습니다.`);
  }
  async function passTurn() {
    const mine = me();
    if (!mine || S.room?.currentTurnUid !== S.user) return;
    if (!S.room.currentSet) return toast("새 판에서는 패스할 수 없습니다.");
    const active = players().filter((p) => !p.finished && !p.forfeited).map((p) => p.uid);
    const others = active.filter((uid) => uid !== S.room.currentSet.uid);
    const passed = new Set(players().filter((p) => p.passed).map((p) => p.uid));
    passed.add(S.user);
    const trickOver = others.every((uid) => passed.has(uid));
    const batch = db.batch();
    batch.set(partRef().doc(S.user), { passed: true, updatedAt: FV.serverTimestamp() }, { merge: true });
    if (trickOver) {
      players().forEach((p) => batch.set(partRef().doc(p.uid), { passed: false }, { merge: true }));
      const starter = S.room.currentSet.uid;
      const starterPlayer = players().find((p) => p.uid === starter && !p.finished && !p.forfeited);
      batch.set(roomRef(), { currentTurnUid: starterPlayer ? starter : nextActiveUidAfter(starter), previousSet: S.room.currentSet, currentSet: null, updatedAt: FV.serverTimestamp() }, { merge: true });
    } else batch.set(roomRef(), { currentTurnUid: nextActiveUidAfter(S.user), updatedAt: FV.serverTimestamp() }, { merge: true });
    await batch.commit();
  }
  async function finishRound(order) {
    const total = players().length;
    const batch = db.batch();
    order.forEach((r, i) => {
      const score = total - i;
      batch.set(partRef().doc(r.uid), { score: FV.increment(score), lastRoundScore: score, lastRoundRank: i + 1, role: roleByIndex(i, total), seatOrder: i, finished: true, finishedRank: i + 1, updatedAt: FV.serverTimestamp() }, { merge: true });
    });
    batch.set(roomRef(), { status: S.room.totalRounds && S.room.round >= S.room.totalRounds ? "finished" : "betweenRounds", currentTurnUid: null, currentSet: null, previousSet: null, tribute: null, finishOrder: order, lastRoundResult: { round: S.room.round, results: order, endedAt: nowTs() }, updatedAt: FV.serverTimestamp() }, { merge: true });
    await batch.commit();
    await addSystem(S.room.totalRounds && S.room.round >= S.room.totalRounds ? "게임이 종료되었습니다." : `${S.room.round}라운드가 종료되었습니다.`);
  }
  async function nextRound() {
    if (!isHost() || S.room?.status !== "betweenRounds") return;
    await startRound((S.room.round || 0) + 1, false);
  }
  async function resetGame() {
    if (!isHost()) return;
    if (!confirm("현재 진행 상황과 누적 승점이 모두 초기화됩니다. 새 게임으로 초기화할까요?")) return;
    const batch = db.batch();
    batch.set(roomRef(), { status: "waiting", round: 0, currentTurnUid: null, currentSet: null, previousSet: null, tribute: null, finishOrder: [], lastRoundResult: null, finalResult: null, updatedAt: FV.serverTimestamp() }, { merge: true });
    S.participants.forEach((p) => batch.set(partRef().doc(p.uid), { isReady: false, role: null, score: 0, lastRoundScore: 0, lastRoundRank: null, hand: [], cardCount: 0, passed: false, finished: false, finishedRank: null, forfeited: false, timeoutCount: 0, updatedAt: FV.serverTimestamp() }, { merge: true }));
    await batch.commit();
    await addSystem("방장이 새 게임으로 초기화했습니다.");
  }
  async function sendChat() {
    const text = E.chatInput.value.trim();
    if (!text || !S.roomId) return;
    const mine = me();
    if (mine?.type === "spectator" && S.room?.spectatorChatEnabled === false) return toast("관전자 채팅이 차단되어 있습니다.");
    E.chatInput.value = "";
    await msgRef().add({ type: "chat", uid: S.user, nickname: mine?.nickname || S.user, text, createdAt: FV.serverTimestamp() });
  }
  async function toggleSpectatorChat() {
    if (!isHost()) return;
    await roomRef().set({ spectatorChatEnabled: S.room?.spectatorChatEnabled === false, updatedAt: FV.serverTimestamp() }, { merge: true });
  }
  function collectEls() {
    ["lobbyView","roomView","myNickname","roomTitleInput","totalRoundsSelect","turnLimitSelect","roomList","rankPreview","roomStateText","roomTitle","turnBadge","messageBar","lobbyControls","readyBtn","watchBtn","joinAsPlayerBtn","startBtn","betweenControls","nextRoundBtn","resetGameBtn","playersArea","centerPile","handArea","selectedSummary","playControls","playBtn","passBtn","scoreList","chatList","chatInput","sendChatBtn","toggleSpectatorChatBtn","homeBtn","leaveRoomBtn","createRoomBtn","refreshRoomsBtn","toast"].forEach((id) => { E[id] = $(id); });
  }
  async function init() {
    collectEls();
    S.user = String(localStorage.getItem("partyAppUser") || "").trim();
    if (!S.user) { alert("닉네임을 입력하세요."); return; }
    E.myNickname.textContent = S.user;
    renderRanks(); watchRooms();
    if (S.roomId) {
      const ps = await partRef(S.roomId).doc(S.user).get().catch(() => null);
      if (ps?.exists) enterRoom(S.roomId);
      else localStorage.removeItem("dalmutiCurrentRoomId");
    }
  }

  window.Dalmuti = { joinRoom, toggleRank };
  window.addEventListener("DOMContentLoaded", () => {
    init();
    E.homeBtn.addEventListener("click", () => { location.href = "../"; });
    E.leaveRoomBtn.addEventListener("click", leaveRoom);
    E.createRoomBtn.addEventListener("click", createRoom);
    E.refreshRoomsBtn.addEventListener("click", watchRooms);
    E.readyBtn.addEventListener("click", toggleReady);
    E.watchBtn.addEventListener("click", becomeSpectator);
    E.joinAsPlayerBtn.addEventListener("click", becomePlayer);
    E.startBtn.addEventListener("click", startGame);
    E.nextRoundBtn.addEventListener("click", nextRound);
    E.resetGameBtn.addEventListener("click", resetGame);
    E.playBtn.addEventListener("click", playSelected);
    E.passBtn.addEventListener("click", passTurn);
    E.sendChatBtn.addEventListener("click", sendChat);
    E.chatInput.addEventListener("keydown", (e) => { if (e.key === "Enter") sendChat(); });
    E.toggleSpectatorChatBtn.addEventListener("click", toggleSpectatorChat);
  });
})();