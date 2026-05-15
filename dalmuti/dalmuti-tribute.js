// dalmuti-tribute.js
// 상납 단계 패치: 기본 dalmuti.js 로드 이후 실행됩니다.

function tributePower(card) {
  return card.rank === 0 ? 99 : card.rank;
}

function bestCards(cards = [], count = 1) {
  return cards.slice().sort((a, b) => tributePower(a) - tributePower(b)).slice(0, count);
}

function tributePairKey(pair) {
  return `${pair.from}__${pair.to}__${pair.count}`;
}

function buildTributePairs(players, reversed) {
  const list = players.slice().sort((a, b) => (a.seat || 0) - (b.seat || 0));
  if (list.length < 2) return [];

  const pairs = [];
  const top = list[0];
  const second = list[1];
  const bottom = list[list.length - 1];
  const secondBottom = list[list.length - 2];

  if (top && bottom && top.nickname !== bottom.nickname) {
    pairs.push(reversed
      ? { from: top.nickname, to: bottom.nickname, count: 2, label: "민란 상납" }
      : { from: bottom.nickname, to: top.nickname, count: 2, label: "상납" });
  }

  if (list.length >= 4 && second && secondBottom && second.nickname !== secondBottom.nickname) {
    pairs.push(reversed
      ? { from: second.nickname, to: secondBottom.nickname, count: 1, label: "민란 상납" }
      : { from: secondBottom.nickname, to: second.nickname, count: 1, label: "상납" });
  }

  return pairs;
}

function applyAutoTribute(hands, pairs) {
  const given = [];

  pairs.forEach(pair => {
    const fromHand = hands[pair.from] || [];
    const cards = bestCards(fromHand, pair.count);
    const ids = new Set(cards.map(c => c.id));

    hands[pair.from] = fromHand.filter(c => !ids.has(c.id));
    hands[pair.to] = sortCards([...(hands[pair.to] || []), ...cards]);

    given.push({
      key: tributePairKey(pair),
      from: pair.from,
      to: pair.to,
      count: pair.count,
      cards,
      returned: false,
      label: pair.label
    });
  });

  return given;
}

async function patchedStartGame() {
  if (!isHost() || room.status !== "waiting") return;

  const players = getPlayers();
  if (players.length < 2) return showToast("2명 이상 필요합니다.");
  if (!players.every(p => p.ready || p.nickname === room.host)) return showToast("아직 준비하지 않은 인원이 있습니다.");

  const deck = makeDeck();
  const hands = {};
  players.forEach(p => hands[p.nickname] = []);
  deck.forEach((card, i) => hands[players[i % players.length].nickname].push(card));
  players.forEach(p => hands[p.nickname] = sortCards(hands[p.nickname]));

  const hasPreviousOrder = (room.round || 1) > 1 && players.length >= 2;
  const reversed = !!room.tributeReversed;
  const pairs = hasPreviousOrder ? buildTributePairs(players, reversed) : [];
  const given = pairs.length ? applyAutoTribute(hands, pairs) : [];
  const needsReturn = given.length > 0;

  const patch = {
    status: needsReturn ? "tribute" : "playing",
    currentTurn: needsReturn ? "" : players[0].nickname,
    currentCombo: null,
    lastPlayedBy: "",
    lastPlayedCards: [],
    passes: [],
    finishOrder: [],
    tribute: needsReturn ? {
      reversed,
      given,
      completed: false
    } : null,
    updatedAt: FV.serverTimestamp()
  };

  players.forEach((p, i) => {
    const hand = sortCards(hands[p.nickname]);
    patch[`players.${p.nickname}.hand`] = hand;
    patch[`players.${p.nickname}.cardCount`] = hand.length;
    patch[`players.${p.nickname}.finished`] = false;
    patch[`players.${p.nickname}.finishRank`] = null;
    patch[`players.${p.nickname}.ready`] = false;
    patch[`players.${p.nickname}.role`] = p.role || ROLE_NAMES[i] || `${i + 1}등`;
  });

  await roomRef().set(patch, { merge: true });

  if (needsReturn) {
    const lines = given.map(g => `${g.from} → ${g.to} ${g.count}장`).join(" / ");
    await addLog(`${room.round || 1}판 상납이 진행됩니다. ${reversed ? "민란 판: " : ""}${lines}`);
  } else {
    await addLog(`${room.round || 1}판이 시작되었습니다.`);
  }
}

