const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const menu = document.getElementById("menu");

// Set Fullscreen
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener("resize", resize);

/* ================= SYNTHETIC AUDIO ENGINE ================= */
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

// Generate White Noise Buffer for Explosions
const bufferSize = audioCtx.sampleRate * 2;
const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
const data = noiseBuffer.getChannelData(0);
for (let i = 0; i < bufferSize; i++) {
  data[i] = Math.random() * 2 - 1;
}

const sfx = {
  shoot: () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    // "Nail Art" Slash Sound
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(600, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
  },

  explosion: () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;
    const noiseFilter = audioCtx.createBiquadFilter();
    const noiseGain = audioCtx.createGain();

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);

    noiseFilter.type = "lowpass";
    noiseFilter.frequency.value = 500;

    noiseGain.gain.setValueAtTime(0.4, audioCtx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);

    noise.start();
    noise.stop(audioCtx.currentTime + 0.6);
  },

  roar: () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(100, audioCtx.currentTime);
    osc.frequency.linearRampToValueAtTime(50, audioCtx.currentTime + 1.0);

    gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.0);

    osc.start();
    osc.stop(audioCtx.currentTime + 1.0);
  }
};

const bgm = {
  normal: new Audio("sound/bgm.mp3"),
  boss1: new Audio("sound/boss_bgm.mp3"),
  boss2: new Audio("sound/boss_bgm2.mp3"),
  final: new Audio("sound/final_boss_bgm.mp3")
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
  if (audioCtx.state === 'suspended') audioCtx.resume();
  bgm[key]?.play().catch(e => console.log("Audio play failed (interact first):", e));
}

function stopAllBgm() {
  Object.values(bgm).forEach(b => {
    b.pause();
    b.currentTime = 0;
  });
}

/* ================= CONFIG ================= */
const COLORS = {
  player: "#0ff",
  enemy: "#ff8800",
  boss: "#f00",
  bullet: "#ff0",
  bg_normal: "#000510"
};

/* ================= STATE ================= */
let game = {
  running: false,
  score: 0,
  lives: 5,
  level: 1,
  shake: 0,
  frames: 0,
  theme: "normal"
};

let player = {
  x: canvas.width / 2,
  y: canvas.height - 100,
  w: 30, h: 30,
  speed: 4,
  dx: 0,
  weaponLevel: 1,
  shield: false
};

let bullets = [];
let enemies = [];
let particles = [];
let powerups = [];
let boss = null;
let stars = [];
let celestialObjects = []; // Renamed from planets

/* ================= INPUT ================= */
const keys = {};
window.addEventListener("keydown", e => {
  keys[e.key] = true;
  if (e.key === "Enter" && !game.running) initGame();
  if (e.key === "p") {
    game.running = !game.running;
  }
});
window.addEventListener("keyup", e => keys[e.key] = false);
menu.onclick = initGame;

/* ================= UI & THEME MANAGER ================= */
function updateUITheme() {
  if (game.theme === "normal") {
    canvas.style.boxShadow = "0 0 50px rgba(0, 255, 255, 0.2)";
    canvas.style.borderColor = "#333";
  } else if (game.theme === "boss1") {
    canvas.style.boxShadow = "0 0 100px rgba(255, 0, 0, 0.8)";
    canvas.style.borderColor = "#800";
  } else if (game.theme === "boss2") {
    canvas.style.boxShadow = "0 0 80px rgba(0, 255, 0, 0.8)";
    canvas.style.borderColor = "#0f0";
  } else if (game.theme === "boss3") {
    const breath = 150 + Math.sin(game.frames * 0.05) * 50;
    canvas.style.boxShadow = `inset 0 0 ${breath}px rgba(0, 0, 0, 1)`;
    canvas.style.borderColor = "#202";
  }
}

function drawBossHealthBar() {
  if (!boss) return;

  const w = 400;
  const h = 20;
  const x = canvas.width / 2 - w / 2;
  const y = 80;

  let color = "#f00";
  let name = boss.name || "BOSS";

  if (game.level === 2) color = "#0f0";
  if (game.level >= 3) color = "#d0f";

  if (boss.phase === 2) {
    if (game.level === 2) color = "#f00";
    if (game.level === 3) color = "#fff";
  }

  ctx.save();

  ctx.fillStyle = color;
  ctx.font = "bold 24px Orbitron";
  ctx.textAlign = "center";
  ctx.shadowBlur = 10;
  ctx.shadowColor = color;

  if (game.level === 1) {
    const sx = (Math.random() - 0.5) * 2;
    ctx.fillText(name, canvas.width / 2 + sx, y - 15);
  } else if (game.level === 2) {
    if (boss.phase === 2) {
      const gx = (Math.random() - 0.5) * 10;
      const gy = (Math.random() - 0.5) * 10;
      ctx.fillText(name, canvas.width / 2 + gx, y - 15 + gy);
    } else {
      if (Math.random() < 0.1) name = name.replace(/[AEIOU]/g, "#");
      ctx.fillText(name, canvas.width / 2, y - 15);
    }
  } else {
    ctx.globalAlpha = 0.6 + Math.sin(game.frames * 0.1) * 0.4;
    ctx.fillText(name, canvas.width / 2, y - 15);
    ctx.globalAlpha = 1.0;
  }

  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);

  const pct = Math.max(0, boss.hp / boss.maxHp);
  ctx.fillStyle = color;

  if (game.level === 2 && Math.random() < 0.05) {
    ctx.fillStyle = "#fff";
  }

  ctx.fillRect(x, y, w * pct, h);

  ctx.restore();
}

