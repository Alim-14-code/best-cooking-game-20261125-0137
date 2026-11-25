'use strict';
/* ============================================================================
   DAPUR KILAT — game masak warung (original)
   Layani pesanan pelanggan secepat kilat: ambil bahan dari konter, masak yang
   perlu dimasak di kompor, rakit di piring, sajikan lewat bel. Pesanan yang
   benar = koin + skor + kombo. Salah saji atau pesanan kedaluwarsa = strike.
   3 strike = dapur tutup. Shift 150 detik; tiap 5 sajian naik level dan
   dapur makin ngebut. Semua gambar digambar di canvas, semua suara dibuat
   dengan WebAudio. Tanpa aset luar, tanpa request jaringan.
   ========================================================================== */

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const W = 1280, H = 720;

/* ---------- seeded RNG (deterministic demo: ?seed=7) ---------- */
const params = new URLSearchParams(location.search);
let _seed = (parseInt(params.get('seed') || '0', 10) || (Math.random() * 1e9) | 0) >>> 0;
function rnd() { _seed = (_seed * 1664525 + 1013904223) >>> 0; return _seed / 4294967296; }
function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }

/* ---------- data: bahan & menu warung (nama asli) ---------- */
const ING = {
  nasi:   { name: 'Nasi',    key: '1', cook: 0, color: '#fff8e1', dark: '#8d7b4f' },
  telur:  { name: 'Telur',   key: '2', cook: 4, color: '#fff3c4', dark: '#b8860b' },
  ayam:   { name: 'Ayam',    key: '3', cook: 6, color: '#e8a34c', dark: '#8a5a1d' },
  mie:    { name: 'Mie',     key: '4', cook: 5, color: '#ffd54f', dark: '#9c7a00' },
  sate:   { name: 'Sate',    key: '5', cook: 5, color: '#c67b3c', dark: '#6d3f14' },
  kecap:  { name: 'Kecap',   key: '6', cook: 0, color: '#5d4037', dark: '#2d1a12' },
  cabai:  { name: 'Cabai',   key: '7', cook: 0, color: '#e53935', dark: '#7f1010' },
  bawang: { name: 'Bawang',  key: '8', cook: 0, color: '#ce93d8', dark: '#6a1b9a' },
  teh:    { name: 'Es Teh',  key: '9', cook: 0, color: '#bcaaa4', dark: '#5d4037' },
  es:     { name: 'Es Batu', key: '0', cook: 0, color: '#b3e5fc', dark: '#0277bd' },
};
const ING_IDS = Object.keys(ING);
const DISHES = [
  { name: 'Nasi Goreng',  price: 12, needs: ['nasi', 'telur', 'kecap', 'cabai', 'bawang'] },
  { name: 'Mie Ayam',     price: 13, needs: ['mie', 'ayam', 'bawang', 'cabai'] },
  { name: 'Sate Ayam',    price: 15, needs: ['sate', 'kecap', 'bawang'] },
  { name: 'Ayam Geprek',  price: 14, needs: ['ayam', 'cabai', 'bawang', 'nasi'] },
  { name: 'Telur Dadar',  price: 9,  needs: ['telur', 'bawang', 'cabai'] },
  { name: 'Es Teh Manis', price: 5,  needs: ['teh', 'es'] },
];

/* ---------- layout (fixed 1280x720) ---------- */
const L = {
  board: { x: 16, y: 76, w: 302, h: 100, gap: 12 },
  stove: { x: 36, y: 250, w: 360, h: 190 },
  burners: [ { x: 128, y: 330, r: 58 }, { x: 296, y: 330, r: 58 } ],
  plate: { x: 640, y: 348, rx: 165, ry: 92 },
  bell: { x: 1092, y: 330, r: 72 },
  counter: { x: 16, y: 492, w: 122, h: 138, gap: 6 },
  startBtn: { x: 490, y: 520, w: 300, h: 72 },
  againBtn: { x: 490, y: 540, w: 300, h: 72 },
};
function tileRect(i) {
  return { x: L.counter.x + i * (L.counter.w + L.counter.gap), y: L.counter.y, w: L.counter.w, h: L.counter.h };
}
function orderRect(i) {
  return { x: L.board.x + i * (L.board.w + L.board.gap), y: L.board.y, w: L.board.w, h: L.board.h };
}

/* ---------- state ---------- */
const S = {
  screen: 'title', // title | playing | paused | over | done
  score: 0, coins: 0, combo: 0, bestCombo: 0, strikes: 0,
  served: 0, level: 1, shift: 150, shiftMax: 150,
  orders: [], plate: [], selected: -1,
  burners: [ { item: null, t: 0, max: 1 }, { item: null, t: 0, max: 1 } ],
  spawnT: 1, orderSeq: 0, flash: '', flashT: 0, muted: false,
  best: 0, time: 0,
};
try { S.best = parseInt(localStorage.getItem('dapurKilatBest') || '0', 10) || 0; } catch (e) { S.best = 0; }

