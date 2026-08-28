# Architecture

This document is the handover reference for a future developer or IT
team taking over this project. It describes where things live and
why, not how to use the dashboard itself (see `README.md` for that).

## 1. What this is

A vanilla HTML/CSS/JavaScript reporting suite for Rainoil Limited's
retail fuel network, backed directly by a Supabase (Postgres) REST
API. There is **no build step, no framework, and no bundler** — every
file is served as-is. This was a deliberate choice preserved from the
original implementation (see §7, "Why no framework/build step").

Two independent pages:

| Page           | Purpose                                                         |
|----------------|------------------------------------------------------------------|
| `index.html`   | Read-only executive dashboard — 6 tabs of reporting views        |
| `upload.html`  | Small standalone tool for uploading a day's Excel file           |

## 2. Where the application starts

- **`index.html`** — the browser loads this file, which pulls
  in every CSS file under `css/` and every JS file under `js/` via
  plain `<link>`/`<script>` tags, in a fixed order (see §5). The very
  last thing that happens is the self-invoking function at the top of
  `js/services/supabase-service.js`, which fetches all `daily_sales`
  rows, builds the in-memory data store, and then calls
  `launchDashboard()` (in `js/app.js`) to reveal the UI.
- **`upload.html`** — loaded independently by whoever is entering a
  day's figures. It has no dependency on `index.html`'s scripts;
  the only thing shared between the two pages is the Supabase
  Postgres schema they both talk to.

## 3. Where each page is defined

Both `index.html` and `upload.html` are single HTML files containing
all of that page's markup — there was no templating system in the
original app, and introducing one for two static pages would add
complexity without benefit. Page-*specific logic* (as opposed to
markup) lives in JS files under `js/pages/` and `js/upload/`.

## 4. Where styles live

```
css/
├── tokens.css                    Design tokens: light/dark CSS variables only
├── base.css                      html/body resets, font stack, scrollbars, a11y
├── responsive.css                The single @media(max-width:900px) breakpoint
├── upload.css                    All styles for upload.html (self-contained page)
└── components/
    ├── loading-screen.css        #cloud-screen splash/progress UI
    ├── chrome.css                Masthead, brand block, tabs
    ├── kpi-cards.css             .kpi-grid / .kpi-card
    ├── charts.css                .chart-grid / .chart-card wrappers (not Chart.js itself)
    ├── budget.css                Budget vs Actual bars/rows
    ├── daily-records.css         Stat strip + partial-data markers
    ├── tables.css                Generic sortable/scrollable table styling
    └── trend-comparison.css      Monthly Product Trend + Compare Stations UI
```

Every color, spacing unit tied to theme, and font in the app is a CSS
variable defined once in `tokens.css` — components never hard-code a
hex value. This was already true in the original single file and is
unchanged; the split just gives each concern its own file.

## 5. Where JavaScript logic lives

`index.html` loads these in this exact order (dependency order —
later files call functions/read variables defined by earlier ones):

```
js/config.js                       window.SUPABASE_URL / SUPABASE_KEY
js/utils/theme.js                  toggleTheme()
js/utils/format.js                 fmtNFull, fmtVFull, fmtPct, alpha, MONTHS...
js/utils/chart-utils.js            chartPalette(), mkChart() (Chart.js wrapper)
js/state/store.js                  RAW_DATA, MONTH_AGG, BUDGETS, STATE (global data store)
js/services/supabase-service.js    All fetch() calls to the daily_sales / monthly_budgets tables
js/services/period-analysis-service.js  Scoped fetch for Period Analysis (see §14)
js/business/aggregation.js         buildMonthlyAggregates(), monthLabel(), getBudgetFor()
js/business/station-analytics.js   allStationNames(), rangeMonthKeys(), MoM helpers
js/business/period-analysis.js     summarizePeriodRows() — the Recorded-Day Average calculation (see §14)
js/app.js                          launchDashboard(), switchTab(), renderAll(), year/month selector logic
js/business/metrics.js             monthMetrics() — budget attainment % calculation
js/pages/overview.js               Tab 1 — Overview
js/pages/budget.js                 Tab 2 — Budget vs Actual
js/pages/trend.js                  Tab 3 — Trend
js/pages/stations.js               Tab 4 — Stations (list, detail, compare, in-detail trend)
js/pages/daily-records.js          Tab 5 — Daily Records + CSV export
js/pages/product-mix.js            Tab 6 — Product Mix
js/pages/period-analysis.js        Tab 7 — Period Analysis (see §14)
```

