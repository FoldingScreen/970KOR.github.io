function renderRuinsCard(p){
  const members=[...p.members].sort((a,b)=>a===p.rallyLeader?-1:b===p.rallyLeader?1:a.localeCompare(b,"ko"));
  const meJoined=members.includes(state.currentUser);
  const power=calcPower(members.length).toLocaleString("ko-KR");

  const membersHtml=members.map(name=>`
    <div class="member-line">
      <span class="${name===state.currentUser?"my-name":""}">
        ${name===p.rallyLeader?"👑 ":""}${escapeHtml(name)}
      </span>
      ${state.isAdmin&&name!==p.rallyLeader?`<button class="inline-btn" onclick="setRallyLeader('${escapeJs(p.id)}','${escapeJs(name)}')">👍</button>`:""}
      ${state.isAdmin?`<button class="inline-btn" onclick="kickMember('${escapeJs(p.id)}','${escapeJs(name)}')">✖</button>`:""}
    </div>
  `).join("");

  return`
    <div class="party-card">
      <div class="party-title">유적명: ${escapeHtml(p.ruinName||p.name)}</div>
      <div class="party-sub">시간: ${formatKST(p.timeUTC)}</div>
      <div class="party-sub">UTC ${formatUTC(p.timeUTC)}</div>
      <div class="party-sub">병력수: ${power}명</div>
      <div class="party-sub">인원: ${members.length}/15</div>
      <div class="member-list compact">${membersHtml||'<div class="member-line"><span>참가자가 없습니다.</span></div>'}</div>
      <div class="card-actions">
        ${!meJoined&&members.length<15?`<button onclick="joinParty('${escapeJs(p.id)}')">참가</button>`:""}
        ${meJoined?`<button onclick="leaveParty('${escapeJs(p.id)}')">취소</button>`:""}
        ${state.isAdmin?`<button onclick="openRuinsEditModal('${escapeJs(p.id)}')">수정</button><button onclick="deleteParty('${escapeJs(p.id)}')">삭제</button>`:""}
        <button onclick="copyRuinsNotice('${escapeJs(p.id)}')">복사</button>
      </div>
    </div>
  `;
}

function resetPartyFormCommon(){
  if(el.firstGroupCheckbox)el.firstGroupCheckbox.checked=false;
  document.getElementById("firstGroupWrap")?.classList.add("hidden");
}

function openRuinsCreateModal(){
  if(!state.isAdmin){
    alert("유적 파티는 운영진만 생성할 수 있습니다.");
    return;
  }

  state.editingRuinsPartyId="";
  el.ruinsModalTitle.textContent="유적 파티 생성";
  el.ruinsSubmitBtn.textContent="생성";

  if(el.ruinNameInput)el.ruinNameInput.value="";

  document.getElementById("ruinNameWrap")?.classList.remove("hidden");
  document.getElementById("holySwordSideWrap")?.classList.add("hidden");
  resetPartyFormCommon();

  el.utcMonth.value="1";
  el.utcDay.value="1";
  el.utcHour.value="0";

  el.ruinsCreateModal.classList.remove("hidden");
  syncOverlay();
}

window.openRuinsEditModal=async function(partyId){
  if(!state.isAdmin){
    alert("권한이 없습니다.");
    return;
  }

  const p=state.parties.find(v=>v.id===partyId);
  if(!p){
    alert("파티를 찾을 수 없습니다.");
    return;
  }

  state.editingRuinsPartyId=partyId;
  el.ruinsSubmitBtn.textContent="수정";

  if(state.currentEventId==="holy_sword"){
    el.ruinsModalTitle.textContent="성검 파티 수정";
    document.getElementById("ruinNameWrap")?.classList.add("hidden");
    document.getElementById("holySwordSideWrap")?.classList.remove("hidden");
    document.getElementById("firstGroupWrap")?.classList.remove("hidden");

    if(el.firstGroupCheckbox)el.firstGroupCheckbox.checked=!!p.isFirstGroup;

    const sideSelect=document.getElementById("holySwordSideSelect");
    if(sideSelect)sideSelect.value=p.side||"KOR";
  }else if(state.currentEventId==="triple_alliance"){
    el.ruinsModalTitle.textContent="삼대 연맹전 수정";
    document.getElementById("ruinNameWrap")?.classList.add("hidden");
    document.getElementById("holySwordSideWrap")?.classList.remove("hidden");
    document.getElementById("firstGroupWrap")?.classList.remove("hidden");

    if(el.firstGroupCheckbox)el.firstGroupCheckbox.checked=!!p.isFirstGroup;

    const sideSelect=document.getElementById("holySwordSideSelect");
    if(sideSelect)sideSelect.value=p.side||"KOR";
  }else{
    el.ruinsModalTitle.textContent="유적 파티 수정";
    document.getElementById("ruinNameWrap")?.classList.remove("hidden");
    document.getElementById("holySwordSideWrap")?.classList.add("hidden");
    resetPartyFormCommon();
    el.ruinNameInput.value=p.ruinName||p.name||"";
  }

  const d=toDate(p.timeUTC);
  if(d){
    el.utcMonth.value=String(d.getUTCMonth()+1);
    el.utcDay.value=String(d.getUTCDate());
    el.utcHour.value=String(d.getUTCHours());
  }

  el.ruinsCreateModal.classList.remove("hidden");
  syncOverlay();
};

