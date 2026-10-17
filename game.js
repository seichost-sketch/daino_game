const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const hiScoreEl = document.getElementById("hi-score");
const coinsEl = document.getElementById("coins");
const statusEl = document.getElementById("status");
const buyJetEl = document.getElementById("buy-jetpack");
const jetOwnedEl = document.getElementById("jet-owned");

const GROUND_Y = 220;
const GRAVITY = 0.72;
const JUMP_VELOCITY = -12.2;
const DUCK_HEIGHT = 32;
const STAND_HEIGHT = 52;
const START_SPEED = 6.2;
const MAX_SPEED = 13.5;
const BUFF_TIME = 360;
const HI_KEY = "no-signal-runner-hi-v2";
const COIN_KEY = "no-signal-runner-coins";
const JET_KEY = "no-signal-runner-jetpacks";
const COINS_PER_METER = 5;
const JETPACK_COST = 100;
const JETPACK_FUEL = 240;
const POWER_TYPES = ["invincible", "speed", "jump", "float"];
const POWER_META = {
  invincible: { label: "Invincible", color: "#f4c430", icon: "★" },
  speed: { label: "Speed", color: "#3da9fc", icon: "»" },
  jump: { label: "High Jump", color: "#b388ff", icon: "↑" },
  float: { label: "Slow Fall", color: "#7ee8c0", icon: "☁" },
};

const state = {
  running: false,
  dead: false,
  speed: START_SPEED,
  distance: 0,
  score: 0,
  hi: Number(localStorage.getItem(HI_KEY) || 0),
  coins: Number(localStorage.getItem(COIN_KEY) || 0),
  earned: 0,
  jetOwned: Number(localStorage.getItem(JET_KEY) || 0),
  jetFuel: 0,
  holdingJump: false,
  ducking: false,
  nextSpawn: 80,
  nextPower: 110,
  obstacles: [],
  powers: [],
  buffs: { invincible: 0, speed: 0, jump: 0, float: 0 },
  clouds: [
    { x: 180, y: 42, s: 1 },
    { x: 430, y: 28, s: 0.7 },
    { x: 720, y: 54, s: 1.1 },
  ],
};

const player = {
  x: 68,
  y: GROUND_Y - STAND_HEIGHT,
  w: 46,
  h: STAND_HEIGHT,
  vy: 0,
  onGround: true,
  frame: 0,
};

function pad(n) {
  return String(Math.floor(n)).padStart(5, "0");
}

function reset() {
  state.running = true;
  state.dead = false;
  state.speed = START_SPEED;
  state.distance = 0;
  state.score = 0;
  state.earned = 0;
  state.ducking = false;
  state.nextSpawn = 70;
  state.nextPower = 90 + Math.random() * 50;
  state.obstacles = [];
  state.powers = [];
  state.buffs = { invincible: 0, speed: 0, jump: 0, float: 0 };
  state.clouds = [
    { x: 180, y: 42, s: 1 },
    { x: 430, y: 28, s: 0.7 },
    { x: 720, y: 54, s: 1.1 },
  ];
  player.h = STAND_HEIGHT;
  player.y = GROUND_Y - player.h;
  player.vy = 0;
  player.onGround = true;
  player.frame = 0;
  state.jetFuel = 0;
  if (state.jetOwned > 0) {
    state.jetOwned -= 1;
    localStorage.setItem(JET_KEY, String(state.jetOwned));
    state.jetFuel = JETPACK_FUEL;
    statusEl.textContent = "Jetpack armed · hold jump to fly";
  } else {
    statusEl.textContent = "";
  }
  updateShop();
}

function saveCoins() {
  localStorage.setItem(COIN_KEY, String(state.coins));
  coinsEl.textContent = pad(state.coins);
}

function updateShop() {
  buyJetEl.disabled = state.coins < JETPACK_COST;
  jetOwnedEl.textContent = `Owned: ${state.jetOwned} · 1 run each`;
}

