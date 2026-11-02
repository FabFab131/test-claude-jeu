// Maître du jeu "démo" : règles simples à base de mots-clés, sans IA.
// Permet de tester le jeu sans clé API. Il est volontairement basique.
import { scenarioById } from '../public/js/scenarios.js';

const START_ITEMS = 3; // téléphone, clés, portefeuille

const KEYWORDS = [
  ['home', ['maison', 'domicile', 'chez moi', 'chez nous', 'appartement', 'foyer']],
  ['neighbor', ['voisin']],
  ['grandparents', ['grand-parent', 'grands-parents', 'grand-mere', 'grand mere', 'mamie', 'grand-pere', 'papi']],
  ['school', ['ecole', 'enfant', 'fils', 'fille', 'gamin']],
  ['work', ['bureau', 'travail', 'boulot', 'conjoint', 'femme', 'mari', 'compagne', 'compagnon']],
  ['supermarket', ['supermarche', 'courses', 'nourriture', 'eau potable', 'vivres', 'provisions']],
  ['hardware', ['bricolage', 'quincaillerie', 'materiel', 'outil', 'magasin', 'autonome']],
  ['pharmacy', ['pharmacie', 'medicament']],
  ['hospital', ['hopital', 'urgence', 'medecin']],
  ['police', ['police', 'commissariat', 'gendarme']],
  ['firestation', ['pompier', 'caserne']],
  ['gas', ['station-service', 'station service', 'essence', 'carburant']],
  ['townhall', ['mairie']],
  ['gym', ['gymnase', 'centre d\'accueil', 'refuge', 'abri']],
  ['station', ['gare', 'train', 'convoi', 'evacuation']],
  ['church', ['eglise']],
  ['park', ['parc', 'point de rassemblement']],
  ['hill', ['colline', 'hauteur', 'foret']],
];

const LOOT = {
  hardware: ['Lampe frontale', 'Piles', 'Radio à manivelle', 'Réchaud à gaz', 'Bâche', 'Corde', 'Pied-de-biche'],
  supermarket: ['Packs d’eau', 'Conserves', 'Bougies', 'Briquet', 'Biscuits'],
  pharmacy: ['Trousse de secours', 'Antidouleurs', 'Masques FFP2'],
  gas: ['Jerrican d’essence', 'Carte routière'],
  firestation: ['Couverture de survie'],
  hospital: ['Bandages'],
  townhall: ['Liste des centres d’accueil'],
};

const ENCOUNTERS = {
  blackout: [['looters', 'Pillards devant une vitrine brisée'], ['violent_group', 'Groupe agressif qui barre la rue'], ['accident', 'Carambolage au carrefour sans feux']],
  flood: [['flood', 'Rue submergée, fort courant'], ['debris', 'Voitures emportées en travers de la rue'], ['crowd', 'Foule paniquée qui reflue']],
  earthquake: [['collapsed_building', 'Immeuble effondré sur la chaussée'], ['gas_leak', 'Fuite de gaz, odeur forte'], ['debris', 'Gravats et câbles électriques']],
  unrest: [['checkpoint', 'Barrage de miliciens armés'], ['armed_group', 'Hommes armés qui contrôlent les passants'], ['roadblock', 'Barricade de pneus en feu']],
  chemical: [['crowd', 'Embouteillage et foule paniquée'], ['roadblock', 'Barrage de police : quartier bouclé'], ['accident', 'Accident entre deux voitures qui fuyaient']],
  wildfire: [['fire', 'Haie en flammes, braises qui volent'], ['accident', 'Voitures abandonnées dans la fumée'], ['crowd', 'Évacuation désordonnée']],
};

const INITIAL_ZONES = {
  blackout: [],
  flood: [{ id: 'crue', kind: 'flood', label: 'Rivière en crue', near: 'bridge_1', radius: 3, blocking: false }],
  earthquake: [
    { id: 'effondrement', kind: 'collapse', label: 'Quartier dévasté', near: 'church', radius: 3, blocking: true },
    { id: 'incendie_station', kind: 'fire', label: 'Incendie à la station-service', near: 'gas', radius: 2, blocking: true },
  ],
  unrest: [{ id: 'combats', kind: 'gunfire', label: 'Tirs autour de la mairie', near: 'townhall', radius: 3, blocking: true }],
  chemical: [{ id: 'nuage', kind: 'toxic_cloud', label: 'Nuage toxique (chlore)', near: 'work', radius: 4, blocking: false }],
  wildfire: [{ id: 'front_feu', kind: 'fire', label: 'Front de l’incendie', near: 'hill', radius: 4, blocking: true }, { id: 'fumee', kind: 'smoke', label: 'Fumée épaisse', near: 'hill', radius: 8, blocking: false }],
};

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const pickOne = (a) => a[Math.floor(Math.random() * a.length)];

