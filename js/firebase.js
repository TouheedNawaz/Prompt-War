/* VenueIQ — Firebase Integration (Optional)
   Skipped entirely when DEMO_MODE is true — no SDK downloaded.
   When DEMO_MODE is false, dynamically loads Firebase SDK
   and connects to Realtime Database. */

const VenueFirebase = (() => {
  let db          = null;
  let initialized = false;

  // Dynamically inject a <script> tag and wait for it to load
  function _loadScript(src) {
    return new Promise((resolve, reject) => {
      const s   = document.createElement('script');
      s.src     = src;
      s.onload  = resolve;
      s.onerror = () => reject(new Error(`Failed to load: ${src}`));
      document.head.appendChild(s);
    });
  }

  // Initialize Firebase — async so SDK can be loaded on demand
  async function init() {
    if (!window.CONFIG) return false;

    if (window.CONFIG.DEMO_MODE !== false) {
      console.info('[VenueFirebase] Demo mode — SDK not loaded');
      return false;
    }

    const fbConfig = window.CONFIG.FIREBASE;
    if (!fbConfig?.databaseURL || fbConfig.databaseURL.includes('YOUR_')) {
      console.warn('[VenueFirebase] Config missing or placeholder — falling back to demo mode');
      return false;
    }

    // Only now do we download the Firebase SDK (~100 KB)
    try {
      await _loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
      await _loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-database-compat.js');
    } catch (err) {
      console.warn('[VenueFirebase] SDK load failed:', err.message);
      return false;
    }

    try {
      if (!firebase.apps.length) firebase.initializeApp(fbConfig);
      db          = firebase.database();
      initialized = true;
      console.info('[VenueFirebase] Connected to:', fbConfig.databaseURL);
      _attachListeners();
      return true;
    } catch (err) {
      console.error('[VenueFirebase] Init failed:', err);
      return false;
    }
  }

  // Attach Realtime Database listeners — each dispatches a custom DOM
  // event that heatmap.js and dashboard.js already listen to
  function _attachListeners() {
    if (!db) return;

    db.ref('/crowd-zones').on('value', snap => {
      const data = snap.val();
      if (data) _dispatch('venueiq:crowd-update', data);
    });

    db.ref('/wait-times').on('value', snap => {
      const data = snap.val();
      if (data) _dispatch('venueiq:waittimes-update', data);
    });

    db.ref('/alerts').on('value', snap => {
      const data = snap.val();
      const alertsArr = data
        ? Object.entries(data).map(([id, v]) => ({ id, ...v })).filter(a => a.active)
        : [];
      _dispatch('venueiq:alerts-update', alertsArr);
    });

    db.ref('/event').on('value', snap => {
      const data = snap.val();
      if (data) _dispatch('venueiq:event-update', data);
    });
  }

  // Seed the initial data structure into Firebase (called by simulator.js)
  function seedInitialData(data) {
    if (!db || !initialized) return;
    db.ref('/').set(data).catch(console.error);
  }

  // Write crowd+wait data batch (called by simulator on every tick)
  function writeCrowdData(crowdZones, waitTimes) {
    if (!db || !initialized) return;
    db.ref('/crowd-zones').set(crowdZones).catch(console.error);
    db.ref('/wait-times').set(waitTimes).catch(console.error);
  }

  function _dispatch(eventName, detail) {
    document.dispatchEvent(new CustomEvent(eventName, { detail }));
  }

  function isConnected() { return initialized; }

  return { init, seedInitialData, writeCrowdData, isConnected };
})();
