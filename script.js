const firebaseConfig={apiKey:"AIzaSyBu2RrQn8cAwwWaLtw5O8Omwn4-NzHWuc0",authDomain:"kor-app-fa47e.firebaseapp.com",projectId:"kor-app-fa47e",storageBucket:"kor-app-fa47e.firebasestorage.app",messagingSenderId:"397749083935",appId:"1:397749083935:web:51c7c"};
if(!firebase.apps.length)firebase.initializeApp(firebaseConfig);
const db=firebase.firestore();

const state={
  currentUser:"",
  currentEventId:"",
  isAdmin:false,
  unsubscribeParties:null,
  unsubscribeMeta:null,
  unsubscribeRanking:null,
  parties:[],
  rearrangeProgressEntries:[],
  rearrangeRankingMap:{},
  rearrangeEntries:[],
  rearrangePublic:false,
  events:[
    {id:"viking",name:"바이킹의 역습",desc:"기존 파티 시스템 유지"},
    {id:"ruins",name:"유적 쟁탈",desc:"운영진 전용 파티 생성 / 15인 고정"},
    {id:"rearrange",name:"자리 재배치",desc:"빛나는 첨탑 최고 스테이지 입력 / 순위 관리"}
  ],
  editingRuinsPartyId:"",
  editingRearrangeRankUser:""
};

const TEST_HIDDEN_PREFIXES=["test","tester","테스트","운영테스트"];

const el={
  loginScreen:document.getElementById("loginScreen"),
  homeScreen:document.getElementById("homeScreen"),
  eventScreen:document.getElementById("eventScreen"),
  nicknameInput:document.getElementById("nicknameInput"),
  myNameBtn:document.getElementById("myNameBtn"),
  adminMenuBtn:document.getElementById("adminMenuBtn"),
  adminMenu:document.getElementById("adminMenu"),
  homeSummary:document.getElementById("homeSummary"),
  homeEventCards:document.getElementById("homeEventCards"),
  partyList:document.getElementById("partyList"),
  eventTitle:document.getElementById("eventTitle"),
  eventDesc:document.getElementById("eventDesc"),
  createPartyBtn:document.getElementById("createPartyBtn"),
  rearrangeEditBtn:document.getElementById("rearrangeEditBtn"),
  rearrangeManageBtn:document.getElementById("rearrangeManageBtn"),
  rearrangePublicBtn:document.getElementById("rearrangePublicBtn"),
  modalOverlay:document.getElementById("modalOverlay"),
  userModal:document.getElementById("userModal"),
  joinedUsers:document.getElementById("joinedUsers"),
  notJoinedUsers:document.getElementById("notJoinedUsers"),
  logModal:document.getElementById("logModal"),
  logList:document.getElementById("logList"),
  ruinsCreateModal:document.getElementById("ruinsCreateModal"),
  ruinsModalTitle:document.getElementById("ruinsModalTitle"),
  ruinsSubmitBtn:document.getElementById("ruinsSubmitBtn"),
  ruinNameInput:document.getElementById("ruinNameInput"),
  utcMonth:document.getElementById("utcMonth"),
  utcDay:document.getElementById("utcDay"),
  utcHour:document.getElementById("utcHour"),
  rearrangeModal:document.getElementById("rearrangeModal"),
  rearrangeModalTitle:document.getElementById("rearrangeModalTitle"),
  rearrangeStageInput:document.getElementById("rearrangeStageInput"),
  rearrangeSubmitBtn:document.getElementById("rearrangeSubmitBtn"),
  exampleImageModal:document.getElementById("exampleImageModal"),
  exampleImageModalTitle:document.getElementById("exampleImageModalTitle"),
  exampleImageModalImg:document.getElementById("exampleImageModalImg"),
  rearrangeRankEditModal:document.getElementById("rearrangeRankEditModal"),
  rearrangeRankEditTitle:document.getElementById("rearrangeRankEditTitle"),
  rankEditNicknameInput:document.getElementById("rankEditNicknameInput"),
  rankEditStageInput:document.getElementById("rankEditStageInput"),
  rankEditPowerInput:document.getElementById("rankEditPowerInput"),
  rankEditNoteInput:document.getElementById("rankEditNoteInput"),
  rankEditDeleteBtn:document.getElementById("rankEditDeleteBtn"),
  rankEditSubmitBtn:document.getElementById("rankEditSubmitBtn")
};

