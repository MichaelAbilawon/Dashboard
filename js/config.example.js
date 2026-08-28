'use strict';

/* ════════════════════════════════════════════════════════
   APP CONFIGURATION — TEMPLATE

   This is the file that gets committed to git. js/config.js
   itself (the one with your real Supabase URL/key) is listed
   in .gitignore and never gets committed — see README.md →
   "Configuration" for the one-time setup step.

   SUPABASE_KEY is Supabase's "publishable" (anon) key, which
   is designed to be shipped to the browser — it has no
   privileges on its own. Real access control is enforced
   server-side via Postgres Row Level Security (RLS) policies,
   not by keeping this value secret (see README.md → "Security"
   for the full explanation, and why it still doesn't belong in
   git — that's a source-control hygiene choice, not a claim
   that the key itself is dangerous).
   ════════════════════════════════════════════════════════ */
window.SUPABASE_URL = 'https://your-project-ref.supabase.co';
window.SUPABASE_KEY = 'sb_publishable_your-key-here';
