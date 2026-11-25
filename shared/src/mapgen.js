// Geração determinística do mundo. Cliente e servidor chamam generateWorld(seed)
// e obtêm exatamente o mesmo mapa, então o mapa nunca precisa trafegar pela rede.
import { MAP_W, MAP_H, WORLD_SEED } from './constants.js';
import { fbm, hash2 } from './rng.js';
import { REGIONS, T, BLOCKING_TILES } from './regions.js';
import { NPCS } from './npcs.js';

export const CX = 128, CY = 128;
export const TOWN = { x0: 108, y0: 106, x1: 148, y1: 150 };
export const RADIAL_ANGLES = [0, 60, 120, 180, 240, 300];
const SECTORS = [
  // [inicio, fim) em graus (0 = leste, sentido horário pois y cresce para baixo)
  [330, 390, 'goblin'], [30, 90, 'desert'], [90, 150, 'volcano'],
  [150, 210, 'cave'], [210, 270, 'frozen'], [270, 330, 'dungeon'],
];

export const BUILDINGS = [
  { id: 'temple', name: 'Templo', x: 125, y: 109, w: 7, h: 6, style: 'temple' },
  { id: 'store', name: 'Loja Geral', x: 137, y: 119, w: 6, h: 5, style: 'store' },
  { id: 'smith', name: 'Ferreiro', x: 137, y: 131, w: 7, h: 5, style: 'smith' },
  { id: 'bank', name: 'Banco', x: 112, y: 119, w: 7, h: 5, style: 'bank' },
  { id: 'arcane', name: 'Arco & Arcano', x: 112, y: 131, w: 7, h: 5, style: 'arcane' },
];

export const CHESTS = [
  { id: 'c_forest', x: 0, y: 0, angle: 200, r: 38, reward: { gold: 150, item: 'hp_potion_m', q: 5 } },
  { id: 'c_goblin', angle: 15, r: 78, reward: { gold: 400, item: 'ring_power', q: 1 } },
  { id: 'c_desert', angle: 75, r: 96, reward: { gold: 800, item: 'boots_leather', q: 1, rarity: 2 } },
  { id: 'c_cave', angle: 165, r: 88, reward: { gold: 700, item: 'staff_bone', q: 1, rarity: 2 } },
  { id: 'c_frozen', angle: 225, r: 100, reward: { gold: 1500, item: 'ring_frost', q: 1 } },
  { id: 'c_volcano', angle: 135, r: 100, reward: { gold: 2500, item: 'sword_flame', q: 1, rarity: 3 } },
];

export const BOSS_SPOT = { angle: 300, r: 100 };

function polar(angle, r) {
  const a = (angle * Math.PI) / 180;
  return { x: Math.round(CX + Math.cos(a) * r), y: Math.round(CY + Math.sin(a) * r) };
}

