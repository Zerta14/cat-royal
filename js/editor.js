// ==========================================
// EDITOR
// ==========================================

function initEditor() {
    if (!window.gameState.mapEditor) {
        window.gameState.mapEditor = L.map('map-editor', {
            center: [48.8475, 2.4390],
            zoom: 17,
            zoomControl: true
        });
        
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png')
            .addTo(window.gameState.mapEditor);
        
        const editorGroup = L.layerGroup().addTo(window.gameState.mapEditor);
        window.gameState.tempLines = L.polyline([], { color: '#00ffff', weight: 3 }).addTo(editorGroup);
        window.gameState.ghostCursor = L.circleMarker([0, 0], { 
            radius: 6, 
            color: '#ff00ff', 
            opacity: 1 
        }).addTo(editorGroup);
        
        window.gameState.mapEditor.on('click', onEditorClick);
        document.body.classList.add('editor-active');
        document.getElementById('custom-cursor').style.display = 'block';
    } else {
        // IMPORTANT : Nettoyer TOUTES les zones existantes
        clearEditorMap();
        window.gameState.mapEditor.invalidateSize();
    }

    updateZoneCount();
}

function clearEditorMap() {
    // Supprimer toutes les zones
    window.gameState.editorZones.forEach(zone => {
        if (window.gameState.mapEditor.hasLayer(zone)) {
            window.gameState.mapEditor.removeLayer(zone);
        }
    });
    
    // Reset toutes les variables
    window.gameState.editorZones = [];
    window.gameState.currentDraftPoints = [];
    window.gameState.draftMarkers.forEach(m => {
        if (window.gameState.mapEditor.hasLayer(m)) {
            window.gameState.mapEditor.removeLayer(m);
        }
    });
    window.gameState.draftMarkers = [];
    window.gameState.undoStack = [];
    
    if (window.gameState.tempLines) {
        window.gameState.tempLines.setLatLngs([]);
    }
}

async function loadMapForEditing(mapId) {
    const map = await dbGet(`maps/${mapId}`);
    if (!map) return;

    document.getElementById('map-name-input').value = map.name;
    document.getElementById('btn-delete-map').style.display = 'block';

    initEditor();
    
    map.zones.forEach(zone => {
        const poly = L.polygon(zone.coords, {
            color: '#ffcc00',
            fillOpacity: 0.4
        }).addTo(window.gameState.mapEditor);

        poly.on('contextmenu', (e) => {
            L.DomEvent.stopPropagation(e);
            if (confirmAction("Supprimer cette zone ?")) {
                window.gameState.mapEditor.removeLayer(poly);
                window.gameState.editorZones = window.gameState.editorZones.filter(z => z !== poly);
                updateZoneCount();
            }
        });

        makeZoneEditable(poly);
        window.gameState.editorZones.push(poly);
    });

    updateZoneCount();
}

function makeZoneEditable(poly) {
    const latlngs = poly.getLatLngs()[0];
    latlngs.forEach((latlng, index) => {
        const marker = L.circleMarker(latlng, {
            radius: 5,
            color: 'white',
            fillColor: 'cyan',
            fillOpacity: 1,
            draggable: true
        }).addTo(window.gameState.mapEditor);

        marker.on('drag', (e) => {
            const newLatLngs = poly.getLatLngs()[0];
            newLatLngs[index] = e.latlng;
            poly.setLatLngs(newLatLngs);
        });
    });
}

function onEditorClick() {
    const pos = window.gameState.ghostCursor.getLatLng();
    window.gameState.currentDraftPoints.push([pos.lat, pos.lng]);
    window.gameState.tempLines.setLatLngs(window.gameState.currentDraftPoints);
    
    const marker = L.circleMarker(pos, {
        radius: 4,
        color: 'white',
        fillColor: 'cyan',
        fillOpacity: 1
    }).addTo(window.gameState.mapEditor);
    window.gameState.draftMarkers.push(marker);
}

window.addEventListener('mousemove', (e) => {
    if (!window.gameState.mapEditor || !window.gameState.ghostCursor) return;

    const cursor = document.getElementById('custom-cursor');
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';

    const mouseLatLng = window.gameState.mapEditor.mouseEventToLatLng(e);
    const mouseP = window.gameState.mapEditor.latLngToLayerPoint(mouseLatLng);
    let bestLatLng = mouseLatLng;
    let type = "none";

    if (window.gameState.snapEnabled && !window.gameState.shiftPressed) {
        let bestDist = 40;

        let nodes = [];
        window.gameState.editorZones.forEach(zone => {
            zone.getLatLngs()[0].forEach(pt => nodes.push(pt));
        });
        window.gameState.currentDraftPoints.forEach(p => nodes.push(L.latLng(p[0], p[1])));

        nodes.forEach(node => {
            let d = mouseP.distanceTo(window.gameState.mapEditor.latLngToLayerPoint(node));
            if (d < bestDist) {
                bestDist = d;
                bestLatLng = node;
                type = "angle";
            }
        });

        if (type === "none") {
            window.gameState.editorZones.forEach(zone => {
                const pts = zone.getLatLngs()[0];
                for (let i = 0; i < pts.length; i++) {
                    const p1 = window.gameState.mapEditor.latLngToLayerPoint(pts[i]);
                    const p2 = window.gameState.mapEditor.latLngToLayerPoint(pts[(i + 1) % pts.length]);
                    const closest = L.LineUtil.closestPointOnSegment(mouseP, p1, p2);
                    if (mouseP.distanceTo(closest) < 30) {
                        bestLatLng = window.gameState.mapEditor.layerPointToLatLng(closest);
                        type = "segment";
                    }
                }
            });
        }
    }

    window.gameState.ghostCursor.setLatLng(bestLatLng);
    const colors = { angle: "#00ff00", segment: "#00ffff", none: "#ff00ff" };
    const finalColor = (window.gameState.snapEnabled && !window.gameState.shiftPressed) ? colors[type] : colors["none"];
    window.gameState.ghostCursor.setStyle({ color: finalColor });
    document.getElementById('cursor-dot').style.background = finalColor;
});

