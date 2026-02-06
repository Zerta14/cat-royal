// ==========================================
// UTILITIES
// ==========================================

// Formater le temps
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Calculer distance entre 2 points GPS (en mètres)
function getDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000; // Rayon de la Terre en mètres
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Vérifier si point est dans zone (avec buffer)
function isPointInZone(lat, lng, zoneCoords, bufferMeters = 0) {
    try {
        const point = turf.point([lng, lat]);
        let polygon = turf.polygon([zoneCoords.map(c => [c[1], c[0]])]);
        
        if (bufferMeters > 0) {
            polygon = turf.buffer(polygon, bufferMeters / 1000, { units: 'kilometers' });
        }
        
        return turf.booleanPointInPolygon(point, polygon);
    } catch (error) {
        console.error('isPointInZone error:', error);
        return false;
    }
}

// Vérifier si point est dans une zone du jeu
function isInAnyZone(lat, lng, zones, excludeIndices = []) {
    for (let i = 0; i < zones.length; i++) {
        if (excludeIndices.includes(i)) continue;
        if (isPointInZone(lat, lng, zones[i].coords, ZONE_BUFFER_METERS)) {
            return i;
        }
    }
    return -1;
}

// Calculer le timer total
function calculateTotalTime(nbZones) {
    // 3 min cache + (nb_zones × 3)
    return 3 + (nbZones * 3);
}

// Obtenir l'heure formatée
function getTimeString() {
    const now = new Date();
    return now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// Afficher un message d'erreur
function showError(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) {
        el.textContent = message;
        setTimeout(() => el.textContent = '', 3000);
    }
}

// Confirmer une action
function confirmAction(message) {
    return confirm(message);
}

// Générer un ID aléatoire
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Mélanger un tableau
function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// Sélectionner un élément aléatoire
function randomChoice(array) {
    return array[Math.floor(Math.random() * array.length)];
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Session storage
const Session = {
    save(data) {
        localStorage.setItem('catroyal_session', JSON.stringify(data));
    },
    
    load() {
        const data = localStorage.getItem('catroyal_session');
        return data ? JSON.parse(data) : null;
    },
    
    clear() {
        localStorage.removeItem('catroyal_session');
    }
};
