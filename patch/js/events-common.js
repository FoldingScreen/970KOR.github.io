function renderPartyList(){
  if(state.currentEventId==="castle_battle"){
    renderCastleBattleEvent();
    return;
  }

  if(!state.parties.length){
    el.partyList.innerHTML=`<div class="empty-card">아직 생성된 파티가 없습니다.</div>`;
    return;
  }

  el.partyList.innerHTML=state.parties.map(p=>{
    if(state.currentEventId==="ruins")return renderRuinsCard(p);
    if(state.currentEventId==="holy_sword")return renderHolySwordCard(p);
    if(state.currentEventId==="triple_alliance")return renderTripleAllianceCard(p);
    return renderVikingCard(p);
  }).join("");
}

async function joinParty(id){
  await partiesRef(state.currentEventId).doc(id).update({
    members:firebase.firestore.FieldValue.arrayUnion(state.currentUser)
  });
}

async function leaveParty(id){
  await partiesRef(state.currentEventId).doc(id).update({
    members:firebase.firestore.FieldValue.arrayRemove(state.currentUser)
  });
}

async function deleteParty(id){
  if(!confirm("삭제하시겠습니까?"))return;

  await partiesRef(state.currentEventId).doc(id).delete();
}

async function kickMember(id,name){
  await partiesRef(state.currentEventId).doc(id).update({
    members:firebase.firestore.FieldValue.arrayRemove(name)
  });
}

/* ===== 캐슬 전투 끝 ===== */

/* =========================================================
   FIX PATCH: missing legacy functions restored + overrides
   - 기존 기능 보존용
   - 캐슬 전투 추가 기능 포함
========================================================= */

async function createParty(){
  if(state.currentEventId==="viking")return createVikingParty();
  if(state.currentEventId==="ruins")return openRuinsCreateModal();
  if(state.currentEventId==="holy_sword")return openHolySwordCreateModal();
  if(state.currentEventId==="triple_alliance")return openTripleAllianceCreateModal();
  if(state.currentEventId==="castle_battle")return openCastleBattleModal();
}
window.createParty=createParty;
window.joinParty=async function(id){
  const ref=partiesRef(state.currentEventId).doc(id);
  const snap=await ref.get();
  if(!snap.exists)return;

  const d=snap.data()||{};
  const members=normalizeMembers(d.members);

  if(state.currentEventId==="viking"&&myParty()){
    alert("이미 다른 파티에 참여 중입니다.");
    return;
  }

  if(members.includes(state.currentUser))return;

  if(state.currentEventId==="ruins"&&members.length>=15){
    alert("유적 파티는 최대 15명입니다.");
    return;
  }

  if(state.currentEventId==="viking"&&Number(d.maxMembers||0)>0&&members.length>=Number(d.maxMembers)){
    alert("이 파티는 정원이 가득 찼습니다.");
    return;
  }

  members.push(state.currentUser);
  await ref.update({members});
};

window.leaveParty=async function(id){
  const ref=partiesRef(state.currentEventId).doc(id);
  const snap=await ref.get();
  if(!snap.exists)return;

  const d=snap.data()||{};
  const members=normalizeMembers(d.members).filter(v=>v!==state.currentUser);
  const updates={members};

  if(state.currentEventId==="ruins"&&d.rallyLeader===state.currentUser)updates.rallyLeader=members[0]||"";
  if(state.currentEventId==="holy_sword")updates.areaAssignments=normalizeAssignments(d.areaAssignments).filter(v=>v.user!==state.currentUser);

  await ref.update(updates);
};

window.deleteParty=async function(id){
  const ref=partiesRef(state.currentEventId).doc(id);
  const snap=await ref.get();
  if(!snap.exists)return;

  const d=snap.data()||{};
  const ok=state.isAdmin||d.createdBy===state.currentUser;

  if(!ok){
    alert("삭제 권한이 없습니다.");
    return;
  }

  if(!confirm("정말 이 파티를 삭제하시겠습니까?"))return;
  await ref.delete();
};

