// --- CONFIGURATION FIREBASE ---
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

// --- SETUP MAP ---
const themes = {
    dark: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
    light: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png'
};
let currentTheme = 'dark';
const map = L.map('map', { center: [48.8475, 2.4390], zoom: 18, zoomControl: false });
const mapLayer = L.tileLayer(themes[currentTheme]).addTo(map);

// --- ÉTATS ---
let isEditorMode = false;
let autoCenter = true;
let currentDraftPoints = [];
let allPointsIndex = []; // Stockage de TOUS les angles pour un snap ultra-fort

// Layers
let tempLines = L.polyline([], {color: '#00ffff', weight: 4, interactive: false}).addTo(map);
let zonesGroup = L.featureGroup().addTo(map);
let myMarker = L.circleMarker([0,0], {radius: 8, color: 'white', fillColor: '#007bff', fillOpacity: 1, zIndexOffset: 1000}).addTo(map);
let ghostCursor = L.circleMarker([0,0], {radius: 7, color: '#ff00ff', fillOpacity: 1, opacity: 1, interactive: false}).addTo(map);

// --- SYNC GPS OPTIMISÉE ---
let lastPos = null;
let lastSyncTime = 0;

navigator.geolocation.watchPosition((pos) => {
    const coords = [pos.coords.latitude, pos.coords.longitude];
    lastPos = coords;

    // 1. Mise à jour VISUELLE immédiate (Fluidité totale)
    myMarker.setLatLng(coords);
    if (autoCenter) map.setView(coords, 18, { animate: true, duration: 0.5 });
    
    document.getElementById('status-text').innerText = "LIVE";
    document.getElementById('dot').classList.add('online');

    // 2. Synchronisation SERVEUR bridée (toutes les 5 secondes)
    const now = Date.now();
    if (now - lastSyncTime > 5000) {
        db.ref('joueurs/' + playerId).set({ lat: coords[0], lng: coords[1], lastSeen: now });
        lastSyncTime = now;
        console.log("📡 Sync serveur effectuée");
    }
}, (err) => console.error(err), {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 5000
});

// --- MOTEUR DE MAGNÉTISME (HARDCORE) ---
map.on('mousemove', (e) => {
    if (!isEditorMode) { ghostCursor.setStyle({opacity: 0}); return; }

    const mouseLatLng = e.latlng;
    const mousePoint = turf.point([mouseLatLng.lng, mouseLatLng.lat]);
    let bestLatLng = mouseLatLng;
    let snapType = "none";
    let minDistance = 20; // Rayon d'attraction augmenté (pixels/mètres selon zoom)

    // A. SNAP AUX ANGLES (Priorité absolue)
    allPointsIndex.forEach(pt => {
        let d = map.distance(mouseLatLng, pt);
        if (d < minDistance) {
            bestLatLng = pt;
            minDistance = d;
            snapType = "angle";
        }
    });

    // B. SNAP AUX SEGMENTS (Si pas d'angle proche)
    if (snapType === "none") {
        zonesGroup.eachLayer(layer => {
            if (layer instanceof L.Polygon || layer instanceof L.Polyline) {
                const snapped = turf.nearestPointOnLine(layer.toGeoJSON(), mousePoint, {units: 'meters'});
                if (snapped.properties.dist < 15) { // Attraction segments
                    bestLatLng = L.latLng(snapped.geometry.coordinates[1], snapped.geometry.coordinates[0]);
                    snapType = "segment";
                }
            }
        });
    }

    // Mise à jour visuelle du curseur
    ghostCursor.setLatLng(bestLatLng).setStyle({
        opacity: 1,
        color: snapType === "angle" ? "#00ff00" : (snapType === "segment" ? "#00ffff" : "#ff00ff")
    });
});

// --- ACTIONS ÉDITEUR ---
map.on('click', () => {
    if (!isEditorMode) return;
    const target = ghostCursor.getLatLng();
    
    currentDraftPoints.push([target.lat, target.lng]);
    tempLines.setLatLngs(currentDraftPoints);
    
    // On ajoute ce point à l'index pour que le prochain point puisse s'y aimanter
    allPointsIndex.push(target);
});

function exportZone() {
    if (currentDraftPoints.length < 3) return;
    
    const poly = L.polygon(currentDraftPoints, {
        color: '#ffcc00', 
        fillOpacity: 0.4,
        weight: 3
    }).addTo(zonesGroup);

    // Clic droit pour supprimer
    poly.on('contextmenu', (e) => {
        L.DomEvent.stopPropagation(e);
        if (confirm("Supprimer cette zone ?")) {
            // Nettoyage de l'index des points de cette zone (optionnel mais propre)
            zonesGroup.removeLayer(poly);
        }
    });

    console.log("ZONE GÉNÉRÉE :", JSON.stringify(currentDraftPoints));
    currentDraftPoints = [];
    tempLines.setLatLngs([]);
}

// --- RACCOURCIS ---
window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'e') toggleMode();
    if (!isEditorMode) return;
    
    if (e.ctrlKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        const removed = currentDraftPoints.pop();
        allPointsIndex = allPointsIndex.filter(p => p !== removed);
        tempLines.setLatLngs(currentDraftPoints);
    }
    if (e.key === 'Enter') exportZone();
});

// --- UI CONTROLS ---
function toggleMode() {
    isEditorMode = !isEditorMode;
    document.getElementById('btn-toggle').classList.toggle('active', isEditorMode);
    document.getElementById('btn-save').style.display = isEditorMode ? "block" : "none";
    document.getElementById('controls-hint').innerText = isEditorMode ? "ENTRÉE pour valider | CTRL+Z" : "Mode JEU";
}

function enableAutoCenter() {
    autoCenter = true;
    if (lastPos) map.setView(lastPos, 18);
    document.getElementById('btn-center').classList.add('active');
}

map.on('movestart', (e) => { if (!e.hard) { autoCenter = false; document.getElementById('btn-center').classList.remove('active'); } });

function toggleTheme() {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    mapLayer.setUrl(themes[currentTheme]);
}