// Boucle de jeu : état, échanges avec le maître du jeu, application des tours.
import { generateMap, METERS_PER_TILE, T } from './map.js';
import { findPath, distanceField } from './pathfinding.js';
import { Renderer, OBSTACLE_ICONS, ZONE_STYLES } from './render.js';
import { SCENARIOS, scenarioById } from './scenarios.js';
import * as ui from './ui.js';
import * as gm from './gm.js';

const WALK_M_PER_MIN = 80;
const COMPANION_COLORS = ['#ffb703', '#fb8500', '#c77dff', '#ff006e', '#80ed99'];
const HISTORY_SENT = 12;

const state = {
  mode: 'demo',
  available: 'demo',
  model: null,
  scenario: null,
  map: null,
  player: null,
  companions: [],
  obstacles: [],
  zones: [],
  objectives: [],
  time: '',
  history: [],
  turn: 0,
  status: 'ongoing',
  busy: false,
  minutes: {},
  locById: (id) => state.map?.locations.find((l) => l.id === id),
};

const canvas = document.getElementById('map');
const renderer = new Renderer(canvas, state);
let rendererStarted = false;

// ---------- Démarrage ----------
async function init() {
  const st = await gm.getStatus();
  state.available = st.mode; state.model = st.model; state.hint = st.hint;
  openStart();

  document.getElementById('action-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('action');
    const text = input.value.trim();
    if (!text || state.busy || state.status !== 'ongoing') return;
    input.value = '';
    playTurn(text);
  });
  document.getElementById('action').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); document.getElementById('action-form').requestSubmit(); }
  });
  document.getElementById('new-game').addEventListener('click', () => {
    if (state.busy) return;
    openStart();
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!state.map) return;
    const loc = locAtScreen(e);
    renderer.hoverLoc = loc?.id || null;
    canvas.style.cursor = loc ? 'pointer' : 'default';
    if (loc) {
      const m = state.minutes[loc.id];
      ui.showTooltip(`${loc.emoji} ${loc.name}${m === null ? ' — accès bloqué' : m !== undefined ? ` — ~${m} min à pied` : ''}`, e.clientX, e.clientY);
    } else {
      const o = obstacleAtScreen(e);
      ui.showTooltip(o ? `${OBSTACLE_ICONS[o.kind] || '⚠️'} ${o.label}` : null, e.clientX, e.clientY);
    }
  });
  canvas.addEventListener('mouseleave', () => { renderer.hoverLoc = null; ui.showTooltip(null); });
  canvas.addEventListener('click', (e) => {
    const loc = locAtScreen(e);
    if (!loc || state.busy) return;
    const input = document.getElementById('action');
    input.value = (input.value.trim() ? `${input.value.trim()} Puis je vais ` : 'Je vais ') + `à : ${loc.name}. `;
    input.focus();
  });
}

function locAtScreen(e) {
  const p = renderer.toTile(e);
  let best = null, bd = 1.3;
  for (const l of state.map.locations) {
    const d = Math.hypot(l.x - p.x, l.y - p.y);
    if (d < bd) { bd = d; best = l; }
  }
  return best;
}
function obstacleAtScreen(e) {
  const p = renderer.toTile(e);
  return state.obstacles.find((o) => Math.hypot(o.x + 0.5 - p.x, o.y + 0.5 - p.y) < 1);
}

function openStart() {
  const resumable = !!state.map && state.status === 'ongoing' && state.turn > 0;
  ui.showStart(SCENARIOS, { mode: state.available, model: state.model, hint: state.hint, resumable }, startGame);
}

async function startGame(scenarioId, { demo = false } = {}) {
  ui.hideStart();
  state.mode = state.available === 'ai' && !demo ? 'ai' : 'demo';
  ui.clearJournal();
  ui.renderSuggestions([]);
  const scenario = scenarioById(scenarioId);
  const seed = (Math.random() * 2 ** 31) | 0;
  state.map = generateMap(seed);
  state.scenario = scenario;
  const home = state.locById('home');
  state.player = { x: home.door.x, y: home.door.y, health: 100, inventory: ['Téléphone portable', 'Clés', 'Portefeuille'], condition: 'En forme' };
  state.companions = [];
  state.obstacles = [];
  state.zones = [];
  state.objectives = [];
  state.time = scenario.start;
  state.history = [];
  state.turn = 0;
  state.status = 'ongoing';
  renderer.setMap(state.map);
  if (!rendererStarted) { renderer.start(); rendererStarted = true; }
  refreshDerived();
  ui.setHeader(scenario, state.time);
  ui.renderStatus(state);
  await playTurn('__DEBUT__');
}

