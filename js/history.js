/* ============================================
   HISTORY.JS — Historique séances + stats
   Élev v2
   ============================================ */

window.History = (() => {

  /* ------------------------------------------
     SUPABASE
     ------------------------------------------ */
  async function fetchSessions() {
    const { data, error } = await DB.from('sessions')
      .select('id, started_at, ended_at, notes, routine:routines(name), session_sets(reps, weight, is_warmup)')
      .eq('user_id', DB.userId())
      .not('ended_at', 'is', null)
      .order('started_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return data || [];
  }

  async function fetchAllDates() {
    const { data } = await DB.from('sessions')
      .select('started_at')
      .eq('user_id', DB.userId())
      .not('ended_at', 'is', null);
    return (data || []).map(s => s.started_at.slice(0, 10));
  }

  /* ------------------------------------------
     CALCULS
     ------------------------------------------ */
  function workSets(session) {
    return (session.session_sets || []).filter(s => !s.is_warmup);
  }

  function sessionVolume(session) {
    return workSets(session).reduce((v, s) => v + (s.reps || 0) * (s.weight || 0), 0);
  }

  function sessionDuration(session) {
    if (!session.started_at || !session.ended_at) return null;
    return Math.round((new Date(session.ended_at) - new Date(session.started_at)) / 60000);
  }

  function calcStreak(dates) {
    if (!dates.length) return 0;
    const unique = [...new Set(dates)].sort().reverse();
    const today  = new Date().toISOString().slice(0, 10);
    const yest   = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (unique[0] !== today && unique[0] !== yest) return 0;
    let streak = 1;
    for (let i = 1; i < unique.length; i++) {
      const diff = Math.round(
        (new Date(unique[i - 1] + 'T12:00:00') - new Date(unique[i] + 'T12:00:00')) / 86400000
      );
      if (diff === 1) streak++;
      else break;
    }
    return streak;
  }

  function thisWeekCount(dates) {
    const now    = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const monStr = monday.toISOString().slice(0, 10);
    return dates.filter(d => d >= monStr).length;
  }

  /* ------------------------------------------
     FORMAT
     ------------------------------------------ */
  function fmtDuration(min) {
    if (min === null) return '—';
    if (min < 60) return `${min} min`;
    return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;
  }

  function fmtDate(iso) {
    const d    = new Date(iso);
    const today = new Date().toISOString().slice(0, 10);
    const yest  = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const date  = iso.slice(0, 10);
    if (date === today) return "Aujourd'hui";
    if (date === yest)  return 'Hier';
    const diff = Math.floor((Date.now() - d) / 86400000);
    if (diff < 7) return `Il y a ${diff} jours`;
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  function fmtTime(iso) {
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  /* ------------------------------------------
     RENDU MINI-HEATMAP (4 semaines)
     ------------------------------------------ */
  function renderHeatmap(dates) {
    const dateSet = new Set(dates);
    const cells   = [];
    const today   = new Date();
    for (let i = 27; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const str = d.toISOString().slice(0, 10);
      cells.push({ str, active: dateSet.has(str), dow: d.getDay() });
    }

    const days = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
    return `
      <div class="heatmap-grid">
        ${cells.map(c => `
          <div class="heatmap-cell ${c.active ? 'heatmap-active' : ''}"
               title="${c.str}"></div>
        `).join('')}
      </div>
      <div class="heatmap-legend">
        <span>Il y a 4 sem.</span>
        <span>Aujourd'hui</span>
      </div>`;
  }

  /* ------------------------------------------
     RENDU CARTE SESSION
     ------------------------------------------ */
  function sessionCard(s) {
    const name  = s.routine?.name || s.notes || 'Autre activité';
    const sets  = workSets(s).length;
    const vol   = sessionVolume(s);
    const dur   = sessionDuration(s);
    const isWorkout = !!s.routine;

    return `
      <div class="card history-card">
        <div class="flex items-center justify-between" style="margin-bottom:8px;">
          <div>
            <p class="list-item-title">${name}</p>
            <p class="card-subtitle">${fmtDate(s.started_at)} · ${fmtTime(s.started_at)}</p>
          </div>
          <span class="badge ${isWorkout ? 'badge-accent' : 'badge-surface'}">${isWorkout ? '💪' : '🏃'}</span>
        </div>
        ${isWorkout ? `
          <div class="stat-row">
            <div class="stat-chip">
              <p class="stat-chip-value">${fmtDuration(dur)}</p>
              <p class="stat-chip-label">Durée</p>
            </div>
            <div class="stat-chip">
              <p class="stat-chip-value">${sets}</p>
              <p class="stat-chip-label">Sets</p>
            </div>
            <div class="stat-chip">
              <p class="stat-chip-value">${vol >= 1000 ? (vol / 1000).toFixed(1) + 't' : vol + 'kg'}</p>
              <p class="stat-chip-label">Volume</p>
            </div>
          </div>` : `
          <p class="card-subtitle" style="margin-top:4px;">
            ${dur !== null ? `${dur} min` : ''}
          </p>`}
      </div>`;
  }

  /* ------------------------------------------
     PRs & VOLUME
     ------------------------------------------ */
  async function fetchAllSets() {
    const { data: sessions } = await DB.from('sessions')
      .select('id').eq('user_id', DB.userId()).not('ended_at', 'is', null);
    if (!sessions?.length) return [];
    const ids = sessions.map(s => s.id);
    const { data } = await DB.from('session_sets')
      .select('exercise_id, reps, weight, exercise:exercises(name)')
      .in('session_id', ids).eq('is_warmup', false).gt('weight', 0);
    return data || [];
  }

  async function fetchWeeklyVolumeSessions() {
    const since = new Date(Date.now() - 56 * 86400000).toISOString();
    const { data } = await DB.from('sessions')
      .select('started_at, session_sets(reps, weight, is_warmup)')
      .eq('user_id', DB.userId()).not('ended_at', 'is', null)
      .gte('started_at', since);
    return data || [];
  }

  function calcPRs(sets) {
    const byEx = {};
    sets.forEach(s => {
      const id = s.exercise_id;
      if (!byEx[id]) byEx[id] = { name: s.exercise?.name || '?', sets: [] };
      byEx[id].sets.push({ reps: s.reps || 0, weight: s.weight || 0 });
    });
    return Object.values(byEx).map(ex => {
      const maxW = Math.max(...ex.sets.map(s => s.weight));
      const best = ex.sets.filter(s => s.weight === maxW).sort((a, b) => b.reps - a.reps)[0];
      const orm  = best ? Math.round(best.weight * (1 + best.reps / 30)) : maxW;
      return { name: ex.name, maxWeight: maxW, bestReps: best?.reps || 1, orm };
    }).sort((a, b) => b.orm - a.orm).slice(0, 8);
  }

  function calcWeeklyVol(sessions) {
    const weeks = {};
    sessions.forEach(sess => {
      const d = new Date(sess.started_at);
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const key = d.toISOString().slice(0, 10);
      const vol = (sess.session_sets || [])
        .filter(s => !s.is_warmup)
        .reduce((v, s) => v + (s.reps || 0) * (s.weight || 0), 0);
      weeks[key] = (weeks[key] || 0) + vol;
    });
    const result = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - i * 7);
      const key = d.toISOString().slice(0, 10);
      result.push({ key, label: i === 0 ? 'Sem.' : `S-${i}`, vol: weeks[key] || 0 });
    }
    return result;
  }

  function renderVolChart(weeks) {
    const maxV = Math.max(...weeks.map(w => w.vol), 1);
    const W = 320, H = 110, pL = 4, pR = 4, pT = 8, pB = 24;
    const cW = W - pL - pR, cH = H - pT - pB;
    const bW = cW / weeks.length;
    return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block;" aria-label="Volume hebdo">
      ${weeks.map((w, i) => {
        const h  = Math.max((w.vol / maxV) * cH, w.vol > 0 ? 2 : 0);
        const x  = pL + i * bW + 2;
        const y  = pT + cH - h;
        return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bW - 4).toFixed(1)}" height="${h.toFixed(1)}"
                      fill="${w.vol > 0 ? 'var(--accent)' : 'var(--bg-surface)'}" rx="3"/>
                <text x="${(x + (bW - 4) / 2).toFixed(1)}" y="${H - 4}" text-anchor="middle"
                      font-size="8" fill="var(--cream-dim)" font-family="sans-serif">${w.label}</text>`;
      }).join('')}
    </svg>`;
  }

  function renderPRs(prs) {
    if (!prs.length) return '<p class="card-subtitle" style="text-align:center;padding:8px;">Lance tes premières séances pour voir tes records !</p>';
    return prs.map(p => `
      <div class="flex items-center justify-between" style="padding:8px 0;border-bottom:1px solid var(--border);">
        <div>
          <p style="font-size:0.9375rem;font-weight:500;color:var(--cream);">${p.name}</p>
          <p class="card-subtitle">${p.bestReps}×${p.maxWeight} kg</p>
        </div>
        <div style="text-align:right;">
          <p style="font-size:1.125rem;font-weight:700;color:var(--accent-primary);">${p.orm} kg</p>
          <p class="card-subtitle">1RM est.</p>
        </div>
      </div>`).join('');
  }

  /* ------------------------------------------
     SKELETON
     ------------------------------------------ */
  function showSkeleton(container) {
    container.innerHTML = `
      <div class="skeleton-card">
        <div class="skeleton skeleton-line" style="width:40%;"></div>
        <div class="skeleton skeleton-line" style="width:80%;"></div>
        <div class="skeleton skeleton-line-sm"></div>
      </div>
      <div class="skeleton-card">
        <div class="skeleton skeleton-line" style="width:55%;"></div>
        <div class="skeleton skeleton-line" style="width:90%;"></div>
        <div class="skeleton skeleton-line-sm"></div>
      </div>
      <div class="skeleton-card">
        <div class="skeleton skeleton-line" style="width:35%;"></div>
        <div class="skeleton skeleton-line" style="width:75%;"></div>
      </div>`;
  }

  /* ------------------------------------------
     RENDU PRINCIPAL
     ------------------------------------------ */
  async function render() {
    const cnt = document.getElementById('history-content');
    if (!cnt) return;

    showSkeleton(cnt);

    try {
      const [sessions, allDates, allSets, volSessions] = await Promise.all([
        fetchSessions(), fetchAllDates(), fetchAllSets(), fetchWeeklyVolumeSessions()
      ]);
      const prs   = calcPRs(allSets);
      const weeks = calcWeeklyVol(volSessions);

      const streak  = calcStreak(allDates);
      const week    = thisWeekCount(allDates);
      const total   = allDates.length;

      cnt.innerHTML = `
        <!-- Stats rapides -->
        <div class="stat-row" style="margin-bottom:16px;">
          <div class="stat-chip">
            <p class="stat-chip-value">${week}</p>
            <p class="stat-chip-label">Cette semaine</p>
          </div>
          <div class="stat-chip">
            <p class="stat-chip-value">${streak}${streak > 0 ? ' 🔥' : ''}</p>
            <p class="stat-chip-label">Jours consécutifs</p>
          </div>
          <div class="stat-chip">
            <p class="stat-chip-value">${total}</p>
            <p class="stat-chip-label">Total séances</p>
          </div>
        </div>

        <!-- Heatmap 4 semaines -->
        <div class="card" style="margin-bottom:16px;">
          <div class="section-header" style="margin-bottom:8px;">
            <h2 class="section-title">Activité</h2>
            <span class="card-subtitle">4 semaines</span>
          </div>
          ${renderHeatmap(allDates)}
        </div>

        <!-- Volume hebdo -->
        <div class="card" style="margin-bottom:16px;">
          <div class="section-header" style="margin-bottom:4px;">
            <h2 class="section-title">Volume</h2>
            <span class="card-subtitle">8 semaines</span>
          </div>
          ${renderVolChart(weeks)}
        </div>

        <!-- Records -->
        <div class="card" style="margin-bottom:16px;">
          <div class="section-header" style="margin-bottom:4px;">
            <h2 class="section-title">Records</h2>
            <span class="card-subtitle" style="color:var(--color-gold);">🏆 1RM estimé (Epley)</span>
          </div>
          ${renderPRs(prs)}
        </div>

        <!-- Liste séances -->
        <div class="section-header">
          <h2 class="section-title">Séances</h2>
          <span class="card-subtitle">${sessions.length} entrées</span>
        </div>
        ${sessions.length
          ? sessions.map(sessionCard).join('')
          : `<div class="empty-state">
               <span class="empty-state-icon">🏋️</span>
               <p class="empty-state-title">Aucune séance</p>
               <p class="empty-state-text">Lance ta première séance !</p>
             </div>`}
      `;
    } catch (err) {
      console.error('[History] render:', err);
      cnt.innerHTML = `<div class="empty-state">
        <span class="empty-state-icon">⚠️</span>
        <p class="empty-state-title">Erreur de chargement</p>
        <button class="btn btn-secondary" onclick="History.init()">Réessayer</button>
      </div>`;
    }
  }

  function init() { render(); }

  document.addEventListener('tabchange', e => { if (e.detail.tab === 'history') init(); });

  return { init };

})();
