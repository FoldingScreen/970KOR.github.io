function getCastlePlacementList(){
  return["캐슬","포탑(동)","포탑(서)","포탑(남)","포탑(북)","미배치"];
}

function getCastleHeroList(){
  return[
    {key:"amadeus",name:"아마데우스"},
    {key:"chenko",name:"첸코"},
    {key:"yeonwoo",name:"연우"},
    {key:"margo",name:"마르고"},
    {key:"amane",name:"아마네"},
    {key:"eric",name:"에릭"},
    {key:"salo",name:"살로"},
    {key:"littlefera",name:"리틀페라"},
    {key:"marine",name:"마린"},
    {key:"rosa",name:"로사"},
    {key:"alka",name:"알카"},
    {key:"fad",name:"파드"},
    {key:"queen",name:"퀸"},
    {key:"howard",name:"하워드"}
  ];
}

function getCastleTgValue(tg,key){
  return tg&&tg[key]?String(tg[key]):"순금X";
}

function getCastleHeroValue(heroes,key){
  const value=heroes&&heroes[key]!==undefined?Number(heroes[key]):0;
  return Number.isFinite(value)?Math.max(0,Math.min(5,value)):0;
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

function getCastleHeroInputs(){
  return[...document.querySelectorAll(".castle-hero-level-input")];
}

function getCastleDisplayHero(){
  const heroes=getCastleHeroList();
  const key=state.castleDisplayHeroKey||"amadeus";

  return heroes.find(hero=>hero.key===key)||heroes[0];
}

function syncCastleHeroLevelButton(heroKey,level){
  document.querySelectorAll(`.castle-hero-level-btn[data-hero="${heroKey}"]`).forEach(btn=>{
    btn.classList.toggle("active",Number(btn.dataset.level)===Number(level));
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

  getCastleHeroInputs().forEach(input=>{
    const level=getCastleHeroValue(mine?.heroes,input.dataset.hero);
    input.value=String(level);
    syncCastleHeroLevelButton(input.dataset.hero,level);
  });

  el.castleBattleModal.classList.remove("hidden");
  syncOverlay();
}

function closeCastleBattleModal(){
  el.castleBattleModal?.classList.add("hidden");
  syncOverlay();
}

window.openCastleBattleModal=openCastleBattleModal;
window.closeCastleBattleModal=closeCastleBattleModal;

window.setCastleHeroLevel=function(heroKey,level){
  const input=document.querySelector(`.castle-hero-level-input[data-hero="${heroKey}"]`);
  if(!input)return;

  const safeLevel=Math.max(0,Math.min(5,Number(level)||0));
  input.value=String(safeLevel);
  syncCastleHeroLevelButton(heroKey,safeLevel);
};

window.submitCastleBattle=async function(){
  const tg={
    infantry:el.castleInfantrySelect.value,
    cavalry:el.castleCavalrySelect.value,
    archer:el.castleArcherSelect.value
  };

  const heroes={};
  getCastleHeroInputs().forEach(input=>{
    heroes[input.dataset.hero]=Number(input.value||0);
  });

  const mine=state.parties.find(v=>v.user===state.currentUser);

  await partiesRef("castle_battle").doc(state.currentUser).set({
    type:"castle_battle",
    event:"castle_battle",
    user:state.currentUser,
    tg,
    heroes,
    placement:mine?.placement||"미배치",
    createdAt:mine?.createdAt||firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt:firebase.firestore.FieldValue.serverTimestamp()
  },{merge:true});

  closeCastleBattleModal();
};

function renderCastleTgSummary(tg){
  return`
    <div class="castle-tg-summary">
      <span>보 ${escapeHtml(getCastleTgValue(tg,"infantry"))}</span>
      <span>기 ${escapeHtml(getCastleTgValue(tg,"cavalry"))}</span>
      <span>궁 ${escapeHtml(getCastleTgValue(tg,"archer"))}</span>
    </div>
  `;
}

function renderCastleHeroOne(heroes,heroKey){
  return`<span class="castle-hero-one-level">${getCastleHeroValue(heroes,heroKey)}</span>`;
}

function renderCastleHeroHeaderControl(displayHero){
  if(!state.isAdmin)return escapeHtml(displayHero.name);

  return`
    <select class="castle-hero-header-select" onchange="setCastleDisplayHero(this.value)">
      ${getCastleHeroList().map(hero=>`
        <option value="${escapeHtml(hero.key)}" ${hero.key===displayHero.key?"selected":""}>
          ${escapeHtml(hero.name)}
        </option>
      `).join("")}
    </select>
  `;
}

function renderCastleBattleEvent(){
  const entries=getCastleSortedEntries();
  const placements=getCastlePlacementList();
  const displayHero=getCastleDisplayHero();

  if(!entries.length){
    el.partyList.innerHTML=state.isAdmin&&state.castleManageMode
      ? `
        <div class="party-card castle-manage-panel">
          <div class="party-title">캐슬 전투 배치 관리</div>
          <div class="empty-card">초기화할 신청자가 없습니다.</div>
        </div>
      `
      : `<div class="empty-card">아직 신청자가 없습니다.</div>`;
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
          <button class="danger-btn" onclick="resetCastleBattleEvent()">초기화</button>
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
        <td>${renderCastleHeroOne(entry.heroes,displayHero.key)}</td>
        <td>${escapeHtml(entry.placement||"미배치")}</td>
        <td>${canDelete?`<button class="rank-edit-btn" onclick="deleteCastleBattleEntry('${escapeJs(entry.id)}')">삭제</button>`:"-"}</td>
      </tr>
    `;
  }).join("");

  const applicantTable=`
    <div class="party-card rank-table-card castle-applicant-card">
      <div class="party-title">신청 인원 전체</div>
      <div class="rank-table-wrap castle-table-wrap">
        <table class="rank-table castle-table">
          <thead>
            <tr>
              <th>연번</th>
              <th>닉네임</th>
              <th>보병 TG</th>
              <th>기병 TG</th>
              <th>궁병 TG</th>
              <th>${renderCastleHeroHeaderControl(displayHero)}</th>
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

window.setCastleDisplayHero=function(heroKey){
  if(!state.isAdmin)return;

  const exists=getCastleHeroList().some(hero=>hero.key===heroKey);
  state.castleDisplayHeroKey=exists?heroKey:"amadeus";

  renderCastleBattleEvent();
};

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

window.resetCastleBattleEvent=async function(){
  if(!state.isAdmin)return;

  if(!state.parties.length){
    alert("초기화할 신청자가 없습니다.");
    return;
  }

  if(!confirm(`캐슬 전투 신청 ${state.parties.length}건을 전부 초기화하시겠습니까?`))return;
  if(!confirm("정말 전체 신청 데이터를 삭제합니다. 복구할 수 없습니다."))return;

  const snap=await partiesRef("castle_battle").get();
  const docs=snap.docs;

  for(let i=0;i<docs.length;i+=450){
    const batch=db.batch();
    docs.slice(i,i+450).forEach(doc=>batch.delete(doc.ref));
    await batch.commit();
  }

  await writeAdminLog("캐슬 전투 초기화",{count:docs.length});

  state.castleManageMode=false;
  updateEventActionButtons();
  renderCastleBattleEvent();
};
