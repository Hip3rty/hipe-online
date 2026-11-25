// Hipe Online — cliente. Liga rede, estado, renderização, HUD e painéis.
import { WORLD_SEED, NPC_RANGE, ANIM } from '@hipe/shared/constants.js';
import { generateWorld, regionAt, isSafe } from '@hipe/shared/mapgen.js';
import { REGIONS, T } from '@hipe/shared/regions.js';
import { MONSTERS } from '@hipe/shared/monsters.js';
import { ITEMS, RARITY } from '@hipe/shared/items.js';
import { NPCS, NPC_BY_ID } from '@hipe/shared/npcs.js';
import { Net } from './net.js';
import { GameState } from './game/state.js';
import { Renderer } from './gfx/renderer.js';
import { PAL } from './gfx/sprites/tiles.js';
import { Hud } from './ui/hud.js';
import { Panels } from './ui/panels.js';
import { h, ui } from './ui/dom.js';
import { showLogin, showCharSelect, showCreate, showLoading, hideScreens } from './ui/screens.js';
import { sfx, playMusic, unlockAudio } from './audio.js';
import { loadAssets } from './gfx/assets.js';

class App {
  constructor() {
    this.world = generateWorld(WORLD_SEED);
    this.state = new GameState(this.world);
    this.renderer = new Renderer(document.getElementById('game'), this.world, this.state);
    this.net = new Net();
    this.hud = new Hud(this);
    this.panels = new Panels(this);
    this.cds = {};
    this.playing = false;
    this.token = localStorage.getItem('hipe.token');
    this.lastChar = Number(localStorage.getItem('hipe.char')) || 0;
    this.clockOffset = 0;
    this.lastMv = { dx: 0, dy: 0, run: false, t: 0 };
    this.autoWalk = null;
    this.mapImg = this.buildMapImage();
    this.fogCache = { key: '', c: null };
    this.region = null;
    this.onNetStatus = () => {};
    this.bindNet();
    this.bindTap();
    this.net.onStatus = (s) => { this.onNetStatus(s); this.hud.net(s, this.net.rtt); };
    showLoading('Conectando ao servidor...');
    this.net.connect();
    // se não conectar logo, mostra o login (o servidor gratuito pode estar acordando)
    setTimeout(() => { if (!this.playing && !this.authed) showLogin(this); }, this.token ? 6000 : 300);
    requestAnimationFrame((t) => this.frame(t));
    document.addEventListener('pointerdown', () => unlockAudio(), { once: true });
  }

