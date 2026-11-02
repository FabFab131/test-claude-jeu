// Rendu canvas de la carte vue du ciel + animations.
import { T, mulberry32 } from './map.js';

export const TILE = 16;

const COLORS = {
  grass: '#b5c99a',
  road: '#6b705c',
  roadLine: '#d6d3c4',
  water: '#4ea8de',
  waterDeep: '#3a86c8',
  bridge: '#9c6644',
  park: '#90be6d',
  forest: '#5a8f5a',
  tree: '#2d6a4f',
  building: '#c9c5ba',
  buildingEdge: '#7f7a6e',
  roof: '#dedad0',
};

export const OBSTACLE_ICONS = {
  violent_group: '👊', armed_group: '🔫', roadblock: '🚧', checkpoint: '🛂', fire: '🔥', debris: '🧱',
  flood: '🌊', crowd: '👥', looters: '🦹', accident: '💥', collapsed_building: '🏚️', gas_leak: '☁️',
  animal: '🐕', other: '⚠️',
};

export const ZONE_STYLES = {
  flood: { color: '58,134,255', label: '🌊' },
  fire: { color: '230,57,70', label: '🔥' },
  smoke: { color: '90,90,90', label: '💨' },
  toxic_cloud: { color: '190,200,40', label: '☣️' },
  riot: { color: '200,40,120', label: '⚠️' },
  gunfire: { color: '160,0,0', label: '💥' },
  blackout: { color: '10,10,30', label: '🌑' },
  collapse: { color: '120,90,60', label: '🏚️' },
  safe: { color: '60,200,120', label: '🛡️' },
  other: { color: '255,140,0', label: '⚠️' },
};

