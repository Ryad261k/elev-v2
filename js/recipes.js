/* ============================================
   RECIPES.JS — Module recipes
   Élev v2
   ============================================ */

window.Recipes = (() => {

  function init() {
    // TODO
  }

  document.addEventListener('tabchange', (e) => {
    if (e.detail.tab === 'recipes') init();
  });

  return { init };
})();