// ---------- Contexte envoyé au maître du jeu ----------
function blockedSet({ zones = true } = {}) {
  const s = new Set();
  const { W, H } = state.map;
  for (const o of state.obstacles) s.add(o.y * W + o.x);
  if (zones) {
    for (const z of state.zones) {
      if (!z.blocking) continue;
      for (let y = Math.max(0, Math.floor(z.y - z.radius)); y <= Math.min(H - 1, Math.ceil(z.y + z.radius)); y++)
        for (let x = Math.max(0, Math.floor(z.x - z.radius)); x <= Math.min(W - 1, Math.ceil(z.x + z.radius)); x++)
          if (Math.hypot(x - z.x, y - z.y) <= z.radius) s.add(y * W + x);
    }
  }
  return s;
}

function refreshDerived() {
  const dist = distanceField(state.map, state.player.x, state.player.y, blockedSet());
  state.minutes = {};
  for (const l of state.map.locations) {
    const d = dist[l.door.y * state.map.W + l.door.x];
    state.minutes[l.id] = isFinite(d) ? Math.max(1, Math.round((d * METERS_PER_TILE) / WALK_M_PER_MIN)) : null;
  }
  const hour = parseInt((state.time.match(/(\d{1,2})h/) || [])[1] ?? '12', 10);
  const blackout = state.scenario.id === 'blackout';
  let night = hour >= 20 || hour < 6 ? 0.55 : hour >= 18 || hour < 7 ? 0.3 : 0;
  if (blackout && night) night += 0.15;
  if (state.zones.some((z) => z.kind === 'smoke' || z.kind === 'toxic_cloud')) night = Math.max(night, 0.08);
  renderer.night = night;
  state.litLocations = blackout ? ['hospital', 'firestation'] : null;
  state.hasLight = state.player.inventory.some((i) => /lampe|torche|frontale|lanterne/i.test(i));
}

function nearestLocation(x, y) {
  let best = null, bd = Infinity;
  for (const l of state.map.locations) {
    const d = Math.hypot(l.door.x - x, l.door.y - y);
    if (d < bd) { bd = d; best = l; }
  }
  return { loc: best, d: bd };
}

function describePosition() {
  const { loc, d } = nearestLocation(state.player.x, state.player.y);
  if (d <= 1.5) return { at: loc.id, text: `Devant / à : ${loc.name} (${loc.id})` };
  return { at: null, near: loc.id, text: `Dans la rue, à environ ${Math.round(d * METERS_PER_TILE)} m de : ${loc.name} (${loc.id})` };
}

function buildContext(action) {
  return {
    mode: state.mode,
    action,
    turn: state.turn,
    scenario: { id: state.scenario.id, name: state.scenario.name, brief: state.scenario.brief, safe: state.scenario.safe },
    map: {
      description: `Ville de ${state.map.W}×${state.map.H} cases (1 case ≈ ${METERS_PER_TILE} m). Une rivière la traverse du nord au sud, franchissable uniquement par les ponts.`,
      locations: state.map.locations.map((l) => ({
        id: l.id, name: l.name, type: l.type,
        side: l.x < state.map.riverX[Math.floor(l.y)] ? 'ouest' : 'est',
        walk_minutes: state.minutes[l.id],
      })),
    },
    state: {
      time: state.time,
      position: describePosition(),
      health: state.player.health,
      condition: state.player.condition,
      inventory: state.player.inventory,
      companions: state.companions.map(({ id, name, role, location, status }) => ({ id, name, role, location, status })),
      objectives: state.objectives,
      obstacles: state.obstacles.map(({ id, kind, label, near }) => ({ id, kind, label, near })),
      zones: state.zones.map(({ id, kind, label, near, radius, blocking }) => ({ id, kind, label, near, radius, blocking })),
    },
    history: state.history.slice(-HISTORY_SENT),
  };
}

