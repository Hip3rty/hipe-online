// Tiles de terreno em pixel art (16x16), com variações e transições suaves entre terrenos.
import { Pix, shade, rng } from '../pixel.js';
import { T } from '@hipe/shared/regions.js';
import { drawTile, hasSheet } from '../assets.js';

export const PAL = {
  // cores alinhadas à paleta dos tiles Kenney (CC0) para tudo combinar
  [T.GRASS]: ['#84c669', '#6fae58', '#9ad47e'],
  [T.FOREST]: ['#6aa957', '#579447', '#82bf6c'],
  [T.PATH]: ['#eaa56c', '#c98550', '#f4c08e'],
  [T.SAND]: ['#f2d28a', '#dcb66c', '#fbe6ad'],
  [T.SNOW]: ['#f0f5fb', '#d0deec', '#ffffff'],
  [T.CAVE]: ['#6a6378', '#544e62', '#807a90'],
  [T.ASH]: ['#5a4440', '#45332f', '#76574c'],
  [T.LAVA]: ['#ff7a28', '#e04a12', '#ffd84a'],
  [T.BRICK]: ['#763b36', '#5a2a28', '#8e4c44'],
  [T.PLAZA]: ['#bdb6a8', '#7e766a', '#d8d2c6'],
  [T.DIRT]: ['#eaa56c', '#c98550', '#f4c08e'],
  [T.ICE]: ['#b4e2f6', '#8ccbe8', '#e8faff'],
  [T.WATER]: ['#4a9ad8', '#3a80c2', '#7cc0f0'],
  [T.DEEP]: ['#3a7ac2', '#2e64a8', '#4e90d4'],
  [T.CAVEWALL]: ['#52607c', '#3a4560', '#6c7a96'],
  [T.DUNGEONWALL]: ['#52607c', '#3a4560', '#6c7a96'],
};
const PRIO = {
  [T.DEEP]: 0, [T.WATER]: 1, [T.LAVA]: 2, [T.ICE]: 3, [T.SAND]: 3, [T.ASH]: 3, [T.SNOW]: 4, [T.DIRT]: 4,
  [T.CAVE]: 5, [T.BRICK]: 5, [T.PATH]: 6, [T.PLAZA]: 6, [T.GRASS]: 7, [T.FOREST]: 8, [T.CAVEWALL]: 9, [T.DUNGEONWALL]: 9,
};
const WATERY = new Set([T.WATER, T.DEEP]);
export const isWall = (t) => t === T.CAVEWALL || t === T.DUNGEONWALL;

const base = new Map();

