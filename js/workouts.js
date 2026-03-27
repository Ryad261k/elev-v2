/* ============================================
   WORKOUTS.JS — Module workouts
   Élev v2
   ============================================ */

window.Workouts = (() => {

  function init() {
    // TODO
  }

  document.addEventListener('tabchange', (e) => {
    if (e.detail.tab === 'workouts') init();
  });

  return { init };
})();
