/* ================================================================
   VenueIQ — Demo Data Simulator (IPL 2026 Edition)
   Simulates realistic crowd flow across 5 cricket match phases.
   ================================================================ */

const VenueSimulator = (() => {
  let state = {};
  let intervalId = null;
  let tickCount = 0;
  let currentPhase = 'pre-match'; // pre-match | first-innings | drinks-break | second-innings | post-match

  // ── Initial Data ─────────────────────────────────────────────
  const INITIAL_STATE = {
    event: {
      name: 'IPL 2026 — MI vs CSK',
      venue: 'Wankhede Stadium',
      kickoff: '19:30 IST',
      sport: 'Cricket',
      teams: 'Mumbai Indians vs Chennai Super Kings',
      phase: 'pre-match',
    },

    'crowd-zones': {
      'north-stand':    { name: 'Garware Pavilion (N)',   density: 0.55, capacity: 8000, current: 4400,  trend: 'increasing' },
      'south-stand':    { name: 'S. Tendulkar Stand (S)', density: 0.60, capacity: 8000, current: 4800,  trend: 'increasing' },
      'east-concourse': { name: 'S. Gavaskar Stand (E)',  density: 0.45, capacity: 5000, current: 2250,  trend: 'stable' },
      'west-concourse': { name: 'V. Merchant Stand (W)',  density: 0.30, capacity: 5000, current: 1500,  trend: 'stable' },
      'main-gate':      { name: 'Gate 1 (North)',          density: 0.72, capacity: 2000, current: 1440,  trend: 'increasing' },
      'food-court':     { name: 'Food Court',              density: 0.50, capacity: 2500, current: 1250,  trend: 'stable' },
      'parking':        { name: 'Parking Area',            density: 0.65, capacity: 5000, current: 3250,  trend: 'increasing' },
    },

    'wait-times': {
      'main-gate':       { name: 'Gate 1 Entry',       icon: '🚪', minutes: 6,  trend: 'increasing' },
      'food-court':      { name: 'Food Court',         icon: '🍛', minutes: 5,  trend: 'stable' },
      'north-restrooms': { name: 'N. Restrooms',       icon: '🚻', minutes: 2,  trend: 'stable' },
      'merchandise':     { name: 'MI/CSK Merchandise', icon: '🏏', minutes: 10, trend: 'stable' },
      'parking-exit':    { name: 'Parking Exit',       icon: '🅿️', minutes: 4,  trend: 'stable' },
    },

    'alerts': [
      {
        id: 'alert-001',
        message: 'Gate 3 (South) is temporarily closed. Please use Gate 1, 2, or 4.',
        priority: 'warning',
        timestamp: Date.now(),
        active: true,
      },
    ],
  };

  // ── Phase Profiles — target crowd densities per phase ─────────
  const PHASE_PROFILES = {
    'pre-match': {
      'north-stand': 0.55, 'south-stand': 0.60, 'east-concourse': 0.45,
      'west-concourse': 0.30, 'main-gate': 0.72, 'food-court': 0.55, 'parking': 0.65,
      waitMultiplier: 1.0,
    },
    'first-innings': {
      'north-stand': 0.94, 'south-stand': 0.96, 'east-concourse': 0.22,
      'west-concourse': 0.18, 'main-gate': 0.15, 'food-court': 0.28, 'parking': 0.88,
      waitMultiplier: 0.35,
    },
    'drinks-break': {
      'north-stand': 0.45, 'south-stand': 0.50, 'east-concourse': 0.85,
      'west-concourse': 0.72, 'main-gate': 0.25, 'food-court': 0.97, 'parking': 0.82,
      waitMultiplier: 2.8,
    },
    'second-innings': {
      'north-stand': 0.95, 'south-stand': 0.97, 'east-concourse': 0.18,
      'west-concourse': 0.15, 'main-gate': 0.12, 'food-court': 0.22, 'parking': 0.85,
      waitMultiplier: 0.28,
    },
    'post-match': {
      'north-stand': 0.08, 'south-stand': 0.08, 'east-concourse': 0.78,
      'west-concourse': 0.72, 'main-gate': 0.88, 'food-court': 0.38, 'parking': 0.95,
      waitMultiplier: 3.8,
    },
  };

  const BASE_WAIT_TIMES = {
    'main-gate': 6, 'food-court': 5,
    'north-restrooms': 2, 'merchandise': 10, 'parking-exit': 4,
  };

  // ── Init ─────────────────────────────────────────────────────
  function init(useFirebase = false) {
    state = JSON.parse(JSON.stringify(INITIAL_STATE));
    currentPhase = 'pre-match';

    if (useFirebase && typeof VenueFirebase !== 'undefined' && VenueFirebase.isConnected()) {
      VenueFirebase.seedInitialData(state);
    }

    _dispatchAll();
    intervalId = setInterval(_tick, 8000);
    _schedulePhaseAdvance();
    console.info('[VenueSimulator] IPL 2026 — MI vs CSK | Mode:', useFirebase ? 'Firebase' : 'local demo');
  }

  // ── Tick ─────────────────────────────────────────────────────
  function _tick() {
    tickCount++;
    const profile    = PHASE_PROFILES[currentPhase];
    const crowdZones = state['crowd-zones'];
    const waitTimes  = state['wait-times'];

    Object.keys(crowdZones).forEach(key => {
      const target     = profile[key] ?? 0.5;
      const current    = crowdZones[key].density;
      const jitter     = (Math.random() - 0.5) * 0.06;
      const drift      = (target - current) * 0.25;
      const newDensity = Math.max(0.05, Math.min(0.98, current + drift + jitter));
      const prevDensity = crowdZones[key].density;

      crowdZones[key].density = parseFloat(newDensity.toFixed(3));
      crowdZones[key].current = Math.round(newDensity * crowdZones[key].capacity);
      crowdZones[key].trend   = newDensity > prevDensity + 0.01 ? 'increasing'
                              : newDensity < prevDensity - 0.01 ? 'decreasing'
                              : 'stable';
    });

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

    if (typeof VenueFirebase !== 'undefined' && VenueFirebase.isConnected()) {
      VenueFirebase.writeCrowdData(crowdZones, waitTimes);
    }
  }

  // ── Phase advance ─────────────────────────────────────────────
  const PHASE_ORDER = ['pre-match', 'first-innings', 'drinks-break', 'second-innings', 'post-match'];
  let phaseIndex = 0;

  function _schedulePhaseAdvance() {
    setTimeout(() => _nextPhase(), 90000);
  }

  function _nextPhase() {
    phaseIndex = (phaseIndex + 1) % PHASE_ORDER.length;
    currentPhase = PHASE_ORDER[phaseIndex];
    state.event.phase = currentPhase;

    if (currentPhase === 'drinks-break') {
      _dispatchAlert({
        id: 'alert-drinks',
        message: '🏏 Drinks Break! Food Court & concourses are surging — go now or expect 12+ min queues.',
        priority: 'info',
        timestamp: Date.now(),
        active: true,
      });
    }

    if (currentPhase === 'second-innings') {
      _dispatchAlert({
        id: 'alert-innings2',
        message: '⚡ 2nd Innings starting! CSK chasing. All stands filling up — return to seats now.',
        priority: 'info',
        timestamp: Date.now(),
        active: true,
      });
    }

    if (currentPhase === 'post-match') {
      _dispatchAlert({
        id: 'alert-post',
        message: '🏆 Match over! Gate 4 (West) exit is fastest. Parking P1–P4 at 95% — allow 20 min.',
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

  function setPhase(phase) {
    if (!PHASE_PROFILES[phase]) return;
    currentPhase = phase;
    state.event.phase = phase;
    _dispatch('venueiq:event-update', state.event);
    _tick();
  }

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

  function getCurrentData() { return state; }

  function stop() {
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
  }

  return { init, stop, setPhase, getCurrentData };
})();
