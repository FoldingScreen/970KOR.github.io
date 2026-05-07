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

function getTurtleDifficulty(value){
  const n=Math.min(5,Math.max(1,Number(value||3)));
  return n;
}

function renderTurtleDifficulty(value){
  const n=getTurtleDifficulty(value);
  return `<span class="turtle-difficulty" title="난이도 ${n}">${"★".repeat(n)}${"☆".repeat(5-n)}</span>`;
}

function renderTurtleSoupList(){
  const list=document.getElementById("turtleSoupList");
  if(!list)return;

  const visibleItems=(state.turtleSoups||[])
    .filter(item=>item.isPublic||item.creator===state.currentUser)
    .sort((a,b)=>{
  const da=getTurtleDifficulty(a.difficulty);
  const db=getTurtleDifficulty(b.difficulty);

  if(da!==db)return da-db;

  return getTimeValue(a.createdAt)-getTimeValue(b.createdAt);
});

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
            출제자: ${escapeHtml(item.creator||"-")} · 난이도 ${renderTurtleDifficulty(item.difficulty)} · 질문 ${questionCount}개
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
        contentText:d.contentText||d.contentHtml||"",
        solutionText:d.solutionText||"",
        difficulty:getTurtleDifficulty(d.difficulty),
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
  const contentInput=document.getElementById("turtleSoupContentInput");
  const difficultySelect=document.getElementById("turtleSoupDifficultySelect");
  const solutionInput=document.getElementById("turtleSoupSolutionInput");
  const publicCheckbox=document.getElementById("turtleSoupPublicCheckbox");
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
  if(contentInput)contentInput.value=item?.contentText||"";
  if(difficultySelect)difficultySelect.value=String(getTurtleDifficulty(item?.difficulty));
  if(solutionInput)solutionInput.value=item?.solutionText||"";
  if(publicCheckbox)publicCheckbox.checked=item?!!item.isPublic:true;
  if(deleteBtn)deleteBtn.classList.toggle("hidden",!item);

  document.getElementById("createTurtleSoupModal")?.classList.remove("hidden");
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
  const difficulty=getTurtleDifficulty(document.getElementById("turtleSoupDifficultySelect")?.value||3);
  const contentText=normalizeLabyrinthText(document.getElementById("turtleSoupContentInput")?.value||"");
  const solutionText=normalizeLabyrinthText(document.getElementById("turtleSoupSolutionInput")?.value||"");
  const isPublic=!!document.getElementById("turtleSoupPublicCheckbox")?.checked;

  if(!title){
    alert("문제 제목을 입력하세요.");
    return;
  }

  if(!contentText){
    alert("문제 본문을 입력하세요.");
    return;
  }

  const now=firebase.firestore.FieldValue.serverTimestamp();

  const payload={
    title,
    difficulty,
    contentText,
    solutionText,
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
  state.currentTurtleSubmissions=[];
  state.currentTurtlePlayers=[];
  state.answeringTurtleCommentId="";
  state.isTurtleSubmitPanelOpen=false;

  if(state.unsubscribeTurtleComments){
    state.unsubscribeTurtleComments();
    state.unsubscribeTurtleComments=null;
  }

  if(state.unsubscribeTurtlePlayer){
    state.unsubscribeTurtlePlayer();
    state.unsubscribeTurtlePlayer=null;
  }

  if(state.unsubscribeTurtleSubmissions){
    state.unsubscribeTurtleSubmissions();
    state.unsubscribeTurtleSubmissions=null;
  }

  if(state.unsubscribeTurtlePlayers){
    state.unsubscribeTurtlePlayers();
    state.unsubscribeTurtlePlayers=null;
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
          isSpoiler:!!d.isSpoiler,
          answeredBy:d.answeredBy||"",
          createdAt:d.createdAt||null,
          answeredAt:d.answeredAt||null
        };
      });

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

  state.unsubscribeTurtleSubmissions=turtleSoupSubmissionsRef(id)
    .orderBy("submittedAt","asc")
    .onSnapshot(snap=>{
      state.currentTurtleSubmissions=snap.docs.map(doc=>{
        const d=doc.data()||{};

        return{
          id:doc.id,
          user:d.user||"",
          answerText:d.answerText||"",
          status:d.status||"pending",
          judgedBy:d.judgedBy||"",
          submittedAt:d.submittedAt||null,
          judgedAt:d.judgedAt||null
        };
      }).filter(v=>{
        if(item.creator===state.currentUser)return true;
        return v.user===state.currentUser;
      });

      renderTurtleSoupDetail();
    },err=>{
      console.error(err);
      alert("정답 제출 목록을 불러오는 중 오류가 발생했습니다.");
    });

    state.unsubscribeTurtlePlayers=turtleSoupPlayersRef(id)
    .onSnapshot(snap=>{
      state.currentTurtlePlayers=snap.docs.map(doc=>{
        const d=doc.data()||{};

        return{
          id:doc.id,
          nickname:d.nickname||doc.id,
          isCleared:!!d.isCleared,
          clearedAt:d.clearedAt||null
        };
      }).filter(v=>v.isCleared&&!isHiddenTestNickname(v.nickname));

      renderTurtleSoupDetail();
    },err=>{
      console.error(err);
      alert("정답자 목록을 불러오는 중 오류가 발생했습니다.");
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
  state.currentTurtleSubmissions=[];
  state.currentTurtlePlayers=[];
  state.answeringTurtleCommentId="";
  state.isTurtleSubmitPanelOpen=false;

  if(state.unsubscribeTurtleComments){
    state.unsubscribeTurtleComments();
    state.unsubscribeTurtleComments=null;
  }

  if(state.unsubscribeTurtlePlayer){
    state.unsubscribeTurtlePlayer();
    state.unsubscribeTurtlePlayer=null;
  }

  if(state.unsubscribeTurtleSubmissions){
    state.unsubscribeTurtleSubmissions();
    state.unsubscribeTurtleSubmissions=null;
  }

    if(state.unsubscribeTurtlePlayers){
    state.unsubscribeTurtlePlayers();
    state.unsubscribeTurtlePlayers=null;
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
  const submissions=state.currentTurtleSubmissions||[];
  const clearers=(state.currentTurtlePlayers||[])
  .filter(v=>v.isCleared&&!isHiddenTestNickname(v.nickname))
  .sort((a,b)=>getTimeValue(a.clearedAt)-getTimeValue(b.clearedAt));
  const answeringComment=comments.find(v=>v.id===state.answeringTurtleCommentId)||null;
  const answeringAnswer=answeringComment?.answer||"";

  root.innerHTML=`
    <div class="turtle-detail-view">
      <div class="turtle-detail-header">
        <div>
          <button type="button" class="inline-btn" onclick="closeTurtleSoupDetail()">← 목록</button>
          ${isCreator?`<button type="button" class="inline-btn" onclick="openCreateTurtleSoupModal('${escapeJs(item.id)}')">문제 수정</button>`:""}
        </div>
        ${isCreator?"":`
  <span class="labyrinth-status-badge ${isCleared?"public":"private"}">
    ${isCleared?"완료":"진행중"}
  </span>
`}
      </div>

      <div class="turtle-problem-card">
        <div class="turtle-problem-title">${escapeHtml(item.title||"제목 없음")}</div>
        <div class="turtle-problem-meta">출제자: ${escapeHtml(item.creator||"-")} · 난이도 ${renderTurtleDifficulty(item.difficulty)}</div>
        <details class="turtle-problem-body" open>
          <summary>문제 보기 / 접기</summary>
          <div class="turtle-problem-content">${escapeHtml(item.contentText||"").replace(/\n/g,"<br>")}</div>
        </details>
      </div>

      <div id="turtleChatList" class="turtle-chat-list">
        ${comments.length?comments.map(comment=>renderTurtleComment(comment,isCreator)).join(""):`<div class="turtle-empty-chat">아직 질문이 없습니다.</div>`}
      </div>

      ${renderTurtleClearersPanel(clearers)}
      ${renderTurtleSolutionPanel(isCreator,isCleared,item)}
      ${renderTurtleSubmissionPanel(isCreator,submissions,isCleared)}

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
          <input id="turtleChatInput" class="text-input" type="text" maxlength="200" value="${escapeHtml(answeringAnswer)}" placeholder="${state.answeringTurtleCommentId?"답변 입력...":"'예/아니오'로 답변이 가능하도록 질문을 입력하세요."}">
          <div class="turtle-input-actions">
            <button type="button" onclick="${state.answeringTurtleCommentId?"submitTurtleCustomAnswer()":"submitTurtleQuestion()"}">➤</button>
            ${isCreator?"":`<button type="button" onclick="openTurtleSubmitPanel()" ${isCleared?"disabled":""}>정답제출</button>`}
          </div>
        </div>
        ${isCreator?"":`
          <div class="turtle-answer-row ${state.isTurtleSubmitPanelOpen?"":"hidden"}">
            <input id="turtleFinalAnswerInput" class="text-input" type="text" placeholder="${isCleared?"이미 완료했습니다.":"정답이라고 생각하는 내용을 입력하세요."}" ${isCleared?"disabled":""}>
            <div class="turtle-answer-actions">
              <button type="button" onclick="submitTurtleFinalAnswer()" ${isCleared?"disabled":""}>제출</button>
              <button type="button" onclick="closeTurtleSubmitPanel()">닫기</button>
            </div>
          </div>
        `}
      </div>
    </div>
  `;
}

function renderTurtleClearersPanel(clearers){
  if(!clearers.length){
    return`
      <div class="turtle-clearers-panel">
        <div class="turtle-submission-title">정답자</div>
        <div class="turtle-submission-empty">아직 정답자가 없습니다.</div>
      </div>
    `;
  }

  return`
    <div class="turtle-clearers-panel">
      <div class="turtle-submission-title">정답자 ${clearers.length}명</div>
      <div class="turtle-clearer-list">
        ${clearers.map((item,idx)=>`
          <div class="turtle-clearer-item">
            <span>${idx+1}. ${escapeHtml(item.nickname)}</span>
            <span class="muted">${escapeHtml(formatDateTime(item.clearedAt))}</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderTurtleSolutionPanel(isCreator,isCleared,item){
  if(!item)return"";

  if(!isCreator&&!isCleared)return"";

  const solution=normalizeLabyrinthText(item.solutionText||"");

  if(!solution){
    return isCreator
      ? `<div class="turtle-solution-panel"><div class="turtle-submission-title">해설</div><div class="turtle-submission-empty">등록된 해설이 없습니다.</div></div>`
      : "";
  }

  return`
    <div class="turtle-solution-panel">
      <div class="turtle-submission-title">${isCreator?"출제자용 해설":"해설"}</div>
      <div class="turtle-solution-text">${escapeHtml(solution).replace(/\n/g,"<br>")}</div>
    </div>
  `;
}

function renderTurtleSubmissionPanel(isCreator,submissions,isCleared){
  if(isCreator){
    const pending=submissions.filter(v=>v.status==="pending");
    const judged=submissions.filter(v=>v.status!=="pending");

    return`
      <div class="turtle-submission-panel">
        <div class="turtle-submission-title">정답 제출 검토 ${pending.length?`· 대기 ${pending.length}건`:""}</div>
        ${pending.length?pending.map(renderTurtlePendingSubmission).join(""):`<div class="turtle-submission-empty">검토 대기 중인 정답이 없습니다.</div>`}
        ${judged.length?`
          <details class="turtle-submission-history">
            <summary>처리한 제출 ${judged.length}건</summary>
            ${judged.map(renderTurtleJudgedSubmission).join("")}
          </details>
        `:""}
      </div>
    `;
  }

  if(!submissions.length){
    return"";
  }

  return`
    <div class="turtle-submission-panel">
      <div class="turtle-submission-title">내 정답 제출 상태 ${isCleared?"· 완료":""}</div>
      ${submissions.map(renderMyTurtleSubmission).join("")}
    </div>
  `;
}

function renderTurtlePendingSubmission(item){
  return`
    <div class="turtle-submission-item">
      <div class="turtle-submission-meta">
        ${escapeHtml(item.user)} · ${escapeHtml(formatDateTime(item.submittedAt))}
      </div>
      <div class="turtle-submission-text">${escapeHtml(item.answerText).replace(/\n/g,"<br>")}</div>
      <div class="turtle-submission-actions">
        <button type="button" onclick="judgeTurtleSubmission('${escapeJs(item.id)}','correct','${escapeJs(item.user)}')">정답</button>
        <button type="button" onclick="judgeTurtleSubmission('${escapeJs(item.id)}','wrong','${escapeJs(item.user)}')">오답</button>
      </div>
    </div>
  `;
}

function renderTurtleJudgedSubmission(item){
  const label=item.status==="correct"?"정답":"오답";
  const cls=item.status==="correct"?"public":"closed";

  return`
    <div class="turtle-submission-item judged">
      <div class="turtle-submission-meta">
        ${escapeHtml(item.user)} · ${escapeHtml(formatDateTime(item.submittedAt))}
        <span class="labyrinth-status-badge ${cls}">${label}</span>
      </div>
      <div class="turtle-submission-text">${escapeHtml(item.answerText).replace(/\n/g,"<br>")}</div>
    </div>
  `;
}

function renderMyTurtleSubmission(item){
  const statusMap={
    pending:["검토 대기","private"],
    correct:["정답","public"],
    wrong:["오답","closed"]
  };
  const pair=statusMap[item.status]||statusMap.pending;

  return`
    <div class="turtle-submission-item judged">
      <div class="turtle-submission-meta">
        제출: ${escapeHtml(formatDateTime(item.submittedAt))}
        <span class="labyrinth-status-badge ${pair[1]}">${pair[0]}</span>
      </div>
      <div class="turtle-submission-text">${escapeHtml(item.answerText).replace(/\n/g,"<br>")}</div>
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
          <div class="turtle-bubble question ${comment.isSpoiler&&!isCreator?"spoiler":""}" ${comment.isSpoiler&&!isCreator?`onclick="this.classList.toggle('revealed')"`:""}>
  ${comment.isSpoiler&&!isCreator
    ? `<span class="spoiler-placeholder">스포일러 질문입니다. 눌러서 보기</span><span class="spoiler-real">${escapeHtml(comment.question||"")}</span>`
    : escapeHtml(comment.question||"")}
</div>
${isCreator?`
  <div class="turtle-spoiler-control">
    <button type="button" onclick="toggleTurtleQuestionSpoiler('${escapeJs(comment.id)}',${comment.isSpoiler?"false":"true"})">
      ${comment.isSpoiler?"가리기 해제":"가리기"}
    </button>
    <button type="button" class="danger-mini-btn" onclick="deleteTurtleComment('${escapeJs(comment.id)}')">
      삭제
    </button>
  </div>
`:""}
        </div>
      </div>

      ${hasAnswer?`
        <div class="turtle-bubble-row right">
          <div class="turtle-bubble-wrap">
            <div class="turtle-bubble-meta right">
  ${escapeHtml(comment.answeredBy||"출제자")} · ${escapeHtml(formatDateTime(comment.answeredAt))}
  ${isCreator?`<button type="button" class="turtle-answer-edit-btn" onclick="startTurtleAnswerMode('${escapeJs(comment.id)}')">수정</button>`:""}
</div>
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
    isSpoiler:false,
    createdAt:firebase.firestore.FieldValue.serverTimestamp(),
    answeredAt:null
  });

  await turtleSoupRef(item.id).set({
    questionCount:firebase.firestore.FieldValue.increment(1),
    updatedAt:firebase.firestore.FieldValue.serverTimestamp()
  },{merge:true});

  await createAppNotification(item.creator,{
    type:"turtle_question",
    title:"새 질문",
    message:`${state.currentUser}님이 질문을 남겼습니다: ${question}`,
    soupId:item.id,
    soupTitle:item.title||""
  });
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

function openTurtleSubmitPanel(){
  state.isTurtleSubmitPanelOpen=true;
  renderTurtleSoupDetail();

  setTimeout(()=>{
    document.getElementById("turtleFinalAnswerInput")?.focus();
  },0);
}

window.openTurtleSubmitPanel=openTurtleSubmitPanel;

function closeTurtleSubmitPanel(){
  state.isTurtleSubmitPanelOpen=false;
  renderTurtleSoupDetail();
}

window.closeTurtleSubmitPanel=closeTurtleSubmitPanel;

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

async function toggleTurtleQuestionSpoiler(commentId,nextValue){
  const item=state.currentTurtleSoupData;

  if(!item||!commentId)return;

  if(item.creator!==state.currentUser){
    alert("출제자만 가리기 처리할 수 있습니다.");
    return;
  }
  
  await turtleSoupCommentsRef(item.id).doc(commentId).set({
    isSpoiler:!!nextValue
  },{merge:true});
}

window.toggleTurtleQuestionSpoiler=toggleTurtleQuestionSpoiler;

async function deleteTurtleComment(commentId){
  const item=state.currentTurtleSoupData;

  if(!item||!commentId)return;

  if(item.creator!==state.currentUser){
    alert("출제자만 질문을 삭제할 수 있습니다.");
    return;
  }

  if(!confirm("이 질문과 답변을 삭제하시겠습니까?"))return;

  const batch=db.batch();

await turtleSoupCommentsRef(item.id).doc(commentId).delete();

const snap=await turtleSoupCommentsRef(item.id).get();

await turtleSoupRef(item.id).set({
  questionCount:snap.size,
  updatedAt:firebase.firestore.FieldValue.serverTimestamp()
},{merge:true});

  await batch.commit();

  if(state.answeringTurtleCommentId===commentId){
    state.answeringTurtleCommentId="";
  }
}

window.deleteTurtleComment=deleteTurtleComment;

async function saveTurtleAnswer(answer){
  const item=state.currentTurtleSoupData;
  const commentId=state.answeringTurtleCommentId;
  const comment=state.currentTurtleComments.find(v=>v.id===commentId)||null;

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

  if(comment?.asker){
    await createAppNotification(comment.asker,{
      type:"turtle_answer",
      title:"질문 답변 도착",
      message:`${item.title||"바다거북스프"}에 남긴 질문에 답변이 달렸습니다.`,
      soupId:item.id,
      soupTitle:item.title||""
    });
  }
  
  state.answeringTurtleCommentId="";
  renderTurtleSoupDetail();
}

async function submitTurtleFinalAnswer(){
  const item=state.currentTurtleSoupData;
  const input=document.getElementById("turtleFinalAnswerInput");
  const value=normalizeLabyrinthText(input?.value||"");

  if(!item)return;

  if(item.creator===state.currentUser){
    alert("출제자는 정답을 제출할 수 없습니다.");
    return;
  }

  if(state.currentTurtlePlayer?.isCleared){
    alert("이미 완료한 문제입니다.");
    return;
  }

  if(!value){
    input?.focus();
    return;
  }

  await turtleSoupSubmissionsRef(item.id).add({
    user:state.currentUser,
    answerText:value,
    status:"pending",
    judgedBy:"",
    submittedAt:firebase.firestore.FieldValue.serverTimestamp(),
    judgedAt:null
  });

  await turtleSoupPlayerRef(item.id,state.currentUser).set({
    nickname:state.currentUser,
    startedAt:state.currentTurtlePlayer?.startedAt||firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt:firebase.firestore.FieldValue.serverTimestamp()
  },{merge:true});

  await createAppNotification(item.creator,{
    type:"turtle_submission",
    title:"정답 제출",
    message:`${state.currentUser}님이 정답을 제출했습니다.`,
    soupId:item.id,
    soupTitle:item.title||""
  });
  
  input.value="";
  state.isTurtleSubmitPanelOpen=false;
  renderTurtleSoupDetail();
  alert("정답이 제출되었습니다. 출제자 판정을 기다려 주세요.");
}

window.submitTurtleFinalAnswer=submitTurtleFinalAnswer;

async function judgeTurtleSubmission(submissionId,status,user){
  const item=state.currentTurtleSoupData;

  if(!item||!submissionId||!user)return;

  if(item.creator!==state.currentUser){
    alert("출제자만 판정할 수 있습니다.");
    return;
  }

  if(status!=="correct"&&status!=="wrong"){
    alert("판정 값이 올바르지 않습니다.");
    return;
  }

  const now=firebase.firestore.FieldValue.serverTimestamp();
  const batch=db.batch();

  batch.set(turtleSoupSubmissionsRef(item.id).doc(submissionId),{
    status,
    judgedBy:state.currentUser,
    judgedAt:now
  },{merge:true});

  if(status==="correct"){
    batch.set(turtleSoupPlayerRef(item.id,user),{
      nickname:user,
      isCleared:true,
      clearedAt:now,
      updatedAt:now
    },{merge:true});
  }

  await batch.commit();

  await createAppNotification(user,{
    type:"turtle_judged",
    title:status==="correct"?"정답 처리됨":"오답 처리됨",
    message:`${item.title||"바다거북스프"} 제출 답안이 ${status==="correct"?"정답":"오답"} 처리되었습니다.`,
    soupId:item.id,
    soupTitle:item.title||""
  });
}

window.judgeTurtleSubmission=judgeTurtleSubmission;

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
