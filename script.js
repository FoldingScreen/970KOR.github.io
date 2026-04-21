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
  unsubscribeLabyrinthStages:null,
  unsubscribeLabyrinthPlayer:null,
  unsubscribeLabyrinthPlayers:null,

  labyrinths:[],
  labyrinthPlayerSummaryMap:{},
  currentLabyrinthId:"",
  currentLabyrinthData:null,
  currentLabyrinthStages:[],
  currentLabyrinthPlayer:null,
  currentLabyrinthPlayers:[],
  editingLabyrinthId:"",
  editingStageId:"",

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

  events:[
    {id:"viking",name:"바이킹의 역습",desc:"'전하 퇴청하시옵소서'를 영어로? 바이킹~ 엌ㅋㅋ"},
    {id:"ruins",name:"유적 쟁탈",desc:"가장 강력한 유적은? 무적 엌ㅋㅋㅋ"},
    {id:"holy_sword",name:"성검 쟁탈",desc:"검이 정색하면? 검정색 엌ㅋㅋㅋ"},
    {id:"triple_alliance",name:"삼대 연맹전",desc:"아빠는 5대, 아들은 2대 맞는 이유는? 세대차이 엌ㅋㅋ"},
    {id:"rearrange",name:"자리 재배치",desc:"자동차에서 가장 시원한 자리는? 차가운데 엌ㅋㅋ"},
    {id:"escape_labyrinth",name:"사바나의 첨탑",desc:"바나나가 사악하면? 사바나. ㅇㅇ."}
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
  deleteStageBtn:document.getElementById("deleteStageBtn"),

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
  firstGroupCheckbox:document.getElementById("firstGroupCheckbox")
};

