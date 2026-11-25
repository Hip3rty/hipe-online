// Armazenamento em arquivo JSON - SOMENTE para desenvolvimento local e testes.
// Em produção, defina DATABASE_URL para usar PostgreSQL.
import fs from 'node:fs';
import path from 'node:path';
import { log } from '../log.js';

export class FileStore {
  constructor(file) {
    this.kind = 'file';
    this.file = file;
    this.data = { seq: { account: 0, character: 0 }, accounts: [], sessions: [], characters: [], history: [] };
    this.timer = null;
  }
  async init() {
    if (this.file !== ':memory:' && fs.existsSync(this.file)) {
      this.data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    }
    log.warn('usando FileStore (dev). Defina DATABASE_URL para PostgreSQL em produção.', { file: this.file });
  }
  persist() {
    if (this.file === ':memory:') return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 300);
  }
  flush() {
    if (this.file === ':memory:') return;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data));
    fs.renameSync(tmp, this.file);
  }
  async createAccount(username, passHash) {
    if (this.data.accounts.some((a) => a.username.toLowerCase() === username.toLowerCase())) return null;
    const id = ++this.data.seq.account;
    this.data.accounts.push({ id, username, pass_hash: passHash, banned: false, created_at: Date.now() });
    this.persist();
    return id;
  }
  async getAccount(username) {
    return this.data.accounts.find((a) => a.username.toLowerCase() === username.toLowerCase()) || null;
  }
  async touchLogin() {}
  async createSession(tokenHash, accountId, expiresAt) {
    this.data.sessions.push({ token_hash: tokenHash, account_id: accountId, expires_at: +expiresAt });
    this.persist();
  }
  async getSession(tokenHash) {
    const s = this.data.sessions.find((x) => x.token_hash === tokenHash && x.expires_at > Date.now());
    if (!s) return null;
    const a = this.data.accounts.find((x) => x.id === s.account_id);
    return a ? { account_id: a.id, username: a.username, banned: a.banned } : null;
  }
  async deleteSession(tokenHash) {
    this.data.sessions = this.data.sessions.filter((x) => x.token_hash !== tokenHash);
    this.persist();
  }
  async listCharacters(accountId) {
    return this.data.characters.filter((c) => c.account_id === accountId)
      .map((c) => ({ id: c.id, name: c.name, cls: c.cls, level: c.data.level, look: c.data.look }));
  }
  async createCharacter(accountId, name, cls, data) {
    if (this.data.characters.some((c) => c.name.toLowerCase() === name.toLowerCase())) return null;
    const id = ++this.data.seq.character;
    this.data.characters.push({ id, account_id: accountId, name, cls, data: { ...data, id } });
    this.persist();
    return id;
  }
  async loadCharacter(id, accountId) {
    const c = this.data.characters.find((x) => x.id === id && x.account_id === accountId);
    return c ? structuredClone({ ...c.data, id: c.id, name: c.name }) : null;
  }
  async saveCharacter(ch) {
    const c = this.data.characters.find((x) => x.id === ch.id);
    if (c) { c.data = structuredClone(ch); this.persist(); }
  }
  async addHistory(charId, event, payload) {
    this.data.history.push({ character_id: charId, event, payload, created_at: Date.now() });
    if (this.data.history.length > 5000) this.data.history.splice(0, 1000);
    this.persist();
  }
  async topLevels(n) {
    return this.data.characters.map((c) => ({ name: c.name, cls: c.cls, level: c.data.level, xp: c.data.xp }))
      .sort((a, b) => b.level - a.level || b.xp - a.xp).slice(0, n);
  }
  async topPvp(n) {
    return this.data.characters.map((c) => ({ name: c.name, cls: c.cls, level: c.data.level, rating: c.data.stats.rating, pvp_kills: c.data.stats.pvpKills }))
      .sort((a, b) => b.rating - a.rating || b.pvp_kills - a.pvp_kills).slice(0, n);
  }
  async close() {
    clearTimeout(this.timer);
    this.flush();
  }
}
