/* ============================================
   NUTRITION.JS — Module nutrition
   Élev v2
   ============================================ */

window.Nutrition = (() => {

  function init() {
    // TODO
  }

  document.addEventListener('tabchange', (e) => {
    if (e.detail.tab === 'nutrition') init();
  });

  return { init };
})();
