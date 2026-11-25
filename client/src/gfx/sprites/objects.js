// Objetos do mundo: árvores, pedras, construções, cercas, fonte, baús etc.
// Cada sprite retorna { c: canvas, ox, oy } onde (ox, oy) é o ponto do sprite que encosta na base do tile.
import { Pix, shade, rng } from '../pixel.js';
import { drawTile, tileCanvas, hasSheet } from '../assets.js';

const cache = new Map();
function cached(k, fn) {
  let v = cache.get(k);
  if (!v) { v = fn(); cache.set(k, v); }
  return v;
}

function canopy(P, cx, cy, r, c, R) {
  const d = shade(c, -0.28), l = shade(c, 0.22), ll = shade(c, 0.4);
  const blobs = [[0, 0, r], [-r * 0.7, r * 0.25, r * 0.7], [r * 0.7, r * 0.25, r * 0.7], [0, -r * 0.55, r * 0.75], [-r * 0.35, r * 0.55, r * 0.6], [r * 0.35, r * 0.55, r * 0.6]];
  for (const [bx, by, br] of blobs) P.ellipse(cx + bx, cy + by + 1, br, br * 0.85, d);
  for (const [bx, by, br] of blobs) P.ellipse(cx + bx, cy + by, br * 0.9, br * 0.78, c);
  for (const [bx, by, br] of blobs) P.ellipse(cx + bx - br * 0.25, cy + by - br * 0.3, br * 0.45, br * 0.35, l);
  for (let i = 0; i < 10; i++) P.set(cx + (R() - 0.5) * r * 1.6, cy + (R() - 0.7) * r * 1.2, ll);
  for (let i = 0; i < 12; i++) P.set(cx + (R() - 0.5) * r * 2, cy + (R() - 0.2) * r * 1.4, d);
}