function buyJetpack() {
  if (state.coins < JETPACK_COST) {
    statusEl.textContent = "Need 100 coins for a jetpack";
    return;
  }
  state.coins -= JETPACK_COST;
  state.jetOwned += 1;
  localStorage.setItem(JET_KEY, String(state.jetOwned));
  saveCoins();
  updateShop();
  statusEl.textContent = "Jetpack bought · used on your next run";
}

function jump() {
  if (!state.running || state.dead) {
    reset();
    return;
  }
  if (player.onGround && !state.ducking) {
    player.vy = JUMP_VELOCITY * (hasBuff("jump") ? 1.42 : 1);
    player.onGround = false;
  }
}

function hasBuff(name) {
  return state.buffs[name] > 0;
}

function activatePower(kind) {
  state.buffs[kind] = BUFF_TIME;
  statusEl.textContent = POWER_META[kind].label;
}

function spawnPower(kind) {
  const type = kind || POWER_TYPES[Math.floor(Math.random() * POWER_TYPES.length)];
  const high = Math.random() < 0.55;
  state.powers.push({
    type,
    x: canvas.width + 30,
    y: high ? GROUND_Y - 92 : GROUND_Y - 58,
    w: 22,
    h: 22,
    bob: Math.random() * 10,
  });
}

function setDuck(on) {
  if (!state.running || state.dead) return;
  state.ducking = on && player.onGround;
  const nextH = state.ducking ? DUCK_HEIGHT : STAND_HEIGHT;
  player.y = GROUND_Y - nextH;
  player.h = nextH;
}

function lastObstacleX() {
  if (!state.obstacles.length) return -Infinity;
  return Math.max(...state.obstacles.map((ob) => ob.x + ob.w));
}

function spawnObstacle() {
  if (lastObstacleX() > canvas.width - 180) return;

  const roll = Math.random();
  if (roll < 0.2 && state.score > 250) {
    state.obstacles.push({
      type: "bird",
      x: canvas.width + 20,
      y: Math.random() < 0.45 ? GROUND_Y - 62 : GROUND_Y - 102,
      w: 48,
      h: 26,
      frame: 0,
    });
    return;
  }

  const count = Math.random() < 0.28 ? 2 : 1;
  const tall = Math.random() < 0.38;
  for (let i = 0; i < count; i += 1) {
    const h = tall ? 54 : 36;
    state.obstacles.push({
      type: "cactus",
      x: canvas.width + 24 + i * 30,
      y: GROUND_Y - h,
      w: tall ? 28 : 20,
      h,
      tall,
    });
  }
}

function hitboxesOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function playerBox() {
  const padX = 8;
  const padY = state.ducking ? 4 : 8;
  return {
    x: player.x + padX,
    y: player.y + padY,
    w: player.w - padX * 2,
    h: player.h - padY,
  };
}

function die() {
  state.dead = true;
  state.running = false;
  if (state.score > state.hi) {
    state.hi = Math.floor(state.score);
    localStorage.setItem(HI_KEY, String(state.hi));
  }
  state.earned = Math.floor(state.score / COINS_PER_METER);
  state.coins += state.earned;
  localStorage.setItem(COIN_KEY, String(state.coins));
  updateShop();
  statusEl.textContent = state.earned
    ? `+${state.earned} coins · press Space to restart`
    : "Game over · press Space to restart";
}

