/* VenueIQ — App Coordinator
   Orchestrates initialization, tab routing, and chat UI. */

(function () {
  'use strict';

  // Default config (used when config.js is missing — demo mode)
  window.CONFIG = window.CONFIG || {
    GEMINI_API_KEY:    '',
    DEMO_MODE:         true,
    FIREBASE:          {},
    GOOGLE_MAPS_API_KEY: '',
    EVENT: {
      name:    'IPL 2026 — MI vs CSK',
      venue:   'Wankhede Stadium',
      address: 'Wankhede Stadium, Mumbai, Maharashtra, India',
      kickoff: '19:30 IST',
      sport:   'Cricket',
      teams:   'Mumbai Indians vs Chennai Super Kings',
    },
  };

  // ── Tab Routing ───────────────────────────────────────────────
  let activeTab = 'assistant';

  function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
      btn.setAttribute('aria-selected', 'false');
    });
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

    const btn   = document.getElementById(`tab-${tabName}`);
    const panel = document.getElementById(`panel-${tabName}`);
    if (btn)   { btn.classList.add('active'); btn.setAttribute('aria-selected', 'true'); }
    if (panel) { panel.classList.add('active'); }

    activeTab = tabName;
  }

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Inject event name into header on load
  const eventNameEl = document.getElementById('event-name-header');
  if (eventNameEl) eventNameEl.textContent = CONFIG.EVENT.name;

  // ── Chat UI ───────────────────────────────────────────────────
  const chatMessages = document.getElementById('chat-messages');
  const chatInput    = document.getElementById('chat-input');
  const sendBtn      = document.getElementById('send-btn');

  let isAITyping = false;
  let conversationStarted = false;

  // Quick prompt chip clicks
  document.addEventListener('click', e => {
    const chip = e.target.closest('.quick-prompt-btn');
    if (chip?.dataset.prompt) sendUserMessage(chip.dataset.prompt);
  });

  // Send on button click
  sendBtn?.addEventListener('click', () => {
    const text = chatInput.value.trim();
    if (text && !isAITyping) sendUserMessage(text);
  });

  // Send on Enter (Shift+Enter = newline)
  chatInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (text && !isAITyping) sendUserMessage(text);
    }
  });

  function setTypingState(typing) {
    isAITyping = typing;
    if (sendBtn)    sendBtn.disabled    = typing;
    if (chatInput)  chatInput.disabled  = typing;
  }

  async function sendUserMessage(text) {
    if (!text || isAITyping) return;

    // Hide welcome screen on first message
    if (!conversationStarted) {
      chatMessages.querySelector('.chat-welcome')?.remove();
      conversationStarted = true;
    }

    chatInput.value = '';
    setTypingState(true);

    const hasKey = window.CONFIG?.GEMINI_API_KEY &&
                   !window.CONFIG.GEMINI_API_KEY.includes('YOUR_');

    appendMessage('user', text);

    if (!hasKey) {
      appendMessage('ai',
        '⚠️ **Gemini API key not configured.** Copy `config.example.js` to `config.js` and add your free key from ' +
        '[Google AI Studio](https://aistudio.google.com/apikey). The crowd map and dashboard still work without it!',
        true
      );
      setTypingState(false);
      return;
    }

    const typingId  = showTypingIndicator();
    const bubbleEl  = createAIBubble();
    let   finalText = '';

    const result = await VenueGemini.sendMessage(text, (partial, isDone) => {
      finalText = partial;
      removeTypingIndicator(typingId);
      updateAIBubble(bubbleEl, partial);
      if (!isDone) scrollToBottom();
    });

    if (!result.ok) {
      removeTypingIndicator(typingId);
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

  function appendMessage(role, text, addContext = false) {
    const el   = document.createElement('div');
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

  function createAIBubble() {
    const el   = document.createElement('div');
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

  function showTypingIndicator() {
    const id = 'typing-' + Date.now();
    const el = document.createElement('div');
    el.className = 'message ai';
    el.id = id;
    el.innerHTML = `
      <div class="message-avatar" aria-hidden="true">🤖</div>
      <div class="typing-indicator" role="status" aria-label="AI is typing">
        <div class="typing-dots"><span></span><span></span><span></span></div>
        <span class="typing-label">VenueIQ is thinking...</span>
      </div>`;
    chatMessages.appendChild(el);
    scrollToBottom();
    return id;
  }

  function removeTypingIndicator(id) {
    document.getElementById(id)?.remove();
  }

  // Called from the Crowd Map "Ask AI" button
  function askAIAboutZone(prompt) {
    switchTab('assistant');
    setTimeout(() => sendUserMessage(prompt), 150);
  }

  // Markdown-lite formatter for AI responses
  function _formatText(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
  }

  function scrollToBottom() {
    if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // ── Live Status Indicator ─────────────────────────────────────
  function setLiveStatus(connected) {
    const el = document.getElementById('live-status');
    if (!el) return;
    el.className = `live-status ${connected ? 'connected' : 'disconnected'}`;
    el.innerHTML = `<span class="live-dot ${connected ? '' : 'critical'}"></span> ${connected ? 'Live data connected' : 'Demo mode'}`;
  }

  // ── Bootstrap ─────────────────────────────────────────────────
  async function boot() {
    // Register PWA Service Worker
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('/sw.js');
        console.log('[VenueIQ] Service Worker registered');
      } catch (e) {
        console.error('[VenueIQ] Service Worker failed', e);
      }
    }

    const firebaseConnected = await VenueFirebase.init();
    VenueSimulator.init(firebaseConnected);
    VenueGemini.init();
    VenueHeatmap.init(askAIAboutZone);
    VenueDashboard.init();
    setLiveStatus(firebaseConnected);

    // Sensory Mode toggle
    const sensoryBtn = document.getElementById('sensory-toggle');
    if (sensoryBtn) {
      let sensoryActive = false;
      sensoryBtn.addEventListener('click', () => {
        sensoryActive = !sensoryActive;
        if (sensoryActive) {
          sensoryBtn.classList.add('active');
          document.body.classList.add('sensory-mode-active');
        } else {
          sensoryBtn.classList.remove('active');
          document.body.classList.remove('sensory-mode-active');
        }
        document.dispatchEvent(new CustomEvent('venueiq:sensory-mode', { detail: sensoryActive }));
      });
    }

    // Welcome toast
    setTimeout(() => {
      VenueDashboard.showToast({
        title: '🏟️ VenueIQ Ready!',
        message: 'IPL 2026 crowd data is live. Ask the AI anything!',
        type: 'success',
        duration: 4000,
      });
    }, 800);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
