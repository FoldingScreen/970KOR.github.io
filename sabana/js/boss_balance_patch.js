// SABANA boss balance patch v1
// 보스가 순삭되는 문제 보정: 보스 HP 증가 + 보스 초당 피해 상한 + 마력탄 보스전 화력 조정.
// Firebase / 로그인 / 저장 로직은 건드리지 않는다.
(function () {
  if (window.__sabanaBossBalancePatchV1) return;
  window.__sabanaBossBalancePatchV1 = true;

  const BOSS_HP_MUL = {
    mid_guardian: 4.2,
    wave_brute: 5.2,
    dark_knight: 6.4,
    sabana_lord: 8.0,
  };

  const BOSS_DPS_CAP_PER_SEC = {
    mid_guardian: 0.040,
    wave_brute: 0.036,
    dark_knight: 0.033,
    sabana_lord: 0.030,
  };

  const oldSpawnBossEnemy = window.spawnBossEnemy;
  if (typeof oldSpawnBossEnemy === "function") {
    window.spawnBossEnemy = function patchedBalancedSpawnBossEnemy(id, name, scale = 1, finalBoss = false) {
      const before = state?.enemies?.length || 0;
      oldSpawnBossEnemy(id, name, scale, finalBoss);
      if (!state?.enemies) return;

      const spawned = state.enemies.slice(before).find(e => e.id === id && (e.boss || e.midBoss));
      if (!spawned) return;

      const mul = BOSS_HP_MUL[id] || (finalBoss ? 7.0 : 5.0);
      spawned.maxHp *= mul;
      spawned.hp = spawned.maxHp;
      spawned._bossDmgWindowAt = performance.now();
      spawned._bossDmgWindowTaken = 0;
      spawned._bossMinFightSec = finalBoss ? 34 : 28;
      spawned._bossSpawnedAt = performance.now();
    };
  }

  const oldGetWeaponStats = window.getWeaponStats;
  if (typeof oldGetWeaponStats === "function") {
    window.getWeaponStats = function patchedBalancedGetWeaponStats() {
      const w = oldGetWeaponStats();
      if (!state?.weapon || !w) return w;

if (state.weapon.id === "magic_staff") {
  const lv = Number(state.weaponLevel || 0);
  const bossAlive = state.enemies?.some(e => e.hp > 0 && (e.boss || e.midBoss));

  // 초반은 "느리지만 한 발은 의미 있게" 조정.
  // 평상시에는 잡몹 정리가 되게 피해를 회복하고,
  // 보스전에서만 추가로 DPS를 누른다.
  const intervalMul =
    lv < 4 ? 1.70 :
    lv < 7 ? 1.48 :
    lv < 10 ? 1.32 :
    1.22;

  const damageMul =
    lv < 4 ? 0.95 :
    lv < 7 ? 0.88 :
    lv < 10 ? 0.80 :
    0.74;

  w.damage *= damageMul;
  w.intervalMs *= intervalMul;
  w.knockback *= 0.72;

  if (bossAlive) {
    w.damage *= 0.72;
    w.intervalMs *= 1.10;
  }

  if (lv >= 10) w.count = Math.max(2, w.count - 1);
}

      return w;
    };
  }

  function bossCapRate(e) {
    return BOSS_DPS_CAP_PER_SEC[e?.id] || (e?.boss ? 0.030 : 0.036);
  }

  const oldHitEnemy = window.hitEnemy;
  if (typeof oldHitEnemy === "function") {
    window.hitEnemy = function patchedBalancedHitEnemy(e, amount, tags = [], knockback = 0, sx = state?.player?.x, sy = state?.player?.y, depth = 0, projectile = null, source = null) {
      if (!e || !(e.boss || e.midBoss)) {
        return oldHitEnemy(e, amount, tags, knockback, sx, sy, depth, projectile, source);
      }

      const now = performance.now();
      if (!e._bossDmgWindowAt || now - e._bossDmgWindowAt >= 1000) {
        e._bossDmgWindowAt = now;
        e._bossDmgWindowTaken = 0;
      }

      const cap = Math.max(1, e.maxHp * bossCapRate(e));
      const remain = Math.max(0, cap - (e._bossDmgWindowTaken || 0));
      if (remain <= 0) return;

      // 보스전은 최소 전투 시간이 있어야 하므로 처형 계열이 보스를 뚫고 녹이지 못하게 잠깐 비활성화.
      const oldExecuteChance = state?.synergy?.executeChance || 0;
      const oldExecuteThreshold = state?.synergy?.executeThreshold || 0;
      if (state?.synergy) {
        state.synergy.executeChance = 0;
        state.synergy.executeThreshold = 0;
      }

      const beforeHp = e.hp;
      const scaled = Math.min(amount * 0.72, remain);
      const result = oldHitEnemy(e, scaled, tags, knockback, sx, sy, depth, projectile, source);
      const dealt = Math.max(0, beforeHp - Math.max(0, e.hp));
      e._bossDmgWindowTaken = (e._bossDmgWindowTaken || 0) + dealt;

      if (state?.synergy) {
        state.synergy.executeChance = oldExecuteChance;
        state.synergy.executeThreshold = oldExecuteThreshold;
      }

      return result;
    };
  }
})();
