// ==========================================
// CONFIGURATION FIREBASE
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyBB1Ly4gEo0jZakLo1ZWtaKz9-HriOy-CM",
    authDomain: "cat-royal.firebaseapp.com",
    projectId: "cat-royal",
    databaseURL: "https://cat-royal-default-rtdb.europe-west1.firebasedatabase.app/"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Mot de passe commun (à changer selon vos besoins)
const COMMON_PASSWORD = "catroyal2025";

// ==========================================
// VARIABLES GLOBALES
// ==========================================
let currentUser = null;
let currentGameId = null;
let currentMapId = null;
let isHost = false;

// Maps Leaflet
let mapEditor = null;
let mapGame = null;

// Éditeur
let editorZones = [];
let currentDraftPoints = [];
let draftMarkers = [];
let tempLines = null;
let ghostCursor = null;
let snapEnabled = true;
let shiftPressed = false;

// Jeu
let gameZones = [];
let gamePolygons = [];
let myPosition = null;
let myRole = null; // 'cat' ou 'mouse'
let myTeam = null;
let myHP = 100;
let isAlive = true;
let gameTimer = null;
let gameStartTime = null;
let currentPhase = null; // 'hiding' ou 'playing'
let finalZoneIndex = null;
let zonesToDelete = 0;
let deletedZones = [];
let pingMarkers = [];
let teammateMarker = null;
let myMarker = null;
let inDeadZoneSince = null;
let hpWhenEnteringDeadZone = 100;
let penaltyPingSent = false;
let gpsWatchId = null;

// Écouteurs Firebase
let gameListener = null;
let gameStateListener = null;
let playersListener = null;

// ==========================================
// NAVIGATION ENTRE LES PAGES
// ==========================================
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    document.getElementById(pageId).style.display = 'block';
}

// ==========================================
// AUTHENTIFICATION
// ==========================================
async function login() {
    const pseudo = document.getElementById('input-pseudo').value.trim();
    const password = document.getElementById('input-password').value;
    const errorDiv = document.getElementById('login-error');

    if (!pseudo || pseudo.length < 2) {
        errorDiv.textContent = "Pseudo invalide (min 2 caractères)";
        return;
    }

    if (password !== COMMON_PASSWORD) {
        errorDiv.textContent = "Mot de passe incorrect";
        return;
    }

    // Vérifier si le pseudo existe
    const usersRef = db.ref('users');
    const snapshot = await usersRef.orderByChild('pseudo').equalTo(pseudo).once('value');

    if (snapshot.exists()) {
        // Pseudo existe déjà, on récupère l'userId
        const userId = Object.keys(snapshot.val())[0];
        currentUser = { id: userId, pseudo: pseudo };
    } else {
        // Nouveau utilisateur
        const newUserRef = usersRef.push();
        await newUserRef.set({
            pseudo: pseudo,
            createdAt: Date.now()
        });
        currentUser = { id: newUserRef.key, pseudo: pseudo };
    }

    errorDiv.textContent = "";
    showDashboard();
}

function logout() {
    currentUser = null;
    document.getElementById('input-pseudo').value = "";
    document.getElementById('input-password').value = "";
    showPage('page-login');
}

// ==========================================
// DASHBOARD
// ==========================================
function showDashboard() {
    showPage('page-dashboard');
    document.getElementById('user-pseudo').textContent = currentUser.pseudo;
    loadGames();
    loadMaps();
}

function loadGames() {
    const gamesRef = db.ref('games');
    gamesRef.on('value', (snapshot) => {
        const gamesList = document.getElementById('games-list');
        gamesList.innerHTML = "";

        if (!snapshot.exists()) {
            gamesList.innerHTML = "<p style='color:#888; padding:10px;'>Aucune partie en cours</p>";
            return;
        }

        const games = snapshot.val();
        Object.keys(games).forEach(gameId => {
            const game = games[gameId];
            if (game.status === 'waiting') {
                const playerCount = game.players ? Object.keys(game.players).length : 0;
                const gameDiv = document.createElement('div');
                gameDiv.className = 'game-item';
                gameDiv.innerHTML = `
                    <div class="game-info">
                        <h3>Partie de ${game.creatorPseudo}</h3>
                        <p>${playerCount} joueur(s)</p>
                    </div>
                    <button onclick="joinGame('${gameId}')">Rejoindre</button>
                `;
                gamesList.appendChild(gameDiv);
            }
        });
    });
}

