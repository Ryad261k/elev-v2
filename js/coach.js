/* ============================================
   COACH.JS — Coach IA (Claude via Edge Function)
   Élev v2
   ============================================ */

window.Coach = (() => {

  const S        = { messages: [], loading: false, open: false };
  const EDGE_URL = `${window.SUPABASE_URL}/functions/v1/chat`;

  function readJSON(key, fallback = null) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
    catch { return fallback; }
  }

  /* ── Context helpers ──────────────────────── */
  function sumMealMacros(meals) {
    return (meals || []).reduce((tot, meal) => {
      (meal.meal_items || []).forEach(item => {
        tot.kcal += item.calories || 0; tot.protein += item.protein || 0;
        tot.carbs += item.carbs || 0;   tot.fat += item.fat || 0;
      });
      return tot;
    }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  }

  function getRoutineMeta(routineId) { return readJSON(`elev-routine-meta-${routineId}`, {}); }

  async function fetchRecentSessions(limit = 30) {
    const { data } = await DB.from('sessions')
      .select('id, started_at, ended_at, routine_id, routine:routines(name), session_sets(reps,weight,is_warmup,exercise:exercises(name,muscle_group))')
      .eq('user_id', DB.userId()).not('ended_at', 'is', null)
      .order('started_at', { ascending: false }).limit(limit);
    return (data || []).map(session => {
      const workSets = (session.session_sets || []).filter(set => !set.is_warmup);
      const volume   = workSets.reduce((sum, set) => sum + ((set.reps || 0) * (set.weight || 0)), 0);
      const topSet   = workSets.reduce((best, set) => {
        const score = (set.weight || 0) * 1000 + (set.reps || 0);
        return !best || score > best.score ? { score, weight: set.weight || 0, reps: set.reps || 0, exercise: set.exercise?.name || 'Exercice' } : best;
      }, null);
      return {
        date: session.started_at?.slice(0, 10),
        routine: session.routine?.name || 'Autre',
        routineId: session.routine_id || null,
        duration: session.ended_at ? Math.round((new Date(session.ended_at) - new Date(session.started_at)) / 60000) : null,
        sets: workSets.length, volume,
        topSet: topSet ? `${topSet.exercise} ${topSet.weight}kg x ${topSet.reps}` : null,
        muscles: [...new Set(workSets.map(set => set.exercise?.muscle_group).filter(Boolean))],
      };
    });
  }

  async function fetchNutritionWindow(daysBack = 14) {
    const end = new Date();
    const startStr = new Date(Date.now() - (daysBack - 1) * 86400000).toISOString().slice(0, 10);
    const { data } = await DB.from('meals').select('date, meal_items(calories,protein,carbs,fat)')
      .eq('user_id', DB.userId()).gte('date', startStr).order('date', { ascending: false });
    const grouped = {};
    (data || []).forEach(meal => { if (!grouped[meal.date]) grouped[meal.date] = []; grouped[meal.date].push(meal); });
    const days = [];
    for (let i = 0; i < daysBack; i++) {
      const d = new Date(end); d.setDate(end.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ date: key, ...sumMealMacros(grouped[key] || []) });
    }
    return days.reverse();
  }

  async function fetchProgramSnapshot() {
    const { data } = await DB.from('routines').select('id, name, routine_exercises(id)')
      .eq('user_id', DB.userId()).order('created_at', { ascending: false }).limit(8);
    return (data || []).map(routine => {
      const meta = getRoutineMeta(routine.id);
      return { id: routine.id, name: routine.name, exerciseCount: routine.routine_exercises?.length || 0,
        objective: meta.objective || null, daysPerWeek: meta.daysPerWeek || null, notes: meta.notes || '' };
    });
  }

  function buildHeuristics(recentSessions, nutritionWindow, goals) {
    const hints = [];
    if (recentSessions.length >= 3) {
      const durations = recentSessions.slice(0, 3).map(s => s.duration || 0);
      hints.push(`Durée moyenne récente: ${Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)} min`);
    }
    if (goals?.protein) {
      const lowDays = nutritionWindow.filter(day => day.protein > 0 && day.protein < goals.protein * 0.8).length;
      if (lowDays >= 3) hints.push(`Protéines sous l'objectif sur ${lowDays} jour(s) récemment`);
    }
    const routineCounts = recentSessions.reduce((acc, s) => { acc[s.routine] = (acc[s.routine] || 0) + 1; return acc; }, {});
    const top = Object.entries(routineCounts).sort((a, b) => b[1] - a[1])[0];
    if (top) hints.push(`Routine la plus fréquente: ${top[0]} (${top[1]} séance(s))`);
    return hints;
  }

  async function buildContext() {
    try {
      const uid              = DB.userId();
      const goals            = readJSON(`elev-nutrition-goals-${uid}`, null);
      const profile          = readJSON(`elev-profile-${uid}`, null);
      const recentSessions   = await fetchRecentSessions(30);
      const nutritionWindow  = await fetchNutritionWindow(14);
      const programSnapshot  = await fetchProgramSnapshot();
      const weightLogs       = readJSON(`elev-weight-logs-${uid}`, []);
      const latestWeight     = weightLogs?.length ? weightLogs[weightLogs.length - 1] : null;
      const heuristics       = buildHeuristics(recentSessions, nutritionWindow, goals);
      const todayNutrition   = nutritionWindow[nutritionWindow.length - 1] || { kcal: 0, protein: 0, carbs: 0, fat: 0 };
      return { profile, goals, latestWeight, todayNutrition, nutrition14d: nutritionWindow, recentSessions, activePrograms: programSnapshot, heuristics };
    } catch { return {}; }
  }

  /* ── API ───────────────────────────────────── */
  async function callClaude(userMsg) {
    S.messages.push({ role: 'user', content: userMsg });
    S.loading = true;
    CoachUI.renderMessages();
    try {
      const context = await buildContext();
      const resp = await fetch(EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${window.SUPABASE_ANON}` },
        body: JSON.stringify({ messages: S.messages.slice(-12), context: JSON.stringify(context) }),
      });
      if (!resp.ok) { const err = await resp.json().catch(() => ({})); throw new Error(err.error || `HTTP ${resp.status}`); }
      const { content } = await resp.json();
      S.messages.push({ role: 'assistant', content });
    } catch (err) {
      console.error('[Coach]', err);
      const isNotDeployed = err.message?.includes('404') || err.message?.includes('Failed to fetch');
      S.messages.push({ role: 'assistant', content: isNotDeployed
        ? "⚙️ Le Coach IA n'est pas encore activé. Déploie la fonction Supabase `chat` et configure ta clé Anthropic."
        : "Désolé, je n'arrive pas à répondre. Réessaie dans un instant." });
    }
    S.loading = false;
    CoachUI.renderMessages();
  }

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

  function init() {
    CoachUI.createFAB();
    setTimeout(() => CoachUI.checkProactiveNotifications(), 5000);
    setTimeout(() => CoachUI.checkWeeklyReport(), 8000);
  }

  return {
    init, quickAsk,
    open:  () => CoachUI.open(),
    close: () => CoachUI.close(),
    _S: S,
    _callClaude: callClaude,
    _buildContext: buildContext,
    _edgeUrl: EDGE_URL,
  };
})();
