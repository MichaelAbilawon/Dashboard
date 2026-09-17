'use strict';

/* ════════════════════════════════════════════════════════
   AGGREGATION — pure roll-up of the fields already present
   on each daily_sales row. No field here is computed from
   another (no price×volume, no fallback synthesis). N()
   treats a blank Excel cell (null/undefined) as contributing
   0 to a sum — the same result Excel's own SUM() gives a
   blank cell — while the raw null is preserved on each row
   for the Daily Records page and the missing-data count.
   ════════════════════════════════════════════════════════ */
function N(x){ return (x===null||x===undefined||isNaN(x)) ? 0 : x; }
function isBlankVal(x){ return x===null||x===undefined; }

function blankTotals(){ return {pmsVol:0,agoVol:0,dpkVol:0,pmsRev:0,agoRev:0,dpkRev:0,totalVol:0,totalRev:0,days:0,stationsSeen:{}}; }

function buildMonthlyAggregates(){
  var dates = Object.keys(RAW_DATA).sort();
  MONTH_AGG = {};
  dates.forEach(function(d){
    var mk = d.slice(0,7);
    if (!MONTH_AGG[mk]) MONTH_AGG[mk] = { key:mk, totals:blankTotals(), stations:{} };
    var agg = MONTH_AGG[mk];
    agg.totals.days++;
    RAW_DATA[d].stations.forEach(function(s){
      agg.totals.pmsVol+=N(s.salesPMS); agg.totals.agoVol+=N(s.salesAGO); agg.totals.dpkVol+=N(s.salesDPK);
      agg.totals.pmsRev+=N(s.valPMS); agg.totals.agoRev+=N(s.valAGO); agg.totals.dpkRev+=N(s.valDPK);
      agg.totals.totalVol+=N(s.totalVol); agg.totals.totalRev+=N(s.total);
      agg.totals.stationsSeen[s.name]=true;

      if (!agg.stations[s.name]) agg.stations[s.name]={name:s.name,vol:0,rev:0,pmsVol:0,agoVol:0,dpkVol:0,pmsRev:0,agoRev:0,dpkRev:0,daysReported:0};
      var st=agg.stations[s.name];
      st.vol+=N(s.totalVol); st.rev+=N(s.total);
      st.pmsVol+=N(s.salesPMS); st.agoVol+=N(s.salesAGO); st.dpkVol+=N(s.salesDPK);
      st.pmsRev+=N(s.valPMS); st.agoRev+=N(s.valAGO); st.dpkRev+=N(s.valDPK);
      st.daysReported++;
    });
  });
  MONTH_KEYS = Object.keys(MONTH_AGG).sort();
}

function monthLabel(mk){ var p=mk.split('-'); return MONTHS[parseInt(p[1],10)]+' '+p[0]; }
function prevMonthKey(mk){ var idx=MONTH_KEYS.indexOf(mk); return idx>0 ? MONTH_KEYS[idx-1] : null; }
function datesInMonth(mk){ return Object.keys(RAW_DATA).filter(function(d){return d.slice(0,7)===mk;}).sort(); }
function getBudgetFor(mk){ return BUDGETS[mk] || null; }

/* ════════════════════════════════════════════════════════
   DAILY ROLLUP — THE trusted daily aggregation layer.
   Generalizes what used to be daily-records.js's own
   computeDailyRows(mk): one row per date in `dates`, summing
   whichever stations are in scope for that day. A field is
   only summed from stations that actually have a value for
   it that day — if every in-scope station is blank, the cell
   is null, never a fabricated zero. Same rule computeDailyRows
   already followed for the network-wide case; this just also
   makes the "which stations count" dimension a parameter
   instead of always being "every station that day".

   `dates`   — array of 'YYYY-MM-DD' strings to include, in any
               order (typically already produced by datesInMonth()
               or a date-range filter — this function does not
               care how the list was chosen, so it works for a
               single month, an arbitrary range, or a set of
               non-contiguous days).
   `stationFilter` — null/undefined = every station reporting
               that day (network-wide, e.g. Daily Records and
               Performance Analysis's "All Stations" scope).
               A station name = only that station's row for the
               day, if it reported (Performance Analysis's
               single-station scope). A date with no matching
               row for the requested scope is left out of the
               returned array entirely — never returned as a
               zero row — so callers can always tell "no data
               that day" apart from "reported zero that day" by
               checking the row's presence in the result, or the
               specific field's null-ness.

   Reused by: daily-records.js's computeDailyRows() (network-wide,
   one month — unchanged behavior, now delegates here),
   js/business/period-analysis.js's RAW_DATA-backed row builder
   (either scope, any range).
   ════════════════════════════════════════════════════════ */
function computeDailyRowsForDates(dates, stationFilter){
  return dates.map(function(d){
    var allStations = RAW_DATA[d] ? RAW_DATA[d].stations : [];
    var stations = stationFilter ? allStations.filter(function(s){ return s.name===stationFilter; }) : allStations;
    var row = { date:d, stationsCount: stations.length };
    DAILY_FIELD_MAP.forEach(function(f){
      var key=f[0], srcKey=f[1];
      var sum=0, present=0, missing=0;
      stations.forEach(function(s){
        var v = s[srcKey];
        if (isBlankVal(v)) missing++; else { present++; sum+=v; }
      });
      row[key] = present>0 ? sum : null;
      row[key+'_partial'] = missing>0 && present>0;
      row[key+'_missing'] = missing;
    });
    return row;
  }).filter(function(row){ return row.stationsCount>0; }); // a day with zero in-scope stations reporting is not a recorded day at all
}
// Field map moved here from daily-records.js so computeDailyRowsForDates
// (and anything else in js/business/) can use it without depending on a
// js/pages/ file — business logic must not depend on page-rendering code.
var DAILY_FIELD_MAP = [
  ['pmsVol','salesPMS'], ['agoVol','salesAGO'], ['dpkVol','salesDPK'], ['totalVol','totalVol'],
  ['pmsRev','valPMS'], ['agoRev','valAGO'], ['dpkRev','valDPK'], ['totalRev','total']
];

// Every date between start and end (inclusive), in 'YYYY-MM-DD' form,
// regardless of whether RAW_DATA has a record for it — pure calendar
// arithmetic, no Date-object timezone risk (see fmtDateShort's own
// comment on why this codebase avoids `new Date(iso)` for date math).
function calendarDateRange(startIso, endIso){
  var out = [];
  var s = startIso.split('-').map(Number), e = endIso.split('-').map(Number);
  var d = Date.UTC(s[0], s[1]-1, s[2]);
  var end = Date.UTC(e[0], e[1]-1, e[2]);
  while (d <= end){
    var dt = new Date(d);
    out.push(dt.getUTCFullYear()+'-'+String(dt.getUTCMonth()+1).padStart(2,'0')+'-'+String(dt.getUTCDate()).padStart(2,'0'));
    d += 86400000;
  }
  return out;
}

