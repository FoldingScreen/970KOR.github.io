(() => {
  const db = firebase.firestore();
  const CARD_BACK = "./cards/card-back.png";
  const rooms = () => db.collection("events").doc("dalmuti").collection("rooms");

  let roomId = "";
  let room = null;
  let parts = [];
  let unsubRoom = null;
  let unsubParts = null;
  const playedTributes = new Set();
  const playedReceives = new Set();

  function players() {
    return parts.filter((p) => p.type === "player").sort((a, b) => (a.seatOrder ?? 999) - (b.seatOrder ?? 999));
  }

  function uidToPlayerIndex(uid) {
    return players().findIndex((p) => p.uid === uid);
  }

  function playerBoxes() {
    return Array.from(document.querySelectorAll(".player-box"));
  }

  function centerOf(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function handTarget() {
    const hand = document.getElementById("handArea");
    if (!hand) return null;
    const r = hand.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + 20 };
  }

  function makeFlyCard(src, start, end, delay, faceDown = true) {
    const img = document.createElement("img");
    img.src = faceDown ? CARD_BACK : src;
    img.alt = "card";
    img.style.cssText = [
      "position:fixed",
      `left:${start.x - 24}px`,
      `top:${start.y - 36}px`,
      "width:48px",
      "height:72px",
      "object-fit:cover",
      "border-radius:8px",
      "z-index:120",
      "pointer-events:none",
      "box-shadow:0 10px 24px rgba(0,0,0,.45)",
      "transition:transform .52s cubic-bezier(.2,.85,.2,1), opacity .52s ease",
      "opacity:1"
    ].join(";");
    document.body.appendChild(img);

    requestAnimationFrame(() => {
      setTimeout(() => {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        img.style.transform = `translate(${dx}px, ${dy}px) rotate(${delay % 2 ? -9 : 9}deg) scale(.86)`;
        img.style.opacity = "0.15";
      }, delay);
    });
    setTimeout(() => img.remove(), delay + 620);
  }

  function pulseMyHand() {
    const hand = document.getElementById("handArea");
    if (!hand) return;
    hand.animate([
      { transform: "translateY(-4px)", filter: "brightness(1.18)" },
      { transform: "translateY(0)", filter: "brightness(1)" }
    ], { duration: 420, easing: "ease-out" });
  }

  function animateTributePair(pair) {
    const boxes = playerBoxes();
    const fromIndex = uidToPlayerIndex(pair.fromUid);
    const toIndex = uidToPlayerIndex(pair.toUid);
    const fromBox = boxes[fromIndex];
    const toBox = boxes[toIndex];
    if (!fromBox || !toBox) return;

    const start = centerOf(fromBox);
    const end = centerOf(toBox);
    const count = Math.max(1, Number(pair.count || 1));
    for (let i = 0; i < count; i += 1) {
      makeFlyCard(CARD_BACK, { x: start.x + i * 6, y: start.y + i * 4 }, { x: end.x + i * 4, y: end.y - i * 3 }, i * 210, true);
    }
  }

  function animateReceive(pair) {
    const myUid = localStorage.getItem("partyAppUser") || "";
    if (pair.toUid !== myUid) return;
    const target = handTarget();
    const boxes = playerBoxes();
    const fromBox = boxes[uidToPlayerIndex(pair.fromUid)];
    if (!target || !fromBox) return;
    const start = centerOf(fromBox);
    for (let i = 0; i < Math.max(1, Number(pair.count || 1)); i += 1) {
      makeFlyCard(CARD_BACK, { x: start.x + i * 6, y: start.y }, { x: target.x + i * 8, y: target.y }, i * 140, true);
    }
    setTimeout(pulseMyHand, 620);
  }

  function runAnimations() {
    if (!room || room.status !== "tributeReturn" || !room.tribute) return;
    const round = room.round || 0;
    const pairs = room.tribute.pairs || [];
    pairs.forEach((pair) => {
      const key = `${roomId}:${round}:${pair.id}:send:${pair.fromUid}:${pair.toUid}`;
      if (!playedTributes.has(key)) {
        playedTributes.add(key);
        setTimeout(() => animateTributePair(pair), 150);
        setTimeout(() => animateReceive(pair), 150);
      }

      if (pair.returned) {
        const rkey = `${roomId}:${round}:${pair.id}:return:${pair.toUid}:${pair.fromUid}`;
        if (!playedReceives.has(rkey)) {
          playedReceives.add(rkey);
          setTimeout(() => {
            const boxes = playerBoxes();
            const fromBox = boxes[uidToPlayerIndex(pair.toUid)];
            const toBox = boxes[uidToPlayerIndex(pair.fromUid)];
            if (!fromBox || !toBox) return;
            const start = centerOf(fromBox);
            const end = centerOf(toBox);
            (pair.returnedCards || []).forEach((_, i) => makeFlyCard(CARD_BACK, { x: start.x + i * 6, y: start.y }, { x: end.x + i * 6, y: end.y }, i * 180, true));
          }, 120);
        }
      }
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
    unsubRoom = ref.onSnapshot((snap) => {
      room = snap.exists ? { id: snap.id, ...snap.data() } : null;
      setTimeout(runAnimations, 80);
    }, console.error);
    unsubParts = ref.collection("participants").onSnapshot((snap) => {
      parts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTimeout(runAnimations, 80);
    }, console.error);
  }

  window.addEventListener("DOMContentLoaded", () => {
    bind(localStorage.getItem("dalmutiCurrentRoomId") || "");
    setInterval(() => bind(localStorage.getItem("dalmutiCurrentRoomId") || ""), 1000);
  });
})();
