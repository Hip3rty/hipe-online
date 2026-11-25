// Telas fora do jogo: login/cadastro, seleção e criação de personagem.
import { h, ui, clear, previewCanvas } from './dom.js';
import { CLASSES, LOOKS } from '@hipe/shared/rules.js';
import { humanoidFrame, playerOpts, HW, HH } from '../gfx/sprites/humanoid.js';
import { serverUrl, setServerUrl, defaultServerUrl } from '../config.js';
import { unlockAudio } from '../audio.js';

const START_EQ = { warrior: { weapon: 'sword_wood', shield: 'shield_wood', armor: 'armor_leather' }, archer: { weapon: 'bow_short', armor: 'armor_leather' }, mage: { weapon: 'staff_apprentice', helmet: 'helmet_leather' } };

let screenEl = null;
let anim = null;
function mount(el) {
  if (screenEl) screenEl.remove();
  cancelAnimationFrame(anim);
  screenEl = el;
  ui().append(el);
}
export function hideScreens() {
  if (screenEl) screenEl.remove();
  screenEl = null;
  cancelAnimationFrame(anim);
}

function animatePreviews(items) {
  const loop = (t) => {
    for (const { canvas, opts, walk } of items) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const frame = walk ? Math.floor(t / 160) % 4 : Math.floor(t / 520) % 2;
      const dir = walk ? [0, 1, 3, 1][Math.floor(t / 2400) % 4] : 0;
      const img = humanoidFrame(opts, dir, walk ? 'walk' : 'idle', frame);
      ctx.save();
      if (walk && Math.floor(t / 2400) % 4 === 3) { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
    anim = requestAnimationFrame(loop);
  };
  anim = requestAnimationFrame(loop);
}

export function showLoading(text) {
  mount(h('div', { class: 'loading' }, h('div', { class: 'logo' }, 'HIPE ONLINE'), h('div', {}, text)));
}

export function showLogin(app, { error = '' } = {}) {
  const user = h('input', { class: 't', autocomplete: 'username', maxlength: 20, placeholder: 'seu_usuario', value: localStorage.getItem('hipe.user') || '' });
  const pass = h('input', { class: 't', type: 'password', autocomplete: 'current-password', maxlength: 72, placeholder: '••••••' });
  const err = h('div', { class: 'err' }, error);
  const srv = h('input', { class: 't', value: serverUrl(), placeholder: defaultServerUrl() });
  const adv = h('div', { class: 'hidden' },
    h('label', { class: 'f' }, 'Endereço do servidor (ws:// ou wss://)'),
    srv,
    h('div', { class: 'row', style: { marginTop: '6px' } },
      h('button', { class: 'btn alt sm', onclick: () => { setServerUrl(srv.value.trim()); app.reconnect(); err.textContent = 'Servidor salvo.'; } }, 'Salvar'),
      h('button', { class: 'btn alt sm', onclick: () => { setServerUrl(''); srv.value = serverUrl(); app.reconnect(); } }, 'Padrão')));
  const go = (kind) => {
    unlockAudio();
    const u = user.value.trim(), p = pass.value;
    if (!u || !p) { err.textContent = 'Preencha usuário e senha.'; return; }
    localStorage.setItem('hipe.user', u);
    err.textContent = 'Conectando...';
    app.auth(kind, u, p, (m) => { err.textContent = m; });
  };
  pass.addEventListener('keydown', (e) => { if (e.key === 'Enter') go('login'); });
  const status = h('div', { class: 'small', style: { textAlign: 'center', marginTop: '8px' } });
  app.onNetStatus = (s) => {
    status.textContent = s === 'online' ? `● Servidor online${app.online != null ? ` — ${app.online} jogando` : ''}` : s === 'reconnecting' ? '○ Conectando ao servidor (pode levar até 1 min se estiver acordando)...' : '○ Offline';
    status.style.color = s === 'online' ? '#62d862' : '#ffb07a';
  };
  app.onNetStatus(app.net.status);
  mount(h('div', { class: 'screen' }, h('div', { class: 'card' },
    h('h1', { class: 'logo' }, 'HIPE ONLINE'),
    h('p', { class: 'tag' }, 'MMORPG 2D • explore, lute e evolua com amigos'),
    h('label', { class: 'f' }, 'Usuário'), user,
    h('label', { class: 'f' }, 'Senha'), pass,
    err,
    h('div', { class: 'row', style: { marginTop: '8px' } },
      h('button', { class: 'btn grow', onclick: () => go('login') }, 'Entrar'),
      h('button', { class: 'btn alt grow', onclick: () => go('register') }, 'Criar conta')),
    status,
    h('div', { style: { textAlign: 'center' } }, h('button', { class: 'link', onclick: () => adv.classList.toggle('hidden') }, 'Servidor')),
    adv)));
}

export function showCharSelect(app, chars) {
  const list = h('div', { class: 'chars' });
  const previews = [];
  for (const c of chars) {
    const cv = previewCanvas(HW, HH);
    previews.push({ canvas: cv, opts: playerOpts(c.look || {}, START_EQ[c.cls] || {}) });
    list.append(h('div', { class: 'charcard', onclick: () => { unlockAudio(); app.play(c.id); } },
      cv,
      h('div', { class: 'grow' }, h('b', {}, c.name), h('div', { class: 'small' }, `${CLASSES[c.cls]?.name || c.cls} • Nível ${c.level}`)),
      h('span', { class: 'btn sm' }, 'Jogar')));
  }
  if (!chars.length) list.append(h('div', { class: 'small', style: { textAlign: 'center' } }, 'Você ainda não tem personagens. Crie o primeiro!'));
  mount(h('div', { class: 'screen' }, h('div', { class: 'card' },
    h('h1', { class: 'logo', style: { fontSize: '30px' } }, 'PERSONAGENS'),
    list,
    h('div', { class: 'row' },
      chars.length < 3 ? h('button', { class: 'btn grow', onclick: () => showCreate(app) }, '+ Novo personagem') : null,
      h('button', { class: 'btn alt', onclick: () => app.logout() }, 'Sair')))));
  animatePreviews(previews);
}

export function showCreate(app, error = '') {
  const look = { skin: 0, hair: 0, hairColor: 1, shirt: 0, pants: 5 };
  let cls = 'warrior';
  const name = h('input', { class: 't', maxlength: 16, placeholder: 'Nome do herói' });
  const err = h('div', { class: 'err' }, error);
  const cv = previewCanvas(HW, HH);
  const prev = { canvas: cv, opts: playerOpts(look, START_EQ[cls]), walk: true };
  const refresh = () => { prev.opts = playerOpts(look, START_EQ[cls]); };
  const picker = (label, key, count, names) => {
    const val = h('span', { class: 'val' });
    const upd = () => { val.textContent = names ? names[look[key]] : `${label} ${look[key] + 1}`; refresh(); };
    upd();
    return h('div', { class: 'picker' },
      h('button', { class: 'btn alt', onclick: () => { look[key] = (look[key] + count - 1) % count; upd(); } }, '◀'),
      val,
      h('button', { class: 'btn alt', onclick: () => { look[key] = (look[key] + 1) % count; upd(); } }, '▶'));
  };
  const classBtns = Object.entries(CLASSES).map(([k, c]) => {
    const b = h('div', { class: 'classbtn' + (k === cls ? ' sel' : ''), onclick: () => {
      cls = k; classBtns.forEach((x) => x.classList.remove('sel')); b.classList.add('sel'); desc.textContent = c.desc; refresh();
    } }, h('b', {}, c.name), h('span', {}, k === 'warrior' ? 'Espada/Escudo' : k === 'archer' ? 'Arco' : 'Cajado'));
    return b;
  });
  const desc = h('div', { class: 'small', style: { marginTop: '6px', textAlign: 'center' } }, CLASSES[cls].desc);
  mount(h('div', { class: 'screen' }, h('div', { class: 'card' },
    h('h1', { class: 'logo', style: { fontSize: '28px' } }, 'NOVO HERÓI'),
    h('div', { class: 'preview' }, cv),
    h('label', { class: 'f' }, 'Nome'), name,
    h('label', { class: 'f' }, 'Estilo de combate inicial'), h('div', { class: 'classes' }, classBtns), desc,
    h('label', { class: 'f' }, 'Aparência'),
    picker('Pele', 'skin', LOOKS.skin.length, ['Pele clara', 'Pele média', 'Pele morena', 'Pele escura']),
    picker('Cabelo', 'hair', LOOKS.hairStyles.length, LOOKS.hairStyles),
    picker('Cor do cabelo', 'hairColor', LOOKS.hairColor.length, ['Preto', 'Castanho', 'Ruivo claro', 'Loiro', 'Ruivo', 'Azul', 'Rosa', 'Branco']),
    picker('Roupa', 'shirt', LOOKS.cloth.length, ['Roupa azul', 'Roupa vermelha', 'Roupa verde', 'Roupa amarela', 'Roupa roxa', 'Roupa marrom', 'Roupa ciano', 'Roupa branca']),
    picker('Calça', 'pants', LOOKS.cloth.length, ['Calça azul', 'Calça vermelha', 'Calça verde', 'Calça amarela', 'Calça roxa', 'Calça marrom', 'Calça ciano', 'Calça branca']),
    err,
    h('div', { class: 'row', style: { marginTop: '8px' } },
      h('button', { class: 'btn grow', onclick: () => {
        const n = name.value.trim();
        if (n.length < 3) { err.textContent = 'O nome precisa de pelo menos 3 letras.'; return; }
        err.textContent = 'Criando...';
        app.createChar(n, cls, look, (m) => { err.textContent = m; });
      } }, 'Criar personagem'),
      h('button', { class: 'btn alt', onclick: () => app.net.send({ t: 'chars' }) }, 'Voltar')))));
  animatePreviews([prev]);
}

export { clear };
