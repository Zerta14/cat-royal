// ==========================================
// FIREBASE HELPERS
// ==========================================

async function dbGet(path) {
    try {
        const snapshot = await db.ref(path).once('value');
        return snapshot.val();
    } catch (error) {
        console.error('Firebase get error:', error);
        return null;
    }
}

async function dbSet(path, data) {
    try {
        await db.ref(path).set(data);
        return true;
    } catch (error) {
        console.error('Firebase set error:', error);
        return false;
    }
}

async function dbUpdate(path, data) {
    try {
        await db.ref(path).update(data);
        return true;
    } catch (error) {
        console.error('Firebase update error:', error);
        return false;
    }
}

async function dbPush(path, data) {
    try {
        const ref = db.ref(path).push();
        await ref.set(data);
        return ref.key;
    } catch (error) {
        console.error('Firebase push error:', error);
        return null;
    }
}

async function dbRemove(path) {
    try {
        await db.ref(path).remove();
        return true;
    } catch (error) {
        console.error('Firebase remove error:', error);
        return false;
    }
}

function dbListen(path, callback) {
    const ref = db.ref(path);
    ref.on('value', callback);
    return ref;
}

function dbUnlisten(ref, callback) {
    if (ref && callback) {
        ref.off('value', callback);
    }
}

// Hash SHA-256
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Vérifier si pseudo disponible
async function isPseudoAvailable(pseudo) {
    const users = await dbGet('users');
    if (!users) return true;
    
    return !Object.values(users).some(user => 
        user.pseudo === pseudo && user.isOnline
    );
}

// Vérifier si map est utilisée
async function isMapInUse(mapId) {
    const games = await dbGet('games');
    if (!games) return false;
    
    return Object.values(games).some(game => 
        game.mapId === mapId && game.status === 'playing'
    );
}
