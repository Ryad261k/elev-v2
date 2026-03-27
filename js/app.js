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

  const TABS = ['home', 'workouts', 'routines', 'nutrition', 'history'];

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

    // Écoute les changements d'état (connexion via magic link, déconnexion)
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
     FORM MAGIC LINK
     ------------------------------------------ */
  function bindAuthForm() {
    const form    = document.getElementById('auth-form');
    const input   = document.getElementById('auth-email');
    const btn     = document.getElementById('auth-submit');
    const confirm = document.getElementById('auth-confirm');

    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = input.value.trim();
      if (!email) return;

      btn.disabled    = true;
      btn.textContent = 'Envoi…';

      try {
        await Auth.sendMagicLink(email);
        form.style.display = 'none';
        confirm.classList.add('is-visible');
        // Affiche l'email dans le message de confirmation
        const emailSpan = document.getElementById('auth-confirm-email');
        if (emailSpan) emailSpan.textContent = email;
      } catch (err) {
        console.error('[Auth] Erreur magic link:', err);
        showToast('Erreur lors de l\'envoi. Réessaie.', 'error');
        btn.disabled    = false;
        btn.textContent = 'Recevoir le lien';
      }
    });

    // Bouton "changer d'email" dans l'écran de confirmation
    const backBtn = document.getElementById('auth-back');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        form.style.display = '';
        confirm.classList.remove('is-visible');
        btn.disabled   = false;
        btn.textContent = 'Recevoir le lien';
      });
    }
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
     INIT
     ------------------------------------------ */
  function init() {
    window.showToast = showToast;
    bindAuthForm();
    bindSignOut();
    initAuth();
  }

  document.addEventListener('DOMContentLoaded', init);

  return { navigateTo, showToast };

})();
