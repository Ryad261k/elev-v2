/* ============================================
   WEIGHT.JS — Module Poids & Mesures
   Élev v2
   ============================================ */

window.Weight = (() => {

  const WEIGHT_KEY  = 'elev-weight-logs';
  const MEASURE_KEY = 'elev-measurements';
  const PROFILE_KEY = 'elev-weight-profile';

  /* ------------------------------------------
     STORAGE
     ------------------------------------------ */
  function getUserKey(base) {
    return `${base}-${window.AppState?.user?.id || 'local'}`;
  }

  function loadWeights() {
    try { return JSON.parse(localStorage.getItem(getUserKey(WEIGHT_KEY))) || []; }
    catch { return []; }
  }

  function saveWeight(dateStr, value) {
    const logs = loadWeights();
    const idx  = logs.findIndex(l => l.date === dateStr);
    if (idx >= 0) logs[idx].value = parseFloat(value);
    else logs.push({ date: dateStr, value: parseFloat(value) });
    logs.sort((a, b) => a.date.localeCompare(b.date));
    localStorage.setItem(getUserKey(WEIGHT_KEY), JSON.stringify(logs));
  }

  function loadMeasurements() {
    try { return JSON.parse(localStorage.getItem(getUserKey(MEASURE_KEY))) || {}; }
    catch { return {}; }
  }

  function saveMeasurements(data) {
    localStorage.setItem(getUserKey(MEASURE_KEY), JSON.stringify(data));
  }

  function loadProfile() {
    try { return JSON.parse(localStorage.getItem(getUserKey(PROFILE_KEY))) || { height: null }; }
    catch { return { height: null }; }
  }

  function saveProfile(data) {
    localStorage.setItem(getUserKey(PROFILE_KEY), JSON.stringify(data));
  }

  function loadOnboardingProfile() {
    try { return JSON.parse(localStorage.getItem(`elev-profile-${window.AppState?.user?.id}`)) || null; }
    catch { return null; }
  }

  /* ------------------------------------------
     HELPERS
     ------------------------------------------ */
  function todayStr() { return new Date().toISOString().split('T')[0]; }

  function calcBMI(weightKg, heightCm) {
    if (!weightKg || !heightCm || heightCm < 50) return null;
    const h = heightCm / 100;
    return (weightKg / (h * h)).toFixed(1);
  }

  function getBMIInfo(bmi) {
    if (!bmi) return null;
    const v = parseFloat(bmi);
    if (v < 18.5) return { label: 'Insuffisant',  color: 'var(--color-info)',   pct: Math.max(2, (v/40)*100) };
    if (v < 25)   return { label: 'Normal',        color: 'var(--accent)',       pct: (v/40)*100 };
    if (v < 30)   return { label: 'Surpoids',      color: 'var(--accent-warm)', pct: (v/40)*100 };
    return            { label: 'Obésité',          color: 'var(--color-danger)', pct: Math.min(98, (v/40)*100) };
  }

  /* Formule Navy — renvoie % masse grasse ou null */
  function calcBodyFat(measures, heightCm, sex) {
    if (!heightCm || !measures.waist || !measures.neck) return null;
    const h = Math.log10(heightCm);
    if (sex === 'F' || sex === 'female') {
      if (!measures.hips) return null;
      const diff = measures.waist + measures.hips - measures.neck;
      if (diff <= 0) return null;
      return Math.max(0, 163.205 * Math.log10(diff) - 97.684 * h - 78.387).toFixed(1);
    }
    const diff = measures.waist - measures.neck;
    if (diff <= 0) return null;
    return Math.max(0, 86.010 * Math.log10(diff) - 70.041 * h + 36.76).toFixed(1);
  }

  /* ------------------------------------------
     RENDER
     ------------------------------------------ */
  function render() {
    const container = document.getElementById('weight-content');
    if (!container) return;

    const logs     = loadWeights();
    const profile  = loadProfile();
    const measures = loadMeasurements();
    const ob       = loadOnboardingProfile();
    const today    = todayStr();
    const todayEntry = logs.find(l => l.date === today);
    const lastEntry  = logs.length ? logs[logs.length - 1] : null;
    const prevEntry  = logs.length > 1 ? logs[logs.length - 2] : null;

    const heightCm = profile.height || ob?.height || null;
    const sex      = ob?.sex || null;

    // Delta
    let deltaHtml = '';
    if (lastEntry && prevEntry) {
      const diff = (lastEntry.value - prevEntry.value).toFixed(1);
      if (diff < 0)      deltaHtml = `<span class="weight-delta weight-delta-down">↓ ${Math.abs(diff)} kg</span>`;
      else if (diff > 0) deltaHtml = `<span class="weight-delta weight-delta-up">↑ ${diff} kg</span>`;
      else               deltaHtml = `<span class="weight-delta weight-delta-same">= stable</span>`;
    }

    const bmi     = calcBMI(lastEntry?.value, heightCm);
    const bmiInfo = getBMIInfo(bmi);
    const bf      = calcBodyFat(measures, heightCm, sex);

    container.innerHTML = `
      <header class="page-header">
        <p class="page-header-eyebrow">Suivi corporel</p>
        <h1 class="page-header-title">Poids</h1>
      </header>

      <!-- Poids actuel + saisie -->
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
        ` : `<p class="card-subtitle" style="margin-bottom:16px;">Aucune donnée — saisis ton poids ci-dessous</p>`}
        <div style="display:flex;gap:8px;align-items:center;">
          <input type="number" inputmode="decimal" step="0.1" min="30" max="300"
                 class="weight-input-big" id="weight-input"
                 placeholder="70.5" value="${todayEntry ? todayEntry.value : ''}"
                 aria-label="Poids du jour en kg"/>
          <div style="font-size:1.25rem;font-weight:600;color:var(--cream-dim);">kg</div>
        </div>
        <button class="btn btn-primary btn-full" id="btn-save-weight" style="margin-top:10px;">
          ${todayEntry ? 'Mettre à jour' : 'Enregistrer'}
        </button>
      </div>

      <!-- Courbe d'évolution avec filtres -->
      <div class="card" style="margin-bottom:12px;">
        <div class="section-header" style="margin-bottom:8px;">
          <h2 class="section-title">Évolution</h2>
          <span class="card-subtitle">${logs.length} entrée${logs.length > 1 ? 's' : ''}</span>
        </div>
        <div id="weight-chart-container"></div>
      </div>

      <!-- IMC + Masse grasse -->
      <div class="card" style="margin-bottom:12px;">
        <div class="section-header" style="margin-bottom:8px;">
          <h2 class="section-title">Composition</h2>
        </div>
        ${bmi ? `
          <div class="bmi-row">
            <div>
              <div class="bmi-value">${bmi}</div>
              <div class="card-subtitle">IMC (kg/m²)</div>
            </div>
            <span class="bmi-label" style="background:${bmiInfo.color}20;color:${bmiInfo.color};">${bmiInfo.label}</span>
          </div>
          <div class="bmi-bar-track" style="margin-bottom:6px;">
            <div class="bmi-bar-cursor" style="left:${bmiInfo.pct}%;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:${bf ? '16px' : '0'};">
            ${['16','18.5','25','30','40'].map(v => `<span style="font-size:0.625rem;color:var(--cream-dim);">${v}</span>`).join('')}
          </div>
          ${bf ? `
            <div class="bmi-row" style="margin-top:0;">
              <div>
                <div class="bmi-value">${bf}%</div>
                <div class="card-subtitle">Masse grasse (Navy)</div>
              </div>
              <span class="bmi-label" style="background:var(--accent)20;color:var(--accent);">Estimé</span>
            </div>
          ` : `<p class="card-subtitle" style="margin-top:4px;font-size:0.75rem;">Ajoute tour de cou et tour de taille pour estimer la masse grasse</p>`}
        ` : `
          <div style="display:flex;flex-direction:column;gap:8px;">
            <p class="card-subtitle">Entre ta taille pour calculer l'IMC</p>
            <div style="display:flex;gap:8px;align-items:center;">
              <input type="number" inputmode="numeric" step="1" min="100" max="250"
                     class="input" id="height-input" placeholder="175"
                     value="${heightCm || ''}" style="flex:1;" aria-label="Taille en cm"/>
              <span style="color:var(--cream-dim);font-weight:600;">cm</span>
            </div>
            <button class="btn btn-secondary" id="btn-save-height">Enregistrer la taille</button>
          </div>
        `}
      </div>

      <!-- Mensurations -->
      <div class="card" style="margin-bottom:12px;">
        <div class="section-header">
          <h2 class="section-title">Mensurations</h2>
          <button class="btn btn-ghost btn-sm" id="btn-save-measures">Sauvegarder</button>
        </div>
        <div class="measure-grid">
          ${[
            { key: 'neck',  label: 'Tour de cou'    },
            { key: 'waist', label: 'Tour de taille'  },
            { key: 'chest', label: 'Poitrine'        },
            { key: 'hips',  label: 'Hanches'         },
            { key: 'arm',   label: 'Bras'            },
            { key: 'thigh', label: 'Cuisse'          },
            { key: 'calf',  label: 'Mollet'          }
          ].map(m => `
            <div class="measure-item">
              <label class="measure-label" for="m-${m.key}">${m.label} <span style="font-weight:400;text-transform:none;letter-spacing:0;">(cm)</span></label>
              <input type="number" inputmode="decimal" step="0.5" min="20" max="200"
                     class="measure-input" id="m-${m.key}" placeholder="—"
                     value="${measures[m.key] || ''}" aria-label="${m.label} en cm"/>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Taille éditable si IMC déjà calculé -->
      ${bmi ? `
        <div class="card" style="margin-bottom:12px;">
          <div class="section-header"><h2 class="section-title">Ma taille</h2></div>
          <div style="display:flex;gap:8px;align-items:center;">
            <input type="number" inputmode="numeric" step="1" min="100" max="250"
                   class="input" id="height-input" placeholder="175"
                   value="${heightCm || ''}" style="flex:1;" aria-label="Taille en cm"/>
            <span style="color:var(--cream-dim);font-weight:600;">cm</span>
            <button class="btn btn-secondary" id="btn-save-height" style="flex-shrink:0;">OK</button>
          </div>
        </div>
      ` : ''}
    `;

    // Render chart with filters
    const chartEl = document.getElementById('weight-chart-container');
    if (chartEl) WeightChart.render(chartEl, logs, () => render());

    bindEvents();
  }

  /* ------------------------------------------
     EVENTS
     ------------------------------------------ */
  function bindEvents() {
    document.getElementById('btn-save-weight')?.addEventListener('click', () => {
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

    document.getElementById('btn-save-height')?.addEventListener('click', () => {
      const input = document.getElementById('height-input');
      const val   = parseFloat(input?.value);
      if (!val || val < 100 || val > 250) { showToast('Taille invalide (100–250 cm)', 'error'); return; }
      const prof = loadProfile();
      prof.height = val;
      saveProfile(prof);
      showToast('Taille enregistrée ✓', 'success');
      render();
    });

    document.getElementById('btn-save-measures')?.addEventListener('click', () => {
      const keys = ['neck', 'waist', 'chest', 'hips', 'arm', 'thigh', 'calf'];
      const data = {};
      keys.forEach(k => {
        const val = parseFloat(document.getElementById(`m-${k}`)?.value);
        if (val && val > 0) data[k] = val;
      });
      saveMeasurements({ ...loadMeasurements(), ...data });
      showToast('Mensurations sauvegardées ✓', 'success');
      if (navigator.vibrate) navigator.vibrate(10);
      render();
    });

    document.getElementById('weight-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('btn-save-weight')?.click();
    });
  }

  /* ------------------------------------------
     INIT
     ------------------------------------------ */
  function init() { render(); }

  document.addEventListener('tabchange', e => { if (e.detail.tab === 'weight') init(); });

  return { init, render };

})();