function myTributeReturnTask() {
  const tribute = room?.tribute;
  if (!tribute || room.status !== "tribute") return null;
  return (tribute.given || []).find(g => g.to === linkedUser && !g.returned) || null;
}

function allTributeReturned(tribute) {
  return (tribute?.given || []).every(g => g.returned);
}

async function submitTributeReturn() {
  if (!room || room.status !== "tribute") return;
  const task = myTributeReturnTask();
  if (!task) return showToast("지금 돌려줄 카드가 없습니다.");

  const mine = me();
  const cards = selectedCards();
  if (cards.length !== task.count) return showToast(`${task.count}장을 선택해서 돌려줘야 합니다.`);

  const ids = new Set(cards.map(c => c.id));
  const myHand = (mine.hand || []).filter(c => !ids.has(c.id));
  const targetHand = sortCards([...(room.players?.[task.from]?.hand || []), ...cards]);
  const tribute = JSON.parse(JSON.stringify(room.tribute || {}));
  tribute.given = (tribute.given || []).map(g => {
    if (g.key === task.key) return { ...g, returned: true, returnedCards: cards };
    return g;
  });

  const done = allTributeReturned(tribute);
  const firstPlayer = getPlayers()[0]?.nickname || linkedUser;
  const patch = {
    tribute,
    [`players.${linkedUser}.hand`]: sortCards(myHand),
    [`players.${linkedUser}.cardCount`]: myHand.length,
    [`players.${task.from}.hand`]: targetHand,
    [`players.${task.from}.cardCount`]: targetHand.length,
    updatedAt: FV.serverTimestamp()
  };

  if (done) {
    patch.status = "playing";
    patch.currentTurn = firstPlayer;
    patch["tribute.completed"] = true;
  }

  selectedCardIds.clear();
  await roomRef().set(patch, { merge: true });
  await addLog(`${linkedUser}님이 ${task.from}님에게 ${task.count}장을 돌려줬습니다.`);

  if (done) {
    await addLog(`상납이 완료되었습니다. ${firstPlayer}님이 첫 판을 시작합니다.`);
  }
}

async function patchedNextRound() {
  if (!isHost() || room.status !== "roundEnd") return;

  const order = room.finishOrder || [];
  const players = order.map((name, i) => ({
    ...(room.players[name] || { nickname: name }),
    nickname: name,
    seat: i + 1,
    role: ROLE_NAMES[i] || `${i + 1}등`
  }));

  const patch = {
    status: "waiting",
    round: (room.round || 1) + 1,
    order,
    tributeReversed: !!room.revolution,
    revolution: false,
    tribute: null,
    updatedAt: FV.serverTimestamp()
  };

  players.forEach((p, i) => {
    patch[`players.${p.nickname}.seat`] = i + 1;
    patch[`players.${p.nickname}.role`] = ROLE_NAMES[i] || `${i + 1}등`;
    patch[`players.${p.nickname}.ready`] = p.nickname === room.host;
    patch[`players.${p.nickname}.hand`] = [];
    patch[`players.${p.nickname}.cardCount`] = 0;
    patch[`players.${p.nickname}.finished`] = false;
    patch[`players.${p.nickname}.finishRank`] = null;
  });

  await roomRef().set(patch, { merge: true });
  await addLog(`다음 판 대기 상태가 되었습니다. ${room.revolution ? "홍길동 출현으로 다음 판은 민란 상납입니다." : ""}`);
}

const originalMessageText = messageText;
messageText = function patchedMessageText() {
  if (room?.status === "tribute") {
    const task = myTributeReturnTask();
    if (task) return `상납 단계입니다. ${task.from}님에게 돌려줄 카드 ${task.count}장을 선택하세요.`;
    const pending = (room.tribute?.given || []).filter(g => !g.returned).map(g => g.to);
    if (pending.length) return `상납 단계입니다. ${pending.join(", ")}님이 돌려줄 카드를 고르는 중입니다.`;
    return "상납 정리 중입니다.";
  }
  return originalMessageText();
};