function parseTime(t) {
  const m = /J(\d+)\s*·\s*(\d{1,2})h(\d{2})/.exec(t || '');
  return m ? { d: +m[1], min: +m[2] * 60 + +m[3] } : { d: 1, min: 12 * 60 };
}
function addTime(t, minutes) {
  const p = parseTime(t);
  let total = p.min + Math.round(minutes);
  const d = p.d + Math.floor(total / 1440);
  total %= 1440;
  return `J${d} · ${String(Math.floor(total / 60)).padStart(2, '0')}h${String(total % 60).padStart(2, '0')}`;
}

function findDestinations(text, ctx) {
  const ids = new Set((ctx.map?.locations || []).map((l) => l.id));
  const found = [];
  for (const [id, words] of KEYWORDS) {
    let best = Infinity;
    for (const w of words) { const i = text.indexOf(w); if (i >= 0 && i < best) best = i; }
    if (best < Infinity && ids.has(id)) found.push([best, id]);
  }
  // noms complets cliqués sur la carte
  for (const l of ctx.map?.locations || []) {
    const i = text.indexOf(norm(l.name));
    if (i >= 0) found.push([i, l.id]);
  }
  found.sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const [, id] of found) if (!out.includes(id)) out.push(id);
  // "magasin" générique : seulement si aucun commerce plus précis n'est cité
  if (out.includes('hardware') && out.includes('supermarket') && !/bricolage|quincaillerie|materiel|outil/.test(text)) out.splice(out.indexOf('hardware'), 1);
  return out;
}

function locName(ctx, id) {
  return (ctx.map?.locations || []).find((l) => l.id === id)?.name || id;
}

export function runMockTurn(ctx) {
  const sc = scenarioById(ctx.scenario?.id);
  return ctx.action === '__DEBUT__' ? startTurn(ctx, sc) : playTurn(ctx, sc);
}

function startTurn(ctx, sc) {
  const companions = [
    { id: 'camille', name: 'Camille', role: 'Conjoint·e', location: 'work', status: 'Au travail, injoignable' },
    { id: 'leo', name: 'Léo', role: 'Fils, 9 ans', location: 'school', status: 'À l’école' },
  ];
  if (['blackout', 'flood', 'unrest'].includes(sc.id)) {
    companions.push({ id: 'jeanne', name: 'Jeanne', role: 'Grand-mère, 81 ans', location: 'grandparents', status: 'Seule chez elle, se déplace mal' });
  }
  const safeName = locName(ctx, sc.safe);
  const objectives = [
    { text: 'Rassembler toute la famille', done: false },
    { text: 'Réunir au moins 3 objets utiles pour être autonome', done: false },
    { text: sc.safe === 'home' ? 'Se retrancher au domicile avec tout le monde' : `Rejoindre un lieu sûr : ${safeName}`, done: false },
  ];
  const intro = {
    blackout: 'Il est presque 18 h quand la lumière s’éteint d’un coup. Pas seulement chez vous : toute la rue, tout le quartier, toute la ville. Le réseau mobile sature, la radio de la voiture parle d’une panne régionale « d’une durée indéterminée ». Il fait -3 °C et la nuit tombe.',
    flood: 'La pluie n’a pas cessé depuis deux jours. Une alerte stridente fait vibrer votre téléphone : la rivière sort de son lit, évacuation des quartiers bas. Par la fenêtre, vous voyez déjà l’eau brune envahir le bas de la rue.',
    earthquake: 'Le sol se met à rouler sous vos pieds. Les vitres explosent, un fracas sourd monte de la ville. Trente secondes interminables, puis le silence, les alarmes, les cris. Le réseau téléphonique est mort.',
    unrest: 'Des détonations vous réveillent avant l’aube. À la radio, un communiqué confus annonce le couvre-feu. Des pick-up armés patrouillent. Une rumeur circule : un convoi d’évacuation partira de la gare dans les 24 heures.',
    chemical: 'Une explosion sourde fait trembler les vitres. Au nord, une colonne de fumée jaunâtre s’élève de l’usine chimique. Les sirènes retentissent : confinement immédiat, puis évacuation vers le gymnase municipal.',
    wildfire: 'L’air brûle, 42 °C à l’ombre. Le ciel vire à l’orange : l’incendie a franchi la colline et le vent le pousse vers la ville. Les haut-parleurs ordonnent l’évacuation vers le gymnase.',
  }[sc.id];
  const narration = `${intro}\n\nVous êtes chez vous. ${companions.map((c) => `${c.name} (${c.role.toLowerCase()}) est à : ${locName(ctx, c.location)}.`).join(' ')} Personne ne répond au téléphone.\n\nQue faites-vous ?`;
  return {
    narration,
    time: sc.start,
    movements: [],
    obstacles_add: sc.id === 'blackout' ? [{ id: 'foule_super', kind: 'crowd', label: 'Foule qui se presse au supermarché', near: 'supermarket' }] : [],
    obstacles_remove: [],
    zones_add: INITIAL_ZONES[sc.id] || [],
    zones_remove: [],
    companions,
    player: { health: 100, condition: 'En forme, inquiet', inventory: ctx.state.inventory || [] },
    objectives,
    game_status: 'ongoing',
    suggestions: ['Aller chercher Léo à l’école', 'Passer au magasin de bricolage', 'Rester à la maison et écouter la radio'],
  };
}

