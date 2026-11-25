// Combate autoritativo: ataques básicos automáticos, habilidades, dano, mortes, XP e PvP.
import { ANIM, PVP_MIN_LEVEL, SKULL_MS, COMBAT_TAG_MS } from '@hipe/shared/constants.js';
import { STYLES, ABILITIES, rollDamage } from '@hipe/shared/rules.js';
import { isSafe, regionAt } from '@hipe/shared/mapgen.js';
import { rollDrops } from './loot.js';
import { gainXp, gainSkillXp, onMonsterKilled, checkAchievements } from './progression.js';
import { TEMPLE_SPAWN } from './character.js';

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function pvpZone(game, e) {
  return !isSafe(game.world, e.x, e.y) && regionAt(game.world, e.x, e.y).pvp;
}

// Retorna null se A pode atacar B (jogadores), ou a mensagem de erro.
export function pvpBlockReason(game, a, b) {
  if (a === b) return 'Alvo inválido.';
  if (a.ch.level < PVP_MIN_LEVEL) return `PvP liberado a partir do nível ${PVP_MIN_LEVEL}.`;
  if (b.ch.level < PVP_MIN_LEVEL) return 'Este jogador está sob proteção de novato.';
  if (!pvpZone(game, a) || !pvpZone(game, b)) return 'PvP não é permitido nesta área.';
  return null;
}

function setAnim(e, anim, ms, now) {
  e.anim = anim;
  e.animUntil = now + ms;
  e.ver++;
}

function face(e, t) {
  const dx = t.x - e.x, dy = t.y - e.y;
  e.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : dy < 0 ? 3 : 0;
}

export function validTarget(game, p, t) {
  if (!t || t.dead) return false;
  if (t.kind === 'm') return true;
  if (t.kind === 'p') return !pvpBlockReason(game, p, t);
  return false;
}

export function playerCombatTick(game, p, now) {
  if (!p.target) return;
  const t = game.entity(p.target);
  if (!validTarget(game, p, t)) {
    p.target = 0;
    game.send(p, { t: 'tgt', id: 0 });
    return;
  }
  if (now < p.nextAtk) return;
  const range = p.stats.range + (t.def?.size === 2 ? 0.8 : 0) + 0.35;
  if (dist(p, t) > range) return;
  basicAttack(game, p, t, now);
}

function basicAttack(game, p, t, now) {
  const st = p.stats;
  const style = st.style;
  let mult = 1;
  if (STYLES[style].mp > 0) {
    if (p.ch.mp >= STYLES[style].mp) { p.ch.mp -= STYLES[style].mp; p.dirtyVit = true; }
    else mult = 0.35; // sem mana o cajado bate fraco
  }
  p.nextAtk = now + st.atkCd;
  face(p, t);
  setAnim(p, ANIM.attack, 280, now);
  const defense = targetDefense(t, now);
  const { dmg, crit } = rollDamage(st.attack * mult, defense, game.rnd, st.crit);
  game.broadcastNear(p.x, p.y, { t: 'fx', e: 'hit', a: p.id, b: t.id, v: dmg, c: crit ? 1 : 0, s: style });
  dealDamage(game, p, t, dmg, style, now);
}

function targetDefense(t, now) {
  if (t.kind === 'm') return t.def.def;
  return t.stats.defense * (t.buffs.def > now ? 1.6 : 1);
}

// Aplica dano de um jogador em um alvo
function dealDamage(game, p, t, dmg, style, now) {
  p.lastHit = now;
  const before = t.kind === 'm' ? t.hp : t.ch.hp;
  gainSkillXp(game, p, style, Math.max(1, Math.round(Math.min(dmg, before) * 0.6)));
  if (p.stats.steal > 0) {
    const heal = Math.round(Math.min(dmg, before) * p.stats.steal / 100);
    if (heal > 0) { p.ch.hp = Math.min(p.stats.maxHp, p.ch.hp + heal); p.dirtyVit = true; p.ver++; }
  }
  if (t.kind === 'm') damageMonster(game, t, dmg, p, now);
  else damagePlayer(game, t, dmg, p, now);
}

