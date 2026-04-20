/* ================================================================
   VenueIQ — Dashboard & Alerts Renderer
   Manages the Live Dashboard tab: wait time cards, event phases,
   crowd summary, and alert notifications.
   ================================================================ */

const VenueDashboard = (() => {
  let lastUpdated = null;
  let activeAlerts = [];

  // ── Init ─────────────────────────────────────────────────────
  function init() {
    document.addEventListener('venueiq:waittimes-update', e => _renderWaitTimes(e.detail));
    document.addEventListener('venueiq:alerts-update',    e => _handleAlerts(e.detail));
    document.addEventListener('venueiq:event-update',     e => _renderEventPhase(e.detail));
    document.addEventListener('venueiq:crowd-update',     e => _renderCrowdSummary(e.detail));

    // Header event phase
    document.addEventListener('venueiq:event-update', e => _updateHeaderBadge(e.detail));

    _renderDashboardShell();
    _startUpdateClock();
  }

  // ── Build Dashboard Shell ─────────────────────────────────────
  function _renderDashboardShell() {
    const panel = document.getElementById('panel-dashboard');
    if (!panel) return;

    panel.innerHTML = `
    <div class="dashboard-container">
      <div class="dashboard-header">
        <h2 class="section-title">Live Dashboard</h2>
        <div class="refresh-indicator">
          <span class="material-symbols-rounded spin-icon" style="font-size:16px">autorenew</span>
          <span id="last-updated-text">Connecting...</span>
        </div>
      </div>

      <!-- Active Alerts -->
      <div>
        <h3 class="subsection-title">
          <span class="material-symbols-rounded">campaign</span>
          Active Alerts
        </h3>
        <div class="alerts-list" id="alerts-list">
          <div class="skeleton" style="height:60px;border-radius:var(--r-md)"></div>
        </div>
      </div>

      <!-- Wait Times -->
      <div>
        <h3 class="subsection-title">
          <span class="material-symbols-rounded">schedule</span>
          Current Wait Times
        </h3>
        <div class="wait-time-grid stagger-children" id="wait-time-grid">
          ${[1,2,3,4,5].map(() => `<div class="skeleton" style="height:160px;border-radius:var(--r-lg)"></div>`).join('')}
        </div>
      </div>

      <!-- Event Phase -->
      <div>
        <h3 class="subsection-title">
          <span class="material-symbols-rounded">timeline</span>
          Event Phase
        </h3>
        <div class="event-phase-cards stagger-children" id="event-phase-cards">
          ${_buildPhaseCards('pre-match')}
        </div>
      </div>

      <!-- Crowd Summary -->
      <div>
        <h3 class="subsection-title">
          <span class="material-symbols-rounded">analytics</span>
          Venue Overview
        </h3>
        <div class="crowd-summary-grid stagger-children" id="crowd-summary-grid">
          <div class="skeleton" style="height:80px;border-radius:var(--r-lg)"></div>
          <div class="skeleton" style="height:80px;border-radius:var(--r-lg)"></div>
          <div class="skeleton" style="height:80px;border-radius:var(--r-lg)"></div>
        </div>
      </div>
    </div>`;
  }

  // ── Wait Times ────────────────────────────────────────────────
  function _renderWaitTimes(data) {
    const grid = document.getElementById('wait-time-grid');
    if (!grid) return;

    const urgencyClass = (mins) => mins >= 15 ? 'critical' : mins >= 10 ? 'high' : mins >= 5 ? 'medium' : 'low';

    grid.innerHTML = Object.entries(data).map(([key, wt]) => {
      const cls     = urgencyClass(wt.minutes);
      const fillPct = Math.min(100, Math.round((wt.minutes / 20) * 100));
      const trendIcon = wt.trend === 'increasing' ? 'arrow_upward'
                      : wt.trend === 'decreasing' ? 'arrow_downward' : 'remove';

      return `
      <div class="wait-card ${cls} animate-fade-in-up" id="wc-${key}" 
           role="article" aria-label="${wt.name}: ${wt.minutes} minute wait">
        <div class="wait-card-icon" aria-hidden="true">${wt.icon || '⏱️'}</div>
        <div class="wait-card-name">${wt.name}</div>
        <div>
          <span class="wait-card-time" id="wt-${key}">${wt.minutes}</span>
          <span class="wait-card-unit"> min wait</span>
        </div>
        <div class="wait-progress-bar" aria-label="Wait time progress">
          <div class="wait-progress-fill" style="width:${fillPct}%" id="wp-${key}"></div>
        </div>
        <div class="wait-card-trend ${wt.trend}">
          <span class="material-symbols-rounded">${trendIcon}</span>
          ${wt.trend === 'increasing' ? 'Getting busier' : wt.trend === 'decreasing' ? 'Clearing up' : 'Steady'}
        </div>
      </div>`;
    }).join('');

    _updateTimestamp();
  }

  // ── Alerts ────────────────────────────────────────────────────
  function _handleAlerts(alerts) {
    activeAlerts = alerts.filter(a => a.active);
    _renderAlertsList();
    _updateTopAlertBanner();
  }

  function _renderAlertsList() {
    const list = document.getElementById('alerts-list');
    if (!list) return;

    if (activeAlerts.length === 0) {
      list.innerHTML = `
        <div class="no-alerts animate-fade-in">
          <span class="material-symbols-rounded">check_circle</span>
          All clear — no active alerts at this time.
        </div>`;
      return;
    }

    list.innerHTML = activeAlerts.map(a => {
      const icons = { info: 'info', warning: 'warning', critical: 'emergency' };
      const timeStr = a.timestamp ? new Date(a.timestamp).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) : '';
      return `
        <div class="alert-card ${a.priority} animate-fade-in-up" role="alert" id="alert-${a.id}">
          <span class="alert-icon material-symbols-rounded">${icons[a.priority] || 'info'}</span>
          <div class="alert-body">
            <div class="alert-text">${_sanitize(a.message)}</div>
            ${timeStr ? `<div class="alert-meta">Posted at ${timeStr}</div>` : ''}
          </div>
        </div>`;
    }).join('');
  }

  function _updateTopAlertBanner() {
    const banner = document.getElementById('alert-banner');
    if (!banner) return;

    const highPriorityAlert = activeAlerts.find(a => a.priority === 'critical')
                           || activeAlerts.find(a => a.priority === 'warning');

    if (highPriorityAlert) {
      banner.innerHTML = `
        <div class="alert-banner-inner ${highPriorityAlert.priority}">
          <span class="material-symbols-rounded">campaign</span>
          ${_sanitize(highPriorityAlert.message)}
        </div>`;
    } else {
      banner.innerHTML = '';
    }
  }

  // ── Event Phase ───────────────────────────────────────────────
  function _renderEventPhase(event) {
    const container = document.getElementById('event-phase-cards');
    if (!container) return;
    container.innerHTML = _buildPhaseCards(event.phase);
  }

  function _buildPhaseCards(currentPhase) {
    const phases = [
      { key: 'pre-match',    label: 'Pre-Match',    icon: '🌅' },
      { key: 'first-half',   label: 'First Half',   icon: '⚽' },
      { key: 'halftime',     label: 'Half Time',    icon: '☕' },
      { key: 'second-half',  label: 'Second Half',  icon: '🏆' },
    ];

    return phases.map(p => `
      <div class="phase-card ${p.key === currentPhase ? 'active' : ''}" aria-current="${p.key === currentPhase ? 'step' : 'false'}">
        <div class="phase-card-icon">${p.icon}</div>
        <div class="phase-card-name">${p.label}</div>
      </div>`).join('');
  }

  function _updateHeaderBadge(event) {
    const badge = document.getElementById('event-phase-badge');
    if (badge) badge.childNodes[badge.childNodes.length - 1].textContent = ' ' + (event.phase || '').replace('-', ' ');
    const nameEl = document.getElementById('event-name-header');
    if (nameEl) nameEl.textContent = event.name || '';
  }

  // ── Crowd Summary ─────────────────────────────────────────────
  function _renderCrowdSummary(data) {
    const grid = document.getElementById('crowd-summary-grid');
    if (!grid) return;

    const zones = Object.values(data);
    const totalPeople   = zones.reduce((s, z) => s + (z.current || 0), 0);
    const avgDensity    = zones.length ? zones.reduce((s, z) => s + z.density, 0) / zones.length : 0;
    const criticalZones = zones.filter(z => z.density >= 0.85).length;

    grid.innerHTML = `
      <div class="crowd-stat-card animate-fade-in-up">
        <div class="crowd-stat-icon cyan">
          <span class="material-symbols-rounded" style="color:var(--cyan);font-size:22px">group</span>
        </div>
        <div>
          <div class="crowd-stat-value">${totalPeople.toLocaleString()}</div>
          <div class="crowd-stat-label">People in Venue</div>
        </div>
      </div>

      <div class="crowd-stat-card animate-fade-in-up" style="animation-delay:0.1s">
        <div class="crowd-stat-icon violet">
          <span class="material-symbols-rounded" style="color:var(--violet);font-size:22px">show_chart</span>
        </div>
        <div>
          <div class="crowd-stat-value">${Math.round(avgDensity * 100)}%</div>
          <div class="crowd-stat-label">Avg. Occupancy</div>
        </div>
      </div>

      <div class="crowd-stat-card animate-fade-in-up" style="animation-delay:0.2s">
        <div class="crowd-stat-icon ${criticalZones > 0 ? '' : 'green'}">
          <span class="material-symbols-rounded" 
                style="color:${criticalZones > 0 ? 'var(--status-crit)' : 'var(--status-low)'};font-size:22px">
            ${criticalZones > 0 ? 'warning' : 'check_circle'}
          </span>
        </div>
        <div>
          <div class="crowd-stat-value" style="color:${criticalZones > 0 ? 'var(--status-crit)' : 'var(--status-low)'}">
            ${criticalZones}
          </div>
          <div class="crowd-stat-label">Critical Zones</div>
        </div>
      </div>`;
  }

  // ── Toast Notifications ───────────────────────────────────────
  function showToast({ title, message, type = 'info', duration = 5000 }) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = { info: 'notifications', warning: '⚠️', critical: '🚨', success: '✅' };
    const id = 'toast-' + Date.now();

    const toastEl = document.createElement('div');
    toastEl.className = `toast ${type}`;
    toastEl.id = id;
    toastEl.setAttribute('role', 'alert');
    toastEl.innerHTML = `
      <span class="toast-icon">${icons[type] || '🔔'}</span>
      <div class="toast-body" style="flex:1">
        <div class="toast-title">${_sanitize(title)}</div>
        ${message ? `<div class="toast-msg">${_sanitize(message)}</div>` : ''}
      </div>
      <span class="toast-dismiss material-symbols-rounded" aria-label="Dismiss notification">close</span>`;

    // Dismiss on click
    toastEl.querySelector('.toast-dismiss').onclick = () => _removeToast(id);
    toastEl.onclick = () => _removeToast(id);

    container.appendChild(toastEl);

    if (duration > 0) setTimeout(() => _removeToast(id), duration);
  }

  function _removeToast(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('removing');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }

  // ── Helpers ───────────────────────────────────────────────────
  function _startUpdateClock() {
    setInterval(() => {
      const el = document.getElementById('last-updated-text');
      if (!el || !lastUpdated) return;
      const secs = Math.round((Date.now() - lastUpdated) / 1000);
      el.textContent = secs < 5 ? 'Just updated' : `Updated ${secs}s ago`;
    }, 1000);
  }

  function _updateTimestamp() {
    lastUpdated = Date.now();
    const el = document.getElementById('last-updated-text');
    if (el) el.textContent = 'Just updated';
  }

  function _sanitize(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { init, showToast };
})();
