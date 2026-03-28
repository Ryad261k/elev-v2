/* ============================================
   COACH.JS — Coach IA (Claude via Edge Function)
   Élev v2
   ============================================ */

window.Coach = (() => {

  const S = { messages: [], loading: false, open: false };
  const EDGE_URL = `${window.SUPABASE_URL}/functions/v1/chat`;

  function readJSON(key, fallback = null) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
    catch { return fallback; }
  }

  function sumMealMacros(meals) {
    return (meals || []).reduce((tot, meal) => {
      (meal.meal_items || []).forEach(item => {
        tot.kcal += item.calories || 0;
        tot.protein += item.protein || 0;
        tot.carbs += item.carbs || 0;
        tot.fat += item.fat || 0;
      });
      return tot;
    }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  }

  function getRoutineMeta(routineId) {
    return readJSON(`elev-routine-meta-${routineId}`, {});
  }

  async function fetchRecentSessions(limit = 30) {
    const { data } = await DB.from('sessions')
      .select('id, started_at, ended_at, routine_id, routine:routines(name), session_sets(reps,weight,is_warmup,exercise:exercises(name,muscle_group))')
      .eq('user_id', DB.userId()).not('ended_at', 'is', null)
      .order('started_at', { ascending: false }).limit(limit);
    return (data || []).map(session => {
      const workSets = (session.session_sets || []).filter(set => !set.is_warmup);
      const volume = workSets.reduce((sum, set) => sum + ((set.reps || 0) * (set.weight || 0)), 0);
      const topSet = workSets.reduce((best, set) => {
        const score = (set.weight || 0) * 1000 + (set.reps || 0);
        return !best || score > best.score
          ? { score, weight: set.weight || 0, reps: set.reps || 0, exercise: set.exercise?.name || 'Exercice' }
          : best;
      }, null);
      return {
        date: session.started_at?.slice(0, 10),
        routine: session.routine?.name || 'Autre',
        routineId: session.routine_id || null,
        duration: session.ended_at ? Math.round((new Date(session.ended_at) - new Date(session.started_at)) / 60000) : null,
        sets: workSets.length,
        volume,
        topSet: topSet ? `${topSet.exercise} ${topSet.weight}kg x ${topSet.reps}` : null,
        muscles: [...new Set(workSets.map(set => set.exercise?.muscle_group).filter(Boolean))]
      };
    });
  }

  async function fetchNutritionWindow(daysBack = 14) {
    const end = new Date();
    const start = new Date(Date.now() - (daysBack - 1) * 86400000);
    const startStr = start.toISOString().slice(0, 10);
    const { data } = await DB.from('meals')
      .select('date, meal_items(calories,protein,carbs,fat)')
      .eq('user_id', DB.userId()).gte('date', startStr)
      .order('date', { ascending: false });
    const grouped = {};
    (data || []).forEach(meal => {
      if (!grouped[meal.date]) grouped[meal.date] = [];
      grouped[meal.date].push(meal);
    });
    const days = [];
    for (let i = 0; i < daysBack; i++) {
      const date = new Date(end);
      date.setDate(end.getDate() - i);
      const key = date.toISOString().slice(0, 10);
      days.push({ date: key, ...sumMealMacros(grouped[key] || []) });
    }
    return days.reverse();
  }

  async function fetchProgramSnapshot() {
    const { data } = await DB.from('routines')
      .select('id, name, routine_exercises(id)')
      .eq('user_id', DB.userId())
      .order('created_at', { ascending: false })
      .limit(8);
    return (data || []).map(routine => {
      const meta = getRoutineMeta(routine.id);
      return {
        id: routine.id,
        name: routine.name,
        exerciseCount: routine.routine_exercises?.length || 0,
        objective: meta.objective || null,
        daysPerWeek: meta.daysPerWeek || null,
        notes: meta.notes || ''
      };
    });
  }

  function buildHeuristics(recentSessions, nutritionWindow, goals) {
    const hints = [];
    if (recentSessions.length >= 3) {
      const lastThree = recentSessions.slice(0, 3);
      const durations = lastThree.map(s => s.duration || 0);
      const avgDuration = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
      hints.push(`Durée moyenne récente: ${avgDuration} min`);
    }
    if (goals?.protein) {
      const lowProteinDays = nutritionWindow.filter(day => day.protein > 0 && day.protein < goals.protein * 0.8).length;
      if (lowProteinDays >= 3) hints.push(`Protéines sous l'objectif sur ${lowProteinDays} jour(s) récemment`);
    }
    const routineCounts = recentSessions.reduce((acc, session) => {
      acc[session.routine] = (acc[session.routine] || 0) + 1;
      return acc;
    }, {});
    const topRoutine = Object.entries(routineCounts).sort((a, b) => b[1] - a[1])[0];
    if (topRoutine) hints.push(`Routine la plus fréquente: ${topRoutine[0]} (${topRoutine[1]} séance(s))`);
    return hints;
  }

  /* ------------------------------------------
     CONTEXTE UTILISATEUR
     ------------------------------------------ */
  async function buildContext() {
    try {
      const uid = DB.userId();
      const goals = readJSON(`elev-nutrition-goals-${uid}`, null);
      const profile = readJSON(`elev-profile-${uid}`, null);
      const recentSessions = await fetchRecentSessions(30);
      const nutritionWindow = await fetchNutritionWindow(14);
      const programSnapshot = await fetchProgramSnapshot();
      const weightLogs = readJSON(`elev-weight-logs-${uid}`, []);
      const latestWeight = weightLogs?.length ? weightLogs[weightLogs.length - 1] : null;
      const heuristics = buildHeuristics(recentSessions, nutritionWindow, goals);
      const todayNutrition = nutritionWindow[nutritionWindow.length - 1] || { kcal: 0, protein: 0, carbs: 0, fat: 0 };

      return {
        profile,
        goals,
        latestWeight,
        todayNutrition,
        nutrition14d: nutritionWindow,
        recentSessions,
        activePrograms: programSnapshot,
        heuristics
      };
    } catch { return {}; }
  }

  /* ------------------------------------------
     API
     ------------------------------------------ */
  async function callClaude(userMsg) {
    S.messages.push({ role: 'user', content: userMsg });
    S.loading = true;
    renderMessages();

    try {
      const context = await buildContext();
      const resp = await fetch(EDGE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${window.SUPABASE_ANON}`,
        },
        body: JSON.stringify({
          messages: S.messages.slice(-12),
          context: JSON.stringify(context),
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }
      const { content } = await resp.json();
      S.messages.push({ role: 'assistant', content });
    } catch (err) {
      console.error('[Coach]', err);
      const isNotDeployed = err.message?.includes('404') || err.message?.includes('Failed to fetch');
      S.messages.push({
        role: 'assistant',
        content: isNotDeployed
          ? "⚙️ Le Coach IA n'est pas encore activé. Déploie la fonction Supabase `chat` et configure ta clé Anthropic."
          : "Désolé, je n'arrive pas à répondre. Réessaie dans un instant."
      });
    }

    S.loading = false;
    renderMessages();
  }

  /* ------------------------------------------
     UI — Messages
     ------------------------------------------ */
  function renderMessages() {
    const list = document.getElementById('coach-messages');
    if (!list) return;

    const msgs = S.messages.length ? S.messages : [{
      role: 'assistant',
      content: "👋 Bonjour ! Je suis ton coach IA. Pose-moi une question sur ta musculation ou ta nutrition."
    }];

    list.innerHTML = msgs.map(m => `
      <div class="coach-bubble coach-bubble-${m.role}">
        ${m.role === 'assistant' ? '<span class="coach-avatar">🤖</span>' : ''}
        <div class="coach-bubble-text">${m.content.replace(/\n/g, '<br>')}</div>
      </div>`).join('');

    if (S.loading) {
      list.insertAdjacentHTML('beforeend', `
        <div class="coach-bubble coach-bubble-assistant">
          <span class="coach-avatar">🤖</span>
          <div class="coach-bubble-text coach-typing">
            <span></span><span></span><span></span>
          </div>
        </div>`);
    }

    list.scrollTop = list.scrollHeight;
  }

  /* ------------------------------------------
     UI — Modal
     ------------------------------------------ */
  function createModal() {
    if (document.getElementById('coach-modal')) return;
    const el = document.createElement('div');
    el.id = 'coach-modal';
    el.className = 'modal-backdrop';
    el.setAttribute('aria-label', 'Coach IA');
    el.innerHTML = `
      <div class="modal" style="height:80dvh;display:flex;flex-direction:column;">
        <div class="modal-handle"></div>
        <div class="modal-header">
          <p class="modal-title">Coach IA ✨</p>
          <button class="btn btn-icon" id="coach-close" aria-label="Fermer">✕</button>
        </div>
        <div id="coach-messages" class="coach-messages"></div>
        <div class="coach-input-row">
          <input type="text" id="coach-input" class="input"
                 placeholder="Pose ta question…" autocomplete="off"
                 style="flex:1;" />
          <button class="btn btn-primary" id="coach-send" aria-label="Envoyer">→</button>
        </div>
      </div>`;
    document.body.appendChild(el);
    el.addEventListener('click', e => { if (e.target === el) close(); });
    document.getElementById('coach-close')?.addEventListener('click', close);
    document.getElementById('coach-send')?.addEventListener('click', handleSend);
    document.getElementById('coach-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    });
  }

  function handleSend() {
    if (S.loading) return;
    const input = document.getElementById('coach-input');
    const msg   = input?.value.trim();
    if (!msg) return;
    input.value = '';
    callClaude(msg);
    if (navigator.vibrate) navigator.vibrate(6);
  }

  function open() {
    createModal();
    const modal = document.getElementById('coach-modal');
    setTimeout(() => modal?.classList.add('open'), 10);
    renderMessages();
    S.open = true;
    document.getElementById('coach-input')?.focus();
  }

  function close() {
    document.getElementById('coach-modal')?.classList.remove('open');
    S.open = false;
  }

  /* ------------------------------------------
     BOUTON FLOTTANT
     ------------------------------------------ */
  function createFAB() {
    if (document.getElementById('coach-fab')) return;
    const btn = document.createElement('button');
    btn.id = 'coach-fab';
    btn.setAttribute('aria-label', 'Coach IA');
    btn.textContent = '✨';
    btn.addEventListener('click', () => { S.open ? close() : open(); if (navigator.vibrate) navigator.vibrate(8); });
    document.getElementById('app')?.appendChild(btn);
  }

  /* ------------------------------------------
     APPEL RAPIDE (sans ouvrir le chat)
     ------------------------------------------ */
  async function quickAsk(message) {
    try {
      const context = await buildContext();
      const resp = await fetch(EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${window.SUPABASE_ANON}` },
        body: JSON.stringify({ messages: [{ role: 'user', content: message }], context: JSON.stringify(context) }),
        signal: AbortSignal.timeout(12000),
      });
      if (!resp.ok) return null;
      const { content } = await resp.json();
      return content || null;
    } catch (_) { return null; }
  }

  /* ------------------------------------------
     NOTIFICATIONS PROACTIVES
     ------------------------------------------ */
  async function checkProactiveNotifications() {
    try {
      const uid = DB.userId();
      const today = new Date().toISOString().slice(0, 10);
      const lastKey = `elev-coach-notif-${uid}-${today}`;
      if (localStorage.getItem(lastKey)) return; // déjà envoyée aujourd'hui

      const context = await buildContext();
      const { recentSessions, todayNutrition, goals, heuristics } = context;

      const tips = [];

      // Pas de séance depuis > 3 jours
      if (recentSessions?.length) {
        const lastDate = recentSessions[0]?.date;
        if (lastDate) {
          const daysSince = Math.floor((Date.now() - new Date(lastDate)) / 86400000);
          if (daysSince >= 3) tips.push(`💪 Tu n'as pas fait de séance depuis ${daysSince} jours. Petite relance ?`);
        }
      }

      // Calories trop basses (< 60% objectif)
      if (goals?.kcal && todayNutrition?.kcal > 0 && todayNutrition.kcal < goals.kcal * 0.6) {
        tips.push(`🥗 Tu es à ${todayNutrition.kcal} kcal aujourd'hui — moins de 60% de ton objectif. Pense à manger !`);
      }

      // Protéines insuffisantes
      if (goals?.protein) {
        const prot = todayNutrition?.protein || 0;
        if (prot > 0 && prot < goals.protein * 0.7) {
          tips.push(`🥩 Protéines du jour : ${Math.round(prot)}g / ${goals.protein}g. Rajoute une source de protéines !`);
        }
      }

      if (heuristics?.length) {
        heuristics.slice(0, 2).forEach(hint => tips.push(`📌 ${hint}`));
      }

      if (!tips.length) return;
      localStorage.setItem(lastKey, '1');

      // Affiche après 3s (laisser l'app se charger)
      setTimeout(() => {
        tips.forEach((tip, i) => {
          setTimeout(() => showNotifBubble(tip), i * 4000);
        });
      }, 3000);
    } catch (_) {}
  }

  function showNotifBubble(msg) {
    const el = document.createElement('div');
    el.style.cssText = `
      position:fixed;bottom:90px;left:50%;transform:translateX(-50%);
      max-width:320px;width:calc(100% - 40px);
      background:var(--bg-card);border:1px solid var(--border);
      border-radius:14px;padding:14px 16px;
      box-shadow:0 4px 20px rgba(0,0,0,0.15);
      z-index:250;display:flex;align-items:flex-start;gap:10px;
      animation:slideUp 300ms ease-out forwards;
    `;
    el.innerHTML = `
      <span style="font-size:1.25rem;flex-shrink:0;">✨</span>
      <p style="font-size:0.875rem;color:var(--cream);line-height:1.4;flex:1;">${msg}</p>
      <button style="background:none;border:none;color:var(--cream-dim);cursor:pointer;padding:0;font-size:1rem;flex-shrink:0;" aria-label="Fermer">✕</button>
    `;
    el.querySelector('button').addEventListener('click', () => el.remove());
    document.body.appendChild(el);
    setTimeout(() => { el.style.animation = 'slideDown 300ms ease-in forwards'; el.addEventListener('animationend', () => el.remove(), { once: true }); }, 6000);
  }

  /* ------------------------------------------
     RAPPORT HEBDOMADAIRE (dimanche)
     ------------------------------------------ */
  async function checkWeeklyReport() {
    try {
      const uid = DB.userId();
      const now = new Date();
      if (now.getDay() !== 0) return; // uniquement le dimanche
      const weekKey = `elev-weekly-report-${uid}-${now.toISOString().slice(0, 10)}`;
      if (localStorage.getItem(weekKey)) return;

      const context = await buildContext();
      const prompt = `Tu es le coach IA de l'app ÉLEV. Génère un bilan hebdomadaire court (4–6 lignes) en français. Données : ${JSON.stringify(context)}. Format :
📊 Bilan de la semaine
• [point fort]
• [point fort]
⚡ À améliorer
• [axe d'amélioration]
💡 [conseil pratique pour la semaine suivante]`;

      const resp = await fetch(EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${window.SUPABASE_ANON}` },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], context: JSON.stringify(context) }),
        signal: AbortSignal.timeout(20000),
      });
      if (!resp.ok) return;
      const { content } = await resp.json();
      if (!content) return;

      localStorage.setItem(weekKey, '1');
      // Stocke le rapport pour le chat
      S.messages.unshift({ role: 'assistant', content: `📋 **Rapport de la semaine**\n\n${content}` });

      // Notif visuelle
      setTimeout(() => showNotifBubble('📋 Ton bilan de la semaine est prêt — ouvre le Coach IA pour le voir !'), 5000);
    } catch (_) {}
  }

  function init() {
    createFAB();
    // Notifications proactives après 5s (app chargée)
    setTimeout(checkProactiveNotifications, 5000);
    // Rapport hebdo après 8s
    setTimeout(checkWeeklyReport, 8000);
  }

  return { init, open, close, quickAsk };

})();
