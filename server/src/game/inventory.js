// Operações de inventário/equipamento (validadas no servidor).
import { MAX_STACK, EQUIP_SLOTS } from '@hipe/shared/constants.js';
import { ITEMS, RARITY } from '@hipe/shared/items.js';
import { newItem } from './character.js';

export function canAdd(list, k, q = 1) {
  const def = ITEMS[k];
  if (!def) return false;
  if (def.stack) {
    let room = 0;
    for (const it of list) {
      if (!it) room += MAX_STACK;
      else if (it.k === k) room += MAX_STACK - it.q;
      if (room >= q) return true;
    }
    return room >= q;
  }
  return list.some((s) => !s);
}

// Adiciona uma instância (empilha quando possível). Retorna a quantidade que NÃO coube.
export function addToList(list, inst) {
  const def = ITEMS[inst.k];
  if (!def) return inst.q;
  let left = inst.q;
  if (def.stack) {
    for (const it of list) {
      if (it && it.k === inst.k && it.q < MAX_STACK) {
        const n = Math.min(left, MAX_STACK - it.q);
        it.q += n;
        left -= n;
        if (!left) return 0;
      }
    }
    for (let i = 0; i < list.length && left > 0; i++) {
      if (!list[i]) {
        const n = Math.min(left, MAX_STACK);
        list[i] = newItem(inst.k, n);
        left -= n;
      }
    }
    return left;
  }
  const i = list.findIndex((s) => !s);
  if (i < 0) return left;
  list[i] = { ...inst, q: 1 };
  return 0;
}

export function countItem(list, k) {
  return list.reduce((s, it) => s + (it && it.k === k ? it.q : 0), 0);
}

export function removeItem(list, k, q) {
  if (countItem(list, k) < q) return false;
  for (let i = list.length - 1; i >= 0 && q > 0; i--) {
    const it = list[i];
    if (it && it.k === k) {
      const n = Math.min(q, it.q);
      it.q -= n;
      q -= n;
      if (it.q <= 0) list[i] = null;
    }
  }
  return true;
}

export function validSlot(list, i) {
  return Number.isInteger(i) && i >= 0 && i < list.length;
}

export function equip(ch, slot) {
  if (!validSlot(ch.inv, slot)) return 'Slot inválido.';
  const it = ch.inv[slot];
  if (!it) return 'Slot vazio.';
  const def = ITEMS[it.k];
  if (!def?.slot) return 'Este item não pode ser equipado.';
  if (ch.level < def.lvl) return `Requer nível ${def.lvl}.`;
  const eslot = def.slot;
  if (eslot === 'shield' && ch.equip.weapon && ITEMS[ch.equip.weapon.k]?.twoHanded) return 'Arcos usam as duas mãos.';
  if (def.twoHanded && ch.equip.shield) {
    // arma de duas mãos: o escudo volta para o inventário
    const prevWeapon = ch.equip.weapon;
    const shieldSlot = prevWeapon ? ch.inv.findIndex((s, i) => !s && i !== slot) : slot;
    if (shieldSlot < 0) return 'Inventário cheio para guardar o escudo.';
    ch.equip.weapon = it;
    ch.inv[slot] = prevWeapon || null;
    ch.inv[shieldSlot] = ch.equip.shield;
    ch.equip.shield = null;
    return null;
  }
  const prev = ch.equip[eslot];
  ch.equip[eslot] = it;
  ch.inv[slot] = prev || null;
  return null;
}

export function unequip(ch, eslot) {
  if (!EQUIP_SLOTS.includes(eslot)) return 'Slot inválido.';
  const it = ch.equip[eslot];
  if (!it) return 'Nada equipado.';
  const free = ch.inv.findIndex((s) => !s);
  if (free < 0) return 'Inventário cheio.';
  ch.inv[free] = it;
  ch.equip[eslot] = null;
  return null;
}

export function swap(list, a, b) {
  if (!validSlot(list, a) || !validSlot(list, b) || a === b) return 'Slot inválido.';
  const A = list[a], B = list[b];
  if (A && B && A.k === B.k && ITEMS[A.k]?.stack) {
    // solta A sobre B: empilha em B
    const m = Math.min(A.q, MAX_STACK - B.q);
    B.q += m; A.q -= m;
    if (A.q <= 0) list[a] = null;
    return null;
  }
  list[a] = B; list[b] = A;
  return null;
}

const CAT_ORDER = ['potion', 'sword', 'bow', 'staff', 'shield', 'helmet', 'armor', 'boots', 'ring', 'material'];
export function sortList(list) {
  const items = list.filter(Boolean);
  const merged = [];
  for (const it of items) {
    const def = ITEMS[it.k];
    if (def?.stack) {
      const ex = merged.find((m) => m.k === it.k && m.q < MAX_STACK);
      if (ex) {
        const n = Math.min(it.q, MAX_STACK - ex.q);
        ex.q += n; it.q -= n;
        if (it.q > 0) merged.push(it);
        continue;
      }
    }
    merged.push(it);
  }
  merged.sort((a, b) => {
    const da = ITEMS[a.k], db = ITEMS[b.k];
    return CAT_ORDER.indexOf(da.cat) - CAT_ORDER.indexOf(db.cat) || (db.tier || 0) - (da.tier || 0) || (b.r || 0) - (a.r || 0) || a.k.localeCompare(b.k);
  });
  for (let i = 0; i < list.length; i++) list[i] = merged[i] || null;
}

export function rarityName(r) {
  return RARITY[r || 0].name;
}
