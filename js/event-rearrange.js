const REARRANGE_APPLICATION_VERSION="bear-2026-05";
const REARRANGE_GUIDE_BEAR1_IMAGE="자리순열_곰1.png";
const REARRANGE_GUIDE_BEAR2_IMAGE="자리순열_곰2.png";
function normalizeRearrangeGroup(value){
  const v=String(value||"").replace(/\s+/g,"").trim();
  if(v==="곰1"||v==="곰１")return"곰1";
  if(v==="곰2"||v==="곰２")return"곰2";
  if(v==="상관없음"||v==="상관무"||v==="상관X")return"상관없음";
  if(v==="유동적"||v==="유동")return"유동적";
  return v||"";
}

function isBearGroup(value){
  const v=normalizeRearrangeGroup(value);
  return v==="곰1"||v==="곰2";
}

function getDesiredBadge(entry){
  const desired=normalizeRearrangeGroup(entry?.desiredGroup);
  if(desired==="상관없음")return` <span class="rearrange-badge any">상관없음</span>`;
  if(desired==="유동적")return` <span class="rearrange-badge flex">유동</span>`;
  return"";
}

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

function renderRearrangeTable(entries,flexEntries=[],groupName="곰1"){
  const visibleEntries=(entries||[]).filter(Boolean);
  const visibleFlexEntries=(flexEntries||[]).filter(Boolean);

  if(!visibleEntries.length&&!visibleFlexEntries.length){
    return`<div class="rank-empty">아직 아무도 없습니다.</div>`;
  }

  const rows=visibleEntries.map((entry,idx)=>{
    const rank=idx+1;
    const rowClass=entry.user===state.currentUser?"rank-row-me":"";
    const powerText=entry.power>0?Number(entry.power).toLocaleString("ko-KR"):"-";
    const noteText=entry.note?escapeHtml(entry.note):"-";

    return`
      <tr class="${rowClass}">
        <td>${rank}</td>
        <td>${getBearLayoutLabel(rank,groupName)}</td>
        <td class="left ${entry.user===state.currentUser?"my-name":""}">${escapeHtml(entry.user)}${getDesiredBadge(entry)}</td>
        <td>${escapeHtml(entry.stageText||"-")}</td>
        <td>${powerText}</td>
        <td class="left">${noteText}</td>
        <td>${state.isAdmin?`<button class="rank-edit-btn" onclick="openRearrangeRankEditModal('${escapeJs(entry.user)}')">관리</button>`:"-"}</td>
      </tr>
    `;
  }).join("");

    const flexRows=visibleFlexEntries.map(entry=>{
    const rowClass=entry.user===state.currentUser?"rank-row-me":"";
    const powerText=entry.power>0?Number(entry.power).toLocaleString("ko-KR"):"-";
    const noteText=entry.note?escapeHtml(entry.note):"-";

    return`
      <tr class="${rowClass} rearrange-flex-row">
        <td>유동</td>
        <td>유동</td>
        <td class="left ${entry.user===state.currentUser?"my-name":""}">${escapeHtml(entry.user)}${getDesiredBadge(entry)}</td>
        <td>${escapeHtml(entry.stageText||"-")}</td>
        <td>${powerText}</td>
        <td class="left">${noteText}</td>
        <td>${state.isAdmin?`<button class="rank-edit-btn" onclick="openRearrangeRankEditModal('${escapeJs(entry.user)}')">관리</button>`:"-"}</td>
      </tr>
    `;
  }).join("");

  return`
    <div class="rank-table-wrap">
      <table class="rank-table rearrange-compact-table">
        <thead>
          <tr>
            <th>순위</th>
            <th>순열</th>
            <th>닉네임</th>
            <th>스테이지</th>
            <th>전투력</th>
            <th>비고</th>
            <th>관리</th>
          </tr>
        </thead>
        <tbody>${rows}${flexRows}</tbody>
      </table>
    </div>
  `;
}

