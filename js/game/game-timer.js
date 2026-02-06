// ==========================================
// GAME TIMER
// ==========================================

function startGameTimer(totalSeconds) {
    const updateTimer = async () => {
        const elapsed = Math.floor((Date.now() - window.gameState.gameStartTime) / 1000);
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
                dbUpdate(`gameState/${window.gameState.currentGameId}`, {
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
