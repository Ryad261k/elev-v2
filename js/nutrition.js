window.Nutrition = (() => {

  const S     = { date: todayStr() };
  const GOALS = { kcal: 2400, protein: 180, carbs: 240, fat: 80, water: 2000 };

  function loadSavedGoals() {
    try {
      const g = JSON.parse(localStorage.getItem(`elev-nutrition-goals-${DB.userId()}`) || 'null');
      if (g) { GOALS.kcal = g.kcal; GOALS.protein = g.protein; GOALS.carbs = g.carbs; GOALS.fat = g.fat; }
    } catch {}
  }
  const CIRC  = 301.6; // 2π × r48
  const CATEGORIES = [
    { name: 'Petit-déjeuner', emoji: '☕', kcalGoal: 720 },
    { name: 'Déjeuner',       emoji: '🍽️', kcalGoal: 696 },
    { name: 'Dîner',          emoji: '🌙', kcalGoal: 696 },
    { name: 'Collation',      emoji: '🍎', kcalGoal: 288 },
  ];
  let navBound  = false;
  let activeCat = '';

  /* ── Date ──────────────────────────────────── */
  function todayStr() { return new Date().toISOString().slice(0, 10); }
  function formatDateLabel(d) {
    const today = todayStr();
    const yest  = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (d === today) return "Aujourd'hui";
    if (d === yest)  return 'Hier';
    return new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' });
  }
  function shiftDate(delta) {
    const d = new Date(S.date + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    return d.toISOString().slice(0, 10);
  }

  /* ── DB ────────────────────────────────────── */
  async function fetchDayMeals(date) {
    const { data, error } = await DB.from('meals')
      .select('id, name, created_at, meal_items(id, food_name, quantity_g, calories, protein, carbs, fat)')
      .eq('user_id', DB.userId()).eq('date', date).order('created_at');
    if (error) throw error;
    return data || [];
  }
  async function getOrCreateMeal(catName, date) {
    const meals = await fetchDayMeals(date);
    const ex = meals.find(m => m.name === catName);
    if (ex) return ex.id;
    const { data, error } = await DB.from('meals')
      .insert({ user_id: DB.userId(), name: catName, date }).select().single();
    if (error) throw error;
    return data.id;
  }
  async function addItemToMeal(mealId, item) {
    const { error } = await DB.from('meal_items').insert({
      meal_id: mealId, food_name: item.name,
      quantity_g: item.qty || null,
      calories: item.kcal, protein: item.protein,
      carbs: item.carbs,   fat: item.fat,
    });
    if (error) throw error;
  }
  async function deleteItemFromDB(id) {
    const { error } = await DB.from('meal_items').delete().eq('id', id);
    if (error) throw error;
  }

  /* ── Calculs ───────────────────────────────── */
  function calcTotals(meals) {
    return meals.reduce((t, m) => {
      (m.meal_items || []).forEach(it => {
        t.kcal += it.calories||0; t.protein += it.protein||0;
        t.carbs += it.carbs||0;   t.fat += it.fat||0;
      });
      return t;
    }, { kcal:0, protein:0, carbs:0, fat:0 });
  }
  function catKcal(meal) {
    return (meal?.meal_items || []).reduce((s, it) => s + (it.calories||0), 0);
  }

  /* ── Affichage macros ──────────────────────── */
  function updateMacroDisplay(tot) {
    const ring = document.getElementById('nutrition-ring');
    if (ring) ring.setAttribute('stroke-dashoffset',
      (CIRC * (1 - Math.min(tot.kcal / GOALS.kcal, 1))).toFixed(1));
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = Math.round(v); };
    const bar = (id, v, g) => { const el = document.getElementById(id); if (el) el.style.width = Math.min(v / g * 100, 100) + '%'; };
    set('nutrition-kcal-eaten',     tot.kcal);
    set('nutrition-kcal-remaining', Math.max(0, GOALS.kcal - Math.round(tot.kcal)));
    set('nutrition-protein', tot.protein); bar('nutrition-protein-bar', tot.protein, GOALS.protein);
    set('nutrition-carbs',   tot.carbs);   bar('nutrition-carbs-bar',   tot.carbs,   GOALS.carbs);
    set('nutrition-fat',     tot.fat);     bar('nutrition-fat-bar',     tot.fat,     GOALS.fat);
    // Objectifs dynamiques
    set('goal-protein', GOALS.protein);
    set('goal-carbs',   GOALS.carbs);
    set('goal-fat',     GOALS.fat);
  }

  /* ── Catégories (Yazio style) ──────────────── */
  function renderMealsList(meals) {
    const list = document.getElementById('nutrition-meals-list');
    if (!list) return;
    list.innerHTML = CATEGORIES.map((cat, ci) => {
      const meal  = meals.find(m => m.name === cat.name);
      const items = meal?.meal_items || [];
      const eaten = Math.round(catKcal(meal));
      const itemsHtml = items.map(it => `
        <div class="cat-item-row" style="padding-left:72px;">
          <div class="cat-item-info">
            <span class="cat-item-name">${it.food_name}${it.quantity_g ? ` · <span class="cat-item-qty">${it.quantity_g}g</span>` : ''}</span>
            <span class="cat-item-macros">${Math.round(it.calories)} kcal · ${Math.round(it.protein)}P ${Math.round(it.carbs)}G ${Math.round(it.fat)}L</span>
          </div>
          <button class="cat-item-del btn" data-del="${it.id}" aria-label="Supprimer">✕</button>
        </div>`).join('');
      return `
        <div class="${ci > 0 ? 'nutr-cat-border' : ''}">
          <div class="nutr-cat-row">
            <div class="nutr-cat-icon">${cat.emoji}</div>
            <div class="nutr-cat-info" data-cat="${cat.name}" style="cursor:pointer;">
              <p class="nutr-cat-name">${cat.name} <span style="color:var(--cream-dim);font-weight:400;">›</span></p>
              <p class="nutr-cat-kcal">${eaten} / ${cat.kcalGoal} kcal</p>
            </div>
            <button class="nutr-cat-copy" data-cat="${cat.name}" aria-label="Copier repas">📋</button>
            <button class="nutr-cat-add" data-cat="${cat.name}" aria-label="Ajouter">+</button>
          </div>
          ${items.length ? `<div>${itemsHtml}</div>` : ''}
        </div>`;
    }).join('');

    list.querySelectorAll('[data-cat]').forEach(el =>
      el.addEventListener('click', e => { e.stopPropagation(); openPicker(el.dataset.cat); })
    );
    list.querySelectorAll('.nutr-cat-copy').forEach(btn =>
      btn.addEventListener('click', e => { e.stopPropagation(); openCopyMealModal(btn.dataset.cat); })
    );
    list.querySelectorAll('[data-del]').forEach(b =>
      b.addEventListener('click', async e => {
        e.stopPropagation();
        try { await deleteItemFromDB(b.dataset.del); await renderDay(); }
        catch(_) { showToast('Erreur suppression', 'error'); }
      })
    );
  }

  /* ── Copier un repas passé ──────────────────── */
  async function openCopyMealModal(catName) {
    let modal = document.getElementById('modal-copy-meal');
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'modal-backdrop'; modal.id = 'modal-copy-meal';
      modal.innerHTML = `<div class="modal"><div class="modal-handle"></div>
        <div class="modal-header">
          <p class="modal-title" id="copy-meal-title">Copier un repas</p>
          <button class="btn btn-icon" id="close-copy-modal">✕</button>
        </div>
        <div id="copy-meal-body" style="overflow-y:auto;max-height:60dvh;padding:16px;"></div>
      </div>`;
      document.body.appendChild(modal);
      modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });
      modal.querySelector('#close-copy-modal').addEventListener('click', () => modal.classList.remove('open'));
    }
    document.getElementById('copy-meal-title').textContent = `Copier — ${catName}`;
    const body = document.getElementById('copy-meal-body');
    body.innerHTML = '<div style="display:flex;justify-content:center;padding:24px;"><div class="spinner"></div></div>';
    requestAnimationFrame(() => modal.classList.add('open'));

    try {
      const since = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
      const { data } = await DB.from('meals')
        .select('id, date, meal_items(id, food_name, quantity_g, calories, protein, carbs, fat)')
        .eq('user_id', DB.userId()).eq('name', catName).gte('date', since)
        .neq('date', S.date).order('date', { ascending: false }).limit(10);
      const meals = (data || []).filter(m => m.meal_items?.length);
      if (!meals.length) { body.innerHTML = '<p class="card-subtitle" style="text-align:center;padding:24px 0;">Aucun repas récent à copier.</p>'; return; }
      body.innerHTML = meals.map(m => `
        <div style="padding:12px 0;border-bottom:1px solid var(--border);">
          <div class="flex items-center justify-between" style="margin-bottom:6px;">
            <p style="font-weight:500;color:var(--cream);">${new Date(m.date + 'T12:00:00').toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'})}</p>
            <button class="btn btn-secondary btn-sm" data-mealid="${m.id}">Copier tout</button>
          </div>
          <p class="card-subtitle" style="font-size:0.75rem;">${m.meal_items.map(it => `${it.food_name}${it.quantity_g ? ` ${it.quantity_g}g` : ''}`).join(' · ')}</p>
        </div>`).join('');
      body.querySelectorAll('[data-mealid]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const meal = meals.find(m => m.id === btn.dataset.mealid);
          if (!meal) return;
          try {
            const mealId = await getOrCreateMeal(catName, S.date);
            for (const it of meal.meal_items) {
              await addItemToMeal(mealId, { name: it.food_name, qty: it.quantity_g, kcal: it.calories, protein: it.protein, carbs: it.carbs, fat: it.fat });
            }
            modal.classList.remove('open');
            showToast(`${meal.meal_items.length} aliment(s) copiés ✓`, 'success');
            await renderDay();
          } catch(_) { showToast('Erreur lors de la copie', 'error'); }
        });
      });
    } catch(_) { body.innerHTML = '<p class="card-subtitle" style="text-align:center;padding:16px 0;">Erreur de chargement</p>'; }
  }

  /* ── Ouvrir le picker ──────────────────────── */
  function openPicker(catName) {
    activeCat = catName;
    FoodPicker.open(catName, async item => {
      try {
        const mealId = await getOrCreateMeal(activeCat, S.date);
        await addItemToMeal(mealId, item);
        showToast('Aliment ajouté ✓', 'success');
        await renderDay();
      } catch (err) {
        console.error('[Nutrition] saveFood:', err);
        showToast('Erreur lors de la sauvegarde', 'error');
      }
    });
  }

  /* ── Rendu jour ────────────────────────────── */
  async function renderDay() {
    const dateEl  = document.getElementById('nutrition-date');
    const nextBtn = document.getElementById('nutrition-next-day');
    if (dateEl)  dateEl.textContent = formatDateLabel(S.date);
    if (nextBtn) nextBtn.disabled   = S.date >= todayStr();
    try {
      const meals = await fetchDayMeals(S.date);
      updateMacroDisplay(calcTotals(meals));
      renderMealsList(meals);
    } catch (err) {
      console.error('[Nutrition] renderDay:', err);
      showToast('Erreur de chargement', 'error');
    }
  }

  /* ── Hydratation (localStorage) ────────────── */
  function waterKey() {
    return `elev-water-${DB.userId()}-${S.date}`;
  }
  function getWater()          { return parseInt(localStorage.getItem(waterKey()) || '0', 10); }
  function addWater(ml)        { localStorage.setItem(waterKey(), getWater() + ml); renderWater(); if (navigator.vibrate) navigator.vibrate(6); }
  function resetWater()        { localStorage.setItem(waterKey(), '0'); renderWater(); }

  function renderWater() {
    const el = document.getElementById('nutrition-hydration');
    if (!el) return;
    const ml  = getWater();
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
      b.addEventListener('click', () => addWater(parseInt(b.dataset.ml)))
    );
    el.querySelector('#btn-reset-water')?.addEventListener('click', resetWater);
  }

  /* ── Tendances nutrition (7 derniers jours) ── */
  async function renderWeeklyTrends() {
    const el = document.getElementById('nutrition-trends');
    if (!el) return;
    try {
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        days.push(d.toISOString().slice(0, 10));
      }
      const { data } = await DB.from('meals')
        .select('date, meal_items(calories)')
        .eq('user_id', DB.userId())
        .in('date', days);
      const byDay = {};
      (data || []).forEach(m => {
        byDay[m.date] = (byDay[m.date] || 0) + (m.meal_items || []).reduce((s, it) => s + (it.calories || 0), 0);
      });
      const values = days.map(d => byDay[d] || 0);
      const maxV   = Math.max(...values, GOALS.kcal, 1);
      const W = 320, H = 80, pL = 4, pR = 4, pT = 4, pB = 20;
      const cW = W - pL - pR, cH = H - pT - pB;
      const bW = cW / days.length;
      const dayLabels = ['L','M','M','J','V','S','D'];
      const today = todayStr();
      const svg = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block;" aria-label="Calories 7 jours">
        <!-- Ligne objectif -->
        <line x1="${pL}" y1="${(pT + cH * (1 - GOALS.kcal / maxV)).toFixed(1)}" x2="${W-pR}" y2="${(pT + cH * (1 - GOALS.kcal / maxV)).toFixed(1)}"
              stroke="var(--accent-warm)" stroke-width="1" stroke-dasharray="4 3" opacity="0.7"/>
        ${days.map((d, i) => {
          const h = Math.max((values[i] / maxV) * cH, values[i] > 0 ? 2 : 0);
          const x = pL + i * bW + 2;
          const y = pT + cH - h;
          const dow = new Date(d + 'T12:00:00').getDay();
          const label = dayLabels[(dow + 6) % 7];
          const isToday = d === today;
          return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bW-4).toFixed(1)}" height="${h.toFixed(1)}"
                        fill="${isToday ? 'var(--accent-primary)' : values[i] > 0 ? 'var(--accent)' : 'var(--bg-surface)'}" rx="3" opacity="${isToday ? '1' : '0.75'}"/>
                  <text x="${(x+(bW-4)/2).toFixed(1)}" y="${H-4}" text-anchor="middle"
                        font-size="8" fill="${isToday ? 'var(--accent-primary)' : 'var(--cream-dim)'}" font-family="sans-serif" font-weight="${isToday ? '600' : '400'}">${label}</text>`;
        }).join('')}
      </svg>`;
      const avg = Math.round(values.filter(v => v > 0).reduce((s, v) => s + v, 0) / Math.max(values.filter(v => v > 0).length, 1));
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

  /* ── Init ───────────────────────────────────── */
  function bindStaticElements() {
    if (navBound) return;
    navBound = true;
    document.getElementById('nutrition-prev-day')?.addEventListener('click', () => {
      S.date = shiftDate(-1); renderDay(); renderWater();
    });
    document.getElementById('nutrition-next-day')?.addEventListener('click', () => {
      if (S.date < todayStr()) { S.date = shiftDate(1); renderDay(); renderWater(); }
    });
    document.getElementById('btn-open-recipes')?.addEventListener('click', () => Recipes.openManager());
    document.getElementById('btn-edit-goals')?.addEventListener('click', openGoalsModal);
  }

  /* ── Modal objectifs ────────────────────── */
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
      modal.querySelector('#save-goals-btn').addEventListener('click', () => {
        const v = id => parseInt(document.getElementById(id)?.value) || 0;
        const g = { kcal: v('g-kcal'), protein: v('g-protein'), carbs: v('g-carbs'), fat: v('g-fat') };
        if (!g.kcal) { showToast('Entre un objectif calorique', 'error'); return; }
        GOALS.kcal = g.kcal; GOALS.protein = g.protein; GOALS.carbs = g.carbs; GOALS.fat = g.fat;
        localStorage.setItem(`elev-nutrition-goals-${DB.userId()}`, JSON.stringify(g));
        modal.classList.remove('open');
        showToast('Objectifs mis à jour ✓', 'success');
        renderDay();
      });
    }
    document.getElementById('g-kcal').value    = GOALS.kcal;
    document.getElementById('g-protein').value = GOALS.protein;
    document.getElementById('g-carbs').value   = GOALS.carbs;
    document.getElementById('g-fat').value     = GOALS.fat;
    requestAnimationFrame(() => modal.classList.add('open'));
  }

  async function init() {
    loadSavedGoals();
    S.date = todayStr();
    bindStaticElements();
    await renderDay();
    renderWater();
    renderWeeklyTrends();
  }

  document.addEventListener('tabchange', e => { if (e.detail.tab === 'nutrition') init(); });
  return { init };

})();
