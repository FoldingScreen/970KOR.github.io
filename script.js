writing{variant=“standard” id=“970kor_script_full”}
import { initializeApp } from “https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js”

import {
getFirestore,
collection,
addDoc,
doc,
getDoc,
getDocs,
setDoc,
updateDoc,
deleteDoc,
onSnapshot
} from “https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js”

const firebaseConfig={
apiKey:“AIzaSyBu2RrQn8cAwwWaLtw5O8Omwn4-NzHWuc0”,
authDomain:“kor-app-fa47e.firebaseapp.com”,
projectId:“kor-app-fa47e”,
storageBucket:“kor-app-fa47e.firebasestorage.app”,
messagingSenderId:“397749083935”,
appId:“1:397749083935:web:b2bd8498b943aec5099a2a”
}

const app=initializeApp(firebaseConfig)
const db=getFirestore(app)

let nickname=””
let allUsers=[]
let partyUsers=[]
let myPartyId=null

window.login=async function(){

const name=document.getElementById(“nickname”).value

if(!name){
alert(“닉네임 입력”)
return
}

nickname=name

const ref=doc(db,“users”,name)
const snap=await getDoc(ref)

if(!snap.exists()){
await setDoc(ref,{created:Date.now()})
}

document.getElementById(“login”).style.display=“none”
document.getElementById(“main”).style.display=“block”

document.getElementById(“userLabel”).innerText=“👤 “+nickname

startRealtime()

}

window.logout=function(){
location.reload()
}

async function startRealtime(){

const usersSnap=await getDocs(collection(db,“users”))

allUsers=[]

usersSnap.forEach(u=>{
if(!u.id.startsWith(“테스트”)){
allUsers.push(u.id)
}
})

onSnapshot(collection(db,“parties”),snapshot=>{
render(snapshot)
})

}

window.createParty=async function(){

const name=document.getElementById(“partyName”).value
const limit=parseInt(document.getElementById(“limit”).value)

if(!name){
alert(“파티 이름 입력”)
return
}

const snap=await getDocs(collection(db,“parties”))

let duplicate=false
let already=false

snap.forEach(p=>{
const d=p.data()

if(d.name===name) duplicate=true
if(d.members.includes(nickname)) already=true
})

if(duplicate){
alert(“이미 존재하는 파티 이름”)
return
}

if(already){
alert(“이미 파티 참여중”)
return
}

await addDoc(collection(db,“parties”),{
name:name,
leader:nickname,
members:[nickname],
limit:limit,
created:Date.now()
})

}

async function joinParty(id){

if(myPartyId){
alert(“이미 파티 참여중”)
return
}

const ref=doc(db,“parties”,id)
const snap=await getDoc(ref)

const data=snap.data()

if(data.members.length>=data.limit){
alert(“모집 완료”)
return
}

data.members.push(nickname)

await updateDoc(ref,{
members:data.members
})

}

async function leaveParty(id){

const ref=doc(db,“parties”,id)
const snap=await getDoc(ref)

const data=snap.data()

if(data.leader===nickname){
alert(“파티장은 삭제해야 합니다”)
return
}

const members=data.members.filter(m=>m!==nickname)

await updateDoc(ref,{
members:members
})

}

async function deleteParty(id){

if(!confirm(“파티 삭제?”)) return

await deleteDoc(doc(db,“parties”,id))

}

function render(snapshot){

const myGrid=document.getElementById(“myParty”)
const openGrid=document.getElementById(“openParty”)
const closedGrid=document.getElementById(“closedParty”)

myGrid.innerHTML=””
openGrid.innerHTML=””
closedGrid.innerHTML=””

myPartyId=null

let totalUsers=new Set()

snapshot.forEach(docSnap=>{

const id=docSnap.id
const data=docSnap.data()
const members=data.members

members.forEach(m=>totalUsers.add(m))

if(members.includes(nickname)){
myPartyId=id
}

const card=document.createElement(“div”)

let cls=“partyCard”

if(members.includes(nickname)) cls+=” cardMy”
else if(members.length>=data.limit) cls+=” cardClosed”
else cls+=” cardOpen”

card.className=cls

let html=<b>${data.name}</b><br> ${members.length}/${data.limit}<br> ${members.join(", ")}<br>

if(!members.includes(nickname) && members.length<data.limit){
html+=<button onclick="joinParty('${id}')">지원</button>
}

if(members.includes(nickname) && data.leader!==nickname){
html+=<button onclick="leaveParty('${id}')">지원취소</button>
}

if(data.leader===nickname){
html+=<button onclick="deleteParty('${id}')">삭제</button>
}

card.innerHTML=html

if(members.includes(nickname)) myGrid.appendChild(card)
else if(members.length>=data.limit) closedGrid.appendChild(card)
else openGrid.appendChild(card)

})

partyUsers=[…totalUsers]

document.getElementById(“dashboard”).innerText=

“총 인원 “+allUsers.length+
“ | 참여 “+partyUsers.length+
“ | 미참여 “+(allUsers.length-partyUsers.length)

}

window.showUsers=function(){

const modal=document.getElementById(“userModal”)
const list=document.getElementById(“userList”)

list.innerHTML=””

let joined=[]
let notJoined=[]

allUsers.forEach(u=>{
if(partyUsers.includes(u)) joined.push(u)
else notJoined.push(u)
})

joined.sort()
notJoined.sort()

joined.forEach(u=>{
list.innerHTML+=<div class="userJoin">🟢 ${u}</div>
})

notJoined.forEach(u=>{
list.innerHTML+=<div class="userNot">⚫ ${u}</div>
})

modal.style.display=“block”

}

window.closeUsers=function(){
document.getElementById(“userModal”).style.display=“none”
}
