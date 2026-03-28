/* ============================================
   ROUTINES.JS — Liste des routines, init, nav
   Élev v2
   ============================================ */

window.Routines = (() => {

  const RD = () => window.RoutinesData;

  /* ---- Vue liste ---- */
  async function renderList() {
    const cnt = document.getElementById('routines-content');
    const fab = document.getElementById('fab-routine');
    cnt.innerHTML = '<div class="workout-spinner"><div class="spinner spinner-lg"></div></div>';
    if (fab) fab.style.display = 'flex';

    try {
      const routines = await RD().fetchRoutines();

      if (!routines.length) {
        cnt.innerHTML = `
          <div style="display:flex;align-items:flex-end;justify-content:space-between;padding-top:52px;margin-bottom:20px;">
            <div>
              <p style="font-size:0.6875rem;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:var(--accent);margin-bottom:6px;">Mes programmes</p>
              <h1 style="font-family:var(--font-serif);font-style:italic;font-size:2rem;color:var(--cream);line-height:1.1;">Séances</h1>
            </div>
            <button class="btn-start-pill" id="btn-new-routine-empty">＋ Nouvelle</button>
          </div>
          <div class="empty-state" style="margin-top:48px;">
            <span class="empty-state-icon">📋</span>
            <p class="empty-state-title">Aucune séance</p>
            <p class="empty-state-text">Crée ta première séance d'entraînement</p>
          </div>`;
        document.getElementById('btn-new-routine-empty')?.addEventListener('click', () => window.RoutinesEditor.openEditor(null));
        return;
      }

      const ROUTINE_ICONS       = ['🔥','💪','🦵','🏋️','🎯','⚡','🌊','🏃'];
      const METHOD_BADGE_LABELS = { amrap:'🔁 AMRAP', dropset:'📉 DROP', superset:'⚡ SUPER', restpause:'⏱ RP', tempo:'🎵 TEMPO', htfr:'🏋 HTFR', giantset:'🔥 GIANT' };

      const headerHtml = `
        <div style="display:flex;align-items:flex-end;justify-content:space-between;padding-top:52px;margin-bottom:20px;">
          <div>
            <p style="font-size:0.6875rem;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:var(--accent);margin-bottom:6px;">Mes programmes</p>
            <h1 style="font-family:var(--font-serif);font-style:italic;font-size:2rem;color:var(--cream);line-height:1.1;">Séances</h1>
          </div>
          <button class="btn-start-pill" id="btn-new-routine-header">＋ Nouvelle</button>
        </div>
        <div class="days-filter">
          <div class="day-chip active">Tous</div>
          <div class="day-chip">Lundi</div><div class="day-chip">Mardi</div><div class="day-chip">Mercredi</div>
          <div class="day-chip">Jeudi</div><div class="day-chip">Vendredi</div><div class="day-chip">Weekend</div>
        </div>
        <p class="home-section-label" style="margin-top:24px;">Programmes actifs</p>`;

      const routineCards = routines.map((r, idx) => {
        const methods       = RD().loadMethods(r.id);
        const meta          = RD().loadMeta(r.id);
        const activeMethods = Object.values(methods).filter(m => m !== 'normal');
        const uniqueMethods = [...new Set(activeMethods)];
        const badgesHTML    = uniqueMethods.map(m => `<span class="method-badge method-${m}">${METHOD_BADGE_LABELS[m] || m}</span>`).join('');
        const exCount       = r.routine_exercises.length;
        const icon          = ROUTINE_ICONS[idx % ROUTINE_ICONS.length];
        const isFeatured    = idx === 0;

        return `
          <div class="routine-card-v2${isFeatured ? ' featured' : ''}" data-rid="${r.id}" style="animation-delay:${0.1 + idx * 0.07}s">
            <div class="routine-top">
              <div class="routine-icon">${icon}</div>
              <div class="routine-info">
                <div class="routine-name-v2">${r.name}</div>
                <div class="routine-meta-row">
                  <span>${exCount} exercice${exCount !== 1 ? 's' : ''}</span>
                  <div class="meta-dot"></div><span>${meta.daysPerWeek} j/sem</span>
                  <div class="meta-dot"></div><span>${meta.objective}</span>
                  ${badgesHTML ? `<div class="meta-dot"></div><span style="display:flex;gap:4px;">${badgesHTML}</span>` : ''}
                </div>
              </div>
              <div class="routine-actions">
                <button class="btn btn-icon" data-edit="${r.id}"  aria-label="Modifier" style="width:30px;height:30px;font-size:0.8125rem;">✏️</button>
                <button class="btn btn-icon" data-more="${r.id}"  aria-label="Plus"     style="width:30px;height:30px;font-size:0.8125rem;">⋯</button>
              </div>
            </div>
            <div class="routine-bottom">
              <div class="routine-last-done">📅 <span>—</span></div>
              <button class="btn-start-pill" data-start="${r.id}" style="padding:7px 14px;font-size:0.75rem;">▶ Démarrer</button>
            </div>
          </div>`;
      }).join('');

      const ctaHtml = `
        <div class="new-routine-cta" id="btn-new-routine-cta">
          <div class="new-routine-icon">＋</div>
          <div style="font-size:0.875rem;font-weight:600;color:var(--cream);">Créer une séance</div>
          <div style="font-size:0.75rem;color:var(--cream-dim);">Ajoute un nouveau programme</div>
        </div>`;

      cnt.innerHTML = headerHtml + routineCards + ctaHtml;

      cnt.addEventListener('click', async e => {
        const editBtn  = e.target.closest('[data-edit]');
        const moreBtn  = e.target.closest('[data-more]');
        const startBtn = e.target.closest('[data-start]');
        const card     = e.target.closest('.routine-card-v2');
        if (editBtn)  { e.stopPropagation(); window.RoutinesEditor.openEditor(editBtn.dataset.edit); return; }
        if (moreBtn)  { e.stopPropagation(); showRoutineMoreMenu(moreBtn.dataset.more); return; }
        if (startBtn) { e.stopPropagation(); startRoutine(startBtn.dataset.start); return; }
        if (card && !e.target.closest('button')) { window.RoutinesEditor.openEditor(card.dataset.rid); }
      });

      document.getElementById('btn-new-routine-header')?.addEventListener('click', () => window.RoutinesEditor.openEditor(null));
      document.getElementById('btn-new-routine-cta')?.addEventListener('click',    () => window.RoutinesEditor.openEditor(null));
    } catch (err) {
      console.error('[Routines] renderList:', err);
      cnt.innerHTML = '<p class="text-dim" style="padding:24px;">Erreur de chargement</p>';
    }
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
    });
    setTimeout(() => {
      const cancelBtn = document.querySelector('.confirm-cancel');
      if (cancelBtn) {
        const clone = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(clone, cancelBtn);
        clone.addEventListener('click', () => {
          document.querySelector('.confirm-overlay')?.remove();
          duplicateRoutine(id);
        });
      }
    }, 50);
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
