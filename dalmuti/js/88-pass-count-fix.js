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

  function ensurePassBadge(box) {
    if (!box.classList.contains("passed")) return;
    if (box.querySelector(".badge.pass")) return;

    const badge = document.createElement("div");
    badge.className = "badge pass";
    badge.textContent = "패스";
    box.appendChild(badge);
  }

  function restorePassedCounts() {
    document.querySelectorAll(".player-box.passed").forEach(box => {
      ensurePassBadge(box);

      const name = cleanName(box);
      const meta = box.querySelector(".player-meta");
      if (!name || !meta) return;

      const text = String(meta.textContent || "").trim();
      const countText = lastCardCountByName.get(name);
      if (!countText) return;

      if (text.startsWith("패스")) {
        meta.textContent = text.includes("준비") ? `${countText} · 준비` : countText;
        return;
      }

      if (!/(\d+)장/.test(text)) {
        meta.textContent = text.includes("준비") ? `${countText} · 준비` : countText;
      }
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
