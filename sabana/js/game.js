let meta = defaultMeta();
let labTab = "basic";
let codexTab = "augments";
let state = null;
let lastTs = 0;
let loopId = null;
let currentChoices = [];
let currentChoiceMode = "growth";
let pendingAugmentAfterGrowth = false;
let rerollsLeft = 0;

function resizeCanvasForDevice() {
  const isMobile = window.innerWidth <= 1000;
  if (state && state.running) return;
  if (isMobile) {
    canvas.width = 540;
    canvas.height = 840;
  } else {
    canvas.width = 960;
    canvas.height = 540;
  }
}

function makeState(weapon) {
  const u = meta.upgrades;
  const hp = 100 + u.hp * 25;
  return {
    running: false,
    paused: true,
    rewardClaimed: false,
    timeMs: 0,
    spawnMs: 0,
    attackMs: 0,
    auraMs: 0,
    overExp: 0,
    level: 1,
    exp: 0,
    kills: 0,
    runCoins: 0,
    augments: [],
    attrsFromAugments: {},
    attrsFromGems: {},
    activeSynergies: new Set(),
    announcedSynergies: new Set(),
    weapon: JSON.parse(JSON.stringify(weapon)),
    growth: {
      damage: 0,
      attackSpeed: 0,
      area: 0,
      move: 0,
      hp: 0,
      defense: 0,
      magnet: 0,
      knockback: 0,
      exp: 0,
      projectile: 0,
      pierce: 0,
      projectileSpeed: 0,
      auraTick: 0,
      orbitCount: 0,
      orbitSpeed: 0,
      weaponSize: 0,
    },
    player: {
      x: canvas.width / 2,
      y: canvas.height / 2,
      r: 14,
      hp,
      maxHp: hp,
      shield: u.shield * 30,
      speed: 220,
      magnetRange: 90,
      invuln: 0,
      kbX: 0,
      kbY: 0,
      deathSaved: false,
      emergencyUsed: false,
    },
    base: {},
    perks: {},
    synergy: {},
    stacks: { focus: 0, demon: 0, demonNoLossMs: 0 },
    buffs: [],
enemies: [],
projectiles: [],
enemyProjectiles: [],
gems: [],
drops: [],
effects: [],
floating: [],
itemStats: { total: 0, gems: 0, legendary: 0 },
augmentTimers: {},
bossFlags: {}
  };
}

function rebuildStats() {
  if (!state) return;
  const u = meta.upgrades,
    lv = state.level,
    g = state.growth;
  state.base = {
    damageMul: (1 + (lv - 1) * 0.01 + g.damage) * (1 + u.damage * 0.1),
    attackSpeedMul: 1 + g.attackSpeed,
    speedMul: 1 + (lv - 1) * 0.002 + g.move + u.speed * 0.08,
    areaMul: 1 + g.area,
    expMul: 1 + g.exp + u.exp * 0.08,
    healMul: 1 + u.heal_eff * 0.15,
    defense: Math.min(0.7, g.defense + u.defense * 0.06),
    magnetBonus: lv - 1 + g.magnet + u.magnet * 40,
    knockbackMul: 1 + g.knockback + (u.knockback || 0) * 0.08,
    synergyAmp: 1 + u.syn_amp * 0.03,
  };
  state.perks = {
    slowChance: 0,
    burnChance: 0,
    attackSpeedMul: 1,
    areaMul: 1,
    executeDamage: 0,
    killShieldChance: 0,
    killHealChance: 0,
    frostfireBonus: 0,
    burnSpreadChance: 0,
    speedToArea: 0,
    areaExecute: 0,
    chainChance: 0,
    starChance: 0,
    iceShard: false,
    fireMeteor: false,
    windBlade: false,
    lightBurst: false,
    shadowSeeker: false,
    holySword: false,
    bloodBat: false,
    demonSlash: false,
    starBarrage: false,
    overheatBolt: false,
  };
  state.attrsFromAugments = {};
  for (const aug of state.augments) {
    addAttrs(state.attrsFromAugments, aug.attrs || {});
    aug.apply?.(state);
  }
  const maxHp = 100 + u.hp * 25 + (lv - 1) + g.hp;
  state.player.maxHp = state.perks.cursedCrown
    ? Math.max(60, maxHp - 30)
    : maxHp;
  state.player.speed = 220 * state.base.speedMul;
  state.player.magnetRange = 90 + state.base.magnetBonus;
  state.player.hp = Math.min(state.player.hp, state.player.maxHp);
  recalcSynergies();
}

function getAttrCounts() {
  const out = {};
  for (const a of ALL_ATTRS) out[a] = 0;
  addAttrs(out, state.attrsFromAugments);
  addAttrs(out, state.attrsFromGems);
  return out;
}
function addAttrs(target, source) {
  for (const [k, v] of Object.entries(source || {}))
    target[k] = (target[k] || 0) + v;
}

function recalcSynergies() {
  const a = getAttrCounts();
  const s = {
    slowChance: 0,
    slowPower: 0,
    burnChance: 0,
    burnDpsRatio: 0,
    burnDuration: 2.5,
    attackSpeedMul: 1,
    moveMul: 1,
    extraHitEvery: 0,
    areaMul: 1,
    areaDamageMul: 1,
    executeThreshold: 0,
    executeChance: 0,
    shieldOnKillChance: 0,
    shieldOnKill: 0,
    healOnKillChance: 0,
    healOnKill: 0,
    demonKillStack: 0,
    demonMax: 0,
    demonLoss: 1,
  };
  const newActive = new Set();
  function active(key) {
    newActive.add(key);
    if (!state.announcedSynergies.has(key)) {
      state.announcedSynergies.add(key);
      onSynergyFirstActivated(key);
    }
  }
  if (a["氷"] >= 2) {
    active("ice2");
    s.slowChance += 0.25;
    s.slowPower += 0.3;
  }
  if (a["氷"] >= 4) {
    active("ice4");
    s.slowChance += 0.2;
    s.areaDamageMul *= 1.1;
  }
  if (a["氷"] >= 6) {
    active("ice6");
    s.slowChance += 0.25;
    s.areaDamageMul *= 1.25;
  }
  if (a["火"] >= 2) {
    active("fire2");
    s.burnChance += 0.25;
    s.burnDpsRatio += 0.2;
  }
  if (a["火"] >= 4) {
    active("fire4");
    s.burnDpsRatio += 0.22;
    s.burnDuration += 1.5;
  }
  if (a["火"] >= 6) {
    active("fire6");
    s.burnDpsRatio += 0.32;
    s.burnDuration += 2.0;
  }
  if (a["風"] >= 2) {
    active("wind2");
    s.attackSpeedMul *= 1.15;
    s.moveMul *= 1.05;
  }
  if (a["風"] >= 4) {
    active("wind4");
    s.attackSpeedMul *= 1.18;
    s.moveMul *= 1.05;
    s.extraHitEvery = 5;
  }
  if (a["風"] >= 6) {
    active("wind6");
    s.attackSpeedMul *= 1.28;
    s.extraHitEvery = 3;
  }
  if (a["光"] >= 2) {
    active("light2");
    s.areaMul *= 1.15;
  }
  if (a["光"] >= 4) {
    active("light4");
    s.areaMul *= 1.15;
    s.areaDamageMul *= 1.2;
  }
  if (a["光"] >= 6) {
    active("light6");
    s.areaMul *= 1.2;
    s.areaDamageMul *= 1.25;
  }
  if (a["暗"] >= 2) {
    active("dark2");
    s.executeThreshold = 0.2;
    s.executeChance = 0.08;
  }
  if (a["暗"] >= 4) {
    active("dark4");
    s.executeThreshold = 0.3;
    s.executeChance = 0.12;
  }
  if (a["暗"] >= 6) {
    active("dark6");
    s.executeThreshold = 0.4;
    s.executeChance = 0.18;
  }
  if (a["聖"] >= 2) {
    active("holy2");
    s.shieldOnKillChance = 0.15;
    s.shieldOnKill = 6;
  }
  if (a["聖"] >= 4) {
    active("holy4");
    s.shieldOnKillChance = 0.25;
    s.shieldOnKill = 10;
  }
  if (a["聖"] >= 6) {
    active("holy6");
    s.shieldOnKillChance = 0.4;
    s.shieldOnKill = 14;
  }
  if (a["惡"] >= 2) {
    active("evil2");
    s.healOnKillChance = 0.15;
    s.healOnKill = 4;
  }
  if (a["惡"] >= 4) {
    active("evil4");
    s.healOnKillChance = 0.25;
    s.healOnKill = 7;
  }
  if (a["惡"] >= 6) {
    active("evil6");
    s.healOnKillChance = 0.4;
    s.healOnKill = 10;
  }
  if (a["鬼"] >= 2) {
    active("demon2");
    s.demonKillStack = 0.005;
    s.demonMax = 80;
    s.demonLoss = 0.5;
  }
  if (a["鬼"] >= 3) {
    active("demon3");
    s.demonKillStack = 0.008;
    s.demonMax = 130;
    s.demonLoss = 0.3;
  }
  if (a["鬼"] >= 4) {
    active("demon4");
    s.demonKillStack = 0.01;
    s.demonMax = 200;
    s.demonLoss = 0.15;
  }
  if (a["氷"] >= 2 && a["火"] >= 2) active("frostfire");
  if (a["火"] >= 4 && a["風"] >= 2) active("firestorm");
  if (a["風"] >= 4 && a["光"] >= 2) active("radiantwind");
  if (a["暗"] >= 4 && a["惡"] >= 2) active("voidfeast");
  if (a["聖"] >= 4 && a["惡"] >= 2) active("fallenholy");
  if (a["火"] >= 1 && a["暗"] >= 1 && a["鬼"] >= 1) active("bloodflamedemon");
  if (a["聖"] >= 2 && a["鬼"] >= 2) active("holydemon");
  if (a["惡"] >= 2 && a["鬼"] >= 2) active("evildemon");
  state.activeSynergies = newActive;
  state.synergy = s;
}

function onSynergyFirstActivated(key) {
  const info = SYNERGY_INFO[key] || { name: key };
  const burst = key.endsWith("6") || key === "demon4";
  if (key === "ice6")
    for (const e of state.enemies)
      e.freezeTime = Math.max(e.freezeTime || 0, 2);
  if (key === "fire6") for (const e of state.enemies) applyBurn(e, 18, 4);
  if (key === "wind6") addTimedBuff("attackSpeed", 2.0, 10);
  if (key === "light6")
    damageArea(
      state.player.x,
      state.player.y,
      999,
      180,
      40,
      ["light", "area"],
      true,
      "#fde68a",
    );
  if (key === "dark6")
    for (const e of state.enemies) {
      if (e.hp / e.maxHp <= 0.35 && !e.elite) e.hp = 0;
      else e.hp -= e.maxHp * 0.12;
    }
  if (key === "holy6") {
    addShield(state.player.maxHp * 0.4);
    damageArea(
      state.player.x,
      state.player.y,
      160,
      120,
      45,
      ["holy", "area"],
      true,
      "#bfdbfe",
    );
  }
  if (key === "evil6") {
    healPlayer(state.player.maxHp);
    addTimedBuff("damage", 1.5, 8);
  }
  if (key === "demon4") {
    state.stacks.demon = Math.min(200, state.stacks.demon + 50);
    state.stacks.demonNoLossMs = 10000;
    for (const e of state.enemies)
      applyEnemyKnockback(e, state.player.x, state.player.y, 60);
  }
  if (burst) showBigAlert(info.name, "궁극 시너지 발현!");
  else showToast(`시너지 발현: ${info.name}`);
}

