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

  /* ── Avatar (localStorage) ──────────────── */
  function avatarKey() { return `elev-avatar-${DB.userId()}`; }

  function getAvatar() {
    try { return localStorage.getItem(avatarKey()); } catch { return null; }
  }

  function handleAvatarUpload(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 200;
        const ratio = Math.min(MAX / img.width, MAX / img.height);
        canvas.width  = Math.round(img.width  * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const b64 = canvas.toDataURL('image/jpeg', 0.8);
        localStorage.setItem(avatarKey(), b64);
        const avatarEl = document.getElementById('profile-avatar-img');
        if (avatarEl) { avatarEl.src = b64; avatarEl.style.display = 'block'; }
        const placeholderEl = document.getElementById('profile-avatar-placeholder');
        if (placeholderEl) placeholderEl.style.display = 'none';
        showToast('Photo mise à jour ✓', 'success');
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
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
    const name  = ob?.prenom || email.split('@')[0].split(/[._]/)[0];
    const avatar = getAvatar();

    body.innerHTML = `
      <!-- Identité -->
      <div class="card" style="text-align:center;padding:24px 16px;">
        <div style="position:relative;width:72px;height:72px;margin:0 auto 12px;cursor:pointer;" id="avatar-wrapper">
          <div style="width:72px;height:72px;border-radius:50%;background:var(--accent-primary-soft);
            display:flex;align-items:center;justify-content:center;font-size:2rem;overflow:hidden;"
            id="profile-avatar-placeholder"${avatar ? ' style="display:none;"' : ''}>👤</div>
          <img id="profile-avatar-img" src="${avatar || ''}"
            style="width:72px;height:72px;border-radius:50%;object-fit:cover;position:absolute;top:0;left:0;${avatar ? '' : 'display:none;'}"
            alt="Avatar">
          <div style="position:absolute;bottom:0;right:0;width:24px;height:24px;border-radius:50%;
            background:var(--accent-primary);display:flex;align-items:center;justify-content:center;
            font-size:0.75rem;color:#fff;">📷</div>
          <input type="file" id="avatar-upload-input" accept="image/*" style="display:none;" capture="user">
        </div>
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

    // Bindings avatar
    const avatarWrapper = body.querySelector('#avatar-wrapper');
    const avatarInput   = body.querySelector('#avatar-upload-input');
    avatarWrapper?.addEventListener('click', () => avatarInput?.click());
    avatarInput?.addEventListener('change', e => {
      const file = e.target.files?.[0];
      if (file) handleAvatarUpload(file);
    });

    // Bindings
    body.querySelector('#btn-export-csv').addEventListener('click', downloadCSV);
    body.querySelector('#btn-export-json').addEventListener('click', downloadJSON);
    body.querySelector('#btn-reset-onboarding').addEventListener('click', () => {
      showConfirm('Réinitialiser ton profil et recommencer l\'onboarding ?', () => {
        localStorage.removeItem(`elev-onboarding-done-${uid}`);
        modal.classList.remove('open');
        setTimeout(() => { if (window.Onboarding) Onboarding.show(); }, 300);
      }, { title: 'Réinitialiser le profil', danger: true, confirmLabel: 'Réinitialiser' });
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
