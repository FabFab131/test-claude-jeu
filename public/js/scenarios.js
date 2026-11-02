// Scénarios jouables. `brief` est transmis au maître du jeu (IA).
// Ce fichier est aussi importé par le serveur (mode démo).

export const SCENARIOS = [
  {
    id: 'blackout',
    name: 'Black-out général',
    emoji: '🔌',
    start: 'J1 · 17h50',
    night: true,
    safe: 'home',
    pitch: "Un soir d'hiver, le réseau électrique de toute la région s'effondre. Personne ne sait pour combien de temps.",
    brief:
      "Panne d'électricité massive et durable (plusieurs jours) sur toute la région, en plein hiver (-3 °C). Plus de feux de circulation, réseau mobile saturé puis coupé, terminaux de paiement et pompes à essence hors service, eau courante qui faiblit, chauffage coupé. La nuit tombe vite. Les tensions et les pillages augmentent d'heure en heure. Seuls l'hôpital et la caserne ont des groupes électrogènes.",
  },
  {
    id: 'flood',
    name: 'Crue éclair',
    emoji: '🌊',
    start: 'J1 · 14h20',
    night: false,
    safe: 'hill',
    pitch: 'Des pluies diluviennes font sortir la rivière de son lit. L’eau monte, vite.',
    brief:
      "Après 36 h de pluies diluviennes, la rivière qui traverse la ville déborde brutalement. Les rues proches de la rivière sont inondées en premier, puis l'eau gagne du terrain à chaque heure. Les ponts deviennent dangereux puis impraticables, le courant est coupé dans les zones inondées, les voitures sont emportées. Les secours sont débordés. Les hauteurs (la colline boisée) sont le refuge le plus sûr.",
  },
  {
    id: 'earthquake',
    name: 'Séisme',
    emoji: '🏚️',
    start: 'J1 · 10h05',
    night: false,
    safe: 'park',
    pitch: 'Un séisme de magnitude 6,8 frappe la ville en pleine matinée.',
    brief:
      "Un séisme de magnitude 6,8 vient de frapper. Bâtiments fissurés ou effondrés, débris et câbles dans les rues, fuites de gaz et départs d'incendie, canalisations rompues, réseau téléphonique coupé. Des répliques surviennent régulièrement. Les autorités demandent de se regrouper dans les espaces dégagés (le parc municipal sert de point de rassemblement).",
  },
  {
    id: 'unrest',
    name: 'Guerre civile',
    emoji: '⚔️',
    start: 'J1 · 06h40',
    night: false,
    safe: 'station',
    pitch: 'Le pays bascule dans le chaos. Des milices se disputent la ville. Un convoi d’évacuation partirait de la gare.',
    brief:
      "Le pays bascule dans la guerre civile. Des milices armées rivales se disputent la ville, des barrages filtrent les rues, un couvre-feu est décrété, des tirs sporadiques éclatent. Internet et téléphone sont coupés. Une rumeur dit qu'un convoi humanitaire d'évacuation quittera la gare dans les prochaines 24 h. Pénuries, méfiance, pillages. Les forces de l'ordre sont dépassées ou ont choisi un camp.",
  },
  {
    id: 'chemical',
    name: 'Nuage toxique',
    emoji: '☣️',
    start: 'J1 · 15h10',
    night: false,
    safe: 'gym',
    pitch: 'Une usine chimique explose en périphérie. Un nuage jaunâtre dérive vers la ville.',
    brief:
      "Explosion dans une usine chimique en périphérie nord. Un nuage toxique (chlore) dérive vers la ville. Les sirènes hurlent, la préfecture ordonne d'abord le confinement, puis l'évacuation de certains quartiers vers le gymnase municipal, transformé en centre d'accueil. Le vent peut tourner. Il faut se protéger les voies respiratoires, calfeutrer, éviter les zones basses où le gaz s'accumule.",
  },
  {
    id: 'wildfire',
    name: 'Incendie & canicule',
    emoji: '🔥',
    start: 'J1 · 16h30',
    night: false,
    safe: 'gym',
    pitch: 'Canicule à 42 °C. Un incendie dévale la colline boisée vers la ville, poussé par le vent.',
    brief:
      "Canicule (42 °C) depuis dix jours. Un incendie de forêt est parti de la colline boisée et progresse vers la ville, poussé par un vent violent. Fumée épaisse, braises qui volent et allument des foyers secondaires, coupures d'eau et de courant, routes saturées. Une évacuation est ordonnée vers le gymnase municipal. Déshydratation et intoxication aux fumées sont des risques réels.",
  },
];

export function scenarioById(id) {
  return SCENARIOS.find((s) => s.id === id) || SCENARIOS[0];
}
