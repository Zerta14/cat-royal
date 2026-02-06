// ==========================================
// GAME ZONES
// ==========================================

function displayZones() {
    window.gameState.gameZones.forEach((zone, index) => {
        let color = '#ffcc00';
        let fillOpacity = 0.2;

        // Zone finale en vert pour les chats
        if (window.gameState.myRole === 'cat' && index === window.gameState.finalZoneIndex) {
            color = '#00ff00';
            fillOpacity = 0.3;
        }

        const poly = L.polygon(zone.coords, {
            color: color,
            fillColor: color,
            fillOpacity: fillOpacity,
            weight: 2
        }).addTo(window.gameState.mapGame);
        
        poly.zoneIndex = index;
        window.gameState.gamePolygons.push(poly);

        // Chats peuvent cliquer pour supprimer
        if (window.gameState.myRole === 'cat') {
            poly.on('click', () => deleteZone(index));
        }
    });
}

async function deleteZone(zoneIndex) {
    if (window.gameState.myRole !== 'cat') return;

    const zonesToDelete = await dbGet(`gameState/${window.gameState.currentGameId}/zonesToDelete`);
    if (zonesToDelete <= 0) {
        alert("Aucune zone à supprimer pour le moment");
        return;
    }

    if (zoneIndex === window.gameState.finalZoneIndex) {
        alert("Zone finale protégée !");
        return;
    }

    const deletedZones = await dbGet(`gameState/${window.gameState.currentGameId}/deletedZones`) || [];
    if (deletedZones.includes(zoneIndex)) {
        alert("Zone déjà supprimée");
        return;
    }

    deletedZones.push(zoneIndex);
    await dbUpdate(`gameState/${window.gameState.currentGameId}`, {
        deletedZones: deletedZones,
        zonesToDelete: zonesToDelete - 1
    });

    addNotification(`Zone ${zoneIndex + 1} supprimée`, "🔴");
}

function updateDeletedZonesDisplay() {
    dbListen(`gameState/${window.gameState.currentGameId}/deletedZones`, (snapshot) => {
        if (!snapshot.exists()) return;

        window.gameState.deletedZones = snapshot.val();
        
        window.gameState.deletedZones.forEach(index => {
            if (window.gameState.gamePolygons[index]) {
                window.gameState.gamePolygons[index].setStyle({
                    fillColor: '#ff0000',
                    fillOpacity: 0.5,
                    color: '#ff0000'
                });
            }
        });
    });
}

function updateZonesToDeleteDisplay() {
    if (window.gameState.myRole !== 'cat') return;

    dbListen(`gameState/${window.gameState.currentGameId}/zonesToDelete`, (snapshot) => {
        const count = snapshot.val() || 0;
        document.getElementById('zones-to-delete').textContent = count;
    });
}

function checkPlayerInZones() {
    if (window.gameState.myRole !== 'mouse' || !window.gameState.isAlive) return;
    if (!window.gameState.myPosition) return;

    const [lat, lng] = window.gameState.myPosition;

    // Vérifier si dans une zone vivante (avec buffer)
    const inZoneIndex = isInAnyZone(lat, lng, window.gameState.gameZones, window.gameState.deletedZones);

    if (inZoneIndex === -1) {
        // Hors de toute zone ou dans zone morte
        handleDeadZone(lat, lng);
    } else {
        // Dans une zone vivante
        if (window.gameState.inDeadZoneSince) {
            window.gameState.inDeadZoneSince = null;
            window.gameState.penaltyPingSent = false;
        }
    }
}

function handleDeadZone(lat, lng) {
    if (!window.gameState.inDeadZoneSince) {
        window.gameState.inDeadZoneSince = Date.now();
        window.gameState.hpWhenEnteringDeadZone = window.gameState.myHP;
        window.gameState.penaltyPingSent = false;
    }

    const timeInDeadZone = Date.now() - window.gameState.inDeadZoneSince;
    
    // Dégâts : -1 HP / 3 secondes
    const hpLoss = Math.floor(timeInDeadZone / HP_LOSS_INTERVAL);
    window.gameState.myHP = Math.max(0, window.gameState.hpWhenEnteringDeadZone - hpLoss);
    updateHPDisplay();

    // Ping après 1 minute
    if (timeInDeadZone >= DEAD_ZONE_PING_TIME && !window.gameState.penaltyPingSent) {
        sendPenaltyPing(lat, lng);
        window.gameState.penaltyPingSent = true;
        addNotification("Position révélée !", "⚠️");
    }

    // Mort si HP à 0
    if (window.gameState.myHP <= 0 && window.gameState.isAlive) {
        eliminatePlayer();
    }
}

function updateHPDisplay() {
    const hpValue = document.getElementById('hp-value');
    const hpFill = document.getElementById('hp-fill');
    
    hpValue.textContent = window.gameState.myHP;
    hpFill.style.width = window.gameState.myHP + '%';

    hpFill.className = '';
    if (window.gameState.myHP < 30) hpFill.classList.add('critical');
    else if (window.gameState.myHP < 60) hpFill.classList.add('low');

    // Mettre à jour dans Firebase
    dbUpdate(`gameState/${window.gameState.currentGameId}/players/${window.gameState.currentUser.id}`, {
        hp: window.gameState.myHP
    });
}
