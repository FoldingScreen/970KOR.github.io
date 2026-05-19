// SABANA permanent UI patch v1
// 6차 적용: 보관함 UI + 재료/다이아 확인 + 영구 아이템 강화.
(function () {
  if (window.__sabanaPermanentUiPatchV1) return;
  window.__sabanaPermanentUiPatchV1 = true;

  function materials() {
    return window.SABANA_MATERIALS || {
      guardian_core: { name: "수문장 핵" },
      brute_plate: { name: "파쇄자의 장갑" },
      dark_crest: { name: "암흑 문장" },
      lord_eye: { name: "군주의 눈동자" },
      primal_dust: { name: "원초 가루" },
      mythic_splinter: { name: "신화 파편" },
    };
  }

  function permanentItems() {
    return window.SABANA_PERMANENT_ITEMS || {
      cracked_amulet: {
        name: "금 간 부적",
        desc: "시작 보호막과 최대 HP를 조금 올립니다.",
        max: 5,
        effect(lv) { return `시작 보호막 +${lv * 8}, 최대 HP +${lv * 5}`; },
      },
      hunter_badge: {
        name: "사냥꾼 배지",
        desc: "전투 시작 시 공격력과 보스 피해를 올립니다.",
        max: 5,
        effect(lv) { return `공격력 +${lv * 3}%, 보스 피해 +${lv * 4}%`; },
      },
      magnet_charm: {
        name: "자력 부적",
        desc: "시작 자석범위와 경험치 획득량을 올립니다.",
        max: 5,
        effect(lv) { return `자석범위 +${lv * 12}, 경험치 +${lv * 2}%`; },
      },
      ember_ring: {
        name: "잿불 반지",
        desc: "화상/피해 계열 빌드에 유리한 영구 아이템입니다.",
        max: 5,
        effect(lv) { return `모든 피해 +${lv * 2}%, 화상 계열 보너스 +${lv * 3}%`; },
      },
    };
  }

  function ensureMeta() {
    if (!meta) return;
    if (typeof meta.diamonds !== "number") meta.diamonds = 0;
    if (!meta.materials) meta.materials = {};
    if (!meta.permanentItems) meta.permanentItems = {};
    for (const id of Object.keys(materials())) meta.materials[id] = Number(meta.materials[id] || 0);
    for (const id of Object.keys(permanentItems())) meta.permanentItems[id] = Number(meta.permanentItems[id] || 0);
  }

  function costForItem(id, lv) {
    const base = {
      cracked_amulet: { dia: 35, mat: "guardian_core", matBase: 1, dust: 1 },
      hunter_badge: { dia: 45, mat: "brute_plate", matBase: 1, dust: 1 },
      magnet_charm: { dia: 40, mat: "guardian_core", matBase: 1, dust: 2 },
      ember_ring: { dia: 60, mat: "dark_crest", matBase: 1, dust: 2 },
    }[id] || { dia: 50, mat: "primal_dust", matBase: 2, dust: 0 };

    const next = lv + 1;
    return {
      diamonds: Math.round(base.dia * Math.pow(1.55, lv)),
      materials: {
        [base.mat]: base.matBase + lv,
        primal_dust: base.dust + Math.floor(lv * 1.4),
        ...(next >= 4 ? { mythic_splinter: 1 } : {}),
      },
    };
  }

  function canPay(cost) {
    ensureMeta();
    if ((meta.diamonds || 0) < cost.diamonds) return false;
    return Object.entries(cost.materials || {}).every(([id, amount]) => (meta.materials[id] || 0) >= amount);
  }

  function pay(cost) {
    meta.diamonds -= cost.diamonds;
    for (const [id, amount] of Object.entries(cost.materials || {})) {
      meta.materials[id] = Math.max(0, (meta.materials[id] || 0) - amount);
    }
  }

  function materialText(cost) {
    const defs = materials();
    const lines = Object.entries(cost.materials || {})
      .filter(([, amount]) => amount > 0)
      .map(([id, amount]) => `${defs[id]?.name || id} ${amount}`);
    return [`다이아 ${cost.diamonds}`, ...lines].join(" / ");
  }

  function ensureStorageOverlay() {
    let overlay = document.getElementById("permanentStorageOverlay");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "permanentStorageOverlay";
    overlay.className = "overlay";
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-head">
          <button class="mini-btn secondary" id="permanentStorageBackBtn">← 닫기</button>
          <div>
            <h2>보관함 / 영구 강화</h2>
            <p>다이아와 보스 재료로 영구 아이템을 강화합니다.</p>
          </div>
        </div>
        <div id="permanentSummary" class="point-box" style="margin-bottom:12px;"></div>
        <div class="tabs">
          <button class="tab active" id="storageItemTab">영구 아이템</button>
          <button class="tab" id="storageMaterialTab">재료</button>
        </div>
        <div id="permanentStorageList" class="codex-list"></div>
      </div>
    `;

    document.querySelector(".canvas-wrap")?.appendChild(overlay);
    overlay.querySelector("#permanentStorageBackBtn").addEventListener("click", closePermanentStorage);
    overlay.querySelector("#storageItemTab").addEventListener("click", () => setPermanentStorageTab("items"));
    overlay.querySelector("#storageMaterialTab").addEventListener("click", () => setPermanentStorageTab("materials"));
    return overlay;
  }

  let storageTab = "items";

  function setPermanentStorageTab(tab) {
    storageTab = tab;
    const overlay = ensureStorageOverlay();
    overlay.querySelector("#storageItemTab").classList.toggle("active", tab === "items");
    overlay.querySelector("#storageMaterialTab").classList.toggle("active", tab === "materials");
    renderPermanentStorage();
  }

  function renderPermanentStorage() {
    ensureMeta();
    const overlay = ensureStorageOverlay();
    const summary = overlay.querySelector("#permanentSummary");
    const list = overlay.querySelector("#permanentStorageList");

    summary.innerHTML = `보유 다이아: <strong>${Math.floor(meta.diamonds || 0)}</strong> · 보유 코인: <strong>${Math.floor(meta.coins || 0)}</strong>`;
    list.innerHTML = "";

    if (storageTab === "materials") {
      for (const [id, def] of Object.entries(materials())) {
        const amount = meta.materials[id] || 0;
        const div = document.createElement("div");
        div.className = "codex-item";
        div.innerHTML = `<h3>${def.name}</h3><div class="effect">보유량: ${amount}</div>`;
        list.appendChild(div);
      }
      return;
    }

    for (const [id, def] of Object.entries(permanentItems())) {
      const lv = meta.permanentItems[id] || 0;
      const max = def.max || 5;
      const maxed = lv >= max;
      const cost = maxed ? null : costForItem(id, lv);
      const possible = cost ? canPay(cost) : false;
      const div = document.createElement("div");
      div.className = "codex-item";
      div.innerHTML = `
        <h3>${def.name} <span style="font-size:12px; color:#93c5fd;">Lv.${lv}/${max}</span></h3>
        <div class="effect">
          ${def.desc}<br />
          현재: ${lv > 0 ? def.effect(lv) : "미보유"}<br />
          ${maxed ? "최대 레벨입니다." : `다음: ${def.effect(lv + 1)}<br />비용: ${materialText(cost)}`}
        </div>
        <button class="mini-btn" ${possible ? "" : "disabled"} data-upgrade-id="${id}">${maxed ? "MAX" : "강화"}</button>
      `;
      list.appendChild(div);
    }

    list.querySelectorAll("button[data-upgrade-id]").forEach(btn => {
      btn.addEventListener("click", () => upgradePermanentItem(btn.getAttribute("data-upgrade-id")));
    });
  }

  async function upgradePermanentItem(id) {
    ensureMeta();
    const def = permanentItems()[id];
    if (!def) return;
    const lv = meta.permanentItems[id] || 0;
    if (lv >= (def.max || 5)) return;

    const cost = costForItem(id, lv);
    if (!canPay(cost)) {
      showToast("다이아 또는 재료가 부족합니다.");
      return;
    }

    pay(cost);
    meta.permanentItems[id] = lv + 1;
    await saveMeta();
    showToast(`${def.name} Lv.${lv + 1} 강화 완료`);
    renderPermanentStorage();
    updateUi();
  }

  function openPermanentStorage() {
    ensureMeta();
    titleOverlay.classList.remove("show");
    labOverlay.classList.remove("show");
    codexOverlay.classList.remove("show");
    weaponOverlay.classList.remove("show");
    ensureStorageOverlay().classList.add("show");
    renderPermanentStorage();
  }

  function closePermanentStorage() {
    ensureStorageOverlay().classList.remove("show");
    titleOverlay.classList.add("show");
    updateUi();
  }

  function addStorageButton() {
    const menu = document.querySelector("#titleOverlay .menu-row");
    if (!menu || document.getElementById("openPermanentStorageBtn")) return;
    const btn = document.createElement("button");
    btn.id = "openPermanentStorageBtn";
    btn.className = "secondary";
    btn.textContent = "보관함 / 영구 강화";
    btn.addEventListener("click", openPermanentStorage);
    const codexBtn = [...menu.children].find(el => String(el.textContent || "").includes("증강"));
    if (codexBtn && codexBtn.nextSibling) menu.insertBefore(btn, codexBtn.nextSibling);
    else menu.appendChild(btn);
  }

  const oldUpdateUi = window.updateUi;
  window.updateUi = function patchedPermanentUiUpdateUi() {
    oldUpdateUi();
    addStorageButton();
    ensureMeta();
    const coinBox = document.getElementById("titleCoins");
    if (coinBox && !document.getElementById("titleDiamondsInline")) {
      const span = document.createElement("span");
      span.id = "titleDiamondsInline";
      span.innerHTML = ` · 다이아: <strong>${Math.floor(meta.diamonds || 0)}</strong>`;
      coinBox.parentElement?.appendChild(span);
    } else {
      const span = document.getElementById("titleDiamondsInline");
      if (span) span.innerHTML = ` · 다이아: <strong>${Math.floor(meta.diamonds || 0)}</strong>`;
    }
  };

  window.openPermanentStorage = openPermanentStorage;
  window.closePermanentStorage = closePermanentStorage;
  window.setPermanentStorageTab = setPermanentStorageTab;

  window.addEventListener("DOMContentLoaded", addStorageButton);
})();