function renderRearrangeGuide(){
  return`
    <div class="layout-guide-wrap two-guides">
      <img
        src="${REARRANGE_GUIDE_BEAR1_IMAGE}"
        alt="곰 1 순열 안내 예시"
        class="layout-guide-image"
        onclick="openExampleImageModal('guideBear1')"
      />
      <img
        src="${REARRANGE_GUIDE_BEAR2_IMAGE}"
        alt="곰 2 순열 안내 예시"
        class="layout-guide-image"
        onclick="openExampleImageModal('guideBear2')"
      />
    </div>
  `;
}

function isCurrentRearrangeApplication(entry){
  return (
    entry &&
    entry.applicationVersion===REARRANGE_APPLICATION_VERSION &&
    String(entry.stageText||"").trim() &&
    isBearGroup(entry.existingGroup) &&
    ["곰1","곰2","상관없음","유동적"].includes(normalizeRearrangeGroup(entry.desiredGroup))
  );
}

function getBearLayoutColumn(rank, groupName){
  if(groupName==="곰1"){
    if(rank<=19)return 3;
    if(rank<=27)return 1;
    if(rank<=42)return 2;
    return 4;
  }

  if(groupName==="곰2"){
    if(rank<=17)return 3;
    if(rank<=25)return 1;
    if(rank<=40)return 2;
    return 4;
  }

  return 4;
}

function getBearLayoutLabel(rank, groupName){
  return `${getBearLayoutColumn(rank, groupName)}열`;
}

function getCheckedRearrangeValue(name){
  return document.querySelector(`input[name="${name}"]:checked`)?.value||"";
}

function setCheckedRearrangeValue(name,value){
  document.querySelectorAll(`input[name="${name}"]`).forEach(input=>{
    input.checked=input.value===value;
    input.closest(".rearrange-check-card")?.classList.toggle("checked",input.checked);
  });
}

window.selectRearrangeCheckbox=function(name,clicked){
  document.querySelectorAll(`input[name="${name}"]`).forEach(input=>{
    if(input!==clicked)input.checked=false;
    input.closest(".rearrange-check-card")?.classList.toggle("checked",input.checked);
  });
};

function getRearrangeGroups(){
  const allEntries=state.rearrangeEntries.filter(v=>!isHiddenTestNickname(v.user));
  const baselineEntries=allEntries.slice();

  const appliedEntries=allEntries.filter(isCurrentRearrangeApplication);
  const activeEntries=appliedEntries.filter(v=>!v.excluded);
  const excludedEntries=appliedEntries.filter(v=>v.excluded);

  const bear1Normal=activeEntries.filter(v=>normalizeRearrangeGroup(v.desiredGroup)==="곰1");
  const bear2Normal=activeEntries.filter(v=>{
    const desired=normalizeRearrangeGroup(v.desiredGroup);
    return desired==="곰2"||desired==="상관없음";
  });

  const flexEntries=activeEntries.filter(v=>normalizeRearrangeGroup(v.desiredGroup)==="유동적");
  const flexApproved=flexEntries.filter(v=>!!v.flexApproved).slice(0,10);
const flexApprovedBear1=flexApproved.slice(0,5);
const flexApprovedBear2=flexApproved.slice(5,10);

  const moveRequests=activeEntries.filter(v=>{
    const existing=normalizeRearrangeGroup(v.existingGroup);
    const desired=normalizeRearrangeGroup(v.desiredGroup);
    return isBearGroup(existing)&&isBearGroup(desired)&&existing!==desired;
  });

  const anyEntries=activeEntries.filter(v=>normalizeRearrangeGroup(v.desiredGroup)==="상관없음");

  return{
    activeEntries,
    baselineEntries,
    excludedEntries,
    bear1Entries:getDisplayedRearrangeEntries(bear1Normal),
    bear2Entries:getDisplayedRearrangeEntries(bear2Normal),
    flexEntries,
    flexApproved,
    flexApprovedBear1,
    flexApprovedBear2,
    moveRequests,
    anyEntries
  };
}

