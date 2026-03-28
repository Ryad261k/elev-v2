window.FoodPicker = (() => {

  let activeTab = 'frequent';
  let onSave    = null;
  let catLabel  = '';

  /* ── Récents (localStorage) ────────────────── */
  function getRecentFoods() {
    try { return JSON.parse(localStorage.getItem('elev-recent-foods') || '[]'); } catch(_) { return []; }
  }
  function addToRecents(food) {
    let recents = getRecentFoods().filter(r => r.name !== food.name);
    recents.unshift(food);
    localStorage.setItem('elev-recent-foods', JSON.stringify(recents.slice(0, 10)));
  }

  /* ── Modal shell ───────────────────────────── */
  function ensureModal() {
    let modal = document.getElementById('modal-add-food');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.id = 'modal-add-food';
    modal.innerHTML = `
      <div class="modal" style="max-height:95dvh;display:flex;flex-direction:column;">
        <div class="modal-handle"></div>
        <div class="modal-header" style="flex-shrink:0;">
          <button class="btn btn-icon" id="food-modal-back" style="display:none;font-size:1.25rem;">‹</button>
          <p class="modal-title" id="food-modal-title"></p>
          <button class="btn btn-icon" id="close-food-modal">✕</button>
        </div>
        <div id="food-modal-body" style="display:flex;flex-direction:column;overflow:hidden;flex:1;min-height:0;"></div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    document.getElementById('close-food-modal')?.addEventListener('click', close);
    return modal;
  }

  function open(catName, saveCallback) {
    catLabel  = catName;
    onSave    = saveCallback;
    activeTab = 'frequent';
    const modal = ensureModal();
    document.getElementById('food-modal-title').textContent = catName;
    document.getElementById('food-modal-back').style.display = 'none';
    showSearchView();
    setTimeout(() => modal.classList.add('open'), 10);
  }

  function close() {
    document.getElementById('modal-add-food')?.classList.remove('open');
  }

  function setHeader(titleText, backFn) {
    const backBtn = document.getElementById('food-modal-back');
    const title   = document.getElementById('food-modal-title');
    if (title)   title.textContent = titleText;
    if (backBtn) { backBtn.style.display = backFn ? 'flex' : 'none'; if (backFn) backBtn.onclick = backFn; }
  }

  /* ── Vue : recherche ────────────────────────── */
  function showSearchView() {
    setHeader(catLabel, null);
    const body = document.getElementById('food-modal-body');
    if (!body) return;
    const recents = getRecentFoods();
    const recentsHtml = recents.length ? `
      <div id="food-recents-section" style="padding:8px 16px 0;">
        <p style="font-size:0.75rem;font-weight:600;color:var(--cream-dim);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Récents</p>
        <div style="display:flex;flex-wrap:wrap;gap:6px;" id="food-recents-chips"></div>
      </div>` : '';
    body.innerHTML = `
      <div class="food-search-bar">
        <input type="search" id="food-search-input" class="input" placeholder="Rechercher un aliment…" autocomplete="off" inputmode="search" style="margin:0;">
      </div>
      ${recentsHtml}
      <div class="food-quick-tiles">
        <button class="food-quick-tile" id="qt-custom">
          <span class="food-quick-tile-icon">✏️</span><span>Personnalisé</span>
        </button>
        <button class="food-quick-tile" id="qt-recipe">
          <span class="food-quick-tile-icon">👨‍🍳</span><span>Recettes</span>
        </button>
        <button class="food-quick-tile" id="qt-scan">
          <span class="food-quick-tile-icon">📷</span><span>Scanner</span>
        </button>
      </div>
      <div class="food-tabs">
        <button class="food-tab-btn active" data-tab="frequent">Fréquents</button>
        <button class="food-tab-btn" data-tab="recent">Récents</button>
      </div>
      <div id="food-results-list" class="food-results-scroll"></div>`;

    // Chips récents cliquables
    if (recents.length) {
      const chipsEl = body.querySelector('#food-recents-chips');
      if (chipsEl) {
        recents.slice(0, 6).forEach(food => {
          const chip = document.createElement('button');
          chip.className = 'badge badge-surface';
          chip.style.cssText = 'cursor:pointer;padding:5px 10px;font-size:0.8125rem;border:none;';
          chip.textContent = food.name;
          chip.addEventListener('click', () => showFoodDetail(food));
          chipsEl.appendChild(chip);
        });
      }
    }

    renderFoodList('');
    const inp = body.querySelector('#food-search-input');
    inp?.focus();
    inp?.addEventListener('input', e => {
      body.querySelectorAll('.food-tab-btn').forEach(b => b.classList.remove('active'));
      renderFoodList(e.target.value);
    });
    body.querySelector('#qt-custom')?.addEventListener('click', showCustomFoodView);
    body.querySelector('#qt-recipe')?.addEventListener('click',  showRecipeView);
    body.querySelector('#qt-scan')?.addEventListener('click', () => {
      if (window.BarcodeScanner) BarcodeScanner.scan(food => showFoodDetail(food));
    });
    body.querySelectorAll('.food-tab-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        body.querySelectorAll('.food-tab-btn').forEach(b => b.classList.toggle('active', b === btn));
        const i2 = body.querySelector('#food-search-input');
        if (i2) i2.value = '';
        renderFoodList('');
      })
    );
  }

  function renderFoodList(query) {
    const list = document.getElementById('food-results-list');
    if (!list) return;
    let foods;
    if (query.trim()) {
      foods = FoodDB.search(query);
    } else if (activeTab === 'recent') {
      foods = getRecentFoods();
    } else {
      foods = FoodDB.search('').slice(0, 40);
    }
    if (!foods.length) {
      list.innerHTML = `<p class="food-no-result">Aucun résultat · essaie un aliment personnalisé</p>`;
      return;
    }
    list.innerHTML = foods.map((f, i) => `
      <div class="food-list-row" data-fi="${i}">
        <div class="food-list-info">
          <p class="food-list-name">${f.name}</p>
          <p class="food-list-sub">100g · ${f.protein}P ${f.carbs}G ${f.fat}L</p>
        </div>
        <span class="food-list-kcal">${f.kcal} kcal</span>
        <button class="food-list-add" data-fi="${i}" aria-label="Ajouter">+</button>
      </div>`).join('');

    list.querySelectorAll('.food-list-row').forEach((row, i) => {
      row.querySelector('.food-list-info')?.addEventListener('click', () => showFoodDetail(foods[i]));
      row.querySelector('.food-list-add')?.addEventListener('click', e => { e.stopPropagation(); showFoodDetail(foods[i]); });
    });
  }

  /* ── Portions (Supabase) ──────────────────── */
  async function fetchPortions(foodName) {
    try {
      const { data } = await DB.from('food_portions')
        .select('id, portion_name, grams').eq('user_id', DB.userId())
        .eq('food_name', foodName).order('created_at');
      return data || [];
    } catch(_) { return []; }
  }
  async function createPortion(foodName, name, grams) {
    const { error } = await DB.from('food_portions')
      .insert({ user_id: DB.userId(), food_name: foodName, portion_name: name, grams });
    if (error) throw error;
  }
  async function deletePortion(id) {
    const { error } = await DB.from('food_portions').delete().eq('id', id);
    if (error) throw error;
  }

  /* ── Drum picker ───────────────────────────── */
  function setupDrum(col, values, initVal) {
    const H = 44, PAD = 2;
    [...Array(PAD).fill(''), ...values, ...Array(PAD).fill('')].forEach(v => {
      const el = document.createElement('div');
      el.className = 'drum-item'; el.textContent = v; col.appendChild(el);
    });
    const initIdx = Math.max(0, values.indexOf(String(initVal)));
    col.scrollTop = (initIdx + PAD) * H;
    let timer;
    col.addEventListener('scroll', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const raw = Math.round(col.scrollTop / H - PAD);
        const clamped = Math.max(0, Math.min(values.length - 1, raw));
        col.scrollTo({ top: (clamped + PAD) * H, behavior: 'smooth' });
      }, 100);
    });
    return {
      get: () => values[Math.max(0, Math.min(values.length-1, Math.round(col.scrollTop/H - PAD)))] ?? values[0],
      set: (v, sm) => { const i = values.indexOf(String(v)); if (i >= 0) col.scrollTo({ top: (i+PAD)*H, behavior: sm ? 'smooth' : 'instant' }); },
    };
  }

  /* ── Vue : détail aliment (Yazio layout) ────── */
  function showFoodDetail(food) {
    setHeader(food.name, showSearchView);
    const body = document.getElementById('food-modal-body');
    if (!body) return;
    body.innerHTML = `<div class="workout-spinner" style="padding:60px 0;"><div class="spinner"></div></div>`;
    _renderFoodDetail(body, food);
  }

  async function _renderFoodDetail(body, food) {
    const portions = await fetchPortions(food.name);
    const portionOpts = portions.map((p, i) =>
      `<option value="p${i}">${p.portion_name} (${p.grams}g)</option>`).join('');
    const portionsHtml = portions.length
      ? `<div class="food-portions-list"><p class="food-section-label">Mes portions</p>${portions.map(p =>
          `<div class="food-portion-row"><span class="food-portion-label">${p.portion_name}</span><span class="food-portion-g">${p.grams}g</span><button class="cat-item-del btn" data-delportion="${p.id}">✕</button></div>`
        ).join('')}</div>`
      : '';

    body.innerHTML = `
      <div class="food-detail-hero">
        <p class="food-detail-hero-name">${food.name}</p>
        <p class="food-detail-hero-sub">Pour 100g</p>
      </div>
      <div class="food-detail-macro-row">
        <div class="food-detail-macro-col"><p class="food-detail-macro-val">${food.kcal}</p><p class="food-detail-macro-lbl">Calories</p></div>
        <div class="food-detail-macro-col"><p class="food-detail-macro-val">${food.carbs}g</p><p class="food-detail-macro-lbl">Glucides</p></div>
        <div class="food-detail-macro-col"><p class="food-detail-macro-val">${food.protein}g</p><p class="food-detail-macro-lbl">Protéines</p></div>
        <div class="food-detail-macro-col"><p class="food-detail-macro-val">${food.fat}g</p><p class="food-detail-macro-lbl">Lipides</p></div>
      </div>
      ${(food.fibres != null || food.sodium != null) ? `<div class="food-micro-row">
        ${food.fibres != null ? `<span class="food-micro-chip">Fibres ${food.fibres}g</span>` : ''}
        ${food.sodium != null ? `<span class="food-micro-chip">Sodium ${food.sodium}mg</span>` : ''}
        ${food.sucres != null ? `<span class="food-micro-chip">Sucres ${food.sucres}g</span>` : ''}
      </div>` : ''}
      <div class="food-detail-scroll">
        ${portionsHtml}
        <div id="food-portion-form" style="display:none;" class="food-portion-create-form">
          <p class="food-section-label" style="margin-bottom:8px;">Nouvelle portion</p>
          <div class="input-row" style="gap:8px;margin-bottom:8px;">
            <div class="form-group" style="flex:2;"><label>Nom</label>
              <input type="text" id="portion-name-inp" class="input" placeholder="ex : 1 portion" maxlength="30"></div>
            <div class="form-group" style="flex:1;"><label>Grammes</label>
              <input type="number" id="portion-g-inp" class="input" placeholder="30" min="1" inputmode="decimal"></div>
          </div>
          <button class="btn btn-secondary btn-sm btn-full" id="save-portion-btn">Enregistrer</button>
        </div>
        <button class="btn btn-ghost btn-sm btn-full" id="btn-create-portion" style="border-style:dashed;">+ Créer une portion</button>
      </div>
      <div class="food-detail-bottom">
        <div class="food-qty-bar">
          <input type="number" id="food-qty-input" class="food-qty-number" value="100" min="1" max="999" inputmode="numeric">
          <div class="food-qty-sep"></div>
          <select id="food-unit-select" class="food-qty-unit">
            <option value="g">g</option>${portionOpts}
          </select>
        </div>
        <p id="food-qty-preview" class="food-qty-preview"></p>
        <div class="drum-wrap"><div class="drum-fade drum-fade-top"></div><div class="drum-highlight"></div><div class="drum-fade drum-fade-bottom"></div><div class="drum-col drum-col-qty"></div></div>
        <button class="btn btn-primary btn-full btn-lg" id="food-add-btn">Ajouter</button>
      </div>`;

    const qtyInp  = body.querySelector('#food-qty-input');
    const unitSel = body.querySelector('#food-unit-select');
    const preview = body.querySelector('#food-qty-preview');
    const drumCol = body.querySelector('.drum-col-qty');
    const nums    = Array.from({length: 999}, (_, i) => String(i + 1));
    const drum    = setupDrum(drumCol, nums, '100');

    const gFromInputs = () => {
      const raw = parseFloat(qtyInp.value) || 0;
      if (unitSel.value === 'g') return raw;
      const p = portions[parseInt(unitSel.value.slice(1))];
      return p ? raw * p.grams : raw;
    };
    const updatePreview = () => {
      const g = gFromInputs();
      preview.textContent = g ? `→ ${Math.round(food.kcal*g/100)} kcal · ${(food.protein*g/100).toFixed(1)}P · ${(food.carbs*g/100).toFixed(1)}G · ${(food.fat*g/100).toFixed(1)}L` : '';
    };
    drumCol.addEventListener('scroll', () => { const v = drum.get(); if (qtyInp.value !== v) qtyInp.value = v; updatePreview(); });
    qtyInp.addEventListener('input',   () => { drum.set(parseInt(qtyInp.value) || 1, true); updatePreview(); });
    unitSel.addEventListener('change', () => { if (unitSel.value !== 'g') { qtyInp.value = '1'; drum.set(1, true); } updatePreview(); });
    updatePreview();

    body.querySelector('#btn-create-portion')?.addEventListener('click', () => {
      const form = body.querySelector('#food-portion-form');
      form.style.display = form.style.display === 'none' ? 'block' : 'none';
      if (form.style.display !== 'none') body.querySelector('#portion-name-inp')?.focus();
    });
    body.querySelector('#save-portion-btn')?.addEventListener('click', async () => {
      const name  = body.querySelector('#portion-name-inp')?.value.trim();
      const grams = parseFloat(body.querySelector('#portion-g-inp')?.value) || 0;
      if (!name || !grams) { showToast('Remplis le nom et les grammes', 'error'); return; }
      try { await createPortion(food.name, name, grams); showToast('Portion enregistrée ✓', 'success'); _renderFoodDetail(body, food); }
      catch(_) { showToast('Erreur lors de la sauvegarde', 'error'); }
    });
    body.querySelectorAll('[data-delportion]').forEach(btn => btn.addEventListener('click', async () => {
      try { await deletePortion(btn.dataset.delportion); _renderFoodDetail(body, food); }
      catch(_) { showToast('Erreur suppression', 'error'); }
    }));
    body.querySelector('#food-add-btn')?.addEventListener('click', async () => {
      const g = gFromInputs(); if (!g) { showToast('Entre une quantité', 'error'); return; }
      addToRecents(food);
      if (onSave) await onSave({ name: food.name, qty: Math.round(g), kcal: +(food.kcal*g/100).toFixed(0),
        protein: +(food.protein*g/100).toFixed(1), carbs: +(food.carbs*g/100).toFixed(1), fat: +(food.fat*g/100).toFixed(1),
        fibres: food.fibres != null ? +(food.fibres*g/100).toFixed(1) : null,
        sodium: food.sodium != null ? Math.round(food.sodium*g/100) : null });
      close();
    });
  }

  /* ── Vue : aliment personnalisé ─────────────── */
  function showCustomFoodView() {
    setHeader('Personnalisé', showSearchView);
    const body = document.getElementById('food-modal-body');
    if (!body) return;
    body.innerHTML = `
      <div style="padding:16px;overflow-y:auto;display:flex;flex-direction:column;gap:12px;flex:1;">
        <div class="form-group"><label>Nom</label>
          <input type="text" id="cust-name" class="input" placeholder="ex : Quiche lorraine" maxlength="80"></div>
        <div class="form-group"><label>Quantité (g)</label>
          <input type="number" id="cust-qty" class="input" placeholder="100" min="1" inputmode="decimal"></div>
        <p class="food-section-label" style="margin-bottom:0;">Valeurs pour 100g</p>
        <div class="input-row" style="gap:8px;">
          <div class="form-group"><label class="macro-mini-label">Kcal</label>
            <input type="number" id="cust-kcal" class="input macro-mini-input" min="0" inputmode="decimal"></div>
          <div class="form-group"><label class="macro-mini-label">Prot.</label>
            <input type="number" id="cust-prot" class="input macro-mini-input" min="0" inputmode="decimal"></div>
          <div class="form-group"><label class="macro-mini-label">Gluc.</label>
            <input type="number" id="cust-carb" class="input macro-mini-input" min="0" inputmode="decimal"></div>
          <div class="form-group"><label class="macro-mini-label">Lip.</label>
            <input type="number" id="cust-fat" class="input macro-mini-input" min="0" inputmode="decimal"></div>
        </div>
        <div class="input-row" style="gap:8px;">
          <div class="form-group"><label class="macro-mini-label">Fibres</label>
            <input type="number" id="cust-fibres" class="input macro-mini-input" min="0" inputmode="decimal" placeholder="g"></div>
          <div class="form-group"><label class="macro-mini-label">Sodium</label>
            <input type="number" id="cust-sodium" class="input macro-mini-input" min="0" inputmode="decimal" placeholder="mg"></div>
        </div>
        <button class="btn btn-primary btn-full" id="save-custom" style="margin-top:8px;">Ajouter</button>
      </div>`;
    body.querySelector('#save-custom')?.addEventListener('click', async () => {
      const g   = id => parseFloat(document.getElementById(id)?.value) || 0;
      const name = document.getElementById('cust-name')?.value.trim();
      const qty = g('cust-qty'), k = g('cust-kcal'), p = g('cust-prot'), c = g('cust-carb'), f = g('cust-fat');
      const fi = g('cust-fibres'), so = g('cust-sodium');
      if (!name) { showToast("Donne un nom à l'aliment", 'error'); return; }
      if (!qty)  { showToast('Entre une quantité', 'error'); return; }
      if (onSave) await onSave({ name, qty, kcal: +(k*qty/100).toFixed(0), protein: +(p*qty/100).toFixed(1),
        carbs: +(c*qty/100).toFixed(1), fat: +(f*qty/100).toFixed(1),
        fibres: fi ? +(fi*qty/100).toFixed(1) : null, sodium: so ? Math.round(so*qty/100) : null });
      close();
    });
  }

  /* ── Vue : recettes ─────────────────────────── */
  async function showRecipeView() {
    setHeader('Recettes', showSearchView);
    const body = document.getElementById('food-modal-body');
    if (!body) return;
    body.innerHTML = `<div style="padding:16px;overflow-y:auto;flex:1;"><div class="workout-spinner"><div class="spinner"></div></div></div>`;
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
      inner.insertAdjacentHTML('beforeend', '<p style="text-align:center;color:var(--cream-dim);padding:24px 0;">Aucune recette enregistrée</p>');
      return;
    }
    recipes.forEach(r => {
      const raw = (r.recipe_ingredients||[]).reduce((s,i) => ({
        kcal: s.kcal+i.calories*i.quantity_g/100, protein: s.protein+i.protein*i.quantity_g/100,
        carbs: s.carbs+i.carbs*i.quantity_g/100, fat: s.fat+i.fat*i.quantity_g/100, qty: s.qty+i.quantity_g,
      }), {kcal:0,protein:0,carbs:0,fat:0,qty:0});
      const ratio = r.raw_cooked_ratio || 1;
      const p100 = raw.qty > 0
        ? { kcal: raw.kcal*ratio/raw.qty*100, protein: raw.protein*ratio/raw.qty*100,
            carbs: raw.carbs*ratio/raw.qty*100, fat: raw.fat*ratio/raw.qty*100 }
        : { kcal:0, protein:0, carbs:0, fat:0 };
      const card = document.createElement('div');
      card.className = 'food-list-row'; card.style.flexDirection = 'column';
      card.innerHTML = `
        <div class="flex items-center justify-between" style="width:100%;cursor:pointer;">
          <div class="food-list-info">
            <p class="food-list-name">${r.name}</p>
            <p class="food-list-sub">${Math.round(p100.kcal)} kcal / 100g cuit</p>
          </div><span style="color:var(--cream-dim);">›</span>
        </div>
        <div class="recipe-qty-form" style="display:none;margin-top:10px;width:100%;">
          <div class="flex gap-8 items-center">
            <input type="number" class="input" placeholder="Grammes (cuit)" min="1" inputmode="decimal" style="flex:1;margin:0;">
            <button class="btn btn-primary btn-sm">Ajouter</button>
          </div>
        </div>`;
      card.querySelector('.flex').addEventListener('click', () => {
        const form = card.querySelector('.recipe-qty-form');
        form.style.display = form.style.display === 'none' ? 'block' : 'none';
        if (form.style.display !== 'none') form.querySelector('input').focus();
      });
      card.querySelector('.btn-primary').addEventListener('click', async () => {
        const g = parseFloat(card.querySelector('input').value) || 0; if (!g) return;
        if (onSave) await onSave({ name:r.name, qty:g, kcal:+(p100.kcal*g/100).toFixed(0),
          protein:+(p100.protein*g/100).toFixed(1), carbs:+(p100.carbs*g/100).toFixed(1), fat:+(p100.fat*g/100).toFixed(1) });
        close();
      });
      inner.appendChild(card);
    });
  }

  return { open, close };
})();
