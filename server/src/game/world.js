// Núcleo do mundo: loop de simulação autoritativo, entidades, área de interesse (AOI) e envio de estado.
import {
  TICK_RATE, SNAPSHOT_EVERY, VIEW_RADIUS, ACTIVE_RADIUS, CELL, WALK_SPEED, RUN_SPEED, PLAYER_RADIUS,
  ANIM, PICKUP_RANGE, WORLD_SEED,
} from '@hipe/shared/constants.js';
import { generateWorld, regionAt } from '@hipe/shared/mapgen.js';
import { stepMove, dirFromVector } from '@hipe/shared/movement.js';
import { xpToNext, skillXpToNext } from '@hipe/shared/rules.js';
import { ITEMS } from '@hipe/shared/items.js';
import { SpatialGrid } from './spatial.js';
import { Player, Monster, GroundItem } from './entities.js';
import { normalizeCharacter, TEMPLE_SPAWN } from './character.js';
import { addToList } from './inventory.js';
import { playerCombatTick } from './combat.js';
import { updateMonster } from './ai.js';
import { checkRegion, checkAchievements } from './progression.js';
import { log } from '../log.js';
import { config } from '../config.js';

export class Game {
  constructor(store) {
    this.store = store;
    this.world = generateWorld(WORLD_SEED);
    this.grid = new SpatialGrid();
    this.players = new Map(); // entityId -> Player
    this.byChar = new Map(); // charId -> Player
    this.monsters = new Map();
    this.items = new Map();
    this.spawners = this.world.spawners.map((s, i) => ({ ...s, i, mob: null, respawnAt: 0 }));
    this.tick = 0;
    this.rnd = Math.random;
    this.lastSave = Date.now();
    this.metrics = { tickMs: 0, maxTickMs: 0, sentBytes: 0 };
    this.rankCache = {};
    this.history = [];
  }

  start() {
    const now = Date.now();
    for (const sp of this.spawners) this.spawnMonster(sp, now);
    log.info('world started', { monsters: this.monsters.size, spawners: this.spawners.length });
    const dtMs = 1000 / TICK_RATE;
    let last = performance.now();
    let acc = 0;
    this.timer = setInterval(() => {
      const t = performance.now();
      acc += t - last;
      last = t;
      // até 3 ticks de recuperação se o processo atrasar
      let n = 0;
      while (acc >= dtMs && n < 3) {
        this.update(dtMs / 1000, Date.now());
        acc -= dtMs;
        n++;
      }
      if (acc > dtMs * 3) acc = 0;
      const el = performance.now() - t;
      this.metrics.tickMs = this.metrics.tickMs * 0.95 + el * 0.05;
      this.metrics.maxTickMs = Math.max(this.metrics.maxTickMs, el);
    }, dtMs / 2);
    this.metricsTimer = setInterval(() => {
      const mem = process.memoryUsage();
      log.info('metrics', {
        players: this.players.size, monsters: this.monsters.size, items: this.items.size,
        tickMs: +this.metrics.tickMs.toFixed(2), maxTickMs: +this.metrics.maxTickMs.toFixed(2),
        kbSentPerMin: Math.round(this.metrics.sentBytes / 1024), rssMb: Math.round(mem.rss / 1048576),
      });
      this.metrics.maxTickMs = 0;
      this.metrics.sentBytes = 0;
    }, 60000);
    this.metricsTimer.unref();
  }

  async stop() {
    clearInterval(this.timer);
    clearInterval(this.metricsTimer);
    await this.saveAll(true);
    await this.flushHistory();
  }

  // ---------- entidades ----------
  spawnMonster(sp, now) {
    const m = new Monster(sp);
    sp.mob = m;
    this.monsters.set(m.id, m);
    this.grid.insert(m);
    m.spawnedAt = now;
    return m;
  }
  removeEntity(e) {
    this.grid.remove(e);
    if (e.kind === 'm') this.monsters.delete(e.id);
    else if (e.kind === 'i') this.items.delete(e.id);
    else if (e.kind === 'p') this.players.delete(e.id);
  }
  dropItem(item, x, y, ownerChar, now) {
    const a = this.rnd() * Math.PI * 2, r = this.rnd() * 0.6;
    const gi = new GroundItem(item, x + Math.cos(a) * r, y + Math.sin(a) * r, ownerChar, now);
    this.items.set(gi.id, gi);
    this.grid.insert(gi);
    return gi;
  }
  entity(id) {
    return this.players.get(id) || this.monsters.get(id) || this.items.get(id) || null;
  }

