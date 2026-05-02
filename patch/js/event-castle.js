function getCastlePlacementList(){
  return["캐슬","포탑(동)","포탑(서)","포탑(남)","포탑(북)","미배치"];
}

function getCastleTgValue(tg,key){
  return tg&&tg[key]?String(tg[key]):"순금X";
}

function getCastleSortedEntries(){
  const rankMap=getRearrangeRankMap();

  return[...state.parties].sort((a,b)=>{
    const ra=rankMap[a.user]||999999;
    const rb=rankMap[b.user]||999999;

    if(ra!==rb)return ra-rb;

    return String(a.user).localeCompare(String(b.user),"ko");
  });
}

function openCastleBattleModal(){
  const mine=state.parties.find(v=>v.user===state.currentUser);

  if(mine){
    el.castleInfantrySelect.value=getCastleTgValue(mine.tg,"infantry");
    el.castleCavalrySelect.value=getCastleTgValue(mine.tg,"cavalry");
    el.castleArcherSelect.value=getCastleTgValue(mine.tg,"archer");
  }else{
    el.castleInfantrySelect.value="순금X";
    el.castleCavalrySelect.value="순금X";
    el.castleArcherSelect.value="순금X";
  }

  el.castleBattleModal.classList.remove("hidden");
  syncOverlay();
}

function closeCastleBattleModal(){
  el.castleBattleModal?.classList.add("hidden");
  syncOverlay();
}

window.openCastleBattleModal=openCastleBattleModal;
window.closeCastleBattleModal=closeCastleBattleModal;

window.submitCastleBattle=async function(){
  const tg={
    infantry:el.castleInfantrySelect.value,
    cavalry:el.castleCavalrySelect.value,
    archer:el.castleArcherSelect.value
  };

  const mine=state.parties.find(v=>v.user===state.currentUser);

  await partiesRef("castle_battle").doc(state.currentUser).set({
    type:"castle_battle",
    event:"castle_battle",
    user:state.currentUser,
    tg,
    placement:mine?.placement||"미배치",
    createdAt:mine?.createdAt||firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt:firebase.firestore.FieldValue.serverTimestamp()
  },{merge:true});

  closeCastleBattleModal();
};

function renderCastleBattleEvent(){
  const entries=getCastleSortedEntries();
  const placements=getCastlePlacementList();

  if(!entries.length){
    el.partyList.innerHTML=`<div class="empty-card">아직 신청자가 없습니다.</div>`;
    return;
  }

  const managePanel=state.isAdmin&&state.castleManageMode
    ? `
      <div class="party-card castle-manage-panel">
        <div class="party-title">캐슬 전투 배치 관리</div>
        <div class="form-group">
          <label>선택 인원 배치</label>
          <select id="castlePlacementBulkSelect" class="text-input">
            <option value="캐슬">캐슬</option>
            <option value="포탑(동)">포탑(동)</option>
            <option value="포탑(서)">포탑(서)</option>
            <option value="포탑(남)">포탑(남)</option>
            <option value="포탑(북)">포탑(북)</option>
            <option value="미배치">미배치</option>
          </select>
        </div>
        <div class="card-actions">
          <button onclick="applyCastlePlacement()">선택 인원 일괄 배치</button>
          <button onclick="deleteSelectedCastleBattleEntries()">선택 인원 삭제</button>
        </div>
      </div>
    `
    : "";

  const placementCards=placements.map(place=>{
    const sectionEntries=entries.filter(v=>(v.placement||"미배치")===place);

    const names=sectionEntries.length
      ? sectionEntries.map((entry,idx)=>{
          const status=place==="미배치"?"":idx<10?"정규":"예비";
          return`
            <div class="castle-name-chip ${entry.user===state.currentUser?"my-name":""}">
              ${state.isAdmin&&state.castleManageMode?`<input type="checkbox" class="castle-check" value="${escapeHtml(entry.id)}">`:""}
              <span>${escapeHtml(entry.user)}</span>
              ${status?`<small>${status}</small>`:""}
            </div>
          `;
        }).join("")
      : `<div class="castle-empty-small">-</div>`;

    return`
      <div class="party-card castle-mini-card">
        <div class="party-title">${escapeHtml(place)} ${place==="미배치"?"":`(${sectionEntries.length}명)`}</div>
        <div class="castle-name-list">${names}</div>
      </div>
    `;
  }).join("");

  const rows=entries.map((entry,idx)=>{
    const canDelete=state.isAdmin||entry.user===state.currentUser;

    return`
      <tr>
        <td>${idx+1}</td>
        <td class="left ${entry.user===state.currentUser?"my-name":""}">${escapeHtml(entry.user)}</td>
        <td>${escapeHtml(getCastleTgValue(entry.tg,"infantry"))}</td>
        <td>${escapeHtml(getCastleTgValue(entry.tg,"cavalry"))}</td>
        <td>${escapeHtml(getCastleTgValue(entry.tg,"archer"))}</td>
        <td>${escapeHtml(entry.placement||"미배치")}</td>
        <td>${canDelete?`<button class="rank-edit-btn" onclick="deleteCastleBattleEntry('${escapeJs(entry.id)}')">삭제</button>`:"-"}</td>
      </tr>
    `;
  }).join("");

  const applicantTable=`
    <div class="party-card rank-table-card castle-applicant-card">
      <div class="party-title">신청 인원 전체</div>
      <div class="rank-table-wrap">
        <table class="rank-table">
          <thead>
            <tr>
              <th>연번</th>
              <th>닉네임</th>
              <th>보병</th>
              <th>기병</th>
              <th>궁병</th>
              <th>배치</th>
              <th>삭제</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;

  el.partyList.innerHTML=managePanel+`<div class="castle-mini-grid">${placementCards}</div>`+applicantTable;
}

window.toggleCastleManageMode=function(){
  state.castleManageMode=!state.castleManageMode;
  renderCastleBattleEvent();
};

window.applyCastlePlacement=async function(){
  if(!state.isAdmin)return;

  const placement=document.getElementById("castlePlacementBulkSelect")?.value||"미배치";
  const checked=[...document.querySelectorAll(".castle-check:checked")].map(v=>v.value);

  if(!checked.length){
    alert("배치할 인원을 선택하세요.");
    return;
  }

  const batch=db.batch();

  checked.forEach(id=>{
    batch.update(partiesRef("castle_battle").doc(id),{
      placement,
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    });
  });

  await batch.commit();

  state.castleManageMode=false;
  renderCastleBattleEvent();
};

window.deleteCastleBattleEntry=async function(id){
  const entry=state.parties.find(v=>v.id===id);
  if(!entry)return;

  const canDelete=state.isAdmin||entry.user===state.currentUser;
  if(!canDelete){
    alert("삭제 권한이 없습니다.");
    return;
  }

  if(!confirm(`${entry.user} 님의 캐슬 전투 신청을 삭제하시겠습니까?`))return;

  await partiesRef("castle_battle").doc(id).delete();
};

window.deleteSelectedCastleBattleEntries=async function(){
  if(!state.isAdmin)return;

  const checked=[...document.querySelectorAll(".castle-check:checked")].map(v=>v.value);

  if(!checked.length){
    alert("삭제할 인원을 선택하세요.");
    return;
  }

  if(!confirm(`선택한 ${checked.length}명의 신청을 삭제하시겠습니까?`))return;

  const batch=db.batch();

  checked.forEach(id=>{
    batch.delete(partiesRef("castle_battle").doc(id));
  });

  await batch.commit();

  state.castleManageMode=false;
  updateEventActionButtons();
  renderCastleBattleEvent();
};

/* ===== 미궁 시스템 ===== */
