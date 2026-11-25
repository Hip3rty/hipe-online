// Ícones 16x16 de itens (inventário, loja, loot no chão), gerados a partir do catálogo.
import { Pix, shade } from '../pixel.js';
import { ITEMS } from '@hipe/shared/items.js';
import { tileCanvas } from '../assets.js';

const cache = new Map();

// ícones que vêm da arte Kenney (CC0)
const KICON = { hp_potion_s: ['dungeon', 127], hp_potion_m: ['dungeon', 115], hp_potion_l: ['dungeon', 115], mp_potion_s: ['dungeon', 128], mp_potion_m: ['dungeon', 116], mp_potion_l: ['dungeon', 116] };

export function itemIcon(k) {
  let c = cache.get(k);
  if (c) return c;
  if (KICON[k]) {
    const t = tileCanvas(KICON[k][0], KICON[k][1]);
    if (t) {
      c = document.createElement('canvas');
      c.width = c.height = 16;
      const ctx = c.getContext('2d');
      ctx.drawImage(t, 0, 0);
      if (k.endsWith('_l')) { ctx.fillStyle = '#ffe070'; ctx.fillRect(12, 1, 3, 3); ctx.fillStyle = '#1a1020'; ctx.fillRect(13, 2, 1, 1); } // marca "G"
      cache.set(k, c);
      return c;
    }
  }
  const def = ITEMS[k];
  const P = new Pix(16, 16);
  if (def) draw(P, def);
  P.outline('#140c1c');
  c = P.toCanvas();
  cache.set(k, c);
  return c;
}

export function itemIconURL(k) {
  const key = 'url:' + k;
  let u = cache.get(key);
  if (!u) { u = itemIcon(k).toDataURL(); cache.set(key, u); }
  return u;
}

function draw(P, d) {
  const c = d.color || '#cccccc', L = shade(c, 0.45), D = shade(c, -0.35);
  switch (d.cat) {
    case 'sword':
      P.line(4, 11, 12, 3, c); P.line(5, 11, 13, 3, D); P.line(4, 10, 12, 2, L);
      P.set(13, 2, L); P.line(2, 9, 6, 13, '#e0b040'); P.line(3, 12, 1, 14, '#6a4020'); P.set(1, 14, '#e0b040');
      if (d.key === 'sword_flame') { P.set(9, 4, '#ffe070'); P.set(11, 3, '#ff7a2a'); P.set(7, 7, '#ffe070'); }
      break;
    case 'bow':
      for (let i = 0; i < 13; i++) { const x = 4 + Math.round(Math.sin((i / 12) * Math.PI) * 6); P.set(x, i + 1, i % 4 === 0 ? D : c); P.set(x + 1, i + 1, D); }
      P.line(4, 1, 4, 13, '#f0f0f0'); P.line(5, 7, 13, 7, '#c8a070'); P.set(14, 7, '#e8e8e8'); P.set(13, 6, '#e8e8e8'); P.set(13, 8, '#e8e8e8');
      break;
    case 'staff':
      P.line(3, 14, 10, 6, '#7a4a2a'); P.line(4, 14, 11, 6, '#5a321a');
      P.ball(11.5, 4.5, 3, 3, c); P.set(10, 3, '#ffffff');
      if (d.key === 'staff_bone') { P.ball(11.5, 4.5, 3, 3, '#e8e2cf'); P.set(10, 4, '#1a1020'); P.set(12, 4, '#1a1020'); }
      break;
    case 'shield':
      for (let y = 2; y < 14; y++) { const w = y < 9 ? 5 : 5 - (y - 8); P.rect(8 - w, y, w * 2, 1, y === 2 ? L : c); P.set(8 + w - 1, y, D); }
      P.rect(7, 4, 2, 7, '#ffe070'); P.rect(5, 6, 6, 2, '#ffe070');
      break;
    case 'helmet':
      P.ball(8, 8, 6, 5, c); P.rect(2, 9, 12, 4, c); P.rect(4, 9, 8, 2, '#1a1020'); P.rect(2, 12, 12, 1, D); P.set(5, 5, L);
      if (d.key === 'helmet_leather') { P.ball(8, 8, 6, 5, '#8a5a32'); P.rect(4, 9, 8, 3, '#f0c8a0'); }
      break;
    case 'armor':
      P.rect(3, 3, 10, 11, c); P.rect(1, 3, 3, 4, c); P.rect(12, 3, 3, 4, c);
      P.rect(6, 3, 4, 2, '#1a1020'); P.rect(3, 8, 10, 1, D); P.rect(4, 4, 1, 4, L); P.rect(3, 13, 10, 1, D);
      if (d.key === 'armor_leather') { P.rect(3, 3, 10, 11, '#9a6a3a'); P.rect(1, 3, 3, 4, '#9a6a3a'); P.rect(12, 3, 3, 4, '#9a6a3a'); P.rect(6, 3, 4, 2, '#1a1020'); P.rect(3, 9, 10, 1, '#5a3a1a'); }
      break;
    case 'boots':
      P.rect(3, 4, 4, 8, c); P.rect(3, 11, 6, 3, c); P.rect(9, 3, 4, 8, D); P.rect(9, 10, 6, 3, D); P.rect(3, 4, 4, 1, L); P.rect(3, 13, 6, 1, shade(c, -0.5));
      break;
    case 'ring':
      P.ellipse(8, 9, 5, 4.5, '#e0b040'); P.ellipse(8, 9.5, 3, 2.5, null);
      for (let y = 7; y < 12; y++) for (let x = 6; x < 11; x++) if (Math.hypot(x - 8, (y - 9.5) * 1.1) < 2.6) P.p[y * 16 + x] = null;
      P.ball(8, 4.5, 2.5, 2.2, c); P.set(7, 3, '#ffffff');
      break;
    case 'potion':
      P.rect(6, 1, 4, 2, '#8a5a32'); P.rect(7, 3, 2, 2, '#c8e0f0');
      P.ball(8, 10, 5, 5, c); P.rect(4, 7, 8, 1, '#c8e0f0'); P.set(6, 8, '#ffffff'); P.set(5, 9, '#ffffff');
      if (d.key.endsWith('_l')) P.rect(5, 12, 6, 1, shade(c, 0.3));
      break;
    case 'gold':
      P.ball(6, 10, 4, 3.5, '#e0a020'); P.ball(10, 8, 4, 3.5, '#ffd23a'); P.set(9, 7, '#fff6c0'); P.rect(9, 8, 2, 1, '#b07a10');
      break;
    case 'material':
      material(P, d);
      break;
  }
}

