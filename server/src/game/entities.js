// Entidades em tempo de execução (jogadores, monstros, itens no chão).
import { MONSTERS } from '@hipe/shared/monsters.js';
import { derivedStats } from '@hipe/shared/rules.js';
import { ANIM } from '@hipe/shared/constants.js';

let nextId = 1;
export const newId = () => nextId++;

export class Player {
  constructor(conn, accountId, ch) {
    this.id = newId();
    this.kind = 'p';
    this.conn = conn;
    this.accountId = accountId;
    this.ch = ch;
    this.x = ch.x;
    this.y = ch.y;
    this.dir = ch.dir || 0;
    this.anim = ANIM.idle;
    this.animUntil = 0;
    this.input = { dx: 0, dy: 0, run: false };
    this.target = 0;
    this.nextAtk = 0;
    this.cds = {};
    this.buffs = {};
    this.dead = false;
    this.skullUntil = 0;
    this.combatUntil = 0; // PvE/PvP: bloqueia regeneração rápida e logout instantâneo
    this.pvpTagUntil = 0;
    this.aggressors = new Map(); // id do jogador -> timestamp (legítima defesa)
    this.recentKills = new Map(); // charId da vítima -> timestamp (anti-farm)
    this.potionAt = 0;
    this.known = new Map(); // entidades conhecidas por este cliente: id -> versão
    this.ver = 1; // muda quando posição/estado muda
    this.fullVer = 1; // muda quando aparência/nível muda (reenvia spawn)
    this.dirtyMe = true;
    this.dirtyVit = true;
    this.dirtySave = false;
    this.lingerUntil = 0;
    this.lastRegion = null;
    this.lastHit = 0;
    this.recalc();
    if (ch.hp > this.stats.maxHp) ch.hp = this.stats.maxHp;
    if (ch.mp > this.stats.maxMp) ch.mp = this.stats.maxMp;
    if (ch.hp <= 0) ch.hp = Math.ceil(this.stats.maxHp * 0.5);
  }
  get name() { return this.ch.name; }
  get level() { return this.ch.level; }
  get hp() { return this.ch.hp; }
  set hp(v) { this.ch.hp = v; }
  recalc() {
    this.stats = derivedStats(this.ch);
  }
  hpPct() {
    return Math.max(0, Math.min(100, Math.round((this.ch.hp / this.stats.maxHp) * 100)));
  }
  skulled(now) {
    return this.skullUntil > now;
  }
  spawnData(now) {
    const eq = {};
    for (const [s, it] of Object.entries(this.ch.equip)) if (it) eq[s] = it.k;
    return {
      id: this.id, k: 'p', x: this.x, y: this.y, dir: this.dir, anim: this.anim, hp: this.hpPct(),
      name: this.ch.name, lvl: this.ch.level, look: this.ch.look, eq, skull: this.skulled(now) ? 1 : 0, cls: this.ch.cls,
    };
  }
}

export class Monster {
  constructor(spawner) {
    const def = MONSTERS[spawner.monster];
    this.id = newId();
    this.kind = 'm';
    this.def = def;
    this.spawner = spawner;
    this.x = spawner.x;
    this.y = spawner.y;
    this.dir = 0;
    this.anim = ANIM.idle;
    this.animUntil = 0;
    this.hp = def.hp;
    this.maxHp = def.hp;
    this.target = 0;
    this.nextAtk = 0;
    this.state = 'idle';
    this.wanderAt = 0;
    this.wanderDir = null;
    this.damageBy = new Map();
    this.dead = false;
    this.removeAt = 0;
    this.ver = 1;
    this.fullVer = 1;
    this.stuck = 0;
  }
  hpPct() {
    return Math.max(0, Math.min(100, Math.round((this.hp / this.maxHp) * 100)));
  }
  spawnData() {
    return { id: this.id, k: 'm', m: this.def.key, x: this.x, y: this.y, dir: this.dir, anim: this.anim, hp: this.hpPct() };
  }
}

export class GroundItem {
  constructor(item, x, y, ownerChar, now) {
    this.id = newId();
    this.kind = 'i';
    this.item = item;
    this.x = x;
    this.y = y;
    this.owner = ownerChar; // id do personagem com prioridade de coleta
    this.ownerUntil = now + 25000;
    this.expireAt = now + 120000;
    this.ver = 1;
    this.fullVer = 1;
  }
  spawnData() {
    return { id: this.id, k: 'i', item: this.item.k, r: this.item.r || 0, q: this.item.q, x: this.x, y: this.y };
  }
}
