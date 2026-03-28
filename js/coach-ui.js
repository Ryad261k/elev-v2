/* ============================================
   COACH-UI.JS — Modal, FAB, messages, notifications, weekly report
   Élev v2  (coach.js doit être chargé avant)
   ============================================ */

window.CoachUI = (() => {

  const S = () => window.Coach._S;

  /* ── Messages ──────────────────────────────── */
  function renderMessages() {
    const list = document.getElementById('coach-messages');
    if (!list) return;
    const msgs = S().messages.length ? S().messages : [{
      role: 'assistant',
      content: "👋 Bonjour ! Je suis ton coach IA. Pose-moi une question sur ta musculation ou ta nutrition."
    }];
    list.innerHTML = msgs.map(m => `
      <div class="coach-bubble coach-bubble-${m.role}">
        ${m.role === 'assistant' ? '<span class="coach-avatar">🤖</span>' : ''}
        <div class="coach-bubble-text">${m.content.replace(/\n/g, '<br>')}</div>
      </div>`).join('');
    if (S().loading) {
      list.insertAdjacentHTML('beforeend', `
        <div class="coach-bubble coach-bubble-assistant">
          <span class="coach-avatar">🤖</span>
          <div class="coach-bubble-text coach-typing"><span></span><span></span><span></span></div>
        </div>`);
    }
    list.scrollTop = list.scrollHeight;
  }

  /* ── Modal ─────────────────────────────────── */
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
          <input type="text" id="coach-input" class="input" placeholder="Pose ta question…" autocomplete="off" style="flex:1;" />
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
    if (S().loading) return;
    const input = document.getElementById('coach-input');
    const msg   = input?.value.trim();
    if (!msg) return;
    input.value = '';
    window.Coach._callClaude(msg);
    if (navigator.vibrate) navigator.vibrate(6);
  }

  function open() {
    createModal();
    const modal = document.getElementById('coach-modal');
    setTimeout(() => modal?.classList.add('open'), 10);
    renderMessages();
    S().open = true;
    document.getElementById('coach-input')?.focus();
  }

  function close() {
    document.getElementById('coach-modal')?.classList.remove('open');
    S().open = false;
  }

  /* ── Bouton flottant ──────────────────────── */
  function createFAB() {
    if (document.getElementById('coach-fab')) return;
    const btn = document.createElement('button');
    btn.id = 'coach-fab';
    btn.setAttribute('aria-label', 'Coach IA');
    btn.textContent = '✨';
    btn.addEventListener('click', () => { S().open ? close() : open(); if (navigator.vibrate) navigator.vibrate(8); });
    document.getElementById('app')?.appendChild(btn);
  }

  /* ── Notification bulle ───────────────────── */
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
    setTimeout(() => {
      el.style.animation = 'slideDown 300ms ease-in forwards';
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }, 6000);
  }

  /* ── Notifications proactives ─────────────── */
  async function checkProactiveNotifications() {
    try {
      const uid   = DB.userId();
      const today = new Date().toISOString().slice(0, 10);
      const lastKey = `elev-coach-notif-${uid}-${today}`;
      if (localStorage.getItem(lastKey)) return;

      const context = await window.Coach._buildContext();
      const { recentSessions, todayNutrition, goals, heuristics } = context;
      const tips = [];

      if (recentSessions?.length) {
        const daysSince = Math.floor((Date.now() - new Date(recentSessions[0]?.date)) / 86400000);
        if (daysSince >= 3) tips.push(`💪 Tu n'as pas fait de séance depuis ${daysSince} jours. Petite relance ?`);
      }
      if (goals?.kcal && todayNutrition?.kcal > 0 && todayNutrition.kcal < goals.kcal * 0.6)
        tips.push(`🥗 Tu es à ${todayNutrition.kcal} kcal aujourd'hui — moins de 60% de ton objectif. Pense à manger !`);
      if (goals?.protein) {
        const prot = todayNutrition?.protein || 0;
        if (prot > 0 && prot < goals.protein * 0.7)
          tips.push(`🥩 Protéines du jour : ${Math.round(prot)}g / ${goals.protein}g. Rajoute une source de protéines !`);
      }
      if (heuristics?.length) heuristics.slice(0, 2).forEach(hint => tips.push(`📌 ${hint}`));

      if (!tips.length) return;
      localStorage.setItem(lastKey, '1');
      setTimeout(() => tips.forEach((tip, i) => setTimeout(() => showNotifBubble(tip), i * 4000)), 3000);
    } catch (_) {}
  }

  /* ── Rapport hebdomadaire ─────────────────── */
  async function checkWeeklyReport() {
    try {
      const uid = DB.userId();
      const now = new Date();
      if (now.getDay() !== 0) return;
      const weekKey = `elev-weekly-report-${uid}-${now.toISOString().slice(0, 10)}`;
      if (localStorage.getItem(weekKey)) return;

      const context = await window.Coach._buildContext();
      const prompt  = `Tu es le coach IA de l'app ÉLEV. Génère un bilan hebdomadaire court (4–6 lignes) en français. Données : ${JSON.stringify(context)}. Format :
📊 Bilan de la semaine
• [point fort]
• [point fort]
⚡ À améliorer
• [axe d'amélioration]
💡 [conseil pratique pour la semaine suivante]`;

      const EDGE_URL = window.Coach._edgeUrl;
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
      S().messages.unshift({ role: 'assistant', content: `📋 **Rapport de la semaine**\n\n${content}` });
      setTimeout(() => showNotifBubble('📋 Ton bilan de la semaine est prêt — ouvre le Coach IA pour le voir !'), 5000);
    } catch (_) {}
  }

  return { renderMessages, open, close, createFAB, checkProactiveNotifications, checkWeeklyReport };
})();
