const {
  Engine,
  World,
  Bodies,
  Body,
  Events,
  Composite,
  Constraint
} = Matter;

const WIDTH = 420;
const HEIGHT = 640;

const CANNON = {
  x: WIDTH / 2,
  y: HEIGHT - 44
};

const MIN_CEILING_Y = 48;
const START_CEILING_Y = 72;
const DANGER_Y = HEIGHT - 118;

const SHOT_POWER = 18.8;
const WALL_SPEED_KEEP = 0.92;

const BASE_RADIUS = 22;
const POP_COUNT = 6;

const CEILING_DROP_SPEED = 1.15; // px/sec
const CEILING_RISE_BASE = 18;
const CEILING_RISE_PER_EXTRA = 3;

const SPECIAL_CLEAR_COLOR_CHANCE = 0.03;
const SPECIAL_LINE_CHANCE = 0.05;

const BUBBLE_COLORS = [
  { key: "sky", name: "하늘", hue: 196, stroke: "rgba(61, 185, 255, 0.78)" },
  { key: "pink", name: "분홍", hue: 332, stroke: "rgba(255, 98, 177, 0.78)" },
  { key: "mint", name: "민트", hue: 154, stroke: "rgba(66, 230, 169, 0.78)" },
  { key: "violet", name: "보라", hue: 266, stroke: "rgba(166, 117, 255, 0.78)" },
  { key: "gold", name: "노랑", hue: 45, stroke: "rgba(255, 207, 73, 0.78)" }
];

const SPECIAL_ITEMS = {
  clearColor: {
    name: "동일색 제거",
    icon: "✦"
  },
  line: {
    name: "직선 제거",
    icon: "↯"
  }
};

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreText = document.getElementById("scoreText");
const bestText = document.getElementById("bestText");
const nextDrinkText = document.getElementById("nextDrink");
const statusText = document.getElementById("statusText");
const restartBtn = document.getElementById("restartBtn");

let engine;
let world;
let ceilingBody;

let bubbles = new Set();
let bonds = [];
let bondKeys = new Set();
let popEffects = [];
let laserEffects = [];

let score = 0;
let bestScore = Number(localStorage.getItem("soapBubbleBestScore") || 0);

let nextBubbleInfo = null;
let activeBubble = null;
let canShoot = true;
let gameOver = false;
let aimAngle = -Math.PI / 2;
let ceilingY = START_CEILING_Y;
let bodyId = 1;
let pendingGroupCheck = false;

let lastTime = performance.now();

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
  engine.gravity.y = 0;

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

  bubbles.clear();
  bonds = [];
  bondKeys.clear();
  popEffects = [];
  laserEffects = [];

  score = 0;
  gameOver = false;
  canShoot = true;
  activeBubble = null;
  pendingGroupCheck = false;
  ceilingY = START_CEILING_Y;

  createWalls();

  // seedInitialBubbles() 안에서 updateHud()가 호출될 수 있으므로
  // nextBubbleInfo를 먼저 만들어둬야 함
  nextBubbleInfo = createRandomBubbleInfo();

  seedInitialBubbles();

  updateHud();
  statusText.textContent = "조준 후 클릭/터치로 발사";
}

function createWalls() {
  const sideOptions = {
    isStatic: true,
    label: "side-wall",
    restitution: 1,
    friction: 0
  };

  const leftWall = Bodies.rectangle(-18, HEIGHT / 2, 36, HEIGHT + 140, {
    ...sideOptions,
    label: "wall-left"
  });

  const rightWall = Bodies.rectangle(WIDTH + 18, HEIGHT / 2, 36, HEIGHT + 140, {
    ...sideOptions,
    label: "wall-right"
  });

  ceilingBody = Bodies.rectangle(WIDTH / 2, ceilingY - 20, WIDTH + 80, 40, {
    isStatic: true,
    label: "wall-top",
    restitution: 0,
    friction: 1
  });

  World.add(world, [leftWall, rightWall, ceilingBody]);
}

