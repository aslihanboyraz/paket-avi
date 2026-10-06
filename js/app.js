const PROTOCOLS = [
  { id: "https", label: "HTTPS", tone: "secure", info: "Web trafiğini şifreler. Adres çubuğunda kilit simgesi bunun işaretidir." },
  { id: "tls", label: "TLS", tone: "secure", info: "Şifreleme katmanıdır. HTTPS ve güvenli e-posta bunu kullanır." },
  { id: "ssh", label: "SSH", tone: "secure", info: "Uzak sunucuya şifreli komut bağlantısı açar." },
  { id: "dns", label: "DNS", tone: "link", info: "Alan adını, örneğin site.com, IP adresine çevirir." },
  { id: "http", label: "HTTP", tone: "plain", info: "Web sayfası ister. Şifrelemez, bu yüzden HTTPS kadar güvenli değildir." },
  { id: "tcp", label: "TCP", tone: "plain", info: "Veriyi sıralı ve eksiksiz taşır. Kaybolan paketi yeniden ister." },
  { id: "udp", label: "UDP", tone: "plain", info: "Hızlı taşır, kayıp paketi beklemez. Oyun ve canlı yayında kullanılır." },
  { id: "icmp", label: "ICMP", tone: "plain", info: "Ağın ulaşıp ulaşmadığını yoklar. Ping komutu bununla gider." },
  { id: "smtp", label: "SMTP", tone: "mail", info: "E-postayı gönderen protokoldür." },
  { id: "ftp", label: "FTP", tone: "mail", info: "Dosyayı sunucuya yükler veya indirir. Eski ve şifresiz bir yoldur." },
];

const THREATS = [
  { id: "malware", label: "ZARARLI", tone: "threat", threat: true, info: "Sisteme zarar veren yazılım trafiği. Yakalanmaz, duvardan geçip gitmelidir." },
  { id: "phish", label: "OLTALAMA", tone: "threat", threat: true, info: "Sahte mesajla şifre veya bilgi çalma girişimi. Onu da yakalama." },
];

const STORAGE_KEY = "paket-avi-best";
const CATCHER_W = 128;
const PACKET_W = 104;
const PACKET_H = 36;

const fieldEl = document.getElementById("field");
const catcherEl = document.getElementById("catcher");
const targetEl = document.getElementById("target");
const infoEl = document.getElementById("info");
const glossaryEl = document.getElementById("glossary");
const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const streakEl = document.getElementById("streak");
const bestEl = document.getElementById("best");
const livesEl = document.getElementById("lives");
const statusEl = document.getElementById("status");
const veilEl = document.getElementById("veil");
const veilTitle = document.getElementById("veil-title");
const veilText = document.getElementById("veil-text");
const playBtn = document.getElementById("play");
const fxEl = document.getElementById("fx");

const keys = new Set();
const state = {
  running: false,
  score: 0,
  best: 0,
  level: 1,
  streak: 0,
  lives: 3,
  caught: 0,
  target: PROTOCOLS[0],
  packets: [],
  catcherX: 0,
  spawnIn: 0,
  sinceTarget: 0,
  last: 0,
  raf: 0,
};

let audioCtx = null;
let pointer = false;

function loadBest() {
  const value = Number(localStorage.getItem(STORAGE_KEY));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function saveBest() {
  localStorage.setItem(STORAGE_KEY, String(state.best));
}

function ensureAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioCtx) audioCtx = new AudioContextClass();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function playTone(kind) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const notes = kind === "ok" ? [660, 880] : kind === "up" ? [523, 659, 784] : [180, 140];
  const now = ctx.currentTime;
  notes.forEach((frequency, index) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = now + index * 0.07;
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.05, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.14);
  });
}

function burst(x, y, threat) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const colors = threat ? ["#ff5d8f", "#ffd0e0"] : ["#3ee0c5", "#8b7cff", "#e8fff8"];
  for (let i = 0; i < 12; i += 1) {
    const spark = document.createElement("span");
    const angle = Math.random() * Math.PI * 2;
    const distance = 24 + Math.random() * 70;
    spark.className = "spark";
    spark.style.left = `${x}px`;
    spark.style.top = `${y}px`;
    spark.style.background = colors[i % colors.length];
    spark.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
    spark.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
    fxEl.appendChild(spark);
    spark.addEventListener("animationend", () => spark.remove());
  }
}

