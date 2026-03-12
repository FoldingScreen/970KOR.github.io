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
let myParty=null

let allUsers=[]
let partyUsers=[]
let admins=[]

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

function startApp(){

document.getElementById("loginPage").style.display="none"
document.getElementById("mainPage").style.display="block"

document.getElementById("userLabel").innerText="👤 "+nickname

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

if(admins.includes(nickname)){
document.getElementById("adminMenu").style.display="block"
}

})

db.collection("parties").onSnapshot(render)

}

async function createParty(){

const name=document.getElementById("partyName").value
const limit=parseInt(document.getElementById("partyLimit").value)

if(!name){
alert("파티 이름 입력")
return
}

const snap=await db.collection("parties").get()

let duplicate=false
let already=false

snap.forEach(p=>{

const d=p.data()
const members=d.members||[]

if(d.name===name) duplicate=true
if(members.includes(nickname)) already=true

})

if(duplicate){
alert("파티 이름 중복")
return
}

if(already){
alert("이미 파티 있음")
return
}

await db.collection("parties").add({
name:name,
leader:nickname,
members:[nickname],
limit:limit,
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
const snap=await ref.get()

const d=snap.data()
const members=d.members||[]

if(members.length>=d.limit){
alert("모집완료")
return
}

members.push(nickname)

await ref.update({members})

}

async function leaveParty(id){

const ref=db.collection("parties").doc(id)
const snap=await ref.get()

const d=snap.data()
const members=d.members||[]

const newMembers=members.filter(m=>m!==nickname)

await ref.update({members:newMembers})

}

async function deleteParty(id){

if(!confirm("정말 파티를 삭제하시겠습니까?")) return

await db.collection("parties").doc(id).delete()

}

async function kickUser(partyId,user){

if(!confirm(user+" 추방하시겠습니까?")) return

const ref=db.collection("parties").doc(partyId)
const snap=await ref.get()

const d=snap.data()
const members=d.members||[]

if(d.leader!==nickname && !admins.includes(nickname)){
alert("권한 없음")
return
}

const newMembers=members.filter(m=>m!==user)

await ref.update({members:newMembers})

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
const members=d.members||[]

members.forEach(m=>users.add(m))

if(members.includes(nickname)) myParty=id

const sorted=[...members]

sorted.sort((a,b)=>{
if(a===d.leader) return -1
if(b===d.leader) return 1
return 0
})

const card=document.createElement("div")

let cls="partyCard"

if(members.includes(nickname)) cls+=" cardMy"
else if(members.length>=d.limit) cls+=" cardClosed"
else cls+=" cardOpen"

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

line+=m

if((d.leader===nickname || admins.includes(nickname)) && m!==d.leader){
line+=` <span class="kick" onclick="kickUser('${id}','${m}')">❌</span>`
}

line+=`</span>`

html+=line+"<br>"

})

html+=`<div class="cardButtons">`

if(!members.includes(nickname) && members.length<d.limit)
html+=`<button class="btnJoin" onclick="joinParty('${id}')">지원</button>`

if(members.includes(nickname) && d.leader!==nickname)
html+=`<button class="btnLeave" onclick="leaveParty('${id}')">취소</button>`

if(d.leader===nickname)
html+=`<button class="btnDelete" onclick="deleteParty('${id}')">삭제</button>`

html+=`</div>`

card.innerHTML=html

if(members.includes(nickname)) my.appendChild(card)
else if(members.length>=d.limit) closed.appendChild(card)
else open.appendChild(card)

})

partyUsers=[...users]

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

async function adminAction(action){

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

alert("운영진 추가")

}

if(action==="resetParties"){

if(!confirm("모든 파티 삭제?")) return

const snap=await db.collection("parties").get()

snap.forEach(doc=>{
doc.ref.delete()
})

}

}

function showUsers(){

const list=document.getElementById("userList")

const joined=[]
const notJoined=[]

allUsers.forEach(u=>{
if(partyUsers.includes(u)) joined.push(u)
else notJoined.push(u)
})

let html=`<div class="userGrid">`

joined.forEach(u=>{
html+=`<div style="color:green">${u}</div>`
})

notJoined.forEach(u=>{
html+=`<div style="color:#666">${u}</div>`
})

html+=`</div>`

list.innerHTML=html

document.getElementById("userModal").style.display="block"

}

function closeUsers(){
document.getElementById("userModal").style.display="none"
}
