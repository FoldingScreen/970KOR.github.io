// SABANA visual reward patch v1
// 무기 이펙트, 아이템 드롭, 보스 보상 상자/포털 표현 보강.
// Firebase/로그인 관련 코드는 건드리지 않는다.
(function () {
  if (window.__sabanaVisualRewardPatchV1) return;
  window.__sabanaVisualRewardPatchV1 = true;

  function pulse(speed = 260, amp = 0.08) {
    return 1 + Math.sin(Date.now() / speed) * amp;
  }

  function gradeColor(grade) {
    return {
      basic: "#e5e7eb",
      normal: "#93c5fd",
      advanced: "#86efac",
      epic: "#c4b5fd",
      legendary: "#facc15"
    }[grade] || "#e5e7eb";
  }

  function centerText(text, x, y, size = 11, color = "#fff") {
    ctx.save();
    ctx.font = `bold ${size}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function ring(x, y, r, color, alpha = 0.75) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r * pulse(), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function coin(x, y, r, big = false) {
    ctx.save();
    ctx.beginPath();
    ctx.fillStyle = "#facc15";
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fde68a";
    ctx.lineWidth = big ? 3 : 2;
    ctx.stroke();
    centerText("C", x, y + 0.5, big ? 13 : 10, "#713f12");
    ctx.restore();
  }

  function heal(x, y, r, color) {
    ctx.save();
    ctx.beginPath();
    ctx.fillStyle = color || "#60a5fa";
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#dbeafe";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#eff6ff";
    ctx.fillRect(x - r * 0.18, y - r * 0.55, r * 0.36, r * 1.1);
    ctx.fillRect(x - r * 0.55, y - r * 0.18, r * 1.1, r * 0.36);
    ctx.restore();
  }

  function magnet(x, y, r) {
    ctx.save();
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.72, Math.PI * 0.2, Math.PI * 0.8, true);
    ctx.stroke();
    ctx.fillStyle = "#cffafe";
    ctx.fillRect(x - r * 0.72, y - r * 0.12, r * 0.28, r * 0.48);
    ctx.fillRect(x + r * 0.44, y - r * 0.12, r * 0.28, r * 0.48);
    ctx.restore();
  }

  function clearBomb(x, y, r) {
    ctx.save();
    ctx.beginPath();
    ctx.fillStyle = "rgba(248,113,113,.22)";
    ctx.arc(x, y, r + 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = "#ef4444";
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    centerText("!", x, y, 13, "#fee2e2");
    ctx.restore();
  }

  function buff(item, x, y, r) {
    const mark = item.kind === "buff_damage" ? "ATK" : item.kind === "buff_as" ? "AS" : item.kind === "buff_area" ? "R" : "SPD";
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.fillStyle = item.color || "#86efac";
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.86, -r * 0.15);
    ctx.lineTo(r * 0.48, r);
    ctx.lineTo(-r * 0.48, r);
    ctx.lineTo(-r * 0.86, -r * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.8)";
    ctx.lineWidth = 2;
    ctx.stroke();
    centerText(mark, 0, 1, 8, "#052e16");
    ctx.restore();
  }

  function gem(item, x, y, r) {
    const stroke = gradeColor(item.grade);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = item.grade === "legendary" ? "#facc15" : "#a78bfa";
    ctx.fillRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = item.grade === "legendary" ? 3 : 2;
    ctx.strokeRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6);
    ctx.restore();
    centerText(item.kind === "all_gem" ? "★" : (item.attr || "◆"), x, y, item.grade === "legendary" ? 13 : 11, "#111827");
    if (item.grade === "epic" || item.grade === "legendary") ring(x, y, r + 7, stroke, 0.85);
  }

  function bossChest(item) {
    const x = item.x;
    const y = item.y;
    const r = (item.r || 8) + 6;
    const color = gradeColor(item.grade);
    ring(x, y, r + 12, color, 0.9);
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#78350f";
    ctx.fillRect(-r, -r * 0.35, r * 2, r * 1.25);
    ctx.fillStyle = color;
    ctx.fillRect(-r * 0.9, -r * 0.82, r * 1.8, r * 0.52);
    ctx.strokeStyle = "#fef3c7";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(-r, -r * 0.35, r * 2, r * 1.25);
    ctx.strokeRect(-r * 0.9, -r * 0.82, r * 1.8, r * 0.52);
    ctx.fillStyle = "#fef3c7";
    ctx.fillRect(-r * 0.16, -r * 0.18, r * 0.32, r * 0.4);
    ctx.restore();
    centerText("BOSS", x, y + r + 12, 10, "#fef3c7");
  }

  const oldDrawItemShape = window.drawItemShape;
  window.drawItemShape = function patchedDrawItemShape(item) {
    if (!ctx || !item) return;
    const x = item.x;
    const y = item.y;
    const r = Math.max(7, item.r || 7);
    if (item.bossReward) return bossChest(item);
    if (item.kind === "coin_small" || item.kind === "coin_big") return coin(x, y, r + 1, item.kind === "coin_big");
    if (item.kind === "heal_small" || item.kind === "heal_big") return heal(x, y, r + 1, item.color);
    if (item.kind === "magnet") return magnet(x, y, r + 2);
    if (item.kind === ["n", "u", "k", "e"].join("")) return clearBomb(x, y, r + 2);
    if (String(item.kind || "").startsWith("buff_")) return buff(item, x, y, r + 2);
    if (item.kind === "gem" || item.kind === "all_gem") return gem(item, x, y, r + 2);
    if (typeof oldDrawItemShape === "function") return oldDrawItemShape(item);
  };

  function weaponProjectile(p) {
    if (!p || !ctx) return;
    const tags = p.tags || [];
    const weaponId = p.source?.id || "";
    const angle = Math.atan2(p.vy || 0, p.vx || 1);

    if (p.axeSpin || tags.includes("axe") || weaponId === "throw_axe") {
      const spin = Date.now() / 90;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(angle + spin);
      ctx.fillStyle = "#92400e";
      ctx.fillRect(-p.r * 0.18, -p.r * 1.05, p.r * 0.36, p.r * 2.1);
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.ellipse(-p.r * 0.52, -p.r * 0.25, p.r * 0.72, p.r * 0.42, -0.55, 0, Math.PI * 2);
      ctx.ellipse(p.r * 0.52, -p.r * 0.25, p.r * 0.72, p.r * 0.42, 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fef3c7";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
      return;
    }

    if (tags.includes("slash") || weaponId === "crescent_blade") {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(angle);
      ctx.strokeStyle = p.color || "#e0f2fe";
      ctx.lineWidth = Math.max(5, p.r * 0.75);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(0, 0, p.r * 1.8, -0.7, 0.7);
      ctx.stroke();
      ctx.restore();
      return;
    }

    if (tags.includes("magic") || weaponId === "magic_staff") {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(angle);
      ctx.fillStyle = p.color || "#bfdbfe";
      ctx.beginPath();
      ctx.ellipse(0, 0, p.r * 1.8, p.r * 0.75, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.85)";
      ctx.beginPath();
      ctx.arc(p.r * 0.45, -p.r * 0.12, Math.max(1.5, p.r * 0.33), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function lightningLinks() {
    if (!state?.effects?.length || !ctx) return;
    const sparks = state.effects.filter(e => e.color === "#93c5fd" && e.life > 0);
    if (sparks.length < 2) return;
    ctx.save();
    ctx.strokeStyle = "rgba(147,197,253,.55)";
    ctx.lineWidth = 2;
    for (let i = 1; i < sparks.length; i++) {
      const a = sparks[i - 1];
      const b = sparks[i];
      if (Math.hypot(a.x - b.x, a.y - b.y) > 260) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo((a.x + b.x) / 2, (a.y + b.y) / 2);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  const oldDraw = window.draw;
  if (typeof oldDraw === "function") {
    window.draw = function patchedVisualDraw() {
      oldDraw();
      if (!state || !ctx) return;
      for (const p of state.projectiles || []) weaponProjectile(p);
      lightningLinks();
      if (state.stageGate?.active) {
        const g = state.stageGate;
        ctx.save();
        ctx.font = "bold 14px sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "#fef3c7";
        ctx.fillText("아이템을 챙긴 뒤 포털로 이동", canvas.width / 2, 42);
        ctx.restore();
        ring(g.x, g.y, g.r + 14, "#38bdf8", 0.55);
      }
    };
  }
})();