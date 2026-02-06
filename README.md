# 🐾 CatRoyal - Documentation

## 📁 Structure du projet

```
index.html                     # Page HTML principale
css/
  ├── main.css                # Styles de base et variables
  ├── components.css          # Composants (boutons, UI jeu, etc.)
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
      ├── game-main.js        # Initialisation jeu + GPS
      ├── game-timer.js       # Gestion timer et phases
      ├── game-zones.js       # Gestion zones et PV
      ├── game-pings.js       # Système de pings
      ├── game-modifiers.js   # Logique modifiers
      └── game-notifications.js # Système notifications
```

## 🚀 Installation

1. Uploader tous les fichiers sur GitHub Pages (ou autre hébergeur)
2. Le mot de passe par défaut est : **catroyal2026**
3. Il sera automatiquement hashé en SHA-256 et stocké dans Firebase

## 🎮 Fonctionnalités principales

### Authentification
- Mot de passe unique hashé SHA-256 dans Firebase
- Pseudo unique
- Session persistante (reconnexion auto même après crash)
- Une seule connexion par pseudo à la fois
- Déconnexion impossible si en partie

### Dashboard
- Liste des parties en attente
- Liste des maps publiques
- Créer une partie
- Créer/Modifier/Supprimer des maps

### Lobby
- Sélection de la map
- Formation d'équipes automatique ou manuelle
- Sélection de modifiers (aléatoire ou manuel)
- Lancement de la partie

### Éditeur de Maps
- Créer des zones polygonales
- Système de magnétisme (angles + segments)
- Déplacer les points (drag & drop sur desktop, tap sur mobile)
- Ctrl+Z pour annuler
- Modifier maps existantes
- Supprimer maps (si pas utilisées en partie)

### Jeu - Règles
- **Timer** : 3 min (cache) + (nb_zones × 3)
- **Phase cache** : Souris se cachent, chats immobiles (3 min)
- **Phase chasse** : Chats suppriment 2 zones au début, puis 1 toutes les 3 min
- **Zone finale** : 6 dernières minutes
- **Pings souris** : Toutes les 3 min à partir de la 6ème minute

### Jeu - Souris
- Perdent **1 HP / 3 secondes** si hors zone ou dans zone morte
- **Ping révélé** après 1 minute hors zone/zone morte
- Voient coéquipier en temps réel (point cyan)
- Bouton "Je suis touché"
- Bordure rouge si mission active (camping, changement forcé, etc.)

### Jeu - Chats
- Suppriment zones (partagé entre chats)
- Voient **zone finale en VERT**
- Voient **zones mortes en ROUGE**
- Voient pings souris toutes les 3 min
- Actions partagées entre chats (si un utilise, l'autre ne peut pas)

### Modifiers
1. **Ping Total** (Chats) - Révèle toutes les souris instantanément (1×)
2. **Zone Finale Imposée** (Chats) - Chats choisissent la zone finale
3. **Camping Interdit** (Souris) - Immobiles 3 min → ping révélé
4. **Révéler Chats** (Souris) - Ping position chats (1× par équipe)
5. **Changement Forcé** (Chats) - Souris doivent changer zone en 3 min (1×)
6. **1ère Touche = Chat** (Global) - Première souris touchée devient chat

### Notifications
- Badge avec compteur
- Panneau avec historique (heure + icône + message)
- Événements : joueurs join/quit, souris touchée, zone supprimée, modifiers, etc.

## 🔧 Configuration

### Changer le mot de passe
Le mot de passe est stocké dans Firebase. Pour le changer :
1. Aller dans Firebase Console → Realtime Database
2. Modifier `/config/passwordHash`
3. Utiliser un générateur SHA-256 en ligne pour hasher le nouveau mot de passe

### Ajuster les constantes (config.js)
```javascript
const ZONE_BUFFER_METERS = 10;     // Marge zones (10m)
const HP_LOSS_INTERVAL = 3000;      // Perte HP (3 sec)
const CAMPING_RADIUS = 10;          // Rayon camping (10m)
const CAMPING_TIME = 180000;        // Temps camping (3 min)
const DEAD_ZONE_PING_TIME = 60000;  // Temps ping zone morte (1 min)
```

## 📱 Mobile
- Interface optimisée touch
- Boutons 44px minimum
- Adaptation écrans petits/landscape
- Safe areas iOS
- Prévention zoom sur inputs

## 🐛 Debug
Pour débugger, ouvrir la console navigateur (F12) et vérifier :
- Les erreurs Firebase
- Les positions GPS
- Les états du jeu dans `window.gameState`

## 🎯 TODO / Améliorations futures
- Équipes manuelles (drag & drop)
- Statistiques de partie
- Historique des parties
- Mode spectateur
- Replay des parties

---

**Développé avec ❤️ pour jouer entre potes !**
