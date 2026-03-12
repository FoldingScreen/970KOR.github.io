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

const ADMIN="병풍"


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

if(!members.includes(nickname)){
members.push(nickname)
}

await ref.update({members})

}


async function leaveParty(id){

const ref=db.collection("parties").doc(id)
const snap=await ref.get()

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
 
await db.collection("parties").doc(id).delete()

}


async function kickUser(partyId,user){

if(!confirm(user+" 추방하시겠습니까?")) return

const ref=db.collection("parties").doc(partyId)
const snap=await ref.get()

const d=snap.data()
const members=d.members||[]

if(d.leader!==nickname && nickname!==ADMIN){
alert("권한 없음")
return
}

const newMembers=members.filter(m=>m!==user)

await ref.update({members:newMembers})

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

if(m===d.leader) line+="👑 "

if(m===nickname){
line+=`<span class="member me">${m}`
}else{
line+=`<span class="member">${m}`
}

if((d.leader===nickname || nickname===ADMIN) && m!==d.leader){

line+=` <span class="kick" onclick="kickUser('${id}','${m}')">❌</span>`

}

line+=`</span>`

html+=line+"<br>"

})

html+=`<small>${new Date(d.created).toLocaleString()}</small>`

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
let totalMembers=0
let closed=0

snapshot.forEach(doc=>{

partyCount++

const d=doc.data()
const members=d.members||[]

totalMembers+=members.length

if(members.length>=d.limit) closed++

})

const avg=(partyCount?(totalMembers/partyCount).toFixed(1):0)

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