const BUILDERS = {
  tree(v) {
    const P = new Pix(34, 40); const R = rng(11 + v * 7);
    const greens = ['#3f9a3a', '#4aa83f', '#3a8c40', '#55a838'];
    P.ellipse(17, 37, 9, 2.5, '#2a5a20');
    P.rect(14, 24, 6, 14, '#7a4a28'); P.rect(14, 24, 2, 14, '#9a6a3a'); P.rect(19, 24, 1, 14, '#5a3218');
    P.set(13, 37, '#7a4a28'); P.set(20, 37, '#5a3218'); P.set(12, 38, '#5a3218'); P.set(21, 38, '#5a3218');
    canopy(P, 17, 15, 10, greens[v % 4], R);
    P.outline('#16240f');
    return { c: P.toCanvas(), ox: 17, oy: 38 };
  },
  pine(v) {
    const P = new Pix(24, 38); const R = rng(5 + v);
    P.rect(10, 28, 4, 8, '#6a4228');
    for (let layer = 0; layer < 4; layer++) {
      const y0 = 4 + layer * 6, w = 4 + layer * 3;
      for (let j = 0; j < 8; j++) {
        const ww = Math.round((w * j) / 8) + 1;
        for (let i = -ww; i <= ww; i++) P.set(12 + i, y0 + j, j < 2 || (i < -ww + 2 && j < 5) ? '#f4f8ff' : i > ww * 0.4 ? '#24603e' : '#2e7a4a');
      }
    }
    for (let i = 0; i < 8; i++) P.set(6 + R() * 12, 8 + R() * 20, '#ffffff');
    P.outline('#102018');
    return { c: P.toCanvas(), ox: 12, oy: 36 };
  },
  deadtree(v) {
    const P = new Pix(24, 30);
    P.rect(10, 12, 4, 17, '#3a2a26'); P.rect(10, 12, 1, 17, '#5a4038');
    P.line(11, 14, 5, 6, '#3a2a26'); P.line(5, 6, 3, 7, '#3a2a26'); P.line(13, 12, 19, 4 + (v % 3), '#3a2a26'); P.line(16, 8, 20, 9, '#3a2a26');
    P.set(12, 20, '#ff6a20');
    P.outline('#120806');
    return { c: P.toCanvas(), ox: 12, oy: 28 };
  },
  cactus(v) {
    const P = new Pix(18, 24);
    const g = '#4a9a4a', d = '#2e6e34', l = '#7ac46a';
    P.rect(7, 4, 4, 19, g); P.rect(7, 4, 1, 19, l); P.rect(10, 4, 1, 19, d);
    P.rect(3, 9 + (v % 2) * 2, 2, 6, g); P.rect(3, 14 + (v % 2) * 2, 4, 2, g);
    P.rect(13, 7, 2, 6, g); P.rect(11, 12, 4, 2, g);
    if (v === 2) { P.set(9, 3, '#ff6a9a'); P.set(8, 3, '#ffd0e0'); }
    for (let y = 6; y < 22; y += 3) P.set(8, y, '#e8f0c0');
    P.outline('#16301a');
    return { c: P.toCanvas(), ox: 9, oy: 23 };
  },
  rock(v, col = '#8a8a94') {
    const P = new Pix(18, 14);
    P.ball(9, 8, 7 - (v % 2), 5, col);
    P.ball(5 + v, 9, 3, 2.5, shade(col, -0.1));
    P.set(7, 5, shade(col, 0.5));
    P.outline('#1a1820');
    return { c: P.toCanvas(), ox: 9, oy: 13 };
  },
  icerock(v) { return BUILDERS.rock(v, '#a8d8f0'); },
  lavarock(v) {
    const r = BUILDERS.rock(v, '#4a3a3a');
    const ctx = r.c.getContext('2d'); ctx.fillStyle = '#ff7a2a'; ctx.fillRect(7, 8, 3, 1); ctx.fillRect(9, 9, 1, 2);
    return r;
  },
  stalagmite(v) {
    const P = new Pix(14, 22);
    for (let j = 0; j < 18; j++) { const w = Math.floor(j / 4) + 1; P.rect(7 - w, 3 + j, w * 2, 1, j % 3 ? '#6e6878' : '#5a5464'); P.set(7 - w, 3 + j, '#8a8496'); }
    if (v % 2) P.set(6, 12, '#7af0ff');
    P.outline('#16141c');
    return { c: P.toCanvas(), ox: 7, oy: 21 };
  },
  bush(v) {
    const P = new Pix(18, 14); const R = rng(v + 3);
    canopy(P, 9, 8, 5, v % 2 ? '#4a9a3a' : '#3f8a34', R);
    if (v === 1) { P.set(6, 6, '#e83a4a'); P.set(11, 8, '#e83a4a'); P.set(9, 5, '#e83a4a'); }
    P.outline('#16240f');
    return { c: P.toCanvas(), ox: 9, oy: 13 };
  },
  flower(v) {
    const P = new Pix(10, 8);
    const cols = ['#ff5a6a', '#ffd23a', '#c86aff', '#ffffff'];
    for (let i = 0; i < 3; i++) {
      const x = 2 + i * 3, y = 3 + (i % 2);
      P.set(x, y + 1, '#3a7a2a'); P.set(x, y + 2, '#3a7a2a');
      P.set(x, y, cols[(v + i) % 4]); P.set(x - 1, y, shade(cols[(v + i) % 4], -0.2)); P.set(x + 1, y, shade(cols[(v + i) % 4], -0.2)); P.set(x, y - 1, cols[(v + i) % 4]);
    }
    return { c: P.toCanvas(), ox: 5, oy: 7 };
  },
  mushroom(v) {
    const P = new Pix(10, 10);
    const c = v % 2 ? '#7af0ff' : '#c86aff';
    P.rect(4, 5, 2, 4, '#e8e0d0'); P.ellipse(5, 4.5, 3.5, 2, c); P.set(4, 3, '#ffffff');
    P.outline('#16141c');
    return { c: P.toCanvas(), ox: 5, oy: 9 };
  },
  bones(v) {
    const P = new Pix(14, 8);
    P.line(2, 5, 9, 3 + (v % 2), '#e8e2cf'); P.set(1, 5, '#e8e2cf'); P.set(10, 3, '#e8e2cf');
    P.ball(11, 5, 2, 1.6, '#e8e2cf'); P.set(11, 5, '#3a3040');
    return { c: P.toCanvas(), ox: 7, oy: 7 };
  },
  ember() {
    const P = new Pix(6, 6); P.set(2, 3, '#ff7a2a'); P.set(3, 2, '#ffd040'); P.set(3, 3, '#ff4a1a');
    return { c: P.toCanvas(), ox: 3, oy: 5 };
  },
  torch() {
    const P = new Pix(8, 20);
    P.rect(3, 8, 2, 11, '#6a4228'); P.rect(2, 7, 4, 2, '#4a4a5a');
    P.outline('#120a10');
    return { c: P.toCanvas(), ox: 4, oy: 19, flame: [4, 5] };
  },
  pillar() {
    const P = new Pix(16, 30);
    P.box(2, 24, 12, 5, '#5a4c74'); P.box(3, 4, 10, 21, '#4c4060'); P.box(2, 1, 12, 4, '#5a4c74');
    for (let y = 6; y < 24; y += 3) P.set(5, y, '#6a5a88');
    P.outline('#140c20');
    return { c: P.toCanvas(), ox: 8, oy: 29 };
  },
  tent(v) {
    const P = new Pix(34, 30);
    const c = v % 2 ? '#a0603a' : '#8a7a4a', d = shade(c, -0.3), l = shade(c, 0.2);
    for (let j = 0; j < 22; j++) { const w = Math.floor(j * 0.75) + 1; P.rect(17 - w, 5 + j, w * 2, 1, c); P.set(17 - w, 5 + j, l); P.set(16 + w, 5 + j, d); }
    for (let j = 10; j < 27; j++) { const w = Math.floor((j - 10) * 0.3); P.rect(17 - w, j, w * 2 + 1, 1, '#2a1a10'); }
    P.line(17, 1, 17, 6, '#6a4228'); P.rect(18, 1, 4, 3, '#c83a2a');
    P.outline('#1a1008');
    return { c: P.toCanvas(), ox: 17, oy: 27 };
  },
  fence(h) {
    const P = new Pix(16, 20);
    const w = '#8a5a32', l = '#b07a48', d = '#5a3a1e';
    if (h) { P.rect(6, 2, 4, 17, w); P.rect(6, 2, 1, 17, l); P.rect(9, 2, 1, 17, d); }
    else { P.rect(1, 6, 3, 13, w); P.rect(12, 6, 3, 13, w); P.rect(0, 9, 16, 2, l); P.rect(0, 14, 16, 2, w); P.rect(0, 16, 16, 1, d); }
    P.outline('#1a1008');
    return { c: P.toCanvas(), ox: 8, oy: 19 };
  },
  lamp() {
    const P = new Pix(10, 30);
    P.rect(4, 8, 2, 21, '#3a3a4a'); P.rect(3, 27, 4, 2, '#2a2a3a');
    P.box(2, 2, 6, 7, '#4a4a5a'); P.rect(3, 4, 4, 4, '#ffe080');
    P.outline('#121018');
    return { c: P.toCanvas(), ox: 5, oy: 29, glow: [5, 6] };
  },
  board() {
    const P = new Pix(32, 28);
    P.rect(4, 14, 2, 13, '#6a4228'); P.rect(26, 14, 2, 13, '#6a4228');
    P.box(1, 2, 30, 16, '#8a5a32');
    P.rect(3, 4, 26, 12, '#c8a070');
    for (const [x, y, c] of [[5, 5, '#f0e6d0'], [13, 6, '#fff6e0'], [21, 5, '#e8dcc0']]) { P.rect(x, y, 6, 8, c); P.rect(x + 1, y + 2, 4, 1, '#7a6a5a'); P.rect(x + 1, y + 4, 3, 1, '#7a6a5a'); P.set(x + 3, y, '#c83a2a'); }
    P.outline('#1a1008');
    return { c: P.toCanvas(), ox: 16, oy: 27 };
  },
  chest(open) {
    const P = new Pix(16, 14);
    P.box(1, 5, 14, 8, '#8a5a2a');
    if (!open) { P.box(1, 1, 14, 5, '#a06a32'); P.rect(1, 5, 14, 1, '#e0b040'); P.rect(7, 4, 2, 3, '#ffe070'); }
    else { P.rect(1, 1, 14, 3, '#5a3a1a'); P.rect(2, 4, 12, 2, '#ffd23a'); P.set(5, 4, '#ffffff'); }
    P.rect(1, 9, 14, 1, '#e0b040');
    P.outline('#1a1008');
    return { c: P.toCanvas(), ox: 8, oy: 13 };
  },
  campfire() {
    const P = new Pix(16, 10);
    P.line(2, 8, 13, 5, '#6a4228'); P.line(2, 5, 13, 8, '#5a3218');
    for (let i = 0; i < 6; i++) P.set(2 + i * 2.2, 9, '#7a7a84');
    P.outline('#1a1008');
    return { c: P.toCanvas(), ox: 8, oy: 9, flame: [8, 4] };
  },
};

