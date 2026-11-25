// Uma conexão WebSocket: autenticação, seleção de personagem e encaminhamento ao mundo.
import { PROTOCOL_VERSION, NAME_RE, MAX_CHARS_PER_ACCOUNT } from '@hipe/shared/constants.js';
import { CLASSES, validLook } from '@hipe/shared/rules.js';
import { newCharacterData } from '../game/character.js';
import { handleGameMessage } from '../game/handlers.js';
import { log } from '../log.js';

const RESERVED = /(admin|gm|moderador|staff|hipe ?online)/i;

export class Connection {
  constructor(ws, ip, ctx) {
    this.ws = ws;
    this.ip = ip;
    this.ctx = ctx; // { game, auth, store }
    this.state = 'new';
    this.accountId = 0;
    this.username = '';
    this.player = null;
    this.busy = false;
    this.tokens = 40;
    this.lastRefill = Date.now();
    this.violations = 0;
    this.alive = true;
    this.authTimer = setTimeout(() => {
      if (this.state === 'new') this.kick('Tempo de autenticação esgotado.');
    }, 60000);
  }

  send(obj) {
    if (this.ws.readyState !== 1) return 0;
    const s = JSON.stringify(obj);
    this.ws.send(s);
    return s.length;
  }

  kick(reason) {
    this.send({ t: 'kicked', m: reason });
    try { this.ws.close(4000, 'kicked'); } catch { /* ignora */ }
  }

  rateOk() {
    const now = Date.now();
    this.tokens = Math.min(40, this.tokens + ((now - this.lastRefill) / 1000) * 25);
    this.lastRefill = now;
    if (this.tokens < 1) {
      if (++this.violations > 300) this.kick('Excesso de mensagens.');
      return false;
    }
    this.tokens--;
    return true;
  }

  async onMessage(raw) {
    if (!this.rateOk()) return;
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!msg || typeof msg.t !== 'string') return;
    const { game } = this.ctx;
    if (msg.t === 'ping') return this.send({ t: 'pong', c: msg.c, s: Date.now() });

    if (this.state === 'game' && this.player) {
      if (msg.t === 'leave') return this.leaveWorld();
      try { handleGameMessage(game, this.player, msg, Date.now()); }
      catch (err) { log.error('handler error', { t: msg.t, err: err.stack }); }
      return;
    }
    // mensagens antes de entrar no mundo são processadas em fila, na ordem de chegada
    // (ex.: "hello" + "resume" chegam juntas na reconexão; nenhuma pode ser descartada)
    if (this.pending >= 10) return;
    this.pending = (this.pending || 0) + 1;
    this.queue = (this.queue || Promise.resolve()).then(async () => {
      try {
        if (this.state === 'game' && this.player) handleGameMessage(game, this.player, msg, Date.now());
        else await this.preGame(msg);
      } catch (err) {
        log.error('pregame error', { t: msg.t, err: err.message });
        this.send({ t: 'err', m: 'Erro no servidor. Tente novamente.' });
      } finally { this.pending--; }
    });
  }

  async preGame(msg) {
    const { auth, store, game } = this.ctx;
    switch (msg.t) {
      case 'hello':
        if (msg.v !== PROTOCOL_VERSION) return this.send({ t: 'err', m: 'Versão do jogo desatualizada. Atualize o app.', fatal: 1 });
        return this.send({ t: 'hello', v: PROTOCOL_VERSION, online: game.players.size });
      case 'register':
      case 'login':
      case 'resume': {
        if (this.state !== 'new') return;
        const r = msg.t === 'register' ? await auth.register(msg.u, msg.p, this.ip)
          : msg.t === 'login' ? await auth.login(msg.u, msg.p, this.ip) : await auth.resume(msg.token);
        if (r.error) return this.send({ t: 'auth_err', m: r.error });
        this.state = 'auth';
        clearTimeout(this.authTimer);
        this.accountId = r.accountId;
        this.username = r.username;
        this.token = r.token;
        log.info('auth', { user: r.username, how: msg.t, ip: this.ip });
        return this.send({ t: 'auth_ok', token: r.token, user: r.username, chars: await store.listCharacters(r.accountId) });
      }
      case 'chars':
        if (this.state !== 'auth') return;
        return this.send({ t: 'chars', chars: await store.listCharacters(this.accountId) });
      case 'create': {
        if (this.state !== 'auth') return;
        const name = typeof msg.name === 'string' ? msg.name.trim().replace(/\s+/g, ' ') : '';
        if (!NAME_RE.test(name) || RESERVED.test(name)) return this.send({ t: 'err', m: 'Nome inválido (3-16 letras/números, sem termos reservados).' });
        if (!CLASSES[msg.cls]) return this.send({ t: 'err', m: 'Classe inválida.' });
        const list = await store.listCharacters(this.accountId);
        if (list.length >= MAX_CHARS_PER_ACCOUNT) return this.send({ t: 'err', m: `Máximo de ${MAX_CHARS_PER_ACCOUNT} personagens por conta.` });
        const data = newCharacterData(name, msg.cls, validLook(msg.look));
        const id = await store.createCharacter(this.accountId, name, msg.cls, data);
        if (!id) return this.send({ t: 'err', m: 'Este nome já está em uso.' });
        log.info('character created', { id, name, cls: msg.cls });
        return this.send({ t: 'chars', chars: await store.listCharacters(this.accountId), created: id });
      }
      case 'play': {
        if (this.state !== 'auth') return;
        const id = Number(msg.id);
        // apenas um personagem por conta no mundo
        for (const p of game.players.values()) if (p.accountId === this.accountId && p.ch.id !== id && p.conn) p.conn.kick('Outro personagem da conta entrou.');
        let ch;
        const live = game.byChar.get(id);
        if (live && live.accountId === this.accountId) ch = live.ch;
        else ch = await this.ctx.store.loadCharacter(id, this.accountId);
        if (!ch) return this.send({ t: 'err', m: 'Personagem não encontrado.' });
        if (game.players.size >= this.ctx.maxPlayers && !live) return this.send({ t: 'err', m: 'Servidor lotado. Tente em instantes.' });
        const p = game.attachPlayer(this, this.accountId, ch);
        this.player = p;
        this.state = 'game';
        this.send({ t: 'enter', id: p.id, x: p.x, y: p.y, name: ch.name, now: Date.now() });
        return;
      }
      case 'logout':
        await auth.logout(this.token);
        this.state = 'new';
        return this.send({ t: 'logged_out' });
      default:
        return;
    }
  }

  leaveWorld() {
    if (!this.player) return;
    this.ctx.game.detachPlayer(this.player);
    this.player = null;
    this.state = 'auth';
    this.ctx.store.listCharacters(this.accountId).then((chars) => this.send({ t: 'chars', chars }));
  }

  onClose() {
    clearTimeout(this.authTimer);
    if (this.player && this.player.conn === this) this.ctx.game.detachPlayer(this.player);
    this.player = null;
  }
}
