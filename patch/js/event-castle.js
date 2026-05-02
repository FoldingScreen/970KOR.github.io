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

function getCastleHeroName(heroKey){
  const hero=getCastleHeroList().find(v=>v.key===heroKey);
  return hero?hero.name:"";
}

function getCastleTgValue(tg,key){
  return tg&&tg[key]?String(tg[key]):"순금X";
}

function getCastleHeroValue(heroes,key){
  const value=heroes&&heroes[key]!==undefined?Number(heroes[key]):0;
  return Number.isFinite(value)?Math.max(0,Math.min(5,value)):0;
}

function getCastleApplicants(){
  return state.parties.filter(v=>v.type!=="castle_rally"&&v.user);
}

function getCastleRallies(){
  return state.parties.filter(v=>v.type==="castle_rally");
}

function getCastleSortedApplicants(){
  const rankMap=getRearrangeRankMap();

  return getCastleApplicants().sort((a,b)=>{
    const ra=rankMap[a.user]||999999;
    const rb=rankMap[b.user]||999999;

    if(ra!==rb)return ra-rb;

    return String(a.user).localeCompare(String(b.user),"ko");
  });
}

function sortCastleMembers(members,rallyLeader){
  const rankMap=getRearrangeRankMap();

  return normalizeMembers(members).sort((a,b)=>{
    if(a===rallyLeader)return -1;
    if(b===rallyLeader)return 1;

    const ra=rankMap[a]||999999;
    const rb=rankMap[b]||999999;
    if(ra!==rb)return ra-rb;

    return String(a).localeCompare(String(b),"ko");
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

function getCastleRallyNameByUser(user){
  const rally=getCastleRallies().find(v=>normalizeMembers(v.members).includes(user));
  return rally?(rally.rallyName||rally.name||"집결"):"미배치";
}

function syncCastleHeroLevelButton(heroKey,level){
  document.querySelectorAll(`.castle-hero-level-btn[data-hero="${heroKey}"]`).forEach(btn=>{
    btn.classList.toggle("active",Number(btn.dataset.level)===Number(level));
  });
}

function openCastleBattleModal(){
  const mine=getCastleApplicants().find(v=>v.user===state.currentUser);

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

  const mine=getCastleApplicants().find(v=>v.user===state.currentUser);

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
        <option value="${escapeHtml(hero.key)}" ${hero.key===displayHero.key?"selected":""}>${escapeHtml(hero.name)}</option>
      `).join("")}
    </select>
  `;
}

function renderCastleRallySelectOptions(selectedId=""){
  const rallies=getCastleRallies();
  const rallyOptions=rallies.map(rally=>`
    <option value="${escapeHtml(rally.id)}" ${rally.id===selectedId?"selected":""}>${escapeHtml(rally.rallyName||rally.name||"집결")}</option>
  `).join("");

  return`<option value="">미배치</option>${rallyOptions}`;
}

function renderCastleHeroAssignSelect(rallyId,user,currentHero){
  return`
    <select class="castle-member-hero-select" onchange="setCastleMemberHero('${escapeJs(rallyId)}','${escapeJs(user)}',this.value)">
      <option value="">영웅 없음</option>
      ${getCastleHeroList().map(hero=>`
        <option value="${escapeHtml(hero.key)}" ${hero.key===currentHero?"selected":""}>${escapeHtml(hero.name)}</option>
      `).join("")}
    </select>
  `;
}

function renderCastleRallyCard(rally){
  const members=sortCastleMembers(rally.members,rally.rallyLeader);
  const memberHeroes=rally.memberHeroes||{};

  const membersHtml=members.length
    ? members.map(name=>{
        const heroKey=memberHeroes[name]||"";
        const heroName=getCastleHeroName(heroKey);
        const isLeader=name===rally.rallyLeader;

        return`
          <div class="castle-rally-member-line">
            <div class="castle-rally-member-main">
              <span class="castle-rally-member-name ${name===state.currentUser?"my-name":""}">
                ${escapeHtml(name)}
              </span>
              ${heroName?`<span class="castle-member-hero-chip">${escapeHtml(heroName)}</span>`:""}
            </div>

            ${state.isAdmin?`
              <div class="castle-rally-member-controls">
                ${!isLeader?`
                  <button class="inline-btn castle-crown-btn" onclick="setCastleRallyLeader('${escapeJs(rally.id)}','${escapeJs(name)}')" title="집결장 지정">👑</button>
                `:`<span class="castle-crown-fixed" title="집결장">👑</span>`}
                ${renderCastleHeroAssignSelect(rally.id,name,heroKey)}
                <button class="inline-btn castle-remove-btn" onclick="removeCastleRallyMember('${escapeJs(rally.id)}','${escapeJs(name)}')" title="집결원 제외">✖</button>
              </div>
            `:`${isLeader?`<span class="castle-crown-fixed" title="집결장">👑</span>`:""}`}
          </div>
        `;
      }).join("")
    : `<div class="castle-rally-empty">집결원이 없습니다.</div>`;

  return`
    <div class="party-card castle-rally-card">
      <div class="castle-rally-head">
        <div>
          <div class="party-title">${escapeHtml(rally.rallyName||rally.name||"집결")}</div>
          <div class="party-sub">집결장: ${rally.rallyLeader?`👑 ${escapeHtml(rally.rallyLeader)}`:"미지정"}</div>
        </div>
        <div class="castle-rally-count">${members.length}명</div>
      </div>

      <div class="member-list compact castle-rally-member-list">${membersHtml}</div>

      ${state.isAdmin?`
        <div class="card-actions castle-rally-actions">
          <button onclick="openCastleRallyRenamePrompt('${escapeJs(rally.id)}')">수정</button>
          <button onclick="deleteCastleRally('${escapeJs(rally.id)}')">삭제</button>
        </div>
      `:""}
    </div>
  `;
}

function renderCastleBattleEvent(){
  const applicants=getCastleSortedApplicants();
  const rallies=getCastleRallies();
  const displayHero=getCastleDisplayHero();

  const managePanel=state.isAdmin&&state.castleManageMode
    ? `
      <div class="party-card castle-manage-panel">
        <div class="party-title">캐슬 전투 집결 관리</div>
        <div class="castle-manage-grid">
          <div class="form-group">
            <label>집결명</label>
            <input id="castleRallyNameInput" class="text-input" placeholder="예: 동포탑 1집결" />
          </div>
          <div class="form-group">
            <label>선택 인원 배치</label>
            <select id="castleRallyBulkSelect" class="text-input">${renderCastleRallySelectOptions()}</select>
          </div>
        </div>
        <div class="card-actions">
          <button onclick="createCastleRally()">집결 생성</button>
          <button onclick="applyCastleRallyMembers()">선택 인원 일괄 배치</button>
          <button onclick="deleteSelectedCastleBattleEntries()">선택 인원 삭제</button>
          <button class="danger-btn" onclick="resetCastleBattleEvent()">초기화</button>
        </div>
      </div>
    `
    : "";

  const rallyCards=rallies.length
    ? `<div class="castle-rally-grid">${rallies.map(renderCastleRallyCard).join("")}</div>`
    : `<div class="empty-card">아직 생성된 캐슬 집결이 없습니다.</div>`;

  const rows=applicants.map((entry,idx)=>{
    const canDelete=state.isAdmin||entry.user===state.currentUser;

    return`
      <tr>
        <td>${idx+1}</td>
        <td class="left ${entry.user===state.currentUser?"my-name":""}">
          ${state.isAdmin&&state.castleManageMode?`<input type="checkbox" class="castle-check" value="${escapeHtml(entry.id)}">`:""}
          ${escapeHtml(entry.user)}
        </td>
        <td>${escapeHtml(getCastleTgValue(entry.tg,"infantry"))}</td>
        <td>${escapeHtml(getCastleTgValue(entry.tg,"cavalry"))}</td>
        <td>${escapeHtml(getCastleTgValue(entry.tg,"archer"))}</td>
        <td>${renderCastleHeroOne(entry.heroes,displayHero.key)}</td>
        <td>${escapeHtml(getCastleRallyNameByUser(entry.user))}</td>
        <td>${canDelete?`<button class="rank-edit-btn" onclick="deleteCastleBattleEntry('${escapeJs(entry.id)}')">삭제</button>`:"-"}</td>
      </tr>
    `;
  }).join("");

  const applicantTable=applicants.length
    ? `
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
                <th>집결</th>
                <th>삭제</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `
    : `<div class="empty-card">아직 신청자가 없습니다.</div>`;

  el.partyList.innerHTML=managePanel+rallyCards+applicantTable;
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

window.createCastleRally=async function(){
  if(!state.isAdmin)return;

  const name=(document.getElementById("castleRallyNameInput")?.value||"").trim();
  if(!name){
    alert("집결명을 입력하세요.");
    return;
  }

  await partiesRef("castle_battle").add({
    type:"castle_rally",
    event:"castle_battle",
    name,
    rallyName:name,
    createdBy:state.currentUser,
    members:[],
    rallyLeader:"",
    memberHeroes:{},
    createdAt:firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt:firebase.firestore.FieldValue.serverTimestamp()
  });
};

window.openCastleRallyRenamePrompt=async function(rallyId){
  if(!state.isAdmin)return;

  const rally=getCastleRallies().find(v=>v.id===rallyId);
  if(!rally)return;

  const nextName=prompt("집결명을 입력하세요.",rally.rallyName||rally.name||"");
  if(nextName===null)return;

  const name=nextName.trim();
  if(!name){
    alert("집결명을 입력하세요.");
    return;
  }

  await partiesRef("castle_battle").doc(rallyId).update({
    name,
    rallyName:name,
    updatedAt:firebase.firestore.FieldValue.serverTimestamp()
  });
};

window.applyCastleRallyMembers=async function(){
  if(!state.isAdmin)return;

  const rallyId=document.getElementById("castleRallyBulkSelect")?.value||"";
  const checked=[...document.querySelectorAll(".castle-check:checked")].map(v=>v.value);

  if(!checked.length){
    alert("배치할 인원을 선택하세요.");
    return;
  }

  const applicants=getCastleApplicants();
  const names=checked.map(id=>applicants.find(v=>v.id===id)?.user).filter(Boolean);
  if(!names.length)return;

  const batch=db.batch();

  getCastleRallies().forEach(rally=>{
    if(rallyId&&rally.id===rallyId)return;

    const current=normalizeMembers(rally.members);
    const nextMembers=current.filter(name=>!names.includes(name));
    const nextHeroes={...(rally.memberHeroes||{})};
    names.forEach(name=>delete nextHeroes[name]);

    const updates={
      members:nextMembers,
      memberHeroes:nextHeroes,
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    };

    if(rally.rallyLeader&&names.includes(rally.rallyLeader))updates.rallyLeader="";
    batch.update(partiesRef("castle_battle").doc(rally.id),updates);
  });

  if(rallyId){
    const target=getCastleRallies().find(v=>v.id===rallyId);
    if(!target){
      alert("집결을 찾을 수 없습니다.");
      return;
    }

    const nextMembers=[...new Set([...normalizeMembers(target.members),...names])];
    batch.update(partiesRef("castle_battle").doc(rallyId),{
      members:nextMembers,
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  await batch.commit();

  state.castleManageMode=false;
  renderCastleBattleEvent();
};

window.setCastleRallyLeader=async function(rallyId,name){
  if(!state.isAdmin)return;

  const rally=getCastleRallies().find(v=>v.id===rallyId);
  if(!rally||!normalizeMembers(rally.members).includes(name))return;

  await partiesRef("castle_battle").doc(rallyId).update({
    rallyLeader:name,
    updatedAt:firebase.firestore.FieldValue.serverTimestamp()
  });
};

window.setCastleMemberHero=async function(rallyId,name,heroKey){
  if(!state.isAdmin)return;

  const rally=getCastleRallies().find(v=>v.id===rallyId);
  if(!rally||!normalizeMembers(rally.members).includes(name))return;

  const memberHeroes={...(rally.memberHeroes||{})};
  if(heroKey)memberHeroes[name]=heroKey;
  else delete memberHeroes[name];

  await partiesRef("castle_battle").doc(rallyId).update({
    memberHeroes,
    updatedAt:firebase.firestore.FieldValue.serverTimestamp()
  });
};

window.removeCastleRallyMember=async function(rallyId,name){
  if(!state.isAdmin)return;

  const rally=getCastleRallies().find(v=>v.id===rallyId);
  if(!rally)return;

  if(!confirm(`${name} 님을 이 집결에서 제외하시겠습니까?`))return;

  const members=normalizeMembers(rally.members).filter(v=>v!==name);
  const memberHeroes={...(rally.memberHeroes||{})};
  delete memberHeroes[name];

  await partiesRef("castle_battle").doc(rallyId).update({
    members,
    memberHeroes,
    rallyLeader:rally.rallyLeader===name?"":rally.rallyLeader,
    updatedAt:firebase.firestore.FieldValue.serverTimestamp()
  });
};

window.deleteCastleRally=async function(rallyId){
  if(!state.isAdmin)return;

  const rally=getCastleRallies().find(v=>v.id===rallyId);
  if(!rally)return;

  if(!confirm(`${rally.rallyName||rally.name||"집결"}을 삭제하시겠습니까?`))return;

  await partiesRef("castle_battle").doc(rallyId).delete();
};

window.deleteCastleBattleEntry=async function(id){
  const entry=getCastleApplicants().find(v=>v.id===id);
  if(!entry)return;

  const canDelete=state.isAdmin||entry.user===state.currentUser;
  if(!canDelete){
    alert("삭제 권한이 없습니다.");
    return;
  }

  if(!confirm(`${entry.user} 님의 캐슬 전투 신청을 삭제하시겠습니까?`))return;

  if(state.isAdmin){
    const batch=db.batch();
    getCastleRallies().forEach(rally=>{
      const members=normalizeMembers(rally.members).filter(v=>v!==entry.user);
      const memberHeroes={...(rally.memberHeroes||{})};
      delete memberHeroes[entry.user];

      batch.update(partiesRef("castle_battle").doc(rally.id),{
        members,
        memberHeroes,
        rallyLeader:rally.rallyLeader===entry.user?"":rally.rallyLeader,
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      });
    });
    batch.delete(partiesRef("castle_battle").doc(id));
    await batch.commit();
  }else{
    await partiesRef("castle_battle").doc(id).delete();
  }
};

window.deleteSelectedCastleBattleEntries=async function(){
  if(!state.isAdmin)return;

  const checked=[...document.querySelectorAll(".castle-check:checked")].map(v=>v.value);

  if(!checked.length){
    alert("삭제할 인원을 선택하세요.");
    return;
  }

  if(!confirm(`선택한 ${checked.length}명의 신청을 삭제하시겠습니까?`))return;

  const applicants=getCastleApplicants();
  const names=checked.map(id=>applicants.find(v=>v.id===id)?.user).filter(Boolean);
  const batch=db.batch();

  getCastleRallies().forEach(rally=>{
    const members=normalizeMembers(rally.members).filter(v=>!names.includes(v));
    const memberHeroes={...(rally.memberHeroes||{})};
    names.forEach(name=>delete memberHeroes[name]);

    batch.update(partiesRef("castle_battle").doc(rally.id),{
      members,
      memberHeroes,
      rallyLeader:names.includes(rally.rallyLeader)?"":rally.rallyLeader,
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    });
  });

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
    alert("초기화할 데이터가 없습니다.");
    return;
  }

  if(!confirm(`캐슬 전투 데이터 ${state.parties.length}건을 전부 초기화하시겠습니까?`))return;
  if(!confirm("정말 전체 신청/집결 데이터를 삭제합니다. 복구할 수 없습니다."))return;

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
