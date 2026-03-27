/* ============================================
   WEIGHT-CHART.JS — Courbe poids + filtres + moyenne mobile
   Sous-module de weight.js — Élev v2
   ============================================ */

window.WeightChart = (() => {

  let activeFilter = '90'; // jours affichés par défaut

  const FILTERS = [
    { key: '7',   label: '1S' },
    { key: '30',  label: '1M' },
    { key: '90',  label: '3M' },
    { key: '180', label: '6M' },
    { key: '365', label: '1A' },
    { key: 'all', label: 'Tout' },
  ];

  /* ── Filtrage ─────────────────────────────── */
  function filterLogs(logs, range) {
    if (range === 'all' || !logs.length) return logs;
    const days  = parseInt(range, 10);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutStr = cutoff.toISOString().slice(0, 10);
    return logs.filter(l => l.date >= cutStr);
  }

  /* ── Moyenne mobile 7 jours ───────────────── */
  function movingAvg(logs, window = 7) {
    return logs.map((_, i) => {
      const start = Math.max(0, i - window + 1);
      const slice = logs.slice(start, i + 1);
      const avg   = slice.reduce((s, l) => s + l.value, 0) / slice.length;
      return { date: logs[i].date, value: avg };
    });
  }

  /* ── SVG Chart ────────────────────────────── */
  function renderSVG(logs) {
    if (logs.length < 2) {
      return `<p class="empty-state-text" style="text-align:center;padding:24px 0;">
        Enregistre au moins 2 pesées pour voir l'évolution
      </p>`;
    }

    const W = 320, H = 150, padL = 38, padR = 10, padT = 16, padB = 28;
    const cW = W - padL - padR, cH = H - padT - padB;

    const values = logs.map(l => l.value);
    const minV   = Math.floor(Math.min(...values) - 0.5);
    const maxV   = Math.ceil(Math.max(...values)  + 0.5);
    const range  = maxV - minV || 1;
    const n      = logs.length;

    const toX = i  => padL + (i / Math.max(n - 1, 1)) * cW;
    const toY = v  => padT + (1 - (v - minV) / range)  * cH;

    const pts = logs.map((l, i) => ({ x: toX(i), y: toY(l.value) }));
    const avg = movingAvg(logs);
    const avgPts = avg.map((l, i) => ({ x: toX(i), y: toY(l.value) }));

    const line  = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const avgLine = avgPts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const area  = [
      `M ${pts[0].x.toFixed(1)},${(padT + cH).toFixed(1)}`,
      ...pts.map(p => `L ${p.x.toFixed(1)},${p.y.toFixed(1)}`),
      `L ${pts[n - 1].x.toFixed(1)},${(padT + cH).toFixed(1)} Z`
    ].join(' ');

    const last = pts[n - 1];

    // X labels : premier, milieu, dernier
    const mid = Math.floor(n / 2);
    const fmt = d => { const [,, day, mon] = d.split('-').flatMap((v,i) => i===0 ? [] : [v]); return `${parseInt(logs[mid < n ? mid : 0].date.slice(8))}/${parseInt(logs[mid < n ? mid : 0].date.slice(5,7))}`; };
    const xLabels = [
      { x: pts[0].x,    label: fmtDate(logs[0].date)       },
      { x: pts[mid].x,  label: fmtDate(logs[mid].date)     },
      { x: pts[n-1].x,  label: fmtDate(logs[n - 1].date)   },
    ];

    const midV = ((minV + maxV) / 2).toFixed(1);

    return `
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block;overflow:visible;" aria-label="Courbe de poids">
        <!-- Grille -->
        <line x1="${padL}" y1="${padT + cH/2}" x2="${W-padR}" y2="${padT + cH/2}"
              stroke="var(--border)" stroke-width="1" stroke-dasharray="4 4"/>
        <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT+cH}" stroke="var(--border)" stroke-width="1"/>
        <line x1="${padL}" y1="${padT+cH}" x2="${W-padR}" y2="${padT+cH}" stroke="var(--border)" stroke-width="1"/>
        <!-- Area fill -->
        <path d="${area}" fill="var(--accent)" opacity="0.1"/>
        <!-- Moyenne mobile (ligne secondaire) -->
        ${logs.length >= 7 ? `<polyline points="${avgLine}" fill="none" stroke="var(--cream-dim)"
          stroke-width="1.5" stroke-dasharray="4 3" stroke-linecap="round" opacity="0.6"/>` : ''}
        <!-- Courbe principale -->
        <polyline points="${line}" fill="none" stroke="var(--accent)"
                  stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <!-- Dernier point -->
        <circle cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="5"
                fill="var(--accent)" stroke="var(--bg-card)" stroke-width="2"/>
        <!-- Labels Y -->
        <text x="${padL-4}" y="${padT+4}"          text-anchor="end" font-size="9" fill="var(--cream-dim)" font-family="sans-serif">${maxV}</text>
        <text x="${padL-4}" y="${padT+cH/2+4}"     text-anchor="end" font-size="9" fill="var(--cream-dim)" font-family="sans-serif">${midV}</text>
        <text x="${padL-4}" y="${padT+cH}"          text-anchor="end" font-size="9" fill="var(--cream-dim)" font-family="sans-serif">${minV}</text>
        <!-- Labels X -->
        ${xLabels.map(l =>
          `<text x="${l.x.toFixed(1)}" y="${padT+cH+14}" text-anchor="middle"
                 font-size="9" fill="var(--cream-dim)" font-family="sans-serif">${l.label}</text>`
        ).join('')}
      </svg>`;
  }

  function fmtDate(d) {
    const [, m, day] = d.split('-');
    return `${parseInt(day)}/${parseInt(m)}`;
  }

  /* ── HTML complet (filtres + chart) ──────── */
  function render(containerEl, allLogs, onFilterChange) {
    const filtered = filterLogs(allLogs, activeFilter);

    containerEl.innerHTML = `
      <div class="weight-filter-bar">
        ${FILTERS.map(f => `
          <button class="weight-filter-btn${f.key === activeFilter ? ' active' : ''}" data-f="${f.key}">${f.label}</button>
        `).join('')}
      </div>
      <div class="weight-chart-wrap">${renderSVG(filtered)}</div>
      ${allLogs.length >= 7 ? `
        <div style="display:flex;align-items:center;gap:8px;margin-top:8px;">
          <span style="display:inline-block;width:20px;height:2px;background:var(--cream-dim);border-top:1px dashed var(--cream-dim);"></span>
          <span style="font-size:0.75rem;color:var(--cream-dim);">Moyenne mobile 7j</span>
        </div>` : ''}`;

    containerEl.querySelectorAll('.weight-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeFilter = btn.dataset.f;
        if (onFilterChange) onFilterChange();
      });
    });
  }

  return { render };

})();
