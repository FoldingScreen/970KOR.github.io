/* =========================
   PARTY & EVENT MODULE
========================= */

function subscribeParties() {
  clearSubscriptions();

  state.unsubscribeParties = partiesRef(state.currentEventId).onSnapshot(snap => {
    state.parties = snap.docs.map(doc => {
      const d = doc.data() || {};
      return {
        id: doc.id,
        name: d.name || "",
        members: normalizeMembers(d.members),
        createdBy: d.createdBy || "",
        maxMembers: Number(d.maxMembers || 0),
        timeUTC: d.timeUTC || null,
        ruinName: d.ruinName || "",
        side: d.side || "",
        rallyLeader: d.rallyLeader || "",
        areaAssignments: normalizeAssignments(d.areaAssignments),
        isFirstGroup: !!d.isFirstGroup,
        type: d.type || ""
      };
    });

    state.parties.sort(sortParties);
    renderPartyList();
  });
}

function subscribeRearrange() {
  clearSubscriptions();

  state.unsubscribeMeta = eventRef("rearrange").onSnapshot(doc => {
    const d = doc.data() || {};
    state.rearrangePublic = !!d.rankingPublic;
    state.rearrangeInputEnabled = !!d.rearrangeInputEnabled;
    updateEventActionButtons();
    renderRearrangeEvent();
  });

  state.unsubscribeParties = rearrangeProgressRef().onSnapshot(snap => {
    state.rearrangeProgressEntries = snap.docs.map(doc => {
      const d = doc.data() || {};
      return {
        id: doc.id,
        user: d.user || doc.id,
        stageText: String(d.stageText || d.stage || ""),
        stageMajor: Number(d.stageMajor || 0),
        stageMinor: Number(d.stageMinor || 0),
        updatedAt: d.updatedAt || null,
        createdAt: d.createdAt || null
      };
    });

    rebuildMergedRearrangeEntries();
    renderRearrangeEvent();
  });

  state.unsubscribeRanking = rearrangeRankingRef().onSnapshot(snap => {
    const map = {};

    snap.docs.forEach(doc => {
      const d = doc.data() || {};
      map[doc.id] = {
        user: d.user || doc.id,
        power: Number(d.power || 0),
        note: String(d.note || ""),
        existingColumn: Number(d.existingColumn || 0),
        excluded: !!d.excluded
      };
    });

    state.rearrangeRankingMap = map;
    rebuildMergedRearrangeEntries();
    renderRearrangeEvent();
  });
}

function rebuildMergedRearrangeEntries() {
  state.rearrangeEntries = state.rearrangeProgressEntries.map(progress => {
    const ranking = state.rearrangeRankingMap[progress.user] || {};
    return {
      ...progress,
      power: Number(ranking.power || 0),
      note: String(ranking.note || ""),
      existingColumn: Number(ranking.existingColumn || 0),
      excluded: !!ranking.excluded
    };
  });

  state.rearrangeEntries.sort(sortRearrangeEntries);
}

function sortParties(a, b) {
  if (state.currentEventId === "holy_sword" || state.currentEventId === "triple_alliance") {
    if (!!a.isFirstGroup !== !!b.isFirstGroup) {
      return a.isFirstGroup ? -1 : 1;
    }

    if (a.side !== b.side) {
      return a.side === "KOR" ? -1 : 1;
    }

    return getTimeValue(a.timeUTC) - getTimeValue(b.timeUTC);
  }

  if (state.currentEventId === "ruins") {
    return getTimeValue(a.timeUTC) - getTimeValue(b.timeUTC);
  }

  return String(a.name).localeCompare(String(b.name), "ko");
}

function sortRearrangeEntries(a, b) {
  if (b.stageMajor !== a.stageMajor) return b.stageMajor - a.stageMajor;
  if (b.stageMinor !== a.stageMinor) return b.stageMinor - a.stageMinor;
  if ((Number(b.power) || 0) !== (Number(a.power) || 0)) {
    return (Number(b.power) || 0) - (Number(a.power) || 0);
  }
  return getTimeValue(b.updatedAt) - getTimeValue(a.updatedAt);
}

