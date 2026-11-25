// Gerador de humanoides em pixel art: jogadores, NPCs e monstros humanoides
// (goblin, orc, esqueleto, zumbi, múmia, yeti, diabrete, demônio...).
import { Pix, shade, rng } from '../pixel.js';
import { LOOKS } from '@hipe/shared/rules.js';
import { ITEMS } from '@hipe/shared/items.js';

export const HW = 24, HH = 26; // tamanho do quadro
const OX = 4, OY = 3; // deslocamento da figura 16x20 dentro do quadro
export const H_FOOT_Y = OY + 20; // linha dos pés

const cache = new Map();

// Converte aparência de jogador + equipamentos em opções de desenho
export function playerOpts(look = {}, eq = {}) {
  const skin = LOOKS.skin[look.skin || 0] || LOOKS.skin[0];
  const o = {
    skin: skin[0], skinD: skin[1],
    hairStyle: look.hair || 0, hair: LOOKS.hairColor[look.hairColor || 0],
    shirt: LOOKS.cloth[look.shirt ?? 0], pants: LOOKS.cloth[look.pants ?? 5],
    beard: !!look.beard,
  };
  if (eq.armor) o.armor = ITEMS[eq.armor]?.color;
  if (eq.helmet) o.helmet = ITEMS[eq.helmet]?.color;
  if (eq.boots) o.boots = ITEMS[eq.boots]?.color;
  if (eq.shield) o.shield = ITEMS[eq.shield]?.color;
  if (eq.helmet === 'helmet_leather') o.hood = '#8a5a32';
  return o;
}

export function monsterOpts(art) {
  return {
    skin: art.skin, skinD: shade(art.skin, -0.25), hairStyle: -1, hair: art.hood || shade(art.skin, -0.3),
    shirt: art.shirt, pants: art.pants, ...art,
  };
}

function key(o) {
  return JSON.stringify(o);
}

export function humanoidFrame(o, dir, pose, frame) {
  const k = key(o) + `|${dir}|${pose}|${frame}`;
  let c = cache.get(k);
  if (!c) {
    c = drawHumanoid(o, dir, pose, frame).toCanvas();
    cache.set(k, c);
    if (cache.size > 1500) cache.delete(cache.keys().next().value);
  }
  return c;
}

