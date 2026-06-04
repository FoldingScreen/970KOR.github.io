const WIDTH = 420;
const HEIGHT = 640;

const CANNON = {
  x: WIDTH / 2,
  y: HEIGHT - 44
};

const SLOT_RADIUS = 13.5;
const VISUAL_RADIUS = 13.5;
const COLS = 13;
const ROWS = 17;
const COL_GAP = 30;
const ROW_GAP = 25.5;
const GRID_TOP = 82;
const GRID_LEFT = (WIDTH - (COLS - 1) * COL_GAP) / 2;

const SHOT_POWER = 18.5;
const WALL_SPEED_KEEP = 0.96;
const POP_COUNT = 4;

const START_TIME_MS = 180000;
const MAX_TIME_MS = 240000;
const POP_TIME_BONUS_BASE = 12000;
const POP_TIME_BONUS_PER_EXTRA = 1600;

const SPECIAL_CLEAR_COLOR_CHANCE = 0.03;
const SPECIAL_LINE_CHANCE = 0.05;

const WOBBLE_MAX = 1.55;
const WOBBLE_DECAY = 0.00125;

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

let grid = [];
let activeBubble = null;
let nextBubbleInfo = null;

let score = 0;
let bestScore = Number(localStorage.getItem("soapBubbleBestScore") || 0);

let timeLeftMs = START_TIME_MS;
let canShoot = true;
let gameOver = false;
let aimAngle = -Math.PI / 2;
let bubbleId = 1;

let popEffects = [];
let laserEffects = [];

let keys = {
  left: false,
  right: false,
  slow: false
};

let lastTime = performance.now();

init();

function init() {
  setupCanvas();
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

function bindEvents() {
  restartBtn.addEventListener("click", resetGame);

  window.addEventListener("keydown", (event) => {
    if (event.code === "ArrowLeft" || event.code === "KeyA") {
      keys.left = true;
      event.preventDefault();
    }

    if (event.code === "ArrowRight" || event.code === "KeyD") {
      keys.right = true;
      event.preventDefault();
    }

    if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
      keys.slow = true;
      event.preventDefault();
    }

    if (event.code === "Space" || event.code === "Enter") {
      event.preventDefault();
      shoot();
    }
  });

  window.addEventListener("keyup", (event) => {
    if (event.code === "ArrowLeft" || event.code === "KeyA") {
      keys.left = false;
      event.preventDefault();
    }

    if (event.code === "ArrowRight" || event.code === "KeyD") {
      keys.right = false;
      event.preventDefault();
    }

    if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
      keys.slow = false;
      event.preventDefault();
    }
  });

  window.addEventListener("resize", setupCanvas);
}

function resetGame() {
  grid = createEmptyGrid();

  activeBubble = null;
  nextBubbleInfo = createRandomBubbleInfo();

  score = 0;
  timeLeftMs = START_TIME_MS;
  canShoot = true;
  gameOver = false;
  bubbleId = 1;

  popEffects = [];
  laserEffects = [];

  seedInitialBubbles();
  updateAllGroupSizes();
  updateHud();

  statusText.textContent = "←/→ 조준, Space 발사";
}

function createEmptyGrid() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function seedInitialBubbles() {
  const initialRows = 5;

  for (let row = 0; row < initialRows; row++) {
    for (let col = 0; col < COLS; col++) {
      const skipEdge =
        row >= 3 &&
        (col === 0 || col === COLS - 1) &&
        Math.random() < 0.55;

      const skipRandom =
        row === 4 &&
        Math.random() < 0.28;

      if (skipEdge || skipRandom) continue;

      const colorIndex = pickInitialColor(row, col);

      grid[row][col] = createGridBubble({
        row,
        col,
        colorIndex,
        item: null
      });
    }
  }
}

