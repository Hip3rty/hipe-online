// Efeitos visuais: projéteis, cortes, explosões, números de dano, cura, level up.
const COLORS = {
  melee: '#ffffff', distance: '#e8d8a0', magic: '#a070ff', arrow: '#e8d8a0', bolt: '#9a6aff', fire: '#ff7a2a',
  whirl: '#ffffff', pierce: '#fff2a0', rain: '#e8d8a0', fireball: '#ff7a2a', heal: '#5aff7a', warcry: '#ffcf3a',
};

export class Effects {
  constructor() {
    this.list = [];
    this.texts = [];
  }

  add(fx) {
    fx.t0 = performance.now();
    this.list.push(fx);
    if (this.list.length > 200) this.list.shift();
  }

  text(x, y, str, color, big = false) {
    this.texts.push({ x, y, str, color, big, t0: performance.now(), dx: (Math.random() - 0.5) * 0.4 });
    if (this.texts.length > 60) this.texts.shift();
  }

  // posição atual de uma entidade (ou última conhecida)
  draw(ctx, now, posOf) {
    this.list = this.list.filter((f) => now - f.t0 < f.dur);
    for (const f of this.list) {
      const k = (now - f.t0) / f.dur;
      switch (f.type) {
        case 'proj': {
          const a = posOf(f.a, f.ax, f.ay), b = posOf(f.b, f.bx, f.by);
          if (!a || !b) break;
          f.ax = a.x; f.ay = a.y; f.bx = b.x; f.by = b.y;
          const x = (a.x + (b.x - a.x) * k) * 16, y = (a.y + (b.y - a.y) * k) * 16 - 8;
          const ang = Math.atan2(b.y - a.y, b.x - a.x);
          const col = COLORS[f.s] || '#ffffff';
          if (f.s === 'arrow' || f.s === 'distance' || f.s === 'pierce') {
            ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
            ctx.fillStyle = '#6a4a2a'; ctx.fillRect(-5, -0.5, 8, 1);
            ctx.fillStyle = '#e8e8f0'; ctx.fillRect(3, -1, 2, 2);
            ctx.fillStyle = f.s === 'pierce' ? '#fff2a0' : '#d84040'; ctx.fillRect(-6, -1, 2, 2);
            ctx.restore();
          } else {
            const r = f.s === 'fireball' ? 4 : 3;
            ctx.globalAlpha = 0.35; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r + 2, 0, 7); ctx.fill();
            ctx.globalAlpha = 1; ctx.fillRect(Math.round(x - r / 2), Math.round(y - r / 2), r, r);
            ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x - 0.5), Math.round(y - 0.5), 1, 1);
            // rastro
            for (let i = 1; i < 4; i++) {
              const kk = Math.max(0, k - i * 0.06);
              ctx.globalAlpha = 0.5 - i * 0.12; ctx.fillStyle = col;
              ctx.fillRect(Math.round((a.x + (b.x - a.x) * kk) * 16 - 1), Math.round((a.y + (b.y - a.y) * kk) * 16 - 9), 2, 2);
            }
            ctx.globalAlpha = 1;
          }
          break;
        }
        case 'slash': {
          const b = posOf(f.b, f.bx, f.by);
          if (!b) break;
          ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = 1 - k; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(b.x * 16, b.y * 16 - 8, 7, -2.4 + k * 1.5, -0.6 + k * 1.5); ctx.stroke();
          ctx.globalAlpha = 1;
          break;
        }
        case 'spark': {
          const b = posOf(f.b, f.bx, f.by);
          if (!b) break;
          ctx.fillStyle = f.c || '#fff2a0';
          for (let i = 0; i < 6; i++) {
            const a2 = (i / 6) * Math.PI * 2 + f.t0;
            const r = 2 + k * 8;
            ctx.globalAlpha = 1 - k;
            ctx.fillRect(Math.round(b.x * 16 + Math.cos(a2) * r), Math.round(b.y * 16 - 8 + Math.sin(a2) * r), 1, 1);
          }
          ctx.globalAlpha = 1;
          break;
        }
        case 'aoe': {
          const col = COLORS[f.s] || '#ffffff';
          const R = f.r * 16;
          ctx.globalAlpha = (1 - k) * 0.8;
          if (f.s === 'whirl') {
            ctx.strokeStyle = col; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(f.x * 16, f.y * 16 - 6, R * (0.4 + k * 0.6), k * 12, k * 12 + 4.5); ctx.stroke();
          } else if (f.s === 'rain') {
            ctx.fillStyle = col;
            for (let i = 0; i < 14; i++) {
              const px = f.x * 16 + Math.sin(i * 7.3) * R, py = f.y * 16 + Math.cos(i * 3.1) * R * 0.6;
              const fall = ((k * 3 + i * 0.13) % 1) * 24;
              ctx.fillRect(Math.round(px), Math.round(py - 24 + fall), 1, 4);
            }
          } else {
            ctx.fillStyle = col;
            ctx.beginPath(); ctx.arc(f.x * 16, f.y * 16, R * (0.3 + k * 0.7), 0, 7); ctx.fill();
            ctx.fillStyle = '#ffe070'; ctx.globalAlpha = (1 - k) * 0.9;
            ctx.beginPath(); ctx.arc(f.x * 16, f.y * 16, R * 0.4 * (1 - k), 0, 7); ctx.fill();
          }
          ctx.globalAlpha = 1;
          break;
        }
        case 'ring': {
          const b = posOf(f.b, f.bx, f.by);
          if (!b) break;
          ctx.globalAlpha = 1 - k;
          ctx.fillStyle = f.c;
          for (let i = 0; i < 10; i++) {
            const a2 = (i / 10) * Math.PI * 2;
            ctx.fillRect(Math.round(b.x * 16 + Math.cos(a2) * 7), Math.round(b.y * 16 - 4 - k * 18 + Math.sin(a2) * 3), 1, 2);
          }
          ctx.globalAlpha = 1;
          break;
        }
        case 'lvl': {
          const b = posOf(f.b, f.bx, f.by);
          if (!b) break;
          ctx.globalAlpha = 1 - k;
          const g = ctx.createLinearGradient(0, b.y * 16 - 40, 0, b.y * 16);
          g.addColorStop(0, 'rgba(255,220,80,0)'); g.addColorStop(1, 'rgba(255,220,80,0.7)');
          ctx.fillStyle = g; ctx.fillRect(b.x * 16 - 8, b.y * 16 - 40, 16, 40);
          ctx.fillStyle = '#fff6c0';
          for (let i = 0; i < 8; i++) ctx.fillRect(Math.round(b.x * 16 - 8 + ((i * 5) % 16)), Math.round(b.y * 16 - (k * 40 + i * 4) % 40), 1, 2);
          ctx.globalAlpha = 1;
          break;
        }
        case 'puff': {
          ctx.fillStyle = '#d8d0e0';
          for (let i = 0; i < 7; i++) {
            const a2 = (i / 7) * Math.PI * 2;
            ctx.globalAlpha = (1 - k) * 0.8;
            const r = 2 + k * 9;
            ctx.beginPath(); ctx.arc(f.x * 16 + Math.cos(a2) * r, f.y * 16 - 6 + Math.sin(a2) * r * 0.6 - k * 6, 2.5 * (1 - k) + 1, 0, 7); ctx.fill();
          }
          ctx.globalAlpha = 1;
          break;
        }
      }
    }
  }

  drawTexts(ctx, now, toScreen, scale) {
    this.texts = this.texts.filter((t) => now - t.t0 < 1100);
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      const k = (now - t.t0) / 1100;
      const p = toScreen(t.x + t.dx * k, t.y - 1.2 - k * 1.2);
      const size = Math.round((t.big ? 15 : 12) * scale * (k < 0.15 ? 1 + (0.15 - k) * 3 : 1));
      ctx.font = `900 ${size}px "Trebuchet MS", system-ui, sans-serif`;
      ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      ctx.lineWidth = Math.max(2, 3 * scale);
      ctx.strokeStyle = '#1a1020';
      ctx.strokeText(t.str, p.x, p.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }
}