function drawHumanoid(o, dir, pose, frame) {
  const P = new Pix(HW, HH);
  const s = (x, y, c) => P.set(OX + x, OY + y, c);
  const r = (x, y, w, h, c) => P.rect(OX + x, OY + y, w, h, c);
  const side = dir === 1 || dir === 2; // 2 é espelhado depois
  const up = dir === 3;
  const walk = pose === 'walk';
  const atk = pose === 'attack';
  const bob = walk && (frame === 1 || frame === 3) ? 1 : pose === 'idle' && frame === 1 ? 0 : 0;
  const breathe = pose === 'idle' && frame === 1 ? 1 : 0;

  const skin = o.skin, skinD = o.skinD || shade(o.skin, -0.25);
  const shirt = o.armor || o.shirt;
  const shirtD = shade(shirt, -0.3), shirtL = shade(shirt, 0.25);
  const pants = o.pants, pantsD = shade(pants, -0.3);
  const boot = o.boots || '#4a3020';
  const bone = o.skeleton;
  const R = rng((o.skin?.length || 3) * 977 + frame * 31 + dir * 7);

  // asas (atrás de tudo)
  if (o.wings) {
    const wc = shade(o.skin, -0.35), wl = shade(o.skin, -0.1);
    const flap = frame % 2;
    for (let i = 0; i < 6; i++) {
      const h = 7 - Math.abs(i - 2) - flap;
      for (let j = 0; j < h; j++) {
        P.set(OX - 3 + i - 1, OY + 7 + j - flap, j === 0 ? wl : wc);
        P.set(OX + 16 - i + 2, OY + 7 + j - flap, j === 0 ? wl : wc);
      }
    }
  }
  // cauda
  if (o.tail) {
    const tc = shade(o.skin, -0.2);
    const tx = side ? 13 : 12;
    for (let i = 0; i < 4; i++) s(tx + i, 14 - Math.floor(i / 2) + (frame % 2), tc);
    s(tx + 4, 11 + (frame % 2), '#ffcf3a');
  }

  // ---- pernas ----
  const legY = 15 + bob;
  const legLen = 4;
  let lA = 0, lB = 0; // deslocamento vertical das pernas na caminhada
  if (walk && frame === 1) { lA = 1; lB = -1; }
  if (walk && frame === 3) { lA = -1; lB = 1; }
  const legCol = bone ? o.skin : pants;
  const legColD = bone ? shade(o.skin, -0.3) : pantsD;
  if (!side) {
    r(5, legY - (lA < 0 ? 1 : 0), 2, legLen + lA, legCol); s(6, legY + 1, legColD);
    r(9, legY - (lB < 0 ? 1 : 0), 2, legLen + lB, legCol); s(10, legY + 1, legColD);
    r(5, legY + legLen + lA - 1, 2, 1, boot);
    r(9, legY + legLen + lB - 1, 2, 1, boot);
    if (bone) { s(5, legY + 1, null); }
  } else {
    // vista lateral: passada
    const stride = walk ? (frame === 1 ? 2 : frame === 3 ? -2 : 0) : 0;
    r(6 - stride, legY, 2, legLen, legColD);
    r(8 + stride, legY, 2, legLen, legCol);
    r(5 - stride, legY + legLen - 1, 3, 1, shade(boot, -0.2));
    r(7 + stride, legY + legLen - 1, 3, 1, boot);
  }

  // ---- tronco ----
  const ty = 9 + bob + breathe * 0;
  const tw = o.furry || o.big ? 10 : 8;
  const tx = side ? (o.furry ? 3 : 5) : o.furry ? 3 : 4;
  const tws = side ? (o.furry ? 9 : 6) : tw;
  r(tx, ty, tws, 6, shirt);
  for (let i = 0; i < tws; i++) s(tx + i, ty, shirtL);
  for (let j = 1; j < 6; j++) s(tx + tws - 1, ty + j, shirtD);
  if (bone) {
    // costelas
    for (let j = 1; j < 5; j += 2) for (let i = 1; i < tws - 1; i++) s(tx + i, ty + j, '#2a2030');
    for (let j = 0; j < 6; j++) s(tx + Math.floor(tws / 2), ty + j, o.skin);
    if (o.shirt !== o.skin) r(tx, ty + 3, tws, 3, o.shirt); // manto do mago esqueleto
  } else if (o.armor) {
    s(tx + 1, ty + 1, shade(shirt, 0.45)); s(tx + 1, ty + 2, shade(shirt, 0.45));
    for (let i = 1; i < tws - 1; i++) s(tx + i, ty + 3, shirtD);
  }
  if (o.mummy) for (let j = 0; j < 6; j++) for (let i = 0; i < tws; i++) if ((i + j * 2) % 4 === 0) s(tx + i, ty + j, shade(o.skin, -0.25));
  if (o.zombie) for (let n = 0; n < 4; n++) s(tx + Math.floor(R() * tws), ty + 2 + Math.floor(R() * 4), shade(o.shirt, -0.5));
  if (o.furry) for (let n = 0; n < 8; n++) s(tx + Math.floor(R() * tws), ty + Math.floor(R() * 6), shade(o.skin, -0.12));
  // cinto
  if (!bone && !o.furry && !o.mummy) r(tx, ty + 5, tws, 1, o.armor ? shade(shirt, -0.45) : '#3a2418');
  if (!o.armor && !bone && !o.furry && !o.mummy && !side) s(tx + Math.floor(tws / 2), ty + 5, '#e0b040');

  // ---- braços ----
  let aA = 0, aB = 0;
  if (walk && frame === 1) { aA = 1; aB = -1; }
  if (walk && frame === 3) { aA = -1; aB = 1; }
  if (atk) { aB = frame === 0 ? -3 : frame === 1 ? -1 : 1; }
  const sleeve = bone ? o.skin : shirt;
  const hand = skin;
  if (!side) {
    const lx = tx - 1, rx = tx + tws;
    r(lx, ty + aA, 1, 3, sleeve); r(lx, ty + 3 + aA, 1, 2, hand);
    r(rx, ty + aB, 1, 3, shade(sleeve, -0.15)); r(rx, ty + 3 + aB, 1, 2, hand);
    if (o.big || o.furry) { r(lx - 1, ty + aA, 1, 4, sleeve); r(rx + 1, ty + aB, 1, 4, shade(sleeve, -0.15)); }
    if (o.armor) { s(lx, ty, shade(shirt, 0.3)); s(rx, ty, shade(shirt, 0.3)); }
  } else {
    const swing = walk ? (frame === 1 ? 1 : frame === 3 ? -1 : 0) : atk ? (frame === 0 ? -2 : frame === 1 ? 2 : 1) : 0;
    r(7 + swing, ty + 1, 2, 3, shade(sleeve, -0.1));
    r(7 + swing + (swing > 0 ? 1 : 0), ty + 4, 2, 1, hand);
  }

  // ---- escudo ----
  if (o.shield && !up) {
    const sc = o.shield, sx = side ? 9 : 1, sy = ty + 1;
    r(sx, sy, 3, 5, sc);
    for (let j = 0; j < 5; j++) s(sx, sy + j, shade(sc, 0.3));
    s(sx + 1, sy + 4, shade(sc, -0.3)); s(sx + 2, sy + 4, null);
    s(sx + 1, sy + 2, '#ffe070');
  }

  // ---- cabeça ----
  const hy = 1 + bob;
  const hx = 4;
  const headW = 8;
  if (!up) {
    r(hx, hy, headW, 8, skin);
    for (let j = 0; j < 8; j++) s(hx + headW - 1, hy + j, skinD);
    for (let i = 0; i < headW; i++) s(hx + i, hy + 7, skinD);
  } else {
    r(hx, hy, headW, 8, skin);
  }
  // rosto
  const eye = o.eye || (bone ? '#ff4a3a' : '#20162a');
  if (!up) {
    if (!side) {
      if (bone) {
        r(hx + 1, hy + 3, 2, 2, '#1a1020'); r(hx + 5, hy + 3, 2, 2, '#1a1020');
        s(hx + 2, hy + 4, eye); s(hx + 5, hy + 4, eye);
        for (let i = 1; i < 7; i += 2) s(hx + i, hy + 6, '#2a2030');
      } else {
        r(hx + 2, hy + 4, 1, 2, o.mummy ? '#ffd23a' : eye); r(hx + 5, hy + 4, 1, 2, o.mummy ? '#ffd23a' : eye);
        if (!o.mummy && !o.zombie) { s(hx + 2, hy + 4, '#ffffff'); s(hx + 5, hy + 4, '#ffffff'); }
        if (o.zombie) { s(hx + 2, hy + 4, '#e8f0c0'); }
        s(hx + 3, hy + 6, shade(skin, -0.35)); s(hx + 4, hy + 6, shade(skin, -0.35));
        if (!o.monster && !o.tusks) { s(hx + 1, hy + 5, shade(skin, -0.08)); s(hx + 6, hy + 5, shade(skin, -0.08)); }
      }
      if (o.tusks) { s(hx + 1, hy + 6, '#fff6d8'); s(hx + 6, hy + 6, '#fff6d8'); s(hx + 1, hy + 5, '#fff6d8'); s(hx + 6, hy + 5, '#fff6d8'); }
      if (o.mummy) for (let j = 0; j < 8; j += 2) for (let i = 0; i < headW; i++) if ((i + j) % 3 === 0) s(hx + i, hy + j, shade(skin, -0.2));
    } else {
      r(hx + 1, hy + 4, 1, 2, bone ? eye : o.mummy ? '#ffd23a' : eye);
      if (!bone && !o.mummy) s(hx + 1, hy + 4, '#ffffff');
      s(hx - 1, hy + 5, skin); // nariz
      if (o.tusks) s(hx, hy + 6, '#fff6d8');
    }
  }
  // orelhas pontudas
  if (o.ears) {
    if (!side) { s(hx - 1, hy + 3, skin); s(hx - 2, hy + 2, skin); s(hx + headW, hy + 3, skinD); s(hx + headW + 1, hy + 2, skinD); }
    else { s(hx + 5, hy + 2, skin); s(hx + 6, hy + 1, skin); }
  }
  // chifres
  if (o.horns) {
    const hc = '#f0e6c8', hd = '#9a8a6a';
    s(hx, hy - 1, hc); s(hx - 1, hy - 2, hc); s(hx, hy, hd);
    s(hx + headW - 1, hy - 1, hc); s(hx + headW, hy - 2, hc); s(hx + headW - 1, hy, hd);
  }

  // ---- cabelo / elmo / capuz ----
  const hc = o.hair, hcD = shade(o.hair || '#000000', -0.3), hcL = shade(o.hair || '#000000', 0.25);
  if (o.helmet && !o.hood) {
    const m = o.helmet, mL = shade(m, 0.4), mD = shade(m, -0.35);
    r(hx - 1, hy - 1, headW + 2, 4, m);
    for (let i = 0; i < headW + 2; i++) s(hx - 1 + i, hy - 1, mL);
    for (let i = 0; i < headW + 2; i++) s(hx - 1 + i, hy + 2, mD);
    if (up) r(hx - 1, hy + 3, headW + 2, 4, m);
    else if (side) r(hx + 4, hy + 3, 5, 4, m);
    else { s(hx - 1, hy + 3, m); s(hx - 1, hy + 4, mD); s(hx + headW, hy + 3, m); s(hx + headW, hy + 4, mD); }
    if (!up && !side) s(hx + 3, hy, '#ffe070');
  } else if (o.hood) {
    const m = o.hood, mD = shade(m, -0.3);
    r(hx - 1, hy - 1, headW + 2, 3, m);
    if (up) r(hx - 1, hy + 2, headW + 2, 6, m);
    else if (side) r(hx + 3, hy + 2, 6, 6, m);
    else { r(hx - 1, hy + 2, 1, 6, mD); r(hx + headW, hy + 2, 1, 6, mD); }
  } else if (o.hairStyle >= 0 && !bone) {
    const st = o.hairStyle;
    // base comum
    r(hx, hy - 1, headW, 3, hc);
    for (let i = 0; i < headW; i++) s(hx + i, hy - 1, hcL);
    if (up) {
      r(hx, hy, headW, st === 2 || st === 5 ? 8 : 6, hc);
      for (let j = 0; j < 6; j++) s(hx + headW - 1, hy + j, hcD);
    } else if (side) {
      r(hx + 3, hy, 5, 5, hc); r(hx + 6, hy + 5, 2, 1, hcD);
      if (st === 2) r(hx + 4, hy + 5, 4, 5, hc);
      if (st === 5) r(hx + 4, hy + 5, 4, 2, hc);
      if (st === 3) { r(hx + 8, hy + 2, 2, 2, hc); r(hx + 9, hy + 4, 1, 4, hcD); }
    } else {
      s(hx, hy + 2, hc); s(hx + headW - 1, hy + 2, hcD);
      if (st !== 1) { s(hx, hy + 3, hc); s(hx + headW - 1, hy + 3, hcD); }
      if (st === 2) { r(hx - 1, hy + 1, 1, 9, hc); r(hx + headW, hy + 1, 1, 9, hcD); }
      if (st === 5) { r(hx - 1, hy + 1, 1, 6, hc); r(hx + headW, hy + 1, 1, 6, hcD); }
      if (st === 3) { s(hx + 3, hy - 2, hc); s(hx + 4, hy - 2, hc); }
      if (st === 4) { s(hx + 2, hy + 2, hc); s(hx + 5, hy + 2, hc); s(hx + 1, hy - 2, hc); s(hx + 6, hy - 2, hcD); }
    }
    if (st === 1) {
      // espetado
      for (let i = 0; i < headW; i += 2) { s(hx + i, hy - 2, hc); }
      s(hx - 1, hy, hc); s(hx + headW, hy, hcD);
    }
  }
  if (o.beard && !up) {
    if (!side) { r(hx + 1, hy + 5, 6, 3, o.hair); s(hx + 3, hy + 6, shade(skin, -0.35)); s(hx + 4, hy + 6, shade(skin, -0.35)); }
    else r(hx, hy + 5, 3, 3, o.hair);
  }

  P.outline('#1a1020');
  return P;
}