function pickInitialColor(row, col) {
  const base = (row + col) % BUBBLE_COLORS.length;

  if (Math.random() < 0.72) {
    return base;
  }

  return Math.floor(Math.random() * BUBBLE_COLORS.length);
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

function createGridBubble({ row, col, colorIndex, item, lastShotDir }) {
  return {
    id: bubbleId++,
    row,
    col,
    colorIndex,
    item: item || null,
    groupSize: 1,
    wobblePower: 0,
    wobblePhase: 0,
    wobbleDir: { x: 0, y: -1 },
    lastShotDir: lastShotDir || { x: 0, y: -1 }
  };
}

function shoot() {
  if (gameOver || !canShoot || activeBubble) return;

  const dir = normalizeVector({
    x: Math.cos(aimAngle),
    y: Math.sin(aimAngle)
  });

  activeBubble = {
    id: bubbleId++,
    x: CANNON.x + dir.x * (SLOT_RADIUS + 14),
    y: CANNON.y + dir.y * (SLOT_RADIUS + 14),
    vx: dir.x * SHOT_POWER,
    vy: dir.y * SHOT_POWER,
    colorIndex: nextBubbleInfo.colorIndex,
    item: nextBubbleInfo.item,
    groupSize: 1,
    wobblePower: 0,
    wobblePhase: 0,
    wobbleDir: { x: 0, y: -1 },
    lastShotDir: dir
  };

  nextBubbleInfo = createRandomBubbleInfo();
  canShoot = false;

  updateHud();
  statusText.textContent = "비눗방울 비행 중";
}

function loop(now) {
  const delta = Math.min(now - lastTime, 1000 / 24);
  lastTime = now;

  if (!gameOver) {
    updateKeyboardAim(delta);
    updateTimeLimit(delta);
    updateActiveBubble(delta);
    updateWobbles(delta);
    checkGameOver();
  }

  updateEffects(delta);
  draw(now);

  requestAnimationFrame(loop);
}

function updateKeyboardAim(delta) {
  if (activeBubble) return;

  // 조준 감도
  // normalSpeed: 일반 회전 속도
  // slowSpeed: Shift 누른 상태 미세 조준 속도
  const normalSpeed = 0.0018;
  const slowSpeed = 0.00065;
  const speed = keys.slow ? slowSpeed : normalSpeed;

  const minAngle = -Math.PI + 0.18;
  const maxAngle = -0.18;

  if (keys.left) {
    aimAngle -= speed * delta;
  }

  if (keys.right) {
    aimAngle += speed * delta;
  }

  aimAngle = Math.max(minAngle, Math.min(maxAngle, aimAngle));
}

function updateTimeLimit(delta) {
  timeLeftMs = Math.max(0, timeLeftMs - delta);
}

function updateActiveBubble(delta) {
  if (!activeBubble) return;

  const speed = Math.hypot(activeBubble.vx, activeBubble.vy);
  const scaledMove = speed * (delta / 16.67);
  const steps = Math.max(1, Math.ceil(scaledMove / (SLOT_RADIUS * 0.75)));
  const stepScale = (delta / 16.67) / steps;

  for (let i = 0; i < steps; i++) {
    activeBubble.x += activeBubble.vx * stepScale;
    activeBubble.y += activeBubble.vy * stepScale;

    if (activeBubble.x - SLOT_RADIUS <= 0) {
      activeBubble.x = SLOT_RADIUS;
      activeBubble.vx = Math.abs(activeBubble.vx) * WALL_SPEED_KEEP;
      activeBubble.lastShotDir = normalizeVector({
        x: activeBubble.vx,
        y: activeBubble.vy
      });
    }

    if (activeBubble.x + SLOT_RADIUS >= WIDTH) {
      activeBubble.x = WIDTH - SLOT_RADIUS;
      activeBubble.vx = -Math.abs(activeBubble.vx) * WALL_SPEED_KEEP;
      activeBubble.lastShotDir = normalizeVector({
        x: activeBubble.vx,
        y: activeBubble.vy
      });
    }

    if (activeBubble.y <= GRID_TOP - SLOT_RADIUS * 0.2) {
      placeActiveBubble();
      return;
    }

    if (checkActiveCollisionWithGrid()) {
      placeActiveBubble();
      return;
    }
  }
}

function checkActiveCollisionWithGrid() {
  if (!activeBubble) return false;

  const threshold = SLOT_RADIUS * 2 - 1.2;

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const bubble = grid[row][col];
      if (!bubble) continue;

      const center = getSlotCenter(row, col);
      const dx = activeBubble.x - center.x;
      const dy = activeBubble.y - center.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= threshold) {
        activeBubble.wobblePower = WOBBLE_MAX;
        activeBubble.wobbleDir = normalizeVector({ x: dx, y: dy });
        return true;
      }
    }
  }

  return false;
}