function loadMaps() {
    const mapsRef = db.ref('maps');
    mapsRef.on('value', (snapshot) => {
        const mapsList = document.getElementById('maps-list');
        mapsList.innerHTML = "";

        if (!snapshot.exists()) {
            mapsList.innerHTML = "<p style='color:#888; padding:10px;'>Aucune map disponible</p>";
            return;
        }

        const maps = snapshot.val();
        Object.keys(maps).forEach(mapId => {
            const map = maps[mapId];
            const mapDiv = document.createElement('div');
            mapDiv.className = 'map-item';
            mapDiv.innerHTML = `
                <div class="map-info">
                    <h3>${map.name}</h3>
                    <p>${map.zones ? map.zones.length : 0} zones - par ${map.creatorPseudo}</p>
                </div>
            `;
            mapsList.appendChild(mapDiv);
        });
    });
}

async function createGame() {
    const newGameRef = db.ref('games').push();
    await newGameRef.set({
        creatorId: currentUser.id,
        creatorPseudo: currentUser.pseudo,
        status: 'waiting',
        mapId: null,
        players: {
            [currentUser.id]: {
                pseudo: currentUser.pseudo,
                role: null,
                team: null
            }
        },
        teams: null,
        createdAt: Date.now()
    });

    currentGameId = newGameRef.key;
    isHost = true;
    showLobby();
}

async function joinGame(gameId) {
    currentGameId = gameId;
    isHost = false;

    // Ajouter le joueur à la partie
    await db.ref(`games/${gameId}/players/${currentUser.id}`).set({
        pseudo: currentUser.pseudo,
        role: null,
        team: null
    });

    showLobby();
}

// ==========================================
// LOBBY
// ==========================================
function showLobby() {
    showPage('page-lobby');
    loadLobbyMaps();
    
    // Écouter les changements de la partie
    gameListener = db.ref(`games/${currentGameId}`).on('value', (snapshot) => {
        const game = snapshot.val();
        if (!game) {
            alert("La partie n'existe plus");
            showDashboard();
            return;
        }

        // Si la partie démarre, aller au jeu
        if (game.status === 'playing') {
            gameListener && db.ref(`games/${currentGameId}`).off('value', gameListener);
            startGamePhase();
            return;
        }

        updateLobbyPlayers(game.players);
        
        // Afficher le bouton start uniquement pour l'hôte
        if (isHost) {
            document.getElementById('lobby-teams-section').style.display = 'block';
            const canStart = game.mapId && game.teams;
            document.getElementById('btn-start-game').style.display = canStart ? 'block' : 'none';
        }
    });
}

function loadLobbyMaps() {
    const select = document.getElementById('lobby-map-select');
    select.innerHTML = '<option value="">-- Choisir une map --</option>';

    db.ref('maps').once('value', (snapshot) => {
        if (snapshot.exists()) {
            const maps = snapshot.val();
            Object.keys(maps).forEach(mapId => {
                const map = maps[mapId];
                const option = document.createElement('option');
                option.value = mapId;
                option.textContent = `${map.name} (${map.zones ? map.zones.length : 0} zones)`;
                select.appendChild(option);
            });
        }
    });
}

async function updateLobbyMap() {
    if (!isHost) return;
    
    const mapId = document.getElementById('lobby-map-select').value;
    if (mapId) {
        await db.ref(`games/${currentGameId}/mapId`).set(mapId);
        
        // Afficher aperçu
        const mapSnapshot = await db.ref(`maps/${mapId}`).once('value');
        const map = mapSnapshot.val();
        document.getElementById('lobby-map-preview').textContent = 
            `✅ ${map.name} sélectionnée (${map.zones.length} zones)`;
    }
}

