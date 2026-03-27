/* ============================================
   REST-TIMER.JS — Overlay minuteur de repos
   Élev v2
   ============================================ */

window.RestTimer = (() => {

  const CIRC = 2 * Math.PI * 46; // r=46, viewBox 100×100
  let tickId    = null;
  let remaining = 0;
  let initial   = 90;

  /* ------------------------------------------
     DOM
     ------------------------------------------ */
  function getOverlay() { return document.getElementById('rest-timer-overlay'); }

  function createOverlay() {
    if (document.getElementById('rest-timer-overlay')) return;
    const el = document.createElement('div');
    el.id = 'rest-timer-overlay';
    el.setAttribute('aria-live', 'polite');
    el.innerHTML = `
      <div class="rest-timer-inner">
        <!-- Anneau SVG -->
        <div class="rest-timer-ring-wrap">
          <svg width="72" height="72" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="46" fill="none"
                    stroke="var(--bg-surface)" stroke-width="7"/>
            <circle id="rest-ring-track" cx="50" cy="50" r="46" fill="none"
                    stroke="var(--accent)" stroke-width="7"
                    stroke-dasharray="${CIRC.toFixed(1)}"
                    stroke-dashoffset="0"
                    stroke-linecap="round"
                    transform="rotate(-90 50 50)"
                    style="transition:stroke-dashoffset 0.95s linear;"/>
          </svg>
          <span id="rest-timer-time" class="rest-timer-time">90</span>
        </div>
        <!-- Contrôles -->
        <div class="rest-timer-controls">
          <p class="rest-timer-label">Repos</p>
          <div class="rest-timer-btns">
            <button id="rest-btn-minus" class="btn btn-ghost btn-sm rest-adj">−15s</button>
            <button id="rest-btn-plus"  class="btn btn-ghost btn-sm rest-adj">+15s</button>
            <button id="rest-btn-skip"  class="btn btn-primary btn-sm" style="flex:1;">Passer →</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(el);

    document.getElementById('rest-btn-skip')?.addEventListener('click', stop);
    document.getElementById('rest-btn-minus')?.addEventListener('click', () => {
      remaining = Math.max(5, remaining - 15);
      render();
    });
    document.getElementById('rest-btn-plus')?.addEventListener('click', () => {
      remaining += 15;
      render();
    });
  }

  /* ------------------------------------------
     Rendu
     ------------------------------------------ */
  function render() {
    const timeEl = document.getElementById('rest-timer-time');
    const ringEl = document.getElementById('rest-ring-track');
    if (!timeEl || !ringEl) return;

    const min = Math.floor(remaining / 60);
    const sec = remaining % 60;
    timeEl.textContent = min > 0
      ? `${min}:${String(sec).padStart(2, '0')}`
      : `${sec}`;

    const pct = Math.max(0, remaining / initial);
    ringEl.setAttribute('stroke-dashoffset', (CIRC * (1 - pct)).toFixed(2));

    // Alerte visuelle quand < 6s
    ringEl.style.stroke = remaining <= 5 ? 'var(--color-danger)' : 'var(--accent)';
  }

  /* ------------------------------------------
     API publique
     ------------------------------------------ */
  function start(sec = 90) {
    stop();
    initial   = sec;
    remaining = sec;
    const overlay = getOverlay();
    if (!overlay) return;
    overlay.classList.add('open');
    render();
    tickId = setInterval(() => {
      remaining--;
      render();
      if (remaining === 5) {
        if (navigator.vibrate) navigator.vibrate([80, 60, 80]);
      }
      if (remaining <= 0) {
        stop();
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        window.showToast?.("C'est reparti ! 💪", 'success');
      }
    }, 1000);
  }

  function stop() {
    clearInterval(tickId);
    tickId = null;
    const overlay = getOverlay();
    if (overlay) overlay.classList.remove('open');
  }

  document.addEventListener('DOMContentLoaded', createOverlay);

  return { start, stop };

})();