function getWeaponTier() {
  if (!state) return 0;

  const lv = state.level;

  if (lv >= 28) return 6;
  if (lv >= 23) return 5;
  if (lv >= 18) return 4;
  if (lv >= 13) return 3;
  if (lv >= 8) return 2;
  if (lv >= 3) return 1;

  return 0;
}

function getWeaponStats() {
  const id = state.weapon.id;
  const s = state.synergy;
  const g = state.growth;
  const tier = getWeaponTier();

  const focusMul = state.perks.focusBlade
    ? Math.pow(1.005, state.stacks.focus)
    : 1;
  const demonMul = 1 + state.stacks.demon * (s.demonKillStack || 0);
  const buffDamage = getBuffMul("damage");
  const buffAs = getBuffMul("attackSpeed");
  const buffArea = getBuffMul("area");

  let damageMul = state.base.damageMul * focusMul * demonMul * buffDamage;
  let asMul =
    state.base.attackSpeedMul *
    state.perks.attackSpeedMul *
    s.attackSpeedMul *
    buffAs;
  let areaMul = state.base.areaMul * state.perks.areaMul * s.areaMul * buffArea;

  if (state.perks.glassSanctuary && state.player.shield > 0) damageMul *= 1.6;
  if (state.perks.speedToArea)
    areaMul *= 1 + Math.min(0.5, (asMul - 1) * state.perks.speedToArea);

  if (id === "magic_staff") {
    let damage = 30;
    let intervalMs = 820;
    let speed = 600;
    let pierce = 0;
    let count = 1;
    let radius = 5.5;
    let life = 2.4;

    // 자동 무기 성장: 마력탄은 후반에 발사체/관통/사거리까지 같이 성장
    damage *= 1 + tier * 0.12;
    intervalMs *= Math.max(0.68, 1 - tier * 0.045);
    speed *= 1 + tier * 0.05;
    radius *= 1 + tier * 0.14;
    life *= 1 + tier * 0.12;

    if (tier >= 2) count += 1;
    if (tier >= 4) count += 1;
    if (tier >= 6) count += 1;

    if (tier >= 3) pierce += 1;
    if (tier >= 6) pierce += 1;

    count += g.projectile;
    pierce += g.pierce;
    speed *= 1 + g.projectileSpeed;
    radius *= 1 + g.weaponSize;
    life *= 1 + (g.projectileLife || 0);

    return {
      damage: damage * damageMul,
      intervalMs: Math.max(160, intervalMs / asMul),
      speed,
      pierce,
      count,
      radius: radius * areaMul,
      life,
      knockback: 26 * state.base.knockbackMul,
      tags: ["projectile", "magic"],
    };
  }

  if (id === "flame_heart") {
    let damage = 8.2;
    let tickMs = 690;
    let radius = 82;
    let pulse = tier >= 4;

    // 자동 무기 성장은 유지하되, 범위 폭주는 억제
    damage *= 1 + tier * 0.08;
    tickMs *= Math.max(0.75, 1 - tier * 0.035);

    if (tier >= 2) radius += 6;
    if (tier >= 4) radius += 8;
    if (tier >= 6) radius += 10;

    tickMs *= Math.max(0.15, 1 - g.auraTick);

    // 화염심장은 범위 증가 효율을 절반만 받음
    const flameAreaMul = 1 + (areaMul - 1) * 0.5;
    const flameWeaponSizeMul = 1 + g.weaponSize * 0.5;
    radius *= flameAreaMul * flameWeaponSizeMul;

    return {
      damage: damage * damageMul * s.areaDamageMul,
      tickMs: Math.max(80, tickMs / asMul),
      radius,
      knockback: 5 * state.base.knockbackMul,
      pulse,
      tags: ["fire", "area"],
    };
  }

  if (id === "orbit_axe") {
    let damage = 24;
    let orbitRadius = 74;
    let orbitSpeed = 2.6;
    let count = 1;
    let axeRadius = 10;

    damage *= 1 + tier * 0.1;
    orbitSpeed *= 1 + tier * 0.05;
    orbitRadius *= 1 + tier * 0.05;
    axeRadius *= 1 + tier * 0.08;

    if (tier >= 2) count += 1;
    if (tier >= 5) count += 1;

    count += g.orbitCount;
    orbitSpeed *= 1 + g.orbitSpeed;
    axeRadius *= 1 + g.weaponSize;
    orbitRadius *= 1 + g.area * 1.3;

    return {
      damage: damage * damageMul,
      orbitRadius: orbitRadius * areaMul,
      orbitSpeed: orbitSpeed * asMul,
      count,
      axeRadius: axeRadius * areaMul,
      knockback: 16 * state.base.knockbackMul,
      tags: ["physical", "orbit"],
    };
  }
}

function openWeaponSelect() {
  if (!metaReady) {
    showToast("저장 데이터를 불러오는 중입니다.");
    return;
  }
  resizeCanvasForDevice();
  titleOverlay.classList.remove("show");
  labOverlay.classList.remove("show");
  codexOverlay.classList.remove("show");
  resultOverlay.classList.remove("show");
  pauseOverlay.classList.remove("show");
  choiceOverlay.classList.remove("show");
  weaponOverlay.classList.add("show");
  renderWeapons();
}
function startCombat() {
  if (!state || !state.weapon) {
    console.error("startCombat 실패: state 또는 weapon 없음", state);
    showToast("게임 시작 실패: 무기 정보 없음");
    return;
  }

  weaponOverlay.classList.remove("show");
  choiceOverlay.classList.remove("show");
  pauseOverlay.classList.remove("show");
  resultOverlay.classList.remove("show");
  titleOverlay.classList.remove("show");

  state.running = true;
  state.paused = false;
  state.timeMs = Math.max(0, state.timeMs || 0);
  state.spawnMs = 0;

  // 첫 프레임에서 음수 dt 방지
  lastTs = 0;

  cancelAnimationFrame(loopId);

  draw();
  updateUi();

  loopId = requestAnimationFrame(loop);
}
function openGrowthChoice() {
  state.paused = true;
  resetTouchMove();
  currentChoiceMode = "growth";
  currentChoices = rollGrowthChoices();
  rerollBtn.style.display = "none";
  choiceTitle.textContent = `Lv.${state.level} 성장 선택`;
  choiceDesc.textContent = SPECIAL_LEVELS.has(state.level)
    ? "기본 성장 카드를 선택하세요. 선택 후 증강 선택이 추가로 열립니다."
    : "기본 전투 능력을 강화하세요.";
  renderChoiceCards();
  choiceOverlay.classList.add("show");
}
function rollGrowthChoices() {
  const pool = [
    {
      type: "growth",
      label: "전투 성장",
      name: "공격력 증가",
      desc: "모든 피해 +12%",
      apply() {
        state.growth.damage += 0.12;
      },
    },
    {
      type: "growth",
      label: "전투 성장",
      name: "공격속도 증가",
      desc: "공격속도 +10%",
      apply() {
        state.growth.attackSpeed += 0.1;
      },
    },
    {
      type: "growth",
      label: "전투 성장",
      name: "공격범위 증가",
      desc: "공격 범위 +25%",
      apply() {
        state.growth.area += 0.25;
      },
    },
    {
      type: "growth",
      label: "생존 성장",
      name: "이동속도 증가",
      desc: "이동속도 +8%",
      apply() {
        state.growth.move += 0.08;
      },
    },
    {
      type: "growth",
      label: "생존 성장",
      name: "최대 HP 증가",
      desc: "최대 HP +25\nHP 25 회복",
      apply() {
        state.growth.hp += 25;
        rebuildStats();
        healPlayer(25);
      },
    },
    {
      type: "growth",
      label: "생존 성장",
      name: "방어력 증가",
      desc: "받는 피해 -4%",
      apply() {
        state.growth.defense += 0.04;
      },
    },
    {
      type: "growth",
      label: "유틸 성장",
      name: "자석 범위 증가",
      desc: "경험치 흡수 범위 +35",
      apply() {
        state.growth.magnet += 35;
      },
    },
    {
      type: "growth",
      label: "유틸 성장",
      name: "경험치 획득 증가",
      desc: "경험치 획득량 +8%",
      apply() {
        state.growth.exp += 0.08;
      },
    },
    {
      type: "growth",
      label: "전투 성장",
      name: "넉백 증가",
      desc: "타격 넉백 +18%",
      apply() {
        state.growth.knockback += 0.18;
      },
    },
  ];
  if (state.weapon.id === "magic_staff")
    pool.push(
      {
        type: "growth",
        label: "무기 성장",
        name: "투사체 수 증가",
        desc: "마력탄 발사체 +1",
        weight: 4,
        apply() {
          state.growth.projectile += 1;
        },
      },
      {
        type: "growth",
        label: "무기 성장",
        name: "관통 증가",
        desc: "마력탄 관통 +1",
        weight: 5,
        apply() {
          state.growth.pierce += 1;
        },
      },
      {
        type: "growth",
        label: "무기 성장",
        name: "투사체 속도 증가",
        desc: "마력탄 속도 +15%",
        weight: 8,
        apply() {
          state.growth.projectileSpeed += 0.15;
        },
      },
    );
  if (state.weapon.id === "flame_heart")
    pool.push(
      {
        type: "growth",
        label: "무기 성장",
        name: "오라 범위 증가",
        desc: "화염 오라 범위 +35%",
        weight: 8,
        apply() {
          state.growth.weaponSize += 0.35;
        },
      },
      {
        type: "growth",
        label: "무기 성장",
        name: "피해 주기 감소",
        desc: "화염 오라 피해 주기 -8%",
        weight: 8,
        apply() {
          state.growth.auraTick += 0.08;
        },
      },
    );
  if (state.weapon.id === "orbit_axe")
    pool.push(
      {
        type: "growth",
        label: "무기 성장",
        name: "도끼 수 증가",
        desc: "회전 도끼 +1",
        weight: 4,
        apply() {
          state.growth.orbitCount += 1;
        },
      },
      {
        type: "growth",
        label: "무기 성장",
        name: "회전속도 증가",
        desc: "도끼 회전속도 +12%",
        weight: 8,
        apply() {
          state.growth.orbitSpeed += 0.12;
        },
      },
      {
        type: "growth",
        label: "무기 성장",
        name: "도끼 크기 증가",
        desc: "도끼 크기 +35%",
        weight: 8,
        apply() {
          state.growth.weaponSize += 0.35;
        },
      },
    );
  const weighted = pool.map((x) => ({ item: x, weight: x.weight || 12 }));
  const result = [];
  while (result.length < 3) {
    const picked = weightedPick(weighted).item;
    if (!result.some((x) => x.name === picked.name)) result.push(picked);
  }
  return result;
}
function openAugmentChoice() {
  state.paused = true;
  resetTouchMove();
  currentChoiceMode = "augment";
  currentChoices = rollAugmentChoices();
  rerollsLeft = meta.upgrades.reroll || 0;
  rerollBtn.style.display = "inline-block";
  choiceTitle.textContent = `Lv.${state.level} 증강 선택`;
  choiceDesc.textContent =
    "추가 보너스 증강입니다. 속성을 선택하고 시너지를 폭발시키세요.";
  renderChoiceCards();
  choiceOverlay.classList.add("show");
}
function selectCurrentChoice(item) {
  if (currentChoiceMode === "growth") {
    item.apply();
    rebuildStats();
    showToast(`${item.name} 선택`);
    choiceOverlay.classList.remove("show");
    if (pendingAugmentAfterGrowth) {
      pendingAugmentAfterGrowth = false;
      openAugmentChoice();
      return;
    }
    state.paused = false;
    return;
  }
  if (state.augments.length >= MAX_AUGMENTS) return;
  state.augments.push(item);
  rebuildStats();
  choiceOverlay.classList.remove("show");
  state.paused = false;
  showBigAlert(item.name, `${GRADE_LABEL[item.grade]} 증강 획득`);
}
function rerollAugments() {
  if (currentChoiceMode !== "augment" || rerollsLeft <= 0) return;
  rerollsLeft -= 1;
  currentChoices = rollAugmentChoices();
  renderChoiceCards();
  showToast("증강 선택지 새로고침!");
}
function rollAugmentChoices() {
  const normalPool = AUGMENTS.filter(
    (a) => !a.ghost && !state.augments.some((x) => x.id === a.id),
  );
  const ghostPool = AUGMENTS.filter(
    (a) => a.ghost && !state.augments.some((x) => x.id === a.id),
  );
  const choices = [];
  while (choices.length < 3) {
    const pool = normalPool.filter((a) => !choices.some((c) => c.id === a.id));
    if (!pool.length) break;
    choices.push(pickByGrade(pool));
  }
  if (ghostPool.length && Math.random() < getGhostChance())
    choices[Math.floor(Math.random() * choices.length)] = randomItem(ghostPool);
  return choices;
}
function getGhostChance() {
  const attrs = getAttrCounts();
  return (
    (state.level >= 30 ? 0.2 : state.level >= 20 ? 0.15 : 0.1) +
    ((attrs["鬼"] || 0) > 0 ? 0.05 : 0)
  );
}
function pickByGrade(pool) {
  const high = meta.upgrades.high_grade || 0;
  const table = {
    basic: Math.max(3, 15 - high * 2),
    normal: Math.max(5, 20 - high),
    advanced: 30,
    epic: 20 + high * 2,
    legendary: 15 + high,
  };
  let candidates = [],
    guard = 0;
  while (!candidates.length && guard < 20) {
    guard++;
    const grade = weightedPick(
      Object.entries(table).map(([grade, weight]) => ({ grade, weight })),
    ).grade;
    candidates = pool.filter((a) => a.grade === grade);
  }
  if (!candidates.length) candidates = pool;
  const focus = meta.upgrades.attr_focus || 0;
  if (focus > 0 && state.augments.length > 0) {
    const current = getAttrCounts();
    return weightedPick(
      candidates.map((a) => ({
        item: a,
        weight:
          1 +
          Object.keys(a.attrs || {}).reduce(
            (sum, k) => sum + ((current[k] || 0) > 0 ? focus * 0.08 : 0),
            0,
          ),
      })),
    ).item;
  }
  return randomItem(candidates);
}

