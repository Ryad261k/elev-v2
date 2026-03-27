/* ============================================
   PROFILE.JS — Page profil, stats globales, export
   Élev v2
   ============================================ */

window.Profile = (() => {

  /* ── Stats globales ──────────────────────── */
  async function fetchStats() {
    try {
      const { data: sessions } = await DB.from('sessions')
        .select('started_at, session_sets(reps, weight, is_warmup)')
        .eq('user_id', DB.userId()).not('ended_at', 'is', null);
      const dates = (sessions || []).map(s => s.started_at.slice(0, 10));
      const totalSessions = dates.length;
      const totalVol = (sessions || []).reduce((v, s) =>
        v + (s.session_sets || []).filter(x => !x.is_warmup)
          .reduce((sv, x) => sv + (x.reps || 0) * (x.weight || 0), 0), 0);

      // Streak record
      const unique = [...new Set(dates)].sort().reverse();
      let streak = 0, maxStreak = 0, cur = 0;
      for (let i = 0; i < unique.length; i++) {
        if (i === 0) { cur = 1; continue; }
        const diff = Math.round((new Date(unique[i-1]+'T12:00:00') - new Date(unique[i]+'T12:00:00')) / 86400000);
        cur = diff === 1 ? cur + 1 : 1;
        if (cur > maxStreak) maxStreak = cur;
      }
      if (unique.length) maxStreak = Math.max(maxStreak, cur);

      return { totalSessions, totalVol: Math.round(totalVol), streakRecord: maxStreak };
    } catch { return { totalSessions: 0, totalVol: 0, streakRecord: 0 }; }
  }

  /* ── Export ──────────────────────────────── */
  function downloadJSON() {
    const uid   = DB.userId();
    const keys  = Object.keys(localStorage).filter(k => k.includes(uid));
    const data  = {};
    keys.forEach(k => { try { data[k] = JSON.parse(localStorage.getItem(k)); } catch { data[k] = localStorage.getItem(k); } });
    const blob  = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a');
    a.href = url; a.download = `elev-export-${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(url);
    showToast('Export JSON téléchargé ✓', 'success');
  }

  async function downloadCSV() {
    try {
      const { data: sessions } = await DB.from('sessions')
        .select('started_at, ended_at, routine:routines(name), session_sets(set_number, reps, weight, is_warmup, exercise:exercises(name))')
        .eq('user_id', DB.userId()).not('ended_at', 'is', null)
        .order('started_at', { ascending: false });
      const rows  = [['Date', 'Routine', 'Exercice', 'Set', 'Reps', 'Poids (kg)', 'Warmup']];
      (sessions || []).forEach(s => {
        const date = s.started_at.slice(0, 10);
        const rname = s.routine?.name || 'Autre';
        (s.session_sets || []).forEach(set => {
          rows.push([date, rname, set.exercise?.name || '?', set.set_number, set.reps, set.weight, set.is_warmup ? 'oui' : 'non']);
        });
      });
      const csv  = rows.map(r => r.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `elev-seances-${new Date().toISOString().slice(0,10)}.csv`;
      a.click(); URL.revokeObjectURL(url);
      showToast('Export CSV téléchargé ✓', 'success');
    } catch { showToast('Erreur lors de l\'export', 'error'); }
  }

  /* ── Modal ───────────────────────────────── */
  async function open() {
    let modal = document.getElementById('modal-profile');
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'modal-backdrop'; modal.id = 'modal-profile';
      modal.innerHTML = `<div class="modal"><div class="modal-handle"></div>
        <div class="modal-header">
          <p class="modal-title">Mon profil</p>
          <button class="btn btn-icon" id="close-profile-modal">✕</button>
        </div>
        <div id="profile-body" style="overflow-y:auto;max-height:80dvh;padding:16px;display:flex;flex-direction:column;gap:12px;"></div>
      </div>`;
      document.body.appendChild(modal);
      modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });
      modal.querySelector('#close-profile-modal').addEventListener('click', () => modal.classList.remove('open'));
    }
    const body = document.getElementById('profile-body');
    const uid  = DB.userId();
    const ob   = JSON.parse(localStorage.getItem(`elev-profile-${uid}`) || 'null');
    const email = AppState.user?.email || '—';
    const name  = ob?.name || email.split('@')[0].split(/[._]/)[0];

    body.innerHTML = `
      <!-- Identité -->
      <div class="card" style="text-align:center;padding:24px 16px;">
        <div style="width:64px;height:64px;border-radius:50%;background:var(--accent-primary-soft);display:flex;align-items:center;justify-content:center;margin:0 auto 12px;font-size:1.75rem;">👤</div>
        <p style="font-size:1.25rem;font-weight:600;color:var(--cream);">${name.charAt(0).toUpperCase() + name.slice(1)}</p>
        <p class="card-subtitle">${email}</p>
      </div>
      <!-- Stats globales (loading) -->
      <div class="card" id="profile-stats">
        <div style="display:flex;justify-content:center;padding:16px;"><div class="spinner"></div></div>
      </div>
      <!-- Export -->
      <div class="card">
        <h2 class="section-title" style="margin-bottom:12px;">Mes données</h2>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <button class="btn btn-secondary btn-full" id="btn-export-csv">Exporter séances (CSV)</button>
          <button class="btn btn-secondary btn-full" id="btn-export-json">Exporter tout (JSON)</button>
        </div>
      </div>
      <!-- Danger -->
      <div class="card" style="border:1px solid var(--color-danger)20;">
        <h2 class="section-title" style="margin-bottom:12px;color:var(--color-danger);">Zone danger</h2>
        <button class="btn btn-full" id="btn-reset-onboarding" style="border:1.5px solid var(--color-danger);color:var(--color-danger);background:none;">
          Refaire l'onboarding
        </button>
      </div>`;

    requestAnimationFrame(() => modal.classList.add('open'));

    // Bindings
    body.querySelector('#btn-export-csv').addEventListener('click', downloadCSV);
    body.querySelector('#btn-export-json').addEventListener('click', downloadJSON);
    body.querySelector('#btn-reset-onboarding').addEventListener('click', () => {
      if (!confirm('Réinitialiser ton profil et recommencer l\'onboarding ?')) return;
      localStorage.removeItem(`elev-onboarding-done-${uid}`);
      modal.classList.remove('open');
      setTimeout(() => { if (window.Onboarding) Onboarding.show(); }, 300);
    });

    // Load stats async
    const stats = await fetchStats();
    const statsEl = document.getElementById('profile-stats');
    if (statsEl) statsEl.innerHTML = `
      <h2 class="section-title" style="margin-bottom:12px;">Statistiques</h2>
      <div class="stat-row">
        <div class="stat-chip"><p class="stat-chip-value">${stats.totalSessions}</p><p class="stat-chip-label">Séances</p></div>
        <div class="stat-chip"><p class="stat-chip-value">${stats.totalVol >= 1000 ? (stats.totalVol/1000).toFixed(0)+'t' : stats.totalVol+'kg'}</p><p class="stat-chip-label">Volume total</p></div>
        <div class="stat-chip"><p class="stat-chip-value">${stats.streakRecord}🔥</p><p class="stat-chip-label">Streak record</p></div>
      </div>`;
  }

  return { open };

})();