function orderTimeMax() { return Math.max(30, 55 - S.level * 3); }
function spawnInterval() { return Math.max(6, 12 - S.level); }
function newOrder() {
  const dish = pick(DISHES);
  const t = orderTimeMax();
  S.orders.push({ id: ++S.orderSeq, dish, timeLeft: t, timeMax: t });
  blip(660, 0.09, 'sine', 0.12);
}
function resetGame() {
  S.score = 0; S.coins = 0; S.combo = 0; S.bestCombo = 0; S.strikes = 0;
  S.served = 0; S.level = 1; S.shift = S.shiftMax;
  S.orders = []; S.plate = []; S.selected = -1;
  S.burners = [ { item: null, t: 0, max: 1 }, { item: null, t: 0, max: 1 } ];
  S.spawnT = 0.8; S.flash = ''; S.flashT = 0;
  S.screen = 'playing';
  newOrder();
  announce('Mulai! Layani pesanan secepat kilat.');
}
function announce(msg) { statusEl.textContent = msg; }
function setFlash(msg) { S.flash = msg; S.flashT = 2.2; }

/* ---------- audio: semua suara disintesis WebAudio ---------- */
let AC = null;
function ac() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; } }
  if (AC && AC.state === 'suspended') AC.resume();
  return AC;
}
function blip(freq, dur, type, vol) {
  if (S.muted) return;
  const a = ac(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type || 'sine'; o.frequency.value = freq;
  g.gain.setValueAtTime(vol || 0.15, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
  o.connect(g); g.connect(a.destination);
  o.start(); o.stop(a.currentTime + dur);
}
function jingle(notes, step) {
  notes.forEach((f, i) => setTimeout(() => blip(f, 0.16, 'triangle', 0.16), i * (step || 110)));
}
const sfx = {
  click: () => blip(520, 0.06, 'square', 0.07),
  add: () => { blip(440, 0.07, 'sine', 0.12); setTimeout(() => blip(660, 0.08, 'sine', 0.12), 60); },
  cook: () => blip(330, 0.12, 'sawtooth', 0.06),
  done: () => { blip(880, 0.12, 'sine', 0.15); setTimeout(() => blip(1174, 0.18, 'sine', 0.15), 110); },
  serve: () => jingle([523, 659, 784, 1046], 90),
  fail: () => { blip(220, 0.2, 'sawtooth', 0.14); setTimeout(() => blip(160, 0.3, 'sawtooth', 0.14), 150); },
  bell: () => { blip(1568, 0.25, 'sine', 0.12); setTimeout(() => blip(2093, 0.3, 'sine', 0.08), 80); },
  level: () => jingle([392, 523, 659], 100),
};
/* musik latar: arpeggio pentatonik pelan, tiap 0.42 detik satu nada */
const MELODY = [262, 294, 330, 392, 440, 392, 330, 294];
let musicStep = 0, musicT = 0;
function musicTick(dt) {
  if (S.muted || S.screen !== 'playing') return;
  musicT += dt;
  if (musicT >= 0.42) {
    musicT = 0;
    blip(MELODY[musicStep % MELODY.length], 0.3, 'triangle', 0.035);
    musicStep++;
  }
}

/* ---------- aksi pemain ---------- */
function addIngredient(id) {
  if (S.screen !== 'playing') return;
  if (S.plate.length >= 6) { setFlash('Piring penuh! Sajikan dulu.'); sfx.fail(); return; }
  const ing = ING[id];
  if (ing.cook > 0) {
    const b = S.burners.find(b => !b.item);
    if (!b) { setFlash('Kompor penuh! Tunggu masakan matang.'); sfx.fail(); return; }
    b.item = id; b.t = 0; b.max = ing.cook;
    sfx.cook(); setFlash(ing.name + ' naik kompor…');
  } else {
    S.plate.push(id);
    sfx.add();
  }
}
function takeBurner(i) {
  if (S.screen !== 'playing') return;
  const b = S.burners[i];
  if (!b.item) return;
  if (b.t < b.max) { setFlash('Belum matang! Tunggu apinya.'); return; }
  if (S.plate.length >= 6) { setFlash('Piring penuh! Sajikan dulu.'); return; }
  S.plate.push(b.item);
  b.item = null; b.t = 0;
  sfx.add();
}
function removeFromPlate(idx) {
  if (S.screen !== 'playing') return;
  S.plate.splice(idx, 1);
  sfx.click();
}
function sameSet(a, b) {
  if (a.length !== b.length) return false;
  const s1 = a.slice().sort().join(','), s2 = b.slice().sort().join(',');
  return s1 === s2;
}
function serve() {
  if (S.screen !== 'playing') return;
  if (!S.plate.length) { setFlash('Piring masih kosong!'); return; }
  let target = -1;
  if (S.selected >= 0 && S.selected < S.orders.length && sameSet(S.plate, S.orders[S.selected].dish.needs)) {
    target = S.selected;
  } else {
    target = S.orders.findIndex(o => sameSet(S.plate, o.dish.needs));
  }
  if (target >= 0) {
    const o = S.orders[target];
    const timeBonus = Math.round(100 * (o.timeLeft / o.timeMax));
    const gain = 100 + timeBonus + S.combo * 25;
    S.score += gain; S.coins += o.dish.price;
    S.combo++; S.bestCombo = Math.max(S.bestCombo, S.combo);
    S.served++;
    const newLevel = 1 + Math.floor(S.served / 5);
    S.orders.splice(target, 1);
    S.plate = []; S.selected = -1;
    setFlash('+' + gain + ' — ' + o.dish.name + ' tersaji! Kombo x' + S.combo);
    announce(o.dish.name + ' tersaji. Skor ' + S.score + '.');
    sfx.serve(); sfx.bell();
    if (newLevel > S.level) { S.level = newLevel; setFlash('LEVEL ' + S.level + '! Dapur makin ngebut!'); sfx.level(); }
  } else {
    S.strikes++; S.combo = 0; S.plate = []; S.selected = -1;
    setFlash('Salah sajian! Strike ' + S.strikes + '/3');
    announce('Salah sajian. Strike ' + S.strikes + ' dari 3.');
    sfx.fail();
    if (S.strikes >= 3) gameOver(false);
  }
}
function gameOver(win) {
  S.screen = win ? 'done' : 'over';
  if (S.score > S.best) {
    S.best = S.score;
    try { localStorage.setItem('dapurKilatBest', String(S.best)); } catch (e) {}
  }
  announce(win ? 'Shift selesai! Skor ' + S.score : 'Dapur tutup! Skor ' + S.score);
  if (win) sfx.level(); else sfx.fail();
}
function togglePause() {
  if (S.screen === 'playing') { S.screen = 'paused'; announce('Jeda.'); }
  else if (S.screen === 'paused') { S.screen = 'playing'; announce('Lanjut masak!'); }
}

/* ---------- update ---------- */
function update(dt) {
  S.time += dt;
  if (S.flashT > 0) S.flashT -= dt;
  if (S.screen !== 'playing') return;
  musicTick(dt);
  S.shift -= dt;
  if (S.shift <= 0) { S.shift = 0; gameOver(true); return; }
  S.spawnT -= dt;
  if (S.spawnT <= 0 && S.orders.length < 4) {
    newOrder();
    S.spawnT = spawnInterval() * (0.8 + rnd() * 0.5);
  }
  for (let i = S.orders.length - 1; i >= 0; i--) {
    const o = S.orders[i];
    o.timeLeft -= dt;
    if (o.timeLeft <= 0) {
      S.orders.splice(i, 1);
      if (S.selected === i) S.selected = -1;
      else if (S.selected > i) S.selected--;
      S.strikes++; S.combo = 0;
      setFlash('Pesanan ' + o.dish.name + ' kedaluwarsa! Strike ' + S.strikes + '/3');
      announce('Pesanan kedaluwarsa. Strike ' + S.strikes + ' dari 3.');
      sfx.fail();
      if (S.strikes >= 3) { gameOver(false); return; }
    }
  }
  S.burners.forEach(b => {
    if (b.item && b.t < b.max) {
      const was = b.t;
      b.t = Math.min(b.max, b.t + dt);
      if (was < b.max && b.t >= b.max) sfx.done();
    }
  });
}

/* ---------- gambar: ikon bahan digambar dari bentuk dasar ---------- */
function rr(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function drawIcon(id, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  const u = s / 40;
  ctx.lineWidth = 2 * u;
  switch (id) {
    case 'nasi': // mangkuk nasi
      ctx.fillStyle = '#e8e4d8'; ctx.beginPath(); ctx.arc(0, 6 * u, 15 * u, 0, Math.PI); ctx.fill();
      ctx.fillStyle = '#fff8e1'; ctx.beginPath(); ctx.arc(0, 2 * u, 12 * u, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#f5c542'; ctx.beginPath(); ctx.arc(-4 * u, -2 * u, 2 * u, 0, 7); ctx.arc(4 * u, -3 * u, 2 * u, 0, 7); ctx.fill();
      break;
    case 'telur': // telur mata sapi
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, 0, 16 * u, 12 * u, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffb300'; ctx.beginPath(); ctx.arc(0, 0, 7 * u, 0, 7); ctx.fill();
      ctx.fillStyle = '#ff8f00'; ctx.beginPath(); ctx.arc(2 * u, -1 * u, 3 * u, 0, 7); ctx.fill();
      break;
    case 'ayam': // paha ayam
      ctx.fillStyle = '#d98e32'; ctx.beginPath(); ctx.arc(-3 * u, -3 * u, 11 * u, 0, 7); ctx.fill();
      ctx.fillStyle = '#b56a1e'; ctx.beginPath(); ctx.arc(-6 * u, -6 * u, 5 * u, 0, 7); ctx.fill();
      ctx.strokeStyle = '#fff3e0'; ctx.lineWidth = 4 * u;
      ctx.beginPath(); ctx.moveTo(6 * u, 6 * u); ctx.lineTo(14 * u, 14 * u); ctx.stroke();
      ctx.fillStyle = '#fff3e0'; ctx.beginPath(); ctx.arc(15 * u, 15 * u, 3.5 * u, 0, 7); ctx.fill();
      break;
    case 'mie': // mangkuk mie
      ctx.fillStyle = '#d84315'; ctx.beginPath(); ctx.arc(0, 8 * u, 14 * u, 0, Math.PI); ctx.fill();
      ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 3 * u;
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(-10 * u, (-2 + i * 4) * u); ctx.quadraticCurveTo(0, (-6 + i * 4) * u, 10 * u, (-2 + i * 4) * u); ctx.stroke(); }
      ctx.fillStyle = '#8bc34a'; ctx.fillRect(-8 * u, -8 * u, 5 * u, 3 * u);
      break;
    case 'sate': // tusuk sate
      ctx.strokeStyle = '#a1887f'; ctx.lineWidth = 2.5 * u;
      ctx.beginPath(); ctx.moveTo(-16 * u, -10 * u); ctx.lineTo(16 * u, 10 * u); ctx.stroke();
      ctx.fillStyle = '#a05a2c';
      [[-8, -5], [0, 0], [8, 5]].forEach(p => { ctx.save(); ctx.translate(p[0] * u, p[1] * u); ctx.rotate(0.6); ctx.fillRect(-5 * u, -4 * u, 10 * u, 8 * u); ctx.restore(); });
      break;
    case 'kecap': // botol kecap
      ctx.fillStyle = '#4e342e'; rr(-6 * u, -8 * u, 12 * u, 24 * u, 3 * u); ctx.fill();
      ctx.fillStyle = '#3e2723'; ctx.fillRect(-3 * u, -16 * u, 6 * u, 8 * u);
      ctx.fillStyle = '#ffca28'; ctx.fillRect(-6 * u, -2 * u, 12 * u, 6 * u);
      break;
    case 'cabai': // cabai merah
      ctx.strokeStyle = '#e53935'; ctx.lineWidth = 7 * u; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-12 * u, -8 * u); ctx.quadraticCurveTo(0, 12 * u, 13 * u, -6 * u); ctx.stroke();
      ctx.strokeStyle = '#43a047'; ctx.lineWidth = 3 * u;
      ctx.beginPath(); ctx.moveTo(13 * u, -6 * u); ctx.quadraticCurveTo(16 * u, -12 * u, 12 * u, -15 * u); ctx.stroke();
      break;
    case 'bawang': // bawang merah
      ctx.fillStyle = '#ba68c8'; ctx.beginPath(); ctx.arc(0, 2 * u, 11 * u, 0, 7); ctx.fill();
      ctx.fillStyle = '#8e24aa'; ctx.beginPath(); ctx.moveTo(0, -8 * u); ctx.lineTo(4 * u, -16 * u); ctx.lineTo(-4 * u, -16 * u); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#e1bee7'; ctx.lineWidth = 1.5 * u;
      ctx.beginPath(); ctx.arc(0, 2 * u, 7 * u, 0.3, 2.2); ctx.stroke();
      break;
    case 'teh': // gelas es teh
      ctx.fillStyle = '#bcaaa4'; ctx.beginPath(); ctx.moveTo(-9 * u, -14 * u); ctx.lineTo(9 * u, -14 * u); ctx.lineTo(6 * u, 14 * u); ctx.lineTo(-6 * u, 14 * u); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#a1887f'; ctx.beginPath(); ctx.moveTo(-8 * u, -10 * u); ctx.lineTo(8 * u, -10 * u); ctx.lineTo(6 * u, 12 * u); ctx.lineTo(-6 * u, 12 * u); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#e53935'; ctx.lineWidth = 3 * u;
      ctx.beginPath(); ctx.moveTo(4 * u, -18 * u); ctx.lineTo(8 * u, 4 * u); ctx.stroke();
      break;
    case 'es': // es batu
      ctx.fillStyle = '#b3e5fc'; ctx.strokeStyle = '#4fc3f7'; ctx.lineWidth = 2 * u;
      ctx.save(); ctx.rotate(-0.3); ctx.fillRect(-12 * u, -8 * u, 12 * u, 12 * u); ctx.strokeRect(-12 * u, -8 * u, 12 * u, 12 * u); ctx.restore();
      ctx.save(); ctx.translate(6 * u, 6 * u); ctx.rotate(0.4); ctx.fillRect(-6 * u, -6 * u, 12 * u, 12 * u); ctx.strokeRect(-6 * u, -6 * u, 12 * u, 12 * u); ctx.restore();
      break;
  }
  ctx.restore();
}

/* ---------- gambar: layar ---------- */
function fmtTime(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

function drawBackground() {
  // dinding dapur warung
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#3e2723'); g.addColorStop(0.55, '#5d4037'); g.addColorStop(1, '#3e2723');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // ubin dinding
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 470); ctx.stroke(); }
  for (let y = 0; y < 470; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  // lantai
  ctx.fillStyle = '#2b1a12'; ctx.fillRect(0, 470, W, 250);
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  for (let x = 0; x < W; x += 128) ctx.fillRect(x, 470, 64, 250);
  // awning warung
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 ? '#e53935' : '#fff8e1';
    ctx.fillRect(i * 80, 0, 80, 26);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 26, W, 8);
}

function drawHeader() {
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 34, W, 30);
  ctx.fillStyle = '#ffca28'; ctx.font = 'bold 24px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText('🍳 DAPUR KILAT', 16, 50);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 21px system-ui, sans-serif';
  ctx.fillText('Skor  ' + S.score, 300, 50);
  ctx.fillStyle = '#ffd54f'; ctx.fillText('🪙 ' + S.coins, 470, 50);
  ctx.fillStyle = '#80d8ff'; ctx.fillText('Level ' + S.level, 590, 50);
  if (S.combo >= 2) { ctx.fillStyle = '#ff7043'; ctx.fillText('🔥 Kombo x' + S.combo, 700, 50); }
  // shift timer
  ctx.fillStyle = '#fff'; ctx.font = 'bold 21px system-ui, sans-serif'; ctx.textAlign = 'right';
  ctx.fillText('⏱ ' + fmtTime(S.shift), 1010, 50);
  // hati strike
  for (let i = 0; i < 3; i++) {
    ctx.font = '22px system-ui, sans-serif';
    ctx.fillText(i < 3 - S.strikes ? '❤️' : '🖤', 1030 + i * 34, 50);
  }
  ctx.textAlign = 'left';
  // flash message
  if (S.flashT > 0 && S.flash) {
    ctx.globalAlpha = Math.min(1, S.flashT);
    ctx.fillStyle = '#fff59d'; ctx.font = 'bold 24px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(S.flash, W / 2, 210);
    ctx.textAlign = 'left'; ctx.globalAlpha = 1;
  }
}

