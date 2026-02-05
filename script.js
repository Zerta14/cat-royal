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

// --- INITIALISATION MAP ---
const themes = {
    dark: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
    light: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png'
};
let currentTheme = 'dark';
const map = L.map('map', { center: [48.8475, 2.4390], zoom: 17, zoomControl: false });
const mapLayer = L.tileLayer(themes[currentTheme]).addTo(map);

// --- COUCHES ---
const zonesGroup = L.featureGroup().addTo(map); // Zones définitives
const editorLayer = L.layerGroup(); // Tout ce qui part quand on quitte l'éditeur
const tempLines = L.polyline([], {color: '#00ffff', weight: 4, interactive: false}).addTo(editorLayer);
const ghostCursor = L.circleMarker([0,0], {radius: 7, color: '#ff00ff', fillOpacity: 1, interactive: false}).addTo(editorLayer);
const myMarker = L.circleMarker([48.8475, 2.4390], {radius: 8, color: 'white', fillColor: '#007bff', fillOpacity: 1, zIndexOffset: 1000}).addTo(map);

// --- ÉTATS ---
let isEditorMode = false;
let autoCenter = true;
let snapEnabled = true;
let shiftPressed = false;
let currentDraftPoints = [];

// --- GPS ---
function updateGPS(pos) {
    const coords = [pos.coords.latitude, pos.coords.longitude];
    myMarker.setLatLng(coords);
    document.getElementById('status-text').innerText = "LIVE";
    document.getElementById('dot').classList.add('online');

    if (autoCenter) {
        map.setView(coords, map.getZoom(), { animate: true });
    }
    // Sync simplifiée pour le test
    db.ref('joueurs/' + playerId).update({ lat: coords[0], lng: coords[1], lastSeen: Date.now() });
}

if (navigator.geolocation) {
    navigator.geolocation.watchPosition(updateGPS, () => {
        document.getElementById('status-text').innerText = "Erreur GPS";
    }, { enableHighAccuracy: true });
}

// --- MOTEUR DE SNAP (SIMPLE & PUISSANT) ---
window.addEventListener('mousemove', (e) => {
    if (!isEditorMode) return;

    // Curseur custom
    const cursorEl = document.getElementById('custom-cursor');
    cursorEl.style.left = e.clientX + 'px';
    cursorEl.style.top = e.clientY + 'px';

    const mouseLatLng = map.mouseEventToLatLng(e);
    const mouseP = map.latLngToLayerPoint(mouseLatLng);
    
    let bestLatLng = mouseLatLng;
    let snapType = "none";

    if (snapEnabled && !shiftPressed) {
        let bestDist = 40; // Rayon de snap

        // 1. Angles (Priorité)
        let nodes = [];
        zonesGroup.eachLayer(l => { if(l.getLatLngs) nodes = nodes.concat(l.getLatLngs()[0]); });
        currentDraftPoints.forEach(p => nodes.push(L.latLng(p[0], p[1])));

        nodes.forEach(node => {
            let d = mouseP.distanceTo(map.latLngToLayerPoint(node));
            if (d < bestDist) {
                bestDist = d;
                bestLatLng = node;
                snapType = "angle";
            }
        });

        // 2. Segments
        if (snapType === "none") {
            zonesGroup.eachLayer(l => {
                const latlngs = l.getLatLngs()[0];
                for (let i = 0; i < latlngs.length; i++) {
                    const p1 = map.latLngToLayerPoint(latlngs[i]);
                    const p2 = map.latLngToLayerPoint(latlngs[(i + 1) % latlngs.length]);
                    const closest = L.LineUtil.closestPointOnSegment(mouseP, p1, p2);
                    let d = mouseP.distanceTo(closest);
                    if (d < 30) {
                        bestDist = d;
                        bestLatLng = map.layerPointToLatLng(closest);
                        snapType = "segment";
                    }
                }
            });
        }
    }

    ghostCursor.setLatLng(bestLatLng);
    const colors = { angle: "#00ff00", segment: "#00ffff", none: "#ff00ff" };
    const color = colors[snapType];
    ghostCursor.setStyle({ color: color });
    document.getElementById('cursor-dot').style.background = color;
});

// --- INTERACTIONS ---
map.on('click', () => {
    if (!isEditorMode) return;
    const target = ghostCursor.getLatLng();
    currentDraftPoints.push([target.lat, target.lng]);
    tempLines.setLatLngs(currentDraftPoints);

    // POINT IMMÉDIATEMENT VISIBLE
    L.circleMarker(target, { radius: 4, color: 'white', fillColor: 'cyan', fillOpacity: 1, interactive: false }).addTo(editorLayer);
});

function toggleMode() {
    isEditorMode = !isEditorMode;
    document.getElementById('btn-toggle').classList.toggle('active', isEditorMode);
    document.body.classList.toggle('editor-active', isEditorMode);
    document.getElementById('custom-cursor').style.display = isEditorMode ? 'block' : 'none';

    if (isEditorMode) {
        editorLayer.addTo(map);
    } else {
        map.removeLayer(editorLayer); // Retire tout d'un coup (ligne, points, ghost)
        currentDraftPoints = [];
        tempLines.setLatLngs([]);
        editorLayer.clearLayers();
        // On remet les outils dans le layer vide pour le prochain ON
        tempLines.addTo(editorLayer);
        ghostCursor.addTo(editorLayer);
    }
}

function exportZone() {
    if (currentDraftPoints.length < 3) return;
    const poly = L.polygon(currentDraftPoints, {color: '#ffcc00', fillOpacity: 0.4, weight: 3}).addTo(zonesGroup);
    poly.on('contextmenu', (e) => { 
        L.DomEvent.stopPropagation(e); 
        if(confirm("Supprimer ?")) zonesGroup.removeLayer(poly); 
    });
    // On simule une sortie/entrée du mode pour tout nettoyer
    toggleMode(); toggleMode(); 
}

// --- AUTRES ---
function enableAutoCenter() {
    autoCenter = true;
    document.getElementById('btn-center').classList.add('active');
    map.panTo(myMarker.getLatLng());
}
map.on('movestart', (e) => { if(!e.hard) { autoCenter = false; document.getElementById('btn-center').classList.remove('active'); }});

window.addEventListener('keydown', (e) => {
    if (e.key === "Shift") shiftPressed = true;
    if (e.key.toLowerCase() === 'e') toggleMode();
    if (isEditorMode && e.key === 'Enter') exportZone();
});
window.addEventListener('keyup', (e) => { if (e.key === "Shift") shiftPressed = false; });