// Progressão: XP, níveis, skills por estilo, missões, exploração e conquistas.
import { MAX_LEVEL } from '@hipe/shared/constants.js';
import { xpToNext, skillXpToNext, ATTR_POINTS_PER_LEVEL } from '@hipe/shared/rules.js';
import { QUESTS, ACHIEVEMENTS } from '@hipe/shared/quests.js';
import { REGIONS } from '@hipe/shared/regions.js';
import { CHESTS } from '@hipe/shared/mapgen.js';
import { regionAt } from '@hipe/shared/mapgen.js';
import { ITEMS } from '@hipe/shared/items.js';
import { canAdd, addToList, countItem, removeItem } from './inventory.js';
import { makeEquipment } from './loot.js';
import { newItem } from './character.js';

const today = () => new Date().toISOString().slice(0, 10);

export function gainXp(game, p, amount, now = Date.now()) {
  const ch = p.ch;
  if (ch.level >= MAX_LEVEL) return;
  ch.xp += amount;
  let leveled = false;
  while (ch.level < MAX_LEVEL && ch.xp >= xpToNext(ch.level)) {
    ch.xp -= xpToNext(ch.level);
    ch.level++;
    ch.points += ATTR_POINTS_PER_LEVEL;
    leveled = true;
    game.addHistory(ch.id, 'level_up', { level: ch.level });
  }
  if (leveled) {
    p.recalc();
    ch.hp = p.stats.maxHp;
    ch.mp = p.stats.maxMp;
    p.fullVer++;
    game.broadcastNear(p.x, p.y, { t: 'fx', e: 'lvl', b: p.id, v: ch.level });
    game.notify(p, `Parabéns! Você alcançou o nível ${ch.level}! (+${ATTR_POINTS_PER_LEVEL} pontos de atributo)`, 'lvl');
    checkAchievements(game, p);
  }
  game.send(p, { t: 'xp', v: amount });
  p.dirtyMe = p.dirtySave = true;
}

export function gainSkillXp(game, p, style, amount) {
  const sk = p.ch.skills[style];
  if (!sk) return;
  sk.xp += amount;
  let up = false;
  while (sk.xp >= skillXpToNext(sk.lv) && sk.lv < 150) {
    sk.xp -= skillXpToNext(sk.lv);
    sk.lv++;
    up = true;
  }
  if (up) {
    p.recalc();
    const names = { melee: 'Corpo a Corpo', distance: 'Distância', magic: 'Magia' };
    game.notify(p, `Skill de ${names[style]} subiu para ${sk.lv}!`, 'skill');
  }
  p.dirtyMe = p.dirtySave = true;
}

export function onMonsterKilled(game, p, monsterKey, now) {
  const ch = p.ch;
  ch.stats.kills++;
  ch.stats.mk[monsterKey] = (ch.stats.mk[monsterKey] || 0) + 1;
  for (const [id, st] of Object.entries(ch.quests.active)) {
    const q = QUESTS[id];
    if (!q || q.type !== 'hunt') continue;
    if (q.target === monsterKey || q.targetAny?.includes(monsterKey)) {
      if (st.n < q.count) {
        st.n++;
        if (st.n === q.count) game.notify(p, `Missão "${q.name}" concluída! Volte ao NPC para receber a recompensa.`, 'quest');
      }
    }
  }
  if (monsterKey === 'dragon') {
    game.broadcastAll({ t: 'sys', m: `🐉 ${ch.name} ajudou a derrotar o Dragão Abissal!` });
    unlock(game, p, 'dragon_slayer');
  }
  checkAchievements(game, p);
  p.dirtyMe = true;
}

function markExplore(game, p, tag) {
  for (const [id, st] of Object.entries(p.ch.quests.active)) {
    const q = QUESTS[id];
    if (q?.type !== 'explore' || !q.targets.includes(tag)) continue;
    st.seen = st.seen || [];
    if (!st.seen.includes(tag)) {
      st.seen.push(tag);
      if (st.seen.length === q.targets.length) game.notify(p, `Missão "${q.name}" concluída! Volte ao NPC.`, 'quest');
      p.dirtyMe = true;
    }
  }
}

export function checkRegion(game, p) {
  const reg = regionAt(game.world, p.x, p.y);
  if (reg.key === p.lastRegion) return;
  p.lastRegion = reg.key;
  if (!p.ch.visited[reg.key]) {
    p.ch.visited[reg.key] = 1;
    p.dirtyMe = p.dirtySave = true;
    if (reg.id > 0) {
      game.notify(p, `Nova região descoberta: ${reg.name}! (+${50 + reg.id * 40} XP)`, 'explore');
      gainXp(game, p, 50 + reg.id * 40);
    }
    checkAchievements(game, p);
  }
  markExplore(game, p, reg.key);
}

export function openChest(game, p, chestId) {
  const c = game.world.chests.find((x) => x.id === chestId);
  if (!c) return;
  if (Math.hypot(p.x - (c.x + 0.5), p.y - (c.y + 0.5)) > 1.9) return game.notify(p, 'Chegue mais perto do baú.', 'warn');
  if (p.ch.chests[c.id]) return game.notify(p, 'Este baú já foi aberto por você.', 'info');
  const rw = c.reward;
  if (rw.item && !canAdd(p.ch.inv, rw.item, rw.q)) return game.notify(p, 'Inventário cheio!', 'warn');
  p.ch.chests[c.id] = Date.now();
  p.ch.gold += rw.gold;
  if (rw.item) addToList(p.ch.inv, rewardItem(rw.item, rw.q, rw.rarity));
  game.notify(p, `Baú secreto! +${rw.gold} moedas e ${ITEMS[rw.item].name}${rw.q > 1 ? ' x' + rw.q : ''}.`, 'loot');
  game.send(p, { t: 'chest', id: c.id });
  gainXp(game, p, 200 + p.ch.level * 20);
  markExplore(game, p, 'chest:' + c.id);
  checkAchievements(game, p);
  p.dirtyMe = p.dirtySave = true;
}

