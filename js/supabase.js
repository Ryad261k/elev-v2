/* ============================================
   SUPABASE.JS — Init client + helpers auth + DB
   Élev v2
   ============================================ */

const SUPABASE_URL  = 'https://axqhwraacpdfdpalgzlb.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4cWh3cmFhY3BkZmRwYWxnemxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NzY0MTksImV4cCI6MjA5MDE1MjQxOX0.GtJ2BdEef33qgjuTM6pK1muvcB8vaT9mJciYFKXDUEE';

// Le SDK Supabase est chargé via CDN UMD juste avant ce script dans index.html
// Il expose window.supabase.createClient
window.SupabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

/* ==========================================
   AUTH — Magic link (passwordless)
   ========================================== */
window.Auth = {
  /**
   * Envoie un magic link à l'email fourni.
   * @param {string} email
   */
  async sendMagicLink(email) {
    const { error } = await window.SupabaseClient.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: window.location.origin }
    });
    if (error) throw error;
  },

  /** Déconnecte l'utilisateur courant. */
  async signOut() {
    const { error } = await window.SupabaseClient.auth.signOut();
    if (error) throw error;
  },

  /** Retourne la session active ou null. */
  async getSession() {
    const { data: { session }, error } = await window.SupabaseClient.auth.getSession();
    if (error) throw error;
    return session;
  },

  /**
   * Écoute les changements d'état d'auth.
   * @param {function} callback  — reçoit (event, session)
   * @returns {object} subscription (pour unsubscribe si besoin)
   */
  onAuthStateChange(callback) {
    const { data } = window.SupabaseClient.auth.onAuthStateChange(callback);
    return data;
  }
};

/* ==========================================
   DB — Wrappers Supabase (jamais .from() direct)
   Regles : toutes les requêtes passent ici
   ========================================== */
window.DB = {
  /**
   * Point d'entrée pour toutes les requêtes.
   * Usage: DB.from('exercises').select('*').eq('id', id)
   */
  from(table) {
    return window.SupabaseClient.from(table);
  },

  /**
   * Helper : récupère l'user_id courant (raccourci).
   */
  userId() {
    return AppState.user?.id ?? null;
  }
};