function drawOrders() {
  ctx.fillStyle = '#fff'; ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText('📋 PAPAN PESANAN — klik pesanan untuk memilih target', 16, 71);
  if (!S.orders.length) {
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('Belum ada pesanan… pelanggan segera datang!', 16, 130);
    return;
  }
  S.orders.forEach((o, i) => {
    const r = orderRect(i);
    const frac = Math.max(0, o.timeLeft / o.timeMax);
    const urgent = frac < 0.3;
    ctx.fillStyle = S.selected === i ? '#fff8e1' : '#f5efe0';
    rr(r.x, r.y, r.w, r.h, 12); ctx.fill();
    if (S.selected === i) { ctx.strokeStyle = '#ff9800'; ctx.lineWidth = 4; rr(r.x, r.y, r.w, r.h, 12); ctx.stroke(); }
    ctx.fillStyle = '#3e2723'; ctx.font = 'bold 19px system-ui, sans-serif';
    ctx.fillText(o.dish.name, r.x + 12, r.y + 24);
    ctx.fillStyle = '#8d6e63'; ctx.font = 'bold 15px system-ui, sans-serif'; ctx.textAlign = 'right';
    ctx.fillText('🪙' + o.dish.price, r.x + r.w - 12, r.y + 24);
    ctx.textAlign = 'left';
    // chips bahan + centang bila sudah di piring
    o.dish.needs.forEach((id, j) => {
      const cx = r.x + 24 + j * 52, cy = r.y + 54;
      const onPlate = S.plate.includes(id);
      ctx.fillStyle = onPlate ? '#c8e6c9' : '#e0d8c8';
      ctx.beginPath(); ctx.arc(cx, cy, 19, 0, 7); ctx.fill();
      ctx.strokeStyle = onPlate ? '#43a047' : '#bcaaa4'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, 19, 0, 7); ctx.stroke();
      drawIcon(id, cx, cy, 26);
      if (onPlate) {
        ctx.fillStyle = '#2e7d32'; ctx.font = 'bold 16px system-ui, sans-serif';
        ctx.fillText('✓', cx + 10, cy + 12);
      }
    });
    // bar waktu pesanan
    ctx.fillStyle = '#d7ccc8'; rr(r.x + 12, r.y + r.h - 14, r.w - 24, 8, 4); ctx.fill();
    ctx.fillStyle = urgent ? '#e53935' : '#43a047';
    rr(r.x + 12, r.y + r.h - 14, (r.w - 24) * frac, 8, 4); ctx.fill();
    ctx.fillStyle = urgent ? '#ffcdd2' : '#3e2723'; ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(Math.ceil(o.timeLeft) + ' dtk', r.x + 12, r.y + r.h - 20);
  });
}

