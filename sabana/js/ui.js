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
const buildDetailOverlay = document.getElementById("buildDetailOverlay");
const buildDetailContent = document.getElementById("buildDetailContent");

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

  // 보유 증강에서 얻은 속성만 기준으로 "내 빌드와 겹치는지" 판단
  const augmentAttrs = {};
  for (const aug of state.augments || []) {
    for (const [attr, value] of Object.entries(aug.attrs || {})) {
      augmentAttrs[attr] = (augmentAttrs[attr] || 0) + value;
    }
  }

  function hasOwnedAugmentOverlap(req) {
    return Object.keys(req).some(attr => (augmentAttrs[attr] || 0) > 0);
  }

  return SYNERGY_REQUIREMENTS
    .filter(item => !state.activeSynergies.has(item.key))
    .filter(item => hasOwnedAugmentOverlap(item.req))
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
  const active = Array.from(state.activeSynergies);

  ui.sideWeapon.innerHTML = `
    <strong>${state.weapon.name}</strong><br>
    <span class="small">${weaponDetailText(w)}</span>
  `;

  ui.sideStats.innerHTML = `
    <div class="list-item">공격력 배율 <strong>x${statDamageMul().toFixed(2)}</strong></div>
    <div class="list-item">공격속도 <strong>x${statAttackSpeedMul().toFixed(2)}</strong></div>
    <div class="list-item">공격범위 <strong>x${statAreaMul().toFixed(2)}</strong></div>
    <div class="list-item">이동속도 <strong>x${(state.player.speed / 220).toFixed(2)}</strong></div>
    <div class="list-item">방어율 <strong>${Math.round(state.base.defense * 100)}%</strong></div>
    <div class="list-item">자석범위 <strong>${Math.round(state.player.magnetRange)}</strong></div>
  `;

  ui.sideAttributes.innerHTML = renderAttributeLine();

ui.sideSynergies.innerHTML = `
  <div class="small" style="margin-bottom:6px;">활성</div>
  ${
    active.length
      ? `
        <div class="compact-name-list">
          ${active.map(key => {
            const info = SYNERGY_INFO[key] || { name: key };
            return `
              <span
                class="compact-name detail-hover-chip"
                data-detail-kind="synergy"
                data-detail-key="${key}"
              >${info.name}</span>
            `;
          }).join("")}
        </div>
      `
      : `<div class="small">아직 발현 없음</div>`
  }

  <div class="small" style="margin:10px 0 6px;">연계 가능</div>
  ${renderPotentialSynergiesCompact()}

  <button type="button" class="mini-btn secondary detail-btn build-detail-trigger" onclick="openBuildDetail()">상세설명</button>
`;

ui.sideAugments.innerHTML = state.augments.length
  ? `
    <div class="compact-name-list">
      ${state.augments.map(a => `
        <span
          class="compact-name ${GRADE_CLASS[a.grade]} detail-hover-chip"
          data-detail-kind="augment"
          data-detail-key="${a.id}"
        >${a.name}</span>
      `).join("")}
    </div>
    <button type="button" class="mini-btn secondary detail-btn build-detail-trigger" onclick="openBuildDetail()">상세설명</button>
  `
  : `<div class="small">없음</div>`;

  ui.sideStacks.innerHTML = `
    <div class="list-item">집중 중첩 <strong>${state.stacks.focus}</strong> / 80</div>
    <div class="list-item">鬼 중첩 <strong>${state.stacks.demon}</strong> / ${state.synergy.demonMax || 0}</div>
    <div class="list-item">보석 획득 <strong>${state.itemStats.gems}</strong>개</div>
    <div class="list-item">버프 <strong>${state.buffs.length}</strong>개 활성</div>
  `;
}

function renderPotentialSynergiesCompact() {
  const list = getPotentialSynergies();

  if (!list.length) {
    return `<div class="small">근접한 시너지 없음</div>`;
  }

  return `
    <div class="compact-name-list">
      ${list.map(item => `
        <span class="compact-name">${item.name}</span>
      `).join("")}
    </div>
  `;
}

