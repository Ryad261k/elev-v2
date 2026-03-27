/* ============================================
   APP.JS — Router SPA, navigation tabs, état global
   Élev v2
   ============================================ */

window.AppState = {
  user: null,
  currentTab: 'home',
  // Déclenche un changement de tab depuis n'importe quel module
  switchTab(tab) {
    App.navigateTo(tab);
  }
};

const App = (() => {
  // Tabs valides et leurs IDs HTML
  const TABS = ['home', 'workouts', 'routines', 'nutrition', 'history'];

  /* --- Navigation --- */
  function navigateTo(tab) {
    if (!TABS.includes(tab)) return;
    if (tab === AppState.currentTab) return;

    // Désactiver l'onglet actuel
    const prevPanel = document.getElementById(`tab-${AppState.currentTab}`);
    const prevBtn   = document.querySelector(`.nav-tab[data-tab="${AppState.currentTab}"]`);
    if (prevPanel) prevPanel.classList.remove('active');
    if (prevBtn)   { prevBtn.classList.remove('active'); prevBtn.setAttribute('aria-selected', 'false'); }

    // Activer le nouvel onglet
    const nextPanel = document.getElementById(`tab-${tab}`);
    const nextBtn   = document.querySelector(`.nav-tab[data-tab="${tab}"]`);
    if (nextPanel) { nextPanel.classList.add('active'); nextPanel.classList.add('tab-enter'); }
    if (nextBtn)   { nextBtn.classList.add('active');   nextBtn.setAttribute('aria-selected', 'true'); }

    // Retirer la classe d'animation après qu'elle s'est jouée
    if (nextPanel) {
      nextPanel.addEventListener('animationend', () => {
        nextPanel.classList.remove('tab-enter');
      }, { once: true });
    }

    AppState.currentTab = tab;

    // Notifier le module concerné
    const event = new CustomEvent('tabchange', { detail: { tab } });
    document.dispatchEvent(event);
  }

  /* --- Navbar click --- */
  function bindNavbar() {
    document.querySelectorAll('.nav-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        if (tab) navigateTo(tab);
      });
    });
  }

  /* --- Date d'accueil --- */
  function renderHomeDate() {
    const el = document.getElementById('home-date');
    if (!el) return;
    const now = new Date();
    const opts = { weekday: 'long', day: 'numeric', month: 'long' };
    const str = now.toLocaleDateString('fr-FR', opts);
    // Capitalise la première lettre
    el.textContent = str.charAt(0).toUpperCase() + str.slice(1);
  }

  /* --- Toast system --- */
  function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span>${message}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-exit');
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }, duration);
  }

  /* --- Init --- */
  function init() {
    bindNavbar();
    renderHomeDate();

    // Exposer l'API toast globalement
    window.showToast = showToast;

    console.log('[Élev v2] App initialisée');
  }

  document.addEventListener('DOMContentLoaded', init);

  return { navigateTo, showToast };
})();
