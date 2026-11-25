// Painéis do jogo: inventário/equipamento, personagem, missões, mapa, chat, NPC (loja/banco/missões/cura),
// ranking/online e menu. Todas as ações viram mensagens validadas pelo servidor.
import { h, ui, clear, fmt } from './dom.js';
import { ITEMS, RARITY, BONUS_TYPES, itemStats, sellPrice } from '@hipe/shared/items.js';
import { CLASSES, STYLES, ABILITIES } from '@hipe/shared/rules.js';
import { QUESTS, ACHIEVEMENTS } from '@hipe/shared/quests.js';
import { REGIONS } from '@hipe/shared/regions.js';
import { MONSTERS } from '@hipe/shared/monsters.js';
import { EQUIP_SLOTS, INV_SIZE } from '@hipe/shared/constants.js';
import { CX, CY } from '@hipe/shared/mapgen.js';
import { itemIconURL } from '../gfx/sprites/icons.js';
import { humanoidFrame, playerOpts, HW, HH } from '../gfx/sprites/humanoid.js';
import { audioSettings, setMusic, setSfx } from '../audio.js';

const SLOT_NAMES = { weapon: 'Arma', shield: 'Escudo', helmet: 'Elmo', armor: 'Armadura', boots: 'Botas', ring: 'Anel' };
const CAT_NAMES = { sword: 'Espada', bow: 'Arco', staff: 'Cajado', shield: 'Escudo', helmet: 'Capacete', armor: 'Armadura', boots: 'Botas', ring: 'Anel', potion: 'Poção', material: 'Material', gold: 'Moedas' };
const STAT_NAMES = { atk: 'Ataque', def: 'Defesa', hp: 'Vida', mp: 'Mana', move: '% Movimento', crit: '% Crítico' };

function slotEl(it, extra = {}, label = '') {
  const cls = `slot${it ? ' r' + (it.r || 0) : ''}${extra.sel ? ' sel' : ''}`;
  return h('div', { class: cls, onclick: extra.onclick },
    label && !it ? h('span', { class: 'lbl' }, label) : null,
    it ? h('img', { src: itemIconURL(it.k), draggable: 'false' }) : null,
    it && it.q > 1 ? h('span', { class: 'q' }, it.q) : null);
}

export function itemInfo(it, me) {
  const d = ITEMS[it.k];
  const r = RARITY[it.r || 0];
  const lines = [];
  const st = itemStats(it);
  for (const [k, v] of Object.entries(st)) if (v && STAT_NAMES[k] && !(it.b && it.b[k] && !d[k])) lines.push(`${STAT_NAMES[k]}: ${v}`);
  const bonus = it.b ? Object.entries(it.b).map(([k, v]) => BONUS_TYPES[k]?.fmt(v)) : [];
  return h('div', {},
    h('h4', { style: { color: d.slot ? r.color : '#fff' } }, d.name, it.q > 1 ? ` x${it.q}` : ''),
    h('div', { class: 'small' }, `${CAT_NAMES[d.cat] || ''}${d.slot ? ` • ${r.name}` : ''}${d.lvl ? ` • Nível ${d.lvl}` : ''}${d.twoHanded ? ' • Duas mãos' : ''}`),
    d.lvl && me && me.level < d.lvl ? h('div', { style: { color: '#ff8a8a' } }, `Requer nível ${d.lvl}`) : null,
    lines.map((l) => h('div', {}, l)),
    bonus.map((b) => h('div', { style: { color: '#7cff8a' } }, b)),
    d.heal ? h('div', {}, `Recupera ${d.heal} de vida`) : null,
    d.mana ? h('div', {}, `Recupera ${d.mana} de mana`) : null,
    d.cat !== 'gold' ? h('div', { class: 'small' }, `Valor de venda: ${sellPrice(it)} moedas`) : null);
}

export class Panels {
  constructor(app) {
    this.app = app;
    this.el = null;
    this.name = null;
    this.sel = null; // { list: 'inv'|'equip'|'bank', i }
    this.npc = null;
    this.tab = {};
    this.chatHistory = [];
    this.rankData = {};
  }

  get isOpen() { return !!this.el; }

