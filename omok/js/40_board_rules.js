// 40_board_rules.js
// 분리본: 기존 omok.js를 기능별로 나눈 파일입니다.

function drawBoard() {
  const board = room?.board || emptyBoard();
  const w = canvas.width;
  const h = canvas.height;
  const pad = 44;
  const cell = (w - pad * 2) / (SIZE - 1);

  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, "#d8a35d");
  grad.addColorStop(0.5, "#b77935");
  grad.addColorStop(1, "#8b5a2b");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(45,26,10,.78)";
  ctx.lineWidth = 1.4;
  for (let i = 0; i < SIZE; i++) {
    const p = pad + i * cell;
    ctx.beginPath();
    ctx.moveTo(pad, p);
    ctx.lineTo(w - pad, p);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p, pad);
    ctx.lineTo(p, h - pad);
    ctx.stroke();
  }

  const stars = [3, 7, 11];
  ctx.fillStyle = "rgba(45,26,10,.85)";
  for (const r of stars) for (const c of stars) {
    const x = pad + c * cell;
    const y = pad + r * cell;
    ctx.beginPath();
    ctx.arc(x, y, 4.3, 0, Math.PI * 2);
    ctx.fill();
  }

  const forbidden = getForbiddenPreviewCells();
  for (const key of forbidden) {
    const [r, c] = key.split("-").map(Number);
    drawForbiddenMark(pad + c * cell, pad + r * cell, cell);
  }

  for (let i = 0; i < board.length; i++) {
    if (!board[i]) continue;
    drawStone(pad + colOf(i) * cell, pad + rowOf(i) * cell, cell * 0.42, board[i]);
  }

  if (room?.lastMove) drawLastMove(pad + room.lastMove.col * cell, pad + room.lastMove.row * cell, cell);
  if (room?.winLine?.length) {
    for (const p of room.winLine) drawWinRing(pad + p.col * cell, pad + p.row * cell, cell);
  }

  const preview = selectedCell || hoverCell;
  if (preview && room?.status === "playing" && isMyTurn()) {
    const result = canPlaceAt(preview.row, preview.col);
    const x = pad + preview.col * cell;
    const y = pad + preview.row * cell;
    if (result.ok) drawPreviewStone(x, y, cell * 0.42, room.turn);
    else drawForbiddenMark(x, y, cell);
  }
}
function drawStone(x, y, r, color) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.45)";
  ctx.shadowBlur = 9;
  ctx.shadowOffsetY = 4;
  const g = ctx.createRadialGradient(x - r * .35, y - r * .45, r * .15, x, y, r);
  if (color === "black") {
    g.addColorStop(0, "#64748b");
    g.addColorStop(.28, "#1e293b");
    g.addColorStop(1, "#020617");
  } else {
    g.addColorStop(0, "#fff");
    g.addColorStop(.55, "#e5e7eb");
    g.addColorStop(1, "#94a3b8");
  }
  ctx.beginPath();
  ctx.fillStyle = g;
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
function drawPreviewStone(x, y, r, color) {
  ctx.save();
  ctx.globalAlpha = .45;
  drawStone(x, y, r, color);
  ctx.restore();
  ctx.beginPath();
  ctx.strokeStyle = "#fde68a";
  ctx.lineWidth = 3;
  ctx.arc(x, y, r + 6, 0, Math.PI * 2);
  ctx.stroke();
}
function drawLastMove(x, y, cell) {
  ctx.beginPath();
  ctx.strokeStyle = "#facc15";
  ctx.lineWidth = 3;
  ctx.arc(x, y, cell * .22, 0, Math.PI * 2);
  ctx.stroke();
}
function drawWinRing(x, y, cell) {
  ctx.beginPath();
  ctx.strokeStyle = "#fde047";
  ctx.lineWidth = 5;
  ctx.arc(x, y, cell * .48, 0, Math.PI * 2);
  ctx.stroke();
}
function drawForbiddenMark(x, y, cell) {
  const r = cell * .28;
  ctx.save();
  ctx.strokeStyle = "rgba(239,68,68,.9)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x - r, y - r);
  ctx.lineTo(x + r, y + r);
  ctx.moveTo(x + r, y - r);
  ctx.lineTo(x - r, y + r);
  ctx.stroke();
  ctx.restore();
}
function cellFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);
  const pad = 44;
  const cell = (canvas.width - pad * 2) / (SIZE - 1);
  const col = Math.round((x - pad) / cell);
  const row = Math.round((y - pad) / cell);
  if (!inside(row, col)) return null;
  const px = pad + col * cell;
  const py = pad + row * cell;
  if (Math.hypot(x - px, y - py) > cell * .56) return null;
  return { row, col };
}
function isMobileInput() {
  return window.matchMedia("(hover: none), (pointer: coarse)").matches;
}

