const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const runsEl = document.getElementById("runs");
const inningEl = document.getElementById("inning");
const outsEl = document.getElementById("outs");
const timerEl = document.getElementById("timer");
const messageEl = document.getElementById("message");
const subMessageEl = document.getElementById("subMessage");
const swingButton = document.getElementById("swingButton");
const advanceButton = document.getElementById("advanceButton");
const holdButton = document.getElementById("holdButton");
const restartButton = document.getElementById("restartButton");
const meterNeedle = document.getElementById("meterNeedle");

const BASES = [
  { x: 480, y: 520 },
  { x: 675, y: 370 },
  { x: 480, y: 235 },
  { x: 285, y: 370 },
];

const FIELDERS = [
  { x: 480, y: 300 },
  { x: 340, y: 260 },
  { x: 620, y: 260 },
  { x: 250, y: 185 },
  { x: 710, y: 185 },
  { x: 480, y: 135 },
];

const state = {
  runs: 0,
  inning: 1,
  outs: 0,
  clock: 480,
  pitch: 0,
  pitchSpeed: 0.82,
  phase: "pitch",
  bases: [false, false, false],
  ball: { x: 480, y: 494, vx: 0, vy: 0, active: false, label: "" },
  runnerDots: [],
  lastTime: performance.now(),
  playEndsAt: 0,
  canAdvance: false,
  gameOver: false,
};

