// --- CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyBB1Ly4gEo0jZakLo1ZWtaKz9-HriOy-CM",
    authDomain: "cat-royal.firebaseapp.com",
    projectId: "cat-royal",
    storageBucket: "cat-royal.firebasestorage.app",
    messagingSenderId: "526911138487",
    appId: "1:526911138487:web:6e3db2db2a561df0007b32",
    databaseURL: "https://cat-royal-default-rtdb.europe-west1.firebasedatabase.app/" 
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const playerId = "Player_" + Math.floor(Math.random() * 999);

// --- THEMES MAP ---
// "Labels: false" ou "All: false" dans les options CartoDB ne suffisent pas, 
// on utilise des tuiles "No Labels" pour garder la map ultra propre.
const themes = {
    dark: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
    light: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png'
};
let currentTheme = 'dark';

const map = L.map('map', { center: [48.8475, 2.4390], zoom: 17, zoomControl: false });
const layerGroup = L.tileLayer(themes[currentTheme]).addTo(map);

// --- VARIABLES ET ÉTATS ---
let isEditorMode = false;
let autoCenter = true;
let currentDraftPoints = [];
let tempLines = L.polyline([], {color: '#00ffff', weight: 3}).addTo(map);
let zoneLayers = {}; 
let ghostCursor = L.circleMarker([0,0], {radius: 6, color: '#ff00ff', fillOpacity: 1, interactive: false}).addTo(map);
let myMarker = L.circleMarker([0,0], {radius: 8, color: 'white', fillColor: '#007bff', fillOpacity: 1}).addTo(map);

const SNAP_SEGMENT = 15; 
const SNAP_ANGLE = 8;

// --- FONCTIONS SYSTÈME ---
function toggleTheme() {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    layerGroup.setUrl(themes[currentTheme]);
    document.getElementById('btn-theme').innerText = currentTheme === 'dark' ? "Mode Sombre" : "Mode Clair";
}

function toggleMode() {
    isEditorMode = !isEditorMode;
    document.getElementById('btn-toggle').classList.toggle('active', isEditorMode);
    document.getElementById('btn-save').style.display = isEditorMode ? "block" : "none";
    document.getElementById('btn-clear').style.display = isEditorMode ? "block" : "none";
    document.getElementById('controls-hint').innerText = isEditorMode ? "E: Quitter | Entrée: Créer | Ctrl+Z: Annuler" : "Mode JEU";
    if (!isEditorMode) clearDraft();
}

function enableAutoCenter() {
    autoCenter = true;
    document.getElementById('btn-center').classList.add('active');
}

// Désactiver le centrage auto si l'utilisateur bouge la carte manuellement
map.on('movestart', (e) => {
    if (e.hard) return; // Ignore si c'est un mouvement provoqué par le code
    autoCenter = false;
    document.getElementById('btn-center').classList.remove('active');
});

// --- ÉDITEUR MAGNÉTIQUE ---
map.on('mousemove', (e) => {
    if (!isEditorMode) { ghostCursor.setStyle({opacity: 0}); return; }
    
    let mouseCoords = e.latlng;
    let point = turf.point([mouseCoords.lng, mouseCoords.lat]);
    let bestCoords = mouseCoords;
    let foundSnap = false;

    // 1. Angles
    map.eachLayer(l => {
        if (l instanceof L.CircleMarker && l !== myMarker && l !== ghostCursor) {
            if (map.distance(mouseCoords, l.getLatLng()) < SNAP_ANGLE) {
                bestCoords = l.getLatLng(); foundSnap = true; ghostCursor.setStyle({color: '#00ff00'});
            }
        }
    });

    // 2. Segments (si pas d'angle)
    if (!foundSnap) {
        map.eachLayer(l => {
            if ((l instanceof L.Polygon || l instanceof L.Polyline) && l !== tempLines) {
                const snapped = turf.nearestPointOnLine(l.toGeoJSON(), point, {units: 'meters'});
                if (snapped.properties.dist < SNAP_SEGMENT) {
                    bestCoords = L.latLng(snapped.geometry.coordinates[1], snapped.geometry.coordinates[0]);
                    foundSnap = true; ghostCursor.setStyle({color: '#00ffff'});
                }
            }
        });
    }

    ghostCursor.setStyle({opacity: foundSnap ? 1 : 0.5}).setLatLng(bestCoords);
});

map.on('click', (e) => {
    if (!isEditorMode) return;
    const coords = ghostCursor.getLatLng();
    currentDraftPoints.push([coords.lat, coords.lng]);
    tempLines.setLatLngs(currentDraftPoints);
    L.circleMarker(coords, {radius: 4, color: '#ffffff', interactive: false}).addTo(tempLines); // Marqueur de noeud
});

// --- RACCOURCIS CLAVIER ---
window.addEventListener('keydown', (e) => {
    if (e.key === 'e' || e.key === 'E') toggleMode();
    if (!isEditorMode) return;
    
    if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        currentDraftPoints.pop();
        tempLines.setLatLngs(currentDraftPoints);
    }
    if (e.key === 'Enter') exportZone();
});

function exportZone() {
    if (currentDraftPoints.length < 3) return;
    const id = "Zone_" + Date.now();
    const poly = L.polygon(currentDraftPoints, {color: '#ffcc00', fillOpacity: 0.4}).addTo(map);
    
    // Ajout menu contextuel pour supprimer au clic droit
    poly.on('contextmenu', () => {
        if (confirm("Supprimer cette zone ?")) map.removeLayer(poly);
    });

    console.log("ZONE:", JSON.stringify(currentDraftPoints));
    clearDraft();
}

function clearDraft() {
    currentDraftPoints = [];
    tempLines.setLatLngs([]);
    tempLines.eachLayer(l => map.removeLayer(l)); // Nettoie les points d'appui
}

// --- GPS ---
navigator.geolocation.watchPosition((pos) => {
    const coords = [pos.coords.latitude, pos.coords.longitude];
    myMarker.setLatLng(coords);
    if (autoCenter) map.setView(coords, 18, { animate: true });
    
    document.getElementById('status-text').innerText = "En ligne";
    document.getElementById('dot').classList.add('online');
    db.ref('joueurs/' + playerId).set({ lat: coords[0], lng: coords[1] });
}, null, {enableHighAccuracy: true});