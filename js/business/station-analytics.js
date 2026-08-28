'use strict';

/* ════════════════════════════════════════════════════════
   MONTHLY PRODUCT TREND / STATION COMPARISON — shared data
   helpers. These read exclusively from MONTH_AGG, the same
   monthly aggregate the rest of the dashboard is built on;
   no separate aggregation pipeline is introduced. A station
   is only "present" for a month if it appears in that
   month's MONTH_AGG[mk].stations map (i.e. it actually
   reported at least one day that month) — a month where the
   station has no records at all is left out entirely rather
   than shown as a fabricated zero.
   ════════════════════════════════════════════════════════ */
var ALL_STATION_NAMES = null; // cached, built lazily from every month on file
function allStationNames(){
  if (ALL_STATION_NAMES) return ALL_STATION_NAMES;
  var set = {};
  MONTH_KEYS.forEach(function(mk){
    Object.keys(MONTH_AGG[mk].stations).forEach(function(n){ set[n]=true; });
  });
  ALL_STATION_NAMES = Object.keys(set).sort();
  return ALL_STATION_NAMES;
}

// Returns the ordered subset of MONTH_KEYS for a given range option,
// anchored on the currently selected reporting month (STATE.month) —
// consistent with how the rest of the dashboard treats "the current
// period". Only months that exist in MONTH_AGG are ever returned.
function rangeMonthKeys(range, anchorMk){
  var idx = MONTH_KEYS.indexOf(anchorMk);
  if (idx===-1) return MONTH_KEYS.slice();
  if (range==='6') return MONTH_KEYS.slice(Math.max(0, idx-5), idx+1);
  if (range==='12') return MONTH_KEYS.slice(Math.max(0, idx-11), idx+1);
  if (range==='ytd'){
    var year = anchorMk.slice(0,4);
    return MONTH_KEYS.slice(0, idx+1).filter(function(k){ return k.slice(0,4)===year; });
  }
  return MONTH_KEYS.slice(); // 'all'
}

/* ════════════════════════════════════════════════════════
   YEAR-TO-DATE TOTALS — sums each month's already-computed
   totals (js/business/aggregation.js's blankTotals() shape)
   across January through the selected month, within the
   selected month's own year. Reuses rangeMonthKeys('ytd', mk),
   the exact same month set the Trend tab's own YTD option
   already uses, so this can never disagree with it.

   A month with no data at all is simply not in that month set
   — it contributes nothing and is not counted toward
   monthsWithData — never treated as a zero month. This mirrors
   the recorded-day-vs-calendar-day distinction Period Analysis
   makes, one level up (recorded month vs calendar month).
   ════════════════════════════════════════════════════════ */
function ytdTotals(mk){
  var mks = rangeMonthKeys('ytd', mk);
  var t = { pmsVol:0, agoVol:0, dpkVol:0, pmsRev:0, agoRev:0, dpkRev:0, totalVol:0, totalRev:0 };
  mks.forEach(function(k){
    var mt = MONTH_AGG[k].totals;
    t.pmsVol += mt.pmsVol; t.agoVol += mt.agoVol; t.dpkVol += mt.dpkVol;
    t.pmsRev += mt.pmsRev; t.agoRev += mt.agoRev; t.dpkRev += mt.dpkRev;
    t.totalVol += mt.totalVol; t.totalRev += mt.totalRev;
  });
  var monthNum = parseInt(mk.slice(5,7), 10);
  return {
    year: mk.slice(0,4),
    months: mks,
    totals: t,
    monthsWithData: mks.length,
    monthsExpected: monthNum // January..selected month, calendar count — the denominator for "X of Y months recorded"
  };
}

// One station, one product, across a set of month keys. Each point is
// either a real reported volume or null (station did not report that
// product that month) — never a synthesized zero.
function stationProductSeries(name, product, mks){
  return mks.map(function(mk){
    var st = MONTH_AGG[mk].stations[name];
    var val = st ? (product==='pms' ? st.pmsVol : st.agoVol) : null;
    return { mk:mk, label:monthLabel(mk), val: (val===undefined) ? null : val };
  });
}

// Month-on-month delta for a series produced by stationProductSeries,
// comparing each point only to the immediately preceding point in the
// SAME series — not the calendar-previous month if that month isn't
// present. If either side is missing, momPct/momDelta are null and must
// render as "—", never Infinity/NaN/a fabricated percentage.
function withMoM(series){
  return series.map(function(pt,i){
    var prev = i>0 ? series[i-1] : null;
    var delta = (prev && prev.val!==null && pt.val!==null) ? (pt.val-prev.val) : null;
    var pct = (delta!==null && prev.val!==0) ? (delta/prev.val*100) : (delta===0?0:null);
    return Object.assign({}, pt, { momDelta:delta, momPct:pct });
  });
}
function momCellHtml(delta,pct){
  if (delta===null || delta===undefined) return '<span class="mom-cell gray">—</span>';
  var cls = delta>0?'good':(delta<0?'bad':'gray');
  var pctTxt = (pct===null||pct===undefined||!isFinite(pct)) ? '' : ' ('+(pct>0?'+':'')+pct.toFixed(1)+'%)';
  return '<span class="mom-cell '+cls+'">'+(delta>0?'+':'')+fmtVFull(delta)+pctTxt+'</span>';
}

