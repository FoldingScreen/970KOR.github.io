(() => {
  const db = firebase.firestore();
  const FV = firebase.firestore.FieldValue;
  const CARD_BASE = "./cards/";
  const rooms = () => db.collection("events").doc("dalmuti").collection("rooms");

  const RANKS = [
    { rank: 1, name: "사바나", image: "card-01-sabana.png", count: 1 },
    { rank: 2, name: "세자", image: "card-02-prince.png", count: 2 },
    { rank: 3, name: "영의정", image: "card-03-yeonguijeong.png", count: 3 },
    { rank: 4, name: "관찰사", image: "card-04-governor.png", count: 4 },
    { rank: 5, name: "암행어사", image: "card-05-amhaeng.png", count: 5 },
    { rank: 6, name: "사또", image: "card-06-satto.png", count: 6 },
    { rank: 7, name: "이방", image: "card-07-ibang.png", count: 7 },
    { rank: 8, name: "포졸", image: "card-08-pojol.png", count: 8 },
    { rank: 9, name: "선비", image: "card-09-seonbi.png", count: 9 },
    { rank: 10, name: "상인", image: "card-10-merchant.png", count: 10 },
    { rank: 11, name: "농민", image: "card-11-farmer.png", count: 11 },
    { rank: 12, name: "노비", image: "card-12-nobi.png", count: 12 },
    { rank: 13, name: "홍길동", image: "card-j-hong.png", count: 2, joker: true }
  ];

  let roomId = "";
  let room = null;
  let parts = [];
  let unsubRoom = null;
  let unsubParts = null;
  let applyingRebellionOrder = false;
  const playedTributeHandAnims = new Set();

  const myUid = () => String(localStorage.getItem("partyAppUser") || "").trim();
  const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
  const rankInfo = (rank) => RANKS.find((r) => r.rank === Number(rank)) || RANKS[RANKS.length - 1];
  const cardImg = (rank) => CARD_BASE + rankInfo(rank).image;
  const sortHand = (cards = []) => cards.slice().sort((a, b) => a.rank - b.rank || String(a.id).localeCompare(String(b.id)));
  const players = () => parts.filter((p) => p.type === "player").sort((a, b) => (a.seatOrder ?? 999) - (b.seatOrder ?? 999));
  const participantsByNick = (nick) => parts.find((p) => p.nickname === nick);

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

  function installCss() {
    if (document.getElementById("dalmutiPcReworkCss")) return;
    const style = document.createElement("style");
    style.id = "dalmutiPcReworkCss";
    style.textContent = `
      @media (min-width: 881px){
        #dalmutiTimerFloat,#dalmutiPcTimer{display:none!important;}
        .room-shell{grid-template-columns:minmax(0,1fr) 300px!important;}
        .game-panel{min-height:calc(100vh - 78px)!important;}
        .table-wrap{height:calc(100vh - 300px)!important;min-height:540px!important;max-height:620px!important;}
        .center-pile.pc-fixed,.center-pile.rework-center{width:720px!important;max-width:72%!important;min-height:360px!important;height:360px!important;padding:0!important;text-align:left!important;overflow:visible!important;}
        .rework-pile{position:relative;width:100%;height:100%;}
        .rework-prev{position:absolute;left:14px;top:14px;width:170px;min-height:118px;border:1px solid rgba(255,255,255,.09);border-radius:14px;background:rgba(0,0,0,.24);padding:10px;}
        .rework-prev-label{font-size:11px;font-weight:900;color:#aeb5c3;margin-bottom:5px;}
        .rework-prev-name{font-size:12px;font-weight:900;color:#f3d281;margin-bottom:7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .rework-current{position:absolute;left:205px;right:18px;top:20px;bottom:18px;display:flex;flex-direction:column;align-items:center;justify-content:center;}
        .rework-current-name{font-size:17px;font-weight:900;color:#f3d281;margin-bottom:14px;white-space:nowrap;}
        .rework-cards{display:flex;align-items:center;justify-content:center;min-height:90px;}
        .rework-card{object-fit:cover;border-radius:12px;box-shadow:0 12px 28px rgba(0,0,0,.42);}
        .rework-prev .rework-card{width:58px;margin-left:-42px;border-radius:8px;}
        .rework-prev .rework-card:first-child{margin-left:0;}
        .rework-current .rework-card{width:126px;margin-left:-34px;}
        .rework-current .rework-card:first-child{margin-left:0;}
        .rework-count{font-size:12px;color:#d8deea;margin-top:7px;font-weight:900;text-align:center;}
        .rework-empty{height:100%;display:flex;align-items:center;justify-content:center;color:#aeb5c3;font-weight:900;font-size:18px;}
        .hand-area{min-height:142px!important;}
        .hand-stack{width:74px!important;}
        .hand-stack img{width:74px!important;}
        .kick-btn{position:absolute;right:5px;top:5px;border:0;border-radius:999px;background:rgba(215,101,101,.92);color:#fff;font-size:10px;font-weight:900;padding:3px 6px;cursor:pointer;z-index:3;}
        .tribute-outgoing-flash{outline:3px solid rgba(243,210,129,.85);transform:translateY(-12px)!important;filter:brightness(1.18)!important;}
        #tributeDelayNotice{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:140;display:none;padding:10px 16px;border-radius:999px;background:rgba(13,19,32,.96);border:1px solid rgba(243,210,129,.55);color:#f3d281;font-weight:900;box-shadow:0 12px 30px rgba(0,0,0,.38);}
      }
    `;
    document.head.appendChild(style);
  }

  function ensureNotice() {
    let n = document.getElementById("tributeDelayNotice");
    if (!n) {
      n = document.createElement("div");
      n.id = "tributeDelayNotice";
      document.body.appendChild(n);
    }
    return n;
  }

  function showNotice(text, ms = 1800) {
    const n = ensureNotice();
    n.textContent = text;
    n.style.display = "block";
    clearTimeout(showNotice.timer);
    showNotice.timer = setTimeout(() => { n.style.display = "none"; }, ms);
  }

  function pileCardHtml(cards = [], mode = "current") {
    const list = cards || [];
    if (!list.length) return `<span class="muted">없음</span>`;
    return list.map((c) => `<img class="rework-card" src="${cardImg(c.rank)}" alt="${esc(c.name || rankInfo(c.rank).name)}">`).join("");
  }

  function setName(set, prefix) {
    if (!set) return `${prefix} 없음`;
    return `${prefix} ${rankInfo(set.effectiveRank).name} ${set.count}장`;
  }

  function renderCenterPile() {
    const el = document.getElementById("centerPile");
    if (!el || !room || room.status === "tributeReturn") return;
    const prev = room.previousSet || null;
    const cur = room.currentSet || null;
    el.classList.add("pc-fixed", "rework-center");
    if (!prev && !cur) {
      el.innerHTML = `<div class="rework-pile"><div class="rework-empty">새 판</div></div>`;
      return;
    }
    el.innerHTML = `
      <div class="rework-pile">
        <div class="rework-prev">
          <div class="rework-prev-label">직전 카드</div>
          <div class="rework-prev-name">${esc(setName(prev, "직전"))}</div>
          <div class="rework-cards">${prev ? pileCardHtml(prev.cards, "prev") : `<span class="muted">없음</span>`}</div>
          <div class="rework-count">${prev ? `${prev.count}장` : ""}</div>
        </div>
        <div class="rework-current">
          <div class="rework-current-name">${esc(setName(cur, "현재"))}</div>
          <div class="rework-cards">${cur ? pileCardHtml(cur.cards, "current") : `<span class="muted">제출 대기</span>`}</div>
          <div class="rework-count">${cur ? `${cur.count}장` : ""}</div>
        </div>
      </div>
    `;
  }

  function hideTimeoutUiAndFields() {
    const a = document.getElementById("dalmutiTimerFloat");
    const b = document.getElementById("dalmutiPcTimer");
    if (a) a.style.display = "none";
    if (b) b.style.display = "none";
  }

  async function applyRebellionOrder() {
    if (!roomId || !room || applyingRebellionOrder) return;
    if (room.status !== "tributeReturn" || !room.tribute?.reversed || room.tribute?.rebellionOrderApplied) return;
    applyingRebellionOrder = true;
    try {
      const ref = rooms().doc(roomId);
      const snap = await ref.collection("participants").get();
      const ps = snap.docs.map((doc) => ({ ref: doc.ref, ...doc.data() }))
        .filter((p) => p.type === "player")
        .sort((a, b) => (a.seatOrder ?? 999) - (b.seatOrder ?? 999))
        .reverse();
      const batch = db.batch();
      ps.forEach((p, i) => {
        batch.set(p.ref, { seatOrder: i, role: roleByIndex(i, ps.length), updatedAt: FV.serverTimestamp() }, { merge: true });
      });
      batch.set(ref, {
        turnOrder: ps.map((p) => p.uid),
        tribute: { ...room.tribute, rebellionOrderApplied: true },
        updatedAt: FV.serverTimestamp()
      }, { merge: true });
      await batch.commit();
      await ref.collection("messages").add({ type: "system", text: "민란으로 계급 순서가 뒤집혔습니다.", createdAt: FV.serverTimestamp() });
    } catch (err) {
      console.error("applyRebellionOrder failed", err);
    } finally {
      applyingRebellionOrder = false;
    }
  }

  function playerBoxByUid(uid) {
    const p = parts.find((x) => x.uid === uid);
    if (!p) return null;
    return Array.from(document.querySelectorAll(".player-box")).find((box) => box.querySelector(".player-name")?.textContent.trim() === p.nickname);
  }

  function centerOf(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function handStart() {
    const h = document.getElementById("handArea");
    if (!h) return null;
    const r = h.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function flyCard(src, start, end, delay) {
    const img = document.createElement("img");
    img.src = src;
    img.style.cssText = `position:fixed;left:${start.x - 34}px;top:${start.y - 51}px;width:68px;height:102px;object-fit:cover;border-radius:10px;z-index:155;pointer-events:none;box-shadow:0 14px 32px rgba(0,0,0,.48);transition:transform .9s cubic-bezier(.18,.85,.2,1),opacity .9s ease;`;
    document.body.appendChild(img);
    setTimeout(() => {
      img.style.transform = `translate(${end.x - start.x}px, ${end.y - start.y}px) rotate(${delay % 2 ? -7 : 7}deg) scale(.78)`;
      img.style.opacity = ".12";
    }, delay);
    setTimeout(() => img.remove(), delay + 1050);
  }

  function animateOutgoingFromHand() {
    if (!room || room.status !== "tributeReturn" || !room.tribute) return;
    const uid = myUid();
    const pairs = (room.tribute.pairs || []).filter((p) => p.fromUid === uid);
    pairs.forEach((pair) => {
      const key = `${roomId}:${room.round}:${pair.id}:outgoing-hand`;
      if (playedTributeHandAnims.has(key)) return;
      playedTributeHandAnims.add(key);
      const start = handStart();
      const toBox = playerBoxByUid(pair.toUid);
      if (!start || !toBox) return;
      const end = centerOf(toBox);
      showNotice("상납 카드 확인: 내 손패에서 상납 카드가 이동합니다.", 2200);
      (pair.cards || []).forEach((card, i) => {
        flyCard(cardImg(card.rank), { x: start.x + i * 12, y: start.y }, { x: end.x + i * 5, y: end.y }, 450 + i * 250);
      });
    });
  }

  async function kickPlayer(uid, nickname) {
    if (!roomId || !room || room.hostUid !== myUid()) return;
    if (uid === myUid()) return;
    if (!confirm(`${nickname}님을 강퇴할까요?`)) return;
    const ref = rooms().doc(roomId);
    const target = parts.find((p) => p.uid === uid);
    if (!target) return;
    if (room.status === "waiting") {
      await ref.collection("participants").doc(uid).delete();
    } else {
      await ref.collection("participants").doc(uid).set({
        type: target.type,
        forfeited: true,
        finished: true,
        hand: [],
        cardCount: 0,
        passed: false,
        kicked: true,
        updatedAt: FV.serverTimestamp()
      }, { merge: true });
      if (room.currentTurnUid === uid) {
        const next = players().filter((p) => p.uid !== uid && !p.finished && !p.forfeited)[0];
        await ref.set({ currentTurnUid: next?.uid || null, updatedAt: FV.serverTimestamp() }, { merge: true });
      }
    }
    await ref.collection("messages").add({ type: "system", text: `${nickname}님이 방장에 의해 강퇴되었습니다.`, createdAt: FV.serverTimestamp() });
  }

  function addKickButtons() {
    if (!room || room.hostUid !== myUid()) return;
    Array.from(document.querySelectorAll(".player-box")).forEach((box) => {
      const nick = box.querySelector(".player-name")?.textContent.trim();
      const p = participantsByNick(nick);
      if (!p || p.uid === myUid()) return;
      if (box.querySelector(".kick-btn")) return;
      const btn = document.createElement("button");
      btn.className = "kick-btn";
      btn.type = "button";
      btn.textContent = "강퇴";
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        kickPlayer(p.uid, p.nickname).catch(console.error);
      });
      box.appendChild(btn);
    });
  }

  function bind(id) {
    if (id === roomId) return;
    if (unsubRoom) unsubRoom();
    if (unsubParts) unsubParts();
    roomId = id;
    room = null;
    parts = [];
    if (!roomId) return;
    const ref = rooms().doc(roomId);
    unsubRoom = ref.onSnapshot((snap) => { room = snap.exists ? { id: snap.id, ...snap.data() } : null; }, console.error);
    unsubParts = ref.collection("participants").onSnapshot((snap) => { parts = snap.docs.map((d) => ({ id: d.id, ...d.data() })); }, console.error);
  }

  function tick() {
    installCss();
    bind(localStorage.getItem("dalmutiCurrentRoomId") || "");
    hideTimeoutUiAndFields();
    renderCenterPile();
    addKickButtons();
    animateOutgoingFromHand();
    applyRebellionOrder().catch(console.error);
  }

  window.addEventListener("DOMContentLoaded", () => {
    installCss();
    ensureNotice();
    setInterval(tick, 180);
  });
})();
