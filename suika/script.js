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

const START_CEILING_Y = 72;

const SHOT_POWER = 18.8;
const WALL_SPEED_KEEP = 0.92;

const BASE_RADIUS = 22;
const POP_COUNT = 6;

// 제한시간 방식
const START_TIME_MS = 60000;
const MAX_TIME_MS = 90000;
const POP_TIME_BONUS_BASE = 4500;
const POP_TIME_BONUS_PER_EXTRA = 700;

const SPECIAL_CLEAR_COLOR_CHANCE = 0.03;
const SPECIAL_LINE_CHANCE = 0.05;

// 평소에는 원형, 충돌 순간에만 강하게 출렁임
const WOBBLE_MAX = 1.45;
const WOBBLE_DECAY = 0.00115;

// 접착 후 실제 물리 이동이 멎는 시간
const SETTLE_FREEZE_MS = 520;

// 고립 버블 부력
const FLOAT_UP_SPEED = 2.2;

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
let timeLeftMs = START_TIME_MS;
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
  timeLeftMs = START_TIME_MS;

  createWalls();

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
    settleBubble(body);
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
    friction: 0.62,
    frictionAir: 0.018,
    density: 0.0034,
    slop: 0.01
  });

  body.gameId = bodyId++;
  body.colorIndex = info.colorIndex;
  body.item = info.item || null;
  body.isInitial = Boolean(info.isInitial);
  body.isAttached = false;
  body.isPopping = false;
  body.isFloating = false;
  body.isSettled = false;
  body.groupSize = 1;
  body.spawnedAt = performance.now();
  body.lastShotDir = { x: 0, y: -1 };

  body.wobblePower = 0;
  body.wobblePhase = 0;
  body.wobbleDir = { x: 0, y: -1 };
  body.settleTimer = null;

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
    const normal = wall.label === "wall-left"
      ? { x: 1, y: 0 }
      : { x: -1, y: 0 };

    applyBubbleImpact(bubble, normal, Math.hypot(bubble.velocity.x, bubble.velocity.y));
    reflectBubbleFromSideWall(bubble, wall);
    return;
  }

  if (wall.label === "wall-top") {
    stopFloatingBubble(bubble);
    applyBubbleImpact(bubble, { x: 0, y: 1 }, Math.hypot(bubble.velocity.x, bubble.velocity.y));
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

  stopFloatingBubble(bubble);

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
    stiffness: 0.72,
    damping: 0.92,
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

  stopFloatingBubble(a);
  stopFloatingBubble(b);

  const key = makeBondKey(a, b);
  if (bondKeys.has(key)) return;

  const dx = b.position.x - a.position.x;
  const dy = b.position.y - a.position.y;
  const distance = Math.max(10, Math.sqrt(dx * dx + dy * dy));
  const normal = normalizeVector({ x: dx, y: dy });
  const relativeSpeed = Math.hypot(a.velocity.x - b.velocity.x, a.velocity.y - b.velocity.y);

  applyBubbleImpact(a, { x: normal.x, y: normal.y }, relativeSpeed);
  applyBubbleImpact(b, { x: -normal.x, y: -normal.y }, relativeSpeed);

  const constraint = Constraint.create({
    bodyA: a,
    bodyB: b,
    length: distance,
    stiffness: 0.68,
    damping: 0.9,
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

function applyBubbleImpact(bubble, direction, speed) {
  if (!bubble || bubble.isPopping) return;

  const dir = normalizeVector(direction);
  const powerBySpeed = Math.min(WOBBLE_MAX, Math.max(0.42, speed / 13));

  bubble.wobblePower = Math.min(WOBBLE_MAX, Math.max(bubble.wobblePower || 0, powerBySpeed));
  bubble.wobblePhase = 0;
  bubble.wobbleDir = dir;
}

function makeBondKey(a, b) {
  const first = Math.min(a.gameId, b.gameId);
  const second = Math.max(a.gameId, b.gameId);
  return `${first}:${second}`;
}

function onBubbleAttached(bubble) {
  if (!bubble || bubble.isFloating) return;

  bubble.frictionAir = 0.34;
  bubble.restitution = 0;

  if (!bubble.isSettled) {
    Body.setStatic(bubble, false);

    Body.setVelocity(bubble, {
      x: bubble.velocity.x * 0.24,
      y: bubble.velocity.y * 0.24
    });

    Body.setAngularVelocity(bubble, bubble.angularVelocity * 0.18);

    scheduleBubbleSettle(bubble);
  }

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

function scheduleBubbleSettle(bubble) {
  if (!bubble || bubble.isSettled || bubble.isFloating) return;

  if (bubble.settleTimer) {
    clearTimeout(bubble.settleTimer);
  }

  bubble.settleTimer = setTimeout(() => {
    if (!bubbles.has(bubble)) return;
    if (bubble.isFloating || bubble.isPopping) return;
    if (bubble === activeBubble) return;

    settleBubble(bubble);
  }, SETTLE_FREEZE_MS);
}

function settleBubble(bubble) {
  if (!bubble || !bubbles.has(bubble)) return;
  if (bubble.isFloating || bubble.isPopping) return;

  Body.setVelocity(bubble, { x: 0, y: 0 });
  Body.setAngularVelocity(bubble, 0);
  Body.setStatic(bubble, true);

  bubble.isSettled = true;
  bubble.frictionAir = 1;
}

function unSettleBubble(bubble) {
  if (!bubble || !bubbles.has(bubble)) return;

  if (bubble.settleTimer) {
    clearTimeout(bubble.settleTimer);
    bubble.settleTimer = null;
  }

  if (bubble.isSettled) {
    Body.setStatic(bubble, false);
  }

  bubble.isSettled = false;
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
    if (bubble.isFloating || bubble.isPopping) continue;
    adjacency.set(bubble, []);
  }

  for (const bond of bonds) {
    if (bond.type !== "bubble") continue;
    if (!bubbles.has(bond.a) || !bubbles.has(bond.b)) continue;
    if (bond.a.isFloating || bond.b.isFloating) continue;
    if (bond.a.colorIndex !== bond.b.colorIndex) continue;

    if (!adjacency.has(bond.a)) adjacency.set(bond.a, []);
    if (!adjacency.has(bond.b)) adjacency.set(bond.b, []);

    adjacency.get(bond.a).push(bond.b);
    adjacency.get(bond.b).push(bond.a);
  }

  const visited = new Set();
  const groups = [];

  for (const bubble of adjacency.keys()) {
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
  addTimeBonus(POP_TIME_BONUS_BASE + extraCount * POP_TIME_BONUS_PER_EXTRA);

  addPopEffect(center.x, center.y, uniqueGroup.length);
  removeBubbles(uniqueGroup);

  for (const specialBubble of specialBubbles) {
    triggerSpecialBubble(specialBubble, baseColorIndex);
  }

  floatUnanchoredBubbles();
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
  const targets = Array.from(bubbles).filter((bubble) => bubble.colorIndex === colorIndex && !bubble.isFloating);
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
    if (bubble.isFloating) continue;

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

function floatUnanchoredBubbles() {
  recomputeAnchoredState();

  const targets = Array.from(bubbles).filter((bubble) => {
    if (bubble === activeBubble) return false;
    if (bubble.isFloating || bubble.isPopping) return false;
    return !bubble.isAttached;
  });

  for (const bubble of targets) {
    startFloatingBubble(bubble);
  }
}

function startFloatingBubble(bubble) {
  if (!bubble || !bubbles.has(bubble)) return;

  removeBondsForBubble(bubble);
  unSettleBubble(bubble);

  bubble.isFloating = true;
  bubble.isAttached = false;
  bubble.groupSize = 1;
  bubble.frictionAir = 0.018;
  bubble.collisionFilter.mask = 0xFFFFFFFF;

  Body.setVelocity(bubble, {
    x: (Math.random() - 0.5) * 0.55,
    y: -FLOAT_UP_SPEED - Math.random() * 0.6
  });

  Body.setAngularVelocity(bubble, (Math.random() - 0.5) * 0.018);
}

function stopFloatingBubble(bubble) {
  if (!bubble || !bubbles.has(bubble)) return;
  if (!bubble.isFloating) return;

  bubble.isFloating = false;
  bubble.frictionAir = 0.34;
  bubble.collisionFilter.mask = 0xFFFFFFFF;

  Body.setVelocity(bubble, {
    x: bubble.velocity.x * 0.28,
    y: bubble.velocity.y * 0.28
  });

  scheduleBubbleSettle(bubble);
}

function recomputeAnchoredState() {
  const adjacency = new Map();
  const roots = [];

  for (const bubble of bubbles) {
    bubble.isAttached = false;

    if (!bubble.isFloating && !bubble.isPopping) {
      adjacency.set(bubble, []);
    }
  }

  for (const bond of bonds) {
    if (bond.type === "ceiling" && bubbles.has(bond.b) && !bond.b.isFloating) {
      roots.push(bond.b);
    }

    if (
      bond.type === "bubble" &&
      bubbles.has(bond.a) &&
      bubbles.has(bond.b) &&
      !bond.a.isFloating &&
      !bond.b.isFloating
    ) {
      if (!adjacency.has(bond.a)) adjacency.set(bond.a, []);
      if (!adjacency.has(bond.b)) adjacency.set(bond.b, []);

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

function removeBondsForBubble(bubble) {
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
}

function removeBubble(bubble) {
  if (!bubble) return;

  if (bubble.settleTimer) {
    clearTimeout(bubble.settleTimer);
    bubble.settleTimer = null;
  }

  removeBondsForBubble(bubble);
  unSettleBubble(bubble);

  if (activeBubble === bubble) {
    activeBubble = null;
    canShoot = true;
  }

  World.remove(world, bubble);
  bubbles.delete(bubble);
}

function updateTimeLimit(delta) {
  timeLeftMs = Math.max(0, timeLeftMs - delta);
}

function addTimeBonus(amount) {
  timeLeftMs = Math.min(MAX_TIME_MS, timeLeftMs + amount);

  popEffects.push({
    x: WIDTH / 2,
    y: 104,
    count: `+${(amount / 1000).toFixed(1)}s`,
    life: 620,
    maxLife: 620,
    isTimeBonus: true
  });
}

function checkGameOver() {
  if (timeLeftMs <= 0) {
    endGame();
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
    updateTimeLimit(delta);
    Engine.update(engine, delta);
    updateBubbleDynamics(delta);
    checkGameOver();
  }

  updateEffects(delta);
  draw(now);
  requestAnimationFrame(loop);
}

function updateBubbleDynamics(delta) {
  for (const bubble of Array.from(bubbles)) {
    if (!bubble) continue;

    if (bubble.wobblePower > 0) {
      bubble.wobblePhase += delta * 0.024;
      bubble.wobblePower = Math.max(0, bubble.wobblePower - delta * WOBBLE_DECAY);
    }

    if (bubble.isAttached && !bubble.isFloating && !bubble.isSettled && bubble !== activeBubble) {
      Body.setVelocity(bubble, {
        x: bubble.velocity.x * 0.86,
        y: bubble.velocity.y * 0.86
      });

      Body.setAngularVelocity(bubble, bubble.angularVelocity * 0.82);

      const speed = Math.hypot(bubble.velocity.x, bubble.velocity.y);
      if (speed < 0.035) {
        settleBubble(bubble);
      }
    }

    if (bubble.isFloating) {
      Body.setVelocity(bubble, {
        x: bubble.velocity.x * 0.996,
        y: Math.max(bubble.velocity.y - 0.012, -3.35)
      });

      if (bubble.position.y < ceilingY + BASE_RADIUS + 4) {
        Body.setPosition(bubble, {
          x: bubble.position.x,
          y: ceilingY + BASE_RADIUS + 4
        });

        Body.setVelocity(bubble, {
          x: bubble.velocity.x * 0.25,
          y: 0
        });

        stopFloatingBubble(bubble);
        attachBubbleToCeiling(bubble);
      }
    }
  }
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
  drawTimeBar();
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
  ctx.fillText("접착 벽", WIDTH / 2, ceilingY - 28);

  ctx.restore();
}

function drawTimeBar() {
  const ratio = Math.max(0, Math.min(1, timeLeftMs / MAX_TIME_MS));
  const seconds = Math.ceil(timeLeftMs / 1000);

  const barX = 28;
  const barY = 24;
  const barW = WIDTH - 56;
  const barH = 15;

  ctx.save();

  ctx.fillStyle = "rgba(255,255,255,0.58)";
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, 999);
  ctx.fill();

  const gradient = ctx.createLinearGradient(barX, barY, barX + barW, barY);
  gradient.addColorStop(0, "#76e7ff");
  gradient.addColorStop(0.5, "#b7ffcf");
  gradient.addColorStop(1, "#ffe27a");

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW * ratio, barH, 999);
  ctx.fill();

  ctx.strokeStyle = "rgba(54, 80, 97, 0.45)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, 999);
  ctx.stroke();

  ctx.fillStyle = "#284253";
  ctx.font = "900 12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${seconds}s`, WIDTH / 2, barY + barH / 2 + 0.5);

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
    if (bond.a.isFloating || bond.b.isFloating) continue;

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
  const floatAlpha = bubble.isFloating ? 0.82 : 1;

  ctx.save();
  ctx.globalAlpha = floatAlpha;
  ctx.translate(bubble.position.x, bubble.position.y);
  ctx.rotate(bubble.angle * 0.08);

  drawWobblyBubbleShape(visualRadius, color, borderWidth, now, wobbleSeed, bubble);
  drawBubbleHighlights(visualRadius, now, wobbleSeed, bubble);

  if (bubble.item && !bubble.isFloating) {
    drawSpecialIcon(bubble.item, visualRadius, color);
  }

  ctx.restore();
}

function drawWobblyBubbleShape(radius, color, borderWidth, now, seed, bubble) {
  const points = 64;
  const power = Math.max(0, bubble.wobblePower || 0);
  const phase = bubble.wobblePhase || 0;
  const dir = normalizeVector(bubble.wobbleDir || { x: 0, y: -1 });

  const fillGradient = ctx.createRadialGradient(
    -radius * 0.28,
    -radius * 0.35,
    radius * 0.12,
    0,
    0,
    radius * 1.1
  );

  fillGradient.addColorStop(0, "rgba(255,255,255,0.78)");
  fillGradient.addColorStop(0.28, `hsla(${color.hue}, 96%, 82%, 0.18)`);
  fillGradient.addColorStop(0.58, `hsla(${color.hue + 80}, 96%, 75%, 0.16)`);
  fillGradient.addColorStop(0.78, `hsla(${color.hue}, 96%, 62%, 0.25)`);
  fillGradient.addColorStop(1, `hsla(${color.hue + 35}, 95%, 72%, 0.44)`);

  ctx.beginPath();

  for (let i = 0; i <= points; i++) {
    const t = (i / points) * Math.PI * 2;
    const px = Math.cos(t);
    const py = Math.sin(t);

    let r = radius;

    if (power > 0.001) {
      const dot = px * dir.x + py * dir.y;
      const side = 1 - dot * dot;

      const squash = -radius * 0.28 * power * dot * dot;
      const sideBulge = radius * 0.22 * power * side;
      const ripple =
        radius * 0.06 * power * Math.sin(t * 4 - phase * 2.2 + seed) +
        radius * 0.035 * power * Math.sin(t * 7 + phase * 1.4 + seed);

      r = radius + squash + sideBulge + ripple;
    }

    const x = px * r;
    const y = py * r;

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

  ctx.lineWidth = Math.max(0.8, borderWidth * 0.45);
  ctx.strokeStyle = "rgba(255,255,255,0.72)";
  ctx.stroke();

  ctx.save();
  ctx.globalAlpha = 0.42;
  ctx.strokeStyle = `hsla(${color.hue + 120}, 95%, 74%, 0.82)`;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.82, -0.25 * Math.PI, 0.38 * Math.PI);
  ctx.stroke();

  ctx.strokeStyle = `hsla(${color.hue - 95}, 95%, 78%, 0.52)`;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.72, 0.62 * Math.PI, 1.05 * Math.PI);
  ctx.stroke();
  ctx.restore();
}

function drawBubbleHighlights(radius, now, seed, bubble) {
  const power = Math.max(0, bubble.wobblePower || 0);
  const extra = power * radius * 0.1;

  const shiftX = Math.sin(now / 700 + seed) * radius * 0.06;
  const shiftY = Math.cos(now / 760 + seed) * radius * 0.05;

  ctx.fillStyle = "rgba(255,255,255,0.76)";
  ctx.beginPath();
  ctx.ellipse(
    -radius * 0.34 + shiftX,
    -radius * 0.38 + shiftY,
    radius * 0.23 + extra,
    radius * 0.12,
    -0.55,
    0,
    Math.PI * 2
  );
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.beginPath();
  ctx.arc(radius * 0.27 - shiftX * 0.5, -radius * 0.18, radius * 0.08 + extra * 0.25, 0, Math.PI * 2);
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
    groupSize: 1,
    wobblePower: 0,
    wobblePhase: 0,
    wobbleDir: { x: 0, y: -1 },
    isFloating: false
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
    ctx.fillStyle = effect.isTimeBonus ? "#14925b" : "#2d6a85";
    ctx.font = "900 21px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(effect.isTimeBonus ? effect.count : `POP x${effect.count}`, effect.x, effect.y);
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
    maxLife: 620,
    isTimeBonus: false
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
