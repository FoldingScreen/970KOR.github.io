/* ===== 운영 모드: 유적 화면만 사용 ===== */
(function enableRuinsScreenOnlyMode(){
  const ACTIVE_EVENT_ID="ruins";
  let originalOpenEvent=null;
  let originalGoHome=null;
  let isOpeningRuins=false;

  function filterEventsToRuins(){
    if(typeof state==="undefined"||!Array.isArray(state.events))return;
    state.events=state.events.filter(event=>event&&event.id===ACTIVE_EVENT_ID);
  }

  function hideNonRuinsTabs(){
    document.querySelectorAll("#topTabs .tab-btn").forEach(btn=>{
      const label=String(btn.textContent||"").trim();
      btn.classList.toggle("hidden",label!=="유적쟁탈");
    });
  }

  function patchHomeCards(){
    if(typeof renderHomeEventCards!=="function"||renderHomeEventCards.__ruinsScreenOnly)return;

    const originalRenderHomeEventCards=renderHomeEventCards;

    renderHomeEventCards=function(){
      filterEventsToRuins();
      return originalRenderHomeEventCards();
    };

    renderHomeEventCards.__ruinsScreenOnly=true;
  }

  function openRuinsDirect(){
    if(!state.currentUser){
      if(typeof showOnly==="function")showOnly("login");
      return;
    }

    if(typeof originalOpenEvent!=="function")return;
    if(isOpeningRuins)return;

    isOpeningRuins=true;

    Promise.resolve(originalOpenEvent(ACTIVE_EVENT_ID)).finally(()=>{
      isOpeningRuins=false;
      hideNonRuinsTabs();
    });
  }

  function patchOpenEvent(){
    if(typeof openEvent!=="function"||openEvent.__ruinsScreenOnly)return;

    originalOpenEvent=openEvent;

    openEvent=async function(id){
      if(id!==ACTIVE_EVENT_ID){
        return originalOpenEvent(ACTIVE_EVENT_ID);
      }

      return originalOpenEvent(id);
    };

    openEvent.__ruinsScreenOnly=true;
    window.openEvent=openEvent;
  }

  function patchGoHome(){
    if(typeof goHome!=="function"||goHome.__ruinsScreenOnly)return;

    originalGoHome=goHome;

    goHome=async function(){
      if(!state.currentUser){
        return originalGoHome();
      }

      return openEvent(ACTIVE_EVENT_ID);
    };

    goHome.__ruinsScreenOnly=true;
    window.goHome=goHome;
  }

  function patchInitialLoginFlow(){
    if(typeof tryAutoLogin!=="function"||tryAutoLogin.__ruinsScreenOnly)return;

    const originalTryAutoLogin=tryAutoLogin;

    tryAutoLogin=async function(){
      await originalTryAutoLogin();
      filterEventsToRuins();
      hideNonRuinsTabs();

      if(state.currentUser&&state.currentEventId!==ACTIVE_EVENT_ID){
        openRuinsDirect();
      }
    };

    tryAutoLogin.__ruinsScreenOnly=true;
    window.tryAutoLogin=tryAutoLogin;
  }

  function patchLoginFlow(){
    if(typeof login!=="function"||login.__ruinsScreenOnly)return;

    const originalLogin=login;

    login=async function(){
      await originalLogin();

      if(state.currentUser){
        openRuinsDirect();
      }
    };

    login.__ruinsScreenOnly=true;
    window.login=login;
  }

  window.applyRuinsScreenOnlyMode=function(){
    filterEventsToRuins();
    hideNonRuinsTabs();
    patchHomeCards();
    patchOpenEvent();
    patchGoHome();
    patchInitialLoginFlow();
    patchLoginFlow();
  };

  window.applyRuinsScreenOnlyMode();
})();

/* ===== 초기 실행 전용 ===== */
document.addEventListener("DOMContentLoaded",()=>{
  window.applyRuinsScreenOnlyMode?.();
  tryAutoLogin();
});