`upload.html` loads its own independent set:

```
js/upload/credentials.js           Supabase URL/key input + localStorage persistence
js/upload/log.js                   On-page activity log helpers
js/upload/station-lookup.js        STATION_LOOKUP table + normalizeStationName()
js/upload/excel-parser.js          Column-alias matching + parseExcel() (both header formats)
js/upload/upload-service.js        doUpload() — orchestrates parse + batched POST to Supabase
```

### Why plain global scripts, not ES modules

The original app relies on:

- Inline HTML handlers like `onclick="switchTab('exec', this)"`, which
  require `switchTab` to exist as a **global** function.
- Shared mutable global state (`STATE`, `RAW_DATA`, `MONTH_AGG`,
  `CHARTS`) read and written across many files.

Converting to ES modules (`import`/`export`) would mean either (a)
manually attaching every one of ~90 functions to `window` so the
inline handlers keep working, or (b) rewriting every `onclick=""`
attribute to use `addEventListener` instead. Both are legitimate
future refactors, but they are **behavior-risk-bearing changes**,
which this refactor was explicitly scoped to avoid. Plain scripts
loaded in order, all sharing the page's global scope, reproduce the
original single-file behavior exactly while still getting the file
separation this refactor was for.

If the project later adopts a build step (see `.env.example`), that
is the natural time to also migrate to ES modules.

## 6. Where business rules are implemented

The data-integrity principle carried over unchanged from the original
file: **only display actual data available from the source.**
Concretely:

- `js/business/aggregation.js` sums fields already present on each
  `daily_sales` row — it never derives a value from another (e.g. no
  price × volume synthesis). A blank Excel cell stays `null` at the
  row level (see `js/services/supabase-service.js`'s `rowToStation()`)
  and is only treated as `0` for the purposes of summing, via the
  `N()` helper in `js/business/aggregation.js`.
- `js/pages/daily-records.js` uses this same null-vs-zero distinction
  to render a dotted-underline "partial data" marker when *some but
  not all* stations reported a field on a given day.
- `js/business/metrics.js`'s `monthMetrics()` is the **only** place
  that computes a ratio (budget attainment %), and only when a target
  row exists in `monthly_budgets` — it is never used to backfill a
  missing actual.
- DPK is intentionally excluded from station rankings in
  `js/pages/stations.js`, matching the original rule.
- Station rank in `js/pages/stations.js` is computed once over the
  *complete* relevant station population, before any search-box filter
  is applied — filtering only hides rows from view, it never
  recalculates rank.

None of this logic changed during the refactor; it was relocated,
not rewritten.

## 7. Where authentication / access control happens

**Reads are intentionally open. Writes are locked down.** This was a
deliberate choice, not an oversight: `index.html` is meant to be
viewable without a login, and only `upload.html`'s writes needed
hardening.

- **`index.html`** has no login and none is planned — both
  `SUPABASE_URL` and `SUPABASE_KEY` in `js/config.js` are Supabase's
  client-safe *publishable* (anon) key, the same kind of value
  Google Maps' or Stripe's own client-side SDKs ship in your
  browser's network tab. It carries no privilege by itself; the
  `daily_sales` table's `select` RLS policy (see below) simply
  allows `true` — anyone. `js/config.js` itself is gitignored (see
  §15) as a source-control hygiene practice, not because the key
  needs to be hidden from the browser — it can't be, and doesn't
  need to be.
- **`upload.html`** requires a signed-in Supabase Auth account with
  an `uploader` role before its upload form is even shown. This is
  enforced in two places:
  1. **Client-side gate** — `js/upload/auth.js` shows a login form
     (`#loginBox`) and keeps `#uploadForm` hidden until a valid,
     non-expired session exists. This is a UX convenience, not the
     real security boundary — anyone could bypass it by editing the
     page's DOM.
  2. **Server-side enforcement** — the actual boundary is Postgres
     Row Level Security, added by
     [`sql/001_lockdown_daily_sales_writes.sql`](../sql/001_lockdown_daily_sales_writes.sql).
     `daily_sales` has `insert`/`update` policies that check for a
     matching row in a new `app_roles` table
     (`role = 'uploader'`, keyed to `auth.uid()`). A request that
     reaches the API with just the anon key — bypassing the UI
     entirely, e.g. via curl — is rejected by Postgres itself,
     regardless of what the browser-side gate did or didn't show.

`js/upload/upload-service.js`'s write request sends the signed-in
user's session **access token** as the `Authorization` header (not
the anon key, which is still sent separately as `apikey` — Supabase
always requires that header for project identification). That access
token is what lets Postgres resolve `auth.uid()` inside the RLS
policy check.

