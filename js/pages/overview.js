'use strict';

/* ════════════════════════════════════════════════════════
   TAB 1 — OVERVIEW
   ════════════════════════════════════════════════════════ */
function renderExec(mk){
  var mm = monthMetrics(mk);
  var t = mm.t;
  var pk = prevMonthKey(mk);
  var prevT = pk ? MONTH_AGG[pk].totals : null;
  var stationCount = Object.keys(t.stationsSeen).length;
  var P = chartPalette();

  document.getElementById('exec-title').textContent = monthLabel(mk)+' Summary';
  document.getElementById('exec-sub').textContent = stationCount+' stations reporting — Rainoil network performance';

  var momVol = momPct(t.totalVol, prevT?prevT.totalVol:null);
  var momRev = momPct(t.totalRev, prevT?prevT.totalRev:null);

  var kEl=document.getElementById('exec-kpis'); kEl.innerHTML='';
  function mk_(l,v,s,cls,accent){ var d=document.createElement('div'); d.className='kpi-card'+(accent?' accent':''); d.innerHTML='<div class="kpi-label">'+l+'</div><div class="kpi-val">'+v+'</div><div class="kpi-sub'+(cls?' '+cls:'')+'">'+s+'</div>'; kEl.appendChild(d); }
  mk_('Total Volume', fmtVCompact(t.totalVol), momVol!==null?(signed(momVol,function(v){return fmtPct(Math.abs(v));})+' vs '+monthLabel(pk)):'No prior month', momVol>0?'good':(momVol<0?'bad':''), true);
  mk_('Total Revenue', fmtCompact(t.totalRev), momRev!==null?(signed(momRev,function(v){return fmtPct(Math.abs(v));})+' vs '+monthLabel(pk)):'No prior month', momRev>0?'good':(momRev<0?'bad':''));
  mk_('Volume Attainment', mm.totalVolAtt!==null?fmtPct(mm.totalVolAtt):'Pending', mm.totalVolAtt!==null?'vs monthly target':'target not set', attColor(mm.totalVolAtt)==='bad'?'bad':(attColor(mm.totalVolAtt)==='good'?'good':''));
  mk_('Revenue Attainment', mm.totalRevAtt!==null?fmtPct(mm.totalRevAtt):'Pending', mm.totalRevAtt!==null?'vs monthly target':'target not set', attColor(mm.totalRevAtt)==='bad'?'bad':(attColor(mm.totalRevAtt)==='good'?'good':''));
  mk_('PMS Volume', fmtVCompact(t.pmsVol), mm.pmsVolAtt!==null?fmtPct(mm.pmsVolAtt)+' of target':'Target pending', '');
  mk_('AGO Volume', fmtVCompact(t.agoVol), mm.agoVolAtt!==null?fmtPct(mm.agoVolAtt)+' of target':'Target pending', '');
  mk_('DPK Volume', fmtVCompact(t.dpkVol), mm.dpkVolAtt!==null?fmtPct(mm.dpkVolAtt)+' of target':'Target pending', '');
  mk_('Stations Reporting', stationCount, t.days+' day(s) of data loaded', '');

  /* Daily series within selected month */
  var dates = datesInMonth(mk);
  var dayLabels = dates.map(function(d){ return parseInt(d.slice(8,10),10); });
  var dailyRev = dates.map(function(d){ return RAW_DATA[d].stations.reduce(function(s,x){return s+N(x.total);},0); });
  var dailyVol = dates.map(function(d){ return RAW_DATA[d].stations.reduce(function(s,x){return s+N(x.totalVol);},0); });
  var dailyActive = dates.map(function(d){ return RAW_DATA[d].stations.length; });

  mkChart('c-exec-daily-rev',{type:'line',data:{labels:dayLabels,datasets:[
      {label:'Revenue', data:dailyRev, borderColor:P.teal, backgroundColor:alpha(P.teal,0.08), fill:true, tension:.25, pointRadius:0, borderWidth:2}
    ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:function(c){return fmtCompact(c.raw);}}}},scales:{x:{grid:{display:false},title:{display:true,text:'Day of Month',color:P.tick,font:{size:10}}},y:{grid:{color:P.grid},ticks:{callback:function(v){return fmtCompact(v);}}}}}
  });
  mkChart('c-exec-mix',{type:'doughnut',data:{labels:['PMS','AGO','DPK'],datasets:[
      {data:[t.pmsRev,t.agoRev,t.dpkRev], backgroundColor:[P.teal,P.navy,P.plum], borderColor:P.surface, borderWidth:2}
    ]},options:{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{legend:{position:'bottom',labels:{color:P.legend,boxWidth:11,font:{size:11}}},tooltip:{callbacks:{label:function(c){var tot=c.dataset.data.reduce(function(a,b){return a+b;},0);return c.label+': '+fmtCompact(c.raw)+' ('+(c.raw/tot*100).toFixed(1)+'%)';}}}}}
  });
  mkChart('c-exec-daily-vol',{type:'bar',data:{labels:dayLabels,datasets:[
      {label:'Volume', data:dailyVol, backgroundColor:P.navy, borderRadius:2, maxBarThickness:16}
    ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:function(c){return fmtVCompact(c.raw);}}}},scales:{x:{grid:{display:false},title:{display:true,text:'Day of Month',color:P.tick,font:{size:10}}},y:{grid:{color:P.grid},ticks:{callback:function(v){return fmtVCompact(v);}}}}}
  });
  mkChart('c-exec-active',{type:'bar',data:{labels:dayLabels,datasets:[
      {label:'Active Stations', data:dailyActive, backgroundColor:P.plum, borderRadius:2, maxBarThickness:16}
    ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},title:{display:true,text:'Day of Month',color:P.tick,font:{size:10}}},y:{grid:{color:P.grid}}}}
  });

  renderYtdSummary(mk);
}

