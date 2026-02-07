// ==========================================
// LOBBY
// ==========================================

let manualTeamsState = {
    available: [],
    cats: [],
    mice: []
};

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

// ==================== ÉQUIPES AUTO ====================
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

    // Logique pour éviter équipes de 1 souris
    const miceIds = shuffled.slice(nbCats);
    let i = 0;
    while (i < miceIds.length) {
        const remaining = miceIds.length - i;
        
        if (remaining === 1) {
            // 1 seul restant : ajouter à la dernière équipe existante
            if (teams.mice.length > 0) {
                teams.mice[teams.mice.length - 1].push(miceIds[i]);
            } else {
                // Cas improbable mais on crée une équipe de 1
                teams.mice.push([miceIds[i]]);
            }
            i++;
        } else if (remaining === 3) {
            // 3 restants : faire une équipe de 3
            teams.mice.push([miceIds[i], miceIds[i + 1], miceIds[i + 2]]);
            i += 3;
        } else {
            // Sinon faire équipe de 2
            teams.mice.push([miceIds[i], miceIds[i + 1]]);
            i += 2;
        }
    }

    await dbUpdate(`games/${window.gameState.currentGameId}`, { teams: teams });
}

// ==================== ÉQUIPES MANUELLES ====================
async function showManualTeams() {
    const game = await dbGet(`games/${window.gameState.currentGameId}`);
    const playerIds = Object.keys(game.players);
    
    // Reset state
    manualTeamsState = {
        available: playerIds.map(id => ({ id, pseudo: game.players[id].pseudo })),
        cats: [],
        mice: []
    };

    document.getElementById('teams-preview').style.display = 'none';
    document.getElementById('manual-teams-ui').style.display = 'block';
    
    renderManualTeams();
}

function renderManualTeams() {
    const availableZone = document.getElementById('available-players');
    const catsZone = document.getElementById('cats-zone');
    const miceZone = document.getElementById('mice-zone');

    availableZone.innerHTML = "";
    catsZone.innerHTML = "";
    miceZone.innerHTML = "";

    manualTeamsState.available.forEach(player => {
        availableZone.appendChild(createDraggablePlayer(player));
    });

    manualTeamsState.cats.forEach(player => {
        catsZone.appendChild(createDraggablePlayer(player));
    });

    manualTeamsState.mice.forEach(player => {
        miceZone.appendChild(createDraggablePlayer(player));
    });

    // Setup drop zones
    [availableZone, catsZone, miceZone].forEach(zone => {
        zone.addEventListener('dragover', handleDragOver);
        zone.addEventListener('drop', handleDrop);
        zone.addEventListener('dragleave', handleDragLeave);
    });
}

function createDraggablePlayer(player) {
    const div = document.createElement('div');
    div.className = 'draggable-player';
    div.textContent = player.pseudo;
    div.draggable = true;
    div.dataset.playerId = player.id;
    
    div.addEventListener('dragstart', handleDragStart);
    div.addEventListener('dragend', handleDragEnd);
    
    // Touch events pour mobile
    div.addEventListener('touchstart', handleTouchStart);
    div.addEventListener('touchmove', handleTouchMove);
    div.addEventListener('touchend', handleTouchEnd);
    
    return div;
}

let draggedElement = null;
let touchClone = null;

function handleDragStart(e) {
    draggedElement = e.target;
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.innerHTML);
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
}

function handleDragOver(e) {
    if (e.preventDefault) e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.target.closest('.player-drop-zone')?.classList.add('drag-over');
    return false;
}

function handleDragLeave(e) {
    e.target.closest('.player-drop-zone')?.classList.remove('drag-over');
}

function handleDrop(e) {
    if (e.stopPropagation) e.stopPropagation();
    e.preventDefault();

    const dropZone = e.target.closest('.player-drop-zone');
    if (!dropZone) return;

    dropZone.classList.remove('drag-over');

    const playerId = draggedElement.dataset.playerId;
    const targetTeam = dropZone.id.replace('-zone', '').replace('-players', 'available');
    
    movePlayer(playerId, targetTeam);
    
    return false;
}

// Touch events pour mobile
function handleTouchStart(e) {
    draggedElement = e.target;
    e.target.classList.add('dragging');
    
    const touch = e.touches[0];
    const rect = e.target.getBoundingClientRect();
    
    touchClone = e.target.cloneNode(true);
    touchClone.style.position = 'fixed';
    touchClone.style.left = touch.clientX - rect.width / 2 + 'px';
    touchClone.style.top = touch.clientY - rect.height / 2 + 'px';
    touchClone.style.opacity = '0.8';
    touchClone.style.zIndex = '10000';
    touchClone.style.pointerEvents = 'none';
    document.body.appendChild(touchClone);
}

function handleTouchMove(e) {
    e.preventDefault();
    if (!touchClone) return;
    
    const touch = e.touches[0];
    const rect = draggedElement.getBoundingClientRect();
    
    touchClone.style.left = touch.clientX - rect.width / 2 + 'px';
    touchClone.style.top = touch.clientY - rect.height / 2 + 'px';
}