const originalRenderCombo = renderCombo;
renderCombo = function patchedRenderCombo() {
  if (room?.status !== "tribute") return originalRenderCombo();

  const tribute = room.tribute || {};
  const given = tribute.given || [];
  const rows = given.map(g => {
    const autoCards = (g.cards || []).map(c => cardHtml(c, false)).join("");
    const returnedCards = (g.returnedCards || []).map(c => cardHtml(c, false)).join("");
    return `
      <div style="margin:8px 0 12px;">
        <strong>${escapeHtml(g.from)} → ${escapeHtml(g.to)} ${g.count}장 ${g.returned ? "완료" : "대기"}</strong>
        <div class="small">자동 상납 카드</div>
        <div class="played-cards">${autoCards}</div>
        ${g.returnedCards ? `<div class="small">돌려준 카드</div><div class="played-cards">${returnedCards}</div>` : ""}
      </div>`;
  }).join("");

  els.currentComboBox.innerHTML = `<strong>${tribute.reversed ? "민란 상납" : "상납"} 단계</strong><div class="small">하위 계급의 가장 좋은 카드는 자동 상납됩니다. 받은 사람은 돌려줄 카드를 직접 고릅니다.</div>${rows}`;
};

const originalRenderButtons = renderButtons;
renderButtons = function patchedRenderButtons() {
  if (room?.status !== "tribute") return originalRenderButtons();

  const mine = me();
  const task = myTributeReturnTask();
  buttons.ready.classList.add("hidden");
  buttons.start.classList.add("hidden");
  buttons.nextRound.classList.add("hidden");
  buttons.pass.classList.add("hidden");
  buttons.play.classList.toggle("hidden", !mine || !task);
  buttons.play.textContent = task ? `돌려줄 카드 ${task.count}장 선택 완료` : "상납 대기 중";
};

const originalRenderHand = renderHand;
renderHand = function patchedRenderHand() {
  originalRenderHand();
  if (room?.status !== "tribute") {
    if (buttons.play) buttons.play.textContent = "선택 카드 내기";
    if (els.handHelp) els.handHelp.textContent = "같은 계급 카드만 선택할 수 있습니다. 홍길동은 와일드카드입니다.";
    return;
  }

  const task = myTributeReturnTask();
  if (els.handHelp) {
    els.handHelp.textContent = task
      ? `${task.from}님에게 돌려줄 카드 ${task.count}장을 고르세요. 아무 카드나 선택할 수 있습니다.`
      : "상납 단계입니다. 다른 사람이 돌려줄 카드를 고르는 중입니다.";
  }

  const count = selectedCards().length;
  if (task) els.selectedSummary.textContent = `선택 ${count}/${task.count}장`;
};

const originalToggleCard = toggleCard;
toggleCard = function patchedToggleCard(id) {
  if (room?.status !== "tribute") return originalToggleCard(id);

  const card = (me()?.hand || []).find(c => c.id === id);
  if (!card) return;
  const task = myTributeReturnTask();
  if (!task) return showToast("지금 선택할 차례가 아닙니다.");

  if (selectedCardIds.has(id)) selectedCardIds.delete(id);
  else {
    if (selectedCardIds.size >= task.count) return showToast(`${task.count}장만 선택할 수 있습니다.`);
    selectedCardIds.add(id);
  }
  renderHand();
  renderButtons();
};
window.toggleCard = toggleCard;

buttons.start.addEventListener("click", e => {
  e.stopImmediatePropagation();
  patchedStartGame();
}, true);

buttons.nextRound.addEventListener("click", e => {
  e.stopImmediatePropagation();
  patchedNextRound();
}, true);

buttons.play.addEventListener("click", e => {
  if (room?.status !== "tribute") return;
  e.stopImmediatePropagation();
  submitTributeReturn();
}, true);
