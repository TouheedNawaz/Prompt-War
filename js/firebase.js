/* ================================================================
   VenueIQ — Firebase Integration (Optional)
   When DEMO_MODE is true, this module is a no-op.
   When Firebase is configured, it listens to Realtime Database
   and dispatches the same custom events as the simulator.
   ================================================================ */

const VenueFirebase = (() => {
  let db = null;
  let initialized = false;

  /**
   * Initialize Firebase from CONFIG object (config.js).
   * Falls back gracefully if config is missing.
   */
  function init() {
    // If demo mode or no Firebase config → skip
    if (!window.CONFIG) {
      console.warn('[VenueIQ Firebase] No config found. Running in demo mode.');
      return false;
    }
    if (window.CONFIG.DEMO_MODE) {
      console.info('[VenueIQ Firebase] Demo mode active. Firebase not initialized.');
      return false;
    }

    const fbConfig = window.CONFIG.FIREBASE;
    if (!fbConfig || !fbConfig.databaseURL || fbConfig.databaseURL.includes('YOUR_')) {
      console.warn('[VenueIQ Firebase] Firebase config missing or placeholder. Falling back to demo mode.');
      return false;
    }

    try {
      firebase.initializeApp(fbConfig);
      db = firebase.database();
      initialized = true;
      console.info('[VenueIQ Firebase] Connected to:', fbConfig.databaseURL);
      _attachListeners();
      return true;
    } catch (e) {
      console.error('[VenueIQ Firebase] Init failed:', e);
      return false;
    }
  }

  /**
   * Attach Realtime Database listeners.
   * Each listener dispatches a custom DOM event that
   * UI modules (heatmap.js, dashboard.js) react to.
   */
  function _attachListeners() {
    if (!db) return;

    // Crowd zones
    db.ref('/crowd-zones').on('value', snap => {
      const data = snap.val();
      if (data) _dispatch('venueiq:crowd-update', data);
    });

    // Wait times
    db.ref('/wait-times').on('value', snap => {
      const data = snap.val();
      if (data) _dispatch('venueiq:waittimes-update', data);
    });

    // Alerts
    db.ref('/alerts').on('value', snap => {
      const data = snap.val();
      const alertsArr = data
        ? Object.entries(data)
            .map(([id, v]) => ({ id, ...v }))
            .filter(a => a.active)
        : [];
      _dispatch('venueiq:alerts-update', alertsArr);
    });

    // Event meta
    db.ref('/event').on('value', snap => {
      const data = snap.val();
      if (data) _dispatch('venueiq:event-update', data);
    });
  }

  /**
   * Write initial demo data structure to Firebase.
   * Called by simulator.js when Firebase is connected.
   */
  function seedInitialData(data) {
    if (!db || !initialized) return;
    db.ref('/').set(data).catch(console.error);
  }

  /**
   * Write a crowd-zones update batch (called by simulator in live mode).
   */
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
