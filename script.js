"use strict";

/* =====================================================
   FIREBASE
===================================================== */

const firebaseConfig = {
  apiKey: "AIzaSyC_ohyktq2AYsz4loES44r3a4CbWPyiRTY",
  authDomain: "rf26-samarit-3ff10.firebaseapp.com",
  projectId: "rf26-samarit-3ff10",
  storageBucket: "rf26-samarit-3ff10.firebasestorage.app",
  messagingSenderId: "545324484370",
  appId: "1:545324484370:web:ce48468ca202a1758495cb"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

/* =====================================================
   APP CONFIG
===================================================== */

const APP_VERSION = "sammap-v7";
const SESSION_KEY = `sammap-session-${APP_VERSION}`;
const THEME_KEY = `sammap-theme-${APP_VERSION}`;
const SETTINGS_KEY = `sammap-settings-${APP_VERSION}`;

const FESTIVAL_CENTER = [55.6416, 12.0803];
const MAP_FALLBACK_ZOOM = 17;

const GPS_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 5000
};

const POSITION_UPLOAD_MIN_INTERVAL_MS = 1000;
const POSITION_UPLOAD_MIN_DISTANCE_M = 1;
const VEHICLE_STALE_MS = 2 * 60 * 1000;
const GPS_RESTART_THRESHOLD_MS = 12000;

/* =====================================================
   STATE
===================================================== */

const state = {
  session: null,
  settings: {
    theme: "theme-dark",
    fleetVisible: false
  },

  map: null,
  tileLayer: null,

  currentLatLng: null,
  currentSpeed: 0,
  currentHeading: 0,
  lastPositionTime: 0,
  lastGoodAccuracy: null,

  watchId: null,
  gpsRestartInterval: null,
  gpsFallbackAttemptAt: 0,

  myMarker: null,
  otherVehicleMarkers: new Map(),
  incidentMarkers: new Map(),

  targetLatLng: null,
  targetMarker: null,

  userMovedMap: false,

  vehiclesData: {},
  incidentsData: {},

  unsubscribeVehicles: null,
  unsubscribeDispatch: null,
  unsubscribeIncidents: null,

  lastUploadAt: 0,
  lastUploadedLatLng: null,

  activeDispatchId: null,
  activeDispatchData: null,
  dispatchTargetId: null,

  selectedIncidentLatLng: null,

  currentVehicleStatus: "ledig"
};

/* =====================================================
   DOM
===================================================== */

const els = {
  body: document.body,

  loginScreen: document.getElementById("loginScreen"),
  mainScreen: document.getElementById("mainScreen"),
  loginForm: document.getElementById("loginForm"),
  holdInput: document.getElementById("holdInput"),
  vehicleInput: document.getElementById("vehicleInput"),
  dispatcherModeInput: document.getElementById("dispatcherModeInput"),

  identityText: document.getElementById("identityText"),
  roleStatus: document.getElementById("roleStatus"),
  gpsStatus: document.getElementById("gpsStatus"),
  networkStatus: document.getElementById("networkStatus"),
  mapStatus: document.getElementById("mapStatus"),
  firebaseStatus: document.getElementById("firebaseStatus"),

  mapLoading: document.getElementById("mapLoading"),
  mapLoadingText: document.getElementById("mapLoadingText"),
  mapError: document.getElementById("mapError"),
  mapErrorText: document.getElementById("mapErrorText"),
  retryMapBtn: document.getElementById("retryMapBtn"),

  speedValue: document.getElementById("speedValue"),
  headingValue: document.getElementById("headingValue"),
  distanceValue: document.getElementById("distanceValue"),

  centerBtn: document.getElementById("centerBtn"),
  fullscreenBtn: document.getElementById("fullscreenBtn"),
  themeBtn: document.getElementById("themeBtn"),
  fleetToggleBtn: document.getElementById("fleetToggleBtn"),
  incidentToggleBtn: document.getElementById("incidentToggleBtn"),
  logoutBtn: document.getElementById("logoutBtn"),

  fleetPanel: document.getElementById("fleetPanel"),
  fleetList: document.getElementById("fleetList"),
  fleetCount: document.getElementById("fleetCount"),

  dispatcherStrip: document.getElementById("dispatcherStrip"),
  dispatcherVehicleCount: document.getElementById("dispatcherVehicleCount"),
  dispatcherAvailableCount: document.getElementById("dispatcherAvailableCount"),
  dispatcherIncidentCount: document.getElementById("dispatcherIncidentCount"),
  dispatcherLiveStatus: document.getElementById("dispatcherLiveStatus"),

  vehicleStatusBar: document.getElementById("vehicleStatusBar"),
  currentVehicleStatusText: document.getElementById("currentVehicleStatusText"),
  setAvailableBtn: document.getElementById("setAvailableBtn"),
  setBusyBtn: document.getElementById("setBusyBtn"),

  operationsPanel: document.getElementById("operationsPanel"),
  operationsVehicleCount: document.getElementById("operationsVehicleCount"),
  operationsVehicleList: document.getElementById("operationsVehicleList"),
  operationsIncidentCount: document.getElementById("operationsIncidentCount"),
  operationsIncidentList: document.getElementById("operationsIncidentList"),

  dispatchModal: document.getElementById("dispatchModal"),
  dispatchForm: document.getElementById("dispatchForm"),
  dispatchTargetInput: document.getElementById("dispatchTargetInput"),
  dispatchMessageInput: document.getElementById("dispatchMessageInput"),
  dispatchDestinationInput: document.getElementById("dispatchDestinationInput"),
  dispatchAttachWaypointInput: document.getElementById("dispatchAttachWaypointInput"),
  closeDispatchModalBtn: document.getElementById("closeDispatchModalBtn"),
  cancelDispatchBtn: document.getElementById("cancelDispatchBtn"),
  nearestSuggestionBox: document.getElementById("nearestSuggestionBox"),
  nearestSuggestionText: document.getElementById("nearestSuggestionText"),

  incidentModal: document.getElementById("incidentModal"),
  incidentForm: document.getElementById("incidentForm"),
  incidentTypeInput: document.getElementById("incidentTypeInput"),
  incidentDescriptionInput: document.getElementById("incidentDescriptionInput"),
  incidentLocationTextInput: document.getElementById("incidentLocationTextInput"),
  incidentCoordinatesInput: document.getElementById("incidentCoordinatesInput"),
  closeIncidentModalBtn: document.getElementById("closeIncidentModalBtn"),
  cancelIncidentBtn: document.getElementById("cancelIncidentBtn"),
  incidentNearestSuggestionBox: document.getElementById("incidentNearestSuggestionBox"),
  incidentNearestSuggestionText: document.getElementById("incidentNearestSuggestionText"),

  incomingDispatchBanner: document.getElementById("incomingDispatchBanner"),
  incomingFrom: document.getElementById("incomingFrom"),
  incomingMessage: document.getElementById("incomingMessage"),
  incomingDestination: document.getElementById("incomingDestination"),
  closeIncomingDispatchBtn: document.getElementById("closeIncomingDispatchBtn"),
  applyIncomingWaypointBtn: document.getElementById("applyIncomingWaypointBtn")
};

