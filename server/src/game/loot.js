// Geração de loot: materiais, moedas e equipamentos com raridade e bônus aleatórios.
import { RARITY, EQUIP_BY_TIER, ITEMS } from '@hipe/shared/items.js';
import { newItem } from './character.js';

const TOTAL_W = RARITY.reduce((s, r) => s + r.weight, 0);

export function rollRarity(rnd = Math.random, boost = 0) {
  let best = 0;
  for (let i = 0; i <= boost; i++) {
    let p = rnd() * TOTAL_W, r = 0;
    for (const rr of RARITY) { if ((p -= rr.weight) < 0) { r = rr.id; break; } }
    best = Math.max(best, r);
  }
  return best;
}

const BONUS_POOL = {
  weapon: ['atk', 'crit', 'spd', 'steal', 'hp'],
  shield: ['def', 'hp', 'mp'],
  helmet: ['def', 'hp', 'mp', 'crit'],
  armor: ['def', 'hp', 'mp'],
  boots: ['move', 'def', 'hp', 'spd'],
  ring: ['atk', 'hp', 'mp', 'crit', 'steal'],
};
function bonusValue(type, tier, rnd) {
  const base = { hp: 10 + tier * 18, mp: 8 + tier * 12, crit: 1 + tier, spd: 2 + tier * 2, move: 1 + Math.floor(tier / 2), steal: 1 + Math.floor(tier / 2), atk: 1 + tier * 2, def: 1 + tier * 2 }[type];
  return Math.max(1, Math.round(base * (0.7 + rnd() * 0.6)));
}

export function makeEquipment(key, rarity, rnd = Math.random) {
  const def = ITEMS[key];
  const n = RARITY[rarity].bonuses;
  const pool = [...(BONUS_POOL[def.slot] || [])];
  const b = {};
  for (let i = 0; i < n && pool.length; i++) {
    const t = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    b[t] = bonusValue(t, def.tier, rnd);
  }
  return newItem(key, 1, rarity, b);
}

export function rollDrops(mdef, rnd = Math.random) {
  const out = [];
  const [g0, g1] = mdef.gold;
  out.push(newItem('gold', g0 + Math.floor(rnd() * (g1 - g0 + 1))));
  for (const [k, chance, q0, q1] of mdef.drops) {
    if (rnd() < chance) out.push(newItem(k, q0 + Math.floor(rnd() * (q1 - q0 + 1))));
  }
  const eq = mdef.equip;
  const rolls = eq.rolls || 1;
  for (let i = 0; i < rolls; i++) {
    if (rnd() < eq.chance) {
      const tier = eq.tiers[0] + Math.floor(rnd() * (eq.tiers[1] - eq.tiers[0] + 1));
      const options = EQUIP_BY_TIER(tier);
      const def = options[Math.floor(rnd() * options.length)];
      if (def) out.push(makeEquipment(def.key, rollRarity(rnd, eq.rarityBoost || 0), rnd));
    }
  }
  return out;
}