function baseTile(t, v) {
  const k = t * 8 + v;
  if (base.has(k)) return base.get(k);
  const [c, d, l] = PAL[t];
  const P = new Pix(16, 16);
  const R = rng(t * 131 + v * 17 + 7);
  P.rect(0, 0, 16, 16, c);
  const speck = (n, col) => { for (let i = 0; i < n; i++) P.set(Math.floor(R() * 16), Math.floor(R() * 16), col); };
  switch (t) {
    case T.GRASS:
    case T.FOREST:
      speck(18, d);
      for (let i = 0; i < 6; i++) { const x = Math.floor(R() * 15), y = 2 + Math.floor(R() * 13); P.set(x, y, l); P.set(x + 1, y - 1, l); P.set(x, y + 1, d); }
      if (v === 3 && t === T.GRASS) { const x = 3 + Math.floor(R() * 10), y = 3 + Math.floor(R() * 10); P.set(x, y, '#ffe070'); P.set(x + 1, y, '#fff6c0'); }
      break;
    case T.PATH:
    case T.PLAZA: {
      // calçamento de pedras irregulares
      P.rect(0, 0, 16, 16, d);
      const sz = t === T.PLAZA ? 8 : 5;
      for (let y = 0; y < 16; y += sz) {
        const off = (y / sz) % 2 ? Math.floor(sz / 2) : 0;
        for (let x = -off; x < 16; x += sz) {
          const cc = R() < 0.3 ? shade(c, -0.07) : R() < 0.3 ? shade(c, 0.06) : c;
          P.rect(x + 1, y + 1, sz - 1, sz - 1, cc);
          P.rect(x + 1, y + 1, sz - 1, 1, l);
          P.set(x + sz - 1, y + sz - 1, shade(cc, -0.2));
        }
      }
      break;
    }
    case T.SAND:
      for (let i = 0; i < 3; i++) { const y = 2 + Math.floor(R() * 12), x = Math.floor(R() * 8); for (let j = 0; j < 6; j++) P.set(x + j, y + (j > 2 ? 1 : 0), d); }
      speck(6, l);
      break;
    case T.SNOW: speck(10, d); speck(4, l); break;
    case T.ICE:
      speck(4, l);
      P.line(2 + v, 3, 7, 8, l); P.line(7, 8, 12, 6 + v, d);
      break;
    case T.CAVE: speck(20, d); speck(8, l); break;
    case T.ASH: speck(20, d); speck(6, l); if (v % 2) { P.set(4 + v, 9, '#ff7a2a'); } break;
    case T.LAVA:
      speck(16, d);
      for (let i = 0; i < 4; i++) { const x = Math.floor(R() * 13), y = Math.floor(R() * 14); P.rect(x, y, 3, 1, l); P.set(x + 1, y + 1, '#fff2a0'); }
      break;
    case T.BRICK:
      P.rect(0, 0, 16, 16, d);
      for (let y = 0; y < 16; y += 4) {
        const off = (y / 4) % 2 ? 4 : 0;
        for (let x = -off; x < 16; x += 8) { P.rect(x + 1, y + 1, 7, 3, R() < 0.25 ? shade(c, -0.08) : c); P.rect(x + 1, y + 1, 7, 1, l); }
      }
      break;
    case T.DIRT: speck(22, d); speck(8, l); for (let i = 0; i < 2; i++) P.set(Math.floor(R() * 16), Math.floor(R() * 16), '#6a5030'); break;
    case T.WATER:
    case T.DEEP:
      for (let i = 0; i < 3; i++) { const y = 2 + Math.floor(R() * 12), x = Math.floor(R() * 10); P.rect(x, y, 4, 1, t === T.WATER ? l : c); P.rect(x + 1, y + 1, 3, 1, d); }
      break;
    case T.CAVEWALL:
    case T.DUNGEONWALL:
      speck(14, d);
      break;
  }
  const cv = P.toCanvas();
  base.set(k, cv);
  return cv;
}

const GRASSY = new Set([T.GRASS, T.FOREST]);

// Escolhe um tile da arte Kenney (CC0) para o terreno, quando existir um equivalente.
// Retorna [folha, índice, tintura?] ou null para usar o tile procedural.
function kenneyTile(t, x, y, get, v) {
  if (!hasSheet('town')) return null;
  switch (t) {
    case T.GRASS: return ['town', v % 29 === 0 ? 2 : v % 6 === 0 ? 1 : 0];
    case T.FOREST: return ['town', v % 4 === 0 ? 1 : 0, 'rgba(10,50,20,0.09)'];
    case T.PATH: {
      // autotile da trilha de terra: bordas de grama só onde o vizinho é grama
      const g = (dx, dy) => GRASSY.has(get(x + dx, y + dy));
      const n = g(0, -1), s = g(0, 1), w = g(-1, 0), e = g(1, 0);
      const row = n && !s ? 0 : s && !n ? 2 : 1;
      const col = w && !e ? 0 : e && !w ? 2 : 1;
      return ['town', [12, 24, 36][row] + col];
    }
    case T.DIRT: return ['town', [40, 41, 40, 39][v % 4]];
    case T.BRICK: return hasSheet('dungeon') ? ['dungeon', v % 9 === 0 ? 12 : v % 13 === 0 ? 24 : 0] : null;
    case T.DUNGEONWALL: return hasSheet('dungeon') ? ['dungeon', v % 3 === 0 ? 58 : 57] : null;
    case T.CAVEWALL: return hasSheet('dungeon') ? ['dungeon', 40, 'rgba(40,30,50,0.25)'] : null;
    default: return null;
  }
}

