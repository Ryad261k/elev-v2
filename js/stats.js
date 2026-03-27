/* ============================================
   STATS.JS — Module stats
   Élev v2
   ============================================ */

window.Stats = (() => {

  function init() {
    // TODO
  }

  document.addEventListener('tabchange', (e) => {
    if (e.detail.tab === 'stats') init();
  });

  return { init };
})();