function drawKitchen() {
  // meja dapur
  ctx.fillStyle = '#6d4c41'; rr(16, 190, W - 32, 280, 16); ctx.fill();
  ctx.fillStyle = '#8d6e63'; rr(16, 190, W - 32, 26, 16); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillText('🔥 KOMPOR', L.stove.x + 8, 236);
  ctx.fillText('🍽️ PIRING RAKITAN', 480, 236);
  ctx.fillText('🔔 SAJIKAN', 1000, 236);
  // kompor
  ctx.fillStyle = '#37474f'; rr(L.stove.x, L.stove.y, L.stove.w, L.stove.h, 14); ctx.fill();
  L.burners.forEach((b, i) => {
    const br = S.burners[i];
    ctx.fillStyle = '#263238'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill();
    ctx.strokeStyle = '#78909c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(b.x, b.y, b.r - 6, 0, 7); ctx.stroke();
    if (br.item) {
      const done = br.t >= br.max;
      if (!done) {
        // api
        ctx.fillStyle = 'rgba(255,112,67,0.85)';
        ctx.beginPath(); ctx.arc(b.x, b.y + 18, 22 + Math.sin(S.time * 9 + i) * 4, 0, 7); ctx.fill();
        ctx.fillStyle = '#ffca28'; ctx.beginPath(); ctx.arc(b.x, b.y + 20, 12, 0, 7); ctx.fill();
      }
      drawIcon(br.item, b.x, b.y - 6, 44);
      // progress memasak
      ctx.strokeStyle = done ? '#66bb6a' : '#ffca28'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r - 2, -Math.PI / 2, -Math.PI / 2 + (br.t / br.max) * Math.PI * 2); ctx.stroke();
      if (done) {
        ctx.fillStyle = '#1b5e20'; ctx.font = 'bold 17px system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('MATANG! KLIK', b.x, b.y + b.r + 20);
        ctx.textAlign = 'left';
      } else {
        ctx.fillStyle = '#fff'; ctx.font = 'bold 15px system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(Math.ceil(br.max - br.t) + ' dtk', b.x, b.y + b.r + 20);
        ctx.textAlign = 'left';
      }
    } else {
      ctx.fillStyle = '#90a4ae'; ctx.font = '13px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('kompor', b.x, b.y - 2);
      ctx.fillText('kosong', b.x, b.y + 14);
      ctx.textAlign = 'left';
    }
  });
  // piring rakitan
  const p = L.plate;
  ctx.fillStyle = '#eceff1'; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = '#b0bec5'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, 7); ctx.stroke();
  ctx.strokeStyle = '#cfd8dc'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.rx - 26, p.ry - 22, 0, 0, 7); ctx.stroke();
  if (!S.plate.length) {
    ctx.fillStyle = '#90a4ae'; ctx.font = '16px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Piring kosong — klik bahan di konter', p.x, p.y + 5);
    ctx.textAlign = 'left';
  } else {
    S.plate.forEach((id, i) => {
      const a = -Math.PI / 2 + (i / Math.max(1, S.plate.length)) * Math.PI * 2;
      const ix = p.x + Math.cos(a) * 78, iy = p.y + Math.sin(a) * 42;
      drawIcon(id, ix, iy, 40);
    });
    ctx.fillStyle = '#ffe0b2'; ctx.font = 'bold 15px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(S.plate.length + ' bahan — klik bahan di piring untuk membuang', p.x, p.y + p.ry + 20);
    ctx.textAlign = 'left';
  }
  // bel saji
  const b = L.bell;
  const ready = S.plate.length > 0 && S.orders.some(o => sameSet(S.plate, o.dish.needs));
  if (ready) {
    ctx.fillStyle = 'rgba(255,202,40,0.35)';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 10 + Math.sin(S.time * 6) * 4, 0, 7); ctx.fill();
  }
  ctx.fillStyle = '#37474f'; ctx.beginPath(); ctx.arc(b.x, b.y + 34, b.r - 6, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffb300'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r - 18, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#ffca28'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r - 26, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#e65100'; ctx.beginPath(); ctx.arc(b.x, b.y - (b.r - 18), 7, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 20px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(ready ? 'SIAP SAJI!' : 'BEL SAJI', b.x, b.y + 78);
  ctx.fillText('(Spasi)', b.x, b.y + 100);
  ctx.textAlign = 'left';
}

