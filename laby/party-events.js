/* =========================
   PARTY & EVENT MODULE
========================= */

function subscribeParties() {
  clearSubscriptions();

  if (state.currentEventId === "holy_sword" || state.currentEventId === "triple_alliance") {
    state.unsubscribeRanking = rearrangeRankingRef().onSnapshot(rankingSnap => {
      const rankingMap = {};

      rankingSnap.docs.forEach(doc => {
        const d = doc.data() || {};
        rankingMap[doc.id] = {
          user: d.user || doc.id,
          power: Number(d.power || 0),
          note: String(d.note || ""),
          existingColumn: Number(d.existingColumn || 0),
          excluded: !!d.excluded
        };
      });

      state.rearrangeRankingMap = rankingMap;
      rebuildMergedRearrangeEntries();
      renderPartyList();
    }, err => {
      console.error(err);
      alert("기본 데이터를 불러오는 중 오류가 발생했습니다.");
    });

    state.unsubscribeMeta = rearrangeProgressRef().onSnapshot(progressSnap => {
      state.rearrangeProgressEntries = progressSnap.docs.map(doc => {
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
      renderPartyList();
    }, err => {
      console.error(err);
      alert("기본 데이터를 불러오는 중 오류가 발생했습니다.");
    });
  }

  state.unsubscribeParties = partiesRef(state.currentEventId).onSnapshot(snap => {
    state.parties = snap.docs.map(doc => {
      const d = doc.data() || {};
      return {
        id: doc.id,
        name: d.name || "",
        ruinName: d.ruinName || "",
        side: d.side || "",
        event: d.event || state.currentEventId,
        createdBy: d.createdBy || "",
        members: normalizeMembers(d.members),
        areaAssignments: normalizeAssignments(d.areaAssignments),
        rallyLeader: d.rallyLeader || "",
        timeUTC: d.timeUTC || null,
        maxMembers: Number(d.maxMembers || 0),
        type: d.type || "",
        isFirstGroup: !!d.isFirstGroup,
        createdAt: d.createdAt || null
      };
    });

    state.parties.sort(sortParties);
    renderPartyList();
  }, err => {
    console.error(err);
    alert("기본 데이터를 불러오는 중 오류가 발생했습니다.");
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
  }, err => {
    console.error(err);
    alert("기본 데이터를 불러오는 중 오류가 발생했습니다.");
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
  }, err => {
    console.error(err);
    alert("기본 데이터를 불러오는 중 오류가 발생했습니다.");
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
  }, err => {
    console.error(err);
    alert("기본 데이터를 불러오는 중 오류가 발생했습니다.");
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
  const members = [...p.members].sort((a, b) =>
    a === p.rallyLeader ? -1 : b === p.rallyLeader ? 1 : a.localeCompare(b, "ko")
  );
  const meJoined = members.includes(state.currentUser);
  const power = calcPower(members.length).toLocaleString("ko-KR");

  const membersHtml = members.map(name => `
    <div class="member-line">
      <span class="${name === state.currentUser ? "my-name" : ""}">
        ${name === p.rallyLeader ? "👑 " : ""}${escapeHtml(name)}
      </span>
      ${state.isAdmin && name !== p.rallyLeader ? `<button class="inline-btn" onclick="setRallyLeader('${escapeJs(p.id)}','${escapeJs(name)}')">👍</button>` : ""}
      ${state.isAdmin ? `<button class="inline-btn" onclick="kickMember('${escapeJs(p.id)}','${escapeJs(name)}')">✖</button>` : ""}
    </div>
  `).join("");

  return `
    <div class="party-card">
      <div class="party-title">유적명: ${escapeHtml(p.ruinName || p.name)}</div>
      <div class="party-sub">시간: ${formatKST(p.timeUTC)}</div>
      <div class="party-sub">UTC ${formatUTC(p.timeUTC)}</div>
      <div class="party-sub">병력수: ${power}명</div>
      <div class="party-sub">인원: ${members.length}/15</div>
      <div class="member-list compact">${membersHtml || '<div class="member-line"><span>참가자가 없습니다.</span></div>'}</div>
      <div class="card-actions">
        ${!meJoined && members.length < 15 ? `<button onclick="joinParty('${escapeJs(p.id)}')">참가</button>` : ""}
        ${meJoined ? `<button onclick="leaveParty('${escapeJs(p.id)}')">취소</button>` : ""}
        ${state.isAdmin ? `<button onclick="openRuinsEditModal('${escapeJs(p.id)}')">수정</button><button onclick="deleteParty('${escapeJs(p.id)}')">삭제</button>` : ""}
        <button onclick="copyRuinsNotice('${escapeJs(p.id)}')">복사</button>
      </div>
    </div>
  `;
}

function renderHolySwordCard(p) {
  const members = getHolySwordSortedMembers(p.members);
  const meJoined = members.includes(state.currentUser);
  const canManage = state.isAdmin;
  const byUser = getHolySwordAreaAssignmentsByUser(p.areaAssignments);
  const firstGroupMark = p.isFirstGroup ? `<div class="party-sub">분류: 1군</div>` : "";

  const membersHtml = members.map((name, idx) => {
    const badges = renderHolySwordBadges(byUser[name] || []);
    return `
      <div class="member-line">
        <span class="${name === state.currentUser ? "my-name" : ""}">
          <span class="holy-member-rank">${escapeHtml(getHolySwordDisplayIndex(idx))}</span>
          ${escapeHtml(name)}${badges}
        </span>
      </div>
    `;
  }).join("");

  return `
    <div class="party-card">
      <div class="party-title holy-party-title">${escapeHtml(p.name)}</div>
      ${firstGroupMark}
      <div class="party-sub">소속: <span class="holy-side-badge">${escapeHtml(getHolySwordSideLabel(p.side))}</span></div>
      <div class="party-sub">시간: ${formatKST(p.timeUTC)}</div>
      <div class="party-sub">UTC ${formatUTC(p.timeUTC)}</div>
      <div class="party-sub">인원: ${members.length}명</div>
      ${renderHolySwordAreaBoard(p.areaAssignments)}
      <div class="member-list">${membersHtml || '<div class="member-line"><span>참가자가 없습니다.</span></div>'}</div>
      <div class="card-actions">
        ${!meJoined ? `<button onclick="joinParty('${escapeJs(p.id)}')">참가</button>` : ""}
        ${meJoined ? `<button onclick="leaveParty('${escapeJs(p.id)}')">취소</button>` : ""}
        ${canManage ? `<button onclick="openRuinsEditModal('${escapeJs(p.id)}')">수정</button>` : ""}
        ${canManage ? `<button onclick="deleteParty('${escapeJs(p.id)}')">삭제</button>` : ""}
        ${canManage ? `<button onclick="openHolySwordAreaModal('${escapeJs(p.id)}')">구역장 지정</button>` : ""}
        <button onclick="copyHolySwordNotice('${escapeJs(p.id)}')">복사</button>
      </div>
    </div>
  `;
}

function renderTripleAllianceCard(p) {
  const members = getHolySwordSortedMembers(p.members);
  const meJoined = members.includes(state.currentUser);
  const firstGroupMark = p.isFirstGroup ? `<div class="party-sub">분류: 1군</div>` : "";

  const membersHtml = members.map(name => `
    <div class="member-line">
      <span class="${name === state.currentUser ? "my-name" : ""}">${escapeHtml(name)}</span>
      ${state.isAdmin ? `<button class="inline-btn" onclick="kickMember('${escapeJs(p.id)}','${escapeJs(name)}')">✖</button>` : ""}
    </div>
  `).join("");

  return `
    <div class="party-card">
      <div class="party-title triple-alliance-title">${escapeHtml(p.name)}</div>
      ${firstGroupMark}
      <div class="party-sub">소속: <span class="holy-side-badge">${escapeHtml(getTripleAllianceSideLabel(p.side))}</span></div>
      <div class="party-sub">시간: ${formatKST(p.timeUTC)}</div>
      <div class="party-sub">UTC ${formatUTC(p.timeUTC)}</div>
      <div class="party-sub">인원: ${members.length}명</div>
      <div class="member-list">${membersHtml || '<div class="member-line"><span>참가자가 없습니다.</span></div>'}</div>
      <div class="card-actions">
        ${!meJoined ? `<button onclick="joinParty('${escapeJs(p.id)}')">참가</button>` : ""}
        ${meJoined ? `<button onclick="leaveParty('${escapeJs(p.id)}')">취소</button>` : ""}
        ${state.isAdmin ? `<button onclick="openRuinsEditModal('${escapeJs(p.id)}')">수정</button>` : ""}
        ${state.isAdmin ? `<button onclick="deleteParty('${escapeJs(p.id)}')">삭제</button>` : ""}
      </div>
    </div>
  `;
}

function renderExcludedRearrangeList(entries) {
  if (!state.isAdmin || !entries.length) return "";

  const items = entries.map(entry => `
    <div class="member-line">
      <span>${escapeHtml(entry.user)}</span>
      <button class="rank-edit-btn" onclick="openRearrangeRankEditModal('${escapeJs(entry.user)}')">관리</button>
    </div>
  `).join("");

  return `
    <div class="party-card">
      <div class="party-title">제외 인원</div>
      <div class="party-sub">복구하려면 관리 버튼에서 제외 해제를 하세요.</div>
      <div class="member-list">${items}</div>
    </div>
  `;
}

function renderRearrangeTable(entries) {
  if (!entries.length) return `<div class="rank-empty">입력된 데이터가 없습니다.</div>`;

  const rows = entries.map((entry, idx) => {
    const rank = idx + 1;
    const currentColumn = getRearrangeColumn(rank);
    const rowClass = entry && entry.user === state.currentUser ? "rank-row-me" : "";

    if (!entry) {
      return `
        <tr class="${rowClass}">
          <td>${rank}</td>
          <td>${getLayoutLabel(rank)}</td>
          <td class="left muted">공란</td>
          <td>-</td>
          <td>-</td>
          <td class="left">-</td>
          <td>-</td>
          <td>-</td>
        </tr>
      `;
    }

    const powerText = entry.power > 0 ? Number(entry.power).toLocaleString("ko-KR") : "-";
    const noteText = entry.note ? escapeHtml(entry.note) : "-";
    const existingText = entry.existingColumn > 0 ? String(entry.existingColumn) : "-";
    const move = getMoveDisplay(entry.existingColumn, currentColumn);

    return `
      <tr class="${rowClass}">
        <td>${rank}</td>
        <td>${getLayoutLabel(rank)}</td>
        <td class="left ${entry.user === state.currentUser ? "my-name" : ""}">${escapeHtml(entry.user)}</td>
        <td>${escapeHtml(entry.stageText || "-")}</td>
        <td>${powerText}</td>
        <td class="left">${noteText}</td>
        <td>${existingText}</td>
        <td><span class="${move.className}">${escapeHtml(move.text)}</span>${state.isAdmin ? ` <button class="rank-edit-btn" onclick="openRearrangeRankEditModal('${escapeJs(entry.user)}')">관리</button>` : ""}</td>
      </tr>
    `;
  }).join("");

  return `
    <div class="rank-table-wrap">
      <table class="rank-table">
        <colgroup><col><col><col><col><col><col><col><col></colgroup>
        <thead>
          <tr>
            <th>순위</th>
            <th>순열</th>
            <th>닉네임</th>
            <th>스테이지</th>
            <th>전투력</th>
            <th>비고</th>
            <th>기존</th>
            <th>이동</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderRearrangeGuide() {
  return `<div class="layout-guide-wrap"><img src="../자리 순열.png" alt="자리 순열 안내도" class="layout-guide-image" /></div>`;
}

function renderRearrangeEvent() {
  const mine = myRearrangeEntry();
  const activeEntries = state.rearrangeEntries.filter(v => !isHiddenTestNickname(v.user) && !v.excluded);
  const excludedEntries = state.rearrangeEntries.filter(v => !isHiddenTestNickname(v.user) && v.excluded);
  const displayedEntries = getDisplayedRearrangeEntries(activeEntries);

  const mineCard = state.rearrangeInputEnabled
    ? `<div class="party-card"><div class="party-title">내 진척도</div><div class="party-sub">빛나는 첨탑 최고 스테이지</div><div class="party-sub">현재 입력값: ${mine ? escapeHtml(mine.stageText) : "미입력"}</div><div class="party-sub">최종 수정: ${mine ? formatDateTime(mine.updatedAt) : "-"}</div><div class="card-actions"><button onclick="openMyRearrangeModal()">${mine ? "수정" : "입력"}</button></div></div>`
    : `<div class="party-card"><div class="party-title">내 진척도</div><div class="party-sub">빛나는 첨탑 최고 스테이지</div><div class="party-sub">현재 입력값: ${mine ? escapeHtml(mine.stageText) : "미입력"}</div><div class="party-sub">최종 수정: ${mine ? formatDateTime(mine.updatedAt) : "-"}</div><div class="party-sub">현재 개인 입력은 일시 중지되어 있습니다.</div><div class="card-actions"><button disabled>입력 일시중지</button></div></div>`;

  let rankingCard = "";
  let guideCard = "";

  if (state.isAdmin || state.rearrangePublic) {
    rankingCard = `<div class="party-card rank-table-card"><div class="party-title">진척도 순위표</div><div class="party-sub">${state.isAdmin ? (state.rearrangePublic ? "현재 전체 공개 상태입니다." : "현재 운영진만 볼 수 있습니다.") : "공개된 순위입니다."}</div><div class="card-actions"><button onclick="copyRearrangeColumns()">복사</button></div>${renderRearrangeTable(displayedEntries)}</div>`;
    guideCard = `<div class="party-card layout-guide-card"><div class="party-title">순열 안내 예시</div><div class="party-sub">빨(1), 주(2), 노(3), 초(4), 파(5)</div><div class="card-actions"><button onclick="openExampleImageModal('guide')">예시 크게 보기</button></div>${renderRearrangeGuide()}</div>`;
  } else {
    rankingCard = `<div class="party-card"><div class="party-title">진척도 순위</div><div class="party-sub">아직 공개되지 않았습니다.</div><div class="party-sub">운영진 공개 후 전체 유저가 확인할 수 있습니다.</div></div>`;
  }

  const excludedCard = renderExcludedRearrangeList(excludedEntries);
  el.partyList.innerHTML = mineCard + rankingCard + excludedCard + guideCard;
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

function resetPartyFormCommon() {
  if (el.firstGroupCheckbox) el.firstGroupCheckbox.checked = false;
  document.getElementById("firstGroupWrap")?.classList.add("hidden");
}

function openRuinsCreateModal() {
  if (!state.isAdmin) {
    alert("유적 파티는 운영진만 생성할 수 있습니다.");
    return;
  }

  state.editingRuinsPartyId = "";
  el.ruinsModalTitle.textContent = "유적 파티 생성";
  el.ruinsSubmitBtn.textContent = "생성";
  if (el.ruinNameInput) el.ruinNameInput.value = "";

  document.getElementById("ruinNameWrap")?.classList.remove("hidden");
  document.getElementById("holySwordSideWrap")?.classList.add("hidden");
  resetPartyFormCommon();

  el.utcMonth.value = "1";
  el.utcDay.value = "1";
  el.utcHour.value = "0";

  el.ruinsCreateModal.classList.remove("hidden");
  syncOverlay();
}

function openHolySwordCreateModal() {
  if (!state.isAdmin) {
    alert("성검 파티는 운영진만 생성할 수 있습니다.");
    return;
  }

  state.editingRuinsPartyId = "";
  el.ruinsModalTitle.textContent = "성검 파티 생성";
  el.ruinsSubmitBtn.textContent = "생성";
  if (el.ruinNameInput) el.ruinNameInput.value = "";

  document.getElementById("ruinNameWrap")?.classList.add("hidden");
  document.getElementById("holySwordSideWrap")?.classList.remove("hidden");
  document.getElementById("firstGroupWrap")?.classList.remove("hidden");

  if (el.firstGroupCheckbox) el.firstGroupCheckbox.checked = false;

  const sideSelect = document.getElementById("holySwordSideSelect");
  if (sideSelect) sideSelect.value = state.holySwordSelectedSide || "KOR";

  el.utcMonth.value = "1";
  el.utcDay.value = "1";
  el.utcHour.value = "0";

  el.ruinsCreateModal.classList.remove("hidden");
  syncOverlay();
}

function openTripleAllianceCreateModal() {
  if (!state.isAdmin) {
    alert("삼대 연맹전 파티는 운영진만 생성할 수 있습니다.");
    return;
  }

  state.editingRuinsPartyId = "";
  el.ruinsModalTitle.textContent = "삼대 연맹전 생성";
  el.ruinsSubmitBtn.textContent = "생성";
  if (el.ruinNameInput) el.ruinNameInput.value = "";

  document.getElementById("ruinNameWrap")?.classList.add("hidden");
  document.getElementById("holySwordSideWrap")?.classList.remove("hidden");
  document.getElementById("firstGroupWrap")?.classList.remove("hidden");

  if (el.firstGroupCheckbox) el.firstGroupCheckbox.checked = false;

  const sideSelect = document.getElementById("holySwordSideSelect");
  if (sideSelect) sideSelect.value = state.tripleAllianceSelectedSide || "KOR";

  el.utcMonth.value = "1";
  el.utcDay.value = "1";
  el.utcHour.value = "0";

  el.ruinsCreateModal.classList.remove("hidden");
  syncOverlay();
}

window.openRuinsEditModal = async function(partyId) {
  if (!state.isAdmin) {
    alert("권한이 없습니다.");
    return;
  }

  const p = state.parties.find(v => v.id === partyId);
  if (!p) {
    alert("파티를 찾을 수 없습니다.");
    return;
  }

  state.editingRuinsPartyId = partyId;
  el.ruinsSubmitBtn.textContent = "수정";

  if (state.currentEventId === "holy_sword") {
    el.ruinsModalTitle.textContent = "성검 파티 수정";
    document.getElementById("ruinNameWrap")?.classList.add("hidden");
    document.getElementById("holySwordSideWrap")?.classList.remove("hidden");
    document.getElementById("firstGroupWrap")?.classList.remove("hidden");

    if (el.firstGroupCheckbox) el.firstGroupCheckbox.checked = !!p.isFirstGroup;

    const sideSelect = document.getElementById("holySwordSideSelect");
    if (sideSelect) sideSelect.value = p.side || "KOR";
  } else if (state.currentEventId === "triple_alliance") {
    el.ruinsModalTitle.textContent = "삼대 연맹전 수정";
    document.getElementById("ruinNameWrap")?.classList.add("hidden");
    document.getElementById("holySwordSideWrap")?.classList.remove("hidden");
    document.getElementById("firstGroupWrap")?.classList.remove("hidden");

    if (el.firstGroupCheckbox) el.firstGroupCheckbox.checked = !!p.isFirstGroup;

    const sideSelect = document.getElementById("holySwordSideSelect");
    if (sideSelect) sideSelect.value = p.side || "KOR";
  } else {
    el.ruinsModalTitle.textContent = "유적 파티 수정";
    document.getElementById("ruinNameWrap")?.classList.remove("hidden");
    document.getElementById("holySwordSideWrap")?.classList.add("hidden");
    resetPartyFormCommon();
    el.ruinNameInput.value = p.ruinName || p.name || "";
  }

  const d = toDate(p.timeUTC);
  if (d) {
    el.utcMonth.value = String(d.getUTCMonth() + 1);
    el.utcDay.value = String(d.getUTCDate());
    el.utcHour.value = String(d.getUTCHours());
  }

  el.ruinsCreateModal.classList.remove("hidden");
  syncOverlay();
};

function closeRuinsCreateModal() {
  state.editingRuinsPartyId = "";
  document.getElementById("ruinNameWrap")?.classList.remove("hidden");
  document.getElementById("holySwordSideWrap")?.classList.add("hidden");
  resetPartyFormCommon();
  el.ruinsCreateModal.classList.add("hidden");
  syncOverlay();
}

window.closeRuinsCreateModal = closeRuinsCreateModal;

window.submitRuinsParty = async function() {
  if (!state.isAdmin) {
    alert("권한이 없습니다.");
    return;
  }

  const m = Number(el.utcMonth.value);
  const d = Number(el.utcDay.value);
  const h = Number(el.utcHour.value);
  const isFirstGroup = !!el.firstGroupCheckbox?.checked;

  if (!m || !d || h < 0 || h > 23) {
    alert("UTC 날짜/시간을 선택하세요.");
    return;
  }

  const year = new Date().getUTCFullYear();
  const utcDate = new Date(Date.UTC(year, m - 1, d, h, 0, 0, 0));

  if (state.currentEventId === "holy_sword" || state.currentEventId === "triple_alliance") {
    const side = document.getElementById("holySwordSideSelect")?.value || "KOR";
    const sideText = side === "KOR" ? "본연맹" : "아카데미";
    const sideCode = side === "KOR" ? "KOR" : "KR1";
    const kstHour = (h + 9) % 24;
    const autoName = `[${sideText}(${sideCode})] ${kstHour}시(UTC ${String(h).padStart(2, "0")}:00)`;
    const eventId = state.currentEventId;

    if (state.editingRuinsPartyId) {
      await partiesRef(eventId).doc(state.editingRuinsPartyId).update({
        name: autoName,
        side,
        timeUTC: utcDate,
        isFirstGroup
      });
    } else {
      await partiesRef(eventId).add({
        type: eventId,
        event: eventId,
        name: autoName,
        side,
        createdBy: state.currentUser,
        members: [],
        areaAssignments: eventId === "holy_sword" ? [] : undefined,
        timeUTC: utcDate,
        isFirstGroup,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    closeRuinsCreateModal();
    return;
  }

  const ruinName = (el.ruinNameInput.value || "").trim();
  if (!ruinName) {
    alert("유적명을 입력하세요.");
    return;
  }

  if (state.editingRuinsPartyId) {
    await partiesRef("ruins").doc(state.editingRuinsPartyId).update({
      name: ruinName,
      ruinName,
      timeUTC: utcDate
    });
  } else {
    await partiesRef("ruins").add({
      type: "ruins",
      event: "ruins",
      name: ruinName,
      ruinName,
      createdBy: state.currentUser,
      members: [],
      rallyLeader: "",
      maxMembers: 15,
      timeUTC: utcDate,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  closeRuinsCreateModal();
};

function lockRearrangeInputForManualTap() {
  el.rearrangeStageInput?.setAttribute("readonly", "readonly");
  el.rearrangeStageInput?.blur();
}

function unlockRearrangeInput() {
  if (el.rearrangeStageInput?.hasAttribute("readonly")) {
    el.rearrangeStageInput.removeAttribute("readonly");
  }
}

if (el.rearrangeStageInput) {
  const unlockAndFocus = () => {
    unlockRearrangeInput();
    setTimeout(() => {
      try {
        el.rearrangeStageInput.focus({ preventScroll: true });
      } catch (_) {
        el.rearrangeStageInput.focus();
      }
    }, 0);
  };

  el.rearrangeStageInput.addEventListener("pointerdown", unlockAndFocus);
  el.rearrangeStageInput.addEventListener("touchstart", unlockAndFocus, { passive: true });
  el.rearrangeStageInput.addEventListener("mousedown", unlockAndFocus);
}

window.openMyRearrangeModal = function() {
  el.rearrangeModalTitle.textContent = "내 진척도 입력";
  el.rearrangeSubmitBtn.textContent = "저장";

  const mine = myRearrangeEntry();
  el.rearrangeStageInput.value = mine ? mine.stageText : "";

  lockRearrangeInputForManualTap();
  el.rearrangeModal.classList.remove("hidden");
  syncOverlay();

  setTimeout(() => {
    if (document.activeElement && typeof document.activeElement.blur === "function") {
      document.activeElement.blur();
    }
    el.rearrangeStageInput.blur();
  }, 80);
};

function closeRearrangeModal() {
  el.rearrangeStageInput?.blur();
  el.rearrangeStageInput?.removeAttribute("readonly");
  el.rearrangeModal?.classList.add("hidden");
  syncOverlay();
}

function openExampleImageModal(type = "tower") {
  if (type === "guide") {
    el.exampleImageModalTitle.textContent = "순열 안내 예시";
    el.exampleImageModalImg.src = "../자리 순열.png";
    el.exampleImageModalImg.alt = "자리 순열 안내 예시";
  } else {
    el.exampleImageModalTitle.textContent = "입력 예시 크게 보기";
    el.exampleImageModalImg.src = "../빛나는첨탑순위.png";
    el.exampleImageModalImg.alt = "빛나는 첨탑 순위 예시 크게 보기";
  }

  el.exampleImageModal.classList.remove("hidden");
  syncOverlay();
}

function closeExampleImageModal() {
  el.exampleImageModal?.classList.add("hidden");
  syncOverlay();
}

window.closeRearrangeModal = closeRearrangeModal;
window.openExampleImageModal = openExampleImageModal;
window.closeExampleImageModal = closeExampleImageModal;

window.openHolySwordAreaModal = function(partyId) {
  if (!state.isAdmin) {
    alert("권한이 없습니다.");
    return;
  }

  const party = state.parties.find(v => v.id === partyId);
  if (!party) {
    alert("파티를 찾을 수 없습니다.");
    return;
  }

  state.editingHolySwordPartyId = partyId;
  el.holySwordAreaModalTitle.textContent = `구역장 지정 - ${party.name}`;
  el.holySwordAreaUserSelect.innerHTML = party.members
    .map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`)
    .join("");
  el.holySwordAreaSelect.value = "마구간";
  renderHolySwordAreaAssignmentList(party);

  el.holySwordAreaModal.classList.remove("hidden");
  syncOverlay();
};

function closeHolySwordAreaModal() {
  state.editingHolySwordPartyId = "";
  el.holySwordAreaModal?.classList.add("hidden");
  syncOverlay();
}

window.closeHolySwordAreaModal = closeHolySwordAreaModal;

function renderHolySwordAreaAssignmentList(party) {
  const assignments = normalizeAssignments(party.areaAssignments);
  el.holySwordAreaAssignmentList.innerHTML = assignments.length
    ? assignments.map((item, idx) => `
        <div class="holy-sword-assign-item">
          <span>${escapeHtml(item.user)} - ${escapeHtml(item.area)}</span>
          <button type="button" class="rank-edit-btn" onclick="removeHolySwordAreaAssignment(${idx})">삭제</button>
        </div>
      `).join("")
    : `<div class="muted">지정된 구역장이 없습니다.</div>`;
}

window.addHolySwordAreaAssignment = async function() {
  if (!state.isAdmin) {
    alert("권한이 없습니다.");
    return;
  }

  const party = state.parties.find(v => v.id === state.editingHolySwordPartyId);
  if (!party) {
    alert("파티를 찾을 수 없습니다.");
    return;
  }

  const user = el.holySwordAreaUserSelect.value;
  const area = el.holySwordAreaSelect.value;
  if (!user || !area) {
    alert("파티원과 구역을 선택하세요.");
    return;
  }

  const areaAssignments = [...normalizeAssignments(party.areaAssignments), { user, area }];
  await partiesRef("holy_sword").doc(party.id).update({ areaAssignments });
};

window.removeHolySwordAreaAssignment = async function(index) {
  if (!state.isAdmin) {
    alert("권한이 없습니다.");
    return;
  }

  const party = state.parties.find(v => v.id === state.editingHolySwordPartyId);
  if (!party) {
    alert("파티를 찾을 수 없습니다.");
    return;
  }

  const areaAssignments = [...normalizeAssignments(party.areaAssignments)];
  if (index < 0 || index >= areaAssignments.length) return;

  areaAssignments.splice(index, 1);
  await partiesRef("holy_sword").doc(party.id).update({ areaAssignments });
};

function parseStageText(raw) {
  const value = String(raw || "").trim();
  const parts = value.split("-");

  if (parts.length !== 2 || parts[0] === "" || parts[1] === "") return null;

  const stageMajor = Number(parts[0]);
  const stageMinor = Number(parts[1]);

  if (!Number.isInteger(stageMajor) || !Number.isInteger(stageMinor) || stageMajor < 0 || stageMinor < 0) {
    return null;
  }

  return { stageMajor, stageMinor };
}

window.submitRearrangeProgress = async function() {
  const raw = (el.rearrangeStageInput.value || "").trim();
  const parsed = parseStageText(raw);

  if (!parsed) {
    alert("최고 스테이지는 15-4 형식으로 입력하세요.");
    return;
  }

  await rearrangeProgressRef().doc(state.currentUser).set({
    user: state.currentUser,
    stageText: raw,
    stageMajor: parsed.stageMajor,
    stageMinor: parsed.stageMinor,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    createdAt: state.rearrangeProgressEntries.find(v => v.user === state.currentUser)?.createdAt || firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  closeExampleImageModal();
  closeRearrangeModal();
  syncOverlay();
};

window.openRearrangeRankEditModal = function(userName = "") {
  if (!state.isAdmin) {
    alert("권한이 없습니다.");
    return;
  }

  ensureRankingExtraFields();

  const entry = userName ? state.rearrangeEntries.find(v => v.user === userName) : null;
  if (!entry) {
    alert("대상을 찾을 수 없습니다.");
    return;
  }

  state.editingRearrangeRankUser = entry.user;
  el.rearrangeRankEditTitle.textContent = "순위표 관리";
  el.rankEditSubmitBtn.textContent = "저장";
  el.rankEditDeleteBtn.classList.remove("hidden");
  el.rankEditNicknameInput.value = entry.user || "";
  el.rankEditStageInput.value = entry.stageText || "";
  el.rankEditPowerInput.value = entry.power > 0 ? String(entry.power) : "";
  el.rankEditNoteInput.value = entry.note || "";

  const existingInput = document.getElementById("rankEditExistingInput");
  if (existingInput) {
    existingInput.value = entry.existingColumn > 0 ? String(entry.existingColumn) : "";
  }

  const excludeBtn = document.getElementById("rankEditExcludeBtn");
  if (excludeBtn) {
    excludeBtn.textContent = entry.excluded ? "제외 해제" : "목록에서 제외";
    excludeBtn.onclick = toggleRearrangeExcluded;
  }

  el.rankEditNicknameInput.readOnly = true;
  el.rankEditStageInput.readOnly = true;
  el.rankEditDeleteBtn.textContent = "관리값 삭제";

  el.rearrangeRankEditModal.classList.remove("hidden");
  syncOverlay();
};

function closeRearrangeRankEditModal() {
  state.editingRearrangeRankUser = "";
  el.rankEditNicknameInput.readOnly = false;
  el.rankEditStageInput.readOnly = false;
  el.rearrangeRankEditModal?.classList.add("hidden");
  syncOverlay();
}

window.closeRearrangeRankEditModal = closeRearrangeRankEditModal;

window.toggleRearrangeExcluded = async function() {
  if (!state.isAdmin) return;

  const user = state.editingRearrangeRankUser || "";
  if (!user) return;

  const current = state.rearrangeEntries.find(v => v.user === user);
  if (!current) return;

  await rearrangeRankingRef().doc(user).set({
    user,
    excluded: !current.excluded,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  closeRearrangeRankEditModal();
};

window.submitRearrangeRankEdit = async function() {
  if (!state.isAdmin) return;

  const user = state.editingRearrangeRankUser || "";
  if (!user) return;

  const current = state.rearrangeEntries.find(v => v.user === user);
  const powerRaw = (el.rankEditPowerInput.value || "").trim();
  const note = (el.rankEditNoteInput.value || "").trim();
  const existingRaw = (document.getElementById("rankEditExistingInput")?.value || "").trim();

  let power = 0;
  if (powerRaw !== "") {
    power = Number(powerRaw);
    if (!Number.isInteger(power) || power < 0) {
      alert("전투력은 0 이상의 정수로 입력하세요.");
      return;
    }
  }

  let existingColumn = 0;
  if (existingRaw !== "") {
    existingColumn = Number(existingRaw);
    if (!Number.isInteger(existingColumn) || existingColumn < 1) {
      alert("기존은 1 이상의 정수로 입력하세요.");
      return;
    }
  }

  await rearrangeRankingRef().doc(user).set({
    user,
    power,
    note,
    existingColumn,
    excluded: !!current?.excluded,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  closeRearrangeRankEditModal();
};

window.deleteRearrangeRankRow = async function() {
  if (!state.isAdmin) return;

  const user = state.editingRearrangeRankUser || "";
  if (!user) return;

  await rearrangeRankingRef().doc(user).delete();
  closeRearrangeRankEditModal();
};

window.toggleRearrangePublic = async function() {
  if (!state.isAdmin) return;
  await eventRef("rearrange").set({ rankingPublic: !state.rearrangePublic }, { merge: true });
};

window.toggleRearrangeInputEnabled = async function() {
  if (!state.isAdmin || state.currentUser !== "병풍") return;
  await eventRef("rearrange").set({ rearrangeInputEnabled: !state.rearrangeInputEnabled }, { merge: true });
};

function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
  alert("복사되었습니다.");
}

window.copyRuinsNotice = function(partyId) {
  const p = state.parties.find(v => v.id === partyId);
  if (!p) return;

  const members = [...p.members];
  const leader = p.rallyLeader || "";
  const others = members.filter(n => n !== leader);
  const power = calcPower(members.length).toLocaleString("ko-KR");
  const d = toDate(p.timeUTC);
  const kstTime = d ? `${String(d.getHours()).padStart(2, "0")}:00` : "-";
  const utcTime = d ? `${String(d.getUTCHours()).padStart(2, "0")}:00` : "-";
  const title = (p.ruinName || p.name || "") + " 명단";

  const text = `${title}\n시간: ${kstTime}(UTC ${utcTime})\n집결장: ${leader || "-"}\n집결원: ${others.join(", ")}\n병력수: ${power}명`;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => alert("복사되었습니다."), () => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
};

window.copyHolySwordNotice = function(partyId) {
  const p = state.parties.find(v => v.id === partyId);
  if (!p) return;

  const members = getHolySwordSortedMembers(p.members);
  const byArea = {};
  HOLY_SWORD_AREAS.forEach(area => byArea[area] = []);
  normalizeAssignments(p.areaAssignments).forEach(item => {
    if (!byArea[item.area]) byArea[item.area] = [];
    byArea[item.area].push(item.user);
  });

  const memberLines = members.map((name, idx) => `${getHolySwordDisplayIndex(idx)} ${name}`);

  const text = [
    "[성검 쟁탈]",
    `소속: ${getHolySwordSideLabel(p.side)}`,
    `시간: ${formatKST(p.timeUTC)} (UTC ${formatUTC(p.timeUTC)})`,
    "",
    "[구역장]",
    `수도원 1: ${byArea["수도원 1"].join(", ") || "-"}`,
    `수도원 2: ${byArea["수도원 2"].join(", ") || "-"}`,
    `성소 1: ${byArea["성소 1"].join(", ") || "-"}`,
    `마구간: ${byArea["마구간"].join(", ") || "-"}`,
    `수도원 3: ${byArea["수도원 3"].join(", ") || "-"}`,
    `수도원 4: ${byArea["수도원 4"].join(", ") || "-"}`,
    `성소 2: ${byArea["성소 2"].join(", ") || "-"}`,
    `시계탑: ${byArea["시계탑"].join(", ") || "-"}`,
    "",
    "[참가인원]",
    ...memberLines
  ].join("\n");

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => alert("복사되었습니다."), () => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
};

window.copyRearrangeColumns = function() {
  const activeEntries = state.rearrangeEntries.filter(v => !isHiddenTestNickname(v.user) && !v.excluded);
  const displayedEntries = getDisplayedRearrangeEntries(activeEntries);
  const columns = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  const moveNeeded = [];

  displayedEntries.forEach((entry, idx) => {
    const rank = idx + 1;
    const col = getRearrangeColumn(rank);
    if (!entry) return;

    columns[col].push(entry.user);

    const existingColumn = Number(entry.existingColumn || 0);
    if (existingColumn > 0 && existingColumn !== col) {
      moveNeeded.push(`${entry.user}(${existingColumn}→${col})`);
    }
  });

  const lines = [
    "[자리 재배치 결과]",
    `1열: ${columns[1].join(", ")}`,
    `2열: ${columns[2].join(", ")}`,
    `3열: ${columns[3].join(", ")}`,
    `4열: ${columns[4].join(", ")}`,
    `5열: ${columns[5].join(", ")}`,
    "",
    "[이동 필요 인원]",
    ...(moveNeeded.length ? moveNeeded : ["없음"])
  ];

  const text = lines.join("\n");

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => alert("순열이 복사되었습니다."), () => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
};

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

window.setRallyLeader = async function(id, name) {
  if (!state.isAdmin) return;
  const p = state.parties.find(v => v.id === id);
  if (!p || !p.members.includes(name)) return;
  await partiesRef("ruins").doc(id).update({ rallyLeader: name });
};