function handleTouchEnd(e) {
    if (!touchClone) return;
    
    const touch = e.changedTouches[0];
    const dropZone = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.player-drop-zone');
    
    if (dropZone) {
        const playerId = draggedElement.dataset.playerId;
        const targetTeam = dropZone.id.replace('-zone', '').replace('-players', 'available');
        movePlayer(playerId, targetTeam);
    }
    
    draggedElement.classList.remove('dragging');
    document.body.removeChild(touchClone);
    touchClone = null;
    draggedElement = null;
}

function movePlayer(playerId, targetTeam) {
    // Trouver le joueur
    let player = null;
    let sourceTeam = null;

    ['available', 'cats', 'mice'].forEach(team => {
        const index = manualTeamsState[team].findIndex(p => p.id === playerId);
        if (index !== -1) {
            player = manualTeamsState[team][index];
            sourceTeam = team;
            manualTeamsState[team].splice(index, 1);
        }
    });

    if (!player) return;

    // Ajouter à la nouvelle équipe
    manualTeamsState[targetTeam].push(player);
    renderManualTeams();
}

async function confirmManualTeams() {
    const nbCats = manualTeamsState.cats.length;
    const nbMice = manualTeamsState.mice.length;

    if (nbCats < 2) {
        alert("Il faut au moins 2 chats");
        return;
    }

    if (nbMice < 2) {
        alert("Il faut au moins 2 souris");
        return;
    }

    // Former les équipes de souris (par 2 ou 3, jamais 1)
    const miceTeams = [];
    let i = 0;
    while (i < manualTeamsState.mice.length) {
        const remaining = manualTeamsState.mice.length - i;
        
        if (remaining === 1) {
            // Ajouter à la dernière équipe
            if (miceTeams.length > 0) {
                miceTeams[miceTeams.length - 1].push(manualTeamsState.mice[i].id);
            } else {
                miceTeams.push([manualTeamsState.mice[i].id]);
            }
            i++;
        } else if (remaining === 3) {
            miceTeams.push([
                manualTeamsState.mice[i].id,
                manualTeamsState.mice[i + 1].id,
                manualTeamsState.mice[i + 2].id
            ]);
            i += 3;
        } else {
            miceTeams.push([
                manualTeamsState.mice[i].id,
                manualTeamsState.mice[i + 1].id
            ]);
            i += 2;
        }
    }

    const teams = {
        cats: manualTeamsState.cats.map(p => p.id),
        mice: miceTeams
    };

    await dbUpdate(`games/${window.gameState.currentGameId}`, { teams: teams });
    
    document.getElementById('manual-teams-ui').style.display = 'none';
    document.getElementById('teams-preview').style.display = 'block';
}

function displayTeamsPreview(teams, players) {
    const preview = document.getElementById('teams-preview');
    preview.innerHTML = "";
    preview.style.display = 'block';

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

// ==================== MODIFIERS ====================
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
    
    // Décocher tous
    const checkboxes = document.querySelectorAll('#modifiers-list input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = false;
        cb.closest('.modifier-item').classList.remove('selected');
    });
    
    // Cocher le random
    const checkbox = document.getElementById(`mod-${randomKey}`);
    if (checkbox) {
        checkbox.checked = true;
        checkbox.closest('.modifier-item').classList.add('selected');
    }
    
    await dbUpdate(`games/${window.gameState.currentGameId}`, { modifiers: { [randomKey]: true } });
}

function displayModifiersPreview(modifiers) {
    if (!modifiers || Object.keys(modifiers).length === 0) return;
    
    // Cocher les modifiers déjà sélectionnés
    Object.keys(modifiers).forEach(key => {
        const checkbox = document.getElementById(`mod-${key}`);
        if (checkbox && modifiers[key]) {
            checkbox.checked = true;
            checkbox.closest('.modifier-item').classList.add('selected');
        }
    });
}

// ==================== LANCEMENT ====================
async function startGameLobby() {
    if (!window.gameState.isHost) return;

    const game = await dbGet(`games/${window.gameState.currentGameId}`);
    if (!game.mapId || !game.teams) {
        alert("Sélectionnez une map et créez les équipes");
        return;
    }

    const map = await dbGet(`maps/${game.mapId}`);
    let finalZoneIndex = Math.floor(Math.random() * map.zones.length);

    // Si modifier "final_zone_choice", les chats choisiront pendant la phase cache
    if (game.modifiers && game.modifiers.final_zone_choice) {
        finalZoneIndex = -1;
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
        zonesToDelete: 0,
        isPaused: false
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

// ==================== EVENT LISTENERS ====================
document.getElementById('lobby-map-select').addEventListener('change', async (e) => {
    if (window.gameState.isHost) {
        await dbUpdate(`games/${window.gameState.currentGameId}`, { mapId: e.target.value });
    }
});

document.getElementById('btn-auto-teams').addEventListener('click', autoAssignTeams);
document.getElementById('btn-manual-teams').addEventListener('click', () => {
    showManualTeams();
});
document.getElementById('btn-confirm-manual-teams').addEventListener('click', confirmManualTeams);

document.getElementById('btn-random-modifier').addEventListener('click', () => {
    initModifiers();
    randomModifier();
});
document.getElementById('btn-manual-modifiers').addEventListener('click', initModifiers);

document.getElementById('btn-start-game').addEventListener('click', startGameLobby);
document.getElementById('btn-leave-lobby').addEventListener('click', leaveLobby);
