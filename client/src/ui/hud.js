// HUD do jogo: barras, joystick virtual, botões de ação/habilidades/poções, minimapa, alvo, chat e avisos.
import { h, ui, fmt } from './dom.js';
import { ABILITIES } from '@hipe/shared/rules.js';
import { MONSTERS } from '@hipe/shared/monsters.js';
import { ITEMS } from '@hipe/shared/items.js';
import { RUN_THRESHOLD } from '@hipe/shared/constants.js';
import { itemIconURL } from '../gfx/sprites/icons.js';

const SKILL_ICON = { whirl: '🌀', warcry: '🛡', pierce: '➶', rain: '☄', fireball: '🔥', heal: '✚' };

export class Hud {
  constructor(app) {
    this.app = app;
    this.el = h('div', { class: 'hud hidden' });
    ui().append(this.el);
    this.build();
    this.joy = { active: false, id: null, ox: 0, oy: 0, dx: 0, dy: 0, run: false };
    this.keys = new Set();
    this.bindKeys();
    this.chatLines = [];
  }

  build() {
    const a = this.app;
    this.hpBar = h('i'); this.hpTxt = h('span');
    this.mpBar = h('i'); this.mpTxt = h('span');
    this.xpBar = h('i');
    this.nameEl = h('span'); this.lvlEl = h('span', { class: 'lv' });
    const status = h('div', { class: 'status pe', onclick: () => a.panels.open('char') },
      h('div', { class: 'nm' }, this.nameEl, this.lvlEl),
      h('div', { class: 'bar hp' }, this.hpBar, this.hpTxt),
      h('div', { class: 'bar mp' }, this.mpBar, this.mpTxt),
      h('div', { class: 'bar xp' }, this.xpBar),
      h('div', { class: 'goldin' }, h('img', { src: itemIconURL('gold') }), (this.goldIn = h('span'))));
    this.goldEl = h('span');
    this.minimap = h('canvas', { class: 'minimap pe', width: 96, height: 96, onclick: () => a.panels.open('map') });
    this.minimap.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.chatBadge = h('span', { class: 'badge hidden' }, '!');
    const topright = h('div', { class: 'topright' },
      h('div', { class: 'gold' }, h('img', { src: itemIconURL('gold') }), this.goldEl),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
        h('button', { class: 'ibtn pe', title: 'Chat', onclick: () => { this.chatBadge.classList.add('hidden'); a.panels.open('chat'); } }, '💬', this.chatBadge),
        h('button', { class: 'ibtn pe', title: 'Menu', onclick: () => a.panels.open('menu') }, '☰')),
      this.minimap);
    this.regionEl = h('div', { class: 'region', style: { opacity: 0 } });
    this.targetName = h('div'); this.targetBar = h('i');
    this.targetEl = h('div', { class: 'target pe hidden' }, this.targetName, h('div', { class: 'bar hp' }, this.targetBar),
      h('button', { class: 'x', onclick: () => a.setTarget(0) }, '✕'));
    const bottombar = h('div', { class: 'bottombar' },
      h('button', { class: 'ibtn pe', title: 'Inventário', onclick: () => a.panels.open('inv') }, '🎒'),
      h('button', { class: 'ibtn pe', title: 'Personagem', onclick: () => a.panels.open('char') }, '👤'),
      h('button', { class: 'ibtn pe', title: 'Missões', onclick: () => a.panels.open('quests') }, '📜'),
      h('button', { class: 'ibtn pe', title: 'Mapa', onclick: () => a.panels.open('map') }, '🗺'),
      h('button', { class: 'ibtn pe', title: 'Ranking', onclick: () => a.panels.open('rank') }, '🏆'));
    this.chatlog = h('div', { class: 'chatlog' });
    this.toasts = h('div', { class: 'toasts' });
    this.netEl = h('div', { class: 'net hidden' }, 'Reconectando...');
    this.pingEl = h('div', { class: 'ping' });

    // joystick
    this.joyEl = h('div', { class: 'joy hidden' }, h('div', { class: 'knob' }));
    this.joyzone = h('div', { class: 'joyzone pe' });
    this.bindJoystick();

