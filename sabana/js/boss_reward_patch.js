// SABANA boss reward patch v2
// 보스 처치 직후 증강 선택 + 보스 위치 아이템 드롭 + 오른쪽 다음 스테이지 포털.
(function () {
  if (window.__sabanaBossRewardPatchV2) return;
  window.__sabanaBossRewardPatchV2 = true;

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
        dropGrade: "legendary",
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
        dropGrade: "normal",
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
        dropGrade: "advanced",
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
        dropGrade: "epic",
      };
    }

    return {
      final: false,
      title: "보스 격파",
      coins: 350,
      exp: 180,
      shield: 45,
      healRatio: 0.28,
      dropGrade: "advanced",
    };
  }

  function clearBossArena() {
    if (!state) return;

    // 보스전 종료 직후에는 전장만 정리하고, 바닥 경험치/아이템은 남겨둔다.
    state.enemies = [];
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

      // 레벨업은 성장 카드만 지급한다. 증강은 보스 처치 보상으로만 지급.
      pendingAugmentAfterGrowth = false;
      openGrowthChoice();
      break;
    }
  };

  function createBossRewardDrop(reward, x, y) {
    if (!state || reward.final) return;

    const grade = reward.dropGrade || "advanced";
    const drop = createDropItem(grade);
    drop.x = clamp(x, 45, canvas.width - 45);
    drop.y = clamp(y, 45, canvas.height - 45);
    drop.r = grade === "legendary" ? 10 : grade === "epic" ? 9 : 8;
    drop.name = `보스 보상 · ${drop.name}`;
    drop.bossReward = true;

    state.drops.push(drop);
  }

  function setStageGateActive(reward) {
    if (!state || reward.final) return;

    state.stageGate = {
      active: true,
      x: canvas.width - 72,
      y: canvas.height / 2,
      r: 42,
      title: "다음 스테이지",
      desc: "오른쪽 포털로 이동",
      rewardTitle: reward.title,
    };

    state.paused = false;
    state.spawnMs = 900;
    state.player.invuln = Math.max(state.player.invuln || 0, 1.5);
    showBigAlert("재정비 시간", "아이템을 줍고 오른쪽 포털로 이동하세요");
  }

  function enterNextStage() {
    if (!state || !state.stageGate?.active) return;

    state.stageGate.active = false;
    state.stageGate = null;
    state.spawnMs = 0;
    state.player.invuln = Math.max(state.player.invuln || 0, 1.4);
    bossRewardContext = null;
    bossRewardSelecting = false;
    showBigAlert("다음 스테이지 진입", "전투 재개");
  }

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
      `보스 처치 보상입니다. 증강 1개를 선택하면 전장으로 돌아갑니다. 이번 판 남은 새로고침: ${rerollsLeft}회`;

    renderChoiceCards();
    choiceOverlay.classList.add("show");
  }

  function drawStageGate() {
    if (!state?.stageGate?.active || !ctx) return;

    const g = state.stageGate;
    const pulse = 1 + Math.sin(Date.now() / 180) * 0.08;

    ctx.save();
    ctx.translate(g.x, g.y);

    ctx.beginPath();
    ctx.fillStyle = "rgba(56,189,248,.14)";
    ctx.arc(0, 0, g.r * 1.55 * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 5;
    ctx.arc(0, 0, g.r * pulse, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 2;
    ctx.arc(0, 0, g.r * 0.66 * pulse, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.fillStyle = "rgba(250,204,21,.9)";
    ctx.moveTo(-10, -16);
    ctx.lineTo(15, 0);
    ctx.lineTo(-10, 16);
    ctx.closePath();
    ctx.fill();

    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#e0f2fe";
    ctx.fillText(g.title, 0, g.r + 26);
    ctx.font = "11px sans-serif";
    ctx.fillStyle = "#bae6fd";
    ctx.fillText(g.desc, 0, g.r + 42);

    ctx.restore();
  }

  function updateGateOnly(dt) {
    if (!state?.stageGate?.active) return;

    // 포털 대기 중에는 시간/스폰/적 패턴은 멈추고, 이동/아이템 회수만 허용한다.
    updateBuffs(dt);
    updatePlayer(dt);
    updateGemsAndDrops(dt);
    updateEffects(dt);
    updateFloating(dt);

    const g = state.stageGate;
    const dist = Math.hypot(state.player.x - g.x, state.player.y - g.y);

    if (dist < state.player.r + g.r) {
      enterNextStage();
    }
  }

  const originalUpdateSpawns = window.updateSpawns;
  window.updateSpawns = function patchedUpdateSpawns(dt) {
    if (state?.stageGate?.active) return;
    return originalUpdateSpawns(dt);
  };

  const originalUpdate = window.update;
  window.update = function patchedUpdate(dt) {
    if (state?.stageGate?.active) {
      updateGateOnly(dt);
      return;
    }

    return originalUpdate(dt);
  };

  const originalDraw = window.draw;
  window.draw = function patchedDraw() {
    originalDraw();
    drawStageGate();
  };

  const originalKillEnemy = window.killEnemy;
  window.killEnemy = function patchedKillEnemy(e, tags = []) {
    const reward = bossRewardByEnemy(e);
    const wasBossRewardTarget = !!reward && !e.dead;
    const deathX = e?.x || canvas.width / 2;
    const deathY = e?.y || canvas.height / 2;

    originalKillEnemy(e, tags);

    if (!wasBossRewardTarget || !state || reward.final) return;
    if (state._bossRewardOpenedFor === e.id) return;
    state._bossRewardOpenedFor = e.id;

    clearBossArena();
    createBossRewardDrop(reward, deathX, deathY);

    const bonusMul = 1 + (meta.upgrades.elite_bounty || 0) * 0.05;
    addRunCoins(Math.round(reward.coins * bonusMul));
    if (reward.exp) gainExpNoChoice(reward.exp);
    if (reward.shield) addShield(reward.shield);
    if (reward.healRatio) healPlayer(state.player.maxHp * reward.healRatio);

    rebuildStats();
    showBigAlert(reward.title, "증강 선택 후 오른쪽 포털로 이동");

    setTimeout(() => {
      if (state && state.running) {
        bossRewardContext = reward;
        openBossAugmentChoice(reward);
      }
    }, 30);
  };

  const originalSelectCurrentChoice = window.selectCurrentChoice;
  window.selectCurrentChoice = function patchedSelectCurrentChoice(item) {
    const wasBossReward = bossRewardSelecting && currentChoiceMode === "augment" && bossRewardContext;
    originalSelectCurrentChoice(item);

    if (wasBossReward && state && state.running && bossRewardContext) {
      setTimeout(() => setStageGateActive(bossRewardContext), 30);
    }
  };
})();