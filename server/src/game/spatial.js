// Grade espacial: consulta rápida de entidades próximas (AOI, combate, IA).
import { CELL } from '@hipe/shared/constants.js';

export class SpatialGrid {
  constructor() {
    this.cells = new Map();
  }
  key(cx, cy) {
    return cx * 4096 + cy;
  }
  insert(e) {
    const cx = Math.floor(e.x / CELL), cy = Math.floor(e.y / CELL);
    const k = this.key(cx, cy);
    e._cell = k;
    let set = this.cells.get(k);
    if (!set) this.cells.set(k, (set = new Set()));
    set.add(e);
  }
  remove(e) {
    if (e._cell == null) return;
    const set = this.cells.get(e._cell);
    if (set) { set.delete(e); if (!set.size) this.cells.delete(e._cell); }
    e._cell = null;
  }
  update(e) {
    const k = this.key(Math.floor(e.x / CELL), Math.floor(e.y / CELL));
    if (k !== e._cell) { this.remove(e); this.insert(e); }
  }
  *near(x, y, radius) {
    const r2 = radius * radius;
    const c0x = Math.floor((x - radius) / CELL), c1x = Math.floor((x + radius) / CELL);
    const c0y = Math.floor((y - radius) / CELL), c1y = Math.floor((y + radius) / CELL);
    for (let cx = c0x; cx <= c1x; cx++) {
      for (let cy = c0y; cy <= c1y; cy++) {
        const set = this.cells.get(this.key(cx, cy));
        if (!set) continue;
        for (const e of set) {
          const dx = e.x - x, dy = e.y - y;
          if (dx * dx + dy * dy <= r2) yield e;
        }
      }
    }
  }
}
