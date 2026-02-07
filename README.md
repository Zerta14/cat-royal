# 🐾 CatRoyal - Documentation Complète

## 📁 Structure du projet

```
index.html                     # Page HTML principale (PWA ready)
manifest.json                  # Manifest PWA
sw.js                         # Service Worker
icons/                        # Icônes PWA
  ├── icon-192.svg
  └── README.md
css/
  ├── main.css                # Styles de base et variables
  ├── components.css          # Composants (boutons, UI, pause, équipes...)
  └── mobile.css              # Optimisations mobile
js/
  ├── config.js               # Configuration Firebase + constantes
  ├── firebase-helpers.js     # Fonctions utilitaires Firebase
  ├── utils.js                # Fonctions utilitaires générales
  ├── navigation.js           # Navigation entre pages + session restore
  ├── auth.js                 # Authentification login/logout
  ├── dashboard.js            # Affichage parties et maps
  ├── lobby.js                # Gestion lobby (équipes, modifiers, map)
  ├── editor.js               # Éditeur de maps
  └── game/
      ├── game-main.js        # Initialisation jeu + GPS + pause + centrage
      ├── game-timer.js       # Gestion timer et phases + pause
      ├── game-zones.js       # Gestion zones, PV, sélection finale
      ├── game-pings.js       # Système de pings (fonction mère)
      ├── game-modifiers.js   # Logique modifiers
      └── game-notifications.js # Système notifications
```

## 🚀 Installation

1. Uploader tous les fichiers sur un serveur web (GitHub Pages, Netlify, Vercel...)
2. Générer les icônes PNG (voir icons/README.md)
3. Le mot de passe par défaut est : **catroyal2026**
4. Il sera automatiquement hashé en SHA-256 et stocké dans Firebase

## 📱 PWA - Installation sur téléphone

L'application est une **Progressive Web App** installable :

**iOS (Safari)** :
1. Ouvrir le site
2. Appuyer sur "Partager" (icône carré avec flèche)
3. "Sur l'écran d'accueil"

**Android (Chrome)** :
1. Ouvrir le site
2. Menu → "Ajouter à l'écran d'accueil"
3. Ou bannière d'installation automatique

Une fois installée, l'app se lance en **mode standalone** (sans barre d'adresse).

## 🎮 Fonctionnalités principales

### Authentification
- Mot de passe unique hashé SHA-256 dans Firebase
- Pseudo unique (un seul à la fois)
- Session persistante (reconnexion auto)
- Return to active game après disconnect
- Déconnexion impossible si en partie

### Dashboard
- Liste des parties en attente
- Liste des maps publiques
- Créer une partie
- Créer/Modifier/Supprimer des maps

### Lobby

**Sélection Map** : Choix parmi maps publiques

**Formation Équipes** :
- **Auto** : Répartition intelligente (2+ chats, souris par 2 ou 3, jamais 1)
- **Manuel** : Drag & drop (desktop + mobile) pour assigner joueurs

**Modifiers** :
- **Aléatoire** : 1 modifier au hasard
- **Manuel** : Cocher plusieurs modifiers

### Éditeur de Maps
- Créer des zones polygonales
- Système de magnétisme (angles + segments, toggle avec [M])
- Ctrl+Z pour annuler
- Modifier maps existantes
- Supprimer maps (si pas utilisées)
- **Nouveau** : Map vierge à chaque création (plus de zones résiduelles)

### Jeu - Interface

**Boutons principaux** :
- ⏸️ **Pause** : N'importe qui peut mettre pause → suspend tout pour tous
- 📍 **Centrage Auto** : Toggle recentrage map sur joueur
  - Se désactive auto si map déplacée manuellement
  - Réactivable en cliquant
- 🔔 **Notifications** : Historique avec badge

**Overlay Pause** :
- Affiche "⏸️ PAUSE" en plein écran
- Bloque toutes actions (timer, GPS update, zones...)
- Reprend où la partie s'est arrêtée

### Jeu - Règles
- **Timer** : 3 min (cache) + (nb_zones × 3) minutes
- **Phase cache** : Souris se cachent, chats immobiles (3 min)
  - Si modifier "Zone Finale", chats **cliquent sur une zone** pour la choisir (avec confirmation)
- **Phase chasse** : Chats suppriment 2 zones au début, puis 1 toutes les 3 min
  - Confirmation à chaque suppression
- **Zone finale** : Dernières 6 minutes
- **Pings souris** : Toutes les 3 min à partir de la 6ème minute

### Jeu - Souris
- Perdent **1 HP / 3 secondes** si hors zone ou dans zone morte
- **Ping révélé** après 1 minute hors zone/zone morte
- Voient coéquipier en temps réel (point cyan)
- Bouton "Je suis touché"
- **Bordure rouge** si mission active (camping, changement forcé...)

