/* ============================================
   ONBOARDING.JS — Premier lancement
   Élev v2 — 8 étapes
   ============================================ */

window.Onboarding = (() => {

  let step = 0;
  let data = {};

  function profileKey() { return `elev-profile-${DB.userId()}`; }
  function goalsKey()   { return `elev-nutrition-goals-${DB.userId()}`; }
  function doneKey()    { return `elev-onboarding-done-${DB.userId()}`; }

  function isComplete() {
    return !!localStorage.getItem(doneKey());
  }

  /* ------------------------------------------
     TDEE & MACROS
     ------------------------------------------ */
  function calcTDEE(d) {
    const { weight, height, age, sex, activity, goal } = d;
    if (!weight || !height || !age) return null;
    const bmr = sex === 'F'
      ? 10 * weight + 6.25 * height - 5 * age - 161
      : 10 * weight + 6.25 * height - 5 * age + 5;
    const mult = { 1: 1.2, 2: 1.375, 3: 1.55, 4: 1.725, 5: 1.9 }[activity] || 1.55;
    let kcal = Math.round(bmr * mult);
    if (goal === 'masse')   kcal += 300;
    if (goal === 'seche')   kcal -= 400;
    if (goal === 'force')   kcal += 100;
    const protein = Math.round(weight * (goal === 'seche' ? 2.5 : 2.2));
    const fat     = Math.round(weight * (goal === 'seche' ? 0.8 : 1.0));
    const carbs   = Math.round(Math.max(0, (kcal - protein * 4 - fat * 9) / 4));
    return { kcal, protein, carbs, fat };
  }

  /* ------------------------------------------
     ÉTAPES
     ------------------------------------------ */
  const STEPS = [
    {
      id: 'prenom',
      title: 'Bienvenue 👋',
      subtitle: 'Comment tu t\'appelles ?',
      html: () => `
        <div class="form-group">
          <label for="ob-prenom">Ton prénom</label>
          <input type="text" id="ob-prenom" class="input" placeholder="Louis" autocomplete="given-name" value="${data.prenom || ''}" />
        </div>`,
      validate: () => {
        data.prenom = document.getElementById('ob-prenom')?.value.trim();
        return data.prenom ? null : 'Entre ton prénom';
      }
    },
    {
      id: 'objectif',
      title: 'Ton objectif 🎯',
      subtitle: 'Qu\'est-ce que tu cherches à accomplir ?',
      html: () => ['masse','seche','force','maintien','sante'].map(g => {
        const labels = { masse:'Prise de masse 💪', seche:'Sèche / Définition 🔥', force:'Force / Performance ⚡', maintien:'Maintien / Forme 🏃', sante:'Santé générale 🌿' };
        return `<label class="ob-option ${data.goal === g ? 'ob-option-active' : ''}" data-val="${g}">
          <span>${labels[g]}</span>
          <input type="radio" name="ob-goal" value="${g}" ${data.goal === g ? 'checked' : ''} style="display:none;"/>
        </label>`;
      }).join(''),
      validate: () => {
        data.goal = document.querySelector('input[name="ob-goal"]:checked')?.value;
        return data.goal ? null : 'Choisis un objectif';
      }
    },
    {
      id: 'niveau',
      title: 'Ton niveau 📊',
      subtitle: 'Depuis combien de temps tu t\'entraînes ?',
      html: () => ['debutant','intermediaire','avance'].map(n => {
        const labels = { debutant:'Débutant — moins d\'1 an', intermediaire:'Intermédiaire — 1 à 3 ans', avance:'Avancé — 3 ans et plus' };
        return `<label class="ob-option ${data.level === n ? 'ob-option-active' : ''}" data-val="${n}">
          <span>${labels[n]}</span>
          <input type="radio" name="ob-level" value="${n}" ${data.level === n ? 'checked' : ''} style="display:none;"/>
        </label>`;
      }).join(''),
      validate: () => {
        data.level = document.querySelector('input[name="ob-level"]:checked')?.value;
        return data.level ? null : 'Choisis ton niveau';
      }
    },
    {
      id: 'mensures',
      title: 'Tes données 📏',
      subtitle: 'Pour personnaliser tes objectifs.',
      html: () => `
        <div class="input-row">
          <div class="form-group">
            <label>Poids actuel (kg)</label>
            <input type="number" id="ob-weight" class="input" inputmode="decimal" step="0.1" min="30" max="300" placeholder="75" value="${data.weight || ''}" />
          </div>
          <div class="form-group">
            <label>Taille (cm)</label>
            <input type="number" id="ob-height" class="input" inputmode="numeric" step="1" min="100" max="250" placeholder="175" value="${data.height || ''}" />
          </div>
        </div>
        <div class="input-row" style="margin-top:12px;">
          <div class="form-group">
            <label>Âge</label>
            <input type="number" id="ob-age" class="input" inputmode="numeric" min="13" max="99" placeholder="25" value="${data.age || ''}" />
          </div>
          <div class="form-group">
            <label>Sexe</label>
            <select id="ob-sex" class="input">
              <option value="M" ${data.sex === 'M' ? 'selected' : ''}>Homme</option>
              <option value="F" ${data.sex === 'F' ? 'selected' : ''}>Femme</option>
            </select>
          </div>
        </div>`,
      validate: () => {
        data.weight = parseFloat(document.getElementById('ob-weight')?.value);
        data.height = parseFloat(document.getElementById('ob-height')?.value);
        data.age    = parseInt(document.getElementById('ob-age')?.value);
        data.sex    = document.getElementById('ob-sex')?.value;
        if (!data.weight || data.weight < 30) return 'Poids invalide';
        if (!data.height || data.height < 100) return 'Taille invalide';
        if (!data.age    || data.age < 13)     return 'Âge invalide';
        return null;
      }
    },
    {
      id: 'activite',
      title: 'Niveau d\'activité 🏃',
      subtitle: 'En dehors de la salle ?',
      html: () => [
        [1,'Sédentaire — bureau, peu de marche'],
        [2,'Légèrement actif — marche quotidienne'],
        [3,'Modérément actif — sport 3×/sem'],
        [4,'Très actif — sport 5×/sem'],
        [5,'Extrêmement actif — athlète / travail physique'],
      ].map(([v, l]) => `
        <label class="ob-option ${data.activity == v ? 'ob-option-active' : ''}" data-val="${v}">
          <span>${l}</span>
          <input type="radio" name="ob-activity" value="${v}" ${data.activity == v ? 'checked' : ''} style="display:none;"/>
        </label>`).join(''),
      validate: () => {
        data.activity = parseInt(document.querySelector('input[name="ob-activity"]:checked')?.value);
        return data.activity ? null : 'Choisis ton niveau d\'activité';
      }
    },
    {
      id: 'materiel',
      title: 'Ton matériel 🏋️',
      subtitle: 'Où tu t\'entraînes ?',
      html: () => [
        ['salle','Salle complète — machines + barres'],
        ['halteres','Haltères à domicile'],
        ['barre','Barre + disques seulement'],
        ['elastiques','Élastiques / TRX'],
        ['rien','Sans matériel — poids du corps'],
      ].map(([v, l]) => `
        <label class="ob-option ${data.equipment === v ? 'ob-option-active' : ''}" data-val="${v}">
          <span>${l}</span>
          <input type="radio" name="ob-eq" value="${v}" ${data.equipment === v ? 'checked' : ''} style="display:none;"/>
        </label>`).join(''),
      validate: () => {
        data.equipment = document.querySelector('input[name="ob-eq"]:checked')?.value;
        return data.equipment ? null : 'Choisis ton matériel';
      }
    },
    {
      id: 'tdee',
      title: 'Tes objectifs 🎯',
      subtitle: 'Calculés selon ton profil.',
      html: () => {
        const goals = calcTDEE(data);
        if (!goals) return '<p class="card-subtitle">Données insuffisantes pour calculer.</p>';
        return `
          <div class="card" style="background:var(--accent-primary-soft);border-color:var(--accent-primary);">
            <p style="font-size:2rem;font-weight:700;color:var(--accent-primary);text-align:center;margin-bottom:4px;">${goals.kcal} kcal</p>
            <p class="card-subtitle" style="text-align:center;margin-bottom:16px;">Objectif calorique journalier</p>
            <div class="stat-row">
              <div class="stat-chip"><p class="stat-chip-value">${goals.protein}g</p><p class="stat-chip-label">Protéines</p></div>
              <div class="stat-chip"><p class="stat-chip-value">${goals.carbs}g</p><p class="stat-chip-label">Glucides</p></div>
              <div class="stat-chip"><p class="stat-chip-value">${goals.fat}g</p><p class="stat-chip-label">Lipides</p></div>
            </div>
          </div>
          <p class="card-subtitle" style="margin-top:12px;text-align:center;">Tu pourras ajuster ça à tout moment dans tes paramètres.</p>`;
      },
      validate: () => null
    },
  ];

  /* ------------------------------------------
     RENDU
     ------------------------------------------ */
  function getScreen() { return document.getElementById('onboarding-screen'); }

  function renderStep() {
    const screen = getScreen();
    if (!screen) return;
    const s = STEPS[step];
    const isLast = step === STEPS.length - 1;
    screen.innerHTML = `
      <div class="ob-container">
        <!-- Progress -->
        <div class="ob-progress">
          ${STEPS.map((_, i) => `<div class="ob-dot ${i <= step ? 'ob-dot-active' : ''}"></div>`).join('')}
        </div>
        <!-- Contenu -->
        <div class="ob-body">
          <h1 class="ob-title">${s.title}</h1>
          <p class="ob-subtitle">${s.subtitle}</p>
          <div class="ob-form" id="ob-form-inner">
            ${s.html()}
          </div>
          <p id="ob-error" style="color:var(--color-danger);font-size:0.8125rem;margin-top:8px;display:none;"></p>
        </div>
        <!-- Actions -->
        <div class="ob-footer">
          ${step > 0 ? '<button class="btn btn-ghost" id="ob-back">← Retour</button>' : ''}
          <button class="btn btn-primary" id="ob-next" style="flex:1;">
            ${isLast ? 'Commencer 🚀' : 'Suivant →'}
          </button>
        </div>
      </div>`;

    // Bind option cards
    screen.querySelectorAll('.ob-option').forEach(opt => {
      opt.addEventListener('click', () => {
        screen.querySelectorAll('.ob-option').forEach(o => o.classList.remove('ob-option-active'));
        opt.classList.add('ob-option-active');
        const radio = opt.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
      });
    });

    document.getElementById('ob-next')?.addEventListener('click', nextStep);
    document.getElementById('ob-back')?.addEventListener('click', prevStep);
  }

  function setError(msg) {
    const el = document.getElementById('ob-error');
    if (!el) return;
    el.textContent = msg || '';
    el.style.display = msg ? 'block' : 'none';
  }

  function nextStep() {
    const err = STEPS[step].validate();
    if (err) { setError(err); return; }
    setError('');
    if (step < STEPS.length - 1) { step++; renderStep(); return; }
    complete();
  }

  function prevStep() {
    if (step > 0) { step--; renderStep(); }
  }

  /* ------------------------------------------
     COMPLÉTION
     ------------------------------------------ */
  async function complete() {
    const uid   = DB.userId();
    const goals = calcTDEE(data);
    localStorage.setItem(`elev-profile-${uid}`, JSON.stringify(data));
    if (goals) localStorage.setItem(`elev-nutrition-goals-${uid}`, JSON.stringify(goals));
    localStorage.setItem(doneKey(), '1');

    // Sync vers Supabase user_metadata (persistance cross-device)
    try {
      await window.SupabaseClient.auth.updateUser({
        data: { elev_profile: data, elev_goals: goals, elev_onboarding_done: true }
      });
    } catch (_) {}

    hide();
    window.showToast?.(`Bienvenue, ${data.prenom} ! 🎉`, 'success', 4000);
    // Recharge nutrition avec nouveaux objectifs
    if (window.Nutrition) Nutrition.init();
  }

  /* ------------------------------------------
     SHOW / HIDE
     ------------------------------------------ */
  function show() {
    step = 0; data = {};
    const existing = localStorage.getItem(`elev-profile-${DB.userId()}`);
    if (existing) try { data = JSON.parse(existing); } catch {}
    let screen = document.getElementById('onboarding-screen');
    if (!screen) {
      screen = document.createElement('div');
      screen.id = 'onboarding-screen';
      screen.className = 'onboarding-screen';
      document.body.appendChild(screen);
    }
    screen.style.display = 'flex';
    renderStep();
  }

  function hide() {
    const s = document.getElementById('onboarding-screen');
    if (s) s.style.display = 'none';
  }

  return { show, hide, isComplete };

})();
