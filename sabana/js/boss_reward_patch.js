// SABANA boss reward patch v1
// 2차 적용: 레벨업 증강 제거 + 보스 처치 보상/증강/재정비 구간.
(function () {
  if (window.__sabanaBossRewardPatchV1) return;
  window.__sabanaBossRewardPatchV1 = true;

  let bossRewardContext = null;
  let bossRewardSelecting = false;

  function bossRewardByEnemy(e) {
    if (!e) return null;

    if (e.boss) {
      return {
        final: true,
        title: "최종보스 격파",
        coins: 1200,
        exp: 0,
        shield: 0,
        healRatio: 0,
      };
    }

    if (!e.midBoss) return null;

    if (e.id === "mid_guardian") {
      return {
        final: false,
        title: "수문장 격파",
        coins: 260,
        exp: 120,
        shield: 35,
        healRatio: 0.25,
      };
    }

    if (e.id === "wave_brute") {
      return {
        final: false,
        title: "파쇄자 격파",
        coins: 420,
        exp: 220,
        shield: 55,
        healRatio: 0.3,
      };
    }

    if (e.id === "dark_knight") {
      return {
        final: false,
        title: "암흑 기사 격파",
        coins: 650,
        exp: 360,
        shield: 80,
        healRatio: 0.35,
      };
    }

    return {
      final: false,
      title: "보스 격파",
      coins: 350,
      exp: 180,
      shield: 45,
      healRatio: 0.28,
    };
  }

  function collectArenaRewards() {
    if (!state) return;

    for (const g of state.gems || []) {
      if (g && g.exp) gainExpNoChoice(g.exp);
    }
    state.gems = [];

    for (const d of state.drops || []) {
      if (d) applyDrop(d);
    }
    state.drops = [];
  }

  function clearBossArena() {
    if (!state) return;
    state.enemies = state.enemies.filter(e => e.hp > 0 && !e.dead && (e.boss || e.midBoss));
    state.enemyProjectiles = [];
    state.projectiles = [];
    state.spawnMs = 900;
    state.player.invuln = Math.max(state.player.invuln || 0, 1.2);
  }

  function gainExpNoChoice(amount) {
    if (!state || !amount) return;
    state.exp += amount;

    while (state.exp >= getExpToNext(state.level)) {
      const need = getExpToNext(state.level);
      state.exp -= need;
      state.level += 1;
      rebuildStats();
      showToast(`Lv.${state.level}`);
    }
  }

  window.gainExp = function gainExp(amount) {
    if (!state || !amount) return;
    state.exp += amount;

    while (state.exp >= getExpToNext(state.level)) {
      const need = getExpToNext(state.level);
      state.exp -= need;
      state.level += 1;
      rebuildStats();

      // 변경: 레벨업은 성장 카드만 지급한다. 증강은 보스 처치 보상으로만 지급.
      pendingAugmentAfterGrowth = false;
      openGrowthChoice();
      break;
    }
  };

  function openBossAugmentChoice(reward) {
    if (!state) return;

    bossRewardSelecting = true;
    state.paused = true;
    resetTouchMove();

    currentChoiceMode = "augment";
    currentChoices = rollAugmentChoices();
    rerollsLeft = state.rerollsLeft || 0;

    rerollBtn.style.display = "inline-block";
    choiceTitle.textContent = `${reward.title} · 증강 선택`;
    choiceDesc.textContent =
      `보스 처치 보상입니다. 증강 1개를 선택하면 재정비 구역으로 이동합니다. 이번 판 남은 새로고침: ${rerollsLeft}회`;

    renderChoiceCards();
    choiceOverlay.classList.add("show");
  }

  function ensureRestockOverlay() {
    let overlay = document.getElementById("restockOverlay");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "restockOverlay";
    overlay.className = "overlay";
    overlay.innerHTML = `
      <div class="modal center">
        <h2 id="restockTitle">재정비 구역</h2>
        <p id="restockDesc"></p>
        <div id="restockCards" class="cards"></div>
        <div class="menu-row" style="margin-top:14px;">
          <button id="restockContinueBtn">다음 라운드로</button>
        </div>
      </div>
    `;

    const wrap = document.querySelector(".canvas-wrap") || document.body;
    wrap.appendChild(overlay);

    overlay.querySelector("#restockContinueBtn").addEventListener("click", () => {
      overlay.classList.remove("show");
      if (state) {
        state.paused = false;
        state.player.invuln = Math.max(state.player.invuln || 0, 1.0);
      }
      bossRewardContext = null;
      bossRewardSelecting = false;
      showToast("다음 라운드 시작");
    });

    return overlay;
  }

  function makeRestockOptions(reward) {
    const stageBoost = reward.title.includes("암흑") ? 1.8 : reward.title.includes("파쇄") ? 1.35 : 1;
    return [
      {
        name: "HP 회복",
        desc: `전투 코인 ${Math.round(140 * stageBoost)} 소모\n최대 HP의 35% 회복`,
        cost: Math.round(140 * stageBoost),
        run() { healPlayer(state.player.maxHp * 0.35); },
      },
      {
        name: "보호막 보급",
        desc: `전투 코인 ${Math.round(170 * stageBoost)} 소모\n보호막 ${Math.round(45 * stageBoost)} 획득`,
        cost: Math.round(170 * stageBoost),
        run() { addShield(Math.round(45 * stageBoost)); },
      },
      {
        name: "경험치 보급",
        desc: `전투 코인 ${Math.round(220 * stageBoost)} 소모\n경험치 ${Math.round(140 * stageBoost)} 획득`,
        cost: Math.round(220 * stageBoost),
        run() { gainExpNoChoice(Math.round(140 * stageBoost)); },
      },
      {
        name: "임시 화력 증폭",
        desc: `전투 코인 ${Math.round(260 * stageBoost)} 소모\n다음 45초간 공격력 +20%`,
        cost: Math.round(260 * stageBoost),
        run() { addTimedBuff("damage", 1.2, 45); },
      },
    ];
  }

  function openRestockOverlay(reward) {
    if (!state) return;

    const overlay = ensureRestockOverlay();
    const title = overlay.querySelector("#restockTitle");
    const desc = overlay.querySelector("#restockDesc");
    const cards = overlay.querySelector("#restockCards");

    title.textContent = `${reward.title} · 재정비 구역`;
    desc.textContent = "전투 코인을 써서 다음 라운드를 준비하세요. 구매하지 않고 바로 진행할 수도 있습니다.";
    cards.innerHTML = "";

    const options = makeRestockOptions(reward);
    for (const opt of options) {
      const div = document.createElement("div");
      div.className = "card";
      div.innerHTML = `
        <div class="type-label">재정비 보급</div>
        <h3>${opt.name}</h3>
        <div class="desc">${opt.desc.replace(/\n/g, "<br />")}</div>
      `;
      div.onclick = () => {
        if (state.runCoins < opt.cost) {
          showToast("전투 코인이 부족합니다.");
          return;
        }
        state.runCoins -= opt.cost;
        opt.run();
        rebuildStats();
        div.classList.add("disabled");
        div.onclick = null;
        showToast(`${opt.name} 구매 완료`);
        updateUi();
      };
      cards.appendChild(div);
    }

    state.paused = true;
    overlay.classList.add("show");
  }

  const originalKillEnemy = window.killEnemy;
  window.killEnemy = function patchedKillEnemy(e, tags = []) {
    const reward = bossRewardByEnemy(e);
    const wasBossRewardTarget = !!reward && !e.dead;

    originalKillEnemy(e, tags);

    if (!wasBossRewardTarget || !state || reward.final) return;
    if (state._bossRewardOpenedFor === e.id) return;
    state._bossRewardOpenedFor = e.id;

    collectArenaRewards();
    clearBossArena();

    const bonusMul = 1 + (meta.upgrades.elite_bounty || 0) * 0.05;
    addRunCoins(Math.round(reward.coins * bonusMul));
    if (reward.exp) gainExpNoChoice(reward.exp);
    if (reward.shield) addShield(reward.shield);
    if (reward.healRatio) healPlayer(state.player.maxHp * reward.healRatio);

    rebuildStats();
    showBigAlert(reward.title, "증강 선택 + 재정비 구역 개방");

    setTimeout(() => {
      if (state && state.running) {
        bossRewardContext = reward;
        openBossAugmentChoice(reward);
      }
    }, 50);
  };

  const originalSelectCurrentChoice = window.selectCurrentChoice;
  window.selectCurrentChoice = function patchedSelectCurrentChoice(item) {
    const wasBossReward = bossRewardSelecting && currentChoiceMode === "augment" && bossRewardContext;
    originalSelectCurrentChoice(item);

    if (wasBossReward && state && state.running && bossRewardContext) {
      state.paused = true;
      setTimeout(() => openRestockOverlay(bossRewardContext), 30);
    }
  };
})();