/* ════════════════════════════════════════════════════════
   YEAR TO DATE — a persistent rollup at the bottom of Overview,
   but NOT a fixed/independent block: it always describes
   January through whichever month is currently selected above,
   in that month's own year. Selecting March 2025 shows Jan–Mar
   2025; selecting August 2026 shows Jan–Aug 2026. This keeps it
   consistent with the rest of the page rather than a separate,
   ambiguous "current year" figure that could disagree with
   whatever period the person is actually looking at.
   ════════════════════════════════════════════════════════ */
function renderYtdSummary(mk){
  var y = ytdTotals(mk);
  var monthName = MONTHS[parseInt(mk.slice(5,7),10)];

  document.getElementById('ytd-title').textContent = 'Year to Date — '+y.year;
  var gapNote = y.monthsWithData < y.monthsExpected
    ? ' ('+y.monthsWithData+' of '+y.monthsExpected+' month(s) have recorded data — months with no records are excluded, not counted as zero)'
    : '';
  document.getElementById('ytd-sec-sub').textContent =
    'January through '+monthName+' '+y.year+gapNote;

  var kEl = document.getElementById('ytd-kpis'); kEl.innerHTML = '';
  function kpi(label, val, sub, accent){
    var d = document.createElement('div');
    d.className = 'kpi-card'+(accent?' accent':'');
    d.innerHTML = '<div class="kpi-label">'+label+'</div><div class="kpi-val">'+val+'</div>'+(sub?'<div class="kpi-sub">'+sub+'</div>':'');
    kEl.appendChild(d);
  }
  kpi('Total Volume (YTD)', fmtVCompact(y.totals.totalVol), y.monthsWithData+' month(s) recorded', true);
  kpi('Total Revenue (YTD)', fmtCompact(y.totals.totalRev), y.monthsWithData+' month(s) recorded');
  kpi('PMS Volume (YTD)', fmtVCompact(y.totals.pmsVol));
  kpi('AGO Volume (YTD)', fmtVCompact(y.totals.agoVol));
  kpi('DPK Volume (YTD)', fmtVCompact(y.totals.dpkVol));
}