export function generateWorld(seed = WORLD_SEED) {
  const W = MAP_W, H = MAP_H, N = W * H;
  const tiles = new Uint8Array(N);
  const region = new Uint8Array(N);
  const blocked = new Uint8Array(N); // 1 = bloqueado p/ todos, 2 = só monstros
  const safe = new Uint8Array(N);
  const occupied = new Uint8Array(N); // objetos decorativos/colisão
  const objects = [];
  const idx = (x, y) => y * W + x;
  const inTown = (x, y) => x >= TOWN.x0 && x <= TOWN.x1 && y >= TOWN.y0 && y <= TOWN.y1;

  // 1) Regiões e terreno base
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      const dx = x - CX, dy = y - CY;
      const d = Math.hypot(dx, dy);
      const n = fbm(x * 0.045, y * 0.045, seed, 4);
      const coast = 114 + (n - 0.5) * 26;
      if (d > coast) {
        tiles[i] = d > coast + 5 ? T.DEEP : T.WATER;
        region[i] = 0;
        continue;
      }
      let key;
      if (inTown(x, y)) key = 'town';
      else if (d + (n - 0.5) * 16 < 47) key = 'forest';
      else {
        let ang = (Math.atan2(dy, dx) * 180) / Math.PI;
        ang += (fbm(x * 0.03, y * 0.03, seed + 77, 3) - 0.5) * 26;
        ang = ((ang % 360) + 360) % 360;
        if (ang < 30) ang += 360;
        key = 'goblin';
        for (const [a0, a1, k] of SECTORS) if (ang >= a0 && ang < a1) key = k;
      }
      const reg = REGIONS.find((r) => r.key === key);
      region[i] = reg.id;
      const m = fbm(x * 0.09, y * 0.09, seed + 13, 3);
      const m2 = fbm(x * 0.14, y * 0.14, seed + 29, 3);
      let t = T.GRASS;
      switch (key) {
        case 'town': t = T.GRASS; break;
        case 'forest': t = m > 0.56 ? T.FOREST : T.GRASS; if (m2 > 0.74 && d > 26) t = T.WATER; break;
        case 'goblin': t = m > 0.55 ? T.DIRT : T.GRASS; break;
        case 'desert': t = T.SAND; if (m2 > 0.79) t = T.WATER; break;
        case 'volcano': t = T.ASH; if (Math.abs(m2 - 0.5) < 0.025 || m > 0.72) t = T.LAVA; break;
        case 'cave': t = T.CAVE; if (fbm(x * 0.13, y * 0.13, seed + 41, 3) > 0.6) t = T.CAVEWALL; break;
        case 'frozen': t = m > 0.6 ? T.ICE : T.SNOW; if (m2 > 0.8) t = T.WATER; break;
        case 'dungeon': {
          t = T.BRICK;
          const gx = x % 13, gy = y % 13;
          const wallLine = gx === 0 || gy === 0;
          const door = (gx >= 5 && gx <= 7) || (gy >= 5 && gy <= 7);
          if (wallLine && !door) t = T.DUNGEONWALL;
          break;
        }
      }
      tiles[i] = t;
    }
  }

  // Muralha externa da masmorra (aberturas só onde passa a estrada)
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = idx(x, y);
      if (region[i] !== 8) continue;
      const nb = [region[i - 1], region[i + 1], region[i - W], region[i + W]];
      if (nb.some((r) => r !== 8 && r !== 0)) tiles[i] = T.DUNGEONWALL;
    }
  }

  // 2) Estradas radiais a partir da vila
  const roadSet = new Uint8Array(N);
  for (const ang of RADIAL_ANGLES) {
    const a = (ang * Math.PI) / 180;
    const px = -Math.sin(a), py = Math.cos(a);
    for (let r = 8; r < 108; r += 0.4) {
      const wig = r < 26 ? 0 : Math.sin(r * 0.11 + ang) * 2.2 * Math.min(1, (r - 26) / 10);
      const fx = CX + Math.cos(a) * r + px * wig;
      const fy = CY + Math.sin(a) * r + py * wig;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const x = Math.round(fx + ox), y = Math.round(fy + oy);
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const i = idx(x, y);
        if (tiles[i] === T.DEEP) continue;
        if (region[i] === 0) { tiles[i] = T.PATH; region[i] = 2; }
        tiles[i] = T.PATH;
        roadSet[i] = 1;
      }
    }
  }

  // 3) Vila: praça, construções, cerca
  for (let y = 120; y <= 136; y++) for (let x = 120; x <= 136; x++) tiles[idx(x, y)] = T.PLAZA;
  for (let y = TOWN.y0; y <= TOWN.y1; y++) for (let x = TOWN.x0; x <= TOWN.x1; x++) {
    safe[idx(x, y)] = 1;
    if (blocked[idx(x, y)] === 0) blocked[idx(x, y)] = 2;
  }
  const place = (o, x0, y0, w, h, solid = true) => {
    objects.push(o);
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const i = idx(x, y);
      occupied[i] = 1;
      if (solid) blocked[i] = 1;
    }
  };
  for (const b of BUILDINGS) place({ t: 'building', x: b.x, y: b.y, w: b.w, h: b.h, s: b.style, name: b.name }, b.x, b.y, b.w, b.h);
  place({ t: 'fountain', x: 127, y: 127, w: 3, h: 3 }, 127, 127, 3, 3);
  place({ t: 'board', x: 127, y: 140, w: 2, h: 1 }, 127, 140, 2, 1);
  // cerca no contorno da vila
  for (let x = TOWN.x0; x <= TOWN.x1; x++) for (const y of [TOWN.y0, TOWN.y1]) {
    const i = idx(x, y);
    if (!roadSet[i] && tiles[i] !== T.WATER && tiles[i] !== T.DEEP) place({ t: 'fence', x, y, h: 0 }, x, y, 1, 1);
  }
  for (let y = TOWN.y0 + 1; y < TOWN.y1; y++) for (const x of [TOWN.x0, TOWN.x1]) {
    const i = idx(x, y);
    if (!roadSet[i] && tiles[i] !== T.WATER && tiles[i] !== T.DEEP) place({ t: 'fence', x, y, h: 1 }, x, y, 1, 1);
  }
  // lampiões e bancos decorativos
  for (const [x, y] of [[121, 121], [135, 121], [121, 135], [135, 135]]) place({ t: 'lamp', x, y }, x, y, 1, 1);
  // decoração da vila (poço, barris, bigorna, colmeia, caixotes)
  for (const [t, x, y] of [['well', 131, 140], ['barrel', 143, 124], ['barrel', 144, 124], ['anvil', 144, 136], ['beehive', 111, 136], ['crate', 111, 123], ['crate', 111, 124], ['sign', 125, 140]]) {
    if (!roadSet[idx(x, y)] && !occupied[idx(x, y)]) place({ t, x, y }, x, y, 1, 1);
  }

  // NPCs: área livre ao redor e zona segura para os postos avançados
  for (const npc of NPCS) {
    const nx = Math.floor(npc.x), ny = Math.floor(npc.y);
    for (let y = ny - 5; y <= ny + 5; y++) for (let x = nx - 5; x <= nx + 5; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = idx(x, y);
      const dd = Math.hypot(x - nx, y - ny);
      if (dd <= 3.2 && BLOCKING_TILES.has(tiles[i])) tiles[i] = region[i] === 8 ? T.BRICK : T.PATH;
      if (dd <= 5) { safe[i] = 1; if (blocked[i] === 0) blocked[i] = 2; }
      if (dd <= 1.5) occupied[i] = 1;
    }
    if (npc.outpost) place({ t: 'campfire', x: nx + 2, y: ny }, nx + 2, ny, 1, 1);
  }

  // Sala do chefe (Dragão)
  const boss = polar(BOSS_SPOT.angle, BOSS_SPOT.r);
  for (let y = boss.y - 5; y <= boss.y + 5; y++) for (let x = boss.x - 5; x <= boss.x + 5; x++) {
    const i = idx(x, y);
    if (region[i] === 8 || tiles[i] === T.DUNGEONWALL) { tiles[i] = T.BRICK; region[i] = 8; }
  }

  // Baús secretos
  const chests = CHESTS.map((c) => {
    const p = polar(c.angle, c.r);
    for (let y = p.y - 1; y <= p.y + 1; y++) for (let x = p.x - 1; x <= p.x + 1; x++) {
      const i = idx(x, y);
      if (BLOCKING_TILES.has(tiles[i])) tiles[i] = region[i] === 8 ? T.BRICK : region[i] === 6 ? T.CAVE : T.GRASS;
      occupied[i] = 1;
    }
    place({ t: 'chest', x: p.x, y: p.y, id: c.id }, p.x, p.y, 1, 1);
    return { ...c, x: p.x, y: p.y };
  });

  // 4) Decoração/objetos por região
  for (let y = 2; y < H - 2; y++) {
    for (let x = 2; x < W - 2; x++) {
      const i = idx(x, y);
      if (occupied[i] || roadSet[i] || BLOCKING_TILES.has(tiles[i])) continue;
      const r = region[i];
      const t = tiles[i];
      const h = hash2(x, y, seed + 5);
      const v = Math.floor(hash2(x, y, seed + 9) * 4);
      let obj = null, solid = true;
      if (r === 1) {
        if (tiles[i] === T.GRASS && h > 0.985 && (x < 120 || x > 136 || y < 120 || y > 136)) obj = 'tree';
        else if (h > 0.94 && t === T.GRASS) { obj = 'flower'; solid = false; }
      } else if (r === 2) {
        if ((t === T.FOREST && h > 0.8) || (t === T.GRASS && h > 0.95)) obj = 'tree';
        else if (h > 0.93) { obj = 'bush'; solid = false; }
        else if (h > 0.9) { obj = 'flower'; solid = false; }
        else if (h > 0.895) obj = 'rock';
      } else if (r === 3) {
        if (h > 0.985) obj = 'autumn';
        else if (h > 0.975) obj = 'tent';
        else if (h > 0.968) obj = 'crate';
        else if (h > 0.955) obj = 'rock';
        else if (h > 0.92) { obj = 'bush'; solid = false; }
      } else if (r === 4) {
        if (h > 0.975) obj = 'cactus';
        else if (h > 0.962) obj = 'rock';
        else if (h > 0.95) { obj = 'bones'; solid = false; }
      } else if (r === 5) {
        if (h > 0.97) obj = 'deadtree';
        else if (h > 0.95) obj = 'lavarock';
        else if (h > 0.94) { obj = 'ember'; solid = false; }
      } else if (r === 6) {
        if (h > 0.96) obj = 'stalagmite';
        else if (h > 0.952) obj = 'grave';
        else if (h > 0.94) { obj = 'bones'; solid = false; }
        else if (h > 0.93) { obj = 'mushroom'; solid = false; }
      } else if (r === 7) {
        if (h > 0.93) obj = 'pine';
        else if (h > 0.915) obj = 'icerock';
      } else if (r === 8) {
        if (h > 0.97) { obj = 'torch'; solid = false; }
        else if (h > 0.955) { obj = 'bones'; solid = false; }
        else if (h > 0.948) obj = 'pillar';
        else if (h > 0.944) obj = 'barrel';
      }
      if (!obj) continue;
      if (obj === 'tent') {
        if (occupied[i + 1] || occupied[i + W] || occupied[i + W + 1] || roadSet[i + 1] || roadSet[i + W]) continue;
        place({ t: obj, x, y, v }, x, y, 2, 2);
        continue;
      }
      // espaçamento mínimo de árvores
      if (solid && (occupied[i - 1] || occupied[i - W] || occupied[i - W - 1] || occupied[i - W + 1])) continue;
      place({ t: obj, x, y, v }, x, y, 1, 1, solid);
    }
  }

  // tiles bloqueantes entram na grade de colisão
  for (let i = 0; i < N; i++) if (BLOCKING_TILES.has(tiles[i])) blocked[i] = 1;

  // 5) Pontos de spawn de monstros
  const spawners = [];
  const step = 6;
  for (let gy = 4; gy < H - 4; gy += step) {
    for (let gx = 4; gx < W - 4; gx += step) {
      const x = gx + Math.floor(hash2(gx, gy, seed + 3) * step);
      const y = gy + Math.floor(hash2(gx, gy, seed + 4) * step);
      const i = idx(x, y);
      const reg = REGIONS[region[i]];
      if (!reg || !reg.monsters.length || blocked[i] || safe[i] || roadSet[i]) continue;
      if (hash2(x, y, seed + 6) > 0.72) continue;
      const tot = reg.monsters.reduce((s, m) => s + m[1], 0);
      let pick = hash2(x, y, seed + 7) * tot;
      let key = reg.monsters[0][0];
      for (const [mk, w] of reg.monsters) { if ((pick -= w) < 0) { key = mk; break; } }
      spawners.push({ x: x + 0.5, y: y + 0.5, monster: key });
    }
  }
  spawners.push({ x: boss.x + 0.5, y: boss.y + 0.5, monster: 'dragon', boss: true });

  const world = { W, H, seed, tiles, region, blocked, safe, objects, spawners, chests, roads: roadSet, boss };
  world.idx = idx;
  return world;
}

// Consultas utilitárias sobre o mundo gerado
export function tileAt(world, x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  if (xi < 0 || yi < 0 || xi >= world.W || yi >= world.H) return T.DEEP;
  return world.tiles[yi * world.W + xi];
}
export function regionAt(world, x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  if (xi < 0 || yi < 0 || xi >= world.W || yi >= world.H) return REGIONS[0];
  return REGIONS[world.region[yi * world.W + xi]];
}
export function isSafe(world, x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  if (xi < 0 || yi < 0 || xi >= world.W || yi >= world.H) return true;
  return world.safe[yi * world.W + xi] === 1;
}
export function isBlocked(world, x, y, forMonster = false) {
  const xi = Math.floor(x), yi = Math.floor(y);
  if (xi < 0 || yi < 0 || xi >= world.W || yi >= world.H) return true;
  const b = world.blocked[yi * world.W + xi];
  return b === 1 || (forMonster && b === 2);
}