/* =====================================================
   INIT
===================================================== */

init();

function init() {
  restoreTheme();
  restoreSettings();
  bindEvents();
  updateNetworkStatus();
  setFirebaseStatus("Firebase klar", "ok");
  registerServiceWorkerInline();
  restoreSession();

  window.addEventListener("online", updateNetworkStatus);
  window.addEventListener("offline", updateNetworkStatus);
  window.addEventListener("resize", scheduleMapResize);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      scheduleMapResize();
    }
  });

  window.addEventListener("pagehide", handlePageHide);
  window.addEventListener("beforeunload", handlePageHide);
}

function bindEvents() {
  els.loginForm.addEventListener("submit", onLoginSubmit);

  els.centerBtn.addEventListener("click", centerMapOnContext);
  els.fullscreenBtn.addEventListener("click", toggleFullscreen);
  els.themeBtn.addEventListener("click", toggleTheme);
  els.fleetToggleBtn.addEventListener("click", toggleFleetPanel);
  els.incidentToggleBtn.addEventListener("click", openIncidentModalFromCurrentContext);
  els.logoutBtn.addEventListener("click", logout);
  els.retryMapBtn.addEventListener("click", retryMapInitialization);

  els.setAvailableBtn.addEventListener("click", () => setVehicleStatus("ledig"));
  els.setBusyBtn.addEventListener("click", () => setVehicleStatus("optaget"));

  els.closeDispatchModalBtn.addEventListener("click", closeDispatchModal);
  els.cancelDispatchBtn.addEventListener("click", closeDispatchModal);
  els.dispatchForm.addEventListener("submit", submitDispatchMessage);

  els.closeIncidentModalBtn.addEventListener("click", closeIncidentModal);
  els.cancelIncidentBtn.addEventListener("click", closeIncidentModal);
  els.incidentForm.addEventListener("submit", submitIncident);

  els.closeIncomingDispatchBtn.addEventListener("click", closeIncomingDispatch);
  els.applyIncomingWaypointBtn.addEventListener("click", applyIncomingWaypoint);

  els.dispatchModal.addEventListener("click", (event) => {
    if (event.target === els.dispatchModal) {
      closeDispatchModal();
    }
  });

  els.incidentModal.addEventListener("click", (event) => {
    if (event.target === els.incidentModal) {
      closeIncidentModal();
    }
  });
}

/* =====================================================
   SESSION / LOGIN
===================================================== */

function onLoginSubmit(event) {
  event.preventDefault();

  const hold = sanitizeText(els.holdInput.value);
  const vehicle = sanitizeText(els.vehicleInput.value);
  const isDispatcher = Boolean(els.dispatcherModeInput.checked);

  if (!hold || !vehicle) {
    setGPSStatus("Udfyld begge felter", "warn");
    return;
  }

  state.session = {
    hold,
    vehicle,
    id: `${hold}_${vehicle}`.replace(/\s+/g, "_"),
    isDispatcher
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify(state.session));
  openMainApp();
}

function restoreSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw);
    if (parsed?.hold && parsed?.vehicle && parsed?.id) {
      state.session = parsed;
      openMainApp();
    }
  } catch (error) {
    console.error("Kunne ikke gendanne session:", error);
    localStorage.removeItem(SESSION_KEY);
  }
}

function openMainApp() {
  els.loginScreen.classList.add("hidden");
  els.mainScreen.classList.remove("hidden");

  els.identityText.textContent = state.session.isDispatcher
    ? "SamMap · Beredskabskontoret"
    : `SamMap · Hold ${state.session.hold} · Køretøj ${state.session.vehicle}`;

  els.roleStatus.textContent = state.session.isDispatcher ? "Beredskabskontor" : "Køretøj";
  els.roleStatus.className = "status-pill muted";

  if (state.session.isDispatcher) {
    els.roleStatus.classList.add("ok");
    els.dispatcherStrip.classList.remove("hidden");
    els.operationsPanel.classList.remove("hidden");
    els.vehicleStatusBar.classList.add("hidden");
    state.settings.fleetVisible = true;
    syncFleetPanel();
    setGPSStatus("Operationsvisning", "ok");
  } else {
    els.dispatcherStrip.classList.add("hidden");
    els.operationsPanel.classList.add("hidden");
    els.vehicleStatusBar.classList.remove("hidden");
  }

  updateCurrentStatusUI();

  showMapLoading("Indlæser kort, GPS og Firebase");
  hideMapError();

  if (!state.map) {
    initMap();
  } else {
    scheduleMapResize();
    hideMapLoading();
  }

  startFirebaseSubscriptions();

  if (!state.session.isDispatcher) {
    startGPS();
    startGPSHealthWatch();
  } else {
    stopGPS();
    stopGPSHealthWatch();
    if (state.map) {
      state.map.setView(FESTIVAL_CENTER, MAP_FALLBACK_ZOOM, { animate: false });
    }
    hideMapLoading();
  }
}

async function logout() {
  await deleteMyVehicleFromFirebase();

  stopGPS();
  stopGPSHealthWatch();

  unsubscribeAll();

  state.otherVehicleMarkers.forEach((marker) => {
    if (state.map) state.map.removeLayer(marker);
  });
  state.otherVehicleMarkers.clear();

  state.incidentMarkers.forEach((marker) => {
    if (state.map) state.map.removeLayer(marker);
  });
  state.incidentMarkers.clear();

  state.vehiclesData = {};
  state.incidentsData = {};
  state.currentLatLng = null;
  state.currentSpeed = 0;
  state.currentHeading = 0;
  state.lastPositionTime = 0;
  state.lastUploadedLatLng = null;
  state.lastUploadAt = 0;
  state.activeDispatchId = null;
  state.activeDispatchData = null;
  state.dispatchTargetId = null;
  state.selectedIncidentLatLng = null;
  state.currentVehicleStatus = "ledig";

  if (state.myMarker && state.map) {
    state.map.removeLayer(state.myMarker);
  }
  state.myMarker = null;

  clearWaypoint();
  hideIncomingDispatch();

  localStorage.removeItem(SESSION_KEY);
  state.session = null;

  els.loginForm.reset();
  els.loginScreen.classList.remove("hidden");
  els.mainScreen.classList.add("hidden");
  setGPSStatus("Venter på GPS", "");
}