  // ---------- jogadores ----------
  attachPlayer(conn, accountId, ch) {
    const existing = this.byChar.get(ch.id);
    if (existing) {
      // reconexão ou login duplicado: reaproveita a entidade viva
      if (existing.conn && existing.conn !== conn) existing.conn.kick('Conectado em outro dispositivo.');
      existing.conn = conn;
      existing.lingerUntil = 0;
      existing.known.clear();
      existing.dirtyMe = existing.dirtyVit = true;
      existing.input = { dx: 0, dy: 0, run: false };
      return existing;
    }
    normalizeCharacter(ch);
    const p = new Player(conn, accountId, ch);
    p.ip = conn.ip;
    this.players.set(p.id, p);
    this.byChar.set(ch.id, p);
    this.grid.insert(p);
    p.lastRegion = regionAt(this.world, p.x, p.y).key;
    this.broadcastAll({ t: 'sys', m: `${ch.name} entrou no mundo.` }, p);
    this.addHistory(ch.id, 'login', { ip: conn.ip });
    return p;
  }

  detachPlayer(p, now = Date.now()) {
    p.conn = null;
    p.input = { dx: 0, dy: 0, run: false };
    p.target = 0;
    // em combate o personagem permanece no mundo por 15s (evita fugir deslogando)
    p.lingerUntil = now + (p.combatUntil > now ? 15000 : 1500);
  }

  async removePlayer(p) {
    this.removeEntity(p);
    this.byChar.delete(p.ch.id);
    await this.savePlayer(p);
    this.broadcastAll({ t: 'sys', m: `${p.ch.name} saiu do mundo.` });
  }

  async savePlayer(p) {
    const ch = p.ch;
    if (p.dead) { ch.x = TEMPLE_SPAWN.x; ch.y = TEMPLE_SPAWN.y; ch.hp = p.stats.maxHp; }
    else { ch.x = +p.x.toFixed(2); ch.y = +p.y.toFixed(2); }
    ch.dir = p.dir;
    ch.savedAt = Date.now();
    try {
      await this.store.saveCharacter(ch);
      p.dirtySave = false;
    } catch (err) {
      log.error('save failed', { char: ch.id, err: err.message });
    }
  }

  async saveAll(force = false) {
    const list = [...this.players.values()].filter((p) => force || p.dirtySave);
    for (const p of list) await this.savePlayer(p);
    if (list.length) log.info('saved', { count: list.length });
  }

  addHistory(charId, event, payload) {
    this.history.push([charId, event, payload]);
  }
  async flushHistory() {
    const batch = this.history.splice(0, this.history.length);
    for (const [c, e, p] of batch) {
      try { await this.store.addHistory(c, e, p); } catch (err) { log.warn('history failed', { err: err.message }); break; }
    }
  }

  // ---------- comunicação ----------
  send(p, msg) {
    if (p.conn) this.metrics.sentBytes += p.conn.send(msg);
  }
  broadcastNear(x, y, msg, radius = VIEW_RADIUS + 3) {
    for (const e of this.grid.near(x, y, radius)) if (e.kind === 'p' && e.conn) this.metrics.sentBytes += e.conn.send(msg);
  }
  broadcastAll(msg, except = null) {
    for (const p of this.players.values()) if (p !== except && p.conn) this.metrics.sentBytes += p.conn.send(msg);
  }
  notify(p, m, kind = 'info') {
    this.send(p, { t: 'note', m, k: kind });
  }

