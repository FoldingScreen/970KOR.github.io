// SABANA permanent reward patch v1
// 5차 적용: 전투 코인/영구 재화 분리 + 다이아 + 보스 재료 + 영구 아이템 기본 구조.
(function () {
  if (window.__sabanaPermanentRewardPatchV1) return;
  window.__sabanaPermanentRewardPatchV1 = true;

  const MATERIALS = {
    guardian_core: { name: "수문장 핵", boss: "mid_guardian" },
    brute_plate: { name: "파쇄자의 장갑", boss: "wave_brute" },
    dark_crest: { name: "암흑 문장", boss: "dark_knight" },
    lord_eye: { name: "군주의 눈동자", boss: "sabana_lord" },
    primal_dust: { name: "원초 가루", boss: "common" },
    mythic_splinter: { name: "신화 파편", boss: "rare" },
  };

  const PERMANENT_ITEMS = {
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

  function ensurePermanentMeta(target = meta) {
    if (!target) return target;
    if (typeof target.diamonds !== "number") target.diamonds = 0;
    if (!target.materials) target.materials = {};
    if (!target.permanentItems) target.permanentItems = {};
    if (!target.bestClearMs) target.bestClearMs = 0;
    for (const id of Object.keys(MATERIALS)) target.materials[id] = Number(target.materials[id] || 0);
    for (const id of Object.keys(PERMANENT_ITEMS)) target.permanentItems[id] = Number(target.permanentItems[id] || 0);
    return target;
  }

  const oldDefaultMeta = window.defaultMeta;
  window.defaultMeta = function patchedDefaultMeta() {
    return ensurePermanentMeta(oldDefaultMeta());
  };

  if (typeof meta !== "undefined") ensurePermanentMeta(meta);

  const oldLoadMeta = window.loadMetaFromFirestore;
  window.loadMetaFromFirestore = async function patchedLoadMetaFromFirestore() {
    const loaded = await oldLoadMeta();
    return ensurePermanentMeta(loaded);
  };

  window.saveMeta = async function patchedSaveMeta() {
    if (!linkedUser) return;
    ensurePermanentMeta(meta);
    try {
      await sabanaUserRef().set({
        nickname: linkedUser,
        coins: Number(meta.coins || 0),
        diamonds: Number(meta.diamonds || 0),
        materials: meta.materials || {},
        permanentItems: meta.permanentItems || {},
        bestTimeMs: Number(meta.bestTimeMs || 0),
        bestClearMs: Number(meta.bestClearMs || 0),
        bestKills: Number(meta.bestKills || 0),
        totalCoins: Number(meta.totalCoins || 0),
        upgrades: meta.upgrades || {},
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    } catch (err) {
      console.error("SABANA 저장 실패", err);
      if (typeof showToast === "function") showToast("저장 실패: 네트워크를 확인하세요.");
    }
  };

  function ensureRunRewardState() {
    if (!state) return;
    if (!state.permanentReward) {
      state.permanentReward = {
        bossKills: {},
        materials: {},
        itemDrops: [],
      };
    }
  }

  function addRunMaterial(id, amount) {
    ensureRunRewardState();
    if (!state?.permanentReward) return;
    state.permanentReward.materials[id] = (state.permanentReward.materials[id] || 0) + amount;
  }

  function rollMaterialFromBoss(e) {
    if (!e) return;
    ensureRunRewardState();

    if (e.id === "mid_guardian") {
      addRunMaterial("guardian_core", 1);
      if (Math.random() < 0.18) addRunMaterial("primal_dust", 1);
    } else if (e.id === "wave_brute") {
      addRunMaterial("brute_plate", 1);
      if (Math.random() < 0.28) addRunMaterial("primal_dust", 1 + Math.floor(Math.random() * 2));
    } else if (e.id === "dark_knight") {
      addRunMaterial("dark_crest", 1);
      if (Math.random() < 0.12) addRunMaterial("mythic_splinter", 1);
      if (Math.random() < 0.4) addRunMaterial("primal_dust", 2);
    } else if (e.id === "sabana_lord") {
      addRunMaterial("lord_eye", 1);
      addRunMaterial("mythic_splinter", 1);
      if (Math.random() < 0.35) addRunMaterial("mythic_splinter", 1);
    }
  }

  function rollPermanentItem(e) {
    if (!e || !state) return;
    ensureRunRewardState();

    let chance = 0;
    if (e.id === "mid_guardian") chance = 0.04;
    else if (e.id === "wave_brute") chance = 0.07;
    else if (e.id === "dark_knight") chance = 0.11;
    else if (e.id === "sabana_lord") chance = 0.28;

    if (Math.random() > chance) return;

    const ids = Object.keys(PERMANENT_ITEMS);
    const id = ids[Math.floor(Math.random() * ids.length)];
    state.permanentReward.itemDrops.push(id);
    showBigAlert("영구 아이템 획득!", PERMANENT_ITEMS[id].name);
  }

  const oldMakeState = window.makeState;
  window.makeState = function patchedMakeState(weapon) {
    const s = oldMakeState(weapon);
    s.permanentReward = { bossKills: {}, materials: {}, itemDrops: [] };
    return s;
  };

  const oldRebuildStats = window.rebuildStats;
  window.rebuildStats = function patchedPermanentRebuildStats() {
    oldRebuildStats();
    if (!state) return;
    ensurePermanentMeta(meta);
    const items = meta.permanentItems || {};

    const amulet = items.cracked_amulet || 0;
    const badge = items.hunter_badge || 0;
    const magnet = items.magnet_charm || 0;
    const ember = items.ember_ring || 0;

    if (amulet > 0) {
      state.player.maxHp += amulet * 5;
      state.player.shield += state.timeMs <= 0 ? amulet * 8 : 0;
      state.player.hp = Math.min(state.player.maxHp, state.player.hp);
    }
    if (badge > 0) {
      state.base.damageMul *= 1 + badge * 0.03;
      state.base.bossDamageMul = (state.base.bossDamageMul || 1) * (1 + badge * 0.04);
    }
    if (magnet > 0) {
      state.player.magnetRange += magnet * 12;
      state.base.expMul *= 1 + magnet * 0.02;
    }
    if (ember > 0) {
      state.base.damageMul *= 1 + ember * 0.02;
      state.perks.burnChance = (state.perks.burnChance || 0) + ember * 0.01;
      state.perks.burnSpreadChance = (state.perks.burnSpreadChance || 0) + ember * 0.01;
    }
  };

  const oldKillEnemy = window.killEnemy;
  window.killEnemy = function patchedPermanentKillEnemy(e, tags = []) {
    const wasAliveBoss = e && !e.dead && (e.midBoss || e.boss);
    const bossId = e?.id;
    oldKillEnemy(e, tags);
    if (!wasAliveBoss || !state) return;
    ensureRunRewardState();
    state.permanentReward.bossKills[bossId] = (state.permanentReward.bossKills[bossId] || 0) + 1;
    rollMaterialFromBoss(e);
    rollPermanentItem(e);
  };

  function calcDiamonds(success) {
    const seconds = Math.floor((state?.timeMs || 0) / 1000);
    const stageCount = Object.values(state?.permanentReward?.bossKills || {}).reduce((a, b) => a + b, 0);
    const base = Math.floor(seconds / 60) * 2;
    const boss = stageCount * 8;
    const level = Math.floor((state?.level || 1) / 5) * 2;
    const clear = success ? 45 : 0;
    return Math.max(0, base + boss + level + clear);
  }

  function applyPermanentRewards(success, earnedCoins) {
    ensurePermanentMeta(meta);
    ensureRunRewardState();

    const diamonds = calcDiamonds(success);
    meta.diamonds += diamonds;

    for (const [id, amount] of Object.entries(state.permanentReward.materials || {})) {
      meta.materials[id] = (meta.materials[id] || 0) + amount;
    }

    const gainedItems = [];
    for (const id of state.permanentReward.itemDrops || []) {
      const max = PERMANENT_ITEMS[id]?.max || 5;
      if ((meta.permanentItems[id] || 0) < max) {
        meta.permanentItems[id] = (meta.permanentItems[id] || 0) + 1;
        gainedItems.push(PERMANENT_ITEMS[id].name);
      } else {
        meta.diamonds += 10;
        gainedItems.push(`${PERMANENT_ITEMS[id].name} 중복 → 다이아 10`);
      }
    }

    if (success) meta.bestClearMs = meta.bestClearMs ? Math.min(meta.bestClearMs, state.timeMs) : state.timeMs;

    return { diamonds, materials: state.permanentReward.materials || {}, gainedItems };
  }

  function renderRewardHtml(reward) {
    const materialLines = Object.entries(reward.materials || {})
      .filter(([, amount]) => amount > 0)
      .map(([id, amount]) => `${MATERIALS[id]?.name || id} × ${amount}`);

    return `
      <hr style="border-color:rgba(255,255,255,.12); margin:12px 0;" />
      <strong style="color:#67e8f9;">영구 보상</strong><br />
      다이아: <strong>${reward.diamonds}</strong><br />
      ${materialLines.length ? `재료: <strong>${materialLines.join(", ")}</strong><br />` : "재료: 없음<br />"}
      ${reward.gainedItems.length ? `영구 아이템: <strong>${reward.gainedItems.join(", ")}</strong><br />` : "영구 아이템: 없음<br />"}
      보유 다이아: <strong>${Math.floor(meta.diamonds || 0)}</strong>
    `;
  }

  window.endGame = async function patchedPermanentEndGame(success) {
    if (!state || state.rewardClaimed) return;
    state.running = false;
    state.paused = true;
    resetTouchMove();
    cancelAnimationFrame(loopId);

    const survivalBase = Math.floor(state.timeMs / 1000);
    const survivalCoins = Math.round((survivalBase / 4) * (1 + (meta.upgrades.survival_coin || 0) * 0.02));
    const killCoins = Math.round(state.kills * 0.6 * (1 + (meta.upgrades.kill_coin || 0) * 0.02));
    const levelCoins = state.level * 8;
    const synergyCoins = state.activeSynergies.size * 35;
    const augmentCoins = state.augments.length * 25;
    const successBonus = success ? 250 : 0;

    let earned = state.runCoins + survivalCoins + killCoins + levelCoins + synergyCoins + augmentCoins + successBonus;
    const jackpotChance = (meta.upgrades.jackpot || 0) * 0.01;
    const jackpot = Math.random() < jackpotChance;
    if (jackpot) earned *= 2;
    earned = Math.round(earned);

    const permanentReward = applyPermanentRewards(success, earned);

    meta.coins += earned;
    meta.totalCoins += earned;
    meta.bestTimeMs = Math.max(meta.bestTimeMs || 0, state.timeMs);
    meta.bestKills = Math.max(meta.bestKills || 0, state.kills);
    state.rewardClaimed = true;
    await saveMeta();

    resultTitle.textContent = success ? "최종보스 처치 성공!" : "실패";
    resultDesc.innerHTML = `생존 시간: <strong>${formatTime(state.timeMs)}</strong><br>레벨: <strong>${state.level}</strong><br>처치 수: <strong>${state.kills}</strong><br>증강 수: <strong>${state.augments.length}</strong><br>발현 시너지 수: <strong>${state.activeSynergies.size}</strong><br>획득 아이템: <strong>${state.itemStats.total}</strong><br>획득 보석: <strong>${state.itemStats.gems}</strong><br>전투 중 코인: <strong>${state.runCoins}</strong><br>정산 코인: <strong>${earned - state.runCoins}</strong><br>${jackpot ? `<strong style="color:#facc15;">대박 보상 2배 발동!</strong><br>` : ""}총 획득 코인: <strong>${earned}</strong><br>보유 코인: <strong>${Math.floor(meta.coins)}</strong>
      ${renderRewardHtml(permanentReward)}
      ${renderRunSummaryHtml()}
    `;
    resultOverlay.classList.add("show");
  };

  window.SABANA_MATERIALS = MATERIALS;
  window.SABANA_PERMANENT_ITEMS = PERMANENT_ITEMS;
})();