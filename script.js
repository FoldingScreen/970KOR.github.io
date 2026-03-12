// firebase 설정

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

if(event==="relic"){
document.getElementById("eventTitle").innerText="유적 쟁탈"
startRelic()
}

}


// 병력 계산

function calcPower(memberCount){

let soldiers = memberCount - 1

if(soldiers <= 0) return "-"

let power = 920000 / soldiers

power = Math.floor(power / 1000) * 1000

return power.toLocaleString()

}


// 시간 포맷

function formatTime(month,day,hour){

let utc = new Date(Date.UTC(2025,month-1,day,hour))

let kst = new Date(utc.getTime()+9*3600000)

return {

utc:`${month}/${day} ${hour}:00`,
kst:`${kst.getMonth()+1}/${kst.getDate()} ${kst.getHours()}:00`

}

}


// 유적 파티 시작

function startRelic(){

db.collection("events")
.doc("relic")
.collection("parties")
.orderBy("timeUTC")
.onSnapshot(snapshot=>{

let html = `<div class="relicGrid">`

snapshot.forEach(doc=>{

let d = doc.data()

html += renderRelicCard(d)

})

html += `</div>`

document.getElementById("partyContainer").innerHTML = html

})

}


// 카드 렌더

function renderRelicCard(party){

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

<div class="relicCard">

<div class="relicTitle">
유적명: ${party.name}
</div>

<div class="relicTime">
시간: ${party.kst}
<br>
UTC ${party.utc}
</div>

<div class="relicPower">
병력수: ${calcPower(party.members.length)}명
</div>

${membersHTML}

</div>

`

}