function rewardItem(k, q = 1, rarity = 0) {
  const def = ITEMS[k];
  if (def.slot) return makeEquipment(k, rarity || 0);
  return newItem(k, q);
}

function unlock(game, p, key) {
  if (p.ch.ach[key]) return;
  const a = ACHIEVEMENTS[key];
  p.ch.ach[key] = Date.now();
  if (a.gold) p.ch.gold += a.gold;
  game.notify(p, `🏆 Conquista: ${a.name}${a.gold ? ` (+${a.gold} moedas)` : ''}`, 'ach');
  game.addHistory(p.ch.id, 'achievement', { key });
  p.dirtyMe = p.dirtySave = true;
}

export function checkAchievements(game, p) {
  const ch = p.ch;
  if (ch.stats.kills >= 1) unlock(game, p, 'first_blood');
  if (ch.stats.kills >= 100) unlock(game, p, 'hunter_100');
  if (ch.stats.kills >= 1000) unlock(game, p, 'hunter_1000');
  if (ch.level >= 10) unlock(game, p, 'lvl_10');
  if (ch.level >= 25) unlock(game, p, 'lvl_25');
  if (ch.level >= 50) unlock(game, p, 'lvl_50');
  if (REGIONS.filter((r) => r.id > 0).every((r) => ch.visited[r.key])) unlock(game, p, 'explorer');
  if (CHESTS.every((c) => ch.chests[c.id])) unlock(game, p, 'treasure');
  if (ch.stats.pvpKills >= 1) unlock(game, p, 'pvp_first');
  if (ch.gold >= 10000) unlock(game, p, 'rich');
  if (ch.stats.questsDone >= 10) unlock(game, p, 'quests_10');
}

// ---------- missões ----------
export function questState(ch, q) {
  const st = ch.quests.active[q.id];
  if (st) {
    let progress = 0, done = false;
    if (q.type === 'hunt') { progress = st.n; done = st.n >= q.count; }
    else if (q.type === 'collect') { progress = Math.min(q.count, countItem(ch.inv, q.target)); done = progress >= q.count; }
    else if (q.type === 'explore') { progress = (st.seen || []).length; done = progress >= q.targets.length; }
    return { status: done ? 'ready' : 'active', progress };
  }
  if (q.daily ? ch.quests.daily[q.id] === today() : ch.quests.done[q.id]) return { status: 'done' };
  if (ch.level < q.minLevel || (q.maxLevel && ch.level > q.maxLevel)) return { status: 'locked', why: q.maxLevel && ch.level > q.maxLevel ? `Até nível ${q.maxLevel}` : `Nível ${q.minLevel}` };
  if (q.requires && !ch.quests.done[q.requires]) return { status: 'locked', why: `Conclua "${QUESTS[q.requires].name}"` };
  return { status: 'available' };
}

export function questsFor(ch, npcId) {
  return Object.values(QUESTS).filter((q) => q.giver === npcId).map((q) => ({
    id: q.id, name: q.name, desc: q.desc, type: q.type, count: q.count || q.targets?.length, daily: !!q.daily,
    reward: q.reward, minLevel: q.minLevel, ...questState(ch, q),
  }));
}

export function acceptQuest(game, p, id) {
  const q = QUESTS[id];
  if (!q) return;
  const ch = p.ch;
  if (questState(ch, q).status !== 'available') return game.notify(p, 'Missão indisponível.', 'warn');
  if (Object.keys(ch.quests.active).length >= 8) return game.notify(p, 'Máximo de 8 missões ativas.', 'warn');
  const st = { n: 0 };
  if (q.type === 'explore') st.seen = q.targets.filter((t) => (t.startsWith('chest:') ? ch.chests[t.slice(6)] : ch.visited[t]));
  ch.quests.active[id] = st;
  game.notify(p, `Missão aceita: ${q.name}`, 'quest');
  p.dirtyMe = p.dirtySave = true;
}

export function turnInQuest(game, p, id) {
  const q = QUESTS[id];
  if (!q) return;
  const ch = p.ch;
  if (questState(ch, q).status !== 'ready') return game.notify(p, 'A missão ainda não foi concluída.', 'warn');
  const rw = q.reward;
  if (rw.item && !canAdd(ch.inv, rw.item, rw.q || 1)) return game.notify(p, 'Libere espaço no inventário.', 'warn');
  if (q.type === 'collect') removeItem(ch.inv, q.target, q.count);
  delete ch.quests.active[id];
  if (q.daily) ch.quests.daily[id] = today();
  else ch.quests.done[id] = Date.now();
  ch.stats.questsDone++;
  ch.gold += rw.gold || 0;
  if (rw.item) addToList(ch.inv, rewardItem(rw.item, rw.q || 1, rw.rarity));
  game.notify(p, `Recompensa: +${rw.xp} XP, +${rw.gold} moedas${rw.item ? `, ${ITEMS[rw.item].name}` : ''}`, 'quest');
  game.addHistory(ch.id, 'quest', { id });
  gainXp(game, p, rw.xp || 0);
  checkAchievements(game, p);
  p.dirtyMe = p.dirtySave = true;
}

export function abandonQuest(game, p, id) {
  if (p.ch.quests.active[id]) {
    delete p.ch.quests.active[id];
    p.dirtyMe = p.dirtySave = true;
  }
}
