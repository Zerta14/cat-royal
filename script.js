const SNAP_THRESHOLD = 40; // Force d'attraction en pixels (très fort)
const cursorEl = document.getElementById('custom-cursor');

function toggleMode() {
    isEditorMode = !isEditorMode;
    document.getElementById('btn-toggle').classList.toggle('active', isEditorMode);
    document.getElementById('btn-save').style.display = isEditorMode ? "block" : "none";
    
    if (isEditorMode) {
        document.body.classList.add('editor-active');
        cursorEl.style.display = 'block';
    } else {
        document.body.classList.remove('editor-active');
        cursorEl.style.display = 'none';
        clearDraft();
    }
}

// Suivi de la souris pour le curseur custom et le Snap
window.addEventListener('mousemove', (e) => {
    if (!isEditorMode) return;

    // Déplacer le viseur visuel
    cursorEl.style.left = e.clientX + 'px';
    cursorEl.style.top = e.clientY + 'px';

    const mouseLatLng = map.mouseEventToLatLng(e);
    const mousePoint = map.latLngToLayerPoint(mouseLatLng);
    
    let bestPoint = mouseLatLng;
    let minDistance = SNAP_THRESHOLD;
    let snapType = "none";

    // --- ÉTAPE 1 : AIMANT DES ANGLES (Nodes) ---
    // On scanne tous les points déjà posés dans le draft ET les zones existantes
    let candidates = [...currentDraftPoints.map(p => L.latLng(p[0], p[1]))];
    
    zonesGroup.eachLayer(layer => {
        if (layer instanceof L.Polygon) {
            candidates = candidates.concat(layer.getLatLngs()[0]);
        }
    });

    candidates.forEach(latLng => {
        const layerPoint = map.latLngToLayerPoint(latLng);
        const dist = mousePoint.distanceTo(layerPoint);
        if (dist < minDistance) {
            minDistance = dist;
            bestPoint = latLng;
            snapType = "angle";
        }
    });

    // --- ÉTAPE 2 : AIMANT DES SEGMENTS (Si pas d'angle trouvé) ---
    if (snapType === "none") {
        zonesGroup.eachLayer(layer => {
            if (layer instanceof L.Polygon) {
                const turfMouse = turf.point([mouseLatLng.lng, mouseLatLng.lat]);
                const turfPoly = layer.toGeoJSON();
                const snapped = turf.nearestPointOnLine(turfPoly, turfMouse, {units: 'meters'});
                
                const snappedLatLng = L.latLng(snapped.geometry.coordinates[1], snapped.geometry.coordinates[0]);
                const snappedPoint = map.latLngToLayerPoint(snappedLatLng);
                const dist = mousePoint.distanceTo(snappedPoint);

                if (dist < SNAP_THRESHOLD) {
                    bestPoint = snappedLatLng;
                    snapType = "segment";
                }
            }
        });
    }

    // --- ÉTAPE 3 : MISE À JOUR VISUELLE ---
    ghostCursor.setLatLng(bestPoint);
    
    const dot = document.getElementById('cursor-dot');
    if (snapType === "angle") {
        dot.style.background = "#00ff00"; // Vert = Angle
        ghostCursor.setStyle({opacity: 1, color: "#00ff00", radius: 8});
    } else if (snapType === "segment") {
        dot.style.background = "#00ffff"; // Cyan = Ligne
        ghostCursor.setStyle({opacity: 1, color: "#00ffff", radius: 5});
    } else {
        dot.style.background = "#ff00ff"; // Rose = Vide
        ghostCursor.setStyle({opacity: 0.3, color: "#ff00ff", radius: 4});
    }
});

// Clic : On utilise toujours la position du GHOST CURSOR
map.on('click', () => {
    if (!isEditorMode) return;
    const target = ghostCursor.getLatLng();
    currentDraftPoints.push([target.lat, target.lng]);
    tempLines.setLatLngs(currentDraftPoints);
});

// Ctrl+Z mis à jour pour être plus réactif
window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key.toLowerCase() === 'z' && isEditorMode) {
        e.preventDefault();
        currentDraftPoints.pop();
        tempLines.setLatLngs(currentDraftPoints);
    }
});