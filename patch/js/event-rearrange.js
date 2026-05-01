function renderExcludedRearrangeList(entries){
  if(!state.isAdmin||!entries.length)return"";

  const items=entries.map(entry=>`
    <div class="member-line">
      <span>${escapeHtml(entry.user)}</span>
      <button class="rank-edit-btn" onclick="openRearrangeRankEditModal('${escapeJs(entry.user)}')">관리</button>
    </div>
  `).join("");

  return`
    <div class="party-card">
      <div class="party-title">제외 인원</div>
      <div class="party-sub">복구하려면 관리 버튼에서 제외 해제를 하세요.</div>
      <div class="member-list">${items}</div>
    </div>
  `;
}

function renderRearrangeTable(entries){
  if(!entries.length)return`<div class="rank-empty">입력된 데이터가 없습니다.</div>`;

  const rows=entries.map((entry,idx)=>{
    const rank=idx+1;
    const currentColumn=getRearrangeColumn(rank);
    const rowClass=entry&&entry.user===state.currentUser?"rank-row-me":"";

    if(!entry){
      return`
        <tr class="${rowClass}">
          <td>${rank}</td>
          <td>${getLayoutLabel(rank)}</td>
          <td class="left muted">공란</td>
          <td>-</td>
          <td>-</td>
          <td>-</td>
          <td class="left">-</td>
          <td>-</td>
          <td>-</td>
        </tr>
      `;
    }

    const powerText=entry.power>0?Number(entry.power).toLocaleString("ko-KR"):"-";
    const noteText=entry.note?escapeHtml(entry.note):"-";
    const desiredGroupText=entry.desiredGroup||"곰1";
    const existingText=entry.existingColumn>0?String(entry.existingColumn):"-";
    const move=getMoveDisplay(entry.existingColumn,currentColumn);

    return`
      <tr class="${rowClass}">
        <td>${rank}</td>
        <td>${getLayoutLabel(rank)}</td>
        <td class="left ${entry.user===state.currentUser?"my-name":""}">${escapeHtml(entry.user)}</td>
        <td>${escapeHtml(entry.stageText||"-")}</td>
        <td>${powerText}</td>
        <td>${escapeHtml(desiredGroupText)}</td>
        <td class="left">${noteText}</td>
        <td>${existingText}</td>
        <td>
          <span class="${move.className}">${escapeHtml(move.text)}</span>
          ${state.isAdmin?` <button class="rank-edit-btn" onclick="openRearrangeRankEditModal('${escapeJs(entry.user)}')">관리</button>`:""}
        </td>
      </tr>
    `;
  }).join("");

  return`
    <div class="rank-table-wrap">
      <table class="rank-table">
        <colgroup><col><col><col><col><col><col><col><col><col></colgroup>
        <thead>
          <tr>
            <th>순위</th>
            <th>순열</th>
            <th>닉네임</th>
            <th>스테이지</th>
            <th>전투력</th>
            <th>희망</th>
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

function renderRearrangeGuide(){
  return`<div class="layout-guide-wrap"><img src="자리 순열.png" alt="자리 순열 안내도" class="layout-guide-image" /></div>`;
}

function renderRearrangeEvent(){
  const mine=myRearrangeEntry();
  const activeEntries=state.rearrangeEntries.filter(v=>!isHiddenTestNickname(v.user)&&!v.excluded);
  const excludedEntries=state.rearrangeEntries.filter(v=>!isHiddenTestNickname(v.user)&&v.excluded);

  const bear1Entries=getDisplayedRearrangeEntries(activeEntries.filter(v=>(v.desiredGroup||"곰1")==="곰1"));
  const bear2Entries=getDisplayedRearrangeEntries(activeEntries.filter(v=>v.desiredGroup==="곰2"));

  const mineCard=state.rearrangeInputEnabled
    ? `<div class="party-card"><div class="party-title">내 진척도</div><div class="party-sub">빛나는 첨탑 최고 스테이지</div><div class="party-sub">현재 입력값: ${mine?escapeHtml(mine.stageText):"미입력"}</div><div class="party-sub">최종 수정: ${mine?formatDateTime(mine.updatedAt):"-"}</div><div class="card-actions"><button onclick="openMyRearrangeModal()">${mine?"수정":"입력"}</button></div></div>`
    : `<div class="party-card"><div class="party-title">내 진척도</div><div class="party-sub">빛나는 첨탑 최고 스테이지</div><div class="party-sub">현재 입력값: ${mine?escapeHtml(mine.stageText):"미입력"}</div><div class="party-sub">최종 수정: ${mine?formatDateTime(mine.updatedAt):"-"}</div><div class="party-sub">현재 개인 입력은 일시 중지되어 있습니다.</div><div class="card-actions"><button disabled>입력 일시중지</button></div></div>`;

  let rankingCard="";
  let guideCard="";

  if(state.isAdmin||state.rearrangePublic){
    rankingCard=`
      <div class="party-card rank-table-card">
        <div class="party-title">진척도 순위표 - 곰1</div>
        <div class="party-sub">${state.isAdmin?(state.rearrangePublic?"현재 전체 공개 상태입니다.":"현재 운영진만 볼 수 있습니다."):"공개된 순위입니다."}</div>
        <div class="card-actions"><button onclick="copyRearrangeColumns()">복사</button></div>
        ${renderRearrangeTable(bear1Entries)}
      </div>

      <div class="party-card rank-table-card">
        <div class="party-title">진척도 순위표 - 곰2</div>
        ${renderRearrangeTable(bear2Entries)}
      </div>
    `;

    guideCard=`
      <div class="party-card layout-guide-card">
        <div class="party-title">순열 안내 예시</div>
        <div class="party-sub">빨(1), 주(2), 노(3), 초(4), 파(5)</div>
        <div class="card-actions"><button onclick="openExampleImageModal('guide')">예시 크게 보기</button></div>
        ${renderRearrangeGuide()}
      </div>
    `;
  }else{
    rankingCard=`
      <div class="party-card">
        <div class="party-title">진척도 순위</div>
        <div class="party-sub">아직 공개되지 않았습니다.</div>
        <div class="party-sub">운영진 공개 후 전체 유저가 확인할 수 있습니다.</div>
      </div>
    `;
  }

  const excludedCard=renderExcludedRearrangeList(excludedEntries);
  el.partyList.innerHTML=mineCard+rankingCard+excludedCard+guideCard;
}

function lockRearrangeInputForManualTap(){
  el.rearrangeStageInput?.setAttribute("readonly","readonly");
  el.rearrangeStageInput?.blur();
}

function unlockRearrangeInput(){
  if(el.rearrangeStageInput?.hasAttribute("readonly"))el.rearrangeStageInput.removeAttribute("readonly");
}

if(el.rearrangeStageInput){
  const unlockAndFocus=()=>{
    unlockRearrangeInput();
    setTimeout(()=>{
      try{el.rearrangeStageInput.focus({preventScroll:true});}
      catch(_){el.rearrangeStageInput.focus();}
    },0);
  };

  el.rearrangeStageInput.addEventListener("pointerdown",unlockAndFocus);
  el.rearrangeStageInput.addEventListener("touchstart",unlockAndFocus,{passive:true});
  el.rearrangeStageInput.addEventListener("mousedown",unlockAndFocus);
}

window.openMyRearrangeModal=function(){
  el.rearrangeModalTitle.textContent="내 진척도 입력";
  el.rearrangeSubmitBtn.textContent="저장";

  const mine=myRearrangeEntry();
  el.rearrangeStageInput.value=mine?mine.stageText:"";

  lockRearrangeInputForManualTap();
  el.rearrangeModal.classList.remove("hidden");
  syncOverlay();

  setTimeout(()=>{
    if(document.activeElement&&typeof document.activeElement.blur==="function")document.activeElement.blur();
    el.rearrangeStageInput.blur();
  },80);
};

function closeRearrangeModal(){
  el.rearrangeStageInput?.blur();
  el.rearrangeStageInput?.removeAttribute("readonly");
  el.rearrangeModal?.classList.add("hidden");
  syncOverlay();
}
window.closeRearrangeModal=closeRearrangeModal;

function openExampleImageModal(type="tower"){
  if(type==="guide"){
    el.exampleImageModalTitle.textContent="순열 안내 예시";
    el.exampleImageModalImg.src="자리 순열.png";
    el.exampleImageModalImg.alt="자리 순열 안내 예시";
  }else{
    el.exampleImageModalTitle.textContent="입력 예시 크게 보기";
    el.exampleImageModalImg.src="빛나는첨탑순위.png";
    el.exampleImageModalImg.alt="빛나는 첨탑 순위 예시 크게 보기";
  }

  el.exampleImageModal.classList.remove("hidden");
  syncOverlay();
}
window.openExampleImageModal=openExampleImageModal;

function closeExampleImageModal(){
  el.exampleImageModal?.classList.add("hidden");
  syncOverlay();
}
window.closeExampleImageModal=closeExampleImageModal;

function parseStageText(raw){
  const value=String(raw||"").trim();
  const parts=value.split("-");

  if(parts.length!==2||parts[0]===""||parts[1]==="")return null;

  const stageMajor=Number(parts[0]);
  const stageMinor=Number(parts[1]);

  if(!Number.isInteger(stageMajor)||!Number.isInteger(stageMinor)||stageMajor<0||stageMinor<0)return null;

  return{stageMajor,stageMinor};
}

window.submitRearrangeProgress=async function(){
  const raw=(el.rearrangeStageInput.value||"").trim();
  const parsed=parseStageText(raw);

  if(!parsed){
    alert("최고 스테이지는 15-4 형식으로 입력하세요.");
    return;
  }

  await rearrangeProgressRef().doc(state.currentUser).set({
    user:state.currentUser,
    stageText:raw,
    stageMajor:parsed.stageMajor,
    stageMinor:parsed.stageMinor,
    updatedAt:firebase.firestore.FieldValue.serverTimestamp(),
    createdAt:state.rearrangeProgressEntries.find(v=>v.user===state.currentUser)?.createdAt||firebase.firestore.FieldValue.serverTimestamp()
  },{merge:true});

  closeExampleImageModal();
  closeRearrangeModal();
  syncOverlay();
};

window.openRearrangeRankEditModal=function(userName=""){
  if(!state.isAdmin){
    alert("권한이 없습니다.");
    return;
  }

  ensureRankingExtraFields();

  const entry=userName?state.rearrangeEntries.find(v=>v.user===userName):null;
  if(!entry){
    alert("대상을 찾을 수 없습니다.");
    return;
  }

  state.editingRearrangeRankUser=entry.user;
  el.rearrangeRankEditTitle.textContent="순위표 관리";
  el.rankEditSubmitBtn.textContent="저장";
  el.rankEditDeleteBtn.classList.remove("hidden");
  el.rankEditNicknameInput.value=entry.user||"";
  el.rankEditStageInput.value=entry.stageText||"";
  el.rankEditPowerInput.value=entry.power>0?String(entry.power):"";
  el.rankEditNoteInput.value=entry.note||"";

  const hopeSelect=document.getElementById("rankEditHopeSelect");
  if(hopeSelect)hopeSelect.value=entry.desiredGroup||"곰1";

  const existingInput=document.getElementById("rankEditExistingInput");
  if(existingInput)existingInput.value=entry.existingColumn>0?String(entry.existingColumn):"";

  const excludeBtn=document.getElementById("rankEditExcludeBtn");
  if(excludeBtn){
    excludeBtn.textContent=entry.excluded?"제외 해제":"목록에서 제외";
    excludeBtn.onclick=toggleRearrangeExcluded;
  }

  el.rankEditNicknameInput.readOnly=true;
  el.rankEditStageInput.readOnly=true;
  el.rankEditDeleteBtn.textContent="관리값 삭제";
  el.rearrangeRankEditModal.classList.remove("hidden");
  syncOverlay();
};

function closeRearrangeRankEditModal(){
  state.editingRearrangeRankUser="";
  el.rankEditNicknameInput.readOnly=false;
  el.rankEditStageInput.readOnly=false;
  el.rearrangeRankEditModal?.classList.add("hidden");
  syncOverlay();
}
window.closeRearrangeRankEditModal=closeRearrangeRankEditModal;

window.toggleRearrangeExcluded=async function(){
  if(!state.isAdmin)return;

  const user=state.editingRearrangeRankUser||"";
  if(!user)return;

  const current=state.rearrangeEntries.find(v=>v.user===user);
  if(!current)return;

  await rearrangeRankingRef().doc(user).set({
    user,
    excluded:!current.excluded,
    updatedAt:firebase.firestore.FieldValue.serverTimestamp()
  },{merge:true});

  closeRearrangeRankEditModal();
};

window.submitRearrangeRankEdit=async function(){
  if(!state.isAdmin)return;

  const user=state.editingRearrangeRankUser||"";
  if(!user)return;

  const current=state.rearrangeEntries.find(v=>v.user===user);
  const powerRaw=(el.rankEditPowerInput.value||"").trim();
  const note=(el.rankEditNoteInput.value||"").trim();
  const desiredGroup=document.getElementById("rankEditHopeSelect")?.value||"곰1";
  const existingRaw=(document.getElementById("rankEditExistingInput")?.value||"").trim();

  let power=0;
  if(powerRaw!==""){
    power=Number(powerRaw);
    if(!Number.isInteger(power)||power<0){
      alert("전투력은 0 이상의 정수로 입력하세요.");
      return;
    }
  }

  let existingColumn=0;
  if(existingRaw!==""){
    existingColumn=Number(existingRaw);
    if(!Number.isInteger(existingColumn)||existingColumn<1){
      alert("기존은 1 이상의 정수로 입력하세요.");
      return;
    }
  }

  await rearrangeRankingRef().doc(user).set({
    user,
    power,
    note,
    desiredGroup,
    existingColumn,
    excluded:!!current?.excluded,
    updatedAt:firebase.firestore.FieldValue.serverTimestamp()
  },{merge:true});

  closeRearrangeRankEditModal();
};

window.deleteRearrangeRankRow=async function(){
  if(!state.isAdmin)return;

  const user=state.editingRearrangeRankUser||"";
  if(!user)return;

  await rearrangeRankingRef().doc(user).delete();
  closeRearrangeRankEditModal();
};

window.toggleRearrangePublic=async function(){
  if(!state.isAdmin)return;
  await eventRef("rearrange").set({rankingPublic:!state.rearrangePublic},{merge:true});
};

window.toggleRearrangeInputEnabled=async function(){
  if(!state.isAdmin||state.currentUser!=="병풍")return;
  await eventRef("rearrange").set({rearrangeInputEnabled:!state.rearrangeInputEnabled},{merge:true});
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