function unsubscribeAll() {
  if (state.unsubscribeVehicles) {
    state.unsubscribeVehicles();
    state.unsubscribeVehicles = null;
  }
  if (state.unsubscribeDispatch) {
    state.unsubscribeDispatch();
    state.unsubscribeDispatch = null;
  }
  if (state.unsubscribeIncidents) {
    state.unsubscribeIncidents();
    state.unsubscribeIncidents = null;
  }
}

function handlePageHide() {
  deleteMyVehicleFromFirebase(true);
}

async function deleteMyVehicleFromFirebase(silent = false) {
  if (!state.session || state.session.isDispatcher) return;

  try {
    await db.collection("vehicles").doc(state.session.id).delete();
  } catch (error) {
    if (!silent) {
      console.warn("Kunne ikke slette køretøj ved afslutning:", error);
    }
  }
}

/* =====================================================
   MAP
===================================================== */

function initMap() {
  try {
    setMapStatus("Kort starter", "muted");

    state.map = L.map("map", {
      zoomControl: false,
      attributionControl: true,
      preferCanvas: true,
      inertia: true
    }).setView(FESTIVAL_CENTER, MAP_FALLBACK_ZOOM);

    state.tileLayer = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 20,
        minZoom: 15,
        crossOrigin: true,
        attribution: "&copy; OpenStreetMap-bidragydere"
      }
    );

    state.tileLayer.on("loading", () => {
      setMapStatus("Kort indlæser", "warn");
    });

    state.tileLayer.on("tileload", () => {
      setMapStatus("Kort klar", "ok");
      hideMapLoading();
    });

    state.tileLayer.on("load", () => {
      setMapStatus("Kort klar", "ok");
      hideMapLoading();
    });

    state.tileLayer.on("tileerror", () => {
      if (!navigator.onLine) {
        setMapStatus("Offline kort", "warn");
        hideMapLoading();
      } else {
        setMapStatus("Kortfejl", "error");
      }
    });

    state.tileLayer.addTo(state.map);

    state.map.on("click", (event) => {
      if (state.session?.isDispatcher && els.incidentModal && !els.incidentModal.classList.contains("hidden")) {
        setIncidentDraftLatLng(event.latlng);
        return;
      }
      setWaypoint(event.latlng);
    });

    state.map.on("dragstart", () => {
      state.userMovedMap = true;
    });

    state.map.on("zoomstart", () => {
      state.userMovedMap = true;
    });

    state.map.on("zoomend", () => {
      scheduleMapResize();
    });

    scheduleMapResize();

    setTimeout(() => {
      scheduleMapResize();
      hideMapLoading();
      setMapStatus(navigator.onLine ? "Kort klar" : "Offline kort", navigator.onLine ? "ok" : "warn");
    }, 700);
  } catch (error) {
    console.error("Map init fejl:", error);
    showMapError("Kortet kunne ikke startes.");
    setMapStatus("Kortfejl", "error");
  }
}

function retryMapInitialization() {
  hideMapError();
  showMapLoading("Prøver at starte kortet igen");
  scheduleMapResize();

  setTimeout(() => {
    hideMapLoading();
    setMapStatus(navigator.onLine ? "Kort klar" : "Offline kort", navigator.onLine ? "ok" : "warn");
  }, 700);
}

function scheduleMapResize() {
  if (!state.map) return;

  [30, 120, 300].forEach((delay) => {
    setTimeout(() => {
      try {
        state.map.invalidateSize();
      } catch (error) {
        console.warn("invalidateSize fejl:", error);
      }
    }, delay);
  });
}

function setWaypoint(latlng) {
  if (!state.map) return;

  state.targetLatLng = latlng;

  if (!state.targetMarker) {
    state.targetMarker = L.marker(latlng).addTo(state.map);
    state.targetMarker.on("click", (event) => {
      if (event.originalEvent) {
        L.DomEvent.stopPropagation(event);
      }
      clearWaypoint();
    });
  } else {
    state.targetMarker.setLatLng(latlng);
  }

  updateHUD();
}

function clearWaypoint() {
  if (state.targetMarker && state.map) {
    state.map.removeLayer(state.targetMarker);
  }
  state.targetMarker = null;
  state.targetLatLng = null;
  updateHUD();
}

function centerMapOnContext() {
  state.userMovedMap = false;

  if (!state.map) return;

  if (state.session?.isDispatcher && state.selectedIncidentLatLng) {
    state.map.setView(state.selectedIncidentLatLng, Math.max(state.map.getZoom(), 19), { animate: true });
    return;
  }

  if (state.currentLatLng) {
    state.map.setView(state.currentLatLng, Math.max(state.map.getZoom(), 18), { animate: true });
    return;
  }

  state.map.setView(FESTIVAL_CENTER, MAP_FALLBACK_ZOOM, { animate: true });
}

function maybeFollowVehicle(latlng) {
  if (!state.map || !latlng || state.session?.isDispatcher) return;

  const bounds = state.map.getBounds();
  const innerBounds = bounds.pad(-0.35);

  if (!innerBounds.isValid()) return;

  const shouldRecenter = !innerBounds.contains(latlng) || !state.userMovedMap;

  if (shouldRecenter) {
    state.map.panTo(latlng, {
      animate: true,
      duration: 0.25,
      easeLinearity: 1
    });
    state.userMovedMap = false;
  }
}

/* =====================================================
   GPS
===================================================== */

function startGPS() {
  if (!navigator.geolocation) {
    setGPSStatus("GPS ikke understøttet", "error");
    return;
  }

  stopGPS();
  setGPSStatus("Finder position ...", "warn");

  navigator.geolocation.getCurrentPosition(
    handlePosition,
    handlePositionError,
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 5000
    }
  );

  state.watchId = navigator.geolocation.watchPosition(
    handlePosition,
    handlePositionError,
    GPS_OPTIONS
  );
}

function stopGPS() {
  if (state.watchId !== null) {
    navigator.geolocation.clearWatch(state.watchId);
    state.watchId = null;
  }
}

function startGPSHealthWatch() {
  stopGPSHealthWatch();

  state.gpsRestartInterval = window.setInterval(() => {
    if (!state.session || state.session.isDispatcher) return;
    if (!state.lastPositionTime) return;

    const now = Date.now();
    if (now - state.lastPositionTime > GPS_RESTART_THRESHOLD_MS) {
      console.warn("GPS ikke opdateret længe nok, genstarter watchPosition");
      startGPS();
    }
  }, 5000);
}

function stopGPSHealthWatch() {
  if (state.gpsRestartInterval) {
    clearInterval(state.gpsRestartInterval);
    state.gpsRestartInterval = null;
  }
}