function updateLobbyPlayers(players) {
    const list = document.getElementById('lobby-players-list');
    const count = document.getElementById('lobby-player-count');
    list.innerHTML = "";
    
    if (!players) {
        count.textContent = "0";
        return;
    }

    const playerIds = Object.keys(players);
    count.textContent = playerIds.length;

    playerIds.forEach(playerId => {
        const player = players[playerId];
        const div = document.createElement('div');
        div.className = 'player-tag';
        if (playerId === currentUser.id) {
            div.classList.add('is-host');
        }
        div.textContent = player.pseudo;
        list.appendChild(div);
    });
}

async function autoAssignTeams() {
    if (!isHost) return;

    const gameSnapshot = await db.ref(`games/${currentGameId}`).once('value');
    const game = gameSnapshot.val();
    const playerIds = Object.keys(game.players);
    const totalPlayers = playerIds.length;

    // Calcul : 1/4 de chats (min 2)
    const nbCats = Math.max(2, Math.floor(totalPlayers / 4));
    const nbMice = totalPlayers - nbCats;

    // Mélanger
    const shuffled = playerIds.sort(() => Math.random() - 0.5);

    const teams = {
        cats: shuffled.slice(0, nbCats),
        mice: []
    };

    // Souris par équipes de 2
    const miceIds = shuffled.slice(nbCats);
    for (let i = 0; i < miceIds.length; i += 2) {
        if (i + 1 < miceIds.length) {
            teams.mice.push([miceIds[i], miceIds[i + 1]]);
        } else {
            // Si impair, la dernière souris est seule
            teams.mice.push([miceIds[i]]);
        }
    }

    await db.ref(`games/${currentGameId}/teams`).set(teams);
    displayTeamsPreview(teams, game.players);
}

function showManualTeams() {
    alert("Équipes manuelles : Fonctionnalité à implémenter (drag & drop)");
    // TODO : Interface pour assigner manuellement
}

function displayTeamsPreview(teams, players) {
    const preview = document.getElementById('teams-preview');
    preview.innerHTML = "";

    // Chats
    const catsDiv = document.createElement('div');
    catsDiv.className = 'team-group';
    catsDiv.innerHTML = '<h4>🐱 Chats</h4><div class="team-members"></div>';
    teams.cats.forEach(catId => {
        const span = document.createElement('span');
        span.className = 'team-member';
        span.textContent = players[catId].pseudo;
        catsDiv.querySelector('.team-members').appendChild(span);
    });
    preview.appendChild(catsDiv);

    // Souris
    teams.mice.forEach((mouseTeam, index) => {
        const miceDiv = document.createElement('div');
        miceDiv.className = 'team-group';
        miceDiv.innerHTML = `<h4>🐭 Souris ${index + 1}</h4><div class="team-members"></div>`;
        mouseTeam.forEach(mouseId => {
            const span = document.createElement('span');
            span.className = 'team-member';
            span.textContent = players[mouseId].pseudo;
            miceDiv.querySelector('.team-members').appendChild(span);
        });
        preview.appendChild(miceDiv);
    });
}

async function startGame() {
    if (!isHost) return;

    const gameSnapshot = await db.ref(`games/${currentGameId}`).once('value');
    const game = gameSnapshot.val();

    if (!game.mapId || !game.teams) {
        alert("Sélectionnez une map et créez les équipes");
        return;
    }

    // Charger la map
    const mapSnapshot = await db.ref(`maps/${game.mapId}`).once('value');
    const map = mapSnapshot.val();

    // Choisir zone finale aléatoire
    const randomZoneIndex = Math.floor(Math.random() * map.zones.length);

    // Calculer le timer : 3min cache + (nb_zones - 1) * 3min - 3min (2 zones au début) + 6min finale
    const totalTime = 3 + (map.zones.length - 1) * 3 - 3 + 6;

    // Assigner rôles et équipes
    const updates = {};
    game.teams.cats.forEach(catId => {
        updates[`players/${catId}/role`] = 'cat';
        updates[`players/${catId}/team`] = 'cats';
    });
    game.teams.mice.forEach((mouseTeam, teamIndex) => {
        mouseTeam.forEach(mouseId => {
            updates[`players/${mouseId}/role`] = 'mouse';
            updates[`players/${mouseId}/team`] = `mice_${teamIndex}`;
        });
    });

    updates['status'] = 'playing';
    updates['startTime'] = Date.now();
    updates['totalTime'] = totalTime * 60; // en secondes
    updates['finalZoneIndex'] = randomZoneIndex;
    updates['currentPhase'] = 'hiding';

    await db.ref(`games/${currentGameId}`).update(updates);

    // Initialiser gameState
    await db.ref(`gameState/${currentGameId}`).set({
        deletedZones: [],
        pings: {},
        players: {}
    });
}

