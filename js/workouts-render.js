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
    const totalEx = exercises.length;

    cnt.innerHTML = `
      <div style="padding:52px 20px 16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <div>
            <p style="font-size:0.6875rem;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--accent);margin-bottom:4px;">En cours</p>
            <h2 style="font-family:var(--font-serif);font-style:italic;font-size:1.5rem;color:var(--cream);">${s.routine.name}</h2>
          </div>
          <div style="background:rgba(122,184,147,0.12);border:1px solid rgba(122,184,147,0.22);border-radius:100px;padding:8px 14px;text-align:center;flex-shrink:0;">
            <div style="font-family:var(--font-serif);font-style:italic;font-size:1.25rem;color:var(--accent);line-height:1;" id="session-elapsed-val">0:00</div>
            <div style="font-size:0.5625rem;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:var(--accent);opacity:0.7;margin-top:2px;">Durée</div>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="font-size:0.6875rem;color:var(--cream-dim);" id="session-progress-label">${totalEx} exercice${totalEx > 1 ? 's' : ''}</span>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-ghost btn-sm" id="btn-other-sport"  style="font-size:0.75rem;padding:5px 10px;">Autre sport</button>
            <button class="btn btn-danger btn-sm" id="btn-finish"       style="font-size:0.75rem;padding:5px 10px;">Terminer</button>
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
    s.clockTimer = setInterval(() => {
      const el    = document.getElementById('session-elapsed');
      const valEl = document.getElementById('session-elapsed-val');
      if (!el && !valEl) { clearInterval(s.clockTimer); return; }
      const mins = Math.floor((Date.now() - started) / 60000);
      const secs = Math.floor(((Date.now() - started) % 60000) / 1000);
      if (el)    el.textContent    = `${mins} min`;
      if (valEl) valEl.textContent = `${mins}:${String(secs).padStart(2, '0')}`;
    }, 1000);

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
    const s         = S();
    const ex        = re.exercise;
    const wu        = M().calcWarmup(re.weight);
    const method    = s.methods[ex.id] || 'normal';
    const cfg       = window.Workouts.getMethodConfig(method);
    const ML        = { amrap:'🔁 AMRAP', dropset:'📉 DROP SET', superset:'⚡ SUPERSET', restpause:'⏱ REST-PAUSE', tempo:'🎵 TEMPO', htfr:'🏋 HTFR', giantset:'🔥 GIANT SET' };

    const prevBestWeight = s.prBest[ex.id] || (prevSets.length ? Math.max(...prevSets.map(p => p.weight || 0)) : 0);
    const prBadge  = prevBestWeight > 0
      ? `<span class="pr-badge">🏅 PR ${prevBestWeight} kg</span>`
      : '';
    const prevHTML = prevSets.length
      ? prevSets.map(p => `<span class="badge badge-surface">${p.reps}×${p.weight}kg${p.rpe ? ` @${p.rpe}` : ''}</span>`).join('')
      : '<span style="font-size:0.75rem;color:var(--cream-dim);opacity:.6;">Première fois</span>';
    const wuHTML   = wu.map(w => `<span class="badge badge-surface">${w.label} ${w.reps}×${w.w}kg</span>`).join('');
    const methodBadge = method !== 'normal' ? `<span class="method-badge method-${method}">${ML[method]}</span>` : '';

    let methodHintHTML = '';
    if (method === 'superset' || method === 'giantset') {
      const idx      = s.exerciseOrder.indexOf(ex.id);
      const nextIds  = idx !== -1 ? s.exerciseOrder.slice(idx + 1, idx + (method === 'giantset' ? 3 : 2)) : [];
      const nextNames = nextIds.map(id => document.getElementById(`card-title-${id}`)?.textContent || '…');
      const label    = method === 'giantset' ? `🔥 Enchaîne avec → ${nextNames.join(' • ') || '…'}` : `⚡ Enchaîne avec → ${nextNames[0] || '…'}`;
      methodHintHTML = `<div id="method-hint-${ex.id}" style="padding:0 16px 10px;"><span class="method-badge method-${method}">${label}</span></div>`;
    } else if (cfg.hint) {
      methodHintHTML = `<div style="padding:0 16px 10px;"><span class="method-badge method-${method}">${cfg.hint}</span></div>`;
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
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
            ${prBadge}
            <button class="btn btn-icon" data-note-btn="${ex.id}" aria-label="Note" style="font-size:1rem;">📝</button>
          </div>
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

  return { renderSession, buildExerciseCard };
})();