function seedInitialBubbles() {
  const positions = [
    [82, ceilingY + 32, 0],
    [132, ceilingY + 34, 1],
    [184, ceilingY + 32, 2],
    [236, ceilingY + 35, 3],
    [288, ceilingY + 33, 4],
    [338, ceilingY + 34, 0],
    [108, ceilingY + 82, 1],
    [162, ceilingY + 86, 2],
    [216, ceilingY + 84, 3],
    [270, ceilingY + 86, 4],
    [324, ceilingY + 82, 0]
  ];

  for (const [x, y, colorIndex] of positions) {
    const body = createBubble(x, y, {
      colorIndex,
      item: null,
      isInitial: true
    });

    attachBubbleToCeiling(body);
  }

  recomputeAnchoredState();
  processColorGroups();
}

function createRandomBubbleInfo() {
  const colorIndex = Math.floor(Math.random() * BUBBLE_COLORS.length);
  const roll = Math.random();

  let item = null;
  if (roll < SPECIAL_CLEAR_COLOR_CHANCE) {
    item = "clearColor";
  } else if (roll < SPECIAL_CLEAR_COLOR_CHANCE + SPECIAL_LINE_CHANCE) {
    item = "line";
  }

  return {
    colorIndex,
    item
  };
}

function createBubble(x, y, info) {
  const body = Bodies.circle(x, y, BASE_RADIUS, {
    label: "bubble",
    restitution: 0,
    friction: 0.35,
    frictionAir: 0.032,
    density: 0.0024,
    slop: 0.01
  });

  body.gameId = bodyId++;
  body.colorIndex = info.colorIndex;
  body.item = info.item || null;
  body.isInitial = Boolean(info.isInitial);
  body.isAttached = false;
  body.isPopping = false;
  body.groupSize = 1;
  body.spawnedAt = performance.now();
  body.lastShotDir = { x: 0, y: -1 };

  bubbles.add(body);
  World.add(world, body);

  return body;
}

function shoot() {
  if (gameOver || !canShoot || activeBubble) return;

  const info = nextBubbleInfo;
  const startX = CANNON.x + Math.cos(aimAngle) * (BASE_RADIUS + 14);
  const startY = CANNON.y + Math.sin(aimAngle) * (BASE_RADIUS + 14);

  const body = createBubble(startX, startY, info);
  const dir = normalizeVector({
    x: Math.cos(aimAngle),
    y: Math.sin(aimAngle)
  });

  body.lastShotDir = dir;
  activeBubble = body;

  Body.setVelocity(body, {
    x: dir.x * SHOT_POWER,
    y: dir.y * SHOT_POWER
  });

  Body.setAngularVelocity(body, 0.04 * Math.sign(dir.x));

  nextBubbleInfo = createRandomBubbleInfo();
  canShoot = false;
  updateHud();
  statusText.textContent = "비눗방울 비행 중";
}

function handleCollisionStart(event) {
  if (gameOver) return;

  for (const pair of event.pairs) {
    const a = pair.bodyA;
    const b = pair.bodyB;

    const aIsBubble = a.label === "bubble";
    const bIsBubble = b.label === "bubble";
    const aIsWall = a.label && a.label.startsWith("wall-");
    const bIsWall = b.label && b.label.startsWith("wall-");

    if (aIsBubble && bIsWall) {
      handleBubbleWallContact(a, b);
      continue;
    }

    if (bIsBubble && aIsWall) {
      handleBubbleWallContact(b, a);
      continue;
    }

    if (aIsBubble && bIsBubble) {
      addBubbleBond(a, b);
      continue;
    }
  }
}

function handleBubbleWallContact(bubble, wall) {
  if (!bubbles.has(bubble) || bubble.isPopping) return;

  if (wall.label === "wall-left" || wall.label === "wall-right") {
    reflectBubbleFromSideWall(bubble, wall);
    return;
  }

  if (wall.label === "wall-top") {
    attachBubbleToCeiling(bubble);
  }
}

function reflectBubbleFromSideWall(bubble, wall) {
  const vx = bubble.velocity.x;
  const vy = bubble.velocity.y;

  let nextVx = vx;

  if (wall.label === "wall-left") {
    nextVx = Math.abs(vx);
  }

  if (wall.label === "wall-right") {
    nextVx = -Math.abs(vx);
  }

  const speed = Math.hypot(nextVx, vy);
  if (speed > 0.001) {
    bubble.lastShotDir = normalizeVector({ x: nextVx, y: vy });
  }

  Body.setVelocity(bubble, {
    x: nextVx * WALL_SPEED_KEEP,
    y: vy * WALL_SPEED_KEEP
  });
}