function escapeHtml(s){return String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");}
function escapeJs(s){return String(s??"").replace(/\\/g,"\\\\").replace(/'/g,"\\'");}
function normalizeMembers(m){return Array.isArray(m)?m.filter(v=>typeof v==="string"&&v.trim()!==""):[];}
function isHiddenTestNickname(name){const lowered=String(name||"").trim().toLowerCase();return TEST_HIDDEN_PREFIXES.some(prefix=>lowered.startsWith(String(prefix).toLowerCase()));}

function showOnly(name){
  if(el.loginScreen)el.loginScreen.classList.add("hidden");
  if(el.homeScreen)el.homeScreen.classList.add("hidden");
  if(el.eventScreen)el.eventScreen.classList.add("hidden");
  if(name==="login"&&el.loginScreen)el.loginScreen.classList.remove("hidden");
  if(name==="home"&&el.homeScreen)el.homeScreen.classList.remove("hidden");
  if(name==="event"&&el.eventScreen)el.eventScreen.classList.remove("hidden");
}

function eventRef(id){return db.collection("events").doc(id);}
function partiesRef(id){return eventRef(id).collection("parties");}
function rearrangeProgressRef(){return eventRef("rearrange").collection("progress");}
function rearrangeRankingRef(){return eventRef("rearrange").collection("ranking");}

function setTopTabs(active){
  document.querySelectorAll(".tab-btn").forEach(btn=>btn.classList.remove("active"));
  if(active==="home")document.querySelectorAll(".tab-btn")[0]?.classList.add("active");
  if(active==="viking")document.querySelectorAll(".tab-btn")[1]?.classList.add("active");
  if(active==="ruins")document.querySelectorAll(".tab-btn")[2]?.classList.add("active");
  if(active==="rearrange")document.querySelectorAll(".tab-btn")[3]?.classList.add("active");
}

function updateUserBadge(){
  if(!el.myNameBtn)return;
  el.myNameBtn.textContent=state.currentUser?`${state.currentUser}${state.isAdmin?" (운영진)":""}`:"로그인 안 됨";
  if(state.isAdmin)el.adminMenuBtn?.classList.remove("hidden");
  else{
    el.adminMenuBtn?.classList.add("hidden");
    closeAdminMenu();
  }
}

function toggleAdminMenu(){el.adminMenu?.classList.toggle("hidden");}
function closeAdminMenu(){el.adminMenu?.classList.add("hidden");}
window.toggleAdminMenu=toggleAdminMenu;
window.closeAdminMenu=closeAdminMenu;

function syncOverlay(){
  const hasOpenModal=
    (el.userModal&&!el.userModal.classList.contains("hidden"))||
    (el.logModal&&!el.logModal.classList.contains("hidden"))||
    (el.ruinsCreateModal&&!el.ruinsCreateModal.classList.contains("hidden"))||
    (el.rearrangeModal&&!el.rearrangeModal.classList.contains("hidden"))||
    (el.exampleImageModal&&!el.exampleImageModal.classList.contains("hidden"))||
    (el.rearrangeRankEditModal&&!el.rearrangeRankEditModal.classList.contains("hidden"));

  if(!el.modalOverlay)return;
  if(hasOpenModal) el.modalOverlay.classList.remove("hidden");
  else el.modalOverlay.classList.add("hidden");
}

if(el.modalOverlay){
  el.modalOverlay.addEventListener("click",()=>{
    closeExampleImageModal();
    closeUserModal();
    closeLogModal();
    closeRuinsCreateModal();
    closeRearrangeModal();
    closeRearrangeRankEditModal();
    syncOverlay();
  });
}

function clearSubscriptions(){
  if(state.unsubscribeParties){state.unsubscribeParties();state.unsubscribeParties=null;}
  if(state.unsubscribeMeta){state.unsubscribeMeta();state.unsubscribeMeta=null;}
  if(state.unsubscribeRanking){state.unsubscribeRanking();state.unsubscribeRanking=null;}
}

async function ensureEventDocs(){
  for(const e of state.events){
    const ref=eventRef(e.id);
    const snap=await ref.get();
    const payload={name:e.name,desc:e.desc};
    if(!snap.exists&&e.id==="rearrange")payload.rankingPublic=false;
    await ref.set(payload,{merge:true});
  }
}

async function ensureUserDoc(name){
  await db.collection("users").doc(name).set({nickname:name,lastLoginAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
}

async function refreshAdmin(){
  if(!state.currentUser){
    state.isAdmin=false;
    updateUserBadge();
    updateEventActionButtons();
    return;
  }
  state.isAdmin=(await db.collection("admins").doc(state.currentUser).get()).exists;
  updateUserBadge();
  updateEventActionButtons();
}

async function writeAdminLog(action,payload){
  if(!state.isAdmin)return;
  await db.collection("adminLogs").add({
    action,
    payload:payload||{},
    event:state.currentEventId||"",
    admin:state.currentUser,
    createdAt:firebase.firestore.FieldValue.serverTimestamp(),
    undone:false
  });
}

function initRuinsSelects(){
  if(!el.utcMonth||!el.utcDay||!el.utcHour)return;
  if(el.utcMonth.options.length||el.utcDay.options.length||el.utcHour.options.length)return;
  for(let i=1;i<=12;i++)el.utcMonth.insertAdjacentHTML("beforeend",`<option value="${i}">${i}월</option>`);
  for(let i=1;i<=31;i++)el.utcDay.insertAdjacentHTML("beforeend",`<option value="${i}">${i}일</option>`);
  for(let i=0;i<=23;i++)el.utcHour.insertAdjacentHTML("beforeend",`<option value="${i}">${String(i).padStart(2,"0")}:00</option>`);
}

function ensureRankingMoveField(){
  if(document.getElementById("rankEditMoveWrap"))return;

  const noteInput=el.rankEditNoteInput;
  if(!noteInput||!noteInput.parentElement)return;

  const wrap=document.createElement("div");
  wrap.className="form-group";
  wrap.id="rankEditMoveWrap";
  wrap.innerHTML=`
    <label><input type="checkbox" id="rankEditMoveDoneInput"> 이동 완료</label>
  `;
  noteInput.parentElement.insertAdjacentElement("afterend",wrap);
}

function getNicknameValue(){
  const direct=el.nicknameInput&&typeof el.nicknameInput.value==="string"?el.nicknameInput.value:"";
  const byId1=document.getElementById("nicknameInput")?.value||"";
  const byId2=document.getElementById("nickname")?.value||"";
  const active=document.activeElement&&typeof document.activeElement.value==="string"?document.activeElement.value:"";
  return String(direct||byId1||byId2||active||"").trim();
}

async function login(){
  try{
    const name=getNicknameValue();
    if(!name){
      alert("닉네임을 입력하세요.");
      el.nicknameInput?.focus();
      return;
    }
    state.currentUser=name;
    if(el.nicknameInput)el.nicknameInput.value=name;
    localStorage.setItem("partyAppUser",name);
    await ensureUserDoc(name);
    await refreshAdmin();
    await ensureEventDocs();
    goHome();
  }catch(e){
    console.error(e);
    alert("로그인 중 오류가 발생했습니다.");
    showOnly("login");
  }
}
if(el.nicknameInput){
  el.nicknameInput.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();login();}});
}
window.login=login;

async function logout(){
  clearSubscriptions();
  state.currentUser="";
  state.currentEventId="";
  state.isAdmin=false;
  state.parties=[];
  state.rearrangeEntries=[];
  state.rearrangeProgressEntries=[];
  state.rearrangeRankingMap={};
  state.rearrangePublic=false;
  state.editingRearrangeRankUser="";
  localStorage.removeItem("partyAppUser");
  localStorage.removeItem("partyAppEvent");
  updateUserBadge();
  updateEventActionButtons();
  showOnly("login");
  setTopTabs("");
}
window.logout=logout;

async function tryAutoLogin(){
  try{
    initRuinsSelects();
    ensureRankingMoveField();
    updateUserBadge();
    updateEventActionButtons();
    showOnly("login");

    const savedUser=localStorage.getItem("partyAppUser");
    if(!savedUser)return;

    state.currentUser=savedUser;
    await ensureUserDoc(savedUser);
    await refreshAdmin();
    await ensureEventDocs();

    const savedEvent=localStorage.getItem("partyAppEvent");
    if(savedEvent){openEvent(savedEvent);}else{goHome();}
  }catch(e){
    console.error(e);
    updateUserBadge();
    updateEventActionButtons();
    showOnly("login");
  }
}

async function renderHomeSummary(){
  const usersSnap=await db.collection("users").get();
  const adminsSnap=await db.collection("admins").get();
  el.homeSummary.innerHTML=`<div class="summary-card"><div class="muted">전체 유저</div><div class="big-number">${usersSnap.size}</div></div><div class="summary-card"><div class="muted">이벤트 수</div><div class="big-number">${state.events.length}</div></div><div class="summary-card"><div class="muted">운영진 수</div><div class="big-number">${adminsSnap.size}</div></div>`;
}

function renderHomeEventCards(){
  el.homeEventCards.innerHTML=state.events.map(e=>`<div class="event-card"><h3>${escapeHtml(e.name)}</h3><p>${escapeHtml(e.desc)}</p><div class="actions"><button onclick="openEvent('${escapeJs(e.id)}')">들어가기</button></div></div>`).join("");
}

async function goHome(){
  clearSubscriptions();
  state.currentEventId="";
  localStorage.removeItem("partyAppEvent");
  setTopTabs("home");
  updateEventActionButtons();
  renderHomeEventCards();
  await renderHomeSummary();
  showOnly("home");
}
window.goHome=goHome;

function updateEventActionButtons(){
  if(!el.createPartyBtn||!el.rearrangeEditBtn||!el.rearrangePublicBtn||!el.rearrangeManageBtn)return;

  el.createPartyBtn.classList.add("hidden");
  el.rearrangeEditBtn.classList.add("hidden");
  el.rearrangePublicBtn.classList.add("hidden");
  el.rearrangeManageBtn.classList.add("hidden");

  const canToggleRearrangePublic=state.currentUser==="병풍";

  if(state.currentEventId==="viking"){
    el.createPartyBtn.classList.remove("hidden");
    el.createPartyBtn.textContent="파티 생성";
    el.createPartyBtn.onclick=createParty;
  }

  if(state.currentEventId==="ruins"){
    el.createPartyBtn.classList.remove("hidden");
    el.createPartyBtn.textContent="유적 파티 생성";
    el.createPartyBtn.onclick=createParty;
  }

  if(state.currentEventId==="rearrange"){
    el.rearrangeEditBtn.classList.remove("hidden");

    if(state.isAdmin&&canToggleRearrangePublic){
      el.rearrangePublicBtn.classList.remove("hidden");
      el.rearrangePublicBtn.textContent=state.rearrangePublic?"순위 비공개":"순위 공개";
      el.rearrangePublicBtn.onclick=toggleRearrangePublic;
    }
  }
}

async function openEvent(id){
  state.currentEventId=id;
  localStorage.setItem("partyAppEvent",id);
  setTopTabs(id);
  const meta=state.events.find(v=>v.id===id);
  el.eventTitle.textContent=meta?meta.name:id;
  el.eventDesc.textContent=meta?meta.desc:"";
  updateEventActionButtons();
  showOnly("event");
  if(id==="rearrange") subscribeRearrange();
  else subscribeParties();
}
window.openEvent=openEvent;

function subscribeParties(){
  clearSubscriptions();
  state.unsubscribeParties=partiesRef(state.currentEventId).onSnapshot(snap=>{
    state.parties=snap.docs.map(doc=>{
      const d=doc.data()||{};
      return{
        id:doc.id,
        name:d.name||"",
        ruinName:d.ruinName||"",
        event:d.event||state.currentEventId,
        createdBy:d.createdBy||"",
        members:normalizeMembers(d.members),
        rallyLeader:d.rallyLeader||"",
        timeUTC:d.timeUTC||null,
        maxMembers:Number(d.maxMembers||0),
        type:d.type||"",
        createdAt:d.createdAt||null
      };
    });
    state.parties.sort(sortParties);
    renderPartyList();
  },err=>{
    console.error(err);
    alert("기본 데이터를 불러오는 중 오류가 발생했습니다.");
  });
}

function rebuildMergedRearrangeEntries(){
  state.rearrangeEntries=state.rearrangeProgressEntries.map(progress=>{
    const ranking=state.rearrangeRankingMap[progress.user]||{};
    return{
      ...progress,
      power:Number(ranking.power||0),
      note:String(ranking.note||""),
      moveDone:!!ranking.moveDone
    };
  });
  state.rearrangeEntries.sort(sortRearrangeEntries);
}

function subscribeRearrange(){
  clearSubscriptions();

  state.unsubscribeMeta=eventRef("rearrange").onSnapshot(doc=>{
    const d=doc.data()||{};
    state.rearrangePublic=!!d.rankingPublic;
    updateEventActionButtons();
    renderRearrangeEvent();
  },err=>{
    console.error(err);
    alert("기본 데이터를 불러오는 중 오류가 발생했습니다.");
  });

  state.unsubscribeParties=rearrangeProgressRef().onSnapshot(snap=>{
    state.rearrangeProgressEntries=snap.docs.map(doc=>{
      const d=doc.data()||{};
      return{
        id:doc.id,
        user:d.user||doc.id,
        stageText:String(d.stageText||d.stage||""),
        stageMajor:Number(d.stageMajor||0),
        stageMinor:Number(d.stageMinor||0),
        updatedAt:d.updatedAt||null,
        createdAt:d.createdAt||null
      };
    });
    rebuildMergedRearrangeEntries();
    renderRearrangeEvent();
  },err=>{
    console.error(err);
    alert("기본 데이터를 불러오는 중 오류가 발생했습니다.");
  });

  state.unsubscribeRanking=rearrangeRankingRef().onSnapshot(snap=>{
    const map={};
    snap.docs.forEach(doc=>{
      const d=doc.data()||{};
      map[doc.id]={
        user:d.user||doc.id,
        power:Number(d.power||0),
        note:String(d.note||""),
        moveDone:!!d.moveDone
      };
    });
    state.rearrangeRankingMap=map;
    rebuildMergedRearrangeEntries();
    renderRearrangeEvent();
  },err=>{
    console.error(err);
    alert("기본 데이터를 불러오는 중 오류가 발생했습니다.");
  });
}

function sortParties(a,b){
  if(state.currentEventId==="ruins")return getTimeValue(a.timeUTC)-getTimeValue(b.timeUTC);
  return String(a.name).localeCompare(String(b.name),"ko");
}

function sortRearrangeEntries(a,b){
  if(b.stageMajor!==a.stageMajor)return b.stageMajor-a.stageMajor;
  if(b.stageMinor!==a.stageMinor)return b.stageMinor-a.stageMinor;
  if((Number(b.power)||0)!==(Number(a.power)||0))return (Number(b.power)||0)-(Number(a.power)||0);
  return getTimeValue(b.updatedAt)-getTimeValue(a.updatedAt);
}

function getTimeValue(t){
  if(!t)return 0;
  if(typeof t.toDate==="function")return t.toDate().getTime();
  if(t.seconds)return t.seconds*1000;
  const n=new Date(t).getTime();
  return Number.isFinite(n)?n:0;
}

function toDate(t){
  if(!t)return null;
  if(typeof t.toDate==="function")return t.toDate();
  if(t.seconds)return new Date(t.seconds*1000);
  const d=new Date(t);
  return Number.isNaN(d.getTime())?null:d;
}

function formatKST(t){const d=toDate(t);if(!d)return"-";return`${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,"0")}:00`;}
function formatUTC(t){const d=toDate(t);if(!d)return"-";return`${d.getUTCMonth()+1}/${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2,"0")}:00`;}
function formatDateTime(t){const d=toDate(t);if(!d)return"-";return`${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;}
function calcPower(memberCount){const base=Math.max(memberCount-1,1);return Math.floor((920000/base)/1000)*1000;}
function myParty(){if(state.currentEventId!=="viking")return null;return state.parties.find(p=>p.members.includes(state.currentUser))||null;}
function myRearrangeEntry(){return state.rearrangeEntries.find(v=>v.user===state.currentUser)||null;}
function getRearrangeColumn(rank){if(rank<=10)return 1;if(rank<=24)return 2;if(rank<=42)return 3;if(rank<=58)return 4;return 5;}
function getLayoutLabel(rank){return `${getRearrangeColumn(rank)}열`;}

function parseNoteRule(note){
  const text=String(note||"").trim();
  const explicitMatch=text.match(/([1-5])\s*열/);
  const explicitColumn=explicitMatch?Number(explicitMatch[1]):0;
  const hasR45=/R4|R5/i.test(text);
  return {explicitColumn,hasR45};
}

function getDisplayedRearrangeEntries(entries){
  const capacities={1:10,2:14,3:18,4:16,5:Number.MAX_SAFE_INTEGER};
  const sorted=[...entries];
  const fixedByColumn={1:[],2:[],3:[],4:[],5:[]};
  const normal=[];

  sorted.forEach((entry,idx)=>{
    const rule=parseNoteRule(entry.note);
    const baseColumn=getRearrangeColumn(idx+1);

    if(rule.explicitColumn>=1&&rule.explicitColumn<=5){
      fixedByColumn[rule.explicitColumn].push(entry);
      return;
    }

    if(rule.hasR45&&baseColumn>=3){
      fixedByColumn[2].push(entry);
      return;
    }

    normal.push(entry);
  });

  const result=[];
  const usedUsers=new Set();

  function pushEntry(entry){
    if(!entry||usedUsers.has(entry.user))return false;
    usedUsers.add(entry.user);
    result.push(entry);
    return true;
  }

  function fillColumn(column){
    const limit=capacities[column];
    let count=0;

    for(const entry of fixedByColumn[column]){
      if(count>=limit)break;
      if(pushEntry(entry))count++;
    }

    for(const entry of normal){
      if(count>=limit)break;
      if(pushEntry(entry))count++;
    }
  }

  fillColumn(1);
  fillColumn(2);
  fillColumn(3);
  fillColumn(4);
  fillColumn(5);

  return result;
}

function renderPartyList(){
  if(!state.parties.length){
    el.partyList.innerHTML=`<div class="empty-card">아직 생성된 파티가 없습니다.</div>`;
    return;
  }
  el.partyList.innerHTML=state.parties.map(p=>state.currentEventId==="ruins"?renderRuinsCard(p):renderVikingCard(p)).join("");
}

function renderVikingCard(p){
  const meJoined=p.members.includes(state.currentUser);
  const canDelete=state.isAdmin||p.createdBy===state.currentUser;
  const canKick=state.isAdmin||p.createdBy===state.currentUser;
  const maxMembers=Number(p.maxMembers||0);
  const isFull=maxMembers>0&&p.members.length>=maxMembers;
  const membersHtml=p.members.map(name=>`<div class="member-line"><span class="${name===state.currentUser?"my-name":""}">${name===p.createdBy?"👑 ":""}${escapeHtml(name)}</span>${canKick&&name!==p.createdBy?`<button class="inline-btn" onclick="kickMember('${escapeJs(p.id)}','${escapeJs(name)}')">✖</button>`:""}</div>`).join("");
  return`<div class="party-card"><div class="party-title">${escapeHtml(p.name)}</div><div class="party-sub">파티장: ${escapeHtml(p.createdBy||"-")}</div><div class="party-sub">인원: ${p.members.length}${maxMembers>0?`/${maxMembers}`:""}명</div><div class="member-list">${membersHtml||'<div class="member-line"><span>참가자가 없습니다.</span></div>'}</div><div class="card-actions">${!meJoined&&!isFull?`<button onclick="joinParty('${escapeJs(p.id)}')">참가</button>`:""}${meJoined?`<button onclick="leaveParty('${escapeJs(p.id)}')">취소</button>`:""}${canDelete?`<button onclick="deleteParty('${escapeJs(p.id)}')">삭제</button>`:""}</div></div>`;
}

function renderRuinsCard(p){
  const members=[...p.members].sort((a,b)=>a===p.rallyLeader?-1:b===p.rallyLeader?1:a.localeCompare(b,"ko"));
  const meJoined=members.includes(state.currentUser);
  const power=calcPower(members.length).toLocaleString("ko-KR");
  const membersHtml=members.map(name=>`<div class="member-line"><span class="${name===state.currentUser?"my-name":""}">${name===p.rallyLeader?"👑 ":""}${escapeHtml(name)}</span>${state.isAdmin&&name!==p.rallyLeader?`<button class="inline-btn" onclick="setRallyLeader('${escapeJs(p.id)}','${escapeJs(name)}')">👍</button>`:""}${state.isAdmin?`<button class="inline-btn" onclick="kickMember('${escapeJs(p.id)}','${escapeJs(name)}')">✖</button>`:""}</div>`).join("");
  return`<div class="party-card"><div class="party-title">유적명: ${escapeHtml(p.ruinName||p.name)}</div><div class="party-sub">시간: ${formatKST(p.timeUTC)}</div><div class="party-sub">UTC ${formatUTC(p.timeUTC)}</div><div class="party-sub">병력수: ${power}명</div><div class="party-sub">인원: ${members.length}/15</div><div class="member-list compact">${membersHtml||'<div class="member-line"><span>참가자가 없습니다.</span></div>'}</div><div class="card-actions">${!meJoined&&members.length<15?`<button onclick="joinParty('${escapeJs(p.id)}')">참가</button>`:""}${meJoined?`<button onclick="leaveParty('${escapeJs(p.id)}')">취소</button>`:""}${state.isAdmin?`<button onclick="openRuinsEditModal('${escapeJs(p.id)}')">수정</button><button onclick="deleteParty('${escapeJs(p.id)}')">삭제</button>`:""}<button onclick="copyRuinsNotice('${escapeJs(p.id)}')">복사</button></div></div>`;
}

function renderRearrangeTable(entries){
  if(!entries.length)return `<div class="rank-empty">입력된 데이터가 없습니다.</div>`;

  const rows=entries.map((entry,idx)=>{
    const rank=idx+1;
    const rowClass=entry.user===state.currentUser?"rank-row-me":"";
    const powerText=entry.power>0?Number(entry.power).toLocaleString("ko-KR"):"-";
    const noteText=entry.note?escapeHtml(entry.note):"-";
    return `<tr class="${rowClass}">
      <td>${rank}</td>
      <td>${getLayoutLabel(rank)}</td>
      <td class="left ${entry.user===state.currentUser?"my-name":""}">${escapeHtml(entry.user)}</td>
      <td>${escapeHtml(entry.stageText||"-")}</td>
      <td>${powerText}</td>
      <td class="left">${noteText}</td>
      <td><input type="checkbox" ${entry.moveDone?"checked":""} ${state.isAdmin?`onchange="toggleRearrangeMoveDone('${escapeJs(entry.user)}', this.checked)"`:`disabled`}></td>
      ${state.isAdmin?`<td><button class="rank-edit-btn" onclick="openRearrangeRankEditModal('${escapeJs(entry.user)}')">관리</button></td>`:""}
    </tr>`;
  }).join("");

  return `<div class="rank-table-wrap">
    <table class="rank-table">
      <colgroup>
        <col><col><col><col><col><col><col>${state.isAdmin?`<col>`:""}
      </colgroup>
      <thead>
        <tr>
          <th>순위</th>
          <th>순열</th>
          <th>닉네임</th>
          <th>스테이지</th>
          <th>전투력</th>
          <th>비고</th>
          <th>이동</th>
          ${state.isAdmin?`<th>관리</th>`:""}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function renderRearrangeGuide(){
  return `<div class="layout-guide-wrap">
    <img src="자리 순열.png" alt="자리 순열 안내도" class="layout-guide-image" />
  </div>`;
}

function renderRearrangeEvent(){
  const mine=myRearrangeEntry();
  const visibleEntries=state.rearrangeEntries.filter(v=>!isHiddenTestNickname(v.user));
  const displayedEntries=getDisplayedRearrangeEntries(visibleEntries);

  const mineCard=`<div class="party-card"><div class="party-title">내 진척도</div><div class="party-sub">빛나는 첨탑 최고 스테이지</div><div class="party-sub">현재 입력값: ${mine?escapeHtml(mine.stageText):"미입력"}</div><div class="party-sub">최종 수정: ${mine?formatDateTime(mine.updatedAt):"-"}</div><div class="card-actions"><button onclick="openMyRearrangeModal()">${mine?"수정":"입력"}</button></div></div>`;

  let rankingCard="";
  let guideCard="";

  if(state.isAdmin||state.rearrangePublic){
    rankingCard=`<div class="party-card rank-table-card">
      <div class="party-title">진척도 순위표</div>
      <div class="party-sub">${state.isAdmin?state.rearrangePublic?"현재 전체 공개 상태입니다.":"현재 운영진만 볼 수 있습니다.":"공개된 순위입니다."}</div>
      <div class="card-actions">
        <button onclick="copyRearrangeColumns()">복사</button>
      </div>
      ${renderRearrangeTable(displayedEntries)}
    </div>`;

    guideCard=`<div class="party-card layout-guide-card">
      <div class="party-title">순열 안내 예시</div>
      <div class="party-sub">빨(1), 주(2), 노(3), 초(4), 파(5)</div>
      <div class="card-actions">
        <button onclick="openExampleImageModal('guide')">예시 크게 보기</button>
      </div>
      ${renderRearrangeGuide()}
    </div>`;
  }else{
    rankingCard=`<div class="party-card"><div class="party-title">진척도 순위</div><div class="party-sub">아직 공개되지 않았습니다.</div><div class="party-sub">운영진 공개 후 전체 유저가 확인할 수 있습니다.</div></div>`;
  }

  el.partyList.innerHTML=mineCard+rankingCard+guideCard;
}

async function createParty(){
  if(state.currentEventId==="viking")return createVikingParty();
  if(state.currentEventId==="ruins")return openRuinsCreateModal();
}
window.createParty=createParty;

async function createVikingParty(){
  const name=(prompt("파티 이름을 입력하세요.")||"").trim();
  if(!name)return;
  if(myParty()){alert("이미 다른 파티에 참여 중입니다.");return;}
  const maxInput=(prompt("최대 인원을 입력하세요.\n예: 6")||"").trim();
  const maxMembers=Number(maxInput);
  if(!Number.isInteger(maxMembers)||maxMembers<1){alert("최대 인원은 1 이상의 숫자로 입력하세요.");return;}
  const dup=await partiesRef("viking").where("name","==",name).get();
  if(!dup.empty){alert("같은 이름의 파티가 이미 있습니다.");return;}
  await partiesRef("viking").add({type:"viking",event:"viking",name,createdBy:state.currentUser,members:[state.currentUser],maxMembers,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
}

function openRuinsCreateModal(){
  if(!state.isAdmin){alert("유적 파티는 운영진만 생성할 수 있습니다.");return;}
  state.editingRuinsPartyId="";
  el.ruinsModalTitle.textContent="유적 파티 생성";
  el.ruinsSubmitBtn.textContent="생성";
  el.ruinNameInput.value="";
  el.utcMonth.value="1";
  el.utcDay.value="1";
  el.utcHour.value="0";
  el.ruinsCreateModal.classList.remove("hidden");
  syncOverlay();
}

async function openRuinsEditModal(partyId){
  if(!state.isAdmin){alert("권한이 없습니다.");return;}
  const p=state.parties.find(v=>v.id===partyId);
  if(!p){alert("파티를 찾을 수 없습니다.");return;}
  state.editingRuinsPartyId=partyId;
  el.ruinsModalTitle.textContent="유적 파티 수정";
  el.ruinsSubmitBtn.textContent="수정";
  el.ruinNameInput.value=p.ruinName||p.name||"";
  const d=toDate(p.timeUTC);
  if(d){
    el.utcMonth.value=String(d.getUTCMonth()+1);
    el.utcDay.value=String(d.getUTCDate());
    el.utcHour.value=String(d.getUTCHours());
  }
  el.ruinsCreateModal.classList.remove("hidden");
  syncOverlay();
}
window.openRuinsEditModal=openRuinsEditModal;

function closeRuinsCreateModal(){state.editingRuinsPartyId="";el.ruinsCreateModal.classList.add("hidden");syncOverlay();}
window.closeRuinsCreateModal=closeRuinsCreateModal;

async function submitRuinsParty(){
  if(!state.isAdmin){alert("권한이 없습니다.");return;}
  const ruinName=(el.ruinNameInput.value||"").trim();
  const m=Number(el.utcMonth.value),d=Number(el.utcDay.value),h=Number(el.utcHour.value);
  if(!ruinName){alert("유적명을 입력하세요.");return;}
  if(!m||!d||h<0||h>23){alert("UTC 날짜/시간을 선택하세요.");return;}
  const year=new Date().getUTCFullYear();
  const utcDate=new Date(Date.UTC(year,m-1,d,h,0,0,0));
  if(state.editingRuinsPartyId){
    const ref=partiesRef("ruins").doc(state.editingRuinsPartyId);
    await ref.update({name:ruinName,ruinName,timeUTC:utcDate});
    await writeAdminLog("update_ruins_party",{partyId:state.editingRuinsPartyId,ruinName,month:m,day:d,hour:h});
  }else{
    await partiesRef("ruins").add({type:"ruins",event:"ruins",name:ruinName,ruinName,createdBy:state.currentUser,members:[],rallyLeader:"",maxMembers:15,timeUTC:utcDate,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
    await writeAdminLog("create_ruins_party",{ruinName,month:m,day:d,hour:h});
  }
  closeRuinsCreateModal();
}
window.submitRuinsParty=submitRuinsParty;

function lockRearrangeInputForManualTap(){el.rearrangeStageInput?.setAttribute("readonly","readonly");el.rearrangeStageInput?.blur();}
function unlockRearrangeInput(){if(el.rearrangeStageInput?.hasAttribute("readonly"))el.rearrangeStageInput.removeAttribute("readonly");}
if(el.rearrangeStageInput){
  const unlockAndFocus=()=>{unlockRearrangeInput();setTimeout(()=>{try{el.rearrangeStageInput.focus({preventScroll:true});}catch(_){el.rearrangeStageInput.focus();}},0);};
  el.rearrangeStageInput.addEventListener("pointerdown",unlockAndFocus);
  el.rearrangeStageInput.addEventListener("touchstart",unlockAndFocus,{passive:true});
  el.rearrangeStageInput.addEventListener("mousedown",unlockAndFocus);
}

function openMyRearrangeModal(){
  el.rearrangeModalTitle.textContent="내 진척도 입력";
  el.rearrangeSubmitBtn.textContent="저장";
  const mine=myRearrangeEntry();
  el.rearrangeStageInput.value=mine?mine.stageText:"";
  lockRearrangeInputForManualTap();
  el.rearrangeModal.classList.remove("hidden");
  syncOverlay();
  setTimeout(()=>{if(document.activeElement&&typeof document.activeElement.blur==="function")document.activeElement.blur();el.rearrangeStageInput.blur();},80);
}
function closeRearrangeModal(){el.rearrangeStageInput?.blur();el.rearrangeStageInput?.removeAttribute("readonly");el.rearrangeModal?.classList.add("hidden");syncOverlay();}
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
function closeExampleImageModal(){el.exampleImageModal?.classList.add("hidden");syncOverlay();}
window.openMyRearrangeModal=openMyRearrangeModal;
window.closeRearrangeModal=closeRearrangeModal;
window.openExampleImageModal=openExampleImageModal;
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

async function submitRearrangeProgress(){
  const raw=(el.rearrangeStageInput.value||"").trim();
  const parsed=parseStageText(raw);
  if(!parsed){alert("최고 스테이지는 15-4 형식으로 입력하세요.");return;}
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
}
window.submitRearrangeProgress=submitRearrangeProgress;

function openRearrangeRankEditModal(userName=""){
  if(!state.isAdmin){alert("권한이 없습니다.");return;}
  ensureRankingMoveField();

  const entry=userName?state.rearrangeEntries.find(v=>v.user===userName):null;
  if(!entry){alert("대상을 찾을 수 없습니다.");return;}

  state.editingRearrangeRankUser=entry.user;
  el.rearrangeRankEditTitle.textContent="순위표 관리";
  el.rankEditSubmitBtn.textContent="저장";
  el.rankEditDeleteBtn.classList.remove("hidden");

  el.rankEditNicknameInput.value=entry.user||"";
  el.rankEditStageInput.value=entry.stageText||"";
  el.rankEditPowerInput.value=entry.power>0?String(entry.power):"";
  el.rankEditNoteInput.value=entry.note||"";

  el.rankEditNicknameInput.readOnly=true;
  el.rankEditStageInput.readOnly=true;

  const moveInput=document.getElementById("rankEditMoveDoneInput");
  if(moveInput)moveInput.checked=!!entry.moveDone;

  el.rankEditDeleteBtn.textContent="관리값 삭제";
  el.rearrangeRankEditModal.classList.remove("hidden");
  syncOverlay();
}
function closeRearrangeRankEditModal(){
  state.editingRearrangeRankUser="";
  el.rankEditNicknameInput.readOnly=false;
  el.rankEditStageInput.readOnly=false;
  el.rearrangeRankEditModal?.classList.add("hidden");
  syncOverlay();
}
window.openRearrangeRankEditModal=openRearrangeRankEditModal;
window.closeRearrangeRankEditModal=closeRearrangeRankEditModal;

async function submitRearrangeRankEdit(){
  if(!state.isAdmin){alert("권한이 없습니다.");return;}

  const user=state.editingRearrangeRankUser||"";
  if(!user){alert("대상을 찾을 수 없습니다.");return;}

  const powerRaw=(el.rankEditPowerInput.value||"").trim();
  const note=(el.rankEditNoteInput.value||"").trim();
  const moveDone=!!document.getElementById("rankEditMoveDoneInput")?.checked;

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
    moveDone,
    updatedAt:firebase.firestore.FieldValue.serverTimestamp()
  },{merge:true});

  await writeAdminLog("update_rearrange_ranking_meta",{user,power,note,moveDone});
  closeRearrangeRankEditModal();
}
window.submitRearrangeRankEdit=submitRearrangeRankEdit;

async function deleteRearrangeRankRow(){
  if(!state.isAdmin){alert("권한이 없습니다.");return;}
  const user=state.editingRearrangeRankUser||"";
  if(!user)return;
  if(!confirm(`${user}의 관리값(비고/이동/전투력)을 삭제하시겠습니까?\n원본 진척도 데이터는 삭제되지 않습니다.`))return;

  await rearrangeRankingRef().doc(user).delete();
  await writeAdminLog("delete_rearrange_ranking_meta",{user});
  closeRearrangeRankEditModal();
}
window.deleteRearrangeRankRow=deleteRearrangeRankRow;

async function toggleRearrangeMoveDone(userName, checked){
  if(!state.isAdmin){
    alert("권한이 없습니다.");
    return;
  }
  await rearrangeRankingRef().doc(userName).set({
    user:userName,
    moveDone:!!checked,
    updatedAt:firebase.firestore.FieldValue.serverTimestamp()
  },{merge:true});
  await writeAdminLog("toggle_rearrange_move_done",{user:userName,moveDone:!!checked});
}
window.toggleRearrangeMoveDone=toggleRearrangeMoveDone;

async function toggleRearrangePublic(){
  if(!state.isAdmin){alert("권한이 없습니다.");return;}
  const next=!state.rearrangePublic;
  const message=next?"순위를 전체 공개하시겠습니까?":"순위를 다시 비공개하시겠습니까?";
  if(!confirm(message))return;
  await eventRef("rearrange").set({rankingPublic:next},{merge:true});
  await writeAdminLog(next?"publish_rearrange_ranking":"hide_rearrange_ranking",{rankingPublic:next});
}
window.toggleRearrangePublic=toggleRearrangePublic;

async function joinParty(id){
  if(state.currentEventId==="viking"&&myParty()){alert("이미 다른 파티에 참여 중입니다.");return;}
  const ref=partiesRef(state.currentEventId).doc(id);
  const snap=await ref.get();
  if(!snap.exists){alert("파티를 찾을 수 없습니다.");return;}
  const d=snap.data()||{};
  const members=normalizeMembers(d.members);
  if(state.currentEventId==="ruins"&&members.length>=15){alert("유적 파티는 최대 15명입니다.");return;}
  if(state.currentEventId==="viking"&&Number(d.maxMembers||0)>0&&members.length>=Number(d.maxMembers)){alert("이 파티는 정원이 가득 찼습니다.");return;}
  if(members.includes(state.currentUser)){if(state.currentEventId==="ruins"){alert("이미 이 유적 파티에 신청되어 있습니다.");}return;}
  members.push(state.currentUser);
  await ref.update({members});
}
window.joinParty=joinParty;

async function leaveParty(id){
  const ref=partiesRef(state.currentEventId).doc(id);
  const snap=await ref.get();
  if(!snap.exists)return;
  const d=snap.data()||{};
  const members=normalizeMembers(d.members).filter(v=>v!==state.currentUser);
  const updates={members};
  if(state.currentEventId==="ruins"&&d.rallyLeader===state.currentUser)updates.rallyLeader=members[0]||"";
  await ref.update(updates);
}
window.leaveParty=leaveParty;

async function deleteParty(id){
  const ref=partiesRef(state.currentEventId).doc(id);
  const snap=await ref.get();
  if(!snap.exists)return;
  const d=snap.data()||{};
  const ok=state.isAdmin||d.createdBy===state.currentUser;
  if(!ok){alert("삭제 권한이 없습니다.");return;}
  if(!confirm(state.currentEventId==="ruins"?"정말 이 유적 파티를 삭제하시겠습니까?":"정말 이 파티를 삭제하시겠습니까?"))return;
  await ref.delete();
  if(state.isAdmin)await writeAdminLog("delete_party",{partyId:id,name:d.name||"",ruinName:d.ruinName||""});
}
window.deleteParty=deleteParty;

async function kickMember(id,name){
  const p=state.parties.find(v=>v.id===id);
  if(!p)return;
  const ok=state.isAdmin||p.createdBy===state.currentUser;
  if(!ok){alert("추방 권한이 없습니다.");return;}
  if(!confirm(`${name} 님을 추방하시겠습니까?`))return;
  const ref=partiesRef(state.currentEventId).doc(id);
  const members=normalizeMembers(p.members).filter(v=>v!==name);
  const updates={members};
  if(state.currentEventId==="ruins"&&p.rallyLeader===name)updates.rallyLeader=members[0]||"";
  await ref.update(updates);
  if(state.isAdmin)await writeAdminLog("kick_member",{partyId:id,memberName:name});
}
window.kickMember=kickMember;

async function setRallyLeader(id,name){
  if(!state.isAdmin){alert("권한이 없습니다.");return;}
  if(!confirm(`${name} 님을 집결장으로 지정하시겠습니까?`))return;
  const p=state.parties.find(v=>v.id===id);
  if(!p||!p.members.includes(name)){alert("해당 사용자는 현재 파티원이 아닙니다.");return;}
  await partiesRef("ruins").doc(id).update({rallyLeader:name});
  await writeAdminLog("set_rally_leader",{partyId:id,memberName:name});
}
window.setRallyLeader=setRallyLeader;

function copyRuinsNotice(partyId){
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
  const text=`${title}
시간: ${kstTime}(UTC ${utcTime})
집결장: ${leader||"-"}
집결원: ${others.join(", ")}
병력수: ${power}명`;
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(()=>alert("복사되었습니다."),()=>fallbackCopy(text));}
  else fallbackCopy(text);
}

function fallbackCopy(text){
  const ta=document.createElement("textarea");
  ta.value=text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
  alert("복사되었습니다.");
}

function copyRearrangeColumns(){
  const visibleEntries=state.rearrangeEntries.filter(v=>!isHiddenTestNickname(v.user));
  const displayedEntries=getDisplayedRearrangeEntries(visibleEntries);
  const columns={1:[],2:[],3:[],4:[],5:[]};

  displayedEntries.forEach((entry,idx)=>{
    const rank=idx+1;
    const col=getRearrangeColumn(rank);
    columns[col].push(entry.user);
  });

  const text=[
    `1열: ${columns[1].join(", ")}`,
    `2열: ${columns[2].join(", ")}`,
    `3열: ${columns[3].join(", ")}`,
    `4열: ${columns[4].join(", ")}`,
    `5열: ${columns[5].join(", ")}`
  ].join("\n");

  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(()=>alert("순열이 복사되었습니다."),()=>fallbackCopy(text));
  }else{
    fallbackCopy(text);
  }
}
window.copyRearrangeColumns=copyRearrangeColumns;

async function showAllUsers(){
  const usersSnap=await db.collection("users").get();
  const joined=new Set();
  if(state.currentEventId==="rearrange")state.rearrangeEntries.forEach(v=>joined.add(v.user));
  else state.parties.forEach(p=>normalizeMembers(p.members).forEach(n=>joined.add(n)));
  const all=[];
  usersSnap.forEach(doc=>{if(!isHiddenTestNickname(doc.id))all.push(doc.id);});
  all.sort((a,b)=>a.localeCompare(b,"ko"));
  el.joinedUsers.innerHTML=renderNameColumns(all.filter(n=>joined.has(n)));
  el.notJoinedUsers.innerHTML=renderNameColumns(all.filter(n=>!joined.has(n)));
  el.userModal.classList.remove("hidden");
  syncOverlay();
}
window.showAllUsers=showAllUsers;

function renderNameColumns(arr){if(!arr.length)return`<div class="name-item">(없음)</div>`;return arr.map(v=>`<div class="name-item">${escapeHtml(v)}</div>`).join("");}
function closeUserModal(){el.userModal?.classList.add("hidden");syncOverlay();}
window.closeUserModal=closeUserModal;

async function showAdminLogs(){
  if(!state.isAdmin){alert("권한이 없습니다.");return;}
  const snap=await db.collection("adminLogs").orderBy("createdAt","desc").limit(50).get();
  const items=[];snap.forEach(doc=>items.push({id:doc.id,...doc.data()}));
  el.logList.innerHTML=items.length?items.map(log=>`<div class="log-item"><div class="log-top"><div class="log-action">${escapeHtml(log.action||"")}</div><div class="muted">${log.admin?escapeHtml(log.admin):""}</div></div><div class="muted">이벤트: ${escapeHtml(log.event||"-")}</div><div class="muted">${escapeHtml(JSON.stringify(log.payload||{}))}</div>${!log.undone?`<button class="undo-btn" onclick="undoAdminLog('${escapeJs(log.id)}')">실행취소</button>`:`<div class="muted">실행취소됨</div>`}</div>`).join(""):`<div class="empty-card">운영 로그가 없습니다.</div>`;
  el.logModal.classList.remove("hidden");
  syncOverlay();
  closeAdminMenu();
}
window.showAdminLogs=showAdminLogs;

function closeLogModal(){el.logModal?.classList.add("hidden");syncOverlay();}
window.closeLogModal=closeLogModal;

async function undoAdminLog(id){
  const ref=db.collection("adminLogs").doc(id);
  const snap=await ref.get();
  if(!snap.exists)return;
  const log=snap.data()||{};
  if(log.undone)return;
  const p=log.payload||{};
  if(log.action==="set_rally_leader"&&log.event==="ruins"&&p.partyId) await partiesRef("ruins").doc(p.partyId).update({rallyLeader:""});
  if(log.action==="kick_member"&&log.event&&p.partyId&&p.memberName){
    const pref=partiesRef(log.event).doc(p.partyId);
    const psnap=await pref.get();
    if(psnap.exists){
      const d=psnap.data()||{};
      const members=normalizeMembers(d.members);
      if(!members.includes(p.memberName)){members.push(p.memberName);await pref.update({members});}
    }
  }
  if((log.action==="publish_rearrange_ranking"||log.action==="hide_rearrange_ranking")&&typeof p.rankingPublic==="boolean"){
    await eventRef("rearrange").set({rankingPublic:!p.rankingPublic},{merge:true});
  }
  if(log.action==="delete_rearrange_ranking_meta"&&p.user){
    await rearrangeRankingRef().doc(p.user).set({user:p.user},{merge:true});
  }
  await ref.update({undone:true,undoneAt:firebase.firestore.FieldValue.serverTimestamp(),undoneBy:state.currentUser});
  showAdminLogs();
}
window.undoAdminLog=undoAdminLog;

document.addEventListener("DOMContentLoaded",tryAutoLogin);
