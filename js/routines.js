/* ============================================
   ROUTINES.JS — Module routines
   Élev v2
   ============================================ */

window.Routines = (() => {

  function init() {
    // TODO
  }

  document.addEventListener('tabchange', (e) => {
    if (e.detail.tab === 'routines') init();
  });

  return { init };
})();