function loop(ts) {
  try {
    if (!lastTs) {
      lastTs = ts;
    }

    const rawDt = (ts - lastTs) / 1000;
    const dt = Math.min(0.04, Math.max(0, rawDt));

    lastTs = ts;

    if (state && state.running && !state.paused) {
      update(dt);
    }

    draw();
    updateUi();

    if (state && state.running) {
      loopId = requestAnimationFrame(loop);
    }
  } catch (err) {
    console.error("게임 루프 오류:", err);
    showToast("게임 오류 발생: 콘솔 확인 필요");

    if (state) {
      state.paused = true;
    }
  }
}
function update(dt) {
  state.timeMs += dt * 1000;
  state.stacks.demonNoLossMs = Math.max(
    0,
    state.stacks.demonNoLossMs - dt * 1000,
  );
  if (state.timeMs >= GAME_LIMIT_MS) {
    endGame(true);
    return;
  }
  updateBuffs(dt);
  updatePassiveRegen(dt);
  updatePlayer(dt);
  updateWeapon(dt);
  updateAugmentAttacks(dt);
  updateTimedBossSpawns();
  updateSpawns(dt);
  updateEnemies(dt);
  updateProjectiles(dt);
  updateEnemyProjectiles(dt);
  updateGemsAndDrops(dt);
  updateEffects(dt);
  updateFloating(dt);
}
function updatePlayer(dt) {
  state.player.invuln = Math.max(0, state.player.invuln - dt);
  let dx = 0,
    dy = 0;
  if (keys.has("KeyW") || keys.has("ArrowUp")) dy -= 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) dy += 1;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) dx -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) dx += 1;
  if (touchMove.active) {
    dx += touchMove.dx;
    dy += touchMove.dy;
  }
  const len = Math.hypot(dx, dy) || 1;
  const speed =
    state.player.speed * getBuffMul("speed") * (state.synergy.moveMul || 1);
  state.player.x += (dx / len) * speed * dt;
  state.player.y += (dy / len) * speed * dt;
  state.player.x += state.player.kbX * dt;
  state.player.y += state.player.kbY * dt;
  state.player.kbX *= Math.pow(0.001, dt);
  state.player.kbY *= Math.pow(0.001, dt);
  state.player.x = clamp(state.player.x, 20, canvas.width - 20);
  state.player.y = clamp(state.player.y, 20, canvas.height - 20);
}
function updateWeapon(dt) {
  if (!state.weapon) return;
  if (state.weapon.id === "magic_staff") {
    state.attackMs -= dt * 1000;
    const w = getWeaponStats();
    if (state.attackMs <= 0) {
      state.attackMs = w.intervalMs;
      //if (state.perks.overheat) damagePlayerRaw(0.2);
      fireProjectiles(w);
      if (state.perks.overheatBolt) fireOverheatBolt(w);
    }
  }
  if (state.weapon.id === "flame_heart") {
    state.auraMs -= dt * 1000;
    const w = getWeaponStats();
    if (state.auraMs <= 0) {
      state.auraMs = w.tickMs;
      damageArea(
        state.player.x,
        state.player.y,
        w.radius,
        w.damage,
        w.knockback,
        w.tags,
        false,
      );
      //if (state.perks.overheat) damagePlayerRaw(0.2);
    }
    if (w.pulse) {
      state.attackMs -= dt * 1000;
      if (state.attackMs <= 0) {
        state.attackMs = 2000;
        damageArea(
          state.player.x,
          state.player.y,
          w.radius * 1.2,
          w.damage * 1.4,
          28,
          w.tags,
          true,
          "#fb7185",
        );
      }
    }
  }
  if (state.weapon.id === "orbit_axe") {
    const w = getWeaponStats();
    state.orbitAngle = (state.orbitAngle || 0) + w.orbitSpeed * dt;
    for (let i = 0; i < w.count; i++) {
      const a = state.orbitAngle + (Math.PI * 2 * i) / w.count;
      const ox = state.player.x + Math.cos(a) * w.orbitRadius;
      const oy = state.player.y + Math.sin(a) * w.orbitRadius;
      for (const e of state.enemies)
        if (
          e.hitCd <= 0 &&
          Math.hypot(e.x - ox, e.y - oy) < e.r + w.axeRadius
        ) {
          e.hitCd = 0.25;
          hitEnemy(e, w.damage, w.tags, w.knockback, ox, oy, 0);
        }
    }
  }
}

function updateAugmentAttacks(dt) {
  if (!state || !state.perks) return;

  state.augmentTimers = state.augmentTimers || {};

  const weapon = getWeaponStats();
  const baseDamage = weapon.damage || 20;
  const attrs = getAttrCounts();

  if (state.perks.iceShard) {
    tickAugmentTimer("iceShard", 3.0, dt, () => {
      const count = attrs["氷"] >= 6 ? 3 : attrs["氷"] >= 4 ? 2 : 1;
      fireAugmentProjectiles(
        count,
        baseDamage * 0.8,
        "#7dd3fc",
        ["projectile", "ice"],
        520,
        5,
        0,
      );
    });
  }

  if (state.perks.fireMeteor) {
    tickAugmentTimer("fireMeteor", 4.5, dt, () => {
      const target = randomItem(state.enemies.filter((e) => e.hp > 0));
      if (!target) return;

      const radius = attrs["火"] >= 4 ? 95 : 70;
      const times = attrs["火"] >= 6 ? 2 : 1;

      for (let i = 0; i < times; i++) {
        const x = target.x + (Math.random() - 0.5) * 70;
        const y = target.y + (Math.random() - 0.5) * 70;
        damageArea(
          x,
          y,
          radius,
          baseDamage * 1.4,
          28,
          ["fire", "area"],
          true,
          "#fb7185",
        );
      }
    });
  }

  if (state.perks.windBlade) {
    tickAugmentTimer(
      "windBlade",
      Math.max(0.7, 3.5 / Math.max(0.1, statAttackSpeedMul())),
      dt,
      () => {
        const count = attrs["風"] >= 6 ? 8 : attrs["風"] >= 4 ? 6 : 4;
        fireRadialProjectiles(
          count,
          baseDamage * 0.55,
          "#86efac",
          ["projectile", "wind"],
          620,
          4,
          0,
        );
      },
    );
  }

  if (state.perks.lightBurst) {
    tickAugmentTimer("lightBurst", 5.5, dt, () => {
      const radius = 110 * statAreaMul();
      damageArea(
        state.player.x,
        state.player.y,
        radius,
        baseDamage * 1.2,
        38,
        ["light", "area"],
        true,
        "#fde68a",
      );
    });
  }

  if (state.perks.shadowSeeker) {
    tickAugmentTimer("shadowSeeker", 3.8, dt, () => {
      const target = [...state.enemies]
        .filter((e) => e.hp > 0)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];

      if (!target) return;
      fireHomingProjectile(
        target,
        baseDamage * 1.3,
        "#a78bfa",
        ["projectile", "dark"],
        500,
        6,
      );
    });
  }

  if (state.perks.holySword) {
    tickAugmentTimer("holySword", 5.0, dt, () => {
      const target = [...state.enemies]
        .filter((e) => e.hp > 0)
        .sort((a, b) => b.hp - a.hp)[0];

      if (!target) return;
      damageArea(
        target.x,
        target.y,
        52,
        baseDamage * 2.2,
        45,
        ["holy", "area"],
        true,
        "#bfdbfe",
      );
    });
  }

  if (state.perks.bloodBat) {
    tickAugmentTimer("bloodBat", 4.0, dt, () => {
      const count = attrs["惡"] >= 4 ? 3 : 2;
      fireAugmentProjectiles(
        count,
        baseDamage * 0.7,
        "#fda4af",
        ["projectile", "evil", "lifesteal"],
        560,
        5,
        0,
      );
    });
  }

  if (state.perks.starBarrage) {
    tickAugmentTimer("starBarrage", 6.0, dt, () => {
      const targets = getEnemiesSortedByDistance().slice(0, 5);
      for (const target of targets) {
        damageArea(
          target.x,
          target.y,
          46,
          baseDamage * 0.75,
          20,
          ["light", "area"],
          true,
          "#c4b5fd",
        );
      }
    });
  }

  if (state.perks.demonSlash) {
    tickAugmentTimer("demonSlash", 6.0, dt, () => {
      const bonus = 1 + state.stacks.demon * 0.01;
      const radius = 130 + state.stacks.demon * 0.4;
      damageArea(
        state.player.x,
        state.player.y,
        radius,
        baseDamage * 2.5 * bonus,
        60,
        ["demon", "area"],
        true,
        "#facc15",
      );
    });
  }
}

