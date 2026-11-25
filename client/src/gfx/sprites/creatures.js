// Monstros não humanoides: slime, feras (lobos), aranha, escorpião e o dragão chefe.
import { Pix, shade } from '../pixel.js';

const cache = new Map();

export function creatureFrame(art, pose, frame, key) {
  const k = `${key}|${pose}|${frame}`;
  let c = cache.get(k);
  if (!c) {
    const fn = { slime, beast, spider, scorpion, dragon }[art.kind];
    c = fn(art, pose, frame).toCanvas();
    cache.set(k, c);
  }
  return c;
}

function slime(a, pose, f) {
  const P = new Pix(20, 18);
  let rx = 7, ry = 5.5, cy = 11;
  if (pose === 'walk' || pose === 'idle') { const sq = [0, 1, 0, -1][f % 4]; rx += sq * 0.6; ry -= sq * 0.5; cy += sq * 0.5; }
  if (pose === 'attack') { rx = f === 1 ? 5.5 : 8; ry = f === 1 ? 7.5 : 4.5; cy = f === 1 ? 9 : 12; }
  P.ellipse(10, cy + 1, rx, ry - 0.5, a.dark);
  P.ball(10, cy, rx, ry, a.body);
  P.ellipse(7, cy - ry * 0.45, 1.6, 1.1, a.light);
  P.set(12, cy - ry * 0.6, a.light);
  // olhos
  P.rect(7, cy - 1, 1, 2, '#1a1020'); P.rect(12, cy - 1, 1, 2, '#1a1020');
  P.set(7, cy - 1, '#ffffff'); P.set(12, cy - 1, '#ffffff');
  P.set(9, cy + 2, shade(a.body, -0.45)); P.set(10, cy + 2, shade(a.body, -0.45));
  P.outline('#14301a');
  return P;
}

// Fera quadrúpede vista de lado (lobos)
function beast(a, pose, f) {
  const P = new Pix(24, 18);
  const b = a.body, d = a.dark, l = a.light;
  const bob = pose === 'walk' ? [0, -1, 0, -1][f % 4] : 0;
  const lunge = pose === 'attack' ? (f === 1 ? -2 : 0) : 0;
  const y = 7 + bob;
  // cauda
  P.line(3, y + 1, 1, y - 2 + (f % 2), d); P.line(4, y + 1, 2, y - 2 + (f % 2), b);
  // corpo
  P.ellipse(10, y + 3, 7, 3.5, b);
  for (let i = 5; i < 16; i++) P.set(i, y + 6, d);
  for (let i = 6; i < 14; i++) P.set(i, y, l);
  // pernas (alternando)
  const st = pose === 'walk' ? f % 4 : 0;
  const legs = [[5, st === 1 ? 1 : 0], [8, st === 3 ? 1 : 0], [13, st === 3 ? 1 : 0], [15, st === 1 ? 1 : 0]];
  for (const [lx, up] of legs) { P.rect(lx, y + 6 - up, 2, 4, lx % 2 ? d : b); P.set(lx, y + 9 - up, '#2a2020'); }
  // cabeça
  const hx = 17 + lunge * -1;
  P.ellipse(hx, y + 1, 3.5, 3, b);
  P.rect(hx + 2, y + 1, 4, 2, b); P.rect(hx + 2, y + 3, 3, 1, d); // focinho
  P.set(hx + 5, y + 1, '#1a1020'); // nariz
  P.set(hx, y - 3, b); P.set(hx - 1, y - 3, d); P.set(hx - 2, y - 2, b); // orelhas
  P.set(hx + 1, y, a.eye || '#ffd23a');
  if (pose === 'attack' && f === 1) { P.set(hx + 3, y + 3, '#ffffff'); P.set(hx + 5, y + 3, '#ffffff'); }
  P.outline('#1a1020');
  return P;
}

function spider(a, pose, f) {
  const P = new Pix(22, 18);
  const b = a.body, d = a.dark;
  const t = pose === 'walk' ? f % 2 : 0;
  const lift = pose === 'attack' && f === 1 ? -2 : 0;
  // pernas
  for (let i = 0; i < 4; i++) {
    const yy = 7 + i * 2 + lift;
    const off = (i + t) % 2 ? 1 : -1;
    P.line(8, yy, 3, yy - 3 + off, d); P.line(3, yy - 3 + off, 1, yy + 1 + off, d);
    P.line(13, yy, 18, yy - 3 - off, d); P.line(18, yy - 3 - off, 20, yy + 1 - off, d);
  }
  P.ball(10.5, 12 + lift, 5, 4, b); // abdômen
  P.set(9, 11 + lift, shade(b, 0.5)); P.rect(10, 13 + lift, 2, 1, '#c03a3a');
  P.ball(10.5, 7 + lift, 3.5, 3, shade(b, 0.1)); // cabeça
  P.set(9, 7 + lift, a.eye); P.set(12, 7 + lift, a.eye); P.set(10, 6 + lift, a.eye); P.set(11, 6 + lift, a.eye);
  P.set(9, 10 + lift, '#e8e8e8'); P.set(12, 10 + lift, '#e8e8e8');
  P.outline('#120a18');
  return P;
}

