// ==========================================
// GAME TIMER
// ==========================================

function startGameTimer(totalSeconds) {
    const updateTimer = async () => {
        // Vérifier si en pause
        if (window.gameState.isPaused) {
            window.gameState.gameTimer = setTimeout(updateTimer, 100);
            return;
        }

        const elapsed = Math.floor((Date.now() - window.gameState.gameStartTime - window.gameState.pausedDuration) / 1000);
        const remaining = Math.max(0, totalSeconds - elapsed);

        document.getElementById('game-timer').textContent = formatTime(remaining);

        // Phases du jeu
        if (elapsed < 180) {
            // Phase cache (3 minutes)
            window.gameState.currentPhase = 'hiding';
            document.getElementById('game-phase').textContent = window.gameState.myRole === 'cat' ? 'Attente' : 'Cache';
        } else if (elapsed === 180) {
            // Début de la chasse
            window.gameState.currentPhase = 'playing';
            document.getElementById('game-phase').textContent = 'Chasse';
            addNotification("La chasse commence !", "🏃");

            if (window.gameState.myRole === 'cat') {
                // Les chats peuvent supprimer 2 zones au début
                await dbUpdate(`gameState/${window.gameState.currentGameId}`, {
                    zonesToDelete: 2
                });
            }
        }

        // Pings réguliers toutes les 3 minutes (à partir de 6 min)
        if (window.gameState.myRole === 'cat' && elapsed >= 360 && elapsed % 180 === 0) {
            sendRegularPings();
            addNotification("Positions des souris mises à jour", "📍");
        }

        // Zones à supprimer toutes les 3 minutes (après le début)
        if (elapsed > 180 && (elapsed - 180) % 180 === 0) {
            if (window.gameState.myRole === 'cat') {
                const current = await dbGet(`gameState/${window.gameState.currentGameId}/zonesToDelete`) || 0;
                await dbUpdate(`gameState/${window.gameState.currentGameId}`, {
                    zonesToDelete: current + 1
                });
                addNotification("Nouvelle zone à supprimer", "⏰");
            }
        }

        // Vérifier conditions périodiquement
        if (elapsed % 5 === 0) {
            checkPlayerInZones();
            checkCamping();
        }

        if (remaining > 0) {
            window.gameState.gameTimer = setTimeout(updateTimer, 1000);
        } else {
            endGame();
        }
    };

    updateTimer();
}

// Écouter les changements de pause dans Firebase
function listenToPause() {
    window.gameState.pauseListener = dbListen(`gameState/${window.gameState.currentGameId}/isPaused`, (snapshot) => {
        const isPaused = snapshot.val() || false;
        
        if (isPaused && !window.gameState.isPaused) {
            // Passage en pause
            window.gameState.isPaused = true;
            window.gameState.lastPauseTime = Date.now();
            document.getElementById('pause-overlay').style.display = 'flex';
            updatePauseButton();
        } else if (!isPaused && window.gameState.isPaused) {
            // Sortie de pause
            const pauseDuration = Date.now() - window.gameState.lastPauseTime;
            window.gameState.pausedDuration += pauseDuration;
            window.gameState.isPaused = false;
            document.getElementById('pause-overlay').style.display = 'none';
            updatePauseButton();
        }
    });
}

async function togglePause() {
    const currentState = await dbGet(`gameState/${window.gameState.currentGameId}/isPaused`);
    await dbUpdate(`gameState/${window.gameState.currentGameId}`, {
        isPaused: !currentState
    });
}

function updatePauseButton() {
    const btn = document.getElementById('btn-pause');
    if (window.gameState.isPaused) {
        btn.textContent = '▶️';
        btn.title = 'Reprendre';
    } else {
        btn.textContent = '⏸️';
        btn.title = 'Pause';
    }
}
