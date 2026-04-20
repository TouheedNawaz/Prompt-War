/* ================================================================
   VenueIQ — App Coordinator
   Orchestrates initialization, tab routing, and chat UI.
   ================================================================ */

(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════
  // 1. CONFIGURATION DEFAULTS (if config.js is missing)
  // ═══════════════════════════════════════════════════════════════
  window.CONFIG = window.CONFIG || {
    GEMINI_API_KEY:    '',
    DEMO_MODE:         true,
    FIREBASE:          {},
    GOOGLE_MAPS_API_KEY: '',
    EVENT: {
      name:    'Championship Finals 2026',
      venue:   'National Sports Arena',
      address: 'Wembley Stadium, London',
      kickoff: '18:00',
      sport:   'Football',
    },
  };

  // ═══════════════════════════════════════════════════════════════
  // 2. TAB ROUTING
  // ═══════════════════════════════════════════════════════════════
  let activeTab = 'assistant';

  function switchTab(tabName) {
    // Deactivate all
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
      btn.setAttribute('aria-selected', 'false');
    });
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

    // Activate selected
    const btn   = document.getElementById(`tab-${tabName}`);
    const panel = document.getElementById(`panel-${tabName}`);
    if (btn)   { btn.classList.add('active'); btn.setAttribute('aria-selected', 'true'); }
    if (panel) { panel.classList.add('active'); }

    activeTab = tabName;
  }

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // ═══════════════════════════════════════════════════════════════
  // 3. HEADER — inject event info
  // ═══════════════════════════════════════════════════════════════
  const eventNameEl = document.getElementById('event-name-header');
  if (eventNameEl) eventNameEl.textContent = CONFIG.EVENT.name;

  // ═══════════════════════════════════════════════════════════════
  // 4. CHAT UI
  // ═══════════════════════════════════════════════════════════════
  const chatMessages = document.getElementById('chat-messages');
  const chatInput    = document.getElementById('chat-input');
  const sendBtn      = document.getElementById('send-btn');

  let isAITyping = false;
  let conversationStarted = false;

  // Handle quick prompt chips
  document.addEventListener('click', e => {
    const chip = e.target.closest('.quick-prompt-btn');
    if (chip) {
      const prompt = chip.dataset.prompt;
      if (prompt) sendUserMessage(prompt);
    }
  });

  // Send on button click
  sendBtn?.addEventListener('click', () => {
    const text = chatInput.value.trim();
    if (text && !isAITyping) sendUserMessage(text);
  });

  // Send on Enter (but Shift+Enter = newline)
  chatInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (text && !isAITyping) sendUserMessage(text);
    }
  });

  // Disable send while typing
  function setTypingState(typing) {
    isAITyping = typing;
    if (sendBtn) sendBtn.disabled = typing;
    if (chatInput) chatInput.disabled = typing;
  }

  // ── Send a message ────────────────────────────────────────────
  async function sendUserMessage(text) {
    if (!text || isAITyping) return;

    // Hide welcome screen on first message
    if (!conversationStarted) {
      const welcome = chatMessages.querySelector('.chat-welcome');
      if (welcome) welcome.remove();
      conversationStarted = true;
    }

    chatInput.value = '';
    setTypingState(true);

    // Check API key
    const hasKey = window.CONFIG?.GEMINI_API_KEY &&
                   !window.CONFIG.GEMINI_API_KEY.includes('YOUR_');

    // Render user bubble
    appendMessage('user', text);

    if (!hasKey) {
      // Show API key missing message
      appendMessage('ai',
        '⚠️ **Gemini API key not configured.** To enable the AI assistant, please copy `config.example.js` to `config.js` and add your free API key from [Google AI Studio](https://aistudio.google.com/apikey).\n\n' +
        'The rest of the app (crowd map, dashboard, live data) works without a key!',
        true
      );
      setTypingState(false);
      return;
    }

    // Show typing indicator
    const typingId = showTypingIndicator();

    // Call Gemini
    const messageEl = createAIBubble();
    let finalText = '';

    const result = await VenueGemini.sendMessage(text, (partial, isDone) => {
      finalText = partial;
      // Remove typing indicator on first chunk
      removeTypingIndicator(typingId);
      // Update bubble in-place with streamed text
      updateAIBubble(messageEl, partial);
      if (!isDone) scrollToBottom();
    });

    if (!result.ok) {
      removeTypingIndicator(typingId);
      // If streaming started, the bubble already exists
      if (!finalText) {
        appendMessage('ai', `❌ **Error:** ${result.error || 'Unknown error. Please try again.'}`, false);
      }
      VenueDashboard.showToast({
        title: 'AI Error',
        message: result.error,
        type: 'warning',
        duration: 5000,
      });
    }

    setTypingState(false);
    scrollToBottom();
  }

  // ── Append a completed message ────────────────────────────────
  function appendMessage(role, text, addContext = false) {
    const el = document.createElement('div');
    el.className = `message ${role}`;
    const avatar = role === 'ai' ? '🤖' : '👤';
    const time   = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    el.innerHTML = `
      <div class="message-avatar" aria-hidden="true">${avatar}</div>
      <div class="message-content">
        ${addContext ? `<div class="context-badge"><span class="material-symbols-rounded">sensors</span>Live data context attached</div>` : ''}
        <div class="message-bubble">${_formatText(text)}</div>
        <div class="message-time">${time}</div>
      </div>`;

    chatMessages.appendChild(el);
    scrollToBottom();
  }

  // ── Create an AI bubble that will be updated via streaming ────
  function createAIBubble() {
    const el = document.createElement('div');
    el.className = 'message ai';
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    el.innerHTML = `
      <div class="message-avatar" aria-hidden="true">🤖</div>
      <div class="message-content">
        <div class="context-badge">
          <span class="material-symbols-rounded">sensors</span>Live data context attached
        </div>
        <div class="message-bubble" id="streaming-bubble"></div>
        <div class="message-time">${time}</div>
      </div>`;

    chatMessages.appendChild(el);
    return el.querySelector('#streaming-bubble');
  }

  function updateAIBubble(bubbleEl, text) {
    if (bubbleEl) bubbleEl.innerHTML = _formatText(text);
  }

  // ── Typing indicator ──────────────────────────────────────────
  function showTypingIndicator() {
    const id = 'typing-' + Date.now();
    const el = document.createElement('div');
    el.className = 'message ai';
    el.id = id;
    el.innerHTML = `
      <div class="message-avatar" aria-hidden="true">🤖</div>
      <div class="typing-indicator" role="status" aria-label="AI is typing">
        <div class="typing-dots">
          <span></span><span></span><span></span>
        </div>
        <span class="typing-label">VenueIQ is thinking...</span>
      </div>`;
    chatMessages.appendChild(el);
    scrollToBottom();
    return id;
  }

  function removeTypingIndicator(id) {
    document.getElementById(id)?.remove();
  }

  // ── External: route a prompt from map tab ────────────────────
  function askAIAboutZone(prompt) {
    switchTab('assistant');
    setTimeout(() => sendUserMessage(prompt), 150);
  }

  // ── Format text: markdown-lite ────────────────────────────────
  function _formatText(text) {
    return text
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Links
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      // Bullet points
      .replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
      // Line breaks
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
  }

  function scrollToBottom() {
    if (chatMessages) {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 5. LIVE STATUS INDICATOR
  // ═══════════════════════════════════════════════════════════════
  function setLiveStatus(connected) {
    const el = document.getElementById('live-status');
    if (!el) return;
    el.className = `live-status ${connected ? 'connected' : 'disconnected'}`;
    el.innerHTML = `<span class="live-dot ${connected ? '' : 'critical'}"></span> ${connected ? 'Live data connected' : 'Demo mode'}`;
  }

  // ═══════════════════════════════════════════════════════════════
  // 6. BOOTSTRAP ALL MODULES
  // ═══════════════════════════════════════════════════════════════
  function boot() {
    // 1. Init Firebase (optional)
    const firebaseConnected = VenueFirebase.init();

    // 2. Start simulator (always — provides demo data or writes to Firebase)
    VenueSimulator.init(firebaseConnected);

    // 3. Init Gemini (just attaches data listeners)
    VenueGemini.init();

    // 4. Init Heatmap (builds stadium UI, listens for data)
    VenueHeatmap.init(askAIAboutZone);

    // 5. Init Dashboard (builds dashboard UI, listens for data)
    VenueDashboard.init();

    // 6. Update status
    setLiveStatus(!firebaseConnected ? false : true);

    // 7. Welcome toast
    setTimeout(() => {
      VenueDashboard.showToast({
        title: '🏟️ VenueIQ Ready!',
        message: 'Live crowd data is now streaming. Ask the AI anything!',
        type: 'success',
        duration: 4000,
      });
    }, 800);

    // 8. Alert toast for demo mode
    if (CONFIG.DEMO_MODE || !firebaseConnected) {
      setTimeout(() => {
        VenueDashboard.showToast({
          title: 'Demo Mode Active',
          message: 'Simulated crowd data is running. Configure Firebase for real-time data.',
          type: 'info',
          duration: 6000,
        });
      }, 2000);
    }

    console.info('[VenueIQ] 🏟️ App initialized. Firebase:', firebaseConnected ? 'connected' : 'not used');
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