function escapeHtml(s){return String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");}
function escapeJs(s){return String(s??"").replace(/\\/g,"\\\\").replace(/'/g,"\\'");}
function normalizeMembers(m){return Array.isArray(m)?m.filter(v=>typeof v==="string"&&v.trim()!==""):[];}
function normalizeAssignments(v){return Array.isArray(v)?v.filter(x=>x&&typeof x.user==="string"&&typeof x.area==="string"):[];}
function isHiddenTestNickname(name){const lowered=String(name||"").trim().toLowerCase();return TEST_HIDDEN_PREFIXES.some(prefix=>lowered.startsWith(String(prefix).toLowerCase()));}
function normalizeLabyrinthText(s){return String(s||"").replace(/\r\n/g,"\n").trim();}
function normalizeAnswerValue(s){return String(s||"").trim().toLowerCase().replace(/\s+/g," ");}
function isLabyrinthOwner(labyrinth){return !!labyrinth&&labyrinth.creator===state.currentUser;}

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
function labyrinthsRef(){return eventRef("escape_labyrinth").collection("labyrinths");}
function labyrinthRef(id){return labyrinthsRef().doc(id);}
function labyrinthStagesRef(id){return labyrinthRef(id).collection("stages");}
function labyrinthPlayersRef(id){return labyrinthRef(id).collection("players");}
function labyrinthPlayerRef(id,name){return labyrinthPlayersRef(id).doc(name);}

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

function clearSubscriptions(){
  if(state.unsubscribeParties){state.unsubscribeParties();state.unsubscribeParties=null;}
  if(state.unsubscribeMeta){state.unsubscribeMeta();state.unsubscribeMeta=null;}
  if(state.unsubscribeRanking){state.unsubscribeRanking();state.unsubscribeRanking=null;}
  if(state.unsubscribeLabyrinths){state.unsubscribeLabyrinths();state.unsubscribeLabyrinths=null;}
  if(state.unsubscribeLabyrinthStages){state.unsubscribeLabyrinthStages();state.unsubscribeLabyrinthStages=null;}
  if(state.unsubscribeLabyrinthPlayer){state.unsubscribeLabyrinthPlayer();state.unsubscribeLabyrinthPlayer=null;}
  if(state.unsubscribeLabyrinthPlayers){state.unsubscribeLabyrinthPlayers();state.unsubscribeLabyrinthPlayers=null;}
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
  state.currentLabyrinthData=null;
  state.currentLabyrinthStages=[];
  state.currentLabyrinthPlayer=null;
  state.editingLabyrinthId="";
  state.editingStageId="";
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
    if(savedEvent)openEvent(savedEvent);
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
  state.currentLabyrinthData=null;
  state.currentLabyrinthStages=[];
  state.currentLabyrinthPlayer=null;
  localStorage.removeItem("partyAppEvent");
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
    if(state.currentLabyrinthId){
      el.backToLabyrinthListBtn.classList.remove("hidden");
      el.backToLabyrinthListBtn.textContent="목록으로";
      el.backToLabyrinthListBtn.onclick=openEscapeLabyrinthHome;
    }else{
      el.createLabyrinthBtn.classList.remove("hidden");
      el.createLabyrinthBtn.textContent="미궁 제작하기";
      el.createLabyrinthBtn.onclick=openCreateLabyrinthModal;
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
    subscribeEscapeLabyrinthHome();
    return;
  }

  if(el.partyList)el.partyList.classList.remove("hidden");
  if(el.escapeLabyrinthScreen)el.escapeLabyrinthScreen.classList.add("hidden");

  if(id==="rearrange")subscribeRearrange();
  else subscribeParties();
}
window.openEvent=openEvent;

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

/* ===== 미궁 시스템 ===== */
function hideEscapeLabyrinthViews(){
  el.escapeLabyrinthScreen?.classList.add("hidden");
  el.labyrinthHomeView?.classList.add("hidden");
  el.labyrinthDetailView?.classList.add("hidden");
}
function showEscapeLabyrinthRoot(){
  el.partyList?.classList.add("hidden");
  el.escapeLabyrinthScreen?.classList.remove("hidden");
}
function subscribeEscapeLabyrinthHome(){
  clearSubscriptions();
  state.currentLabyrinthId="";
  state.currentLabyrinthData=null;
  state.currentLabyrinthStages=[];
  state.currentLabyrinthPlayer=null;
  state.currentLabyrinthPlayers=[];
  state.labyrinthPlayerSummaryMap={};
  showEscapeLabyrinthRoot();
  openEscapeLabyrinthHome(true);

  state.unsubscribeLabyrinths=labyrinthsRef().onSnapshot(async snap=>{
    state.labyrinths=snap.docs.map(doc=>{
      const d=doc.data()||{};
      return{
        id:doc.id,
        title:d.title||"",
        description:d.description||"",
        creator:d.creator||"",
        isPublic:!!d.isPublic,
        isOpen:d.isOpen!==false,
        thumbnailText:d.thumbnailText||"",
        createdAt:d.createdAt||null,
        updatedAt:d.updatedAt||null
      };
    }).sort((a,b)=>getTimeValue(b.updatedAt||b.createdAt)-getTimeValue(a.updatedAt||a.createdAt));

    const summaryMap={};

    await Promise.all(
      state.labyrinths.map(async lab=>{
        try{
          const [playersSnap, stagesSnap]=await Promise.all([
            labyrinthPlayersRef(lab.id).get(),
            labyrinthStagesRef(lab.id).get()
          ]);

          const activeStages=stagesSnap.docs
            .map(doc=>({id:doc.id,...(doc.data()||{})}))
            .filter(stage=>stage.isActive!==false)
            .map(stage=>({
              order:Number(stage.order||0),
              type:stage.type||"question"
            }))
            .sort((a,b)=>a.order-b.order);

          const finalStage=
            activeStages.find(v=>v.type==="final") ||
            [...activeStages].sort((a,b)=>b.order-a.order)[0] ||
            null;

          let isCleared=false;
          let isPlaying=false;

          playersSnap.forEach(doc=>{
            const d=doc.data()||{};
            const nickname=d.nickname||doc.id;

            if(nickname===state.currentUser){
              if(finalStage && d.stageClearedAtMap?.[String(finalStage.order)]){
                isCleared=true;
              }else if(Number(d.currentStageOrder||0)>=0){
                isPlaying=true;
              }
            }
          });

          summaryMap[lab.id]={
            isCleared,
            isPlaying:!isCleared && isPlaying
          };
        }catch(err){
          console.error(err);
          summaryMap[lab.id]={
            isCleared:false,
            isPlaying:false
          };
        }
      })
    );

    state.labyrinthPlayerSummaryMap=summaryMap;

    if(state.currentLabyrinthId){
      const found=state.labyrinths.find(v=>v.id===state.currentLabyrinthId)||null;
      state.currentLabyrinthData=found;
      if(!found){
        alert("해당 미궁을 찾을 수 없습니다.");
        openEscapeLabyrinthHome();
        return;
      }
    }

    if(state.currentLabyrinthId)renderLabyrinthDetail();
    else renderLabyrinthHome();
  },err=>{
    console.error(err);
    alert("미궁 목록을 불러오는 중 오류가 발생했습니다.");
  });
}

function openEscapeLabyrinthHome(skipResubscribe=false){
  state.currentLabyrinthId="";
  state.currentLabyrinthData=null;
  state.currentLabyrinthStages=[];
  state.currentLabyrinthPlayer=null;
  if(state.unsubscribeLabyrinthStages){state.unsubscribeLabyrinthStages();state.unsubscribeLabyrinthStages=null;}
  if(state.unsubscribeLabyrinthPlayer){state.unsubscribeLabyrinthPlayer();state.unsubscribeLabyrinthPlayer=null;}
  showEscapeLabyrinthRoot();
  el.labyrinthHomeView?.classList.remove("hidden");
  el.labyrinthDetailView?.classList.add("hidden");
  updateEventActionButtons();
  if(!skipResubscribe)renderLabyrinthHome();
}
window.openEscapeLabyrinthHome=openEscapeLabyrinthHome;

function renderLabyrinthHome(){
  if(!el.publicLabyrinthList||!el.myLabyrinthList)return;

  const publicItems=state.labyrinths.filter(v=>v.isPublic&&v.isOpen);
  const myItems=state.labyrinths.filter(v=>v.creator===state.currentUser);

  el.publicLabyrinthList.innerHTML=publicItems.length
    ? publicItems.map(renderLabyrinthCard).join("")
    : `<div class="labyrinth-empty">공개된 미궁이 없습니다.</div>`;

  el.myLabyrinthList.innerHTML=myItems.length
    ? myItems.map(renderLabyrinthCard).join("")
    : `<div class="labyrinth-empty">아직 만든 미궁이 없습니다.<br>상단의 "미궁 제작하기" 버튼으로 시작하세요.</div>`;
}

function renderLabyrinthCard(item){
  const mine=item.creator===state.currentUser;
  const statusClass=item.isPublic?(item.isOpen?"public":"closed"):"private";
  const statusText=item.isPublic?(item.isOpen?"공개":"공개중지"):"비공개";
  const desc=item.thumbnailText||item.description||"미궁 설명이 없습니다.";

  const progress=state.labyrinthPlayerSummaryMap?.[item.id]||{isCleared:false,isPlaying:false};
  const progressBadge=progress.isCleared
    ? `<span class="labyrinth-status-badge public">완료</span>`
    : progress.isPlaying
      ? `<span class="labyrinth-status-badge private">플레이중</span>`
      : "";

  return `<div class="labyrinth-card">
    <div class="labyrinth-card-top">
      <h3 class="labyrinth-card-title">${escapeHtml(item.title||"제목 없음")}</h3>
      <div class="labyrinth-inline-status">
        <span class="labyrinth-status-badge ${statusClass}">${escapeHtml(statusText)}</span>
        ${progressBadge}
      </div>
    </div>
    <div class="labyrinth-card-description">${escapeHtml(desc)}</div>
    <div class="labyrinth-card-meta">
      <div>제작자: ${escapeHtml(item.creator||"-")}</div>
      <div>수정: ${formatDateTime(item.updatedAt||item.createdAt)}</div>
    </div>
    <div class="labyrinth-card-actions">
      <button onclick="openLabyrinthDetail('${escapeJs(item.id)}')">입장</button>
      ${mine?`<button onclick="openEditLabyrinthModal('${escapeJs(item.id)}')">수정</button>`:""}
    </div>
  </div>`;
}

function openCreateLabyrinthModal(){
  if(!state.currentUser){
    alert("로그인 후 이용할 수 있습니다.");
    return;
  }
  el.labyrinthTitleInput.value="";
  el.labyrinthDescriptionInput.value="";
  el.labyrinthThumbnailTextInput.value="";
  el.labyrinthPublicCheckbox.checked=false;
  el.labyrinthOpenCheckbox.checked=true;
  el.createLabyrinthModal.classList.remove("hidden");
  syncOverlay();
}
function closeCreateLabyrinthModal(){
  el.createLabyrinthModal?.classList.add("hidden");
  syncOverlay();
}
window.openCreateLabyrinthModal=openCreateLabyrinthModal;
window.closeCreateLabyrinthModal=closeCreateLabyrinthModal;

async function submitCreateLabyrinth(){
  const title=normalizeLabyrinthText(el.labyrinthTitleInput.value);
  const description=normalizeLabyrinthText(el.labyrinthDescriptionInput.value);
  const thumbnailText=normalizeLabyrinthText(el.labyrinthThumbnailTextInput.value);
  const isPublic=!!el.labyrinthPublicCheckbox.checked;
  const isOpen=!!el.labyrinthOpenCheckbox.checked;

  if(!title){
    alert("미궁 제목을 입력하세요.");
    return;
  }

  const ref=await labyrinthsRef().add({
    title,
    description,
    thumbnailText,
    creator:state.currentUser,
    isPublic,
    isOpen,
    createdAt:firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt:firebase.firestore.FieldValue.serverTimestamp()
  });

  closeCreateLabyrinthModal();
  openLabyrinthDetail(ref.id);
}
window.submitCreateLabyrinth=submitCreateLabyrinth;

function openEditLabyrinthModal(id){
  const item=state.labyrinths.find(v=>v.id===id);
  if(!item){
    alert("미궁을 찾을 수 없습니다.");
    return;
  }
  if(!isLabyrinthOwner(item)){
    alert("수정 권한이 없습니다.");
    return;
  }
  state.editingLabyrinthId=id;
  el.editLabyrinthTitleInput.value=item.title||"";
  el.editLabyrinthDescriptionInput.value=item.description||"";
  el.editLabyrinthThumbnailTextInput.value=item.thumbnailText||"";
  el.editLabyrinthPublicCheckbox.checked=!!item.isPublic;
  el.editLabyrinthOpenCheckbox.checked=!!item.isOpen;
  el.editLabyrinthModal.classList.remove("hidden");
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
  const item=state.labyrinths.find(v=>v.id===id);
  if(!item){
    alert("미궁을 찾을 수 없습니다.");
    return;
  }
  if(!isLabyrinthOwner(item)){
    alert("수정 권한이 없습니다.");
    return;
  }

  const title=normalizeLabyrinthText(el.editLabyrinthTitleInput.value);
  const description=normalizeLabyrinthText(el.editLabyrinthDescriptionInput.value);
  const thumbnailText=normalizeLabyrinthText(el.editLabyrinthThumbnailTextInput.value);

  if(!title){
    alert("미궁 제목을 입력하세요.");
    return;
  }

  await labyrinthRef(id).set({
    title,
    description,
    thumbnailText,
    isPublic:!!el.editLabyrinthPublicCheckbox.checked,
    isOpen:!!el.editLabyrinthOpenCheckbox.checked,
    updatedAt:firebase.firestore.FieldValue.serverTimestamp()
  },{merge:true});

  closeEditLabyrinthModal();
}
window.submitEditLabyrinth=submitEditLabyrinth;

function openLabyrinthDetail(id){
  const item=state.labyrinths.find(v=>v.id===id);
  if(!item){
    alert("미궁을 찾을 수 없습니다.");
    return;
  }
  if(!item.isPublic&&item.creator!==state.currentUser){
    alert("비공개 미궁입니다.");
    return;
  }

  state.currentLabyrinthId=id;
  state.currentLabyrinthData=item;
  state.currentLabyrinthStages=[];
  state.currentLabyrinthPlayer=null;
  state.currentLabyrinthPlayers=[];

  if(state.unsubscribeLabyrinthStages){state.unsubscribeLabyrinthStages();state.unsubscribeLabyrinthStages=null;}
  if(state.unsubscribeLabyrinthPlayer){state.unsubscribeLabyrinthPlayer();state.unsubscribeLabyrinthPlayer=null;}
  if(state.unsubscribeLabyrinthPlayers){state.unsubscribeLabyrinthPlayers();state.unsubscribeLabyrinthPlayers=null;}

  showEscapeLabyrinthRoot();
  el.labyrinthHomeView?.classList.add("hidden");
  el.labyrinthDetailView?.classList.remove("hidden");
  updateEventActionButtons();

  state.unsubscribeLabyrinthStages=labyrinthStagesRef(id).onSnapshot(snap=>{
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
    }).sort((a,b)=>a.order-b.order);
    renderLabyrinthDetail();
  },err=>{
    console.error(err);
    alert("단계 정보를 불러오는 중 오류가 발생했습니다.");
  });

  state.unsubscribeLabyrinthPlayer=labyrinthPlayerRef(id,state.currentUser).onSnapshot(doc=>{
    state.currentLabyrinthPlayer=doc.exists?(doc.data()||null):null;
    renderLabyrinthDetail();
  },err=>{
    console.error(err);
    alert("진행 정보를 불러오는 중 오류가 발생했습니다.");
  });

  state.unsubscribeLabyrinthPlayers=labyrinthPlayersRef(id).onSnapshot(snap=>{
    state.currentLabyrinthPlayers=snap.docs.map(doc=>{
      const d=doc.data()||{};
      return{
        nickname:d.nickname||doc.id,
        currentStageOrder:Number(d.currentStageOrder||0),
        clearedStageOrders:Array.isArray(d.clearedStageOrders)?d.clearedStageOrders.map(Number):[],
        stageEnteredAtMap:d.stageEnteredAtMap||{},
        stageClearedAtMap:d.stageClearedAtMap||{},
        createdAt:d.createdAt||null,
        updatedAt:d.updatedAt||null
      };
    });
    renderLabyrinthDetail();
  },err=>{
    console.error(err);
    alert("참여자 정보를 불러오는 중 오류가 발생했습니다.");
  });
}
window.openLabyrinthDetail=openLabyrinthDetail;

function renderFinalStageClearersCard(){
  const activeStages=state.currentLabyrinthStages.filter(v=>v.isActive);
  if(!activeStages.length)return "";

  const finalStage=
    activeStages.find(v=>v.type==="final") ||
    [...activeStages].sort((a,b)=>b.order-a.order)[0];

  if(!finalStage)return "";

  const clearers=(state.currentLabyrinthPlayers||[])
    .filter(player=>{
      const clearedAt=player?.stageClearedAtMap?.[String(finalStage.order)];
      if(!clearedAt)return false;
      return player.nickname!==state.currentLabyrinthData?.creator;
    })
    .sort((a,b)=>{
      const aTime=a.stageClearedAtMap?.[String(finalStage.order)]||null;
      const bTime=b.stageClearedAtMap?.[String(finalStage.order)]||null;
      return getTimeValue(aTime)-getTimeValue(bTime);
    });

  if(!clearers.length){
    return `
      <div class="party-card">
        <div class="party-title">명예의 전당</div>
        <div class="party-sub">아직 명예의 전당에 오른 사람이 없습니다.</div>
      </div>
    `;
  }

  const lines=clearers.map((player,idx)=>{
    const clearedAt=player.stageClearedAtMap?.[String(finalStage.order)]||null;
    const rankText=idx===0?"1위":idx===1?"2위":idx===2?"3위":`${idx+1}위`;
    return `<div class="labyrinth-player-line"><b>${rankText}</b> ${escapeHtml(player.nickname)}(${escapeHtml(formatDateTime(clearedAt))})</div>`;
  }).join("");

  return `
    <div class="party-card">
      <div class="party-title">명예의 전당</div>
      <div class="party-sub">제작자를 제외한 최종장 클리어 순서입니다.</div>
      <div class="member-list">${lines}</div>
    </div>
  `;
}


function renderLabyrinthDetail(){
  const item=state.currentLabyrinthData;
  if(!item)return;

  el.labyrinthDetailTitle.textContent=item.title||"미궁";
  el.labyrinthDetailMeta.innerHTML=`제작자: ${escapeHtml(item.creator||"-")} · ${item.isPublic?"공개":"비공개"} · ${item.isOpen?"플레이 가능":"플레이 중지"}`;
  el.labyrinthDetailDescription.textContent=item.description||"설명이 없습니다.";

    const currentOrder=Number(state.currentLabyrinthPlayer?.currentStageOrder||0);
  const clearedOrders=Array.isArray(state.currentLabyrinthPlayer?.clearedStageOrders)?state.currentLabyrinthPlayer.clearedStageOrders.map(Number):[];
  const stageEnteredAtMap=state.currentLabyrinthPlayer?.stageEnteredAtMap||{};
  const stageClearedAtMap=state.currentLabyrinthPlayer?.stageClearedAtMap||{};

  if(isLabyrinthOwner(item)){
    el.labyrinthProgressSummary.classList.remove("hidden");
    el.labyrinthProgressSummary.innerHTML=
      `<div class="summary-card"><div class="muted">제작자 도구</div><div class="labyrinth-maker-tools"><button onclick="openEditLabyrinthModal('${escapeJs(item.id)}')">미궁 정보 수정</button><button onclick="openEditStageModal()">단계 추가</button></div></div>` +
      renderFinalStageClearersCard();
  }else{
    el.labyrinthProgressSummary.classList.remove("hidden");
    el.labyrinthProgressSummary.innerHTML=renderFinalStageClearersCard();
  }
  
  if(!state.currentLabyrinthStages.length){
    el.labyrinthStageList.innerHTML=isLabyrinthOwner(item)
      ? `<div class="labyrinth-empty">아직 단계가 없습니다.<br><br><button onclick="openEditStageModal()">첫 단계 만들기</button></div>`
      : `<div class="labyrinth-empty">아직 등록된 단계가 없습니다.</div>`;
    return;
  }

  const cards=state.currentLabyrinthStages.filter(v=>v.isActive).map(stage=>{
    const enteredAt=stageEnteredAtMap[String(stage.order)]||null;
    const clearedAt=stageClearedAtMap[String(stage.order)]||null;

    if(clearedOrders.includes(stage.order)){
      return `<div class="labyrinth-stage-card cleared">
        <div class="labyrinth-stage-header">
          <h3 class="labyrinth-stage-title">${escapeHtml(stage.title||`단계 ${stage.order}`)}</h3>
          <span class="labyrinth-clear-badge">통과 완료</span>
        </div>
        ${stage.story?`<div class="labyrinth-stage-story">${escapeHtml(stage.story)}</div>`:""}
        <div class="labyrinth-stage-footer">
          <div class="labyrinth-stage-meta">입장: ${formatDateTime(enteredAt)} · 통과: ${formatDateTime(clearedAt)}</div>
          ${isLabyrinthOwner(item)?`<button onclick="openEditStageModal('${escapeJs(stage.id)}')">수정</button>`:""}
        </div>
      </div>`;
    }

    if(stage.order===currentOrder){
      if(stage.type==="entry"){
        return `<div class="labyrinth-stage-card current">
          <div class="labyrinth-stage-header">
            <h3 class="labyrinth-stage-title">${escapeHtml(stage.title||`단계 ${stage.order}`)}</h3>
            <span class="labyrinth-stage-order">입장형</span>
          </div>
          ${stage.story?`<div class="labyrinth-stage-story">${escapeHtml(stage.story)}</div>`:""}
          <div class="labyrinth-stage-footer">
            <div class="labyrinth-stage-meta">현재 입장 가능한 단계입니다.</div>
            <div class="actions">
              <button onclick="completeCurrentEntryStage(${stage.order})">${escapeHtml(stage.title||"입장하기")}</button>
              ${isLabyrinthOwner(item)?`<button onclick="openEditStageModal('${escapeJs(stage.id)}')">수정</button>`:""}
            </div>
          </div>
        </div>`;
      }

      const inputId=`labyrinthAnswerInput-${stage.order}`;
      return `<div class="labyrinth-stage-card current">
        <div class="labyrinth-stage-header">
          <h3 class="labyrinth-stage-title">${escapeHtml(stage.title||`단계 ${stage.order}`)}</h3>
          <span class="labyrinth-stage-order">${stage.type==="final"?"최종":"문제"}</span>
        </div>
        ${stage.story?`<div class="labyrinth-stage-story">${escapeHtml(stage.story)}</div>`:""}
        ${stage.question?`<div class="labyrinth-stage-question">${escapeHtml(stage.question)}</div>`:""}
        <div class="labyrinth-stage-input-wrap">
          <input id="${inputId}" class="text-input" type="text" placeholder="${escapeHtml(stage.placeholder||"정답을 입력하세요.")}">
          <div class="actions">
            <button onclick="submitLabyrinthAnswer(${stage.order})">확인</button>
            ${isLabyrinthOwner(item)?`<button onclick="openEditStageModal('${escapeJs(stage.id)}')">수정</button>`:""}
          </div>
        </div>
        <div class="labyrinth-stage-footer">
          <div class="labyrinth-stage-meta">입장 시각: ${formatDateTime(enteredAt)}</div>
        </div>
      </div>`;
    }

    return "";
  }).filter(Boolean).join("");

  el.labyrinthStageList.innerHTML=cards||`<div class="labyrinth-lock-card">현재 공개된 진행 단계가 없습니다.</div>`;
}

function openEditStageModal(stageId=""){
  const item=state.currentLabyrinthData;
  if(!item||!isLabyrinthOwner(item)){
    alert("단계 수정 권한이 없습니다.");
    return;
  }

  state.editingStageId=stageId||"";
  if(stageId){
    const stage=state.currentLabyrinthStages.find(v=>v.id===stageId);
    if(!stage){
      alert("단계를 찾을 수 없습니다.");
      return;
    }
    el.editStageModalTitle.textContent="단계 수정";
    el.stageOrderInput.value=String(stage.order);
    el.stageTitleInput.value=stage.title||"";
    el.stageTypeSelect.value=stage.type||"question";
    el.stageStoryInput.value=stage.story||"";
    el.stageQuestionInput.value=stage.question||"";
    el.stageAnswerInput.value=stage.answer||"";
    el.stagePlaceholderInput.value=stage.placeholder||"";
    el.stageSuccessMessageInput.value=stage.successMessage||"";
    el.stageActiveCheckbox.checked=!!stage.isActive;
    el.deleteStageBtn.classList.remove("hidden");
  }else{
    el.editStageModalTitle.textContent="단계 추가";
    el.stageOrderInput.value=String(state.currentLabyrinthStages.length);
    el.stageTitleInput.value="";
    el.stageTypeSelect.value="question";
    el.stageStoryInput.value="";
    el.stageQuestionInput.value="";
    el.stageAnswerInput.value="";
    el.stagePlaceholderInput.value="";
    el.stageSuccessMessageInput.value="";
    el.stageActiveCheckbox.checked=true;
    el.deleteStageBtn.classList.add("hidden");
  }

  el.editStageModal.classList.remove("hidden");
  syncOverlay();
}
function closeEditStageModal(){
  state.editingStageId="";
  el.editStageModal?.classList.add("hidden");
  syncOverlay();
}
window.openEditStageModal=openEditStageModal;
window.closeEditStageModal=closeEditStageModal;

async function submitStage(){
  const item=state.currentLabyrinthData;
  if(!item||!isLabyrinthOwner(item)){
    alert("단계 수정 권한이 없습니다.");
    return;
  }

  const order=Number(el.stageOrderInput.value);
  const title=normalizeLabyrinthText(el.stageTitleInput.value);
  const type=String(el.stageTypeSelect.value||"question");
  const story=normalizeLabyrinthText(el.stageStoryInput.value);
  const question=normalizeLabyrinthText(el.stageQuestionInput.value);
  const answer=normalizeLabyrinthText(el.stageAnswerInput.value);
  const placeholder=normalizeLabyrinthText(el.stagePlaceholderInput.value);
  const successMessage=normalizeLabyrinthText(el.stageSuccessMessageInput.value);
  const isActive=!!el.stageActiveCheckbox.checked;

  if(!Number.isInteger(order)||order<0){
    alert("순서는 0 이상의 정수로 입력하세요.");
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

  const payload={
    order,
    title,
    type,
    story,
    question,
    answer,
    placeholder,
    successMessage,
    isActive,
    updatedAt:firebase.firestore.FieldValue.serverTimestamp()
  };

  if(state.editingStageId){
    await labyrinthStagesRef(item.id).doc(state.editingStageId).set(payload,{merge:true});
  }else{
    payload.createdAt=firebase.firestore.FieldValue.serverTimestamp();
    await labyrinthStagesRef(item.id).add(payload);
  }

  await labyrinthRef(item.id).set({updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
  closeEditStageModal();
}
window.submitStage=submitStage;

async function deleteStage(){
  const item=state.currentLabyrinthData;
  if(!item||!isLabyrinthOwner(item)){
    alert("단계 삭제 권한이 없습니다.");
    return;
  }
  if(!state.editingStageId){
    alert("삭제할 단계를 찾을 수 없습니다.");
    return;
  }
  if(!confirm("이 단계를 삭제하시겠습니까?"))return;

  await labyrinthStagesRef(item.id).doc(state.editingStageId).delete();
  await labyrinthRef(item.id).set({updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
  closeEditStageModal();
}
window.deleteStage=deleteStage;

async function completeCurrentEntryStage(order){
  const item=state.currentLabyrinthData;
  const stage=state.currentLabyrinthStages.find(v=>v.order===order&&v.isActive);
  if(!item||!stage)return;

  const stages=[...state.currentLabyrinthStages].filter(v=>v.isActive).sort((a,b)=>a.order-b.order);
  const next=stages.find(v=>v.order>order)||null;

  const currentCleared=Array.isArray(state.currentLabyrinthPlayer?.clearedStageOrders)?state.currentLabyrinthPlayer.clearedStageOrders.map(Number):[];
  if(currentCleared.includes(order))return;

  const stageEnteredAtMap={...(state.currentLabyrinthPlayer?.stageEnteredAtMap||{})};
  const stageClearedAtMap={...(state.currentLabyrinthPlayer?.stageClearedAtMap||{})};

  stageEnteredAtMap[String(order)]=firebase.firestore.FieldValue.serverTimestamp();
  stageClearedAtMap[String(order)]=firebase.firestore.FieldValue.serverTimestamp();
  if(next)stageEnteredAtMap[String(next.order)]=firebase.firestore.FieldValue.serverTimestamp();

  await labyrinthPlayerRef(item.id,state.currentUser).set({
    nickname:state.currentUser,
    currentStageOrder:next?next.order:order+1,
    clearedStageOrders:[...new Set([...currentCleared,order])].sort((a,b)=>a-b),
    stageEnteredAtMap,
    stageClearedAtMap,
    createdAt:state.currentLabyrinthPlayer?.createdAt||firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt:firebase.firestore.FieldValue.serverTimestamp()
  },{merge:true});

  if(stage.successMessage)alert(stage.successMessage);
}
window.completeCurrentEntryStage=completeCurrentEntryStage;

async function submitLabyrinthAnswer(order){
  const item=state.currentLabyrinthData;
  const stage=state.currentLabyrinthStages.find(v=>v.order===order&&v.isActive);
  if(!item||!stage)return;

  const input=document.getElementById(`labyrinthAnswerInput-${order}`);
  const value=normalizeAnswerValue(input?.value||"");
  const expected=normalizeAnswerValue(stage.answer||"");

  if(!value){
    alert("정답을 입력하세요.");
    input?.focus();
    return;
  }

  if(value!==expected){
    alert("정답이 아닙니다.");
    input?.focus();
    return;
  }

  const stages=[...state.currentLabyrinthStages].filter(v=>v.isActive).sort((a,b)=>a.order-b.order);
  const next=stages.find(v=>v.order>order)||null;

  const currentCleared=Array.isArray(state.currentLabyrinthPlayer?.clearedStageOrders)?state.currentLabyrinthPlayer.clearedStageOrders.map(Number):[];
  const stageEnteredAtMap={...(state.currentLabyrinthPlayer?.stageEnteredAtMap||{})};
  const stageClearedAtMap={...(state.currentLabyrinthPlayer?.stageClearedAtMap||{})};

  if(!stageEnteredAtMap[String(order)])stageEnteredAtMap[String(order)]=firebase.firestore.FieldValue.serverTimestamp();
  stageClearedAtMap[String(order)]=firebase.firestore.FieldValue.serverTimestamp();
  if(next)stageEnteredAtMap[String(next.order)]=firebase.firestore.FieldValue.serverTimestamp();

  await labyrinthPlayerRef(item.id,state.currentUser).set({
    nickname:state.currentUser,
    currentStageOrder:next?next.order:order+1,
    clearedStageOrders:[...new Set([...currentCleared,order])].sort((a,b)=>a-b),
    stageEnteredAtMap,
    stageClearedAtMap,
    createdAt:state.currentLabyrinthPlayer?.createdAt||firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt:firebase.firestore.FieldValue.serverTimestamp()
  },{merge:true});

  if(stage.successMessage)alert(stage.successMessage);
  else if(stage.type==="final"&&!next)alert("미궁을 클리어했습니다.");
}
window.submitLabyrinthAnswer=submitLabyrinthAnswer;

/* ===== 기존 기능들 ===== */
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
function openRuinsCreateModal(){if(!state.isAdmin){alert("유적 파티는 운영진만 생성할 수 있습니다.");return;}state.editingRuinsPartyId="";el.ruinsModalTitle.textContent="유적 파티 생성";el.ruinsSubmitBtn.textContent="생성";if(el.ruinNameInput)el.ruinNameInput.value="";document.getElementById("ruinNameWrap")?.classList.remove("hidden");document.getElementById("holySwordSideWrap")?.classList.add("hidden");resetPartyFormCommon();el.utcMonth.value="1";el.utcDay.value="1";el.utcHour.value="0";el.ruinsCreateModal.classList.remove("hidden");syncOverlay();}
function openHolySwordCreateModal(){if(!state.isAdmin){alert("성검 파티는 운영진만 생성할 수 있습니다.");return;}state.editingRuinsPartyId="";el.ruinsModalTitle.textContent="성검 파티 생성";el.ruinsSubmitBtn.textContent="생성";if(el.ruinNameInput)el.ruinNameInput.value="";document.getElementById("ruinNameWrap")?.classList.add("hidden");document.getElementById("holySwordSideWrap")?.classList.remove("hidden");document.getElementById("firstGroupWrap")?.classList.remove("hidden");if(el.firstGroupCheckbox)el.firstGroupCheckbox.checked=false;const sideSelect=document.getElementById("holySwordSideSelect");if(sideSelect)sideSelect.value=state.holySwordSelectedSide||"KOR";el.utcMonth.value="1";el.utcDay.value="1";el.utcHour.value="0";el.ruinsCreateModal.classList.remove("hidden");syncOverlay();}
function openTripleAllianceCreateModal(){if(!state.isAdmin){alert("삼대 연맹전 파티는 운영진만 생성할 수 있습니다.");return;}state.editingRuinsPartyId="";el.ruinsModalTitle.textContent="삼대 연맹전 생성";el.ruinsSubmitBtn.textContent="생성";if(el.ruinNameInput)el.ruinNameInput.value="";document.getElementById("ruinNameWrap")?.classList.add("hidden");document.getElementById("holySwordSideWrap")?.classList.remove("hidden");document.getElementById("firstGroupWrap")?.classList.remove("hidden");if(el.firstGroupCheckbox)el.firstGroupCheckbox.checked=false;const sideSelect=document.getElementById("holySwordSideSelect");if(sideSelect)sideSelect.value=state.tripleAllianceSelectedSide||"KOR";el.utcMonth.value="1";el.utcDay.value="1";el.utcHour.value="0";el.ruinsCreateModal.classList.remove("hidden");syncOverlay();}
window.openRuinsEditModal=async function(partyId){if(!state.isAdmin){alert("권한이 없습니다.");return;}const p=state.parties.find(v=>v.id===partyId);if(!p){alert("파티를 찾을 수 없습니다.");return;}state.editingRuinsPartyId=partyId;el.ruinsSubmitBtn.textContent="수정";if(state.currentEventId==="holy_sword"){el.ruinsModalTitle.textContent="성검 파티 수정";document.getElementById("ruinNameWrap")?.classList.add("hidden");document.getElementById("holySwordSideWrap")?.classList.remove("hidden");document.getElementById("firstGroupWrap")?.classList.remove("hidden");if(el.firstGroupCheckbox)el.firstGroupCheckbox.checked=!!p.isFirstGroup;const sideSelect=document.getElementById("holySwordSideSelect");if(sideSelect)sideSelect.value=p.side||"KOR";}else if(state.currentEventId==="triple_alliance"){el.ruinsModalTitle.textContent="삼대 연맹전 수정";document.getElementById("ruinNameWrap")?.classList.add("hidden");document.getElementById("holySwordSideWrap")?.classList.remove("hidden");document.getElementById("firstGroupWrap")?.classList.remove("hidden");if(el.firstGroupCheckbox)el.firstGroupCheckbox.checked=!!p.isFirstGroup;const sideSelect=document.getElementById("holySwordSideSelect");if(sideSelect)sideSelect.value=p.side||"KOR";}else{el.ruinsModalTitle.textContent="유적 파티 수정";document.getElementById("ruinNameWrap")?.classList.remove("hidden");document.getElementById("holySwordSideWrap")?.classList.add("hidden");resetPartyFormCommon();el.ruinNameInput.value=p.ruinName||p.name||"";}const d=toDate(p.timeUTC);if(d){el.utcMonth.value=String(d.getUTCMonth()+1);el.utcDay.value=String(d.getUTCDate());el.utcHour.value=String(d.getUTCHours());}el.ruinsCreateModal.classList.remove("hidden");syncOverlay();};
function closeRuinsCreateModal(){state.editingRuinsPartyId="";document.getElementById("ruinNameWrap")?.classList.remove("hidden");document.getElementById("holySwordSideWrap")?.classList.add("hidden");resetPartyFormCommon();el.ruinsCreateModal.classList.add("hidden");syncOverlay();}
window.closeRuinsCreateModal=closeRuinsCreateModal;

window.submitRuinsParty=async function(){
  if(!state.isAdmin){alert("권한이 없습니다.");return;}
  const m=Number(el.utcMonth.value),d=Number(el.utcDay.value),h=Number(el.utcHour.value),isFirstGroup=!!el.firstGroupCheckbox?.checked;
  if(!m||!d||h<0||h>23){alert("UTC 날짜/시간을 선택하세요.");return;}
  const year=new Date().getUTCFullYear();
  const utcDate=new Date(Date.UTC(year,m-1,d,h,0,0,0));

  if(state.currentEventId==="holy_sword"||state.currentEventId==="triple_alliance"){
    const side=document.getElementById("holySwordSideSelect")?.value||"KOR";
    const sideText=side==="KOR"?"본연맹":"아카데미";
    const sideCode=side==="KOR"?"KOR":"KR1";
    const kstHour=(h+9)%24;
    const autoName=`[${sideText}(${sideCode})] ${kstHour}시(UTC ${String(h).padStart(2,"0")}:00)`;
    const eventId=state.currentEventId;
    if(state.editingRuinsPartyId){
      await partiesRef(eventId).doc(state.editingRuinsPartyId).update({name:autoName,side,timeUTC:utcDate,isFirstGroup});
    }else{
const payload = {
  type: eventId,
  event: eventId,
  name: autoName,
  side,
  createdBy: state.currentUser,
  members: [],
  timeUTC: utcDate,
  isFirstGroup,
  createdAt: firebase.firestore.FieldValue.serverTimestamp()
};

if (eventId === "holy_sword") {
  payload.areaAssignments = [];
}

await partiesRef(eventId).add(payload);
    }
    closeRuinsCreateModal();
    return;
  }

  const ruinName=(el.ruinNameInput.value||"").trim();
  if(!ruinName){alert("유적명을 입력하세요.");return;}
  if(state.editingRuinsPartyId){
    await partiesRef("ruins").doc(state.editingRuinsPartyId).update({name:ruinName,ruinName,timeUTC:utcDate});
  }else{
    await partiesRef("ruins").add({type:"ruins",event:"ruins",name:ruinName,ruinName,createdBy:state.currentUser,members:[],rallyLeader:"",maxMembers:15,timeUTC:utcDate,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
  }
  closeRuinsCreateModal();
};

function lockRearrangeInputForManualTap(){el.rearrangeStageInput?.setAttribute("readonly","readonly");el.rearrangeStageInput?.blur();}
function unlockRearrangeInput(){if(el.rearrangeStageInput?.hasAttribute("readonly"))el.rearrangeStageInput.removeAttribute("readonly");}
if(el.rearrangeStageInput){const unlockAndFocus=()=>{unlockRearrangeInput();setTimeout(()=>{try{el.rearrangeStageInput.focus({preventScroll:true});}catch(_){el.rearrangeStageInput.focus();}},0);};el.rearrangeStageInput.addEventListener("pointerdown",unlockAndFocus);el.rearrangeStageInput.addEventListener("touchstart",unlockAndFocus,{passive:true});el.rearrangeStageInput.addEventListener("mousedown",unlockAndFocus);}
window.openMyRearrangeModal=function(){el.rearrangeModalTitle.textContent="내 진척도 입력";el.rearrangeSubmitBtn.textContent="저장";const mine=myRearrangeEntry();el.rearrangeStageInput.value=mine?mine.stageText:"";lockRearrangeInputForManualTap();el.rearrangeModal.classList.remove("hidden");syncOverlay();setTimeout(()=>{if(document.activeElement&&typeof document.activeElement.blur==="function")document.activeElement.blur();el.rearrangeStageInput.blur();},80);};
function closeRearrangeModal(){el.rearrangeStageInput?.blur();el.rearrangeStageInput?.removeAttribute("readonly");el.rearrangeModal?.classList.add("hidden");syncOverlay();}
function openExampleImageModal(type="tower"){if(type==="guide"){el.exampleImageModalTitle.textContent="순열 안내 예시";el.exampleImageModalImg.src="자리 순열.png";el.exampleImageModalImg.alt="자리 순열 안내 예시";}else{el.exampleImageModalTitle.textContent="입력 예시 크게 보기";el.exampleImageModalImg.src="빛나는첨탑순위.png";el.exampleImageModalImg.alt="빛나는 첨탑 순위 예시 크게 보기";}el.exampleImageModal.classList.remove("hidden");syncOverlay();}
function closeExampleImageModal(){el.exampleImageModal?.classList.add("hidden");syncOverlay();}
window.closeRearrangeModal=closeRearrangeModal;
window.openExampleImageModal=openExampleImageModal;
window.closeExampleImageModal=closeExampleImageModal;

window.openHolySwordAreaModal=function(partyId){if(!state.isAdmin){alert("권한이 없습니다.");return;}const party=state.parties.find(v=>v.id===partyId);if(!party){alert("파티를 찾을 수 없습니다.");return;}state.editingHolySwordPartyId=partyId;el.holySwordAreaModalTitle.textContent=`구역장 지정 - ${party.name}`;el.holySwordAreaUserSelect.innerHTML=party.members.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");el.holySwordAreaSelect.value="마구간";renderHolySwordAreaAssignmentList(party);el.holySwordAreaModal.classList.remove("hidden");syncOverlay();};
function closeHolySwordAreaModal(){state.editingHolySwordPartyId="";el.holySwordAreaModal?.classList.add("hidden");syncOverlay();}
window.closeHolySwordAreaModal=closeHolySwordAreaModal;

function renderHolySwordAreaAssignmentList(party){const assignments=normalizeAssignments(party.areaAssignments);el.holySwordAreaAssignmentList.innerHTML=assignments.length?assignments.map((item,idx)=>`<div class="holy-sword-assign-item"><span>${escapeHtml(item.user)} - ${escapeHtml(item.area)}</span><button type="button" class="rank-edit-btn" onclick="removeHolySwordAreaAssignment(${idx})">삭제</button></div>`).join(""):`<div class="muted">지정된 구역장이 없습니다.</div>`;}
window.addHolySwordAreaAssignment=async function(){if(!state.isAdmin){alert("권한이 없습니다.");return;}const party=state.parties.find(v=>v.id===state.editingHolySwordPartyId);if(!party){alert("파티를 찾을 수 없습니다.");return;}const user=el.holySwordAreaUserSelect.value;const area=el.holySwordAreaSelect.value;if(!user||!area){alert("파티원과 구역을 선택하세요.");return;}const areaAssignments=[...normalizeAssignments(party.areaAssignments),{user,area}];await partiesRef("holy_sword").doc(party.id).update({areaAssignments});};
window.removeHolySwordAreaAssignment=async function(index){if(!state.isAdmin){alert("권한이 없습니다.");return;}const party=state.parties.find(v=>v.id===state.editingHolySwordPartyId);if(!party){alert("파티를 찾을 수 없습니다.");return;}const areaAssignments=[...normalizeAssignments(party.areaAssignments)];if(index<0||index>=areaAssignments.length)return;areaAssignments.splice(index,1);await partiesRef("holy_sword").doc(party.id).update({areaAssignments});};

function parseStageText(raw){const value=String(raw||"").trim();const parts=value.split("-");if(parts.length!==2||parts[0]===""||parts[1]==="")return null;const stageMajor=Number(parts[0]);const stageMinor=Number(parts[1]);if(!Number.isInteger(stageMajor)||!Number.isInteger(stageMinor)||stageMajor<0||stageMinor<0)return null;return{stageMajor,stageMinor};}
window.submitRearrangeProgress=async function(){const raw=(el.rearrangeStageInput.value||"").trim();const parsed=parseStageText(raw);if(!parsed){alert("최고 스테이지는 15-4 형식으로 입력하세요.");return;}await rearrangeProgressRef().doc(state.currentUser).set({user:state.currentUser,stageText:raw,stageMajor:parsed.stageMajor,stageMinor:parsed.stageMinor,updatedAt:firebase.firestore.FieldValue.serverTimestamp(),createdAt:state.rearrangeProgressEntries.find(v=>v.user===state.currentUser)?.createdAt||firebase.firestore.FieldValue.serverTimestamp()},{merge:true});closeExampleImageModal();closeRearrangeModal();syncOverlay();};

window.openRearrangeRankEditModal=function(userName=""){if(!state.isAdmin){alert("권한이 없습니다.");return;}ensureRankingExtraFields();const entry=userName?state.rearrangeEntries.find(v=>v.user===userName):null;if(!entry){alert("대상을 찾을 수 없습니다.");return;}state.editingRearrangeRankUser=entry.user;el.rearrangeRankEditTitle.textContent="순위표 관리";el.rankEditSubmitBtn.textContent="저장";el.rankEditDeleteBtn.classList.remove("hidden");el.rankEditNicknameInput.value=entry.user||"";el.rankEditStageInput.value=entry.stageText||"";el.rankEditPowerInput.value=entry.power>0?String(entry.power):"";el.rankEditNoteInput.value=entry.note||"";const existingInput=document.getElementById("rankEditExistingInput");if(existingInput)existingInput.value=entry.existingColumn>0?String(entry.existingColumn):"";const excludeBtn=document.getElementById("rankEditExcludeBtn");if(excludeBtn){excludeBtn.textContent=entry.excluded?"제외 해제":"목록에서 제외";excludeBtn.onclick=toggleRearrangeExcluded;}el.rankEditNicknameInput.readOnly=true;el.rankEditStageInput.readOnly=true;el.rankEditDeleteBtn.textContent="관리값 삭제";el.rearrangeRankEditModal.classList.remove("hidden");syncOverlay();};
function closeRearrangeRankEditModal(){state.editingRearrangeRankUser="";el.rankEditNicknameInput.readOnly=false;el.rankEditStageInput.readOnly=false;el.rearrangeRankEditModal?.classList.add("hidden");syncOverlay();}
window.closeRearrangeRankEditModal=closeRearrangeRankEditModal;
window.toggleRearrangeExcluded=async function(){if(!state.isAdmin)return;const user=state.editingRearrangeRankUser||"";if(!user)return;const current=state.rearrangeEntries.find(v=>v.user===user);if(!current)return;await rearrangeRankingRef().doc(user).set({user,excluded:!current.excluded,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});closeRearrangeRankEditModal();};
window.submitRearrangeRankEdit=async function(){if(!state.isAdmin)return;const user=state.editingRearrangeRankUser||"";if(!user)return;const current=state.rearrangeEntries.find(v=>v.user===user);const powerRaw=(el.rankEditPowerInput.value||"").trim();const note=(el.rankEditNoteInput.value||"").trim();const existingRaw=(document.getElementById("rankEditExistingInput")?.value||"").trim();let power=0;if(powerRaw!==""){power=Number(powerRaw);if(!Number.isInteger(power)||power<0){alert("전투력은 0 이상의 정수로 입력하세요.");return;}}let existingColumn=0;if(existingRaw!==""){existingColumn=Number(existingRaw);if(!Number.isInteger(existingColumn)||existingColumn<1){alert("기존은 1 이상의 정수로 입력하세요.");return;}}await rearrangeRankingRef().doc(user).set({user,power,note,existingColumn,excluded:!!current?.excluded,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});closeRearrangeRankEditModal();};
window.deleteRearrangeRankRow=async function(){if(!state.isAdmin)return;const user=state.editingRearrangeRankUser||"";if(!user)return;await rearrangeRankingRef().doc(user).delete();closeRearrangeRankEditModal();};
window.toggleRearrangePublic=async function(){if(!state.isAdmin)return;await eventRef("rearrange").set({rankingPublic:!state.rearrangePublic},{merge:true});};
window.toggleRearrangeInputEnabled=async function(){if(!state.isAdmin||state.currentUser!=="병풍")return;await eventRef("rearrange").set({rearrangeInputEnabled:!state.rearrangeInputEnabled},{merge:true});};

window.joinParty=async function(id){const ref=partiesRef(state.currentEventId).doc(id);const snap=await ref.get();if(!snap.exists)return;const d=snap.data()||{};const members=normalizeMembers(d.members);if(state.currentEventId==="viking"&&myParty()){alert("이미 다른 파티에 참여 중입니다.");return;}if(members.includes(state.currentUser))return;if(state.currentEventId==="ruins"&&members.length>=15){alert("유적 파티는 최대 15명입니다.");return;}if(state.currentEventId==="viking"&&Number(d.maxMembers||0)>0&&members.length>=Number(d.maxMembers)){alert("이 파티는 정원이 가득 찼습니다.");return;}members.push(state.currentUser);await ref.update({members});};
window.leaveParty=async function(id){const ref=partiesRef(state.currentEventId).doc(id);const snap=await ref.get();if(!snap.exists)return;const d=snap.data()||{};const members=normalizeMembers(d.members).filter(v=>v!==state.currentUser);const updates={members};if(state.currentEventId==="ruins"&&d.rallyLeader===state.currentUser)updates.rallyLeader=members[0]||"";if(state.currentEventId==="holy_sword")updates.areaAssignments=normalizeAssignments(d.areaAssignments).filter(v=>v.user!==state.currentUser);await ref.update(updates);};
window.deleteParty=async function(id){const ref=partiesRef(state.currentEventId).doc(id);const snap=await ref.get();if(!snap.exists)return;const d=snap.data()||{};const ok=state.isAdmin||d.createdBy===state.currentUser;if(!ok){alert("삭제 권한이 없습니다.");return;}if(!confirm("정말 이 파티를 삭제하시겠습니까?"))return;await ref.delete();};
window.kickMember=async function(id,name){const p=state.parties.find(v=>v.id===id);if(!p)return;const ok=state.isAdmin||p.createdBy===state.currentUser;if(!ok)return;if(!confirm(`${name} 님을 추방하시겠습니까?`))return;const ref=partiesRef(state.currentEventId).doc(id);const members=normalizeMembers(p.members).filter(v=>v!==name);const updates={members};if(state.currentEventId==="ruins"&&p.rallyLeader===name)updates.rallyLeader=members[0]||"";if(state.currentEventId==="holy_sword")updates.areaAssignments=normalizeAssignments(p.areaAssignments).filter(v=>v.user!==name);await ref.update(updates);};
window.setRallyLeader=async function(id,name){if(!state.isAdmin)return;const p=state.parties.find(v=>v.id===id);if(!p||!p.members.includes(name))return;await partiesRef("ruins").doc(id).update({rallyLeader:name});};

function fallbackCopy(text){const ta=document.createElement("textarea");ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand("copy");document.body.removeChild(ta);alert("복사되었습니다.");}
window.copyRuinsNotice=function(partyId){const p=state.parties.find(v=>v.id===partyId);if(!p)return;const members=[...p.members];const leader=p.rallyLeader||"";const others=members.filter(n=>n!==leader);const power=calcPower(members.length).toLocaleString("ko-KR");const d=toDate(p.timeUTC);const kstTime=d?`${String(d.getHours()).padStart(2,"0")}:00`:"-";const utcTime=d?`${String(d.getUTCHours()).padStart(2,"0")}:00`:"-";const title=(p.ruinName||p.name||"")+" 명단";const text=`${title}\n시간: ${kstTime}(UTC ${utcTime})\n집결장: ${leader||"-"}\n집결원: ${others.join(", ")}\n병력수: ${power}명`;if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(()=>alert("복사되었습니다."),()=>fallbackCopy(text));}else fallbackCopy(text);};
window.copyHolySwordNotice=function(partyId){const p=state.parties.find(v=>v.id===partyId);if(!p)return;const members=getHolySwordSortedMembers(p.members);const byArea={};HOLY_SWORD_AREAS.forEach(area=>byArea[area]=[]);normalizeAssignments(p.areaAssignments).forEach(item=>{if(!byArea[item.area])byArea[item.area]=[];byArea[item.area].push(item.user);});const memberLines=members.map((name,idx)=>`${getHolySwordDisplayIndex(idx)} ${name}`);const text=["[성검 쟁탈]",`소속: ${getHolySwordSideLabel(p.side)}`,`시간: ${formatKST(p.timeUTC)} (UTC ${formatUTC(p.timeUTC)})`,"","[구역장]",`수도원 1: ${byArea["수도원 1"].join(", ")||"-"}`,`수도원 2: ${byArea["수도원 2"].join(", ")||"-"}`,`성소 1: ${byArea["성소 1"].join(", ")||"-"}`,`마구간: ${byArea["마구간"].join(", ")||"-"}`,`수도원 3: ${byArea["수도원 3"].join(", ")||"-"}`,`수도원 4: ${byArea["수도원 4"].join(", ")||"-"}`,`성소 2: ${byArea["성소 2"].join(", ")||"-"}`,`시계탑: ${byArea["시계탑"].join(", ")||"-"}`,"","[참가인원]",...memberLines].join("\n");if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(()=>alert("복사되었습니다."),()=>fallbackCopy(text));}else fallbackCopy(text);};
window.copyRearrangeColumns=function(){const activeEntries=state.rearrangeEntries.filter(v=>!isHiddenTestNickname(v.user)&&!v.excluded);const displayedEntries=getDisplayedRearrangeEntries(activeEntries);const columns={1:[],2:[],3:[],4:[],5:[]};const moveNeeded=[];displayedEntries.forEach((entry,idx)=>{const rank=idx+1;const col=getRearrangeColumn(rank);if(!entry)return;columns[col].push(entry.user);const existingColumn=Number(entry.existingColumn||0);if(existingColumn>0&&existingColumn!==col)moveNeeded.push(`${entry.user}(${existingColumn}→${col})`);});const lines=["[자리 재배치 결과]",`1열: ${columns[1].join(", ")}`,`2열: ${columns[2].join(", ")}`,`3열: ${columns[3].join(", ")}`,`4열: ${columns[4].join(", ")}`,`5열: ${columns[5].join(", ")}`,"","[이동 필요 인원]",...(moveNeeded.length?moveNeeded:["없음"])];const text=lines.join("\n");if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(()=>alert("순열이 복사되었습니다."),()=>fallbackCopy(text));}else fallbackCopy(text);};

window.showAllUsers=async function(){const usersSnap=await db.collection("users").get();const joined=new Set();if(state.currentEventId==="rearrange")state.rearrangeEntries.forEach(v=>joined.add(v.user));else state.parties.forEach(p=>normalizeMembers(p.members).forEach(n=>joined.add(n)));const all=[];usersSnap.forEach(doc=>{if(!isHiddenTestNickname(doc.id))all.push(doc.id);});all.sort((a,b)=>a.localeCompare(b,"ko"));el.joinedUsers.innerHTML=renderNameColumns(all.filter(n=>joined.has(n)));el.notJoinedUsers.innerHTML=renderNameColumns(all.filter(n=>!joined.has(n)));el.userModal.classList.remove("hidden");syncOverlay();};
function renderNameColumns(arr){if(!arr.length)return `<div class="name-item">(없음)</div>`;return arr.map(v=>`<div class="name-item">${escapeHtml(v)}</div>`).join("");}
function closeUserModal(){el.userModal?.classList.add("hidden");syncOverlay();}
window.closeUserModal=closeUserModal;
window.showAdminLogs=async function(){if(!state.isAdmin){alert("권한이 없습니다.");return;}const snap=await db.collection("adminLogs").orderBy("createdAt","desc").limit(50).get();const items=[];snap.forEach(doc=>items.push({id:doc.id,...doc.data()}));el.logList.innerHTML=items.length?items.map(log=>`<div class="log-item"><div class="log-top"><div class="log-action">${escapeHtml(log.action||"")}</div><div class="muted">${log.admin?escapeHtml(log.admin):""}</div></div><div class="muted">이벤트: ${escapeHtml(log.event||"-")}</div><div class="muted">${escapeHtml(JSON.stringify(log.payload||{}))}</div></div>`).join(""):`<div class="empty-card">운영 로그가 없습니다.</div>`;el.logModal.classList.remove("hidden");syncOverlay();closeAdminMenu();};
function closeLogModal(){el.logModal?.classList.add("hidden");syncOverlay();}
window.closeLogModal=closeLogModal;

document.addEventListener("DOMContentLoaded",tryAutoLogin);
