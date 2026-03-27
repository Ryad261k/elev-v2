/* ============================================
   APP.JS — Router SPA, AppState, auth flow
   Élev v2
   ============================================ */

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
const App = (() => {

  const TABS = ['home', 'workouts', 'routines', 'nutrition', 'weight', 'history'];

  /* ------------------------------------------
     ÉCRANS — loader / auth / app
     ------------------------------------------ */
  function showScreen(screen) {
    // Utilise style.display (inline) pour battre la spécificité des règles ID en CSS
    document.getElementById('loader-screen').style.display = screen === 'loader' ? 'flex' : 'none';
    document.getElementById('auth-screen').style.display   = screen === 'auth'   ? 'flex' : 'none';
    document.getElementById('app').style.display           = screen === 'app'    ? 'flex' : 'none';
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
    updateGreeting();
    showScreen('app');
    bindNavbar();
    renderHomeDate();
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

  /* ------------------------------------------
     GREETING UTILISATEUR
     ------------------------------------------ */
  function updateGreeting() {
    const el = document.getElementById('home-greeting');
    if (!el || !AppState.user) return;
    // Tente d'extraire un prénom depuis l'email
    const email      = AppState.user.email || '';
    const localPart  = email.split('@')[0];                        // "louis.david650"
    const firstName  = localPart.split(/[._]/)[0];                 // "louis"
    const name       = firstName.charAt(0).toUpperCase() + firstName.slice(1);
    el.textContent   = `Bonjour, ${name}`;
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
        const msg = translateAuthError(err.message);
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

  /** Traduit les messages d'erreur Supabase en français */
  function translateAuthError(msg) {
    if (!msg) return 'Une erreur est survenue.';
    const m = msg.toLowerCase();
    if (m.includes('invalid login') || m.includes('invalid credentials'))
      return 'Email ou mot de passe incorrect.';
    if (m.includes('email not confirmed'))
      return 'Confirme ton adresse email avant de te connecter.';
    if (m.includes('user already registered') || m.includes('already been registered'))
      return 'Un compte existe déjà avec cet email.';
    if (m.includes('password'))
      return 'Le mot de passe doit faire au moins 6 caractères.';
    if (m.includes('rate limit'))
      return 'Trop de tentatives. Réessaie dans quelques minutes.';
    return 'Erreur : ' + msg;
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

    const prevPanel = document.getElementById(`tab-${AppState.currentTab}`);
    const prevBtn   = document.querySelector(`.nav-tab[data-tab="${AppState.currentTab}"]`);
    if (prevPanel) prevPanel.classList.remove('active');
    if (prevBtn)   { prevBtn.classList.remove('active'); prevBtn.setAttribute('aria-selected', 'false'); }

    const nextPanel = document.getElementById(`tab-${tab}`);
    const nextBtn   = document.querySelector(`.nav-tab[data-tab="${tab}"]`);
    if (nextPanel) { nextPanel.classList.add('active'); nextPanel.classList.add('tab-enter'); }
    if (nextBtn)   { nextBtn.classList.add('active');   nextBtn.setAttribute('aria-selected', 'true'); }

    if (nextPanel) {
      nextPanel.addEventListener('animationend', () => nextPanel.classList.remove('tab-enter'), { once: true });
    }

    AppState.currentTab = tab;
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
    if (theme === 'dark') {
      root.dataset.theme = 'dark';
    } else {
      root.dataset.theme = 'light';
    }
    // Update meta theme-color for browser chrome
    const metaTheme = document.getElementById('meta-theme-color');
    if (metaTheme) {
      metaTheme.content = theme === 'dark' ? '#1a1a18' : '#F0EDE6';
    }
    // Update icon
    const icon = document.getElementById('theme-icon');
    if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  function initTheme() {
    const saved = localStorage.getItem('elev-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');
    applyTheme(theme);
  }

  function bindThemeToggle() {
    const btn = document.getElementById('btn-theme-toggle');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const current = document.documentElement.dataset.theme || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      localStorage.setItem('elev-theme', next);
      if (navigator.vibrate) navigator.vibrate(6);
    });
  }

  /* ------------------------------------------
     INIT
     ------------------------------------------ */
  function init() {
    window.showToast = showToast;
    initTheme();
    bindAuthForm();
    bindSignOut();
    bindThemeToggle();
    initAuth();
  }

  document.addEventListener('DOMContentLoaded', init);

  return { navigateTo, showToast };

})();