// ---------- sprites da arte Kenney (CC0) ----------
const K1 = { // objetos de 1 tile: [folha, índice]
  bush: () => ['town', 5], mushroom: () => ['town', 29], well: () => ['town', 104], sign: () => ['town', 83],
  beehive: () => ['town', 94], barrel: () => ['dungeon', 82], anvil: () => ['dungeon', 74],
  grave: (v) => ['dungeon', v % 2 ? 64 : 65], crate: () => ['dungeon', 66], target: () => ['town', 95],
};
// árvores: as altas usam 2 tiles (copa em cima + tronco embaixo)
const TREES = { tree: [[4, 16], [28], [4, 16], [5]], autumn: [[3, 15], [27], [3, 15], [27]] };

function kenneySingle(sheet, i) {
  const t = tileCanvas(sheet, i);
  return t ? { c: t, ox: 8, oy: 16 } : null;
}

function kenneyStack(parts) {
  // empilha tiles verticalmente (ex.: coluna de 2 tiles)
  const c = document.createElement('canvas');
  c.width = 16; c.height = parts.length * 16;
  const ctx = c.getContext('2d');
  parts.forEach(([s, i], n) => drawTile(ctx, s, i, 0, n * 16));
  return { c, ox: 8, oy: c.height };
}

const KSTYLE = {
  temple: { roof: 'red', wall: 'stone' }, store: { roof: 'red', wall: 'wood' }, smith: { roof: 'grey', wall: 'stone', chimney: true },
  bank: { roof: 'grey', wall: 'stone' }, arcane: { roof: 'red', wall: 'wood', chimney: true },
};
const ROOF = { red: { top: [52, 53, 54], eave: [64, 65, 66], gable: 67, chimney: 55 }, grey: { top: [48, 49, 50], eave: [60, 61, 62], gable: 63, chimney: 51 } };
const WALL = { wood: { l: 72, m: 73, r: 75, win: 84, door: 85 }, stone: { l: 76, m: 77, r: 79, win: 88, door: 89 } };

