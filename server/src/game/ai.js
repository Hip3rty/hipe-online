// IA básica dos monstros: vagar, detectar, perseguir, atacar e voltar ao ponto de origem.
import { ANIM, MONSTER_RADIUS } from '@hipe/shared/constants.js';
import { stepMove, dirFromVector } from '@hipe/shared/movement.js';
import { isSafe } from '@hipe/shared/mapgen.js';
import { monsterAttack } from './combat.js';

const LEASH = 13;

function move(game, m, dx, dy, dist, now) {
  const r = m.def.size === 2 ? 0.7 : MONSTER_RADIUS;
  let moved = stepMove(game.world, m, dx, dy, dist, r, true);
  if (!moved) {
    // contorna obstáculos tentando direções perpendiculares
    m.stuck++;
    const side = m.stuck % 40 < 20 ? 1 : -1;
    moved = stepMove(game.world, m, -dy * side, dx * side, dist, r, true);
  } else m.stuck = 0;
  if (moved) {
    m.dir = dirFromVector(dx, dy, m.dir);
    if (now > m.animUntil) m.anim = ANIM.walk;
    game.grid.update(m);
    m.ver++;
  }
  return moved;
}

function findTarget(game, m) {
  let best = null, bd = m.def.aggro;
  for (const e of game.grid.near(m.x, m.y, m.def.aggro)) {
    if (e.kind !== 'p' || e.dead || isSafe(game.world, e.x, e.y)) continue;
    const d = Math.hypot(e.x - m.x, e.y - m.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

export function updateMonster(game, m, dt, now) {
  const def = m.def;
  const home = m.spawner;
  const fromHome = Math.hypot(m.x - home.x, m.y - home.y);

  if (m.state === 'return') {
    if (fromHome < 0.6) {
      m.state = 'idle';
      m.hp = m.maxHp; // regenera ao voltar
      m.damageBy.clear();
      m.ver++;
    } else move(game, m, home.x - m.x, home.y - m.y, def.spd * 1.4 * dt, now);
    return;
  }

  let t = m.target ? game.players.get(m.target) : null;
  if (t && (t.dead || isSafe(game.world, t.x, t.y) || fromHome > LEASH + (def.boss ? -4 : 0))) {
    m.target = 0;
    t = null;
    m.state = 'return';
    return;
  }
  if (!t && (game.tick + m.id) % 5 === 0) {
    const f = findTarget(game, m);
    if (f) { m.target = f.id; m.state = 'chase'; t = f; }
  }

  if (t) {
    const dx = t.x - m.x, dy = t.y - m.y;
    const d = Math.hypot(dx, dy);
    const reach = def.range + (def.size === 2 ? 0.6 : 0) + (def.range > 1 ? 0 : 0.15);
    if (d > reach) {
      move(game, m, dx, dy, def.spd * dt, now);
    } else {
      // monstros à distância recuam um pouco se o alvo colar
      if (def.range > 2 && d < 1.6) move(game, m, -dx, -dy, def.spd * 0.6 * dt, now);
      if (now >= m.nextAtk) monsterAttack(game, m, t, now);
      else if (now > m.animUntil && m.anim !== ANIM.idle) { m.anim = ANIM.idle; m.ver++; }
    }
    return;
  }

  // vagar perto do ponto de origem
  if (now > m.wanderAt) {
    m.wanderAt = now + 2000 + Math.random() * 4000;
    if (Math.random() < 0.55) {
      const a = Math.random() * Math.PI * 2;
      const pull = fromHome > 4 ? 1 : 0;
      m.wanderDir = { x: Math.cos(a) + (home.x - m.x) * pull * 0.3, y: Math.sin(a) + (home.y - m.y) * pull * 0.3, until: now + 600 + Math.random() * 1200 };
    } else m.wanderDir = null;
  }
  if (m.wanderDir && now < m.wanderDir.until) {
    move(game, m, m.wanderDir.x, m.wanderDir.y, def.spd * 0.45 * dt, now);
  } else if (m.anim !== ANIM.idle && now > m.animUntil) {
    m.anim = ANIM.idle;
    m.ver++;
  }
}
