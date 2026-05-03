function renderTripleAllianceCard(p){
  const members=getHolySwordSortedMembers(p.members);
  const meJoined=members.includes(state.currentUser);
  const firstGroupMark=p.isFirstGroup?`<div class="party-sub">분류: 1군</div>`:"";

  const membersHtml=members.map(name=>`
    <div class="member-line">
      <span class="${name===state.currentUser?"my-name":""}">${escapeHtml(name)}</span>
      ${state.isAdmin?`<button class="inline-btn" onclick="kickMember('${escapeJs(p.id)}','${escapeJs(name)}')">✖</button>`:""}
    </div>
  `).join("");

  return`
    <div class="party-card">
      <div class="party-title triple-alliance-title">${escapeHtml(p.name)}</div>
      ${firstGroupMark}
      <div class="party-sub">소속: <span class="holy-side-badge">${escapeHtml(getTripleAllianceSideLabel(p.side))}</span></div>
      <div class="party-sub">시간: ${formatKST(p.timeUTC)}</div>
      <div class="party-sub">UTC ${formatUTC(p.timeUTC)}</div>
      <div class="party-sub">인원: ${members.length}명</div>
      <div class="member-list">${membersHtml||'<div class="member-line"><span>참가자가 없습니다.</span></div>'}</div>
      <div class="card-actions">
        ${!meJoined?`<button onclick="joinParty('${escapeJs(p.id)}')">참가</button>`:""}
        ${meJoined?`<button onclick="leaveParty('${escapeJs(p.id)}')">취소</button>`:""}
        ${state.isAdmin?`<button onclick="openRuinsEditModal('${escapeJs(p.id)}')">수정</button>`:""}
        ${state.isAdmin?`<button onclick="deleteParty('${escapeJs(p.id)}')">삭제</button>`:""}
      </div>
    </div>
  `;
}

function openTripleAllianceCreateModal(){
  if(!state.isAdmin){
    alert("삼대 연맹전 파티는 운영진만 생성할 수 있습니다.");
    return;
  }

  state.editingRuinsPartyId="";
  el.ruinsModalTitle.textContent="삼대 연맹전 생성";
  el.ruinsSubmitBtn.textContent="생성";

  if(el.ruinNameInput)el.ruinNameInput.value="";

  document.getElementById("ruinNameWrap")?.classList.add("hidden");
  document.getElementById("holySwordSideWrap")?.classList.remove("hidden");
  document.getElementById("firstGroupWrap")?.classList.remove("hidden");

  if(el.firstGroupCheckbox)el.firstGroupCheckbox.checked=false;

  const sideSelect=document.getElementById("holySwordSideSelect");
  if(sideSelect)sideSelect.value=state.tripleAllianceSelectedSide||"KOR";

  el.utcMonth.value="1";
  el.utcDay.value="1";
  el.utcHour.value="0";

  el.ruinsCreateModal.classList.remove("hidden");
  syncOverlay();
}

