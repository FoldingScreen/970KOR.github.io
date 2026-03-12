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

let nickname=""
let admins=[]
let myParty=null

let allUsers=[]
let partyUsers=[]

window.onload=async()=>{

const saved=localStorage.getItem("nickname")

if(saved){
nickname=saved
startApp()
}

}


function enterLogin(e){
if(e.key==="Enter") login()
}


async function login(){

nickname=document.getElementById("nicknameInput").value

if(!nickname){
alert("닉네임 입력")
return
}

localStorage.setItem("nickname",nickname)

await db.collection("users").doc(nickname).set({t:Date.now()},{merge:true})

startApp()

}


async function startApp(){

document.getElementById("loginPage").style.display="none"
document.getElementById("mainPage").style.display="block"

document.getElementById("userLabel").innerText="👤 "+nickname

const adminSnap=await db.collection("admins").get()

admins=[]

adminSnap.forEach(a=>admins.push(a.id))

if(admins.includes(nickname)){
document.getElementById("adminDropdown").style.display="block"
}

startRealtime()

}


function logout(){

localStorage.removeItem("nickname")
location.reload()

}


function toggleAdminMenu(){

const m=document.getElementById("adminMenu")

m.style.display=m.style.display==="block"?"none":"block"

}


async function createParty(){

const name=document.getElementById("partyName").value
const limit=parseInt(document.getElementById("partyLimit").value)

const snap=await db.collection("parties").get()

let duplicate=false
let already=false

snap.forEach(p=>{
const d=p.data()
if(d.name===name) duplicate=true
if(d.members.includes(nickname)) already=true
})

if(duplicate){alert("파티 이름 중복");return}
if(already){alert("이미 파티 있음");return}

const doc=await db.collection("parties").add({
name:name,
leader:nickname,
members:[nickname],
limit:limit,
created:Date.now()
})

logAction("create",doc.id)

}


async function joinParty(id){

if(myParty){alert("이미 파티 있음");return}

const ref=db.collection("parties").doc(id)
const snap=await ref.get()
const d=snap.data()

if(d.members.length>=d.limit){alert("모집완료");return}

d.members.push(nickname)

await ref.update({members:d.members})

logAction("join",id)

}


async function leaveParty(id){

const ref=db.collection("parties").doc(id)
const snap=await ref.get()
const d=snap.data()

if(d.leader===nickname){
alert("파티장은 삭제해야함")
return
}

const members=d.members.filter(m=>m!==nickname)

await ref.update({members})

logAction("leave",id)

}


async function deleteParty(id){

if(!confirm("삭제?")) return

await db.collection("parties").doc(id).delete()

logAction("delete",id)

}


function startRealtime(){

db.collection("users").onSnapshot(s=>{

allUsers=[]

s.forEach(u=>{
if(!u.id.startsWith("테스트")) allUsers.push(u.id)
})

})

db.collection("parties").onSnapshot(render)

}


function render(snapshot){

const my=document.getElementById("myParty")
const open=document.getElementById("openParty")
const closed=document.getElementById("closedParty")

my.innerHTML=""
open.innerHTML=""
closed.innerHTML=""

myParty=null

let users=new Set()

snapshot.forEach(doc=>{

const id=doc.id
const d=doc.data()

d.members.forEach(m=>users.add(m))

if(d.members.includes(nickname)) myParty=id

const card=document.createElement("div")

let cls="partyCard"

if(d.members.includes(nickname)) cls+=" cardMy"
else if(d.members.length>=d.limit) cls+=" cardClosed"
else cls+=" cardOpen"

card.className=cls

let html=`<b>${d.name}</b><br>
${d.members.length}/${d.limit}<br>
${d.members.join(",")}<br>
<small>${new Date(d.created).toLocaleString()}</small><br>`

if(!d.members.includes(nickname)&&d.members.length<d.limit)
html+=`<button onclick="joinParty('${id}')">지원</button>`

if(d.members.includes(nickname)&&d.leader!==nickname)
html+=`<button onclick="leaveParty('${id}')">취소</button>`

if(d.leader===nickname)
html+=`<button onclick="deleteParty('${id}')">삭제</button>`

card.innerHTML=html

if(d.members.includes(nickname)) my.appendChild(card)
else if(d.members.length>=d.limit) closed.appendChild(card)
else open.appendChild(card)

})

partyUsers=[...users]

updateDashboard(snapshot)

}


function updateDashboard(snapshot){

let partyCount=0
let totalMembers=0
let closed=0

snapshot.forEach(doc=>{
partyCount++
const d=doc.data()
totalMembers+=d.members.length
if(d.members.length>=d.limit) closed++
})

const avg=(partyCount? (totalMembers/partyCount).toFixed(1):0)

document.getElementById("dashboard").innerText=
`총 ${allUsers.length} | 참여 ${partyUsers.length} | 미참여 ${allUsers.length-partyUsers.length}
 | 파티 ${partyCount} | 모집완료 ${closed} | 평균 ${avg}`

}


async function showUsers(){

const list=document.getElementById("userList")

list.innerHTML=""

const joined=[]
const notJoined=[]

allUsers.forEach(u=>{
if(partyUsers.includes(u)) joined.push(u)
else notJoined.push(u)
})

joined.sort()
notJoined.sort()

joined.forEach(u=>{
list.innerHTML+=`<div style="color:green">● ${u}</div>`
})

notJoined.forEach(u=>{
list.innerHTML+=`<div style="color:#444">● ${u}</div>`
})

document.getElementById("userModal").style.display="block"

}


function closeUsers(){
document.getElementById("userModal").style.display="none"
}


async function logAction(type,party){

await db.collection("adminLogs").add({
type,
party,
user:nickname,
time:Date.now(),
undone:false
})

}


async function openLogs(){

const snap=await db.collection("adminLogs").orderBy("time","desc").get()

const list=document.getElementById("logList")

list.innerHTML=""

snap.forEach(doc=>{

const d=doc.data()

const div=document.createElement("div")

div.className="logItem"

div.innerHTML=
`${new Date(d.time).toLocaleString()} - ${d.user} - ${d.type}`

div.onclick=()=>showUndo(doc.id,d)

list.appendChild(div)

})

document.getElementById("logModal").style.display="block"

}


function closeLogs(){
document.getElementById("logModal").style.display="none"
}


function showUndo(id,data){

const btn=document.createElement("button")

btn.innerText="실행취소"

btn.className="undoBtn"

btn.onclick=()=>undoLog(id,data)

event.target.appendChild(btn)

}


async function undoLog(id,data){

alert("로그 기반 실행취소 구조 구현 가능 (확장 예정)")

await db.collection("adminLogs").doc(id).update({undone:true})

}
