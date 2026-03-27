/* ============================================
   STATS.JS — Progression 1RM + Volume par muscle
   Rendu dans #stats-content (onglet Historique)
   Élev v2
   ============================================ */

window.Stats = (() => {

  /* ── Données ─────────────────────────────── */
  async function fetchAllSets() {
    const { data: sessions } = await DB.from('sessions')
      .select('id, started_at').eq('user_id', DB.userId()).not('ended_at', 'is', null);
    if (!sessions?.length) return [];
    const ids = sessions.map(s => s.id);
    const dateMap = Object.fromEntries(sessions.map(s => [s.id, s.started_at.slice(0, 10)]));
    const { data } = await DB.from('session_sets')
      .select('session_id, exercise_id, reps, weight, exercise:exercises(name, muscle_group)')
      .in('session_id', ids).eq('is_warmup', false).gt('weight', 0);
    return (data || []).map(s => ({ ...s, date: dateMap[s.session_id] }));
  }

  /* ── Calculs ─────────────────────────────── */
  function epley(w, r) { return Math.round(w * (1 + r / 30)); }

  function calcVolumeByMuscle(sets) {
    const vol = {};
    sets.forEach(s => {
      const m = s.exercise?.muscle_group || 'Autre';
      vol[m]  = (vol[m] || 0) + (s.reps || 0) * (s.weight || 0);
    });
    return Object.entries(vol).sort((a, b) => b[1] - a[1]);
  }

  function getExercises(sets) {
    const byId = {};
    sets.forEach(s => {
      if (!byId[s.exercise_id]) byId[s.exercise_id] = s.exercise?.name || `Ex. ${s.exercise_id}`;
    });
    return Object.entries(byId).sort((a, b) => a[1].localeCompare(b[1]));
  }

  function calc1RMHistory(sets, exerciseId) {
    const filtered = sets.filter(s => s.exercise_id === exerciseId);
    const byDate   = {};
    filtered.forEach(s => {
      const orm = epley(s.weight, s.reps);
      if (!byDate[s.date] || byDate[s.date] < orm) byDate[s.date] = orm;
    });
    return Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b));
  }

  /* ── Chart 1RM ───────────────────────────── */
  function render1RMChart(history) {
    if (history.length < 2) return `<p class="card-subtitle" style="text-align:center;padding:12px 0;font-size:0.8125rem;">Effectue plusieurs séances avec cet exercice pour voir la progression.</p>`;
    const W = 320, H = 110, pL = 38, pR = 10, pT = 12, pB = 24;
    const cW = W - pL - pR, cH = H - pT - pB;
    const orms = history.map(([, v]) => v);
    const minO = Math.min(...orms) - 2, maxO = Math.max(...orms) + 2, rng = maxO - minO || 1;
    const n    = history.length;
    const toX  = i => pL + (i / Math.max(n - 1, 1)) * cW;
    const toY  = v => pT + (1 - (v - minO) / rng) * cH;
    const pts  = history.map(([, v], i) => ({ x: toX(i), y: toY(v) }));
    const line = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const area = [`M ${pts[0].x.toFixed(1)},${(pT+cH).toFixed(1)}`,
      ...pts.map(p => `L ${p.x.toFixed(1)},${p.y.toFixed(1)}`),
      `L ${pts[n-1].x.toFixed(1)},${(pT+cH).toFixed(1)} Z`].join(' ');
    const last = pts[n - 1];
    const fmtD = d => { const p = d.split('-'); return `${parseInt(p[2])}/${parseInt(p[1])}`; };
    return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block;" aria-label="Progression 1RM">
      <line x1="${pL}" y1="${pT+cH/2}" x2="${W-pR}" y2="${pT+cH/2}" stroke="var(--border)" stroke-width="1" stroke-dasharray="4 4"/>
      <line x1="${pL}" y1="${pT}" x2="${pL}" y2="${pT+cH}" stroke="var(--border)" stroke-width="1"/>
      <line x1="${pL}" y1="${pT+cH}" x2="${W-pR}" y2="${pT+cH}" stroke="var(--border)" stroke-width="1"/>
      <path d="${area}" fill="var(--accent)" opacity="0.1"/>
      <polyline points="${line}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="5" fill="var(--accent)" stroke="var(--bg-card)" stroke-width="2"/>
      <text x="${pL-4}" y="${pT+4}" text-anchor="end" font-size="9" fill="var(--cream-dim)" font-family="sans-serif">${maxO}kg</text>
      <text x="${pL-4}" y="${pT+cH}" text-anchor="end" font-size="9" fill="var(--cream-dim)" font-family="sans-serif">${minO}kg</text>
      <text x="${pts[0].x.toFixed(1)}" y="${pT+cH+14}" text-anchor="middle" font-size="9" fill="var(--cream-dim)" font-family="sans-serif">${fmtD(history[0][0])}</text>
      <text x="${last.x.toFixed(1)}" y="${pT+cH+14}" text-anchor="middle" font-size="9" fill="var(--cream-dim)" font-family="sans-serif">${fmtD(history[n-1][0])}</text>
    </svg>`;
  }

  /* ── Rendu principal ─────────────────────── */
  async function render() {
    const cnt = document.getElementById('stats-content');
    if (!cnt) return;
    try {
      const allSets = await fetchAllSets();
      if (!allSets.length) { cnt.innerHTML = ''; return; }

      const volMuscle = calcVolumeByMuscle(allSets);
      const exercises = getExercises(allSets);
      let selectedId  = exercises[0]?.[0];

      function renderInner() {
        const hist    = selectedId ? calc1RMHistory(allSets, selectedId) : [];
        const selName = exercises.find(([id]) => id === selectedId)?.[1] || '';
        cnt.innerHTML = `
          <!-- Volume par groupe musculaire -->
          <div class="card" style="margin-bottom:16px;">
            <div class="section-header" style="margin-bottom:8px;">
              <h2 class="section-title">Volume par muscle</h2>
              <span class="card-subtitle">Toutes séances</span>
            </div>
            ${volMuscle.slice(0, 8).map(([name, vol]) => {
              const pct = (vol / (volMuscle[0][1] || 1) * 100).toFixed(1);
              return `<div style="margin-bottom:8px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                  <span style="font-size:0.8125rem;color:var(--cream);">${name}</span>
                  <span style="font-size:0.8125rem;color:var(--cream-dim);">${vol>=1000?(vol/1000).toFixed(1)+'t':Math.round(vol)+'kg'}</span>
                </div>
                <div class="progress-bar" style="height:6px;">
                  <div style="height:100%;width:${pct}%;background:var(--accent);border-radius:3px;"></div>
                </div>
              </div>`;
            }).join('')}
          </div>

          <!-- Progression 1RM -->
          <div class="card" style="margin-bottom:16px;">
            <div class="section-header" style="margin-bottom:8px;">
              <h2 class="section-title">Progression 1RM</h2>
              <span class="card-subtitle">Epley estimé</span>
            </div>
            <select id="stats-ex-select" class="input" style="margin-bottom:12px;height:44px;">
              ${exercises.map(([id, name]) => `<option value="${id}"${id === selectedId ? ' selected' : ''}>${name}</option>`).join('')}
            </select>
            ${selName ? `<p style="font-size:0.8125rem;color:var(--cream-dim);margin-bottom:8px;">${selName}</p>` : ''}
            ${render1RMChart(hist)}
          </div>`;

        cnt.querySelector('#stats-ex-select')?.addEventListener('change', e => {
          selectedId = e.target.value;
          renderInner();
        });
      }
      renderInner();
    } catch (err) {
      console.error('[Stats]', err);
      cnt.innerHTML = '';
    }
  }

  function init() { render(); }

  document.addEventListener('tabchange', e => { if (e.detail.tab === 'history') init(); });

  return { init };

})();
