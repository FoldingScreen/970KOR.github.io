function hideEscapeLabyrinthViews(){
  el.escapeLabyrinthScreen?.classList.add("hidden");
  el.labyrinthHomeView?.classList.add("hidden");
  el.labyrinthDetailView?.classList.add("hidden");
}

function showEscapeLabyrinthRoot(){
  el.partyList?.classList.add("hidden");
  el.escapeLabyrinthScreen?.classList.remove("hidden");
}

function subscribeEscapeLabyrinthHome(){
  clearSubscriptions();

  state.currentLabyrinthId="";
  state.currentLabyrinthData=null;
  state.currentLabyrinthStages=[];
  state.currentLabyrinthPlayer=null;
  state.currentLabyrinthPlayers=[];
  state.labyrinthPlayerSummaryMap={};

  showEscapeLabyrinthRoot();
  openEscapeLabyrinthHome(true);

  state.unsubscribeLabyrinths=labyrinthsRef().onSnapshot(async snap=>{
    state.labyrinths=snap.docs.map(doc=>{
      const d=doc.data()||{};
      return{
        id:doc.id,
        title:d.title||"",
        description:d.description||"",
        creator:d.creator||"",
        isPublic:!!d.isPublic,
        isOpen:d.isOpen!==false,
        thumbnailText:d.thumbnailText||"",
        createdAt:d.createdAt||null,
        updatedAt:d.updatedAt||null,
        publishedAt:d.publishedAt||null
      };
    }).sort((a,b)=>getTimeValue(b.updatedAt||b.createdAt)-getTimeValue(a.updatedAt||a.createdAt));

    const summaryMap={};

    await Promise.all(state.labyrinths.map(async lab=>{
      try{
        const [playersSnap,stagesSnap]=await Promise.all([
          labyrinthPlayersRef(lab.id).get(),
          labyrinthStagesRef(lab.id).get()
        ]);

        const activeStages=stagesSnap.docs
          .map(doc=>({id:doc.id,...(doc.data()||{})}))
          .filter(stage=>stage.isActive!==false)
          .map(stage=>({
            order:Number(stage.order||0),
            type:stage.type||"question"
          }))
          .sort((a,b)=>a.order-b.order);

        const finalStage=
          activeStages.find(v=>v.type==="final")||
          [...activeStages].sort((a,b)=>b.order-a.order)[0]||
          null;

        let isCleared=false;
        let isPlaying=false;

        playersSnap.forEach(doc=>{
          const d=doc.data()||{};
          const nickname=d.nickname||doc.id;

          if(nickname===state.currentUser){
            if(finalStage&&d.stageClearedAtMap?.[String(finalStage.order)]){
              isCleared=true;
            }else if(Number(d.currentStageOrder||0)>=0){
              isPlaying=true;
            }
          }
        });

        summaryMap[lab.id]={
          isCleared,
          isPlaying:!isCleared&&isPlaying
        };
      }catch(err){
        console.error(err);
        summaryMap[lab.id]={isCleared:false,isPlaying:false};
      }
    }));

    state.labyrinthPlayerSummaryMap=summaryMap;

    if(state.currentLabyrinthId){
      const found=state.labyrinths.find(v=>v.id===state.currentLabyrinthId)||null;
      state.currentLabyrinthData=found;

      if(!found){
        alert("해당 미궁을 찾을 수 없습니다.");
        openEscapeLabyrinthHome();
        return;
      }
    }

    if(state.currentLabyrinthId)renderLabyrinthDetail();
    else renderLabyrinthHome();
  },err=>{
    console.error(err);
    alert("미궁 목록을 불러오는 중 오류가 발생했습니다.");
  });
}

function openEscapeLabyrinthHome(skipResubscribe=false){
  state.currentLabyrinthId="";
  state.currentLabyrinthData=null;
  state.currentLabyrinthStages=[];
  state.currentLabyrinthPlayer=null;

  if(state.unsubscribeLabyrinthStages){
    state.unsubscribeLabyrinthStages();
    state.unsubscribeLabyrinthStages=null;
  }

  if(state.unsubscribeLabyrinthPlayer){
    state.unsubscribeLabyrinthPlayer();
    state.unsubscribeLabyrinthPlayer=null;
  }

  if(state.unsubscribeLabyrinthPlayers){
    state.unsubscribeLabyrinthPlayers();
    state.unsubscribeLabyrinthPlayers=null;
  }

  showEscapeLabyrinthRoot();

  el.labyrinthHomeView?.classList.remove("hidden");
  el.labyrinthDetailView?.classList.add("hidden");

  updateEventActionButtons();

  if(!skipResubscribe)renderLabyrinthHome();
}

window.openEscapeLabyrinthHome=openEscapeLabyrinthHome;

function renderLabyrinthHome(){
  if(!el.publicLabyrinthList||!el.myLabyrinthList)return;

  const publicItems=state.labyrinths.filter(v=>v.isPublic&&v.isOpen);
  const myItems=state.labyrinths.filter(v=>v.creator===state.currentUser);

  el.publicLabyrinthList.innerHTML=publicItems.length
    ? publicItems.map(renderLabyrinthCard).join("")
    : `<div class="labyrinth-empty">공개된 미궁이 없습니다.</div>`;

  el.myLabyrinthList.innerHTML=myItems.length
    ? myItems.map(renderLabyrinthCard).join("")
    : `<div class="labyrinth-empty">아직 만든 미궁이 없습니다.<br>상단의 "미궁 제작하기" 버튼으로 시작하세요.</div>`;
}

