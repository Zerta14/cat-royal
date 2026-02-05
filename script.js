// --- CONFIGURATION ---
const firebaseConfig = { /* Ta config Firebase ici */ };
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const playerId = "Player_" + Math.floor(Math.random() * 999);

// --- INITIALISATION MAP ---
const map = L.map('map', { center: [48.8475, 2.4390], zoom: 17, zoomControl: false });
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png').addTo(map);

// --- COUCHES ---
const zonesGroup = L.featureGroup().addTo(map);
const editorGroup = L.layerGroup(); 
const tempLines = L.polyline([], {color: '#00ffff', weight: 3, interactive: false}).addTo(editorGroup);
const ghostCursor = L.circleMarker([0,0], {radius: 6, fillOpacity: 1, interactive: false}).addTo(editorGroup);
const myMarker = L.circleMarker([0,0], {radius: 8, color: 'white', fillColor: '#007bff', fillOpacity: 1}).addTo(map);

// --- ÉTATS ---
let isEditorMode = false;
let autoCenter = true;
let snapEnabled = true;
let shiftPressed = false;
let currentDraftPoints = [];
let draftMarkers = [];

// --- FONCTIONS UI ---
function updateUI() {
    document.getElementById('btn-toggle').classList.toggle('active', isEditorMode);
    document.getElementById('btn-snap').classList.toggle('active', snapEnabled);
    document.getElementById('btn-center').classList.toggle('active', autoCenter);
    
    // Visibilité boutons éditeur
    const display = isEditorMode ? "block" : "none";
    document.getElementById('btn-snap').style.display = display;
    document.getElementById('btn-save').style.display = display;
    document.getElementById('custom-cursor').style.display = display;
}

// --- LOGIQUE ÉDITION ---
function toggleMode() {
    isEditorMode = !isEditorMode;
    document.body.classList.toggle('editor-active', isEditorMode);
    if (isEditorMode) {
        editorGroup.addTo(map);
    } else {
        clearDraft();
        map.removeLayer(editorGroup);
    }
    updateUI();
}

function toggleSnap() {
    snapEnabled = !snapEnabled;
    updateUI();
}

function clearDraft() {
    currentDraftPoints = [];
    draftMarkers.forEach(m => editorGroup.removeLayer(m));
    draftMarkers = [];
    tempLines.setLatLngs([]);
}

function exportZone() {
    if (currentDraftPoints.length < 3) return;
    const poly = L.polygon(currentDraftPoints, {color: '#ffcc00', fillOpacity: 0.4, weight: 3}).addTo(zonesGroup);
    poly.on('contextmenu', (e) => { 
        L.DomEvent.stopPropagation(e); 
        if(confirm("Supprimer cette zone ?")) zonesGroup.removeLayer(poly); 
    });
    clearDraft();
}

// --- MOTEUR DE MAGNÉTISME (Angles > Segments) ---
window.addEventListener('mousemove', (e) => {
    if (!isEditorMode) return;
    
    const cursor = document.getElementById('custom-cursor');
    cursor.style.left = e.clientX + 'px'; cursor.style.top = e.clientY + 'px';

    const mouseLatLng = map.mouseEventToLatLng(e);
    const mouseP = map.latLngToLayerPoint(mouseLatLng);
    let bestLatLng = mouseLatLng;
    let type = "none";

    if (snapEnabled && !shiftPressed) {
        let bestDist = 40;

        // 1. Angles
        let nodes = [];
        zonesGroup.eachLayer(z => nodes = nodes.concat(z.getLatLngs()[0]));
        currentDraftPoints.forEach(p => nodes.push(L.latLng(p[0], p[1])));

        nodes.forEach(node => {
            let d = mouseP.distanceTo(map.latLngToLayerPoint(node));
            if (d < bestDist) { bestDist = d; bestLatLng = node; type = "angle"; }
        });

        // 2. Segments
        if (type === "none") {
            zonesGroup.eachLayer(z => {
                const pts = z.getLatLngs()[0];
                for (let i = 0; i < pts.length; i++) {
                    const p1 = map.latLngToLayerPoint(pts[i]), p2 = map.latLngToLayerPoint(pts[(i + 1) % pts.length]);
                    const closest = L.LineUtil.closestPointOnSegment(mouseP, p1, p2);
                    if (mouseP.distanceTo(closest) < 30) {
                        bestLatLng = map.layerPointToLatLng(closest);
                        type = "segment";
                    }
                }
            });
        }
    }

    ghostCursor.setLatLng(bestLatLng);
    const colors = { angle: "#00ff00", segment: "#00ffff", none: "#ff00ff" };
    const color = (snapEnabled && !shiftPressed) ? colors[type] : colors.none;
    ghostCursor.setStyle({ color: color });
    document.getElementById('cursor-dot').style.background = color;
});

// --- CLIC ET RACCOURCIS ---
map.on('click', () => {
    if (!isEditorMode) return;
    const pos = ghostCursor.getLatLng();
    currentDraftPoints.push([pos.lat, pos.lng]);
    tempLines.setLatLngs(currentDraftPoints);
    const m = L.circleMarker(pos, {radius: 4, color: 'white', fillColor: 'cyan', fillOpacity: 1}).addTo(editorGroup);
    draftMarkers.push(m);
});

window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (e.key === "Shift") shiftPressed = true;
    if (key === 'e') toggleMode();
    if (key === 'm') toggleSnap();
    if (isEditorMode) {
        if (e.key === 'Enter') exportZone();
        if (e.ctrlKey && key === 'z') {
            e.preventDefault();
            currentDraftPoints.pop();
            tempLines.setLatLngs(currentDraftPoints);
            const lastM = draftMarkers.pop();
            if (lastM) editorGroup.removeLayer(lastM);
        }
    }
});
window.addEventListener('keyup', (e) => { if (e.key === "Shift") shiftPressed = false; });

// --- GPS ET CENTRAGE ---
function enableAutoCenter() { autoCenter = true; map.panTo(myMarker.getLatLng()); updateUI(); }
map.on('movestart', (e) => { if(!e.hard) { autoCenter = false; updateUI(); }});

navigator.geolocation.watchPosition(pos => {
    const coords = [pos.coords.latitude, pos.coords.longitude];
    myMarker.setLatLng(coords);
    if (autoCenter) map.setView(coords, map.getZoom(), { animate: true });
    db.ref('joueurs/' + playerId).update({ lat: coords[0], lng: coords[1], lastSeen: Date.now() });
}, null, { enableHighAccuracy: true });