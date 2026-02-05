// --- CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyBB1Ly4gEo0jZakLo1ZWtaKz9-HriOy-CM",
    authDomain: "cat-royal.firebaseapp.com",
    projectId: "cat-royal",
    databaseURL: "https://cat-royal-default-rtdb.europe-west1.firebasedatabase.app/" 
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const playerId = "Player_" + Math.floor(Math.random() * 999);

// --- SETUP CARTE ---
const map = L.map('map', { center: [48.8475, 2.4390], zoom: 17, zoomControl: false });
const tiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png').addTo(map);

// --- COUCHES ---
const zonesGroup = L.featureGroup().addTo(map);
const editorGroup = L.layerGroup(); 
const tempLines = L.polyline([], {color: '#00ffff', weight: 3}).addTo(editorGroup);
const ghostCursor = L.circleMarker([0,0], {radius: 6, color: '#ff00ff', opacity: 1}).addTo(editorGroup);
const myMarker = L.circleMarker([0,0], {radius: 8, color: 'white', fillColor: '#007bff', fillOpacity: 1}).addTo(map);

// --- ÉTATS ---
let isEditorMode = false;
let autoCenter = true;
let currentDraftPoints = [];
let draftMarkers = []; 

// --- GPS ---
navigator.geolocation.watchPosition(pos => {
    const coords = [pos.coords.latitude, pos.coords.longitude];
    myMarker.setLatLng(coords);
    if (autoCenter) map.setView(coords, map.getZoom(), { animate: true });
    document.getElementById('status-text').innerText = "LIVE";
    db.ref('joueurs/' + playerId).update({ lat: coords[0], lng: coords[1], lastSeen: Date.now() });
}, null, { enableHighAccuracy: true });

// --- MOUSE MOVE (SANS MAGNÉTISME) ---
window.addEventListener('mousemove', (e) => {
    if (!isEditorMode) return;

    const cursor = document.getElementById('custom-cursor');
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';

    const mouseLatLng = map.mouseEventToLatLng(e);
    
    // Le curseur suit simplement la souris
    ghostCursor.setLatLng(mouseLatLng);
});

// --- ACTIONS ---
map.on('click', () => {
    if (!isEditorMode) return;
    const pos = ghostCursor.getLatLng();
    currentDraftPoints.push([pos.lat, pos.lng]);
    tempLines.setLatLngs(currentDraftPoints);
    const m = L.circleMarker(pos, {radius: 4, color: 'white', fillColor: 'cyan', fillOpacity: 1}).addTo(editorGroup);
    draftMarkers.push(m);
});

function exportZone() {
    if (currentDraftPoints.length < 3) return;
    const poly = L.polygon(currentDraftPoints, {color: '#ffcc00', fillOpacity: 0.4}).addTo(zonesGroup);
    poly.on('contextmenu', (e) => { 
        L.DomEvent.stopPropagation(e); 
        if(confirm("Supprimer ?")) zonesGroup.removeLayer(poly); 
    });
    clearEditor();
}

function clearEditor() {
    currentDraftPoints = [];
    draftMarkers.forEach(m => editorGroup.removeLayer(m));
    draftMarkers = [];
    tempLines.setLatLngs([]);
}

function toggleMode() {
    isEditorMode = !isEditorMode;
    document.getElementById('btn-toggle').classList.toggle('active', isEditorMode);
    document.getElementById('custom-cursor').style.display = isEditorMode ? 'block' : 'none';
    document.body.classList.toggle('editor-active', isEditorMode);
    
    if (isEditorMode) {
        editorGroup.addTo(map);
    } else {
        clearEditor();
        map.removeLayer(editorGroup);
    }
}

// --- RACCOURCIS ---
window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (key === 'e') toggleMode();
    
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

// --- UTILS ---
function enableAutoCenter() { autoCenter = true; map.panTo(myMarker.getLatLng()); }
map.on('movestart', (e) => { if(!e.hard) autoCenter = false; });