function attachBubbleToCeiling(bubble) {
  if (!bubbles.has(bubble) || bubble.isPopping) return;

  const key = `c:${bubble.gameId}`;
  if (bondKeys.has(key)) return;

  const anchorX = bubble.position.x - ceilingBody.position.x;
  const anchorY = 20;
  const length = Math.max(6, bubble.position.y - ceilingY);

  const constraint = Constraint.create({
    bodyA: ceilingBody,
    pointA: { x: anchorX, y: anchorY },
    bodyB: bubble,
    pointB: { x: 0, y: 0 },
    length,
    stiffness: 0.16,
    damping: 0.28,
    render: { visible: false }
  });

  bondKeys.add(key);
  bonds.push({
    key,
    type: "ceiling",
    a: null,
    b: bubble,
    constraint
  });

  World.add(world, constraint);
  onBubbleAttached(bubble);
}

function addBubbleBond(a, b) {
  if (!bubbles.has(a) || !bubbles.has(b)) return;
  if (a.isPopping || b.isPopping) return;

  const key = makeBondKey(a, b);
  if (bondKeys.has(key)) return;

  const dx = b.position.x - a.position.x;
  const dy = b.position.y - a.position.y;
  const distance = Math.max(10, Math.sqrt(dx * dx + dy * dy));

  const constraint = Constraint.create({
    bodyA: a,
    bodyB: b,
    length: distance,
    stiffness: 0.13,
    damping: 0.24,
    render: { visible: false }
  });

  bondKeys.add(key);
  bonds.push({
    key,
    type: "bubble",
    a,
    b,
    constraint
  });

  World.add(world, constraint);

  onBubbleAttached(a);
  onBubbleAttached(b);
}

function makeBondKey(a, b) {
  const first = Math.min(a.gameId, b.gameId);
  const second = Math.max(a.gameId, b.gameId);
  return `${first}:${second}`;
}

function onBubbleAttached(bubble) {
  recomputeAnchoredState();
  scheduleGroupCheck();

  if (bubble === activeBubble) {
    activeBubble = null;
    setTimeout(() => {
      if (!gameOver) {
        canShoot = true;
        statusText.textContent = "조준 후 클릭/터치로 발사";
      }
    }, 360);
  }
}

function scheduleGroupCheck() {
  if (pendingGroupCheck) return;

  pendingGroupCheck = true;
  setTimeout(() => {
    pendingGroupCheck = false;
    processColorGroups();
  }, 130);
}

function processColorGroups() {
  if (gameOver) return;

  const groups = findSameColorGroups();
  let poppedAny = false;

  for (const group of groups) {
    for (const bubble of group) {
      bubble.groupSize = group.length;
    }

    if (group.length >= POP_COUNT) {
      popGroup(group);
      poppedAny = true;
    }
  }

  if (!poppedAny) {
    updateHud();
  }
}

function findSameColorGroups() {
  const adjacency = new Map();

  for (const bubble of bubbles) {
    adjacency.set(bubble, []);
  }

  for (const bond of bonds) {
    if (bond.type !== "bubble") continue;
    if (!bubbles.has(bond.a) || !bubbles.has(bond.b)) continue;
    if (bond.a.colorIndex !== bond.b.colorIndex) continue;

    adjacency.get(bond.a).push(bond.b);
    adjacency.get(bond.b).push(bond.a);
  }

  const visited = new Set();
  const groups = [];

  for (const bubble of bubbles) {
    if (visited.has(bubble)) continue;

    const group = [];
    const stack = [bubble];
    visited.add(bubble);

    while (stack.length > 0) {
      const current = stack.pop();
      group.push(current);

      for (const next of adjacency.get(current) || []) {
        if (visited.has(next)) continue;
        visited.add(next);
        stack.push(next);
      }
    }

    groups.push(group);
  }

  return groups;
}

