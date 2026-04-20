/* ================================================================
   VenueIQ — Gemini 2.5 Flash API Client (IPL 2026 Edition)
   Injects live Wankhede Stadium data into system prompt.
   ================================================================ */

const VenueGemini = (() => {
  const MODEL    = 'gemini-2.5-flash';
  const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
  const MAX_HISTORY = 10;

  let conversationHistory = [];
  let liveData = {
    event:      { name: 'IPL 2026 — MI vs CSK', venue: 'Wankhede Stadium', phase: 'pre-match', kickoff: '19:30 IST', sport: 'Cricket', teams: 'Mumbai Indians vs Chennai Super Kings' },
    crowdZones: {},
    waitTimes:  {},
    alerts:     [],
  };

  function init() {
    document.addEventListener('venueiq:crowd-update',     e => { liveData.crowdZones = e.detail; });
    document.addEventListener('venueiq:waittimes-update', e => { liveData.waitTimes   = e.detail; });
    document.addEventListener('venueiq:alerts-update',    e => { liveData.alerts      = e.detail; });
    document.addEventListener('venueiq:event-update',     e => { liveData.event       = e.detail; });
  }

  // ── System Prompt — IPL / Wankhede Stadium ────────────────────
  function _buildSystemPrompt() {
    const { event, crowdZones, waitTimes, alerts } = liveData;

    const hotspots = Object.entries(crowdZones)
      .filter(([, z]) => z.density > 0.70)
      .map(([, z]) => `${z.name} (${Math.round(z.density * 100)}% full)`)
      .join(', ') || 'None currently';

    const zoneList = Object.entries(crowdZones)
      .map(([, z]) => `  • ${z.name}: ${Math.round(z.density * 100)}% capacity (${z.current}/${z.capacity}) — ${z.trend}`)
      .join('\n') || '  • Data loading...';

    const waitList = Object.entries(waitTimes)
      .map(([, w]) => `  • ${w.name}: ${w.minutes} min (${w.trend})`)
      .join('\n') || '  • Data loading...';

    const alertList = alerts.filter(a => a.active).length > 0
      ? alerts.filter(a => a.active).map(a => `  ⚠️ [${a.priority.toUpperCase()}] ${a.message}`).join('\n')
      : '  ✅ No active alerts';

    const phaseEmoji = {
      'pre-match': '🌅', 'first-innings': '🏏', 'drinks-break': '💧',
      'second-innings': '⚡', 'post-match': '🏆',
    };

    return `You are VenueIQ, the official AI venue assistant for **${event.name}** at **${event.venue}, Mumbai**.

You help cricket fans navigate the stadium, avoid crowds, find food and facilities, and have a safe, fantastic IPL experience.

═══════════════════════════════════════════
🔴 LIVE VENUE DATA (updates every 8 seconds)
═══════════════════════════════════════════

📍 MATCH STATUS
  • Match: ${event.name}
  • Teams: ${event.teams || 'MI vs CSK'}
  • Venue: ${event.venue}, Mumbai
  • Toss / Kickoff: ${event.kickoff}
  • Current Phase: ${phaseEmoji[event.phase] || ''} ${(event.phase || '').replace(/-/g, ' ').toUpperCase()}

🔥 CROWD HOTSPOTS (>70% capacity): ${hotspots}

👥 ALL ZONE OCCUPANCY:
${zoneList}

⏱️ CURRENT WAIT TIMES:
${waitList}

🚨 ACTIVE ALERTS:
${alertList}

═══════════════════════════════════════════
🏟️ WANKHEDE STADIUM — LAYOUT KNOWLEDGE
═══════════════════════════════════════════

GATES:
  • Gate 1 (North) — Main entrance. Garware Pavilion access. Nearest to Mumbai Central station.
  • Gate 2 (East)  — Sunil Gavaskar Stand entry. Near Marine Lines station.
  • Gate 3 (South) — ⛔ CLOSED TODAY for maintenance. Redirect to Gate 1, 2, or 4.
  • Gate 4 (West)  — Vijay Merchant Stand. Usually least congested. Recommended for post-match exit.

STANDS:
  • Garware Pavilion (North): Premium seating. Blocks A–H. Best pitch view.
  • Sachin Tendulkar Stand (South): Most electric MI fan zone. Blocks S1–S12.
  • Sunil Gavaskar Stand (East): Family sections & corporate boxes. Blocks E1–E8.
  • Vijay Merchant Stand (West): CSK fan zone. Blocks W1–W6. Less crowded during play.

FOOD & DRINKS:
  • Main Food Court: Between Gate 1 & Gate 2 (East Concourse, Ground Level)
    — Vada Pav, Pav Bhaji, Biryani, Sandwiches, Beverages
    — Busiest during Drinks Break (check live wait time above)
  • South Wing Kiosks: Near Tendulkar Stand — lighter snacks, usually shorter queues
  • West Refreshment Counter: Near Vijay Merchant Stand — alcoholic and soft beverages

RESTROOMS:
  • North: Between Garware Pavilion and Gate 1 (Ground & Level 1)
  • South: Near Gate 3 area and Tendulkar Stand (Level 1)
  • East: Gavaskar Stand concourse — accessible restroom available
  • West: Vijay Merchant Stand (Level 1) — usually cleanest and quickest

PARKING:
  • P1–P3 (North): Closest to Gate 1. Exit via Marine Drive.
  • P4–P6 (West):  Near Gate 4. Exit via Wankhede Road — faster post-match.
  • No parking at Gate 2/East — walk from Nariman Point.
  • Disabled parking: P1 Level 0, adjacent to Gate 1 accessible entrance.

MEDICAL / FIRST AID:
  • Gate 1 lobby (North) — main first aid room
  • Gate 4 (West side) — secondary first-aid post

TRANSPORT:
  • Local train: Churchgate station (7 min walk), Marine Lines (10 min)
  • Auto/cab pickup: Gate 4 (West) — designated pickup zone post-match
  • Metro: Chhatrapati Shivaji Maharaj Terminus (20 min walk) or take a cab

═══════════════════════════════════════════
🏏 CRICKET MATCH CONTEXT
═══════════════════════════════════════════
  • During FIRST INNINGS / SECOND INNINGS: Stands are full. Concourses are quiet. Perfect time for restrooms or snacks — very short queues!
  • During DRINKS BREAK: Food Court and concourses peak. Expect 10–15 min queues. Go early or late.
  • POST-MATCH: Gate 4 (West) exit fastest. Allow 20–30 min for parking exit. Local train is the quickest option.

═══════════════════════════════════════════
🤖 RESPONSE RULES
═══════════════════════════════════════════
1. Be concise — max 3–4 bullet points or 3 sentences per response.
2. ALWAYS recommend the LEAST congested option based on live data.
3. If Gate 3 is mentioned, warn about closure and suggest alternatives.
4. Use cricket and IPL terminology naturally (innings, over, boundary, etc.).
5. Be enthusiastic — you're helping fans enjoy an AMAZING IPL match!
6. Mention live wait times when giving recommendations.
7. If something is unknown, say so honestly.`;
  }

  // ── Send Message ─────────────────────────────────────────────
  async function sendMessage(userText, onChunk) {
    const apiKey = window.CONFIG?.GEMINI_API_KEY;

    if (!apiKey || apiKey.includes('YOUR_')) {
      return {
        ok: false, error: 'no_key',
        text: 'Please add your Gemini API key to config.js to enable the AI assistant.',
      };
    }

    conversationHistory.push({ role: 'user', parts: [{ text: userText }] });

    if (conversationHistory.length > MAX_HISTORY * 2) {
      conversationHistory = conversationHistory.slice(-MAX_HISTORY * 2);
    }

    const requestBody = {
      system_instruction: { parts: [{ text: _buildSystemPrompt() }] },
      contents: conversationHistory,
      generationConfig: {
        temperature: 0.75, topK: 40, topP: 0.95, maxOutputTokens: 512,
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
        throw new Error(err?.error?.message || `HTTP ${response.status}`);
      }

      const data      = await response.json();
      const candidate = data?.candidates?.[0];

      if (!candidate || candidate.finishReason === 'SAFETY') {
        throw new Error('Response filtered by safety settings.');
      }

      const aiText = candidate.content?.parts?.[0]?.text || 'I couldn\'t generate a response. Please try again.';

      conversationHistory.push({ role: 'model', parts: [{ text: aiText }] });

      if (onChunk) await _simulateStream(aiText, onChunk);

      return { ok: true, text: aiText };

    } catch (err) {
      console.error('[VenueGemini] API error:', err);
      conversationHistory.pop();
      return { ok: false, error: err.message, text: null };
    }
  }

  async function _simulateStream(text, onChunk) {
    const chunkSize = 4;
    let revealed = '';
    for (let i = 0; i < text.length; i += chunkSize) {
      const delay = (text[i] === '.' || text[i] === '\n') ? 60 : 20;
      await _sleep(delay);
      revealed += text.slice(i, i + chunkSize);
      onChunk(revealed, false);
    }
    onChunk(text, true);
  }

  function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  function clearHistory() { conversationHistory = []; }
  function getDataContext() { return JSON.parse(JSON.stringify(liveData)); }

  return { init, sendMessage, clearHistory, getDataContext };
})();
