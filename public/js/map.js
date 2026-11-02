// Génération procédurale d'une petite ville vue du ciel (grille de tuiles).

export const T = { GRASS: 0, ROAD: 1, BUILDING: 2, WATER: 3, PARK: 4, BRIDGE: 5, FOREST: 6 };
export const W = 64;
export const H = 40;
export const METERS_PER_TILE = 25;

export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Lieux nommés de la ville. `id` = type (unique sur la carte).
export const LOCATION_TYPES = [
  { type: 'home', name: 'Votre domicile', emoji: '🏠', color: '#f2cc8f' },
  { type: 'neighbor', name: 'Maison des voisins (les Martin)', emoji: '🏡', color: '#e9d8a6' },
  { type: 'grandparents', name: 'Maison des grands-parents', emoji: '👵', color: '#e9d8a6' },
  { type: 'school', name: 'École Jules-Ferry', emoji: '🏫', color: '#f4a261' },
  { type: 'work', name: 'Bureaux Axe-Industrie (travail)', emoji: '🏢', color: '#a8dadc' },
  { type: 'supermarket', name: 'Supermarché', emoji: '🛒', color: '#e76f51' },
  { type: 'hardware', name: 'Magasin de bricolage', emoji: '🔧', color: '#ee9b00' },
  { type: 'pharmacy', name: 'Pharmacie', emoji: '💊', color: '#95d5b2' },
  { type: 'hospital', name: 'Hôpital Saint-Louis', emoji: '🏥', color: '#ffffff' },
  { type: 'police', name: 'Commissariat', emoji: '🚓', color: '#8ecae6' },
  { type: 'firestation', name: 'Caserne des pompiers', emoji: '🚒', color: '#ef476f' },
  { type: 'gas', name: 'Station-service', emoji: '⛽', color: '#ffd166' },
  { type: 'townhall', name: 'Mairie', emoji: '🏛️', color: '#cdb4db' },
  { type: 'gym', name: 'Gymnase municipal', emoji: '🏟️', color: '#bde0fe' },
  { type: 'station', name: 'Gare', emoji: '🚉', color: '#b7b7a4' },
  { type: 'church', name: 'Église', emoji: '⛪', color: '#ddbea9' },
  { type: 'park', name: 'Parc municipal', emoji: '🌳', block: 'park' },
  { type: 'hill', name: 'Colline boisée', emoji: '⛰️', block: 'forest' },
];

