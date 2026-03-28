window.FoodPicker = (() => {

  let activeTab = 'frequent';
  let onSave    = null;
  let catLabel  = '';

  // Exposed state for FoodPickerDetail
  const _state = {
    get onSave()   { return onSave; },
    get catLabel() { return catLabel; },
  };

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
  }

  function sourceBadge(food, favoriteNames, recentNames) {
    const norm = window.FoodCatalog?.normalize(food.name) || food.name;
    if (favoriteNames.has(norm)) return '<span class="food-result-badge favorite">Favori</span>';
    if (recentNames.has(norm))   return '<span class="food-result-badge recent">Recent</span>';
    if (food.source === 'off')   return '<span class="food-result-badge off">OFF</span>';
    return '<span class="food-result-badge catalog">Catalogue</span>';
  }

  /* ── Récents ───────────────────────────────── */
  function getRecentFoods()   { try { return JSON.parse(localStorage.getItem('elev-recent-foods') || '[]'); } catch (_) { return []; } }
  function addToRecents(food) {
    let recents = getRecentFoods().filter(r => r.name !== food.name);
    recents.unshift(food);
    const trimmed = recents.slice(0, 10);
    localStorage.setItem('elev-recent-foods', JSON.stringify(trimmed));
    window.CloudState?.schedule({ elev_recent_foods: trimmed });
  }

  /* ── Favoris ───────────────────────────────── */
  function getFavoriteFoods() {
    const uid = window.AppState?.user?.id || 'local';
    try { return JSON.parse(localStorage.getItem(`elev-food-favorites-${uid}`) || '[]'); } catch { return []; }
  }
  function toggleFavorite(food) {
    const uid  = window.AppState?.user?.id || 'local';
    let favs   = getFavoriteFoods();
    const idx  = favs.findIndex(f => f.name === food.name);
    if (idx >= 0) favs.splice(idx, 1);
    else favs.unshift(food);
    const trimmed = favs.slice(0, 30);
    localStorage.setItem(`elev-food-favorites-${uid}`, JSON.stringify(trimmed));
    window.CloudState?.schedule({ elev_food_favorites: trimmed });
    return idx < 0;
  }
  function isFavorite(foodName) { return getFavoriteFoods().some(f => f.name === foodName); }

  // Exposed helpers for FoodPickerDetail
  const _helpers = { getRecentFoods, addToRecents, getFavoriteFoods, toggleFavorite, isFavorite };

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

  function close() { document.getElementById('modal-add-food')?.classList.remove('open'); }

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
    const recents   = getRecentFoods();
    const favorites = getFavoriteFoods();
    const recentsHtml   = recents.length   ? `<div id="food-recents-section" style="padding:8px 16px 0;"><p style="font-size:0.75rem;font-weight:600;color:var(--cream-dim);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Récents</p><div style="display:flex;flex-wrap:wrap;gap:6px;" id="food-recents-chips"></div></div>` : '';
    const favoritesHtml = favorites.length ? `<div id="food-favorites-section" style="padding:8px 16px 0;"><p style="font-size:0.75rem;font-weight:600;color:var(--cream-dim);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Favoris</p><div style="display:flex;flex-wrap:wrap;gap:6px;" id="food-favorites-chips"></div></div>` : '';
    body.innerHTML = `
      <div class="food-search-bar">
        <input type="search" id="food-search-input" class="input" placeholder="Rechercher un aliment…" autocomplete="off" inputmode="search" style="margin:0;">
      </div>
      ${recentsHtml}${favoritesHtml}
      <div class="food-quick-tiles">
        <button class="food-quick-tile" id="qt-custom"><span class="food-quick-tile-icon">✏️</span><span>Personnalisé</span></button>
        <button class="food-quick-tile" id="qt-recipe"><span class="food-quick-tile-icon">👨‍🍳</span><span>Recettes</span></button>
        <button class="food-quick-tile" id="qt-scan"><span class="food-quick-tile-icon">📷</span><span>Scanner</span></button>
      </div>
      <div class="food-tabs">
        <button class="food-tab-btn active" data-tab="frequent">Fréquents</button>
        <button class="food-tab-btn" data-tab="recent">Récents</button>
      </div>
      <div id="food-results-list" class="food-results-scroll"></div>`;

    if (recents.length) {
      const chips = body.querySelector('#food-recents-chips');
      recents.slice(0, 6).forEach(food => {
        const chip = document.createElement('button');
        chip.className = 'badge badge-surface'; chip.style.cssText = 'cursor:pointer;padding:5px 10px;font-size:0.8125rem;border:none;';
        chip.textContent = food.name;
        chip.addEventListener('click', () => FoodPickerDetail.showFoodDetail(food));
        chips.appendChild(chip);
      });
    }
    if (favorites.length) {
      const chips = body.querySelector('#food-favorites-chips');
      favorites.slice(0, 6).forEach(food => {
        const chip = document.createElement('button');
        chip.className = 'badge badge-surface'; chip.style.cssText = 'cursor:pointer;padding:5px 10px;font-size:0.8125rem;border:none;';
        chip.textContent = '⭐ ' + food.name;
        chip.addEventListener('click', () => FoodPickerDetail.showFoodDetail(food));
        chips.appendChild(chip);
      });
    }

    renderFoodList('');
    const inp = body.querySelector('#food-search-input');
    inp?.focus();
    inp?.addEventListener('input', e => {
      body.querySelectorAll('.food-tab-btn').forEach(b => b.classList.remove('active'));
      renderFoodList(e.target.value);
    });
    body.querySelector('#qt-custom')?.addEventListener('click', () => FoodPickerDetail.showCustomFoodView());
    body.querySelector('#qt-recipe')?.addEventListener('click', () => FoodPickerDetail.showRecipeView());
    body.querySelector('#qt-scan')?.addEventListener('click', () => {
      if (window.BarcodeScanner) BarcodeScanner.scan(food => FoodPickerDetail.showFoodDetail(food));
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

  async function renderFoodList(query) {
    const list = document.getElementById('food-results-list');
    if (!list) return;
    let foods, sections = [];
    if (query.trim()) {
      list.innerHTML = `<div style="display:flex;justify-content:center;padding:24px 0;"><div class="spinner"></div></div>`;
      const recentFoods   = getRecentFoods();
      const favoriteFoods = getFavoriteFoods();
      if (window.FoodCatalog?.searchDetailed) {
        const result = await window.FoodCatalog.searchDetailed(query, { recentFoods, favoriteFoods });
        foods = result.items; sections = result.sections || [];
      } else {
        foods = await (window.FoodCatalog?.search(query) || Promise.resolve(FoodDB.search(query)));
      }
    } else if (activeTab === 'recent') {
      foods = getRecentFoods();
    } else {
      foods = FoodDB.search('').slice(0, 40);
    }
    if (!foods.length) {
      list.innerHTML = `<p class="food-no-result">Aucun resultat local - recherche OFF en cours ou essaie un aliment personnalise</p>`;
      return;
    }
    const favoriteNames = new Set(getFavoriteFoods().map(f => window.FoodCatalog?.normalize(f.name) || f.name));
    const recentNames   = new Set(getRecentFoods().map(f => window.FoodCatalog?.normalize(f.name) || f.name));
    const groups = sections.length ? sections : [{ key: 'default', title: query.trim() ? 'Resultats' : '', items: foods }];
    list.innerHTML = groups.map(section => `
      <section class="food-results-group" data-group="${section.key}">
        ${section.title ? `<div class="food-results-group-head"><p class="food-results-group-title">${section.title}</p><span class="food-results-group-count">${section.items.length}</span></div>` : ''}
        <div class="food-results-group-list">
          ${section.items.map(food => {
            const gi = foods.indexOf(food);
            return `<div class="food-list-row" data-fi="${gi}">
              <div class="food-list-info">
                <div class="food-list-topline"><p class="food-list-name">${escapeHtml(food.name)}</p>${sourceBadge(food, favoriteNames, recentNames)}</div>
                <p class="food-list-sub">${food.brand ? `${escapeHtml(food.brand)} - ` : ''}Pour 100 g</p>
              </div>
              <span class="food-list-kcal">${food.kcal} kcal</span>
              <button class="food-fav-btn${isFavorite(food.name) ? ' active' : ''}" data-fi="${gi}" aria-label="Favori">${isFavorite(food.name) ? '&#9733;' : '&#9734;'}</button>
              <button class="food-list-add" data-fi="${gi}" aria-label="Ajouter">+</button>
            </div>`;
          }).join('')}
        </div>
      </section>`).join('');

    list.querySelectorAll('.food-list-row').forEach(row => {
      const index = Number(row.dataset.fi);
      row.querySelector('.food-list-info')?.addEventListener('click', () => FoodPickerDetail.showFoodDetail(foods[index]));
      row.querySelector('.food-list-add')?.addEventListener('click',  e => { e.stopPropagation(); FoodPickerDetail.showFoodDetail(foods[index]); });
      row.querySelector('.food-fav-btn')?.addEventListener('click',   e => {
        e.stopPropagation();
        const added = toggleFavorite(foods[index]);
        const btn = e.currentTarget;
        btn.classList.toggle('active', added);
        btn.innerHTML = added ? '&#9733;' : '&#9734;';
      });
    });
  }

  return { open, close, setHeader, showSearchView, _state, _helpers };
})();
