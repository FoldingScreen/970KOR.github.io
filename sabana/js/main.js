const keys = new Set();
const touchMove = { active: false, id: null, dx: 0, dy: 0 };

function getCanvasLocalPoint(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
    inside: clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
  };
}

function placeFloatingStick(clientX, clientY) {
  if (!mobileStick) return;
  const wrapRect = canvas.parentElement.getBoundingClientRect();
  const x = clientX - wrapRect.left;
  const y = clientY - wrapRect.top;
  mobileStick.style.transform = `translate(${x}px, ${y}px)`;
  mobileStick.classList.add("active");
}

function setTouchMoveFromPoint(clientX, clientY) {
  if (!mobileStick || !mobileStickKnob) return;
  const rect = mobileStick.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  let dx = clientX - cx;
  let dy = clientY - cy;
  const max = rect.width / 2 - 18;
  const len = Math.hypot(dx, dy);
  if (len > max) {
    dx = (dx / len) * max;
    dy = (dy / len) * max;
  }
  const deadzone = 9;
  const inputLen = Math.hypot(dx, dy);
  if (inputLen < deadzone) {
    touchMove.dx = 0;
    touchMove.dy = 0;
    mobileStickKnob.style.transform = "translate(0, 0)";
    return;
  }
  mobileStickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  touchMove.dx = touchMove.dx * 0.25 + (dx / max) * 0.75;
  touchMove.dy = touchMove.dy * 0.25 + (dy / max) * 0.75;
}

function resetTouchMove() {
  touchMove.active = false;
  touchMove.id = null;
  touchMove.dx = 0;
  touchMove.dy = 0;
  if (mobileStickKnob) mobileStickKnob.style.transform = "translate(0, 0)";
  if (mobileStick) {
    mobileStick.classList.remove("active");
    mobileStick.style.transform = "translate(-9999px, -9999px)";
  }
}

canvas.addEventListener("pointerdown", e => {
  if (!state || !state.running || state.paused) return;
  if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
  const point = getCanvasLocalPoint(e.clientX, e.clientY);
  if (!point.inside) return;
  touchMove.active = true;
  touchMove.id = e.pointerId;
  canvas.setPointerCapture(e.pointerId);
  placeFloatingStick(e.clientX, e.clientY);
  setTouchMoveFromPoint(e.clientX, e.clientY);
  e.preventDefault();
}, { passive: false });

canvas.addEventListener("pointermove", e => {
  if (!touchMove.active || e.pointerId !== touchMove.id) return;
  setTouchMoveFromPoint(e.clientX, e.clientY);
  e.preventDefault();
}, { passive: false });

canvas.addEventListener("pointerup", e => {
  if (e.pointerId !== touchMove.id) return;
  resetTouchMove();
  e.preventDefault();
}, { passive: false });

canvas.addEventListener("pointercancel", e => {
  if (e.pointerId !== touchMove.id) return;
  resetTouchMove();
  e.preventDefault();
}, { passive: false });

pauseBtn.addEventListener("click", pauseGame);

window.addEventListener("keydown", e => {
  const blockScrollKeys = [
    "Space",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight"
  ];

  if (blockScrollKeys.includes(e.code)) {
    e.preventDefault();
  }

  keys.add(e.code);

  if (
    (e.code === "Escape" || e.code === "KeyP") &&
    state &&
    state.running
  ) {
    e.preventDefault();

    if (state.paused) resumeGame();
    else pauseGame();
  }
});

window.addEventListener("keyup", e => keys.delete(e.code));

async function initSabana() {
  resizeCanvasForDevice();
  try {
    meta = await loadMetaFromFirestore();
    metaReady = true;
  } catch (err) {
    console.error("SABANA 데이터 로드 실패", err);
    alert("SABANA 데이터를 불러오지 못했습니다.");
    location.href = "../";
    return;
  }
  updateUi();
  showToast(`${linkedUser}님 SABANA 데이터 불러옴`);
}

window.addEventListener("resize", () => {
  resizeCanvasForDevice();
  updateUi();
});

initSabana();