async function leaveLobby() {
    // Retirer le joueur de la partie
    await db.ref(`games/${currentGameId}/players/${currentUser.id}`).remove();

    // Vérifier s'il reste des joueurs
    const playersSnapshot = await db.ref(`games/${currentGameId}/players`).once('value');
    if (!playersSnapshot.exists()) {
        // Supprimer la partie si vide
        await db.ref(`games/${currentGameId}`).remove();
    }

    gameListener && db.ref(`games/${currentGameId}`).off('value', gameListener);
    currentGameId = null;
    isHost = false;
    showDashboard();
}

// ==========================================
// ÉDITEUR DE MAP
// ==========================================
function showMapEditor() {
    showPage('page-editor');
    
    if (!mapEditor) {
        mapEditor = L.map('map-editor', {
            center: [48.8475, 2.4390],
            zoom: 17,
            zoomControl: true
        });
        
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png').addTo(mapEditor);
        
        // Couches
        const editorGroup = L.layerGroup().addTo(mapEditor);
        tempLines = L.polyline([], { color: '#00ffff', weight: 3 }).addTo(editorGroup);
        ghostCursor = L.circleMarker([0, 0], { radius: 6, color: '#ff00ff', opacity: 1 }).addTo(editorGroup);
        
        // Événements
        mapEditor.on('click', onEditorClick);
        document.body.classList.add('editor-active');
        document.getElementById('custom-cursor').style.display = 'block';
    } else {
        mapEditor.invalidateSize();
    }

    updateZoneCount();
}

function onEditorClick() {
    const pos = ghostCursor.getLatLng();
    currentDraftPoints.push([pos.lat, pos.lng]);
    tempLines.setLatLngs(currentDraftPoints);
    
    const marker = L.circleMarker(pos, {
        radius: 4,
        color: 'white',
        fillColor: 'cyan',
        fillOpacity: 1
    }).addTo(mapEditor);
    draftMarkers.push(marker);
}

window.addEventListener('mousemove', (e) => {
    if (!mapEditor || !ghostCursor) return;

    const cursor = document.getElementById('custom-cursor');
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';

    const mouseLatLng = mapEditor.mouseEventToLatLng(e);
    const mouseP = mapEditor.latLngToLayerPoint(mouseLatLng);
    let bestLatLng = mouseLatLng;
    let type = "none";

    if (snapEnabled && !shiftPressed) {
        let bestDist = 40;

        // Snap aux angles existants
        let nodes = [];
        editorZones.forEach(zone => {
            zone.getLatLngs()[0].forEach(pt => nodes.push(pt));
        });
        currentDraftPoints.forEach(p => nodes.push(L.latLng(p[0], p[1])));

        nodes.forEach(node => {
            let d = mouseP.distanceTo(mapEditor.latLngToLayerPoint(node));
            if (d < bestDist) {
                bestDist = d;
                bestLatLng = node;
                type = "angle";
            }
        });

        // Snap aux segments
        if (type === "none") {
            editorZones.forEach(zone => {
                const pts = zone.getLatLngs()[0];
                for (let i = 0; i < pts.length; i++) {
                    const p1 = mapEditor.latLngToLayerPoint(pts[i]);
                    const p2 = mapEditor.latLngToLayerPoint(pts[(i + 1) % pts.length]);
                    const closest = L.LineUtil.closestPointOnSegment(mouseP, p1, p2);
                    if (mouseP.distanceTo(closest) < 30) {
                        bestLatLng = mapEditor.layerPointToLatLng(closest);
                        type = "segment";
                    }
                }
            });
        }
    }

    ghostCursor.setLatLng(bestLatLng);
    const colors = { angle: "#00ff00", segment: "#00ffff", none: "#ff00ff" };
    const finalColor = (snapEnabled && !shiftPressed) ? colors[type] : colors["none"];
    ghostCursor.setStyle({ color: finalColor });
    document.getElementById('cursor-dot').style.background = finalColor;
});

