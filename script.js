// --- CONFIG & DATA ---
const firebaseConfig = { /* Ta config Firebase ici */ };
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const map = L.map('map', { center: [48.8475, 2.4390], zoom: 17, zoomControl: false });
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png').addTo(map);

// --- COUCHES & ÉTATS ---
const zonesGroup = L.featureGroup().addTo(map);
const editorGroup = L.layerGroup(); 
const tempLines = L.polyline([], {color: '#00ffff', weight: 3}).addTo(editorGroup);
const ghostCursor = L.circleMarker([0,0], {radius: 6, opacity: 1}).addTo(editorGroup);
const myMarker = L.circleMarker([0,0], {radius: 8, color: 'white', fillColor: '#007bff', fillOpacity: 1}).addTo(map);

let state = { isEditor: false, autoCenter: true, snap: true, shift: false, points: [], markers: [] };

// --- FONCTIONS UI (RÉFÉRENCES) ---
function updateButtonStates() {
    // Gère l'apparence des boutons selon l'état actuel
    document.getElementById('btn-toggle').classList.toggle('active', state.isEditor);
    document.getElementById('btn-snap').classList.toggle('active', state.snap);
    document.getElementById('btn-center').classList.toggle('active', state.autoCenter);
    
    // Gère la visibilité des contrôles d'édition
    const editorButtons = [document.getElementById('btn-snap'), document.getElementById('btn-save')];
    editorButtons.forEach(btn => btn.classList.toggle('hidden', !state.isEditor));
    document.getElementById('custom-cursor').classList.toggle('hidden', !state.isEditor);
}

// --- LOGIQUE ÉDITION ---
function toggleMode() {
    state.isEditor = !state.isEditor;
    document.body.classList.toggle('editor-active', state.isEditor);
    if (state.isEditor) {
        editorGroup.addTo(map);
    } else {
        clearDraft();
        map.removeLayer(editorGroup);
    }
    updateButtonStates();
}

function toggleSnap() {
    state.snap = !state.snap;
    updateButtonStates();
}

function clearDraft() {
    state.points = [];
    state.markers.forEach(m => editorGroup.removeLayer(m));
    state.markers = [];
    tempLines.setLatLngs([]);
}

function undoLastPoint() {
    state.points.pop();
    tempLines.setLatLngs(state.points);
    const lastM = state.markers.pop();
    if (lastM) editorGroup.removeLayer(lastM);
}

// --- MOTEUR DE MAGNÉTISME ---
function calculateSnap(mouseLatLng) {
    if (!state.snap || state.shift) return { latlng: mouseLatLng, type: 'none' };
    
    const mouseP = map.latLngToLayerPoint(mouseLatLng);
    let best = { latlng: mouseLatLng, dist: 40, type: 'none' };

    // 1. Angles
    let nodes = [];
    zonesGroup.eachLayer(z => nodes = nodes.concat(z.getLatLngs()[0]));
    state.points.forEach(p => nodes.push(L.latLng(p[0], p[1])));

    nodes.forEach(node => {
        let d = mouseP.distanceTo(map.latLngToLayerPoint(node));
        if (d < best.dist) best = { latlng: node, dist: d, type: 'angle' };
    });

    // 2. Segments
    if (best.type === 'none') {
        zonesGroup.eachLayer(z => {
            const pts = z.getLatLngs()[0];
            for (let i = 0; i < pts.length; i++) {
                const p1 = map.latLngToLayerPoint(pts[i]), p2 = map.latLngToLayerPoint(pts[(i + 1) % pts.length]);
                const closest = L.LineUtil.closestPointOnSegment(mouseP, p1, p2);
                let d = mouseP.distanceTo(closest);
                if (d < 30) best = { latlng: map.layerPointToLatLng(closest), dist: d, type: 'segment' };
            }
        });
    }
    return best;
}

// --- EVENTS ---
window.addEventListener('mousemove', (e) => {
    if (!state.isEditor) return;
    const cursor = document.getElementById('custom-cursor');
    cursor.style.left = e.clientX + 'px'; cursor.style.top = e.clientY + 'px';

    const snap = calculateSnap(map.mouseEventToLatLng(e));
    ghostCursor.setLatLng(snap.latlng);

    const colors = { angle: "#00ff00", segment: "#00ffff", none: "#ff00ff" };
    const color = (state.snap && !state.shift) ? colors[snap.type] : colors.none;
    ghostCursor.setStyle({ color: color });
    document.getElementById('cursor-dot').style.background = color;
});

map.on('click', () => {
    if (!state.isEditor) return;
    const pos = ghostCursor.getLatLng();
    state.points.push([pos.lat, pos.lng]);
    tempLines.setLatLngs(state.points);
    state.markers.push(L.circleMarker(pos, {radius: 4, color: 'white', fillColor: 'cyan', fillOpacity: 1}).addTo(editorGroup));
});

window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (e.key === "Shift") state.shift = true;
    if (key === 'e') toggleMode();
    if (key === 'm') toggleSnap();
    if (state.isEditor) {
        if (e.key === 'Enter') {
            if (state.points.length < 3) return;
            const poly = L.polygon(state.points, {color: '#ffcc00', fillOpacity: 0.4}).addTo(zonesGroup);
            poly.on('contextmenu', (e) => { L.DomEvent.stopPropagation(e); if(confirm("Suppr?")) zonesGroup.removeLayer(poly); });
            clearDraft();
        }
        if (e.ctrlKey && key === 'z') { e.preventDefault(); undoLastPoint(); }
    }
});
window.addEventListener('keyup', (e) => { if (e.key === "Shift") state.shift = false; });

// GPS
navigator.geolocation.watchPosition(pos => {
    const coords = [pos.coords.latitude, pos.coords.longitude];
    myMarker.setLatLng(coords);
    if (state.autoCenter) map.setView(coords, map.getZoom(), { animate: true });
    db.ref('joueurs/' + playerId).update({ lat: coords[0], lng: coords[1], lastSeen: Date.now() });
}, null, { enableHighAccuracy: true });