// --- INITIALISATION DES COUCHES ---
const editorLayer = L.layerGroup(); // Conteneur global du mode éditeur
const zonesGroup = L.featureGroup().addTo(map); // Les zones finies (toujours visibles)

const tempLines = L.polyline([], {color: '#00ffff', weight: 4}).addTo(editorLayer);
const ghostCursor = L.circleMarker([0,0], {radius: 7, color: '#ff00ff', fillOpacity: 1, opacity: 1}).addTo(editorLayer);
const dotEl = document.getElementById('cursor-dot');

// --- LE MOTEUR DE SNAP SIMPLIFIÉ ---
function getSnapLatLng(mouseLatLng) {
    if (!snapEnabled || shiftPressed) return mouseLatLng;

    const mouseP = map.latLngToLayerPoint(mouseLatLng);
    let bestDist = 40; // Rayon de snap
    let bestLatLng = mouseLatLng;
    let type = "none";

    // SCAN DES POINTS (Angles / Noeuds)
    let points = [];
    zonesGroup.eachLayer(l => { if(l.getLatLngs) points = points.concat(l.getLatLngs()[0]); });
    currentDraftPoints.forEach(p => points.push(L.latLng(p[0], p[1])));

    points.forEach(latLng => {
        let d = mouseP.distanceTo(map.latLngToLayerPoint(latLng));
        if (d < bestDist) {
            bestDist = d;
            bestLatLng = latLng;
            type = "angle";
        }
    });

    // SCAN DES SEGMENTS (Si pas d'angle trouvé)
    if (type === "none") {
        zonesGroup.eachLayer(l => {
            if (l instanceof L.Polygon) {
                const latlngs = l.getLatLngs()[0];
                for (let i = 0; i < latlngs.length; i++) {
                    const p1 = map.latLngToLayerPoint(latlngs[i]);
                    const p2 = map.latLngToLayerPoint(latlngs[(i + 1) % latlngs.length]);
                    // Calcul du point le plus proche sur le segment p1-p2
                    const closestP = L.LineUtil.closestPointOnSegment(mouseP, p1, p2);
                    let d = mouseP.distanceTo(closestP);
                    if (d < 30) {
                        bestDist = d;
                        bestLatLng = map.layerPointToLatLng(closestP);
                        type = "segment";
                    }
                }
            }
        });
    }
    return { latlng: bestLatLng, type: type };
}

// --- GESTION DES ÉVÉNEMENTS ---
window.addEventListener('mousemove', (e) => {
    if (!isEditorMode) return;
    
    // Curseur custom
    const cursorEl = document.getElementById('custom-cursor');
    cursorEl.style.left = e.clientX + 'px';
    cursorEl.style.top = e.clientY + 'px';

    const snap = getSnapLatLng(map.mouseEventToLatLng(e));
    ghostCursor.setLatLng(snap.latlng);

    // Couleurs
    const colors = { angle: "#00ff00", segment: "#00ffff", none: "#ff00ff" };
    const color = colors[snap.type];
    dotEl.style.background = color;
    ghostCursor.setStyle({ color: color });
});

map.on('click', () => {
    if (!isEditorMode) return;
    const target = ghostCursor.getLatLng();
    
    currentDraftPoints.push([target.lat, target.lng]);
    tempLines.setLatLngs(currentDraftPoints);

    // RENDRE LE POINT VISIBLE IMMÉDIATEMENT
    L.circleMarker(target, { radius: 4, color: 'white', fillColor: 'cyan', fillOpacity: 1 })
     .addTo(editorLayer);
});

// --- SWITCH MODE ---
function toggleMode() {
    isEditorMode = !isEditorMode;
    document.getElementById('btn-toggle').classList.toggle('active', isEditorMode);
    document.body.classList.toggle('editor-active', isEditorMode);
    document.getElementById('custom-cursor').style.display = isEditorMode ? 'block' : 'none';

    if (isEditorMode) {
        map.addLayer(editorLayer);
    } else {
        map.removeLayer(editorLayer);
        // On vide tout pour la prochaine fois
        currentDraftPoints = [];
        tempLines.setLatLngs([]);
        editorLayer.clearLayers();
        // On doit remettre le ghostCursor et tempLines dans le layer vidé
        tempLines.addTo(editorLayer);
        ghostCursor.addTo(editorLayer);
    }
}