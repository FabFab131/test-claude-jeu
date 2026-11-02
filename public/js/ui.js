// Interface (panneau latéral, écrans de début/fin).
const $ = (sel) => document.querySelector(sel);

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function showStart(scenarios, status, onStart) {
  const list = $('#scenario-list');
  list.innerHTML = '';
  for (const s of scenarios) {
    const b = document.createElement('button');
    b.className = 'scenario-card';
    b.innerHTML = `<span class="sc-emoji">${s.emoji}</span><span class="sc-name">${esc(s.name)}</span><span class="sc-pitch">${esc(s.pitch)}</span>`;
    b.onclick = () => onStart(s.id, { demo: demoChosen() });
    list.appendChild(b);
  }
  const rnd = document.createElement('button');
  rnd.className = 'scenario-card random';
  rnd.innerHTML = '<span class="sc-emoji">🎲</span><span class="sc-name">Aléatoire</span><span class="sc-pitch">Laissez le destin choisir la catastrophe.</span>';
  rnd.onclick = () => onStart(scenarios[Math.floor(Math.random() * scenarios.length)].id, { demo: demoChosen() });
  list.appendChild(rnd);

  const m = $('#mode-info');
  if (status.mode === 'ai') {
    m.innerHTML = `<div>🤖 Maître du jeu : <b>IA Claude</b>${status.model ? ` <span class="muted">(${esc(status.model)})</span>` : ''}</div>`
      + '<label class="demo-toggle"><input type="checkbox" id="demo-mode"> Jouer en mode démo (règles simples, sans IA)</label>';
  } else {
    m.innerHTML = `🧩 Maître du jeu : <b>mode démo</b> (règles simples, sans IA). <span class="muted">${esc(status.hint || 'Définissez ANTHROPIC_API_KEY côté serveur pour activer l’IA.')}</span>`;
  }
  const resume = $('#resume');
  resume.classList.toggle('hidden', !status.resumable);
  resume.onclick = hideStart;
  $('#start-screen').classList.remove('hidden');
}

function demoChosen() { return !!document.getElementById('demo-mode')?.checked; }

export function hideStart() { $('#start-screen').classList.add('hidden'); }

export function setBusy(busy) {
  $('#action').disabled = busy;
  $('#send').disabled = busy;
  $('#thinking').classList.toggle('hidden', !busy);
  if (!busy) $('#action').focus();
}

export function setHeader(scenario, time) {
  $('#scenario-title').textContent = `${scenario.emoji} ${scenario.name}`;
  $('#clock').textContent = time ? `🕒 ${time}` : '';
}

export function addJournal(kind, text, { typewriter = false, onDone } = {}) {
  const j = $('#journal');
  const el = document.createElement('div');
  el.className = `entry ${kind}`;
  if (kind === 'player') el.innerHTML = `<span class="who">Vous</span>`;
  if (kind === 'gm') el.innerHTML = `<span class="who">Maître du jeu</span>`;
  const body = document.createElement('div');
  body.className = 'body';
  el.appendChild(body);
  j.appendChild(el);
  const scroll = () => { j.scrollTop = j.scrollHeight; };
  if (!typewriter) {
    body.textContent = text;
    scroll();
    onDone && onDone();
    return;
  }
  let i = 0;
  const step = () => {
    i = Math.min(text.length, i + 3);
    body.textContent = text.slice(0, i);
    scroll();
    if (i < text.length) setTimeout(step, 12);
    else onDone && onDone();
  };
  step();
}

export function clearJournal() { $('#journal').innerHTML = ''; }

export function renderStatus(state) {
  const p = state.player;
  const hp = Math.max(0, Math.min(100, p.health));
  const bar = $('#health-bar');
  bar.style.width = `${hp}%`;
  bar.style.background = hp > 60 ? '#2a9d8f' : hp > 30 ? '#e9c46a' : '#e63946';
  $('#health-val').textContent = `${hp}`;
  $('#condition').textContent = p.condition || '';

  $('#family').innerHTML = state.companions.length
    ? state.companions.map((c) => {
      const where = c.location === 'player' ? '<span class="tag ok">avec vous</span>' : `<span class="tag">${esc(state.locById(c.location)?.name || c.location)}</span>`;
      return `<li><span class="dot" style="background:${c.color}"></span><b>${esc(c.name)}</b> <span class="muted">${esc(c.role)}</span> ${where}${c.status ? `<div class="sub">${esc(c.status)}</div>` : ''}</li>`;
    }).join('')
    : '<li class="muted">—</li>';

  $('#objectives').innerHTML = state.objectives.length
    ? state.objectives.map((o) => `<li class="${o.done ? 'done' : ''}">${o.done ? '✅' : '⬜'} ${esc(o.text)}</li>`).join('')
    : '<li class="muted">—</li>';

  $('#inventory').innerHTML = p.inventory.length
    ? p.inventory.map((it) => `<span class="item">${esc(it)}</span>`).join('')
    : '<span class="muted">Vide</span>';

  $('#threats').innerHTML = [...state.obstacles.map((o) => `<li>🚫 ${esc(o.label)}</li>`), ...state.zones.map((z) => `<li>⚠️ ${esc(z.label)}</li>`)].join('') || '<li class="muted">Aucune menace signalée</li>';
}

export function renderSuggestions(list, onPick) {
  const box = $('#suggestions');
  box.innerHTML = '';
  for (const s of list || []) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = s;
    b.onclick = () => onPick(s);
    box.appendChild(b);
  }
}

export function showEnd(status, text, turns, onRestart) {
  $('#end-title').textContent = status === 'won' ? '🏁 Vous avez survécu' : '💀 Fin de partie';
  $('#end-text').textContent = text;
  $('#end-stats').textContent = `Partie terminée en ${turns} tour${turns > 1 ? 's' : ''}.`;
  $('#end-screen').classList.remove('hidden');
  $('#end-screen').classList.toggle('won', status === 'won');
  $('#restart').onclick = () => { $('#end-screen').classList.add('hidden'); onRestart(); };
  $('#end-close').onclick = () => $('#end-screen').classList.add('hidden');
}

export function showTooltip(text, x, y) {
  const t = $('#tooltip');
  if (!text) { t.classList.add('hidden'); return; }
  t.textContent = text;
  t.style.left = `${x + 14}px`;
  t.style.top = `${y + 10}px`;
  t.classList.remove('hidden');
}
