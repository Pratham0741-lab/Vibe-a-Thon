const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const menu = document.getElementById("menu");

/* ================= RESIZE ================= */
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener("resize", resize);

/* ================= ASSET LOADER ================= */
function loadImage(src) {
  const img = new Image();
  img.loaded = false;
  img.onload = () => (img.loaded = true);
  img.src = src;
  return img;
}

/* ================= IMAGES ================= */
const playerImg = loadImage("images/player.jpeg");
const enemyImg = loadImage("images/enemy.jpeg");
const bossImgs = {
  1: loadImage("images/boss1.png"),
  2: loadImage("images/boss2.jpg"),
  3: loadImage("images/final_boss.png")
};

/* ================= AUDIO ================= */
const bgm = {
  normal: new Audio("sounds/bgm.mp3"),
  boss1: new Audio("sounds/boss_bgm.mp3"),
  boss2: new Audio("sounds/boss_bgm2.mp3"),
  final: new Audio("sounds/final_boss_bgm.mp3")
};
Object.values(bgm).forEach(b => {
  b.loop = true;
  b.volume = 0.5;
});

function playBgm(key) {
  Object.values(bgm).forEach(b => {
    b.pause();
    b.currentTime = 0;
  });
  bgm[key]?.play().catch(() => {});
}

/* ================= STATE ================= */
let running = false;
let lastTime = 0;
let score = 0;
let lives = 3;
let level = 1;
let gameWon = false;
let gameOver = false;

/* ================= OBJECTS ================= */
const player = { x: 0, y: 0, w: 40, h: 40, speed: 420 };
let bullets = [];
let enemies = [];
let bossBullets = [];
let particles = [];
let powerUps = [];
let boss = null;
let bossSpawned = false;

/* ================= DIFFICULTY ================= */
const bossDifficulty = { 1: 1, 2: 3, 3: 6 };

/* ================= INPUT ================= */
let keys = {};
window.addEventListener("keydown", e => {
  keys[e.key] = true;
  if (e.key === "Enter" && !running) start();
});
window.addEventListener("keyup", e => (keys[e.key] = false));
menu.onclick = start;

/* ================= BACKGROUND ================= */
let stars = Array.from({ length: 140 }, () => ({
  x: Math.random() * canvas.width,
  y: Math.random() * canvas.height,
  s: 20 + Math.random() * 40
}));

function drawBackground(dt) {
  const grad = ctx.createRadialGradient(
    canvas.width / 2,
    canvas.height / 2,
    120,
    canvas.width / 2,
    canvas.height / 2,
    canvas.width
  );

  if (level === 1) {
    grad.addColorStop(0, "#0018ceff");
    grad.addColorStop(1, "#140018");
  } else if (level === 2) {
    grad.addColorStop(0, "#696103ff");
    grad.addColorStop(1, "#10002b");
  } else {
    grad.addColorStop(0, "rgba(33, 134, 28, 0.6)");
    grad.addColorStop(1, "#000");
  }

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "white";
  stars.forEach(s => {
    s.y += s.s * dt;
    if (s.y > canvas.height) s.y = 0;
    ctx.fillRect(s.x, s.y, 2, 2);
  });
}

/* ================= HELPERS ================= */
function hit(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function spawnParticles(x, y, c, n = 10) {
  for (let i = 0; i < n; i++) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 200,
      vy: (Math.random() - 0.5) * 200,
      life: 0.6,
      color: c
    });
  }
}

/* ================= START ================= */
function start() {
  running = true;
  gameWon = false;
  gameOver = false;
  menu.style.display = "none";

  score = 0;
  lives = 3;
  level = 1;

  bullets = [];
  enemies = [];
  bossBullets = [];
  particles = [];
  powerUps = [];

  boss = null;
  bossSpawned = false;

  player.x = canvas.width / 2 - 20;
  player.y = canvas.height - 70;

  lastTime = performance.now();
  playBgm("normal");
}

