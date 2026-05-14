const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const ui = {
  time: document.getElementById("uiTime"),
  hp: document.getElementById("uiHp"),
  level: document.getElementById("uiLevel"),
  exp: document.getElementById("uiExp"),
  augCount: document.getElementById("uiAugmentCount"),
  kills: document.getElementById("uiKills"),
  runCoins: document.getElementById("uiRunCoins"),
  sideWeapon: document.getElementById("sideWeapon"),
  sideStats: document.getElementById("sideStats"),
  sideAttributes: document.getElementById("sideAttributes"),
  sideSynergies: document.getElementById("sideSynergies"),
  sideAugments: document.getElementById("sideAugments"),
  sideStacks: document.getElementById("sideStacks"),
  toast: document.getElementById("toast"),
  titleCoins: document.getElementById("titleCoins")
};

const titleOverlay = document.getElementById("titleOverlay");
const labOverlay = document.getElementById("labOverlay");
const codexOverlay = document.getElementById("codexOverlay");
const weaponOverlay = document.getElementById("weaponOverlay");
const choiceOverlay = document.getElementById("choiceOverlay");
const pauseOverlay = document.getElementById("pauseOverlay");
const resultOverlay = document.getElementById("resultOverlay");

const labCoins = document.getElementById("labCoins");
const labList = document.getElementById("labList");
const codexList = document.getElementById("codexList");
const weaponCards = document.getElementById("weaponCards");
const choiceCards = document.getElementById("choiceCards");
const choiceTitle = document.getElementById("choiceTitle");
const choiceDesc = document.getElementById("choiceDesc");
const rerollBtn = document.getElementById("rerollBtn");
const pauseInfo = document.getElementById("pauseInfo");
const pauseDetails = document.getElementById("pauseDetails");
const resultTitle = document.getElementById("resultTitle");
const resultDesc = document.getElementById("resultDesc");
const pauseBtn = document.getElementById("pauseBtn");
const mobileStick = document.getElementById("mobileStick");
const mobileStickKnob = document.getElementById("mobileStickKnob");
const bigAlert = document.getElementById("bigAlert");
const bigAlertMain = document.getElementById("bigAlertMain");
const bigAlertSub = document.getElementById("bigAlertSub");