window.addEventListener('keydown', (e) => {
    if (e.key === "Shift") shiftPressed = true;
    if (e.key.toLowerCase() === 'm') toggleSnap();
    
    if (mapEditor && e.key === 'Enter' && currentDraftPoints.length >= 3) {
        createZone();
    }
    
    if (mapEditor && e.ctrlKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        currentDraftPoints.pop();
        tempLines.setLatLngs(currentDraftPoints);
        const lastM = draftMarkers.pop();
        if (lastM) mapEditor.removeLayer(lastM);
    }
});

window.addEventListener('keyup', (e) => {
    if (e.key === "Shift") shiftPressed = false;
});

function toggleSnap() {
    snapEnabled = !snapEnabled;
    const btn = document.getElementById('btn-snap');
    if (btn) {
        btn.classList.toggle('active', snapEnabled);
        btn.classList.toggle('disabled', !snapEnabled);
        btn.textContent = snapEnabled ? "Aimant [M]" : "Aimant OFF";
    }
}

function createZone() {
    if (currentDraftPoints.length < 3) return;

    const poly = L.polygon(currentDraftPoints, {
        color: '#ffcc00',
        fillOpacity: 0.4
    }).addTo(mapEditor);

    poly.on('contextmenu', (e) => {
        L.DomEvent.stopPropagation(e);
        if (confirm("Supprimer cette zone ?")) {
            mapEditor.removeLayer(poly);
            editorZones = editorZones.filter(z => z !== poly);
            updateZoneCount();
        }
    });

    editorZones.push(poly);
    clearDraft();
    updateZoneCount();
}

function clearDraft() {
    currentDraftPoints = [];
    draftMarkers.forEach(m => mapEditor.removeLayer(m));
    draftMarkers = [];
    tempLines.setLatLngs([]);
}

function updateZoneCount() {
    const count = document.getElementById('zone-count');
    if (count) {
        count.textContent = `Zones: ${editorZones.length}`;
    }
}

function clearAllZones() {
    if (!confirm("Supprimer toutes les zones ?")) return;
    
    editorZones.forEach(zone => mapEditor.removeLayer(zone));
    editorZones = [];
    clearDraft();
    updateZoneCount();
}

async function saveMap() {
    const mapName = document.getElementById('map-name-input').value.trim();
    
    if (!mapName) {
        alert("Donnez un nom à votre map");
        return;
    }

    if (editorZones.length < 3) {
        alert("Créez au moins 3 zones");
        return;
    }

    const zones = editorZones.map(zone => ({
        coords: zone.getLatLngs()[0].map(ll => [ll.lat, ll.lng])
    }));

    const newMapRef = db.ref('maps').push();
    await newMapRef.set({
        name: mapName,
        creatorId: currentUser.id,
        creatorPseudo: currentUser.pseudo,
        zones: zones,
        createdAt: Date.now()
    });

    alert(`Map "${mapName}" sauvegardée avec ${zones.length} zones !`);
    leaveEditor();
}

function leaveEditor() {
    clearAllZones();
    document.getElementById('map-name-input').value = "";
    document.body.classList.remove('editor-active');
    document.getElementById('custom-cursor').style.display = 'none';
    showDashboard();
}