function scorpion(a, pose, f) {
  const P = new Pix(24, 20);
  const b = a.body, d = a.dark, l = a.light;
  const t = pose === 'walk' ? f % 2 : 0;
  const strike = pose === 'attack' ? (f === 1 ? 3 : f === 2 ? 1 : 0) : 0;
  for (let i = 0; i < 3; i++) {
    const x = 7 + i * 3, o = (i + t) % 2;
    P.line(x, 13, x - 2, 16 + o, d); P.line(x + 1, 13, x + 3, 16 + 1 - o, d);
  }
  P.ellipse(11, 12, 6, 3, b);
  for (let i = 6; i < 17; i += 2) P.set(i, 11, l);
  // garras
  P.ball(18.5, 10, 2.2, 1.6, b); P.ball(18.5, 14, 2.2, 1.6, b);
  P.set(20, 9, d); P.set(20, 15, d);
  // cauda curvada com ferrão
  const pts = [[5, 11], [3, 9], [3, 6], [5, 4], [8, 3 + strike], [10, 4 + strike]];
  for (let i = 0; i < pts.length - 1; i++) P.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], i % 2 ? d : b);
  P.set(11, 5 + strike, '#ffe070'); P.set(12, 6 + strike, '#ffe070');
  P.set(15, 11, '#1a1020'); P.set(15, 13, '#1a1020');
  P.outline('#1a0c08');
  return P;
}

function dragon(a, pose, f) {
  const P = new Pix(48, 42);
  const b = a.body, d = a.dark, l = a.light, belly = a.belly;
  const flap = f % 2;
  const bob = pose === 'walk' ? (f % 2) : 0;
  const atk = pose === 'attack' ? f : -1;
  // asas
  const wingY = 8 - flap * 3 + bob;
  for (let i = 0; i < 14; i++) {
    const h = Math.max(2, 14 - i);
    for (let j = 0; j < h; j++) {
      const c = j === 0 ? l : (i + j) % 5 === 0 ? d : shade(b, -0.15);
      P.set(10 - i + 4, wingY + j + Math.floor(i / 2), c);
      P.set(34 + i - 4, wingY + j + Math.floor(i / 2), c);
    }
  }
  // cauda
  for (let i = 0; i < 10; i++) P.ellipse(24 + Math.sin(i * 0.6 + flap) * 3, 30 + i + bob, 3 - i * 0.2, 1.6, i % 2 ? d : b);
  P.set(24 + Math.sin(6 + flap) * 3, 40 + bob, '#ffcf3a');
  // corpo
  P.ball(24, 24 + bob, 9, 8, b);
  P.ellipse(24, 27 + bob, 5, 5, belly);
  for (let j = 23; j < 32; j += 2) P.line(21, j + bob, 27, j + bob, shade(belly, -0.2));
  // patas
  P.ball(16, 31 + bob, 3, 2.5, d); P.ball(32, 31 + bob, 3, 2.5, d);
  for (const x of [14, 16, 18, 30, 32, 34]) P.set(x, 33 + bob, '#f0f0f0');
  // pescoço e cabeça
  const hy = 9 + bob + (atk === 1 ? 3 : 0);
  P.ellipse(24, 16 + bob, 4, 5, b);
  P.ball(24, hy, 6, 5, b);
  P.rect(21, hy + 3, 7, 3, shade(b, -0.1));
  P.set(21, hy + 4, '#1a1020'); P.set(27, hy + 4, '#1a1020');
  P.set(21, hy - 1, a.eye); P.set(27, hy - 1, a.eye); P.set(20, hy - 1, a.eye); P.set(28, hy - 1, a.eye);
  // chifres
  P.line(19, hy - 4, 16, hy - 8, '#f0e6c8'); P.line(29, hy - 4, 32, hy - 8, '#f0e6c8');
  P.line(20, hy - 4, 18, hy - 7, '#bfb090'); P.line(28, hy - 4, 30, hy - 7, '#bfb090');
  if (atk === 1 || atk === 2) { P.rect(22, hy + 6, 5, 2, '#ffb030'); P.rect(23, hy + 8, 3, 2, '#ff6020'); }
  P.outline('#140620', true);
  return P;
}