`monthly_budgets` was **not** part of this hardening pass — it's
managed by a separate admin page outside this project's scope (see
§8), and this dashboard only ever reads it.

### Adding or removing uploader accounts

No code change needed — see `sql/001_lockdown_daily_sales_writes.sql`'s
trailing comment block, or the README's "Setting up upload access"
section, for the two-step process (create the Supabase Auth user,
add one row to `app_roles`).

## 8. Where admin functionality is implemented

There isn't any *in this codebase*. The comments in the original file
(preserved in `js/services/supabase-service.js`) note that
`monthly_budgets` (the target/budget figures shown in the Budget vs
Actual tab) is written by a **separate, not-included** "Budget
Administration" page — this dashboard only ever reads that table. If
that admin page exists elsewhere, it was out of scope for this
refactor since it wasn't part of the two files provided.

## 9. Where assets live

```
assets/images/
├── rainoil-logo.png          The Rainoil logo (used in both the loading
│                               screen and masthead — previously duplicated
│                               inline as two identical base64 blobs)
└── loading-background.jpg    The blurred background photo behind the
                                loading screen (previously inline base64)
```

Both were previously embedded as `data:` URIs directly in the HTML/CSS,
which is why the original single file was 172 KB despite having a
relatively small amount of actual markup/logic — decoding them out to
real files dropped `index.html` to ~16 KB and means the browser can
now cache the images across the two pages and across repeat visits,
instead of re-downloading them inline every time.

## 10. How to run the application locally

No install step is required — it's static files. From the project
root:

```bash
python3 -m http.server 8080
# then open http://localhost:8080/index.html
```

Or any other static file server (`npx serve`, VS Code's Live Server
extension, etc.) works identically. Opening `index.html` directly via
`file://` will **not** work, because the Supabase `fetch()` calls are
subject to CORS/browser security rules that require an actual HTTP
origin.

## 11. How to deploy it

Upload the entire project folder to any static host — Netlify,
Vercel (as a static site, no framework preset), GitHub Pages, an S3
bucket with static hosting, or Rainoil's own web server. There is
nothing to build or compile.

**One exception to "the entire folder":** `js/config.js` is
gitignored (see §15), so if you're deploying straight from a git
checkout, that file won't be there — copy it in separately (or
regenerate it from `js/config.example.js` with the real values) as
part of the deploy, or the live site will have no Supabase
connection at all.

## 12. Environment variables

See `.env.example`. As of this refactor there is no build tool
reading `.env` — the two Supabase values live directly in
`js/config.js` (gitignored — see §15), which is safe for the reasons
in §7. `.env.example` exists so the two values are documented and so
a future build-step migration has a ready-made contract to target.

## 13. Known limitations / remaining technical debt

Carried over from the original app (not introduced by this refactor):

- `upload.html`'s Supabase URL/anon key are entered by hand and
  persisted in `localStorage` per browser — there's no shared,
  centrally-managed credential for *that* value (the uploader's
  identity, however, is now properly managed via Supabase Auth —
  see §7).
- `index.html` still has no login, by design (see §7) — anyone with
  the URL can read all figures. If that stops being acceptable,
  the same RLS + Auth pattern used for `upload.html` could be
  extended to require a login for reads too, but that's a product
  decision, not something to add silently.
- Session tokens in `upload.html` are stored in `localStorage`
  rather than an `httpOnly` cookie (the only option available
  without introducing a backend), so they're readable by any script
  running on the page — acceptable for this app's threat model
  (trusted internal users, no third-party scripts loaded), but worth
  knowing if that ever changes.
- `js/pages/stations.js` is large (~400 lines) because the Stations
  tab's list/detail/compare views and the in-detail Monthly Product
  Trend section are tightly coupled through shared `STATE` fields
  (`STATE.selectedStation`, `STATE.stationsSubtab`, `STATE.cmpA/cmpB`,
  etc.) — splitting it further would mean threading that shared state
  across file boundaries for little clarity gain. Flagged for a future
  pass if the file keeps growing.
- The "Budget Administration" page referenced in code comments was
  not part of the two files provided and is not included here.

