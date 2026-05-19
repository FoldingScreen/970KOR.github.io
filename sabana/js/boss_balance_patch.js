// SABANA boss balance patch v3
// 보스 난이도 상향: 보스전 흡혈 제한 + 3회 피격 사망 + 전 페이즈 탄막 압박 강화 + 마력탄 재조정.
// Firebase / 로그인 / 저장 로직은 건드리지 않는다.
(function () {
  if (window.__sabanaBossBalancePatchV3) return;
  window.__sabanaBossBalancePatchV3 = true;

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

  function bossActive() {
    return !!state?.enemies?.some(e => e.hp > 0 && (e.boss || e.midBoss));
  }

  function bossPhase(e) {
    const ratio = Math.max(0, e.hp / e.maxHp);
    if (ratio > 0.75) return 0;
    if (ratio > 0.5) return 1;
    if (ratio > 0.25) return 2;
    return 3;
  }

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
      spawned._bossSpawnedAt = performance.now();

      state.bossHitCount = 0;
      state.bossHitLimit = 3;
      state.bossNoLifesteal = true;
    };
  }

  const oldGetWeaponStats = window.getWeaponStats;
  if (typeof oldGetWeaponStats === "function") {
    window.getWeaponStats = function patchedBalancedGetWeaponStats() {
      const w = oldGetWeaponStats();
      if (!state?.weapon || !w) return w;

      if (state.weapon.id === "magic_staff") {
        const lv = Number(state.weaponLevel || 0);
        const hasBoss = bossActive();

        const intervalMul = lv < 4 ? 1.70 : lv < 7 ? 1.48 : lv < 10 ? 1.32 : 1.22;
        const damageMul = lv < 4 ? 0.95 : lv < 7 ? 0.88 : lv < 10 ? 0.80 : 0.74;

        w.damage *= damageMul;
        w.intervalMs *= intervalMul;
        w.knockback *= 0.72;

        if (hasBoss) {
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

  const oldHealPlayer = window.healPlayer;
  if (typeof oldHealPlayer === "function") {
    window.healPlayer = function patchedBossHealPlayer(amount) {
      if (bossActive()) return oldHealPlayer(amount * 0.15);
      return oldHealPlayer(amount);
    };
  }

  const oldApplyBloodFurnaceLifesteal = window.applyBloodFurnaceLifesteal;
  if (typeof oldApplyBloodFurnaceLifesteal === "function") {
    window.applyBloodFurnaceLifesteal = function patchedBossBloodFurnaceLifesteal(damage, tags = []) {
      if (bossActive()) return;
      return oldApplyBloodFurnaceLifesteal(damage, tags);
    };
  }

  const oldAddShield = window.addShield;
  if (typeof oldAddShield === "function") {
    window.addShield = function patchedBossAddShield(amount) {
      if (bossActive()) return oldAddShield(amount * 0.25);
      return oldAddShield(amount);
    };
  }

  const oldDamagePlayer = window.damagePlayer;
  if (typeof oldDamagePlayer === "function") {
    window.damagePlayer = function patchedBossDamagePlayer(amount, sourceX, sourceY) {
      if (!bossActive()) return oldDamagePlayer(amount, sourceX, sourceY);
      if (state.player.invuln > 0) return;

      state.bossHitLimit = state.bossHitLimit || 3;
      state.bossHitCount = (state.bossHitCount || 0) + 1;
      const left = Math.max(0, state.bossHitLimit - state.bossHitCount);

      state.player.shield = 0;
      state.player.hp = Math.max(1, state.player.maxHp * (left / state.bossHitLimit));
      state.player.invuln = 0.95;

      const dx = state.player.x - sourceX;
      const dy = state.player.y - sourceY;
      const len = Math.hypot(dx, dy) || 1;
      state.player.kbX += (dx / len) * 620;
      state.player.kbY += (dy / len) * 620;

      if (state.perks.focusBlade) state.stacks.focus = 0;
      addFloating(state.player.x, state.player.y - 18, `보스 피격 ${state.bossHitCount}/3`, "#fca5a5");
      showToast(`보스전 피격 ${state.bossHitCount}/3`);

      if (state.bossHitCount >= state.bossHitLimit) {
        state.player.hp = 0;
        endGame(false);
      }
    };
  }

  function pushBossBullet(e, angle, speed, damage, radius, color, life = 5, homing = false) {
    state.enemyProjectiles.push({
      x: e.x,
      y: e.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: radius,
      damage,
      color,
      life,
      homing,
      turnRate: homing ? 0.01 : 0,
    });
  }

  function shootExtraRadial(e, count, speed, damage, radius, color, rotate = 0) {
    for (let i = 0; i < count; i++) {
      pushBossBullet(e, Math.PI * 2 * i / count + rotate, speed, damage, radius, color, 5.2, false);
    }
  }

  function shootExtraAimed(e, count, gap, speed, damage, radius, color, homing = false) {
    const base = Math.atan2(state.player.y - e.y, state.player.x - e.x);
    for (let i = 0; i < count; i++) {
      pushBossBullet(e, base + (i - (count - 1) / 2) * gap, speed, damage, radius, color, 5, homing);
    }
  }

  const oldUpdateEnemyShooting = window.updateEnemyShooting;
  if (typeof oldUpdateEnemyShooting === "function") {
    window.updateEnemyShooting = function patchedHardBossShooting(e, dt) {
      const result = oldUpdateEnemyShooting(e, dt);
      if (!state || state.stageGate?.active || !(e?.boss || e?.midBoss) || e.hp <= 0) return result;

      const phase = bossPhase(e);
      const hardPhase = Math.min(3, phase + 1);
      e._hardBossTimer = (e._hardBossTimer || 0) - dt;
      e._hardBossStep = e._hardBossStep || 0;

      const interval = Math.max(0.36, (e.boss ? 0.82 : 1.02) - hardPhase * 0.12);
      if (e._hardBossTimer > 0) return result;

      e._hardBossTimer = interval;
      e._hardBossStep += 1;

      const color = e.boss ? "#dc2626" : "#f87171";
      const speed = 118 + hardPhase * 22;
      const damage = e.damage * (0.34 + hardPhase * 0.04);

      if (e._hardBossStep % 3 === 0) {
        shootExtraRadial(e, 10 + hardPhase * 4, speed, damage, 4.5, color, e._hardBossStep * 0.14);
      } else {
        shootExtraAimed(e, 3 + hardPhase * 2, 0.14, speed + 25, damage * 1.1, 4.8, color, hardPhase >= 3 && e._hardBossStep % 2 === 0);
      }

      return result;
    };
  }
})();