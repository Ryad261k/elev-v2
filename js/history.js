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
     RENDU PRINCIPAL
     ------------------------------------------ */
  async function render() {
    const cnt = document.getElementById('history-content');
    if (!cnt) return;

    cnt.innerHTML = `<div class="empty-state" style="margin-top:48px;"><div class="spinner"></div></div>`;

    try {
      const [sessions, allDates] = await Promise.all([fetchSessions(), fetchAllDates()]);

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
