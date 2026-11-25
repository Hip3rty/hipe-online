// Mini "editor de pixel art" procedural: desenha em um buffer de pixels e aplica contorno/sombra.
// Todos os sprites do jogo são gerados por código a partir daqui (sem imagens externas).

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}
export function shade(hex, f) {
  // f < 0 escurece, f > 0 clareia (com leve mudança de matiz para parecer pixel art)
  const [r, g, b] = hexToRgb(hex);
  if (f < 0) return rgbToHex([r * (1 + f), g * (1 + f), b * (1 + f * 0.8)]);
  return rgbToHex([r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f * 0.85]);
}
export function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}

export class Pix {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.p = new Array(w * h).fill(null);
  }
  set(x, y, c) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || !c) return;
    this.p[y * this.w + x] = c;
  }
  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.p[y * this.w + x];
  }
  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }
  // retângulo com luz no topo/esquerda e sombra embaixo/direita
  box(x, y, w, h, c, light = 0.25, dark = -0.3) {
    this.rect(x, y, w, h, c);
    const L = shade(c, light), D = shade(c, dark);
    for (let i = 0; i < w; i++) { this.set(x + i, y, L); this.set(x + i, y + h - 1, D); }
    for (let j = 1; j < h - 1; j++) this.set(x + w - 1, y + j, D);
  }
  ellipse(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c);
      }
    }
  }
  // esfera sombreada (luz vinda de cima-esquerda)
  ball(cx, cy, rx, ry, c) {
    const L = shade(c, 0.35), D = shade(c, -0.35);
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        const d = dx * dx + dy * dy;
        if (d > 1) continue;
        const lit = -dx * 0.6 - dy * 0.8;
        this.set(x, y, lit > 0.55 ? L : lit < -0.45 || d > 0.82 && dy > 0 ? D : c);
      }
    }
  }
  line(x0, y0, x1, y1, c) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.set(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c);
  }
  // contorno escuro em volta de tudo que foi desenhado (estilo pixel art)
  outline(c = '#1a1020', diag = false) {
    const src = this.p.slice();
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (src[y * this.w + x]) continue;
        const at = (i, j) => (i >= 0 && j >= 0 && i < this.w && j < this.h ? src[j * this.w + i] : null);
        let n = at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1);
        if (!n && diag) n = at(x - 1, y - 1) || at(x + 1, y - 1) || at(x - 1, y + 1) || at(x + 1, y + 1);
        if (n) this.p[y * this.w + x] = c;
      }
    }
  }
  flipX() {
    const out = new Pix(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) out.p[y * this.w + x] = this.p[y * this.w + (this.w - 1 - x)];
    return out;
  }
  toCanvas(scale = 1) {
    const c = document.createElement('canvas');
    c.width = this.w * scale;
    c.height = this.h * scale;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(this.w, this.h);
    for (let i = 0; i < this.p.length; i++) {
      const col = this.p[i];
      if (!col) continue;
      const [r, g, b] = hexToRgb(col);
      img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255;
    }
    if (scale === 1) ctx.putImageData(img, 0, 0);
    else {
      const t = document.createElement('canvas');
      t.width = this.w; t.height = this.h;
      t.getContext('2d').putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(t, 0, 0, c.width, c.height);
    }
    return c;
  }
}

// gerador pseudoaleatório local para variações de sprites
export function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a ^= a << 13; a ^= a >>> 17; a ^= a << 5;
    return ((a >>> 0) % 100000) / 100000;
  };
}