function handlePosition(position) {
  const lat = position.coords.latitude;
  const lon = position.coords.longitude;
  const accuracy = Math.round(position.coords.accuracy || 0);
  const speedRaw = position.coords.speed;
  const headingRaw = position.coords.heading;
  const timestamp = position.timestamp || Date.now();

  const latlng = L.latLng(lat, lon);

  if (accuracy > 120 && state.currentLatLng) {
    setGPSStatus(`GPS svag · ±${accuracy} m`, "warn");
    return;
  }

  let speedKmh = 0;
  let heading = state.currentHeading || 0;

  if (typeof speedRaw === "number" && !Number.isNaN(speedRaw) && speedRaw >= 0) {
    speedKmh = speedRaw * 3.6;
  }

  if (typeof headingRaw === "number" && !Number.isNaN(headingRaw)) {
    heading = headingRaw;
  }

  if (state.currentLatLng) {
    const distance = latlng.distanceTo(state.currentLatLng);
    const dt = Math.max((timestamp - (state.lastPositionTime || timestamp)) / 1000, 0.5);

    if (!speedKmh || speedKmh < 1) {
      speedKmh = (distance / dt) * 3.6;
    }

    if ((typeof headingRaw !== "number" || Number.isNaN(headingRaw)) && distance > 1.5) {
      heading = calculateBearing(
        state.currentLatLng.lat,
        state.currentLatLng.lng,
        latlng.lat,
        latlng.lng
      );
    }

    if (distance < 0.3 && accuracy > 50) {
      setGPSStatus(`GPS svag · ±${accuracy} m`, "warn");
      return;
    }
  }

  speedKmh = clamp(speedKmh, 0, 140);
  heading = normalizeHeading(heading);

  state.currentLatLng = latlng;
  state.currentSpeed = speedKmh;
  state.currentHeading = heading;
  state.lastPositionTime = timestamp;
  state.lastGoodAccuracy = accuracy;

  if (accuracy <= 15) {
    setGPSStatus(`GPS stærk · ±${accuracy} m`, "ok");
  } else if (accuracy <= 40) {
    setGPSStatus(`GPS OK · ±${accuracy} m`, "ok");
  } else {
    setGPSStatus(`GPS svag · ±${accuracy} m`, "warn");
  }

  updateHUD();
  updateMyMarker();
  maybeFollowVehicle(latlng);
  preloadNearbyTiles(latlng);
  uploadPosition();
  hideMapLoading();
}

function handlePositionError(error) {
  console.error("GPS fejl:", error);

  switch (error.code) {
    case 1:
      setGPSStatus("GPS-adgang afvist", "error");
      break;
    case 2:
      setGPSStatus("Position utilgængelig · prøver igen", "warn");
      tryFallbackGetCurrentPosition();
      break;
    case 3:
      setGPSStatus("GPS timeout · prøver igen", "warn");
      tryFallbackGetCurrentPosition();
      break;
    default:
      setGPSStatus("GPS-fejl", "error");
  }
}

function tryFallbackGetCurrentPosition() {
  const now = Date.now();
  if (now - state.gpsFallbackAttemptAt < 4000) return;

  state.gpsFallbackAttemptAt = now;

  navigator.geolocation.getCurrentPosition(
    handlePosition,
    () => {},
    {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 10000
    }
  );
}

function updateMyMarker() {
  if (!state.map || !state.currentLatLng) return;

  const icon = L.divIcon({
    className: "",
    html: createVehicleMarkerHTML(state.currentHeading, true, state.currentVehicleStatus),
    iconSize: [52, 52],
    iconAnchor: [26, 26]
  });

  if (!state.myMarker) {
    state.myMarker = L.marker(state.currentLatLng, {
      icon,
      zIndexOffset: 1000
    }).addTo(state.map);

    state.myMarker.bindPopup(() => `
      <strong>Eget køretøj</strong><br>
      Hold: ${escapeHtml(state.session.hold)}<br>
      Køretøj: ${escapeHtml(state.session.vehicle)}<br>
      Status: ${escapeHtml(capitalize(state.currentVehicleStatus))}<br>
      Hastighed: ${Math.round(state.currentSpeed)} km/t
    `);
  } else {
    state.myMarker.setLatLng(state.currentLatLng);
    state.myMarker.setIcon(icon);
  }
}

/* =====================================================
   VEHICLE STATUS
===================================================== */

function setVehicleStatus(status) {
  state.currentVehicleStatus = status;
  updateCurrentStatusUI();
  updateMyMarker();
  uploadPosition(true);
}

function updateCurrentStatusUI() {
  els.currentVehicleStatusText.textContent = capitalize(state.currentVehicleStatus);
}

/* =====================================================
   FIREBASE VEHICLES
===================================================== */

async function uploadPosition(force = false) {
  if (!state.session || state.session.isDispatcher || !state.currentLatLng) return;

  const now = Date.now();
  const distanceSinceLastUpload = state.lastUploadedLatLng
    ? state.currentLatLng.distanceTo(state.lastUploadedLatLng)
    : Infinity;

  const dueByTime = now - state.lastUploadAt >= POSITION_UPLOAD_MIN_INTERVAL_MS;
  const dueByDistance = distanceSinceLastUpload >= POSITION_UPLOAD_MIN_DISTANCE_M;

  if (!force && !dueByTime && !dueByDistance) return;

  state.lastUploadAt = now;
  state.lastUploadedLatLng = state.currentLatLng;

  try {
    await db.collection("vehicles").doc(state.session.id).set({
      hold: state.session.hold,
      vehicle: state.session.vehicle,
      lat: state.currentLatLng.lat,
      lon: state.currentLatLng.lng,
      speed: Math.round(state.currentSpeed),
      heading: Math.round(state.currentHeading),
      status: state.currentVehicleStatus,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      role: "vehicle"
    });

    setFirebaseStatus("Firebase live", "ok");
  } catch (error) {
    console.error("Upload fejl:", error);
    setFirebaseStatus("Firebase fejl", "error");
  }
}

function startFirebaseSubscriptions() {
  subscribeVehicles();
  subscribeDispatches();
  subscribeIncidents();
}

function subscribeVehicles() {
  if (state.unsubscribeVehicles) {
    state.unsubscribeVehicles();
  }

  state.unsubscribeVehicles = db.collection("vehicles").onSnapshot(
    (snapshot) => {
      const now = Date.now();
      const seen = new Set();
      const freshVehicles = {};

      snapshot.forEach((doc) => {
        const data = doc.data();
        if (!data) return;

        const updatedMs = data.updatedAt?.toMillis ? data.updatedAt.toMillis() : now;
        if (now - updatedMs > VEHICLE_STALE_MS) return;

        freshVehicles[doc.id] = data;

        if (doc.id === state.session?.id) return;

        seen.add(doc.id);
        renderOtherVehicleMarker(doc.id, data);
      });

      state.vehiclesData = freshVehicles;

      Array.from(state.otherVehicleMarkers.keys()).forEach((id) => {
        if (!seen.has(id)) {
          const marker = state.otherVehicleMarkers.get(id);
          if (state.map && marker) {
            state.map.removeLayer(marker);
          }
          state.otherVehicleMarkers.delete(id);
        }
      });

      renderFleetList();
      renderOperationsVehicleList();
      updateDispatcherStats();
    },
    (error) => {
      console.error("Vehicles listener fejl:", error);
      setFirebaseStatus("Firebase fejl", "error");
    }
  );
}

