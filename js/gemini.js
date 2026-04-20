/* ================================================================
   VenueIQ — Gemini 2.5 Flash API Client
   Injects live venue data into system prompt before every call.
   ================================================================ */

const VenueGemini = (() => {
  const MODEL = 'gemini-2.5-flash';
  const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
  const MAX_HISTORY = 10; // keep last 10 turns

  let conversationHistory = [];
  let liveData = {
    event:       { name:'Championship Finals 2026', venue:'National Sports Arena', phase:'pre-match', kickoff:'18:00' },
    crowdZones:  {},
    waitTimes:   {},
    alerts:      [],
  };

  // ── Listen to simulator/Firebase events ──────────────────────
  function init() {
    document.addEventListener('venueiq:crowd-update',     e => { liveData.crowdZones = e.detail; });
    document.addEventListener('venueiq:waittimes-update', e => { liveData.waitTimes   = e.detail; });
    document.addEventListener('venueiq:alerts-update',    e => { liveData.alerts      = e.detail; });
    document.addEventListener('venueiq:event-update',     e => { liveData.event       = e.detail; });
  }

  // ── System Prompt — injected with live data ───────────────────
  function _buildSystemPrompt() {
    const { event, crowdZones, waitTimes, alerts } = liveData;

    // Format crowd hotspots (density > 0.70)
    const hotspots = Object.entries(crowdZones)
      .filter(([, z]) => z.density > 0.70)
      .map(([, z]) => `${z.name} (${Math.round(z.density * 100)}% full)`)
      .join(', ') || 'None currently';

    // Format all zone densities
    const zoneList = Object.entries(crowdZones)
      .map(([, z]) => `  • ${z.name}: ${Math.round(z.density * 100)}% capacity (${z.current}/${z.capacity} people) — trend: ${z.trend}`)
      .join('\n') || '  • Data loading...';

    // Format wait times
    const waitList = Object.entries(waitTimes)
      .map(([, w]) => `  • ${w.name}: ${w.minutes} min (${w.trend})`)
      .join('\n') || '  • Data loading...';

    // Format active alerts
    const alertList = alerts.filter(a => a.active).length > 0
      ? alerts.filter(a => a.active).map(a => `  ⚠️ [${a.priority.toUpperCase()}] ${a.message}`).join('\n')
      : '  ✅ No active alerts';

    return `You are VenueIQ, an intelligent, friendly AI venue assistant at **${event.name}** held at **${event.venue}**.

Your mission: help attendees navigate, avoid crowds, find facilities, and enjoy the event safely.

═══════════════════════════════════════════
🔴 LIVE VENUE DATA (updated every 8 seconds)
═══════════════════════════════════════════

📍 EVENT STATUS
  • Event: ${event.name} | Sport: ${event.sport || 'Football'}
  • Venue: ${event.venue}
  • Kickoff: ${event.kickoff}
  • Current Phase: ${event.phase?.replace('-',' ').toUpperCase() || 'LOADING'}

🔥 CROWD HOTSPOTS (>70% capacity): ${hotspots}

👥 ALL ZONE DENSITIES:
${zoneList}

⏱️ CURRENT WAIT TIMES:
${waitList}

🚨 ACTIVE ALERTS:
${alertList}

═══════════════════════════════════════════
🗺️ VENUE LAYOUT KNOWLEDGE
═══════════════════════════════════════════

GATES:
  • Gate A (North) — Main entrance. Use for North Stand & Parking P1-P4.
  • Gate B (South) — ⛔ CLOSED TODAY. All attendees redirect to A, C, or D.
  • Gate C (East)  — East Concourse. Closer to East food stalls.
  • Gate D (West)  — West Concourse. Usually least congested.

FOOD & DRINK:
  • Food Court: East Concourse, Level 1 (main hub, check wait time above)
  • Light snacks: North & South concourse kiosks (shorter queues)
  • Alcohol: East Concourse Bar (Level 2) and West Concourse Bar

RESTROOMS:
  • North: Section N2 and N8 (Level 1 and 2)
  • South: Section S3 and S6 (Level 1)
  • East:  Section E1 — accessible restrooms available
  • West:  Section W4 — cleanest, usually least crowded

PARKING:
  • P1–P4 (North): Closest to Gate A. Exit via North Road.
  • P5–P8 (South): Closer to Gate D. Exit via West Avenue (usually faster post-match).
  • Disabled parking: P1 Level 0 (closest to Gate A accessible entrance)

MEDICAL:
  • First Aid: Section N1 (North), S1 (South), and Main Gate lobby

ACCESSIBILITY:
  • Accessible routes marked in orange. Lifts at all main concourses.

═══════════════════════════════════════════
🤖 YOUR RESPONSE RULES
═══════════════════════════════════════════
1. Be concise — max 4 short bullet points or 3 sentences per response.
2. ALWAYS recommend the LEAST congested option based on live data above.
3. If Gate B is mentioned, inform about the closure and suggest alternatives.
4. Use friendly, upbeat language — you're enhancing their event experience!
5. If you don't know something, say so honestly rather than guessing.
6. For navigation, give clear directional hints (turn left, Level 2, etc.).
7. Mention wait times when relevant — they're real-time and accurate.`;
  }

  // ── Send Message ─────────────────────────────────────────────
  async function sendMessage(userText, onChunk) {
    const apiKey = window.CONFIG?.GEMINI_API_KEY;

    if (!apiKey || apiKey.includes('YOUR_')) {
      return {
        ok: false,
        error: 'no_key',
        text: 'Please add your Gemini API key to config.js to enable the AI assistant.',
      };
    }

    // Add to history
    conversationHistory.push({ role: 'user', parts: [{ text: userText }] });

    // Trim history to keep within limits
    if (conversationHistory.length > MAX_HISTORY * 2) {
      conversationHistory = conversationHistory.slice(-MAX_HISTORY * 2);
    }

    const requestBody = {
      system_instruction: {
        parts: [{ text: _buildSystemPrompt() }],
      },
      contents: conversationHistory,
      generationConfig: {
        temperature: 0.75,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 512,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      ],
    };

    try {
      const url = `${API_BASE}/${MODEL}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const msg = err?.error?.message || `HTTP ${response.status}`;
        throw new Error(msg);
      }

      const data = await response.json();
      const candidate = data?.candidates?.[0];

      if (!candidate || candidate.finishReason === 'SAFETY') {
        throw new Error('Response filtered by safety settings.');
      }

      const aiText = candidate.content?.parts?.[0]?.text || 'I couldn\'t generate a response. Please try again.';

      // Add AI response to history
      conversationHistory.push({ role: 'model', parts: [{ text: aiText }] });

      // Simulate streaming: call onChunk with progressively longer text
      if (onChunk) {
        await _simulateStream(aiText, onChunk);
      }

      return { ok: true, text: aiText };

    } catch (err) {
      console.error('[VenueGemini] API error:', err);
      // Remove the user message from history on error
      conversationHistory.pop();
      return { ok: false, error: err.message, text: null };
    }
  }

  // ── Streaming simulation (character reveal) ───────────────────
  async function _simulateStream(text, onChunk) {
    // Reveal in chunks of ~3-5 chars, simulating token streaming
    const chunkSize = 4;
    let revealed = '';

    for (let i = 0; i < text.length; i += chunkSize) {
      // Add slight human-like timing variation
      const delay = text[i] === '.' || text[i] === '\n' ? 60 : 20;
      await _sleep(delay);
      revealed += text.slice(i, i + chunkSize);
      onChunk(revealed, false);
    }

    onChunk(text, true); // final — mark as complete
  }

  function _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function clearHistory() { conversationHistory = []; }

  function getDataContext() {
    return JSON.parse(JSON.stringify(liveData));
  }

  return { init, sendMessage, clearHistory, getDataContext };
})();
