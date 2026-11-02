// Schéma JSON (sorties structurées) de la réponse du maître du jeu à chaque tour.

export const OBSTACLE_KINDS = [
  'violent_group', 'armed_group', 'roadblock', 'checkpoint', 'fire', 'debris', 'flood', 'crowd',
  'looters', 'accident', 'collapsed_building', 'gas_leak', 'animal', 'other',
];
export const ZONE_KINDS = ['flood', 'fire', 'smoke', 'toxic_cloud', 'riot', 'gunfire', 'blackout', 'collapse', 'safe', 'other'];

const str = { type: 'string' };
const obj = (properties) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });

export const TURN_SCHEMA = obj({
  narration: str,
  time: str,
  movements: {
    type: 'array',
    items: obj({
      destination: str,
      stop_fraction: { type: 'number' },
      encounter: obj({ kind: { type: 'string', enum: [...OBSTACLE_KINDS, 'none'] }, label: str }),
    }),
  },
  obstacles_add: {
    type: 'array',
    items: obj({ id: str, kind: { type: 'string', enum: OBSTACLE_KINDS }, label: str, near: str }),
  },
  obstacles_remove: { type: 'array', items: str },
  zones_add: {
    type: 'array',
    items: obj({ id: str, kind: { type: 'string', enum: ZONE_KINDS }, label: str, near: str, radius: { type: 'integer' }, blocking: { type: 'boolean' } }),
  },
  zones_remove: { type: 'array', items: str },
  companions: {
    type: 'array',
    items: obj({ id: str, name: str, role: str, location: str, status: str }),
  },
  player: obj({ health: { type: 'integer' }, condition: str, inventory: { type: 'array', items: str } }),
  objectives: { type: 'array', items: obj({ text: str, done: { type: 'boolean' } }) },
  game_status: { type: 'string', enum: ['ongoing', 'won', 'lost'] },
  suggestions: { type: 'array', items: str },
});
