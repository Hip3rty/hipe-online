// Criação, migração e serialização dos dados persistentes do personagem.
import crypto from 'node:crypto';
import { INV_SIZE, BANK_SIZE, EQUIP_SLOTS } from '@hipe/shared/constants.js';
import { CLASSES, validLook } from '@hipe/shared/rules.js';

export const TOWN_SPAWN = { x: 128.5, y: 133.5 };
export const TEMPLE_SPAWN = { x: 128.5, y: 118.5 };

export const uid = () => crypto.randomBytes(6).toString('base64url');

export function newItem(k, q = 1, r = 0, b = null) {
  const it = { uid: uid(), k, q, r };
  if (b && Object.keys(b).length) it.b = b;
  return it;
}

export function newCharacterData(name, cls, look) {
  const c = CLASSES[cls];
  const equip = Object.fromEntries(EQUIP_SLOTS.map((s) => [s, null]));
  for (const [k, slot] of c.start) equip[slot] = newItem(k);
  const inv = new Array(INV_SIZE).fill(null);
  inv[0] = newItem('hp_potion_s', 10);
  inv[1] = newItem('mp_potion_s', cls === 'mage' ? 10 : 4);
  return {
    v: 1,
    name,
    cls,
    look: validLook(look),
    level: 1,
    xp: 0,
    gold: 50,
    hp: 9999,
    mp: 9999,
    x: TOWN_SPAWN.x,
    y: TOWN_SPAWN.y,
    dir: 0,
    attrs: { ...c.attrs },
    points: 0,
    skills: { melee: { lv: 1, xp: 0 }, distance: { lv: 1, xp: 0 }, magic: { lv: 1, xp: 0 } },
    inv,
    bank: new Array(BANK_SIZE).fill(null),
    equip,
    quests: { active: {}, done: {}, daily: {} },
    ach: {},
    visited: { town: 1 },
    chests: {},
    stats: { kills: 0, deaths: 0, pvpKills: 0, pvpDeaths: 0, rating: 1000, questsDone: 0, mk: {} },
    createdAt: Date.now(),
  };
}

// Garante que dados antigos/corrompidos tenham todos os campos esperados
export function normalizeCharacter(ch) {
  const base = newCharacterData(ch.name, ch.cls in CLASSES ? ch.cls : 'warrior', ch.look);
  for (const k of Object.keys(base)) if (ch[k] === undefined) ch[k] = base[k];
  if (!Array.isArray(ch.inv) || ch.inv.length !== INV_SIZE) ch.inv = [...(ch.inv || []), ...new Array(INV_SIZE).fill(null)].slice(0, INV_SIZE);
  if (!Array.isArray(ch.bank) || ch.bank.length !== BANK_SIZE) ch.bank = [...(ch.bank || []), ...new Array(BANK_SIZE).fill(null)].slice(0, BANK_SIZE);
  for (const s of EQUIP_SLOTS) if (ch.equip[s] === undefined) ch.equip[s] = null;
  ch.stats = { ...base.stats, ...ch.stats };
  ch.quests = { ...base.quests, ...ch.quests };
  return ch;
}