function renderLabyrinthCard(item){
  const mine=item.creator===state.currentUser;
  const statusClass=item.isPublic?(item.isOpen?"public":"closed"):"private";
  const statusText=item.isPublic?(item.isOpen?"공개":"공개중지"):"비공개";
  const desc=item.thumbnailText||item.description||"미궁 설명이 없습니다.";
  const publishedTime=getTimeValue(item.publishedAt);
const isNew=item.isPublic&&publishedTime>0&&(Date.now()-publishedTime)<=7*24*60*60*1000;

  const progress=state.labyrinthPlayerSummaryMap?.[item.id]||{isCleared:false,isPlaying:false};
  const progressBadge=progress.isCleared
    ? `<span class="labyrinth-status-badge public">완료</span>`
    : progress.isPlaying
      ? `<span class="labyrinth-status-badge private">플레이중</span>`
      : "";

  return`
    <div class="labyrinth-card">
      <div class="labyrinth-card-top">
        <h3 class="labyrinth-card-title">
          ${escapeHtml(item.title||"제목 없음")}
          ${isNew?`<span class="labyrinth-new-badge">NEW</span>`:""}
        </h3>
        <div class="labyrinth-inline-status">
          <span class="labyrinth-status-badge ${statusClass}">${escapeHtml(statusText)}</span>
          ${progressBadge}
        </div>
      </div>
      <div class="labyrinth-card-description">${escapeHtml(desc)}</div>
      <div class="labyrinth-card-meta">
        <div>제작자: ${escapeHtml(item.creator||"-")}</div>
        <div>수정: ${formatDateTime(item.updatedAt||item.createdAt)}</div>
      </div>
      <div class="labyrinth-card-actions">
        <button onclick="openLabyrinthDetail('${escapeJs(item.id)}')">입장</button>
        ${mine?`<button onclick="openEditLabyrinthModal('${escapeJs(item.id)}')">수정</button>`:""}
      </div>
    </div>
  `;
}

function openCreateLabyrinthModal(){
  if(!state.currentUser){
    alert("로그인 후 이용할 수 있습니다.");
    return;
  }

  el.labyrinthTitleInput.value="";
  el.labyrinthDescriptionInput.value="";
  el.labyrinthThumbnailTextInput.value="";
  el.labyrinthPublicCheckbox.checked=false;
  el.labyrinthOpenCheckbox.checked=true;

  el.createLabyrinthModal.classList.remove("hidden");
  syncOverlay();
}

function closeCreateLabyrinthModal(){
  el.createLabyrinthModal?.classList.add("hidden");
  syncOverlay();
}

window.openCreateLabyrinthModal=openCreateLabyrinthModal;
window.closeCreateLabyrinthModal=closeCreateLabyrinthModal;

async function submitCreateLabyrinth(){
  const title=normalizeLabyrinthText(el.labyrinthTitleInput.value);
  const description=normalizeLabyrinthText(el.labyrinthDescriptionInput.value);
  const thumbnailText=normalizeLabyrinthText(el.labyrinthThumbnailTextInput.value);
  const isPublic=!!el.labyrinthPublicCheckbox.checked;
  const isOpen=!!el.labyrinthOpenCheckbox.checked;

  if(!title){
    alert("미궁 제목을 입력하세요.");
    return;
  }

  const now=firebase.firestore.FieldValue.serverTimestamp();

const payload={
  title,
  description,
  thumbnailText,
  creator:state.currentUser,
  isPublic,
  isOpen,
  createdAt:now,
  updatedAt:now
};

if(isPublic){
  payload.publishedAt=now;
}

const ref=await labyrinthsRef().add(payload);

  closeCreateLabyrinthModal();
  openLabyrinthDetail(ref.id);
}

window.submitCreateLabyrinth=submitCreateLabyrinth;

function openEditLabyrinthModal(id){
  const item=state.labyrinths.find(v=>v.id===id);

  if(!item){
    alert("미궁을 찾을 수 없습니다.");
    return;
  }

  if(!isLabyrinthOwner(item)){
    alert("수정 권한이 없습니다.");
    return;
  }

  state.editingLabyrinthId=id;

  el.editLabyrinthTitleInput.value=item.title||"";
  el.editLabyrinthDescriptionInput.value=item.description||"";
  el.editLabyrinthThumbnailTextInput.value=item.thumbnailText||"";
  el.editLabyrinthPublicCheckbox.checked=!!item.isPublic;
  el.editLabyrinthOpenCheckbox.checked=!!item.isOpen;

  el.editLabyrinthModal.classList.remove("hidden");
  syncOverlay();
}

function closeEditLabyrinthModal(){
  state.editingLabyrinthId="";
  el.editLabyrinthModal?.classList.add("hidden");
  syncOverlay();
}

window.openEditLabyrinthModal=openEditLabyrinthModal;
window.closeEditLabyrinthModal=closeEditLabyrinthModal;

async function submitEditLabyrinth(){
  const id=state.editingLabyrinthId;
  const item=state.labyrinths.find(v=>v.id===id);

  if(!item){
    alert("미궁을 찾을 수 없습니다.");
    return;
  }

  if(!isLabyrinthOwner(item)){
    alert("수정 권한이 없습니다.");
    return;
  }

  const title=normalizeLabyrinthText(el.editLabyrinthTitleInput.value);
  const description=normalizeLabyrinthText(el.editLabyrinthDescriptionInput.value);
  const thumbnailText=normalizeLabyrinthText(el.editLabyrinthThumbnailTextInput.value);

  if(!title){
    alert("미궁 제목을 입력하세요.");
    return;
  }

  const nextIsPublic=!!el.editLabyrinthPublicCheckbox.checked;
const now=firebase.firestore.FieldValue.serverTimestamp();

const payload={
  title,
  description,
  thumbnailText,
  isPublic:nextIsPublic,
  isOpen:!!el.editLabyrinthOpenCheckbox.checked,
  updatedAt:now
};

if(nextIsPublic&&!item.publishedAt){
  payload.publishedAt=now;
}

await labyrinthRef(id).set(payload,{merge:true});

  closeEditLabyrinthModal();
}

