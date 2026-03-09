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

const APP_VERSION = "v7-rf-ops";
const SESSION_KEY = `rf-session-${APP_VERSION}`;
const THEME_KEY = `rf-theme-${APP_VERSION}`;
const SETTINGS_KEY = `rf-settings-${APP_VERSION}`;

const FESTIVAL_CENTER = [55.6416, 12.0803];
const GPS_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 5000
};

const VEHICLE_STALE_MS = 2 * 60 * 1000;
const POSITION_UPLOAD_MIN_INTERVAL_MS = 1000;
const POSITION_UPLOAD_MIN_DISTANCE_M = 0;
const MAP_FALLBACK_ZOOM = 17;
const GPS_RESTART_THRESHOLD_MS = 12000;

/* =====================================================
   STATE
===================================================== */

const state = {
  session: null,
  settings: {
    theme: "theme-dark",
    fleetVisible: false,
    vehicleStatus: "ledig"
  },
  map: null,
  tileLayer: null,
  userMarker: null,
  targetMarker: null,
  targetLatLng: null,
  currentLatLng: null,
  currentSpeed: 0,
  currentHeading: 0,
  watchId: null,
  vehicleMarkers: new Map(),
  vehiclesData: {},
  eventMarkers: new Map(),
  eventsData: {},
  unsubscribeVehicles: null,
  unsubscribeDispatch: null,
  unsubscribeEvents: null,
  lastUploadAt: 0,
  lastUploadedLatLng: null,
  activeDispatchId: null,
  activeDispatchData: null,
  dispatchTargetId: null,
  dispatchTargetLabel: "",
  dispatcherSelectedLatLng: null,
  selectedEventId: null,
  userMovedMap: false,
  lastGoodAccuracy: null,
  lastPositionTime: 0,
  gpsRestartInterval: null,
  gpsFallbackAttemptAt: 0,
  pendingMapLatLng: null
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
  gpsStatus: document.getElementById("gpsStatus"),
  networkStatus: document.getElementById("networkStatus"),
  mapStatus: document.getElementById("mapStatus"),
  firebaseStatus: document.getElementById("firebaseStatus"),
  roleStatus: document.getElementById("roleStatus"),

  centerBtn: document.getElementById("centerBtn"),
  fullscreenBtn: document.getElementById("fullscreenBtn"),
  themeBtn: document.getElementById("themeBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  fleetToggleBtn: document.getElementById("fleetToggleBtn"),
  fleetPanel: document.getElementById("fleetPanel"),
  fleetList: document.getElementById("fleetList"),
  fleetCount: document.getElementById("fleetCount"),

  statusBtn: document.getElementById("statusBtn"),
  statusBtnText: document.getElementById("statusBtnText"),

  dispatcherStrip: document.getElementById("dispatcherStrip"),
  dispatcherVehicleCount: document.getElementById("dispatcherVehicleCount"),
  dispatcherAvailableCount: document.getElementById("dispatcherAvailableCount"),
  dispatcherEventCount: document.getElementById("dispatcherEventCount"),
  dispatcherLiveStatus: document.getElementById("dispatcherLiveStatus"),

  opsPanel: document.getElementById("opsPanel"),
  opsVehicleList: document.getElementById("opsVehicleList"),
  opsVehicleCount: document.getElementById("opsVehicleCount"),
  dispatcherEventsList: document.getElementById("dispatcherEventsList"),
  opsEventCount: document.getElementById("opsEventCount"),
  nearestVehicleSuggestion: document.getElementById("nearestVehicleSuggestion"),

  mapLoading: document.getElementById("mapLoading"),
  mapLoadingText: document.getElementById("mapLoadingText"),
  mapError: document.getElementById("mapError"),
  mapErrorText: document.getElementById("mapErrorText"),
  retryMapBtn: document.getElementById("retryMapBtn"),

  dispatchModal: document.getElementById("dispatchModal"),
  dispatchForm: document.getElementById("dispatchForm"),
  dispatchTargetInput: document.getElementById("dispatchTargetInput"),
  dispatchMessageInput: document.getElementById("dispatchMessageInput"),
  dispatchDestinationInput: document.getElementById("dispatchDestinationInput"),
  dispatchAttachWaypointInput: document.getElementById("dispatchAttachWaypointInput"),
  closeDispatchModalBtn: document.getElementById("closeDispatchModalBtn"),
  cancelDispatchBtn: document.getElementById("cancelDispatchBtn"),

  waypointChoiceModal: document.getElementById("waypointChoiceModal"),
  closeWaypointChoiceModalBtn: document.getElementById("closeWaypointChoiceModalBtn"),
  quickWaypointBtn: document.getElementById("quickWaypointBtn"),
  openEventModalBtn: document.getElementById("openEventModalBtn"),

  eventModal: document.getElementById("eventModal"),
  eventForm: document.getElementById("eventForm"),
  eventDescriptionInput: document.getElementById("eventDescriptionInput"),
  closeEventModalBtn: document.getElementById("closeEventModalBtn"),
  cancelEventBtn: document.getElementById("cancelEventBtn"),

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
  initFirebaseStatus();
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
  els.logoutBtn.addEventListener("click", logout);
  els.fleetToggleBtn.addEventListener("click", toggleFleetPanel);
  els.retryMapBtn.addEventListener("click", retryMapInitialization);
  els.statusBtn.addEventListener("click", toggleVehicleStatus);

  els.closeDispatchModalBtn.addEventListener("click", closeDispatchModal);
  els.cancelDispatchBtn.addEventListener("click", closeDispatchModal);
  els.dispatchForm.addEventListener("submit", submitDispatchMessage);

  els.closeWaypointChoiceModalBtn.addEventListener("click", closeWaypointChoiceModal);
  els.quickWaypointBtn.addEventListener("click", createQuickWaypointFromPending);
  els.openEventModalBtn.addEventListener("click", openEventModalFromPending);

  els.closeEventModalBtn.addEventListener("click", closeEventModal);
  els.cancelEventBtn.addEventListener("click", closeEventModal);
  els.eventForm.addEventListener("submit", submitEvent);

  els.closeIncomingDispatchBtn.addEventListener("click", closeIncomingDispatch);
  els.applyIncomingWaypointBtn.addEventListener("click", applyIncomingWaypoint);

  [els.dispatchModal, els.waypointChoiceModal, els.eventModal].forEach((modal) => {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        modal.classList.add("hidden");
      }
    });
  });
}

