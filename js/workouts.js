/* ============================================
   WORKOUTS.JS — State, helpers, DB, init
   Élev v2
   ============================================ */

window.Workouts = (() => {

  /* ---- State partagé ---- */
  const S = {
    session: null, routine: null,
    loggedSets: {}, notes: {},
    prBest: {}, clockTimer: null,
    methods: {}, exerciseOrder: [],
  };

  /* ---- Constantes ---- */
  const METHOD_CONFIG = {
    normal:    { rest: 90 },
    amrap:     { rest: 90 },
    dropset:   { rest: 90 },
    superset:  { rest: 30 },
    restpause: { rest: 20 },
    tempo:     { rest: 120, hint: 'Tempo conseillé : 3-1-2-0' },
    htfr:      { rest: 150, hint: 'HTFR : lourd, propre, repos long' },
    giantset:  { rest: 20,  hint: 'Enchaîne les 3 exercices du bloc' },
  };

  function getMethodConfig(method) { return METHOD_CONFIG[method] || METHOD_CONFIG.normal; }

  function loadSessionMethods(routineId) {
    if (!routineId) return {};
    try { return JSON.parse(localStorage.getItem(`elev-ex-methods-${routineId}`) || '{}'); }
    catch { return {}; }
  }

  /* ---- Helpers UI/swipe ---- */
  function calcWarmup(w) {
    if (!w || w <= 20) return [];
    const r = v => Math.round(v / 2.5) * 2.5;
    return [{ label: 'É1', reps: 12, w: r(w * 0.50) }, { label: 'É2', reps: 6, w: r(w * 0.70) }, { label: 'É3', reps: 3, w: r(w * 0.85) }];
  }

  function initSwipe(el, onDelete) {
    let pid = null, sx = 0, sy = 0;
    const ct = el.querySelector('.swipe-content');
    el.addEventListener('pointerdown', e => { pid = e.pointerId; sx = e.clientX; sy = e.clientY; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', e => {
      if (e.pointerId !== pid) return;
      const dx = e.clientX - sx;
      if (Math.abs(e.clientY - sy) > 12 || dx > 0) return;
      el.classList.add('swiping');
      ct.style.transform = `translateX(${Math.max(dx, -120)}px)`;
    });
    const release = e => {
      if (e.pointerId !== pid) return;
      const dx = e.clientX - sx; pid = null;
      if (dx < -72) { ct.style.transform = 'translateX(-110%)'; setTimeout(onDelete, 180); }
      else { ct.style.transform = ''; el.classList.add('snap-back'); el.classList.remove('swiping'); setTimeout(() => el.classList.remove('snap-back'), 300); }
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', () => { ct.style.transform = ''; el.classList.remove('swiping'); pid = null; });
  }

  function getDefaultReps(method, defaultReps) { return method === 'htfr' ? Math.min(defaultReps || 6, 6) : defaultReps; }
  function getSetRows(exId)    { return Array.from(document.getElementById(`sets-${exId}`)?.children || []); }
  function renumberRows(exId)  {
    getSetRows(exId).forEach((rowEl, idx) => { const num = rowEl.querySelector('.set-num-v2'); if (num) num.textContent = idx + 1; });
    const arr = S.loggedSets[exId];
    if (arr?.length) arr.sort((a, b) => a.n - b.n).forEach((set, idx) => { set.n = idx + 1; });
  }

  function showWorkoutsTab() { const b = document.getElementById('nav-tab-workouts'); if (b) b.style.display = ''; }
  function hideWorkoutsTab() { const b = document.getElementById('nav-tab-workouts'); if (b) b.style.display = 'none'; }

  /* ---- DB ---- */
  async function fetchRoutines() {
    const { data, error } = await DB.from('routines').select('id, name')
      .eq('user_id', DB.userId()).order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function fetchRoutineExercises(routineId) {
    const { data, error } = await DB.from('routine_exercises')
      .select('id, sets, reps, weight, order_index, exercise:exercises(id, name, muscle_group)')
      .eq('routine_id', routineId).order('order_index');
    if (error) throw error;
    return data || [];
  }

  async function fetchPrevSets(exId) {
    const { data: sessions } = await DB.from('sessions').select('id')
      .eq('user_id', DB.userId()).not('ended_at', 'is', null)
      .order('ended_at', { ascending: false }).limit(5);
    if (!sessions?.length) return [];
    for (const sess of sessions) {
      const { data } = await DB.from('session_sets')
        .select('reps, weight, set_number').eq('session_id', sess.id)
        .eq('exercise_id', exId).eq('is_warmup', false).order('set_number');
      if (data?.length) return data;
    }
    return [];
  }

  async function insertSessionRows(rows) {
    const { error } = await DB.from('session_sets').insert(rows);
    if (!error) return;
    const msg = `${error.message || ''} ${error.details || ''}`.toLowerCase();
    if (!msg.includes('rpe')) throw error;
    const sanitized = rows.map(({ rpe, ...row }) => row);
    const retry = await DB.from('session_sets').insert(sanitized);
    if (retry.error) throw retry.error;
    showToast('RPE non sauvegardé côté base, mais la séance est bien enregistrée.', 'info', 3200);
  }

  /* ---- Démarrer une séance ---- */
  async function startSession(routineId, routineName) {
    const cnt = document.getElementById('workouts-content');
    cnt.innerHTML = '<div class="workout-spinner"><div class="spinner spinner-lg"></div></div>';
    try {
      const { data: sess, error } = await DB.from('sessions')
        .insert({ user_id: DB.userId(), routine_id: routineId, started_at: new Date().toISOString() })
        .select().single();
      if (error) throw error;
      const exercises = await fetchRoutineExercises(routineId);
      S.session = sess; S.routine = { id: routineId, name: routineName };
      S.loggedSets = {}; S.notes = {}; S.prBest = {};
      S.methods      = loadSessionMethods(routineId);
      S.exerciseOrder = exercises.map(re => re.exercise.id);
      exercises.forEach(re => { S.loggedSets[re.exercise.id] = []; });
      showWorkoutsTab();
      AppState.switchTab('workouts');
      await WorkoutsRender.renderSession(exercises);
    } catch (err) {
      console.error('[Workouts] startSession:', err);
      showToast('Erreur au démarrage de la séance', 'error');
      init();
    }
  }

  async function startRoutine(routineId) {
    const routines = await fetchRoutines();
    const r = routines.find(item => item.id === routineId);
    if (r) startSession(r.id, r.name);
  }

  /* ---- Init (sélection de routine) ---- */
  async function init() {
    if (S.session) return;
    const cnt = document.getElementById('workouts-content');
    if (!cnt) return;
    cnt.innerHTML = '<div style="display:flex;justify-content:center;padding:80px 0;"><div class="spinner spinner-lg"></div></div>';
    try {
      const routines = await fetchRoutines();
      if (!routines.length) {
        cnt.innerHTML = `
          <div style="text-align:center;padding:80px 20px 24px;">
            <div style="font-size:3rem;margin-bottom:12px;">📋</div>
            <p style="font-family:var(--font-serif);font-style:italic;font-size:1.5rem;color:var(--cream);margin-bottom:8px;">Aucune routine</p>
            <p style="color:var(--cream-dim);font-size:0.875rem;margin-bottom:24px;">Crée une routine dans l'onglet Routines</p>
            <button class="btn btn-primary btn-lg" onclick="AppState.switchTab('routines')">Créer une routine</button>
          </div>`;
        return;
      }
      cnt.innerHTML = `
        <div style="padding:52px 20px 16px;">
          <h1 style="font-family:var(--font-serif);font-style:italic;font-size:2rem;color:var(--cream);margin-bottom:20px;">Séance</h1>
          <div id="routine-picker-list"></div>
          <button class="btn btn-ghost btn-full" style="margin-top:4px;" id="btn-other-sport-init">Autre sport / activité</button>
        </div>`;
      const pickerList = cnt.querySelector('#routine-picker-list');
      routines.forEach((r, i) => {
        const card = document.createElement('div');
        card.className = `routine-card-v2${i === 0 ? ' featured' : ''}`;
        card.style.cssText = 'margin-bottom:10px;cursor:pointer;';
        card.innerHTML = `
          <div class="routine-top">
            <div class="routine-icon">${i === 0 ? '⭐' : '💪'}</div>
            <div style="flex:1;min-width:0;"><div class="routine-name-v2">${r.name}</div></div>
            <button class="btn-start-pill">Démarrer</button>
          </div>`;
        card.addEventListener('click', () => startSession(r.id, r.name));
        pickerList.appendChild(card);
      });
      document.getElementById('btn-other-sport-init')?.addEventListener('click', WorkoutsSets.showOtherSport);
    } catch (err) {
      console.error('[Workouts] init:', err);
      cnt.innerHTML = '<p class="text-dim" style="padding:24px;">Erreur de chargement</p>';
    }
  }

  async function checkActiveSession() {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await DB.from('sessions')
        .select('id, started_at, routine_id, routine:routines(name)')
        .eq('user_id', DB.userId()).is('ended_at', null)
        .gte('started_at', today + 'T00:00:00').limit(1);
      if (data?.[0]) showWorkoutsTab();
    } catch (_) {}
  }

  document.addEventListener('tabchange', e => { if (e.detail.tab === 'workouts') init(); });

  return {
    init, startRoutine, checkActiveSession, insertSessionRows, getMethodConfig,
    // Exposé pour les sous-modules (référence partagée)
    _S: S,
    _methods: { calcWarmup, initSwipe, getDefaultReps, getSetRows, renumberRows, showWorkoutsTab, hideWorkoutsTab, fetchPrevSets },
  };
})();