// Ícone/sprite de arma segurada (desenhado sobre o corpo em tempo de renderização)
const weaponCache = new Map();
export function weaponSprite(cat, color) {
  const k = cat + color;
  let c = weaponCache.get(k);
  if (c) return c;
  const P = new Pix(12, 12);
  const L = shade(color, 0.4), D = shade(color, -0.35);
  if (cat === 'sword' || cat === 'club') {
    if (cat === 'club') { P.line(2, 9, 8, 3, '#8a5a32'); P.ball(8.5, 3, 2, 2, '#9a6a3a'); }
    else {
      P.line(3, 8, 9, 2, color); P.line(4, 8, 10, 2, D); P.line(3, 7, 9, 1, L);
      P.line(1, 8, 4, 11, '#e0b040'); P.line(1, 10, 2, 11, '#6a4020');
    }
  } else if (cat === 'axe') {
    P.line(2, 10, 8, 2, '#8a5a32'); P.rect(7, 1, 3, 4, '#c0c4cc'); P.set(10, 2, '#e8ecf0'); P.set(10, 3, '#e8ecf0');
  } else if (cat === 'bow') {
    for (let i = 0; i < 10; i++) { const x = 3 + Math.round(Math.sin((i / 9) * Math.PI) * 4); P.set(x, i + 1, i % 3 ? color : D); }
    P.line(3, 1, 3, 10, '#e8e8e8');
  } else if (cat === 'staff') {
    P.line(2, 11, 8, 3, '#7a4a2a'); P.line(3, 11, 9, 3, '#5a321a');
    P.ball(9, 2.5, 2.2, 2.2, color); P.set(8, 1, '#ffffff');
  }
  P.outline('#1a1020');
  c = P.toCanvas();
  weaponCache.set(k, c);
  return c;
}