None of the above are regressions from this refactor — they are
pre-existing characteristics of the application, documented here per
the original brief's request to flag anything that "already exists"
rather than silently fixing it.

## 14. Multi-year reporting and Period Analysis

Two related capabilities were added on top of the refactored
structure above: **multi-year historical reporting** (select any
year/month that has data, not just the current one) and **Period
Analysis** (a Recorded-Day Average calculator for an arbitrary
station/product/date range). Neither changes any existing business
rule, calculation, or page — see §32 of the enhancement brief this
was built against for why that mattered.

### Multi-year reporting was mostly already there

Before this change, `MONTH_KEYS` (in `js/business/aggregation.js`)
was already derived purely from the `sale_date` values actually
present in `RAW_DATA` — `"YYYY-MM"` strings, sorted lexicographically,
which sorts correctly across year boundaries with zero special-casing.
`rangeMonthKeys()`, `monthLabel()`, MoM deltas, and the Stations/Trend/
Comparison pages already operated on this array positionally, not on
any hardcoded calendar assumption. This was verified directly against
the actual code (not assumed) before any change was made, and
confirmed with an integration test using a synthetic 2024→2025→2026
dataset that deliberately included gaps (a station that only existed
in one year, a missing calendar month) — every existing calculation
(trailing-12 trend window, MoM comparison, station rosters, budget
attainment) reconciled correctly across year boundaries with no code
changes needed to those files.

