/* ============================================
   HOME.JS — Résumé du jour (accueil)
   Élev v2
   ============================================ */

window.HomeTab = (() => {

  const PHRASES = [
    'Chaque série compte.',
    'Tu es plus fort qu\'hier.',
    'La régularité bat l\'intensité.',
    'Un jour à la fois.',
    'La progression est dans la constance.',
    'Fais-le maintenant.',
    'Le corps suit l\'esprit.',
    'Chaque rep te rapproche.',
    'Ta meilleure séance reste à venir.',
    'Progrès, pas perfection.',
  ];
  let phraseInterval = null;
  let phraseIdx = Math.floor(Math.random() * PHRASES.length);

  function todayStr() { return new Date().toISOString().slice(0, 10); }

  /* ── Subtitle rotatif ────────────────────── */
  function startSubtitleRotation() {
    const el = document.getElementById('home-subtitle');
    if (!el) return;
    el.textContent = PHRASES[phraseIdx];
    clearInterval(phraseInterval);
    phraseInterval = setInterval(() => {
      phraseIdx = (phraseIdx + 1) % PHRASES.length;
      el.style.opacity = '0';
      setTimeout(() => {
        el.textContent  = PHRASES[phraseIdx];
        el.style.opacity = '1';
      }, 300);
    }, 5000);
  }

  /* ── Chargement nutrition ────────────────── */
  async function fetchTodayNutrition() {
    try {
      const { data, error } = await DB.from('meals')
        .select('meal_items(calories, protein, carbs, fat)')
        .eq('user_id', DB.userId()).eq('date', todayStr());
      if (error) throw error;
      return (data || []).reduce((t, m) => {
        (m.meal_items || []).forEach(it => {
          t.kcal    += it.calories || 0;
          t.protein += it.protein  || 0;
          t.carbs   += it.carbs    || 0;
          t.fat     += it.fat      || 0;
        });
        return t;
      }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });
    } catch (_) { return { kcal: 0, protein: 0, carbs: 0, fat: 0 }; }
  }

  /* ── Chargement séance du jour ───────────── */
  async function fetchTodaySession() {
    try {
      const { data } = await DB.from('sessions')
        .select('id, started_at, ended_at, routine:routines(name), session_sets(reps, weight, is_warmup)')
        .eq('user_id', DB.userId())
        .gte('started_at', todayStr() + 'T00:00:00')
        .lte('started_at', todayStr() + 'T23:59:59')
        .order('started_at', { ascending: false })
        .limit(1);
      return data?.[0] || null;
    } catch (_) { return null; }
  }

  /* ── Stats activité ──────────────────────── */
  async function fetchActivityStats() {
    try {
      const { data } = await DB.from('sessions')
        .select('started_at')
        .eq('user_id', DB.userId())
        .not('ended_at', 'is', null);
      const allDates = [...new Set((data || []).map(s => s.started_at.slice(0, 10)))].sort();
      const now   = new Date();

      // Séances cette semaine
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      const monStr  = monday.toISOString().slice(0, 10);
      const weekCount = allDates.filter(d => d >= monStr).length;

      // Jours actifs ce mois
      const monthStr  = todayStr().slice(0, 7);
      const monthCount = allDates.filter(d => d.startsWith(monthStr)).length;

      // Streak courant
      let streak = 0;
      let check = todayStr();
      for (let i = allDates.length - 1; i >= 0; i--) {
        if (allDates[i] === check) { streak++; const d = new Date(check + 'T12:00:00'); d.setDate(d.getDate() - 1); check = d.toISOString().slice(0, 10); }
        else if (allDates[i] < check) break;
      }

      return { weekCount, monthCount, streak };
    } catch (_) { return { weekCount: 0, monthCount: 0, streak: 0 }; }
  }

  /* ── Rendu nutrition ─────────────────────── */
  function renderNutrition(tot) {
    const goals = loadGoals();
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = Math.round(v); };

    set('home-kcal',    tot.kcal);
    set('home-protein', tot.protein);
    set('home-carbs',   tot.carbs);
    set('home-fat',     tot.fat);

    // Goal kcal
    const goalEl = document.getElementById('home-goal-kcal');
    if (goalEl) goalEl.textContent = goals.kcal;

    // Remaining kcal
    const rem = Math.max(0, goals.kcal - Math.round(tot.kcal));
    const remNum = document.getElementById('home-kcal-remaining-num');
    if (remNum) remNum.textContent = rem.toLocaleString('fr-FR');
    const remEl = document.getElementById('home-kcal-remaining');
    if (remEl) remEl.textContent = rem.toLocaleString('fr-FR') + ' kcal restantes';

    // Calorie donut ring (circ = 2π×35 ≈ 220)
    const RING_CIRC = 220;
    const ringEl = document.getElementById('home-cal-ring-fill');
    if (ringEl) {
      const pct = Math.min(tot.kcal / (goals.kcal || 1), 1);
      ringEl.setAttribute('stroke-dashoffset', (RING_CIRC * (1 - pct)).toFixed(1));
    }

    // Macro bars (width %)
    const macroBar = (id, v, g) => {
      const el = document.getElementById(id);
      if (el) el.style.width = Math.min(Math.round(v / (g || 1) * 100), 100) + '%';
    };
    macroBar('home-macro-prot-bar', tot.protein, goals.protein);
    macroBar('home-macro-gluc-bar', tot.carbs,   goals.carbs);
    macroBar('home-macro-lip-bar',  tot.fat,     goals.fat);

    // Legacy mini-rings compat
    const CIRC = 100.5;
    const macroRing = (id, v, g) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.setAttribute('stroke-dashoffset', (CIRC * (1 - Math.min(v / (g || 1), 1))).toFixed(1));
    };
    macroRing('home-carbs-ring',   tot.carbs,   goals.carbs);
    macroRing('home-protein-ring', tot.protein, goals.protein);
    macroRing('home-fat-ring',     tot.fat,     goals.fat);

    const pctEl = document.getElementById('home-kcal-pct');
    if (pctEl) pctEl.textContent = Math.min(Math.round(tot.kcal / (goals.kcal || 1) * 100), 100) + '%';
  }

  function loadGoals() {
    try {
      const g = JSON.parse(localStorage.getItem(`elev-nutrition-goals-${DB.userId()}`) || 'null');
      if (g) return g;
    } catch (_) {}
    return { kcal: 2400, protein: 180, carbs: 240, fat: 80 };
  }

  /* ── Poids sur l'accueil ─────────────────── */
  function renderWeightWidget() {
    const uid = window.AppState?.user?.id || 'local';
    const logs = (() => { try { return JSON.parse(localStorage.getItem(`elev-weight-logs-${uid}`) || '[]'); } catch { return []; } })();

    const valEl = document.getElementById('home-weight-value');
    if (!valEl) return;

    if (!logs.length) { valEl.textContent = '—'; return; }

    const last = logs[logs.length - 1];
    valEl.textContent = last.value.toFixed(1) + ' kg';
  }

  /* ── Prochaine séance ────────────────────── */
  async function fetchNextRoutine() {
    try {
      const { data } = await DB.from('routines')
        .select('id, name, routine_exercises(exercise:exercises(muscle_group))')
        .eq('user_id', DB.userId())
        .order('created_at', { ascending: false })
        .limit(5);
      if (!data?.length) return null;
      const today = todayStr();
      const { data: todaySess } = await DB.from('sessions')
        .select('routine_id')
        .eq('user_id', DB.userId())
        .gte('started_at', today + 'T00:00:00')
        .lte('started_at', today + 'T23:59:59');
      const doneIds = new Set((todaySess || []).map(s => s.routine_id));
      return data.find(r => !doneIds.has(r.id)) || data[0];
    } catch { return null; }
  }

  function renderNextSession(routine) {
    const section = document.getElementById('home-next-session-section');
    const card = document.getElementById('home-next-session-card');
    if (!section || !card) return;
    if (!routine) { section.style.display = 'none'; return; }
    section.style.display = '';
    const muscles = [...new Set((routine.routine_exercises || [])
      .map(e => e.exercise?.muscle_group).filter(Boolean))];
    const exCount = routine.routine_exercises?.length || 0;
    card.innerHTML = `
      <div class="seance-top">
        <div>
          <div class="seance-name">${routine.name}</div>
          <div class="seance-meta">${exCount} exercice${exCount > 1 ? 's' : ''}</div>
        </div>
      </div>
      ${muscles.length ? `<div class="seance-exercises">
        ${muscles.slice(0, 4).map(m => `
          <div class="seance-ex-row">
            <div class="seance-ex-left"><div class="seance-ex-dot"></div><span class="seance-ex-name">${m}</span></div>
          </div>`).join('')}
      </div>` : ''}`;
  }

  /* ── Rendu séance ────────────────────────── */
  function renderSession(session) {
    const card = document.getElementById('home-workout-card');
    if (!card) return;
    if (!session) {
      card.innerHTML = `
        <div class="home-workout-v2" onclick="HomeTab.showRoutinePickerSheet()" style="cursor:pointer;">
          <div class="home-workout-v2-left">
            <div class="home-workout-tag">Prochain entraînement</div>
            <div class="home-workout-name">Aucune séance</div>
            <div class="home-workout-meta">Lance une routine pour commencer</div>
          </div>
          <button class="home-workout-arrow" onclick="event.stopPropagation();HomeTab.showRoutinePickerSheet()">→</button>
        </div>`;
      return;
    }
    const name  = session.routine?.name || 'Autre activité';
    const sets  = (session.session_sets || []).filter(s => !s.is_warmup).length;
    const vol   = (session.session_sets || []).filter(s => !s.is_warmup)
                    .reduce((v, s) => v + (s.reps || 0) * (s.weight || 0), 0);
    const start = new Date(session.started_at);
    const dur   = session.ended_at
      ? Math.round((new Date(session.ended_at) - start) / 60000)
      : Math.round((Date.now() - start) / 60000);
    const isActive = !session.ended_at;
    card.innerHTML = `
      <div class="home-workout-v2" onclick="AppState && AppState.switchTab('workouts')" style="cursor:pointer;">
        <div class="home-workout-v2-left">
          <div class="home-workout-tag">${isActive ? '🔄 En cours' : '✓ Terminée'}</div>
          <div class="home-workout-name">${name}</div>
          <div class="home-workout-meta">${start.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})} · ${sets} sets · ${vol >= 1000 ? (vol/1000).toFixed(1)+'t' : vol+' kg'}</div>
        </div>
        <div class="home-workout-arrow-pill">${dur} min</div>
      </div>`;
  }

  /* ── Rendu activité (semaine/mois) + streak ── */
  function renderActivity(stats) {
    const weekEl  = document.getElementById('home-week-count');
    const monthEl = document.getElementById('home-month-count');
    if (weekEl)  weekEl.textContent  = stats.weekCount;
    if (monthEl) monthEl.textContent = stats.monthCount;

    // Streak badge
    if (stats.streak > 0) {
      const badge = document.getElementById('home-streak-badge');
      const count = document.getElementById('home-streak-count');
      if (badge && count) {
        count.textContent = `${stats.streak} jour${stats.streak > 1 ? 's' : ''} consécutif${stats.streak > 1 ? 's' : ''}`;
        badge.style.display = 'inline-flex';
      }
    }
  }

  /* ── Skeleton ────────────────────────────── */
  function showSkeletonHome() {
    const workoutCard = document.getElementById('home-workout-card');
    if (workoutCard) {
      workoutCard.innerHTML = `
        <div class="home-workout-v2" style="opacity:0.6;">
          <div class="home-workout-v2-left">
            <div class="skeleton skeleton-line" style="width:55%;margin-bottom:8px;height:10px;border-radius:6px;"></div>
            <div class="skeleton skeleton-line" style="width:40%;height:20px;border-radius:6px;margin-bottom:6px;"></div>
            <div class="skeleton skeleton-line-sm" style="width:70%;height:10px;border-radius:6px;"></div>
          </div>
        </div>`;
    }
  }

  /* ── Bottom sheet sélection routine ─────── */
  async function showRoutinePickerSheet() {
    // Toujours recréer pour avoir la liste à jour
    document.getElementById('home-routine-sheet')?.remove();
    const sheet = document.createElement('div');
    sheet.className = 'modal-backdrop';
    sheet.id = 'home-routine-sheet';
    sheet.innerHTML = `
      <div class="modal" style="max-height:80dvh;">
        <div class="modal-handle"></div>
        <div class="modal-header">
          <p class="modal-title">Choisir une routine</p>
          <button class="btn btn-icon" id="close-routine-sheet">✕</button>
        </div>
        <div class="modal-body" id="home-routine-sheet-list">
          <div style="display:flex;justify-content:center;padding:24px 0;"><div class="spinner"></div></div>
        </div>
      </div>`;
    document.body.appendChild(sheet);

    sheet.addEventListener('click', e => { if (e.target === sheet) sheet.classList.remove('open'); });
    document.getElementById('close-routine-sheet')?.addEventListener('click', () => sheet.classList.remove('open'));

    setTimeout(() => sheet.classList.add('open'), 10);

    try {
      const { data: routines } = await DB.from('routines')
        .select('id, name').eq('user_id', DB.userId())
        .order('created_at', { ascending: false });

      const listEl = document.getElementById('home-routine-sheet-list');
      if (!listEl) return;

      if (!routines?.length) {
        listEl.innerHTML = `
          <div style="text-align:center;padding:32px 20px;">
            <p style="color:var(--cream-dim);margin-bottom:16px;">Aucune routine créée.</p>
            <button class="btn btn-primary" onclick="document.getElementById('home-routine-sheet')?.classList.remove('open');AppState.switchTab('routines')">Créer une routine</button>
          </div>`;
        return;
      }

      listEl.innerHTML = '';
      routines.forEach((r, i) => {
        const card = document.createElement('div');
        card.className = `routine-card-v2${i === 0 ? ' featured' : ''}`;
        card.style.cssText = 'margin-bottom:10px;cursor:pointer;';
        card.innerHTML = `
          <div class="routine-top">
            <div class="routine-icon">${i === 0 ? '⭐' : '💪'}</div>
            <div style="flex:1;min-width:0;">
              <div class="routine-name-v2">${r.name}</div>
            </div>
            <button class="btn-start-pill">Démarrer</button>
          </div>`;
        card.addEventListener('click', () => {
          sheet.classList.remove('open');
          if (window.Workouts) Workouts.startRoutine(r.id);
        });
        listEl.appendChild(card);
      });

      const otherBtn = document.createElement('button');
      otherBtn.className = 'btn btn-ghost btn-full';
      otherBtn.style.marginTop = '4px';
      otherBtn.textContent = 'Autre sport / activité';
      otherBtn.addEventListener('click', () => {
        sheet.classList.remove('open');
        AppState.switchTab('workouts');
        setTimeout(() => document.getElementById('btn-other-sport-init')?.click(), 400);
      });
      listEl.appendChild(otherBtn);
    } catch (err) {
      console.error('[Home] showRoutinePickerSheet:', err);
      const listEl = document.getElementById('home-routine-sheet-list');
      if (listEl) listEl.innerHTML = '<p class="text-dim" style="padding:16px;">Erreur de chargement.</p>';
    }
  }

  /* ── Refresh complet ─────────────────────── */
  async function refresh() {
    if (!DB.userId()) return;
    showSkeletonHome();
    const [tot, session, stats, routine] = await Promise.all([
      fetchTodayNutrition(), fetchTodaySession(), fetchActivityStats(), fetchNextRoutine()
    ]);
    renderNutrition(tot);
    renderSession(session);
    renderActivity(stats);
    renderWeightWidget();
    renderNextSession(routine);
  }

  function init() {
    startSubtitleRotation();
    refresh();
  }

  document.addEventListener('tabchange', e => { if (e.detail.tab === 'home') refresh(); });

  return { init, refresh, showRoutinePickerSheet };

})();
