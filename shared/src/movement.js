// Movimento com colisão. Usado pelo servidor (autoritativo) e pelo cliente (predição).
import { isBlocked } from './mapgen.js';

function collides(world, x, y, r, forMonster) {
  return (
    isBlocked(world, x - r, y - r, forMonster) ||
    isBlocked(world, x + r, y - r, forMonster) ||
    isBlocked(world, x - r, y + r, forMonster) ||
    isBlocked(world, x + r, y + r, forMonster)
  );
}

// Move separando eixos para permitir "deslizar" em paredes. Retorna true se moveu.
export function stepMove(world, pos, dx, dy, dist, radius, forMonster = false) {
  const len = Math.hypot(dx, dy);
  if (len < 1e-6 || dist <= 0) return false;
  const nx = (dx / len) * dist, ny = (dy / len) * dist;
  let moved = false;
  // subpassos evitam atravessar paredes em quadros longos
  const steps = Math.max(1, Math.ceil(dist / 0.25));
  for (let s = 0; s < steps; s++) {
    const sx = nx / steps, sy = ny / steps;
    if (!collides(world, pos.x + sx, pos.y, radius, forMonster)) { pos.x += sx; moved = true; }
    if (!collides(world, pos.x, pos.y + sy, radius, forMonster)) { pos.y += sy; moved = true; }
  }
  return moved;
}

export function dirFromVector(dx, dy, prev = 0) {
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return prev;
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 1 : 2;
  return dy < 0 ? 3 : 0;
}
