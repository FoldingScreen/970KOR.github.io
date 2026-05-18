(() => {
  "use strict";

  const NEW_SRC = "./cards/card-01-imguem.png?v=20260518-imguem1";
  const OLD_NAMES = ["card-01-sabana.png", "card-01-king.png", "card-01-imgeum.png"];

  function shouldReplace(src = "") {
    return OLD_NAMES.some(name => String(src).includes(name));
  }

  function patchImages(root = document) {
    root.querySelectorAll?.("img").forEach(img => {
      const src = img.getAttribute("src") || img.src || "";
      if (!shouldReplace(src)) return;
      if (src.includes("card-01-imguem.png")) return;
      img.setAttribute("src", NEW_SRC);
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
