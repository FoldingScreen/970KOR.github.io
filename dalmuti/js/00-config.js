(() => {
  const firebaseConfig = { apiKey: "AIzaSyBu2RrQn8cAwwWaLtw5O8Omwn4-NzHWuc0", authDomain: "kor-app-fa47e.firebaseapp.com", projectId: "kor-app-fa47e", storageBucket: "kor-app-fa47e.firebasestorage.app", messagingSenderId: "397749083935", appId: "1:397749083935:web:51c7c" };
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  firebase.firestore().settings({ experimentalForceLongPolling: true, useFetchStreams: false });

  const db = firebase.firestore();
  const FV = firebase.firestore.FieldValue;
  const CARD_BASE = "./cards/";
  const MAX_PLAYERS = 8;
  const MASTER_NAME = "병풍";

  const RANKS = [
    [1, "01", "사바나", "card-01-sabana.png", 1], [2, "02", "세자", "card-02-prince.png", 2],
    [3, "03", "영의정", "card-03-yeonguijeong.png", 3], [4, "04", "관찰사", "card-04-governor.png", 4],
    [5, "05", "암행어사", "card-05-amhaeng.png", 5], [6, "06", "사또", "card-06-satto.png", 6],
    [7, "07", "이방", "card-07-ibang.png", 7], [8, "08", "포졸", "card-08-pojol.png", 8],
    [9, "09", "선비", "card-09-seonbi.png", 9], [10, "10", "상인", "card-10-merchant.png", 10],
    [11, "11", "농민", "card-11-farmer.png", 11], [12, "12", "노비", "card-12-nobi.png", 12],
    [13, "J", "홍길동", "card-j-hong.png", 2]
  ].map(([rank, code, name, image, count]) => ({ rank, code, name, image, count, joker: rank === 13 }));

  const S = {
    user: "",
    roomId: localStorage.getItem("dalmutiCurrentRoomId") || "",
    room: null,
    participants: [],
    messages: [],
    selected: new Map(),
    unsub: {},
    seenRoundStart: new Set(),
    seenRoundResult: new Set(),
    seenRebellion: new Set(),
    aiActionKeys: new Set()
  };

  const E = {};
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? "").replace(/[&<>\"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
  const roomCol = () => db.collection("events").doc("dalmuti").collection("rooms");
  const roomRef = (id = S.roomId) => roomCol().doc(id);
  const partRef = (id = S.roomId) => roomRef(id).collection("participants");
  const msgRef = (id = S.roomId) => roomRef(id).collection("messages");
  const rankInfo = (rank) => RANKS.find((r) => r.rank === Number(rank)) || RANKS[RANKS.length - 1];
  const cardImg = (rank) => CARD_BASE + rankInfo(rank).image;
  const nowTs = () => firebase.firestore.Timestamp.now();
  const me = () => S.participants.find((p) => p.uid === S.user) || null;
  const isHost = () => S.room?.hostUid === S.user;
  const isMaster = () => S.user === MASTER_NAME;
  const canAdminRoom = () => isHost() || isMaster();
  const players = () => S.participants.filter((p) => p.type === "player" && !p.removedFromRoom).sort((a, b) => (a.seatOrder ?? 999) - (b.seatOrder ?? 999));
  const spectators = () => S.participants.filter((p) => p.type === "spectator" && !p.removedFromRoom).sort((a, b) => String(a.nickname || "").localeCompare(String(b.nickname || ""), "ko"));
  const activePlayers = () => players().filter((p) => !p.finished && !p.forfeited);

  function installCss() {
    if ($("dalmutiUnifiedCss")) return;
    const style = document.createElement("style");
    style.id = "dalmutiUnifiedCss";
    style.textContent = `
      @media (min-width: 881px){
        .dalmuti-app{width:min(1380px,100%);padding:10px 14px}.dalmuti-topbar{margin-bottom:8px}.dalmuti-topbar h1{font-size:23px;margin:0}
        .room-shell{grid-template-columns:minmax(0,1fr) 300px;gap:10px}.panel{padding:12px;border-radius:18px}.game-panel{min-height:calc(100vh - 92px);display:flex;flex-direction:column}.room-head{display:none!important}
        .message-bar{margin:0 0 8px;padding:8px 10px;font-size:13px}.table-wrap{height:calc(100vh - 300px);min-height:540px;max-height:620px;margin-top:6px;flex:1}.hand-header{margin-top:8px}.hand-header h3{font-size:17px;margin:0}.hand-header .muted{display:none}
        .hand-area{min-height:142px;padding:10px;margin:6px 0;gap:8px}.hand-stack{width:74px}.hand-stack img{width:74px;border-radius:8px}.selected-summary{font-size:13px;padding:6px 10px}.action-row .btn{padding:8px 11px}
        .player-box{width:116px;min-height:68px;padding:7px;border-radius:14px;position:absolute}.player-role{font-size:11px}.player-name{font-size:13px}.player-meta{font-size:11px}.seat-bottom{bottom:6px!important}.seat-top-0,.seat-top-1,.seat-top-2{top:6px!important}.seat-left-0,.seat-left-1,.seat-left-2{left:8px!important}.seat-right-0,.seat-right-1,.seat-right-2{right:8px!important}.seat-top-0{left:50%!important;transform:translateX(-50%)!important}.seat-top-1{left:30%!important;transform:translateX(-50%)!important}.seat-top-2{left:70%!important;transform:translateX(-50%)!important}
        .player-box.submitted{border-color:#7ee2a8!important;box-shadow:0 0 0 2px rgba(126,226,168,.55),0 12px 24px rgba(0,0,0,.28)!important}.player-box.passed{opacity:.8!important;border-color:#8792a7!important;background:rgba(35,39,51,.92)!important}.player-box.forfeited{opacity:.45!important;filter:grayscale(.9)}
        .badge{display:inline-block;margin-top:3px;padding:2px 7px;border-radius:999px;font-size:10px;font-weight:900}.badge.submit{background:rgba(126,226,168,.16);border:1px solid rgba(126,226,168,.75);color:#9ff0bd}.badge.pass{background:rgba(135,146,167,.16);border:1px solid rgba(135,146,167,.75);color:#d2d8e4}.badge.turn{background:rgba(243,210,129,.16);border:1px solid rgba(243,210,129,.75);color:#f3d281}.badge.ai{background:rgba(111,179,255,.16);border:1px solid rgba(111,179,255,.75);color:#9fcaff}
        .kick-btn{position:absolute;right:5px;top:5px;border:0;border-radius:999px;background:rgba(215,101,101,.92);color:#fff;font-size:10px;font-weight:900;padding:3px 6px;cursor:pointer;z-index:3}
        .center-pile{width:720px!important;max-width:72%!important;height:360px!important;min-height:360px!important;padding:0!important;overflow:visible!important;text-align:left!important}.pile-board{position:relative;width:100%;height:100%}.pile-empty{height:100%;display:flex;align-items:center;justify-content:center;color:#aeb5c3;font-weight:900;font-size:18px}.prev-pile{position:absolute;left:14px;top:14px;width:160px;min-height:158px;border:1px solid rgba(255,255,255,.09);border-radius:14px;background:rgba(0,0,0,.24);padding:10px;display:flex;flex-direction:column;align-items:center}.prev-pile-title{font-size:12px;font-weight:900;color:#aeb5c3;margin-bottom:8px}.prev-pile img{width:82px;border-radius:10px}.cur-pile{position:absolute;left:205px;right:18px;top:20px;bottom:18px;display:flex;flex-direction:column;align-items:center;justify-content:center}.cur-pile-title{font-size:14px;font-weight:900;color:#f3d281;margin-bottom:12px}.cur-cards{display:flex;align-items:center;justify-content:center}.cur-cards img{width:132px;object-fit:cover;border-radius:12px;box-shadow:0 12px 28px rgba(0,0,0,.42);margin-left:-38px}.cur-cards img:first-child{margin-left:0}
        .side-panel{gap:9px;max-height:calc(100vh - 92px);overflow:auto}.side-panel>section:first-child{display:none}.chat-list{height:200px}.side-box{margin-top:8px;border:1px solid rgba(243,210,129,.28);background:rgba(13,19,32,.72);border-radius:16px;padding:10px}.side-title{font-weight:900;color:#f3d281;margin-bottom:7px}.side-btns{display:flex;gap:6px;flex-wrap:wrap}.side-btns .btn{padding:6px 8px;font-size:12px}.chip{display:inline-block;font-size:11px;padding:4px 7px;border-radius:999px;border:1px solid rgba(174,181,195,.28);background:rgba(255,255,255,.045);margin:2px}.score-row.compact{font-size:12px;padding:4px 0}.room-setting-grid{display:grid;grid-template-columns:1fr;gap:6px}.room-setting-grid .input{height:32px;font-size:12px}
        #tributePanel{position:fixed;right:326px;bottom:12px;z-index:95;display:none;width:260px;padding:10px;border-radius:18px;border:1px solid rgba(243,210,129,.45);background:rgba(13,19,32,.96);box-shadow:0 16px 42px rgba(0,0,0,.42);color:#f4f1e8}.tribute-title{font-weight:900;color:#f3d281}.tribute-line{font-size:12px;color:#aeb5c3;margin:6px 0}.tribute-cards{display:flex;gap:7px;flex-wrap:wrap}.tribute-cards img{width:40px;border-radius:7px}
      }
      .game-modal{position:fixed;inset:0;z-index:180;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.62);padding:24px}.game-modal.show{display:flex}.modal-card{width:min(760px,96vw);max-height:86vh;overflow:auto;background:#121827;border:1px solid rgba(243,210,129,.4);border-radius:24px;padding:22px;box-shadow:0 24px 80px rgba(0,0,0,.58);color:#f4f1e8}.modal-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px}.modal-head h2{margin:0;color:#f3d281}.modal-table{display:grid;gap:7px}.modal-row{display:grid;grid-template-columns:54px minmax(0,1fr) 74px 82px;gap:8px;align-items:center;padding:9px;border-radius:13px;background:rgba(255,255,255,.055);font-size:14px}.modal-row.header{background:transparent;color:#aeb5c3;font-size:12px;font-weight:900}.modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}.rebellion-card{text-align:center}.rebellion-card img{width:180px;border-radius:18px;box-shadow:0 18px 55px rgba(0,0,0,.6);margin-bottom:16px}.rebellion-card h2{color:#f3d281;margin:4px 0 8px}.rebellion-card p{font-size:18px;font-weight:900;margin:6px 0}.help-section{border-top:1px solid rgba(255,255,255,.09);padding-top:12px;margin-top:12px;line-height:1.55;color:#d8deea;font-size:14px}.help-section strong{color:#f3d281}
    `;
    document.head.appendChild(style);
  }

  function collect() {
    ["lobbyView", "roomView", "myNickname", "roomTitleInput", "totalRoundsSelect", "turnLimitSelect", "roomList", "rankPreview", "roomStateText", "roomTitle", "turnBadge", "messageBar", "lobbyControls", "readyBtn", "watchBtn", "joinAsPlayerBtn", "startBtn", "betweenControls", "nextRoundBtn", "resetGameBtn", "playersArea", "centerPile", "handArea", "selectedSummary", "playControls", "playBtn", "passBtn", "scoreList", "chatList", "chatInput", "sendChatBtn", "toggleSpectatorChatBtn", "homeBtn", "leaveRoomBtn", "createRoomBtn", "refreshRoomsBtn", "toast"].forEach((id) => { E[id] = $(id); });
  }

  function ensureModals() {
    if (!$('gameModal')) {
      const m = document.createElement('div');
      m.id = 'gameModal';
      m.className = 'game-modal';
      m.innerHTML = '<div id="gameModalCard" class="modal-card"></div>';
      document.body.appendChild(m);
    }
    if (!$('rebellionModal')) {
      const r = document.createElement('div');
      r.id = 'rebellionModal';
      r.className = 'game-modal';
      r.innerHTML = '<div id="rebellionModalCard" class="modal-card rebellion-card"></div>';
      document.body.appendChild(r);
    }
    if (!$('tributePanel')) {
      const t = document.createElement('div');
      t.id = 'tributePanel';
      document.body.appendChild(t);
    }
  }

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
  function roleByIndex(i, count) {
    const map = { 2: ["사바나", "노비"], 3: ["사바나", "농민", "노비"], 4: ["사바나", "세자", "농민", "노비"], 5: ["사바나", "세자", "사또", "농민", "노비"], 6: ["사바나", "세자", "암행어사", "사또", "농민", "노비"], 7: ["사바나", "세자", "관찰사", "암행어사", "사또", "농민", "노비"], 8: ["사바나", "세자", "영의정", "관찰사", "암행어사", "사또", "농민", "노비"] };
    return (map[count] || [])[i] || `${i + 1}등`;
  }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function maxRankForCount(count) { return count <= 3 ? 8 : count <= 5 ? 10 : 12; }
  function sortHand(cards = []) { return cards.slice().sort((a, b) => a.rank - b.rank || String(a.id).localeCompare(String(b.id))); }
  function makeDeck(count) {
    const max = maxRankForCount(count), deck = [];
    RANKS.filter((r) => r.rank <= max).forEach((r) => { for (let i = 1; i <= r.count; i += 1) deck.push({ id: `r${r.rank}-${i}-${Math.random().toString(36).slice(2, 8)}`, rank: r.rank, name: r.name }); });
    for (let i = 1; i <= 2; i += 1) deck.push({ id: `j-${i}-${Math.random().toString(36).slice(2, 8)}`, rank: 13, name: "홍길동", joker: true });
    return shuffle(deck);
  }
  function groupHand(cards = []) {
    const map = new Map();
    sortHand(cards).forEach((c) => { if (!map.has(c.rank)) map.set(c.rank, []); map.get(c.rank).push(c); });
    return Array.from(map.entries()).map(([rank, items]) => ({ rank, items }));
  }
  function selectedCards() {
    const hand = me()?.hand || [], ids = new Set();
    S.selected.forEach((items) => items.forEach((c) => ids.add(c.id)));
    return hand.filter((c) => ids.has(c.id));
  }
  function normalizeSelection(cards) {
    if (!cards.length) return { ok: false, reason: "카드를 선택하세요." };
    const normals = cards.filter((c) => !c.joker), ranks = Array.from(new Set(normals.map((c) => c.rank)));
    if (ranks.length > 1) return { ok: false, reason: "같은 계급만 함께 낼 수 있습니다." };
    if (!normals.length) return { ok: true, effectiveRank: 13, effectiveName: "홍길동", count: cards.length, cards };
    return { ok: true, effectiveRank: ranks[0], effectiveName: rankInfo(ranks[0]).name, count: cards.length, cards };
  }
  function canPlay(cards, room = S.room) {
    const combo = normalizeSelection(cards), cur = room?.currentSet;
    if (!combo.ok || !cur) return combo;
    if (combo.count !== cur.count) return { ok: false, reason: `이번 판은 ${cur.count}장씩 내야 합니다.` };
    if (combo.effectiveRank >= cur.effectiveRank) return { ok: false, reason: "더 높은 계급만 낼 수 있습니다." };
    return combo;
  }
  function nextActiveUidAfter(uid) {
    const active = activePlayers();
    if (!active.length) return "";
    const idx = Math.max(0, active.findIndex((p) => p.uid === uid));
    return active[(idx + 1) % active.length]?.uid || active[0]?.uid || "";
  }
  function myTributePair() { return (S.room?.tribute?.pairs || []).find((p) => p.toUid === S.user && !p.returned) || null; }
  function selectBestTributeCards(hand, count) { return sortHand(hand).filter((c) => !c.joker && c.rank !== 13).slice(0, count); }
  async function addSystem(text) { if (S.roomId) await msgRef().add({ type: "system", text, createdAt: FV.serverTimestamp() }); }

  async function updateCounts(id = S.roomId) {
    if (!id) return;
    const snap = await partRef(id).get();
    const list = snap.docs.map((d) => d.data()).filter((p) => !p.removedFromRoom);
    await roomRef(id).set({ playerCount: list.filter((p) => p.type === "player").length, spectatorCount: list.filter((p) => p.type === "spectator").length, updatedAt: FV.serverTimestamp() }, { merge: true });
  }

  function renderRanks() { E.rankPreview.innerHTML = RANKS.map((r) => `<span class="rank-chip">${r.code}. ${esc(r.name)}</span>`).join(""); }
  function watchRooms() {
    if (S.unsub.rooms) S.unsub.rooms();
    S.unsub.rooms = roomCol().orderBy("updatedAt", "desc").limit(30).onSnapshot((snap) => {
      const docs = snap.docs.filter((doc) => !doc.data().closed && doc.data().status !== "closed");
      E.roomList.innerHTML = docs.length ? docs.map((doc) => {
        const r = doc.data(), status = ({ waiting: "대기 중", playing: "진행 중", betweenRounds: "라운드 종료", tributeReturn: "상납 반환", finished: "게임 종료" })[r.status] || r.status;
        return `<div class="room-item"><div><strong>${esc(r.title || "사바나 달무티")}</strong><div class="room-meta">${status} · 플레이어 ${r.playerCount || 0}/${MAX_PLAYERS} · 관전자 ${r.spectatorCount || 0} · ${r.totalRounds ? `${r.totalRounds}판` : "무제한"}</div></div><button class="btn primary" type="button" onclick="Dalmuti.joinRoom('${doc.id}')">입장</button></div>`;
      }).join("") : `<div class="muted">생성된 방이 없습니다.</div>`;
    }, console.error);
  }

  function positionedPlayers() {
    const ps = players(), meIdx = Math.max(0, ps.findIndex((p) => p.uid === S.user)), rotated = meIdx >= 0 ? ps.slice(meIdx).concat(ps.slice(0, meIdx)) : ps, mine = rotated[0], others = rotated.slice(1);
    let left = [], top = [], right = [];
    if (others.length === 1) top = others;
    else if (others.length === 2) { left = [others[0]]; right = [others[1]]; }
    else if (others.length === 3) { left = [others[0]]; top = [others[1]]; right = [others[2]]; }
    else if (others.length === 4) { left = [others[0]]; top = [others[1], others[2]]; right = [others[3]]; }
    else if (others.length === 5) { left = [others[0], others[1]]; top = [others[2], others[3]]; right = [others[4]]; }
    else if (others.length === 6) { left = [others[0], others[1]]; top = [others[2], others[3]]; right = [others[4], others[5]]; }
    else { left = [others[0], others[1]]; top = [others[2], others[3], others[4]]; right = [others[5], others[6]]; }
    return [...(mine ? [{ p: mine, cls: "seat-bottom" }] : []), ...left.map((p, i) => ({ p, cls: `seat-left-${left.length === 1 ? 0 : i + 1}` })), ...top.map((p, i) => ({ p, cls: `seat-top-${top.length === 1 ? 0 : i}` })), ...right.map((p, i) => ({ p, cls: `seat-right-${right.length === 1 ? 0 : i + 1}` }))];
  }
  function renderPlayers() {
    E.playersArea.innerHTML = positionedPlayers().map(({ p, cls }) => {
      const submitted = S.room?.currentSet?.uid === p.uid;
      const state = p.finished ? `${p.finishedRank || ""}등` : p.passed ? "패스" : `${p.cardCount || 0}장`;
      let badge = p.isAI ? `<div class="badge ai">AI</div>` : "";
      if (submitted) badge += `<div class="badge submit">제출</div>`;
      else if (p.passed) badge += `<div class="badge pass">패스</div>`;
      else if (S.room?.currentTurnUid === p.uid) badge += `<div class="badge turn">차례</div>`;
      const kick = isHost() && p.uid !== S.user ? `<button class="kick-btn" type="button" onclick="Dalmuti.kick('${p.uid}')">강퇴</button>` : "";
      return `<div class="player-box ${cls} ${p.uid === S.user ? "me" : ""} ${S.room?.currentTurnUid === p.uid ? "turn" : ""} ${p.passed ? "passed" : ""} ${p.finished ? "finished" : ""} ${submitted ? "submitted" : ""} ${p.forfeited ? "forfeited" : ""}">${kick}<div class="player-role">${esc(p.role || "참가자")}</div><div class="player-name">${esc(p.nickname)}</div><div class="player-meta">${state}${p.isReady ? " · 준비" : ""}</div>${badge}</div>`;
    }).join("");
  }
  function renderPile() {
    if (S.room?.status === "tributeReturn") {
      const pairs = S.room.tribute?.pairs || [];
      E.centerPile.innerHTML = `<div class="pile-title">상납 반환</div><div class="muted">상납 받은 사람이 돌려줄 카드를 선택합니다.</div><div class="muted">${pairs.map((p) => `${esc(p.fromNickname)} → ${esc(p.toNickname)} ${p.count}장 ${p.returned ? "완료" : "대기"}`).join("<br>")}</div>`;
      return;
    }
    const prev = S.room?.previousSet, cur = S.room?.currentSet;
    if (!prev && !cur) { E.centerPile.innerHTML = `<div class="pile-board"><div class="pile-empty">새 판</div></div>`; return; }
    const prevCard = prev?.cards?.[0] ? `<img src="${cardImg(prev.cards[0].rank)}" alt="직전 카드">` : `<span class="muted">없음</span>`;
    const curCards = cur ? (cur.cards || []).map((c) => `<img src="${cardImg(c.rank)}" alt="${esc(c.name)}">`).join("") : `<span class="muted">제출 대기</span>`;
    E.centerPile.innerHTML = `<div class="pile-board"><div class="prev-pile"><div class="prev-pile-title">직전 카드</div>${prevCard}</div><div class="cur-pile"><div class="cur-pile-title">${cur ? `현재 ${rankInfo(cur.effectiveRank).name} ${cur.count}장` : "현재 없음"}</div><div class="cur-cards">${curCards}</div></div></div>`;
  }
  function isSelectableRank(group) {
    if (S.room?.status === "tributeReturn") return !!myTributePair();
    if (S.room?.status !== "playing" || S.room.currentTurnUid !== S.user || !S.room.currentSet) return true;
    if (group.rank === 13) return false;
    const need = S.room.currentSet.count, jokerCount = (me()?.hand || []).filter((c) => c.joker).length;
    return group.items.length + jokerCount >= need && group.rank < S.room.currentSet.effectiveRank;
  }
  function renderHand() {
    const mine = me();
    if (!mine || mine.type !== "player" || mine.removedFromRoom) { E.handArea.innerHTML = `<div class="muted">관전자는 손패가 없습니다.</div>`; E.selectedSummary.textContent = "선택 없음"; return; }
    const gs = groupHand(mine.hand || []);
    E.handArea.classList.toggle("has-selection", S.selected.size > 0);
    E.handArea.innerHTML = gs.length ? gs.map((g) => {
      const sel = S.selected.get(g.rank)?.length || 0;
      return `<div class="hand-stack${sel ? " selected" : ""}${isSelectableRank(g) ? "" : " disabled"}" onclick="Dalmuti.toggleRank(${g.rank})">${sel ? `<span class="stack-selected">${sel}</span>` : ""}<img src="${cardImg(g.rank)}" alt="${esc(rankInfo(g.rank).name)}"><span class="stack-count">x${g.items.length}</span></div>`;
    }).join("") : `<div class="muted">손패가 없습니다.</div>`;
    const cards = selectedCards();
    if (S.room?.status === "tributeReturn") { const p = myTributePair(); E.selectedSummary.textContent = p ? `${cards.length}/${p.count}장 반환 선택` : "상납 반환 대기"; return; }
    const combo = canPlay(cards);
    E.selectedSummary.textContent = cards.length ? (combo.ok ? `${rankInfo(combo.effectiveRank).name} ${combo.count}장` : combo.reason) : "선택 없음";
  }
  function renderControls() {
    const mine = me(), waiting = S.room?.status === "waiting", between = S.room?.status === "betweenRounds" || S.room?.status === "finished";
    const myTurn = S.room?.status === "playing" && S.room.currentTurnUid === S.user && mine?.type === "player" && !mine.finished && !mine.forfeited;
    const tributeTurn = S.room?.status === "tributeReturn" && !!myTributePair();
    E.lobbyControls.classList.toggle("hidden", !waiting);
    E.betweenControls.classList.toggle("hidden", !between);
    E.playControls.classList.toggle("hidden", !(myTurn || tributeTurn));
    E.passBtn.classList.toggle("hidden", !myTurn);
    E.playBtn.textContent = tributeTurn ? "반환 카드 주기" : "선택 카드 내기";
    E.readyBtn.classList.toggle("hidden", !(waiting && mine?.type === "player" && !mine.isAI));
    E.watchBtn.classList.toggle("hidden", !(waiting && mine?.type === "player" && !mine.isAI));
    E.joinAsPlayerBtn.classList.toggle("hidden", !(waiting && mine?.type === "spectator"));
    E.startBtn.classList.toggle("hidden", !(waiting && isHost()));
    E.nextRoundBtn.classList.toggle("hidden", !(S.room?.status === "betweenRounds" && isHost()));
    E.resetGameBtn.classList.add("hidden");
    E.readyBtn.textContent = mine?.isReady ? "준비 취소" : "준비";
  }
  function renderMessages() {
    const docs = S.messages.slice().reverse();
    E.chatList.innerHTML = docs.length ? docs.map((m) => m.type === "system" ? `<div class="chat-msg system">${esc(m.text)}</div>` : `<div class="chat-msg"><span class="chat-name">${esc(m.nickname || "-")}</span> ${esc(m.text || "")}</div>`).join("") : `<div class="muted">채팅이 없습니다.</div>`;
    E.chatList.scrollTop = E.chatList.scrollHeight;
  }
  function sideBox(id, anchor) {
    let box = $(id);
    if (!box) { box = document.createElement("section"); box.id = id; box.className = "side-box"; (anchor || document.querySelector(".side-panel")).insertAdjacentElement(anchor ? "afterend" : "afterbegin", box); }
    return box;
  }
  function renderSide() {
    const side = document.querySelector(".side-panel");
    if (!side || !S.room) return;
    const turn = S.room.currentTurnUid ? (S.participants.find((p) => p.uid === S.room.currentTurnUid)?.nickname || "-") : "-";
    const status = ({ waiting: "대기 중", playing: `${S.room.round || 1}라운드`, tributeReturn: "상납 반환", betweenRounds: "라운드 종료", finished: "게임 종료" })[S.room.status] || S.room.status;
    const info = sideBox("roomInfo");
    info.innerHTML = `<div class="side-title">방 정보</div><div class="score-row compact"><span>방제</span><strong>${esc(S.room.title || "-")}</strong></div><div class="score-row compact"><span>상태</span><strong>${esc(status)}</strong></div><div class="score-row compact"><span>차례</span><strong>${esc(turn)}</strong></div>`;

    const settings = sideBox("roomSettings", info);
    settings.style.display = isHost() && S.room.status === "waiting" ? "block" : "none";
    if (settings.style.display !== "none") {
      settings.innerHTML = `<div class="side-title">방 설정</div><div class="room-setting-grid"><input id="setTitle" class="input" maxlength="24" value="${esc(S.room.title || "")}"><select id="setRounds" class="input"><option value="3">3판</option><option value="5">5판</option><option value="10">10판</option><option value="0">무제한</option></select></div><div class="side-btns" style="margin-top:8px"><button class="btn primary small" onclick="Dalmuti.saveSettings()">저장</button><button class="btn ghost small" onclick="Dalmuti.toggleSpectatorChat()">관전자 채팅 ${S.room.spectatorChatEnabled === false ? "차단" : "허용"}</button></div>`;
      $("setRounds").value = String(S.room.totalRounds || 0);
    }

    const sp = sideBox("spectatorPanel", E.scoreList.parentElement);
    const spec = spectators();
    sp.innerHTML = `<div class="side-title">관전자</div>${spec.length ? spec.map((p) => `<span class="chip">${esc(p.nickname)}</span>`).join(" ") : `<div class="muted">관전자가 없습니다.</div>`}`;

    const admin = sideBox("adminPanel", sp);
    const aiBtn = isHost() && S.room.status === "waiting" ? `<button class="btn ghost small" onclick="Dalmuti.addAI()">AI 추가</button>` : "";
    const forceBtn = isHost() && S.room.status === "betweenRounds" ? `<button class="btn ghost small" onclick="Dalmuti.forceRebellion()">민란 강제</button>` : "";
    const stopBtn = isHost() && S.room.status !== "waiting" ? `<button class="btn danger small" onclick="Dalmuti.stopGame()">게임 중지</button>` : "";
    const deleteBtn = canAdminRoom() ? `<button class="btn danger small" onclick="Dalmuti.deleteRoom()">방 삭제</button>` : "";
    admin.innerHTML = `<div class="side-title">관리</div><div class="side-btns">${aiBtn}${forceBtn}${stopBtn}${deleteBtn}<button class="btn ghost small" onclick="Dalmuti.showHelp()">게임 방법</button></div>`;
  }
  function renderTribute() {
    const panel = $("tributePanel");
    if (!S.room || S.room.status !== "tributeReturn" || !S.room.tribute) { panel.style.display = "none"; return; }
    const incoming = myTributePair(), outgoing = (S.room.tribute.pairs || []).filter((p) => p.fromUid === S.user);
    if (!incoming && !outgoing.length) { panel.style.display = "none"; return; }
    panel.innerHTML = outgoing.map((p) => `<div><div class="tribute-title">내가 상납한 카드</div><div class="tribute-line">${esc(p.toNickname)}님에게 ${p.count}장 상납</div><div class="tribute-cards">${(p.cards || []).map((c) => `<img src="${cardImg(c.rank)}">`).join("")}</div></div>`).join("") + (incoming ? `<div><div class="tribute-title">상납받은 카드</div><div class="tribute-line">${esc(incoming.fromNickname)}님에게서 ${incoming.count}장 받음 · 돌려줄 카드 ${incoming.count}장 선택</div><div class="tribute-cards">${(incoming.cards || []).map((c) => `<img src="${cardImg(c.rank)}">`).join("")}</div></div>` : "");
    panel.style.display = "block";
  }
  function messageText() {
    const mine = me();
    if (!S.room) return "";
    if (S.room.status === "waiting") return mine?.type === "spectator" ? "관전 중입니다. 참가하려면 참가하기를 누르세요." : "준비를 누르거나 관전하기를 선택하세요.";
    if (S.room.status === "tributeReturn") return myTributePair() ? "상납으로 받은 만큼 돌려줄 카드를 선택하세요." : "상납 반환을 기다리는 중입니다.";
    if (S.room.status === "betweenRounds") return "라운드가 끝났습니다. 결과는 모달에서 확인하세요.";
    if (S.room.status === "finished") return "게임이 종료되었습니다.";
    return S.room.currentTurnUid === S.user ? "내 차례입니다." : "다른 플레이어 차례입니다.";
  }
  function renderRoom() {
    if (!S.room) return;
    if (S.room.kickNotice?.uid === S.user) { alert("방장에 의해 방에서 내보내졌습니다."); leaveLocal(); return; }
    const status = ({ waiting: "대기 중", playing: `${S.room.round || 1}라운드 진행 중`, tributeReturn: "상납 반환", betweenRounds: "라운드 종료", finished: "게임 종료" })[S.room.status] || S.room.status;
    E.roomStateText.textContent = status;
    E.roomTitle.textContent = S.room.title || "사바나 달무티";
    E.turnBadge.textContent = S.room.status === "playing" ? `차례: ${S.participants.find((p) => p.uid === S.room.currentTurnUid)?.nickname || "-"}` : status;
    E.messageBar.textContent = messageText();
    renderPlayers(); renderPile(); renderHand(); renderControls(); renderSide(); renderTribute(); maybeShowRoundStart(); maybeShowRoundResult(); maybeShowRebellion(); maybeRunAI();
  }

  function modalHtmlRows(list, mode) {
    return `<div class="modal-table"><div class="modal-row header"><span>순위</span><span>닉네임</span><span>${mode === "start" ? "점수" : "획득"}</span><span>계급</span></div>${list.map((p, i) => `<div class="modal-row"><span>${mode === "start" ? i + 1 : (p.lastRoundRank || i + 1)}등</span><span>${esc(p.nickname || "-")}</span><strong>${mode === "start" ? (p.score || 0) : `+${p.lastRoundScore || 0}`}</strong><span>${esc(p.role || "-")}</span></div>`).join("")}</div>`;
  }
  function showModal(title, body, actions = `<button class="btn primary" onclick="Dalmuti.closeModal()">확인</button>`) {
    $("gameModalCard").innerHTML = `<div class="modal-head"><h2>${title}</h2></div>${body}<div class="modal-actions">${actions}</div>`;
    $("gameModal").classList.add("show");
  }
  function closeModal() { $("gameModal").classList.remove("show"); }
  function maybeShowRoundStart() {
    if (!S.room || !["playing", "tributeReturn"].includes(S.room.status) || !S.room.round) return;
    const key = `${S.roomId}:start:${S.room.round}`;
    if (S.seenRoundStart.has(key)) return;
    S.seenRoundStart.add(key);
    const show = () => showModal(`${S.room.round}라운드 시작`, `<p class="muted">이번 라운드 배정 계급과 현재 점수입니다.</p>${modalHtmlRows(players(), "start")}${S.room.status === "tributeReturn" ? `<p class="muted">상납 단계가 진행됩니다.</p>` : ""}`);
    if (S.room.rebellionNotice?.round === S.room.round) setTimeout(show, 5100); else show();
  }
  function maybeShowRoundResult() {
    if (!S.room || !["betweenRounds", "finished"].includes(S.room.status) || !S.room.lastRoundResult) return;
    const key = `${S.roomId}:result:${S.room.lastRoundResult.round}`;
    if (S.seenRoundResult.has(key)) return;
    S.seenRoundResult.add(key);
    const actions = isHost() && S.room.status === "betweenRounds" ? `<button class="btn primary" onclick="Dalmuti.nextRound()">다음 라운드 시작</button><button class="btn ghost" onclick="Dalmuti.closeModal()">닫기</button>` : `<button class="btn primary" onclick="Dalmuti.closeModal()">확인</button>`;
    showModal(`${S.room.lastRoundResult.round}라운드 결과`, modalHtmlRows(players().slice().sort((a, b) => (a.lastRoundRank ?? 999) - (b.lastRoundRank ?? 999)), "result"), actions);
  }
  function maybeShowRebellion() {
    const n = S.room?.rebellionNotice;
    if (!n) return;
    const key = `${S.roomId}:rebellion:${n.round}:${n.uid || n.nickname}`;
    if (S.seenRebellion.has(key)) return;
    S.seenRebellion.add(key);
    $("rebellionModalCard").innerHTML = `<img src="${cardImg(13)}" alt="홍길동"><h2>민란 발생</h2><p>${esc(n.nickname || "누군가")}님의 홍길동이 민란을 일으켰습니다</p><p>모든 계급이 반대로 뒤집힙니다.</p>`;
    $("rebellionModal").classList.add("show");
    setTimeout(() => $("rebellionModal").classList.remove("show"), 5000);
  }

  function baseParticipant(type, extra = {}) {
    return { uid: S.user, nickname: S.user, type, isReady: false, isAI: false, seatOrder: type === "player" ? 999 : null, role: null, score: 0, lastRoundScore: 0, lastRoundRank: null, hand: [], cardCount: 0, passed: false, finished: false, finishedRank: null, forfeited: false, removedFromRoom: false, connected: true, joinedAt: FV.serverTimestamp(), updatedAt: FV.serverTimestamp(), ...extra };
  }
  async function createRoom() {
    const title = E.roomTitleInput.value.trim() || `${S.user}의 사바나 달무티`, raw = Number(E.totalRoundsSelect.value || 5);
    const doc = await roomCol().add({ title, hostUid: S.user, hostNickname: S.user, status: "waiting", closed: false, round: 0, totalRounds: raw === 0 ? null : raw, playerLimit: MAX_PLAYERS, playerCount: 1, spectatorCount: 0, currentTurnUid: null, currentSet: null, previousSet: null, finishOrder: [], lastRoundResult: null, tribute: null, spectatorChatEnabled: true, kickNotice: null, rebellionNotice: null, createdAt: FV.serverTimestamp(), updatedAt: FV.serverTimestamp() });
    S.roomId = doc.id;
    localStorage.setItem("dalmutiCurrentRoomId", S.roomId);
    await partRef().doc(S.user).set(baseParticipant("player", { seatOrder: 0 }));
    await addSystem(`${S.user}님이 방을 만들었습니다.`);
    enterRoom(S.roomId);
  }
  async function joinRoom(id) {
    const rs = await roomRef(id).get();
    if (!rs.exists || rs.data().closed || rs.data().status === "closed") return toast("입장할 수 없는 방입니다.");
    if (S.roomId && S.roomId !== id) await leaveRoom(false);
    S.roomId = id;
    localStorage.setItem("dalmutiCurrentRoomId", id);
    const room = rs.data(), pr = partRef(id).doc(S.user), ps = await pr.get();
    if (ps.exists) await pr.set({ connected: true, removedFromRoom: false, updatedAt: FV.serverTimestamp() }, { merge: true });
    else await pr.set(baseParticipant(room.status === "waiting" ? "player" : "spectator", { seatOrder: room.status === "waiting" ? (room.playerCount || 0) : null }));
    await msgRef(id).add({ type: "system", text: `${S.user}님이 입장했습니다.`, createdAt: FV.serverTimestamp() });
    await updateCounts(id);
    enterRoom(id);
  }
  function enterRoom(id) {
    S.roomId = id;
    setView("room");
    S.selected.clear();
    Object.values(S.unsub).forEach((fn) => typeof fn === "function" && fn());
    S.unsub = {};
    S.unsub.room = roomRef(id).onSnapshot((snap) => { if (!snap.exists) return leaveLocal(); S.room = { id: snap.id, ...snap.data() }; renderRoom(); }, console.error);
    S.unsub.participants = partRef(id).onSnapshot((snap) => { S.participants = snap.docs.map((d) => ({ id: d.id, ...d.data() })); renderRoom(); }, console.error);
    S.unsub.messages = msgRef(id).orderBy("createdAt", "desc").limit(100).onSnapshot((snap) => { S.messages = snap.docs.map((d) => d.data()); renderMessages(); }, console.error);
  }
  async function leaveRoom(write = true) {
    if (!S.roomId) return;
    const old = S.roomId;
    if (me()) {
      await partRef(old).doc(S.user).delete().catch(() => null);
      if (write) await msgRef(old).add({ type: "system", text: `${S.user}님이 방을 나갔습니다.`, createdAt: FV.serverTimestamp() }).catch(() => null);
      if (S.room?.hostUid === S.user) await assignHost(old);
      await updateCounts(old).catch(() => null);
    }
    leaveLocal();
  }
  function leaveLocal() {
    Object.values(S.unsub).forEach((fn) => typeof fn === "function" && fn());
    S.unsub = {}; S.roomId = ""; S.room = null; S.participants = []; S.messages = []; S.selected.clear();
    localStorage.removeItem("dalmutiCurrentRoomId"); setView("lobby"); watchRooms();
  }
  async function assignHost(id = S.roomId) {
    const snap = await partRef(id).get(), list = snap.docs.map((d) => d.data()).filter((p) => !p.removedFromRoom && !p.isAI);
    const next = list.sort((a, b) => (a.type !== b.type ? (a.type === "player" ? -1 : 1) : (a.seatOrder ?? 999) - (b.seatOrder ?? 999)))[0];
    if (next) await roomRef(id).set({ hostUid: next.uid, hostNickname: next.nickname, updatedAt: FV.serverTimestamp() }, { merge: true });
  }
  async function toggleReady() { const m = me(); if (m && S.room?.status === "waiting" && m.type === "player") await partRef().doc(S.user).set({ isReady: !m.isReady, updatedAt: FV.serverTimestamp() }, { merge: true }); }
  async function becomeSpectator() { if (S.room?.status !== "waiting") return; await partRef().doc(S.user).set({ type: "spectator", isReady: false, seatOrder: null, role: null, hand: [], cardCount: 0, updatedAt: FV.serverTimestamp() }, { merge: true }); await updateCounts(); }
  async function becomePlayer() { if (S.room?.status !== "waiting") return; if (players().length >= MAX_PLAYERS) return toast("최대 8명까지 참가할 수 있습니다."); await partRef().doc(S.user).set({ type: "player", isReady: false, seatOrder: players().length, updatedAt: FV.serverTimestamp() }, { merge: true }); await updateCounts(); }
  async function addAI() {
    if (!isHost() || S.room?.status !== "waiting") return;
    if (players().length >= MAX_PLAYERS) return toast("최대 8명까지 참가할 수 있습니다.");
    const n = S.participants.filter((p) => p.isAI).length + 1;
    const uid = `ai_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await partRef().doc(uid).set({ uid, nickname: `AI ${n}`, type: "player", isAI: true, isReady: true, seatOrder: players().length, role: null, score: 0, lastRoundScore: 0, lastRoundRank: null, hand: [], cardCount: 0, passed: false, finished: false, finishedRank: null, forfeited: false, removedFromRoom: false, joinedAt: FV.serverTimestamp(), updatedAt: FV.serverTimestamp() });
    await updateCounts();
  }
  async function startGame() { if (!isHost() || S.room?.status !== "waiting") return; const ps = players(); if (ps.length < 2) return toast("2명 이상 필요합니다."); if (!ps.every((p) => p.isReady || p.isAI)) return toast("아직 준비하지 않은 인원이 있습니다."); await startRound(1, true, false); }

  function hasTwoHong(hand = []) { return hand.filter((c) => c.joker || c.rank === 13).length >= 2; }
  function forceHong(hands, uid) {
    let jokers = [];
    Object.keys(hands).forEach((u) => { const keep = []; hands[u].forEach((c) => { if ((c.joker || c.rank === 13) && jokers.length < 2) jokers.push(c); else keep.push(c); }); hands[u] = keep; });
    while (jokers.length < 2) jokers.push({ id: `j-force-${jokers.length}-${Math.random().toString(36).slice(2, 8)}`, rank: 13, name: "홍길동", joker: true });
    const out = (hands[uid] || []).filter((c) => !(c.joker || c.rank === 13)).sort((a, b) => b.rank - a.rank).slice(0, 2), ids = new Set(out.map((c) => c.id));
    hands[uid] = (hands[uid] || []).filter((c) => !ids.has(c.id)).concat(jokers.slice(0, 2));
    const donors = Object.keys(hands).filter((u) => u !== uid);
    out.forEach((c, i) => { if (donors[i % donors.length]) hands[donors[i % donors.length]].push(c); });
    Object.keys(hands).forEach((u) => { hands[u] = sortHand(hands[u]); });
  }
  function makeTributePairs(ps, hands) {
    if (ps.length < 3) return [];
    const specs = ps.length === 3 ? [{ from: ps[2], to: ps[0], count: 1 }] : [{ from: ps[ps.length - 1], to: ps[0], count: 2 }, { from: ps[ps.length - 2], to: ps[1], count: 1 }];
    return specs.map((x, i) => {
      const cards = selectBestTributeCards(hands[x.from.uid], x.count), ids = new Set(cards.map((c) => c.id));
      hands[x.from.uid] = sortHand(hands[x.from.uid].filter((c) => !ids.has(c.id)));
      hands[x.to.uid] = sortHand(hands[x.to.uid].concat(cards));
      return { id: `tribute-${i}`, fromUid: x.from.uid, fromNickname: x.from.nickname, toUid: x.to.uid, toNickname: x.to.nickname, count: cards.length, cards, returned: cards.length === 0, returnedCards: [] };
    }).filter((p) => p.count > 0);
  }
  async function startRound(round, resetScore, forceRebellion) {
    let ps = players().slice().sort((a, b) => (a.lastRoundRank ?? a.seatOrder ?? 999) - (b.lastRoundRank ?? b.seatOrder ?? 999));
    const deck = makeDeck(ps.length), hands = Object.fromEntries(ps.map((p) => [p.uid, []]));
    deck.forEach((c, i) => hands[ps[i % ps.length].uid].push(c));
    Object.keys(hands).forEach((u) => { hands[u] = sortHand(hands[u]); });
    if (forceRebellion && ps.length >= 3) forceHong(hands, ps[ps.length - 1].uid);
    const lowUids = ps.length === 3 ? [ps[1]?.uid, ps[2]?.uid] : [ps[ps.length - 2]?.uid, ps[ps.length - 1]?.uid];
    const rebellionUid = round > 1 ? lowUids.find((uid) => uid && hasTwoHong(hands[uid])) : null;
    const rebellionPlayer = ps.find((p) => p.uid === rebellionUid);
    if (rebellionUid) ps = ps.slice().reverse();
    const pairs = round > 1 ? makeTributePairs(ps, hands) : [], hasTribute = pairs.some((p) => !p.returned), batch = db.batch();
    batch.set(roomRef(), { status: hasTribute ? "tributeReturn" : "playing", round, currentTurnUid: hasTribute ? null : ps[0]?.uid || null, currentSet: null, previousSet: null, finishOrder: [], turnOrder: ps.map((p) => p.uid), tribute: hasTribute ? { phase: "return", pairs, reversed: !!rebellionUid, returnStartedAt: nowTs() } : null, rebellionNotice: rebellionUid ? { uid: rebellionUid, nickname: rebellionPlayer?.nickname || "누군가", round, createdAt: nowTs() } : null, updatedAt: FV.serverTimestamp() }, { merge: true });
    ps.forEach((p, i) => { const hand = sortHand(hands[p.uid]); batch.set(partRef().doc(p.uid), { type: "player", seatOrder: i, role: roleByIndex(i, ps.length), score: resetScore ? 0 : (p.score || 0), hand, cardCount: hand.length, isReady: !!p.isAI, passed: false, finished: false, finishedRank: null, forfeited: false, lastRoundRank: resetScore ? null : p.lastRoundRank, updatedAt: FV.serverTimestamp() }, { merge: true }); });
    await batch.commit();
    await addSystem(rebellionUid ? `${rebellionPlayer?.nickname || "누군가"}님의 홍길동이 민란을 일으켰습니다.` : (hasTribute ? `${round}라운드 상납 반환을 시작합니다.` : `${round}라운드가 시작되었습니다.`));
  }
  async function nextRound(force = false) { if (isHost() && S.room?.status === "betweenRounds") await startRound((S.room.round || 0) + 1, false, force); }

  function toggleTribute(rank, group) { const pair = myTributePair(); if (!pair) return toast("반환할 차례가 아닙니다."); const cur = S.selected.get(rank) || []; if (cur.length) S.selected.delete(rank); else { const left = Math.max(0, pair.count - selectedCards().length); if (left <= 0) return toast(`${pair.count}장만 선택할 수 있습니다.`); S.selected.set(rank, group.items.slice(0, left)); } renderHand(); }
  function toggleRank(rank) {
    const mine = me(); if (!mine || mine.type !== "player") return;
    const group = groupHand(mine.hand || []).find((g) => g.rank === rank); if (!group) return;
    if (S.room?.status === "tributeReturn") return toggleTribute(rank, group);
    if (S.room?.status === "playing" && S.room.currentTurnUid === S.user && S.room.currentSet) {
      if (!isSelectableRank(group)) return toast("낼 수 없는 계급입니다.");
      S.selected.clear(); const need = S.room.currentSet.count, normals = group.items.filter((c) => !c.joker).slice(0, need), jokers = (mine.hand || []).filter((c) => c.joker).slice(0, Math.max(0, need - normals.length)); S.selected.set(rank, normals.concat(jokers)); return renderHand();
    }
    if (S.selected.has(rank)) S.selected.delete(rank);
    else if (rank === 13) S.selected.set(rank, group.items.slice());
    else { const jokers = S.selected.get(13) || []; S.selected.clear(); S.selected.set(rank, group.items.slice()); if (jokers.length) S.selected.set(13, jokers); }
    renderHand();
  }

  async function applyPlay(uid, cards) {
    const p = S.participants.find((x) => x.uid === uid), room = S.room; if (!p || !room) return;
    const combo = canPlay(cards, room); if (!combo.ok) { if (uid === S.user) toast(combo.reason); return; }
    const ids = new Set(cards.map((c) => c.id)), newHand = (p.hand || []).filter((c) => !ids.has(c.id)), order = (room.finishOrder || []).slice();
    let finishRank = p.finishedRank || null; const finished = newHand.length === 0;
    if (finished && !p.finished) { finishRank = order.length + 1; order.push({ uid, nickname: p.nickname, rank: finishRank, finishedAt: nowTs() }); }
    const remaining = players().filter((x) => x.uid !== uid && !x.finished && !x.forfeited).length + (finished ? 0 : 1);
    const set = { uid, nickname: p.nickname, effectiveRank: combo.effectiveRank, effectiveName: combo.effectiveName, count: combo.count, cards, createdAt: nowTs() };
    const batch = db.batch();
    batch.set(partRef().doc(uid), { hand: newHand, cardCount: newHand.length, passed: false, finished, finishedRank, updatedAt: FV.serverTimestamp() }, { merge: true });
    players().forEach((x) => { if (x.uid !== uid) batch.set(partRef().doc(x.uid), { passed: false }, { merge: true }); });
    if (remaining <= 1) {
      const last = players().find((x) => x.uid !== uid && !x.finished && !x.forfeited), final = order.slice();
      if (last) final.push({ uid: last.uid, nickname: last.nickname, rank: final.length + 1, finishedAt: nowTs() });
      batch.set(roomRef(), { status: "betweenRounds", currentTurnUid: null, previousSet: room.currentSet || null, currentSet: set, finishOrder: final, updatedAt: FV.serverTimestamp() }, { merge: true });
      await batch.commit(); await finishRound(final); return;
    }
    batch.set(roomRef(), { previousSet: room.currentSet || null, currentSet: set, currentTurnUid: nextActiveUidAfter(uid), finishOrder: order, updatedAt: FV.serverTimestamp() }, { merge: true });
    if (uid === S.user) S.selected.clear();
    await batch.commit();
  }
  async function playSelected() { if (S.room?.status === "tributeReturn") return returnTribute(); if (S.room?.currentTurnUid !== S.user) return; await applyPlay(S.user, selectedCards()); }
  async function returnTribute() {
    const pair = myTributePair(), mine = me(); if (!pair || !mine) return;
    const cards = selectedCards(); if (cards.length !== pair.count) return toast(`${pair.count}장을 선택해야 합니다.`);
    const ids = new Set(cards.map((c) => c.id)), myHand = (mine.hand || []).filter((c) => !ids.has(c.id)), from = S.participants.find((p) => p.uid === pair.fromUid), fromHand = sortHand([...(from?.hand || []), ...cards]);
    const pairs = (S.room.tribute?.pairs || []).map((p) => p.id === pair.id ? { ...p, returned: true, returnedCards: cards } : p), done = pairs.every((p) => p.returned), batch = db.batch();
    batch.set(partRef().doc(S.user), { hand: myHand, cardCount: myHand.length, updatedAt: FV.serverTimestamp() }, { merge: true });
    batch.set(partRef().doc(pair.fromUid), { hand: fromHand, cardCount: fromHand.length, updatedAt: FV.serverTimestamp() }, { merge: true });
    batch.set(roomRef(), { tribute: { ...(S.room.tribute || {}), pairs }, status: done ? "playing" : "tributeReturn", currentTurnUid: done ? players()[0]?.uid || null : null, updatedAt: FV.serverTimestamp() }, { merge: true });
    S.selected.clear(); await batch.commit(); if (done) await addSystem(`${S.room.round}라운드가 시작되었습니다.`);
  }
  async function passAs(uid) {
    const room = S.room, p = S.participants.find((x) => x.uid === uid); if (!room || !p || room.currentTurnUid !== uid || !room.currentSet) return;
    const active = activePlayers().map((x) => x.uid), others = active.filter((id) => id !== room.currentSet.uid), passed = new Set(players().filter((x) => x.passed).map((x) => x.uid)); passed.add(uid);
    const over = others.every((id) => passed.has(id)), batch = db.batch();
    batch.set(partRef().doc(uid), { passed: true, updatedAt: FV.serverTimestamp() }, { merge: true });
    if (over) { players().forEach((x) => batch.set(partRef().doc(x.uid), { passed: false }, { merge: true })); const starter = room.currentSet.uid, sp = players().find((x) => x.uid === starter && !x.finished && !x.forfeited); batch.set(roomRef(), { currentTurnUid: sp ? starter : nextActiveUidAfter(starter), previousSet: room.currentSet, currentSet: null, updatedAt: FV.serverTimestamp() }, { merge: true }); }
    else batch.set(roomRef(), { currentTurnUid: nextActiveUidAfter(uid), updatedAt: FV.serverTimestamp() }, { merge: true });
    await batch.commit();
  }
  async function passTurn() { await passAs(S.user); }
  async function finishRound(order) {
    const total = players().length, batch = db.batch();
    order.forEach((r, i) => { const score = total - i; batch.set(partRef().doc(r.uid), { score: FV.increment(score), lastRoundScore: score, lastRoundRank: i + 1, role: roleByIndex(i, total), seatOrder: i, finished: true, finishedRank: i + 1, updatedAt: FV.serverTimestamp() }, { merge: true }); });
    const done = S.room.totalRounds && S.room.round >= S.room.totalRounds;
    batch.set(roomRef(), { status: done ? "finished" : "betweenRounds", currentTurnUid: null, currentSet: null, previousSet: null, tribute: null, finishOrder: order, lastRoundResult: { round: S.room.round, results: order, endedAt: nowTs() }, updatedAt: FV.serverTimestamp() }, { merge: true });
    await batch.commit(); await addSystem(done ? "게임이 종료되었습니다." : `${S.room.round}라운드가 종료되었습니다.`);
  }
  async function stopGame() {
    if (!isHost()) return;
    if (!confirm("현재 게임을 중지할까요? 진행 중인 라운드, 손패, 점수, 계급 정보가 초기화되고 대기방으로 돌아갑니다.")) return;
    const batch = db.batch();
    batch.set(roomRef(), { status: "waiting", round: 0, currentTurnUid: null, currentSet: null, previousSet: null, tribute: null, finishOrder: [], lastRoundResult: null, rebellionNotice: null, updatedAt: FV.serverTimestamp() }, { merge: true });
    S.participants.forEach((p, i) => batch.set(partRef().doc(p.uid), { type: p.type === "spectator" ? "spectator" : "player", isReady: !!p.isAI, seatOrder: p.type === "spectator" ? null : i, role: null, score: 0, lastRoundScore: 0, lastRoundRank: null, hand: [], cardCount: 0, passed: false, finished: false, finishedRank: null, forfeited: false, updatedAt: FV.serverTimestamp() }, { merge: true }));
    await batch.commit(); await addSystem("방장이 게임을 중지했습니다.");
  }
  async function sendChat() {
    const text = E.chatInput.value.trim(); if (!text || !S.roomId) return;
    const mine = me(); if (mine?.type === "spectator" && S.room?.spectatorChatEnabled === false) return toast("관전자 채팅이 차단되어 있습니다.");
    E.chatInput.value = ""; await msgRef().add({ type: "chat", uid: S.user, nickname: mine?.nickname || S.user, text, createdAt: FV.serverTimestamp() });
  }
  async function saveSettings() { if (!isHost() || S.room?.status !== "waiting") return; const raw = Number($("setRounds")?.value || 5); await roomRef().set({ title: ($("setTitle")?.value || "사바나 달무티").trim(), totalRounds: raw === 0 ? null : raw, updatedAt: FV.serverTimestamp() }, { merge: true }); await addSystem("방 설정이 변경되었습니다."); }
  async function toggleSpectatorChat() { if (isHost()) await roomRef().set({ spectatorChatEnabled: S.room?.spectatorChatEnabled === false, updatedAt: FV.serverTimestamp() }, { merge: true }); }
  async function kick(uid) {
    if (!isHost() || uid === S.user) return;
    const target = S.participants.find((p) => p.uid === uid); if (!target || !confirm(`${target.nickname}님을 방에서 내보낼까요?`)) return;
    await roomRef().set({ kickNotice: { uid, nickname: target.nickname, at: nowTs() }, updatedAt: FV.serverTimestamp() }, { merge: true });
    await partRef().doc(uid).delete().catch(() => null);
    await addSystem(`${target.nickname}님이 방장에 의해 강퇴되었습니다.`); await updateCounts();
  }
  async function clearSubCollection(colRef) {
    while (true) { const snap = await colRef.limit(300).get(); if (snap.empty) return; const batch = db.batch(); snap.docs.forEach((doc) => batch.delete(doc.ref)); await batch.commit(); }
  }
  async function deleteRoom() {
    if (!canAdminRoom()) return toast("방장 또는 병풍만 방을 삭제할 수 있습니다.");
    if (!confirm("방을 완전히 삭제할까요? 참가자, 채팅, 진행 상황이 모두 삭제됩니다.")) return;
    const id = S.roomId, ref = roomRef(id);
    await clearSubCollection(ref.collection("messages"));
    await clearSubCollection(ref.collection("participants"));
    await ref.delete();
    localStorage.removeItem("dalmutiCurrentRoomId");
    alert("방이 완전히 삭제되었습니다.");
    leaveLocal();
  }

  function aiCandidateCards(ai) {
    const hand = sortHand(ai.hand || []), cur = S.room?.currentSet;
    if (!cur) return hand.filter((c) => !c.joker).slice(-1).length ? hand.filter((c) => !c.joker).slice(-1) : hand.slice(-1);
    const jokers = hand.filter((c) => c.joker), normalGroups = groupHand(hand.filter((c) => !c.joker)).sort((a, b) => b.rank - a.rank);
    for (const g of normalGroups) {
      if (g.rank < cur.effectiveRank && g.items.length + jokers.length >= cur.count) return g.items.slice(0, Math.min(g.items.length, cur.count)).concat(jokers.slice(0, Math.max(0, cur.count - g.items.length)));
    }
    return [];
  }
  function maybeRunAI() {
    if (!isHost() || S.room?.status !== "playing" || !S.room.currentTurnUid) return;
    const ai = S.participants.find((p) => p.uid === S.room.currentTurnUid && p.isAI && !p.finished && !p.forfeited);
    if (!ai) return;
    const key = `${S.roomId}:${S.room.round}:${ai.uid}:${S.room.currentSet?.uid || "new"}:${S.room.currentSet?.createdAt?.seconds || 0}`;
    if (S.aiActionKeys.has(key)) return;
    S.aiActionKeys.add(key);
    setTimeout(async () => {
      const cards = aiCandidateCards(ai);
      if (cards.length) await applyPlay(ai.uid, cards); else await passAs(ai.uid);
    }, 700);
  }

  function showHelp() {
    showModal("게임 방법", `<div class="help-section"><strong>목표</strong><br>손패를 먼저 털수록 높은 순위를 얻고, 라운드마다 승점을 얻습니다.</div><div class="help-section"><strong>제출</strong><br>같은 계급 여러 장을 낼 수 있습니다. 이미 카드가 깔려 있으면 같은 장수이면서 더 높은 계급만 낼 수 있습니다.</div><div class="help-section"><strong>상납</strong><br>2라운드부터 하위 계급자가 상위 계급자에게 좋은 카드를 자동 상납하고, 받은 사람은 같은 장수만큼 돌려줍니다.</div><div class="help-section"><strong>민란</strong><br>농민 또는 노비가 홍길동 2장을 들면 계급 순서와 상납 방향이 뒤집힙니다.</div>`);
  }
  function bindEvents() {
    E.homeBtn.onclick = () => location.href = "../";
    E.leaveRoomBtn.onclick = () => leaveRoom();
    E.createRoomBtn.onclick = createRoom;
    E.refreshRoomsBtn.onclick = watchRooms;
    E.readyBtn.onclick = toggleReady;
    E.watchBtn.onclick = becomeSpectator;
    E.joinAsPlayerBtn.onclick = becomePlayer;
    E.startBtn.onclick = startGame;
    E.nextRoundBtn.onclick = () => nextRound(false);
    E.resetGameBtn.onclick = stopGame;
    E.playBtn.onclick = playSelected;
    E.passBtn.onclick = passTurn;
    E.sendChatBtn.onclick = sendChat;
    E.chatInput.onkeydown = (e) => { if (e.key === "Enter") sendChat(); };
    E.toggleSpectatorChatBtn.onclick = toggleSpectatorChat;
  }
  async function init() {
    installCss(); collect(); ensureModals();
    S.user = String(localStorage.getItem("partyAppUser") || "").trim();
    if (!S.user) { alert("닉네임을 입력하세요."); return; }
    E.myNickname.textContent = S.user;
    renderRanks(); bindEvents(); watchRooms();
    if (S.roomId) {
      const ps = await partRef(S.roomId).doc(S.user).get().catch(() => null);
      if (ps?.exists && !ps.data().removedFromRoom) enterRoom(S.roomId); else localStorage.removeItem("dalmutiCurrentRoomId");
    }
  }

  window.Dalmuti = { joinRoom, toggleRank, saveSettings, toggleSpectatorChat, kick, deleteRoom, stopGame, addAI, nextRound: () => nextRound(false), forceRebellion: () => nextRound(true), closeModal, showHelp };
  window.addEventListener("DOMContentLoaded", init);
})();