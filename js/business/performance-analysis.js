'use strict';

/* ════════════════════════════════════════════════════════
   PERFORMANCE ANALYSIS — analytical layer built entirely on
   top of computeDailyRowsForDates() (js/business/aggregation.js)
   and summarizePeriodRows() (js/business/period-analysis.js) —
   no separate daily-aggregation pipeline is introduced here.
   Every function in this file either calls one of those two,
   or operates on rows/results they already produced.
   ════════════════════════════════════════════════════════ */

/* ── ROW SOURCE — replaces the network fetch that used to back
   Period Analysis's default view. RAW_DATA is already fully
   loaded for every other tab; reading it here instead of
   re-fetching from the API means Performance Analysis's new
   "All Stations" scope costs nothing extra over what was
   already resident in memory, and the existing single-station
   view actually gets FASTER (one less network round trip per
   filter change) with byte-identical output — same table, same
   null handling, same duplicate-date summing logic in
   summarizePeriodRows(), just a different row source. ── */
function rowsFromRawDataForDates(dates, stationFilter){
  var out = [];
  dates.forEach(function(d){
    if (!RAW_DATA[d]) return;
    var stations = stationFilter
      ? RAW_DATA[d].stations.filter(function(s){ return s.name===stationFilter; })
      : RAW_DATA[d].stations;
    stations.forEach(function(s){
      out.push({ sale_date: d, sales_pms: s.salesPMS, sales_ago: s.salesAGO });
    });
  });
  return out;
}
// Thin wrapper for the common contiguous-range case (Daily Performance,
// Compare Periods). weekdayAcrossMonths() below needs the more general
// arbitrary-date-list version directly, since a weekday's occurrences
// within a month are not contiguous.
function rowsFromRawData(startDate, endDate, stationFilter){
  return rowsFromRawDataForDates(calendarDateRange(startDate, endDate), stationFilter);
}

// One call, either scope: stationFilter=null sums every station per
// date (network-wide); a station name restricts to just that station.
// Returns the exact same shape summarizePeriodRows() always has:
// { series, totalVolume, recordedDays, avgDaily }.
function performanceSummary(startDate, endDate, product, stationFilter){
  var rows = rowsFromRawData(startDate, endDate, stationFilter);
  return summarizePeriodRows(rows, product);
}

/* ── BEST / WORST DAY, with tie handling (§22) ──
   Operates on a summary's `series` (already the recorded-day-only
   list summarizePeriodRows produces — missing days are already
   excluded, never zeroed). Returns every date tied at the max/min,
   not just one. null if there is no recorded data at all. ── */
function bestWorstDay(series){
  if (!series.length) return { best:null, worst:null };
  var maxVal = Math.max.apply(null, series.map(function(r){ return r.volume; }));
  var minVal = Math.min.apply(null, series.map(function(r){ return r.volume; }));
  var bestDates = series.filter(function(r){ return r.volume===maxVal; }).map(function(r){ return r.date; });
  var worstDates = series.filter(function(r){ return r.volume===minVal; }).map(function(r){ return r.date; });
  return {
    best:  { value:maxVal, dates:bestDates },
    worst: { value:minVal, dates:worstDates }
  };
}

/* ── DAY OF WEEK ── neutral factual reporting only (§9): this
   returns numbers, never a causal claim. UI copy built from this
   must say "recorded the highest average" — never "because" or
   "causes". Missing days are already absent from `series`, so a
   weekday with zero recorded days naturally returns avgVolume:null
   rather than being included as a 0. ── */
var WEEKDAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
function weekdayOf(iso){
  var p = iso.split('-').map(Number);
  return new Date(Date.UTC(p[0], p[1]-1, p[2])).getUTCDay(); // timezone-safe: pure UTC epoch math, no local-time conversion
}
function dayOfWeekBreakdown(series){
  var buckets = {};
  series.forEach(function(r){
    var wd = weekdayOf(r.date);
    if (!buckets[wd]) buckets[wd] = { sum:0, count:0 };
    buckets[wd].sum += r.volume; buckets[wd].count++;
  });
  return WEEKDAY_NAMES.map(function(name, idx){
    var b = buckets[idx];
    return { weekday:name, recordedDays: b?b.count:0, totalVolume: b?b.sum:0, avgVolume: b ? (b.sum/b.count) : null };
  });
}