  // ---------- rede ----------
  bindNet() {
    const n = this.net, st = this.state;
    n.on('_open', () => {
      if (this.token) n.send({ t: 'resume', token: this.token });
    });
    n.on('_close', () => {
      this.authed = false;
      if (this.playing) this.hud.net('reconnecting');
    });
    n.on('hello', (m) => { this.online = m.online; this.onNetStatus(n.status); });
    n.on('auth_ok', (m) => {
      this.authed = true;
      this.token = m.token;
      localStorage.setItem('hipe.token', m.token);
      if (this.playing && this.lastChar) n.send({ t: 'play', id: this.lastChar }); // reconexão transparente
      else showCharSelect(this, m.chars);
    });
    n.on('auth_err', (m) => {
      if (this.authCb) { this.authCb(m.m); this.authCb = null; }
      else { this.token = null; localStorage.removeItem('hipe.token'); this.playing = false; this.hud.show(false); showLogin(this, { error: m.m }); }
    });
    n.on('chars', (m) => {
      if (m.created) return this.play(m.created);
      if (!this.playing) showCharSelect(this, m.chars);
    });
    n.on('err', (m) => {
      if (this.createCb) { this.createCb(m.m); return; }
      if (this.playing) this.hud.toast(m.m, 'warn'); else showLogin(this, { error: m.m });
    });
    n.on('enter', (m) => {
      this.createCb = null;
      hideScreens();
      st.reset();
      st.myId = m.id;
      st.self.x = m.x; st.self.y = m.y; st.self.dead = false;
      this.clockOffset = m.now - Date.now();
      this.playing = true;
      this.hud.show(true);
      this.hud.net('online');
      this.region = null;
    });
    n.on('s', (m) => st.applySnapshot(m, performance.now(), n.rtt));
    n.on('me', (m) => {
      const prevLvl = st.me?.level;
      st.me = m;
      st.self.dead = m.dead;
      const pnow = performance.now(), snow = Date.now() + this.clockOffset;
      this.cds = {};
      for (const [k, v] of Object.entries(m.cds || {})) this.cds[k] = pnow + (v - snow);
      for (const id of Object.keys(m.chests || {})) st.openedChests.add(id);
      this.hud.update(m, pnow);
      this.panels.refresh();
      if (prevLvl && m.level > prevLvl) sfx('levelup');
      if (!m.dead) this.hideDeath();
    });
    n.on('vit', (m) => {
      if (!st.me) return;
      Object.assign(st.me, { hp: m.hp, mp: m.mp, mhp: m.mhp, mmp: m.mmp });
      this.hud.update(st.me, performance.now());
    });
    n.on('fx', (m) => this.onFx(m));
    n.on('tgt', (m) => { st.target = m.id; });
    n.on('note', (m) => {
      this.hud.toast(m.m, m.k);
      if (m.k === 'warn') sfx('error');
      else if (m.k === 'quest' || m.k === 'ach' || m.k === 'explore') sfx('quest');
      if (m.k !== 'warn') this.panels.addChat('sys', m.m);
    });
    n.on('sys', (m) => { this.hud.chat(m.m, 'c-sys'); this.panels.addChat('sys', m.m); });
    n.on('chat', (m) => {
      const text = m.ch === 'p' ? (m.self ? `[para ${m.to}] ${m.m}` : `[de ${m.from}] ${m.m}`) : `${m.ch === 'l' ? '(local) ' : ''}${m.from}: ${m.m}`;
      this.hud.chat(text, 'c-' + m.ch);
      this.panels.addChat(m.ch, text);
      if (m.ch === 'p' && !m.self) { sfx('chat'); this.hud.chatBadge.classList.remove('hidden'); this.panels.pmTarget = m.from; }
      if (m.ch === 'l' && m.id) { const e = st.entities.get(m.id); if (e) e.say = { m: m.m, t: performance.now() }; }
    });
    n.on('loot', (m) => {
      const name = m.k === 'gold' ? 'moedas' : ITEMS[m.k]?.name;
      this.renderer.fx.text(st.self.x, st.self.y - 0.4, `+${m.q} ${name}`, m.k === 'gold' ? '#ffd23a' : RARITY[m.r || 0].color);
      sfx(m.k === 'gold' ? 'coin' : 'pickup');
    });
    n.on('xp', (m) => this.renderer.fx.text(st.self.x + 0.4, st.self.y - 0.8, `+${m.v} XP`, '#c8a0ff'));
    n.on('dead', (m) => this.showDeath(m));
    n.on('respawned', () => this.hideDeath());
    n.on('npc', (m) => { this.panels.openNpc(m); });
    n.on('quests', (m) => { if (this.panels.npc?.id === m.npc) { this.panels.npc.quests = m.quests; this.panels.render(); } });
    n.on('bank', (m) => { if (this.panels.npc) { this.panels.npc.bank = m.bank; this.panels.render(); } });
    n.on('rank', (m) => { this.panels.rankData[m.kind] = m.rows; if (this.panels.name === 'rank') this.panels.render(); });
    n.on('online', (m) => { this.panels.rankData.online = m.list; if (this.panels.name === 'rank') this.panels.render(); });
    n.on('chest', (m) => st.openedChests.add(m.id));
    n.on('sfx', (m) => sfx(m.s));
    n.on('kicked', (m) => {
      this.playing = false;
      this.hud.show(false);
      this.panels.close();
      this.net.wantOnline = false;
      showLogin(this, { error: m.m });
      setTimeout(() => this.net.connect(), 1500);
    });
    n.on('logged_out', () => showLogin(this));
  }

