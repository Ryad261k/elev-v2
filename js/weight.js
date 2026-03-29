/* ============================================
   WEIGHT.JS — Module Poids & Mesures
   Élev v2
   ============================================ */

window.Weight = (() => {

  const WEIGHT_KEY  = 'elev-weight-logs';
  const MEASURE_KEY = 'elev-measurements';
  const PROFILE_KEY = 'elev-weight-profile';

  let _activeRange = 30; // jours affichés sur le graphique

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
    window.CloudState?.schedule({ elev_weight_logs: logs });
  }

  function loadMeasurements() {
    try { return JSON.parse(localStorage.getItem(getUserKey(MEASURE_KEY))) || {}; }
    catch { return {}; }
  }

  function saveMeasurements(data) {
    localStorage.setItem(getUserKey(MEASURE_KEY), JSON.stringify(data));
    window.CloudState?.schedule({ elev_measurements: data });
  }

  function loadProfile() {
    try { return JSON.parse(localStorage.getItem(getUserKey(PROFILE_KEY))) || { height: null }; }
    catch { return { height: null }; }
  }

  function saveProfile(data) {
    localStorage.setItem(getUserKey(PROFILE_KEY), JSON.stringify(data));
    window.CloudState?.schedule({ elev_weight_profile: data });
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
    if (v < 18.5) return { label: 'Insuffisant',  cls: 'underweight', pct: Math.max(2,  (v / 40) * 100) };
    if (v < 25)   return { label: 'Normal',        cls: 'normal',      pct: (v / 40) * 100 };
    if (v < 30)   return { label: 'Surpoids',      cls: 'overweight',  pct: (v / 40) * 100 };
    return              { label: 'Obésité',         cls: 'overweight',  pct: Math.min(98, (v / 40) * 100) };
  }

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
     SVG LINE CHART
     ------------------------------------------ */
  function buildChart(logs, rangeDays) {
    const W = 320, H = 100, pL = 28, pR = 8, pT = 6, pB = 22;
    const cW = W - pL - pR, cH = H - pT - pB;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - rangeDays);
    const cutStr = cutoff.toISOString().slice(0, 10);
    const slice  = logs.filter(l => l.date >= cutStr);

    if (slice.length < 2) {
      return `<div style="height:100px;display:flex;align-items:center;justify-content:center;">
        <p style="font-size:0.75rem;color:var(--cream-dim);opacity:0.5;">Pas assez de données</p>
      </div>`;
    }

    const vals   = slice.map(l => l.value);
    const minV   = Math.floor(Math.min(...vals)) - 1;
    const maxV   = Math.ceil(Math.max(...vals))  + 1;
    const rangeV = maxV - minV || 1;

    const toX = i => pL + (i / (slice.length - 1)) * cW;
    const toY = v => pT + (1 - (v - minV) / rangeV) * cH;

    const pts  = slice.map((l, i) => `${toX(i).toFixed(1)},${toY(l.value).toFixed(1)}`).join(' ');
    const last = slice[slice.length - 1];
    const lx   = toX(slice.length - 1);
    const ly   = toY(last.value);

    const fillPts = `${pL.toFixed(1)},${(pT + cH).toFixed(1)} ${pts} ${lx.toFixed(1)},${(pT + cH).toFixed(1)}`;

    const mid = ((minV + maxV) / 2).toFixed(0);
    const yLabels = [
      { v: maxV, y: toY(maxV) },
      { v: mid,  y: toY(parseFloat(mid)) },
      { v: minV, y: toY(minV) },
    ];

    const fmt = d => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    const midIdx = Math.floor(slice.length / 2);
    const xLabels = [
      { label: fmt(slice[0].date),       x: pL,    anchor: 'start' },
      { label: fmt(slice[midIdx].date),  x: toX(midIdx), anchor: 'middle' },
      { label: fmt(last.date),           x: lx,    anchor: 'end' },
    ];

    const uid = `wt-grad-${Math.random().toString(36).slice(2)}`;

    return `
      <div class="wt-chart-svg-wrap">
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:100%;overflow:visible;">
          <defs>
            <linearGradient id="${uid}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stop-color="#C8622E" stop-opacity="0.25"/>
              <stop offset="100%" stop-color="#C8622E" stop-opacity="0"/>
            </linearGradient>
          </defs>
          ${yLabels.map(yl => `
            <line x1="${pL}" y1="${yl.y.toFixed(1)}" x2="${W - pR}" y2="${yl.y.toFixed(1)}"
                  stroke="rgba(255,255,255,0.06)" stroke-width="0.8"/>
            <text x="${(pL - 3).toFixed(1)}" y="${(yl.y + 3).toFixed(1)}"
                  text-anchor="end" font-size="7" fill="var(--cream-dim)" opacity="0.5"
                  font-family="sans-serif">${yl.v}</text>
          `).join('')}
          <polygon points="${fillPts}" fill="url(#${uid})" class="wt-chart-fill"/>
          <polyline points="${pts}" class="wt-chart-line"/>
          <circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="4"
                  fill="#C8622E" stroke="var(--bg-card)" stroke-width="2"/>
          ${xLabels.map(xl => `
            <text x="${xl.x.toFixed(1)}" y="${H}" text-anchor="${xl.anchor}"
                  font-size="7" fill="var(--cream-dim)" opacity="0.5"
                  font-family="sans-serif">${xl.label}</text>
          `).join('')}
        </svg>
      </div>`;
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

    let deltaHtml = '';
    if (lastEntry && prevEntry) {
      const diff = (lastEntry.value - prevEntry.value).toFixed(1);
      if (parseFloat(diff) < 0)
        deltaHtml = `<div class="wt-delta-badge down">↓ ${Math.abs(diff)} kg</div>`;
      else if (parseFloat(diff) > 0)
        deltaHtml = `<div class="wt-delta-badge up">↑ ${diff} kg</div>`;
      else
        deltaHtml = `<div class="wt-delta-badge same">= stable</div>`;
    }

    const bmi     = calcBMI(lastEntry?.value, heightCm);
    const bmiInfo = getBMIInfo(bmi);
    const bf      = calcBodyFat(measures, heightCm, sex);

    const ranges      = [7, 30, 90, 365];
    const rangeLabels = ['7j', '30j', '3m', '1an'];
    const pillsHtml   = ranges.map((r, i) =>
      `<button class="wt-chart-pill${_activeRange === r ? ' active' : ''}" data-range="${r}">${rangeLabels[i]}</button>`
    ).join('');

    const MEASURES_DEF = [
      { key: 'neck',  label: 'Tour de cou' },
      { key: 'waist', label: 'Tour de taille' },
      { key: 'chest', label: 'Poitrine' },
      { key: 'hips',  label: 'Hanches' },
      { key: 'arm',   label: 'Bras' },
      { key: 'thigh', label: 'Cuisse' },
      { key: 'calf',  label: 'Mollet' },
    ];

    container.innerHTML = `
      <div class="wt-header">
        <div class="wt-eyebrow">Suivi corporel</div>
        <div class="wt-title">Poids</div>
      </div>

      <div class="wt-hero-card">
        ${lastEntry ? `
          <div class="wt-display-row">
            <span class="wt-big-num">${lastEntry.value.toFixed(1)}</span>
            <span class="wt-unit">kg</span>
            ${deltaHtml}
          </div>
        ` : `<p style="font-size:0.85rem;color:var(--cream-dim);margin-bottom:14px;">Aucune donnée — saisis ton poids</p>`}
        <div class="wt-input-row">
          <div class="wt-input-wrap">
            <input type="number" inputmode="decimal" step="0.1" min="30" max="300"
                   class="wt-num-input" id="weight-input"
                   placeholder="70.5" value="${todayEntry ? todayEntry.value : ''}"
                   aria-label="Poids du jour en kg"/>
            <span class="wt-input-suffix">kg</span>
          </div>
          <button class="wt-save-btn" id="btn-save-weight">
            ${todayEntry ? 'Mettre à jour' : 'Enregistrer'}
          </button>
        </div>
      </div>

      <div class="wt-chart-card">
        <div class="wt-chart-header">
          <span class="wt-chart-label">Évolution</span>
          <div class="wt-chart-pills" id="wt-pills">${pillsHtml}</div>
        </div>
        <div id="wt-chart-area">${buildChart(logs, _activeRange)}</div>
      </div>

      ${bmi ? `
        <div class="wt-composition-card">
          <div class="wt-comp-label">Composition</div>
          <div class="wt-imc-row">
            <div class="wt-imc-num">${bmi}</div>
            <div class="wt-imc-info">
              <div class="wt-imc-sublabel">IMC (kg/m²)</div>
              <span class="wt-imc-badge ${bmiInfo.cls}">${bmiInfo.label}</span>
            </div>
          </div>
          <div class="wt-bmi-track">
            <div class="wt-bmi-cursor" style="left:${bmiInfo.pct.toFixed(1)}%;"></div>
          </div>
          <div class="wt-bmi-scale">
            ${['16','18.5','25','30','40'].map(v => `<span>${v}</span>`).join('')}
          </div>
          ${bf ? `
            <div class="wt-bf-row">
              <div class="wt-bf-num">${bf}%</div>
              <div class="wt-bf-info">
                <div class="wt-bf-sublabel">Masse grasse (Navy)</div>
                <span class="wt-bf-badge">Estimé</span>
              </div>
            </div>
          ` : `<p style="font-size:0.72rem;color:var(--cream-dim);opacity:0.6;margin-top:4px;">
            Ajoute tour de cou et taille pour estimer la masse grasse
          </p>`}
        </div>
      ` : `
        <div class="wt-composition-card">
          <div class="wt-comp-label">Ma taille</div>
          <p style="font-size:0.82rem;color:var(--cream-dim);margin-bottom:12px;">
            Entre ta taille pour calculer l'IMC
          </p>
          <div class="wt-input-row">
            <div class="wt-input-wrap">
              <input type="number" inputmode="numeric" step="1" min="100" max="250"
                     class="wt-num-input" id="height-input" placeholder="175"
                     value="${heightCm || ''}" aria-label="Taille en cm"/>
              <span class="wt-input-suffix">cm</span>
            </div>
            <button class="wt-save-btn" id="btn-save-height">OK</button>
          </div>
        </div>
      `}

      ${bmi ? `
        <div class="wt-composition-card" style="padding:14px 18px;">
          <div class="wt-input-row" style="align-items:center;gap:10px;">
            <span style="font-size:0.72rem;color:var(--cream-dim);opacity:0.7;white-space:nowrap;">Ma taille</span>
            <div class="wt-input-wrap">
              <input type="number" inputmode="numeric" step="1" min="100" max="250"
                     class="wt-num-input" id="height-input" placeholder="175"
                     value="${heightCm || ''}" style="padding:6px 36px 6px 12px;font-size:0.82rem;"
                     aria-label="Taille en cm"/>
              <span class="wt-input-suffix">cm</span>
            </div>
            <button class="wt-save-btn" id="btn-save-height" style="padding:6px 14px;font-size:0.75rem;">OK</button>
          </div>
        </div>
      ` : ''}

      <div class="wt-mensuration-card">
        <div class="wt-mensuration-header">
          <span class="wt-mensuration-title">Mensurations</span>
          <button class="btn btn-ghost btn-sm" id="btn-save-measures">Sauvegarder</button>
        </div>
        <div class="wt-mensuration-grid">
          ${MEASURES_DEF.map(m => `
            <div class="wt-mensuration-item">
              <div class="wt-mensuration-label">${m.label} (cm)</div>
              <input type="number" inputmode="decimal" step="0.5" min="20" max="200"
                     class="wt-mensuration-input" id="m-${m.key}" placeholder="—"
                     value="${measures[m.key] || ''}" aria-label="${m.label} en cm"/>
            </div>
          `).join('')}
        </div>
      </div>
    `;

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

    document.getElementById('wt-pills')?.addEventListener('click', e => {
      const pill = e.target.closest('[data-range]');
      if (!pill) return;
      _activeRange = parseInt(pill.dataset.range, 10);
      const logs = loadWeights();
      document.querySelectorAll('.wt-chart-pill').forEach(p => {
        p.classList.toggle('active', parseInt(p.dataset.range, 10) === _activeRange);
      });
      document.getElementById('wt-chart-area').innerHTML = buildChart(logs, _activeRange);
    });
  }

  /* ------------------------------------------
     INIT
     ------------------------------------------ */
  function init() { render(); }

  document.addEventListener('tabchange', e => { if (e.detail.tab === 'weight') init(); });

  return { init, render };

})();
