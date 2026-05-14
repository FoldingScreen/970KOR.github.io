    const MAX_LEVEL = 30;
    const MAX_AUGMENTS = 6;
    const GAME_LIMIT_MS = 15 * 60 * 1000;
    const OVER_EXP_REWARD = 1000;
    const SPECIAL_LEVELS = new Set([5, 10, 15, 20, 25, 30]);
    const NORMAL_ATTRS = ["氷", "火", "風", "光", "暗", "聖", "惡"];
    const ALL_ATTRS = ["氷", "火", "風", "光", "暗", "聖", "惡", "鬼"];

    const ATTR_NAMES = {
      "氷": "빙",
      "火": "화",
      "風": "풍",
      "光": "광",
      "暗": "암",
      "聖": "성",
      "惡": "악",
      "鬼": "귀"
    };

    const GRADE_LABEL = {
      basic: "초급",
      normal: "일반",
      advanced: "고급",
      epic: "에픽",
      legendary: "전설"
    };

    const GRADE_CLASS = {
      basic: "grade-basic",
      normal: "grade-normal",
      advanced: "grade-advanced",
      epic: "grade-epic",
      legendary: "grade-legendary"
    };

    const EXP_TO_NEXT = [
      0,
      80, 150, 230, 320, 420,
      540, 670, 810, 960, 1120,
      1300, 1480, 1670, 1870, 2080,
      2300, 2530, 2770, 3020, 3280,
      3550, 3830, 4120, 4420, 4730,
      5050, 5380, 5720, 6100
    ];

    const SYNERGY_INFO = {
      ice2: { name: "氷 2 냉기 개방", cond: "氷 2", short: "공격 시 적을 둔화시킵니다.", detail: "공격 적중 시 25% 확률로 적을 2초 둔화\n둔화 강도: 30%" },
      ice4: { name: "氷 4 혹한 전파", cond: "氷 4", short: "둔화 확률이 증가하고 광역 피해가 강화됩니다.", detail: "둔화 확률 추가 +20%\n광역 피해 +10%" },
      ice6: { name: "氷 6 절대영도", cond: "氷 6", short: "발현 시 화면 내 적을 빙결시키고 피해가 증가합니다.", detail: "발현 순간: 화면 내 적 2초 빙결\n상시: 둔화 확률 추가 +25%, 광역 피해 추가 강화" },

      fire2: { name: "火 2 화염 개방", cond: "火 2", short: "공격 시 화상을 부여합니다.", detail: "공격 적중 시 25% 확률로 2.5초 화상\n화상 피해: 공격력의 20%/초" },
      fire4: { name: "火 4 대화염", cond: "火 4", short: "화상 피해와 지속시간이 증가합니다.", detail: "화상 피해 추가 +22%\n화상 지속시간 +1.5초" },
      fire6: { name: "火 6 화염군주", cond: "火 6", short: "화상 중인 적 처치 시 폭발과 전이가 발생합니다.", detail: "발현 순간: 화면 내 적에게 화상 부여\n상시: 화상 피해 추가 +32%, 화상 처치 폭발" },

      wind2: { name: "風 2 질풍", cond: "風 2", short: "공격속도와 이동속도가 증가합니다.", detail: "공격속도 +15%\n이동속도 +5%" },
      wind4: { name: "風 4 난무", cond: "風 4", short: "공격속도가 더 오르고 추가타가 발생합니다.", detail: "공격속도 추가 +18%\n이동속도 추가 +5%\n5번째 공격마다 추가타" },
      wind6: { name: "風 6 질풍난무", cond: "風 6", short: "발현 시 폭발적인 공속 버프, 이후 추가타가 더 자주 발생합니다.", detail: "발현 순간: 10초간 공격속도 x2\n상시: 공격속도 추가 +28%, 3번째 공격마다 추가타" },

      light2: { name: "光 2 광휘", cond: "光 2", short: "모든 공격 범위가 증가합니다.", detail: "공격 범위 +15%" },
      light4: { name: "光 4 찬란한 영역", cond: "光 4", short: "공격 범위와 광역 피해가 증가합니다.", detail: "공격 범위 추가 +15%\n광역 피해 +20%" },
      light6: { name: "光 6 태양광휘", cond: "光 6", short: "발현 시 화면 전체 피해, 범위 공격이 크게 강화됩니다.", detail: "발현 순간: 화면 전체 빛 폭발\n상시: 공격 범위 추가 +20%, 광역 피해 추가 +25%" },

      dark2: { name: "暗 2 처형 개방", cond: "暗 2", short: "체력 낮은 적을 일정 확률로 처형합니다.", detail: "체력 20% 이하 적 타격 시 8% 확률 처형" },
      dark4: { name: "暗 4 심연 처형", cond: "暗 4", short: "처형 기준과 확률이 증가합니다.", detail: "체력 30% 이하 적 타격 시 12% 확률 처형\n처형 성공 시 암흑 폭발" },
      dark6: { name: "暗 6 심연처형", cond: "暗 6", short: "발현 시 체력 낮은 적을 정리하고 처형력이 크게 증가합니다.", detail: "발현 순간: 체력 35% 이하 일반 적 즉시 처형\n상시: 체력 40% 이하 적 타격 시 18% 확률 처형" },

      holy2: { name: "聖 2 축복", cond: "聖 2", short: "처치 시 보호막을 얻을 수 있습니다.", detail: "처치 시 15% 확률로 보호막 +6" },
      holy4: { name: "聖 4 성역", cond: "聖 4", short: "보호막 획득 확률과 양이 증가합니다.", detail: "처치 시 25% 확률로 보호막 +10" },
      holy6: { name: "聖 6 성역강림", cond: "聖 6", short: "발현 시 보호막을 크게 얻고 처치 보호막이 강해집니다.", detail: "발현 순간: 최대 HP 40% 보호막 획득\n상시: 처치 시 40% 확률로 보호막 +14" },

      evil2: { name: "惡 2 흡혈", cond: "惡 2", short: "처치 시 체력을 회복할 수 있습니다.", detail: "처치 시 15% 확률로 HP 4 회복" },
      evil4: { name: "惡 4 피의 계약", cond: "惡 4", short: "처치 회복 확률과 회복량이 증가합니다.", detail: "처치 시 25% 확률로 HP 7 회복" },
      evil6: { name: "惡 6 피의 연회", cond: "惡 6", short: "발현 시 회복하고 초과 회복이 공격력으로 전환됩니다.", detail: "발현 순간: HP 100% 회복, 공격력 버프\n상시: 처치 시 40% 확률로 HP 10 회복" },

      demon2: { name: "鬼 2 귀기 개방", cond: "鬼 2", short: "처치 시 鬼 중첩을 얻습니다.", detail: "처치 시 공격력 +0.5% 중첩\n최대 80중첩\n피격 시 중첩 50% 감소" },
      demon3: { name: "鬼 3 귀문 개방", cond: "鬼 3", short: "鬼 중첩 성장과 한계가 증가합니다.", detail: "처치 시 공격력 +0.8% 중첩\n최대 130중첩\n피격 시 중첩 30% 감소" },
      demon4: { name: "鬼 4 귀왕 강림", cond: "鬼 4", short: "鬼 중첩이 폭발적으로 강화됩니다.", detail: "발현 순간: 鬼 중첩 +50, 10초간 중첩 감소 면역\n상시: 처치 시 공격력 +1.0% 중첩, 최대 200, 피격 시 15% 감소" },

      frostfire: { name: "서리불꽃", cond: "氷 2 + 火 2", short: "둔화된 적에게 화상 피해가 크게 증가합니다.", detail: "둔화 + 화상 상태 적에게 피해 대폭 증가\n화상 중 둔화 발생 시 즉시 화상 피해 1회 발동" },
      firestorm: { name: "화염폭풍", cond: "火 4 + 風 2", short: "화상이 주변 적에게 전이될 수 있습니다.", detail: "화상 중인 적 타격 시 주변 2명에게 화상 전이\n전이 내부 확률: 16%" },
      radiantwind: { name: "광휘질풍", cond: "風 4 + 光 2", short: "공격속도가 공격 범위를 밀어올립니다.", detail: "공격속도 증가분 일부가 공격 범위 증가로 전환" },
      voidfeast: { name: "심연포식", cond: "暗 4 + 惡 2", short: "처형과 회복이 연결됩니다.", detail: "처형 성공 시 회복 효과와 공격력 버프가 연계됩니다." },
      fallenholy: { name: "타락성역", cond: "聖 4 + 惡 2", short: "보호막과 회복이 서로 강화됩니다.", detail: "회복 발생 시 보호막, 보호막 획득 시 회복 보조 효과" },
      bloodflamedemon: { name: "혈염귀", cond: "火 1 + 暗 1 + 鬼 1", short: "화상과 처형이 鬼 중첩을 밀어줍니다.", detail: "화상 중인 적 처치, 체력 낮은 적 처형 시 鬼 중첩 추가 획득" },
      holydemon: { name: "귀신성흔", cond: "聖 2 + 鬼 2", short: "보호막이 鬼 중첩 손실을 줄입니다.", detail: "보호막 보유 중 鬼 중첩 증가량 상승\n피격 시 중첩 감소 완화" },
      evildemon: { name: "악귀포식", cond: "惡 2 + 鬼 2", short: "회복이 鬼 중첩으로 이어집니다.", detail: "회복 발생 시 鬼 중첩 획득\n초과 회복 시 추가 중첩" }
    };

    const META_KEY = "sabana_survivors_coin_meta_v6";

    const LABS = {
      basic: [
        ["hp", "기초 체력 연구", 10, 160, 1.30, l => `시작 최대 HP +${l * 25}`],
        ["damage", "기초 공격 연구", 10, 220, 1.32, l => `모든 피해 +${l * 10}%`],
        ["speed", "이동 훈련", 5, 180, 1.32, l => `이동속도 +${l * 8}%`],
        ["magnet", "자석 범위 연구", 10, 150, 1.28, l => `흡수 범위 +${l * 40}`],
        ["defense", "방어 훈련", 5, 230, 1.34, l => `받는 피해 -${l * 6}%`],
        ["shield", "시작 보호막 연구", 5, 220, 1.34, l => `시작 보호막 +${l * 30}`],
        ["heal_eff", "회복 효율 연구", 5, 240, 1.34, l => `회복량 +${l * 15}%`],
        ["exp", "경험 흡수 연구", 10, 260, 1.32, l => `경험치 획득량 +${l * 8}%`]
      ],
      combat: [
        ["invuln", "피격 무적 연구", 5, 600, 1.5, l => `피격 무적 +${(l * 0.08).toFixed(2)}초`],
        ["emergency", "응급 회복 연구", 5, 900, 1.55, l => `HP 25% 이하 시 ${10 + l * 5} 회복, 전투당 1회`],
        ["deathsave", "사망 유예 연구", 1, 6000, 1, l => l ? "치명 피해 1회 생존" : "미해금"],
        ["knockback", "넉백 강화 연구", 5, 500, 1.4, l => `적 타격 넉백 +${l * 8}%`],
        ["syn_amp", "속성 증폭 연구", 5, 1000, 1.55, l => `속성 시너지 효과 +${l * 3}%`],
        ["reroll", "증강 재추첨 연구", 3, 1200, 1.75, l => `증강 선택마다 새로고침 ${l}회`],
        ["high_grade", "고위 증강 연구", 5, 1500, 1.65, l => `에픽 +${l * 2}%, 전설 +${l}%`],
        ["attr_focus", "속성 집중 연구", 5, 1000, 1.55, l => `보유 속성 관련 증강 가중치 +${l * 8}%`]
      ],
      economy: [
        ["coin_gain", "코인 수집 연구", 10, 500, 1.35, l => `전투 중 코인 획득량 +${l * 5}%`],
        ["survival_coin", "생존 보상 연구", 10, 600, 1.35, l => `생존 시간 코인 +${l * 5}%`],
        ["kill_coin", "처치 보상 연구", 10, 600, 1.35, l => `처치 보상 코인 +${l * 5}%`],
        ["elite_bounty", "정예 현상금 연구", 5, 900, 1.5, l => `정예/보스 보상 +${l * 10}%`],
        ["over_exp", "초과 경험 연구", 5, 1000, 1.5, l => `만렙 이후 초과 경험 보상 +${l * 10}%`],
        ["jackpot", "대박 보상 연구", 5, 1200, 1.6, l => `${l * 2}% 확률로 종료 코인 2배`],
        ["research_discount", "연구 할인", 5, 1400, 1.65, l => `연구소 비용 -${l * 3}%`],
        ["shop_discount", "상점 할인", 5, 1200, 1.55, l => `상점 비용 -${l * 4}%`]
      ]
    };

    function defaultMeta() {
      const upgrades = {};
      Object.values(LABS).flat().forEach(([id]) => upgrades[id] = 0);
      return { coins: 0, bestTimeMs: 0, bestKills: 0, totalCoins: 0, upgrades };
    }

    function loadMeta() {
      try {
        const saved = JSON.parse(localStorage.getItem(META_KEY));
        if (!saved) return defaultMeta();
        const base = defaultMeta();
        return { ...base, ...saved, upgrades: { ...base.upgrades, ...(saved.upgrades || {}) } };
      } catch {
        return defaultMeta();
      }
    }

    function saveMeta() {
      localStorage.setItem(META_KEY, JSON.stringify(meta));
    }

    let meta = loadMeta();
    let labTab = "basic";
    let codexTab = "augments";

    const WEAPONS = [
      {
        id: "magic_staff",
        name: "마력탄 지팡이",
        desc: "가장 가까운 적들에게 마력탄을 자동 발사합니다.",
        color: "#93c5fd",
        tags: ["magic", "projectile"]
      },
      {
        id: "flame_heart",
        name: "화염 심장",
        desc: "주변에 화염 오라를 유지해 지속 피해를 줍니다.",
        color: "#fb7185",
        tags: ["fire", "aura", "area"]
      },
      {
        id: "orbit_axe",
        name: "회전 도끼",
        desc: "주변을 도는 도끼가 적에게 접촉 피해를 줍니다.",
        color: "#fbbf24",
        tags: ["orbit", "physical"]
      }
    ];

    const AUGMENTS = [
      {
        id: "cold_edge", name: "차가운 칼끝", grade: "basic", attrs: { "氷": 1 },
        desc: "공격 적중 시 낮은 확률로 적을 둔화시킵니다.",
        detail: "공격 적중 시 둔화 확률 +8%\n속성: 氷 +1",
        apply(s) { s.perks.slowChance += 0.08; }
      },
      {
        id: "small_flame", name: "작은 불씨", grade: "basic", attrs: { "火": 1 },
        desc: "공격 적중 시 낮은 확률로 화상을 부여합니다.",
        detail: "공격 적중 시 화상 확률 +8%\n속성: 火 +1",
        apply(s) { s.perks.burnChance += 0.08; }
      },
      {
        id: "light_breeze", name: "가벼운 순풍", grade: "basic", attrs: { "風": 1 },
        desc: "공격속도가 조금 증가합니다.",
        detail: "공격속도 +8%\n속성: 風 +1",
        apply(s) { s.perks.attackSpeedMul *= 1.08; }
      },
      {
        id: "shimmer", name: "희미한 광휘", grade: "basic", attrs: { "光": 1 },
        desc: "공격 범위가 조금 증가합니다.",
        detail: "공격 범위 +8%\n속성: 光 +1",
        apply(s) { s.perks.areaMul *= 1.08; }
      },
      {
        id: "shadow_cut", name: "그림자 절단", grade: "normal", attrs: { "暗": 1 },
        desc: "체력이 낮은 적에게 추가 피해를 줍니다.",
        detail: "체력 35% 이하 적에게 추가 피해 +18%\n속성: 暗 +1",
        apply(s) { s.perks.executeDamage += 0.18; }
      },
      {
        id: "holy_seed", name: "성스러운 씨앗", grade: "normal", attrs: { "聖": 1 },
        desc: "처치 시 낮은 확률로 보호막을 얻습니다.",
        detail: "처치 시 보호막 획득 확률 +6%\n속성: 聖 +1",
        apply(s) { s.perks.killShieldChance += 0.06; }
      },
      {
        id: "evil_drop", name: "악의 혈방울", grade: "normal", attrs: { "惡": 1 },
        desc: "처치 시 낮은 확률로 체력을 회복합니다.",
        detail: "처치 시 회복 확률 +6%\n속성: 惡 +1",
        apply(s) { s.perks.killHealChance += 0.06; }
      },
      {
        id: "frostfire_core", name: "서리불꽃 핵", grade: "advanced", attrs: { "氷": 1, "火": 1 },
        desc: "둔화된 적에게 화상 피해가 강해집니다.",
        detail: "둔화 + 화상 상태 적 추가 피해 +35%\n속성: 氷 +1, 火 +1",
        apply(s) { s.perks.frostfireBonus += 0.35; }
      },
      {
        id: "burning_wind", name: "불타는 순풍", grade: "advanced", attrs: { "火": 1, "風": 1 },
        desc: "화상 중인 적을 공격하면 주변에 약한 화상이 전이될 수 있습니다.",
        detail: "화상 중인 적 공격 시 화상 전이 확률 +12%\n속성: 火 +1, 風 +1",
        apply(s) { s.perks.burnSpreadChance += 0.12; }
      },
      {
        id: "radiant_wind", name: "광휘질풍", grade: "advanced", attrs: { "風": 1, "光": 1 },
        desc: "공격속도가 높을수록 공격 범위가 증가합니다.",
        detail: "공격속도 증가분 일부가 공격 범위로 전환\n속성: 風 +1, 光 +1",
        apply(s) { s.perks.speedToArea += 0.18; }
      },
      {
        id: "eclipse_mark", name: "일식의 표식", grade: "advanced", attrs: { "光": 1, "暗": 1 },
        desc: "범위 피해가 체력 낮은 적에게 추가 피해를 줍니다.",
        detail: "범위 피해가 체력 낮은 적에게 추가 피해 +18%\n속성: 光 +1, 暗 +1",
        apply(s) { s.perks.areaExecute += 0.18; }
      },
      {
        id: "fallen_sanctuary", name: "타락한 성역", grade: "epic", attrs: { "聖": 1, "惡": 1 },
        desc: "보호막과 회복 효과가 서로를 강화합니다.",
        detail: "보호막 획득 시 회복 보조\n회복 발생 시 보호막 보조\n속성: 聖 +1, 惡 +1",
        apply(s) { s.perks.sanctuaryLoop = true; }
      },
      {
        id: "perfect_focus", name: "완전한 집중", grade: "epic", attrs: { "風": 1, "光": 1 },
        desc: "타격 시 공격력 ×1.005. 최대 80중첩. 피격 시 초기화.",
        detail: "타격 시 공격력 ×1.005\n최대 중첩: 80\n피격 시 중첩 초기화\n속성: 風 +1, 光 +1",
        apply(s) { s.perks.focusBlade = true; }
      },
      {
        id: "glass_sanctuary", name: "유리성역", grade: "epic", attrs: { "光": 1, "聖": 1 },
        desc: "보호막 보유 중 피해 +60%. 보호막이 없으면 받는 피해 증가.",
        detail: "보호막 보유 중 피해 +60%\n보호막이 없으면 받는 피해 +20%\n속성: 光 +1, 聖 +1",
        apply(s) { s.perks.glassSanctuary = true; }
      },
      {
        id: "chain_reaction", name: "연쇄 반응", grade: "advanced", attrs: { "風": 1 },
        desc: "투사체 적중 시 추가 탄환을 생성할 수 있습니다.",
        detail: "투사체 적중 시 22% 확률로 추가 탄환\n연쇄 탄환은 다시 연쇄 반응을 만들지 않음\n속성: 風 +1",
        apply(s) { s.perks.chainChance += 0.22; }
      },
      {
        id: "star_tuning", name: "별의 조율", grade: "epic", attrs: { "光": 1, "風": 1 },
        desc: "투사체 적중 시 별빛 폭발. 연쇄 탄환에도 발동 가능.",
        detail: "투사체 적중 시 22% 확률로 별빛 폭발\n연쇄 반응 탄환에도 발동 가능\n속성: 光 +1, 風 +1",
        apply(s) { s.perks.starChance += 0.22; }
      },
      {
        id: "curse_crown", name: "저주받은 왕관", grade: "legendary", attrs: { "氷": 1, "火": 1, "風": 1, "光": 1, "暗": 1, "聖": 1, "惡": 1 },
        desc: "모든 일반 속성 +1. 최대 HP 감소, 회복량 감소.",
        detail: "氷 火 風 光 暗 聖 惡 +1\n최대 HP -30\n회복량 -50%\n鬼는 제외",
        apply(s) { s.perks.cursedCrown = true; }
      },
      {
        id: "overheat_heart", name: "과열 심장", grade: "legendary", attrs: { "火": 2 },
        desc: "공격속도 크게 증가. 공격할 때마다 HP를 조금 소모합니다.",
        detail: "공격속도 +55%\n공격 시 HP 0.2 소모\n속성: 火 +2",
        apply(s) { s.perks.attackSpeedMul *= 1.55; s.perks.overheat = true; }
      },
      {
        id: "void_feast", name: "심연포식", grade: "legendary", attrs: { "暗": 1, "惡": 1 },
        desc: "처형 성공 시 회복하고, 회복 초과분이 공격력으로 전환됩니다.",
        detail: "처형 성공 시 회복 연계\n초과 회복량 일부가 공격력 버프로 전환\n속성: 暗 +1, 惡 +1",
        apply(s) { s.perks.voidFeast = true; }
      },
      {
        id: "demon_gate", name: "귀문개방", grade: "legendary", attrs: { "鬼": 2 },
        ghost: true,
        desc: "鬼 +2. 처치 중첩이 강해지지만 피격 시 현재 HP 추가 피해.",
        detail: "鬼 +2\n처치 시 鬼 중첩 추가 +1\n피격 시 현재 HP 8% 추가 피해",
        apply(s) { s.perks.demonGate = true; }
      },
      {
        id: "demon_mark", name: "귀왕의 낙인", grade: "legendary", attrs: { "鬼": 1 },
        ghost: true,
        desc: "처치 시 공격력 중첩. 피격 시 큰 폭 감소.",
        detail: "처치 시 鬼 중첩 기반 공격력 강화\n피격 시 중첩 감소\n속성: 鬼 +1",
        apply(s) { s.perks.demonMark = true; }
      },
      {
        id: "blood_flame_demon", name: "혈염귀", grade: "epic", attrs: { "火": 1, "暗": 1, "鬼": 1 },
        ghost: true,
        desc: "화상 중인 적 처치와 처형 성공이 鬼 중첩을 밀어줍니다.",
        detail: "화상 중인 적 처치 시 鬼 중첩 추가\n처형 성공 시 鬼 중첩 추가\n속성: 火 +1, 暗 +1, 鬼 +1",
        apply(s) { s.perks.bloodFlameDemon = true; }
      },
      {
        id: "holy_demon_scar", name: "귀신성흔", grade: "epic", attrs: { "聖": 1, "鬼": 1 },
        ghost: true,
        desc: "보호막 보유 중 鬼 중첩 증가량 상승. 피격 시 감소 완화.",
        detail: "보호막 보유 중 鬼 중첩 증가량 상승\n보호막 보유 중 피격 시 鬼 중첩 감소량 완화\n속성: 聖 +1, 鬼 +1",
        apply(s) { s.perks.holyDemonScar = true; }
      },
      {
        id: "evil_demon_feast", name: "악귀포식", grade: "legendary", attrs: { "惡": 1, "鬼": 1 },
        ghost: true,
        desc: "회복이 발생할 때 鬼 중첩을 얻습니다.",
        detail: "회복 발생 시 鬼 중첩 +1\n초과 회복 시 鬼 중첩 추가 +1\n속성: 惡 +1, 鬼 +1",
        apply(s) { s.perks.evilDemonFeast = true; }
      }
    ];