function getForbiddenPreviewCells() {
  const out = new Set();
  if (!room || room.status !== "playing" || !isMyTurn()) return out;
  const board = room.board || emptyBoard();
  for (let i = 0; i < board.length; i++) {
    if (board[i]) continue;
    const r = rowOf(i), c = colOf(i);
    if (isDoubleThree(board, r, c, room.turn)) out.add(`${r}-${c}`);
  }
  return out;
}
function canPlaceAt(row, col) {
  if (!room || room.status !== "playing") return { ok: false, reason: "대국 중이 아닙니다" };
  if (!isMyTurn()) return { ok: false, reason: "내 차례가 아닙니다" };
  if (!inside(row, col)) return { ok: false, reason: "판 밖입니다" };
  const board = room.board || emptyBoard();
  if (board[idx(row, col)]) return { ok: false, reason: "이미 돌이 있습니다" };
  if (isDoubleThree(board, row, col, room.turn)) return { ok: false, reason: "33 금지" };
  return { ok: true, reason: "" };
}
function countDir(board, row, col, color, dr, dc) {
  const line = [{ row, col }];
  let r = row + dr, c = col + dc;
  while (inside(r, c) && board[idx(r, c)] === color) {
    line.push({ row: r, col: c });
    r += dr; c += dc;
  }
  r = row - dr; c = col - dc;
  while (inside(r, c) && board[idx(r, c)] === color) {
    line.unshift({ row: r, col: c });
    r -= dr; c -= dc;
  }
  return line;
}
function checkWin(board, row, col, color) {
  const dirs = [[1,0],[0,1],[1,1],[1,-1]];
  for (const [dr, dc] of dirs) {
    const line = countDir(board, row, col, color, dr, dc);
    if (line.length >= 5) {
      const centerIndex = line.findIndex(p => p.row === row && p.col === col);
      const start = Math.max(0, Math.min(centerIndex - 2, line.length - 5));
      return { win: true, line: line.slice(start, start + 5) };
    }
  }
  return { win: false, line: [] };
}
function isDoubleThree(board, row, col, color) {
  if (board[idx(row, col)]) return false;
  const test = [...board];
  test[idx(row, col)] = color;
  if (checkWin(test, row, col, color).win) return false;
  const dirs = [[1,0],[0,1],[1,1],[1,-1]];
  let openThrees = 0;
  for (const [dr, dc] of dirs) {
    if (hasOpenThree(test, row, col, color, dr, dc)) openThrees++;
  }
  return openThrees >= 2;
}
function hasOpenThree(board, row, col, color, dr, dc) {
  const cells = [];
  const center = 4;

  for (let k = -4; k <= 4; k++) {
    const r = row + dr * k;
    const c = col + dc * k;

    if (!inside(r, c)) {
      cells.push("O");
    } else {
      const v = board[idx(r, c)];
      cells.push(v === color ? "X" : v ? "O" : ".");
    }
  }

  // 중요:
  // 같은 방향에 이미 4목 계열이 만들어진 경우에는
  // 그 줄은 3으로 세면 안 됨.
  // 즉, 43은 허용하고 33만 금지해야 함.
  if (hasFourThreatInLine(cells, center)) {
    return false;
  }

  const patterns = [".XXX.", ".XX.X.", ".X.XX."];

  for (const p of patterns) {
    for (let start = 0; start <= cells.length - p.length; start++) {
      if (center < start || center >= start + p.length) continue;

      const seg = cells.slice(start, start + p.length).join("");

      if (seg === p) {
        return true;
      }
    }
  }

  return false;
}

