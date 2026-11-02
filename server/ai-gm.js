// Maître du jeu propulsé par Claude (API Anthropic, sorties structurées JSON).
import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT, buildUserMessage } from './prompt.js';
import { TURN_SCHEMA } from './schema.js';

export const MODEL = process.env.GM_MODEL || 'claude-opus-5-5';
const EFFORT = process.env.GM_EFFORT || 'low';

let client = null;
function getClient() {
  if (!client) client = new Anthropic();
  return client;
}

export async function runAiTurn(ctx) {
  const params = {
    model: MODEL,
    max_tokens: 16000,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: buildUserMessage(ctx) }],
    output_config: { effort: EFFORT, format: { type: 'json_schema', schema: TURN_SCHEMA } },
  };

  let response;
  try {
    // Repli automatique côté serveur si le modèle décline une requête.
    response = await getClient().beta.messages.create({
      ...params,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
  } catch (err) {
    // Si le repli n'est pas disponible pour ce compte/modèle, on réessaie sans.
    if (err instanceof Anthropic.BadRequestError) {
      console.warn('Requête avec repli refusée, nouvel essai sans :', err.message);
      response = await getClient().messages.create(params);
    } else {
      throw err;
    }
  }

  if (response.stop_reason === 'refusal') {
    throw new Error('Le maître du jeu a refusé de poursuivre cette action. Reformulez-la.');
  }
  if (response.stop_reason === 'max_tokens') {
    throw new Error('Réponse du maître du jeu tronquée.');
  }
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Réponse du maître du jeu illisible.');
  }
}
