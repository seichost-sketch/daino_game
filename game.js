const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const hiScoreEl = document.getElementById("hi-score");
const statusEl = document.getElementById("status");

const GROUND_Y = 220;
const GRAVITY = 0.72;
const JUMP_VELOCITY = -12.2;
const DUCK_HEIGHT = 28;
const STAND_HEIGHT = 46;
const START_SPEED = 6.2;
const MAX_SPEED = 13.5;
const HI_KEY = "no-signal-runner-hi-v2";

const state = {
  running: false,
  dead: false,
  speed: START_SPEED,
  distance: 0,
  score: 0,
  hi: Number(localStorage.getItem(HI_KEY) || 0),
  ducking: false,
  nextSpawn: 80,
  obstacles: [],
  clouds: [
    { x: 180, y: 42, s: 1 },
    { x: 430, y: 28, s: 0.7 },
    { x: 720, y: 54, s: 1.1 },
  ],
};

const player = {
  x: 72,
  y: GROUND_Y - STAND_HEIGHT,
  w: 34,
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
  state.ducking = false;
  state.nextSpawn = 70;
  state.obstacles = [];
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
  statusEl.textContent = "";
}

function jump() {
  if (!state.running || state.dead) {
    reset();
    return;
  }
  if (player.onGround && !state.ducking) {
    player.vy = JUMP_VELOCITY;
    player.onGround = false;
  }
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
      y: Math.random() < 0.45 ? GROUND_Y - 58 : GROUND_Y - 94,
      w: 36,
      h: 22,
      frame: 0,
    });
    return;
  }

  const count = Math.random() < 0.28 ? 2 : 1;
  const tall = Math.random() < 0.38;
  for (let i = 0; i < count; i += 1) {
    const h = tall ? 42 : 28;
    state.obstacles.push({
      type: "cactus",
      x: canvas.width + 24 + i * 22,
      y: GROUND_Y - h,
      w: tall ? 16 : 12,
      h,
    });
  }
}

function hitboxesOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function playerBox() {
  const padX = 6;
  const padY = state.ducking ? 2 : 6;
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
  statusEl.textContent = "Game over · press Space to restart";
}

function update(dt) {
  player.frame += dt * (state.ducking ? 0.28 : 0.2);
  if (!state.running) return;

  state.speed = Math.min(MAX_SPEED, START_SPEED + state.score / 420);
  state.distance += state.speed * dt;
  state.score += dt * 0.18;

  player.vy += GRAVITY * dt;
  player.y += player.vy * dt;
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
  state.obstacles = state.obstacles.filter((ob) => ob.x + ob.w > -20);

  const box = playerBox();
  for (const ob of state.obstacles) {
    const obBox =
      ob.type === "bird"
        ? { x: ob.x + 4, y: ob.y + 4, w: ob.w - 8, h: ob.h - 6 }
        : { x: ob.x + 2, y: ob.y + 2, w: ob.w - 4, h: ob.h - 2 };
    if (hitboxesOverlap(box, obBox)) {
      die();
      break;
    }
  }
}

function drawCloud(cloud) {
  ctx.fillStyle = "#d9d9d9";
  ctx.fillRect(cloud.x, cloud.y, 28, 8);
  ctx.fillRect(cloud.x + 10, cloud.y - 8, 22, 10);
  ctx.fillRect(cloud.x + 24, cloud.y, 18, 8);
}

function drawGround() {
  ctx.strokeStyle = "#535353";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(canvas.width, GROUND_Y);
  ctx.stroke();

  ctx.fillStyle = "#535353";
  const offset = Math.floor(state.distance) % 28;
  for (let x = -offset; x < canvas.width; x += 28) {
    ctx.fillRect(x + 8, GROUND_Y + 6, 8, 2);
    ctx.fillRect(x + 18, GROUND_Y + 12, 4, 2);
  }
}

function drawCactus(ob) {
  ctx.fillStyle = "#535353";
  ctx.fillRect(ob.x + ob.w / 2 - 3, ob.y, 6, ob.h);
  ctx.fillRect(ob.x, ob.y + 10, 7, 5);
  ctx.fillRect(ob.x, ob.y + 8, 3, 10);
  ctx.fillRect(ob.x + ob.w - 4, ob.y + 16, 4, 5);
  ctx.fillRect(ob.x + ob.w - 3, ob.y + 12, 3, 12);
}

function drawBird(ob) {
  ctx.fillStyle = "#535353";
  const flap = Math.floor(ob.frame) % 2 === 0;
  ctx.fillRect(ob.x + 10, ob.y + 10, 18, 8);
  ctx.fillRect(ob.x + 24, ob.y + 8, 8, 6);
  ctx.fillRect(ob.x + 30, ob.y + 10, 6, 3);
  if (flap) ctx.fillRect(ob.x + 14, ob.y, 6, 12);
  else ctx.fillRect(ob.x + 14, ob.y + 12, 6, 12);
}

function drawPlayer() {
  ctx.fillStyle = "#535353";
  const run = Math.floor(player.frame) % 2 === 0;
  if (state.ducking) {
    ctx.fillRect(player.x + 4, player.y + 8, 28, 16);
    ctx.fillRect(player.x + 26, player.y + 4, 10, 12);
    ctx.fillRect(player.x + 32, player.y + 6, 4, 3);
    ctx.fillRect(player.x + 6, player.y + 22, 8, 6);
    ctx.fillRect(player.x + 18, player.y + 22, 8, 6);
    return;
  }

  ctx.fillRect(player.x + 8, player.y + 10, 16, 22);
  ctx.fillRect(player.x + 18, player.y, 14, 14);
  ctx.fillRect(player.x + 28, player.y + 4, 4, 3);
  ctx.fillRect(player.x + 4, player.y + 14, 8, 4);
  if (!player.onGround) {
    ctx.fillRect(player.x + 8, player.y + 30, 6, 12);
    ctx.fillRect(player.x + 18, player.y + 30, 6, 12);
  } else if (run) {
    ctx.fillRect(player.x + 8, player.y + 32, 6, 14);
    ctx.fillRect(player.x + 20, player.y + 32, 6, 8);
  } else {
    ctx.fillRect(player.x + 8, player.y + 32, 6, 8);
    ctx.fillRect(player.x + 20, player.y + 32, 6, 14);
  }
}

function drawGameOver() {
  ctx.fillStyle = "#535353";
  ctx.font = "16px Courier New";
  ctx.textAlign = "center";
  ctx.fillText("G A M E  O V E R", canvas.width / 2, 88);
  ctx.strokeRect(canvas.width / 2 - 16, 108, 32, 28);
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2 - 6, 115);
  ctx.lineTo(canvas.width / 2 - 6, 129);
  ctx.lineTo(canvas.width / 2 + 8, 122);
  ctx.closePath();
  ctx.fill();
  ctx.textAlign = "left";
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const cloud of state.clouds) drawCloud(cloud);
  drawGround();
  for (const ob of state.obstacles) {
    if (ob.type === "bird") drawBird(ob);
    else drawCactus(ob);
  }
  drawPlayer();
  if (state.dead) drawGameOver();
  scoreEl.textContent = pad(state.score);
  hiScoreEl.textContent = pad(state.hi);
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
    jump();
  }
  if (isDuckKey(e)) {
    e.preventDefault();
    setDuck(true);
  }
});

window.addEventListener("keyup", (e) => {
  if (isDuckKey(e)) setDuck(false);
});

canvas.addEventListener("pointerdown", jump);

hiScoreEl.textContent = pad(state.hi);
requestAnimationFrame(loop);