function tickAugmentTimer(key, intervalSec, dt, callback) {
  state.augmentTimers[key] = (state.augmentTimers[key] || 0) - dt;
  if (state.augmentTimers[key] <= 0) {
    state.augmentTimers[key] = intervalSec;
    callback();
  }
}

function fireAugmentProjectiles(
  count,
  damage,
  color,
  tags,
  speed,
  radius,
  pierce = 0,
) {
  const targets = getEnemiesSortedByDistance();
  if (!targets.length) return;

  for (let i = 0; i < count; i++) {
    const target = targets[i % targets.length];
    const angle = Math.atan2(
      target.y - state.player.y,
      target.x - state.player.x,
    );

    state.projectiles.push({
      x: state.player.x,
      y: state.player.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: radius,
      damage,
      pierce,
      knockback: 18,
      tags,
      color,
      life: 2.2,
      allowChain: true,
      depth: 0,
    });
  }
}

function fireRadialProjectiles(
  count,
  damage,
  color,
  tags,
  speed,
  radius,
  pierce = 0,
) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count;

    state.projectiles.push({
      x: state.player.x,
      y: state.player.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: radius,
      damage,
      pierce,
      knockback: 14,
      tags,
      color,
      life: 1.6,
      allowChain: false,
      depth: 0,
    });
  }
}

function fireHomingProjectile(target, damage, color, tags, speed, radius) {
  const angle = Math.atan2(
    target.y - state.player.y,
    target.x - state.player.x,
  );

  state.projectiles.push({
    x: state.player.x,
    y: state.player.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    r: radius,
    damage,
    pierce: 0,
    knockback: 20,
    tags,
    color,
    life: 2.4,
    homing: true,
    target,
    allowChain: true,
    depth: 0,
  });
}

function fireOverheatBolt(w) {
  const target = getNearestEnemy();
  if (!target) return;

  const angle = Math.atan2(
    target.y - state.player.y,
    target.x - state.player.x,
  );
  state.projectiles.push({
    x: state.player.x,
    y: state.player.y,
    vx: Math.cos(angle) * 650,
    vy: Math.sin(angle) * 650,
    r: Math.max(4, w.radius * 0.8),
    damage: w.damage * 0.35,
    pierce: 0,
    knockback: 12,
    tags: ["projectile", "fire"],
    color: "#fb7185",
    life: 1.8,
    allowChain: false,
    depth: 0,
  });
}

function fireProjectiles(w) {
  const targets = getEnemiesSortedByDistance();
  if (!targets.length) return;
  for (let i = 0; i < w.count; i++) {
    const target = targets[i % targets.length];
    const spread =
      targets.length < w.count ? (i - (w.count - 1) / 2) * 0.08 : 0;
    const angle =
      Math.atan2(target.y - state.player.y, target.x - state.player.x) + spread;
    state.projectiles.push({
      x: state.player.x,
      y: state.player.y,
      vx: Math.cos(angle) * w.speed,
      vy: Math.sin(angle) * w.speed,
      r: w.radius,
      damage: w.damage,
      pierce: w.pierce,
      knockback: w.knockback,
      tags: w.tags,
      life: w.life || 2.4,
      allowChain: true,
      depth: 0,
    });
  }
}
function getMonsterWave(t) {
  if (t >= 1080 && t < 1200) {
    return {
      key: "wave_18",
      active: true,
      title: "최종 웨이브",
      desc: "18:00 ~ 20:00 몬스터 대공세",
      intervalMul: 0.55,
      spawnCount: 2,
      eliteBonus: 0.04,
    };
  }

  if (t >= 600 && t < 660) {
    return {
      key: "wave_10",
      active: true,
      title: "몬스터 웨이브",
      desc: "10:00 ~ 11:00 몬스터 공세",
      intervalMul: 0.65,
      spawnCount: 2,
      eliteBonus: 0.02,
    };
  }

  return {
    key: "normal",
    active: false,
    intervalMul: 1,
    spawnCount: 1,
    eliteBonus: 0,
  };
}

function updateSpawns(dt) {
  state.spawnMs -= dt * 1000;

  const t = state.timeMs / 1000;
  const wave = getMonsterWave(t);

  if (state.waveKey !== wave.key) {
    state.waveKey = wave.key;

    if (wave.active) {
      showBigAlert(wave.title, wave.desc);
    }
  }

  const baseInterval = Math.max(300, 850 - t * 1.65);
  const interval = baseInterval * wave.intervalMul;

  if (state.spawnMs <= 0) {
    state.spawnMs = interval;

    for (let i = 0; i < wave.spawnCount; i++) {
      spawnEnemy(wave);
    }
  }
}

function spawnEnemy(wave = null) {
  const t = state.timeMs / 1000;

  const types = [
    {
      id: "slime",
      name: "슬라임",
      color: "#22c55e",
      hp: 28,
      speed: 72,
      damage: 7,
      exp: 12,
      r: 13,
      from: 0,
      weight: 48,
      kb: 0,
      ai: "melee"
    },
    {
      id: "wolf",
      name: "늑대",
      color: "#94a3b8",
      hp: 28,
      speed: 128,
      damage: 8,
      exp: 17,
      r: 11,
      from: 60,
      weight: 28,
      kb: 0.1,
      ai: "melee"
    },
    {
      id: "bat",
      name: "박쥐",
      color: "#a78bfa",
      hp: 22,
      speed: 158,
      damage: 6,
      exp: 18,
      r: 9,
      from: 120,
      weight: 22,
      kb: 0,
      ai: "melee"
    },
    {
      id: "golem",
      name: "골렘",
      color: "#78716c",
      hp: 130,
      speed: 50,
      damage: 14,
      exp: 50,
      r: 18,
      from: 240,
      weight: 12,
      kb: 0.6,
      ai: "melee"
    },
    {
      id: "bomb",
      name: "폭탄병",
      color: "#f97316",
      hp: 60,
      speed: 68,
      damage: 11,
      exp: 38,
      r: 14,
      from: 360,
      weight: 14,
      kb: 0.3,
      ai: "melee"
    },

    // 원거리 몹
    {
      id: "thrower",
      name: "투척병",
      color: "#38bdf8",
      hp: 44,
      speed: 64,
      damage: 8,
      exp: 26,
      r: 12,
      from: 180,
      weight: 16,
      kb: 0.15,
      ai: "ranged",
      shootCd: 1.8,
      bulletSpeed: 210,
      bulletRadius: 5,
      bulletDamage: 8,
      range: 260
    },
    {
      id: "shaman",
      name: "주술사",
      color: "#c084fc",
      hp: 70,
      speed: 46,
      damage: 10,
      exp: 42,
      r: 14,
      from: 420,
      weight: 10,
      kb: 0.25,
      ai: "ranged",
      shootCd: 2.6,
      bulletSpeed: 150,
      bulletRadius: 6,
      bulletDamage: 10,
      range: 320,
      homing: true
    },
    {
      id: "spore",
      name: "포자몹",
      color: "#bef264",
      hp: 58,
      speed: 54,
      damage: 7,
      exp: 34,
      r: 13,
      from: 540,
      weight: 9,
      kb: 0.2,
      ai: "ranged",
      shootCd: 3.2,
      bulletSpeed: 170,
      bulletRadius: 4,
      bulletDamage: 7,
      range: 280,
      spread: 3
    }
  ].filter(m => t >= m.from);

  const picked = weightedPick(types.map(m => ({ ...m, weight: m.weight })));

  const eliteChance = 0.05 + (wave?.eliteBonus || 0);
  const elite = t > 240 && Math.random() < eliteChance;

  const pos = getSpawnPosition();
  const diff = 1 + t / 420;
  const hp = picked.hp * diff * (elite ? 3.2 : 1);

  state.enemies.push({
    ...picked,
    x: pos.x,
    y: pos.y,
    hp,
    maxHp: hp,
    speed: picked.speed * Math.min(1.45, 1 + t / 850) * (elite ? 0.9 : 1),
    damage: picked.damage * (elite ? 1.45 : 1),
    exp: picked.exp * (elite ? 4 : 1),
    r: picked.r * (elite ? 1.25 : 1),
    elite,
    boss: false,
    midBoss: false,
    color: elite ? "#facc15" : picked.color,
    hitCd: 0,
    contactCd: 0,
    shootTimer: Math.random() * (picked.shootCd || 2),
    vx: 0,
    vy: 0,
    slowTime: 0,
    slowPower: 0,
    freezeTime: 0,
    burnTime: 0,
    burnDps: 0
  });
}

function updateTimedBossSpawns() {
  const t = state.timeMs / 1000;

  if (t >= 300 && !state.bossFlags.mid5) {
    state.bossFlags.mid5 = true;
    spawnBossEnemy("mid_guardian", "중간보스", 1);
  }

  if (t >= 600 && !state.bossFlags.mid10) {
    state.bossFlags.mid10 = true;
    spawnBossEnemy("wave_brute", "웨이브 중간보스", 1.35);
  }

  if (t >= 900 && !state.bossFlags.mid15) {
    state.bossFlags.mid15 = true;
    spawnBossEnemy("dark_knight", "암흑 기사", 1.7);
  }

  if (t >= 1080 && !state.bossFlags.final18) {
    state.bossFlags.final18 = true;
    spawnBossEnemy("sabana_lord", "사바나 군주", 2.4, true);
  }
}

