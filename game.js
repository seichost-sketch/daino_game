const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;
const scoreEl = document.getElementById("score");
const hiScoreEl = document.getElementById("hi-score");
const coinsEl = document.getElementById("coins");
const statusEl = document.getElementById("status");
const buyJetEl = document.getElementById("buy-jetpack");
const jetOwnedEl = document.getElementById("jet-owned");

const GROUND_Y = 412;
const GRAVITY = 0.72;
const CHAR_PX = 4;
const ITEM_PX = 3;
const DUCK_HEIGHT = 16 * CHAR_PX;
const STAND_HEIGHT = 32 * CHAR_PX;
const FLAME_ROWS = 27;
const FLAME_HEIGHT = FLAME_ROWS * CHAR_PX;
const JUMP_VELOCITY = -16.2;
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
  invincible: { label: "Gapple", color: "#f1c232", icon: "G" },
  speed: { label: "Mace", color: "#8b909a", icon: "M" },
  jump: { label: "Wind Charge", color: "#d7f0ff", icon: "W" },
  float: { label: "Elytra", color: "#a8b4d8", icon: "E" },
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
  obstacles: [
    { type: "flame", x: 780, y: GROUND_Y - FLAME_HEIGHT, w: 16 * CHAR_PX, h: FLAME_HEIGHT, tall: true },
    { type: "parrot", x: 960, y: GROUND_Y - 200, w: 16 * CHAR_PX, h: 32 * CHAR_PX, frame: 0 },
  ],
  powers: [
    { type: "invincible", x: 220, y: GROUND_Y - 118, w: 48, h: 48, bob: 0 },
    { type: "speed", x: 360, y: GROUND_Y - 138, w: 48, h: 48, bob: 1 },
    { type: "jump", x: 500, y: GROUND_Y - 118, w: 48, h: 48, bob: 2 },
    { type: "float", x: 640, y: GROUND_Y - 132, w: 48, h: 48, bob: 3 },
  ],
  maceShout: 0,
  maceMile: 0,
  maceBoost: 1,
  buffs: { invincible: 0, speed: 0, jump: 0, float: 0 },
  clouds: [
    { x: 180, y: 42, s: 1 },
    { x: 430, y: 28, s: 0.7 },
    { x: 720, y: 54, s: 1.1 },
  ],
};

const player = {
  x: 88,
  y: GROUND_Y - STAND_HEIGHT,
  w: 16 * CHAR_PX,
  h: STAND_HEIGHT,
  vy: 0,
  onGround: true,
  canDouble: false,
  flipping: false,
  flip: 0,
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
  state.maceShout = 0;
  state.maceMile = 0;
  state.maceBoost = 1;
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
  player.canDouble = false;
  player.flipping = false;
  player.flip = 0;
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
  const boost = hasBuff("jump") ? 1.42 : 1;
  if (player.onGround && !state.ducking) {
    player.vy = JUMP_VELOCITY * boost;
    player.onGround = false;
    player.canDouble = true;
    return;
  }
  if (player.canDouble && !player.onGround) {
    player.vy = JUMP_VELOCITY * 0.95 * boost;
    player.canDouble = false;
    player.flipping = true;
    player.flip = 0;
  }
}

function hasBuff(name) {
  return state.buffs[name] > 0;
}

function activatePower(kind) {
  state.buffs[kind] = BUFF_TIME;
  statusEl.textContent = POWER_META[kind].label;
}

function maceAttack() {
  state.maceShout = 90;
  state.maceBoost *= 1.2;
  statusEl.textContent = `MACE ATTACK · ${Math.round(state.maceBoost * 100)}% speed`;
  for (const ob of state.obstacles) {
    ob.scared = true;
    ob.vy = ob.type === "parrot" ? -7.5 : -9;
    ob.vx = 7 + Math.random() * 5;
    ob.spin = 0;
  }
}

