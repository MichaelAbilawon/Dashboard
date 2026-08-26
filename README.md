# Rainoil Executive Dashboard

A read-only monthly performance dashboard for Rainoil Limited's retail
fuel station network, plus a companion tool for uploading each day's
sales figures. Built as static HTML/CSS/JavaScript backed directly by
a Supabase (Postgres) database — no server, no build step.

> **This is a code-organization refactor, not a rewrite.** Every
> calculation, business rule, and pixel of the original UI is
> unchanged — see `docs/ARCHITECTURE.md` §6 for exactly which rules
> were carried over and where they now live.

## What it does

- **`index.html`** — the executive dashboard. Seven tabs:
  - **Overview** — monthly KPIs and daily revenue/volume charts
  - **Budget vs Actual** — target vs actual for PMS, AGO, DPK (targets
    are read-only here; they're set by a separate admin tool, see
    `docs/ARCHITECTURE.md` §8)
  - **Trend** — month-over-month volume and revenue
  - **Stations** — station-level rankings, drill-down detail (with an
    in-page Monthly Product Trend view), and a side-by-side Compare
    Stations tool
  - **Daily Records** — the audit layer beneath every monthly total,
    with CSV export
  - **Product Mix** — this month vs prior month, by product
  - **Period Analysis** — pick any station, product (PMS or AGO), and
    date range to get the Recorded-Day Average — total recorded
    volume ÷ number of days a value was actually recorded, never
    calendar days. See `docs/ARCHITECTURE.md` §14 for the exact
    definition and how it's tested.

  Reporting period selection is two dropdowns — **Year** and
  **Month** — populated entirely from whatever years/months actually
  have data in the database. Selecting 2024, 2025, or 2026 (or any
  future year once imported) shows that period throughout the
  dashboard; nothing is hardcoded to the current year.
- **`upload.html`** — a small standalone page for uploading a day's
  Excel file of station sales into the same database the dashboard
  reads from.

## Technology stack

- Vanilla HTML5, CSS3 (custom properties for theming — light/dark
  mode), and JavaScript (ES2017, no transpilation needed)
- [Chart.js 4.4](https://www.chartjs.org/) via CDN, for all charts
- [SheetJS/xlsx 0.18.5](https://sheetjs.com/) via CDN, for parsing
  uploaded Excel files
- [Supabase](https://supabase.com/) (hosted Postgres + auto-generated
  REST API) as the only backend
- **No framework, no bundler, no package.json.** See
  `docs/ARCHITECTURE.md` §5 for why this was kept as plain scripts
  rather than converted to ES modules or a framework during this
  refactor.

## Project structure

```
rainoil-dashboard/
├── index.html              Executive dashboard (entry point) — open read access, no login
├── upload.html             Daily Excel upload tool — requires uploader sign-in
├── css/                    Styles, split by concern — see docs/ARCHITECTURE.md §4
├── js/                     Application logic, split by concern — see docs/ARCHITECTURE.md §5
├── sql/                    One-time Postgres/RLS migrations — see "Setting up upload access" below
├── assets/images/          Logo + loading-screen background (previously inline base64)
├── docs/ARCHITECTURE.md    Full handover documentation
├── .env.example            Documents the two config values the app needs
└── .gitignore
```

See `docs/ARCHITECTURE.md` for the complete file-by-file breakdown,
including exactly which original function now lives in which file.

## How to run it locally

No install step — these are static files, but they must be served
over HTTP (not opened as `file://`) because the Supabase API calls
are subject to browser CORS rules:

```bash
python3 -m http.server 8080
# → http://localhost:8080/index.html
# → http://localhost:8080/upload.html
```

Any other static server (`npx serve .`, nginx, etc.) works the same
way.

## How to deploy it

Upload the project folder to any static host (Netlify, Vercel as a
static site, GitHub Pages, S3 + CloudFront, or Rainoil's own web
server). Nothing needs to be built or compiled first.

## Configuration

The app needs two values to reach the Supabase database, currently
set directly in `js/config.js`:

```js
window.SUPABASE_URL = 'https://your-project-ref.supabase.co';
window.SUPABASE_KEY = 'your-publishable-anon-key';
```

`upload.html` manages its own copy of these two values through an
on-page form (saved to that browser's `localStorage`) rather than
reading `js/config.js` — this was an intentional design in the
original app so the upload tool can be handed to someone without
editing any files. See `.env.example` for how these values would map
to a future build step, if one is ever introduced.

## Security

- `SUPABASE_KEY` is Supabase's **publishable (anon) key** — the kind
  of value that is *meant* to be visible in client-side code, similar
  to a Google Maps or Stripe publishable key. It carries no privilege
  by itself; access is controlled by Postgres Row Level Security
  (RLS) policies, not by keeping this value secret.
- **Where data comes from:** every row in the dashboard is read
  directly from the `daily_sales` and `monthly_budgets` Postgres
  tables via Supabase's REST API — nothing is fabricated,
  interpolated, or estimated client-side (see
  `docs/ARCHITECTURE.md` §6 for the full data-integrity contract this
  app follows).
- **Who can read:** anyone with the `index.html` URL — this dashboard
  is intentionally open, no login required.
- **Who can write:** only signed-in accounts with an `uploader` role.
  `upload.html` now has an email/password login gate in front of the
  upload form, and `daily_sales` has RLS policies that reject writes
  from anyone else — including requests made directly against the
  API with just the anon key. See **"Setting up upload access"**
  below and `docs/ARCHITECTURE.md` §7 for the full detail.

### Setting up upload access

1. In the Supabase dashboard for this project, run the migration in
   [`sql/001_lockdown_daily_sales_writes.sql`](sql/001_lockdown_daily_sales_writes.sql)
   once, via SQL Editor.
2. Authentication → Users → **Add user**, to create an account
   (email + password) for yourself.
3. Copy that user's UUID and run the `insert into app_roles ...`
   statement at the bottom of the same SQL file, with your UUID.
4. Sign in on `upload.html` with that email/password — uploads will
   now work.

To add another uploader later, repeat steps 2–3 for them. No code
changes are needed.

## Known limitations

See `docs/ARCHITECTURE.md` §13 for the full list (no auth, per-browser
upload credentials, `stations.js` file size). None of these are
regressions from the refactor — they're pre-existing characteristics
of the app, documented for whoever picks this up next.