  onFx(m) {
    const st = this.state, fx = this.renderer.fx;
    const pos = (id) => this.renderer.posOf(id);
    const isMe = (id) => id === st.myId;
    switch (m.e) {
      case 'hit': {
        const a = st.entities.get(m.a);
        const ranged = ['distance', 'magic', 'arrow', 'bolt', 'fire', 'pierce'].includes(m.s);
        if (ranged && !m.n) fx.add({ type: 'proj', a: m.a, b: m.b, s: m.s === 'distance' ? 'arrow' : m.s === 'magic' ? 'bolt' : m.s, dur: 220 });
        else if (!m.n) fx.add({ type: 'slash', b: m.b, dur: 200 });
        if (m.s === 'pierce') fx.add({ type: 'proj', a: m.a, b: m.b, s: 'pierce', dur: 180 });
        fx.add({ type: 'spark', b: m.b, dur: 260, c: m.c ? '#ffe070' : '#ffffff' });
        const p = pos(m.b);
        if (p) fx.text(p.x, p.y, m.c ? `${m.v}!` : `${m.v}`, isMe(m.b) ? '#ff5a5a' : m.c ? '#ffd23a' : '#ffffff', m.c);
        if (isMe(m.a)) { st.self.anim = ANIM.attack; st.self.animUntil = performance.now() + 280; st.self.animStart = performance.now(); }
        if (isMe(m.b)) { st.self.hurtAt = performance.now(); sfx('hurt'); }
        else sfx(m.c ? 'crit' : ranged ? (m.s === 'distance' ? 'arrow' : m.s) : 'melee');
        if (a?.k === 'm' && Math.random() < 0.3) sfx(MONSTERS[a.m]?.sound);
        const b = st.entities.get(m.b);
        if (b) b.hurtAt = performance.now();
        break;
      }
      case 'aoe':
        fx.add({ type: 'aoe', x: m.x, y: m.y, r: m.r, s: m.s, dur: m.s === 'rain' ? 700 : 450 });
        if (m.s === 'fireball') fx.add({ type: 'proj', a: m.a, bx: m.x, by: m.y, b: -1, s: 'fireball', dur: 180 });
        sfx(m.s);
        if (isMe(m.a)) { st.self.anim = ANIM.attack; st.self.animUntil = performance.now() + 320; st.self.animStart = performance.now(); }
        break;
      case 'proj': fx.add({ type: 'proj', a: m.a, b: m.b, s: m.s, dur: 180 }); break;
      case 'buff': fx.add({ type: 'ring', b: m.b, c: '#ffcf3a', dur: 700 }); sfx('warcry'); break;
      case 'heal': {
        fx.add({ type: 'ring', b: m.b, c: '#5aff7a', dur: 700 });
        const p = pos(m.b);
        if (p && m.v) fx.text(p.x, p.y, `+${m.v}`, '#5aff7a');
        sfx('heal');
        break;
      }
      case 'potion': fx.add({ type: 'ring', b: m.b, c: m.s === 'hp' ? '#ff6a8a' : '#6aa0ff', dur: 500 }); break;
      case 'lvl': {
        fx.add({ type: 'lvl', b: m.b, dur: 1600 });
        const p = pos(m.b);
        if (p) fx.text(p.x, p.y - 0.6, `NÍVEL ${m.v}!`, '#ffe070', true);
        break;
      }
      case 'die': {
        const p = pos(m.b);
        if (p) fx.add({ type: 'puff', x: p.x, y: p.y, dur: 600 });
        const e = st.entities.get(m.b);
        if (e?.k === 'm') sfx(MONSTERS[e.m]?.sound || 'die');
        if (st.target === m.b) st.target = 0;
        break;
      }
    }
  }

  // ---------- ações do jogador ----------
  auth(kind, u, p, cb) {
    this.authCb = cb;
    this.net.connect();
    this.net.sendOrQueue({ t: kind, u, p });
  }
  createChar(name, cls, look, cb) {
    this.createCb = cb;
    this.net.send({ t: 'create', name, cls, look });
  }
  play(id) {
    this.createCb = null;
    this.lastChar = id;
    localStorage.setItem('hipe.char', String(id));
    this.net.send({ t: 'play', id });
  }
  reconnect() {
    this.net.disconnect();
    setTimeout(() => this.net.connect(), 200);
  }
  leaveWorld() {
    this.playing = false;
    this.hud.show(false);
    this.hideDeath();
    this.net.send({ t: 'leave' });
  }
  logout() {
    this.playing = false;
    this.authed = false;
    this.hud.show(false);
    this.hideDeath();
    if (this.state.me) this.net.send({ t: 'leave' });
    this.net.send({ t: 'logout' });
    this.token = null;
    localStorage.removeItem('hipe.token');
    // nova conexão limpa para o próximo login
    this.reconnect();
    showLogin(this);
  }
  setTarget(id) {
    this.state.target = id;
    this.net.send({ t: 'tgt', id });
  }
  attackNearest() {
    const st = this.state;
    if (!st.me || st.self.dead) return;
    const cur = st.target ? st.entities.get(st.target) : null;
    if (cur && cur.anim !== ANIM.dead) return this.net.send({ t: 'tgt', id: cur.id });
    let best = null, bd = 9;
    for (const e of st.entities.values()) {
      if (e.k !== 'm' || e.anim === ANIM.dead) continue;
      const d = Math.hypot(e.rx - st.self.x, e.ry - st.self.y);
      if (d < bd) { bd = d; best = e; }
    }
    if (best) this.setTarget(best.id);
    else this.hud.toast('Nenhum monstro por perto.', 'warn');
  }
  useSkill(i) {
    if (!this.state.me || this.state.self.dead) return;
    this.net.send({ t: 'skill', i, id: this.state.target || 0 });
  }
  quickPotion(kind) {
    this.net.send({ t: 'quick', kind });
  }
  npcName(id) {
    return NPC_BY_ID[id]?.name || id;
  }
  nearInteractable() {
    const s = this.state.self;
    for (const n of NPCS) if (Math.hypot(n.x - s.x, n.y - s.y) <= NPC_RANGE) return { npc: n };
    for (const c of this.world.chests) if (!this.state.openedChests.has(c.id) && Math.hypot(c.x + 0.5 - s.x, c.y + 0.5 - s.y) <= 1.8) return { chest: c };
    return null;
  }
  interact() {
    const it = this.nearInteractable();
    if (!it) return;
    if (it.npc) this.net.send({ t: 'npc', id: it.npc.id });
    else this.net.send({ t: 'chest', id: it.chest.id });
  }
  cancelAutoWalk() {
    this.autoWalk = null;
  }

