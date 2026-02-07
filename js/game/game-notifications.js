// ==========================================
// GAME NOTIFICATIONS
// ==========================================

function addNotification(message, icon = '📌') {
    const notif = {
        message: message,
        icon: icon,
        time: getTimeString(),
        timestamp: Date.now()
    };

    window.gameState.notifications.push(notif);
    window.gameState.unreadCount++;
    
    updateNotificationBadge();
    saveNotificationToFirebase(notif);
}

function updateNotificationBadge() {
    const badge = document.getElementById('notif-badge');
    if (window.gameState.unreadCount > 0) {
        badge.style.display = 'inline-block';
        badge.textContent = window.gameState.unreadCount;
    } else {
        badge.style.display = 'none';
    }
}

function displayNotifications() {
    const panel = document.getElementById('notifications-panel');
    const list = document.getElementById('notifications-list');
    
    panel.style.display = 'block';
    list.innerHTML = "";

    if (window.gameState.notifications.length === 0) {
        list.innerHTML = '<div class="empty-state">Aucune notification</div>';
        return;
    }

    window.gameState.notifications.slice().reverse().forEach(notif => {
        const div = document.createElement('div');
        div.className = 'notif-item';
        div.innerHTML = `
            <div class="notif-icon">${notif.icon}</div>
            <div class="notif-content">
                <div class="notif-time">${notif.time}</div>
                <div class="notif-message">${notif.message}</div>
            </div>
        `;
        list.appendChild(div);
    });

    // Marquer comme lu
    window.gameState.unreadCount = 0;
    updateNotificationBadge();
}

function hideNotifications() {
    document.getElementById('notifications-panel').style.display = 'none';
}

async function saveNotificationToFirebase(notif) {
    await dbPush(`gameState/${window.gameState.currentGameId}/notifications`, notif);
}

function loadNotificationsFromFirebase() {
    dbListen(`gameState/${window.gameState.currentGameId}/notifications`, (snapshot) => {
        if (!snapshot.exists()) return;

        const notifs = snapshot.val();
        const notifsArray = Object.values(notifs);
        
        // Calculer combien de nouvelles notifs
        const newCount = notifsArray.length - window.gameState.lastNotificationCount;
        
        if (newCount > 0) {
            // Ajouter seulement les nouvelles
            const newNotifs = notifsArray.slice(-newCount);
            newNotifs.forEach(notif => {
                // Vérifier qu'elle n'existe pas déjà (double check)
                const exists = window.gameState.notifications.some(n => 
                    n.timestamp === notif.timestamp && n.message === notif.message
                );
                
                if (!exists) {
                    window.gameState.notifications.push(notif);
                    window.gameState.unreadCount++;
                }
            });
            
            updateNotificationBadge();
        }
        
        window.gameState.lastNotificationCount = notifsArray.length;
    });
}

document.getElementById('btn-notifications').addEventListener('click', displayNotifications);
document.getElementById('btn-close-notifs').addEventListener('click', hideNotifications);
