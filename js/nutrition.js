/* ============================================
   NUTRITION.JS — Repas, macros, navigation jour
   Élev v2
   ============================================ */

window.Nutrition = (() => {

  const S       = { date: todayStr() };
  const GOALS   = { kcal: 2400, protein: 180, carbs: 240, fat: 80 };
  const CIRC    = 150.8;  // 2π × r=24
  let   navBound = false;

  /* ---- Helpers date ---- */
  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }
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

  async function saveMealToDB(name, items, date) {
    const { data: meal, error } = await DB.from('meals')
      .insert({ user_id: DB.userId(), name, date }).select().single();
    if (error) throw error;
    const validItems = items.filter(it => it.name.trim());
    if (validItems.length) {
      const { error: e2 } = await DB.from('meal_items').insert(
        validItems.map(it => ({
          meal_id: meal.id, food_name: it.name,
          quantity_g: parseFloat(it.qty) || null,
          calories: parseFloat(it.kcal) || 0,
          protein:  parseFloat(it.protein) || 0,
          carbs:    parseFloat(it.carbs) || 0,
          fat:      parseFloat(it.fat) || 0,
        }))
      );
      if (e2) throw e2;
    }
    return meal;
  }

  async function deleteMealFromDB(id) {
    await DB.from('meal_items').delete().eq('meal_id', id);
    const { error } = await DB.from('meals').delete().eq('id', id);
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

  /* ---- Affichage macros (ring + barres) ---- */
  function updateMacroDisplay(tot) {
    const ring = document.getElementById('nutrition-ring');
    if (ring) {
      const pct = Math.min(tot.kcal / GOALS.kcal, 1);
      ring.setAttribute('stroke-dashoffset', (CIRC * (1 - pct)).toFixed(1));
    }
    const set = (id, val, suffix = '') => {
      const el = document.getElementById(id);
      if (el) el.textContent = Math.round(val) + suffix;
    };
    const bar = (id, val, goal) => {
      const el = document.getElementById(id);
      if (el) el.style.width = Math.min((val / goal) * 100, 100) + '%';
    };
    set('nutrition-kcal-total', tot.kcal);
    set('nutrition-protein', tot.protein, 'g'); bar('nutrition-protein-bar', tot.protein, GOALS.protein);
    set('nutrition-carbs',   tot.carbs,   'g'); bar('nutrition-carbs-bar',   tot.carbs,   GOALS.carbs);
    set('nutrition-fat',     tot.fat,     'g'); bar('nutrition-fat-bar',     tot.fat,     GOALS.fat);
  }

  /* ---- Liste des repas ---- */
  function renderMealsList(meals) {
    const list = document.getElementById('nutrition-meals-list');
    if (!list) return;
    if (!meals.length) {
      list.innerHTML = `<div class="empty-state" style="padding:32px 0;">
        <span class="empty-state-icon">🥗</span>
        <p class="empty-state-title">Aucun repas</p>
        <p class="empty-state-text">Ajoute ton premier repas de la journée</p>
      </div>`;
      return;
    }
    list.innerHTML = meals.map(meal => {
      const items = meal.meal_items || [];
      const tot   = items.reduce((t, i) => ({ kcal: t.kcal + (i.calories||0), prot: t.prot + (i.protein||0) }), { kcal:0, prot:0 });
      return `
        <div class="card meal-card" style="margin-bottom:10px;">
          <div class="flex items-center justify-between" style="margin-bottom:${items.length ? 10 : 0}px;">
            <p class="card-title">${meal.name}</p>
            <div class="flex gap-8 items-center">
              <span class="badge badge-warm">${Math.round(tot.kcal)} kcal</span>
              <span class="badge badge-accent">${Math.round(tot.prot)}g prot.</span>
              <button class="btn btn-icon" data-delete-meal="${meal.id}" aria-label="Supprimer" style="font-size:0.875rem;">🗑</button>
            </div>
          </div>
          ${items.length ? `<div class="meal-items-list">
            ${items.map(it => `
              <div class="meal-item-row">
                <span class="meal-item-name">${it.food_name}${it.quantity_g ? ` <span class="text-dim text-dim-sm">${it.quantity_g}g</span>` : ''}</span>
                <span class="meal-item-macros">${Math.round(it.calories)} kcal · ${Math.round(it.protein)}P ${Math.round(it.carbs)}G ${Math.round(it.fat)}L</span>
              </div>`).join('')}
          </div>` : ''}
        </div>`;
    }).join('');

    list.querySelectorAll('[data-delete-meal]').forEach(btn =>
      btn.addEventListener('click', () => {
        if (!confirm('Supprimer ce repas ?')) return;
        deleteMealFromDB(btn.dataset.deleteMeal)
          .then(renderDay)
          .catch(() => showToast('Erreur lors de la suppression', 'error'));
      })
    );
  }

  /* ---- Rendu principal ---- */
  async function renderDay() {
    const dateEl  = document.getElementById('nutrition-date');
    const nextBtn = document.getElementById('nutrition-next-day');
    if (dateEl)  dateEl.textContent  = formatDateLabel(S.date);
    if (nextBtn) nextBtn.disabled    = S.date >= todayStr();
    try {
      const meals  = await fetchDayMeals(S.date);
      updateMacroDisplay(calcTotals(meals));
      renderMealsList(meals);
    } catch (err) {
      console.error('[Nutrition] renderDay:', err);
      showToast('Erreur de chargement', 'error');
    }
  }

  /* ====================================================
     MODAL — Ajouter un repas
     ==================================================== */
  let draft = { name: '', items: [] };
  const PRESETS = ['Petit-déjeuner', 'Déjeuner', 'Dîner', 'Collation'];

  function newItem() { return { name:'', qty:'', kcal:'', protein:'', carbs:'', fat:'' }; }

  function openAddMealModal() {
    draft = { name: '', items: [newItem()] };
    let modal = document.getElementById('modal-add-meal');
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'modal-backdrop'; modal.id = 'modal-add-meal';
      modal.innerHTML = `
        <div class="modal" style="max-height:92dvh;">
          <div class="modal-handle"></div>
          <div class="modal-header">
            <p class="modal-title">Nouveau repas</p>
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
      document.getElementById('save-add-meal')?.addEventListener('click',   saveNewMeal);
    }
    renderMealForm();
    setTimeout(() => modal.classList.add('open'), 10);
  }

  function closeModal() { document.getElementById('modal-add-meal')?.classList.remove('open'); }

  function renderMealForm() {
    const body = document.getElementById('add-meal-body');
    if (!body) return;
    body.innerHTML = `
      <div class="form-group">
        <label>Nom du repas</label>
        <input type="text" id="meal-name-input" class="input" placeholder="ex : Déjeuner" value="${draft.name}" maxlength="60">
        <div class="flex gap-4" style="flex-wrap:wrap;margin-top:8px;">
          ${PRESETS.map(p => `<button class="badge badge-surface pressable" data-preset="${p}" style="cursor:pointer;padding:6px 12px;">${p}</button>`).join('')}
        </div>
      </div>
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
    renderItemForms();
    body.querySelector('#meal-name-input')?.addEventListener('input', e => { draft.name = e.target.value; });
    body.querySelectorAll('[data-preset]').forEach(btn =>
      btn.addEventListener('click', () => {
        draft.name = btn.dataset.preset;
        const inp = body.querySelector('#meal-name-input');
        if (inp) inp.value = draft.name;
      })
    );
    body.querySelector('#btn-add-item')?.addEventListener('click', () => { draft.items.push(newItem()); renderItemForms(); });
    body.querySelector('#btn-from-recipe')?.addEventListener('click', openRecipePickerView);
  }

  function renderItemForms() {
    const cnt = document.getElementById('meal-items-form');
    if (!cnt) return;
    cnt.innerHTML = draft.items.map((it, i) => `
      <div style="margin-bottom:8px;padding:12px;background:var(--bg-surface);border-radius:10px;">
        <div class="flex gap-8" style="margin-bottom:8px;">
          <input type="text"   class="input" data-f="name"    data-i="${i}" value="${it.name}"    placeholder="Aliment"  style="flex:1;">
          <input type="number" class="input" data-f="qty"     data-i="${i}" value="${it.qty}"     placeholder="g" min="0" inputmode="decimal" style="width:58px;padding:8px 6px;text-align:center;">
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
      if (btn) { draft.items.splice(parseInt(btn.dataset.removeItem), 1); renderItemForms(); }
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
      <button class="btn btn-ghost btn-sm" id="back-to-form" style="margin-bottom:12px;">‹ Retour au repas</button>
      ${recipes.map(r => {
        const raw = (r.recipe_ingredients || []).reduce((s, i) => ({
          kcal: s.kcal + i.calories * i.quantity_g / 100,
          protein: s.protein + i.protein * i.quantity_g / 100,
          carbs: s.carbs + i.carbs * i.quantity_g / 100,
          fat: s.fat + i.fat * i.quantity_g / 100,
          qty: s.qty + i.quantity_g,
        }), { kcal:0, protein:0, carbs:0, fat:0, qty:0 });
        const ratio = r.raw_cooked_ratio || 1;
        const p100 = raw.qty > 0 ? {
          kcal: raw.kcal * ratio / raw.qty * 100,
          protein: raw.protein * ratio / raw.qty * 100,
          carbs: raw.carbs * ratio / raw.qty * 100,
          fat: raw.fat * ratio / raw.qty * 100,
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

    body.querySelector('#back-to-form')?.addEventListener('click', renderMealForm);
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
        renderMealForm();
      });
    });
  }

  async function saveNewMeal() {
    const name = draft.name.trim();
    if (!name) { showToast('Donne un nom au repas', 'error'); return; }
    if (!draft.items.some(it => it.name.trim())) { showToast('Ajoute au moins un aliment', 'error'); return; }
    try {
      await saveMealToDB(name, draft.items, S.date);
      closeModal();
      showToast('Repas enregistré', 'success');
      await renderDay();
    } catch (err) {
      console.error('[Nutrition] saveNewMeal:', err);
      showToast('Erreur lors de la sauvegarde', 'error');
    }
  }

  /* ---- Init ---- */
  function bindStaticElements() {
    if (navBound) return;
    navBound = true;
    document.getElementById('nutrition-prev-day')?.addEventListener('click', () => { S.date = shiftDate(-1); renderDay(); });
    document.getElementById('nutrition-next-day')?.addEventListener('click', () => { if (S.date < todayStr()) { S.date = shiftDate(1); renderDay(); } });
    document.getElementById('fab-meal')?.addEventListener('click', openAddMealModal);
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