  // toque no mundo: selecionar alvo, falar com NPC ou andar até o ponto
  bindTap() {
    const cv = this.renderer.canvas;
    cv.addEventListener('pointerdown', (e) => {
      if (!this.playing || this.panels.isOpen) return;
      unlockAudio();
      const dpr = this.renderer.dpr;
      const w = this.renderer.toWorld(e.clientX * dpr, e.clientY * dpr);
      const st = this.state;
      let best = null, bd = 1.0;
      for (const en of st.entities.values()) {
        if ((en.k !== 'm' && en.k !== 'p') || en.anim === ANIM.dead) continue;
        const big = en.k === 'm' && MONSTERS[en.m]?.size === 2 ? 1.6 : 0;
        const d = Math.hypot(en.rx - w.x, en.ry - 0.5 - w.y) - big;
        if (d < bd) { bd = d; best = en; }
      }
      if (best) { this.setTarget(best.id); return; }
      for (const n of NPCS) {
        if (Math.hypot(n.x - w.x, n.y - 0.5 - w.y) < 1) {
          if (Math.hypot(n.x - st.self.x, n.y - st.self.y) <= NPC_RANGE) this.net.send({ t: 'npc', id: n.id });
          else this.autoWalk = { x: n.x, y: n.y + 1, npc: n.id, t: performance.now() };
          return;
        }
      }
      for (const c of this.world.chests) {
        if (Math.hypot(c.x + 0.5 - w.x, c.y + 0.5 - w.y) < 1) { this.autoWalk = { x: c.x + 0.5, y: c.y + 1.4, chest: c.id, t: performance.now() }; return; }
      }
      this.autoWalk = { x: w.x, y: w.y, t: performance.now() };
    });
  }

  // ---------- morte ----------
  showDeath(m) {
    this.hideDeath();
    this.deathEl = h('div', { class: 'dead' }, h('div', { class: 'card' },
      h('h2', {}, 'VOCÊ MORREU'),
      h('p', {}, `Derrotado por ${m.by}.`),
      h('p', { class: 'small' }, `Perdeu ${m.xpLost} XP${m.goldLost ? ` e ${m.goldLost} moedas` : ''}.`),
      h('button', { class: 'btn', onclick: () => this.net.send({ t: 'respawn' }) }, 'Renascer no Templo')));
    ui().append(this.deathEl);
    sfx('die');
  }
  hideDeath() {
    if (this.deathEl) { this.deathEl.remove(); this.deathEl = null; }
  }

