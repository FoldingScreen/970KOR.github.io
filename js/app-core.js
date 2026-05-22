const firebaseConfig={
  apiKey:"AIzaSyBu2RrQn8cAwwWaLtw5O8Omwn4-NzHWuc0",
  authDomain:"kor-app-fa47e.firebaseapp.com",
  projectId:"kor-app-fa47e",
  storageBucket:"kor-app-fa47e.firebasestorage.app",
  messagingSenderId:"397749083935",
  appId:"1:397749083935:web:51c7c"
};

if(!firebase.apps.length)firebase.initializeApp(firebaseConfig);

firebase.firestore().settings({
  experimentalForceLongPolling: true,
  useFetchStreams: false
});

const db=firebase.firestore();
const storage=firebase.storage();

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
  escapeLabyrinthTab:"home",
  isAdmin:false,

  unsubscribeParties:null,
  unsubscribeMeta:null,
  unsubscribeRanking:null,

  unsubscribeLabyrinths:null,
  unsubscribeLabyrinthStages:null,
  unsubscribeLabyrinthPlayer:null,
  unsubscribeLabyrinthPlayers:null,
  unsubscribeTurtleSoups:null,
  unsubscribeTurtleComments:null,
  unsubscribeTurtlePlayer:null,
  unsubscribeTurtleSubmissions:null,
  unsubscribeTurtlePlayers:null,
  unsubscribeNotifications:null,

  labyrinths:[],
  labyrinthPlayerSummaryMap:{},
  currentLabyrinthId:"",
  currentLabyrinthData:null,
  currentLabyrinthStages:[],
  currentLabyrinthPlayer:null,
  currentLabyrinthPlayers:[],
  turtleSoups:[],
  currentTurtleSoupId:"",
  currentTurtleSoupData:null,
  currentTurtleComments:[],
  currentTurtlePlayer:null,
  currentTurtleSubmissions:[],
  currentTurtlePlayers:[],
  editingTurtleSoupId:"",
  answeringTurtleCommentId:"",
  isTurtleSubmitPanelOpen:false,
  editingLabyrinthId:"",
  editingStageId:"",

  notifications:[],

  parties:[],
  rearrangeProgressEntries:[],
  rearrangeRankingMap:{},
  rearrangeEntries:[],
  rearrangePublic:false,
  rearrangeInputEnabled:false,
    rearrangeView:"board",
  rearrangeAdminTab:"move",
  rearrangeBoardTab:"bear1",
  rearrangeBaselineTab:"2026-04",

  castleManageMode:false,

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
    {id:"castle_battle",name:"캐슬 전투",desc:"서버전 전략 수립용"},
    {id:"rearrange",name:"자리 재배치",desc:"자동차에서 가장 시원한 자리는? 차가운데 엌ㅋㅋ"},
    {id:"escape_labyrinth",name:"웹게임",desc:"웹에서 즐길 수 있는 게임"},
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
  eventShowAllUsersBtn:document.getElementById("eventShowAllUsersBtn"),
  createPartyBtn:document.getElementById("createPartyBtn"),
  rearrangeEditBtn:document.getElementById("rearrangeEditBtn"),
  rearrangeManageBtn:document.getElementById("rearrangeManageBtn"),
  rearrangePublicBtn:document.getElementById("rearrangePublicBtn"),
  createLabyrinthBtn:document.getElementById("createLabyrinthBtn"),
  backToLabyrinthListBtn:document.getElementById("backToLabyrinthListBtn"),

  notificationBtn:document.getElementById("notificationBtn"),
  notificationCount:document.getElementById("notificationCount"),
  notificationModal:document.getElementById("notificationModal"),
  notificationList:document.getElementById("notificationList"),

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
  firstGroupCheckbox:document.getElementById("firstGroupCheckbox"),

  castleBattleModal:document.getElementById("castleBattleModal"),
  castleInfantrySelect:document.getElementById("castleInfantrySelect"),
  castleCavalrySelect:document.getElementById("castleCavalrySelect"),
  castleArcherSelect:document.getElementById("castleArcherSelect")
};

function escapeHtml(s){
  return String(s??"")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#39;");
}

