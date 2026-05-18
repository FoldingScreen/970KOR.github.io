(() => {
  "use strict";

  if (document.getElementById("dalmutiChatUiCss")) return;

  const style = document.createElement("style");
  style.id = "dalmutiChatUiCss";
  style.textContent = `
    .chat-list {
      display: flex !important;
      flex-direction: column !important;
      gap: 7px !important;
      padding: 8px !important;
    }

    .chat-msg {
      display: block !important;
      width: 100% !important;
      padding: 8px 10px !important;
      border-radius: 12px !important;
      background: rgba(255,255,255,.055) !important;
      border: 1px solid rgba(255,255,255,.08) !important;
      color: #e7ecf6 !important;
      font-size: 13px !important;
      line-height: 1.45 !important;
      word-break: break-word !important;
      box-sizing: border-box !important;
    }

    .chat-msg .chat-name {
      display: inline-flex !important;
      align-items: center !important;
      max-width: 100% !important;
      margin: 0 7px 3px 0 !important;
      padding: 2px 7px !important;
      border-radius: 999px !important;
      background: rgba(243,210,129,.14) !important;
      border: 1px solid rgba(243,210,129,.38) !important;
      color: #f3d281 !important;
      font-weight: 900 !important;
      font-size: 11px !important;
      line-height: 1.25 !important;
      vertical-align: baseline !important;
      white-space: nowrap !important;
    }

    .chat-msg.system {
      text-align: center !important;
      color: #aeb8c9 !important;
      background: rgba(111,179,255,.07) !important;
      border: 1px dashed rgba(111,179,255,.24) !important;
      font-size: 12px !important;
      font-weight: 800 !important;
    }

    .chat-input-row {
      gap: 7px !important;
    }

    .chat-input-row .input {
      min-width: 0 !important;
    }
  `;
  document.head.appendChild(style);
})();
