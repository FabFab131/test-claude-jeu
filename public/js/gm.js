// Communication avec le maître du jeu via le serveur Node (/api).
// La version « lien » (artifact) remplace ce module par artifact/gm-artifact.js.

export async function getStatus() {
  try {
    return await fetch('/api/status').then((r) => r.json());
  } catch {
    return { mode: 'demo', model: null };
  }
}

export async function requestTurn(ctx) {
  const r = await fetch('/api/turn', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ctx) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
}
