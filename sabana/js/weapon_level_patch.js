// SABANA weapon + level patch v1
// 4차 적용: 4무기 구조 + 무기 Lv.10 + 등급별 레벨업 카드.
(function () {
  if (window.__sabanaWeaponLevelPatchV1) return;
  window.__sabanaWeaponLevelPatchV1 = true;

  const PATCH_WEAPONS = [
    { id: "magic_staff", name: "마력탄 지팡이", desc: "낮은 피해의 마력탄을 매우 빠르게 연사합니다. 보스전 지속딜이 안정적입니다.", tags: ["원거리", "고공속", "단일딜"] },
    { id: "throw_axe", name: "투척 도끼", desc: "넓은 판정의 도끼를 일직선으로 던집니다. 기본 관통과 높은 피해로 몹 줄을 찢습니다.", tags: ["관통", "직선", "고피해"] },
    { id: "crescent_blade", name: "초승달 검", desc: "가까운 적을 향해 부채꼴로 베어냅니다. 성장하면 후방/좌우/참격파가 열립니다.", tags: ["근접", "광역", "고위험"] },
    { id: "storm_orb", name: "번개 수정구", desc: "적 사이를 튕기는 번개를 방출합니다. 다수전과 감전 디버프에 특화됩니다.", tags: ["연쇄", "감전", "다수전"] }
  ];

  function patchWeaponsTable() {
    if (typeof WEAPONS === "undefined") window.WEAPONS = PATCH_WEAPONS;
    else if (Array.isArray(WEAPONS)) WEAPONS.splice(0, WEAPONS.length, ...PATCH_WEAPONS);
  }

  const GRADES = [
    { name: "일반", cls: "normal", w: 78, lv: 1, min: 8, max: 11 },
    { name: "희귀", cls: "rare", w: 20, lv: 2, min: 14, max: 18 },
    { name: "전설", cls: "legendary", w: 2, lv: 3, min: 24, max: 30 }
  ];

  const COMBAT = [
    ["damage", "공격력", 0.012, v => `공격력 +${Math.round(v * 100)}%`],
    ["attackSpeed", "공격속도", 0.010, v => `공격속도 +${Math.round(v * 100)}%`],
    ["area", "공격범위", 0.014, v => `공격범위 +${Math.round(v * 100)}%`],
    ["knockback", "넉백", 0.018, v => `넉백 +${Math.round(v * 100)}%`],
    ["bossDamage", "보스 피해", 0.012, v => `보스 피해 +${Math.round(v * 100)}%`]
  ];

  const SUPPORT = [
    ["move", "이동속도", 0.008, v => `이동속도 +${Math.round(v * 100)}%`],
    ["hp", "최대 HP", 3.5, v => `최대 HP +${Math.round(v)}, HP ${Math.round(v * 0.65)} 회복`],
    ["defense", "방어력", 0.004, v => `받는 피해 -${(v * 100).toFixed(1)}%`],
    ["magnet", "자석범위", 3.5, v => `자석범위 +${Math.round(v)}`],
    ["exp", "경험치", 0.009, v => `경험치 획득 +${Math.round(v * 100)}%`],
    ["coin", "전투 코인", 0.012, v => `전투 코인 획득 +${Math.round(v * 100)}%`]
  ];

  function one(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function rnd(min, max) { return Math.floor(min + Math.random() * (max - min + 1)); }
  function grade() {
    let r = Math.random() * 100;
    for (const g of GRADES) { r -= g.w; if (r <= 0) return g; }
    return GRADES[0];
  }
  function weaponLv() {
    if (!state) return 0;
    state.weaponLevel = Math.max(0, Math.min(10, Number(state.weaponLevel || 0)));
    return state.weaponLevel;
  }
  function weaponName() { return state?.weapon?.name || "무기"; }

  function statCard() {
    const gr = grade();
    const c = one(COMBAT);
    const s = one(SUPPORT);
    const total = rnd(gr.min, gr.max);
    const cp = Math.max(2, Math.round(total * (0.35 + Math.random() * 0.3)));
    const sp = Math.max(2, total - cp);
    const cv = cp * c[2];
    const sv = sp * s[2];
    return {
      type: "growth",
      label: `[${gr.name}] 능력 강화`,
      name: `${c[1]} + ${s[1]}`,
      desc: `${c[3](cv)}\n${s[3](sv)}\n총 성장 포인트 ${total}`,
      apply() {
        state.growth[c[0]] = (state.growth[c[0]] || 0) + cv;
        state.growth[s[0]] = (state.growth[s[0]] || 0) + sv;
        if (s[0] === "hp") healPlayer(sv * 0.65);
      }
    };
  }

  function weaponCard() {
    const gr = grade();
    const before = weaponLv();
    const after = Math.min(10, before + gr.lv);
    const gain = Math.max(0, after - before);
    return {
      type: "growth",
      label: `[${gr.name}] 무기 강화`,
      name: `${weaponName()} Lv.${before} → Lv.${after}`,
      desc: gain > 0 ? `무기 레벨 +${gain}\nLv.4 / Lv.7 / Lv.10에서 공격 형태가 크게 변합니다.` : "무기가 이미 최대 레벨입니다. 모든 피해 +4%로 전환됩니다.",
      apply() {
        const cur = weaponLv();
        const next = Math.min(10, cur + gr.lv);
        const overflow = Math.max(0, cur + gr.lv - 10);
        state.weaponLevel = next;
        state.growth.weaponOverflow = (state.growth.weaponOverflow || 0) + (overflow > 0 || cur >= 10 ? 0.04 + overflow * 0.03 : 0);
        showBigAlert(`${weaponName()} 강화`, `Lv.${cur} → Lv.${state.weaponLevel}`);
      }
    };
  }

  window.renderWeapons = function renderWeapons() {
    patchWeaponsTable();
    weaponCards.innerHTML = "";
    PATCH_WEAPONS.forEach(w => {
      const div = document.createElement("div");
      div.className = "card";
      div.innerHTML = `<h3>${w.name}</h3><div class="desc">${w.desc}</div><div class="badge-row">${w.tags.map(t => `<span class="badge">${t}</span>`).join("")}</div>`;
      div.onclick = () => {
        state = makeState(w);
        state.weaponLevel = 0;
        state.growth.bossDamage = 0;
        state.growth.coin = 0;
        state.growth.weaponOverflow = 0;
        rebuildStats();
        weaponOverlay.classList.remove("show");
        startCombat();
      };
      weaponCards.appendChild(div);
    });
  };

  window.rollGrowthChoices = function rollGrowthChoices() {
    const weaponSlots = Math.random() < 0.1 ? 2 : 1;
    const out = [];
    for (let i = 0; i < 3 - weaponSlots; i++) out.push(statCard());
    for (let i = 0; i < weaponSlots; i++) out.push(weaponCard());
    return out.sort(() => Math.random() - 0.5);
  };

  window.openGrowthChoice = function openGrowthChoice() {
    state.paused = true;
    resetTouchMove();
    currentChoiceMode = "growth";
    currentChoices = rollGrowthChoices();
    rerollBtn.style.display = "none";
    choiceTitle.textContent = `Lv.${state.level} 성장 선택`;
    choiceDesc.textContent = "기본 능력치 2개가 동시에 오르거나, 무기 레벨을 올립니다.";
    renderChoiceCards();
    choiceOverlay.classList.add("show");
  };

  const oldRebuild = window.rebuildStats;
  window.rebuildStats = function patchedRebuildStats() {
    oldRebuild();
    if (!state) return;
    state.base.coinMul = 1 + (state.growth.coin || 0);
    state.base.bossDamageMul = 1 + (state.growth.bossDamage || 0);
  };

  const oldCoins = window.addRunCoins;
  window.addRunCoins = function patchedAddRunCoins(amount) {
    return oldCoins(amount * (state?.base?.coinMul || 1));
  };

  window.getWeaponTier = function getWeaponTier() { return weaponLv(); };

  window.getWeaponStats = function getWeaponStats() {
    const id = state.weapon.id;
    const s = state.synergy;
    const g = state.growth;
    const lv = weaponLv();
    const focusMul = state.perks.focusBlade ? Math.pow(1.005, state.stacks.focus) : 1;
    const demonMul = 1 + state.stacks.demon * (s.demonKillStack || 0);
    const buffDamage = getBuffMul("damage");
    const buffAs = getBuffMul("attackSpeed");
    const buffArea = getBuffMul("area");
    let damageMul = state.base.damageMul * focusMul * demonMul * buffDamage * (1 + (g.weaponOverflow || 0));
    let asMul = state.base.attackSpeedMul * state.perks.attackSpeedMul * s.attackSpeedMul * buffAs;
    let areaMul = state.base.areaMul * state.perks.areaMul * s.areaMul * buffArea;
    if (state.perks.glassSanctuary && state.player.shield > 0) damageMul *= 1.6;
    if (state.perks.speedToArea) areaMul *= 1 + Math.min(0.5, (asMul - 1) * state.perks.speedToArea);

    if (id === "magic_staff") return { type: "projectile", damage: (8 + lv * 1.7) * damageMul, intervalMs: Math.max(90, (245 - lv * 8) / asMul), speed: 680 + lv * 28, pierce: (lv >= 7 ? 1 : 0) + (g.pierce || 0), count: (lv >= 10 ? 3 : lv >= 4 ? 2 : 1) + (g.projectile || 0), radius: (3.8 + lv * 0.16) * areaMul, life: 1.7 + lv * 0.04, knockback: (8 + lv * 0.5) * state.base.knockbackMul, tags: ["projectile", "magic"] };
    if (id === "throw_axe") return { type: "axe", damage: (42 + lv * 5.2) * damageMul, intervalMs: Math.max(360, (920 - lv * 32) / asMul), speed: 520 + lv * 18, pierce: 3 + Math.floor(lv / 3) + (g.pierce || 0), count: lv >= 7 ? 2 : 1, radius: (15 + lv * 0.9) * areaMul, life: lv >= 4 ? 1.35 : 1.05, returnAxe: lv >= 4, knockback: (22 + lv * 1.6) * state.base.knockbackMul, tags: ["projectile", "physical", "axe"] };
    if (id === "crescent_blade") return { type: "slash", damage: (38 + lv * 4.6) * damageMul, intervalMs: Math.max(320, (760 - lv * 24) / asMul), range: (74 + lv * 8) * areaMul, angle: Math.PI * (0.58 + lv * 0.025), back: lv >= 4, side: lv >= 7, wave: lv >= 9, cross: lv >= 10, knockback: (26 + lv * 1.7) * state.base.knockbackMul, tags: ["physical", "slash", "area"] };
    if (id === "storm_orb") return { type: "lightning", damage: (25 + lv * 3.4) * damageMul, intervalMs: Math.max(360, (980 - lv * 30) / asMul), chains: 2 + Math.floor(lv / 2), range: (230 + lv * 16) * areaMul, split: lv >= 10 ? 2 : 1, bossRepeat: lv >= 9, shock: lv >= 4, knockback: 8 * state.base.knockbackMul, tags: ["lightning", "magic"] };
    return { type: "projectile", damage: 20 * damageMul, intervalMs: 700 / asMul, speed: 500, pierce: 0, count: 1, radius: 5, life: 2, knockback: 12, tags: ["projectile"] };
  };

  function enemiesByDistance(x = state.player.x, y = state.player.y, except = new Set()) {
    return [...state.enemies].filter(e => e.hp > 0 && !except.has(e)).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
  }

  function fireAxe(w) {
    const targets = enemiesByDistance();
    if (!targets.length) return;
    const source = { id: state.weapon.id, name: state.weapon.name };
    for (let i = 0; i < w.count; i++) {
      const t = targets[i % targets.length];
      const angle = Math.atan2(t.y - state.player.y, t.x - state.player.x) + (i - (w.count - 1) / 2) * 0.16;
      state.projectiles.push({ x: state.player.x, y: state.player.y, vx: Math.cos(angle) * w.speed, vy: Math.sin(angle) * w.speed, r: w.radius, damage: w.damage, pierce: w.pierce, knockback: w.knockback, tags: w.tags, color: "#f59e0b", life: w.life, allowChain: true, depth: 0, source, axeSpin: true });
      if (w.returnAxe) setTimeout(() => { if (state?.running) state.projectiles.push({ x: state.player.x + Math.cos(angle) * 420, y: state.player.y + Math.sin(angle) * 420, vx: -Math.cos(angle) * w.speed * 0.9, vy: -Math.sin(angle) * w.speed * 0.9, r: w.radius, damage: w.damage * 0.75, pierce: w.pierce, knockback: w.knockback, tags: w.tags, color: "#fbbf24", life: 0.75, allowChain: true, depth: 0, source, axeSpin: true }); }, 360);
    }
  }

  function slashAt(angle, w, mul, color) {
    const source = { id: state.weapon.id, name: state.weapon.name };
    const px = state.player.x, py = state.player.y, half = w.angle / 2;
    for (const e of state.enemies) {
      const dx = e.x - px, dy = e.y - py;
      if (Math.hypot(dx, dy) > w.range + e.r) continue;
      const diff = Math.atan2(Math.sin(Math.atan2(dy, dx) - angle), Math.cos(Math.atan2(dy, dx) - angle));
      if (Math.abs(diff) <= half) hitEnemy(e, w.damage * mul, w.tags, w.knockback, px, py, 1, null, source);
    }
    state.effects.push({ x: px + Math.cos(angle) * w.range * 0.45, y: py + Math.sin(angle) * w.range * 0.45, radius: w.range * 0.62, life: 0.16, maxLife: 0.16, color });
  }

  function useSlash(w) {
    const t = enemiesByDistance()[0];
    const base = t ? Math.atan2(t.y - state.player.y, t.x - state.player.x) : 0;
    slashAt(base, w, 1, "#f8fafc");
    if (w.back) slashAt(base + Math.PI, w, 0.55, "#fecaca");
    if (w.side) { slashAt(base + Math.PI / 2, w, 0.6, "#e0f2fe"); slashAt(base - Math.PI / 2, w, 0.6, "#e0f2fe"); }
    if (w.wave) state.projectiles.push({ x: state.player.x, y: state.player.y, vx: Math.cos(base) * 560, vy: Math.sin(base) * 560, r: 11, damage: w.damage * 0.55, pierce: w.cross ? 3 : 1, knockback: w.knockback * 0.6, tags: ["projectile", "slash", "physical"], color: "#e0f2fe", life: 0.75, allowChain: false, depth: 0, source: { id: state.weapon.id, name: state.weapon.name } });
  }

  function useLightning(w) {
    const source = { id: state.weapon.id, name: state.weapon.name };
    const starts = enemiesByDistance().slice(0, w.split);
    for (const first of starts) {
      let cur = first;
      const used = new Set();
      for (let i = 0; i < w.chains && cur; i++) {
        used.add(cur);
        hitEnemy(cur, w.damage * Math.max(0.45, 1 - i * 0.08), w.tags, w.knockback, state.player.x, state.player.y, 1, null, source);
        if (w.shock) { cur.slowTime = Math.max(cur.slowTime || 0, 0.8); cur.slowPower = Math.max(cur.slowPower || 0, 0.18); }
        state.effects.push({ x: cur.x, y: cur.y, radius: 22 + i * 4, life: 0.12, maxLife: 0.12, color: "#93c5fd" });
        const next = enemiesByDistance(cur.x, cur.y, used).find(e => Math.hypot(e.x - cur.x, e.y - cur.y) <= w.range);
        if (!next && w.bossRepeat && (cur.boss || cur.midBoss)) hitEnemy(cur, w.damage * 0.35, w.tags, w.knockback, cur.x, cur.y, 1, null, source);
        cur = next;
      }
    }
  }

  window.updateWeapon = function patchedUpdateWeapon(dt) {
    if (!state.weapon) return;
    const w = getWeaponStats();
    state.attackMs -= dt * 1000;
    if (state.attackMs > 0) return;
    state.attackMs = w.intervalMs;
    if (state.weapon.id === "magic_staff") { fireProjectiles(w); if (state.perks.overheatBolt) fireOverheatBolt(w); return; }
    if (state.weapon.id === "throw_axe") return fireAxe(w);
    if (state.weapon.id === "crescent_blade") return useSlash(w);
    if (state.weapon.id === "storm_orb") return useLightning(w);
  };

  const oldUi = window.updateUi;
  window.updateUi = function patchedUpdateUi() {
    oldUi();
    if (state?.weapon && ui?.sideWeapon) ui.sideWeapon.innerHTML = `${state.weapon.name}<br />무기 Lv.${weaponLv()} / 10`;
  };

  patchWeaponsTable();
})();