**What was actually added:** the single `#month-select` dropdown
(which already spanned all years, just as one flat list like "August
2026, July 2026, June 2026, ...") was split into two selects —
`#year-select` and `#month-only-select` — in `js/app.js`:

- `uniqueYearsFromMonthKeys()` derives the year list from `MONTH_KEYS`
  — no year is ever hardcoded, so a newly-imported year appears the
  next time the dashboard loads, with no frontend change.
- `populateMonthOnlySelect(year, ...)` filters `MONTH_KEYS` down to
  the months that actually have data within the selected year.
- `onYearChange(year)` picks the most recent available month within
  that year and calls the existing `onMonthChange(mk)` — which was
  not modified at all, since every page already correctly re-renders
  from whatever `STATE.month` it's given.

This means §6–§13 of the enhancement brief (station ranking, revenue,
budget, daily records, product trends, comparison all respecting the
selected historical period) required **no changes** to
`js/pages/*.js` or `js/business/*.js` — they already worked this way.

### Period Analysis — a new, independent tab

Unlike the rest of the dashboard, Period Analysis is not driven by
`STATE.month`. It has its own filters (station, product, start date,
end date) stored in `STATE.paStation` / `STATE.paProduct` /
`STATE.paStart` / `STATE.paEnd`, following the same pattern the
existing Compare Stations feature already used for its own filters
(`STATE.cmpA` / `STATE.cmpB` / etc.).

**Three new files, one clear responsibility each:**

- **`js/services/period-analysis-service.js`** — `fetchStationPeriodRows()`.
  Queries Supabase directly, filtered to one station name and one
  date range (`name=eq....&sale_date=gte....&sale_date=lte....`),
  rather than reading from the already-loaded `RAW_DATA`. This was a
  deliberate choice: the rest of the dashboard loads the entire
  `daily_sales` table once at startup so everything else can render
  instantly with no further network calls, but that doesn't scale
  indefinitely as more years of history are imported. Period
  Analysis's station+date-range query is naturally small and
  well-scoped, so it was built as a genuinely scoped fetch from the
  start — both because it's the right call for a query this specific,
  and so the pattern already exists in the codebase if/when the rest
  of the dashboard's full-load approach needs to be revisited (see
  §13's note on this).
- **`js/business/period-analysis.js`** — `summarizePeriodRows()`, the
  single place this dashboard computes a Recorded-Day Average. See
  the definition and worked example below. This file has no DOM
  dependency and was verified with a standalone unit-test suite
  (duplicate-row handling, missing days, a genuine recorded zero vs.
  a missing value, empty-result handling) before being wired into the
  page.
- **`js/pages/period-analysis.js`** — owns the DOM: populates the
  station dropdown from `allStationNames()`, validates the date range,
  calls the service then the business logic, renders the summary
  cards and daily table, and exports CSV (reusing `csvCell()` from
  `js/pages/daily-records.js` for identical escaping behavior). Also
  guards against a slow request being overtaken by a newer one if the
  person changes filters again before the first fetch returns.

### Recorded-Day Average — exact definition

```
Average Daily Sales
  = Total recorded sales volume during the selected period
  ÷ Number of unique dates with a valid (non-null) recorded
    value for that station and product during the selected period
```

The denominator is **unique recorded dates**, never calendar days in
the range. A date with no uploaded record, or a record whose value
for the selected product is blank, is excluded from both the
numerator and the denominator — it is never treated as a zero. A
date where the recorded value genuinely *is* zero (an actual reported
zero-sales day) **is** counted, since that's a real recorded value,
not a missing one — see Test 6 in the reconciliation suite below.

If the same station+date has more than one row in `daily_sales` (a
duplicate), their non-null values for the selected product are
**summed**, but that date still counts as **one** recorded day, never
two — this mirrors how the rest of the app already treats same-day
duplicates (see `js/business/aggregation.js`'s own header comment) at
the network level, applied here per-station instead.

### Reconciliation testing performed

Per §34 of the brief, a reconciliation test was run — but it's
important to be direct about what that could and couldn't cover in
this environment: **there is no network path to Supabase from where
this was built**, so no test here ran against Mike's actual database
or actual historical data. What was verified instead:

1. A 7-assertion unit-test suite against `summarizePeriodRows()`
   directly, including the brief's own worked example (1–10 Aug 2025,
   8 of 10 days recorded, 100,000 L total → 12,500 L/day average) —
   reproduced exactly.
2. Duplicate-row handling (summed, but one recorded day), missing-day
   exclusion, product-specific blank handling (PMS blank ≠ AGO blank
   on the same row), a genuine recorded zero vs. a missing value, and
   the zero-recorded-days case (`avgDaily` is `null`, never `0`).
3. A 20-assertion integration test running the actual
   `js/business/aggregation.js` and `js/business/station-analytics.js`
   files (not reimplementations) against a synthetic multi-year
   dataset spanning 2024–2026 with deliberate gaps, confirming
   `MONTH_KEYS` ordering, year derivation, trailing-window trend
   calculations, and station rosters all reconcile correctly across
   year boundaries.
4. Full JS syntax validation of every file individually and in exact
   script-load order, plus HTML structural validation and an
   automated cross-check that every `getElementById()` call in the
   JS has a matching element in the HTML (and vice versa).

**What still needs to happen before this is trusted for management
reporting:** Mike running a real query against his own database for
a known station/period, and comparing the dashboard's Period Analysis
output line-by-line against that. This is explicitly called out as a
manual step, not something claimed as done here.

### Known limitation

The database schema (column names, types, presence of an index on
`sale_date`) was inferred entirely from what the existing frontend
code already queries (`sale_date`, `name`, `sales_pms`, `sales_ago`,
etc., visible in `js/services/supabase-service.js`'s existing
`rowToStation()`), not confirmed against the live schema — there was
no way to connect to Supabase from this environment to verify it
directly. If a station's period-analysis query is slow once real
2024/2025 volume is imported, adding a Postgres index on
`daily_sales(name, sale_date)` would be the first thing to check —
see §22 of the enhancement brief.

## 15. Keeping js/config.js out of git

`js/config.js` (the real Supabase URL/key) is listed in `.gitignore`
and never gets committed. `js/config.example.js` is the tracked
template — a fresh clone runs `cp js/config.example.js js/config.js`
and fills in the real values once (see README.md → "Configuration").

**This is a source-control hygiene decision, not a fix for a
vulnerability that existed before it.** `SUPABASE_KEY` is Supabase's
publishable (anon) key — safe to expose in browser code by design,
gated entirely by Postgres RLS, and still fully visible in any
deployed dashboard's network tab regardless of this change. No
client-side app can hide a key from its own browser at runtime; that
would require routing every Supabase call through a real backend/
proxy layer, which is a materially bigger architectural change than
this project currently has (see §13 for related notes on the
full-load-vs-scoped-fetch tradeoff, which runs into the same
"no backend" constraint).

What keeping it out of git *does* achieve: the key doesn't sit
permanently in this project's commit history, isn't visible to
anyone who has read-only access to the repository without also
having access to the deployed app, and doesn't need retroactive
history-scrubbing if the repository's visibility or audience ever
changes. This was added in response to an internal IT review request
— see the specific concern in README.md → "Security" about
`monthly_budgets` and other tables' RLS status being unverified from
this codebase alone, which is the actual risk worth tracking down,
independent of where the key text happens to live.
