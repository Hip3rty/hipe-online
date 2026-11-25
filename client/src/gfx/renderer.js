// Renderizador do mundo: terreno em blocos cacheados, objetos e entidades ordenados por profundidade,
// efeitos, iluminação por região e textos (nomes, dano) nítidos em resolução nativa.
import { TILE, ANIM } from '@hipe/shared/constants.js';
import { T, REGIONS } from '@hipe/shared/regions.js';
import { tileAt, regionAt } from '@hipe/shared/mapgen.js';
import { MONSTERS } from '@hipe/shared/monsters.js';
import { ITEMS, RARITY } from '@hipe/shared/items.js';
import { NPCS } from '@hipe/shared/npcs.js';
import { drawChunk, PAL } from './sprites/tiles.js';
import { objectSprite } from './sprites/objects.js';
import { humanoidFrame, playerOpts, monsterOpts, weaponSprite, HW, HH, H_FOOT_Y } from './sprites/humanoid.js';
import { creatureFrame } from './sprites/creatures.js';
import { itemIcon } from './sprites/icons.js';
import { Effects } from './effects.js';
import { tileCanvas } from './assets.js';

const CH = 16; // tiles por bloco
const ROLE_MARK = { quest: ['!', '#ffd23a'], shop: ['$', '#7cff8a'], healer: ['+', '#ff8aa0'], bank: ['¤', '#8ad0ff'] };

