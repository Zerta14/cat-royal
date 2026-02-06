// ==========================================
// NAVIGATION
// ==========================================

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    document.getElementById(pageId).style.display = 'block';
}

function goToLogin() {
    showPage('page-login');
}

function goToDashboard() {
    showPage('page-dashboard');
}

function goToLobby() {
    showPage('page-lobby');
}

function goToEditor() {
    showPage('page-editor');
}

function goToGame() {
    showPage('page-game');
}

// ==========================================
// INITIALISATION
// ==========================================

window.addEventListener('DOMContentLoaded', () => {
    // Vérifier session existante
    const session = Session.load();
    
    if (session && session.pseudo && session.userId) {
        // Tenter de restaurer la session
        tryRestoreSession(session);
    } else {
        showPage('page-login');
    }
});

async function tryRestoreSession(session) {
    try {
        // Vérifier que l'utilisateur existe
        const user = await dbGet(`users/${session.userId}`);
        
        if (!user || user.pseudo !== session.pseudo) {
            Session.clear();
            showPage('page-login');
            return;
        }
        
        // Vérifier qu'il n'est pas déjà connecté ailleurs
        if (user.isOnline && user.sessionId !== session.sessionId) {
            Session.clear();
            showError('login-error', 'Session déjà active ailleurs');
            showPage('page-login');
            return;
        }
        
        // Restaurer la session
        window.gameState.currentUser = {
            id: session.userId,
            pseudo: session.pseudo
        };
        
        // Marquer comme online
        await dbUpdate(`users/${session.userId}`, {
            isOnline: true,
            sessionId: session.sessionId,
            lastSeen: Date.now()
        });
        
        // Si en partie, restaurer la partie
        if (session.currentGameId) {
            const game = await dbGet(`games/${session.currentGameId}`);
            
            if (game && game.status === 'playing') {
                window.gameState.currentGameId = session.currentGameId;
                window.gameState.isHost = (game.creatorId === session.userId);
                goToGame();
                await startGamePhase();
                return;
            }
        }
        
        // Sinon aller au dashboard
        goToDashboard();
        showDashboard();
        
    } catch (error) {
        console.error('Session restore error:', error);
        Session.clear();
        showPage('page-login');
    }
}
