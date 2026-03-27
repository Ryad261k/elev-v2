/* ============================================
   HOME.JS — Résumé du jour (accueil)
   Élev v2
   ============================================ */

window.HomeTab = (() => {

  function todayStr() { return new Date().toISOString().slice(0, 10); }

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
    } catch (_) {
      return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    }
  }

  /* ── Chargement séance du jour ───────────── */
  async function fetchTodaySession() {
    try {
      const todayStart = todayStr() + 'T00:00:00';
      const todayEnd   = todayStr() + 'T23:59:59';
      const { data } = await DB.from('sessions')
        .select('id, started_at, ended_at, routine:routines(name), session_sets(reps, weight, is_warmup)')
        .eq('user_id', DB.userId())
        .gte('started_at', todayStart)
        .lte('started_at', todayEnd)
        .order('started_at', { ascending: false })
        .limit(1);
      return data?.[0] || null;
    } catch (_) {
      return null;
    }
  }

  /* ── Rendu nutrition ─────────────────────── */
  function renderNutrition(tot) {
    const goals = loadGoals();

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = Math.round(v); };
    const bar = (id, v, g) => {
      const el = document.getElementById(id);
      if (el) el.style.width = Math.min(v / (g || 1) * 100, 100) + '%';
    };

    set('home-kcal',    tot.kcal);
    set('home-protein', tot.protein);
    set('home-carbs',   tot.carbs);
    set('home-fat',     tot.fat);

    bar('home-kcal-bar',    tot.kcal,    goals.kcal);
    bar('home-protein-bar', tot.protein, goals.protein);
    bar('home-carbs-bar',   tot.carbs,   goals.carbs);
    bar('home-fat-bar',     tot.fat,     goals.fat);

    // Mettre à jour l'objectif affiché
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

    const name   = session.routine?.name || 'Autre activité';
    const sets   = (session.session_sets || []).filter(s => !s.is_warmup).length;
    const vol    = (session.session_sets || [])
      .filter(s => !s.is_warmup)
      .reduce((v, s) => v + (s.reps || 0) * (s.weight || 0), 0);
    const inProgress = !session.ended_at;
    const start  = new Date(session.started_at);
    const dur    = session.ended_at
      ? Math.round((new Date(session.ended_at) - start) / 60000)
      : Math.round((Date.now() - start) / 60000);

    card.innerHTML = `
      <div class="flex items-center justify-between" style="margin-bottom:12px;">
        <div>
          <p style="font-weight:600;color:var(--cream);">${name}</p>
          <p class="card-subtitle">${start.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })}</p>
        </div>
        <span class="badge ${inProgress ? 'badge-accent' : 'badge-surface'}">${inProgress ? '🔄 En cours' : '✓ Terminé'}</span>
      </div>
      <div class="stat-row">
        <div class="stat-chip">
          <p class="stat-chip-value">${dur} min</p>
          <p class="stat-chip-label">Durée</p>
        </div>
        <div class="stat-chip">
          <p class="stat-chip-value">${sets}</p>
          <p class="stat-chip-label">Sets</p>
        </div>
        <div class="stat-chip">
          <p class="stat-chip-value">${vol >= 1000 ? (vol / 1000).toFixed(1) + 't' : vol + ' kg'}</p>
          <p class="stat-chip-label">Volume</p>
        </div>
      </div>`;
  }

  /* ── Refresh complet ─────────────────────── */
  async function refresh() {
    if (!DB.userId()) return;
    const [tot, session] = await Promise.all([fetchTodayNutrition(), fetchTodaySession()]);
    renderNutrition(tot);
    renderSession(session);
  }

  function init() {
    refresh();
  }

  document.addEventListener('tabchange', e => { if (e.detail.tab === 'home') refresh(); });

  return { init, refresh };

})();