function popGroup(group) {
  const uniqueGroup = Array.from(new Set(group)).filter((bubble) => bubbles.has(bubble));
  if (uniqueGroup.length === 0) return;

  const specialBubbles = uniqueGroup.filter((bubble) => bubble.item);
  const baseColorIndex = uniqueGroup[0].colorIndex;
  const center = getBodiesCenter(uniqueGroup);
  const extraCount = Math.max(0, uniqueGroup.length - POP_COUNT);

  for (const bubble of uniqueGroup) {
    bubble.isPopping = true;
  }

  score += uniqueGroup.length * 80 + extraCount * 35;
  riseCeiling(CEILING_RISE_BASE + extraCount * CEILING_RISE_PER_EXTRA);

  addPopEffect(center.x, center.y, uniqueGroup.length);
  removeBubbles(uniqueGroup);

  for (const specialBubble of specialBubbles) {
    triggerSpecialBubble(specialBubble, baseColorIndex);
  }

  removeUnanchoredBubbles();
  recomputeAnchoredState();

  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem("soapBubbleBestScore", String(bestScore));
  }

  updateHud();
}

function triggerSpecialBubble(specialBubble, poppedColorIndex) {
  if (!specialBubble.item) return;

  if (specialBubble.item === "clearColor") {
    clearAllBubblesOfColor(poppedColorIndex);
  }

  if (specialBubble.item === "line") {
    clearBubblesOnLine(specialBubble.position, specialBubble.lastShotDir);
  }
}

function clearAllBubblesOfColor(colorIndex) {
  const targets = Array.from(bubbles).filter((bubble) => bubble.colorIndex === colorIndex);
  if (targets.length === 0) return;

  const center = getBodiesCenter(targets);

  score += targets.length * 55;
  addPopEffect(center.x, center.y, targets.length);
  removeBubbles(targets);
}

function clearBubblesOnLine(origin, direction) {
  const dir = normalizeVector(direction || { x: 0, y: -1 });
  const targets = [];
  const lineWidth = BASE_RADIUS * 0.95;

  for (const bubble of bubbles) {
    const dx = bubble.position.x - origin.x;
    const dy = bubble.position.y - origin.y;
    const cross = Math.abs(dx * dir.y - dy * dir.x);

    if (cross <= lineWidth + BASE_RADIUS * 0.35) {
      targets.push(bubble);
    }
  }

  if (targets.length === 0) return;

  score += targets.length * 65;
  laserEffects.push({
    x: origin.x,
    y: origin.y,
    dx: dir.x,
    dy: dir.y,
    life: 360,
    maxLife: 360
  });
  removeBubbles(targets);
}

function removeUnanchoredBubbles() {
  recomputeAnchoredState();

  const targets = Array.from(bubbles).filter((bubble) => !bubble.isAttached && bubble !== activeBubble);
  if (targets.length === 0) return;

  score += targets.length * 25;
  removeBubbles(targets);
}

function recomputeAnchoredState() {
  const adjacency = new Map();
  const roots = [];

  for (const bubble of bubbles) {
    bubble.isAttached = false;
    adjacency.set(bubble, []);
  }

  for (const bond of bonds) {
    if (bond.type === "ceiling" && bubbles.has(bond.b)) {
      roots.push(bond.b);
    }

    if (bond.type === "bubble" && bubbles.has(bond.a) && bubbles.has(bond.b)) {
      adjacency.get(bond.a).push(bond.b);
      adjacency.get(bond.b).push(bond.a);
    }
  }

  const stack = [...roots];

  for (const root of roots) {
    root.isAttached = true;
  }

  while (stack.length > 0) {
    const current = stack.pop();

    for (const next of adjacency.get(current) || []) {
      if (next.isAttached) continue;
      next.isAttached = true;
      stack.push(next);
    }
  }
}

function removeBubbles(list) {
  for (const bubble of Array.from(new Set(list))) {
    removeBubble(bubble);
  }
}

function removeBubble(bubble) {
  if (!bubble) return;

  const nextBonds = [];

  for (const bond of bonds) {
    const related = bond.b === bubble || bond.a === bubble;

    if (related) {
      bondKeys.delete(bond.key);
      World.remove(world, bond.constraint);
    } else {
      nextBonds.push(bond);
    }
  }

  bonds = nextBonds;

  if (activeBubble === bubble) {
    activeBubble = null;
    canShoot = true;
  }

  World.remove(world, bubble);
  bubbles.delete(bubble);
}

