(() => {
  const db = firebase.firestore();
  const rooms = () => db.collection("events").doc("dalmuti").collection("rooms");

  let roomId = "";
  let room = null;
  let parts = [];
  let unsubRoom = null;
  let unsubParts = null;

  const myUid = () => String(localStorage.getItem("partyAppUser") || "").trim();

  function installCss() {
    if (document.getElementById("dalmutiStatusOnlyCss")) return;
    const style = document.createElement("style");
    style.id = "dalmutiStatusOnlyCss";
    style.textContent = `
      .player-box.submitted{border-color:#7ee2a8!important;box-shadow:0 0 0 2px rgba(126,226,168,.55),0 12px 24px rgba(0,0,0,.28)!important;}
      .player-box.passed{opacity:.8!important;border-color:#8792a7!important;background:rgba(35,39,51,.92)!important;}
      .player-box.forfeited{opacity:.45!important;filter:grayscale(.9);}
      .dalmuti-status-badge{display:inline-block;margin-top:5px;padding:3px 8px;border-radius:999px;font-size:12px;font-weight:900;}
      .dalmuti-status-badge.submit{background:rgba(126,226,168,.16);border:1px solid rgba(126,226,168,.75);color:#9ff0bd;}
      .dalmuti-status-badge.pass{background:rgba(135,146,167,.16);border:1px solid rgba(135,146,167,.75);color:#d2d8e4;}
      .dalmuti-status-badge.turn{background:rgba(243,210,129,.16);border:1px solid rgba(243,210,129,.75);color:#f3d281;}
    `;
    document.head.appendChild(style);
  }

  function decoratePlayerBoxes() {
    if (!room) return;
    const boxes = Array.from(document.querySelectorAll(".player-box"));
    boxes.forEach((box) => {
      const nameEl = box.querySelector(".player-name");
      const nickname = nameEl ? nameEl.textContent.trim() : "";
      const p = parts.find((x) => x.nickname === nickname);
      if (!p) return;
      box.classList.toggle("submitted", !!room.currentSet && room.currentSet.uid === p.uid);
      box.classList.toggle("forfeited", !!p.forfeited);
      let badge = box.querySelector(".dalmuti-status-badge");
      if (!badge) {
        badge = document.createElement("div");
        badge.className = "dalmuti-status-badge";
        box.appendChild(badge);
      }
      let text = "";
      let cls = "dalmuti-status-badge";
      if (room.currentSet && room.currentSet.uid === p.uid) { text = "제출"; cls += " submit"; }
      else if (p.passed) { text = "패스"; cls += " pass"; }
      else if (room.currentTurnUid === p.uid) { text = "차례"; cls += " turn"; }
      badge.className = cls;
      badge.textContent = text;
      badge.style.display = text ? "inline-block" : "none";
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

  window.addEventListener("DOMContentLoaded", () => {
    installCss();
    bind(localStorage.getItem("dalmutiCurrentRoomId") || "");
    setInterval(() => bind(localStorage.getItem("dalmutiCurrentRoomId") || ""), 800);
    setInterval(decoratePlayerBoxes, 300);
  });
})();
