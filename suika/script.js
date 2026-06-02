const {
  Engine,
  World,
  Bodies,
  Body,
  Events,
  Composite
} = Matter;

const WIDTH = 420;
const HEIGHT = 640;

const CANNON = {
  x: WIDTH / 2,
  y: HEIGHT - 44
};

const DANGER_Y = HEIGHT - 125;
const DANGER_LIMIT_MS = 2200;
const SHOT_POWER = 15.2;

// 실제로 보이는 크기보다 충돌 판정을 조금 크게 잡음
// 값이 클수록 더 빡빡하고 어려워짐
const HITBOX_SCALE = 1.00;

const DRINKS = [
  { name: "물컵", emoji: "💧", radius: 20, score: 10, color: "#9ad8ff" },
  { name: "탄산", emoji: "🥤", radius: 24, score: 25, color: "#ffd36f" },
  { name: "주스", emoji: "🧃", radius: 29, score: 60, color: "#ff9f73" },
  { name: "커피", emoji: "☕", radius: 35, score: 140, color: "#b17a56" },
  { name: "버블티", emoji: "🧋", radius: 42, score: 320, color: "#d6a6ff" },
  { name: "에이드", emoji: "🍹", radius: 50, score: 750, color: "#72efd0" },
  { name: "프라페", emoji: "🍧", radius: 59, score: 1500, color: "#ff9fd1" },
  { name: "전설음료", emoji: "🏆", radius: 69, score: 3500, color: "#ffe66d" }
];

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreText = document.getElementById("scoreText");
const bestText = document.getElementById("bestText");
const nextDrinkText = document.getElementById("nextDrink");
const statusText = document.getElementById("statusText");
const restartBtn = document.getElementById("restartBtn");

let engine;
let world;

let drinks = new Set();
let effects = [];

let score = 0;
let bestScore = Number(localStorage.getItem("mergeDrinkBestScore") || 0);

let currentLevel = 0;
let nextLevel = 0;

let canShoot = true;
let gameOver = false;
let aimAngle = -Math.PI / 2;
let dangerSince = null;

let lastTime = performance.now();
let bodyId = 1;

init();

function init() {
  setupCanvas();
  setupMatter();
  bindEvents();
  resetGame();
  requestAnimationFrame(loop);
}

function setupCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  canvas.width = WIDTH * dpr;
  canvas.height = HEIGHT * dpr;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function setupMatter() {
  engine = Engine.create();
  world = engine.world;

engine.gravity.x = 0;

// 아래로 살짝 끌어내려서 계속 위험선 쪽으로 압박되게 함
// 0.10 = 약함 / 0.16 = 추천 / 0.22 = 꽤 어려움
engine.gravity.y = - 0.04;

  Events.on(engine, "collisionStart", handleCollisionStart);
}

function bindEvents() {
  restartBtn.addEventListener("click", resetGame);

  canvas.addEventListener("pointermove", (event) => {
    updateAimFromEvent(event);
  });

  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    updateAimFromEvent(event);
  });

  canvas.addEventListener("pointerup", (event) => {
    event.preventDefault();
    updateAimFromEvent(event);
    shoot();
  });

  window.addEventListener("resize", setupCanvas);
}

function resetGame() {
  Composite.clear(world, false);
  Engine.clear(engine);

  drinks.clear();
  effects = [];

  score = 0;
  gameOver = false;
  canShoot = true;
  dangerSince = null;

  currentLevel = getRandomLaunchLevel();
  nextLevel = getRandomLaunchLevel();

  createWalls();
  updateHud();

  statusText.textContent = "조준 후 클릭/터치로 발사";
}

function createWalls() {
  const wallOptions = {
    isStatic: true,
    label: "wall",
restitution: 0.12,
friction: 0.22,
frictionAir: 0.05 + level * 0.005,
density: 0.0025 + level * 0.0005,
  };

  const leftWall = Bodies.rectangle(-18, HEIGHT / 2, 36, HEIGHT + 120, wallOptions);
  const rightWall = Bodies.rectangle(WIDTH + 18, HEIGHT / 2, 36, HEIGHT + 120, wallOptions);
  const topWall = Bodies.rectangle(WIDTH / 2, -18, WIDTH + 60, 36, wallOptions);
  const bottomWall = Bodies.rectangle(WIDTH / 2, HEIGHT + 36, WIDTH + 60, 72, wallOptions);

  World.add(world, [leftWall, rightWall, topWall, bottomWall]);
}

