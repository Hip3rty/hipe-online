// Carrega as folhas de sprites gratuitas (Kenney "Tiny Town" e "Tiny Dungeon", licença CC0)
// e oferece acesso por índice (folhas 12x11 tiles de 16x16, sem espaçamento).
const SHEETS = { town: './assets/town.png', dungeon: './assets/dungeon.png' };
export const sheets = {};
const tileCache = new Map();

export async function loadAssets() {
  await Promise.all(Object.entries(SHEETS).map(([k, src]) => new Promise((res) => {
    const img = new Image();
    img.onload = () => { sheets[k] = img; res(); };
    img.onerror = () => { console.warn('asset não carregou', src); res(); };
    img.src = src;
  })));
}

export function hasSheet(k) {
  return !!sheets[k];
}

// desenha o tile "i" da folha em (x, y)
export function drawTile(ctx, sheet, i, x, y, w = 16, h = 16) {
  const img = sheets[sheet];
  if (!img) return false;
  ctx.drawImage(img, (i % 12) * 16, Math.floor(i / 12) * 16, 16, 16, x, y, w, h);
  return true;
}

// tile como canvas próprio (para ícones/sprites e flip)
export function tileCanvas(sheet, i) {
  const k = sheet + i;
  let c = tileCache.get(k);
  if (c) return c;
  if (!sheets[sheet]) return null;
  c = document.createElement('canvas');
  c.width = c.height = 16;
  drawTile(c.getContext('2d'), sheet, i, 0, 0);
  tileCache.set(k, c);
  return c;
}
