/* ============================================
   HISTORY.JS — Module history
   Élev v2
   ============================================ */

window.History = (() => {

  function init() {
    // TODO
  }

  document.addEventListener('tabchange', (e) => {
    if (e.detail.tab === 'history') init();
  });

  return { init };
})();