function renderRearrangeViewTabs(){
  if(!state.isAdmin)return"";
  const view=state.rearrangeView||"board";

  return`
    <div class="rearrange-top-tabs">
      <button type="button" class="${view==="board"?"active":""}" onclick="setRearrangeView('board')">배치표</button>
      <button type="button" class="${view==="admin"?"active":""}" onclick="setRearrangeView('admin')">관리</button>
    </div>
  `;
}

function renderRearrangeAdminTabs(groups){
  const tab=state.rearrangeAdminTab||"move";
  const approvedCount=groups.flexApproved.length;

  return`
    <div class="rearrange-admin-summary">
      <span>이동 희망 ${groups.moveRequests.length}명</span>
      <span>상관없음 ${groups.anyEntries.length}명</span>
      <span>유동적 ${groups.flexEntries.length}명 / 승인 ${approvedCount}명</span>
      <span>제외 ${groups.excludedEntries.length}명</span>
    </div>
    <div class="rearrange-view-tabs small">
      <button type="button" class="${tab==="move"?"active":""}" onclick="setRearrangeAdminTab('move')">이동 희망</button>
      <button type="button" class="${tab==="any"?"active":""}" onclick="setRearrangeAdminTab('any')">상관없음</button>
      <button type="button" class="${tab==="flex"?"active":""}" onclick="setRearrangeAdminTab('flex')">유동적</button>
      <button type="button" class="${tab==="excluded"?"active":""}" onclick="setRearrangeAdminTab('excluded')">제외</button>
      <button type="button" class="${tab==="baseline"?"active":""}" onclick="setRearrangeAdminTab('baseline')">기존 순위</button>
    </div>
  `;
}