function initFirebaseStatus() {
  setFirebaseStatus("Firebase klar", "ok");
}

function restoreTheme() {
  const saved = localStorage.getItem(THEME_KEY) || "theme-dark";
  els.body.classList.remove("theme-dark", "theme-light");
  els.body.classList.add(saved);
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

function updateNetworkStatus() {
  const online = navigator.onLine;
  els.networkStatus.textContent = online ? "Online" : "Offline";
  els.networkStatus.className = "status-pill muted";
  if (!online) els.networkStatus.classList.add("warn");
  els.dispatcherLiveStatus.textContent = online ? "Live" : "Offline";
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
  els.identityText.textContent = `Hold ${state.session.hold} · Køretøj ${state.session.vehicle}`;
  els.roleStatus.textContent = state.session.isDispatcher ? "Dispatcher" : "Køretøj";
  els.roleStatus.className = "status-pill muted";

  els.body.classList.toggle("dispatcher-mode", Boolean(state.session.isDispatcher));
  els.dispatcherStrip.classList.toggle("visible", Boolean(state.session.isDispatcher));
  els.opsPanel.classList.toggle("hidden", !state.session.isDispatcher);

  if (state.session.isDispatcher) {
    els.roleStatus.classList.add("ok");
    state.settings.fleetVisible = true;
    setGPSStatus("Dispatcher mode", "ok");
  }

  syncStatusButton();
  syncFleetPanel();

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
  }

  uploadPosition();
}

