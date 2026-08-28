'use strict';

/* ════════════════════════════════════════════════════════
   TAB 3 — TREND
   No run-rate, no year-end projection: month-over-month
   actuals and the target line only where a target exists.
   ════════════════════════════════════════════════════════ */
function renderTrend(mk){
  var idx = MONTH_KEYS.indexOf(mk);
  var windowKeys = MONTH_KEYS.slice(Math.max(0, idx-11), idx+1);
  var P = chartPalette();
  document.getElementById('trend-sub').textContent = windowKeys.length+' month(s) of history through '+monthLabel(mk);

  var labels = windowKeys.map(monthLabel);
  var volPMS = windowKeys.map(function(k){ return MONTH_AGG[k].totals.pmsVol; });
  var volAGO = windowKeys.map(function(k){ return MONTH_AGG[k].totals.agoVol; });
  var volDPK = windowKeys.map(function(k){ return MONTH_AGG[k].totals.dpkVol; });
  var revTot = windowKeys.map(function(k){ return MONTH_AGG[k].totals.totalRev; });
  var volTargetLine = windowKeys.map(function(k){ var b=getBudgetFor(k); return b ? (b.pms.vol+b.ago.vol+b.dpk.vol) : null; });

  mkChart('c-trend-vol',{type:'bar',data:{labels:labels,datasets:[
      {type:'bar',label:'PMS', data:volPMS, backgroundColor:P.teal, stack:'v'},
      {type:'bar',label:'AGO', data:volAGO, backgroundColor:P.navy, stack:'v'},
      {type:'bar',label:'DPK', data:volDPK, backgroundColor:P.plum, stack:'v'},
      {type:'line',label:'Volume Target', data:volTargetLine, borderColor:P.gold, borderWidth:2, pointRadius:2, fill:false, spanGaps:true}
    ]}, options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{color:P.legend,boxWidth:11,font:{size:11}}},tooltip:{callbacks:{label:function(c){return c.dataset.label+': '+fmtVCompact(c.raw);}}}},scales:{x:{stacked:true,grid:{display:false}},y:{stacked:true,grid:{color:P.grid},ticks:{callback:function(v){return fmtVCompact(v);}}}}}
  });
  mkChart('c-trend-rev',{type:'line',data:{labels:labels,datasets:[
      {label:'Total Revenue', data:revTot, borderColor:P.teal, backgroundColor:alpha(P.teal,0.08), fill:true, tension:.25, borderWidth:2, pointRadius:2}
    ]}, options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{color:P.legend,boxWidth:11,font:{size:11}}},tooltip:{callbacks:{label:function(c){return c.dataset.label+': '+fmtCompact(c.raw);}}}},scales:{x:{grid:{display:false}},y:{grid:{color:P.grid},ticks:{callback:function(v){return fmtCompact(v);}}}}}
  });
}

