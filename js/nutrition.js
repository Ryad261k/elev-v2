window.Nutrition = (() => {

  const S     = { date: todayStr() };
  const GOALS = { kcal: 2400, protein: 180, carbs: 240, fat: 80, water: 2000 };

  function loadSavedGoals() {
    try {
      const g = JSON.parse(localStorage.getItem(`elev-nutrition-goals-${DB.userId()}`) || 'null');
      if (g) { GOALS.kcal = g.kcal; GOALS.protein = g.protein; GOALS.carbs = g.carbs; GOALS.fat = g.fat; }
    } catch {}
  }

  const CATEGORIES = [
    { name: 'Petit-déjeuner', emoji: '🌅', kcalGoal: 720, color: 'var(--accent-warm)',  colorDim: 'rgba(245,166,35,0.15)',  borderColor: 'rgba(245,166,35,0.5)'  },
    { name: 'Déjeuner',       emoji: '☀️', kcalGoal: 696, color: 'var(--accent-blue)',  colorDim: 'rgba(91,155,245,0.15)',  borderColor: 'rgba(91,155,245,0.5)'  },
    { name: 'Dîner',          emoji: '🌙', kcalGoal: 696, color: 'var(--accent-mauve)', colorDim: 'rgba(192,132,252,0.15)', borderColor: 'rgba(192,132,252,0.5)' },
    { name: 'Collation',      emoji: '🍎', kcalGoal: 288, color: 'var(--accent)',       colorDim: 'rgba(74,222,128,0.15)',  borderColor: 'rgba(74,222,128,0.5)'  },
  ];
  let navBound    = false;
  let activeCat   = '';
  let expandedCats = new Set();

  /* ── Date ──────────────────────────────────── */
  function todayStr() { return new Date().toISOString().slice(0, 10); }
  function formatDateLabel(d) {
    const today = todayStr();
    const yest  = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (d === today) return "Aujourd'hui";
    if (d === yest)  return 'Hier';
    return new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
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
    const payload = { meal_id: mealId, food_name: item.name, quantity_g: item.qty || null,
      calories: item.kcal, protein: item.protein, carbs: item.carbs, fat: item.fat };
    if (window.Offline) return Offline.tryInsert('meal_items', payload);
    const { error } = await DB.from('meal_items').insert(payload);
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
        t.kcal += it.calories || 0; t.protein += it.protein || 0;
        t.carbs += it.carbs || 0;   t.fat += it.fat || 0;
      });
      return t;
    }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  }
  function catKcal(meal) { return (meal?.meal_items || []).reduce((s, it) => s + (it.calories || 0), 0); }

  /* ── Liste repas ───────────────────────────── */
  function renderMealsList(meals) {
    const list = document.getElementById('nutrition-meals-list');
    if (!list) return;

    // Auto-expand categories with items
    CATEGORIES.forEach(cat => {
      const meal = meals.find(m => m.name === cat.name);
      if (meal?.meal_items?.length) expandedCats.add(cat.name);
    });

    list.innerHTML = CATEGORIES.map(cat => {
      const meal     = meals.find(m => m.name === cat.name);
      const items    = meal?.meal_items || [];
      const eaten    = Math.round(catKcal(meal));
      const tot      = items.reduce((t, it) => { t.p += it.protein||0; t.g += it.carbs||0; t.l += it.fat||0; return t; }, {p:0,g:0,l:0});
      const isExpanded = expandedCats.has(cat.name);
      const macroSub = items.length
        ? `${eaten} kcal · P ${Math.round(tot.p)}g · G ${Math.round(tot.g)}g · L ${Math.round(tot.l)}g`
        : 'Aucun aliment';

      const itemsHtml = items.map(it => `
        <div class="food-row-v2">
          <div class="food-left-v2">
            <div class="food-name-v2">${it.food_name}${it.quantity_g ? ` <span class="food-qty-v2">(${it.quantity_g}g)</span>` : ''}</div>
          </div>
          <div class="food-right-v2">
            <div class="food-macros-v2">
              <span class="food-macro-v2">P ${Math.round(it.protein)}g</span>
              <span class="food-macro-v2">G ${Math.round(it.carbs)}g</span>
              <span class="food-macro-v2">L ${Math.round(it.fat)}g</span>
            </div>
            <button class="btn-del-food-v2" data-del="${it.id}" aria-label="Supprimer">×</button>
          </div>
        </div>`).join('');

      return `
        <div class="meal-card-v2" data-meal-card="${cat.name}" style="border-left:3px solid ${cat.borderColor};">
          <div class="meal-header-v2" data-toggle="${cat.name}" style="cursor:pointer;">
            <div class="meal-left-v2">
              <div class="meal-emoji-box" style="background:${cat.colorDim};border-color:${cat.borderColor};">${cat.emoji}</div>
              <div>
                <div class="meal-name-v2">${cat.name}</div>
                <div class="meal-count-v2">${macroSub}</div>
              </div>
            </div>
            <span class="meal-chevron-v2" style="transform:${isExpanded ? 'rotate(90deg)' : 'none'};">›</span>
          </div>
          <div class="meal-expanded-v2" style="display:${isExpanded ? 'block' : 'none'};">
            ${itemsHtml}
            <button class="btn-add-food-inline" data-cat="${cat.name}">+ Ajouter un aliment</button>
          </div>
        </div>`;
    }).join('');

    // Toggle expand/collapse
    list.querySelectorAll('[data-toggle]').forEach(hdr => {
      hdr.addEventListener('click', () => {
        const catName = hdr.dataset.toggle;
        const card    = list.querySelector(`[data-meal-card="${catName}"]`);
        const body    = card?.querySelector('.meal-expanded-v2');
        const chev    = card?.querySelector('.meal-chevron-v2');
        if (!body) return;
        if (expandedCats.has(catName)) {
          expandedCats.delete(catName);
          body.style.display = 'none';
          if (chev) chev.style.transform = 'none';
        } else {
          expandedCats.add(catName);
          body.style.display = 'block';
          if (chev) chev.style.transform = 'rotate(90deg)';
        }
      });
    });

    list.querySelectorAll('.btn-add-food-inline').forEach(btn =>
      btn.addEventListener('click', e => { e.stopPropagation(); openPicker(btn.dataset.cat); })
    );
    list.querySelectorAll('[data-del]').forEach(b =>
      b.addEventListener('click', async e => {
        e.stopPropagation();
        try { await deleteItemFromDB(b.dataset.del); await renderDay(); }
        catch (_) { showToast('Erreur suppression', 'error'); }
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
            <p style="font-weight:500;color:var(--cream);">${new Date(m.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
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
            for (const it of meal.meal_items)
              await addItemToMeal(mealId, { name: it.food_name, qty: it.quantity_g, kcal: it.calories, protein: it.protein, carbs: it.carbs, fat: it.fat });
            modal.classList.remove('open');
            showToast(`${meal.meal_items.length} aliment(s) copiés ✓`, 'success');
            await renderDay();
          } catch (_) { showToast('Erreur lors de la copie', 'error'); }
        });
      });
    } catch (_) { body.innerHTML = '<p class="card-subtitle" style="text-align:center;padding:16px 0;">Erreur de chargement</p>'; }
  }

  /* ── Picker ────────────────────────────────── */
  function openPicker(catName) {
    activeCat = catName;
    FoodPicker.open(catName, async item => {
      try {
        const mealId = await getOrCreateMeal(activeCat, S.date);
        await addItemToMeal(mealId, item);
        showToast('Aliment ajouté ✓', 'success'); await renderDay();
      } catch (err) { console.error('[Nutrition] saveFood:', err); showToast('Erreur lors de la sauvegarde', 'error'); }
    });
  }

  /* ── Rendu jour ────────────────────────────── */
  async function renderDay() {
    const dateEl  = document.getElementById('nutrition-date');
    const nextBtn = document.getElementById('nutrition-next-day');
    if (dateEl) dateEl.textContent = formatDateLabel(S.date);
    if (nextBtn) nextBtn.disabled  = S.date >= todayStr();
    try {
      const meals = await fetchDayMeals(S.date);
      NutritionUI.updateMacroDisplay(calcTotals(meals));
      renderMealsList(meals);
      NutritionUI.renderMicros(meals);
    } catch (err) { console.error('[Nutrition] renderDay:', err); showToast('Erreur de chargement', 'error'); }
  }

  /* ── Init ───────────────────────────────────── */
  function bindStaticElements() {
    if (navBound) return;
    navBound = true;
    document.getElementById('nutrition-prev-day')?.addEventListener('click', () => {
      S.date = shiftDate(-1); renderDay(); NutritionUI.renderWater(S.date);
    });
    document.getElementById('nutrition-next-day')?.addEventListener('click', () => {
      if (S.date < todayStr()) { S.date = shiftDate(1); renderDay(); NutritionUI.renderWater(S.date); }
    });
    document.getElementById('btn-open-recipes')?.addEventListener('click', () => Recipes.openManager());
    document.getElementById('btn-edit-goals')?.addEventListener('click',   () => NutritionUI.openGoalsModal());
  }

  async function init() {
    loadSavedGoals(); S.date = todayStr();
    bindStaticElements();
    await renderDay();
    NutritionUI.renderWater(S.date);
    NutritionUI.renderWeeklyTrends();
  }

  document.addEventListener('tabchange', e => { if (e.detail.tab === 'nutrition') init(); });

  // Expose GOALS by reference so NutritionUI can read/mutate it
  const _state = { GOALS };

  return { init, renderDay, _state };
})();
