// Teste de integração: sobe o servidor real, conecta 2 clientes WebSocket e exercita
// cadastro, criação de personagem, sincronização, chat, combate, loot, loja e persistência.
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { startServer } from '../src/index.js';
import { FileStore } from '../src/db/filestore.js';
import { config } from '../src/config.js';

let srv, store;

class Client {
  constructor(port) {
    this.ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    this.msgs = [];
    this.waiters = [];
    this.ws.on('message', (d) => {
      const m = JSON.parse(d.toString());
      const w = this.waiters.find((x) => x.pred(m));
      if (w) { this.waiters.splice(this.waiters.indexOf(w), 1); w.res(m); }
      else this.msgs.push(m);
    });
  }
  open() { return new Promise((r) => this.ws.once('open', r)); }
  send(m) { this.ws.send(JSON.stringify(m)); }
  wait(pred, ms = 4000) {
    const found = this.msgs.find(pred);
    if (found) { this.msgs.splice(this.msgs.indexOf(found), 1); return Promise.resolve(found); }
    return new Promise((res, rej) => {
      const w = { pred, res };
      this.waiters.push(w);
      setTimeout(() => rej(new Error('timeout esperando mensagem')), ms);
    });
  }
  close() { this.ws.close(); }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function enter(port, user, name, cls) {
  const c = new Client(port);
  await c.open();
  c.send({ t: 'hello', v: 1 });
  await c.wait((m) => m.t === 'hello');
  c.send({ t: 'register', u: user, p: 'segredo123' });
  const ok = await c.wait((m) => m.t === 'auth_ok');
  c.token = ok.token;
  c.send({ t: 'create', name, cls, look: { skin: 1, hair: 2, hairColor: 3, shirt: 4, pants: 5 } });
  const chars = await c.wait((m) => m.t === 'chars');
  c.charId = chars.created;
  c.send({ t: 'play', id: chars.created });
  const en = await c.wait((m) => m.t === 'enter');
  c.id = en.id;
  return c;
}

before(async () => {
  config.registerLimit = 100;
  config.bcryptRounds = 4;
  store = new FileStore(':memory:');
  await store.init();
  srv = await startServer({ store, port: 0 });
});
after(async () => {
  await srv.shutdown('test');
});

test('mensagens enviadas juntas antes do login não são descartadas', async () => {
  const c = new Client(srv.port);
  await c.open();
  c.send({ t: 'hello', v: 1 });
  c.send({ t: 'register', u: 'rajada_user', p: 'segredo123' });
  c.send({ t: 'chars' });
  await c.wait((m) => m.t === 'hello');
  await c.wait((m) => m.t === 'auth_ok');
  await c.wait((m) => m.t === 'chars');
  c.close();
});

test('cadastro duplicado e senha errada são recusados', async () => {
  const c = new Client(srv.port);
  await c.open();
  c.send({ t: 'register', u: 'dup_user', p: 'segredo123' });
  await c.wait((m) => m.t === 'auth_ok');
  c.close();
  const d = new Client(srv.port);
  await d.open();
  d.send({ t: 'register', u: 'DUP_user', p: 'outra123' });
  const e = await d.wait((m) => m.t === 'auth_err');
  assert.match(e.m, /já existe/);
  d.send({ t: 'login', u: 'dup_user', p: 'errada!!' });
  const e2 = await d.wait((m) => m.t === 'auth_err');
  assert.match(e2.m, /incorretos/);
  d.close();
});

test('dois jogadores se veem, se movem e conversam', async () => {
  const a = await enter(srv.port, 'alice', 'Alice', 'warrior');
  const b = await enter(srv.port, 'bruno', 'Bruno', 'mage');
  // B deve receber o spawn de A
  const sp = await b.wait((m) => m.t === 's' && m.sp?.some((e) => e.id === a.id));
  const ea = sp.sp.find((e) => e.id === a.id);
  assert.equal(ea.name, 'Alice');
  assert.equal(ea.eq.weapon, 'sword_wood');
  // A anda para a direita; B recebe atualização de posição
  a.send({ t: 'mv', dx: 1, dy: 0, run: false });
  const up = await b.wait((m) => m.t === 's' && m.u?.some((u) => u[0] === a.id && u[1] > Math.round(ea.x * 100)));
  assert.ok(up);
  a.send({ t: 'mv', dx: 0, dy: 0 });
  // velocidade validada pelo servidor: tentar mandar vetor gigante não acelera
  const pa = srv.game.players.get(a.id);
  const x0 = pa.x;
  a.send({ t: 'mv', dx: 9999, dy: 0, run: true });
  await sleep(500);
  a.send({ t: 'mv', dx: 0, dy: 0 });
  await sleep(100);
  assert.ok(pa.x - x0 < 4.6 * 0.75, `andou demais: ${pa.x - x0}`);
  // chat global e privado
  a.send({ t: 'chat', ch: 'g', m: 'Olá mundo <script>' });
  const cm = await b.wait((m) => m.t === 'chat' && m.ch === 'g');
  assert.equal(cm.m, 'Olá mundo script');
  await sleep(1000);
  b.send({ t: 'pm', to: 'alice', m: 'oi Alice' });
  const pm = await a.wait((m) => m.t === 'chat' && m.ch === 'p');
  assert.equal(pm.from, 'Bruno');
  // lista online
  a.send({ t: 'online' });
  const ol = await a.wait((m) => m.t === 'online');
  assert.equal(ol.list.length, 2);
  // PvP na vila (zona segura) é bloqueado
  a.send({ t: 'tgt', id: b.id });
  const note = await a.wait((m) => m.t === 'note' && /PvP|novato/.test(m.m));
  assert.ok(note);
  a.close();
  b.close();
  await sleep(2000);
});

test('combate, XP, loot, loja e persistência', async () => {
  const c = await enter(srv.port, 'carla', 'Carla', 'archer');
  const game = srv.game;
  const p = game.players.get(c.id);
  // leva o jogador para fora da vila, perto de um slime
  const sp = game.spawners.find((s) => s.monster === 'slime' && s.mob);
  p.x = sp.mob.x - 2; p.y = sp.mob.y; game.grid.update(p);
  const mob = sp.mob;
  mob.hp = 5;
  c.send({ t: 'tgt', id: mob.id });
  const die = await c.wait((m) => m.t === 'fx' && m.e === 'die' && m.b === mob.id, 6000);
  assert.ok(die);
  const xp = await c.wait((m) => m.t === 'xp');
  assert.ok(xp.v > 0);
  // anda até o loot (moedas) e coleta automaticamente
  const gold0 = p.ch.gold;
  await sleep(100);
  const coin = [...game.items.values()].find((i) => i.item.k === 'gold');
  assert.ok(coin, 'deveria dropar moedas');
  p.x = coin.x; p.y = coin.y; game.grid.update(p);
  c.send({ t: 'mv', dx: 0.1, dy: 0 });
  await c.wait((m) => m.t === 'loot' && m.k === 'gold');
  c.send({ t: 'mv', dx: 0, dy: 0 });
  assert.ok(p.ch.gold > gold0);
  assert.equal(p.ch.quests.active.q_slimes, undefined);
  // compra uma poção na loja (precisa estar perto do mercador)
  p.x = 139.5; p.y = 126.5; game.grid.update(p);
  p.ch.gold = 100;
  c.send({ t: 'buy', npc: 'merchant', k: 'hp_potion_s', q: 3 });
  await c.wait((m) => m.t === 'note' && /Comprou/.test(m.m));
  assert.equal(p.ch.gold, 70);
  // longe do NPC: recusado
  p.x = 128.5; p.y = 133.5; game.grid.update(p);
  c.send({ t: 'buy', npc: 'merchant', k: 'hp_potion_s', q: 1 });
  await c.wait((m) => m.t === 'note' && /Aproxime/.test(m.m));
  // persiste e recarrega
  await game.savePlayer(p);
  const loaded = await store.loadCharacter(c.charId, p.accountId);
  assert.equal(loaded.gold, 70);
  assert.equal(loaded.stats.kills, 1);
  assert.ok(loaded.ach.first_blood);
  c.close();
});

test('reconexão com token retoma a sessão', async () => {
  const c = await enter(srv.port, 'davi', 'Davi', 'warrior');
  const token = c.token;
  c.close();
  await sleep(200);
  const r = new Client(srv.port);
  await r.open();
  r.send({ t: 'resume', token });
  const ok = await r.wait((m) => m.t === 'auth_ok');
  assert.equal(ok.chars[0].name, 'Davi');
  r.send({ t: 'play', id: ok.chars[0].id });
  await r.wait((m) => m.t === 'enter');
  const me = await r.wait((m) => m.t === 'me');
  assert.equal(me.name, 'Davi');
  r.close();
});
