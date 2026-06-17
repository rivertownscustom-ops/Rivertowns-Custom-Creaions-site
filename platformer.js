const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const coinCountEl = document.getElementById("coinCount");
const lifeCountEl = document.getElementById("lifeCount");
const timeCountEl = document.getElementById("timeCount");
const messageEl = document.getElementById("message");
const subMessageEl = document.getElementById("subMessage");
const restartButton = document.getElementById("restartButton");
const leftButton = document.getElementById("leftButton");
const rightButton = document.getElementById("rightButton");
const jumpButton = document.getElementById("jumpButton");
const shootButton = document.getElementById("shootButton");

const keys = new Set();
const world = { width: 4300, height: 540, gravity: 1900 };
const camera = { x: 0 };

const start = { x: 70, y: 360 };
const player = {
  x: start.x,
  y: start.y,
  w: 34,
  h: 44,
  vx: 0,
  vy: 0,
  onGround: false,
  wallDir: 0,
  jumpsUsed: 0,
  facing: 1,
  checkpoint: { ...start },
  invincible: 0,
  shootCooldown: 0,
};

const state = {
  coins: 0,
  lives: 3,
  elapsed: 0,
  won: false,
  lastTime: performance.now(),
};

const platforms = [
  { x: 0, y: 500, w: 520, h: 40 },
  { x: 600, y: 455, w: 270, h: 34 },
  { x: 970, y: 410, w: 250, h: 34 },
  { x: 1320, y: 462, w: 260, h: 34 },
  { x: 1670, y: 385, w: 260, h: 34 },
  { x: 2020, y: 440, w: 230, h: 34 },
  { x: 2350, y: 350, w: 320, h: 34 },
  { x: 2720, y: 500, w: 260, h: 40 },
  { x: 380, y: 390, w: 120, h: 26 },
  { x: 760, y: 335, w: 110, h: 26 },
  { x: 1220, y: 295, w: 120, h: 26 },
  { x: 1580, y: 270, w: 130, h: 26 },
  { x: 1910, y: 310, w: 115, h: 26 },
  { x: 2250, y: 250, w: 110, h: 26 },
  { x: 2920, y: 438, w: 250, h: 34 },
  { x: 3260, y: 365, w: 235, h: 34 },
  { x: 3610, y: 430, w: 260, h: 34 },
  { x: 3950, y: 500, w: 360, h: 40 },
  { x: 3040, y: 292, w: 120, h: 26 },
  { x: 3450, y: 250, w: 130, h: 26 },
  { x: 3820, y: 310, w: 120, h: 26 },
];

const hazards = [
  { x: 525, y: 516, w: 70, h: 24 },
  { x: 890, y: 516, w: 85, h: 24 },
  { x: 1240, y: 516, w: 80, h: 24 },
  { x: 1590, y: 516, w: 75, h: 24 },
  { x: 2260, y: 516, w: 90, h: 24 },
  { x: 3000, y: 516, w: 100, h: 24 },
  { x: 3510, y: 516, w: 90, h: 24 },
  { x: 3880, y: 516, w: 70, h: 24 },
];

const checkpoints = [
  { x: 1080, y: 365, active: false },
  { x: 2055, y: 395, active: false },
  { x: 3335, y: 320, active: false },
];

const coins = [
  { x: 195, y: 438 }, { x: 270, y: 438 }, { x: 435, y: 330 },
  { x: 680, y: 398 }, { x: 815, y: 277 }, { x: 1035, y: 350 },
  { x: 1165, y: 350 }, { x: 1275, y: 240 }, { x: 1410, y: 402 },
  { x: 1530, y: 402 }, { x: 1645, y: 216 }, { x: 1765, y: 325 },
  { x: 1955, y: 254 }, { x: 2100, y: 382 }, { x: 2290, y: 198 },
  { x: 2430, y: 292 }, { x: 2530, y: 292 }, { x: 2740, y: 438 },
  { x: 2995, y: 378 }, { x: 3100, y: 236 }, { x: 3330, y: 305 },
  { x: 3520, y: 196 }, { x: 3690, y: 370 }, { x: 3840, y: 254 },
  { x: 4040, y: 438 }, { x: 4150, y: 438 },
].map((coin) => ({ ...coin, taken: false, spin: Math.random() * Math.PI * 2 }));