  toggle(name) {
    if (this.name === name) this.close();
    else this.open(name);
  }

  open(name, data) {
    this.name = name;
    if (data !== undefined) this.data = data;
    if (name !== 'npc') this.npc = null;
    if (name === 'rank') { this.app.net.send({ t: 'rank', kind: this.tab.rank === 'pvp' ? 'pvp' : 'level' }); this.app.net.send({ t: 'online' }); }
    this.render();
  }

  close() {
    if (this.el) this.el.remove();
    this.el = null;
    this.name = null;
    this.npc = null;
    this.sel = null;
  }

  refresh() {
    if (this.el && this.name !== 'chat') this.render();
  }

  frame(tabs, body, narrow = false) {
    const head = h('div', { class: 'phead' },
      tabs.map(([k, label]) => h('button', { class: 'tab' + ((this.tab[this.name] || tabs[0][0]) === k ? ' on' : ''), onclick: () => { this.tab[this.name] = k; this.sel = null; if (this.name === 'rank') this.open('rank'); else this.render(); } }, label)),
      h('button', { class: 'close', onclick: () => this.close() }, '✕'));
    return h('div', { class: 'modal', onpointerdown: (e) => { if (e.target === e.currentTarget) this.close(); } },
      h('div', { class: 'panel' + (narrow ? ' narrow' : '') }, head, h('div', { class: 'pbody' }, body)));
  }

  render() {
    const me = this.app.state.me;
    if (!me) return;
    const scroll = this.el?.querySelector('.pbody')?.scrollTop || 0;
    let node;
    switch (this.name) {
      case 'inv': node = this.inventory(me); break;
      case 'char': node = this.character(me); break;
      case 'quests': node = this.quests(me); break;
      case 'map': node = this.map(me); break;
      case 'chat': node = this.chat(); break;
      case 'npc': node = this.npcPanel(me); break;
      case 'rank': node = this.ranking(me); break;
      case 'menu': node = this.menu(me); break;
      default: return;
    }
    if (this.el) this.el.replaceWith(node); else ui().append(node);
    this.el = node;
    const pb = node.querySelector('.pbody');
    if (pb) pb.scrollTop = scroll;
  }

  // ---------- inventário ----------
  selectedItem(me) {
    if (!this.sel) return null;
    if (this.sel.list === 'inv') return me.inv[this.sel.i];
    if (this.sel.list === 'equip') return me.equip[this.sel.i];
    if (this.sel.list === 'bank') return this.npc?.bank?.[this.sel.i];
    return null;
  }

  invGrid(me, onPick) {
    return h('div', { class: 'grid' }, me.inv.map((it, i) => slotEl(it, {
      sel: this.sel?.list === 'inv' && this.sel.i === i,
      onclick: () => onPick(i, it),
    })));
  }

  pickInv(me, i, it) {
    // tocar em outro slot com um item selecionado move/troca de lugar (organizar)
    if (this.sel?.list === 'inv' && this.sel.i !== i && me.inv[this.sel.i]) {
      this.app.net.send({ t: 'swap', a: this.sel.i, b: i });
      this.sel = null;
      return this.render();
    }
    this.sel = it ? { list: 'inv', i } : null;
    this.render();
  }

