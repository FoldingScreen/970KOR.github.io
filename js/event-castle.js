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

function getCastleRallyCategoryList(){
  return[
    {key:"main",name:"메인 집결"},
    {key:"counter",name:"카운터 랠리"},
    {key:"tower",name:"포탑"},
    {key:"etc",name:"기타"}
  ];
}

function getCastleRallyCategoryName(categoryKey){
  const item=getCastleRallyCategoryList().find(v=>v.key===categoryKey);
  return item?item.name:"기타";
}

function getCastleRallyCategoryKey(rally){
  const key=rally&&rally.rallyCategory?rally.rallyCategory:"etc";
  return getCastleRallyCategoryList().some(v=>v.key===key)?key:"etc";
}

function sortCastleRalliesByCreatedAt(rallies){
  return[...rallies].sort((a,b)=>{
    const ta=getTimeValue(a.createdAt);
    const tb=getTimeValue(b.createdAt);
    if(ta!==tb)return ta-tb;
    return String(a.rallyName||a.name||"").localeCompare(String(b.rallyName||b.name||""),"ko");
  });
}

function getCastleTgValue(tg,key){
  return tg&&tg[key]?String(tg[key]):"순금X";
}

function getCastleHeroValue(heroes,key){
  const value=heroes&&heroes[key]!==undefined?Number(heroes[key]):0;
  return Number.isFinite(value)?Math.max(0,Math.min(5,value)):0;
}

function getCastleApplicants(){
  return state.parties.filter(v=>v.type==="castle_battle"&&v.user);
}

function getCastleRallies(){
  return state.parties.filter(v=>v.type==="castle_rally");
}

