// Mensagens do jogador já dentro do mundo. Tudo é validado aqui: o cliente só envia intenções.
import { NPC_RANGE, POTION_CD_MS } from '@hipe/shared/constants.js';
import { NPC_BY_ID } from '@hipe/shared/npcs.js';
import { ITEMS, SHOPS, sellPrice } from '@hipe/shared/items.js';
import * as inv from './inventory.js';
import { newItem } from './character.js';
import { useAbility, respawnPlayer, validTarget, pvpBlockReason } from './combat.js';
import { acceptQuest, turnInQuest, abandonQuest, questsFor, openChest, checkAchievements } from './progression.js';
import { handleChat, handlePm } from './chat.js';

const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

function nearNpc(game, p, npcId) {
  const n = NPC_BY_ID[npcId];
  if (!n) return null;
  if (Math.hypot(p.x - n.x, p.y - n.y) > NPC_RANGE + 0.6) {
    game.notify(p, 'Aproxime-se do NPC.', 'warn');
    return null;
  }
  return n;
}

function shopPayload(shopKey) {
  return SHOPS[shopKey].items.map((k) => ({ k, price: ITEMS[k].price }));
}

export function handleGameMessage(game, p, msg, now) {
  switch (msg.t) {
    case 'mv': {
      if (p.dead) return;
      let dx = num(msg.dx), dy = num(msg.dy);
      const len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
      p.input = { dx, dy, run: !!msg.run };
      return;
    }
    case 'tgt': {
      const id = num(msg.id);
      if (!id) { p.target = 0; return; }
      const t = game.entity(id);
      if (t?.kind === 'p') {
        const why = pvpBlockReason(game, p, t);
        if (why) { game.notify(p, why, 'warn'); game.send(p, { t: 'tgt', id: 0 }); return; }
      }
      if (!validTarget(game, p, t)) return;
      if (Math.hypot(t.x - p.x, t.y - p.y) > 20) return;
      p.target = id;
      return;
    }
    case 'skill':
      return useAbility(game, p, num(msg.i), num(msg.id), now);
    case 'respawn':
      return respawnPlayer(game, p, now);
    case 'use': return usePotion(game, p, num(msg.slot, -1), now);
    case 'quick': {
      const want = msg.kind === 'mp' ? 'mana' : 'heal';
      const order = want === 'heal' ? ['hp_potion_s', 'hp_potion_m', 'hp_potion_l'] : ['mp_potion_s', 'mp_potion_m', 'mp_potion_l'];
      // usa a menor poção que não desperdice muito; se nenhuma, a maior disponível
      const missing = want === 'heal' ? p.stats.maxHp - p.ch.hp : p.stats.maxMp - p.ch.mp;
      let slot = -1, chosen = null;
      for (const k of order) {
        const i = p.ch.inv.findIndex((it) => it?.k === k);
        if (i < 0) continue;
        if (slot < 0 || ITEMS[k][want] <= missing * 1.2) { slot = i; chosen = k; }
      }
      if (slot < 0) return game.notify(p, want === 'heal' ? 'Sem poções de vida!' : 'Sem poções de mana!', 'warn');
      return usePotion(game, p, slot, now, chosen);
    }
    case 'equip': {
      const err = inv.equip(p.ch, num(msg.slot, -1));
      if (err) return game.notify(p, err, 'warn');
      return afterEquipChange(game, p);
    }
    case 'unequip': {
      const err = inv.unequip(p.ch, String(msg.slot));
      if (err) return game.notify(p, err, 'warn');
      return afterEquipChange(game, p);
    }
    case 'swap': {
      inv.swap(p.ch.inv, num(msg.a, -1), num(msg.b, -1));
      p.dirtyMe = p.dirtySave = true;
      return;
    }
    case 'sort':
      inv.sortList(p.ch.inv);
      p.dirtyMe = p.dirtySave = true;
      return;
    case 'drop': {
      const slot = num(msg.slot, -1);
      if (!inv.validSlot(p.ch.inv, slot) || !p.ch.inv[slot] || p.dead) return;
      const it = p.ch.inv[slot];
      const q = Math.max(1, Math.min(it.q, Math.floor(num(msg.q, it.q))));
      let dropped;
      if (q >= it.q) { dropped = it; p.ch.inv[slot] = null; }
      else { it.q -= q; dropped = newItem(it.k, q, it.r, it.b); }
      const gi = game.dropItem(dropped, p.x, p.y + 0.6, null, now);
      gi.ownerUntil = 0;
      game.addHistory(p.ch.id, 'drop', { k: it.k, q });
      p.dirtyMe = p.dirtySave = true;
      return;
    }
    case 'attr': {
      const a = String(msg.a);
      if (!['str', 'dex', 'int', 'vit'].includes(a) || p.ch.points <= 0) return;
      p.ch.points--;
      p.ch.attrs[a]++;
      p.recalc();
      p.dirtyMe = p.dirtySave = true;
      return;
    }
    case 'npc': {
      const n = nearNpc(game, p, msg.id);
      if (!n) return;
      const out = { t: 'npc', id: n.id, name: n.name, role: n.role, greet: n.greet };
      if (n.role === 'shop') out.shop = { name: SHOPS[n.shop].name, items: shopPayload(n.shop) };
      if (n.role === 'quest') out.quests = questsFor(p.ch, n.id);
      if (n.role === 'bank') out.bank = p.ch.bank;
      // a Capitã também oferece as diárias e todos podem vender para qualquer lojista
      game.send(p, out);
      return;
    }
    case 'heal': {
      const n = nearNpc(game, p, 'priest');
      if (!n) return;
      if (p.combatUntil > now) return game.notify(p, 'Você está em combate.', 'warn');
      p.ch.hp = p.stats.maxHp;
      p.ch.mp = p.stats.maxMp;
      p.dirtyVit = true;
      p.ver++;
      game.broadcastNear(p.x, p.y, { t: 'fx', e: 'heal', b: p.id, v: 0 });
      game.notify(p, 'Sua vida e mana foram restauradas.', 'info');
      return;
    }
    case 'buy': {
      const n = nearNpc(game, p, msg.npc);
      if (!n || n.role !== 'shop') return;
      const k = String(msg.k);
      if (!SHOPS[n.shop].items.includes(k)) return;
      const def = ITEMS[k];
      const q = def.stack ? Math.max(1, Math.min(100, Math.floor(num(msg.q, 1)))) : 1;
      const cost = def.price * q;
      if (p.ch.gold < cost) return game.notify(p, 'Moedas insuficientes.', 'warn');
      if (!inv.canAdd(p.ch.inv, k, q)) return game.notify(p, 'Inventário cheio.', 'warn');
      p.ch.gold -= cost;
      inv.addToList(p.ch.inv, newItem(k, q));
      game.send(p, { t: 'sfx', s: 'coin' });
      game.notify(p, `Comprou ${def.name}${q > 1 ? ' x' + q : ''} por ${cost} moedas.`, 'info');
      game.addHistory(p.ch.id, 'buy', { k, q, cost });
      p.dirtyMe = p.dirtySave = true;
      return;
    }
    case 'sell': {
      const n = nearNpc(game, p, msg.npc);
      if (!n || n.role !== 'shop') return;
      const slot = num(msg.slot, -1);
      if (!inv.validSlot(p.ch.inv, slot) || !p.ch.inv[slot]) return;
      const it = p.ch.inv[slot];
      const q = Math.max(1, Math.min(it.q, Math.floor(num(msg.q, it.q))));
      const gain = sellPrice(it) * q;
      it.q -= q;
      if (it.q <= 0) p.ch.inv[slot] = null;
      p.ch.gold += gain;
      game.send(p, { t: 'sfx', s: 'coin' });
      game.notify(p, `Vendeu ${ITEMS[it.k].name}${q > 1 ? ' x' + q : ''} por ${gain} moedas.`, 'info');
      game.addHistory(p.ch.id, 'sell', { k: it.k, q, gain });
      checkAchievements(game, p);
      p.dirtyMe = p.dirtySave = true;
      return;
    }
    case 'bank': {
      const n = nearNpc(game, p, 'banker');
      if (!n) return;
      const slot = num(msg.slot, -1);
      if (msg.op === 'dep') {
        if (!inv.validSlot(p.ch.inv, slot) || !p.ch.inv[slot]) return;
        const it = p.ch.inv[slot];
        const left = inv.addToList(p.ch.bank, it);
        if (left === it.q) return game.notify(p, 'Banco cheio.', 'warn');
        if (left > 0) it.q = left; else p.ch.inv[slot] = null;
      } else if (msg.op === 'wd') {
        if (!inv.validSlot(p.ch.bank, slot) || !p.ch.bank[slot]) return;
        const it = p.ch.bank[slot];
        const left = inv.addToList(p.ch.inv, it);
        if (left === it.q) return game.notify(p, 'Inventário cheio.', 'warn');
        if (left > 0) it.q = left; else p.ch.bank[slot] = null;
      } else return;
      game.send(p, { t: 'bank', bank: p.ch.bank });
      p.dirtyMe = p.dirtySave = true;
      return;
    }
    case 'qaccept': {
      const n = nearNpc(game, p, msg.npc);
      if (!n) return;
      acceptQuest(game, p, String(msg.id));
      game.send(p, { t: 'quests', npc: n.id, quests: questsFor(p.ch, n.id) });
      return;
    }
    case 'qturn': {
      const n = nearNpc(game, p, msg.npc);
      if (!n) return;
      turnInQuest(game, p, String(msg.id));
      game.send(p, { t: 'quests', npc: n.id, quests: questsFor(p.ch, n.id) });
      return;
    }
    case 'qabandon':
      return abandonQuest(game, p, String(msg.id));
    case 'chest':
      return openChest(game, p, String(msg.id));
    case 'chat':
      return handleChat(game, p, msg, now);
    case 'pm':
      return handlePm(game, p, msg, now);
    case 'online':
      game.send(p, { t: 'online', list: game.onlineList() });
      return;
    case 'rank': {
      const kind = msg.kind === 'pvp' ? 'pvp' : 'level';
      game.ranking(kind).then((rows) => game.send(p, { t: 'rank', kind, rows })).catch(() => game.notify(p, 'Ranking indisponível.', 'warn'));
      return;
    }
    default:
      return;
  }
}