const enemies = [
  { x: 710, y: 415, w: 36, h: 40, baseX: 650, range: 145, dir: 1, alive: true },
  { x: 1430, y: 422, w: 36, h: 40, baseX: 1350, range: 190, dir: 1, alive: true },
  { x: 1770, y: 345, w: 36, h: 40, baseX: 1700, range: 170, dir: -1, alive: true },
  { x: 2135, y: 400, w: 36, h: 40, baseX: 2045, range: 180, dir: 1, alive: true },
  { x: 3050, y: 398, w: 36, h: 40, baseX: 2945, range: 205, dir: 1, alive: true },
  { x: 3370, y: 325, w: 36, h: 40, baseX: 3270, range: 210, dir: -1, alive: true },
  { x: 3710, y: 390, w: 36, h: 40, baseX: 3620, range: 220, dir: 1, alive: true },
];

const projectiles = [];
const goal = { x: 4145, y: 420, w: 54, h: 80 };

function restartGame() {
  state.coins = 0;
  state.lives = 3;
  state.elapsed = 0;
  state.won = false;
  player.checkpoint = { ...start };
  coins.forEach((coin) => {
    coin.taken = false;
  });
  checkpoints.forEach((checkpoint) => {
    checkpoint.active = false;
  });
  enemies.forEach((enemy) => {
    enemy.alive = true;
    enemy.x = enemy.baseX;
    enemy.dir = 1;
  });
  projectiles.length = 0;
  respawn(false);
  setMessage("Collect coins and reach the green portal.", "Arrow keys or A/D move. W or Up jumps, press jump again for a double jump, and Space shoots.");
}

function respawn(loseLife = true) {
  if (loseLife) {
    state.lives -= 1;
    player.invincible = 1.3;
  }

  if (state.lives <= 0) {
    state.lives = 3;
    state.coins = 0;
    coins.forEach((coin) => {
      coin.taken = false;
    });
    player.checkpoint = { ...start };
    setMessage("You wiped out. Fresh run!", "Lives reset, coins reset, and the skyline is waiting.");
  } else if (loseLife) {
    setMessage("Ouch. Back to the checkpoint.", "Hazards cost one life, but checkpoints keep the run moving.");
  }

  player.x = player.checkpoint.x;
  player.y = player.checkpoint.y;
  player.vx = 0;
  player.vy = 0;
  player.onGround = false;
  player.wallDir = 0;
  player.jumpsUsed = 0;
}

function setMessage(message, subMessage) {
  messageEl.textContent = message;
  subMessageEl.textContent = subMessage;
}