function fieldWidth() {
  return fieldEl.clientWidth;
}

function speed() {
  return 110 + (state.level - 1) * 32;
}

function spawnGap() {
  return Math.max(0.42, 1.15 - (state.level - 1) * 0.08);
}

function pickTarget() {
  const next = PROTOCOLS[Math.floor(Math.random() * PROTOCOLS.length)];
  state.target = next.id === state.target.id && PROTOCOLS.length > 1
    ? PROTOCOLS[(PROTOCOLS.indexOf(next) + 1) % PROTOCOLS.length]
    : next;
  targetEl.textContent = `Yakala · ${state.target.label}`;
  infoEl.textContent = state.target.info;
  glossaryEl.querySelectorAll(".term").forEach((row) => {
    row.classList.toggle("is-active", row.dataset.id === state.target.id);
  });
}

function renderGlossary() {
  glossaryEl.innerHTML = "";
  [...PROTOCOLS, ...THREATS].forEach((item) => {
    const row = document.createElement("article");
    row.className = item.threat ? "term is-threat" : "term";
    row.dataset.id = item.id;
    const name = document.createElement("strong");
    const text = document.createElement("span");
    name.textContent = item.label;
    text.textContent = item.info;
    row.append(name, text);
    glossaryEl.appendChild(row);
  });
}

function updateHud() {
  scoreEl.textContent = String(state.score);
  levelEl.textContent = String(state.level);
  streakEl.textContent = String(state.streak);
  bestEl.textContent = String(state.best);
  livesEl.innerHTML = "";
  for (let i = 0; i < 3; i += 1) {
    const pip = document.createElement("span");
    pip.className = i < state.lives ? "pip" : "pip is-off";
    livesEl.appendChild(pip);
  }
}

function placeCatcher(x) {
  const max = Math.max(0, fieldWidth() - CATCHER_W);
  state.catcherX = Math.min(max, Math.max(0, x));
  catcherEl.style.left = `${state.catcherX}px`;
}

function spawnPacket(forceTarget) {
  const roll = Math.random();
  let kind = state.target;
  if (!forceTarget) {
    if (roll < 0.22) kind = THREATS[Math.floor(Math.random() * THREATS.length)];
    else if (roll < 0.62) {
      const others = PROTOCOLS.filter((item) => item.id !== state.target.id);
      kind = others[Math.floor(Math.random() * others.length)];
    }
  }
  const maxX = Math.max(0, fieldWidth() - PACKET_W);
  const packet = {
    x: Math.random() * maxX,
    y: -PACKET_H,
    kind,
    el: document.createElement("div"),
  };
  packet.el.className = `packet is-${kind.tone}`;
  packet.el.textContent = kind.label;
  packet.el.style.left = `${packet.x}px`;
  fieldEl.appendChild(packet.el);
  state.packets.push(packet);
  state.sinceTarget = kind.id === state.target.id ? 0 : state.sinceTarget;
}

function removePacket(packet) {
  packet.el.remove();
  state.packets = state.packets.filter((item) => item !== packet);
}

function clearPackets() {
  state.packets.forEach((packet) => packet.el.remove());
  state.packets = [];
}

function hurt(message) {
  state.lives -= 1;
  state.streak = 0;
  statusEl.textContent = message;
  fieldEl.classList.remove("is-hit");
  window.requestAnimationFrame(() => fieldEl.classList.add("is-hit"));
  playTone("bad");
  updateHud();
  if (state.lives <= 0) endGame();
}

