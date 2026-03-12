
const firebaseConfig={
apiKey:"AIzaSyBu2RrQn8cAwwWaLtw5O8Omwn4-NzHWuc0",
authDomain:"kor-app-fa47e.firebaseapp.com",
projectId:"kor-app-fa47e",
storageBucket:"kor-app-fa47e.firebasestorage.app",
messagingSenderId:"397749083935",
appId:"1:397749083935:web:b2bd8498b943aec5099a2a"
};

firebase.initializeApp(firebaseConfig);
const db=firebase.firestore();

let nickname="";
let allUsers=[];
let partyUsers=[];
let myPartyId=null;
let lastAction=null;

const ADMIN="병풍";

window.onload=function(){
const saved=localStorage.getItem("nickname");
if(saved){
nickname=saved;
document.getElementById("login").style.display="none";
document.getElementById("main").style.display="block";
document.getElementById("userLabel").innerText="👤 "+nickname;
setupAdmin();
startRealtime();
}
}

async function login(){

const name=document.getElementById("nickname").value;

if(!name){
alert("닉네임 입력");
return;
}

nickname=name;
localStorage.setItem("nickname",name);

const ref=db.collection("users").doc(name);
const snap=await ref.get();

if(!snap.exists){
await ref.set({created:Date.now()});
}

document.getElementById("login").style.display="none";
document.getElementById("main").style.display="block";

document.getElementById("userLabel").innerText="👤 "+nickname;

setupAdmin();
startRealtime();
}

function setupAdmin(){

if(nickname===ADMIN){

document.getElementById("adminMenu").innerHTML=`
<button onclick="resetParties()">전체 파티 초기화</button>
<button onclick="undo()">실행취소</button>
`;

}
}

function logout(){
localStorage.removeItem("nickname");
location.reload();
}

async function startRealtime(){

const usersSnap=await db.collection("users").get();

allUsers=[];

usersSnap.forEach(u=>{
if(!u.id.startsWith("테스트")){
allUsers.push(u.id);
}
});

db.collection("parties").onSnapshot(snapshot=>{
render(snapshot);
});
}

async function createParty(){

const name=document.getElementById("partyName").value;
const limit=parseInt(document.getElementById("limit").value);

if(!name){
alert("파티 이름 입력");
return;
}

const snap=await db.collection("parties").get();

let duplicate=false;
let already=false;

snap.forEach(p=>{

const d=p.data();

if(d.name===name) duplicate=true;
if(d.members.includes(nickname)) already=true;

});

if(duplicate){
alert("이미 존재하는 파티 이름");
return;
}

if(already){
alert("이미 파티 참여중");
return;
}

const doc=await db.collection("parties").add({
name:name,
leader:nickname,
members:[nickname],
limit:limit,
created:Date.now()
});

lastAction={type:"create",id:doc.id};
}

async function joinParty(id){

if(myPartyId){
alert("이미 파티 참여중");
return;
}

const ref=db.collection("parties").doc(id);
const snap=await ref.get();

const data=snap.data();

if(data.members.length>=data.limit){
alert("모집 완료");
return;
}

data.members.push(nickname);

await ref.update({members:data.members});

lastAction={type:"join",party:id};
}

async function leaveParty(id){

const ref=db.collection("parties").doc(id);
const snap=await ref.get();

const data=snap.data();

if(data.leader===nickname){
alert("파티장은 삭제해야 합니다");
return;
}

const members=data.members.filter(m=>m!==nickname);

await ref.update({members:members});

lastAction={type:"leave",party:id,user:nickname};
}

async function kick(party,user){

if(nickname!==ADMIN) return;

const ref=db.collection("parties").doc(party);
const snap=await ref.get();

const data=snap.data();

const members=data.members.filter(m=>m!==user);

await ref.update({members:members});
}

async function deleteParty(id){

if(!confirm("파티 삭제?")) return;

await db.collection("parties").doc(id).delete();

lastAction={type:"delete",party:id};
}

async function resetParties(){

if(!confirm("전체 파티 초기화?")) return;

const snap=await db.collection("parties").get();

snap.forEach(p=>{
db.collection("parties").doc(p.id).delete();
});
}

function undo(){

if(!lastAction){
alert("되돌릴 작업 없음");
return;
}

alert("간단 실행취소 기능 (최근 작업만)");
}

function render(snapshot){

const myGrid=document.getElementById("myParty");
const openGrid=document.getElementById("openParty");
const closedGrid=document.getElementById("closedParty");

myGrid.innerHTML="";
openGrid.innerHTML="";
closedGrid.innerHTML="";

myPartyId=null;

let totalUsers=new Set();

snapshot.forEach(docSnap=>{

const id=docSnap.id;
const data=docSnap.data();
const members=data.members;

members.forEach(m=>totalUsers.add(m));

if(members.includes(nickname)){
myPartyId=id;
}

const card=document.createElement("div");

let cls="partyCard";

if(members.includes(nickname)) cls+=" cardMy";
else if(members.length>=data.limit) cls+=" cardClosed";
else cls+=" cardOpen";

card.className=cls;

const time=new Date(data.created).toLocaleString();

let html=`
<b>${data.name}</b><br>
${members.length}/${data.limit}<br>
<small>${time}</small><br>
${members.join(", ")}<br>
`;

if(!members.includes(nickname)&&members.length<data.limit){
html+=`<button onclick="joinParty('${id}')">지원</button>`;
}

if(members.includes(nickname)&&data.leader!==nickname){
html+=`<button onclick="leaveParty('${id}')">지원취소</button>`;
}

if(data.leader===nickname){
html+=`<button onclick="deleteParty('${id}')">삭제</button>`;
}

if(nickname===ADMIN){
members.forEach(m=>{
if(m!==data.leader){
html+=`<button onclick="kick('${id}','${m}')">추방 ${m}</button>`;
}
});
}

card.innerHTML=html;

if(members.includes(nickname)) myGrid.appendChild(card);
else if(members.length>=data.limit) closedGrid.appendChild(card);
else openGrid.appendChild(card);

});

partyUsers=[...totalUsers];

document.getElementById("dashboard").innerText=
"총 인원 "+allUsers.length+
" | 참여 "+partyUsers.length+
" | 미참여 "+(allUsers.length-partyUsers.length);
}

function showUsers(){

const modal=document.getElementById("userModal");
const list=document.getElementById("userList");

list.innerHTML="";

let joined=[];
let notJoined=[];

allUsers.forEach(u=>{

if(partyUsers.includes(u)) joined.push(u);
else notJoined.push(u);

});

joined.sort();
notJoined.sort();

joined.forEach(u=>{
list.innerHTML+=`<div class="userJoin">🟢 ${u}</div>`;
});

notJoined.forEach(u=>{
list.innerHTML+=`<div class="userNot">⚫ ${u}</div>`;
});

modal.style.display="block";
}

function closeUsers(){
document.getElementById("userModal").style.display="none";
}
