/* ==========================================
   ÉTAT GLOBAL
   ========================================== */
window.AppState = {
  user:       null,   // objet user Supabase ({ id, email, ... })
  session:    null,   // session Supabase complète
  currentTab: 'home',

  /** Raccourci pour changer de tab depuis n'importe quel module */
  switchTab(tab) {
    App.navigateTo(tab);
  }
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
    // Utilise style.display (inline) pour battre la spécificité des règles ID en CSS
    document.getElementById('loader-screen').style.display = screen === 'loader' ? 'flex' : 'none';
    document.getElementById('auth-screen').style.display   = screen === 'auth'   ? 'flex' : 'none';
    document.getElementById('app').style.display           = screen === 'app'    ? 'flex' : 'none';
  }

  function restoreUserMetadataCache(user) {
    const meta = user?.user_metadata;
    const uid = user?.id;
    if (!meta || !uid) return;

    if (meta.elev_profile) localStorage.setItem(`elev-profile-${uid}`, JSON.stringify(meta.elev_profile));
    if (meta.elev_goals) localStorage.setItem(`elev-nutrition-goals-${uid}`, JSON.stringify(meta.elev_goals));
    if (meta.elev_avatar) localStorage.setItem(`elev-avatar-${uid}`, meta.elev_avatar);
    if (meta.elev_onboarding_done) localStorage.setItem(`elev-onboarding-done-${uid}`, '1');

    if (meta.elev_weight_logs) localStorage.setItem(`elev-weight-logs-${uid}`, JSON.stringify(meta.elev_weight_logs));
    if (meta.elev_measurements) localStorage.setItem(`elev-measurements-${uid}`, JSON.stringify(meta.elev_measurements));
    if (meta.elev_weight_profile) localStorage.setItem(`elev-weight-profile-${uid}`, JSON.stringify(meta.elev_weight_profile));
    if (meta.elev_water_logs) {
      Object.entries(meta.elev_water_logs).forEach(([date, value]) => {
        localStorage.setItem(`elev-water-${uid}-${date}`, String(value || 0));
      });
    }
    if (meta.elev_recent_foods) localStorage.setItem('elev-recent-foods', JSON.stringify(meta.elev_recent_foods));
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
      if (session) {
        onAuthenticated(session);
      } else {
        showScreen('auth');
      }
    } catch (err) {
      console.error('[Auth] Erreur getSession:', err);
      showScreen('auth');
    }

    // Écoute les changements d'état (connexion, déconnexion)
    Auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        onAuthenticated(session);
      } else if (event === 'SIGNED_OUT') {
        onSignedOut();
      }
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
    if (window.HomeTab) HomeTab.init();
    if (window.Coach) Coach.init(); if (window.Offline) Offline.init();
    if (window.Onboarding && !Onboarding.isComplete()) Onboarding.show();
    if (window.Workouts) Workouts.checkActiveSession();
    bindProfileBtn();
    bindPullToRefresh();
  }

  function onSignedOut() {
    AppState.session = null;
    AppState.user    = null;
    showScreen('auth');
    // Reset tab
    AppState.currentTab = 'home';
    // Réaffiche l'onglet Accueil pour la prochaine connexion
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
    // Préfère le prénom du profil, sinon dérive depuis l'email
    const uid     = AppState.user.id;
    const profile = (() => { try { return JSON.parse(localStorage.getItem(`elev-profile-${uid}`) || 'null'); } catch { return null; } })();
    const prenom  = profile?.prenom;
    let name;
    if (prenom) {
      name = prenom.charAt(0).toUpperCase() + prenom.slice(1);
    } else {
      const email = AppState.user.email || '';
      const localPart = email.split('@')[0];
      const firstName = localPart.split(/[._]/)[0];
      name = firstName.charAt(0).toUpperCase() + firstName.slice(1);
    }
    el.textContent = `Bonjour, ${name}`;
  }

  function getAvatarDataUrl() {
    const uid = AppState.user?.id;
    if (!uid) return null;
    try { return localStorage.getItem(`elev-avatar-${uid}`); }
    catch { return null; }
  }

  function updateProfileButtonAvatar() {
    const btn = document.getElementById('btn-open-profile');
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
     FORM EMAIL + PASSWORD
     ------------------------------------------ */
  function bindAuthForm() {
    const form        = document.getElementById('auth-form');
    if (!form) return;

    const emailInput  = document.getElementById('auth-email');
    const pwInput     = document.getElementById('auth-password');
    const confirmPw   = document.getElementById('auth-confirm-pw');
    const confirmGrp  = document.getElementById('auth-confirm-pw-group');
    const btn         = document.getElementById('auth-submit');
    const toggleMode  = document.getElementById('auth-toggle-mode');
    const modeTitle   = document.getElementById('auth-mode-title');
    const modeSub     = document.getElementById('auth-mode-subtitle');
    const errorEl     = document.getElementById('auth-error');
    const signupConf  = document.getElementById('auth-signup-confirm');
    const backBtn     = document.getElementById('auth-back');
    const togglePwBtn = document.getElementById('btn-toggle-pw');

    let mode = 'login'; // 'login' | 'signup'

    function setError(msg) {
      if (!errorEl) return;
      if (msg) {
        errorEl.textContent = msg;
        errorEl.style.display = 'block';
      } else {
        errorEl.style.display = 'none';
      }
    }

    function setLoading(loading) {
      btn.disabled    = loading;
      btn.textContent = loading
        ? (mode === 'login' ? 'Connexion…' : 'Création…')
        : (mode === 'login' ? 'Se connecter' : 'Créer mon compte');
    }

    function switchMode(newMode) {
      mode = newMode;
      setError('');
      if (mode === 'login') {
        modeTitle.textContent   = 'Connexion';
        modeSub.textContent     = 'Bienvenue — connecte-toi pour continuer.';
        btn.textContent         = 'Se connecter';
        toggleMode.textContent  = 'Pas encore de compte ? S\'inscrire';
        confirmGrp.style.display = 'none';
        pwInput.autocomplete    = 'current-password';
      } else {
        modeTitle.textContent   = 'Inscription';
        modeSub.textContent     = 'Crée ton compte en quelques secondes.';
        btn.textContent         = 'Créer mon compte';
        toggleMode.textContent  = 'Déjà un compte ? Se connecter';
        confirmGrp.style.display = '';
        pwInput.autocomplete    = 'new-password';
      }
    }

    // Afficher/masquer mot de passe
    if (togglePwBtn) {
      togglePwBtn.addEventListener('click', () => {
        const isHidden = pwInput.type === 'password';
        pwInput.type          = isHidden ? 'text' : 'password';
        togglePwBtn.textContent = isHidden ? '🙈' : '👁';
      });
    }

    // Bascule login ↔ signup
    if (toggleMode) {
      toggleMode.addEventListener('click', () => {
        switchMode(mode === 'login' ? 'signup' : 'login');
      });
    }

    // Soumission du formulaire
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      setError('');

      const email    = emailInput?.value.trim();
      const password = pwInput?.value;

      if (!email || !password) {
        setError('Remplis tous les champs.');
        return;
      }
      if (password.length < 6) {
        setError('Le mot de passe doit faire au moins 6 caractères.');
        return;
      }
      if (mode === 'signup' && password !== confirmPw?.value) {
        setError('Les mots de passe ne correspondent pas.');
        return;
      }

      setLoading(true);

      try {
        if (mode === 'login') {
          await Auth.signIn(email, password);
          // onAuthStateChange gère la suite (SIGNED_IN → onAuthenticated)
        } else {
          const result = await Auth.signUp(email, password);
          // Si Supabase "Confirm email" est activé → session null → afficher confirmation
          // Si désactivé → session présente → onAuthStateChange gère la suite
          if (!result.session) {
            form.style.display          = 'none';
            signupConf.style.display    = 'flex';
          }
        }
      } catch (err) {
        console.error('[Auth] Erreur:', err);
        const msg = translateAuthError(err);
        setError(msg);
        setLoading(false);
      }
    });

    // Retour depuis l'écran de confirmation inscription
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        signupConf.style.display = 'none';
        form.style.display       = '';
        switchMode('login');
        setLoading(false);
      });
    }
  }

  /** Traduit les erreurs Supabase en français (reçoit l'objet erreur complet) */
  function translateAuthError(err) {
    if (!err) return 'Une erreur est survenue.';
    const code = (err.code || '').toLowerCase();
    const msg  = (err.message || '').toLowerCase();

    // Email non confirmé — Supabase peut envoyer le code OU masquer derrière "invalid credentials"
    if (code === 'email_not_confirmed' || msg.includes('email not confirmed'))
      return 'Confirme ton adresse email avant de te connecter. Vérifie ta boîte mail.';

    // Identifiants invalides — peut aussi cacher un email non confirmé
    if (code === 'invalid_credentials' || msg.includes('invalid login') || msg.includes('invalid credentials'))
      return 'Email ou mot de passe incorrect. Si tu viens de t\'inscrire, pense à confirmer ton adresse email.';

    if (code === 'user_already_exists' || msg.includes('user already registered') || msg.includes('already been registered'))
      return 'Un compte existe déjà avec cet email. Connecte-toi.';

    if (msg.includes('password should be'))
      return 'Le mot de passe doit faire au moins 6 caractères.';

    if (msg.includes('rate limit') || msg.includes('too many'))
      return 'Trop de tentatives. Réessaie dans quelques minutes.';

    return 'Erreur : ' + (err.message || 'inconnue');
  }

  function bindProfileBtn() {
    const btn = document.getElementById('btn-open-profile');
    if (!btn) return;
    btn.replaceWith(btn.cloneNode(true));
    updateProfileButtonAvatar();
    document.getElementById('btn-open-profile')?.addEventListener('click', () => { if (window.Profile) Profile.open(); });
  }

  /* ------------------------------------------
     BOUTON DÉCONNEXION
     ------------------------------------------ */
  function bindSignOut() {
    const btn = document.getElementById('btn-signout');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      try {
        await Auth.signOut();
        showToast('Déconnecté', 'info');
      } catch (err) {
        console.error('[Auth] Erreur signOut:', err);
        showToast('Erreur lors de la déconnexion', 'error');
      }
    });
  }

  /* ------------------------------------------
     NAVIGATION SPA
     ------------------------------------------ */
  function navigateTo(tab) {
    if (!TABS.includes(tab)) return;
    if (tab === AppState.currentTab) return;

    const prevIdx = TABS.indexOf(AppState.currentTab);
    const nextIdx = TABS.indexOf(tab);
    const dir = nextIdx > prevIdx ? 'forward' : 'backward';

    const prevPanel = document.getElementById(`tab-${AppState.currentTab}`);
    const prevBtn   = document.querySelector(`.nav-tab[data-tab="${AppState.currentTab}"]`);
    if (prevPanel) { prevPanel.classList.remove('active'); }
    if (prevBtn)   { prevBtn.classList.remove('active'); prevBtn.setAttribute('aria-selected', 'false'); }

    const nextPanel = document.getElementById(`tab-${tab}`);
    const nextBtn   = document.querySelector(`.nav-tab[data-tab="${tab}"]`);
    if (nextPanel) {
      nextPanel.classList.add('active');
      nextPanel.classList.add(dir === 'forward' ? 'tab-enter-right' : 'tab-enter-left');
      nextPanel.addEventListener('animationend', () => {
        nextPanel.classList.remove('tab-enter-right', 'tab-enter-left');
      }, { once: true });
    }
    if (nextBtn) { nextBtn.classList.add('active'); nextBtn.setAttribute('aria-selected', 'true'); }

    AppState.currentTab = tab;
    document.body.dataset.activeTab = tab;
    document.dispatchEvent(new CustomEvent('tabchange', { detail: { tab } }));
  }

  function bindNavbar() {
    document.querySelectorAll('.nav-tab').forEach(btn => {
      // Évite de dupliquer les listeners si bindNavbar est rappelé
      btn.replaceWith(btn.cloneNode(true));
    });
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

    function indicator() { return document.getElementById('ptr-indicator'); }
    function activePanel() { return document.querySelector('.tab-content.active'); }

    document.addEventListener('touchstart', e => {
      const panel = activePanel();
      if (!panel) return;
      startTop = panel.scrollTop;
      startY   = e.touches[0].clientY;
      active   = true;
    }, { passive: true });

    document.addEventListener('touchmove', e => {
      if (!active || startTop > 4) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 12) indicator()?.classList.add('visible');
    }, { passive: true });

    document.addEventListener('touchend', e => {
      if (!active) return;
      active = false;
      const ind = indicator();
      if (!ind || !ind.classList.contains('visible')) return;
      ind.classList.remove('visible');
      const dy = e.changedTouches[0].clientY - startY;
      if (dy >= THRESHOLD) {
        document.dispatchEvent(new CustomEvent('tabchange', { detail: { tab: AppState.currentTab } }));
      }
    }, { passive: true });
  }

  /* ------------------------------------------
     DATE ACCUEIL
     ------------------------------------------ */
  function renderHomeDate() {
    const el = document.getElementById('home-date');
    if (!el) return;
    const now  = new Date();
    const str  = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
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
     THEME TOGGLE
     ------------------------------------------ */
  function applyTheme(theme) {
    const root = document.documentElement;
    // Light = default (no attribute), dark = explicit data-theme="dark"
    if (theme === 'dark') {
      root.dataset.theme = 'dark';
    } else {
      delete root.dataset.theme;
    }
    const metaTheme = document.getElementById('meta-theme-color');
    if (metaTheme) {
      metaTheme.content = theme === 'dark' ? '#0e0e0c' : '#F0EDE6';
    }
    const icon = document.getElementById('theme-icon');
    if (icon) icon.textContent = theme === 'dark' ? '☀' : '☾';
  }

  function initTheme() {
    const saved = localStorage.getItem('elev-theme');
    applyTheme(saved || 'light');
  }

  function bindThemeToggle() {
    const btn = document.getElementById('btn-theme-toggle');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
      const next = current === 'dark' ? 'light' : 'dark';
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
    bindAuthForm();
    bindSignOut();
    bindThemeToggle();
    document.addEventListener('profileavatarchange', updateProfileButtonAvatar);
    initAuth();
  }

  document.addEventListener('DOMContentLoaded', init);

  return { navigateTo, showToast };

})();