function spawnPower(kind, x) {
  const type = kind || POWER_TYPES[Math.floor(Math.random() * POWER_TYPES.length)];
  const high = Math.random() < 0.55;
  state.powers.push({
    type,
    x: x ?? canvas.width + 30,
    y: high ? GROUND_Y - 130 : GROUND_Y - 80,
    w: 36,
    h: 36,
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
  if (lastObstacleX() > canvas.width - 280) return;

  const roll = Math.random();
  if (roll < 0.2 && state.score > 80) {
    state.obstacles.push({
      type: "parrot",
      x: canvas.width + 40,
      y: Math.random() < 0.45 ? GROUND_Y - 200 : GROUND_Y - 268,
      w: 16 * CHAR_PX,
      h: 32 * CHAR_PX,
      frame: 0,
    });
    return;
  }

  const count = Math.random() < 0.28 ? 2 : 1;
  const tall = Math.random() < 0.38;
  const gap = 16 * CHAR_PX + 36;
  for (let i = 0; i < count; i += 1) {
    const h = FLAME_HEIGHT;
    state.obstacles.push({
      type: "flame",
      x: canvas.width + 40 + i * gap,
      y: GROUND_Y - h,
      w: 16 * CHAR_PX,
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
  player.frame += dt * (state.ducking ? 0.28 : 0.2) * state.maceBoost;
  if (!state.running) return;

  for (const key of POWER_TYPES) {
    if (state.buffs[key] > 0) state.buffs[key] -= dt;
  }
  if (
    POWER_TYPES.every((key) => state.buffs[key] <= 0) &&
    !state.dead &&
    state.jetFuel <= 0 &&
    !statusEl.textContent.includes("Jetpack") &&
    !statusEl.textContent.includes("MACE")
  ) {
    statusEl.textContent = "";
  }

  const baseSpeed = START_SPEED + Math.min(MAX_SPEED - START_SPEED, state.score / 420);
  let nextSpeed = baseSpeed * state.maceBoost;
  if (hasBuff("speed")) nextSpeed *= 1.48;
  state.speed = nextSpeed;
  state.distance += state.speed * dt;
  state.score += dt * 0.18;
  const mile = Math.floor(state.score / 100);
  if (mile > state.maceMile) {
    state.maceMile = mile;
    maceAttack();
  }

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
  if (player.flipping) {
    player.flip += dt * 0.048;
    if (player.flip >= 1) {
      player.flip = 0;
      player.flipping = false;
    }
  }
  if (player.y >= GROUND_Y - player.h) {
    player.y = GROUND_Y - player.h;
    player.vy = 0;
    player.onGround = true;
    player.canDouble = false;
    player.flipping = false;
    player.flip = 0;
  } else {
    player.onGround = false;
    state.ducking = false;
    player.h = STAND_HEIGHT;
  }

  const pace = state.speed / START_SPEED;
  state.nextSpawn -= dt * pace;
  if (state.nextSpawn <= 0) {
    spawnObstacle();
    state.nextSpawn = 72 + Math.random() * 54;
  }

  state.nextPower -= dt * pace;
  if (state.nextPower <= 0) {
    if (Math.random() < 0.42 && lastObstacleX() < canvas.width - 140) spawnPower();
    state.nextPower = 110 + Math.random() * 90;
  }

  for (const cloud of state.clouds) {
    cloud.x -= state.speed * 0.22 * cloud.s * dt;
    if (cloud.x < -80) {
      cloud.x = canvas.width + 40 + Math.random() * 120;
      cloud.y = 24 + Math.random() * 40;
    }
  }

  if (state.maceShout > 0) state.maceShout -= dt;

  for (const ob of state.obstacles) {
    if (ob.scared) {
      ob.vy += 0.55 * dt;
      ob.y += ob.vy * dt;
      ob.x += ob.vx * dt;
      ob.spin = (ob.spin || 0) + dt * 0.25;
      if (ob.type === "parrot") ob.frame += 0.3 * dt;
    } else {
      ob.x -= state.speed * dt;
      if (ob.type === "parrot") ob.frame += 0.18 * dt;
    }
  }
  state.obstacles = state.obstacles.filter(
    (ob) => ob.x + ob.w > -40 && ob.x < canvas.width + 80 && ob.y < canvas.height + 40
  );

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
      if (ob.scared) continue;
      const obBox =
        ob.type === "parrot"
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
  ellipse(canvas.width - 90, 48, 26, 26);
  ctx.fillStyle = "rgba(255, 226, 122, 0.28)";
  ellipse(canvas.width - 90, 48, 44, 44);

  ctx.fillStyle = "#d9b57a";
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.quadraticCurveTo(160, GROUND_Y - 70, 320, GROUND_Y);
  ctx.quadraticCurveTo(520, GROUND_Y - 92, 720, GROUND_Y);
  ctx.quadraticCurveTo(900, GROUND_Y - 64, canvas.width, GROUND_Y);
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

const PIX = {
  wemmbu: {
    P: "#c44dff",
    L: "#e38aff",
    M: "#a133e0",
    D: "#6a18b8",
    Y: "#ffe14a",
    C: "#e0b41a",
    K: "#1a0a22",
  },
  flame: {
    B: "#0a0a0a",
    N: "#1c1c1c",
    R: "#e22218",
    A: "#9a1c12",
    O: "#ff7a14",
    Y: "#ffd428",
    S: "#e8b090",
    F: "#ff9a2a",
  },
  parrot: {
    G: "#6ad13a",
    N: "#3e9e24",
    F: "#ead7b0",
    E: "#c8b080",
    K: "#151515",
    C: "#3db8c4",
    H: "#7ee0e8",
    T: "#2a9aaa",
    O: "#e07030",
    Q: "#c45a20",
    Y: "#e8c840",
  },
  apple: {
    Y: "#f4c431",
    G: "#ffe566",
    W: "#fff8c8",
    O: "#d4a020",
    B: "#b8860b",
    D: "#7a4e10",
    L: "#3fa34d",
    N: "#2d7a38",
    S: "#6b3a12",
  },
  mace: {
    G: "#d4d6dc",
    M: "#9aa0a8",
    D: "#5c6168",
    H: "#2a2d32",
    P: "#7a6ad4",
    V: "#5a4cb0",
    B: "#4a7dff",
    C: "#2a5ad4",
  },
  wind: {
    W: "#ffffff",
    A: "#e8f2ff",
    B: "#c5d8f0",
    C: "#9bb6dc",
    D: "#7a96c4",
    E: "#5a78a8",
  },
  elytra: {
    G: "#8b95a8",
    L: "#c5ccd8",
    M: "#a8b0c0",
    D: "#5c6574",
    S: "#3d4450",
    N: "#2a3038",
  },
};

function drawPixels(x, y, size, rows, pal) {
  for (let r = 0; r < rows.length; r += 1) {
    const line = rows[r];
    for (let c = 0; c < line.length; c += 1) {
      const ch = line[c];
      if (ch === "." || ch === " ") continue;
      ctx.fillStyle = pal[ch];
      ctx.fillRect(x + c * size, y + r * size, size, size);
    }
  }
}

const SPRITE = {
  wemmbu: [
    "....YYYYYYYY....",
    "....YYCCYYYY....",
    "....PPPPPPPP....",
    "....PLPMPPPL....",
    "....PKKPPKKP....",
    "....PKKPPKKP....",
    "....PPPPPPPP....",
    "....P.PPPP.P....",
    "....PP....PP....",
    "....PPKKKKPP....",
    "DDDDPLPPPPPLDDDD",
    "DDDDPPPPMPPPDDDD",
    "DDDDPPPPPPPPDDDD",
    "DDDDPPPPPPPPDDDD",
    "DDDDPPPPPPPPDDDD",
    "DDDDPPPPPPPPDDDD",
    "DDDDPPPPPPPPDDDD",
    "DDDDPPPPPPPPDDDD",
    "DDDDPPPPPPPPDDDD",
    "DDDDPPPPPPPPDDDD",
    "DDDDPPPPPPPPDDDD",
    "DDDDPPPPPPPPDDDD",
    "....DDDDMMDD....",
    "....DDDDDDDD....",
    "....DDDDDDDD....",
    "....DDDDDDDD....",
    "....DDDD..DD....",
    "....DDDD..DD....",
    "....DDDD..DD....",
    "....DDDD..DD....",
    "....DDDD..DD....",
    "....DDDD..DD....",
  ],
  wemmbuDuck: [
    "....YYYYYYYY....",
    "....YYCCYYYY....",
    "....PPPPPPPP....",
    "....PKKPPKKP....",
    "....PKKPPKKP....",
    "....PPKKKKPP....",
    "DDDDPPPPPPPPDDDD",
    "DDDDPLPPMPPLDDDD",
    "DDDDPPPPPPPPDDDD",
    "DDDDPPPPPPPPDDDD",
    "....DDDDDDDD....",
    "....DDDDDDDD....",
    "....DDDD..DD....",
    "....DDDD..DD....",
    "....DDDD..DD....",
    "....DDDD..DD....",
  ],
  flame: [
    "....BBBBBBBB....",
    "....BRRYYYNB....",
    "....BRROOYNB....",
    "....BBRRRYNB....",
    "....BNNNNNNB....",
    "....BBSSSSBB....",
    "YOOOBBBBBBBBAAAA",
    "YFOOBBORYOBBAAAA",
    "OOOOBBOYYOBBAAAA",
    "YFOOBBORYOBBAAAA",
    "OOOOBBBRRBBBAAAA",
    "YOOOBYYYYYBBAAAA",
    "OOOOBBOORRBBAAAA",
    ".AAANBBBBBNNAAA.",
    ".AAANBRRRRNNAAA.",
    ".AAANBBBBBNNAAA.",
    "....NBBBBBNN....",
    "....NBBYYBNB....",
    "....NBBBBBNN....",
    "....AABBAABB....",
    "....NBBBBBNN....",
    "....NBBB..NN....",
    "....NBBB..NN....",
    "....YYBB..YY....",
    "....YYBB..YY....",
    "....AABB..AA....",
    "....AABB..AA....",
  ],
  parrot: [
    "....GGGGGGGG....",
    "....GNGGGGNG....",
    "....GFFFFFFG....",
    "....GEFFFFEG....",
    "....GFKFFKFG....",
    "....GFKKKKFG....",
    "....GFFFFFFG....",
    "....GGEEEEGG....",
    "QQOOCHHHHHHCQQOO",
    "QQOOCCHHHHCCQQOO",
    "NNOOCCCCCCCCNNOO",
    "NNOOTCCCCCCTNNOO",
    "..NNTCCCCCCTNN..",
    "..NNTCCCCCCTNN..",
    "..TTTCCCCCCTTT..",
    "..TTTCCCCCCTTT..",
    "..TTTCCCCCCTTT..",
    "..TTTCCCCCCTTT..",
    "..TTTCCCCCCTTT..",
    "..TTTCCCCCCTTT..",
    "....TTCCCCTT....",
    "....TTCCCCTT....",
    "....TTCCCCTT....",
    "....TTCCCCTT....",
    "....TTCC..TT....",
    "....TTCC..TT....",
    "....TTCC..TT....",
    "....TTCC..TT....",
    "....YYCC..YY....",
    "....YYCC..YY....",
    "....YY....YY....",
    "....YY....YY....",
  ],
  parrotFlap: [
    "....GGGGGGGG....",
    "....GNGGGGNG....",
    "....GFFFFFFG....",
    "....GEFFFFEG....",
    "....GFKFFKFG....",
    "....GFKKKKFG....",
    "....GFFFFFFG....",
    "....GGEEEEGG....",
    "OO..CHHHHHHC..OO",
    "QOOOCCHHHHCCQOOO",
    "NNOOCCCCCCCCNNOO",
    "NNOOTCCCCCCTNNOO",
    "..NNTCCCCCCTNN..",
    "..NNTCCCCCCTNN..",
    "..TTTCCCCCCTTT..",
    "..TTTCCCCCCTTT..",
    "..TTTCCCCCCTTT..",
    "..TTTCCCCCCTTT..",
    "..TTTCCCCCCTTT..",
    "..TTTCCCCCCTTT..",
    "....TTCCCCTT....",
    "....TTCCCCTT....",
    "....TTCCCCTT....",
    "....TTCCCCTT....",
    "....TTCC..TT....",
    "....TTCC..TT....",
    "....TTCC..TT....",
    "....TTCC..TT....",
    "....YYCC..YY....",
    "....YYCC..YY....",
    "....YY....YY....",
    "....YY....YY....",
  ],
  apple: [
    "......SS........",
    "......SS.LN.....",
    ".....S..LLN.....",
    "....S..LLLN.....",
    "...BBBBBBBBB....",
    "..BWWGYYYYYDB...",
    ".BGWYYYYYYYYB...",
    ".BWYYYYYYYYODB..",
    ".BYYYYYYYYYODB..",
    ".BYYYYYYYYYODB..",
    ".BYYYYYYYYYGDB..",
    "..BYYYYYYYODB...",
    "..BOYYYYYYDB....",
    "...BOYYYYDB.....",
    "....BBOOBB......",
    ".....BBBB.......",
  ],
  mace: [
    "...GGMMMMGG.....",
    "..GMMGGGGMMG....",
    ".GMMHHHHHHMMG...",
    ".GMHH....HHMG...",
    ".GMHH.HH.HHMG...",
    ".GMHH....HHMG...",
    ".GMMHHHHHHMMG...",
    "..GMMHHHHMMG....",
    "...GGMDMDGG.....",
    "......PV........",
    ".....PVBC.......",
    "....PVBBC.......",
    "...PVBBC........",
    "..PVBCC.........",
    ".PVVCC..........",
    ".PHHH...........",
  ],
  wind: [
    "......AAAA......",
    "....AAWWWWAA....",
    "...AWWWWWWWWA...",
    "..CWWWAWWWWAWC..",
    ".AWWWWWWWWWWWWA.",
    "EWWWAWWWWWWWAWWE",
    "CWWWWWWWWWWWWWWC",
    "BWWWAWWWWWWWAWWB",
    "CWWWWWWWWWWWWWWC",
    "EWWWAWWWWWWWAWWE",
    ".AWWWWWWWWWWWWA.",
    "..CWWWAWWWWAWC..",
    "...AWWWWWWWWA...",
    "....DAWWWWAD....",
    ".....DDAADD.....",
    "......EEEE......",
  ],
  elytra: [
    "LLMDDDD..DDDDMLL",
    "LGMDDDD..DDDDMGL",
    "LGGMDDD..DDDMGGL",
    "LGGGGDD..DDGGGGL",
    ".LGGGGD..DGGGGL.",
    ".LMGGGG..GGGMLL.",
    "..LLGGG..GGGLL..",
    "..LLMGG..GGMLL..",
    "...LLGG..GGLL...",
    "...LLSS..SSLL...",
    "....LSS..SSL....",
    "....NSS..SSN....",
    ".....NN..NN.....",
  ],
};

function drawScared(ob, drawFn) {
  ctx.save();
  ctx.translate(ob.x + ob.w / 2, ob.y + ob.h / 2);
  ctx.rotate(ob.spin || 0);
  ctx.translate(-(ob.x + ob.w / 2), -(ob.y + ob.h / 2));
  drawFn();
  ctx.fillStyle = "#fff4d6";
  ctx.font = "bold 14px Courier New";
  ctx.fillText("!", ob.x + ob.w + 2, ob.y + 8);
  ctx.restore();
}

function drawFlameFrags(ob) {
  const paint = () => drawPixels(ob.x, ob.y, CHAR_PX, SPRITE.flame, PIX.flame);
  if (ob.scared) drawScared(ob, paint);
  else paint();
}

function drawParrotX2(ob) {
  const bob = Math.sin(ob.frame) * 2;
  const rows = Math.floor(ob.frame) % 2 === 0 ? SPRITE.parrot : SPRITE.parrotFlap;
  const paint = () => drawPixels(ob.x, ob.y + bob, CHAR_PX, rows, PIX.parrot);
  if (ob.scared) drawScared(ob, paint);
  else paint();
}

function drawPower(power) {
  const y = power.y + Math.sin(power.bob) * 5;
  if (power.type === "invincible") drawPixels(power.x - 8, y - 12, ITEM_PX, SPRITE.apple, PIX.apple);
  else if (power.type === "speed") drawPixels(power.x - 8, y - 16, ITEM_PX, SPRITE.mace, PIX.mace);
  else if (power.type === "jump") drawPixels(power.x - 8, y - 12, ITEM_PX, SPRITE.wind, PIX.wind);
  else drawPixels(power.x - 12, y - 10, ITEM_PX, SPRITE.elytra, PIX.elytra);
}

function drawPlayer() {
  const run = Math.floor(player.frame) % 2 === 0;
  const x = player.x;
  const feet = player.y + player.h;
  if (hasBuff("invincible") && Math.floor(player.frame * 4) % 2 === 0) {
    ctx.fillStyle = "rgba(241, 194, 50, 0.35)";
    ellipse(x + 32, player.y + 52, 44, 50);
  }
  if (hasBuff("speed")) {
    ctx.fillStyle = "rgba(154, 160, 168, 0.45)";
    ctx.fillRect(x - 16, player.y + 28, 14, 3);
    ctx.fillRect(x - 10, player.y + 38, 10, 3);
  }

  const rows = state.ducking ? SPRITE.wemmbuDuck : SPRITE.wemmbu.slice();
  if (!state.ducking && player.onGround) {
    if (run) {
      rows[26] = "....DDDD...DD...";
      rows[27] = "....DDDD....DD..";
      rows[28] = "....DDDD....DD..";
      rows[29] = "....DDDD....DD..";
      rows[30] = "....DDDD....DD..";
      rows[31] = "....DDDD....DD..";
    } else {
      rows[26] = "...DD...DDDD....";
      rows[27] = "..DD....DDDD....";
      rows[28] = "..DD....DDDD....";
      rows[29] = "..DD....DDDD....";
      rows[30] = "..DD....DDDD....";
      rows[31] = "..DD....DDDD....";
    }
  }
  const spriteH = rows.length * CHAR_PX;
  const spriteW = 16 * CHAR_PX;
  const sy = feet - spriteH;
  ctx.save();
  if (player.flipping) {
    ctx.translate(x + spriteW / 2, sy + spriteH / 2);
    ctx.rotate(-player.flip * Math.PI * 2);
    ctx.translate(-(x + spriteW / 2), -(sy + spriteH / 2));
  }
  if (hasBuff("float")) drawPixels(x - 8, sy + 28, CHAR_PX, SPRITE.elytra, PIX.elytra);
  drawPixels(x, sy, CHAR_PX, rows, PIX.wemmbu);
  if (state.jetFuel > 0) {
    ctx.fillStyle = "#4a5560";
    ctx.fillRect(x + 8, sy + 44, 14, 28);
    if (state.holdingJump) {
      ctx.fillStyle = "#ffb347";
      ctx.fillRect(x + 11, sy + 72, 8, 14);
    }
  }
  ctx.restore();
}

function drawMaceShout() {
  if (state.maceShout <= 0) return;
  const shake = Math.sin(state.maceShout * 0.8) * 4;
  ctx.save();
  ctx.translate(shake, 0);
  ctx.fillStyle = "rgba(40, 10, 50, 0.72)";
  ctx.beginPath();
  ctx.roundRect(canvas.width / 2 - 170, 28, 340, 58, 10);
  ctx.fill();
  ctx.fillStyle = "#ffe14a";
  ctx.font = "bold 28px Courier New";
  ctx.textAlign = "center";
  ctx.fillText("MACE ATTACK", canvas.width / 2, 66);
  ctx.textAlign = "left";
  ctx.fillStyle = "#fff4d6";
  ctx.font = "12px Courier New";
  ctx.fillText("MACE ATTACK!", player.x + 68, player.y + 10);
  ctx.restore();
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
    ctx.roundRect(x, 10, 102, 18, 6);
    ctx.fill();
    ctx.fillStyle = meta.color;
    ctx.fillRect(x + 6, 24, 90 * t, 2);
    ctx.fillStyle = "#fff8e4";
    ctx.font = "11px Courier New";
    ctx.fillText(meta.label, x + 8, 22);
    x += 110;
  }
}

function drawGameOver() {
  const cx = canvas.width / 2;
  const top = 88;
  ctx.fillStyle = "rgba(40, 24, 8, 0.78)";
  ctx.beginPath();
  ctx.roundRect(cx - 280, top, 560, 220, 18);
  ctx.fill();
  ctx.strokeStyle = "#ffe27a";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = "#fff4d6";
  ctx.font = "bold 42px Courier New";
  ctx.textAlign = "center";
  ctx.fillText("G A M E  O V E R", cx, top + 70);
  ctx.fillStyle = "#ffe27a";
  ctx.font = "24px Courier New";
  ctx.fillText(`+${state.earned} coins  ·  bank ${pad(state.coins)}`, cx, top + 118);
  ctx.font = "18px Courier New";
  ctx.fillStyle = "#fff4d6";
  ctx.fillText("press Space or click to restart", cx, top + 152);
  ctx.fillStyle = "#ffe27a";
  ctx.beginPath();
  ctx.roundRect(cx - 32, top + 168, 64, 40, 8);
  ctx.fill();
  ctx.fillStyle = "#3d2a12";
  ctx.beginPath();
  ctx.moveTo(cx - 12, top + 176);
  ctx.lineTo(cx - 12, top + 200);
  ctx.lineTo(cx + 18, top + 188);
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
    if (ob.type === "parrot") drawParrotX2(ob);
    else drawFlameFrags(ob);
  }
  for (const power of state.powers) drawPower(power);
  drawPlayer();
  drawMaceShout();
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
    if (e.repeat) return;
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
