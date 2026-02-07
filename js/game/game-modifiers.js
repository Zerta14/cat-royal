// ==========================================
// GAME MODIFIERS
// ==========================================

function setupModifiers() {
    const role = window.gameState.myRole;

    if (role === 'cat') {
        setupCatModifiers();
    } else {
        setupMouseModifiers();
    }
}

function setupCatModifiers() {
    const container = document.getElementById('cat-modifiers');
    container.innerHTML = "";

    if (window.gameState.activeModifiers.ping_total) {
        const btn = document.createElement('button');
        btn.className = 'btn-primary btn-small';
        btn.textContent = '📍 Ping Total';
        btn.style.marginTop = '8px';
        btn.style.width = '100%';
        btn.addEventListener('click', usePingTotal);
        container.appendChild(btn);
    }

    if (window.gameState.activeModifiers.force_zone_change) {
        const btn = document.createElement('button');
        btn.className = 'btn-primary btn-small';
        btn.textContent = '🔄 Forcer Changement';
        btn.style.marginTop = '8px';
        btn.style.width = '100%';
        btn.addEventListener('click', useForceZoneChange);
        container.appendChild(btn);
    }
}

function setupMouseModifiers() {
    const container = document.getElementById('mouse-modifiers');
    container.innerHTML = "";

    if (window.gameState.activeModifiers.reveal_cats) {
        const btn = document.createElement('button');
        btn.className = 'btn-primary btn-small';
        btn.textContent = '👀 Révéler Chats';
        btn.style.marginTop = '8px';
        btn.style.width = '100%';
        btn.addEventListener('click', useRevealCats);
        container.appendChild(btn);
    }
}

async function usePingTotal() {
    const used = await dbGet(`gameState/${window.gameState.currentGameId}/modifierStates/ping_total_used`);
    if (used) {
        alert("Déjà utilisé");
        return;
    }

    await dbUpdate(`gameState/${window.gameState.currentGameId}/modifierStates`, {
        ping_total_used: true
    });

    const players = await dbGet(`gameState/${window.gameState.currentGameId}/players`);
    const game = await dbGet(`games/${window.gameState.currentGameId}`);

    Object.entries(players).forEach(([playerId, player]) => {
        if (game.players[playerId].role === 'mouse' && player.alive) {
            sendPing(playerId, player.lat, player.lng, 'ping_total', 'cats');
        }
    });

    addNotification("Ping Total activé !", "⚡");
    
    // Supprimer le bouton pour tous les chats
    const btns = document.querySelectorAll('#cat-modifiers button');
    btns.forEach(btn => {
        if (btn.textContent.includes('Ping Total')) {
            btn.remove();
        }
    });
}

async function useForceZoneChange() {
    const used = await dbGet(`gameState/${window.gameState.currentGameId}/modifierStates/force_zone_change_used`);
    if (used) {
        alert("Déjà utilisé");
        return;
    }

    await dbUpdate(`gameState/${window.gameState.currentGameId}/modifierStates`, {
        force_zone_change_used: true,
        force_zone_change_active: true,
        force_zone_change_start: Date.now()
    });

    addNotification("Changement forcé activé !", "🔄");
    
    const btns = document.querySelectorAll('#cat-modifiers button');
    btns.forEach(btn => {
        if (btn.textContent.includes('Forcer')) {
            btn.remove();
        }
    });
}

async function useRevealCats() {
    const teamKey = window.gameState.myTeam;
    const used = await dbGet(`gameState/${window.gameState.currentGameId}/modifierStates/reveal_cats_${teamKey}`);
    if (used) {
        alert("Déjà utilisé par votre équipe");
        return;
    }

    await dbUpdate(`gameState/${window.gameState.currentGameId}/modifierStates`, {
        [`reveal_cats_${teamKey}`]: true
    });

    const players = await dbGet(`gameState/${window.gameState.currentGameId}/players`);
    const game = await dbGet(`games/${window.gameState.currentGameId}`);

    Object.entries(players).forEach(([playerId, player]) => {
        if (game.players[playerId].role === 'cat') {
            const marker = L.circleMarker([player.lat, player.lng], {
                radius: 12,
                color: '#ff4444',
                fillColor: '#ff4444',
                fillOpacity: 0.6
            }).addTo(window.gameState.mapGame);

            marker.bindPopup(`<b>${game.players[playerId].pseudo}</b><br>Chat`);
            
            setTimeout(() => {
                window.gameState.mapGame.removeLayer(marker);
            }, 3000);
        }
    });

    addNotification("Position des chats révélée !", "👀");
    
    const btns = document.querySelectorAll('#mouse-modifiers button');
    btns.forEach(btn => {
        if (btn.textContent.includes('Révéler')) {
            btn.remove();
        }
    });
}

