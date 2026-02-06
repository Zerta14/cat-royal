// ==========================================
// AUTHENTIFICATION
// ==========================================

document.getElementById('btn-login').addEventListener('click', login);
document.getElementById('input-password').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') login();
});
document.getElementById('input-pseudo').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('input-password').focus();
});

async function login() {
    const pseudo = document.getElementById('input-pseudo').value.trim();
    const password = document.getElementById('input-password').value;
    const errorDiv = document.getElementById('login-error');

    if (!pseudo || pseudo.length < 2) {
        errorDiv.textContent = "Pseudo trop court (min 2)";
        return;
    }

    // Récupérer le hash du mot de passe depuis Firebase
    const passwordHash = await dbGet('config/passwordHash');
    
    if (!passwordHash) {
        // Si pas de hash en DB, créer avec "catroyal2026"
        const hash = await hashPassword('catroyal2026');
        await dbSet('config/passwordHash', hash);
    }

    // Vérifier le mot de passe
    const inputHash = await hashPassword(password);
    const correctHash = passwordHash || await hashPassword('catroyal2026');
    
    if (inputHash !== correctHash) {
        errorDiv.textContent = "Mot de passe incorrect";
        return;
    }

    // Vérifier si le pseudo est disponible
    const available = await isPseudoAvailable(pseudo);
    
    if (!available) {
        errorDiv.textContent = "Pseudo déjà en ligne";
        return;
    }

    // Chercher ou créer l'utilisateur
    const users = await dbGet('users');
    let userId = null;
    
    if (users) {
        const existingUser = Object.entries(users).find(([id, user]) => user.pseudo === pseudo);
        if (existingUser) {
            userId = existingUser[0];
        }
    }

    if (!userId) {
        userId = await dbPush('users', {
            pseudo: pseudo,
            createdAt: Date.now()
        });
    }

    // Générer session ID
    const sessionId = generateId();

    // Marquer comme online
    await dbUpdate(`users/${userId}`, {
        isOnline: true,
        sessionId: sessionId,
        lastSeen: Date.now()
    });

    // Sauvegarder la session
    window.gameState.currentUser = { id: userId, pseudo: pseudo };
    Session.save({
        userId: userId,
        pseudo: pseudo,
        sessionId: sessionId,
        currentGameId: null
    });

    errorDiv.textContent = "";
    goToDashboard();
    showDashboard();
}

async function logout() {
    if (!window.gameState.currentUser) return;

    // Vérifier qu'on n'est pas en partie
    if (window.gameState.currentGameId) {
        const game = await dbGet(`games/${window.gameState.currentGameId}`);
        if (game && game.status === 'playing') {
            if (!confirmAction("Vous êtes en partie, vous serez éjecté. Continuer ?")) {
                return;
            }
            // Retirer de la partie
            await leaveGame();
        }
    }

    // Marquer comme offline
    await dbUpdate(`users/${window.gameState.currentUser.id}`, {
        isOnline: false,
        sessionId: null,
        lastSeen: Date.now()
    });

    // Nettoyer
    Session.clear();
    window.gameState.currentUser = null;
    window.gameState.currentGameId = null;
    
    document.getElementById('input-pseudo').value = "";
    document.getElementById('input-password').value = "";
    
    goToLogin();
}

// Event listener pour le bouton déconnexion
document.getElementById('btn-logout').addEventListener('click', logout);

// Gérer la fermeture de la page
window.addEventListener('beforeunload', () => {
    if (window.gameState.currentUser) {
        // Note: ne peut pas être async dans beforeunload
        dbUpdate(`users/${window.gameState.currentUser.id}`, {
            lastSeen: Date.now()
        });
    }
});

// Heartbeat pour maintenir la session
setInterval(async () => {
    if (window.gameState.currentUser) {
        await dbUpdate(`users/${window.gameState.currentUser.id}`, {
            lastSeen: Date.now()
        });
    }
}, 30000); // Toutes les 30 secondes
