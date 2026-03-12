const firebaseConfig = {

apiKey: "YOUR_KEY",
authDomain: "YOUR_DOMAIN",
projectId: "YOUR_PROJECT"

}

firebase.initializeApp(firebaseConfig)

const db = firebase.firestore()

let currentUser = ""
let currentEvent = ""


function enterLogin(e){

if(e.key==="Enter") login()

}


async function login(){

const name = document.getElementById("nicknameInput").value.trim()

if(!name) return

currentUser = name

document.getElementById("loginPage").style.display="none"
document.getElementById("eventPage").style.display="block"

document.getElementById("userLabel").innerText=name

await db.collection("users").doc(name).set({

name:name,
time:Date.now()

},{merge:true})

}


function logout(){

location.reload()

}


function openEvent(event){

currentEvent = event

document.getElementById("eventPage").style.display="none"
document.getElementById("mainPage").style.display="block"

if(event==="viking"){

document.getElementById("eventTitle").innerText="바이킹의 역습"

}

if(event==="relic"){

document.getElementById("eventTitle").innerText="유적 쟁탈"
document.getElementById("createPartyBtn").style.display="inline-block"

}

listenParties()

}


function listenParties(){

db.collection("events")
.doc(currentEvent)
.collection("parties")
.orderBy("timeUTC")
.onSnapshot(snapshot=>{

const list = document.getElementById("partyList")

list.innerHTML=""

snapshot.forEach(doc=>{

const p = doc.data()

const card = document.createElement("div")
card.className="partyCard"

let membersHTML=""

p.members.forEach(m=>{

if(m===currentUser){

membersHTML += `<div class="me">${m}</div>`

}else{

membersHTML += `<div>${m}</div>`

}

})

card.innerHTML=`

<div><b>유적명:</b> ${p.name}</div>
<div><b>시간:</b> ${p.kst}</div>
<div><b>UTC:</b> ${p.utc}</div>

<div class="partyMembers">

${membersHTML}

</div>

`

list.appendChild(card)

})

})

}


async function createRelicParty(){

const relicName = prompt("유적명")
if(!relicName) return

const month = parseInt(prompt("UTC 월"))
const day = parseInt(prompt("UTC 일"))
const hour = parseInt(prompt("UTC 시간"))

const utcDate = new Date(Date.UTC(2026, month-1, day, hour))
const kstDate = new Date(utcDate.getTime() + 9*3600000)

const kst =
`${kstDate.getMonth()+1}/${kstDate.getDate()} ${kstDate.getHours()}:00`

const utc =
`${month}/${day} ${hour}:00`

const partyRef = await db
.collection("events")
.doc("relic")
.collection("parties")
.add({

name: relicName,

members:[currentUser],

rally: currentUser,

kst: kst,

utc: utc,

timeUTC: utcDate.getTime()

})

await db.collection("adminLogs").add({

type:"create",
user:currentUser,
party:partyRef.id,
time:Date.now(),
undone:false

})

}
