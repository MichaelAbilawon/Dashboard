'use strict';

/* ════════════════════════════════════════════════════════
   PERIOD ANALYSIS — RECORDED-DAY AVERAGE
   Official definition:

     Average Daily Sales
       = Total recorded sales volume during the selected period
       ÷ Number of unique days with a valid recorded sales value
         for that station and product during the selected period

   The denominator is the count of DISTINCT DATES with a valid
   (non-null) reading — never the number of calendar days in the
   range, and never inflated by duplicate rows for the same
   station/date (see groupRowsByDate below). A day with no
   record, or a record whose value for this specific product is
   blank, is excluded entirely — it is never treated as zero.

   This reuses N()/isBlankVal() from js/business/aggregation.js
   so a "blank" and a "zero" are judged identically to every
   other part of the dashboard (Daily Records, monthly rollups).
   ════════════════════════════════════════════════════════ */

// Groups raw API rows (possibly containing duplicate rows for the
// same station+date, per req #16) into one entry per unique date.
// Multiple rows for the same date have their non-null values for
// the selected product summed — matching how the rest of the app
// already treats same-day duplicates (see js/business/aggregation.js's
// header comment) — but the date still counts as ONE recorded day,
// never one per row.
function groupRowsByDate(rows, product){
  var byDate = {};
  var srcKey = product==='pms' ? 'sales_pms' : 'sales_ago';

  rows.forEach(function(r){
    var d = r.sale_date;
    if(!byDate[d]) byDate[d] = { date:d, volume:null, hasValue:false };
    var v = r[srcKey];
    if(!isBlankVal(v)){
      byDate[d].volume = N(byDate[d].volume) + v;
      byDate[d].hasValue = true;
    }
  });

  return Object.keys(byDate).sort().map(function(d){ return byDate[d]; });
}

// Main entry point. Returns:
//   { series, totalVolume, recordedDays, avgDaily }
// series only ever contains dates where a valid (non-null) value
// was actually recorded for this station+product — days with no
// record, or a blank value for this product, are left out
// entirely, never included as a zero.
function summarizePeriodRows(rows, product){
  var grouped = groupRowsByDate(rows, product);
  var series = grouped.filter(function(r){ return r.hasValue; });

  var totalVolume = series.reduce(function(s,r){ return s + r.volume; }, 0);
  var recordedDays = series.length;
  var avgDaily = recordedDays > 0 ? (totalVolume / recordedDays) : null;

  return { series: series, totalVolume: totalVolume, recordedDays: recordedDays, avgDaily: avgDaily };
}