function renderWeapons() {
  weaponCards.innerHTML = "";
  WEAPONS.forEach(w => {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <h3>${w.name}</h3>
      <div class="desc">${w.desc}</div>
      <div class="badge-row">${w.tags.map(t => `<span class="badge">${t}</span>`).join("")}</div>
    `;
    div.onclick = () => {
      state = makeState(w);
      rebuildStats();
      weaponOverlay.classList.remove("show");
      startCombat();
    };
    weaponCards.appendChild(div);
  });
}

function renderChoiceCards() {
  choiceCards.innerHTML = "";
  rerollBtn.textContent = rerollsLeft > 0 ? `새로고침 ${rerollsLeft}회` : "새로고침 없음";
  rerollBtn.disabled = currentChoiceMode !== "augment" || rerollsLeft <= 0;

  currentChoices.forEach(item => {
    const div = document.createElement("div");
    div.className = "card";
    if (currentChoiceMode === "augment") {
      div.innerHTML = `
        <div class="type-label">신규 증강</div>
        <h3 class="${GRADE_CLASS[item.grade]}">${item.name} ${renderAttrInline(item.attrs)}</h3>
        <div class="desc">${item.desc}</div>
        <div class="badge-row">${renderAttrBadges(item.attrs)}</div>
      `;
    } else {
      div.innerHTML = `
        <div class="type-label">${item.label}</div>
        <h3>${item.name}</h3>
        <div class="desc">${item.desc}</div>
      `;
    }
    div.onclick = () => selectCurrentChoice(item);
    choiceCards.appendChild(div);
  });
}

function renderLab() {
  labCoins.textContent = Math.floor(meta.coins);
  labList.innerHTML = "";
  for (const item of LABS[labTab]) {
    const [id, name, max, , , effect] = item;
    const level = meta.upgrades[id] || 0;
    const cost = getLabCost(item);
    const maxed = level >= max;
    const canBuy = !maxed && meta.coins >= cost;
    const div = document.createElement("div");
    div.className = "lab-item";
    div.innerHTML = `
      <h3>${name}</h3>
      <div class="level">Lv.${level} / ${max}</div>
      <div class="effect">현재: ${effect(level)}<br>${maxed ? "최대 레벨입니다." : `다음: ${effect(level + 1)}`}</div>
      <div class="cost">${maxed ? "MAX" : `비용: ${cost} 코인`}</div>
      <button ${canBuy ? "" : "disabled"} onclick="buyLab('${id}')">${maxed ? "완료" : "구매"}</button>
    `;
    labList.appendChild(div);
  }
}

function renderCodex() {
  codexList.innerHTML = "";
  if (codexTab === "augments") {
    for (const a of AUGMENTS) {
      const div = document.createElement("div");
      div.className = "codex-item";
      div.innerHTML = `<h3 class="${GRADE_CLASS[a.grade]}">[${GRADE_LABEL[a.grade]}] ${a.name} ${renderAttrInline(a.attrs)}</h3><div class="effect">${a.detail || a.desc}</div>`;
      codexList.appendChild(div);
    }
    return;
  }
  if (codexTab === "synergies") {
    for (const info of Object.values(SYNERGY_INFO)) {
      const div = document.createElement("div");
      div.className = "codex-item";
      div.innerHTML = `<h3>${info.name}</h3><div class="effect">조건: ${info.cond}\n\n효과:\n${info.detail}</div>`;
      codexList.appendChild(div);
    }
    return;
  }
  const items = [
    ["[초급] 체력회복(소)", "최대 HP의 15% 회복"],
    ["[초급] 자석", "화면 내 경험치 구슬을 끌어옵니다."],
    ["[초급] 코인(소)", "코인 +30"],
    ["[일반] 체력회복(대)", "최대 HP의 40% 회복"],
    ["[일반] 전체 몹 킬", "일반 몬스터 즉시 처치\n정예 몬스터는 최대 HP 25% 피해"],
    ["[일반] 코인(대)", "코인 +120"],
    ["[고급] 공격력 증가", "15초간 공격력 +40%"],
    ["[고급] 이속 증가", "15초간 이동속도 +35%"],
    ["[고급] 공속 증가", "15초간 공격속도 +35%"],
    ["[고급] 공격범위 증가", "15초간 공격 범위 +40%"],
    ["[에픽] 속성 보석", "특정 일반 속성 +1: 70%\n특정 일반 속성 +2: 30%"],
    ["[전설] 속성 보석", "특정 일반 속성 +3: 40%\n모든 일반 속성 +1: 20%\n특정 일반 속성 +4: 20%\n鬼 +2: 20%"],
    ["드랍 확률", "일반 몬스터 아이템 드랍률: 1.5%\n정예 몬스터 아이템 드랍률: 18%\n\n일반 몬스터 등급 확률:\n초급 70% / 일반 24% / 고급 5% / 에픽 0.9% / 전설 0.1%\n\n정예 몬스터 등급 확률:\n초급 35% / 일반 35% / 고급 22% / 에픽 7% / 전설 1%\n\n보석 2개 이상 획득 시 이후 보석 확률 크게 감소"]
  ];
  for (const [name, effect] of items) {
    const div = document.createElement("div");
    div.className = "codex-item";
    div.innerHTML = `<h3>${name}</h3><div class="effect">${effect}</div>`;
    codexList.appendChild(div);
  }
}

function updateUi() {
  ui.titleCoins.textContent = Math.floor(meta.coins);
  if (!state) {
    ui.time.textContent = "00:00";
    ui.hp.textContent = "100/100";
    ui.level.textContent = "1";
    ui.exp.textContent = "0/100";
    ui.augCount.textContent = "0/6";
    ui.kills.textContent = "0";
    ui.runCoins.textContent = "0";
    renderSide();
    return;
  }
  ui.time.textContent = formatTime(state.timeMs);
  ui.hp.textContent = `${Math.max(0, Math.ceil(state.player.hp))}/${Math.ceil(state.player.maxHp)}${state.player.shield > 0 ? ` +${Math.ceil(state.player.shield)}` : ""}`;
  ui.level.textContent = state.level >= MAX_LEVEL ? "MAX" : state.level;
  ui.exp.textContent = state.level >= MAX_LEVEL ? `${Math.floor(state.overExp)}/${OVER_EXP_REWARD}` : `${Math.floor(state.exp)}/${EXP_TO_NEXT[state.level]}`;
  ui.augCount.textContent = `${state.augments.length}/${MAX_AUGMENTS}`;
  ui.kills.textContent = state.kills;
  ui.runCoins.textContent = state.runCoins;
  renderSide();
}

const SYNERGY_REQUIREMENTS = [
  { key: "ice2", req: { "氷": 2 } },
  { key: "ice4", req: { "氷": 4 } },
  { key: "ice6", req: { "氷": 6 } },

  { key: "fire2", req: { "火": 2 } },
  { key: "fire4", req: { "火": 4 } },
  { key: "fire6", req: { "火": 6 } },

  { key: "wind2", req: { "風": 2 } },
  { key: "wind4", req: { "風": 4 } },
  { key: "wind6", req: { "風": 6 } },

  { key: "light2", req: { "光": 2 } },
  { key: "light4", req: { "光": 4 } },
  { key: "light6", req: { "光": 6 } },

  { key: "dark2", req: { "暗": 2 } },
  { key: "dark4", req: { "暗": 4 } },
  { key: "dark6", req: { "暗": 6 } },

  { key: "holy2", req: { "聖": 2 } },
  { key: "holy4", req: { "聖": 4 } },
  { key: "holy6", req: { "聖": 6 } },

  { key: "evil2", req: { "惡": 2 } },
  { key: "evil4", req: { "惡": 4 } },
  { key: "evil6", req: { "惡": 6 } },

  { key: "demon2", req: { "鬼": 2 } },
  { key: "demon3", req: { "鬼": 3 } },
  { key: "demon4", req: { "鬼": 4 } },

  { key: "frostfire", req: { "氷": 2, "火": 2 } },
  { key: "firestorm", req: { "火": 4, "風": 2 } },
  { key: "radiantwind", req: { "風": 4, "光": 2 } },
  { key: "voidfeast", req: { "暗": 4, "惡": 2 } },
  { key: "fallenholy", req: { "聖": 4, "惡": 2 } },
  { key: "bloodflamedemon", req: { "火": 1, "暗": 1, "鬼": 1 } },
  { key: "holydemon", req: { "聖": 2, "鬼": 2 } },
  { key: "evildemon", req: { "惡": 2, "鬼": 2 } }
];

function getSynergyProgress(req, attrs) {
  let missingTotal = 0;
  const missing = [];

  for (const [attr, need] of Object.entries(req)) {
    const have = attrs[attr] || 0;
    const lack = Math.max(0, need - have);

    if (lack > 0) {
      missingTotal += lack;
      missing.push(`${attr} ${lack}`);
    }
  }

  return {
    missingTotal,
    missingText: missing.join(", ")
  };
}

function getPotentialSynergies() {
  if (!state) return [];

  const attrs = getAttrCounts();

  return SYNERGY_REQUIREMENTS
    .filter(item => !state.activeSynergies.has(item.key))
    .map(item => {
      const info = SYNERGY_INFO[item.key];
      const progress = getSynergyProgress(item.req, attrs);

      return {
        key: item.key,
        name: info?.name || item.key,
        short: info?.short || "",
        cond: info?.cond || "",
        missingTotal: progress.missingTotal,
        missingText: progress.missingText
      };
    })
    .filter(item => item.missingTotal > 0 && item.missingTotal <= 2)
    .sort((a, b) => {
      if (a.missingTotal !== b.missingTotal) return a.missingTotal - b.missingTotal;
      return a.name.localeCompare(b.name, "ko");
    })
    .slice(0, 6);
}

function renderPotentialSynergies() {
  const list = getPotentialSynergies();

  if (!list.length) {
    return `<div class="small">근접한 시너지 없음</div>`;
  }

  return list.map(item => `
    <div class="list-item">
      <strong>${item.name}</strong><br>
      <span class="small">
        조건: ${item.cond}<br>
        부족: ${item.missingText}<br>
        ${item.short}
      </span>
    </div>
  `).join("");
}

function renderAttributeLine() {
  if (!state) return `<span class="attr-empty">없음</span>`;

  const attrs = getAttrCounts();
  const activeAttrs = ALL_ATTRS.filter(a => (attrs[a] || 0) > 0);

  if (!activeAttrs.length) {
    return `<span class="attr-empty">없음</span>`;
  }

  return `
    <div class="attr-line">
      ${activeAttrs.map(a => `
        <span class="attr-chip">
          ${a} <strong>${attrs[a]}</strong>
        </span>
      `).join("")}
    </div>
  `;
}

function renderSide() {
  if (!state) {
    ui.sideWeapon.innerHTML = "메인 화면";
    ui.sideStats.innerHTML = `<div class="small">없음</div>`;
    ui.sideAttributes.innerHTML = `<div class="small">없음</div>`;
    ui.sideSynergies.innerHTML = `<div class="small">없음</div>`;
    ui.sideAugments.innerHTML = `<div class="small">없음</div>`;
    ui.sideStacks.innerHTML = `<div class="small">없음</div>`;
    return;
  }
  const w = getWeaponStats();
  ui.sideWeapon.innerHTML = `<strong>${state.weapon.name}</strong><br><span class="small">${weaponDetailText(w)}</span>`;
  ui.sideStats.innerHTML = `
    <div class="list-item">공격력 배율 <strong>x${statDamageMul().toFixed(2)}</strong></div>
    <div class="list-item">공격속도 <strong>x${statAttackSpeedMul().toFixed(2)}</strong></div>
    <div class="list-item">공격범위 <strong>x${statAreaMul().toFixed(2)}</strong></div>
    <div class="list-item">이동속도 <strong>x${(state.player.speed / 220).toFixed(2)}</strong></div>
    <div class="list-item">방어율 <strong>${Math.round(state.base.defense * 100)}%</strong></div>
    <div class="list-item">자석범위 <strong>${Math.round(state.player.magnetRange)}</strong></div>`;
  const attrs = getAttrCounts();
ui.sideSynergies.innerHTML = `
  <div class="small" style="margin-bottom:6px;">활성</div>
  ${
    active.length
      ? active.map(key => {
        const info = SYNERGY_INFO[key] || { name: key, short: "" };
        return `<div class="list-item"><strong>${info.name}</strong><br><span class="small">${info.short}</span></div>`;
      }).join("")
      : `<div class="small">아직 발현 없음</div>`
  }

  <div class="small" style="margin:10px 0 6px;">연계 가능</div>
  ${renderPotentialSynergies()}
`;
  ui.sideAugments.innerHTML = state.augments.length ? state.augments.map(a => `<div class="list-item"><strong class="${GRADE_CLASS[a.grade]}">${a.name} ${renderAttrInline(a.attrs)}</strong><br><span class="small">${a.desc}</span></div>`).join("") : `<div class="small">없음</div>`;
  ui.sideStacks.innerHTML = `
    <div class="list-item">집중 중첩 <strong>${state.stacks.focus}</strong> / 80</div>
    <div class="list-item">鬼 중첩 <strong>${state.stacks.demon}</strong> / ${state.synergy.demonMax || 0}</div>
    <div class="list-item">보석 획득 <strong>${state.itemStats.gems}</strong>개</div>
    <div class="list-item">버프 <strong>${state.buffs.length}</strong>개 활성</div>`;
}

function weaponDetailText(w) {
  if (!state) return "";
  if (state.weapon.id === "magic_staff") return `피해 ${Math.round(w.damage)} / 간격 ${(w.intervalMs / 1000).toFixed(2)}초 / 발사체 ${w.count} / 관통 ${w.pierce} / 크기 ${w.radius.toFixed(1)}`;
  if (state.weapon.id === "flame_heart") return `피해 ${Math.round(w.damage)} / 주기 ${(w.tickMs / 1000).toFixed(2)}초 / 범위 ${Math.round(w.radius)} / 파동 ${w.pulse ? "활성" : "비활성"}`;
  return `피해 ${Math.round(w.damage)} / 도끼 ${w.count} / 회전속도 x${w.orbitSpeed.toFixed(2)} / 크기 ${Math.round(w.axeRadius)} / 궤도 ${Math.round(w.orbitRadius)}`;
}

function renderPauseDetails() {
  if (!state) return "";
  const attrs = getAttrCounts();
  const w = getWeaponStats();
  ui.sideAttributes.innerHTML = renderAttributeLine();
const potentialSynergyHtml = getPotentialSynergies().length
  ? getPotentialSynergies().map(item => `
    <div class="detail-card">
      <strong>${item.name}</strong><br>
      조건: ${item.cond}<br>
      부족: ${item.missingText}<br>
      ${item.short}
    </div>
  `).join("")
  : `<div class="detail-card">근접한 시너지 없음</div>`;
  const augmentHtml = state.augments.length ? state.augments.map(a => `<div class="detail-card"><strong class="${GRADE_CLASS[a.grade]}">${a.name} ${renderAttrInline(a.attrs)}</strong><br>${a.desc}</div>`).join("") : `<div class="detail-card">없음</div>`;
  return `
    <h3>현재 스탯</h3><div class="detail-grid">
      <div class="detail-card">공격력 배율 <strong>x${statDamageMul().toFixed(2)}</strong></div>
      <div class="detail-card">공격속도 <strong>x${statAttackSpeedMul().toFixed(2)}</strong></div>
      <div class="detail-card">공격범위 <strong>x${statAreaMul().toFixed(2)}</strong></div>
      <div class="detail-card">이동속도 <strong>x${(state.player.speed / 220).toFixed(2)}</strong></div>
      <div class="detail-card">방어율 <strong>${Math.round(state.base.defense * 100)}%</strong></div>
      <div class="detail-card">자석범위 <strong>${Math.round(state.player.magnetRange)}</strong></div>
    </div>
    <h3>무기 상세</h3><div class="detail-grid"><div class="detail-card">${weaponDetailText(w)}</div></div>
    <h3>현재 속성</h3>${attrHtml}
    <h3>연계 가능 시너지</h3>
<div class="detail-grid">
  ${potentialSynergyHtml}
</div>
    <h3>보유 증강</h3><div class="detail-grid">${augmentHtml}</div>
    <h3>중첩 / 버프</h3><div class="detail-grid">
      <div class="detail-card">집중 중첩 <strong>${state.stacks.focus}</strong> / 80</div>
      <div class="detail-card">鬼 중첩 <strong>${state.stacks.demon}</strong> / ${state.synergy.demonMax || 0}</div>
      <div class="detail-card">보석 획득 <strong>${state.itemStats.gems}</strong>개</div>
      <div class="detail-card">버프 <strong>${state.buffs.length}</strong>개 활성</div>
    </div>`;
}

function renderAttrBadges(attrs) {
  return Object.entries(attrs || {}).map(([k, v]) => `<span class="badge">${k} +${v}</span>`).join("");
}
function renderAttrInline(attrs) {
  let out = "";
  for (const [k, v] of Object.entries(attrs || {})) out += " " + k.repeat(v);
  return out;
}
function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
function showToast(text) {
  ui.toast.textContent = text;
  ui.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => ui.toast.classList.remove("show"), 1500);
}

function backToTitleFromWeapon() {
  weaponOverlay.classList.remove("show");
  titleOverlay.classList.add("show");
  updateUi();
}

function showBigAlert(main, sub) {
  bigAlertMain.textContent = main;
  bigAlertSub.textContent = sub || "";
  bigAlert.classList.add("show");
  clearTimeout(showBigAlert.timer);
  showBigAlert.timer = setTimeout(() => bigAlert.classList.remove("show"), 1400);
}
