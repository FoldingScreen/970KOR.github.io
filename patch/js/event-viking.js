function renderVikingCard(p){
  const meJoined=p.members.includes(state.currentUser);
  const canDelete=state.isAdmin||p.createdBy===state.currentUser;
  const canKick=state.isAdmin||p.createdBy===state.currentUser;
  const maxMembers=Number(p.maxMembers||0);
  const isFull=maxMembers>0&&p.members.length>=maxMembers;

  const membersHtml=p.members.map(name=>`
    <div class="member-line">
      <span class="${name===state.currentUser?"my-name":""}">
        ${name===p.createdBy?"👑 ":""}${escapeHtml(name)}
      </span>
      ${canKick&&name!==p.createdBy?`<button class="inline-btn" onclick="kickMember('${escapeJs(p.id)}','${escapeJs(name)}')">✖</button>`:""}
    </div>
  `).join("");

  return`
    <div class="party-card">
      <div class="party-title">${escapeHtml(p.name)}</div>
      <div class="party-sub">파티장: ${escapeHtml(p.createdBy||"-")}</div>
      <div class="party-sub">인원: ${p.members.length}${maxMembers>0?`/${maxMembers}`:""}명</div>
      <div class="member-list">${membersHtml||'<div class="member-line"><span>참가자가 없습니다.</span></div>'}</div>
      <div class="card-actions">
        ${!meJoined&&!isFull?`<button onclick="joinParty('${escapeJs(p.id)}')">참가</button>`:""}
        ${meJoined?`<button onclick="leaveParty('${escapeJs(p.id)}')">취소</button>`:""}
        ${canDelete?`<button onclick="deleteParty('${escapeJs(p.id)}')">삭제</button>`:""}
      </div>
    </div>
  `;
}

async function createVikingParty(){
  const name=(prompt("파티 이름을 입력하세요.")||"").trim();
  if(!name)return;

  if(myParty()){
    alert("이미 다른 파티에 참여 중입니다.");
    return;
  }

  const maxInput=(prompt("최대 인원을 입력하세요.\n예: 6")||"").trim();
  const maxMembers=Number(maxInput);

  if(!Number.isInteger(maxMembers)||maxMembers<1){
    alert("최대 인원은 1 이상의 숫자로 입력하세요.");
    return;
  }

  const dup=await partiesRef("viking").where("name","==",name).get();
  if(!dup.empty){
    alert("같은 이름의 파티가 이미 있습니다.");
    return;
  }

  await partiesRef("viking").add({
    type:"viking",
    event:"viking",
    name,
    createdBy:state.currentUser,
    members:[state.currentUser],
    maxMembers,
    createdAt:firebase.firestore.FieldValue.serverTimestamp()
  });
}