function riseCeiling(amount) {
  ceilingY = Math.max(MIN_CEILING_Y, ceilingY - amount);
  updateCeilingBody();
}

function updateCeilingBody() {
  if (!ceilingBody) return;

  Body.setPosition(ceilingBody, {
    x: WIDTH / 2,
    y: ceilingY - 20
  });
}

function lowerCeiling(delta) {
  ceilingY += CEILING_DROP_SPEED * (delta / 1000);
  updateCeilingBody();
}

function checkGameOver() {
  if (ceilingY >= DANGER_Y - 70) {
    endGame();
    return;
  }

  for (const bubble of bubbles) {
    if (bubble === activeBubble) continue;
    if (!bubble.isAttached) continue;

    if (bubble.position.y + BASE_RADIUS > DANGER_Y) {
      endGame();
      return;
    }
  }
}

function endGame() {
  gameOver = true;
  canShoot = false;
  activeBubble = null;
  statusText.textContent = "게임 오버! 새 게임을 눌러 다시 시작";
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
    lowerCeiling(delta);
    Engine.update(engine, delta);
    checkGameOver();
  }

  updateEffects(delta);
  draw(now);
  requestAnimationFrame(loop);
}

function updateEffects(delta) {
  for (const effect of popEffects) {
    effect.life -= delta;
    effect.y -= delta * 0.035;
  }

  popEffects = popEffects.filter((effect) => effect.life > 0);

  for (const effect of laserEffects) {
    effect.life -= delta;
  }

  laserEffects = laserEffects.filter((effect) => effect.life > 0);
}

function updateHud() {
  scoreText.textContent = String(score);
  bestText.textContent = String(bestScore);

  const color = BUBBLE_COLORS[nextBubbleInfo.colorIndex];
  nextDrinkText.textContent = nextBubbleInfo.item
    ? SPECIAL_ITEMS[nextBubbleInfo.item].icon
    : "●";
  nextDrinkText.style.color = `hsl(${color.hue}, 90%, 56%)`;
}

function draw(now) {
  drawBackground();
  drawCeiling(now);
  drawDangerLine(now);
  drawAimLine();
  drawBonds();
  drawBubbles(now);
  drawCannon(now);
  drawEffects();

  if (gameOver) {
    drawGameOver();
  }
}