  // ---------- loop ----------
  update(dt, now) {
    this.tick++;
    const world = this.world;

    // jogadores
    for (const p of this.players.values()) {
      if (!p.conn && p.lingerUntil && now > p.lingerUntil) {
        this.removePlayer(p);
        continue;
      }
      if (p.dead) continue;
      const { dx, dy, run } = p.input;
      if (Math.hypot(dx, dy) > 0.05) {
        const speed = (run ? RUN_SPEED : WALK_SPEED) * p.stats.moveMult;
        stepMove(world, p, dx, dy, speed * dt, PLAYER_RADIUS);
        p.dir = dirFromVector(dx, dy, p.dir);
        if (now > p.animUntil) p.anim = run ? ANIM.run : ANIM.walk;
        this.grid.update(p);
        p.ver++;
        if (this.tick % 5 === 0) checkRegion(this, p);
        this.autoPickup(p, now);
      } else if (now > p.animUntil && p.anim !== ANIM.idle) {
        p.anim = ANIM.idle;
        p.ver++;
      }
      playerCombatTick(this, p, now);
    }

    // regeneração (1x por segundo)
    if (this.tick % TICK_RATE === 0) {
      for (const p of this.players.values()) this.regen(p, now);
      this.respawnTick(now);
      for (const it of this.items.values()) if (now > it.expireAt) this.removeEntity(it);
    }

    // monstros: só simula os próximos de algum jogador
    const active = new Set();
    const cr = Math.ceil(ACTIVE_RADIUS / CELL);
    for (const p of this.players.values()) {
      const cx = Math.floor(p.x / CELL), cy = Math.floor(p.y / CELL);
      for (let ox = -cr; ox <= cr; ox++) for (let oy = -cr; oy <= cr; oy++) active.add(this.grid.key(cx + ox, cy + oy));
    }
    for (const m of this.monsters.values()) {
      if (m.dead) {
        if (now > m.removeAt) this.removeEntity(m);
        continue;
      }
      if (active.has(m._cell)) updateMonster(this, m, dt, now);
    }

    if (this.tick % SNAPSHOT_EVERY === 0) {
      for (const p of this.players.values()) if (p.conn) this.snapshot(p, now);
    }

    if (now - this.lastSave > config.saveIntervalMs) {
      this.lastSave = now;
      this.saveAll().then(() => this.flushHistory());
    }
  }

  regen(p, now) {
    if (p.dead) return;
    const ch = p.ch, st = p.stats;
    const inCombat = now - p.lastHit < 6000;
    const hpGain = inCombat ? st.maxHp * 0.003 : st.maxHp * 0.015 + ch.attrs.vit * 0.2;
    const mpGain = st.maxMp * (inCombat ? 0.01 : 0.025) + ch.attrs.int * 0.1;
    const oh = ch.hp, om = ch.mp;
    ch.hp = Math.min(st.maxHp, ch.hp + hpGain);
    ch.mp = Math.min(st.maxMp, ch.mp + mpGain);
    if (Math.floor(oh) !== Math.floor(ch.hp)) { p.dirtyVit = true; p.ver++; }
    if (Math.floor(om) !== Math.floor(ch.mp)) p.dirtyVit = true;
    for (const [b, until] of Object.entries(p.buffs)) if (until < now) { delete p.buffs[b]; p.dirtyMe = true; }
    if (p.skullUntil && p.skullUntil < now) { p.skullUntil = 0; p.fullVer++; }
  }

  respawnTick(now) {
    for (const sp of this.spawners) {
      if (sp.mob || now < sp.respawnAt) continue;
      // evita nascer em cima de um jogador
      let close = false;
      for (const e of this.grid.near(sp.x, sp.y, 5)) if (e.kind === 'p') { close = true; break; }
      if (close) { sp.respawnAt = now + 3000; continue; }
      this.spawnMonster(sp, now);
    }
  }

  autoPickup(p, now) {
    for (const e of this.grid.near(p.x, p.y, PICKUP_RANGE)) {
      if (e.kind !== 'i') continue;
      if (e.owner && e.owner !== p.ch.id && now < e.ownerUntil) continue;
      const it = e.item;
      if (it.k === 'gold') {
        p.ch.gold += it.q;
        this.removeEntity(e);
        this.send(p, { t: 'loot', k: 'gold', q: it.q });
        p.dirtyMe = p.dirtySave = true;
        checkAchievements(this, p);
        continue;
      }
      const left = addToList(p.ch.inv, it);
      if (left === it.q) {
        if (!p.fullWarnAt || now - p.fullWarnAt > 4000) { p.fullWarnAt = now; this.notify(p, 'Inventário cheio!', 'warn'); }
        continue;
      }
      this.send(p, { t: 'loot', k: it.k, q: it.q - left, r: it.r || 0 });
      if (left > 0) { it.q = left; e.fullVer++; } else this.removeEntity(e);
      p.dirtyMe = p.dirtySave = true;
    }
  }

