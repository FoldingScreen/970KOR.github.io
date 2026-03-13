
let nickname=""
let myParty=null

let allUsers=[]
let partyUsers=[]
let admins=[]

const ADMIN="병풍"


window.onload=async()=>{

const saved=localStorage.getItem("nickname")
@@ -30,12 +28,10 @@ startApp()

}


function enterLogin(e){
if(e.key==="Enter") login()
}


async function login(){

nickname=document.getElementById("nicknameInput").value
@@ -53,7 +49,6 @@ startApp()

}


function startApp(){

document.getElementById("loginPage").style.display="none"
@@ -65,12 +60,40 @@ startRealtime()

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

if(admins.includes(nickname)){
document.getElementById("adminMenu").style.display="block"
}

})

db.collection("parties").onSnapshot(render)

}

async function createParty(){

@@ -119,7 +142,6 @@ document.getElementById("partyName").value=""

}


async function joinParty(id){

if(myParty){
@@ -138,15 +160,12 @@ alert("모집완료")
return
}

if(!members.includes(nickname)){
members.push(nickname)
}

await ref.update({members})

}


async function leaveParty(id){

const ref=db.collection("parties").doc(id)
@@ -155,27 +174,20 @@ const snap=await ref.get()
const d=snap.data()
const members=d.members||[]

if(d.leader===nickname){
alert("파티장은 삭제해야함")
return
}

const newMembers=members.filter(m=>m!==nickname)

await ref.update({members:newMembers})

}


async function deleteParty(id){

if(!confirm("정말 파티를 삭제하시겠습니까?\n모든 파티원이 제거됩니다.")) return
 
if(!confirm("정말 파티를 삭제하시겠습니까?")) return

await db.collection("parties").doc(id).delete()

}


async function kickUser(partyId,user){

if(!confirm(user+" 추방하시겠습니까?")) return
@@ -186,7 +198,7 @@ const snap=await ref.get()
const d=snap.data()
const members=d.members||[]

if(d.leader!==nickname && nickname!==ADMIN){
if(d.leader!==nickname && !admins.includes(nickname)){
alert("권한 없음")
return
}
@@ -197,36 +209,6 @@ await ref.update({members:newMembers})

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


function render(snapshot){

const my=document.getElementById("myParty")
@@ -254,11 +236,9 @@ if(members.includes(nickname)) myParty=id
const sorted=[...members]

sorted.sort((a,b)=>{

if(a===d.leader) return -1
if(b===d.leader) return 1
return 0

})

const card=document.createElement("div")
@@ -272,29 +252,23 @@ else cls+=" cardOpen"
card.className=cls

let html=`<b>${d.name} (${members.length}/${d.limit})</b><br>`
 

sorted.forEach(m=>{

let line=""

if(m===nickname){

line+=`<span class="member me">`

}else{

line+=`<span class="member">`

}

if(m===d.leader) line+="👑 "

line+=`${m}`

if((d.leader===nickname || nickname===ADMIN) && m!==d.leader){
line+=m

if((d.leader===nickname || admins.includes(nickname)) && m!==d.leader){
line+=` <span class="kick" onclick="kickUser('${id}','${m}')">❌</span>`

}

line+=`</span>`
@@ -303,8 +277,6 @@ html+=line+"<br>"

})

html+=`<small>${new Date(d.created).toLocaleString()}</small>`

html+=`<div class="cardButtons">`

if(!members.includes(nickname) && members.length<d.limit)
@@ -332,41 +304,63 @@ updateDashboard(snapshot)

}


function updateDashboard(snapshot){

let partyCount=0
let totalMembers=0
let closed=0

snapshot.forEach(doc=>{

partyCount++

const d=doc.data()
const members=d.members||[]
if((d.members||[]).length>=d.limit) closed++
})

document.getElementById("dashboard").innerText=
`총 ${allUsers.length} | 참여 ${partyUsers.length} | 미참여 ${allUsers.length-partyUsers.length} | 파티 ${partyCount} | 모집완료 ${closed}`

}

totalMembers+=members.length
async function adminAction(action){

if(members.length>=d.limit) closed++
if(!admins.includes(nickname)) return

if(action==="addAdmin"){

if(nickname!=="병풍"){
alert("병풍만 운영진 지정 가능")
return
}

const target=prompt("운영진 닉네임")

if(!target) return

await db.collection("admins").doc(target).set({
created:Date.now()
})

const avg=(partyCount?(totalMembers/partyCount).toFixed(1):0)
alert("운영진 추가")

document.getElementById("dashboard").innerText=
`총 ${allUsers.length} | 참여 ${partyUsers.length} | 미참여 ${allUsers.length-partyUsers.length}
 | 파티 ${partyCount} | 모집완료 ${closed} | 평균 ${avg}`
}

if(action==="resetParties"){

if(!confirm("모든 파티 삭제?")) return

const snap=await db.collection("parties").get()

snap.forEach(doc=>{
doc.ref.delete()
})

}

}

async function showUsers(){
function showUsers(){

const list=document.getElementById("userList")

list.innerHTML=""

const joined=[]
const notJoined=[]

@@ -375,22 +369,24 @@ if(partyUsers.includes(u)) joined.push(u)
else notJoined.push(u)
})

joined.sort()
notJoined.sort()
let html=`<div class="userGrid">`

joined.forEach(u=>{
list.innerHTML+=`<div style="color:green">● ${u}</div>`
html+=`<div style="color:green">${u}</div>`
})

notJoined.forEach(u=>{
list.innerHTML+=`<div style="color:#444">● ${u}</div>`
html+=`<div style="color:#666">${u}</div>`
})

html+=`</div>`

list.innerHTML=html

document.getElementById("userModal").style.display="block"

}


function closeUsers(){
document.getElementById("userModal").style.display="none"
}