  itemActions(me, it) {
    const net = this.app.net;
    const d = ITEMS[it.k];
    const acts = [];
    if (this.sel.list === 'inv') {
      const i = this.sel.i;
      if (d.cat === 'potion') acts.push(h('button', { class: 'btn green sm', onclick: () => net.send({ t: 'use', slot: i }) }, 'Usar'));
      if (d.slot) acts.push(h('button', { class: 'btn sm', onclick: () => { net.send({ t: 'equip', slot: i }); this.sel = null; } }, 'Equipar'));
      if (this.npc?.role === 'shop') {
        acts.push(h('button', { class: 'btn sm', onclick: () => { net.send({ t: 'sell', npc: this.npc.id, slot: i, q: 1 }); } }, `Vender 1 (${sellPrice(it)})`));
        if (it.q > 1) acts.push(h('button', { class: 'btn sm', onclick: () => { net.send({ t: 'sell', npc: this.npc.id, slot: i, q: it.q }); this.sel = null; } }, `Vender todos (${sellPrice(it) * it.q})`));
      }
      if (this.npc?.role === 'bank') acts.push(h('button', { class: 'btn sm', onclick: () => { net.send({ t: 'bank', op: 'dep', slot: i }); this.sel = null; } }, 'Depositar'));
      acts.push(h('button', { class: 'btn red sm', onclick: () => {
        if (d.slot && (it.r || 0) >= 2 && !confirm(`Descartar ${d.name}?`)) return;
        net.send({ t: 'drop', slot: i, q: it.q }); this.sel = null;
      } }, 'Descartar'));
    } else if (this.sel.list === 'equip') {
      acts.push(h('button', { class: 'btn sm', onclick: () => { net.send({ t: 'unequip', slot: this.sel.i }); this.sel = null; } }, 'Desequipar'));
    } else if (this.sel.list === 'bank') {
      acts.push(h('button', { class: 'btn sm', onclick: () => { net.send({ t: 'bank', op: 'wd', slot: this.sel.i }); this.sel = null; } }, 'Sacar'));
    }
    return h('div', { class: 'acts' }, acts);
  }

  dollCanvas(me) {
    const c = h('canvas', { width: HW, height: HH });
    const eq = {};
    for (const [k, v] of Object.entries(me.equip)) if (v) eq[k] = v.k;
    c.getContext('2d').drawImage(humanoidFrame(playerOpts(me.look, eq), 0, 'idle', 0), 0, 0);
    return c;
  }

  inventory(me) {
    const it = this.selectedItem(me);
    const eqSlot = (s) => slotEl(me.equip[s], { sel: this.sel?.list === 'equip' && this.sel.i === s, onclick: () => { this.sel = me.equip[s] ? { list: 'equip', i: s } : null; this.render(); } }, SLOT_NAMES[s]);
    const used = me.inv.filter(Boolean).length;
    const left = h('div', {},
      h('div', { class: 'equip' },
        eqSlot('helmet'), h('div', { class: 'doll' }, this.dollCanvas(me)), eqSlot('ring'),
        eqSlot('weapon'), eqSlot('shield'),
        eqSlot('armor'), eqSlot('boots')),
      h('div', { class: 'stats' },
        'Ataque', h('b', {}, me.derived.atk), 'Defesa', h('b', {}, me.derived.def),
        'Crítico', h('b', {}, `${me.derived.crit}%`), 'Vel. ataque', h('b', {}, `${(1000 / me.derived.atkCd).toFixed(2)}/s`),
        'Estilo', h('b', {}, STYLES[me.derived.style].name), 'Alcance', h('b', {}, `${me.derived.range} tiles`)));
    const right = h('div', {},
      h('div', { class: 'row', style: { marginBottom: '6px' } },
        h('span', { class: 'grow small' }, `Inventário ${used}/${INV_SIZE} — toque em um item e depois em outro slot para mover`),
        h('button', { class: 'btn alt sm', onclick: () => this.app.net.send({ t: 'sort' }) }, 'Organizar')),
      this.invGrid(me, (i, x) => this.pickInv(me, i, x)),
      it ? h('div', { class: 'tip' }, itemInfo(it, me), this.itemActions(me, it)) : h('div', { class: 'tip small' }, 'Toque em um item para ver detalhes e ações.'));
    return this.frame([['inv', 'Equipamento & Inventário']], h('div', { class: 'cols' }, left, right));
  }