function drawCounter() {
  ctx.fillStyle = '#4e342e'; rr(8, 482, W - 16, 158, 14); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillText('🧺 KONTER BAHAN — klik atau tekan tombol 1–0 (bahan bertanda 🔥 harus dimasak di kompor dulu)', 16, 510);
  ING_IDS.forEach((id, i) => {
    const r = tileRect(i);
    const ing = ING[id];
    ctx.fillStyle = '#fff8e1'; rr(r.x, r.y + 26, r.w, r.h - 26, 12); ctx.fill();
    ctx.strokeStyle = '#d7ccc8'; ctx.lineWidth = 2; rr(r.x, r.y + 26, r.w, r.h - 26, 12); ctx.stroke();
    drawIcon(id, r.x + r.w / 2, r.y + 66, 46);
    ctx.fillStyle = '#3e2723'; ctx.font = 'bold 16px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(ing.name + (ing.cook ? ' 🔥' : ''), r.x + r.w / 2, r.y + 108);
    ctx.fillStyle = '#8d6e63'; ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText('tombol ' + ing.key + (ing.cook ? ' · ' + ing.cook + ' dtk' : ''), r.x + r.w / 2, r.y + 128);
    ctx.textAlign = 'left';
  });
  ctx.fillStyle = '#d7ccc8'; ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('Spasi = sajikan   •   P = jeda   •   M = suara on/off   •   Klik bahan di piring = buang   •   Skor terbaik: ' + S.best, 16, 668);
}

