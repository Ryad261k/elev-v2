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
    const [tot, session, stats] = await Promise.all([
      fetchTodayNutrition(), fetchTodaySession(), fetchActivityStats()
    ]);
    renderNutrition(tot);
    renderSession(session);
    renderActivity(stats);
  }

  function init() {
    startSubtitleRotation();
    refresh();
  }

  document.addEventListener('tabchange', e => { if (e.detail.tab === 'home') refresh(); });

  return { init, refresh };

})();
