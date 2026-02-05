// --- VARIABLES ET ÉTATS ---
let isEditorMode = false;
let autoCenter = true;
let snapEnabled = true;
let shiftPressed = false;
let currentDraftPoints = [];
let zonesGroup = L.featureGroup().addTo(map);

// Groupe pour afficher les points (noeuds) du tracé en cours
let draftMarkers = L.layerGroup().addTo(map); 
let tempLines = L.polyline([], {color: '#00ffff', weight: 4, interactive: false}).addTo(map);

let myMarker = L.circleMarker([48.8475, 2.4390], {radius: 8, color: 'white', fillColor: '#007bff', fillOpacity: 1}).addTo(map);

// Le curseur fantôme (le rond violet/vert/bleu)
let ghostCursor = L.circleMarker([0,0], {
    radius: 7, 
    color: '#ff00ff', 
    fillOpacity: 1, 
    interactive: false, 
    opacity: 0 // Caché par défaut
}).addTo(map);

const cursorEl = document.getElementById('custom-cursor');
const dotEl = document.getElementById('cursor-dot');

// --- MOTEUR DE MAGNÉTISME RÉVISÉ ---
window.addEventListener('mousemove', (e) => {
    if (!isEditorMode) return;

    cursorEl.style.left = e.clientX + 'px';
    cursorEl.style.top = e.clientY + 'px';

    const mouseLatLng = map.mouseEventToLatLng(e);
    const mousePoint = map.latLngToLayerPoint(mouseLatLng);
    
    let bestLatLng = mouseLatLng;
    let snapType = "none";
    
    if (snapEnabled && !shiftPressed) {
        let minDistance = 40; 

        // 1. SCAN DES ANGLES (Priorité 1)
        let angles = [];
        zonesGroup.eachLayer(layer => {
            if (layer instanceof L.Polygon) {
                // Leaflet stocke les points dans un tableau de tableaux pour les polygones
                const latlngs = layer.getLatLngs()[0];
                angles = angles.concat(latlngs);
            }
        });
        // On ajoute aussi les points du tracé actuel pour pouvoir fermer le polygone
        currentDraftPoints.forEach(p => angles.push(L.latLng(p[0], p[1])));

        angles.forEach(latLng => {
            let dist = mousePoint.distanceTo(map.latLngToLayerPoint(latLng));
            if (dist < minDistance) {
                minDistance = dist;
                bestLatLng = latLng;
                snapType = "angle";
            }
        });

        // 2. SCAN DES SEGMENTS (Priorité 2)
        if (snapType === "none") {
            zonesGroup.eachLayer(layer => {
                if (layer instanceof L.Polygon) {
                    // On convertit le polygone en "LineString" pour que Turf puisse trouver le point le plus proche sur le bord
                    const geojson = layer.toGeoJSON();
                    const line = turf.polygonToLine(geojson); 
                    
                    const snapped = turf.nearestPointOnLine(line, turf.point([mouseLatLng.lng, mouseLatLng.lat]));
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

    // Mise à jour visuelle du ghostCursor
    ghostCursor.setLatLng(bestLatLng).setStyle({ opacity: 1 });
    
    if (snapType === "angle") { 
        dotEl.style.background = "#00ff00"; 
        ghostCursor.setStyle({color: "#00ff00"}); 
    } else if (snapType === "segment") { 
        dotEl.style.background = "#00ffff"; 
        ghostCursor.setStyle({color: "#00ffff"}); 
    } else { 
        dotEl.style.background = "#ff00ff"; 
        ghostCursor.setStyle({color: "#ff00ff"}); 
    }
});

// --- CLIC : PLACER UN POINT ---
map.on('click', () => {
    if (!isEditorMode) return;
    const target = ghostCursor.getLatLng();
    
    currentDraftPoints.push([target.lat, target.lng]);
    
    // Mise à jour de la ligne
    tempLines.setLatLngs(currentDraftPoints);
    
    // Rendre le point visible immédiatement (même le premier)
    L.circleMarker(target, {
        radius: 5,
        color: '#ffffff',
        fillColor: '#00ffff',
        fillOpacity: 1,
        interactive: false
    }).addTo(draftMarkers);
});

// --- UI & MODES ---
function toggleMode() {
    isEditorMode = !isEditorMode;
    
    const btn = document.getElementById('btn-toggle');
    btn.classList.toggle('active', isEditorMode);
    document.getElementById('btn-save').style.display = isEditorMode ? "block" : "none";
    document.body.classList.toggle('editor-active', isEditorMode);
    
    // Gestion du curseur et du ghostCursor
    cursorEl.style.display = isEditorMode ? 'block' : 'none';
    if (!isEditorMode) {
        ghostCursor.setStyle({ opacity: 0 }); // Cache le rond violet
        clearDraft();
    }
}

function clearDraft() {
    currentDraftPoints = [];
    tempLines.setLatLngs([]);
    draftMarkers.clearLayers(); // Efface les petits points blancs
}

function exportZone() {
    if (currentDraftPoints.length < 3) return;
    
    // Créer le polygone final
    const poly = L.polygon(currentDraftPoints, {
        color: '#ffcc00', 
        fillOpacity: 0.4, 
        weight: 3
    }).addTo(zonesGroup);
    
    poly.on('contextmenu', (e) => {
        L.DomEvent.stopPropagation(e);
        if (confirm("Supprimer cette zone ?")) zonesGroup.removeLayer(poly);
    });

    console.log("ZONE:", JSON.stringify(currentDraftPoints));
    clearDraft();
}

// --- GPS & CENTRAGE (Correction du blocage) ---
function enableAutoCenter() {
    autoCenter = true;
    document.getElementById('btn-center').classList.add('active');
    // On force le recentrage sur la position actuelle du marker
    map.panTo(myMarker.getLatLng(), { animate: true });
}

map.on('dragstart', () => {
    autoCenter = false;
    document.getElementById('btn-center').classList.remove('active');
});