function drawBackground() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, "#eaf9ff");
  gradient.addColorStop(0.55, "#fff8ef");
  gradient.addColorStop(1, "#ffcf9c");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "rgba(255,255,255,0.34)";
  for (let y = 24; y < HEIGHT; y += 48) {
    ctx.beginPath();
    ctx.arc(32, y, 5, 0, Math.PI * 2);
    ctx.arc(WIDTH - 36, y + 22, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCeiling(now) {
  ctx.save();

  const pulse = 0.55 + Math.sin(now / 480) * 0.12;

  ctx.fillStyle = "rgba(102, 69, 43, 0.88)";
  ctx.beginPath();
  ctx.roundRect(18, ceilingY - 22, WIDTH - 36, 20, 10);
  ctx.fill();

  ctx.strokeStyle = `rgba(255,255,255,${pulse})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(26, ceilingY);
  ctx.lineTo(WIDTH - 26, ceilingY);
  ctx.stroke();

  ctx.fillStyle = "rgba(77, 44, 24, 0.75)";
  ctx.font = "800 12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("하강 벽", WIDTH / 2, ceilingY - 28);

  ctx.restore();
}

function drawDangerLine(now) {
  const blink = 0.23 + Math.sin(now / 220) * 0.08;

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
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "#b62218";
  ctx.font = "800 12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("위험선", WIDTH / 2, DANGER_Y - 8);
  ctx.restore();
}

function drawAimLine() {
  if (gameOver || !canShoot || activeBubble) return;

  const startX = CANNON.x;
  const startY = CANNON.y;
  const endX = startX + Math.cos(aimAngle) * 255;
  const endY = startY + Math.sin(aimAngle) * 255;

  ctx.save();
  ctx.strokeStyle = "rgba(64, 86, 112, 0.42)";
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

function drawBonds() {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1;

  for (const bond of bonds) {
    if (bond.type !== "bubble") continue;
    if (!bubbles.has(bond.a) || !bubbles.has(bond.b)) continue;

    ctx.beginPath();
    ctx.moveTo(bond.a.position.x, bond.a.position.y);
    ctx.lineTo(bond.b.position.x, bond.b.position.y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawBubbles(now) {
  const sorted = Array.from(bubbles).sort((a, b) => a.position.y - b.position.y);

  for (const bubble of sorted) {
    drawSoapBubble(bubble, now);
  }
}

function drawSoapBubble(bubble, now) {
  const color = BUBBLE_COLORS[bubble.colorIndex];
  const groupSize = Math.max(1, bubble.groupSize || 1);
  const growthStep = Math.min(groupSize - 1, POP_COUNT - 1);
  const visualRadius = BASE_RADIUS * (1 + growthStep * 0.038);
  const borderWidth = Math.max(0.9, 4.2 - growthStep * 0.62);
  const wobbleSeed = bubble.gameId * 0.73;

  ctx.save();
  ctx.translate(bubble.position.x, bubble.position.y);
  ctx.rotate(bubble.angle * 0.08);

  drawWobblyBubbleShape(visualRadius, color, borderWidth, now, wobbleSeed);
  drawBubbleHighlights(visualRadius, now, wobbleSeed);

  if (bubble.item) {
    drawSpecialIcon(bubble.item, visualRadius, color);
  }

  ctx.restore();
}

function drawWobblyBubbleShape(radius, color, borderWidth, now, seed) {
  const time = now / 520;
  const points = 44;

  const fillGradient = ctx.createRadialGradient(
    -radius * 0.28,
    -radius * 0.35,
    radius * 0.12,
    0,
    0,
    radius * 1.08
  );

  fillGradient.addColorStop(0, "rgba(255,255,255,0.72)");
  fillGradient.addColorStop(0.38, `hsla(${color.hue}, 95%, 76%, 0.20)`);
  fillGradient.addColorStop(0.72, `hsla(${color.hue}, 96%, 62%, 0.24)`);
  fillGradient.addColorStop(1, `hsla(${color.hue + 35}, 95%, 74%, 0.42)`);

  ctx.beginPath();

  for (let i = 0; i <= points; i++) {
    const t = (i / points) * Math.PI * 2;
    const wobble =
      Math.sin(t * 3 + time + seed) * 0.9 +
      Math.cos(t * 5 - time * 0.7 + seed) * 0.45;
    const r = radius + wobble;
    const x = Math.cos(t) * r;
    const y = Math.sin(t) * r;

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.closePath();
  ctx.fillStyle = fillGradient;
  ctx.fill();

  ctx.lineWidth = borderWidth;
  ctx.strokeStyle = color.stroke;
  ctx.stroke();

  ctx.lineWidth = Math.max(0.8, borderWidth * 0.42);
  ctx.strokeStyle = "rgba(255,255,255,0.65)";
  ctx.stroke();

  ctx.save();
  ctx.globalAlpha = 0.34;
  ctx.strokeStyle = `hsla(${color.hue + 120}, 95%, 72%, 0.75)`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.82, -0.25 * Math.PI, 0.38 * Math.PI);
  ctx.stroke();
  ctx.restore();
}

function drawBubbleHighlights(radius, now, seed) {
  const shiftX = Math.sin(now / 700 + seed) * radius * 0.08;
  const shiftY = Math.cos(now / 760 + seed) * radius * 0.07;

  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.beginPath();
  ctx.ellipse(-radius * 0.34 + shiftX, -radius * 0.38 + shiftY, radius * 0.22, radius * 0.12, -0.55, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.46)";
  ctx.beginPath();
  ctx.arc(radius * 0.27 - shiftX * 0.5, -radius * 0.18, radius * 0.08, 0, Math.PI * 2);
  ctx.fill();
}

function drawSpecialIcon(item, radius, color) {
  const itemInfo = SPECIAL_ITEMS[item];
  if (!itemInfo) return;

  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.38, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `hsla(${color.hue}, 95%, 45%, 0.62)`;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = `hsla(${color.hue}, 95%, 36%, 0.92)`;
  ctx.font = `900 ${Math.floor(radius * 0.68)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(itemInfo.icon, 0, 1);
  ctx.restore();
}

function drawCannon(now) {
  const color = BUBBLE_COLORS[nextBubbleInfo.colorIndex];

  ctx.save();
  ctx.translate(CANNON.x, CANNON.y);
  ctx.rotate(aimAngle + Math.PI / 2);

  ctx.fillStyle = "#5c6f82";
  ctx.beginPath();
  ctx.roundRect(-11, -54, 22, 58, 12);
  ctx.fill();

  ctx.fillStyle = "#8fb2c9";
  ctx.beginPath();
  ctx.roundRect(-18, -34, 36, 44, 15);
  ctx.fill();

  ctx.restore();

  const previewX = CANNON.x + Math.cos(aimAngle) * 46;
  const previewY = CANNON.y + Math.sin(aimAngle) * 46;

  const previewBody = {
    position: { x: previewX, y: previewY },
    angle: 0,
    gameId: 9999,
    colorIndex: nextBubbleInfo.colorIndex,
    item: nextBubbleInfo.item,
    groupSize: 1
  };

  drawSoapBubble(previewBody, now);

  ctx.save();
  ctx.fillStyle = "#405166";
  ctx.beginPath();
  ctx.arc(CANNON.x, CANNON.y + 12, 26, Math.PI, 0);
  ctx.fill();

  ctx.fillStyle = "#c4edf8";
  ctx.beginPath();
  ctx.arc(CANNON.x, CANNON.y + 12, 17, Math.PI, 0);
  ctx.fill();
  ctx.restore();
}

function drawEffects() {
  ctx.save();

  for (const effect of laserEffects) {
    const alpha = Math.max(0, effect.life / effect.maxLife);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "rgba(255,255,255,0.92)";
    ctx.lineWidth = 14;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(effect.x - effect.dx * 900, effect.y - effect.dy * 900);
    ctx.lineTo(effect.x + effect.dx * 900, effect.y + effect.dy * 900);
    ctx.stroke();

    ctx.strokeStyle = "rgba(96,202,255,0.68)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(effect.x - effect.dx * 900, effect.y - effect.dy * 900);
    ctx.lineTo(effect.x + effect.dx * 900, effect.y + effect.dy * 900);
    ctx.stroke();
  }

  for (const effect of popEffects) {
    const alpha = Math.max(0, effect.life / effect.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#2d6a85";
    ctx.font = "900 21px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`POP x${effect.count}`, effect.x, effect.y);
  }

  ctx.restore();
}

function drawGameOver() {
  ctx.save();

  ctx.fillStyle = "rgba(22, 34, 48, 0.58)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "#f4fcff";
  ctx.beginPath();
  ctx.roundRect(42, 238, WIDTH - 84, 162, 24);
  ctx.fill();

  ctx.strokeStyle = "#4e7187";
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = "#193142";
  ctx.textAlign = "center";

  ctx.font = "900 34px system-ui, sans-serif";
  ctx.fillText("게임 오버", WIDTH / 2, 292);

  ctx.font = "800 18px system-ui, sans-serif";
  ctx.fillText(`점수 ${score}`, WIDTH / 2, 330);

  ctx.font = "700 14px system-ui, sans-serif";
  ctx.fillText("새 게임 버튼으로 다시 시작", WIDTH / 2, 362);

  ctx.restore();
}

function addPopEffect(x, y, count) {
  popEffects.push({
    x,
    y,
    count,
    life: 620,
    maxLife: 620
  });
}

function getBodiesCenter(list) {
  if (!list || list.length === 0) {
    return { x: WIDTH / 2, y: HEIGHT / 2 };
  }

  let x = 0;
  let y = 0;

  for (const body of list) {
    x += body.position.x;
    y += body.position.y;
  }

  return {
    x: x / list.length,
    y: y / list.length
  };
}

function normalizeVector(vector) {
  const length = Math.hypot(vector.x, vector.y);

  if (length <= 0.0001) {
    return { x: 0, y: -1 };
  }

  return {
    x: vector.x / length,
    y: vector.y / length
  };
}
