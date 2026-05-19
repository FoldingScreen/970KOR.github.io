// SABANA balance patch: final-combination synergy + mythic augments
// Loaded after game.js so it can override/extend runtime tables safely.
(function () {
  if (window.__sabanaBalancePatchV1) return;
  window.__sabanaBalancePatchV1 = true;

  const ATTR_ORDER = ["氷", "火", "風", "光", "暗", "聖", "惡", "鬼"];

  const ATTR_ROLE = {
    氷: "둔화·빙결·탄속 억제",
    火: "화상·폭발·지속 피해",
    風: "공격속도·기동·추가타",
    光: "공격범위·보호막·빔 대응",
    暗: "약점·처형·보스 페이즈 피해",
    聖: "보호막·회복 보조·피해 완화",
    惡: "흡혈·저체력 강화·회복 연계",
    鬼: "중첩·광폭·피격 리스크",
  };

  function attrName(a) {
    return (typeof ATTR_NAMES !== "undefined" && ATTR_NAMES[a]) || a;
  }

  function comboKey(attrs) {
    return `final_${attrs.join("")}`;
  }

  function comboType(attrs) {
    const counts = {};
    attrs.forEach(a => counts[a] = (counts[a] || 0) + 1);
    const values = Object.values(counts).sort((a, b) => b - a);
    if (attrs.length === 2) return "AB";
    if (values[0] === 3) return "AAA";
    if (values[0] === 2) return "AAB";
    return "ABC";
  }

  function comboName(attrs) {
    const type = comboType(attrs);
    const counts = {};
    attrs.forEach(a => counts[a] = (counts[a] || 0) + 1);

    if (type === "AB") {
      return `${attrName(attrs[0])}·${attrName(attrs[1])} 융합`;
    }

    if (type === "AAA") {
      return `${attrName(attrs[0])} 완성`;
    }

    if (type === "AAB") {
      const main = Object.entries(counts).find(([, v]) => v === 2)[0];
      const sub = Object.entries(counts).find(([, v]) => v === 1)[0];
      return `${attrName(main)} 중심 ${attrName(sub)} 융합`;
    }

    return `${attrs.map(attrName).join("·")} 삼원융합`;
  }

  function comboDetail(attrs) {
    const type = comboType(attrs);
    const roles = attrs
      .filter((a, i) => attrs.indexOf(a) === i)
      .map(a => `${a} ${attrName(a)}: ${ATTR_ROLE[a]}`)
      .join("\n");

    if (type === "AAA") {
      return `조건: ${attrs.join(" ")}\n순혈 완성형 시너지입니다. 기존 2단계/3단계 하위 효과를 하나로 압축한 상위호환 효과입니다.\n\n${roles}`;
    }

    if (type === "AAB") {
      return `조건: ${attrs.join(" ")}\n주속성 2개와 보조속성 1개가 결합한 중심 융합 시너지입니다. 주속성 단일 효과와 복합 효과를 합친 것보다 강한 상위호환으로 적용됩니다.\n\n${roles}`;
    }

    if (type === "ABC") {
      return `조건: ${attrs.join(" ")}\n세 속성의 하위 복합 효과를 각각 켜지 않고, 핵심만 압축해 하나의 삼원융합으로 적용합니다. 범용성과 복합 성능이 높은 상위호환 시너지입니다.\n\n${roles}`;
    }

    return `조건: ${attrs.join(" ")}\n두 속성이 결합한 기초 융합 시너지입니다. 신화 증강 1개만으로도 발동할 수 있습니다.\n\n${roles}`;
  }

  function registerFinalSynergyInfos() {
    if (typeof SYNERGY_INFO === "undefined") return;

    // 2속성 신화 단독 조합도 표시
    for (let i = 0; i < ATTR_ORDER.length; i++) {
      for (let j = i + 1; j < ATTR_ORDER.length; j++) {
        const attrs = [ATTR_ORDER[i], ATTR_ORDER[j]];
        const key = comboKey(attrs);
        SYNERGY_INFO[key] = {
          name: comboName(attrs),
          cond: attrs.join(" + "),
          short: "두 속성의 핵심 효과를 하나로 압축합니다.",
          detail: comboDetail(attrs),
        };
      }
    }

    // AAA
    for (const a of ATTR_ORDER) {
      const attrs = [a, a, a];
      const key = comboKey(attrs);
      SYNERGY_INFO[key] = {
        name: comboName(attrs),
        cond: attrs.join(" + "),
        short: "한 속성에 완전히 몰빵한 순혈 완성형 시너지입니다.",
        detail: comboDetail(attrs),
      };
    }

    // AAB - 모든 순서의 주속성/보조속성 케이스
    for (const main of ATTR_ORDER) {
      for (const sub of ATTR_ORDER) {
        if (main === sub) continue;
        const attrs = [main, main, sub];
        const key = comboKey(attrs);
        SYNERGY_INFO[key] = {
          name: comboName(attrs),
          cond: attrs.join(" + "),
          short: `${attrName(main)} 효과를 중심으로 ${attrName(sub)} 효과가 결합됩니다.`,
          detail: comboDetail(attrs),
        };
      }
    }

    // ABC
    for (let i = 0; i < ATTR_ORDER.length; i++) {
      for (let j = i + 1; j < ATTR_ORDER.length; j++) {
        for (let k = j + 1; k < ATTR_ORDER.length; k++) {
          const attrs = [ATTR_ORDER[i], ATTR_ORDER[j], ATTR_ORDER[k]];
          const key = comboKey(attrs);
          SYNERGY_INFO[key] = {
            name: comboName(attrs),
            cond: attrs.join(" + "),
            short: "세 속성 하위 조합의 핵심을 하나로 압축한 삼원융합입니다.",
            detail: comboDetail(attrs),
          };
        }
      }
    }
  }

  function normalizeLegacyAugments() {
    if (typeof GRADE_LABEL !== "undefined") {
      GRADE_LABEL.basic = "일반";
      GRADE_LABEL.normal = "희귀";
      GRADE_LABEL.advanced = "고급";
      GRADE_LABEL.mythic = "신화";
    }

    if (typeof GRADE_CLASS !== "undefined") {
      GRADE_CLASS.mythic = "grade-legendary";
    }

    if (typeof AUGMENTS === "undefined") return;

    const fixes = {
      curse_crown: { grade: "legendary", attrs: { 暗: 1 } },
      overheat_heart: { grade: "legendary", attrs: { 火: 1 } },
      blood_furnace: { grade: "legendary", attrs: { 惡: 1 } },
      void_feast: { grade: "legendary", attrs: { 暗: 1 } },
      demon_gate: { grade: "legendary", attrs: { 鬼: 1 } },
      demon_mark: { grade: "legendary", attrs: { 鬼: 1 } },
      evil_demon_feast: { grade: "legendary", attrs: { 惡: 1 } },
    };

    for (const aug of AUGMENTS) {
      if (fixes[aug.id]) {
        aug.grade = fixes[aug.id].grade;
        aug.attrs = fixes[aug.id].attrs;
        aug.desc = `${aug.desc || ""} 전설 증강은 속성 1개만 제공합니다.`.trim();
      }
    }
  }

  const MYTHIC_AUGMENTS = [
    {
      id: "mythic_frostfire_eternal",
      name: "영겁의 서리불꽃",
      grade: "mythic",
      attrs: { 氷: 1, 火: 1 },
      desc: "둔화와 화상을 하나의 상태이상 엔진으로 묶습니다.",
      detail: "속성: 氷 +1, 火 +1\n둔화된 적에게 화상 피해 증가\n화상 중 둔화 발생 시 즉시 추가 피해\n보스에게는 탄속 감소와 화상 누적 폭발 적용",
      apply(s) { s.perks.frostfireBonus += 0.55; s.perks.slowChance += 0.08; s.perks.burnChance += 0.08; },
    },
    {
      id: "mythic_firestorm_core",
      name: "폭풍화염심",
      grade: "mythic",
      attrs: { 火: 1, 風: 1 },
      desc: "빠르게 때릴수록 화염이 번집니다.",
      detail: "속성: 火 +1, 風 +1\n공격속도가 높을수록 화상 발동률 증가\n연속 타격 시 화상 전이와 작은 폭발 발생\n피격 후 잠시 전이 효과 약화",
      apply(s) { s.perks.burnSpreadChance += 0.2; s.perks.attackSpeedMul *= 1.12; },
    },
    {
      id: "mythic_radiant_gale",
      name: "광휘질풍",
      grade: "mythic",
      attrs: { 風: 1, 光: 1 },
      desc: "회피와 기동이 공격범위로 이어집니다.",
      detail: "속성: 風 +1, 光 +1\n공격속도 증가분 일부가 공격범위로 전환\n이동 중 공격범위와 공격속도 증가\n피격 시 누적 효과 초기화",
      apply(s) { s.perks.speedToArea += 0.3; s.perks.attackSpeedMul *= 1.08; s.perks.areaMul *= 1.12; },
    },
    {
      id: "mythic_luminous_sanctuary",
      name: "찬란한 성역",
      grade: "mythic",
      attrs: { 光: 1, 聖: 1 },
      desc: "보호막을 유지할수록 공격과 방어가 함께 강해집니다.",
      detail: "속성: 光 +1, 聖 +1\n보호막 보유 중 피해와 공격범위 증가\n보스전 시작과 페이즈 전환 시 보호막 획득\n보호막이 깨질 때 주변 탄환 일부 제거",
      apply(s) { s.perks.glassSanctuary = true; s.perks.areaMul *= 1.12; s.perks.killShieldChance += 0.08; },
    },
    {
      id: "mythic_fallen_sanctuary",
      name: "타락성역",
      grade: "mythic",
      attrs: { 聖: 1, 惡: 1 },
      desc: "회복과 보호막이 서로 순환합니다.",
      detail: "속성: 聖 +1, 惡 +1\n회복 발생 시 보호막 획득\n보호막 획득 시 짧게 공격력 증가\n최대 HP 소폭 감소",
      apply(s) { s.perks.sanctuaryLoop = true; s.perks.killHealChance += 0.08; s.perks.killShieldChance += 0.08; },
    },
    {
      id: "mythic_void_feast",
      name: "심연포식",
      grade: "mythic",
      attrs: { 暗: 1, 惡: 1 },
      desc: "약해진 적을 찢고 그 피해로 버팁니다.",
      detail: "속성: 暗 +1, 惡 +1\n체력 낮은 적에게 피해 증가\n체력 낮은 적에게 준 피해 일부 회복\n보스전 회복 효율 제한",
      apply(s) { s.perks.voidFeast = true; s.perks.executeDamage += 0.25; s.perks.killHealChance += 0.06; },
    },
    {
      id: "mythic_shadow_demon_execution",
      name: "귀영처형",
      grade: "mythic",
      attrs: { 暗: 1, 鬼: 1 },
      ghost: true,
      desc: "처형으로 귀기를 쌓는 고위험 빌드입니다.",
      detail: "속성: 暗 +1, 鬼 +1\n체력 낮은 적 피해 증가\n처치 시 鬼 중첩 획득\n피격 시 중첩 대량 손실",
      apply(s) { s.perks.demonMark = true; s.perks.executeDamage += 0.22; },
    },
    {
      id: "mythic_evil_demon_feast",
      name: "악귀포식",
      grade: "mythic",
      attrs: { 惡: 1, 鬼: 1 },
      ghost: true,
      desc: "회복이 귀기 중첩으로 전환됩니다.",
      detail: "속성: 惡 +1, 鬼 +1\n회복 발생 시 鬼 중첩 획득\nHP가 낮을수록 회복 효율 증가\n피격 시 현재 HP 추가 피해",
      apply(s) { s.perks.evilDemonFeast = true; s.perks.killHealChance += 0.08; },
    },
    {
      id: "mythic_blood_furnace",
      name: "피의 화로",
      grade: "mythic",
      attrs: { 火: 1, 惡: 1 },
      desc: "스스로를 태우면서 화상 흡혈로 버팁니다.",
      detail: "속성: 火 +1, 惡 +1\n화상 피해 일부 회복\n체력이 낮을수록 화상 피해 증가\n초당 현재 HP 감소",
      apply(s) { s.perks.bloodFurnace = true; s.perks.burnChance += 0.08; },
    },
    {
      id: "mythic_frozen_sanctuary",
      name: "빙결성역",
      grade: "mythic",
      attrs: { 氷: 1, 聖: 1 },
      desc: "보호막과 둔화로 탄막을 버팁니다.",
      detail: "속성: 氷 +1, 聖 +1\n피격 시 주변 적 둔화\n보호막 보유 중 둔화된 적에게 받는 피해 감소\n이동속도 소폭 감소",
      apply(s) { s.perks.slowChance += 0.08; s.perks.killShieldChance += 0.08; },
    },
    {
      id: "mythic_eclipse",
      name: "일식",
      grade: "mythic",
      attrs: { 光: 1, 暗: 1 },
      desc: "보스전 극딜에 특화된 빛과 어둠의 융합입니다.",
      detail: "속성: 光 +1, 暗 +1\n보스에게 주는 피해 증가\n보스 페이즈 전환 직후 피해 증가\n일반몹에게 받는 피해 소폭 증가",
      apply(s) { s.perks.areaExecute += 0.18; s.perks.executeDamage += 0.18; s.perks.areaMul *= 1.08; },
    },
    {
      id: "mythic_shadow_dash",
      name: "그림자 질주",
      grade: "mythic",
      attrs: { 風: 1, 暗: 1 },
      desc: "맞지 않고 움직일수록 처형력이 강해집니다.",
      detail: "속성: 風 +1, 暗 +1\n피격되지 않은 시간이 길수록 이동속도와 처형 피해 증가\n피격 시 누적 효과 초기화",
      apply(s) { s.perks.focusBlade = true; s.perks.attackSpeedMul *= 1.08; s.perks.executeDamage += 0.16; },
    },
  ];

  function addMythicAugments() {
    if (typeof AUGMENTS === "undefined") return;
    for (const aug of MYTHIC_AUGMENTS) {
      if (!AUGMENTS.some(a => a.id === aug.id)) AUGMENTS.push(aug);
    }
  }

  function getNextAugmentIndex() {
    return (state?.augments?.length || 0) + 1;
  }

  function getMythicChance() {
    const idx = getNextAugmentIndex();
    const high = meta?.upgrades?.high_grade || 0;
    const bonus = Math.min(0.0035, high * 0.0004);

    if (idx <= 1) return Math.min(0.0005, 0.0001 + bonus * 0.25); // 0.01% base, 0.05% cap
    if (idx === 2) return Math.min(0.0015, 0.0005 + bonus * 0.5); // 0.05% base, 0.15% cap
    return Math.min(0.005, 0.0015 + bonus); // 0.15% base, 0.5% cap
  }

  window.pickByGrade = function pickByGrade(pool) {
    const high = meta?.upgrades?.high_grade || 0;
    const idx = getNextAugmentIndex();
    let table;

    if (idx <= 1) {
      table = { basic: 55, normal: 30, advanced: 10, epic: 5 + high * 0.5, legendary: 0 };
    } else if (idx === 2) {
      table = { basic: 40, normal: 30, advanced: 15, epic: 13 + high * 0.8, legendary: 2 + high * 0.25 };
    } else {
      table = { basic: 30, normal: 28, advanced: 17, epic: 20 + high, legendary: 5 + high * 0.4 };
    }

    let candidates = [];
    let guard = 0;

    while (!candidates.length && guard < 30) {
      guard++;
      const grade = weightedPick(Object.entries(table).map(([grade, weight]) => ({ grade, weight }))).grade;
      candidates = pool.filter(a => a.grade === grade);
    }

    if (!candidates.length) candidates = pool;

    const focus = meta?.upgrades?.attr_focus || 0;
    if (focus > 0 && state?.augments?.length > 0) {
      const current = getAttrCounts();
      return weightedPick(candidates.map(a => ({
        item: a,
        weight: 1 + Object.keys(a.attrs || {}).reduce((sum, k) => sum + ((current[k] || 0) > 0 ? focus * 0.05 : 0), 0),
      }))).item;
    }

    return randomItem(candidates);
  };

  window.getGhostChance = function getGhostChance() {
    const attrs = getAttrCounts();
    return (state.level >= 30 ? 0.08 : state.level >= 20 ? 0.05 : 0.03) + ((attrs["鬼"] || 0) > 0 ? 0.02 : 0);
  };

  window.rollAugmentChoices = function rollAugmentChoices() {
    const selectedIds = new Set((state?.augments || []).map(a => a.id));
    const normalPool = AUGMENTS.filter(a => !a.ghost && a.grade !== "mythic" && !selectedIds.has(a.id));
    const ghostPool = AUGMENTS.filter(a => a.ghost && a.grade !== "mythic" && !selectedIds.has(a.id));
    const mythicPool = AUGMENTS.filter(a => a.grade === "mythic" && !selectedIds.has(a.id));
    const choices = [];

    while (choices.length < 3) {
      const pool = normalPool.filter(a => !choices.some(c => c.id === a.id));
      if (!pool.length) break;
      choices.push(pickByGrade(pool));
    }

    if (choices.length && mythicPool.length && Math.random() < getMythicChance()) {
      choices[Math.floor(Math.random() * choices.length)] = randomItem(mythicPool);
      return choices;
    }

    if (choices.length && ghostPool.length && Math.random() < getGhostChance()) {
      choices[Math.floor(Math.random() * choices.length)] = randomItem(ghostPool);
    }

    return choices;
  };

  function selectFinalAttrs(counts) {
    const expanded = [];
    for (const a of ATTR_ORDER) {
      for (let i = 0; i < (counts[a] || 0); i++) expanded.push(a);
    }

    if (expanded.length <= 3) return expanded;

    return [...ATTR_ORDER]
      .sort((a, b) => {
        const diff = (counts[b] || 0) - (counts[a] || 0);
        if (diff) return diff;
        return ATTR_ORDER.indexOf(a) - ATTR_ORDER.indexOf(b);
      })
      .flatMap(a => Array(Math.min(counts[a] || 0, 3)).fill(a))
      .slice(0, 3);
  }

  function applyAttrEffect(s, attr, power) {
    const amp = state?.base?.synergyAmp || 1;
    const p = power * amp;

    if (attr === "氷") {
      s.slowChance += 0.16 * p;
      s.slowPower += 0.18 * p;
      s.areaDamageMul *= 1 + 0.04 * p;
    }

    if (attr === "火") {
      s.burnChance += 0.16 * p;
      s.burnDpsRatio += 0.14 * p;
      s.burnDuration += 0.55 * p;
      s.areaDamageMul *= 1 + 0.05 * p;
    }

    if (attr === "風") {
      s.attackSpeedMul *= 1 + 0.12 * p;
      s.moveMul *= 1 + 0.04 * p;
      if (p >= 1.15) s.extraHitEvery = Math.min(s.extraHitEvery || 999, p >= 1.7 ? 4 : 6);
    }

    if (attr === "光") {
      s.areaMul *= 1 + 0.13 * p;
      s.areaDamageMul *= 1 + 0.06 * p;
      s.beamResist = (s.beamResist || 0) + 0.05 * p;
    }

    if (attr === "暗") {
      s.executeThreshold = Math.max(s.executeThreshold, Math.min(0.45, 0.16 + 0.08 * p));
      s.executeChance += 0.045 * p;
      s.areaExecute = (s.areaExecute || 0) + 0.08 * p;
    }

    if (attr === "聖") {
      s.shieldOnKillChance += 0.08 * p;
      s.shieldOnKill += 4 * p;
      s.phaseShield = (s.phaseShield || 0) + 8 * p;
    }

    if (attr === "惡") {
      s.healOnKillChance += 0.075 * p;
      s.healOnKill += 3 * p;
      s.lowHpDamage = (s.lowHpDamage || 0) + 0.07 * p;
    }

    if (attr === "鬼") {
      s.demonKillStack = Math.max(s.demonKillStack, 0.0035 * p);
      s.demonMax = Math.max(s.demonMax, Math.round(55 * p));
      s.demonLoss = Math.min(s.demonLoss, Math.max(0.12, 0.65 - 0.16 * p));
    }
  }

  function applyComboBonus(s, attrs) {
    const unique = [...new Set(attrs)];
    const has = a => unique.includes(a);
    const type = comboType(attrs);
    const strength = type === "AAA" ? 1.35 : type === "AAB" ? 1.22 : type === "ABC" ? 1.15 : 0.85;

    if (has("氷") && has("火")) s.frostfireBonus = (s.frostfireBonus || 0) + 0.22 * strength;
    if (has("火") && has("風")) s.burnSpreadChance = (s.burnSpreadChance || 0) + 0.08 * strength;
    if (has("風") && has("光")) s.speedToArea = (s.speedToArea || 0) + 0.12 * strength;
    if (has("光") && has("聖")) s.phaseShield = (s.phaseShield || 0) + 10 * strength;
    if (has("聖") && has("惡")) s.sanctuaryLoopPower = (s.sanctuaryLoopPower || 0) + 0.12 * strength;
    if (has("暗") && has("惡")) s.voidHeal = (s.voidHeal || 0) + 0.08 * strength;
    if (has("暗") && has("鬼")) s.demonExecute = (s.demonExecute || 0) + 0.12 * strength;
    if (has("惡") && has("鬼")) s.demonHealGain = (s.demonHealGain || 0) + 1;
    if (has("火") && has("惡")) s.bloodFlame = (s.bloodFlame || 0) + 0.1 * strength;
    if (has("氷") && has("聖")) s.coldSanctuary = (s.coldSanctuary || 0) + 0.1 * strength;
    if (has("光") && has("暗")) s.bossDamageMul = (s.bossDamageMul || 1) * (1 + 0.1 * strength);
    if (has("風") && has("暗")) s.flowExecute = (s.flowExecute || 0) + 0.1 * strength;
  }

  window.recalcSynergies = function recalcSynergies() {
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

    const selected = selectFinalAttrs(a);
    const newActive = new Set();

    if (selected.length >= 2) {
      const key = comboKey(selected);
      const type = comboType(selected);
      newActive.add(key);

      if (!state.announcedSynergies.has(key)) {
        state.announcedSynergies.add(key);
        onSynergyFirstActivated(key);
      }

      const counts = {};
      selected.forEach(x => counts[x] = (counts[x] || 0) + 1);

      if (type === "AAA") {
        applyAttrEffect(s, selected[0], 2.7);
      } else if (type === "AAB") {
        const main = Object.entries(counts).find(([, v]) => v === 2)[0];
        const sub = Object.entries(counts).find(([, v]) => v === 1)[0];
        applyAttrEffect(s, main, 1.95);
        applyAttrEffect(s, sub, 1.05);
      } else if (type === "ABC") {
        selected.forEach(attr => applyAttrEffect(s, attr, 1.25));
      } else {
        selected.forEach(attr => applyAttrEffect(s, attr, 0.95));
      }

      applyComboBonus(s, selected);
      s.finalCombo = { key, attrs: selected, type };
    }

    state.activeSynergies = newActive;
    state.synergy = s;
  };

  window.getActiveDemonSynergySource = function getActiveDemonSynergySource() {
    if (!state || !state.synergy?.demonKillStack) return null;
    const key = Array.from(state.activeSynergies || []).find(k => k.startsWith("final_") && k.includes("鬼"));
    if (!key) return null;
    return {
      id: `synergy_${key}`,
      name: SYNERGY_INFO[key]?.name || "鬼 융합 시너지",
    };
  };

  registerFinalSynergyInfos();
  normalizeLegacyAugments();
  addMythicAugments();
})();