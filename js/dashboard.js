// ==========================================
// DASHBOARD
// ==========================================

function showDashboard() {
    document.getElementById('user-pseudo').textContent = window.gameState.currentUser.pseudo;
    loadGames();
    loadMaps();
}

function loadGames() {
    dbListen('games', (snapshot) => {
        const gamesList = document.getElementById('games-list');
        gamesList.innerHTML = "";

        if (!snapshot.exists()) {
            gamesList.innerHTML = '<div class="empty-state">Aucune partie</div>';
            return;
        }

        const games = snapshot.val();
        const waitingGames = Object.entries(games).filter(([id, game]) => game.status === 'waiting');

        if (waitingGames.length === 0) {
            gamesList.innerHTML = '<div class="empty-state">Aucune partie</div>';
            return;
        }

        waitingGames.forEach(([gameId, game]) => {
            const playerCount = game.players ? Object.keys(game.players).length : 0;
            const div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = `
                <div class="list-item-info">
                    <h4>Partie de ${game.creatorPseudo}</h4>
                    <p>${playerCount} joueur(s)</p>
                </div>
                <button class="btn-secondary" onclick="joinGame('${gameId}')">Rejoindre</button>
            `;
            gamesList.appendChild(div);
        });
    });
}

function loadMaps() {
    dbListen('maps', (snapshot) => {
        const mapsList = document.getElementById('maps-list');
        mapsList.innerHTML = "";

        if (!snapshot.exists()) {
            mapsList.innerHTML = '<div class="empty-state">Aucune map</div>';
            return;
        }

        const maps = snapshot.val();
        Object.entries(maps).forEach(([mapId, map]) => {
            const div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = `
                <div class="list-item-info">
                    <h4>${map.name}</h4>
                    <p>${map.zones ? map.zones.length : 0} zones - ${map.creatorPseudo}</p>
                </div>
                <button class="btn-secondary" onclick="editMap('${mapId}')">Modifier</button>
            `;
            mapsList.appendChild(div);
        });
    });
}

async function createGame() {
    const gameId = await dbPush('games', {
        creatorId: window.gameState.currentUser.id,
        creatorPseudo: window.gameState.currentUser.pseudo,
        status: 'waiting',
        mapId: null,
        players: {
            [window.gameState.currentUser.id]: {
                pseudo: window.gameState.currentUser.pseudo,
                role: null,
                team: null
            }
        },
        teams: null,
        modifiers: {},
        createdAt: Date.now()
    });

    window.gameState.currentGameId = gameId;
    window.gameState.isHost = true;
    
    // Sauvegarder dans session
    const session = Session.load();
    session.currentGameId = gameId;
    Session.save(session);
    
    goToLobby();
    showLobby();
}

async function joinGame(gameId) {
    window.gameState.currentGameId = gameId;
    window.gameState.isHost = false;

    await dbUpdate(`games/${gameId}/players/${window.gameState.currentUser.id}`, {
        pseudo: window.gameState.currentUser.pseudo,
        role: null,
        team: null
    });

    const session = Session.load();
    session.currentGameId = gameId;
    Session.save(session);

    goToLobby();
    showLobby();
}

async function editMap(mapId) {
    window.gameState.editingMapId = mapId;
    goToEditor();
    await loadMapForEditing(mapId);
}

document.getElementById('btn-create-game').addEventListener('click', createGame);
document.getElementById('btn-create-map').addEventListener('click', () => {
    window.gameState.editingMapId = null;
    goToEditor();
    initEditor();
});
