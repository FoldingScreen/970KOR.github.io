(() => {
  const db = firebase.firestore();
  const FV = firebase.firestore.FieldValue;
  const rooms = () => db.collection("events").doc("dalmuti").collection("rooms");

  let roomId = "";
  let room = null;
  let unsub = null;
  let closeBtn = null;
  let patching = false;

  const myUid = () => String(localStorage.getItem("partyAppUser") || "").trim();

  function ensureCloseButton() {
    if (closeBtn) return closeBtn;
    closeBtn = document.createElement("button");
    closeBtn.id = "deleteRoomBtn";
    closeBtn.className = "btn danger hidden";
    closeBtn.type = "button";
    closeBtn.textContent = "방 삭제";

    const between = document.getElementById("betweenControls");
    const lobby = document.getElementById("lobbyControls");
    if (between) between.appendChild(closeBtn);
    else if (lobby) lobby.appendChild(closeBtn);
    else document.body.appendChild(closeBtn);

    closeBtn.addEventListener("click", () => closeCurrentRoom().catch(console.error));
    return closeBtn;
  }

  function updateButton() {
    const btn = ensureCloseButton();
    const show = !!roomId && !!room && room.hostUid === myUid() && room.status !== "closed";
    btn.classList.toggle("hidden", !show);
  }

  async function closeCurrentRoom() {
    if (!roomId || !room) return;
    if (room.hostUid !== myUid()) {
      alert("방장만 방을 삭제할 수 있습니다.");
      return;
    }
    if (!confirm("방을 삭제하면 이 방은 더 이상 입장할 수 없습니다. 삭제할까요?")) return;

    await rooms().doc(roomId).set({
      status: "closed",
      closed: true,
      closedAt: FV.serverTimestamp(),
      updatedAt: FV.serverTimestamp()
    }, { merge: true });

    await rooms().doc(roomId).collection("messages").add({
      type: "system",
      text: "방장이 방을 삭제했습니다.",
      createdAt: FV.serverTimestamp()
    }).catch(() => null);

    localStorage.removeItem("dalmutiCurrentRoomId");
    alert("방이 삭제되었습니다.");
    location.reload();
  }

  async function assignHostIfNeeded() {
    if (!roomId || !room || room.status === "closed") return;
    const ref = rooms().doc(roomId);
    const snap = await ref.collection("participants").get();
    const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (!list.length) {
      await ref.set({ status: "closed", closed: true, updatedAt: FV.serverTimestamp() }, { merge: true });
      return;
    }
    if (list.some((p) => p.uid === room.hostUid)) return;

    const next = list.sort((a, b) => {
      if (a.type !== b.type) return a.type === "player" ? -1 : 1;
      return (a.seatOrder ?? 999) - (b.seatOrder ?? 999);
    })[0];
    if (!next) return;
    await ref.set({ hostUid: next.uid, hostNickname: next.nickname, updatedAt: FV.serverTimestamp() }, { merge: true });
    await ref.collection("messages").add({
      type: "system",
      text: `${next.nickname}님에게 방장이 위임되었습니다.`,
      createdAt: FV.serverTimestamp()
    }).catch(() => null);
  }

  async function leavePreviousRoom(newId) {
    const oldId = localStorage.getItem("dalmutiCurrentRoomId") || "";
    const uid = myUid();
    if (!oldId || !newId || oldId === newId || !uid || patching) return;
    patching = true;
    try {
      const oldRef = rooms().doc(oldId);
      const oldSnap = await oldRef.get();
      if (oldSnap.exists) {
        await oldRef.collection("participants").doc(uid).delete().catch(() => null);
        await oldRef.collection("messages").add({
          type: "system",
          text: `${uid}님이 다른 방으로 이동했습니다.`,
          createdAt: FV.serverTimestamp()
        }).catch(() => null);
      }
    } finally {
      patching = false;
    }
  }

  function patchJoinRoom() {
    if (!window.Dalmuti || !window.Dalmuti.joinRoom || window.Dalmuti.__roomAdminPatched) return;
    const original = window.Dalmuti.joinRoom;
    window.Dalmuti.joinRoom = async function patchedJoinRoom(id) {
      const rs = await rooms().doc(id).get();
      if (!rs.exists || rs.data().status === "closed" || rs.data().closed) {
        alert("삭제된 방입니다.");
        return;
      }
      await leavePreviousRoom(id);
      localStorage.setItem("dalmutiCurrentRoomId", id);
      return original(id);
    };
    window.Dalmuti.__roomAdminPatched = true;
  }

  function hideClosedRoomsInList() {
    const list = document.getElementById("roomList");
    if (!list) return;
    const buttons = Array.from(list.querySelectorAll("button[onclick^=\"Dalmuti.joinRoom\"]"));
    buttons.forEach(async (btn) => {
      const onclick = btn.getAttribute("onclick") || "";
      const match = onclick.match(/Dalmuti\.joinRoom\('([^']+)'\)/);
      if (!match) return;
      const id = match[1];
      const rs = await rooms().doc(id).get().catch(() => null);
      if (!rs || !rs.exists) return;
      const data = rs.data();
      if (data.status === "closed" || data.closed) {
        const item = btn.closest(".room-item");
        if (item) item.remove();
      }
    });
  }

  function bind(id) {
    if (id === roomId) return;
    if (unsub) unsub();
    roomId = id;
    room = null;
    updateButton();
    if (!roomId) return;
    unsub = rooms().doc(roomId).onSnapshot((snap) => {
      if (!snap.exists) return;
      room = { id: snap.id, ...snap.data() };
      if (room.status === "closed" || room.closed) {
        if (localStorage.getItem("dalmutiCurrentRoomId") === roomId) {
          localStorage.removeItem("dalmutiCurrentRoomId");
          alert("방이 삭제되었습니다.");
          location.reload();
        }
        return;
      }
      updateButton();
      assignHostIfNeeded().catch(console.error);
    }, console.error);
  }

  window.addEventListener("DOMContentLoaded", () => {
    ensureCloseButton();
    patchJoinRoom();
    bind(localStorage.getItem("dalmutiCurrentRoomId") || "");
    setInterval(() => {
      patchJoinRoom();
      bind(localStorage.getItem("dalmutiCurrentRoomId") || "");
      hideClosedRoomsInList();
    }, 800);
  });
})();
