/* ============================================
   ROUTINES-EDITOR.JS — Éditeur de routine (UI)
   Élev v2
   ============================================ */

window.RoutinesEditor = (() => {

  const RS  = () => window.RoutinesState;
  const RD  = () => window.RoutinesData;

  /* ---- Créer depuis un template ---- */
  async function createFromTemplate(templateId) {
    const tpl = RD().PROGRAM_TEMPLATES.find(t => t.id === templateId);
    if (!tpl) return;
    const usedIds = new Set();
    const exercises = [], methods = {};
    for (const spec of tpl.exercises) {
      const resolved = await RD().resolveTemplateExercise(spec, usedIds);
      if (!resolved) continue;
      exercises.push(resolved);
      if (spec.method && spec.method !== 'normal') methods[resolved.exercise_id] = spec.method;
    }
    RS().draft = { id: null, name: tpl.name, meta: { objective: tpl.objective, daysPerWeek: tpl.daysPerWeek, notes: tpl.notes }, methods, exercises };
    if (!exercises.length) showToast('Template prêt, ajoute maintenant les exercices de ta bibliothèque.', 'info');
    renderEditor();
  }

  /* ---- Ouvrir l'éditeur ---- */
  async function openEditor(routineId) {
    const fab = document.getElementById('fab-routine');
    if (fab) fab.style.display = 'none';

    if (routineId) {
      const rows = await RD().fetchRoutineDetail(routineId);
      const { data } = await DB.from('routines').select('name').eq('id', routineId).single();
      RS().draft = {
        id: routineId, name: data?.name || '',
        meta: RD().loadMeta(routineId),
        methods: RD().loadMethods(routineId),
        exercises: rows.map(r => ({
          exercise_id: r.exercise.id, name: r.exercise.name,
          muscle_group: r.exercise.muscle_group || '',
          sets: r.sets, reps: r.reps, weight: r.weight,
        })),
      };
    } else {
      RS().draft = { id: null, name: '', meta: RD().loadMeta(null), methods: {}, exercises: [] };
    }
    renderEditor();
  }

  /* ---- Rendu formulaire ---- */
  function renderEditor() {
    const draft = RS().draft;
    const cnt   = document.getElementById('routines-content');
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

    document.getElementById('routine-name')?.addEventListener('input', e => { RS().draft.name = e.target.value; });
    document.getElementById('routine-objective')?.addEventListener('input', e => { RS().draft.meta.objective = e.target.value; });
    document.getElementById('routine-days')?.addEventListener('input', e => { RS().draft.meta.daysPerWeek = parseInt(e.target.value, 10) || 4; });
    document.getElementById('routine-notes')?.addEventListener('input', e => { RS().draft.meta.notes = e.target.value; });
    document.getElementById('btn-editor-cancel')?.addEventListener('click', () => { RS().draft = null; window.Routines.renderList(); });
    document.getElementById('btn-editor-save')?.addEventListener('click', async () => {
      const ok = await RD().saveRoutine();
      if (ok) { RS().draft = null; window.Routines.renderList(); }
    });
    document.getElementById('btn-add-exercise')?.addEventListener('click', openExercisePicker);
  }

  /* ---- Liste des exercices dans l'éditeur ---- */
  function renderEditorExercises() {
    const list  = document.getElementById('editor-exercises');
    const draft = RS().draft;
    if (!list) return;
    if (!draft.exercises.length) { list.innerHTML = ''; return; }

    const methods = draft.methods || {};
    const METHOD_LABELS = RD().METHOD_LABELS;

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
            <button class="btn btn-icon" data-up="${i}"      aria-label="Monter"    ${i === 0 ? 'disabled' : ''}>↑</button>
            <button class="btn btn-icon" data-down="${i}"    aria-label="Descendre" ${i === draft.exercises.length - 1 ? 'disabled' : ''}>↓</button>
            <button class="btn btn-icon" data-remove="${i}"  aria-label="Retirer"   style="color:#c0392b;">✕</button>
          </div>
        </div>
        <div class="input-row">
          <div class="form-group"><label>Séries</label>
            <input type="number" class="input" data-field="sets"   data-idx="${i}" value="${ex.sets}"   min="1" max="20" inputmode="numeric"></div>
          <div class="form-group"><label>Répétitions</label>
            <input type="number" class="input" data-field="reps"   data-idx="${i}" value="${ex.reps}"   min="1" max="99" inputmode="numeric"></div>
          <div class="form-group"><label>Poids (kg)</label>
            <input type="number" class="input" data-field="weight" data-idx="${i}" value="${ex.weight}" min="0" step="0.5" inputmode="decimal"></div>
        </div>
        <select class="input method-select" data-ex-id="${ex.exercise_id}" style="height:36px;font-size:0.8125rem;margin-top:4px;">
          <option value="normal"    ${method === 'normal'    ? 'selected' : ''}>Normal</option>
          <option value="amrap"     ${method === 'amrap'     ? 'selected' : ''}>AMRAP (dernière série max)</option>
          <option value="dropset"   ${method === 'dropset'   ? 'selected' : ''}>Drop Set (-20%)</option>
          <option value="superset"  ${method === 'superset'  ? 'selected' : ''}>Superset avec suivant</option>
          <option value="restpause" ${method === 'restpause' ? 'selected' : ''}>Rest-Pause (set bonus)</option>
          <option value="tempo"     ${method === 'tempo'     ? 'selected' : ''}>Tempo (3-1-2-0)</option>
          <option value="htfr"      ${method === 'htfr'      ? 'selected' : ''}>HTFR (lourd / bas reps)</option>
          <option value="giantset"  ${method === 'giantset'  ? 'selected' : ''}>Giant Set avec suivants</option>
        </select>
      </div>`;
    }).join('');

    list.addEventListener('click', e => {
      const up     = e.target.closest('[data-up]');
      const down   = e.target.closest('[data-down]');
      const remove = e.target.closest('[data-remove]');
      if (up)     { moveExercise(parseInt(up.dataset.up), -1); }
      if (down)   { moveExercise(parseInt(down.dataset.down), 1); }
      if (remove) { RS().draft.exercises.splice(parseInt(remove.dataset.remove), 1); renderEditorExercises(); }
    });
    list.addEventListener('input', e => {
      if (e.target.classList.contains('method-select')) {
        const exId = e.target.dataset.exId;
        if (e.target.value === 'normal') delete RS().draft.methods[exId];
        else RS().draft.methods[exId] = e.target.value;
        return;
      }
      const field = e.target.dataset.field;
      const idx   = parseInt(e.target.dataset.idx);
      if (!field || isNaN(idx)) return;
      RS().draft.exercises[idx][field] = parseFloat(e.target.value) || 0;
    });
  }

  function moveExercise(idx, dir) {
    const draft  = RS().draft;
    const target = idx + dir;
    if (target < 0 || target >= draft.exercises.length) return;
    [draft.exercises[idx], draft.exercises[target]] = [draft.exercises[target], draft.exercises[idx]];
    renderEditorExercises();
  }

  /* ---- Sélecteur d'exercices ---- */
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
    await RD().fetchExerciseLibrary();
    renderPickerList('');
  }

  function renderPickerList(query) {
    const listEl = document.getElementById('exercise-list-modal');
    if (!listEl) return;
    const GROUP_ORDER = ['pectoraux','dos','epaules','biceps','triceps','quadriceps','jambes','fessiers','ischios','abdos','mollets','autres'];
    const GROUP_ICONS = { pectoraux:'PE', dos:'DO', epaules:'EP', biceps:'BI', triceps:'TR', quadriceps:'QU', jambes:'JA', fessiers:'FE', ischios:'IS', abdos:'AB', mollets:'MO', autres:'EX' };
    const allExercises = window.RoutinesState.allExercises;

    const q        = query.trim().toLowerCase();
    const filtered = q
      ? allExercises.filter(ex => ex.name.toLowerCase().includes(q) || (ex.muscle_group || '').toLowerCase().includes(q))
      : allExercises;

    if (!filtered.length) {
      listEl.className = '';
      listEl.innerHTML = `<p class="text-dim" style="padding:20px;text-align:center;">Aucun résultat pour "${query}"</p>`;
      listEl.onclick = null;
      return;
    }

    const groups      = filtered.reduce((acc, ex) => { const key = ex.muscle_group || 'Autres'; if (!acc[key]) acc[key] = []; acc[key].push(ex); return acc; }, {});
    const sortedGroups = Object.keys(groups).sort((a, b) => {
      const norm  = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const aIdx  = GROUP_ORDER.indexOf(norm(a));
      const bIdx  = GROUP_ORDER.indexOf(norm(b));
      if (aIdx !== -1 || bIdx !== -1) return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
      return a.localeCompare(b, 'fr');
    });

    listEl.className = 'exercise-picker-list';
    listEl.innerHTML = sortedGroups.map(group => `
      <section class="exercise-picker-group">
        <div class="exercise-picker-group-label">${group}</div>
        ${groups[group].map(ex => {
          const icon = GROUP_ICONS[(group || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()] || GROUP_ICONS.autres;
          return `<div class="list-item pressable" style="margin-bottom:6px;" data-pick-id="${ex.id}" data-pick-name="${ex.name}" data-pick-group="${ex.muscle_group || ''}">
            <div class="list-item-icon" aria-hidden="true">${icon}</div>
            <div class="list-item-content">
              <p class="list-item-title">${ex.name}</p>
              ${ex.muscle_group ? `<p class="list-item-subtitle">${ex.muscle_group}</p>` : ''}
            </div>
            <span class="list-item-right">+</span>
          </div>`;
        }).join('')}
      </section>`).join('');

    listEl.onclick = e => {
      const row = e.target.closest('[data-pick-id]');
      if (!row) return;
      RS().draft.exercises.push({
        exercise_id: row.dataset.pickId, name: row.dataset.pickName,
        muscle_group: row.dataset.pickGroup, sets: 3, reps: 10, weight: 0,
      });
      document.getElementById('modal-exercise-picker')?.classList.remove('open');
      renderEditorExercises();
      document.querySelector('#routines-content > p.text-dim')?.remove();
    };
  }

  return { openEditor, createFromTemplate };
})();