function renderPartyList() {
  if (!state.parties.length) {
    el.partyList.innerHTML = `<div class="empty-card">아직 생성된 파티가 없습니다.</div>`;
    return;
  }

  el.partyList.innerHTML = state.parties.map(p => {
    if (state.currentEventId === "ruins") return renderRuinsCard(p);
    if (state.currentEventId === "holy_sword") return renderHolySwordCard(p);
    if (state.currentEventId === "triple_alliance") return renderTripleAllianceCard(p);
    return renderVikingCard(p);
  }).join("");
}

function renderVikingCard(p) {
  const meJoined = p.members.includes(state.currentUser);
  const canDelete = state.isAdmin || p.createdBy === state.currentUser;
  const canKick = state.isAdmin || p.createdBy === state.currentUser;
  const maxMembers = Number(p.maxMembers || 0);
  const isFull = maxMembers > 0 && p.members.length >= maxMembers;

  const membersHtml = p.members.map(name => `
    <div class="member-line">
      <span class="${name === state.currentUser ? "my-name" : ""}">
        ${name === p.createdBy ? "👑 " : ""}${escapeHtml(name)}
      </span>
      ${canKick && name !== p.createdBy ? `<button class="inline-btn" onclick="kickMember('${escapeJs(p.id)}','${escapeJs(name)}')">✖</button>` : ""}
    </div>
  `).join("");

  return `
    <div class="party-card">
      <div class="party-title">${escapeHtml(p.name)}</div>
      <div class="party-sub">파티장: ${escapeHtml(p.createdBy || "-")}</div>
      <div class="party-sub">인원: ${p.members.length}${maxMembers > 0 ? `/${maxMembers}` : ""}명</div>
      <div class="member-list">${membersHtml || '<div class="member-line"><span>참가자가 없습니다.</span></div>'}</div>
      <div class="card-actions">
        ${!meJoined && !isFull ? `<button onclick="joinParty('${escapeJs(p.id)}')">참가</button>` : ""}
        ${meJoined ? `<button onclick="leaveParty('${escapeJs(p.id)}')">취소</button>` : ""}
        ${canDelete ? `<button onclick="deleteParty('${escapeJs(p.id)}')">삭제</button>` : ""}
      </div>
    </div>
  `;
}

function renderRuinsCard(p) {
  return `
    <div class="party-card">
      <div class="party-title">유적명: ${escapeHtml(p.ruinName || p.name)}</div>
      <div class="party-sub">시간: ${formatKST(p.timeUTC)}</div>
      <div class="party-sub">UTC ${formatUTC(p.timeUTC)}</div>
      <div class="party-sub">인원: ${p.members.length}/15</div>
    </div>
  `;
}

function renderHolySwordCard(p) {
  return `
    <div class="party-card">
      <div class="party-title holy-party-title">${escapeHtml(p.name)}</div>
      <div class="party-sub">소속: <span class="holy-side-badge">${escapeHtml(getHolySwordSideLabel(p.side))}</span></div>
      <div class="party-sub">시간: ${formatKST(p.timeUTC)}</div>
      <div class="party-sub">UTC ${formatUTC(p.timeUTC)}</div>
      <div class="party-sub">인원: ${p.members.length}명</div>
      ${renderHolySwordAreaBoard(p.areaAssignments)}
    </div>
  `;
}

function renderTripleAllianceCard(p) {
  return `
    <div class="party-card">
      <div class="party-title triple-alliance-title">${escapeHtml(p.name)}</div>
      <div class="party-sub">소속: <span class="holy-side-badge">${escapeHtml(getTripleAllianceSideLabel(p.side))}</span></div>
      <div class="party-sub">시간: ${formatKST(p.timeUTC)}</div>
      <div class="party-sub">UTC ${formatUTC(p.timeUTC)}</div>
      <div class="party-sub">인원: ${p.members.length}명</div>
    </div>
  `;
}

