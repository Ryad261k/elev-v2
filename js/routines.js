/* ============================================
   ROUTINES.JS — Lister, créer, éditer, supprimer
   Élev v2
   ============================================ */

window.Routines = (() => {

  // Brouillon d'édition en mémoire
  let draft = null;       // { id|null, name, meta, methods, exercises: [{exercise_id,name,muscle_group,sets,reps,weight}] }
  let allExercises = [];  // cache bibliothèque

  /* ---- Méthodes avancées (localStorage) ---- */
  function getMethodsKey(routineId) { return `elev-ex-methods-${routineId}`; }
  function getMetaKey(routineId)    { return `elev-routine-meta-${routineId}`; }

  function syncRoutineCloudState() {
    const methodsByRoutine = {};
    const metaByRoutine = {};
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('elev-ex-methods-')) {
          methodsByRoutine[key.replace('elev-ex-methods-', '')] = JSON.parse(localStorage.getItem(key) || '{}');
        }
        if (key.startsWith('elev-routine-meta-')) {
          metaByRoutine[key.replace('elev-routine-meta-', '')] = JSON.parse(localStorage.getItem(key) || '{}');
        }
      });
    } catch {}
    window.CloudState?.schedule({
      elev_routine_methods: methodsByRoutine,
      elev_routine_meta: metaByRoutine
    });
  }

  function loadMethods(routineId) {
    if (!routineId) return {};
    try { return JSON.parse(localStorage.getItem(getMethodsKey(routineId)) || '{}'); }
    catch { return {}; }
  }

  function saveMethods(routineId, methods) {
    if (!routineId) return;
    localStorage.setItem(getMethodsKey(routineId), JSON.stringify(methods || {}));
    syncRoutineCloudState();
  }

  function loadMeta(routineId) {
    const base = { objective: 'hypertrophie', daysPerWeek: 4, notes: '' };
    if (!routineId) return { ...base };
    try { return { ...base, ...(JSON.parse(localStorage.getItem(getMetaKey(routineId)) || '{}') || {}) }; }
    catch { return { ...base }; }
  }

  function saveMeta(routineId, meta) {
    if (!routineId) return;
    localStorage.setItem(getMetaKey(routineId), JSON.stringify(meta || {}));
    syncRoutineCloudState();
  }

  const METHOD_LABELS = {
    normal: 'Normal',
    amrap: 'AMRAP',
    dropset: 'Drop Set',
    superset: 'Superset',
    restpause: 'Rest-Pause',
    tempo: 'Tempo',
    htfr: 'HTFR',
    giantset: 'Giant Set'
  };

  const PROGRAM_TEMPLATES = [
    {
      id: 'push-pull-legs',
      label: 'PPL',
      name: 'Push / Pull / Legs',
      objective: 'hypertrophie',
      daysPerWeek: 6,
      notes: 'Split classique avec rotation push, pull et legs.',
      exercises: [
        { keyword: 'développé couché', muscle_group: 'Pectoraux', sets: 4, reps: 8, weight: 0 },
        { keyword: 'développé militaire', muscle_group: 'Épaules', sets: 3, reps: 8, weight: 0 },
        { keyword: 'rowing', muscle_group: 'Dos', sets: 4, reps: 10, weight: 0 },
        { keyword: 'traction', muscle_group: 'Dos', sets: 4, reps: 8, weight: 0, method: 'amrap' },
        { keyword: 'squat', muscle_group: 'Quadriceps', sets: 4, reps: 6, weight: 0, method: 'htfr' },
        { keyword: 'soulevé de terre roumain', muscle_group: 'Jambes', sets: 3, reps: 8, weight: 0 }
      ]
    },
    {
      id: 'upper-lower',
      label: 'U/L',
      name: 'Upper / Lower',
      objective: 'force',
      daysPerWeek: 4,
      notes: 'Structure 4 jours orientée progression sur les mouvements de base.',
      exercises: [
        { keyword: 'développé couché', muscle_group: 'Pectoraux', sets: 5, reps: 5, weight: 0, method: 'htfr' },
        { keyword: 'rowing', muscle_group: 'Dos', sets: 4, reps: 6, weight: 0 },
        { keyword: 'squat', muscle_group: 'Quadriceps', sets: 5, reps: 5, weight: 0, method: 'htfr' },
        { keyword: 'leg curl', muscle_group: 'Jambes', sets: 3, reps: 10, weight: 0, method: 'tempo' }
      ]
    },
    {
      id: 'full-body',
      label: 'FB',
      name: 'Full Body',
      objective: 'maintien',
      daysPerWeek: 3,
      notes: 'Base polyvalente 3 jours avec accent sur les mouvements composés.',
      exercises: [
        { keyword: 'squat', muscle_group: 'Quadriceps', sets: 3, reps: 8, weight: 0 },
        { keyword: 'développé couché', muscle_group: 'Pectoraux', sets: 3, reps: 8, weight: 0 },
        { keyword: 'tirage horizontal', muscle_group: 'Dos', sets: 3, reps: 10, weight: 0 },
        { keyword: 'fentes', muscle_group: 'Jambes', sets: 2, reps: 12, weight: 0, method: 'tempo' }
      ]
    }
  ];

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
    if (!name) { showToast('Donne un nom à la séance', 'error'); return false; }

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
      saveMethods(routineId, draft.methods);
      saveMeta(routineId, draft.meta);
      showToast(draft.id ? 'Séance mise à jour' : 'Séance créée', 'success');
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
      localStorage.removeItem(getMethodsKey(id));
      localStorage.removeItem(getMetaKey(id));
      syncRoutineCloudState();
      showToast('Séance supprimée', 'info');
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
      // Copier les méthodes avancées depuis localStorage
      const srcMethods = loadMethods(id);
      if (Object.keys(srcMethods).length) {
        saveMethods(newR.id, srcMethods);
      }
      saveMeta(newR.id, loadMeta(id));
      showToast('Séance dupliquée ✓', 'success');
      renderList();
    } catch { showToast('Erreur lors de la duplication', 'error'); }
  }

  async function resolveTemplateExercise(spec, usedIds) {
    await fetchExerciseLibrary();
    const keyword = (spec.keyword || '').toLowerCase();
    let found = allExercises.find(ex => {
      const name = (ex.name || '').toLowerCase();
      return keyword && name.includes(keyword) && !usedIds.has(ex.id);
    });
    if (!found && spec.muscle_group) {
      found = allExercises.find(ex => ex.muscle_group === spec.muscle_group && !usedIds.has(ex.id));
    }
    if (!found) return null;
    usedIds.add(found.id);
    return {
      exercise_id: found.id,
      name: found.name,
      muscle_group: found.muscle_group || '',
      sets: spec.sets,
      reps: spec.reps,
      weight: spec.weight
    };
  }

  async function createFromTemplate(templateId) {
    const tpl = PROGRAM_TEMPLATES.find(t => t.id === templateId);
    if (!tpl) return;
    const usedIds = new Set();
    const exercises = [];
    const methods = {};
    for (const spec of tpl.exercises) {
      const resolved = await resolveTemplateExercise(spec, usedIds);
      if (!resolved) continue;
      exercises.push(resolved);
      if (spec.method && spec.method !== 'normal') methods[resolved.exercise_id] = spec.method;
    }
    draft = {
      id: null,
      name: tpl.name,
      meta: { objective: tpl.objective, daysPerWeek: tpl.daysPerWeek, notes: tpl.notes },
      methods,
      exercises
    };
    if (!exercises.length) showToast('Template prêt, ajoute maintenant les exercices de ta bibliothèque.', 'info');
    renderEditor();
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
        document.getElementById('btn-new-routine-empty')?.addEventListener('click', () => openEditor(null));
        return;
      }

      const ROUTINE_ICONS = ['🔥', '💪', '🦵', '🏋️', '🎯', '⚡', '🌊', '🏃'];
      const MUSCLE_COLORS = {
        'Pectoraux': 'primary', 'Épaules': 'primary', 'Dos': 'primary', 'Biceps': 'primary',
        'Jambes': 'primary', 'Quadriceps': 'primary', 'Fessiers': 'primary',
      };
      const METHOD_BADGE_LABELS = {
        amrap: '🔁 AMRAP',
        dropset: '📉 DROP SET',
        superset: '⚡ SUPERSET',
        restpause: '⏱ REST-PAUSE',
        tempo: '🎵 TEMPO',
        htfr: '🏋 HTFR',
        giantset: '🔥 GIANT SET'
      };

      // Header with new + button + day chips
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
          <div class="day-chip">Lundi</div>
          <div class="day-chip">Mardi</div>
          <div class="day-chip">Mercredi</div>
          <div class="day-chip">Jeudi</div>
          <div class="day-chip">Vendredi</div>
          <div class="day-chip">Weekend</div>
        </div>
        <p class="home-section-label" style="margin-top:24px;">Programmes actifs</p>`;

      const routineCards = routines.map((r, idx) => {
        const methods = loadMethods(r.id);
        const meta = loadMeta(r.id);
        const activeMethods = Object.values(methods).filter(m => m !== 'normal');
        const uniqueMethods = [...new Set(activeMethods)];
        const badgesHTML = uniqueMethods.map(m =>
          `<span class="method-badge method-${m}">${METHOD_BADGE_LABELS[m] || m}</span>`
        ).join('');
        const exCount = r.routine_exercises.length;
        const icon = ROUTINE_ICONS[idx % ROUTINE_ICONS.length];
        const isFeatured = idx === 0;

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
                <button class="btn btn-icon" data-edit="${r.id}" aria-label="Modifier" style="width:30px;height:30px;font-size:0.8125rem;">✏️</button>
                <button class="btn btn-icon" data-more="${r.id}" aria-label="Plus" style="width:30px;height:30px;font-size:0.8125rem;">⋯</button>
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
        if (editBtn)  { e.stopPropagation(); openEditor(editBtn.dataset.edit); return; }
        if (moreBtn)  { e.stopPropagation(); showRoutineMoreMenu(moreBtn.dataset.more); return; }
        if (startBtn) { e.stopPropagation(); startRoutine(startBtn.dataset.start); return; }
        if (card && !e.target.closest('button')) { openEditor(card.dataset.rid); }
      });

      document.getElementById('btn-new-routine-header')?.addEventListener('click', () => openEditor(null));
      document.getElementById('btn-new-routine-cta')?.addEventListener('click', () => openEditor(null));
    } catch (err) {
      console.error('[Routines] renderList:', err);
      cnt.innerHTML = '<p class="text-dim" style="padding:24px;">Erreur de chargement</p>';
    }
  }

  function confirmDelete(id) {
    showConfirm('Supprimer cette séance ? Cette action est irréversible.', () => {
      deleteRoutine(id).then(() => renderList());
    }, { title: 'Supprimer la séance', danger: true, confirmLabel: 'Supprimer' });
  }

  function showRoutineMoreMenu(id) {
    showConfirm('Supprimer ou dupliquer cette séance ?', () => confirmDelete(id), {
      title: 'Options',
      danger: true,
      confirmLabel: '🗑 Supprimer',
      cancelLabel: '⧉ Dupliquer',
    });
    // Override cancel to duplicate
    setTimeout(() => {
      const cancelBtn = document.querySelector('.confirm-cancel');
      if (cancelBtn) {
        const oldHandler = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(oldHandler, cancelBtn);
        oldHandler.addEventListener('click', () => {
          document.querySelector('.confirm-overlay')?.remove();
          duplicateRoutine(id);
        });
      }
    }, 50);
  }

  function startRoutine(id) {
    // Switch to workouts tab and start the routine
    if (window.AppState) window.AppState.switchTab('workouts');
    setTimeout(() => { window.Workouts?.startRoutine?.(id); }, 300);
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
        meta: loadMeta(routineId),
        methods: loadMethods(routineId),
        exercises: rows.map(r => ({
          exercise_id: r.exercise.id, name: r.exercise.name,
          muscle_group: r.exercise.muscle_group || '',
          sets: r.sets, reps: r.reps, weight: r.weight,
        })),
      };
    } else {
      draft = { id: null, name: '', meta: loadMeta(null), methods: {}, exercises: [] };
    }
    renderEditor();
  }

  function renderEditor() {
    const cnt = document.getElementById('routines-content');
    const isNew = !draft.id;
    cnt.innerHTML = `
      <div style="padding-top:52px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;">
          <button class="btn btn-ghost btn-sm" id="btn-editor-cancel">‹ Retour</button>
          <h2 style="font-family:var(--font-serif);font-style:italic;font-size:1.25rem;color:var(--cream);">${isNew ? 'Nouvelle séance' : 'Modifier'}</h2>
          <button class="btn-start-pill" id="btn-editor-save">Enregistrer</button>
        </div>
        <div class="form-group" style="margin-bottom:20px;">
          <label for="routine-name" style="font-size:0.75rem;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:var(--cream-dim);margin-bottom:8px;display:block;">Nom de la séance</label>
          <input type="text" id="routine-name" class="input" placeholder="ex: Push A, Full Body…"
                 value="${draft.name}" maxlength="60" style="font-size:1rem;">
        </div>
        <div class="input-row" style="margin-bottom:20px;">
          <div class="form-group">
            <label for="routine-objective" style="font-size:0.75rem;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:var(--cream-dim);margin-bottom:8px;display:block;">Objectif</label>
            <select id="routine-objective" class="input">
              <option value="hypertrophie"${draft.meta.objective === 'hypertrophie' ? ' selected' : ''}>Hypertrophie</option>
              <option value="force"${draft.meta.objective === 'force' ? ' selected' : ''}>Force</option>
              <option value="endurance"${draft.meta.objective === 'endurance' ? ' selected' : ''}>Endurance</option>
              <option value="maintien"${draft.meta.objective === 'maintien' ? ' selected' : ''}>Maintien</option>
              <option value="seche"${draft.meta.objective === 'seche' ? ' selected' : ''}>Sèche</option>
            </select>
          </div>
          ${isNew ? '' : `
          <div class="form-group">
            <label for="routine-days" style="font-size:0.75rem;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:var(--cream-dim);margin-bottom:8px;display:block;">Jours / semaine</label>
            <input type="number" id="routine-days" class="input" min="1" max="7" inputmode="numeric" value="${draft.meta.daysPerWeek || 4}">
          </div>`}
        </div>
        <div class="form-group" style="margin-bottom:20px;">
          <label for="routine-notes" style="font-size:0.75rem;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:var(--cream-dim);margin-bottom:8px;display:block;">Note séance</label>
          <textarea id="routine-notes" class="input" rows="3" placeholder="Contraintes, rythme, focus..." style="padding-top:12px;padding-bottom:12px;">${draft.meta.notes || ''}</textarea>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <p style="font-size:0.6875rem;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:var(--cream-dim);">Exercices</p>
          <button class="btn-start-pill" id="btn-add-exercise" style="padding:7px 14px;font-size:0.75rem;">+ Ajouter</button>
        </div>
        <div id="editor-exercises"></div>
        ${!draft.exercises.length ? `
          <div style="text-align:center;padding:32px 0;color:var(--cream-dim);font-size:0.875rem;">
            <div style="font-size:2rem;margin-bottom:8px;">🏋️</div>
            Aucun exercice — clique sur <strong style="color:var(--accent);">+ Ajouter</strong>
          </div>` : ''}
      </div>`;

    renderEditorExercises();

    document.getElementById('routine-name')?.addEventListener('input', e => { draft.name = e.target.value; });
    document.getElementById('routine-objective')?.addEventListener('input', e => { draft.meta.objective = e.target.value; });
    document.getElementById('routine-days')?.addEventListener('input', e => { draft.meta.daysPerWeek = parseInt(e.target.value, 10) || 4; });
    document.getElementById('routine-notes')?.addEventListener('input', e => { draft.meta.notes = e.target.value; });
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

    const methods = draft.methods || {};

    list.innerHTML = draft.exercises.map((ex, i) => {
      const method = methods[ex.exercise_id] || 'normal';
      return `
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
        <select class="input method-select" data-ex-id="${ex.exercise_id}" style="height:36px;font-size:0.8125rem;margin-top:4px;">
          <option value="normal"   ${method === 'normal'   ? 'selected' : ''}>Normal</option>
          <option value="amrap"    ${method === 'amrap'    ? 'selected' : ''}>AMRAP (derniere serie max)</option>
          <option value="dropset"  ${method === 'dropset'  ? 'selected' : ''}>Drop Set (-20%)</option>
          <option value="superset" ${method === 'superset' ? 'selected' : ''}>Superset avec suivant</option>
          <option value="restpause" ${method === 'restpause' ? 'selected' : ''}>Rest-Pause (set bonus)</option>
          <option value="tempo"    ${method === 'tempo'    ? 'selected' : ''}>Tempo (3-1-2-0)</option>
          <option value="htfr"     ${method === 'htfr'     ? 'selected' : ''}>HTFR (lourd / bas reps)</option>
          <option value="giantset" ${method === 'giantset' ? 'selected' : ''}>Giant Set avec suivants</option>
        </select>
      </div>`;
    }).join('');

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
      // MÃ©thode avancÃ©e
      if (e.target.classList.contains('method-select')) {
        const exId = e.target.dataset.exId;
        if (e.target.value === 'normal') delete draft.methods[exId];
        else draft.methods[exId] = e.target.value;
        return;
      }
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
    const GROUP_ORDER = ['pectoraux', 'dos', 'epaules', 'biceps', 'triceps', 'quadriceps', 'jambes', 'fessiers', 'ischios', 'abdos', 'mollets', 'autres'];
    const GROUP_ICONS = {
      pectoraux: 'PE',
      dos: 'DO',
      epaules: 'EP',
      biceps: 'BI',
      triceps: 'TR',
      quadriceps: 'QU',
      jambes: 'JA',
      fessiers: 'FE',
      ischios: 'IS',
      abdos: 'AB',
      mollets: 'MO',
      autres: 'EX'
    };
    const q = query.trim().toLowerCase();
    const filtered = q
      ? allExercises.filter(ex => ex.name.toLowerCase().includes(q) || (ex.muscle_group || '').toLowerCase().includes(q))
      : allExercises;

    if (!filtered.length) {
      listEl.className = '';
      listEl.innerHTML = `<p class="text-dim" style="padding:20px;text-align:center;">Aucun resultat pour "${query}"</p>`;
      listEl.onclick = null;
      return;
    }

    const groups = filtered.reduce((acc, ex) => {
      const key = ex.muscle_group || 'Autres';
      if (!acc[key]) acc[key] = [];
      acc[key].push(ex);
      return acc;
    }, {});

    const sortedGroups = Object.keys(groups).sort((a, b) => {
      const aIdx = GROUP_ORDER.indexOf((a || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
      const bIdx = GROUP_ORDER.indexOf((b || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
      if (aIdx !== -1 || bIdx !== -1) return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
      return a.localeCompare(b, 'fr');
    });

    listEl.className = 'exercise-picker-list';
    listEl.innerHTML = sortedGroups.map(group => `
      <section class="exercise-picker-group">
        <div class="exercise-picker-group-label">${group}</div>
        ${groups[group].map(ex => `
          <div class="list-item pressable" style="margin-bottom:6px;" data-pick-id="${ex.id}" data-pick-name="${ex.name}" data-pick-group="${ex.muscle_group || ''}">
            <div class="list-item-icon" aria-hidden="true">${GROUP_ICONS[(group || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()] || GROUP_ICONS.autres}</div>
            <div class="list-item-content">
              <p class="list-item-title">${ex.name}</p>
              ${ex.muscle_group ? `<p class="list-item-subtitle">${ex.muscle_group}</p>` : ''}
            </div>
            <span class="list-item-right">+</span>
          </div>`).join('')}
      </section>`).join('');

    listEl.onclick = e => {
      const row = e.target.closest('[data-pick-id]');
      if (!row) return;
      draft.exercises.push({
        exercise_id: row.dataset.pickId, name: row.dataset.pickName,
        muscle_group: row.dataset.pickGroup, sets: 3, reps: 10, weight: 0,
      });
      document.getElementById('modal-exercise-picker')?.classList.remove('open');
      renderEditorExercises();
      const empty = document.querySelector('#routines-content > p.text-dim');
      if (empty) empty.remove();
    };
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
