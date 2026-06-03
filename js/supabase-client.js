/* ==========================================================
   supabase-client.js — Shared Supabase client instance
   True Jiu Jitsu Online

   Creates a single client and attaches it to window so all
   other scripts (nav.js, catalogue.js, player.js, etc.)
   can use window.supabaseClient without re-initializing.

   Load this script before any other platform JS.
   ========================================================== */

const _SUPABASE_URL      = 'https://rcmherydjpqgmpygwdic.supabase.co';
const _SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjbWhlcnlkanBxZ21weWd3ZGljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0MDY3NjgsImV4cCI6MjA5NTk4Mjc2OH0.xY-GvRr-PNtail8ZjI9gW4qWPAkGuRc84Tfo137nFak';

try {
  window.supabaseClient = window.supabase.createClient(_SUPABASE_URL, _SUPABASE_ANON_KEY);
} catch (err) {
  console.error('Supabase client failed to initialize:', err);
  window.supabaseClient = null;
}

/* Trigger page fade-in once DOM is ready */
document.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add('page-ready');
});