### Jeu - Chats
- Suppriment zones (partagé entre chats)
- Voient **zone finale en VERT**
- Voient **zones mortes en ROUGE**
- Voient pings souris toutes les 3 min
- Actions partagées (si un utilise, l'autre ne peut pas)
- **Confirmation** avant suppression de zone

### Modifiers

Tous les modifiers utilisent maintenant la **fonction mère de ping** :

1. **Ping Total** (Chats)
   - Partagé entre chats
   - Révèle toutes souris vivantes instantanément (1×)

2. **Zone Finale Imposée** (Chats)
   - Pendant phase cache : **clic sur zone** pour la choisir
   - Confirmation demandée

3. **Camping Interdit** (Souris)
   - Immobiles 3 min dans rayon 10m → ping
   - Bordure rouge + mission "Bougez !"

4. **Révéler Chats** (Souris)
   - 1× par équipe de souris
   - Ping statique (3 secondes)

5. **Changement Forcé** (Chats)
   - Souris doivent changer zone en 3 min
   - Bordure rouge + timer
   - Ping si non respecté

6. **1ère Touche = Chat** (Global)
   - Première souris éliminée devient chat additionnel

### Notifications

**Système corrigé** :
- Badge s'incrémente correctement (+1 par nouvelle notif)
- Plus de reset intempestif
- Historique complet avec heure + icône + message
- Événements : joueurs, souris touchées, zones, modifiers, phases...

### Pings - Fonction Mère

**Architecture** :
```javascript
sendPing(playerId, lat, lng, type, visibleBy)
```

**Types** :
- `regular` : Pings toutes les 3 min
- `penalty` : Hors zone 1 min
- `camping` : Immobile 3 min
- `force_zone` : Changement non respecté
- `ping_total` : Modifier ping total

**Visibilité** :
- `'cats'` : Seulement chats
- `'all'` : Tout le monde
- `['mice_0', 'mice_1']` : Équipes spécifiques

## 🔧 Configuration

### Changer le mot de passe
1. Firebase Console → Realtime Database
2. Modifier `/config/passwordHash`
3. Hasher nouveau mdp en SHA-256

### Ajuster les constantes (config.js)
```javascript
const ZONE_BUFFER_METERS = 10;     // Marge zones (10m)
const HP_LOSS_INTERVAL = 3000;      // Perte HP (3 sec)
const CAMPING_RADIUS = 10;          // Rayon camping (10m)
const CAMPING_TIME = 180000;        // Temps camping (3 min)
const DEAD_ZONE_PING_TIME = 60000;  // Temps ping zone morte (1 min)
```

## 📱 Optimisations Mobile

- Interface touch-friendly (boutons 44px min)
- Drag & drop tactile pour équipes manuelles
- Responsive layouts (petits écrans, landscape)
- Safe areas iOS (notch)
- Prévention zoom sur inputs
- Messages courts pour notifs/missions
- Overlay pause adapté

## 🐛 Bugs Corrigés

✅ **Chats choisissent zone finale** : Clic pendant phase cache (avec confirmation)
✅ **Notifications stackent** : Badge s'incrémente correctement
✅ **Pings unifiés** : Fonction mère pour tous types de pings
✅ **Map vierge** : Plus de zones résiduelles lors création
✅ **Modifier aléatoire** : Fonctionne et décoche les autres
✅ **Équipes manuelles** : Drag & drop desktop + mobile
✅ **Pas d'équipe de 1** : Logique pour faire équipes de 2 ou 3

## 🎯 Nouvelles Fonctionnalités

🆕 **Pause partagée** : N'importe qui peut mettre pause pour tous
🆕 **Centrage auto** : Toggle + désactivation auto si map bougée
🆕 **PWA** : Installable sur home screen mobile
🆕 **Confirmations** : Suppression zones + sélection finale
🆕 **Équipes manuelles** : Interface drag & drop complète

## 📊 Firebase Structure

```
/config/passwordHash
/users/{userId}: {pseudo, isOnline, sessionId, createdAt}
/games/{gameId}: {creator, status, mapId, players, teams, startTime, totalTime, finalZoneIndex, currentPhase, modifiers}
/maps/{mapId}: {name, creatorId, creatorPseudo, zones: [{coords}], createdAt}
/gameState/{gameId}: {
  deletedZones, 
  pings, 
  players: {lat, lng, hp, alive}, 
  modifierStates, 
  zonesToDelete,
  isPaused,
  notifications
}
```

## 🚦 Test de l'application

### Checklist complète :

**Authentification** :
- [ ] Login avec pseudo + mdp
- [ ] Session persiste après refresh
- [ ] Reconnexion auto si en partie

**Dashboard** :
- [ ] Créer partie
- [ ] Rejoindre partie
- [ ] Créer map
- [ ] Modifier map
- [ ] Supprimer map

**Lobby** :
- [ ] Sélection map
- [ ] Équipes auto (pas de souris seule)
- [ ] Équipes manuelles (drag & drop mobile)
- [ ] Modifier aléatoire
- [ ] Modifiers manuels
- [ ] Lancement partie

**Éditeur** :
- [ ] Créer zones (magnétisme ON/OFF)
- [ ] Ctrl+Z fonctionne
- [ ] Map vierge à la création
- [ ] Sauvegarder map
- [ ] Modifier map existante

**Jeu** :
- [ ] GPS se met à jour
- [ ] Pause suspend tout (pour tous)
- [ ] Centrage auto fonctionne
- [ ] Centrage auto se désactive si map bougée
- [ ] Zones mortes font perdre PV
- [ ] Pings apparaissent (chats)
- [ ] Coéquipier visible (souris)
- [ ] Chats choisissent zone finale (clic + confirmation)
- [ ] Chats suppriment zones (confirmation)
- [ ] Modifiers fonctionnent
- [ ] Bordure rouge pour missions
- [ ] Notifications s'affichent correctement
- [ ] Badge notifications s'incrémente bien

---

**Développé avec ❤️ - Version 2.0 avec PWA, Pause et Équipes Manuelles**