function renderRearrangeEvent() {
  const mine = myRearrangeEntry();

  el.partyList.innerHTML = `
    <div class="party-card">
      <div class="party-title">내 진척도</div>
      <div class="party-sub">현재 입력값: ${mine ? escapeHtml(mine.stageText) : "미입력"}</div>
      <div class="party-sub">최종 수정: ${mine ? formatDateTime(mine.updatedAt) : "-"}</div>
    </div>
  `;
}

async function createParty() {
  if (state.currentEventId === "viking") return createVikingParty();
  if (state.currentEventId === "ruins") return openRuinsCreateModal();
  if (state.currentEventId === "holy_sword") return openHolySwordCreateModal();
  if (state.currentEventId === "triple_alliance") return openTripleAllianceCreateModal();
}

window.createParty = createParty;

async function createVikingParty() {
  const name = (prompt("파티 이름을 입력하세요.") || "").trim();
  if (!name) return;

  if (myParty()) {
    alert("이미 다른 파티에 참여 중입니다.");
    return;
  }

  const maxInput = (prompt("최대 인원을 입력하세요.\n예: 6") || "").trim();
  const maxMembers = Number(maxInput);

  if (!Number.isInteger(maxMembers) || maxMembers < 1) {
    alert("최대 인원은 1 이상의 숫자로 입력하세요.");
    return;
  }

  const dup = await partiesRef("viking").where("name", "==", name).get();
  if (!dup.empty) {
    alert("같은 이름의 파티가 이미 있습니다.");
    return;
  }

  await partiesRef("viking").add({
    type: "viking",
    event: "viking",
    name,
    createdBy: state.currentUser,
    members: [state.currentUser],
    maxMembers,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

window.joinParty = async function(id) {
  const ref = partiesRef(state.currentEventId).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return;

  const d = snap.data() || {};
  const members = normalizeMembers(d.members);

  if (state.currentEventId === "viking" && myParty()) {
    alert("이미 다른 파티에 참여 중입니다.");
    return;
  }

  if (members.includes(state.currentUser)) return;

  if (state.currentEventId === "ruins" && members.length >= 15) {
    alert("유적 파티는 최대 15명입니다.");
    return;
  }

  if (state.currentEventId === "viking" && Number(d.maxMembers || 0) > 0 && members.length >= Number(d.maxMembers)) {
    alert("이 파티는 정원이 가득 찼습니다.");
    return;
  }

  members.push(state.currentUser);
  await ref.update({ members });
};

window.leaveParty = async function(id) {
  const ref = partiesRef(state.currentEventId).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return;

  const d = snap.data() || {};
  const members = normalizeMembers(d.members).filter(v => v !== state.currentUser);
  const updates = { members };

  if (state.currentEventId === "ruins" && d.rallyLeader === state.currentUser) {
    updates.rallyLeader = members[0] || "";
  }

  if (state.currentEventId === "holy_sword") {
    updates.areaAssignments = normalizeAssignments(d.areaAssignments).filter(v => v.user !== state.currentUser);
  }

  await ref.update(updates);
};

window.deleteParty = async function(id) {
  const ref = partiesRef(state.currentEventId).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return;

  const d = snap.data() || {};
  const ok = state.isAdmin || d.createdBy === state.currentUser;
  if (!ok) {
    alert("삭제 권한이 없습니다.");
    return;
  }

  if (!confirm("정말 이 파티를 삭제하시겠습니까?")) return;
  await ref.delete();
};

window.kickMember = async function(id, name) {
  const p = state.parties.find(v => v.id === id);
  if (!p) return;

  const ok = state.isAdmin || p.createdBy === state.currentUser;
  if (!ok) return;

  if (!confirm(`${name} 님을 추방하시겠습니까?`)) return;

  const ref = partiesRef(state.currentEventId).doc(id);
  const members = normalizeMembers(p.members).filter(v => v !== name);
  const updates = { members };

  if (state.currentEventId === "ruins" && p.rallyLeader === name) {
    updates.rallyLeader = members[0] || "";
  }

  if (state.currentEventId === "holy_sword") {
    updates.areaAssignments = normalizeAssignments(p.areaAssignments).filter(v => v.user !== name);
  }

  await ref.update(updates);
};