// Desenha um bloco (chunk) de tiles em um canvas 2D. "get(x,y)" devolve o tipo do tile.
export function drawChunk(ctx, get, cx0, cy0, size) {
  for (let ty = 0; ty < size; ty++) {
    for (let tx = 0; tx < size; tx++) {
      const x = cx0 + tx, y = cy0 + ty;
      const t = get(x, y);
      const v = ((x * 73856093) ^ (y * 19349663)) >>> 0;
      const px = tx * 16, py = ty * 16;
      const kt = kenneyTile(t, x, y, get, v);
      if (kt) {
        if (kt[0] === 'town' && t !== T.GRASS && t !== T.FOREST && t !== T.PATH && t !== T.DIRT) ctx.drawImage(baseTile(t, v % 4), px, py);
        drawTile(ctx, kt[0], kt[1], px, py);
        if (kt[2]) { ctx.fillStyle = kt[2]; ctx.fillRect(px, py, 16, 16); }
      } else ctx.drawImage(baseTile(t, v % 4), px, py);
      // transições: vizinhos de prioridade maior "invadem" a borda com pontilhado
      const nb = [[0, -1], [1, 0], [0, 1], [-1, 0]];
      for (let s = 0; s < 4; s++) {
        const n = get(x + nb[s][0], y + nb[s][1]);
        if (n === t || isWall(n) || isWall(t)) continue;
        if (t === T.PATH && GRASSY.has(n)) continue; // o autotile já desenha essa borda
        if (t === T.FOREST && n === T.GRASS) continue;
        if (PRIO[n] <= PRIO[t]) continue;
        const [nc, nd] = PAL[n];
        ctx.fillStyle = nc;
        for (let i = 0; i < 16; i++) {
          const depth = 1 + ((i * 7 + v) % 3 === 0 ? 1 : 0) + ((i * 13 + v) % 5 === 0 ? 1 : 0);
          for (let dpt = 0; dpt < depth; dpt++) {
            const [ex, ey] = s === 0 ? [i, dpt] : s === 1 ? [15 - dpt, i] : s === 2 ? [i, 15 - dpt] : [dpt, i];
            ctx.fillStyle = dpt === depth - 1 ? nd : nc;
            ctx.fillRect(px + ex, py + ey, 1, 1);
          }
        }
        if (WATERY.has(t)) {
          // espuma na beira d'água
          ctx.fillStyle = 'rgba(220,240,255,0.75)';
          for (let i = 0; i < 16; i += 2) {
            const [ex, ey] = s === 0 ? [i, 3] : s === 1 ? [12, i] : s === 2 ? [i, 12] : [3, i];
            ctx.fillRect(px + ex, py + ey, 1, 1);
          }
        }
      }
      // paredes com face frontal (pseudo-3D)
      if (isWall(t) && kt) {
        if (!isWall(get(x, y + 1))) { ctx.fillStyle = 'rgba(10,6,20,0.45)'; ctx.fillRect(px, py + 12, 16, 4); }
      } else if (isWall(t)) {
        const below = get(x, y + 1);
        const [c, d, l] = PAL[t];
        if (!isWall(below)) {
          ctx.fillStyle = d; ctx.fillRect(px, py + 8, 16, 8);
          ctx.fillStyle = shade(d, -0.25); ctx.fillRect(px, py + 15, 16, 1);
          ctx.fillStyle = shade(d, 0.15);
          if (t === T.DUNGEONWALL) for (let i = 0; i < 16; i += 4) ctx.fillRect(px + i + ((y % 2) * 2), py + 9, 1, 6);
          else for (let i = 0; i < 4; i++) ctx.fillRect(px + ((v >> i) % 14), py + 10 + i, 2, 1);
        }
        if (!isWall(get(x, y - 1))) { ctx.fillStyle = l; ctx.fillRect(px, py, 16, 1); }
        if (!isWall(get(x - 1, y))) { ctx.fillStyle = shade(c, 0.12); ctx.fillRect(px, py, 1, 16); }
        if (!isWall(get(x + 1, y))) { ctx.fillStyle = shade(d, -0.2); ctx.fillRect(px + 15, py, 1, 16); }
      }
    }
  }
}
