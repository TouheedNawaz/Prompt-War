/* ================================================================
   VenueIQ — Demo Data Simulator
   Generates realistic crowd fluctuations for the demo.
   Dispatches the same custom events as firebase.js so all
   UI modules work identically regardless of data source.
   ================================================================ */

const VenueSimulator = (() => {
  // Internal state
  let state = {};
  let intervalId = null;
  let tickCount = 0;
  let currentPhase = 'pre-match'; // pre-match | first-half | halftime | second-half | post-match

  // ── Initial Data ─────────────────────────────────────────────
  const INITIAL_STATE = {
    event: {
      name: 'Championship Finals 2026',
      venue: 'National Sports Arena',
      kickoff: '18:00',
      sport: 'Football',
      phase: 'pre-match',
    },

    'crowd-zones': {
      'north-stand':    { name: 'North Stand',    density: 0.55, capacity: 5000, current: 2750, trend: 'increasing' },
      'south-stand':    { name: 'South Stand',    density: 0.60, capacity: 5000, current: 3000, trend: 'increasing' },
      'east-concourse': { name: 'East Concourse', density: 0.45, capacity: 2000, current: 900,  trend: 'stable' },
      'west-concourse': { name: 'West Concourse', density: 0.30, capacity: 2000, current: 600,  trend: 'stable' },
      'main-gate':      { name: 'Main Gate',      density: 0.72, capacity: 1000, current: 720,  trend: 'increasing' },
      'food-court':     { name: 'Food Court',     density: 0.50, capacity: 1500, current: 750,  trend: 'stable' },
      'parking':        { name: 'Parking Area',   density: 0.65, capacity: 3000, current: 1950, trend: 'increasing' },
    },

    'wait-times': {
      'main-gate':       { name: 'Main Gate (A)',    icon: '🚪', minutes: 6,  trend: 'increasing' },
      'food-court':      { name: 'Food Court',       icon: '🍕', minutes: 5,  trend: 'stable' },
      'north-restrooms': { name: 'N. Restrooms',     icon: '🚻', minutes: 2,  trend: 'stable' },
      'merchandise':     { name: 'Merchandise',      icon: '🎽', minutes: 8,  trend: 'stable' },
      'parking-exit':    { name: 'Parking Exit',     icon: '🅿️', minutes: 4,  trend: 'stable' },
    },

    'alerts': [
      {
        id: 'alert-001',
        message: 'Gate B is temporarily closed. Please use Gate A, C, or D.',
        priority: 'warning',
        timestamp: Date.now(),
        active: true,
      },
    ],
  };

  // ── Phase Profiles ────────────────────────────────────────────
  // Each phase defines target densities for each zone
  const PHASE_PROFILES = {
    'pre-match': {
      'north-stand': 0.55, 'south-stand': 0.60, 'east-concourse': 0.45,
      'west-concourse': 0.30, 'main-gate': 0.72, 'food-court': 0.50, 'parking': 0.65,
      waitMultiplier: 1.0,
    },
    'first-half': {
      'north-stand': 0.92, 'south-stand': 0.95, 'east-concourse': 0.25,
      'west-concourse': 0.20, 'main-gate': 0.20, 'food-court': 0.30, 'parking': 0.85,
      waitMultiplier: 0.4,
    },
    'halftime': {
      'north-stand': 0.50, 'south-stand': 0.55, 'east-concourse': 0.88,
      'west-concourse': 0.70, 'main-gate': 0.30, 'food-court': 0.95, 'parking': 0.80,
      waitMultiplier: 2.5,
    },
    'second-half': {
      'north-stand': 0.94, 'south-stand': 0.96, 'east-concourse': 0.20,
      'west-concourse': 0.18, 'main-gate': 0.15, 'food-court': 0.25, 'parking': 0.82,
      waitMultiplier: 0.3,
    },
    'post-match': {
      'north-stand': 0.10, 'south-stand': 0.10, 'east-concourse': 0.75,
      'west-concourse': 0.68, 'main-gate': 0.85, 'food-court': 0.40, 'parking': 0.92,
      waitMultiplier: 3.5,
    },
  };

  // Base wait times (per-item, in minutes)
  const BASE_WAIT_TIMES = {
    'main-gate': 6, 'food-court': 5,
    'north-restrooms': 2, 'merchandise': 8, 'parking-exit': 4,
  };

  // ── Init ─────────────────────────────────────────────────────
  function init(useFirebase = false) {
    state = JSON.parse(JSON.stringify(INITIAL_STATE)); // deep clone
    currentPhase = 'pre-match';

    // If Firebase is connected, seed it
    if (useFirebase && typeof VenueFirebase !== 'undefined' && VenueFirebase.isConnected()) {
      VenueFirebase.seedInitialData(state);
    }

    // Immediately dispatch initial data
    _dispatchAll();

    // Start simulation tick every 8 seconds
    intervalId = setInterval(_tick, 8000);

    // Auto-advance phases for a realistic demo (every ~45 ticks = ~6 min)
    _schedulePhaseAdvance();

    console.info('[VenueSimulator] Started in', useFirebase ? 'Firebase' : 'local', 'mode');
  }

  // ── Tick — update values with random walk ─────────────────────
  function _tick() {
    tickCount++;
    const profile = PHASE_PROFILES[currentPhase];
    const crowdZones = state['crowd-zones'];
    const waitTimes  = state['wait-times'];

    // Update crowd zones: drift toward profile target + jitter
    Object.keys(crowdZones).forEach(key => {
      const target  = profile[key] ?? 0.5;
      const current = crowdZones[key].density;
      const jitter  = (Math.random() - 0.5) * 0.06;
      const drift   = (target - current) * 0.25;
      let newDensity = Math.max(0.05, Math.min(0.98, current + drift + jitter));

      const prevDensity = crowdZones[key].density;
      crowdZones[key].density = parseFloat(newDensity.toFixed(3));
      crowdZones[key].current = Math.round(newDensity * crowdZones[key].capacity);
      crowdZones[key].trend   = newDensity > prevDensity + 0.01 ? 'increasing'
                              : newDensity < prevDensity - 0.01 ? 'decreasing'
                              : 'stable';
    });

    // Update wait times
    Object.keys(waitTimes).forEach(key => {
      const base    = BASE_WAIT_TIMES[key] ?? 5;
      const mult    = profile.waitMultiplier;
      const jitter  = (Math.random() - 0.4) * 2;
      const newMins = Math.max(1, Math.round(base * mult + jitter));
      const prevMins = waitTimes[key].minutes;
      waitTimes[key].minutes = newMins;
      waitTimes[key].trend   = newMins > prevMins + 1 ? 'increasing'
                             : newMins < prevMins - 1 ? 'decreasing'
                             : 'stable';
    });

    _dispatchAll();

    // Optionally write to Firebase
    if (typeof VenueFirebase !== 'undefined' && VenueFirebase.isConnected()) {
      VenueFirebase.writeCrowdData(crowdZones, waitTimes);
    }
  }

  // ── Phase advance ─────────────────────────────────────────────
  const PHASE_ORDER = ['pre-match','first-half','halftime','second-half','post-match'];
  let phaseIndex = 0;

  function _schedulePhaseAdvance() {
    // Advance phase every 90 seconds for demo realism
    setTimeout(() => _nextPhase(), 90000);
  }

  function _nextPhase() {
    phaseIndex = (phaseIndex + 1) % PHASE_ORDER.length;
    currentPhase = PHASE_ORDER[phaseIndex];
    state.event.phase = currentPhase;

    // Announce halftime surge
    if (currentPhase === 'halftime') {
      _dispatchAlert({
        id: 'alert-halftime',
        message: 'Halftime! Food Court and Concourses are filling up fast. Plan your break now.',
        priority: 'info',
        timestamp: Date.now(),
        active: true,
      });
    }

    if (currentPhase === 'post-match') {
      _dispatchAlert({
        id: 'alert-post',
        message: 'Match ended! West Concourse exit recommended — expected 8 min parking wait.',
        priority: 'warning',
        timestamp: Date.now(),
        active: true,
      });
    }

    _dispatch('venueiq:event-update', state.event);
    console.info('[VenueSimulator] Phase advanced to:', currentPhase);

    if (phaseIndex < PHASE_ORDER.length - 1) {
      setTimeout(() => _nextPhase(), 90000);
    }
  }

  // ── Manual phase control (for UI buttons) ────────────────────
  function setPhase(phase) {
    if (!PHASE_PROFILES[phase]) return;
    currentPhase = phase;
    state.event.phase = phase;
    _dispatch('venueiq:event-update', state.event);
    _tick(); // immediate update
  }

  // ── Dispatch helpers ─────────────────────────────────────────
  function _dispatchAll() {
    _dispatch('venueiq:crowd-update',     state['crowd-zones']);
    _dispatch('venueiq:waittimes-update', state['wait-times']);
    _dispatch('venueiq:alerts-update',    state['alerts']);
    _dispatch('venueiq:event-update',     state.event);
  }

  function _dispatchAlert(alert) {
    state['alerts'] = state['alerts'].filter(a => a.id !== alert.id);
    state['alerts'].push(alert);
    _dispatch('venueiq:alerts-update', state['alerts']);
  }

  function _dispatch(eventName, detail) {
    document.dispatchEvent(new CustomEvent(eventName, { detail }));
  }

  // ── Public API ───────────────────────────────────────────────
  function getCurrentData() { return state; }

  function stop() {
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
  }

  return { init, stop, setPhase, getCurrentData };
})();