function placeActiveBubble() {
  if (!activeBubble) return;

  const slot = findNearestOpenAttachableSlot(activeBubble.x, activeBubble.y);

  if (!slot) {
    endGame();
    return;
  }

  const bubble = createGridBubble({
    row: slot.row,
    col: slot.col,
    colorIndex: activeBubble.colorIndex,
    item: activeBubble.item,
    lastShotDir: activeBubble.lastShotDir
  });

  bubble.wobblePower = WOBBLE_MAX;
  bubble.wobbleDir = normalizeVector({
    x: activeBubble.vx,
    y: activeBubble.vy
  });

  grid[slot.row][slot.col] = bubble;
  activeBubble = null;

  const group = findSameColorGroup(slot.row, slot.col);
  updateAllGroupSizes();

  if (group.length >= POP_COUNT) {
    popGroup(group);
  } else {
    canShoot = true;
    statusText.textContent = "←/→ 조준, Space 발사";
  }

  updateHud();
}

function findNearestOpenAttachableSlot(x, y) {
  let best = null;
  let bestDist = Infinity;

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (grid[row][col]) continue;
      if (!isSlotAttachable(row, col)) continue;

      const center = getSlotCenter(row, col);
      const dx = center.x - x;
      const dy = center.y - y;
      const dist = Math.hypot(dx, dy);

      if (dist < bestDist) {
        bestDist = dist;
        best = { row, col };
      }
    }
  }

  return best;
}

function isSlotAttachable(row, col) {
  if (row === 0) return true;

  const neighbors = getNeighbors(row, col);

  return neighbors.some(([nr, nc]) => {
    return inBounds(nr, nc) && grid[nr][nc];
  });
}

function getSlotCenter(row, col) {
  const offset = row % 2 === 0 ? 0 : COL_GAP / 2;

  return {
    x: GRID_LEFT + col * COL_GAP + offset,
    y: GRID_TOP + row * ROW_GAP
  };
}

function getNeighbors(row, col) {
  if (row % 2 === 0) {
    return [
      [row, col - 1],
      [row, col + 1],
      [row - 1, col - 1],
      [row - 1, col],
      [row + 1, col - 1],
      [row + 1, col]
    ];
  }

  return [
    [row, col - 1],
    [row, col + 1],
    [row - 1, col],
    [row - 1, col + 1],
    [row + 1, col],
    [row + 1, col + 1]
  ];
}

function inBounds(row, col) {
  return row >= 0 && row < ROWS && col >= 0 && col < COLS;
}

function findSameColorGroup(startRow, startCol) {
  const start = grid[startRow]?.[startCol];
  if (!start) return [];

  const colorIndex = start.colorIndex;
  const visited = new Set();
  const stack = [[startRow, startCol]];
  const group = [];

  visited.add(`${startRow}:${startCol}`);

  while (stack.length > 0) {
    const [row, col] = stack.pop();
    const bubble = grid[row][col];

    if (!bubble || bubble.colorIndex !== colorIndex) continue;

    group.push({ row, col, bubble });

    for (const [nr, nc] of getNeighbors(row, col)) {
      if (!inBounds(nr, nc)) continue;
      if (visited.has(`${nr}:${nc}`)) continue;

      const next = grid[nr][nc];
      if (!next || next.colorIndex !== colorIndex) continue;

      visited.add(`${nr}:${nc}`);
      stack.push([nr, nc]);
    }
  }

  return group;
}

function updateAllGroupSizes() {
  const visited = new Set();

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const bubble = grid[row][col];
      if (!bubble) continue;
      if (visited.has(`${row}:${col}`)) continue;

      const group = findSameColorGroup(row, col);

      for (const item of group) {
        visited.add(`${item.row}:${item.col}`);
      }

      for (const item of group) {
        item.bubble.groupSize = group.length;
      }
    }
  }
}

