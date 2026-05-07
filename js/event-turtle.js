function getAcceptedTurtleAnswers(answerText){
  return String(answerText||"")
    .split(/[,;\n/]+/)
    .map(v=>normalizeAnswerValue(v))
    .filter(Boolean);
}

function isCorrectTurtleAnswer(inputValue,answerText){
  const value=normalizeAnswerValue(inputValue);
  const accepted=getAcceptedTurtleAnswers(answerText);
  return accepted.includes(value);
}

function sanitizeTurtleContentHtml(html){
  return sanitizeLabyrinthContentHtml(html);
}

function setupTurtleSoupEditor(){
  const editor=document.getElementById("turtleSoupEditor");
  const imageInput=document.getElementById("turtleSoupImageInput");

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

    const safeName=file.name.replace(/[^\w.\-가-힣]/g,"_");
    const baseId=state.editingTurtleSoupId||`new-${Date.now()}`;
    const path=`turtleSoups/${baseId}/editor/${Date.now()}-${safeName}`;
    const ref=storage.ref().child(path);

    await ref.put(file);
    const url=await ref.getDownloadURL();

    insertImageIntoTurtleSoupEditor(url,path);
  };
}

function insertImageIntoTurtleSoupEditor(url,path){
  const editor=document.getElementById("turtleSoupEditor");
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

window.clearTurtleSoupEditorContent=function(){
  const editor=document.getElementById("turtleSoupEditor");
  if(!editor)return;

  if(!confirm("본문 내용을 모두 지우시겠습니까?"))return;
  editor.innerHTML="";
};

function getTurtleSoupStatus(item){
  const player=item.player||null;

  if(player?.isCleared)return{
    text:"완료",
    className:"public"
  };

  if(player?.startedAt)return{
    text:"진행중",
    className:"private"
  };

  return{
    text:"미완료",
    className:"closed"
  };
}

function renderTurtleSoupList(){
  const list=document.getElementById("turtleSoupList");
  if(!list)return;

  const visibleItems=(state.turtleSoups||[])
    .filter(item=>item.isPublic||item.creator===state.currentUser)
    .sort((a,b)=>getTimeValue(b.updatedAt||b.createdAt)-getTimeValue(a.updatedAt||a.createdAt));

  if(!visibleItems.length){
    list.innerHTML=`<div class="labyrinth-empty">등록된 바다거북스프 문제가 없습니다.</div>`;
    return;
  }

  list.innerHTML=visibleItems.map(item=>{
    const status=getTurtleSoupStatus(item);
    const questionCount=Number(item.questionCount||0);

    return`
      <div class="turtle-soup-card" onclick="openTurtleSoupDetail('${escapeJs(item.id)}')">
        <div class="turtle-card-main">
          <div class="turtle-card-title">${escapeHtml(item.title||"제목 없음")}</div>
          <div class="turtle-card-meta">
            출제자: ${escapeHtml(item.creator||"-")} · 질문 ${questionCount}개
          </div>
        </div>
        <div class="labyrinth-inline-status">
          <span class="labyrinth-status-badge ${status.className}">${status.text}</span>
          ${item.creator===state.currentUser?`<span class="labyrinth-status-badge private">내 문제</span>`:""}
        </div>
      </div>
    `;
  }).join("");
}

async function subscribeTurtleSoups(){
  if(state.unsubscribeTurtleSoups){
    state.unsubscribeTurtleSoups();
    state.unsubscribeTurtleSoups=null;
  }

  state.unsubscribeTurtleSoups=turtleSoupsRef().onSnapshot(async snap=>{
    const items=await Promise.all(snap.docs.map(async doc=>{
      const d=doc.data()||{};
      let player=null;

      try{
        const playerSnap=await turtleSoupPlayerRef(doc.id,state.currentUser).get();
        player=playerSnap.exists?(playerSnap.data()||null):null;
      }catch(err){
        console.error(err);
      }

      return{
        id:doc.id,
        title:d.title||"",
        contentHtml:d.contentHtml||"",
        answer:d.answer||"",
        creator:d.creator||"",
        isPublic:!!d.isPublic,
        questionCount:Number(d.questionCount||0),
        createdAt:d.createdAt||null,
        updatedAt:d.updatedAt||null,
        player
      };
    }));

    state.turtleSoups=items;
    renderTurtleSoupList();

    if(state.currentTurtleSoupId){
      const found=items.find(v=>v.id===state.currentTurtleSoupId)||null;
      state.currentTurtleSoupData=found;
      renderTurtleSoupDetail();
    }
  },err=>{
    console.error(err);
    alert("바다거북스프 목록을 불러오는 중 오류가 발생했습니다.");
  });
}

function openCreateTurtleSoupModal(id=""){
  state.editingTurtleSoupId=id||"";

  const titleInput=document.getElementById("turtleSoupTitleInput");
  const answerInput=document.getElementById("turtleSoupAnswerInput");
  const publicCheckbox=document.getElementById("turtleSoupPublicCheckbox");
  const editor=document.getElementById("turtleSoupEditor");
  const deleteBtn=document.getElementById("deleteTurtleSoupBtn");
  const modalTitle=document.getElementById("turtleSoupModalTitle");

  const item=id?state.turtleSoups.find(v=>v.id===id):null;

  if(id&&!item){
    alert("문제를 찾을 수 없습니다.");
    return;
  }

  if(item&&item.creator!==state.currentUser){
    alert("수정 권한이 없습니다.");
    return;
  }

  if(modalTitle)modalTitle.textContent=item?"바다거북스프 수정":"바다거북스프 만들기";
  if(titleInput)titleInput.value=item?.title||"";
  if(answerInput)answerInput.value=item?.answer||"";
  if(publicCheckbox)publicCheckbox.checked=item?!!item.isPublic:true;
  if(editor)editor.innerHTML=sanitizeTurtleContentHtml(item?.contentHtml||"");
  if(deleteBtn)deleteBtn.classList.toggle("hidden",!item);

  document.getElementById("createTurtleSoupModal")?.classList.remove("hidden");
  setupTurtleSoupEditor();
  syncOverlay();
}

function closeCreateTurtleSoupModal(){
  state.editingTurtleSoupId="";
  document.getElementById("createTurtleSoupModal")?.classList.add("hidden");
  syncOverlay();
}

window.openCreateTurtleSoupModal=openCreateTurtleSoupModal;
window.closeCreateTurtleSoupModal=closeCreateTurtleSoupModal;

async function submitTurtleSoup(){
  const title=normalizeLabyrinthText(document.getElementById("turtleSoupTitleInput")?.value||"");
  const answer=normalizeLabyrinthText(document.getElementById("turtleSoupAnswerInput")?.value||"");
  const contentHtml=sanitizeTurtleContentHtml(document.getElementById("turtleSoupEditor")?.innerHTML||"");
  const isPublic=!!document.getElementById("turtleSoupPublicCheckbox")?.checked;

  if(!title){
    alert("문제 제목을 입력하세요.");
    return;
  }

  if(!contentHtml){
    alert("문제 본문을 입력하세요.");
    return;
  }

  if(!answer){
    alert("정답을 입력하세요.");
    return;
  }

  const now=firebase.firestore.FieldValue.serverTimestamp();

  const payload={
    title,
    answer,
    contentHtml,
    isPublic,
    updatedAt:now
  };

  if(state.editingTurtleSoupId){
    const item=state.turtleSoups.find(v=>v.id===state.editingTurtleSoupId);
    if(!item||item.creator!==state.currentUser){
      alert("수정 권한이 없습니다.");
      return;
    }

    await turtleSoupRef(state.editingTurtleSoupId).set(payload,{merge:true});
  }else{
    payload.creator=state.currentUser;
    payload.questionCount=0;
    payload.createdAt=now;

    await turtleSoupsRef().add(payload);
  }

  closeCreateTurtleSoupModal();
}

window.submitTurtleSoup=submitTurtleSoup;

async function deleteTurtleSoup(){
  const id=state.editingTurtleSoupId;
  const item=state.turtleSoups.find(v=>v.id===id);

  if(!id||!item){
    alert("삭제할 문제를 찾을 수 없습니다.");
    return;
  }

  if(item.creator!==state.currentUser){
    alert("삭제 권한이 없습니다.");
    return;
  }

  if(!confirm("이 바다거북스프 문제를 삭제하시겠습니까?"))return;

  await turtleSoupRef(id).delete();
  closeCreateTurtleSoupModal();

  if(state.currentTurtleSoupId===id){
    closeTurtleSoupDetail();
  }
}

window.deleteTurtleSoup=deleteTurtleSoup;

async function openTurtleSoupDetail(id){
  const item=state.turtleSoups.find(v=>v.id===id);

  if(!item){
    alert("문제를 찾을 수 없습니다.");
    return;
  }

  if(!item.isPublic&&item.creator!==state.currentUser){
    alert("비공개 문제입니다.");
    return;
  }

  state.currentTurtleSoupId=id;
  state.currentTurtleSoupData=item;
  state.currentTurtleComments=[];
  state.currentTurtlePlayer=null;
  state.answeringTurtleCommentId="";

  if(state.unsubscribeTurtleComments){
    state.unsubscribeTurtleComments();
    state.unsubscribeTurtleComments=null;
  }

  if(state.unsubscribeTurtlePlayer){
    state.unsubscribeTurtlePlayer();
    state.unsubscribeTurtlePlayer=null;
  }

  await turtleSoupPlayerRef(id,state.currentUser).set({
    nickname:state.currentUser,
    startedAt:firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt:firebase.firestore.FieldValue.serverTimestamp()
  },{merge:true});

  state.unsubscribeTurtleComments=turtleSoupCommentsRef(id)
    .orderBy("createdAt","asc")
    .onSnapshot(snap=>{
      state.currentTurtleComments=snap.docs.map(doc=>{
        const d=doc.data()||{};
        return{
          id:doc.id,
          asker:d.asker||"",
          question:d.question||"",
          answer:d.answer||"",
          answeredBy:d.answeredBy||"",
          createdAt:d.createdAt||null,
          answeredAt:d.answeredAt||null
        };
      }).filter(v=>!isHiddenTestNickname(v.asker));

      renderTurtleSoupDetail();
      setTimeout(scrollTurtleChatToBottom,0);
    },err=>{
      console.error(err);
      alert("질문 목록을 불러오는 중 오류가 발생했습니다.");
    });

  state.unsubscribeTurtlePlayer=turtleSoupPlayerRef(id,state.currentUser).onSnapshot(doc=>{
    state.currentTurtlePlayer=doc.exists?(doc.data()||null):null;
    renderTurtleSoupDetail();
  },err=>{
    console.error(err);
  });

  document.getElementById("labyrinthHomeView")?.classList.add("hidden");
  document.getElementById("turtleSoupDetailView")?.classList.remove("hidden");

  renderTurtleSoupDetail();
}

window.openTurtleSoupDetail=openTurtleSoupDetail;

function closeTurtleSoupDetail(){
  state.currentTurtleSoupId="";
  state.currentTurtleSoupData=null;
  state.currentTurtleComments=[];
  state.currentTurtlePlayer=null;
  state.answeringTurtleCommentId="";

  if(state.unsubscribeTurtleComments){
    state.unsubscribeTurtleComments();
    state.unsubscribeTurtleComments=null;
  }

  if(state.unsubscribeTurtlePlayer){
    state.unsubscribeTurtlePlayer();
    state.unsubscribeTurtlePlayer=null;
  }

  document.getElementById("turtleSoupDetailView")?.classList.add("hidden");
  document.getElementById("labyrinthHomeView")?.classList.remove("hidden");
  renderTurtleSoupList();
}

window.closeTurtleSoupDetail=closeTurtleSoupDetail;

function renderTurtleSoupDetail(){
  const root=document.getElementById("turtleSoupDetailView");
  const item=state.currentTurtleSoupData;

  if(!root||!item)return;

  const isCreator=item.creator===state.currentUser;
  const isCleared=!!state.currentTurtlePlayer?.isCleared;
  const comments=state.currentTurtleComments||[];

  root.innerHTML=`
    <div class="turtle-detail-view">
      <div class="turtle-detail-header">
        <div>
          <button type="button" class="inline-btn" onclick="closeTurtleSoupDetail()">← 목록</button>
          ${isCreator?`<button type="button" class="inline-btn" onclick="openCreateTurtleSoupModal('${escapeJs(item.id)}')">문제 수정</button>`:""}
        </div>
        <span class="labyrinth-status-badge ${isCleared?"public":"private"}">${isCleared?"완료":"진행중"}</span>
      </div>

      <div class="turtle-problem-card">
        <div class="turtle-problem-title">${escapeHtml(item.title||"제목 없음")}</div>
        <div class="turtle-problem-meta">출제자: ${escapeHtml(item.creator||"-")}</div>
        <details class="turtle-problem-body" open>
          <summary>문제 보기 / 접기</summary>
          <div class="turtle-problem-content">${sanitizeTurtleContentHtml(item.contentHtml||"")}</div>
        </details>
      </div>

      <div id="turtleChatList" class="turtle-chat-list">
        ${comments.length?comments.map(comment=>renderTurtleComment(comment,isCreator)).join(""):`<div class="turtle-empty-chat">아직 질문이 없습니다.</div>`}
      </div>

      <div class="turtle-composer">
        <div id="turtleAnsweringLabel" class="turtle-answering-label ${state.answeringTurtleCommentId?"":"hidden"}">
          답변 작성 중
          <button type="button" onclick="cancelTurtleAnswerMode()">취소</button>
        </div>
        <div class="turtle-quick-row ${state.answeringTurtleCommentId?"":"hidden"}">
          <button type="button" onclick="submitTurtleQuickAnswer('예')">예</button>
          <button type="button" onclick="submitTurtleQuickAnswer('아니오')">아니오</button>
          <button type="button" onclick="submitTurtleQuickAnswer('상관없음')">상관없음</button>
          <button type="button" onclick="submitTurtleQuickAnswer('애매함')">애매함</button>
        </div>
        <div class="turtle-input-row">
          <input id="turtleChatInput" class="text-input" type="text" maxlength="200" placeholder="${state.answeringTurtleCommentId?"답변 입력...":"질문을 입력하세요..."}">
          <button type="button" onclick="${state.answeringTurtleCommentId?"submitTurtleCustomAnswer()":"submitTurtleQuestion()"}">➤</button>
        </div>
        <div class="turtle-answer-row">
          <input id="turtleFinalAnswerInput" class="text-input" type="text" placeholder="정답 입력">
          <button type="button" onclick="submitTurtleFinalAnswer()">정답 제출</button>
        </div>
      </div>
    </div>
  `;
}

function renderTurtleComment(comment,isCreator){
  const hasAnswer=!!comment.answer;
  const canAnswer=isCreator&&!hasAnswer;

  return`
    <div class="turtle-thread">
      <div class="turtle-bubble-row left">
        <div class="turtle-bubble-wrap">
          <div class="turtle-bubble-meta">${escapeHtml(comment.asker||"-")} · ${escapeHtml(formatDateTime(comment.createdAt))}</div>
          <div class="turtle-bubble question">${escapeHtml(comment.question||"")}</div>
        </div>
      </div>

      ${hasAnswer?`
        <div class="turtle-bubble-row right">
          <div class="turtle-bubble-wrap">
            <div class="turtle-bubble-meta right">${escapeHtml(comment.answeredBy||"출제자")} · ${escapeHtml(formatDateTime(comment.answeredAt))}</div>
            <div class="turtle-bubble answer">${escapeHtml(comment.answer)}</div>
          </div>
        </div>
      `:`
        <div class="turtle-pending-row">
          <span>답변 대기중</span>
          ${canAnswer?`<button type="button" onclick="startTurtleAnswerMode('${escapeJs(comment.id)}')">답변</button>`:""}
        </div>
      `}
    </div>
  `;
}

function scrollTurtleChatToBottom(){
  const list=document.getElementById("turtleChatList");
  if(!list)return;
  list.scrollTop=list.scrollHeight;
}

async function submitTurtleQuestion(){
  const item=state.currentTurtleSoupData;
  const input=document.getElementById("turtleChatInput");
  const question=String(input?.value||"").trim();

  if(!item)return;

  if(!question){
    input?.focus();
    return;
  }

  if(question.length>200){
    alert("질문은 200자 이하로 입력하세요.");
    return;
  }

  input.value="";

  await turtleSoupCommentsRef(item.id).add({
    asker:state.currentUser,
    question,
    answer:"",
    answeredBy:"",
    createdAt:firebase.firestore.FieldValue.serverTimestamp(),
    answeredAt:null
  });

  await turtleSoupRef(item.id).set({
    questionCount:firebase.firestore.FieldValue.increment(1),
    updatedAt:firebase.firestore.FieldValue.serverTimestamp()
  },{merge:true});
}

window.submitTurtleQuestion=submitTurtleQuestion;

function startTurtleAnswerMode(commentId){
  state.answeringTurtleCommentId=commentId;
  renderTurtleSoupDetail();
  setTimeout(()=>{
    document.getElementById("turtleChatInput")?.focus();
  },0);
}

window.startTurtleAnswerMode=startTurtleAnswerMode;

function cancelTurtleAnswerMode(){
  state.answeringTurtleCommentId="";
  renderTurtleSoupDetail();
}

window.cancelTurtleAnswerMode=cancelTurtleAnswerMode;

async function submitTurtleQuickAnswer(answer){
  await saveTurtleAnswer(answer);
}

window.submitTurtleQuickAnswer=submitTurtleQuickAnswer;

async function submitTurtleCustomAnswer(){
  const input=document.getElementById("turtleChatInput");
  const answer=String(input?.value||"").trim();

  if(!answer){
    input?.focus();
    return;
  }

  await saveTurtleAnswer(answer);
}

window.submitTurtleCustomAnswer=submitTurtleCustomAnswer;

async function saveTurtleAnswer(answer){
  const item=state.currentTurtleSoupData;
  const commentId=state.answeringTurtleCommentId;

  if(!item||!commentId)return;

  if(item.creator!==state.currentUser){
    alert("출제자만 답변할 수 있습니다.");
    return;
  }

  await turtleSoupCommentsRef(item.id).doc(commentId).set({
    answer,
    answeredBy:state.currentUser,
    answeredAt:firebase.firestore.FieldValue.serverTimestamp()
  },{merge:true});

  state.answeringTurtleCommentId="";
  renderTurtleSoupDetail();
}

async function submitTurtleFinalAnswer(){
  const item=state.currentTurtleSoupData;
  const input=document.getElementById("turtleFinalAnswerInput");
  const value=String(input?.value||"").trim();

  if(!item)return;

  if(!value){
    input?.focus();
    return;
  }

  if(!isCorrectTurtleAnswer(value,item.answer||"")){
    alert("정답이 아닙니다.");
    input?.focus();
    return;
  }

  await turtleSoupPlayerRef(item.id,state.currentUser).set({
    nickname:state.currentUser,
    isCleared:true,
    clearedAt:firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt:firebase.firestore.FieldValue.serverTimestamp()
  },{merge:true});

  alert("정답입니다!");
}

window.submitTurtleFinalAnswer=submitTurtleFinalAnswer;

(function patchEscapeLabyrinthForTurtleSoup(){
  const original=window.subscribeEscapeLabyrinthHome;

  if(typeof original==="function"){
    window.subscribeEscapeLabyrinthHome=function(){
      original();
      subscribeTurtleSoups();
    };
  }

  const originalHome=window.openEscapeLabyrinthHome;
  if(typeof originalHome==="function"){
    window.openEscapeLabyrinthHome=function(skipResubscribe){
      closeTurtleSoupDetail();
      originalHome(skipResubscribe);
      renderTurtleSoupList();
    };
  }
})();
