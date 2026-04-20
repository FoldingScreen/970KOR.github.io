const firebaseConfig={apiKey:"AIzaSyBu2RrQn8cAwwWaLtw5O8Omwn4-NzHWuc0",authDomain:"kor-app-fa47e.firebaseapp.com",projectId:"kor-app-fa47e",storageBucket:"kor-app-fa47e.firebasestorage.app",messagingSenderId:"397749083935",appId:"1:397749083935:web:51c7c"};
if(!firebase.apps.length)firebase.initializeApp(firebaseConfig);
const db=firebase.firestore();

const HOLY_SWORD_AREAS=[
  "마구간",
  "시계탑",
  "수도원 1",
  "수도원 2",
  "수도원 3",
  "수도원 4",
  "성소 1",
  "성소 2"
];

const state={
  currentUser:"",
  currentEventId:"",
  isAdmin:false,
  unsubscribeParties:null,
  unsubscribeMeta:null,
  unsubscribeRanking:null,
  unsubscribeLabyrinths:null,
  unsubscribeCurrentLabyrinth:null,
  unsubscribeStages:null,
  unsubscribePlayer:null,
  parties:[],
  rearrangeProgressEntries:[],
  rearrangeRankingMap:{},
  rearrangeEntries:[],
  rearrangePublic:false,
  rearrangeInputEnabled:false,
  holySwordSelectedSide:localStorage.getItem("holySwordSelectedSide")||"KOR",
  tripleAllianceSelectedSide:localStorage.getItem("tripleAllianceSelectedSide")||"KOR",
  editingRuinsPartyId:"",
  editingRearrangeRankUser:"",
  editingHolySwordPartyId:"",
  labyrinths:[],
  currentLabyrinthId:"",
  currentLabyrinth:null,
  currentLabyrinthStages:[],
  currentLabyrinthPlayer:null,
  editingLabyrinthId:"",
  editingStageId:"",
  events:[
    {id:"viking",name:"바이킹의 역습",desc:"'전하 퇴청하시옵소서'를 영어로? 바이킹~ 엌ㅋㅋ"},
    {id:"ruins",name:"유적 쟁탈",desc:"가장 강력한 유적은? 무적 엌ㅋㅋㅋ"},
    {id:"holy_sword",name:"성검 쟁탈",desc:"검이 정색하면? 검정색 엌ㅋㅋㅋ"},
    {id:"triple_alliance",name:"삼대 연맹전",desc:"소속별 참가 여부만 관리"},
    {id:"rearrange",name:"자리 재배치",desc:"자동차에서 가장 시원한 자리는? 차가운데 엌ㅋㅋ"},
    {id:"escape_labyrinth",name:"사바나의 첨탑",desc:"누구나 미궁을 만들고 플레이할 수 있습니다."}
  ]
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
  createLabyrinthBtn:document.getElementById("createLabyrinthBtn"),
  backToLabyrinthListBtn:document.getElementById("backToLabyrinthListBtn"),
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
  rankEditSubmitBtn:document.getElementById("rankEditSubmitBtn"),
  holySwordAreaModal:document.getElementById("holySwordAreaModal"),
  holySwordAreaModalTitle:document.getElementById("holySwordAreaModalTitle"),
  holySwordAreaUserSelect:document.getElementById("holySwordAreaUserSelect"),
  holySwordAreaSelect:document.getElementById("holySwordAreaSelect"),
  holySwordAreaAssignmentList:document.getElementById("holySwordAreaAssignmentList"),
  firstGroupCheckbox:document.getElementById("firstGroupCheckbox"),

  escapeLabyrinthScreen:document.getElementById("escapeLabyrinthScreen"),
  labyrinthHomeView:document.getElementById("labyrinthHomeView"),
  labyrinthDetailView:document.getElementById("labyrinthDetailView"),
  publicLabyrinthList:document.getElementById("publicLabyrinthList"),
  myLabyrinthList:document.getElementById("myLabyrinthList"),
  labyrinthDetailTitle:document.getElementById("labyrinthDetailTitle"),
  labyrinthDetailMeta:document.getElementById("labyrinthDetailMeta"),
  labyrinthDetailDescription:document.getElementById("labyrinthDetailDescription"),
  labyrinthProgressSummary:document.getElementById("labyrinthProgressSummary"),
  labyrinthStageList:document.getElementById("labyrinthStageList"),

  createLabyrinthModal:document.getElementById("createLabyrinthModal"),
  labyrinthTitleInput:document.getElementById("labyrinthTitleInput"),
  labyrinthDescriptionInput:document.getElementById("labyrinthDescriptionInput"),
  labyrinthThumbnailTextInput:document.getElementById("labyrinthThumbnailTextInput"),
  labyrinthPublicCheckbox:document.getElementById("labyrinthPublicCheckbox"),
  labyrinthOpenCheckbox:document.getElementById("labyrinthOpenCheckbox"),

  editLabyrinthModal:document.getElementById("editLabyrinthModal"),
  editLabyrinthTitleInput:document.getElementById("editLabyrinthTitleInput"),
  editLabyrinthDescriptionInput:document.getElementById("editLabyrinthDescriptionInput"),
  editLabyrinthThumbnailTextInput:document.getElementById("editLabyrinthThumbnailTextInput"),
  editLabyrinthPublicCheckbox:document.getElementById("editLabyrinthPublicCheckbox"),
  editLabyrinthOpenCheckbox:document.getElementById("editLabyrinthOpenCheckbox"),

  editStageModal:document.getElementById("editStageModal"),
  editStageModalTitle:document.getElementById("editStageModalTitle"),
  stageOrderInput:document.getElementById("stageOrderInput"),
  stageTitleInput:document.getElementById("stageTitleInput"),
  stageTypeSelect:document.getElementById("stageTypeSelect"),
  stageStoryInput:document.getElementById("stageStoryInput"),
  stageQuestionInput:document.getElementById("stageQuestionInput"),
  stageAnswerInput:document.getElementById("stageAnswerInput"),
  stagePlaceholderInput:document.getElementById("stagePlaceholderInput"),
  stageSuccessMessageInput:document.getElementById("stageSuccessMessageInput"),
  stageActiveCheckbox:document.getElementById("stageActiveCheckbox"),
  deleteStageBtn:document.getElementById("deleteStageBtn")
};