window.submitEditLabyrinth=submitEditLabyrinth;

function openLabyrinthDetail(id){
  const item=state.labyrinths.find(v=>v.id===id);

  if(!item){
    alert("미궁을 찾을 수 없습니다.");
    return;
  }

  if(!item.isPublic&&item.creator!==state.currentUser){
    alert("비공개 미궁입니다.");
    return;
  }

  state.currentLabyrinthId=id;
  state.currentLabyrinthData=item;
  state.currentLabyrinthStages=[];
  state.currentLabyrinthPlayer=null;
  state.currentLabyrinthPlayers=[];

  if(state.unsubscribeLabyrinthStages){
    state.unsubscribeLabyrinthStages();
    state.unsubscribeLabyrinthStages=null;
  }

  if(state.unsubscribeLabyrinthPlayer){
    state.unsubscribeLabyrinthPlayer();
    state.unsubscribeLabyrinthPlayer=null;
  }

  if(state.unsubscribeLabyrinthPlayers){
    state.unsubscribeLabyrinthPlayers();
    state.unsubscribeLabyrinthPlayers=null;
  }

  showEscapeLabyrinthRoot();

  el.labyrinthHomeView?.classList.add("hidden");
  el.labyrinthDetailView?.classList.remove("hidden");

  updateEventActionButtons();

  state.unsubscribeLabyrinthStages=labyrinthStagesRef(id).onSnapshot(snap=>{
    state.currentLabyrinthStages=snap.docs.map(doc=>{
      const d=doc.data()||{};

      return{
        id:doc.id,
        order:Number(d.order||0),
        title:d.title||"",
        story:d.story||"",
        question:d.question||"",
        answer:d.answer||"",
        type:d.type||"question",
        placeholder:d.placeholder||"",
        successMessage:d.successMessage||"",
        contentHtml:d.contentHtml||"",
        isActive:d.isActive!==false,
        createdAt:d.createdAt||null,
        updatedAt:d.updatedAt||null
      };
    }).sort((a,b)=>a.order-b.order);

    renderLabyrinthDetail();
  },err=>{
    console.error(err);
    alert("단계 정보를 불러오는 중 오류가 발생했습니다.");
  });

  state.unsubscribeLabyrinthPlayer=labyrinthPlayerRef(id,state.currentUser).onSnapshot(doc=>{
    state.currentLabyrinthPlayer=doc.exists?(doc.data()||null):null;
    renderLabyrinthDetail();
  },err=>{
    console.error(err);
    alert("진행 정보를 불러오는 중 오류가 발생했습니다.");
  });

  state.unsubscribeLabyrinthPlayers=labyrinthPlayersRef(id).onSnapshot(snap=>{
    state.currentLabyrinthPlayers=snap.docs.map(doc=>{
      const d=doc.data()||{};

      return{
        nickname:d.nickname||doc.id,
        currentStageOrder:Number(d.currentStageOrder||0),
        clearedStageOrders:Array.isArray(d.clearedStageOrders)?d.clearedStageOrders.map(Number):[],
        stageEnteredAtMap:d.stageEnteredAtMap||{},
        stageClearedAtMap:d.stageClearedAtMap||{},
        createdAt:d.createdAt||null,
        updatedAt:d.updatedAt||null
      };
    });

    renderLabyrinthDetail();
  },err=>{
    console.error(err);
    alert("참여자 정보를 불러오는 중 오류가 발생했습니다.");
  });
}

window.openLabyrinthDetail=openLabyrinthDetail;

function renderFinalStageClearersCard(){
  const activeStages=state.currentLabyrinthStages.filter(v=>v.isActive);
  if(!activeStages.length)return"";

  const finalStage=
    activeStages.find(v=>v.type==="final")||
    [...activeStages].sort((a,b)=>b.order-a.order)[0];

  if(!finalStage)return"";

  const clearers=(state.currentLabyrinthPlayers||[])
    .filter(player=>{
      const clearedAt=player?.stageClearedAtMap?.[String(finalStage.order)];
      if(!clearedAt)return false;
      return player.nickname!==state.currentLabyrinthData?.creator;
    })
    .sort((a,b)=>{
      const aTime=a.stageClearedAtMap?.[String(finalStage.order)]||null;
      const bTime=b.stageClearedAtMap?.[String(finalStage.order)]||null;
      return getTimeValue(aTime)-getTimeValue(bTime);
    });

  if(!clearers.length){
    return`
      <div class="party-card">
        <div class="party-sub">아직 명예의 전당에 오른 사람이 없습니다.</div>
      </div>
    `;
  }

  const lines=clearers.map((player,idx)=>{
    const clearedAt=player.stageClearedAtMap?.[String(finalStage.order)]||null;
    const rankText=idx===0?"1위":idx===1?"2위":idx===2?"3위":`${idx+1}위`;

    return`<div class="labyrinth-player-line"><b>${rankText}</b> ${escapeHtml(player.nickname)}(${escapeHtml(formatDateTime(clearedAt))})</div>`;
  }).join("");

  return`
    <div class="party-card">
      <div class="member-list">${lines}</div>
    </div>
  `;
}