function weaponDetailText(w) {
  if (!state) return "";
  if (state.weapon.id === "magic_staff") return `피해 ${Math.round(w.damage)} / 간격 ${(w.intervalMs / 1000).toFixed(2)}초 / 발사체 ${w.count} / 관통 ${w.pierce} / 크기 ${w.radius.toFixed(1)}`;
  if (state.weapon.id === "flame_heart") return `피해 ${Math.round(w.damage)} / 주기 ${(w.tickMs / 1000).toFixed(2)}초 / 범위 ${Math.round(w.radius)} / 파동 ${w.pulse ? "활성" : "비활성"}`;
  return `피해 ${Math.round(w.damage)} / 도끼 ${w.count} / 회전속도 x${w.orbitSpeed.toFixed(2)} / 크기 ${Math.round(w.axeRadius)} / 궤도 ${Math.round(w.orbitRadius)}`;
}

function renderPauseDetails() {
  if (!state) return "";

  const w = getWeaponStats();
  const attrHtml = renderAttributeLine();

  const activeSynergyHtml = Array.from(state.activeSynergies).length
    ? Array.from(state.activeSynergies).map(key => {
        const info = SYNERGY_INFO[key] || { name: key, short: "" };
        return `
          <div class="detail-card">
            <strong>${info.name}</strong><br>
            ${info.short}
          </div>
        `;
      }).join("")
    : `<div class="detail-card">아직 발현 없음</div>`;

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

  const augmentHtml = state.augments.length
    ? state.augments.map(a => `
      <div class="detail-card">
        <strong class="${GRADE_CLASS[a.grade]}">${a.name} ${renderAttrInline(a.attrs)}</strong><br>
        ${a.desc}
      </div>
    `).join("")
    : `<div class="detail-card">없음</div>`;

  return `
    <h3>현재 스탯</h3>
    <div class="detail-grid">
      <div class="detail-card">공격력 배율 <strong>x${statDamageMul().toFixed(2)}</strong></div>
      <div class="detail-card">공격속도 <strong>x${statAttackSpeedMul().toFixed(2)}</strong></div>
      <div class="detail-card">공격범위 <strong>x${statAreaMul().toFixed(2)}</strong></div>
      <div class="detail-card">이동속도 <strong>x${(state.player.speed / 220).toFixed(2)}</strong></div>
      <div class="detail-card">방어율 <strong>${Math.round(state.base.defense * 100)}%</strong></div>
      <div class="detail-card">자석범위 <strong>${Math.round(state.player.magnetRange)}</strong></div>
    </div>

    <h3>무기 상세</h3>
    <div class="detail-grid">
      <div class="detail-card">${weaponDetailText(w)}</div>
    </div>

    <h3>현재 속성</h3>
    ${attrHtml}

    <h3>활성 시너지</h3>
    <div class="detail-grid">
      ${activeSynergyHtml}
    </div>

    <h3>연계 가능 시너지</h3>
    <div class="detail-grid">
      ${potentialSynergyHtml}
    </div>

    <h3>보유 증강</h3>
    <div class="detail-grid">
      ${augmentHtml}
    </div>

    <h3>중첩 / 버프</h3>
    <div class="detail-grid">
      <div class="detail-card">집중 중첩 <strong>${state.stacks.focus}</strong> / 80</div>
      <div class="detail-card">鬼 중첩 <strong>${state.stacks.demon}</strong> / ${state.synergy.demonMax || 0}</div>
      <div class="detail-card">보석 획득 <strong>${state.itemStats.gems}</strong>개</div>
      <div class="detail-card">버프 <strong>${state.buffs.length}</strong>개 활성</div>
    </div>
  `;
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
  const safeMs = Math.max(0, Number.isFinite(ms) ? ms : 0);
  const s = Math.floor(safeMs / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;

  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatPct(value, digits = 0) {
  return `${(value * 100).toFixed(digits)}%`;
}

function getCurrentWeaponBaseDamage() {
  if (!state || !state.weapon) return 0;
  const w = getWeaponStats();
  return w.damage || 0;
}

function getAugmentLiveDetail(id) {
  if (!state) return "";

  const baseDamage = getCurrentWeaponBaseDamage();
  const attrs = getAttrCounts();

  const lines = [];

  if (id === "cold_edge" || id === "frostfire_core" || id === "curse_crown") {
    const count = attrs["氷"] >= 6 ? 3 : attrs["氷"] >= 4 ? 2 : 1;
    lines.push(`빙결 파편 현재 발사 수: ${count}개`);
    lines.push(`빙결 파편 현재 피해: ${Math.round(baseDamage * 0.8).toLocaleString()}`);
    lines.push(`발동 주기: 3.0초`);
    lines.push(`둔화 부여: 적중 시 2.2초`);
  }

  if (id === "small_flame" || id === "frostfire_core" || id === "burning_wind" || id === "curse_crown" || id === "overheat_heart") {
    const radius = attrs["火"] >= 4 ? 95 : 70;
    const times = attrs["火"] >= 6 ? 2 : 1;
    lines.push(`유성 불씨 현재 낙하 수: ${times}회`);
    lines.push(`유성 불씨 현재 피해: ${Math.round(baseDamage * 1.4).toLocaleString()}`);
    lines.push(`범위: ${radius}`);
    lines.push(`발동 주기: 4.5초`);
  }

  if (id === "light_breeze" || id === "burning_wind" || id === "radiant_wind" || id === "perfect_focus" || id === "chain_reaction" || id === "curse_crown") {
    const count = attrs["風"] >= 6 ? 8 : attrs["風"] >= 4 ? 6 : 4;
    const interval = Math.max(0.7, 3.5 / Math.max(0.1, statAttackSpeedMul()));
    lines.push(`칼날 난무 현재 발사 수: ${count}개`);
    lines.push(`칼날 난무 현재 피해: ${Math.round(baseDamage * 0.55).toLocaleString()}`);
    lines.push(`현재 발동 주기: ${interval.toFixed(2)}초`);
  }

  if (id === "shimmer" || id === "radiant_wind" || id === "eclipse_mark" || id === "glass_sanctuary" || id === "curse_crown") {
    const radius = 110 * statAreaMul();
    lines.push(`신성 폭발 현재 피해: ${Math.round(baseDamage * 1.2).toLocaleString()}`);
    lines.push(`현재 범위: ${Math.round(radius)}`);
    lines.push(`발동 주기: 5.5초`);
  }

  if (id === "shadow_cut" || id === "eclipse_mark" || id === "void_feast" || id === "blood_flame_demon") {
    lines.push(`그림자 추적자 현재 피해: ${Math.round(baseDamage * 1.3).toLocaleString()}`);
    lines.push(`발동 주기: 3.8초`);
    lines.push(`대상: 체력 비율이 가장 낮은 적`);
  }

  if (id === "holy_seed" || id === "fallen_sanctuary" || id === "holy_demon_scar") {
    lines.push(`성검 낙하 현재 피해: ${Math.round(baseDamage * 2.2).toLocaleString()}`);
    lines.push(`범위: 52`);
    lines.push(`발동 주기: 5.0초`);
    lines.push(`대상: 현재 체력이 가장 높은 적`);
  }

  if (id === "evil_drop" || id === "fallen_sanctuary" || id === "void_feast" || id === "evil_demon_feast") {
    const count = attrs["惡"] >= 4 ? 3 : 2;
    lines.push(`흡혈 박쥐 현재 발사 수: ${count}개`);
    lines.push(`흡혈 박쥐 현재 피해: ${Math.round(baseDamage * 0.7).toLocaleString()}`);
    lines.push(`적중 시 회복: 피해량의 8%`);
    lines.push(`발동 주기: 4.0초`);
  }

  if (id === "star_tuning") {
    lines.push(`별빛 폭발 확률: 투사체 적중 시 22%`);
    lines.push(`별빛 폭발 현재 피해: ${Math.round(baseDamage * 0.35).toLocaleString()}`);
    lines.push(`별무리 폭격 현재 피해: ${Math.round(baseDamage * 0.75).toLocaleString()}`);
    lines.push(`별무리 폭격 대상 수: 최대 5명`);
    lines.push(`별무리 폭격 주기: 6.0초`);
  }

  if (id === "chain_reaction") {
    lines.push(`연쇄 탄환 생성 확률: 22%`);
    lines.push(`연쇄 탄환 현재 피해: ${Math.round(baseDamage * 0.45).toLocaleString()}`);
    lines.push(`연쇄 탄환은 재연쇄 불가`);
  }

  if (id === "perfect_focus") {
    const stack = state.stacks.focus || 0;
    const mul = Math.pow(1.005, stack);
    lines.push(`현재 집중 중첩: ${stack} / 80`);
    lines.push(`중첩당 공격력 증가: 0.5% 곱연산`);
    lines.push(`현재 집중 공격력 배율: x${mul.toFixed(3)}`);
    lines.push(`최대 중첩 시 공격력 배율: x${Math.pow(1.005, 80).toFixed(3)}`);
    lines.push(`피격 시 집중 중첩 초기화`);
  }

  if (id === "glass_sanctuary") {
    lines.push(`보호막 보유 중 피해 배율: x1.6`);
    lines.push(`보호막이 없을 때 받는 피해: +20%`);
    lines.push(`현재 보호막: ${Math.round(state.player.shield || 0)}`);
  }

  if (id === "overheat_heart") {
    lines.push(`공격속도 배율: x1.55`);
    lines.push(`화염 보조탄 현재 피해: ${Math.round(baseDamage * 0.35).toLocaleString()}`);
    lines.push(`화염 보조탄 발동: 기본 공격마다 1발`);
    lines.push(`HP 소모 없음`);
  }

  if (id === "blood_furnace") {
    lines.push(`초당 HP 소모: 현재 HP의 0.6%`);
    lines.push(`직접 피해 회복: 피해량의 3%`);
    lines.push(`화상 피해 회복: 피해량의 8%`);
    lines.push(`HP 30% 이하일 때 회복량 2배`);
  }

  if (id === "demon_gate" || id === "demon_mark" || id === "blood_flame_demon" || id === "holy_demon_scar" || id === "evil_demon_feast") {
    const bonus = 1 + (state.stacks.demon || 0) * 0.01;
    const radius = 130 + (state.stacks.demon || 0) * 0.4;
    lines.push(`귀참 현재 피해: ${Math.round(baseDamage * 2.5 * bonus).toLocaleString()}`);
    lines.push(`귀참 현재 범위: ${Math.round(radius)}`);
    lines.push(`귀참 발동 주기: 6.0초`);
    lines.push(`현재 鬼 중첩: ${state.stacks.demon || 0}`);
  }

  if (!lines.length) return "";

  return `
    <hr class="detail-divider">
    <div class="effect">
      <strong>현재 계산값</strong><br>
      ${lines.map(line => escapeHtml(line)).join("<br>")}
    </div>
  `;
}

function getSynergyLiveDetail(key) {
  if (!state) return "";

  const s = state.synergy || {};
  const lines = [];

  if (key === "ice2" || key === "ice4" || key === "ice6") {
    lines.push(`현재 둔화 확률: ${formatPct(s.slowChance || 0)}`);
    lines.push(`현재 둔화 강도: ${formatPct(s.slowPower || 0)}`);
    if (key === "ice4" || key === "ice6") {
      lines.push(`현재 광역 피해 배율: x${(s.areaDamageMul || 1).toFixed(2)}`);
    }
    if (key === "ice6") {
      lines.push(`발현 순간: 화면 내 적 2초 빙결`);
    }
  }

  if (key === "fire2" || key === "fire4" || key === "fire6") {
    lines.push(`현재 화상 확률: ${formatPct(s.burnChance || 0)}`);
    lines.push(`현재 화상 DPS: 적중 피해의 ${formatPct(s.burnDpsRatio || 0)}/초`);
    lines.push(`현재 화상 지속시간: ${(s.burnDuration || 0).toFixed(1)}초`);
    if (key === "fire6") {
      lines.push(`화상 중인 적 처치 시 폭발: 적 최대 HP의 25%`);
      lines.push(`화상 전이 피해: 적 최대 HP의 4%`);
    }
  }

  if (key === "wind2" || key === "wind4" || key === "wind6") {
    lines.push(`현재 시너지 공격속도 배율: x${(s.attackSpeedMul || 1).toFixed(2)}`);
    lines.push(`현재 시너지 이동속도 배율: x${(s.moveMul || 1).toFixed(2)}`);
    if (s.extraHitEvery) {
      lines.push(`추가타: ${s.extraHitEvery}번째 타격마다 기본 피해의 50%`);
    }
    if (key === "wind6") {
      lines.push(`발현 순간: 10초간 공격속도 x2.0`);
    }
  }

  if (key === "light2" || key === "light4" || key === "light6") {
    lines.push(`현재 시너지 공격범위 배율: x${(s.areaMul || 1).toFixed(2)}`);
    lines.push(`현재 광역 피해 배율: x${(s.areaDamageMul || 1).toFixed(2)}`);
    if (key === "light6") {
      lines.push(`발현 순간: 화면 전체 180 피해`);
      lines.push(`광역 처치 연계: 광역 피해로 처치 시 25% 확률 빛 폭발`);
    }
  }

  if (key === "dark2" || key === "dark4" || key === "dark6") {
    lines.push(`현재 처형 기준: HP ${formatPct(s.executeThreshold || 0)} 이하`);
    lines.push(`현재 처형 확률: ${formatPct(s.executeChance || 0)}`);
    lines.push(`정예 처형 실패 시 추가 피해: 적 최대 HP의 8%`);
    if (key === "dark6") {
      lines.push(`발현 순간: HP 35% 이하 일반 적 즉시 처형`);
      lines.push(`그 외 적: 최대 HP의 12% 피해`);
    }
  }

  if (key === "holy2" || key === "holy4" || key === "holy6") {
    lines.push(`처치 시 보호막 획득 확률: ${formatPct(s.shieldOnKillChance || 0)}`);
    lines.push(`처치 시 보호막 획득량: ${s.shieldOnKill || 0}`);
    if (key === "holy6") {
      lines.push(`발현 순간: 최대 HP의 40% 보호막 획득`);
    }
  }

  if (key === "evil2" || key === "evil4" || key === "evil6") {
    lines.push(`처치 시 회복 확률: ${formatPct(s.healOnKillChance || 0)}`);
    lines.push(`처치 시 회복량: ${s.healOnKill || 0}`);
    if (key === "evil6") {
      lines.push(`발현 순간: HP 100% 회복`);
      lines.push(`발현 순간: 8초간 공격력 x1.5`);
      lines.push(`초과 회복 시 5초간 공격력 버프`);
    }
  }

  if (key === "demon2" || key === "demon3" || key === "demon4") {
    const perStack = s.demonKillStack || 0;
    const stack = state.stacks.demon || 0;
    const mul = 1 + stack * perStack;

    lines.push(`처치 시 鬼 중첩 증가량: 기본 +1`);
    lines.push(`중첩당 공격력 증가: ${formatPct(perStack, 1)}`);
    lines.push(`현재 鬼 중첩: ${stack} / ${s.demonMax || 0}`);
    lines.push(`현재 鬼 공격력 배율: x${mul.toFixed(3)}`);
    lines.push(`피격 시 중첩 감소율: ${formatPct(s.demonLoss || 0)}`);
    if (key === "demon4") {
      lines.push(`발현 순간: 鬼 중첩 +50`);
      lines.push(`발현 순간: 10초간 중첩 감소 면역`);
    }
  }

  if (key === "frostfire") {
    lines.push(`둔화 + 화상 상태 적 피해 배율: x${(1.65 + (state.perks.frostfireBonus || 0)).toFixed(2)}`);
    lines.push(`화상 중 둔화 발생 시 즉시 화상 피해 1회`);
  }

  if (key === "firestorm") {
    lines.push(`화상 중인 적 타격 시 화상 전이 확률: 16%`);
    lines.push(`전이 대상: 주변 최대 2명`);
    lines.push(`전이 피해: 기준 피해의 25%/초`);
  }

  if (key === "radiantwind") {
    lines.push(`공격속도 증가분 일부를 공격범위로 전환`);
    lines.push(`현재 공격속도 배율: x${statAttackSpeedMul().toFixed(2)}`);
    lines.push(`현재 공격범위 배율: x${statAreaMul().toFixed(2)}`);
  }

  if (key === "voidfeast") {
    lines.push(`처형/회복 연계형 시너지`);
    lines.push(`초과 회복 발생 시 공격력 버프와 연결`);
  }

  if (key === "fallenholy") {
    lines.push(`보호막 획득 시 회복 보조`);
    lines.push(`회복 발생 시 보호막 보조`);
  }

  if (key === "bloodflamedemon") {
    lines.push(`화상 중인 적 처치 시 鬼 중첩 추가 +2`);
    lines.push(`demonGate 보유 시 처치 鬼 중첩 추가 +1`);
  }

  if (key === "holydemon") {
    lines.push(`보호막 보유 중 鬼 중첩 증가량 +1`);
    lines.push(`보호막 보유 중 피격 시 鬼 중첩 감소량 50% 완화`);
  }

  if (key === "evildemon") {
    lines.push(`회복 발생 시 鬼 중첩 +1`);
    lines.push(`초과 회복 발생 시 鬼 중첩 추가 +1`);
  }

  if (!lines.length) return "";

  return `
    <hr class="detail-divider">
    <div class="effect">
      <strong>현재 계산값</strong><br>
      ${lines.map(line => escapeHtml(line)).join("<br>")}
    </div>
  `;
}

function getAugmentDetailHtml(id) {
  const aug =
    state?.augments?.find(a => a.id === id) ||
    AUGMENTS.find(a => a.id === id);

  if (!aug) {
    return `
      <h3>증강 정보 없음</h3>
      <div class="effect">해당 증강 정보를 찾지 못했습니다.</div>
    `;
  }

  return `
    <h3 class="${GRADE_CLASS[aug.grade] || ""}">
      ${escapeHtml(aug.name)} ${renderAttrInline(aug.attrs)}
    </h3>
    <div class="effect">${escapeHtml(aug.detail || aug.desc).replaceAll("\n", "<br>")}</div>
    ${getAugmentLiveDetail(id)}
  `;
}

function getSynergyDetailHtml(key) {
  const info = SYNERGY_INFO[key];

  if (!info) {
    return `
      <h3>시너지 정보 없음</h3>
      <div class="effect">${escapeHtml(key)}</div>
    `;
  }

  return `
    <h3>${escapeHtml(info.name)}</h3>
    <div class="effect">
      조건: ${escapeHtml(info.cond || "-")}<br><br>
      기본 설명:<br>${escapeHtml(info.detail || info.short || "").replaceAll("\n", "<br>")}
    </div>
    ${getSynergyLiveDetail(key)}
  `;
}

function getDetailChipHtml(kind, key) {
  if (kind === "augment") return getAugmentDetailHtml(key);
  if (kind === "synergy") return getSynergyDetailHtml(key);

  return `
    <h3>상세 정보 없음</h3>
    <div class="effect">알 수 없는 항목입니다.</div>
  `;
}

function ensureBuildHoverTooltip() {
  let tooltip = document.getElementById("buildHoverTooltip");

  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.id = "buildHoverTooltip";
    tooltip.className = "build-hover-tooltip";
    document.body.appendChild(tooltip);
  }

  return tooltip;
}

function canUseHoverTooltip() {
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

function moveBuildHoverTooltip(x, y) {
  const tooltip = ensureBuildHoverTooltip();

  const margin = 14;
  const rect = tooltip.getBoundingClientRect();

  let left = x + 16;
  let top = y + 16;

  if (left + rect.width + margin > window.innerWidth) {
    left = x - rect.width - 16;
  }

  if (top + rect.height + margin > window.innerHeight) {
    top = y - rect.height - 16;
  }

  tooltip.style.left = `${Math.max(margin, left)}px`;
  tooltip.style.top = `${Math.max(margin, top)}px`;
}

function openBuildHoverTooltip(target, x, y) {
  if (!canUseHoverTooltip()) return;

  const kind = target.dataset.detailKind;
  const key = target.dataset.detailKey;

  if (!kind || !key) return;

  const tooltip = ensureBuildHoverTooltip();
  tooltip.innerHTML = getDetailChipHtml(kind, key);
  tooltip.classList.add("show");

  moveBuildHoverTooltip(x, y);
}

function closeBuildHoverTooltip() {
  const tooltip = document.getElementById("buildHoverTooltip");
  if (tooltip) tooltip.classList.remove("show");
}

function openBuildDetail() {
  if (!state) {
    showToast("진행 중인 빌드가 없습니다.");
    return;
  }

  if (!buildDetailOverlay || !buildDetailContent) {
    console.error("buildDetailOverlay 또는 buildDetailContent DOM을 찾지 못했습니다.");
    showToast("상세설명 창을 찾지 못했습니다.");
    return;
  }

  closeBuildHoverTooltip();

  const augHtml = state.augments.length
    ? state.augments.map(a => `
      <div class="codex-item">
        ${getAugmentDetailHtml(a.id)}
      </div>
    `).join("")
    : `<div class="codex-item"><h3>보유 증강 없음</h3></div>`;

  const synergyHtml = Array.from(state.activeSynergies).length
    ? Array.from(state.activeSynergies).map(key => `
      <div class="codex-item">
        ${getSynergyDetailHtml(key)}
      </div>
    `).join("")
    : `<div class="codex-item"><h3>활성 시너지 없음</h3></div>`;

  buildDetailContent.innerHTML = `
    <div class="codex-item">
      <h3>최종 계산 스탯</h3>
      <div class="effect">공격력 배율: x${statDamageMul().toFixed(2)}<br>
공격속도: x${statAttackSpeedMul().toFixed(2)}<br>
공격범위: x${statAreaMul().toFixed(2)}<br>
이동속도: x${(state.player.speed / 220).toFixed(2)}<br>
방어율: ${Math.round(state.base.defense * 100)}%<br>
자석범위: ${Math.round(state.player.magnetRange)}</div>
    </div>

    <div class="codex-item">
      <h3>보유 증강</h3>
    </div>
    ${augHtml}

    <div class="codex-item">
      <h3>활성 시너지</h3>
    </div>
    ${synergyHtml}
  `;

  buildDetailOverlay.classList.add("show");

  const modal = buildDetailOverlay.querySelector(".modal");
  if (modal) modal.scrollTop = 0;
}

function closeBuildDetail() {
  if (buildDetailOverlay) buildDetailOverlay.classList.remove("show");
}

window.openBuildDetail = openBuildDetail;
window.closeBuildDetail = closeBuildDetail;

document.addEventListener("click", e => {
  const trigger = e.target.closest(".build-detail-trigger");
  if (!trigger) return;

  e.preventDefault();
  e.stopPropagation();
  openBuildDetail();
}, true);

document.addEventListener("pointerover", e => {
  const chip = e.target.closest(".detail-hover-chip");
  if (!chip) return;

  openBuildHoverTooltip(chip, e.clientX, e.clientY);
});

document.addEventListener("pointermove", e => {
  const chip = e.target.closest(".detail-hover-chip");
  if (!chip) return;
  if (!canUseHoverTooltip()) return;

  moveBuildHoverTooltip(e.clientX, e.clientY);
});

document.addEventListener("pointerout", e => {
  const chip = e.target.closest(".detail-hover-chip");
  if (!chip) return;

  closeBuildHoverTooltip();
});

function showBigAlert(main, sub) {
  bigAlertMain.textContent = main;
  bigAlertSub.textContent = sub || "";
  bigAlert.classList.add("show");
  clearTimeout(showBigAlert.timer);
  showBigAlert.timer = setTimeout(() => bigAlert.classList.remove("show"), 1400);
}