function escapeJs(s){
  return String(s??"").replace(/\\/g,"\\\\").replace(/'/g,"\\'");
}

function normalizeMembers(m){
  return Array.isArray(m)?m.filter(v=>typeof v==="string"&&v.trim()!==""):[];
}

function normalizeAssignments(v){
  return Array.isArray(v)?v.filter(x=>x&&typeof x.user==="string"&&typeof x.area==="string"):[];
}

function isHiddenTestNickname(name){
  const lowered=String(name||"").trim().toLowerCase();
  return TEST_HIDDEN_PREFIXES.some(prefix=>lowered.startsWith(String(prefix).toLowerCase()));
}

function normalizeLabyrinthText(s){
  return String(s||"").replace(/\r\n/g,"\n").trim();
}

function normalizeAnswerValue(s){
  return String(s||"").trim().toLowerCase().replace(/\s+/g," ");
}

function isLabyrinthOwner(labyrinth){
  return !!labyrinth&&labyrinth.creator===state.currentUser;
}

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
function turtleSoupsRef(){return eventRef("escape_labyrinth").collection("turtleSoups");}
function turtleSoupRef(id){return turtleSoupsRef().doc(id);}
function turtleSoupCommentsRef(id){return turtleSoupRef(id).collection("comments");}
function turtleSoupPlayersRef(id){return turtleSoupRef(id).collection("players");}
function turtleSoupPlayerRef(id,name){return turtleSoupPlayersRef(id).doc(name);}
function turtleSoupSubmissionsRef(id){return turtleSoupRef(id).collection("submissions");}

function userNotificationsRef(name){
  return db.collection("users").doc(name).collection("notifications");
}

function setTopTabs(active){
  document.querySelectorAll(".tab-btn").forEach(btn=>btn.classList.remove("active"));

  if(active==="home")document.querySelectorAll(".tab-btn")[0]?.classList.add("active");
  if(active==="viking")document.querySelectorAll(".tab-btn")[1]?.classList.add("active");
  if(active==="ruins")document.querySelectorAll(".tab-btn")[2]?.classList.add("active");
  if(active==="holy_sword")document.querySelectorAll(".tab-btn")[3]?.classList.add("active");
  if(active==="triple_alliance")document.querySelectorAll(".tab-btn")[4]?.classList.add("active");
  if(active==="castle_battle")document.querySelectorAll(".tab-btn")[5]?.classList.add("active");
  if(active==="rearrange")document.querySelectorAll(".tab-btn")[6]?.classList.add("active");
  if(active==="escape_labyrinth")document.querySelectorAll(".tab-btn")[7]?.classList.add("active");
}

function openEventMenu(){
  document.getElementById("topTabs")?.classList.add("open");
  document.getElementById("eventMenuBackdrop")?.classList.remove("hidden");
}

function closeEventMenu(){
  document.getElementById("topTabs")?.classList.remove("open");
  document.getElementById("eventMenuBackdrop")?.classList.add("hidden");
}

function toggleEventMenu(){
  const menu=document.getElementById("topTabs");
  if(menu?.classList.contains("open"))closeEventMenu();
  else openEventMenu();
}

window.openEventMenu=openEventMenu;
window.closeEventMenu=closeEventMenu;
window.toggleEventMenu=toggleEventMenu;

function updateEscapeLabyrinthHomePanels(){
  const tab=state.escapeLabyrinthTab||"home";

  const labyrinthMenuPanel=document.getElementById("labyrinthMenuPanel");
  const labyrinthRealHome=document.getElementById("labyrinthRealHome");
  const turtleMenuPanel=document.getElementById("turtleMenuPanel");
  const stackTilePanel=document.getElementById("stackTilePanel");

  labyrinthMenuPanel?.classList.add("hidden");
  labyrinthRealHome?.classList.add("hidden");
  turtleMenuPanel?.classList.add("hidden");
  stackTilePanel?.classList.add("hidden");

  if(tab==="home"){
    labyrinthMenuPanel?.classList.remove("hidden");
  }else if(tab==="labyrinth"){
    labyrinthRealHome?.classList.remove("hidden");
  }else if(tab==="turtle"){
    turtleMenuPanel?.classList.remove("hidden");
  }else if(tab==="stackTile"){
    stackTilePanel?.classList.remove("hidden");
    window.renderStackTileScreen?.();
  }
}

function openEscapeLabyrinthMenu(tab){
  if(!["home","labyrinth","turtle","stackTile"].includes(tab)){
    tab="home";
  }

  state.escapeLabyrinthTab=tab;
  openEvent("escape_labyrinth");

  setTimeout(()=>{
    window.updateEscapeLabyrinthHomePanels?.();
  },0);
}

window.updateEscapeLabyrinthHomePanels=updateEscapeLabyrinthHomePanels;
window.openEscapeLabyrinthMenu=openEscapeLabyrinthMenu;

function updateUserBadge(){
  if(!el.myNameBtn)return;

  el.myNameBtn.textContent=state.currentUser?`${state.currentUser}${state.isAdmin?" (운영진)":""}`:"로그인 안 됨";

  if(state.isAdmin)el.adminMenuBtn?.classList.remove("hidden");
  else{
    el.adminMenuBtn?.classList.add("hidden");
    closeAdminMenu();
  }

  renderNotificationBadge();
}

function toggleAdminMenu(){
  el.adminMenu?.classList.toggle("hidden");
}

function closeAdminMenu(){
  el.adminMenu?.classList.add("hidden");
}

window.toggleAdminMenu=toggleAdminMenu;
window.closeAdminMenu=closeAdminMenu;

function syncOverlay(){
  const hasOpenModal=
    (el.userModal&&!el.userModal.classList.contains("hidden"))||
    (el.notificationModal&&!el.notificationModal.classList.contains("hidden"))||
    (el.logModal&&!el.logModal.classList.contains("hidden"))||
    (el.ruinsCreateModal&&!el.ruinsCreateModal.classList.contains("hidden"))||
    (el.rearrangeModal&&!el.rearrangeModal.classList.contains("hidden"))||
    (el.exampleImageModal&&!el.exampleImageModal.classList.contains("hidden"))||
    (el.rearrangeRankEditModal&&!el.rearrangeRankEditModal.classList.contains("hidden"))||
    (el.holySwordAreaModal&&!el.holySwordAreaModal.classList.contains("hidden"))||
    (el.castleBattleModal&&!el.castleBattleModal.classList.contains("hidden"))||
    (el.createLabyrinthModal&&!el.createLabyrinthModal.classList.contains("hidden"))||
    (el.editLabyrinthModal&&!el.editLabyrinthModal.classList.contains("hidden"))||
    (el.editStageModal&&!el.editStageModal.classList.contains("hidden"))||
    (document.getElementById("createTurtleSoupModal")&&!document.getElementById("createTurtleSoupModal").classList.contains("hidden"));

  if(!el.modalOverlay)return;

  if(hasOpenModal)el.modalOverlay.classList.remove("hidden");
  else el.modalOverlay.classList.add("hidden");
}

if(el.modalOverlay){
  el.modalOverlay.addEventListener("click",()=>{
    closeExampleImageModal();
    closeUserModal();
    closeNotificationModal();
    closeLogModal();
    closeRuinsCreateModal();
    closeRearrangeModal();
    closeRearrangeRankEditModal();
    closeHolySwordAreaModal();
    closeCastleBattleModal();
    closeCreateLabyrinthModal();
    closeEditLabyrinthModal();
    window.closeCreateTurtleSoupModal?.();
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
  if(state.unsubscribeTurtleSoups){state.unsubscribeTurtleSoups();state.unsubscribeTurtleSoups=null;}
  if(state.unsubscribeTurtleComments){state.unsubscribeTurtleComments();state.unsubscribeTurtleComments=null;}
  if(state.unsubscribeTurtlePlayer){state.unsubscribeTurtlePlayer();state.unsubscribeTurtlePlayer=null;}
  if(state.unsubscribeTurtleSubmissions){state.unsubscribeTurtleSubmissions();state.unsubscribeTurtleSubmissions=null;}
  if(state.unsubscribeTurtlePlayers){state.unsubscribeTurtlePlayers();state.unsubscribeTurtlePlayers=null;}
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

function subscribeMyNotifications(){
  if(state.unsubscribeNotifications){
    state.unsubscribeNotifications();
    state.unsubscribeNotifications=null;
  }

  if(!state.currentUser){
    state.notifications=[];
    renderNotificationBadge();
    renderNotificationList();
    return;
  }

  state.unsubscribeNotifications=userNotificationsRef(state.currentUser)
    .orderBy("createdAt","desc")
    .limit(50)
    .onSnapshot(snap=>{
      state.notifications=snap.docs.map(doc=>{
        const d=doc.data()||{};

        return{
          id:doc.id,
          type:d.type||"",
          title:d.title||"알림",
          message:d.message||"",
          soupId:d.soupId||"",
          soupTitle:d.soupTitle||"",
          read:!!d.read,
          active:d.active!==false,
targetUser:d.targetUser||"",
fromGroup:d.fromGroup||"",
toGroup:d.toGroup||"",
requestKey:d.requestKey||"",
          createdAt:d.createdAt||null
        };
      });

      renderNotificationBadge();
      renderNotificationList();
    },err=>{
      console.error(err);
    });
}

function renderNotificationBadge(){
  const btn=el.notificationBtn;
  const countEl=el.notificationCount;

  if(!btn||!countEl)return;

  if(!state.currentUser){
    btn.classList.add("hidden");
    countEl.classList.add("hidden");
    countEl.textContent="0";
    return;
  }

  btn.classList.remove("hidden");

  const unread=(state.notifications||[]).filter(v=>!v.read&&v.active!==false).length;

  if(unread>0){
    countEl.textContent=String(unread);
    countEl.classList.remove("hidden");
  }else{
    countEl.textContent="0";
    countEl.classList.add("hidden");
  }
}

async function openNotificationTarget(id){
  const item=(state.notifications||[]).find(v=>v.id===id);

  if(!item)return;

  if(!item.read){
    await markNotificationRead(id);
  }

  closeNotificationModal();

    if(item.type==="rearrange_move_request"){
    state.rearrangeView="admin";
    state.rearrangeAdminTab="move";
    await openEvent("rearrange");
    return;
  }
  
  if(item.soupId){
    state.escapeLabyrinthTab="turtle";
    await openEvent("escape_labyrinth");

    setTimeout(()=>{
      openTurtleSoupDetail(item.soupId);
    },300);
  }
}

window.openNotificationTarget=openNotificationTarget;

function renderNotificationList(){
  if(!el.notificationList)return;

  const items=(state.notifications||[]).filter(v=>v.active!==false);

  if(!items.length){
    el.notificationList.innerHTML=`<div class="notification-empty">알림이 없습니다.</div>`;
    return;
  }

  el.notificationList.innerHTML=items.map(item=>`
    <div class="notification-item ${item.read?"read":"unread"}" onclick="openNotificationTarget('${escapeJs(item.id)}')">
      <div class="notification-main">
        <div class="notification-title">
          ${escapeHtml(item.title)}
          ${item.read?"":`<span class="notification-new">NEW</span>`}
        </div>
        <div class="notification-message">${escapeHtml(item.message)}</div>
        <div class="notification-meta">
          ${item.soupTitle?`바다거북스프: ${escapeHtml(item.soupTitle)} · `:""}${escapeHtml(formatDateTime(item.createdAt))}
        </div>
      </div>
      <div class="notification-actions">
        ${item.read?"":`<button type="button" onclick="event.stopPropagation();markNotificationRead('${escapeJs(item.id)}')">읽음</button>`}
      </div>
    </div>
  `).join("");
}

function openNotificationModal(){
  renderNotificationList();
  el.notificationModal?.classList.remove("hidden");
  syncOverlay();
}

window.openNotificationModal=openNotificationModal;

function closeNotificationModal(){
  el.notificationModal?.classList.add("hidden");
  syncOverlay();
}

window.closeNotificationModal=closeNotificationModal;

async function markNotificationRead(id){
  if(!state.currentUser||!id)return;

  await userNotificationsRef(state.currentUser).doc(id).set({
    read:true,
    readAt:firebase.firestore.FieldValue.serverTimestamp()
  },{merge:true});
}

window.markNotificationRead=markNotificationRead;

async function markAllNotificationsRead(){
  if(!state.currentUser)return;

  const unread=(state.notifications||[]).filter(v=>!v.read);

  if(!unread.length)return;

  const batch=db.batch();
  const now=firebase.firestore.FieldValue.serverTimestamp();

  unread.forEach(item=>{
    batch.set(userNotificationsRef(state.currentUser).doc(item.id),{
      read:true,
      readAt:now
    },{merge:true});
  });

  await batch.commit();
}

window.markAllNotificationsRead=markAllNotificationsRead;

async function createAppNotification(targetUser,payload){
  const target=String(targetUser||"").trim();

  if(!target)return;
  if(target===state.currentUser)return;

  try{
    await userNotificationsRef(target).add({
      type:payload.type||"",
      title:payload.title||"알림",
      message:payload.message||"",
      soupId:payload.soupId||"",
      soupTitle:payload.soupTitle||"",
      read:false,
      createdAt:firebase.firestore.FieldValue.serverTimestamp()
    });
  }catch(err){
    console.error("알림 생성 실패",err);
  }
}

window.createAppNotification=createAppNotification;

function safeNotificationDocId(value){
  return String(value||"").replace(/[\/\\#?[\]]/g,"_");
}

function isNormalRearrangeMove(existingGroup,desiredGroup){
  return (
    (existingGroup==="곰1"||existingGroup==="곰2") &&
    (desiredGroup==="곰1"||desiredGroup==="곰2") &&
    existingGroup!==desiredGroup
  );
}

async function getAdminNicknames(){
  const snap=await db.collection("admins").get();
  return snap.docs.map(doc=>doc.id).filter(Boolean);
}

async function sendRearrangeMoveRequestNotification(user,existingGroup,desiredGroup){
  const admins=await getAdminNicknames();
  if(!admins.length)return;

  const requestKey=`rearrange_move_${safeNotificationDocId(user)}`;
  const message=`${user}님이 ${existingGroup}에서 ${desiredGroup}로 변경을 희망하였습니다`;
  const batch=db.batch();
  const now=firebase.firestore.FieldValue.serverTimestamp();

  admins.forEach(admin=>{
    const ref=userNotificationsRef(admin).doc(requestKey);
    batch.set(ref,{
      type:"rearrange_move_request",
      title:"자리재배치 이동 희망",
      message,
      targetUser:user,
      fromGroup:existingGroup,
      toGroup:desiredGroup,
      requestKey,
      active:true,
      read:false,
      cancelled:false,
      updatedAt:now,
      createdAt:now
    },{merge:true});
  });

  await batch.commit();
}

async function clearRearrangeMoveRequestNotification(user){
  const admins=await getAdminNicknames();
  if(!admins.length)return;

  const requestKey=`rearrange_move_${safeNotificationDocId(user)}`;
  const batch=db.batch();
  const now=firebase.firestore.FieldValue.serverTimestamp();

  admins.forEach(admin=>{
    const ref=userNotificationsRef(admin).doc(requestKey);
    batch.set(ref,{
      type:"rearrange_move_request",
      targetUser:user,
      requestKey,
      active:false,
      read:true,
      cancelled:true,
      cancelledAt:now,
      updatedAt:now
    },{merge:true});
  });

  await batch.commit();
}

async function handleRearrangeMoveNotification(user,before,after){
  const oldExisting=String(before?.existingGroup||"").trim();
  const oldDesired=String(before?.desiredGroup||"").trim();
  const newExisting=String(after?.existingGroup||"").trim();
  const newDesired=String(after?.desiredGroup||"").trim();

  const oldMove=isNormalRearrangeMove(oldExisting,oldDesired);
  const newMove=isNormalRearrangeMove(newExisting,newDesired);

  if(newMove){
    if(oldExisting!==newExisting||oldDesired!==newDesired){
      await sendRearrangeMoveRequestNotification(user,newExisting,newDesired);
    }
    return;
  }

  if(oldMove){
    await clearRearrangeMoveRequestNotification(user);
  }
}

window.handleRearrangeMoveNotification=handleRearrangeMoveNotification;

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
    wrap.innerHTML=`
      <label>소속</label>
      <select id="holySwordSideSelect">
        <option value="KOR">본연맹(KOR)</option>
        <option value="KR1">아카데미(KR1)</option>
      </select>
    `;
  }
}

function ensureRankingExtraFields(){
  if(!document.getElementById("rankEditExcludeBtnWrap")){
    const noteWrap=el.rankEditNoteInput?.parentElement;

    if(noteWrap){
      const wrap=document.createElement("div");
      wrap.className="form-group";
      wrap.id="rankEditExcludeBtnWrap";
      wrap.innerHTML=`<button type="button" id="rankEditExcludeBtn" class="text-input">목록에서 제외</button>`;
      noteWrap.insertAdjacentElement("afterend",wrap);
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

    subscribeMyNotifications();

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

    if(state.unsubscribeNotifications){
    state.unsubscribeNotifications();
    state.unsubscribeNotifications=null;
  }

  state.currentUser="";
  state.currentEventId="";
  state.isAdmin=false;
  state.parties=[];
  state.rearrangeEntries=[];
  state.rearrangeProgressEntries=[];
  state.rearrangeRankingMap={};
  state.rearrangePublic=false;
  state.castleManageMode=false;
  state.editingRuinsPartyId="";
  state.editingRearrangeRankUser="";
  state.editingHolySwordPartyId="";
  state.labyrinths=[];
  state.currentLabyrinthId="";
  state.currentLabyrinthData=null;
  state.currentLabyrinthStages=[];
  state.currentLabyrinthPlayer=null;
  state.currentLabyrinthPlayers=[];
  state.turtleSoups=[];
  state.currentTurtleSoupId="";
  state.currentTurtleSoupData=null;
  state.currentTurtleComments=[];
  state.currentTurtlePlayer=null;
  state.currentTurtleSubmissions=[];
  state.currentTurtlePlayers=[];
  state.editingTurtleSoupId="";
  state.answeringTurtleCommentId="";
  state.isTurtleSubmitPanelOpen=false;
  state.editingLabyrinthId="";
  state.editingStageId="";
  state.notifications=[];

  localStorage.removeItem("partyAppUser");
  localStorage.removeItem("partyAppEvent");

  updateUserBadge();
  updateEventActionButtons();
  renderNotificationBadge();
  renderNotificationList();
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
    renderNotificationBadge();
    showOnly("login");

    const savedUser=localStorage.getItem("partyAppUser");
    if(!savedUser)return;

    state.currentUser=savedUser;

    await ensureUserDoc(savedUser);
    await refreshAdmin();
    await ensureEventDocs();

    subscribeMyNotifications();

    const savedEvent=localStorage.getItem("partyAppEvent");

    if(savedEvent)openEvent(savedEvent);
    else goHome();
  }catch(e){
    console.error(e);
    updateUserBadge();
    updateEventActionButtons();
    renderNotificationBadge();
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
  el.homeEventCards.innerHTML=state.events.map(e=>{
    const onclick=e.id==="escape_labyrinth"
      ? `state.escapeLabyrinthTab='home';openEvent('escape_labyrinth')`
      : `openEvent('${escapeJs(e.id)}')`;

    return`
      <div class="event-card clickable-event-card" onclick="${onclick}">
        <h3>${escapeHtml(e.name)}</h3>
        <p>${escapeHtml(e.desc)}</p>
      </div>
    `;
  }).join("");
}

async function goHome(){
  closeEventMenu();  
  clearSubscriptions();

  state.currentEventId="";
  state.currentLabyrinthId="";
  state.currentLabyrinthData=null;
  state.currentLabyrinthStages=[];
  state.currentLabyrinthPlayer=null;
  state.castleManageMode=false;

  if(state.currentUser){
    subscribeMyNotifications();
  }

  localStorage.removeItem("partyAppEvent");

  setTopTabs("home");
  updateEventActionButtons();
  renderHomeEventCards();

  await renderHomeSummary();

  showOnly("home");
}

window.goHome=goHome;

function updateEventActionButtons(){
  if(
    !el.createPartyBtn||
    !el.rearrangeEditBtn||
    !el.rearrangePublicBtn||
    !el.rearrangeManageBtn||
    !el.createLabyrinthBtn||
    !el.backToLabyrinthListBtn
  )return;

  el.createPartyBtn.classList.add("hidden");
  el.rearrangeEditBtn.classList.add("hidden");
  el.rearrangePublicBtn.classList.add("hidden");
  el.rearrangeManageBtn.classList.add("hidden");
  el.createLabyrinthBtn.classList.add("hidden");
  el.backToLabyrinthListBtn.classList.add("hidden");
if(el.eventShowAllUsersBtn){
  el.eventShowAllUsersBtn.classList.toggle("hidden",state.currentEventId==="escape_labyrinth");
}

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

  if(state.currentEventId==="castle_battle"){
    el.createPartyBtn.classList.remove("hidden");
    el.createPartyBtn.textContent="캐슬 전투 신청";
    el.createPartyBtn.onclick=createParty;

    if(state.isAdmin){
      el.rearrangeEditBtn.classList.remove("hidden");
      el.rearrangeEditBtn.textContent=state.castleCreateMode?"생성 닫기":"집결 생성";
      el.rearrangeEditBtn.onclick=toggleCastleCreatePanel;

      el.rearrangeManageBtn.classList.remove("hidden");
      el.rearrangeManageBtn.textContent="초기화";
      el.rearrangeManageBtn.onclick=resetCastleBattleEvent;
    }
  }

  if(state.currentEventId==="rearrange"){
    el.rearrangeEditBtn.classList.remove("hidden");

    if(state.rearrangeInputEnabled){
      el.rearrangeEditBtn.textContent="내 재배치 정보 입력";
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
  if(el.eventShowAllUsersBtn){
    el.eventShowAllUsersBtn.classList.add("hidden");
  }

  if(state.currentTurtleSoupId){
    el.backToLabyrinthListBtn.classList.remove("hidden");
    el.backToLabyrinthListBtn.textContent="목록으로";
    el.backToLabyrinthListBtn.onclick=closeTurtleSoupDetail;

    const turtle=state.currentTurtleSoupData;

    if(turtle&&turtle.creator===state.currentUser){
      el.createLabyrinthBtn.classList.remove("hidden");
      el.createLabyrinthBtn.textContent="문제 수정";
      el.createLabyrinthBtn.onclick=()=>openCreateTurtleSoupModal(state.currentTurtleSoupId);
    }

    return;
  }

  if(state.currentLabyrinthId){
    el.backToLabyrinthListBtn.classList.remove("hidden");
    el.backToLabyrinthListBtn.textContent="목록으로";
    el.backToLabyrinthListBtn.onclick=openEscapeLabyrinthHome;
    return;
  }

  if(state.escapeLabyrinthTab==="labyrinth"){
    el.createLabyrinthBtn.classList.remove("hidden");
    el.createLabyrinthBtn.textContent="미궁 제작하기";
    el.createLabyrinthBtn.onclick=openCreateLabyrinthModal;
  }
}
}
  
async function openEvent(id){
  closeEventMenu();  
    history.pushState({app:true},"","");
  clearSubscriptions();

  if(state.currentUser){
    subscribeMyNotifications();
  }

  state.currentEventId=id;
  state.castleManageMode=false;
  state.castleCreateMode=false;
  state.castleManagingRallyId="";

  if(el.partyList){
    el.partyList.innerHTML=`<div class="empty-card">불러오는 중입니다.</div>`;
    el.partyList.classList.toggle("castle-battle-list",id==="castle_battle");
    el.partyList.classList.remove("hidden");
  }

  if(el.escapeLabyrinthScreen)el.escapeLabyrinthScreen.classList.add("hidden");
  if(el.labyrinthHomeView)el.labyrinthHomeView.classList.add("hidden");
  if(el.labyrinthDetailView)el.labyrinthDetailView.classList.add("hidden");

  localStorage.setItem("partyAppEvent",id);
  setTopTabs(id);

  const meta=state.events.find(v=>v.id===id);
  if(id==="escape_labyrinth"){
  if(state.currentTurtleSoupId||state.currentLabyrinthId){
    el.eventTitle.textContent="";
    el.eventDesc.textContent="";
  }else if(state.escapeLabyrinthTab==="labyrinth"){
    el.eventTitle.textContent="미궁";
    el.eventDesc.textContent="";
  }else if(state.escapeLabyrinthTab==="turtle"){
    el.eventTitle.textContent="바다거북스프";
    el.eventDesc.textContent="";
  }else if(state.escapeLabyrinthTab==="stackTile"){
    el.eventTitle.textContent="겹겹타일";
    el.eventDesc.textContent="";
  }else{
    el.eventTitle.textContent="웹게임";
    el.eventDesc.textContent="";
  }
}else{
  el.eventTitle.textContent=meta?meta.name:id;
  el.eventDesc.textContent=meta?meta.desc:"";
}

  updateEventActionButtons();
  showOnly("event");

if(id==="escape_labyrinth"){
  state.currentLabyrinthId="";
  state.currentLabyrinthData=null;

  state.currentTurtleSoupId="";
  state.currentTurtleSoupData=null;

  if(!["home","labyrinth","turtle","stackTile"].includes(state.escapeLabyrinthTab)){
    state.escapeLabyrinthTab="home";
  }

  if(el.partyList)el.partyList.classList.add("hidden");
  if(el.escapeLabyrinthScreen)el.escapeLabyrinthScreen.classList.remove("hidden");

  document.getElementById("turtleSoupDetailView")?.classList.add("hidden");

  subscribeEscapeLabyrinthHome();
  return;
}

  if(id==="rearrange")subscribeRearrange();
  else subscribeParties();
}

window.openEvent=openEvent;
function handleAppBack(){
  if(state.currentTurtleSoupId){
    closeTurtleSoupDetail();
    return;
  }

  if(state.currentLabyrinthId){
    openEscapeLabyrinthHome();
    return;
  }

  if(
    state.currentEventId==="escape_labyrinth" &&
    (state.escapeLabyrinthTab==="labyrinth"||state.escapeLabyrinthTab==="turtle"||state.escapeLabyrinthTab==="stackTile")
  ){
    state.escapeLabyrinthTab="home";
    updateEscapeLabyrinthHomePanels();
    updateEventActionButtons();
    return;
  }

  if(state.currentEventId){
    goHome();
    return;
  }
}

window.addEventListener("popstate",e=>{
  handleAppBack();
});

function subscribeParties(){
  clearSubscriptions();

  if(state.currentUser){
    subscribeMyNotifications();
  }

  if(
    state.currentEventId==="holy_sword"||
    state.currentEventId==="triple_alliance"||
    state.currentEventId==="castle_battle"
  ){
    state.unsubscribeRanking=rearrangeRankingRef().onSnapshot(rankingSnap=>{
      const rankingMap={};

      rankingSnap.docs.forEach(doc=>{
        const d=doc.data()||{};
        rankingMap[doc.id]={
          user:d.user||doc.id,
          power:Number(d.power||0),
          note:String(d.note||""),
          desiredGroup:String(d.desiredGroup||""),
          existingGroup:String(d.existingGroup||""),
          existingColumn:Number(d.existingColumn||0),
          excluded:!!d.excluded,
          flexApproved:!!d.flexApproved,
          flexApprovedAt:d.flexApprovedAt||null,
          flexApprovedBy:d.flexApprovedBy||""
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
          existingGroup:String(d.existingGroup||""),
          desiredGroup:String(d.desiredGroup||""),
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
        rallyName:d.rallyName||"",
        rallyCategory:d.rallyCategory||"etc",
        memberHeroes:d.memberHeroes||{},
        timeUTC:d.timeUTC||null,
        maxMembers:Number(d.maxMembers||0),
        type:d.type||"",
        isFirstGroup:!!d.isFirstGroup,
        createdAt:d.createdAt||null,

        user:d.user||doc.id,
        tg:d.tg||{},
        heroes:d.heroes||{},
        placement:d.placement||"미배치",
        updatedAt:d.updatedAt||null
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
      existingGroup:String(progress.existingGroup||ranking.existingGroup||""),
      desiredGroup:String(progress.desiredGroup||ranking.desiredGroup||"곰1"),
      existingColumn:Number(ranking.existingColumn||0),
      excluded:!!ranking.excluded,
      flexApproved:!!ranking.flexApproved,
      flexApprovedAt:ranking.flexApprovedAt||null,
      flexApprovedBy:ranking.flexApprovedBy||""
    };
  });

  state.rearrangeEntries.sort(sortRearrangeEntries);
}
function subscribeRearrange(){
  clearSubscriptions();

  if(state.currentUser){
    subscribeMyNotifications();
  }

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
  desiredGroup:String(d.desiredGroup||""),
  existingGroup:String(d.existingGroup||""),
  existingColumn:Number(d.existingColumn||0),
  excluded:!!d.excluded,
  flexApproved:!!d.flexApproved,
  flexApprovedAt:d.flexApprovedAt||null,
  flexApprovedBy:d.flexApprovedBy||""
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
    if(!!a.isFirstGroup!==!!b.isFirstGroup)return a.isFirstGroup?-1:1;

    if(a.side!==b.side)return a.side==="KOR"?-1:1;

    return getTimeValue(a.timeUTC)-getTimeValue(b.timeUTC);
  }

  if(state.currentEventId==="ruins"){
    return getTimeValue(a.timeUTC)-getTimeValue(b.timeUTC);
  }

  if(state.currentEventId==="castle_battle"){
    const rankMap=getRearrangeRankMap();
    const ra=rankMap[a.user]||999999;
    const rb=rankMap[b.user]||999999;

    if(ra!==rb)return ra-rb;

    return String(a.user).localeCompare(String(b.user),"ko");
  }

  return String(a.name).localeCompare(String(b.name),"ko");
}

function sortRearrangeEntries(a,b){
  if(b.stageMajor!==a.stageMajor)return b.stageMajor-a.stageMajor;
  if(b.stageMinor!==a.stageMinor)return b.stageMinor-a.stageMinor;

  if((Number(b.power)||0)!==(Number(a.power)||0)){
    return (Number(b.power)||0)-(Number(a.power)||0);
  }

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

function myRearrangeEntry(){
  return state.rearrangeEntries.find(v=>v.user===state.currentUser)||null;
}

function getRearrangeColumn(rank){
  if(rank<=18)return 3;
  if(rank<=28)return 1;
  if(rank<=42)return 2;
  if(rank<=60)return 4;

  return 5;
}

function getLayoutLabel(rank){
  return `${getRearrangeColumn(rank)}열`;
}

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
      if(rule.hasR45&&entry.__baseColumn>=4&&targetColumn<2)continue;

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

  if(existingColumn<currentColumn){
    return{text:`${existingColumn}→${currentColumn}`,className:"move-up"};
  }

  return{text:`${existingColumn}→${currentColumn}`,className:"move-down"};
}

function getHolySwordBadgeSrc(area){
  if(area==="마구간")return"말.png";
  if(area==="시계탑")return"모래시계.png";
  if(area==="수도원 1")return"마름모 1.png";
  if(area==="수도원 2")return"마름모 2.png";
  if(area==="수도원 3")return"마름모 3.png";
  if(area==="수도원 4")return"마름모 4.png";
  if(area==="성소 1")return"원 1.png";
  if(area==="성소 2")return"원 2.png";

  return"";
}

function renderHolySwordBadge(area,size="small"){
  const src=getHolySwordBadgeSrc(area);
  if(!src)return"";

  const cls=size==="large"?"holy-area-badge-img large":"holy-area-badge-img";

  return`<img src="${src}" alt="${escapeHtml(area)}" class="${cls}">`;
}

function renderHolySwordBadges(areas){
  if(!areas||!areas.length)return"";

  return`<span class="area-badges">${areas.map(area=>renderHolySwordBadge(area,"small")).join("")}</span>`;
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

  for(let row=1;row<=4;row++){
    for(let col=1;col<=4;col++){
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