function sanitizeLabyrinthContentHtml(html){
  const wrap=document.createElement("div");
  wrap.innerHTML=String(html||"");

  const allowedTags=new Set(["DIV","P","BR","B","STRONG","I","EM","U","IMG"]);
  const walker=document.createTreeWalker(wrap,NodeFilter.SHOW_ELEMENT,null);
  const removeTargets=[];

  while(walker.nextNode()){
    const node=walker.currentNode;

    if(!allowedTags.has(node.tagName)){
      removeTargets.push(node);
      continue;
    }

    [...node.attributes].forEach(attr=>{
      const name=attr.name.toLowerCase();

      if(node.tagName==="IMG"&&(name==="src"||name==="alt"||name==="data-path")){
        return;
      }

      node.removeAttribute(attr.name);
    });

    if(node.tagName==="IMG"){
      node.className="labyrinth-content-image";
    }
  }

  removeTargets.forEach(node=>{
    const text=document.createTextNode(node.textContent||"");
    node.replaceWith(text);
  });

  return wrap.innerHTML.trim();
}

function makeLabyrinthLegacyHtml(stage){
  const parts=[];

  if(stage.story){
    parts.push(`<p>${escapeHtml(stage.story).replace(/\n/g,"<br>")}</p>`);
  }

  if(stage.question){
    parts.push(`<p>${escapeHtml(stage.question).replace(/\n/g,"<br>")}</p>`);
  }

  return parts.join("");
}

function getLabyrinthContentHtml(stage){
  const html=sanitizeLabyrinthContentHtml(stage.contentHtml||"");
  if(html)return html;

  return sanitizeLabyrinthContentHtml(makeLabyrinthLegacyHtml(stage));
}

function renderLabyrinthContent(stage){
  const html=getLabyrinthContentHtml(stage);

  if(html){
    return`<div class="labyrinth-content-view">${html}</div>`;
  }

  return"";
}

function getAcceptedLabyrinthAnswers(answerText){
  return String(answerText||"")
    .split(/[,;\n/]+/)
    .map(v=>normalizeAnswerValue(v))
    .filter(Boolean);
}

function isCorrectLabyrinthAnswer(inputValue,answerText){
  const value=normalizeAnswerValue(inputValue);
  const accepted=getAcceptedLabyrinthAnswers(answerText);

  return accepted.includes(value);
}

function setupLabyrinthEditor(){
  const editor=document.getElementById("stageContentEditor");
  const imageInput=document.getElementById("stageContentImageInput");

  if(!editor||!imageInput)return;

  imageInput.onchange=async ()=>{
    const file=imageInput.files&&imageInput.files[0];
    imageInput.value="";

    if(!file)return;

    if(!file.type.startsWith("image/")){
      alert("이미지 파일만 업로드할 수 있습니다.");
      return;
    }

    if(file.size>3*1024*1024){
      alert("이미지는 3MB 이하만 업로드하세요.");
      return;
    }

    const item=state.currentLabyrinthData;
    if(!item){
      alert("미궁 정보를 찾을 수 없습니다.");
      return;
    }

    const safeName=file.name.replace(/[^\w.\-가-힣]/g,"_");
    const path=`labyrinths/${item.id}/editor/${Date.now()}-${safeName}`;
    const ref=storage.ref().child(path);

    await ref.put(file);
    const url=await ref.getDownloadURL();

    insertImageIntoLabyrinthEditor(url,path);
  };
}

function insertImageIntoLabyrinthEditor(url,path){
  const editor=document.getElementById("stageContentEditor");
  if(!editor)return;

  editor.focus();

  const img=document.createElement("img");
  img.src=url;
  img.alt="문제 이미지";
  img.dataset.path=path||"";
  img.className="labyrinth-content-image";

  const selection=window.getSelection();
  if(selection&&selection.rangeCount>0&&editor.contains(selection.anchorNode)){
    const range=selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(img);

    const br=document.createElement("br");
    img.after(br);

    range.setStartAfter(br);
    range.setEndAfter(br);
    selection.removeAllRanges();
    selection.addRange(range);
  }else{
    editor.appendChild(img);
    editor.appendChild(document.createElement("br"));
  }
}

window.clearLabyrinthEditorContent=function(){
  const editor=document.getElementById("stageContentEditor");
  if(!editor)return;

  if(!confirm("본문 내용을 모두 지우시겠습니까?"))return;
  editor.innerHTML="";
};

