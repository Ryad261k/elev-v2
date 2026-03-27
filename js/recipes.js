/* ============================================
   RECIPES.JS — Recettes avec ratio cru/cuit
   Élev v2
   ============================================ */

window.Recipes = (() => {

  let draft = null;  // { id|null, name, ratio, ingredients:[{name,qty,kcal,protein,carbs,fat}] }

  /* ---- DB ---- */
  async function fetchRecipes() {
    const { data, error } = await DB.from('recipes')
      .select('id, name, raw_cooked_ratio, recipe_ingredients(id, food_name, quantity_g, calories, protein, carbs, fat)')
      .eq('user_id', DB.userId()).order('name');
    if (error) throw error;
    return data || [];
  }

  async function saveRecipe() {
    const name  = draft.name.trim();
    const ratio = parseFloat(draft.ratio) || 1;
    if (!name) { showToast('Donne un nom à la recette', 'error'); return false; }
    try {
      let recipeId = draft.id;
      if (recipeId) {
        await DB.from('recipes').update({ name, raw_cooked_ratio: ratio }).eq('id', recipeId);
      } else {
        const { data, error } = await DB.from('recipes')
          .insert({ user_id: DB.userId(), name, raw_cooked_ratio: ratio })
          .select().single();
        if (error) throw error;
        recipeId = data.id;
      }
      // Remplace tous les ingrédients
      await DB.from('recipe_ingredients').delete().eq('recipe_id', recipeId);
      const valid = draft.ingredients.filter(i => i.name.trim());
      if (valid.length) {
        const { error } = await DB.from('recipe_ingredients').insert(
          valid.map(ing => ({
            recipe_id: recipeId,
            food_name:  ing.name,
            quantity_g: parseFloat(ing.qty)     || 0,
            calories:   parseFloat(ing.kcal)    || 0,
            protein:    parseFloat(ing.protein) || 0,
            carbs:      parseFloat(ing.carbs)   || 0,
            fat:        parseFloat(ing.fat)     || 0,
          }))
        );
        if (error) throw error;
      }
      showToast(draft.id ? 'Recette mise à jour' : 'Recette créée', 'success');
      return true;
    } catch (err) {
      console.error('[Recipes] saveRecipe:', err);
      showToast('Erreur lors de la sauvegarde', 'error');
      return false;
    }
  }

  async function deleteRecipe(id) {
    await DB.from('recipe_ingredients').delete().eq('recipe_id', id);
    const { error } = await DB.from('recipes').delete().eq('id', id);
    if (error) throw error;
  }

  /* ---- Calcul macros / 100g cuit ---- */
  function calcPer100Cooked(ingredients, ratio) {
    const totalQty = ingredients.reduce((s, i) => s + (parseFloat(i.quantity_g || i.qty) || 0), 0);
    if (!totalQty) return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    const raw = ingredients.reduce((s, i) => {
      const q = parseFloat(i.quantity_g || i.qty) || 0;
      return {
        kcal:    s.kcal    + (parseFloat(i.calories || i.kcal) || 0) * q / 100,
        protein: s.protein + (parseFloat(i.protein)            || 0) * q / 100,
        carbs:   s.carbs   + (parseFloat(i.carbs)              || 0) * q / 100,
        fat:     s.fat     + (parseFloat(i.fat)                || 0) * q / 100,
      };
    }, { kcal:0, protein:0, carbs:0, fat:0 });
    const r = parseFloat(ratio) || 1;
    return {
      kcal:    raw.kcal    * r / totalQty * 100,
      protein: raw.protein * r / totalQty * 100,
      carbs:   raw.carbs   * r / totalQty * 100,
      fat:     raw.fat     * r / totalQty * 100,
    };
  }

  /* ---- Modal gestionnaire ---- */
  function openManager() {
    let modal = document.getElementById('modal-recipes-mgr');
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'modal-backdrop'; modal.id = 'modal-recipes-mgr';
      modal.innerHTML = `
        <div class="modal" style="max-height:92dvh;">
          <div class="modal-handle"></div>
          <div class="modal-header">
            <p class="modal-title">Mes recettes</p>
            <button class="btn btn-icon" id="close-recipes-mgr">✕</button>
          </div>
          <div class="modal-body" id="recipes-mgr-body" style="overflow-y:auto;max-height:78dvh;"></div>
        </div>`;
      document.body.appendChild(modal);
      modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });
      document.getElementById('close-recipes-mgr')?.addEventListener('click', () => modal.classList.remove('open'));
    }
    setTimeout(() => modal.classList.add('open'), 10);
    renderRecipesList();
  }

  async function renderRecipesList() {
    const body = document.getElementById('recipes-mgr-body');
    if (!body) return;
    body.innerHTML = '<div class="workout-spinner" style="padding:24px 0;"><div class="spinner"></div></div>';
    try {
      const recipes = await fetchRecipes();
      body.innerHTML = `
        <button class="btn btn-primary btn-full" style="margin-bottom:16px;" id="btn-new-recipe">+ Nouvelle recette</button>
        ${!recipes.length ? `<p class="text-dim" style="text-align:center;padding:20px;">Aucune recette enregistrée</p>` : ''}
        ${recipes.map(r => {
          const p100 = calcPer100Cooked(r.recipe_ingredients || [], r.raw_cooked_ratio);
          const totalKcal = (r.recipe_ingredients || []).reduce((s, i) => s + i.calories * i.quantity_g / 100, 0);
          return `
            <div class="card" style="margin-bottom:8px;">
              <div class="flex items-center justify-between" style="margin-bottom:6px;">
                <div>
                  <p class="card-title">${r.name}</p>
                  <p class="card-subtitle">${Math.round(totalKcal)} kcal totales · ratio ${r.raw_cooked_ratio || 1}</p>
                </div>
                <div class="flex gap-4">
                  <button class="btn btn-icon" data-edit="${r.id}" aria-label="Modifier">✏️</button>
                  <button class="btn btn-icon" data-del="${r.id}"  aria-label="Supprimer">🗑</button>
                </div>
              </div>
              <p class="card-subtitle" style="font-size:0.75rem;">
                / 100g cuit → ${Math.round(p100.kcal)} kcal · ${Math.round(p100.protein)}g P · ${Math.round(p100.carbs)}g G · ${Math.round(p100.fat)}g L
              </p>
            </div>`;
        }).join('')}`;

      body.querySelector('#btn-new-recipe')?.addEventListener('click', () => openRecipeEditor(null));
      body.querySelectorAll('[data-edit]').forEach(btn =>
        btn.addEventListener('click', () => openRecipeEditor(btn.dataset.edit))
      );
      body.querySelectorAll('[data-del]').forEach(btn =>
        btn.addEventListener('click', async () => {
          if (!confirm('Supprimer cette recette ?')) return;
          try { await deleteRecipe(btn.dataset.del); showToast('Recette supprimée', 'info'); renderRecipesList(); }
          catch (_) { showToast('Erreur lors de la suppression', 'error'); }
        })
      );
    } catch (err) {
      console.error('[Recipes] renderRecipesList:', err);
      body.innerHTML = '<p class="text-dim" style="padding:20px;">Erreur de chargement</p>';
    }
  }

  async function openRecipeEditor(recipeId) {
    if (recipeId) {
      const recipes = await fetchRecipes();
      const r = recipes.find(rec => rec.id === recipeId);
      if (!r) return;
      draft = {
        id: recipeId, name: r.name, ratio: r.raw_cooked_ratio || 1,
        ingredients: (r.recipe_ingredients || []).map(i => ({
          name: i.food_name, qty: i.quantity_g,
          kcal: i.calories, protein: i.protein, carbs: i.carbs, fat: i.fat,
        })),
      };
    } else {
      draft = { id: null, name: '', ratio: 1, ingredients: [newIng()] };
    }
    renderEditor();
  }

  function newIng() { return { name:'', qty:'', kcal:'', protein:'', carbs:'', fat:'' }; }

  function renderEditor() {
    const body = document.getElementById('recipes-mgr-body');
    if (!body) return;
    body.innerHTML = `
      <div class="flex items-center justify-between" style="margin-bottom:16px;">
        <button class="btn btn-ghost btn-sm" id="back-to-list">‹ Retour</button>
        <button class="btn btn-primary btn-sm" id="save-recipe-btn">Enregistrer</button>
      </div>
      <div class="form-group" style="margin-bottom:12px;">
        <label>Nom de la recette</label>
        <input type="text" id="recipe-name-inp" class="input" value="${draft.name}" placeholder="ex : Poulet sauté riz" maxlength="60">
      </div>
      <div class="form-group" style="margin-bottom:16px;">
        <label>Ratio cru/cuit</label>
        <input type="number" id="recipe-ratio-inp" class="input" value="${draft.ratio}" min="0.1" step="0.05" inputmode="decimal" style="max-width:120px;">
        <p style="font-size:0.75rem;color:var(--cream-dim);margin-top:4px;">Ex : 1.3 → 130g cru = 100g cuit</p>
      </div>
      <div class="flex items-center justify-between" style="margin-bottom:8px;">
        <p style="font-size:0.875rem;font-weight:600;color:var(--cream);">Ingrédients</p>
        <button class="btn btn-ghost btn-sm" id="add-ing-btn">+ Ingrédient</button>
      </div>
      <div id="recipe-ings-form"></div>`;

    renderIngForms();
    body.querySelector('#recipe-name-inp')?.addEventListener('input',  e => { draft.name  = e.target.value; });
    body.querySelector('#recipe-ratio-inp')?.addEventListener('input', e => { draft.ratio = e.target.value; });
    body.querySelector('#back-to-list')?.addEventListener('click', renderRecipesList);
    body.querySelector('#save-recipe-btn')?.addEventListener('click', async () => { const ok = await saveRecipe(); if (ok) renderRecipesList(); });
    body.querySelector('#add-ing-btn')?.addEventListener('click', () => { draft.ingredients.push(newIng()); renderIngForms(); });
  }

  function renderIngForms() {
    const cnt = document.getElementById('recipe-ings-form');
    if (!cnt) return;
    cnt.innerHTML = draft.ingredients.map((ing, i) => `
      <div style="margin-bottom:8px;padding:12px;background:var(--bg-surface);border-radius:10px;">
        <div class="flex gap-8" style="margin-bottom:8px;">
          <input type="text"   class="input" data-rf="name" data-ri="${i}" value="${ing.name}" placeholder="Ingrédient" style="flex:1;">
          <input type="number" class="input" data-rf="qty"  data-ri="${i}" value="${ing.qty}"  placeholder="g" min="0" inputmode="decimal" style="width:58px;padding:8px 6px;text-align:center;">
        </div>
        <div class="input-row" style="gap:5px;">
          <div class="form-group"><label class="macro-mini-label">Kcal/100g</label>
            <input type="number" class="input macro-mini-input" data-rf="kcal"    data-ri="${i}" value="${ing.kcal}"    min="0" inputmode="decimal"></div>
          <div class="form-group"><label class="macro-mini-label">Prot.</label>
            <input type="number" class="input macro-mini-input" data-rf="protein" data-ri="${i}" value="${ing.protein}" min="0" inputmode="decimal"></div>
          <div class="form-group"><label class="macro-mini-label">Gluc.</label>
            <input type="number" class="input macro-mini-input" data-rf="carbs"   data-ri="${i}" value="${ing.carbs}"   min="0" inputmode="decimal"></div>
          <div class="form-group"><label class="macro-mini-label">Lip.</label>
            <input type="number" class="input macro-mini-input" data-rf="fat"     data-ri="${i}" value="${ing.fat}"     min="0" inputmode="decimal"></div>
        </div>
        ${draft.ingredients.length > 1 ? `<button class="btn btn-ghost btn-sm btn-full" data-ri-remove="${i}" style="margin-top:6px;color:#c0392b;">Retirer</button>` : ''}
      </div>`).join('');

    cnt.addEventListener('input', e => {
      const f = e.target.dataset.rf, i = parseInt(e.target.dataset.ri);
      if (f && !isNaN(i)) draft.ingredients[i][f] = e.target.value;
    });
    cnt.addEventListener('click', e => {
      const btn = e.target.closest('[data-ri-remove]');
      if (btn) { draft.ingredients.splice(parseInt(btn.dataset.riRemove), 1); renderIngForms(); }
    });
  }

  function init() {}
  document.addEventListener('tabchange', e => { if (e.detail.tab === 'recipes') init(); });

  return { init, openManager };

})();