export function damageMonster(game, m, dmg, p, now) {
  m.hp -= dmg;
  m.ver++;
  m.damageBy.set(p.id, (m.damageBy.get(p.id) || 0) + dmg);
  if (!m.target || m.state === 'return') { m.target = p.id; m.state = 'chase'; }
  if (m.hp <= 0) killMonster(game, m, now);
  else if (now > m.animUntil) setAnim(m, ANIM.hurt, 180, now);
}

export function damagePlayer(game, v, dmg, attacker, now) {
  if (v.dead) return;
  v.ch.hp -= dmg;
  v.lastHit = now;
  v.dirtyVit = true;
  v.dirtySave = true;
  v.ver++;
  if (attacker.kind === 'p') {
    // PvP: caveira para o agressor, salvo legítima defesa
    const selfDefense = (attacker.aggressors.get(v.id) || 0) > now - SKULL_MS;
    if (!selfDefense && !v.skulled(now)) {
      if (!attacker.skulled(now)) attacker.fullVer++;
      attacker.skullUntil = now + SKULL_MS;
      attacker.dirtyMe = true;
    }
    v.aggressors.set(attacker.id, now);
    v.combatUntil = attacker.combatUntil = now + COMBAT_TAG_MS;
    if (!v.target) { v.target = attacker.id; game.send(v, { t: 'tgt', id: attacker.id }); }
  } else {
    v.combatUntil = Math.max(v.combatUntil, now + 4000);
  }
  if (v.ch.hp <= 0) killPlayer(game, v, attacker, now);
  else if (now > v.animUntil) setAnim(v, ANIM.hurt, 180, now);
}

function killMonster(game, m, now) {
  m.dead = true;
  m.hp = 0;
  m.anim = ANIM.dead;
  m.ver++;
  m.removeAt = now + 1200;
  m.spawner.mob = null;
  m.spawner.respawnAt = now + m.def.respawn;
  game.broadcastNear(m.x, m.y, { t: 'fx', e: 'die', b: m.id });

  const total = [...m.damageBy.values()].reduce((s, v) => s + v, 0) || 1;
  let top = null, topDmg = 0;
  for (const [pid, d] of m.damageBy) {
    const p = game.players.get(pid);
    if (!p || p.dead || dist(p, m) > 30) continue;
    if (d > topDmg) { top = p; topDmg = d; }
    let xp = m.def.xp * (d / total);
    if (p.ch.level > m.def.lvl + 12) xp *= 0.35;
    gainXp(game, p, Math.max(1, Math.round(xp)), now);
    onMonsterKilled(game, p, m.def.key, now);
  }
  for (const item of rollDrops(m.def, game.rnd)) game.dropItem(item, m.x, m.y, top ? top.ch.id : null, now);
}

function killPlayer(game, v, attacker, now) {
  v.dead = true;
  v.ch.hp = 0;
  v.anim = ANIM.dead;
  v.ver++;
  v.target = 0;
  v.input = { dx: 0, dy: 0, run: false };
  v.ch.stats.deaths++;
  // penalidade: perde 6% da XP necessária para o próximo nível (nunca perde nível)
  const lost = Math.min(v.ch.xp, Math.floor(v.ch.xp * 0.06 + v.ch.level * 3));
  v.ch.xp -= lost;
  let goldLost = 0;
  let pvpInfo = null;
  if (attacker.kind === 'p') pvpInfo = resolvePvpKill(game, attacker, v, now);
  if (pvpInfo) goldLost = pvpInfo.gold;
  game.broadcastNear(v.x, v.y, { t: 'fx', e: 'die', b: v.id });
  const by = attacker.kind === 'p' ? attacker.ch.name : attacker.def.name;
  game.send(v, { t: 'dead', by, xpLost: lost, goldLost });
  v.dirtyMe = v.dirtySave = true;
  game.addHistory(v.ch.id, 'death', { by, pvp: attacker.kind === 'p', xpLost: lost });
  for (const m of game.monsters.values()) if (m.target === v.id) { m.target = 0; m.state = 'return'; }
}

