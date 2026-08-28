-- ════════════════════════════════════════════════════════════
-- Migration: Lock down daily_sales WRITES to authenticated
--            "uploader" accounts. Reads stay open to everyone
--            (the dashboard keeps working exactly as it does
--            today, with no login).
--
-- Run this once in Supabase → SQL Editor, on the project the
-- dashboard already points at (js/config.js). Safe to run on a
-- table that already has data — this only changes who can query
-- it going forward, it does not touch existing rows.
--
-- Does NOT touch monthly_budgets — that table is managed by a
-- separate admin page outside this project's scope, and was not
-- part of this hardening pass.
-- ════════════════════════════════════════════════════════════


-- 1. A small table mapping a Supabase Auth user to a role.
--    Only "uploader" is used today, but the shape leaves room
--    for other roles later (e.g. "admin") without a schema change.
create table if not exists app_roles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null check (role in ('uploader')),
  created_at timestamptz not null default now()
);

-- Nobody can read/write app_roles from the browser directly —
-- it's only ever consulted internally by the policies below.
alter table app_roles enable row level security;
-- (intentionally: no policies added, so it is fully locked down
--  from the client; only accessible via the Supabase dashboard
--  or a service_role key, which never appears in this codebase)


-- 2. Turn on Row Level Security for daily_sales.
--    Enabling RLS with zero policies would block ALL access
--    (including the anon reads the dashboard depends on), so
--    steps 3 and 4 below add the two policies needed to keep
--    today's read behavior working while locking down writes.
alter table daily_sales enable row level security;


-- 3. READ: unchanged from today — anyone (including the
--    unauthenticated anon key the dashboard already uses) can
--    SELECT. This is the "leave the dashboard open" choice.
drop policy if exists "public read access" on daily_sales;
create policy "public read access"
  on daily_sales
  for select
  using (true);


-- 4. WRITE: only a logged-in user who has a row in app_roles
--    with role = 'uploader' may INSERT or UPDATE. This covers
--    both cases PostgREST's upsert can trigger — upload.html's
--    "Prefer: resolution=merge-duplicates" header performs an
--    INSERT ... ON CONFLICT DO UPDATE, so both policies are
--    needed even though only INSERT is used on a brand-new row.
drop policy if exists "uploader insert access" on daily_sales;
create policy "uploader insert access"
  on daily_sales
  for insert
  with check (
    exists (
      select 1 from app_roles
      where app_roles.user_id = auth.uid()
        and app_roles.role = 'uploader'
    )
  );

drop policy if exists "uploader update access" on daily_sales;
create policy "uploader update access"
  on daily_sales
  for update
  using (
    exists (
      select 1 from app_roles
      where app_roles.user_id = auth.uid()
        and app_roles.role = 'uploader'
    )
  )
  with check (
    exists (
      select 1 from app_roles
      where app_roles.user_id = auth.uid()
        and app_roles.role = 'uploader'
    )
  );


-- ════════════════════════════════════════════════════════════
-- One-time manual steps AFTER running the SQL above:
--
--   1. In the Supabase dashboard: Authentication → Users → Add
--      user. Create an account for yourself (email + password).
--      Copy the new user's UUID from that screen.
--
--   2. Run this, replacing the UUID with the one you just copied:
--
--        insert into app_roles (user_id, role)
--        values ('paste-your-user-uuid-here', 'uploader');
--
--   3. That's it — that account can now sign in on upload.html
--      and upload will work. Repeat steps 1–2 for anyone else
--      who needs upload access later; no code changes needed.
-- ════════════════════════════════════════════════════════════