export function generateMap(seed) {
  const r = mulberry32(seed);
  const ri = (a, b) => a + Math.floor(r() * (b - a + 1));
  const tiles = new Uint8Array(W * H).fill(T.GRASS);
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const set = (x, y, v) => { if (inside(x, y)) tiles[y * W + x] = v; };
  const get = (x, y) => (inside(x, y) ? tiles[y * W + x] : -1);

  // --- Routes ---
  const vx = [];
  for (let x = ri(1, 3); x < W - 2; x += ri(7, 10)) vx.push(x);
  const hy = [];
  for (let y = ri(1, 3); y < H - 2; y += ri(6, 8)) hy.push(y);

  // La rivière remplace une avenue verticale (côté droit du centre).
  const k = Math.max(1, Math.min(vx.length - 2, Math.round(vx.length * 0.6)));
  const riverBase = vx[k];
  for (const x of vx) if (x !== riverBase) for (let y = 0; y < H; y++) set(x, y, T.ROAD);
  for (const y of hy) for (let x = 0; x < W; x++) set(x, y, T.ROAD);

  // --- Rivière ---
  const riverX = [];
  let cx = riverBase;
  for (let y = 0; y < H; y++) {
    if (r() < 0.25) cx += r() < 0.5 ? -1 : 1;
    cx = Math.max(riverBase - 2, Math.min(riverBase + 2, cx));
    riverX[y] = cx;
    for (let dx = -1; dx <= 1; dx++) set(cx + dx, y, T.WATER);
  }

  // --- Ponts (une route horizontale sur deux) ---
  const bridges = [];
  hy.forEach((y, i) => {
    if (i % 2 === 0 || hy.length < 4) {
      for (let dx = -3; dx <= 3; dx++) {
        const t = get(riverX[y] + dx, y);
        if (t === T.WATER) set(riverX[y] + dx, y, T.BRIDGE);
        else if (t === T.GRASS) set(riverX[y] + dx, y, T.ROAD);
      }
      bridges.push({ x: riverX[y], y });
    }
  });

  // --- Îlots ---
  const xs = [-1, ...vx, W];
  const ys = [-1, ...hy, H];
  const blocks = [];
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      let x0 = xs[i] + 1, x1 = xs[i + 1] - 1;
      const y0 = ys[j] + 1, y1 = ys[j + 1] - 1;
      if (xs[i + 1] === riverBase) x1 = riverBase - 4;
      if (xs[i] === riverBase) x0 = riverBase + 4;
      if (x1 - x0 < 1 || y1 - y0 < 1) continue;
      const edge = x0 <= 0 || y0 <= 0 || x1 >= W - 1 || y1 >= H - 1;
      blocks.push({ id: blocks.length, x0, y0, x1, y1, edge, kind: 'building', lots: [], cx: (x0 + x1 + 1) / 2, cy: (y0 + y1 + 1) / 2 });
    }
  }

  // Parc central + forêts en bordure
  const interior = blocks.filter((b) => !b.edge && b.x1 - b.x0 >= 3 && b.y1 - b.y0 >= 3);
  const park = interior.length ? interior[Math.floor(r() * interior.length)] : blocks[0];
  park.kind = 'park';
  const edges = blocks.filter((b) => b.edge && b !== park);
  for (const b of edges) if (r() < 0.3) b.kind = 'forest';
  if (!blocks.some((b) => b.kind === 'forest') && edges.length) edges[Math.floor(r() * edges.length)].kind = 'forest';

  // --- Lieux ---
  const locations = [];
  const buildingBlocks = blocks.filter((b) => b.kind === 'building' && b.x1 - b.x0 >= 1 && b.y1 - b.y0 >= 1);
  const used = new Set();
  const pick = (filter, sortKey) => {
    let cands = buildingBlocks.filter((b) => !used.has(b.id) && (!filter || filter(b)));
    if (!cands.length) cands = buildingBlocks.filter((b) => !used.has(b.id));
    if (!cands.length) return null;
    if (sortKey) cands.sort((a, b) => sortKey(a) - sortKey(b));
    const b = sortKey ? cands[0] : cands[Math.floor(r() * cands.length)];
    used.add(b.id);
    return b;
  };

  const blockFor = {};
  blockFor.home = pick((b) => b.cx < riverBase - 8 && !b.edge);
  const home = blockFor.home;
  blockFor.neighbor = pick(null, (b) => Math.hypot(b.cx - home.cx, b.cy - home.cy));
  blockFor.grandparents = pick((b) => b.cx > riverBase + 4);
  blockFor.school = pick((b) => Math.hypot(b.cx - home.cx, b.cy - home.cy) > 10);
  blockFor.work = pick((b) => Math.hypot(b.cx - home.cx, b.cy - home.cy) > 18);
  for (const lt of LOCATION_TYPES) {
    if (lt.block || blockFor[lt.type] !== undefined) continue;
    blockFor[lt.type] = pick();
  }
  const forest = blocks.filter((b) => b.kind === 'forest').sort((a, b) => (b.x1 - b.x0) * (b.y1 - b.y0) - (a.x1 - a.x0) * (a.y1 - a.y0))[0];
  blockFor.park = park;
  blockFor.hill = forest;

  for (const lt of LOCATION_TYPES) {
    const b = blockFor[lt.type];
    if (!b) continue;
    b.location = lt.type;
    const door = findDoor(b, get);
    locations.push({ id: lt.type, type: lt.type, name: lt.name, emoji: lt.emoji, color: lt.color, x: b.cx, y: b.cy, door, block: b.id });
  }

  const bridgeNames = bridges.length === 3 ? ['Pont Nord', 'Pont Central', 'Pont Sud'] : bridges.length === 2 ? ['Pont Nord', 'Pont Sud'] : bridges.map((_, i) => `Pont n°${i + 1}`);
  bridges.forEach((b, i) => {
    locations.push({ id: `bridge_${i + 1}`, type: 'bridge', name: bridgeNames[i], emoji: '🌉', x: b.x + 0.5, y: b.y + 0.5, door: { x: b.x, y: b.y } });
  });

  // --- Remplissage des tuiles des îlots ---
  for (const b of blocks) {
    if (b.kind === 'park') { fill(b, T.PARK); continue; }
    if (b.kind === 'forest') { fill(b, T.FOREST); continue; }
    if (b.location) {
      b.lots.push({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 });
    } else {
      // Découpe en 1 à 3 bâtiments séparés par des cours
      const horiz = b.x1 - b.x0 >= b.y1 - b.y0;
      const len = horiz ? b.x1 - b.x0 + 1 : b.y1 - b.y0 + 1;
      const n = len >= 7 ? ri(1, 3) : len >= 4 ? ri(1, 2) : 1;
      const cuts = [];
      for (let c = 1; c < n; c++) cuts.push(Math.round((len * c) / n));
      let start = 0;
      for (const c of [...cuts, len + 1]) {
        const end = Math.min(c - 1, len - 1);
        if (end - start >= 0) {
          b.lots.push(horiz ? { x0: b.x0 + start, y0: b.y0, x1: b.x0 + end, y1: b.y1 } : { x0: b.x0, y0: b.y0 + start, x1: b.x1, y1: b.y0 + end });
        }
        start = c + 1;
      }
    }
    for (const l of b.lots) for (let y = l.y0; y <= l.y1; y++) for (let x = l.x0; x <= l.x1; x++) set(x, y, T.BUILDING);
  }

  function fill(b, v) {
    for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) if (get(x, y) === T.GRASS) set(x, y, v);
  }

  return { seed, W, H, tiles, blocks, locations, riverX, bridges };
}

// Trouve la tuile de route adjacente à l'îlot la plus proche de son centre.
function findDoor(b, get) {
  let best = null, bestD = Infinity;
  for (let x = b.x0 - 1; x <= b.x1 + 1; x++) {
    for (let y = b.y0 - 1; y <= b.y1 + 1; y++) {
      const onBorder = x === b.x0 - 1 || x === b.x1 + 1 || y === b.y0 - 1 || y === b.y1 + 1;
      if (!onBorder) continue;
      const t = get(x, y);
      if (t !== T.ROAD && t !== T.BRIDGE) continue;
      const d = Math.hypot(x + 0.5 - b.cx, y + 0.5 - b.cy);
      if (d < bestD) { bestD = d; best = { x, y }; }
    }
  }
  return best || { x: Math.floor(b.cx), y: Math.floor(b.cy) };
}
