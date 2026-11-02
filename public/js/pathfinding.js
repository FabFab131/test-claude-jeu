// Recherche de chemin (Dijkstra / A*) sur la grille de tuiles.
import { T } from './map.js';

export function tileCost(t) {
  switch (t) {
    case T.ROAD:
    case T.BRIDGE: return 1;
    case T.PARK: return 1.8;
    case T.GRASS: return 2.5;
    case T.FOREST: return 4;
    default: return Infinity;
  }
}

class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(item) {
    const a = this.a; a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]]; i = p;
    }
  }
  pop() {
    const a = this.a; const top = a[0]; const last = a.pop();
    if (a.length) {
      a[0] = last; let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * @param blocked Set d'indices de tuiles infranchissables (obstacles, zones)
 * @param extraCost Float32Array optionnel de surcoût par tuile (zones dangereuses)
 */
export function findPath(map, sx, sy, tx, ty, blocked = new Set(), extraCost = null) {
  const { W, H, tiles } = map;
  const start = sy * W + sx, goal = ty * W + tx;
  if (start === goal) return [{ x: sx, y: sy }];
  const dist = new Float32Array(W * H).fill(Infinity);
  const prev = new Int32Array(W * H).fill(-1);
  const heap = new Heap();
  dist[start] = 0;
  heap.push([0, start]);
  while (heap.size) {
    const [, cur] = heap.pop();
    if (cur === goal) break;
    const cx = cur % W, cy = (cur / W) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny * W + nx;
      if (ni !== goal && blocked.has(ni)) continue;
      const c = tileCost(tiles[ni]);
      if (!isFinite(c) && ni !== goal) continue;
      const nd = dist[cur] + (isFinite(c) ? c : 1) + (extraCost ? extraCost[ni] : 0);
      if (nd < dist[ni]) {
        dist[ni] = nd; prev[ni] = cur;
        const h = Math.abs(nx - tx) + Math.abs(ny - ty);
        heap.push([nd + h, ni]);
      }
    }
  }
  if (prev[goal] === -1) return null;
  const path = [];
  for (let i = goal; i !== -1; i = prev[i]) path.push({ x: i % W, y: (i / W) | 0 });
  return path.reverse();
}

// Coût de déplacement depuis (sx, sy) vers toutes les tuiles (en "tuiles de route équivalentes").
export function distanceField(map, sx, sy, blocked = new Set()) {
  const { W, H, tiles } = map;
  const dist = new Float32Array(W * H).fill(Infinity);
  const heap = new Heap();
  const start = sy * W + sx;
  dist[start] = 0;
  heap.push([0, start]);
  while (heap.size) {
    const [d, cur] = heap.pop();
    if (d > dist[cur]) continue;
    const cx = cur % W, cy = (cur / W) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny * W + nx;
      const c = tileCost(tiles[ni]);
      if (!isFinite(c)) continue;
      // Une tuile bloquée est atteignable (on peut s'y rendre) mais pas traversable.
      const nd = d + c;
      if (nd < dist[ni]) {
        dist[ni] = nd;
        if (!blocked.has(ni)) heap.push([nd, ni]);
      }
    }
  }
  return dist;
}
