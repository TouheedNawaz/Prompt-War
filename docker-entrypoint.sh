#!/bin/sh
# ================================================================
# VenueIQ — Docker Entrypoint
# Generates config.js from Cloud Run environment variables,
# then starts nginx. This keeps API keys out of the image.
# ================================================================

echo "[VenueIQ] Generating config.js from environment variables..."

cat > /usr/share/nginx/html/config.js << EOF
/**
 * VenueIQ Runtime Configuration
 * Generated at container start from Cloud Run environment variables.
 * To set keys: Cloud Run → Edit & Deploy → Variables & Secrets
 */
const CONFIG = {
  // Set via Cloud Run env var: GEMINI_API_KEY
  GEMINI_API_KEY: '${GEMINI_API_KEY:-YOUR_GEMINI_API_KEY_HERE}',

  // Demo mode: true = simulated data, no Firebase needed
  // Set via Cloud Run env var: DEMO_MODE (true/false)
  DEMO_MODE: ${DEMO_MODE:-true},

  FIREBASE: {
    apiKey:            '${FIREBASE_API_KEY:-}',
    authDomain:        '${FIREBASE_AUTH_DOMAIN:-}',
    databaseURL:       '${FIREBASE_DATABASE_URL:-}',
    projectId:         '${FIREBASE_PROJECT_ID:-}',
    storageBucket:     '${FIREBASE_STORAGE_BUCKET:-}',
    messagingSenderId: '${FIREBASE_MESSAGING_SENDER_ID:-}',
    appId:             '${FIREBASE_APP_ID:-}',
  },

  // Set via Cloud Run env var: GOOGLE_MAPS_API_KEY
  GOOGLE_MAPS_API_KEY: '${GOOGLE_MAPS_API_KEY:-}',

  EVENT: {
    name:    'IPL 2026 — MI vs CSK',
    venue:   'Wankhede Stadium',
    address: 'Wankhede Stadium, Mumbai, Maharashtra, India',
    kickoff: '19:30 IST',
    sport:   'Cricket',
    teams:   'Mumbai Indians vs Chennai Super Kings',
  },
};
EOF

echo "[VenueIQ] config.js generated. DEMO_MODE=${DEMO_MODE:-true}"
echo "[VenueIQ] Starting nginx on port 8080..."

exec nginx -g 'daemon off;'