function usePotion(game, p, slot, now, chosen) {
  if (p.dead || !inv.validSlot(p.ch.inv, slot)) return;
  const it = p.ch.inv[slot];
  if (!it) return;
  const def = ITEMS[it.k];
  if (def.cat !== 'potion') return;
  if (now - p.potionAt < POTION_CD_MS) return;
  p.potionAt = now;
  if (def.heal) p.ch.hp = Math.min(p.stats.maxHp, p.ch.hp + def.heal);
  if (def.mana) p.ch.mp = Math.min(p.stats.maxMp, p.ch.mp + def.mana);
  it.q--;
  if (it.q <= 0) p.ch.inv[slot] = null;
  game.send(p, { t: 'sfx', s: 'potion' });
  game.broadcastNear(p.x, p.y, { t: 'fx', e: 'potion', b: p.id, s: def.heal ? 'hp' : 'mp' });
  p.ver++;
  p.dirtyMe = p.dirtySave = true;
  void chosen;
}

function afterEquipChange(game, p) {
  p.recalc();
  p.ch.hp = Math.min(p.ch.hp, p.stats.maxHp);
  p.ch.mp = Math.min(p.ch.mp, p.stats.maxMp);
  p.fullVer++;
  p.dirtyMe = p.dirtySave = true;
  game.send(p, { t: 'sfx', s: 'equip' });
}