  // ---------- personagem ----------
  character(me) {
    const net = this.app.net;
    const attr = (k, label, desc) => h('div', { class: 'attrrow' },
      h('div', {}, h('b', {}, `${label}: ${me.attrs[k]}`), h('div', { class: 'small' }, desc)),
      me.points > 0 ? h('button', { class: 'btn green', onclick: () => net.send({ t: 'attr', a: k }) }, '+') : null);
    const skill = (k) => {
      const s = me.skills[k];
      return h('div', { class: 'skillrow' },
        h('div', { class: 'row' }, h('b', { class: 'grow' }, `${STYLES[k].name}`), h('span', {}, `Nível ${s.lv}`)),
        h('div', { class: 'bar xp' }, h('i', { style: { width: `${(s.xp / s.next) * 100}%` } })),
        h('div', { class: 'small' }, ABILITIES[k].map((a) => `${a.name} (nv ${a.unlock}, ${a.mp} MP): ${a.desc}`).join(' • ')));
    };
    const st = me.stats;
    const left = h('div', {},
      h('div', { class: 'row' }, this.dollCanvas(me), h('div', {},
        h('h3', { style: { margin: '0' } }, me.name),
        h('div', { class: 'small' }, `${CLASSES[me.cls].name} • Nível ${me.level}`),
        h('div', { class: 'small' }, `XP: ${fmt(me.xp)} / ${fmt(me.xpNext)}`),
        me.skull ? h('div', { style: { color: '#ff7a7a' } }, `☠ Caveira PvP: ${me.skull}s`) : null)),
      h('h4', {}, `Atributos ${me.points > 0 ? `(${me.points} pontos livres)` : ''}`),
      attr('str', 'Força', 'Dano corpo a corpo'),
      attr('dex', 'Destreza', 'Dano à distância, crítico e velocidade'),
      attr('int', 'Intelecto', 'Dano mágico, mana e cura'),
      attr('vit', 'Vitalidade', 'Vida, defesa e regeneração'));
    const right = h('div', {},
      h('h4', { style: { marginTop: 0 } }, 'Habilidades de combate (independentes)'),
      skill('melee'), skill('distance'), skill('magic'),
      h('div', { class: 'stats' },
        'Vida', h('b', {}, `${fmt(me.hp)}/${fmt(me.mhp)}`), 'Mana', h('b', {}, `${fmt(me.mp)}/${fmt(me.mmp)}`),
        'Monstros derrotados', h('b', {}, fmt(st.kills)), 'Mortes', h('b', {}, st.deaths),
        'Abates PvP', h('b', {}, st.pvpKills), 'Rating PvP', h('b', {}, st.rating),
        'Missões concluídas', h('b', {}, st.questsDone)));
    return this.frame([['char', 'Personagem']], h('div', { class: 'cols' }, left, right));
  }

  // ---------- missões & conquistas ----------
  quests(me) {
    const tab = this.tab.quests || 'active';
    let body;
    if (tab === 'active') {
      const act = Object.entries(me.quests.active);
      body = h('div', { class: 'list' },
        act.length ? act.map(([id, st]) => {
          const q = QUESTS[id];
          if (!q) return null;
          let prog = '';
          if (q.type === 'hunt') prog = `${st.n}/${q.count} ${q.target ? MONSTERS[q.target].name : 'monstros'}`;
          else if (q.type === 'collect') prog = `${Math.min(q.count, me.inv.reduce((s, it) => s + (it?.k === q.target ? it.q : 0), 0))}/${q.count} ${ITEMS[q.target].name}`;
          else prog = q.targets.map((t) => `${(st.seen || []).includes(t) ? '✓' : '○'} ${t.startsWith('chest:') ? 'Baú secreto' : REGIONS.find((r) => r.key === t)?.name}`).join('  ');
          return h('div', { class: 'qitem' },
            h('h4', {}, q.name, q.daily ? h('span', { class: 'pill' }, 'Diária') : null),
            h('p', {}, q.desc), h('div', {}, prog),
            h('div', { class: 'rw' }, `Recompensa: ${fmt(q.reward.xp)} XP, ${fmt(q.reward.gold)} moedas${q.reward.item ? ', ' + ITEMS[q.reward.item].name : ''}`),
            h('div', { class: 'small' }, `Entregar a: ${this.app.npcName(q.giver)}`),
            h('button', { class: 'btn red sm', style: { marginTop: '6px' }, onclick: () => { if (confirm('Abandonar missão?')) this.app.net.send({ t: 'qabandon', id }); } }, 'Abandonar'));
        }) : h('div', { class: 'small' }, 'Nenhuma missão ativa. Fale com a Capitã Lyra (!) na praça da vila.'));
    } else {
      body = h('div', { class: 'list' }, Object.entries(ACHIEVEMENTS).map(([k, a]) =>
        h('div', { class: 'ach' + (me.ach[k] ? '' : ' off') }, h('span', { style: { fontSize: '24px' } }, me.ach[k] ? '🏆' : '🔒'),
          h('div', {}, h('b', {}, a.name), h('div', { class: 'small' }, a.desc + (a.gold ? ` (+${fmt(a.gold)} moedas)` : ''))))));
    }
    return this.frame([['active', 'Missões'], ['ach', 'Conquistas']], body, true);
  }