function renderLabyrinthDetail(){
  const item=state.currentLabyrinthData;
  if(!item)return;

  el.labyrinthDetailTitle.textContent=item.title||"미궁";
  el.labyrinthDetailMeta.innerHTML=
    `제작자: ${escapeHtml(item.creator||"-")} · ${item.isPublic?"공개":"비공개"} · ${item.isOpen?"플레이 가능":"플레이 중지"}`;
  el.labyrinthDetailDescription.textContent=item.description||"설명이 없습니다.";

  const activeStages=[...state.currentLabyrinthStages]
    .filter(v=>v.isActive)
    .sort((a,b)=>a.order-b.order);

  const allStages=[...state.currentLabyrinthStages]
    .sort((a,b)=>a.order-b.order);

  const clearedOrders=Array.isArray(state.currentLabyrinthPlayer?.clearedStageOrders)
    ? state.currentLabyrinthPlayer.clearedStageOrders.map(Number)
    : [];

  const stageEnteredAtMap=state.currentLabyrinthPlayer?.stageEnteredAtMap||{};
  const stageClearedAtMap=state.currentLabyrinthPlayer?.stageClearedAtMap||{};

  const firstStage=activeStages[0]||null;
  const currentOrder=state.currentLabyrinthPlayer
    ? Number(state.currentLabyrinthPlayer.currentStageOrder||0)
    : (firstStage?firstStage.order:0);

  const currentStage=
    activeStages.find(stage=>stage.order===currentOrder)||
    activeStages.find(stage=>!clearedOrders.includes(stage.order))||
    null;

  const finalStage=
    activeStages.find(stage=>stage.type==="final")||
    [...activeStages].sort((a,b)=>b.order-a.order)[0]||
    null;

  const isClearedAll=!!finalStage&&!!stageClearedAtMap[String(finalStage.order)];
  const clearedCount=activeStages.filter(stage=>clearedOrders.includes(stage.order)).length;
  const totalCount=activeStages.length;

  el.labyrinthProgressSummary.classList.remove("hidden");

  if(isLabyrinthOwner(item)){
    el.labyrinthProgressSummary.innerHTML=`
      <div class="summary-card labyrinth-progress-main-card">
        <div class="muted">제작자 도구</div>
        <div class="labyrinth-detail-toggle-row">
          <button type="button" onclick="openEditLabyrinthModal('${escapeJs(item.id)}')">미궁 정보 수정</button>
          <button type="button" onclick="openEditStageModal()">단계 추가</button>
          <button type="button" onclick="openLabyrinthHallOfFameModal()">명예의 전당</button>
        </div>
      </div>
    `;
  }else{
    const progressCard=`
      <div class="summary-card labyrinth-progress-main-card">
        <div class="muted">내 진행률</div>
        <div class="big-number">${clearedCount}/${totalCount}</div>
        <div class="labyrinth-small-note">
          ${isClearedAll?"미궁 클리어 완료":currentStage?`현재 단계: ${escapeHtml(currentStage.title||`단계 ${currentStage.order}`)}`:"진행 가능한 단계 없음"}
        </div>
        <div class="labyrinth-detail-toggle-row">
          <button type="button" onclick="openLabyrinthHallOfFameModal()">명예의 전당</button>
        </div>
      </div>
    `;

    el.labyrinthProgressSummary.innerHTML=progressCard;
  }

  if(!activeStages.length){
    el.labyrinthStageList.innerHTML=isLabyrinthOwner(item)
      ? `<div class="labyrinth-empty">아직 단계가 없습니다.<br><br><button onclick="openEditStageModal()">첫 단계 만들기</button></div>`
      : `<div class="labyrinth-empty">아직 등록된 단계가 없습니다.</div>`;
    return;
  }

  function renderCurrentStageCard(stage){
    if(!stage){
      return`
        <div class="labyrinth-lock-card">
          ${isClearedAll?"모든 단계를 클리어했습니다.":"현재 공개된 진행 단계가 없습니다."}
        </div>
      `;
    }

    const enteredAt=stageEnteredAtMap[String(stage.order)]||null;
    const clearedAt=stageClearedAtMap[String(stage.order)]||null;
    const isCleared=clearedOrders.includes(stage.order);

    if(isClearedAll&&isCleared){
      return`
        <div class="labyrinth-stage-card cleared">
          <div class="labyrinth-stage-header">
            <h3 class="labyrinth-stage-title">${escapeHtml(stage.title||`단계 ${stage.order}`)}</h3>
            <span class="labyrinth-clear-badge">최종 클리어</span>
          </div>
          ${renderLabyrinthContent(stage)}
${renderLabyrinthStageClearSummary(stage)}
<div class="labyrinth-stage-footer">
  <div class="labyrinth-stage-meta">통과: ${formatDateTime(clearedAt)}</div>
            ${isLabyrinthOwner(item)?`<button onclick="openEditStageModal('${escapeJs(stage.id)}')">수정</button>`:""}
          </div>
        </div>
      `;
    }

     if(stage.type==="entry"||stage.type==="final"){
      const isFinal=stage.type==="final";

      return`
        <div class="labyrinth-stage-card current">
          <div class="labyrinth-stage-header">
            <h3 class="labyrinth-stage-title">${escapeHtml(stage.title||`단계 ${stage.order}`)}</h3>
            <span class="labyrinth-stage-order">${isFinal?"최종":"입장형"}</span>
          </div>
          ${renderLabyrinthContent(stage)}
          ${renderLabyrinthStageClearSummary(stage)}
<div class="labyrinth-stage-footer">
  <div class="labyrinth-stage-meta">${isFinal?"최종 단계입니다.":"현재 입장 가능한 단계입니다."}</div>
            <div class="actions">
              <button onclick="completeCurrentEntryStage(${stage.order})">${isFinal?"미궁 클리어":"입장하기"}</button>
              ${isLabyrinthOwner(item)?`<button onclick="openEditStageModal('${escapeJs(stage.id)}')">수정</button>`:""}
            </div>
          </div>
        </div>
      `;
    }

    const inputId=`labyrinthAnswerInput-${stage.order}`;

    return`
      <div class="labyrinth-stage-card current">
        <div class="labyrinth-stage-header">
          <h3 class="labyrinth-stage-title">${escapeHtml(stage.title||`단계 ${stage.order}`)}</h3>
          <span class="labyrinth-stage-order">${stage.type==="final"?"최종":"문제"}</span>
        </div>
        ${renderLabyrinthContent(stage)}
        <div class="labyrinth-stage-input-wrap">
          <input id="${inputId}" class="text-input" type="text" placeholder="${escapeHtml(stage.placeholder||"정답을 입력하세요.")}">
          <div class="actions">
            <button onclick="submitLabyrinthAnswer(${stage.order})">확인</button>
            ${isLabyrinthOwner(item)?`<button onclick="openEditStageModal('${escapeJs(stage.id)}')">수정</button>`:""}
          </div>
        </div>
        ${renderLabyrinthStageClearSummary(stage)}
<div class="labyrinth-stage-footer">
  <div class="labyrinth-stage-meta">입장 시각: ${formatDateTime(enteredAt)}</div>
        </div>
      </div>
    `;
  }

  function renderClearedHistory(){
    const clearedStages=activeStages.filter(stage=>clearedOrders.includes(stage.order));

    if(!clearedStages.length)return"";

        const items=clearedStages.map(stage=>{
      const clearedAt=stageClearedAtMap[String(stage.order)]||null;
      return`
        <div class="labyrinth-player-line">
          <b>${escapeHtml(stage.title||`단계 ${stage.order}`)}</b>
          <span class="muted"> · ${formatDateTime(clearedAt)}</span>
        </div>
      `;
    }).join("");
    
    return`
      <div class="party-card">
        <div class="party-title">통과한 단계</div>
        <div class="member-list">${items}</div>
      </div>
    `;
  }

  function renderOwnerStageManager(){
    if(!isLabyrinthOwner(item))return"";

    const items=allStages.length
      ? allStages.map(stage=>`
          <div class="labyrinth-player-line labyrinth-stage-manage-line">
            <div>
              <b>${stage.order}. ${escapeHtml(stage.title||"단계")}</b>
              <span class="muted"> · ${stage.isActive?"활성":"비활성"} · ${escapeHtml(stage.type||"question")}</span>
            </div>
            <div class="labyrinth-stage-manage-actions">
              <span class="labyrinth-stage-clear-mini">클리어 : ${getLabyrinthStageClearers(stage.order).length}명</span>
              <button class="rank-edit-btn" onclick="openLabyrinthStageClearersModal(${stage.order})">목록</button>
              <button class="rank-edit-btn" onclick="openEditStageModal('${escapeJs(stage.id)}')">수정</button>
            </div>
          </div>
        `).join("")
      : `<div class="labyrinth-empty">등록된 단계가 없습니다.</div>`;

    return`
      <div class="party-card">
        <div class="party-title">단계 관리</div>
        <div class="party-sub">제작자에게만 보입니다.</div>
        <div class="member-list">${items}</div>
      </div>
    `;
  }

  if(isLabyrinthOwner(item)){
    el.labyrinthStageList.innerHTML=renderOwnerStageManager();
    return;
  }

  el.labyrinthStageList.innerHTML=
    renderCurrentStageCard(isClearedAll?finalStage:currentStage)+
    renderClearedHistory();
}