// ==========================================
// JEU - DÉMARRAGE
// ==========================================
async function startGamePhase() {
    showPage('page-game');

    // Charger les données de la partie
    const gameSnapshot = await db.ref(`games/${currentGameId}`).once('value');
    const game = gameSnapshot.val();

    myRole = game.players[currentUser.id].role;
    myTeam = game.players[currentUser.id].team;
    gameStartTime = game.startTime;
    currentPhase = game.currentPhase;

    if (myRole === 'cat') {
        finalZoneIndex = game.finalZoneIndex;
    }

    // Charger la map
    const mapSnapshot = await db.ref(`maps/${game.mapId}`).once('value');
    const map = mapSnapshot.val();
    gameZones = map.zones;

    // Initialiser la carte
    if (!mapGame) {
        mapGame = L.map('map-game', {
            center: [48.8475, 2.4390],
            zoom: 17,
            zoomControl: true
        });
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png').addTo(mapGame);
    } else {
        mapGame.invalidateSize();
    }

    // Afficher les zones
    gameZones.forEach((zone, index) => {
        const poly = L.polygon(zone.coords, {
            color: '#ffcc00',
            fillColor: '#ffcc00',
            fillOpacity: 0.2,
            weight: 2
        }).addTo(mapGame);
        
        poly.zoneIndex = index;
        gamePolygons.push(poly);

        // Chats peuvent cliquer pour supprimer
        if (myRole === 'cat' && currentPhase === 'playing') {
            poly.on('click', () => deleteZone(index));
        }
    });

    // Marker joueur
    myMarker = L.circleMarker([48.8475, 2.4390], {
        radius: 8,
        color: 'white',
        fillColor: myRole === 'cat' ? '#ff4444' : '#4444ff',
        fillOpacity: 1
    }).addTo(mapGame);

    // UI
    setupGameUI();
    startGPSTracking();
    startGameTimer(game.totalTime);
    listenToGameState();
}

function setupGameUI() {
    // Rôle
    const roleBadge = document.getElementById('player-role');
    roleBadge.textContent = myRole === 'cat' ? 'CHAT' : 'SOURIS';
    roleBadge.className = `role-badge ${myRole}`;

    document.getElementById('team-name').textContent = myTeam;

    // Contrôles selon rôle
    if (myRole === 'cat') {
        document.getElementById('cat-controls').style.display = 'block';
        document.getElementById('mouse-controls').style.display = 'none';
        document.getElementById('hp-display').style.display = 'none';
        
        if (finalZoneIndex !== null) {
            document.getElementById('final-zone-info').textContent = 
                `Zone finale : Zone ${finalZoneIndex + 1}`;
        }
    } else {
        document.getElementById('cat-controls').style.display = 'none';
        document.getElementById('mouse-controls').style.display = 'block';
        document.getElementById('hp-display').style.display = 'flex';
        updateHPDisplay();
    }
}

function startGameTimer(totalSeconds) {
    const updateTimer = () => {
        const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
        const remaining = Math.max(0, totalSeconds - elapsed);

        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;
        document.getElementById('game-timer').textContent = 
            `${minutes}:${seconds.toString().padStart(2, '0')}`;

        // Mettre à jour la phase
        if (elapsed >= 180 && currentPhase === 'hiding') {
            currentPhase = 'playing';
            document.getElementById('game-phase').textContent = "Chasse en cours";
            
            if (myRole === 'cat') {
                zonesToDelete = 2; // 2 zones à supprimer au début
                updateZonesToDeleteDisplay();
            }
        }

        // Ping toutes les 3 minutes (à partir de 6min = 360s)
        if (myRole === 'cat' && elapsed >= 360 && elapsed % 180 === 0) {
            updateMousePings();
        }

        // Nettoyer les vieux pings (toutes les 10 secondes)
        if (myRole === 'cat' && elapsed % 10 === 0) {
            cleanOldPings();
        }

        // Zones à supprimer toutes les 3 minutes (après la phase initiale)
        if (myRole === 'cat' && currentPhase === 'playing' && elapsed > 180) {
            const timeSincePlaying = elapsed - 180;
            if (timeSincePlaying > 0 && timeSincePlaying % 180 === 0) {
                zonesToDelete++;
                updateZonesToDeleteDisplay();
            }
        }

        if (remaining > 0) {
            gameTimer = setTimeout(updateTimer, 1000);
        } else {
            endGame();
        }
    };

    updateTimer();
}

