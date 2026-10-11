/* ===== 운영 모드: 유적 쟁탈만 활성화 ===== */
(function enableRuinsOnlyMode(){
  const ACTIVE_EVENT_ID="ruins";
  const VISIBLE_TAB_LABELS=new Set(["홈","유적쟁탈"]);

  function filterEventsToRuins(){
    if(typeof state==="undefined"||!Array.isArray(state.events))return;
    state.events=state.events.filter(event=>event&&event.id===ACTIVE_EVENT_ID);
  }

  function hideInactiveEventTabs(){
    document.querySelectorAll("#topTabs .tab-btn").forEach(btn=>{
      const label=String(btn.textContent||"").trim();
      btn.classList.toggle("hidden",!VISIBLE_TAB_LABELS.has(label));
    });
  }

  function patchHomeCards(){
    if(typeof renderHomeEventCards!=="function"||renderHomeEventCards.__ruinsOnly)return;

    const originalRenderHomeEventCards=renderHomeEventCards;

    renderHomeEventCards=function(){
      filterEventsToRuins();
      return originalRenderHomeEventCards();
    };

    renderHomeEventCards.__ruinsOnly=true;
  }

  function patchOpenEvent(){
    if(typeof openEvent!=="function"||openEvent.__ruinsOnly)return;

    const originalOpenEvent=openEvent;

    openEvent=async function(id){
      if(id!==ACTIVE_EVENT_ID){
        alert("현재 유적 쟁탈만 운영 중입니다.");
        return;
      }

      return originalOpenEvent(id);
    };

    openEvent.__ruinsOnly=true;
    window.openEvent=openEvent;
  }

  window.applyRuinsOnlyMode=function(){
    filterEventsToRuins();
    hideInactiveEventTabs();
    patchHomeCards();
    patchOpenEvent();
  };

  window.applyRuinsOnlyMode();
})();

/* ===== 초기 실행 전용 ===== */
document.addEventListener("DOMContentLoaded",()=>{
  window.applyRuinsOnlyMode?.();
  tryAutoLogin();
});