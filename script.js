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
document.getElementById('player-display-id').innerText = "UID: " + playerId;

// --- INITIALISATION CARTE ---
const map = L.map('map', {
    center: [48.8475, 2.4390],
    zoom: 17,
    zoomControl: false // Plus propre sur mobile
});

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);

// --- VARIABLES DE JEU ---
let isEditorMode = false;
let myHP = 100;
let currentDraftPoints = [];
let tempLines = L.polyline([], {color: '#00ffff', dashArray: '5, 10'}).addTo(map);
let snapMarkers = L.layerGroup().addTo(map);
let zoneLayers = {};

// ICI : Tu colleras les zones que tu auras générées
const quartiers = {}; 

// --- FONCTIONS ÉDITEUR ---
function toggleMode() {
    isEditorMode = !isEditorMode;
    const btn = document.getElementById('btn-toggle');
    document.getElementById('btn-save').style.display = isEditorMode ? "block" : "none";
    document.getElementById('btn-clear').style.display = isEditorMode ? "block" : "none";
    
    if (isEditorMode) {
        btn.innerText = "Mode : ÉDITEUR";
        btn.classList.add('active-mode');
    } else {
        btn.innerText = "Mode : JEU";
        btn.classList.remove('active-mode');
        clearDraft();
    }
}

map.on('click', (e) => {
    if (!isEditorMode) return;
    let coords = e.latlng;

    // Magnétisme (Snap)
    snapMarkers.eachLayer(layer => {
        if (map.distance(coords, layer.getLatLng()) < 12) {
            coords = layer.getLatLng();
        }
    });

    currentDraftPoints.push([coords.lat, coords.lng]);
    tempLines.setLatLngs(currentDraftPoints);
    L.circleMarker(coords, {radius: 5, color: '#00ffff'}).addTo(snapMarkers);
});

function exportZone() {
    if (currentDraftPoints.length < 3) return;
    console.log("COORDONNÉES :", JSON.stringify(currentDraftPoints));
    L.polygon(currentDraftPoints, {color: '#ffcc00', fillOpacity: 0.3}).addTo(map);
    alert("Zone exportée en console !");
    clearDraft();
}

function clearDraft() {
    currentDraftPoints = [];
    tempLines.setLatLngs([]);
    snapMarkers.clearLayers();
}

// --- LOGIQUE GPS ---
let myMarker = L.circleMarker([0,0], {radius: 8, color: 'white', fillColor: '#007bff', fillOpacity: 1}).addTo(map);

navigator.geolocation.watchPosition((pos) => {
    const {latitude, longitude} = pos.coords;
    const newPos = [latitude, longitude];
    
    myMarker.setLatLng(newPos);
    if (!isEditorMode) map.panTo(newPos);

    // Sync Firebase
    db.ref('joueurs/' + playerId).set({ lat: latitude, lng: longitude });
    
    document.getElementById('status-text').innerText = "En ligne";
    document.getElementById('dot').classList.add('online');
}, null, {enableHighAccuracy: true});