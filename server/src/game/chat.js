// Chat global, local (próximo) e privado, com limite de frequência e filtro básico.
const BAD = /\b(porra|caralho|fdp|puta|arrombad\w*|viad\w*)\b/gi;

function clean(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 140).replace(BAD, (w) => '*'.repeat(w.length));
}

function allowed(game, p, now) {
  if (now - (p.chatAt || 0) < 900) { game.notify(p, 'Calma! Aguarde para enviar outra mensagem.', 'warn'); return false; }
  p.chatAt = now;
  return true;
}

export function handleChat(game, p, msg, now) {
  const m = clean(msg.m);
  if (!m || !allowed(game, p, now)) return;
  const out = { t: 'chat', ch: msg.ch === 'l' ? 'l' : 'g', from: p.ch.name, id: p.id, m, lvl: p.ch.level };
  if (out.ch === 'l') game.broadcastNear(p.x, p.y, out, 16);
  else game.broadcastAll(out);
}

export function handlePm(game, p, msg, now) {
  const m = clean(msg.m);
  const to = typeof msg.to === 'string' ? msg.to.trim().toLowerCase() : '';
  if (!m || !to || !allowed(game, p, now)) return;
  const target = [...game.players.values()].find((x) => x.conn && x.ch.name.toLowerCase() === to);
  if (!target) return game.notify(p, 'Jogador não está online.', 'warn');
  game.send(target, { t: 'chat', ch: 'p', from: p.ch.name, m });
  game.send(p, { t: 'chat', ch: 'p', from: p.ch.name, to: target.ch.name, m, self: 1 });
}
