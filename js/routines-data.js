/* ============================================
   ROUTINES-DATA.JS — State partagé, constantes, helpers localStorage, DB
   Élev v2
   ============================================ */

// State partagé entre tous les modules routines (par référence)
window.RoutinesState = { draft: null, allExercises: [] };

window.RoutinesData = (() => {

  /* ---- Constantes ---- */
  const METHOD_LABELS = {
    normal: 'Normal', amrap: 'AMRAP', dropset: 'Drop Set',
    superset: 'Superset', restpause: 'Rest-Pause',
    tempo: 'Tempo', htfr: 'HTFR', giantset: 'Giant Set'
  };

  const PROGRAM_TEMPLATES = [
    {
      id: 'push-pull-legs', label: 'PPL', name: 'Push / Pull / Legs',
      objective: 'hypertrophie', daysPerWeek: 6,
      notes: 'Split classique avec rotation push, pull et legs.',
      exercises: [
        { keyword: 'développé couché',          muscle_group: 'Pectoraux',    sets: 4, reps: 8,  weight: 0 },
        { keyword: 'développé militaire',        muscle_group: 'Épaules',      sets: 3, reps: 8,  weight: 0 },
        { keyword: 'rowing',                     muscle_group: 'Dos',          sets: 4, reps: 10, weight: 0 },
        { keyword: 'traction',                   muscle_group: 'Dos',          sets: 4, reps: 8,  weight: 0, method: 'amrap' },
        { keyword: 'squat',                      muscle_group: 'Quadriceps',   sets: 4, reps: 6,  weight: 0, method: 'htfr' },
        { keyword: 'soulevé de terre roumain',   muscle_group: 'Jambes',       sets: 3, reps: 8,  weight: 0 },
      ]
    },
    {
      id: 'upper-lower', label: 'U/L', name: 'Upper / Lower',
      objective: 'force', daysPerWeek: 4,
      notes: 'Structure 4 jours orientée progression sur les mouvements de base.',
      exercises: [
        { keyword: 'développé couché', muscle_group: 'Pectoraux',  sets: 5, reps: 5,  weight: 0, method: 'htfr' },
        { keyword: 'rowing',           muscle_group: 'Dos',        sets: 4, reps: 6,  weight: 0 },
        { keyword: 'squat',            muscle_group: 'Quadriceps', sets: 5, reps: 5,  weight: 0, method: 'htfr' },
        { keyword: 'leg curl',         muscle_group: 'Jambes',     sets: 3, reps: 10, weight: 0, method: 'tempo' },
      ]
    },
    {
      id: 'full-body', label: 'FB', name: 'Full Body',
      objective: 'maintien', daysPerWeek: 3,
      notes: 'Base polyvalente 3 jours avec accent sur les mouvements composés.',
      exercises: [
        { keyword: 'squat',              muscle_group: 'Quadriceps', sets: 3, reps: 8,  weight: 0 },
        { keyword: 'développé couché',   muscle_group: 'Pectoraux',  sets: 3, reps: 8,  weight: 0 },
        { keyword: 'tirage horizontal',  muscle_group: 'Dos',        sets: 3, reps: 10, weight: 0 },
        { keyword: 'fentes',             muscle_group: 'Jambes',     sets: 2, reps: 12, weight: 0, method: 'tempo' },
      ]
    }
  ];

  /* ---- localStorage ---- */
  function getMethodsKey(routineId) { return `elev-ex-methods-${routineId}`; }
  function getMetaKey(routineId)    { return `elev-routine-meta-${routineId}`; }

  function syncRoutineCloudState() {
    const methodsByRoutine = {}, metaByRoutine = {};
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('elev-ex-methods-'))
          methodsByRoutine[key.replace('elev-ex-methods-', '')] = JSON.parse(localStorage.getItem(key) || '{}');
        if (key.startsWith('elev-routine-meta-'))
          metaByRoutine[key.replace('elev-routine-meta-', '')] = JSON.parse(localStorage.getItem(key) || '{}');
      });
    } catch {}
    window.CloudState?.schedule({ elev_routine_methods: methodsByRoutine, elev_routine_meta: metaByRoutine });
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

  /* ---- DB ---- */
  async function fetchRoutines() {
    const { data, error } = await DB.from('routines')
      .select('id, name, routine_exercises(id, exercise:exercises(muscle_group))')
      .eq('user_id', DB.userId())
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function fetchRoutineDetail(id) {
    const { data, error } = await DB.from('routine_exercises')
      .select('id, sets, reps, weight, order_index, exercise:exercises(id, name, muscle_group)')
      .eq('routine_id', id).order('order_index');
    if (error) throw error;
    return data || [];
  }

  async function fetchExerciseLibrary() {
    const RS = window.RoutinesState;
    if (RS.allExercises.length) return RS.allExercises;
    const { data } = await DB.from('exercises').select('id, name, muscle_group').order('name');
    RS.allExercises = data || [];
    return RS.allExercises;
  }

  async function saveRoutine() {
    const draft = window.RoutinesState.draft;
    const name = draft.name.trim();
    if (!name) { showToast('Donne un nom à la séance', 'error'); return false; }
    try {
      let routineId = draft.id;
      if (routineId) {
        await DB.from('routines').update({ name }).eq('id', routineId);
      } else {
        const { data, error } = await DB.from('routines')
          .insert({ user_id: DB.userId(), name }).select().single();
        if (error) throw error;
        routineId = data.id;
      }
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

  async function resolveTemplateExercise(spec, usedIds) {
    await fetchExerciseLibrary();
    const keyword = (spec.keyword || '').toLowerCase();
    let found = window.RoutinesState.allExercises.find(ex => {
      const name = (ex.name || '').toLowerCase();
      return keyword && name.includes(keyword) && !usedIds.has(ex.id);
    });
    if (!found && spec.muscle_group) {
      found = window.RoutinesState.allExercises.find(ex => ex.muscle_group === spec.muscle_group && !usedIds.has(ex.id));
    }
    if (!found) return null;
    usedIds.add(found.id);
    return { exercise_id: found.id, name: found.name, muscle_group: found.muscle_group || '', sets: spec.sets, reps: spec.reps, weight: spec.weight };
  }

  return {
    METHOD_LABELS, PROGRAM_TEMPLATES,
    getMethodsKey, getMetaKey,
    loadMethods, saveMethods, loadMeta, saveMeta,
    fetchRoutines, fetchRoutineDetail, fetchExerciseLibrary,
    saveRoutine, deleteRoutine, resolveTemplateExercise,
  };
})();
