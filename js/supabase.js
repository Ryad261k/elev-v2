/* ============================================
   SUPABASE.JS — Init client + helpers auth
   Élev v2
   ============================================ */

const SUPABASE_URL  = '';  // TODO: à renseigner
const SUPABASE_ANON = '';  // TODO: à renseigner

window.SupabaseClient = null;

// Le client sera initialisé ici quand les clés seront disponibles
// import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
// window.SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON)

window.DB = {
  async from(table) {
    if (!window.SupabaseClient) {
      console.warn('[DB] Supabase non configuré');
      return null;
    }
    return window.SupabaseClient.from(table);
  }
};