export class Renderer {
  constructor(canvas, state) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = state;
    this.base = null;
    this.anim = null; // déplacement en cours
    this.time = 0;
    this.hoverLoc = null;
    this.night = 0;
  }

  setMap(map) {
    this.map = map;
    this.canvas.width = map.W * TILE;
    this.canvas.height = map.H * TILE;
    this.base = this.drawBase(map);
    this.overlay = document.createElement('canvas');
    this.overlay.width = this.canvas.width;
    this.overlay.height = this.canvas.height;
  }

  drawBase(map) {
    const c = document.createElement('canvas');
    c.width = map.W * TILE; c.height = map.H * TILE;
    const g = c.getContext('2d');
    const r = mulberry32(map.seed ^ 0x9e3779b9);
    const at = (x, y) => (x < 0 || y < 0 || x >= map.W || y >= map.H ? -1 : map.tiles[y * map.W + x]);
    const isRoad = (t) => t === T.ROAD || t === T.BRIDGE;

    g.fillStyle = COLORS.grass; g.fillRect(0, 0, c.width, c.height);
    // herbe texturée
    for (let i = 0; i < 900; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
      g.fillRect(r() * c.width, r() * c.height, 2, 2);
    }

    for (let y = 0; y < map.H; y++) {
      for (let x = 0; x < map.W; x++) {
        const t = at(x, y); const px = x * TILE, py = y * TILE;
        if (t === T.WATER) {
          g.fillStyle = COLORS.water; g.fillRect(px, py, TILE, TILE);
          g.fillStyle = 'rgba(255,255,255,0.18)';
          if (r() < 0.3) g.fillRect(px + r() * 10, py + r() * 12, 5, 1);
        } else if (t === T.ROAD) {
          g.fillStyle = COLORS.road; g.fillRect(px, py, TILE, TILE);
        } else if (t === T.BRIDGE) {
          g.fillStyle = COLORS.bridge; g.fillRect(px, py, TILE, TILE);
          g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(px, py, TILE, 2); g.fillRect(px, py + TILE - 2, TILE, 2);
        } else if (t === T.PARK) {
          g.fillStyle = COLORS.park; g.fillRect(px, py, TILE, TILE);
        } else if (t === T.FOREST) {
          g.fillStyle = COLORS.forest; g.fillRect(px, py, TILE, TILE);
        }
      }
    }
    // marquages au sol
    g.fillStyle = COLORS.roadLine;
    for (let y = 0; y < map.H; y++) {
      for (let x = 0; x < map.W; x++) {
        if (at(x, y) !== T.ROAD) continue;
        const h = isRoad(at(x - 1, y)) && isRoad(at(x + 1, y));
        const v = isRoad(at(x, y - 1)) && isRoad(at(x, y + 1));
        if (h && !v && x % 2 === 0) g.fillRect(x * TILE + 4, y * TILE + TILE / 2 - 1, 8, 2);
        if (v && !h && y % 2 === 0) g.fillRect(x * TILE + TILE / 2 - 1, y * TILE + 4, 2, 8);
      }
    }
    // arbres
    const tree = (x, y, s) => {
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.arc(x + 2, y + 2, s, 0, Math.PI * 2); g.fill();
      g.fillStyle = COLORS.tree; g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.arc(x - s / 3, y - s / 3, s / 2, 0, Math.PI * 2); g.fill();
    };
    for (let y = 0; y < map.H; y++) {
      for (let x = 0; x < map.W; x++) {
        const t = at(x, y);
        if (t === T.FOREST) for (let i = 0; i < 2; i++) tree(x * TILE + r() * TILE, y * TILE + r() * TILE, 4 + r() * 3);
        else if (t === T.PARK && r() < 0.22) tree(x * TILE + r() * TILE, y * TILE + r() * TILE, 3 + r() * 3);
        else if (t === T.GRASS && r() < 0.04) tree(x * TILE + r() * TILE, y * TILE + r() * TILE, 3 + r() * 2);
      }
    }
    // bâtiments
    const locByBlock = new Map(map.locations.filter((l) => l.block !== undefined).map((l) => [l.block, l]));
    for (const b of map.blocks) {
      const loc = locByBlock.get(b.id);
      for (const l of b.lots) {
        const px = l.x0 * TILE + 1, py = l.y0 * TILE + 1;
        const w = (l.x1 - l.x0 + 1) * TILE - 2, h = (l.y1 - l.y0 + 1) * TILE - 2;
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(px + 3, py + 3, w, h);
        g.fillStyle = loc && loc.color ? loc.color : shade(COLORS.building, (r() - 0.5) * 30);
        g.fillRect(px, py, w, h);
        g.strokeStyle = COLORS.buildingEdge; g.lineWidth = 1; g.strokeRect(px + 0.5, py + 0.5, w - 1, h - 1);
        g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(px + 3, py + 3, w - 6, Math.max(2, h / 2 - 3));
        if (!loc) {
          // petits équipements de toit
          for (let i = 0; i < Math.floor((w * h) / 400); i++) {
            g.fillStyle = 'rgba(0,0,0,0.15)';
            g.fillRect(px + 3 + r() * (w - 9), py + 3 + r() * (h - 9), 4, 4);
          }
        }
      }
    }
    return c;
  }

  locPos(loc) { return { x: loc.x * TILE, y: loc.y * TILE }; }

  // Anime le joueur le long d'un chemin. onStep(x, y) appelé à chaque tuile.
  animatePath(path, onStep) {
    return new Promise((resolve) => {
      if (!path || path.length < 2) { resolve(); return; }
      const speed = Math.max(7, path.length / 7); // tuiles / seconde
      this.anim = { path, i: 0, t: 0, speed, onStep, resolve };
    });
  }

  update(dt) {
    this.time += dt;
    const s = this.state;
    if (this.anim) {
      const a = this.anim;
      a.t += dt * a.speed;
      while (a.t >= 1 && a.i < a.path.length - 1) {
        a.t -= 1; a.i++;
        s.player.x = a.path[a.i].x; s.player.y = a.path[a.i].y;
        a.onStep && a.onStep(s.player.x, s.player.y);
      }
      if (a.i >= a.path.length - 1) {
        s.player.px = (s.player.x + 0.5) * TILE; s.player.py = (s.player.y + 0.5) * TILE;
        this.anim = null; a.resolve();
      } else {
        const p0 = a.path[a.i], p1 = a.path[a.i + 1];
        s.player.px = (p0.x + (p1.x - p0.x) * a.t + 0.5) * TILE;
        s.player.py = (p0.y + (p1.y - p0.y) * a.t + 0.5) * TILE;
      }
    } else if (s.player) {
      s.player.px = (s.player.x + 0.5) * TILE; s.player.py = (s.player.y + 0.5) * TILE;
    }
    // proches : suivent le joueur ou rejoignent leur lieu
    const followers = s.companions.filter((c) => c.location === 'player');
    s.companions.forEach((c, idx) => {
      let tx, ty;
      if (c.location === 'player') {
        const k = followers.indexOf(c);
        const ang = this.time * 0.8 + (k * Math.PI * 2) / Math.max(1, followers.length);
        tx = s.player.px + Math.cos(ang) * 9; ty = s.player.py + Math.sin(ang) * 9;
      } else {
        const loc = s.locById(c.location);
        if (!loc) return;
        const p = this.locPos(loc);
        tx = p.x + (idx - 1) * 10; ty = p.y - 16;
      }
      if (c.rx === undefined) { c.rx = tx; c.ry = ty; }
      const dx = tx - c.rx, dy = ty - c.ry, d = Math.hypot(dx, dy);
      const step = Math.max(90, d * 3) * dt;
      if (d <= step) { c.rx = tx; c.ry = ty; } else { c.rx += (dx / d) * step; c.ry += (dy / d) * step; }
    });
  }

  draw() {
    const g = this.ctx, s = this.state;
    if (!this.base) return;
    g.drawImage(this.base, 0, 0);

    // zones
    for (const z of s.zones) {
      const st = ZONE_STYLES[z.kind] || ZONE_STYLES.other;
      const cx = (z.x + 0.5) * TILE, cy = (z.y + 0.5) * TILE, rad = z.radius * TILE;
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 2 + z.x);
      const grad = g.createRadialGradient(cx, cy, rad * 0.2, cx, cy, rad);
      grad.addColorStop(0, `rgba(${st.color},${0.45 + pulse * 0.1})`);
      grad.addColorStop(1, `rgba(${st.color},0.08)`);
      g.fillStyle = grad; g.beginPath(); g.arc(cx, cy, rad, 0, Math.PI * 2); g.fill();
      g.setLineDash([6, 4]);
      g.strokeStyle = `rgba(${st.color},${z.blocking ? 0.95 : 0.6})`; g.lineWidth = z.blocking ? 2 : 1;
      g.stroke(); g.setLineDash([]);
      g.font = '14px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(st.label, cx, cy - rad + 10);
    }

    // chemin en cours
    if (this.anim) {
      const a = this.anim;
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 2; g.setLineDash([3, 5]);
      g.beginPath();
      g.moveTo(s.player.px, s.player.py);
      for (let i = a.i + 1; i < a.path.length; i++) g.lineTo((a.path[i].x + 0.5) * TILE, (a.path[i].y + 0.5) * TILE);
      g.stroke(); g.setLineDash([]);
      const end = a.path[a.path.length - 1];
      g.strokeStyle = '#fff'; g.beginPath(); g.arc((end.x + 0.5) * TILE, (end.y + 0.5) * TILE, 5 + Math.sin(this.time * 6) * 1.5, 0, Math.PI * 2); g.stroke();
    }

    // lieux
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const loc of this.map.locations) {
      const p = this.locPos(loc);
      const hover = this.hoverLoc === loc.id;
      g.font = `${hover ? 20 : 16}px sans-serif`;
      g.fillText(loc.emoji, p.x, p.y - 2);
      if (hover || loc.type !== 'bridge') {
        g.font = `${hover ? 'bold ' : ''}10px system-ui, sans-serif`;
        const label = shortName(loc.name);
        g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.9)'; g.strokeText(label, p.x, p.y + 13);
        g.fillStyle = '#1d1d1d'; g.fillText(label, p.x, p.y + 13);
      }
    }

    // obstacles
    for (const o of s.obstacles) {
      const cx = (o.x + 0.5) * TILE, cy = (o.y + 0.5) * TILE;
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 5);
      g.fillStyle = `rgba(220,30,30,${0.25 + pulse * 0.25})`;
      g.beginPath(); g.arc(cx, cy, 11 + pulse * 2, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#b00000'; g.lineWidth = 2; g.stroke();
      g.font = '15px sans-serif'; g.fillStyle = '#000';
      g.fillText(OBSTACLE_ICONS[o.kind] || OBSTACLE_ICONS.other, cx, cy + 1);
    }

    // proches
    for (const c of s.companions) {
      if (c.rx === undefined) continue;
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.arc(c.rx + 1.5, c.ry + 1.5, 5, 0, Math.PI * 2); g.fill();
      g.fillStyle = c.color || '#ffb703'; g.beginPath(); g.arc(c.rx, c.ry, 5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke();
      g.font = 'bold 7px sans-serif'; g.fillStyle = '#000';
      g.fillText((c.name || '?')[0].toUpperCase(), c.rx, c.ry + 0.5);
    }

    // joueur
    if (s.player && s.player.px !== undefined) {
      const { px, py } = s.player;
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 4);
      g.strokeStyle = `rgba(0,180,255,${0.4 + pulse * 0.4})`; g.lineWidth = 2;
      g.beginPath(); g.arc(px, py, 10 + pulse * 3, 0, Math.PI * 2); g.stroke();
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(px + 2, py + 2, 6.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#0077ff'; g.beginPath(); g.arc(px, py, 6.5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke();
    }

    // nuit / obscurité
    if (this.night > 0.01) {
      const o = this.overlay.getContext('2d');
      o.globalCompositeOperation = 'source-over';
      o.clearRect(0, 0, this.overlay.width, this.overlay.height);
      o.fillStyle = `rgba(5,10,35,${this.night})`;
      o.fillRect(0, 0, this.overlay.width, this.overlay.height);
      o.globalCompositeOperation = 'destination-out';
      const light = (x, y, rad, a = 1) => {
        const gr = o.createRadialGradient(x, y, 0, x, y, rad);
        gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
        o.fillStyle = gr; o.beginPath(); o.arc(x, y, rad, 0, Math.PI * 2); o.fill();
      };
      if (s.player) light(s.player.px, s.player.py, s.hasLight ? TILE * 7 : TILE * 3.5);
      for (const loc of this.map.locations) {
        const lit = s.litLocations ? s.litLocations.includes(loc.type) : true;
        const p = this.locPos(loc);
        light(p.x, p.y, TILE * (lit ? 3 : 1.6), lit ? 0.9 : 0.6);
      }
      for (const z of s.zones) if (z.kind === 'fire') light((z.x + 0.5) * TILE, (z.y + 0.5) * TILE, z.radius * TILE * 1.2, 0.8);
      g.drawImage(this.overlay, 0, 0);
    }
  }

  start() {
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      this.update(dt); this.draw();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // Convertit un clic écran en coordonnées tuile
  toTile(ev) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((ev.clientX - rect.left) / rect.width) * this.map.W,
      y: ((ev.clientY - rect.top) / rect.height) * this.map.H,
    };
  }
}

function shortName(n) {
  return n.replace(/\s*\(.*\)$/, '').replace(/^Votre /, '').replace(/ Jules-Ferry| Saint-Louis| Axe-Industrie/, '');
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const cl = (v) => Math.max(0, Math.min(255, v));
  const rr = cl((n >> 16) + amt), gg = cl(((n >> 8) & 255) + amt), bb = cl((n & 255) + amt);
  return `rgb(${rr | 0},${gg | 0},${bb | 0})`;
}
