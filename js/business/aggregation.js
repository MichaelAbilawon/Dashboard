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