function popGroup(group) {
  if (!group || group.length === 0) return;

  const unique = group.filter((item) => {
    return grid[item.row]?.[item.col] === item.bubble;
  });

  if (unique.length === 0) return;

  const specialBubbles = unique
    .map((item) => item.bubble)
    .filter((bubble) => bubble.item);

  const baseColorIndex = unique[0].bubble.colorIndex;
  const center = getGroupCenter(unique);
  const extraCount = Math.max(0, unique.length - POP_COUNT);

  for (const item of unique) {
    grid[item.row][item.col] = null;
  }

  score += unique.length * 80 + extraCount * 35;
  addTimeBonus(POP_TIME_BONUS_BASE + extraCount * POP_TIME_BONUS_PER_EXTRA);
  addPopEffect(center.x, center.y, unique.length);

  for (const bubble of specialBubbles) {
    triggerSpecialBubble(bubble, baseColorIndex, center);
  }

  updateAllGroupSizes();

  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem("soapBubbleBestScore", String(bestScore));
  }

  canShoot = true;
  statusText.textContent = "←/→ 조준, Space 발사";
  updateHud();
}

function triggerSpecialBubble(bubble, colorIndex, fallbackCenter) {
  if (!bubble.item) return;

  if (bubble.item === "clearColor") {
    clearAllBubblesOfColor(colorIndex);
  }

  if (bubble.item === "line") {
    clearBubblesOnLine(fallbackCenter, bubble.lastShotDir);
  }
}

function clearAllBubblesOfColor(colorIndex) {
  const targets = [];

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const bubble = grid[row][col];
      if (!bubble) continue;
      if (bubble.colorIndex !== colorIndex) continue;

      targets.push({ row, col, bubble });
    }
  }

  if (targets.length === 0) return;

  const center = getGroupCenter(targets);

  for (const item of targets) {
    grid[item.row][item.col] = null;
  }

  score += targets.length * 55;
  addPopEffect(center.x, center.y, targets.length);
  updateAllGroupSizes();
}

function clearBubblesOnLine(origin, direction) {
  const dir = normalizeVector(direction || { x: 0, y: -1 });
  const targets = [];
  const lineWidth = SLOT_RADIUS * 1.05;

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const bubble = grid[row][col];
      if (!bubble) continue;

      const center = getSlotCenter(row, col);
      const dx = center.x - origin.x;
      const dy = center.y - origin.y;
      const cross = Math.abs(dx * dir.y - dy * dir.x);

      if (cross <= lineWidth) {
        targets.push({ row, col, bubble });
      }
    }
  }

  if (targets.length === 0) return;

  for (const item of targets) {
    grid[item.row][item.col] = null;
  }

  score += targets.length * 65;

  laserEffects.push({
    x: origin.x,
    y: origin.y,
    dx: dir.x,
    dy: dir.y,
    life: 360,
    maxLife: 360
  });

  updateAllGroupSizes();
}

function getGroupCenter(group) {
  if (!group || group.length === 0) {
    return { x: WIDTH / 2, y: HEIGHT / 2 };
  }

  let x = 0;
  let y = 0;

  for (const item of group) {
    const center = getSlotCenter(item.row, item.col);
    x += center.x;
    y += center.y;
  }

  return {
    x: x / group.length,
    y: y / group.length
  };
}

function addTimeBonus(amount) {
  timeLeftMs = Math.min(MAX_TIME_MS, timeLeftMs + amount);

  popEffects.push({
    x: WIDTH / 2,
    y: 106,
    count: `+${(amount / 1000).toFixed(1)}s`,
    life: 620,
    maxLife: 620,
    isTimeBonus: true
  });
}