function startGPSTracking() {
    gpsWatchId = navigator.geolocation.watchPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            myPosition = [lat, lng];

            myMarker.setLatLng([lat, lng]);
            mapGame.setView([lat, lng], mapGame.getZoom());

            // Mettre à jour dans Firebase
            db.ref(`gameState/${currentGameId}/players/${currentUser.id}`).update({
                lat: lat,
                lng: lng,
                hp: myHP,
                alive: isAlive,
                lastUpdate: Date.now()
            });

            // Vérifier si dans zone morte
            if (myRole === 'mouse' && isAlive) {
                checkDeadZone(lat, lng);
            }
        },
        (error) => {
            console.error("GPS error:", error);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );
}

function listenToGameState() {
    gameStateListener = db.ref(`gameState/${currentGameId}`).on('value', (snapshot) => {
        if (!snapshot.exists()) return;
        
        const state = snapshot.val();

        // Zones supprimées
        if (state.deletedZones) {
            deletedZones = state.deletedZones;
            updateDeletedZonesDisplay();
        }

        // Pings des souris (pour les chats)
        if (myRole === 'cat' && state.pings) {
            displayPings(state.pings);
        }

        // Coéquipier (pour les souris)
        if (myRole === 'mouse' && state.players) {
            displayTeammate(state.players);
        }
    });
}

function updateDeletedZonesDisplay() {
    deletedZones.forEach(index => {
        if (gamePolygons[index]) {
            gamePolygons[index].setStyle({
                fillColor: '#ff0000',
                fillOpacity: 0.5,
                color: '#ff0000'
            });
        }
    });
}

async function deleteZone(zoneIndex) {
    if (myRole !== 'cat' || zonesToDelete <= 0) return;
    if (zoneIndex === finalZoneIndex) {
        alert("Impossible de supprimer la zone finale !");
        return;
    }
    if (deletedZones.includes(zoneIndex)) {
        alert("Zone déjà supprimée");
        return;
    }

    deletedZones.push(zoneIndex);
    await db.ref(`gameState/${currentGameId}/deletedZones`).set(deletedZones);

    zonesToDelete--;
    updateZonesToDeleteDisplay();
    updateDeletedZonesDisplay();
}

function updateZonesToDeleteDisplay() {
    document.getElementById('zones-to-delete').textContent = zonesToDelete;
}

function checkDeadZone(lat, lng) {
    const point = turf.point([lng, lat]);
    let inDeadZone = false;

    deletedZones.forEach(index => {
        const zone = gameZones[index];
        const poly = turf.polygon([zone.coords.map(c => [c[1], c[0]])]);
        if (turf.booleanPointInPolygon(point, poly)) {
            inDeadZone = true;
        }
    });

    if (inDeadZone) {
        document.getElementById('danger-warning').style.display = 'block';
        
        if (!inDeadZoneSince) {
            inDeadZoneSince = Date.now();
            hpWhenEnteringDeadZone = myHP; // Sauvegarder les HP actuels
            penaltyPingSent = false; // Réinitialiser le flag
        }

        // Dégâts : -1 HP toutes les 2 secondes
        const timeInDeadZone = Date.now() - inDeadZoneSince;
        const hpLoss = Math.floor(timeInDeadZone / 2000);
        myHP = Math.max(0, hpWhenEnteringDeadZone - hpLoss);
        updateHPDisplay();

        // Ping pénalité après 60s (une seule fois)
        if (timeInDeadZone >= 60000 && isAlive && !penaltyPingSent) {
            sendPenaltyPing(lat, lng);
            penaltyPingSent = true;
        }

        if (myHP <= 0 && isAlive) {
            eliminatePlayer();
        }
    } else {
        document.getElementById('danger-warning').style.display = 'none';
        inDeadZoneSince = null;
        penaltyPingSent = false;
    }
}

function updateHPDisplay() {
    const hpValue = document.getElementById('hp-value');
    const hpFill = document.getElementById('hp-fill');
    
    hpValue.textContent = myHP;
    hpFill.style.width = myHP + '%';

    hpFill.className = '';
    if (myHP < 30) hpFill.classList.add('critical');
    else if (myHP < 60) hpFill.classList.add('low');
}

async function sendPenaltyPing(lat, lng) {
    await db.ref(`gameState/${currentGameId}/pings/${currentUser.id}`).set({
        lat: lat,
        lng: lng,
        pseudo: currentUser.pseudo,
        type: 'penalty',
        timestamp: Date.now()
    });
}

