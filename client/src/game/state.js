// Estado do cliente: entidades remotas com interpolação e jogador local com predição.
import { WALK_SPEED, RUN_SPEED, PLAYER_RADIUS, ANIM } from '@hipe/shared/constants.js';
import { stepMove, dirFromVector } from '@hipe/shared/movement.js';

const INTERP_MS = 110;

export class GameState {
  constructor(world) {
    this.world = world;
    this.entities = new Map();
    this.myId = 0;
    this.me = null; // dados completos do personagem (mensagem 'me')
    this.self = { x: 0, y: 0, dir: 0, anim: 0, dead: false, animUntil: 0 };
    this.history = [];
    this.input = { dx: 0, dy: 0, run: false };
    this.target = 0;
    this.openedChests = new Set();
  }

  reset() {
    this.entities.clear();
    this.history = [];
    this.target = 0;
  }

  applySnapshot(msg, now, rtt) {
    if (msg.sp) for (const e of msg.sp) this.spawn(e, now);
    if (msg.u) {
      for (const [id, x, y, dir, anim, hp] of msg.u) {
        const e = this.entities.get(id);
        if (!e) continue;
        e.buf.push({ t: now, x: x / 100, y: y / 100 });
        if (e.buf.length > 8) e.buf.shift();
        e.dir = dir;
        if (e.anim !== anim) { e.anim = anim; e.animStart = now; }
        if (hp !== e.hp && hp < e.hp) e.hurtAt = now;
        e.hp = hp;
      }
    }
    if (msg.g) for (const id of msg.g) this.entities.delete(id);
    if (msg.me) this.reconcile(msg.me[0] / 100, msg.me[1] / 100, msg.me[3], now, rtt);
  }

  spawn(e, now) {
    const old = this.entities.get(e.id);
    e.buf = old ? old.buf : [{ t: now, x: e.x, y: e.y }];
    e.rx = old ? old.rx : e.x;
    e.ry = old ? old.ry : e.y;
    e.animStart = now;
    e.bornAt = old ? old.bornAt : now;
    this.entities.set(e.id, e);
  }

  // Correção suave da predição comparando com onde estávamos ~1 RTT atrás
  reconcile(sx, sy, anim, now, rtt) {
    const s = this.self;
    if (anim === ANIM.dead) { s.dead = true; s.x = sx; s.y = sy; return; }
    if (s.dead) { s.dead = false; s.x = sx; s.y = sy; this.history = []; return; }
    const back = now - Math.min(600, rtt + 60);
    let h = null;
    for (let i = this.history.length - 1; i >= 0; i--) if (this.history[i].t <= back) { h = this.history[i]; break; }
    const ref = h || s;
    const ex = sx - ref.x, ey = sy - ref.y;
    const err = Math.hypot(ex, ey);
    // parado: converge rápido para a posição do servidor (evita "escorregar" depois de soltar o joystick)
    const idle = !s.moving;
    if (err > 2.5) { s.x = sx; s.y = sy; this.history = []; }
    else if (idle) { const ix = sx - s.x, iy = sy - s.y; if (Math.hypot(ix, iy) > 0.02) { s.x += ix * 0.5; s.y += iy * 0.5; } }
    else if (err > 0.04) { const k = err > 1 ? 0.45 : 0.2; s.x += ex * k; s.y += ey * k; }
  }

  predict(dt, now) {
    const s = this.self;
    if (s.dead || !this.me) return;
    const { dx, dy, run } = this.input;
    if (Math.hypot(dx, dy) > 0.05) {
      const speed = (run ? RUN_SPEED : WALK_SPEED) * (this.me.derived?.move || 1);
      stepMove(this.world, s, dx, dy, speed * dt, PLAYER_RADIUS);
      s.dir = dirFromVector(dx, dy, s.dir);
      s.moving = run ? 2 : 1;
    } else s.moving = 0;
    this.history.push({ t: now, x: s.x, y: s.y });
    while (this.history.length > 90) this.history.shift();
  }

  interpolate(now) {
    const rt = now - INTERP_MS;
    for (const e of this.entities.values()) {
      const b = e.buf;
      if (b.length === 1 || rt <= b[0].t) { e.rx = b[0].x; e.ry = b[0].y; continue; }
      let i = b.length - 1;
      while (i > 0 && b[i - 1].t > rt) i--;
      const a = b[i - 1] || b[0], c = b[i];
      if (rt >= c.t) { e.rx = c.x; e.ry = c.y; continue; }
      const k = (rt - a.t) / Math.max(1, c.t - a.t);
      e.rx = a.x + (c.x - a.x) * k;
      e.ry = a.y + (c.y - a.y) * k;
    }
  }
}