function getCastleCalculatorData(){
  return state.parties.find(v=>v.type==="castle_calculator")||null;
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
  const currentHeroName=getCastleHeroName(currentHero)||"영웅 없음";

  return`
    <select class="castle-member-hero-select" title="영웅 지정: ${escapeHtml(currentHeroName)}" aria-label="영웅 지정" onchange="setCastleMemberHero('${escapeJs(rallyId)}','${escapeJs(user)}',this.value)">
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
  const isManaging=state.isAdmin&&state.castleManagingRallyId===rally.id;

  const leaderName=rally.rallyLeader||"";
  const leaderExists=leaderName&&members.includes(leaderName);
  const normalMembers=members.filter(name=>name!==leaderName);

  function renderMemberLine(name,isLeader){
    const heroKey=memberHeroes[name]||"";
    const heroName=getCastleHeroName(heroKey);

    return`
      <div class="castle-rally-member-line ${isLeader?"leader-line":""}">
        <div class="castle-rally-member-main">
          <span class="castle-rally-member-name ${name===state.currentUser?"my-name":""}">
            ${escapeHtml(name)}
          </span>
          ${heroName?`<span class="castle-member-hero-chip">${escapeHtml(heroName)}</span>`:""}
        </div>

        ${state.isAdmin&&isManaging?`
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
  }

  const leaderHtml=leaderExists
    ? `<div class="castle-rally-leader-row">${renderMemberLine(leaderName,true)}</div>`
    : "";

  const normalHtml=normalMembers.length
    ? `<div class="castle-rally-normal-grid">${normalMembers.map(name=>renderMemberLine(name,false)).join("")}</div>`
    : "";

  const membersHtml=members.length
    ? `${leaderHtml}${normalHtml}`
    : `<div class="castle-rally-empty">집결원이 없습니다.</div>`;

  return`
    <div class="party-card castle-rally-card">
      <div class="castle-rally-head">
        <div>
          <div class="party-title">${escapeHtml(rally.rallyName||rally.name||"집결")}</div>
          <div class="party-sub">집결장: ${rally.rallyLeader?escapeHtml(rally.rallyLeader):"미지정"}</div>
        </div>
        <div class="castle-rally-count">${members.length}명</div>
      </div>

      <div class="member-list compact castle-rally-member-list">${membersHtml}</div>

      ${state.isAdmin?`
        <div class="card-actions castle-rally-actions">
          <button onclick="toggleCastleRallyManage('${escapeJs(rally.id)}')">${isManaging?"관리 종료":"관리"}</button>
          <button onclick="openCastleRallyRenamePrompt('${escapeJs(rally.id)}')">수정</button>
          <button onclick="deleteCastleRally('${escapeJs(rally.id)}')">삭제</button>
        </div>
      `:""}
    </div>
  `;
}

function renderCastleRallyAssignmentSelect(user){
  const currentRally=getCastleRallies().find(rally=>normalizeMembers(rally.members).includes(user));
  const currentId=currentRally?currentRally.id:"";

  const groups=getCastleRallyCategoryList().map(category=>{
    const items=sortCastleRalliesByCreatedAt(getCastleRallies().filter(rally=>getCastleRallyCategoryKey(rally)===category.key));
    if(!items.length)return"";

    return`
      <optgroup label="${escapeHtml(category.name)}">
        ${items.map(rally=>`
          <option value="${escapeHtml(rally.id)}" ${rally.id===currentId?"selected":""}>${escapeHtml(rally.rallyName||rally.name||"집결")}</option>
        `).join("")}
      </optgroup>
    `;
  }).join("");

  return`
    <select class="castle-rally-assign-select" onchange="assignCastleApplicantToRally('${escapeJs(user)}',this.value)">
      <option value="" ${!currentId?"selected":""}>미배치</option>
      ${groups}
    </select>
  `;
}

function renderCastleCalculatorPanel(){
  const data=getCastleCalculatorData();
  const gatherMinutes=Number(data?.gatherMinutes||1);
  const manualMode=!!data?.manualMode;
  const arrivalTime=data?.arrivalTime||"";
  const canEdit=!!state.isAdmin;
  const disabledAttr=canEdit?"":"disabled";
  const readonlyAttr=canEdit&&manualMode?"":"readonly";

  const points=Array.isArray(data?.rallyPoints)&&data.rallyPoints.length
    ? data.rallyPoints
    : [
      {id:"rp1",enabled:true,name:"1집결장",marchSeconds:15},
      {id:"rp2",enabled:true,name:"2집결장",marchSeconds:25},
      {id:"rp3",enabled:true,name:"3집결장",marchSeconds:33}
    ];

  const results=Array.isArray(data?.rallyResults)?data.rallyResults:[];

  const resultHtml=results.length
    ? results.map(item=>`
      <div class="castle-calc-result-row">
        <span>${escapeHtml(item.name||"")}</span>
        <strong>${escapeHtml(item.startTime||"")}</strong>
      </div>
    `).join("")
    : `<div class="empty-card mini">계산 결과가 없습니다.</div>`;

  const resultBlock=`
    <div class="party-card castle-calc-result-card">
      <div class="castle-calc-result-head">
        <div class="party-title">결과</div>
        <button type="button" onclick="copyCastleCalculatorResults()" ${results.length?"":"disabled"}>복사</button>
      </div>
      <div id="castleCalculatorResultList" class="castle-calc-result-list">${resultHtml}</div>
    </div>
  `;

  const gatherButtons=[1,5,10,20].map(min=>`
    <button type="button" class="castle-calc-choice ${gatherMinutes===min?"active":""}" onclick="selectCastleCalculatorGather(${min})" ${disabledAttr}>${min}분</button>
  `).join("");

  const pointRows=points.map((point,idx)=>`
    <div class="castle-calc-row">
      <label class="castle-calc-check">
        <input type="checkbox" class="castle-calc-enabled" ${point.enabled!==false?"checked":""} ${disabledAttr} />
      </label>
      <input class="text-input castle-calc-name" value="${escapeHtml(point.name||`집결장 ${idx+1}`)}" placeholder="집결장명" ${canEdit?"":"readonly"} />
      <div class="castle-calc-seconds-wrap">
        <input class="text-input castle-calc-seconds" type="number" min="0" step="1" value="${Number(point.marchSeconds||0)||""}" placeholder="초" ${canEdit?"":"readonly"} />
        <span>초</span>
      </div>
      <button type="button" class="inline-btn castle-calc-remove" onclick="removeCastleCalculatorRow(this)" ${points.length<=1||!canEdit?"disabled":""}>X</button>
    </div>
  `).join("");

  return`
    <div class="castle-calc-wrap">
      <div class="party-card castle-calc-card">
        <div class="party-title">집결계산기</div>
        ${canEdit?"":`<p class="muted">운영진만 수정할 수 있습니다.</p>`}

        <div class="castle-calc-inline-section">
          <div class="castle-calc-section-title">집결 모집 시간</div>
          <div class="castle-calc-choice-row">${gatherButtons}</div>
        </div>
        <input id="castleCalculatorGatherInput" type="hidden" value="${gatherMinutes}" />
        <input id="castleCalculatorManualModeInput" type="hidden" value="${manualMode?"1":"0"}" />

        <div class="castle-calc-section-title">집결장</div>
        <div class="castle-calc-head">
          <span>포함</span>
          <span>집결장명</span>
          <span>행군시간</span>
          <span></span>
        </div>

        <div id="castleCalculatorRows" class="castle-calc-rows">${pointRows}</div>

        <div class="card-actions castle-calc-add-row">
          <button type="button" onclick="addCastleCalculatorRow()" ${disabledAttr}>+ 집결장 추가</button>
        </div>

        <div class="castle-calc-action-row">
          <button type="button" onclick="calculateCastleCalculator()" ${disabledAttr}>계산하기</button>
          <button id="castleCalculatorModeBtn" type="button" onclick="toggleCastleCalculatorManualMode()" ${disabledAttr}>${manualMode?"도착시간 자동 산출하기":"도착시간 수동 입력하기"}</button>
        </div>

        <div class="castle-calc-arrival-row">
          <label>도착시간</label>
          <input id="castleCalculatorArrivalInput" class="text-input" value="${escapeHtml(arrivalTime)}" placeholder="예: 13:33:33" ${readonlyAttr} />
        </div>
      </div>

      ${resultBlock}
    </div>
  `;
}

function renderCastleCreatePanel(){
  if(!state.isAdmin||!state.castleCreateMode)return"";

  return`
    <div class="party-card castle-manage-panel castle-create-panel">
      <div class="party-title">집결 생성</div>
      <div class="castle-manage-grid castle-create-grid">
        <div class="form-group">
          <label>집결명</label>
          <input id="castleRallyNameInput" class="text-input" placeholder="예: 동포탑 1집결" />
        </div>
        <div class="form-group">
          <label>집결 분류</label>
          <select id="castleRallyCategorySelect" class="text-input">
            ${getCastleRallyCategoryList().map(category=>`
              <option value="${escapeHtml(category.key)}">${escapeHtml(category.name)}</option>
            `).join("")}
          </select>
        </div>
      </div>
      <div class="card-actions castle-manage-actions">
        <button onclick="createCastleRally()">집결 생성</button>
        <button onclick="toggleCastleCreatePanel()">닫기</button>
      </div>
    </div>
  `;
}

function renderCastleBattleEvent(){
  const applicants=getCastleSortedApplicants();
  const rallies=getCastleRallies();
  const displayHero=getCastleDisplayHero();

  if(state.castleCalculatorMode){
    el.partyList.innerHTML=renderCastleCalculatorPanel();
    return;
  }

  const createPanel=renderCastleCreatePanel();

  const myRally=rallies.find(rally=>normalizeMembers(rally.members).includes(state.currentUser));

  const myRallyBlock=myRally
    ? `
      <section class="castle-my-rally-section">
        <div class="castle-rally-category-title my-rally-title">나의 집결</div>
        <div class="castle-my-rally-wrap">${renderCastleRallyCard(myRally)}</div>
      </section>
    `
    : "";

  const rallyGroups=getCastleRallyCategoryList().map(category=>{
    const items=sortCastleRalliesByCreatedAt(rallies.filter(rally=>getCastleRallyCategoryKey(rally)===category.key));
    if(!items.length)return"";

    return`
      <section class="castle-rally-category-row">
        <div class="castle-rally-category-title">${escapeHtml(category.name)}</div>
        <div class="castle-rally-category-list">
          ${items.map(rally=>renderCastleRallyCard(rally)).join("")}
        </div>
      </section>
    `;
  }).join("");

  const rallyCards=rallies.length
    ? `<div class="castle-rally-category-grid">${myRallyBlock}${rallyGroups}</div>`
    : `<div class="empty-card">아직 생성된 캐슬 집결이 없습니다.</div>`;

  const rows=applicants.map((entry,idx)=>{
    const canDelete=state.isAdmin||entry.user===state.currentUser;

    return`
      <tr>
        <td>${idx+1}</td>
        <td class="left ${entry.user===state.currentUser?"my-name":""}">${escapeHtml(entry.user)}</td>
        <td>${escapeHtml(getCastleTgValue(entry.tg,"infantry"))}</td>
        <td>${escapeHtml(getCastleTgValue(entry.tg,"cavalry"))}</td>
        <td>${escapeHtml(getCastleTgValue(entry.tg,"archer"))}</td>
        <td>${renderCastleHeroOne(entry.heroes,displayHero.key)}</td>
        <td>${state.isAdmin?renderCastleRallyAssignmentSelect(entry.user):escapeHtml(getCastleRallyNameByUser(entry.user))}</td>
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
                <th>집결 배정</th>
                <th>삭제</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `
    : `<div class="empty-card">아직 신청자가 없습니다.</div>`;

  el.partyList.innerHTML=createPanel+rallyCards+applicantTable;
}

function formatCastleMinuteSecond(date){
  const mm=String(date.getMinutes()).padStart(2,"0");
  const ss=String(date.getSeconds()).padStart(2,"0");
  return `${mm}:${ss}`;
}

function formatCastleHourMinuteSecond(date){
  const hh=String(date.getHours()).padStart(2,"0");
  const mm=String(date.getMinutes()).padStart(2,"0");
  const ss=String(date.getSeconds()).padStart(2,"0");
  return `${hh}:${mm}:${ss}`;
}

function parseCastleArrivalTime(value){
  const text=String(value||"").trim();

  const hms=text.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if(hms){
    const hours=Number(hms[1]);
    const minutes=Number(hms[2]);
    const seconds=Number(hms[3]);

    if(
      !Number.isFinite(hours)||
      !Number.isFinite(minutes)||
      !Number.isFinite(seconds)||
      hours<0||hours>23||
      minutes<0||minutes>59||
      seconds<0||seconds>59
    ){
      return null;
    }

    const now=new Date();
    const date=new Date(now);
    date.setHours(hours,minutes,seconds,0);

    if(date.getTime()<now.getTime()){
      date.setDate(date.getDate()+1);
    }

    return date;
  }

  const ms=text.match(/^(\d{1,2}):(\d{2})$/);
  if(ms){
    const minutes=Number(ms[1]);
    const seconds=Number(ms[2]);

    if(!Number.isFinite(minutes)||!Number.isFinite(seconds)||minutes<0||minutes>59||seconds<0||seconds>59){
      return null;
    }

    const now=new Date();
    const date=new Date(now);
    date.setMinutes(minutes,seconds,0);

    if(date.getTime()<now.getTime()){
      date.setHours(date.getHours()+1);
    }

    return date;
  }

  return null;
}

window.selectCastleCalculatorGather=function(minutes){
  const input=document.getElementById("castleCalculatorGatherInput");
  if(input)input.value=String(minutes);

  document.querySelectorAll(".castle-calc-choice").forEach(btn=>{
    btn.classList.toggle("active",btn.textContent.trim()===`${minutes}분`);
  });
};

window.addCastleCalculatorRow=function(){
  const wrap=document.getElementById("castleCalculatorRows");
  if(!wrap)return;

  const row=document.createElement("div");
  row.className="castle-calc-row";
  row.innerHTML=`
    <label class="castle-calc-check">
      <input type="checkbox" class="castle-calc-enabled" checked />
    </label>
    <input class="text-input castle-calc-name" placeholder="집결장명" />
    <div class="castle-calc-seconds-wrap">
      <input class="text-input castle-calc-seconds" type="number" min="0" step="1" placeholder="초" />
      <span>초</span>
    </div>
    <button type="button" class="inline-btn castle-calc-remove" onclick="removeCastleCalculatorRow(this)">X</button>
  `;
  wrap.appendChild(row);
};

window.removeCastleCalculatorRow=function(button){
  const row=button?.closest(".castle-calc-row");
  const rows=document.querySelectorAll(".castle-calc-row");

  if(!row||rows.length<=1)return;

  row.remove();
};

window.toggleCastleCalculatorManualMode=function(){
  const modeInput=document.getElementById("castleCalculatorManualModeInput");
  const arrivalInput=document.getElementById("castleCalculatorArrivalInput");
  const modeBtn=document.getElementById("castleCalculatorModeBtn");
  const nextManual=modeInput?.value!=="1";

  if(modeInput)modeInput.value=nextManual?"1":"0";
  if(arrivalInput)arrivalInput.readOnly=!nextManual;
  if(modeBtn)modeBtn.textContent=nextManual?"도착시간 자동 산출하기":"도착시간 수동 입력하기";
};

function readCastleCalculatorRows(){
  return[...document.querySelectorAll(".castle-calc-row")].map((row,idx)=>({
    id:`rp${idx+1}`,
    enabled:!!row.querySelector(".castle-calc-enabled")?.checked,
    name:(row.querySelector(".castle-calc-name")?.value||"").trim(),
    marchSeconds:Number(row.querySelector(".castle-calc-seconds")?.value||0)
  }));
}

window.calculateCastleCalculator=async function(){
  if(!state.isAdmin)return;

  const gatherMinutes=Number(document.getElementById("castleCalculatorGatherInput")?.value||1);
  const manualMode=document.getElementById("castleCalculatorManualModeInput")?.value==="1";
  const arrivalInput=document.getElementById("castleCalculatorArrivalInput");
  const points=readCastleCalculatorRows();
  const enabledPoints=points.filter(point=>point.enabled);

  if(!enabledPoints.length){
    alert("계산에 포함할 집결장을 선택해 주세요.");
    return;
  }

  for(const point of enabledPoints){
    if(!point.name){
      alert("포함된 집결장의 이름을 입력해 주세요.");
      return;
    }

    if(!Number.isFinite(point.marchSeconds)||point.marchSeconds<0){
      alert("포함된 집결장의 행군시간을 숫자로 입력해 주세요.");
      return;
    }
  }

  let arrivalDate;

  if(manualMode){
    arrivalDate=parseCastleArrivalTime(arrivalInput?.value||"");

    if(!arrivalDate){
      alert("도착시간은 HH:MM:SS 또는 MM:SS 형식으로 입력해 주세요. 예: 13:33:33");
      return;
    }
  }else{
    const maxMarch=Math.max(...enabledPoints.map(point=>Number(point.marchSeconds||0)));
    arrivalDate=new Date(Date.now()+(60*1000)+(gatherMinutes*60*1000)+(maxMarch*1000));

    if(arrivalInput){
      arrivalInput.value=formatCastleHourMinuteSecond(arrivalDate);
    }
  }

  const gatherMs=gatherMinutes*60*1000;
  const results=enabledPoints
    .map(point=>{
      const startDate=new Date(arrivalDate.getTime()-gatherMs-(point.marchSeconds*1000));

      return{
        name:point.name,
        startTime:formatCastleMinuteSecond(startDate),
        startValue:startDate.getTime()
      };
    })
    .sort((a,b)=>a.startValue-b.startValue||a.name.localeCompare(b.name,"ko"))
    .map(item=>({
      name:item.name,
      startTime:item.startTime
    }));

  const arrivalTime=formatCastleHourMinuteSecond(arrivalDate);

  await partiesRef("castle_battle").doc("__rallyCalculator").set({
    type:"castle_calculator",
    event:"castle_battle",
    gatherMinutes,
    manualMode,
    arrivalTime,
    rallyPoints:points,
    rallyResults:results,
    calculatorUpdatedBy:state.currentUser,
    updatedAt:firebase.firestore.FieldValue.serverTimestamp()
  },{merge:true});

  window.castleCalculatorLastCopyText=results
    .map(item=>`${item.name}\t${item.startTime}`)
    .join("\n");
};

window.copyCastleCalculatorResults=async function(){
  const data=getCastleCalculatorData();
  const results=Array.isArray(data?.rallyResults)?data.rallyResults:[];
  const text=results.length
    ? results.map(item=>`${item.name||""}\t${item.startTime||""}`).join("\n")
    : (window.castleCalculatorLastCopyText||"");

  if(!text){
    alert("복사할 결과가 없습니다.");
    return;
  }

  try{
    await navigator.clipboard.writeText(text);
    alert("복사했습니다.");
  }catch(err){
    console.error(err);
    window.prompt("아래 내용을 복사해 주세요.",text);
  }
};
window.toggleCastleCalculatorPanel=function(){
  state.castleCalculatorMode=!state.castleCalculatorMode;

  if(state.castleCalculatorMode){
    state.castleCreateMode=false;
    state.castleManagingRallyId="";
  }

  updateEventActionButtons();
  renderCastleBattleEvent();
};

window.setCastleDisplayHero=function(heroKey){
  if(!state.isAdmin)return;

  const exists=getCastleHeroList().some(hero=>hero.key===heroKey);
  state.castleDisplayHeroKey=exists?heroKey:"amadeus";

  renderCastleBattleEvent();
};

window.toggleCastleCreatePanel=function(){
  if(!state.isAdmin)return;
  state.castleCreateMode=!state.castleCreateMode;
  renderCastleBattleEvent();
};

window.toggleCastleRallyManage=function(rallyId){
  if(!state.isAdmin)return;
  state.castleManagingRallyId=state.castleManagingRallyId===rallyId?"":rallyId;
  renderCastleBattleEvent();
};

window.assignCastleApplicantToRally=async function(user,rallyId){
  if(!state.isAdmin)return;

  const applicant=getCastleApplicants().find(v=>v.user===user);
  if(!applicant)return;

  const batch=db.batch();

  getCastleRallies().forEach(rally=>{
    const isTarget=rallyId&&rally.id===rallyId;
    const currentMembers=normalizeMembers(rally.members);
    let nextMembers=currentMembers.filter(name=>name!==user);

    if(isTarget)nextMembers=[...new Set([...nextMembers,user])];

    const memberHeroes={...(rally.memberHeroes||{})};
    delete memberHeroes[user];

    const updates={
      members:nextMembers,
      memberHeroes,
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    };

    if(rally.rallyLeader===user&&!isTarget)updates.rallyLeader="";

    batch.update(partiesRef("castle_battle").doc(rally.id),updates);
  });

  await batch.commit();
};

window.createCastleRally=async function(){
  if(!state.isAdmin)return;

  const name=(document.getElementById("castleRallyNameInput")?.value||"").trim();
  const category=document.getElementById("castleRallyCategorySelect")?.value||"etc";
  const safeCategory=getCastleRallyCategoryList().some(v=>v.key===category)?category:"etc";

  if(!name){
    alert("집결명을 입력하세요.");
    return;
  }

  await partiesRef("castle_battle").add({
    type:"castle_rally",
    event:"castle_battle",
    name,
    rallyName:name,
    rallyCategory:safeCategory,
    createdBy:state.currentUser,
    members:[],
    rallyLeader:"",
    memberHeroes:{},
    createdAt:firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt:firebase.firestore.FieldValue.serverTimestamp()
  });

  state.castleCreateMode=false;
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
