const firebaseConfig = {

apiKey:"APIKEY",
authDomain:"PROJECT.firebaseapp.com",
projectId:"PROJECT"

}

firebase.initializeApp(firebaseConfig)

const db = firebase.firestore()


let nickname=""
let currentEvent=""

const ADMINS=["병풍"]


// 로그인

function login(){

nickname=document.getElementById("nicknameInput").value.trim()

if(!nickname) return alert("닉네임 입력")

localStorage.setItem("nickname",nickname)

document.getElementById("loginPage").style.display="none"
document.getElementById("eventPage").style.display="block"

}

function enterLogin(e){

if(e.key==="Enter"){
login()
}

}


// 로그아웃

function logout(){

localStorage.removeItem("nickname")
location.reload()

}


// 이벤트 선택

function selectEvent(event){

currentEvent=event

document.getElementById("eventPage").style.display="none"
document.getElementById("mainPage").style.display="block"

document.getElementById("userLabel").innerText=nickname

if(event==="viking"){
document.getElementById("eventTitle").innerText="바이킹의 역습"
}

if(event==="relic"){
document.getElementById("eventTitle").innerText="유적 쟁탈"
}

startRealtime()

}


// 실시간 파티

function startRealtime(){

db.collection("events")
.doc(currentEvent)
.collection("parties")
.orderBy("timeUTC")
.onSnapshot(snapshot=>{

let html=`<div class="grid">`

snapshot.forEach(doc=>{

let d=doc.data()

if(currentEvent==="relic"){
html+=renderRelic(d,doc.id)
}

if(currentEvent==="viking"){
html+=renderViking(d)
}

})

html+=`</div>`

document.getElementById("partyContainer").innerHTML=html

})

}


// 병력 계산

function calcPower(memberCount){

let soldiers=memberCount-1

if(soldiers<=0) return "-"

let power=920000/soldiers

power=Math.floor(power/1000)*1000

return power.toLocaleString()

}


// relic 카드

function renderRelic(party,id){

let members=[...party.members]

if(party.rally){

members=members.filter(m=>m!==party.rally)
members.unshift(party.rally)

}

let membersHTML=""

members.forEach(m=>{

let name=m

if(m===party.rally){
name="👑 "+name
}

if(m===nickname){
name=`<span class="me">${name}</span>`
}

let controls=""

if(ADMINS.includes(nickname)){

controls+=`<span class="rallyBtn" onclick="setRally('${id}','${m}')">👍</span>`

if(m!==party.rally){

controls+=`<span class="kick" onclick="kick('${id}','${m}')">✖</span>`

}

}

membersHTML+=`<div class="member">${name} ${controls}</div>`

})

let joinBtn=""
let leaveBtn=""
let deleteBtn=""

if(!party.members.includes(nickname) && party.members.length<15){

joinBtn=`<button onclick="joinParty('${id}')">지원</button>`

}

if(party.members.includes(nickname)){

leaveBtn=`<button onclick="leaveParty('${id}')">취소</button>`

}

if(ADMINS.includes(nickname)){

deleteBtn=`<button onclick="deleteParty('${id}')">삭제</button>`

}

return `

<div class="card relicCard">

<div class="title">
유적명: ${party.name}
</div>

<div>
시간: ${party.kst}
<br>
UTC ${party.utc}
</div>

<div>
병력수: ${calcPower(party.members.length)}명
</div>

${membersHTML}

<div class="buttons">

${joinBtn}
${leaveBtn}
${deleteBtn}

</div>

</div>

`

}


// 바이킹 카드

function renderViking(party){

let html=""

party.members.forEach(m=>{

let name=m

if(m===nickname){
name=`<span class="me">${name}</span>`
}

html+=`<div class="member">${name}</div>`

})

return `

<div class="card">

<div class="title">${party.name}</div>

${html}

</div>

`

}


// 참가

async function joinParty(id){

let ref=db.collection("events")
.doc("relic")
.collection("parties")
.doc(id)

let doc=await ref.get()

let data=doc.data()

if(data.members.includes(nickname)) return

if(data.members.length>=15){

alert("파티 인원 초과")
return

}

await ref.update({

members:firebase.firestore.FieldValue.arrayUnion(nickname)

})

}


// 취소

async function leaveParty(id){

let ref=db.collection("events")
.doc("relic")
.collection("parties")
.doc(id)

await ref.update({

members:firebase.firestore.FieldValue.arrayRemove(nickname)

})

}


// 추방

async function kick(id,user){

if(!confirm(user+" 추방할까요?")) return

let ref=db.collection("events")
.doc("relic")
.collection("parties")
.doc(id)

await ref.update({

members:firebase.firestore.FieldValue.arrayRemove(user)

})

}


// 집결장 변경

async function setRally(id,user){

if(!confirm("집결장을 변경할까요?")) return

let ref=db.collection("events")
.doc("relic")
.collection("parties")
.doc(id)

await ref.update({

rally:user

})

}


// 파티 삭제

async function deleteParty(id){

if(!confirm("파티를 삭제할까요?")) return

await db.collection("events")
.doc("relic")
.collection("parties")
.doc(id)
.delete()

}
