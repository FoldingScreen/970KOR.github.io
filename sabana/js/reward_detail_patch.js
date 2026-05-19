// SABANA reward/detail patch v1
// 보스 상자 획득 목록 + 아이템 클릭 설명 + 호버 툴팁 정리 + 증강 실제 수치 보강.
// Firebase, save.js, 로그인 로직은 수정하지 않는다.
(function () {
  if (window.__sabanaRewardDetailPatchV1) return;
  window.__sabanaRewardDetailPatchV1 = true;

  const ITEM_DETAILS = {
    heal_small: { title: "체력회복(소)", detail: "즉시 최대 HP의 15%를 회복합니다." },
    heal_big: { title: "체력회복(대)", detail: "즉시 최대 HP의 40%를 회복합니다." },
    magnet: { title: "자석", detail: "화면에 남아 있는 경험치 구슬을 강제로 끌어옵니다." },
    coin_small: { title: "코인(소)", detail: "전투 코인 30을 획득합니다. 전투 코인은 해당 판 안에서 사용하는 재화입니다." },
    coin_big: { title: "코인(대)", detail: "전투 코인 120을 획득합니다. 전투 코인은 해당 판 안에서 사용하는 재화입니다." },
    nuke: { title: "전체 몹 킬", detail: "일반 몬스터를 즉시 처치합니다. 정예 몬스터에게는 최대 HP의 25% 피해를 줍니다." },
    buff_damage: { title: "공격력 증가", detail: "15초 동안 공격력 배율이 x1.40 적용됩니다." },
    buff_speed: { title: "이동속도 증가", detail: "15초 동안 이동속도 배율이 x1.35 적용됩니다." },
    buff_as: { title: "공격속도 증가", detail: "15초 동안 공격속도 배율이 x1.35 적용됩니다." },
    buff_area: { title: "공격범위 증가", detail: "15초 동안 공격범위 배율이 x1.40 적용됩니다." },
    gem: { title: "속성 보석", detail: "표시된 속성을 즉시 올립니다. 보석으로 오른 속성도 시너지 계산에 포함됩니다." },
    all_gem: { title: "모든 속성 보석", detail: "鬼를 제외한 모든 일반 속성을 +1 올립니다." },
  };

  const AUGMENT_NUMERIC = {
    cold_edge: ["3초마다 얼음 파편 1개", "피해: 현재 무기 피해의 80%", "氷 4 이상 +1발, 氷 6 이상 +2발", "둔화 확률 +8%"],
    small_flame: ["4.5초마다 유성 낙하", "피해: 현재 무기 피해의 140%", "기본 범위 70", "화상 확률 +8%"],
    light_breeze: ["3.5초마다 4방향 바람 칼날", "피해: 현재 무기 피해의 55%", "風 4 이상 6방향, 風 6 이상 8방향", "공격속도 x1.08"],
    shimmer: ["5.5초마다 주변 빛 폭발", "피해: 현재 무기 피해의 120%", "기본 범위 110", "공격범위 x1.08"],
    shadow_cut: ["3.8초마다 체력 비율이 가장 낮은 적에게 유도탄", "피해: 현재 무기 피해의 130%", "체력 35% 이하 적 대상 추가 피해", "처형 계열 피해 +18%"],
    holy_seed: ["5초마다 가장 체력이 높은 적 위치에 낙하", "피해: 현재 무기 피해의 220%", "처치 시 보호막 계열 효과와 연계", "처치 보호막 확률 +6%"],
    evil_drop: ["4초마다 흡혈 박쥐 2마리", "피해: 현재 무기 피해의 70%", "적중 피해의 8% 회복", "惡 4 이상 박쥐 +1", "처치 회복 확률 +6%"],
    frostfire_core: ["빙결 파편 활성", "유성 불씨 활성", "둔화+화상 동시 대상 추가 피해 +35%"],
    burning_wind: ["칼날 난무 활성", "유성 불씨 활성", "화상 전이 확률 +12%"],
    radiant_wind: ["칼날 난무 활성", "신성 폭발 활성", "공격속도 증가분 일부를 공격범위로 전환: +18% 계수"],
    eclipse_mark: ["신성 폭발 활성", "그림자 추적자 활성", "범위 피해가 체력 낮은 적에게 추가 피해 +18%"],
    fallen_sanctuary: ["성검 낙하 활성", "흡혈 박쥐 활성", "보호막 획득 시 회복 보조", "회복 발생 시 보호막 보조"],
    perfect_focus: ["타격마다 집중 중첩 +1", "중첩당 공격력 x1.005", "최대 80중첩", "피격 시 중첩 초기화"],
    glass_sanctuary: ["신성 폭발 활성", "보호막 보유 중 피해 x1.60", "보호막이 없으면 받는 피해 +20%"],
    chain_reaction: ["투사체 적중 시 22% 확률로 연쇄 탄환", "연쇄 탄환 피해: 현재 투사체 피해의 45%", "칼날 난무 활성"],
    star_tuning: ["투사체 적중 시 22% 확률로 별빛 폭발", "별빛 폭발: 투사체 피해의 35% 광역 피해", "6초마다 별무리 폭격", "칼날 난무 연쇄탄에도 발동 가능"],
    curse_crown: ["빙결 파편, 유성 불씨, 칼날 난무, 신성 폭발 활성", "최대 HP -30", "회복량 -50%", "전설 보정 후 속성 1개만 적용"],
    overheat_heart: ["공격속도 x1.55", "유성 불씨 활성", "기본 공격 때 추가 화염탄", "추가 화염탄 피해: 현재 무기 피해의 35%", "전설 보정 후 속성 1개만 적용"],
    blood_furnace: ["초당 현재 HP의 0.5% 소모", "직접 피해의 1% 회복", "화상 피해의 2.5% 회복", "HP 30% 이하일 때 흡혈량 1.5배", "전설 보정 후 속성 1개만 적용"],
    void_feast: ["그림자 추적자 활성", "흡혈 박쥐 활성", "처형 성공 시 회복 연계", "전설 보정 후 속성 1개만 적용"],
    demon_gate: ["鬼 계열 증강", "6초마다 전방위 귀참", "처치 시 鬼 중첩 추가 +1", "피격 시 현재 HP 8% 추가 피해", "전설 보정 후 속성 1개만 적용"],
    demon_mark: ["鬼 계열 증강", "6초마다 귀참", "처치 시 鬼 중첩 기반 공격력 강화", "피격 시 중첩 감소", "전설 보정 후 속성 1개만 적용"],
    blood_flame_demon: ["유성 불씨 활성", "그림자 추적자 활성", "귀참 활성", "화상 중인 적 처치 시 鬼 중첩 추가"],
    holy_demon_scar: ["성검 낙하 활성", "귀참 활성", "보호막 보유 중 鬼 중첩 증가량 상승", "보호막 보유 중 피격 시 鬼 중첩 감소량 완화"],
    evil_demon_feast: ["흡혈 박쥐 활성", "귀참 활성", "회복 발생 시 鬼 중첩 +1", "초과 회복 시 鬼 중첩 추가 +1", "전설 보정 후 속성 1개만 적용"],
    mythic_frostfire_eternal: ["속성: 氷 +1, 火 +1", "둔화+화상 대상 추가 피해 +55%", "둔화 확률 +8%", "화상 확률 +8%"],
    mythic_firestorm_core: ["속성: 火 +1, 風 +1", "화상 전이 확률 +20%", "공격속도 x1.12"],
    mythic_radiant_gale: ["속성: 風 +1, 光 +1", "공격속도 증가분 일부를 공격범위로 전환: +30% 계수", "공격속도 x1.08", "공격범위 x1.12"],
    mythic_luminous_sanctuary: ["속성: 光 +1, 聖 +1", "보호막 보유 중 피해 x1.60 계열 활성", "공격범위 x1.12", "처치 보호막 확률 +8%"],
    mythic_fallen_sanctuary: ["속성: 聖 +1, 惡 +1", "회복/보호막 순환 활성", "처치 회복 확률 +8%", "처치 보호막 확률 +8%"],
    mythic_void_feast: ["속성: 暗 +1, 惡 +1", "체력 낮은 적 추가 피해 +25%", "처치 회복 확률 +6%"],
    mythic_shadow_demon_execution: ["속성: 暗 +1, 鬼 +1", "鬼 중첩 빌드 활성", "체력 낮은 적 추가 피해 +22%"],
    mythic_evil_demon_feast: ["속성: 惡 +1, 鬼 +1", "회복 시 鬼 중첩 연계", "처치 회복 확률 +8%"],
    mythic_blood_furnace: ["속성: 火 +1, 惡 +1", "피의 화로 계열 활성", "화상 확률 +8%"],
    mythic_frozen_sanctuary: ["속성: 氷 +1, 聖 +1", "둔화 확률 +8%", "처치 보호막 확률 +8%"],
    mythic_eclipse: ["속성: 光 +1, 暗 +1", "범위 처형 계수 +18%", "체력 낮은 적 추가 피해 +18%", "공격범위 x1.08"],
    mythic_shadow_dash: ["속성: 風 +1, 暗 +1", "집중 중첩 빌드 활성", "공격속도 x1.08", "체력 낮은 적 추가 피해 +16%"],
  };

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function ensureRewardOverlay() {
    let overlay = document.getElementById("bossRewardListOverlay");
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.id = "bossRewardListOverlay";
    overlay.className = "overlay";
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-head">
          <button class="mini-btn secondary" id="bossRewardCloseBtn">← 닫기</button>
          <div>
            <h2>보스 상자 보상</h2>
            <p>보상 항목을 클릭하면 설명을 볼 수 있습니다.</p>
          </div>
        </div>
        <div id="bossRewardList" class="codex-list"></div>
        <div id="bossRewardDetail" class="codex-item" style="margin-top:12px;"></div>
      </div>
    `;
    document.querySelector(".canvas-wrap")?.appendChild(overlay);
    overlay.querySelector("#bossRewardCloseBtn").addEventListener("click", () => overlay.classList.remove("show"));
    return overlay;
  }

  function itemTitle(item) {
    if (!item) return "알 수 없는 보상";
    return item.name || ITEM_DETAILS[item.kind]?.title || item.kind || "알 수 없는 보상";
  }

  function itemDetail(item) {
    if (!item) return "";
    const base = ITEM_DETAILS[item.kind]?.detail || "즉시 적용되는 보상입니다.";
    const lines = [base];
    if (item.grade) lines.push(`등급: ${item.grade}`);
    if (item.kind === "gem") lines.push(`속성 증가: ${item.attr} +${item.value}`);
    if (item.kind === "all_gem") lines.push(`속성 증가: 일반 속성 전체 +${item.value || 1}`);
    return lines.join("\n");
  }

  function showBossRewardList(rewards) {
    const overlay = ensureRewardOverlay();
    const list = overlay.querySelector("#bossRewardList");
    const detail = overlay.querySelector("#bossRewardDetail");
    list.innerHTML = "";
    detail.innerHTML = `<h3>보상 설명</h3><div class="effect">항목을 클릭하세요.</div>`;

    rewards.forEach((reward, index) => {
      const div = document.createElement("div");
      div.className = "codex-item";
      div.innerHTML = `
        <h3>${esc(reward.title)}</h3>
        <div class="effect">${esc(reward.short).replaceAll("\n", "<br>")}</div>
      `;
      div.addEventListener("click", () => {
        detail.innerHTML = `
          <h3>${esc(reward.title)}</h3>
          <div class="effect">${esc(reward.detail).replaceAll("\n", "<br>")}</div>
        `;
      });
      list.appendChild(div);
      if (index === 0) div.click();
    });

    overlay.classList.add("show");
  }

  const oldApplyDrop = window.applyDrop;
  if (typeof oldApplyDrop === "function") {
    window.applyDrop = function patchedRewardApplyDrop(item) {
      if (item?.bossReward) {
        const clean = { ...item, bossReward: false };
        oldApplyDrop(clean);
        const rewards = [
          {
            title: itemTitle(clean),
            short: itemDetail(clean).split("\n")[0],
            detail: itemDetail(clean),
          },
        ];
        showBossRewardList(rewards);
        return;
      }
      return oldApplyDrop(item);
    };
  }

  function numericDetailHtml(id) {
    const lines = AUGMENT_NUMERIC[id] || [];
    if (!lines.length) return "";
    return `
      <br><br>
      <strong>실제 적용 수치</strong><br>
      ${lines.map(line => `- ${esc(line)}`).join("<br>")}
    `;
  }

  window.getAugmentDetailHtml = function patchedAugmentDetailHtml(id) {
    const aug = state?.augments?.find(a => a.id === id) || AUGMENTS.find(a => a.id === id);
    if (!aug) {
      return `<h3>증강 정보 없음</h3><div class="effect">해당 증강 정보를 찾지 못했습니다.</div>`;
    }

    return `
      <h3 class="${GRADE_CLASS[aug.grade] || ""}">${esc(aug.name)} ${renderAttrInline(aug.attrs)}</h3>
      <div class="effect">
        ${esc(aug.detail || aug.desc).replaceAll("\n", "<br>")}
        ${numericDetailHtml(aug.id)}
      </div>
    `;
  };

  // 기존 호버 툴팁이 칩 밖으로 나가도 남는 경우 방지.
  function forceCloseHover() {
    const tooltip = document.getElementById("buildHoverTooltip");
    if (tooltip) {
      tooltip.classList.remove("show");
      tooltip.innerHTML = "";
    }
  }

  document.addEventListener("pointermove", e => {
    if (!e.target.closest?.(".detail-hover-chip")) forceCloseHover();
  }, true);
  document.addEventListener("pointerleave", forceCloseHover, true);
  document.addEventListener("scroll", forceCloseHover, true);
  document.addEventListener("click", e => {
    if (!e.target.closest?.(".detail-hover-chip")) forceCloseHover();
  }, true);

  window.closeBuildHoverTooltip = forceCloseHover;
})();