function createDrink(x, y, level) {
  const drink = DRINKS[level];

  // 보이는 크기보다 충돌 판정을 살짝 크게 만들어 난도를 올림
  const hitRadius = drink.radius * HITBOX_SCALE;

  const body = Bodies.circle(x, y, hitRadius, {
    label: "drink",

    // 튕김 감소
    restitution: 0.18,

    // 서로 부딪혔을 때 미끄러짐 감소
    friction: 0.18,

    // 공중에서 빨리 안정되게 함
    frictionAir: 0.04 + level * 0.004,

    // 등급이 높을수록 더 묵직하게
    density: 0.0022 + level * 0.00045,

    slop: 0.01
  });

  body.drinkLevel = level;
  body.gameId = bodyId++;
  body.isMerging = false;
  body.spawnedAt = performance.now();

  drinks.add(body);
  World.add(world, body);

  return body;
}

function shoot() {
  if (gameOver || !canShoot) return;

  const level = currentLevel;
  const drink = DRINKS[level];

  const startX = CANNON.x + Math.cos(aimAngle) * (drink.radius + 16);
  const startY = CANNON.y + Math.sin(aimAngle) * (drink.radius + 16);

  const body = createDrink(startX, startY, level);

  Body.setVelocity(body, {
    x: Math.cos(aimAngle) * SHOT_POWER,
    y: Math.sin(aimAngle) * SHOT_POWER
  });

  Body.setAngularVelocity(body, 0.12 * Math.sign(Math.cos(aimAngle)));

  currentLevel = nextLevel;
  nextLevel = getRandomLaunchLevel();

  canShoot = false;
  updateHud();

  setTimeout(() => {
    if (!gameOver) canShoot = true;
  }, 620);
}

function getRandomLaunchLevel() {
  const roll = Math.random();

  if (score >= 5000) {
    if (roll < 0.45) return 0;
    if (roll < 0.78) return 1;
    if (roll < 0.95) return 2;
    return 3;
  }

  if (score >= 1800) {
    if (roll < 0.50) return 0;
    if (roll < 0.84) return 1;
    return 2;
  }

  if (roll < 0.58) return 0;
  if (roll < 0.90) return 1;
  return 2;
}

function handleCollisionStart(event) {
  if (gameOver) return;

  for (const pair of event.pairs) {
    const a = pair.bodyA;
    const b = pair.bodyB;

    if (a.label !== "drink" || b.label !== "drink") continue;
    if (!drinks.has(a) || !drinks.has(b)) continue;
    if (a.isMerging || b.isMerging) continue;
    if (a.drinkLevel !== b.drinkLevel) continue;

    const next = a.drinkLevel + 1;
    if (next >= DRINKS.length) continue;

    a.isMerging = true;
    b.isMerging = true;

    setTimeout(() => {
      mergeDrinks(a, b);
    }, 0);
  }
}

function mergeDrinks(a, b) {
  if (!drinks.has(a) || !drinks.has(b)) return;

  const nextLevel = a.drinkLevel + 1;
  if (nextLevel >= DRINKS.length) return;

  const x = (a.position.x + b.position.x) / 2;
  const y = (a.position.y + b.position.y) / 2;

  const vx = (a.velocity.x + b.velocity.x) * 0.22;
  const vy = (a.velocity.y + b.velocity.y) * 0.22;

  World.remove(world, a);
  World.remove(world, b);
  drinks.delete(a);
  drinks.delete(b);

  const merged = createDrink(x, y, nextLevel);

  Body.setVelocity(merged, {
    x: vx,
    y: vy
  });

  score += DRINKS[nextLevel].score;

  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem("mergeDrinkBestScore", String(bestScore));
  }

  effects.push({
    x,
    y,
    text: `+${DRINKS[nextLevel].score}`,
    life: 560,
    maxLife: 560
  });

  updateHud();
}