function drawTitle() {
  ctx.fillStyle = 'rgba(20,10,5,0.72)'; ctx.fillRect(0, 0, W, H);
  // spanduk warung
  ctx.fillStyle = '#e53935'; rr(240, 90, 800, 150, 20); ctx.fill();
  ctx.fillStyle = '#fff8e1'; rr(240, 90, 800, 150, 20); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 84px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('🍳 DAPUR KILAT', W / 2, 165);
  ctx.fillStyle = '#ffca28'; ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText('Game Masak Warung — layani pesanan secepat kilat!', W / 2, 205);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff'; ctx.font = '20px system-ui, sans-serif'; ctx.textAlign = 'center';
  const lines = [
    '1. Pesanan muncul di PAPAN PESANAN (atas) — tiap pesanan punya batas waktu.',
    '2. Klik bahan di KONTER (bawah). Bahan bertanda 🔥 naik kompor dulu sampai MATANG, lalu klik untuk ke piring.',
    '3. Rakit sesuai pesanan di piring, lalu tekan BEL atau Spasi untuk menyajikan.',
    '4. Sajian benar = koin + skor + kombo. Salah saji / pesanan kedaluwarsa = strike. 3 strike = dapur tutup!',
    'Shift 150 detik — tiap 5 sajian level naik dan dapur makin ngebut.',
  ];
  lines.forEach((l, i) => ctx.fillText(l, W / 2, 300 + i * 34));
  ctx.textAlign = 'left';
  // tombol mulai
  const b = L.startBtn;
  ctx.fillStyle = '#43a047'; rr(b.x, b.y, b.w, b.h, 16); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 30px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('▶  MULAI MASAK', W / 2, b.y + 46);
  ctx.textAlign = 'left';
  if (S.best > 0) {
    ctx.fillStyle = '#ffca28'; ctx.font = 'bold 20px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Skor terbaik: ' + S.best, W / 2, b.y + 108);
    ctx.textAlign = 'left';
  }
}