function spawnBossEnemy(id, name, scale = 1, finalBoss = false) {
  const t = state.timeMs / 1000;
  const pos = getSpawnPosition();
  const diff = 1 + t / 360;

  const baseHp = finalBoss ? 1800 : 620;
  const baseDamage = finalBoss ? 22 : 16;

  state.enemies.push({
    id,
    name,
    color: finalBoss ? "#ef4444" : "#facc15",
    hp: baseHp * diff * scale,
    maxHp: baseHp * diff * scale,
    speed: finalBoss ? 54 : 62,
    damage: baseDamage * scale,
    exp: finalBoss ? 600 : 220,
    r: finalBoss ? 30 : 24,
    from: 0,
    weight: 0,
    kb: finalBoss ? 0.85 : 0.7,
    ai: finalBoss ? "boss" : "midboss",
    elite: true,
    boss: finalBoss,
    midBoss: !finalBoss,
    x: pos.x,
    y: pos.y,
    hitCd: 0,
    contactCd: 0,
    shootTimer: 1.5,
    patternTimer: 4,
    vx: 0,
    vy: 0,
    slowTime: 0,
    slowPower: 0,
    freezeTime: 0,
    burnTime: 0,
    burnDps: 0
  });

  showBigAlert(name, finalBoss ? "최종 보스 등장!" : "중간보스 등장!");
}

function getSpawnPosition() {
  const side = Math.floor(Math.random() * 4);

  if (side === 0) return { x: -25, y: Math.random() * canvas.height };
  if (side === 1) return { x: canvas.width + 25, y: Math.random() * canvas.height };
  if (side === 2) return { x: Math.random() * canvas.width, y: -25 };

  return { x: Math.random() * canvas.width, y: canvas.height + 25 };
}

function updateEnemies(dt) {
  for (const e of state.enemies) {
    e.hitCd = Math.max(0, e.hitCd - dt);
    e.contactCd = Math.max(0, e.contactCd - dt);
    e.slowTime = Math.max(0, e.slowTime - dt);
    e.freezeTime = Math.max(0, e.freezeTime - dt);

    if (e.burnTime > 0) {
      e.burnTime -= dt;
      e.hp -= e.burnDps * dt;

      if (e.hp <= 0) {
        killEnemy(e, ["burn"]);
      }
    }

    if (e.freezeTime <= 0) {
      updateEnemyMovement(e, dt);
      updateEnemyShooting(e, dt);
    }

    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.vx *= Math.pow(0.005, dt);
    e.vy *= Math.pow(0.005, dt);

    const dist = Math.hypot(e.x - state.player.x, e.y - state.player.y);

    if (dist < e.r + state.player.r && e.contactCd <= 0) {
      e.contactCd = 0.9;
      damagePlayer(e.damage, e.x, e.y);
    }
  }

  state.enemies = state.enemies.filter(e => e.hp > 0);
}

function updateEnemyMovement(e, dt) {
  const dx = state.player.x - e.x;
  const dy = state.player.y - e.y;
  const dist = Math.hypot(dx, dy) || 1;

  const slowMul = e.slowTime > 0 ? 1 - e.slowPower : 1;
  let moveX = dx / dist;
  let moveY = dy / dist;

  if (e.ai === "ranged") {
    const preferred = e.range || 280;

    if (dist < preferred * 0.72) {
      moveX *= -1;
      moveY *= -1;
    } else if (dist <= preferred) {
      moveX *= 0.2;
      moveY *= 0.2;
    }
  }

  if (e.ai === "boss" || e.ai === "midboss") {
    if (dist < 140) {
      moveX *= -0.25;
      moveY *= -0.25;
    }
  }

  e.x += moveX * e.speed * slowMul * dt;
  e.y += moveY * e.speed * slowMul * dt;
}

function updateEnemyShooting(e, dt) {
  if (!["ranged", "midboss", "boss"].includes(e.ai)) return;

  e.shootTimer = (e.shootTimer || 0) - dt;

  if (e.shootTimer > 0) return;

  if (e.ai === "boss") {
    e.shootTimer = 1.25;
    shootBossPattern(e);
    return;
  }

  if (e.ai === "midboss") {
    e.shootTimer = 1.8;
    shootSpreadEnemyBullet(e, 5, e.damage * 0.75, 190, 5, "#facc15");
    return;
  }

  e.shootTimer = e.shootCd || 2;

  if (e.spread) {
    shootSpreadEnemyBullet(
      e,
      e.spread,
      e.bulletDamage,
      e.bulletSpeed,
      e.bulletRadius,
      e.color
    );
  } else {
    shootEnemyBullet(
      e,
      e.bulletDamage,
      e.bulletSpeed,
      e.bulletRadius,
      e.color,
      !!e.homing
    );
  }
}

function shootEnemyBullet(e, damage, speed, radius, color, homing = false) {
  const angle = Math.atan2(state.player.y - e.y, state.player.x - e.x);

  state.enemyProjectiles.push({
    x: e.x,
    y: e.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    r: radius,
    damage,
    color,
    life: 4,
    homing,
    turnRate: homing ? 0.035 : 0
  });
}

function shootSpreadEnemyBullet(e, count, damage, speed, radius, color) {
  const baseAngle = Math.atan2(state.player.y - e.y, state.player.x - e.x);
  const gap = 0.22;

  for (let i = 0; i < count; i++) {
    const offset = (i - (count - 1) / 2) * gap;
    const angle = baseAngle + offset;

    state.enemyProjectiles.push({
      x: e.x,
      y: e.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: radius,
      damage,
      color,
      life: 4,
      homing: false,
      turnRate: 0
    });
  }
}

function shootBossPattern(e) {
  e.patternTimer = (e.patternTimer || 0) + 1;

  if (e.patternTimer % 3 === 0) {
    shootRadialEnemyBullet(e, 14, e.damage * 0.55, 150, 5, "#ef4444");
    return;
  }

  if (e.patternTimer % 2 === 0) {
    shootSpreadEnemyBullet(e, 7, e.damage * 0.7, 210, 5, "#fb7185");
    return;
  }

  shootEnemyBullet(e, e.damage * 0.9, 190, 7, "#fca5a5", true);
}

function shootRadialEnemyBullet(e, count, damage, speed, radius, color) {
  for (let i = 0; i < count; i++) {
    const angle = Math.PI * 2 * i / count;

    state.enemyProjectiles.push({
      x: e.x,
      y: e.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: radius,
      damage,
      color,
      life: 5,
      homing: false,
      turnRate: 0
    });
  }
}