function update(dt) {
  player.frame += dt * (state.ducking ? 0.28 : 0.2);
  if (!state.running) return;

  for (const key of POWER_TYPES) {
    if (state.buffs[key] > 0) state.buffs[key] -= dt;
  }
  if (
    POWER_TYPES.every((key) => state.buffs[key] <= 0) &&
    !state.dead &&
    state.jetFuel <= 0 &&
    !statusEl.textContent.includes("Jetpack")
  ) {
    statusEl.textContent = "";
  }

  let nextSpeed = Math.min(MAX_SPEED, START_SPEED + state.score / 420);
  if (hasBuff("speed")) nextSpeed = Math.min(MAX_SPEED + 3.2, nextSpeed * 1.48);
  state.speed = nextSpeed;
  state.distance += state.speed * dt;
  state.score += dt * (hasBuff("speed") ? 0.28 : 0.18);

  let gravity = GRAVITY;
  if (hasBuff("float") && player.vy > 0) gravity *= 0.28;
  const thrusting = state.jetFuel > 0 && state.holdingJump;
  if (thrusting) {
    player.vy -= 1.15 * dt;
    player.vy = Math.max(player.vy, -5.6);
    state.jetFuel = Math.max(0, state.jetFuel - dt);
    if (state.jetFuel === 0) statusEl.textContent = "Jetpack empty";
  }
  player.vy += gravity * dt;
  player.y += player.vy * dt;
  if (player.y < 16) {
    player.y = 16;
    player.vy = Math.max(0, player.vy);
  }
  if (player.y >= GROUND_Y - player.h) {
    player.y = GROUND_Y - player.h;
    player.vy = 0;
    player.onGround = true;
  } else {
    player.onGround = false;
    state.ducking = false;
    player.h = STAND_HEIGHT;
  }

  state.nextSpawn -= dt;
  if (state.nextSpawn <= 0) {
    spawnObstacle();
    state.nextSpawn = 50 + Math.random() * 42;
  }

  state.nextPower -= dt;
  if (state.nextPower <= 0) {
    if (Math.random() < 0.42 && lastObstacleX() < canvas.width - 40) spawnPower();
    state.nextPower = 95 + Math.random() * 90;
  }

  for (const cloud of state.clouds) {
    cloud.x -= state.speed * 0.22 * cloud.s * dt;
    if (cloud.x < -80) {
      cloud.x = canvas.width + 40 + Math.random() * 120;
      cloud.y = 24 + Math.random() * 40;
    }
  }

  for (const ob of state.obstacles) {
    ob.x -= state.speed * dt;
    if (ob.type === "bird") ob.frame += 0.18 * dt;
  }
  state.obstacles = state.obstacles.filter((ob) => ob.x + ob.w > -40);

  for (const power of state.powers) {
    power.x -= state.speed * dt;
    power.bob += dt * 0.12;
  }
  state.powers = state.powers.filter((power) => power.x + power.w > -20);

  const box = playerBox();
  for (const power of state.powers) {
    const powerBox = { x: power.x, y: power.y + Math.sin(power.bob) * 5, w: power.w, h: power.h };
    if (hitboxesOverlap(box, powerBox)) {
      activatePower(power.type);
      power.x = -99;
    }
  }
  state.powers = state.powers.filter((power) => power.x > -40);

  if (!hasBuff("invincible")) {
    for (const ob of state.obstacles) {
      const obBox =
        ob.type === "bird"
          ? { x: ob.x + 8, y: ob.y + 6, w: ob.w - 14, h: ob.h - 8 }
          : { x: ob.x + 4, y: ob.y + 4, w: ob.w - 8, h: ob.h - 4 };
      if (hitboxesOverlap(box, obBox)) {
        die();
        break;
      }
    }
  }
}

function ellipse(x, y, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawSky() {
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  sky.addColorStop(0, "#4ea8d9");
  sky.addColorStop(0.55, "#8ed4f0");
  sky.addColorStop(1, "#f3e2b8");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, GROUND_Y);

  ctx.fillStyle = "#ffe27a";
  ellipse(790, 38, 22, 22);
  ctx.fillStyle = "rgba(255, 226, 122, 0.28)";
  ellipse(790, 38, 38, 38);

  ctx.fillStyle = "#d9b57a";
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.quadraticCurveTo(120, 168, 260, GROUND_Y);
  ctx.quadraticCurveTo(420, 150, 580, GROUND_Y);
  ctx.quadraticCurveTo(730, 172, 900, GROUND_Y);
  ctx.closePath();
  ctx.fill();
}

