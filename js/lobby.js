// ==========================================
// LOBBY
// ==========================================

function showLobby() {
    loadLobbyMaps();
    
    window.gameState.gameListener = dbListen(`games/${window.gameState.currentGameId}`, (snapshot) => {
        const game = snapshot.val();
        if (!game) {
            alert("La partie n'existe plus");
            goToDashboard();
            showDashboard();
            return;
        }

        if (game.status === 'playing') {
            dbUnlisten(window.gameState.gameListener);
            goToGame();
            startGamePhase();
            return;
        }

        updateLobbyPlayers(game.players);
        updateLobbyMap(game.mapId);
        
        if (window.gameState.isHost) {
            document.getElementById('lobby-teams-section').style.display = 'block';
            document.getElementById('lobby-modifiers-section').style.display = 'block';
            
            if (game.teams) displayTeamsPreview(game.teams, game.players);
            if (game.modifiers) displayModifiersPreview(game.modifiers);
            
            const canStart = game.mapId && game.teams;
            document.getElementById('btn-start-game').style.display = canStart ? 'block' : 'none';
        }
    });
}

function loadLobbyMaps() {
    const select = document.getElementById('lobby-map-select');
    select.innerHTML = '<option value="">-- Choisir --</option>';

    dbGet('maps').then(maps => {
        if (maps) {
            Object.entries(maps).forEach(([mapId, map]) => {
                const option = document.createElement('option');
                option.value = mapId;
                option.textContent = `${map.name} (${map.zones ? map.zones.length : 0} zones)`;
                select.appendChild(option);
            });
        }
    });
}

async function updateLobbyMap(mapId) {
    const info = document.getElementById('lobby-map-info');
    if (mapId) {
        const map = await dbGet(`maps/${mapId}`);
        if (map) {
            info.textContent = `✅ ${map.name} (${map.zones.length} zones)`;
        }
    } else {
        info.textContent = "";
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
        if (playerId === window.gameState.currentUser.id) {
            div.classList.add('is-host');
        }
        div.textContent = player.pseudo;
        list.appendChild(div);
    });
}

async function autoAssignTeams() {
    if (!window.gameState.isHost) return;

    const game = await dbGet(`games/${window.gameState.currentGameId}`);
    const playerIds = Object.keys(game.players);
    const totalPlayers = playerIds.length;

    const nbCats = Math.max(2, Math.floor(totalPlayers / 4));
    const nbMice = totalPlayers - nbCats;

    const shuffled = shuffle(playerIds);
    const teams = {
        cats: shuffled.slice(0, nbCats),
        mice: []
    };

    const miceIds = shuffled.slice(nbCats);
    for (let i = 0; i < miceIds.length; i += 2) {
        if (i + 1 < miceIds.length) {
            teams.mice.push([miceIds[i], miceIds[i + 1]]);
        } else {
            teams.mice.push([miceIds[i]]);
        }
    }

    await dbUpdate(`games/${window.gameState.currentGameId}`, { teams: teams });
}

function displayTeamsPreview(teams, players) {
    const preview = document.getElementById('teams-preview');
    preview.innerHTML = "";

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

function initModifiers() {
    const list = document.getElementById('modifiers-list');
    list.innerHTML = "";

    Object.entries(MODIFIERS).forEach(([key, modifier]) => {
        const div = document.createElement('div');
        div.className = 'modifier-item';
        div.innerHTML = `
            <input type="checkbox" id="mod-${key}" value="${key}">
            <label for="mod-${key}">${modifier.icon} ${modifier.name}</label>
        `;
        div.querySelector('input').addEventListener('change', (e) => {
            div.classList.toggle('selected', e.target.checked);
            updateSelectedModifiers();
        });
        list.appendChild(div);
    });
}

async function updateSelectedModifiers() {
    const checkboxes = document.querySelectorAll('#modifiers-list input[type="checkbox"]');
    const selected = {};
    checkboxes.forEach(cb => {
        if (cb.checked) selected[cb.value] = true;
    });
    await dbUpdate(`games/${window.gameState.currentGameId}`, { modifiers: selected });
}

async function randomModifier() {
    const keys = Object.keys(MODIFIERS);
    const randomKey = randomChoice(keys);
    await dbUpdate(`games/${window.gameState.currentGameId}`, { modifiers: { [randomKey]: true } });
}

function displayModifiersPreview(modifiers) {
    if (Object.keys(modifiers).length === 0) return;
    // Les modifiers cochés sont déjà affichés via initModifiers
}

async function startGameLobby() {
    if (!window.gameState.isHost) return;

    const game = await dbGet(`games/${window.gameState.currentGameId}`);
    if (!game.mapId || !game.teams) {
        alert("Sélectionnez une map et créez les équipes");
        return;
    }

    const map = await dbGet(`maps/${game.mapId}`);
    let finalZoneIndex = Math.floor(Math.random() * map.zones.length);

    // Si modifier "final_zone_choice", ne pas choisir maintenant
    if (game.modifiers && game.modifiers.final_zone_choice) {
        finalZoneIndex = -1; // Les chats choisiront
    }

    const totalTime = calculateTotalTime(map.zones.length);

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
    updates['totalTime'] = totalTime * 60;
    updates['finalZoneIndex'] = finalZoneIndex;
    updates['currentPhase'] = 'hiding';

    await dbUpdate(`games/${window.gameState.currentGameId}`, updates);

    await dbSet(`gameState/${window.gameState.currentGameId}`, {
        deletedZones: [],
        pings: {},
        players: {},
        modifierStates: {},
        zonesToDelete: 0
    });
}

async function leaveLobby() {
    await dbRemove(`games/${window.gameState.currentGameId}/players/${window.gameState.currentUser.id}`);

    const players = await dbGet(`games/${window.gameState.currentGameId}/players`);
    if (!players || Object.keys(players).length === 0) {
        await dbRemove(`games/${window.gameState.currentGameId}`);
    }

    dbUnlisten(window.gameState.gameListener);
    window.gameState.currentGameId = null;
    window.gameState.isHost = false;
    
    const session = Session.load();
    session.currentGameId = null;
    Session.save(session);

    goToDashboard();
}

// Event listeners
document.getElementById('lobby-map-select').addEventListener('change', async (e) => {
    if (window.gameState.isHost) {
        await dbUpdate(`games/${window.gameState.currentGameId}`, { mapId: e.target.value });
    }
});

document.getElementById('btn-auto-teams').addEventListener('click', autoAssignTeams);
document.getElementById('btn-manual-teams').addEventListener('click', () => {
    alert("Équipes manuelles : À implémenter");
});

document.getElementById('btn-random-modifier').addEventListener('click', randomModifier);
document.getElementById('btn-manual-modifiers').addEventListener('click', initModifiers);

document.getElementById('btn-start-game').addEventListener('click', startGameLobby);
document.getElementById('btn-leave-lobby').addEventListener('click', leaveLobby);