function updateEnemyProjectiles(dt) {
  for (const p of state.enemyProjectiles) {
    p.life -= dt;

    if (p.homing) {
      const angle = Math.atan2(state.player.y - p.y, state.player.x - p.x);
      const speed = Math.hypot(p.vx, p.vy) || 160;

      p.vx = p.vx * (1 - p.turnRate) + Math.cos(angle) * speed * p.turnRate;
      p.vy = p.vy * (1 - p.turnRate) + Math.sin(angle) * speed * p.turnRate;
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    const dist = Math.hypot(p.x - state.player.x, p.y - state.player.y);

    if (dist < p.r + state.player.r) {
      p.life = 0;
      damagePlayer(p.damage, p.x, p.y);
    }
  }

  state.enemyProjectiles = state.enemyProjectiles.filter(p =>
    p.life > 0 &&
    p.x > -80 &&
    p.x < canvas.width + 80 &&
    p.y > -80 &&
    p.y < canvas.height + 80
  );
}

function updateProjectiles(dt) {
  for (const p of state.projectiles) {
    p.life -= dt;

    if (p.homing && p.target && p.target.hp > 0) {
      const angle = Math.atan2(p.target.y - p.y, p.target.x - p.x);
      const speed = Math.hypot(p.vx, p.vy) || 500;
      p.vx = p.vx * 0.9 + Math.cos(angle) * speed * 0.1;
      p.vy = p.vy * 0.9 + Math.sin(angle) * speed * 0.1;
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    for (const e of state.enemies) {
      if (e.hp <= 0) continue;
      if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r) {
        hitEnemy(e, p.damage, p.tags, p.knockback, p.x, p.y, p.depth, p);
        p.pierce -= 1;
        if (p.pierce < 0) {
          p.life = 0;
          break;
        }
      }
    }
  }

  state.projectiles = state.projectiles.filter(
    (p) =>
      p.life > 0 &&
      p.x > -60 &&
      p.x < canvas.width + 60 &&
      p.y > -60 &&
      p.y < canvas.height + 60,
  );
}
function hitEnemy(
  e,
  amount,
  tags = [],
  knockback = 0,
  sx = state.player.x,
  sy = state.player.y,
  depth = 0,
  projectile = null,
) {
  let dmg = amount;

  if (e.hp / e.maxHp <= 0.35) dmg *= 1 + state.perks.executeDamage;
  if (tags.includes("dark") && e.hp / e.maxHp <= 0.35) dmg *= 1.6;
  if (tags.includes("area")) dmg *= state.synergy.areaDamageMul || 1;
  if (
    state.perks.areaExecute &&
    tags.includes("area") &&
    e.hp / e.maxHp <= 0.35
  )
    dmg *= 1 + state.perks.areaExecute;

  if (
    state.activeSynergies.has("frostfire") &&
    e.slowTime > 0 &&
    e.burnTime > 0
  ) {
    dmg *= 1.65 + state.perks.frostfireBonus;
  }

  if (
    Math.random() < (state.synergy.executeChance || 0) &&
    e.hp / e.maxHp <= (state.synergy.executeThreshold || 0)
  ) {
    if (!e.elite) {
      dmg = e.hp + 9999;
      if (state.activeSynergies.has("dark4"))
        damageArea(
          e.x,
          e.y,
          55,
          amount * 0.7,
          12,
          ["dark", "area"],
          true,
          "#6d28d9",
        );
    } else {
      dmg += e.maxHp * 0.08;
    }
  }

  e.hp -= dmg;
  addFloating(e.x, e.y, Math.round(dmg), "#fef3c7");

  if (tags.includes("lifesteal")) healPlayer(dmg * 0.08);
  if (tags.includes("holy") && Math.random() < 0.1)
    addShield(Math.max(2, dmg * 0.03));

  if (knockback > 0) applyEnemyKnockback(e, sx, sy, knockback);

  applyOnHitEffects(e, amount, tags, depth, projectile);

  if (e.hp <= 0) killEnemy(e, tags);
}
function applyOnHitEffects(e, baseDamage, tags, depth, projectile) {
  const s = state.synergy;

  if (tags.includes("ice")) {
    e.slowTime = Math.max(e.slowTime, 2.2);
    e.slowPower = Math.max(e.slowPower, 0.35 + (s.slowPower || 0));
  }

  if (tags.includes("fire")) {
    applyBurn(
      e,
      baseDamage * Math.max(0.22, s.burnDpsRatio || 0.2),
      Math.max(2.5, s.burnDuration || 2.5),
    );
  }

  if (Math.random() < state.perks.slowChance + (s.slowChance || 0)) {
    e.slowTime = Math.max(e.slowTime, 2);
    e.slowPower = Math.max(e.slowPower, 0.25 + (s.slowPower || 0));
  }

  if (Math.random() < state.perks.burnChance + (s.burnChance || 0)) {
    applyBurn(e, baseDamage * (s.burnDpsRatio || 0.2), s.burnDuration || 2.5);
  }

  if (
    state.activeSynergies.has("firestorm") &&
    e.burnTime > 0 &&
    Math.random() < 0.16
  )
    spreadBurn(e, baseDamage * 0.25);

  if (state.perks.focusBlade)
    state.stacks.focus = Math.min(80, state.stacks.focus + 1);

  if (state.synergy.extraHitEvery) {
    state._hitCounter = (state._hitCounter || 0) + 1;
    if (state._hitCounter >= state.synergy.extraHitEvery) {
      state._hitCounter = 0;
      e.hp -= baseDamage * 0.5;
      addFloating(e.x, e.y - 10, "추가타!", "#a7f3d0");
    }
  }

  if (projectile && projectile.tags.includes("projectile")) {
    if (
      state.perks.chainChance &&
      projectile.allowChain &&
      Math.random() < state.perks.chainChance
    ) {
      const target = getNearestEnemy(e.x, e.y, e);
      if (target) {
        const a = Math.atan2(target.y - e.y, target.x - e.x);
        state.projectiles.push({
          x: e.x,
          y: e.y,
          vx: Math.cos(a) * 560,
          vy: Math.sin(a) * 560,
          r: 4,
          damage: projectile.damage * 0.45,
          pierce: 0,
          knockback: 14,
          tags: ["projectile", "magic"],
          color: "#c4b5fd",
          life: 1.5,
          allowChain: false,
          depth: depth + 1,
        });
      }
    }

    if (state.perks.starChance && Math.random() < state.perks.starChance) {
      damageArea(
        e.x,
        e.y,
        42,
        projectile.damage * 0.35,
        16,
        ["light", "area"],
        true,
        "#c4b5fd",
      );
    }
  }
}
function applyBurn(e, dps, duration) {
  e.burnTime = Math.max(e.burnTime, duration);
  e.burnDps = Math.max(e.burnDps, dps);
  if (state.activeSynergies.has("frostfire") && e.slowTime > 0) {
    e.hp -= dps;
    addFloating(e.x, e.y - 12, "서리불꽃", "#fb923c");
  }
}
function spreadBurn(source, dps) {
  let count = 0;
  for (const e of state.enemies) {
    if (e === source || count >= 2) continue;
    if (Math.hypot(e.x - source.x, e.y - source.y) < 80) {
      applyBurn(e, dps, 2.5);
      count++;
    }
  }
}
function killEnemy(e, tags = []) {
  if (e.dead) return;

  e.dead = true;
  e.hp = 0;
  state.kills += 1;

  state.gems.push({
    x: e.x,
    y: e.y,
    r: 5,
    exp: e.exp * state.base.expMul
  });

  if (tags.includes("holy")) {
    addShield(4);
  }

  if (e.boss) {
    const bonus = Math.round(1200 * (1 + meta.upgrades.elite_bounty * 0.1));
    addRunCoins(bonus);
    showBigAlert("보스 처치!", `+${bonus} 코인`);
  } else if (e.midBoss) {
    const bonus = Math.round(350 * (1 + meta.upgrades.elite_bounty * 0.1));
    addRunCoins(bonus);
    showBigAlert("중간보스 처치!", `+${bonus} 코인`);
  } else if (e.elite) {
    const bonus = Math.round(35 * (1 + meta.upgrades.elite_bounty * 0.1));
    addRunCoins(bonus);
    showToast(`정예 처치 +${bonus}코인`);
  }

  if (
    state.synergy.shieldOnKillChance &&
    Math.random() <
      state.synergy.shieldOnKillChance + state.perks.killShieldChance
  ) {
    addShield(state.synergy.shieldOnKill || 6);
  }

  if (
    state.synergy.healOnKillChance &&
    Math.random() <
      state.synergy.healOnKillChance + state.perks.killHealChance
  ) {
    healPlayer(state.synergy.healOnKill || 4);
  }

  if (state.synergy.demonKillStack) {
    let gain = 1;

    if (state.perks.demonGate) gain += 1;

    if (
      state.perks.bloodFlameDemon &&
      (e.burnTime > 0 || tags.includes("burn"))
    ) {
      gain += 2;
    }

    if (state.perks.holyDemonScar && state.player.shield > 0) {
      gain += 1;
    }

    state.stacks.demon = Math.min(
      state.synergy.demonMax || 80,
      state.stacks.demon + gain
    );
  }

  if (state.activeSynergies.has("fire6") && e.burnTime > 0) {
    damageArea(
      e.x,
      e.y,
      60,
      e.maxHp * 0.25,
      24,
      ["fire", "area"],
      true,
      "#f97316"
    );

    spreadBurn(e, e.maxHp * 0.04);
  }

  if (
    state.activeSynergies.has("light6") &&
    tags.includes("area") &&
    Math.random() < 0.25
  ) {
    damageArea(
      e.x,
      e.y,
      50,
      e.maxHp * 0.18,
      18,
      ["light", "area"],
      true,
      "#fde68a"
    );
  }

  maybeDropItem(e);
}

function maybeDropItem(e) {
  const dropChance = e.elite ? 0.18 : 0.015;
  if (Math.random() > dropChance) return;
  const grade = rollItemGrade(e.elite);
  const item = createDropItem(grade);
  item.x = e.x;
  item.y = e.y;
  item.r = grade === "legendary" ? 9 : grade === "epic" ? 8 : 7;
  state.drops.push(item);
}
function rollItemGrade(elite) {
  const gemCount = state.itemStats.gems;
  const gemMul = gemCount >= 3 ? 0.1 : gemCount >= 2 ? 0.3 : 1;
  const table = elite
    ? {
        basic: 35,
        normal: 35,
        advanced: 22,
        epic: 7 * gemMul,
        legendary: 1 * gemMul,
      }
    : {
        basic: 70,
        normal: 24,
        advanced: 5,
        epic: 0.9 * gemMul,
        legendary: 0.1 * gemMul,
      };
  return weightedPick(
    Object.entries(table).map(([grade, weight]) => ({ grade, weight })),
  ).grade;
}
function createDropItem(grade) {
  if (grade === "basic")
    return {
      grade,
      ...randomItem([
        { name: "체력회복(소)", kind: "heal_small", color: "#bfdbfe" },
        { name: "자석", kind: "magnet", color: "#22d3ee" },
        { name: "코인(소)", kind: "coin_small", color: "#fde68a" },
      ]),
    };
  if (grade === "normal")
    return {
      grade,
      ...randomItem([
        { name: "체력회복(대)", kind: "heal_big", color: "#60a5fa" },
        { name: "전체 몹 킬", kind: "nuke", color: "#f87171" },
        { name: "코인(대)", kind: "coin_big", color: "#facc15" },
      ]),
    };
  if (grade === "advanced")
    return {
      grade,
      ...randomItem([
        { name: "공격력 증가", kind: "buff_damage", color: "#86efac" },
        { name: "이속 증가", kind: "buff_speed", color: "#86efac" },
        { name: "공속 증가", kind: "buff_as", color: "#86efac" },
        { name: "공격범위 증가", kind: "buff_area", color: "#86efac" },
      ]),
    };
  if (grade === "epic") {
    const attr = randomItem(NORMAL_ATTRS);
    const value = Math.random() < 0.7 ? 1 : 2;
    return {
      grade,
      kind: "gem",
      name: `${attr} +${value} 보석`,
      attr,
      value,
      color: "#c4b5fd",
    };
  }
  const roll = Math.random();
  if (roll < 0.4)
    return {
      grade,
      kind: "gem",
      name: "특정 속성 +3 보석",
      attr: randomItem(NORMAL_ATTRS),
      value: 3,
      color: "#facc15",
    };
  if (roll < 0.6)
    return {
      grade,
      kind: "all_gem",
      name: "모든 속성 +1 보석",
      value: 1,
      color: "#facc15",
    };
  if (roll < 0.8)
    return {
      grade,
      kind: "gem",
      name: "특정 속성 +4 보석",
      attr: randomItem(NORMAL_ATTRS),
      value: 4,
      color: "#facc15",
    };
  return {
    grade,
    kind: "gem",
    name: "鬼 +2 귀속 보석",
    attr: "鬼",
    value: 2,
    color: "#facc15",
  };
}
function applyDrop(item) {
  state.itemStats.total += 1;
  if (item.kind === "heal_small") healPlayer(state.player.maxHp * 0.15);
  if (item.kind === "heal_big") healPlayer(state.player.maxHp * 0.4);
  if (item.kind === "magnet") for (const g of state.gems) g.forceMagnet = true;
  if (item.kind === "coin_small") addRunCoins(30);
  if (item.kind === "coin_big") addRunCoins(120);
  if (item.kind === "nuke")
    for (const e of [...state.enemies]) {
      if (e.elite) e.hp -= e.maxHp * 0.25;
      else e.hp = 0;
      if (e.hp <= 0) killEnemy(e, ["nuke"]);
    }
  if (item.kind === "buff_damage") addTimedBuff("damage", 1.4, 15);
  if (item.kind === "buff_speed") addTimedBuff("speed", 1.35, 15);
  if (item.kind === "buff_as") addTimedBuff("attackSpeed", 1.35, 15);
  if (item.kind === "buff_area") addTimedBuff("area", 1.4, 15);
  if (item.kind === "gem") {
    state.attrsFromGems[item.attr] =
      (state.attrsFromGems[item.attr] || 0) + item.value;
    state.itemStats.gems += 1;
    if (item.grade === "legendary") state.itemStats.legendary += 1;
    showBigAlert(item.name, `${item.attr} +${item.value}`);
    rebuildStats();
  }
  if (item.kind === "all_gem") {
    for (const a of NORMAL_ATTRS)
      state.attrsFromGems[a] = (state.attrsFromGems[a] || 0) + 1;
    state.itemStats.gems += 1;
    state.itemStats.legendary += 1;
    showBigAlert("모든 속성 +1 보석", "鬼 제외 모든 일반 속성 강화");
    rebuildStats();
  }
  showToast(`아이템 획득: ${item.name}`);
}
function damageArea(
  x,
  y,
  radius,
  damage,
  knockback,
  tags = ["area"],
  showEffect = true,
  color = "#facc15",
) {
  if (showEffect)
    state.effects.push({ x, y, radius, life: 0.25, maxLife: 0.25, color });
  for (const e of state.enemies)
    if (Math.hypot(e.x - x, e.y - y) < radius + e.r)
      hitEnemy(e, damage, tags, knockback, x, y, 1);
}
function damagePlayer(amount, sourceX, sourceY) {
  if (state.player.invuln > 0) return;
  if (state.perks.glassSanctuary && state.player.shield <= 0) amount *= 1.2;
  if (state.perks.demonGate) amount += state.player.hp * 0.08;
  damagePlayerRaw(amount * Math.max(0.2, 1 - state.base.defense));
  state.player.invuln = 1 + meta.upgrades.invuln * 0.08;
  const dx = state.player.x - sourceX,
    dy = state.player.y - sourceY,
    len = Math.hypot(dx, dy) || 1;
  state.player.kbX += (dx / len) * 560;
  state.player.kbY += (dy / len) * 560;
  if (state.perks.focusBlade) state.stacks.focus = 0;
  if (state.synergy.demonKillStack && state.stacks.demonNoLossMs <= 0) {
    let loss = state.synergy.demonLoss || 0.5;
    if (state.perks.holyDemonScar && state.player.shield > 0) loss *= 0.5;
    state.stacks.demon = Math.floor(state.stacks.demon * (1 - loss));
  }
  addFloating(state.player.x, state.player.y - 18, "피격!", "#fca5a5");
}
function damagePlayerRaw(amount) {
  if (amount <= 0) return;
  if (state.player.shield > 0) {
    const used = Math.min(state.player.shield, amount);
    state.player.shield -= used;
    amount -= used;
  }
  state.player.hp -= amount;
  if (
    state.player.hp <= state.player.maxHp * 0.25 &&
    !state.player.emergencyUsed &&
    meta.upgrades.emergency > 0
  ) {
    state.player.emergencyUsed = true;
    healPlayer(10 + meta.upgrades.emergency * 5);
    showToast("응급 회복 발동!");
  }
  if (state.player.hp <= 0) {
    if (!state.player.deathSaved && meta.upgrades.deathsave > 0) {
      state.player.deathSaved = true;
      state.player.hp = 1;
      state.player.invuln = 2;
      addShield(30);
      showBigAlert("사망 유예", "치명 피해를 버텼습니다");
      return;
    }
    endGame(false);
  }
}
function addShield(amount) {
  state.player.shield += amount;
  if (state.perks.sanctuaryLoop) healPlayer(amount * 0.15);
}
function healPlayer(amount) {
  let value = amount * state.base.healMul;
  if (state.perks.cursedCrown) value *= 0.5;
  const before = state.player.hp;
  state.player.hp = Math.min(state.player.maxHp, state.player.hp + value);
  const over = Math.max(0, before + value - state.player.maxHp);
  if (state.activeSynergies.has("evil6") && over > 0)
    addTimedBuff("damage", 1 + Math.min(0.5, over / 100), 5);
  if (state.perks.evilDemonFeast && state.synergy.demonKillStack)
    state.stacks.demon = Math.min(
      state.synergy.demonMax || 80,
      state.stacks.demon + 1 + (over > 0 ? 1 : 0),
    );
}

function updatePassiveRegen(dt) {
  if (!state || !state.player) return;

  const regenLevel = meta.upgrades.regen || 0;
  if (regenLevel <= 0) return;
  if (state.player.hp <= 0) return;
  if (state.player.hp >= state.player.maxHp) return;

  const regenPerSec = regenLevel * 0.35;
  const healEff = state.base?.healMul || 1;
  const value = regenPerSec * healEff * dt;

  state.player.hp = Math.min(state.player.maxHp, state.player.hp + value);
}

function applyEnemyKnockback(e, sx, sy, power) {
  const dx = e.x - sx,
    dy = e.y - sy,
    len = Math.hypot(dx, dy) || 1,
    finalPower = power * (1 - (e.kb || 0));
  e.vx += (dx / len) * finalPower * 18;
  e.vy += (dy / len) * finalPower * 18;
}
function updateGemsAndDrops(dt) {
  for (const g of state.gems) {
    const dx = state.player.x - g.x,
      dy = state.player.y - g.y,
      dist = Math.hypot(dx, dy) || 1;
    if (dist < state.player.magnetRange || g.forceMagnet) {
      g.x += (dx / dist) * 330 * dt;
      g.y += (dy / dist) * 330 * dt;
    }
    if (dist < state.player.r + g.r + 4) {
      g.collected = true;
      gainExp(g.exp);
    }
  }
  state.gems = state.gems.filter((g) => !g.collected);
  for (const d of state.drops) {
    const dx = state.player.x - d.x,
      dy = state.player.y - d.y,
      dist = Math.hypot(dx, dy) || 1;
    if (dist < state.player.magnetRange) {
      d.x += (dx / dist) * 230 * dt;
      d.y += (dy / dist) * 230 * dt;
    }
    if (dist < state.player.r + d.r + 6) {
      d.collected = true;
      applyDrop(d);
    }
  }
  state.drops = state.drops.filter((d) => !d.collected);
}
function gainExp(amount) {
  if (state.level >= MAX_LEVEL) {
    state.overExp += amount;
    while (state.overExp >= OVER_EXP_REWARD) {
      state.overExp -= OVER_EXP_REWARD;
      grantOverExpReward();
    }
    return;
  }
  state.exp += amount;
  while (state.level < MAX_LEVEL && state.exp >= EXP_TO_NEXT[state.level]) {
    state.exp -= EXP_TO_NEXT[state.level];
    state.level += 1;
    rebuildStats();
    pendingAugmentAfterGrowth =
      SPECIAL_LEVELS.has(state.level) && state.augments.length < MAX_AUGMENTS;
    openGrowthChoice();
    if (state.level >= MAX_LEVEL) {
      state.level = MAX_LEVEL;
      state.overExp += state.exp;
      state.exp = 0;
    }
    break;
  }
}
function grantOverExpReward() {
  const bonus = 1 + meta.upgrades.over_exp * 0.1;
  const list = [
    {
      weight: 35,
      run: () => healPlayer(state.player.maxHp * 0.1),
      text: "HP 10% 회복",
    },
    {
      weight: 20,
      run: () => addShield(state.player.maxHp * 0.15),
      text: "보호막",
    },
    {
      weight: 35,
      run: () => addRunCoins(Math.round(40 * bonus)),
      text: `코인 +${Math.round(40 * bonus)}`,
    },
    {
      weight: 10,
      run: () => addRunCoins(Math.round(120 * bonus)),
      text: `코인 +${Math.round(120 * bonus)}`,
    },
  ];
  const r = weightedPick(list);
  r.run();
  showToast(`초과 경험 보상: ${r.text}`);
}
function addRunCoins(amount) {
  state.runCoins += Math.round(amount * (1 + meta.upgrades.coin_gain * 0.05));
}
function addTimedBuff(type, mul, sec) {
  state.buffs.push({ type, mul, time: sec });
}
function updateBuffs(dt) {
  for (const b of state.buffs) b.time -= dt;
  state.buffs = state.buffs.filter((b) => b.time > 0);
}
function getBuffMul(type) {
  return state.buffs
    .filter((b) => b.type === type)
    .reduce((m, b) => m * b.mul, 1);
}
function updateEffects(dt) {
  state.effects.forEach((e) => (e.life -= dt));
  state.effects = state.effects.filter((e) => e.life > 0);
}
function updateFloating(dt) {
  state.floating.forEach((f) => {
    f.life -= dt;
    f.y -= 25 * dt;
  });
  state.floating = state.floating.filter((f) => f.life > 0);
}
function addFloating(x, y, text, color) {
  state.floating.push({ x, y, text, color, life: 0.6 });
}

function drawDiamond(x, y, size, fill, stroke = null) {
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x, y + size);
  ctx.lineTo(x - size, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();

  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function drawTriangle(x, y, size, fill, stroke = null) {
  const angle = Math.atan2(state.player.y - y, state.player.x - x);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle + Math.PI / 2);

  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.9, size);
  ctx.lineTo(-size * 0.9, size);
  ctx.closePath();

  ctx.fillStyle = fill;
  ctx.fill();

  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.restore();
}

