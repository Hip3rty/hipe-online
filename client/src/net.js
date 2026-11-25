// Conexão WebSocket com reconexão automática e retomada de sessão.
import { PROTOCOL_VERSION } from '@hipe/shared/constants.js';
import { serverUrl } from './config.js';

export class Net {
  constructor() {
    this.ws = null;
    this.handlers = new Map();
    this.status = 'offline';
    this.retry = 0;
    this.wantOnline = false;
    this.rtt = 120;
    this.onStatus = () => {};
    this.queue = [];
  }

  on(type, fn) {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type).push(fn);
  }

  setStatus(s) {
    this.status = s;
    this.onStatus(s, this.retry);
  }

  connect() {
    this.wantOnline = true;
    if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)) return;
    this.setStatus(this.retry ? 'reconnecting' : 'connecting');
    let ws;
    try { ws = new WebSocket(serverUrl()); } catch { return this.scheduleReconnect(); }
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.setStatus('online');
      this.send({ t: 'hello', v: PROTOCOL_VERSION });
      this.emit({ t: '_open' });
      for (const m of this.queue.splice(0)) this.send(m);
      clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => this.send({ t: 'ping', c: performance.now() }), 4000);
    };
    ws.onmessage = (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      if (m.t === 'pong') { this.rtt = this.rtt * 0.7 + (performance.now() - m.c) * 0.3; return; }
      this.emit(m);
    };
    ws.onclose = (ev) => {
      clearInterval(this.pingTimer);
      this.ws = null;
      this.emit({ t: '_close', code: ev.code });
      if (this.wantOnline && ev.code !== 4000) this.scheduleReconnect();
      else this.setStatus('offline');
    };
    ws.onerror = () => {};
  }

  scheduleReconnect() {
    this.retry++;
    this.setStatus('reconnecting');
    const delay = Math.min(10000, 800 * Math.pow(1.6, this.retry));
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => this.connect(), delay);
  }

  disconnect() {
    this.wantOnline = false;
    clearTimeout(this.retryTimer);
    if (this.ws) this.ws.close(1000);
  }

  send(m) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m));
  }

  sendOrQueue(m) {
    if (this.ws && this.ws.readyState === 1) this.send(m);
    else this.queue.push(m);
  }

  emit(m) {
    const list = this.handlers.get(m.t);
    if (list) for (const fn of list) fn(m);
    const all = this.handlers.get('*');
    if (all) for (const fn of all) fn(m);
  }
}