async function logout() {
  await deleteMyVehicleFromFirebase();

  stopGPS();
  stopGPSHealthWatch();

  if (state.unsubscribeVehicles) {
    state.unsubscribeVehicles();
    state.unsubscribeVehicles = null;
  }

  if (state.unsubscribeDispatch) {
    state.unsubscribeDispatch();
    state.unsubscribeDispatch = null;
  }

  if (state.unsubscribeEvents) {
    state.unsubscribeEvents();
    state.unsubscribeEvents = null;
  }

  state.vehicleMarkers.forEach((marker) => {
    if (state.map) state.map.removeLayer(marker);
  });

  state.eventMarkers.forEach((marker) => {
    if (state.map) state.map.removeLayer(marker);
  });

  state.vehicleMarkers.clear();
  state.eventMarkers.clear();
  state.vehiclesData = {};
  state.eventsData = {};
  state.currentLatLng = null;
  state.targetLatLng = null;
  state.dispatcherSelectedLatLng = null;
  state.selectedEventId = null;
  state.activeDispatchId = null;
  state.activeDispatchData = null;
  state.lastUploadedLatLng = null;
  state.lastUploadAt = 0;
  state.userMovedMap = false;
  state.lastPositionTime = 0;
  state.pendingMapLatLng = null;

  clearWaypoint();
  hideIncomingDispatch();
  renderFleetList();
  renderEventsList();
  updateNearestSuggestion(null);

  localStorage.removeItem(SESSION_KEY);
  state.session = null;

  els.loginForm.reset();
  els.loginScreen.classList.remove("hidden");
  els.mainScreen.classList.add("hidden");
  els.body.classList.remove("dispatcher-mode");
  setGPSStatus("Venter på GPS", "");
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
      openWaypointChoiceModal(event.latlng);
    });

    state.map.on("dragstart", () => {
      state.userMovedMap = true;
      state.dispatcherSelectedLatLng = null;
    });

    state.map.on("zoomstart", () => {
      state.userMovedMap = true;
      state.dispatcherSelectedLatLng = null;
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

function openWaypointChoiceModal(latlng) {
  state.pendingMapLatLng = latlng;
  els.waypointChoiceModal.classList.remove("hidden");
}

function closeWaypointChoiceModal() {
  state.pendingMapLatLng = null;
  els.waypointChoiceModal.classList.add("hidden");
}

function createQuickWaypointFromPending() {
  if (!state.pendingMapLatLng) return;
  setWaypoint(state.pendingMapLatLng);
  closeWaypointChoiceModal();
}

function openEventModalFromPending() {
  if (!state.pendingMapLatLng) return;
  els.waypointChoiceModal.classList.add("hidden");
  els.eventDescriptionInput.value = "";
  els.eventModal.classList.remove("hidden");
}

function closeEventModal() {
  state.pendingMapLatLng = null;
  els.eventModal.classList.add("hidden");
}

function setWaypoint(latlng) {
  if (!state.map) return;

  state.targetLatLng = latlng;

  const icon = L.divIcon({
    className: "",
    html: `<div class="quick-waypoint-marker"></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13]
  });

  if (!state.targetMarker) {
    state.targetMarker = L.marker(latlng, { icon }).addTo(state.map);
    state.targetMarker.on("click", (event) => {
      if (event.originalEvent) {
        L.DomEvent.stopPropagation(event);
      }
      openQuickWaypointPopup();
    });
  } else {
    state.targetMarker.setLatLng(latlng);
    state.targetMarker.setIcon(icon);
  }

  openQuickWaypointPopup();
}

function openQuickWaypointPopup() {
  if (!state.targetMarker || !state.targetLatLng) return;

  state.targetMarker.bindPopup(`
    <strong>Hurtigt waypoint</strong><br>
    Lat: ${state.targetLatLng.lat.toFixed(5)}<br>
    Lon: ${state.targetLatLng.lng.toFixed(5)}
    <div class="popup-actions">
      <button class="popup-btn" data-popup-action="clearWaypoint">Fjern waypoint</button>
    </div>
  `).openPopup();
}

function clearWaypoint() {
  if (state.targetMarker && state.map) {
    state.map.removeLayer(state.targetMarker);
  }

  state.targetMarker = null;
  state.targetLatLng = null;
}

function centerMapOnContext() {
  state.userMovedMap = false;

  if (!state.map) return;

  if (state.session?.isDispatcher && state.dispatcherSelectedLatLng) {
    state.map.setView(state.dispatcherSelectedLatLng, Math.max(state.map.getZoom(), 19), { animate: true });
    return;
  }

  if (state.currentLatLng) {
    state.map.setView(state.currentLatLng, Math.max(state.map.getZoom(), 18), { animate: true });
    return;
  }

  if (state.selectedEventId && state.eventsData[state.selectedEventId]) {
    const event = state.eventsData[state.selectedEventId];
    state.map.setView([event.lat, event.lon], Math.max(state.map.getZoom(), 18), { animate: true });
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

  updateUserMarker();
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

function updateUserMarker() {
  if (!state.map || !state.currentLatLng) return;

  const icon = L.divIcon({
    className: "",
    html: createVehicleMarkerHTML(state.currentHeading, true, state.settings.vehicleStatus),
    iconSize: [54, 54],
    iconAnchor: [27, 27]
  });

  if (!state.userMarker) {
    state.userMarker = L.marker(state.currentLatLng, {
      icon,
      zIndexOffset: 1000
    }).addTo(state.map);

    state.userMarker.bindPopup(() => `
      <strong>Eget køretøj</strong><br>
      Hold: ${escapeHtml(state.session.hold)}<br>
      Køretøj: ${escapeHtml(state.session.vehicle)}<br>
      Status: ${escapeHtml(capitalizeStatus(state.settings.vehicleStatus))}
    `);
  } else {
    state.userMarker.setLatLng(state.currentLatLng);
    state.userMarker.setIcon(icon);
  }
}

function createVehicleMarkerHTML(heading = 0, isPrimary = false, status = "ledig") {
  const wrapperClass = isPrimary ? "vehicle-marker" : "other-vehicle-marker";
  const size = isPrimary ? 54 : 42;
  const primaryColorA = status === "optaget" ? "#ef4444" : "#22c55e";
  const primaryColorB = status === "optaget" ? "#b91c1c" : "#15803d";
  const secondaryColorA = status === "optaget" ? "#f97316" : "#38bdf8";
  const secondaryColorB = status === "optaget" ? "#dc2626" : "#0ea5e9";
  const colorA = isPrimary ? primaryColorA : secondaryColorA;
  const colorB = isPrimary ? primaryColorB : secondaryColorB;
  const gradientId = `rfVehicle${isPrimary ? "A" : "B"}${status}`;

  const svg = `
    <svg viewBox="0 0 64 64" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="${gradientId}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${colorA}"/>
          <stop offset="100%" stop-color="${colorB}"/>
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="28" fill="url(#${gradientId})" stroke="white" stroke-width="3"/>
      <path d="M18 36L21 26C22 23 24 21 27 21H40C43 21 45 23 46 26L48 32H51C53 32 54 33 54 35V41C54 43 53 44 51 44H49C49 47 47 49 44 49C41 49 39 47 39 44H25C25 47 23 49 20 49C17 49 15 47 15 44H13C11 44 10 43 10 41V37C10 34 12 32 15 32H17L18 36Z" fill="white"/>
      <rect x="28" y="25" width="10" height="10" rx="1.5" fill="${isPrimary ? "#111827" : "#0284c7"}"/>
      <rect x="31.5" y="22" width="3" height="16" fill="white"/>
      <rect x="25" y="28.5" width="16" height="3" fill="white"/>
      <rect x="18" y="34" width="10" height="5" rx="1" fill="#cbd5e1"/>
      <rect x="39" y="34" width="10" height="5" rx="1" fill="#cbd5e1"/>
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
   VEHICLE STATUS
===================================================== */

function toggleVehicleStatus() {
  if (state.session?.isDispatcher) return;

  state.settings.vehicleStatus = state.settings.vehicleStatus === "ledig" ? "optaget" : "ledig";
  saveSettings();
  syncStatusButton();
  updateUserMarker();
  uploadPosition();
}

function syncStatusButton() {
  const status = state.settings.vehicleStatus || "ledig";
  els.statusBtn.classList.remove("status-ledig", "status-optaget");
  els.statusBtn.classList.add(status === "optaget" ? "status-optaget" : "status-ledig");
  els.statusBtnText.textContent = status === "optaget" ? "Optaget" : "Ledig";
  els.statusBtn.disabled = Boolean(state.session?.isDispatcher);

  if (state.session?.isDispatcher) {
    els.statusBtnText.textContent = "Kontor";
  }
}

/* =====================================================
   FIREBASE VEHICLES
===================================================== */

async function uploadPosition() {
  if (!state.session || state.session.isDispatcher || !state.currentLatLng) return;

  const now = Date.now();
  const distanceSinceLastUpload = state.lastUploadedLatLng
    ? state.currentLatLng.distanceTo(state.lastUploadedLatLng)
    : Infinity;

  const dueByTime = now - state.lastUploadAt >= POSITION_UPLOAD_MIN_INTERVAL_MS;
  const dueByDistance = distanceSinceLastUpload >= POSITION_UPLOAD_MIN_DISTANCE_M;

  if (!dueByTime && !dueByDistance) return;

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
      status: state.settings.vehicleStatus || "ledig",
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
  subscribeEvents();
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

        freshVehicles[doc.id] = {
          ...data,
          status: data.status === "optaget" ? "optaget" : "ledig"
        };

        if (doc.id === state.session?.id) return;

        seen.add(doc.id);
        renderOtherVehicleMarker(doc.id, freshVehicles[doc.id]);
      });

      state.vehiclesData = freshVehicles;

      Array.from(state.vehicleMarkers.keys()).forEach((id) => {
        if (!seen.has(id)) {
          const marker = state.vehicleMarkers.get(id);
          if (state.map && marker) {
            state.map.removeLayer(marker);
          }
          state.vehicleMarkers.delete(id);
        }
      });

      renderFleetList();
      renderOpsVehicleList();
      updateDispatcherCounts();

      if (state.selectedEventId) {
        updateNearestSuggestion(state.selectedEventId);
      }
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
    iconSize: [42, 42],
    iconAnchor: [21, 21]
  });

  const popupHtml = `
    <strong>Hold ${escapeHtml(vehicle.hold || "-")} · ${escapeHtml(vehicle.vehicle || "-")}</strong><br>
    Status: ${escapeHtml(capitalizeStatus(vehicle.status || "ledig"))}<br>
    Hastighed: ${escapeHtml(String(vehicle.speed || 0))} km/t<br>
    Retning: ${escapeHtml(headingToCompass(vehicle.heading || 0))}
  `;

  if (!state.vehicleMarkers.has(id)) {
    const marker = L.marker(latlng, { icon }).addTo(state.map);
    marker.bindPopup(popupHtml);
    state.vehicleMarkers.set(id, marker);
  } else {
    const marker = state.vehicleMarkers.get(id);
    marker.setLatLng(latlng);
    marker.setIcon(icon);
    marker.bindPopup(popupHtml);
  }
}

function renderFleetList() {
  const rows = getVehicleRows();

  els.fleetCount.textContent = String(rows.length);

  if (!rows.length) {
    els.fleetList.innerHTML = `
      <div class="fleet-item">
        <div class="fleet-item-main">
          <div class="fleet-item-title">Ingen andre aktive køretøjer</div>
          <div class="fleet-item-meta">Når andre logger ind, vises de her</div>
        </div>
      </div>
    `;
    return;
  }

  els.fleetList.innerHTML = rows.map((row) => `
    <div class="fleet-item">
      <div class="fleet-item-main" data-lat="${row.lat}" data-lon="${row.lon}">
        <div class="fleet-item-title">Hold ${escapeHtml(row.hold)} · ${escapeHtml(row.vehicle)}</div>
        <div class="fleet-item-meta">${row.speed} km/t · ${headingToCompass(row.heading)} · ${escapeHtml(capitalizeStatus(row.status))}</div>
        <div class="status-badge ${escapeHtml(row.status)}">${escapeHtml(capitalizeStatus(row.status))}</div>
      </div>
      <button class="center-vehicle-btn" data-lat="${row.lat}" data-lon="${row.lon}" title="Center på køretøj">◎</button>
      <button class="dispatch-btn" data-target-id="${escapeHtml(row.id)}" data-target-label="Hold ${escapeHtml(row.hold)} · ${escapeHtml(row.vehicle)}" title="Send melding">📩</button>
    </div>
  `).join("");

  bindVehicleListEvents(els.fleetList);
}

function renderOpsVehicleList() {
  const rows = getVehicleRows();
  els.opsVehicleCount.textContent = String(rows.length);

  if (!rows.length) {
    els.opsVehicleList.innerHTML = `<div class="ops-empty">Ingen aktive køretøjer.</div>`;
    return;
  }

  els.opsVehicleList.innerHTML = rows.map((row) => `
    <div class="ops-item">
      <div class="ops-item-main" data-lat="${row.lat}" data-lon="${row.lon}">
        <div class="ops-item-title">Hold ${escapeHtml(row.hold)} · ${escapeHtml(row.vehicle)}</div>
        <div class="ops-item-meta">${row.speed} km/t · ${headingToCompass(row.heading)}</div>
        <div class="status-badge ${escapeHtml(row.status)}">${escapeHtml(capitalizeStatus(row.status))}</div>
      </div>
      <div class="button-row">
        <button class="center-vehicle-btn" data-lat="${row.lat}" data-lon="${row.lon}" title="Center">◎</button>
        <button class="dispatch-btn" data-target-id="${escapeHtml(row.id)}" data-target-label="Hold ${escapeHtml(row.hold)} · ${escapeHtml(row.vehicle)}" title="Send melding">📩</button>
      </div>
    </div>
  `).join("");

  bindVehicleListEvents(els.opsVehicleList);
}

function bindVehicleListEvents(container) {
  container.querySelectorAll(".fleet-item-main, .ops-item-main, .center-vehicle-btn").forEach((element) => {
    element.addEventListener("click", () => {
      const lat = Number(element.dataset.lat);
      const lon = Number(element.dataset.lon);
      if (!Number.isNaN(lat) && !Number.isNaN(lon) && state.map) {
        state.dispatcherSelectedLatLng = L.latLng(lat, lon);
        state.map.setView(state.dispatcherSelectedLatLng, Math.max(state.map.getZoom(), 19), { animate: true });
      }
    });
  });

  container.querySelectorAll(".dispatch-btn").forEach((button) => {
    button.addEventListener("click", () => {
      openDispatchModal(button.dataset.targetId, button.dataset.targetLabel);
    });
  });
}

function getVehicleRows() {
  const rows = Object.entries(state.vehiclesData)
    .filter(([id]) => id !== state.session?.id)
    .map(([id, vehicle]) => ({
      id,
      hold: vehicle.hold || "-",
      vehicle: vehicle.vehicle || "-",
      speed: vehicle.speed || 0,
      heading: vehicle.heading || 0,
      lat: vehicle.lat,
      lon: vehicle.lon,
      status: vehicle.status || "ledig"
    }));

  rows.sort((a, b) => {
    const aLabel = `${a.hold}-${a.vehicle}`;
    const bLabel = `${b.hold}-${b.vehicle}`;
    return aLabel.localeCompare(bLabel, "da");
  });

  return rows;
}

/* =====================================================
   EVENTS
===================================================== */

function subscribeEvents() {
  if (state.unsubscribeEvents) {
    state.unsubscribeEvents();
  }

  state.unsubscribeEvents = db.collection("events").onSnapshot(
    (snapshot) => {
      const seen = new Set();
      const freshEvents = {};

      snapshot.forEach((doc) => {
        const data = doc.data();
        if (!data) return;

        freshEvents[doc.id] = data;
        seen.add(doc.id);
        renderEventMarker(doc.id, data);
      });

      state.eventsData = freshEvents;

      Array.from(state.eventMarkers.keys()).forEach((id) => {
        if (!seen.has(id)) {
          const marker = state.eventMarkers.get(id);
          if (state.map && marker) {
            state.map.removeLayer(marker);
          }
          state.eventMarkers.delete(id);
        }
      });

      renderEventsList();
      updateDispatcherCounts();

      if (state.selectedEventId && !state.eventsData[state.selectedEventId]) {
        state.selectedEventId = null;
        updateNearestSuggestion(null);
      } else if (state.selectedEventId) {
        updateNearestSuggestion(state.selectedEventId);
      }
    },
    (error) => {
      console.error("Events listener fejl:", error);
    }
  );
}

async function submitEvent(event) {
  event.preventDefault();

  const description = sanitizeText(els.eventDescriptionInput.value);
  if (!description || !state.pendingMapLatLng || !state.session) return;

  try {
    await db.collection("events").add({
      lat: state.pendingMapLatLng.lat,
      lon: state.pendingMapLatLng.lng,
      description,
      createdBy: `Hold ${state.session.hold} · ${state.session.vehicle}`,
      createdById: state.session.id,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    closeEventModal();
  } catch (error) {
    console.error("Kunne ikke gemme hændelse:", error);
    alert("Kunne ikke gemme hændelse.");
  }
}

function renderEventMarker(id, eventData) {
  if (!state.map || !isFinite(eventData.lat) || !isFinite(eventData.lon)) return;

  const latlng = L.latLng(eventData.lat, eventData.lon);
  const icon = L.divIcon({
    className: "",
    html: `<div class="event-marker"><div class="event-pin">!</div></div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22]
  });

  const popupHtml = `
    <strong>🚑 Hændelse</strong><br>
    ${escapeHtml(eventData.description || "-")}<br>
    Oprettet af: ${escapeHtml(eventData.createdBy || "-")}
    <div class="popup-actions">
      <button class="popup-btn" data-popup-action="selectEvent" data-event-id="${escapeHtml(id)}">Vælg</button>
      <button class="popup-btn" data-popup-action="deleteEvent" data-event-id="${escapeHtml(id)}">Fjern</button>
    </div>
  `;

  if (!state.eventMarkers.has(id)) {
    const marker = L.marker(latlng, { icon }).addTo(state.map);
    marker.bindPopup(popupHtml);
    marker.on("click", () => {
      selectEvent(id);
    });
    state.eventMarkers.set(id, marker);
  } else {
    const marker = state.eventMarkers.get(id);
    marker.setLatLng(latlng);
    marker.setIcon(icon);
    marker.bindPopup(popupHtml);
  }
}

function renderEventsList() {
  const rows = Object.entries(state.eventsData)
    .map(([id, eventData]) => ({
      id,
      description: eventData.description || "-",
      lat: eventData.lat,
      lon: eventData.lon,
      createdBy: eventData.createdBy || "-"
    }))
    .sort((a, b) => a.description.localeCompare(b.description, "da"));

  els.dispatcherEventCount.textContent = String(rows.length);
  els.opsEventCount.textContent = String(rows.length);

  if (!rows.length) {
    els.dispatcherEventsList.innerHTML = `<div class="ops-empty">Ingen hændelser lige nu.</div>`;
    return;
  }

  els.dispatcherEventsList.innerHTML = rows.map((row) => `
    <div class="ops-item">
      <div class="ops-item-main" data-event-id="${escapeHtml(row.id)}">
        <div class="ops-item-title">${escapeHtml(row.description)}</div>
        <div class="ops-item-meta">${escapeHtml(row.createdBy)}</div>
      </div>
      <div class="button-row">
        <button class="select-event-btn" data-event-id="${escapeHtml(row.id)}" title="Vælg hændelse">◎</button>
        <button class="delete-event-btn" data-event-id="${escapeHtml(row.id)}" title="Fjern hændelse">🗑</button>
      </div>
    </div>
  `).join("");

  els.dispatcherEventsList.querySelectorAll(".ops-item-main, .select-event-btn").forEach((element) => {
    element.addEventListener("click", () => {
      selectEvent(element.dataset.eventId);
    });
  });

  els.dispatcherEventsList.querySelectorAll(".delete-event-btn").forEach((button) => {
    button.addEventListener("click", () => {
      deleteEvent(button.dataset.eventId);
    });
  });
}

function selectEvent(eventId) {
  const eventData = state.eventsData[eventId];
  if (!eventData || !state.map) return;

  state.selectedEventId = eventId;
  state.dispatcherSelectedLatLng = L.latLng(eventData.lat, eventData.lon);
  state.map.setView(state.dispatcherSelectedLatLng, Math.max(state.map.getZoom(), 18), { animate: true });
  updateNearestSuggestion(eventId);

  const marker = state.eventMarkers.get(eventId);
  if (marker) {
    marker.openPopup();
  }
}

async function deleteEvent(eventId) {
  if (!eventId) return;

  try {
    await db.collection("events").doc(eventId).delete();
  } catch (error) {
    console.error("Kunne ikke slette hændelse:", error);
    alert("Kunne ikke slette hændelse.");
  }
}

function updateNearestSuggestion(eventId) {
  if (!eventId || !state.eventsData[eventId]) {
    els.nearestVehicleSuggestion.textContent = "Vælg en hændelse for at få forslag til nærmeste ledige køretøj.";
    return;
  }

  const eventData = state.eventsData[eventId];
  const target = L.latLng(eventData.lat, eventData.lon);

  const availableVehicles = Object.entries(state.vehiclesData)
    .filter(([id, vehicle]) => id !== state.session?.id && vehicle.status !== "optaget" && isFinite(vehicle.lat) && isFinite(vehicle.lon))
    .map(([id, vehicle]) => ({
      id,
      label: `Hold ${vehicle.hold || "-"} · ${vehicle.vehicle || "-"}`,
      latlng: L.latLng(vehicle.lat, vehicle.lon),
      status: vehicle.status || "ledig"
    }));

  if (!availableVehicles.length) {
    els.nearestVehicleSuggestion.innerHTML = `
      <strong>Ingen ledige køretøjer</strong><br>
      Alle køretøjer er enten optaget eller offline.
    `;
    return;
  }

  let best = null;

  availableVehicles.forEach((vehicle) => {
    const distance = Math.round(vehicle.latlng.distanceTo(target));
    if (!best || distance < best.distance) {
      best = {
        ...vehicle,
        distance
      };
    }
  });

  els.nearestVehicleSuggestion.innerHTML = `
    <strong>Forslag:</strong><br>
    Send ${escapeHtml(best.label)}<br>
    Afstand: ${best.distance} meter
    <div class="button-row">
      <button class="suggest-dispatch-btn" id="suggestDispatchBtn" type="button">Åbn melding</button>
    </div>
  `;

  const suggestBtn = document.getElementById("suggestDispatchBtn");
  if (suggestBtn) {
    suggestBtn.addEventListener("click", () => {
      openDispatchModal(best.id, best.label);
    });
  }
}

function updateDispatcherCounts() {
  const allVehicles = Object.keys(state.vehiclesData).filter((id) => id !== state.session?.id).length;
  const availableVehicles = Object.entries(state.vehiclesData)
    .filter(([id, vehicle]) => id !== state.session?.id && vehicle.status !== "optaget")
    .length;

  els.dispatcherVehicleCount.textContent = String(allVehicles);
  els.dispatcherAvailableCount.textContent = String(availableVehicles);
  els.dispatcherEventCount.textContent = String(Object.keys(state.eventsData).length);
}

/* =====================================================
   DISPATCH
===================================================== */

function openDispatchModal(targetId, label) {
  state.dispatchTargetId = targetId;
  state.dispatchTargetLabel = label || targetId;
  els.dispatchTargetInput.value = state.dispatchTargetLabel;
  els.dispatchMessageInput.value = "";
  els.dispatchDestinationInput.value = "";
  els.dispatchAttachWaypointInput.checked = Boolean(state.targetLatLng || state.selectedEventId);
  els.dispatchAttachWaypointInput.disabled = !state.targetLatLng && !state.selectedEventId;
  els.dispatchModal.classList.remove("hidden");
}

function closeDispatchModal() {
  state.dispatchTargetId = null;
  state.dispatchTargetLabel = "";
  els.dispatchModal.classList.add("hidden");
}

async function submitDispatchMessage(event) {
  event.preventDefault();

  if (!state.session || !state.dispatchTargetId) return;

  const message = sanitizeText(els.dispatchMessageInput.value);
  const destination = sanitizeText(els.dispatchDestinationInput.value);

  const activeWaypoint =
    state.selectedEventId && state.eventsData[state.selectedEventId]
      ? { lat: state.eventsData[state.selectedEventId].lat, lon: state.eventsData[state.selectedEventId].lon }
      : state.targetLatLng
        ? { lat: state.targetLatLng.lat, lon: state.targetLatLng.lng }
        : null;

  const attachWaypoint = Boolean(els.dispatchAttachWaypointInput.checked && activeWaypoint);

  if (!message) return;

  const payload = {
    targetVehicle: state.dispatchTargetId,
    fromVehicle: state.session.id,
    fromLabel: `Hold ${state.session.hold} · ${state.session.vehicle}`,
    message,
    destination,
    status: "open",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  if (attachWaypoint && activeWaypoint) {
    payload.waypoint = activeWaypoint;
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
        if (snapshot.empty) {
          hideIncomingDispatch();
          return;
        }

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
   UI
===================================================== */

function toggleFleetPanel() {
  state.settings.fleetVisible = !state.settings.fleetVisible;
  syncFleetPanel();
  saveSettings();
}

function syncFleetPanel() {
  const shouldShow = state.session?.isDispatcher ? !els.body.classList.contains("dispatcher-mode") || window.innerWidth <= 900 : state.settings.fleetVisible;
  els.fleetPanel.classList.toggle("hidden", !shouldShow);
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
  if (state.session?.isDispatcher) {
    els.body.classList.add("dispatcher-mode");
  }
  localStorage.setItem(THEME_KEY, next);
  state.settings.theme = next;
  saveSettings();
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

document.addEventListener("click", (event) => {
  const action = event.target?.dataset?.popupAction;
  const eventId = event.target?.dataset?.eventId;

  if (action === "clearWaypoint") {
    clearWaypoint();
  }

  if (action === "deleteEvent" && eventId) {
    deleteEvent(eventId);
  }

  if (action === "selectEvent" && eventId) {
    selectEvent(eventId);
  }
});

/* =====================================================
   OFFLINE TILE PRELOAD
===================================================== */

function preloadNearbyTiles(latlng) {
  if (!navigator.onLine || !state.map) return;

  const zoom = Math.max(17, Math.min(19, state.map.getZoom()));
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

/* =====================================================
   SERVICE WORKER INLINE
===================================================== */

function registerServiceWorkerInline() {
  if (!("serviceWorker" in navigator)) return;

  const swCode = `
    const APP_CACHE = "rf-v7-app-cache";
    const TILE_CACHE = "rf-v7-tile-cache";
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
            keys
              .filter((key) => ![APP_CACHE, TILE_CACHE].includes(key))
              .map((key) => caches.delete(key))
          )
        )
      );
      self.clients.claim();
    });

    self.addEventListener("fetch", (event) => {
      const req = event.request;
      if (req.method !== "GET") return;

      const url = new URL(req.url);
      const isTile =
        url.hostname.includes("tile.openstreetmap.org") ||
        url.pathname.includes("/tile/");

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

function capitalizeStatus(status) {
  return status === "optaget" ? "Optaget" : "Ledig";
}