window.addEventListener('keydown', (e) => {
    if (e.key === "Shift") window.gameState.shiftPressed = true;
    if (e.key.toLowerCase() === 'm') toggleSnap();
    
    if (window.gameState.mapEditor && e.key === 'Enter' && window.gameState.currentDraftPoints.length >= 3) {
        createZone();
    }
    
    if (window.gameState.mapEditor && e.ctrlKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undoLastAction();
    }
});

window.addEventListener('keyup', (e) => {
    if (e.key === "Shift") window.gameState.shiftPressed = false;
});

function toggleSnap() {
    window.gameState.snapEnabled = !window.gameState.snapEnabled;
    const btn = document.getElementById('btn-snap');
    btn.classList.toggle('active', window.gameState.snapEnabled);
    btn.classList.toggle('disabled', !window.gameState.snapEnabled);
    btn.textContent = window.gameState.snapEnabled ? "Aimant" : "Aimant OFF";
}

function createZone() {
    if (window.gameState.currentDraftPoints.length < 3) return;

    const poly = L.polygon(window.gameState.currentDraftPoints, {
        color: '#ffcc00',
        fillOpacity: 0.4
    }).addTo(window.gameState.mapEditor);

    poly.on('contextmenu', (e) => {
        L.DomEvent.stopPropagation(e);
        if (confirmAction("Supprimer cette zone ?")) {
            window.gameState.mapEditor.removeLayer(poly);
            window.gameState.editorZones = window.gameState.editorZones.filter(z => z !== poly);
            updateZoneCount();
        }
    });

    window.gameState.editorZones.push(poly);
    window.gameState.undoStack.push({ type: 'create', zone: poly });
    
    clearDraft();
    updateZoneCount();
}

function clearDraft() {
    window.gameState.currentDraftPoints = [];
    window.gameState.draftMarkers.forEach(m => window.gameState.mapEditor.removeLayer(m));
    window.gameState.draftMarkers = [];
    window.gameState.tempLines.setLatLngs([]);
}

function undoLastAction() {
    const action = window.gameState.undoStack.pop();
    if (!action) return;

    if (action.type === 'create') {
        window.gameState.mapEditor.removeLayer(action.zone);
        window.gameState.editorZones = window.gameState.editorZones.filter(z => z !== action.zone);
        updateZoneCount();
    }
}

function updateZoneCount() {
    document.getElementById('zone-count').textContent = `Zones: ${window.gameState.editorZones.length}`;
}

async function saveMapEditor() {
    const mapName = document.getElementById('map-name-input').value.trim();
    
    if (!mapName) {
        alert("Donnez un nom à votre map");
        return;
    }

    if (window.gameState.editorZones.length < 3) {
        alert("Créez au moins 3 zones");
        return;
    }

    if (window.gameState.editingMapId) {
        const inUse = await isMapInUse(window.gameState.editingMapId);
        if (inUse) {
            alert("Cette map est utilisée dans une partie");
            return;
        }
    }

    const zones = window.gameState.editorZones.map(zone => ({
        coords: zone.getLatLngs()[0].map(ll => [ll.lat, ll.lng])
    }));

    const mapData = {
        name: mapName,
        creatorId: window.gameState.currentUser.id,
        creatorPseudo: window.gameState.currentUser.pseudo,
        zones: zones,
        updatedAt: Date.now()
    };

    if (window.gameState.editingMapId) {
        await dbUpdate(`maps/${window.gameState.editingMapId}`, mapData);
        alert(`Map "${mapName}" mise à jour !`);
    } else {
        mapData.createdAt = Date.now();
        await dbPush('maps', mapData);
        alert(`Map "${mapName}" créée !`);
    }

    leaveEditor();
}

async function deleteMapEditor() {
    if (!window.gameState.editingMapId) return;

    if (!confirmAction("Supprimer définitivement cette map ?")) return;

    const inUse = await isMapInUse(window.gameState.editingMapId);
    if (inUse) {
        alert("Cette map est utilisée dans une partie");
        return;
    }

    await dbRemove(`maps/${window.gameState.editingMapId}`);
    alert("Map supprimée !");
    leaveEditor();
}

function leaveEditor() {
    clearEditorMap();
    window.gameState.editingMapId = null;
    document.getElementById('map-name-input').value = "";
    document.getElementById('btn-delete-map').style.display = 'none';
    document.body.classList.remove('editor-active');
    document.getElementById('custom-cursor').style.display = 'none';
    
    goToDashboard();
}

document.getElementById('btn-snap').addEventListener('click', toggleSnap);
document.getElementById('btn-save-map').addEventListener('click', saveMapEditor);
document.getElementById('btn-delete-map').addEventListener('click', deleteMapEditor);
document.getElementById('btn-leave-editor').addEventListener('click', leaveEditor);
