(() => {
  "use strict";

  if (!window.firebase || !firebase.apps.length) {
    alert("Firebase 초기화가 필요합니다.");
    return;
  }

  try {
    firebase.firestore().settings({ experimentalForceLongPolling: true, useFetchStreams: false });
  } catch (err) {
    // Firestore settings can only be called once. Ignore when already configured.
  }

  const db = firebase.firestore();
  const FV = firebase.firestore.FieldValue;
  const CARD_BASE = "./cards/";
  const MAX_PLAYERS = 8;
  const MASTER = "병풍";
  const CHAT_LIMIT = 12;
  const AI_DELAY = 700;
  const TRIBUTE_ANIM_MS = 3000;

  const RANKS = [
    [1, "01", "사바나", "card-01-sabana.png", 1],
    [2, "02", "세자", "card-02-prince.png", 2],
    [3, "03", "영의정", "card-03-yeonguijeong.png", 3],
    [4, "04", "관찰사", "card-04-governor.png", 4],
    [5, "05", "암행어사", "card-05-amhaeng.png", 5],
    [6, "06", "사또", "card-06-satto.png", 6],
    [7, "07", "이방", "card-07-ibang.png", 7],
    [8, "08", "포졸", "card-08-pojol.png", 8],
    [9, "09", "선비", "card-09-seonbi.png", 9],
    [10, "10", "상인", "card-10-merchant.png", 10],
    [11, "11", "농민", "card-11-farmer.png", 11],
    [12, "12", "노비", "card-12-nobi.png", 12],
    [13, "J", "홍길동", "card-j-hong.png", 2]
  ].map(([rank, code, name, image, count]) => ({ rank, code, name, image, count, joker: rank === 13 }));

  const S = {
    user: "",
    roomId: localStorage.getItem("dalmutiCurrentRoomId") || "",
    room: null,
    hand: [],
    selected: new Map(),
    roomUnsub: null,
    handUnsub: null,
    seenStart: new Set(),
    seenResult: new Set(),
    seenRebellion: new Set(),
    aiLocks: new Set(),
    actionBusy: false
  };

  const E = {};
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? "").replace(/[&<>\"]/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
  const ts = () => firebase.firestore.Timestamp.now();
  const serverNow = () => FV.serverTimestamp();

  const roomCol = () => db.collection("events").doc("dalmuti").collection("rooms");
  const roomRef = (id = S.roomId) => roomCol().doc(id);
  const handRef = (uid = S.user, id = S.roomId) => roomRef(id).collection("hands").doc(uid);

  function cleanMap(obj) {
    return Object.fromEntries(Object.entries(obj || {}).filter(([, v]) => v && typeof v === "object"));
  }

  function rankInfo(rank) {
    return RANKS.find(r => r.rank === Number(rank)) || RANKS[RANKS.length - 1];
  }

  function cardImg(rank) {
    return CARD_BASE + rankInfo(rank).image;
  }

  function playersMap(room = S.room) {
    return cleanMap(room?.players);
  }

  function spectatorsMap(room = S.room) {
    return cleanMap(room?.spectators);
  }

  function allPlayers(room = S.room) {
    return Object.values(playersMap(room))
      .filter(p => p && !p.removedFromRoom)
      .sort((a, b) => (a.seatOrder ?? 999) - (b.seatOrder ?? 999));
  }

  function spectators(room = S.room) {
    return Object.values(spectatorsMap(room))
      .filter(p => p && !p.removedFromRoom)
      .sort((a, b) => String(a.nickname || "").localeCompare(String(b.nickname || ""), "ko"));
  }

  function activePlayers(room = S.room) {
    return allPlayers(room).filter(p => !p.finished && !p.forfeited);
  }

  function me(room = S.room) {
    return playersMap(room)[S.user] || spectatorsMap(room)[S.user] || null;
  }

  function isHost(room = S.room) {
    return room?.hostUid === S.user;
  }

  function isMaster() {
    return S.user === MASTER;
  }

  function canAdmin(room = S.room) {
    return isHost(room) || isMaster();
  }

  function toast(text) {
    if (!E.toast) return alert(text);
    E.toast.textContent = text;
    E.toast.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => E.toast.classList.remove("show"), 1800);
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function maxRankByPlayers(count) {
    if (count <= 3) return 8;
    if (count <= 5) return 10;
    return 12;
  }

  function sortHand(hand = []) {
    return hand.slice().sort((a, b) => Number(a.rank) - Number(b.rank) || String(a.id).localeCompare(String(b.id)));
  }

  function groupHand(hand = []) {
    const map = new Map();
    sortHand(hand).forEach(card => {
      const rank = Number(card.rank);
      if (!map.has(rank)) map.set(rank, []);
      map.get(rank).push(card);
    });
    return [...map.entries()].map(([rank, items]) => ({ rank, items }));
  }

  function makeDeck(playerCount) {
    const deck = [];
    RANKS.filter(r => r.rank <= maxRankByPlayers(playerCount)).forEach(r => {
      for (let i = 1; i <= r.count; i++) {
        deck.push({ id: `r${r.rank}-${i}-${Math.random().toString(36).slice(2, 8)}`, rank: r.rank, name: r.name, joker: false });
      }
    });
    for (let i = 1; i <= 2; i++) {
      deck.push({ id: `j-${i}-${Math.random().toString(36).slice(2, 8)}`, rank: 13, name: "홍길동", joker: true });
    }
    return shuffle(deck);
  }

  function roleByIndex(index, count) {
    const map = {
      2: ["사바나", "노비"],
      3: ["사바나", "농민", "노비"],
      4: ["사바나", "세자", "농민", "노비"],
      5: ["사바나", "세자", "사또", "농민", "노비"],
      6: ["사바나", "세자", "암행어사", "사또", "농민", "노비"],
      7: ["사바나", "세자", "관찰사", "암행어사", "사또", "농민", "노비"],
      8: ["사바나", "세자", "영의정", "관찰사", "암행어사", "사또", "농민", "노비"]
    };
    return (map[count] || [])[index] || `${index + 1}등`;
  }

  function selectedCards() {
    const ids = new Set();
    S.selected.forEach(cards => cards.forEach(c => ids.add(c.id)));
    return S.hand.filter(c => ids.has(c.id));
  }

  function normalizeCombo(cards) {
    if (!cards.length) return { ok: false, reason: "카드를 선택하세요." };
    const normal = cards.filter(c => !(c.joker || Number(c.rank) === 13));
    const ranks = [...new Set(normal.map(c => Number(c.rank)))];
    if (ranks.length > 1) return { ok: false, reason: "같은 계급만 함께 낼 수 있습니다." };
    if (!normal.length) return { ok: true, effectiveRank: 13, effectiveName: "홍길동", count: cards.length, cards };
    return { ok: true, effectiveRank: ranks[0], effectiveName: rankInfo(ranks[0]).name, count: cards.length, cards };
  }

  function canPlayCombo(cards, room = S.room) {
    const combo = normalizeCombo(cards);
    if (!combo.ok) return combo;
    const current = room?.currentSet;
    if (!current) return combo;
    if (combo.count !== Number(current.count || 1)) return { ok: false, reason: `이번 판은 ${current.count}장씩 내야 합니다.` };
    if (combo.effectiveRank >= Number(current.effectiveRank)) return { ok: false, reason: "더 높은 계급만 낼 수 있습니다." };
    return combo;
  }

  function nextAfter(room, uid) {
    const list = activePlayers(room);
    if (!list.length) return null;
    const idx = list.findIndex(p => p.uid === uid);
    if (idx < 0) return list[0]?.uid || null;
    return list[(idx + 1) % list.length]?.uid || list[0]?.uid || null;
  }

  function countMap(map) {
    return Object.values(cleanMap(map)).filter(Boolean).length;
  }

  function getRoundSeenKey(kind, room = S.room) {
    if (!room) return "";
    return `dalmuti:${S.roomId}:${kind}:${room.round || 0}`;
  }

  function markSeen(set, key) {
    if (!key) return false;
    if (set.has(key) || sessionStorage.getItem(key)) return true;
    set.add(key);
    sessionStorage.setItem(key, "1");
    return false;
  }

  function collectElements() {
    [
      "lobbyView", "roomView", "myNickname", "roomTitleInput", "totalRoundsSelect", "turnLimitSelect",
      "roomList", "rankPreview", "roomStateText", "roomTitle", "turnBadge", "messageBar",
      "lobbyControls", "readyBtn", "watchBtn", "joinAsPlayerBtn", "startBtn", "betweenControls",
      "nextRoundBtn", "resetGameBtn", "playersArea", "centerPile", "handArea", "selectedSummary",
      "playControls", "playBtn", "passBtn", "scoreList", "chatList", "chatInput", "sendChatBtn",
      "toggleSpectatorChatBtn", "homeBtn", "leaveRoomBtn", "createRoomBtn", "refreshRoomsBtn", "toast"
    ].forEach(id => { E[id] = $(id); });
  }

  function injectCss() {
    if ($("dalmutiSingleCss")) return;
    const style = document.createElement("style");
    style.id = "dalmutiSingleCss";
    style.textContent = `
      @media(min-width:881px){
        .dalmuti-app{width:min(1380px,100%);padding:10px 14px}.dalmuti-topbar{margin-bottom:8px}.dalmuti-topbar h1{font-size:23px;margin:0}
        .room-shell{grid-template-columns:minmax(0,1fr) 300px;gap:10px}.panel{padding:12px;border-radius:18px}.game-panel{min-height:calc(100vh - 92px);display:flex;flex-direction:column}
        .room-head{display:none!important}.message-bar{margin:0 0 8px;padding:8px 10px;font-size:13px}.table-wrap{height:calc(100vh - 300px);min-height:540px;max-height:620px;margin-top:6px;flex:1}
        .hand-header{margin-top:8px}.hand-header h3{font-size:17px;margin:0}.hand-header .muted{display:none}.hand-area{min-height:142px;padding:10px;margin:6px 0;gap:8px}.hand-stack{width:74px}.hand-stack img{width:74px;border-radius:8px}
        .selected-summary{font-size:13px;padding:6px 10px}.action-row .btn{padding:8px 11px}.player-box{width:116px;min-height:68px;padding:7px;border-radius:14px;position:absolute}.player-role{font-size:11px}.player-name{font-size:13px}.player-meta{font-size:11px}
        .seat-bottom{bottom:6px!important}.seat-top-0,.seat-top-1,.seat-top-2{top:6px!important}.seat-left-0,.seat-left-1,.seat-left-2{left:8px!important}.seat-right-0,.seat-right-1,.seat-right-2{right:8px!important}
        .seat-top-0{left:50%!important;transform:translateX(-50%)!important}.seat-top-1{left:30%!important;transform:translateX(-50%)!important}.seat-top-2{left:70%!important;transform:translateX(-50%)!important}
        .center-pile{width:720px!important;max-width:72%!important;height:360px!important;min-height:360px!important;padding:0!important;overflow:visible!important;text-align:left!important}.side-panel{gap:9px;max-height:calc(100vh - 92px);overflow:auto}.side-panel>section:first-child{display:none}.chat-list{height:200px}
      }
      .player-box.submitted{border-color:#7ee2a8!important;box-shadow:0 0 0 2px rgba(126,226,168,.55),0 12px 24px rgba(0,0,0,.28)!important}.player-box.passed{opacity:.8!important;border-color:#8792a7!important;background:rgba(35,39,51,.92)!important}.player-box.forfeited{opacity:.45!important;filter:grayscale(.9)}
      .badge{display:inline-block;margin-top:3px;padding:2px 7px;border-radius:999px;font-size:10px;font-weight:900}.badge.submit{background:rgba(126,226,168,.16);border:1px solid rgba(126,226,168,.75);color:#9ff0bd}.badge.pass{background:rgba(135,146,167,.16);border:1px solid rgba(135,146,167,.75);color:#d2d8e4}.badge.turn{background:rgba(243,210,129,.16);border:1px solid rgba(243,210,129,.75);color:#f3d281}.badge.ai{background:rgba(111,179,255,.16);border:1px solid rgba(111,179,255,.75);color:#9fcaff}
      .kick-btn{position:absolute;right:5px;top:5px;border:0;border-radius:999px;background:rgba(215,101,101,.92);color:#fff;font-size:10px;font-weight:900;padding:3px 6px;cursor:pointer;z-index:3}
      .pile-board{position:relative;width:100%;height:100%}.pile-empty{height:100%;display:flex;align-items:center;justify-content:center;color:#aeb5c3;font-weight:900;font-size:18px}.prev-pile{position:absolute;left:14px;top:14px;width:160px;min-height:158px;border:1px solid rgba(255,255,255,.09);border-radius:14px;background:rgba(0,0,0,.24);padding:10px;display:flex;flex-direction:column;align-items:center}.prev-pile-title{font-size:12px;font-weight:900;color:#aeb5c3;margin-bottom:8px}.prev-pile img{width:82px;border-radius:10px}.cur-pile{position:absolute;left:205px;right:18px;top:20px;bottom:18px;display:flex;flex-direction:column;align-items:center;justify-content:center}.cur-pile-title{font-size:14px;font-weight:900;color:#f3d281;margin-bottom:12px}.cur-cards{display:flex;align-items:center;justify-content:center}.cur-cards img{width:132px;object-fit:cover;border-radius:12px;box-shadow:0 12px 28px rgba(0,0,0,.42);margin-left:-38px}.cur-cards img:first-child{margin-left:0}
      .side-box{margin-top:8px;border:1px solid rgba(243,210,129,.28);background:rgba(13,19,32,.72);border-radius:16px;padding:10px}.side-title{font-weight:900;color:#f3d281;margin-bottom:7px}.side-btns{display:flex;gap:6px;flex-wrap:wrap}.side-btns .btn{padding:6px 8px;font-size:12px}.chip{display:inline-block;font-size:11px;padding:4px 7px;border-radius:999px;border:1px solid rgba(174,181,195,.28);background:rgba(255,255,255,.045);margin:2px}.score-row.compact{font-size:12px;padding:4px 0}.room-setting-grid{display:grid;grid-template-columns:1fr;gap:6px}.room-setting-grid .input{height:32px;font-size:12px}
      .game-modal{position:fixed;inset:0;z-index:180;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.62);padding:24px}.game-modal.show{display:flex}.modal-card{width:min(760px,96vw);max-height:86vh;overflow:auto;background:#121827;border:1px solid rgba(243,210,129,.4);border-radius:24px;padding:22px;box-shadow:0 24px 80px rgba(0,0,0,.58);color:#f4f1e8}.modal-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px}.modal-head h2{margin:0;color:#f3d281}.modal-table{display:grid;gap:7px}.modal-row{display:grid;grid-template-columns:54px minmax(0,1fr) 74px 82px;gap:8px;align-items:center;padding:9px;border-radius:13px;background:rgba(255,255,255,.055);font-size:14px}.modal-row.header{background:transparent;color:#aeb5c3;font-size:12px;font-weight:900}.modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}.rebellion-card{text-align:center}.rebellion-card img{width:180px;border-radius:18px;box-shadow:0 18px 55px rgba(0,0,0,.6);margin-bottom:16px}.rebellion-card h2{color:#f3d281;margin:4px 0 8px}.rebellion-card p{font-size:18px;font-weight:900;margin:6px 0}.help-section{border-top:1px solid rgba(255,255,255,.09);padding-top:12px;margin-top:12px;line-height:1.55;color:#d8deea;font-size:14px}.help-section strong{color:#f3d281}
      #tributePanel{position:fixed;right:326px;bottom:12px;z-index:95;display:none;width:260px;padding:10px;border-radius:18px;border:1px solid rgba(243,210,129,.45);background:rgba(13,19,32,.96);box-shadow:0 16px 42px rgba(0,0,0,.42);color:#f4f1e8}.tribute-title{font-weight:900;color:#f3d281}.tribute-line{font-size:12px;color:#aeb5c3;margin:6px 0}.tribute-cards{display:flex;gap:7px;flex-wrap:wrap}.tribute-cards img{width:40px;border-radius:7px}.tribute-fly{position:fixed;z-index:220;left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:none;animation:tributeFly var(--tribute-ms,3000ms) ease-in-out forwards}.tribute-fly img{width:96px;border-radius:12px;box-shadow:0 18px 50px rgba(0,0,0,.55)}@keyframes tributeFly{0%{opacity:0;transform:translate(-50%,-35%) scale(.7)}15%{opacity:1}70%{opacity:1;transform:translate(-50%,-55%) scale(1.15)}100%{opacity:0;transform:translate(-50%,-75%) scale(.8)}}
    `;
    document.head.appendChild(style);
  }

  function ensureModals() {
    if (!$('gameModal')) {
      const modal = document.createElement("div");
      modal.id = "gameModal";
      modal.className = "game-modal";
      modal.innerHTML = '<div id="gameModalCard" class="modal-card"></div>';
      document.body.appendChild(modal);
    }
    if (!$('rebellionModal')) {
      const modal = document.createElement("div");
      modal.id = "rebellionModal";
      modal.className = "game-modal";
      modal.innerHTML = '<div id="rebellionModalCard" class="modal-card rebellion-card"></div>';
      document.body.appendChild(modal);
    }
    if (!$('tributePanel')) {
      const panel = document.createElement("div");
      panel.id = "tributePanel";
      document.body.appendChild(panel);
    }
  }

  function setView(name) {
    E.lobbyView?.classList.toggle("show", name === "lobby");
    E.roomView?.classList.toggle("show", name === "room");
    E.leaveRoomBtn?.classList.toggle("hidden", name !== "room");
  }

  function renderRankPreview() {
    if (!E.rankPreview) return;
    E.rankPreview.innerHTML = RANKS.map(r => `<span class="rank-chip">${r.code}. ${esc(r.name)}</span>`).join("");
  }

  async function loadRooms() {
    if (!E.roomList) return;
    const snap = await roomCol().orderBy("updatedAt", "desc").limit(30).get().catch(err => {
      console.error(err);
      toast("방 목록을 불러오지 못했습니다.");
      return null;
    });
    if (!snap) return;
    const docs = snap.docs.filter(d => !d.data().closed && d.data().status !== "closed");
    E.roomList.innerHTML = docs.length ? docs.map(d => {
      const r = d.data();
      const status = ({ waiting: "대기 중", playing: "진행 중", tributeReturn: "상납 반환", betweenRounds: "라운드 종료", finished: "게임 종료" })[r.status] || r.status || "-";
      return `<div class="room-item"><div><strong>${esc(r.title || "사바나 달무티")}</strong><div class="room-meta">${status} · 플레이어 ${r.playerCount || 0}/${MAX_PLAYERS} · 관전자 ${r.spectatorCount || 0} · ${r.totalRounds ? `${r.totalRounds}판` : "무제한"}</div></div><button class="btn primary" type="button" onclick="Dalmuti.joinRoom('${d.id}')">입장</button></div>`;
    }).join("") : `<div class="muted">생성된 방이 없습니다.</div>`;
  }

  function renderEverything() {
    if (!S.room) return;
    setView("room");
    renderHeader();
    renderPlayers();
    renderPile();
    renderHand();
    renderControls();
    renderScores();
    renderChat();
    renderSide();
    renderTribute();
    maybeRebellionModal();
    maybeStartModal();
    maybeResultModal();
    maybeAiAction();
  }

  function renderHeader() {
    const room = S.room;
    const statusText = ({ waiting: "대기 중", playing: `${room.round || 1}라운드`, tributeReturn: "상납 반환", betweenRounds: "라운드 종료", finished: "게임 종료" })[room.status] || room.status || "-";
    if (E.roomStateText) E.roomStateText.textContent = statusText;
    if (E.roomTitle) E.roomTitle.textContent = room.title || "사바나 달무티";
    const turnName = room.currentTurnUid ? (playersMap(room)[room.currentTurnUid]?.nickname || "-") : "-";
    if (E.turnBadge) E.turnBadge.textContent = room.status === "playing" ? `차례: ${turnName}` : statusText;
    if (E.messageBar) {
      if (room.status === "waiting") E.messageBar.textContent = "참가자는 준비를 눌러야 게임을 시작할 수 있습니다.";
      else if (room.status === "tributeReturn") E.messageBar.textContent = "상납받은 사람이 같은 장수만큼 카드를 돌려줘야 합니다.";
      else if (room.status === "playing") E.messageBar.textContent = room.currentTurnUid === S.user ? "내 차례입니다." : `${turnName}님의 차례입니다.`;
      else if (room.status === "betweenRounds") E.messageBar.textContent = "라운드가 종료되었습니다.";
      else E.messageBar.textContent = "게임이 종료되었습니다.";
    }
  }

  function positions() {
    const players = allPlayers();
    const myIndex = Math.max(0, players.findIndex(p => p.uid === S.user));
    const rotated = myIndex >= 0 ? players.slice(myIndex).concat(players.slice(0, myIndex)) : players;
    const mine = rotated[0];
    const others = rotated.slice(1);
    let left = [], top = [], right = [];
    if (others.length === 1) top = others;
    else if (others.length === 2) { left = [others[0]]; right = [others[1]]; }
    else if (others.length === 3) { left = [others[0]]; top = [others[1]]; right = [others[2]]; }
    else if (others.length === 4) { left = [others[0]]; top = [others[1], others[2]]; right = [others[3]]; }
    else if (others.length === 5) { left = [others[0], others[1]]; top = [others[2], others[3]]; right = [others[4]]; }
    else if (others.length === 6) { left = [others[0], others[1]]; top = [others[2], others[3]]; right = [others[4], others[5]]; }
    else { left = [others[0], others[1]]; top = [others[2], others[3], others[4]]; right = [others[5], others[6]]; }
    return [
      ...(mine ? [{ p: mine, cls: "seat-bottom" }] : []),
      ...left.map((p, i) => ({ p, cls: `seat-left-${left.length === 1 ? 0 : i + 1}` })),
      ...top.map((p, i) => ({ p, cls: `seat-top-${top.length === 1 ? 0 : i}` })),
      ...right.map((p, i) => ({ p, cls: `seat-right-${right.length === 1 ? 0 : i + 1}` }))
    ];
  }

  function renderPlayers() {
    if (!E.playersArea) return;
    E.playersArea.innerHTML = positions().map(({ p, cls }) => {
      const submitted = S.room?.currentSet?.uid === p.uid;
      const state = p.finished ? `${p.finishedRank || ""}등 완료` : p.passed ? "패스" : `${Number(p.cardCount || 0)}장`;
      let badge = p.isAI ? `<div class="badge ai">AI</div>` : "";
      if (submitted) badge += `<div class="badge submit">제출</div>`;
      else if (p.passed) badge += `<div class="badge pass">패스</div>`;
      else if (S.room?.currentTurnUid === p.uid) badge += `<div class="badge turn">차례</div>`;
      const kick = isHost() && p.uid !== S.user ? `<button class="kick-btn" type="button" onclick="Dalmuti.kick('${p.uid}')">강퇴</button>` : "";
      return `<div class="player-box ${cls} ${p.uid === S.user ? "me" : ""} ${S.room?.currentTurnUid === p.uid ? "turn" : ""} ${p.passed ? "passed" : ""} ${p.finished ? "finished" : ""} ${submitted ? "submitted" : ""} ${p.forfeited ? "forfeited" : ""}">${kick}<div class="player-role">${esc(p.role || "참가자")}</div><div class="player-name">${esc(p.nickname || p.uid)}</div><div class="player-meta">${state}${p.isReady ? " · 준비" : ""}</div>${badge}</div>`;
    }).join("");
  }

  function renderPile() {
    if (!E.centerPile) return;
    if (S.room?.status === "tributeReturn") {
      const pairs = S.room.tribute?.pairs || [];
      E.centerPile.innerHTML = `<div class="pile-title">상납 반환</div><div class="muted">상납 받은 사람이 돌려줄 카드를 선택합니다.</div><div class="muted">${pairs.map(p => `${esc(p.fromNickname)} → ${esc(p.toNickname)} ${p.count}장 ${p.returned ? "완료" : "대기"}`).join("<br>")}</div>`;
      return;
    }
    const prev = S.room?.previousSet;
    const cur = S.room?.currentSet;
    if (!prev && !cur) {
      E.centerPile.innerHTML = `<div class="pile-board"><div class="pile-empty">새 판</div></div>`;
      return;
    }
    const prevCard = prev?.cards?.[0] ? `<img src="${cardImg(prev.cards[0].rank)}" alt="직전 카드">` : `<span class="muted">없음</span>`;
    const curCards = cur ? (cur.cards || []).map(c => `<img src="${cardImg(c.rank)}" alt="${esc(c.name)}">`).join("") : `<span class="muted">제출 대기</span>`;
    E.centerPile.innerHTML = `<div class="pile-board"><div class="prev-pile"><div class="prev-pile-title">직전 카드</div>${prevCard}</div><div class="cur-pile"><div class="cur-pile-title">${cur ? `현재 ${rankInfo(cur.effectiveRank).name} ${cur.count}장` : "현재 없음"}</div><div class="cur-cards">${curCards}</div></div></div>`;
  }

  function currentTributePairForMe() {
    return (S.room?.tribute?.pairs || []).find(p => p.toUid === S.user && !p.returned) || null;
  }

  function selectableGroup(group) {
    if (S.room?.status === "tributeReturn") return !!currentTributePairForMe();
    if (S.room?.status !== "playing") return false;
    if (S.room.currentTurnUid !== S.user) return false;
    if (!S.room.currentSet) return true;
    if (Number(group.rank) === 13) return false;
    const need = Number(S.room.currentSet.count || 1);
    const jokerCount = S.hand.filter(c => c.joker || Number(c.rank) === 13).length;
    return group.items.length + jokerCount >= need && Number(group.rank) < Number(S.room.currentSet.effectiveRank);
  }

  function renderHand() {
    if (!E.handArea) return;
    const mine = me();
    if (!mine || mine.type !== "player") {
      E.handArea.innerHTML = `<div class="muted">관전자는 손패가 없습니다.</div>`;
      if (E.selectedSummary) E.selectedSummary.textContent = "선택 없음";
      return;
    }
    const groups = groupHand(S.hand);
    E.handArea.innerHTML = groups.length ? groups.map(g => {
      const selected = S.selected.get(g.rank)?.length || 0;
      return `<div class="hand-stack${selected ? " selected" : ""}${selectableGroup(g) ? "" : " disabled"}" onclick="Dalmuti.toggleRank(${g.rank})">${selected ? `<span class="stack-selected">${selected}</span>` : ""}<img src="${cardImg(g.rank)}"><span class="stack-count">x${g.items.length}</span></div>`;
    }).join("") : `<div class="muted">손패가 없습니다.</div>`;

    const cards = selectedCards();
    if (S.room?.status === "tributeReturn") {
      const pair = currentTributePairForMe();
      if (E.selectedSummary) E.selectedSummary.textContent = pair ? `${cards.length}/${pair.count}장 반환 선택` : "상납 반환 대기";
      return;
    }
    const combo = canPlayCombo(cards);
    if (E.selectedSummary) E.selectedSummary.textContent = cards.length ? (combo.ok ? `${rankInfo(combo.effectiveRank).name} ${combo.count}장` : combo.reason) : "선택 없음";
  }

  function renderControls() {
    const mine = me();
    const waiting = S.room?.status === "waiting";
    const between = S.room?.status === "betweenRounds" || S.room?.status === "finished";
    const myTurn = S.room?.status === "playing" && S.room.currentTurnUid === S.user && mine?.type === "player" && !mine.finished && !mine.forfeited;
    const tributeTurn = S.room?.status === "tributeReturn" && !!currentTributePairForMe();

    E.lobbyControls?.classList.toggle("hidden", !waiting);
    E.betweenControls?.classList.toggle("hidden", !between);
    E.playControls?.classList.toggle("hidden", !(myTurn || tributeTurn));
    E.passBtn?.classList.toggle("hidden", !myTurn);

    if (E.playBtn) E.playBtn.textContent = tributeTurn ? "반환 카드 주기" : "선택 카드 내기";
    E.readyBtn?.classList.toggle("hidden", !(waiting && mine?.type === "player" && !mine.isAI));
    E.watchBtn?.classList.toggle("hidden", !(waiting && mine?.type === "player" && !mine.isAI));
    E.joinAsPlayerBtn?.classList.toggle("hidden", !(waiting && mine?.type === "spectator"));
    E.startBtn?.classList.toggle("hidden", !(waiting && isHost()));
    E.nextRoundBtn?.classList.toggle("hidden", !(S.room?.status === "betweenRounds" && isHost()));
    E.resetGameBtn?.classList.add("hidden");
    if (E.readyBtn) E.readyBtn.textContent = mine?.isReady ? "준비 취소" : "준비";
  }

  function renderScores() {
    if (!E.scoreList) return;
    const players = allPlayers().slice().sort((a, b) => (b.score || 0) - (a.score || 0) || (a.seatOrder ?? 999) - (b.seatOrder ?? 999));
    E.scoreList.innerHTML = players.length ? players.map(p => `<div class="score-row"><span>${esc(p.nickname || p.uid)}</span><strong>${p.score || 0}</strong></div>`).join("") : `<div class="muted">참가자가 없습니다.</div>`;
  }

  function renderChat() {
    if (!E.chatList) return;
    const list = (S.room?.chatPreview || []).slice(-CHAT_LIMIT);
    E.chatList.innerHTML = list.length ? list.map(m => m.type === "system" ? `<div class="chat-msg system">${esc(m.text)}</div>` : `<div class="chat-msg"><span class="chat-name">${esc(m.nickname || "-")}</span> ${esc(m.text || "")}</div>`).join("") : `<div class="muted">채팅이 없습니다.</div>`;
    E.chatList.scrollTop = E.chatList.scrollHeight;
  }

  function sideBox(id, anchor) {
    let box = $(id);
    if (!box) {
      box = document.createElement("section");
      box.id = id;
      box.className = "side-box";
      (anchor || document.querySelector(".side-panel")).insertAdjacentElement(anchor ? "afterend" : "afterbegin", box);
    }
    return box;
  }

  function renderSide() {
    const side = document.querySelector(".side-panel");
    if (!side || !S.room) return;
    const turn = S.room.currentTurnUid ? (playersMap()[S.room.currentTurnUid]?.nickname || "-") : "-";
    const status = ({ waiting: "대기 중", playing: `${S.room.round || 1}라운드`, tributeReturn: "상납 반환", betweenRounds: "라운드 종료", finished: "게임 종료" })[S.room.status] || S.room.status;
    sideBox("roomInfo").innerHTML = `<div class="side-title">방 정보</div><div class="score-row compact"><span>방제</span><strong>${esc(S.room.title || "-")}</strong></div><div class="score-row compact"><span>상태</span><strong>${esc(status)}</strong></div><div class="score-row compact"><span>차례</span><strong>${esc(turn)}</strong></div>`;

    const settings = sideBox("roomSettings", $("roomInfo"));
    settings.style.display = isHost() && S.room.status === "waiting" ? "block" : "none";
    if (settings.style.display !== "none") {
      settings.innerHTML = `<div class="side-title">방 설정</div><div class="room-setting-grid"><input id="setTitle" class="input" maxlength="24" value="${esc(S.room.title || "")}"><select id="setRounds" class="input"><option value="3">3판</option><option value="5">5판</option><option value="10">10판</option><option value="0">무제한</option></select></div><div class="side-btns" style="margin-top:8px"><button class="btn primary small" onclick="Dalmuti.saveSettings()">저장</button><button class="btn ghost small" onclick="Dalmuti.toggleSpectatorChat()">관전자 채팅 ${S.room.spectatorChatEnabled === false ? "차단" : "허용"}</button></div>`;
      const rounds = $("setRounds");
      if (rounds) rounds.value = String(S.room.totalRounds || 0);
    }

    const spectatorPanel = sideBox("spectatorPanel", E.scoreList?.parentElement);
    const specList = spectators();
    spectatorPanel.innerHTML = `<div class="side-title">관전자</div>${specList.length ? specList.map(p => `<span class="chip">${esc(p.nickname)}</span>`).join(" ") : `<div class="muted">관전자가 없습니다.</div>`}`;

    const admin = sideBox("adminPanel", spectatorPanel);
    const aiBtn = isHost() && S.room.status === "waiting" ? `<button class="btn ghost small" onclick="Dalmuti.addAI()">AI 추가</button>` : "";
    const forceBtn = isHost() && S.room.status === "betweenRounds" ? `<button class="btn ghost small" onclick="Dalmuti.forceRebellion()">민란 강제</button>` : "";
    const stopBtn = isHost() && S.room.status !== "waiting" ? `<button class="btn danger small" onclick="Dalmuti.stopGame()">게임 중지</button>` : "";
    const deleteBtn = canAdmin() ? `<button class="btn danger small" onclick="Dalmuti.deleteRoom()">방 삭제</button>` : "";
    admin.innerHTML = `<div class="side-title">관리</div><div class="side-btns">${aiBtn}${forceBtn}${stopBtn}${deleteBtn}<button class="btn ghost small" onclick="Dalmuti.showHelp()">게임 방법</button></div>`;
  }

  function renderTribute() {
    const panel = $("tributePanel");
    if (!panel) return;
    if (!S.room || S.room.status !== "tributeReturn" || !S.room.tribute) {
      panel.style.display = "none";
      return;
    }
    const incoming = currentTributePairForMe();
    const outgoing = (S.room.tribute.pairs || []).filter(p => p.fromUid === S.user);
    if (!incoming && !outgoing.length) {
      panel.style.display = "none";
      return;
    }
    panel.innerHTML = outgoing.map(p => `<div><div class="tribute-title">내가 상납한 카드</div><div class="tribute-line">${esc(p.toNickname)}님에게 ${p.count}장 상납</div><div class="tribute-cards">${(p.cards || []).map(c => `<img src="${cardImg(c.rank)}">`).join("")}</div></div>`).join("") + (incoming ? `<div><div class="tribute-title">상납받은 카드</div><div class="tribute-line">${esc(incoming.fromNickname)}님에게 ${incoming.count}장을 돌려줘야 합니다.</div></div>` : "");
    panel.style.display = "block";
  }

  function showTributeAnimation(cards = []) {
    const card = cards[0];
    if (!card) return;
    const fly = document.createElement("div");
    fly.className = "tribute-fly";
    fly.style.setProperty("--tribute-ms", `${TRIBUTE_ANIM_MS}ms`);
    fly.innerHTML = `<img src="${cardImg(card.rank)}" alt="상납 카드">`;
    document.body.appendChild(fly);
    setTimeout(() => fly.remove(), TRIBUTE_ANIM_MS + 250);
  }

  async function appendChat(msg) {
    if (!S.roomId || !S.room) return;
    const chat = (S.room.chatPreview || []).slice(-CHAT_LIMIT + 1);
    chat.push({ ...msg, uid: msg.uid || "system", nickname: msg.nickname || "", text: msg.text || "", createdAt: Date.now() });
    await roomRef().set({ chatPreview: chat, updatedAt: serverNow() }, { merge: true });
  }

  async function addSystem(text) {
    await appendChat({ type: "system", text });
  }

  async function createRoom() {
    const title = (E.roomTitleInput?.value || "").trim() || "사바나 달무티";
    const rawRounds = Number(E.totalRoundsSelect?.value || 5);
    const room = roomCol().doc();
    const player = basePlayer(S.user, S.user, 0, false);
    player.isReady = false;
    await room.set({
      title,
      hostUid: S.user,
      hostNickname: S.user,
      status: "waiting",
      round: 0,
      totalRounds: rawRounds === 0 ? null : rawRounds,
      turnLimit: Number(E.turnLimitSelect?.value || 15),
      players: { [S.user]: player },
      spectators: {},
      playerCount: 1,
      spectatorCount: 0,
      currentTurnUid: null,
      currentSet: null,
      previousSet: null,
      finishOrder: [],
      lastRoundResult: null,
      tribute: null,
      chatPreview: [],
      spectatorChatEnabled: true,
      kickNotice: null,
      rebellionNotice: null,
      updatedAt: serverNow(),
      createdAt: serverNow()
    });
    await room.collection("hands").doc(S.user).set({ hand: [] });
    enterRoom(room.id);
  }

  function basePlayer(uid, nickname, seatOrder, isAI) {
    return {
      uid,
      nickname,
      type: "player",
      isReady: !!isAI,
      isAI: !!isAI,
      seatOrder,
      role: null,
      score: 0,
      lastRoundScore: 0,
      lastRoundRank: null,
      cardCount: 0,
      passed: false,
      finished: false,
      finishedRank: null,
      forfeited: false,
      removedFromRoom: false
    };
  }

  function baseSpectator(uid, nickname) {
    return { uid, nickname, type: "spectator", isAI: false, removedFromRoom: false };
  }

  async function joinRoom(roomId) {
    const snap = await roomRef(roomId).get();
    if (!snap.exists) return toast("방을 찾을 수 없습니다.");
    const room = snap.data();
    const players = playersMap(room);
    const specs = spectatorsMap(room);
    if (!players[S.user] && !specs[S.user]) {
      if (room.status === "waiting" && countMap(players) < MAX_PLAYERS) {
        players[S.user] = basePlayer(S.user, S.user, countMap(players), false);
        await roomRef(roomId).set({ players, playerCount: countMap(players), updatedAt: serverNow() }, { merge: true });
        await handRef(S.user, roomId).set({ hand: [] }, { merge: true });
      } else {
        specs[S.user] = baseSpectator(S.user, S.user);
        await roomRef(roomId).set({ spectators: specs, spectatorCount: countMap(specs), updatedAt: serverNow() }, { merge: true });
      }
    }
    enterRoom(roomId);
  }

  function enterRoom(roomId) {
    leaveSubscriptions();
    S.roomId = roomId;
    localStorage.setItem("dalmutiCurrentRoomId", roomId);
    setView("room");
    S.roomUnsub = roomRef(roomId).onSnapshot(snap => {
      if (!snap.exists) {
        toast("방이 삭제되었습니다.");
        leaveLocal();
        return;
      }
      S.room = snap.data();
      if (S.room.kickNotice?.uid === S.user) {
        alert("방장에 의해 강퇴되었습니다.");
        leaveLocal();
        return;
      }
      renderEverything();
      ensureMyHandSubscription();
    }, err => {
      console.error(err);
      toast("방 정보를 읽지 못했습니다.");
    });
  }

  function ensureMyHandSubscription() {
    const mine = me();
    const shouldHaveHand = !!(S.roomId && mine?.type === "player");
    if (!shouldHaveHand) {
      if (S.handUnsub) S.handUnsub();
      S.handUnsub = null;
      S.hand = [];
      renderHand();
      return;
    }
    if (S.handUnsub && ensureMyHandSubscription.key === `${S.roomId}:${S.user}`) return;
    if (S.handUnsub) S.handUnsub();
    ensureMyHandSubscription.key = `${S.roomId}:${S.user}`;
    S.handUnsub = handRef().onSnapshot(snap => {
      S.hand = snap.exists ? sortHand(snap.data().hand || []) : [];
      renderHand();
      renderTribute();
    }, err => console.error(err));
  }

  function leaveSubscriptions() {
    if (S.roomUnsub) S.roomUnsub();
    if (S.handUnsub) S.handUnsub();
    S.roomUnsub = null;
    S.handUnsub = null;
  }

  function leaveLocal() {
    leaveSubscriptions();
    S.room = null;
    S.hand = [];
    S.roomId = "";
    S.selected.clear();
    localStorage.removeItem("dalmutiCurrentRoomId");
    setView("lobby");
    loadRooms();
  }

  async function leaveRoom() {
    if (!S.roomId || !S.room) return leaveLocal();
    const room = S.room;
    if (room.status !== "waiting") {
      toast("게임 중에는 나가기만 처리합니다. 재참여는 제한될 수 있습니다.");
      leaveLocal();
      return;
    }
    const players = playersMap(room);
    const specs = spectatorsMap(room);
    if (players[S.user]) {
      delete players[S.user];
      await handRef().delete().catch(() => null);
    }
    if (specs[S.user]) delete specs[S.user];
    await roomRef().set({ players, spectators: specs, playerCount: countMap(players), spectatorCount: countMap(specs), updatedAt: serverNow() }, { merge: true });
    leaveLocal();
  }

  async function toggleReady() {
    const mine = me();
    if (!S.room || mine?.type !== "player" || mine.isAI || S.room.status !== "waiting") return;
    await roomRef().set({ [`players.${S.user}.isReady`]: !mine.isReady, updatedAt: serverNow() }, { merge: true });
  }

  async function becomeSpectator() {
    const room = S.room;
    if (!room || room.status !== "waiting") return;
    const players = playersMap(room);
    const specs = spectatorsMap(room);
    if (!players[S.user]) return;
    delete players[S.user];
    specs[S.user] = baseSpectator(S.user, S.user);
    await handRef().delete().catch(() => null);
    await roomRef().set({ players, spectators: specs, playerCount: countMap(players), spectatorCount: countMap(specs), updatedAt: serverNow() }, { merge: true });
  }

  async function becomePlayer() {
    const room = S.room;
    if (!room || room.status !== "waiting") return toast("대기 중에만 참가할 수 있습니다.");
    const players = playersMap(room);
    const specs = spectatorsMap(room);
    if (players[S.user]) return;
    if (countMap(players) >= MAX_PLAYERS) return toast("최대 8명까지 참가할 수 있습니다.");
    delete specs[S.user];
    players[S.user] = basePlayer(S.user, S.user, countMap(players), false);
    await roomRef().set({ players, spectators: specs, playerCount: countMap(players), spectatorCount: countMap(specs), updatedAt: serverNow() }, { merge: true });
    await handRef().set({ hand: [] }, { merge: true });
  }

  async function addAI() {
    if (!isHost() || S.room?.status !== "waiting") return;
    const players = playersMap();
    if (countMap(players) >= MAX_PLAYERS) return toast("최대 8명까지 참가할 수 있습니다.");
    const n = Object.values(players).filter(p => p.isAI).length + 1;
    const uid = `ai_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    players[uid] = basePlayer(uid, `AI ${n}`, countMap(players), true);
    await roomRef().set({ players, playerCount: countMap(players), updatedAt: serverNow() }, { merge: true });
    await handRef(uid).set({ hand: [] });
  }

  function hasTwoHong(hand = []) {
    return hand.filter(c => c.joker || Number(c.rank) === 13).length >= 2;
  }

  function forceHongForRebellion(hands, uid) {
    let jokers = [];
    Object.keys(hands).forEach(owner => {
      const keep = [];
      hands[owner].forEach(card => {
        if ((card.joker || Number(card.rank) === 13) && jokers.length < 2) jokers.push(card);
        else keep.push(card);
      });
      hands[owner] = keep;
    });
    while (jokers.length < 2) jokers.push({ id: `j-force-${jokers.length}-${Math.random().toString(36).slice(2, 8)}`, rank: 13, name: "홍길동", joker: true });
    const takeOut = sortHand(hands[uid] || []).filter(c => !(c.joker || Number(c.rank) === 13)).slice(-2);
    const takeIds = new Set(takeOut.map(c => c.id));
    hands[uid] = (hands[uid] || []).filter(c => !takeIds.has(c.id)).concat(jokers.slice(0, 2));
    const donors = Object.keys(hands).filter(k => k !== uid);
    takeOut.forEach((card, i) => {
      const donor = donors[i % donors.length];
      if (donor) hands[donor].push(card);
    });
    Object.keys(hands).forEach(owner => { hands[owner] = sortHand(hands[owner]); });
  }

  function bestTributeCards(hand, count) {
    return sortHand(hand).filter(c => !(c.joker || Number(c.rank) === 13)).slice(0, count);
  }

  function makeTributePairs(players, hands) {
    if (players.length < 3) return [];
    const specs = players.length === 3
      ? [{ from: players[2], to: players[0], count: 1 }]
      : [{ from: players[players.length - 1], to: players[0], count: 2 }, { from: players[players.length - 2], to: players[1], count: 1 }];
    return specs.map((spec, i) => {
      const cards = bestTributeCards(hands[spec.from.uid] || [], spec.count);
      const ids = new Set(cards.map(c => c.id));
      hands[spec.from.uid] = sortHand((hands[spec.from.uid] || []).filter(c => !ids.has(c.id)));
      hands[spec.to.uid] = sortHand((hands[spec.to.uid] || []).concat(cards));
      return {
        id: `tribute-${i}`,
        fromUid: spec.from.uid,
        fromNickname: spec.from.nickname,
        toUid: spec.to.uid,
        toNickname: spec.to.nickname,
        count: cards.length,
        cards,
        returned: cards.length === 0,
        returnedCards: []
      };
    }).filter(pair => pair.count > 0);
  }

  async function startGame() {
    if (!isHost() || S.room?.status !== "waiting") return;
    const players = allPlayers();
    if (players.length < 2) return toast("2명 이상 필요합니다.");
    if (!players.every(p => p.isReady || p.isAI)) return toast("아직 준비하지 않은 인원이 있습니다.");
    await startRound(1, true, false);
  }

  async function startRound(round, resetScores, forceRebellion) {
    let players = allPlayers().slice().sort((a, b) => (a.lastRoundRank ?? a.seatOrder ?? 999) - (b.lastRoundRank ?? b.seatOrder ?? 999));
    const deck = makeDeck(players.length);
    const hands = Object.fromEntries(players.map(p => [p.uid, []]));
    deck.forEach((card, i) => hands[players[i % players.length].uid].push(card));
    Object.keys(hands).forEach(uid => { hands[uid] = sortHand(hands[uid]); });

    if (forceRebellion && players.length >= 3) forceHongForRebellion(hands, players[players.length - 1].uid);

    const lowUids = players.length === 3 ? [players[1]?.uid, players[2]?.uid] : [players[players.length - 2]?.uid, players[players.length - 1]?.uid];
    const rebellionUid = round > 1 ? lowUids.find(uid => uid && hasTwoHong(hands[uid])) : null;
    const rebellionPlayer = players.find(p => p.uid === rebellionUid);
    if (rebellionUid) players = players.slice().reverse();

    const pairs = round > 1 ? makeTributePairs(players, hands) : [];
    const hasTribute = pairs.some(p => !p.returned);
    const playerMap = {};
    players.forEach((p, i) => {
      playerMap[p.uid] = {
        ...p,
        type: "player",
        seatOrder: i,
        role: roleByIndex(i, players.length),
        score: resetScores ? 0 : (p.score || 0),
        lastRoundScore: 0,
        lastRoundRank: resetScores ? null : p.lastRoundRank,
        cardCount: hands[p.uid].length,
        isReady: !!p.isAI,
        passed: false,
        finished: false,
        finishedRank: null,
        forfeited: false,
        removedFromRoom: false
      };
    });

    const batch = db.batch();
    batch.set(roomRef(), {
      players: playerMap,
      playerCount: countMap(playerMap),
      status: hasTribute ? "tributeReturn" : "playing",
      round,
      currentTurnUid: hasTribute ? null : players[0]?.uid || null,
      currentSet: null,
      previousSet: null,
      finishOrder: [],
      turnOrder: players.map(p => p.uid),
      tribute: hasTribute ? { phase: "return", pairs, reversed: !!rebellionUid, returnStartedAt: ts() } : null,
      rebellionNotice: rebellionUid ? { uid: rebellionUid, nickname: rebellionPlayer?.nickname || "누군가", round, createdAt: ts() } : null,
      updatedAt: serverNow()
    }, { merge: true });
    Object.keys(hands).forEach(uid => batch.set(handRef(uid), { hand: hands[uid] }));
    await batch.commit();
    showTributeAnimation(pairs.flatMap(p => p.cards || []));
    await addSystem(rebellionUid ? `${rebellionPlayer?.nickname || "누군가"}님의 홍길동이 민란을 일으켰습니다.` : (hasTribute ? `${round}라운드 상납 반환을 시작합니다.` : `${round}라운드가 시작되었습니다.`));
  }

  async function nextRound(forceRebellion = false) {
    if (!isHost() || S.room?.status !== "betweenRounds") return;
    await startRound((S.room.round || 0) + 1, false, forceRebellion);
  }

  function toggleRank(rank) {
    const mine = me();
    if (!mine || mine.type !== "player") return;
    const group = groupHand(S.hand).find(g => Number(g.rank) === Number(rank));
    if (!group) return;

    if (S.room?.status === "tributeReturn") {
      const pair = currentTributePairForMe();
      if (!pair) return toast("반환할 차례가 아닙니다.");
      const existing = S.selected.get(group.rank) || [];
      if (existing.length) S.selected.delete(group.rank);
      else {
        const left = Math.max(0, pair.count - selectedCards().length);
        if (left <= 0) return toast(`${pair.count}장만 선택할 수 있습니다.`);
        S.selected.set(group.rank, group.items.slice(0, left));
      }
      renderHand();
      return;
    }

    if (S.room?.status !== "playing" || S.room.currentTurnUid !== S.user) return;
    if (S.room.currentSet) {
      if (!selectableGroup(group)) return toast("낼 수 없는 계급입니다.");
      S.selected.clear();
      const need = Number(S.room.currentSet.count || 1);
      const normal = group.items.filter(c => !(c.joker || Number(c.rank) === 13)).slice(0, need);
      const jokers = S.hand.filter(c => c.joker || Number(c.rank) === 13).slice(0, Math.max(0, need - normal.length));
      S.selected.set(group.rank, normal.concat(jokers));
      renderHand();
      return;
    }

    if (S.selected.has(group.rank)) S.selected.delete(group.rank);
    else if (Number(group.rank) === 13) S.selected.set(group.rank, group.items.slice());
    else {
      const jokers = S.selected.get(13) || [];
      S.selected.clear();
      S.selected.set(group.rank, group.items.slice());
      if (jokers.length) S.selected.set(13, jokers);
    }
    renderHand();
  }

  async function playSelected() {
    if (S.actionBusy) return;
    S.actionBusy = true;
    try {
      if (S.room?.status === "tributeReturn") await returnTribute(S.user, selectedCards(), S.hand);
      else if (S.room?.currentTurnUid === S.user) await applyPlay(S.user, selectedCards(), S.hand);
    } finally {
      S.actionBusy = false;
    }
  }

  async function applyPlay(uid, cards, hand) {
    const room = S.room;
    const player = playersMap(room)[uid];
    if (!room || !player || room.status !== "playing") return;
    const combo = canPlayCombo(cards, room);
    if (!combo.ok) {
      if (uid === S.user) toast(combo.reason);
      return;
    }

    const ids = new Set(cards.map(c => c.id));
    const newHand = sortHand((hand || []).filter(c => !ids.has(c.id)));
    const players = playersMap(room);
    const order = (room.finishOrder || []).slice();
    let finishedRank = players[uid].finishedRank || null;
    const finished = newHand.length === 0;

    if (finished && !players[uid].finished) {
      finishedRank = order.length + 1;
      order.push({ uid, nickname: players[uid].nickname, rank: finishedRank, finishedAt: ts() });
    }

    Object.keys(players).forEach(pid => {
      players[pid] = { ...players[pid], passed: pid === uid ? false : false };
    });
    players[uid] = { ...players[uid], cardCount: newHand.length, finished, finishedRank, passed: false };

    const set = { uid, nickname: player.nickname, effectiveRank: combo.effectiveRank, effectiveName: combo.effectiveName, count: combo.count, cards, createdAt: ts() };
    const activeCount = Object.values(players).filter(p => p && !p.finished && !p.forfeited).length;
    const batch = db.batch();
    batch.set(handRef(uid), { hand: newHand });

    if (activeCount <= 1) {
      const final = order.slice();
      const last = Object.values(players).find(p => p && !p.finished && !p.forfeited);
      if (last) final.push({ uid: last.uid, nickname: last.nickname, rank: final.length + 1, finishedAt: ts() });
      batch.set(roomRef(), {
        players,
        status: (room.totalRounds && room.round >= room.totalRounds) ? "finished" : "betweenRounds",
        currentTurnUid: null,
        previousSet: room.currentSet || null,
        currentSet: null,
        tribute: null,
        finishOrder: final,
        lastRoundResult: { round: room.round, results: final, endedAt: ts() },
        updatedAt: serverNow()
      }, { merge: true });
      if (uid === S.user) S.selected.clear();
      await batch.commit();
      await addSystem((room.totalRounds && room.round >= room.totalRounds) ? "게임이 종료되었습니다." : `${room.round}라운드가 종료되었습니다.`);
      return;
    }

    batch.set(roomRef(), {
      players,
      previousSet: room.currentSet || null,
      currentSet: set,
      currentTurnUid: nextAfter({ ...room, players }, uid),
      finishOrder: order,
      updatedAt: serverNow()
    }, { merge: true });
    if (uid === S.user) S.selected.clear();
    await batch.commit();
  }

  async function passTurn() {
    await passAs(S.user);
  }

  async function passAs(uid) {
    const room = S.room;
    if (!room || room.status !== "playing" || room.currentTurnUid !== uid || !room.currentSet) return;
    const players = playersMap(room);
    if (!players[uid]) return;
    players[uid] = { ...players[uid], passed: true };

    const currentOwner = room.currentSet.uid;
    const active = Object.values(players).filter(p => p && !p.finished && !p.forfeited).map(p => p.uid);
    const opponents = active.filter(id => id !== currentOwner);
    const passed = new Set(Object.values(players).filter(p => p && p.passed).map(p => p.uid));
    const everyoneElsePassed = opponents.every(id => passed.has(id));

    if (everyoneElsePassed) {
      Object.keys(players).forEach(pid => { players[pid] = { ...players[pid], passed: false }; });
      const ownerAlive = players[currentOwner] && !players[currentOwner].finished && !players[currentOwner].forfeited;
      await roomRef().set({
        players,
        currentTurnUid: ownerAlive ? currentOwner : nextAfter({ ...room, players }, currentOwner),
        previousSet: room.currentSet,
        currentSet: null,
        updatedAt: serverNow()
      }, { merge: true });
    } else {
      await roomRef().set({
        players,
        currentTurnUid: nextAfter({ ...room, players }, uid),
        updatedAt: serverNow()
      }, { merge: true });
    }
  }

  async function returnTribute(uid, cards, hand) {
    const room = S.room;
    if (!room || room.status !== "tributeReturn") return;
    const pair = (room.tribute?.pairs || []).find(p => p.toUid === uid && !p.returned);
    if (!pair) return;
    if (cards.length !== pair.count) {
      if (uid === S.user) toast(`${pair.count}장을 선택해야 합니다.`);
      return;
    }

    const fromSnap = await handRef(pair.fromUid).get();
    const fromHand = fromSnap.exists ? (fromSnap.data().hand || []) : [];
    const ids = new Set(cards.map(c => c.id));
    const myHand = sortHand((hand || []).filter(c => !ids.has(c.id)));
    const newFrom = sortHand(fromHand.concat(cards));
    const pairs = (room.tribute?.pairs || []).map(p => p.id === pair.id ? { ...p, returned: true, returnedCards: cards } : p);
    const done = pairs.every(p => p.returned);
    const players = playersMap(room);
    if (players[uid]) players[uid] = { ...players[uid], cardCount: myHand.length };
    if (players[pair.fromUid]) players[pair.fromUid] = { ...players[pair.fromUid], cardCount: newFrom.length };

    const batch = db.batch();
    batch.set(handRef(uid), { hand: myHand });
    batch.set(handRef(pair.fromUid), { hand: newFrom });
    batch.set(roomRef(), {
      players,
      tribute: { ...(room.tribute || {}), pairs },
      status: done ? "playing" : "tributeReturn",
      currentTurnUid: done ? allPlayers({ ...room, players })[0]?.uid || null : null,
      updatedAt: serverNow()
    }, { merge: true });
    if (uid === S.user) S.selected.clear();
    await batch.commit();
    showTributeAnimation(cards);
    if (done) await addSystem(`${room.round}라운드가 시작되었습니다.`);
  }

  function chooseAiCards(room, hand) {
    hand = sortHand(hand || []);
    if (!hand.length) return [];
    const cur = room.currentSet;
    if (!cur) {
      const groups = groupHand(hand.filter(c => !(c.joker || Number(c.rank) === 13))).sort((a, b) => b.rank - a.rank);
      if (groups.length) return groups[0].items.slice(0, 1);
      return hand.slice(0, 1);
    }
    const need = Number(cur.count || 1);
    const jokers = hand.filter(c => c.joker || Number(c.rank) === 13);
    const groups = groupHand(hand.filter(c => !(c.joker || Number(c.rank) === 13))).sort((a, b) => b.rank - a.rank);
    for (const group of groups) {
      if (group.rank < Number(cur.effectiveRank) && group.items.length + jokers.length >= need) {
        const normal = group.items.slice(0, Math.min(group.items.length, need));
        const extra = jokers.slice(0, Math.max(0, need - normal.length));
        return normal.concat(extra);
      }
    }
    return [];
  }

  function chooseAiReturnCards(hand, count) {
    return sortHand(hand || []).slice(-count);
  }

  function maybeAiAction() {
    const room = S.room;
    if (!room || !isHost(room)) return;

    if (room.status === "tributeReturn") {
      const pair = (room.tribute?.pairs || []).find(p => !p.returned && playersMap(room)[p.toUid]?.isAI);
      if (!pair) return;
      const key = `${S.roomId}:tribute:${room.round}:${pair.id}`;
      if (S.aiLocks.has(key)) return;
      S.aiLocks.add(key);
      setTimeout(async () => {
        const latest = await roomRef().get().catch(() => null);
        if (!latest?.exists) return;
        const latestRoom = latest.data();
        const latestPair = (latestRoom.tribute?.pairs || []).find(p => p.id === pair.id && !p.returned);
        if (!latestPair) return;
        const snap = await handRef(pair.toUid).get();
        const hand = snap.exists ? (snap.data().hand || []) : [];
        const cards = chooseAiReturnCards(hand, pair.count);
        const oldRoom = S.room;
        const oldHand = S.hand;
        S.room = latestRoom;
        try { await returnTribute(pair.toUid, cards, hand); }
        finally { S.room = oldRoom; S.hand = oldHand; }
      }, AI_DELAY);
      return;
    }

    if (room.status !== "playing" || !room.currentTurnUid) return;
    const ai = playersMap(room)[room.currentTurnUid];
    if (!ai?.isAI || ai.finished || ai.forfeited) return;
    const stamp = room.updatedAt ? `${room.updatedAt.seconds || 0}_${room.updatedAt.nanoseconds || 0}` : Date.now();
    const key = `${S.roomId}:play:${room.round}:${ai.uid}:${room.currentSet?.uid || "new"}:${stamp}`;
    if (S.aiLocks.has(key)) return;
    S.aiLocks.add(key);
    setTimeout(async () => {
      const latest = await roomRef().get().catch(() => null);
      if (!latest?.exists) return;
      const latestRoom = latest.data();
      const latestAi = playersMap(latestRoom)[ai.uid];
      if (latestRoom.status !== "playing" || latestRoom.currentTurnUid !== ai.uid || !latestAi?.isAI) return;
      const snap = await handRef(ai.uid).get();
      const hand = snap.exists ? (snap.data().hand || []) : [];
      const cards = chooseAiCards(latestRoom, hand);
      const oldRoom = S.room;
      const oldHand = S.hand;
      S.room = latestRoom;
      try {
        if (cards.length) await applyPlay(ai.uid, cards, hand);
        else await passAs(ai.uid);
      } finally {
        S.room = oldRoom;
        S.hand = oldHand;
      }
    }, AI_DELAY);
  }

  async function sendChat() {
    const text = (E.chatInput?.value || "").trim();
    if (!text || !S.roomId || !S.room) return;
    const mine = me();
    if (mine?.type === "spectator" && S.room.spectatorChatEnabled === false) return toast("관전자 채팅이 차단되어 있습니다.");
    E.chatInput.value = "";
    await appendChat({ type: "chat", uid: S.user, nickname: mine?.nickname || S.user, text });
  }

  async function saveSettings() {
    if (!isHost() || S.room?.status !== "waiting") return;
    const title = ($("setTitle")?.value || "사바나 달무티").trim();
    const raw = Number($("setRounds")?.value || 5);
    await roomRef().set({ title, totalRounds: raw === 0 ? null : raw, updatedAt: serverNow() }, { merge: true });
    await addSystem("방 설정이 변경되었습니다.");
  }

  async function toggleSpectatorChat() {
    if (!isHost()) return;
    await roomRef().set({ spectatorChatEnabled: S.room?.spectatorChatEnabled === false, updatedAt: serverNow() }, { merge: true });
  }

  async function kick(uid) {
    if (!isHost() || uid === S.user || !S.room) return;
    const players = playersMap();
    const specs = spectatorsMap();
    const target = players[uid] || specs[uid];
    if (!target) return;
    if (!confirm(`${target.nickname}님을 방에서 내보낼까요?`)) return;
    if (players[uid]) {
      delete players[uid];
      await handRef(uid).delete().catch(() => null);
    }
    if (specs[uid]) delete specs[uid];
    let currentTurnUid = S.room.currentTurnUid;
    if (currentTurnUid === uid) currentTurnUid = nextAfter({ ...S.room, players }, uid);
    await roomRef().set({
      players,
      spectators: specs,
      playerCount: countMap(players),
      spectatorCount: countMap(specs),
      currentTurnUid,
      finishOrder: (S.room.finishOrder || []).filter(x => x.uid !== uid),
      kickNotice: { uid, nickname: target.nickname, at: ts() },
      updatedAt: serverNow()
    }, { merge: true });
    await addSystem(`${target.nickname}님이 방장에 의해 강퇴되었습니다.`);
  }

  async function clearSubcollection(col) {
    while (true) {
      const snap = await col.limit(300).get();
      if (snap.empty) return;
      const batch = db.batch();
      snap.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }
  }

  async function deleteRoom() {
    if (!canAdmin()) return toast("방장 또는 병풍만 방을 삭제할 수 있습니다.");
    if (!confirm("방을 완전히 삭제할까요? 참가자, 채팅, 진행 상황이 모두 삭제됩니다.")) return;
    const id = S.roomId;
    const ref = roomRef(id);
    await clearSubcollection(ref.collection("hands"));
    await ref.delete();
    alert("방이 완전히 삭제되었습니다.");
    leaveLocal();
  }

  async function stopGame() {
    if (!isHost()) return;
    if (!confirm("현재 게임을 중지할까요? 진행 중인 라운드, 손패, 점수, 계급 정보가 초기화되고 대기방으로 돌아갑니다.")) return;
    const players = {};
    allPlayers().forEach((p, i) => {
      players[p.uid] = { ...p, isReady: !!p.isAI, seatOrder: i, role: null, score: 0, lastRoundScore: 0, lastRoundRank: null, cardCount: 0, passed: false, finished: false, finishedRank: null, forfeited: false };
    });
    const batch = db.batch();
    batch.set(roomRef(), { players, status: "waiting", round: 0, currentTurnUid: null, currentSet: null, previousSet: null, tribute: null, finishOrder: [], lastRoundResult: null, rebellionNotice: null, updatedAt: serverNow() }, { merge: true });
    Object.keys(players).forEach(uid => batch.set(handRef(uid), { hand: [] }));
    await batch.commit();
    await addSystem("방장이 게임을 중지했습니다.");
  }

  function showModal(title, body, actions = `<button class="btn primary" onclick="Dalmuti.closeModal()">확인</button>`) {
    const card = $("gameModalCard");
    const modal = $("gameModal");
    if (!card || !modal) return;
    card.innerHTML = `<div class="modal-head"><h2>${title}</h2></div>${body}<div class="modal-actions">${actions}</div>`;
    modal.classList.add("show");
  }

  function closeModal() {
    $("gameModal")?.classList.remove("show");
  }

  function modalRows(players, mode) {
    return `<div class="modal-table"><div class="modal-row header"><span>순위</span><span>닉네임</span><span>${mode === "start" ? "점수" : "획득"}</span><span>계급</span></div>${players.map((p, i) => `<div class="modal-row"><span>${mode === "start" ? i + 1 : (p.lastRoundRank || i + 1)}등</span><span>${esc(p.nickname)}</span><strong>${mode === "start" ? (p.score || 0) : `+${p.lastRoundScore || 0}`}</strong><span>${esc(p.role || "-")}</span></div>`).join("")}</div>`;
  }

  function maybeStartModal() {
    const room = S.room;
    if (!room || !["playing", "tributeReturn"].includes(room.status) || !room.round) return;
    const key = getRoundSeenKey("start", room);
    if (markSeen(S.seenStart, key)) return;
    const show = () => showModal(`${room.round}라운드 시작`, `<p class="muted">이번 라운드 배정 계급과 현재 점수입니다.</p>${modalRows(allPlayers(), "start")}${room.status === "tributeReturn" ? `<p class="muted">상납 단계가 진행됩니다.</p>` : ""}`);
    if (room.rebellionNotice?.round === room.round) setTimeout(show, 5100);
    else show();
  }

  function maybeResultModal() {
    const room = S.room;
    if (!room || !["betweenRounds", "finished"].includes(room.status) || !room.lastRoundResult) return;
    const key = `dalmuti:${S.roomId}:result:${room.lastRoundResult.round}`;
    if (markSeen(S.seenResult, key)) return;
    const actions = isHost() && room.status === "betweenRounds" ? `<button class="btn primary" onclick="Dalmuti.nextRound()">다음 라운드 시작</button><button class="btn ghost" onclick="Dalmuti.closeModal()">닫기</button>` : `<button class="btn primary" onclick="Dalmuti.closeModal()">확인</button>`;
    showModal(`${room.lastRoundResult.round}라운드 결과`, modalRows(allPlayers().slice().sort((a, b) => (a.lastRoundRank ?? 999) - (b.lastRoundRank ?? 999)), "result"), actions);
  }

  function maybeRebellionModal() {
    const notice = S.room?.rebellionNotice;
    if (!notice) return;
    const key = `dalmuti:${S.roomId}:rebellion:${notice.round}:${notice.uid}`;
    if (markSeen(S.seenRebellion, key)) return;
    const card = $("rebellionModalCard");
    const modal = $("rebellionModal");
    if (!card || !modal) return;
    card.innerHTML = `<img src="${cardImg(13)}"><h2>민란 발생</h2><p>${esc(notice.nickname || "누군가")}님의 홍길동이 민란을 일으켰습니다</p><p>모든 계급이 반대로 뒤집힙니다.</p>`;
    modal.classList.add("show");
    setTimeout(() => modal.classList.remove("show"), 5000);
  }

  function showHelp() {
    showModal("게임 방법", `<div class="help-section"><strong>목표</strong><br>손패를 먼저 털수록 높은 순위를 얻고, 라운드마다 승점을 얻습니다.</div><div class="help-section"><strong>제출</strong><br>같은 계급 여러 장을 낼 수 있습니다. 이미 카드가 깔려 있으면 같은 장수이면서 더 높은 계급만 낼 수 있습니다.</div><div class="help-section"><strong>상납</strong><br>2라운드부터 하위 계급자가 상위 계급자에게 좋은 카드를 자동 상납하고, 받은 사람은 같은 장수만큼 돌려줍니다.</div><div class="help-section"><strong>민란</strong><br>농민 또는 노비가 홍길동 2장을 들면 계급 순서와 상납 방향이 뒤집힙니다.</div>`);
  }

  function bindEvents() {
    if (E.homeBtn) E.homeBtn.onclick = () => { location.href = "../"; };
    if (E.leaveRoomBtn) E.leaveRoomBtn.onclick = leaveRoom;
    if (E.createRoomBtn) E.createRoomBtn.onclick = createRoom;
    if (E.refreshRoomsBtn) E.refreshRoomsBtn.onclick = loadRooms;
    if (E.readyBtn) E.readyBtn.onclick = toggleReady;
    if (E.watchBtn) E.watchBtn.onclick = becomeSpectator;
    if (E.joinAsPlayerBtn) E.joinAsPlayerBtn.onclick = becomePlayer;
    if (E.startBtn) E.startBtn.onclick = startGame;
    if (E.nextRoundBtn) E.nextRoundBtn.onclick = () => nextRound(false);
    if (E.resetGameBtn) E.resetGameBtn.onclick = stopGame;
    if (E.playBtn) E.playBtn.onclick = playSelected;
    if (E.passBtn) E.passBtn.onclick = passTurn;
    if (E.sendChatBtn) E.sendChatBtn.onclick = sendChat;
    if (E.chatInput) E.chatInput.onkeydown = e => { if (e.key === "Enter") sendChat(); };
    if (E.toggleSpectatorChatBtn) E.toggleSpectatorChatBtn.onclick = toggleSpectatorChat;
  }

  async function init() {
    injectCss();
    collectElements();
    ensureModals();
    S.user = String(localStorage.getItem("partyAppUser") || "").trim();
    if (!S.user) {
      alert("닉네임을 입력하세요.");
      return;
    }
    if (E.myNickname) E.myNickname.textContent = S.user;
    renderRankPreview();
    bindEvents();
    await loadRooms();
    if (S.roomId) {
      const snap = await roomRef(S.roomId).get().catch(() => null);
      const data = snap?.exists ? snap.data() : null;
      if (data && (playersMap(data)[S.user] || spectatorsMap(data)[S.user])) enterRoom(S.roomId);
      else localStorage.removeItem("dalmutiCurrentRoomId");
    }
  }

  window.Dalmuti = {
    joinRoom,
    toggleRank,
    saveSettings,
    toggleSpectatorChat,
    kick,
    deleteRoom,
    stopGame,
    addAI,
    nextRound: () => nextRound(false),
    forceRebellion: () => nextRound(true),
    closeModal,
    showHelp,
    becomePlayer
  };

  window.addEventListener("DOMContentLoaded", init);
})();