function renderOtherVehicleMarker(id, vehicle) {
  if (!state.map) return;

  const latlng = L.latLng(vehicle.lat, vehicle.lon);

  const icon = L.divIcon({
    className: "",
    html: createVehicleMarkerHTML(vehicle.heading || 0, false, vehicle.status || "ledig"),
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });

  if (!state.otherVehicleMarkers.has(id)) {
    const marker = L.marker(latlng, { icon }).addTo(state.map);
    marker.bindPopup(() => `
      <strong>Hold ${escapeHtml(vehicle.hold || "-")} · ${escapeHtml(vehicle.vehicle || "-")}</strong><br>
      Status: ${escapeHtml(capitalize(vehicle.status || "ledig"))}<br>
      Hastighed: ${escapeHtml(String(vehicle.speed || 0))} km/t<br>
      Retning: ${escapeHtml(headingToCompass(vehicle.heading || 0))}
    `);
    state.otherVehicleMarkers.set(id, marker);
  } else {
    const marker = state.otherVehicleMarkers.get(id);
    marker.setLatLng(latlng);
    marker.setIcon(icon);
  }
}

/* =====================================================
   INCIDENTS
===================================================== */

function subscribeIncidents() {
  if (state.unsubscribeIncidents) {
    state.unsubscribeIncidents();
  }

  state.unsubscribeIncidents = db.collection("incidents").onSnapshot(
    (snapshot) => {
      const seen = new Set();
      const freshIncidents = {};

      snapshot.forEach((doc) => {
        const incident = doc.data();
        if (!incident) return;

        freshIncidents[doc.id] = incident;
        seen.add(doc.id);
        renderIncidentMarker(doc.id, incident);
      });

      state.incidentsData = freshIncidents;

      Array.from(state.incidentMarkers.keys()).forEach((id) => {
        if (!seen.has(id)) {
          const marker = state.incidentMarkers.get(id);
          if (state.map && marker) {
            state.map.removeLayer(marker);
          }
          state.incidentMarkers.delete(id);
        }
      });

      renderOperationsIncidentList();
      updateDispatcherStats();
    },
    (error) => {
      console.error("Incidents listener fejl:", error);
    }
  );
}

function renderIncidentMarker(id, incident) {
  if (!state.map) return;

  const latlng = L.latLng(incident.lat, incident.lon);
  const icon = incidentIcon(incident.type);

  if (!state.incidentMarkers.has(id)) {
    const marker = L.marker(latlng, { icon }).addTo(state.map);
    marker.bindPopup(() => `
      <strong>${escapeHtml(incidentTypeLabel(incident.type))}</strong><br>
      ${escapeHtml(incident.description || "-")}<br>
      ${escapeHtml(incident.locationText || "-")}
    `);
    marker.on("click", () => {
      state.selectedIncidentLatLng = latlng;
    });
    state.incidentMarkers.set(id, marker);
  } else {
    const marker = state.incidentMarkers.get(id);
    marker.setLatLng(latlng);
    marker.setIcon(icon);
  }
}