function drawPaused() {
  ctx.fillStyle = 'rgba(20,10,5,0.7)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 56px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('⏸ JEDA', W / 2, 330);
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillText('Tekan P atau klik untuk lanjut masak', W / 2, 380);
  ctx.textAlign = 'left';
}

function drawEnd(win) {
  ctx.fillStyle = 'rgba(20,10,5,0.78)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 56px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(win ? '🎉 SHIFT SELESAI!' : '💥 DAPUR TUTUP!', W / 2, 220);
  ctx.font = 'bold 30px system-ui, sans-serif'; ctx.fillStyle = '#ffca28';
  ctx.fillText('Skor: ' + S.score + '   •   Koin: 🪙' + S.coins, W / 2, 290);
  ctx.fillStyle = '#fff'; ctx.font = '22px system-ui, sans-serif';
  ctx.fillText('Pesanan tersaji: ' + S.served + '   •   Kombo terbaik: x' + S.bestCombo + '   •   Level: ' + S.level, W / 2, 340);
  ctx.fillText('Skor terbaik: ' + S.best, W / 2, 380);
  ctx.fillText(win ? 'Warung tutup dengan senyum — pelanggan pulang kenyang!' : 'Tiga strike… pelanggan kecewa dan pulang. Coba lagi, koki!', W / 2, 420);
  const b = L.againBtn;
  ctx.fillStyle = '#43a047'; rr(b.x, b.y, b.w, b.h, 16); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 28px system-ui, sans-serif';
  ctx.fillText('↻  MAIN LAGI (R)', W / 2, b.y + 45);
  ctx.textAlign = 'left';
}

