// Gera os ícones do app (PNG) em pixel art, sem dependências: node tools/make-icons.mjs
// Saída: client/public/icon-192.png, icon-512.png e, se existir, os mipmaps do projeto Android.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const N = 32;
const px = Array.from({ length: N }, () => new Array(N).fill(null));
const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < N && y < N) px[y][x] = c; };
const rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, c); };

// fundo roxo com borda dourada arredondada
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  const cx = Math.min(x, N - 1 - x), cy = Math.min(y, N - 1 - y);
  if (cx + cy < 3) continue;
  const edge = cx < 2 || cy < 2 || cx + cy < 5;
  set(x, y, edge ? (cx < 1 || cy < 1 ? '#8a6420' : '#e6b84a') : y < 16 ? '#3a2462' : '#2a1a48');
}
// estrelas
for (const [x, y] of [[6, 6], [25, 7], [8, 24], [26, 22]]) set(x, y, '#ffe9a0');
// escudo
for (let y = 9; y < 26; y++) {
  const w = y < 18 ? 7 : 7 - Math.ceil((y - 17) * 0.9);
  for (let x = 16 - w; x < 16 + w; x++) set(x, y, x === 16 - w || x === 15 + w || y === 9 ? '#1a1020' : x < 16 ? '#d84a3a' : '#a8302a');
}
rect(15, 11, 2, 12, '#ffd23a'); rect(11, 15, 10, 2, '#ffd23a');
// espada cruzada
for (let i = 0; i < 18; i++) { set(5 + i, 25 - i, '#e8ecf0'); set(6 + i, 25 - i, '#a9b0b8'); }
set(23, 7, '#ffffff');
rect(6, 21, 5, 2, '#e0b040'); rect(4, 24, 3, 3, '#6a4020');

function png(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const c = px[Math.floor((y * N) / size)][Math.floor((x * N) / size)];
      const o = y * (size * 4 + 1) + 1 + x * 4;
      if (c) { const n = parseInt(c.slice(1), 16); raw[o] = n >> 16; raw[o + 1] = (n >> 8) & 255; raw[o + 2] = n & 255; raw[o + 3] = 255; }
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = path.join(rootDir, 'client', 'public');
fs.mkdirSync(pub, { recursive: true });
fs.writeFileSync(path.join(pub, 'icon-192.png'), png(192));
fs.writeFileSync(path.join(pub, 'icon-512.png'), png(512));
console.log('ícones web gerados');

const res = path.join(rootDir, 'client', 'android', 'app', 'src', 'main', 'res');
if (fs.existsSync(res)) {
  const sizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
  for (const [d, s] of Object.entries(sizes)) {
    const dir = path.join(res, `mipmap-${d}`);
    if (!fs.existsSync(dir)) continue;
    for (const f of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']) fs.writeFileSync(path.join(dir, f), png(s));
  }
  // remove ícone adaptativo padrão do Capacitor para usar o nosso PNG
  const any = path.join(res, 'mipmap-anydpi-v26');
  if (fs.existsSync(any)) fs.rmSync(any, { recursive: true });
  console.log('ícones Android gerados');
}
