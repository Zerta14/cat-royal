// ==========================================
// GAME PINGS
// ==========================================

async function sendPenaltyPing(lat, lng) {
    await dbUpdate(`gameState/${window.gameState.currentGameId}/pings/${window.gameState.currentUser.id}`, {
        lat: lat,
        lng: lng,
        pseudo: window.gameState.currentUser.pseudo,
        type: 'penalty',
        timestamp: Date.now()
    });
}

async function sendRegularPings() {
    const players = await dbGet(`gameState/${window.gameState.currentGameId}/players`);
    const game = await dbGet(`games/${window.gameState.currentGameId}`);
    
    if (!players || !game) return;

    Object.entries(players).forEach(([playerId, player]) => {
        if (game.players[playerId].role === 'mouse' && player.alive) {
            dbUpdate(`gameState/${window.gameState.currentGameId}/pings/${playerId}`, {
                lat: player.lat,
                lng: player.lng,
                pseudo: game.players[playerId].pseudo,
                type: 'regular',
                timestamp: Date.now()
            });
        }
    });
}

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
            // Ne pas afficher les pings de plus de 3 minutes (sauf penalty qui reste visible)
            if (ping.type !== 'penalty' && now - ping.timestamp > 180000) return;

            const color = ping.type === 'penalty' ? '#ff0000' : '#ffaa00';
            const marker = L.circleMarker([ping.lat, ping.lng], {
                radius: 10,
                color: color,
                fillColor: color,
                fillOpacity: 0.6
            }).addTo(window.gameState.mapGame);

            marker.bindPopup(`<b>${ping.pseudo}</b><br>${ping.type === 'penalty' ? 'Pénalité' : 'Position'}`);
            window.gameState.pingMarkers.push(marker);
        });
    });
}

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