function renderAdminSimpleTable(entries,type){
  if(!entries.length)return`<div class="rank-empty">대상자가 없습니다.</div>`;

  const rows=entries.map(entry=>{
    const powerText=entry.power>0?Number(entry.power).toLocaleString("ko-KR"):"-";
    const noteText=entry.note?escapeHtml(entry.note):"-";
    const existing=normalizeRearrangeGroup(entry.existingGroup)||"-";
    const desired=normalizeRearrangeGroup(entry.desiredGroup)||"-";

    if(type==="move"){
      return`
        <tr>
          <td class="left">${escapeHtml(entry.user)}</td>
          <td>${escapeHtml(existing)}</td>
          <td>${escapeHtml(desired)}</td>
          <td>${escapeHtml(entry.stageText||"-")}</td>
          <td>${powerText}</td>
          <td class="left">${noteText}</td>
        </tr>
      `;
    }

    return`
      <tr>
        <td class="left">${escapeHtml(entry.user)}</td>
        <td>${escapeHtml(existing)}</td>
        <td>곰2</td>
        <td>${escapeHtml(entry.stageText||"-")}</td>
        <td>${powerText}</td>
        <td class="left">${noteText}</td>
      </tr>
    `;
  }).join("");

  const header=type==="move"
    ? `<tr><th>닉네임</th><th>현재</th><th>희망</th><th>스테이지</th><th>전투력</th><th>비고</th></tr>`
    : `<tr><th>닉네임</th><th>현재</th><th>자동배치</th><th>스테이지</th><th>전투력</th><th>비고</th></tr>`;

  return`
    <div class="rank-table-wrap">
      <table class="rank-table rearrange-admin-table">
        <thead>${header}</thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderExcludedAdminTable(entries){
  if(!entries.length)return`<div class="rank-empty">제외 인원이 없습니다.</div>`;

  const rows=entries.map(entry=>{
    const powerText=entry.power>0?Number(entry.power).toLocaleString("ko-KR"):"-";
    const noteText=entry.note?escapeHtml(entry.note):"-";
    const existing=normalizeRearrangeGroup(entry.existingGroup)||"-";
    const desired=normalizeRearrangeGroup(entry.desiredGroup)||"-";

    return`
      <tr>
        <td class="left">${escapeHtml(entry.user)}</td>
        <td>${escapeHtml(existing)}</td>
        <td>${escapeHtml(desired)}</td>
        <td>${escapeHtml(entry.stageText||"-")}</td>
        <td>${powerText}</td>
        <td class="left">${noteText}</td>
        <td><button class="rank-edit-btn" onclick="openRearrangeRankEditModal('${escapeJs(entry.user)}')">관리</button></td>
      </tr>
    `;
  }).join("");

  return`
    <div class="party-sub">배치표에서 제외된 인원입니다. 관리 버튼에서 제외 해제할 수 있습니다.</div>
    <div class="rank-table-wrap">
      <table class="rank-table rearrange-admin-table">
        <thead>
          <tr>
            <th>닉네임</th>
            <th>현재</th>
            <th>희망</th>
            <th>스테이지</th>
            <th>전투력</th>
            <th>비고</th>
            <th>관리</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderFlexAdminTable(entries){
  const approvedCount=entries.filter(v=>!!v.flexApproved).length;

  if(!entries.length){
    return`
      <div class="party-sub">유동 승인 ${approvedCount} / 10명</div>
      <div class="rank-empty">유동적 신청자가 없습니다.</div>
    `;
  }

  const rows=entries.map(entry=>{
    const powerText=entry.power>0?Number(entry.power).toLocaleString("ko-KR"):"-";
    const existing=normalizeRearrangeGroup(entry.existingGroup)||"-";
    const approved=!!entry.flexApproved;

    return`
      <tr>
        <td class="left">${escapeHtml(entry.user)}</td>
        <td>${escapeHtml(existing)}</td>
        <td>${escapeHtml(entry.stageText||"-")}</td>
        <td>${powerText}</td>
        <td>${approved?"승인됨":"대기"}</td>
        <td><button class="rank-edit-btn" onclick="toggleRearrangeFlexApproved('${escapeJs(entry.user)}')">${approved?"승인 취소":"승인"}</button></td>
      </tr>
    `;
  }).join("");

  return`
    <div class="party-sub">유동 승인 ${approvedCount} / 10명</div>
    <div class="rank-table-wrap">
      <table class="rank-table rearrange-admin-table">
        <thead>
          <tr><th>닉네임</th><th>현재</th><th>스테이지</th><th>전투력</th><th>상태</th><th>관리</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderBaselineRankingTable(entries){
  const baselineTab=state.rearrangeBaselineTab||"2026-04";

  const rows=entries.map((entry,idx)=>{
    const powerText=entry.power>0?Number(entry.power).toLocaleString("ko-KR"):"-";
    const noteText=entry.note?escapeHtml(entry.note):"-";

    return`
      <tr>
        <td>${idx+1}</td>
        <td class="left">${escapeHtml(entry.user)}</td>
        <td>${escapeHtml(entry.stageText||"-")}</td>
        <td>${powerText}</td>
        <td>${escapeHtml(normalizeRearrangeGroup(entry.existingGroup)||"-")}</td>
        <td>${escapeHtml(normalizeRearrangeGroup(entry.desiredGroup)||"-")}</td>
        <td class="left">${noteText}</td>
      </tr>
    `;
  }).join("");

  return`
    <div class="rearrange-view-tabs tiny">
      <button type="button" class="${baselineTab==="2026-04"?"active":""}" onclick="setRearrangeBaselineTab('2026-04')">2026. 4. 기준</button>
    </div>
    <div class="rank-table-wrap">
      <table class="rank-table rearrange-admin-table">
        <thead>
          <tr><th>순위</th><th>닉네임</th><th>스테이지</th><th>전투력</th><th>현재</th><th>희망</th><th>비고</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderRearrangeAdminPanel(groups){
  const tab=state.rearrangeAdminTab||"move";
  let title="이동 희망";
  let body=renderAdminSimpleTable(groups.moveRequests,"move");

  if(tab==="any"){
    title="상관없음";
    body=renderAdminSimpleTable(groups.anyEntries,"any");
  }

  if(tab==="flex"){
    title="유동적";
    body=renderFlexAdminTable(groups.flexEntries);
  }

  if(tab==="excluded"){
    title="제외";
    body=renderExcludedAdminTable(groups.excludedEntries);
  }

if(tab==="baseline"){
  title="기존 순위";
  body=renderBaselineRankingTable(groups.baselineEntries);
}

  return`
    <div class="party-card rank-table-card rearrange-admin-card">
      <div class="party-title">운영진 확인 - ${title}</div>
      ${renderRearrangeAdminTabs(groups)}
      ${body}
    </div>
  `;
}

function renderRearrangeBoard(groups){
  const mobileTab=state.rearrangeBoardTab||"bear1";

  return`
    <div class="rearrange-mobile-tabs">
      <button type="button" class="${mobileTab==="bear1"?"active":""}" onclick="setRearrangeBoardTab('bear1')">곰 1</button>
      <button type="button" class="${mobileTab==="bear2"?"active":""}" onclick="setRearrangeBoardTab('bear2')">곰 2</button>
    </div>

    <div class="rearrange-board-force-grid">
      <div class="party-card rank-table-card rearrange-board-card rearrange-bear1-card ${mobileTab!=="bear1"?"mobile-hidden-card":""}">
        <div class="rearrange-board-head">
          <div class="party-title">곰 1(22:20, UTC 13:20) 배치표</div>
          <button type="button" class="rank-copy-btn" onclick="copyRearrangeColumns('곰1')">복사</button>
        </div>
        ${renderRearrangeTable(groups.bear1Entries,groups.flexApprovedBear1,"곰1")}
      </div>

      <div class="party-card rank-table-card rearrange-board-card rearrange-bear2-card ${mobileTab!=="bear2"?"mobile-hidden-card":""}">
        <div class="rearrange-board-head">
          <div class="party-title">곰 2(21:40, UTC 12:40) 배치표</div>
          <button type="button" class="rank-copy-btn" onclick="copyRearrangeColumns('곰2')">복사</button>
        </div>
        ${renderRearrangeTable(groups.bear2Entries,groups.flexApprovedBear2,"곰2")}
      </div>
    </div>
  `;
}

function getMyRearrangeDisplayInfo(mine,groups){
  const desired=normalizeRearrangeGroup(mine?.desiredGroup);

  if(desired==="곰1"){
    const list=(groups.bear1Entries||[]).filter(Boolean);
    const idx=list.findIndex(v=>v.user===mine.user);

    return{
      placement:"곰 1",
      layout:idx>=0?getBearLayoutLabel(idx+1,"곰1"):"-"
    };
  }

  if(desired==="곰2"||desired==="상관없음"){
    const list=(groups.bear2Entries||[]).filter(Boolean);
    const idx=list.findIndex(v=>v.user===mine.user);

    return{
      placement:desired==="상관없음"?"곰 2(상관없음)":"곰 2",
      layout:idx>=0?getBearLayoutLabel(idx+1,"곰2"):"-"
    };
  }

  if(desired==="유동적"){
    const approvedBear1=(groups.flexApprovedBear1||[]).some(v=>v.user===mine.user);
    const approvedBear2=(groups.flexApprovedBear2||[]).some(v=>v.user===mine.user);

    return{
      placement:"유동적",
      layout:(approvedBear1||approvedBear2)?"유동":"승인 대기"
    };
  }

  return{
    placement:"-",
    layout:"-"
  };
}

function renderRearrangeEvent(){
  const mine=myRearrangeEntry();
  const groups=getRearrangeGroups();

  const mineApplied=isCurrentRearrangeApplication(mine);
  const myDisplayInfo=mineApplied?getMyRearrangeDisplayInfo(mine,groups):null;

  const mineInfo=mineApplied?`
    <div class="rearrange-my-info-bar applied">
      <div class="rearrange-my-title">내 정보</div>
      <div class="rearrange-my-item">스테이지 <strong>${escapeHtml(mine.stageText)}</strong></div>
      <div class="rearrange-my-item">배치 <strong>${escapeHtml(myDisplayInfo.placement)}</strong></div>
      <div class="rearrange-my-item">순열 <strong>${escapeHtml(myDisplayInfo.layout)}</strong></div>
      <div class="rearrange-my-item">최종 수정 <strong>${formatDateTime(mine.updatedAt)}</strong></div>
      <button type="button" class="rearrange-my-edit-btn" ${state.rearrangeInputEnabled?"onclick=\"openMyRearrangeModal()\"":"disabled"}>
        ${state.rearrangeInputEnabled?"수정":"입력 일시중지"}
      </button>
    </div>
  `:`
    <div class="rearrange-my-info-bar not-applied">
      <div class="rearrange-my-title">내 정보</div>
      <div class="rearrange-my-item strong-alert">아직 입력하지 않았습니다.</div>
      <button type="button" class="rearrange-my-edit-btn" ${state.rearrangeInputEnabled?"onclick=\"openMyRearrangeModal()\"":"disabled"}>
        ${state.rearrangeInputEnabled?"입력하기":"입력 일시중지"}
      </button>
    </div>
  `;

let mainContent="";
const currentRearrangeView=state.isAdmin?(state.rearrangeView||"board"):"board";

if(state.isAdmin||state.rearrangePublic){
  mainContent=currentRearrangeView==="admin"?renderRearrangeAdminPanel(groups):renderRearrangeBoard(groups);
}else{
  mainContent=`
    <div class="party-card">
      <div class="party-title">자리 재배치표</div>
      <div class="party-sub">아직 공개되지 않았습니다.</div>
      <div class="party-sub">운영진 공개 후 전체 유저가 확인할 수 있습니다.</div>
    </div>
  `;
}

const guideCard=(state.isAdmin||state.rearrangePublic)&&currentRearrangeView==="board"?`
    <div class="party-card layout-guide-card rearrange-guide-card">
      ${renderRearrangeGuide()}
    </div>
  `:"";

  el.partyList.classList.add("rearrange-page-list");
  el.partyList.innerHTML=`
    <div class="rearrange-page">
<div class="rearrange-top-row">
  ${mineInfo}
  ${renderRearrangeViewTabs()}
</div>
      ${mainContent}
      ${guideCard}
    </div>
  `;
}
window.setRearrangeView=function(view){
  state.rearrangeView=view==="admin"?"admin":"board";
  renderRearrangeEvent();
};

window.setRearrangeAdminTab=function(tab){
  state.rearrangeAdminTab=["move","any","flex","excluded","baseline"].includes(tab)?tab:"move";
  renderRearrangeEvent();
};

window.setRearrangeBoardTab=function(tab){
  state.rearrangeBoardTab=tab==="bear2"?"bear2":"bear1";
  renderRearrangeEvent();
};

window.setRearrangeBaselineTab=function(tab){
  state.rearrangeBaselineTab=tab||"2026-04";
  renderRearrangeEvent();
};

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
  el.rearrangeModalTitle.textContent="내 자리 재배치 정보 입력";
  el.rearrangeSubmitBtn.textContent="저장";

  const mine=myRearrangeEntry();
  el.rearrangeStageInput.value=mine?mine.stageText:"";

  setCheckedRearrangeValue("rearrangeExistingGroup",normalizeRearrangeGroup(mine?.existingGroup)||"");
  setCheckedRearrangeValue("rearrangeDesiredGroup",normalizeRearrangeGroup(mine?.desiredGroup)||"");

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
  el.exampleImageModalTitle.style.display="block";

  if(type==="guideBear1"){
    el.exampleImageModalTitle.textContent="";
    el.exampleImageModalTitle.style.display="none";
    el.exampleImageModalImg.src=REARRANGE_GUIDE_BEAR1_IMAGE;
    el.exampleImageModalImg.alt="곰 1 순열 안내 예시";
  }else if(type==="guideBear2"){
    el.exampleImageModalTitle.textContent="";
    el.exampleImageModalTitle.style.display="none";
    el.exampleImageModalImg.src=REARRANGE_GUIDE_BEAR2_IMAGE;
    el.exampleImageModalImg.alt="곰 2 순열 안내 예시";
  }else{
    el.exampleImageModalTitle.textContent="입력 예시 크게 보기";
    el.exampleImageModalTitle.style.display="block";
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

  const existingGroup=normalizeRearrangeGroup(getCheckedRearrangeValue("rearrangeExistingGroup"));
  const desiredGroup=normalizeRearrangeGroup(getCheckedRearrangeValue("rearrangeDesiredGroup"));

  if(!isBearGroup(existingGroup)){
    alert("현재 배치된 곰을 선택하세요.");
    return;
  }

  if(!["곰1","곰2","상관없음","유동적"].includes(desiredGroup)){
    alert("희망하는 곰 배치를 선택하세요.");
    return;
  }

  const before=myRearrangeEntry();

  await rearrangeProgressRef().doc(state.currentUser).set({
    user:state.currentUser,
    stageText:raw,
    stageMajor:parsed.stageMajor,
    stageMinor:parsed.stageMinor,
    existingGroup,
    desiredGroup,
    applicationVersion:REARRANGE_APPLICATION_VERSION,
    updatedAt:firebase.firestore.FieldValue.serverTimestamp(),
    createdAt:state.rearrangeProgressEntries.find(v=>v.user===state.currentUser)?.createdAt||firebase.firestore.FieldValue.serverTimestamp()
  },{merge:true});

  await handleRearrangeMoveNotification(state.currentUser,before,{existingGroup,desiredGroup});

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

  let power=0;
  if(powerRaw!==""){
    power=Number(powerRaw);
    if(!Number.isInteger(power)||power<0){
      alert("전투력은 0 이상의 정수로 입력하세요.");
      return;
    }
  }

  await rearrangeRankingRef().doc(user).set({
    user,
    power,
    note,
    excluded:!!current?.excluded,
    flexApproved:!!current?.flexApproved,
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

window.toggleRearrangeFlexApproved=async function(user){
  if(!state.isAdmin)return;

  const entry=state.rearrangeEntries.find(v=>v.user===user);
  if(!entry)return;

  const next=!entry.flexApproved;
  const approvedCount=state.rearrangeEntries.filter(v=>!isHiddenTestNickname(v.user)&&!v.excluded&&normalizeRearrangeGroup(v.desiredGroup)==="유동적"&&v.flexApproved).length;

  if(next&&approvedCount>=10){
    alert("유동 승인 인원은 최대 10명입니다.");
    return;
  }

  await rearrangeRankingRef().doc(user).set({
    user,
    flexApproved:next,
    flexApprovedAt:next?firebase.firestore.FieldValue.serverTimestamp():null,
    flexApprovedBy:next?state.currentUser:"",
    updatedAt:firebase.firestore.FieldValue.serverTimestamp()
  },{merge:true});
};

window.copyRearrangeColumns=function(targetGroup=""){
  const groups=getRearrangeGroups();

  const grouped={
    "곰1":groups.bear1Entries,
    "곰2":groups.bear2Entries
  };

  const targetGroups=targetGroup&&grouped[targetGroup]
    ? [[targetGroup,grouped[targetGroup]]]
    : Object.entries(grouped);

  const lines=targetGroup
    ? [`[${targetGroup} 자리 재배치 결과]`]
    : ["[자리 재배치 결과]"];

  targetGroups.forEach(([groupName,displayedEntries])=>{
    const columns={1:[],2:[],3:[],4:[],유동:[]};

    displayedEntries.forEach((entry,idx)=>{
      const rank=idx+1;
      const col=getBearLayoutColumn(rank,groupName);
      if(!entry)return;
      columns[col].push(entry.user);
    });

    const flexList=groupName==="곰1" ? groups.flexApprovedBear1 : groups.flexApprovedBear2;

    flexList.forEach(entry=>{
      columns.유동.push(entry.user);
    });

    if(!targetGroup)lines.push("",`[${groupName}]`);
    lines.push(`1열: ${columns[1].join(", ")}`);
    lines.push(`2열: ${columns[2].join(", ")}`);
    lines.push(`3열: ${columns[3].join(", ")}`);
    lines.push(`4열: ${columns[4].join(", ")}`);
    if(columns.유동.length)lines.push(`유동: ${columns.유동.join(", ")}`);
  });

  const text=lines.join("\n");

  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(()=>alert("순열이 복사되었습니다."),()=>fallbackCopy(text));
  }else fallbackCopy(text);
};
