(() => {
  "use strict";

  const lastCardCountByName = new Map();

  function cleanName(box) {
    return String(box.querySelector(".player-name")?.textContent || "").trim();
  }

  function metaText(box) {
    return String(box.querySelector(".player-meta")?.textContent || "").trim();
  }

  function isPassedBox(box) {
    return box.classList.contains("passed") || /^패스/.test(metaText(box)) || !!box.querySelector(".badge.pass");
  }

  function rememberCounts() {
    document.querySelectorAll(".player-box").forEach(box => {
      const name = cleanName(box);
      const text = metaText(box);
      const match = text.match(/(\d+)장/);
      if (name && match) lastCardCountByName.set(name, `${match[1]}장`);
    });
  }

  function ensurePassBadge(box) {
    if (!isPassedBox(box)) return;
    box.classList.add("passed");

    let badge = box.querySelector(".badge.pass");
    if (!badge) {
      badge = document.createElement("div");
      badge.className = "badge pass";
      badge.textContent = "패스";
      box.appendChild(badge);
    }

    badge.style.display = "inline-block";
    badge.style.visibility = "visible";
    badge.style.opacity = "1";
  }

  function restorePassedCounts() {
    document.querySelectorAll(".player-box").forEach(box => {
      if (!isPassedBox(box)) return;
      ensurePassBadge(box);

      const name = cleanName(box);
      const meta = box.querySelector(".player-meta");
      if (!name || !meta) return;

      const text = metaText(box);
      const countText = lastCardCountByName.get(name);
      if (!countText) return;

      if (text.startsWith("패스") || !/(\d+)장/.test(text)) {
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
      attributeFilter: ["class", "style"]
    });
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