function incidentIcon(type) {
  let emoji = "⚠️";
  if (type === "medical") emoji = "🚑";
  if (type === "fire") emoji = "🔥";
  if (type === "security") emoji = "⚠️";

  return L.divIcon({
    className: "",
    html: `<div style="font-size:22px;">${emoji}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
}

function openIncidentModalFromCurrentContext() {
  if (!state.session?.isDispatcher) return;

  state.selectedIncidentLatLng = state.currentLatLng || state.targetLatLng || null;

  if (state.selectedIncidentLatLng) {
    setIncidentDraftLatLng(state.selectedIncidentLatLng);
  } else {
    els.incidentCoordinatesInput.value = "Vælg placering på kortet";
    els.incidentNearestSuggestionBox.classList.add("hidden");
  }

  els.incidentDescriptionInput.value = "";
  els.incidentLocationTextInput.value = "";
  els.incidentTypeInput.value = "medical";
  els.incidentModal.classList.remove("hidden");
}

function closeIncidentModal() {
  els.incidentModal.classList.add("hidden");
}

function setIncidentDraftLatLng(latlng) {
  state.selectedIncidentLatLng = latlng;
  els.incidentCoordinatesInput.value = `${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`;

  const nearest = findNearestAvailableVehicle(latlng.lat, latlng.lng);
  if (nearest) {
    els.incidentNearestSuggestionBox.classList.remove("hidden");
    els.incidentNearestSuggestionText.textContent =
      `Hold ${nearest.hold} · ${nearest.vehicle} – ${Math.round(nearest.distance)} meter`;
  } else {
    els.incidentNearestSuggestionBox.classList.add("hidden");
  }
}

async function submitIncident(event) {
  event.preventDefault();

  if (!state.session?.isDispatcher || !state.selectedIncidentLatLng) return;

  const type = els.incidentTypeInput.value;
  const description = sanitizeText(els.incidentDescriptionInput.value);
  const locationText = sanitizeText(els.incidentLocationTextInput.value);

  if (!description) return;

  try {
    await db.collection("incidents").add({
      type,
      description,
      locationText,
      lat: state.selectedIncidentLatLng.lat,
      lon: state.selectedIncidentLatLng.lng,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: state.session.id
    });

    closeIncidentModal();
  } catch (error) {
    console.error("Kunne ikke oprette hændelse:", error);
    alert("Kunne ikke oprette hændelse.");
  }
}

/* =====================================================
   DISPATCH
===================================================== */

function openDispatchModal(targetId, label, suggestionText = "") {
  state.dispatchTargetId = targetId;
  els.dispatchTargetInput.value = label || targetId;
  els.dispatchMessageInput.value = "";
  els.dispatchDestinationInput.value = "";
  els.dispatchAttachWaypointInput.checked = Boolean(state.targetLatLng);
  els.dispatchAttachWaypointInput.disabled = !state.targetLatLng;

  if (suggestionText) {
    els.nearestSuggestionBox.classList.remove("hidden");
    els.nearestSuggestionText.textContent = suggestionText;
  } else {
    els.nearestSuggestionBox.classList.add("hidden");
  }

  els.dispatchModal.classList.remove("hidden");
}

function closeDispatchModal() {
  state.dispatchTargetId = null;
  els.dispatchModal.classList.add("hidden");
  els.nearestSuggestionBox.classList.add("hidden");
}

async function submitDispatchMessage(event) {
  event.preventDefault();

  if (!state.session || !state.dispatchTargetId) return;

  const message = sanitizeText(els.dispatchMessageInput.value);
  const destination = sanitizeText(els.dispatchDestinationInput.value);
  const attachWaypoint = Boolean(els.dispatchAttachWaypointInput.checked && state.targetLatLng);

  if (!message) return;

  const payload = {
    targetVehicle: state.dispatchTargetId,
    fromVehicle: state.session.id,
    fromLabel: state.session.isDispatcher
      ? "Beredskabskontoret"
      : `Hold ${state.session.hold} · ${state.session.vehicle}`,
    message,
    destination,
    status: "open",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  if (attachWaypoint) {
    payload.waypoint = {
      lat: state.targetLatLng.lat,
      lon: state.targetLatLng.lng
    };
  }

  try {
    await db.collection("dispatch").add(payload);
    closeDispatchModal();
  } catch (error) {
    console.error("Dispatch send fejl:", error);
    alert("Kunne ikke sende melding.");
  }
}

function subscribeDispatches() {
  if (!state.session) return;

  if (state.unsubscribeDispatch) {
    state.unsubscribeDispatch();
  }

  state.unsubscribeDispatch = db.collection("dispatch")
    .where("targetVehicle", "==", state.session.id)
    .where("status", "==", "open")
    .onSnapshot(
      (snapshot) => {
        if (snapshot.empty) return;

        const doc = snapshot.docs[0];
        const data = doc.data();
        showIncomingDispatch(doc.id, data);
      },
      (error) => {
        console.error("Dispatch listener fejl:", error);
      }
    );
}

function showIncomingDispatch(id, data) {
  if (!data) return;

  state.activeDispatchId = id;
  state.activeDispatchData = data;

  els.incomingFrom.textContent = data.fromLabel || data.fromVehicle || "-";
  els.incomingMessage.textContent = data.message || "-";
  els.incomingDestination.textContent = data.destination || "-";
  els.incomingDispatchBanner.classList.remove("hidden");

  if (data.waypoint && isFinite(data.waypoint.lat) && isFinite(data.waypoint.lon)) {
    els.applyIncomingWaypointBtn.classList.remove("hidden");
  } else {
    els.applyIncomingWaypointBtn.classList.add("hidden");
  }
}

function applyIncomingWaypoint() {
  if (!state.activeDispatchData?.waypoint) return;

  const { lat, lon } = state.activeDispatchData.waypoint;
  setWaypoint(L.latLng(lat, lon));

  if (state.map) {
    state.map.setView([lat, lon], Math.max(state.map.getZoom(), 19), { animate: true });
  }
}

async function closeIncomingDispatch() {
  if (!state.activeDispatchId) {
    hideIncomingDispatch();
    return;
  }

  try {
    await db.collection("dispatch").doc(state.activeDispatchId).update({
      status: "closed",
      closedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error("Close dispatch fejl:", error);
  }

  hideIncomingDispatch();
}

function hideIncomingDispatch() {
  state.activeDispatchId = null;
  state.activeDispatchData = null;
  els.incomingDispatchBanner.classList.add("hidden");
  els.applyIncomingWaypointBtn.classList.add("hidden");
}

/* =====================================================
   RENDER LISTS / OPERATIONS
===================================================== */

function renderFleetList() {
  const rows = Object.entries(state.vehiclesData)
    .filter(([id]) => id !== state.session?.id)
    .map(([id, vehicle]) => ({
      id,
      hold: vehicle.hold || "-",
      vehicle: vehicle.vehicle || "-",
      speed: vehicle.speed || 0,
      heading: vehicle.heading || 0,
      status: vehicle.status || "ledig",
      lat: vehicle.lat,
      lon: vehicle.lon
    }));

  rows.sort((a, b) => `${a.hold}-${a.vehicle}`.localeCompare(`${b.hold}-${b.vehicle}`, "da"));
  els.fleetCount.textContent = String(rows.length);

  if (!rows.length) {
    els.fleetList.innerHTML = `
      <div class="fleet-item">
        <div>Ingen andre aktive køretøjer</div>
      </div>
    `;
    return;
  }

  els.fleetList.innerHTML = rows.map((row) => {
    const statusEmoji = row.status === "ledig" ? "🟢" : "🔴";
    return `
      <div class="fleet-item">
        <div class="fleet-main" data-lat="${row.lat}" data-lon="${row.lon}">
          Hold ${escapeHtml(row.hold)} · ${escapeHtml(row.vehicle)}
        </div>
        <div>${statusEmoji}</div>
      </div>
    `;
  }).join("");

  els.fleetList.querySelectorAll(".fleet-main").forEach((element) => {
    element.addEventListener("click", () => {
      const lat = Number(element.dataset.lat);
      const lon = Number(element.dataset.lon);
      if (!Number.isNaN(lat) && !Number.isNaN(lon) && state.map) {
        state.map.setView([lat, lon], Math.max(state.map.getZoom(), 19), { animate: true });
      }
    });
  });
}

function renderOperationsVehicleList() {
  if (!state.session?.isDispatcher) return;

  const rows = Object.entries(state.vehiclesData)
    .map(([id, vehicle]) => ({
      id,
      hold: vehicle.hold || "-",
      vehicle: vehicle.vehicle || "-",
      status: vehicle.status || "ledig",
      lat: vehicle.lat,
      lon: vehicle.lon
    }))
    .sort((a, b) => `${a.hold}-${a.vehicle}`.localeCompare(`${b.hold}-${b.vehicle}`, "da"));

  els.operationsVehicleCount.textContent = String(rows.length);

  if (!rows.length) {
    els.operationsVehicleList.innerHTML = `<div>Ingen aktive køretøjer</div>`;
    return;
  }

  els.operationsVehicleList.innerHTML = rows.map((row) => {
    const statusEmoji = row.status === "ledig" ? "🟢" : "🔴";
    return `
      <div class="operations-item">
        <div>
          <strong>Hold ${escapeHtml(row.hold)} · ${escapeHtml(row.vehicle)}</strong>
        </div>
        <div>${statusEmoji} ${escapeHtml(capitalize(row.status))}</div>
        <div class="operations-actions">
          <button class="ops-center-btn" data-lat="${row.lat}" data-lon="${row.lon}">Center</button>
          <button class="ops-dispatch-btn" data-id="${escapeHtml(row.id)}" data-label="Hold ${escapeHtml(row.hold)} · ${escapeHtml(row.vehicle)}">Send</button>
        </div>
      </div>
    `;
  }).join("");

  els.operationsVehicleList.querySelectorAll(".ops-center-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const lat = Number(button.dataset.lat);
      const lon = Number(button.dataset.lon);
      if (!Number.isNaN(lat) && !Number.isNaN(lon) && state.map) {
        state.map.setView([lat, lon], Math.max(state.map.getZoom(), 19), { animate: true });
      }
    });
  });

  els.operationsVehicleList.querySelectorAll(".ops-dispatch-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const suggestion = state.selectedIncidentLatLng
        ? findNearestAvailableVehicle(state.selectedIncidentLatLng.lat, state.selectedIncidentLatLng.lng)
        : null;

      const suggestionText = suggestion
        ? `Foreslår Hold ${suggestion.hold} · ${suggestion.vehicle} – ${Math.round(suggestion.distance)} meter`
        : "";

      openDispatchModal(button.dataset.id, button.dataset.label, suggestionText);
    });
  });
}

function renderOperationsIncidentList() {
  if (!state.session?.isDispatcher) return;

  const rows = Object.entries(state.incidentsData).map(([id, incident]) => ({
    id,
    ...incident
  }));

  els.operationsIncidentCount.textContent = String(rows.length);

  if (!rows.length) {
    els.operationsIncidentList.innerHTML = `<div>Ingen aktive hændelser</div>`;
    return;
  }

  els.operationsIncidentList.innerHTML = rows.map((incident) => {
    const nearest = findNearestAvailableVehicle(incident.lat, incident.lon);
    return `
      <div class="operations-item">
        <div>
          <strong>${escapeHtml(incidentTypeLabel(incident.type))}</strong>
        </div>
        <div>${escapeHtml(incident.description || "-")}</div>
        <div>${escapeHtml(incident.locationText || "-")}</div>
        <div>${nearest ? `Nærmeste ledige: Hold ${escapeHtml(nearest.hold)} · ${escapeHtml(nearest.vehicle)} – ${Math.round(nearest.distance)} meter` : "Ingen ledige køretøjer"}</div>
        <div class="operations-actions">
          <button class="ops-incident-center-btn" data-lat="${incident.lat}" data-lon="${incident.lon}">Center</button>
        </div>
      </div>
    `;
  }).join("");

  els.operationsIncidentList.querySelectorAll(".ops-incident-center-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const lat = Number(button.dataset.lat);
      const lon = Number(button.dataset.lon);
      if (!Number.isNaN(lat) && !Number.isNaN(lon) && state.map) {
        state.selectedIncidentLatLng = L.latLng(lat, lon);
        state.map.setView([lat, lon], Math.max(state.map.getZoom(), 19), { animate: true });
      }
    });
  });
}

function updateDispatcherStats() {
  const vehicles = Object.entries(state.vehiclesData).filter(([id]) => id !== state.session?.id);
  const availableVehicles = vehicles.filter(([, vehicle]) => (vehicle.status || "ledig") === "ledig");

  els.dispatcherVehicleCount.textContent = String(vehicles.length);
  els.dispatcherAvailableCount.textContent = String(availableVehicles.length);
  els.dispatcherIncidentCount.textContent = String(Object.keys(state.incidentsData).length);
  els.dispatcherLiveStatus.textContent = navigator.onLine ? "Live" : "Offline";
}

/* =====================================================
   NEAREST VEHICLE
===================================================== */

function findNearestAvailableVehicle(lat, lon) {
  const rows = Object.entries(state.vehiclesData)
    .filter(([id]) => id !== state.session?.id)
    .map(([, vehicle]) => vehicle)
    .filter((vehicle) => (vehicle.status || "ledig") === "ledig" && isFinite(vehicle.lat) && isFinite(vehicle.lon));

  if (!rows.length || !state.map) return null;

  let nearest = null;
  let bestDistance = Infinity;

  rows.forEach((vehicle) => {
    const distance = state.map.distance([lat, lon], [vehicle.lat, vehicle.lon]);
    if (distance < bestDistance) {
      bestDistance = distance;
      nearest = { ...vehicle, distance };
    }
  });

  return nearest;
}

/* =====================================================
   HUD / UI
===================================================== */

function updateHUD() {
  els.speedValue.textContent = String(Math.round(state.currentSpeed || 0));
  els.headingValue.textContent = headingToCompass(state.currentHeading || 0);

  if (state.currentLatLng && state.targetLatLng) {
    els.distanceValue.textContent = String(Math.round(state.currentLatLng.distanceTo(state.targetLatLng)));
  } else if (state.selectedIncidentLatLng && state.targetLatLng) {
    els.distanceValue.textContent = String(Math.round(state.selectedIncidentLatLng.distanceTo(state.targetLatLng)));
  } else {
    els.distanceValue.textContent = "-";
  }
}

function toggleFleetPanel() {
  state.settings.fleetVisible = !state.settings.fleetVisible;
  syncFleetPanel();
  saveSettings();
}

function syncFleetPanel() {
  els.fleetPanel.classList.toggle("hidden", !state.settings.fleetVisible);
}

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
    scheduleMapResize();
  } catch (error) {
    console.warn("Fullscreen fejl:", error);
  }
}

function toggleTheme() {
  const next = els.body.classList.contains("theme-dark") ? "theme-light" : "theme-dark";
  els.body.classList.remove("theme-dark", "theme-light");
  els.body.classList.add(next);
  localStorage.setItem(THEME_KEY, next);
  state.settings.theme = next;
  saveSettings();
}

function restoreTheme() {
  const saved = localStorage.getItem(THEME_KEY) || "theme-dark";
  els.body.classList.remove("theme-dark", "theme-light");
  els.body.classList.add(saved);
}

function showMapLoading(text) {
  els.mapLoadingText.textContent = text || "Indlæser kort";
  els.mapLoading.classList.remove("hidden");
}

function hideMapLoading() {
  els.mapLoading.classList.add("hidden");
}

function showMapError(text) {
  els.mapErrorText.textContent = text || "Kortfejl";
  els.mapError.classList.remove("hidden");
  hideMapLoading();
}

function hideMapError() {
  els.mapError.classList.add("hidden");
}

function setMapStatus(message, variant = "muted") {
  els.mapStatus.textContent = message;
  els.mapStatus.className = "status-pill";
  if (variant) els.mapStatus.classList.add(variant);
}

function setGPSStatus(message, variant = "") {
  els.gpsStatus.textContent = message;
  els.gpsStatus.className = "status-pill";
  if (variant) els.gpsStatus.classList.add(variant);
}

function setFirebaseStatus(message, variant = "") {
  els.firebaseStatus.textContent = message;
  els.firebaseStatus.className = "status-pill";
  if (variant) els.firebaseStatus.classList.add(variant);
}

function updateNetworkStatus() {
  const online = navigator.onLine;
  els.networkStatus.textContent = online ? "Online" : "Offline";
  els.networkStatus.className = "status-pill muted";
  if (!online) els.networkStatus.classList.add("warn");
  els.dispatcherLiveStatus.textContent = online ? "Live" : "Offline";
}

function restoreSettings() {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return;

  try {
    state.settings = { ...state.settings, ...JSON.parse(raw) };
  } catch (error) {
    console.warn("Kunne ikke læse settings:", error);
  }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}

/* =====================================================
   MARKER HTML
===================================================== */

function createVehicleMarkerHTML(heading = 0, isPrimary = false, status = "ledig") {
  const size = isPrimary ? 52 : 40;
  const colorA = status === "ledig" ? "#22c55e" : "#ef4444";
  const colorB = status === "ledig" ? "#16a34a" : "#b91c1c";
  const wrapperClass = isPrimary ? "vehicle-marker" : "other-vehicle-marker";

  const svg = `
    <svg viewBox="0 0 64 64" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="vehicleGradient${isPrimary ? "A" : "B"}${status}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${colorA}"/>
          <stop offset="100%" stop-color="${colorB}"/>
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="28" fill="url(#vehicleGradient${isPrimary ? "A" : "B"}${status})" stroke="white" stroke-width="3"/>
      <path d="M18 36L21 26C22 23 24 21 27 21H40C43 21 45 23 46 26L48 32H51C53 32 54 33 54 35V41C54 43 53 44 51 44H49C49 47 47 49 44 49C41 49 39 47 39 44H25C25 47 23 49 20 49C17 49 15 47 15 44H13C11 44 10 43 10 41V37C10 34 12 32 15 32H17L18 36Z" fill="white"/>
      <rect x="28" y="25" width="10" height="10" rx="1.5" fill="${colorB}"/>
      <rect x="31.5" y="22" width="3" height="16" fill="white"/>
      <rect x="25" y="28.5" width="16" height="3" fill="white"/>
      <circle cx="20" cy="44" r="3.5" fill="#0f172a"/>
      <circle cx="44" cy="44" r="3.5" fill="#0f172a"/>
      <path d="M32 8L37 16H27Z" fill="#f8fafc"/>
    </svg>
  `;

  return `
    <div class="${wrapperClass}">
      <div class="vehicle-rotator" style="transform: rotate(${Math.round(heading)}deg)">
        ${svg}
      </div>
    </div>
  `;
}

/* =====================================================
   OFFLINE TILES / SERVICE WORKER
===================================================== */

function preloadNearbyTiles(latlng) {
  if (!navigator.onLine) return;

  const zoom = Math.max(17, Math.min(19, state.map ? state.map.getZoom() : 18));
  const center = latLngToTile(latlng.lat, latlng.lng, zoom);
  const radius = 1;

  for (let dx = -radius; dx <= radius; dx += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      const x = center.x + dx;
      const y = center.y + dy;
      const url = `https://a.tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
      fetch(url, { mode: "no-cors" }).catch(() => {});
    }
  }
}

function latLngToTile(lat, lon, zoom) {
  const x = Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
  const y = Math.floor(
    ((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2) *
      Math.pow(2, zoom)
  );
  return { x, y };
}

function registerServiceWorkerInline() {
  if (!("serviceWorker" in navigator)) return;

  const swCode = `
    const APP_CACHE = "sammap-v7-app-cache";
    const TILE_CACHE = "sammap-v7-tile-cache";
    const APP_ASSETS = [
      "./",
      "./index.html",
      "./style.css",
      "./script.js",
      "./rodekors.png",
      "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
      "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
      "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js",
      "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"
    ];

    self.addEventListener("install", (event) => {
      event.waitUntil(
        caches.open(APP_CACHE).then((cache) => cache.addAll(APP_ASSETS)).catch(() => Promise.resolve())
      );
      self.skipWaiting();
    });

    self.addEventListener("activate", (event) => {
      event.waitUntil(
        caches.keys().then((keys) =>
          Promise.all(
            keys.filter((key) => ![APP_CACHE, TILE_CACHE].includes(key)).map((key) => caches.delete(key))
          )
        )
      );
      self.clients.claim();
    });

    self.addEventListener("fetch", (event) => {
      const req = event.request;
      if (req.method !== "GET") return;

      const url = new URL(req.url);
      const isTile = url.hostname.includes("tile.openstreetmap.org") || url.pathname.includes("/tile/");

      if (isTile) {
        event.respondWith(
          caches.open(TILE_CACHE).then(async (cache) => {
            const cached = await cache.match(req);
            if (cached) return cached;

            try {
              const fresh = await fetch(req);
              if (fresh && fresh.ok) {
                cache.put(req, fresh.clone());
              }
              return fresh;
            } catch (error) {
              return cached || Response.error();
            }
          })
        );
        return;
      }

      event.respondWith(
        caches.match(req).then(async (cached) => {
          if (cached) {
            fetch(req).then(async (fresh) => {
              if (!fresh || !fresh.ok) return;
              const cache = await caches.open(APP_CACHE);
              cache.put(req, fresh.clone());
            }).catch(() => {});
            return cached;
          }

          try {
            const fresh = await fetch(req);
            if (fresh && fresh.ok) {
              const cache = await caches.open(APP_CACHE);
              cache.put(req, fresh.clone());
            }
            return fresh;
          } catch (error) {
            return new Response("Offline", { status: 503, statusText: "Offline" });
          }
        })
      );
    });
  `;

  try {
    const blob = new Blob([swCode], { type: "text/javascript" });
    const swUrl = URL.createObjectURL(blob);
    navigator.serviceWorker.register(swUrl).catch((error) => {
      console.warn("Service worker registrering fejlede:", error);
    });
  } catch (error) {
    console.warn("Service worker kunne ikke oprettes:", error);
  }
}

/* =====================================================
   UTILS
===================================================== */

function sanitizeText(value) {
  return String(value || "").trim().replace(/[<>]/g, "");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function normalizeHeading(deg) {
  const value = Number(deg) || 0;
  return (value % 360 + 360) % 360;
}

function headingToCompass(deg) {
  const dirs = ["N", "NØ", "Ø", "SØ", "S", "SV", "V", "NV"];
  return dirs[Math.round(normalizeHeading(deg) / 45) % 8];
}

function calculateBearing(lat1, lon1, lat2, lon2) {
  const toRad = (v) => v * Math.PI / 180;
  const toDeg = (v) => v * 180 / Math.PI;

  const p1 = toRad(lat1);
  const p2 = toRad(lat2);
  const l1 = toRad(lon1);
  const l2 = toRad(lon2);

  const y = Math.sin(l2 - l1) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(l2 - l1);

  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function capitalize(value) {
  const str = String(value || "");
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function incidentTypeLabel(type) {
  if (type === "medical") return "🚑 Medicinsk";
  if (type === "fire") return "🔥 Brand";
  return "⚠️ Sikkerhed";
}