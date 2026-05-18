(() => {
  "use strict";

  const src = "./js/00-config.js?v=20260518-turncalc1";

  const oldCode = `function nextAfter(room, uid) {
    const list = activePlayers(room);
    if (!list.length) return null;
    const idx = list.findIndex(p => p.uid === uid);
    if (idx < 0) return list[0]?.uid || null;
    return list[(idx + 1) % list.length]?.uid || list[0]?.uid || null;
  }`;

  const newCode = `function nextAfter(room, uid) {
    const players = playersMap(room);

    const order = Array.isArray(room.turnOrder) && room.turnOrder.length
      ? room.turnOrder.filter(id => players[id])
      : allPlayers(room).map(p => p.uid);

    if (!order.length) return null;

    const idx = order.indexOf(uid);

    const isAlive = id => {
      const p = players[id];
      return p && !p.finished && !p.forfeited && !p.removedFromRoom;
    };

    if (idx < 0) {
      return order.find(isAlive) || null;
    }

    for (let i = 1; i <= order.length; i++) {
      const nextUid = order[(idx + i) % order.length];
      if (isAlive(nextUid)) return nextUid;
    }

    return null;
  }`;

  fetch(src, { cache: "no-store" })
    .then(res => {
      if (!res.ok) throw new Error(`00-config load failed: ${res.status}`);
      return res.text();
    })
    .then(text => {
      if (!text.includes(oldCode)) {
        throw new Error("nextAfter 원본 함수를 찾지 못했습니다.");
      }

      const fixed = text.replace(oldCode, newCode);
      const blob = new Blob([fixed], { type: "text/javascript" });
      const script = document.createElement("script");
      script.src = URL.createObjectURL(blob);
      script.onload = () => URL.revokeObjectURL(script.src);
      document.body.appendChild(script);
    })
    .catch(err => {
      console.error("[dalmuti] 00-config-loader failed", err);
      alert("게임 스크립트 로딩에 실패했습니다. 새로고침해 주세요.");
    });
})();
