'use strict';

/* ════════════════════════════════════════════════════════
   APP CONFIGURATION — LOCAL, NOT COMMITTED

   This file is listed in .gitignore on purpose — it holds the
   real Supabase URL/key and should never be pushed to a
   repository. js/config.example.js (which IS committed) is the
   template a new developer copies to create this file.

   SUPABASE_KEY is Supabase's "publishable" (anon) key, which is
   designed to be shipped to the browser — it has no privileges
   on its own; real access control is enforced server-side via
   Postgres Row Level Security (RLS) policies, not by keeping
   this value secret. Keeping it out of git is still worthwhile
   as a hygiene practice (fewer places it appears, no need to
   scrub git history later) — see README.md → "Configuration"
   and "Security" for the full explanation.
   ════════════════════════════════════════════════════════ */
window.SUPABASE_URL = 'https://zykyepkenreylwfagbvn.supabase.co';
window.SUPABASE_KEY = 'sb_publishable_N7mmV9RF0SPWZWGiePAo0A_tyFZYzJA';