function kenneyBuilding(o) {
  const st = KSTYLE[o.s] || KSTYLE.store;
  const R = ROOF[st.roof], W = WALL[st.wall];
  const c = document.createElement('canvas');
  c.width = o.w * 16; c.height = o.h * 16;
  const ctx = c.getContext('2d');
  const roofRows = Math.max(2, Math.ceil(o.h / 2));
  const mid = Math.floor(o.w / 2);
  const pick = (arr, x) => (x === 0 ? arr[0] : x === o.w - 1 ? arr[2] : arr[1]);
  for (let y = 0; y < o.h; y++) {
    for (let x = 0; x < o.w; x++) {
      let i;
      if (y < roofRows - 1) i = pick(R.top, x);
      else if (y === roofRows - 1) i = x === mid ? R.gable : pick(R.eave, x);
      else if (y === o.h - 1) i = x === mid ? W.door : x === 0 ? W.l : x === o.w - 1 ? W.r : (x % 2 ? W.win : W.m);
      else i = x === 0 ? W.l : x === o.w - 1 ? W.r : (x % 2 === 0 ? W.win : W.m);
      if (y === 0 && st.chimney && x === o.w - 2) i = R.chimney;
      drawTile(ctx, 'town', i, x * 16, y * 16);
    }
  }
  return { c, ox: 0, oy: o.h * 16, building: true, kenney: true };
}

