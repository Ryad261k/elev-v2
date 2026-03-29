/* ============================================
   HISTORY.JS — Historique séances + stats
   Élev v2
   ============================================ */

window.History = (() => {

  /* ------------------------------------------
     STATE
     ------------------------------------------ */
  let _calYear  = new Date().getFullYear();
  let _calMonth = new Date().getMonth(); // 0-based

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

  function totalVolume(sessions) {
    return sessions.reduce((t, s) => t + sessionVolume(s), 0);
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
    const d     = new Date(iso);
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

  function fmtVol(v) {
    if (v >= 1000) return `${(v / 1000).toFixed(1)}t`;
    return `${v} kg`;
  }

  /* ------------------------------------------
     CALENDRIER MENSUEL
     ------------------------------------------ */
  function renderCalendar(dateSet, streak) {
    const today = new Date().toISOString().slice(0, 10);
    const year  = _calYear;
    const month = _calMonth;

    const MONTH_NAMES = [
      'Janvier','Février','Mars','Avril','Mai','Juin',
      'Juillet','Août','Septembre','Octobre','Novembre','Décembre'
    ];

    const firstDay = new Date(year, month, 1);
    const lastDay  = new Date(year, month + 1, 0);
    const totalDays = lastDay.getDate();
    // Monday-first: getDay() returns 0=Sun,1=Mon,...6=Sat → convert
    const startDow = (firstDay.getDay() + 6) % 7; // 0=Mon, 6=Sun

    const dayHeads = ['L','M','M','J','V','S','D'].map(d =>
      `<div class="hist-cal-day-head">${d}</div>`
    ).join('');

    let cells = '';
    // empty cells before first day
    for (let i = 0; i < startDow; i++) {
      cells += `<div class="hist-cal-day empty"><div class="hist-cal-day-num"></div></div>`;
    }
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const hasSess = dateSet.has(dateStr);
      const isToday = dateStr === today;
      const cls = `hist-cal-day${hasSess ? ' has-session' : ''}${isToday ? ' today' : ''}`;
      cells += `
        <div class="${cls}">
          <div class="hist-cal-day-num">${d}</div>
          ${hasSess && !isToday ? '<div class="hist-cal-dot"></div>' : ''}
        </div>`;
    }

    const streakLine = streak > 0
      ? `<div class="hist-cal-streak">🔥 Streak actuel : <strong>${streak} jour${streak > 1 ? 's' : ''}</strong></div>`
      : '';

    return `
      <div class="hist-calendar-card">
        <div class="hist-cal-nav">
          <button class="hist-cal-arrow" id="hist-cal-prev">‹</button>
          <span class="hist-cal-month">${MONTH_NAMES[month]} ${year}</span>
          <button class="hist-cal-arrow" id="hist-cal-next">›</button>
        </div>
        <div class="hist-cal-grid">
          ${dayHeads}
          ${cells}
        </div>
        ${streakLine}
      </div>`;
  }

  /* ------------------------------------------
     RECORDS
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

  /* ------------------------------------------
     SESSION CARD
     ------------------------------------------ */
  function sessionCard(s) {
    const name    = s.routine?.name || s.notes || 'Autre activité';
    const sets    = workSets(s).length;
    const vol     = sessionVolume(s);
    const dur     = sessionDuration(s);

    return `
      <div class="hist-session-card">
        <div class="hist-session-body">
          <div class="hist-session-name">${name}</div>
          <div class="hist-session-date">${fmtDate(s.started_at)} · ${fmtTime(s.started_at)}</div>
          <div class="hist-session-chips">
            ${dur !== null ? `<span class="hist-session-chip">⏱ ${fmtDuration(dur)}</span>` : ''}
            ${sets > 0 ? `<span class="hist-session-chip">🏋 ${sets} sets</span>` : ''}
            ${vol > 0   ? `<span class="hist-session-chip">📦 ${fmtVol(vol)}</span>` : ''}
          </div>
        </div>
        <span class="hist-session-arrow">›</span>
      </div>`;
  }

  /* ------------------------------------------
     SKELETON
     ------------------------------------------ */
  function showSkeleton(container) {
    container.innerHTML = `
      <div class="skeleton-card">
        <div class="skeleton skeleton-line" style="width:40%;"></div>
        <div class="skeleton skeleton-line" style="width:80%;"></div>
      </div>
      <div class="skeleton-card">
        <div class="skeleton skeleton-line" style="width:55%;"></div>
        <div class="skeleton skeleton-line" style="width:90%;"></div>
      </div>`;
  }

  /* ------------------------------------------
     RENDER PRINCIPAL
     ------------------------------------------ */
  async function render() {
    const cnt = document.getElementById('history-content');
    if (!cnt) return;

    showSkeleton(cnt);

    try {
      const [sessions, allDates, allSets] = await Promise.all([
        fetchSessions(), fetchAllDates(), fetchAllSets()
      ]);

      const dateSet  = new Set(allDates);
      const prs      = calcPRs(allSets);
      const streak   = calcStreak(allDates);
      const total    = allDates.length;
      const totVol   = totalVolume(sessions);

      const volLabel = totVol >= 1000
        ? `${(totVol / 1000).toFixed(0)} t`
        : `${totVol} kg`;

      cnt.innerHTML = `
        <!-- Header -->
        <div class="hist-header">
          <div>
            <div class="hist-eyebrow">Journal</div>
            <div class="hist-title">Historique</div>
          </div>
        </div>

        <!-- Stats globales -->
        <div class="hist-stats-row">
          <div class="hist-stat-chip coral">
            <div class="hist-stat-chip-val">${total}</div>
            <div class="hist-stat-chip-label">séances</div>
          </div>
          <div class="hist-stat-chip amber">
            <div class="hist-stat-chip-val">${streak > 0 ? '🔥 ' + streak + 'j' : '–'}</div>
            <div class="hist-stat-chip-label">streak</div>
          </div>
          <div class="hist-stat-chip blue">
            <div class="hist-stat-chip-val">${volLabel}</div>
            <div class="hist-stat-chip-label">volume total</div>
          </div>
        </div>

        <!-- Calendrier -->
        <div id="hist-cal-container">
          ${renderCalendar(dateSet, streak)}
        </div>

        <!-- Dernières séances -->
        ${sessions.length ? `
          <div class="hist-section-label" style="margin-top:16px;">Dernières séances</div>
          ${sessions.slice(0, 10).map(sessionCard).join('')}
        ` : `
          <div class="empty-state">
            <span class="empty-state-icon">🏋️</span>
            <p class="empty-state-title">Aucune séance</p>
            <p class="empty-state-text">Lance ta première séance !</p>
          </div>
        `}

        <!-- Records perso -->
        ${prs.length ? `
          <div class="hist-section-label" style="margin-top:16px;">Records personnels</div>
          <div class="hist-pr-grid" style="margin-bottom:80px;">
            ${prs.map(p => `
              <div class="hist-pr-card">
                <span class="hist-pr-icon">🏆</span>
                <div class="hist-pr-info">
                  <div class="hist-pr-name">${p.name}</div>
                  <div class="hist-pr-weight">${p.maxWeight} kg</div>
                </div>
              </div>`).join('')}
          </div>
        ` : ''}
      `;

      // Calendar navigation
      cnt.addEventListener('click', e => {
        if (e.target.id === 'hist-cal-prev') {
          _calMonth--;
          if (_calMonth < 0) { _calMonth = 11; _calYear--; }
          document.getElementById('hist-cal-container').innerHTML = renderCalendar(dateSet, streak);
        }
        if (e.target.id === 'hist-cal-next') {
          _calMonth++;
          if (_calMonth > 11) { _calMonth = 0; _calYear++; }
          document.getElementById('hist-cal-container').innerHTML = renderCalendar(dateSet, streak);
        }
      }, { once: false });

    } catch (err) {
      console.error('[History] render:', err);
      cnt.innerHTML = `<div class="empty-state">
        <span class="empty-state-icon">⚠️</span>
        <p class="empty-state-title">Erreur de chargement</p>
        <button class="btn btn-secondary" onclick="History.init()">Réessayer</button>
      </div>`;
    }
  }

  function init() {
    // Reset calendar to current month on each visit
    _calYear  = new Date().getFullYear();
    _calMonth = new Date().getMonth();
    render();
  }

  document.addEventListener('tabchange', e => { if (e.detail.tab === 'history') init(); });

  return { init };

})();
