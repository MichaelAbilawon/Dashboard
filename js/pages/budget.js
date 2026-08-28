'use strict';

/* ════════════════════════════════════════════════════════
   TAB 2 — BUDGET VS ACTUAL (READ-ONLY)
   Targets come from the monthly_budgets table, maintained
   only via the separate Budget Administration page. No
   input fields, no save action, exist on this dashboard.
   ════════════════════════════════════════════════════════ */
function renderBudget(mk){
  var mm = monthMetrics(mk);
  var t = mm.t;
  var P = chartPalette();
  document.getElementById('budget-title').textContent = monthLabel(mk)+' Budget Performance';
  document.getElementById('budget-sub').textContent = 'Actual sales vs monthly targets — PMS, AGO & DPK';

  var kEl=document.getElementById('budget-kpis'); kEl.innerHTML='';
  function mk_(l,v,s,cls){ var d=document.createElement('div'); d.className='kpi-card'; d.innerHTML='<div class="kpi-label">'+l+'</div><div class="kpi-val">'+v+'</div><div class="kpi-sub'+(cls?' '+cls:'')+'">'+s+'</div>'; kEl.appendChild(d); }
  mk_('Total Volume Attainment', mm.totalVolAtt!==null?fmtPct(mm.totalVolAtt):'—', mm.totalVolAtt!==null?'vs monthly target':'target not set', '');
  mk_('Total Revenue Attainment', mm.totalRevAtt!==null?fmtPct(mm.totalRevAtt):'—', mm.totalRevAtt!==null?'vs monthly target':'target not set', '');

  var bEl=document.getElementById('budget-bars'); bEl.innerHTML='';
  if (!mm.budget){
    bEl.innerHTML = '<div class="empty-state">No monthly target has been set for '+monthLabel(mk)+' yet. Targets are entered by Finance via the Budget Administration module.</div>';
  } else {
    var rows=[
      {label:'PMS Volume', actual:t.pmsVol, target:mm.pmsTarget, unit:'L'},
      {label:'PMS Revenue', actual:t.pmsRev, target:mm.pmsRevTarget, unit:'₦'},
      {label:'AGO Volume', actual:t.agoVol, target:mm.agoTarget, unit:'L'},
      {label:'AGO Revenue', actual:t.agoRev, target:mm.agoRevTarget, unit:'₦'},
      {label:'DPK Volume', actual:t.dpkVol, target:mm.dpkTarget, unit:'L'},
      {label:'DPK Revenue', actual:t.dpkRev, target:mm.dpkRevTarget, unit:'₦'}
    ];
    rows.forEach(function(r){
      var pct = r.target ? (r.actual/r.target*100) : null;
      var col = attColor(pct);
      var w = pct!==null ? Math.min(100,pct) : 0;
      var varianceAbs = r.actual - (r.target||0);
      var fmt = r.unit==='₦' ? fmtNFull : function(v){ return fmtVFull(v)+' L'; };
      var div=document.createElement('div'); div.className='budget-row';
      div.innerHTML =
        '<div class="budget-row-head">'+
          '<span class="budget-row-label">'+r.label+'</span>'+
          '<span class="ach-pct '+col+'">'+(pct!==null?pct.toFixed(1)+'%':'—')+'</span>'+
        '</div>'+
        '<div class="budget-track"><div class="budget-fill '+col+'" style="width:'+w+'%"></div></div>'+
        '<div class="budget-nums" style="margin-top:.6rem">'+
          '<div class="bn-item"><span class="bn-k">Target</span><span class="bn-v">'+(r.target?fmt(r.target):'—')+'</span></div>'+
          '<div class="bn-item"><span class="bn-k">Actual</span><span class="bn-v">'+fmt(r.actual)+'</span></div>'+
          '<div class="bn-item"><span class="bn-k">Variance</span><span class="bn-v '+(r.target?(varianceAbs>=0?'good':'bad'):'')+'">'+(r.target?signed(varianceAbs,fmt):'—')+'</span></div>'+
        '</div>';
      bEl.appendChild(div);
    });
  }

  mkChart('c-budget-vol',{type:'bar',data:{labels:['PMS','AGO','DPK'],
    datasets:[
      {label:'Actual', data:[t.pmsVol,t.agoVol,t.dpkVol], backgroundColor:P.teal, borderRadius:2, maxBarThickness:46},
      {label:'Target', data:[mm.pmsTarget||0,mm.agoTarget||0,mm.dpkTarget||0], backgroundColor:P.neutral, borderRadius:2, maxBarThickness:46}
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{color:P.legend,boxWidth:11,font:{size:11}}},tooltip:{callbacks:{label:function(c){return c.dataset.label+': '+fmtVCompact(c.raw);}}}},scales:{x:{grid:{display:false}},y:{grid:{color:P.grid},ticks:{callback:function(v){return fmtVCompact(v);}}}}}
  });
  mkChart('c-budget-rev',{type:'bar',data:{labels:['PMS','AGO','DPK'],
    datasets:[
      {label:'Actual', data:[t.pmsRev,t.agoRev,t.dpkRev], backgroundColor:P.navy, borderRadius:2, maxBarThickness:46},
      {label:'Target', data:[mm.pmsRevTarget||0,mm.agoRevTarget||0,mm.dpkRevTarget||0], backgroundColor:P.neutral, borderRadius:2, maxBarThickness:46}
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{color:P.legend,boxWidth:11,font:{size:11}}},tooltip:{callbacks:{label:function(c){return c.dataset.label+': '+fmtCompact(c.raw);}}}},scales:{x:{grid:{display:false}},y:{grid:{color:P.grid},ticks:{callback:function(v){return fmtCompact(v);}}}}}
  });
}