/* ── DAY OF MONTH, ACROSS MONTHS (§7, §8, §27) ──
   For a specific day number (e.g. 14) across a set of month keys:
   distinguishes three states per month —
     'day-not-in-month' — e.g. day 31 in February: the day never
                           existed that month; not the same as no data
     'no-record'        — the day exists on the calendar but no
                           valid value was recorded for this scope/product
     'ok'                — a real recorded value
   Never returns a zero for the first two states. ── */
function dayAcrossMonths(dayNum, mks, product, stationFilter){
  return mks.map(function(mk){
    var daysInThisMonth = daysInCalendarMonth(mk);
    if (dayNum > daysInThisMonth){
      return { mk:mk, label:monthLabel(mk), status:'day-not-in-month', value:null };
    }
    var iso = mk+'-'+String(dayNum).padStart(2,'0');
    var summary = performanceSummary(iso, iso, product, stationFilter);
    if (summary.recordedDays===0){
      return { mk:mk, label:monthLabel(mk), status:'no-record', value:null };
    }
    return { mk:mk, label:monthLabel(mk), status:'ok', value:summary.series[0].volume };
  });
}

// Full grid (§7's example table): every calendar day 1–31 down the
// side, one column per month. Same per-cell states as dayAcrossMonths.
// O(31 × months) calls into performanceSummary, each a cheap single-
// date lookup against already-resident RAW_DATA — inexpensive even
// for a 12-month window (≤372 lookups).
function dayOfMonthGrid(mks, product, stationFilter){
  var rows = [];
  for (var day=1; day<=31; day++){
    rows.push({ day:day, cells: dayAcrossMonths(day, mks, product, stationFilter) });
  }
  return rows;
}

/* ── WEEKDAY, ACROSS MONTHS — the corrected recurring-pattern logic.

   This is deliberately NOT the same thing as dayAcrossMonths() above.
   dayAcrossMonths() matches on day-of-month number (28 Aug → 28 Jul →
   28 Jun); this function matches on WEEKDAY (Friday 28 Aug → every
   other recorded Friday in Jul → every other recorded Friday in Jun).
   They answer two different business questions — see the correction
   this was built from for the full reasoning. The automatic "what
   happened on the best day, elsewhere" investigation now uses THIS
   function, not dayAcrossMonths().

   For each month, every calendar date matching the target weekday is
   enumerated first (there are always either 4 or 5 in a given month),
   THEN those exact dates are looked up in RAW_DATA and aggregated
   with summarizePeriodRows() — the same recorded-day averaging used
   everywhere else in this app. A weekday date with no record that
   month is excluded from both the sum and the recorded-day count,
   never treated as a zero — summarizePeriodRows() already guarantees
   this, unchanged. ── */
function weekdayAcrossMonths(weekdayIdx, mks, product, stationFilter){
  return mks.map(function(mk){
    var daysInThisMonth = daysInCalendarMonth(mk);
    var matchingDates = [];
    for (var d=1; d<=daysInThisMonth; d++){
      var iso = mk+'-'+String(d).padStart(2,'0');
      if (weekdayOf(iso) === weekdayIdx) matchingDates.push(iso);
    }
    var rows = rowsFromRawDataForDates(matchingDates, stationFilter);
    var summary = summarizePeriodRows(rows, product);
    return {
      mk: mk,
      label: monthLabel(mk),
      weekdayOccurrences: matchingDates.length, // how many of that weekday exist in the month at all (4 or 5) — not how many have data
      recordedDays: summary.recordedDays,       // how many of those actually have a valid recorded value
      totalVolume: summary.totalVolume,
      avgDaily: summary.avgDaily                // Recorded-Day Average: totalVolume ÷ recordedDays, never ÷ weekdayOccurrences
    };
  });
}

/* ── PERIOD COMPARISON (§13, §20) ──
   Takes two already-computed performanceSummary() results. Never
   divides by a zero/unavailable baseline — percentage fields are
   null (render as "N/A") rather than NaN/Infinity/a misleading 0%. ── */
function comparePeriodSummaries(a, b){
  var volDiff = (a.totalVolume!==null && b.totalVolume!==null) ? (a.totalVolume - b.totalVolume) : null;
  var avgDiff = (a.avgDaily!==null && b.avgDaily!==null) ? (a.avgDaily - b.avgDaily) : null;
  var volPct = (volDiff!==null && b.totalVolume) ? (volDiff / b.totalVolume * 100) : null;
  var avgPct = (avgDiff!==null && b.avgDaily) ? (avgDiff / b.avgDaily * 100) : null;
  return { volDiff:volDiff, avgDiff:avgDiff, volPct:volPct, avgPct:avgPct };
}
