// ==========================================
// CONFIGURATION FIREBASE
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyBB1Ly4gEo0jZakLo1ZWtaKz9-HriOy-CM",
    authDomain: "cat-royal.firebaseapp.com",
    projectId: "cat-royal",
    databaseURL: "https://cat-royal-default-rtdb.europe-west1.firebasedatabase.app/"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ==========================================
// CONSTANTES GLOBALES
// ==========================================
const ZONE_BUFFER_METERS = 10; // Marge de sécurité pour détection zones
const HP_LOSS_INTERVAL = 3000; // 3 secondes pour perdre 1 HP
const CAMPING_RADIUS = 10; // Rayon en mètres pour détection camping
const CAMPING_TIME = 180000; // 3 minutes en ms
const DEAD_ZONE_PING_TIME = 60000; // 1 minute en ms

// ==========================================
// MODIFIERS DISPONIBLES
// ==========================================
const MODIFIERS = {
    ping_total: {
        name: "Ping Total",
        description: "Chats révèlent toutes les souris (1×)",
        team: "cats",
        icon: "📍"
    },
    final_zone_choice: {
        name: "Zone Finale",
        description: "Chats choisissent la dernière zone",
        team: "cats",
        icon: "🎯"
    },
    no_camping: {
        name: "Camping Interdit",
        description: "Souris immobiles révélées (3min)",
        team: "mice",
        icon: "🚫"
    },
    reveal_cats: {
        name: "Révéler Chats",
        description: "Souris voient position chats (1×)",
        team: "mice",
        icon: "👀"
    },
    force_zone_change: {
        name: "Changement Forcé",
        description: "Chats forcent changement zone (1×)",
        team: "cats",
        icon: "🔄"
    },
    first_touch_cat: {
        name: "1ère Touche = Chat",
        description: "Première souris touchée devient chat",
        team: "global",
        icon: "🔀"
    }
};

// ==========================================
// VARIABLES GLOBALES
// ==========================================
window.gameState = {
    currentUser: null,
    currentGameId: null,
    currentMapId: null,
    isHost: false,
    
    // Maps Leaflet
    mapEditor: null,
    mapGame: null,
    
    // Éditeur
    editorZones: [],
    currentDraftPoints: [],
    draftMarkers: [],
    tempLines: null,
    ghostCursor: null,
    snapEnabled: true,
    shiftPressed: false,
    editingMapId: null,
    undoStack: [],
    
    // Jeu
    gameZones: [],
    gamePolygons: [],
    myPosition: null,
    myRole: null,
    myTeam: null,
    myHP: 100,
    isAlive: true,
    gameTimer: null,
    gameStartTime: null,
    currentPhase: null,
    finalZoneIndex: null,
    zonesToDelete: 0,
    deletedZones: [],
    pingMarkers: [],
    teammateMarker: null,
    myMarker: null,
    gpsWatchId: null,
    
    // Modifiers
    activeModifiers: {},
    modifierStates: {},
    
    // Camping/Dead zone
    inDeadZoneSince: null,
    hpWhenEnteringDeadZone: 100,
    penaltyPingSent: false,
    lastPosition: null,
    lastMovementTime: Date.now(),
    campingWarningShown: false,
    
    // Notifications
    notifications: [],
    unreadCount: 0,
    
    // Listeners Firebase
    gameListener: null,
    gameStateListener: null,
    playersListener: null
};