function checkGameOver() {
  if (timeLeftMs <= 0) {
    endGame();
    return;
  }

  for (let col = 0; col < COLS; col++) {
    if (grid[ROWS - 1][col]) {
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

function updateWobbles(delta) {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const bubble = grid[row][col];
      if (!bubble) continue;

      if (bubble.wobblePower > 0) {
        bubble.wobblePhase += delta * 0.024;
        bubble.wobblePower = Math.max(0, bubble.wobblePower - delta * WOBBLE_DECAY);
      }
    }
  }

  if (activeBubble && activeBubble.wobblePower > 0) {
    activeBubble.wobblePhase += delta * 0.024;
    activeBubble.wobblePower = Math.max(0, activeBubble.wobblePower - delta * WOBBLE_DECAY);
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

function draw(now) {
  drawBackground();
  drawTimeBar();
  drawSlotGuide();
  drawAimLine();
  drawGridBubbles(now);
  drawActiveBubble(now);
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

function drawSlotGuide() {
  ctx.save();

  ctx.fillStyle = "rgba(255,255,255,0.16)";

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (grid[row][col]) continue;

      const center = getSlotCenter(row, col);

      if (center.x < SLOT_RADIUS || center.x > WIDTH - SLOT_RADIUS) continue;

      ctx.beginPath();
      ctx.arc(center.x, center.y, 2.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

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

function drawGridBubbles(now) {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const bubble = grid[row][col];
      if (!bubble) continue;

      const center = getSlotCenter(row, col);
      drawSoapBubble(center.x, center.y, bubble, now);
    }
  }
}

function drawActiveBubble(now) {
  if (!activeBubble) return;

  drawSoapBubble(activeBubble.x, activeBubble.y, activeBubble, now);
}

function drawSoapBubble(x, y, bubble, now) {
  const color = BUBBLE_COLORS[bubble.colorIndex];
  const groupSize = Math.max(1, bubble.groupSize || 1);
  const growthStep = Math.min(groupSize - 1, POP_COUNT - 1);
  const visualRadius = VISUAL_RADIUS * (1 + growthStep * 0.042);
  const borderWidth = Math.max(0.8, 3.7 - growthStep * 0.72);
  const wobbleSeed = bubble.id * 0.73;

  ctx.save();
  ctx.translate(x, y);

  drawWobblyBubbleShape(visualRadius, color, borderWidth, now, wobbleSeed, bubble);
  drawBubbleHighlights(visualRadius, now, wobbleSeed, bubble);

  if (bubble.item) {
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

    const px2 = Math.cos(t) * r;
    const py2 = Math.sin(t) * r;

    if (i === 0) {
      ctx.moveTo(px2, py2);
    } else {
      ctx.lineTo(px2, py2);
    }
  }

  ctx.closePath();
  ctx.fillStyle = fillGradient;
  ctx.fill();

  ctx.lineWidth = borderWidth;
  ctx.strokeStyle = color.stroke;
  ctx.stroke();

  ctx.lineWidth = Math.max(0.7, borderWidth * 0.45);
  ctx.strokeStyle = "rgba(255,255,255,0.72)";
  ctx.stroke();

  ctx.save();
  ctx.globalAlpha = 0.42;
  ctx.strokeStyle = `hsla(${color.hue + 120}, 95%, 74%, 0.82)`;
  ctx.lineWidth = 1.2;
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
  ctx.arc(0, 0, radius * 0.42, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `hsla(${color.hue}, 95%, 45%, 0.62)`;
  ctx.lineWidth = 1.4;
  ctx.stroke();

  ctx.fillStyle = `hsla(${color.hue}, 95%, 36%, 0.92)`;
  ctx.font = `900 ${Math.floor(radius * 0.78)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(itemInfo.icon, 0, 1);

  ctx.restore();
}

function drawCannon(now) {
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

  const previewX = CANNON.x + Math.cos(aimAngle) * 43;
  const previewY = CANNON.y + Math.sin(aimAngle) * 43;

  const previewBubble = {
    id: 9999,
    colorIndex: nextBubbleInfo.colorIndex,
    item: nextBubbleInfo.item,
    groupSize: 1,
    wobblePower: 0,
    wobblePhase: 0,
    wobbleDir: { x: 0, y: -1 }
  };

  drawSoapBubble(previewX, previewY, previewBubble, now);

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
