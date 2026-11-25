// Ponto de entrada: servidor HTTP (cliente web + health check) e WebSocket do jogo em /ws.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { config } from './config.js';
import { log } from './log.js';
import { openStore } from './db/index.js';
import { Auth } from './auth.js';
import { Game } from './game/world.js';
import { Connection } from './net/connection.js';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.txt': 'text/plain',
};

export async function startServer(opts = {}) {
  const store = opts.store || (await openStore(opts));
  const auth = new Auth(store);
  const game = new Game(store);
  game.start();
  const started = Date.now();

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/health') {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      return res.end(JSON.stringify({ ok: true, players: game.players.size, uptime: Math.round((Date.now() - started) / 1000) }));
    }
    if (url.pathname === '/api/status') {
      res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'cache-control': 'no-store' });
      return res.end(JSON.stringify({ name: 'Hipe Online', online: game.players.size, uptime: Math.round((Date.now() - started) / 1000), db: store.kind, tickMs: +game.metrics.tickMs.toFixed(2) }));
    }
    // arquivos estáticos do cliente web (mesmo jogo do APK, jogável no navegador)
    const safe = path.normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '').replace(/^(\.\.[/\\])+/, '');
    let file = path.join(config.clientDist, safe || 'index.html');
    if (!file.startsWith(config.clientDist)) { res.writeHead(403); return res.end(); }
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) file = path.join(config.clientDist, 'index.html');
      fs.readFile(file, (err2, data) => {
        if (err2) {
          res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
          return res.end('Servidor do Hipe Online ativo. Cliente web não compilado (rode "npm run build").');
        }
        const ext = path.extname(file);
        res.writeHead(200, {
          'content-type': MIME[ext] || 'application/octet-stream',
          'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=604800, immutable',
        });
        res.end(data);
      });
    });
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: 8 * 1024, perMessageDeflate: false });
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname !== '/ws') return socket.destroy();
    const origin = req.headers.origin || '';
    if (config.allowedOrigins.length && origin && !config.allowedOrigins.includes(origin)) {
      log.warn('origin rejected', { origin });
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      return socket.destroy();
    }
    if (wss.clients.size >= config.maxPlayers * 2) return socket.destroy();
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  const ctx = { game, auth, store, maxPlayers: config.maxPlayers };
  wss.on('connection', (ws, req) => {
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;
    const conn = new Connection(ws, ip, ctx);
    ws.on('message', (data, isBinary) => { if (!isBinary) conn.onMessage(data.toString()); });
    ws.on('pong', () => { conn.alive = true; });
    ws.on('close', () => conn.onClose());
    ws.on('error', () => {});
    ws._conn = conn;
  });
  // heartbeat: derruba conexões mortas (celular que perdeu sinal)
  const hb = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws._conn.alive) { ws.terminate(); continue; }
      ws._conn.alive = false;
      try { ws.ping(); } catch { /* ignora */ }
    }
  }, 20000);

  const port = opts.port ?? config.port;
  await new Promise((r) => server.listen(port, config.host, r));
  log.info('Hipe Online server listening', { port: server.address().port, db: store.kind });

  let stopping = false;
  async function shutdown(signal) {
    if (stopping) return;
    stopping = true;
    log.info('shutting down', { signal });
    game.broadcastAll({ t: 'sys', m: 'O servidor está reiniciando. Seu progresso foi salvo; reconectando em instantes...' });
    clearInterval(hb);
    await game.stop();
    for (const ws of wss.clients) ws.close(1012, 'restart');
    server.close();
    await store.close();
  }
  return { server, game, store, port: server.address().port, shutdown };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const srv = await startServer();
  for (const sig of ['SIGTERM', 'SIGINT']) {
    process.on(sig, async () => {
      await srv.shutdown(sig);
      process.exit(0);
    });
  }
  process.on('unhandledRejection', (err) => log.error('unhandledRejection', { err: String(err?.stack || err) }));
  process.on('uncaughtException', (err) => log.error('uncaughtException', { err: String(err?.stack || err) }));
}