function updateAimFromEvent(event) {
  const point = getCanvasPoint(event);

  const dx = point.x - CANNON.x;
  const dy = point.y - CANNON.y;

  const minAngle = -Math.PI + 0.18;
  const maxAngle = -0.18;

  if (dy >= -6) {
    aimAngle = dx < 0 ? minAngle : maxAngle;
    return;
  }

  const rawAngle = Math.atan2(dy, dx);
  aimAngle = Math.max(minAngle, Math.min(maxAngle, rawAngle));
}

function getCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();

  return {
    x: ((event.clientX - rect.left) / rect.width) * WIDTH,
    y: ((event.clientY - rect.top) / rect.height) * HEIGHT
  };
}

function loop(now) {
  const delta = Math.min(now - lastTime, 1000 / 30);
  lastTime = now;

  if (!gameOver) {
    Engine.update(engine, delta);
    checkDanger(now);
  }

  updateEffects(delta);
  draw(now);

  requestAnimationFrame(loop);
}

function checkDanger(now) {
  let hasDanger = false;

  for (const body of drinks) {
    if (body.isMerging) continue;

    const drink = DRINKS[body.drinkLevel];
    const age = now - body.spawnedAt;
    const speed = Math.hypot(body.velocity.x, body.velocity.y);

    const isOldEnough = age > 1300;
    const isLowEnough = body.position.y + drink.radius > DANGER_Y;
    const isSlowEnough = speed < 1.4;

    if (isOldEnough && isLowEnough && isSlowEnough) {
      hasDanger = true;
      break;
    }
  }

  if (hasDanger) {
    if (!dangerSince) dangerSince = now;

    const passed = now - dangerSince;
    const remain = Math.max(0, Math.ceil((DANGER_LIMIT_MS - passed) / 1000));

    statusText.textContent = `위험! 발사선 근처 음료를 밀어내세요. ${remain}`;

    if (passed >= DANGER_LIMIT_MS) {
      endGame();
    }
  } else {
    dangerSince = null;
    if (!gameOver) {
      statusText.textContent = canShoot
        ? "조준 후 클릭/터치로 발사"
        : "다음 음료 준비 중";
    }
  }
}

function endGame() {
  gameOver = true;
  canShoot = false;
  statusText.textContent = "게임 오버! 새 게임을 눌러 다시 시작";
}

function updateEffects(delta) {
  for (const effect of effects) {
    effect.life -= delta;
    effect.y -= delta * 0.045;
  }

  effects = effects.filter((effect) => effect.life > 0);
}

function updateHud() {
  scoreText.textContent = String(score);
  bestText.textContent = String(bestScore);
  nextDrinkText.textContent = DRINKS[nextLevel].emoji;
}

function draw(now) {
  drawBackground();
  drawDangerLine(now);
  drawAimLine();
  drawDrinks();
  drawCannon();
  drawEffects();

  if (gameOver) {
    drawGameOver();
  }
}

