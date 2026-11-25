// Cadastro, login e sessões. Senhas com bcrypt; tokens de sessão aleatórios guardados como SHA-256.
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { USER_RE } from '@hipe/shared/constants.js';
import { config } from './config.js';

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

// Limitador de tentativas por IP e por usuário (contra força bruta)
const attempts = new Map();
function throttled(key, max, windowMs) {
  const now = Date.now();
  let e = attempts.get(key);
  if (!e || e.reset < now) { e = { n: 0, reset: now + windowMs }; attempts.set(key, e); }
  e.n++;
  return e.n > max;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, e] of attempts) if (e.reset < now) attempts.delete(k);
}, 60000).unref();

export class Auth {
  constructor(store) {
    this.store = store;
  }

  async issueSession(accountId) {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + config.sessionDays * 86400000);
    await this.store.createSession(sha(token), accountId, expires);
    return token;
  }

  async register(username, password, ip) {
    if (typeof username !== 'string' || typeof password !== 'string') return { error: 'Dados inválidos.' };
    if (!USER_RE.test(username)) return { error: 'Usuário: 3-20 caracteres (letras, números ou _).' };
    if (password.length < 6 || password.length > 72) return { error: 'A senha deve ter entre 6 e 72 caracteres.' };
    if (throttled('reg:' + ip, config.registerLimit, 10 * 60000)) return { error: 'Muitos cadastros deste endereço. Tente mais tarde.' };
    const hash = await bcrypt.hash(password, config.bcryptRounds);
    const id = await this.store.createAccount(username, hash);
    if (!id) return { error: 'Este nome de usuário já existe.' };
    const token = await this.issueSession(id);
    return { accountId: id, username, token };
  }

  async login(username, password, ip) {
    if (typeof username !== 'string' || typeof password !== 'string') return { error: 'Dados inválidos.' };
    if (throttled('ip:' + ip, 15, 60000) || throttled('user:' + username.toLowerCase(), 8, 5 * 60000)) {
      return { error: 'Muitas tentativas. Aguarde alguns minutos.' };
    }
    const acc = await this.store.getAccount(username);
    const ok = acc && (await bcrypt.compare(password, acc.pass_hash));
    if (!ok) return { error: 'Usuário ou senha incorretos.' };
    if (acc.banned) return { error: 'Conta suspensa.' };
    await this.store.touchLogin(acc.id);
    const token = await this.issueSession(acc.id);
    return { accountId: acc.id, username: acc.username, token };
  }

  async resume(token) {
    if (typeof token !== 'string' || token.length !== 64) return { error: 'Sessão inválida.' };
    const s = await this.store.getSession(sha(token));
    if (!s) return { error: 'Sessão expirada. Faça login novamente.' };
    if (s.banned) return { error: 'Conta suspensa.' };
    return { accountId: s.account_id, username: s.username, token };
  }

  async logout(token) {
    if (typeof token === 'string') await this.store.deleteSession(sha(token));
  }
}
