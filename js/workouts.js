window.Workouts = (() => {

  const S = {
    session: null, routine: null,
    loggedSets: {}, notes: {},
    prBest: {},    clockTimer: null,
    methods: {},   // { [exerciseId]: 'normal'|'amrap'|'dropset'|'superset'|'restpause'|'tempo'|'htfr'|'giantset' }
    exerciseOrder: [], // liste ordonnée des exercise.id pour Superset
  };

  const METHOD_LABELS = {
    amrap: '🔁 AMRAP',
    dropset: '📉 DROP SET',
    superset: '⚡ SUPERSET',
    restpause: '⏱ REST-PAUSE',
    tempo: '🎵 TEMPO',
    htfr: '🏋 HTFR',
    giantset: '🔥 GIANT SET'
  };

  function getMethodConfig(method) {
    const map = {
      normal:    { rest: 90 },
      amrap:     { rest: 90 },
      dropset:   { rest: 90 },
      superset:  { rest: 30 },
      restpause: { rest: 20 },
      tempo:     { rest: 120, hint: 'Tempo conseillé : 3-1-2-0' },
      htfr:      { rest: 150, hint: 'HTFR : lourd, propre, repos long' },
      giantset:  { rest: 20, hint: 'Enchaîne les 3 exercices du bloc' }
    };
    return map[method] || map.normal;
  }

  function loadSessionMethods(routineId) {
    if (!routineId) return {};
    try { return JSON.parse(localStorage.getItem(`elev-ex-methods-${routineId}`) || '{}'); }
    catch { return {}; }
  }

  // Warmup auto-calculé (jamais sauvegardé)
  function calcWarmup(w) {
    if (!w || w <= 20) return [];
    const r = v => Math.round(v / 2.5) * 2.5;
    return [
      { label: 'É1', reps: 12, w: r(w * 0.50) },
      { label: 'É2', reps: 6,  w: r(w * 0.70) },
      { label: 'É3', reps: 3,  w: r(w * 0.85) },
    ];
  }

  // Swipe-to-delete — pointerId uniquement, pas de touch brut
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

  // Requêtes Supabase
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

  function getDefaultReps(method, defaultReps) {
    if (method === 'htfr') return Math.min(defaultReps || 6, 6);
    return defaultReps;
  }

  function getSetRows(exId) {
    return Array.from(document.getElementById(`sets-${exId}`)?.children || []);
  }

  function renumberRows(exId) {
    getSetRows(exId).forEach((rowEl, idx) => {
      const num = rowEl.querySelector('.set-num-v2');
      if (num) num.textContent = idx + 1;
    });
    const arr = S.loggedSets[exId];
    if (arr?.length) {
      arr.sort((a, b) => a.n - b.n).forEach((set, idx) => { set.n = idx + 1; });
    }
  }

  function showWorkoutsTab() {
    const btn = document.getElementById('nav-tab-workouts');
    if (btn) btn.style.display = '';
  }

  function hideWorkoutsTab() {
    const btn = document.getElementById('nav-tab-workouts');
    if (btn) btn.style.display = 'none';
  }

  // Démarrer une séance
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
      S.methods = loadSessionMethods(routineId);
      S.exerciseOrder = exercises.map(re => re.exercise.id);
      exercises.forEach(re => { S.loggedSets[re.exercise.id] = []; });
      showWorkoutsTab();
      AppState.switchTab('workouts');
      await renderSession(exercises);
    } catch (err) {
      console.error('[Workouts] startSession:', err);
      showToast('Erreur au démarrage de la séance', 'error');
      init();
    }
  }

  // Rendu session en cours
  async function renderSession(exercises) {
    const cnt = document.getElementById('workouts-content');
    const started = new Date(S.session.started_at);
    const totalEx = exercises.length;
    cnt.innerHTML = `
      <div style="padding:52px 20px 16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <div>
            <p style="font-size:0.6875rem;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--accent);margin-bottom:4px;">En cours</p>
            <h2 style="font-family:var(--font-serif);font-style:italic;font-size:1.5rem;color:var(--cream);">${S.routine.name}</h2>
          </div>
          <div style="background:rgba(200,149,108,0.15);border:1px solid rgba(200,149,108,0.3);border-radius:100px;padding:8px 14px;text-align:center;flex-shrink:0;">
            <div style="font-family:var(--font-serif);font-style:italic;font-size:1.25rem;color:var(--accent-warm);line-height:1;" id="session-elapsed-val">0:00</div>
            <div style="font-size:0.5625rem;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:var(--accent-warm);opacity:0.7;margin-top:2px;">Durée</div>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="font-size:0.6875rem;color:var(--cream-dim);" id="session-progress-label">${totalEx} exercice${totalEx > 1 ? 's' : ''}</span>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-ghost btn-sm" id="btn-other-sport" style="font-size:0.75rem;padding:5px 10px;">Autre sport</button>
            <button class="btn btn-danger btn-sm" id="btn-finish" style="font-size:0.75rem;padding:5px 10px;">Terminer</button>
          </div>
        </div>
        <div style="height:3px;background:rgba(255,255,255,0.08);border-radius:100px;overflow:hidden;">
          <div id="session-progress-bar" style="height:100%;width:0%;background:linear-gradient(90deg,var(--accent),rgba(122,184,147,0.6));border-radius:100px;transition:width 0.5s ease;"></div>
        </div>
      </div>
      <span style="display:none;" id="session-elapsed">0 min</span>
      <div id="exercises-list" style="padding:0 20px 100px;"></div>`;

    const list = document.getElementById('exercises-list');
    for (let i = 0; i < exercises.length; i++) {
      const re = exercises[i];
      const prev = await fetchPrevSets(re.exercise.id);
      // Stocker le meilleur poids précédent pour détection PR
      if (prev.length) S.prBest[re.exercise.id] = Math.max(...prev.map(s => s.weight || 0));
      list.insertAdjacentHTML('beforeend', buildExerciseCard(re, prev, i));
    }
    // Mettre à jour les hints de séquences (les noms des exercices suivants sont maintenant dans le DOM)
    exercises.forEach((re, idx) => {
      const method = S.methods[re.exercise.id] || 'normal';
      if (method === 'superset' || method === 'giantset') {
        const hint = document.getElementById(`method-hint-${re.exercise.id}`);
        if (hint) {
          const sliceEnd = idx + (method === 'giantset' ? 3 : 2);
          const nextNames = exercises.slice(idx + 1, sliceEnd)
            .map(item => document.getElementById(`card-title-${item.exercise.id}`)?.textContent || 'exercice suivant');
          const label = method === 'giantset'
            ? `🔥 Enchaîne avec → ${nextNames.join(' • ')}`
            : `⚡ Enchaîne avec → ${nextNames[0] || 'exercice suivant'}`;
          hint.innerHTML = `<span class="method-badge method-${method}">${label}</span>`;
        }
      }
    });
    exercises.forEach(re => {
      for (let i = 1; i <= re.sets; i++) appendSetRow(re.exercise.id, i, re.reps, re.weight, i === re.sets);
    });

    clearInterval(S.clockTimer);
    S.clockTimer = setInterval(() => {
      const el = document.getElementById('session-elapsed');
      const valEl = document.getElementById('session-elapsed-val');
      if (!el && !valEl) { clearInterval(S.clockTimer); return; }
      const mins = Math.floor((Date.now() - started) / 60000);
      const secs = Math.floor(((Date.now() - started) % 60000) / 1000);
      if (el) el.textContent = `${mins} min`;
      if (valEl) valEl.textContent = `${mins}:${String(secs).padStart(2,'0')}`;
    }, 1000);

    list.addEventListener('click', e => {
      const addBtn  = e.target.closest('[data-add-set]');
      const noteBtn = e.target.closest('[data-note-btn]');
      if (addBtn) {
        const exId = addBtn.dataset.addSet;
        const n = document.getElementById(`sets-${exId}`).children.length + 1;
        appendSetRow(exId, n, parseFloat(addBtn.dataset.reps), parseFloat(addBtn.dataset.weight));
      }
      if (noteBtn) {
        const area = document.getElementById(`note-${noteBtn.dataset.noteBtn}`);
        if (area) area.style.display = area.style.display === 'none' ? 'block' : 'none';
      }
    });
    list.addEventListener('input', e => { const nf = e.target.dataset.noteFor; if (nf) S.notes[nf] = e.target.value; });
    document.getElementById('btn-finish')?.addEventListener('click', confirmFinish);
    document.getElementById('btn-other-sport')?.addEventListener('click', showOtherSport);
  }

  // HTML d'une carte exercice
  function buildExerciseCard(re, prevSets, exIdx) {
    const ex = re.exercise;
    const wu = calcWarmup(re.weight);
    const method = S.methods[ex.id] || 'normal';
    const prevHTML = prevSets.length
      ? prevSets.map(s => `<span class="badge badge-surface">${s.reps}×${s.weight}kg${s.rpe ? ` @${s.rpe}` : ''}</span>`).join('')
      : '<span style="font-size:0.75rem;color:var(--cream-dim);opacity:.6;">Première fois</span>';
    const wuHTML = wu.map(w => `<span class="badge badge-surface">${w.label} ${w.reps}×${w.w}kg</span>`).join('');
    const methodBadge = method !== 'normal'
      ? `<span class="method-badge method-${method}">${METHOD_LABELS[method]}</span>`
      : '';

    let methodHintHTML = '';
    if (method === 'superset' || method === 'giantset') {
      const idx = S.exerciseOrder.indexOf(ex.id);
      const nextIds = idx !== -1
        ? S.exerciseOrder.slice(idx + 1, idx + (method === 'giantset' ? 3 : 2))
        : [];
      const nextNames = nextIds
        .map(id => document.getElementById(`card-title-${id}`)?.textContent || '…');
      const label = method === 'giantset'
        ? `🔥 Enchaîne avec → ${nextNames.join(' • ') || '…'}`
        : `⚡ Enchaîne avec → ${nextNames[0] || '…'}`;
      methodHintHTML = `<div id="method-hint-${ex.id}" style="padding:0 16px 10px;">
        <span class="method-badge method-${method}">${label}</span>
      </div>`;
    }
    if (!methodHintHTML && getMethodConfig(method).hint) {
      methodHintHTML = `<div style="padding:0 16px 10px;">
        <span class="method-badge method-${method}">${getMethodConfig(method).hint}</span>
      </div>`;
    }

    return `
      <div class="exercise-card-v2" data-ex-card="${ex.id}">
        <div class="exercise-header-v2">
          <div style="display:flex;align-items:center;flex:1;min-width:0;gap:10px;">
            <div class="exercise-num-v2">${(exIdx || 0) + 1}</div>
            <div style="min-width:0;">
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                <p style="font-weight:600;color:var(--cream);font-size:0.9375rem;" id="card-title-${ex.id}">${ex.name}</p>
                ${methodBadge}
              </div>
              <p style="font-size:0.75rem;color:var(--cream-dim);margin-top:2px;">${ex.muscle_group ? ex.muscle_group + ' · ' : ''}${re.sets}×${re.reps} @ ${re.weight}kg</p>
            </div>
          </div>
          <button class="btn btn-icon" data-note-btn="${ex.id}" aria-label="Note" style="font-size:1rem;flex-shrink:0;">📝</button>
        </div>
        <div style="padding:0 16px 10px;display:flex;flex-wrap:wrap;align-items:center;gap:4px;">
          <span style="font-size:0.6875rem;color:var(--cream-dim);">Dernière fois :</span>
          ${prevHTML}
        </div>
        ${wu.length ? `<div style="padding:0 16px 10px;display:flex;flex-wrap:wrap;align-items:center;gap:4px;">
          <span style="font-size:0.6875rem;color:var(--cream-dim);">Échauffement :</span>
          ${wuHTML}
        </div>` : ''}
        <div id="note-${ex.id}" style="display:none;padding:0 16px 10px;">
          <textarea class="input" rows="2" placeholder="Note…" data-note-for="${ex.id}" style="font-size:0.875rem;"></textarea>
        </div>
        <div class="sets-table-v2">
          <div class="sets-header-v2">
            <span style="text-align:center;">#</span>
            <span style="text-align:center;">Reps</span>
            <span style="text-align:center;">Poids (kg)</span>
            <span style="text-align:center;">RPE</span>
            <span></span>
          </div>
          <div id="sets-${ex.id}" class="sets-list"></div>
        </div>
        ${methodHintHTML}
        <div style="padding:8px 16px 14px;">
          <button class="btn btn-secondary btn-sm btn-full"
            data-add-set="${ex.id}" data-reps="${re.reps}" data-weight="${re.weight}">+ Ajouter un set</button>
        </div>
      </div>`;
  }

  // Ajouter une ligne de set
  // isLast : indique si c'est la dernière série normale (pour AMRAP / Drop Set)
  function appendSetRow(exId, n, defaultReps, defaultWeight, isLast) {
    const list = document.getElementById(`sets-${exId}`);
    if (!list) return;
    const method = S.methods[exId] || 'normal';
    const isAmrapLast = isLast && method === 'amrap';
    const baseReps = getDefaultReps(method, defaultReps);
    const rpePlaceholder = method === 'htfr' ? '9' : '8';
    const el = document.createElement('div');
    el.className = 'swipeable';
    el.innerHTML = `
      <div class="swipe-delete-bg">🗑</div>
      <div class="swipe-content set-row-v2 current">
        <span class="set-num-v2">${n}</span>
        <input type="number" class="input set-input-v2" value="${isAmrapLast ? '' : baseReps}"
          min="1" max="999" inputmode="numeric" aria-label="Répétitions"
          placeholder="${isAmrapLast ? 'max' : ''}">
        <input type="number" class="input set-input-v2" value="${defaultWeight}" min="0" step="0.5" inputmode="decimal" aria-label="Poids">
        <input type="number" class="input set-input-v2" value="" min="1" max="10" step="0.5" inputmode="decimal" aria-label="RPE" placeholder="${rpePlaceholder}">
        <button class="btn-check-v2${isAmrapLast ? ' amrap-btn' : ''}" aria-label="Valider">
          ${isAmrapLast ? '∞' : '✓'}
        </button>
      </div>`;
    list.appendChild(el);
    initSwipe(el, () => {
      el.remove();
      renumberRows(exId);
    });
    el.querySelector('.btn-check-v2').addEventListener('click', ev => {
      const row = el.querySelector('.swipe-content');
      const inputs = el.querySelectorAll('.set-input-v2');
      const rIn = inputs[0], wIn = inputs[1], rpeIn = inputs[2];
      const reps = parseInt(rIn.value) || 0;
      const weight = parseFloat(wIn.value) || 0;
      const rpe = parseFloat(rpeIn.value);

      // AMRAP : ne pas valider si reps vide
      if (isAmrapLast && !reps) {
        showToast('Entre le nombre de répétitions max', 'error');
        rIn.focus();
        return;
      }
      if (!isNaN(rpe) && (rpe < 1 || rpe > 10)) {
        showToast('Le RPE doit être entre 1 et 10', 'error');
        rpeIn.focus();
        return;
      }

      const arr = S.loggedSets[exId] || (S.loggedSets[exId] = []);
      const found = arr.find(s => s.n === n);
      if (found) { found.reps = reps; found.weight = weight; found.rpe = isNaN(rpe) ? null : rpe; }
      else arr.push({ n, reps, weight, rpe: isNaN(rpe) ? null : rpe, methodTag: method });

      const prevBest = S.prBest[exId];
      const isPR = prevBest !== undefined && weight > prevBest;
      if (weight > (S.prBest[exId] || 0)) S.prBest[exId] = weight;

      const btn = ev.currentTarget;
      row.classList.remove('current');
      row.classList.add('done');
      if (isPR) {
        btn.textContent = '🏆';
        btn.classList.add('done');
        btn.style.background = 'var(--color-gold,#f5a623)';
        btn.style.borderColor = 'var(--color-gold,#f5a623)';
        showToast(`🏆 Nouveau record ! ${weight} kg`, 'success', 3500);
        if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
      } else {
        btn.classList.add('done');
        btn.textContent = '✓';
        showToast(`Série ${n} · ${reps}×${weight}kg${isNaN(rpe) ? '' : ` @${rpe}`}`, 'success', 1800);
      }
      window.RestTimer?.start(getMethodConfig(method).rest);

      // Drop Set : après validation de la dernière série normale
      if (isLast && method === 'dropset') {
        const dropWeight = Math.round((weight * 0.8) / 2.5) * 2.5;
        const nextN = list.children.length + 1;
        appendDropSetRow(exId, nextN, dropWeight);
      }
      if (isLast && method === 'restpause') {
        const nextN = list.children.length + 1;
        appendRestPauseRow(exId, nextN, weight);
      }
    });
  }

  // Ajouter une ligne de drop set (set bonus après la dernière série normale)
  function appendDropSetRow(exId, n, dropWeight) {
    const list = document.getElementById(`sets-${exId}`);
    if (!list) return;
    // Éviter les doublons : si un drop set existe déjà, ne pas en ajouter un autre
    if (list.querySelector('.drop-set-row')) return;
    const el = document.createElement('div');
    el.className = 'swipeable';
    el.innerHTML = `
      <div class="swipe-delete-bg">🗑</div>
      <div class="swipe-content set-row-v2 current drop-set-row">
        <span class="set-num-v2" style="color:var(--accent-blue,#8b9ec8);">${n}</span>
        <input type="number" class="input set-input-v2" placeholder="max" min="1" max="999" inputmode="numeric" aria-label="Répétitions">
        <input type="number" class="input set-input-v2" value="${dropWeight}" min="0" step="0.5" inputmode="decimal" aria-label="Poids">
        <input type="number" class="input set-input-v2" value="" min="1" max="10" step="0.5" inputmode="decimal" aria-label="RPE" placeholder="9">
        <button class="btn-check-v2" style="border-color:rgba(139,158,200,0.4);color:var(--accent-blue,#8b9ec8);font-size:0.5625rem;font-weight:700;" aria-label="Valider drop set">DROP</button>
      </div>`;
    list.appendChild(el);
    initSwipe(el, () => {
      el.remove();
      renumberRows(exId);
    });
    el.querySelector('.btn-check-v2').addEventListener('click', ev => {
      const row = el.querySelector('.swipe-content');
      const inputs = el.querySelectorAll('.set-input-v2');
      const rIn = inputs[0], wIn = inputs[1], rpeIn = inputs[2];
      const reps = parseInt(rIn.value) || 0, weight = parseFloat(wIn.value) || 0;
      const rpe = parseFloat(rpeIn.value);
      if (!reps) { showToast('Entre le nombre de répétitions max pour le drop set', 'error'); rIn.focus(); return; }
      const arr = S.loggedSets[exId] || (S.loggedSets[exId] = []);
      arr.push({ n, reps, weight, rpe: isNaN(rpe) ? null : rpe, methodTag: 'dropset' });
      const btn = ev.currentTarget;
      row.classList.remove('current');
      row.classList.add('done');
      btn.classList.add('done');
      btn.textContent = '✓';
      showToast(`Drop set ${n} · ${reps}×${weight}kg${isNaN(rpe) ? '' : ` @${rpe}`}`, 'success', 1800);
      window.RestTimer?.start(90);
    });
  }

  function appendRestPauseRow(exId, n, baseWeight) {
    const list = document.getElementById(`sets-${exId}`);
    if (!list || list.querySelector('.rest-pause-row')) return;
    const el = document.createElement('div');
    el.className = 'swipeable';
    el.innerHTML = `
      <div class="swipe-delete-bg">🗑</div>
      <div class="swipe-content set-row-v2 current rest-pause-row">
        <span class="set-num-v2" style="color:var(--accent-warm);">${n}</span>
        <input type="number" class="input set-input-v2" placeholder="max" min="1" max="999" inputmode="numeric" aria-label="Répétitions">
        <input type="number" class="input set-input-v2" value="${baseWeight}" min="0" step="0.5" inputmode="decimal" aria-label="Poids">
        <input type="number" class="input set-input-v2" value="" min="1" max="10" step="0.5" inputmode="decimal" aria-label="RPE" placeholder="10">
        <button class="btn-check-v2" style="border-color:rgba(200,149,108,0.4);color:var(--accent-warm);font-size:0.5625rem;font-weight:700;" aria-label="Valider rest-pause">RP</button>
      </div>`;
    list.appendChild(el);
    initSwipe(el, () => {
      el.remove();
      renumberRows(exId);
    });
    el.querySelector('.btn-check-v2').addEventListener('click', ev => {
      const row = el.querySelector('.swipe-content');
      const inputs = el.querySelectorAll('.set-input-v2');
      const reps = parseInt(inputs[0].value) || 0;
      const weight = parseFloat(inputs[1].value) || 0;
      const rpe = parseFloat(inputs[2].value);
      if (!reps) { showToast('Entre les reps du rest-pause', 'error'); inputs[0].focus(); return; }
      const arr = S.loggedSets[exId] || (S.loggedSets[exId] = []);
      arr.push({ n, reps, weight, rpe: isNaN(rpe) ? null : rpe, methodTag: 'restpause' });
      const btn = ev.currentTarget;
      row.classList.remove('current');
      row.classList.add('done');
      btn.classList.add('done');
      btn.textContent = '✓';
      showToast(`Rest-pause ${n} · ${reps}×${weight}kg${isNaN(rpe) ? '' : ` @${rpe}`}`, 'success', 1800);
      window.RestTimer?.start(20);
    });
  }

  // Confirmation + sauvegarde
  function confirmFinish() {
    const total = Object.values(S.loggedSets).reduce((s, a) => s + a.length, 0);
    if (total === 0) {
      showConfirm('Aucun set enregistré. Terminer quand même ?', finishSession,
        { title: 'Terminer la séance', danger: false, confirmLabel: 'Terminer quand même' });
      return;
    }
    finishSession();
  }

  async function finishSession() {
    if (!S.session) return;
    clearInterval(S.clockTimer); window.RestTimer?.stop();
    const endedAt = new Date().toISOString();
    try {
      await DB.from('sessions').update({
        ended_at: endedAt,
        notes: Object.entries(S.notes).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n') || null
      }).eq('id', S.session.id);
      const rows = Object.entries(S.loggedSets).flatMap(([exId, sets]) =>
        sets.map(s => {
          const row = { session_id: S.session.id, exercise_id: exId, set_number: s.n, reps: s.reps, weight: s.weight, is_warmup: false, created_at: new Date().toISOString() };
          if (s.rpe != null) row.rpe = s.rpe;
          return row;
        })
      );
      if (rows.length) await insertSessionRows(rows);
      showSummary(endedAt);
    } catch (err) {
      console.error('[Workouts] finishSession:', err);
      showToast('Erreur lors de la sauvegarde', 'error');
    }
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

  // Résumé de séance
  function showSummary(endedAt) {
    const dur  = Math.round((new Date(endedAt) - new Date(S.session.started_at)) / 60000);
    const sets = Object.values(S.loggedSets).reduce((s, a) => s + a.length, 0);
    const vol  = Object.values(S.loggedSets).reduce((v, a) => v + a.reduce((s, x) => s + x.reps * x.weight, 0), 0);
    const prs  = Object.keys(S.prBest).filter(exId => {
      const best = Math.max(...(S.loggedSets[exId] || []).map(s => s.weight), 0);
      return best > (S.prBest[exId] || 0);
    }).length;

    const volStr = vol >= 1000 ? (vol/1000).toFixed(1)+'t' : vol+'kg';
    document.getElementById('workouts-content').innerHTML = `
      <div style="text-align:center;padding:52px 20px 16px;">
        <div style="font-size:3rem;margin-bottom:12px;">🏆</div>
        <h2 style="font-family:var(--font-serif);font-style:italic;font-size:2rem;margin-bottom:4px;">Séance terminée !</h2>
        <p class="text-dim" style="margin-bottom:24px;">${S.routine.name}</p>
        <div class="stat-row" style="margin-bottom:20px;">
          <div class="stat-chip"><p class="stat-chip-value">${dur}</p><p class="stat-chip-label">min</p></div>
          <div class="stat-chip"><p class="stat-chip-value">${sets}</p><p class="stat-chip-label">sets</p></div>
          <div class="stat-chip"><p class="stat-chip-value">${volStr}</p><p class="stat-chip-label">volume</p></div>
          ${prs ? `<div class="stat-chip"><p class="stat-chip-value" style="color:var(--color-gold);">${prs}🏆</p><p class="stat-chip-label">PR</p></div>` : ''}
        </div>
        <div id="session-ia-note" class="card card-accent-left" style="text-align:left;margin-bottom:20px;">
          <p style="font-size:0.75rem;color:var(--cream-dim);margin-bottom:8px;">🤖 COACH IA</p>
          <div style="display:flex;justify-content:center;padding:8px 0;"><div class="spinner"></div></div>
        </div>
        <button class="btn btn-primary btn-full btn-lg" id="btn-post-session">Retour à l'accueil</button>
      </div>`;

    document.getElementById('btn-post-session')?.addEventListener('click', () => {
      S.session = null; S.routine = null;
      hideWorkoutsTab();
      AppState.switchTab('home');
      setTimeout(init, 80);
    });
    showToast('Séance sauvegardée !', 'success');
    if (navigator.vibrate) navigator.vibrate([100, 50, 200]);
    loadSessionIANote(dur, sets, vol, prs);
  }

  function loadSessionIANote(dur, sets, vol, prs) {
    const el = document.getElementById('session-ia-note');
    if (!el) return;
    if (!window.Coach?.quickAsk) { el.style.display = 'none'; return; }
    const prompt = `Analyse en 3 phrases max: routine "${S.routine.name}", ${dur} min, ${sets} sets, ${vol}kg` +
      `${prs ? `, ${prs} PR(s)` : ''}. Donne un constat + 1 conseil pour la prochaine séance.`;
    Coach.quickAsk(prompt).then(note => {
      if (!document.getElementById('session-ia-note')) return;
      el.innerHTML = note
        ? `<p style="font-size:0.75rem;color:var(--cream-dim);margin-bottom:8px;">🤖 COACH IA</p>
           <p style="color:var(--cream);font-size:0.9rem;line-height:1.6;">${note.replace(/\n/g,'<br>')}</p>`
        : `<p style="color:var(--cream-dim);font-size:0.875rem;">Coach IA non disponible.</p>`;
    });
  }

  // Modal "Autre sport"
  function showOtherSport() {
    let m = document.getElementById('modal-other-sport');
    if (!m) {
      m = document.createElement('div');
      m.className = 'modal-backdrop'; m.id = 'modal-other-sport';
      m.innerHTML = `<div class="modal"><div class="modal-handle"></div>
        <div class="modal-header"><p class="modal-title">Autre sport</p><button class="btn btn-icon" id="close-sport">✕</button></div>
        <div class="modal-body" style="display:flex;flex-direction:column;gap:16px;">
          <div class="form-group"><label for="sport-type">Activité</label>
            <select id="sport-type" class="input">
              <option>Course à pied</option><option>Vélo</option><option>Natation</option>
              <option>Escalade</option><option>Sport collectif</option><option>Yoga / Mobilité</option><option>Autre</option>
            </select></div>
          <div class="form-group"><label for="sport-duration">Durée (minutes)</label>
            <input type="number" id="sport-duration" class="input" value="30" min="1" inputmode="numeric"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="cancel-sport">Annuler</button>
          <button class="btn btn-primary" style="flex:1;" id="save-sport">Enregistrer</button>
        </div></div>`;
      document.body.appendChild(m);
      m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); });
      document.getElementById('close-sport')?.addEventListener('click',  () => m.classList.remove('open'));
      document.getElementById('cancel-sport')?.addEventListener('click', () => m.classList.remove('open'));
      document.getElementById('save-sport')?.addEventListener('click',   saveOtherSport);
    }
    setTimeout(() => m.classList.add('open'), 10);
  }

  async function saveOtherSport() {
    const type = document.getElementById('sport-type')?.value || 'Autre';
    const dur  = parseInt(document.getElementById('sport-duration')?.value) || 0;
    if (!dur) { showToast('Indique une durée', 'error'); return; }
    const now = new Date();
    try {
      await DB.from('sessions').insert({
        user_id: DB.userId(), routine_id: null,
        started_at: new Date(now - dur * 60000).toISOString(),
        ended_at: now.toISOString(), notes: type
      });
      document.getElementById('modal-other-sport')?.classList.remove('open');
      showToast(`${type} · ${dur} min enregistrés`, 'success');
    } catch (err) {
      console.error('[Workouts] saveOtherSport:', err);
      showToast('Erreur de sauvegarde', 'error');
    }
  }

  // Démarrer une routine par id (appelé depuis routines.js)
  async function startRoutine(routineId) {
    const routines = await fetchRoutines();
    const r = routines.find(r => r.id === routineId);
    if (r) startSession(r.id, r.name);
  }

  // Init — sélection de routine
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
        card.dataset.rid = r.id;
        card.dataset.rname = r.name;
        card.innerHTML = `
          <div class="routine-top">
            <div class="routine-icon">${i === 0 ? '⭐' : '💪'}</div>
            <div style="flex:1;min-width:0;">
              <div class="routine-name-v2">${r.name}</div>
            </div>
            <button class="btn-start-pill">Démarrer</button>
          </div>`;
        card.addEventListener('click', () => startSession(r.id, r.name));
        pickerList.appendChild(card);
      });
      document.getElementById('btn-other-sport-init')?.addEventListener('click', showOtherSport);
    } catch (err) {
      console.error('[Workouts] init:', err);
      cnt.innerHTML = '<p class="text-dim" style="padding:24px;">Erreur de chargement</p>';
    }
  }

  // Restaurer l'état du tab séance au chargement (si session en cours)
  document.addEventListener('tabchange', e => { if (e.detail.tab === 'workouts') init(); });

  // Vérifier au démarrage de l'app si une séance est en cours (réouverture de page)
  async function checkActiveSession() {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await DB.from('sessions')
        .select('id, started_at, routine_id, routine:routines(name)')
        .eq('user_id', DB.userId())
        .is('ended_at', null)
        .gte('started_at', today + 'T00:00:00')
        .limit(1);
      if (data?.[0]) showWorkoutsTab();
    } catch (_) {}
  }

  return { init, startRoutine, checkActiveSession };
})();
