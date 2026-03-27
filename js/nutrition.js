/* ============================================
   NUTRITION.JS — Repas par catégorie, macros, navigation jour
   Élev v2
   ============================================ */

window.Nutrition = (() => {

  const S     = { date: todayStr() };
  const GOALS = { kcal: 2400, protein: 180, carbs: 240, fat: 80 };
  const CIRC  = 150.8;  // 2π × r=24
  const CATEGORIES = [
    { name: 'Petit-déjeuner', emoji: '🌅' },
    { name: 'Déjeuner',       emoji: '☀️' },
    { name: 'Dîner',          emoji: '🌙' },
    { name: 'Collation',      emoji: '🍎' },
  ];
  let navBound = false;

  /* ---- Helpers date ---- */
  function todayStr() { return new Date().toISOString().slice(0, 10); }
  function formatDateLabel(d) {
    const today = todayStr();
    const yest  = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (d === today) return "Aujourd'hui";
    if (d === yest)  return 'Hier';
    return new Date(d + 'T12:00:00')
      .toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  function shiftDate(delta) {
    const d = new Date(S.date + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    return d.toISOString().slice(0, 10);
  }

  /* ---- DB ---- */
  async function fetchDayMeals(date) {
    const { data, error } = await DB.from('meals')
      .select('id, name, created_at, meal_items(id, food_name, quantity_g, calories, protein, carbs, fat)')
      .eq('user_id', DB.userId()).eq('date', date).order('created_at');
    if (error) throw error;
    return data || [];
  }

  async function getOrCreateMeal(categoryName, date) {
    const meals = await fetchDayMeals(date);
    const existing = meals.find(m => m.name === categoryName);
    if (existing) return existing.id;
    const { data, error } = await DB.from('meals')
      .insert({ user_id: DB.userId(), name: categoryName, date }).select().single();
    if (error) throw error;
    return data.id;
  }

  async function addItemsToMeal(mealId, items) {
    const valid = items.filter(it => it.name.trim());
    if (!valid.length) return;
    const { error } = await DB.from('meal_items').insert(
      valid.map(it => ({
        meal_id: mealId, food_name: it.name,
        quantity_g: parseFloat(it.qty)     || null,
        calories:   parseFloat(it.kcal)    || 0,
        protein:    parseFloat(it.protein) || 0,
        carbs:      parseFloat(it.carbs)   || 0,
        fat:        parseFloat(it.fat)     || 0,
      }))
    );
    if (error) throw error;
  }

  async function deleteItemFromDB(itemId) {
    const { error } = await DB.from('meal_items').delete().eq('id', itemId);
    if (error) throw error;
  }

  /* ---- Calculs ---- */
  function calcTotals(meals) {
    return meals.reduce((tot, meal) => {
      (meal.meal_items || []).forEach(it => {
        tot.kcal    += it.calories || 0;
        tot.protein += it.protein  || 0;
        tot.carbs   += it.carbs    || 0;
        tot.fat     += it.fat      || 0;
      });
      return tot;
    }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  }

  function calcCatKcal(meal) {
    return (meal?.meal_items || []).reduce((s, it) => s + (it.calories || 0), 0);
  }

  /* ---- Affichage macros (ring + barres) ---- */
  function updateMacroDisplay(tot) {
    const ring = document.getElementById('nutrition-ring');
    if (ring) {
      const pct = Math.min(tot.kcal / GOALS.kcal, 1);
      ring.setAttribute('stroke-dashoffset', (CIRC * (1 - pct)).toFixed(1));
    }
    const set = (id, val, suffix = '') => { const el = document.getElementById(id); if (el) el.textContent = Math.round(val) + suffix; };
    const bar = (id, val, goal)        => { const el = document.getElementById(id); if (el) el.style.width = Math.min((val / goal) * 100, 100) + '%'; };
    set('nutrition-kcal-total', tot.kcal);
    set('nutrition-protein', tot.protein, 'g'); bar('nutrition-protein-bar', tot.protein, GOALS.protein);
    set('nutrition-carbs',   tot.carbs,   'g'); bar('nutrition-carbs-bar',   tot.carbs,   GOALS.carbs);
    set('nutrition-fat',     tot.fat,     'g'); bar('nutrition-fat-bar',     tot.fat,     GOALS.fat);
  }

  /* ---- Sections catégories ---- */
  function renderMealsList(meals) {
    const list = document.getElementById('nutrition-meals-list');
    if (!list) return;
    list.innerHTML = CATEGORIES.map(cat => {
      const meal  = meals.find(m => m.name === cat.name);
      const items = meal?.meal_items || [];
      const kcal  = Math.round(calcCatKcal(meal));
      return `
        <div class="category-section">
          <div class="category-header">
            <div class="flex items-center gap-8">
              <span class="category-emoji">${cat.emoji}</span>
              <span class="category-name">${cat.name}</span>
            </div>
            <div class="flex items-center gap-8">
              ${kcal > 0 ? `<span class="category-kcal">${kcal} kcal</span>` : ''}
              <button class="btn btn-icon category-add-btn" data-cat="${cat.name}" aria-label="Ajouter à ${cat.name}">+</button>
            </div>
          </div>
          <div class="category-items">
            ${items.length === 0 ? `<p class="category-empty">Aucun aliment ajouté</p>` : ''}
            ${items.map(it => `
              <div class="cat-item-row">
                <div class="cat-item-info">
                  <span class="cat-item-name">${it.food_name}${it.quantity_g ? ` <span class="cat-item-qty">${it.quantity_g}g</span>` : ''}</span>
                  <span class="cat-item-macros">${Math.round(it.calories)} kcal · ${Math.round(it.protein)}P ${Math.round(it.carbs)}G ${Math.round(it.fat)}L</span>
                </div>
                <button class="btn btn-icon cat-item-del" data-del-item="${it.id}" aria-label="Supprimer">✕</button>
              </div>`).join('')}
          </div>
        </div>`;
    }).join('');

    list.querySelectorAll('[data-cat]').forEach(btn =>
      btn.addEventListener('click', () => openAddFoodModal(btn.dataset.cat))
    );
    list.querySelectorAll('[data-del-item]').forEach(btn =>
      btn.addEventListener('click', async () => {
        try { await deleteItemFromDB(btn.dataset.delItem); await renderDay(); }
        catch (_) { showToast('Erreur lors de la suppression', 'error'); }
      })
    );
  }

  /* ---- Rendu principal ---- */
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

  /* ====================================================
     MODAL — Ajouter des aliments à une catégorie
     ==================================================== */
  let draft = { category: '', items: [] };

  function newItem() { return { name: '', qty: '', kcal: '', protein: '', carbs: '', fat: '' }; }

  function openAddFoodModal(categoryName) {
    draft = { category: categoryName, items: [newItem()] };
    let modal = document.getElementById('modal-add-meal');
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'modal-backdrop'; modal.id = 'modal-add-meal';
      modal.innerHTML = `
        <div class="modal" style="max-height:92dvh;">
          <div class="modal-handle"></div>
          <div class="modal-header">
            <p class="modal-title" id="add-meal-modal-title"></p>
            <button class="btn btn-icon" id="close-add-meal">✕</button>
          </div>
          <div class="modal-body" id="add-meal-body" style="display:flex;flex-direction:column;gap:14px;"></div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="cancel-add-meal">Annuler</button>
            <button class="btn btn-primary" style="flex:1;" id="save-add-meal">Enregistrer</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
      document.getElementById('close-add-meal')?.addEventListener('click',  closeModal);
      document.getElementById('cancel-add-meal')?.addEventListener('click', closeModal);
      document.getElementById('save-add-meal')?.addEventListener('click',   saveFoodItems);
    }
    const catDef = CATEGORIES.find(c => c.name === categoryName);
    const titleEl = document.getElementById('add-meal-modal-title');
    if (titleEl) titleEl.textContent = `${catDef?.emoji || ''} ${categoryName}`;
    renderItemForms();
    setTimeout(() => modal.classList.add('open'), 10);
  }

  function closeModal() { document.getElementById('modal-add-meal')?.classList.remove('open'); }

  function renderItemForms() {
    const body = document.getElementById('add-meal-body');
    if (!body) return;
    body.innerHTML = `
      <div>
        <div class="flex items-center justify-between" style="margin-bottom:8px;">
          <p style="font-size:0.875rem;font-weight:600;color:var(--cream);">Aliments</p>
          <button class="btn btn-ghost btn-sm" id="btn-add-item">+ Aliment</button>
        </div>
        <div id="meal-items-form"></div>
      </div>
      <button class="btn btn-ghost btn-sm btn-full" id="btn-from-recipe" style="border-style:dashed;">
        🍽 Depuis une recette
      </button>`;
    renderItemInputs();
    body.querySelector('#btn-add-item')?.addEventListener('click',  () => { draft.items.push(newItem()); renderItemInputs(); });
    body.querySelector('#btn-from-recipe')?.addEventListener('click', openRecipePickerView);
  }

  function renderItemInputs() {
    const cnt = document.getElementById('meal-items-form');
    if (!cnt) return;
    cnt.innerHTML = draft.items.map((it, i) => `
      <div style="margin-bottom:8px;padding:12px;background:var(--bg-surface);border-radius:10px;">
        <div class="flex gap-8" style="margin-bottom:8px;">
          <input type="text"   class="input" data-f="name" data-i="${i}" value="${it.name}"    placeholder="Aliment" style="flex:1;">
          <input type="number" class="input" data-f="qty"  data-i="${i}" value="${it.qty}"     placeholder="g" min="0" inputmode="decimal" style="width:58px;padding:8px 6px;text-align:center;">
        </div>
        <div class="input-row" style="gap:5px;">
          <div class="form-group"><label class="macro-mini-label">Kcal</label>
            <input type="number" class="input macro-mini-input" data-f="kcal"    data-i="${i}" value="${it.kcal}"    min="0" inputmode="decimal"></div>
          <div class="form-group"><label class="macro-mini-label">Prot.</label>
            <input type="number" class="input macro-mini-input" data-f="protein" data-i="${i}" value="${it.protein}" min="0" inputmode="decimal"></div>
          <div class="form-group"><label class="macro-mini-label">Gluc.</label>
            <input type="number" class="input macro-mini-input" data-f="carbs"   data-i="${i}" value="${it.carbs}"   min="0" inputmode="decimal"></div>
          <div class="form-group"><label class="macro-mini-label">Lip.</label>
            <input type="number" class="input macro-mini-input" data-f="fat"     data-i="${i}" value="${it.fat}"     min="0" inputmode="decimal"></div>
        </div>
        ${draft.items.length > 1 ? `<button class="btn btn-ghost btn-sm btn-full" data-remove-item="${i}" style="margin-top:6px;color:#c0392b;">Retirer</button>` : ''}
      </div>`).join('');

    cnt.addEventListener('input', e => {
      const f = e.target.dataset.f, i = parseInt(e.target.dataset.i);
      if (f && !isNaN(i)) draft.items[i][f] = e.target.value;
    });
    cnt.addEventListener('click', e => {
      const btn = e.target.closest('[data-remove-item]');
      if (btn) { draft.items.splice(parseInt(btn.dataset.removeItem), 1); renderItemInputs(); }
    });
  }

  async function openRecipePickerView() {
    const body = document.getElementById('add-meal-body');
    if (!body) return;
    let recipes = [];
    try {
      const { data } = await DB.from('recipes')
        .select('id, name, raw_cooked_ratio, recipe_ingredients(calories, protein, carbs, fat, quantity_g)')
        .eq('user_id', DB.userId()).order('name');
      recipes = data || [];
    } catch (_) {}
    if (!recipes.length) { showToast('Aucune recette enregistrée', 'info'); return; }
    body.innerHTML = `
      <button class="btn btn-ghost btn-sm" id="back-to-form" style="margin-bottom:12px;">‹ Retour</button>
      ${recipes.map(r => {
        const raw = (r.recipe_ingredients || []).reduce((s, i) => ({
          kcal:    s.kcal    + i.calories * i.quantity_g / 100,
          protein: s.protein + i.protein  * i.quantity_g / 100,
          carbs:   s.carbs   + i.carbs    * i.quantity_g / 100,
          fat:     s.fat     + i.fat      * i.quantity_g / 100,
          qty:     s.qty     + i.quantity_g,
        }), { kcal:0, protein:0, carbs:0, fat:0, qty:0 });
        const ratio = r.raw_cooked_ratio || 1;
        const p100  = raw.qty > 0 ? {
          kcal:    raw.kcal    * ratio / raw.qty * 100,
          protein: raw.protein * ratio / raw.qty * 100,
          carbs:   raw.carbs   * ratio / raw.qty * 100,
          fat:     raw.fat     * ratio / raw.qty * 100,
        } : { kcal:0, protein:0, carbs:0, fat:0 };
        return `
          <div class="card pressable recipe-pick-card" style="margin-bottom:8px;"
               data-rname="${r.name}" data-rper='${JSON.stringify(p100)}'>
            <p class="card-title">${r.name}</p>
            <p class="card-subtitle">${Math.round(p100.kcal)} kcal · ${Math.round(p100.protein)}g prot. / 100g cuit</p>
            <div class="recipe-qty-form" style="display:none;margin-top:10px;" data-qty-form>
              <div class="flex gap-8 items-center">
                <input type="number" class="input" placeholder="Quantité cuite (g)" min="1" inputmode="decimal" style="flex:1;">
                <button class="btn btn-primary btn-sm" data-confirm-recipe>Ajouter</button>
              </div>
            </div>
          </div>`;
      }).join('')}`;

    body.querySelector('#back-to-form')?.addEventListener('click', renderItemForms);
    body.querySelectorAll('.recipe-pick-card').forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('[data-qty-form]')) return;
        const form = card.querySelector('[data-qty-form]');
        document.querySelectorAll('[data-qty-form]').forEach(f => { if (f !== form) f.style.display = 'none'; });
        form.style.display = form.style.display === 'none' ? 'flex' : 'none';
        if (form.style.display !== 'none') form.querySelector('input')?.focus();
      });
      card.querySelector('[data-confirm-recipe]')?.addEventListener('click', () => {
        const g = parseFloat(card.querySelector('[data-qty-form] input').value) || 0;
        if (!g) return;
        const p = JSON.parse(card.dataset.rper);
        draft.items.push({
          name: card.dataset.rname, qty: g,
          kcal:    +(p.kcal    * g / 100).toFixed(0),
          protein: +(p.protein * g / 100).toFixed(1),
          carbs:   +(p.carbs   * g / 100).toFixed(1),
          fat:     +(p.fat     * g / 100).toFixed(1),
        });
        renderItemForms();
      });
    });
  }

  async function saveFoodItems() {
    if (!draft.items.some(it => it.name.trim())) { showToast('Ajoute au moins un aliment', 'error'); return; }
    try {
      const mealId = await getOrCreateMeal(draft.category, S.date);
      await addItemsToMeal(mealId, draft.items);
      closeModal();
      showToast('Aliments ajoutés', 'success');
      await renderDay();
    } catch (err) {
      console.error('[Nutrition] saveFoodItems:', err);
      showToast('Erreur lors de la sauvegarde', 'error');
    }
  }

  /* ---- Init ---- */
  function bindStaticElements() {
    if (navBound) return;
    navBound = true;
    document.getElementById('nutrition-prev-day')?.addEventListener('click', () => { S.date = shiftDate(-1); renderDay(); });
    document.getElementById('nutrition-next-day')?.addEventListener('click', () => { if (S.date < todayStr()) { S.date = shiftDate(1); renderDay(); } });
    document.getElementById('btn-open-recipes')?.addEventListener('click', () => Recipes.openManager());
  }

  async function init() {
    S.date = todayStr();
    bindStaticElements();
    await renderDay();
  }

  document.addEventListener('tabchange', e => { if (e.detail.tab === 'nutrition') init(); });

  return { init };

})();
