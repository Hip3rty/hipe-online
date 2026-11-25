// Regras de RPG: classes, atributos, fórmulas, habilidades, aparência.
import { ITEMS, STYLE_OF, itemStats } from './items.js';

export const CLASSES = {
  warrior: { name: 'Espadachim', desc: 'Espada e escudo. Alta resistência e dano físico.', attrs: { str: 9, dex: 5, int: 3, vit: 8 },
    start: [['sword_wood', 'weapon'], ['shield_wood', 'shield'], ['armor_leather', 'armor']] },
  archer: { name: 'Arqueiro', desc: 'Ataca à distância com arco. Rápido, mas frágil.', attrs: { str: 4, dex: 10, int: 4, vit: 6 },
    start: [['bow_short', 'weapon'], ['armor_leather', 'armor']] },
  mage: { name: 'Mago', desc: 'Cajados e magias poderosas. Consome mana.', attrs: { str: 3, dex: 4, int: 11, vit: 5 },
    start: [['staff_apprentice', 'weapon'], ['helmet_leather', 'helmet']] },
};

export const STYLES = {
  melee: { name: 'Corpo a Corpo', attr: 'str', range: 1.35, cd: 850, mp: 0 },
  distance: { name: 'Distância', attr: 'dex', range: 6.0, cd: 1000, mp: 0 },
  magic: { name: 'Magia', attr: 'int', range: 5.5, cd: 1150, mp: 2 },
};

export const ATTR_POINTS_PER_LEVEL = 3;

export const xpToNext = (lvl) => Math.floor(30 * Math.pow(lvl, 1.85) + 40);
export const skillXpToNext = (s) => Math.floor(14 * Math.pow(s, 1.75) + 20);

export function styleOfWeapon(inst) {
  if (!inst) return 'melee';
  return STYLE_OF[ITEMS[inst.k]?.cat] || 'melee';
}

// Calcula atributos derivados do personagem a partir dos dados persistidos
export function derivedStats(ch) {
  const eq = { atk: 0, def: 0, hp: 0, mp: 0, crit: 0, spd: 0, move: 0, steal: 0 };
  for (const inst of Object.values(ch.equip || {})) {
    if (!inst) continue;
    const s = itemStats(inst);
    for (const k of Object.keys(eq)) eq[k] += s[k] || 0;
  }
  const a = ch.attrs;
  const style = styleOfWeapon(ch.equip?.weapon);
  const st = STYLES[style];
  const skillLv = ch.skills?.[style]?.lv || 1;
  const maxHp = 90 + ch.level * 12 + a.vit * 10 + eq.hp;
  const maxMp = 25 + ch.level * 5 + a.int * 7 + eq.mp;
  const attack = (eq.atk + 2) * (1 + skillLv * 0.045) + ch.level * 0.6 + a[st.attr] * 0.9;
  const defense = eq.def + a.vit * 0.35 + ch.level * 0.2;
  const crit = 4 + eq.crit + a.dex * 0.08;
  const atkCd = Math.max(350, st.cd * (1 - Math.min(0.5, (eq.spd + a.dex * 0.15) / 100)));
  const moveMult = 1 + Math.min(0.3, eq.move / 100);
  return { maxHp: Math.round(maxHp), maxMp: Math.round(maxMp), attack, defense, crit, atkCd, moveMult, style, range: st.range, steal: eq.steal, skillLv };
}

export function rollDamage(attack, defense, rnd, critChance = 0) {
  let dmg = attack * (0.85 + rnd() * 0.3) - defense * 0.55;
  dmg = Math.max(1, dmg);
  const crit = rnd() * 100 < critChance;
  if (crit) dmg *= 1.6;
  return { dmg: Math.round(dmg), crit };
}

// Habilidades ativas por estilo de combate
export const ABILITIES = {
  melee: [
    { key: 'whirl', name: 'Golpe Giratório', mp: 8, cd: 6000, unlock: 1, kind: 'aoe_self', radius: 1.9, mult: 1.35, desc: 'Atinge todos os inimigos ao redor.' },
    { key: 'warcry', name: 'Grito de Guerra', mp: 12, cd: 20000, unlock: 5, kind: 'buff', buff: 'def', amount: 0.6, dur: 8000, desc: '+60% de defesa por 8s.' },
  ],
  distance: [
    { key: 'pierce', name: 'Tiro Perfurante', mp: 6, cd: 5000, unlock: 1, kind: 'single', range: 7, mult: 2.2, desc: 'Flecha poderosa em um alvo.' },
    { key: 'rain', name: 'Chuva de Flechas', mp: 14, cd: 9000, unlock: 5, kind: 'aoe_target', range: 6.5, radius: 2.2, mult: 1.1, desc: 'Flechas caem sobre uma área.' },
  ],
  magic: [
    { key: 'fireball', name: 'Bola de Fogo', mp: 10, cd: 3500, unlock: 1, kind: 'aoe_target', range: 6, radius: 1.6, mult: 1.7, desc: 'Explosão de fogo em área.' },
    { key: 'heal', name: 'Cura', mp: 18, cd: 10000, unlock: 5, kind: 'heal', pct: 0.25, desc: 'Recupera 25% da vida + bônus de Intelecto.' },
  ],
};

// Paletas de aparência (índices validados no servidor)
export const LOOKS = {
  skin: [['#f6d2b0', '#d9a882'], ['#e8b48a', '#c08a62'], ['#b97a52', '#8a5636'], ['#7a4a30', '#55301e']],
  hairColor: ['#2a1e1a', '#6a3a1e', '#c8862e', '#f0d060', '#c8401e', '#3a5adf', '#e85aa0', '#e8e8e8'],
  cloth: ['#3a5adf', '#d84040', '#3fa04a', '#e0a020', '#8a40c8', '#5a4a3a', '#30a0b0', '#e8e8f0'],
  hairStyles: ['Curto', 'Espetado', 'Longo', 'Rabo de Cavalo', 'Bagunçado', 'Chanel'],
};

export function validLook(look) {
  if (!look || typeof look !== 'object') return null;
  const n = (v, max) => (Number.isInteger(v) && v >= 0 && v < max ? v : 0);
  return {
    skin: n(look.skin, LOOKS.skin.length),
    hair: n(look.hair, LOOKS.hairStyles.length),
    hairColor: n(look.hairColor, LOOKS.hairColor.length),
    shirt: n(look.shirt, LOOKS.cloth.length),
    pants: n(look.pants, LOOKS.cloth.length),
  };
}
