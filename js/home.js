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
      const dates = (data || []).map(s => s.started_at.slice(0, 10));
      const now   = new Date();

      // Séances cette semaine
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      const monStr  = monday.toISOString().slice(0, 10);
      const weekCount = dates.filter(d => d >= monStr).length;

      // Jours actifs ce mois
      const monthStr  = todayStr().slice(0, 7);
      const monthCount = [...new Set(dates.filter(d => d.startsWith(monthStr)))].length;

      return { weekCount, monthCount };
    } catch (_) { return { weekCount: 0, monthCount: 0 }; }
  }

  /* ── Rendu nutrition ─────────────────────── */
  function renderNutrition(tot) {
    const goals = loadGoals();
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = Math.round(v); };
    const bar = (id, v, g) => { const el = document.getElementById(id); if (el) el.style.width = Math.min(v / (g || 1) * 100, 100) + '%'; };

    set('home-kcal',    tot.kcal);
    set('home-protein', tot.protein);
    set('home-carbs',   tot.carbs);
    set('home-fat',     tot.fat);

    bar('home-kcal-bar',    tot.kcal,    goals.kcal);
    bar('home-protein-bar', tot.protein, goals.protein);
    bar('home-carbs-bar',   tot.carbs,   goals.carbs);
    bar('home-fat-bar',     tot.fat,     goals.fat);

    const goalEl = document.querySelector('[data-goal-kcal]');
    if (goalEl) goalEl.textContent = goals.kcal.toLocaleString('fr-FR') + ' kcal';
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
    const section = document.getElementById('home-weight-section');
    if (!section) return;
    if (!logs.length) { section.style.display = 'none'; return; }
    section.style.display = '';
    const last = logs[logs.length - 1];
    const prev = logs.length > 1 ? logs[logs.length - 2] : null;
    const monthStart = logs.find(l => l.date.slice(0, 7) === new Date().toISOString().slice(0, 7));

    const valEl = document.getElementById('home-weight-value');
    const dayEl = document.getElementById('home-weight-delta-day');
    const monEl = document.getElementById('home-weight-delta-month');

    if (valEl) valEl.textContent = last.value.toFixed(1) + ' kg';
    if (dayEl && prev) {
      const d = (last.value - prev.value).toFixed(1);
      dayEl.textContent = d > 0 ? `↑ ${d} kg vs hier` : d < 0 ? `↓ ${Math.abs(d)} kg vs hier` : '= stable vs hier';
      dayEl.style.color = d > 0 ? 'var(--color-danger)' : d < 0 ? 'var(--accent)' : 'var(--cream-dim)';
    }
    if (monEl && monthStart && monthStart !== last) {
      const dm = (last.value - monthStart.value).toFixed(1);
      monEl.textContent = dm > 0 ? `↑ ${dm} kg ce mois` : dm < 0 ? `↓ ${Math.abs(dm)} kg ce mois` : '= stable ce mois';
      monEl.style.color = dm > 0 ? 'var(--color-danger)' : dm < 0 ? 'var(--accent)' : 'var(--cream-dim)';
    }
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
      <div style="margin-bottom:10px;">
        <p style="font-size:1.125rem;font-weight:600;color:var(--cream);">${routine.name}</p>
        <p class="card-subtitle">${exCount} exercice${exCount > 1 ? 's' : ''}</p>
      </div>
      ${muscles.length ? `<div style="display:flex;flex-wrap:wrap;gap:6px;">
        ${muscles.slice(0, 5).map(m => `<span class="badge badge-surface" style="font-size:0.6875rem;text-transform:uppercase;letter-spacing:0.05em;">${m}</span>`).join('')}
      </div>` : ''}`;
  }

  /* ── Rendu séance ────────────────────────── */
  function renderSession(session) {
    const card = document.getElementById('home-workout-card');
    if (!card) return;
    if (!session) {
      card.innerHTML = `
        <div class="empty-state" style="padding:24px 0;">
          <span class="empty-state-icon">💪</span>
          <p class="empty-state-title">Aucune séance aujourd'hui</p>
          <p class="empty-state-text">Lance une routine pour commencer</p>
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
    card.innerHTML = `
      <div class="flex items-center justify-between" style="margin-bottom:12px;">
        <div>
          <p style="font-weight:600;color:var(--cream);">${name}</p>
          <p class="card-subtitle">${start.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</p>
        </div>
        <span class="badge ${!session.ended_at ? 'badge-accent' : 'badge-surface'}">${!session.ended_at ? '🔄 En cours' : '✓ Terminé'}</span>
      </div>
      <div class="stat-row">
        <div class="stat-chip"><p class="stat-chip-value">${dur} min</p><p class="stat-chip-label">Durée</p></div>
        <div class="stat-chip"><p class="stat-chip-value">${sets}</p><p class="stat-chip-label">Sets</p></div>
        <div class="stat-chip"><p class="stat-chip-value">${vol >= 1000 ? (vol/1000).toFixed(1)+'t' : vol+' kg'}</p><p class="stat-chip-label">Volume</p></div>
      </div>`;
  }

  /* ── Rendu activité (semaine/mois) ───────── */
  function renderActivity(stats) {
    const weekEl  = document.getElementById('home-week-count');
    const monthEl = document.getElementById('home-month-count');
    if (weekEl)  weekEl.textContent  = stats.weekCount;
    if (monthEl) monthEl.textContent = stats.monthCount;
  }

  /* ── Refresh complet ─────────────────────── */
  async function refresh() {
    if (!DB.userId()) return;
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

  return { init, refresh };

})();