function resolvePvpKill(game, killer, victim, now) {
  victim.ch.stats.pvpDeaths++;
  const victimSkulled = victim.skulled(now);
  const sameOwner = killer.accountId === victim.accountId || (killer.ip && killer.ip === victim.ip);
  const last = killer.recentKills.get(victim.ch.id) || 0;
  const farming = now - last < 30 * 60000;
  const unfair = victim.ch.level < killer.ch.level * 0.6;
  killer.recentKills.set(victim.ch.id, now);
  let gold = 0, rating = 0;
  if (!sameOwner && !farming && !unfair) {
    // rating estilo Elo
    const ra = killer.ch.stats.rating, rb = victim.ch.stats.rating;
    const exp = 1 / (1 + Math.pow(10, (rb - ra) / 400));
    rating = Math.max(1, Math.round(32 * (1 - exp)));
    killer.ch.stats.rating += rating;
    victim.ch.stats.rating = Math.max(0, rb - rating);
    gold = Math.floor(victim.ch.gold * (victimSkulled ? 0.15 : 0.05));
    victim.ch.gold -= gold;
    killer.ch.gold += gold;
    killer.ch.stats.pvpKills++;
    gainXp(game, killer, Math.round(victim.ch.level * 25), now);
    checkAchievements(game, killer);
  } else if (unfair && !victimSkulled) {
    killer.skullUntil = now + SKULL_MS * 3; // punição por matar jogadores muito mais fracos
  }
  killer.dirtyMe = killer.dirtySave = true;
  killer.fullVer++;
  const why = sameOwner ? ' (mesma conta/rede: sem recompensa)' : farming ? ' (abate repetido: sem recompensa)' : unfair ? ' (diferença de nível: sem recompensa)' : '';
  game.notify(killer, `Você derrotou ${victim.ch.name}! +${rating} rating, +${gold} moedas${why}`, 'pvp');
  game.broadcastAll({ t: 'sys', m: `⚔ ${killer.ch.name} derrotou ${victim.ch.name} em PvP!` });
  game.addHistory(killer.ch.id, 'pvp_kill', { victim: victim.ch.name, rating, gold });
  return { gold };
}

export function respawnPlayer(game, p, now) {
  if (!p.dead) return;
  p.dead = false;
  p.x = TEMPLE_SPAWN.x;
  p.y = TEMPLE_SPAWN.y;
  p.ch.hp = p.stats.maxHp;
  p.ch.mp = p.stats.maxMp;
  p.anim = ANIM.idle;
  p.target = 0;
  p.aggressors.clear();
  p.grid = null;
  game.grid.update(p);
  p.ver++;
  p.fullVer++;
  p.dirtyMe = p.dirtySave = true;
  game.send(p, { t: 'respawned' });
}

// ---------- habilidades ----------
function enemiesNear(game, p, x, y, r, now) {
  const out = [];
  for (const e of game.grid.near(x, y, r)) {
    if (e.dead || e === p) continue;
    if (e.kind === 'm') out.push(e);
    else if (e.kind === 'p' && !pvpBlockReason(game, p, e) && (e.skulled(now) || (p.aggressors.get(e.id) || 0) > now - SKULL_MS)) out.push(e);
  }
  return out;
}