export function objectSprite(o) {
  if (hasSheet('town')) {
    if (o.t === 'building') return cached(`kb|${o.s}|${o.w}|${o.h}`, () => kenneyBuilding(o));
    if (o.t === 'fence') return cached('kf' + o.h, () => kenneySingle('town', o.h ? 59 : 81));
    if (o.t === 'chest' && hasSheet('dungeon')) return cached('kc' + (o.open ? 1 : 0), () => kenneySingle('dungeon', o.open ? 91 : 89));
    if (o.t === 'pillar' && hasSheet('dungeon')) return cached('kp', () => kenneyStack([['dungeon', 6], ['dungeon', 18]]));
    if (TREES[o.t]) {
      const parts = TREES[o.t][(o.v || 0) % 4];
      return cached(`kt|${o.t}|${parts.join('-')}`, () => (parts.length === 1 ? kenneySingle('town', parts[0]) : kenneyStack(parts.map((i) => ['town', i]))));
    }
    const k = K1[o.t];
    if (k) { const [s, i] = k(o.v || 0); if (hasSheet(s)) return cached(`k|${s}|${i}`, () => kenneySingle(s, i)); }
  }
  switch (o.t) {
    case 'building': return cached(`b|${o.s}|${o.w}|${o.h}`, () => building(o));
    case 'fountain': return cached('fountain', fountain);
    case 'fence': return cached('fence' + o.h, () => BUILDERS.fence(o.h));
    case 'chest': return cached('chest' + (o.open ? 1 : 0), () => BUILDERS.chest(o.open));
    default: {
      const b = BUILDERS[o.t];
      if (!b) return null;
      return cached(o.t + '|' + (o.v || 0), () => b(o.v || 0));
    }
  }
}

// ---------- construções ----------
const STYLE = {
  temple: { roof: '#c8483a', wall: '#b4aca0', trim: '#7a7064', door: '#5a3a24', glass: true },
  store: { roof: '#d0703a', wall: '#a0744a', trim: '#6a4428', door: '#4a2c18', sign: '#c8a060' },
  smith: { roof: '#6a4a3a', wall: '#8a8478', trim: '#4a4440', door: '#3a2418', chimney: true, forge: true },
  bank: { roof: '#c86434', wall: '#9a9488', trim: '#5a5248', door: '#4a2c18', columns: true },
  arcane: { roof: '#6a4aa8', wall: '#a08a70', trim: '#5a4430', door: '#3a2448', glass: true },
};