function material(P, d) {
  const c = d.color, L = shade(c, 0.4), D = shade(c, -0.35);
  switch (d.key) {
    case 'slime_gel': P.ball(8, 10, 5, 4, c); P.set(6, 8, '#ffffff'); break;
    case 'wolf_pelt': case 'yeti_fur': P.rect(3, 4, 10, 9, c); P.rect(2, 6, 12, 5, c); for (let i = 3; i < 13; i += 2) P.set(i, 12, D); P.rect(4, 5, 3, 1, L); break;
    case 'spider_silk': P.ball(8, 8, 5, 5, c); P.line(4, 6, 12, 10, D); P.line(4, 10, 12, 6, D); break;
    case 'goblin_ear': P.line(4, 12, 12, 3, c); P.line(5, 12, 12, 5, c); P.line(4, 11, 7, 12, D); P.set(11, 4, L); break;
    case 'orc_tusk': case 'ice_fang': case 'imp_horn': P.line(5, 13, 10, 3, c); P.line(6, 13, 11, 4, c); P.line(7, 13, 11, 6, D); P.set(10, 3, L); break;
    case 'bone': P.line(4, 11, 11, 4, c); P.ball(4, 12, 2, 2, c); P.ball(12, 4, 2, 2, c); break;
    case 'rotten_flesh': P.ball(8, 9, 5, 4, c); P.set(6, 8, '#4a5a2a'); P.set(10, 10, '#4a5a2a'); break;
    case 'scorpion_stinger': P.line(4, 13, 9, 6, c); P.line(9, 6, 12, 3, '#ffe070'); break;
    case 'linen_wrap': for (let i = 0; i < 4; i++) P.rect(3, 3 + i * 3, 10, 2, i % 2 ? D : c); break;
    case 'demon_heart': P.ball(6, 7, 3, 3, c); P.ball(10, 7, 3, 3, c); for (let y = 8; y < 14; y++) P.rect(3 + (y - 8), y, 10 - (y - 8) * 2, 1, c); P.set(5, 6, L); break;
    case 'dark_steel': P.rect(2, 7, 12, 5, c); P.rect(4, 5, 8, 2, L); P.rect(2, 11, 12, 1, D); break;
    case 'dragon_scale': for (let y = 3; y < 14; y++) { const w = Math.min(y - 2, 14 - y, 5); P.rect(8 - w, y, w * 2, 1, y % 3 ? c : D); } P.set(7, 5, L); break;
    default: P.ball(8, 8, 5, 5, c);
  }
}