function checkForceZoneChange() {
    dbListen(`gameState/${window.gameState.currentGameId}/modifierStates`, (snapshot) => {
        const states = snapshot.val();
        if (!states || !states.force_zone_change_active) {
            hideMission();
            return;
        }

        if (window.gameState.myRole === 'mouse') {
            const timeLimit = 3 * 60 * 1000; // 3 minutes
            const elapsed = Date.now() - states.force_zone_change_start;
            const remaining = Math.max(0, timeLimit - elapsed);

            if (remaining > 0) {
                showMission(`Changez de zone ! ${formatTime(Math.floor(remaining / 1000))}`);
                
                if (!window.gameState.lastZoneIndex) {
                    window.gameState.lastZoneIndex = isInAnyZone(
                        window.gameState.myPosition[0],
                        window.gameState.myPosition[1],
                        window.gameState.gameZones,
                        window.gameState.deletedZones
                    );
                }

                const currentZone = isInAnyZone(
                    window.gameState.myPosition[0],
                    window.gameState.myPosition[1],
                    window.gameState.gameZones,
                    window.gameState.deletedZones
                );

                if (currentZone !== window.gameState.lastZoneIndex) {
                    hideMission();
                    dbUpdate(`gameState/${window.gameState.currentGameId}/modifierStates`, {
                        force_zone_change_active: false
                    });
                }
            } else {
                // Temps écoulé : ping
                sendForceZonePing(
                    window.gameState.currentUser.id,
                    window.gameState.myPosition[0],
                    window.gameState.myPosition[1]
                );
                hideMission();
                dbUpdate(`gameState/${window.gameState.currentGameId}/modifierStates`, {
                    force_zone_change_active: false
                });
            }
        }
    });
}

function checkCamping() {
    if (!window.gameState.activeModifiers.no_camping) return;
    if (window.gameState.myRole !== 'mouse' || !window.gameState.isAlive) return;

    if (!window.gameState.lastPosition) {
        window.gameState.lastPosition = window.gameState.myPosition;
        window.gameState.lastMovementTime = Date.now();
        return;
    }

    const distance = getDistance(
        window.gameState.lastPosition[0],
        window.gameState.lastPosition[1],
        window.gameState.myPosition[0],
        window.gameState.myPosition[1]
    );

    if (distance > CAMPING_RADIUS) {
        window.gameState.lastPosition = window.gameState.myPosition;
        window.gameState.lastMovementTime = Date.now();
        window.gameState.campingWarningShown = false;
        hideMission();
    } else {
        const elapsed = Date.now() - window.gameState.lastMovementTime;
        if (elapsed >= CAMPING_TIME) {
            if (!window.gameState.campingWarningShown) {
                sendCampingPing(
                    window.gameState.currentUser.id,
                    window.gameState.myPosition[0],
                    window.gameState.myPosition[1]
                );
                addNotification("Camping détecté !", "🚫");
                window.gameState.campingWarningShown = true;
            }
        } else if (elapsed > CAMPING_TIME / 2) {
            const remaining = Math.floor((CAMPING_TIME - elapsed) / 1000);
            showMission(`Bougez ! ${remaining}s`);
        }
    }
}

function showMission(text) {
    const missionBox = document.getElementById('mission-display');
    missionBox.textContent = text;
    missionBox.style.display = 'block';
    document.getElementById('modifier-border').style.display = 'block';
}

function hideMission() {
    document.getElementById('mission-display').style.display = 'none';
    document.getElementById('modifier-border').style.display = 'none';
}
