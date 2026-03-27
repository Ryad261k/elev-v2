/* ============================================
   WORKOUTS.JS — Séances, exercices, sets, warmup
   Élev v2
   ============================================ */

window.Workouts = (() => {

  const S = {
    session: null, routine: null,
    loggedSets: {}, notes: {},
    restTimer: null, clockTimer: null,
  };

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

  // Timer de repos avec vibration
  function startRestTimer(sec = 90) {
    clearInterval(S.restTimer);
    let rem = sec;
    const label = () => document.getElementById('rest-timer-label');
    const tick = () => {
      if (label()) { label().textContent = `Repos : ${rem}s`; label().style.display = 'inline'; }
      if (rem-- <= 0) {
        clearInterval(S.restTimer);
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        showToast("C'est reparti ! 💪", 'success');
        if (label()) label().style.display = 'none';
      }
    };
    tick();
    S.restTimer = setInterval(tick, 1000);
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
      S.loggedSets = {}; S.notes = {};
      exercises.forEach(re => { S.loggedSets[re.exercise.id] = []; });
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
    cnt.innerHTML = `
      <div class="workout-header">
        <div class="flex items-center justify-between">
          <div>
            <p class="page-header-eyebrow" style="color:var(--accent);">● En cours</p>
            <h2 class="workout-session-title">${S.routine.name}</h2>
          </div>
          <div class="flex gap-8">
            <button class="btn btn-ghost btn-sm" id="btn-other-sport">Autre sport</button>
            <button class="btn btn-danger btn-sm" id="btn-finish">Terminer</button>
          </div>
        </div>
        <div class="flex gap-12" style="margin-top:6px;">
          <span class="text-dim" id="session-elapsed" style="font-size:0.8125rem;">0 min</span>
          <span id="rest-timer-label" style="display:none;font-size:0.8125rem;font-weight:500;color:var(--accent);"></span>
        </div>
      </div>
      <div id="exercises-list"></div>`;

    const list = document.getElementById('exercises-list');
    for (const re of exercises) {
      const prev = await fetchPrevSets(re.exercise.id);
      list.insertAdjacentHTML('beforeend', buildExerciseCard(re, prev));
    }
    exercises.forEach(re => {
      for (let i = 1; i <= re.sets; i++) appendSetRow(re.exercise.id, i, re.reps, re.weight);
    });

    clearInterval(S.clockTimer);
    S.clockTimer = setInterval(() => {
      const el = document.getElementById('session-elapsed');
      if (!el) { clearInterval(S.clockTimer); return; }
      el.textContent = `${Math.floor((Date.now() - started) / 60000)} min`;
    }, 30000);

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
  function buildExerciseCard(re, prevSets) {
    const ex = re.exercise;
    const wu = calcWarmup(re.weight);
    const prevHTML = prevSets.length
      ? prevSets.map(s => `<span class="badge badge-surface">${s.reps}×${s.weight}kg</span>`).join('')
      : '<span class="workout-label" style="opacity:.5;">Première fois</span>';
    const wuHTML = wu.map(w => `<span class="badge badge-surface">${w.label} ${w.reps}×${w.w}kg</span>`).join('');
    return `
      <div class="card" style="margin-bottom:12px;">
        <div class="card-header">
          <div>
            <p class="card-title">${ex.name}</p>
            <p class="card-subtitle">${ex.muscle_group ? ex.muscle_group + ' · ' : ''}${re.sets}×${re.reps} @ ${re.weight}kg</p>
          </div>
          <button class="btn btn-icon" data-note-btn="${ex.id}" aria-label="Note" style="font-size:1rem;">📝</button>
        </div>
        <div class="workout-meta-block">
          <p class="workout-label">Dernière fois</p>
          <div class="flex gap-4" style="flex-wrap:wrap;margin-top:4px;">${prevHTML}</div>
        </div>
        ${wu.length ? `<div class="workout-meta-block"><p class="workout-label">Échauffement</p><div class="flex gap-4" style="flex-wrap:wrap;margin-top:4px;">${wuHTML}</div></div>` : ''}
        <div id="note-${ex.id}" style="display:none;margin-bottom:10px;">
          <textarea class="input" rows="2" placeholder="Note…" data-note-for="${ex.id}" style="font-size:0.875rem;"></textarea>
        </div>
        <div id="sets-${ex.id}" class="sets-list"></div>
        <button class="btn btn-secondary btn-sm btn-full" style="margin-top:8px;"
          data-add-set="${ex.id}" data-reps="${re.reps}" data-weight="${re.weight}">+ Set</button>
      </div>`;
  }

  // Ajouter une ligne de set
  function appendSetRow(exId, n, defaultReps, defaultWeight) {
    const list = document.getElementById(`sets-${exId}`);
    if (!list) return;
    const el = document.createElement('div');
    el.className = 'swipeable';
    el.innerHTML = `
      <div class="swipe-delete-bg">🗑</div>
      <div class="swipe-content set-row">
        <span class="set-num">${n}</span>
        <input type="number" class="input set-input" value="${defaultReps}" min="1" max="99" inputmode="numeric" aria-label="Répétitions">
        <span class="set-sep">×</span>
        <input type="number" class="input set-input" value="${defaultWeight}" min="0" step="0.5" inputmode="decimal" aria-label="Poids">
        <span class="set-sep">kg</span>
        <button class="check-circle" style="border:none;cursor:pointer;flex-shrink:0;" aria-label="Valider">✓</button>
      </div>`;
    list.appendChild(el);
    initSwipe(el, () => {
      el.remove();
      list.querySelectorAll('.set-num').forEach((s, i) => { s.textContent = i + 1; });
    });
    el.querySelector('.check-circle').addEventListener('click', ev => {
      const [rIn, wIn] = el.querySelectorAll('.set-input');
      const reps = parseInt(rIn.value) || 0, weight = parseFloat(wIn.value) || 0;
      const arr = S.loggedSets[exId] || (S.loggedSets[exId] = []);
      const found = arr.find(s => s.n === n);
      if (found) { found.reps = reps; found.weight = weight; }
      else arr.push({ n, reps, weight });
      ev.currentTarget.style.background = 'var(--accent)';
      ev.currentTarget.style.color = 'var(--bg-dark)';
      showToast(`Série ${n} · ${reps}×${weight}kg`, 'success', 2000);
      startRestTimer(90);
    });
  }

  // Confirmation + sauvegarde
  function confirmFinish() {
    const total = Object.values(S.loggedSets).reduce((s, a) => s + a.length, 0);
    if (total === 0 && !confirm('Aucun set enregistré. Terminer quand même ?')) return;
    finishSession();
  }

  async function finishSession() {
    if (!S.session) return;
    clearInterval(S.clockTimer); clearInterval(S.restTimer);
    const endedAt = new Date().toISOString();
    try {
      await DB.from('sessions').update({
        ended_at: endedAt,
        notes: Object.entries(S.notes).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n') || null
      }).eq('id', S.session.id);
      const rows = Object.entries(S.loggedSets).flatMap(([exId, sets]) =>
        sets.map(s => ({ session_id: S.session.id, exercise_id: exId, set_number: s.n, reps: s.reps, weight: s.weight, is_warmup: false, created_at: new Date().toISOString() }))
      );
      if (rows.length) { const { error } = await DB.from('session_sets').insert(rows); if (error) throw error; }
      showSummary(endedAt);
    } catch (err) {
      console.error('[Workouts] finishSession:', err);
      showToast('Erreur lors de la sauvegarde', 'error');
    }
  }

  // Résumé de séance
  function showSummary(endedAt) {
    const dur  = Math.round((new Date(endedAt) - new Date(S.session.started_at)) / 60000);
    const sets = Object.values(S.loggedSets).reduce((s, a) => s + a.length, 0);
    const vol  = Object.values(S.loggedSets).reduce((v, a) => v + a.reduce((s, x) => s + x.reps * x.weight, 0), 0);
    document.getElementById('workouts-content').innerHTML = `
      <div style="text-align:center;padding:40px 0;">
        <div style="font-size:3rem;margin-bottom:16px;">🏆</div>
        <h2 style="font-family:var(--font-serif);font-style:italic;font-size:2rem;margin-bottom:6px;">Séance terminée !</h2>
        <p class="text-dim" style="margin-bottom:28px;">${S.routine.name}</p>
        <div class="stat-row" style="margin-bottom:24px;">
          <div class="stat-chip"><p class="stat-chip-value">${dur}</p><p class="stat-chip-label">min</p></div>
          <div class="stat-chip"><p class="stat-chip-value">${sets}</p><p class="stat-chip-label">sets</p></div>
          <div class="stat-chip"><p class="stat-chip-value">${(vol/1000).toFixed(1)}t</p><p class="stat-chip-label">volume</p></div>
        </div>
        <button class="btn btn-primary btn-full btn-lg" id="btn-post-session">Retour à l'accueil</button>
      </div>`;
    document.getElementById('btn-post-session')?.addEventListener('click', () => {
      S.session = null; S.routine = null; AppState.switchTab('home'); setTimeout(init, 80);
    });
    showToast('Séance sauvegardée !', 'success');
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

  // Init — sélection de routine
  async function init() {
    if (S.session) return;
    const cnt = document.getElementById('workouts-content');
    if (!cnt) return;
    cnt.innerHTML = '<div class="workout-spinner"><div class="spinner spinner-lg"></div></div>';
    try {
      const routines = await fetchRoutines();
      if (!routines.length) {
        cnt.innerHTML = `<div class="empty-state" style="margin-top:48px;">
          <span class="empty-state-icon">📋</span>
          <p class="empty-state-title">Aucune routine</p>
          <p class="empty-state-text">Crée une routine dans l'onglet Routines</p>
          <button class="btn btn-primary btn-lg" style="margin-top:16px;"
            onclick="AppState.switchTab('routines')">Créer une routine</button></div>`;
        return;
      }
      cnt.innerHTML = `
        <div class="section-header"><h2 class="section-title">Choisir une routine</h2></div>
        ${routines.map(r => `
          <div class="list-item pressable" data-rid="${r.id}" data-rname="${r.name}">
            <div class="list-item-icon">💪</div>
            <div class="list-item-content"><p class="list-item-title">${r.name}</p></div>
            <span class="list-item-right">›</span>
          </div>`).join('')}
        <div style="margin-top:16px;">
          <button class="btn btn-ghost btn-full" id="btn-other-sport-init">Autre sport / activité</button>
        </div>`;
      cnt.querySelectorAll('[data-rid]').forEach(el =>
        el.addEventListener('click', () => startSession(el.dataset.rid, el.dataset.rname))
      );
      document.getElementById('btn-other-sport-init')?.addEventListener('click', showOtherSport);
    } catch (err) {
      console.error('[Workouts] init:', err);
      cnt.innerHTML = '<p class="text-dim" style="padding:24px;">Erreur de chargement</p>';
    }
  }

  document.addEventListener('tabchange', e => { if (e.detail.tab === 'workouts') init(); });

  return { init };

})();