  // ---------- mapa ----------
  map(me) {
    const W = this.app.world.W;
    const c = h('canvas', { width: W * 2, height: W * 2 });
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.app.mapImg, 0, 0, W * 2, W * 2);
    // névoa nas regiões ainda não visitadas
    const fog = this.app.fogFor(me.visited);
    ctx.drawImage(fog, 0, 0, W * 2, W * 2);
    ctx.font = 'bold 13px Trebuchet MS';
    ctx.textAlign = 'center';
    const labels = { town: [0, 0], forest: [0, 32], goblin: [80, 0], desert: [40, 72], volcano: [-40, 72], cave: [-80, 0], frozen: [-40, -72], dungeon: [40, -72] };
    for (const r of REGIONS) {
      const l = labels[r.key];
      if (!l) continue;
      const x = (CX + l[0]) * 2, y = (CY + l[1]) * 2;
      ctx.lineWidth = 3; ctx.strokeStyle = '#1a1020'; ctx.fillStyle = me.visited[r.key] ? '#fff3c0' : '#9a8aaa';
      const label = me.visited[r.key] ? r.name : '???';
      ctx.strokeText(label, x, y); ctx.fillText(label, x, y);
      if (r.levels && me.visited[r.key]) { ctx.font = '11px Trebuchet MS'; ctx.strokeText(`Nv ${r.levels[0]}-${r.levels[1]}${r.pvp ? ' • PvP' : ''}`, x, y + 13); ctx.fillText(`Nv ${r.levels[0]}-${r.levels[1]}${r.pvp ? ' • PvP' : ''}`, x, y + 13); ctx.font = 'bold 13px Trebuchet MS'; }
    }
    for (const n of this.app.renderer.npcs) { ctx.fillStyle = '#ffe060'; ctx.fillRect(n.x * 2 - 2, n.y * 2 - 2, 4, 4); }
    const s = this.app.state.self;
    ctx.fillStyle = '#5affff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(s.x * 2, s.y * 2, 5, 0, 7); ctx.fill(); ctx.stroke();
    return this.frame([['map', 'Mapa do Mundo']], h('div', {}, h('div', { class: 'mapwrap' }, c),
      h('div', { class: 'small', style: { textAlign: 'center', marginTop: '6px' } }, 'Você: ponto ciano • NPCs: amarelo • Regiões desconhecidas aparecem com névoa')));
  }

  // ---------- chat ----------
  chat() {
    const tab = this.tab.chat || 'g';
    const msgs = h('div', { class: 'chatmsgs' }, this.chatHistory.filter((m) => tab === 'all' || m.ch === tab || m.ch === 'sys' || (tab === 'g' && m.ch === 'pvp')).slice(-120).map((m) => h('div', { class: 'c-' + m.ch }, m.text)));
    const to = h('input', { class: 't', placeholder: 'Para (nome)', style: { width: '34%' }, value: this.pmTarget || '' });
    const input = h('input', { class: 't grow', maxlength: 140, placeholder: tab === 'p' ? 'Mensagem privada...' : tab === 'l' ? 'Falar com quem está perto...' : 'Mensagem para todos...' });
    const send = () => {
      const m = input.value.trim();
      if (!m) return;
      if (tab === 'p') { this.pmTarget = to.value.trim(); this.app.net.send({ t: 'pm', to: this.pmTarget, m }); }
      else this.app.net.send({ t: 'chat', ch: tab, m });
      input.value = '';
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); e.stopPropagation(); });
    setTimeout(() => { msgs.scrollTop = msgs.scrollHeight; }, 0);
    this.chatMsgsEl = msgs;
    return this.frame([['g', 'Global'], ['l', 'Local'], ['p', 'Privado']], h('div', { class: 'chatbox' }, msgs,
      h('div', { class: 'row', style: { marginTop: '8px' } }, tab === 'p' ? to : null, input, h('button', { class: 'btn', onclick: send }, 'Enviar'))));
  }

  addChat(ch, text) {
    this.chatHistory.push({ ch, text });
    if (this.chatHistory.length > 300) this.chatHistory.shift();
    if (this.name === 'chat' && this.chatMsgsEl) {
      const tab = this.tab.chat || 'g';
      if (ch === tab || ch === 'sys' || (tab === 'g' && ch === 'pvp')) {
        this.chatMsgsEl.append(h('div', { class: 'c-' + ch }, text));
        this.chatMsgsEl.scrollTop = this.chatMsgsEl.scrollHeight;
      }
    }
  }

  // ---------- NPC ----------
  openNpc(data) {
    this.npc = data;
    this.name = 'npc';
    this.sel = null;
    this.render();
  }

  npcPanel(me) {
    const n = this.npc;
    const net = this.app.net;
    const greet = h('div', { class: 'qitem' }, h('b', {}, n.name), h('p', {}, `“${n.greet}”`));
    let body;
    if (n.role === 'healer') {
      body = h('div', {}, greet, h('button', { class: 'btn green', onclick: () => net.send({ t: 'heal' }) }, '✚ Restaurar vida e mana (grátis)'));
    } else if (n.role === 'shop') {
      const tab = this.tab.npc || 'buy';
      if (tab === 'buy') {
        body = h('div', { class: 'list' }, greet, n.shop.items.map((s) => {
          const d = ITEMS[s.k];
          const it = { k: s.k, q: 1, r: 0 };
          return h('div', { class: 'shoprow' }, h('img', { src: itemIconURL(s.k) }),
            h('div', { class: 'nm' }, h('b', {}, d.name), h('div', { class: 'small' }, d.slot ? Object.entries(itemStats(it)).map(([k, v]) => `${STAT_NAMES[k]} ${v}`).join(' • ') + ` • Nv ${d.lvl}` : d.heal ? `+${d.heal} vida` : d.mana ? `+${d.mana} mana` : '')),
            h('span', { class: 'pr' }, fmt(s.price)),
            h('button', { class: 'btn sm', disabled: me.gold < s.price ? true : null, onclick: () => net.send({ t: 'buy', npc: n.id, k: s.k, q: 1 }) }, 'x1'),
            d.stack ? h('button', { class: 'btn sm', disabled: me.gold < s.price * 10 ? true : null, onclick: () => net.send({ t: 'buy', npc: n.id, k: s.k, q: 10 }) }, 'x10') : null);
        }));
      } else {
        const it = this.selectedItem(me);
        body = h('div', {}, h('div', { class: 'small' }, 'Toque em um item para vendê-lo.'), this.invGrid(me, (i, x) => { this.sel = x ? { list: 'inv', i } : null; this.render(); }),
          it ? h('div', { class: 'tip' }, itemInfo(it, me), this.itemActions(me, it)) : null);
      }
      return this.frame([['buy', n.shop.name], ['sell', 'Vender']], body);
    } else if (n.role === 'bank') {
      const it = this.selectedItem(me);
      body = h('div', {}, greet, h('div', { class: 'cols' },
        h('div', {}, h('h4', {}, 'Seu inventário'), this.invGrid(me, (i, x) => { this.sel = x ? { list: 'inv', i } : null; this.render(); })),
        h('div', {}, h('h4', {}, `Cofre (${(n.bank || []).filter(Boolean).length}/${(n.bank || []).length})`),
          h('div', { class: 'grid' }, (n.bank || []).map((b, i) => slotEl(b, { sel: this.sel?.list === 'bank' && this.sel.i === i, onclick: () => { this.sel = b ? { list: 'bank', i } : null; this.render(); } }))))),
      it ? h('div', { class: 'tip' }, itemInfo(it, me), this.itemActions(me, it)) : null);
    } else if (n.role === 'quest') {
      body = h('div', { class: 'list' }, greet, (n.quests || []).map((q) => h('div', { class: 'qitem' },
        h('h4', {}, q.name, h('span', { class: 'pill ' + q.status }, { available: 'Disponível', active: `Em andamento ${q.progress ?? ''}/${q.count}`, ready: 'Concluída!', done: q.daily ? 'Feita hoje' : 'Finalizada', locked: q.why || 'Bloqueada' }[q.status])),
        h('p', {}, q.desc),
        h('div', { class: 'rw' }, `${fmt(q.reward.xp)} XP • ${fmt(q.reward.gold)} moedas${q.reward.item ? ' • ' + ITEMS[q.reward.item].name : ''}`),
        q.status === 'available' ? h('button', { class: 'btn sm', style: { marginTop: '6px' }, onclick: () => net.send({ t: 'qaccept', npc: n.id, id: q.id }) }, 'Aceitar') : null,
        q.status === 'ready' ? h('button', { class: 'btn green sm', style: { marginTop: '6px' }, onclick: () => net.send({ t: 'qturn', npc: n.id, id: q.id }) }, 'Entregar') : null)));
    }
    return this.frame([['npc', n.name]], body, n.role !== 'bank');
  }

  // ---------- ranking ----------
  ranking(me) {
    const tab = this.tab.rank || 'level';
    let body;
    if (tab === 'online') {
      const list = this.rankData.online || [];
      body = h('table', { class: 'rank' }, h('tr', {}, h('th', {}, 'Jogador'), h('th', {}, 'Nível'), h('th', {}, 'Região'), h('th', {}, '')),
        list.map((p) => h('tr', { class: p.name === me.name ? 'me' : '' }, h('td', {}, p.name), h('td', {}, p.lvl), h('td', {}, p.reg),
          h('td', {}, p.name !== me.name ? h('button', { class: 'btn alt sm', onclick: () => { this.pmTarget = p.name; this.tab.chat = 'p'; this.open('chat'); } }, 'Msg') : null))));
      body = h('div', {}, h('div', { class: 'small' }, `${list.length} jogador(es) online agora`), body);
    } else {
      const rows = this.rankData[tab] || [];
      body = h('table', { class: 'rank' },
        h('tr', {}, h('th', {}, '#'), h('th', {}, 'Nome'), h('th', {}, 'Classe'), h('th', {}, tab === 'pvp' ? 'Rating' : 'Nível'), tab === 'pvp' ? h('th', {}, 'Abates') : null),
        rows.map((r, i) => h('tr', { class: r.name === me.name ? 'me' : '' }, h('td', {}, i + 1), h('td', {}, r.name), h('td', {}, CLASSES[r.cls]?.name || r.cls),
          h('td', {}, tab === 'pvp' ? r.rating : r.level), tab === 'pvp' ? h('td', {}, r.pvp_kills) : null)));
      if (!rows.length) body = h('div', { class: 'small' }, 'Carregando...');
    }
    return this.frame([['level', 'Ranking de Níveis'], ['pvp', 'Ranking PvP'], ['online', 'Online']], body, true);
  }

  // ---------- menu ----------
  menu(me) {
    const s = audioSettings();
    return this.frame([['menu', 'Menu']], h('div', { class: 'list' },
      h('div', { class: 'attrrow' }, h('b', {}, 'Música'), h('button', { class: 'btn sm ' + (s.music ? 'green' : 'alt'), onclick: () => { setMusic(!s.music); this.render(); } }, s.music ? 'Ligada' : 'Desligada')),
      h('div', { class: 'attrrow' }, h('b', {}, 'Efeitos sonoros'), h('button', { class: 'btn sm ' + (s.sfx ? 'green' : 'alt'), onclick: () => { setSfx(!s.sfx); this.render(); } }, s.sfx ? 'Ligados' : 'Desligados')),
      h('div', { class: 'small' }, `Personagem: ${me.name} • Ping: ${Math.round(this.app.net.rtt)} ms`),
      h('div', { class: 'small' }, 'Controles no PC: WASD/setas para andar (Shift = caminhar devagar), Espaço ataca, 1/2 habilidades, Q/E poções, F falar, I inventário, C personagem, J missões, M mapa, Enter chat.'),
      h('button', { class: 'btn alt', onclick: () => { this.close(); this.app.leaveWorld(); } }, 'Trocar de personagem'),
      h('button', { class: 'btn red', onclick: () => { this.close(); this.app.logout(); } }, 'Sair da conta')), true);
  }
}

export { EQUIP_SLOTS, clear };
