(() => {
  function installCss() {
    if (document.getElementById("dalmutiCompactPcCss")) return;
    const style = document.createElement("style");
    style.id = "dalmutiCompactPcCss";
    style.textContent = `
      @media (min-width: 881px) {
        .dalmuti-app{width:min(1380px,100%);padding:10px 14px;}
        .dalmuti-topbar{margin-bottom:8px;}
        .dalmuti-topbar h1{font-size:23px;margin:0;}
        .eyebrow{font-size:10px;}
        .room-shell{grid-template-columns:minmax(0,1fr) 300px;gap:10px;align-items:start;}
        .panel{padding:12px;border-radius:18px;}
        .game-panel{min-height:calc(100vh - 92px);display:flex;flex-direction:column;}
        .room-head{display:none!important;}
        .message-bar{margin:0 0 8px;padding:8px 10px;font-size:13px;}
        #lobbyControls,#betweenControls{margin-bottom:8px;}
        .table-wrap{min-height:calc(100vh - 365px);max-height:calc(100vh - 350px);margin-top:6px;flex:1;}
        .player-box{width:116px;min-height:68px;padding:7px;border-radius:14px;}
        .player-role{font-size:11px;}
        .player-name{font-size:13px;}
        .player-meta{font-size:11px;margin-top:2px;}
        .dalmuti-status-badge{font-size:10px;margin-top:3px;padding:2px 7px;}
        .seat-bottom{bottom:6px!important;}
        .seat-top-0,.seat-top-1,.seat-top-2{top:6px!important;}
        .seat-left-0,.seat-left-1,.seat-left-2{left:8px!important;}
        .seat-right-0,.seat-right-1,.seat-right-2{right:8px!important;}
        .center-pile.pc-fixed{min-height:178px!important;width:min(460px,54%)!important;padding:10px!important;}
        .pc-pile-prev{left:9px!important;top:9px!important;width:130px!important;min-height:70px!important;padding:6px!important;}
        .pc-pile-prev-title,.pc-pile-cur-title{font-size:10px!important;margin-bottom:4px!important;}
        .pc-pile-cur{min-height:158px!important;padding-left:140px!important;}
        .pc-pile-current-name{font-size:16px!important;margin-bottom:7px!important;}
        .pc-pile-prev .mini-card{width:28px!important;}
        .pc-pile-cur .mini-card{width:64px!important;}
        .pc-pile-empty{height:158px!important;}
        .hand-header{margin-top:8px;align-items:center;}
        .hand-header h3{font-size:17px;margin:0;}
        .hand-header .muted{display:none;}
        .selected-summary{padding:6px 10px;font-size:13px;}
        .hand-area{min-height:116px;padding:10px;margin:6px 0;gap:8px;}
        .hand-stack{width:62px;}
        .hand-stack img{width:62px;border-radius:8px;}
        .stack-count,.stack-selected{font-size:10px;padding:2px 6px;}
        .action-row{margin-top:2px;}
        .action-row .btn{padding:8px 11px;}
        .side-panel{gap:9px;max-height:calc(100vh - 92px);overflow:auto;}
        .side-panel h3{font-size:15px;margin-bottom:6px;}
        .score-row{padding:5px 0;font-size:12px;}
        .chat-list{height:170px;padding:8px;gap:6px;}
        .chat-msg{font-size:12px;}
        .chat-input-row .input{height:34px;}
        .chat-input-row .btn{height:34px;padding:6px 9px;}
        #spectatorPanel,#roundResultPanel,#finalResultPanel{margin-top:8px;}
        .dalmuti-result-box{padding:9px;border-radius:14px;}
        .dalmuti-result-title{font-size:13px;margin-bottom:6px;}
        .dalmuti-result-row{grid-template-columns:40px minmax(0,1fr) 48px 60px;gap:6px;padding:6px 7px;font-size:12px;}
        .spectator-chip{font-size:11px;padding:4px 7px;}
        #roomSettingsPanel{margin-top:0!important;order:-2;}
        #roomSettingsPanel .dalmuti-setting-grid{grid-template-columns:1fr;gap:6px;}
        #roomSettingsPanel .input{height:32px;font-size:12px;}
        #roomSettingsPanel .btn{padding:6px 8px;font-size:12px;}
        .side-room-summary{order:-3;}
        #deleteRoomBtn{margin-top:4px;}
        #tributeVisibilityPanel{left:auto!important;right:326px!important;bottom:12px!important;width:260px!important;padding:10px!important;}
        .tribute-visibility-title{font-size:13px;}
        .tribute-visibility-line{font-size:12px;}
        .tribute-visibility-cards img{width:40px!important;}
      }
    `;
    document.head.appendChild(style);
  }

  function ensureRoomSummary() {
    const side = document.querySelector(".side-panel");
    if (!side) return null;
    let panel = document.getElementById("sideRoomSummary");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "sideRoomSummary";
      panel.className = "dalmuti-result-box side-room-summary";
      panel.innerHTML = `<div class="dalmuti-result-title"><span>방 정보</span></div><div class="dalmuti-result-body"></div>`;
      side.insertBefore(panel, side.firstChild);
    }
    return panel;
  }

  function moveRoomSettings() {
    const side = document.querySelector(".side-panel");
    const settings = document.getElementById("roomSettingsPanel");
    if (!side || !settings) return;
    const summary = ensureRoomSummary();
    if (summary && settings.parentElement !== side) {
      side.insertBefore(settings, summary.nextSibling);
    }
  }

  function getRoomText() {
    const title = document.getElementById("roomTitle")?.textContent || "-";
    const state = document.getElementById("roomStateText")?.textContent || "-";
    const turn = document.getElementById("turnBadge")?.textContent || "-";
    return { title, state, turn };
  }

  function renderSummary() {
    const panel = ensureRoomSummary();
    if (!panel) return;
    const body = panel.querySelector(".dalmuti-result-body");
    const { title, state, turn } = getRoomText();
    body.innerHTML = `
      <div class="score-row"><span>방제</span><strong>${title}</strong></div>
      <div class="score-row"><span>상태</span><strong>${state}</strong></div>
      <div class="score-row"><span>차례</span><strong>${turn.replace(/^차례:\s*/, "")}</strong></div>
    `;
  }

  function moveDeleteButton() {
    const side = document.querySelector(".side-panel");
    const btn = document.getElementById("deleteRoomBtn");
    if (!side || !btn || btn.parentElement === side) return;
    const summary = ensureRoomSummary();
    if (summary) side.insertBefore(btn, summary.nextSibling);
  }

  function tick() {
    installCss();
    moveRoomSettings();
    moveDeleteButton();
    renderSummary();
  }

  window.addEventListener("DOMContentLoaded", () => {
    installCss();
    tick();
    setInterval(tick, 500);
  });
})();