function closeRuinsCreateModal(){
  state.editingRuinsPartyId="";
  document.getElementById("ruinNameWrap")?.classList.remove("hidden");
  document.getElementById("holySwordSideWrap")?.classList.add("hidden");
  resetPartyFormCommon();
  el.ruinsCreateModal?.classList.add("hidden");
  syncOverlay();
}
window.closeRuinsCreateModal=closeRuinsCreateModal;

window.submitRuinsParty=async function(){
  if(!state.isAdmin){
    alert("권한이 없습니다.");
    return;
  }

  const m=Number(el.utcMonth.value);
  const d=Number(el.utcDay.value);
  const h=Number(el.utcHour.value);
  const isFirstGroup=!!el.firstGroupCheckbox?.checked;

  if(!m||!d||h<0||h>23){
    alert("UTC 날짜/시간을 선택하세요.");
    return;
  }

  const year=new Date().getUTCFullYear();
  const utcDate=new Date(Date.UTC(year,m-1,d,h,0,0,0));

  if(state.currentEventId==="holy_sword"||state.currentEventId==="triple_alliance"){
    const side=document.getElementById("holySwordSideSelect")?.value||"KOR";
    const sideText=side==="KOR"?"본연맹":"아카데미";
    const sideCode=side==="KOR"?"KOR":"KR1";
    const kstHour=(h+9)%24;
    const autoName=`[${sideText}(${sideCode})] ${kstHour}시(UTC ${String(h).padStart(2,"0")}:00)`;
    const eventId=state.currentEventId;

    if(eventId==="holy_sword")localStorage.setItem("holySwordSelectedSide",side);
    if(eventId==="triple_alliance")localStorage.setItem("tripleAllianceSelectedSide",side);

    if(state.editingRuinsPartyId){
      await partiesRef(eventId).doc(state.editingRuinsPartyId).update({
        name:autoName,
        side,
        timeUTC:utcDate,
        isFirstGroup
      });
    }else{
      await partiesRef(eventId).add({
        type:eventId,
        event:eventId,
        name:autoName,
        side,
        createdBy:state.currentUser,
        members:[],
        areaAssignments:eventId==="holy_sword"?[]:[],
        timeUTC:utcDate,
        isFirstGroup,
        createdAt:firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    closeRuinsCreateModal();
    return;
  }

  const ruinName=(el.ruinNameInput.value||"").trim();
  if(!ruinName){
    alert("유적명을 입력하세요.");
    return;
  }

  if(state.editingRuinsPartyId){
    await partiesRef("ruins").doc(state.editingRuinsPartyId).update({name:ruinName,ruinName,timeUTC:utcDate});
  }else{
    await partiesRef("ruins").add({
      type:"ruins",
      event:"ruins",
      name:ruinName,
      ruinName,
      createdBy:state.currentUser,
      members:[],
      rallyLeader:"",
      maxMembers:15,
      timeUTC:utcDate,
      createdAt:firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  closeRuinsCreateModal();
};
window.setRallyLeader=async function(id,name){
  if(!state.isAdmin)return;

  const p=state.parties.find(v=>v.id===id);
  if(!p||!p.members.includes(name))return;

  await partiesRef("ruins").doc(id).update({rallyLeader:name});
};

function fallbackCopy(text){
  const ta=document.createElement("textarea");
  ta.value=text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
  alert("복사되었습니다.");
}

window.copyRuinsNotice=function(partyId){
  const p=state.parties.find(v=>v.id===partyId);
  if(!p)return;

  const members=[...p.members];
  const leader=p.rallyLeader||"";
  const others=members.filter(n=>n!==leader);
  const power=calcPower(members.length).toLocaleString("ko-KR");
  const d=toDate(p.timeUTC);
  const kstTime=d?`${String(d.getHours()).padStart(2,"0")}:00`:"-";
  const utcTime=d?`${String(d.getUTCHours()).padStart(2,"0")}:00`:"-";
  const title=(p.ruinName||p.name||"")+" 명단";
  const text=`${title}\n시간: ${kstTime}(UTC ${utcTime})\n집결장: ${leader||"-"}\n집결원: ${others.join(", ")}\n병력수: ${power}명`;

  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(()=>alert("복사되었습니다."),()=>fallbackCopy(text));
  }else fallbackCopy(text);
};

