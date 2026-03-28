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
  async function _render() {
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

  /* ── Corrélation poids / calories ───────────── */
  async function fetchDailyKcal(days) {
    const { data } = await DB.from('meals')
      .select('date, meal_items(calories)')
      .eq('user_id', DB.userId()).in('date', days);
    const byDay = {};
    (data||[]).forEach(m => {
      byDay[m.date] = (byDay[m.date]||0) + (m.meal_items||[]).reduce((s,i)=>s+(i.calories||0),0);
    });
    return byDay;
  }

  function renderCorrelationChart(weightLogs, kcalData, days) {
    const wPairs = days.map(d=>weightLogs.find(l=>l.date===d)?.value).filter(v=>v!=null);
    if (wPairs.length < 3) return '<p class="card-subtitle" style="text-align:center;padding:12px;">Pas assez de données — continue à logger ton poids !</p>';
    const W=320,H=120,pL=36,pR=36,pT=12,pB=24;
    const cW=W-pL-pR, cH=H-pT-pB, n=days.length;
    const wVals = days.map(d=>weightLogs.find(l=>l.date===d)?.value);
    const validW = wVals.filter(v=>v!=null);
    const minW=Math.min(...validW)-0.5, maxW=Math.max(...validW)+0.5, rngW=maxW-minW||1;
    const maxK = Math.max(...days.map(d=>kcalData[d]||0), 500);
    const toX = i => pL + i/(n-1)*cW;
    const toYw = v => pT + (1-(v-minW)/rngW)*cH;
    const toYk = v => pT + (1-v/maxK)*cH;
    const bW = cW/n;
    const bars = days.map((d,i) => {
      const k=kcalData[d]||0; if(!k) return '';
      const bh=Math.max(k/maxK*cH,1);
      return `<rect x="${(pL+i*bW+1).toFixed(1)}" y="${(pT+cH-bh).toFixed(1)}" width="${(bW-2).toFixed(1)}" height="${bh.toFixed(1)}" fill="var(--accent-warm)" opacity="0.35" rx="2"/>`;
    }).join('');
    const wPts = days.map((d,i)=>{const v=wVals[i];return v!=null?{x:toX(i),y:toYw(v)}:null;});
    const segments = []; let cur=[];
    wPts.forEach(p=>{if(p){cur.push(p);}else{if(cur.length>1)segments.push(cur);cur=[];}});
    if(cur.length>1)segments.push(cur);
    const lines = segments.map(seg=>`<polyline points="${seg.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
    const dots  = wPts.filter(Boolean).map(p=>`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="var(--accent)" stroke="var(--bg-card)" stroke-width="1.5"/>`).join('');
    const fmtD  = d=>`${parseInt(d.slice(8))}/${parseInt(d.slice(5,7))}`;
    return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block;" aria-label="Corrélation poids / calories">
      ${bars}${lines}${dots}
      <line x1="${pL}" y1="${pT}" x2="${pL}" y2="${pT+cH}" stroke="var(--border)" stroke-width="1"/>
      <line x1="${pL}" y1="${pT+cH}" x2="${W-pR}" y2="${pT+cH}" stroke="var(--border)" stroke-width="1"/>
      <line x1="${W-pR}" y1="${pT}" x2="${W-pR}" y2="${pT+cH}" stroke="var(--border)" stroke-width="1" stroke-dasharray="2 2"/>
      <text x="${pL-4}" y="${pT+4}" text-anchor="end" font-size="9" fill="var(--cream-dim)" font-family="sans-serif">${maxW.toFixed(1)}</text>
      <text x="${pL-4}" y="${pT+cH}" text-anchor="end" font-size="9" fill="var(--cream-dim)" font-family="sans-serif">${minW.toFixed(1)}</text>
      <text x="${W-pR+4}" y="${pT+6}" text-anchor="start" font-size="9" fill="var(--accent-warm)" font-family="sans-serif">${Math.round(maxK/1000)}k kcal</text>
      <text x="${pL}" y="${H-4}" text-anchor="middle" font-size="9" fill="var(--cream-dim)" font-family="sans-serif">${fmtD(days[0])}</text>
      <text x="${W-pR}" y="${H-4}" text-anchor="middle" font-size="9" fill="var(--cream-dim)" font-family="sans-serif">${fmtD(days[n-1])}</text>
    </svg>`;
  }

  async function renderCorrelation() {
    const cnt = document.getElementById('correlation-chart');
    if (!cnt) return;
    const uid = DB.userId();
    const allLogs = (() => { try { return JSON.parse(localStorage.getItem(`elev-weight-logs-${uid}`) || '[]'); } catch(_) { return []; } })();
    if (!allLogs.length) { cnt.innerHTML = ''; return; }
    const days = Array.from({length:30},(_,i)=>{ const d=new Date(Date.now()-(29-i)*86400000); return d.toISOString().slice(0,10); });
    try {
      const kcalData = await fetchDailyKcal(days);
      const hasKcal  = Object.values(kcalData).some(v=>v>0);
      if (!hasKcal) { cnt.innerHTML = ''; return; }
      cnt.innerHTML = `<div class="card" style="margin-top:16px;">
        <div class="section-header" style="margin-bottom:8px;">
          <h2 class="section-title">Poids vs Calories</h2>
          <span class="card-subtitle">30 derniers jours</span>
        </div>
        ${renderCorrelationChart(allLogs, kcalData, days)}
        <div class="flex gap-12" style="margin-top:8px;">
          <span style="display:flex;align-items:center;gap:4px;font-size:0.75rem;color:var(--cream-dim);">
            <svg width="16" height="4"><line x1="0" y1="2" x2="16" y2="2" stroke="var(--accent)" stroke-width="2.5"/></svg>Poids</span>
          <span style="display:flex;align-items:center;gap:4px;font-size:0.75rem;color:var(--cream-dim);">
            <svg width="16" height="10"><rect y="2" width="16" height="8" fill="var(--accent-warm)" opacity="0.5" rx="2"/></svg>Calories</span>
        </div>
      </div>`;
    } catch(_) { cnt.innerHTML = ''; }
  }

  /* ── Heatmap 52 semaines (GitHub style) ─────── */
  async function fetchAllSessionDates() {
    try {
      const { data } = await DB.from('sessions')
        .select('started_at').eq('user_id', DB.userId()).not('ended_at', 'is', null);
      return (data || []).map(s => s.started_at.slice(0, 10));
    } catch { return []; }
  }

  function renderFullHeatmap(dates) {
    const cnt = document.getElementById('stats-heatmap');
    if (!cnt) return;
    const countMap = {};
    dates.forEach(d => { countMap[d] = (countMap[d] || 0) + 1; });

    // Calcule le lundi de début (52 semaines en arrière depuis aujourd'hui)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = (today.getDay() + 6) % 7; // lundi=0
    const lastMonday = new Date(today);
    lastMonday.setDate(today.getDate() - dayOfWeek);
    const startDate = new Date(lastMonday);
    startDate.setDate(lastMonday.getDate() - 51 * 7);

    // Construit les 52 semaines × 7 jours
    const weeks = [];
    for (let w = 0; w < 52; w++) {
      const week = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + w * 7 + d);
        week.push(date.toISOString().slice(0, 10));
      }
      weeks.push(week);
    }

    // Labels des mois
    const monthLabels = [];
    let lastMonth = -1;
    weeks.forEach((week, wi) => {
      const m = parseInt(week[0].slice(5, 7));
      if (m !== lastMonth) { monthLabels.push({ wi, label: new Date(week[0]).toLocaleDateString('fr-FR', { month: 'short' }) }); lastMonth = m; }
    });

    const CELL = 11, GAP = 2, UNIT = CELL + GAP;
    const W = 52 * UNIT - GAP, H = 7 * UNIT - GAP + 18;
    const cells = weeks.map((week, wi) =>
      week.map((day, di) => {
        const n = countMap[day] || 0;
        const fill = n === 0 ? 'var(--bg-surface)' : n === 1 ? 'rgba(122,184,147,0.4)' : 'var(--accent)';
        const x = wi * UNIT, y = di * UNIT + 18;
        return `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="${fill}"><title>${day}${n ? ` · ${n} séance${n>1?'s':''}` : ''}</title></rect>`;
      }).join('')
    ).join('');
    const labels = monthLabels.map(({ wi, label }) =>
      `<text x="${wi * UNIT}" y="12" font-size="9" fill="var(--cream-dim)" font-family="sans-serif">${label}</text>`
    ).join('');

    cnt.innerHTML = `<div class="card" style="margin-top:16px;overflow-x:auto;">
      <div class="section-header" style="margin-bottom:8px;">
        <h2 class="section-title">Activité (12 mois)</h2>
        <span class="card-subtitle">${dates.length} séances</span>
      </div>
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;min-width:${W}px;display:block;" aria-label="Heatmap activité">
        ${labels}${cells}
      </svg>
      <div class="flex gap-8" style="margin-top:8px;align-items:center;">
        <span style="font-size:0.75rem;color:var(--cream-dim);">Moins</span>
        <svg width="52" height="10"><rect x="0"  y="0" width="10" height="10" rx="2" fill="var(--bg-surface)"/>
          <rect x="14" y="0" width="10" height="10" rx="2" fill="rgba(122,184,147,0.4)"/>
          <rect x="28" y="0" width="10" height="10" rx="2" fill="var(--accent)"/></svg>
        <span style="font-size:0.75rem;color:var(--cream-dim);">Plus</span>
      </div>
    </div>`;
  }

  async function renderHeatmap() {
    const dates = await fetchAllSessionDates();
    renderFullHeatmap(dates);
  }

  async function render() { await _render(); await renderCorrelation(); await renderHeatmap(); }

  function init() { render(); }

  document.addEventListener('tabchange', e => { if (e.detail.tab === 'history') init(); });

  return { init };

})();
