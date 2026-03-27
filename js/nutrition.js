/* ============================================
   NUTRITION.JS — Repas par catégorie, recherche aliments
   Élev v2
   ============================================ */

window.Nutrition = (() => {

  const S     = { date: todayStr() };
  const GOALS = { kcal: 2400, protein: 180, carbs: 240, fat: 80 };
  const CIRC  = 150.8;
  const CATEGORIES = [
    { name: 'Petit-déjeuner', emoji: '🌅' },
    { name: 'Déjeuner',       emoji: '🍽️' },
    { name: 'Dîner',          emoji: '🌙' },
    { name: 'Collation',      emoji: '🍎' },
  ];
  let navBound = false;
  let activeCat = '';

  /* ---- Date ---- */
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

  /* ---- DB ---- */
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

  /* ---- Calculs ---- */
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

  /* ---- Affichage macros ---- */
  function updateMacroDisplay(tot) {
    const ring = document.getElementById('nutrition-ring');
    if (ring) ring.setAttribute('stroke-dashoffset', (CIRC*(1-Math.min(tot.kcal/GOALS.kcal,1))).toFixed(1));
    const set = (id, v, s='') => { const el=document.getElementById(id); if(el) el.textContent=Math.round(v)+s; };
    const bar = (id, v, g)    => { const el=document.getElementById(id); if(el) el.style.width=Math.min(v/g*100,100)+'%'; };
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
      const kcal  = Math.round(catKcal(meal));
      return `
        <div class="category-section">
          <div class="category-header">
            <div class="flex items-center gap-8">
              <span class="category-emoji">${cat.emoji}</span>
              <span class="category-name">${cat.name}</span>
            </div>
            <div class="flex items-center gap-8">
              ${kcal > 0 ? `<span class="category-kcal">${kcal} kcal</span>` : ''}
              <button class="btn btn-icon category-add-btn" data-cat="${cat.name}" aria-label="Ajouter">+</button>
            </div>
          </div>
          <div class="category-items">
            ${!items.length ? `<p class="category-empty">Aucun aliment</p>` : ''}
            ${items.map(it => `
              <div class="cat-item-row">
                <div class="cat-item-info">
                  <span class="cat-item-name">${it.food_name}${it.quantity_g ? ` <span class="cat-item-qty">${it.quantity_g}g</span>` : ''}</span>
                  <span class="cat-item-macros">${Math.round(it.calories)} kcal · ${Math.round(it.protein)}P ${Math.round(it.carbs)}G ${Math.round(it.fat)}L</span>
                </div>
                <button class="btn btn-icon cat-item-del" data-del="${it.id}" aria-label="Supprimer">✕</button>
              </div>`).join('')}
          </div>
        </div>`;
    }).join('');

    list.querySelectorAll('[data-cat]').forEach(b =>
      b.addEventListener('click', () => openFoodModal(b.dataset.cat))
    );
    list.querySelectorAll('[data-del]').forEach(b =>
      b.addEventListener('click', async () => {
        try { await deleteItemFromDB(b.dataset.del); await renderDay(); }
        catch(_) { showToast('Erreur suppression', 'error'); }
      })
    );
  }

  /* ---- Rendu jour ---- */
  async function renderDay() {
    const dateEl  = document.getElementById('nutrition-date');
    const nextBtn = document.getElementById('nutrition-next-day');
    if (dateEl)  dateEl.textContent = formatDateLabel(S.date);
    if (nextBtn) nextBtn.disabled   = S.date >= todayStr();
    try {
      const meals = await fetchDayMeals(S.date);
      updateMacroDisplay(calcTotals(meals));
      renderMealsList(meals);
    } catch(err) {
      console.error('[Nutrition] renderDay:', err);
      showToast('Erreur de chargement', 'error');
    }
  }

  /* ====================================================
     MODAL — Recherche & ajout d'aliments
  ==================================================== */
  function openFoodModal(catName) {
    activeCat = catName;
    const catDef = CATEGORIES.find(c => c.name === catName);
    let modal = document.getElementById('modal-add-food');
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'modal-backdrop'; modal.id = 'modal-add-food';
      modal.innerHTML = `
        <div class="modal" style="max-height:92dvh;">
          <div class="modal-handle"></div>
          <div class="modal-header">
            <p class="modal-title" id="food-modal-title"></p>
            <button class="btn btn-icon" id="close-food-modal">✕</button>
          </div>
          <div id="food-modal-body" style="display:flex;flex-direction:column;overflow:hidden;max-height:calc(92dvh - 64px);"></div>
        </div>`;
      document.body.appendChild(modal);
      modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
      document.getElementById('close-food-modal')?.addEventListener('click', closeModal);
    }
    document.getElementById('food-modal-title').textContent = `${catDef?.emoji||''} ${catName}`;
    showSearchView();
    setTimeout(() => modal.classList.add('open'), 10);
  }
  function closeModal() { document.getElementById('modal-add-food')?.classList.remove('open'); }

  /* ---- Vue : recherche ---- */
  function showSearchView() {
    const body = document.getElementById('food-modal-body');
    if (!body) return;
    body.innerHTML = `
      <div class="food-search-bar">
        <input type="text" id="food-search-input" class="input" placeholder="🔍  Rechercher un aliment..." autocomplete="off" style="margin:0;">
      </div>
      <div id="food-results-list" class="food-results-scroll"></div>
      <div class="food-modal-footer">
        <button class="btn btn-ghost btn-sm btn-full" id="btn-custom-food" style="border-style:dashed;">✏️ Aliment personnalisé</button>
        <button class="btn btn-ghost btn-sm btn-full" id="btn-from-recipe" style="border-style:dashed;margin-top:6px;">🍽 Depuis une recette</button>
      </div>`;
    renderSearchResults(FoodDB.search(''));
    const inp = body.querySelector('#food-search-input');
    inp?.focus();
    inp?.addEventListener('input', e => renderSearchResults(FoodDB.search(e.target.value)));
    body.querySelector('#btn-custom-food')?.addEventListener('click', showCustomFoodView);
    body.querySelector('#btn-from-recipe')?.addEventListener('click',  showRecipeView);
  }

  function renderSearchResults(foods) {
    const list = document.getElementById('food-results-list');
    if (!list) return;
    if (!foods.length) {
      list.innerHTML = `<p class="food-no-result">Aucun résultat · essaie un aliment personnalisé</p>`;
      return;
    }
    list.innerHTML = foods.map((f, i) => `
      <div class="food-result-row" data-fi="${i}">
        <div class="food-result-main" data-toggle="${i}">
          <span class="food-result-name">${f.name}</span>
          <span class="food-result-per100">${f.kcal} kcal · ${f.protein}P ${f.carbs}G ${f.fat}L <small>/100g</small></span>
        </div>
        <div class="food-result-expand" id="expand-${i}" style="display:none;">
          <div class="flex gap-8 items-center" style="margin-bottom:6px;">
            <input type="number" class="input food-qty-inp" placeholder="Quantité (g)" min="1" inputmode="decimal" style="flex:1;margin:0;">
            <button class="btn btn-primary btn-sm food-add-btn">Ajouter</button>
          </div>
          <p class="food-calc-preview"></p>
        </div>
      </div>`).join('');

    list.querySelectorAll('.food-result-row').forEach((row, i) => {
      const food    = foods[i];
      const expand  = row.querySelector('.food-result-expand');
      const qtyInp  = row.querySelector('.food-qty-inp');
      const preview = row.querySelector('.food-calc-preview');
      row.querySelector('.food-result-main').addEventListener('click', () => {
        list.querySelectorAll('.food-result-expand').forEach(e => { if (e !== expand) e.style.display = 'none'; });
        expand.style.display = expand.style.display === 'none' ? 'block' : 'none';
        if (expand.style.display !== 'none') qtyInp.focus();
      });
      qtyInp.addEventListener('input', () => {
        const g = parseFloat(qtyInp.value) || 0;
        preview.textContent = g
          ? `→ ${Math.round(food.kcal*g/100)} kcal · ${(food.protein*g/100).toFixed(1)}g P · ${(food.carbs*g/100).toFixed(1)}g G · ${(food.fat*g/100).toFixed(1)}g L`
          : '';
      });
      row.querySelector('.food-add-btn').addEventListener('click', async () => {
        const g = parseFloat(qtyInp.value) || 0;
        if (!g) { showToast('Entre une quantité', 'error'); return; }
        await saveFood({
          name: food.name, qty: g,
          kcal:    +(food.kcal*g/100).toFixed(0),
          protein: +(food.protein*g/100).toFixed(1),
          carbs:   +(food.carbs*g/100).toFixed(1),
          fat:     +(food.fat*g/100).toFixed(1),
        });
      });
    });
  }

  /* ---- Vue : aliment personnalisé ---- */
  function showCustomFoodView() {
    const body = document.getElementById('food-modal-body');
    if (!body) return;
    body.innerHTML = `
      <div style="padding:16px;overflow-y:auto;">
        <button class="btn btn-ghost btn-sm" id="back-search" style="margin-bottom:14px;">‹ Retour</button>
        <div class="form-group" style="margin-bottom:12px;">
          <label>Nom de l'aliment</label>
          <input type="text" id="cust-name" class="input" placeholder="ex : Quiche lorraine" maxlength="80">
        </div>
        <div class="form-group" style="margin-bottom:12px;">
          <label>Quantité (g)</label>
          <input type="number" id="cust-qty" class="input" placeholder="100" min="1" inputmode="decimal">
        </div>
        <p class="food-section-label">Valeurs nutritionnelles pour 100g</p>
        <div class="input-row" style="gap:8px;margin-bottom:20px;">
          <div class="form-group"><label class="macro-mini-label">Kcal</label>
            <input type="number" id="cust-kcal" class="input macro-mini-input" min="0" inputmode="decimal"></div>
          <div class="form-group"><label class="macro-mini-label">Prot.</label>
            <input type="number" id="cust-prot" class="input macro-mini-input" min="0" inputmode="decimal"></div>
          <div class="form-group"><label class="macro-mini-label">Gluc.</label>
            <input type="number" id="cust-carb" class="input macro-mini-input" min="0" inputmode="decimal"></div>
          <div class="form-group"><label class="macro-mini-label">Lip.</label>
            <input type="number" id="cust-fat" class="input macro-mini-input" min="0" inputmode="decimal"></div>
        </div>
        <button class="btn btn-primary btn-full" id="save-custom">Ajouter</button>
      </div>`;
    body.querySelector('#back-search')?.addEventListener('click', showSearchView);
    body.querySelector('#save-custom')?.addEventListener('click', async () => {
      const name = document.getElementById('cust-name')?.value.trim();
      const qty  = parseFloat(document.getElementById('cust-qty')?.value)  || 0;
      const k100 = parseFloat(document.getElementById('cust-kcal')?.value) || 0;
      const p100 = parseFloat(document.getElementById('cust-prot')?.value) || 0;
      const c100 = parseFloat(document.getElementById('cust-carb')?.value) || 0;
      const f100 = parseFloat(document.getElementById('cust-fat')?.value)  || 0;
      if (!name) { showToast("Donne un nom à l'aliment", 'error'); return; }
      if (!qty)  { showToast('Entre une quantité', 'error'); return; }
      await saveFood({ name, qty, kcal:+(k100*qty/100).toFixed(0), protein:+(p100*qty/100).toFixed(1), carbs:+(c100*qty/100).toFixed(1), fat:+(f100*qty/100).toFixed(1) });
    });
  }

  /* ---- Vue : recettes ---- */
  async function showRecipeView() {
    const body = document.getElementById('food-modal-body');
    if (!body) return;
    body.innerHTML = `
      <div style="padding:16px;overflow-y:auto;">
        <button class="btn btn-ghost btn-sm" id="back-search2" style="margin-bottom:14px;">‹ Retour</button>
        <div class="workout-spinner"><div class="spinner"></div></div>
      </div>`;
    body.querySelector('#back-search2')?.addEventListener('click', showSearchView);
    const inner = body.querySelector('div');
    let recipes = [];
    try {
      const { data } = await DB.from('recipes')
        .select('id, name, raw_cooked_ratio, recipe_ingredients(calories, protein, carbs, fat, quantity_g)')
        .eq('user_id', DB.userId()).order('name');
      recipes = data || [];
    } catch(_) {}
    inner.querySelector('.workout-spinner')?.remove();
    if (!recipes.length) {
      inner.insertAdjacentHTML('beforeend', '<p style="text-align:center;color:var(--cream-dim);padding:12px 0;">Aucune recette enregistrée</p>');
      return;
    }
    recipes.forEach(r => {
      const raw = (r.recipe_ingredients||[]).reduce((s,i) => ({
        kcal: s.kcal + i.calories*i.quantity_g/100, protein: s.protein + i.protein*i.quantity_g/100,
        carbs: s.carbs + i.carbs*i.quantity_g/100,  fat: s.fat + i.fat*i.quantity_g/100, qty: s.qty + i.quantity_g,
      }), {kcal:0, protein:0, carbs:0, fat:0, qty:0});
      const ratio = r.raw_cooked_ratio || 1;
      const p100  = raw.qty > 0 ? {
        kcal: raw.kcal*ratio/raw.qty*100, protein: raw.protein*ratio/raw.qty*100,
        carbs: raw.carbs*ratio/raw.qty*100, fat: raw.fat*ratio/raw.qty*100,
      } : { kcal:0, protein:0, carbs:0, fat:0 };
      const card = document.createElement('div');
      card.className = 'card'; card.style.marginBottom = '8px';
      card.innerHTML = `
        <div class="flex items-center justify-between">
          <div><p class="card-title">${r.name}</p>
          <p class="card-subtitle">${Math.round(p100.kcal)} kcal · ${Math.round(p100.protein)}g P / 100g cuit</p></div>
          <span style="color:var(--cream-dim);font-size:1.1rem;">›</span>
        </div>
        <div class="recipe-qty-form" style="display:none;margin-top:10px;">
          <div class="flex gap-8 items-center">
            <input type="number" class="input" placeholder="Quantité cuite (g)" min="1" inputmode="decimal" style="flex:1;margin:0;">
            <button class="btn btn-primary btn-sm">Ajouter</button>
          </div>
        </div>`;
      card.querySelector('.flex').addEventListener('click', () => {
        const form = card.querySelector('.recipe-qty-form');
        form.style.display = form.style.display === 'none' ? 'block' : 'none';
        if (form.style.display !== 'none') form.querySelector('input').focus();
      });
      card.querySelector('.btn-primary').addEventListener('click', async () => {
        const g = parseFloat(card.querySelector('input').value) || 0;
        if (!g) return;
        await saveFood({ name:r.name, qty:g, kcal:+(p100.kcal*g/100).toFixed(0), protein:+(p100.protein*g/100).toFixed(1), carbs:+(p100.carbs*g/100).toFixed(1), fat:+(p100.fat*g/100).toFixed(1) });
      });
      inner.appendChild(card);
    });
  }

  async function saveFood(item) {
    try {
      const mealId = await getOrCreateMeal(activeCat, S.date);
      await addItemToMeal(mealId, item);
      closeModal();
      showToast('Aliment ajouté ✓', 'success');
      await renderDay();
    } catch(err) {
      console.error('[Nutrition] saveFood:', err);
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
