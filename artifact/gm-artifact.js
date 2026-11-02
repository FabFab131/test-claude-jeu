// Maître du jeu de la version « lien » (artifact claude.ai) :
// l'IA est appelée depuis la page avec le compte Claude du joueur (capacité `sample`),
// avec repli sur le mode démo si elle n'est pas disponible.
import { SYSTEM_PROMPT, buildUserMessage } from '../server/prompt.js';
import { TURN_SCHEMA } from '../server/schema.js';
import { runMockTurn } from '../server/mock-gm.js';

let samplePromise = null;
function getSample() {
  if (!samplePromise) {
    samplePromise = (async () => {
      try {
        if (!window.claude || typeof window.claude.use !== 'function') return null;
        return await window.claude.use('sample');
      } catch {
        return null;
      }
    })();
  }
  return samplePromise;
}

// Erreurs définitives : l'IA ne sera pas disponible pendant cette visite.
const PERMANENT = new Set(['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed']);
let aiDisabled = false;

export async function getStatus() {
  const sample = await getSample();
  if (!sample) return { mode: 'demo', model: null, hint: 'L’IA n’est disponible que lorsque la page est ouverte dans Claude.' };
  return { mode: 'ai', model: null };
}

const FORMAT = `\n\n# Format de la réponse\nRéponds uniquement avec un objet JSON (sans texte autour, sans bloc de code) qui respecte exactement ce schéma JSON ; toutes les clés sont obligatoires :\n${JSON.stringify(TURN_SCHEMA)}`;

const ERROR_COPY = {
  rate_limited: 'Trop de demandes envoyées à Claude, ou limite d’utilisation atteinte. Patientez un peu puis renvoyez votre action.',
  session_expired: 'Votre session Claude a expiré : reconnectez-vous puis renvoyez votre action.',
  refused: 'Claude a refusé de poursuivre avec cette action. Reformulez-la.',
  invalid_json: 'La réponse du maître du jeu était illisible. Renvoyez votre action.',
  empty_completion: 'Le maître du jeu n’a rien répondu. Renvoyez votre action.',
  prompt_too_large: 'La partie est trop longue pour être envoyée en entier. Commencez une nouvelle partie.',
};

export async function requestTurn(ctx) {
  const sample = ctx.mode === 'ai' && !aiDisabled ? await getSample() : null;
  if (!sample) return runMockTurn(ctx);
  const prompt = `${SYSTEM_PROMPT}\n\n---\n\n${buildUserMessage(ctx)}${FORMAT}`;
  try {
    const out = await sample.json(prompt, { modelTier: 'default', effort: 'low', cache: false });
    if (!out || typeof out !== 'object' || typeof out.narration !== 'string') throw { code: 'invalid_json' };
    return out;
  } catch (e) {
    const code = e && e.code;
    if (PERMANENT.has(code)) {
      aiDisabled = true;
      if (ctx.action === '__DEBUT__') {
        return { ...runMockTurn(ctx), _mode: 'demo', _notice: 'L’IA Claude n’est pas autorisée pour cette page : la partie continue en mode démo (règles simples).' };
      }
      throw new Error('l’IA Claude n’est pas autorisée pour cette page. Lancez une nouvelle partie : elle se jouera en mode démo');
    }
    throw new Error(ERROR_COPY[code] || 'connexion au maître du jeu interrompue');
  }
}
