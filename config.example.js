/**
 * VenueIQ Configuration
 * ─────────────────────────────────────────────────────────────
 * SETUP INSTRUCTIONS:
 *   1. Copy this file and rename it to: config.js
 *   2. Fill in your API keys below
 *   3. config.js is gitignored — it will never be committed
 *
 * QUICK DEMO (no Firebase / Maps needed):
 *   Set DEMO_MODE: true and add only your GEMINI_API_KEY
 *   The app will use simulated crowd data locally.
 *
 * GET YOUR FREE GEMINI API KEY:
 *   https://aistudio.google.com/apikey
 * ─────────────────────────────────────────────────────────────
 */
const CONFIG = {
  // ── REQUIRED ──────────────────────────────────────────────
  // Get free at: https://aistudio.google.com/apikey
  GEMINI_API_KEY: 'YOUR_GEMINI_API_KEY_HERE',

  // ── DEMO MODE ─────────────────────────────────────────────
  // true  → Uses simulated crowd data locally (no Firebase needed)
  // false → Connects to Firebase Realtime Database for live data
  DEMO_MODE: true,

  // ── OPTIONAL: Firebase Realtime Database ──────────────────
  // Required only when DEMO_MODE is false
  // Get at: https://console.firebase.google.com
  FIREBASE: {
    apiKey:            'YOUR_FIREBASE_API_KEY',
    authDomain:        'your-project.firebaseapp.com',
    databaseURL:       'https://your-project-default-rtdb.firebaseio.com',
    projectId:         'your-project-id',
    storageBucket:     'your-project.firebasestorage.app',
    messagingSenderId: 'YOUR_SENDER_ID',
    appId:             'YOUR_APP_ID',
  },

  // ── OPTIONAL: Google Maps Embed API ───────────────────────
  // Required only to show the live venue map
  // Get at: https://console.cloud.google.com/apis/credentials
  GOOGLE_MAPS_API_KEY: 'YOUR_MAPS_API_KEY_HERE',

  // ── EVENT SETTINGS ────────────────────────────────────────
  EVENT: {
    name:    'Championship Finals 2026',
    venue:   'National Sports Arena',
    address: 'Wembley, London, UK',          // Used for Google Maps embed
    kickoff: '18:00',
    sport:   'Football',
  },
};