function updateHud() {
  coinCountEl.textContent = state.coins;
  lifeCountEl.textContent = state.lives;
  const minutes = Math.floor(state.elapsed / 60);
  const seconds = Math.floor(state.elapsed % 60);
  timeCountEl.textContent = `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function movePlayer(dt) {
  if (state.won) return;

  const left = keys.has("ArrowLeft") || keys.has("KeyA");
  const right = keys.has("ArrowRight") || keys.has("KeyD");
  const accel = player.onGround ? 2800 : 1800;
  const friction = player.onGround ? 0.78 : 0.93;
  const maxSpeed = 330;

  if (left) {
    player.vx -= accel * dt;
    player.facing = -1;
  }
  if (right) {
    player.vx += accel * dt;
    player.facing = 1;
  }
  if (!left && !right) {
    player.vx *= friction;
  }

  player.vx = Math.max(-maxSpeed, Math.min(maxSpeed, player.vx));
  player.vy += world.gravity * dt;
  player.invincible = Math.max(0, player.invincible - dt);
  player.shootCooldown = Math.max(0, player.shootCooldown - dt);

  player.x += player.vx * dt;
  resolveCollisions("x");
  player.y += player.vy * dt;
  player.onGround = false;
  player.wallDir = 0;
  resolveCollisions("y");

  if (player.y > world.height + 120) {
    respawn();
  }
}

function resolveCollisions(axis) {
  const body = player;
  for (const platform of platforms) {
    if (!rectsOverlap(body, platform)) continue;

    if (axis === "x") {
      if (body.vx > 0) {
        body.x = platform.x - body.w;
        body.wallDir = 1;
      } else if (body.vx < 0) {
        body.x = platform.x + platform.w;
        body.wallDir = -1;
      }
      body.vx = 0;
    } else {
      if (body.vy > 0) {
        body.y = platform.y - body.h;
        body.onGround = true;
        body.jumpsUsed = 0;
      } else if (body.vy < 0) {
        body.y = platform.y + platform.h;
      }
      body.vy = 0;
    }
  }
}

function jump() {
  if (state.won) return;

  if (player.onGround) {
    player.vy = -650;
    player.onGround = false;
    player.jumpsUsed = 1;
  } else if (player.wallDir !== 0) {
    player.vy = -610;
    player.vx = -player.wallDir * 390;
    player.jumpsUsed = 1;
  } else if (player.jumpsUsed < 2) {
    player.vy = -600;
    player.jumpsUsed += 1;
    setMessage("Double jump!", "Use the second jump to clear wider gaps and dodge enemies.");
  }
}

function shoot() {
  if (state.won || player.shootCooldown > 0) return;

  projectiles.push({
    x: player.x + player.w / 2 + player.facing * 20,
    y: player.y + 22,
    w: 18,
    h: 8,
    vx: player.facing * 650,
    life: 1.1,
  });
  player.shootCooldown = 0.24;
}

function collectAndCheck() {
  for (const coin of coins) {
    if (coin.taken) continue;
    const coinBox = { x: coin.x - 14, y: coin.y - 14, w: 28, h: 28 };
    if (rectsOverlap(player, coinBox)) {
      coin.taken = true;
      state.coins += 1;
      setMessage("Coin grabbed.", `${coins.filter((coinItem) => !coinItem.taken).length} coins left on the route.`);
    }
  }

  for (const hazard of hazards) {
    if (player.invincible <= 0 && rectsOverlap(player, hazard)) {
      respawn();
      return;
    }
  }

  for (const enemy of enemies) {
    if (enemy.alive && player.invincible <= 0 && rectsOverlap(player, enemy)) {
      respawn();
      return;
    }
  }

  for (const checkpoint of checkpoints) {
    const checkpointBox = { x: checkpoint.x - 16, y: checkpoint.y - 58, w: 32, h: 58 };
    if (!checkpoint.active && rectsOverlap(player, checkpointBox)) {
      checkpoint.active = true;
      player.checkpoint = { x: checkpoint.x, y: checkpoint.y - 70 };
      setMessage("Checkpoint lit.", "A miss from here sends you back to this flag.");
    }
  }

  if (rectsOverlap(player, goal)) {
    state.won = true;
    player.vx = 0;
    player.vy = 0;
    setMessage(`You made it with ${state.coins} coins!`, "Restart to run it cleaner and faster.");
  }
}

function updateCamera() {
  const target = player.x - canvas.width * 0.42;
  camera.x += (target - camera.x) * 0.09;
  camera.x = Math.max(0, Math.min(world.width - canvas.width, camera.x));
}

function updateEnemiesAndShots(dt) {
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    enemy.x += enemy.dir * 95 * dt;
    if (enemy.x < enemy.baseX || enemy.x > enemy.baseX + enemy.range) {
      enemy.dir *= -1;
      enemy.x = Math.max(enemy.baseX, Math.min(enemy.baseX + enemy.range, enemy.x));
    }
  }

  for (let i = projectiles.length - 1; i >= 0; i -= 1) {
    const shot = projectiles[i];
    shot.x += shot.vx * dt;
    shot.life -= dt;
    let remove = shot.life <= 0;

    for (const enemy of enemies) {
      if (!enemy.alive || remove) continue;
      if (rectsOverlap(shot, enemy)) {
        enemy.alive = false;
        remove = true;
        state.coins += 2;
        setMessage("Enemy popped!", "Nice shot. Enemy hits are worth 2 bonus coins.");
      }
    }

    if (remove) projectiles.splice(i, 1);
  }
}

function update(dt) {
  if (!state.won) state.elapsed += dt;
  movePlayer(dt);
  updateEnemiesAndShots(dt);
  collectAndCheck();
  updateCamera();
  coins.forEach((coin) => {
    coin.spin += dt * 7;
  });
  updateHud();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(-camera.x, 0);
  drawBackground();
  drawPlatforms();
  drawHazards();
  drawCheckpoints();
  drawCoins();
  drawEnemies();
  drawProjectiles();
  drawGoal();
  drawPlayer();
  ctx.restore();
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "#8fd7ff");
  sky.addColorStop(1, "#fbe4af");
  ctx.fillStyle = sky;
  ctx.fillRect(camera.x, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
  for (let i = 0; i < 10; i += 1) {
    const x = i * 360 + 80;
    ctx.beginPath();
    ctx.ellipse(x, 92 + (i % 3) * 32, 60, 20, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 46, 88 + (i % 3) * 32, 42, 18, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 44, 94 + (i % 3) * 32, 38, 16, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 16; i += 1) {
    ctx.fillStyle = i % 2 ? "#5aa5c8" : "#4c94b8";
    ctx.fillRect(i * 190, 365 - (i % 5) * 22, 118, 155 + (i % 5) * 22);
    ctx.fillStyle = "rgba(255, 250, 220, 0.65)";
    for (let w = 0; w < 3; w += 1) {
      ctx.fillRect(i * 190 + 18 + w * 31, 390 - (i % 5) * 22, 12, 12);
      ctx.fillRect(i * 190 + 18 + w * 31, 425 - (i % 5) * 22, 12, 12);
    }
  }
}

function drawPlatforms() {
  for (const platform of platforms) {
    ctx.fillStyle = "#3d7b4d";
    ctx.fillRect(platform.x, platform.y, platform.w, platform.h);
    ctx.fillStyle = "#61b95e";
    ctx.fillRect(platform.x, platform.y, platform.w, 9);
    ctx.fillStyle = "rgba(18, 32, 44, 0.16)";
    ctx.fillRect(platform.x, platform.y + platform.h - 6, platform.w, 6);
  }
}

function drawHazards() {
  for (const hazard of hazards) {
    ctx.fillStyle = "#d44b43";
    ctx.beginPath();
    for (let x = hazard.x; x < hazard.x + hazard.w; x += 18) {
      ctx.moveTo(x, hazard.y + hazard.h);
      ctx.lineTo(x + 9, hazard.y);
      ctx.lineTo(x + 18, hazard.y + hazard.h);
    }
    ctx.fill();
  }
}

function drawCoins() {
  for (const coin of coins) {
    if (coin.taken) continue;
    const width = 8 + Math.abs(Math.cos(coin.spin)) * 16;
    ctx.fillStyle = "#f0c742";
    ctx.beginPath();
    ctx.ellipse(coin.x, coin.y, width / 2, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#9b7115";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawEnemies() {
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    ctx.fillStyle = "#d44b43";
    ctx.fillRect(enemy.x, enemy.y + 10, enemy.w, enemy.h - 10);
    ctx.fillStyle = "#12202c";
    ctx.beginPath();
    ctx.arc(enemy.x + 10, enemy.y + 8, 8, 0, Math.PI * 2);
    ctx.arc(enemy.x + 26, enemy.y + 8, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fffaf0";
    ctx.fillRect(enemy.x + 9, enemy.y + 22, 6, 6);
    ctx.fillRect(enemy.x + 22, enemy.y + 22, 6, 6);
  }
}

function drawProjectiles() {
  for (const shot of projectiles) {
    ctx.fillStyle = "#f0c742";
    ctx.fillRect(shot.x, shot.y, shot.w, shot.h);
    ctx.fillStyle = "rgba(255, 250, 240, 0.9)";
    ctx.fillRect(shot.x - Math.sign(shot.vx) * 10, shot.y + 2, 10, 4);
  }
}

function drawCheckpoints() {
  for (const checkpoint of checkpoints) {
    ctx.strokeStyle = "#12202c";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(checkpoint.x, checkpoint.y);
    ctx.lineTo(checkpoint.x, checkpoint.y - 58);
    ctx.stroke();
    ctx.fillStyle = checkpoint.active ? "#2fa36b" : "#fffaf0";
    ctx.beginPath();
    ctx.moveTo(checkpoint.x, checkpoint.y - 58);
    ctx.lineTo(checkpoint.x + 42, checkpoint.y - 44);
    ctx.lineTo(checkpoint.x, checkpoint.y - 30);
    ctx.closePath();
    ctx.fill();
  }
}

function drawGoal() {
  const pulse = Math.sin(state.elapsed * 5) * 6;
  ctx.fillStyle = "rgba(47, 163, 107, 0.28)";
  ctx.beginPath();
  ctx.ellipse(goal.x + goal.w / 2, goal.y + goal.h / 2, 34 + pulse, 52, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#2fa36b";
  ctx.lineWidth = 6;
  ctx.stroke();
}

function drawPlayer() {
  const blink = player.invincible > 0 && Math.floor(player.invincible * 12) % 2 === 0;
  if (blink) return;

  ctx.fillStyle = "#2563b8";
  ctx.fillRect(player.x, player.y + 12, player.w, player.h - 12);
  ctx.fillStyle = "#f0c742";
  ctx.beginPath();
  ctx.arc(player.x + player.w / 2, player.y + 12, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#12202c";
  ctx.fillRect(player.x + (player.facing > 0 ? 22 : 8), player.y + 9, 4, 4);
}

function loop(now) {
  const dt = Math.min(0.033, (now - state.lastTime) / 1000);
  state.lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (event) => {
  keys.add(event.code);
  if (!event.repeat && ["ArrowUp", "KeyW"].includes(event.code)) {
    event.preventDefault();
    jump();
  }
  if (event.code === "Space") {
    event.preventDefault();
    shoot();
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

function bindHold(button, code) {
  const press = (event) => {
    event.preventDefault();
    keys.add(code);
    if (code === "ArrowUp") jump();
  };
  const release = (event) => {
    event.preventDefault();
    keys.delete(code);
  };
  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("pointerleave", release);
}

bindHold(leftButton, "ArrowLeft");
bindHold(rightButton, "ArrowRight");
bindHold(jumpButton, "ArrowUp");
shootButton.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  shoot();
});
restartButton.addEventListener("click", restartGame);

restartGame();
requestAnimationFrame(loop);
