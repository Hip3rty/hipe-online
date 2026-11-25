// Armazenamento PostgreSQL (Supabase, Neon, Render Postgres, RDS, VPS... qualquer Postgres 13+)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { log } from '../log.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export class PostgresStore {
  constructor(url, ssl) {
    this.kind = 'postgres';
    this.pool = new pg.Pool({
      connectionString: url,
      ssl: ssl ? { rejectUnauthorized: false } : false,
      max: 5,
      idleTimeoutMillis: 30000, // libera conexões ociosas (permite o banco "dormir" no plano grátis)
      connectionTimeoutMillis: 15000,
    });
    this.pool.on('error', (err) => log.warn('pg pool error', { err: err.message }));
  }

  async q(text, params) {
    // tenta de novo uma vez: bancos serverless (Neon/Supabase) podem estar acordando
    try {
      return await this.pool.query(text, params);
    } catch (err) {
      if (/terminat|ECONNRESET|timeout|Connection/i.test(err.message)) {
        log.warn('db retry', { err: err.message });
        await new Promise((r) => setTimeout(r, 1500));
        return this.pool.query(text, params);
      }
      throw err;
    }
  }

  async init() {
    const sql = fs.readFileSync(path.join(here, 'schema.sql'), 'utf8');
    await this.q(sql);
    await this.q('DELETE FROM sessions WHERE expires_at < now()');
    log.info('postgres ready');
  }

  async createAccount(username, passHash) {
    try {
      const r = await this.q('INSERT INTO accounts (username, pass_hash) VALUES ($1, $2) RETURNING id', [username, passHash]);
      return r.rows[0].id;
    } catch (err) {
      if (err.code === '23505') return null;
      throw err;
    }
  }
  async getAccount(username) {
    const r = await this.q('SELECT id, username, pass_hash, banned FROM accounts WHERE lower(username) = lower($1)', [username]);
    return r.rows[0] || null;
  }
  async touchLogin(accountId) {
    await this.q('UPDATE accounts SET last_login = now() WHERE id = $1', [accountId]);
  }
  async createSession(tokenHash, accountId, expiresAt) {
    await this.q('INSERT INTO sessions (token_hash, account_id, expires_at) VALUES ($1, $2, $3)', [tokenHash, accountId, expiresAt]);
  }
  async getSession(tokenHash) {
    const r = await this.q(
      'SELECT s.account_id, a.username, a.banned FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.token_hash = $1 AND s.expires_at > now()',
      [tokenHash],
    );
    return r.rows[0] || null;
  }
  async deleteSession(tokenHash) {
    await this.q('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
  }
  async listCharacters(accountId) {
    const r = await this.q(
      "SELECT id, name, cls, level, data->'look' AS look FROM characters WHERE account_id = $1 ORDER BY id",
      [accountId],
    );
    return r.rows;
  }
  async createCharacter(accountId, name, cls, data) {
    try {
      const r = await this.q(
        'INSERT INTO characters (account_id, name, cls, level, xp, data) VALUES ($1, $2, $3, 1, 0, $4) RETURNING id',
        [accountId, name, cls, data],
      );
      return r.rows[0].id;
    } catch (err) {
      if (err.code === '23505') return null;
      throw err;
    }
  }
  async loadCharacter(id, accountId) {
    const r = await this.q('SELECT id, name, data FROM characters WHERE id = $1 AND account_id = $2', [id, accountId]);
    if (!r.rows[0]) return null;
    return { ...r.rows[0].data, id: r.rows[0].id, name: r.rows[0].name };
  }
  async saveCharacter(ch) {
    await this.q(
      'UPDATE characters SET level = $2, xp = $3, rating = $4, pvp_kills = $5, data = $6, updated_at = now() WHERE id = $1',
      [ch.id, ch.level, ch.xp, ch.stats.rating, ch.stats.pvpKills, ch],
    );
  }
  async addHistory(charId, event, payload) {
    await this.q('INSERT INTO character_history (character_id, event, payload) VALUES ($1, $2, $3)', [charId, event, payload || null]);
  }
  async topLevels(n) {
    const r = await this.q('SELECT name, cls, level, xp FROM characters ORDER BY level DESC, xp DESC LIMIT $1', [n]);
    return r.rows.map((x) => ({ ...x, xp: Number(x.xp) }));
  }
  async topPvp(n) {
    const r = await this.q('SELECT name, cls, level, rating, pvp_kills FROM characters ORDER BY rating DESC, pvp_kills DESC LIMIT $1', [n]);
    return r.rows;
  }
  async close() {
    await this.pool.end();
  }
}
