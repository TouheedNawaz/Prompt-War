/* ================================================================
   VenueIQ — Stadium Crowd Heatmap Renderer
   Renders the interactive stadium layout with live density data.
   ================================================================ */

const VenueHeatmap = (() => {
  let currentData = {};
  let selectedZone = null;

  // Zone to tab-switch callback
  let onAskAICallback = null;

  // ── Init ─────────────────────────────────────────────────────
  function init(onAskAI) {
    onAskAICallback = onAskAI;
    _buildStadiumUI();
    _bindEvents();
    document.addEventListener('venueiq:crowd-update', e => _updateZones(e.detail));
    document.addEventListener('venueiq:event-update', e => _updateFieldLabel(e.detail));
  }

  // ── Build Stadium DOM ─────────────────────────────────────────
  function _buildStadiumUI() {
    const panel = document.getElementById('panel-heatmap');
    if (!panel) return;

    panel.innerHTML = `
    <div class="heatmap-container">
      <div class="heatmap-header">
        <h2 class="section-title">Live Crowd Density</h2>
        <div class="map-legend">
          <span class="legend-item"><span class="legend-dot low"></span>Low &lt;50%</span>
          <span class="legend-item"><span class="legend-dot medium"></span>Moderate 50–70%</span>
          <span class="legend-item"><span class="legend-dot high"></span>High 70–85%</span>
          <span class="legend-item"><span class="legend-dot critical"></span>Critical &gt;85%</span>
        </div>
      </div>

      <div class="stadium-canvas-wrapper">
        <div class="stadium-canvas">
          <p class="stadium-label">🏟️ WANKHEDE STADIUM, MUMBAI — IPL 2026 LIVE VIEW</p>

          <!-- North (top) -->
          <div class="stadium-north">
            <div class="ns-wrapper">
              <div class="zone-card" id="zc-north-stand" data-zone="north-stand" tabindex="0" role="button" aria-label="Garware Pavilion zone">
                <div class="zone-name">Garware Pavilion</div>
                <div class="zone-density-pct" id="zp-north-stand">—%</div>
                <div class="zone-meta">
                  <span id="zm-north-stand">— / —</span>
                  <span class="zone-trend" id="zt-north-stand">—</span>
                </div>
              </div>
              <div class="gate-label" title="Gate 1 — Main entrance, currently open">🚪 Gate 1</div>
            </div>
          </div>

          <!-- Middle row -->
          <div class="stadium-grid" id="stadium-mid-grid">
            <!-- West / Vijay Merchant Stand -->
            <div class="zone-card" id="zc-west-concourse" data-zone="west-concourse" tabindex="0" role="button" aria-label="Vijay Merchant Stand zone">
              <div class="zone-name">V. Merchant Stand</div>
              <div class="zone-density-pct" id="zp-west-concourse">—%</div>
              <div class="zone-meta">
                <span id="zm-west-concourse">— / —</span>
                <span class="zone-trend" id="zt-west-concourse">—</span>
              </div>
            </div>

            <!-- Center Pitch -->
            <div class="stadium-field">
              <div class="field-label">🏏 PITCH</div>
              <div class="field-event-name" id="field-event-name">IPL 2026 — MI vs CSK</div>
              <div class="field-phase-badge" id="field-phase">PRE-MATCH</div>
            </div>

            <!-- East / Sunil Gavaskar Stand -->
            <div class="zone-card" id="zc-east-concourse" data-zone="east-concourse" tabindex="0" role="button" aria-label="Sunil Gavaskar Stand zone">
              <div class="zone-name">S. Gavaskar Stand</div>
              <div class="zone-density-pct" id="zp-east-concourse">—%</div>
              <div class="zone-meta">
                <span id="zm-east-concourse">— / —</span>
                <span class="zone-trend" id="zt-east-concourse">—</span>
              </div>
            </div>
          </div>

          <!-- South (bottom) -->
          <div class="stadium-south" style="margin-top:var(--s3)">
            <div class="ns-wrapper">
              <div class="zone-card" id="zc-south-stand" data-zone="south-stand" tabindex="0" role="button" aria-label="Sachin Tendulkar Stand zone">
                <div class="zone-name">S. Tendulkar Stand</div>
                <div class="zone-density-pct" id="zp-south-stand">—%</div>
                <div class="zone-meta">
                  <span id="zm-south-stand">— / —</span>
                  <span class="zone-trend" id="zt-south-stand">—</span>
                </div>
              </div>
              <div class="gate-label closed" title="Gate 3 — CLOSED for maintenance">⛔ Gate 3</div>
            </div>
          </div>

          <!-- Utility zones row -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s3);margin-top:var(--s3)">
            <div class="zone-card" id="zc-food-court" data-zone="food-court" tabindex="0" role="button" aria-label="Food Court zone">
              <div class="zone-name">🍛 Food Court</div>
              <div class="zone-density-pct" id="zp-food-court">—%</div>
              <div class="zone-meta">
                <span id="zm-food-court">— / —</span>
                <span class="zone-trend" id="zt-food-court">—</span>
              </div>
            </div>
            <div class="zone-card" id="zc-parking" data-zone="parking" tabindex="0" role="button" aria-label="Parking zone">
              <div class="zone-name">🅿️ Parking</div>
              <div class="zone-density-pct" id="zp-parking">—%</div>
              <div class="zone-meta">
                <span id="zm-parking">— / —</span>
                <span class="zone-trend" id="zt-parking">—</span>
              </div>
            </div>
          </div>

          <!-- Main Gate below -->
          <div style="margin-top:var(--s3)">
            <div class="zone-card" id="zc-main-gate" data-zone="main-gate" tabindex="0" role="button" aria-label="Gate 1 North zone" style="max-width:100%">
              <div class="zone-name">🚪 Gate 1 (North — Main Entry)</div>
              <div class="zone-density-pct" id="zp-main-gate">—%</div>
              <div class="zone-meta">
                <span id="zm-main-gate">— / —</span>
                <span class="zone-trend" id="zt-main-gate">—</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Zone Info Panel -->
        <div class="zone-info-panel" id="zone-info-panel" style="display:none">
          <h3 id="zone-info-name">Zone Details</h3>
          <div class="zone-stats-grid">
            <div class="zone-stat-item">
              <span class="zone-stat-value" id="zi-density">—</span>
              <span class="zone-stat-label">Density</span>
            </div>
            <div class="zone-stat-item">
              <span class="zone-stat-value" id="zi-current">—</span>
              <span class="zone-stat-label">People</span>
            </div>
            <div class="zone-stat-item">
              <span class="zone-stat-value" id="zi-capacity">—</span>
              <span class="zone-stat-label">Capacity</span>
            </div>
          </div>
          <button class="ask-ai-zone-btn" id="ask-ai-zone-btn">
            <span class="material-symbols-rounded">smart_toy</span>
            Ask AI about this zone
          </button>
        </div>
      </div>

      <!-- Google Maps Embed -->
      <div class="venue-location-card">
          <div class="venue-location-header">
            <span class="material-symbols-rounded">location_on</span>
            <h3>Venue Location — Wankhede Stadium, Mumbai</h3>
          </div>
        <div id="maps-wrapper">
          <div class="maps-placeholder" id="maps-placeholder">
            <span class="material-symbols-rounded">map</span>
            <p>Add GOOGLE_MAPS_API_KEY to config.js to show the live venue map</p>
          </div>
        </div>
      </div>
    </div>`;

    _injectMapsEmbed();
  }

  // ── Inject Maps Embed ─────────────────────────────────────────
  function _injectMapsEmbed() {
    const key     = window.CONFIG?.GOOGLE_MAPS_API_KEY;
    const address = window.CONFIG?.EVENT?.address || 'Wankhede Stadium, Mumbai, India';
    const wrapper = document.getElementById('maps-wrapper');
    if (!wrapper) return;

    if (key && !key.includes('YOUR_')) {
      const src = `https://www.google.com/maps/embed/v1/place?key=${key}&q=${encodeURIComponent(address)}&zoom=16`;
      wrapper.innerHTML = `<iframe class="maps-iframe" src="${src}" allowfullscreen loading="lazy" title="Venue location map" aria-label="Google Maps showing venue location"></iframe>`;
    }
    // else placeholder stays
  }

  // ── Update Zone Cards ─────────────────────────────────────────
  function _updateZones(data) {
    currentData = data;

    Object.entries(data).forEach(([key, zone]) => {
      const pct        = Math.round(zone.density * 100);
      const densityClass = _densityClass(zone.density);
      const trendIcon    = _trendIcon(zone.trend);

      // Update percentage
      const pctEl = document.getElementById(`zp-${key}`);
      if (pctEl) {
        const prevText = pctEl.textContent;
        const newText  = `${pct}%`;
        if (prevText !== newText) {
          pctEl.textContent = newText;
          pctEl.classList.remove('pop');
          void pctEl.offsetWidth; // reflow
          pctEl.classList.add('pop');
        }
      }

      // Update meta
      const metaEl = document.getElementById(`zm-${key}`);
      if (metaEl) metaEl.textContent = `${zone.current.toLocaleString()} / ${zone.capacity.toLocaleString()}`;

      // Update trend
      const trendEl = document.getElementById(`zt-${key}`);
      if (trendEl) {
        trendEl.textContent = trendIcon;
        trendEl.className = `zone-trend ${zone.trend}`;
      }

      // Update card density class
      const card = document.getElementById(`zc-${key}`);
      if (card) {
        card.className = 'zone-card animate-fade-in';
        card.classList.add(`density-${densityClass}`);

        // Add/remove pulse ring for critical zones
        let ring = card.querySelector('.zone-pulse-ring');
        if (zone.density > 0.85) {
          if (!ring) {
            ring = document.createElement('div');
            ring.className = 'zone-pulse-ring';
            card.appendChild(ring);
          }
        } else if (ring) {
          ring.remove();
        }
      }

      // Update info panel if this zone is selected
      if (selectedZone === key) _showZoneInfo(key, zone);
    });
  }

  // ── Zone selection ────────────────────────────────────────────
  function _bindEvents() {
    document.addEventListener('click', e => {
      const card = e.target.closest('.zone-card[data-zone]');
      if (card) _selectZone(card.dataset.zone);
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        const card = e.target.closest('.zone-card[data-zone]');
        if (card) _selectZone(card.dataset.zone);
      }
    });

    document.addEventListener('click', e => {
      if (e.target.closest('#ask-ai-zone-btn') && onAskAICallback) {
        const zone = currentData[selectedZone];
        const zoneName = zone?.name || selectedZone;
        onAskAICallback(`What's the situation at ${zoneName}? Is it a good time to go there, and what are alternatives?`);
      }
    });
  }

  function _selectZone(key) {
    // Deselect previous
    if (selectedZone) {
      const prev = document.getElementById(`zc-${selectedZone}`);
      prev?.classList.remove('selected');
    }

    selectedZone = key;
    const card = document.getElementById(`zc-${key}`);
    card?.classList.add('selected');

    const zone = currentData[key];
    if (zone) _showZoneInfo(key, zone);
  }

  function _showZoneInfo(key, zone) {
    const panel = document.getElementById('zone-info-panel');
    if (!panel) return;

    panel.style.display = 'block';
    panel.classList.add('animate-fade-in');

    document.getElementById('zone-info-name').textContent = zone.name || key;
    document.getElementById('zi-density').textContent  = `${Math.round(zone.density * 100)}%`;
    document.getElementById('zi-current').textContent  = zone.current?.toLocaleString() || '—';
    document.getElementById('zi-capacity').textContent = zone.capacity?.toLocaleString() || '—';
  }

  // ── Update field label on phase change ────────────────────────
  function _updateFieldLabel(event) {
    const el = document.getElementById('field-phase');
    if (el) el.textContent = (event.phase || '').replaceAll('-', ' ').toUpperCase();
    const nameEl = document.getElementById('field-event-name');
    if (nameEl) nameEl.textContent = event.name || '';
  }

  // ── Helpers ───────────────────────────────────────────────────
  function _densityClass(density) {
    if (density >= 0.85) return 'crit';
    if (density >= 0.70) return 'high';
    if (density >= 0.50) return 'medium';
    return 'low';
  }

  function _trendIcon(trend) {
    return trend === 'increasing' ? '↑' : trend === 'decreasing' ? '↓' : '→';
  }

  return { init };
})();