function getLabyrinthStageClearers(order){
  const key=String(order);

  return (state.currentLabyrinthPlayers||[])
    .filter(player=>{
      if(player.nickname===state.currentLabyrinthData?.creator)return false;
      return !!player?.stageClearedAtMap?.[key];
    })
    .sort((a,b)=>{
      const aTime=a.stageClearedAtMap?.[key]||null;
      const bTime=b.stageClearedAtMap?.[key]||null;
      return getTimeValue(aTime)-getTimeValue(bTime);
    });
}

function renderLabyrinthStageClearSummary(stage){
  const clearers=getLabyrinthStageClearers(stage.order);
  const count=clearers.length;

  return`
    <div class="labyrinth-stage-clear-summary">
      <span>클리어 : ${count}명</span>
      <button type="button" onclick="openLabyrinthStageClearersModal(${stage.order})">목록</button>
    </div>
  `;
}

function ensureLabyrinthStageClearersModal(){
  let modal=document.getElementById("labyrinthStageClearersModal");

  if(modal)return modal;

  modal=document.createElement("div");
  modal.id="labyrinthStageClearersModal";
  modal.className="modal hidden labyrinth-hall-modal";
  modal.innerHTML=`
    <div class="modal-header">
      <h3 id="labyrinthStageClearersTitle">클리어 명단</h3>
      <button class="close-btn" type="button" onclick="closeLabyrinthStageClearersModal()">닫기</button>
    </div>
    <div id="labyrinthStageClearersBody"></div>
  `;

  document.body.appendChild(modal);
  return modal;
}

window.openLabyrinthStageClearersModal=function(order){
  const modal=ensureLabyrinthStageClearersModal();
  const title=document.getElementById("labyrinthStageClearersTitle");
  const body=document.getElementById("labyrinthStageClearersBody");

  const stage=state.currentLabyrinthStages.find(v=>Number(v.order)===Number(order));
  const clearers=getLabyrinthStageClearers(order);

  if(title){
    title.textContent=`${stage?stage.title:`${order}단계`} 클리어 명단`;
  }

  if(body){
    body.innerHTML=clearers.length
      ? `
        <div class="member-list">
          ${clearers.map((player,idx)=>{
            const clearedAt=player.stageClearedAtMap?.[String(order)]||null;
            return`
              <div class="labyrinth-player-line">
                <b>${idx+1}위</b> ${escapeHtml(player.nickname)}
                <span class="muted">(${escapeHtml(formatDateTime(clearedAt))})</span>
              </div>
            `;
          }).join("")}
        </div>
      `
      : `<div class="party-sub">아직 이 단계를 클리어한 사람이 없습니다.</div>`;
  }

  modal.classList.remove("hidden");
  el.modalOverlay?.classList.remove("hidden");
};

