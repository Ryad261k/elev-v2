/* ============================================
   SWIPE.JS — Navigation par swipe + pull-to-refresh
   Élev v2
   ============================================ */

(function () {

  const TABS = ['routines', 'weight', 'home', 'nutrition', 'history', 'workouts'];
  const SWIPE_MIN_X = 55;   // px horizontal minimum
  const SWIPE_MAX_Y = 60;   // px vertical maximum (pour ne pas interférer avec le scroll)
  const PULL_MIN    = 70;   // px tirage vertical pour déclencher le refresh

  let touchStartX = 0, touchStartY = 0;
  let touchStartScrollTop = 0;
  let pulling = false;
  let pullIndicator = null;

  /* ── Pull-to-refresh indicator ───────────── */
  function getPullIndicator() {
    if (!pullIndicator) {
      pullIndicator = document.createElement('div');
      pullIndicator.id = 'ptr-indicator';
      pullIndicator.innerHTML = '<div class="ptr-spinner"></div>';
      document.getElementById('app')?.prepend(pullIndicator);
    }
    return pullIndicator;
  }

  function showPull(pct) {
    const el = getPullIndicator();
    el.style.opacity    = Math.min(pct / PULL_MIN, 1);
    el.style.transform  = `translateY(${Math.min(pct * 0.4, 28)}px)`;
  }

  function hidePull() {
    const el = getPullIndicator();
    el.style.opacity   = '0';
    el.style.transform = 'translateY(0)';
  }

  function triggerRefresh() {
    const tab = window.AppState?.currentTab;
    if (!tab) return;
    const refreshMap = {
      home:      () => window.HomeTab?.refresh?.(),
      nutrition: () => window.Nutrition?.init?.(),
      weight:    () => window.Weight?.init?.(),
      history:   () => window.History?.init?.(),
      workouts:  () => window.Workouts?.init?.(),
      routines:  () => window.Routines?.init?.(),
    };
    refreshMap[tab]?.();
  }

  /* ── Touch handlers ──────────────────────── */
  document.addEventListener('touchstart', e => {
    const t = e.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    const activeTab = document.querySelector('.tab-content.active');
    touchStartScrollTop = activeTab?.scrollTop || 0;
    pulling = false;
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (!e.touches[0]) return;
    const dx = e.touches[0].clientX - touchStartX;
    const dy = e.touches[0].clientY - touchStartY;

    // Pull-to-refresh : tirage vers le bas quand scroll est en haut
    if (dy > 0 && Math.abs(dx) < 30 && touchStartScrollTop === 0) {
      pulling = true;
      showPull(dy);
    }
  }, { passive: true });

  document.addEventListener('touchend', e => {
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;

    // Pull-to-refresh
    if (pulling && dy > PULL_MIN) {
      hidePull();
      pulling = false;
      triggerRefresh();
      return;
    }
    hidePull();
    pulling = false;

    // Swipe horizontal : navigation entre onglets
    if (Math.abs(dx) < SWIPE_MIN_X) return;   // trop court
    if (Math.abs(dy) > SWIPE_MAX_Y) return;    // scroll vertical

    // Vérifier que le swipe vient d'une zone de contenu (pas d'un input/select)
    const target = e.target;
    if (target.closest('input, select, textarea, [data-no-swipe]')) return;
    // Éviter les conflits avec les sliders et modales ouvertes
    if (document.querySelector('.modal-backdrop.open')) return;

    const cur = TABS.indexOf(window.AppState?.currentTab);
    if (cur < 0) return;

    if (dx < 0 && cur < TABS.length - 1) {
      // Swipe gauche → onglet suivant
      window.App?.navigateTo?.(TABS[cur + 1]);
    } else if (dx > 0 && cur > 0) {
      // Swipe droite → onglet précédent
      window.App?.navigateTo?.(TABS[cur - 1]);
    }
  }, { passive: true });

})();