function drawCloud(cloud) {
  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  ellipse(cloud.x + 18, cloud.y + 8, 18 * cloud.s, 10 * cloud.s);
  ellipse(cloud.x + 34, cloud.y + 4, 16 * cloud.s, 12 * cloud.s);
  ellipse(cloud.x + 48, cloud.y + 9, 14 * cloud.s, 9 * cloud.s);
  ctx.fillStyle = "rgba(210, 226, 236, 0.55)";
  ellipse(cloud.x + 30, cloud.y + 12, 22 * cloud.s, 6 * cloud.s);
}

function drawGround() {
  const dirt = ctx.createLinearGradient(0, GROUND_Y, 0, canvas.height);
  dirt.addColorStop(0, "#e2c07a");
  dirt.addColorStop(0.35, "#c9954a");
  dirt.addColorStop(1, "#a56b2b");
  ctx.fillStyle = dirt;
  ctx.fillRect(0, GROUND_Y, canvas.width, canvas.height - GROUND_Y);

  ctx.fillStyle = "#8f5c24";
  ctx.fillRect(0, GROUND_Y, canvas.width, 4);

  const offset = Math.floor(state.distance) % 36;
  for (let x = -offset; x < canvas.width; x += 36) {
    ctx.fillStyle = "#d9b066";
    ctx.fillRect(x + 10, GROUND_Y + 10, 9, 3);
    ctx.fillStyle = "#7a4c1c";
    ctx.fillRect(x + 22, GROUND_Y + 18, 5, 3);
    ctx.fillStyle = "#b57a32";
    ctx.beginPath();
    ctx.arc(x + 6, GROUND_Y + 28, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCactus(ob) {
  const x = ob.x;
  const y = ob.y;
  const w = ob.w;
  const h = ob.h;
  const cx = x + w / 2;
  const trunk = ctx.createLinearGradient(cx - 8, y, cx + 10, y);
  trunk.addColorStop(0, "#1f5c28");
  trunk.addColorStop(0.45, "#3d9a40");
  trunk.addColorStop(1, "#245c28");

  ctx.fillStyle = trunk;
  ctx.beginPath();
  ctx.roundRect(cx - w * 0.24, y, w * 0.48, h, 9);
  ctx.fill();

  ctx.fillStyle = "#348a38";
  ctx.beginPath();
  ctx.roundRect(x, y + h * 0.3, w * 0.46, 9, 5);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(x, y + h * 0.16, 8, h * 0.32, 5);
  ctx.fill();

  ctx.fillStyle = "#1f5c28";
  ctx.beginPath();
  ctx.roundRect(cx + 2, y + h * 0.44, w * 0.42, 9, 5);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(x + w - 9, y + h * 0.26, 8, h * 0.32, 5);
  ctx.fill();

  ctx.strokeStyle = "rgba(210, 255, 180, 0.35)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 4, y + 6);
  ctx.lineTo(cx - 4, y + h - 5);
  ctx.moveTo(cx + 4, y + 8);
  ctx.lineTo(cx + 4, y + h - 6);
  ctx.stroke();

  ctx.fillStyle = "#f3f7d8";
  for (let i = 0; i < 6; i += 1) {
    const leftY = y + 8 + i * 7;
    const rightY = y + 12 + i * 7;
    if (leftY < y + h - 8) ctx.fillRect(cx - 9, leftY, 2, 3);
    if (rightY < y + h - 8) ctx.fillRect(cx + 7, rightY, 2, 3);
  }
  ctx.fillStyle = "#d24b4b";
  ellipse(cx, y + 4, 2.2, 2.2);
}

function drawBird(ob) {
  const flap = Math.sin(ob.frame) > 0;
  const x = ob.x;
  const y = ob.y;

  ctx.fillStyle = "#6b4a2c";
  ctx.beginPath();
  ctx.ellipse(x + 24, y + 16, 14, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#8a6238";
  ctx.beginPath();
  ctx.ellipse(x + 38, y + 14, 7, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#e0a84a";
  ctx.beginPath();
  ctx.moveTo(x + 44, y + 14);
  ctx.lineTo(x + 54, y + 16);
  ctx.lineTo(x + 44, y + 18);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#4a321c";
  ctx.beginPath();
  if (flap) {
    ctx.ellipse(x + 22, y + 6, 16, 6, -0.4, 0, Math.PI * 2);
  } else {
    ctx.ellipse(x + 22, y + 22, 16, 6, 0.45, 0, Math.PI * 2);
  }
  ctx.fill();

  ctx.fillStyle = "#f2d9a0";
  ctx.beginPath();
  ctx.arc(x + 40, y + 12, 1.5, 0, Math.PI * 2);
  ctx.fill();
}

function dinoPalette() {
  return {
    skin: "#6f9a36",
    shade: "#4f7324",
    belly: "#e8d7a0",
    spots: "#3f5e1c",
    ridge: "#8fbc4a",
    eye: "#1b1b1b",
    claw: "#e6d2a4",
    tooth: "#fff6dc",
  };
}

function drawScales(x, y, w, h) {
  ctx.fillStyle = "rgba(55, 90, 20, 0.28)";
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const sx = x + 6 + col * 6 + (row % 2) * 3;
      const sy = y + 8 + row * 6;
      if (sx < x + w - 4 && sy < y + h - 4) ellipse(sx, sy, 2.1, 1.4);
    }
  }
}

function drawDinoHead(x, y) {
  const c = dinoPalette();
  ctx.fillStyle = c.skin;
  ctx.beginPath();
  ctx.roundRect(x, y, 22, 16, 5);
  ctx.fill();
  ctx.fillStyle = c.shade;
  ctx.beginPath();
  ctx.roundRect(x + 10, y + 8, 16, 8, 4);
  ctx.fill();
  ctx.fillStyle = c.ridge;
  ctx.beginPath();
  ctx.roundRect(x + 2, y + 1, 14, 5, 3);
  ctx.fill();
  ctx.fillStyle = c.tooth;
  ctx.fillRect(x + 14, y + 14, 2, 3);
  ctx.fillRect(x + 18, y + 14, 2, 3);
  ctx.fillStyle = "#f7f3e8";
  ellipse(x + 8, y + 6, 3.2, 3.2);
  ctx.fillStyle = c.eye;
  ellipse(x + 9, y + 6, 1.5, 1.5);
  ctx.fillStyle = c.claw;
  ctx.beginPath();
  ctx.moveTo(x + 22, y + 10);
  ctx.lineTo(x + 31, y + 13);
  ctx.lineTo(x + 22, y + 16);
  ctx.closePath();
  ctx.fill();
}

function drawPower(power) {
  const meta = POWER_META[power.type];
  const y = power.y + Math.sin(power.bob) * 5;
  const cx = power.x + 11;
  const cy = y + 11;
  ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  ellipse(cx, cy + 1, 13, 13);
  ctx.fillStyle = meta.color;
  ellipse(cx, cy, 11, 11);
  ctx.fillStyle = "#fffce8";
  ellipse(cx - 3, cy - 3, 3, 2.4);
  ctx.fillStyle = "#3d2a12";
  ctx.font = "12px Courier New";
  ctx.textAlign = "center";
  ctx.fillText(meta.icon, cx, cy + 4);
  ctx.textAlign = "left";
}

function drawBuffHud() {
  const active = POWER_TYPES.filter((key) => hasBuff(key));
  let x = 12;
  if (state.jetFuel > 0) {
    const t = state.jetFuel / JETPACK_FUEL;
    ctx.fillStyle = "rgba(40, 24, 8, 0.45)";
    ctx.beginPath();
    ctx.roundRect(x, 10, 96, 18, 6);
    ctx.fill();
    ctx.fillStyle = "#ff8a3c";
    ctx.fillRect(x + 6, 24, 84 * t, 2);
    ctx.fillStyle = "#fff8e4";
    ctx.font = "11px Courier New";
    ctx.fillText("▲ Jetpack", x + 8, 22);
    x += 104;
  }
  if (!active.length) return;
  for (const key of active) {
    const meta = POWER_META[key];
    const t = Math.max(0, state.buffs[key] / BUFF_TIME);
    ctx.fillStyle = "rgba(40, 24, 8, 0.45)";
    ctx.beginPath();
    ctx.roundRect(x, 10, 86, 18, 6);
    ctx.fill();
    ctx.fillStyle = meta.color;
    ctx.fillRect(x + 6, 24, 74 * t, 2);
    ctx.fillStyle = "#fff8e4";
    ctx.font = "11px Courier New";
    ctx.fillText(`${meta.icon} ${meta.label}`, x + 8, 22);
    x += 94;
  }
}

function drawPlayer() {
  const run = Math.floor(player.frame) % 2 === 0;
  const c = dinoPalette();
  const x = player.x;
  const y = player.y;
  if (hasBuff("invincible") && Math.floor(player.frame * 4) % 2 === 0) {
    ctx.fillStyle = "rgba(244, 196, 48, 0.35)";
    ellipse(x + 24, y + 26, 28, 26);
  }
  if (hasBuff("speed")) {
    ctx.fillStyle = "rgba(61, 169, 252, 0.35)";
    ctx.fillRect(x - 18, y + 22, 16, 4);
    ctx.fillRect(x - 12, y + 30, 10, 3);
  }

  if (state.ducking) {
    ctx.fillStyle = c.shade;
    ctx.beginPath();
    ctx.ellipse(x + 6, y + 18, 8, 5, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.skin;
    ctx.beginPath();
    ctx.roundRect(x + 8, y + 10, 28, 16, 7);
    ctx.fill();
    ctx.fillStyle = c.belly;
    ctx.beginPath();
    ctx.roundRect(x + 14, y + 18, 18, 7, 4);
    ctx.fill();
    drawScales(x + 8, y + 8, 24, 14);
    drawDinoHead(x + 28, y + 4);
    ctx.fillStyle = c.shade;
    ctx.beginPath();
    ctx.roundRect(x + 12, y + 24, 8, 8, 3);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(x + 24, y + 24, 8, 8, 3);
    ctx.fill();
    return;
  }

  ctx.fillStyle = c.shade;
  ctx.beginPath();
  ctx.ellipse(x + 8, y + 26, 10, 5, -0.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = c.skin;
  ctx.beginPath();
  ctx.roundRect(x + 10, y + 14, 18, 24, 8);
  ctx.fill();
  ctx.fillStyle = c.belly;
  ctx.beginPath();
  ctx.roundRect(x + 16, y + 22, 10, 16, 5);
  ctx.fill();
  drawScales(x + 10, y + 14, 18, 22);

  ctx.fillStyle = c.skin;
  ctx.beginPath();
  ctx.roundRect(x + 8, y + 18, 8, 5, 3);
  ctx.fill();
  ctx.fillStyle = c.claw;
  ctx.fillRect(x + 8, y + 22, 3, 2);

  drawDinoHead(x + 22, y + 2);

  if (state.jetFuel > 0) {
    ctx.fillStyle = "#4a5560";
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 20, 10, 16, 3);
    ctx.fill();
    ctx.fillStyle = "#2d343c";
    ctx.fillRect(x + 4, y + 22, 6, 11);
    if (state.holdingJump) {
      ctx.fillStyle = "#ffb347";
      ctx.beginPath();
      ctx.moveTo(x + 4, y + 36);
      ctx.lineTo(x + 10, y + 36);
      ctx.lineTo(x + 7, y + 46 + Math.sin(player.frame * 8) * 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ff5a2a";
      ctx.beginPath();
      ctx.moveTo(x + 5, y + 36);
      ctx.lineTo(x + 9, y + 36);
      ctx.lineTo(x + 7, y + 42);
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.fillStyle = c.shade;
  if (!player.onGround) {
    ctx.beginPath();
    ctx.roundRect(x + 12, y + 36, 7, 16, 3);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(x + 24, y + 36, 7, 16, 3);
    ctx.fill();
  } else if (run) {
    ctx.beginPath();
    ctx.roundRect(x + 12, y + 38, 7, 14, 3);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(x + 24, y + 40, 7, 10, 3);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.roundRect(x + 12, y + 40, 7, 10, 3);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(x + 24, y + 38, 7, 14, 3);
    ctx.fill();
  }
  ctx.fillStyle = c.claw;
  ctx.fillRect(x + 12, GROUND_Y - (player.onGround ? 2 : 4), 8, 2);
  ctx.fillRect(x + 24, GROUND_Y - (player.onGround ? 2 : 4), 8, 2);
}

function drawGameOver() {
  ctx.fillStyle = "rgba(40, 24, 8, 0.55)";
  ctx.beginPath();
  ctx.roundRect(canvas.width / 2 - 130, 48, 260, 112, 8);
  ctx.fill();
  ctx.fillStyle = "#fff4d6";
  ctx.font = "16px Courier New";
  ctx.textAlign = "center";
  ctx.fillText("G A M E  O V E R", canvas.width / 2, 76);
  ctx.fillStyle = "#ffe27a";
  ctx.font = "14px Courier New";
  ctx.fillText(`+${state.earned} coins  ·  bank ${pad(state.coins)}`, canvas.width / 2, 98);
  ctx.fillStyle = "#ffe27a";
  ctx.beginPath();
  ctx.roundRect(canvas.width / 2 - 16, 112, 32, 28, 4);
  ctx.fill();
  ctx.fillStyle = "#3d2a12";
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2 - 6, 119);
  ctx.lineTo(canvas.width / 2 - 6, 133);
  ctx.lineTo(canvas.width / 2 + 8, 126);
  ctx.closePath();
  ctx.fill();
  ctx.textAlign = "left";
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawSky();
  for (const cloud of state.clouds) drawCloud(cloud);
  drawGround();
  for (const ob of state.obstacles) {
    if (ob.type === "bird") drawBird(ob);
    else drawCactus(ob);
  }
  for (const power of state.powers) drawPower(power);
  drawPlayer();
  drawBuffHud();
  if (state.dead) drawGameOver();
  scoreEl.textContent = pad(state.score);
  hiScoreEl.textContent = pad(state.hi);
  coinsEl.textContent = pad(state.coins);
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(2.5, (now - last) / (1000 / 60));
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function isJumpKey(e) {
  return e.code === "Space" || e.key === " " || e.code === "ArrowUp" || e.key === "ArrowUp";
}

function isDuckKey(e) {
  return e.code === "ArrowDown" || e.key === "ArrowDown";
}

window.addEventListener("keydown", (e) => {
  if (isJumpKey(e)) {
    e.preventDefault();
    state.holdingJump = true;
    jump();
  }
  if (isDuckKey(e)) {
    e.preventDefault();
    setDuck(true);
  }
});

window.addEventListener("keyup", (e) => {
  if (isJumpKey(e)) state.holdingJump = false;
  if (isDuckKey(e)) setDuck(false);
});

canvas.addEventListener("pointerdown", () => {
  state.holdingJump = true;
  jump();
});
window.addEventListener("pointerup", () => {
  state.holdingJump = false;
});

buyJetEl.addEventListener("click", buyJetpack);

hiScoreEl.textContent = pad(state.hi);
coinsEl.textContent = pad(state.coins);
updateShop();
requestAnimationFrame(loop);
