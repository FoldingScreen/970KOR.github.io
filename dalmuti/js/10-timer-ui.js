(() => {
  const db = firebase.firestore();
  const rooms = () => db.collection("events").doc("dalmuti").collection("rooms");

  let roomId = "";
  let room = null;
  let unsub = null;
  let box = null;

  function toMs(ts) {
    return ts && typeof ts.toMillis === "function" ? ts.toMillis() : 0;
  }

  function ensureBox() {
    if (box) return box;
    box = document.createElement("div");
    box.id = "dalmutiTimerFloat";
    box.style.cssText = [
      "position:fixed",
      "left:50%",
      "top:14px",
      "transform:translateX(-50%)",
      "z-index:80",
      "display:none",
      "min-width:76px",
      "padding:8px 14px",
      "border-radius:999px",
      "border:1px solid rgba(243,210,129,.65)",
      "background:rgba(13,19,32,.94)",
      "box-shadow:0 10px 28px rgba(0,0,0,.36)",
      "color:#f3d281",
      "font-weight:900",
      "text-align:center",
      "font-size:18px",
      "letter-spacing:.02em"
    ].join(";");
    document.body.appendChild(box);
    return box;
  }

  function currentDeadline() {
    if (!room) return 0;
    if (room.status === "playing") return toMs(room.turnDeadlineAt);
    if (room.status === "tributeReturn") return toMs(room.tribute?.returnDeadlineAt);
    return 0;
  }

  function currentLabel(left) {
    if (!room) return "";
    if (room.status === "tributeReturn") return `상납 ${left}`;
    return `${left}`;
  }

  function render() {
    const el = ensureBox();
    const deadline = currentDeadline();
    if (!deadline) {
      el.style.display = "none";
      return;
    }

    const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    if (left > 5) {
      el.style.display = "none";
      return;
    }

    el.style.display = "block";
    el.textContent = currentLabel(left);
    el.style.color = left <= 2 ? "#ff8a8a" : "#f3d281";
    el.style.borderColor = left <= 2 ? "rgba(255,138,138,.75)" : "rgba(243,210,129,.65)";
  }

  function bindRoom(id) {
    if (id === roomId) return;
    if (unsub) unsub();
    roomId = id;
    room = null;
    if (!roomId) {
      render();
      return;
    }
    unsub = rooms().doc(roomId).onSnapshot((snap) => {
      room = snap.exists ? snap.data() : null;
      render();
    }, console.error);
  }

  window.addEventListener("DOMContentLoaded", () => {
    ensureBox();
    bindRoom(localStorage.getItem("dalmutiCurrentRoomId") || "");
    setInterval(() => bindRoom(localStorage.getItem("dalmutiCurrentRoomId") || ""), 1000);
    setInterval(render, 200);
  });
})();