function hasFourThreatInLine(cells, center) {
  // 5칸 안에 내 돌 4개 + 빈칸 1개면 4목 계열로 본다.
  // 예:
  // XXXX.
  // .XXXX
  // XXX.X
  // XX.XX
  // X.XXX
  //
  // 이런 줄은 3이 아니라 4로 봐야 하므로
  // 33 판정의 open three 카운트에서 제외한다.
  for (let start = 0; start <= cells.length - 5; start++) {
    if (center < start || center >= start + 5) continue;

    const seg = cells.slice(start, start + 5);
    const xCount = seg.filter(v => v === "X").length;
    const dotCount = seg.filter(v => v === ".").length;
    const blocked = seg.some(v => v === "O");

    if (!blocked && xCount === 4 && dotCount === 1) {
      return true;
    }
  }

  return false;
}

async function placeSelected() {
  if (!selectedCell) return;
  await tryPlace(selectedCell.row, selectedCell.col);
}
async function tryPlace(row, col) {
  if (!room || !currentRoomId) return;
  const check = canPlaceAt(row, col);
  if (!check.ok) {
    playSound("forbidden");
    showToast(check.reason);
    return;
  }
  try {
    await db.runTransaction(async tx => {
      const ref = roomRef();
      const snap = await tx.get(ref);
      const r = snap.data();
      if (!r || r.status !== "playing") throw new Error("대국 중이 아닙니다.");
const role = getRoleOf(linkedUser, r);

if (role !== r.turn) {
  throw new Error("내 차례가 아닙니다.");
}
      const board = [...(r.board || emptyBoard())];
      if (board[idx(row, col)]) throw new Error("이미 돌이 있습니다.");
      if (isDoubleThree(board, row, col, r.turn)) throw new Error("33 금지 위치입니다.");

      board[idx(row, col)] = r.turn;
      const win = checkWin(board, row, col, r.turn);
      const move = { row, col, color: r.turn, by: linkedUser, atMs: Date.now() };
      const history = [...(r.moveHistory || []), move].slice(-80);
      const updates = {
        board,
        moveHistory: history,
        lastMove: move,
        moveCount: (r.moveCount || 0) + 1,
        consecutivePasses: 0,
undoRequest: null,
drawRequest: null,
rematchRequest: null,
        matchRequest: null,
updatedAt: FV.serverTimestamp()
      };
      if (win.win) {
        Object.assign(updates, buildFinishUpdates(r, r.turn, "five", win.line));
      } else {
updates.turn = opponentColor(r.turn);
updates.turnSeq = (r.turnSeq || 1) + 1;
updates.turnStartedAt = FV.serverTimestamp();
      }
      tx.update(ref, updates);
    });
    selectedCell = null;
    if (room?.status === "betweenRounds") await applyCurrentRoomRating();
  } catch (err) {
    console.error(err);
    showToast(err.message || "착수 실패");
  }
}
function buildFinishUpdates(r, winnerColor, reason, winLine = []) {
  const winner = winnerColor ? (winnerColor === "black" ? r.black : r.white) : null;
  const loserColor = winnerColor ? opponentColor(winnerColor) : null;
  const loser = loserColor ? (loserColor === "black" ? r.black : r.white) : null;
  let nextSeats;
  if (winner && loser) nextSeats = { black: loser, white: winner };
  else nextSeats = { black: r.black, white: r.white };
  return {
    status: "betweenRounds",
    winner,
    loser,
    lastWinner: winner,
    lastLoser: loser,
    finishReason: reason,
    winLine,
    nextSeats,
    ready: {},
    finishedAt: FV.serverTimestamp(),
    ratingApplied: false
  };
}
async function finishRound({ winnerColor, reason }) {
  if (!room || room.status !== "playing") return;
  await db.runTransaction(async tx => {
    const ref = roomRef();
    const snap = await tx.get(ref);
    const r = snap.data();
    if (!r || r.status !== "playing") return;
    tx.update(ref, buildFinishUpdates(r, winnerColor, reason, []));
  });
  await applyCurrentRoomRating();
}
async function applyCurrentRoomRating() {
  await db.runTransaction(async tx => {
    const ref = roomRef();
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const r = snap.data();
    if (r.ratingApplied || r.status !== "betweenRounds") return;
    const black = r.black;
    const white = r.white;
    if (!black || !white) return;
    const blackRef = userRef(black);
    const whiteRef = userRef(white);
    const blackSnap = await tx.get(blackRef);
    const whiteSnap = await tx.get(whiteRef);
    const bs = normalizeStats(blackSnap.data(), black);
    const ws = normalizeStats(whiteSnap.data(), white);
    const br = Number(r.blackRatingBefore || bs.rating || DEFAULT_RATING);
    const wr = Number(r.whiteRatingBefore || ws.rating || DEFAULT_RATING);
    let bResult = 0.5;
    let wResult = 0.5;
    if (r.winner === black) { bResult = 1; wResult = 0; }
    if (r.winner === white) { bResult = 0; wResult = 1; }
    const bChange = calcRatingChange(br, wr, bResult);
    const wChange = calcRatingChange(wr, br, wResult);
    const bAfter = applyRating(br, bChange);
    const wAfter = applyRating(wr, wChange);
    tx.set(blackRef, buildUserStatUpdate(bs, "black", bResult, bAfter, r, black), { merge: true });
    tx.set(whiteRef, buildUserStatUpdate(ws, "white", wResult, wAfter, r, white), { merge: true });
    tx.update(ref, {
      blackRatingAfter: bAfter,
      whiteRatingAfter: wAfter,
      blackRatingChange: bChange,
      whiteRatingChange: wChange,
      ratingApplied: true,
      updatedAt: FV.serverTimestamp()
    });
  });
}
function buildUserStatUpdate(s, color, result, newRating, r, nickname) {
  const isWin = result === 1;
  const isLoss = result === 0;
  const isDraw = result === 0.5;
  const streak = isWin ? (s.currentStreak || 0) + 1 : 0;
  const moves = Math.ceil((r.moveCount || 0) / 2);
  return {
    nickname,
    rating: newRating,
    peakRating: Math.max(Number(s.peakRating || DEFAULT_RATING), newRating),
    games: (s.games || 0) + 1,
    wins: (s.wins || 0) + (isWin ? 1 : 0),
    losses: (s.losses || 0) + (isLoss ? 1 : 0),
    draws: (s.draws || 0) + (isDraw ? 1 : 0),
    blackGames: (s.blackGames || 0) + (color === "black" ? 1 : 0),
    whiteGames: (s.whiteGames || 0) + (color === "white" ? 1 : 0),
    blackWins: (s.blackWins || 0) + (color === "black" && isWin ? 1 : 0),
    whiteWins: (s.whiteWins || 0) + (color === "white" && isWin ? 1 : 0),
    resignWins: (s.resignWins || 0) + (r.finishReason === "resign" && isWin ? 1 : 0),
    resignLosses: (s.resignLosses || 0) + (r.finishReason === "resign" && isLoss ? 1 : 0),
    timeoutWins: (s.timeoutWins || 0) + (r.finishReason === "timeout" && isWin ? 1 : 0),
    timeoutLosses: (s.timeoutLosses || 0) + (r.finishReason === "timeout" && isLoss ? 1 : 0),
    currentStreak: streak,
    bestStreak: Math.max(s.bestStreak || 0, streak),
    totalMoves: (s.totalMoves || 0) + moves,
    lastPlayedAt: FV.serverTimestamp(),
    updatedAt: FV.serverTimestamp()
  };
}
async function passTurn() {
  if (!isMyTurn()) return;

  try {
    await db.runTransaction(async tx => {
      const ref = roomRef();
      const snap = await tx.get(ref);
      const r = snap.data();

const role = getRoleOf(linkedUser, r);

      if (r.status !== "playing" || role !== r.turn) {
        throw new Error("한 수 쉼 불가");
      }

      const nextPass = (r.consecutivePasses || 0) + 1;

      if (nextPass >= 2) {
        tx.update(ref, {
          ...buildFinishUpdates(r, null, "doublePass", []),
          consecutivePasses: nextPass,
          updatedAt: FV.serverTimestamp()
        });
      } else {
        tx.update(ref, {
          turn: opponentColor(r.turn),
          turnSeq: (r.turnSeq || 1) + 1,
          turnStartedAt: FV.serverTimestamp(),
          consecutivePasses: nextPass,
          lastAction: {
            type: "pass",
            by: linkedUser,
            atMs: Date.now()
          },
undoRequest: null,
drawRequest: null,
rematchRequest: null,
          matchRequest: null,
updatedAt: FV.serverTimestamp()
        });
      }
    });

    await addSystemChat(currentRoomId, `${linkedUser}님이 한 수 쉬었습니다.`);
  } catch (err) {
    showToast(err.message || "한 수 쉼 실패");
  }
}