export function useAbility(game, p, index, targetId, now) {
  if (p.dead) return;
  const style = p.stats.style;
  const ab = ABILITIES[style]?.[index];
  if (!ab) return;
  const sk = p.ch.skills[style];
  if (sk.lv < ab.unlock) return game.notify(p, `${ab.name} requer nível ${ab.unlock} em ${STYLES[style].name}.`, 'warn');
  if ((p.cds[ab.key] || 0) > now) return;
  if (p.ch.mp < ab.mp) return game.notify(p, 'Mana insuficiente.', 'warn');

  let targets = [];
  let target = null;
  if (ab.kind === 'single' || ab.kind === 'aoe_target') {
    target = game.entity(targetId || p.target);
    if (!validTarget(game, p, target)) {
      // sem alvo: escolhe o monstro mais próximo no alcance
      let best = null, bd = Infinity;
      for (const e of game.grid.near(p.x, p.y, ab.range)) {
        if (e.kind === 'm' && !e.dead) { const d = dist(p, e); if (d < bd) { bd = d; best = e; } }
      }
      target = best;
    }
    if (!target) return game.notify(p, 'Nenhum alvo no alcance.', 'warn');
    if (dist(p, target) > ab.range + 0.5) return game.notify(p, 'Alvo fora de alcance.', 'warn');
    if (target.kind === 'p') {
      const why = pvpBlockReason(game, p, target);
      if (why) return game.notify(p, why, 'warn');
    }
    face(p, target);
  }

  p.ch.mp -= ab.mp;
  p.cds[ab.key] = now + ab.cd;
  p.dirtyMe = true;
  setAnim(p, ANIM.attack, 320, now);

  switch (ab.kind) {
    case 'aoe_self':
      targets = enemiesNear(game, p, p.x, p.y, ab.radius, now);
      game.broadcastNear(p.x, p.y, { t: 'fx', e: 'aoe', a: p.id, x: p.x, y: p.y, r: ab.radius, s: ab.key });
      break;
    case 'single':
      targets = [target];
      game.broadcastNear(p.x, p.y, { t: 'fx', e: 'proj', a: p.id, b: target.id, s: ab.key });
      break;
    case 'aoe_target':
      targets = enemiesNear(game, p, target.x, target.y, ab.radius, now);
      if (target.kind === 'p' && !targets.includes(target)) targets.push(target);
      game.broadcastNear(p.x, p.y, { t: 'fx', e: 'aoe', a: p.id, x: target.x, y: target.y, r: ab.radius, s: ab.key });
      break;
    case 'buff':
      p.buffs[ab.buff] = now + ab.dur;
      game.broadcastNear(p.x, p.y, { t: 'fx', e: 'buff', b: p.id, s: ab.key });
      break;
    case 'heal': {
      const amount = Math.round(p.stats.maxHp * ab.pct + p.ch.attrs.int * 4);
      p.ch.hp = Math.min(p.stats.maxHp, p.ch.hp + amount);
      p.dirtyVit = true;
      p.ver++;
      game.broadcastNear(p.x, p.y, { t: 'fx', e: 'heal', b: p.id, v: amount });
      break;
    }
  }
  for (const t of targets) {
    if (t.dead) continue;
    const { dmg, crit } = rollDamage(p.stats.attack * ab.mult, targetDefense(t, now), game.rnd, p.stats.crit);
    game.broadcastNear(t.x, t.y, { t: 'fx', e: 'hit', a: p.id, b: t.id, v: dmg, c: crit ? 1 : 0, s: ab.key, n: 1 });
    dealDamage(game, p, t, dmg, style, now);
  }
}

// Ataque de monstro (corpo a corpo ou projétil; chefes causam dano em área)
export function monsterAttack(game, m, p, now) {
  face(m, p);
  setAnim(m, ANIM.attack, 300, now);
  m.nextAtk = now + m.def.cd;
  const victims = m.def.aoe ? [...game.grid.near(p.x, p.y, m.def.aoe)].filter((e) => e.kind === 'p' && !e.dead) : [p];
  for (const v of victims) {
    const { dmg } = rollDamage(m.def.atk, targetDefense(v, now), game.rnd, 3);
    game.broadcastNear(m.x, m.y, { t: 'fx', e: 'hit', a: m.id, b: v.id, v: dmg, c: 0, s: m.def.proj || 'melee' });
    damagePlayer(game, v, dmg, m, now);
  }
}
