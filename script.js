const firebaseConfig = {
  apiKey: "AIzaSyBu2RrQn8cAwwWaLtw5O8Omwn4-NzHWuc0",
  authDomain: "kor-app-fa47e.firebaseapp.com",
  projectId: "kor-app-fa47e",
  storageBucket: "kor-app-fa47e.firebasestorage.app",
  messagingSenderId: "397749083935",
  appId: "1:397749083935:web:b2bd8498b943aec5099a2a"
};

firebase.initializeApp(firebaseConfig)

const db = firebase.firestore()

let nickname=""
let allUsers=[]
let admins=[]
let partyUsers=[]
let currentEvent=null
let unsubscribeParties=null

window.onload=()=>{

const saved=localStorage.getItem("nickname")

if(saved){

nickname=saved
startApp()

}

}

async function login(){

nickname=document.getElementById("nicknameInput").value.trim()

if(!nickname){
alert("닉네임 입력")
return
}

localStorage.setItem("nickname",nickname)

await registerUser()

startApp()

}

async function registerUser(){

const ref=db.collection("users").doc(nickname)
const doc=await ref.get()

if(!doc.exists){

await ref.set({
created:Date.now()
})

}

}

function startApp(){

document.getElementById("loginPage").style.display="none"
document.getElementById("mainPage").style.display="block"

loadUsers()
loadAdmins()
loadEvents()

}

function logout(){

localStorage.removeItem("nickname")
location.reload()

}

function loadUsers(){

db.collection("users").get().then(s=>{

allUsers=[]

s.forEach(u=>{

allUsers.push(u.id)

})

})

}

function loadAdmins(){

db.collection("admins").get().then(s=>{

admins=[]

s.forEach(a=>admins.push(a.id))

})

}

function loadEvents(){

db.collection("events").get().then(snapshot=>{

const tabs=document.getElementById("eventTabs")

tabs.innerHTML=""

snapshot.forEach(doc=>{

const e=doc.data()

const btn=document.createElement("button")
btn.innerText=e.name

btn.onclick=()=>changeEvent(doc.id,btn)

tabs.appendChild(btn)

})

})

}

function changeEvent(eventId,btn){

currentEvent=eventId

document.querySelectorAll(".tabs button")
.forEach(b=>b.classList.remove("active"))

btn.classList.add("active")

loadParties()

}

function loadParties(){

if(unsubscribeParties) unsubscribeParties()

unsubscribeParties=
db.collection("parties")
.where("event","==",currentEvent)
.onSnapshot(render)

}

async function createParty(){

if(!currentEvent){
alert("이벤트 선택")
return
}

const name=document.getElementById("partyName").value
const limit=parseInt(document.getElementById("partyLimit").value)

await db.collection("parties").add({

event:currentEvent,
name:name,
leader:nickname,
members:[nickname],
limit:limit,
created:Date.now()

})

}

async function joinParty(id){

const ref=db.collection("parties").doc(id)

await ref.update({
members:firebase.firestore.FieldValue.arrayUnion(nickname)
})

}

async function leaveParty(id){

const ref=db.collection("parties").doc(id)

await ref.update({
members:firebase.firestore.FieldValue.arrayRemove(nickname)
})

}

async function deleteParty(id){

if(!confirm("파티 삭제?")) return

await db.collection("parties").doc(id).delete()

}

function render(snapshot){

const my=document.getElementById("myParty")
const open=document.getElementById("openParty")
const closed=document.getElementById("closedParty")

my.innerHTML=""
open.innerHTML=""
closed.innerHTML=""

partyUsers=[]

snapshot.forEach(doc=>{

const id=doc.id
const d=doc.data()

const members=d.members||[]

members.forEach(m=>{
if(!partyUsers.includes(m)) partyUsers.push(m)
})

const card=document.createElement("div")

card.className="partyCard"

let html=`<b>${d.name} (${members.length}/${d.limit})</b><br>`

members.forEach(m=>{

html+=`<div class="member">${m}</div>`

})

html+=`<div class="cardButtons">`

if(!members.includes(nickname) && members.length<d.limit)
html+=`<button class="btnJoin" onclick="joinParty('${id}')">참가</button>`

if(members.includes(nickname) && d.leader!==nickname)
html+=`<button class="btnLeave" onclick="leaveParty('${id}')">탈퇴</button>`

if(d.leader===nickname)
html+=`<button class="btnDelete" onclick="deleteParty('${id}')">삭제</button>`

html+=`</div>`

card.innerHTML=html

if(members.includes(nickname))
my.appendChild(card)

else if(members.length>=d.limit)
closed.appendChild(card)

else
open.appendChild(card)

})

updateDashboard(snapshot)

}

function updateDashboard(snapshot){

let partyCount=0
let closed=0

snapshot.forEach(doc=>{

partyCount++

const d=doc.data()

if((d.members||[]).length>=d.limit)
closed++

})

document.getElementById("dashboard").innerText=

`총 ${allUsers.length} | 참여 ${partyUsers.length} | 미참여 ${allUsers.length-partyUsers.length} | 파티 ${partyCount} | 모집완료 ${closed}`

}

function showUsers(){

const list=document.getElementById("userList")

list.innerHTML=""

const joined=[]
const notJoined=[]

allUsers.forEach(u=>{

if(partyUsers.includes(u))
joined.push(u)

else
notJoined.push(u)

})

joined.sort()
notJoined.sort()

let html=""

joined.forEach(u=>html+=`<div style="color:green">${u}</div>`)
notJoined.forEach(u=>html+=`<div style="color:#666">${u}</div>`)

list.innerHTML=html

document.getElementById("userModal").style.display="block"

}

function closeUsers(){

document.getElementById("userModal").style.display="none"

}
