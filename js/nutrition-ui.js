/* ============================================
   NUTRITION-UI.JS — Goal math, macros, water, trends, goals modal
   Élev v2  (nutrition.js doit être chargé avant)
   ============================================ */

window.NutritionUI = (() => {

  const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 };
  const GOAL_FIELDS   = ['protein', 'carbs', 'fat'];
  const NS = () => window.Nutrition._state; // { GOALS }

  /* ── Goal math ─────────────────────────────── */
  function goalCalories(goals) {
    return GOAL_FIELDS.reduce((sum, key) => sum + ((goals[key] || 0) * KCAL_PER_GRAM[key]), 0);
  }
  function roundGoal(value) { return Math.max(0, Math.round(value || 0)); }
  function normalizeGoalSet(goals) {
    return { kcal: roundGoal(goals.kcal), protein: roundGoal(goals.protein), carbs: roundGoal(goals.carbs), fat: roundGoal(goals.fat) };
  }
  function fallbackMacroShares() {
    const G = NS().GOALS;
    const fc = goalCalories(G);
    if (fc > 0) return { protein: (G.protein * KCAL_PER_GRAM.protein) / fc, carbs: (G.carbs * KCAL_PER_GRAM.carbs) / fc, fat: (G.fat * KCAL_PER_GRAM.fat) / fc };
    return { protein: 0.3, carbs: 0.45, fat: 0.25 };
  }
  function rebalanceGoals(baseGoals, changedField) {
    const goals = normalizeGoalSet(baseGoals);
    if (!changedField || changedField === 'kcal') {
      const targetCalories = roundGoal(goals.kcal);
      const currentCalories = goalCalories(goals);
      if (currentCalories > 0) {
        const factor = targetCalories / currentCalories;
        GOAL_FIELDS.forEach(key => { goals[key] = roundGoal(goals[key] * factor); });
      } else {
        const shares = fallbackMacroShares();
        GOAL_FIELDS.forEach(key => { goals[key] = roundGoal((targetCalories * shares[key]) / KCAL_PER_GRAM[key]); });
      }
      goals.kcal = targetCalories;
      return goals;
    }
    if (changedField === 'protein' || changedField === 'fat') {
      const targetCalories = Math.max(roundGoal(goals.kcal), 0);
      const remainingForCarbs = targetCalories - ((goals.protein || 0) * KCAL_PER_GRAM.protein) - ((goals.fat || 0) * KCAL_PER_GRAM.fat);
      goals.carbs = roundGoal(remainingForCarbs / KCAL_PER_GRAM.carbs);
      goals.kcal = targetCalories;
      return goals;
    }
    if (changedField === 'carbs') {
      goals.kcal = roundGoal(goalCalories(goals));
      return goals;
    }
    const targetCalories = Math.max(roundGoal(goals.kcal), 0);
    const changedCalories = (goals[changedField] || 0) * KCAL_PER_GRAM[changedField];
    const otherFields = GOAL_FIELDS.filter(key => key !== changedField);
    const remainingCalories = Math.max(targetCalories - changedCalories, 0);
    const currentOtherCalories = otherFields.reduce((sum, key) => sum + ((goals[key] || 0) * KCAL_PER_GRAM[key]), 0);
    const G = NS().GOALS;
    const fallbackOtherCalories = otherFields.reduce((sum, key) => sum + ((G[key] || 0) * KCAL_PER_GRAM[key]), 0);
    otherFields.forEach(key => {
      const baseCalories = currentOtherCalories > 0
        ? (goals[key] || 0) * KCAL_PER_GRAM[key]
        : (fallbackOtherCalories > 0 ? (G[key] || 0) * KCAL_PER_GRAM[key] : (key === 'fat' ? 0.25 : 0.375));
      const share = currentOtherCalories > 0
        ? baseCalories / currentOtherCalories
        : (fallbackOtherCalories > 0 ? baseCalories / fallbackOtherCalories : baseCalories);
      goals[key] = roundGoal((remainingCalories * share) / KCAL_PER_GRAM[key]);
    });
    goals.kcal = targetCalories;
    return goals;
  }
  function bindGoalAutoSync(modal) {
    const inputMap = { kcal: modal.querySelector('#g-kcal'), protein: modal.querySelector('#g-protein'), carbs: modal.querySelector('#g-carbs'), fat: modal.querySelector('#g-fat') };
    let syncing = false;
    const readGoals  = () => ({ kcal: parseInt(inputMap.kcal?.value, 10) || 0, protein: parseInt(inputMap.protein?.value, 10) || 0, carbs: parseInt(inputMap.carbs?.value, 10) || 0, fat: parseInt(inputMap.fat?.value, 10) || 0 });
    const writeGoals = g => { inputMap.kcal.value = g.kcal; inputMap.protein.value = g.protein; inputMap.carbs.value = g.carbs; inputMap.fat.value = g.fat; };
    const syncFrom   = f => { if (syncing) return; syncing = true; writeGoals(rebalanceGoals(readGoals(), f)); syncing = false; };
    Object.entries(inputMap).forEach(([field, input]) => { input?.addEventListener('input', () => syncFrom(field)); });
    return {
      hydrate(goals) { syncing = true; writeGoals(normalizeGoalSet(goals)); syncing = false; },
      read() { return normalizeGoalSet(readGoals()); },
    };
  }

  /* ── Macro display ─────────────────────────── */
  function updateMacroDisplay(tot) {
    const GOALS = NS().GOALS;

    // Hero kcal
    const kcalEl = document.getElementById('nutrition-kcal-eaten');
    if (kcalEl) kcalEl.textContent = Math.round(tot.kcal);

    // Pct badge
    const pct = Math.min(Math.round(tot.kcal / (GOALS.kcal || 1) * 100), 100);
    const pctEl = document.getElementById('nutr-hero-pct');
    if (pctEl) pctEl.textContent = '🎯 ' + pct + '%';

    // Goal sub-label
    const goalEl = document.querySelector('[data-goal-kcal]');
    if (goalEl) goalEl.textContent = GOALS.kcal;

    // Macro chips values
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = Math.round(v); };
    set('nutrition-protein', tot.protein);
    set('nutrition-carbs',   tot.carbs);
    set('nutrition-fat',     tot.fat);

    // Macro chip bars (width %)
    const bar = (id, v, g) => { const el = document.getElementById(id); if (el) el.style.width = Math.min(v / (g || 1) * 100, 100) + '%'; };
    bar('nutrition-protein-bar', tot.protein, GOALS.protein);
    bar('nutrition-carbs-bar',   tot.carbs,   GOALS.carbs);
    bar('nutrition-fat-bar',     tot.fat,     GOALS.fat);

    // Legacy compat (hidden elements)
    const CIRC = 251;
    const ring = document.getElementById('nutrition-ring');
    if (ring) ring.setAttribute('stroke-dashoffset', (CIRC * (1 - Math.min(tot.kcal / GOALS.kcal, 1))).toFixed(1));
    const remEl = document.getElementById('nutrition-kcal-remaining');
    if (remEl) remEl.textContent = Math.max(0, GOALS.kcal - Math.round(tot.kcal));
    const netEl = document.getElementById('nutrition-net-goal');
    if (netEl) netEl.textContent = GOALS.kcal;
    set('goal-protein', GOALS.protein); set('goal-carbs', GOALS.carbs); set('goal-fat', GOALS.fat);
  }

  /* ── Micros ────────────────────────────────── */
  function renderMicros(meals) {
    const el = document.getElementById('nutrition-micros');
    if (!el) return;
    let f = 0, s = 0;
    meals.forEach(m => (m.meal_items || []).forEach(it => {
      const fd = FoodDB.search(it.food_name).find(x => x.name === it.food_name);
      if (!fd) return;
      const r = (it.quantity_g || 100) / 100;
      f += (fd.fibres || 0) * r; s += (fd.sodium || 0) * r;
    }));
    el.innerHTML = f || s
      ? `<div class="micro-row"><span class="micro-chip">Fibres <strong>${Math.round(f)}g</strong></span><span class="micro-chip">Sodium <strong>${Math.round(s)}mg</strong></span></div>`
      : '';
  }

  /* ── Hydratation ───────────────────────────── */
  function waterKey(date)   { return `elev-water-${DB.userId()}-${date}`; }
  function getWater(date)   { return parseInt(localStorage.getItem(waterKey(date)) || '0', 10); }
  function syncWaterLogs()  {
    const uid = DB.userId();
    const out = {};
    try {
      Object.keys(localStorage).forEach(key => {
        const prefix = `elev-water-${uid}-`;
        if (!key.startsWith(prefix)) return;
        out[key.slice(prefix.length)] = parseInt(localStorage.getItem(key) || '0', 10) || 0;
      });
    } catch {}
    const trimmed = Object.fromEntries(Object.entries(out).sort((a, b) => a[0].localeCompare(b[0])).slice(-120));
    window.CloudState?.schedule({ elev_water_logs: trimmed });
  }
  function addWater(date, ml)   { localStorage.setItem(waterKey(date), getWater(date) + ml); syncWaterLogs(); renderWater(date); if (navigator.vibrate) navigator.vibrate(6); }
  function resetWater(date)     { localStorage.setItem(waterKey(date), '0'); syncWaterLogs(); renderWater(date); }

  function renderWater(date) {
    const el = document.getElementById('nutrition-hydration');
    if (!el) return;
    const GOALS = NS().GOALS;
    const ml  = getWater(date);
    const pct = Math.min(ml / GOALS.water * 100, 100).toFixed(1);
    el.innerHTML = `
      <div class="card" style="margin-top:20px;margin-bottom:8px;">
        <div class="section-header" style="margin-bottom:8px;">
          <h2 class="section-title">Hydratation 💧</h2>
          <span class="card-subtitle">${ml} / ${GOALS.water} ml</span>
        </div>
        <div class="progress-bar" style="margin-bottom:12px;height:8px;">
          <div style="height:100%;width:${pct}%;background:var(--color-info);border-radius:4px;transition:width .4s ease;max-width:100%;"></div>
        </div>
        <div class="flex gap-8">
          <button class="btn btn-secondary btn-sm water-add" data-ml="150" style="flex:1;">+150 ml</button>
          <button class="btn btn-secondary btn-sm water-add" data-ml="250" style="flex:1;">+250 ml</button>
          <button class="btn btn-secondary btn-sm water-add" data-ml="500" style="flex:1;">+500 ml</button>
          <button class="btn btn-ghost btn-sm" id="btn-reset-water" aria-label="Réinitialiser" style="padding:8px 10px;">↺</button>
        </div>
      </div>`;
    el.querySelectorAll('.water-add').forEach(b =>
      b.addEventListener('click', () => addWater(date, parseInt(b.dataset.ml)))
    );
    el.querySelector('#btn-reset-water')?.addEventListener('click', () => resetWater(date));
  }

  /* ── Tendances nutrition ───────────────────── */
  async function renderWeeklyTrends() {
    const el = document.getElementById('nutrition-trends');
    if (!el) return;
    const GOALS = NS().GOALS;
    try {
      const days = [];
      for (let i = 6; i >= 0; i--)
        days.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
      const { data } = await DB.from('meals').select('date, meal_items(calories)').eq('user_id', DB.userId()).in('date', days);
      const byDay = {};
      (data || []).forEach(m => { byDay[m.date] = (byDay[m.date] || 0) + (m.meal_items || []).reduce((s, it) => s + (it.calories || 0), 0); });
      const values = days.map(d => byDay[d] || 0);
      const maxV   = Math.max(...values, GOALS.kcal, 1);
      const W = 320, H = 80, pL = 4, pR = 4, pT = 4, pB = 20;
      const cW = W - pL - pR, cH = H - pT - pB, bW = cW / days.length;
      const dayLabels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
      const today = new Date().toISOString().slice(0, 10);
      const svg = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block;" aria-label="Calories 7 jours">
        <line x1="${pL}" y1="${(pT + cH * (1 - GOALS.kcal / maxV)).toFixed(1)}" x2="${W - pR}" y2="${(pT + cH * (1 - GOALS.kcal / maxV)).toFixed(1)}"
              stroke="var(--accent-warm)" stroke-width="1" stroke-dasharray="4 3" opacity="0.7"/>
        ${days.map((d, i) => {
          const h = Math.max((values[i] / maxV) * cH, values[i] > 0 ? 2 : 0);
          const x = pL + i * bW + 2, y = pT + cH - h;
          const label = dayLabels[(new Date(d + 'T12:00:00').getDay() + 6) % 7];
          const isToday = d === today;
          return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bW - 4).toFixed(1)}" height="${h.toFixed(1)}"
                        fill="${isToday ? 'var(--accent-primary)' : values[i] > 0 ? 'var(--accent)' : 'var(--bg-surface)'}" rx="3" opacity="${isToday ? '1' : '0.75'}"/>
                  <text x="${(x + (bW - 4) / 2).toFixed(1)}" y="${H - 4}" text-anchor="middle"
                        font-size="8" fill="${isToday ? 'var(--accent-primary)' : 'var(--cream-dim)'}" font-family="sans-serif" font-weight="${isToday ? '600' : '400'}">${label}</text>`;
        }).join('')}
      </svg>`;
      const active = values.filter(v => v > 0);
      const avg = active.length ? Math.round(active.reduce((s, v) => s + v, 0) / active.length) : 0;
      el.innerHTML = `
        <div class="card" style="margin-top:20px;">
          <div class="section-header" style="margin-bottom:8px;">
            <h2 class="section-title">Tendances</h2>
            <span class="card-subtitle">Moy. ${avg} kcal/j</span>
          </div>
          ${svg}
          <div class="flex items-center gap-8" style="margin-top:8px;">
            <span style="display:inline-block;width:12px;height:3px;background:var(--accent-warm);border-radius:2px;"></span>
            <span style="font-size:0.75rem;color:var(--cream-dim);">Objectif ${GOALS.kcal} kcal</span>
          </div>
        </div>`;
    } catch (_) { el.innerHTML = ''; }
  }

  /* ── Modal objectifs ────────────────────────── */
  function openGoalsModal() {
    let modal = document.getElementById('modal-nutr-goals');
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'modal-backdrop';
      modal.id = 'modal-nutr-goals';
      modal.innerHTML = `
        <div class="modal">
          <div class="modal-handle"></div>
          <div class="modal-header">
            <p class="modal-title">Objectifs nutritionnels</p>
            <button class="btn btn-icon" id="close-goals-modal">✕</button>
          </div>
          <div style="padding:16px;display:flex;flex-direction:column;gap:12px;">
            <div class="form-group"><label>Calories (kcal)</label>
              <input type="number" id="g-kcal" class="input" min="1000" max="6000" inputmode="numeric"></div>
            <div class="form-group"><label>Protéines (g)</label>
              <input type="number" id="g-protein" class="input" min="0" max="500" inputmode="numeric"></div>
            <div class="form-group"><label>Glucides (g)</label>
              <input type="number" id="g-carbs" class="input" min="0" max="800" inputmode="numeric"></div>
            <div class="form-group"><label>Lipides (g)</label>
              <input type="number" id="g-fat" class="input" min="0" max="300" inputmode="numeric"></div>
            <button class="btn btn-primary btn-full" id="save-goals-btn">Enregistrer</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });
      modal.querySelector('#close-goals-modal').addEventListener('click', () => modal.classList.remove('open'));
      modal._goalSync = bindGoalAutoSync(modal);
      modal.querySelector('#save-goals-btn').addEventListener('click', () => {
        const GOALS = NS().GOALS;
        const g = normalizeGoalSet(modal._goalSync?.read() || GOALS);
        if (!g.kcal) { showToast('Entre un objectif calorique', 'error'); return; }
        GOALS.kcal = g.kcal; GOALS.protein = g.protein; GOALS.carbs = g.carbs; GOALS.fat = g.fat;
        localStorage.setItem(`elev-nutrition-goals-${DB.userId()}`, JSON.stringify(g));
        window.CloudState?.schedule({ elev_goals: g });
        modal.classList.remove('open');
        showToast('Objectifs mis à jour ✓', 'success');
        window.Nutrition.renderDay();
      });
    }
    modal._goalSync?.hydrate(NS().GOALS);
    requestAnimationFrame(() => modal.classList.add('open'));
  }

  return { updateMacroDisplay, renderMicros, renderWater, renderWeeklyTrends, openGoalsModal };
})();