function render() {
  ctx.clearRect(0, 0, W, H);
  drawBackground();
  if (S.screen === 'title') { drawHeader(); drawOrders(); drawKitchen(); drawCounter(); drawTitle(); return; }
  drawHeader();
  drawOrders();
  drawKitchen();
  drawCounter();
  if (S.screen === 'paused') drawPaused();
  if (S.screen === 'over') drawEnd(false);
  if (S.screen === 'done') drawEnd(true);
}

/* ---------- input ---------- */
function toGame(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
}
function inRect(p, r) { return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; }
function inCircle(p, c) { const dx = p.x - c.x, dy = p.y - c.y; return dx * dx + dy * dy <= c.r * c.r; }

canvas.addEventListener('click', (e) => {
  ac();
  const p = toGame(e);
  if (S.screen === 'title') {
    if (inRect(p, L.startBtn)) { sfx.click(); resetGame(); }
    return;
  }
  if (S.screen === 'paused') { togglePause(); return; }
  if (S.screen === 'over' || S.screen === 'done') {
    if (inRect(p, L.againBtn)) { sfx.click(); resetGame(); }
    return;
  }
  // playing
  for (let i = 0; i < S.orders.length; i++) {
    if (inRect(p, orderRect(i))) { S.selected = S.selected === i ? -1 : i; sfx.click(); return; }
  }
  for (let i = 0; i < 2; i++) {
    if (inCircle(p, L.burners[i])) { takeBurner(i); return; }
  }
  if (inCircle(p, L.bell)) { serve(); return; }
  // klik bahan di piring = buang (cek posisi ikon piring)
  if (S.plate.length) {
    const pl = L.plate;
    for (let i = 0; i < S.plate.length; i++) {
      const a = -Math.PI / 2 + (i / Math.max(1, S.plate.length)) * Math.PI * 2;
      const ix = pl.x + Math.cos(a) * 78, iy = pl.y + Math.sin(a) * 42;
      if (Math.hypot(p.x - ix, p.y - iy) < 26) { removeFromPlate(i); return; }
    }
  }
  for (let i = 0; i < ING_IDS.length; i++) {
    if (inRect(p, tileRect(i))) { addIngredient(ING_IDS[i]); return; }
  }
});

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  if (k === 'm') { S.muted = !S.muted; setFlash(S.muted ? 'Suara mati' : 'Suara nyala'); return; }
  if (S.screen === 'title' && (k === 'enter' || k === ' ')) { ac(); resetGame(); e.preventDefault(); return; }
  if ((S.screen === 'over' || S.screen === 'done') && (k === 'r' || k === 'enter')) { resetGame(); return; }
  if (k === 'p' || k === 'escape') { togglePause(); return; }
  if (S.screen !== 'playing') return;
  if (k === ' ') { e.preventDefault(); serve(); return; }
  const idx = ING_IDS.findIndex(id => ING[id].key === k);
  if (idx >= 0) addIngredient(ING_IDS[idx]);
});

/* ---------- loop ---------- */
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* hook untuk driver screenshot (bukan bagian gameplay) */
window.__game = {
  get state() { return S; },
  layout: L,
  tileRect, orderRect,
  start: () => { if (S.screen === 'title') resetGame(); },
  add: addIngredient,
  take: takeBurner,
  serve,
};