window.kickMember=async function(id,name){
  const p=state.parties.find(v=>v.id===id);
  if(!p)return;

  const ok=state.isAdmin||p.createdBy===state.currentUser;
  if(!ok)return;

  if(!confirm(`${name} 님을 추방하시겠습니까?`))return;

  const ref=partiesRef(state.currentEventId).doc(id);
  const members=normalizeMembers(p.members).filter(v=>v!==name);
  const updates={members};

  if(state.currentEventId==="ruins"&&p.rallyLeader===name)updates.rallyLeader=members[0]||"";
  if(state.currentEventId==="holy_sword")updates.areaAssignments=normalizeAssignments(p.areaAssignments).filter(v=>v.user!==name);

  await ref.update(updates);
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

window.copyRearrangeColumns=function(){
  const activeEntries=state.rearrangeEntries.filter(v=>!isHiddenTestNickname(v.user)&&!v.excluded);
  const grouped={
    "곰1":getDisplayedRearrangeEntries(activeEntries.filter(v=>(v.desiredGroup||"곰1")==="곰1")),
    "곰2":getDisplayedRearrangeEntries(activeEntries.filter(v=>v.desiredGroup==="곰2"))
  };

  const lines=["[자리 재배치 결과]"];

  Object.entries(grouped).forEach(([groupName,displayedEntries])=>{
    const columns={1:[],2:[],3:[],4:[],5:[]};
    const moveNeeded=[];

    displayedEntries.forEach((entry,idx)=>{
      const rank=idx+1;
      const col=getRearrangeColumn(rank);
      if(!entry)return;

      columns[col].push(entry.user);

      const existingColumn=Number(entry.existingColumn||0);
      if(existingColumn>0&&existingColumn!==col)moveNeeded.push(`${entry.user}(${existingColumn}→${col})`);
    });

    lines.push("",`[${groupName}]`);
    lines.push(`1열: ${columns[1].join(", ")}`);
    lines.push(`2열: ${columns[2].join(", ")}`);
    lines.push(`3열: ${columns[3].join(", ")}`);
    lines.push(`4열: ${columns[4].join(", ")}`);
    lines.push(`5열: ${columns[5].join(", ")}`);
    lines.push("[이동 필요 인원]");
    lines.push(...(moveNeeded.length?moveNeeded:["없음"]));
  });

  const text=lines.join("\n");

  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(()=>alert("순열이 복사되었습니다."),()=>fallbackCopy(text));
  }else fallbackCopy(text);
};

window.showAllUsers=async function(){
  const usersSnap=await db.collection("users").get();
  const joined=new Set();

  if(state.currentEventId==="rearrange")state.rearrangeEntries.forEach(v=>joined.add(v.user));
  else if(state.currentEventId==="castle_battle")state.parties.forEach(p=>joined.add(p.user));
  else state.parties.forEach(p=>normalizeMembers(p.members).forEach(n=>joined.add(n)));

  const all=[];
  usersSnap.forEach(doc=>{
    if(!isHiddenTestNickname(doc.id))all.push(doc.id);
  });

  all.sort((a,b)=>a.localeCompare(b,"ko"));

  el.joinedUsers.innerHTML=renderNameColumns(all.filter(n=>joined.has(n)));
  el.notJoinedUsers.innerHTML=renderNameColumns(all.filter(n=>!joined.has(n)));
  el.userModal.classList.remove("hidden");
  syncOverlay();
};

function renderNameColumns(arr){
  if(!arr.length)return`<div class="name-item">(없음)</div>`;
  return arr.map(v=>`<div class="name-item">${escapeHtml(v)}</div>`).join("");
}

function closeUserModal(){
  el.userModal?.classList.add("hidden");
  syncOverlay();
}
window.closeUserModal=closeUserModal;

window.showAdminLogs=async function(){
  if(!state.isAdmin){
    alert("권한이 없습니다.");
    return;
  }

  const snap=await db.collection("adminLogs").orderBy("createdAt","desc").limit(50).get();
  const items=[];
  snap.forEach(doc=>items.push({id:doc.id,...doc.data()}));

  el.logList.innerHTML=items.length
    ? items.map(log=>`
      <div class="log-item">
        <div class="log-top">
          <div class="log-action">${escapeHtml(log.action||"")}</div>
          <div class="muted">${log.admin?escapeHtml(log.admin):""}</div>
        </div>
        <div class="muted">이벤트: ${escapeHtml(log.event||"-")}</div>
        <div class="muted">${escapeHtml(JSON.stringify(log.payload||{}))}</div>
      </div>
    `).join("")
    : `<div class="empty-card">운영 로그가 없습니다.</div>`;

  el.logModal.classList.remove("hidden");
  syncOverlay();
  closeAdminMenu();
};

function closeLogModal(){
  el.logModal?.classList.add("hidden");
  syncOverlay();
}
window.closeLogModal=closeLogModal;
