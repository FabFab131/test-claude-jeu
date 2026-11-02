// Serveur HTTP minimal : fichiers statiques + API du maître du jeu.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMockTurn } from './server/mock-gm.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(here, 'public');
const PORT = Number(process.env.PORT) || 3000;

const forced = (process.env.GM_MODE || '').toLowerCase();
const hasCreds = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const MODE = forced === 'demo' ? 'demo' : forced === 'ai' || hasCreds ? 'ai' : 'demo';

let ai = null;
if (MODE === 'ai') ai = await import('./server/ai-gm.js');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

function send(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function readBody(req, limit = 512 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('Requête trop volumineuse')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/api/status' && req.method === 'GET') {
      return send(res, 200, { mode: MODE, model: MODE === 'ai' ? ai.MODEL : null });
    }
    if (url.pathname === '/api/turn' && req.method === 'POST') {
      const ctx = JSON.parse(await readBody(req));
      if (!ctx || typeof ctx.action !== 'string' || !ctx.state || !ctx.map) return send(res, 400, { error: 'Contexte invalide' });
      const t0 = Date.now();
      const useAi = MODE === 'ai' && ctx.mode !== 'demo';
      const out = useAi ? await ai.runAiTurn(ctx) : runMockTurn(ctx);
      console.log(`[tour ${Number(ctx.turn) + 1}] ${useAi ? 'ai' : 'demo'} ${Date.now() - t0} ms — ${ctx.action.slice(0, 80)}`);
      return send(res, 200, out);
    }
    if (req.method !== 'GET') return send(res, 405, { error: 'Méthode non autorisée' });

    // Fichiers statiques
    const rel = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const file = path.normalize(path.join(PUBLIC, rel));
    if (!file.startsWith(PUBLIC + path.sep)) return send(res, 403, 'Interdit', 'text/plain');
    const data = await readFile(file).catch(() => null);
    if (!data) return send(res, 404, 'Introuvable', 'text/plain');
    return send(res, 200, data, MIME[path.extname(file)] || 'application/octet-stream');
  } catch (err) {
    console.error(err);
    return send(res, 500, { error: err.message || 'Erreur serveur' });
  }
});

server.listen(PORT, () => {
  console.log(`Survie — http://localhost:${PORT}`);
  console.log(MODE === 'ai' ? `Maître du jeu : IA (${ai.MODEL})` : 'Maître du jeu : mode démo (définissez ANTHROPIC_API_KEY pour activer l’IA)');
});