/* ================= MAIN LOOP ================= */
function loop(t) {
  const dt = Math.min((t - lastTime) / 1000, 0.033);
  lastTime = t;

  drawBackground(dt);

  if (!running) {
    if (gameWon) {
      ctx.fillStyle = "white";
      ctx.font = "64px Arial";
      ctx.fillText("YOU WIN", canvas.width / 2 - 150, canvas.height / 2);
    }
    requestAnimationFrame(loop);
    return;
  }

  /* PLAYER */
  if (keys["ArrowLeft"] && player.x > 0) player.x -= player.speed * dt;
  if (keys["ArrowRight"] && player.x + 40 < canvas.width)
    player.x += player.speed * dt;

  if (keys[" "] && Math.random() < 0.15)
    bullets.push({ x: player.x + 18, y: player.y, w: 4, h: 10, vy: -650 });

  ctx.drawImage(playerImg, player.x, player.y, 40, 40);

  /* BULLETS */
  for (let i = bullets.length - 1; i >= 0; i--) {
    bullets[i].y += bullets[i].vy * dt;
    ctx.fillStyle = "yellow";
    ctx.fillRect(bullets[i].x, bullets[i].y, 4, 10);
    if (bullets[i].y < 0) bullets.splice(i, 1);
  }

  /* ENEMIES */
  if (Math.random() < 0.02 && !boss)
    enemies.push({
      x: Math.random() * (canvas.width - 40),
      y: -40,
      w: 40,
      h: 40,
      speed: 120 + level * 30
    });

  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.y += e.speed * dt;
    ctx.drawImage(enemyImg, e.x, e.y, 40, 40);

    for (let j = bullets.length - 1; j >= 0; j--) {
      if (hit(bullets[j], e)) {
        bullets.splice(j, 1);
        enemies.splice(i, 1);
        score += 10;
        spawnParticles(e.x, e.y, "orange");
        break;
      }
    }

    if (hit(player, e)) {
      enemies.splice(i, 1);
      lives--;
      spawnParticles(player.x + 20, player.y + 20, "red", 12);
      if (lives <= 0) {
        running = false;
        gameOver = true;
        menu.style.display = "flex";
      }
    }
  }

  /* BOSS SPAWN */
  if (!bossSpawned &&
    ((level === 1 && score >= 100) ||
     (level === 2 && score >= 200) ||
     (level === 3 && score >= 300))) {

    const d = bossDifficulty[level];

    bossSpawned = true;
    boss = {
      x: canvas.width / 2 - 100,
      y: 40,
      w: 200,
      h: 100,
      hp: 120 + d * 20,
      dir: 1,
      fireT: 0,
      diff: d
    };

    playBgm(level === 1 ? "boss1" : level === 2 ? "boss2" : "final");
  }

  /* BOSS */
  if (boss) {
    boss.x += boss.dir * (180 + boss.diff * 25) * dt;
    if (boss.x < 0 || boss.x + boss.w > canvas.width) boss.dir *= -1;

    boss.fireT += dt;
    if (boss.fireT > Math.max(1.1 - boss.diff * 0.15, 0.4)) {
      const spread = Math.max((boss.diff - 1) * 2 + 1, 1);
      for (let i = -spread; i <= spread; i++) {
        bossBullets.push({
          x: boss.x + boss.w / 2 - 2,
          y: boss.y + boss.h,
          w: 4,
          h: 12,
          vx: i * (40 + boss.diff * 5),
          vy: 350 + boss.diff * 40
        });
      }
      boss.fireT = 0;
    }

    ctx.drawImage(bossImgs[level], boss.x, boss.y, boss.w, boss.h);

    ctx.fillStyle = "red";
    ctx.fillRect(canvas.width / 2 - 150, 20, 300, 10);
    ctx.fillStyle = "lime";
    ctx.fillRect(
      canvas.width / 2 - 150,
      20,
      (boss.hp / (120 + boss.diff * 20)) * 300,
      10
    );

    for (let i = bullets.length - 1; i >= 0; i--) {
      if (hit(bullets[i], boss)) {
        bullets.splice(i, 1);
        boss.hp--;
        spawnParticles(boss.x + 100, boss.y + 50, "violet");
      }
    }

    if (boss.hp <= 0) {
      spawnParticles(boss.x, boss.y, "violet", 40);
      boss = null;
      bossSpawned = false;
      level++;
      score = 0; // ✅ RESET SCORE ON NEW LEVEL
      if (level > 3) {
        running = false;
        gameWon = true;
        Object.values(bgm).forEach(b => b.pause());
      } else {
        playBgm("normal");
      }
    }
  }

  /* BOSS BULLETS */
  for (let i = bossBullets.length - 1; i >= 0; i--) {
    bossBullets[i].x += bossBullets[i].vx * dt;
    bossBullets[i].y += bossBullets[i].vy * dt;
    ctx.fillStyle = "red";
    ctx.fillRect(bossBullets[i].x, bossBullets[i].y, 4, 12);

    if (hit(player, bossBullets[i])) {
      bossBullets.splice(i, 1);
      lives--;
      if (lives <= 0) {
        running = false;
        menu.style.display = "flex";
      }
    }

    if (
      bossBullets[i].y > canvas.height ||
      bossBullets[i].x < 0 ||
      bossBullets[i].x > canvas.width
    ) {
      bossBullets.splice(i, 1);
    }
  }

  /* PARTICLES */
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 2, 2);
    if (p.life <= 0) particles.splice(i, 1);
  }

  /* HUD */
  ctx.fillStyle = "white";
  ctx.font = "16px Arial";
  ctx.fillText("Score: " + score, 20, 30);
  ctx.fillText("Lives: " + lives, 20, 55);
  ctx.fillText("Level: " + level, 20, 80);

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
