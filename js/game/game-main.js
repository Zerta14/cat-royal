// ==========================================
// GAME MAIN
// ==========================================

async function startGamePhase() {
    const game = await dbGet(`games/${window.gameState.currentGameId}`);
    const map = await dbGet(`maps/${game.mapId}`);

    window.gameState.myRole = game.players[window.gameState.currentUser.id].role;
    window.gameState.myTeam = game.players[window.gameState.currentUser.id].team;
    window.gameState.gameStartTime = game.startTime;
    window.gameState.currentPhase = game.currentPhase;
    window.gameState.finalZoneIndex = game.finalZoneIndex;
    window.gameState.gameZones = map.zones;
    window.gameState.activeModifiers = game.modifiers || {};
    window.gameState.myHP = 100;
    window.gameState.isAlive = true;
    window.gameState.notifications = [];
    window.gameState.unreadCount = 0;

    // Initialiser la carte
    if (!window.gameState.mapGame) {
        window.gameState.mapGame = L.map('map-game', {
            center: [48.8475, 2.4390],
            zoom: 17,
            zoomControl: true
        });
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png')
            .addTo(window.gameState.mapGame);
    } else {
        window.gameState.mapGame.invalidateSize();
    }

    // Afficher les zones
    displayZones();
    updateDeletedZonesDisplay();

    // Marker joueur
    window.gameState.myMarker = L.circleMarker([48.8475, 2.4390], {
        radius: 8,
        color: 'white',
        fillColor: window.gameState.myRole === 'cat' ? '#ff4444' : '#4444ff',
        fillOpacity: 1
    }).addTo(window.gameState.mapGame);

    // UI
    setupGameUI();
    
    // GPS
    startGPSTracking();
    
    // Timer
    startGameTimer(game.totalTime);
    
    // Pings
    if (window.gameState.myRole === 'cat') {
        displayPings();
        updateZonesToDeleteDisplay();
    } else {
        displayTeammate();
    }

    // Modifiers
    setupModifiers();
    checkForceZoneChange();
    
    // Notifications
    loadNotificationsFromFirebase();
    
    addNotification("La partie commence !", "🎮");
}

function setupGameUI() {
    const roleBadge = document.getElementById('player-role');
    roleBadge.textContent = window.gameState.myRole === 'cat' ? 'CHAT' : 'SOURIS';
    roleBadge.className = `role-badge ${window.gameState.myRole}`;

    document.getElementById('team-name').textContent = window.gameState.myTeam;

    if (window.gameState.myRole === 'cat') {
        document.getElementById('cat-controls').style.display = 'block';
        document.getElementById('mouse-controls').style.display = 'none';
        document.getElementById('hp-display').style.display = 'none';
        
        if (window.gameState.finalZoneIndex >= 0) {
            document.getElementById('final-zone-info').textContent = 
                `Zone finale: Zone ${window.gameState.finalZoneIndex + 1}`;
        } else {
            document.getElementById('final-zone-info').textContent = "Choisissez la zone finale";
        }
    } else {
        document.getElementById('cat-controls').style.display = 'none';
        document.getElementById('mouse-controls').style.display = 'block';
        document.getElementById('hp-display').style.display = 'flex';
        updateHPDisplay();
    }
}

function startGPSTracking() {
    window.gameState.gpsWatchId = navigator.geolocation.watchPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            window.gameState.myPosition = [lat, lng];

            window.gameState.myMarker.setLatLng([lat, lng]);
            window.gameState.mapGame.setView([lat, lng], window.gameState.mapGame.getZoom());

            // Mettre à jour dans Firebase
            dbUpdate(`gameState/${window.gameState.currentGameId}/players/${window.gameState.currentUser.id}`, {
                lat: lat,
                lng: lng,
                hp: window.gameState.myHP,
                alive: window.gameState.isAlive,
                lastUpdate: Date.now()
            });
        },
        (error) => {
            console.error("GPS error:", error);
            alert("Erreur GPS : Activez la géolocalisation");
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );
}

async function declareTouched() {
    if (!confirmAction("Confirmer : vous êtes touché ?")) return;
    await eliminatePlayer();
}

async function eliminatePlayer() {
    window.gameState.isAlive = false;
    window.gameState.myHP = 0;
    
    if (window.gameState.myRole === 'mouse') {
        updateHPDisplay();
    }

    await dbUpdate(`gameState/${window.gameState.currentGameId}/players/${window.gameState.currentUser.id}`, {
        alive: false,
        hp: 0
    });

    addNotification(`${window.gameState.currentUser.pseudo} éliminé`, "❌");

    // Modifier first_touch_cat
    if (window.gameState.activeModifiers.first_touch_cat) {
        const game = await dbGet(`games/${window.gameState.currentGameId}`);
        const alreadyApplied = await dbGet(`gameState/${window.gameState.currentGameId}/modifierStates/first_touch_applied`);
        
        if (!alreadyApplied) {
            await dbUpdate(`games/${window.gameState.currentGameId}/players/${window.gameState.currentUser.id}`, {
                role: 'cat'
            });
            await dbUpdate(`gameState/${window.gameState.currentGameId}/modifierStates`, {
                first_touch_applied: true
            });
            
            window.gameState.myRole = 'cat';
            window.gameState.isAlive = true;
            window.gameState.myHP = 100;
            
            addNotification("Vous êtes devenu chat !", "🔀");
            
            // Recharger le jeu avec nouveau rôle
            setTimeout(() => {
                location.reload();
            }, 2000);
        }
    }
}

async function quitGame() {
    if (!confirmAction("Quitter la partie ?")) return;

    clearTimeout(window.gameState.gameTimer);
    if (window.gameState.gpsWatchId) {
        navigator.geolocation.clearWatch(window.gameState.gpsWatchId);
    }

    await leaveGame();
}

async function leaveGame() {
    if (window.gameState.currentGameId) {
        await dbRemove(`games/${window.gameState.currentGameId}/players/${window.gameState.currentUser.id}`);
        await dbRemove(`gameState/${window.gameState.currentGameId}/players/${window.gameState.currentUser.id}`);

        const players = await dbGet(`games/${window.gameState.currentGameId}/players`);
        if (!players || Object.keys(players).length === 0) {
            await dbRemove(`games/${window.gameState.currentGameId}`);
            await dbRemove(`gameState/${window.gameState.currentGameId}`);
        }
    }

    window.gameState.currentGameId = null;
    const session = Session.load();
    session.currentGameId = null;
    Session.save(session);

    goToDashboard();
    showDashboard();
}

function endGame() {
    clearTimeout(window.gameState.gameTimer);
    if (window.gameState.gpsWatchId) {
        navigator.geolocation.clearWatch(window.gameState.gpsWatchId);
    }

    alert("Partie terminée !");
    
    addNotification("Partie terminée", "🏁");
    
    setTimeout(() => {
        leaveGame();
    }, 3000);
}

// Event listeners
document.getElementById('btn-declare-touched').addEventListener('click', declareTouched);
document.getElementById('btn-quit-game').addEventListener('click', quitGame);