window.closeLabyrinthStageClearersModal=function(){
  const modal=document.getElementById("labyrinthStageClearersModal");
  modal?.classList.add("hidden");
  syncOverlay();
};

function ensureLabyrinthHallModal(){
  let modal=document.getElementById("labyrinthHallModal");

  if(modal)return modal;

  modal=document.createElement("div");
  modal.id="labyrinthHallModal";
  modal.className="modal hidden labyrinth-hall-modal";
  modal.innerHTML=`
    <div class="modal-header">
      <h3>명예의 전당</h3>
      <button class="close-btn" type="button" onclick="closeLabyrinthHallOfFameModal()">닫기</button>
    </div>
    <div id="labyrinthHallModalBody"></div>
  `;

  document.body.appendChild(modal);
  return modal;
}

window.openLabyrinthHallOfFameModal=function(){
  const modal=ensureLabyrinthHallModal();
  const body=document.getElementById("labyrinthHallModalBody");

  if(body)body.innerHTML=renderFinalStageClearersCard();

  modal.classList.remove("hidden");
  el.modalOverlay?.classList.remove("hidden");
};

window.closeLabyrinthHallOfFameModal=function(){
  const modal=document.getElementById("labyrinthHallModal");
  modal?.classList.add("hidden");
  syncOverlay();
};

window.toggleLabyrinthMakerTools=function(){
  state.labyrinthMakerOpen=!state.labyrinthMakerOpen;
  renderLabyrinthDetail();
};

function updateStageTypeFields(){
  const type=String(el.stageTypeSelect?.value||"question");
  const isQuestion=type==="question";

  const answerWrap=document.getElementById("stageAnswerWrap");
  const placeholderWrap=document.getElementById("stagePlaceholderWrap");

  answerWrap?.classList.toggle("hidden",!isQuestion);
  placeholderWrap?.classList.toggle("hidden",!isQuestion);

  if(!isQuestion){
    if(el.stageAnswerInput)el.stageAnswerInput.value="";
    if(el.stagePlaceholderInput)el.stagePlaceholderInput.value="";
  }
}

window.updateStageTypeFields=updateStageTypeFields;

if(el.stageTypeSelect){
  el.stageTypeSelect.addEventListener("change",updateStageTypeFields);
}

function openEditStageModal(stageId=""){
  const item=state.currentLabyrinthData;
  if(!item||!isLabyrinthOwner(item)){
    alert("단계 수정 권한이 없습니다.");
    return;
  }

  state.editingStageId=stageId||"";

  if(stageId){
    const stage=state.currentLabyrinthStages.find(v=>v.id===stageId);
    if(!stage){
      alert("단계를 찾을 수 없습니다.");
      return;
    }

    el.editStageModalTitle.textContent="단계 수정";
    el.stageOrderInput.value=String(stage.order);
    el.stageTitleInput.value=stage.title||"";
    el.stageTypeSelect.value=stage.type||"question";
    updateStageTypeFields();
    el.stageStoryInput.value="";
el.stageQuestionInput.value="";
setTimeout(()=>{
  const editor=document.getElementById("stageContentEditor");
  if(editor)editor.innerHTML=getLabyrinthContentHtml(stage);
  setupLabyrinthEditor();
},0);
    el.stageAnswerInput.value=stage.answer||"";
    el.stagePlaceholderInput.value=stage.placeholder||"";
    el.stageSuccessMessageInput.value=stage.successMessage||"";
    el.stageActiveCheckbox.checked=!!stage.isActive;
    el.deleteStageBtn.classList.remove("hidden");
  }else{
    el.editStageModalTitle.textContent="단계 추가";
    el.stageOrderInput.value=String(state.currentLabyrinthStages.length);
    el.stageTitleInput.value="";
    el.stageTypeSelect.value="question";
    updateStageTypeFields();
    el.stageStoryInput.value="";
    el.stageQuestionInput.value="";
    setTimeout(()=>{
  const editor=document.getElementById("stageContentEditor");
  if(editor)editor.innerHTML="";
  setupLabyrinthEditor();
},0);
    el.stageAnswerInput.value="";
    el.stagePlaceholderInput.value="";
    el.stageSuccessMessageInput.value="";
    el.stageActiveCheckbox.checked=true;
    el.deleteStageBtn.classList.add("hidden");
  }

  el.editStageModal.classList.remove("hidden");
  syncOverlay();
}
window.openEditStageModal=openEditStageModal;

function closeEditStageModal(){
  state.editingStageId="";
  el.editStageModal?.classList.add("hidden");
  syncOverlay();
}
window.closeEditStageModal=closeEditStageModal;