function drawBackground() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, "#fff8df");
  gradient.addColorStop(1, "#ffd08a");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "rgba(255,255,255,0.42)";
  for (let y = 28; y < HEIGHT; y += 44) {
    ctx.beginPath();
    ctx.arc(32, y, 5, 0, Math.PI * 2);
    ctx.arc(WIDTH - 32, y + 20, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawDangerLine(now) {
  const blink = dangerSince ? 0.45 + Math.sin(now / 90) * 0.25 : 0.25;

  ctx.save();

  ctx.globalAlpha = blink;
  ctx.strokeStyle = "#e43625";
  ctx.lineWidth = 4;
  ctx.setLineDash([12, 10]);
  ctx.beginPath();
  ctx.moveTo(18, DANGER_Y);
  ctx.lineTo(WIDTH - 18, DANGER_Y);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#b62218";
  ctx.font = "800 13px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("위험선", WIDTH / 2, DANGER_Y - 8);

  ctx.restore();
}

function drawAimLine() {
  if (gameOver || !canShoot) return;

  const startX = CANNON.x;
  const startY = CANNON.y;

  const endX = startX + Math.cos(aimAngle) * 250;
  const endY = startY + Math.sin(aimAngle) * 250;

  ctx.save();

  ctx.strokeStyle = "rgba(88, 52, 24, 0.45)";
  ctx.lineWidth = 4;
  ctx.setLineDash([8, 10]);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.restore();
}

function drawCannon() {
  const level = currentLevel;
  const drink = DRINKS[level];

  ctx.save();

  ctx.translate(CANNON.x, CANNON.y);
  ctx.rotate(aimAngle + Math.PI / 2);

  ctx.fillStyle = "#7b4b27";
  ctx.beginPath();
  ctx.roundRect(-12, -52, 24, 58, 12);
  ctx.fill();

  ctx.fillStyle = "#b86c2f";
  ctx.beginPath();
  ctx.roundRect(-18, -34, 36, 44, 15);
  ctx.fill();

  ctx.restore();

  const previewX = CANNON.x + Math.cos(aimAngle) * 46;
  const previewY = CANNON.y + Math.sin(aimAngle) * 46;

  drawDrinkBubble(previewX, previewY, drink.radius, drink.color, drink.emoji, false);

  ctx.save();
  ctx.fillStyle = "#5b3419";
  ctx.beginPath();
  ctx.arc(CANNON.x, CANNON.y + 12, 26, Math.PI, 0);
  ctx.fill();

  ctx.fillStyle = "#f6b44f";
  ctx.beginPath();
  ctx.arc(CANNON.x, CANNON.y + 12, 17, Math.PI, 0);
  ctx.fill();

  ctx.restore();
}

function drawDrinks() {
  const sorted = Array.from(drinks).sort((a, b) => a.position.y - b.position.y);

  for (const body of sorted) {
    const drink = DRINKS[body.drinkLevel];

    drawDrinkBubble(
      body.position.x,
      body.position.y,
      drink.radius,
      drink.color,
      drink.emoji,
      true,
      body.angle
    );
  }
}

function drawDrinkBubble(x, y, radius, color, emoji, shadow, angle = 0) {
  ctx.save();

  ctx.translate(x, y);
  ctx.rotate(angle * 0.15);

  if (shadow) {
    ctx.shadowColor = "rgba(70, 38, 12, 0.23)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;
  }

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = "transparent";
  ctx.lineWidth = Math.max(3, radius * 0.09);
  ctx.strokeStyle = "rgba(87, 51, 25, 0.42)";
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.arc(-radius * 0.32, -radius * 0.34, radius * 0.22, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = `${Math.floor(radius * 1.08)}px "Apple Color Emoji", "Segoe UI Emoji", system-ui`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, 0, radius * 0.02);

  ctx.restore();
}

function drawEffects() {
  ctx.save();

  for (const effect of effects) {
    const alpha = Math.max(0, effect.life / effect.maxLife);

    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#b63e17";
    ctx.font = "900 22px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(effect.text, effect.x, effect.y);
  }

  ctx.restore();
}

function drawGameOver() {
  ctx.save();

  ctx.fillStyle = "rgba(38, 22, 10, 0.58)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "#fff8df";
  ctx.beginPath();
  ctx.roundRect(42, 238, WIDTH - 84, 162, 24);
  ctx.fill();

  ctx.strokeStyle = "#7b4b27";
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = "#2b1b10";
  ctx.textAlign = "center";

  ctx.font = "900 34px system-ui, sans-serif";
  ctx.fillText("게임 오버", WIDTH / 2, 292);

  ctx.font = "800 18px system-ui, sans-serif";
  ctx.fillText(`점수 ${score}`, WIDTH / 2, 330);

  ctx.font = "700 14px system-ui, sans-serif";
  ctx.fillText("새 게임 버튼으로 다시 시작", WIDTH / 2, 362);

  ctx.restore();
}
