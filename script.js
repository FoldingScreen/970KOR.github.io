let parties = JSON.parse(localStorage.getItem("parties") || "[]")
let user = localStorage.getItem("user")

function save(){
localStorage.setItem("parties",JSON.stringify(parties))
}

function login(){

const nick = document.getElementById("nickname").value.trim()

if(!nick){
alert("닉네임 입력")
return
}

localStorage.setItem("user",nick)
user = nick

init()

}

function logout(){

localStorage.removeItem("user")
location.reload()

}

function init(){

document.getElementById("login-screen").style.display="none"
document.getElementById("main-screen").style.display="block"

document.getElementById("myName").innerText=user

render()

}

function createParty(){

const party={
id:Date.now(),
leader:user,
members:[user],
applicants:[],
max:6
}

parties.push(party)

save()

render()

}

function applyParty(id){

const party = parties.find(p=>p.id===id)

if(party.members.includes(user)) return

if(party.applicants.includes(user)){
party.applicants = party.applicants.filter(a=>a!==user)
}else{
party.applicants.push(user)
}

save()

render()

}

function approve(partyId,nick){

const party = parties.find(p=>p.id===partyId)

if(party.members.length>=party.max) return

party.members.push(nick)

party.applicants = party.applicants.filter(a=>a!==nick)

save()

render()

}

function render(){

const container = document.getElementById("partyList")

container.innerHTML=""

parties.forEach(p=>{

const card = document.createElement("div")
card.className="party-card"

const percent = (p.members.length/p.max)*100

let html=""

html+=`<div class="party-title">파티 ${p.id}</div>`

html+=`<div class="progress"><div class="bar" style="width:${percent}%"></div></div>`

p.members.forEach(m=>{

if(m===p.leader){
html+=`<div class="member leader">👑 ${m}</div>`
}else{
html+=`<div class="member">👤 ${m}</div>`
}

})

if(p.applicants.length>0){

html+=`<div class="applicant">지원자</div>`

p.applicants.forEach(a=>{

if(p.leader===user){

html+=`
<div class="applicant">
${a}
<button onclick="approve(${p.id},'${a}')">승인</button>
</div>
`

}else{

html+=`<div class="applicant">${a}</div>`

}

})

}

html+=`<div class="party-actions">`

if(p.leader!==user){

const applied = p.applicants.includes(user)

html+=`
<button onclick="applyParty(${p.id})">
${applied?"지원취소":"지원하기"}
</button>
`

}

html+=`</div>`

card.innerHTML=html

container.appendChild(card)

})

}

if(user){
init()
}
