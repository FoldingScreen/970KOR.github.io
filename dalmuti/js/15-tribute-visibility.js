(() => {
  const db = firebase.firestore();
  const CARD_BASE = "./cards/";
  const CARD_BACK = "./cards/card-back.png";
  const rooms = () => db.collection("events").doc("dalmuti").collection("rooms");

  const RANKS = [
    { rank: 1, name: "사바나", image: "card-01-sabana.png" },
    { rank: 2, name: "세자", image: "card-02-prince.png" },
    { rank: 3, name: "영의정", image: "card-03-yeonguijeong.png" },
    { rank: 4, name: "관찰사", image: "card-04-governor.png" },
    { rank: 5, name: "암행어사", image: "card-05-amhaeng.png" },
    { rank: 6, name: "사또", image: "card-06-satto.png" },
    { rank: 7, name: "이방", image: "card-07-ibang.png" },
    { rank: 8, name: "포졸", image: "card-08-pojol.png" },
    { rank: 9, name: "선비", image: "card-09-seonbi.png" },
    { rank: 10, name: "상인", image: "card-10-merchant.png" },
    { rank: 11, name: "농민", image: "card-11-farmer.png" },
    { rank: 12, name: "노비", image: "card-12-nobi.png" },
    { rank: 13, name: "홍길동", image: "card-j-hong.png" }
  ];

  let roomId = "";
  let room = null;
  let unsub = null;
  const animated = new Set();

  const myUid = () => String(localStorage.getItem("partyAppUser") || "").trim();
  const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
  const rankInfo = (rank) => RANKS.find((r) => r.rank === Number(rank)) || RANKS[RANKS.length - 1];
  const cardImg = (rank) => CARD_BASE + rankInfo(rank).image;

  function installCss() {
    if (document.getElementById("dalmutiTributeVisibilityCss")) return;
    const style = document.createElement("style");
    style.id = "dalmutiTributeVisibilityCss";
    style.textContent = `
      #tributeVisibilityPanel{position:fixed;left:22px;bottom:22px;z-index:95;display:none;width:310px;max-width:calc(100vw - 44px);padding:14px;border-radius:18px;border:1px solid rgba(243,210,129,.45);background:rgba(13,19,32,.96);box-shadow:0 16px 42px rgba(0,0,0,.42);color:#f4f1e8;}
      .tribute-visibility-title{font-weight:900;color:#f3d281;margin-bottom:6px;}
      .tribute-visibility-line{font-size:13px;color:#aeb5c3;margin-bottom:8px;line-height:1.35;}
      .tribute-visibility-cards{display:flex;gap:7px;flex-wrap:wrap;margin-top:6px;}
      .tribute-visibility-cards img{width:48px;aspect-ratio:2/3;object-fit:cover;border-radius:7px;box-shadow:0 8px 18px rgba(0,0,0,.35);}
      .tribute-visibility-section{padding-top:8px;margin-top:8px;border-top:1px solid rgba(255,255,255,.08);}
      .tribute-fly-card{position:fixed;width:54px;height:81px;object-fit:cover;border-radius:8px;z-index:130;pointer-events:none;box-shadow:0 12px 28px rgba(0,0,0,.48);transition:transform .64s cubic-bezier(.2,.85,.18,1),opacity .64s ease;}
    `;
    document.head.appendChild(style);
  }

  function ensurePanel() {
    let panel = document.getElementById("tributeVisibilityPanel");
    if (panel) return panel;
    panel = document.createElement("div");
    panel.id = "tributeVisibilityPanel";
    document.body.appendChild(panel);
    return panel;
  }

  function cardList(cards = [], faceUp = true) {
    return `<div class="tribute-visibility-cards">${(cards || []).map((c) => `<img src="${faceUp ? cardImg(c.rank) : CARD_BACK}" alt="${esc(c.name || rankInfo(c.rank).name)}">`).join("")}</div>`;
  }

  function renderPanel() {
    const panel = ensurePanel();
    if (!room || room.status !== "tributeReturn" || !room.tribute) {
      panel.style.display = "none";
      panel.innerHTML = "";
      return;
    }

    const uid = myUid();
    const pairs = room.tribute.pairs || [];
    const outgoing = pairs.filter((p) => p.fromUid === uid);
    const incoming = pairs.filter((p) => p.toUid === uid);

    if (!outgoing.length && !incoming.length) {
      panel.style.display = "none";
      panel.innerHTML = "";
      return;
    }

    const chunks = [];
    outgoing.forEach((p) => {
      chunks.push(`
        <div class="tribute-visibility-section">
          <div class="tribute-visibility-title">내가 상납한 카드</div>
          <div class="tribute-visibility-line">${esc(p.toNickname)}님에게 ${p.count}장 상납</div>
          ${cardList(p.cards || [], true)}
        </div>
      `);
    });
    incoming.forEach((p) => {
      chunks.push(`
        <div class="tribute-visibility-section">
          <div class="tribute-visibility-title">상납받은 카드</div>
          <div class="tribute-visibility-line">${esc(p.fromNickname)}님에게서 ${p.count}장 받음 · 돌려줄 카드 ${p.count}장 선택</div>
          ${cardList(p.cards || [], true)}
        </div>
      `);
    });

    panel.innerHTML = chunks.join("");
    panel.style.display = "block";
  }

  function playerBoxByNickname(nickname) {
    return Array.from(document.querySelectorAll(".player-box")).find((box) => {
      const name = box.querySelector(".player-name");
      return name && name.textContent.trim() === String(nickname || "").trim();
    });
  }

  function centerOf(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function makeFly(src, start, end, delay, faceUp) {
    const img = document.createElement("img");
    img.className = "tribute-fly-card";
    img.src = faceUp ? src : CARD_BACK;
    img.style.left = `${start.x - 27}px`;
    img.style.top = `${start.y - 40}px`;
    img.style.opacity = "1";
    document.body.appendChild(img);
    requestAnimationFrame(() => {
      setTimeout(() => {
        img.style.transform = `translate(${end.x - start.x}px, ${end.y - start.y}px) rotate(${delay % 2 ? -8 : 8}deg) scale(.9)`;
        img.style.opacity = ".18";
      }, delay);
    });
    setTimeout(() => img.remove(), delay + 760);
  }

  function animatePair(pair) {
    const fromBox = playerBoxByNickname(pair.fromNickname);
    const toBox = playerBoxByNickname(pair.toNickname);
    if (!fromBox || !toBox) return;
    const start = centerOf(fromBox);
    const end = centerOf(toBox);
    const uid = myUid();
    const shouldReveal = pair.fromUid === uid || pair.toUid === uid;
    (pair.cards || Array.from({ length: pair.count || 1 })).forEach((card, i) => {
      const src = card?.rank ? cardImg(card.rank) : CARD_BACK;
      makeFly(src, { x: start.x + i * 7, y: start.y + i * 4 }, { x: end.x + i * 5, y: end.y - i * 3 }, i * 180, shouldReveal);
    });
  }

  function animateReturn(pair) {
    const fromBox = playerBoxByNickname(pair.toNickname);
    const toBox = playerBoxByNickname(pair.fromNickname);
    if (!fromBox || !toBox) return;
    const start = centerOf(fromBox);
    const end = centerOf(toBox);
    const uid = myUid();
    const shouldReveal = pair.fromUid === uid || pair.toUid === uid;
    (pair.returnedCards || Array.from({ length: pair.count || 1 })).forEach((card, i) => {
      const src = card?.rank ? cardImg(card.rank) : CARD_BACK;
      makeFly(src, { x: start.x + i * 7, y: start.y }, { x: end.x + i * 5, y: end.y }, i * 180, shouldReveal);
    });
  }

  function runAnimations() {
    if (!room || room.status !== "tributeReturn" || !room.tribute) return;
    const keyBase = `${roomId}:${room.round || 0}`;
    (room.tribute.pairs || []).forEach((pair) => {
      const sendKey = `${keyBase}:${pair.id}:send`;
      if (!animated.has(sendKey)) {
        animated.add(sendKey);
        setTimeout(() => animatePair(pair), 250);
      }
      const returnKey = `${keyBase}:${pair.id}:return`;
      if (pair.returned && !animated.has(returnKey)) {
        animated.add(returnKey);
        setTimeout(() => animateReturn(pair), 180);
      }
    });
  }

  function bind(id) {
    if (id === roomId) return;
    if (unsub) unsub();
    roomId = id;
    room = null;
    renderPanel();
    if (!roomId) return;
    unsub = rooms().doc(roomId).onSnapshot((snap) => {
      room = snap.exists ? { id: snap.id, ...snap.data() } : null;
      renderPanel();
      setTimeout(runAnimations, 120);
    }, console.error);
  }

  window.addEventListener("DOMContentLoaded", () => {
    installCss();
    ensurePanel();
    bind(localStorage.getItem("dalmutiCurrentRoomId") || "");
    setInterval(() => bind(localStorage.getItem("dalmutiCurrentRoomId") || ""), 700);
    setInterval(() => {
      renderPanel();
      runAnimations();
    }, 600);
  });
})();
