/* ============================================
   ROUTINES.JS — Lister, créer, éditer, supprimer
   Élev v2
   ============================================ */

window.Routines = (() => {

  // Brouillon d'édition en mémoire
  let draft = null;       // { id|null, name, exercises: [{exercise_id,name,muscle_group,sets,reps,weight}] }
  let allExercises = [];  // cache bibliothèque

  /* ---- Requêtes DB ---- */
  async function fetchRoutines() {
    const { data, error } = await DB.from('routines')
      .select('id, name, routine_exercises(id)')
      .eq('user_id', DB.userId())
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function fetchRoutineDetail(id) {
    const { data, error } = await DB.from('routine_exercises')
      .select('id, sets, reps, weight, order_index, exercise:exercises(id, name, muscle_group)')
      .eq('routine_id', id)
      .order('order_index');
    if (error) throw error;
    return data || [];
  }

  async function fetchExerciseLibrary() {
    if (allExercises.length) return allExercises;
    const { data } = await DB.from('exercises')
      .select('id, name, muscle_group').order('name');
    allExercises = data || [];
    return allExercises;
  }

  async function saveRoutine() {
    const name = draft.name.trim();
    if (!name) { showToast('Donne un nom à la routine', 'error'); return false; }

    try {
      let routineId = draft.id;
      if (routineId) {
        await DB.from('routines').update({ name }).eq('id', routineId);
      } else {
        const { data, error } = await DB.from('routines')
          .insert({ user_id: DB.userId(), name })
          .select().single();
        if (error) throw error;
        routineId = data.id;
      }
      // Remplace tous les exercices (approche simple et sans diff)
      await DB.from('routine_exercises').delete().eq('routine_id', routineId);
      if (draft.exercises.length) {
        const rows = draft.exercises.map((ex, i) => ({
          routine_id: routineId, exercise_id: ex.exercise_id,
          order_index: i, sets: ex.sets, reps: ex.reps, weight: ex.weight,
        }));
        const { error } = await DB.from('routine_exercises').insert(rows);
        if (error) throw error;
      }
      showToast(draft.id ? 'Routine mise à jour' : 'Routine créée', 'success');
      return true;
    } catch (err) {
      console.error('[Routines] saveRoutine:', err);
      showToast('Erreur lors de la sauvegarde', 'error');
      return false;
    }
  }

  async function deleteRoutine(id) {
    try {
      await DB.from('routine_exercises').delete().eq('routine_id', id);
      await DB.from('routines').delete().eq('id', id);
      showToast('Routine supprimée', 'info');
    } catch (err) {
      console.error('[Routines] deleteRoutine:', err);
      showToast('Erreur lors de la suppression', 'error');
    }
  }

  async function duplicateRoutine(id) {
    try {
      const { data: orig } = await DB.from('routines').select('name').eq('id', id).single();
      const { data: newR } = await DB.from('routines')
        .insert({ user_id: DB.userId(), name: orig.name + ' (copie)' })
        .select().single();
      const exs = await fetchRoutineDetail(id);
      if (exs.length) {
        await DB.from('routine_exercises').insert(
          exs.map((e, i) => ({
            routine_id: newR.id, exercise_id: e.exercise.id,
            order_index: i, sets: e.sets, reps: e.reps, weight: e.weight,
          }))
        );
      }
      showToast('Routine dupliquée ✓', 'success');
      renderList();
    } catch { showToast('Erreur lors de la duplication', 'error'); }
  }

  /* ---- Vue liste ---- */
  async function renderList() {
    const cnt = document.getElementById('routines-content');
    const fab = document.getElementById('fab-routine');
    cnt.innerHTML = '<div class="workout-spinner"><div class="spinner spinner-lg"></div></div>';
    if (fab) fab.style.display = 'flex';

    try {
      const routines = await fetchRoutines();

      if (!routines.length) {
        cnt.innerHTML = `
          <div class="empty-state" style="margin-top:48px;">
            <span class="empty-state-icon">📋</span>
            <p class="empty-state-title">Aucune routine</p>
            <p class="empty-state-text">Crée ta première routine d'entraînement</p>
            <button class="btn btn-primary btn-lg" style="margin-top:16px;" id="btn-new-routine-empty">
              Créer une routine
            </button>
          </div>`;
        document.getElementById('btn-new-routine-empty')?.addEventListener('click', () => openEditor(null));
        return;
      }

      cnt.innerHTML = `
        <div class="section-header" style="margin-bottom:12px;">
          <h2 class="section-title">Mes routines</h2>
          <span class="badge badge-surface">${routines.length}</span>
        </div>
        ${routines.map(r => `
          <div class="routine-card card pressable" data-rid="${r.id}">
            <div class="flex items-center justify-between">
              <div class="list-item-content">
                <p class="list-item-title">${r.name}</p>
                <p class="list-item-subtitle">${r.routine_exercises.length} exercice${r.routine_exercises.length !== 1 ? 's' : ''}</p>
              </div>
              <div class="flex gap-8">
                <button class="btn btn-icon" data-edit="${r.id}" aria-label="Modifier">✏️</button>
                <button class="btn btn-icon" data-duplicate="${r.id}" aria-label="Dupliquer">⧉</button>
                <button class="btn btn-icon" data-delete="${r.id}" aria-label="Supprimer">🗑</button>
              </div>
            </div>
          </div>`).join('')}`;

      cnt.addEventListener('click', async e => {
        const editBtn      = e.target.closest('[data-edit]');
        const deleteBtn    = e.target.closest('[data-delete]');
        const duplicateBtn = e.target.closest('[data-duplicate]');
        const card         = e.target.closest('.routine-card');
        if (deleteBtn)    { e.stopPropagation(); confirmDelete(deleteBtn.dataset.delete); return; }
        if (duplicateBtn) { e.stopPropagation(); duplicateRoutine(duplicateBtn.dataset.duplicate); return; }
        if (editBtn)      { e.stopPropagation(); openEditor(editBtn.dataset.edit); return; }
        if (card)         { openEditor(card.dataset.rid); }
      });

    } catch (err) {
      console.error('[Routines] renderList:', err);
      cnt.innerHTML = '<p class="text-dim" style="padding:24px;">Erreur de chargement</p>';
    }
  }

  function confirmDelete(id) {
    showConfirm('Supprimer cette routine ? Cette action est irréversible.', () => {
      deleteRoutine(id).then(() => renderList());
    }, { title: 'Supprimer la routine', danger: true, confirmLabel: 'Supprimer' });
  }

  /* ---- Éditeur de routine ---- */
  async function openEditor(routineId) {
    const fab = document.getElementById('fab-routine');
    if (fab) fab.style.display = 'none';

    if (routineId) {
      const rows = await fetchRoutineDetail(routineId);
      const { data } = await DB.from('routines').select('name').eq('id', routineId).single();
      draft = {
        id: routineId, name: data?.name || '',
        exercises: rows.map(r => ({
          exercise_id: r.exercise.id, name: r.exercise.name,
          muscle_group: r.exercise.muscle_group || '',
          sets: r.sets, reps: r.reps, weight: r.weight,
        })),
      };
    } else {
      draft = { id: null, name: '', exercises: [] };
    }
    renderEditor();
  }

  function renderEditor() {
    const cnt = document.getElementById('routines-content');
    cnt.innerHTML = `
      <div class="editor-header flex items-center justify-between" style="margin-bottom:20px;">
        <button class="btn btn-ghost btn-sm" id="btn-editor-cancel">‹ Retour</button>
        <button class="btn btn-primary btn-sm" id="btn-editor-save">Enregistrer</button>
      </div>
      <div class="form-group" style="margin-bottom:20px;">
        <label for="routine-name">Nom de la routine</label>
        <input type="text" id="routine-name" class="input" placeholder="ex: Push A, Full Body…"
               value="${draft.name}" maxlength="60">
      </div>
      <div class="section-header" style="margin-bottom:8px;">
        <h3 class="section-title" style="font-size:1rem;">Exercices</h3>
        <button class="btn btn-primary btn-sm" id="btn-add-exercise">+ Ajouter</button>
      </div>
      <div id="editor-exercises"></div>
      ${!draft.exercises.length ? `<p class="text-dim" style="font-size:0.875rem;padding:16px 0;">Aucun exercice — clique sur + Ajouter</p>` : ''}`;

    renderEditorExercises();

    document.getElementById('routine-name')?.addEventListener('input', e => { draft.name = e.target.value; });
    document.getElementById('btn-editor-cancel')?.addEventListener('click', () => { draft = null; renderList(); });
    document.getElementById('btn-editor-save')?.addEventListener('click', async () => {
      const ok = await saveRoutine();
      if (ok) { draft = null; renderList(); }
    });
    document.getElementById('btn-add-exercise')?.addEventListener('click', openExercisePicker);
  }

  function renderEditorExercises() {
    const list = document.getElementById('editor-exercises');
    if (!list) return;
    if (!draft.exercises.length) { list.innerHTML = ''; return; }

    list.innerHTML = draft.exercises.map((ex, i) => `
      <div class="editor-ex-row card" data-idx="${i}">
        <div class="flex items-center justify-between" style="margin-bottom:10px;">
          <div style="flex:1;min-width:0;">
            <p class="list-item-title" style="font-size:0.9375rem;">${ex.name}</p>
            <p class="list-item-subtitle">${ex.muscle_group}</p>
          </div>
          <div class="flex gap-4">
            <button class="btn btn-icon" data-up="${i}"   aria-label="Monter"    ${i === 0 ? 'disabled' : ''}>↑</button>
            <button class="btn btn-icon" data-down="${i}" aria-label="Descendre" ${i === draft.exercises.length - 1 ? 'disabled' : ''}>↓</button>
            <button class="btn btn-icon" data-remove="${i}" aria-label="Retirer" style="color:#c0392b;">✕</button>
          </div>
        </div>
        <div class="input-row">
          <div class="form-group">
            <label>Séries</label>
            <input type="number" class="input" data-field="sets" data-idx="${i}"
                   value="${ex.sets}" min="1" max="20" inputmode="numeric">
          </div>
          <div class="form-group">
            <label>Répétitions</label>
            <input type="number" class="input" data-field="reps" data-idx="${i}"
                   value="${ex.reps}" min="1" max="99" inputmode="numeric">
          </div>
          <div class="form-group">
            <label>Poids (kg)</label>
            <input type="number" class="input" data-field="weight" data-idx="${i}"
                   value="${ex.weight}" min="0" step="0.5" inputmode="decimal">
          </div>
        </div>
      </div>`).join('');

    // Délégation d'événements sur la liste
    list.addEventListener('click', e => {
      const up     = e.target.closest('[data-up]');
      const down   = e.target.closest('[data-down]');
      const remove = e.target.closest('[data-remove]');
      if (up)     { moveExercise(parseInt(up.dataset.up), -1); }
      if (down)   { moveExercise(parseInt(down.dataset.down), 1); }
      if (remove) { draft.exercises.splice(parseInt(remove.dataset.remove), 1); renderEditorExercises(); }
    });
    list.addEventListener('input', e => {
      const field = e.target.dataset.field;
      const idx   = parseInt(e.target.dataset.idx);
      if (!field || isNaN(idx)) return;
      draft.exercises[idx][field] = parseFloat(e.target.value) || 0;
    });
  }

  function moveExercise(idx, dir) {
    const target = idx + dir;
    if (target < 0 || target >= draft.exercises.length) return;
    [draft.exercises[idx], draft.exercises[target]] = [draft.exercises[target], draft.exercises[idx]];
    renderEditorExercises();
  }

  /* ---- Modal sélection exercice ---- */
  async function openExercisePicker() {
    let modal = document.getElementById('modal-exercise-picker');
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'modal-backdrop'; modal.id = 'modal-exercise-picker';
      modal.innerHTML = `
        <div class="modal" style="max-height:85dvh;">
          <div class="modal-handle"></div>
          <div class="modal-header">
            <p class="modal-title">Bibliothèque</p>
            <button class="btn btn-icon" id="close-picker">✕</button>
          </div>
          <div style="padding:12px 20px 8px;">
            <input type="search" id="exercise-search" class="input" placeholder="Rechercher un exercice…" autocomplete="off">
          </div>
          <div id="exercise-list-modal" style="overflow-y:auto;padding:0 12px 20px;max-height:55dvh;"></div>
        </div>`;
      document.body.appendChild(modal);
      modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });
      document.getElementById('close-picker')?.addEventListener('click', () => modal.classList.remove('open'));
      document.getElementById('exercise-search')?.addEventListener('input', e => renderPickerList(e.target.value));
    }
    setTimeout(() => modal.classList.add('open'), 10);

    const listEl = document.getElementById('exercise-list-modal');
    listEl.innerHTML = '<div class="workout-spinner"><div class="spinner"></div></div>';
    await fetchExerciseLibrary();
    renderPickerList('');
  }

  function renderPickerList(query) {
    const listEl = document.getElementById('exercise-list-modal');
    if (!listEl) return;
    const q = query.trim().toLowerCase();
    const filtered = q
      ? allExercises.filter(ex => ex.name.toLowerCase().includes(q) || (ex.muscle_group || '').toLowerCase().includes(q))
      : allExercises;

    if (!filtered.length) {
      listEl.innerHTML = `<p class="text-dim" style="padding:20px;text-align:center;">Aucun résultat pour "${query}"</p>`;
      return;
    }

    listEl.innerHTML = filtered.map(ex => `
      <div class="list-item pressable" style="margin-bottom:6px;" data-pick-id="${ex.id}" data-pick-name="${ex.name}" data-pick-group="${ex.muscle_group || ''}">
        <div class="list-item-content">
          <p class="list-item-title">${ex.name}</p>
          ${ex.muscle_group ? `<p class="list-item-subtitle">${ex.muscle_group}</p>` : ''}
        </div>
        <span class="list-item-right">+</span>
      </div>`).join('');

    listEl.addEventListener('click', e => {
      const row = e.target.closest('[data-pick-id]');
      if (!row) return;
      draft.exercises.push({
        exercise_id: row.dataset.pickId, name: row.dataset.pickName,
        muscle_group: row.dataset.pickGroup, sets: 3, reps: 10, weight: 0,
      });
      document.getElementById('modal-exercise-picker')?.classList.remove('open');
      renderEditorExercises();
      // Retirer le "Aucun exercice" placeholder si présent
      const empty = document.querySelector('#routines-content > p.text-dim');
      if (empty) empty.remove();
    }, { once: true });
  }

  /* ---- FAB ---- */
  function bindFab() {
    const fab = document.getElementById('fab-routine');
    if (!fab) return;
    fab.style.display = 'flex';
    fab.replaceWith(fab.cloneNode(true)); // retire les anciens listeners
    document.getElementById('fab-routine')?.addEventListener('click', () => openEditor(null));
  }

  /* ---- Init ---- */
  async function init() {
    bindFab();
    await renderList();
  }

  document.addEventListener('tabchange', e => { if (e.detail.tab === 'routines') init(); });

  return { init };

})();
