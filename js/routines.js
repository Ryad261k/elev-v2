/* ============================================
   ROUTINES.JS — Liste des routines, init, nav
   Élev v2
   ============================================ */

window.Routines = (() => {

  const RD = () => window.RoutinesData;

  // Colored circles per routine (cycles)
  const ICON_COLORS = ['#E8547A','#5B9BF5','#F5A623','#C084FC','#4ADE80','#C8622E','#34D399','#F87171'];
  const ICON_SHAPES = ['▲','●','●','●','◆','●','●','▲'];

  function formatLastDone(dateStr) {
    if (!dateStr) return 'Jamais effectuée';
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
    if (diff === 0) return "Aujourd'hui";
    if (diff === 1) return 'Hier';
    return `Il y a ${diff}j`;
  }

  const FILTERS = [
    { label: 'Tous',          test: () => true },
    { label: 'Push / Pull',   test: r => /push|pull/i.test(r.name) },
    { label: 'Upper / Lower', test: r => /upper|lower/i.test(r.name) },
    { label: 'Full Body',     test: r => /full/i.test(r.name) },
  ];
  let activeFilter = 0;

  /* ---- Vue liste ---- */
  async function renderList() {
    const cnt = document.getElementById('routines-content');
    cnt.innerHTML = '<div class="workout-spinner"><div class="spinner spinner-lg"></div></div>';

    try {
      const routines = await RD().fetchRoutines();

      // Fetch last session per routine
      let lastSessions = {};
      try {
        const { data: sessions } = await DB.from('sessions')
          .select('routine_id, started_at')
          .eq('user_id', DB.userId())
          .not('ended_at', 'is', null)
          .order('started_at', { ascending: false });
        (sessions || []).forEach(s => {
          if (s.routine_id && !lastSessions[s.routine_id]) lastSessions[s.routine_id] = s.started_at;
        });
      } catch {}

      const renderCards = (filter) => {
        const visible = routines.filter(filter.test);
        if (!visible.length && !routines.length) return `
          <div class="empty-state" style="margin-top:48px;">
            <span class="empty-state-icon">📋</span>
            <p class="empty-state-title">Aucune routine</p>
            <p class="empty-state-text">Crée ta première routine d'entraînement</p>
          </div>`;
        if (!visible.length) return `
          <div class="empty-state" style="margin-top:32px;">
            <p class="empty-state-text" style="font-size:0.875rem;">Aucune routine dans cette catégorie</p>
          </div>`;
        return visible.map((r, idx) => {
          const realIdx  = routines.indexOf(r);
          const exCount  = r.routine_exercises.length;
          const duration = Math.round(exCount * 9 / 5) * 5 || 0;
          const muscles  = [...new Set((r.routine_exercises || [])
            .map(re => re.exercise?.muscle_group).filter(Boolean))].slice(0, 3);
          const muscleChips = muscles.map(m =>
            `<span class="routine-muscle-chip">${m.toUpperCase()}</span>`).join('');
          const lastDone = formatLastDone(lastSessions[r.id]);
          const color    = ICON_COLORS[realIdx % ICON_COLORS.length];
          const shape    = ICON_SHAPES[realIdx % ICON_SHAPES.length];
          return `
            <div class="routine-card-v3" data-rid="${r.id}">
              <div class="routine-v3-icon" style="background:${color}22;color:${color};">${shape}</div>
              <div class="routine-v3-body">
                <div class="routine-v3-name">${r.name}</div>
                ${muscleChips ? `<div class="routine-v3-chips">${muscleChips}</div>` : ''}
                <div class="routine-v3-meta">${exCount} exercice${exCount !== 1 ? 's' : ''} · ~${duration} min · ${lastDone}</div>
              </div>
              <span class="routine-v3-arrow">›</span>
            </div>`;
        }).join('');
      };

      const filtersHtml = FILTERS.map((f, i) =>
        `<button class="routine-filter-chip${i === activeFilter ? ' active' : ''}" data-fi="${i}">${f.label}</button>`
      ).join('');

      cnt.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;padding-top:52px;margin-bottom:20px;">
          <h1 style="font-family:var(--font-serif);font-style:italic;font-size:2rem;color:var(--cream);line-height:1.1;">Routines</h1>
          <button class="routine-add-btn" id="btn-new-routine-header" aria-label="Créer une routine">+</button>
        </div>
        <div class="routine-filters-row">${filtersHtml}</div>
        <div id="routine-cards-container" style="margin-top:16px;">${renderCards(FILTERS[activeFilter])}</div>`;

      cnt.querySelectorAll('.routine-filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          activeFilter = parseInt(chip.dataset.fi);
          cnt.querySelectorAll('.routine-filter-chip').forEach((c, i) =>
            c.classList.toggle('active', i === activeFilter));
          document.getElementById('routine-cards-container').innerHTML = renderCards(FILTERS[activeFilter]);
          bindCardEvents();
        });
      });

      bindCardEvents();
      document.getElementById('btn-new-routine-header')?.addEventListener('click', () => window.RoutinesEditor.openEditor(null));
    } catch (err) {
      console.error('[Routines] renderList:', err);
      cnt.innerHTML = '<p class="text-dim" style="padding:24px;">Erreur de chargement</p>';
    }
  }

  function bindCardEvents() {
    const cnt = document.getElementById('routines-content');
    cnt.querySelectorAll('.routine-card-v3').forEach(card => {
      card.addEventListener('click', e => {
        if (!e.target.closest('button')) window.RoutinesEditor.openEditor(card.dataset.rid);
      });
      card.addEventListener('contextmenu', e => { e.preventDefault(); showRoutineMoreMenu(card.dataset.rid); });
    });
  }

  /* ---- Actions liste ---- */
  function confirmDelete(id) {
    showConfirm('Supprimer cette séance ? Cette action est irréversible.', () => {
      RD().deleteRoutine(id).then(() => renderList());
    }, { title: 'Supprimer la séance', danger: true, confirmLabel: 'Supprimer' });
  }

  function showRoutineMoreMenu(id) {
    showConfirm('Supprimer ou dupliquer cette séance ?', () => confirmDelete(id), {
      title: 'Options', danger: true, confirmLabel: '🗑 Supprimer', cancelLabel: '⧉ Dupliquer',
      onCancel: () => duplicateRoutine(id),
    });
  }

  async function duplicateRoutine(id) {
    try {
      const { data: orig } = await DB.from('routines').select('name').eq('id', id).single();
      const { data: newR } = await DB.from('routines').insert({ user_id: DB.userId(), name: orig.name + ' (copie)' }).select().single();
      const exs = await RD().fetchRoutineDetail(id);
      if (exs.length) {
        await DB.from('routine_exercises').insert(
          exs.map((e, i) => ({ routine_id: newR.id, exercise_id: e.exercise.id, order_index: i, sets: e.sets, reps: e.reps, weight: e.weight }))
        );
      }
      const srcMethods = RD().loadMethods(id);
      if (Object.keys(srcMethods).length) RD().saveMethods(newR.id, srcMethods);
      RD().saveMeta(newR.id, RD().loadMeta(id));
      showToast('Séance dupliquée ✓', 'success');
      renderList();
    } catch { showToast('Erreur lors de la duplication', 'error'); }
  }

  function startRoutine(id) {
    if (window.AppState) window.AppState.switchTab('workouts');
    setTimeout(() => { window.Workouts?.startRoutine?.(id); }, 300);
  }

  /* ---- FAB ---- */
  function bindFab() {
    const fab = document.getElementById('fab-routine');
    if (!fab) return;
    fab.style.display = 'flex';
    const clone = fab.cloneNode(true);
    fab.parentNode.replaceChild(clone, fab);
    document.getElementById('fab-routine')?.addEventListener('click', () => window.RoutinesEditor.openEditor(null));
  }

  /* ---- Init ---- */
  async function init() {
    bindFab();
    await renderList();
  }

  document.addEventListener('tabchange', e => { if (e.detail.tab === 'routines') init(); });

  return { init, renderList };
})();
