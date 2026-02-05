// --- CONFIG ET SETUP ---
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
let snapEnabled = true;
let shiftPressed = false;
let currentDraftPoints = [];
let zonesGroup = L.featureGroup().addTo(map);
let tempLines = L.polyline([], {color: '#00ffff', weight: 4, interactive: false}).addTo(map);
let myMarker = L.circleMarker([48.8475, 2.4390], {radius: 8, color: 'white', fillColor: '#007bff', fillOpacity: 1}).addTo(map);
let ghostCursor = L.circleMarker([0,0], {radius: 7, color: '#ff00ff', fillOpacity: 1, interactive: false, opacity: 0}).addTo(map);

const cursorEl = document.getElementById('custom-cursor');
const dotEl = document.getElementById('cursor-dot');

// --- GPS ET CENTRAGE ---
let lastSync = 0;
function updateGPS(pos) {
    const coords = [pos.coords.latitude, pos.coords.longitude];
    myMarker.setLatLng(coords);
    
    document.getElementById('status-text').innerText = "LIVE";
    document.getElementById('dot').classList.add('online');

    if (autoCenter) {
        // Utilisation de setView avec {animate: true} pour un suivi fluide
        map.setView(coords, map.getZoom(), { animate: true, pan: { duration: 1 } });
    }

    const now = Date.now();
    if (now - lastSync > 5000) {
        db.ref('joueurs/' + playerId).set({ lat: coords[0], lng: coords[1], lastSeen: now });
        lastSync = now;
    }
}

if ("geolocation" in navigator) {
    navigator.geolocation.watchPosition(updateGPS, null, { enableHighAccuracy: true });
}

// --- MOTEUR DE MAGNÉTISME (ANGLES > SEGMENTS) ---
window.addEventListener('mousemove', (e) => {
    if (!isEditorMode) return;

    cursorEl.style.left = e.clientX + 'px';
    cursorEl.style.top = e.clientY + 'px';

    const mouseLatLng = map.mouseEventToLatLng(e);
    const mousePoint = map.latLngToLayerPoint(mouseLatLng);
    
    let bestLatLng = mouseLatLng;
    let snapType = "none";
    
    // Si l'aimant est activé (bouton + pas de touche Maj enfoncée)
    if (snapEnabled && !shiftPressed) {
        let minDistance = 40; // Rayon d'attraction en pixels

        // 1. SCAN DES ANGLES (PRIORITÉ HAUTE)
        let angles = [];
        zonesGroup.eachLayer(layer => {
            if (layer instanceof L.Polygon) angles = angles.concat(layer.getLatLngs()[0]);
        });
        currentDraftPoints.forEach(p => angles.push(L.latLng(p[0], p[1])));

        angles.forEach(latLng => {
            let dist = mousePoint.distanceTo(map.latLngToLayerPoint(latLng));
            if (dist < minDistance) {
                minDistance = dist;
                bestLatLng = latLng;
                snapType = "angle";
            }
        });

        // 2. SCAN DES SEGMENTS (SI PAS D'ANGLE TROUVÉ)
        if (snapType === "none") {
            zonesGroup.eachLayer(layer => {
                if (layer instanceof L.Polygon) {
                    const snapped = turf.nearestPointOnLine(layer.toGeoJSON(), turf.point([mouseLatLng.lng, mouseLatLng.lat]), {units: 'meters'});
                    const snappedLatLng = L.latLng(snapped.geometry.coordinates[1], snapped.geometry.coordinates[0]);
                    let dist = mousePoint.distanceTo(map.latLngToLayerPoint(snappedLatLng));
                    if (dist < 30) {
                        bestLatLng = snappedLatLng;
                        snapType = "segment";
                    }
                }
            });
        }
    }

    ghostCursor.setLatLng(bestLatLng).setStyle({ opacity: 1 });
    if (snapType === "angle") { dotEl.style.background = "#00ff00"; ghostCursor.setStyle({color: "#00ff00"}); }
    else if (snapType === "segment") { dotEl.style.background = "#00ffff"; ghostCursor.setStyle({color: "#00ffff"}); }
    else { dotEl.style.background = "#ff00ff"; ghostCursor.setStyle({color: "#ff00ff"}); }
});

// --- CLAVIER ET RACCOURCIS ---
window.addEventListener('keydown', (e) => {
    if (e.key === "Shift") shiftPressed = true;
    if (e.key.toLowerCase() === 'e') toggleMode();
    if (e.key.toLowerCase() === 'm') toggleSnap();
    
    if (isEditorMode) {
        if (e.key === 'Enter') exportZone();
        if (e.ctrlKey && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            currentDraftPoints.pop();
            tempLines.setLatLngs(currentDraftPoints);
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (e.key === "Shift") shiftPressed = false;
});

// --- UI FUNCTIONS ---
function toggleSnap() {
    snapEnabled = !snapEnabled;
    const btn = document.getElementById('btn-snap');
    btn.classList.toggle('disabled', !snapEnabled);
    btn.innerText = snapEnabled ? "Aimant [M]" : "Aimant OFF";
}

function enableAutoCenter() {
    autoCenter = true;
    document.getElementById('btn-center').classList.add('active');
    // Forcer le recentrage immédiat si on a déjà une position
    if (myMarker.getLatLng()) map.panTo(myMarker.getLatLng());
}

map.on('movestart', (e) => {
    // Si le mouvement ne vient pas du code (hard: true), on coupe le centrage
    if (!e.hard) {
        autoCenter = false;
        document.getElementById('btn-center').classList.remove('active');
    }
});

function toggleMode() {
    isEditorMode = !isEditorMode;
    document.getElementById('btn-toggle').classList.toggle('active', isEditorMode);
    document.getElementById('btn-save').style.display = isEditorMode ? "block" : "none";
    document.body.classList.toggle('editor-active', isEditorMode);
    cursorEl.style.display = isEditorMode ? 'block' : 'none';
    if (!isEditorMode) {
        currentDraftPoints = [];
        tempLines.setLatLngs([]);
    }
}

function exportZone() {
    if (currentDraftPoints.length < 3) return;
    const poly = L.polygon(currentDraftPoints, {color: '#ffcc00', fillOpacity: 0.4, weight: 3}).addTo(zonesGroup);
    poly.on('contextmenu', (e) => {
        L.DomEvent.stopPropagation(e);
        if (confirm("Supprimer cette zone ?")) zonesGroup.removeLayer(poly);
    });
    currentDraftPoints = [];
    tempLines.setLatLngs([]);
}

map.on('click', () => {
    if (!isEditorMode) return;
    const target = ghostCursor.getLatLng();
    currentDraftPoints.push([target.lat, target.lng]);
    tempLines.setLatLngs(currentDraftPoints);
});