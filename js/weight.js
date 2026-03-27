/* ============================================
   WEIGHT.JS — Module Poids & Mesures
   Élev v2
   ============================================ */

window.Weight = (() => {

  const WEIGHT_KEY      = 'elev-weight-logs';
  const MEASURE_KEY     = 'elev-measurements';
  const PROFILE_KEY     = 'elev-weight-profile';

  /* ------------------------------------------
     STORAGE — Poids
     ------------------------------------------ */
  function getUserKey(base) {
    const uid = window.AppState?.user?.id || 'local';
    return `${base}-${uid}`;
  }

  function loadWeights() {
    try {
      return JSON.parse(localStorage.getItem(getUserKey(WEIGHT_KEY))) || [];
    } catch { return []; }
  }

  function saveWeight(dateStr, value) {
    const logs = loadWeights();
    const idx  = logs.findIndex(l => l.date === dateStr);
    if (idx >= 0) logs[idx].value = parseFloat(value);
    else logs.push({ date: dateStr, value: parseFloat(value) });
    logs.sort((a, b) => a.date.localeCompare(b.date));
    localStorage.setItem(getUserKey(WEIGHT_KEY), JSON.stringify(logs));
  }

  /* ------------------------------------------
     STORAGE — Mesures
     ------------------------------------------ */
  function loadMeasurements() {
    try {
      return JSON.parse(localStorage.getItem(getUserKey(MEASURE_KEY))) || {};
    } catch { return {}; }
  }

  function saveMeasurements(data) {
    localStorage.setItem(getUserKey(MEASURE_KEY), JSON.stringify(data));
  }

  /* ------------------------------------------
     STORAGE — Profil (taille)
     ------------------------------------------ */
  function loadProfile() {
    try {
      return JSON.parse(localStorage.getItem(getUserKey(PROFILE_KEY))) || { height: null };
    } catch { return { height: null }; }
  }

  function saveProfile(data) {
    localStorage.setItem(getUserKey(PROFILE_KEY), JSON.stringify(data));
  }

  /* ------------------------------------------
     HELPERS
     ------------------------------------------ */
  function todayStr() {
    return new Date().toISOString().split('T')[0];
  }

  function formatDateShort(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return `${d.getDate()}/${d.getMonth() + 1}`;
  }

  function calcBMI(weightKg, heightCm) {
    if (!weightKg || !heightCm || heightCm < 50) return null;
    const h = heightCm / 100;
    return (weightKg / (h * h)).toFixed(1);
  }

  function getBMIInfo(bmi) {
    if (!bmi) return null;
    const v = parseFloat(bmi);
    if (v < 18.5) return { label: 'Insuffisant',  color: 'var(--color-info)',    pct: Math.max(2, (v / 40) * 100) };
    if (v < 25)   return { label: 'Normal',        color: 'var(--accent)',        pct: (v / 40) * 100 };
    if (v < 30)   return { label: 'Surpoids',      color: 'var(--accent-warm)',   pct: (v / 40) * 100 };
    return            { label: 'Obésité',          color: 'var(--color-danger)',  pct: Math.min(98, (v / 40) * 100) };
  }

  /* ------------------------------------------
     SVG CHART
     ------------------------------------------ */
  function renderChart(logs) {
    const recent = logs.slice(-60);
    if (recent.length < 2) {
      return `<p class="empty-state-text" style="text-align:center;padding:16px 0;">
        Enregistre ton poids pour voir l'évolution
      </p>`;
    }

    const W = 320, H = 140, padL = 36, padR = 8, padT = 16, padB = 28;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    const values = recent.map(l => l.value);
    const minV   = Math.floor(Math.min(...values) - 1);
    const maxV   = Math.ceil(Math.max(...values) + 1);
    const range  = maxV - minV || 1;
    const n      = recent.length;

    const pts = recent.map((l, i) => ({
      x: padL + (i / Math.max(n - 1, 1)) * chartW,
      y: padT + (1 - (l.value - minV) / range) * chartH,
      date: l.date,
      value: l.value
    }));

    const polyline = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const areaPath = [
      `M ${pts[0].x.toFixed(1)},${(padT + chartH).toFixed(1)}`,
      ...pts.map(p => `L ${p.x.toFixed(1)},${p.y.toFixed(1)}`),
      `L ${pts[n - 1].x.toFixed(1)},${(padT + chartH).toFixed(1)} Z`
    ].join(' ');

    const midV   = ((minV + maxV) / 2).toFixed(1);
    const lastPt = pts[n - 1];

    // x-axis labels: first, middle, last
    const midIdx = Math.floor(n / 2);
    const xLabels = [
      { x: pts[0].x,       label: formatDateShort(recent[0].date) },
      { x: pts[midIdx].x,  label: formatDateShort(recent[midIdx].date) },
      { x: pts[n - 1].x,   label: formatDateShort(recent[n - 1].date) }
    ];

    return `
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block;overflow:visible;" aria-label="Courbe de poids">
        <!-- Grid horizontale mi-hauteur -->
        <line x1="${padL}" y1="${padT + chartH / 2}" x2="${W - padR}" y2="${padT + chartH / 2}"
              stroke="var(--border)" stroke-width="1" stroke-dasharray="4 4"/>
        <!-- Axes -->
        <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + chartH}"
              stroke="var(--border)" stroke-width="1"/>
        <line x1="${padL}" y1="${padT + chartH}" x2="${W - padR}" y2="${padT + chartH}"
              stroke="var(--border)" stroke-width="1"/>
        <!-- Area fill -->
        <path d="${areaPath}" fill="var(--accent)" opacity="0.1"/>
        <!-- Courbe -->
        <polyline points="${polyline}" fill="none"
                  stroke="var(--accent)" stroke-width="2.5"
                  stroke-linecap="round" stroke-linejoin="round"/>
        <!-- Dernier point mis en valeur -->
        <circle cx="${lastPt.x.toFixed(1)}" cy="${lastPt.y.toFixed(1)}" r="5"
                fill="var(--accent)" stroke="var(--bg-card)" stroke-width="2"/>
        <!-- Labels Y -->
        <text x="${padL - 4}" y="${padT + 4}"            text-anchor="end" font-size="9" fill="var(--cream-dim)" font-family="sans-serif">${maxV}</text>
        <text x="${padL - 4}" y="${padT + chartH / 2 + 4}" text-anchor="end" font-size="9" fill="var(--cream-dim)" font-family="sans-serif">${midV}</text>
        <text x="${padL - 4}" y="${padT + chartH}"        text-anchor="end" font-size="9" fill="var(--cream-dim)" font-family="sans-serif">${minV}</text>
        <!-- Labels X -->
        ${xLabels.map(l =>
          `<text x="${l.x.toFixed(1)}" y="${padT + chartH + 14}"
                 text-anchor="middle" font-size="9" fill="var(--cream-dim)" font-family="sans-serif">${l.label}</text>`
        ).join('')}
      </svg>
    `;
  }

  /* ------------------------------------------
     RENDER
     ------------------------------------------ */
  function render() {
    const container = document.getElementById('weight-content');
    if (!container) return;

    const logs    = loadWeights();
    const profile = loadProfile();
    const measures = loadMeasurements();
    const today   = todayStr();
    const todayEntry = logs.find(l => l.date === today);
    const lastEntry  = logs.length ? logs[logs.length - 1] : null;
    const prevEntry  = logs.length > 1 ? logs[logs.length - 2] : null;

    // Delta vs yesterday
    let deltaHtml = '';
    if (lastEntry && prevEntry) {
      const diff = (lastEntry.value - prevEntry.value).toFixed(1);
      if (diff < 0)      deltaHtml = `<span class="weight-delta weight-delta-down">↓ ${Math.abs(diff)} kg</span>`;
      else if (diff > 0) deltaHtml = `<span class="weight-delta weight-delta-up">↑ ${diff} kg</span>`;
      else               deltaHtml = `<span class="weight-delta weight-delta-same">= stable</span>`;
    }

    // BMI
    const bmi     = calcBMI(lastEntry?.value, profile.height);
    const bmiInfo = getBMIInfo(bmi);

    container.innerHTML = `
      <!-- En-tête -->
      <header class="page-header">
        <p class="page-header-eyebrow">Suivi corporel</p>
        <h1 class="page-header-title">Poids</h1>
      </header>

      <!-- Carte poids actuel -->
      <div class="card" style="margin-bottom:12px;">
        ${lastEntry ? `
          <div class="weight-hero">
            <span class="weight-hero-value">${lastEntry.value.toFixed(1)}</span>
            <span class="weight-hero-unit">kg</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
            ${deltaHtml}
            <span class="card-subtitle">vs entrée précédente</span>
          </div>
        ` : `
          <p class="card-subtitle" style="margin-bottom:16px;">Aucune donnée — saisis ton poids ci-dessous</p>
        `}

        <!-- Saisie -->
        <div style="display:flex;gap:8px;align-items:center;">
          <input type="number" inputmode="decimal" step="0.1" min="30" max="300"
                 class="weight-input-big" id="weight-input"
                 placeholder="70.5"
                 value="${todayEntry ? todayEntry.value : ''}"
                 aria-label="Poids du jour en kg" />
          <div style="font-size:1.25rem;font-weight:600;color:var(--cream-dim);white-space:nowrap;">kg</div>
        </div>
        <button class="btn btn-primary btn-full" id="btn-save-weight" style="margin-top:10px;">
          ${todayEntry ? 'Mettre à jour' : 'Enregistrer'}
        </button>
      </div>

      <!-- Courbe d'évolution -->
      <div class="card" style="margin-bottom:12px;">
        <div class="section-header" style="margin-bottom:4px;">
          <h2 class="section-title">Évolution</h2>
          <span class="card-subtitle">${logs.length} entrée${logs.length > 1 ? 's' : ''}</span>
        </div>
        <div class="weight-chart-wrap">${renderChart(logs)}</div>
      </div>

      <!-- BMI -->
      <div class="card" style="margin-bottom:12px;">
        <div class="section-header" style="margin-bottom:8px;">
          <h2 class="section-title">IMC</h2>
        </div>
        ${bmi ? `
          <div class="bmi-row">
            <div>
              <div class="bmi-value">${bmi}</div>
              <div class="card-subtitle">kg/m²</div>
            </div>
            <span class="bmi-label" style="background:${bmiInfo.color}20;color:${bmiInfo.color};">${bmiInfo.label}</span>
          </div>
          <div class="bmi-bar-track">
            <div class="bmi-bar-cursor" style="left:${bmiInfo.pct}%;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:6px;">
            <span style="font-size:0.625rem;color:var(--cream-dim);">16</span>
            <span style="font-size:0.625rem;color:var(--cream-dim);">18.5</span>
            <span style="font-size:0.625rem;color:var(--cream-dim);">25</span>
            <span style="font-size:0.625rem;color:var(--cream-dim);">30</span>
            <span style="font-size:0.625rem;color:var(--cream-dim);">40</span>
          </div>
        ` : `
          <div style="display:flex;flex-direction:column;gap:8px;">
            <p class="card-subtitle">Entre ta taille pour calculer l'IMC</p>
            <div style="display:flex;gap:8px;align-items:center;">
              <input type="number" inputmode="numeric" step="1" min="100" max="250"
                     class="input" id="height-input"
                     placeholder="175"
                     value="${profile.height || ''}"
                     style="flex:1;" aria-label="Taille en cm" />
              <span style="color:var(--cream-dim);font-weight:600;">cm</span>
            </div>
            <button class="btn btn-secondary" id="btn-save-height">Enregistrer la taille</button>
          </div>
        `}
      </div>

      <!-- Mesures corporelles -->
      <div class="card" style="margin-bottom:12px;">
        <div class="section-header">
          <h2 class="section-title">Mensurations</h2>
          <button class="btn btn-ghost btn-sm" id="btn-save-measures">Sauvegarder</button>
        </div>
        <div class="measure-grid">
          ${[
            { key: 'waist',   label: 'Tour de taille' },
            { key: 'chest',   label: 'Poitrine' },
            { key: 'hips',    label: 'Hanches' },
            { key: 'arm',     label: 'Bras' },
            { key: 'thigh',   label: 'Cuisse' },
            { key: 'calf',    label: 'Mollet' }
          ].map(m => `
            <div class="measure-item">
              <label class="measure-label" for="m-${m.key}">${m.label} <span style="font-weight:400;text-transform:none;letter-spacing:0;">(cm)</span></label>
              <input type="number" inputmode="decimal" step="0.5" min="20" max="200"
                     class="measure-input" id="m-${m.key}"
                     placeholder="—"
                     value="${measures[m.key] || ''}"
                     aria-label="${m.label} en cm" />
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Taille si déjà renseignée mais IMC existe quand même — input éditable -->
      ${bmi ? `
        <div class="card" style="margin-bottom:12px;">
          <div class="section-header">
            <h2 class="section-title">Ma taille</h2>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <input type="number" inputmode="numeric" step="1" min="100" max="250"
                   class="input" id="height-input"
                   placeholder="175"
                   value="${profile.height || ''}"
                   style="flex:1;" aria-label="Taille en cm" />
            <span style="color:var(--cream-dim);font-weight:600;">cm</span>
            <button class="btn btn-secondary" id="btn-save-height" style="flex-shrink:0;">OK</button>
          </div>
        </div>
      ` : ''}
    `;

    bindEvents();
  }

  /* ------------------------------------------
     EVENTS
     ------------------------------------------ */
  function bindEvents() {
    // Sauvegarde du poids
    const btnSave = document.getElementById('btn-save-weight');
    if (btnSave) {
      btnSave.addEventListener('click', () => {
        const input = document.getElementById('weight-input');
        const val   = parseFloat(input?.value);
        if (!val || val < 30 || val > 300) {
          input?.classList.add('input-error');
          showToast('Poids invalide (30–300 kg)', 'error');
          if (navigator.vibrate) navigator.vibrate([30, 20, 30]);
          return;
        }
        saveWeight(todayStr(), val);
        showToast('Poids enregistré ✓', 'success');
        if (navigator.vibrate) navigator.vibrate(10);
        render();
      });
    }

    // Sauvegarde de la taille
    const btnHeight = document.getElementById('btn-save-height');
    if (btnHeight) {
      btnHeight.addEventListener('click', () => {
        const input  = document.getElementById('height-input');
        const val    = parseFloat(input?.value);
        if (!val || val < 100 || val > 250) {
          showToast('Taille invalide (100–250 cm)', 'error');
          return;
        }
        const prof = loadProfile();
        prof.height = val;
        saveProfile(prof);
        showToast('Taille enregistrée ✓', 'success');
        render();
      });
    }

    // Sauvegarde des mensurations
    const btnMeasures = document.getElementById('btn-save-measures');
    if (btnMeasures) {
      btnMeasures.addEventListener('click', () => {
        const keys = ['waist', 'chest', 'hips', 'arm', 'thigh', 'calf'];
        const data = {};
        keys.forEach(k => {
          const val = parseFloat(document.getElementById(`m-${k}`)?.value);
          if (val && val > 0) data[k] = val;
        });
        const existing = loadMeasurements();
        saveMeasurements({ ...existing, ...data });
        showToast('Mensurations sauvegardées ✓', 'success');
        if (navigator.vibrate) navigator.vibrate(10);
      });
    }

    // Enter sur les champs numériques
    const weightInput = document.getElementById('weight-input');
    if (weightInput) {
      weightInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('btn-save-weight')?.click();
      });
    }
  }

  /* ------------------------------------------
     INIT
     ------------------------------------------ */
  function init() {
    render();
  }

  document.addEventListener('tabchange', (e) => {
    if (e.detail.tab === 'weight') init();
  });

  return { init, render };

})();