function playTurn(ctx, sc) {
  const st = ctx.state;
  const text = norm(ctx.action);
  const narr = [];
  const companions = st.companions.map((c) => ({ ...c }));
  const inventory = [...st.inventory];
  let health = st.health;
  let time = st.time;
  const res = { obstacles_add: [], obstacles_remove: [], zones_add: [], zones_remove: [], movements: [] };

  // 1. Réaction à une rencontre en cours
  const encounters = st.obstacles.filter((o) => o.id.startsWith('rencontre_'));
  let detour = false;
  if (encounters.length) {
    const e = encounters[encounters.length - 1];
    if (/negoci|parl|discut|calm|troqu|donn|propos|pacifi/.test(text)) {
      if (Math.random() < 0.65) {
        res.obstacles_remove.push(e.id);
        narr.push(`Vous gardez les mains bien visibles et parlez calmement. Après un long moment de tension, « ${e.label} » finit par vous laisser passer.`);
      } else {
        health -= 10;
        narr.push(`Vous tentez de parlementer, mais on vous repousse brutalement. Vous reculez, une douleur vive à l’épaule. Le passage reste bloqué.`);
      }
    } else if (/frapp|battr|attaqu|bagarr|forc|fonc/.test(text)) {
      health -= 25;
      if (Math.random() < 0.5) {
        res.obstacles_remove.push(e.id);
        narr.push('Vous forcez le passage. Des coups pleuvent, vous en rendez quelques-uns et finissez par passer, sonné et blessé.');
      } else {
        narr.push('Vous foncez, mais ils sont trop nombreux. Vous êtes jeté au sol et devez battre en retraite, blessé.');
      }
    } else if (/contourn|detour|autre chemin|evit|faire le tour|ruelle|demi-tour/.test(text)) {
      detour = true;
      narr.push('Vous faites demi-tour sans vous faire remarquer et cherchez un itinéraire par les rues parallèles.');
    } else if (/attend|cach|patient/.test(text)) {
      time = addTime(time, 30);
      if (Math.random() < 0.5) { res.obstacles_remove.push(e.id); narr.push('Vous attendez à l’abri d’un porche. Une demi-heure plus tard, la voie est libre.'); }
      else narr.push('Vous attendez une demi-heure, à l’abri. Rien ne bouge, le passage est toujours bloqué.');
    }
  }

  // 2. Destinations demandées
  let dests = findDestinations(text, ctx);
  if (!dests.length && (detour || /continu|reprend|poursui/.test(text)) && ctx.history?.length) {
    dests = findDestinations(norm(ctx.history[ctx.history.length - 1].action), ctx);
  }
  if (/famille|rassembl|reunir|recuper|chercher tout le monde/.test(text)) {
    const away = companions.filter((c) => c.location !== 'player').map((c) => c.location);
    const explicitHome = dests.includes('home');
    dests = dests.filter((d) => d !== 'home');
    dests = [...away.filter((a) => !dests.includes(a)), ...dests];
    if (explicitHome || /meme endroit|maison|chez/.test(text)) dests.push('home');
  }
  let here = st.position?.at || null;
  dests = dests.filter((d, i) => !(i === 0 && d === here)).slice(0, 4);

  if (!dests.length && !narr.length) {
    if (/radio|ecout|info/.test(text)) {
      narr.push(inventory.some((i) => /radio/i.test(i)) ? 'La radio grésille : les autorités demandent de rester calmes et annoncent des points d’accueil. Vous avez une idée plus claire de la situation.' : 'Sans radio à piles, impossible d’avoir des nouvelles fiables. Les rumeurs les plus folles circulent dans la rue.');
    } else {
      narr.push('Vous prenez un moment pour souffler et réfléchir. Autour de vous, la situation continue de se dégrader.');
    }
    time = addTime(time, 20);
  }

  // 3. Déplacements
  const recentEncounter = encounters.length > 0;
  for (const d of dests) {
    const minutes = ctx.map.locations.find((l) => l.id === d)?.walk_minutes ?? 10;
    const name = locName(ctx, d);
    if (!recentEncounter && !res.movements.some((m) => m.encounter.kind !== 'none') && ctx.turn >= 1 && Math.random() < 0.25) {
      const [kind, label] = pickOne(ENCOUNTERS[sc.id] || ENCOUNTERS.blackout);
      res.movements.push({ destination: d, stop_fraction: 0.5, encounter: { kind, label } });
      time = addTime(time, minutes / 2);
      narr.push(`En route vers ${name}, vous tombez sur un obstacle : ${label.toLowerCase()}. Impossible de passer sans prendre de risque. Que faites-vous ?`);
      break;
    }
    res.movements.push({ destination: d, stop_fraction: 1, encounter: { kind: 'none', label: '' } });
    time = addTime(time, minutes + 5);
    here = d;
    narr.push(arrival(d, name, companions, inventory, sc));
  }

  // 4. Évolution des dangers
  const turn = (ctx.turn || 0) + 1;
  for (const z of st.zones) {
    if (['flood', 'fire', 'smoke', 'toxic_cloud'].includes(z.kind) && turn % 2 === 0 && z.radius < 10) {
      res.zones_remove.push(z.id);
      res.zones_add.push({ ...z, radius: z.radius + 1, blocking: z.blocking || (z.kind !== 'smoke' && z.radius + 1 >= 5) });
      if (turn === 2) narr.push(z.kind === 'flood' ? 'Au loin, l’eau continue de monter.' : z.kind === 'fire' ? 'Le feu gagne du terrain.' : 'Le nuage s’étend.');
    }
  }
  if (st.zones.some((z) => ['toxic_cloud', 'smoke'].includes(z.kind)) && !inventory.some((i) => /masque/i.test(i)) && res.movements.length) {
    health -= 5;
  }

  // 5. Objectifs et fin
  const allTogether = companions.length > 0 && companions.every((c) => c.location === 'player');
  const enoughGear = inventory.length - START_ITEMS >= 3;
  const atSafe = here === sc.safe;
  const objectives = (st.objectives || []).map((o, i) => ({ ...o, done: i === 0 ? allTogether : i === 1 ? enoughGear : i === 2 ? allTogether && atSafe : o.done }));
  health = Math.max(0, Math.min(100, health));
  let game_status = 'ongoing';
  if (health <= 0) {
    game_status = 'lost';
    narr.push('\nVos forces vous abandonnent. Vous vous effondrez sur le trottoir… La partie est perdue.');
  } else if (allTogether && enoughGear && atSafe) {
    game_status = 'won';
    narr.push('\nToute la famille est réunie, à l’abri, avec de quoi tenir plusieurs jours. La crise est loin d’être finie, mais vous avez fait ce qu’il fallait. Vous avez survécu.');
  }

  const suggestions = [];
  const away = companions.find((c) => c.location !== 'player');
  if (away) suggestions.push(`Aller chercher ${away.name}`);
  if (!enoughGear) suggestions.push(pickOne(['Passer au magasin de bricolage', 'Aller au supermarché', 'Passer à la pharmacie']));
  if (allTogether && !atSafe) suggestions.push(sc.safe === 'home' ? 'Rentrer à la maison' : `Rejoindre : ${locName(ctx, sc.safe)}`);
  if (st.obstacles.some((o) => o.id.startsWith('rencontre_')) || res.movements.some((m) => m.encounter.kind !== 'none')) suggestions.unshift('Contourner par une autre rue', 'Tenter de négocier');

  return {
    narration: narr.join('\n\n') || 'Le temps passe…',
    time,
    ...res,
    companions,
    player: { health, condition: health > 70 ? 'En forme, sur le qui-vive' : health > 35 ? 'Blessé, fatigué' : 'Gravement blessé', inventory },
    objectives,
    game_status,
    suggestions: suggestions.slice(0, 3),
  };
}

function arrival(id, name, companions, inventory, sc) {
  const parts = [`Vous arrivez à : ${name}.`];
  const found = companions.filter((c) => c.location === id);
  for (const c of found) {
    c.location = 'player';
    c.status = 'Avec vous, soulagé·e';
    parts.push(`${c.name} vous aperçoit et se précipite vers vous. Vous repartez ensemble.`);
  }
  const loot = (LOOT[id] || []).filter((i) => !inventory.includes(i));
  if (loot.length) {
    const n = Math.min(loot.length, id === 'hardware' || id === 'supermarket' ? 3 : 1);
    const got = [];
    for (let k = 0; k < n; k++) got.push(loot.splice(Math.floor(Math.random() * loot.length), 1)[0]);
    inventory.push(...got);
    parts.push(sc.id === 'blackout' && ['hardware', 'supermarket'].includes(id)
      ? `Les caisses sont hors service ; le gérant n’accepte que les espèces. Vous repartez avec : ${got.join(', ')}.`
      : `Vous récupérez : ${got.join(', ')}.`);
  } else if (id === sc.safe) {
    parts.push('L’endroit semble sûr pour le moment.');
  }
  return parts.join(' ');
}
