/* ==========================================
   ÉTAT GLOBAL
   ========================================== */
window.AppState = {
  user:       null,
  session:    null,
  currentTab: 'home',
  switchTab(tab) { App.navigateTo(tab); }
};

/* ==========================================
   MODULE APP
   ========================================== */
const App = window.App = (() => {

  const TABS = ['routines', 'weight', 'home', 'nutrition', 'history', 'workouts'];

  /* ------------------------------------------
     ÉCRANS — loader / auth / app
     ------------------------------------------ */
  function showScreen(screen) {
    document.getElementById('loader-screen').style.display = screen === 'loader' ? 'flex' : 'none';
    document.getElementById('auth-screen').style.display   = screen === 'auth'   ? 'flex' : 'none';
    document.getElementById('app').style.display           = screen === 'app'    ? 'flex' : 'none';
  }

  function restoreUserMetadataCache(user) {
    const meta = user?.user_metadata;
    const uid  = user?.id;
    if (!meta || !uid) return;
    if (meta.elev_profile)          localStorage.setItem(`elev-profile-${uid}`, JSON.stringify(meta.elev_profile));
    if (meta.elev_goals)            localStorage.setItem(`elev-nutrition-goals-${uid}`, JSON.stringify(meta.elev_goals));
    if (meta.elev_avatar)           localStorage.setItem(`elev-avatar-${uid}`, meta.elev_avatar);
    if (meta.elev_onboarding_done)  localStorage.setItem(`elev-onboarding-done-${uid}`, '1');
    if (meta.elev_weight_logs)      localStorage.setItem(`elev-weight-logs-${uid}`, JSON.stringify(meta.elev_weight_logs));
    if (meta.elev_measurements)     localStorage.setItem(`elev-measurements-${uid}`, JSON.stringify(meta.elev_measurements));
    if (meta.elev_weight_profile)   localStorage.setItem(`elev-weight-profile-${uid}`, JSON.stringify(meta.elev_weight_profile));
    if (meta.elev_water_logs) {
      Object.entries(meta.elev_water_logs).forEach(([date, value]) => {
        localStorage.setItem(`elev-water-${uid}-${date}`, String(value || 0));
      });
    }
    if (meta.elev_recent_foods)   localStorage.setItem('elev-recent-foods', JSON.stringify(meta.elev_recent_foods));
    if (meta.elev_food_favorites) localStorage.setItem(`elev-food-favorites-${uid}`, JSON.stringify(meta.elev_food_favorites));
    if (meta.elev_routine_methods) {
      Object.entries(meta.elev_routine_methods).forEach(([routineId, methods]) => {
        localStorage.setItem(`elev-ex-methods-${routineId}`, JSON.stringify(methods || {}));
      });
    }
    if (meta.elev_routine_meta) {
      Object.entries(meta.elev_routine_meta).forEach(([routineId, routineMeta]) => {
        localStorage.setItem(`elev-routine-meta-${routineId}`, JSON.stringify(routineMeta || {}));
      });
    }
  }

  /* ------------------------------------------
     AUTH FLOW
     ------------------------------------------ */
  async function initAuth() {
    showScreen('loader');
    try {
      const session = await Auth.getSession();
      if (session) { onAuthenticated(session); }
      else          { showScreen('auth'); }
    } catch (err) {
      console.error('[Auth] Erreur getSession:', err);
      showScreen('auth');
    }
    Auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) { onAuthenticated(session); }
      else if (event === 'SIGNED_OUT')       { onSignedOut(); }
    });
  }

  function onAuthenticated(session) {
    AppState.session = session;
    AppState.user    = session.user;
    document.body.dataset.activeTab = AppState.currentTab;
    restoreUserMetadataCache(session.user);
    updateGreeting();
    showScreen('app');
    bindNavbar();
    renderHomeDate();
    if (window.HomeTab)    HomeTab.init();
    if (window.Coach)      Coach.init();
    if (window.Offline)    Offline.init();
    if (window.Onboarding && !Onboarding.isComplete()) Onboarding.show();
    if (window.Workouts)   Workouts.checkActiveSession();
    bindProfileBtn();
    bindPullToRefresh();
  }

  function onSignedOut() {
    AppState.session = null;
    AppState.user    = null;
    showScreen('auth');
    AppState.currentTab = 'home';
    TABS.forEach(t => {
      const panel = document.getElementById(`tab-${t}`);
      const btn   = document.querySelector(`.nav-tab[data-tab="${t}"]`);
      if (panel) panel.classList.toggle('active', t === 'home');
      if (btn)   { btn.classList.toggle('active', t === 'home'); btn.setAttribute('aria-selected', String(t === 'home')); }
    });
  }

  function updateGreeting() {
    const el = document.getElementById('home-greeting');
    if (!el || !AppState.user) return;
    const uid     = AppState.user.id;
    const profile = (() => { try { return JSON.parse(localStorage.getItem(`elev-profile-${uid}`) || 'null'); } catch { return null; } })();
    const prenom  = profile?.prenom;
    let name;
    if (prenom) {
      name = prenom.charAt(0).toUpperCase() + prenom.slice(1);
    } else {
      const localPart  = (AppState.user.email || '').split('@')[0];
      const firstName  = localPart.split(/[._]/)[0];
      name = firstName.charAt(0).toUpperCase() + firstName.slice(1);
    }
    el.textContent = `Bonjour, ${name}`;
  }

  function getAvatarDataUrl() {
    const uid = AppState.user?.id;
    if (!uid) return null;
    try { return localStorage.getItem(`elev-avatar-${uid}`); } catch { return null; }
  }

  function updateProfileButtonAvatar() {
    const btn    = document.getElementById('btn-open-profile');
    if (!btn) return;
    const avatar = getAvatarDataUrl();
    if (avatar) {
      btn.innerHTML = `<img src="${avatar}" alt="Profil" class="home-header-avatar">`;
      btn.classList.add('has-avatar');
    } else {
      btn.textContent = '👤';
      btn.classList.remove('has-avatar');
    }
  }

  /* ------------------------------------------
     PROFIL + DÉCONNEXION
     ------------------------------------------ */
  function bindProfileBtn() {
    const btn = document.getElementById('btn-open-profile');
    if (!btn) return;
    btn.replaceWith(btn.cloneNode(true));
    updateProfileButtonAvatar();
    document.getElementById('btn-open-profile')?.addEventListener('click', () => { if (window.Profile) Profile.open(); });
  }

  function bindSignOut() {
    const btn = document.getElementById('btn-signout');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      try { await Auth.signOut(); showToast('Déconnecté', 'info'); }
      catch (err) { console.error('[Auth] Erreur signOut:', err); showToast('Erreur lors de la déconnexion', 'error'); }
    });
  }

  /* ------------------------------------------
     NAVIGATION SPA
     ------------------------------------------ */
  function navigateTo(tab) {
    if (!TABS.includes(tab) || tab === AppState.currentTab) return;
    const prevIdx = TABS.indexOf(AppState.currentTab);
    const nextIdx = TABS.indexOf(tab);
    const dir     = nextIdx > prevIdx ? 'forward' : 'backward';

    const prevPanel = document.getElementById(`tab-${AppState.currentTab}`);
    const prevBtn   = document.querySelector(`.nav-tab[data-tab="${AppState.currentTab}"]`);
    if (prevPanel) prevPanel.classList.remove('active');
    if (prevBtn)   { prevBtn.classList.remove('active'); prevBtn.setAttribute('aria-selected', 'false'); }

    const nextPanel = document.getElementById(`tab-${tab}`);
    const nextBtn   = document.querySelector(`.nav-tab[data-tab="${tab}"]`);
    if (nextPanel) {
      nextPanel.classList.add('active');
    }
    if (nextBtn) { nextBtn.classList.add('active'); nextBtn.setAttribute('aria-selected', 'true'); }

    AppState.currentTab = tab;
    document.body.dataset.activeTab = tab;
    document.dispatchEvent(new CustomEvent('tabchange', { detail: { tab } }));
  }

  function bindNavbar() {
    document.querySelectorAll('.nav-tab').forEach(btn => btn.replaceWith(btn.cloneNode(true)));
    document.querySelectorAll('.nav-tab').forEach(btn => {
      btn.addEventListener('click', () => { if (btn.dataset.tab) navigateTo(btn.dataset.tab); });
    });
  }

  /* ------------------------------------------
     PULL TO REFRESH
     ------------------------------------------ */
  function bindPullToRefresh() {
    let startY = 0, startTop = 0, active = false;
    const THRESHOLD = 70;
    const indicator  = () => document.getElementById('ptr-indicator');
    const activePanel = () => document.querySelector('.tab-content.active');

    document.addEventListener('touchstart', e => {
      const panel = activePanel(); if (!panel) return;
      startTop = panel.scrollTop; startY = e.touches[0].clientY; active = true;
    }, { passive: true });

    document.addEventListener('touchmove', e => {
      if (!active || startTop > 4) return;
      if (e.touches[0].clientY - startY > 12) indicator()?.classList.add('visible');
    }, { passive: true });

    document.addEventListener('touchend', e => {
      if (!active) return; active = false;
      const ind = indicator();
      if (!ind || !ind.classList.contains('visible')) return;
      ind.classList.remove('visible');
      if (e.changedTouches[0].clientY - startY >= THRESHOLD)
        document.dispatchEvent(new CustomEvent('tabchange', { detail: { tab: AppState.currentTab } }));
    }, { passive: true });
  }

  /* ------------------------------------------
     DATE ACCUEIL
     ------------------------------------------ */
  function renderHomeDate() {
    const el = document.getElementById('home-date');
    if (!el) return;
    const str = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    el.textContent = str.charAt(0).toUpperCase() + str.slice(1);
  }

  /* ------------------------------------------
     TOASTS
     ------------------------------------------ */
  function showToast(message, type = 'info', duration = 3200) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type] ?? icons.info}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('toast-exit');
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }, duration);
  }

  /* ------------------------------------------
     THÈME
     ------------------------------------------ */
  function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'dark') root.dataset.theme = 'dark';
    else delete root.dataset.theme;
    const metaTheme = document.getElementById('meta-theme-color');
    if (metaTheme) metaTheme.content = theme === 'dark' ? '#0e0e0c' : '#F0EDE6';
    const icon = document.getElementById('theme-icon');
    if (icon) icon.textContent = theme === 'dark' ? '☀' : '☾';
  }

  function initTheme() { applyTheme(localStorage.getItem('elev-theme') || 'light'); }

  function bindThemeToggle() {
    const btn = document.getElementById('btn-theme-toggle');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      if (next === 'light') localStorage.removeItem('elev-theme');
      else localStorage.setItem('elev-theme', 'dark');
      if (navigator.vibrate) navigator.vibrate(6);
    });
  }

  /* ------------------------------------------
     INIT
     ------------------------------------------ */
  function init() {
    window.showToast = showToast;
    window.updateProfileButtonAvatar = updateProfileButtonAvatar;
    document.body.dataset.activeTab = AppState.currentTab;
    initTheme();
    AppAuth.bindAuthForm();
    bindSignOut();
    bindThemeToggle();
    document.addEventListener('profileavatarchange', updateProfileButtonAvatar);
    initAuth();
  }

  document.addEventListener('DOMContentLoaded', init);

  return { navigateTo, showToast };
})();