async function updateMousePings() {
    // Récupérer toutes les souris vivantes
    const stateSnapshot = await db.ref(`gameState/${currentGameId}/players`).once('value');
    if (!stateSnapshot.exists()) return;

    const players = stateSnapshot.val();
    const gameSnapshot = await db.ref(`games/${currentGameId}/players`).once('value');
    const gamePlayers = gameSnapshot.val();

    Object.keys(players).forEach(playerId => {
        const player = players[playerId];
        const gamePlayer = gamePlayers[playerId];
        
        if (gamePlayer.role === 'mouse' && player.alive) {
            db.ref(`gameState/${currentGameId}/pings/${playerId}`).set({
                lat: player.lat,
                lng: player.lng,
                pseudo: gamePlayer.pseudo,
                type: 'regular',
                timestamp: Date.now()
            });
        }
    });
}

async function cleanOldPings() {
    const pingsSnapshot = await db.ref(`gameState/${currentGameId}/pings`).once('value');
    if (!pingsSnapshot.exists()) return;

    const pings = pingsSnapshot.val();
    const now = Date.now();
    const updates = {};

    Object.keys(pings).forEach(pingId => {
        const ping = pings[pingId];
        // Supprimer les pings de plus de 3 minutes (180000ms)
        if (now - ping.timestamp > 180000) {
            updates[pingId] = null;
        }
    });

    if (Object.keys(updates).length > 0) {
        await db.ref(`gameState/${currentGameId}/pings`).update(updates);
    }
}

function displayPings(pings) {
    // Nettoyer les anciens pings
    pingMarkers.forEach(m => mapGame.removeLayer(m));
    pingMarkers = [];

    Object.keys(pings).forEach(playerId => {
        const ping = pings[playerId];
        const marker = L.circleMarker([ping.lat, ping.lng], {
            radius: 10,
            color: ping.type === 'penalty' ? '#ff0000' : '#ffaa00',
            fillColor: ping.type === 'penalty' ? '#ff0000' : '#ffaa00',
            fillOpacity: 0.6
        }).addTo(mapGame);

        marker.bindPopup(`<b>${ping.pseudo}</b><br>${ping.type === 'penalty' ? 'Pénalité' : 'Position'}`);
        pingMarkers.push(marker);
    });
}

function displayTeammate(players) {
    // Trouver le coéquipier
    const gameSnapshot = db.ref(`games/${currentGameId}/players`).once('value').then(snapshot => {
        const gamePlayers = snapshot.val();
        const teammate = Object.keys(gamePlayers).find(id => 
            id !== currentUser.id && 
            gamePlayers[id].team === myTeam
        );

        if (teammate && players[teammate]) {
            const pos = players[teammate];
            
            if (!teammateMarker) {
                teammateMarker = L.circleMarker([pos.lat, pos.lng], {
                    radius: 6,
                    color: '#00ffff',
                    fillColor: '#00ffff',
                    fillOpacity: 0.7
                }).addTo(mapGame);
            } else {
                teammateMarker.setLatLng([pos.lat, pos.lng]);
            }
        }
    });
}

async function declareTouched() {
    if (!confirm("Confirmer : vous êtes touché ?")) return;
    eliminatePlayer();
}

async function eliminatePlayer() {
    isAlive = false;
    myHP = 0;
    updateHPDisplay();

    await db.ref(`gameState/${currentGameId}/players/${currentUser.id}`).update({
        alive: false,
        hp: 0
    });

    alert("Vous avez été éliminé !");
    // On peut rester en spectateur
}

function endGame() {
    clearTimeout(gameTimer);
    if (gpsWatchId) navigator.geolocation.clearWatch(gpsWatchId);
    
    alert("Partie terminée !");
    
    // Nettoyer
    gameStateListener && db.ref(`gameState/${currentGameId}`).off('value', gameStateListener);
    
    showDashboard();
}

// ==========================================
// INITIALISATION
// ==========================================
window.onload = () => {
    showPage('page-login');
};
