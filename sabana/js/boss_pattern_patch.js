// SABANA boss pattern patch v1
// 3차 적용: 보스별 탄막 패턴 + 페이즈 전환 + 최종보스 눈 개안 연출.
(function () {
  if (window.__sabanaBossPatternPatchV1) return;
  window.__sabanaBossPatternPatchV1 = true;

  function bossPhase(e) {
    const ratio = Math.max(0, e.hp / e.maxHp);
    if (ratio > 0.75) return 0;
    if (ratio > 0.5) return 1;
    if (ratio > 0.25) return 2;
    return 3;
  }

  function ensureBossState(e) {
    if (!e.bossPattern) {
      e.bossPattern = {
        phase: bossPhase(e),
        step: 0,
        timer: 0,
        spiral: 0,
      };
    }

    const nextPhase = bossPhase(e);
    if (nextPhase !== e.bossPattern.phase) {
      e.bossPattern.phase = nextPhase;
      e.bossPattern.step = 0;
      e.bossPattern.timer = 0;
      onBossPhaseChange(e, nextPhase);
    }

    return e.bossPattern;
  }

  function onBossPhaseChange(e, phase) {
    const finalBoss = e.id === "sabana_lord";
    const phaseText = finalBoss
      ? ["눈꺼풀이 흔들립니다", "눈이 반쯤 열립니다", "시선이 고정됩니다", "충혈된 눈이 완전히 열립니다"][phase]
      : `${phase}페이즈 돌입`;

    showBigAlert(e.name || "보스", phaseText);
    state.enemyProjectiles = [];
    state.bossBeams = [];
    state.effects.push({
      x: e.x,
      y: e.y,
      radius: 90 + phase * 35,
      life: 0.45,
      maxLife: 0.45,
      color: finalBoss ? "#ef4444" : "#facc15",
    });
    shootRadial(e, finalBoss ? 18 + phase * 6 : 12 + phase * 4, e.damage * (0.32 + phase * 0.04), 90 + phase * 18, 4.5, finalBoss ? "#dc2626" : "#f87171", phase * 0.13);
    state.player.invuln = Math.max(state.player.invuln || 0, 0.45);
  }

  function angleToPlayer(e) {
    return Math.atan2(state.player.y - e.y, state.player.x - e.x);
  }

  function pushEnemyBullet(x, y, angle, speed, damage, radius, color, options = {}) {
    state.enemyProjectiles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: radius,
      damage,
      color,
      life: options.life || 5,
      homing: !!options.homing,
      turnRate: options.homing ? (options.turnRate || 0.012) : 0,
    });
  }

  function shootRadial(e, count, damage, speed, radius, color, rotate = 0) {
    for (let i = 0; i < count; i++) {
      const angle = Math.PI * 2 * i / count + rotate;
      pushEnemyBullet(e.x, e.y, angle, speed, damage, radius, color, { life: 5.5 });
    }
  }

  function shootAimedSpread(e, count, gap, damage, speed, radius, color, homing = false) {
    const base = angleToPlayer(e);
    for (let i = 0; i < count; i++) {
      const angle = base + (i - (count - 1) / 2) * gap;
      pushEnemyBullet(e.x, e.y, angle, speed, damage, radius, color, { homing, turnRate: 0.01, life: 5 });
    }
  }

  function shootSpiral(e, arms, countPerArm, stepAngle, damage, speed, radius, color) {
    e.bossPattern.spiral = (e.bossPattern.spiral || 0) + stepAngle;
    for (let arm = 0; arm < arms; arm++) {
      const base = e.bossPattern.spiral + Math.PI * 2 * arm / arms;
      for (let i = 0; i < countPerArm; i++) {
        const angle = base + i * 0.12;
        pushEnemyBullet(e.x, e.y, angle, speed + i * 8, damage, radius, color, { life: 5.2 });
      }
    }
  }

  function addBossBeam(e, angle, opts = {}) {
    state.bossBeams = state.bossBeams || [];
    state.bossBeams.push({
      x: e.x,
      y: e.y,
      angle,
      length: opts.length || Math.max(canvas.width, canvas.height) * 1.35,
      width: opts.width || 22,
      warn: opts.warn || 0.75,
      active: opts.active || 0.22,
      life: (opts.warn || 0.75) + (opts.active || 0.22),
      damage: opts.damage || e.damage * 0.9,
      color: opts.color || "#ef4444",
    });
  }

  function addCrossBeams(e, rotate = 0, opts = {}) {
    addBossBeam(e, rotate, opts);
    addBossBeam(e, rotate + Math.PI / 2, opts);
  }

  function addXBeams(e, rotate = 0, opts = {}) {
    addBossBeam(e, rotate + Math.PI / 4, opts);
    addBossBeam(e, rotate - Math.PI / 4, opts);
  }

  function distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
    const cx = x1 + t * dx;
    const cy = y1 + t * dy;
    return Math.hypot(px - cx, py - cy);
  }

  function updateBossBeams(dt) {
    if (!state?.bossBeams?.length) return;

    for (const b of state.bossBeams) {
      b.life -= dt;
      const activeNow = b.life <= b.active;
      if (!activeNow) continue;

      const x1 = b.x - Math.cos(b.angle) * b.length;
      const y1 = b.y - Math.sin(b.angle) * b.length;
      const x2 = b.x + Math.cos(b.angle) * b.length;
      const y2 = b.y + Math.sin(b.angle) * b.length;
      const dist = distToSegment(state.player.x, state.player.y, x1, y1, x2, y2);

      if (dist < b.width / 2 + state.player.r) {
        damagePlayer(b.damage * dt * 4.5, b.x, b.y);
      }
    }

    state.bossBeams = state.bossBeams.filter(b => b.life > 0);
  }

  function drawBossBeams() {
    if (!state?.bossBeams?.length || !ctx) return;

    for (const b of state.bossBeams) {
      const activeNow = b.life <= b.active;
      const x1 = b.x - Math.cos(b.angle) * b.length;
      const y1 = b.y - Math.sin(b.angle) * b.length;
      const x2 = b.x + Math.cos(b.angle) * b.length;
      const y2 = b.y + Math.sin(b.angle) * b.length;

      ctx.save();
      ctx.lineCap = "round";

      if (!activeNow) {
        const alpha = 0.25 + Math.sin(Date.now() / 80) * 0.1;
        ctx.strokeStyle = `rgba(248,113,113,${alpha})`;
        ctx.lineWidth = Math.max(3, b.width * 0.35);
      } else {
        ctx.strokeStyle = b.color || "#ef4444";
        ctx.lineWidth = b.width;
        ctx.shadowColor = b.color || "#ef4444";
        ctx.shadowBlur = 14;
      }

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function updateGuardianPattern(e, dt) {
    const p = ensureBossState(e);
    p.timer -= dt;
    if (p.timer > 0) return;

    const phase = p.phase;
    p.step += 1;

    if (phase === 0) {
      p.timer = 1.05;
      shootAimedSpread(e, 3, 0.2, e.damage * 0.45, 115, 5, "#f87171");
    } else if (phase === 1) {
      p.timer = 0.9;
      if (p.step % 3 === 0) shootRadial(e, 12, e.damage * 0.38, 105, 4.5, "#ef4444", p.step * 0.12);
      else shootAimedSpread(e, 5, 0.18, e.damage * 0.48, 125, 5, "#fca5a5");
    } else if (phase === 2) {
      p.timer = 0.78;
      if (p.step % 4 === 0) addCrossBeams(e, p.step * 0.22, { width: 16, warn: 0.65, active: 0.18, damage: e.damage * 0.8 });
      shootRadial(e, 10, e.damage * 0.32, 120, 4.2, "#dc2626", p.step * 0.19);
    } else {
      p.timer = 0.62;
      shootAimedSpread(e, 7, 0.16, e.damage * 0.42, 145, 4.5, "#ef4444", p.step % 3 === 0);
      if (p.step % 5 === 0) shootRadial(e, 18, e.damage * 0.28, 115, 4, "#f87171", p.step * 0.1);
    }
  }

  function updateCrusherPattern(e, dt) {
    const p = ensureBossState(e);
    p.timer -= dt;
    if (p.timer > 0) return;

    const phase = p.phase;
    p.step += 1;

    if (phase === 0) {
      p.timer = 1.0;
      shootAimedSpread(e, 5, 0.22, e.damage * 0.45, 125, 5, "#fb7185");
    } else if (phase === 1) {
      p.timer = 0.9;
      addCrossBeams(e, p.step * 0.18, { width: 18, warn: 0.7, active: 0.2, damage: e.damage * 0.75, color: "#ef4444" });
      shootRadial(e, 8, e.damage * 0.3, 115, 4.5, "#f87171", p.step * 0.22);
    } else if (phase === 2) {
      p.timer = 0.72;
      shootSpiral(e, 3, 3, 0.32, e.damage * 0.34, 115, 4.2, "#dc2626");
      if (p.step % 3 === 0) addXBeams(e, p.step * 0.16, { width: 18, warn: 0.65, active: 0.22, damage: e.damage * 0.8 });
    } else {
      p.timer = 0.58;
      shootSpiral(e, 4, 3, 0.38, e.damage * 0.32, 125, 4.2, "#b91c1c");
      if (p.step % 4 === 0) addCrossBeams(e, p.step * 0.24, { width: 20, warn: 0.58, active: 0.22, damage: e.damage * 0.9 });
    }
  }

  function updateDarkKnightPattern(e, dt) {
    const p = ensureBossState(e);
    p.timer -= dt;
    if (p.timer > 0) return;

    const phase = p.phase;
    p.step += 1;

    if (phase === 0) {
      p.timer = 0.9;
      shootAimedSpread(e, 5, 0.16, e.damage * 0.48, 150, 4.8, "#f87171");
    } else if (phase === 1) {
      p.timer = 0.74;
      shootAimedSpread(e, 3, 0.12, e.damage * 0.55, 170, 5, "#ef4444", p.step % 2 === 0);
      if (p.step % 4 === 0) addXBeams(e, angleToPlayer(e), { width: 16, warn: 0.62, active: 0.18, damage: e.damage * 0.9 });
    } else if (phase === 2) {
      p.timer = 0.58;
      shootSpiral(e, 2, 5, 0.46, e.damage * 0.36, 145, 4.5, "#991b1b");
      if (p.step % 5 === 0) addBossBeam(e, angleToPlayer(e), { width: 26, warn: 0.72, active: 0.24, damage: e.damage * 1.05 });
    } else {
      p.timer = 0.45;
      shootAimedSpread(e, 7, 0.13, e.damage * 0.42, 180, 4.4, "#dc2626", p.step % 3 === 0);
      if (p.step % 4 === 0) shootRadial(e, 20, e.damage * 0.25, 135, 4, "#7f1d1d", p.step * 0.2);
      if (p.step % 7 === 0) addXBeams(e, angleToPlayer(e), { width: 22, warn: 0.55, active: 0.23, damage: e.damage * 1.0 });
    }
  }

  function updateSabanaPattern(e, dt) {
    const p = ensureBossState(e);
    p.timer -= dt;
    if (p.timer > 0) return;

    const phase = p.phase;
    p.step += 1;

    if (phase === 0) {
      p.timer = 0.78;
      shootRadial(e, 16, e.damage * 0.34, 105, 4.8, "#ef4444", p.step * 0.12);
      if (p.step % 4 === 0) shootAimedSpread(e, 5, 0.18, e.damage * 0.55, 145, 5.5, "#fca5a5");
    } else if (phase === 1) {
      p.timer = 0.62;
      shootSpiral(e, 3, 4, 0.35, e.damage * 0.34, 125, 4.6, "#dc2626");
      if (p.step % 4 === 0) addBossBeam(e, angleToPlayer(e), { width: 24, warn: 0.7, active: 0.22, damage: e.damage * 0.9, color: "#ef4444" });
    } else if (phase === 2) {
      p.timer = 0.48;
      shootSpiral(e, 4, 4, 0.44, e.damage * 0.31, 140, 4.4, "#b91c1c");
      if (p.step % 3 === 0) addCrossBeams(e, p.step * 0.18, { width: 22, warn: 0.6, active: 0.22, damage: e.damage * 0.95, color: "#dc2626" });
      if (p.step % 5 === 0) shootAimedSpread(e, 9, 0.12, e.damage * 0.42, 165, 4.5, "#f87171", true);
    } else {
      p.timer = 0.34;
      shootSpiral(e, 5, 4, 0.54, e.damage * 0.29, 155, 4.2, "#7f1d1d");
      if (p.step % 3 === 0) addXBeams(e, angleToPlayer(e) + p.step * 0.08, { width: 26, warn: 0.5, active: 0.24, damage: e.damage * 1.05, color: "#ef4444" });
      if (p.step % 5 === 0) shootRadial(e, 28, e.damage * 0.24, 135, 3.8, "#dc2626", p.step * 0.12);
    }
  }

  const originalUpdateEnemyShooting = window.updateEnemyShooting;
  window.updateEnemyShooting = function patchedUpdateEnemyShooting(e, dt) {
    if (!state?.stageGate?.active && (e.ai === "boss" || e.ai === "midboss")) {
      if (e.id === "mid_guardian") return updateGuardianPattern(e, dt);
      if (e.id === "wave_brute") return updateCrusherPattern(e, dt);
      if (e.id === "dark_knight") return updateDarkKnightPattern(e, dt);
      if (e.id === "sabana_lord") return updateSabanaPattern(e, dt);
    }

    return originalUpdateEnemyShooting(e, dt);
  };

  const originalUpdate = window.update;
  window.update = function patchedUpdate(dt) {
    originalUpdate(dt);
    if (state?.running && !state?.paused && !state?.stageGate?.active) {
      updateBossBeams(dt);
    }
  };

  const originalDraw = window.draw;
  window.draw = function patchedDraw() {
    originalDraw();
    drawBossBeams();
  };

  const originalDrawEnemyShape = window.drawEnemyShape;
  window.drawEnemyShape = function patchedDrawEnemyShape(e) {
    if (e?.id !== "sabana_lord" || !ctx) {
      return originalDrawEnemyShape(e);
    }

    const phase = bossPhase(e);
    const fill = e.freezeTime > 0 ? "#7dd3fc" : e.burnTime > 0 ? "#fb923c" : e.color;
    const open = [0.18, 0.42, 0.7, 0.95][phase];

    ctx.save();
    ctx.beginPath();
    ctx.fillStyle = "rgba(239,68,68,.16)";
    ctx.arc(e.x, e.y, e.r + 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = fill;
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = phase >= 3 ? "#fee2e2" : "#fecaca";
    ctx.ellipse(e.x, e.y, e.r * 0.78, e.r * open * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = phase >= 3 ? "#dc2626" : "#7f1d1d";
    ctx.arc(e.x, e.y, Math.max(3, e.r * 0.16 + phase * 1.6), 0, Math.PI * 2);
    ctx.fill();

    if (phase >= 3) {
      ctx.strokeStyle = "rgba(220,38,38,.9)";
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 8; i++) {
        const a = Math.PI * 2 * i / 8;
        ctx.beginPath();
        ctx.moveTo(e.x + Math.cos(a) * e.r * 0.25, e.y + Math.sin(a) * e.r * 0.14);
        ctx.lineTo(e.x + Math.cos(a) * e.r * 0.65, e.y + Math.sin(a) * e.r * 0.32);
        ctx.stroke();
      }
    }

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
    ctx.restore();
  };
})();