function building(o) {
  const st = STYLE[o.s] || STYLE.store;
  const W = o.w * 16, H = o.h * 16 + 14;
  const P = new Pix(W + 2, H + 2);
  const R = rng(o.w * 31 + o.h);
  const wallTop = Math.round(H * 0.5);
  const roofL = shade(st.roof, 0.18), roofD = shade(st.roof, -0.3), roofDD = shade(st.roof, -0.45);
  // parede
  P.rect(2, wallTop, W - 2, H - wallTop - 1, st.wall);
  for (let y = wallTop; y < H - 1; y += 4) {
    const off = ((y - wallTop) / 4) % 2 ? 3 : 0;
    for (let x = 2 + off; x < W; x += 6) P.rect(x, y, 1, 4, shade(st.wall, -0.15));
    P.rect(2, y, W - 2, 1, shade(st.wall, -0.12));
  }
  P.rect(2, H - 3, W - 2, 2, st.trim);
  // telhado (telhas em fileiras, como nas vilas clássicas)
  for (let y = 0; y < wallTop + 3; y++) {
    const inset = Math.max(0, Math.round((wallTop - y) * 0.12));
    for (let x = inset; x < W + 2 - inset; x++) {
      const row = Math.floor(y / 3);
      const tileEdge = (x + (row % 2) * 3) % 6 === 0;
      let c = y % 3 === 2 ? roofD : tileEdge ? roofD : st.roof;
      if (y % 3 === 0 && !tileEdge) c = roofL;
      P.set(x, y, c);
    }
  }
  P.rect(0, wallTop + 2, W + 2, 2, roofDD);
  // cumeeira
  P.rect(Math.round(W * 0.12), 0, Math.round(W * 0.76), 2, shade(st.roof, -0.5));
  // porta
  const dw = 10, dx = Math.round(W / 2 - dw / 2) + 1, dh = Math.min(16, H - wallTop - 4);
  P.rect(dx - 1, H - 2 - dh - 1, dw + 2, dh + 1, st.trim);
  P.rect(dx, H - 2 - dh, dw, dh, st.door);
  P.rect(dx, H - 2 - dh, dw, 2, shade(st.door, -0.4));
  for (let x = dx + 2; x < dx + dw; x += 3) P.rect(x, H - dh, 1, dh - 2, shade(st.door, 0.15));
  P.set(dx + dw - 2, H - 2 - Math.floor(dh / 2), '#ffd23a');
  // janelas
  const winY = wallTop + 6;
  for (const wx of [8, W - 16]) {
    if (Math.abs(wx - dx) < 14) continue;
    P.rect(wx - 1, winY - 1, 10, 9, st.trim);
    P.rect(wx, winY, 8, 7, '#2a3a5a');
    P.rect(wx, winY, 8, 2, '#6a9ad0');
    P.rect(wx + 3, winY, 1, 7, st.trim); P.rect(wx, winY + 3, 8, 1, st.trim);
    P.rect(wx - 1, winY + 8, 10, 1, shade(st.trim, -0.3));
  }
  if (st.glass) {
    // rosácea / vitral no telhado
    const cx = Math.round(W / 2) + 1, cy = Math.round(wallTop * 0.55);
    P.ellipse(cx, cy, 7, 7, st.trim);
    P.ellipse(cx, cy, 6, 6, o.s === 'arcane' ? '#8a5aff' : '#e0503a');
    P.ellipse(cx, cy, 3.5, 3.5, '#ffd23a');
    P.ellipse(cx, cy, 1.5, 1.5, '#ffffff');
    for (let a = 0; a < 8; a++) P.set(cx + Math.cos(a * Math.PI / 4) * 5, cy + Math.sin(a * Math.PI / 4) * 5, '#7ac0ff');
  }
  if (st.chimney) {
    const cx = W - 18;
    P.box(cx, 0, 7, wallTop - 4, '#7a7470');
    P.rect(cx - 1, 0, 9, 2, '#5a5450');
  }
  if (st.columns) {
    for (const x of [dx - 8, dx + dw + 4]) { P.box(x, wallTop + 2, 4, H - wallTop - 4, '#d8d2c4'); }
  }
  if (st.forge) {
    P.rect(4, H - 10, 10, 8, '#3a3434'); P.rect(6, H - 8, 6, 4, '#ff7a2a'); P.rect(7, H - 7, 4, 2, '#ffe070');
  }
  if (st.sign) {
    P.box(W - 22, wallTop + 2, 14, 7, st.sign); P.rect(W - 20, wallTop + 4, 10, 1, '#5a3a1a'); P.rect(W - 20, wallTop + 6, 7, 1, '#5a3a1a');
  }
  for (let i = 0; i < 6; i++) P.set(2 + R() * (W - 4), wallTop + 4 + R() * (H - wallTop - 8), shade(st.wall, 0.15));
  P.outline('#1a1008');
  return { c: P.toCanvas(), ox: 0, oy: H, building: true };
}

function fountain() {
  const P = new Pix(50, 52);
  const stone = '#a8a8b4', sd = '#6a6a78';
  // bacia hexagonal
  for (let y = 22; y < 50; y++) {
    const t = Math.min(y - 22, 49 - y, 8);
    const inset = Math.max(0, 8 - t);
    P.rect(1 + inset, y, 48 - inset * 2, 1, y > 44 ? sd : stone);
  }
  for (let y = 26; y < 45; y++) {
    const t = Math.min(y - 26, 44 - y, 6);
    const inset = Math.max(0, 6 - t);
    P.rect(5 + inset, y, 40 - inset * 2, 1, y < 30 ? '#2c64b2' : '#3b7cc9');
  }
  // estátua de pedra encapuzada (guardião da vila)
  P.rect(21, 30, 8, 10, sd);
  P.ball(25, 22, 7, 9, '#8a8a96');
  P.ball(25, 10, 5, 5, '#9a9aa6');
  P.ellipse(25, 11, 3, 2.5, '#3a3a46');
  P.rect(23, 26, 4, 3, '#b8b8c4');
  P.rect(24, 30, 2, 10, '#7cc0ff');
  P.outline('#18182a');
  return { c: P.toCanvas(), ox: 1, oy: 50, fountain: true };
}
