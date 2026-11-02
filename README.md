# 🗺️ Survie — jeu de rôle raconté par une IA

Un jeu de survie aux graphismes simples, vu du ciel. Vous incarnez un civil ordinaire face à une crise
(black-out, crue, séisme, guerre civile, nuage toxique, incendie…). Une IA joue le rôle de **maître du jeu** :
elle vous explique la situation et vos objectifs, puis vous **écrivez librement votre stratégie**.

> « Coupure de courant. Ma priorité est de rassembler la famille au même endroit, ensuite j'irai au magasin
> de bricolage chercher du matériel pour devenir autonome. »

À chaque tour, l'IA arbitre ce qui se passe et le jeu l'affiche sur la carte : votre personnage se déplace
de lieu en lieu, vos proches vous suivent une fois récupérés, et le maître du jeu peut placer des
**obstacles** sur votre route (bande violente qui bloque une rue, barrage de miliciens, rue inondée…) ou
des **zones dangereuses** qui évoluent (crue qui monte, front d'incendie, nuage toxique). Vous devez alors
contourner, négocier, attendre… La partie se termine quand le problème est résolu ou l'objectif atteint
(ou si vous échouez).

## Lancer le jeu

Prérequis : Node.js 18 ou plus récent.

```bash
npm install
export ANTHROPIC_API_KEY=sk-ant-...   # votre clé API Anthropic
npm start
```

Ouvrez ensuite <http://localhost:3000>.

Sans clé API, le jeu démarre en **mode démo** : un maître du jeu simplifié, à base de mots-clés, permet de
tester la boucle de jeu (`npm run demo` force ce mode).

### Variables d'environnement

| Variable | Rôle | Défaut |
|---|---|---|
| `ANTHROPIC_API_KEY` | Clé API pour le maître du jeu IA | — (mode démo si absente) |
| `GM_MODEL` | Modèle Claude utilisé | `claude-opus-5-5` |
| `GM_EFFORT` | Effort de réflexion (`low`, `medium`, `high`…) : plus bas = réponses plus rapides | `low` |
| `GM_MODE` | `ai` ou `demo` pour forcer un mode | auto |
| `PORT` | Port HTTP | `3000` |

## Comment jouer

- Choisissez un scénario (ou « Aléatoire »). Le maître du jeu présente la situation, vos proches et vos objectifs.
- Écrivez ce que vous faites dans la zone de texte (Entrée pour envoyer, Maj+Entrée pour un saut de ligne).
- **Cliquez sur un lieu de la carte** pour l'ajouter à votre action ; survolez-le pour voir le temps de marche.
- Le panneau de droite affiche votre santé, l'inventaire, vos proches (où ils sont), les objectifs et les menaces connues.
- Des suggestions d'actions sont proposées, mais vous pouvez faire ce que vous voulez.

## Architecture

```
server.js            Serveur HTTP (fichiers statiques + API /api/status et /api/turn)
server/ai-gm.js      Appel à l'API Claude (sorties JSON structurées)
server/prompt.js     Règles du maître du jeu + message envoyé à chaque tour
server/schema.js     Schéma JSON de la réponse d'un tour
server/mock-gm.js    Maître du jeu « démo » sans IA
public/js/map.js     Génération procédurale de la ville (routes, rivière, ponts, lieux)
public/js/pathfinding.js  Itinéraires (contournement des obstacles et zones)
public/js/render.js  Rendu canvas vue du ciel, animations, nuit/obscurité
public/js/main.js    Boucle de jeu : état, envoi du contexte, application des tours
public/js/scenarios.js    Scénarios jouables
```

Le serveur est sans état : à chaque tour, le navigateur envoie le contexte complet (scénario, lieux et temps
de marche, état du joueur et des proches, obstacles, historique récent, action). L'IA répond avec un objet
JSON : narration, déplacements (avec interruption éventuelle par une rencontre), obstacles et zones à
ajouter ou retirer, état des proches, du joueur et des objectifs, statut de la partie et suggestions.

### Ajouter un scénario

Ajoutez une entrée dans `public/js/scenarios.js` : `brief` est le texte transmis à l'IA pour décrire la crise,
`safe` l'identifiant du lieu sûr utilisé par le mode démo.
