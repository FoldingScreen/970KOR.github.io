(() => {
  "use strict";

  if (!window.firebase || !firebase.apps.length) return;

  const db = firebase.firestore();
  const FV = firebase.firestore.FieldValue;
  const EVENT_ID = "dalmuti";
  const CHAT_LIMIT = 12;

  const state = {
    roomId: "",
    pairId: "",
    required: 0,
    counts: new Map(),
    busy: false
  };

  const roomId = () => String(localStorage.getItem("dalmutiCurrentRoomId") || "").trim();
  const uid = () => String(localStorage.getItem("partyAppUser") || "").trim();
  const roomRef = id => db.collection("events").doc(EVENT_ID).collection("rooms").doc(id);
  const handRef = (rid, user) => roomRef(rid).collection("hands").doc(user);
  const cleanMap = obj => Object.fromEntries(Object.entries(obj || {}).filter(([, v]) => v && typeof v === "object"));
  const sortHand = hand => (hand || []).slice().sort((a, b) => Number(a.rank) - Number(b.rank) || String(a.id).localeCompare(String(b.id)));
  const groupHand = hand => {
    const map = new Map();
    sortHand(hand).forEach(card => {
      const rank = Number(card.rank);
      if (!map.has(rank)) map.set(rank, []);
      map.get(rank).push(card);
    });
    return map;
  };

  function isReturnUi() {
    const playText = String(document.getElementById("playBtn")?.textContent || "");
    const summaryText = String(document.getElementById("selectedSummary")?.textContent || "");
    const messageText = String(document.getElementById("messageBar")?.textContent || "");
    return playText.includes("반환") || summaryText.includes("반환") || messageText.includes("반환");
  }

  function rankFromStack(stack) {
    const onclick = String(stack?.getAttribute("onclick") || "");
    const match = onclick.match(/toggleRank\((\d+)\)/);
    return match ? Number(match[1]) : null;
  }

  async function currentPair() {
    const rid = roomId();
    const user = uid();
    if (!rid || !user) return null;

    const snap = await roomRef(rid).get();
    if (!snap.exists) return null;
    const room = snap.data() || {};
    if (room.status !== "tributeReturn") return null;

    const pair = (room.tribute?.pairs || []).find(p => p.toUid === user && !p.returned);
    if (!pair) return null;

    if (state.roomId !== rid || state.pairId !== pair.id) {
      state.roomId = rid;
      state.pairId = pair.id;
      state.required = Number(pair.count || 0);
      state.counts.clear();
    }

    return { rid, user, room, pair };
  }

  function selectedTotal() {
    return Array.from(state.counts.values()).reduce((sum, n) => sum + Number(n || 0), 0);
  }

  function setStackSelected(stack, count) {
    stack.classList.toggle("selected", count > 0);
    let marker = stack.querySelector(".stack-selected");
    if (count > 0) {
      if (!marker) {
        marker = document.createElement("span");
        marker.className = "stack-selected";
        stack.insertBefore(marker, stack.firstChild);
      }
      marker.textContent = String(count);
    } else if (marker) {
      marker.remove();
    }
  }

  function applySelectionToDom() {
    if (!isReturnUi()) return;

    document.querySelectorAll(".hand-stack").forEach(stack => {
      const rank = rankFromStack(stack);
      if (!rank) return;
      setStackSelected(stack, Number(state.counts.get(rank) || 0));
    });

    const summary = document.getElementById("selectedSummary");
    if (summary && state.required) summary.textContent = `${selectedTotal()}/${state.required}장 반환 선택`;
  }

  async function onStackClick(event, stack) {
    if (!isReturnUi()) return;
    const rank = rankFromStack(stack);
    if (!rank) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const ctx = await currentPair();
    if (!ctx) return;

    const handSnap = await handRef(ctx.rid, ctx.user).get();
    const hand = sortHand(handSnap.exists ? (handSnap.data().hand || []) : []);
    const groups = groupHand(hand);
    const group = groups.get(rank) || [];
    if (!group.length) return;

    const cur = Number(state.counts.get(rank) || 0);
    const total = selectedTotal();

    if (total < state.required && cur < group.length) {
      state.counts.set(rank, cur + 1);
    } else if (cur > 0) {
      const next = cur - 1;
      if (next > 0) state.counts.set(rank, next);
      else state.counts.delete(rank);
    } else {
      alert(`${state.required}장만 선택할 수 있습니다.`);
    }

    applySelectionToDom();
  }

  function selectedCardsFromHand(hand) {
    const groups = groupHand(hand);
    const cards = [];
    state.counts.forEach((count, rank) => {
      cards.push(...(groups.get(Number(rank)) || []).slice(0, Number(count || 0)));
    });
    return cards;
  }

  async function appendSystem(ref, room, text) {
    const chat = Array.isArray(room.chatPreview) ? room.chatPreview.slice(-CHAT_LIMIT + 1) : [];
    chat.push({ type: "system", uid: "system", nickname: "", text, createdAt: Date.now() });
    await ref.set({ chatPreview: chat, updatedAt: FV.serverTimestamp() }, { merge: true });
  }

  async function submitReturn() {
    if (state.busy) return;
    state.busy = true;

    try {
      const ctx = await currentPair();
      if (!ctx) return;

      const toSnap = await handRef(ctx.rid, ctx.user).get();
      const toHand = sortHand(toSnap.exists ? (toSnap.data().hand || []) : []);
      const returnCards = selectedCardsFromHand(toHand);

      if (returnCards.length !== Number(ctx.pair.count || 0)) {
        alert(`${ctx.pair.count}장을 선택해야 합니다.`);
        return;
      }

      const fromSnap = await handRef(ctx.rid, ctx.pair.fromUid).get();
      const fromHand = sortHand(fromSnap.exists ? (fromSnap.data().hand || []) : []);
      const returnIds = new Set(returnCards.map(c => c.id));
      const newToHand = sortHand(toHand.filter(c => !returnIds.has(c.id)));
      const newFromHand = sortHand(fromHand.concat(returnCards));

      const pairs = (ctx.room.tribute?.pairs || []).map(p => {
        if (p.id !== ctx.pair.id) return p;
        return { ...p, returned: true, returnedCards: returnCards };
      });
      const done = pairs.every(p => p.returned);
      const nextPair = pairs.find(p => !p.returned) || null;

      const players = cleanMap(ctx.room.players);
      if (players[ctx.user]) players[ctx.user] = { ...players[ctx.user], cardCount: newToHand.length };
      if (players[ctx.pair.fromUid]) players[ctx.pair.fromUid] = { ...players[ctx.pair.fromUid], cardCount: newFromHand.length };

      const first = Object.values(players)
        .filter(p => p && p.uid && !p.removedFromRoom)
        .sort((a, b) => (a.seatOrder ?? 999) - (b.seatOrder ?? 999))[0]?.uid || null;

      const ref = roomRef(ctx.rid);
      const batch = db.batch();
      batch.set(handRef(ctx.rid, ctx.user), { hand: newToHand });
      batch.set(handRef(ctx.rid, ctx.pair.fromUid), { hand: newFromHand });
      batch.set(ref, {
        players,
        tribute: { ...(ctx.room.tribute || {}), pairs },
        status: done ? "playing" : "tributeReturn",
        currentTurnUid: done ? first : nextPair.toUid,
        updatedAt: FV.serverTimestamp()
      }, { merge: true });
      await batch.commit();

      state.counts.clear();
      applySelectionToDom();

      if (done) await appendSystem(ref, ctx.room, `${ctx.room.round}라운드가 시작되었습니다.`);
    } finally {
      state.busy = false;
    }
  }

  function bind() {
    if (document.__dalmutiTributeIndividualBound) return;
    document.__dalmutiTributeIndividualBound = true;

    document.addEventListener("click", event => {
      const stack = event.target.closest?.(".hand-stack");
      if (stack && isReturnUi()) {
        onStackClick(event, stack).catch(console.error);
        return;
      }

      const play = event.target.closest?.("#playBtn");
      if (play && isReturnUi()) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        submitReturn().catch(console.error);
      }
    }, true);
  }

  function init() {
    bind();
    applySelectionToDom();
    const observer = new MutationObserver(applySelectionToDom);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class"] });
  }

  if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", init);
  else init();
})();
