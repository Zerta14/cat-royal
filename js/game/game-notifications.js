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
        const newNotifs = Object.values(notifs).filter(n => 
            !window.gameState.notifications.some(existing => 
                existing.timestamp === n.timestamp && existing.message === n.message
            )
        );

        newNotifs.forEach(notif => {
            window.gameState.notifications.push(notif);
            window.gameState.unreadCount++;
        });

        updateNotificationBadge();
    });
}

document.getElementById('btn-notifications').addEventListener('click', displayNotifications);
document.getElementById('btn-close-notifs').addEventListener('click', hideNotifications);
