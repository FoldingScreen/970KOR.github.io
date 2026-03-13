const firebaseConfig = {

apiKey:"YOUR_KEY",
authDomain:"YOUR_DOMAIN",
projectId:"YOUR_PROJECT"

}

firebase.initializeApp(firebaseConfig)

const db=firebase.firestore()

let nickname=""
let myParty=null

let allUsers=[]
let admins=[]
let partyUsers=[]

window.onload=()=>{

const saved=localStorage.getItem("nickname")

if(saved){

nickname=saved
startApp()

}

}

function login(){

nickname=document.getElementById("nicknameInput").value.trim()

if(!nickname){

alert("닉네임 입력")
return

}

localStorage.setItem("nickname",nickname)

startApp()

}

function startApp(){

document.getElementById("loginPage").style.display="none"
document.getElementById("mainPage").style.display="block"

startRealtime()

}

function logout(){

localStorage.removeItem("nickname")
location.reload()

}

function startRealtime(){

db.collection("users").onSnapshot(s=>{

allUsers=[]

s.forEach(u=>{

if(!u.id.startsWith("테스트")) allUsers.push(u.id)

})

})

db.collection("admins").onSnapshot(s=>{

admins=[]

s.forEach(doc=>{

admins.push(doc.id)

})

})

db.collection("parties").onSnapshot(render)

}

async function createParty(){

if(myParty){

alert("이미 파티 있음")
return

}

const name=document.getElementById("partyName").value
const limit=parseInt(document.getElementById("partyLimit").value)

if(!name){

alert("파티 이름")
return

}

await db.collection("parties").add({

name:name,
leader:nickname,
limit:limit,
members:[nickname],
created:Date.now()

})

document.getElementById("partyName").value=""

}

async function joinParty(id){

if(myParty){

alert("이미 파티 있음")
return

}

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

async function kickUser(partyId,user){

if(!admins.includes(nickname)){

alert("권한 없음")
return

}

const ref=db.collection("parties").doc(partyId)

await ref.update({

members:firebase.firestore.FieldValue.arrayRemove(user)

})

}

function render(snapshot){

const my=document.getElementById("myParty")
const open=document.getElementById("openParty")
const closed=document.getElementById("closedParty")

my.innerHTML=""
open.innerHTML=""
closed.innerHTML=""

myParty=null
partyUsers=[]

snapshot.forEach(doc=>{

const id=doc.id
const d=doc.data()

const members=d.members||[]

members.forEach(m=>{

if(!partyUsers.includes(m)) partyUsers.push(m)

})

if(members.includes(nickname)) myParty=id

const card=document.createElement("div")

card.className="partyCard"

let html=`<b>${d.name} (${members.length}/${d.limit})</b><br>`

members.forEach(m=>{

let line=""

if(m===nickname) line+="<span class='member me'>"
else line+="<span class='member'>"

if(m===d.leader) line+="👑 "

line+=m

if(admins.includes(nickname) && m!==d.leader){

line+=` <span class="kick" onclick="kickUser('${id}','${m}')">❌</span>`

}

line+="</span><br>"

html+=line

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

if(members.includes(nickname)) my.appendChild(card)
else if(members.length>=d.limit) closed.appendChild(card)
else open.appendChild(card)

})

updateDashboard(snapshot)

}

function updateDashboard(snapshot){

let partyCount=0
let closed=0

snapshot.forEach(doc=>{

partyCount++

const d=doc.data()

if((d.members||[]).length>=d.limit) closed++

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

if(partyUsers.includes(u)) joined.push(u)
else notJoined.push(u)

})

joined.sort()
notJoined.sort()

let html=""

joined.forEach(u=>{

html+=`<div style="color:green">${u}</div>`

})

notJoined.forEach(u=>{

html+=`<div style="color:#666">${u}</div>`

})

list.innerHTML=html

document.getElementById("userModal").style.display="block"

}

function closeUsers(){

document.getElementById("userModal").style.display="none"

}
