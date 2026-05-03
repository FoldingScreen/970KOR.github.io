function renderHolySwordCard(p){
  const members=getHolySwordSortedMembers(p.members);
  const meJoined=members.includes(state.currentUser);
  const canManage=state.isAdmin;
  const byUser=getHolySwordAreaAssignmentsByUser(p.areaAssignments);
  const firstGroupMark=p.isFirstGroup?`<div class="party-sub">분류: 1군</div>`:"";

  const membersHtml=members.map((name,idx)=>{
    const badges=renderHolySwordBadges(byUser[name]||[]);

    return`
      <div class="member-line">
        <span class="${name===state.currentUser?"my-name":""}">
          <span class="holy-member-rank">${escapeHtml(getHolySwordDisplayIndex(idx))}</span>
          ${escapeHtml(name)}${badges}
        </span>
      </div>
    `;
  }).join("");

  return`
    <div class="party-card">
      <div class="party-title holy-party-title">${escapeHtml(p.name)}</div>
      ${firstGroupMark}
      <div class="party-sub">소속: <span class="holy-side-badge">${escapeHtml(getHolySwordSideLabel(p.side))}</span></div>
      <div class="party-sub">시간: ${formatKST(p.timeUTC)}</div>
      <div class="party-sub">UTC ${formatUTC(p.timeUTC)}</div>
      <div class="party-sub">인원: ${members.length}명</div>
      ${renderHolySwordAreaBoard(p.areaAssignments)}
      <div class="member-list">${membersHtml||'<div class="member-line"><span>참가자가 없습니다.</span></div>'}</div>
      <div class="card-actions">
        ${!meJoined?`<button onclick="joinParty('${escapeJs(p.id)}')">참가</button>`:""}
        ${meJoined?`<button onclick="leaveParty('${escapeJs(p.id)}')">취소</button>`:""}
        ${canManage?`<button onclick="openRuinsEditModal('${escapeJs(p.id)}')">수정</button>`:""}
        ${canManage?`<button onclick="deleteParty('${escapeJs(p.id)}')">삭제</button>`:""}
        ${canManage?`<button onclick="openHolySwordAreaModal('${escapeJs(p.id)}')">구역장 지정</button>`:""}
        <button onclick="copyHolySwordNotice('${escapeJs(p.id)}')">복사</button>
      </div>
    </div>
  `;
}

function openHolySwordCreateModal(){
  if(!state.isAdmin){
    alert("성검 파티는 운영진만 생성할 수 있습니다.");
    return;
  }

  state.editingRuinsPartyId="";
  el.ruinsModalTitle.textContent="성검 파티 생성";
  el.ruinsSubmitBtn.textContent="생성";

  if(el.ruinNameInput)el.ruinNameInput.value="";

  document.getElementById("ruinNameWrap")?.classList.add("hidden");
  document.getElementById("holySwordSideWrap")?.classList.remove("hidden");
  document.getElementById("firstGroupWrap")?.classList.remove("hidden");

  if(el.firstGroupCheckbox)el.firstGroupCheckbox.checked=false;

  const sideSelect=document.getElementById("holySwordSideSelect");
  if(sideSelect)sideSelect.value=state.holySwordSelectedSide||"KOR";

  el.utcMonth.value="1";
  el.utcDay.value="1";
  el.utcHour.value="0";

  el.ruinsCreateModal.classList.remove("hidden");
  syncOverlay();
}

window.openHolySwordAreaModal=function(partyId){
  if(!state.isAdmin){
    alert("권한이 없습니다.");
    return;
  }

  const party=state.parties.find(v=>v.id===partyId);
  if(!party){
    alert("파티를 찾을 수 없습니다.");
    return;
  }

  state.editingHolySwordPartyId=partyId;
  el.holySwordAreaModalTitle.textContent=`구역장 지정 - ${party.name}`;
  el.holySwordAreaUserSelect.innerHTML=party.members.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
  el.holySwordAreaSelect.value="마구간";
  renderHolySwordAreaAssignmentList(party);
  el.holySwordAreaModal.classList.remove("hidden");
  syncOverlay();
};