  // ---------- mapa / névoa ----------
  buildMapImage() {
    const W = this.world.W, H = this.world.H;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(W, H);
    for (let i = 0; i < W * H; i++) {
      const t = this.world.tiles[i];
      const col = PAL[t]?.[t === T.FOREST ? 1 : 0] || '#000000';
      const n = parseInt(col.slice(1), 16);
      img.data[i * 4] = (n >> 16) & 255; img.data[i * 4 + 1] = (n >> 8) & 255; img.data[i * 4 + 2] = n & 255; img.data[i * 4 + 3] = 255;
    }
    for (const o of this.world.objects) {
      const solid = ['tree', 'autumn', 'pine', 'building', 'fountain', 'tent', 'deadtree', 'cactus'].includes(o.t);
      if (!solid) continue;
      const w = o.w || 1, hh = o.h || 1;
      for (let y = o.y; y < o.y + hh; y++) for (let x = o.x; x < o.x + w; x++) {
        const i = (y * W + x) * 4;
        if (o.t === 'building') { img.data[i] = 200; img.data[i + 1] = 90; img.data[i + 2] = 60; }
        else { img.data[i] *= 0.6; img.data[i + 1] *= 0.7; img.data[i + 2] *= 0.6; }
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }
  fogFor(visited) {
    const key = Object.keys(visited).sort().join(',');
    if (this.fogCache.key === key) return this.fogCache.c;
    const W = this.world.W;
    const c = document.createElement('canvas');
    c.width = c.height = W;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(W, W);
    for (let i = 0; i < W * W; i++) {
      const r = REGIONS[this.world.region[i]];
      if (r.id > 0 && !visited[r.key]) { img.data[i * 4] = 20; img.data[i * 4 + 1] = 12; img.data[i * 4 + 2] = 34; img.data[i * 4 + 3] = 200; }
    }
    ctx.putImageData(img, 0, 0);
    this.fogCache = { key, c };
    return c;
  }

  // ---------- loop ----------
  frame(t) {
    requestAnimationFrame((tt) => this.frame(tt));
    const now = performance.now();
    const dt = Math.min(0.1, (now - (this.lastT || now)) / 1000);
    this.lastT = now;
    if (!this.playing || !this.state.me) {
      if (this.playing) this.renderer.draw(now);
      return;
    }
    const st = this.state;
    // entrada: teclado/joystick ou caminhada automática
    let inp = this.panels.isOpen && this.panels.name !== 'map' ? { dx: 0, dy: 0, run: false } : this.hud.input();
    if (inp.dx || inp.dy) this.autoWalk = null;
    else if (this.autoWalk && !st.self.dead) {
      const aw = this.autoWalk;
      const dx = aw.x - st.self.x, dy = aw.y - st.self.y, d = Math.hypot(dx, dy);
      const npc = aw.npc && NPC_BY_ID[aw.npc];
      if (npc && Math.hypot(npc.x - st.self.x, npc.y - st.self.y) <= NPC_RANGE - 0.3) { this.net.send({ t: 'npc', id: npc.id }); this.autoWalk = null; }
      else if (aw.chest && d < 0.6) { this.net.send({ t: 'chest', id: aw.chest }); this.autoWalk = null; }
      else if (d < 0.25 || now - aw.t > 15000) this.autoWalk = null;
      else inp = { dx: dx / d, dy: dy / d, run: d > 3 };
    }
    if (st.self.dead) inp = { dx: 0, dy: 0, run: false };
    // quantiza em 16 direções para reduzir mensagens e manter predição idêntica ao servidor
    let q = { dx: 0, dy: 0, run: false };
    if (inp.dx || inp.dy) {
      const a = Math.round(Math.atan2(inp.dy, inp.dx) / (Math.PI / 8)) * (Math.PI / 8);
      q = { dx: +Math.cos(a).toFixed(3), dy: +Math.sin(a).toFixed(3), run: inp.run };
    }
    const l = this.lastMv;
    if ((q.dx !== l.dx || q.dy !== l.dy || q.run !== l.run) && now - l.t > 60) {
      this.net.send({ t: 'mv', dx: q.dx, dy: q.dy, run: q.run });
      this.lastMv = { ...q, t: now };
    }
    st.input = { dx: this.lastMv.dx, dy: this.lastMv.dy, run: this.lastMv.run };
    st.predict(dt, now);
    st.interpolate(now);
    this.renderer.draw(now);

    // HUD em ritmo menor
    if (!this.hudT || now - this.hudT > 120) {
      this.hudT = now;
      this.hud.update(st.me, now);
      const tg = st.target ? st.entities.get(st.target) : null;
      this.hud.updateTarget(tg && tg.anim !== ANIM.dead ? tg : null);
      const it = this.nearInteractable();
      this.hud.setTalk(it ? (it.npc ? `Falar: ${it.npc.name.split(',')[0]}` : 'Abrir baú') : null);
      const reg = regionAt(this.world, st.self.x, st.self.y);
      const key = reg.key + (isSafe(this.world, st.self.x, st.self.y) ? 's' : '');
      if (key !== this.region) {
        const first = this.region === null;
        this.region = key;
        const safeHere = isSafe(this.world, st.self.x, st.self.y);
        if (reg.id > 0) this.hud.region(reg.name, reg.pvp && !safeHere, safeHere);
        playMusic(reg.music || 'field');
        void first;
      }
    }
    if (!this.mmT || now - this.mmT > 250) {
      this.mmT = now;
      this.hud.drawMinimap(this.mapImg, st);
      this.hud.net(this.net.status, this.net.rtt);
    }
  }
}

// carrega a arte (Kenney CC0) antes de montar o jogo
loadAssets().then(() => { window.hipe = new App(); });