function drawItemShape(item) {
  const gradeStroke = {
    basic: "rgba(255,255,255,.45)",
    normal: "#93c5fd",
    advanced: "#86efac",
    epic: "#c4b5fd",
    legendary: "#facc15"
  };

  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.rotate(Math.PI / 4);

  ctx.fillStyle = item.color;
  ctx.fillRect(-item.r, -item.r, item.r * 2, item.r * 2);

  ctx.strokeStyle = gradeStroke[item.grade] || "rgba(255,255,255,.45)";
  ctx.lineWidth = item.grade === "legendary" ? 3 : 2;
  ctx.strokeRect(-item.r, -item.r, item.r * 2, item.r * 2);

  ctx.restore();

  if (item.grade === "epic" || item.grade === "legendary") {
    ctx.beginPath();
    ctx.strokeStyle = item.grade === "legendary" ? "#facc15" : "#c4b5fd";
    ctx.lineWidth = 1.5;
    ctx.arc(item.x, item.y, item.r + 6, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawEnemyShape(e) {
  const fill = e.freezeTime > 0 ? "#7dd3fc" : e.burnTime > 0 ? "#fb923c" : e.color;

  if (e.boss) {
    ctx.beginPath();
    ctx.fillStyle = "rgba(239,68,68,.16)";
    ctx.arc(e.x, e.y, e.r + 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = fill;
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 5;
    ctx.arc(e.x, e.y, e.r + 7, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = "#fecaca";
    ctx.lineWidth = 2;
    ctx.arc(e.x, e.y, e.r + 14, 0, Math.PI * 2);
    ctx.stroke();

    drawEnemyName(e, "#fecaca");
    return;
  }

  if (e.midBoss) {
    ctx.beginPath();
    ctx.fillStyle = fill;
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 4;
    ctx.arc(e.x, e.y, e.r + 5, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = "rgba(255,255,255,.65)";
    ctx.lineWidth = 1.5;
    ctx.arc(e.x, e.y, e.r + 10, 0, Math.PI * 2);
    ctx.stroke();

    drawEnemyName(e, "#fef3c7");
    return;
  }

  if (e.ai === "ranged") {
    drawTriangle(e.x, e.y, e.r + 2, fill, e.elite ? "#facc15" : "rgba(255,255,255,.35)");
    return;
  }

  ctx.beginPath();
  ctx.fillStyle = fill;
  ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
  ctx.fill();

  if (e.elite) {
    ctx.beginPath();
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 3;
    ctx.arc(e.x, e.y, e.r + 4, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawEnemyName(e, color) {
  if (!e.name) return;

  ctx.font = "bold 12px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillStyle = color;
  ctx.fillText(e.name, e.x, e.y - e.r - 12);

  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
}

function drawEnemyHpBar(e) {
  const w = e.boss ? 60 : e.midBoss ? 48 : e.r * 2;
  const h = e.boss || e.midBoss ? 5 : 3;
  const yOffset = e.boss || e.midBoss ? e.r + 10 : e.r + 8;

  ctx.fillStyle = "rgba(0,0,0,.65)";
  ctx.fillRect(e.x - w / 2, e.y - yOffset, w, h);

  ctx.fillStyle = e.boss ? "#ef4444" : e.midBoss ? "#facc15" : "#ef4444";
  ctx.fillRect(e.x - w / 2, e.y - yOffset, w * Math.max(0, e.hp / e.maxHp), h);
}

function drawEnemyProjectile(p) {
  ctx.beginPath();
  ctx.fillStyle = p.color || "#fca5a5";
  ctx.globalAlpha = 0.85;
  ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.beginPath();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1.8;
  ctx.arc(p.x, p.y, p.r + 2, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.strokeStyle = "rgba(239,68,68,.45)";
  ctx.lineWidth = 1;
  ctx.arc(p.x, p.y, p.r + 5, 0, Math.PI * 2);
  ctx.stroke();
}

function drawBossTopBar() {
  if (!state) return;

  const boss = state.enemies.find(e => e.boss && e.hp > 0);
  if (!boss) return;

  const margin = 22;
  const width = canvas.width - margin * 2;
  const height = 12;
  const x = margin;
  const y = 18;

  ctx.fillStyle = "rgba(0,0,0,.65)";
  ctx.fillRect(x, y, width, height);

  ctx.fillStyle = "#ef4444";
  ctx.fillRect(x, y, width * Math.max(0, boss.hp / boss.maxHp), height);

  ctx.strokeStyle = "#fecaca";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, height);

  ctx.font = "bold 13px sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "#fecaca";
  ctx.fillText(`${boss.name || "보스"}  ${Math.ceil(boss.hp)} / ${Math.ceil(boss.maxHp)}`, canvas.width / 2, y + 28);

  ctx.textAlign = "start";
}

function draw() {
  if (!ctx || !canvas) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  if (state && state.weapon) {
    drawWeaponAuras();
  }
for (const g of state?.gems || []) {
  drawDiamond(g.x, g.y, g.r + 1, "#22d3ee", "rgba(255,255,255,.65)");
}

for (const d of state?.drops || []) {
  drawItemShape(d);
}
  for (const ef of state?.effects || []) {
    const alpha = Math.max(0, ef.life / ef.maxLife);
    ctx.beginPath();
    ctx.fillStyle = ef.color;
    ctx.globalAlpha = alpha * 0.35;
    ctx.arc(ef.x, ef.y, ef.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  for (const p of state?.projectiles || []) {
    ctx.beginPath();
    ctx.fillStyle = p.color || (p.depth > 0 ? "#c4b5fd" : "#bfdbfe");
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  
for (const e of state?.enemies || []) {
  drawEnemyShape(e);
  drawEnemyHpBar(e);
}

for (const p of state?.enemyProjectiles || []) {
  drawEnemyProjectile(p);
}
  
  if (state) {
    drawOrbitWeapons();
    const inv = state.player.invuln > 0;
    ctx.save();
    ctx.globalAlpha = inv ? 0.55 : 1;
    ctx.beginPath();
    ctx.fillStyle = state.weapon.color;
    ctx.arc(state.player.x, state.player.y, state.player.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (inv) {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255,255,255,.75)";
      ctx.lineWidth = 2;
      ctx.arc(
        state.player.x,
        state.player.y,
        state.player.r + 8,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
    if (state.player.shield > 0) {
      ctx.beginPath();
      ctx.strokeStyle = "#60a5fa";
      ctx.lineWidth = 3;
      ctx.arc(
        state.player.x,
        state.player.y,
        state.player.r + 6,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
    for (const f of state.floating) {
      ctx.globalAlpha = Math.max(0, f.life / 0.6);
      ctx.fillStyle = f.color;
      ctx.font = "bold 13px sans-serif";
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    }
    drawBossTopBar();
  }
}
function drawGrid() {
  ctx.strokeStyle = "rgba(255,255,255,.04)";
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}
function drawWeaponAuras() {
  if (!state || !state.weapon) return;

  if (state.weapon.id === "flame_heart") {
    const w = getWeaponStats();

    ctx.beginPath();
    ctx.fillStyle = "rgba(251,113,133,.08)";
    ctx.arc(state.player.x, state.player.y, w.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.strokeStyle = "rgba(251,113,133,.38)";
    ctx.lineWidth = 2;
    ctx.arc(state.player.x, state.player.y, w.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawOrbitWeapons() {
  if (!state || !state.weapon) return;
  if (state.weapon.id !== "orbit_axe") return;

  const w = getWeaponStats();

  for (let i = 0; i < w.count; i++) {
    const a = (state.orbitAngle || 0) + (Math.PI * 2 * i) / w.count;
    const x = state.player.x + Math.cos(a) * w.orbitRadius;
    const y = state.player.y + Math.sin(a) * w.orbitRadius;

    ctx.beginPath();
    ctx.fillStyle = "#fbbf24";
    ctx.arc(x, y, w.axeRadius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function statDamageMul() {
  const focusMul = state.perks.focusBlade
    ? Math.pow(1.005, state.stacks.focus)
    : 1;
  const demonMul = 1 + state.stacks.demon * (state.synergy.demonKillStack || 0);
  return state.base.damageMul * focusMul * demonMul * getBuffMul("damage");
}
function statAttackSpeedMul() {
  return (
    state.base.attackSpeedMul *
    state.perks.attackSpeedMul *
    state.synergy.attackSpeedMul *
    getBuffMul("attackSpeed")
  );
}
function statAreaMul() {
  return (
    state.base.areaMul *
    state.perks.areaMul *
    state.synergy.areaMul *
    getBuffMul("area")
  );
}
async function endGame(success) {
  if (!state || state.rewardClaimed) return;
  state.running = false;
  state.paused = true;
  resetTouchMove();
  cancelAnimationFrame(loopId);
  const survivalBase = Math.floor(state.timeMs / 1000);
  const survivalCoins = Math.round(
    survivalBase * (1 + meta.upgrades.survival_coin * 0.05),
  );
  const killCoins = Math.round(
    state.kills * 2 * (1 + meta.upgrades.kill_coin * 0.05),
  );
  const levelCoins = state.level * 20;
  const synergyCoins = state.activeSynergies.size * 120;
  const augmentCoins = state.augments.length * 80;
  const successBonus = success ? 500 : 0;
  let earned =
    state.runCoins +
    survivalCoins +
    killCoins +
    levelCoins +
    synergyCoins +
    augmentCoins +
    successBonus;
  const jackpot = Math.random() < meta.upgrades.jackpot * 0.02;
  if (jackpot) earned *= 2;
  earned = Math.round(earned);
  meta.coins += earned;
  meta.totalCoins += earned;
  meta.bestTimeMs = Math.max(meta.bestTimeMs || 0, state.timeMs);
  meta.bestKills = Math.max(meta.bestKills || 0, state.kills);
  state.rewardClaimed = true;
  await saveMeta();
  resultTitle.textContent = success ? "20분 생존 성공!" : "사망";
  resultDesc.innerHTML = `생존 시간: <strong>${formatTime(state.timeMs)}</strong><br>레벨: <strong>${state.level >= MAX_LEVEL ? "MAX" : state.level}</strong><br>처치 수: <strong>${state.kills}</strong><br>증강 수: <strong>${state.augments.length}</strong><br>발현 시너지 수: <strong>${state.activeSynergies.size}</strong><br>획득 아이템: <strong>${state.itemStats.total}</strong><br>획득 보석: <strong>${state.itemStats.gems}</strong><br>전투 중 코인: <strong>${state.runCoins}</strong><br>정산 코인: <strong>${earned - state.runCoins}</strong><br>${jackpot ? `<strong style="color:#facc15;">대박 보상 2배 발동!</strong><br>` : ""}총 획득 코인: <strong>${earned}</strong><br>보유 코인: <strong>${Math.floor(meta.coins)}</strong>`;
  resultOverlay.classList.add("show");
}
function pauseGame() {
  if (!state || !state.running || state.paused) return;
  state.paused = true;
  resetTouchMove();
  pauseInfo.innerHTML = `현재 시간: <strong>${formatTime(state.timeMs)}</strong><br>레벨: <strong>${state.level}</strong><br>처치 수: <strong>${state.kills}</strong><br>전투 코인: <strong>${state.runCoins}</strong>`;
  pauseDetails.innerHTML = renderPauseDetails();
  pauseOverlay.classList.add("show");
}
function resumeGame() {
  if (!state) return;
  pauseOverlay.classList.remove("show");
  state.paused = false;
  lastTs = performance.now();
}
function restartRun() {
  pauseOverlay.classList.remove("show");
  resultOverlay.classList.remove("show");
  choiceOverlay.classList.remove("show");
  cancelAnimationFrame(loopId);
  state = null;
  openWeaponSelect();
  updateUi();
}
function exitToMain() {
  pauseOverlay.classList.remove("show");
  resultOverlay.classList.remove("show");
  choiceOverlay.classList.remove("show");
  weaponOverlay.classList.remove("show");
  labOverlay.classList.remove("show");
  codexOverlay.classList.remove("show");
  cancelAnimationFrame(loopId);
  resetTouchMove();
  state = null;
  titleOverlay.classList.add("show");
  updateUi();
}
function setLabTab(tab) {
  labTab = tab;
  document
    .querySelectorAll("#labOverlay .tab")
    .forEach((b) => b.classList.remove("active"));
  document
    .getElementById(
      tab === "basic"
        ? "tabBasic"
        : tab === "combat"
          ? "tabCombat"
          : "tabEconomy",
    )
    .classList.add("active");
  renderLab();
}
function openLab() {
  titleOverlay.classList.remove("show");
  labOverlay.classList.add("show");
  renderLab();
}
function closeLab() {
  labOverlay.classList.remove("show");
  titleOverlay.classList.add("show");
  updateUi();
}
function getLabCost(item) {
  const [id, , max, base, growth] = item;
  const level = meta.upgrades[id] || 0;
  if (level >= max) return null;
  const discount = 1 - (meta.upgrades.research_discount || 0) * 0.03;
  return Math.max(
    1,
    Math.round((base * Math.pow(growth, level) * discount) / 10) * 10,
  );
}
async function buyLab(id) {
  const item = Object.values(LABS)
    .flat()
    .find((x) => x[0] === id);
  if (!item) return;
  const level = meta.upgrades[id] || 0,
    max = item[2];
  if (level >= max) return;
  const cost = getLabCost(item);
  if (meta.coins < cost) {
    showToast("코인이 부족합니다.");
    return;
  }
  meta.coins -= cost;
  meta.upgrades[id] = level + 1;
  await saveMeta();
  renderLab();
  updateUi();
  showToast(`${item[1]} Lv.${level + 1}`);
}
async function resetLabData() {
  if (!confirm("SABANA 코인과 연구 데이터를 초기화할까요?")) return;
  meta = defaultMeta();
  await saveMeta();
  renderLab();
  updateUi();
  showToast("SABANA 데이터 초기화 완료");
}
function openCodex() {
  titleOverlay.classList.remove("show");
  codexOverlay.classList.add("show");
  renderCodex();
}
function closeCodex() {
  codexOverlay.classList.remove("show");
  titleOverlay.classList.add("show");
}
function setCodexTab(tab) {
  codexTab = tab;
  document
    .querySelectorAll("#codexOverlay .tab")
    .forEach((b) => b.classList.remove("active"));
  document
    .getElementById(
      tab === "augments"
        ? "codexAugTab"
        : tab === "synergies"
          ? "codexSynTab"
          : "codexItemTab",
    )
    .classList.add("active");
  renderCodex();
}
function getNearestEnemy(
  x = state.player.x,
  y = state.player.y,
  exclude = null,
) {
  let best = null,
    bestD = Infinity;
  for (const e of state.enemies) {
    if (e === exclude || e.hp <= 0) continue;
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}
function getEnemiesSortedByDistance() {
  return [...state.enemies]
    .filter((e) => e.hp > 0)
    .sort(
      (a, b) =>
        Math.hypot(a.x - state.player.x, a.y - state.player.y) -
        Math.hypot(b.x - state.player.x, b.y - state.player.y),
    );
}
function weightedPick(list) {
  const total = list.reduce((sum, item) => sum + item.weight, 0);
  let r = Math.random() * total;
  for (const item of list) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return list[0];
}
function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
