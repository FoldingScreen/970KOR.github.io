// Firebase 설정

const firebaseConfig = {

apiKey: "APIKEY",
authDomain: "PROJECT.firebaseapp.com",
projectId: "PROJECT"

}

firebase.initializeApp(firebaseConfig)

const db = firebase.firestore()


let nickname = ""
let currentEvent = ""


// 로그인

function login(){

nickname = document.getElementById("nicknameInput").value.trim()

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

currentEvent = event

document.getElementById("eventPage").style.display="none"
document.getElementById("mainPage").style.display="block"

document.getElementById("userLabel").innerText = nickname

if(event==="viking"){
document.getElementById("eventTitle").innerText="바이킹의 역습"
}

if(event==="relic"){
document.getElementById("eventTitle").innerText="유적 쟁탈"
}

startRealtime()

}


// 실시간 파티 읽기

function startRealtime(){

db.collection("events")
.doc(currentEvent)
.collection("parties")
.orderBy("timeUTC")
.onSnapshot(snapshot=>{

let html = `<div class="grid">`

snapshot.forEach(doc=>{

let d = doc.data()

if(currentEvent==="relic"){
html += renderRelic(d)
}

if(currentEvent==="viking"){
html += renderViking(d)
}

})

html += `</div>`

document.getElementById("partyContainer").innerHTML = html

})

}


// 병력 계산

function calcPower(memberCount){

let soldiers = memberCount - 1

if(soldiers <= 0) return "-"

let power = 920000 / soldiers

power = Math.floor(power / 1000) * 1000

return power.toLocaleString()

}


// relic 카드

function renderRelic(party){

let membersHTML=""

party.members.forEach(m=>{

let name = m

if(m===party.rally){
name="👑 "+name
}

if(m===nickname){
name=`<span class="me">${name}</span>`
}

membersHTML += `<div class="member">${name}</div>`

})

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

</div>

`

}


// viking 카드

function renderViking(party){

let membersHTML=""

party.members.forEach(m=>{

let name = m

if(m===nickname){
name=`<span class="me">${name}</span>`
}

membersHTML += `<div class="member">${name}</div>`

})

return `

<div class="card">

<div class="title">
${party.name}
</div>

${membersHTML}

</div>

`

}
