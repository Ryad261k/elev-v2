/* ============================================
   WORKOUTS-SETS.JS — Sets, fin de séance, résumé, autre sport
   Élev v2
   (workouts.js doit être chargé avant)
   ============================================ */

window.WorkoutsSets = (() => {

  const S = () => window.Workouts._S;
  const M = () => window.Workouts._methods;

  /* ---- Ligne de set standard ---- */
  function appendSetRow(exId, n, defaultReps, defaultWeight, isLast) {
    const list   = document.getElementById(`sets-${exId}`);
    if (!list) return;
    const method      = S().methods[exId] || 'normal';
    const isAmrapLast = isLast && method === 'amrap';
    const baseReps    = M().getDefaultReps(method, defaultReps);
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

    M().initSwipe(el, () => { el.remove(); M().renumberRows(exId); });

    el.querySelector('.btn-check-v2').addEventListener('click', ev => {
      const inputs  = el.querySelectorAll('.set-input-v2');
      const rIn = inputs[0], wIn = inputs[1], rpeIn = inputs[2];
      const reps    = parseInt(rIn.value) || 0;
      const weight  = parseFloat(wIn.value) || 0;
      const rpe     = parseFloat(rpeIn.value);

      if (isAmrapLast && !reps) { showToast('Entre le nombre de répétitions max', 'error'); rIn.focus(); return; }
      if (!isNaN(rpe) && (rpe < 1 || rpe > 10)) { showToast('Le RPE doit être entre 1 et 10', 'error'); rpeIn.focus(); return; }

      const s   = S();
      const arr = s.loggedSets[exId] || (s.loggedSets[exId] = []);
      const found = arr.find(item => item.n === n);
      if (found) { found.reps = reps; found.weight = weight; found.rpe = isNaN(rpe) ? null : rpe; }
      else arr.push({ n, reps, weight, rpe: isNaN(rpe) ? null : rpe, methodTag: method });

      const prevBest = s.prBest[exId];
      const isPR     = prevBest !== undefined && weight > prevBest;
      if (weight > (s.prBest[exId] || 0)) s.prBest[exId] = weight;

      const row = el.querySelector('.swipe-content');
      const btn = ev.currentTarget;
      row.classList.remove('current');
      row.classList.add('done');

      if (isPR) {
        btn.textContent = '🏆';
        btn.classList.add('done');
        btn.style.background   = 'var(--color-gold,#f5a623)';
        btn.style.borderColor  = 'var(--color-gold,#f5a623)';
        showToast(`🏆 Nouveau record ! ${weight} kg`, 'success', 3500);
        if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
      } else {
        btn.classList.add('done');
        btn.textContent = '✓';
        showToast(`Série ${n} · ${reps}×${weight}kg${isNaN(rpe) ? '' : ` @${rpe}`}`, 'success', 1800);
      }
      window.RestTimer?.start(window.Workouts.getMethodConfig(method).rest);

      if (isLast && method === 'dropset') {
        const dropWeight = Math.round((weight * 0.8) / 2.5) * 2.5;
        appendDropSetRow(exId, list.children.length + 1, dropWeight);
      }
      if (isLast && method === 'restpause') appendRestPauseRow(exId, list.children.length + 1, weight);
    });
  }

  /* ---- Drop set ---- */
  function appendDropSetRow(exId, n, dropWeight) {
    const list = document.getElementById(`sets-${exId}`);
    if (!list || list.querySelector('.drop-set-row')) return;
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
    M().initSwipe(el, () => { el.remove(); M().renumberRows(exId); });
    el.querySelector('.btn-check-v2').addEventListener('click', ev => {
      const inputs = el.querySelectorAll('.set-input-v2');
      const reps   = parseInt(inputs[0].value) || 0;
      const weight = parseFloat(inputs[1].value) || 0;
      const rpe    = parseFloat(inputs[2].value);
      if (!reps) { showToast('Entre le nombre de répétitions max pour le drop set', 'error'); inputs[0].focus(); return; }
      const arr = S().loggedSets[exId] || (S().loggedSets[exId] = []);
      arr.push({ n, reps, weight, rpe: isNaN(rpe) ? null : rpe, methodTag: 'dropset' });
      const row = el.querySelector('.swipe-content'); row.classList.remove('current'); row.classList.add('done');
      const btn = ev.currentTarget; btn.classList.add('done'); btn.textContent = '✓';
      showToast(`Drop set ${n} · ${reps}×${weight}kg${isNaN(rpe) ? '' : ` @${rpe}`}`, 'success', 1800);
      window.RestTimer?.start(90);
    });
  }

  /* ---- Rest-pause ---- */
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
    M().initSwipe(el, () => { el.remove(); M().renumberRows(exId); });
    el.querySelector('.btn-check-v2').addEventListener('click', ev => {
      const inputs = el.querySelectorAll('.set-input-v2');
      const reps   = parseInt(inputs[0].value) || 0;
      const weight = parseFloat(inputs[1].value) || 0;
      const rpe    = parseFloat(inputs[2].value);
      if (!reps) { showToast('Entre les reps du rest-pause', 'error'); inputs[0].focus(); return; }
      const arr = S().loggedSets[exId] || (S().loggedSets[exId] = []);
      arr.push({ n, reps, weight, rpe: isNaN(rpe) ? null : rpe, methodTag: 'restpause' });
      const row = el.querySelector('.swipe-content'); row.classList.remove('current'); row.classList.add('done');
      const btn = ev.currentTarget; btn.classList.add('done'); btn.textContent = '✓';
      showToast(`Rest-pause ${n} · ${reps}×${weight}kg${isNaN(rpe) ? '' : ` @${rpe}`}`, 'success', 1800);
      window.RestTimer?.start(20);
    });
  }

  /* ---- Fin de séance ---- */
  function confirmFinish() {
    const total = Object.values(S().loggedSets).reduce((s, a) => s + a.length, 0);
    if (total === 0) {
      showConfirm('Aucun set enregistré. Terminer quand même ?', finishSession,
        { title: 'Terminer la séance', danger: false, confirmLabel: 'Terminer quand même' });
      return;
    }
    finishSession();
  }

  async function finishSession() {
    const s = S();
    if (!s.session) return;
    clearInterval(s.clockTimer);
    window.RestTimer?.stop();
    const endedAt = new Date().toISOString();
    try {
      await DB.from('sessions').update({
        ended_at: endedAt,
        notes: Object.entries(s.notes).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n') || null,
      }).eq('id', s.session.id);

      const rows = Object.entries(s.loggedSets).flatMap(([exId, sets]) =>
        sets.map(set => {
          const row = { session_id: s.session.id, exercise_id: exId, set_number: set.n, reps: set.reps, weight: set.weight, is_warmup: false, created_at: new Date().toISOString() };
          if (set.rpe != null) row.rpe = set.rpe;
          return row;
        })
      );
      if (rows.length) await window.Workouts.insertSessionRows(rows);
      showSummary(endedAt);
    } catch (err) {
      console.error('[Workouts] finishSession:', err);
      showToast('Erreur lors de la sauvegarde', 'error');
    }
  }

  /* ---- Résumé post-séance ---- */
  function showSummary(endedAt) {
    const s    = S();
    const dur  = Math.round((new Date(endedAt) - new Date(s.session.started_at)) / 60000);
    const sets = Object.values(s.loggedSets).reduce((acc, a) => acc + a.length, 0);
    const vol  = Object.values(s.loggedSets).reduce((acc, a) => acc + a.reduce((sv, x) => sv + x.reps * x.weight, 0), 0);
    const prs  = Object.keys(s.prBest).filter(exId => {
      const best = Math.max(...(s.loggedSets[exId] || []).map(set => set.weight), 0);
      return best > (s.prBest[exId] || 0);
    }).length;
    const volStr = vol >= 1000 ? (vol / 1000).toFixed(1) + 't' : vol + 'kg';

    document.getElementById('workouts-content').innerHTML = `
      <div style="text-align:center;padding:52px 20px 16px;">
        <div style="font-size:3rem;margin-bottom:12px;">🏆</div>
        <h2 style="font-family:var(--font-serif);font-style:italic;font-size:2rem;margin-bottom:4px;">Séance terminée !</h2>
        <p class="text-dim" style="margin-bottom:24px;">${s.routine.name}</p>
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
      s.session = null; s.routine = null;
      M().hideWorkoutsTab();
      AppState.switchTab('home');
      setTimeout(window.Workouts.init, 80);
    });
    showToast('Séance sauvegardée !', 'success');
    if (navigator.vibrate) navigator.vibrate([100, 50, 200]);
    loadSessionIANote(dur, sets, vol, prs);
  }

  function loadSessionIANote(dur, sets, vol, prs) {
    const el = document.getElementById('session-ia-note');
    if (!el) return;
    if (!window.Coach?.quickAsk) { el.style.display = 'none'; return; }
    const routineName = S().routine?.name || '';
    const prompt = `Analyse en 3 phrases max: routine "${routineName}", ${dur} min, ${sets} sets, ${vol}kg` +
      `${prs ? `, ${prs} PR(s)` : ''}. Donne un constat + 1 conseil pour la prochaine séance.`;
    Coach.quickAsk(prompt).then(note => {
      if (!document.getElementById('session-ia-note')) return;
      el.innerHTML = note
        ? `<p style="font-size:0.75rem;color:var(--cream-dim);margin-bottom:8px;">🤖 COACH IA</p>
           <p style="color:var(--cream);font-size:0.9rem;line-height:1.6;">${note.replace(/\n/g, '<br>')}</p>`
        : `<p style="color:var(--cream-dim);font-size:0.875rem;">Coach IA non disponible.</p>`;
    });
  }

  /* ---- Autre sport ---- */
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
        ended_at: now.toISOString(), notes: type,
      });
      document.getElementById('modal-other-sport')?.classList.remove('open');
      showToast(`${type} · ${dur} min enregistrés`, 'success');
    } catch (err) {
      console.error('[Workouts] saveOtherSport:', err);
      showToast('Erreur de sauvegarde', 'error');
    }
  }

  return { appendSetRow, appendDropSetRow, appendRestPauseRow, confirmFinish, showOtherSport };
})();