// ---------- Tour de jeu ----------
async function playTurn(action) {
  state.busy = true;
  ui.setBusy(true);
  ui.renderSuggestions([]);
  if (action !== '__DEBUT__') ui.addJournal('player', action);
  let res;
  try {
    res = await gm.requestTurn(buildContext(action));
    if (res._mode) state.mode = res._mode; // bascule automatique en mode démo
    if (res._notice) ui.addJournal('error', res._notice);
  } catch (e) {
    ui.addJournal('error', `Le maître du jeu ne répond pas (${e.message}). Réessayez.`);
    if (action !== '__DEBUT__') document.getElementById('action').value = action;
    state.busy = false;
    ui.setBusy(false);
    if (action === '__DEBUT__') ui.renderSuggestions(['Recommencer'], () => playTurn('__DEBUT__'));
    return;
  }
  await applyTurn(res, action);
  state.busy = false;
  ui.setBusy(false);
}

function placeNear(locId, avoid = new Set()) {
  const loc = state.locById(locId);
  if (!loc) return null;
  const { W, tiles } = state.map;
  // BFS sur les routes depuis l'entrée du lieu, on prend une case à ~2 de distance
  const start = loc.door;
  const seen = new Set([start.y * W + start.x]);
  let frontier = [start], depth = 0, candidate = start;
  while (frontier.length && depth < 2) {
    const next = [];
    for (const p of frontier) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = p.x + dx, ny = p.y + dy, i = ny * W + nx;
        if (nx < 0 || ny < 0 || nx >= W || ny >= state.map.H || seen.has(i)) continue;
        if (tiles[i] !== T.ROAD && tiles[i] !== T.BRIDGE) continue;
        seen.add(i); next.push({ x: nx, y: ny });
      }
    }
    if (next.length) {
      const free = next.filter((p) => !avoid.has(p.y * W + p.x));
      candidate = (free.length ? free : next)[0];
    }
    frontier = next; depth++;
  }
  return { x: candidate.x, y: candidate.y };
}

const arr = (v) => (Array.isArray(v) ? v : []);