function closeHolySwordAreaModal(){
  state.editingHolySwordPartyId="";
  el.holySwordAreaModal?.classList.add("hidden");
  syncOverlay();
}
window.closeHolySwordAreaModal=closeHolySwordAreaModal;

function renderHolySwordAreaAssignmentList(party){
  const assignments=normalizeAssignments(party.areaAssignments);
  el.holySwordAreaAssignmentList.innerHTML=assignments.length
    ? assignments.map((item,idx)=>`
      <div class="holy-sword-assign-item">
        <span>${escapeHtml(item.user)} - ${escapeHtml(item.area)}</span>
        <button type="button" class="rank-edit-btn" onclick="removeHolySwordAreaAssignment(${idx})">삭제</button>
      </div>
    `).join("")
    : `<div class="muted">지정된 구역장이 없습니다.</div>`;
}

window.addHolySwordAreaAssignment=async function(){
  if(!state.isAdmin){
    alert("권한이 없습니다.");
    return;
  }

  const party=state.parties.find(v=>v.id===state.editingHolySwordPartyId);
  if(!party){
    alert("파티를 찾을 수 없습니다.");
    return;
  }

  const user=el.holySwordAreaUserSelect.value;
  const area=el.holySwordAreaSelect.value;

  if(!user||!area){
    alert("파티원과 구역을 선택하세요.");
    return;
  }

  const areaAssignments=[...normalizeAssignments(party.areaAssignments),{user,area}];
  await partiesRef("holy_sword").doc(party.id).update({areaAssignments});
};

window.removeHolySwordAreaAssignment=async function(index){
  if(!state.isAdmin){
    alert("권한이 없습니다.");
    return;
  }

  const party=state.parties.find(v=>v.id===state.editingHolySwordPartyId);
  if(!party){
    alert("파티를 찾을 수 없습니다.");
    return;
  }

  const areaAssignments=[...normalizeAssignments(party.areaAssignments)];
  if(index<0||index>=areaAssignments.length)return;

  areaAssignments.splice(index,1);
  await partiesRef("holy_sword").doc(party.id).update({areaAssignments});
};
window.copyHolySwordNotice=function(partyId){
  const p=state.parties.find(v=>v.id===partyId);
  if(!p)return;

  const members=getHolySwordSortedMembers(p.members);
  const byArea={};
  HOLY_SWORD_AREAS.forEach(area=>byArea[area]=[]);

  normalizeAssignments(p.areaAssignments).forEach(item=>{
    if(!byArea[item.area])byArea[item.area]=[];
    byArea[item.area].push(item.user);
  });

  const memberLines=members.map((name,idx)=>`${getHolySwordDisplayIndex(idx)} ${name}`);
  const text=[
    "[성검 쟁탈]",
    `소속: ${getHolySwordSideLabel(p.side)}`,
    `시간: ${formatKST(p.timeUTC)} (UTC ${formatUTC(p.timeUTC)})`,
    "",
    "[구역장]",
    `수도원 1: ${byArea["수도원 1"].join(", ")||"-"}`,
    `수도원 2: ${byArea["수도원 2"].join(", ")||"-"}`,
    `성소 1: ${byArea["성소 1"].join(", ")||"-"}`,
    `마구간: ${byArea["마구간"].join(", ")||"-"}`,
    `수도원 3: ${byArea["수도원 3"].join(", ")||"-"}`,
    `수도원 4: ${byArea["수도원 4"].join(", ")||"-"}`,
    `성소 2: ${byArea["성소 2"].join(", ")||"-"}`,
    `시계탑: ${byArea["시계탑"].join(", ")||"-"}`,
    "",
    "[참가인원]",
    ...memberLines
  ].join("\n");

  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(()=>alert("복사되었습니다."),()=>fallbackCopy(text));
  }else fallbackCopy(text);
};