function catchPacket(packet) {
  const rect = packet.el.getBoundingClientRect();
  burst(rect.left + rect.width / 2, rect.top + rect.height / 2, packet.kind.threat);
  if (packet.kind.threat || packet.kind.id !== state.target.id) {
    removePacket(packet);
    hurt(packet.kind.threat ? "Zararlı yakalandı. Duvar delindi." : "Yanlış protokol.");
    return;
  }
  state.streak += 1;
  state.caught += 1;
  const gained = 10 * state.level * state.streak;
  state.score += gained;
  if (state.score > state.best) {
    state.best = state.score;
    saveBest();
  }
  statusEl.textContent = `Yakalandı. +${gained}`;
  removePacket(packet);
  playTone("ok");
  if (state.caught % 6 === 0) {
    state.level += 1;
    pickTarget();
    statusEl.textContent = `Seviye ${state.level}. Hat hızlandı.`;
    playTone("up");
  } else if (state.caught % 4 === 0) {
    pickTarget();
  }
  updateHud();
}

function missPacket(packet) {
  const wasTarget = packet.kind.id === state.target.id;
  removePacket(packet);
  if (wasTarget) hurt("İstenen paket kaçtı.");
}

function tick(now) {
  if (!state.running) return;
  const dt = Math.min(0.05, (now - state.last) / 1000 || 0);
  state.last = now;

  if (keys.has("ArrowLeft") || keys.has("a")) placeCatcher(state.catcherX - 460 * dt);
  if (keys.has("ArrowRight") || keys.has("d")) placeCatcher(state.catcherX + 460 * dt);

  state.spawnIn -= dt;
  state.sinceTarget += dt;
  if (state.spawnIn <= 0 && state.packets.length < 8) {
    spawnPacket(state.sinceTarget > 2.2);
    state.spawnIn = spawnGap();
  }

  const floor = fieldEl.clientHeight - 12 - 28;
  [...state.packets].forEach((packet) => {
    if (!state.running || !state.packets.includes(packet)) return;
    packet.y += speed() * dt;
    packet.el.style.left = "0";
    packet.el.style.transform = `translate(${packet.x}px, ${packet.y}px)`;
    const caught = packet.y + PACKET_H >= floor
      && packet.y <= fieldEl.clientHeight
      && packet.x < state.catcherX + CATCHER_W
      && packet.x + PACKET_W > state.catcherX;
    if (caught) catchPacket(packet);
    else if (packet.y > fieldEl.clientHeight) missPacket(packet);
  });

  state.raf = window.requestAnimationFrame(tick);
}

function startGame() {
  ensureAudio();
  clearPackets();
  state.running = true;
  state.score = 0;
  state.level = 1;
  state.streak = 0;
  state.lives = 3;
  state.caught = 0;
  state.spawnIn = 0.2;
  state.sinceTarget = 0;
  state.last = performance.now();
  pickTarget();
  veilEl.classList.add("is-hidden");
  statusEl.textContent = "Yalnızca hedef protokolü yakala.";
  placeCatcher((fieldWidth() - CATCHER_W) / 2);
  updateHud();
  window.cancelAnimationFrame(state.raf);
  state.raf = window.requestAnimationFrame(tick);
}

function endGame() {
  state.running = false;
  window.cancelAnimationFrame(state.raf);
  clearPackets();
  veilTitle.textContent = "Hat koptu";
  veilText.textContent = `Puan ${state.score}. En iyi ${state.best}.`;
  playBtn.textContent = "Tekrar";
  veilEl.classList.remove("is-hidden");
  updateHud();
}

function aimFromClient(clientX) {
  const rect = fieldEl.getBoundingClientRect();
  placeCatcher(clientX - rect.left - CATCHER_W / 2);
}

fieldEl.addEventListener("pointermove", (event) => {
  if (!state.running) return;
  pointer = true;
  aimFromClient(event.clientX);
});

fieldEl.addEventListener("pointerdown", (event) => {
  if (!state.running) return;
  aimFromClient(event.clientX);
});

window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") event.preventDefault();
  keys.add(event.key);
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key);
});

playBtn.addEventListener("click", startGame);

state.best = loadBest();
renderGlossary();
placeCatcher((fieldWidth() - CATCHER_W) / 2);
updateHud();
pickTarget();
