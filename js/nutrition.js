/* ============================================
   NUTRITION.JS — Page repas, macros, catégories
   Modal food picker → food-picker.js · Élev v2
   ============================================ */

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
            <button class="nutr-cat-add" data-cat="${cat.name}" aria-label="Ajouter">+</button>
          </div>
          ${items.length ? `<div>${itemsHtml}</div>` : ''}
        </div>`;
    }).join('');

    list.querySelectorAll('[data-cat]').forEach(el =>
      el.addEventListener('click', e => { e.stopPropagation(); openPicker(el.dataset.cat); })
    );
    list.querySelectorAll('[data-del]').forEach(b =>
      b.addEventListener('click', async e => {
        e.stopPropagation();
        try { await deleteItemFromDB(b.dataset.del); await renderDay(); }
        catch(_) { showToast('Erreur suppression', 'error'); }
      })
    );
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
  }

  document.addEventListener('tabchange', e => { if (e.detail.tab === 'nutrition') init(); });
  return { init };

})();