/* ================= DRAWING HELPERS ================= */
function drawGlow(color, blur = 20) {
  ctx.shadowBlur = blur;
  ctx.shadowColor = color;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
}

function resetGlow() {
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
  ctx.globalCompositeOperation = "source-over";
  ctx.filter = "none";
}

function drawPoly(x, y, radius, sides, color, rotation = 0, stroke = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  drawGlow(color);
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  for (let i = 1; i < sides; i++) {
    const angle = (i * 2 * Math.PI) / sides;
    ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  ctx.closePath();
  if (stroke) {
    ctx.lineWidth = 3;
    ctx.stroke();
  } else {
    ctx.fill();
  }
  ctx.restore();
  resetGlow();
}

function drawEnemy(e) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(Math.sin(game.frames * 0.1 + e.x) * 0.1);

  ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
  const flap = Math.sin(game.frames * 0.5) * 10;
  ctx.beginPath();
  ctx.ellipse(-15, -10 + flap, 12, 5, -0.5, 0, Math.PI * 2);
  ctx.ellipse(15, -10 + flap, 12, 5, 0.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#222";
  ctx.beginPath();
  ctx.ellipse(0, 0, 12, 15, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#555";
  ctx.beginPath();
  ctx.moveTo(-5, 10); ctx.lineTo(-8, 20); ctx.lineTo(-2, 15);
  ctx.moveTo(5, 10); ctx.lineTo(8, 20); ctx.lineTo(2, 15);
  ctx.fill();

  ctx.shadowBlur = 5;
  ctx.shadowColor = "#ff4400";
  ctx.fillStyle = "#ff8800";
  ctx.beginPath();
  ctx.arc(-4, -2, 3, 0, Math.PI * 2);
  ctx.arc(4, -2, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.restore();
}

/* --- BOSS RENDERER --- */
function drawBossModel(b) {
  if (game.level === 1) {
    // === BOSS 1: THE SUN (Radiance Design) ===

    ctx.globalCompositeOperation = "lighter";

    ctx.strokeStyle = "#ff4500";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.shadowBlur = 20;
    ctx.shadowColor = "#ff0000";

    ctx.beginPath();
    const rayCount = 10;
    for (let i = 0; i < rayCount; i++) {
      const angle = (i * (Math.PI * 2) / rayCount) + (game.frames * 0.02);
      const startR = 50;
      const endR = 100 + Math.sin(game.frames * 0.2 + i) * 20;

      ctx.moveTo(b.x + Math.cos(angle) * startR, b.y + Math.sin(angle) * startR);
      ctx.lineTo(b.x + Math.cos(angle) * endR, b.y + Math.sin(angle) * endR);
    }
    ctx.stroke();

    const wingColor = "rgba(255, 100, 0, 0.8)";
    ctx.fillStyle = wingColor;

    const drawWing = (flip) => {
      ctx.save();
      ctx.translate(b.x, b.y);
      if (flip) ctx.scale(-1, 1);
      ctx.rotate(Math.sin(game.frames * 0.05) * 0.1);

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-120, -100, -220, -50, -240, 0);
      ctx.bezierCurveTo(-200, 50, -100, 120, 0, 60);
      ctx.fill();
      ctx.restore();
    }

    drawWing(false);
    drawWing(true);

    const sunGrad = ctx.createRadialGradient(b.x, b.y, 10, b.x, b.y, 60);
    sunGrad.addColorStop(0, "#fff");
    sunGrad.addColorStop(0.3, "#ffaa00");
    sunGrad.addColorStop(1, "#ff0000");

    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 50, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.shadowBlur = 30;
    ctx.shadowColor = "#fff";
    ctx.beginPath();
    ctx.ellipse(b.x - 15, b.y - 10, 8, 20, 0.2, 0, Math.PI * 2);
    ctx.ellipse(b.x + 15, b.y - 10, 8, 20, -0.2, 0, Math.PI * 2);
    ctx.fill();

    resetGlow();
  }
  else if (game.level === 2) {
    // === BOSS 2: THE SERAPH VIRUS (Silk Matriarch) ===

    if (b.phase === 1) {
      ctx.globalCompositeOperation = "lighter";

      ctx.save();
      ctx.translate(b.x + 60, b.y);
      ctx.rotate(Math.PI / 4 + Math.sin(game.frames * 0.1) * 0.2);
      ctx.fillStyle = "#fff";
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#0f0";
      ctx.beginPath();
      ctx.moveTo(0, -100); ctx.lineTo(5, 100); ctx.lineTo(-5, 100);
      ctx.fill();
      ctx.strokeStyle = "#0f0"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, -90, 10, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();

      ctx.fillStyle = "rgba(100, 255, 150, 0.6)";
      ctx.shadowBlur = 20;
      ctx.shadowColor = "#0f0";
      ctx.beginPath();
      ctx.moveTo(b.x, b.y - 50);
      const wave = Math.sin(game.frames * 0.08) * 15;
      ctx.bezierCurveTo(b.x - 60, b.y, b.x - 100 + wave, b.y + 100, b.x - 20, b.y + 120);
      ctx.lineTo(b.x + 20, b.y + 120);
      ctx.bezierCurveTo(b.x + 100 - wave, b.y + 100, b.x + 60, b.y, b.x, b.y - 50);
      ctx.fill();

      const headGrad = ctx.createRadialGradient(b.x, b.y - 40, 5, b.x, b.y - 40, 30);
      headGrad.addColorStop(0, "#fff");
      headGrad.addColorStop(1, "#050");
      ctx.fillStyle = headGrad;
      ctx.beginPath();
      ctx.ellipse(b.x, b.y - 40, 25, 35, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.moveTo(b.x - 20, b.y - 60); ctx.lineTo(b.x - 30, b.y - 90); ctx.lineTo(b.x - 10, b.y - 70);
      ctx.moveTo(b.x + 20, b.y - 60); ctx.lineTo(b.x + 30, b.y - 90); ctx.lineTo(b.x + 10, b.y - 70);
      ctx.fill();
      ctx.fillStyle = "#0f0";
      ctx.beginPath();
      ctx.arc(b.x, b.y - 35, 6, 0, Math.PI * 2);
      ctx.arc(b.x - 12, b.y - 45, 4, 0, Math.PI * 2);
      ctx.arc(b.x + 12, b.y - 45, 4, 0, Math.PI * 2);
      ctx.fill();

      resetGlow();
    } else {
      ctx.globalCompositeOperation = "source-over";
      const jitter = (Math.random() - 0.5) * 5;

      ctx.save();
      ctx.translate(b.x + 60, b.y);
      ctx.rotate(Math.PI / 4 + Math.sin(game.frames * 0.3) * 0.5);
      drawGlow("#f00", 30);
      ctx.fillStyle = "#a00";
      ctx.beginPath();
      ctx.moveTo(0, -100); ctx.lineTo(10, 100); ctx.lineTo(-10, 100);
      ctx.fill();
      resetGlow();
      ctx.restore();

      ctx.fillStyle = "#100";
      ctx.shadowBlur = 20;
      ctx.shadowColor = "#f00";
      ctx.beginPath();
      ctx.moveTo(b.x + jitter, b.y - 50);
      ctx.lineTo(b.x - 80, b.y + jitter);
      ctx.lineTo(b.x - 40, b.y + 60);
      ctx.lineTo(b.x - 90, b.y + 120);
      ctx.lineTo(b.x, b.y + 100 + jitter);
      ctx.lineTo(b.x + 90, b.y + 120);
      ctx.lineTo(b.x + 40, b.y + 60);
      ctx.lineTo(b.x + 80, b.y + jitter);
      ctx.fill();

      ctx.fillStyle = "#ddd";
      ctx.beginPath();
      ctx.ellipse(b.x + jitter, b.y - 40, 25, 35, 0, 0, Math.PI * 2);
      ctx.fill();

      drawGlow("#f00", 40);
      ctx.fillStyle = "#f00";
      ctx.beginPath();
      ctx.arc(b.x + jitter, b.y - 40, 12, 0, Math.PI * 2);
      ctx.fill();
      resetGlow();

      if (Math.random() < 0.5) {
        ctx.fillStyle = "red";
        ctx.fillRect(b.x + (Math.random() - 0.5) * 100, b.y + (Math.random() - 0.5) * 100, 5, 20);
      }
    }
  }
  else {
    // === BOSS 3: THE VOID SINGULARITY (Tormented Trobbio Style) ===

    if (b.phase === 1) {
      // --- PHASE 1: THEATRICAL TROBBIO (Purple) ---
      const cloakGrad = ctx.createLinearGradient(b.x, b.y - 100, b.x, b.y + 100);
      cloakGrad.addColorStop(0, "#a0a");
      cloakGrad.addColorStop(0.5, "#404");
      cloakGrad.addColorStop(1, "#101");

      ctx.fillStyle = cloakGrad;
      ctx.shadowBlur = 20;
      ctx.shadowColor = "#80f";

      const flap = Math.sin(game.frames * 0.08) * 10;

      ctx.beginPath();
      ctx.moveTo(b.x, b.y + 100);
      ctx.bezierCurveTo(b.x - 60, b.y + 80, b.x - 120 - flap, b.y - 50, b.x - 40, b.y - 100);
      ctx.quadraticCurveTo(b.x, b.y - 60, b.x + 40, b.y - 100);
      ctx.bezierCurveTo(b.x + 120 + flap, b.y - 50, b.x + 60, b.y + 80, b.x, b.y + 100);
      ctx.fill();

      ctx.fillStyle = "#200020";
      ctx.beginPath();
      ctx.moveTo(b.x, b.y + 100);
      ctx.quadraticCurveTo(b.x - 30, b.y, b.x - 40, b.y - 100);
      ctx.quadraticCurveTo(b.x, b.y - 60, b.x + 40, b.y - 100);
      ctx.quadraticCurveTo(b.x + 30, b.y, b.x, b.y + 100);
      ctx.fill();

      ctx.fillStyle = "#fff";
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#d0f";
      ctx.beginPath();
      ctx.ellipse(b.x, b.y - 60, 20, 25, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(b.x - 10, b.y - 80); ctx.bezierCurveTo(b.x - 30, b.y - 120, b.x - 60, b.y - 100, b.x - 50, b.y - 150);
      ctx.moveTo(b.x + 10, b.y - 80); ctx.bezierCurveTo(b.x + 30, b.y - 120, b.x + 60, b.y - 100, b.x + 50, b.y - 150);
      ctx.stroke();

      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.moveTo(b.x - 8, b.y - 65); ctx.lineTo(b.x - 15, b.y - 55); ctx.lineTo(b.x - 5, b.y - 55);
      ctx.moveTo(b.x + 8, b.y - 65); ctx.lineTo(b.x + 15, b.y - 55); ctx.lineTo(b.x + 5, b.y - 55);
      ctx.fill();

      resetGlow();
    } else {
      // --- PHASE 2: EVENT HORIZON TROBBIO (Black/White Void) ---
      const vortexGrad = ctx.createRadialGradient(b.x, b.y, 10, b.x, b.y, 120);
      vortexGrad.addColorStop(0, "#000");
      vortexGrad.addColorStop(0.5, "#000");
      vortexGrad.addColorStop(1, "rgba(50, 0, 50, 0)");

      ctx.fillStyle = vortexGrad;
      ctx.shadowBlur = 50;
      ctx.shadowColor = "#fff";

      ctx.beginPath();
      for (let i = 0; i < Math.PI * 2; i += 0.2) {
        const r = 100 + Math.sin(i * 5 + game.frames * 0.2) * 20;
        ctx.lineTo(b.x + Math.cos(i) * r, b.y + Math.sin(i) * r);
      }
      ctx.fill();

      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      ctx.shadowBlur = 20;
      ctx.shadowColor = "#fff";

      ctx.beginPath();
      ctx.moveTo(b.x - 10, b.y - 40);
      ctx.lineTo(b.x - 40, b.y - 80 + Math.random() * 20);
      ctx.lineTo(b.x - 20, b.y - 120);
      ctx.lineTo(b.x - 80, b.y - 160);
      ctx.moveTo(b.x + 10, b.y - 40);
      ctx.lineTo(b.x + 40, b.y - 80 + Math.random() * 20);
      ctx.lineTo(b.x + 20, b.y - 120);
      ctx.lineTo(b.x + 80, b.y - 160);
      ctx.stroke();

      ctx.fillStyle = "#fff";
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.ellipse(b.x, b.y - 40, 25, 35, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(b.x - 10, b.y - 40, 8, 0, Math.PI * 2);
      ctx.arc(b.x + 10, b.y - 40, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(b.x - 12, b.y - 40, 4, 60);
      ctx.fillRect(b.x + 8, b.y - 40, 4, 60);

      resetGlow();
    }
  }
}

/* ================= PARTICLES & BACKGROUND ================= */
function createStars() {
  stars = Array.from({ length: 120 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    z: Math.random() * 2 + 0.5,
    offset: Math.random() * 100
  }));
}

function createCelestialObjects() {
  celestialObjects = [];
  const count = 6;
  for (let i = 0; i < count; i++) {
    const typeRoll = Math.random();
    let type = 'planet';
    if (typeRoll > 0.6) type = 'blackhole';
    if (typeRoll > 0.75) type = 'supernova';
    if (typeRoll > 0.9) type = 'quasar';

    const obj = {
      type: type,
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: 30 + Math.random() * 50,
      speed: 0.1 + Math.random() * 0.4,
      angle: Math.random() * Math.PI,
      color: `hsl(${Math.random() * 360}, 70%, 60%)`
    };

    if (type === 'planet') {
      obj.color1 = `hsl(${Math.random() * 360}, 70%, 50%)`;
      obj.color2 = `hsl(${Math.random() * 360}, 60%, 10%)`;
      obj.hasRings = Math.random() > 0.6;
    }

    celestialObjects.push(obj);
  }
}

function drawBackground() {
  const w = canvas.width;
  const h = canvas.height;

  // 1. BASE BACKGROUND FILL
  if (game.theme === "normal") {
    ctx.fillStyle = COLORS.bg_normal;
    ctx.fillRect(0, 0, w, h);
  }
  else if (game.theme === "boss1") {
    const pulse = Math.sin(game.frames * 0.2) * 30;
    ctx.fillStyle = `rgb(${40 + pulse}, 0, 0)`;
    ctx.fillRect(0, 0, w, h);
    const grad = ctx.createRadialGradient(w / 2, h / 2, h / 3, w / 2, h / 2, h);
    grad.addColorStop(0, "transparent");
    grad.addColorStop(1, "rgba(0,0,0,0.9)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
  else if (game.theme === "boss2") {
    ctx.fillStyle = "#000800";
    ctx.fillRect(0, 0, w, h);
    // Digital Glitch Blocks
    ctx.fillStyle = "rgba(0, 255, 0, 0.1)";
    for (let i = 0; i < 20; i++) {
      const nx = Math.random() * w;
      const ny = Math.random() * h;
      ctx.fillRect(nx, ny, Math.random() * 50, 2);
    }
  }
  else if (game.theme === "boss3") {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
  }

  // 2. DRAW CELESTIAL OBJECTS (PARALLAX LAYER)
  celestialObjects.forEach(obj => {
    obj.y += obj.speed;
    if (obj.y - obj.r * 6 > h) {
      obj.y = -obj.r * 6;
      obj.x = Math.random() * w;
    }

    ctx.save();
    ctx.translate(obj.x, obj.y);

    if (obj.type === 'planet') {
      const grad = ctx.createRadialGradient(-obj.r / 3, -obj.r / 3, obj.r / 10, 0, 0, obj.r);
      grad.addColorStop(0, obj.color1);
      grad.addColorStop(1, obj.color2);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, obj.r, 0, Math.PI * 2);
      ctx.fill();

      if (obj.hasRings) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.rotate(obj.angle);
        ctx.ellipse(0, 0, obj.r * 1.8, obj.r * 0.4, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (obj.type === 'blackhole') {
      ctx.rotate(obj.angle);
      const diskGrad = ctx.createLinearGradient(-obj.r * 2, 0, obj.r * 2, 0);
      diskGrad.addColorStop(0, "rgba(0,0,0,0)");
      diskGrad.addColorStop(0.2, "orange");
      diskGrad.addColorStop(0.5, "white");
      diskGrad.addColorStop(0.8, "purple");
      diskGrad.addColorStop(1, "rgba(0,0,0,0)");

      ctx.fillStyle = diskGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, obj.r * 2.5, obj.r * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#000";
      ctx.shadowBlur = 10;
      ctx.shadowColor = "violet";
      ctx.beginPath();
      ctx.arc(0, 0, obj.r, 0, Math.PI * 2);
      ctx.fill();
    } else if (obj.type === 'supernova') {
      const burstGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, obj.r * 3);
      burstGrad.addColorStop(0, "#fff");
      burstGrad.addColorStop(0.2, obj.color);
      burstGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = burstGrad;
      ctx.globalCompositeOperation = "lighter";
      ctx.beginPath();
      ctx.arc(0, 0, obj.r * 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-obj.r * 4, 0); ctx.lineTo(obj.r * 4, 0);
      ctx.moveTo(0, -obj.r * 4); ctx.lineTo(0, obj.r * 4);
      ctx.stroke();
    } else if (obj.type === 'quasar') {
      ctx.rotate(obj.angle);
      const jetGrad = ctx.createLinearGradient(0, -obj.r * 6, 0, obj.r * 6);
      jetGrad.addColorStop(0, "rgba(0,0,0,0)");
      jetGrad.addColorStop(0.2, "cyan");
      jetGrad.addColorStop(0.5, "#fff");
      jetGrad.addColorStop(0.8, "cyan");
      jetGrad.addColorStop(1, "rgba(0,0,0,0)");

      ctx.fillStyle = jetGrad;
      ctx.globalCompositeOperation = "lighter";
      ctx.beginPath();
      ctx.moveTo(-5, 0); ctx.lineTo(0, -obj.r * 6); ctx.lineTo(5, 0);
      ctx.moveTo(-5, 0); ctx.lineTo(0, obj.r * 6); ctx.lineTo(5, 0);
      ctx.fill();

      ctx.fillStyle = "#fff";
      ctx.shadowBlur = 20;
      ctx.shadowColor = "cyan";
      ctx.beginPath();
      ctx.arc(0, 0, obj.r / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  });

  // 3. THEME OVERLAYS
  if (game.theme === "boss1") {
    const grad = ctx.createRadialGradient(w / 2, h / 2, h / 3, w / 2, h / 2, h);
    grad.addColorStop(0, "transparent");
    grad.addColorStop(1, "rgba(50,0,0,0.8)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
  else if (game.theme === "boss2") {
    ctx.fillStyle = "rgba(0, 255, 0, 0.05)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(0, 255, 0, 0.1)";
    for (let i = 0; i < 20; i++) {
      const nx = Math.random() * w;
      const ny = Math.random() * h;
      ctx.fillRect(nx, ny, Math.random() * 50, 2);
    }
  }

  // 4. DRAW STARS
  ctx.fillStyle = "white";
  if (game.theme === "boss1") ctx.fillStyle = "#ff4444";
  if (game.theme === "boss2") ctx.fillStyle = "#00ff00";
  if (game.theme === "boss3") ctx.fillStyle = "#440044";

  stars.forEach(s => {
    s.y += s.z * (game.level * 0.4 + 0.5);

    let xOffset = 0;
    let yOffset = 0;

    if (game.theme === "boss2" && Math.random() < 0.2) {
      xOffset = (Math.random() - 0.5) * 50;
    }
    if (game.theme === "boss3") {
      xOffset = (Math.random() - 0.5) * 2;
      yOffset = (Math.random() - 0.5) * 2;
    }

    if (s.y > canvas.height) { s.y = 0; s.x = Math.random() * canvas.width; }

    ctx.globalAlpha = Math.random() * 0.5 + 0.3;
    if (game.theme === "boss3") ctx.globalAlpha = 0.2;

    ctx.fillRect(s.x + xOffset, s.y + yOffset, s.z, s.z);
    ctx.globalAlpha = 1.0;
  });
}

function spawnExplosion(x, y, color, count = 10) {
  sfx.explosion();
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8,
      life: 1.0,
      color: color
    });
  }
}

/* ================= GAME LOGIC ================= */
function initGame() {
  game.running = true;
  game.score = 0;
  game.lives = 5;
  game.level = 1;
  game.theme = "normal";
  player.weaponLevel = 1;
  player.shield = false;
  player.x = canvas.width / 2;
  player.y = canvas.height - 100;

  bullets = [];
  enemies = [];
  particles = [];
  powerups = [];
  boss = null;

  menu.style.display = "none";
  updateUITheme();
  createStars();
  createCelestialObjects();
  playBgm("normal");
}

function updatePlayer() {
  if (keys["ArrowLeft"]) player.dx = -player.speed;
  else if (keys["ArrowRight"]) player.dx = player.speed;
  else player.dx *= 0.9;

  player.x += player.dx;
  if (player.x < 20) player.x = 20;
  if (player.x > canvas.width - 20) player.x = canvas.width - 20;

  if (keys[" "] && game.frames % 10 === 0) {
    sfx.shoot();
    if (player.weaponLevel === 1) {
      bullets.push({ x: player.x, y: player.y - 20, w: 4, h: 15, vx: 0, vy: -12, color: COLORS.bullet });
    } else {
      bullets.push({ x: player.x - 10, y: player.y - 20, w: 4, h: 15, vx: -2, vy: -12, color: COLORS.bullet });
      bullets.push({ x: player.x + 10, y: player.y - 20, w: 4, h: 15, vx: 2, vy: -12, color: COLORS.bullet });
      bullets.push({ x: player.x, y: player.y - 25, w: 4, h: 15, vx: 0, vy: -12, color: COLORS.bullet });
    }
  }

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.dx * 0.05); // Tilt slightly on movement

  // Shield logic (keep)
  if (player.shield) {
    drawGlow("#0ff", 10);
    ctx.strokeStyle = "#0ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 25, 0, Math.PI * 2);
    ctx.stroke();
    resetGlow();
  }

  // START SPACESHIP DRAWING: THE INTERCEPTOR
  // Main Body
  ctx.fillStyle = "#ccc";
  ctx.beginPath();
  ctx.moveTo(0, -20);
  ctx.lineTo(-15, 15);
  ctx.lineTo(0, 10);
  ctx.lineTo(15, 15);
  ctx.closePath();
  ctx.fill();

  // Cockpit
  ctx.fillStyle = "#0ff";
  ctx.beginPath();
  ctx.ellipse(0, -5, 5, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Engine Thrusters (Particles)
  if (Math.random() > 0.5) {
    ctx.fillStyle = "orange";
    ctx.beginPath();
    ctx.arc(-8, 15, 2, 0, Math.PI * 2);
    ctx.arc(8, 15, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  // END SPACESHIP DRAWING

  ctx.restore();
  resetGlow();
}

function updateEntities() {
  bullets.forEach((b, i) => {
    b.x += b.vx;
    b.y += b.vy;
    drawGlow(b.color, 10);
    ctx.fillRect(b.x - b.w / 2, b.y, b.w, b.h);
    resetGlow();
    if (b.y < 0 || b.y > canvas.height) bullets.splice(i, 1);
  });

  if (game.frames % (75 - game.level * 5) === 0 && !boss) {
    enemies.push({
      x: Math.random() * (canvas.width - 40) + 20,
      y: -40,
      size: 20,
      speed: 1.5 + Math.random() * game.level,
      angle: 0
    });
  }

  enemies.forEach((e, i) => {
    e.y += e.speed;
    e.angle += 0.05;
    drawEnemy(e);

    const dist = Math.hypot(player.x - e.x, player.y - e.y);
    if (dist < e.size + 15) {
      if (player.shield) {
        player.shield = false;
        spawnExplosion(player.x, player.y, "#0ff", 15);
        enemies.splice(i, 1);
      } else {
        game.shake = 20;
        game.lives--;
        spawnExplosion(player.x, player.y, "#000", 30);
        enemies.splice(i, 1);
        if (game.lives <= 0) endGame();
      }
    }

    bullets.forEach((b, bi) => {
      if (Math.hypot(b.x - e.x, b.y - e.y) < e.size) {
        spawnExplosion(e.x, e.y, COLORS.enemy);
        enemies.splice(i, 1);
        bullets.splice(bi, 1);
        game.score += 50;

        if (Math.random() < 0.1) powerups.push({ x: e.x, y: e.y, vy: 2, type: 'weapon' });
        if (Math.random() < 0.1) powerups.push({ x: e.x, y: e.y, vy: 2, type: 'life' });
        if (Math.random() < 0.12) powerups.push({ x: e.x, y: e.y, vy: 2, type: 'shield' });
      }
    });

    if (e.y > canvas.height) enemies.splice(i, 1);
  });

  powerups.forEach((p, i) => {
    p.y += p.vy;

    if (p.type === 'weapon') {
      drawPoly(p.x, p.y, 10, 6, "#0f0", game.frames * 0.1);
      ctx.fillStyle = "#fff";
      ctx.font = "12px Arial";
      ctx.fillText("UP", p.x - 8, p.y + 4);
    } else if (p.type === 'life') {
      drawGlow("#f00", 20);
      ctx.fillStyle = "#f00";
      ctx.fillRect(p.x - 4, p.y - 10, 8, 20);
      ctx.fillRect(p.x - 10, p.y - 4, 20, 8);
      resetGlow();
    } else if (p.type === 'shield') {
      drawGlow("#0ff", 20);
      ctx.strokeStyle = "#0ff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#0ff";
      ctx.fillText("S", p.x - 4, p.y + 4);
      resetGlow();
    }

    if (Math.hypot(player.x - p.x, player.y - p.y) < 30) {
      if (p.type === 'weapon') {
        player.weaponLevel = 2;
        game.score += 200;
        drawGlow("#0f0", 50);
      } else if (p.type === 'life') {
        game.lives++;
        drawGlow("#f00", 50);
      } else if (p.type === 'shield') {
        player.shield = true;
        drawGlow("#0ff", 50);
      }
      powerups.splice(i, 1);
    }
  });

  particles.forEach((p, i) => {
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 0.03;
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 3, 3);
    ctx.globalAlpha = 1.0;
    if (p.life <= 0) particles.splice(i, 1);
  });
}

function updateBoss() {
  if (!boss) {
    let threshold = 1000;
    if (game.level === 2) threshold = 2000;
    if (game.level === 3) threshold = 3000;
    if (game.level > 3) threshold = 1000 + (game.level * 500);

    if (game.score >= threshold) {
      // HP 120 * LEVEL
      const maxHp = 120 * game.level;
      let name = "";
      if (game.level === 1) name = "THE HELL-GRINDER";
      else if (game.level === 2) name = "THE SERAPH VIRUS";
      else name = "THE VOID SINGULARITY";

      boss = { x: canvas.width / 2, y: -100, hp: maxHp, maxHp: maxHp, w: 100, dir: 1, name: name, phase: 1 };

      if (game.level === 1) { playBgm("boss1"); game.theme = "boss1"; }
      else if (game.level === 2) { playBgm("boss2"); game.theme = "boss2"; }
      else { playBgm("final"); game.theme = "boss3"; }
      updateUITheme();
    }
  }

  if (boss) {
    // --- PHASE 2 TRIGGER (Level 2 & 3 only) ---
    if (game.level >= 2 && boss.phase === 1 && boss.hp < boss.maxHp * 0.5) {
      boss.phase = 2;
      game.shake = 40;
      sfx.roar(); // Play roar
      spawnExplosion(boss.x, boss.y, "#fff", 50);

      // Name Change for Terror Factor
      if (game.level === 2) boss.name = "THE SEVERED MATRIARCH";
      if (game.level === 3) boss.name = "EVENT HORIZON TROBBIO";
    }

    if (boss.y < 80) boss.y += 1.5;

    // Aggressive Move Speed in Phase 2
    let speed = (0.8 + game.level * 0.4);
    if (boss.phase === 2) speed *= 1.5;

    boss.x += boss.dir * speed;
    if (boss.x > canvas.width - 80 || boss.x < 80) boss.dir *= -1;

    if (game.theme === "boss3" && game.shake === 0) {
      game.shake = 2;
    }

    // Faster Fire Rate in Phase 2
    let fireRate = 110;
    if (boss.phase === 2) fireRate = 70;

    if (game.frames % fireRate === 0) {
      let offsets = [];
      if (game.level === 1) offsets = [-1, 0, 1];
      else if (game.level === 2) offsets = [-1.5, -0.5, 0.5, 1.5];
      else offsets = [-2, -1, 0, 1, 2];

      offsets.forEach(k => {
        bullets.push({
          x: boss.x, y: boss.y + 50, w: 8, h: 8,
          vx: k * 1,
          vy: 2.0,
          color: COLORS.boss
        });
      });
    }

    drawBossModel(boss);

    bullets.forEach((b, bi) => {
      if (b.color === COLORS.bullet && Math.hypot(b.x - boss.x, b.y - boss.y) < 60) {
        boss.hp--;
        bullets.splice(bi, 1);
        spawnExplosion(b.x, b.y, "#fff", 2);
        if (boss.hp <= 0) {
          game.shake = 50;
          spawnExplosion(boss.x, boss.y, COLORS.boss, 100);
          boss = null;

          if (game.level === 3) {
            victory();
            return;
          }

          game.theme = "normal";
          updateUITheme();
          game.level++;
          game.score = 0;
          playBgm("normal");
        }
      }
      if (b.color === COLORS.boss && Math.hypot(b.x - player.x, b.y - player.y) < 20) {
        if (player.shield) {
          player.shield = false;
          bullets.splice(bi, 1);
          spawnExplosion(player.x, player.y, "#0ff", 15);
        } else {
          game.lives--;
          game.shake = 10;
          bullets.splice(bi, 1);
          spawnExplosion(player.x, player.y, "red", 10);
          if (game.lives <= 0) endGame();
        }
      }
    });
  }
}

function endGame() {
  game.running = false;
  stopAllBgm();
  menu.style.display = "flex";
  const h1 = document.querySelector("#menu h1");
  const p = document.querySelector("#menu p");

  h1.innerText = "GAME OVER";
  h1.style.background = "linear-gradient(to bottom, #0ff, #00f)";
  h1.style.webkitBackgroundClip = "text";
  h1.style.webkitTextFillColor = "transparent";

  p.innerHTML = `Score: ${game.score}<br>Press Enter to Restart`;
}

function victory() {
  game.running = false;
  stopAllBgm();
  menu.style.display = "flex";
  const h1 = document.querySelector("#menu h1");
  const p = document.querySelector("#menu p");

  h1.innerText = "MISSION COMPLETE";
  h1.style.background = "linear-gradient(to bottom, #ffd700, #00ff00)";
  h1.style.webkitBackgroundClip = "text";
  h1.style.webkitTextFillColor = "transparent";

  p.innerHTML = `THE VOID IS SILENCED.<br>Final Score: ${game.score}<br>Press Enter to Play Again`;
}

function loop() {
  requestAnimationFrame(loop);

  if (game.running) {
    game.frames++;

    let tx = 0, ty = 0;
    if (game.shake > 0) {
      tx = (Math.random() - 0.5) * game.shake;
      ty = (Math.random() - 0.5) * game.shake;
      game.shake *= 0.9;
      if (game.shake < 0.5) game.shake = 0;
    }

    ctx.save();
    ctx.translate(tx, ty);

    drawBackground();
    updatePlayer();
    updateEntities();
    updateBoss();
    drawBossHealthBar();

    // === HORROR UI RENDERING ===
    ctx.textAlign = "left";
    ctx.font = "20px Orbitron";

    if (game.theme === "normal") {
      ctx.fillStyle = "white";
      ctx.fillText(`SCORE: ${game.score}`, 20, 40);
      ctx.fillText(`LEVEL: ${game.level}`, 20, 70);
    }
    else if (game.theme === "boss1") {
      // Butcher: Shaking Red Text
      const shakeX = (Math.random() - 0.5) * 4;
      const shakeY = (Math.random() - 0.5) * 4;
      ctx.fillStyle = "#f00";
      ctx.shadowColor = "#500";
      ctx.shadowBlur = 10;
      ctx.fillText(`SCORE: ${game.score}`, 20 + shakeX, 40 + shakeY);
      ctx.fillText(`LEVEL: ${game.level}`, 20 + shakeX, 70 + shakeY);
      resetGlow();
    }
    else if (game.theme === "boss2") {
      // Virus: Glitch Text (RGB Split)
      const jitterY = (Math.random() - 0.5) * 5;
      let scoreTxt = `SCORE: ${game.score}`;
      let lvlTxt = `LEVEL: ${game.level}`;

      if (Math.random() < 0.1) scoreTxt = scoreTxt.replace('O', '0').replace('E', '#');

      ctx.fillStyle = "rgba(0, 255, 0, 0.8)";
      ctx.fillText(scoreTxt, 20, 40 + jitterY);
      ctx.fillStyle = "rgba(255, 0, 255, 0.5)";
      ctx.fillText(scoreTxt, 22, 40 + jitterY);

      ctx.fillStyle = "#0f0";
      ctx.fillText(lvlTxt, 20, 70 + jitterY);
    }
    else if (game.theme === "boss3") {
      // Void: Ghostly Fade
      const blurAmount = Math.abs(Math.sin(game.frames * 0.05)) * 4;
      ctx.filter = `blur(${blurAmount}px)`;

      const drift = Math.sin(game.frames * 0.02) * 10;

      ctx.fillStyle = "rgba(100, 0, 255, 0.5)";
      ctx.fillText(`SCORE: ${game.score}`, 20 + drift, 40);
      ctx.fillText(`LEVEL: ${game.level}`, 20 - drift, 70);

      const alpha = 0.5 + Math.abs(Math.sin(game.frames * 0.1)) * 0.5;
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.shadowColor = "#f0f";
      ctx.shadowBlur = 30;
      ctx.fillText(`SCORE: ${game.score}`, 20, 40);
      ctx.fillText(`LEVEL: ${game.level}`, 20, 70);

      ctx.filter = "none";
      resetGlow();
    }

    // Draw Lives
    for (let i = 0; i < game.lives; i++) {
      drawPoly(canvas.width - 40 - (i * 30), 40, 10, 3, COLORS.player, -Math.PI / 2);
    }

    ctx.restore();

    // === POST-PROCESSING: SCREEN EFFECTS ===
    if (game.theme === "boss2" && Math.random() < 0.3) {
      const w = canvas.width;
      const h = canvas.height;
      const slices = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < slices; i++) {
        const y = Math.random() * h;
        const chunkH = Math.random() * 50 + 10;
        const offsetX = (Math.random() - 0.5) * 30;
        ctx.drawImage(canvas, 0, y, w, chunkH, offsetX, y, w, chunkH);
        ctx.fillStyle = "rgba(0, 255, 0, 0.2)";
        ctx.fillRect(offsetX, y, w, chunkH);
      }
    }

    if (game.theme === "boss3") {
      if (Math.random() < 0.05) {
        ctx.globalCompositeOperation = "difference";
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = "source-over";
      }
      if (Math.random() < 0.2) {
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.fillRect(Math.random() * canvas.width, 0, Math.random() * 100, canvas.height);
      }
    }
  }
}

createStars();
loop();