  // ---------- estado para o cliente ----------
  snapshot(p, now) {
    const spawns = [], upd = [], gone = [];
    const seen = new Set();
    for (const e of this.grid.near(p.x, p.y, VIEW_RADIUS + 2)) {
      if (e === p) continue;
      const k = p.known.get(e.id);
      if (!k) {
        if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 > VIEW_RADIUS * VIEW_RADIUS) continue;
        spawns.push(e.spawnData(now));
        p.known.set(e.id, { f: e.fullVer, v: e.ver });
      } else if (k.f !== e.fullVer) {
        spawns.push(e.spawnData(now));
        k.f = e.fullVer; k.v = e.ver;
      } else if (k.v !== e.ver) {
        upd.push([e.id, Math.round(e.x * 100), Math.round(e.y * 100), e.dir, e.anim, e.hpPct ? e.hpPct() : 0]);
        k.v = e.ver;
      }
      seen.add(e.id);
    }
    for (const id of p.known.keys()) if (!seen.has(id)) { gone.push(id); p.known.delete(id); }
    const msg = { t: 's', me: [Math.round(p.x * 100), Math.round(p.y * 100), p.dir, p.anim] };
    if (spawns.length) msg.sp = spawns;
    if (upd.length) msg.u = upd;
    if (gone.length) msg.g = gone;
    this.send(p, msg);
    if (p.dirtyMe) { this.send(p, this.meMessage(p, now)); p.dirtyMe = false; p.dirtyVit = false; }
    else if (p.dirtyVit) { this.send(p, this.vitMessage(p)); p.dirtyVit = false; }
  }

  vitMessage(p) {
    return { t: 'vit', hp: Math.ceil(p.ch.hp), mp: Math.floor(p.ch.mp), mhp: p.stats.maxHp, mmp: p.stats.maxMp };
  }

  meMessage(p, now) {
    const ch = p.ch, st = p.stats;
    return {
      t: 'me', id: p.id, name: ch.name, cls: ch.cls, look: ch.look, level: ch.level, xp: ch.xp, xpNext: xpToNext(ch.level),
      gold: ch.gold, hp: Math.ceil(ch.hp), mp: Math.floor(ch.mp), mhp: st.maxHp, mmp: st.maxMp,
      attrs: ch.attrs, points: ch.points,
      skills: Object.fromEntries(Object.entries(ch.skills).map(([k, s]) => [k, { lv: s.lv, xp: s.xp, next: skillXpToNext(s.lv) }])),
      derived: { atk: Math.round(st.attack), def: Math.round(st.defense), crit: +st.crit.toFixed(1), atkCd: Math.round(st.atkCd), move: +st.moveMult.toFixed(2), style: st.style, range: st.range },
      inv: ch.inv, equip: ch.equip, quests: ch.quests, ach: ch.ach, visited: ch.visited, chests: ch.chests, stats: ch.stats,
      skull: p.skulled(now) ? Math.round((p.skullUntil - now) / 1000) : 0, buffs: Object.keys(p.buffs), cds: p.cds,
      dead: p.dead,
    };
  }

  // ---------- rankings (cache de 30s para poupar o banco) ----------
  async ranking(kind) {
    const c = this.rankCache[kind];
    if (c && Date.now() - c.at < 30000) return c.rows;
    // persiste quem está online antes de consultar
    await this.saveAll();
    const rows = kind === 'pvp' ? await this.store.topPvp(20) : await this.store.topLevels(20);
    this.rankCache[kind] = { at: Date.now(), rows };
    return rows;
  }

  onlineList() {
    return [...this.players.values()].filter((p) => p.conn).map((p) => ({ name: p.ch.name, lvl: p.ch.level, cls: p.ch.cls, reg: regionAt(this.world, p.x, p.y).name }));
  }
}

export { ITEMS };
