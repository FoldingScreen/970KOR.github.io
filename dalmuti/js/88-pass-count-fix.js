(() => {
  "use strict";

  const lastCardCountByName = new Map();

  function cleanName(box) {
    return String(box.querySelector(".player-name")?.textContent || "").trim();
  }

  function rememberCounts() {
    document.querySelectorAll(".player-box").forEach(box => {
      const name = cleanName(box);
      const meta = box.querySelector(".player-meta");
      const text = String(meta?.textContent || "").trim();
      const match = text.match(/(\d+)장/);
      if (name && match) lastCardCountByName.set(name, `${match[1]}장`);
    });
  }

  function restorePassedCounts() {
    document.querySelectorAll(".player-box.passed").forEach(box => {
      const name = cleanName(box);
      const meta = box.querySelector(".player-meta");
      if (!name || !meta) return;

      const text = String(meta.textContent || "").trim();
      if (!text.startsWith("패스")) return;

      const countText = lastCardCountByName.get(name);
      if (!countText) return;

      meta.textContent = text.includes("준비") ? `${countText} · 준비` : countText;
    });
  }

  function patch() {
    rememberCounts();
    restorePassedCounts();
  }

  function init() {
    patch();
    const observer = new MutationObserver(patch);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class"]
    });
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