function escapeHtml(s){return String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");}
function escapeJs(s){return String(s??"").replace(/\\/g,"\\\\").replace(/'/g,"\\'");}
function escapeAttr(s){return escapeHtml(s);}
function normalizeMembers(m){return Array.isArray(m)?m.filter(v=>typeof v==="string"&&v.trim()!==""):[];}
function normalizeAssignments(v){return Array.isArray(v)?v.filter(x=>x&&typeof x.user==="string"&&typeof x.area==="string"):[];}
function normalizeNumberArray(v){return Array.isArray(v)?v.map(x=>Number(x)).filter(x=>Number.isInteger(x)&&x>=0):[];}
function normalizeObject(v){return v&&typeof v==="object"&&!Array.isArray(v)?v:{};}
function isHiddenTestNickname(name){const lowered=String(name||"").trim().toLowerCase();return TEST_HIDDEN_PREFIXES.some(prefix=>lowered.startsWith(String(prefix).toLowerCase()));}
function slugifyId(text){
  const base=String(text||"").trim().toLowerCase()
    .replace(/\s+/g,"-")
    .replace(/[^a-z0-9가-힣_-]/g,"")
    .replace(/-+/g,"-")
    .replace(/^-|-$/g,"");
  return base||`labyrinth-${Date.now()}`;
}
function normalizeAnswer(value){
  return String(value||"").trim().toLowerCase().replace(/\s+/g," ");
}
function showOnly(name){
  if(el.loginScreen)el.loginScreen.classList.add("hidden");
  if(el.homeScreen)el.homeScreen.classList.add("hidden");
  if(el.eventScreen)el.eventScreen.classList.add("hidden");
  if(name==="login"&&el.loginScreen)el.loginScreen.classList.remove("hidden");
  if(name==="home"&&el.homeScreen)el.homeScreen.classList.remove("hidden");
  if(name==="event"&&el.eventScreen)el.eventScreen.classList.remove("hidden");
}
function showEventContentMode(mode){
  if(el.partyList)el.partyList.classList.add("hidden");
  if(el.escapeLabyrinthScreen)el.escapeLabyrinthScreen.classList.add("hidden");
  if(mode==="party"&&el.partyList)el.partyList.classList.remove("hidden");
  if(mode==="labyrinth"&&el.escapeLabyrinthScreen)el.escapeLabyrinthScreen.classList.remove("hidden");
}

function eventRef(id){return db.collection("events").doc(id);}
function partiesRef(id){return eventRef(id).collection("parties");}
function rearrangeProgressRef(){return eventRef("rearrange").collection("progress");}
function rearrangeRankingRef(){return eventRef("rearrange").collection("ranking");}

function labyrinthsRef(){return eventRef("escape_labyrinth").collection("labyrinths");}
function labyrinthRef(id){return labyrinthsRef().doc(id);}
function labyrinthStagesRef(id){return labyrinthRef(id).collection("stages");}
function labyrinthPlayersRef(id){return labyrinthRef(id).collection("players");}
function labyrinthPlayerRef(id,nickname){return labyrinthPlayersRef(id).doc(nickname);}

function setTopTabs(active){
  document.querySelectorAll(".tab-btn").forEach(btn=>btn.classList.remove("active"));
  if(active==="home")document.querySelectorAll(".tab-btn")[0]?.classList.add("active");
  if(active==="viking")document.querySelectorAll(".tab-btn")[1]?.classList.add("active");
  if(active==="ruins")document.querySelectorAll(".tab-btn")[2]?.classList.add("active");
  if(active==="holy_sword")document.querySelectorAll(".tab-btn")[3]?.classList.add("active");
  if(active==="triple_alliance")document.querySelectorAll(".tab-btn")[4]?.classList.add("active");
  if(active==="rearrange")document.querySelectorAll(".tab-btn")[5]?.classList.add("active");
  if(active==="escape_labyrinth")document.querySelectorAll(".tab-btn")[6]?.classList.add("active");
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
    (el.rearrangeRankEditModal&&!el.rearrangeRankEditModal.classList.contains("hidden"))||
    (el.holySwordAreaModal&&!el.holySwordAreaModal.classList.contains("hidden"))||
    (el.createLabyrinthModal&&!el.createLabyrinthModal.classList.contains("hidden"))||
    (el.editLabyrinthModal&&!el.editLabyrinthModal.classList.contains("hidden"))||
    (el.editStageModal&&!el.editStageModal.classList.contains("hidden"));

  if(!el.modalOverlay)return;
  if(hasOpenModal)el.modalOverlay.classList.remove("hidden");
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
    closeHolySwordAreaModal();
    closeCreateLabyrinthModal();
    closeEditLabyrinthModal();
    closeEditStageModal();
    syncOverlay();
  });
}

function clearEscapeSubscriptions(){
  if(state.unsubscribeLabyrinths){state.unsubscribeLabyrinths();state.unsubscribeLabyrinths=null;}
  if(state.unsubscribeCurrentLabyrinth){state.unsubscribeCurrentLabyrinth();state.unsubscribeCurrentLabyrinth=null;}
  if(state.unsubscribeStages){state.unsubscribeStages();state.unsubscribeStages=null;}
  if(state.unsubscribePlayer){state.unsubscribePlayer();state.unsubscribePlayer=null;}
}

function clearSubscriptions(){
  if(state.unsubscribeParties){state.unsubscribeParties();state.unsubscribeParties=null;}
  if(state.unsubscribeMeta){state.unsubscribeMeta();state.unsubscribeMeta=null;}
  if(state.unsubscribeRanking){state.unsubscribeRanking();state.unsubscribeRanking=null;}
  clearEscapeSubscriptions();
}

async function ensureEventDocs(){
  for(const e of state.events){
    const ref=eventRef(e.id);
    const snap=await ref.get();
    const payload={name:e.name,desc:e.desc};
    if(!snap.exists&&e.id==="rearrange"){
      payload.rankingPublic=false;
      payload.rearrangeInputEnabled=false;
    }
    await ref.set(payload,{merge:true});
  }
}

async function ensureUserDoc(name){
  await db.collection("users").doc(name).set({
    nickname:name,
    lastLoginAt:firebase.firestore.FieldValue.serverTimestamp()
  },{merge:true});
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

function ensureHolySwordFields(){
  const wrap=document.getElementById("holySwordSideWrap");
  if(wrap&&!document.getElementById("holySwordSideSelect")){
    wrap.innerHTML=`<label>소속</label><select id="holySwordSideSelect"><option value="KOR">본연맹(KOR)</option><option value="KR1">아카데미(KR1)</option></select>`;
  }
}

function ensureRankingExtraFields(){
  if(!document.getElementById("rankEditExistingWrap")){
    const noteInput=el.rankEditNoteInput;
    if(noteInput&&noteInput.parentElement){
      const wrap=document.createElement("div");
      wrap.className="form-group";
      wrap.id="rankEditExistingWrap";
      wrap.innerHTML=`<label for="rankEditExistingInput">기존</label><input id="rankEditExistingInput" class="text-input" type="number" min="1" step="1" placeholder="예: 3">`;
      noteInput.parentElement.insertAdjacentElement("afterend",wrap);
    }
  }
  if(!document.getElementById("rankEditExcludeBtnWrap")){
    const existingWrap=document.getElementById("rankEditExistingWrap");
    if(existingWrap){
      const wrap=document.createElement("div");
      wrap.className="form-group";
      wrap.id="rankEditExcludeBtnWrap";
      wrap.innerHTML=`<button type="button" id="rankEditExcludeBtn" class="text-input">목록에서 제외</button>`;
      existingWrap.insertAdjacentElement("afterend",wrap);
    }
  }
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
  el.nicknameInput.addEventListener("keydown",e=>{
    if(e.key==="Enter"){
      e.preventDefault();
      login();
    }
  });
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
  state.editingRuinsPartyId="";
  state.editingRearrangeRankUser="";
  state.editingHolySwordPartyId="";
  state.labyrinths=[];
  state.currentLabyrinthId="";
  state.currentLabyrinth=null;
  state.currentLabyrinthStages=[];
  state.currentLabyrinthPlayer=null;
  state.editingLabyrinthId="";
  state.editingStageId="";
  localStorage.removeItem("partyAppUser");
  localStorage.removeItem("partyAppEvent");
  localStorage.removeItem("escapeLabyrinthId");
  updateUserBadge();
  updateEventActionButtons();
  showOnly("login");
  setTopTabs("");
}
window.logout=logout;

async function tryAutoLogin(){
  try{
    initRuinsSelects();
    ensureRankingExtraFields();
    ensureHolySwordFields();
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
    if(savedEvent==="escape_labyrinth"){
      await openEvent(savedEvent);
      const savedLabyrinthId=localStorage.getItem("escapeLabyrinthId");
      if(savedLabyrinthId)openLabyrinth(savedLabyrinthId);
    }else if(savedEvent)openEvent(savedEvent);
    else goHome();
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
  el.homeSummary.innerHTML=
    `<div class="summary-card"><div class="muted">전체 유저</div><div class="big-number">${usersSnap.size}</div></div>`+
    `<div class="summary-card"><div class="muted">이벤트 수</div><div class="big-number">${state.events.length}</div></div>`+
    `<div class="summary-card"><div class="muted">운영진 수</div><div class="big-number">${adminsSnap.size}</div></div>`;
}

function renderHomeEventCards(){
  el.homeEventCards.innerHTML=state.events.map(e=>`<div class="event-card"><h3>${escapeHtml(e.name)}</h3><p>${escapeHtml(e.desc)}</p><div class="actions"><button onclick="openEvent('${escapeJs(e.id)}')">들어가기</button></div></div>`).join("");
}

async function goHome(){
  clearSubscriptions();
  state.currentEventId="";
  state.currentLabyrinthId="";
  state.currentLabyrinth=null;
  state.currentLabyrinthStages=[];
  state.currentLabyrinthPlayer=null;
  localStorage.removeItem("partyAppEvent");
  localStorage.removeItem("escapeLabyrinthId");
  setTopTabs("home");
  updateEventActionButtons();
  renderHomeEventCards();
  await renderHomeSummary();
  showOnly("home");
}
window.goHome=goHome;

function updateEventActionButtons(){
  if(!el.createPartyBtn||!el.rearrangeEditBtn||!el.rearrangePublicBtn||!el.rearrangeManageBtn||!el.createLabyrinthBtn||!el.backToLabyrinthListBtn)return;

  el.createPartyBtn.classList.add("hidden");
  el.rearrangeEditBtn.classList.add("hidden");
  el.rearrangePublicBtn.classList.add("hidden");
  el.rearrangeManageBtn.classList.add("hidden");
  el.createLabyrinthBtn.classList.add("hidden");
  el.backToLabyrinthListBtn.classList.add("hidden");

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

  if(state.currentEventId==="holy_sword"){
    el.createPartyBtn.classList.remove("hidden");
    el.createPartyBtn.textContent="성검 파티 생성";
    el.createPartyBtn.onclick=createParty;
  }

  if(state.currentEventId==="triple_alliance"){
    el.createPartyBtn.classList.remove("hidden");
    el.createPartyBtn.textContent="삼대 연맹전 생성";
    el.createPartyBtn.onclick=createParty;
  }

  if(state.currentEventId==="rearrange"){
    el.rearrangeEditBtn.classList.remove("hidden");

    if(state.rearrangeInputEnabled){
      el.rearrangeEditBtn.textContent="내 진척도 입력";
      el.rearrangeEditBtn.onclick=openMyRearrangeModal;
    }else{
      el.rearrangeEditBtn.textContent="입력 일시중지";
      el.rearrangeEditBtn.onclick=()=>alert("현재 혼란 방지를 위해 개인 진척도 입력이 일시적으로 중지되어 있습니다.");
    }

    if(state.isAdmin&&canToggleRearrangePublic){
      el.rearrangePublicBtn.classList.remove("hidden");
      el.rearrangePublicBtn.textContent=state.rearrangePublic?"순위 비공개":"순위 공개";
      el.rearrangePublicBtn.onclick=toggleRearrangePublic;

      el.rearrangeManageBtn.classList.remove("hidden");
      el.rearrangeManageBtn.textContent=state.rearrangeInputEnabled?"입력 비활성화":"입력 활성화";
      el.rearrangeManageBtn.onclick=toggleRearrangeInputEnabled;
    }
  }

  if(state.currentEventId==="escape_labyrinth"){
    el.createLabyrinthBtn.classList.remove("hidden");
    el.createLabyrinthBtn.textContent="미궁 제작하기";
    el.createLabyrinthBtn.onclick=openCreateLabyrinthModal;
    if(state.currentLabyrinthId){
      el.backToLabyrinthListBtn.classList.remove("hidden");
      el.backToLabyrinthListBtn.textContent="목록으로";
      el.backToLabyrinthListBtn.onclick=openEscapeLabyrinthHome;
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

  if(id==="escape_labyrinth"){
    showEventContentMode("labyrinth");
    openEscapeLabyrinthHome();
    return;
  }

  showEventContentMode("party");

  if(id==="rearrange")subscribeRearrange();
  else subscribeParties();
}
window.openEvent=openEvent;

/* =========================
   Escape Labyrinth
========================= */

function sortLabyrinths(a,b){
  return getTimeValue(b.updatedAt)-getTimeValue(a.updatedAt)||String(a.title||"").localeCompare(String(b.title||""),"ko");
}
function sortStages(a,b){
  return Number(a.order||0)-Number(b.order||0)||String(a.title||"").localeCompare(String(b.title||""),"ko");
}
function getVisiblePublicLabyrinths(){
  return state.labyrinths.filter(v=>v.isPublic||v.creator===state.currentUser);
}
function getMyLabyrinths(){
  return state.labyrinths.filter(v=>v.creator===state.currentUser);
}
function isLabyrinthOwner(labyrinth){
  return !!labyrinth&&labyrinth.creator===state.currentUser;
}
function getActiveStages(){
  return [...state.currentLabyrinthStages].filter(v=>v.isActive!==false).sort(sortStages);
}
function getClearedStageOrders(player){
  return normalizeNumberArray(player?.clearedStageOrders);
}
function getCurrentPlayableStage(stages,player){
  const clearedSet=new Set(getClearedStageOrders(player));
  for(const stage of stages){
    if(!clearedSet.has(Number(stage.order)))return stage;
  }
  return null;
}
function getStageClearedAt(player,order){
  const map=normalizeObject(player?.stageClearedAtMap);
  return map[String(order)]||null;
}
function getStageEnteredAt(player,order){
  const map=normalizeObject(player?.stageEnteredAtMap);
  return map[String(order)]||null;
}
function renderLabyrinthOwnerTools(labyrinth){
  if(!isLabyrinthOwner(labyrinth))return "";
  return `<div class="labyrinth-maker-tools">
    <button onclick="openEditLabyrinthModal('${escapeJs(labyrinth.id)}')">정보 수정</button>
    <button onclick="openCreateStageModal('${escapeJs(labyrinth.id)}')">단계 추가</button>
  </div>`;
}
function renderLabyrinthCard(labyrinth,opts={}){
  const isOwner=isLabyrinthOwner(labyrinth);
  const statusClass=!labyrinth.isOpen?"closed":labyrinth.isPublic?"public":"private";
  const statusText=!labyrinth.isOpen?"준비중":labyrinth.isPublic?"공개중":"비공개";
  const stageCount=Number(labyrinth.stageCount||0);
  return `<div class="labyrinth-card">
    <div class="labyrinth-card-top">
      <h3 class="labyrinth-card-title">${escapeHtml(labyrinth.title||"제목 없음")}</h3>
      <span class="labyrinth-status-badge ${statusClass}">${escapeHtml(statusText)}</span>
    </div>
    <div class="labyrinth-card-description">${escapeHtml(labyrinth.thumbnailText||labyrinth.description||"설명이 없습니다.")}</div>
    <div class="labyrinth-card-meta">
      <div>제작자: ${escapeHtml(labyrinth.creator||"-")}</div>
      <div>단계 수: ${stageCount}개</div>
      <div>수정일: ${formatDateTime(labyrinth.updatedAt)}</div>
    </div>
    <div class="labyrinth-card-actions">
      <button onclick="openLabyrinth('${escapeJs(labyrinth.id)}')">입장하기</button>
      ${isOwner?`<button onclick="openEditLabyrinthModal('${escapeJs(labyrinth.id)}')">수정</button>`:""}
      ${opts.showPlayDisabled&&!labyrinth.isOpen?`<button disabled>준비중</button>`:""}
    </div>
  </div>`;
}
function renderLabyrinthHomeLists(){
  const publicItems=getVisiblePublicLabyrinths();
  const myItems=getMyLabyrinths();

  el.publicLabyrinthList.innerHTML=publicItems.length
    ? publicItems.map(item=>renderLabyrinthCard(item,{showPlayDisabled:true})).join("")
    : `<div class="labyrinth-empty">아직 공개된 미궁이 없습니다.</div>`;

  el.myLabyrinthList.innerHTML=myItems.length
    ? myItems.map(item=>renderLabyrinthCard(item,{showPlayDisabled:true})).join("")
    : `<div class="labyrinth-empty">아직 만든 미궁이 없습니다.<br>상단의 ‘미궁 제작하기’를 눌러 시작하세요.</div>`;
}
function showLabyrinthHomeView(){
  if(el.labyrinthHomeView)el.labyrinthHomeView.classList.remove("hidden");
  if(el.labyrinthDetailView)el.labyrinthDetailView.classList.add("hidden");
}
function showLabyrinthDetailView(){
  if(el.labyrinthHomeView)el.labyrinthHomeView.classList.add("hidden");
  if(el.labyrinthDetailView)el.labyrinthDetailView.classList.remove("hidden");
}
function subscribeEscapeLabyrinthHome(){
  clearSubscriptions();
  showEventContentMode("labyrinth");
  showLabyrinthHomeView();
  state.currentLabyrinthId="";
  state.currentLabyrinth=null;
  state.currentLabyrinthStages=[];
  state.currentLabyrinthPlayer=null;
  localStorage.removeItem("escapeLabyrinthId");
  updateEventActionButtons();

  state.unsubscribeLabyrinths=labyrinthsRef().onSnapshot(async snap=>{
    const items=await Promise.all(snap.docs.map(async doc=>{
      const d=doc.data()||{};
      let stageCount=Number(d.stageCount||0);
      return{
        id:doc.id,
        title:d.title||"",
        description:d.description||"",
        thumbnailText:d.thumbnailText||"",
        creator:d.creator||"",
        isPublic:!!d.isPublic,
        isOpen:d.isOpen!==false,
        stageCount,
        createdAt:d.createdAt||null,
        updatedAt:d.updatedAt||null
      };
    }));
    state.labyrinths=items.sort(sortLabyrinths);
    renderLabyrinthHomeLists();
  },err=>{
    console.error(err);
    alert("미궁 목록을 불러오는 중 오류가 발생했습니다.");
  });
}
function openEscapeLabyrinthHome(){
  if(state.currentEventId!=="escape_labyrinth")return;
  subscribeEscapeLabyrinthHome();
}
window.openEscapeLabyrinthHome=openEscapeLabyrinthHome;

function openLabyrinth(id){
  if(!id)return;
  const labyrinth=state.labyrinths.find(v=>v.id===id);
  if(labyrinth&&!labyrinth.isPublic&&labyrinth.creator!==state.currentUser){
    alert("비공개 미궁입니다.");
    return;
  }

  clearEscapeSubscriptions();
  showEventContentMode("labyrinth");
  showLabyrinthDetailView();
  state.currentLabyrinthId=id;
  localStorage.setItem("escapeLabyrinthId",id);
  updateEventActionButtons();

  state.unsubscribeCurrentLabyrinth=labyrinthRef(id).onSnapshot(doc=>{
    if(!doc.exists){
      alert("미궁을 찾을 수 없습니다.");
      openEscapeLabyrinthHome();
      return;
    }
    const d=doc.data()||{};
    state.currentLabyrinth={
      id:doc.id,
      title:d.title||"",
      description:d.description||"",
      thumbnailText:d.thumbnailText||"",
      creator:d.creator||"",
      isPublic:!!d.isPublic,
      isOpen:d.isOpen!==false,
      stageCount:Number(d.stageCount||0),
      createdAt:d.createdAt||null,
      updatedAt:d.updatedAt||null
    };
    renderCurrentLabyrinthDetail();
    updateEventActionButtons();
  },err=>{
    console.error(err);
    alert("미궁 정보를 불러오는 중 오류가 발생했습니다.");
  });

  state.unsubscribeStages=labyrinthStagesRef(id).onSnapshot(snap=>{
    state.currentLabyrinthStages=snap.docs.map(doc=>{
      const d=doc.data()||{};
      return{
        id:doc.id,
        order:Number(d.order||0),
        title:d.title||"",
        story:d.story||"",
        question:d.question||"",
        answer:d.answer||"",
        type:d.type||"question",
        placeholder:d.placeholder||"",
        successMessage:d.successMessage||"",
        isActive:d.isActive!==false,
        createdAt:d.createdAt||null,
        updatedAt:d.updatedAt||null
      };
    }).sort(sortStages);

    const count=state.currentLabyrinthStages.length;
    if(state.currentLabyrinth&&state.currentLabyrinth.stageCount!==count){
      labyrinthRef(id).set({
        stageCount:count,
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      },{merge:true}).catch(console.error);
    }
    renderCurrentLabyrinthDetail();
  },err=>{
    console.error(err);
    alert("단계 목록을 불러오는 중 오류가 발생했습니다.");
  });

  state.unsubscribePlayer=labyrinthPlayerRef(id,state.currentUser).onSnapshot(doc=>{
    if(doc.exists){
      const d=doc.data()||{};
      state.currentLabyrinthPlayer={
        nickname:d.nickname||state.currentUser,
        currentStageOrder:Number(d.currentStageOrder||0),
        clearedStageOrders:normalizeNumberArray(d.clearedStageOrders),
        stageEnteredAtMap:normalizeObject(d.stageEnteredAtMap),
        stageClearedAtMap:normalizeObject(d.stageClearedAtMap),
        createdAt:d.createdAt||null,
        updatedAt:d.updatedAt||null
      };
    }else{
      state.currentLabyrinthPlayer=null;
    }
    renderCurrentLabyrinthDetail();
  },err=>{
    console.error(err);
    alert("플레이 정보를 불러오는 중 오류가 발생했습니다.");
  });
}
window.openLabyrinth=openLabyrinth;

function renderLabyrinthProgressSummary(){
  if(!el.labyrinthProgressSummary)return;
  const stages=getActiveStages();
  const cleared=getClearedStageOrders(state.currentLabyrinthPlayer).length;
  const total=stages.length;
  const current=getCurrentPlayableStage(stages,state.currentLabyrinthPlayer);
  const currentText=current?current.title:"모든 단계 완료";
  el.labyrinthProgressSummary.classList.remove("hidden");
  el.labyrinthProgressSummary.innerHTML=
    `<div class="summary-card"><div class="muted">현재 단계</div><div class="big-number" style="font-size:22px;">${escapeHtml(currentText)}</div></div>`+
    `<div class="summary-card"><div class="muted">완료 단계</div><div class="big-number">${cleared}</div></div>`+
    `<div class="summary-card"><div class="muted">전체 단계</div><div class="big-number">${total}</div></div>`;
}

function renderCurrentLabyrinthDetail(){
  if(!state.currentLabyrinth||!el.labyrinthStageList||!el.labyrinthDetailTitle)return;
  const labyrinth=state.currentLabyrinth;
  const stages=getActiveStages();
  const player=state.currentLabyrinthPlayer;
  const clearedSet=new Set(getClearedStageOrders(player));
  const currentStage=getCurrentPlayableStage(stages,player);

  el.labyrinthDetailTitle.textContent=labyrinth.title||"미궁";
  el.labyrinthDetailMeta.innerHTML=`제작자: ${escapeHtml(labyrinth.creator||"-")} · ${labyrinth.isPublic?"공개":"비공개"} · ${labyrinth.isOpen?"플레이 가능":"준비중"}`;
  el.labyrinthDetailDescription.textContent=labyrinth.description||"";
  renderLabyrinthProgressSummary();

  const ownerTools=renderLabyrinthOwnerTools(labyrinth);
  const topTools=ownerTools?`<div class="card" style="margin-bottom:16px;">${ownerTools}</div>`:"";

  let html="";
  if(!labyrinth.isPublic&&labyrinth.creator!==state.currentUser){
    html=`<div class="labyrinth-empty">비공개 미궁입니다.</div>`;
    el.labyrinthStageList.innerHTML=topTools+html;
    return;
  }

  if(!stages.length){
    html=`<div class="labyrinth-empty">아직 등록된 단계가 없습니다.${isLabyrinthOwner(labyrinth)?"<br>‘단계 추가’로 첫 단계를 만들어보세요.":""}</div>`;
    el.labyrinthStageList.innerHTML=topTools+html;
    return;
  }

  if(!labyrinth.isOpen&&labyrinth.creator!==state.currentUser){
    html=`<div class="labyrinth-empty">이 미궁은 아직 플레이 준비 중입니다.</div>`;
    el.labyrinthStageList.innerHTML=topTools+html;
    return;
  }

  const cards=[];

  for(const stage of stages){
    const cleared=clearedSet.has(Number(stage.order));
    const isCurrent=currentStage&&Number(currentStage.order)===Number(stage.order);
    if(!cleared&&!isCurrent)break;
    cards.push(renderLabyrinthStageCard(stage,{cleared,isCurrent,labyrinth,player}));
  }

  if(!currentStage&&stages.length){
    cards.push(`<div class="labyrinth-stage-card cleared">
      <div class="labyrinth-stage-header">
        <h3 class="labyrinth-stage-title">탈출 완료</h3>
        <span class="labyrinth-clear-badge">완료</span>
      </div>
      <div class="labyrinth-stage-story">축하합니다. 모든 단계를 통과했습니다.</div>
    </div>`);
  }

  el.labyrinthStageList.innerHTML=topTools+cards.join("");
}

function renderLabyrinthStageCard(stage,{cleared,isCurrent,labyrinth,player}){
  const owner=isLabyrinthOwner(labyrinth);
  const clearedAt=getStageClearedAt(player,stage.order);
  const enteredAt=getStageEnteredAt(player,stage.order);
  const orderText=stage.order===0?"입구":`${stage.order}단계`;
  const ownerButtons=owner?`<div class="labyrinth-maker-tools"><button onclick="openEditStageModal('${escapeJs(labyrinth.id)}','${escapeJs(stage.id)}')">단계 수정</button></div>`:"";

  if(cleared){
    return `<div class="labyrinth-stage-card cleared">
      <div class="labyrinth-stage-header">
        <h3 class="labyrinth-stage-title">${escapeHtml(stage.title||"단계")}</h3>
        <span class="labyrinth-stage-order">${escapeHtml(orderText)}</span>
      </div>
      <div class="labyrinth-stage-story">${escapeHtml(stage.story||"")}</div>
      <div class="labyrinth-clear-badge">통과 완료</div>
      <div class="labyrinth-stage-meta">통과 시각: ${formatDateTime(clearedAt)}</div>
      ${ownerButtons}
    </div>`;
  }

  if(isCurrent){
    const inputId=`labyrinthAnswerInput_${escapeAttr(stage.id)}`;
    const actionHtml=stage.type==="entry"
      ? `<div class="labyrinth-stage-footer">
          <div class="labyrinth-stage-meta">이 단계를 시작하면 미궁 진행이 기록됩니다.</div>
          <button onclick="submitLabyrinthEntryStage('${escapeJs(stage.id)}')">${escapeHtml(stage.title||"입장하기")}</button>
        </div>`
      : `<div class="labyrinth-stage-input-wrap">
          <input id="${inputId}" class="text-input" type="text" placeholder="${escapeAttr(stage.placeholder||"정답을 입력하세요.")}" />
          <div class="labyrinth-stage-footer">
            <div class="labyrinth-stage-meta">현재 단계입니다. 정답을 맞히면 다음 단계가 열립니다.</div>
            <button onclick="submitLabyrinthAnswer('${escapeJs(stage.id)}','${escapeJs(inputId)}')">확인</button>
          </div>
        </div>`;

    return `<div class="labyrinth-stage-card current">
      <div class="labyrinth-stage-header">
        <h3 class="labyrinth-stage-title">${escapeHtml(stage.title||"단계")}</h3>
        <span class="labyrinth-stage-order">${escapeHtml(orderText)}</span>
      </div>
      <div class="labyrinth-stage-story">${escapeHtml(stage.story||"")}</div>
      ${stage.question?`<div class="labyrinth-stage-question">${escapeHtml(stage.question)}</div>`:""}
      ${actionHtml}
      <div class="labyrinth-stage-meta">입장 시각: ${enteredAt?formatDateTime(enteredAt):"-"}</div>
      ${ownerButtons}
    </div>`;
  }

  return `<div class="labyrinth-lock-card">잠긴 단계</div>`;
}

async function submitLabyrinthEntryStage(stageId){
  const stage=state.currentLabyrinthStages.find(v=>v.id===stageId);
  if(!stage||!state.currentLabyrinthId)return;

  const player=state.currentLabyrinthPlayer;
  const enteredMap={...normalizeObject(player?.stageEnteredAtMap)};
  const clearedMap={...normalizeObject(player?.stageClearedAtMap)};
  const clearedOrders=new Set(getClearedStageOrders(player));

  if(!enteredMap[String(stage.order)])enteredMap[String(stage.order)]=firebase.firestore.FieldValue.serverTimestamp();
  clearedMap[String(stage.order)]=firebase.firestore.FieldValue.serverTimestamp();
  clearedOrders.add(Number(stage.order));

  const nextStage=getActiveStages().find(v=>Number(v.order)>Number(stage.order));

  await labyrinthPlayerRef(state.currentLabyrinthId,state.currentUser).set({
    nickname:state.currentUser,
    currentStageOrder:nextStage?Number(nextStage.order):Number(stage.order),
    clearedStageOrders:[...clearedOrders].sort((a,b)=>a-b),
    stageEnteredAtMap:enteredMap,
    stageClearedAtMap:clearedMap,
    updatedAt:firebase.firestore.FieldValue.serverTimestamp(),
    createdAt:player?.createdAt||firebase.firestore.FieldValue.serverTimestamp()
  },{merge:true});

  if(stage.successMessage)alert(stage.successMessage);
}
window.submitLabyrinthEntryStage=submitLabyrinthEntryStage;

async function submitLabyrinthAnswer(stageId,inputId){
  const stage=state.currentLabyrinthStages.find(v=>v.id===stageId);
  if(!stage||!state.currentLabyrinthId)return;
  const input=document.getElementById(inputId);
  const raw=input?.value||"";
  if(!String(raw).trim()){
    alert("정답을 입력하세요.");
    input?.focus();
    return;
  }

  if(normalizeAnswer(raw)!==normalizeAnswer(stage.answer)){
    alert("정답이 아닙니다.");
    return;
  }

  const player=state.currentLabyrinthPlayer;
  const enteredMap={...normalizeObject(player?.stageEnteredAtMap)};
  const clearedMap={...normalizeObject(player?.stageClearedAtMap)};
  const clearedOrders=new Set(getClearedStageOrders(player));

  if(!enteredMap[String(stage.order)])enteredMap[String(stage.order)]=firebase.firestore.FieldValue.serverTimestamp();
  clearedMap[String(stage.order)]=firebase.firestore.FieldValue.serverTimestamp();
  clearedOrders.add(Number(stage.order));

  const nextStage=getActiveStages().find(v=>Number(v.order)>Number(stage.order));

  await labyrinthPlayerRef(state.currentLabyrinthId,state.currentUser).set({
    nickname:state.currentUser,
    currentStageOrder:nextStage?Number(nextStage.order):Number(stage.order),
    clearedStageOrders:[...clearedOrders].sort((a,b)=>a-b),
    stageEnteredAtMap:enteredMap,
    stageClearedAtMap:clearedMap,
    updatedAt:firebase.firestore.FieldValue.serverTimestamp(),
    createdAt:player?.createdAt||firebase.firestore.FieldValue.serverTimestamp()
  },{merge:true});

  if(input)input.value="";
  alert(stage.successMessage||"통과했습니다.");
}
window.submitLabyrinthAnswer=submitLabyrinthAnswer;

/* ===== 미궁 생성/수정 ===== */
function openCreateLabyrinthModal(){
  if(!state.currentUser){
    alert("로그인 후 이용하세요.");
    return;
  }
  state.editingLabyrinthId="";
  if(el.labyrinthTitleInput)el.labyrinthTitleInput.value="";
  if(el.labyrinthDescriptionInput)el.labyrinthDescriptionInput.value="";
  if(el.labyrinthThumbnailTextInput)el.labyrinthThumbnailTextInput.value="";
  if(el.labyrinthPublicCheckbox)el.labyrinthPublicCheckbox.checked=false;
  if(el.labyrinthOpenCheckbox)el.labyrinthOpenCheckbox.checked=true;
  el.createLabyrinthModal?.classList.remove("hidden");
  syncOverlay();
}
function closeCreateLabyrinthModal(){
  el.createLabyrinthModal?.classList.add("hidden");
  syncOverlay();
}
window.openCreateLabyrinthModal=openCreateLabyrinthModal;
window.closeCreateLabyrinthModal=closeCreateLabyrinthModal;

async function submitCreateLabyrinth(){
  const title=(el.labyrinthTitleInput?.value||"").trim();
  const description=(el.labyrinthDescriptionInput?.value||"").trim();
  const thumbnailText=(el.labyrinthThumbnailTextInput?.value||"").trim();
  const isPublic=!!el.labyrinthPublicCheckbox?.checked;
  const isOpen=!!el.labyrinthOpenCheckbox?.checked;

  if(!title){
    alert("미궁 제목을 입력하세요.");
    el.labyrinthTitleInput?.focus();
    return;
  }

  const docId=slugifyId(title)+"-"+Date.now();
  await labyrinthRef(docId).set({
    title,
    description,
    thumbnailText,
    creator:state.currentUser,
    isPublic,
    isOpen,
    stageCount:0,
    createdAt:firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt:firebase.firestore.FieldValue.serverTimestamp()
  },{merge:true});

  closeCreateLabyrinthModal();
  openLabyrinth(docId);
}
window.submitCreateLabyrinth=submitCreateLabyrinth;

function openEditLabyrinthModal(labyrinthId){
  const labyrinth=state.labyrinths.find(v=>v.id===labyrinthId)||state.currentLabyrinth;
  if(!labyrinth||!isLabyrinthOwner(labyrinth)){
    alert("수정 권한이 없습니다.");
    return;
  }
  state.editingLabyrinthId=labyrinth.id;
  el.editLabyrinthTitleInput.value=labyrinth.title||"";
  el.editLabyrinthDescriptionInput.value=labyrinth.description||"";
  el.editLabyrinthThumbnailTextInput.value=labyrinth.thumbnailText||"";
  el.editLabyrinthPublicCheckbox.checked=!!labyrinth.isPublic;
  el.editLabyrinthOpenCheckbox.checked=labyrinth.isOpen!==false;
  el.editLabyrinthModal?.classList.remove("hidden");
  syncOverlay();
}
function closeEditLabyrinthModal(){
  state.editingLabyrinthId="";
  el.editLabyrinthModal?.classList.add("hidden");
  syncOverlay();
}
window.openEditLabyrinthModal=openEditLabyrinthModal;
window.closeEditLabyrinthModal=closeEditLabyrinthModal;

async function submitEditLabyrinth(){
  const id=state.editingLabyrinthId;
  const labyrinth=state.labyrinths.find(v=>v.id===id)||state.currentLabyrinth;
  if(!id||!labyrinth||!isLabyrinthOwner(labyrinth)){
    alert("수정 권한이 없습니다.");
    return;
  }

  const title=(el.editLabyrinthTitleInput?.value||"").trim();
  const description=(el.editLabyrinthDescriptionInput?.value||"").trim();
  const thumbnailText=(el.editLabyrinthThumbnailTextInput?.value||"").trim();
  const isPublic=!!el.editLabyrinthPublicCheckbox?.checked;
  const isOpen=!!el.editLabyrinthOpenCheckbox?.checked;

  if(!title){
    alert("미궁 제목을 입력하세요.");
    return;
  }

  await labyrinthRef(id).set({
    title,
    description,
    thumbnailText,
    isPublic,
    isOpen,
    updatedAt:firebase.firestore.FieldValue.serverTimestamp()
  },{merge:true});

  closeEditLabyrinthModal();
}
window.submitEditLabyrinth=submitEditLabyrinth;

/* ===== 단계 생성/수정 ===== */
function openCreateStageModal(labyrinthId){
  const labyrinth=state.labyrinths.find(v=>v.id===labyrinthId)||state.currentLabyrinth;
  if(!labyrinth||!isLabyrinthOwner(labyrinth)){
    alert("단계 추가 권한이 없습니다.");
    return;
  }
  state.editingLabyrinthId=labyrinth.id;
  state.editingStageId="";
  if(el.editStageModalTitle)el.editStageModalTitle.textContent="단계 추가";
  if(el.stageOrderInput)el.stageOrderInput.value=String(getActiveStages().length?Math.max(...getActiveStages().map(v=>Number(v.order||0)))+1:0);
  if(el.stageTitleInput)el.stageTitleInput.value="";
  if(el.stageTypeSelect)el.stageTypeSelect.value="question";
  if(el.stageStoryInput)el.stageStoryInput.value="";
  if(el.stageQuestionInput)el.stageQuestionInput.value="";
  if(el.stageAnswerInput)el.stageAnswerInput.value="";
  if(el.stagePlaceholderInput)el.stagePlaceholderInput.value="정답을 입력하세요.";
  if(el.stageSuccessMessageInput)el.stageSuccessMessageInput.value="";
  if(el.stageActiveCheckbox)el.stageActiveCheckbox.checked=true;
  if(el.deleteStageBtn)el.deleteStageBtn.classList.add("hidden");
  el.editStageModal?.classList.remove("hidden");
  syncOverlay();
}
function openEditStageModal(labyrinthId,stageId){
  const labyrinth=state.labyrinths.find(v=>v.id===labyrinthId)||state.currentLabyrinth;
  if(!labyrinth||!isLabyrinthOwner(labyrinth)){
    alert("단계 수정 권한이 없습니다.");
    return;
  }
  const stage=state.currentLabyrinthStages.find(v=>v.id===stageId);
  if(!stage){
    alert("단계를 찾을 수 없습니다.");
    return;
  }
  state.editingLabyrinthId=labyrinth.id;
  state.editingStageId=stage.id;
  if(el.editStageModalTitle)el.editStageModalTitle.textContent="단계 수정";
  if(el.stageOrderInput)el.stageOrderInput.value=String(stage.order||0);
  if(el.stageTitleInput)el.stageTitleInput.value=stage.title||"";
  if(el.stageTypeSelect)el.stageTypeSelect.value=stage.type||"question";
  if(el.stageStoryInput)el.stageStoryInput.value=stage.story||"";
  if(el.stageQuestionInput)el.stageQuestionInput.value=stage.question||"";
  if(el.stageAnswerInput)el.stageAnswerInput.value=stage.answer||"";
  if(el.stagePlaceholderInput)el.stagePlaceholderInput.value=stage.placeholder||"";
  if(el.stageSuccessMessageInput)el.stageSuccessMessageInput.value=stage.successMessage||"";
  if(el.stageActiveCheckbox)el.stageActiveCheckbox.checked=stage.isActive!==false;
  if(el.deleteStageBtn)el.deleteStageBtn.classList.remove("hidden");
  el.editStageModal?.classList.remove("hidden");
  syncOverlay();
}
function closeEditStageModal(){
  state.editingStageId="";
  el.editStageModal?.classList.add("hidden");
  syncOverlay();
}
window.openCreateStageModal=openCreateStageModal;
window.openEditStageModal=openEditStageModal;
window.closeEditStageModal=closeEditStageModal;

async function submitStage(){
  const labyrinth=state.currentLabyrinth;
  if(!labyrinth||!isLabyrinthOwner(labyrinth)){
    alert("저장 권한이 없습니다.");
    return;
  }

  const order=Number(el.stageOrderInput?.value||"");
  const title=(el.stageTitleInput?.value||"").trim();
  const type=el.stageTypeSelect?.value||"question";
  const story=(el.stageStoryInput?.value||"").trim();
  const question=(el.stageQuestionInput?.value||"").trim();
  const answer=(el.stageAnswerInput?.value||"").trim();
  const placeholder=(el.stagePlaceholderInput?.value||"").trim();
  const successMessage=(el.stageSuccessMessageInput?.value||"").trim();
  const isActive=!!el.stageActiveCheckbox?.checked;

  if(!Number.isInteger(order)||order<0){
    alert("순서는 0 이상의 숫자로 입력하세요.");
    return;
  }
  if(!title){
    alert("단계 제목을 입력하세요.");
    return;
  }
  if(type!=="entry"&&!answer){
    alert("정답을 입력하세요.");
    return;
  }

  const stageId=state.editingStageId||`stage-${Date.now()}`;
  await labyrinthStagesRef(labyrinth.id).doc(stageId).set({
    order,
    title,
    type,
    story,
    question,
    answer,
    placeholder,
    successMessage,
    isActive,
    updatedAt:firebase.firestore.FieldValue.serverTimestamp(),
    createdAt:state.editingStageId?(state.currentLabyrinthStages.find(v=>v.id===stageId)?.createdAt||firebase.firestore.FieldValue.serverTimestamp()):firebase.firestore.FieldValue.serverTimestamp()
  },{merge:true});

  closeEditStageModal();
}
window.submitStage=submitStage;

async function deleteStage(){
  const labyrinth=state.currentLabyrinth;
  if(!labyrinth||!isLabyrinthOwner(labyrinth)||!state.editingStageId){
    alert("삭제 권한이 없습니다.");
    return;
  }
  if(!confirm("이 단계를 삭제하시겠습니까?"))return;
  await labyrinthStagesRef(labyrinth.id).doc(state.editingStageId).delete();
  closeEditStageModal();
}
window.deleteStage=deleteStage;

/* =========================
   Existing Party / Rearrange
========================= */

function subscribeParties(){
  clearSubscriptions();

  if(state.currentEventId==="holy_sword"||state.currentEventId==="triple_alliance"){
    state.unsubscribeRanking=rearrangeRankingRef().onSnapshot(rankingSnap=>{
      const rankingMap={};
      rankingSnap.docs.forEach(doc=>{
        const d=doc.data()||{};
        rankingMap[doc.id]={
          user:d.user||doc.id,
          power:Number(d.power||0),
          note:String(d.note||""),
          existingColumn:Number(d.existingColumn||0),
          excluded:!!d.excluded
        };
      });
      state.rearrangeRankingMap=rankingMap;
      rebuildMergedRearrangeEntries();
      renderPartyList();
    },err=>{
      console.error(err);
      alert("기본 데이터를 불러오는 중 오류가 발생했습니다.");
    });

    state.unsubscribeMeta=rearrangeProgressRef().onSnapshot(progressSnap=>{
      state.rearrangeProgressEntries=progressSnap.docs.map(doc=>{
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
      renderPartyList();
    },err=>{
      console.error(err);
      alert("기본 데이터를 불러오는 중 오류가 발생했습니다.");
    });
  }

  state.unsubscribeParties=partiesRef(state.currentEventId).onSnapshot(snap=>{
    state.parties=snap.docs.map(doc=>{
      const d=doc.data()||{};
      return{
        id:doc.id,
        name:d.name||"",
        ruinName:d.ruinName||"",
        side:d.side||"",
        event:d.event||state.currentEventId,
        createdBy:d.createdBy||"",
        members:normalizeMembers(d.members),
        areaAssignments:normalizeAssignments(d.areaAssignments),
        rallyLeader:d.rallyLeader||"",
        timeUTC:d.timeUTC||null,
        maxMembers:Number(d.maxMembers||0),
        type:d.type||"",
        isFirstGroup:!!d.isFirstGroup,
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
      existingColumn:Number(ranking.existingColumn||0),
      excluded:!!ranking.excluded
    };
  });
  state.rearrangeEntries.sort(sortRearrangeEntries);
}

function subscribeRearrange(){
  clearSubscriptions();

  state.unsubscribeMeta=eventRef("rearrange").onSnapshot(doc=>{
    const d=doc.data()||{};
    state.rearrangePublic=!!d.rankingPublic;
    state.rearrangeInputEnabled=!!d.rearrangeInputEnabled;
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
        existingColumn:Number(d.existingColumn||0),
        excluded:!!d.excluded
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
  if(state.currentEventId==="holy_sword"||state.currentEventId==="triple_alliance"){
    if(!!a.isFirstGroup!==!!b.isFirstGroup){
      return a.isFirstGroup?-1:1;
    }
    if(a.side!==b.side){
      return a.side==="KOR"?-1:1;
    }
    return getTimeValue(a.timeUTC)-getTimeValue(b.timeUTC);
  }
  if(state.currentEventId==="ruins"){
    return getTimeValue(a.timeUTC)-getTimeValue(b.timeUTC);
  }
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

function formatKST(t){
  const d=toDate(t);
  if(!d)return"-";
  return`${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,"0")}:00`;
}
function formatUTC(t){
  const d=toDate(t);
  if(!d)return"-";
  return`${d.getUTCMonth()+1}/${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2,"0")}:00`;
}
function formatDateTime(t){
  const d=toDate(t);
  if(!d)return"-";
  return`${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function calcPower(memberCount){
  const base=Math.max(memberCount-1,1);
  return Math.floor((920000/base)/1000)*1000;
}
function myParty(){
  if(state.currentEventId!=="viking")return null;
  return state.parties.find(p=>p.members.includes(state.currentUser))||null;
}
function myRearrangeEntry(){return state.rearrangeEntries.find(v=>v.user===state.currentUser)||null;}
function getRearrangeColumn(rank){
  if(rank<=18)return 3;
  if(rank<=28)return 1;
  if(rank<=42)return 2;
  if(rank<=60)return 4;
  return 5;
}
function getLayoutLabel(rank){return `${getRearrangeColumn(rank)}열`;}

function getRearrangeRankMap(){
  const activeEntries=state.rearrangeEntries.filter(v=>!isHiddenTestNickname(v.user)&&!v.excluded);
  const displayedEntries=getDisplayedRearrangeEntries(activeEntries);
  const map={};
  let n=1;
  displayedEntries.forEach(entry=>{
    if(!entry)return;
    map[entry.user]=n;
    n++;
  });
  return map;
}

function getHolySwordSortedMembers(members){
  const rankMap=getRearrangeRankMap();
  return [...members].sort((a,b)=>{
    const ra=rankMap[a]||999999;
    const rb=rankMap[b]||999999;
    if(ra!==rb)return ra-rb;
    return String(a).localeCompare(String(b),"ko");
  });
}

function getHolySwordDisplayIndex(idx){
  if(idx<30)return`${idx+1}.`;
  return`예비${idx-29}.`;
}

function getHolySwordSideLabel(side){
  if(side==="KOR")return"본연맹(KOR)";
  if(side==="KR1")return"아카데미(KR1)";
  return side||"-";
}

function getTripleAllianceSideLabel(side){
  if(side==="KOR")return"본연맹(KOR)";
  if(side==="KR1")return"아카데미(KR1)";
  return side||"-";
}

function parseNoteRule(note){
  const text=String(note||"").trim();
  const explicitMatch=text.match(/([1-5])\s*열/);
  const explicitColumn=explicitMatch?Number(explicitMatch[1]):0;
  const hasR45=/R4|R5/i.test(text);
  return{explicitColumn,hasR45};
}

function getDisplayedRearrangeEntries(entries){
  const capacities={1:10,2:14,3:18,4:18,5:Number.MAX_SAFE_INTEGER};
  const primaryColumnOrder=[3,1,2,4];

  const sorted=[...entries];
  const explicitByColumn={1:[],2:[],3:[],4:[],5:[]};
  const reservedTo2=[];
  const normal=[];

  sorted.forEach((entry,idx)=>{
    const rule=parseNoteRule(entry.note);
    const baseColumn=getRearrangeColumn(idx+1);
    const enriched={...entry,__baseColumn:baseColumn};

    if(rule.explicitColumn>=1&&rule.explicitColumn<=5){
      explicitByColumn[rule.explicitColumn].push(enriched);
      return;
    }
    if(rule.hasR45&&baseColumn>=4){
      reservedTo2.push(enriched);
      return;
    }
    normal.push(enriched);
  });

  const usedUsers=new Set();

  function takeFrom(list){
    while(list.length){
      const entry=list.shift();
      if(entry&&!usedUsers.has(entry.user)){
        usedUsers.add(entry.user);
        return entry;
      }
    }
    return null;
  }

  const columnPools={
    1:[...explicitByColumn[1]],
    2:[...explicitByColumn[2],...reservedTo2],
    3:[...explicitByColumn[3]],
    4:[...explicitByColumn[4]]
  };

  const slots=[];

  for(const col of primaryColumnOrder){
    const limit=capacities[col];
    for(let i=0;i<limit;i++){
      const forced=takeFrom(columnPools[col]);
      if(forced)slots.push(forced);
      else slots.push("__EMPTY__");
    }
  }

  for(const entry of normal){
    let placed=false;

    for(let i=0;i<slots.length;i++){
      if(slots[i]!=="__EMPTY__")continue;

      const targetColumn=getRearrangeColumn(i+1);
      const rule=parseNoteRule(entry.note);

      if(rule.explicitColumn&&rule.explicitColumn!==targetColumn)continue;
      if(rule.hasR45&&(entry.__baseColumn>=4)&&targetColumn<2)continue;

      slots[i]=entry;
      usedUsers.add(entry.user);
      placed=true;
      break;
    }

    if(!placed){
      slots.push(entry);
      usedUsers.add(entry.user);
    }
  }

  const remain5=[];
  while(explicitByColumn[5].length){
    const e=takeFrom(explicitByColumn[5]);
    if(e)remain5.push(e);
  }
  slots.push(...remain5);

  return slots.map(v=>{
    if(v==="__EMPTY__")return null;
    if(v&&typeof v==="object"&&"__baseColumn" in v){
      const {__baseColumn,...rest}=v;
      return rest;
    }
    return v;
  });
}

function getMoveDisplay(existingColumn,currentColumn){
  if(!existingColumn||!currentColumn)return{text:"-",className:"move-neutral"};
  if(existingColumn===currentColumn)return{text:"완료",className:"move-done"};
  if(existingColumn<currentColumn)return{text:`${existingColumn}→${currentColumn}`,className:"move-up"};
  return{text:`${existingColumn}→${currentColumn}`,className:"move-down"};
}

function getHolySwordBadgeSrc(area){
  if(area==="마구간") return "말.png";
  if(area==="시계탑") return "모래시계.png";
  if(area==="수도원 1") return "마름모 1.png";
  if(area==="수도원 2") return "마름모 2.png";
  if(area==="수도원 3") return "마름모 3.png";
  if(area==="수도원 4") return "마름모 4.png";
  if(area==="성소 1") return "원 1.png";
  if(area==="성소 2") return "원 2.png";
  return "";
}

function renderHolySwordBadge(area,size="small"){
  const src=getHolySwordBadgeSrc(area);
  if(!src) return "";
  const cls=size==="large" ? "holy-area-badge-img large" : "holy-area-badge-img";
  return `<img src="${src}" alt="${escapeHtml(area)}" class="${cls}">`;
}

function renderHolySwordBadges(areas){
  if(!areas||!areas.length) return "";
  return `<span class="area-badges">${areas.map(area=>renderHolySwordBadge(area,"small")).join("")}</span>`;
}

function getHolySwordAreaAssignmentsByUser(assignments){
  const map={};
  normalizeAssignments(assignments).forEach(item=>{
    if(!map[item.user])map[item.user]=[];
    map[item.user].push(item.area);
  });
  return map;
}

function renderHolySwordAreaBoard(assignments){
  const byArea={};
  HOLY_SWORD_AREAS.forEach(area=>byArea[area]=[]);
  normalizeAssignments(assignments).forEach(item=>{
    if(!byArea[item.area])byArea[item.area]=[];
    byArea[item.area].push(item.user);
  });

  const slotMap={
    "1-2":"시계탑",
    "1-3":"수도원 1",
    "2-1":"성소 2",
    "2-4":"수도원 2",
    "3-1":"수도원 4",
    "3-4":"성소 1",
    "4-2":"수도원 3",
    "4-3":"마구간"
  };

  let html=`<div class="holy-area-board">`;

  for(let row=1; row<=4; row++){
    for(let col=1; col<=4; col++){
      const key=`${row}-${col}`;
      const area=slotMap[key];

      if(!area){
        html+=`<div class="holy-area-empty"></div>`;
        continue;
      }

      const users=byArea[area]||[];
      html+=`
        <div class="holy-area-slot">
          <div class="holy-area-slot-badge">${renderHolySwordBadge(area,"large")}</div>
          <div class="holy-area-slot-users">${users.length?users.map(escapeHtml).join("<br>"):"-"}</div>
        </div>
      `;
    }
  }

  html+=`</div>`;
  return html;
}

function renderPartyList(){
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

function renderVikingCard(p){
  const meJoined=p.members.includes(state.currentUser);
  const canDelete=state.isAdmin||p.createdBy===state.currentUser;
  const canKick=state.isAdmin||p.createdBy===state.currentUser;
  const maxMembers=Number(p.maxMembers||0);
  const isFull=maxMembers>0&&p.members.length>=maxMembers;
  const membersHtml=p.members.map(name=>`<div class="member-line"><span class="${name===state.currentUser?"my-name":""}">${name===p.createdBy?"👑 ":""}${escapeHtml(name)}</span>${canKick&&name!==p.createdBy?`<button class="inline-btn" onclick="kickMember('${escapeJs(p.id)}','${escapeJs(name)}')">✖</button>`:""}</div>`).join("");
  return `<div class="party-card"><div class="party-title">${escapeHtml(p.name)}</div><div class="party-sub">파티장: ${escapeHtml(p.createdBy||"-")}</div><div class="party-sub">인원: ${p.members.length}${maxMembers>0?`/${maxMembers}`:""}명</div><div class="member-list">${membersHtml||'<div class="member-line"><span>참가자가 없습니다.</span></div>'}</div><div class="card-actions">${!meJoined&&!isFull?`<button onclick="joinParty('${escapeJs(p.id)}')">참가</button>`:""}${meJoined?`<button onclick="leaveParty('${escapeJs(p.id)}')">취소</button>`:""}${canDelete?`<button onclick="deleteParty('${escapeJs(p.id)}')">삭제</button>`:""}</div></div>`;
}

function renderRuinsCard(p){
  const members=[...p.members].sort((a,b)=>a===p.rallyLeader?-1:b===p.rallyLeader?1:a.localeCompare(b,"ko"));
  const meJoined=members.includes(state.currentUser);
  const power=calcPower(members.length).toLocaleString("ko-KR");
  const membersHtml=members.map(name=>`<div class="member-line"><span class="${name===state.currentUser?"my-name":""}">${name===p.rallyLeader?"👑 ":""}${escapeHtml(name)}</span>${state.isAdmin&&name!==p.rallyLeader?`<button class="inline-btn" onclick="setRallyLeader('${escapeJs(p.id)}','${escapeJs(name)}')">👍</button>`:""}${state.isAdmin?`<button class="inline-btn" onclick="kickMember('${escapeJs(p.id)}','${escapeJs(name)}')">✖</button>`:""}</div>`).join("");
  return `<div class="party-card"><div class="party-title">유적명: ${escapeHtml(p.ruinName||p.name)}</div><div class="party-sub">시간: ${formatKST(p.timeUTC)}</div><div class="party-sub">UTC ${formatUTC(p.timeUTC)}</div><div class="party-sub">병력수: ${power}명</div><div class="party-sub">인원: ${members.length}/15</div><div class="member-list compact">${membersHtml||'<div class="member-line"><span>참가자가 없습니다.</span></div>'}</div><div class="card-actions">${!meJoined&&members.length<15?`<button onclick="joinParty('${escapeJs(p.id)}')">참가</button>`:""}${meJoined?`<button onclick="leaveParty('${escapeJs(p.id)}')">취소</button>`:""}${state.isAdmin?`<button onclick="openRuinsEditModal('${escapeJs(p.id)}')">수정</button><button onclick="deleteParty('${escapeJs(p.id)}')">삭제</button>`:""}<button onclick="copyRuinsNotice('${escapeJs(p.id)}')">복사</button></div></div>`;
}

function renderHolySwordCard(p){
  const members=getHolySwordSortedMembers(p.members);
  const meJoined=members.includes(state.currentUser);
  const canManage=state.isAdmin;
  const byUser=getHolySwordAreaAssignmentsByUser(p.areaAssignments);
  const firstGroupMark=p.isFirstGroup?`<div class="party-sub">분류: 1군</div>`:"";

  const membersHtml=members.map((name,idx)=>{
    const badges=renderHolySwordBadges(byUser[name]||[]);
    return `<div class="member-line"><span class="${name===state.currentUser?"my-name":""}"><span class="holy-member-rank">${escapeHtml(getHolySwordDisplayIndex(idx))}</span> ${escapeHtml(name)}${badges}</span></div>`;
  }).join("");

  return `<div class="party-card">
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
  </div>`;
}

function renderTripleAllianceCard(p){
  const members=getHolySwordSortedMembers(p.members);
  const meJoined=members.includes(state.currentUser);
  const firstGroupMark=p.isFirstGroup?`<div class="party-sub">분류: 1군</div>`:"";
  const membersHtml=members.map(name=>`<div class="member-line"><span class="${name===state.currentUser?"my-name":""}">${escapeHtml(name)}</span>${state.isAdmin?`<button class="inline-btn" onclick="kickMember('${escapeJs(p.id)}','${escapeJs(name)}')">✖</button>`:""}</div>`).join("");

  return `<div class="party-card">
    <div class="party-title triple-alliance-title">${escapeHtml(p.name)}</div>
    ${firstGroupMark}
    <div class="party-sub">소속: <span class="holy-side-badge">${escapeHtml(getTripleAllianceSideLabel(p.side))}</span></div>
    <div class="party-sub">시간: ${formatKST(p.timeUTC)}</div>
    <div class="party-sub">UTC ${formatUTC(p.timeUTC)}</div>
    <div class="party-sub">인원: ${members.length}명</div>
    <div class="member-list">${membersHtml||'<div class="member-line"><span>참가자가 없습니다.</span></div>'}</div>
    <div class="card-actions">
      ${!meJoined?`<button onclick="joinParty('${escapeJs(p.id)}')">참가</button>`:""}
      ${meJoined?`<button onclick="leaveParty('${escapeJs(p.id)}')">취소</button>`:""}
      ${state.isAdmin?`<button onclick="openRuinsEditModal('${escapeJs(p.id)}')">수정</button>`:""}
      ${state.isAdmin?`<button onclick="deleteParty('${escapeJs(p.id)}')">삭제</button>`:""}
    </div>
  </div>`;
}

function renderExcludedRearrangeList(entries){
  if(!state.isAdmin||!entries.length)return "";
  const items=entries.map(entry=>`<div class="member-line"><span>${escapeHtml(entry.user)}</span><button class="rank-edit-btn" onclick="openRearrangeRankEditModal('${escapeJs(entry.user)}')">관리</button></div>`).join("");
  return `<div class="party-card"><div class="party-title">제외 인원</div><div class="party-sub">복구하려면 관리 버튼에서 제외 해제를 하세요.</div><div class="member-list">${items}</div></div>`;
}

function renderRearrangeTable(entries){
  if(!entries.length)return `<div class="rank-empty">입력된 데이터가 없습니다.</div>`;

  const rows=entries.map((entry,idx)=>{
    const rank=idx+1;
    const currentColumn=getRearrangeColumn(rank);
    const rowClass=entry&&entry.user===state.currentUser?"rank-row-me":"";

    if(!entry){
      return `<tr class="${rowClass}"><td>${rank}</td><td>${getLayoutLabel(rank)}</td><td class="left muted">공란</td><td>-</td><td>-</td><td class="left">-</td><td>-</td><td>-</td></tr>`;
    }

    const powerText=entry.power>0?Number(entry.power).toLocaleString("ko-KR"):"-";
    const noteText=entry.note?escapeHtml(entry.note):"-";
    const existingText=entry.existingColumn>0?String(entry.existingColumn):"-";
    const move=getMoveDisplay(entry.existingColumn,currentColumn);

    return `<tr class="${rowClass}">
      <td>${rank}</td>
      <td>${getLayoutLabel(rank)}</td>
      <td class="left ${entry.user===state.currentUser?"my-name":""}">${escapeHtml(entry.user)}</td>
      <td>${escapeHtml(entry.stageText||"-")}</td>
      <td>${powerText}</td>
      <td class="left">${noteText}</td>
      <td>${existingText}</td>
      <td><span class="${move.className}">${escapeHtml(move.text)}</span>${state.isAdmin?` <button class="rank-edit-btn" onclick="openRearrangeRankEditModal('${escapeJs(entry.user)}')">관리</button>`:""}</td>
    </tr>`;
  }).join("");

  return `<div class="rank-table-wrap"><table class="rank-table"><colgroup><col><col><col><col><col><col><col><col></colgroup><thead><tr><th>순위</th><th>순열</th><th>닉네임</th><th>스테이지</th><th>전투력</th><th>비고</th><th>기존</th><th>이동</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderRearrangeGuide(){
  return `<div class="layout-guide-wrap"><img src="자리 순열.png" alt="자리 순열 안내도" class="layout-guide-image" /></div>`;
}

function renderRearrangeEvent(){
  const mine=myRearrangeEntry();
  const activeEntries=state.rearrangeEntries.filter(v=>!isHiddenTestNickname(v.user)&&!v.excluded);
  const excludedEntries=state.rearrangeEntries.filter(v=>!isHiddenTestNickname(v.user)&&v.excluded);
  const displayedEntries=getDisplayedRearrangeEntries(activeEntries);

  const mineCard=state.rearrangeInputEnabled
  ? `<div class="party-card"><div class="party-title">내 진척도</div><div class="party-sub">빛나는 첨탑 최고 스테이지</div><div class="party-sub">현재 입력값: ${mine?escapeHtml(mine.stageText):"미입력"}</div><div class="party-sub">최종 수정: ${mine?formatDateTime(mine.updatedAt):"-"}</div><div class="card-actions"><button onclick="openMyRearrangeModal()">${mine?"수정":"입력"}</button></div></div>`
  : `<div class="party-card"><div class="party-title">내 진척도</div><div class="party-sub">빛나는 첨탑 최고 스테이지</div><div class="party-sub">현재 입력값: ${mine?escapeHtml(mine.stageText):"미입력"}</div><div class="party-sub">최종 수정: ${mine?formatDateTime(mine.updatedAt):"-"}</div><div class="party-sub">현재 개인 입력은 일시 중지되어 있습니다.</div><div class="card-actions"><button disabled>입력 일시중지</button></div></div>`;

  let rankingCard="";
  let guideCard="";

  if(state.isAdmin||state.rearrangePublic){
    rankingCard=`<div class="party-card rank-table-card"><div class="party-title">진척도 순위표</div><div class="party-sub">${state.isAdmin?state.rearrangePublic?"현재 전체 공개 상태입니다.":"현재 운영진만 볼 수 있습니다.":"공개된 순위입니다."}</div><div class="card-actions"><button onclick="copyRearrangeColumns()">복사</button></div>${renderRearrangeTable(displayedEntries)}</div>`;
    guideCard=`<div class="party-card layout-guide-card"><div class="party-title">순열 안내 예시</div><div class="party-sub">빨(1), 주(2), 노(3), 초(4), 파(5)</div><div class="card-actions"><button onclick="openExampleImageModal('guide')">예시 크게 보기</button></div>${renderRearrangeGuide()}</div>`;
  }else{
    rankingCard=`<div class="party-card"><div class="party-title">진척도 순위</div><div class="party-sub">아직 공개되지 않았습니다.</div><div class="party-sub">운영진 공개 후 전체 유저가 확인할 수 있습니다.</div></div>`;
  }

  const excludedCard=renderExcludedRearrangeList(excludedEntries);
  el.partyList.innerHTML=mineCard+rankingCard+excludedCard+guideCard;
}

async function createParty(){
  if(state.currentEventId==="viking")return createVikingParty();
  if(state.currentEventId==="ruins")return openRuinsCreateModal();
  if(state.currentEventId==="holy_sword")return openHolySwordCreateModal();
  if(state.currentEventId==="triple_alliance")return openTripleAllianceCreateModal();
}
window.createParty=createParty;

async function createVikingParty(){
  const name=(prompt("파티 이름을 입력하세요.")||"").trim();
  if(!name)return;
  if(myParty()){
    alert("이미 다른 파티에 참여 중입니다.");
    return;
  }
  const maxInput=(prompt("최대 인원을 입력하세요.\n예: 6")||"").trim();
  const maxMembers=Number(maxInput);
  if(!Number.isInteger(maxMembers)||maxMembers<1){
    alert("최대 인원은 1 이상의 숫자로 입력하세요.");
    return;
  }
  const dup=await partiesRef("viking").where("name","==",name).get();
  if(!dup.empty){
    alert("같은 이름의 파티가 이미 있습니다.");
    return;
  }
  await partiesRef("viking").add({
    type:"viking",
    event:"viking",
    name,
    createdBy:state.currentUser,
    members:[state.currentUser],
    maxMembers,
    createdAt:firebase.firestore.FieldValue.serverTimestamp()
  });
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

function openTripleAllianceCreateModal(){
  if(!state.isAdmin){
    alert("삼대 연맹전 파티는 운영진만 생성할 수 있습니다.");
    return;
  }
  state.editingRuinsPartyId="";
  el.ruinsModalTitle.textContent="삼대 연맹전 생성";
  el.ruinsSubmitBtn.textContent="생성";
  if(el.ruinNameInput)el.ruinNameInput.value="";
  document.getElementById("ruinNameWrap")?.classList.add("hidden");
  document.getElementById("holySwordSideWrap")?.classList.remove("hidden");
  document.getElementById("firstGroupWrap")?.classList.remove("hidden");
  if(el.firstGroupCheckbox)el.firstGroupCheckbox.checked=false;
  const sideSelect=document.getElementById("holySwordSideSelect");
  if(sideSelect)sideSelect.value=state.tripleAllianceSelectedSide||"KOR";
  el.utcMonth.value="1";
  el.utcDay.value="1";
  el.utcHour.value="0";
  el.ruinsCreateModal.classList.remove("hidden");
  syncOverlay();
}

async function openRuinsEditModal(partyId){
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
}
window.openRuinsEditModal=openRuinsEditModal;

function closeRuinsCreateModal(){
  state.editingRuinsPartyId="";
  document.getElementById("ruinNameWrap")?.classList.remove("hidden");
  document.getElementById("holySwordSideWrap")?.classList.add("hidden");
  resetPartyFormCommon();
  el.ruinsCreateModal.classList.add("hidden");
  syncOverlay();
}
window.closeRuinsCreateModal=closeRuinsCreateModal;

async function submitRuinsParty(){
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

  if(state.currentEventId==="holy_sword"){
    const side=document.getElementById("holySwordSideSelect")?.value||"KOR";
    state.holySwordSelectedSide=side;
    localStorage.setItem("holySwordSelectedSide",side);

    const sideText=side==="KOR"?"본연맹":"아카데미";
    const sideCode=side==="KOR"?"KOR":"KR1";
    const kstHour=(h+9)%24;
    const autoName=`[${sideText}(${sideCode})] ${kstHour}시(UTC ${String(h).padStart(2,"0")}:00)`;

    if(state.editingRuinsPartyId){
      await partiesRef("holy_sword").doc(state.editingRuinsPartyId).update({
        name:autoName,
        side,
        timeUTC:utcDate,
        isFirstGroup
      });
      await writeAdminLog("update_holy_sword_party",{partyId:state.editingRuinsPartyId,name:autoName,month:m,day:d,hour:h,side,isFirstGroup});
    }else{
      await partiesRef("holy_sword").add({
        type:"holy_sword",
        event:"holy_sword",
        name:autoName,
        side,
        createdBy:state.currentUser,
        members:[],
        areaAssignments:[],
        timeUTC:utcDate,
        isFirstGroup,
        createdAt:firebase.firestore.FieldValue.serverTimestamp()
      });
      await writeAdminLog("create_holy_sword_party",{name:autoName,month:m,day:d,hour:h,side,isFirstGroup});
    }
    closeRuinsCreateModal();
    return;
  }

  if(state.currentEventId==="triple_alliance"){
    const side=document.getElementById("holySwordSideSelect")?.value||"KOR";
    state.tripleAllianceSelectedSide=side;
    localStorage.setItem("tripleAllianceSelectedSide",side);

    const sideText=side==="KOR"?"본연맹":"아카데미";
    const sideCode=side==="KOR"?"KOR":"KR1";
    const kstHour=(h+9)%24;
    const autoName=`[${sideText}(${sideCode})] ${kstHour}시(UTC ${String(h).padStart(2,"0")}:00)`;

    if(state.editingRuinsPartyId){
      await partiesRef("triple_alliance").doc(state.editingRuinsPartyId).update({
        name:autoName,
        side,
        timeUTC:utcDate,
        isFirstGroup
      });
      await writeAdminLog("update_triple_alliance_party",{partyId:state.editingRuinsPartyId,name:autoName,month:m,day:d,hour:h,side,isFirstGroup});
    }else{
      await partiesRef("triple_alliance").add({
        type:"triple_alliance",
        event:"triple_alliance",
        name:autoName,
        side,
        createdBy:state.currentUser,
        members:[],
        timeUTC:utcDate,
        isFirstGroup,
        createdAt:firebase.firestore.FieldValue.serverTimestamp()
      });
      await writeAdminLog("create_triple_alliance_party",{name:autoName,month:m,day:d,hour:h,side,isFirstGroup});
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
    await partiesRef("ruins").doc(state.editingRuinsPartyId).update({
      name:ruinName,
      ruinName,
      timeUTC:utcDate
    });
    await writeAdminLog("update_ruins_party",{partyId:state.editingRuinsPartyId,ruinName,month:m,day:d,hour:h});
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
    await writeAdminLog("create_ruins_party",{ruinName,month:m,day:d,hour:h});
  }
  closeRuinsCreateModal();
}
window.submitRuinsParty=submitRuinsParty;

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

function openMyRearrangeModal(){
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
}
function closeRearrangeModal(){
  el.rearrangeStageInput?.blur();
  el.rearrangeStageInput?.removeAttribute("readonly");
  el.rearrangeModal?.classList.add("hidden");
  syncOverlay();
}
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
function closeExampleImageModal(){
  el.exampleImageModal?.classList.add("hidden");
  syncOverlay();
}
window.openMyRearrangeModal=openMyRearrangeModal;
window.closeRearrangeModal=closeRearrangeModal;
window.openExampleImageModal=openExampleImageModal;
window.closeExampleImageModal=closeExampleImageModal;

function openHolySwordAreaModal(partyId){
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
}
function closeHolySwordAreaModal(){
  state.editingHolySwordPartyId="";
  el.holySwordAreaModal?.classList.add("hidden");
  syncOverlay();
}
window.openHolySwordAreaModal=openHolySwordAreaModal;
window.closeHolySwordAreaModal=closeHolySwordAreaModal;

function renderHolySwordAreaAssignmentList(party){
  const assignments=normalizeAssignments(party.areaAssignments);
  el.holySwordAreaAssignmentList.innerHTML=assignments.length
    ? assignments.map((item,idx)=>`<div class="holy-sword-assign-item"><span>${escapeHtml(item.user)} - ${escapeHtml(item.area)}</span><button type="button" class="rank-edit-btn" onclick="removeHolySwordAreaAssignment(${idx})">삭제</button></div>`).join("")
    : `<div class="muted">지정된 구역장이 없습니다.</div>`;
}

async function addHolySwordAreaAssignment(){
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
  await writeAdminLog("add_holy_sword_area_assignment",{partyId:party.id,user,area});
}
window.addHolySwordAreaAssignment=addHolySwordAreaAssignment;

async function removeHolySwordAreaAssignment(index){
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
  const removed=areaAssignments[index];
  areaAssignments.splice(index,1);
  await partiesRef("holy_sword").doc(party.id).update({areaAssignments});
  await writeAdminLog("remove_holy_sword_area_assignment",{partyId:party.id,user:removed.user,area:removed.area});
}
window.removeHolySwordAreaAssignment=removeHolySwordAreaAssignment;

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
  if(!parsed){
    alert("최고 스테이지는 15-4 형식으로 입력하세요.");
    return;
  }
  await rearrangeProgressRef().doc(state.currentUser).set({
    user:state.currentUser,
    stageText:raw,
    stageMajor:parsed.stageMajor,
    stageMinor:parsed.stageMinor,
    updatedAt:
