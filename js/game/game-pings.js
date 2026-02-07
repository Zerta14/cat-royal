// ==========================================
// GAME PINGS - FONCTION MÈRE
// ==========================================

/**
 * Fonction mère pour tous les pings
 * @param {string} playerId - ID du joueur à ping
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {string} type - Type de ping: 'regular', 'penalty', 'camping', 'force_zone', 'ping_total'
 * @param {string|array} visibleBy - Qui voit le ping: 'cats', 'all', ou ['mice_0', 'mice_1']
 */
async function sendPing(playerId, lat, lng, type, visibleBy = 'cats') {
    const game = await dbGet(`games/${window.gameState.currentGameId}`);
    if (!game) return;

    const ping = {
        lat: lat,
        lng: lng,
        pseudo: game.players[playerId].pseudo,
        type: type,
        visibleBy: visibleBy,
        timestamp: Date.now()
    };

    await dbUpdate(`gameState/${window.gameState.currentGameId}/pings/${playerId}`, ping);
}

// Wrapper pour pings réguliers (toutes les 3 min)
async function sendRegularPings() {
    const players = await dbGet(`gameState/${window.gameState.currentGameId}/players`);
    const game = await dbGet(`games/${window.gameState.currentGameId}`);
    
    if (!players || !game) return;

    Object.entries(players).forEach(([playerId, player]) => {
        if (game.players[playerId].role === 'mouse' && player.alive) {
            sendPing(playerId, player.lat, player.lng, 'regular', 'cats');
        }
    });
}

// Wrapper pour pings de pénalité
async function sendPenaltyPing(playerId, lat, lng) {
    await sendPing(playerId, lat, lng, 'penalty', 'cats');
}

// Wrapper pour camping
async function sendCampingPing(playerId, lat, lng) {
    await sendPing(playerId, lat, lng, 'camping', 'cats');
}

// Wrapper pour force zone change
async function sendForceZonePing(playerId, lat, lng) {
    await sendPing(playerId, lat, lng, 'force_zone', 'cats');
}

// Afficher les pings pour les chats
function displayPings() {
    if (window.gameState.myRole !== 'cat') return;

    dbListen(`gameState/${window.gameState.currentGameId}/pings`, (snapshot) => {
        // Nettoyer les anciens pings
        window.gameState.pingMarkers.forEach(m => window.gameState.mapGame.removeLayer(m));
        window.gameState.pingMarkers = [];

        if (!snapshot.exists()) return;

        const pings = snapshot.val();
        const now = Date.now();

        Object.entries(pings).forEach(([playerId, ping]) => {
            // Vérifier visibilité
            if (Array.isArray(ping.visibleBy)) {
                if (!ping.visibleBy.includes(window.gameState.myTeam)) return;
            } else if (ping.visibleBy !== 'cats' && ping.visibleBy !== 'all') {
                return;
            }

            // Ne pas afficher les pings réguliers de plus de 3 minutes (sauf penalty/camping)
            if (['regular'].includes(ping.type) && now - ping.timestamp > 180000) return;

            const colors = {
                regular: '#ffaa00',
                penalty: '#ff0000',
                camping: '#ff0000',
                force_zone: '#ff4444',
                ping_total: '#ff00ff'
            };
            
            const color = colors[ping.type] || '#ffaa00';
            
            const marker = L.circleMarker([ping.lat, ping.lng], {
                radius: 10,
                color: color,
                fillColor: color,
                fillOpacity: 0.6
            }).addTo(window.gameState.mapGame);

            const labels = {
                regular: 'Position',
                penalty: 'Pénalité',
                camping: 'Camping',
                force_zone: 'Zone forcée',
                ping_total: 'Ping total'
            };

            marker.bindPopup(`<b>${ping.pseudo}</b><br>${labels[ping.type] || 'Ping'}`);
            window.gameState.pingMarkers.push(marker);
        });
    });
}

// Afficher coéquipier pour souris
function displayTeammate() {
    if (window.gameState.myRole !== 'mouse') return;

    dbListen(`gameState/${window.gameState.currentGameId}/players`, async (snapshot) => {
        if (!snapshot.exists()) return;

        const players = snapshot.val();
        const game = await dbGet(`games/${window.gameState.currentGameId}`);

        const teammateId = Object.keys(game.players).find(id => 
            id !== window.gameState.currentUser.id && 
            game.players[id].team === window.gameState.myTeam
        );

        if (teammateId && players[teammateId]) {
            const pos = players[teammateId];
            
            if (!window.gameState.teammateMarker) {
                window.gameState.teammateMarker = L.circleMarker([pos.lat, pos.lng], {
                    radius: 6,
                    color: '#00ffff',
                    fillColor: '#00ffff',
                    fillOpacity: 0.7
                }).addTo(window.gameState.mapGame);
                
                window.gameState.teammateMarker.bindPopup(`<b>${game.players[teammateId].pseudo}</b><br>Coéquipier`);
            } else {
                window.gameState.teammateMarker.setLatLng([pos.lat, pos.lng]);
            }
        }
    });
}
