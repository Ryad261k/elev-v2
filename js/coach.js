/* ============================================
   COACH.JS — Coach IA (Claude via Edge Function)
   Élev v2
   ============================================ */

window.Coach = (() => {

  const S = { messages: [], loading: false, open: false };
  const EDGE_URL = `${window.SUPABASE_URL}/functions/v1/chat`;

  /* ------------------------------------------
     CONTEXTE UTILISATEUR
     ------------------------------------------ */
  async function buildContext() {
    try {
      const { data: sessions } = await DB.from('sessions')
        .select('started_at, ended_at, routine:routines(name), session_sets(reps,weight,is_warmup,exercise:exercises(name))')
        .eq('user_id', DB.userId()).not('ended_at', 'is', null)
        .order('started_at', { ascending: false }).limit(5);

      const today = new Date().toISOString().slice(0, 10);
      const { data: meals } = await DB.from('meals')
        .select('meal_items(calories,protein,carbs,fat)')
        .eq('user_id', DB.userId()).eq('date', today);

      const totalKcal = (meals || []).reduce((s, m) =>
        s + (m.meal_items || []).reduce((s2, i) => s2 + (i.calories || 0), 0), 0);

      const uid = DB.userId();
      const goals = JSON.parse(localStorage.getItem(`elev-nutrition-goals-${uid}`) || 'null');
      const profile = JSON.parse(localStorage.getItem(`elev-profile-${uid}`) || 'null');

      return {
        profile,
        goals,
        todayKcal: Math.round(totalKcal),
        recentSessions: (sessions || []).slice(0, 3).map(s => ({
          date: s.started_at?.slice(0, 10),
          routine: s.routine?.name || 'Autre',
          duration: s.ended_at ? Math.round((new Date(s.ended_at) - new Date(s.started_at)) / 60000) : null,
          sets: (s.session_sets || []).filter(x => !x.is_warmup).length
        }))
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
     INIT
     ------------------------------------------ */
  function init() {
    createFAB();
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

  return { init, open, close, quickAsk };

})();