async function submitStage(){
  const item=state.currentLabyrinthData;
  if(!item||!isLabyrinthOwner(item)){
    alert("단계 수정 권한이 없습니다.");
    return;
  }

  const order=Number(el.stageOrderInput.value);
  const title=normalizeLabyrinthText(el.stageTitleInput.value);
  const type=String(el.stageTypeSelect.value||"question");
  const story="";
const question="";
const contentHtml=sanitizeLabyrinthContentHtml(document.getElementById("stageContentEditor")?.innerHTML||"");
  const answer=normalizeLabyrinthText(el.stageAnswerInput.value);
  const placeholder=normalizeLabyrinthText(el.stagePlaceholderInput.value);
  const successMessage=normalizeLabyrinthText(el.stageSuccessMessageInput.value);
  const isActive=!!el.stageActiveCheckbox.checked;

  if(!Number.isInteger(order)||order<0){
    alert("순서는 0 이상의 정수로 입력하세요.");
    return;
  }

  if(!title){
    alert("단계 제목을 입력하세요.");
    return;
  }

  if(type==="question"&&!answer){
    alert("정답을 입력하세요.");
    return;
  }

  const payload={
    order,
    title,
    type,
    story,
    question,
    contentHtml,
    answer,
    placeholder,
    successMessage,
    isActive,
    updatedAt:firebase.firestore.FieldValue.serverTimestamp()
  };

  if(state.editingStageId){
    await labyrinthStagesRef(item.id).doc(state.editingStageId).set(payload,{merge:true});
  }else{
    payload.createdAt=firebase.firestore.FieldValue.serverTimestamp();
    await labyrinthStagesRef(item.id).add(payload);
  }

  await labyrinthRef(item.id).set({updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
  closeEditStageModal();
}
window.submitStage=submitStage;

async function deleteStage(){
  const item=state.currentLabyrinthData;
  if(!item||!isLabyrinthOwner(item)){
    alert("단계 삭제 권한이 없습니다.");
    return;
  }

  if(!state.editingStageId){
    alert("삭제할 단계를 찾을 수 없습니다.");
    return;
  }

  if(!confirm("이 단계를 삭제하시겠습니까?"))return;

  await labyrinthStagesRef(item.id).doc(state.editingStageId).delete();
  await labyrinthRef(item.id).set({updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
  closeEditStageModal();
}
window.deleteStage=deleteStage;

async function completeCurrentEntryStage(order){
  const item=state.currentLabyrinthData;
  const stage=state.currentLabyrinthStages.find(v=>v.order===order&&v.isActive);
  if(!item||!stage)return;

  const stages=[...state.currentLabyrinthStages].filter(v=>v.isActive).sort((a,b)=>a.order-b.order);
  const next=stages.find(v=>v.order>order)||null;

  const currentCleared=Array.isArray(state.currentLabyrinthPlayer?.clearedStageOrders)?state.currentLabyrinthPlayer.clearedStageOrders.map(Number):[];
  if(currentCleared.includes(order))return;

  const stageEnteredAtMap={...(state.currentLabyrinthPlayer?.stageEnteredAtMap||{})};
  const stageClearedAtMap={...(state.currentLabyrinthPlayer?.stageClearedAtMap||{})};

  stageEnteredAtMap[String(order)]=firebase.firestore.FieldValue.serverTimestamp();
  stageClearedAtMap[String(order)]=firebase.firestore.FieldValue.serverTimestamp();
  if(next)stageEnteredAtMap[String(next.order)]=firebase.firestore.FieldValue.serverTimestamp();

  await labyrinthPlayerRef(item.id,state.currentUser).set({
    nickname:state.currentUser,
    currentStageOrder:next?next.order:order+1,
    clearedStageOrders:[...new Set([...currentCleared,order])].sort((a,b)=>a-b),
    stageEnteredAtMap,
    stageClearedAtMap,
    createdAt:state.currentLabyrinthPlayer?.createdAt||firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt:firebase.firestore.FieldValue.serverTimestamp()
  },{merge:true});

  if(stage.successMessage)alert(stage.successMessage);
}
window.completeCurrentEntryStage=completeCurrentEntryStage;

window.submitLabyrinthAnswer=async function(order){
  const item=state.currentLabyrinthData;
  const stage=state.currentLabyrinthStages.find(v=>v.order===order&&v.isActive);
  if(!item||!stage)return;

  const input=document.getElementById(`labyrinthAnswerInput-${order}`);
  const rawValue=input?.value||"";
const value=normalizeAnswerValue(rawValue);

  if(!value){
    alert("정답을 입력하세요.");
    input?.focus();
    return;
  }

  if(!isCorrectLabyrinthAnswer(rawValue,stage.answer||"")){
  alert("정답이 아닙니다.");
  input?.focus();
  return;
}

  const stages=[...state.currentLabyrinthStages].filter(v=>v.isActive).sort((a,b)=>a.order-b.order);
  const next=stages.find(v=>v.order>order)||null;

  const currentCleared=Array.isArray(state.currentLabyrinthPlayer?.clearedStageOrders)?state.currentLabyrinthPlayer.clearedStageOrders.map(Number):[];
  const stageEnteredAtMap={...(state.currentLabyrinthPlayer?.stageEnteredAtMap||{})};
  const stageClearedAtMap={...(state.currentLabyrinthPlayer?.stageClearedAtMap||{})};

  if(!stageEnteredAtMap[String(order)])stageEnteredAtMap[String(order)]=firebase.firestore.FieldValue.serverTimestamp();
  stageClearedAtMap[String(order)]=firebase.firestore.FieldValue.serverTimestamp();
  if(next)stageEnteredAtMap[String(next.order)]=firebase.firestore.FieldValue.serverTimestamp();

  await labyrinthPlayerRef(item.id,state.currentUser).set({
    nickname:state.currentUser,
    currentStageOrder:next?next.order:order+1,
    clearedStageOrders:[...new Set([...currentCleared,order])].sort((a,b)=>a-b),
    stageEnteredAtMap,
    stageClearedAtMap,
    createdAt:state.currentLabyrinthPlayer?.createdAt||firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt:firebase.firestore.FieldValue.serverTimestamp()
  },{merge:true});

  if(stage.successMessage)alert(stage.successMessage);
  else if(stage.type==="final"&&!next)alert("미궁을 클리어했습니다.");
};

