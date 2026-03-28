/* ============================================
   APP-AUTH.JS — Formulaire login / signup
   Élev v2
   (app.js doit être chargé avant)
   ============================================ */

window.AppAuth = (() => {

  function translateAuthError(err) {
    if (!err) return 'Une erreur est survenue.';
    const code = (err.code || '').toLowerCase();
    const msg  = (err.message || '').toLowerCase();
    if (code === 'email_not_confirmed' || msg.includes('email not confirmed'))
      return 'Confirme ton adresse email avant de te connecter. Vérifie ta boîte mail.';
    if (code === 'invalid_credentials' || msg.includes('invalid login') || msg.includes('invalid credentials'))
      return 'Email ou mot de passe incorrect. Si tu viens de t\'inscrire, pense à confirmer ton adresse email.';
    if (code === 'user_already_exists' || msg.includes('user already registered') || msg.includes('already been registered'))
      return 'Un compte existe déjà avec cet email. Connecte-toi.';
    if (msg.includes('password should be'))
      return 'Le mot de passe doit faire au moins 6 caractères.';
    if (msg.includes('rate limit') || msg.includes('too many'))
      return 'Trop de tentatives. Réessaie dans quelques minutes.';
    return 'Erreur : ' + (err.message || 'inconnue');
  }

  function bindAuthForm() {
    const form       = document.getElementById('auth-form');
    if (!form) return;

    const emailInput  = document.getElementById('auth-email');
    const pwInput     = document.getElementById('auth-password');
    const confirmPw   = document.getElementById('auth-confirm-pw');
    const confirmGrp  = document.getElementById('auth-confirm-pw-group');
    const btn         = document.getElementById('auth-submit');
    const toggleMode  = document.getElementById('auth-toggle-mode');
    const modeTitle   = document.getElementById('auth-mode-title');
    const modeSub     = document.getElementById('auth-mode-subtitle');
    const errorEl     = document.getElementById('auth-error');
    const signupConf  = document.getElementById('auth-signup-confirm');
    const backBtn     = document.getElementById('auth-back');
    const togglePwBtn = document.getElementById('btn-toggle-pw');

    let mode = 'login';

    function setError(msg) {
      if (!errorEl) return;
      errorEl.textContent   = msg || '';
      errorEl.style.display = msg ? 'block' : 'none';
    }
    function setLoading(loading) {
      btn.disabled    = loading;
      btn.textContent = loading
        ? (mode === 'login' ? 'Connexion…' : 'Création…')
        : (mode === 'login' ? 'Se connecter' : 'Créer mon compte');
    }
    function switchMode(newMode) {
      mode = newMode;
      setError('');
      if (mode === 'login') {
        modeTitle.textContent    = 'Connexion';
        modeSub.textContent      = 'Bienvenue — connecte-toi pour continuer.';
        btn.textContent          = 'Se connecter';
        toggleMode.textContent   = 'Pas encore de compte ? S\'inscrire';
        confirmGrp.style.display = 'none';
        pwInput.autocomplete     = 'current-password';
      } else {
        modeTitle.textContent    = 'Inscription';
        modeSub.textContent      = 'Crée ton compte en quelques secondes.';
        btn.textContent          = 'Créer mon compte';
        toggleMode.textContent   = 'Déjà un compte ? Se connecter';
        confirmGrp.style.display = '';
        pwInput.autocomplete     = 'new-password';
      }
    }

    if (togglePwBtn) {
      togglePwBtn.addEventListener('click', () => {
        const isHidden        = pwInput.type === 'password';
        pwInput.type          = isHidden ? 'text' : 'password';
        togglePwBtn.textContent = isHidden ? '🙈' : '👁';
      });
    }

    toggleMode?.addEventListener('click', () => switchMode(mode === 'login' ? 'signup' : 'login'));

    form.addEventListener('submit', async e => {
      e.preventDefault();
      setError('');
      const email    = emailInput?.value.trim();
      const password = pwInput?.value;
      if (!email || !password)       { setError('Remplis tous les champs.'); return; }
      if (password.length < 6)       { setError('Le mot de passe doit faire au moins 6 caractères.'); return; }
      if (mode === 'signup' && password !== confirmPw?.value) { setError('Les mots de passe ne correspondent pas.'); return; }
      setLoading(true);
      try {
        if (mode === 'login') {
          await Auth.signIn(email, password);
        } else {
          const result = await Auth.signUp(email, password);
          if (!result.session) {
            form.style.display       = 'none';
            signupConf.style.display = 'flex';
          }
        }
      } catch (err) {
        console.error('[Auth] Erreur:', err);
        setError(translateAuthError(err));
        setLoading(false);
      }
    });

    backBtn?.addEventListener('click', () => {
      signupConf.style.display = 'none';
      form.style.display       = '';
      switchMode('login');
      setLoading(false);
    });
  }

  return { bindAuthForm };
})();
