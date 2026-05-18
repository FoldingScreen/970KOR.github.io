(() => {
  "use strict";

  const KING_SVG = "./cards/card-01-king.svg?v=20260518-king1";
  const TARGETS = ["card-01-sabana.png", "card-01-king.png"];

  function isKingCardSrc(src = "") {
    return TARGETS.some(name => String(src).includes(name));
  }

  function patchImages(root = document) {
    root.querySelectorAll?.("img").forEach(img => {
      const src = img.getAttribute("src") || img.src || "";
      if (!isKingCardSrc(src)) return;
      if (src.includes("card-01-king.svg")) return;
      img.setAttribute("src", KING_SVG);
      img.setAttribute("alt", "임금");
    });
  }

  function init() {
    patchImages();
    const observer = new MutationObserver(() => patchImages());
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src"]
    });
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
