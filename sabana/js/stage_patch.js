// SABANA stage patch v1
// 1차 적용: 2분 단위 스테이지 진행표 + 보스 등장 타이밍 + 웨이브 재정리.
(function () {
  if (window.__sabanaStagePatchV1) return;
  window.__sabanaStagePatchV1 = true;

  const STAGES = [
    {
      key: "stage1",
      title: "라운드 1",
      start: 0,
      bossAt: 120,
      waveStart: 90,
      waveTitle: "1차 몬스터웨이브",
      waveDesc: "보스 직전 압박 구간",
      bossFlag: "boss1",
      bossId: "mid_guardian",
      bossName: "수문장",
      bossScale: 0.88,
      finalBoss: false,
      pressure: 0,
    },
    {
      key: "stage2",
      title: "라운드 2",
      start: 120,
      bossAt: 240,
      waveStart: 200,
      waveTitle: "2차 몬스터웨이브",
      waveDesc: "파쇄자 등장 전 압박 구간",
      bossFlag: "boss2",
      bossId: "wave_brute",
      bossName: "파쇄자",
      bossScale: 1.18,
      finalBoss: false,
      pressure: 1,
    },
    {
      key: "stage3",
      title: "라운드 3",
      start: 240,
      bossAt: 360,
      waveStart: 310,
      waveTitle: "3차 몬스터웨이브",
      waveDesc: "암흑 기사 등장 전 실전 구간",
      bossFlag: "boss3",
      bossId: "dark_knight",
      bossName: "암흑 기사",
      bossScale: 1.48,
      finalBoss: false,
      pressure: 2,
    },
    {
      key: "finalStage",
      title: "최종 라운드",
      start: 360,
      bossAt: 480,
      waveStart: 420,
      waveTitle: "최종 몬스터웨이브",
      waveDesc: "사바나 군주 등장 전 마지막 압박",
      bossFlag: "finalBoss",
      bossId: "sabana_lord",
      bossName: "사바나 군주",
      bossScale: 2.15,
      finalBoss: true,
      pressure: 3,
    },
  ];

  function currentStage(t) {
    return STAGES.slice().reverse().find(stage => t >= stage.start) || STAGES[0];
  }

  window.getLateGamePressure = function getLateGamePressure(t) {
    return currentStage(t).pressure;
  };

  window.getMonsterWave = function getMonsterWave(t) {
    const stage = currentStage(t);
    const active = t >= stage.waveStart && t < stage.bossAt;

    if (!active) {
      return {
        key: `${stage.key}_normal`,
        active: false,
        title: "",
        desc: "",
        intervalMul: Math.max(0.62, 1 - stage.pressure * 0.08),
        spawnCount: 1 + Math.floor(stage.pressure / 2),
        eliteBonus: stage.pressure * 0.008,
        pressure: stage.pressure,
      };
    }

    return {
      key: `${stage.key}_wave`,
      active: true,
      title: stage.waveTitle,
      desc: stage.waveDesc,
      intervalMul: Math.max(0.34, 0.56 - stage.pressure * 0.05),
      spawnCount: 2 + stage.pressure,
      eliteBonus: 0.02 + stage.pressure * 0.012,
      pressure: stage.pressure + 1,
    };
  };

  window.updateTimedBossSpawns = function updateTimedBossSpawns() {
    if (!state) return;
    const t = state.timeMs / 1000;

    for (const stage of STAGES) {
      if (t >= stage.bossAt && !state.bossFlags[stage.bossFlag]) {
        state.bossFlags[stage.bossFlag] = true;
        spawnBossEnemy(stage.bossId, stage.bossName, stage.bossScale, stage.finalBoss);
        return;
      }
    }
  };

  window.getSabanaStageInfo = function getSabanaStageInfo() {
    if (!state) return null;
    const t = state.timeMs / 1000;
    const stage = currentStage(t);
    return {
      ...stage,
      timeToBoss: Math.max(0, stage.bossAt - t),
      waveActive: t >= stage.waveStart && t < stage.bossAt,
    };
  };

  // 기존 화면 문구를 스테이지형 구조에 맞게 보정한다.
  window.addEventListener("DOMContentLoaded", () => {
    const titleSub = document.querySelector(".title-sub");
    if (titleSub) {
      titleSub.innerHTML =
        "2분마다 라운드 보스가 등장하는 스테이지형 생존전입니다.<br />" +
        "8분에 등장하는 최종보스 사바나 군주를 처치하세요.<br />" +
        "보스 처치로 증강을 얻고, 최종 조합 시너지로 빌드를 완성하세요.";
    }

    const sideHelp = document.querySelector(".side-section.small");
    if (sideHelp) {
      sideHelp.innerHTML =
        "<strong>조작</strong><br />" +
        "WASD / 방향키 이동<br />" +
        "ESC / P 일시정지<br />" +
        "모바일: 화면 터치 위치에 조이스틱 생성<br /><br />" +
        "라운드 1: 02:00 수문장<br />" +
        "라운드 2: 04:00 파쇄자<br />" +
        "라운드 3: 06:00 암흑 기사<br />" +
        "최종: 08:00 사바나 군주";
    }
  });
})();