    // ações
    this.skillBtns = [0, 1].map((i) => {
      const b = h('button', { class: `abtn skill s${i} pe`, onpointerdown: (e) => { e.preventDefault(); a.useSkill(i); } });
      b.addEventListener('click', (e) => e.preventDefault());
      return b;
    });
    this.hpPot = h('button', { class: 'abtn pot hp pe', onpointerdown: (e) => { e.preventDefault(); a.quickPotion('hp'); } });
    this.mpPot = h('button', { class: 'abtn pot mp pe', onpointerdown: (e) => { e.preventDefault(); a.quickPotion('mp'); } });
    this.talkBtn = h('button', { class: 'abtn talk pe hidden', onpointerdown: (e) => { e.preventDefault(); a.interact(); } }, 'Falar');
    const attack = h('button', { class: 'abtn attack pe', onpointerdown: (e) => { e.preventDefault(); a.attackNearest(); } }, '⚔');
    const actions = h('div', { class: 'actions' }, attack, ...this.skillBtns, this.hpPot, this.mpPot, this.talkBtn);

    this.el.append(this.joyzone, this.joyEl, status, topright, this.regionEl, this.targetEl, bottombar, this.chatlog, this.toasts, actions, this.netEl, this.pingEl);
  }

  show(on) {
    this.el.classList.toggle('hidden', !on);
  }

  bindJoystick() {
    const z = this.joyzone, j = this.joy;
    const knob = () => this.joyEl.firstChild;
    const R = () => this.joyEl.offsetWidth / 2 || 60;
    z.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (j.active) return;
      j.active = true; j.id = e.pointerId; j.ox = e.clientX; j.oy = e.clientY;
      this.joyEl.style.left = e.clientX + 'px'; this.joyEl.style.top = e.clientY + 'px';
      this.joyEl.classList.remove('hidden');
      z.setPointerCapture(e.pointerId);
      this.app.cancelAutoWalk();
    });
    z.addEventListener('pointermove', (e) => {
      if (!j.active || e.pointerId !== j.id) return;
      let dx = e.clientX - j.ox, dy = e.clientY - j.oy;
      const r = R();
      const len = Math.hypot(dx, dy);
      if (len > r) { dx = (dx / len) * r; dy = (dy / len) * r; }
      knob().style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      const mag = Math.min(1, len / r);
      if (mag < 0.18) { j.dx = 0; j.dy = 0; j.run = false; }
      else { j.dx = dx / r; j.dy = dy / r; j.run = mag > RUN_THRESHOLD; }
    });
    const end = (e) => {
      if (e.pointerId !== j.id) return;
      j.active = false; j.dx = 0; j.dy = 0; j.run = false;
      knob().style.transform = 'translate(-50%, -50%)';
      this.joyEl.classList.add('hidden');
    };
    z.addEventListener('pointerup', end);
    z.addEventListener('pointercancel', end);
  }

  bindKeys() {
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      this.keys.add(e.key.toLowerCase());
      const a = this.app;
      switch (e.key.toLowerCase()) {
        case ' ': a.attackNearest(); e.preventDefault(); break;
        case '1': a.useSkill(0); break;
        case '2': a.useSkill(1); break;
        case 'q': a.quickPotion('hp'); break;
        case 'e': a.quickPotion('mp'); break;
        case 'f': a.interact(); break;
        case 'i': a.panels.toggle('inv'); break;
        case 'c': a.panels.toggle('char'); break;
        case 'm': a.panels.toggle('map'); break;
        case 'j': a.panels.toggle('quests'); break;
        case 'enter': a.panels.open('chat'); break;
        case 'escape': a.panels.close(); break;
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  // vetor de movimento atual (joystick ou teclado)
  input() {
    const k = this.keys;
    let dx = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
    let dy = (k.has('s') || k.has('arrowdown') ? 1 : 0) - (k.has('w') || k.has('arrowup') ? 1 : 0);
    if (dx || dy) {
      const l = Math.hypot(dx, dy);
      return { dx: dx / l, dy: dy / l, run: !k.has('shift') };
    }
    return { dx: this.joy.dx, dy: this.joy.dy, run: this.joy.run };
  }

  update(me, now) {
    if (!me) return;
    this.nameEl.textContent = me.name;
    this.lvlEl.textContent = `Nv. ${me.level}`;
    const hp = Math.max(0, me.hp), mp = Math.max(0, me.mp);
    this.hpBar.style.width = `${(hp / me.mhp) * 100}%`;
    this.hpTxt.textContent = `${fmt(hp)} / ${fmt(me.mhp)}`;
    this.mpBar.style.width = `${(mp / me.mmp) * 100}%`;
    this.mpTxt.textContent = `${fmt(mp)} / ${fmt(me.mmp)}`;
    this.xpBar.style.width = `${Math.min(100, (me.xp / me.xpNext) * 100)}%`;
    this.goldEl.textContent = fmt(me.gold);
    this.goldIn.textContent = fmt(me.gold);
    // habilidades do estilo da arma equipada
    const style = me.derived?.style || 'melee';
    ABILITIES[style].forEach((ab, i) => {
      const b = this.skillBtns[i];
      const locked = (me.skills?.[style]?.lv || 1) < ab.unlock;
      const cdLeft = Math.max(0, (this.app.cds[ab.key] || 0) - now);
      const sig = `${ab.key}|${locked}|${Math.ceil(cdLeft / 1000)}`;
      if (b._sig === sig) return;
      b._sig = sig;
      b.className = `abtn skill s${i} pe${locked ? ' locked' : ''}`;
      b.innerHTML = '';
      b.append(SKILL_ICON[ab.key] || '★');
      b.title = `${ab.name} (${ab.mp} MP)`;
      if (cdLeft > 0) b.append(h('span', { class: 'cd' }, Math.ceil(cdLeft / 1000)));
    });
    const count = (pre) => (me.inv || []).reduce((s, it) => s + (it && it.k.startsWith(pre) ? it.q : 0), 0);
    const hc = count('hp_potion'), mc = count('mp_potion');
    if (this.hpPot._c !== hc) { this.hpPot._c = hc; this.hpPot.innerHTML = ''; this.hpPot.append(h('img', { src: itemIconURL('hp_potion_s') }), h('span', { class: 'cnt' }, hc)); }
    if (this.mpPot._c !== mc) { this.mpPot._c = mc; this.mpPot.innerHTML = ''; this.mpPot.append(h('img', { src: itemIconURL('mp_potion_s') }), h('span', { class: 'cnt' }, mc)); }
  }

  updateTarget(e) {
    if (!e) { this.targetEl.classList.add('hidden'); return; }
    this.targetEl.classList.remove('hidden');
    if (e.k === 'm') {
      const d = MONSTERS[e.m];
      this.targetName.textContent = `${d.name} • Nv. ${d.lvl}`;
    } else this.targetName.textContent = `${e.name} • Nv. ${e.lvl}${e.skull ? ' ☠' : ''}`;
    this.targetBar.style.width = `${e.hp}%`;
  }

  setTalk(label) {
    this.talkBtn.classList.toggle('hidden', !label);
    if (label && this.talkBtn.textContent !== label) this.talkBtn.textContent = label;
  }

  region(name, pvp, safe) {
    this.regionEl.innerHTML = '';
    this.regionEl.append(name, safe ? h('small', { style: { color: '#9aff9a' } }, '✓ Zona segura')
      : pvp ? h('small', {}, '⚔ Zona PvP — cuidado!') : h('small', { style: { color: '#ffe08a' } }, 'Monstros • PvP desativado'));
    this.regionEl.style.opacity = 1;
    clearTimeout(this._regT);
    this._regT = setTimeout(() => { this.regionEl.style.opacity = 0; }, 2800);
  }

  toast(m, kind = 'info') {
    const t = h('div', { class: `toast ${kind}` }, m);
    this.toasts.append(t);
    while (this.toasts.children.length > 4) this.toasts.firstChild.remove();
    setTimeout(() => t.remove(), kind === 'lvl' || kind === 'ach' ? 4500 : 2800);
  }

  chat(line, cls) {
    const d = h('div', { class: cls }, line);
    this.chatlog.append(d);
    while (this.chatlog.children.length > 5) this.chatlog.firstChild.remove();
    setTimeout(() => d.remove(), 15000);
  }

  net(status, ping) {
    this.netEl.classList.toggle('hidden', status === 'online');
    this.netEl.textContent = status === 'reconnecting' ? 'Conexão perdida — reconectando...' : 'Conectando...';
    if (ping != null) this.pingEl.textContent = `${Math.round(ping)} ms`;
  }

  drawMinimap(mapImg, state) {
    const c = this.minimap, ctx = c.getContext('2d');
    const s = state.self, R = 24;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#1f4790';
    ctx.fillRect(0, 0, 96, 96);
    ctx.drawImage(mapImg, s.x - R, s.y - R, R * 2, R * 2, 0, 0, 96, 96);
    const dot = (x, y, col, sz = 3) => {
      const px = (x - s.x + R) * 2, py = (y - s.y + R) * 2;
      if (px < 0 || py < 0 || px > 96 || py > 96) return;
      ctx.fillStyle = col; ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz);
    };
    for (const e of state.entities.values()) {
      if (e.k === 'm') dot(e.rx, e.ry, MONSTERS[e.m]?.boss ? '#ff00ff' : '#ff4a3a', 2.5);
      else if (e.k === 'p') dot(e.rx, e.ry, e.skull ? '#ff8080' : '#ffffff', 3);
    }
    for (const n of this.app.renderer.npcs) dot(n.x, n.y, '#ffe060', 3);
    dot(s.x, s.y, '#5affff', 4);
  }
}

export { ITEMS };
