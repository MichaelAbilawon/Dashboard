'use strict';

/* ════════════════════════════════════════════════════════
   DERIVED METRICS — attainment % is the only ratio computed
   client-side, and only when a target exists; it is never
   used to fill in a missing actual.
   ════════════════════════════════════════════════════════ */
function monthMetrics(mk){
  var t = MONTH_AGG[mk].totals;
  var b = getBudgetFor(mk);
  var pmsTarget = b ? (b.pms.vol||0) : null, pmsRevTarget = b ? (b.pms.rev||0) : null;
  var agoTarget = b ? (b.ago.vol||0) : null, agoRevTarget = b ? (b.ago.rev||0) : null;
  var dpkTarget = b ? (b.dpk.vol||0) : null, dpkRevTarget = b ? (b.dpk.rev||0) : null;
  var totalVolTarget = b ? (pmsTarget+agoTarget+dpkTarget) : null;
  var totalRevTarget = b ? (pmsRevTarget+agoRevTarget+dpkRevTarget) : null;
  return {
    t:t, budget:b,
    pmsVolAtt: b ? (t.pmsVol/pmsTarget*100) : null, pmsRevAtt: b ? (t.pmsRev/pmsRevTarget*100) : null,
    agoVolAtt: b ? (t.agoVol/agoTarget*100) : null, agoRevAtt: b ? (t.agoRev/agoRevTarget*100) : null,
    dpkVolAtt: b ? (t.dpkVol/dpkTarget*100) : null, dpkRevAtt: b ? (t.dpkRev/dpkRevTarget*100) : null,
    totalVolAtt: b ? (t.totalVol/totalVolTarget*100) : null, totalRevAtt: b ? (t.totalRev/totalRevTarget*100) : null,
    totalVolTarget:totalVolTarget, totalRevTarget:totalRevTarget,
    pmsTarget:pmsTarget, pmsRevTarget:pmsRevTarget, agoTarget:agoTarget, agoRevTarget:agoRevTarget, dpkTarget:dpkTarget, dpkRevTarget:dpkRevTarget
  };
}
function attColor(pct){ if(pct===null||pct===undefined) return 'gray'; if(pct>=95) return 'good'; if(pct>=85) return 'warn'; return 'bad'; }
function momPct(cur,prev){ if(prev===undefined||prev===null||prev===0) return null; return (cur-prev)/prev*100; }

