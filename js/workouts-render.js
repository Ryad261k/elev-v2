/* ============================================
   WORKOUTS-RENDER.JS — Rendu session en cours
   Élev v2
   (workouts.js doit être chargé avant)
   ============================================ */

window.WorkoutsRender = (() => {

  // Accès au state et helpers partagés (workouts.js chargé en premier)
  const S = () => window.Workouts._S;
  const M = () => window.Workouts._methods;

  /* ---- Session principale ---- */
  async function renderSession(exercises) {
    const s       = S();
    const cnt     = document.getElementById('workouts-content');
    const started = new Date(s.session.started_at);

    cnt.innerHTML = `
      <div class="wo-session-top">
        <div class="wo-session-header">
          <button class="wo-back-btn" id="btn-other-sport" aria-label="Autre sport">−</button>
          <div>
            <p class="wo-routine-label">${s.routine.name.toUpperCase()}</p>
            <h2 class="wo-session-title">En cours...</h2>
          </div>
        </div>
        <div class="wo-timer-card">
          <div>
            <div class="wo-timer-val" id="session-elapsed-val">0:00</div>
            <div class="wo-timer-sub">Durée séance</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <button class="wo-pause-btn" id="btn-pause-session">⏸ Pause</button>
            <button class="wo-finish-btn" id="btn-finish">Fin</button>
          </div>
        </div>
        <span style="display:none;" id="session-elapsed">0 min</span>
      </div>
      <div id="exercises-list" style="padding:12px 16px 100px;"></div>`;

    const list = document.getElementById('exercises-list');
    for (let i = 0; i < exercises.length; i++) {
      const re   = exercises[i];
      const prev = await M().fetchPrevSets(re.exercise.id);
      if (prev.length) s.prBest[re.exercise.id] = Math.max(...prev.map(p => p.weight || 0));
      list.insertAdjacentHTML('beforeend', buildExerciseCard(re, prev, i));
    }

    // Mettre à jour les hints superset/giantset (les noms sont dans le DOM)
    exercises.forEach((re, idx) => {
      const method = s.methods[re.exercise.id] || 'normal';
      if (method === 'superset' || method === 'giantset') {
        const hint = document.getElementById(`method-hint-${re.exercise.id}`);
        if (hint) {
          const sliceEnd  = idx + (method === 'giantset' ? 3 : 2);
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
      for (let i = 1; i <= re.sets; i++) WorkoutsSets.appendSetRow(re.exercise.id, i, re.reps, re.weight, i === re.sets);
    });

    // Chronomètre
    clearInterval(s.clockTimer);
    s._paused = false; s._pauseOffset = 0;
    s.clockTimer = setInterval(() => {
      if (s._paused) return;
      const el    = document.getElementById('session-elapsed');
      const valEl = document.getElementById('session-elapsed-val');
      if (!el && !valEl) { clearInterval(s.clockTimer); return; }
      const elapsed = Date.now() - started - (s._pauseOffset || 0);
      const mins = Math.floor(elapsed / 60000);
      const secs = Math.floor((elapsed % 60000) / 1000);
      if (el)    el.textContent    = `${mins} min`;
      if (valEl) valEl.textContent = `${mins}:${String(secs).padStart(2, '0')}`;
    }, 1000);

    document.getElementById('btn-pause-session')?.addEventListener('click', () => {
      const btn = document.getElementById('btn-pause-session');
      if (!btn) return;
      if (s._paused) {
        s._pauseOffset = (s._pauseOffset || 0) + (Date.now() - s._pauseStart);
        s._paused = false;
        btn.innerHTML = '⏸ Pause';
      } else {
        s._paused = true; s._pauseStart = Date.now();
        btn.innerHTML = '▶ Reprendre';
      }
    });

    list.addEventListener('click', e => {
      const addBtn  = e.target.closest('[data-add-set]');
      const noteBtn = e.target.closest('[data-note-btn]');
      if (addBtn) {
        const exId = addBtn.dataset.addSet;
        const n    = document.getElementById(`sets-${exId}`).children.length + 1;
        WorkoutsSets.appendSetRow(exId, n, parseFloat(addBtn.dataset.reps), parseFloat(addBtn.dataset.weight));
      }
      if (noteBtn) {
        const area = document.getElementById(`note-${noteBtn.dataset.noteBtn}`);
        if (area) area.style.display = area.style.display === 'none' ? 'block' : 'none';
      }
    });
    list.addEventListener('input', e => { const nf = e.target.dataset.noteFor; if (nf) s.notes[nf] = e.target.value; });
    document.getElementById('btn-finish')?.addEventListener('click',      WorkoutsSets.confirmFinish);
    document.getElementById('btn-other-sport')?.addEventListener('click', WorkoutsSets.showOtherSport);
  }

  /* ---- Carte d'exercice ---- */
  function buildExerciseCard(re, prevSets, exIdx) {
    const s      = S();
    const ex     = re.exercise;
    const wu     = M().calcWarmup(re.weight);
    const method = s.methods[ex.id] || 'normal';
    const cfg    = window.Workouts.getMethodConfig(method);

    // Store prev sets in state for appendSetRow
    s.prevSetData = s.prevSetData || {};
    s.prevSetData[ex.id] = prevSets;

    const muscleChip = ex.muscle_group
      ? `<span class="wo-muscle-chip">${ex.muscle_group}</span>` : '';
    const wuText = wu.length ? wu.map(w => `${w.w}kg×${w.reps}`).join(' · ') : '';

    let methodHintHTML = '';
    if (method === 'superset' || method === 'giantset') {
      const idx   = s.exerciseOrder.indexOf(ex.id);
      const nextIds = idx !== -1 ? s.exerciseOrder.slice(idx + 1, idx + (method === 'giantset' ? 3 : 2)) : [];
      const nextNames = nextIds.map(id => document.getElementById(`card-title-${id}`)?.textContent || '…');
      const label = method === 'giantset' ? `🔥 Enchaîne avec → ${nextNames.join(' • ') || '…'}` : `⚡ Enchaîne avec → ${nextNames[0] || '…'}`;
      methodHintHTML = `<div id="method-hint-${ex.id}" style="padding:0 16px 10px;"><span class="method-badge method-${method}">${label}</span></div>`;
    } else if (cfg.hint) {
      methodHintHTML = `<div style="padding:0 16px 10px;"><span class="method-badge method-${method}">${cfg.hint}</span></div>`;
    }

    return `
      <div class="exercise-card-v2" data-ex-card="${ex.id}">
        <div class="exercise-header-v2">
          <div style="display:flex;align-items:center;flex:1;min-width:0;gap:10px;">
            <div class="exercise-num-v2">${(exIdx || 0) + 1}</div>
            <p style="font-weight:600;color:var(--cream);font-size:0.9375rem;flex:1;min-width:0;" id="card-title-${ex.id}">${ex.name}</p>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
            ${muscleChip}
            <button class="btn btn-icon" data-note-btn="${ex.id}" aria-label="Note" style="font-size:1rem;">📝</button>
          </div>
        </div>
        ${wuText ? `<div class="wo-warmup-strip">🔥 Échauffement : ${wuText}</div>` : ''}
        <div id="note-${ex.id}" style="display:none;padding:0 16px 10px;">
          <textarea class="input" rows="2" placeholder="Note…" data-note-for="${ex.id}" style="font-size:0.875rem;"></textarea>
        </div>
        <div class="sets-table-v2">
          <div class="sets-header-v2">
            <span style="text-align:center;">#</span>
            <span style="text-align:center;">Poids</span>
            <span style="text-align:center;">Reps</span>
            <span style="text-align:center;">Préc.</span>
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

  return { renderSession, buildExerciseCard };
})();