async function applyTurn(res, action) {
  state.turn++;
  const W = state.map.W;

  // Obstacles & zones
  const rmO = new Set(arr(res.obstacles_remove));
  state.obstacles = state.obstacles.filter((o) => !rmO.has(o.id));
  const rmZ = new Set(arr(res.zones_remove));
  state.zones = state.zones.filter((z) => !rmZ.has(z.id));
  for (const o of arr(res.obstacles_add)) {
    if (!state.locById(o.near)) continue;
    state.obstacles = state.obstacles.filter((x) => x.id !== o.id);
    const taken = new Set(state.obstacles.map((x) => x.y * W + x.x));
    const p = placeNear(o.near, taken);
    if (p) state.obstacles.push({ id: o.id, kind: OBSTACLE_ICONS[o.kind] ? o.kind : 'other', label: o.label, near: o.near, ...p });
  }
  for (const z of arr(res.zones_add)) {
    const loc = state.locById(z.near);
    if (!loc) continue;
    state.zones = state.zones.filter((x) => x.id !== z.id);
    state.zones.push({
      id: z.id, kind: ZONE_STYLES[z.kind] ? z.kind : 'other', label: z.label, near: z.near,
      x: Math.floor(loc.x), y: Math.floor(loc.y), radius: Math.max(1, Math.min(16, Math.round(z.radius || 3))), blocking: !!z.blocking,
    });
  }

  // État du joueur
  if (res.player) {
    if (Number.isFinite(res.player.health)) state.player.health = Math.max(0, Math.min(100, Math.round(res.player.health)));
    if (Array.isArray(res.player.inventory)) state.player.inventory = res.player.inventory.map(String).slice(0, 30);
    if (typeof res.player.condition === 'string') state.player.condition = res.player.condition;
  }
  if (Array.isArray(res.objectives) && res.objectives.length) state.objectives = res.objectives.map((o) => ({ text: String(o.text), done: !!o.done }));
  if (typeof res.time === 'string' && res.time) state.time = res.time;

  // Proches : ceux qui rejoignent le joueur le font quand il passe à proximité
  const prev = new Map(state.companions.map((c) => [c.id, c]));
  const newCompanions = [];
  arr(res.companions).forEach((c, i) => {
    const old = prev.get(c.id);
    let loc = c.location === 'player' || state.locById(c.location) ? c.location : old?.location || 'home';
    const entry = {
      id: c.id, name: c.name, role: c.role, status: c.status,
      color: old?.color || COMPANION_COLORS[i % COMPANION_COLORS.length],
      rx: old?.rx, ry: old?.ry, location: loc,
    };
    if (loc === 'player' && old && old.location !== 'player' && (res.movements || []).length) {
      entry.location = old.location; entry.pendingJoin = true;
    }
    newCompanions.push(entry);
  });
  if (newCompanions.length) state.companions = newCompanions;

  ui.setHeader(state.scenario, state.time);
  ui.renderStatus(state);

  const narrationDone = new Promise((resolve) => ui.addJournal('gm', String(res.narration || '…'), { typewriter: true, onDone: resolve }));

  // Déplacements
  const checkJoins = (x, y) => {
    for (const c of state.companions) {
      if (!c.pendingJoin) continue;
      const loc = state.locById(c.location);
      if (loc && Math.hypot(loc.door.x - x, loc.door.y - y) <= 3) { c.location = 'player'; c.pendingJoin = false; ui.renderStatus(state); }
    }
  };
  let idx = 0;
  for (const m of arr(res.movements)) {
    const dest = state.locById(m.destination);
    if (!dest) continue;
    let path = findPath(state.map, state.player.x, state.player.y, dest.door.x, dest.door.y, blockedSet());
    if (!path) path = findPath(state.map, state.player.x, state.player.y, dest.door.x, dest.door.y, blockedSet({ zones: false }));
    if (!path) path = findPath(state.map, state.player.x, state.player.y, dest.door.x, dest.door.y);
    if (!path || path.length < 2) continue;
    const encounter = m.encounter && m.encounter.kind && m.encounter.kind !== 'none' ? m.encounter : null;
    const sf = typeof m.stop_fraction === 'number' ? m.stop_fraction : 1;
    let walk = path;
    let encounterTile = null;
    if (sf < 0.999 || encounter) {
      if (sf < 0.999 && path.length >= 3) {
        const stop = Math.max(1, Math.min(path.length - 2, Math.round((path.length - 1) * sf)));
        walk = path.slice(0, stop + 1);
        encounterTile = path[stop + 1];
      } else {
        encounterTile = placeNear(dest.id, new Set(state.obstacles.map((o) => o.y * W + o.x)));
      }
    }
    await renderer.animatePath(walk, checkJoins);
    if (encounter && encounterTile) {
      state.obstacles.push({
        id: `rencontre_${state.turn}_${idx}`, kind: OBSTACLE_ICONS[encounter.kind] ? encounter.kind : 'other',
        label: encounter.label || 'Obstacle', near: nearestLocation(encounterTile.x, encounterTile.y).loc.id,
        x: encounterTile.x, y: encounterTile.y,
      });
    }
    idx++;
    if (sf < 0.999) break; // le joueur a été arrêté
  }
  for (const c of state.companions) if (c.pendingJoin) { c.location = 'player'; c.pendingJoin = false; }

  refreshDerived();
  ui.renderStatus(state);
  await narrationDone;

  state.history.push({
    turn: state.turn,
    action: action === '__DEBUT__' ? '(début de partie)' : action,
    narration: String(res.narration || '').slice(0, 700),
  });

  state.status = ['won', 'lost'].includes(res.game_status) ? res.game_status : 'ongoing';
  if (state.player.health <= 0) state.status = 'lost';
  if (state.status !== 'ongoing') {
    setTimeout(() => ui.showEnd(state.status, String(res.narration || ''), state.turn, openStart), 900);
    ui.renderSuggestions([]);
  } else {
    ui.renderSuggestions(arr(res.suggestions).slice(0, 4), (s) => {
      const input = document.getElementById('action');
      input.value = s; input.focus();
    });
  }
}

init();