function resetGame() {
  state.runs = 0;
  state.inning = 1;
  state.outs = 0;
  state.clock = 480;
  state.pitch = 0;
  state.pitchSpeed = randomBetween(0.72, 1.05);
  state.phase = "pitch";
  state.bases = [false, false, false];
  state.ball = { x: 480, y: 494, vx: 0, vy: 0, active: false, label: "" };
  state.runnerDots = [];
  state.playEndsAt = 0;
  state.canAdvance = false;
  state.gameOver = false;
  setMessage("Press Swing when the pitch reaches the yellow zone.", "Spacebar swings. Good timing sends the ball into the gaps.");
  updateButtons();
  updateHud();
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function updateHud() {
  runsEl.textContent = state.runs;
  inningEl.textContent = state.inning;
  outsEl.textContent = state.outs;
  const minutes = Math.floor(state.clock / 60);
  const seconds = Math.max(0, Math.floor(state.clock % 60));
  timerEl.textContent = `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function setMessage(message, subMessage = "") {
  messageEl.textContent = message;
  subMessageEl.textContent = subMessage;
}

function updateButtons() {
  swingButton.disabled = state.phase !== "pitch" || state.gameOver;
  advanceButton.disabled = !state.canAdvance || state.gameOver;
  holdButton.disabled = state.phase !== "result" || state.gameOver;
}

function swing() {
  if (state.phase !== "pitch" || state.gameOver) return;

  const timing = 1 - Math.min(1, Math.abs(state.pitch - 0.5) / 0.5);
  const roll = Math.random();

  if (state.pitch < 0.08) {
    recordOut("Bunt attempt! Banana Ball says bunting is an automatic out.", "Full swings only in this ballpark.");
    return;
  }

  if (timing < 0.18) {
    recordOut("Swing and a miss.", "The pitcher quick-pitched you. Get the next one.");
    return;
  }

  if (timing < 0.36 && roll < 0.55) {
    const fanCaughtIt = Math.random() < 0.35;
    if (fanCaughtIt) {
      recordOut("A fan caught your foul ball. That is an out!", "Banana Ball crowd defense strikes again.");
    } else {
      setMessage("Foul ball into the stands.", "No out this time. The next pitch is already on the way.");
      nextPitch(900);
    }
    return;
  }

  if (roll < 0.1) {
    ballFourSprint();
    return;
  }

  if (roll > 0.9 && timing > 0.58) {
    stealFirst();
    return;
  }

  const bases = timing > 0.84 ? 4 : timing > 0.68 ? 3 : timing > 0.5 ? 2 : 1;
  putBallInPlay(bases, timing);
}

function ballFourSprint() {
  const sprintBases = Math.random() < 0.42 ? 2 : 1;
  advanceRunners(sprintBases);
  launchBall("Ball four sprint", 0.36);
  setMessage(
    sprintBases === 2 ? "Ball four sprint! You reached second." : "Ball four sprint! Take first.",
    "In Banana Ball, ball four turns into a footrace while the fielders relay the ball."
  );
  settlePlay();
}

function stealFirst() {
  const safe = Math.random() < 0.72;
  launchBall("Wild pitch", 0.22);
  if (safe) {
    advanceRunners(1);
    setMessage("Wild pitch! You stole first.", "Steal first is live, and the catcher was late.");
    settlePlay();
  } else {
    recordOut("Wild pitch try, but the throw beat you.", "Aggressive. Very Banana. Also an out.");
  }
}

function putBallInPlay(bases, timing) {
  advanceRunners(bases);
  launchBall(bases === 4 ? "Banana blast" : `${bases}-base hit`, timing);
  state.canAdvance = bases < 4 && Math.random() < 0.55;
  const names = ["", "Single", "Double", "Triple", "Home run"];
  setMessage(
    `${names[bases]}!`,
    state.canAdvance ? "You can gamble for one extra base before the relay arrives." : "The base coaches throw up the stop sign."
  );
  settlePlay();
}

function advanceRunners(baseCount) {
  const nextBases = [false, false, false];
  let scored = 0;

  for (let i = 2; i >= 0; i -= 1) {
    if (!state.bases[i]) continue;
    const destination = i + baseCount;
    if (destination >= 3) scored += 1;
    else nextBases[destination] = true;
  }

  if (baseCount >= 4) scored += 1;
  else nextBases[baseCount - 1] = true;

  state.bases = nextBases;
  state.runs += scored;
  createRunnerDots();
}

function tryAdvance() {
  if (!state.canAdvance || state.gameOver) return;
  state.canAdvance = false;
  const safe = Math.random() < 0.62;
  if (safe) {
    advanceExistingRunnersOneBase();
    setMessage("Send them! Everyone is safe.", "That extra base is why the coaches wear helmets.");
  } else {
    recordOut("Thrown out taking the extra base.", "The relay finally caught up.");
    return;
  }
  updateButtons();
  nextPitch(1000);
}

function holdRunners() {
  if (state.phase !== "result" || state.gameOver) return;
  state.canAdvance = false;
  setMessage("Runners hold.", "Next pitch. Keep the line moving.");
  updateButtons();
  nextPitch(700);
}

function advanceExistingRunnersOneBase() {
  const nextBases = [false, false, false];
  for (let i = 2; i >= 0; i -= 1) {
    if (!state.bases[i]) continue;
    if (i === 2) state.runs += 1;
    else nextBases[i + 1] = true;
  }
  state.bases = nextBases;
  createRunnerDots();
}

function recordOut(message, subMessage) {
  state.outs += 1;
  launchBall("Out", 0.18);
  setMessage(message, subMessage);
  state.canAdvance = false;

  if (state.outs >= 3) {
    state.outs = 0;
    state.inning += 1;
    state.bases = [false, false, false];
    setTimeout(() => {
      if (!state.gameOver) {
        setMessage(`New inning: ${state.inning}`, "Three outs clears the bases, but you stay on offense.");
      }
    }, 500);
  }

  settlePlay();
}

function settlePlay() {
  state.phase = "result";
  state.playEndsAt = performance.now() + 1100;
  updateHud();
  updateButtons();
}

function nextPitch(delay = 700) {
  state.phase = "waiting";
  state.canAdvance = false;
  updateButtons();
  setTimeout(() => {
    if (state.gameOver) return;
    state.pitch = 0;
    state.pitchSpeed = randomBetween(0.72, 1.08);
    state.ball.active = false;
    state.phase = "pitch";
    setMessage("Here comes the pitch.", "Time the yellow zone for better contact.");
    updateButtons();
  }, delay);
}

function launchBall(label, strength) {
  const side = Math.random() < 0.5 ? -1 : 1;
  state.ball = {
    x: BASES[0].x,
    y: BASES[0].y - 28,
    vx: side * randomBetween(170, 310) * (0.6 + strength),
    vy: -randomBetween(190, 330) * (0.7 + strength),
    active: true,
    label,
  };
}

function createRunnerDots() {
  state.runnerDots = state.bases
    .map((occupied, index) => occupied ? { ...BASES[index + 1], pulse: Math.random() * Math.PI } : null)
    .filter(Boolean);
}

function update(dt, now) {
  if (!state.gameOver) {
    state.clock -= dt;
    if (state.clock <= 0) endGame();
  }

  if (state.phase === "pitch") {
    state.pitch += dt * state.pitchSpeed;
    if (state.pitch >= 1) {
      if (Math.random() < 0.18) stealFirst();
      else nextPitch(220);
    }
  }

  if (state.ball.active) {
    state.ball.x += state.ball.vx * dt;
    state.ball.y += state.ball.vy * dt;
    state.ball.vy += 520 * dt;
    if (state.ball.y > canvas.height + 60 || state.ball.x < -80 || state.ball.x > canvas.width + 80) {
      state.ball.active = false;
    }
  }

  state.runnerDots.forEach((runner) => {
    runner.pulse += dt * 7;
  });

  if (state.phase === "result" && now > state.playEndsAt && !state.canAdvance) {
    nextPitch(300);
  }

  updateHud();
  meterNeedle.style.left = `${Math.max(0, Math.min(100, state.pitch * 100))}%`;
}

function endGame() {
  state.gameOver = true;
  state.clock = 0;
  state.phase = "final";
  state.canAdvance = false;
  setMessage(`Final score: ${state.runs} runs`, "Restart to chase a bigger Banana Ball number.");
  updateButtons();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawField();
  drawFans();
  drawFielders();
  drawBases();
  drawRunners();
  drawPitch();
  drawBatter();
  drawBall();
}

function drawField() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#58b96d");
  gradient.addColorStop(1, "#257346");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#2b8350";
  for (let i = -2; i < 11; i += 1) {
    ctx.beginPath();
    ctx.ellipse(i * 130, 320, 260, 38, -0.48, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#c98245";
  ctx.beginPath();
  ctx.moveTo(BASES[0].x, BASES[0].y);
  ctx.lineTo(BASES[1].x, BASES[1].y);
  ctx.lineTo(BASES[2].x, BASES[2].y);
  ctx.lineTo(BASES[3].x, BASES[3].y);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 246, 223, 0.9)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(BASES[0].x, BASES[0].y);
  ctx.lineTo(BASES[1].x, BASES[1].y);
  ctx.lineTo(BASES[2].x, BASES[2].y);
  ctx.lineTo(BASES[3].x, BASES[3].y);
  ctx.closePath();
  ctx.stroke();

  ctx.fillStyle = "#d99557";
  ctx.beginPath();
  ctx.ellipse(480, 358, 72, 48, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawFans() {
  ctx.fillStyle = "rgba(255, 250, 240, 0.86)";
  ctx.fillRect(0, 0, canvas.width, 68);
  for (let i = 0; i < 36; i += 1) {
    const x = 16 + i * 27;
    const y = 20 + (i % 3) * 10;
    ctx.fillStyle = i % 5 === 0 ? "#f7d74a" : i % 5 === 1 ? "#2257a4" : i % 5 === 2 ? "#cf3f36" : "#fff";
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBases() {
  BASES.forEach((base, index) => {
    ctx.save();
    ctx.translate(base.x, base.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = index === 0 ? "#fff0b4" : "#fffaf0";
    ctx.fillRect(-12, -12, 24, 24);
    ctx.restore();
  });
}

function drawFielders() {
  FIELDERS.forEach((fielder, index) => {
    ctx.fillStyle = index % 2 ? "#2257a4" : "#f7d74a";
    ctx.beginPath();
    ctx.arc(fielder.x, fielder.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#152018";
    ctx.fillRect(fielder.x - 9, fielder.y + 12, 18, 18);
  });
}

function drawRunners() {
  state.runnerDots.forEach((runner) => {
    const lift = Math.sin(runner.pulse) * 3;
    ctx.fillStyle = "#cf3f36";
    ctx.beginPath();
    ctx.arc(runner.x, runner.y - 28 + lift, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillRect(runner.x - 7, runner.y - 17 + lift, 14, 17);
  });
}

function drawPitch() {
  if (state.phase !== "pitch") return;
  const pitchY = 270 + state.pitch * 230;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(480, pitchY, 7, 0, Math.PI * 2);
  ctx.fill();
}

function drawBatter() {
  ctx.strokeStyle = "#152018";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(520, 488);
  ctx.lineTo(555, 452);
  ctx.stroke();

  ctx.fillStyle = "#cf3f36";
  ctx.beginPath();
  ctx.arc(500, 486, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillRect(491, 500, 18, 32);
}

function drawBall() {
  if (!state.ball.active) return;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(state.ball.x, state.ball.y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#152018";
  ctx.font = "700 14px system-ui";
  ctx.fillText(state.ball.label, state.ball.x + 12, state.ball.y - 12);
}

function loop(now) {
  const dt = Math.min(0.033, (now - state.lastTime) / 1000);
  state.lastTime = now;
  update(dt, now);
  draw();
  requestAnimationFrame(loop);
}

swingButton.addEventListener("click", swing);
advanceButton.addEventListener("click", tryAdvance);
holdButton.addEventListener("click", holdRunners);
restartButton.addEventListener("click", resetGame);

window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    swing();
  }
  if (event.key.toLowerCase() === "a") tryAdvance();
  if (event.key.toLowerCase() === "h") holdRunners();
});

resetGame();
requestAnimationFrame(loop);
