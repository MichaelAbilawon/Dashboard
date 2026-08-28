'use strict';

/* ════════════════════════════════════════════════════════
   TAB 5 — PRODUCT MIX
   ════════════════════════════════════════════════════════ */
function renderMix(mk){
  var t = MONTH_AGG[mk].totals;
  var pk = prevMonthKey(mk);
  var prevT = pk ? MONTH_AGG[pk].totals : null;
  var P = chartPalette();

  mkChart('c-mix-vol',{type:'doughnut',data:{labels:['PMS','AGO','DPK'],datasets:[
      {label:monthLabel(mk), data:[t.pmsVol,t.agoVol,t.dpkVol], backgroundColor:[P.teal,P.navy,P.plum], borderColor:P.surface, borderWidth:2}
    ]},options:{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{legend:{position:'bottom',labels:{color:P.legend,boxWidth:11,font:{size:11}}},tooltip:{callbacks:{label:function(c){var tot=c.dataset.data.reduce(function(a,b){return a+b;},0);return c.label+': '+fmtVCompact(c.raw)+' ('+(c.raw/tot*100).toFixed(1)+'%)';}}}}}
  });
  mkChart('c-mix-rev',{type:'doughnut',data:{labels:['PMS','AGO','DPK'],datasets:[
      {label:monthLabel(mk), data:[t.pmsRev,t.agoRev,t.dpkRev], backgroundColor:[P.teal,P.navy,P.plum], borderColor:P.surface, borderWidth:2}
    ]},options:{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{legend:{position:'bottom',labels:{color:P.legend,boxWidth:11,font:{size:11}}},tooltip:{callbacks:{label:function(c){var tot=c.dataset.data.reduce(function(a,b){return a+b;},0);return c.label+': '+fmtCompact(c.raw)+' ('+(c.raw/tot*100).toFixed(1)+'%)';}}}}}
  });

  var noteWrap = document.getElementById('mix-note-wrap');
  if (prevT && t.totalVol>0 && prevT.totalVol>0){
    noteWrap.style.display='';
    var pmsShareNow = t.pmsVol/t.totalVol*100, pmsShareBefore = prevT.pmsVol/prevT.totalVol*100;
    var agoShareNow = t.agoVol/t.totalVol*100, agoShareBefore = prevT.agoVol/prevT.totalVol*100;
    document.getElementById('mix-shift-note').innerHTML =
      'PMS volume share is '+(pmsShareNow>pmsShareBefore?'up':'down')+' from '+pmsShareBefore.toFixed(1)+'% to '+pmsShareNow.toFixed(1)+'% of total volume vs '+monthLabel(pk)+'. AGO share moved from '+agoShareBefore.toFixed(1)+'% to '+agoShareNow.toFixed(1)+'%.';
  } else {
    noteWrap.style.display='none';
  }
}