export class Renderer {
  constructor(canvas, world, state) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.world = world;
    this.state = state;
    this.fx = new Effects();
    this.chunks = new Map();
    this.zoom = 3;
    this.cam = { x: 0, y: 0 };
    // objetos agrupados por bloco para culling rápido
    this.objBuckets = new Map();
    for (const o of world.objects) {
      const k = Math.floor(o.x / CH) * 1000 + Math.floor(o.y / CH);
      if (!this.objBuckets.has(k)) this.objBuckets.set(k, []);
      this.objBuckets.get(k).push(o);
    }
    this.npcs = NPCS.map((n) => ({ ...n, kind: 'npc', opts: playerOpts(n.look, {}) }));
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = Math.floor(window.innerWidth * dpr), h = Math.floor(window.innerHeight * dpr);
    this.canvas.width = w;
    this.canvas.height = h;
    this.dpr = dpr;
    // zoom inteiro: ~12 tiles na menor dimensão (pixel art nítida em qualquer tela)
    this.zoom = Math.max(2, Math.round(Math.min(w, h) / (TILE * 12)));
    this.uiScale = dpr * Math.min(1.3, Math.max(0.85, Math.min(window.innerWidth, window.innerHeight) / 420));
  }

  chunk(cx, cy) {
    const k = cx * 1000 + cy;
    let c = this.chunks.get(k);
    if (c) { this.chunks.delete(k); this.chunks.set(k, c); return c; }
    c = document.createElement('canvas');
    c.width = c.height = CH * TILE;
    const ctx = c.getContext('2d');
    drawChunk(ctx, (x, y) => tileAt(this.world, x, y), cx * CH, cy * CH, CH);
    this.chunks.set(k, c);
    if (this.chunks.size > 40) this.chunks.delete(this.chunks.keys().next().value); // LRU
    return c;
  }

  toScreen(x, y) {
    return { x: (x * TILE - this.cam.x) * this.zoom + this.canvas.width / 2, y: (y * TILE - this.cam.y) * this.zoom + this.canvas.height / 2 };
  }
  toWorld(sx, sy) {
    return { x: ((sx - this.canvas.width / 2) / this.zoom + this.cam.x) / TILE, y: ((sy - this.canvas.height / 2) / this.zoom + this.cam.y) / TILE };
  }

  posOf = (id, fx, fy) => {
    if (id === this.state.myId) return { x: this.state.self.x, y: this.state.self.y };
    const e = this.state.entities.get(id);
    if (e) return { x: e.rx, y: e.ry };
    return fx != null ? { x: fx, y: fy } : null;
  };

  draw(now) {
    const { ctx, canvas, state } = this;
    const z = this.zoom;
    const s = state.self;
    this.cam.x = Math.round(s.x * TILE * z) / z;
    this.cam.y = Math.round(s.y * TILE * z) / z;
    const vw = canvas.width / z / TILE, vh = canvas.height / z / TILE;
    const x0 = s.x - vw / 2 - 1, x1 = s.x + vw / 2 + 1, y0 = s.y - vh / 2 - 1, y1 = s.y + vh / 2 + 3;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#1f4790';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(z, 0, 0, z, Math.round(canvas.width / 2 - this.cam.x * z), Math.round(canvas.height / 2 - this.cam.y * z));

    // terreno
    const cx0 = Math.floor(x0 / CH), cx1 = Math.floor(x1 / CH), cy0 = Math.floor(y0 / CH), cy1 = Math.floor(y1 / CH);
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      if (cx < 0 || cy < 0 || cx * CH >= this.world.W || cy * CH >= this.world.H) continue;
      ctx.drawImage(this.chunk(cx, cy), cx * CH * TILE, cy * CH * TILE);
    }
    this.animatedTiles(ctx, now, x0, x1, y0, y1);

    // alvo selecionado (círculo no chão)
    const tgt = state.target ? state.entities.get(state.target) : null;
    if (tgt) {
      ctx.strokeStyle = tgt.k === 'p' ? '#ff4a6a' : '#ff5a3a';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.6 + Math.sin(now / 150) * 0.3;
      ctx.beginPath(); ctx.ellipse(tgt.rx * TILE, tgt.ry * TILE + 3, 8, 4, 0, 0, 7); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // objetos + entidades ordenados por Y
    const list = [];
    for (let cy = cy0 - 1; cy <= cy1 + 1; cy++) for (let cx = cx0 - 1; cx <= cx1 + 1; cx++) {
      const b = this.objBuckets.get(cx * 1000 + cy);
      if (!b) continue;
      for (const o of b) {
        if (o.x < x0 - 4 || o.x > x1 + 4 || o.y < y0 - 2 || o.y > y1 + 4) continue;
        const flat = o.t === 'flower' || o.t === 'bones' || o.t === 'ember';
        list.push({ y: flat ? o.y - 5 : o.y + (o.h && o.t !== 'fence' ? o.h : 1) - 0.01, o });
      }
    }
    for (const e of state.entities.values()) {
      if (e.rx < x0 - 2 || e.rx > x1 + 2 || e.ry < y0 - 2 || e.ry > y1 + 2) continue;
      list.push({ y: e.k === 'i' ? e.ry - 0.4 : e.ry + 0.3, e });
    }
    for (const n of this.npcs) if (n.x > x0 - 2 && n.x < x1 + 2 && n.y > y0 - 2 && n.y < y1 + 2) list.push({ y: n.y + 0.3, n });
    list.push({ y: s.y + 0.3, self: true });
    list.sort((a, b) => a.y - b.y);
    const lights = [];
    for (const d of list) {
      if (d.o) this.drawObject(ctx, d.o, now, lights);
      else if (d.e) this.drawEntity(ctx, d.e, now);
      else if (d.n) this.drawNpc(ctx, d.n, now);
      else this.drawSelf(ctx, now);
    }

    this.fx.draw(ctx, now, this.posOf);
    this.lighting(ctx, now, lights);

    // textos em resolução nativa
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.labels(ctx, now);
    this.fx.drawTexts(ctx, now, (x, y) => this.toScreen(x, y), this.uiScale);
  }

  animatedTiles(ctx, now, x0, x1, y0, y1) {
    const w = this.world;
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(w.H - 1, y1); y++) {
      for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(w.W - 1, x1); x++) {
        const t = w.tiles[y * w.W + x];
        if (t !== T.WATER && t !== T.DEEP && t !== T.LAVA) continue;
        const h = (x * 928371 + y * 123123) % 97;
        const ph = (now / (t === T.LAVA ? 900 : 700) + h / 13) % 1;
        if (t === T.LAVA) {
          ctx.fillStyle = ph < 0.5 ? '#ffd040' : '#ff9a30';
          ctx.fillRect(x * 16 + (h % 12), y * 16 + ((h >> 2) % 14), 2, 1);
        } else {
          ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.7;
          ctx.fillStyle = PAL[T.WATER][2];
          ctx.fillRect(x * 16 + ((h + Math.floor(ph * 6)) % 12), y * 16 + (h % 13), 3, 1);
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  drawObject(ctx, o, now, lights) {
    if (o.t === 'chest') o = { ...o, open: this.state.openedChests.has(o.id) };
    const spr = objectSprite(o);
    if (!spr) return;
    let dx, dy;
    if (spr.building) { dx = o.x * TILE - (spr.kenney ? 0 : 1); dy = (o.y + o.h) * TILE - spr.oy; }
    else if (spr.fountain) { dx = o.x * TILE - 1; dy = (o.y + 3) * TILE - spr.oy; }
    else { dx = (o.x + 0.5) * TILE - spr.ox; dy = (o.y + 1) * TILE - spr.oy; }
    ctx.drawImage(spr.c, Math.round(dx), Math.round(dy));
    if (spr.fountain) {
      // jatos d'água animados
      ctx.fillStyle = '#bfe4ff';
      for (let i = 0; i < 6; i++) {
        const k = ((now / 500 + i / 6) % 1);
        ctx.globalAlpha = 1 - k;
        ctx.fillRect(Math.round(dx + 24 + Math.sin(i) * k * 12), Math.round(dy + 32 + k * 10), 1, 2);
      }
      ctx.globalAlpha = 1;
    }
    if (spr.flame) {
      const fx = dx + spr.flame[0], fy = dy + spr.flame[1];
      const f = Math.floor(now / 120 + o.x) % 3;
      ctx.fillStyle = '#ff6a1a'; ctx.fillRect(Math.round(fx - 2), Math.round(fy - 3 - f), 4, 4 + f);
      ctx.fillStyle = '#ffd040'; ctx.fillRect(Math.round(fx - 1), Math.round(fy - 2 - f), 2, 3);
      lights.push([fx, fy, 30, '255,150,60']);
    }
    if (spr.glow) lights.push([dx + spr.glow[0], dy + spr.glow[1], 26, '255,220,140']);
  }

  shadow(ctx, x, y, w = 6) {
    ctx.fillStyle = 'rgba(10,6,20,0.28)';
    ctx.beginPath(); ctx.ellipse(x * TILE, y * TILE + 4, w, w * 0.4, 0, 0, 7); ctx.fill();
  }

  pose(anim, start, now) {
    const el = now - start;
    switch (anim) {
      case ANIM.walk: return ['walk', Math.floor(now / 150) % 4];
      case ANIM.run: return ['walk', Math.floor(now / 95) % 4];
      case ANIM.attack: return ['attack', Math.min(2, Math.floor(el / 95))];
      case ANIM.dead: return ['dead', 0];
      default: return ['idle', Math.floor(now / 520) % 2];
    }
  }

  drawHumanoidAt(ctx, opts, x, y, dir, anim, start, now, scale = 1, weapon = null, hurtAt = 0) {
    const [pose, frame] = this.pose(anim, start, now);
    if (hurtAt && now - hurtAt < 220 && Math.floor((now - hurtAt) / 55) % 2 === 0) return; // piscar ao levar dano
    const d = dir === 2 ? 1 : dir;
    const img = humanoidFrame(opts, d, pose === 'dead' ? 'idle' : pose, frame);
    const px = Math.round(x * TILE), py = Math.round(y * TILE + 4);
    ctx.save();
    ctx.translate(px, py);
    if (pose === 'dead') { ctx.globalAlpha = 0.75; ctx.rotate(Math.PI / 2); ctx.translate(-4, -6); }
    if (scale !== 1) ctx.scale(scale, scale);
    if (dir === 2) ctx.scale(-1, 1);
    const drawW = () => {
      if (!weapon || pose === 'dead') return;
      const w = weaponSprite(weapon.cat, weapon.color);
      ctx.save();
      const hand = d === 0 ? [5, -6] : d === 3 ? [-7, -9] : [-1, -6];
      ctx.translate(hand[0], hand[1]);
      let rot = weapon.cat === 'bow' ? (d === 1 ? -0.3 : 0.2) : -0.3;
      if (pose === 'attack' && weapon.cat !== 'bow') rot = [-1.6, 0.2, 1.0][frame];
      if (pose === 'attack' && weapon.cat === 'staff') rot = [-0.8, 0.4, 0.2][frame];
      if (d === 1) ctx.scale(-1, 1);
      ctx.rotate(rot);
      ctx.drawImage(w, -2, -10);
      ctx.restore();
    };
    if (d === 3) drawW();
    ctx.drawImage(img, -HW / 2, -H_FOOT_Y);
    if (d !== 3) drawW();
    ctx.restore();
    void HH;
  }

  drawEntity(ctx, e, now) {
    if (e.k === 'i') {
      const bob = Math.sin(now / 300 + e.id) * 1.2;
      const r = e.r || 0;
      if (r > 0) {
        ctx.globalAlpha = 0.35 + Math.sin(now / 200) * 0.15;
        ctx.fillStyle = RARITY[r].color;
        ctx.beginPath(); ctx.arc(e.rx * TILE, e.ry * TILE, 6 + r, 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
      }
      this.shadow(ctx, e.rx, e.ry - 0.2, 4);
      ctx.drawImage(itemIcon(e.item), Math.round(e.rx * TILE - 6), Math.round(e.ry * TILE - 10 + bob), 12, 12);
      return;
    }
    if (e.k === 'p') {
      this.shadow(ctx, e.rx, e.ry);
      e.opts = e.opts || playerOpts(e.look, e.eq || {}); // spawn novo (troca de equipamento) recria a entidade
      const wdef = e.eq?.weapon ? ITEMS[e.eq.weapon] : null;
      this.drawHumanoidAt(ctx, e.opts, e.rx, e.ry, e.dir, e.anim, e.animStart, now, 1, wdef ? { cat: wdef.cat, color: wdef.color } : null, e.hurtAt);
      return;
    }
    if (e.k === 'm') {
      const def = MONSTERS[e.m];
      if (!def) return;
      const art = def.art;
      const ks = art.kenney && tileCanvas(art.kenney[0], art.kenney[1]);
      if (ks) {
        if (e.dir === 1 || e.dir === 2) e.face = e.dir;
        this.drawKenneyChar(ctx, ks, e.rx, e.ry, e.anim, e.animStart, now, e.face === 2, e.hurtAt, e.id);
        return;
      }
      if (art.kind === 'humanoid') {
        this.shadow(ctx, e.rx, e.ry, art.big ? 8 : 6);
        e.opts = e.opts || monsterOpts(art);
        const wc = art.weapon ? { cat: art.weapon === 'club' ? 'club' : art.weapon, color: art.weapon === 'staff' ? '#9a6aff' : '#a9b0b8' } : null;
        this.drawHumanoidAt(ctx, e.opts, e.rx, e.ry, e.dir, e.anim, e.animStart, now, art.big ? 1.25 : art.small ? 0.85 : 1, wc, e.hurtAt);
      } else {
        const big = def.size === 2;
        this.shadow(ctx, e.rx, e.ry, big ? 16 : 7);
        const [pose, frame] = this.pose(e.anim, e.animStart, now);
        if (e.hurtAt && now - e.hurtAt < 220 && Math.floor((now - e.hurtAt) / 55) % 2 === 0) return;
        const img = creatureFrame(art, pose === 'dead' ? 'idle' : pose, frame, e.m);
        if (e.dir === 1 || e.dir === 2) e.face = e.dir;
        const flip = art.kind === 'slime' || art.kind === 'spider' || art.kind === 'dragon' ? false : (e.face || 2) === 1;
        ctx.save();
        ctx.translate(Math.round(e.rx * TILE), Math.round(e.ry * TILE + 4));
        if (pose === 'dead') { ctx.globalAlpha = 0.6; ctx.scale(1, 0.6); }
        if (flip) ctx.scale(-1, 1);
        ctx.drawImage(img, -Math.round(img.width / 2), -img.height + 2);
        ctx.restore();
      }
    }
  }

  // Personagem de 1 tile (arte Kenney): pulinho ao andar, investida ao atacar, achatado ao morrer
  drawKenneyChar(ctx, img, x, y, anim, start, now, flip, hurtAt, seed = 0) {
    this.shadow(ctx, x, y, 6);
    if (hurtAt && now - hurtAt < 220 && Math.floor((now - hurtAt) / 55) % 2 === 0) return;
    let bob = 0, sx = 1, sy = 1;
    if (anim === ANIM.walk || anim === ANIM.run) bob = -Math.abs(Math.sin(now / (anim === ANIM.run ? 70 : 110) + seed)) * 2;
    else if (anim === ANIM.attack) { const k = Math.min(1, (now - start) / 280); sx = sy = 1 + Math.sin(k * Math.PI) * 0.18; }
    else if (anim === ANIM.dead) { sy = 0.45; sx = 1.2; }
    else bob = Math.floor(now / 500 + seed) % 2 ? -1 : 0;
    ctx.save();
    ctx.translate(Math.round(x * TILE), Math.round(y * TILE + 4 + bob));
    if (anim === ANIM.dead) ctx.globalAlpha = 0.6;
    ctx.scale(flip ? -sx : sx, sy);
    ctx.drawImage(img, -8, -16);
    ctx.restore();
  }

  drawNpc(ctx, n, now) {
    // NPC olha para o jogador quando ele está perto
    const s = this.state.self;
    const dx = s.x - n.x, dy = s.y - n.y;
    const near = Math.hypot(dx, dy) < 4;
    const ks = n.sprite && tileCanvas(n.sprite[0], n.sprite[1]);
    if (ks) { this.drawKenneyChar(ctx, ks, n.x, n.y, ANIM.idle, 0, now, near && dx < 0, 0, n.x); return; }
    this.shadow(ctx, n.x, n.y);
    const dir = near ? (Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : dy < 0 ? 3 : 0) : 0;
    this.drawHumanoidAt(ctx, n.opts, n.x, n.y, dir, ANIM.idle, 0, now + n.x * 100);
  }

  drawSelf(ctx, now) {
    const st = this.state, me = st.me;
    if (!me) return;
    const s = st.self;
    this.shadow(ctx, s.x, s.y);
    const eq = {};
    for (const [k, v] of Object.entries(me.equip || {})) if (v) eq[k] = v.k;
    const key = JSON.stringify(me.look) + JSON.stringify(eq);
    if (this._selfKey !== key) { this._selfKey = key; this._selfOpts = playerOpts(me.look, eq); }
    let anim = s.dead ? ANIM.dead : s.moving === 2 ? ANIM.run : s.moving ? ANIM.walk : ANIM.idle;
    if (s.animUntil > now) anim = s.anim;
    const wdef = eq.weapon ? ITEMS[eq.weapon] : null;
    this.drawHumanoidAt(ctx, this._selfOpts, s.x, s.y, s.dir, anim, s.animStart || 0, now, 1, wdef ? { cat: wdef.cat, color: wdef.color } : null, s.hurtAt);
  }

  lighting(ctx, now, lights) {
    const reg = regionAt(this.world, this.state.self.x, this.state.self.y);
    const dark = { cave: 0.5, dungeon: 0.58, volcano: 0.18 }[reg.key] || 0;
    const tint = { volcano: 'rgba(255,80,20,0.10)', frozen: 'rgba(150,200,255,0.10)', desert: 'rgba(255,200,80,0.06)' }[reg.key];
    const { canvas } = this;
    const z = this.zoom;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (tint) { ctx.fillStyle = tint; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    if (dark) {
      const cx = canvas.width / 2, cy = canvas.height / 2;
      const g = ctx.createRadialGradient(cx, cy, 30 * z, cx, cy, 120 * z);
      g.addColorStop(0, 'rgba(8,4,20,0)');
      g.addColorStop(1, `rgba(8,4,20,${dark + 0.25})`);
      ctx.fillStyle = `rgba(8,4,20,${dark * 0.35})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'lighter';
      for (const [lx, ly, r, col] of lights) {
        const p = { x: (lx - this.cam.x) * z + cx, y: (ly - this.cam.y) * z + cy };
        const rr = r * z * (1 + Math.sin(now / 130 + lx) * 0.05);
        const lg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr);
        lg.addColorStop(0, `rgba(${col},0.35)`);
        lg.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = lg;
        ctx.fillRect(p.x - rr, p.y - rr, rr * 2, rr * 2);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }

  labels(ctx, now) {
    const sc = this.uiScale;
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    const label = (x, y, text, color, size = 10) => {
      const p = this.toScreen(x, y);
      ctx.font = `700 ${Math.round(size * sc)}px "Trebuchet MS", system-ui, sans-serif`;
      ctx.lineWidth = 3 * sc;
      ctx.strokeStyle = 'rgba(16,8,24,0.9)';
      ctx.strokeText(text, p.x, p.y);
      ctx.fillStyle = color;
      ctx.fillText(text, p.x, p.y);
    };
    const bar = (x, y, pct, color) => {
      const p = this.toScreen(x, y);
      const w = 22 * sc, h = 3.5 * sc;
      ctx.fillStyle = 'rgba(16,8,24,0.85)';
      ctx.fillRect(p.x - w / 2 - sc, p.y - sc, w + 2 * sc, h + 2 * sc);
      ctx.fillStyle = '#3a1a24';
      ctx.fillRect(p.x - w / 2, p.y, w, h);
      ctx.fillStyle = color;
      ctx.fillRect(p.x - w / 2, p.y, (w * pct) / 100, h);
    };
    for (const e of this.state.entities.values()) {
      if (e.k === 'p') {
        label(e.rx, e.ry - 1.55, `${e.name}`, e.skull ? '#ff5a5a' : '#ffffff');
        if (e.hp < 100 && e.anim !== ANIM.dead) bar(e.rx, e.ry - 1.45, e.hp, '#5ad04a');
      } else if (e.k === 'm' && e.anim !== ANIM.dead) {
        const def = MONSTERS[e.m];
        const top = def.size === 2 ? 2.7 : def.art.big ? 1.75 : 1.35;
        if (e.hp < 100 || this.state.target === e.id) {
          bar(e.rx, e.ry - top, e.hp, '#e84a3a');
          if (this.state.target === e.id) label(e.rx, e.ry - top - 0.15, `${def.name} Nv.${def.lvl}`, '#ffd0c0', 9);
        }
      }
    }
    for (const n of this.npcs) {
      const s = this.state.self;
      if (Math.abs(n.x - s.x) > 14 || Math.abs(n.y - s.y) > 10) continue;
      label(n.x, n.y - 1.55, n.name, '#ffe28a', 9.5);
      const mk = ROLE_MARK[n.role];
      if (mk) label(n.x, n.y - 2.1 + Math.sin(now / 300) * 0.08, mk[0], mk[1], 14);
    }
    // nomes das construções
    for (const o of this.world.objects) {
      if (o.t !== 'building') continue;
      const s = this.state.self;
      if (Math.abs(o.x - s.x) > 18 || Math.abs(o.y - s.y) > 14) continue;
      label(o.x + o.w / 2, o.y - 0.5, o.name.toUpperCase(), '#f6e2b0', 9);
    }
    const me = this.state.me;
    if (me) {
      const s = this.state.self;
      label(s.x, s.y - 1.55, me.name, me.skull ? '#ff5a5a' : '#bff0ff');
    }
  }
}

export { REGIONS };
